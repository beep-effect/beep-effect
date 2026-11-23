/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * **Example** (Create GrantRevisionMismatch error)
 *
 * ```ts
 * import { PolicyRevision } from "@beep/execution-authority-domain"
 * import { GrantRevisionMismatch } from "@beep/execution-authority-domain/values/GrantSet"
 * import * as S from "effect/Schema"
 *
 * const error = GrantRevisionMismatch.between(
 *   S.decodeUnknownSync(PolicyRevision)("1.0.0"),
 *   S.decodeUnknownSync(PolicyRevision)("2.0.0")
 * )
 * console.log(error.grantRevision)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./GrantSet.errors.ts";
/**
 * **Example** (Decode a DraftGrantSet)
 *
 * ```ts
 * import { DraftGrantSet } from "@beep/execution-authority-domain/values/GrantSet"
 * import * as S from "effect/Schema"
 *
 * const draft = S.decodeUnknownSync(DraftGrantSet)({
 *   grants: [],
 *   policyRevision: "1.0.0",
 *   state: "draft"
 * })
 * console.log(draft.state)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./GrantSet.model.ts";
