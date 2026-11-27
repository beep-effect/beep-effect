/**
 * Event-driven simulator for the SCHE-06 policy over an arrival stream.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { PosInt } from "../projection/PosInt.ts";
import { AdmissionPriority } from "../projection/Schemas.ts";
import { attemptVerdict, conditionalDeadline, fairnessReadingFor, isProtectedAt, queueOrder } from "./Policy.ts";
import {
  AttemptVerdict,
  FinishedLease,
  QueuedUnit,
  RunningLease,
  SchedulerView,
  SimulationEvent,
  SimulationInputError,
  SimulationReport,
  UnitOutcome,
} from "./Schemas.ts";
import type { VerdictFunction } from "./Policy.ts";
import type { AdmissionRoute, BackfillPolicy, UnitArrival } from "./Schemas.ts";

interface Running {
  readonly lease: RunningLease;
  readonly releaseAtMillis: number;
}

interface SimulationState {
  readonly activeTokens: number;
  readonly arrivals: ReadonlyArray<UnitArrival>;
  readonly breachReported: HashSet.HashSet<string>;
  readonly events: ReadonlyArray<SimulationEvent>;
  readonly finished: ReadonlyArray<FinishedLease>;
  readonly holds: HashMap.HashMap<string, number>;
  readonly nowMillis: number;
  readonly outcomes: ReadonlyArray<UnitOutcome>;
  readonly peakActiveTokens: number;
  readonly protectedStamped: HashSet.HashSet<string>;
  readonly running: ReadonlyArray<Running>;
  readonly waiting: ReadonlyArray<QueuedUnit>;
}

const arrivalOrder: Order.Order<UnitArrival> = pipe(
  Order.mapInput(Order.Number, (arrival: UnitArrival) => arrival.enqueuedAtMillis),
  Order.combine(Order.mapInput(Order.String, (arrival: UnitArrival) => arrival.nonce))
);

const viewOf = (policy: BackfillPolicy, state: SimulationState): SchedulerView =>
  SchedulerView.make({
    nowMillis: S.Natural.make(state.nowMillis),
    waiting: state.waiting,
    running: A.map(state.running, (entry) => entry.lease),

    finished: A.filter(
      state.finished,
      (lease) => lease.releasedAtMillis > state.nowMillis - policy.fairnessWindowMillis
    ),
  });

const releaseDue = (state: SimulationState): SimulationState =>
  A.reduce(
    A.filter(state.running, (entry) => entry.releaseAtMillis === state.nowMillis),
    { ...state, running: A.filter(state.running, (entry) => entry.releaseAtMillis !== state.nowMillis) },
    (next, entry) => {
      const activeTokens = next.activeTokens - entry.lease.weightTokens;
      return {
        ...next,
        activeTokens,
        finished: A.append(
          next.finished,
          FinishedLease.make({
            originKey: entry.lease.originKey,
            checkoutKey: entry.lease.checkoutKey,
            weightTokens: entry.lease.weightTokens,
            admittedAtMillis: entry.lease.admittedAtMillis,
            releasedAtMillis: S.Natural.make(state.nowMillis),
          })
        ),
        events: A.append(
          next.events,
          SimulationEvent.cases.Released.make({
            atMillis: S.Natural.make(state.nowMillis),
            nonce: entry.lease.nonce,
            activeTokensAfter: S.Natural.make(activeTokens),
          })
        ),
      };
    }
  );

const enqueueClampedArrivals = (policy: BackfillPolicy, state: SimulationState): SimulationState => {
  const [due, later] = A.span(state.arrivals, (arrival) => arrival.enqueuedAtMillis === state.nowMillis);
  return A.reduce(due, { ...state, arrivals: later }, (next, arrival) => {
    const weightTokens = N.min(arrival.requestedWeightTokens, policy.capacityTokens);
    return {
      ...next,
      holds: HashMap.set(next.holds, arrival.nonce, arrival.holdMillis),
      waiting: A.append(
        next.waiting,
        QueuedUnit.make({
          nonce: arrival.nonce,
          originKey: arrival.originKey,
          checkoutKey: arrival.checkoutKey,
          priority: arrival.priority,
          weightTokens: PosInt.make(weightTokens),
          enqueuedAtMillis: arrival.enqueuedAtMillis,
          etaMillis: arrival.etaMillis,
          deadlineMillis: O.none(),
        })
      ),
      events: A.append(
        next.events,
        SimulationEvent.cases.Enqueued.make({
          atMillis: arrival.enqueuedAtMillis,
          nonce: arrival.nonce,
          weightTokens: PosInt.make(weightTokens),
          clamped: weightTokens < arrival.requestedWeightTokens,
        })
      ),
    };
  });
};

const protectDue = (policy: BackfillPolicy, state: SimulationState): SimulationState => {
  const due = A.filter(
    queueOrder(viewOf(policy, state), policy),
    (unit) => isProtectedAt(unit, policy, state.nowMillis) && !HashSet.has(state.protectedStamped, unit.nonce)
  );
  return A.reduce(due, state, (next, unit) => {
    const deadline = conditionalDeadline(viewOf(policy, next), policy, unit);
    const deadlineMillis = O.map(deadline, S.Natural.make);
    return {
      ...next,
      protectedStamped: HashSet.add(next.protectedStamped, unit.nonce),
      waiting: A.map(next.waiting, (queued) =>
        queued.nonce === unit.nonce ? QueuedUnit.make({ ...queued, deadlineMillis }) : queued
      ),
      events: A.append(
        next.events,
        SimulationEvent.cases.Protected.make({
          atMillis: S.Natural.make(state.nowMillis),
          nonce: unit.nonce,
          deadlineMillis,
        })
      ),
    };
  });
};

const reportBreaches = (state: SimulationState): SimulationState =>
  A.reduce(
    A.getSomes(
      A.map(state.waiting, (unit) =>
        pipe(
          unit.deadlineMillis,
          O.filter((deadline) => state.nowMillis > deadline && !HashSet.has(state.breachReported, unit.nonce)),
          O.map((deadlineMillis) => ({ nonce: unit.nonce, deadlineMillis }))
        )
      )
    ),
    state,
    (next, breach) => ({
      ...next,
      breachReported: HashSet.add(next.breachReported, breach.nonce),
      events: A.append(
        next.events,
        SimulationEvent.cases.BoundBreached.make({
          atMillis: S.Natural.make(state.nowMillis),
          nonce: breach.nonce,
          deadlineMillis: breach.deadlineMillis,
        })
      ),
    })
  );

const admit = (
  policy: BackfillPolicy,
  state: SimulationState,
  unit: QueuedUnit,
  route: AdmissionRoute
): SimulationState => {
  const fairness = fairnessReadingFor(viewOf(policy, state), policy, unit);
  const activeTokens = state.activeTokens + unit.weightTokens;

  const holdMillis = HashMap.getUnsafe(state.holds, unit.nonce);
  return {
    ...state,
    activeTokens,
    peakActiveTokens: N.max(state.peakActiveTokens, activeTokens),
    waiting: A.filter(state.waiting, (queued) => queued.nonce !== unit.nonce),
    running: A.append(state.running, {
      lease: RunningLease.make({
        nonce: unit.nonce,
        originKey: unit.originKey,
        checkoutKey: unit.checkoutKey,
        weightTokens: unit.weightTokens,
        admittedAtMillis: S.Natural.make(state.nowMillis),
        etaMillis: unit.etaMillis,
      }),
      releaseAtMillis: state.nowMillis + holdMillis,
    }),
    events: A.append(
      state.events,
      SimulationEvent.cases.Admitted.make({
        atMillis: S.Natural.make(state.nowMillis),
        nonce: unit.nonce,
        route,
        waitedMillis: S.Natural.make(state.nowMillis - unit.enqueuedAtMillis),
        activeTokensAfter: S.Natural.make(activeTokens),
        fairness,
      })
    ),
    outcomes: A.append(
      state.outcomes,
      UnitOutcome.make({
        nonce: unit.nonce,
        originKey: unit.originKey,
        enqueuedAtMillis: unit.enqueuedAtMillis,
        admittedAtMillis: S.Natural.make(state.nowMillis),
        route,
        deadlineMillis: unit.deadlineMillis,
      })
    ),
  };
};

const nextAdmission = (
  policy: BackfillPolicy,
  verdict: VerdictFunction,
  state: SimulationState
): O.Option<{ readonly unit: QueuedUnit; readonly route: AdmissionRoute }> => {
  const view = viewOf(policy, state);
  return A.findFirst(queueOrder(view, policy), (unit) =>
    AttemptVerdict.match(verdict(view, policy, unit.nonce), {
      Attempt: ({ route }) => O.some({ unit, route }),
      Wait: () => O.none(),
    })
  );
};

const admitAll = (policy: BackfillPolicy, verdict: VerdictFunction, state: SimulationState): SimulationState => {
  let next = state;
  let admission = nextAdmission(policy, verdict, next);
  while (O.isSome(admission)) {
    next = admit(policy, next, admission.value.unit, admission.value.route);
    admission = nextAdmission(policy, verdict, next);
  }
  return next;
};

const nextInstant = (policy: BackfillPolicy, state: SimulationState): O.Option<number> => {
  const later = (instant: number): O.Option<number> => (instant > state.nowMillis ? O.some(instant) : O.none());
  const candidates = A.getSomes([
    ...A.map(A.take(state.arrivals, 1), (arrival) => O.some<number>(arrival.enqueuedAtMillis)),
    ...A.map(state.running, (entry) => O.some(entry.releaseAtMillis)),
    ...A.map(state.waiting, (unit) => later(unit.enqueuedAtMillis + policy.protectAfterMillis)),
    ...A.map(
      A.filter(state.waiting, (unit) => AdmissionPriority.is.verify(unit.priority)),
      (unit) => later(unit.enqueuedAtMillis + policy.publishAgingMillis)
    ),
    ...A.map(state.waiting, (unit) => O.flatMap(unit.deadlineMillis, (deadline) => later(deadline + 1))),
  ]);
  return A.match(candidates, {
    onEmpty: O.none,
    onNonEmpty: (instants) => O.some(A.reduce(instants, Number.POSITIVE_INFINITY, N.min)),
  });
};

const stepAt = (policy: BackfillPolicy, verdict: VerdictFunction, state: SimulationState): SimulationState =>
  admitAll(policy, verdict, reportBreaches(protectDue(policy, enqueueClampedArrivals(policy, releaseDue(state)))));

const validateArrivals = (arrivals: ReadonlyArray<UnitArrival>): Effect.Effect<void, SimulationInputError> =>
  HashSet.size(HashSet.fromIterable(A.map(arrivals, (arrival) => arrival.nonce))) === A.length(arrivals)
    ? Effect.void
    : Effect.fail(SimulationInputError.make({ message: "Arrival nonces must be unique." }));

/**
 * Simulates an arrival stream to quiescence under a verdict function.
 *
 * **Details**
 *
 * At each decision instant the model releases leases due, enqueues arrivals
 * due, stamps the deadline of each unit entering protection, journals each
 * newly breached deadline, then admits contenders until none may attempt.
 * The verdict defaults to {@link attemptVerdict}; the property suite passes
 * mutants to prove the laws can fail. A verdict that never admits a queued
 * unit ends the run with that unit missing from `outcomes`.
 *
 * **Gotchas**
 *
 * Decisions happen only at the instants above. With fairness on, windowed
 * usage keeps changing between them, so the queue order (and with it which
 * unit is head) can change while nothing is released or enqueued. A polling
 * scheduler re-reads the order every heartbeat and may admit such a unit
 * earlier than the model does. The laws do not depend on the instant: capacity,
 * the conditional bound and the backfill rule hold at every decision, and the
 * protected order, the only one the bound reads, never drifts. Admission times
 * under fairness are therefore an event-driven approximation of the live
 * scheduler, not a replay of it.
 *
 * **Example** (Simulate one unit)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { simulateStream } from "@/backfill/Simulation"
 * import { BackfillPolicy, UnitArrival } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 * const policy = BackfillPolicy.make({
 *   capacityTokens: PosInt.make(10),
 *   publishAgingMillis: PosInt.make(120_000),
 *   protectAfterMillis: PosInt.make(120_000),
 *   fairnessWindowMillis: PosInt.make(1_800_000),
 *   promotionOverheadMillis: S.Natural.make(0),
 *   backfill: "easy",
 *   fairness: "origin-checkout"
 * })
 * const arrival = UnitArrival.make({
 *   nonce: "unit-1",
 *   originKey: "a",
 *   checkoutKey: "a",
 *   priority: "publish",
 *   requestedWeightTokens: PosInt.make(12),
 *   enqueuedAtMillis: S.Natural.make(0),
 *   etaMillis: O.none(),
 *   holdMillis: PosInt.make(1_000)
 * })
 * const report = Effect.runSync(simulateStream(policy, [arrival]))
 * console.log(report.peakActiveTokens) // 10
 * ```
 *
 * @category simulation
 * @since 0.0.0
 */
export const simulateStream = Effect.fn("BackfillModel.simulate")(function* (
  policy: BackfillPolicy,
  arrivals: ReadonlyArray<UnitArrival>,
  verdict: VerdictFunction = attemptVerdict
): Effect.fn.Return<SimulationReport, SimulationInputError> {
  yield* validateArrivals(arrivals);
  const sorted = A.sort(arrivals, arrivalOrder);
  let state: SimulationState = {
    activeTokens: 0,
    arrivals: sorted,
    breachReported: HashSet.empty(),
    events: A.empty(),
    finished: A.empty(),
    holds: HashMap.empty(),
    nowMillis: 0,
    outcomes: A.empty(),
    peakActiveTokens: 0,
    protectedStamped: HashSet.empty(),
    running: A.empty(),
    waiting: A.empty(),
  };
  let instant = O.map(A.head(sorted), (arrival) => arrival.enqueuedAtMillis);
  while (O.isSome(instant)) {
    state = stepAt(policy, verdict, { ...state, nowMillis: instant.value });
    instant = nextInstant(policy, state);
  }
  return SimulationReport.make({
    events: state.events,
    outcomes: state.outcomes,
    peakActiveTokens: S.Natural.make(state.peakActiveTokens),
  });
});
