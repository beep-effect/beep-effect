/**
 * Schemas for the SCHE-06 backfill and fairness model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { PosInt } from "../projection/PosInt.ts";
import { AdmissionPriority } from "../projection/Schemas.ts";

const $I = $CiopsId.create("backfill/Schemas");

/**
 * Whether a waiting unit may pass a capacity-blocked head.
 *
 * **Details**
 *
 * `off` keeps the deployed head-of-line rule. `easy` admits a non-head unit
 * whose declared ETA ends before the head's projected start.
 *
 * **Example** (Recognize EASY backfill)
 *
 * ```ts
 * import { BackfillMode } from "@/backfill/Schemas"
 *
 * console.log(BackfillMode.is.easy("easy")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BackfillMode = LiteralKit(["off", "easy"]).pipe(
  $I.annoteSchema("BackfillMode", {
    description: "Whether a waiting unit may pass a capacity-blocked head (EASY backfill) or not.",
  })
);

type BackfillMode = typeof BackfillMode.Type;

/**
 * How unprotected units of the same rank are ordered.
 *
 * **Details**
 *
 * `off` keeps enqueue order. `origin-checkout` puts the origin with the least
 * recent token-milliseconds first, then the checkout with the least.
 *
 * **Example** (Recognize two-level fairness)
 *
 * ```ts
 * import { FairnessMode } from "@/backfill/Schemas"
 *
 * console.log(FairnessMode.is["origin-checkout"]("origin-checkout")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FairnessMode = LiteralKit(["off", "origin-checkout"]).pipe(
  $I.annoteSchema("FairnessMode", {
    description: "Whether unprotected units are ordered by recent origin, then checkout, usage.",
  })
);

type FairnessMode = typeof FairnessMode.Type;

/**
 * Policy of the backfill and fairness model.
 *
 * **Details**
 *
 * `publishAgingMillis` is the deployed verify-to-rank-zero aging.
 * `protectAfterMillis` is the wait after which a unit enters protected
 * ordering and is never overtaken by a newer unit; with both at 120 s and both
 * modes `off` the order equals the deployed `ticketOrder`.
 * `promotionOverheadMillis` is slack added to the conditional bound once per
 * unit ahead and once for the unit itself; slice 12 sets it from the live
 * heartbeat. The model decides only at events (see `simulateStream`), so it
 * charges no polling delay.
 *
 * **Example** (Construct the SCHE-06 policy)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BackfillPolicy } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const policy = BackfillPolicy.make({
 *   capacityTokens: PosInt.make(10),
 *   publishAgingMillis: PosInt.make(120_000),
 *   protectAfterMillis: PosInt.make(120_000),
 *   fairnessWindowMillis: PosInt.make(1_800_000),
 *   promotionOverheadMillis: S.Natural.make(0),
 *   backfill: "easy",
 *   fairness: "origin-checkout"
 * })
 * console.log(policy.backfill) // "easy"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class BackfillPolicy extends S.Opaque<BackfillPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    capacityTokens: PosInt,
    publishAgingMillis: PosInt,
    protectAfterMillis: PosInt,
    fairnessWindowMillis: PosInt,
    promotionOverheadMillis: S.Natural,
    backfill: BackfillMode,
    fairness: FairnessMode,
  }).pipe(
    $I.annoteSchema("BackfillPolicy", {
      description: "Capacity, aging, protection, fairness window and mode switches of the SCHE-06 model.",
    })
  )
) {}

/**
 * One unit waiting for admission.
 *
 * **Details**
 *
 * `weightTokens` is already clamped to the capacity, as the live scheduler
 * clamps an oversized request to the machine ceiling. `etaMillis` is the
 * unit's declared hold (its p90); a tier unit without a measured envelope has
 * none and can never backfill. `deadlineMillis` is stamped once, when the unit
 * enters protected ordering, and only when every unit ahead declared an ETA.
 *
 * **Example** (Construct a waiting unit)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { QueuedUnit } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const unit = QueuedUnit.make({
 *   nonce: "unit-1",
 *   originKey: "origin-a",
 *   checkoutKey: "checkout-a",
 *   priority: "verify",
 *   weightTokens: PosInt.make(3),
 *   enqueuedAtMillis: S.Natural.make(0),
 *   etaMillis: PosInt.makeOption(60_000),
 *   deadlineMillis: O.none()
 * })
 * console.log(unit.nonce) // "unit-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QueuedUnit extends S.Opaque<QueuedUnit, { readonly brand: unique symbol }>()(
  S.Struct({
    nonce: S.NonEmptyString,
    originKey: S.String,
    checkoutKey: S.String,
    priority: AdmissionPriority,
    weightTokens: PosInt,
    enqueuedAtMillis: S.Natural,
    etaMillis: S.Option(PosInt),
    deadlineMillis: S.Option(S.Natural),
  }).pipe(
    $I.annoteSchema("QueuedUnit", {
      description: "A waiting unit: identity, fairness keys, clamped weight, declared ETA and stamped bound.",
    })
  )
) {}

/**
 * One admitted unit still holding tokens.
 *
 * **Example** (Construct a running lease)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { RunningLease } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const lease = RunningLease.make({
 *   nonce: "unit-1",
 *   originKey: "origin-a",
 *   checkoutKey: "checkout-a",
 *   weightTokens: PosInt.make(3),
 *   admittedAtMillis: S.Natural.make(1_000),
 *   etaMillis: PosInt.makeOption(60_000)
 * })
 * console.log(lease.weightTokens) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunningLease extends S.Opaque<RunningLease, { readonly brand: unique symbol }>()(
  S.Struct({
    nonce: S.NonEmptyString,
    originKey: S.String,
    checkoutKey: S.String,
    weightTokens: PosInt,
    admittedAtMillis: S.Natural,
    etaMillis: S.Option(PosInt),
  }).pipe(
    $I.annoteSchema("RunningLease", {
      description: "An admitted unit holding tokens, with the ETA it declared at admission.",
    })
  )
) {}

/**
 * One released lease, kept for the fairness window.
 *
 * **Example** (Construct a finished lease)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FinishedLease } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const lease = FinishedLease.make({
 *   originKey: "origin-a",
 *   checkoutKey: "checkout-a",
 *   weightTokens: PosInt.make(3),
 *   admittedAtMillis: S.Natural.make(1_000),
 *   releasedAtMillis: S.Natural.make(61_000)
 * })
 * console.log(lease.releasedAtMillis) // 61000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinishedLease extends S.Opaque<FinishedLease, { readonly brand: unique symbol }>()(
  S.Struct({
    originKey: S.String,
    checkoutKey: S.String,
    weightTokens: PosInt,
    admittedAtMillis: S.Natural,
    releasedAtMillis: S.Natural,
  }).pipe(
    $I.annoteSchema("FinishedLease", {
      description: "A released lease interval counted by the fairness window.",
    })
  )
) {}

/**
 * Everything a contender reads to decide whether it may attempt admission.
 *
 * **Details**
 *
 * This is the state `selfMayAttempt` sees on one scan: the queue, the live
 * leases and the released leases still inside the fairness window. The
 * backfill latch is derived, never stored: backfill is disabled while any
 * waiting unit is past its stamped deadline.
 *
 * **Example** (Construct an empty view)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SchedulerView } from "@/backfill/Schemas"
 *
 * const view = SchedulerView.make({
 *   nowMillis: S.Natural.make(0),
 *   waiting: [],
 *   running: [],
 *   finished: []
 * })
 * console.log(view.waiting.length) // 0
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class SchedulerView extends S.Opaque<SchedulerView, { readonly brand: unique symbol }>()(
  S.Struct({
    nowMillis: S.Natural,
    waiting: S.Array(QueuedUnit),
    running: S.Array(RunningLease),
    finished: S.Array(FinishedLease),
  }).pipe(
    $I.annoteSchema("SchedulerView", {
      description: "Queue, live leases and windowed released leases read on one scheduler scan.",
    })
  )
) {}

const AdmissionRoute = LiteralKit(["head", "backfill"]).pipe(
  $I.annoteSchema("AdmissionRoute", {
    description: "Whether a unit was admitted as the queue head or by passing a blocked head.",
  })
);

/**
 * Decoded admission route accepted by {@link AdmissionRoute}.
 *
 * @see {@link AdmissionRoute} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AdmissionRoute = typeof AdmissionRoute.Type;

const WaitReason = LiteralKit([
  "capacity",
  "behind-head",
  "behind-backfill",
  "backfill-disabled",
  "eta-unknown",
  "ends-after-head-start",
  "not-queued",
]).pipe(
  $I.annoteSchema("WaitReason", {
    description: "Why a contender stays queued on one scheduler scan.",
  })
);

/**
 * Decoded wait reason accepted by {@link WaitReason}.
 *
 * **Details**
 *
 * - `capacity`: its own weight does not fit.
 * - `behind-head`: an earlier unit goes first (head-of-line, or backfill off).
 * - `behind-backfill`: an earlier non-head unit may backfill first.
 * - `backfill-disabled`: a waiting unit is past its deadline.
 * - `eta-unknown`: its own ETA, or a running lease's, is not declared or has
 *   been overrun, so the head's start cannot be projected.
 * - `ends-after-head-start`: its ETA would end after the head's projected start.
 * - `not-queued`: the nonce is not waiting.
 *
 * @see {@link WaitReason} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type WaitReason = typeof WaitReason.Type;

/**
 * Verdict of one contender on one scan: attempt by a route, or wait for a reason.
 *
 * **Example** (Match a verdict)
 *
 * ```ts
 * import { AttemptVerdict } from "@/backfill/Schemas"
 *
 * const verdict = AttemptVerdict.cases.Attempt.make({ route: "head" })
 * console.log(
 *   AttemptVerdict.match(verdict, { Attempt: (a) => a.route, Wait: (w) => w.reason })
 * ) // "head"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AttemptVerdict = S.TaggedUnion({
  Attempt: { route: AdmissionRoute },
  Wait: { reason: WaitReason },
}).pipe(
  $I.annoteSchema("AttemptVerdict", {
    description: "Whether one contender may attempt admission now, and by which route, or why it waits.",
  })
);

/**
 * Decoded verdict accepted by {@link AttemptVerdict}.
 *
 * @see {@link AttemptVerdict} for constructors and matchers.
 * @category models
 * @since 0.0.0
 */
