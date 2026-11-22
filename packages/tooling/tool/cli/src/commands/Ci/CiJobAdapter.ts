/**
 * The CI-job adapter: a workflow run read as a gate report, from
 * `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs` alone.
 *
 * **Details**
 *
 * The run is the gate (`run`), each job a unit, each step an item. Step
 * conclusions map onto the closed outcome set: `success` passed, `failure`
 * failed, `skipped` and `neutral` skipped, `timed_out` a failure counted as
 * timed out, `cancelled` a failure counted as unhandled (the runner stopped
 * the step; the model has no cancel kind), and any other conclusion a plain
 * failure. A step with no conclusion has not finished and reads as skipped. A
 * job with no steps, or a red job with no failed step, gets one fault item, so
 * it never reads as green. A failed step's detail is the text the caller
 * supplies for its job: the job's uploaded gate-report verdict, else its
 * isolated failing region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { classifyOutcome, failureCount, tally } from "@beep/gate-report/Classify";
import { GateReport, Unit } from "@beep/gate-report/GateReport";
import { Item, ItemDetail } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { Text } from "@beep/gate-report/Scalars";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { FailureKind, ItemOutcome } from "@beep/gate-report/Vocabulary";

const $I = $RepoCliId.create("commands/Ci/CiJobAdapter");

/**
 * The gate name a workflow run is recorded under.
 *
 * **Example** (Name a run's gate)
 *
 * ```ts
 * import { CI_RUN_GATE } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_RUN_GATE) // "run"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_RUN_GATE = "run";

/**
 * One step of a job, as the REST job list returns it.
 *
 * **Example** (A failed step)
 *
 * ```ts
 * import { CiRunStep } from "@beep/repo-cli/commands/Ci"
 *
 * const step = CiRunStep.make({ name: "Run lane", status: "completed", conclusion: "failure", number: 4 })
 * console.log(step.conclusion) // "failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunStep extends S.Opaque<CiRunStep, { readonly brand: unique symbol }>()(
  S.Struct({
    name: Text,
    status: S.String,
    conclusion: S.NullOr(S.String),
    number: S.Int,
  }).pipe($I.annoteSchema("CiRunStep", { description: "One step of a workflow job, as the REST job list returns it." }))
) {}

/**
 * One job of a workflow run, as the REST job list returns it.
 *
 * **Details**
 *
 * `steps` is absent or `null` for a job the runner never started; both read
 * as no steps.
 *
 * **Example** (A job with no steps)
 *
 * ```ts
 * import { CiRunJob } from "@beep/repo-cli/commands/Ci"
 *
 * const job = CiRunJob.make({ id: 7, name: "Lint", status: "completed", conclusion: "cancelled", steps: null })
 * console.log(job.steps) // null
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunJob extends S.Opaque<CiRunJob, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int,
    name: Text,
    status: S.String,
    conclusion: S.NullOr(S.String),
    steps: S.Array(CiRunStep).pipe(S.NullOr, S.optionalKey),
  }).pipe($I.annoteSchema("CiRunJob", { description: "One job of a workflow run, as the REST job list returns it." }))
) {}

/**
 * The run a report is built for: its id, attempt, workflow name, head and
 * branch, and when it was created.
 *
 * **Example** (Name a run)
 *
 * ```ts
 * import { CiRunView } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const run = CiRunView.make({
 *   id: 9, attempt: 1, workflow: "Check", headSha: "abc", branch: O.some("main"), createdAt: "2026-11-22T00:00:00Z",
 * })
 * console.log(run.workflow) // "Check"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunView extends S.Opaque<CiRunView, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int,
    attempt: S.Int,
    workflow: Text,
    headSha: Text,
    branch: S.OptionFromOptionalKey(Text),
    createdAt: S.String,
  }).pipe(
    $I.annoteSchema("CiRunView", { description: "A workflow run's id, attempt, workflow, head, branch and creation." })
  )
) {}

/**
 * What the adapter reads: a run, its jobs, and the failure detail of the
 * jobs that have one, keyed by job id.
 *
 * **Example** (A run with no jobs)
 *
 * ```ts
 * import { CiRunGateInput, CiRunView } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const run = CiRunView.make({
 *   id: 9,
 *   attempt: 1,
 *   workflow: "Check",
 *   headSha: "4e3343774cc",
 *   branch: O.none(),
 *   createdAt: "2026-11-22T10:00:00Z",
 * })
 * console.log(CiRunGateInput.make({ run, jobs: [] }).jobs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunGateInput extends S.Opaque<CiRunGateInput, { readonly brand: unique symbol }>()(
  S.Struct({
    run: CiRunView,
    jobs: S.Array(CiRunJob),
    details: S.HashMap(S.Int, S.String).pipe(S.withConstructorDefault(Effect.succeed(HashMap.empty<number, string>()))),
  }).pipe(
    $I.annoteSchema("CiRunGateInput", {
      description: "A workflow run, its jobs, and the failure detail of each job that has one.",
    })
  )
) {}

/**
 * One workflow run, as `GET /actions/runs/{run_id}` and the run listings
 * return it.
 *
 * **Example** (A listed run)
 *
 * ```ts
 * import { CiWorkflowRun } from "@beep/repo-cli/commands/Ci"
 *
 * const run = CiWorkflowRun.make({
 *   id: 9,
 *   name: "Check",
 *   workflow_id: 1,
 *   head_sha: "4e3343774cc",
 *   head_branch: "main",
 *   status: "completed",
 *   conclusion: "failure",
 *   created_at: "2026-11-22T10:00:00Z",
 * })
 * console.log(run.conclusion) // "failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiWorkflowRun extends S.Opaque<CiWorkflowRun, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int,
    name: S.NullOr(S.String),
    workflow_id: S.Int,
    head_sha: S.String,
    head_branch: S.NullOr(S.String),
    status: S.NullOr(S.String),
    conclusion: S.NullOr(S.String),
    created_at: S.String,
    run_attempt: S.optionalKey(S.Int),
  }).pipe($I.annoteSchema("CiWorkflowRun", { description: "One workflow run as the REST run endpoints return it." }))
) {}

/**
 * One page of a workflow run listing.
 *
 * **Example** (An empty page)
 *
 * ```ts
 * import { CiWorkflowRunsPage } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiWorkflowRunsPage.make({ workflow_runs: [] }).workflow_runs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiWorkflowRunsPage extends S.Opaque<CiWorkflowRunsPage, { readonly brand: unique symbol }>()(
  S.Struct({ workflow_runs: S.Array(CiWorkflowRun) }).pipe(
    $I.annoteSchema("CiWorkflowRunsPage", { description: "One page of a workflow run listing." })
  )
) {}

type StepReading = { readonly outcome: ItemOutcome; readonly failureKind: O.Option<FailureKind> };

const passed: StepReading = { outcome: "passed", failureKind: O.none() };
const skipped: StepReading = { outcome: "skipped", failureKind: O.none() };
const failed: StepReading = { outcome: "failed", failureKind: O.none() };

const STEP_READINGS: Readonly<Record<string, StepReading>> = {
  success: passed,
  failure: failed,
  skipped,
  neutral: skipped,
  timed_out: { outcome: "failed", failureKind: O.some("timeout") },
  cancelled: { outcome: "failed", failureKind: O.some("unhandled") },
};

const RED_JOB_CONCLUSIONS = ["failure", "timed_out", "cancelled"];

/**
 * Whether a job concluded red: `failure`, `timed_out` or `cancelled`.
 *
 * **Example** (A cancelled job is red)
 *
 * ```ts
 * import { CiRunJob, ciJobIsRed } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciJobIsRed(CiRunJob.make({ id: 7, name: "Lint", status: "completed", conclusion: "cancelled" }))) // true
 * ```
 *
 * @param job - A job from the run's jobs listing, steps optional.
 * @returns Whether it concluded red.
 * @category predicates
 * @since 0.0.0
 */
