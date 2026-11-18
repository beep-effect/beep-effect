/**
 * The SCHE-06 admission verdict on live scheduler state (PLAN slice 12).
 *
 * **Details**
 *
 * A port of the ciops lab model (`apps/labs/ciops/src/backfill/Policy.ts`):
 * protected ordering, origin-then-checkout fairness on windowed
 * token-milliseconds, EASY backfill against the head's projected start, and
 * the conditional bound stamped at protection. `selfMayAttempt` applies it
 * after the deployed skippable checks only while the admission protocol's
 * `backfill` or `fairness` gate is on; with both off the scheduler keeps its
 * deployed rule. With both modes off this verdict is that rule too, which the
 * tests check on arbitrary queues.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { AdmissionAttemptVerdict, AdmissionUsageInterval } from "./AdmissionBackfill.schemas.ts";
import { AdmissionBackfillMode, AdmissionFairnessMode } from "./AdmissionJournal.ts";
import type {
  AdmissionBackfillPolicy,
  AdmissionBackfillView,
  AdmissionEtaEstimator,
  AdmissionWaitReason,
} from "./AdmissionBackfill.schemas.ts";
import type { AdmissionJournalEvent } from "./AdmissionJournal.ts";
import type { RecordedAdmissionWorkKind, YeetAdmissionLease, YeetAdmissionTicket } from "./QualityScheduler.schemas.ts";

const isProtected = (policy: AdmissionBackfillPolicy, nowMillis: number, ticket: YeetAdmissionTicket): boolean =>
  nowMillis - ticket.enqueuedAtMillis >= policy.protectAfterMillis;

const effectiveRank = (policy: AdmissionBackfillPolicy, nowMillis: number, ticket: YeetAdmissionTicket): number =>
  ticket.priority === "publish" || nowMillis - ticket.enqueuedAtMillis >= policy.publishAgingMillis ? 0 : 1;

// Length-prefixed, so no two (origin, checkout) pairs share a key whatever characters they hold.
const checkoutUsageKey = (originKey: string, checkoutRoot: string): string =>
  `${Str.length(originKey)}:${originKey}${checkoutRoot}`;

interface UsageIndex {
  readonly byCheckout: HashMap.HashMap<string, number>;
  readonly byOrigin: HashMap.HashMap<string, number>;
}

const addUsage = (index: HashMap.HashMap<string, number>, key: string, tokenMillis: number) =>
  HashMap.set(index, key, O.getOrElse(HashMap.get(index, key), () => 0) + tokenMillis);

const usageIndex = (policy: AdmissionBackfillPolicy, view: AdmissionBackfillView): UsageIndex => {
  const windowStart = view.nowMillis - policy.fairnessWindowMillis;
  const spans = A.appendAll(
    A.map(view.leases, (lease) => ({
      originKey: lease.originKey,
      checkoutRoot: lease.checkoutRoot,
      weightTokens: lease.weightTokens,
      startMillis: lease.admittedAtMillis,
      endMillis: view.nowMillis,
    })),
    A.map(view.finished, (interval) => ({
      originKey: interval.originKey,
      checkoutRoot: interval.checkoutRoot,
      weightTokens: interval.weightTokens,
      startMillis: interval.admittedAtMillis,
      endMillis: interval.releasedAtMillis,
    }))
  );
  return A.reduce(
    spans,
    { byOrigin: HashMap.empty<string, number>(), byCheckout: HashMap.empty<string, number>() },
    (index, span) => {
      const overlap = N.min(span.endMillis, view.nowMillis) - N.max(span.startMillis, windowStart);
      const tokenMillis = span.weightTokens * N.max(overlap, 0);
      return {
        byOrigin: addUsage(index.byOrigin, span.originKey, tokenMillis),
        byCheckout: addUsage(index.byCheckout, checkoutUsageKey(span.originKey, span.checkoutRoot), tokenMillis),
      };
    }
  );
};

const fifoOrder: Order.Order<YeetAdmissionTicket> = pipe(
  Order.mapInput(Order.Number, (ticket: YeetAdmissionTicket) => ticket.enqueuedAtMillis),
  Order.combine(Order.mapInput(Order.String, (ticket: YeetAdmissionTicket) => ticket.nonce))
);

/**
 * The SCHE-06 order of the in-line tickets on one view.
 *
 * **Details**
 *
 * Protected tickets lead, oldest first by enqueue instant and nonce, so no
 * newer ticket overtakes them. The rest follow by the deployed effective
 * rank, then (fairness on) the least windowed origin usage and the least
 * checkout usage within it, then enqueue order. With fairness off and
 * protection at the aging instant this is the deployed ticket order.
 *
 * **Example** (Order an empty queue)
 *
 * ```ts
 * import { AdmissionBackfillPolicy, AdmissionBackfillView, admissionBackfillOrder } from "@beep/repo-cli/test/RepoRun"
 *
 * const policy = AdmissionBackfillPolicy.make({
 *   capacityTokens: 10,
 *   publishAgingMillis: 120_000,
 *   protectAfterMillis: 120_000,
 *   fairnessWindowMillis: 1_800_000,
 *   promotionOverheadMillis: 5_000,
 *   backfill: "easy",
 *   fairness: "origin-checkout"
 * })
 * const view = AdmissionBackfillView.make({ nowMillis: 0, tickets: [], leases: [], finished: [] })
 * console.log(admissionBackfillOrder(view, policy).length) // 0
 * ```
 *
 * @category ordering
 * @since 0.0.0
 */
