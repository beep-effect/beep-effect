/**
 * Turbo cache recovery, restoration probes, and evidence dashboard.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CacheClientChannel, CachePolicyAuditReport, CacheQualificationStore } from "@beep/repo-configs/cache";
import { A, Str, thunk0 } from "@beep/utils";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import { MemoryStatsLive } from "../../internal/repo-run/QualityScheduler.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { nearestRank } from "../../internal/stats/NearestRank.ts";
import { CacheProducerAcceptanceReference, CacheProducerImportRequest } from "./Cache.acceptance.schemas.ts";
import { loadCacheProducerStoreConfiguration, persistCacheProducerAcceptance } from "./Cache.acceptance.store.ts";
import { collectCacheCensus } from "./Cache.census.ts";
import {
  CacheConformanceComparison,
  CacheConformanceEvidence,
  compareCacheConformanceRuns,
  renderCacheConformanceComparison,
} from "./Cache.conformance.compare.ts";
import { buildCacheConformanceCorpus, syncCacheConformanceCorpus } from "./Cache.conformance.corpus.ts";
import { resolveCacheConformanceClient, runCacheConformanceNative } from "./Cache.conformance.native.ts";
import { CacheConformanceRun, CacheConformanceTarget } from "./Cache.conformance.schemas.ts";
import {
  loadCacheConformanceBearers,
  loadCacheConformanceEnvelope,
  runCacheConformance,
  runCacheConformanceLab,
} from "./Cache.conformance.ts";
import { CacheDependencyMaterialization } from "./Cache.dependencies.schemas.ts";
import { materializeCacheDependencies } from "./Cache.dependencies.ts";
import { CacheEntrypointReviewRequest } from "./Cache.entrypoints.schemas.ts";
import { attachCacheEntrypointReview } from "./Cache.entrypoints.ts";
import { CacheSyntheticReceipt, CacheSyntheticRequest } from "./Cache.experiment.schemas.ts";
import { runCacheSyntheticExperiment } from "./Cache.experiment.ts";
import { runCacheSignedPilotExperiment } from "./Cache.pilot.runner.ts";
import { CachePilotReceipt, CachePilotRequest } from "./Cache.pilot.schemas.ts";
import { CacheSignedPilotReceipt, CacheSignedPilotRequest } from "./Cache.pilot.signed.schemas.ts";
import { runCachePilotExperiment } from "./Cache.pilot.ts";
import { readCacheProducerProvisioning } from "./Cache.producer.ts";
import { verifyCacheIdentityLintProfile, writeCacheIdentityLintProfile } from "./Cache.profile.ts";
import { CacheProtocolExecution, CacheProtocolRequest } from "./Cache.protocol.runner.schemas.ts";
import { runCacheProtocolExperiment } from "./Cache.protocol.runner.ts";
import { CacheProtocolObservation } from "./Cache.protocol.schemas.ts";
import { validateCacheProtocolObservation } from "./Cache.protocol.ts";
import { runCacheRuntimeTasks } from "./Cache.runtime.ts";
import {
  CacheActivationPreview,
  CacheActivationRequest,
  CacheBaselineRequest,
  CacheCensusReport,
  CacheCommandError,
  CacheDashboardReport,
  CacheDashboardReportJson,
  CacheLambdaSummary,
  CacheLiveIdentity,
  CacheRemoteReadsRequest,
  CacheRunMode,
  CacheTransitionRequest,
  CacheWallTime,
  CacheWarmLane,
  CacheWarmReceipt,
  CacheWarmReceiptJson,
} from "./Cache.schemas.ts";
import { CacheQualificationLive, CacheQualificationService } from "./Cache.service.ts";
import { CacheHostedProducerCompleteReport, CacheHostedProducerRunReference } from "./Cache.workflow.github.schemas.ts";
import { buildCacheHostedProducerCompleteReport, CacheHostedProducerVerifierLive } from "./Cache.workflow.github.ts";
import { CacheProducerObservation, CacheProducerWorkflow } from "./Cache.workflow.schemas.ts";
import {
  initializeCacheProducerExecution,
  inspectCacheProducerWorkflow,
  loadCacheProducerExecutionRuntime,
  runCacheProducerWorkflow,
} from "./Cache.workflow.ts";
import type { CacheConformanceBearers, CacheConformanceCorpus } from "./Cache.conformance.schemas.ts";

const TurboTaskCache = S.Struct({
  status: S.String,
  source: S.optionalKey(S.String),
});

const TurboTaskExecution = S.Struct({
  startTime: S.Finite,
  endTime: S.Finite,
});

const TurboTaskSummary = S.Struct({
  taskId: S.String,
  hash: S.String,
  directory: S.optionalKey(S.String),
  cache: S.optionalKey(TurboTaskCache),
  execution: S.optionalKey(TurboTaskExecution),
});

const TurboExecutionSummary = S.Struct({
  command: S.String,
  startTime: S.Finite,
  endTime: S.Finite,
});

const TurboScmSummary = S.Struct({ sha: S.optionalKey(S.String) });

const TurboRunSummary = S.Struct({
  execution: TurboExecutionSummary,
  tasks: S.Array(TurboTaskSummary),
  scm: S.optionalKey(TurboScmSummary),
  globalCacheInputs: S.optionalKey(S.Unknown),
});

type TurboRunSummary = typeof TurboRunSummary.Type;
const decodeUnknownTurboRunSummary = S.decodeUnknownEffect(TurboRunSummary);
const decodeRuntimeArguments = S.decodeUnknownEffect(S.Array(S.String));

const runText = (command: ReadonlyArray<string>, cwd: string): Effect.Effect<string, CacheCommandError> =>
  Effect.try({
    try: () => Bun.spawnSync({ cmd: [...command], cwd, stdout: "pipe", stderr: "pipe", env: Bun.env }),
    catch: (cause) => CacheCommandError.new(`Unable to run ${A.join(command, " ")}.`, cause),
  }).pipe(
    Effect.flatMap((result) =>
      result.success
        ? Effect.succeed(Str.trim(result.stdout.toString()))
        : Effect.fail(
            CacheCommandError.new(
              `${A.join(command, " ")} exited ${result.exitCode}: ${Str.trim(result.stderr.toString())}`
            )
          )
    )
  );

const runInherited = (command: ReadonlyArray<string>, cwd: string): Effect.Effect<CacheWarmLane, CacheCommandError> =>
  Effect.gen(function* () {
    const started = yield* Clock.currentTimeMillis;
    const exitCode = yield* Effect.tryPromise({
      try: () => Bun.spawn([...command], { cwd, stdout: "inherit", stderr: "inherit", env: Bun.env }).exited,
      catch: (cause) => CacheCommandError.new(`Unable to run ${A.join(command, " ")}.`, cause),
    });
    const ended = yield* Clock.currentTimeMillis;
    return CacheWarmLane.make({ command, durationMs: S.Natural.make(ended - started), exitCode });
  }).pipe(
    Effect.filterOrFail(
      (lane) => lane.exitCode === 0,
      (lane) => CacheCommandError.new(`${A.join(command, " ")} exited ${lane.exitCode}.`)
    )
  );

type CacheWarmRunner = (command: ReadonlyArray<string>, cwd: string) => Effect.Effect<CacheWarmLane, CacheCommandError>;

const writeEncoded = Effect.fn("Cache.writeEncoded")(function* <A>(
  value: A,
  codec: { readonly encode: (value: A) => Effect.Effect<string, S.SchemaError> },
  output: O.Option<string>,
  print = true,
  maxBytes: O.Option<number> = O.none(),
  privateOutput = false
) {
  const encoded = yield* codec.encode(value).pipe(CacheCommandError.mapError("Failed to encode cache report."));
  if (O.exists(maxBytes, (limit) => new TextEncoder().encode(encoded).byteLength + 1 > limit))
    return yield* CacheCommandError.new("Cache report exceeds its configured byte bound.");
  if (O.isSome(output)) {
    if (privateOutput) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs
        .writeFileString(output.value, `${encoded}\n`, { flag: "wx", mode: 0o600 })
        .pipe(CacheCommandError.mapError(`Failed to write new private report ${output.value}.`));
    } else
      yield* Effect.tryPromise({
        try: () => Bun.write(output.value, `${encoded}\n`),
        catch: (cause) => CacheCommandError.new(`Failed to write ${output.value}.`, cause),
      });
  }
  if (print) yield* Console.log(encoded);
});

const requiredWarmEnvironment = ["TURBO_API", "TURBO_TOKEN", "TURBO_TEAM"] as const;

const assertWarmEnvironment = Effect.fn("Cache.assertWarmEnvironment")(function* () {
  for (const name of requiredWarmEnvironment) {
    if (Str.isEmpty(Str.trim(Bun.env[name] ?? ""))) {
      return yield* CacheCommandError.new(`cache warm requires ephemeral ${name} injection.`);
    }
  }
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv, which Biome cannot read. Owner: @beep/repo-cli. Exit: Biome reads turbo global.* declarations, or the name joins allowedEnvVars (#1855).
  if (Str.startsWith("op://")(Bun.env.TURBO_TOKEN ?? "")) {
    return yield* CacheCommandError.new(
      "Resolve the write token through `op run`; cache warm never stores references."
    );
  }
});

const readWarmGitIdentity = Effect.fn("Cache.readWarmGitIdentity")(function* (repoRoot: string) {
  const [status, head, base, tree] = yield* Effect.all([
    runText(["git", "status", "--porcelain=v1", "--untracked-files=normal"], repoRoot),
    runText(["git", "rev-parse", "HEAD"], repoRoot),
    runText(["git", "rev-parse", "origin/main"], repoRoot),
    runText(["git", "rev-parse", "HEAD^{tree}"], repoRoot),
  ]);
  return { status, head, base, tree };
});

const assertWarmPreconditions = Effect.fn("Cache.assertWarmPreconditions")(function* (repoRoot: string) {
  const [identity, actualBun, pinnedBun] = yield* Effect.all([
    readWarmGitIdentity(repoRoot),
    runText(["bun", "--version"], repoRoot),
    Effect.tryPromise({
      try: () => Bun.file(`${repoRoot}/.bun-version`).text().then(Str.trim),
      catch: (cause) => CacheCommandError.new("Failed to read .bun-version.", cause),
    }),
  ]);
  if (!Str.isEmpty(identity.status)) return yield* CacheCommandError.new("cache warm requires a clean checkout.");
  if (identity.head !== identity.base) {
    return yield* CacheCommandError.new("cache warm requires HEAD to equal origin/main exactly.");
  }
  if (actualBun !== pinnedBun) {
    return yield* CacheCommandError.new(`cache warm requires Bun ${pinnedBun}; found ${actualBun}.`);
  }
  yield* assertWarmEnvironment();
  return { ...identity, actualBun };
});

const assertWarmIdentityUnchanged = Effect.fn("Cache.assertWarmIdentityUnchanged")(function* (
  repoRoot: string,
  expected: { readonly head: string; readonly base: string; readonly tree: string }
) {
  const actual = yield* readWarmGitIdentity(repoRoot);
  if (
    !Str.isEmpty(actual.status) ||
    actual.head !== expected.head ||
    actual.base !== expected.base ||
    actual.tree !== expected.tree ||
    actual.head !== actual.base
  ) {
    return yield* CacheCommandError.new("cache warm checkout changed during execution; refusing receipt.");
  }
});

const turboCacheFlagPrefix = "--cache=";
const turboWriteOnlyCacheFlag = `${turboCacheFlagPrefix}local:w,remote:w`;

const runCacheWarmWith = Effect.fn("Cache.runCacheWarmWith")(function* (
  repoRoot: string,
  output: O.Option<string>,
  runWarmLane: CacheWarmRunner
) {
  const preconditions = yield* assertWarmPreconditions(repoRoot);
  const lane = yield* runWarmLane(
    [
      "bun",
      "x",
      "turbo",
      "run",
      "build",
      "check",
      "lint",
      "test",
      // Turbo rejects `--cache` together with `--force`; write-only access is Turbo's own
      // definition of `--force`, so this alone re-executes every task and writes both caches.
      turboWriteOnlyCacheFlag,
      "--summarize",
    ],
    repoRoot
  );
  yield* assertWarmIdentityUnchanged(repoRoot, preconditions);
  const receipt = CacheWarmReceipt.make({
    generatedAt: DateTime.formatIso(yield* DateTime.now),
    revision: preconditions.head,
    bunVersion: preconditions.actualBun,
    lanes: [lane],
  });
  yield* writeEncoded(receipt, CacheWarmReceiptJson, output);
  return receipt;
});

/**
 * Run exact-main Turbo warming and emit a versioned receipt.
 *
 * **Example** (Build the warm program)
 *
 * ```ts
 * import { runCacheWarm } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
 * import * as Option from "effect/Option";
 * console.log(Effect.isEffect(runCacheWarm(".", Option.none()))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runCacheWarm = Effect.fn("Cache.runCacheWarm")(function* (repoRoot: string, output: O.Option<string>) {
  return yield* runCacheWarmWith(repoRoot, output, runInherited);
});

/**
 * Run cache warming with an injected lane runner for focused failure tests.
 *
 * **Example** (Build a cache-warm test effect)
 *
 * ```ts
 * import { CacheWarmLane } from "@beep/repo-cli/commands/Cache"
 * import { runCacheWarmForTesting } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
 * import * as O from "effect/Option"
 *
 * const runner = () =>
 *   Effect.succeed(CacheWarmLane.make({ command: [], durationMs: 0, exitCode: 0 }))
 * const warm = runCacheWarmForTesting("/repo", O.none(), runner)
 *
 * console.log(Effect.isEffect(warm)) // true
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const runCacheWarmForTesting = runCacheWarmWith;

/**
 * Run one inherited cache-warm command for focused exit-code tests.
 *
 * **Example** (Exercise a failing cache-warm lane)
 *
 * ```ts
 * import { runCacheWarmLaneForTesting } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 *
 * const exit = Effect.runSync(
 *   Effect.exit(runCacheWarmLaneForTesting(".")(["bun", "-e", "process.exit(7)"]))
 * )
 *
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const runCacheWarmLaneForTesting: {
  (cwd: string): (command: ReadonlyArray<string>) => Effect.Effect<CacheWarmLane, CacheCommandError>;
  (command: ReadonlyArray<string>, cwd: string): Effect.Effect<CacheWarmLane, CacheCommandError>;
} = dual(2, runInherited);

const unknownStrings = (value: unknown): ReadonlyArray<string> => {
  if (P.isString(value)) return [value];
  if (A.isArray(value)) return A.flatMap(value, unknownStrings);
  if (P.isObject(value)) {
    return A.flatMap(R.values(value as Readonly<Record<string, unknown>>), unknownStrings);
  }
  return A.empty();
};

const isWriteOnlyCacheSpec = (spec: string): boolean =>
  A.every(Str.split(spec, ","), (entry) => O.exists(A.get(Str.split(entry, ":"), 1), (mode) => mode === "w"));

// Turbo defines `--force` as `--cache=local:w,remote:w`, so a spec whose every source is exactly `w`
// is a forced run. An empty mode such as `local:` disables that source instead, so it never counts.
const isWriteOnlyCacheCommand = (command: string): boolean =>
  A.findFirst(Str.split(command, " "), Str.startsWith(turboCacheFlagPrefix)).pipe(
    O.map(Str.slice(turboCacheFlagPrefix.length)),
    O.exists(isWriteOnlyCacheSpec)
  );

const classifyRun = (run: TurboRunSummary): CacheRunMode => {
  const strings = unknownStrings(run.globalCacheInputs);
  if (
    Str.includes("--force")(run.execution.command) ||
    isWriteOnlyCacheCommand(run.execution.command) ||
    A.some(strings, Str.includes("TURBO_FORCE=true"))
  ) {
    return CacheRunMode.Enum.forced;
  }
  if (A.every(run.tasks, (task) => task.cache === undefined)) return CacheRunMode.Enum.disabled;
  return A.some(strings, Str.startsWith("TURBO_TOKEN=")) && A.some(strings, Str.startsWith("TURBO_TEAM="))
    ? CacheRunMode.Enum["remote-eligible"]
    : CacheRunMode.Enum["local-only"];
};

const percentile = (values: ReadonlyArray<number>, fraction: number): number =>
  O.getOrElse(O.map(nearestRank(values, fraction), Math.round), thunk0);

const readRunFiles = Effect.fn("Cache.readRunFiles")(function* (runsDir: string) {
  const glob = new Bun.Glob("*.json");
  const paths: ReadonlyArray<string> = A.fromIterable(glob.scanSync({ cwd: runsDir, absolute: true }));
  return yield* Effect.forEach(
    paths,
    (filePath): Effect.Effect<TurboRunSummary, CacheCommandError> =>
      Effect.tryPromise({
        try: () => Bun.file(filePath).json(),
        catch: (cause) => CacheCommandError.new(`Failed to read ${filePath}.`, cause),
      }).pipe(
        Effect.flatMap(decodeUnknownTurboRunSummary),
        Effect.mapError((cause) => CacheCommandError.new(`Invalid Turbo summary ${filePath}.`, cause))
      )
  );
});

const parseLambdaLogs = Effect.fn("Cache.parseLambdaLogs")(function* (path: O.Option<string>) {
  if (O.isNone(path)) {
    return CacheLambdaSummary.make({
      rows: S.Natural.make(0),
      reads: S.Natural.make(0),
      hits: S.Natural.make(0),
      puts: S.Natural.make(0),
    });
  }
  const text = yield* Effect.tryPromise({
    try: () => Bun.file(path.value).text(),
    catch: (cause) => CacheCommandError.new(`Failed to read ${path.value}.`, cause),
  });
  const lines = A.filter(A.map(Str.split(/\r?\n/)(text), Str.trim), (line) => !Str.isEmpty(line));
  const normalized = A.map(lines, Str.toUpperCase);
  return CacheLambdaSummary.make({
    rows: S.Natural.make(lines.length),
    reads: S.Natural.make(
      A.filter(normalized, (line) => Str.includes("GET")(line) || Str.includes("READ")(line)).length
    ),
    hits: S.Natural.make(A.filter(normalized, Str.includes("HIT")).length),
    puts: S.Natural.make(
      A.filter(normalized, (line) => Str.includes("PUT")(line) || Str.includes("WRITE")(line)).length
    ),
  });
});

type CacheDashboardAggregation = {
  readonly firstTouches: MutableHashMap.MutableHashMap<string, { readonly source: string; readonly taskId: string }>;
  readonly correctnessViolations: MutableHashSet.MutableHashSet<string>;
  readonly durations: MutableHashMap.MutableHashMap<CacheRunMode, Array<number>>;
  excludedForcedOrDisabled: number;
};

const taskMatchesChangedPath = (task: typeof TurboTaskSummary.Type, changedFiles: ReadonlyArray<string>): boolean =>
  task.directory !== undefined &&
  A.some(changedFiles, (changed) => changed === task.directory || Str.startsWith(`${task.directory}/`)(changed));

const observeRemoteEligibleTask = (
  aggregation: CacheDashboardAggregation,
  run: TurboRunSummary,
  task: typeof TurboTaskSummary.Type,
  changedFiles: ReadonlyArray<string>
): void => {
  if (task.cache === undefined) return;
  const key = `${run.scm?.sha ?? "unknown"}\0${task.taskId}\0${task.hash}`;
  if (O.isNone(MutableHashMap.get(aggregation.firstTouches, key))) {
    MutableHashMap.set(aggregation.firstTouches, key, {
      source: task.cache.source ?? "MISS",
      taskId: task.taskId,
    });
  }
  if (task.cache.status === "HIT" && taskMatchesChangedPath(task, changedFiles)) {
    MutableHashSet.add(aggregation.correctnessViolations, task.taskId);
  }
};

const observeCacheRun = (
  aggregation: CacheDashboardAggregation,
  run: TurboRunSummary,
  changedFiles: ReadonlyArray<string>
): void => {
  const mode = classifyRun(run);
  const runDurations = O.getOrElse(MutableHashMap.get(aggregation.durations, mode), A.empty<number>);
  runDurations.push(Math.max(0, run.execution.endTime - run.execution.startTime));
  MutableHashMap.set(aggregation.durations, mode, runDurations);
  if (mode === "forced" || mode === "disabled") {
    aggregation.excludedForcedOrDisabled += 1;
    return;
  }
  if (mode === "remote-eligible") {
    for (const task of run.tasks) observeRemoteEligibleTask(aggregation, run, task, changedFiles);
  }
};

/**
 * Build the locked first-touch cache dashboard from Turbo summaries and optional Lambda logs.
 *
 * **Example** (Build a dashboard program)
 *
 * ```ts
 * import { buildCacheDashboard } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
 * import * as Option from "effect/Option";
 * console.log(Effect.isEffect(buildCacheDashboard(".turbo/runs", Option.none(), []))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const buildCacheDashboard = Effect.fn("Cache.buildCacheDashboard")(function* (
  runsDir: string,
  lambdaLogs: O.Option<string>,
  changedFiles: ReadonlyArray<string>
) {
  const runs = A.sort(
    yield* readRunFiles(runsDir),
    Order.mapInput(Order.Number, (run: TurboRunSummary) => run.execution.startTime)
  );
  const aggregation: CacheDashboardAggregation = {
    firstTouches: MutableHashMap.empty(),
    correctnessViolations: MutableHashSet.empty(),
    durations: MutableHashMap.empty(),
    excludedForcedOrDisabled: 0,
  };
  for (const run of runs) observeCacheRun(aggregation, run, changedFiles);

  const observations = A.fromIterable(MutableHashMap.values(aggregation.firstTouches));
  const remoteHits = A.filter(observations, (row) => row.source === "REMOTE").length;
  const lambda = yield* parseLambdaLogs(lambdaLogs);
  return CacheDashboardReport.make({
    generatedAt: DateTime.formatIso(yield* DateTime.now),
    runFiles: S.Natural.make(runs.length),
    eligibleFirstTouches: S.Natural.make(observations.length),
    remoteHits: S.Natural.make(remoteHits),
    eligibleRemoteHitRate: observations.length === 0 ? 0 : remoteHits / observations.length,
    excludedForcedOrDisabled: S.Natural.make(aggregation.excludedForcedOrDisabled),
    correctnessViolations: A.sort(A.fromIterable(aggregation.correctnessViolations), Order.String),
    wallTimes: A.map(A.fromIterable(aggregation.durations), ([mode, values]) =>
      CacheWallTime.make({
        mode,
        runs: S.Natural.make(values.length),
        p50Ms: S.Natural.make(percentile(values, 0.5)),
        p95Ms: S.Natural.make(percentile(values, 0.95)),
      })
    ),
    lambda,
  });
});

/**
 * Execute a cold remote-read pass followed by a local restoration pass.
 *
 * **Example** (Build a restoration probe)
 *
 * ```ts
 * import { runCacheRestorationProbe } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
 * console.log(Effect.isEffect(runCacheRestorationProbe(".", ".beep/cache/probe"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runCacheRestorationProbe = Effect.fn("Cache.runCacheRestorationProbe")(function* (
  repoRoot: string,
  cacheDir: string
) {
  const common = ["bun", "x", "turbo", "run", "lint", "--filter=@beep/chalk", `--cache-dir=${cacheDir}`, "--summarize"];
  const cold = yield* runInherited([...common, "--cache=local:rw,remote:r"], repoRoot);
  const warm = yield* runInherited([...common, "--cache=local:rw"], repoRoot);
  return { cold, warm } as const;
});

const outputFlag = Flag.Path("output", { pathType: "file" }).pipe(
  Flag.optional,
  Flag.withDescription("Write the schema-encoded report to this path")
);

const renderCacheFailure = <A, R>(effect: Effect.Effect<A, CacheCommandError, R>) =>
  effect.pipe(
    Effect.catchTag("CacheCommandError", (error) =>
      Console.error(error.message).pipe(Effect.andThen(failWithReportedExit(error.message)))
    )
  );

const cacheWarmCommand = Command.make("warm", { output: outputFlag }, ({ output }) =>
  renderCacheFailure(runCacheWarm(process.cwd(), output))
).pipe(Command.withDescription("Warm remote Turbo artifacts from a clean exact origin/main checkout"));

const cacheProbeCommand = Command.make(
  "probe",
  {
    cacheDir: Flag.Path("cache-dir", { pathType: "directory" }).pipe(
      Flag.withDefault(".beep/cache/restoration-probe"),
      Flag.withDescription("Isolated local cache directory for the cold/warm restoration probe")
    ),
  },
  ({ cacheDir }) => renderCacheFailure(runCacheRestorationProbe(process.cwd(), cacheDir).pipe(Effect.asVoid))
).pipe(Command.withDescription("Prove a cold cache fill can restore from the local cache on the next pass"));

type CacheDashboardOptions = {
  readonly lambdaLogs: O.Option<string>;
  readonly output: O.Option<string>;
  readonly runsDir: string;
};

const cacheDashboardCommand = Command.make(
  "dashboard",
  {
    runsDir: Flag.Path("runs-dir", { pathType: "directory" }).pipe(
      Flag.withDefault(".turbo/runs"),
      Flag.withDescription("Directory containing Turbo --summarize JSON files")
    ),
    lambdaLogs: Flag.Path("lambda-logs", { pathType: "file" }).pipe(
      Flag.optional,
      Flag.withDescription("Optional sanitized Lambda log export (NDJSON or text)")
    ),
    output: outputFlag,
  },
  ({ lambdaLogs, output, runsDir }: CacheDashboardOptions) =>
    Effect.gen(function* () {
      const changed = yield* runText(["git", "diff", "--name-only", "origin/main...HEAD", "--"], process.cwd()).pipe(
        Effect.map((text) => A.filter(A.map(Str.split(/\r?\n/)(text), Str.trim), (line) => !Str.isEmpty(line)))
      );
      const report = yield* buildCacheDashboard(runsDir, lambdaLogs, changed);
      yield* writeEncoded(report, CacheDashboardReportJson, output);
    }).pipe(renderCacheFailure)
).pipe(Command.withDescription("Report first-touch remote hits, wall times, and changed-source tripwires"));

const cacheCensusCommand = Command.make(
  "census",
  {
    output: outputFlag,
    json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the complete census JSON")),
    entrypointReview: Flag.Path("entrypoint-review", { pathType: "file" }).pipe(
      Flag.optional,
      Flag.withDescription("Contained source-review request; verify and attach complete entrypoint snapshots")
    ),
  },
  ({ output, json, entrypointReview }) =>
    collectCacheCensus(process.cwd()).pipe(
      Effect.flatMap((census) =>
        O.match(entrypointReview, {
          onNone: () => Effect.succeed(census),
          onSome: (request) =>
            readCacheRequest(request, CacheEntrypointReviewRequest, S.Natural.make(256 * 1024)).pipe(
              Effect.flatMap((review) =>
                attachCacheEntrypointReview(process.cwd(), census, CacheEntrypointReviewRequest.make(review))
              )
            ),
        })
      ),
      Effect.flatMap((report) =>
        writeEncoded(report, JsonStringCodec(CacheCensusReport), output, json).pipe(
          Effect.andThen(() =>
            json
              ? Effect.void
              : Console.log(
                  `Cache census: ${A.length(report.workspaces)} workspaces; ${A.length(report.nodes)} graph nodes; ${A.length(A.filter(report.nodes, (node) => O.isSome(node.command)))} executable; ${A.length(report.unresolved)} unresolved review obligations.`
                )
          )
        )
      ),
      renderCacheFailure
    )
).pipe(Command.withDescription("Inventory executable scripts and effective Turbo configuration without running tasks"));

/**
 * Render the Cache-owned audit and fail on blocking findings for CLI and Quality consumers.
 *
 * **Example** (Build a read-only audit)
 *
 * ```ts
 * import { runCachePolicyAudit } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(runCachePolicyAudit("/repo", false)))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const runCachePolicyAudit = Effect.fn("Cache.runPolicyAudit")(function* (root: string, json: boolean) {
  const cache = yield* CacheQualificationService;
  const report = yield* cache.audit(root);
  const blocking = A.filter(report.findings, (finding) => finding.blocking);
  if (json) {
    yield* Console.log(
      yield* JsonStringCodec(CachePolicyAuditReport)
        .encode(report)
        .pipe(CacheCommandError.mapError("Cannot encode cache audit."))
    );
  } else {
    yield* Console.log(
      `Cache policy: ${A.length(blocking)} blocking findings; ${A.length(report.unassessed)} unassessed cached computations.`
    );
    yield* Effect.forEach(
      report.findings,
      (finding) => Console.log(`${finding.blocking ? "BLOCK" : "REVIEW"} ${finding.kind}: ${finding.subject}`),
      { discard: true }
    );
  }
  if (A.isReadonlyArrayNonEmpty(blocking))
    return yield* CacheCommandError.new("Current cache reuse differs from reviewed policy.");
}, renderCacheFailure);

const cacheAuditCommand = Command.make(
  "audit",
  {
    json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
  },
  ({ json }) => runCachePolicyAudit(process.cwd(), json)
).pipe(Command.withDescription("Check effective cache settings against the reviewed baseline and tuple ledger"));

const cacheInspectCommand = Command.make("inspect", {}, () =>
  Effect.gen(function* () {
    const cache = yield* CacheQualificationService;
    const store = yield* cache.inspect(process.cwd());
    yield* Console.log(
      yield* JsonStringCodec(CacheQualificationStore)
        .encode(store)
        .pipe(CacheCommandError.mapError("Cannot encode qualification ledger."))
    );
  }).pipe(renderCacheFailure)
).pipe(Command.withDescription("Read explicit qualification states; absent tuples are unassessed"));

const requestFlag = Flag.Path("request", { pathType: "file" }).pipe(
  Flag.withDescription("Schema-validated reviewed request JSON")
);

const cacheFingerprintCommand = Command.make(
  "fingerprint",
  { computation: Flag.String("computation"), output: outputFlag },
  ({ computation, output }) =>
    Effect.gen(function* () {
      const cache = yield* CacheQualificationService;
      const identity = yield* cache.fingerprint(process.cwd(), computation);
      yield* writeEncoded(identity, JsonStringCodec(CacheLiveIdentity), output, O.isNone(output));
      if (O.isSome(output))
        yield* Console.log(
          `Fingerprint recorded for ${identity.key.computation}; configuration ${identity.configurationDigest}; toolchain ${identity.toolchainDigest}.`
        );
    }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription("Observe actual configuration and native binaries for a scoped qualification candidate")
);

const BaselineReviewJson = JsonStringCodec(CacheBaselineRequest);
const TransitionReviewJson = JsonStringCodec(CacheTransitionRequest);
const readCacheReviewRequest = Effect.fn("Cache.readReviewRequest")(function* <A>(
  request: string,
  decode: (text: string) => Effect.Effect<A, S.SchemaError>,
  failure: string
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(request).pipe(Effect.flatMap(decode), CacheCommandError.mapError(failure));
});

const cacheBaselineCommand = Command.make("baseline", { request: requestFlag }, ({ request }) =>
  Effect.gen(function* () {
    const cache = yield* CacheQualificationService;
    const input = yield* readCacheReviewRequest(
      request,
      BaselineReviewJson.decode,
      "Cannot decode baseline review request."
    );
    const record = yield* cache.baseline(process.cwd(), input);
    const list = (subjects: ReadonlyArray<string>) =>
      A.isReadonlyArrayNonEmpty(subjects) ? A.join(subjects, ", ") : "none";
    yield* Console.log(
      `Reviewed baseline written for ${A.length(record.baseline.projection.nodes)} executable computations; scope ${A.join(record.baseline.scope, ", ")}.`
    );
    yield* Console.log(
      `Review stamped on ${A.length(record.stamped)} subject(s): ${list(record.stamped)}. Carried ${A.length(record.carried)} prior review(s). Dropped: ${list(record.dropped)}.`
    );
  }).pipe(renderCacheFailure)
).pipe(Command.withDescription("Record reviewed legacy settings without granting qualification"));

const cacheTransitionCommand = Command.make("transition", { request: requestFlag }, ({ request }) =>
  Effect.gen(function* () {
    const cache = yield* CacheQualificationService;
    const input = yield* readCacheReviewRequest(
      request,
      TransitionReviewJson.decode,
      "Cannot decode qualification transition request."
    );
    const store = yield* cache.transition(process.cwd(), input);
    yield* Console.log(
      `Qualification revision ${store.revision}: ${input.entry.key.computation} is ${input.entry.status.state}.`
    );
  }).pipe(renderCacheFailure)
).pipe(Command.withDescription("Apply a reviewed lifecycle transition with an expected ledger revision"));

const readCacheRequest = Effect.fn("Cache.readRequest")(function* <Decoded, Encoded>(
  request: string,
  schema: S.Codec<Decoded, Encoded>,
  maxBytes: number = S.Natural.make(64 * 1024)
) {
  const read = yield* readContainedFileBytesNoFollow(process.cwd(), request, maxBytes).pipe(
    CacheCommandError.mapError("Cannot read the bounded local experiment request.")
  );
  const bytes = yield* read.contents.pipe(
    Effect.fromOption(() => CacheCommandError.new("The contained experiment request must be a regular file."))
  );
  return yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => CacheCommandError.new("The experiment request is not valid UTF-8."),
  }).pipe(
    Effect.flatMap(JsonStringCodec(schema).decode),
    CacheCommandError.mapError("Cannot decode the pinned local experiment request.")
  );
});

const cacheProfileCommand = Command.make(
  "profile",
  { write: Flag.Boolean("write").pipe(Flag.withDefault(false)) },
  ({ write }) =>
    Effect.gen(function* () {
      if (write) yield* writeCacheIdentityLintProfile(process.cwd());
      else yield* verifyCacheIdentityLintProfile(process.cwd());
      yield* Console.log(
        write ? "Identity lint candidate profile written." : "Identity lint candidate profile is current."
      );
    }).pipe(renderCacheFailure)
).pipe(Command.withDescription("Check generated identity lint profile freshness, or regenerate with --write"));

const cacheActivationCommand = Command.make(
  "activation",
  { request: Flag.File("request"), output: outputFlag },
  ({ request, output }) =>
    Effect.gen(function* () {
      const cache = yield* CacheQualificationService;
      const input = yield* readCacheRequest(request, CacheActivationRequest);
      const report = yield* cache.activation(process.cwd(), CacheActivationRequest.make(input));
      yield* writeEncoded(report, JsonStringCodec(CacheActivationPreview), output);
    }).pipe(renderCacheFailure)
).pipe(Command.withDescription("Preview an exact reviewed single-task cache activation without enabling reuse"));

const cacheSyntheticCommand = Command.make(
  "synthetic",
  { request: Flag.File("request"), output: outputFlag },
  ({ request, output }) =>
    Effect.gen(function* () {
      const input = yield* readCacheRequest(request, CacheSyntheticRequest);
      const report = yield* runCacheSyntheticExperiment(process.cwd(), CacheSyntheticRequest.make(input));
      yield* writeEncoded(report, JsonStringCodec(CacheSyntheticReceipt), output);
      if (A.some(report.checks, (check) => !check.passed))
        return yield* CacheCommandError.new("The local synthetic experiment reported a failed assertion.");
    }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription("Run a bounded, network-isolated local fixture with an exactly pinned native client"),
  Command.provide(MemoryStatsLive)
);

const cacheDependenciesCommand = Command.make("dependencies", { output: outputFlag }, ({ output }) =>
  Effect.gen(function* () {
    const report = yield* materializeCacheDependencies(process.cwd());
    yield* writeEncoded(report, JsonStringCodec(CacheDependencyMaterialization), output, O.isNone(output));
  }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription("Copy and verify the installed dependency tree; retain the machine-local receipt privately"),
  Command.provide(MemoryStatsLive)
);

const cachePilotCommand = Command.make(
  "pilot",
  { request: Flag.File("request"), output: outputFlag },
  ({ request, output }) =>
    Effect.gen(function* () {
      const input = yield* readCacheRequest(request, CachePilotRequest);
      const report = yield* runCachePilotExperiment(process.cwd(), CachePilotRequest.make(input));
      yield* writeEncoded(report, JsonStringCodec(CachePilotReceipt), output);
      if (A.some(report.checks, (check) => !check.passed))
        return yield* CacheCommandError.new("The local real-pilot experiment reported a failed assertion.");
    }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription("Compare the real lint pilot in bounded, network-isolated read-only worktree overlays"),
  Command.provide(MemoryStatsLive)
);

const cacheSignedPilotCommand = Command.make(
  "pilot-signed",
  { request: Flag.File("request"), output: outputFlag },
  ({ request, output }) =>
    Effect.gen(function* () {
      const input = yield* readCacheRequest(request, CacheSignedPilotRequest);
      const report = yield* runCacheSignedPilotExperiment(process.cwd(), CacheSignedPilotRequest.make(input));
      yield* writeEncoded(report, JsonStringCodec(CacheSignedPilotReceipt), output);
    }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription("Compare signed real-pilot pairs in a supervised private network"),
  Command.provide(MemoryStatsLive)
);

const cacheAcceptCommand = Command.make(
  "accept",
  { request: Flag.File("request"), output: outputFlag },
  ({ request, output }) =>
    Effect.gen(function* () {
      const input = yield* readCacheRequest(request, CacheProducerImportRequest, S.Natural.make(8 * 1024 * 1024));
      const configuration = yield* loadCacheProducerStoreConfiguration();
      const reference = yield* persistCacheProducerAcceptance(
        configuration.directory,
        CacheProducerImportRequest.make(input),
        configuration.trust
      );
      yield* writeEncoded(reference, JsonStringCodec(CacheProducerAcceptanceReference), output);
    }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription("Retain authenticated policy-complete reports and emit a reference without promoting a tuple")
);

const cacheProducerRunCommand = Command.make(
  "producer-run",
  {
    request: Flag.File("request"),
    output: outputFlag,
    publication: Flag.Path("publication", { pathType: "file" }).pipe(
      Flag.optional,
      Flag.withDescription(
        "Create new private cache-producer.json for this workflow run and attempt; use fresh --output"
      )
    ),
  },
  ({ request, output, publication }) =>
    Effect.gen(function* () {
      const publicationRun = yield* O.match(publication, {
        onNone: () => Effect.succeedNone,
        onSome: Effect.fn("Cache.producerPublicationRun")(function* (file) {
          const path = yield* Path.Path;
          if (
            O.isNone(output) ||
            path.basename(file) !== "cache-producer.json" ||
            path.resolve(file) === path.resolve(output.value)
          )
            return yield* CacheCommandError.new(
              "Hosted publication requires --output and a distinct cache-producer.json path."
            );
          const reference = yield* Config.all({
            runId: Config.schema(CacheHostedProducerRunReference.fields.runId, "GITHUB_RUN_ID"),
            attempt: Config.schema(CacheHostedProducerRunReference.fields.attempt, "GITHUB_RUN_ATTEMPT"),
          }).pipe(
            CacheCommandError.mapError("Hosted publication requires valid GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT.")
          );
          return Tuple.make(file, CacheHostedProducerRunReference.make(reference));
        }, Effect.asSome),
      });
      const directory = yield* Config.String("BEEP_CACHE_PRODUCER_STORE").pipe(
        Effect.mapError(() => CacheCommandError.new("An independently provisioned producer store is required."))
      );
      const [binding, runtime] = yield* loadCacheProducerExecutionRuntime(directory);
      const input = yield* readCacheRequest(request, CacheSignedPilotRequest);
      const observation = yield* runCacheProducerWorkflow(
        process.cwd(),
        CacheSignedPilotRequest.make(input),
        directory,
        binding,
        O.some(runtime)
      );
      const hosted = yield* O.match(publicationRun, {
        onNone: () => Effect.succeedNone,
        onSome: ([file, reference]) =>
          buildCacheHostedProducerCompleteReport(observation, reference).pipe(
            Effect.map((report) => Tuple.make(file, report)),
            Effect.asSome
          ),
      });
      yield* writeEncoded(
        observation,
        JsonStringCodec(CacheProducerObservation),
        output,
        O.isNone(output),
        O.some(8 * 1024 * 1024),
        true
      );
      if (O.isSome(hosted))
        yield* writeEncoded(
          hosted.value[1],
          JsonStringCodec(CacheHostedProducerCompleteReport),
          O.some(hosted.value[0]),
          false,
          O.some(64 * 1024),
          true
        );
    }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription(
    "Execute and authenticate an owned producer using independently provisioned private approval"
  ),
  Command.provide(MemoryStatsLive),
  Command.provide(FetchHttpClient.layer)
);

const provisionCacheProducer = Effect.fn("Cache.provisionProducer")(function* (requireMaterial: typeof S.Boolean.Type) {
  const configured = yield* Config.all({
    inputs: Config.String("BEEP_CACHE_PRODUCER_PROVISIONING"),
    directory: Config.String("BEEP_CACHE_PRODUCER_STORE"),
  }).pipe(
    Effect.mapError(() =>
      CacheCommandError.new("Independently selected provisioning inputs and producer store are required.")
    )
  );
  const [approval, profile, material] = yield* readCacheProducerProvisioning(configured.inputs, process.cwd());
  if (requireMaterial && O.isNone(material))
    return yield* CacheCommandError.new("Producer installation requires independently transferred issuer material.");
  yield* initializeCacheProducerExecution(process.cwd(), configured.directory, approval, profile, material);
  yield* Console.log(
    "Producer execution store provisioned from independent approval; runtime capabilities were not loaded."
  );
}, renderCacheFailure);

const cacheProducerProvisionCommand = Command.make("producer-provision", {}, () => provisionCacheProducer(false)).pipe(
  Command.withDescription("Exclusively provision a private producer store from independently selected approval files")
);
const cacheProducerInstallCommand = Command.make("producer-install", {}, () => provisionCacheProducer(true)).pipe(
  Command.withDescription("Install the exact independently approved private issuer without generating a replacement")
);

const ProducerWorkflowJson = JsonStringCodec(CacheProducerWorkflow);
const cacheProducerInspectCommand = Command.make(
  "producer-inspect",
  { output: Flag.Path("output", { pathType: "file" }) },
  ({ output }) =>
    Effect.gen(function* () {
      const workflow = yield* inspectCacheProducerWorkflow(process.cwd());
      yield* writeEncoded(workflow, ProducerWorkflowJson, O.some(output), false, O.some(4 * 1024 * 1024));
      yield* Console.log("Producer source inspection written; no approval or cache activation.");
    }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription("Inspect clean producer sources and tools without loading credentials or approving them")
);

const cacheProtocolRunCommand = Command.make(
  "protocol-run",
  { request: Flag.File("request"), output: outputFlag },
  ({ request, output }) =>
    Effect.gen(function* () {
      const input = yield* readCacheRequest(request, CacheProtocolRequest);
      const report = yield* runCacheProtocolExperiment(process.cwd(), CacheProtocolRequest.make(input));
      yield* writeEncoded(report, JsonStringCodec(CacheProtocolExecution), output);
    }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription("Execute pinned signed native fixtures in an isolated private network"),
  Command.provide(MemoryStatsLive)
);

const cacheProtocolReviewCommand = Command.make(
  "protocol-review",
  { request: Flag.File("request"), output: outputFlag },
  ({ request, output }) =>
    Effect.gen(function* () {
      const observation = yield* readCacheRequest(request, CacheProtocolObservation);
      const reviewed = yield* validateCacheProtocolObservation(CacheProtocolObservation.make(observation));
      yield* writeEncoded(reviewed, JsonStringCodec(CacheProtocolObservation), output);
    }).pipe(renderCacheFailure)
).pipe(Command.withDescription("Validate bounded synthetic protocol observations without granting qualification"));

const cacheConformanceCorpusCommand = Command.make(
  "conformance-corpus",
  {
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Fail when the committed corpus differs from the regenerated one")
    ),
  },
  ({ check }) =>
    syncCacheConformanceCorpus(process.cwd(), check).pipe(
      Effect.flatMap((path) => Console.log(check ? `${path} is current.` : `${path} written.`)),
      renderCacheFailure
    )
).pipe(Command.withDescription("Generate the Remote Cache conformance corpus from the pinned OpenAPI blob and plan"));

const conformanceRunJson = S.fromJsonString(CacheConformanceRun, { space: 2 });
const encodeComparisonJson = S.encodeEffect(S.fromJsonString(CacheConformanceComparison, { space: 2 }));

const writeConformanceRun = Effect.fn("Cache.writeConformanceRun")(function* (
  report: CacheConformanceRun,
  output: string
) {
  yield* writeEncoded(report, { encode: S.encodeEffect(conformanceRunJson) }, O.some(output), false);
  yield* Console.log(
    A.join(
      A.map(
        report.summary,
        (row) =>
          `${row.dimension}: pass ${row.pass}, fail ${row.fail}, unsupported-optional ${row.unsupportedOptional}, not-applicable ${row.notApplicable}, not-executed ${row.notExecuted}`
      ),
      "\n"
    )
  );
});

const readConformanceTarget = Effect.fn("Cache.readConformanceTarget")(function* (target: string) {
  const descriptor = CacheConformanceTarget.make(yield* readCacheRequest(target, CacheConformanceTarget));
  return { descriptor, bearers: yield* loadCacheConformanceBearers(descriptor) };
});

const conformanceTargetFlag = Flag.File("target").pipe(
  Flag.withDescription("Target descriptor (cache-conformance-target/v1); bearers come from the env vars it names")
);
const conformanceOutputFlag = Flag.Path("output", { pathType: "file" }).pipe(
  Flag.withDescription("Write the cache-conformance-run/v1 report to this path")
);

// Command names stay literal at each Command.make site: the knowledge
// command-surface derivation reads them statically.
const runConformanceTarget =
  <R>(
    run: (
      descriptor: CacheConformanceTarget,
      bearers: CacheConformanceBearers,
      corpus: CacheConformanceCorpus
    ) => Effect.Effect<CacheConformanceRun, CacheCommandError, R>
  ) =>
  ({ target, output }: { readonly target: string; readonly output: string }) =>
    Effect.gen(function* () {
      const { descriptor, bearers } = yield* readConformanceTarget(target);
      const corpus = yield* buildCacheConformanceCorpus(process.cwd());
      yield* writeConformanceRun(yield* run(descriptor, bearers, corpus), output);
    }).pipe(renderCacheFailure);

const cacheConformanceRunCommand = Command.make(
  "conformance-run",
  { target: conformanceTargetFlag, output: conformanceOutputFlag },
  runConformanceTarget((descriptor, bearers, corpus) => runCacheConformance(corpus, descriptor, bearers))
).pipe(
  Command.withDescription("Score one Remote Cache target over direct HTTP; native and lab cases are not executed"),
  Command.provide(FetchHttpClient.layer)
);

const cacheConformanceNativeCommand = Command.make(
  "conformance-native",
  {
    target: conformanceTargetFlag,
    client: Flag.Literals("client", CacheClientChannel.literals).pipe(
      Flag.withDescription("Pinned client channel to run: stable or canary")
    ),
    output: conformanceOutputFlag,
    fetchClient: Flag.Boolean("fetch-client").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Download the pinned platform tarball from the npm registry when the client is not cached")
    ),
  },
  ({ target, client, output, fetchClient }) =>
    Effect.gen(function* () {
      const { descriptor, bearers } = yield* readConformanceTarget(target);
      const corpus = yield* buildCacheConformanceCorpus(process.cwd());
      const resolved = yield* resolveCacheConformanceClient(process.cwd(), client, fetchClient);
      yield* writeConformanceRun(
        yield* runCacheConformanceNative(process.cwd(), corpus, descriptor, bearers, resolved),
        output
      );
    }).pipe(renderCacheFailure)
).pipe(
  Command.withDescription("Run the exact pinned Turbo client's signed matrix (RC-017..RC-022) through the fault proxy"),
  Command.provide(FetchHttpClient.layer)
);

const cacheConformanceLabCommand = Command.make(
  "conformance-lab",
  { target: conformanceTargetFlag, output: conformanceOutputFlag },
  runConformanceTarget((descriptor, bearers, corpus) =>
    loadCacheConformanceEnvelope(process.cwd()).pipe(
      Effect.flatMap((envelope) => runCacheConformanceLab(corpus, descriptor, bearers, envelope))
    )
  )
).pipe(
  Command.withDescription("Inject RC-023 fault classes through the proxy and measure the RC-027/RC-028 envelopes"),
  Command.provide(FetchHttpClient.layer)
);

const cacheConformanceCompareCommand = Command.make(
  "conformance-compare",
  {
    runs: Flag.File("runs").pipe(
      Flag.atLeast(1),
      Flag.withDescription("Run reports to merge per target and compare; repeat the flag for each file")
    ),
    evidence: Flag.File("evidence").pipe(
      Flag.atLeast(0),
      Flag.withDescription(
        "Executed deployed or log evidence (cache-conformance-evidence/v1) to merge into the gates; repeatable"
      )
    ),
    output: Flag.Path("output", { pathType: "file" }).pipe(
      Flag.withDescription("Write the comparison JSON here and the Markdown summary beside it (.md)")
    ),
  },
  ({ runs, evidence, output }) =>
    Effect.gen(function* () {
      const reports = yield* Effect.forEach(runs, (run) =>
        readCacheRequest(run, CacheConformanceRun, S.Natural.make(32 * 1024 * 1024)).pipe(
          Effect.map(CacheConformanceRun.make)
        )
      );
      const documents = yield* Effect.forEach(evidence, (file) =>
        readCacheRequest(file, CacheConformanceEvidence, S.Natural.make(4 * 1024 * 1024)).pipe(
          Effect.map(CacheConformanceEvidence.make)
        )
      );
      const comparison = yield* A.match(reports, {
        onEmpty: () => Effect.fail(CacheCommandError.new("Pass at least one --runs report.")),
        onNonEmpty: (all) => compareCacheConformanceRuns(process.cwd(), all, documents),
      });
      yield* writeEncoded(comparison, { encode: encodeComparisonJson }, O.some(output), false);
      const markdown = Str.endsWith(".json")(output) ? `${Str.slice(0, -5)(output)}.md` : `${output}.md`;
      yield* Effect.tryPromise({
        try: () => Bun.write(markdown, renderCacheConformanceComparison(comparison)),
        catch: (cause) => CacheCommandError.new(`Failed to write ${markdown}.`, cause),
      });
      yield* Console.log(comparison.verdict);
    }).pipe(renderCacheFailure)
).pipe(Command.withDescription("Merge run reports per target and score the frozen rubric's hard gates"));

const cacheExecuteCommand = Command.make(
  "execute",
  { args: Argument.String("args").pipe(Argument.variadic) },
  ({ args }) =>
    decodeRuntimeArguments(args).pipe(
      CacheCommandError.mapError("Runtime execution arguments must be strings."),
      Effect.flatMap((values) => runCacheRuntimeTasks(process.cwd(), values)),
      renderCacheFailure,
      Effect.flatMap((exitCode) =>
        exitCode === 0 ? Effect.void : failWithReportedExit("Native Turbo execution failed.", exitCode)
      )
    )
).pipe(Command.withDescription("Execute native Turbo inside the resolved environment with a governed runtime key"));

const cacheRemoteReadsCommand = Command.make(
  "remote-reads",
  { checkout: Flag.String("checkout").pipe(Flag.withDefault(".")) },
  Effect.fn("Cache.remoteReadsCommand")(function* ({ checkout }) {
    const config = yield* Config.all({
      api: Config.String("TURBO_API"),
      team: Config.String("TURBO_TEAM"),
      tokenRef: Config.String("TURBO_TOKEN_REF"),
      replace: Config.String("TURBO_TOKEN_REPLACE").pipe(Config.withDefault("0")),
    }).pipe(
      Effect.mapError(() =>
        CacheCommandError.new("Set TURBO_API, TURBO_TEAM, and TURBO_TOKEN_REF without resolving the reference.")
      )
    );
    if (config.replace !== "0" && config.replace !== "1")
      return yield* CacheCommandError.new("TURBO_TOKEN_REPLACE must be 0 or 1");
    const input = yield* S.decodeEffect(CacheRemoteReadsRequest)({
      ...config,
      replaceToken: config.replace === "1",
    }).pipe(
      Effect.mapError(() =>
        CacheCommandError.new(
          "Expected https TURBO_API, a single-line TURBO_TEAM, and an op://vault/item/[section/]field reference."
        )
      )
    );
    const service = yield* CacheQualificationService;
    yield* Console.log(A.join(yield* service.remoteReads(checkout, input), "\n"));
  }, renderCacheFailure)
).pipe(Command.withDescription("Back up and configure the reference-only workstation remote-read dotenv quad"));

const cacheCommandDefinition = Command.make("cache", {}, () =>
  Console.log(
    "cache commands: census, audit, inspect, baseline, fingerprint, profile, activation, transition, synthetic, dependencies, pilot, pilot-signed, producer-run, producer-inspect, producer-provision, producer-install, accept, protocol-run, protocol-review, conformance-corpus, conformance-run, conformance-native, conformance-lab, conformance-compare, warm, probe, dashboard, execute"
  )
).pipe(
  Command.withDescription("Turbo cache recovery and evidence operations"),
  Command.withSubcommands([
    cacheRemoteReadsCommand,
    cacheExecuteCommand,
    cacheCensusCommand,
    cacheAuditCommand,
    cacheInspectCommand,
    cacheBaselineCommand,
    cacheFingerprintCommand,
    cacheActivationCommand,
    cacheProfileCommand,
    cacheTransitionCommand,
    cacheSyntheticCommand,
    cacheDependenciesCommand,
    cachePilotCommand,
    cacheSignedPilotCommand,
    cacheProducerRunCommand,
    cacheProducerInspectCommand,
    cacheProducerProvisionCommand,
    cacheProducerInstallCommand,
    cacheAcceptCommand,
    cacheProtocolRunCommand,
    cacheProtocolReviewCommand,
    cacheConformanceCorpusCommand,
    cacheConformanceRunCommand,
    cacheConformanceNativeCommand,
    cacheConformanceLabCommand,
    cacheConformanceCompareCommand,
    cacheWarmCommand,
    cacheProbeCommand,
    cacheDashboardCommand,
  ])
);

/**
 * Turbo cache command group.
 *
 * **Example** (Reference the cache command)
 *
 * ```ts
 * import { cacheCommand } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(cacheCommand)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const cacheCommand = cacheCommandDefinition.pipe(
  Command.provide(CacheQualificationLive.pipe(Layer.provideMerge(CacheHostedProducerVerifierLive)))
);

/**
 * Build the real command tree with an explicit qualification authority for tests.
 *
 * **Example** (Provide qualification operations)
 *
 * ```ts
 * import { makeCacheCommandForTesting } from "@beep/repo-cli/test/Cache"
 * import { CacheQualificationLive } from "@beep/repo-cli/commands/Cache"
 * const command = makeCacheCommandForTesting(CacheQualificationLive)
 * console.assert(command.name === "cache")
 * ```
 *
 * @internal
 * @param qualificationLayer - Qualification authority used by the dispatched handlers.
 * @returns The cache command tree with the supplied authority.
 * @category testing
 * @since 0.0.0
 */
export const makeCacheCommandForTesting = <E, R>(qualificationLayer: Layer.Layer<CacheQualificationService, E, R>) =>
  cacheCommandDefinition.pipe(Command.provide(qualificationLayer));
