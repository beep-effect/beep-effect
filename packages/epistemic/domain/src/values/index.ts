/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

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
