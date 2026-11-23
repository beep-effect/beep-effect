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
 * `WaitingAtCap`, `Waiting`. A job whose delivery evidence is `missed` is
 * therefore `MissedDelivery` (classification `missed`) before any `NoLaunch`
 * condition is read; a `NoLaunch` carries `lost`, `unknown` or `gate`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import {
  FLEET_THRESHOLDS,
  FleetCheckReport,
  FleetClassification,
  FleetDeliveryEvidence,
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
  FleetScheduledRun,
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
export const fleetPoolCaps = (projection: FleetPoolCapsInput): ReadonlyArray<FleetPoolCap> =>
  A.map(projection.pools, (pool) =>
    FleetPoolCap.make({ pool: pool.pool, label: pool.label, cap: pool[projection.phase] })
  );

/**
 * The production pools, from the committed generated caps.
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
 * const sources = [
 *   FleetHookSourceEntry.make({ source: FleetHookSource.cases.RepositoryHook.make({ hookId: "714397446" }), effectiveFrom: 0 }),
 *   FleetHookSourceEntry.make({ source: FleetHookSource.cases.NoHook.make({}), effectiveFrom: 1000 }),
 * ] as const
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
 * console.log(observeFleetPool({ pool, firstRead: [], secondRead: [], jobs: [], now: 0 }).atCap) // false
 * ```
 *
 * @param input - The pool, both runner reads, every job read and the time.
 * @returns The pool's counts, cap state, idle and not-busy runners, and progress.
 * @category use-cases
 * @since 0.0.0
 */
export const observeFleetPool = (input: {
  readonly pool: FleetPoolCap;
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
    firstCount: A.length(first),
    secondCount: A.length(second),
    atCap: A.length(first) >= input.pool.cap || A.length(second) >= input.pool.cap,
    idleRunnerIds: sortedIds(HashSet.intersection(idsWhere(first, isIdle), idsWhere(second, isIdle))),
    notBusyRunnerIds: sortedIds(HashSet.intersection(idsWhere(first, isNotBusy), idsWhere(second, isNotBusy))),
    currentNotBusy: A.length(A.filter(second, isNotBusy)),
    progress: A.some(started, (job) => job.startedAt >= input.now - FLEET_THRESHOLDS.progressWindow),
    p95QueueToStart: percentile95(A.map(started, (job) => job.startedAt - job.createdAt)),
  });
};

/**
 * The window a job's `queued` delivery lands in: from its creation minus
 * two minutes to its creation plus five.
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

const isTwoHundred = (statusCode: number): boolean => statusCode >= 200 && statusCode < 300;

/**
 * Judge one job's delivery evidence from the deliveries read and their
 * details.
 *
 * **Details**
 *
 * The candidates are the `queued` deliveries inside the job's window. A
 * 2xx candidate naming the job is `Delivered`; otherwise a non-2xx one is
 * `DeliveryFailed`. With no match, an unreadable candidate detail, a failed
 * page whose walk did not reach the job's creation, or pages that do not
 * reach it, make the evidence `Unreadable`; only a walk that reached past the
 * job's creation with every candidate read makes it `NotDelivered`.
 *
 * @param input - The job, its hook, the walk's deliveries, oldest time and failure, and the detail reads.
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
  readonly details: HashMap.HashMap<string, O.Option<FleetDeliveryDetail>>;
}): FleetDeliveryEvidence => {
  const window = deliveryWindow(input.job);
  const candidates = A.filter(
    input.deliveries,
    (delivery) =>
      O.contains(delivery.action, "queued") &&
      delivery.deliveredAt >= window.start &&
      delivery.deliveredAt <= window.end
  );
  const readOf = (delivery: FleetHookDelivery) => O.flatten(HashMap.get(input.details, delivery.id));
  const matches = A.filter(candidates, (delivery) =>
    O.exists(readOf(delivery), (detail) => O.contains(detail.workflowJobId, `${input.job.id}`))
  );
  const unreadable = A.length(A.filter(candidates, (delivery) => O.isNone(readOf(delivery))));
  return pipe(
    A.findFirst(matches, (delivery) => isTwoHundred(delivery.statusCode)),
    O.map((delivery) =>
      FleetDeliveryEvidence.cases.Delivered.make({
        hookId: input.hookId,
        deliveryId: delivery.id,
        statusCode: delivery.statusCode,
      })
    ),
    O.orElse(() =>
      O.map(A.head(matches), (delivery) =>
        FleetDeliveryEvidence.cases.DeliveryFailed.make({
          hookId: input.hookId,
          deliveryId: delivery.id,
          statusCode: delivery.statusCode,
        })
      )
    ),
    O.getOrElse(() =>
      unreadable > 0
        ? FleetDeliveryEvidence.cases.Unreadable.make({
            reason: `${unreadable} candidate delivery detail(s) unreadable after retries`,
            oldestReached: input.oldestReached,
          })
        : O.match(
            O.filter(input.oldestReached, (oldest) => oldest <= input.job.createdAt),
            {
              onSome: (oldestReached) =>
                FleetDeliveryEvidence.cases.NotDelivered.make({
                  windowStart: window.start,
                  windowEnd: window.end,
                  oldestReached,
                }),
              onNone: () =>
                FleetDeliveryEvidence.cases.Unreadable.make({
                  reason: O.getOrElse(
                    input.walkFailure,
                    () => "the pages read do not reach back to the job's creation"
                  ),
                  oldestReached: input.oldestReached,
                }),
            }
          )
    )
  );
};

/**
 * The classification delivery evidence gives.
 *
 * **Example** (A 2xx delivery and no launch is lost)
 *
 * ```ts
 * import { FleetDeliveryEvidence, classifyFleetEvidence } from "@beep/repo-cli/commands/Ci"
 *
 * const evidence = FleetDeliveryEvidence.cases.Delivered.make({ hookId: "1", deliveryId: "2", statusCode: 200 })
 * console.log(classifyFleetEvidence(evidence)) // "lost"
 * ```
 *
 * @param evidence - The job's delivery evidence.
 * @returns `lost`, `missed`, `unknown` or `gate`.
 * @category use-cases
 * @since 0.0.0
 */
