/**
 * The decisions of the standing fleet missed-event check, free of I/O: pool
 * observations, the delivery-evidence walk's matching, each queued job's
 * verdict in precedence order, the remedy commands and the step summary.
 *
 * **Details**
 *
 * Specification:
 * `goals/infra-alchemy-rebuild/decisions/2026-11-23-standing-missed-event-check.md`.
 * Precedence is `Stuck`, `Wedged`, `MissedDelivery`, `NoLaunch`,
 * `WaitingAtCap`, `Waiting`. A job with no 2xx `queued` delivery is
 * therefore `MissedDelivery` before any `NoLaunch` condition is read; a
 * `NoLaunch` carries `lost`, `unknown` or `gate`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import {
  FLEET_THRESHOLDS,
  FleetCheckingRun,
  FleetCheckJob,
  FleetCheckReport,
  FleetClassification,
  FleetDeliveryEvidence,
  FleetGuardDecision,
  FleetHookSource,
  FleetJobFinding,
  FleetPoolCap,
  FleetPoolObservation,
  FleetPreviousRun,
  FleetQueuedJob,
  FleetVerdict,
  FleetVerdictTag,
  isFleetAlert,
} from "./FleetMissedEvent.schemas.ts";
import { fleetPoolCapsProjection } from "./FleetPoolCaps.generated.ts";
import type {
  FleetDeliveryDetail,
  FleetHookDelivery,
  FleetHookSourceEntry,
  FleetJob,
  FleetNoLaunchReason,
  FleetPoolCapsInput,
  FleetRunner,
  FleetWorkflowRun,
} from "./FleetMissedEvent.schemas.ts";

type FleetHookSources = readonly [FleetHookSourceEntry, ...Array<FleetHookSourceEntry>];

/**
 * The pools the check watches at the projection's phase, from the
 * generated caps of `packages/tooling/infra/ci-runners/src/Config.ts`.
 *
 * **Example** (The production caps)
 *
 * ```ts
 * import { fleetPoolCaps, fleetPoolCapsProjection } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(fleetPoolCaps(fleetPoolCapsProjection).map((pool) => pool.cap)) // [2, 48]
 * ```
 *
 * @param projection - The generated caps.
 * @returns Each pool's name, label and cap in the projected phase.
 * @category configuration
 * @since 0.0.0
 */
export const fleetPoolCaps = (projection: typeof FleetPoolCapsInput.Encoded): ReadonlyArray<FleetPoolCap> =>
  A.map(projection.pools, (pool) =>
    FleetPoolCap.make({ pool: pool.pool, label: pool.label, cap: pool[projection.phase] })
  );

/**
 * The production pools, from the committed generated caps.
 *
 * **Example** (The production labels)
 *
 * ```ts
 * import { productionFleetPools } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(productionFleetPools.map((pool) => pool.label)) // ["beep-fleet-heavy", "beep-fleet-overflow"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const productionFleetPools: ReadonlyArray<FleetPoolCap> = fleetPoolCaps(fleetPoolCapsProjection);

/**
 * The hook source in effect at a time: the last entry effective at or
 * before it.
 *
 * **Example** (Before and after the 6b switch)
 *
 * ```ts
 * import { FleetHookSource, FleetHookSourceEntry, hookSourceAt } from "@beep/repo-cli/commands/Ci"
 *
 * const sources: readonly [FleetHookSourceEntry, ...Array<FleetHookSourceEntry>] = [
 *   FleetHookSourceEntry.make({ source: FleetHookSource.cases.RepositoryHook.make({ hookId: "714397446" }), effectiveFrom: 0 }),
 *   FleetHookSourceEntry.make({ source: FleetHookSource.cases.NoHook.make({}), effectiveFrom: 1000 }),
 * ]
 * console.log(hookSourceAt(sources, 999)._tag, hookSourceAt(sources, 1000)._tag) // RepositoryHook NoHook
 * ```
 *
 * @param sources - The configuration, oldest entry first.
 * @param at - The time, usually a job's creation.
 * @returns The source in effect.
 * @category configuration
 * @since 0.0.0
 */
export const hookSourceAt: {
  (at: number): (sources: FleetHookSources) => FleetHookSource;
  (sources: FleetHookSources, at: number): FleetHookSource;
} = dual(
  2,
  (sources: FleetHookSources, at: number): FleetHookSource =>
    pipe(
      A.filter(sources, (entry) => entry.effectiveFrom <= at),
      A.last,
      O.getOrElse(() => A.headNonEmpty(sources)),
      (entry) => entry.source
    )
);

const hasLabel = (label: string) => (labels: ReadonlyArray<string>) => A.contains(labels, label);

const poolRunners = (read: ReadonlyArray<FleetRunner>, pool: FleetPoolCap): ReadonlyArray<FleetRunner> =>
  A.filter(read, (runner) => hasLabel(pool.label)(runner.labels));

const idsWhere = (read: ReadonlyArray<FleetRunner>, keep: (runner: FleetRunner) => boolean) =>
  HashSet.fromIterable(A.map(A.filter(read, keep), (runner) => runner.id));

const isIdle = (runner: FleetRunner): boolean => runner.online && !runner.busy;
const isNotBusy = (runner: FleetRunner): boolean => !runner.busy;

const sortedIds = (ids: HashSet.HashSet<number>): ReadonlyArray<number> => A.sort(A.fromIterable(ids), Order.Number);

const startedOnRunner = (job: FleetJob): O.Option<number> =>
  O.flatMap(job.startedAt, (startedAt) => (O.isSome(job.runnerName) ? O.some(startedAt) : O.none()));

/**
 * The nearest-rank 95th percentile of a sample.
 *
 * **Example** (Twenty samples)
 *
 * ```ts
 * import { percentile95 } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(percentile95(Array.from({ length: 20 }, (_, i) => i + 1))) // { _id: 'Option', _tag: 'Some', value: 19 }
 * ```
 *
 * @param values - The sample.
 * @returns Its 95th percentile, or `None` for an empty sample.
 * @category utilities
 * @since 0.0.0
 */
export const percentile95 = (values: ReadonlyArray<number>): O.Option<number> =>
  A.get(A.sort(values, Order.Number), Math.ceil(0.95 * A.length(values)) - 1);

