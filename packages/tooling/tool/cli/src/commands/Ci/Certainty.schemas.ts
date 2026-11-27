/**
 * Schemas for the head-level certainty scorecard (`beep ci certainty`).
 *
 * **Details**
 *
 * The scorecard's unit is the pull-request head SHA, not the workflow run:
 * Heavy contexts come from two producer workflows (`check.yml` and
 * `heavy-admit.yml`), so a per-run unit misses whichever producer finished
 * last. Each head is reduced to one {@link CiCertaintyHeadState}; red, held,
 * cancelled and api-partial heads are misses of the SLO statistic, superseded
 * and still-open heads are censored. The corpus schemas are the wire shapes the
 * live reader captures and the committed fixtures replay, so a replay and a live
 * run go through the same fold.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CiWorkflowJob, CiWorkflowPartialRead, CiWorkflowWindowRun } from "./LaneTimings.ts";

const $I = $RepoCliId.create("commands/Ci/Certainty.schemas");

const NonNegativeInt = S.Int.check(S.isGreaterThanOrEqualTo(0));
const NonNegativeMinutes = S.Finite.check(S.isGreaterThanOrEqualTo(0));
const Share = S.Finite.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1));

/**
 * Terminal or in-flight state of one pull-request head.
 *
 * **Details**
 *
 * `green` means every required context's latest check concluded success or
 * skipped (skip-satisfied counts). `red` means one concluded failure, timed out
 * or needed action. `cancelled` means one was cancelled and none is red.
 * `held` means every producer run finished but a required context was never
 * created, which is how check.yml's hold branch leaves the Heavy contexts
 * "Expected" until the `ready-for-heavy` label lands. `open` means a context is
 * still queued or running at capture time. `api-partial` means a job read for
 * one of the head's runs failed, so the head cannot be judged.
 *
 * **Example** (List the head states)
 *
 * ```ts
 * import { CiCertaintyHeadState } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiCertaintyHeadState.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCertaintyHeadState = LiteralKit(["green", "red", "cancelled", "held", "open", "api-partial"]).pipe(
  $I.annoteSchema("CiCertaintyHeadState", {
    description: "State of one pull-request head over every required context, as the certainty scorecard judges it.",
  })
);

/**
 * **Example** (Type one head state)
 *
 * ```ts
 * import type { CiCertaintyHeadState } from "@beep/repo-cli/commands/Ci"
 *
 * const state: CiCertaintyHeadState = "held"
 * console.log(state)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiCertaintyHeadState = typeof CiCertaintyHeadState.Type;

/**
 * Whether a head changed code or only documentation.
 *
 * **Details**
 *
 * A head is `docs` when its check.yml run created the Docs Policy job, which
 * only a documentation-only change profile does, or (runs before 2026-11-13)
 * when its Heavy Admission job ran the documentation-only admission step.
 * Docs heads finish in minutes and are reported as their own class so they
 * never flatter the code-head statistic.
 *
 * **Example** (List the head classes)
 *
 * ```ts
 * import { CiCertaintyHeadClass } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiCertaintyHeadClass.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCertaintyHeadClass = LiteralKit(["code", "docs"]).pipe(
  $I.annoteSchema("CiCertaintyHeadClass", {
    description: "Code heads and documentation-only heads, reported apart.",
  })
);

/**
 * Whether a head changed code or only documentation.
 *
 * **Example** (Type one head class)
 *
 * ```ts
 * import type { CiCertaintyHeadClass } from "@beep/repo-cli/commands/Ci"
 *
 * const headClass: CiCertaintyHeadClass = "docs"
 * console.log(headClass)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiCertaintyHeadClass = typeof CiCertaintyHeadClass.Type;

/**
 * Why a head is left out of the SLO denominator.
 *
 * **Details**
 *
 * `superseded` means a newer head of the same branch was pushed before this
 * head reached a terminal state; its runner-minutes are reported as a share
 * instead. `open` means the head was still in flight at capture time.
 *
 * **Example** (List the censoring reasons)
 *
 * ```ts
 * import { CiCertaintyCensorReason } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiCertaintyCensorReason.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCertaintyCensorReason = LiteralKit(["superseded", "open"]).pipe(
  $I.annoteSchema("CiCertaintyCensorReason", {
    description: "Reason a head is censored out of the SLO denominator.",
  })
);

/**
 * Why a head is left out of the SLO denominator.
 *
 * **Example** (Type one censoring reason)
 *
 * ```ts
 * import type { CiCertaintyCensorReason } from "@beep/repo-cli/commands/Ci"
 *
 * const reason: CiCertaintyCensorReason = "superseded"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiCertaintyCensorReason = typeof CiCertaintyCensorReason.Type;

/**
 * Workflow that can produce a required context for a pull-request head.
 *
 * **Example** (List the producers)
 *
 * ```ts
 * import { CiCertaintyProducer } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiCertaintyProducer.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCertaintyProducer = LiteralKit(["check.yml", "heavy-admit.yml"]).pipe(
  $I.annoteSchema("CiCertaintyProducer", {
    description: "Workflow file that produced a check run for a pull-request head.",
  })
);

/**
 * Workflow that can produce a required context for a pull-request head.
 *
 * **Example** (Type one producer)
 *
 * ```ts
 * import type { CiCertaintyProducer } from "@beep/repo-cli/commands/Ci"
 *
 * const producer: CiCertaintyProducer = "heavy-admit.yml"
 * console.log(producer)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiCertaintyProducer = typeof CiCertaintyProducer.Type;

/**
 * **Example** (List the context states)
 *
 * ```ts
 * import { CiCertaintyContextState } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiCertaintyContextState.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCertaintyContextState = LiteralKit(["green", "red", "cancelled", "pending", "missing"]).pipe(
  $I.annoteSchema("CiCertaintyContextState", {
    description: "State of one required context's latest check on one head.",
  })
);

/**
 * **Example** (Type one context state)
 *
 * ```ts
 * import type { CiCertaintyContextState } from "@beep/repo-cli/commands/Ci"
 *
 * const state: CiCertaintyContextState = "missing"
 * console.log(state)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiCertaintyContextState = typeof CiCertaintyContextState.Type;

/**
 * **Details**
 *
 * `success` and `failure` are completed verdicts. `cancelled` means every run
 * for the commit was cancelled (typically by a later push in the same
 * concurrency group), `no-run` means no run exists, `open` means a run is
 * still in flight. An unreadable run listing refuses the whole report instead.
 *
 * **Example** (List the main verdicts)
 *
 * ```ts
 * import { CiCertaintyMainVerdict } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiCertaintyMainVerdict.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCertaintyMainVerdict = LiteralKit(["success", "failure", "cancelled", "no-run", "open", "unread"]).pipe(
  $I.annoteSchema("CiCertaintyMainVerdict", {
    description:
      "Hosted verdict a main first-parent commit received from check.yml push runs; unread when the push-run listing did not complete.",
  })
);

/**
 * **Example** (Type one main verdict)
 *
 * ```ts
 * import type { CiCertaintyMainVerdict } from "@beep/repo-cli/commands/Ci"
 *
 * const verdict: CiCertaintyMainVerdict = "cancelled"
 * console.log(verdict)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiCertaintyMainVerdict = typeof CiCertaintyMainVerdict.Type;

/**
 * Who ended a cancelled check.yml push run on main.
 *
 * **Details**
 *
 * check.yml's concurrency group for main never cancels in progress, so GitHub
 * itself only replaces a run that is still pending when a newer push enters
 * the group: such a run has no job and ended when the newer run was created
 * (`concurrency-queue`). A cancelled run that created jobs was cancelled by a
 * person, an agent or an API call (`explicit`); the job token cannot say
 * which, because the login is only in check-run annotations and every agent
 * shares one login. A run with no job and no newer push run created before it
 * ended is `unattributed`; a run whose jobs were not read is `unread`.
 *
 * **Example** (List the cancel actors)
 *
 * ```ts
 * import { CiCertaintyCancelActor } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiCertaintyCancelActor.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCertaintyCancelActor = LiteralKit(["concurrency-queue", "explicit", "unattributed", "unread"]).pipe(
  $I.annoteSchema("CiCertaintyCancelActor", {
    description:
      "Who ended a cancelled check.yml push run on main: GitHub's concurrency queue, an explicit cancel, unattributed, or unread.",
  })
);

/**
 * **Example** (Type one cancel actor)
 *
 * ```ts
 * import type { CiCertaintyCancelActor } from "@beep/repo-cli/commands/Ci"
 *
 * const actor: CiCertaintyCancelActor = "concurrency-queue"
 * console.log(actor)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiCertaintyCancelActor = typeof CiCertaintyCancelActor.Type;

/**
 * **Details**
 *
 * `api-partial` means at least one head or the main run listing could not be
 * read completely, and `empty-population` means no code head was counted. A
 * refused report is still written; it is never evidence for an acceptance
 * number.
 *
 * **Example** (List the refusal reasons)
 *
 * ```ts
 * import { CiCertaintyRefusal } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiCertaintyRefusal.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCertaintyRefusal = LiteralKit(["api-partial", "empty-population"]).pipe(
  $I.annoteSchema("CiCertaintyRefusal", {
    description: "Reason a certainty scorecard is refused certification.",
  })
);

/**
 * **Example** (Type one refusal)
 *
 * ```ts
 * import type { CiCertaintyRefusal } from "@beep/repo-cli/commands/Ci"
 *
 * const refusal: CiCertaintyRefusal = "api-partial"
 * console.log(refusal)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiCertaintyRefusal = typeof CiCertaintyRefusal.Type;

/**
 * **Details**
 *
 * The SLO statistic counts misses as unbounded latencies, so its p95 is
 * `not-attained` whenever more than 5% of the counted heads missed; the value
 * is then absent rather than replaced with the largest green latency.
 *
 * **Example** (List the percentile statuses)
 *
 * ```ts
 * import { CiCertaintyPercentileStatus } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiCertaintyPercentileStatus.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiCertaintyPercentileStatus = LiteralKit(["attained", "not-attained", "empty"]).pipe(
  $I.annoteSchema("CiCertaintyPercentileStatus", {
    description: "Whether a misses-counted percentile was reached, not reached, or had no population.",
  })
);

/**
 * **Example** (Type one percentile status)
 *
 * ```ts
 * import type { CiCertaintyPercentileStatus } from "@beep/repo-cli/commands/Ci"
 *
 * const status: CiCertaintyPercentileStatus = "not-attained"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiCertaintyPercentileStatus = typeof CiCertaintyPercentileStatus.Type;

const partialReadsDefault: ReadonlyArray<CiWorkflowPartialRead> = [];
const mainPushRunsDefault: ReadonlyArray<CiWorkflowWindowRun> = [];

/**
 * One captured producer run for the scorecard corpus.
 *
 * **Example** (Describe a captured check.yml run)
 *
 * ```ts
 * import { CiCertaintyRun, CiWorkflowWindowRun } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const run = CiCertaintyRun.make({
 *   jobs: [],
 *   run: CiWorkflowWindowRun.make({
 *     created_at: DateTime.makeUnsafe("2026-11-09T16:31:06Z"),
 *     event: "pull_request",
 *     head_sha: "eb295434c86ee69071cacf7534866bbdaf42b1cd",
 *     id: 42655575171,
 *     run_attempt: 1,
 *   }),
 *   workflow: "check.yml",
 * })
 * console.log(run.workflow)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyRun extends S.Opaque<CiCertaintyRun, { readonly brand: unique symbol }>()(
  S.Struct({
    jobs: S.Array(CiWorkflowJob),
    partialReads: S.Array(CiWorkflowPartialRead).pipe(
      S.withConstructorDefault(Effect.succeed(partialReadsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(partialReadsDefault))
    ),
    run: CiWorkflowWindowRun,
    workflow: CiCertaintyProducer,
  }).pipe(
    $I.annoteSchema("CiCertaintyRun", {
      description: "One producer workflow run of a pull-request head with its per-attempt job union.",
    })
  )
) {}

const mainRunJobsDefault: ReadonlyArray<CiCertaintyRun> = [];

/**
 * **Example** (Describe a main commit without a run)
 *
 * ```ts
 * import { CiCertaintyMainCommit } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const commit = CiCertaintyMainCommit.make({
 *   committedAt: DateTime.makeUnsafe("2026-11-09T10:00:00Z"),
 *   docsOnly: false,
 *   runs: [],
 *   sha: "5e09d90a6da0000000000000000000000000000",
 * })
 * console.log(commit.runs.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyMainCommit extends S.Opaque<CiCertaintyMainCommit, { readonly brand: unique symbol }>()(
  S.Struct({
    committedAt: S.DateTimeUtcFromString,
    docsOnly: S.Boolean,
    runs: S.Array(CiWorkflowWindowRun),
    sha: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CiCertaintyMainCommit", {
      description: "One main first-parent commit, its documentation-only class and its check.yml push runs.",
    })
  )
) {}

/**
 * **Details**
 *
 * The live reader captures this shape and `--write-corpus` saves it, so a
 * nightly report can be recomputed later from its own inputs; the committed
 * fixture corpus under the CLI's test fixtures uses the same shape. `since` and
 * `until` bound the T0 of counted heads and the commit time of counted main
 * commits; `capturedAt` is the clock every open or superseded judgement uses.
 * `mainHorizonSince` opens the late-arrival horizon: main commits from it to
 * `until` are re-read each night, so a verdict that lands after its own day's
 * capture is counted by a later night. `mainPushRuns` is the whole push-run
 * listing (it names the newer run that replaced a pending one), and
 * `mainRunJobs` holds the jobs of the push runs of the window's commits.
 * Corpora captured before these fields decode with no horizon and no main
 * jobs, so their cancel actors read `unread`.
 *
 * **Example** (Describe an empty corpus)
 *
 * ```ts
 * import { CiCertaintyCorpus } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
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
 * console.log(corpus.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyCorpus extends S.Opaque<CiCertaintyCorpus, { readonly brand: unique symbol }>()(
  S.Struct({
    capturedAt: S.DateTimeUtcFromString,
    mainCommits: S.Array(CiCertaintyMainCommit),
    mainHorizonSince: S.DateTimeUtcFromString.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    mainListingPartial: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    mainPushRuns: S.Array(CiWorkflowWindowRun).pipe(
      S.withConstructorDefault(Effect.succeed(mainPushRunsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(mainPushRunsDefault))
    ),
    mainRunJobs: S.Array(CiCertaintyRun).pipe(
      S.withConstructorDefault(Effect.succeed(mainRunJobsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(mainRunJobsDefault))
    ),
    pullRequestRuns: S.Array(CiCertaintyRun),
    requestCount: NonNegativeInt,
    requiredContexts: S.Array(S.NonEmptyString),
    schemaVersion: S.tag("ci-certainty-corpus/v1"),
    since: S.DateTimeUtcFromString,
    until: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("CiCertaintyCorpus", {
      description:
        "Captured producer runs, main commits and required contexts one certainty scorecard is computed from.",
    })
  )
) {}

/**
 * **Example** (Describe a green context)
 *
 * ```ts
 * import { CiCertaintyContextRow } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const row = CiCertaintyContextRow.make({
 *   context: "Heavy / Check",
 *   producer: O.some("check.yml"),
 *   runAttempt: O.some(1),
 *   runId: O.some(42655575171),
 *   state: "green",
 * })
 * console.log(row.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyContextRow extends S.Opaque<CiCertaintyContextRow, { readonly brand: unique symbol }>()(
  S.Struct({
    context: S.NonEmptyString,
    producer: S.OptionFromNullOr(CiCertaintyProducer),
    runAttempt: S.OptionFromNullOr(S.Finite),
    runId: S.OptionFromNullOr(S.Finite),
    state: CiCertaintyContextState,
  }).pipe(
    $I.annoteSchema("CiCertaintyContextRow", {
      description: "Latest-start-wins check for one required context on one head, with its producer and attempt.",
    })
  )
) {}

/**
 * **Example** (Describe a run's runner-minutes)
 *
 * ```ts
 * import { CiCertaintyRunnerMinutes } from "@beep/repo-cli/commands/Ci"
 *
 * const minutes = CiCertaintyRunnerMinutes.make({ githubHosted: 210, managed: 105, unknown: 0 })
 * console.log(minutes.managed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyRunnerMinutes extends S.Opaque<CiCertaintyRunnerMinutes, { readonly brand: unique symbol }>()(
  S.Struct({
    githubHosted: NonNegativeMinutes,
    managed: NonNegativeMinutes,
    unknown: NonNegativeMinutes,
  }).pipe(
    $I.annoteSchema("CiCertaintyRunnerMinutes", {
      description:
        "Raw runner-minutes split into GitHub-hosted, managed (self-hosted beep-* pools) and unclassified runners.",
    })
  )
) {}

/**
 * **Details**
 *
 * `t0` is the `created_at` of the head's first check.yml pull_request run (see
 * the report's `clockSource`). `requiredGreenMinutes` is present only for a
 * green head; `mergeableGreenMinutes` additionally needs the Yeet-mergeable
 * contexts green. `censor` is set for superseded and open heads, which stay out
 * of every percentile.
 *
 * **Example** (Read a head row's state)
 *
 * ```ts
 * import type { CiCertaintyHeadRow } from "@beep/repo-cli/commands/Ci"
 *
 * const stateOf = (row: CiCertaintyHeadRow) => row.state
 * console.log(typeof stateOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyHeadRow extends S.Opaque<CiCertaintyHeadRow, { readonly brand: unique symbol }>()(
  S.Struct({
    attempts: NonNegativeInt,
    censor: S.OptionFromNullOr(CiCertaintyCensorReason),
    contexts: S.Array(CiCertaintyContextRow),
    coverageVerdictMinutes: S.OptionFromNullOr(NonNegativeMinutes),
    criticalContext: S.OptionFromNullOr(S.NonEmptyString),
    headClass: CiCertaintyHeadClass,
    headSha: S.NonEmptyString,
    mergeableGreenMinutes: S.OptionFromNullOr(NonNegativeMinutes),
    producers: S.Array(CiCertaintyProducer),
    requiredGreenMinutes: S.OptionFromNullOr(NonNegativeMinutes),
    rulesetDigest: S.NonEmptyString,
    runnerMinutes: CiCertaintyRunnerMinutes,
    state: CiCertaintyHeadState,
    t0: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("CiCertaintyHeadRow", {
      description: "One pull-request head judged over every required context, with its latency, cost and censoring.",
    })
  )
) {}

/**
 * **Example** (Read a commit row's verdict)
 *
 * ```ts
 * import type { CiCertaintyMainRow } from "@beep/repo-cli/commands/Ci"
 *
 * const verdictOf = (row: CiCertaintyMainRow) => row.verdict
 * console.log(typeof verdictOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyMainRow extends S.Opaque<CiCertaintyMainRow, { readonly brand: unique symbol }>()(
  S.Struct({
    committedAt: S.DateTimeUtcFromString,
    docsOnly: S.Boolean,
    runIds: S.Array(S.Finite),
    sha: S.NonEmptyString,
    verdict: CiCertaintyMainVerdict,
  }).pipe(
    $I.annoteSchema("CiCertaintyMainRow", {
      description: "One main first-parent commit and the hosted verdict its check.yml push runs gave it.",
    })
  )
) {}

/**
 * **Details**
 *
 * `n` is the counted population (terminal, uncensored heads). A miss is a
 * counted head that never reached the measured state; misses enter the
 * percentile as unbounded values, so turning a green head into a miss can only
 * raise or keep the statistic. `p50Minutes` and `p95Minutes` are nearest-rank
 * and absent when not attained or empty. `withinTen` counts counted heads that
 * reached the state within ten minutes.
 *
 * **Example** (Describe an empty statistic)
 *
 * ```ts
 * import { CiCertaintyLatencyStat } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const stat = CiCertaintyLatencyStat.make({
 *   censoredOpen: 0,
 *   censoredSuperseded: 0,
 *   misses: 0,
 *   n: 0,
 *   p50Minutes: O.none(),
 *   p50Status: "empty",
 *   p95Minutes: O.none(),
 *   p95Status: "empty",
 *   withinTen: 0,
 * })
 * console.log(stat.p95Status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyLatencyStat extends S.Opaque<CiCertaintyLatencyStat, { readonly brand: unique symbol }>()(
  S.Struct({
    censoredOpen: NonNegativeInt,
    censoredSuperseded: NonNegativeInt,
    misses: NonNegativeInt,
    n: NonNegativeInt,
    p50Minutes: S.OptionFromNullOr(NonNegativeMinutes),
    p50Status: CiCertaintyPercentileStatus,
    p95Minutes: S.OptionFromNullOr(NonNegativeMinutes),
    p95Status: CiCertaintyPercentileStatus,
    withinTen: NonNegativeInt,
  }).pipe(
    $I.annoteSchema("CiCertaintyLatencyStat", {
      description:
        "Nearest-rank latency percentiles with misses counted as unbounded and censored heads counted apart.",
    })
  )
) {}

/**
 * **Details**
 *
 * A heavy-admit.yml run joins the latest check.yml run of its head created at
 * or before it, so a head admitted by the `ready-for-heavy` label carries its
 * heavy-pool minutes just as one admitted inside check.yml does. A
 * heavy-admit.yml run whose Heavy Admission was skipped is not counted. `runs`
 * counts head attempts; the green code-run percentiles cover the attempts of
 * code heads whose check.yml run succeeded.
 *
 * **Example** (Describe an empty runner-minute statistic)
 *
 * ```ts
 * import { CiCertaintyRunnerStat } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const stat = CiCertaintyRunnerStat.make({
 *   greenCodeRunP50: O.none(),
 *   greenCodeRunP95: O.none(),
 *   meanGithubHosted: O.none(),
 *   meanManaged: O.none(),
 *   meanTotal: O.none(),
 *   p50Total: O.none(),
 *   p95Total: O.none(),
 *   runs: 0,
 * })
 * console.log(stat.runs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyRunnerStat extends S.Opaque<CiCertaintyRunnerStat, { readonly brand: unique symbol }>()(
  S.Struct({
    greenCodeRunP50: S.OptionFromNullOr(NonNegativeMinutes),
    greenCodeRunP95: S.OptionFromNullOr(NonNegativeMinutes),
    meanGithubHosted: S.OptionFromNullOr(NonNegativeMinutes),
    meanManaged: S.OptionFromNullOr(NonNegativeMinutes),
    meanTotal: S.OptionFromNullOr(NonNegativeMinutes),
    p50Total: S.OptionFromNullOr(NonNegativeMinutes),
    p95Total: S.OptionFromNullOr(NonNegativeMinutes),
    runs: NonNegativeInt,
  }).pipe(
    $I.annoteSchema("CiCertaintyRunnerStat", {
      description:
        "Raw runner-minutes per head attempt (a check.yml run plus its admitted heavy-admit.yml runs), split by pool, with green code-attempt percentiles.",
    })
  )
) {}

/**
 * Main verdict rate over non-docs first-parent commits.
 *
 * **Details**
 *
 * When the check.yml push-run listing did not complete, every commit is
 * `unread` rather than `no-run`, and `rate` is none: an unread listing is not
 * evidence that main ran nothing.
 *
 * **Example** (Describe an empty verdict statistic)
 *
 * ```ts
 * import { CiCertaintyMainStat } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const stat = CiCertaintyMainStat.make({
 *   cancelled: 0,
 *   commits: 0,
 *   docsCommits: 0,
 *   noRun: 0,
 *   open: 0,
 *   rate: O.none(),
 *   unread: 0,
 *   verdicts: 0,
 * })
 * console.log(stat.commits)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyMainStat extends S.Opaque<CiCertaintyMainStat, { readonly brand: unique symbol }>()(
  S.Struct({
    cancelled: NonNegativeInt,
    commits: NonNegativeInt,
    docsCommits: NonNegativeInt,
    noRun: NonNegativeInt,
    open: NonNegativeInt,
    rate: S.OptionFromNullOr(Share),
    unread: NonNegativeInt,
    verdicts: NonNegativeInt,
  }).pipe(
    $I.annoteSchema("CiCertaintyMainStat", {
      description: "Share of non-docs main first-parent commits that received a completed, non-cancelled verdict.",
    })
  )
) {}

/**
 * Share of planned pull-request runs whose Test Unit selection was owner-scoped.
 *
 * **Example** (Describe an empty conversion statistic)
 *
 * ```ts
 * import { CiCertaintyTestUnitConversion } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const stat = CiCertaintyTestUnitConversion.make({ fullLayoutJobs: 24, ownerScopedRuns: 0, plannedRuns: 0, share: O.none() })
 * console.log(stat.fullLayoutJobs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyTestUnitConversion extends S.Opaque<
  CiCertaintyTestUnitConversion,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    fullLayoutJobs: NonNegativeInt,
    ownerScopedRuns: NonNegativeInt,
    plannedRuns: NonNegativeInt,
    share: S.OptionFromNullOr(Share),
  }).pipe(
    $I.annoteSchema("CiCertaintyTestUnitConversion", {
      description:
        "Non-docs pull-request check.yml runs whose Test Plan allocated fewer Test Unit partition jobs than the full layout.",
    })
  )
) {}

/**
 * Admission-to-Heavy start latency over the producer runs of code heads.
 *
 * **Details**
 *
 * Each check.yml or heavy-admit.yml run pairs its own Heavy Admission start
 * with its first executed job on the heavy pool (managed `beep-` runner
 * labels). Hosted jobs named `Heavy / ...`, such as the Test Integration
 * aggregate, are not heavy-pool pickup and never count.
 *
 * **Example** (Describe an empty admission statistic)
 *
 * ```ts
 * import { CiCertaintyAdmissionStat } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * console.log(CiCertaintyAdmissionStat.make({ n: 0, p50Minutes: O.none(), p95Minutes: O.none() }).n)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyAdmissionStat extends S.Opaque<CiCertaintyAdmissionStat, { readonly brand: unique symbol }>()(
  S.Struct({
    n: NonNegativeInt,
    p50Minutes: S.OptionFromNullOr(NonNegativeMinutes),
    p95Minutes: S.OptionFromNullOr(NonNegativeMinutes),
  }).pipe(
    $I.annoteSchema("CiCertaintyAdmissionStat", {
      description:
        "Median and p95 minutes from a run's Heavy Admission start to the start of its first executed job on the heavy pool; the p95 is the heavy-wait row.",
    })
  )
) {}

/**
 * Nearest-rank summary of one per-run or per-job quantity.
 *
 * **Details**
 *
 * The unit is the report field's: minutes for the latency and wall rows,
 * runner-minutes for heavy slot-minutes, a job count for the replay inputs.
 * Every statistic is absent when `n` is zero.
 *
 * **Example** (Describe an empty distribution)
 *
 * ```ts
 * import { CiCertaintyDistribution } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const empty = CiCertaintyDistribution.make({ max: O.none(), mean: O.none(), n: 0, p50: O.none(), p95: O.none() })
 * console.log(empty.n)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyDistribution extends S.Opaque<CiCertaintyDistribution, { readonly brand: unique symbol }>()(
  S.Struct({
    max: S.OptionFromNullOr(NonNegativeMinutes),
    mean: S.OptionFromNullOr(NonNegativeMinutes),
    n: NonNegativeInt,
    p50: S.OptionFromNullOr(NonNegativeMinutes),
    p95: S.OptionFromNullOr(NonNegativeMinutes),
  }).pipe(
    $I.annoteSchema("CiCertaintyDistribution", {
      description:
        "Count, mean, nearest-rank p50 and p95, and maximum of one non-negative per-run or per-job quantity.",
    })
  )
) {}

/**
 * One check.yml push run of a main commit inside the window.
 *
 * **Details**
 *
 * `hostedJobs` and `heavyJobs` count the attempt-one jobs that started on a
 * GitHub-hosted or a managed heavy-pool runner; with the commit's
 * `committedAt` they are the merge-timestamp replay's inputs. Both, and
 * `cancelActor`, are absent when the run's jobs were not read; `cancelActor`
 * is also absent for a run that was not cancelled.
 *
 * **Example** (Read a run row's hosted job count)
 *
 * ```ts
 * import type { CiCertaintyMainRunRow } from "@beep/repo-cli/commands/Ci"
 *
 * const hostedJobsOf = (row: CiCertaintyMainRunRow) => row.hostedJobs
 * console.log(typeof hostedJobsOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyMainRunRow extends S.Opaque<CiCertaintyMainRunRow, { readonly brand: unique symbol }>()(
  S.Struct({
    cancelActor: S.OptionFromNullOr(CiCertaintyCancelActor),
    conclusion: S.OptionFromNullOr(S.String),
    createdAt: S.DateTimeUtcFromString,
    heavyJobs: S.OptionFromNullOr(NonNegativeInt),
    hostedJobs: S.OptionFromNullOr(NonNegativeInt),
    runId: S.Finite,
    sha: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CiCertaintyMainRunRow", {
      description:
        "One check.yml push run of a main commit in the window with its started hosted and heavy job counts and, when cancelled, its cancel actor.",
    })
  )
) {}

/**
 * Cancelled check.yml push runs of the window's main commits, by cancel actor.
 *
 * **Details**
 *
 * `explicit` is the upper bound on agent-initiated main cancels that
 * `goals/main-verdict-every-commit` reads; `concurrency-queue` cancels are
 * GitHub replacing a pending run and are no actor's.
 *
 * **Example** (Describe a day without cancels)
 *
 * ```ts
 * import { CiCertaintyMainCancelStat } from "@beep/repo-cli/commands/Ci"
 *
 * const stat = CiCertaintyMainCancelStat.make({
 *   cancelledRuns: 0,
 *   concurrencyQueue: 0,
 *   explicit: 0,
 *   unattributed: 0,
 *   unread: 0,
 * })
 * console.log(stat.explicit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyMainCancelStat extends S.Opaque<CiCertaintyMainCancelStat, { readonly brand: unique symbol }>()(
  S.Struct({
    cancelledRuns: NonNegativeInt,
    concurrencyQueue: NonNegativeInt,
    explicit: NonNegativeInt,
    unattributed: NonNegativeInt,
    unread: NonNegativeInt,
  }).pipe(
    $I.annoteSchema("CiCertaintyMainCancelStat", {
      description: "Cancelled check.yml push runs of the window's main commits counted by cancel actor.",
    })
  )
) {}

/**
 * Main verdict rate over the late-arrival horizon.
 *
 * **Details**
 *
 * `stat` covers the non-docs first-parent commits from `since` to the
 * report's `until`, read at this capture, so a commit whose verdict landed
 * after its own day's capture is counted here. `lateVerdicts` counts those
 * commits whose deciding run started a day or more after the commit, which is
 * how a re-run or a re-dispatched verdict arrives. A corpus captured without a
 * horizon reports `since` equal to the report's `since`.
 *
 * **Example** (Read the horizon rate)
 *
 * ```ts
 * import type { CiCertaintyMainHorizon } from "@beep/repo-cli/commands/Ci"
 *
 * const rateOf = (horizon: CiCertaintyMainHorizon) => horizon.stat.rate
 * console.log(typeof rateOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyMainHorizon extends S.Opaque<CiCertaintyMainHorizon, { readonly brand: unique symbol }>()(
  S.Struct({
    lateVerdicts: NonNegativeInt,
    since: S.DateTimeUtcFromString,
    stat: CiCertaintyMainStat,
  }).pipe(
    $I.annoteSchema("CiCertaintyMainHorizon", {
      description:
        "Main verdict rate re-read over the late-arrival horizon, with the verdicts that arrived a day late.",
    })
  )
) {}

/**
 * Inputs of the merge-timestamp replay in aggregate.
 *
 * **Details**
 *
 * The per-commit merge timestamps are `mainRows[].committedAt` and the
 * per-run job counts are `mainRuns[]`; these are their aggregates.
 * `pullRequestRunHostedJobs` counts the started GitHub-hosted jobs of each
 * code pull-request head attempt (a check.yml run plus its admitted heavy-admit.yml
 * runs), `mainRunHostedJobs` those of each main push run that started a job.
 *
 * **Example** (Read the main run job count p95)
 *
 * ```ts
 * import type { CiCertaintyReplayInputs } from "@beep/repo-cli/commands/Ci"
 *
 * const p95Of = (inputs: CiCertaintyReplayInputs) => inputs.mainRunHostedJobs.p95
 * console.log(typeof p95Of)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyReplayInputs extends S.Opaque<CiCertaintyReplayInputs, { readonly brand: unique symbol }>()(
  S.Struct({
    mainMerges: NonNegativeInt,
    mainRunHostedJobs: CiCertaintyDistribution,
    pullRequestRunHostedJobs: CiCertaintyDistribution,
  }).pipe(
    $I.annoteSchema("CiCertaintyReplayInputs", {
      description:
        "Main merge count and hosted jobs per main push run and per pull-request head attempt, the merge-timestamp replay's inputs.",
    })
  )
) {}

/**
 * **Details**
 *
 * `slo` is the headline: p95 push to every required context green over code
 * heads with misses counted. Everything else is reported beside it, never
 * inside it: the green-only diagnostic, push to Yeet-mergeable, the coverage
 * verdict, docs heads, runner-minutes, the superseded share and the main
 * verdict rate. The sibling-goal rows (`heavySlotMinutes`, `heavyQueue`,
 * `lintPolicyWall`, `propertyLaws`, `firstWavePickup`, `admissionToHeavy`'s
 * heavy-wait p95, `mainCancels`, `mainHorizon` and `replayInputs`) cover code
 * heads and the window's main commits. `certified` is false whenever `refusals` is non-empty, and an
 * uncertified report is never acceptance evidence. `notCovered` names what the
 * scorecard does not measure.
 *
 * **Example** (Read the headline status)
 *
 * ```ts
 * import type { CiCertaintyReport } from "@beep/repo-cli/commands/Ci"
 *
 * const headline = (report: CiCertaintyReport) => report.slo.p95Status
 * console.log(typeof headline)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiCertaintyReport extends S.Opaque<CiCertaintyReport, { readonly brand: unique symbol }>()(
  S.Struct({
    admissionToHeavy: CiCertaintyAdmissionStat,
    capturedAt: S.DateTimeUtcFromString,
    certified: S.Boolean,
    clockSource: S.NonEmptyString,
    coverageVerdict: CiCertaintyLatencyStat,
    docsHeads: CiCertaintyLatencyStat,
    firstWavePickup: CiCertaintyDistribution,
    greenOnly: CiCertaintyLatencyStat,
    heads: S.Array(CiCertaintyHeadRow),
    heavyQueue: CiCertaintyDistribution,
    heavySlotMinutes: CiCertaintyDistribution,
    lintPolicyWall: CiCertaintyDistribution,
    main: CiCertaintyMainStat,
    mainCancels: CiCertaintyMainCancelStat,
    mainHorizon: CiCertaintyMainHorizon,
    mainRows: S.Array(CiCertaintyMainRow),
    mainRuns: S.Array(CiCertaintyMainRunRow),
    mergeable: CiCertaintyLatencyStat,
    notCovered: S.Array(S.NonEmptyString),
    partialReads: S.Array(CiWorkflowPartialRead),
    propertyLaws: CiCertaintyDistribution,
    refusals: S.Array(CiCertaintyRefusal),
    replayInputs: CiCertaintyReplayInputs,
    requestCount: NonNegativeInt,
    requiredContexts: S.Array(S.NonEmptyString),
    rulesetDigest: S.NonEmptyString,
    runnerMinutes: CiCertaintyRunnerStat,
    schemaVersion: S.tag("ci-certainty-report/v1"),
    since: S.DateTimeUtcFromString,
    slo: CiCertaintyLatencyStat,
    supersededRunnerMinuteShare: S.OptionFromNullOr(Share),
    testUnitConversion: CiCertaintyTestUnitConversion,
    until: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("CiCertaintyReport", {
      description:
        "Head-level push-to-every-required-green scorecard with misses counted, censoring reported and every beside-row.",
    })
  )
) {}
