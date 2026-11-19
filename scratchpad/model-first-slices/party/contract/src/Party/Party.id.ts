import * as S from "effect/Schema";
import { IdText } from "@proto/kernel/Measure";

/**
 * A party: a person or organization the practice deals with.
 *
 * **Example** (Brand a party id)
 * ```ts
 * import { PartyId } from "@proto/party-contract/Party/Party.id";
 *
 * const dana = PartyId.make("party_dana");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const PartyId = IdText.pipe(S.brand("PartyId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type PartyId = typeof PartyId.Type;