/**
 * Observe one pool from the two runner reads and the jobs read.
 *
 * **Example** (An empty pool below cap)
 *
 * ```ts
 * import { FleetPoolCap, observeFleetPool } from "@beep/repo-cli/commands/Ci"
 *
 * const pool = FleetPoolCap.make({ pool: "heavy", label: "beep-fleet-heavy", cap: 2 })
 * console.log(observeFleetPool({ pool, firstReadAt: 0, firstRead: [], secondRead: [], jobs: [], now: 0 }).atCap) // false
 * ```
 *
 * @param input - The pool, the first runner read's time, both runner reads, every job read and the time.
 * @returns The pool's counts, cap state, idle runners (both reads), not-busy runners (second read), progress and
 * the p95 queue-to-start of the jobs that started in the two-hour window.
 * @category use-cases
 * @since 0.0.0
 */
export const observeFleetPool = (input: {
  readonly pool: FleetPoolCap;
  readonly firstReadAt: number;
  readonly firstRead: ReadonlyArray<FleetRunner>;
  readonly secondRead: ReadonlyArray<FleetRunner>;
  readonly jobs: ReadonlyArray<FleetJob>;
  readonly now: number;
}): FleetPoolObservation => {
  const first = poolRunners(input.firstRead, input.pool);
  const second = poolRunners(input.secondRead, input.pool);
  const poolJobs = A.filter(input.jobs, (job) => hasLabel(input.pool.label)(job.labels));
  const started = A.getSomes(
    A.map(poolJobs, (job) => O.map(startedOnRunner(job), (startedAt) => ({ startedAt, createdAt: job.createdAt })))
  );
  return FleetPoolObservation.make({
    pool: input.pool,
    firstReadAt: input.firstReadAt,
    firstCount: A.length(first),
    secondCount: A.length(second),
    atCap: A.length(first) >= input.pool.cap || A.length(second) >= input.pool.cap,
    idleRunnerIds: sortedIds(HashSet.intersection(idsWhere(first, isIdle), idsWhere(second, isIdle))),
    secondReadIdleRunnerIds: sortedIds(idsWhere(second, isIdle)),
    notBusyRunnerIds: sortedIds(idsWhere(second, isNotBusy)),
    currentNotBusy: A.length(A.filter(second, isNotBusy)),
    progress: A.some(started, (job) => job.startedAt >= input.now - FLEET_THRESHOLDS.progressWindow),
    p95QueueToStart: percentile95(
      A.map(
        A.filter(started, (job) => job.startedAt >= input.now - FLEET_THRESHOLDS.lookback),
        (job) => job.startedAt - job.createdAt
      )
    ),
  });
};

/**
 * The window a job's `queued` delivery lands in: from its creation minus
 * two minutes to its creation plus five.
 *
 * **Example** (A job created at ten minutes)
 *
 * ```ts
 * import { FleetJob, deliveryWindow } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const job = FleetJob.make({
 *   id: 800,
 *   runId: 3800,
 *   name: "Heavy",
 *   status: "queued",
 *   labels: ["beep-fleet-heavy"],
 *   createdAt: 600000,
 *   startedAt: O.none(),
 *   runnerName: O.none(),
 * })
 * console.log(deliveryWindow(job)) // { start: 480000, end: 900000 }
 * ```
 *
 * @param job - The queued job.
 * @returns The window's start and end.
 * @category use-cases
 * @since 0.0.0
 */
export const deliveryWindow = (job: FleetJob): { readonly start: number; readonly end: number } => ({
  start: job.createdAt - FLEET_THRESHOLDS.deliveryLead,
  end: job.createdAt + FLEET_THRESHOLDS.deliveryLag,
});

/**
 * The `queued` deliveries inside a job's window, in listing order.
 *
 * **Example** (Only the window's queued deliveries)
 *
 * ```ts
 * import { FleetHookDelivery, FleetJob, deliveryCandidates } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const job = FleetJob.make({
 *   id: 800,
 *   runId: 3800,
 *   name: "Heavy",
 *   status: "queued",
 *   labels: ["beep-fleet-heavy"],
 *   createdAt: 600000,
 *   startedAt: O.none(),
 *   runnerName: O.none(),
 * })
 * const delivery = (id: string, deliveredAt: number, action: string) =>
 *   FleetHookDelivery.make({ id, deliveredAt, statusCode: 200, action: O.some(action) })
 * const candidates = deliveryCandidates(job, [
 *   delivery("1", 600500, "queued"),
 *   delivery("2", 600500, "completed"),
 *   delivery("3", 0, "queued"),
 * ])
 * console.log(candidates.map((candidate) => candidate.id)) // ["1"]
 * ```
 *
 * @param job - The queued job.
 * @param deliveries - The deliveries the walk read.
 * @returns The job's candidate deliveries.
 * @category use-cases
 * @since 0.0.0
 */
export const deliveryCandidates: {
  (deliveries: ReadonlyArray<FleetHookDelivery>): (job: FleetJob) => ReadonlyArray<FleetHookDelivery>;
  (job: FleetJob, deliveries: ReadonlyArray<FleetHookDelivery>): ReadonlyArray<FleetHookDelivery>;
} = dual(2, (job: FleetJob, deliveries: ReadonlyArray<FleetHookDelivery>): ReadonlyArray<FleetHookDelivery> => {
  const window = deliveryWindow(job);
  return A.filter(
    deliveries,
    (delivery) =>
      O.contains(delivery.action, "queued") &&
      delivery.deliveredAt >= window.start &&
      delivery.deliveredAt <= window.end
  );
});

/**
 * Whether a delivery reached its endpoint with a 2xx response.
 *
 * **Example** (A 502 is not delivered)
 *
 * ```ts
 * import { FleetHookDelivery, isSuccessfulDelivery } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const delivery = FleetHookDelivery.make({ id: "1", deliveredAt: 0, statusCode: 502, action: O.some("queued") })
 * console.log(isSuccessfulDelivery(delivery)) // false
 * ```
 *
 * @param delivery - A hook delivery.
 * @returns Whether its status code is 2xx.
 * @category predicates
 * @since 0.0.0
 */
export const isSuccessfulDelivery = (delivery: FleetHookDelivery): boolean =>
  delivery.statusCode >= 200 && delivery.statusCode < 300;

