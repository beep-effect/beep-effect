/**
 * Pure SCHE-06 admission policy: protected ordering, two-level fairness,
 * EASY backfill against the head's projected start, and the conditional
 * starvation bound stamped at protection.
 *
 * **Details**
 *
 * Every function here reads one {@link SchedulerView} and nothing else, so the
 * live scheduler's `selfMayAttempt` can call {@link attemptVerdict} on the
 * state of one scan (PLAN slice 12).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// fallow-ignore-file code-duplication -- the SCHE-06 lab model and its live port in @beep/repo-cli (QualityScheduler.ts) are deliberately mirrored: the property laws and the tail-wait A/B read this copy, and a lab app cannot be a dependency of the CLI. Owner: @beep/ciops. Exit: delete the mirrored functions here and import the live verdict once a shared scheduler-policy module exists that both packages depend on.

import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { AdmissionPriority } from "../projection/Schemas.ts";
import { AttemptVerdict, BackfillMode, FairnessMode, FairnessReading } from "./Schemas.ts";
import type { BackfillPolicy, QueuedUnit, RunningLease, SchedulerView, WaitReason } from "./Schemas.ts";

/**
 * Whether a waiting unit has entered protected ordering.
 *
 * **Example** (Protection after the window)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { isProtectedAt } from "@/backfill/Policy"
 * import { BackfillPolicy, QueuedUnit } from "@/backfill/Schemas"
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
 * const unit = QueuedUnit.make({
 *   nonce: "unit-1",
 *   originKey: "a",
 *   checkoutKey: "a",
 *   priority: "verify",
 *   weightTokens: PosInt.make(1),
 *   enqueuedAtMillis: S.Natural.make(0),
 *   etaMillis: O.none(),
 *   deadlineMillis: O.none()
 * })
 * console.log(isProtectedAt(unit, policy, 120_000)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isProtectedAt: {
  (policy: BackfillPolicy, nowMillis: number): (unit: QueuedUnit) => boolean;
  (unit: QueuedUnit, policy: BackfillPolicy, nowMillis: number): boolean;
} = dual(
  3,
  (unit: QueuedUnit, policy: BackfillPolicy, nowMillis: number): boolean =>
    nowMillis - unit.enqueuedAtMillis >= policy.protectAfterMillis
);

const effectiveRank = (policy: BackfillPolicy, nowMillis: number, unit: QueuedUnit): number =>
  AdmissionPriority.match(unit.priority, {
    publish: () => 0,
    verify: () => (nowMillis - unit.enqueuedAtMillis >= policy.publishAgingMillis ? 0 : 1),
  });

type FairnessKeys = Pick<QueuedUnit, "checkoutKey" | "originKey">;

const lengthPrefixedCheckoutKey = (originKey: string, checkoutKey: string): string =>
  `${originKey.length}:${originKey}${checkoutKey}`;

interface WindowSpan {
  readonly checkoutKey: string;
  readonly endMillis: number;
  readonly originKey: string;
  readonly startMillis: number;
  readonly weightTokens: number;
}

const windowSpans = (view: SchedulerView): ReadonlyArray<WindowSpan> =>
  A.appendAll(
    A.map(view.running, (lease) => ({
      originKey: lease.originKey,
      checkoutKey: lease.checkoutKey,
      weightTokens: lease.weightTokens,
      startMillis: lease.admittedAtMillis,
      endMillis: view.nowMillis,
    })),
    A.map(view.finished, (lease) => ({
      originKey: lease.originKey,
      checkoutKey: lease.checkoutKey,
      weightTokens: lease.weightTokens,
      startMillis: lease.admittedAtMillis,
      endMillis: lease.releasedAtMillis,
    }))
  );

const spanTokenMillis = (policy: BackfillPolicy, nowMillis: number, span: WindowSpan): number => {
  const windowStart = nowMillis - policy.fairnessWindowMillis;
  const overlap = N.min(span.endMillis, nowMillis) - N.max(span.startMillis, windowStart);
  return span.weightTokens * N.max(overlap, 0);
};

interface UsageIndex {
  readonly byCheckout: HashMap.HashMap<string, number>;
  readonly byOrigin: HashMap.HashMap<string, number>;
  readonly total: number;
}

const addUsage = (index: HashMap.HashMap<string, number>, key: string, tokenMillis: number) =>
  HashMap.set(index, key, O.getOrElse(HashMap.get(index, key), () => 0) + tokenMillis);

const usageIndex = (policy: BackfillPolicy, view: SchedulerView): UsageIndex =>
  A.reduce(
    windowSpans(view),
    { byOrigin: HashMap.empty<string, number>(), byCheckout: HashMap.empty<string, number>(), total: 0 },
    (index, span) => {
      const tokenMillis = spanTokenMillis(policy, view.nowMillis, span);
      return {
        byOrigin: addUsage(index.byOrigin, span.originKey, tokenMillis),
        byCheckout: addUsage(
          index.byCheckout,
          lengthPrefixedCheckoutKey(span.originKey, span.checkoutKey),
          tokenMillis
        ),
        total: index.total + tokenMillis,
      };
    }
  );

const originUsage = (index: UsageIndex, unit: { readonly originKey: string }): number =>
  O.getOrElse(HashMap.get(index.byOrigin, unit.originKey), () => 0);

const checkoutUsage = (index: UsageIndex, unit: { readonly originKey: string; readonly checkoutKey: string }) =>
  O.getOrElse(HashMap.get(index.byCheckout, lengthPrefixedCheckoutKey(unit.originKey, unit.checkoutKey)), () => 0);

const fifoOrder: Order.Order<QueuedUnit> = pipe(
  Order.mapInput(Order.Number, (unit: QueuedUnit) => unit.enqueuedAtMillis),
  Order.combine(Order.mapInput(Order.String, (unit: QueuedUnit) => unit.nonce))
);

/**
 * The SCHE-06 queue order on one view.
 *
 * **Details**
 *
 * Protected units come first, oldest first by their immutable enqueue instant
 * and nonce, so no newer unit can overtake them. Unprotected units follow by
 * the deployed effective rank, then (with fairness on) the least recent
 * origin usage and the least recent checkout usage, then enqueue order.
 * With both modes `off` and `protectAfterMillis` equal to `publishAgingMillis`
 * this is the deployed `ticketOrder`: every aged unit is older than every
 * unaged one.
 *
 * **Example** (Order an empty queue)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { queueOrder } from "@/backfill/Policy"
 * import { BackfillPolicy, SchedulerView } from "@/backfill/Schemas"
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
 * const view = SchedulerView.make({ nowMillis: S.Natural.make(0), waiting: [], running: [], finished: [] })
 * console.log(queueOrder(view, policy).length) // 0
 * ```
 *
 * @category ordering
 * @since 0.0.0
 */