export const admissionBackfillOrder: {
  (policy: AdmissionBackfillPolicy): (view: AdmissionBackfillView) => ReadonlyArray<YeetAdmissionTicket>;
  (view: AdmissionBackfillView, policy: AdmissionBackfillPolicy): ReadonlyArray<YeetAdmissionTicket>;
} = dual(2, (view: AdmissionBackfillView, policy: AdmissionBackfillPolicy): ReadonlyArray<YeetAdmissionTicket> => {
  const fairness = AdmissionFairnessMode.match(policy.fairness, {
    off: () => fifoOrder,
    "origin-checkout": () => {
      const usage = usageIndex(policy, view);
      return Order.combineAll([
        Order.mapInput(Order.Number, (ticket: YeetAdmissionTicket) =>
          O.getOrElse(HashMap.get(usage.byOrigin, ticket.originKey), () => 0)
        ),
        Order.mapInput(Order.Number, (ticket: YeetAdmissionTicket) =>
          O.getOrElse(HashMap.get(usage.byCheckout, checkoutUsageKey(ticket.originKey, ticket.checkoutRoot)), () => 0)
        ),
        fifoOrder,
      ]);
    },
  });
  const unprotectedOrder = pipe(
    Order.mapInput(Order.Number, (ticket: YeetAdmissionTicket) => effectiveRank(policy, view.nowMillis, ticket)),
    Order.combine(fairness)
  );
  const order = Order.make<YeetAdmissionTicket>((self, that) => {
    const selfProtected = isProtected(policy, view.nowMillis, self);
    const thatProtected = isProtected(policy, view.nowMillis, that);
    if (selfProtected && thatProtected) {
      return fifoOrder(self, that);
    }
    if (selfProtected !== thatProtected) {
      return selfProtected ? -1 : 1;
    }
    return unprotectedOrder(self, that);
  });
  return A.sort(view.tickets, order);
});

const activeTokens = (view: AdmissionBackfillView): number =>
  N.sumAll(A.map(view.leases, (lease) => lease.weightTokens));

// A lease's end is projected only from a declared ETA it has not overrun.
const projectedEnd = (nowMillis: number, lease: YeetAdmissionLease): O.Option<number> =>
  pipe(
    lease.etaMillis,
    O.map((eta) => lease.admittedAtMillis + eta),
    O.filter((end) => end > nowMillis)
  );

const projectedEnds = (
  view: AdmissionBackfillView
): O.Option<ReadonlyArray<{ readonly end: number; readonly weight: number }>> =>
  O.all(
    A.map(view.leases, (lease) =>
      O.map(projectedEnd(view.nowMillis, lease), (end) => ({ end, weight: lease.weightTokens }))
    )
  );

// The earliest instant the head fits if every lease ends at its ETA; None when one cannot be projected.
const projectedHeadStart = (
  view: AdmissionBackfillView,
  policy: AdmissionBackfillPolicy,
  head: YeetAdmissionTicket
): O.Option<number> =>
  O.flatMap(projectedEnds(view), (ends) => {
    const byEnd = A.sort(
      ends,
      Order.mapInput(Order.Number, (entry: { readonly end: number }) => entry.end)
    );
    const released = A.scan(
      byEnd,
      { end: view.nowMillis, freed: policy.capacityTokens - activeTokens(view) },
      (acc, entry) => ({ end: entry.end, freed: acc.freed + entry.weight })
    );
    return pipe(
      A.findFirst(released, (step) => step.freed >= N.min(head.weightTokens, policy.capacityTokens)),
      O.map((step) => step.end)
    );
  });

