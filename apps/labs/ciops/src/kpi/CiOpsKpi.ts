/**
 * Effect v4 service contract for the W8 KPI reading (S7 contract §9).
 *
 * **Details**
 *
 * The contract landed before its implementation (design order: schema, then
 * service, then implementation). `CiOpsKpiLive` reads the pinned inputs and
 * runs the pure fold; `CiOpsKpiNotImplemented` is the contract stub kept for
 * the contract tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema/Sha256";
import { Context, DateTime, Effect, Equal, FileSystem, Layer, Order } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { changeEventLedgerSha256, changeEventTable } from "./ChangeEvents.ts";
import { adoptionProbes, foldKpiReading, KpiFoldInput, kpiWindows } from "./Fold.ts";
import {
  AdoptionTable,
  KpiDigestMismatchError,
  KpiInputDecodeError,
  KpiInputReadError,
  KpiNotImplementedError,
} from "./Schemas.ts";
import { decodeAttemptJournal, mergeAdmissionSources, readFleetManifestFacts } from "./Sources.ts";
import type {
  AdoptionProbe,
  KpiAdmissionJoinMismatchError,
  KpiInputRole,
  KpiReading,
  KpiReadingInput,
  PinnedKpiInput,
} from "./Schemas.ts";
import type { AttemptJournalPin, FleetJournal, KpiAdmissionRow } from "./Sources.ts";

const $I = $CiopsId.create("kpi/CiOpsKpi");

/**
 * Typed failures the KPI reading can return.
 *
 * **Details**
 *
 * Read, digest and decode failures cover every pinned input and committed
 * table; the join mismatch covers the two admission sources and the ticket
 * joins. The not-implemented member is the contract stub's failure.
 *
 * @category errors
 * @since 0.0.0
 */
export type CiOpsKpiError =
  | KpiInputReadError
  | KpiDigestMismatchError
  | KpiInputDecodeError
  | KpiAdmissionJoinMismatchError
  | KpiNotImplementedError;

/**
 * Operations exposed by the KPI reading service.
 *
 * **Details**
 *
 * `read` reads each pinned input by repo-relative path, checks its SHA-256
 * over the raw bytes before decoding, and returns the `ciops-kpi-reading/v1`
 * document. `probes` reads every pin but the adoption table and returns the
 * ancestry probes that table must answer, for its local generator. Neither
 * spawns a process, makes a live fleet read or emits anything to the A-Box.
 *
 * @category services
 * @since 0.0.0
 */
export interface CiOpsKpiShape {
  readonly probes: (input: KpiReadingInput) => Effect.Effect<ReadonlyArray<AdoptionProbe>, CiOpsKpiError>;
  readonly read: (input: KpiReadingInput) => Effect.Effect<KpiReading, CiOpsKpiError>;
}

