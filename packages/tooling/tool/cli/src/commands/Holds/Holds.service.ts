/**
 * Hold ledger services: the in-repo ledger of hold claim versions and probe
 * runs, and the scratch-install probe that runs a hold's falsifier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { repoRunOutputBound, runCaptured } from "../../internal/process/StepExec.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { partitionJsonLines } from "../../internal/state/JsonLinesStore.ts";
import { HoldsError, holdsPlatformError } from "./Holds.errors.ts";
import { HoldClaimVersion, HoldProposition, ProbeOutcome, ProbeRun, ProbeRunId } from "./Holds.schemas.ts";
import { judgeProbeRun } from "./Holds.verdict.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { HoldId } from "./Holds.schemas.ts";

const $I = $RepoCliId.create("commands/Holds/Holds.service");

/**
 * Repo-relative directory of the hold ledger.
 *
 * **Example** (Read the ledger directory)
 *
 * ```ts
 * import { holdLedgerDirectory } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(holdLedgerDirectory) // "hold-ledger"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const holdLedgerDirectory = "hold-ledger";

const HoldClaimVersionJson = JsonStringCodec(HoldClaimVersion);
const ProbeRunJson = JsonStringCodec(ProbeRun);

/**
 * The in-repo hold ledger: append-only claim versions and probe runs.
 *
 * **Example** (Read current versions through the shape)
 *
 * ```ts
 * import type { HoldLedgerShape } from "@beep/repo-cli/commands/Holds"
 *
 * const current = (ledger: HoldLedgerShape) => ledger.currentVersions
 * console.log(typeof current) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface HoldLedgerShape {
  /** Append one probe run. */
  readonly appendRun: (run: ProbeRun) => Effect.Effect<void, HoldsError>;
  /** Current hold versions: the rows whose knowledge interval is still open. */
  readonly currentVersions: Effect.Effect<ReadonlyArray<HoldClaimVersion>, HoldsError>;
  /** Probe runs recorded for one hold, newest first. */
  readonly runsFor: (holdId: HoldId) => Effect.Effect<ReadonlyArray<ProbeRun>, HoldsError>;
}

