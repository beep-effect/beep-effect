/**
 * CI helper command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A, Str, thunkFalse } from "@beep/utils";
import { Config, Console, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { formatDurationSeconds, makeTaggedLogger, printLines } from "../../internal/cli/Printer.ts";
import { CiCommandError } from "./Ci.errors.ts";
import { ciLaneCommand, ciLocalCommand } from "./CiLane.ts";
import { ciLaneTimingsCommand } from "./LaneTimings.ts";

const $I = $RepoCliId.create("commands/Ci/Ci.command");

class TurboSummaryExecution extends S.Class<TurboSummaryExecution>($I`TurboSummaryExecution`)(
  {
    command: S.optionalKey(S.String),
    attempted: S.optionalKey(S.Finite),
    success: S.optionalKey(S.Finite),
    startTime: S.optionalKey(S.Finite),
    endTime: S.optionalKey(S.Finite),
  },
  $I.annote("TurboSummaryExecution", {
    description: "Execution metadata emitted by a Turbo run summary.",
  })
) {}

class TurboSummaryTaskExecution extends S.Class<TurboSummaryTaskExecution>($I`TurboSummaryTaskExecution`)(
  {
    startTime: S.optionalKey(S.Finite),
    endTime: S.optionalKey(S.Finite),
  },
  $I.annote("TurboSummaryTaskExecution", {
    description: "Task execution timing metadata emitted by Turbo.",
  })
) {}

class TurboSummaryTaskCache extends S.Class<TurboSummaryTaskCache>($I`TurboSummaryTaskCache`)(
  {
    status: S.optionalKey(S.String),
    local: S.optionalKey(S.Boolean),
    remote: S.optionalKey(S.Boolean),
  },
  $I.annote("TurboSummaryTaskCache", {
    description: "Task cache metadata emitted by Turbo.",
  })
) {}

class TurboSummaryTaskDefinition extends S.Class<TurboSummaryTaskDefinition>($I`TurboSummaryTaskDefinition`)(
  {
    cache: S.optionalKey(S.Boolean),
  },
  $I.annote("TurboSummaryTaskDefinition", {
    description: "Resolved task definition metadata emitted by Turbo.",
  })
) {}

class TurboSummaryTask extends S.Class<TurboSummaryTask>($I`TurboSummaryTask`)(
  {
    taskId: S.optionalKey(S.String),
    execution: S.optionalKey(TurboSummaryTaskExecution),
    cache: S.optionalKey(TurboSummaryTaskCache),
    resolvedTaskDefinition: S.optionalKey(TurboSummaryTaskDefinition),
  },
  $I.annote("TurboSummaryTask", {
    description: "Task entry emitted by a Turbo run summary.",
  })
) {}

const TurboSummaryTasks = S.Union([S.Array(TurboSummaryTask), S.Record(S.String, TurboSummaryTask)]);

class TurboSummary extends S.Class<TurboSummary>($I`TurboSummary`)(
  {
    execution: S.optionalKey(TurboSummaryExecution),
    tasks: S.optionalKey(TurboSummaryTasks),
  },
  $I.annote("TurboSummary", {
    description: "Turbo run summary document consumed by CI summary rendering.",
  })
) {}

const decodeTurboSummary = S.decodeUnknownEffect(S.fromJsonString(TurboSummary));

class SummaryCandidate extends S.Class<SummaryCandidate>($I`SummaryCandidate`)(
  {
    path: S.String,
    mtimeMillis: S.Finite,
  },
  $I.annote("SummaryCandidate", {
    description: "Candidate file for Turbo summary parsing.",
  })
) {}

class LongestTask extends S.Class<LongestTask>($I`LongestTask`)(
  {
    taskId: S.String,
    durationMs: S.Finite,
    cacheStatus: S.String,
  },
  $I.annote("LongestTask", {
    description: "Task with the longest duration in a Turbo summary.",
  })
) {}

const formatDuration = (durationMs: number): string => formatDurationSeconds(durationMs, 2);

const logTurboSummary = makeTaggedLogger("turbo-summary");

const optionNumber = (value: number | undefined): number => value ?? 0;

const taskDuration = (task: TurboSummaryTask): number =>
  optionNumber(task.execution?.endTime) - optionNumber(task.execution?.startTime);

const taskCacheStatus = (task: TurboSummaryTask): string => task.cache?.status ?? "UNKNOWN";

const turboSummaryTasks = (tasks: TurboSummary["tasks"]): ReadonlyArray<TurboSummaryTask> => {
  if (A.isArray(tasks)) {
    return tasks as ReadonlyArray<TurboSummaryTask>;
  }
  return R.values((tasks ?? {}) as Readonly<Record<string, TurboSummaryTask>>);
};

const appendToSummary = Effect.fn("Ci.appendToSummary")(function* (
  renderedSummary: string
): Effect.fn.Return<void, CiCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const summaryPath = pipe(
    yield* Config.option(Config.string("GITHUB_STEP_SUMMARY")).pipe(Effect.orElseSucceed(O.none<string>)),
    O.getOrUndefined
  );

  if (summaryPath === undefined || Str.isEmpty(summaryPath)) {
    yield* Console.log(renderedSummary);
    return;
  }

  const exists = yield* fs.exists(summaryPath).pipe(Effect.orElseSucceed(thunkFalse));
  const previous = exists
    ? yield* fs.readFileString(summaryPath).pipe(CiCommandError.mapError(`Failed to read ${summaryPath}.`))
    : "";

  yield* fs
    .writeFileString(summaryPath, `${previous}${renderedSummary}`)
    .pipe(CiCommandError.mapError(`Failed to append Turbo summary to ${summaryPath}.`));
});

const resolveSummaryPaths = Effect.fn("Ci.resolveSummaryPaths")(function* (
  repoRoot: string,
  explicitPath: O.Option<string>,
  includeAll: boolean
): Effect.fn.Return<ReadonlyArray<string>, CiCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  if (O.isSome(explicitPath)) {
    return [path.resolve(repoRoot, explicitPath.value)];
  }

  const runDirectory = path.join(repoRoot, ".turbo", "runs");
  const exists = yield* fs.exists(runDirectory).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return A.empty<string>();
  }

  const entries = yield* fs
    .readDirectory(runDirectory)
    .pipe(CiCommandError.mapError(`Failed to read ${runDirectory}.`));
  const candidates = yield* Effect.forEach(
    pipe(entries, A.filter(Str.endsWith(".json"))),
    Effect.fn(function* (entry) {
      const candidatePath = path.join(runDirectory, entry);
      const stat = yield* fs.stat(candidatePath).pipe(CiCommandError.mapError(`Failed to stat ${candidatePath}.`));
      return O.some({
        path: candidatePath,
        mtimeMillis: pipe(
          stat.mtime,
          O.map((mtime) => mtime.getTime()),
          O.getOrElse(() => 0)
        ),
      });
    }),
    { concurrency: 4 }
  ).pipe(Effect.map(A.getSomes));

  const sortedPaths = pipe(
    candidates,
    A.sort(Order.mapInput(Order.Number, (candidate: SummaryCandidate) => -candidate.mtimeMillis)),
    A.map((candidate) => candidate.path)
  );
  return includeAll ? A.reverse(sortedPaths) : A.take(sortedPaths, 1);
});

const renderTurboSummary = (repoRoot: string, summaryPath: string, run: TurboSummary, path: Path.Path): string => {
  const tasks = turboSummaryTasks(run.tasks);
  const longestTasks = pipe(
    tasks,
    A.map(
      (task): LongestTask => ({
        taskId: task.taskId ?? "unknown",
        durationMs: taskDuration(task),
        cacheStatus: taskCacheStatus(task),
      })
    ),
    A.filter((task) => task.durationMs > 0),
    A.sort(Order.mapInput(Order.Number, (task: LongestTask) => -task.durationMs)),
    A.take(5)
  );
  const cacheHits = A.filter(tasks, (task) => task.cache?.status === "HIT");
  const localHits = A.filter(cacheHits, (task) => task.cache?.local === true);
  const remoteHits = A.filter(cacheHits, (task) => task.cache?.remote === true);
  const cacheMisses = A.filter(tasks, (task) => task.cache?.status === "MISS");
  const cacheBypassed = A.filter(tasks, (task) => task.resolvedTaskDefinition?.cache === false);
  const runDurationMs = optionNumber(run.execution?.endTime) - optionNumber(run.execution?.startTime);
  const lines = [
    "## Turbo Summary",
    "",
    `- Command: \`${run.execution?.command ?? "unknown"}\``,
    `- Attempted tasks: ${run.execution?.attempted ?? A.length(tasks)}`,
    `- Successful tasks: ${run.execution?.success ?? 0}`,
    `- Cached tasks: ${A.length(cacheHits)} (${A.length(localHits)} local, ${A.length(remoteHits)} remote)`,
    `- Cache misses: ${A.length(cacheMisses)}`,
    `- Cache-disabled tasks: ${A.length(cacheBypassed)}`,
    `- Run duration: ${formatDuration(runDurationMs)}`,
    `- Summary file: \`${path.relative(repoRoot, summaryPath)}\``,
  ];

  if (A.isReadonlyArrayNonEmpty(longestTasks)) {
    A.appendAllInPlace(lines, ["", "| Task | Duration | Cache |", "| --- | ---: | --- |"]);

    for (const task of longestTasks) {
      A.appendInPlace(lines, `| \`${task.taskId}\` | ${formatDuration(task.durationMs)} | ${task.cacheStatus} |`);
    }
  }

  return `${A.join(lines, "\n")}\n`;
};

/**
 * Append the latest Turbo run summary to GitHub step summary or stdout.
 *
 * **Example** (Append Turbo summary program)
 *
 * ```ts
 * import { appendTurboSummary } from "@beep/repo-cli/commands/Ci"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = appendTurboSummary(O.some(".turbo/runs/latest.json")).pipe(Effect.provide(NodeServices.layer))
 * Effect.runPromise(program).then(() => console.log("summary appended"))
 * ```
 *
 * @param explicitPath - Optional explicit Turbo summary path.
 * @param includeAll - Whether to append every summary in `.turbo/runs` instead of only the newest.
 * @returns Effect that renders the summary.
 * @effects Locates the repository root, reads Turbo summary JSON, reads `GITHUB_STEP_SUMMARY`, then appends Markdown to that file or logs it to stdout.
 * @category use-cases
 * @since 0.0.0
 */
