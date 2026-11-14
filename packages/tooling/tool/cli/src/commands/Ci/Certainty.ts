/**
 * `beep ci certainty`: the head-level push-to-every-required-green scorecard.
 *
 * **Details**
 *
 * The statistic is the one the operator ruled (ten-minute-certainty D2, D5):
 * on pull-request runs, p95 time from the first push of a head SHA to every
 * required context green, over code heads, with red, held, cancelled and
 * api-partial heads counted as not attained and superseded or still-open heads
 * censored. It is reported beside, never summed with, runner-minutes per run
 * and the main verdict rate; the green-only p95 is a diagnostic.
 *
 * The reader composes the existing hosted reads: workflow-run listings and the
 * per-attempt jobs read from `LaneTimings.ts`, the required contexts from
 * `standards/branch-protection-contexts.json`, and local `git` for main's
 * first-parent commits and their documentation-only class. Every capture is a
 * {@link CiCertaintyCorpus}, so a live run and a fixture replay go through the
 * same fold, and `--write-corpus` keeps a report recomputable from its inputs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { nearestRank } from "@beep/repo-cli-kit/stats/NearestRank";
import { findRepoRoot } from "@beep/repo-utils";
import { A, O, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { sha256Hex } from "../Goals/PacketCore/PacketDigest.ts";
import {
  CiCertaintyAdmissionStat,
  CiCertaintyContextRow,
  CiCertaintyCorpus,
  CiCertaintyHeadRow,
  CiCertaintyLatencyStat,
  CiCertaintyMainCommit,
  CiCertaintyMainRow,
  CiCertaintyMainStat,
  CiCertaintyReport,
  CiCertaintyRun,
  CiCertaintyRunnerMinutes,
  CiCertaintyRunnerStat,
  CiCertaintyTestUnitConversion,
} from "./Certainty.schemas.ts";
import { CiCommandError } from "./Ci.errors.ts";
import {
  CiSupportJobName,
  ciLaneDescriptor,
  ciLaneReportingNames,
  ciLaneShardJobPrefix,
  HEAVY_CONTEXT_PREFIX,
} from "./CiLaneJobs.ts";
import { CI_LANE_PARTITIONS } from "./CiLanePartitions.ts";
import { isHeavyDocsOnlyPath } from "./CiOperational.schemas.ts";
import {
  CiLaneTimingGithubClient,
  CiLaneTimingWindowOptions,
  ciRunnerClassForLabels,
  collectCiWorkflowRunAttemptJobs,
  collectCiWorkflowWindowRuns,
  makeCiLaneTimingGithubClient,
  withCiGithub,
} from "./LaneTimings.ts";
import type * as Digest from "effect/crypto/Digest";
import type {
  CiCertaintyCensorReason,
  CiCertaintyContextState,
  CiCertaintyHeadClass,
  CiCertaintyHeadState,
  CiCertaintyMainVerdict,
  CiCertaintyPercentileStatus,
  CiCertaintyProducer,
  CiCertaintyRefusal,
} from "./Certainty.schemas.ts";
import type { CiLaneId } from "./CiLane.ts";
import type { CiWorkflowJob, CiWorkflowPartialRead, CiWorkflowWindowRun } from "./LaneTimings.ts";

const $I = $RepoCliId.create("commands/Ci/Certainty");

/**
 * The clock every head latency is measured from.
 *
 * **Details**
 *
 * GitHub rewrites a run's `run_started_at` on re-dispatch (see
 * `LaneTimings.ts`), so T0 is the `created_at` of the head's first check.yml
 * pull_request run. Incident-time rewrites of `created_at` bias the statistic
 * low; the report records this source so a reader can judge that bias.
 *
 * **Example** (Print the clock source)
 *
 * ```ts
 * import { CI_CERTAINTY_CLOCK_SOURCE } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_CERTAINTY_CLOCK_SOURCE)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_CERTAINTY_CLOCK_SOURCE = "created_at of the head's first check.yml pull_request run";

/**
 * What the scorecard does not measure.
 *
 * **Example** (Count the not-covered rows)
 *
 * ```ts
 * import { CI_CERTAINTY_NOT_COVERED } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_CERTAINTY_NOT_COVERED.length > 0)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_CERTAINTY_NOT_COVERED: ReadonlyArray<string> = [
  "Vercel deployment statuses",
  "per-task hosted Turbo durations",
  "the hosted concurrent-job ceiling (no admin read)",
  "agent seats as admission demand",
  "fleet hosts and T3 lanes (no local attempt journal is read in this report)",
  "local publish and verify figures (censored until journal retention lands)",
  "Test Integration partition setup versus body, and its 1,395-1,551 s outlier legs",
  "Property Laws nightly verdicts (property-laws-nightly.yml)",
  "runs the compute-profile refusal routed to hosted",
  "the Yeet review window (push to Yeet-mergeable counts contexts only)",
  "the main run cancel actor and heavy-queue pickup p95 (later slices)",
];

const PRODUCER_CHECK: CiCertaintyProducer = "check.yml";
const PRODUCER_HEAVY_ADMIT: CiCertaintyProducer = "heavy-admit.yml";
const TEN_MINUTES = 10;
const HEAVY_ADMISSION_JOB = CiSupportJobName.Enum["Heavy Admission"];
const DOCS_ADMISSION_STEP = "Satisfy documentation-only admission";
const DOCS_POLICY_JOB = ciLaneDescriptor("docs-policy").contextName;
const TEST_PLAN_JOB = CiSupportJobName.Enum["Test Plan"];
const TEST_UNIT_PARTITION_PREFIX = ciLaneShardJobPrefix("test-unit");
const COVERAGE_CONTEXTS = ciLaneReportingNames("coverage");
// Yeet-mergeable adds these lanes' contexts to the required set (D5); Coverage Regression keeps its conditional
// name.
const MERGEABLE_EXTRA_LANES: ReadonlyArray<CiLaneId> = ["lint-policy", "property", "fallow", "coverage"];
const MERGEABLE_EXTRA_CONTEXTS: ReadonlyArray<ReadonlyArray<string>> = A.map(
  MERGEABLE_EXTRA_LANES,
  ciLaneReportingNames
);
const GREEN_CONCLUSIONS = HashSet.make("success", "skipped", "neutral");
const TEST_UNIT_FULL_LAYOUT_JOBS = A.length(
  A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "test-unit")
);

const epochMillis = (iso: string | null): O.Option<number> =>
  pipe(
    O.fromNullishOr(iso),
    O.flatMap((value) => DateTime.make(value)),
    O.map(DateTime.toEpochMillis)
  );

const minutesBetween = (fromMillis: number, toMillis: number): number =>
  Math.round((Math.max(0, toMillis - fromMillis) / 60_000) * 100) / 100;

const roundMinutes = (minutes: number): number => Math.round(minutes * 100) / 100;

/** One job with the workflow that produced it. */
interface ProducedJob {
  readonly job: CiWorkflowJob;
  readonly producer: CiCertaintyProducer;
}

const jobStartMillis = (produced: ProducedJob): number =>
  O.getOrElse(
    O.orElse(epochMillis(produced.job.started_at), () => epochMillis(produced.job.created_at)),
    () => 0
  );

// Latest start wins; a rerun copy shares its original's start, so the higher attempt then the higher id breaks ties.
const latestJobOrder: Order.Order<ProducedJob> = Order.combineAll([
  Order.mapInput(Order.Number, jobStartMillis),
  Order.mapInput(Order.Number, (produced: ProducedJob) => produced.job.run_attempt),
  Order.mapInput(Order.Number, (produced: ProducedJob) => produced.job.id),
]);

const latestJobNamed = (jobs: ReadonlyArray<ProducedJob>, names: ReadonlyArray<string>): O.Option<ProducedJob> =>
  pipe(
    A.filter(jobs, (produced) => A.contains(names, produced.job.name)),
    A.match({ onEmpty: O.none, onNonEmpty: (matching) => O.some(A.max(matching, latestJobOrder)) })
  );

const jobContextState = (job: CiWorkflowJob): CiCertaintyContextState => {
  if (!Str.equivalence(job.status, "completed")) {
    return "pending";
  }
  const conclusion = job.conclusion ?? "";
  if (HashSet.has(GREEN_CONCLUSIONS, conclusion)) {
    return "green";
  }
  return Str.equivalence(conclusion, "cancelled") ? "cancelled" : "red";
};