/**
 * The conditional starvation bound for one ticket entering protected ordering.
 *
 * **Details**
 *
 * `now` plus the remaining ETA of every lease, plus the ETA of every ticket
 * ahead, plus `promotionOverheadMillis` once per ticket ahead and once for the
 * ticket itself. `None` when any of those ETAs is undeclared or overrun, or
 * the ticket is not in line: the bound is not declared.
 *
 * **Example** (An idle machine bounds at the overhead)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import {
 *   AdmissionBackfillPolicy,
 *   AdmissionBackfillView,
 *   YeetAdmissionTicket,
 *   admissionConditionalDeadline
 * } from "@beep/repo-cli/test/RepoRun"
 *
 * const policy = AdmissionBackfillPolicy.make({
 *   capacityTokens: 10,
 *   publishAgingMillis: 120_000,
 *   protectAfterMillis: 120_000,
 *   fairnessWindowMillis: 1_800_000,
 *   promotionOverheadMillis: 5_000,
 *   backfill: "easy",
 *   fairness: "off"
 * })
 * const ticket = YeetAdmissionTicket.make({
 *   schemaVersion: "yeet-admission-ticket/v1",
 *   pid: 1,
 *   procStart: "1",
 *   kind: "full-proof",
 *   weightTokens: 3,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   enqueuedAtMillis: 0,
 *   heartbeatAtMillis: 0,
 *   nonce: "ticket-1"
 * })
 * const view = AdmissionBackfillView.make({ nowMillis: 120_000, tickets: [ticket], leases: [], finished: [] })
 * console.log(O.getOrNull(admissionConditionalDeadline(view, policy, "ticket-1"))) // 125000
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const admissionConditionalDeadline: {
  (policy: AdmissionBackfillPolicy, nonce: string): (view: AdmissionBackfillView) => O.Option<number>;
  (view: AdmissionBackfillView, policy: AdmissionBackfillPolicy, nonce: string): O.Option<number>;
} = dual(3, (view: AdmissionBackfillView, policy: AdmissionBackfillPolicy, nonce: string): O.Option<number> => {
  const ordered = admissionBackfillOrder(view, policy);
  return O.flatMap(
    A.findFirstIndex(ordered, (ticket) => ticket.nonce === nonce),
    (index) => {
      const ahead = A.take(ordered, index);
      const remaining = O.map(projectedEnds(view), (ends) =>
        N.sumAll(A.map(ends, (entry) => entry.end - view.nowMillis))
      );
      const aheadEtas = O.map(O.all(A.map(ahead, (ticket) => ticket.etaMillis)), N.sumAll);
      return O.zipWith(
        remaining,
        aheadEtas,
        (running, queued) => view.nowMillis + running + queued + (index + 1) * policy.promotionOverheadMillis
      );
    }
  );
});

const isBoundBreached = (view: AdmissionBackfillView): boolean =>
  A.some(view.tickets, (ticket) => O.exists(ticket.deadlineMillis, (deadline) => view.nowMillis > deadline));

const wait = (reason: AdmissionWaitReason): AdmissionAttemptVerdict =>
  AdmissionAttemptVerdict.cases.Wait.make({ reason });

/**
 * One contender's SCHE-06 verdict on one scan.
 *
 * **Details**
 *
 * The head attempts when it fits, as today. Another ticket waits while the
 * head fits, while backfill is off, and while a queued ticket is past its
 * deadline. Otherwise it may backfill when it fits and its declared ETA ends
 * no later than the head's projected start, and no earlier non-head ticket
 * may backfill first. Concurrent attempts still meet the overshoot rollback.
 *
 * **Example** (A lone ticket attempts as head)
 *
 * ```ts
 * import {
 *   AdmissionAttemptVerdict,
 *   AdmissionBackfillPolicy,
 *   AdmissionBackfillView,
 *   YeetAdmissionTicket,
 *   admissionAttemptVerdict
 * } from "@beep/repo-cli/test/RepoRun"
 *
 * const policy = AdmissionBackfillPolicy.make({
 *   capacityTokens: 10,
 *   publishAgingMillis: 120_000,
 *   protectAfterMillis: 120_000,
 *   fairnessWindowMillis: 1_800_000,
 *   promotionOverheadMillis: 5_000,
 *   backfill: "easy",
 *   fairness: "origin-checkout"
 * })
 * const ticket = YeetAdmissionTicket.make({
 *   schemaVersion: "yeet-admission-ticket/v1",
 *   pid: 1,
 *   procStart: "1",
 *   kind: "review-fix",
 *   weightTokens: 1,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   enqueuedAtMillis: 0,
 *   heartbeatAtMillis: 0,
 *   nonce: "ticket-1"
 * })
 * const view = AdmissionBackfillView.make({ nowMillis: 0, tickets: [ticket], leases: [], finished: [] })
 * console.log(AdmissionAttemptVerdict.guards.Attempt(admissionAttemptVerdict(view, policy, "ticket-1"))) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const admissionAttemptVerdict: {
  (policy: AdmissionBackfillPolicy, nonce: string): (view: AdmissionBackfillView) => AdmissionAttemptVerdict;
  (view: AdmissionBackfillView, policy: AdmissionBackfillPolicy, nonce: string): AdmissionAttemptVerdict;
} = dual(3, (view: AdmissionBackfillView, policy: AdmissionBackfillPolicy, nonce: string): AdmissionAttemptVerdict => {
  const ordered = admissionBackfillOrder(view, policy);
  const active = activeTokens(view);
  const fits = (ticket: YeetAdmissionTicket): boolean => active + ticket.weightTokens <= policy.capacityTokens;
  return pipe(
    A.head(ordered),
    O.flatMap((head) =>
      O.map(
        A.findFirstIndex(ordered, (ticket) => ticket.nonce === nonce),
        (index) => ({ head, index })
      )
    ),
    O.match({
      onNone: () => wait("not-queued"),
      onSome: ({ head, index }) => {
        if (index === 0) {
          return fits(head) ? AdmissionAttemptVerdict.cases.Attempt.make({ route: "head" }) : wait("capacity");
        }
        if (fits(head) || AdmissionBackfillMode.is.off(policy.backfill)) {
          return wait("behind-head");
        }
        if (isBoundBreached(view)) {
          return wait("backfill-disabled");
        }
        const headStart = projectedHeadStart(view, policy, head);
        const backfillReason = (ticket: YeetAdmissionTicket): O.Option<AdmissionWaitReason> =>
          O.match(
            O.zipWith(ticket.etaMillis, headStart, (eta, start) => view.nowMillis + eta <= start),
            {
              onNone: () => O.some<AdmissionWaitReason>("eta-unknown"),
              onSome: (endsInTime) =>
                !endsInTime
                  ? O.some<AdmissionWaitReason>("ends-after-head-start")
                  : fits(ticket)
                    ? O.none()
                    : O.some<AdmissionWaitReason>("capacity"),
            }
          );
        const earlier = A.take(A.drop(ordered, 1), index - 1);
        return O.match(backfillReason(A.getUnsafe(ordered, index)), {
          onSome: wait,
          onNone: () =>
            A.some(earlier, (ticket) => O.isNone(backfillReason(ticket)))
              ? wait("behind-backfill")
              : AdmissionAttemptVerdict.cases.Attempt.make({ route: "backfill" }),
        });
      },
    })
  );
});

interface JoinedLease {
  readonly admittedAtMillis: number;
  readonly checkoutRoot: string;
  readonly kind: RecordedAdmissionWorkKind;
  readonly originKey: string;
  readonly releasedAtMillis: number;
  readonly weightTokens: number;
}

interface LeaseRows {
  readonly admitted: O.Option<{
    readonly admittedAtMillis: number;
    readonly kind: RecordedAdmissionWorkKind;
    readonly originKey: string;
    readonly weightTokens: number;
  }>;
  readonly checkoutRoot: O.Option<string>;
  readonly releasedAtMillis: O.Option<number>;
}

const emptyRows: LeaseRows = { admitted: O.none(), checkoutRoot: O.none(), releasedAtMillis: O.none() };

const checkoutOf = (event: object): O.Option<string> =>
  "checkoutRoot" in event && typeof event.checkoutRoot === "string" && Str.isNonEmpty(event.checkoutRoot)
    ? O.some(event.checkoutRoot)
    : O.none();

const foldRow = (rows: LeaseRows, event: AdmissionJournalEvent): LeaseRows => {
  switch (event._tag) {
    case "admission-admitted":
      return { ...rows, admitted: O.some(event) };
    case "admission-released":
      return {
        ...rows,
        releasedAtMillis: O.some(event.releasedAtMillis),
        checkoutRoot: O.orElse(rows.checkoutRoot, () => checkoutOf(event)),
      };
    case "admission-enqueued":
      return { ...rows, checkoutRoot: O.orElse(checkoutOf(event), () => rows.checkoutRoot) };
    default:
      return rows;
  }
};

// Every admitted-and-released nonce in the journal, oldest release first.
const joinReleasedLeases = (events: ReadonlyArray<AdmissionJournalEvent>): ReadonlyArray<JoinedLease> => {
  const byNonce = A.reduce(events, HashMap.empty<string, LeaseRows>(), (index, event) =>
    HashMap.set(
      index,
      event.nonce,
      foldRow(
        O.getOrElse(HashMap.get(index, event.nonce), () => emptyRows),
        event
      )
    )
  );
  return pipe(
    HashMap.values(byNonce),
    A.fromIterable,
    A.map((rows) =>
      O.zipWith(
        rows.admitted,
        rows.releasedAtMillis,
        (admitted, releasedAtMillis): JoinedLease => ({
          admittedAtMillis: admitted.admittedAtMillis,
          kind: admitted.kind,
          originKey: admitted.originKey,
          weightTokens: admitted.weightTokens,
          checkoutRoot: O.getOrElse(rows.checkoutRoot, () => ""),
          releasedAtMillis,
        })
      )
    ),
    A.getSomes,
    A.sort(Order.mapInput(Order.Number, (lease: JoinedLease) => lease.releasedAtMillis))
  );
};

/**
 * The released lease intervals still inside the fairness window.
 *
 * **Example** (An empty journal counts nothing)
 *
 * ```ts
 * import { admissionUsageIntervals } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(admissionUsageIntervals([], 0, 1_800_000).length) // 0
 * ```
 *
 * @param events - Decoded admission-journal transitions.
 * @param nowMillis - The scan instant.
 * @param windowMillis - The fairness window.
 * @returns Every released interval ending after the window opened.
 * @category projections
 * @since 0.0.0
 */