export const classifyFleetEvidence = (evidence: FleetDeliveryEvidence): FleetClassification =>
  FleetDeliveryEvidence.match(evidence, {
    Delivered: () => FleetClassification.Enum.lost,
    DeliveryFailed: () => FleetClassification.Enum.missed,
    NotDelivered: () => FleetClassification.Enum.missed,
    Unreadable: () => FleetClassification.Enum.unknown,
    Gate: () => FleetClassification.Enum.gate,
  });

/**
 * Whether the deliveries must be read for a job: its source at creation is a
 * repository hook and it is old enough for its delivery to be due.
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

const launchesSince = (job: FleetJob, poolJobs: ReadonlyArray<FleetJob>, observation: FleetPoolObservation) =>
  A.length(A.filter(poolJobs, (other) => O.exists(startedOnRunner(other), (at) => at >= job.createdAt))) +
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
 * **Example** (Waiting with three launches for rank four)
 *
 * ```ts
 * import { FleetPoolCap, FleetPoolObservation, decideFleetVerdict } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const observation = FleetPoolObservation.make({
 *   pool: FleetPoolCap.make({ pool: "heavy", label: "beep-fleet-heavy", cap: 5 }),
 *   firstCount: 1, secondCount: 1, atCap: false, idleRunnerIds: [], notBusyRunnerIds: [],
 *   currentNotBusy: 0, progress: true, p95QueueToStart: O.none(),
 * })
 * const verdict = decideFleetVerdict({ observation, age: 900000, launches: 3, rank: 4, oldestQueuedAge: 900000, evidence: O.none() })
 * console.log(verdict._tag) // "Waiting"
 * ```
 *
 * @param input - The pool observation, the job's age, launches, rank and evidence, and the pool's oldest queued age.
 * @returns The first verdict that holds.
 * @category use-cases
 * @since 0.0.0
 */
export const decideFleetVerdict = (input: {
  readonly observation: FleetPoolObservation;
  readonly age: number;
  readonly launches: number;
  readonly rank: number;
  readonly oldestQueuedAge: number;
  readonly evidence: O.Option<FleetDeliveryEvidence>;
}): FleetVerdict => {
  const { observation } = input;
  if (observation.atCap && A.isReadonlyArrayNonEmpty(observation.idleRunnerIds)) {
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
  if (
    input.age >= FLEET_THRESHOLDS.missedDeliveryAge &&
    O.exists(input.evidence, (evidence) => classifyFleetEvidence(evidence) === FleetClassification.Enum.missed)
  ) {
    return FleetVerdict.cases.MissedDelivery.make({});
  }
  const reason =
    !observation.atCap && input.age >= FLEET_THRESHOLDS.noLaunchAge && A.isReadonlyArrayEmpty(observation.idleRunnerIds)
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
 * @param input - The observations, every job read, the hook sources and the time.
 * @returns One entry per queued pool job.
 * @category use-cases
 * @since 0.0.0
 */
export const queuedFleetJobs = (input: {
  readonly observations: ReadonlyArray<FleetPoolObservation>;
  readonly jobs: ReadonlyArray<FleetJob>;
  readonly hookSources: FleetHookSources;
  readonly now: number;
}): ReadonlyArray<FleetQueuedJob> =>
  A.flatMap(input.observations, (observation) => {
    const poolJobs = A.filter(input.jobs, (job) => hasLabel(observation.pool.label)(job.labels));
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
        launches: launchesSince(job, poolJobs, observation),
        oldestQueuedAge,
        source: hookSourceAt(input.hookSources, job.createdAt),
      })
    );
  });