const contextRow = (jobs: ReadonlyArray<ProducedJob>, names: ReadonlyArray<string>): CiCertaintyContextRow =>
  O.match(latestJobNamed(jobs, names), {
    onNone: () =>
      CiCertaintyContextRow.make({
        context: A.headNonEmpty(names as A.NonEmptyReadonlyArray<string>),
        producer: O.none(),
        runAttempt: O.none(),
        runId: O.none(),
        state: "missing",
      }),
    onSome: (produced) =>
      CiCertaintyContextRow.make({
        context: produced.job.name,
        producer: O.some(produced.producer),
        runAttempt: O.some(produced.job.run_attempt),
        runId: O.some(produced.job.run_id),
        state: jobContextState(produced.job),
      }),
  });

const headStateOf = (
  contexts: ReadonlyArray<CiCertaintyContextRow>,
  partial: boolean,
  runsComplete: boolean
): CiCertaintyHeadState => {
  const has = (state: CiCertaintyContextState) => A.some(contexts, (row) => Str.equivalence(row.state, state));
  if (partial) {
    return "api-partial";
  }
  if (has("pending") || (has("missing") && !runsComplete)) {
    return "open";
  }
  if (has("red")) {
    return "red";
  }
  if (has("cancelled")) {
    return "cancelled";
  }
  return has("missing") ? "held" : "green";
};

const completedMillis = (job: CiWorkflowJob): O.Option<number> => epochMillis(job.completed_at);

// Green because the job ran, not because it was skipped.
const ranGreen = (job: CiWorkflowJob): boolean =>
  Str.equivalence(jobContextState(job), "green") && job.conclusion !== "skipped";

// A later label on a proven head makes heavy-admit.yml re-report the proof: heavy.yml called with
// `admitted: false` reports every `Heavy / <lane>` skipped. That copy is not the lane's completion
// while an earlier job of the same name ran green on the head, so it never moves the green instant.
const isReReport =
  (jobs: ReadonlyArray<ProducedJob>) =>
  (produced: ProducedJob): boolean =>
    Str.equivalence(produced.producer, PRODUCER_HEAVY_ADMIT) &&
    Str.startsWith(HEAVY_CONTEXT_PREFIX)(produced.job.name) &&
    produced.job.conclusion === "skipped" &&
    A.some(
      jobs,
      (earlier) =>
        Str.equivalence(earlier.job.name, produced.job.name) &&
        ranGreen(earlier.job) &&
        Order.isLessThan(latestJobOrder)(earlier, produced)
    );

// Every context group is green, and the latest job of each one finished: the instant the last one did.
const groupsGreenAt = (
  jobs: ReadonlyArray<ProducedJob>,
  groups: ReadonlyArray<ReadonlyArray<string>>
): O.Option<{ readonly at: number; readonly context: string }> => {
  const latest = A.map(groups, (names) => latestJobNamed(jobs, names));
  const allGreen = A.every(latest, (produced) =>
    O.exists(produced, (found) => Str.equivalence(jobContextState(found.job), "green"))
  );
  if (!allGreen) {
    return O.none();
  }
  const finishes = A.getSomes(
    A.map(A.getSomes(latest), (produced) =>
      O.map(completedMillis(produced.job), (at) => ({ at, context: produced.job.name }))
    )
  );
  return A.match(finishes, {
    onEmpty: O.none,
    onNonEmpty: (values) =>
      O.some(
        A.max(
          values,
          Order.mapInput(Order.Number, (value: { readonly at: number }) => value.at)
        )
      ),
  });
};

/**
 * Raw runner-minutes of one run's jobs, with rerun copies counted once.
 *
 * **Details**
 *
 * A rerun attempt lists the jobs it did not re-execute again, carrying the
 * original job's name and timestamps under the new `run_attempt`. Summing the
 * per-attempt union naively would bill those jobs twice, so jobs are
 * de-duplicated by `(name, started_at, completed_at)` within the run. Skipped
 * jobs report a completion before their start and contribute zero.
 *
 * **Example** (Count a rerun copy once)
 *
 * ```ts
 * import { CiWorkflowJob, ciCertaintyRunnerMinutes } from "@beep/repo-cli/commands/Ci"
 *
 * const job = (run_attempt: number, id: number) =>
 *   CiWorkflowJob.make({
 *     completed_at: "2026-11-09T16:33:13Z",
 *     conclusion: "success",
 *     created_at: "2026-11-09T16:32:00Z",
 *     id,
 *     labels: ["beep-ec2-heavy"],
 *     name: "Heavy / Check",
 *     run_attempt,
 *     run_id: 1,
 *     started_at: "2026-11-09T16:32:13Z",
 *     status: "completed",
 *   })
 * console.log(ciCertaintyRunnerMinutes([job(1, 10), job(2, 11)]).managed) // 1
 * ```
 *
 * @param jobs - Every job of one run, across attempts.
 * @returns Runner-minutes split by pool.
 * @category use-cases
 * @since 0.0.0
 */
export const ciCertaintyRunnerMinutes = (jobs: ReadonlyArray<CiWorkflowJob>): CiCertaintyRunnerMinutes => {
  const distinct = A.dedupeWith(
    jobs,
    (left, right) =>
      left.run_id === right.run_id &&
      Str.equivalence(left.name, right.name) &&
      left.started_at === right.started_at &&
      left.completed_at === right.completed_at
  );
  const minutesFor = (runnerClass: string): number =>
    roundMinutes(
      A.reduce(
        A.filter(distinct, (job) => Str.equivalence(ciRunnerClassForLabels(job.labels), runnerClass)),
        0,
        (total, job) =>
          total +
          O.getOrElse(
            O.flatMap(epochMillis(job.started_at), (start) =>
              O.map(completedMillis(job), (end) => Math.max(0, end - start) / 60_000)
            ),
            () => 0
          )
      )
    );
  return CiCertaintyRunnerMinutes.make({
    githubHosted: minutesFor("github-hosted"),
    managed: minutesFor("managed"),
    unknown: minutesFor("unknown"),
  });
};

const addRunnerMinutes = (left: CiCertaintyRunnerMinutes, right: CiCertaintyRunnerMinutes) =>
  CiCertaintyRunnerMinutes.make({
    githubHosted: roundMinutes(left.githubHosted + right.githubHosted),
    managed: roundMinutes(left.managed + right.managed),
    unknown: roundMinutes(left.unknown + right.unknown),
  });

const totalRunnerMinutes = (minutes: CiCertaintyRunnerMinutes): number =>
  roundMinutes(minutes.githubHosted + minutes.managed + minutes.unknown);

const zeroRunnerMinutes = CiCertaintyRunnerMinutes.make({ githubHosted: 0, managed: 0, unknown: 0 });

const isCheckPullRequestRun = (run: CiCertaintyRun): boolean =>
  Str.equivalence(run.workflow, PRODUCER_CHECK) && Str.equivalence(run.run.event, "pull_request");

const presentString = (value: O.Option<string | null>): O.Option<string> => O.flatMap(value, O.fromNullishOr);

const runStatus = (run: CiWorkflowWindowRun): O.Option<string> => presentString(run.status);

const runConclusion = (run: CiWorkflowWindowRun): O.Option<string> => presentString(run.conclusion);

const runCreatedMillis = (run: CiCertaintyRun): number => DateTime.toEpochMillis(run.run.created_at);

const isRunComplete = (run: CiCertaintyRun): boolean =>
  O.match(runStatus(run.run), {
    // A captured run without a status is judged by its jobs.
    onNone: () => A.every(run.jobs, (job) => Str.equivalence(job.status, "completed")),
    onSome: (status) => Str.equivalence(status, "completed"),
  });

