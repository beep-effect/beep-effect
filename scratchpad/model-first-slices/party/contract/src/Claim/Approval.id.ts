import * as S from "effect/Schema";

/**
 * One approval: the committed fact a reviewer made, by its command id. A
 * waiting run is woken with this id and nothing else.
 *
 * **Example** (Brand an approval id)
 * ```ts
 * import { ApprovalId } from "@proto/party-contract/Claim/Approval.id";
 *
 * const approval = ApprovalId.make("cmd_123");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const ApprovalId = S.String.pipe(S.brand("ApprovalId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type ApprovalId = typeof ApprovalId.Type;
