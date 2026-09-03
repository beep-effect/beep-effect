/**
 * Turbo cache recovery, restoration probes, and evidence dashboard.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { NonNegativeInt } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Clock, Console, DateTime, Effect, MutableHashMap, MutableHashSet, Order } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import {
  CacheCommandError,
  CacheDashboardReport,
  CacheDashboardReportJson,
  CacheLambdaSummary,
  CacheRunMode,
  CacheWallTime,
  CacheWarmLane,
  CacheWarmReceipt,
  CacheWarmReceiptJson,
} from "./Cache.schemas.ts";

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
    return CacheWarmLane.make({ command, durationMs: NonNegativeInt.make(ended - started), exitCode });
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
  output: O.Option<string>
) {
  const encoded = yield* codec.encode(value).pipe(CacheCommandError.mapError("Failed to encode cache report."));
  if (O.isSome(output)) {
    yield* Effect.tryPromise({
      try: () => Bun.write(output.value, `${encoded}\n`),
      catch: (cause) => CacheCommandError.new(`Failed to write ${output.value}.`, cause),
    });
  }
  yield* Console.log(encoded);
});

const requiredWarmEnvironment = ["TURBO_API", "TURBO_TOKEN", "TURBO_TEAM"] as const;

const assertWarmEnvironment = Effect.fn("Cache.assertWarmEnvironment")(function* () {
  for (const name of requiredWarmEnvironment) {
    if (Str.isEmpty(Str.trim(Bun.env[name] ?? ""))) {
      return yield* CacheCommandError.new(`cache warm requires ephemeral ${name} injection.`);
    }
  }
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
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
      "--cache=local:rw,remote:rw",
      "--force",
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
 * import { Effect, Option } from "effect"
 *
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
 * import { Effect } from "effect"
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

const classifyRun = (run: TurboRunSummary): CacheRunMode => {
  const strings = unknownStrings(run.globalCacheInputs);
  if (Str.includes("--force")(run.execution.command) || A.some(strings, Str.includes("TURBO_FORCE=true"))) {
    return CacheRunMode.Enum.forced;
  }
  if (A.every(run.tasks, (task) => task.cache === undefined)) return CacheRunMode.Enum.disabled;
  return A.some(strings, Str.startsWith("TURBO_TOKEN=")) && A.some(strings, Str.startsWith("TURBO_TEAM="))
    ? CacheRunMode.Enum["remote-eligible"]
    : CacheRunMode.Enum["local-only"];
};

const percentile = (values: ReadonlyArray<number>, fraction: number): number =>
  A.match(A.sort(values, Order.Number), {
    onEmpty: () => 0,
    onNonEmpty: (sorted) => Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0),
  });

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
        Effect.flatMap(S.decodeUnknownEffect(TurboRunSummary)),
        Effect.mapError((cause) => CacheCommandError.new(`Invalid Turbo summary ${filePath}.`, cause))
      )
  );
});

const parseLambdaLogs = Effect.fn("Cache.parseLambdaLogs")(function* (path: O.Option<string>) {
  if (O.isNone(path)) {
    return CacheLambdaSummary.make({
      rows: NonNegativeInt.make(0),
      reads: NonNegativeInt.make(0),
      hits: NonNegativeInt.make(0),
      puts: NonNegativeInt.make(0),
    });
  }
  const text = yield* Effect.tryPromise({
    try: () => Bun.file(path.value).text(),
    catch: (cause) => CacheCommandError.new(`Failed to read ${path.value}.`, cause),
  });
  const lines = A.filter(A.map(Str.split(/\r?\n/)(text), Str.trim), (line) => !Str.isEmpty(line));
  const normalized = A.map(lines, Str.toUpperCase);
  return CacheLambdaSummary.make({
    rows: NonNegativeInt.make(lines.length),
    reads: NonNegativeInt.make(
      A.filter(normalized, (line) => Str.includes("GET")(line) || Str.includes("READ")(line)).length
    ),
    hits: NonNegativeInt.make(A.filter(normalized, Str.includes("HIT")).length),
    puts: NonNegativeInt.make(
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
 * import { Effect, Option } from "effect"
 *
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
    runFiles: NonNegativeInt.make(runs.length),
    eligibleFirstTouches: NonNegativeInt.make(observations.length),
    remoteHits: NonNegativeInt.make(remoteHits),
    eligibleRemoteHitRate: observations.length === 0 ? 0 : remoteHits / observations.length,
    excludedForcedOrDisabled: NonNegativeInt.make(aggregation.excludedForcedOrDisabled),
    correctnessViolations: A.sort(A.fromIterable(aggregation.correctnessViolations), Order.String),
    wallTimes: A.map(A.fromIterable(aggregation.durations), ([mode, values]) =>
      CacheWallTime.make({
        mode,
        runs: NonNegativeInt.make(values.length),
        p50Ms: NonNegativeInt.make(percentile(values, 0.5)),
        p95Ms: NonNegativeInt.make(percentile(values, 0.95)),
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
 * import { Effect } from "effect"
 *
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

const outputFlag = Flag.path("output", { pathType: "file" }).pipe(
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
    cacheDir: Flag.path("cache-dir", { pathType: "directory" }).pipe(
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
    runsDir: Flag.path("runs-dir", { pathType: "directory" }).pipe(
      Flag.withDefault(".turbo/runs"),
      Flag.withDescription("Directory containing Turbo --summarize JSON files")
    ),
    lambdaLogs: Flag.path("lambda-logs", { pathType: "file" }).pipe(
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
export const cacheCommand = Command.make("cache", {}, () => Console.log("cache commands: warm, probe, dashboard")).pipe(
  Command.withDescription("Turbo cache recovery and evidence operations"),
  Command.withSubcommands([cacheWarmCommand, cacheProbeCommand, cacheDashboardCommand])
);