// Two generations of check.yml mark a documentation-only head. Until 2026-11-13 its Heavy Admission
// job ran the documentation-only admission step. Since then that job is skipped before runner
// allocation on such a head, and Docs Policy, which only a docs_only change profile creates, is the
// marker: any conclusion but `skipped` (a red or cancelled Docs Policy is still a docs head).
const headClassOf = (jobs: ReadonlyArray<ProducedJob>): CiCertaintyHeadClass => {
  const checkJobs = A.filter(jobs, (produced) => Str.equivalence(produced.producer, PRODUCER_CHECK));
  const admittedAsDocs = O.exists(latestJobNamed(checkJobs, [HEAVY_ADMISSION_JOB]), (produced) =>
    A.some(
      produced.job.steps,
      (step) => Str.equivalence(step.name, DOCS_ADMISSION_STEP) && step.conclusion === "success"
    )
  );
  const ranDocsPolicy = O.exists(
    latestJobNamed(checkJobs, [DOCS_POLICY_JOB]),
    (produced) => produced.job.conclusion !== "skipped"
  );
  return admittedAsDocs || ranDocsPolicy ? "docs" : "code";
};

/** A head's runs, its T0 and its branch, before judgement. */
interface HeadRuns {
  readonly branch: O.Option<string>;
  readonly headSha: string;
  readonly runs: ReadonlyArray<CiCertaintyRun>;
  readonly t0: number;
}

const groupHeads = (runs: ReadonlyArray<CiCertaintyRun>): ReadonlyArray<HeadRuns> => {
  const grouped = A.reduce(runs, HashMap.empty<string, ReadonlyArray<CiCertaintyRun>>(), (heads, run) =>
    HashMap.set(
      heads,
      run.run.head_sha,
      A.append(O.getOrElse(HashMap.get(heads, run.run.head_sha), A.empty<CiCertaintyRun>), run)
    )
  );
  return pipe(
    A.fromIterable(HashMap.toEntries(grouped)),
    A.flatMap(([headSha, headRuns]) => {
      const checkRuns = A.filter(headRuns, isCheckPullRequestRun);
      return A.match(checkRuns, {
        // A head with no check.yml pull_request run has no T0 and is not judged.
        onEmpty: A.empty<HeadRuns>,
        onNonEmpty: (present) => [
          {
            branch: A.reduce(present, O.none<string>(), (found, run) =>
              O.orElse(found, () => presentString(run.run.head_branch))
            ),
            headSha,
            runs: headRuns,
            t0: A.min(A.map(present, runCreatedMillis), Order.Number),
          },
        ],
      });
    }),
    A.sort(
      Order.combine(
        Order.mapInput(Order.Number, (head: HeadRuns) => head.t0),
        Order.mapInput(Order.String, (head: HeadRuns) => head.headSha)
      )
    )
  );
};

// The instant a non-green head's verdict was decided: the first red or cancelled required context's
// completion, else the latest required job's completion. Jobs outside the required set never move it,
// so a red head is judged against the same instant its green twin would be (D5 monotonicity).
const verdictDecidedAt = (
  jobs: ReadonlyArray<ProducedJob>,
  requiredGroups: ReadonlyArray<ReadonlyArray<string>>,
  state: CiCertaintyHeadState,
  t0: number
): number => {
  const latest = A.getSomes(A.map(requiredGroups, (names) => latestJobNamed(jobs, names)));
  const completions = (keep: (produced: ProducedJob) => boolean): ReadonlyArray<number> =>
    A.getSomes(A.map(A.filter(latest, keep), (produced) => completedMillis(produced.job)));
  const lastRequired = A.match(
    completions(() => true),
    {
      onEmpty: () => t0,
      onNonEmpty: (values) => A.max(values, Order.Number),
    }
  );
  const failed = Str.equivalence(state, "red") || Str.equivalence(state, "cancelled");
  const failedAt = completions((produced) => {
    const context = jobContextState(produced.job);
    return Str.equivalence(context, "red") || Str.equivalence(context, "cancelled");
  });
  return failed && A.isReadonlyArrayNonEmpty(failedAt) ? A.min(failedAt, Order.Number) : lastRequired;
};

const judgeHead = (
  head: HeadRuns,
  allHeads: ReadonlyArray<HeadRuns>,
  requiredContexts: ReadonlyArray<string>,
  rulesetDigest: string
): CiCertaintyHeadRow => {
  const produced = A.flatMap(head.runs, (run) =>
    A.map(run.jobs, (job): ProducedJob => ({ job, producer: run.workflow }))
  );
  const jobs = A.filter(produced, P.not(isReReport(produced)));
  const requiredGroups = A.map(requiredContexts, (context) => [context]);
  const contexts = A.map(requiredGroups, (names) => contextRow(jobs, names));
  const partial = A.some(head.runs, (run) => A.isReadonlyArrayNonEmpty(run.partialReads));
  const state = headStateOf(contexts, partial, A.every(head.runs, isRunComplete));
  const requiredGreen = groupsGreenAt(jobs, requiredGroups);
  const mergeableGreen = groupsGreenAt(jobs, A.appendAll(requiredGroups, MERGEABLE_EXTRA_CONTEXTS));
  const decidedAt = verdictDecidedAt(jobs, requiredGroups, state, head.t0);
  const successor = A.findFirst(
    allHeads,
    (other) =>
      !Str.equivalence(other.headSha, head.headSha) &&
      O.isSome(head.branch) &&
      O.makeEquivalence(Str.equivalence)(other.branch, head.branch) &&
      other.t0 > head.t0
  );
  const superseded = O.exists(
    successor,
    (next) =>
      Str.equivalence(state, "open") ||
      // check.yml's cancel-in-progress cancels a head in the same second its successor's run is
      // created, so a cancelled head ties with its successor; red stays strict (D5 monotonicity).
      (Str.equivalence(state, "cancelled") && next.t0 <= decidedAt) ||
      (!Str.equivalence(state, "green") && !Str.equivalence(state, "cancelled") && next.t0 < decidedAt) ||
      (Str.equivalence(state, "green") && O.exists(requiredGreen, (green) => next.t0 < green.at))
  );
  const censor: O.Option<CiCertaintyCensorReason> = superseded
    ? O.some("superseded")
    : Str.equivalence(state, "open")
      ? O.some("open")
      : O.none();
  const coverage = latestJobNamed(jobs, COVERAGE_CONTEXTS);
  const coverageVerdictMinutes = O.flatMap(coverage, (produced) => {
    const verdict = jobContextState(produced.job);
    const skipped = produced.job.conclusion === "skipped";
    return Str.equivalence(verdict, "green") || Str.equivalence(verdict, "red")
      ? skipped
        ? O.none()
        : O.map(completedMillis(produced.job), (at) => minutesBetween(head.t0, at))
      : O.none();
  });
  const isGreen = Str.equivalence(state, "green");
  return CiCertaintyHeadRow.make({
    attempts: A.reduce(A.filter(head.runs, isCheckPullRequestRun), 0, (max, run) => Math.max(max, run.run.run_attempt)),
    censor,
    contexts,
    coverageVerdictMinutes,
    criticalContext: isGreen ? O.map(requiredGreen, (green) => green.context) : O.none(),
    headClass: headClassOf(jobs),
    headSha: head.headSha,
    mergeableGreenMinutes: isGreen ? O.map(mergeableGreen, (green) => minutesBetween(head.t0, green.at)) : O.none(),
    producers: A.sort(A.dedupe(A.map(head.runs, (run) => run.workflow)), Order.String),
    requiredGreenMinutes: isGreen ? O.map(requiredGreen, (green) => minutesBetween(head.t0, green.at)) : O.none(),
    rulesetDigest,
    runnerMinutes: A.reduce(head.runs, zeroRunnerMinutes, (total, run) =>
      addRunnerMinutes(total, ciCertaintyRunnerMinutes(run.jobs))
    ),
    state,
    t0: DateTime.makeUnsafe(head.t0),
  });
};

const percentile = (
  values: ReadonlyArray<number>,
  quantile: number
): { readonly minutes: O.Option<number>; readonly status: CiCertaintyPercentileStatus } =>
  O.match(nearestRank(values, quantile), {
    onNone: () => ({ minutes: O.none(), status: "empty" as const }),
    onSome: (value) =>
      Number.isFinite(value)
        ? { minutes: O.some(roundMinutes(value)), status: "attained" as const }
        : { minutes: O.none(), status: "not-attained" as const },
  });

