/**
 * Per-task outcome records of a hosted lane job (`beep ci task-outcomes`, ROUT-05 slice 2b).
 *
 * **Details**
 *
 * A lane job runs its Turbo tasks with `--summarize`, which leaves one run
 * summary per Turbo invocation under `.turbo/runs/`. After the lane step,
 * the job writes one `task-outcomes/v2` record naming the job as GitHub lists
 * it, one `{task, outcome}` row per Turbo task from those summaries and one
 * feed entry per gate record the job wrote, and uploads it, with those gate
 * records and logs, as `task-outcomes-<run>-<attempt>-<job>-<key>`. The route
 * corpus capture reads those artifacts (`task-outcomes/v1` or `v2`) for a run
 * with a failed job and fills `HostedJob.tasks` from them, so the replay can
 * tell a failed task from a failed setup step.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GateReport } from "@beep/gate-report/GateReport";
import { Text } from "@beep/gate-report/Scalars";
import { $RepoCliId } from "@beep/identity/packages";
import { writeArtifact } from "@beep/repo-cli-kit/artifacts/ArtifactIo";
import { GateName, RecordTarget, RepoRelativeDir, recordLocation } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
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
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { storedLogBytes } from "../Gate/GateRuntime.ts";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import { findJobGateRecordTargets } from "./CiGateRecordSearch.ts";
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

/**
 * One gate record a hosted job wrote, as an index into the job's task-outcome
 * artifact.
 *
 * **Details**
 *
 * `record` and `log` are the repository-relative paths the gate wrote
 * (`<package>/.beep/gates/<gate>/report.json` and `report.log`, or a root
 * run's `.beep/gates/<gate>/<run-id>.json` and `.log`); the artifact carries
 * both files at those paths. The entry holds no verdict and no counts: those
 * stay in the `gate-report/v1` record it points to, so no fact is stored
 * twice.
 *
 * **Example** (Point at a package record)
 *
 * ```ts
 * import { GateFeedEntry } from "@beep/repo-cli/commands/Ci"
 *
 * const entry = GateFeedEntry.make({
 *   gate: "test",
 *   subject: "@beep/glob",
 *   record: "packages/foundation/primitive/glob/.beep/gates/test/report.json",
 *   log: "packages/foundation/primitive/glob/.beep/gates/test/report.log",
 * })
 * console.log(entry.gate) // "test"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateFeedEntry extends S.Opaque<GateFeedEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: GateName,
    subject: Text,
    record: RepoRelativeDir,
    log: RepoRelativeDir,
  }).pipe(
    $I.annoteSchema("GateFeedEntry", {
      description:
        "One gate record a hosted job wrote: its gate, subject and repository-relative record and log paths.",
    })
  )
) {}

/**
 * **Details**
 *
 * The `task-outcomes/v2` record widens {@link TaskOutcomeRecord} with
 * `reports`, one {@link GateFeedEntry} per gate record the job wrote, sorted
 * by record path. It is the main feed's record (decision `report-carrier`).
 *
 * **Example** (A record with one gate report)
 *
 * ```ts
 * import { GateFeedEntry, TaskOutcomeRecordV2 } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const record = TaskOutcomeRecordV2.make({
 *   schemaVersion: "task-outcomes/v2",
 *   job: "Test Unit (unit-a)",
 *   runId: O.some(1),
 *   runAttempt: O.some(1),
 *   tasks: [],
 *   reports: [
 *     GateFeedEntry.make({
 *       gate: "test",
 *       subject: "@beep/glob",
 *       record: "packages/glob/.beep/gates/test/report.json",
 *       log: "packages/glob/.beep/gates/test/report.log",
 *     }),
 *   ],
 * })
 * console.log(record.reports.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskOutcomeRecordV2 extends S.Opaque<TaskOutcomeRecordV2, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("task-outcomes/v2"),
    job: S.NonEmptyString,
    runId: S.OptionFromOptionalKey(S.Int),
    runAttempt: S.OptionFromOptionalKey(S.Int),
    tasks: S.Array(HostedTaskOutcome),
    reports: S.Array(GateFeedEntry),
  }).pipe(
    $I.annoteSchema("TaskOutcomeRecordV2", {
      description: "One hosted job's Turbo task outcomes and the gate records it wrote, keyed by the job's name.",
    })
  )
) {}

/**
 * A task-outcome record of either version, as a reader finds it in an
 * artifact.
 *
 * **Details**
 *
 * Readers decode `task-outcomes/v1 | v2` while v1 artifacts are inside their
 * 30-day retention, then v1 is dropped. Both versions carry `job` and
 * `tasks`.
 *
 * **Example** (Read a v1 record)
 *
 * ```ts
 * import { AnyTaskOutcomeRecord } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const read = S.decodeUnknownEffect(S.fromJsonString(AnyTaskOutcomeRecord))
 * Effect.runPromise(read('{"schemaVersion":"task-outcomes/v1","job":"Labs","tasks":[]}')).then((record) =>
 *   console.log(record.schemaVersion) // "task-outcomes/v1"
 * )
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AnyTaskOutcomeRecord = S.Union([TaskOutcomeRecord, TaskOutcomeRecordV2]).pipe(
  S.toTaggedUnion("schemaVersion"),
  $I.annoteSchema("AnyTaskOutcomeRecord", {
    description: "A task-outcomes/v1 or task-outcomes/v2 record, as a reader finds it in an artifact.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type AnyTaskOutcomeRecord = typeof AnyTaskOutcomeRecord.Type;

/**
 * One gate record found in a job's checkout: whose record it is, its report,
 * and its raw log's size when the log is there.
 *
 * **Example** (A found package record)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport"
 * import { JobGateRecord } from "@beep/repo-cli/commands/Ci"
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({}),
 * })
 * const found = JobGateRecord.make({
 *   target: RecordTarget.cases.PackageTarget.make({ packageDir: "packages/glob", gate: "test" }),
 *   report,
 *   logBytes: O.some(12),
 * })
 * console.log(found.target._tag) // "PackageTarget"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JobGateRecord extends S.Opaque<JobGateRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    target: RecordTarget,
    report: GateReport,
    logBytes: S.OptionFromOptionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0))),
  }).pipe(
    $I.annoteSchema("JobGateRecord", {
      description: "A gate record found in a job's checkout: its target, its report and its raw log's size.",
    })
  )
) {}

/**
 * The feed entry of a found gate record.
 *
 * **Example** (Index a found record)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport"
 * import { JobGateRecord, gateFeedEntryOf } from "@beep/repo-cli/commands/Ci"
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({}),
 * })
 * const target = RecordTarget.cases.PackageTarget.make({ packageDir: "packages/glob", gate: "test" })
 * console.log(gateFeedEntryOf(JobGateRecord.make({ target, report, logBytes: O.none() })).record)
 * // "packages/glob/.beep/gates/test/report.json"
 * ```
 *
 * @param found - A gate record found in the job's checkout.
 * @returns Its gate, subject, and record and log paths.
 * @category utilities
 * @since 0.0.0
 */
