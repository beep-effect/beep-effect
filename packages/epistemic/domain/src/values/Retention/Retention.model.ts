/**
 * Disposable retention report contracts; policy is data, never authority.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import { LogicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity";
import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Sha256Hex } from "@beep/schema/Sha256";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $EpistemicDomainId.create("values/Retention/Retention.model");
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0));
const Positive = S.Int.check(S.isGreaterThan(0));
/**
 * Claim endpoint disposition; absence is explicit and never inferred as active.
 *
 * **Example** (Inspect RetentionDisposition)
 *
 * ```ts
 * import { RetentionDisposition } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionDisposition)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RetentionDisposition = LiteralKit([
  "active",
  "rejected",
  "superseded",
  "unresolved",
  "not-applicable",
]).pipe(
  $I.annoteSchema("RetentionDisposition", {
    description: "Claim endpoint disposition; absence is explicit and never inferred as active.",
  })
);
/**
 * Runtime type of {@link RetentionDisposition}.
 * @category type-level
 * @since 0.0.0
 */
export type RetentionDisposition = typeof RetentionDisposition.Type;
/**
 * Disposable policy tier; evictable is advisory and never deletes authority.
 *
 * **Example** (Inspect RetentionTier)
 *
 * ```ts
 * import { RetentionTier } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionTier)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RetentionTier = LiteralKit(["hot", "warm", "cold", "evictable", "unclassified"]).pipe(
  $I.annoteSchema("RetentionTier", {
    description: "Disposable policy tier; evictable is advisory and never deletes authority.",
  })
);
/**
 * Runtime type of {@link RetentionTier}.
 * @category type-level
 * @since 0.0.0
 */
export type RetentionTier = typeof RetentionTier.Type;
/**
 * Scoped two-axis query; an empty disposition filter includes all rows.
 *
 * **Example** (Inspect RetentionQuery)
 *
 * ```ts
 * import { RetentionQuery } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionQuery)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetentionQuery extends S.Opaque<RetentionQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    orgId: Shared.OrganizationId,
    logicalKeys: S.Array(LogicalEdgeKey).check(S.isMaxLength(1000)),
    validAt: S.DateTimeUtcFromMillis,
    knownAt: S.DateTimeUtcFromMillis,
    dispositions: S.Array(RetentionDisposition),
  }).pipe(
    $I.annoteSchema("RetentionQuery", {
      description: "Scoped two-axis query; an empty disposition filter includes all rows.",
    })
  )
) {}
/**
 * Candidate age windows, rational decay scale and payload budget with no defaults.
 *
 * **Example** (Inspect RetentionPolicy)
 *
 * ```ts
 * import { RetentionPolicy } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionPolicy)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetentionPolicy extends S.Opaque<RetentionPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    hotThroughMillis: Positive,
    warmThroughMillis: Positive,
    coldThroughMillis: Positive,
    decayScaleMillis: Positive,
    payloadBudgetBytes: Positive,
  }).pipe(
    S.check(
      S.makeFilter(
        (p) => p.hotThroughMillis < p.warmThroughMillis && p.warmThroughMillis < p.coldThroughMillis,
        $I.annote("OrderedRetentionWindows", {
          title: "Ordered retention windows",
          description: "Age windows must be strictly increasing.",
        })
      )
    ),
    $I.annoteSchema("RetentionPolicy", {
      description: "Candidate age windows, rational decay scale and payload budget with no defaults.",
    })
  )
) {}
/**
 * Registry-owned approval receipt; decoding this data is insufficient to activate policy.
 *
 * **Example** (Inspect RetentionCalibration)
 *
 * ```ts
 * import { RetentionCalibration } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionCalibration)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetentionCalibration extends S.Opaque<RetentionCalibration, { readonly brand: unique symbol }>()(
  S.Struct({
    policyDigest: Sha256Hex,
    orgId: Shared.OrganizationId,
    mechanism: S.tag("retention-v1"),
    datasetDigest: Sha256Hex,
    evaluationReport: S.NonEmptyString,
    sampleCount: Positive,
    approvedBy: UserPrincipal,
    approvedAt: S.DateTimeUtcFromMillis,
    expiresAt: S.DateTimeUtcFromMillis,
    purpose: S.Literals(["production", "synthetic"]),
  }).pipe(
    $I.annoteSchema("RetentionCalibration", {
      description: "Registry-owned approval receipt; decoding this data is insufficient to activate policy.",
    })
  )
) {}
const PolicyAdmissionState = LiteralKit(["inert", "calibrated"]).pipe(
  $I.annoteSchema("PolicyAdmissionState", { description: "Calibration admission state." })
);
/**
 * Discriminated policy admission; active policy and approval exist only in the calibrated case.
 *
 * **Example** (Construct inert admission)
 * ```ts
 * import { RetentionPolicyAdmission } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionPolicyAdmission.cases.inert.make({}).state)
 * ```
 * @category policies
 * @since 0.0.0
 */