/**
 * Judge one job's delivery evidence from the deliveries read and their
 * details.
 *
 * **Details**
 *
 * The candidates are the `queued` deliveries inside the job's window. A
 * 2xx candidate naming the job is `Delivered`, whatever else was read.
 * Without one, a candidate detail that is unreadable or names no workflow
 * job (its request or payload absent), or a walk that does not
 * cover the window's start (its creation minus two minutes), makes the
 * evidence `Unreadable`: the unread delivery could be the 2xx. A walk
 * covers the start when it read a delivery older than it, or one at it and
 * the listing then ended. Only a covered window with every candidate read
 * gives `DeliveryFailed` (a non-2xx candidate naming the job) or
 * `NotDelivered`.
 *
 * **Example** (A complete walk with no delivery)
 *
 * ```ts
 * import { FleetJob, judgeDeliveryEvidence } from "@beep/repo-cli/commands/Ci"
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 *
 * const job = FleetJob.make({
 *   id: 800,
 *   runId: 3800,
 *   name: "Heavy",
 *   status: "queued",
 *   labels: ["beep-fleet-heavy"],
 *   createdAt: 600000,
 *   startedAt: O.none(),
 *   runnerName: O.none(),
 * })
 * const evidence = judgeDeliveryEvidence({
 *   job,
 *   hookId: "714397446",
 *   deliveries: [],
 *   oldestReached: O.some(0),
 *   walkFailure: O.none(),
 *   listingEnded: false,
 *   details: HashMap.empty(),
 * })
 * console.log(evidence._tag) // "NotDelivered"
 * ```
 *
 * @param input - The job, its hook, the walk's deliveries, oldest time, failure and end, and the detail reads.
 * @returns The job's evidence.
 * @category use-cases
 * @since 0.0.0
 */
export const judgeDeliveryEvidence = (input: {
  readonly job: FleetJob;
  readonly hookId: string;
  readonly deliveries: ReadonlyArray<FleetHookDelivery>;
  readonly oldestReached: O.Option<number>;
  readonly walkFailure: O.Option<string>;
  readonly listingEnded: boolean;
  readonly details: HashMap.HashMap<string, O.Option<FleetDeliveryDetail>>;
}): FleetDeliveryEvidence => {
  const window = deliveryWindow(input.job);
  const candidates = deliveryCandidates(input.job, input.deliveries);
  const jobIdOf = (delivery: FleetHookDelivery) =>
    O.flatMap(O.flatten(HashMap.get(input.details, delivery.id)), (detail) => detail.workflowJobId);
  const matches = A.filter(candidates, (delivery) => O.contains(jobIdOf(delivery), `${input.job.id}`));
  const unreadable = A.length(A.filter(candidates, (delivery) => O.isNone(jobIdOf(delivery))));
  const covered = O.filter(
    input.oldestReached,
    (oldest) => oldest < window.start || (oldest === window.start && input.listingEnded)
  );
  const unknown = (reason: string) =>
    FleetDeliveryEvidence.cases.Unreadable.make({ reason, oldestReached: input.oldestReached });
  return pipe(
    A.findFirst(matches, isSuccessfulDelivery),
    O.match({
      onSome: (delivery) =>
        FleetDeliveryEvidence.cases.Delivered.make({
          hookId: input.hookId,
          deliveryId: delivery.id,
          statusCode: delivery.statusCode,
        }),
      onNone: () =>
        unreadable > 0
          ? unknown(`${unreadable} candidate delivery detail(s) unreadable after retries or naming no workflow job`)
          : O.match(covered, {
              onNone: () =>
                unknown(
                  O.getOrElse(
                    input.walkFailure,
                    () => "the pages read do not reach back to the job's delivery window start"
                  )
                ),
              onSome: (oldestReached) =>
                O.match(A.head(matches), {
                  onSome: (delivery) =>
                    FleetDeliveryEvidence.cases.DeliveryFailed.make({
                      hookId: input.hookId,
                      deliveryId: delivery.id,
                      statusCode: delivery.statusCode,
                    }),
                  onNone: () =>
                    FleetDeliveryEvidence.cases.NotDelivered.make({
                      windowStart: window.start,
                      windowEnd: window.end,
                      oldestReached,
                    }),
                }),
            }),
    })
  );
};

/**
 * Whether delivery evidence shows no 2xx `queued` delivery: a failed
 * delivery, or none in a window the walk read in full.
 *
 * **Example** (A failed delivery is missed)
 *
 * ```ts
 * import { FleetDeliveryEvidence, isMissedDeliveryEvidence } from "@beep/repo-cli/commands/Ci"
 *
 * const evidence = FleetDeliveryEvidence.cases.DeliveryFailed.make({ hookId: "1", deliveryId: "2", statusCode: 502 })
 * console.log(isMissedDeliveryEvidence(evidence)) // true
 * ```
 *
 * @param evidence - The job's delivery evidence.
 * @returns Whether it makes the job `MissedDelivery`.
 * @category predicates
 * @since 0.0.0
 */
export const isMissedDeliveryEvidence = (evidence: FleetDeliveryEvidence): boolean =>
  FleetDeliveryEvidence.guards.DeliveryFailed(evidence) || FleetDeliveryEvidence.guards.NotDelivered(evidence);

/**
 * The classification delivery evidence gives a `NoLaunch`.
 *
 * **Example** (A 2xx delivery and no launch is lost)
 *
 * ```ts
 * import { FleetDeliveryEvidence, classifyFleetEvidence } from "@beep/repo-cli/commands/Ci"
 *
 * const evidence = FleetDeliveryEvidence.cases.Delivered.make({ hookId: "1", deliveryId: "2", statusCode: 200 })
 * console.log(classifyFleetEvidence(evidence)) // { _id: 'Option', _tag: 'Some', value: 'lost' }
 * ```
 *
 * @param evidence - The job's delivery evidence.
 * @returns `lost`, `unknown` or `gate`; `None` for a missed delivery, which is the `MissedDelivery` verdict.
 * @category use-cases
 * @since 0.0.0
 */
export const classifyFleetEvidence = (evidence: FleetDeliveryEvidence): O.Option<FleetClassification> =>
  FleetDeliveryEvidence.match(evidence, {
    Delivered: () => O.some(FleetClassification.Enum.lost),
    DeliveryFailed: O.none<FleetClassification>,
    NotDelivered: O.none<FleetClassification>,
    Unreadable: () => O.some(FleetClassification.Enum.unknown),
    Gate: () => O.some(FleetClassification.Enum.gate),
  });