export const queueOrder: {
  (policy: BackfillPolicy): (view: SchedulerView) => ReadonlyArray<QueuedUnit>;
  (view: SchedulerView, policy: BackfillPolicy): ReadonlyArray<QueuedUnit>;
} = dual(2, (view: SchedulerView, policy: BackfillPolicy): ReadonlyArray<QueuedUnit> => {
  const usage = usageIndex(policy, view);
  const protectedNow = isProtectedAt(policy, view.nowMillis);
  const fairness = FairnessMode.match(policy.fairness, {
    off: () => fifoOrder,
    "origin-checkout": () =>
      Order.combineAll([
        Order.mapInput(Order.Number, (unit: QueuedUnit) => originUsage(usage, unit)),
        Order.mapInput(Order.Number, (unit: QueuedUnit) => checkoutUsage(usage, unit)),
        fifoOrder,
      ]),
  });
  const unprotectedOrder = pipe(
    Order.mapInput(Order.Number, (unit: QueuedUnit) => effectiveRank(policy, view.nowMillis, unit)),
    Order.combine(fairness)
  );
  const order = Order.make<QueuedUnit>((self, that) => {
    const selfProtected = protectedNow(self);
    const thatProtected = protectedNow(that);
    if (selfProtected && thatProtected) {
      return fifoOrder(self, that);
    }
    if (selfProtected !== thatProtected) {
      return selfProtected ? -1 : 1;
    }
    return unprotectedOrder(self, that);
  });
  return A.sort(view.waiting, order);
});

const activeTokens = (view: SchedulerView): number => N.sumAll(A.map(view.running, (lease) => lease.weightTokens));

const projectedEnd = (nowMillis: number, lease: RunningLease): O.Option<number> =>
  pipe(
    lease.etaMillis,
    O.map((eta) => lease.admittedAtMillis + eta),
    O.filter((end) => end > nowMillis)
  );

const projectedEnds = (view: SchedulerView): O.Option<ReadonlyArray<{ end: number; weight: number }>> =>
  O.all(
    A.map(view.running, (lease) =>
      O.map(projectedEnd(view.nowMillis, lease), (end) => ({ end, weight: lease.weightTokens }))
    )
  );