export const appendTurboSummary = Effect.fn("Ci.appendTurboSummary")(function* (
  explicitPath: O.Option<string>,
  includeAll = false
): Effect.fn.Return<void, CiCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));
  const summaryPaths = yield* resolveSummaryPaths(repoRoot, explicitPath, includeAll);

  if (A.isReadonlyArrayEmpty(summaryPaths)) {
    yield* logTurboSummary("No run summary file found.");
    return;
  }

  const rendered = yield* Effect.forEach(
    summaryPaths,
    Effect.fnUntraced(function* (summaryPath) {
      const exists = yield* fs.exists(summaryPath).pipe(Effect.orElseSucceed(thunkFalse));
      if (!exists) {
        return O.none<string>();
      }

      const content = yield* fs
        .readFileString(summaryPath)
        .pipe(CiCommandError.mapError(`Failed to read ${summaryPath}.`));
      const run = yield* decodeTurboSummary(content).pipe(CiCommandError.mapError(`Failed to parse ${summaryPath}.`));
      return O.some(renderTurboSummary(repoRoot, summaryPath, run, path));
    })
  ).pipe(Effect.map(A.getSomes));

  if (A.isReadonlyArrayEmpty(rendered)) {
    yield* logTurboSummary("No run summary file found.");
    return;
  }

  yield* appendToSummary(A.join(rendered, "\n"));
});