/**
 * Whether the deliveries must be read for a job: its source at creation is a
 * repository hook and it is old enough for its delivery to be due.
 *
 * **Example** (Due at five minutes)
 *
 * ```ts
 * import { FleetHookSource, FleetJob, FleetPoolCap, FleetPoolObservation, FleetQueuedJob, needsDeliveryEvidence } from "@beep/repo-cli/commands/Ci"
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
 * console.log(needsDeliveryEvidence(queued, 299999), needsDeliveryEvidence(queued, 300000)) // false true
 * ```
 *
 * @param queued - The queued job with its hook source at creation.
 * @param now - The check's time.
 * @returns Whether the walk must reach this job.
 * @category use-cases
 * @since 0.0.0
 */
export const needsDeliveryEvidence: {
  (now: number): (queued: FleetQueuedJob) => boolean;
  (queued: FleetQueuedJob, now: number): boolean;
} = dual(
  2,
  (queued: FleetQueuedJob, now: number): boolean =>
    FleetHookSource.guards.RepositoryHook(queued.source) &&
    now - queued.job.createdAt >= FLEET_THRESHOLDS.missedDeliveryAge
);

const launchesSince = (job: FleetJob, launchJobs: ReadonlyArray<FleetJob>, observation: FleetPoolObservation) =>
  A.length(A.filter(launchJobs, (other) => O.exists(startedOnRunner(other), (at) => at >= job.createdAt))) +
  observation.currentNotBusy;

const noLaunchReason = (input: {
  readonly launches: number;
  readonly rank: number;
  readonly progress: boolean;
  readonly age: number;
}): O.Option<FleetNoLaunchReason> =>
  input.launches >= input.rank
    ? O.some("launches-cover-rank")
    : !input.progress
      ? O.some("no-progress")
      : input.age >= FLEET_THRESHOLDS.lookback
        ? O.some("queued-two-hours")
        : O.none();

/**
 * Give one queued job its verdict, in precedence order.
 *
 * **Details**
 *
 * `Stuck` holds only for a job created at or before the first runner read:
 * a job created between the reads may simply not have been picked up yet.
 * `NoLaunch` needs no runner idle in the second read, so a runner that just
 * booted keeps the job `Waiting`. `Waiting` is every below-cap job no earlier
 * verdict holds for, with or without progress.
 *
 * **Example** (Waiting with three launches for rank four)
 *
 * ```ts
 * import { FleetPoolCap, FleetPoolObservation, decideFleetVerdict } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const observation = FleetPoolObservation.make({
 *   pool: FleetPoolCap.make({ pool: "heavy", label: "beep-fleet-heavy", cap: 5 }),
 *   firstReadAt: 1000000, firstCount: 1, secondCount: 1, atCap: false, idleRunnerIds: [],
 *   secondReadIdleRunnerIds: [], notBusyRunnerIds: [], currentNotBusy: 0, progress: true, p95QueueToStart: O.none(),
 * })
 * const verdict = decideFleetVerdict({
 *   observation, createdAt: 100000, age: 900000, launches: 3, rank: 4, oldestQueuedAge: 900000, evidence: O.none(),
 * })
 * console.log(verdict._tag) // "Waiting"
 * ```
 *
 * @param input - The pool observation, the job's creation, age, launches, rank and evidence, and the pool's oldest queued age.
 * @returns The first verdict that holds.
 * @category use-cases
 * @since 0.0.0
 */
export const decideFleetVerdict = (input: {
  readonly observation: FleetPoolObservation;
  readonly createdAt: number;
  readonly age: number;
  readonly launches: number;
  readonly rank: number;
  readonly oldestQueuedAge: number;
  readonly evidence: O.Option<FleetDeliveryEvidence>;
}): FleetVerdict => {
  const { observation } = input;
  if (
    observation.atCap &&
    A.isReadonlyArrayNonEmpty(observation.idleRunnerIds) &&
    input.createdAt <= observation.firstReadAt
  ) {
    return FleetVerdict.cases.Stuck.make({ idleRunnerIds: observation.idleRunnerIds });
  }
  if (
    observation.atCap &&
    A.isReadonlyArrayNonEmpty(observation.notBusyRunnerIds) &&
    input.oldestQueuedAge >= FLEET_THRESHOLDS.wedgedAge &&
    !observation.progress
  ) {
    return FleetVerdict.cases.Wedged.make({ notBusyRunnerIds: observation.notBusyRunnerIds });
  }
  if (input.age >= FLEET_THRESHOLDS.missedDeliveryAge && O.exists(input.evidence, isMissedDeliveryEvidence)) {
    return FleetVerdict.cases.MissedDelivery.make({});
  }
  const reason =
    !observation.atCap &&
    input.age >= FLEET_THRESHOLDS.noLaunchAge &&
    A.isReadonlyArrayEmpty(observation.secondReadIdleRunnerIds)
      ? noLaunchReason({ ...input, progress: observation.progress })
      : O.none();
  return O.match(reason, {
    onSome: (held) => FleetVerdict.cases.NoLaunch.make({ reason: held, launches: input.launches, rank: input.rank }),
    onNone: () =>
      observation.atCap
        ? FleetVerdict.cases.WaitingAtCap.make({})
        : FleetVerdict.cases.Waiting.make({ launches: input.launches, rank: input.rank }),
  });
};

/**
 * The queued jobs of every pool, each with its rank among the pool's queued
 * jobs created at or before it (itself included) and its launches since
 * creation.
 *
 * **Details**
 *
 * Launches count only the started jobs of runs in `lookbackRunIds`, the runs
 * created in the last two hours: an older active run's start never covers a
 * newer job's rank.
 *
 * **Example** (Rank one queued heavy job)
 *
 * ```ts
 * import { FleetJob, FleetPoolCap, FleetPoolObservation, fleetHookSources, queuedFleetJobs } from "@beep/repo-cli/commands/Ci"
 * import * as HashSet from "effect/HashSet"
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
 * const queued = queuedFleetJobs({
 *   observations: [observation],
 *   jobs: [job],
 *   lookbackRunIds: HashSet.make(3800),
 *   hookSources: fleetHookSources,
 *   now: 600000,
 * })
 * console.log(queued.map((entry) => entry.rank)) // [1]
 * ```
 *
 * @param input - The observations, every job read, the lookback runs, the hook sources and the time.
 * @returns One entry per queued pool job.
 * @category use-cases
 * @since 0.0.0
 */