export type AttemptVerdict = typeof AttemptVerdict.Type;

/**
 * Recent usage read at one admission, journaled as the fairness share.
 *
 * **Details**
 *
 * Token-milliseconds inside the fairness window, for the admitted unit's
 * origin, its checkout within that origin, and every lease in the window.
 *
 * **Example** (Construct a fairness reading)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FairnessReading } from "@/backfill/Schemas"
 *
 * const reading = FairnessReading.make({
 *   originTokenMillis: S.Natural.make(10),
 *   checkoutTokenMillis: S.Natural.make(5),
 *   windowTokenMillis: S.Natural.make(40)
 * })
 * console.log(reading.windowTokenMillis) // 40
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class FairnessReading extends S.Opaque<FairnessReading, { readonly brand: unique symbol }>()(
  S.Struct({
    originTokenMillis: S.Natural,
    checkoutTokenMillis: S.Natural,
    windowTokenMillis: S.Natural,
  }).pipe(
    $I.annoteSchema("FairnessReading", {
      description: "Windowed token-milliseconds of the admitted origin, its checkout, and all leases.",
    })
  )
) {}

/**
 * One arrival of an adversarial stream.
 *
 * **Details**
 *
 * `requestedWeightTokens` may exceed the capacity (an oversized unit); the
 * model clamps it on enqueue. `holdMillis` is how long the unit really runs:
 * below its ETA for a crash or an early finish, above it for an overrun.
 *
 * **Example** (Construct an arrival)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { UnitArrival } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const arrival = UnitArrival.make({
 *   nonce: "unit-1",
 *   originKey: "origin-a",
 *   checkoutKey: "checkout-a",
 *   priority: "publish",
 *   requestedWeightTokens: PosInt.make(1),
 *   enqueuedAtMillis: S.Natural.make(0),
 *   etaMillis: PosInt.makeOption(30_000),
 *   holdMillis: PosInt.make(20_000)
 * })
 * console.log(arrival.holdMillis) // 20000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnitArrival extends S.Opaque<UnitArrival, { readonly brand: unique symbol }>()(
  S.Struct({
    nonce: S.NonEmptyString,
    originKey: S.String,
    checkoutKey: S.String,
    priority: AdmissionPriority,
    requestedWeightTokens: PosInt,
    enqueuedAtMillis: S.Natural,
    etaMillis: S.Option(PosInt),
    holdMillis: PosInt,
  }).pipe(
    $I.annoteSchema("UnitArrival", {
      description: "One stream arrival: identity, fairness keys, requested weight, declared ETA and true hold.",
    })
  )
) {}

/**
 * Events the model journals, in time order.
 *
 * **Details**
 *
 * `Admitted` carries the route and the fairness reading; `BoundBreached` is the
 * bound-violation row SCHE-06 asks the live scheduler to journal.
 *
 * **Example** (Match a breach row)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SimulationEvent } from "@/backfill/Schemas"
 *
 * const event = SimulationEvent.cases.BoundBreached.make({
 *   atMillis: S.Natural.make(10),
 *   nonce: "unit-1",
 *   deadlineMillis: S.Natural.make(9)
 * })
 * console.log(SimulationEvent.guards.BoundBreached(event)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SimulationEvent = S.TaggedUnion({
  Enqueued: {
    atMillis: S.Natural,
    nonce: S.NonEmptyString,
    weightTokens: PosInt,
    clamped: S.Boolean,
  },
  Protected: {
    atMillis: S.Natural,
    nonce: S.NonEmptyString,
    deadlineMillis: S.Option(S.Natural),
  },
  Admitted: {
    atMillis: S.Natural,
    nonce: S.NonEmptyString,
    route: AdmissionRoute,
    waitedMillis: S.Natural,
    activeTokensAfter: S.Natural,
    fairness: FairnessReading,
  },
  Released: {
    atMillis: S.Natural,
    nonce: S.NonEmptyString,
    activeTokensAfter: S.Natural,
  },
  BoundBreached: {
    atMillis: S.Natural,
    nonce: S.NonEmptyString,
    deadlineMillis: S.Natural,
  },
}).pipe(
  $I.annoteSchema("SimulationEvent", {
    description: "One journaled model event: enqueue, protection, admission, release or bound breach.",
  })
);

/**
 * Decoded event accepted by {@link SimulationEvent}.
 *
 * @see {@link SimulationEvent} for constructors, guards and matchers.
 * @category models
 * @since 0.0.0
 */
