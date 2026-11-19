import * as S from "effect/Schema";
import { IdText } from "@proto/kernel/Measure";

/**
 * A claim: one proposition about parties, with the evidence for it.
 *
 * **Example** (Brand a claim id)
 * ```ts
 * import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
 *
 * const claim = ClaimId.make("claim_1");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const ClaimId = IdText.pipe(S.brand("ClaimId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type ClaimId = typeof ClaimId.Type;