export const ciJobIsRed = (job: CiRunJob): boolean => O.isSome(redConclusion(job));

const redConclusion = (job: CiRunJob): O.Option<string> =>
  O.filter(O.fromNullishOr(job.conclusion), (conclusion) => A.contains(RED_JOB_CONCLUSIONS, conclusion));

const readingOf = (conclusion: string): StepReading => O.getOrElse(R.get(STEP_READINGS, conclusion), () => failed);

const detailOf = (detail: O.Option<string>, fallback: string): O.Option<ItemDetail> =>
  ItemDetail.makeOption({ message: O.getOrElse(detail, () => fallback) });

const stepItem =
  (job: CiRunJob, detail: O.Option<string>) =>
  (step: CiRunStep): Item => {
    const conclusion = O.fromNullishOr(step.conclusion);
    const reading = O.match(conclusion, { onNone: () => skipped, onSome: readingOf });
    return Item.make({
      key: ItemKey.cases.TestKey.make({ file: job.name, fullName: step.name }),
      unit: job.name,
      path: [],
      name: step.name,
      outcome: reading.outcome,
      failureKind: reading.failureKind,
      detail: O.flatMap(
        O.filter(conclusion, () => reading.outcome === "failed"),
        (failedAs) => detailOf(detail, `step ${failedAs}`)
      ),
    });
  };

