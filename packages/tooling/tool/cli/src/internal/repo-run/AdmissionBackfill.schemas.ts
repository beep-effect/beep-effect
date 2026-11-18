/**
 * Schemas for the SCHE-06 admission verdict: the policy one scan applies, the
 * view it reads and the verdict it returns.
 *
 * **Details**
 *
 * Ported from the ciops lab model (`apps/labs/ciops/src/backfill`, PLAN slice
 * 11) onto the live ticket and lease records. The view is one scheduler scan
 * plus the released leases still inside the fairness window.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { AdmissionBackfillMode, AdmissionFairnessMode } from "./AdmissionJournal.ts";
import { YeetAdmissionLease, YeetAdmissionTicket } from "./QualityScheduler.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/AdmissionBackfill.schemas");

const PositiveMillis = S.Int.check(S.isGreaterThan(0));

/**
 * The policy the SCHE-06 verdict applies on one scan.
 *
 * **Details**
 *
 * `capacityTokens` is the scan's live capacity. `publishAgingMillis` is the
 * deployed aging of `verify` work; `protectAfterMillis` is the wait after
 * which a ticket keeps enqueue order and stamps its bound (120 s, the same
 * instant, so with both modes off the order is the deployed one).
 * `promotionOverheadMillis` is the polling slack the bound adds per ticket,
 * the heartbeat.
 *
 * **Example** (The deployed timing with both modes off)
 *
 * ```ts
 * import { AdmissionBackfillPolicy } from "@beep/repo-cli/test/RepoRun"
 *
 * const policy = AdmissionBackfillPolicy.make({
 *   capacityTokens: 10,
 *   publishAgingMillis: 120_000,
 *   protectAfterMillis: 120_000,
 *   fairnessWindowMillis: 1_800_000,
 *   promotionOverheadMillis: 5_000,
 *   backfill: "off",
 *   fairness: "off"
 * })
 * console.log(policy.backfill) // "off"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionBackfillPolicy extends S.Opaque<AdmissionBackfillPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    capacityTokens: S.Finite,
    publishAgingMillis: S.Finite,
    protectAfterMillis: S.Finite,
    fairnessWindowMillis: PositiveMillis,
    promotionOverheadMillis: S.Finite,
    backfill: AdmissionBackfillMode,
    fairness: AdmissionFairnessMode,
  }).pipe(
    $I.annoteSchema("AdmissionBackfillPolicy", {
      description: "Capacity, aging, protection, fairness window, overhead and modes of one SCHE-06 verdict.",
    })
  )
) {}

/**
 * One released lease interval the fairness window counts.
 *
 * **Example** (A one-token interval)
 *
 * ```ts
 * import { AdmissionUsageInterval } from "@beep/repo-cli/test/RepoRun"
 *
 * const interval = AdmissionUsageInterval.make({
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   weightTokens: 1,
 *   admittedAtMillis: 0,
 *   releasedAtMillis: 60_000
 * })
 * console.log(interval.weightTokens) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionUsageInterval extends S.Opaque<AdmissionUsageInterval, { readonly brand: unique symbol }>()(
  S.Struct({
    originKey: S.String,
    checkoutRoot: S.String,
    weightTokens: S.Finite,
    admittedAtMillis: S.Finite,
    releasedAtMillis: S.Finite,
  }).pipe(
    $I.annoteSchema("AdmissionUsageInterval", {
      description: "A released admission lease interval counted by the SCHE-06 fairness window.",
    })
  )
) {}

/**
 * What one SCHE-06 verdict reads: the queue and leases of one scan and the windowed released leases.
 *
 * **Details**
 *
 * `tickets` holds only the tickets the deployed skippable checks leave in
 * line (same-checkout lease, legacy origin owner, origin stamp, review-fix
 * class cap): the verdict runs after those checks, unchanged.
 *
 * **Example** (An idle machine)
 *
 * ```ts
 * import { AdmissionBackfillView } from "@beep/repo-cli/test/RepoRun"
 *
 * const view = AdmissionBackfillView.make({ nowMillis: 0, tickets: [], leases: [], finished: [] })
 * console.log(view.tickets.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionBackfillView extends S.Opaque<AdmissionBackfillView, { readonly brand: unique symbol }>()(
  S.Struct({
    nowMillis: S.Finite,
    tickets: S.Array(YeetAdmissionTicket),
    leases: S.Array(YeetAdmissionLease),
    finished: S.Array(AdmissionUsageInterval),
  }).pipe(
    $I.annoteSchema("AdmissionBackfillView", {
      description: "In-line tickets, live leases and windowed released leases one SCHE-06 verdict reads.",
    })
  )
) {}

/**
 * How a contender was let through: as the queue head or by passing a blocked head.
 *
 * **Example** (Recognize a backfill)
 *
 * ```ts
 * import { AdmissionAttemptRoute } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionAttemptRoute.is.backfill("backfill")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionAttemptRoute = LiteralKit(["head", "backfill"]).pipe(
  $I.annoteSchema("AdmissionAttemptRoute", {
    description: "Whether a contender attempts as the queue head or by passing a capacity-blocked head.",
  })
);

/**
 * How a contender was let through.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionAttemptRoute = typeof AdmissionAttemptRoute.Type;

/**
 * Why a contender stays queued on one scan.
 *
 * **Example** (Recognize an unknown ETA)
 *
 * ```ts
 * import { AdmissionWaitReason } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionWaitReason.is["eta-unknown"]("eta-unknown")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionWaitReason = LiteralKit([
  "capacity",
  "behind-head",
  "behind-backfill",
  "backfill-disabled",
  "eta-unknown",
  "ends-after-head-start",
  "not-queued",
]).pipe(
  $I.annoteSchema("AdmissionWaitReason", {
    description: "Why an admission contender stays queued on one scheduler scan.",
  })
);

/**
 * Why a contender stays queued on one scan.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionWaitReason = typeof AdmissionWaitReason.Type;

/**
 * Whether one contender may attempt admission now, and by which route, or why it waits.
 *
 * **Example** (A head attempt)
 *
 * ```ts
 * import { AdmissionAttemptVerdict } from "@beep/repo-cli/test/RepoRun"
 *
 * const verdict = AdmissionAttemptVerdict.cases.Attempt.make({ route: "head" })
 * console.log(AdmissionAttemptVerdict.guards.Attempt(verdict)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionAttemptVerdict = S.TaggedUnion({
  Attempt: { route: AdmissionAttemptRoute },
  Wait: { reason: AdmissionWaitReason },
}).pipe(
  $I.annoteSchema("AdmissionAttemptVerdict", {
    description: "Whether one admission contender may attempt now, and by which route, or why it waits.",
  })
);

/**
 * Whether one contender may attempt admission now.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionAttemptVerdict = typeof AdmissionAttemptVerdict.Type;

/**
 * How a contender declares its ETA from the admission journal.
 *
 * **Details**
 *
 * The ETA is the nearest-rank `quantilePermille` quantile of the last
 * `historyLimit` holds (release minus admission) of the same work kind; a
 * kind with fewer than `minSamples` holds declares none and never backfills.
 *
 * **Example** (The p90 estimator)
 *
 * ```ts
 * import { AdmissionEtaEstimator } from "@beep/repo-cli/test/RepoRun"
 *
 * const estimator = AdmissionEtaEstimator.make({ quantilePermille: 900, minSamples: 5, historyLimit: 200 })
 * console.log(estimator.minSamples) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionEtaEstimator extends S.Opaque<AdmissionEtaEstimator, { readonly brand: unique symbol }>()(
  S.Struct({
    quantilePermille: S.Int.check(S.isBetween({ minimum: 1, maximum: 1000 })),
    minSamples: PositiveMillis,
    historyLimit: PositiveMillis,
  }).pipe(
    $I.annoteSchema("AdmissionEtaEstimator", {
      description: "Per-kind hold quantile a contender declares as its ETA under the SCHE-06 backfill gate.",
    })
  )
) {}