/**
 * Misses-counted latency statistic over a set of judged heads.
 *
 * **Details**
 *
 * Censored heads (superseded or open) are counted apart and never enter the
 * percentile. Every other head is counted: a head with a value contributes it,
 * a head without one is a miss and contributes an unbounded value. For a fixed
 * censoring, turning a counted head's value into a miss can therefore never
 * lower `p50Minutes` or `p95Minutes`. The report keeps censoring fixed under
 * that flip because a non-green head is judged superseded against the instant
 * its verdict was decided, never against jobs outside the required set; the
 * monotonicity fixtures in `ci-certainty.test.ts` pin both halves.
 *
 * **Example** (Score an empty population)
 *
 * ```ts
 * import { ciCertaintyLatencyStat } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * console.log(ciCertaintyLatencyStat([], () => O.none()).p95Status) // "empty"
 * ```
 *
 * @param heads - Judged heads of one class.
 * @param value - Minutes to the measured state, or none for a miss.
 * @returns Counts, censoring and nearest-rank p50 and p95.
 * @category use-cases
 * @since 0.0.0
 */
export const ciCertaintyLatencyStat: {
  (
    value: (head: CiCertaintyHeadRow) => O.Option<number>
  ): (heads: ReadonlyArray<CiCertaintyHeadRow>) => CiCertaintyLatencyStat;
  (
    heads: ReadonlyArray<CiCertaintyHeadRow>,
    value: (head: CiCertaintyHeadRow) => O.Option<number>
  ): CiCertaintyLatencyStat;
} = dual(
  2,
  (
    heads: ReadonlyArray<CiCertaintyHeadRow>,
    value: (head: CiCertaintyHeadRow) => O.Option<number>
  ): CiCertaintyLatencyStat => {
    const counted = A.filter(heads, (head) => O.isNone(head.censor));
    const values = A.map(counted, (head) => O.getOrElse(value(head), () => Number.POSITIVE_INFINITY));
    const censoredBy = (reason: CiCertaintyCensorReason) =>
      A.length(A.filter(heads, (head) => O.exists(head.censor, (censor) => Str.equivalence(censor, reason))));
    const p50 = percentile(values, 0.5);
    const p95 = percentile(values, 0.95);
    return CiCertaintyLatencyStat.make({
      censoredOpen: censoredBy("open"),
      censoredSuperseded: censoredBy("superseded"),
      misses: A.length(A.filter(values, (minutes) => !Number.isFinite(minutes))),
      n: A.length(values),
      p50Minutes: p50.minutes,
      p50Status: p50.status,
      p95Minutes: p95.minutes,
      p95Status: p95.status,
      withinTen: A.length(A.filter(values, (minutes) => minutes <= TEN_MINUTES)),
    });
  }
);

const meanOf = (values: ReadonlyArray<number>): O.Option<number> =>
  A.isReadonlyArrayNonEmpty(values)
    ? O.some(roundMinutes(A.reduce(values, 0, (total, value) => total + value) / A.length(values)))
    : O.none();

const attemptOneJobs = (run: CiCertaintyRun): ReadonlyArray<CiWorkflowJob> =>
  A.filter(run.jobs, (job) => job.run_attempt === 1);

const admissionToHeavyMinutes = (run: CiCertaintyRun): O.Option<number> => {
  const jobs = attemptOneJobs(run);
  const admission = O.flatMap(
    A.findFirst(jobs, (job) => Str.equivalence(job.name, HEAVY_ADMISSION_JOB)),
    (job) => epochMillis(job.started_at)
  );
  const heavyStarts = A.getSomes(
    A.map(
      A.filter(
        jobs,
        (job) =>
          !Str.equivalence(job.name, HEAVY_ADMISSION_JOB) &&
          job.conclusion !== "skipped" &&
          Str.equivalence(ciRunnerClassForLabels(job.labels), "managed")
      ),
      (job) => epochMillis(job.started_at)
    )
  );
  return O.flatMap(admission, (start) =>
    A.match(heavyStarts, {
      onEmpty: O.none,
      onNonEmpty: (starts) => O.some(minutesBetween(start, A.min(starts, Order.Number))),
    })
  );
};

// A heavy-admit.yml run whose Heavy Admission was skipped (a label event that admitted nothing) is no
// producer run; check.yml runs always are. A later label on an admitted head runs Heavy Admission and
// re-reports the lanes as skipped (or skips the caller); it counts here, but its skipped lane copies
// add no minutes and `isReReport` keeps them from moving a lane's green instant.
const isAdmittedRun = (run: CiCertaintyRun): boolean =>
  isCheckPullRequestRun(run) ||
  A.some(run.jobs, (job) => Str.equivalence(job.name, HEAVY_ADMISSION_JOB) && job.conclusion !== "skipped");

/** One check.yml run of a head with the admitted heavy-admit.yml runs it owns. */
interface HeadAttempt {
  readonly check: CiCertaintyRun;
  readonly headSha: string;
  readonly jobs: ReadonlyArray<CiWorkflowJob>;
}

// Each admitted heavy-admit.yml run joins the latest check.yml run of its head created at or before it
// (the first one when it came earlier), so a label-admitted head carries its beep-ec2-heavy minutes too.
const headAttempts = (head: HeadRuns): ReadonlyArray<HeadAttempt> => {
  const checks = A.sort(A.filter(head.runs, isCheckPullRequestRun), Order.mapInput(Order.Number, runCreatedMillis));
  const admits = A.filter(
    head.runs,
    (run) => Str.equivalence(run.workflow, PRODUCER_HEAVY_ADMIT) && isAdmittedRun(run)
  );
  const ownerOf = (admit: CiCertaintyRun): number =>
    O.getOrElse(
      A.findLastIndex(checks, (check) => runCreatedMillis(check) <= runCreatedMillis(admit)),
      () => 0
    );
  return A.map(checks, (check, index): HeadAttempt => {
    const owned: ReadonlyArray<CiCertaintyRun> = A.filter(admits, (admit) => ownerOf(admit) === index);
    return {
      check,
      headSha: head.headSha,
      jobs: A.appendAll(
        check.jobs,
        A.flatMap(owned, (admit: CiCertaintyRun) => admit.jobs)
      ),
    };
  });
};

const testUnitPartitionJobCount = (run: CiCertaintyRun): number =>
  A.length(
    A.filter(
      attemptOneJobs(run),
      (job) => Str.startsWith(TEST_UNIT_PARTITION_PREFIX)(job.name) && job.conclusion !== "skipped"
    )
  );

const isPlannedRun = (run: CiCertaintyRun): boolean =>
  A.some(attemptOneJobs(run), (job) => Str.equivalence(job.name, TEST_PLAN_JOB) && job.conclusion === "success");

const mainVerdictOf = (runs: ReadonlyArray<CiWorkflowWindowRun>): CiCertaintyMainVerdict => {
  const conclusions = A.getSomes(
    A.map(
      A.filter(runs, (run) => O.exists(runStatus(run), (status) => Str.equivalence(status, "completed"))),
      runConclusion
    )
  );
  if (A.some(conclusions, (conclusion) => Str.equivalence(conclusion, "success"))) {
    return "success";
  }
  if (A.some(conclusions, (conclusion) => !Str.equivalence(conclusion, "cancelled"))) {
    return "failure";
  }
  if (A.some(runs, (run) => !O.exists(runStatus(run), (status) => Str.equivalence(status, "completed")))) {
    return "open";
  }
  return A.isReadonlyArrayNonEmpty(runs) ? "cancelled" : "no-run";
};

// An incomplete push-run listing says nothing about a commit's runs, so it is unread, never no-run.
const mainRowOf =
  (listingPartial: boolean) =>
  (commit: CiCertaintyMainCommit): CiCertaintyMainRow =>
    CiCertaintyMainRow.make({
      committedAt: commit.committedAt,
      docsOnly: commit.docsOnly,
      runIds: A.map(commit.runs, (run) => run.id),
      sha: commit.sha,
      verdict: listingPartial ? "unread" : mainVerdictOf(commit.runs),
    });

const mainStatOf = (rows: ReadonlyArray<CiCertaintyMainRow>): CiCertaintyMainStat => {
  const code = A.filter(rows, (row) => !row.docsOnly);
  const count = (verdict: CiCertaintyMainVerdict) =>
    A.length(A.filter(code, (row) => Str.equivalence(row.verdict, verdict)));
  const verdicts = count("success") + count("failure");
  return CiCertaintyMainStat.make({
    cancelled: count("cancelled"),
    commits: A.length(code),
    docsCommits: A.length(rows) - A.length(code),
    noRun: count("no-run"),
    open: count("open"),
    rate: A.isReadonlyArrayNonEmpty(code) && count("unread") === 0 ? O.some(verdicts / A.length(code)) : O.none(),
    unread: count("unread"),
    verdicts,
  });
};