/**
 * Service tag for {@link HoldLedgerShape}.
 *
 * **Example** (Use the ledger service)
 *
 * ```ts
 * import { HoldLedger } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.flatMap(HoldLedger.asEffect(), (ledger) => ledger.currentVersions)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HoldLedger extends Context.Service<HoldLedger, HoldLedgerShape>()($I`HoldLedger`) {}

/**
 * Build the file-backed ledger rooted at a repository checkout.
 *
 * **Example** (Build the ledger for a checkout)
 *
 * ```ts
 * import { makeHoldLedger } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeHoldLedger("."))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeHoldLedger = Effect.fn("HoldLedger.make")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(repoRoot, holdLedgerDirectory);
  const claimsFile = path.join(directory, "claims.jsonl");
  const runsFile = path.join(directory, "runs.jsonl");

  const readLines = Effect.fn("HoldLedger.readLines")(function* (file: string) {
    const exists = yield* fs.exists(file).pipe(Effect.mapError(holdsPlatformError(`Could not stat ${file}`)));
    return exists
      ? yield* fs.readFileString(file).pipe(Effect.mapError(holdsPlatformError(`Could not read ${file}`)))
      : "";
  });

  const currentVersions = readLines(claimsFile).pipe(
    Effect.map((content) =>
      A.filter(partitionJsonLines(HoldClaimVersionJson.decodeOption)(content).rows, (version) =>
        O.isNone(version.knowledge.expiredAt)
      )
    )
  );

  const runsFor = Effect.fn("HoldLedger.runsFor")(function* (holdId: HoldId) {
    const { rows } = partitionJsonLines(ProbeRunJson.decodeOption)(yield* readLines(runsFile));
    return pipe(
      A.filter(rows, (run) => run.holdId === holdId),
      A.reverse
    );
  });

  const appendRun = Effect.fn("HoldLedger.appendRun")(function* (run: ProbeRun) {
    const line = yield* ProbeRunJson.encode(run).pipe(
      Effect.mapError((cause) => HoldsError.make({ reason: "decode", message: "Could not encode a probe run.", cause }))
    );
    yield* fs
      .makeDirectory(directory, { recursive: true })
      .pipe(Effect.mapError(holdsPlatformError(`Could not create ${directory}`)));
    yield* fs
      .writeFileString(runsFile, `${line}\n`, { flag: "a" })
      .pipe(Effect.mapError(holdsPlatformError(`Could not append to ${runsFile}`)));
  });

  return HoldLedger.of({ currentVersions, runsFor, appendRun });
});

/**
 * Inputs for one probe run that the probe cannot discover itself.
 *
 * **Example** (Request a probe of one hold at a commit)
 *
 * ```ts
 * import { HoldProbeRequest } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(HoldProbeRequest.fields.commitSha !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HoldProbeRequest extends S.Opaque<HoldProbeRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    commitSha: S.String.check(S.isPattern(/^[0-9a-f]{40}$/)),
    proposition: HoldProposition,
  }).pipe(
    $I.annoteSchema("HoldProbeRequest", {
      description: "The hold to probe and the commit the probe run is recorded against.",
    })
  )
) {}

const encodeProbeManifest = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const decodeInstalledVersion = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ version: S.NonEmptyString })));

/**
 * Runs a hold's scripted falsifier against its control and candidate versions.
 *
 * **Example** (Probe through the shape)
 *
 * ```ts
 * import type { HoldProbeShape } from "@beep/repo-cli/commands/Holds"
 *
 * const probeOf = (probe: HoldProbeShape) => probe.probe
 * console.log(typeof probeOf) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface HoldProbeShape {
  readonly probe: (request: HoldProbeRequest) => Effect.Effect<ProbeRun, HoldsError>;
}

/**
 * Service tag for {@link HoldProbeShape}.
 *
 * **Example** (Use the probe service)
 *
 * ```ts
 * import { HoldProbe } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * const probe = HoldProbe.asEffect()
 * console.log(Effect.isEffect(probe)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HoldProbe extends Context.Service<HoldProbe, HoldProbeShape>()($I`HoldProbe`) {}

const lastLine = (text: string): string =>
  pipe(
    Str.split(text, "\n"),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.last,
    O.getOrElse(() => "no output")
  );

/**
 * Classify one probe command run from its exit code and combined output.
 *
 * **Details**
 *
 * The failure signature wins over the exit code, so a command that prints the
 * signature but exits 0 still counts as `Reproduced`. A non-zero exit without
 * the signature is `Inconclusive`, never `Passed`.
 *
 * **Example** (A 404 reproduces the hold)
 *
 * ```ts
 * import { classifyProbeOutput } from "@beep/repo-cli/commands/Holds"
 *
 * const outcome = classifyProbeOutput("model-testing")({ exitCode: 1, output: "error: @statelyai/model-testing@0.2.0 failed to resolve" })
 * console.log(outcome._tag) // "Reproduced"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const classifyProbeOutput =
  (failureSignature: string) =>
  (result: { readonly exitCode: number; readonly output: string }): ProbeOutcome =>
    Str.includes(failureSignature)(result.output)
      ? ProbeOutcome.cases.Reproduced.make({})
      : result.exitCode === 0
        ? ProbeOutcome.cases.Passed.make({})
        : ProbeOutcome.cases.Inconclusive.make({ detail: `exit ${result.exitCode}: ${lastLine(result.output)}` });

/**
 * Build the scratch-install probe. Each side runs in its own directory under
 * `scratchRoot` whose `package.json` depends on every subject package at the
 * version under test.
 *
 * **Example** (Build the probe for a scratch root)
 *
 * ```ts
 * import { makeHoldProbe } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeHoldProbe(".cache/holds"))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeHoldProbe = Effect.fn("HoldProbe.make")(function* (scratchRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* Effect.context<ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto>();

  const runSide = Effect.fn("HoldProbe.runSide")(function* (
    proposition: HoldProposition,
    command: A.NonEmptyReadonlyArray<string>,
    failureSignature: string,
    side: "control" | "candidate",
    version: string
  ) {
    const directory = path.join(scratchRoot, proposition.holdId, side);
    yield* fs.remove(directory, { recursive: true, force: true }).pipe(Effect.ignore);
    yield* fs
      .makeDirectory(directory, { recursive: true })
      .pipe(Effect.mapError(holdsPlatformError(`Could not create ${directory}`)));
    const dependencies = R.fromEntries(A.map(proposition.subject.packages, (name) => [name, version] as const));
    const manifest = yield* encodeProbeManifest({
      name: `hold-probe-${proposition.holdId}-${side}`,
      private: true,
      dependencies,
    }).pipe(
      Effect.mapError((cause) =>
        HoldsError.make({ reason: "decode", message: "Could not encode the probe manifest.", cause })
      )
    );
    yield* fs
      .writeFileString(path.join(directory, "package.json"), manifest)
      .pipe(Effect.mapError(holdsPlatformError("Could not write the probe manifest")));
    const outcome = yield* runCaptured({
      command: A.headNonEmpty(command),
      args: A.tailNonEmpty(command),
      cwd: directory,
      bound: repoRunOutputBound,
      source: "merge",
      trim: true,
      timeout: "10 minutes",
      forceKillAfter: "10 seconds",
    }).pipe(
      Effect.provide(context),
      Effect.map(classifyProbeOutput(failureSignature)),
      Effect.catch((cause) =>
        Effect.succeed(ProbeOutcome.cases.Inconclusive.make({ detail: `could not run the probe: ${String(cause)}` }))
      )
    );
    const installedVersion = yield* fs
      .readFileString(
        path.join(directory, "node_modules", A.headNonEmpty(proposition.subject.packages), "package.json")
      )
      .pipe(
        Effect.flatMap(decodeInstalledVersion),
        Effect.map((pkg) => pkg.version),
        Effect.orElseSucceed(() => version)
      );
    return { outcome, version: installedVersion } as const;
  });

  const probe = Effect.fn("HoldProbe.probe")(function* (request: HoldProbeRequest) {
    const { proposition } = request;
    if (proposition.falsifier._tag === "Judgement") {
      return yield* HoldsError.make({
        reason: "usage",
        message: `${proposition.holdId} is a Judgement hold; a judge run, not beep holds probe, re-checks it.`,
      });
    }
    const falsifier = proposition.falsifier;
    const control = yield* runSide(
      proposition,
      falsifier.command,
      falsifier.failureSignature,
      "control",
      falsifier.controlVersion
    );
    const candidate = yield* runSide(
      proposition,
      falsifier.command,
      falsifier.failureSignature,
      "candidate",
      falsifier.candidate
    );
    const ranAt = yield* DateTime.now;
    return ProbeRun.make({
      schemaVersion: "hold-probe-run/v1",
      id: ProbeRunId.make(`${proposition.holdId}@${DateTime.toEpochMillis(ranAt)}`),
      holdId: proposition.holdId,
      ranAt,
      commitSha: request.commitSha,
      runtime: falsifier.runtime,
      controlVersion: control.version,
      control: control.outcome,
      candidateVersion: candidate.version,
      candidate: candidate.outcome,
      verdict: judgeProbeRun(control.outcome, candidate.outcome),
    });
  });

  return HoldProbe.of({ probe });
});

/**
 * Live ledger layer rooted at a repository checkout.
 *
 * **Example** (Build the ledger layer)
 *
 * ```ts
 * import { layerHoldLedger } from "@beep/repo-cli/commands/Holds"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerHoldLedger("."))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerHoldLedger = (repoRoot: string) => Layer.effect(HoldLedger, makeHoldLedger(repoRoot));

/**
 * Live probe layer that installs into `scratchRoot`.
 *
 * **Example** (Build the probe layer)
 *
 * ```ts
 * import { layerHoldProbe } from "@beep/repo-cli/commands/Holds"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerHoldProbe(".cache/holds"))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerHoldProbe = (scratchRoot: string) => Layer.effect(HoldProbe, makeHoldProbe(scratchRoot));