export const queuedFleetJobs = (input: {
  readonly observations: ReadonlyArray<FleetPoolObservation>;
  readonly jobs: ReadonlyArray<FleetJob>;
  readonly lookbackRunIds: HashSet.HashSet<number>;
  readonly hookSources: FleetHookSources;
  readonly now: number;
}): ReadonlyArray<FleetQueuedJob> =>
  A.flatMap(input.observations, (observation) => {
    const poolJobs = A.filter(input.jobs, (job) => hasLabel(observation.pool.label)(job.labels));
    const launchJobs = A.filter(poolJobs, (job) => HashSet.has(input.lookbackRunIds, job.runId));
    const queued = A.filter(poolJobs, (job) => job.status === "queued");
    const oldestQueuedAge = pipe(
      A.map(queued, (job) => input.now - job.createdAt),
      A.reduce(0, (oldest, age) => (age > oldest ? age : oldest))
    );
    return A.map(queued, (job) =>
      FleetQueuedJob.make({
        job,
        observation,
        age: input.now - job.createdAt,
        rank: A.length(A.filter(queued, (other) => other.createdAt <= job.createdAt)),
        launches: launchesSince(job, launchJobs, observation),
        oldestQueuedAge,
        source: hookSourceAt(input.hookSources, job.createdAt),
      })
    );
  });

/**
 * Give a queued job its finding from its delivery evidence.
 *
 * **Example** (A delivered job waiting at cap)
 *
 * ```ts
 * import { FleetHookSource, FleetJob, FleetPoolCap, FleetPoolObservation, FleetQueuedJob, FleetDeliveryEvidence, fleetJobFinding } from "@beep/repo-cli/commands/Ci"
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
 * const finding = fleetJobFinding(
 *   queued,
 *   O.some(FleetDeliveryEvidence.cases.Delivered.make({ hookId: "714397446", deliveryId: "21", statusCode: 200 }))
 * )
 * console.log(finding.verdict._tag) // "WaitingAtCap"
 * ```
 *
 * @param queued - The job with its rank, launches and source.
 * @param evidence - Its delivery evidence, when it was read or is the gate's.
 * @returns The job with its verdict, its evidence and the classification of that evidence.
 * @category use-cases
 * @since 0.0.0
 */
export const fleetJobFinding: {
  (evidence: O.Option<FleetDeliveryEvidence>): (queued: FleetQueuedJob) => FleetJobFinding;
  (queued: FleetQueuedJob, evidence: O.Option<FleetDeliveryEvidence>): FleetJobFinding;
} = dual(
  2,
  (queued: FleetQueuedJob, evidence: O.Option<FleetDeliveryEvidence>): FleetJobFinding =>
    FleetJobFinding.make({
      job: queued.job,
      pool: queued.observation.pool.pool,
      age: queued.age,
      rank: queued.rank,
      launches: queued.launches,
      source: queued.source,
      verdict: decideFleetVerdict({ ...queued, createdAt: queued.job.createdAt, evidence }),
      evidence,
      classification: O.flatMap(evidence, classifyFleetEvidence),
    })
);

const formatAge = (millis: number): string => {
  const minutes = Math.floor(millis / 60000);
  const seconds = Math.floor((millis % 60000) / 1000);
  return minutes > 0 ? `${minutes}m${Str.padStart(2, "0")(`${seconds}`)}s` : `${seconds}s`;
};

const formatTime = (millis: number): string => DateTime.formatIso(DateTime.makeUnsafe(millis));

const classificationLabel = (classification: FleetClassification): string =>
  classification === FleetClassification.Enum.gate ? "delivery evidence: gate" : classification;

const evidenceLabel = (evidence: O.Option<FleetDeliveryEvidence>): string =>
  O.match(evidence, {
    onNone: () => "not read (job younger than 5 minutes)",
    onSome: FleetDeliveryEvidence.match({
      Delivered: ({ deliveryId, statusCode }) => `delivery ${deliveryId} (${statusCode})`,
      DeliveryFailed: ({ deliveryId, statusCode }) => `delivery ${deliveryId} (${statusCode})`,
      NotDelivered: ({ windowStart, windowEnd, oldestReached }) =>
        `none in ${formatTime(windowStart)}..${formatTime(windowEnd)}, oldest read ${formatTime(oldestReached)}`,
      Unreadable: ({ reason, oldestReached }) =>
        `${reason}; oldest read ${O.match(oldestReached, { onNone: () => "none", onSome: formatTime })}`,
      Gate: () => "delivery evidence: gate",
    }),
  });

/**
 * A verdict with its facts, as the summary prints it.
 *
 * **Example** (A Waiting verdict)
 *
 * ```ts
 * import { FleetVerdict, fleetVerdictLabel } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(fleetVerdictLabel(FleetVerdict.cases.Waiting.make({ launches: 3, rank: 4 }))) // "Waiting (3 launch(es), rank 4)"
 * ```
 *
 * @param verdict - A finding's verdict, with the runner ids or launch counts it names.
 * @returns Its label.
 * @category use-cases
 * @since 0.0.0
 */
export const fleetVerdictLabel = (verdict: FleetVerdict): string =>
  FleetVerdict.match(verdict, {
    Stuck: ({ idleRunnerIds }) =>
      `Stuck (idle in both reads, at cap in at least one: ${A.join(A.map(idleRunnerIds, String), ", ")})`,
    Wedged: ({ notBusyRunnerIds }) =>
      `Wedged (not busy at cap, no progress: ${A.join(A.map(notBusyRunnerIds, String), ", ")})`,
    MissedDelivery: () => "MissedDelivery",
    NoLaunch: ({ reason, launches, rank }) => `NoLaunch (${reason}; ${launches} launch(es), rank ${rank})`,
    WaitingAtCap: () => "WaitingAtCap",
    Waiting: ({ launches, rank }) => `Waiting (${launches} launch(es), rank ${rank})`,
  });

const cancelAndRerun = (repository: string, runId: number): ReadonlyArray<string> => [
  `gate's call (reruns the whole run): \`gh run cancel ${runId} --repo ${repository}\`, then once the run completes \`gh run rerun ${runId} --repo ${repository}\``,
];