const insideWindow = (since: DateTime.Utc, until: DateTime.Utc, millis: number): boolean =>
  millis >= DateTime.toEpochMillis(since) && millis < DateTime.toEpochMillis(until);

const rulesetDigestOf = (contexts: ReadonlyArray<string>) =>
  sha256Hex(A.join(A.sort(contexts, Order.String), "\n")).pipe(
    Effect.mapError(CiCommandError.new("Failed to digest the required contexts."))
  );

/**
 * Fold a captured corpus into a head-level certainty scorecard.
 *
 * **Details**
 *
 * Heads are the distinct `head_sha` values of the corpus's check.yml
 * pull_request runs; only heads whose T0 falls inside `[since, until)` are
 * judged, and the others are read only to detect supersession. For each
 * required context the latest-starting job across both producers and every
 * attempt wins, and a skipped job satisfies it. A head is superseded when the
 * next push to its branch starts before its verdict was decided: its
 * required-green instant, or, for any other state, the first red or cancelled
 * required context's completion (else the latest required job's), so jobs
 * outside the required set never censor a head. Main commits are judged when
 * their commit time falls inside the window. The report is certified only when
 * no counted head is api-partial, the main listing was complete, and at least
 * one code head was counted.
 *
 * **Example** (Score an empty corpus)
 *
 * ```ts
 * import { buildCiCertaintyReport, CiCertaintyCorpus } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 *
 * const corpus = CiCertaintyCorpus.make({
 *   capturedAt: DateTime.makeUnsafe("2026-11-10T03:00:00Z"),
 *   mainCommits: [],
 *   pullRequestRuns: [],
 *   requestCount: 0,
 *   requiredContexts: ["Lint"],
 *   since: DateTime.makeUnsafe("2026-11-09T00:00:00Z"),
 *   until: DateTime.makeUnsafe("2026-11-10T00:00:00Z"),
 * })
 * console.log(Effect.isEffect(buildCiCertaintyReport(corpus)))
 * ```
 *
 * @param corpus - Captured runs, main commits and required contexts.
 * @returns The scorecard, certified or refused with its reasons.
 * @category use-cases
 * @since 0.0.0
 */
export const buildCiCertaintyReport = Effect.fn("Ci.buildCiCertaintyReport")(function* (
  corpus: CiCertaintyCorpus
): Effect.fn.Return<CiCertaintyReport, CiCommandError, Digest.Digest> {
  const rulesetDigest = yield* rulesetDigestOf(corpus.requiredContexts);
  const allHeads = groupHeads(corpus.pullRequestRuns);
  const windowHeads = A.filter(allHeads, (head) => insideWindow(corpus.since, corpus.until, head.t0));
  const heads = A.map(windowHeads, (head) => judgeHead(head, allHeads, corpus.requiredContexts, rulesetDigest));
  const classHeads = (headClass: CiCertaintyHeadClass) =>
    A.filter(heads, (head) => Str.equivalence(head.headClass, headClass));
  const codeHeads = classHeads("code");
  const codeHeadShas = HashSet.fromIterable(A.map(codeHeads, (head) => head.headSha));
  const headRuns = A.flatMap(windowHeads, (head) => head.runs);
  const codeCheckRuns = A.filter(
    headRuns,
    (run) => isCheckPullRequestRun(run) && HashSet.has(codeHeadShas, run.run.head_sha)
  );
  const attempts = A.flatMap(windowHeads, headAttempts);
  const runTotals = A.map(attempts, (attempt) => ciCertaintyRunnerMinutes(attempt.jobs));
  const greenCodeRunTotals = A.map(
    A.filter(
      attempts,
      (attempt) =>
        HashSet.has(codeHeadShas, attempt.headSha) &&
        O.exists(runConclusion(attempt.check.run), (conclusion) => Str.equivalence(conclusion, "success"))
    ),
    (attempt) => totalRunnerMinutes(ciCertaintyRunnerMinutes(attempt.jobs))
  );
  const allHeadMinutes = A.reduce(heads, 0, (total, head) => total + totalRunnerMinutes(head.runnerMinutes));
  const supersededMinutes = A.reduce(
    A.filter(heads, (head) => O.exists(head.censor, (censor) => Str.equivalence(censor, "superseded"))),
    0,
    (total, head) => total + totalRunnerMinutes(head.runnerMinutes)
  );
  const plannedRuns = A.filter(codeCheckRuns, isPlannedRun);
  const ownerScopedRuns = A.filter(plannedRuns, (run) => testUnitPartitionJobCount(run) < TEST_UNIT_FULL_LAYOUT_JOBS);
  const admissionMinutes = A.getSomes(
    A.map(
      A.filter(headRuns, (run) => HashSet.has(codeHeadShas, run.run.head_sha)),
      admissionToHeavyMinutes
    )
  );
  const mainRows = A.map(
    A.filter(corpus.mainCommits, (commit) =>
      insideWindow(corpus.since, corpus.until, DateTime.toEpochMillis(commit.committedAt))
    ),
    mainRowOf(corpus.mainListingPartial)
  );
  const slo = ciCertaintyLatencyStat(codeHeads, (head) => head.requiredGreenMinutes);
  const countedHeads = A.filter(heads, (head) => O.isNone(head.censor));
  const partialReads: ReadonlyArray<CiWorkflowPartialRead> = A.flatMap(
    A.filter(windowHeads, (head) => A.some(countedHeads, (counted) => Str.equivalence(counted.headSha, head.headSha))),
    (head: HeadRuns) => A.flatMap(head.runs, (run: CiCertaintyRun) => run.partialReads)
  );
  const refusals: ReadonlyArray<CiCertaintyRefusal> = [
    ...(A.some(countedHeads, (head) => Str.equivalence(head.state, "api-partial")) || corpus.mainListingPartial
      ? (["api-partial"] as const)
      : []),
    ...(slo.n === 0 ? (["empty-population"] as const) : []),
  ];
  return CiCertaintyReport.make({
    admissionToHeavy: CiCertaintyAdmissionStat.make({
      n: A.length(admissionMinutes),
      p50Minutes: O.map(nearestRank(admissionMinutes, 0.5), roundMinutes),
    }),
    capturedAt: corpus.capturedAt,
    certified: !A.isReadonlyArrayNonEmpty(refusals),
    clockSource: CI_CERTAINTY_CLOCK_SOURCE,
    coverageVerdict: ciCertaintyLatencyStat(codeHeads, (head) => head.coverageVerdictMinutes),
    docsHeads: ciCertaintyLatencyStat(classHeads("docs"), (head) => head.requiredGreenMinutes),
    greenOnly: ciCertaintyLatencyStat(
      A.filter(codeHeads, (head) => O.isSome(head.censor) || Str.equivalence(head.state, "green")),
      (head) => head.requiredGreenMinutes
    ),
    heads,
    main: mainStatOf(mainRows),
    mainRows,
    mergeable: ciCertaintyLatencyStat(codeHeads, (head) => head.mergeableGreenMinutes),
    notCovered: CI_CERTAINTY_NOT_COVERED,
    partialReads,
    refusals,
    requestCount: corpus.requestCount,
    requiredContexts: corpus.requiredContexts,
    rulesetDigest,
    runnerMinutes: CiCertaintyRunnerStat.make({
      greenCodeRunP50: O.map(nearestRank(greenCodeRunTotals, 0.5), roundMinutes),
      greenCodeRunP95: O.map(nearestRank(greenCodeRunTotals, 0.95), roundMinutes),
      meanGithubHosted: meanOf(A.map(runTotals, (minutes) => minutes.githubHosted)),
      meanManaged: meanOf(A.map(runTotals, (minutes) => minutes.managed)),
      meanTotal: meanOf(A.map(runTotals, totalRunnerMinutes)),
      p50Total: O.map(nearestRank(A.map(runTotals, totalRunnerMinutes), 0.5), roundMinutes),
      p95Total: O.map(nearestRank(A.map(runTotals, totalRunnerMinutes), 0.95), roundMinutes),
      runs: A.length(runTotals),
    }),
    since: corpus.since,
    slo,
    supersededRunnerMinuteShare:
      allHeadMinutes > 0 ? O.some(Math.round((supersededMinutes / allHeadMinutes) * 10_000) / 10_000) : O.none(),
    testUnitConversion: CiCertaintyTestUnitConversion.make({
      fullLayoutJobs: TEST_UNIT_FULL_LAYOUT_JOBS,
      ownerScopedRuns: A.length(ownerScopedRuns),
      plannedRuns: A.length(plannedRuns),
      share: A.isReadonlyArrayNonEmpty(plannedRuns)
        ? O.some(A.length(ownerScopedRuns) / A.length(plannedRuns))
        : O.none(),
    }),
    until: corpus.until,
  });
});