export const RetentionPolicyAdmission = PolicyAdmissionState.mapMembers(
  Tuple.evolve([
    () => S.Struct({ state: S.tag("inert") }),
    () => S.Struct({ state: S.tag("calibrated"), policy: RetentionPolicy, calibration: RetentionCalibration }),
  ])
).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("RetentionPolicyAdmission", {
    description: "Policy is inactive or bound to its trusted calibration receipt.",
  })
);
/**
 * Runtime type of the policy admission union.
 * @category type-level
 * @since 0.0.0
 */
export type RetentionPolicyAdmission = typeof RetentionPolicyAdmission.Type;

/**
 * Consistent accepted authority snapshot from the server read seam.
 *
 * **Example** (Inspect RetentionSnapshot)
 *
 * ```ts
 * import { RetentionSnapshot } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionSnapshot)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetentionSnapshot extends S.Opaque<RetentionSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    edges: S.Array(EdgeVersion),
    dispositions: S.Array(ClaimDisposition),
  }).pipe(
    $I.annoteSchema("RetentionSnapshot", {
      description: "Consistent accepted authority snapshot from the server read seam.",
    })
  )
) {}
/**
 * One visible accepted edge with orthogonal endpoint dispositions and advisory tier.
 *
 * **Example** (Inspect RetentionRow)
 *
 * ```ts
 * import { RetentionRow } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionRow)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetentionRow extends S.Opaque<RetentionRow, { readonly brand: unique symbol }>()(
  S.Struct({
    logicalKey: LogicalEdgeKey,
    edgeVersionId: Positive,
    version: Positive,
    sourceDisposition: RetentionDisposition,
    targetDisposition: RetentionDisposition,
    tier: RetentionTier,
    ageMillis: Count,
    payloadBytes: Count,
    decay: S.OptionFromNullOr(S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }))),
  }).pipe(
    $I.annoteSchema("RetentionRow", {
      description: "One visible accepted edge with orthogonal endpoint dispositions and advisory tier.",
    })
  )
) {}
/**
 * Disposition bucket; a row may belong to two distinct endpoint buckets.
 *
 * **Example** (Inspect RetentionGroup)
 *
 * ```ts
 * import { RetentionGroup } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionGroup)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetentionGroup extends S.Opaque<RetentionGroup, { readonly brand: unique symbol }>()(
  S.Struct({
    disposition: RetentionDisposition,
    count: Count,
    payloadBytes: Count,
  }).pipe(
    $I.annoteSchema("RetentionGroup", {
      description: "Disposition bucket; a row may belong to two distinct endpoint buckets.",
    })
  )
) {}
/**
 * Tier counts and canonical payload bytes for the selected report rows.
 *
 * **Example** (Inspect RetentionTierSummary)
 *
 * ```ts
 * import { RetentionTierSummary } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionTierSummary)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetentionTierSummary extends S.Opaque<RetentionTierSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    tier: RetentionTier,
    count: Count,
    payloadBytes: Count,
  }).pipe(
    $I.annoteSchema("RetentionTierSummary", {
      description: "Tier counts and canonical payload bytes for the selected report rows.",
    })
  )
) {}
/**
 * Canonical disposable report with explicit scope, measured pressure and calibration state.
 *
 * **Example** (Inspect RetentionReport)
 *
 * ```ts
 * import { RetentionReport } from "@beep/epistemic-domain/values/Retention"
 * console.log(RetentionReport)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetentionReport extends S.Opaque<RetentionReport, { readonly brand: unique symbol }>()(
  S.Struct({
    mechanism: S.tag("retention-v1"),
    query: RetentionQuery,
    candidatePolicy: S.OptionFromNullOr(RetentionPolicy),
    admission: RetentionPolicyAdmission,
    missingKeys: S.Array(LogicalEdgeKey),
    rows: S.Array(RetentionRow),
    dispositions: S.Array(RetentionGroup),
    tiers: S.Array(RetentionTierSummary),
    visibleCount: Count,
    payloadBytes: Count,
    pressureRatio: S.OptionFromNullOr(S.Finite.check(S.isGreaterThanOrEqualTo(0))),
  }).pipe(
    $I.annoteSchema("RetentionReport", {
      description: "Canonical disposable report with explicit scope, measured pressure and calibration state.",
    })
  )
) {}
