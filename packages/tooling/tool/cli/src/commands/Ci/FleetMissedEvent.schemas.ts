/**
 * Schemas of the standing fleet missed-event check
 * (`beep ci fleet-missed-event-check`): the GitHub reads it makes, the hook-source
 * configuration, each job's delivery evidence and verdict, and the report.
 *
 * **Details**
 *
 * Specification:
 * `goals/infra-alchemy-rebuild/decisions/2026-11-23-standing-missed-event-check.md`.
 * Times are epoch milliseconds. Hook delivery ids exceed 2^53, so they are
 * {@link FleetDeliveryId} strings end to end and never JSON numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Ci/FleetMissedEvent.schemas");

/**
 * The seconds between the two org-runner reads of one run.
 *
 * **Example** (Read the gap)
 *
 * ```ts
 * import { FLEET_RUNNER_READ_GAP } from "@beep/repo-cli/commands/Ci"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(FLEET_RUNNER_READ_GAP)) // 300
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FLEET_RUNNER_READ_GAP = Duration.seconds(300);

/**
 * The thresholds the verdicts read, in milliseconds.
 *
 * **Details**
 *
 * - `noLaunchAge`: a job queued this long below cap can be `NoLaunch`.
 * - `missedDeliveryAge`: a job this old must have its `queued` delivery.
 * - `progressWindow`: a pool started a job this recently, or made no progress.
 * - `wedgedAge`: a pool job queued this long at cap with no progress wedges it.
 * - `lookback`: runs created this recently carry the started jobs, and a job
 *   queued this long below cap is `NoLaunch` whatever its rank.
 * - `deliveryLead` and `deliveryLag`: a job's delivery lands between its
 *   creation minus the lead and its creation plus the lag.
 *
 * **Example** (Read the NoLaunch threshold)
 *
 * ```ts
 * import { FLEET_THRESHOLDS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FLEET_THRESHOLDS.noLaunchAge) // 600000
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FLEET_THRESHOLDS = {
  noLaunchAge: Duration.toMillis(Duration.minutes(10)),
  missedDeliveryAge: Duration.toMillis(Duration.minutes(5)),
  progressWindow: Duration.toMillis(Duration.minutes(15)),
  wedgedAge: Duration.toMillis(Duration.minutes(15)),
  lookback: Duration.toMillis(Duration.hours(2)),
  deliveryLead: Duration.toMillis(Duration.minutes(2)),
  deliveryLag: Duration.toMillis(Duration.minutes(5)),
} as const;

/**
 * Milliseconds since the Unix epoch.
 *
 * **Example** (Accept a time)
 *
 * ```ts
 * import { EpochMillis } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EpochMillis)(1763845200000)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EpochMillis = S.Finite.pipe($I.annoteSchema("EpochMillis", { description: "Milliseconds since 1970." }));

/**
 * A webhook delivery id: decimal digits kept as a string, because GitHub's
 * ids exceed 2^53 and a JSON number would round them.
 *
 * **Example** (Accept a real delivery id)
 *
 * ```ts
 * import { FleetDeliveryId } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(FleetDeliveryId)("3855552300210716674")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetDeliveryId = S.String.check(S.isPattern(/^\d+$/u)).pipe(
  $I.annoteSchema("FleetDeliveryId", { description: "A webhook delivery id as a decimal string." })
);

/**
 * Decoded delivery id.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetDeliveryId = typeof FleetDeliveryId.Type;

/**
 * One runner pool the check watches: its name, the job and runner label,
 * and the cap it runs at.
 *
 * **Example** (The heavy pool)
 *
 * ```ts
 * import { FleetPoolCap } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetPoolCap.make({ pool: "heavy", label: "beep-fleet-heavy", cap: 2 }).cap) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetPoolCap extends S.Opaque<FleetPoolCap, { readonly brand: unique symbol }>()(
  S.Struct({
    pool: S.String,
    label: S.String,
    cap: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  }).pipe($I.annoteSchema("FleetPoolCap", { description: "A watched pool's name, label and cap." }))
) {}

/**
 * The phases the generated caps projection carries.
 *
 * **Example** (Read the phases)
 *
 * ```ts
 * import { FleetCapPhase } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetCapPhase.literals) // ["overlap", "primary"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetCapPhase = LiteralKit(["overlap", "primary"]).pipe(
  $I.annoteSchema("FleetCapPhase", { description: "A fleet phase of the caps projection." })
);

/**
 * Decoded caps phase.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetCapPhase = typeof FleetCapPhase.Type;

/**
 * The generated caps projection's shape, so the check decodes it rather
 * than trusting it.
 *
 * **Example** (Decode a projection)
 *
 * ```ts
 * import { FleetPoolCapsInput } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(FleetPoolCapsInput)({
 *   phase: "primary",
 *   pools: [{ pool: "heavy", label: "beep-fleet-heavy", overlap: 1, primary: 2 }],
 * })
 * console.log(input.pools.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetPoolCapsInput extends S.Opaque<FleetPoolCapsInput, { readonly brand: unique symbol }>()(
  S.Struct({
    phase: FleetCapPhase,
    pools: S.Array(
      S.Struct({
        pool: S.String,
        label: S.String,
        overlap: S.Int.check(S.isGreaterThanOrEqualTo(0)),
        primary: S.Int.check(S.isGreaterThanOrEqualTo(0)),
      })
    ),
  }).pipe($I.annoteSchema("FleetPoolCapsInput", { description: "The generated per-phase caps of every pool." }))
) {}

/**
 * One registered org runner as one read saw it.
 *
 * **Example** (An idle heavy runner)
 *
 * ```ts
 * import { FleetRunner } from "@beep/repo-cli/commands/Ci"
 *
 * const runner = FleetRunner.make({ id: 7, name: "beep-fleet-heavy-i-0a", online: true, busy: false, labels: ["beep-fleet-heavy"] })
 * console.log(runner.online && !runner.busy) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetRunner extends S.Opaque<FleetRunner, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Finite,
    name: S.String,
    online: S.Boolean,
    busy: S.Boolean,
    labels: S.Array(S.String),
  }).pipe($I.annoteSchema("FleetRunner", { description: "One org runner's id, name, status, busy flag and labels." }))
) {}

/**
 * One page of the org's self-hosted runners.
 *
 * **Example** (An empty page)
 *
 * ```ts
 * import { FleetRunnersPage } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetRunnersPage.make({ runners: [], totalCount: 0 }).totalCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetRunnersPage extends S.Opaque<FleetRunnersPage, { readonly brand: unique symbol }>()(
  S.Struct({ runners: S.Array(FleetRunner), totalCount: S.Finite }).pipe(
    $I.annoteSchema("FleetRunnersPage", { description: "One page of org runners and the listing's total." })
  )
) {}

/**
 * The run statuses the check lists by status.
 *
 * **Example** (Read the listed statuses)
 *
 * ```ts
 * import { FleetRunStatus } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetRunStatus.literals) // ["queued", "in_progress"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetRunStatus = LiteralKit(["queued", "in_progress"]).pipe(
  $I.annoteSchema("FleetRunStatus", { description: "A workflow run status the check lists." })
);

/**
 * Decoded run status.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetRunStatus = typeof FleetRunStatus.Type;

/**
 * Which workflow runs one listing reads: those with a status, or those
 * created at or after a time.
 *
 * **Example** (List the queued runs)
 *
 * ```ts
 * import { FleetRunsQuery } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetRunsQuery.cases.ByStatus.make({ status: "queued" })._tag) // "ByStatus"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetRunsQuery = S.TaggedUnion({
  ByStatus: { status: FleetRunStatus },
  CreatedSince: { since: EpochMillis },
}).pipe($I.annoteSchema("FleetRunsQuery", { description: "A workflow-run listing by status or creation time." }));

/**
 * Decoded runs query.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetRunsQuery = typeof FleetRunsQuery.Type;

/**
 * One page of workflow run ids.
 *
 * **Example** (One queued run)
 *
 * ```ts
 * import { FleetRunsPage } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetRunsPage.make({ runIds: [45066910700], totalCount: 1 }).runIds.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetRunsPage extends S.Opaque<FleetRunsPage, { readonly brand: unique symbol }>()(
  S.Struct({ runIds: S.Array(S.Finite), totalCount: S.Finite }).pipe(
    $I.annoteSchema("FleetRunsPage", { description: "One page of workflow run ids and the listing's total." })
  )
) {}

/**
 * One workflow job, with the fields the verdicts read.
 *
 * **Example** (A queued heavy job)
 *
 * ```ts
 * import { FleetJob } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const job = FleetJob.make({
 *   id: 137354449472,
 *   runId: 45066910700,
 *   name: "Heavy / Lint Policy",
 *   status: "queued",
 *   labels: ["beep-fleet-heavy"],
 *   createdAt: 0,
 *   startedAt: O.none(),
 *   runnerName: O.none(),
 * })
 * console.log(job.status) // "queued"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetJob extends S.Opaque<FleetJob, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Finite,
    runId: S.Finite,
    name: S.String,
    status: S.String,
    labels: S.Array(S.String),
    createdAt: EpochMillis,
    startedAt: S.Option(EpochMillis),
    runnerName: S.Option(S.String),
  }).pipe($I.annoteSchema("FleetJob", { description: "One workflow job's ids, status, labels, times and runner." }))
) {}

/**
 * One page of a run's jobs.
 *
 * **Example** (An empty page)
 *
 * ```ts
 * import { FleetJobsPage } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetJobsPage.make({ jobs: [], totalCount: 0 }).jobs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetJobsPage extends S.Opaque<FleetJobsPage, { readonly brand: unique symbol }>()(
  S.Struct({ jobs: S.Array(FleetJob), totalCount: S.Finite }).pipe(
    $I.annoteSchema("FleetJobsPage", { description: "One page of a run's jobs and the listing's total." })
  )
) {}

/**
 * One delivery of a webhook, from the deliveries listing.
 *
 * **Example** (A delivered queued event)
 *
 * ```ts
 * import { FleetHookDelivery } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const delivery = FleetHookDelivery.make({
 *   id: "3855552300210716674",
 *   deliveredAt: 0,
 *   statusCode: 200,
 *   action: O.some("queued"),
 * })
 * console.log(delivery.statusCode) // 200
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetHookDelivery extends S.Opaque<FleetHookDelivery, { readonly brand: unique symbol }>()(
  S.Struct({
    id: FleetDeliveryId,
    deliveredAt: EpochMillis,
    statusCode: S.Finite,
    action: S.Option(S.String),
  }).pipe($I.annoteSchema("FleetHookDelivery", { description: "One hook delivery's id, time, status and action." }))
) {}

/**
 * One cursor page of a hook's deliveries, newest first.
 *
 * **Example** (The last page)
 *
 * ```ts
 * import { FleetHookDeliveriesPage } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const page = FleetHookDeliveriesPage.make({ deliveries: [], nextCursor: O.none() })
 * console.log(O.isNone(page.nextCursor)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetHookDeliveriesPage extends S.Opaque<FleetHookDeliveriesPage, { readonly brand: unique symbol }>()(
  S.Struct({ deliveries: S.Array(FleetHookDelivery), nextCursor: S.Option(S.String) }).pipe(
    $I.annoteSchema("FleetHookDeliveriesPage", { description: "One page of hook deliveries and the next cursor." })
  )
) {}

/**
 * The detail of one delivery: the workflow job id its payload names.
 *
 * **Example** (A detail naming a job)
 *
 * ```ts
 * import { FleetDeliveryDetail } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const detail = FleetDeliveryDetail.make({ id: "21", workflowJobId: O.some("137354449472") })
 * console.log(O.getOrElse(detail.workflowJobId, () => "none")) // "137354449472"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetDeliveryDetail extends S.Opaque<FleetDeliveryDetail, { readonly brand: unique symbol }>()(
  S.Struct({ id: FleetDeliveryId, workflowJobId: S.Option(S.String) }).pipe(
    $I.annoteSchema("FleetDeliveryDetail", { description: "One delivery's id and its payload's workflow job id." })
  )
) {}

/**
 * One scheduled run of the check's own workflow.
 *
 * **Example** (One scheduled run)
 *
 * ```ts
 * import { FleetScheduledRun } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetScheduledRun.make({ id: 5, createdAt: 0 }).id) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetScheduledRun extends S.Opaque<FleetScheduledRun, { readonly brand: unique symbol }>()(
  S.Struct({ id: S.Finite, createdAt: EpochMillis }).pipe(
    $I.annoteSchema("FleetScheduledRun", { description: "One scheduled run's id and creation time." })
  )
) {}

/**
 * Where a job's `queued` delivery is read from: a repository hook, or no
 * hook at all (from P5 step 6b, when the gate owns delivery evidence).
 *
 * **Example** (The pre-6b source)
 *
 * ```ts
 * import { FleetHookSource } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetHookSource.cases.RepositoryHook.make({ hookId: "714397446" }).hookId) // "714397446"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetHookSource = S.TaggedUnion({
  RepositoryHook: { hookId: FleetDeliveryId },
  NoHook: {},
}).pipe($I.annoteSchema("FleetHookSource", { description: "A repository hook, or no hook source." }));

/**
 * Decoded hook source.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetHookSource = typeof FleetHookSource.Type;

/**
 * One hook source and the time it takes effect.
 *
 * **Example** (The 6b switch)
 *
 * ```ts
 * import { FleetHookSource, FleetHookSourceEntry } from "@beep/repo-cli/commands/Ci"
 *
 * const entry = FleetHookSourceEntry.make({ source: FleetHookSource.cases.NoHook.make({}), effectiveFrom: 1000 })
 * console.log(entry.source._tag) // "NoHook"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetHookSourceEntry extends S.Opaque<FleetHookSourceEntry, { readonly brand: unique symbol }>()(
  S.Struct({ source: FleetHookSource, effectiveFrom: EpochMillis }).pipe(
    $I.annoteSchema("FleetHookSourceEntry", { description: "A hook source and when it takes effect." })
  )
) {}

/**
 * The hook-source configuration: each job is classified by the entry in
 * effect at its creation.
 *
 * **Details**
 *
 * Today the source is repository hook 714397446, the new fleet's Lambda URL.
 * The 6b pull request appends a `NoHook` entry effective from its cutover,
 * drops the repository-hooks read and so switches the classifier to
 * `delivery evidence: gate`.
 *
 * **Example** (Read today's source)
 *
 * ```ts
 * import { fleetHookSources } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(fleetHookSources[0].source._tag) // "RepositoryHook"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const fleetHookSources: readonly [FleetHookSourceEntry, ...Array<FleetHookSourceEntry>] = [
  FleetHookSourceEntry.make({
    source: FleetHookSource.cases.RepositoryHook.make({ hookId: "714397446" }),
    effectiveFrom: 0,
  }),
];

/**
 * A job's delivery evidence.
 *
 * **Details**
 *
 * - `Delivered`: a 2xx `queued` delivery for the job.
 * - `DeliveryFailed`: only non-2xx `queued` deliveries for the job.
 * - `NotDelivered`: none in the job's window, and the pages read reach back
 *   to the job's creation.
 * - `Unreadable`: a page or detail read failed after its retries, or the
 *   pages read do not reach back to the job's creation.
 * - `Gate`: the job was created after the hook source became `NoHook`.
 *
 * **Example** (Gate evidence)
 *
 * ```ts
 * import { FleetDeliveryEvidence } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetDeliveryEvidence.cases.Gate.make({})._tag) // "Gate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetDeliveryEvidence = S.TaggedUnion({
  Delivered: { hookId: FleetDeliveryId, deliveryId: FleetDeliveryId, statusCode: S.Finite },
  DeliveryFailed: { hookId: FleetDeliveryId, deliveryId: FleetDeliveryId, statusCode: S.Finite },
  NotDelivered: { windowStart: EpochMillis, windowEnd: EpochMillis, oldestReached: EpochMillis },
  Unreadable: { reason: S.String, oldestReached: S.Option(EpochMillis) },
  Gate: {},
}).pipe($I.annoteSchema("FleetDeliveryEvidence", { description: "What the hook deliveries say about one job." }));

/**
 * Decoded delivery evidence.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetDeliveryEvidence = typeof FleetDeliveryEvidence.Type;

/**
 * The classification delivery evidence gives a `NoLaunch`: `lost` (a 2xx
 * delivery and still no launch), `unknown` (the evidence could not be read
 * back far enough), or `gate` (printed `delivery evidence: gate`, from 6b).
 *
 * **Details**
 *
 * A job with no 2xx `queued` delivery is `MissedDelivery`, which ranks above
 * `NoLaunch`, so a missed delivery is a verdict, never a classification.
 *
 * **Example** (Read the classifications)
 *
 * ```ts
 * import { FleetClassification } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetClassification.literals) // ["lost", "unknown", "gate"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetClassification = LiteralKit(["lost", "unknown", "gate"]).pipe(
  $I.annoteSchema("FleetClassification", { description: "What a job's delivery evidence classifies it as." })
);

/**
 * Decoded classification.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetClassification = typeof FleetClassification.Type;

/**
 * Which `NoLaunch` condition held: the launches cover the job's rank, the
 * pool made no progress, or the job has been queued two hours or more.
 *
 * **Example** (Read the reasons)
 *
 * ```ts
 * import { FleetNoLaunchReason } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetNoLaunchReason.literals) // ["launches-cover-rank", "no-progress", "queued-two-hours"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetNoLaunchReason = LiteralKit(["launches-cover-rank", "no-progress", "queued-two-hours"]).pipe(
  $I.annoteSchema("FleetNoLaunchReason", { description: "The NoLaunch condition that held." })
);

/**
 * Decoded NoLaunch reason.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetNoLaunchReason = typeof FleetNoLaunchReason.Type;

/**
 * The verdict tags in precedence order.
 *
 * **Example** (The first verdict)
 *
 * ```ts
 * import { FleetVerdictTag } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetVerdictTag.literals[0]) // "Stuck"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetVerdictTag = LiteralKit([
  "Stuck",
  "Wedged",
  "MissedDelivery",
  "NoLaunch",
  "WaitingAtCap",
  "Waiting",
]).pipe($I.annoteSchema("FleetVerdictTag", { description: "A verdict tag, in precedence order." }));

/**
 * Decoded verdict tag.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetVerdictTag = typeof FleetVerdictTag.Type;

/**
 * A queued job's verdict. `Stuck`, `Wedged`, `MissedDelivery` and `NoLaunch`
 * alert; `WaitingAtCap` and `Waiting` do not.
 *
 * **Example** (Branch on an alert)
 *
 * ```ts
 * import { FleetVerdict } from "@beep/repo-cli/commands/Ci"
 *
 * const verdict = FleetVerdict.cases.Waiting.make({ launches: 3, rank: 4 })
 * console.log(FleetVerdict.isAnyOf(["Stuck", "Wedged", "MissedDelivery", "NoLaunch"])(verdict)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetVerdict = S.TaggedUnion({
  Stuck: { idleRunnerIds: S.Array(S.Finite) },
  Wedged: { notBusyRunnerIds: S.Array(S.Finite) },
  MissedDelivery: {},
  NoLaunch: { reason: FleetNoLaunchReason, launches: S.Finite, rank: S.Finite },
  WaitingAtCap: {},
  Waiting: { launches: S.Finite, rank: S.Finite },
}).pipe($I.annoteSchema("FleetVerdict", { description: "One queued job's verdict." }));

/**
 * Decoded verdict.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetVerdict = typeof FleetVerdict.Type;

/**
 * Whether a verdict alerts.
 *
 * **Example** (A Stuck verdict alerts)
 *
 * ```ts
 * import { FleetVerdict, isFleetAlert } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(isFleetAlert(FleetVerdict.cases.Stuck.make({ idleRunnerIds: [7] }))) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isFleetAlert = FleetVerdict.isAnyOf(["Stuck", "Wedged", "MissedDelivery", "NoLaunch"]);

/**
 * One pool as the two runner reads and the jobs saw it.
 *
 * **Details**
 *
 * `firstReadAt` is the time of the first runner read. `atCap` holds when
 * either read counted at least `cap` registered runners of the pool.
 * `idleRunnerIds` are online and not busy in both reads;
 * `secondReadIdleRunnerIds` are online and not busy in the second read, a
 * runner that just booted included; `notBusyRunnerIds` are not busy in the
 * second read, offline ones included: `Wedged` sets no two-read condition.
 * `progress` is whether a pool job started on a runner in the last 15
 * minutes. `p95QueueToStart` samples the jobs that started in the two-hour
 * window.
 *
 * **Example** (A heavy pool at cap)
 *
 * ```ts
 * import { FleetPoolCap, FleetPoolObservation } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const observation = FleetPoolObservation.make({
 *   pool: FleetPoolCap.make({ pool: "heavy", label: "beep-fleet-heavy", cap: 2 }),
 *   firstReadAt: 0,
 *   firstCount: 2,
 *   secondCount: 2,
 *   atCap: true,
 *   idleRunnerIds: [],
 *   secondReadIdleRunnerIds: [],
 *   notBusyRunnerIds: [],
 *   currentNotBusy: 0,
 *   progress: true,
 *   p95QueueToStart: O.none(),
 * })
 * console.log(observation.atCap) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetPoolObservation extends S.Opaque<FleetPoolObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    pool: FleetPoolCap,
    firstReadAt: EpochMillis,
    firstCount: S.Finite,
    secondCount: S.Finite,
    atCap: S.Boolean,
    idleRunnerIds: S.Array(S.Finite),
    secondReadIdleRunnerIds: S.Array(S.Finite),
    notBusyRunnerIds: S.Array(S.Finite),
    currentNotBusy: S.Finite,
    progress: S.Boolean,
    p95QueueToStart: S.Option(S.Finite),
  }).pipe($I.annoteSchema("FleetPoolObservation", { description: "One pool's runner reads, cap and progress." }))
) {}

/**
 * One queued pool job before its verdict: its pool's observation, its age,
 * its rank among the pool's queued jobs created at or before it (itself
 * included), its launches since creation, the pool's oldest queued age and
 * the hook source at its creation.
 *
 * **Example** (The first queued heavy job)
 *
 * ```ts
 * import { FleetHookSource, FleetJob, FleetPoolCap, FleetPoolObservation, FleetQueuedJob } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const observation = FleetPoolObservation.make({
 *   pool: FleetPoolCap.make({ pool: "heavy", label: "beep-fleet-heavy", cap: 2 }),
 *   firstReadAt: 0,
 *   firstCount: 2,
 *   secondCount: 2,
 *   atCap: true,
 *   idleRunnerIds: [],
 *   secondReadIdleRunnerIds: [],
 *   notBusyRunnerIds: [],
 *   currentNotBusy: 0,
 *   progress: true,
 *   p95QueueToStart: O.none(),
 * })
 * const job = FleetJob.make({
 *   id: 800,
 *   runId: 3800,
 *   name: "Heavy",
 *   status: "queued",
 *   labels: ["beep-fleet-heavy"],
 *   createdAt: 0,
 *   startedAt: O.none(),
 *   runnerName: O.none(),
 * })
 * const queued = FleetQueuedJob.make({
 *   job,
 *   observation,
 *   age: 600000,
 *   rank: 1,
 *   launches: 0,
 *   oldestQueuedAge: 600000,
 *   source: FleetHookSource.cases.RepositoryHook.make({ hookId: "714397446" }),
 * })
 * console.log(queued.rank) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetQueuedJob extends S.Opaque<FleetQueuedJob, { readonly brand: unique symbol }>()(
  S.Struct({
    job: FleetJob,
    observation: FleetPoolObservation,
    age: S.Finite,
    rank: S.Finite,
    launches: S.Finite,
    oldestQueuedAge: S.Finite,
    source: FleetHookSource,
  }).pipe($I.annoteSchema("FleetQueuedJob", { description: "One queued pool job with its rank, launches and source." }))
) {}

/**
 * One queued job's verdict and the facts behind it.
 *
 * **Example** (A missed delivery)
 *
 * ```ts
 * import { FleetHookSource, FleetJob, FleetJobFinding, FleetVerdict } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const job = FleetJob.make({
 *   id: 800,
 *   runId: 3800,
 *   name: "Heavy",
 *   status: "queued",
 *   labels: ["beep-fleet-heavy"],
 *   createdAt: 0,
 *   startedAt: O.none(),
 *   runnerName: O.none(),
 * })
 * const finding = FleetJobFinding.make({
 *   job,
 *   pool: "heavy",
 *   age: 600000,
 *   rank: 1,
 *   launches: 0,
 *   source: FleetHookSource.cases.RepositoryHook.make({ hookId: "714397446" }),
 *   verdict: FleetVerdict.cases.MissedDelivery.make({}),
 *   evidence: O.none(),
 *   classification: O.none(),
 * })
 * console.log(finding.verdict._tag) // "MissedDelivery"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetJobFinding extends S.Opaque<FleetJobFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    job: FleetJob,
    pool: S.String,
    age: S.Finite,
    rank: S.Finite,
    launches: S.Finite,
    source: FleetHookSource,
    verdict: FleetVerdict,
    evidence: S.Option(FleetDeliveryEvidence),
    classification: S.Option(FleetClassification),
  }).pipe($I.annoteSchema("FleetJobFinding", { description: "One queued job's verdict, evidence and inputs." }))
) {}

/**
 * The check's own previous scheduled run, as far as it could be read.
 *
 * **Details**
 *
 * `Found.currentCreatedAt` is this run's own creation when it is a scheduled
 * run, so the cadence gap runs from scheduled run to scheduled run.
 *
 * **Example** (No previous run)
 *
 * ```ts
 * import { FleetPreviousRun } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetPreviousRun.cases.NoneFound.make({})._tag) // "NoneFound"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetPreviousRun = S.TaggedUnion({
  Found: { runId: S.Finite, createdAt: EpochMillis, currentCreatedAt: S.Option(EpochMillis) },
  NoneFound: {},
  Unreadable: { reason: S.String },
}).pipe($I.annoteSchema("FleetPreviousRun", { description: "The previous scheduled run, none, or unreadable." }));

/**
 * Decoded previous run.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetPreviousRun = typeof FleetPreviousRun.Type;

/**
 * The outcome of one run of the check.
 *
 * **Details**
 *
 * `githubRequests` is the number of GitHub reads the run made, retries
 * included, as the reads service counted them. `listingNotes` holds one
 * `<listing>: listing unstable (N walks)` note for each paged listing whose
 * walks never agreed and whose union of walks the run used instead. A note
 * never makes a run red.
 *
 * **Example** (A run with nothing queued)
 *
 * ```ts
 * import { FleetCheckReport, FleetPreviousRun } from "@beep/repo-cli/commands/Ci"
 *
 * const report = FleetCheckReport.make({
 *   repository: "beep-effect/beep-effect",
 *   checkedAt: 0,
 *   pools: [],
 *   findings: [],
 *   previousRun: FleetPreviousRun.cases.NoneFound.make({}),
 * })
 * console.log(report.githubRequests) // 0
 * console.log(report.listingNotes.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetCheckReport extends S.Opaque<FleetCheckReport, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: S.String,
    checkedAt: EpochMillis,
    pools: S.Array(FleetPoolObservation),
    findings: S.Array(FleetJobFinding),
    previousRun: FleetPreviousRun,
    githubRequests: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0))),
    listingNotes: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed<ReadonlyArray<string>>([]))),
  }).pipe($I.annoteSchema("FleetCheckReport", { description: "Every pool observation and job finding of one run." }))
) {}

/**
 * The resolved inputs of one `ci fleet-missed-event-check` run.
 *
 * **Example** (A local run)
 *
 * ```ts
 * import { FleetMissedEventInput, fleetHookSources } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const input = FleetMissedEventInput.make({
 *   repository: "beep-effect/beep-effect",
 *   workflowFile: "fleet-missed-event-check.yml",
 *   currentRunId: O.none(),
 *   stepSummary: false,
 *   pools: [{ pool: "heavy", label: "beep-fleet-heavy", cap: 2 }],
 *   hookSources: fleetHookSources,
 * })
 * console.log(input.repository) // "beep-effect/beep-effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetMissedEventInput extends S.Opaque<FleetMissedEventInput, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: S.String.check(S.isPattern(/^[\w.-]+\/[\w.-]+$/u)),
    workflowFile: S.String,
    currentRunId: S.Option(S.Finite),
    stepSummary: S.Boolean,
    pools: S.Array(FleetPoolCap),
    hookSources: S.NonEmptyArray(FleetHookSourceEntry),
  }).pipe(
    $I.annoteSchema("FleetMissedEventInput", {
      description: "Repository, workflow, pools and hook sources of one missed-event check run.",
    })
  )
) {}