const formatMinutes = (minutes: O.Option<number>): string =>
  O.match(minutes, { onNone: () => "—", onSome: (value) => `${value.toFixed(1)} min` });

const formatPercentile = (minutes: O.Option<number>, status: CiCertaintyPercentileStatus): string =>
  Str.equivalence(status, "attained") ? formatMinutes(minutes) : status;

const formatShare = (share: O.Option<number>): string =>
  O.match(share, { onNone: () => "—", onSome: (value) => `${(value * 100).toFixed(1)}%` });

const latencyRow = (label: string, stat: CiCertaintyLatencyStat): string =>
  `| ${label} | ${stat.n} | ${stat.misses} | ${stat.censoredSuperseded} | ${stat.censoredOpen} | ${stat.withinTen} | ${formatPercentile(stat.p50Minutes, stat.p50Status)} | ${formatPercentile(stat.p95Minutes, stat.p95Status)} |`;

const headTableLines = (report: CiCertaintyReport): ReadonlyArray<string> => [
  "| Head | Class | State | Censored | Required green | Mergeable | Critical context | Runner-min |",
  "| --- | --- | --- | --- | ---: | ---: | --- | ---: |",
  ...A.map(
    report.heads,
    (head) =>
      `| ${Str.slice(0, 10)(head.headSha)} | ${head.headClass} | ${head.state} | ${O.getOrElse(head.censor, () => "")} | ${formatMinutes(head.requiredGreenMinutes)} | ${formatMinutes(head.mergeableGreenMinutes)} | ${O.getOrElse(head.criticalContext, () => "")} | ${totalRunnerMinutes(head.runnerMinutes).toFixed(1)} |`
  ),
];

const headCountLines = (report: CiCertaintyReport): ReadonlyArray<string> => [
  `- heads judged: ${A.length(report.heads)} (per-head rows are left out of the summary)`,
];

const certaintyMarkdown = (report: CiCertaintyReport, headLines: ReadonlyArray<string>): string =>
  A.join(
    [
      `# ci certainty ${DateTime.formatIso(report.since)} → ${DateTime.formatIso(report.until)}`,
      "",
      ...(report.certified
        ? []
        : [
            `> **Not certified, not acceptance evidence.** Refused: ${A.join(report.refusals, ", ")}${
              A.isReadonlyArrayNonEmpty(report.partialReads)
                ? ` (partial job reads: ${A.join(
                    A.map(report.partialReads, (read) => `run ${read.runId} attempt ${read.attempt}`),
                    ", "
                  )})`
                : ""
            }.`,
            "",
          ]),
      `- captured: ${DateTime.formatIso(report.capturedAt)}; clock source: ${report.clockSource}`,
      `- required contexts: ${A.length(report.requiredContexts)} (digest ${Str.slice(0, 12)(report.rulesetDigest)})`,
      `- GitHub requests: ${report.requestCount}`,
      "",
      "| Statistic | n | misses | superseded | open | within 10 min | p50 | p95 |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
      latencyRow("**SLO: push to every required green, code heads (misses counted)**", report.slo),
      latencyRow("Green-only code heads (diagnostic)", report.greenOnly),
      latencyRow("Push to Yeet-mergeable contexts, code heads", report.mergeable),
      latencyRow("Coverage verdict, code heads", report.coverageVerdict),
      latencyRow("Docs heads", report.docsHeads),
      "",
      "## Runner-minutes per head attempt",
      "",
      `- head attempts: ${report.runnerMinutes.runs}; mean ${formatMinutes(report.runnerMinutes.meanTotal)} (GitHub-hosted ${formatMinutes(report.runnerMinutes.meanGithubHosted)}, beep-ec2-heavy ${formatMinutes(report.runnerMinutes.meanManaged)}); p50 ${formatMinutes(report.runnerMinutes.p50Total)}; p95 ${formatMinutes(report.runnerMinutes.p95Total)}`,
      `- green code head attempts (check.yml plus admitted heavy-admit.yml): p50 ${formatMinutes(report.runnerMinutes.greenCodeRunP50)}; p95 ${formatMinutes(report.runnerMinutes.greenCodeRunP95)}`,
      `- superseded-head runner-minute share: ${formatShare(report.supersededRunnerMinuteShare)}`,
      "",
      "## Main verdict rate",
      "",
      `- non-docs first-parent commits: ${report.main.commits} (docs ${report.main.docsCommits}); completed verdicts ${report.main.verdicts}; rate ${formatShare(report.main.rate)}; cancelled ${report.main.cancelled}; no run ${report.main.noRun}; open ${report.main.open}; unread ${report.main.unread}`,
      "",
      "## Rows for sibling goals",
      "",
      `- admission-to-heavy-pool start p50 (code-head producer runs, n=${report.admissionToHeavy.n}): ${formatMinutes(report.admissionToHeavy.p50Minutes)}`,
      `- owner-scoped Test Unit selection: ${report.testUnitConversion.ownerScopedRuns} of ${report.testUnitConversion.plannedRuns} planned runs (${formatShare(report.testUnitConversion.share)}; full layout ${report.testUnitConversion.fullLayoutJobs} jobs)`,
      "",
      "## Heads",
      "",
      ...headLines,
      "",
      "## Not covered",
      "",
      ...A.map(report.notCovered, (row) => `- ${row}`),
    ],
    "\n"
  );

/**
 * Render a scorecard as Markdown.
 *
 * **Details**
 *
 * The headline row comes first, every beside-row under it, then runner-minutes,
 * the main verdict rate, the sibling-goal rows, a per-head table that names
 * heads by SHA only (branch names can carry session identifiers and are never
 * printed), and the "Not covered" section. An uncertified report opens with a
 * blockquote naming every refusal, so it cannot be pasted as evidence without
 * the qualifier.
 *
 * **Example** (Reference the renderer)
 *
 * ```ts
 * import { renderCiCertaintyMarkdown } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof renderCiCertaintyMarkdown)
 * ```
 *
 * @param report - The scorecard to render.
 * @returns Markdown text.
 * @category formatting
 * @since 0.0.0
 */
export const renderCiCertaintyMarkdown = (report: CiCertaintyReport): string =>
  certaintyMarkdown(report, headTableLines(report));

/**
 * Render a scorecard as Markdown with aggregates only.
 *
 * **Details**
 *
 * The same document as {@link renderCiCertaintyMarkdown}, refusal stamp
 * included, with the per-head table replaced by a count of the heads judged.
 * It is the form for surfaces that should carry aggregates and run ids only:
 * the nightly workflow's job summary and the packet's `history/` record.
 *
 * **Example** (Reference the summary renderer)
 *
 * ```ts
 * import { renderCiCertaintySummaryMarkdown } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof renderCiCertaintySummaryMarkdown)
 * ```
 *
 * @param report - The scorecard to render.
 * @returns Markdown text without per-head rows.
 * @category formatting
 * @since 0.0.0
 */
export const renderCiCertaintySummaryMarkdown = (report: CiCertaintyReport): string =>
  certaintyMarkdown(report, headCountLines(report));