const appendTurboSummaryCommand = Command.make(
  "append-turbo-summary",
  {
    all: Flag.boolean("all").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Append every Turbo run summary from the current job")
    ),
    summaryPath: Argument.string("summary-path").pipe(Argument.optional),
  },
  ({ all, summaryPath }) =>
    pipe(
      appendTurboSummary(summaryPath, all),
      Effect.catchTag("CiCommandError", (error) =>
        Console.error(`[ci] ${error.message}`).pipe(Effect.andThen(failWithReportedExit(`[ci] ${error.message}`)))
      )
    )
).pipe(Command.withDescription("Append a Turbo run summary to GitHub step summary or stdout"));

/**
 * CI helper command group.
 *
 * **Example** (Register CI command group)
 *
 * ```ts
 * import { ciCommand } from "@beep/repo-cli/commands/Ci"
 *
 * const commandGroups = { ci: ciCommand }
 * console.log(Object.keys(commandGroups)) // ["ci"]
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciCommand = Command.make("ci", {}, () =>
  printLines([
    "CI commands:",
    "- bun run beep ci append-turbo-summary",
    "- bun run beep ci lane <id> [flags] (or --list)",
    "- bun run beep ci lane-timings [--runs n] [--tsv] or --window --since ISO --until ISO [filters]",
    "- bun run beep ci local [--lanes ids] [--fast] [--affected]",
  ])
).pipe(
  Command.withDescription("Continuous integration helper commands"),
  Command.withSubcommands([appendTurboSummaryCommand, ciLaneCommand, ciLaneTimingsCommand, ciLocalCommand])
);
