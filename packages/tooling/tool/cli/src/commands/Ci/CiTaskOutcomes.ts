/**
 * Per-task outcome records of a hosted lane job (`beep ci task-outcomes`, ROUT-05 slice 2b).
 *
 * **Details**
 *
 * A lane job runs its Turbo tasks with `--summarize`, which leaves one run
 * summary per Turbo invocation under `.turbo/runs/`. After the lane step,
 * the job writes one `task-outcomes/v1` record naming the job as GitHub lists
 * it and one `{task, outcome}` row per Turbo task from those summaries, and
 * uploads it as `task-outcomes-<run>-<attempt>-<job>-<key>`. The route corpus
 * capture reads those artifacts for a run with a failed job and fills
 * `HostedJob.tasks` from them, so the replay can tell a failed task from a
 * failed setup step.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import { HostedTaskOutcome, RouteTaskOutcome } from "./Route.schemas.ts";

const $I = $RepoCliId.create("commands/Ci/CiTaskOutcomes");

/**
 * The artifact name prefix of a run attempt's task-outcome records.
 *
 * **Example** (Name a run's records)
 *
 * ```ts
 * import { taskOutcomeArtifactPrefix } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(taskOutcomeArtifactPrefix(42, 1)) // "task-outcomes-42-1-"
 * ```
 *
 * @param runId - The workflow run id.
 * @param attempt - The run attempt.
 * @returns The prefix every record artifact of that attempt carries.
 * @category utilities
 * @since 0.0.0
 */
export const taskOutcomeArtifactPrefix: {
  (attempt: number): (runId: number) => string;
  (runId: number, attempt: number): string;
} = dual(2, (runId: number, attempt: number): string => `task-outcomes-${runId}-${attempt}-`);

/**
 * One hosted job's per-task outcomes, as the job wrote them.
 *
 * **Details**
 *
 * `job` is the job's name as GitHub lists it (`Test Unit (unit-a)`). A job
 * reached through a reusable workflow is listed as `<caller> / <job>`, so the
 * capture also joins a record to a job whose name starts with `<job> / `. An
 * empty `tasks` list means the job ran no Turbo task (it stopped before its
 * lane step, or the lane ran none).
 *
 * **Example** (A record with one failed task)
 *
 * ```ts
 * import { HostedTaskOutcome, TaskOutcomeRecord } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const record = TaskOutcomeRecord.make({
 *   schemaVersion: "task-outcomes/v1",
 *   job: "Test Unit (unit-a)",
 *   runId: O.some(1),
 *   runAttempt: O.some(1),
 *   tasks: [HostedTaskOutcome.make({ task: "@beep/a#test", outcome: "fail" })],
 * })
 * console.log(record.tasks.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskOutcomeRecord extends S.Opaque<TaskOutcomeRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("task-outcomes/v1"),
    job: S.NonEmptyString,
    runId: S.OptionFromOptionalKey(S.Int),
    runAttempt: S.OptionFromOptionalKey(S.Int),
    tasks: S.Array(HostedTaskOutcome),
  }).pipe(
    $I.annoteSchema("TaskOutcomeRecord", {
      description: "One hosted job's Turbo task outcomes, keyed by the job's name as GitHub lists it.",
    })
  )
) {}

const encodeTaskOutcomeRecord = S.encodeEffect(S.fromJsonString(TaskOutcomeRecord));

const SummaryTask = S.Struct({
  taskId: S.NonEmptyString,
  execution: S.optionalKey(S.Struct({ exitCode: S.optionalKey(S.Finite) })),
}).pipe($I.annoteSchema("SummaryTask", { description: "The task id and exit code of one Turbo run summary task." }));
const SummaryView = S.Struct({
  tasks: SummaryTask.pipe(S.Array, S.optionalKey),
}).pipe($I.annoteSchema("SummaryView", { description: "The task list of a Turbo run summary." }));

/**
 * The task view of one Turbo run summary.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboSummaryView = typeof SummaryView.Type;

const decodeSummary = S.decodeUnknownEffect(S.fromJsonString(SummaryView));

const outcomeOf = (task: typeof SummaryTask.Type): RouteTaskOutcome =>
  O.match(O.fromUndefinedOr(task.execution?.exitCode), {
    onNone: () => RouteTaskOutcome.Enum["not-run"],
    onSome: (code) => (code === 0 ? RouteTaskOutcome.Enum.pass : RouteTaskOutcome.Enum.fail),
  });

// A task several invocations list keeps its strongest evidence: a failure anywhere is a failure, a pass beats a
// task that never ran.
const OUTCOME_RANK: Readonly<Record<RouteTaskOutcome, number>> = { fail: 3, pass: 2, "not-run": 1, unknown: 0 };

/**
 * One `{task, outcome}` row per Turbo task across a job's run summaries.
 *
 * **Details**
 *
 * Exit code 0 (a run or a cache replay) is `pass`, any other exit code is
 * `fail`, and a task with no exit code (planned, never executed) is
 * `not-run`. A task several summaries list keeps `fail` over `pass` over
 * `not-run`. Rows sort by task id.
 *
 * **Example** (Two invocations)
 *
 * ```ts
 * import { taskOutcomesOf } from "@beep/repo-cli/commands/Ci"
 *
 * const rows = taskOutcomesOf([
 *   { tasks: [{ taskId: "@beep/a#test", execution: { exitCode: 0 } }, { taskId: "@beep/b#test" }] },
 *   { tasks: [{ taskId: "@beep/b#test", execution: { exitCode: 1 } }] },
 * ])
 * console.log(rows.map((row) => `${row.task}=${row.outcome}`)) // ["@beep/a#test=pass", "@beep/b#test=fail"]
 * ```
 *
 * @param summaries - The decoded run summaries of one job.
 * @returns The job's task outcomes.
 * @category utilities
 * @since 0.0.0
 */