/**
 * The time bounds and local inputs of one live capture.
 *
 * **Example** (Describe a one-day capture)
 *
 * ```ts
 * import { CiCertaintyCaptureRequest } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const request = CiCertaintyCaptureRequest.make({
 *   mainRef: "origin/main",
 *   maxRequests: 1500,
 *   repoRoot: ".",
 *   since: DateTime.makeUnsafe("2026-11-09T00:00:00Z"),
 *   until: DateTime.makeUnsafe("2026-11-10T00:00:00Z"),
 * })
 * console.log(request.maxRequests)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyCaptureRequest extends S.Opaque<CiCertaintyCaptureRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    mainRef: S.NonEmptyString,
    maxRequests: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    repoRoot: S.NonEmptyString,
    since: S.DateTimeUtc,
    until: S.DateTimeUtc,
  }).pipe(
    $I.annoteSchema("CiCertaintyCaptureRequest", {
      description: "Window, main ref, checkout and GitHub request bound of one live certainty capture.",
    })
  )
) {}

/**
 * Service shape of the scorecard's input reader.
 *
 * **Example** (Name the capture operation)
 *
 * ```ts
 * import type { CiCertaintySourceShape } from "@beep/repo-cli/commands/Ci"
 *
 * const operation = <K extends keyof CiCertaintySourceShape>(name: K): K => name
 * console.log(operation("capture"))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface CiCertaintySourceShape {
  readonly capture: (request: CiCertaintyCaptureRequest) => Effect.Effect<CiCertaintyCorpus, CiCommandError>;
}

/**
 * The reader a certainty scorecard is computed from.
 *
 * **Details**
 *
 * The live implementation ({@link CiCertaintySourceLive}) lists check.yml and
 * heavy-admit.yml pull_request runs from `since` to the capture instant, reads
 * jobs per attempt only for heads whose T0 is inside the window, lists
 * check.yml push runs on main, and reads main's first-parent commits and their
 * changed paths from local `git`. Every GitHub read is counted and bounded by
 * `maxRequests`; a bound reached mid-capture leaves the affected heads
 * api-partial, which refuses certification instead of shrinking the census.
 * Tests and replays provide a corpus directly.
 *
 * **Example** (Access the source service)
 *
 * ```ts
 * import { CiCertaintySource } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.service(CiCertaintySource)))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CiCertaintySource extends Context.Service<CiCertaintySource, CiCertaintySourceShape>()(
  $I`CiCertaintySource`
) {}

const gitLines = Effect.fn("Ci.certaintyGitLines")(
  function* (repoRoot: string, args: ReadonlyArray<string>) {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      // KEEP (D-22): `Git.log` has no `--first-parent` or `--until`, and the per-commit `diff-tree` answers
      // nothing for a merge commit, which no kit diff member reproduces (`changedFiles` compares two trees).
      // biome-ignore lint/plugin/no-hand-rolled-git-gh-spawn: KEEP (D-22), reason above
      ChildProcess.make("git", ["-C", repoRoot, ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe" })
    );
    const [stdout, status] = yield* Effect.all(
      [handle.stdout.pipe(Stream.decodeText, Stream.mkString), handle.exitCode],
      {
        concurrency: 2,
      }
    );
    if (status !== 0) {
      return yield* CiCommandError.make({ message: `git ${A.join(args, " ")} exited ${status}.` });
    }
    return A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
  },
  Effect.scoped,
  Effect.mapError(CiCommandError.new("Failed to read main's first-parent history with git."))
);

const readMainCommits = Effect.fn("Ci.certaintyReadMainCommits")(function* (request: CiCertaintyCaptureRequest) {
  // `log.showSignature` in a gitconfig would interleave gpg lines with the formatted ones.
  const lines = yield* gitLines(request.repoRoot, [
    "log",
    "--no-show-signature",
    "--first-parent",
    "--format=%H%x09%cI",
    `--since=${DateTime.formatIso(request.since)}`,
    `--until=${DateTime.formatIso(request.until)}`,
    request.mainRef,
  ]);
  return yield* Effect.forEach(
    lines,
    Effect.fnUntraced(function* (line) {
      const fields = Str.split(line, "\t");
      const sha = A.headNonEmpty(fields);
      const committedAt = yield* O.match(O.flatMap(A.get(fields, 1), DateTime.make), {
        onNone: () =>
          CiCommandError.make({ message: `git log printed a commit line without a valid commit time: ${line}` }),
        onSome: Effect.succeed,
      });
      const paths = yield* gitLines(request.repoRoot, [
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "--no-renames",
        "-r",
        sha,
      ]);
      return {
        committedAt,
        docsOnly: A.isReadonlyArrayNonEmpty(paths) && A.every(paths, isHeavyDocsOnlyPath),
        sha,
      };
    }),
    { concurrency: 4 }
  );
});

const listRuns = (workflow: string, event: "pull_request" | "push", since: DateTime.Utc, until: DateTime.Utc) =>
  collectCiWorkflowWindowRuns(
    CiLaneTimingWindowOptions.make({
      branch: event === "push" ? O.some("main") : O.none(),
      event,
      headSha: O.none(),
      since,
      until,
      workflow,
    })
  );

// Count every read and stop at the bound: a refused read becomes a partial read, never a smaller census.
const countingGithubClient = (
  inner: CiLaneTimingGithubClient["Service"],
  maxRequests: number,
  count: Ref.Ref<number>
) =>
  CiLaneTimingGithubClient.of({
    getJson: Effect.fn("CiCertainty.countingGetJson")(function* (endpoint: string) {
      const used = yield* Ref.getAndUpdate(count, (value) => value + 1);
      if (used >= maxRequests) {
        return yield* CiCommandError.make({
          message: `GitHub request bound of ${maxRequests} reached before ${endpoint}.`,
        });
      }
      return yield* inner.getJson(endpoint);
    }),
  });

const captureWithClient = Effect.fn("Ci.certaintyCaptureWithClient")(function* (
  request: CiCertaintyCaptureRequest,
  requiredContexts: ReadonlyArray<string>,
  count: Ref.Ref<number>
): Effect.fn.Return<
  CiCertaintyCorpus,
  CiCommandError,
  CiLaneTimingGithubClient | ChildProcessSpawner.ChildProcessSpawner
> {
  const capturedAt = yield* DateTime.now;
  // The main push listing is a few pages; read it before the per-attempt job reads spend the bound.
  const mainRunsResult = yield* listRuns("check.yml", "push", request.since, capturedAt).pipe(Effect.result);
  const checkRuns = yield* listRuns("check.yml", "pull_request", request.since, capturedAt);
  const heavyAdmitRuns = yield* listRuns("heavy-admit.yml", "pull_request", request.since, capturedAt);
  const windowHeadShas = HashSet.fromIterable(
    A.map(
      A.filter(checkRuns, (run) => insideWindow(request.since, request.until, DateTime.toEpochMillis(run.created_at))),
      (run) => run.head_sha
    )
  );
  const toCapture = A.appendAll(
    A.map(checkRuns, (run) => ({ run, workflow: PRODUCER_CHECK })),
    A.map(heavyAdmitRuns, (run) => ({ run, workflow: PRODUCER_HEAVY_ADMIT }))
  );
  const pullRequestRuns = yield* Effect.forEach(
    toCapture,
    Effect.fnUntraced(function* ({ run, workflow }) {
      if (!HashSet.has(windowHeadShas, run.head_sha)) {
        // Runs of heads outside the window are kept only to detect supersession.
        return CiCertaintyRun.make({ jobs: [], run, workflow });
      }
      const read = yield* collectCiWorkflowRunAttemptJobs(run.id, run.run_attempt);
      return CiCertaintyRun.make({ jobs: read.jobs, partialReads: read.partialReads, run, workflow });
    }),
    { concurrency: 8 }
  );
  const mainRuns = mainRunsResult._tag === "Success" ? mainRunsResult.success : A.empty<CiWorkflowWindowRun>();
  const commits = yield* readMainCommits(request);
  const requestCount = yield* Ref.get(count);
  return CiCertaintyCorpus.make({
    capturedAt,
    mainCommits: A.map(commits, (commit) =>
      CiCertaintyMainCommit.make({
        ...commit,
        runs: A.filter(mainRuns, (run) => Str.equivalence(run.head_sha, commit.sha)),
      })
    ),
    mainListingPartial: mainRunsResult._tag === "Failure",
    pullRequestRuns,
    requestCount,
    requiredContexts,
    since: request.since,
    until: request.until,
  });
});

const BranchProtectionContexts = S.Struct({ requiredStatusChecks: S.Array(S.NonEmptyString) });
const decodeBranchProtectionContexts = S.decodeUnknownEffect(S.fromJsonString(BranchProtectionContexts));

const readRequiredContexts = Effect.fn("Ci.certaintyReadRequiredContexts")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(repoRoot, "standards", "branch-protection-contexts.json");
  const text = yield* fs.readFileString(file).pipe(CiCommandError.mapError(`Failed to read ${file}.`));
  const decoded = yield* decodeBranchProtectionContexts(text).pipe(
    CiCommandError.mapError(`Failed to decode ${file}.`)
  );
  return decoded.requiredStatusChecks;
});

/**
 * The live certainty reader over the checkout's GitHub identity and local git.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { CiCertaintySourceLive } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof CiCertaintySourceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CiCertaintySourceLive = Effect.fn("CiCertaintySource.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return CiCertaintySource.of({
    capture: Effect.fn("CiCertaintySource.capture")(function* (request) {
      const requiredContexts = yield* readRequiredContexts(request.repoRoot).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path)
      );
      const count = yield* Ref.make(0);
      return yield* makeCiLaneTimingGithubClient().pipe(
        Effect.flatMap((client) =>
          captureWithClient(request, requiredContexts, count).pipe(
            Effect.provideService(CiLaneTimingGithubClient, countingGithubClient(client, request.maxRequests, count))
          )
        ),
        withCiGithub(request.repoRoot),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
    }),
  });
});

const decodeCorpus = S.decodeUnknownEffect(S.fromJsonString(CiCertaintyCorpus));
const encodeCorpus = S.encodeEffect(S.fromJsonString(CiCertaintyCorpus, { space: 2 }));
const encodeReport = S.encodeEffect(S.fromJsonString(CiCertaintyReport, { space: 2 }));

/**
 * Decode a captured certainty corpus from JSON text.
 *
 * **Example** (Reject an empty document)
 *
 * ```ts
 * import { decodeCiCertaintyCorpus } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(decodeCiCertaintyCorpus("{}")))
 * ```
 *
 * @param text - Corpus JSON as `--write-corpus` writes it.
 * @returns The decoded corpus.
 * @category encoding
 * @since 0.0.0
 */