export type SimulationEvent = typeof SimulationEvent.Type;

/**
 * How one unit fared over a simulated stream.
 *
 * **Example** (Construct an outcome)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { UnitOutcome } from "@/backfill/Schemas"
 *
 * const outcome = UnitOutcome.make({
 *   nonce: "unit-1",
 *   originKey: "origin-a",
 *   enqueuedAtMillis: S.Natural.make(0),
 *   admittedAtMillis: S.Natural.make(5),
 *   route: "head",
 *   deadlineMillis: O.none()
 * })
 * console.log(outcome.route) // "head"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnitOutcome extends S.Opaque<UnitOutcome, { readonly brand: unique symbol }>()(
  S.Struct({
    nonce: S.NonEmptyString,
    originKey: S.String,
    enqueuedAtMillis: S.Natural,
    admittedAtMillis: S.Natural,
    route: AdmissionRoute,
    deadlineMillis: S.Option(S.Natural),
  }).pipe(
    $I.annoteSchema("UnitOutcome", {
      description: "Enqueue, admission, route and stamped deadline of one simulated unit.",
    })
  )
) {}

/**
 * Result of simulating one arrival stream to quiescence.
 *
 * **Example** (Construct an empty report)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SimulationReport } from "@/backfill/Schemas"
 *
 * const report = SimulationReport.make({ events: [], outcomes: [], peakActiveTokens: S.Natural.make(0) })
 * console.log(report.outcomes.length) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class SimulationReport extends S.Opaque<SimulationReport, { readonly brand: unique symbol }>()(
  S.Struct({
    events: S.Array(SimulationEvent),
    outcomes: S.Array(UnitOutcome),
    peakActiveTokens: S.Natural,
  }).pipe(
    $I.annoteSchema("SimulationReport", {
      description: "Journaled events, per-unit outcomes and peak token use of one simulated stream.",
    })
  )
) {}

/**
 * Typed failure for an arrival stream the model refuses.
 *
 * **Example** (Construct the failure)
 *
 * ```ts
 * import { SimulationInputError } from "@/backfill/Schemas"
 *
 * const error = SimulationInputError.make({ message: "Arrival nonces must be unique." })
 * console.log(error._tag) // "SimulationInputError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SimulationInputError extends S.TaggedError<SimulationInputError, { readonly brand: unique symbol }>(
  $I`SimulationInputError`
)(
  "SimulationInputError",
  { message: S.String },
  $I.annoteError<SimulationInputError>("SimulationInputError", {
    description: "The arrival stream cannot be simulated, for example because two arrivals share a nonce.",
  })
) {}

/**
 * How the journal replay declares an ETA for one recorded unit.
 *
 * **Details**
 *
 * The ETA is the nearest-rank quantile (`quantilePermille`) of the last
 * `historyLimit` holds of the same work kind released at or before the unit's
 * enqueue instant, so the replay never reads the future. A kind with fewer
 * than `minSamples` such holds declares no ETA and so never backfills.
 *
 * **Example** (The p90 estimator)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReplayEtaEstimator } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 * const estimator = ReplayEtaEstimator.make({
 *   quantilePermille: PosInt.make(900),
 *   minSamples: PosInt.make(5),
 *   historyLimit: PosInt.make(200)
 * })
 * console.log(estimator.quantilePermille) // 900
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReplayEtaEstimator extends S.Opaque<ReplayEtaEstimator, { readonly brand: unique symbol }>()(
  S.Struct({
    quantilePermille: PosInt.check(S.isLessThanOrEqualTo(1000)),
    minSamples: PosInt,
    historyLimit: PosInt,
  }).pipe(
    $I.annoteSchema("ReplayEtaEstimator", {
      description: "Causal per-kind hold quantile the journal replay declares as each unit's ETA.",
    })
  )
) {}

/**
 * One arm of the tail-wait A/B: the capacity and the two SCHE-06 switches.
 *
 * **Example** (The deployed arm at ten tokens)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReplayArmSpec } from "@/backfill/Schemas"
 *
 * const arm = ReplayArmSpec.make({
 *   capacityTokens: S.Int.check(S.isGreaterThan(0)).make(10),
 *   backfill: "off",
 *   fairness: "off"
 * })
 * console.log(arm.backfill) // "off"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReplayArmSpec extends S.Opaque<ReplayArmSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    capacityTokens: PosInt,
    backfill: BackfillMode,
    fairness: FairnessMode,
  }).pipe(
    $I.annoteSchema("ReplayArmSpec", {
      description: "Capacity and SCHE-06 mode switches of one tail-wait A/B arm.",
    })
  )
) {}

/**
 * Nearest-rank wait quantiles of one population, in milliseconds.
 *
 * **Example** (An empty population)
 *
 * ```ts
 * import { summarizeWaits } from "@/backfill/JournalReplay"
 *
 * console.log(summarizeWaits([]).count) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class WaitSummary extends S.Opaque<WaitSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    count: S.Natural,
    p50Millis: S.Natural,
    p90Millis: S.Natural,
    p95Millis: S.Natural,
    p99Millis: S.Natural,
    maxMillis: S.Natural,
    meanMillis: S.Natural,
    overMinute: S.Natural,
  }).pipe(
    $I.annoteSchema("WaitSummary", {
      description: "Nearest-rank p50, p90, p95, p99, max and mean wait, and the count waiting over a minute.",
    })
  )
) {}

/**
 * What one A/B arm produced on the replayed stream.
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReplayArmResult extends S.Opaque<ReplayArmResult, { readonly brand: unique symbol }>()(
  S.Struct({
    arm: ReplayArmSpec,
    waits: WaitSummary,
    backfills: S.Natural,
    breaches: S.Natural,
    peakActiveTokens: S.Natural,
  }).pipe(
    $I.annoteSchema("ReplayArmResult", {
      description: "Wait summary, backfill admissions, bound breaches and peak tokens of one A/B arm.",
    })
  )
) {}

/**
 * The tail-wait A/B over one recorded admission journal.
 *
 * **Details**
 *
 * `chains` counts the admitted-and-released nonces replayed; `skipped` counts
 * nonces without both rows (withdrawn, evicted, or cut by the window); the
 * A/B script refuses a journal with rows its decoder rejects. `recorded` summarizes the waits the deployed scheduler
 * actually produced, so each arm can be read against it. The report exposes
 * only aggregate counts and wait quantiles, never paths, origins or nonces.
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReplayReport extends S.Opaque<ReplayReport, { readonly brand: unique symbol }>()(
  S.Struct({
    chains: S.Natural,
    skipped: S.Natural,
    spanMillis: S.Natural,
    etaDeclared: S.Natural,
    estimator: ReplayEtaEstimator,
    recorded: WaitSummary,
    arms: S.Array(ReplayArmResult),
  }).pipe(
    $I.annoteSchema("ReplayReport", {
      description: "Recorded waits and per-arm simulated waits of the SCHE-06 tail-wait A/B over one journal.",
    })
  )
) {}

/**
 * One journal's replay stream: its arrivals, recorded waits, skipped nonces and enqueue span.
 *
 * **Example** (An empty stream)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReplayStream } from "@/backfill/Schemas"
 *
 * const stream = ReplayStream.make({
 *   arrivals: [],
 *   recordedWaits: [],
 *   skipped: S.Natural.make(0),
 *   spanMillis: S.Natural.make(0)
 * })
 * console.log(stream.arrivals.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReplayStream extends S.Opaque<ReplayStream, { readonly brand: unique symbol }>()(
  S.Struct({
    arrivals: S.Array(UnitArrival),
    recordedWaits: S.Array(S.Finite),
    skipped: S.Natural,
    spanMillis: S.Natural,
  }).pipe(
    $I.annoteSchema("ReplayStream", {
      description: "Arrivals, recorded waits, skipped nonces and enqueue span of one replayed admission journal.",
    })
  )
) {}

/**
 * Timing every A/B arm shares: publish aging, protection, the fairness window and promotion overhead.
 *
 * **Example** (The deployed timing)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReplayTiming } from "@/backfill/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 * const timing = ReplayTiming.make({
 *   publishAgingMillis: PosInt.make(120_000),
 *   protectAfterMillis: PosInt.make(120_000),
 *   fairnessWindowMillis: PosInt.make(1_800_000),
 *   promotionOverheadMillis: S.Natural.make(5_000)
 * })
 * console.log(timing.protectAfterMillis) // 120000
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReplayTiming extends S.Opaque<ReplayTiming, { readonly brand: unique symbol }>()(
  S.Struct({
    publishAgingMillis: PosInt,
    protectAfterMillis: PosInt,
    fairnessWindowMillis: PosInt,
    promotionOverheadMillis: S.Natural,
  }).pipe(
    $I.annoteSchema("ReplayTiming", {
      description: "Publish aging, protection, fairness window and promotion overhead shared by every A/B arm.",
    })
  )
) {}