export const gateFeedEntryOf = (found: JobGateRecord): GateFeedEntry => {
  const location = recordLocation(found.target);
  return GateFeedEntry.make({
    gate: found.target.gate,
    subject: found.report.subject,
    record: location.record,
    log: location.log,
  });
};

/**
 * Find every gate record a job's checkout holds and read it.
 *
 * **Details**
 *
 * The records are those {@link findJobGateRecordTargets} finds, sorted by
 * record path. A record that does not decode as `gate-report/v1` fails the
 * read, so the feed never silently drops a report; a missing raw log leaves
 * `logBytes` empty.
 *
 * **Example** (Inspect the reader)
 *
 * ```ts
 * import { findJobGateRecords } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof findJobGateRecords) // "function"
 * ```
 *
 * @param repoRoot - The job's checkout.
 * @returns The gate records found there.
 * @category use-cases
 * @since 0.0.0
 */
export const findJobGateRecords = Effect.fn("CiTaskOutcomes.findJobGateRecords")(function* (repoRoot: string) {
  const targets = yield* findJobGateRecordTargets(repoRoot);
  const store = yield* GateRecordStore.make(repoRoot);
  return yield* Effect.forEach(
    targets,
    Effect.fnUntraced(function* (target) {
      const location = recordLocation(target);
      const record = yield* store
        .readRecord(target)
        .pipe(CiCommandError.mapError(`${location.record} is not a readable gate-report/v1 record.`));
      const logBytes = yield* storedLogBytes(repoRoot, target);
      return JobGateRecord.make({ target, report: record.report, logBytes });
    }),
    { concurrency: 1 }
  );
});