export const decodeCiCertaintyCorpus = (text: string): Effect.Effect<CiCertaintyCorpus, CiCommandError> =>
  decodeCorpus(text).pipe(CiCommandError.mapError("Failed to decode the certainty corpus."));

/**
 * Encode a certainty report as pretty-printed JSON.
 *
 * **Example** (Reference the encoder)
 *
 * ```ts
 * import { encodeCiCertaintyReport } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof encodeCiCertaintyReport)
 * ```
 *
 * @param report - The scorecard.
 * @returns JSON text.
 * @category encoding
 * @since 0.0.0
 */
export const encodeCiCertaintyReport = (report: CiCertaintyReport): Effect.Effect<string, CiCommandError> =>
  encodeReport(report).pipe(CiCommandError.mapError("Failed to encode the certainty report."));

const DEFAULT_WINDOW = Duration.hours(24);

const parseInstant = (flag: string, value: string): Effect.Effect<DateTime.Utc, CiCommandError> =>
  O.match(DateTime.make(value), {
    onNone: () => CiCommandError.make({ message: `--${flag} must be an ISO-8601 UTC timestamp; received ${value}.` }),
    onSome: Effect.succeed,
  });

const captureLive = Effect.fn("Ci.certaintyCaptureLive")(function* ({
  mainRef,
  maxRequests,
  repoRoot,
  since,
  until,
}: {
  readonly mainRef: string;
  readonly maxRequests: number;
  readonly repoRoot: string;
  readonly since: O.Option<string>;
  readonly until: O.Option<string>;
}) {
  const now = yield* DateTime.now;
  const untilInstant = yield* O.match(until, {
    onNone: () => Effect.succeed(now),
    onSome: (value) => parseInstant("until", value),
  });
  const sinceInstant = yield* O.match(since, {
    onNone: () => Effect.succeed(DateTime.subtractDuration(untilInstant, DEFAULT_WINDOW)),
    onSome: (value) => parseInstant("since", value),
  });
  if (!DateTime.isLessThan(sinceInstant, untilInstant)) {
    return yield* CiCommandError.make({ message: "--since must be earlier than --until." });
  }
  const source = yield* CiCertaintySourceLive();
  return yield* source.capture(
    CiCertaintyCaptureRequest.make({ mainRef, maxRequests, repoRoot, since: sinceInstant, until: untilInstant })
  );
});

/**
 * `beep ci certainty` — the head-level push-to-every-required-green scorecard.
 *
 * **Details**
 *
 * Without `--corpus` it captures the window live (default: the 24 hours
 * before now) under the checkout's GitHub identity, bounded by
 * `--max-requests`; with `--corpus` it replays a captured or committed corpus
 * and reads nothing. `--write-corpus` saves the capture next to the report;
 * the corpus carries branch names, so it is never published. `--summary-out`
 * also writes the aggregates-only Markdown
 * ({@link renderCiCertaintySummaryMarkdown}), before any refusal, for public
 * surfaces such as the nightly workflow's job summary.
 * An uncertified report is printed in full and then the command exits non-zero
 * naming every refusal, unless `--preview` accepts an uncertified run. The
 * reads are background reads under `goals/github-budget-ledger`'s reserve
 * signal: run them by hand and bounded until that signal lands.
 *
 * **Example** (Reference the command)
 *
 * ```ts
 * import { ciCertaintyCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof ciCertaintyCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciCertaintyCommand = Command.make(
  "certainty",
  {
    corpus: Flag.String("corpus").pipe(
      Flag.optional,
      Flag.withDescription("Replay a captured corpus JSON instead of reading GitHub")
    ),
    json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the report as JSON")),
    mainRef: Flag.String("main-ref").pipe(
      Flag.withDefault("origin/main"),
      Flag.withDescription("Git ref whose first-parent history is main")
    ),
    maxRequests: Flag.Int("max-requests").pipe(
      Flag.withDefault(1500),
      Flag.withDescription("Upper bound on GitHub reads; reads past it leave heads api-partial")
    ),
    preview: Flag.Boolean("preview").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Exit zero for an uncertified report; the output keeps its refusal stamp")
    ),
    since: Flag.String("since").pipe(Flag.optional, Flag.withDescription("Inclusive UTC lower bound of head T0")),
    summaryOut: Flag.String("summary-out").pipe(
      Flag.optional,
      Flag.withDescription("Also write the aggregates-only Markdown (no per-head rows) to this path")
    ),
    until: Flag.String("until").pipe(Flag.optional, Flag.withDescription("Exclusive UTC upper bound of head T0")),
    writeCorpus: Flag.String("write-corpus").pipe(
      Flag.optional,
      Flag.withDescription("Write the captured corpus JSON to this path")
    ),
  },
  Effect.fnUntraced(function* ({ corpus, json, mainRef, maxRequests, preview, since, summaryOut, until, writeCorpus }) {
    const fs = yield* FileSystem.FileSystem;
    const repoRoot = yield* findRepoRoot().pipe(Effect.orElseSucceed(() => process.cwd()));
    const captured = yield* O.match(corpus, {
      onSome: (file) =>
        fs
          .readFileString(file)
          .pipe(CiCommandError.mapError(`Failed to read ${file}.`), Effect.flatMap(decodeCiCertaintyCorpus)),
      onNone: () => captureLive({ mainRef, maxRequests, repoRoot, since, until }),
    });
    if (O.isSome(writeCorpus)) {
      const text = yield* encodeCorpus(captured).pipe(
        CiCommandError.mapError("Failed to encode the certainty corpus.")
      );
      yield* fs
        .writeFileString(writeCorpus.value, `${text}\n`)
        .pipe(CiCommandError.mapError(`Failed to write ${writeCorpus.value}.`));
    }
    const report = yield* buildCiCertaintyReport(captured);
    // Written before the refusal below, so a refused night still publishes its stamped summary.
    if (O.isSome(summaryOut)) {
      yield* fs
        .writeFileString(summaryOut.value, `${renderCiCertaintySummaryMarkdown(report)}\n`)
        .pipe(CiCommandError.mapError(`Failed to write ${summaryOut.value}.`));
    }
    yield* Console.log(json ? yield* encodeCiCertaintyReport(report) : renderCiCertaintyMarkdown(report));
    if (!report.certified && !preview) {
      return yield* CiCommandError.make({
        message: `Certification refused: ${A.join(report.refusals, ", ")}. Pass --preview to accept an uncertified report.`,
      });
    }
  })
).pipe(Command.withDescription("Head-level push-to-every-required-green scorecard with the main verdict rate"));