export const admissionUsageIntervals: {
  (
    nowMillis: number,
    windowMillis: number
  ): (events: ReadonlyArray<AdmissionJournalEvent>) => ReadonlyArray<AdmissionUsageInterval>;
  (
    events: ReadonlyArray<AdmissionJournalEvent>,
    nowMillis: number,
    windowMillis: number
  ): ReadonlyArray<AdmissionUsageInterval>;
} = dual(
  3,
  (
    events: ReadonlyArray<AdmissionJournalEvent>,
    nowMillis: number,
    windowMillis: number
  ): ReadonlyArray<AdmissionUsageInterval> =>
    A.map(
      A.filter(joinReleasedLeases(events), (lease) => lease.releasedAtMillis > nowMillis - windowMillis),
      (lease) =>
        AdmissionUsageInterval.make({
          originKey: lease.originKey,
          checkoutRoot: lease.checkoutRoot,
          weightTokens: lease.weightTokens,
          admittedAtMillis: lease.admittedAtMillis,
          releasedAtMillis: lease.releasedAtMillis,
        })
    )
);

/**
 * The ETA a new ticket of one kind declares: a quantile of that kind's recorded holds.
 *
 * **Example** (Too little history declares none)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AdmissionEtaEstimator, admissionEtaFor } from "@beep/repo-cli/test/RepoRun"
 *
 * const estimator = AdmissionEtaEstimator.make({ quantilePermille: 900, minSamples: 5, historyLimit: 200 })
 * console.log(O.isNone(admissionEtaFor([], "full-proof", estimator))) // true
 * ```
 *
 * @param events - Decoded admission-journal transitions.
 * @param kind - The new ticket's recorded work kind.
 * @param estimator - The quantile, sample floor and history depth.
 * @returns The nearest-rank hold quantile in whole milliseconds, or `None`.
 * @category projections
 * @since 0.0.0
 */
export const admissionEtaFor: {
  (
    kind: RecordedAdmissionWorkKind,
    estimator: AdmissionEtaEstimator
  ): (events: ReadonlyArray<AdmissionJournalEvent>) => O.Option<number>;
  (
    events: ReadonlyArray<AdmissionJournalEvent>,
    kind: RecordedAdmissionWorkKind,
    estimator: AdmissionEtaEstimator
  ): O.Option<number>;
} = dual(
  3,
  (
    events: ReadonlyArray<AdmissionJournalEvent>,
    kind: RecordedAdmissionWorkKind,
    estimator: AdmissionEtaEstimator
  ): O.Option<number> => {
    const holds = pipe(
      A.filter(joinReleasedLeases(events), (lease) => lease.kind === kind),
      A.takeRight(estimator.historyLimit),
      A.map((lease) => N.max(Math.round(lease.releasedAtMillis - lease.admittedAtMillis), 1)),
      A.sort(Order.Number)
    );
    const count = A.length(holds);
    return count < estimator.minSamples
      ? O.none()
      : A.get(
          holds,
          N.clamp(Math.ceil((estimator.quantilePermille * count) / 1000) - 1, { minimum: 0, maximum: count - 1 })
        );
  }
);
