/**
 * Hold ledger services: the in-repo ledger of hold claim versions and probe
 * runs, and the scratch-install probe that runs a hold's falsifier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimReference, claimReferenceKey } from "@beep/epistemics/ClaimImport.schema";
import { $RepoCliId } from "@beep/identity/packages";
import { repoRunOutputBound, runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { withAppendLock } from "../../internal/claims/AppendLock.ts";
import { storedLines } from "../../internal/claims/ClaimHistory.ts";
import { HoldsError, holdsPlatformError } from "./Holds.errors.ts";
import { liveHoldClaims } from "./Holds.inventory.ts";
import { HoldProposition, holdClaimKey, ProbeOutcome, ProbeRun, ProbeRunId } from "./Holds.schemas.ts";
import { judgeProbeRun } from "./Holds.verdict.ts";
import { decodeHoldClaimLine, decodeProbeRunLine, joinHoldClaims, planHoldAppend } from "./internal/HoldStore.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ClaimHistoryRefused } from "../../internal/claims/ClaimHistory.ts";
import type { HoldClaim, HoldClaimEvent } from "./Holds.schemas.ts";

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

/**
 * File name, inside {@link holdLedgerDirectory}, of the generated syncpack held list.
 *
 * **Example** (Read the held list file name)
 *
 * ```ts
 * import { syncpackHeldListFile } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(syncpackHeldListFile) // "syncpack-held.generated.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const syncpackHeldListFile = "syncpack-held.generated.json";

const encodeHeldList = S.encodeUnknownEffect(S.fromJsonString(S.Array(S.String), { space: 2 }));
const ProbeRunJson = JsonStringCodec(ProbeRun);

/**
 * The in-repo hold ledger: append-only stored holds, their separate records and probe runs.
 *
 * **Details**
 * Frozen v1 rows are read through the declared import transform and are never rewritten;
 * every append writes hold-claim-record/v2 or hold-probe-run/v2 lines only.
 *
 * **Example** (Read current holds through the shape)
 *
 * ```ts
 * import type { HoldLedgerShape } from "@beep/repo-cli/commands/Holds"
 *
 * const current = (ledger: HoldLedgerShape) => ledger.currentClaims
 * console.log(typeof current) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface HoldLedgerShape {
  /** Every stored hold joined with its records, in file order, superseded and retracted holds included. */
  readonly allClaims: Effect.Effect<ReadonlyArray<HoldClaim>, HoldsError>;
  /** Append claim events, such as renewals and retirements, after checking them against the history. */
  readonly appendEvents: (events: ReadonlyArray<HoldClaimEvent>) => Effect.Effect<void, HoldsError>;
  /** Append one probe run. */
  readonly appendRun: (run: ProbeRun) => Effect.Effect<void, HoldsError>;
  /** Current holds: not superseded, retracted or expired. */
  readonly currentClaims: Effect.Effect<ReadonlyArray<HoldClaim>, HoldsError>;
  /** Probe runs recorded against one hold, newest first; a changed probe starts with no evidence. */
  readonly runsFor: (claim: HoldClaim) => Effect.Effect<ReadonlyArray<ProbeRun>, HoldsError>;
  /** Replace the generated syncpack held list. */
  readonly writeHeldList: (heldList: ReadonlyArray<string>) => Effect.Effect<void, HoldsError>;
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
 * const program = Effect.gen(function* () {
 *   const ledger = yield* HoldLedger
 *   return yield* ledger.currentClaims
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HoldLedger extends Context.Service<HoldLedger, HoldLedgerShape>()($I`HoldLedger`) {}

const refusedError = (refused: ClaimHistoryRefused): HoldsError =>
  HoldsError.make({
    reason: "decode",
    message: `hold history refused (${refused.reason}): ${refused.claim}; repair the ledger before reading verdicts.`,
    cause: refused,
  });

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
  const digest = yield* Digest.Digest;
  const withDigest = Effect.provideService(Digest.Digest, digest);
  const directory = path.join(repoRoot, holdLedgerDirectory);
  const claimsFile = path.join(directory, "claims.jsonl");
  const claimsLockFile = path.join(directory, "claims.jsonl.lock");
  const runsFile = path.join(directory, "runs.jsonl");
  const heldListFile = path.join(directory, syncpackHeldListFile);

  const readLines = Effect.fn("HoldLedger.readLines")(function* (file: string) {
    const exists = yield* fs.exists(file).pipe(Effect.mapError(holdsPlatformError(`Could not stat ${file}`)));
    return exists
      ? yield* fs.readFileString(file).pipe(Effect.mapError(holdsPlatformError(`Could not read ${file}`)))
      : "";
  });

  const strictRows = Effect.fn("HoldLedger.strictRows")(function* <Row, E>(
    file: string,
    decode: (line: string) => Effect.Effect<Row, E, Digest.Digest>
  ) {
    const content = yield* readLines(file);
    const decoded = yield* Effect.forEach(storedLines(content), (line) => Effect.result(decode(line)), {
      concurrency: 1,
    }).pipe(withDigest);
    const corruptLineCount = A.length(A.filter(decoded, Result.isFailure));
    return corruptLineCount > 0
      ? yield* HoldsError.make({
          reason: "decode",
          message: `${file} has ${corruptLineCount} line(s) that do not decode; repair the ledger before reading verdicts.`,
        })
      : A.getSuccesses(decoded);
  });

  const claimLines = strictRows(claimsFile, decodeHoldClaimLine);
  const allClaims = Effect.flatMap(claimLines, (lines) =>
    joinHoldClaims(lines).pipe(withDigest, Effect.mapError(refusedError))
  );
  const currentClaims = Effect.map(allClaims, liveHoldClaims);

  const runsFor = Effect.fn("HoldLedger.runsFor")(function* (claim: HoldClaim) {
    const rows = yield* strictRows(runsFile, decodeProbeRunLine);
    return pipe(
      A.filter(rows, (run) => claimReferenceKey(run.claim) === holdClaimKey(claim)),
      A.reverse
    );
  });

  const appendLines = Effect.fn("HoldLedger.appendLines")(function* (file: string, lines: ReadonlyArray<string>) {
    yield* fs
      .makeDirectory(directory, { recursive: true })
      .pipe(Effect.mapError(holdsPlatformError(`Could not create ${directory}`)));
    const existing = yield* readLines(file);
    const restoredTrailingNewline = Str.isEmpty(existing) || Str.endsWith("\n")(existing) ? "" : "\n";
    yield* fs
      .writeFileString(file, `${restoredTrailingNewline}${A.join(lines, "\n")}\n`, { flag: "a" })
      .pipe(Effect.mapError(holdsPlatformError(`Could not append to ${file}`)));
  });

  const encodeFailure = (what: string) => (cause: unknown) =>
    HoldsError.make({ reason: "decode", message: `Could not encode ${what}.`, cause });

  const appendRun = Effect.fn("HoldLedger.appendRun")(function* (run: ProbeRun) {
    const line = yield* ProbeRunJson.encode(run).pipe(Effect.mapError(encodeFailure("a probe run")));
    yield* appendLines(runsFile, [line]);
  });

  const appendEvents = Effect.fn("HoldLedger.appendEvents")(function* (events: ReadonlyArray<HoldClaimEvent>) {
    if (A.isReadonlyArrayEmpty(events)) {
      return;
    }
    yield* fs
      .makeDirectory(directory, { recursive: true })
      .pipe(Effect.mapError(holdsPlatformError(`Could not create ${directory}`)));
    yield* Effect.gen(function* () {
      const existing = yield* claimLines;
      const lines = yield* planHoldAppend(existing, events).pipe(
        withDigest,
        Effect.mapError((cause) =>
          cause._tag === "ClaimHistoryRefused" ? refusedError(cause) : encodeFailure("a hold claim event")(cause)
        )
      );
      yield* appendLines(claimsFile, lines);
    }).pipe(
      withAppendLock({
        platform: { fs, path, digest },
        lockFile: claimsLockFile,
        busy: HoldsError.make({
          reason: "io",
          message: `${claimsFile} is locked by another running append; retry once it finishes.`,
        }),
      })
    );
  });

  const writeHeldList = Effect.fn("HoldLedger.writeHeldList")(function* (heldList: ReadonlyArray<string>) {
    const text = yield* encodeHeldList(heldList).pipe(Effect.mapError(encodeFailure("the syncpack held list")));
    yield* fs
      .writeFileString(heldListFile, `${text}\n`)
      .pipe(Effect.mapError(holdsPlatformError(`Could not write ${heldListFile}`)));
  });

  return HoldLedger.of({ allClaims, currentClaims, runsFor, appendRun, appendEvents, writeHeldList });
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
    claim: ClaimReference,
    proposition: HoldProposition,
  }).pipe(
    $I.annoteSchema("HoldProbeRequest", {
      description: "The hold to probe, its explicit claim reference and the commit the run is recorded against.",
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
 * const program = Effect.gen(function* () {
 *   const probe = yield* HoldProbe
 *   return probe.probe
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HoldProbe extends Context.Service<HoldProbe, HoldProbeShape>()($I`HoldProbe`) {}

/**
 * Classify one probe command run from its exit code and combined output.
 *
 * **Details**
 *
 * The failure signature wins over the exit code, so a command that prints the
 * signature but exits 0 still counts as `Reproduced`. Clipped output without the
 * signature, or a non-zero exit, is `Inconclusive`, never `Passed`. The detail
 * names only the category and exit code: raw output can carry paths or
 * credentials and the ledger is public.
 *
 * **Example** (A 404 reproduces the hold)
 *
 * ```ts
 * import { classifyProbeOutput } from "@beep/repo-cli/commands/Holds"
 *
 * const outcome = classifyProbeOutput("model-testing")({
 *   exitCode: 1,
 *   output: "error: @statelyai/model-testing@0.2.0 failed to resolve",
 *   truncated: false,
 * })
 * console.log(outcome._tag) // "Reproduced"
 * ```
 *
 * @param failureSignature - Text whose presence means the recorded failure reproduced.
 * @returns A classifier from one command result to a {@link ProbeOutcome}.
 * @category utilities
 * @since 0.0.0
 */
export const classifyProbeOutput =
  (failureSignature: string) =>
  (result: { readonly exitCode: number; readonly output: string; readonly truncated: boolean }): ProbeOutcome =>
    Str.includes(failureSignature)(result.output)
      ? ProbeOutcome.cases.Reproduced.make({})
      : result.truncated
        ? ProbeOutcome.cases.Inconclusive.make({ detail: "output clipped before the signature could be ruled out" })
        : result.exitCode === 0
          ? ProbeOutcome.cases.Passed.make({})
          : ProbeOutcome.cases.Inconclusive.make({ detail: `exit ${result.exitCode} without the failure signature` });

type ScriptedFalsifier = Extract<HoldProposition["falsifier"], { readonly _tag: "Scripted" }>;

type ProbeSide = "control" | "candidate";

const writeProbeManifest = Effect.fn("HoldProbe.writeManifest")(function* (
  directory: string,
  proposition: HoldProposition,
  side: ProbeSide,
  version: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(Effect.mapError(holdsPlatformError(`Could not create ${directory}`)));
  const manifest = yield* encodeProbeManifest({
    name: `hold-probe-${proposition.holdId}-${side}`,
    private: true,
    dependencies: R.fromEntries(A.map(proposition.subject.packages, (name) => [name, version] as const)),
  }).pipe(
    Effect.mapError((cause) =>
      HoldsError.make({ reason: "decode", message: "Could not encode the probe manifest.", cause })
    )
  );
  yield* fs
    .writeFileString(path.join(directory, "package.json"), manifest)
    .pipe(Effect.mapError(holdsPlatformError("Could not write the probe manifest")));
});

const installedVersionOf = Effect.fn("HoldProbe.installedVersion")(function* (
  directory: string,
  packageName: string,
  requested: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(directory, "node_modules", packageName, "package.json")).pipe(
    Effect.flatMap(decodeInstalledVersion),
    Effect.map((pkg) => pkg.version),
    Effect.orElseSucceed(() => requested)
  );
});

const runProbeSide = Effect.fn("HoldProbe.runSide")(function* (
  runDirectory: string,
  proposition: HoldProposition,
  falsifier: ScriptedFalsifier,
  side: ProbeSide,
  version: string
) {
  const path = yield* Path.Path;
  const directory = path.join(runDirectory, side);
  yield* writeProbeManifest(directory, proposition, side, version);
  const outcome = yield* runCaptured({
    command: A.headNonEmpty(falsifier.command),
    args: A.tailNonEmpty(falsifier.command),
    cwd: directory,
    bound: repoRunOutputBound,
    source: "merge",
    trim: true,
    timeout: "10 minutes",
    forceKillAfter: "10 seconds",
  }).pipe(
    Effect.map(classifyProbeOutput(falsifier.failureSignature)),
    Effect.orElseSucceed(() => ProbeOutcome.cases.Inconclusive.make({ detail: "the probe command could not run" }))
  );
  const installed = yield* installedVersionOf(directory, A.headNonEmpty(proposition.subject.packages), version);
  return { outcome, version: installed } as const;
});

const runScriptedProbe = Effect.fn("HoldProbe.scripted")(function* (
  scratchRoot: string,
  request: HoldProbeRequest,
  falsifier: ScriptedFalsifier
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { proposition } = request;
  const holdDirectory = path.join(scratchRoot, proposition.holdId);
  yield* fs
    .makeDirectory(holdDirectory, { recursive: true })
    .pipe(Effect.mapError(holdsPlatformError(`Could not create ${holdDirectory}`)));
  const { control, candidate } = yield* Effect.scoped(
    Effect.gen(function* () {
      const runDirectory = yield* fs
        .makeTempDirectoryScoped({ directory: holdDirectory, prefix: "run-" })
        .pipe(Effect.mapError(holdsPlatformError(`Could not create a run directory under ${holdDirectory}`)));
      const control = yield* runProbeSide(runDirectory, proposition, falsifier, "control", falsifier.controlVersion);
      const candidate = yield* runProbeSide(runDirectory, proposition, falsifier, "candidate", falsifier.candidate);
      return { control, candidate } as const;
    })
  );
  const ranAt = yield* DateTime.now;
  return ProbeRun.make({
    schemaVersion: "hold-probe-run/v2",
    id: ProbeRunId.make(`${proposition.holdId}@${DateTime.toEpochMillis(ranAt)}`),
    holdId: proposition.holdId,
    claim: request.claim,
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
  const context = yield* Effect.context<
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
  >();
  const probe = (request: HoldProbeRequest): Effect.Effect<ProbeRun, HoldsError> =>
    request.proposition.falsifier._tag === "Judgement"
      ? Effect.fail(
          HoldsError.make({
            reason: "usage",
            message: `${request.proposition.holdId} is a Judgement hold; a judge run, not beep holds probe, re-checks it.`,
          })
        )
      : runScriptedProbe(scratchRoot, request, request.proposition.falsifier).pipe(Effect.provide(context));
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
 * @param repoRoot - Repository checkout that contains `hold-ledger/`.
 * @returns A layer providing {@link HoldLedger}.
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
 * @param scratchRoot - Directory under which each probe run gets its own install directory.
 * @returns A layer providing {@link HoldProbe}.
 * @category layers
 * @since 0.0.0
 */
export const layerHoldProbe = (scratchRoot: string) => Layer.effect(HoldProbe, makeHoldProbe(scratchRoot));