/**
 * The remedy commands printed for an alerting job; the check never runs them.
 *
 * **Details**
 *
 * A 2xx or failed `queued` delivery prints its redelivery only. A job with
 * no delivery in its window and a gate-classified job print the
 * cancel-and-rerun pair, marked as the gate's call because it reruns the
 * whole run. `gh run rerun --failed`
 * refuses an in-progress run and is never printed for a queued job.
 *
 * **Example** (Redeliver a delivered job)
 *
 * ```ts
 * import { FleetHookSource, FleetJob, FleetPoolCap, FleetPoolObservation, FleetQueuedJob, FleetDeliveryEvidence, fleetJobFinding, fleetRemedies } from "@beep/repo-cli/commands/Ci"
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
 * const finding = fleetJobFinding(
 *   queued,
 *   O.some(FleetDeliveryEvidence.cases.Delivered.make({ hookId: "714397446", deliveryId: "21", statusCode: 200 }))
 * )
 * console.log(fleetRemedies("beep-effect/beep-effect", finding).length) // 1
 * ```
 *
 * @param repository - The `owner/name` repository.
 * @param finding - The alerting job's finding.
 * @returns The remedy lines.
 * @category use-cases
 * @since 0.0.0
 */
export const fleetRemedies: {
  (finding: FleetJobFinding): (repository: string) => ReadonlyArray<string>;
  (repository: string, finding: FleetJobFinding): ReadonlyArray<string>;
} = dual(2, (repository: string, finding: FleetJobFinding): ReadonlyArray<string> => {
  const redelivery = O.flatMap(finding.evidence, (evidence) =>
    FleetDeliveryEvidence.guards.Delivered(evidence) || FleetDeliveryEvidence.guards.DeliveryFailed(evidence)
      ? O.some(
          `redeliver: \`gh api -X POST repos/${repository}/hooks/${evidence.hookId}/deliveries/${evidence.deliveryId}/attempts\``
        )
      : O.none()
  );
  const gate = O.contains(finding.classification, FleetClassification.Enum.gate)
    ? ["gate: run the gate's enrichment and App-redelivery command for this job"]
    : [];
  const rerun =
    O.exists(finding.evidence, FleetDeliveryEvidence.guards.NotDelivered) ||
    O.contains(finding.classification, FleetClassification.Enum.gate)
      ? cancelAndRerun(repository, finding.job.runId)
      : [];
  return A.appendAll(A.appendAll(O.toArray(redelivery), gate), rerun);
});

/**
 * Assemble the report of one run.
 *
 * **Example** (Count the GitHub reads)
 *
 * ```ts
 * import { FleetPreviousRun, fleetCheckReport } from "@beep/repo-cli/commands/Ci"
 *
 * const report = fleetCheckReport({
 *   repository: "beep-effect/beep-effect",
 *   checkedAt: 0,
 *   pools: [],
 *   findings: [],
 *   previousRun: FleetPreviousRun.cases.NoneFound.make({}),
 *   githubRequests: 7,
 * })
 * console.log(report.githubRequests) // 7
 * ```
 *
 * @param input - The repository, time, observations, findings, previous run, GitHub request count and listing notes.
 * @returns The report the summary and the exit code are built from.
 * @category use-cases
 * @since 0.0.0
 */
export const fleetCheckReport = (input: {
  readonly repository: string;
  readonly checkedAt: number;
  readonly pools: ReadonlyArray<FleetPoolObservation>;
  readonly findings: ReadonlyArray<FleetJobFinding>;
  readonly previousRun: FleetPreviousRun;
  readonly githubRequests: number;
  readonly listingNotes?: ReadonlyArray<string>;
}): FleetCheckReport => FleetCheckReport.make(input);

/**
 * The alerting findings of a report.
 *
 * **Example** (A quiet run)
 *
 * ```ts
 * import { FleetPreviousRun, fleetAlerts, fleetCheckReport } from "@beep/repo-cli/commands/Ci"
 *
 * const report = fleetCheckReport({
 *   repository: "beep-effect/beep-effect",
 *   checkedAt: 0,
 *   pools: [],
 *   findings: [],
 *   previousRun: FleetPreviousRun.cases.NoneFound.make({}),
 *   githubRequests: 0,
 * })
 * console.log(fleetAlerts(report).length) // 0
 * ```
 *
 * @param report - One run's observations, findings and previous check run.
 * @returns Its findings whose verdict alerts.
 * @category use-cases
 * @since 0.0.0
 */
export const fleetAlerts = (report: FleetCheckReport): ReadonlyArray<FleetJobFinding> =>
  A.filter(report.findings, (finding) => isFleetAlert(finding.verdict));

const previousRunLabel = (report: FleetCheckReport): string =>
  FleetPreviousRun.match(report.previousRun, {
    Found: (found) =>
      O.match(found.currentStartedAt, {
        onNone: () =>
          `previous check run ${found.runId} started ${formatTime(found.startedAt)}, ${formatAge(report.checkedAt - found.startedAt)} before this check`,
        onSome: (current) => {
          const gap = current - found.startedAt;
          const note = isCadenceGapFinding(report.previousRun)
            ? ` (more than 30 minutes with ${found.fleetJobsInGap} fleet job(s) created inside it: a finding for the gate)`
            : gap > FLEET_THRESHOLDS.cadenceGap
              ? " (more than 30 minutes, no fleet job created inside it: information only)"
              : "";
          return `previous check run ${found.runId} started ${formatTime(found.startedAt)}, ${formatAge(gap)} before this check run started${note}`;
        },
      }),
    NoneFound: () => "previous check run: none found",
    Unreadable: ({ reason }) => `previous check run: unreadable (${reason})`,
  });

const verdictCounts = (report: FleetCheckReport): string => {
  const counts = A.reduce(report.findings, HashMap.empty<string, number>(), (acc, finding) =>
    HashMap.set(acc, finding.verdict._tag, O.getOrElse(HashMap.get(acc, finding.verdict._tag), () => 0) + 1)
  );
  return pipe(
    FleetVerdictTag.literals,
    A.map((tag) => O.map(HashMap.get(counts, tag), (count) => `${tag} ${count}`)),
    A.getSomes,
    A.match({ onEmpty: () => "none", onNonEmpty: A.join(", ") })
  );
};

const p95Label = (report: FleetCheckReport): string =>
  A.join(
    A.map(
      report.pools,
      (pool) => `${pool.pool.pool} ${O.match(pool.p95QueueToStart, { onNone: () => "n/a", onSome: formatAge })}`
    ),
    ", "
  );

