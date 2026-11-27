import { it } from "@beep/test-runner";
import { fcRuns, fcRunsCapped } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import { assertInstanceOf, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { BackfillModel, BackfillModelLive } from "@/backfill/BackfillModel";
import { attemptVerdict, conditionalDeadline, fairnessReadingFor, isProtectedAt, queueOrder } from "@/backfill/Policy";
import {
  AttemptVerdict,
  BackfillPolicy,
  QueuedUnit,
  RunningLease,
  SchedulerView,
  SimulationEvent,
  SimulationInputError,
  SimulationReport,
  UnitArrival,
} from "@/backfill/Schemas";
import { simulateStream } from "@/backfill/Simulation";
import { PosInt } from "@/projection/PosInt";
import type { VerdictFunction } from "@/backfill/Policy";

const policy = BackfillPolicy.make({
  capacityTokens: PosInt.make(10),
  publishAgingMillis: PosInt.make(120_000),
  protectAfterMillis: PosInt.make(120_000),
  fairnessWindowMillis: PosInt.make(1_800_000),
  promotionOverheadMillis: S.Natural.make(0),
  backfill: "easy",
  fairness: "origin-checkout",
});

const deployedPolicy = BackfillPolicy.make({ ...policy, backfill: "off", fairness: "off" });

const bounded = (minimum: number, maximum: number) => S.Int.check(S.isBetween({ minimum, maximum }));

const ArrivalSeed = S.Struct({
  origin: bounded(0, 2),
  checkout: bounded(0, 1),
  publish: S.Boolean,
  weight: bounded(1, 14),
  gapMillis: bounded(0, 90_000),
  etaMillis: bounded(1_000, 600_000),
  etaKnown: S.Boolean,
  holdPermille: bounded(1, 1_000),
});
type ArrivalSeed = typeof ArrivalSeed.Type;

const StreamSeed = S.Array(ArrivalSeed).check(S.isMaxLength(24));

type HoldRule = (etaMillis: number, permille: number, etaKnown: boolean) => number;

const honestHold: HoldRule = (etaMillis, permille) => N.max(1, Math.floor((etaMillis * permille) / 1_000));
const overrunHold: HoldRule = (etaMillis, permille, etaKnown) =>
  etaKnown ? etaMillis + 1 + Math.floor((etaMillis * permille) / 250) : honestHold(etaMillis, permille, etaKnown);

const arrivalsFrom = (
  seeds: ReadonlyArray<ArrivalSeed>,
  hold: HoldRule,
  etaKnown: (seed: ArrivalSeed) => boolean = (seed) => seed.etaKnown
): ReadonlyArray<UnitArrival> =>
  A.reduce(seeds, { atMillis: 0, arrivals: A.empty<UnitArrival>() }, (acc, seed) => {
    const enqueuedAtMillis = acc.atMillis + seed.gapMillis;
    const known = etaKnown(seed);
    const arrival = UnitArrival.make({
      nonce: `unit-${A.length(acc.arrivals)}`,
      originKey: `origin-${seed.origin}`,
      checkoutKey: `checkout-${seed.checkout}`,
      priority: seed.publish ? "publish" : "verify",
      requestedWeightTokens: PosInt.make(seed.weight),
      enqueuedAtMillis: S.Natural.make(enqueuedAtMillis),
      etaMillis: known ? PosInt.makeOption(seed.etaMillis) : O.none(),
      holdMillis: PosInt.make(hold(seed.etaMillis, seed.holdPermille, known)),
    });
    return { atMillis: enqueuedAtMillis, arrivals: A.append(acc.arrivals, arrival) };
  }).arrivals;

const arrival = (
  nonce: string,
  originKey: string,
  weight: number,
  enqueuedAtMillis: number,
  holdMillis: number
): UnitArrival =>
  UnitArrival.make({
    nonce,
    originKey,
    checkoutKey: `${originKey}-checkout`,
    priority: "verify",
    requestedWeightTokens: PosInt.make(weight),
    enqueuedAtMillis: S.Natural.make(enqueuedAtMillis),
    etaMillis: PosInt.makeOption(holdMillis),
    holdMillis: PosInt.make(holdMillis),
  });

const admittedEvents = (report: SimulationReport) => A.filter(report.events, SimulationEvent.guards.Admitted);
const breachEvents = (report: SimulationReport) => A.filter(report.events, SimulationEvent.guards.BoundBreached);

const backfillsWhileBreached = (report: SimulationReport): number =>
  A.reduce(report.events, { deadlines: HashMap.empty<string, number>(), violations: 0 }, (acc, event) =>
    SimulationEvent.match(event, {
      Enqueued: () => acc,
      Released: () => acc,
      BoundBreached: () => acc,
      Protected: (protectedEvent) =>
        O.match(protectedEvent.deadlineMillis, {
          onNone: () => acc,
          onSome: (deadline) => ({ ...acc, deadlines: HashMap.set(acc.deadlines, protectedEvent.nonce, deadline) }),
        }),
      Admitted: (admitted) => ({
        deadlines: HashMap.remove(acc.deadlines, admitted.nonce),
        violations:
          acc.violations +
          (admitted.route === "backfill" && HashMap.some(acc.deadlines, (deadline) => admitted.atMillis > deadline)
            ? 1
            : 0),
      }),
    })
  ).violations;

const outcomeOrder = (report: SimulationReport) =>
  A.map(report.outcomes, (outcome) => `${outcome.nonce}@${outcome.admittedAtMillis}`);

const reportEquivalence = S.toEquivalence(SimulationReport);

const deployedHeadOnlyOrder = (nowMillis: number): Order.Order<QueuedUnit> =>
  Order.combineAll([
    Order.mapInput(Order.Number, (unit: QueuedUnit) =>
      unit.priority === "publish" || nowMillis - unit.enqueuedAtMillis >= policy.publishAgingMillis ? 0 : 1
    ),
    Order.mapInput(Order.Number, (unit: QueuedUnit) => unit.enqueuedAtMillis),
    Order.mapInput(Order.String, (unit: QueuedUnit) => unit.nonce),
  ]);

const deployedMayAttempt = (view: SchedulerView, nonce: string): boolean => {
  const active = N.sumAll(A.map(view.running, (lease) => lease.weightTokens));
  return pipe(
    A.head(A.sort(view.waiting, deployedHeadOnlyOrder(view.nowMillis))),
    O.exists((head) => head.nonce === nonce && active + head.weightTokens <= policy.capacityTokens)
  );
};

const ViewSeed = S.Struct({
  nowMillis: bounded(0, 2_000_000),
  waiting: S.Array(
    S.Struct({
      origin: bounded(0, 3),
      checkout: bounded(0, 1),
      publish: S.Boolean,
      weight: bounded(1, 10),
      ageMillis: bounded(0, 400_000),
      etaMillis: S.Option(bounded(1, 600_000)),
    })
  ).check(S.isMaxLength(10)),
  running: S.Array(
    S.Struct({
      origin: bounded(0, 3),
      checkout: bounded(0, 1),
      weight: bounded(1, 4),
      ageMillis: bounded(0, 2_000_000),
      etaMillis: S.Option(bounded(1, 600_000)),
    })
  ).check(S.isMaxLength(4)),
});
type ViewSeed = typeof ViewSeed.Type;

const viewFrom = (seed: ViewSeed): SchedulerView =>
  SchedulerView.make({
    nowMillis: S.Natural.make(seed.nowMillis),
    waiting: A.map(seed.waiting, (unit, index) =>
      QueuedUnit.make({
        nonce: `waiting-${index}`,
        originKey: `origin-${unit.origin}`,
        checkoutKey: `checkout-${unit.checkout}`,
        priority: unit.publish ? "publish" : "verify",
        weightTokens: PosInt.make(unit.weight),
        enqueuedAtMillis: S.Natural.make(N.max(seed.nowMillis - unit.ageMillis, 0)),
        etaMillis: O.map(unit.etaMillis, PosInt.make),
        deadlineMillis: O.none(),
      })
    ),
    running: A.map(seed.running, (lease, index) =>
      RunningLease.make({
        nonce: `running-${index}`,
        originKey: `origin-${lease.origin}`,
        checkoutKey: `checkout-${lease.checkout}`,
        weightTokens: PosInt.make(lease.weight),
        admittedAtMillis: S.Natural.make(N.max(seed.nowMillis - lease.ageMillis, 0)),
        etaMillis: O.map(lease.etaMillis, PosInt.make),
      })
    ),
    finished: [],
  });

const usageOf = (view: SchedulerView, originKey: string): number =>
  N.sumAll(
    A.map(
      A.filter(view.running, (lease) => lease.originKey === originKey),
      (lease) =>
        lease.weightTokens *
        N.max(view.nowMillis - N.max(lease.admittedAtMillis, view.nowMillis - policy.fairnessWindowMillis), 0)
    )
  );

const rankOf = (view: SchedulerView, unit: QueuedUnit): number =>
  unit.priority === "publish" || view.nowMillis - unit.enqueuedAtMillis >= policy.publishAgingMillis ? 0 : 1;

const greedyBackfill: VerdictFunction = (view, mutantPolicy, nonce) => {
  const verdict = attemptVerdict(view, mutantPolicy, nonce);
  const active = N.sumAll(A.map(view.running, (lease) => lease.weightTokens));
  return AttemptVerdict.match(verdict, {
    Attempt: () => verdict,
    Wait: () =>
      A.some(view.waiting, (unit) => unit.nonce === nonce && active + unit.weightTokens <= mutantPolicy.capacityTokens)
        ? AttemptVerdict.cases.Attempt.make({ route: "backfill" })
        : verdict,
  });
};

const unprotectedOrdering: VerdictFunction = (view, mutantPolicy, nonce) =>
  attemptVerdict(
    view,
    BackfillPolicy.make({
      ...mutantPolicy,
      protectAfterMillis: PosInt.make(1_000_000_000),
      publishAgingMillis: PosInt.make(1_000_000_000),
    }),
    nonce
  );

const tinyTrain = (trainLength: number, intervalMillis: number, tinyHoldMillis: number, blockerHoldMillis: number) =>
  A.appendAll(
    [arrival("blocker", "origin-blocker", 6, 0, blockerHoldMillis), arrival("big", "origin-big", 10, 1, 60_000)],
    A.makeBy(trainLength, (index) =>
      arrival(`tiny-${index}`, `origin-tiny-${index % 3}`, 1, 2 + index * intervalMillis, tinyHoldMillis)
    )
  );

const freshOriginTrain = A.appendAll(
  [arrival("warm", "origin-a", 10, 0, 1_000), arrival("old", "origin-a", 10, 500, 60_000)],
  A.makeBy(12, (index) => arrival(`fresh-${index}`, `origin-fresh-${index}`, 10, 600 + index * 50_000, 60_000))
);

it.layer(BackfillModelLive, { timeout: "60 seconds" })("@beep/ciops SCHE-06 backfill and fairness", (it) => {
  it.effect.prop(
    "law 1: capacity is never exceeded and oversized units are clamped, under any stream",
    [Arbitrary.schema(StreamSeed)],
    ([seeds]) =>
      Effect.gen(function* () {
        const model = yield* BackfillModel;
        const report = yield* model.simulate(policy, arrivalsFrom(seeds, overrunHold));

        expect(report.peakActiveTokens).toBeLessThanOrEqual(policy.capacityTokens);
        for (const event of report.events) {
          SimulationEvent.match(event, {
            Enqueued: (enqueued) => {
              expect(enqueued.weightTokens).toBeLessThanOrEqual(policy.capacityTokens);
            },
            Admitted: (admitted) => {
              expect(admitted.activeTokensAfter).toBeLessThanOrEqual(policy.capacityTokens);
            },
            Protected: () => undefined,
            Released: () => undefined,
            BoundBreached: () => undefined,
          });
        }

        const requested = HashMap.fromIterable(
          A.map(arrivalsFrom(seeds, overrunHold), (unit) => [unit.nonce, unit.requestedWeightTokens] as const)
        );
        for (const enqueued of A.filter(report.events, SimulationEvent.guards.Enqueued)) {
          expect(enqueued.clamped, "enqueue rows sort by instant and nonce, so requested weights join by nonce").toBe(
            O.exists(HashMap.get(requested, enqueued.nonce), (weight) => weight > policy.capacityTokens)
          );
        }
        return true;
      }),
    { arbitrary: fcRuns(64) }
  );

  it.effect.prop(
    "law 2: every arrival is admitted exactly once, and the journal is deterministic",
    [Arbitrary.schema(StreamSeed)],
    ([seeds]) =>
      Effect.gen(function* () {
        const model = yield* BackfillModel;
        const arrivals = arrivalsFrom(seeds, overrunHold);
        const first = yield* model.simulate(policy, arrivals);
        const second = yield* model.simulate(policy, A.reverse(arrivals));

        expect(
          A.sort(
            A.map(first.outcomes, (outcome) => outcome.nonce),
            Order.String
          )
        ).toEqual(
          A.sort(
            A.map(arrivals, (unit) => unit.nonce),
            Order.String
          )
        );
        expect(reportEquivalence(first, second)).toBe(true);
        return true;
      }),
    { arbitrary: fcRuns(64) }
  );

  it.effect.prop(
    "law 3: with honest ETAs every protected unit is admitted within its conditional bound",
    [Arbitrary.schema(StreamSeed)],
    ([seeds]) =>
      Effect.gen(function* () {
        const model = yield* BackfillModel;
        const report = yield* model.simulate(policy, arrivalsFrom(seeds, honestHold));

        expect(breachEvents(report)).toEqual([]);
        for (const outcome of report.outcomes) {
          expect(O.getOrElse(outcome.deadlineMillis, () => outcome.admittedAtMillis)).toBeGreaterThanOrEqual(
            outcome.admittedAtMillis
          );
        }
        return true;
      }),
    { arbitrary: fcRuns(96) }
  );

  it.effect.prop(
    "law 3 under continuous tiny arrivals: a full-capacity unit is never starved past its bound",
    [bounded(10, 80), bounded(100, 10_000), bounded(1_000, 30_000), bounded(1_000, 300_000)],
    ([trainLength, intervalMillis, tinyHoldMillis, blockerHoldMillis]) =>
      Effect.gen(function* () {
        const model = yield* BackfillModel;
        const report = yield* model.simulate(
          policy,
          tinyTrain(trainLength, intervalMillis, tinyHoldMillis, blockerHoldMillis)
        );
        const big = A.findFirst(report.outcomes, (outcome) => outcome.nonce === "big");

        assertSome(
          O.map(big, (outcome) => outcome.nonce),
          "big"
        );
        expect(
          breachEvents(report),
          "80-arrival runs take about 40ms; capped runs prevent the nightly floor multiplying this load"
        ).toEqual([]);
        return true;
      }),

    { arbitrary: fcRunsCapped(64) }
  );

  it.effect.prop(
    "law 4: no backfill is admitted while a waiting unit is past its deadline",
    [Arbitrary.schema(StreamSeed)],
    ([seeds]) =>
      Effect.gen(function* () {
        const model = yield* BackfillModel;
        const report = yield* model.simulate(policy, arrivalsFrom(seeds, overrunHold));

        expect(backfillsWhileBreached(report)).toBe(0);
        return true;
      }),
    { arbitrary: fcRuns(96) }
  );

  it.effect.prop(
    "law 5: protected units lead in enqueue order; fairness orders the rest by origin usage",
    [Arbitrary.schema(ViewSeed)],
    ([seed]) =>
      Effect.gen(function* () {
        const model = yield* BackfillModel;
        const view = viewFrom(seed);
        const ordered = yield* model.order(policy, view);
        const protectedNow = isProtectedAt(policy, view.nowMillis);
        const [protectedUnits, rest] = A.span(ordered, protectedNow);

        expect(A.some(rest, protectedNow)).toBe(false);
        expect(A.map(protectedUnits, (unit) => unit.nonce)).toEqual(
          A.map(A.sort(protectedUnits, deployedHeadOnlyOrder(view.nowMillis)), (unit) => unit.nonce)
        );
        A.forEach(rest, (earlier, index) =>
          A.forEach(A.drop(rest, index + 1), (later) => {
            if (rankOf(view, earlier) === rankOf(view, later) && earlier.originKey !== later.originKey) {
              expect(usageOf(view, earlier.originKey)).toBeLessThanOrEqual(usageOf(view, later.originKey));
            }
          })
        );
        return true;
      }),
    { arbitrary: fcRuns(96) }
  );

  it.effect.prop(
    "law 6: with both modes off the order and verdicts equal the deployed scheduler",
    [Arbitrary.schema(ViewSeed)],
    ([seed]) =>
      Effect.gen(function* () {
        const model = yield* BackfillModel;
        const view = viewFrom(seed);
        const ordered = yield* model.order(deployedPolicy, view);

        expect(A.map(ordered, (unit) => unit.nonce)).toEqual(
          A.map(A.sort(view.waiting, deployedHeadOnlyOrder(view.nowMillis)), (unit) => unit.nonce)
        );
        const verdicts = yield* Effect.forEach(
          view.waiting,
          (unit) => model.verdict(deployedPolicy, view, unit.nonce),
          {
            concurrency: 1,
          }
        );

        expect(A.map(verdicts, AttemptVerdict.guards.Attempt)).toEqual(
          A.map(view.waiting, (unit) => deployedMayAttempt(view, unit.nonce))
        );
        return true;
      }),
    { arbitrary: fcRuns(96) }
  );

  it.effect.prop(
    "law 6 on tier units: with no declared ETA, EASY backfill replays the deployed admissions",
    [Arbitrary.schema(StreamSeed)],
    ([seeds]) =>
      Effect.gen(function* () {
        const model = yield* BackfillModel;
        const arrivals = arrivalsFrom(seeds, honestHold, () => false);
        const easy = yield* model.simulate(BackfillPolicy.make({ ...deployedPolicy, backfill: "easy" }), arrivals);
        const deployed = yield* model.simulate(deployedPolicy, arrivals);

        expect(outcomeOrder(easy)).toEqual(outcomeOrder(deployed));
        expect(A.some(easy.outcomes, (outcome) => outcome.route === "backfill")).toBe(false);
        return true;
      }),
    { arbitrary: fcRuns(64) }
  );

  it.effect.prop(
    "law 7: under a one-origin flood, a quiet origin is overtaken only by protected or backfilled units",
    [bounded(8, 30), bounded(1, 10), bounded(0, 20_000), bounded(10_000, 300_000), bounded(1, 200_000), bounded(1, 10)],
    ([floodCount, floodWeight, floodGapMillis, floodHoldMillis, quietAtMillis, quietWeight]) =>
      Effect.gen(function* () {
        const model = yield* BackfillModel;
        const flood = A.makeBy(floodCount, (index) =>
          arrival(`flood-${index}`, "origin-flood", floodWeight, index * floodGapMillis, floodHoldMillis)
        );
        const quiet = arrival("quiet", "origin-quiet", quietWeight, quietAtMillis, 30_000);
        const report = yield* model.simulate(policy, A.append(flood, quiet));
        const enqueuedAt = A.findFirstIndex(
          report.events,
          (event) => SimulationEvent.guards.Enqueued(event) && event.nonce === "quiet"
        );
        const admittedAt = A.findFirstIndex(
          report.events,
          (event) => SimulationEvent.guards.Admitted(event) && event.nonce === "quiet"
        );
        const between = pipe(
          O.zipWith(enqueuedAt, admittedAt, (from, to) => A.take(A.drop(report.events, from + 1), to - from - 1)),
          O.getOrElse(A.empty<SimulationEvent>)
        );

        for (const event of A.filter(between, SimulationEvent.guards.Admitted)) {
          const floodUnit = A.findFirst(flood, (unit) => unit.nonce === event.nonce);
          const overtook =
            event.route === "head" &&
            O.exists(floodUnit, (unit) => event.atMillis - unit.enqueuedAtMillis < policy.protectAfterMillis);
          expect(overtook).toBe(false);
        }
        return true;
      }),
    { arbitrary: fcRuns(64) }
  );

  it.effect("journals a fairness reading whose origin share sits inside the window", () =>
    Effect.gen(function* () {
      const model = yield* BackfillModel;
      const report = yield* model.simulate(policy, freshOriginTrain);

      for (const admitted of admittedEvents(report)) {
        expect(admitted.fairness.checkoutTokenMillis).toBeLessThanOrEqual(admitted.fairness.originTokenMillis);
        expect(admitted.fairness.originTokenMillis).toBeLessThanOrEqual(admitted.fairness.windowTokenMillis);
      }
    })
  );

  it.effect("mutant: greedy backfill starves the full-capacity unit past its bound", () =>
    Effect.gen(function* () {
      const stream = tinyTrain(400, 1_000, 5_000, 10_000);
      const sound = yield* simulateStream(policy, stream);
      const mutant = yield* simulateStream(policy, stream, greedyBackfill);

      expect(A.some(sound.outcomes, (outcome) => outcome.route === "backfill")).toBe(true);

      const headAtBlockerRelease = O.map(
        A.findFirst(sound.outcomes, (outcome) => outcome.nonce === "big"),
        (outcome) => `${outcome.route}@${outcome.admittedAtMillis}`
      );
      assertSome(headAtBlockerRelease, "head@10000");
      expect(breachEvents(sound)).toEqual([]);
      expect(A.map(breachEvents(mutant), (event) => event.nonce)).toEqual(["big"]);
    })
  );

  it.effect("mutant: fairness without protection or aging lets fresh origins overtake an old unit past its bound", () =>
    Effect.gen(function* () {
      const sound = yield* simulateStream(policy, freshOriginTrain);
      const mutant = yield* simulateStream(policy, freshOriginTrain, unprotectedOrdering);

      expect(breachEvents(sound)).toEqual([]);
      expect(A.map(breachEvents(mutant), (event) => event.nonce)).toEqual(["old"]);
    })
  );

  it.effect("a backfill passes a blocked head only when it ends before the head's projected start", () =>
    Effect.gen(function* () {
      const model = yield* BackfillModel;
      const running = RunningLease.make({
        nonce: "running",
        originKey: "origin-a",
        checkoutKey: "checkout-a",
        weightTokens: PosInt.make(6),
        admittedAtMillis: S.Natural.make(0),
        etaMillis: PosInt.makeOption(10_000),
      });
      const unit = (nonce: string, weight: number, enqueuedAtMillis: number, eta: O.Option<number>) =>
        QueuedUnit.make({
          nonce,
          originKey: "origin-b",
          checkoutKey: "checkout-b",
          priority: "verify",
          weightTokens: PosInt.make(weight),
          enqueuedAtMillis: S.Natural.make(enqueuedAtMillis),
          etaMillis: O.map(eta, PosInt.make),
          deadlineMillis: O.none(),
        });
      const view = SchedulerView.make({
        nowMillis: S.Natural.make(1_000),
        waiting: [
          unit("head", 10, 0, O.some(60_000)),
          unit("short", 2, 10, O.some(9_000)),
          unit("long", 2, 20, O.some(9_001)),
          unit("unknown", 2, 30, O.none()),
          unit("wide", 5, 40, O.some(1_000)),
          unit("late", 1, 50, O.some(1_000)),
        ],
        running: [running],
        finished: [],
      });
      const reasons = yield* Effect.forEach(
        ["head", "short", "long", "unknown", "wide", "late", "missing"],
        (nonce) => model.verdict(policy, view, nonce),
        { concurrency: 1 }
      );

      expect(reasons).toEqual([
        AttemptVerdict.cases.Wait.make({ reason: "capacity" }),
        AttemptVerdict.cases.Attempt.make({ route: "backfill" }),
        AttemptVerdict.cases.Wait.make({ reason: "ends-after-head-start" }),
        AttemptVerdict.cases.Wait.make({ reason: "eta-unknown" }),
        AttemptVerdict.cases.Wait.make({ reason: "capacity" }),
        AttemptVerdict.cases.Wait.make({ reason: "behind-backfill" }),
        AttemptVerdict.cases.Wait.make({ reason: "not-queued" }),
      ]);
      const deadline = yield* model.deadline(policy, view, unit("short", 2, 10, O.some(9_000)));
      assertSome(deadline, 1_000 + 9_000 + 60_000);
      assertSome(conditionalDeadline(view, policy, A.getUnsafe(queueOrder(view, policy), 0)), 10_000);
    })
  );

  it.effect("aging shorter than protection ranks an aged unit ahead of fairness", () =>
    Effect.gen(function* () {
      const model = yield* BackfillModel;
      const queued = (nonce: string, originKey: string, enqueuedAtMillis: number) =>
        QueuedUnit.make({
          nonce,
          originKey,
          checkoutKey: "checkout",
          priority: "verify",
          weightTokens: PosInt.make(1),
          enqueuedAtMillis: S.Natural.make(enqueuedAtMillis),
          etaMillis: O.none(),
          deadlineMillis: O.none(),
        });
      const view = SchedulerView.make({
        nowMillis: S.Natural.make(90_000),
        waiting: [queued("old", "origin-busy", 0), queued("fresh", "origin-idle", 50_000)],
        running: [
          RunningLease.make({
            nonce: "busy",
            originKey: "origin-busy",
            checkoutKey: "checkout",
            weightTokens: PosInt.make(1),
            admittedAtMillis: S.Natural.make(0),
            etaMillis: O.none(),
          }),
        ],
        finished: [],
      });
      const agingFirst = BackfillPolicy.make({ ...policy, publishAgingMillis: PosInt.make(60_000) });
      const aged = yield* model.order(agingFirst, view);
      const fair = yield* model.order(policy, view);

      expect(A.map(aged, (unit) => unit.nonce)).toEqual(["old", "fresh"]);
      expect(A.map(fair, (unit) => unit.nonce)).toEqual(["fresh", "old"]);
    })
  );

  it.effect("keys checkout usage by the (origin, checkout) pair without collisions", () =>
    Effect.sync(() => {
      const view = SchedulerView.make({
        nowMillis: S.Natural.make(1_000),
        waiting: [],
        running: [
          RunningLease.make({
            nonce: "lease",
            originKey: "a\u0000b",
            checkoutKey: "c",
            weightTokens: PosInt.make(1),
            admittedAtMillis: S.Natural.make(0),
            etaMillis: O.none(),
          }),
        ],
        finished: [],
      });
      const reading = fairnessReadingFor(view, policy, { originKey: "a", checkoutKey: "b\u0000c" });

      expect([reading.originTokenMillis, reading.checkoutTokenMillis, reading.windowTokenMillis]).toEqual([
        0, 0, 1_000,
      ]);
    })
  );

  it.effect("refuses a stream with duplicate nonces", () =>
    Effect.gen(function* () {
      const model = yield* BackfillModel;
      const twin = arrival("twin", "origin-a", 1, 0, 1_000);
      const error = yield* Effect.flip(model.simulate(policy, [twin, twin]));

      assertInstanceOf(error, SimulationInputError);
      expect(error.message).toBe("Arrival nonces must be unique.");
    })
  );
});
