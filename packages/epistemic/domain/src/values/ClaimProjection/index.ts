/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Claim projection read-model exports.
 *
 * **Example** (Decode a ClaimProjectionView)
 *
 * ```ts
 * import { ClaimProjectionView } from "@beep/epistemic-domain/values/ClaimProjection"
 * import * as S from "effect/Schema"
 *
 * const view = S.decodeUnknownSync(ClaimProjectionView)({
 *   admittedKeys: ["claim.patentability"],
 *   counts: { admitted: 1, candidate: 2, consistency_checked: 0, shape_valid: 1 },
 *   total: 4
 * })
 * console.log(view.admittedKeys)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export * from "./ClaimProjectionView.model.ts";