const jobFault = (job: CiRunJob, detail: O.Option<string>, message: string): Item =>
  Item.make({
    key: ItemKey.cases.FaultKey.make({ unit: job.name, kind: "unhandled", name: "job" }),
    unit: job.name,
    path: [],
    name: "job",
    outcome: "failed",
    detail: detailOf(detail, message),
  });

const jobItems = (job: CiRunJob, detail: O.Option<string>): ReadonlyArray<Item> => {
  const steps = A.map(job.steps ?? [], stepItem(job, detail));
  if (A.isReadonlyArrayEmpty(steps)) {
    return [jobFault(job, detail, `job ${job.conclusion ?? job.status} with no steps`)];
  }
  const anyFailed = A.some(steps, (item) => item.outcome === "failed");
  return O.match(
    O.filter(redConclusion(job), () => !anyFailed),
    {
      onNone: () => steps,
      onSome: (conclusion) => A.append(steps, jobFault(job, detail, `job ${conclusion} with no failed step`)),
    }
  );
};

/**
 * Read a workflow run as a gate report.
 *
 * **Example** (One failed step)
 *
 * ```ts
 * import { CiRunGateInput, CiRunJob, CiRunStep, CiRunView, ciRunGateReport } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const report = ciRunGateReport(
 *   CiRunGateInput.make({
 *     run: CiRunView.make({ id: 9, attempt: 1, workflow: "Check", headSha: "abc", branch: O.none(), createdAt: "2026-11-22T00:00:00Z" }),
 *     jobs: [
 *       CiRunJob.make({
 *         id: 7, name: "Lint", status: "completed", conclusion: "failure",
 *         steps: [CiRunStep.make({ name: "Run lane", status: "completed", conclusion: "failure", number: 1 })],
 *       }),
 *     ],
 *   })
 * )
 * console.log(report.totals.failed) // 1
 * ```
 *
 * @param input - The run, its jobs and their failure details.
 * @returns The run's gate report: gate `run`, one unit per job, one item per step.
 * @category use-cases
 * @since 0.0.0
 */
export const ciRunGateReport = (input: CiRunGateInput): GateReport => {
  const items = A.flatMap(input.jobs, (job) => jobItems(job, HashMap.get(input.details, job.id)));
  const totals = tally({ items, collected: items.length, durationMs: 0 });
  const reason = failureCount(totals) > 0 ? "failed" : "passed";
  return GateReport.make({
    gate: CI_RUN_GATE,
    subject: `${input.run.workflow} #${input.run.id}`,
    itemKind: "step",
    runId: `${input.run.id}-${input.run.attempt}`,
    startedAt: pipe(
      DateTime.make(input.run.createdAt),
      O.getOrElse(() => DateTime.makeUnsafe(0)),
      DateTime.toUtc
    ),
    durationMs: 0,
    inputFingerprint: input.run.headSha,
    head: O.some(input.run.headSha),
    branch: input.run.branch,
    reason,
    outcome: classifyOutcome({ reason, totals, policy: O.none() }),
    units: A.map(input.jobs, (job) => Unit.make({ id: job.name, kind: "job" })),
    items,
    totals,
  });
};