/**
 * Render the step summary of a report: one green line, or every alert with
 * its evidence and remedies.
 *
 * **Example** (A green run)
 *
 * ```ts
 * import { FleetCheckReport, FleetPreviousRun, renderFleetCheckSummary } from "@beep/repo-cli/commands/Ci"
 *
 * const report = FleetCheckReport.make({
 *   repository: "beep-effect/beep-effect",
 *   checkedAt: 0,
 *   pools: [],
 *   findings: [],
 *   previousRun: FleetPreviousRun.cases.NoneFound.make({}),
 * })
 * console.log(renderFleetCheckSummary(report).startsWith("fleet missed-event check: green")) // true
 * ```
 *
 * @param report - One run's observations, findings and previous check run.
 * @returns The Markdown summary.
 * @category use-cases
 * @since 0.0.0
 */
export const renderFleetCheckSummary = (report: FleetCheckReport): string => {
  const alerts = fleetAlerts(report);
  const totals = `${A.length(report.findings)} queued job(s) checked; verdicts: ${verdictCounts(report)}; p95 queue-to-start: ${p95Label(report)}; ${previousRunLabel(report)}; ${report.githubRequests} GitHub request(s)`;
  if (A.isReadonlyArrayEmpty(alerts)) {
    const noted = A.isReadonlyArrayEmpty(report.listingNotes) ? "" : `; notes: ${A.join(report.listingNotes, "; ")}`;
    return `fleet missed-event check: green at ${formatTime(report.checkedAt)}: ${totals}${noted}\n`;
  }
  const rows = A.map(
    alerts,
    (finding) =>
      `| ${finding.job.id} | ${finding.job.runId} | ${finding.pool} | ${formatAge(finding.age)} | ${fleetVerdictLabel(finding.verdict)} | ${O.match(finding.classification, { onNone: () => "none", onSome: classificationLabel })} | ${evidenceLabel(finding.evidence)} |`
  );
  const remedies = A.flatMap(alerts, (finding) =>
    A.match(fleetRemedies(report.repository, finding), {
      onEmpty: () => [],
      onNonEmpty: (lines) =>
        A.prepend(
          A.map(lines, (line) => `  - ${line}`),
          `- job ${finding.job.id}:`
        ),
    })
  );
  return A.join(
    [
      `## Fleet missed-event check: ${A.length(alerts)} alert(s)`,
      "",
      ...A.map(report.listingNotes, (note) => `- note: ${note}`),
      ...(A.isReadonlyArrayEmpty(report.listingNotes) ? [] : [""]),
      `checked at ${formatTime(report.checkedAt)}: ${totals}`,
      "",
      "| job | run | pool | age | verdict | classification | delivery evidence |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      ...rows,
      "",
      "### Remedies (printed only; this check never runs them)",
      "",
      ...A.match(remedies, { onEmpty: () => ["- none"], onNonEmpty: (lines) => lines }),
      "",
    ],
    "\n"
  );
};

/**
 * The runs of the check's workflow earlier than this one, newest first.
 *
 * **Details**
 *
 * Run ids grow with creation, so an earlier run has a smaller id: a newer
 * run pending behind this one is left out. Without a run id, as for a local
 * run, every run is earlier.
 *
 * **Example** (Leave out this run and a newer one)
 *
 * ```ts
 * import { FleetWorkflowRun, earlierFleetRuns } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const runs = [
 *   FleetWorkflowRun.make({ id: 7, createdAt: 3000 }),
 *   FleetWorkflowRun.make({ id: 6, createdAt: 2000 }),
 *   FleetWorkflowRun.make({ id: 5, createdAt: 1000 }),
 * ]
 * console.log(earlierFleetRuns(runs, O.some(6)).map((run) => run.id)) // [5]
 * ```
 *
 * @param runs - The workflow's recent runs.
 * @param currentRunId - This run's id, when it runs in Actions.
 * @returns The earlier runs, newest first.
 * @category use-cases
 * @since 0.0.0
 */
export const earlierFleetRuns: {
  (currentRunId: O.Option<number>): (runs: ReadonlyArray<FleetWorkflowRun>) => ReadonlyArray<FleetWorkflowRun>;
  (runs: ReadonlyArray<FleetWorkflowRun>, currentRunId: O.Option<number>): ReadonlyArray<FleetWorkflowRun>;
} = dual(
  2,
  (runs: ReadonlyArray<FleetWorkflowRun>, currentRunId: O.Option<number>): ReadonlyArray<FleetWorkflowRun> =>
    pipe(
      runs,
      A.filter((run) => O.match(currentRunId, { onNone: () => true, onSome: (current) => run.id < current })),
      A.sort(Order.flip(Order.mapInput(Order.Number, (run: FleetWorkflowRun) => run.id)))
    )
);

/**
 * The checking run a workflow run and its check job make, when the check job
 * ran.
 *
 * **Example** (A guard-skipped run is no checking run)
 *
 * ```ts
 * import { FleetCheckJob, FleetWorkflowRun, checkingRun } from "@beep/repo-cli/commands/Ci"
 *
 * const run = FleetWorkflowRun.make({ id: 5, createdAt: 0 })
 * console.log(checkingRun(run, FleetCheckJob.cases.NotRan.make({}))._tag) // "None"
 * console.log(checkingRun(run, FleetCheckJob.cases.Ran.make({ startedAt: 60000 }))._tag) // "Some"
 * ```
 *
 * @param run - The workflow run.
 * @param job - Its check job's state.
 * @returns The checking run, or none.
 * @category use-cases
 * @since 0.0.0
 */
export const checkingRun: {
  (job: FleetCheckJob): (run: FleetWorkflowRun) => O.Option<FleetCheckingRun>;
  (run: FleetWorkflowRun, job: FleetCheckJob): O.Option<FleetCheckingRun>;
} = dual(
  2,
  (run: FleetWorkflowRun, job: FleetCheckJob): O.Option<FleetCheckingRun> =>
    FleetCheckJob.match(job, {
      Ran: ({ startedAt }) => FleetCheckingRun.makeOption({ runId: run.id, startedAt }),
      NotRan: () => O.none(),
    })
);