const projectedHeadStart: {
  (policy: BackfillPolicy, head: QueuedUnit): (view: SchedulerView) => O.Option<number>;
  (view: SchedulerView, policy: BackfillPolicy, head: QueuedUnit): O.Option<number>;
} = dual(3, (view: SchedulerView, policy: BackfillPolicy, head: QueuedUnit): O.Option<number> => {
  const free = policy.capacityTokens - activeTokens(view);
  return O.flatMap(projectedEnds(view), (ends) => {
    const byEnd = A.sort(
      ends,
      Order.mapInput(Order.Number, (entry: { end: number }) => entry.end)
    );
    const released = A.scan(byEnd, { end: view.nowMillis, freed: free }, (acc, entry) => ({
      end: entry.end,
      freed: acc.freed + entry.weight,
    }));
    return pipe(
      A.findFirst(released, (step) => step.freed >= head.weightTokens),
      O.map((step) => step.end)
    );
  });
});

/**
 * The conditional starvation bound for a unit entering protected ordering.
 *
 * **Details**
 *
 * Read on the view at the protection instant `p`: `p` plus the remaining ETA
 * of every running lease, plus the ETA of every unit ahead (all older, all
 * protected), plus `promotionOverheadMillis` once per unit ahead and once for
 * the unit itself. `None` when any of those ETAs is undeclared or overrun:
 * the bound is conditional on finite ETAs and is not declared otherwise.
 *
 * **Example** (An empty machine bounds at the protection instant)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { conditionalDeadline } from "@/backfill/Policy"
 * import { BackfillPolicy, QueuedUnit, SchedulerView } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 * const policy = BackfillPolicy.make({
 *   capacityTokens: PosInt.make(10),
 *   publishAgingMillis: PosInt.make(120_000),
 *   protectAfterMillis: PosInt.make(120_000),
 *   fairnessWindowMillis: PosInt.make(1_800_000),
 *   promotionOverheadMillis: S.Natural.make(5_000),
 *   backfill: "easy",
 *   fairness: "off"
 * })
 * const unit = QueuedUnit.make({
 *   nonce: "unit-1",
 *   originKey: "a",
 *   checkoutKey: "a",
 *   priority: "verify",
 *   weightTokens: PosInt.make(4),
 *   enqueuedAtMillis: S.Natural.make(0),
 *   etaMillis: O.none(),
 *   deadlineMillis: O.none()
 * })
 * const view = SchedulerView.make({ nowMillis: S.Natural.make(120_000), waiting: [unit], running: [], finished: [] })
 * console.log(O.getOrNull(conditionalDeadline(view, policy, unit))) // 125000
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const conditionalDeadline: {
  (policy: BackfillPolicy, unit: QueuedUnit): (view: SchedulerView) => O.Option<number>;
  (view: SchedulerView, policy: BackfillPolicy, unit: QueuedUnit): O.Option<number>;
} = dual(3, (view: SchedulerView, policy: BackfillPolicy, unit: QueuedUnit): O.Option<number> => {
  const ordered = queueOrder(view, policy);
  const ahead = A.takeWhile(ordered, (queued) => queued.nonce !== unit.nonce);
  const remaining = O.map(projectedEnds(view), (ends) => N.sumAll(A.map(ends, (entry) => entry.end - view.nowMillis)));
  const aheadEtas = O.map(O.all(A.map(ahead, (queued) => queued.etaMillis)), N.sumAll);
  return O.zipWith(
    remaining,
    aheadEtas,
    (running, queued) => view.nowMillis + running + queued + (A.length(ahead) + 1) * policy.promotionOverheadMillis
  );
});

const isBoundBreached = (view: SchedulerView): boolean =>
  A.some(view.waiting, (unit) => O.exists(unit.deadlineMillis, (deadline) => view.nowMillis > deadline));

/**
 * The windowed usage the fairness order compared, for one unit.
 *
 * **Example** (An idle window reads zero)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { fairnessReadingFor } from "@/backfill/Policy"
 * import { BackfillPolicy, SchedulerView } from "@/backfill/Schemas"
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
 * const view = SchedulerView.make({ nowMillis: S.Natural.make(0), waiting: [], running: [], finished: [] })
 * console.log(fairnessReadingFor(view, policy, { originKey: "a", checkoutKey: "a" }).windowTokenMillis) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const fairnessReadingFor: {
  (policy: BackfillPolicy, unit: FairnessKeys): (view: SchedulerView) => FairnessReading;
  (view: SchedulerView, policy: BackfillPolicy, unit: FairnessKeys): FairnessReading;
} = dual(3, (view: SchedulerView, policy: BackfillPolicy, unit: FairnessKeys): FairnessReading => {
  const usage = usageIndex(policy, view);
  return FairnessReading.make({
    originTokenMillis: S.Natural.make(originUsage(usage, unit)),
    checkoutTokenMillis: S.Natural.make(checkoutUsage(usage, unit)),
    windowTokenMillis: S.Natural.make(usage.total),
  });
});

const wait = (reason: WaitReason): AttemptVerdict => AttemptVerdict.cases.Wait.make({ reason });

/**
 * A verdict function: what one contender may do on one scan.
 *
 * @category models
 * @since 0.0.0
 */
