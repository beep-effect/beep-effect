/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Grant set construction error exports.
 *
 * @example
 * ```ts
 * import { PolicyRevision } from "@beep/epistemic-domain"
 * import { GrantRevisionMismatch } from "@beep/epistemic-domain/values/GrantSet"
 * import * as S from "effect/Schema"
 *
 * const error = GrantRevisionMismatch.between(
 *   S.decodeUnknownSync(PolicyRevision)("1.0.0"),
 *   S.decodeUnknownSync(PolicyRevision)("2.0.0")
 * )
 * console.log(error.grantRevision)
 * ```

 * @category errors
 * @since 0.0.0
 */
export * from "./GrantSet.errors.ts";
/**
 * Grant set model exports.
 *
 * @example
 * ```ts
 * import { DraftGrantSet } from "@beep/epistemic-domain/values/GrantSet"
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
export * from "./GrantSet.model.ts";
