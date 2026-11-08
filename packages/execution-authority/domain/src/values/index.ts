/**
 * Execution authority value objects: grants, grant sets and verdicts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Execution grant value exports.
 *
 * **Example** (Log network-egress sink class)
 *
 * ```ts
 * import { SinkClass } from "@beep/execution-authority-domain/values"
 *
 * console.log(SinkClass.Enum["network-egress"])
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ExecutionGrant/index.ts";
/**
 * Execution verdict value exports.
 *
 * **Example** (Log denial reason enum)
 *
 * ```ts
 * import { DenialReason } from "@beep/execution-authority-domain/values"
 *
 * console.log(DenialReason.Enum["destination-not-granted"])
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ExecutionVerdict/index.ts";
/**
 * Grant set value exports.
 *
 * **Example** (Decode draft grant set)
 *
 * ```ts
 * import { DraftGrantSet } from "@beep/execution-authority-domain/values"
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
export * from "./GrantSet/index.ts";
