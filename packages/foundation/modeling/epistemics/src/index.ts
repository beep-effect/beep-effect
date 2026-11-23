/**
 * Package entry point for `@beep/epistemics`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Scoped admission verification and historical claim eligibility.
 *
 * **Example** (Inspect source resolution cases)
 *
 * ```ts
 * import { SourceResolution } from "@beep/epistemics/Admission"
 * console.log(SourceResolution.cases.Missing.make({}))
 * ```
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./Admission.ts";
/**
 * Total owner coordinates and codec-checked update arrows.
 *
 * **Example** (Inspect a refusal coordinate)
 *
 * ```ts
 * import { InvalidAssessment } from "@beep/epistemics/Assessments"
 * console.log(InvalidAssessment.make({ coordinate: "review", issue: "Invalid input" }).coordinate)
 * ```
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./Assessments.ts";
/**
 * Review coordinates, evidence signals and valid-time vocabulary for claim owners.
 *
 * **Example** (Unknown valid time is never selected)
 *
 * ```ts
 * import { ValidTime, validAt } from "@beep/epistemics/Claim"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(validAt(ValidTime.cases.Unknown.make({}), DateTime.makeUnsafe(1_000)))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./Claim/index.ts";
/**
 * Immutable claim core schemas and checked identity arrows.
 *
 * **Example** (Read claim stances)
 *
 * ```ts
 * import { Stance } from "@beep/epistemics/ClaimCore"
 * console.log(Stance.literals)
 * ```
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./ClaimCore.ts";
/**
 * Claim disposition status value exports.
 *
 * **Example** (Log rejected disposition status)
 *
 * ```ts
 * import { ClaimDispositionStatus } from "@beep/epistemics/ClaimDispositionStatus"
 *
 * console.log(ClaimDispositionStatus.Enum.rejected)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ClaimDispositionStatus/index.ts";
/**
 * Exact claim evidence and human-review schema factories.
 *
 * **Example** (Bind an evidence basis)
 *
 * ```ts
 * import { makeClaimEvidenceBasis } from "@beep/epistemics/ClaimEvidenceReview"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const { ClaimEvidenceBasisSchema } = makeClaimEvidenceBasis({
 *   $I: $ScratchpadId.create("party/ClaimEvidenceReview"),
 *   claimRef: S.NonEmptyString
 * })
 * console.log(Object.keys(ClaimEvidenceBasisSchema.fields).length) // 5
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./ClaimEvidenceReview/index.ts";
/**
 * Claim gate verdict value exports.
 *
 * **Example** (Decode gate severity value)
 *
 * ```ts
 * import { ClaimGateSeverity } from "@beep/epistemics/ClaimGate"
 * import * as S from "effect/Schema"
 *
 * const severity = S.decodeUnknownSync(ClaimGateSeverity)("violation")
 * console.log(severity)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ClaimGate/index.ts";
/**
 * Historical claim imports and explicit identifier namespaces.
 *
 * **Example** (Index an imported claim reference)
 *
 * ```ts
 * import { ClaimReference, claimReferenceKey } from "@beep/epistemics/ClaimImport.schema"
 * console.log(claimReferenceKey(ClaimReference.cases.Imported.make({ ledger: "kb", oldId: "claim-1" })))
 * ```
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./ClaimImport.schema.ts";
/**
 * Lawful immutable append projections and derivation closure.
 *
 * **Example** (Check an empty log)
 *
 * ```ts
 * import { checkClaimLog } from "@beep/epistemics/ClaimLog"
 * console.log(checkClaimLog([]))
 * ```
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./ClaimLog.ts";
/**
 * Claim projection read-model schema factories.
 *
 * **Example** (Bind claim state counts)
 *
 * ```ts
 * import { makeClaimStateCounts } from "@beep/epistemics/ClaimProjection"
 * import { $ScratchpadId } from "@beep/identity/packages"
 *
 * const { ClaimStateCountsSchema } = makeClaimStateCounts({ $I: $ScratchpadId.create("party/ClaimProjection") })
 * console.log(Object.keys(ClaimStateCountsSchema.fields).length) // 4
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./ClaimProjection/index.ts";
/**
 * Reported confidence scalar for measurement payloads.
 *
 * **Example** (Read a reported confidence)
 *
 * ```ts
 * import { Confidence } from "@beep/epistemics/Confidence"
 * console.log(Confidence.make(1))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Confidence.ts";
/**
 * Contradiction-candidate schema factories, seals and arbitraries.
 *
 * **Example** (Bind the contradiction vocabulary)
 *
 * ```ts
 * import { makeContradictionVocabulary } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 *
 * const vocabulary = makeContradictionVocabulary({ $I: $ScratchpadId.create("party/Contradiction") })
 * console.log(vocabulary.ContradictionDispositionStatus.Enum.rejected) // "rejected"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./Contradiction/index.ts";
/**
 * Contradiction-detection input, sealed output and proposal identity factories.
 *
 * **Example** (Encode canonical detection JSON)
 *
 * ```ts
 * import { canonicalDetectionJson } from "@beep/epistemics/ContradictionDetection"
 *
 * console.log(canonicalDetectionJson({ b: 1, a: 2 })) // {"a":2,"b":1}
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./ContradictionDetection/index.ts";
/**
 * Edge endpoint schema factory and endpoint key encoding.
 *
 * **Example** (Encode an endpoint key)
 *
 * ```ts
 * import { encodeEdgeEndpointKey } from "@beep/epistemics/EdgeEndpoint"
 *
 * console.log(encodeEdgeEndpointKey({ kind: "evidence", evidenceId: 7 })) // "evidence:7"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./EdgeEndpoint/index.ts";
/**
 * Edge relation vocabulary exports.
 *
 * **Example** (Log supports edge relation)
 *
 * ```ts
 * import { EdgeRelation } from "@beep/epistemics/EdgeRelation"
 *
 * console.log(EdgeRelation.Enum.supports)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./EdgeRelation/index.ts";
/**
 * Current evidence positions and their independent extraction observations.
 *
 * **Example** (Inspect the current format)
 *
 * ```ts
 * import { EvidencePosition } from "@beep/epistemics/EvidencePosition.schema"
 * console.log(EvidencePosition.fields.version)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./EvidencePosition.schema.ts";
/**
 * Evidence-verification manifestation schema factory and digest.
 *
 * **Example** (Bind a manifestation key)
 *
 * ```ts
 * import { makeEvidenceVerification } from "@beep/epistemics/EvidenceVerification"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const { EvidenceVerificationManifestationKey } = makeEvidenceVerification({
 *   $I: $ScratchpadId.create("party/EvidenceVerification"),
 *   ids: { evidence: S.String.pipe(S.brand("EvidenceId")) }
 * })
 * console.log(S.is(EvidenceVerificationManifestationKey)("a".repeat(64))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./EvidenceVerification/index.ts";
/**
 * Transaction-time interval exports.
 *
 * **Example** (Check whether a record is current)
 *
 * ```ts
 * import { KnowledgeInterval, knownAt } from "@beep/epistemics/KnowledgeInterval"
 * import * as DateTime from "effect/DateTime"
 * import * as S from "effect/Schema"
 *
 * const interval = S.decodeUnknownSync(KnowledgeInterval)({ expiredAt: null, recordedAt: 1_000 })
 * console.log(knownAt(interval, DateTime.makeUnsafe(5_000))) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./KnowledgeInterval/index.ts";
/**
 * Logical edge identity schema factory and digest.
 *
 * **Example** (Bind logical edge identity schemas)
 *
 * ```ts
 * import { makeEdgeEndpoint, makeLogicalEdgeIdentity } from "@beep/epistemics/LogicalEdgeIdentity"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const { EdgeEndpoint } = makeEdgeEndpoint({
 *   $I: $ScratchpadId.create("party/EdgeEndpoint"),
 *   ids: { candidateClaim: S.String.pipe(S.brand("ClaimId")), evidence: S.String.pipe(S.brand("EvidenceId")) }
 * })
 * const { LogicalEdgeKey } = makeLogicalEdgeIdentity({ $I: $ScratchpadId.create("party/LogicalEdgeIdentity"), EdgeEndpoint })
 * console.log(S.is(LogicalEdgeKey)("a".repeat(64))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./LogicalEdgeIdentity/index.ts";
/**
 * Valid-time interval exports.
 *
 * **Example** (Check whether a fact holds)
 *
 * ```ts
 * import { holdsAt, ValidInterval } from "@beep/epistemics/ValidInterval"
 * import * as DateTime from "effect/DateTime"
 * import * as S from "effect/Schema"
 *
 * const interval = S.decodeUnknownSync(ValidInterval)({ validFrom: 1_000, validTo: 2_000 })
 * console.log(holdsAt(interval, DateTime.makeUnsafe(2_000))) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ValidInterval/index.ts";
/**
 * Shared factory parameter types.
 *
 * **Example** (Type a factory identity parameter)
 *
 * ```ts
 * import type { SchemaIdentity } from "@beep/epistemics/Factory"
 * import { $ScratchpadId } from "@beep/identity/packages"
 *
 * const $I: SchemaIdentity = $ScratchpadId.create("party/Claim")
 * console.log($I.make("Claim"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type * from "./Factory/index.ts";