/**
 * KPI reading service over pinned corpora and committed tables.
 *
 * **Example** (Reference the service key)
 *
 * ```ts
 * import { CiOpsKpi } from "@/kpi/CiOpsKpi"
 *
 * console.log(CiOpsKpi.key.length > 0) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CiOpsKpi extends Context.Service<CiOpsKpi, CiOpsKpiShape>()($I`CiOpsKpi`) {}

// The stub ignores its input: every call fails typed.
const readNotImplemented = Effect.fn("CiOpsKpi.read")(function* (): Effect.fn.Return<KpiReading, CiOpsKpiError> {
  return yield* KpiNotImplementedError.make({ operation: "read" });
});

const probesNotImplemented = Effect.fn("CiOpsKpi.probes")(function* (): Effect.fn.Return<
  ReadonlyArray<AdoptionProbe>,
  CiOpsKpiError
> {
  return yield* KpiNotImplementedError.make({ operation: "probes" });
});

/**
 * Contract stub layer: `read` and `probes` fail with `KpiNotImplementedError`.
 *
 * **Example** (Provide the stub)
 *
 * ```ts
 * import { CiOpsKpi, CiOpsKpiNotImplemented } from "@/kpi/CiOpsKpi"
 * import { Effect, Layer } from "effect"
 *
 * const program = Effect.flatMap(CiOpsKpi, (service) => Effect.succeed(service.read))
 * console.log(Layer.isLayer(CiOpsKpiNotImplemented)) // true
 * console.log(Effect.isEffect(Effect.provide(program, CiOpsKpiNotImplemented))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CiOpsKpiNotImplemented: Layer.Layer<CiOpsKpi> = Layer.succeed(CiOpsKpi, {
  read: readNotImplemented,
  probes: probesNotImplemented,
});

const utf8Strict = new TextDecoder("utf-8", { fatal: true });

const readFailure = (role: KpiInputRole, path: string, message: string) =>
  KpiInputReadError.make({ role, path, message });

const decodeFailure = (role: KpiInputRole, path: string, message: string) =>
  KpiInputDecodeError.make({ role, path, message });

const pinFor = (input: KpiReadingInput, role: KpiInputRole): Effect.Effect<PinnedKpiInput, KpiInputReadError> =>
  Effect.fromOption(A.findFirst(input.inputs, (pin) => pin.role === role)).pipe(
    Effect.mapError(() => readFailure(role, "<unpinned>", `The reading input pins no ${role}.`))
  );

const decodeAdoptionTable = S.decodeEffect(S.fromJsonString(AdoptionTable));

const pinKey = (pin: PinnedKpiInput): string => `${pin.role}\u0000${pin.path}\u0000${pin.sha256}`;

// The table's pins and the reading's non-table pins must be the same set.
const pinsAgree = (tablePins: ReadonlyArray<PinnedKpiInput>, sourcePins: ReadonlyArray<PinnedKpiInput>): boolean => {
  const sorted = (pins: ReadonlyArray<PinnedKpiInput>) => A.sort(A.map(pins, pinKey), Order.String);
  return A.makeEquivalence<string>(Equal.equals)(sorted(tablePins), sorted(sourcePins));
};

// Directory part of a repo-relative path ("" for a bare file name).
const directoryOf = (path: string): string =>
  Str.slice(
    0,
    O.getOrElse(Str.lastIndexOf("/")(path), () => 0)
  )(path);

const makeLive = (fs: FileSystem.FileSystem, crypto: Crypto.Crypto) => {
  // Reads raw bytes, checks their SHA-256 against the pin before any decode, then decodes UTF-8.
  const readVerified = Effect.fnUntraced(function* (
    role: KpiInputRole,
    path: string,
    expectedSha256: Sha256Hex
  ): Effect.fn.Return<readonly [string, Sha256Hex], KpiInputReadError | KpiDigestMismatchError | KpiInputDecodeError> {
    const bytes = yield* fs
      .readFile(path)
      .pipe(Effect.mapError(() => readFailure(role, path, "The file could not be read.")));
    const digest = yield* crypto
      .digest("SHA-256", bytes)
      .pipe(Effect.mapError(() => readFailure(role, path, "The file could not be digested.")));
    const actualSha256 = Sha256Hex.make(Hex.encode(digest));
    if (actualSha256 !== expectedSha256) {
      return yield* KpiDigestMismatchError.make({ role, path, expectedSha256, actualSha256 });
    }
    const text = yield* Effect.try({
      try: () => utf8Strict.decode(bytes),
      catch: () => decodeFailure(role, path, "The verified bytes are not UTF-8."),
    });
    return [text, actualSha256] as const;
  });

  const readPin = (input: KpiReadingInput, role: KpiInputRole) =>
    Effect.flatMap(pinFor(input, role), (pin) => readVerified(role, `${input.repoRoot}/${pin.path}`, pin.sha256));

  const readJournal = (input: KpiReadingInput, manifestPath: string) => (pin: AttemptJournalPin) =>
    readVerified("fleet-manifest", `${input.repoRoot}/${directoryOf(manifestPath)}/${pin.path}`, pin.sha256).pipe(
      Effect.flatMap(([text]) => decodeAttemptJournal(pin, text))
    );

  const readJournals = Effect.fnUntraced(function* (
    input: KpiReadingInput
  ): Effect.fn.Return<
    readonly [DateTime.Utc, ReadonlyArray<FleetJournal>],
    KpiInputReadError | KpiDigestMismatchError | KpiInputDecodeError
  > {
    const manifestPin = yield* pinFor(input, "fleet-manifest");
    const [manifest] = yield* readPin(input, "fleet-manifest");
    const facts = yield* readFleetManifestFacts(manifestPin.path, manifest);
    if (!DateTime.Equivalence(facts.captureInstant, kpiWindows[0].end)) {
      return yield* decodeFailure("fleet-manifest", manifestPin.path, "The manifest's capture instant is not W's end.");
    }
    const journals = yield* Effect.forEach(facts.journals, readJournal(input, manifestPin.path));
    return [facts.captureInstant, journals] as const;
  });

  // The ledger is never parsed: its bytes must hash to the pin and to the constant table's digest.
  const checkLedger = Effect.fnUntraced(function* (
    input: KpiReadingInput
  ): Effect.fn.Return<void, KpiInputReadError | KpiDigestMismatchError | KpiInputDecodeError> {
    const pin = yield* pinFor(input, "change-event-ledger");
    const [, actualSha256] = yield* readPin(input, "change-event-ledger");
    if (actualSha256 !== changeEventLedgerSha256) {
      return yield* KpiDigestMismatchError.make({
        role: "change-event-ledger",
        path: pin.path,
        expectedSha256: changeEventLedgerSha256,
        actualSha256,
      });
    }
  });

  const readAdoption = Effect.fnUntraced(function* (
    input: KpiReadingInput
  ): Effect.fn.Return<AdoptionTable, KpiInputReadError | KpiDigestMismatchError | KpiInputDecodeError> {
    const pin = yield* pinFor(input, "adoption-table");
    const [text] = yield* readPin(input, "adoption-table");
    const table = yield* decodeAdoptionTable(text).pipe(
      Effect.mapError((error) => decodeFailure("adoption-table", pin.path, error.message))
    );
    const sourcePins = A.filter(input.inputs, (entry) => entry.role !== "adoption-table");
    if (!pinsAgree(table.pins, sourcePins)) {
      return yield* decodeFailure("adoption-table", pin.path, "The table was generated from other pins.");
    }
    return table;
  });

  // Every pin but the adoption table: ledger check, attempt journals, merged admission sources.
  const readSources = Effect.fnUntraced(function* (
    input: KpiReadingInput
  ): Effect.fn.Return<
    readonly [DateTime.Utc, ReadonlyArray<FleetJournal>, ReadonlyArray<KpiAdmissionRow>],
    CiOpsKpiError
  > {
    yield* checkLedger(input);
    const [captureInstant, journals] = yield* readJournals(input);
    const canonicalPin = yield* pinFor(input, "fleet-admission-journal");
    const snapshotPin = yield* pinFor(input, "admission-snapshot");
    const [canonical] = yield* readPin(input, "fleet-admission-journal");
    const [snapshot] = yield* readPin(input, "admission-snapshot");
    const admissions = yield* mergeAdmissionSources(
      { path: canonicalPin.path, text: canonical },
      { path: snapshotPin.path, text: snapshot }
    );
    return [captureInstant, journals, admissions] as const;
  });

  const read = Effect.fn("CiOpsKpi.read")(function* (
    input: KpiReadingInput
  ): Effect.fn.Return<KpiReading, CiOpsKpiError> {
    const [captureInstant, journals, admissions] = yield* readSources(input);
    const adoption = yield* readAdoption(input);
    const adoptionPin = yield* pinFor(input, "adoption-table");
    const foldInput = KpiFoldInput.make({
      inputs: input.inputs,
      captureInstant,
      journals,
      admissions,
      adoption,
      changeEvents: changeEventTable,
    });
    return yield* foldKpiReading(foldInput, adoptionPin.path);
  });

  const probes = Effect.fn("CiOpsKpi.probes")(function* (
    input: KpiReadingInput
  ): Effect.fn.Return<ReadonlyArray<AdoptionProbe>, CiOpsKpiError> {
    const [, journals, admissions] = yield* readSources(input);
    return yield* adoptionProbes(journals, admissions, changeEventTable);
  });

  return CiOpsKpi.of({ read, probes });
};

/**
 * Live layer: reads every pinned input by path and SHA-256 and runs the pure fold.
 *
 * **Details**
 *
 * The layer captures the file system and crypto services once; `read`
 * checks each digest over the raw bytes before any decode (the ledger's also
 * against the constant table's digest), reads the attempt journals the
 * manifest pins, merges the two admission sources, and folds. It spawns no
 * process and emits nothing to the A-Box.
 *
 * **Example** (Provide the live layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { CiOpsKpiLive } from "@/kpi/CiOpsKpi"
 *
 * console.log(Layer.isLayer(CiOpsKpiLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CiOpsKpiLive: Layer.Layer<CiOpsKpi, never, FileSystem.FileSystem | Crypto.Crypto> = Layer.effect(
  CiOpsKpi,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const crypto = yield* Crypto.Crypto;
    return makeLive(fs, crypto);
  })
);
