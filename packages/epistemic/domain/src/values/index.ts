/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Claim disposition status value exports.
 *
 * @example
 * ```ts
 * import { ClaimDispositionStatus } from "@beep/epistemic-domain/values"
 *
 * console.log(ClaimDispositionStatus.Enum.rejected)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./ClaimDispositionStatus/index.ts";
/**
 * Claim gate verdict value exports.
 *
 * @example
 * ```ts
 * import { ClaimGateSeverity } from "@beep/epistemic-domain/values"
 * import * as S from "effect/Schema"
 *
 * const severity = S.decodeUnknownSync(ClaimGateSeverity)("violation")
 * console.log(severity)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./ClaimGate/index.ts";
/**
 * Claim lifecycle value exports.
 *
 * @example
 * ```ts
 * import { ClaimLifecycle } from "@beep/epistemic-domain/values"
 *
 * console.log(ClaimLifecycle.Enum.admitted)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./ClaimLifecycle/index.ts";
/**
 * Claim projection read-model exports.
 *
 * @example
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

 * @category read-models
 * @since 0.0.0
 */
export * from "./ClaimProjection/index.ts";
/**
 * Edge endpoint value exports.
 *
 * @example
 * ```ts
 * import { EdgeEndpoint } from "@beep/epistemic-domain/values"
 * import * as S from "effect/Schema"
 *
 * const endpoint = S.decodeUnknownSync(EdgeEndpoint)({ kind: "claim", claimId: 1 })
 * console.log(endpoint.kind)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./EdgeEndpoint/index.ts";
/**
 * Edge relation vocabulary exports.
 *
 * @example
 * ```ts
 * import { EdgeRelation } from "@beep/epistemic-domain/values"
 *
 * console.log(EdgeRelation.Enum.supports)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./EdgeRelation/index.ts";
/**
 * Epistemic fixture-key value exports.
 *
 * @example
 * ```ts
 * import { EpistemicFixtureKey } from "@beep/epistemic-domain/values"
 *
 * console.log(EpistemicFixtureKey.make("claim.patentability"))
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./EpistemicFixtureKey/index.ts";
/**
 * Evidence span value exports.
 *
 * @example
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain/values"
 * import * as S from "effect/Schema"
 *
 * const confidence = S.decodeUnknownSync(Confidence)(0.88)
 * console.log(confidence)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./EvidenceSpan/index.ts";
/**
 * Execution grant value exports.
 *
 * @example
 * ```ts
 * import { SinkClass } from "@beep/epistemic-domain/values"
 *
 * console.log(SinkClass.Enum["network-egress"])
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./ExecutionGrant/index.ts";
/**
 * Execution ledger record value exports.
 *
 * @example
 * ```ts
 * import { ExecutionSettlement } from "@beep/epistemic-domain/values"
 *
 * console.log(ExecutionSettlement.Enum.completed)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./ExecutionRecord/index.ts";
/**
 * Execution verdict value exports.
 *
 * @example
 * ```ts
 * import { DenialReason } from "@beep/epistemic-domain/values"
 *
 * console.log(DenialReason.Enum["destination-not-granted"])
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./ExecutionVerdict/index.ts";
/**
 * Grant set value exports.
 *
 * @example
 * ```ts
 * import { DraftGrantSet } from "@beep/epistemic-domain/values"
 * import * as S from "effect/Schema"
 *
 * const draft = S.decodeUnknownSync(DraftGrantSet)({
 *   grants: [],
 *   policyRevision: "1.0.0",
 *   state: "draft"
 * })
 * console.log(draft.state)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./GrantSet/index.ts";
/**
 * Logical edge identity and digest exports.
 *
 * @example
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

 * @category value-objects
 * @since 0.0.0
 */
export * from "./LogicalEdgeIdentity/index.ts";
