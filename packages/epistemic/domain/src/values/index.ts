/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Exact claim evidence and human-review explanation models.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ClaimEvidenceReview/index.ts";
/**
 * Claim lifecycle value exports.
 *
 * **Example** (Log admitted lifecycle status)
 *
 * ```ts
 * import { ClaimLifecycle } from "@beep/epistemic-domain/values"
 *
 * console.log(ClaimLifecycle.Enum.admitted)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ClaimLifecycle/index.ts";
/**
 * Claim projection read-model exports.
 *
 * **Example** (Decode claim state counts)
 *
 * ```ts
 * import { ClaimStateCounts } from "@beep/epistemic-domain/values"
 * import * as S from "effect/Schema"
 *
 * const counts = S.decodeUnknownSync(ClaimStateCounts)({
 *   admitted: 1,
 *   candidate: 2,
 *   consistency_checked: 0,
 *   shape_valid: 1
 * })
 * console.log(counts.admitted)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export * from "./ClaimProjection/index.ts";
/**
 * Contradiction identity, assessment, and disposition value exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./Contradiction/index.ts";
/**
 * Caller-populated contradiction detection inputs and sealed output content.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ContradictionDetection/index.ts";
/**
 * Edge endpoint value exports.
 *
 * **Example** (Decode claim edge endpoint)
 *
 * ```ts
 * import { EdgeEndpoint } from "@beep/epistemic-domain/values"
 * import * as S from "effect/Schema"
 *
 * const endpoint = S.decodeUnknownSync(EdgeEndpoint)({ kind: "claim", claimId: 1 })
 * console.log(endpoint.kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./EdgeEndpoint/index.ts";
/**
 * Epistemic fixture-key value exports.
 *
 * **Example** (Create epistemic fixture key)
 *
 * ```ts
 * import { EpistemicFixtureKey } from "@beep/epistemic-domain/values"
 *
 * console.log(EpistemicFixtureKey.make("claim.patentability"))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./EpistemicFixtureKey/index.ts";
/**
 * Evidence-verification manifestation value exports.
 *
 * **Example** (Validate manifestation key length)
 *
 * ```ts
 * import { EvidenceVerificationManifestationKey } from "@beep/epistemic-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EvidenceVerificationManifestationKey)("a".repeat(64)))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./EvidenceVerification/index.ts";
/**
 * Logical edge identity and digest exports.
 *
 * **Example** (Decode logical edge identity)
 *
 * ```ts
 * import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values"
 * import * as S from "effect/Schema"
 *
 * const identity = S.decodeUnknownSync(LogicalEdgeIdentity)({
 *   evidenceScope: null,
 *   matterScope: null,
 *   orgScope: "1",
 *   qualifiers: {},
 *   relation: "supports",
 *   source: { kind: "claim", claimId: 1 },
 *   target: { kind: "claim", claimId: 2 }
 * })
 * console.log(logicalEdgeKey(identity).length)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./LogicalEdgeIdentity/index.ts";