const encodeTaskOutcomeRecord = S.encodeEffect(S.fromJsonString(TaskOutcomeRecordV2));

const SummaryTask = S.Struct({
  taskId: S.NonEmptyString,
  execution: S.optionalKey(S.Struct({ exitCode: S.Finite.pipe(S.NullOr, S.optionalKey) })),
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
  Match.value(task.execution?.exitCode).pipe(
    Match.when(Match.undefined, () => RouteTaskOutcome.Enum["not-run"]),
    Match.when(Match.null, () => RouteTaskOutcome.Enum.unknown),
    Match.when(0, () => RouteTaskOutcome.Enum.pass),
    Match.orElse(() => RouteTaskOutcome.Enum.fail)
  );

const OUTCOME_RANK: Readonly<Record<RouteTaskOutcome, number>> = { fail: 3, unknown: 2, pass: 1, "not-run": 0 };

/**
 * One `{task, outcome}` row per Turbo task across a job's run summaries.
 *
 * **Details**
 *
 * Exit code 0 (a run or a cache replay) is `pass`, any other exit code is
 * `fail`, a task with no exit code (planned, never executed) is `not-run`,
 * and a task Turbo wrote with `exitCode: null` (killed, or failed with no
 * code) is `unknown`. A task several summaries list keeps `fail` over
 * `unknown` over `pass` over `not-run`, so a task that passed and was later
 * killed stays `unknown`. Rows sort by task id.
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
 * summary writes a record with no tasks. The record is `task-outcomes/v2`:
 * its `reports` index every gate record {@link findJobGateRecords} finds in
 * the checkout, and a gate record that does not decode fails the command too.
 *
 * **Example** (Inspect the writer)
 *
 * ```ts
 * import { writeTaskOutcomes } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof writeTaskOutcomes) // "function"
 * ```
 *
 * @param repoRoot - The job's checkout, whose `.turbo/runs/` is read; `out` resolves against it.
 * @param job - The job's name as GitHub lists it.
 * @param out - Where to write the record.
 * @returns The record it wrote.
 * @category use-cases
 * @since 0.0.0
 */
export const writeTaskOutcomes = Effect.fn("CiTaskOutcomes.write")(function* (
  repoRoot: string,
  job: string,
  out: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
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
  const gateRecords = yield* findJobGateRecords(repoRoot);
  const record = TaskOutcomeRecordV2.make({
    schemaVersion: "task-outcomes/v2",
    job,
    runId: identity.runId,
    runAttempt: identity.runAttempt,
    tasks: taskOutcomesOf(summaries),
    reports: A.map(gateRecords, gateFeedEntryOf),
  });
  const target = path.resolve(repoRoot, out);
  const text = yield* encodeTaskOutcomeRecord(record).pipe(CiCommandError.mapError("Failed to encode the record."));
  yield* writeArtifact({ path: target, body: `${text}\n`, onError: CiCommandError.new(`Failed to write ${out}.`) });
  const failed = A.length(A.filter(record.tasks, (task) => RouteTaskOutcome.is.fail(task.outcome)));
  yield* Console.log(
    `[ci] task outcomes for ${job}: ${A.length(record.tasks)} task(s) from ${A.length(summaries)} summary file(s), ${failed} failed, ${A.length(record.reports)} gate report(s); wrote ${path.relative(repoRoot, target)}.`
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
    out: Flag.String("out").pipe(Flag.withDescription("Where to write the task-outcomes/v2 record")),
  },
  ({ jobName, out }) =>
    findRepoRoot().pipe(
      CiCommandError.mapError("Failed to locate repository root."),
      Effect.flatMap((repoRoot) => writeTaskOutcomes(repoRoot, jobName, out)),
      Effect.asVoid,
      Effect.catchTag("CiCommandError", reportCiCommandError)
    )
).pipe(Command.withDescription("Record one {task, outcome} row per Turbo task this job ran, from its run summaries"));