export type VerdictFunction = (view: SchedulerView, policy: BackfillPolicy, nonce: string) => AttemptVerdict;

/**
 * The SCHE-06 replacement for `selfMayAttempt`: one contender's verdict on one scan.
 *
 * **Details**
 *
 * The head attempts when it fits, as today. Any other unit waits while the
 * head fits, while backfill is off, and while a waiting unit is past its
 * deadline. Otherwise it may backfill when its own weight fits and its
 * declared ETA ends no later than the head's projected start, and no earlier
 * non-head unit may backfill first (so backfill follows the fairness order,
 * never shortest-job-first).
 *
 * **Example** (A lone unit attempts as head)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { attemptVerdict } from "@/backfill/Policy"
 * import { AttemptVerdict, BackfillPolicy, QueuedUnit, SchedulerView } from "@/backfill/Schemas"
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
 * const unit = QueuedUnit.make({
 *   nonce: "unit-1",
 *   originKey: "a",
 *   checkoutKey: "a",
 *   priority: "verify",
 *   weightTokens: PosInt.make(3),
 *   enqueuedAtMillis: S.Natural.make(0),
 *   etaMillis: O.none(),
 *   deadlineMillis: O.none()
 * })
 * const view = SchedulerView.make({ nowMillis: S.Natural.make(0), waiting: [unit], running: [], finished: [] })
 * console.log(AttemptVerdict.guards.Attempt(attemptVerdict(view, policy, "unit-1"))) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const attemptVerdict: {
  (policy: BackfillPolicy, nonce: string): (view: SchedulerView) => AttemptVerdict;
  (view: SchedulerView, policy: BackfillPolicy, nonce: string): AttemptVerdict;
} = dual(3, (view: SchedulerView, policy: BackfillPolicy, nonce: string): AttemptVerdict => {
  const ordered = queueOrder(view, policy);
  const active = activeTokens(view);
  const fits = (unit: QueuedUnit): boolean => active + unit.weightTokens <= policy.capacityTokens;
  return pipe(
    A.head(ordered),
    O.flatMap((head) =>
      O.map(
        A.findFirstIndex(ordered, (unit) => unit.nonce === nonce),
        (index) => ({ head, index })
      )
    ),
    O.match({
      onNone: () => wait("not-queued"),
      onSome: ({ head, index }) => {
        if (index === 0) {
          return fits(head) ? AttemptVerdict.cases.Attempt.make({ route: "head" }) : wait("capacity");
        }
        if (fits(head) || BackfillMode.is.off(policy.backfill)) {
          return wait("behind-head");
        }
        if (isBoundBreached(view)) {
          return wait("backfill-disabled");
        }
        const headStart = projectedHeadStart(view, policy, head);
        const backfillReason = (unit: QueuedUnit): O.Option<WaitReason> =>
          O.match(
            O.zipWith(unit.etaMillis, headStart, (eta, start) => view.nowMillis + eta <= start),
            {
              onNone: () => O.some<WaitReason>("eta-unknown"),
              onSome: (endsInTime) =>
                !endsInTime
                  ? O.some<WaitReason>("ends-after-head-start")
                  : fits(unit)
                    ? O.none()
                    : O.some<WaitReason>("capacity"),
            }
          );
        const self = A.getUnsafe(ordered, index);
        const earlier = A.take(A.drop(ordered, 1), index - 1);
        return O.match(backfillReason(self), {
          onSome: wait,
          onNone: () =>
            A.some(earlier, (unit) => O.isNone(backfillReason(unit)))
              ? wait("behind-backfill")
              : AttemptVerdict.cases.Attempt.make({ route: "backfill" }),
        });
      },
    })
  );
});