/**
 * The guard's decision: skip the check job when the previous checking run's
 * check job started inside the guard window, run it otherwise.
 *
 * **Details**
 *
 * A `workflow_dispatch` always runs. A previous run that could not be read
 * runs too: the guard fails open. No previous checking run runs.
 *
 * **Example** (A check started three minutes ago)
 *
 * ```ts
 * import { FleetCheckingRun, fleetGuardDecision } from "@beep/repo-cli/commands/Ci"
 * import * as Result from "effect/Result"
 *
 * const decision = fleetGuardDecision({
 *   event: "workflow_run",
 *   now: 600000,
 *   previous: Result.succeed(FleetCheckingRun.makeOption({ runId: 5, startedAt: 420000 })),
 * })
 * console.log(decision._tag) // "Skip"
 * ```
 *
 * @param input - The starting event, the time and the previous checking run or why it is unreadable.
 * @returns Run or skip.
 * @category use-cases
 * @since 0.0.0
 */
export const fleetGuardDecision = (input: {
  readonly event: string;
  readonly now: number;
  readonly previous: Result.Result<O.Option<FleetCheckingRun>, string>;
}): FleetGuardDecision =>
  input.event === "workflow_dispatch"
    ? FleetGuardDecision.cases.Run.make({ reason: "workflow_dispatch always runs" })
    : Result.match(input.previous, {
        onFailure: (reason) =>
          FleetGuardDecision.cases.Run.make({ reason: `previous check run unreadable, failing open (${reason})` }),
        onSuccess: O.match({
          onNone: () => FleetGuardDecision.cases.Run.make({ reason: "no previous check run found" }),
          onSome: ({ runId, startedAt }) =>
            input.now - startedAt < FLEET_THRESHOLDS.guardWindow
              ? FleetGuardDecision.cases.Skip.make({ runId, startedAt })
              : FleetGuardDecision.cases.Run.make({
                  reason: `previous check run ${runId} started ${formatAge(input.now - startedAt)} ago`,
                }),
        }),
      });

/**
 * The guard's one-line verdict for the log.
 *
 * **Example** (A skip)
 *
 * ```ts
 * import { FleetGuardDecision, renderFleetGuardDecision } from "@beep/repo-cli/commands/Ci"
 *
 * const skip = FleetGuardDecision.cases.Skip.make({ runId: 5, startedAt: 0 })
 * console.log(renderFleetGuardDecision(skip, 180000))
 * // fleet missed-event guard: skip; check run 5 started 3m00s ago, inside the 8m00s window
 * ```
 *
 * @param decision - Run with its reason, or Skip with the checking run it found.
 * @param now - Epoch milliseconds the guard decided at, for the skipped run's age.
 * @returns `fleet missed-event guard: run; <reason>` or the skip line naming the run and window.
 * @category use-cases
 * @since 0.0.0
 */
export const renderFleetGuardDecision: {
  (now: number): (decision: FleetGuardDecision) => string;
  (decision: FleetGuardDecision, now: number): string;
} = dual(2, (decision: FleetGuardDecision, now: number): string =>
  FleetGuardDecision.match(decision, {
    Run: ({ reason }) => `fleet missed-event guard: run; ${reason}`,
    Skip: ({ runId, startedAt }) =>
      `fleet missed-event guard: skip; check run ${runId} started ${formatAge(now - startedAt)} ago, inside the ${formatAge(FLEET_THRESHOLDS.guardWindow)} window`,
  })
);

/**
 * The previous run a report names, from the previous checking run, this
 * run's own check start and the fleet jobs it read.
 *
 * **Details**
 *
 * The gap ends at this run's check start, or at `checkedAt` when that is
 * unknown. A job counts when it was created after the previous check
 * started and no later than the gap's end.
 *
 * **Example** (A gap with one fleet job)
 *
 * ```ts
 * import { FleetCheckingRun, FleetJob, fleetPreviousRun } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const job = FleetJob.make({
 *   id: 1,
 *   runId: 2,
 *   name: "Heavy",
 *   status: "queued",
 *   labels: ["beep-fleet-heavy"],
 *   createdAt: 1000,
 *   startedAt: O.none(),
 *   runnerName: O.none(),
 * })
 * const previous = fleetPreviousRun({
 *   previous: FleetCheckingRun.makeOption({ runId: 5, startedAt: 0 }),
 *   currentStartedAt: O.some(2000),
 *   jobs: [job],
 *   checkedAt: 3000,
 * })
 * console.log(previous._tag) // "Found"
 * ```
 *
 * @param input - The previous checking run, this run's check start, the fleet jobs read and the check time.
 * @returns The report's previous run.
 * @category use-cases
 * @since 0.0.0
 */
export const fleetPreviousRun = (input: {
  readonly previous: O.Option<FleetCheckingRun>;
  readonly currentStartedAt: O.Option<number>;
  readonly jobs: ReadonlyArray<FleetJob>;
  readonly checkedAt: number;
}): FleetPreviousRun =>
  O.match(input.previous, {
    onNone: () => FleetPreviousRun.cases.NoneFound.make({}),
    onSome: ({ runId, startedAt }) => {
      const end = O.getOrElse(input.currentStartedAt, () => input.checkedAt);
      return FleetPreviousRun.cases.Found.make({
        runId,
        startedAt,
        currentStartedAt: input.currentStartedAt,
        fleetJobsInGap: A.length(A.filter(input.jobs, (job) => job.createdAt > startedAt && job.createdAt <= end)),
      });
    },
  });

/**
 * Whether a report's previous run is a cadence-gap finding for the gate: a
 * gap from check start to check start longer than 30 minutes with at least
 * one fleet job created inside it.
 *
 * **Example** (A quiet hour is information only)
 *
 * ```ts
 * import { FleetPreviousRun, isCadenceGapFinding } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const quiet = FleetPreviousRun.cases.Found.make({
 *   runId: 5,
 *   startedAt: 0,
 *   currentStartedAt: O.some(3600000),
 *   fleetJobsInGap: 0,
 * })
 * console.log(isCadenceGapFinding(quiet)) // false
 * ```
 *
 * @param previousRun - The report's previous run.
 * @returns `true` for a finding.
 * @category use-cases
 * @since 0.0.0
 */
export const isCadenceGapFinding = (previousRun: FleetPreviousRun): boolean =>
  FleetPreviousRun.guards.Found(previousRun) &&
  previousRun.fleetJobsInGap > 0 &&
  O.exists(previousRun.currentStartedAt, (current) => current - previousRun.startedAt > FLEET_THRESHOLDS.cadenceGap);