/**
 * Give a queued job its finding from its delivery evidence.
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
      verdict: decideFleetVerdict({ ...queued, evidence }),
      evidence,
      classification: O.map(evidence, classifyFleetEvidence),
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
    Stuck: ({ idleRunnerIds }) => `Stuck (idle at cap in both reads: ${A.join(A.map(idleRunnerIds, String), ", ")})`,
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
 * A 2xx or failed `queued` delivery prints its redelivery. A `missed` job
 * and a gate-classified job print the cancel-and-rerun pair, marked as the
 * gate's call because it reruns the whole run. `gh run rerun --failed`
 * refuses an in-progress run and is never printed for a queued job.
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
  const rerun = O.exists(
    finding.classification,
    (classification) =>
      classification === FleetClassification.Enum.missed || classification === FleetClassification.Enum.gate
  )
    ? cancelAndRerun(repository, finding.job.runId)
    : [];
  return A.appendAll(A.appendAll(O.toArray(redelivery), gate), rerun);
});

/**
 * Assemble the report of one run.
 *
 * @param input - The repository, time, observations, findings and previous run.
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
}): FleetCheckReport => FleetCheckReport.make(input);

/**
 * The alerting findings of a report.
 *
 * @param report - One run's observations, findings and previous scheduled run.
 * @returns Its findings whose verdict alerts.
 * @category use-cases
 * @since 0.0.0
 */
export const fleetAlerts = (report: FleetCheckReport): ReadonlyArray<FleetJobFinding> =>
  A.filter(report.findings, (finding) => isFleetAlert(finding.verdict));

const previousRunLabel = (report: FleetCheckReport): string =>
  FleetPreviousRun.match(report.previousRun, {
    Found: ({ runId, createdAt }) => {
      const gap = report.checkedAt - createdAt;
      const late =
        gap > Duration.toMillis(Duration.minutes(30)) ? " (more than 30 minutes: a finding for the gate)" : "";
      return `previous scheduled run ${runId} at ${formatTime(createdAt)}, ${formatAge(gap)} before this check${late}`;
    },
    NoneFound: () => "previous scheduled run: none found",
    Unreadable: ({ reason }) => `previous scheduled run: unreadable (${reason})`,
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
 * @param report - One run's observations, findings and previous scheduled run.
 * @returns The Markdown summary.
 * @category use-cases
 * @since 0.0.0
 */
export const renderFleetCheckSummary = (report: FleetCheckReport): string => {
  const alerts = fleetAlerts(report);
  const totals = `${A.length(report.findings)} queued job(s) checked; verdicts: ${verdictCounts(report)}; p95 queue-to-start: ${p95Label(report)}; ${previousRunLabel(report)}`;
  if (A.isReadonlyArrayEmpty(alerts)) {
    return `fleet missed-event check: green at ${formatTime(report.checkedAt)}: ${totals}\n`;
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
      `## Fleet missed-event check: ${A.length(alerts)} alert(s) at ${formatTime(report.checkedAt)}`,
      "",
      totals,
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
 * The previous scheduled run among the check's recent scheduled runs: the
 * newest that is not this run.
 *
 * @param runs - The scheduled runs, newest first.
 * @param currentRunId - This run's id, when it runs in Actions.
 * @returns The previous run, or none.
 * @category use-cases
 * @since 0.0.0
 */
export const previousScheduledRun: {
  (currentRunId: O.Option<number>): (runs: ReadonlyArray<FleetScheduledRun>) => FleetPreviousRun;
  (runs: ReadonlyArray<FleetScheduledRun>, currentRunId: O.Option<number>): FleetPreviousRun;
} = dual(
  2,
  (runs: ReadonlyArray<FleetScheduledRun>, currentRunId: O.Option<number>): FleetPreviousRun =>
    pipe(
      A.findFirst(runs, (run) => !O.contains(currentRunId, run.id)),
      O.match({
        onNone: () => FleetPreviousRun.cases.NoneFound.make({}),
        onSome: (run) => FleetPreviousRun.cases.Found.make({ runId: run.id, createdAt: run.createdAt }),
      })
    )
);