export const taskOutcomesOf = (summaries: ReadonlyArray<TurboSummaryView>): ReadonlyArray<HostedTaskOutcome> =>
  pipe(
    A.flatMap(summaries, (summary) => summary.tasks ?? A.empty()),
    A.reduce(HashMap.empty<string, RouteTaskOutcome>(), (acc, task) => {
      const outcome = outcomeOf(task);
      return O.exists(HashMap.get(acc, task.taskId), (previous) => OUTCOME_RANK[previous] >= OUTCOME_RANK[outcome])
        ? acc
        : HashMap.set(acc, task.taskId, outcome);
    }),
    HashMap.toEntries,
    A.sort(Order.mapInput(Order.String, ([task]: readonly [string, RouteTaskOutcome]) => task)),
    A.map(([task, outcome]) => HostedTaskOutcome.make({ task, outcome }))
  );

const optionalInt = (name: string) => Config.option(Config.Int(name));
const RunIdentity = Config.all({ runId: optionalInt("GITHUB_RUN_ID"), runAttempt: optionalInt("GITHUB_RUN_ATTEMPT") });

/**
 * Write the current job's task-outcome record from `.turbo/runs/*.json`.
 *
 * **Details**
 *
 * Every run summary in the checkout's `.turbo/runs/` is read; one that does
 * not decode fails the command, so a record never silently drops tasks. No
 * summary writes a record with no tasks.
 *
 * **Example** (Inspect the writer)
 *
 * ```ts
 * import { writeTaskOutcomes } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof writeTaskOutcomes) // "function"
 * ```
 *
 * @param job - The job's name as GitHub lists it.
 * @param out - Where to write the record.
 * @returns The record it wrote.
 * @category use-cases
 * @since 0.0.0
 */
export const writeTaskOutcomes = Effect.fn("CiTaskOutcomes.write")(function* (job: string, out: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));
  const runs = path.join(repoRoot, ".turbo", "runs");
  const present = yield* fs.exists(runs).pipe(CiCommandError.mapError("Failed to stat .turbo/runs."));
  const names = present
    ? yield* fs.readDirectory(runs).pipe(CiCommandError.mapError("Failed to list .turbo/runs."))
    : A.empty<string>();
  const summaries = yield* Effect.forEach(
    A.sort(A.filter(names, Str.endsWith(".json")), Order.String),
    Effect.fnUntraced(function* (name) {
      const text = yield* fs
        .readFileString(path.join(runs, name))
        .pipe(CiCommandError.mapError(`Failed to read .turbo/runs/${name}.`));
      return yield* decodeSummary(text).pipe(
        CiCommandError.mapError(`.turbo/runs/${name} is not a Turbo run summary.`)
      );
    }),
    { concurrency: 1 }
  );
  const identity = yield* RunIdentity.pipe(CiCommandError.mapError("Failed to read the run identity."));
  const record = TaskOutcomeRecord.make({
    schemaVersion: "task-outcomes/v1",
    job,
    runId: identity.runId,
    runAttempt: identity.runAttempt,
    tasks: taskOutcomesOf(summaries),
  });
  const target = path.resolve(repoRoot, out);
  const text = yield* encodeTaskOutcomeRecord(record).pipe(CiCommandError.mapError("Failed to encode the record."));
  yield* fs
    .makeDirectory(path.dirname(target), { recursive: true })
    .pipe(Effect.andThen(fs.writeFileString(target, `${text}\n`)), CiCommandError.mapError(`Failed to write ${out}.`));
  const failed = A.length(A.filter(record.tasks, (task) => RouteTaskOutcome.is.fail(task.outcome)));
  yield* Console.log(
    `[ci] task outcomes for ${job}: ${A.length(record.tasks)} task(s) from ${A.length(summaries)} summary file(s), ${failed} failed; wrote ${path.relative(repoRoot, target)}.`
  );
  return record;
});

/**
 * `beep ci task-outcomes --job-name <name> --out <file>`.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciTaskOutcomesCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof ciTaskOutcomesCommand) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciTaskOutcomesCommand = Command.make(
  "task-outcomes",
  {
    jobName: Flag.String("job-name").pipe(Flag.withDescription("The job's name as GitHub lists it")),
    out: Flag.String("out").pipe(Flag.withDescription("Where to write the task-outcomes/v1 record")),
  },
  ({ jobName, out }) =>
    writeTaskOutcomes(jobName, out).pipe(Effect.asVoid, Effect.catchTag("CiCommandError", reportCiCommandError))
).pipe(Command.withDescription("Record one {task, outcome} row per Turbo task this job ran, from its run summaries"));
