import * as S from "effect/Schema";
import { $AuthorityContractId } from "@proto/kernel/Identity";

const $I = $AuthorityContractId.create("Delegation/NotDelegator.rejection");

/**
 * Refused: only the human who delegated may narrow or revoke the delegation.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotDelegator extends S.TaggedError<NotDelegator, { readonly brand: unique symbol }>()(
  "NotDelegator",
  {},
  $I.annote("NotDelegator", { httpApiStatus: 403, description: "Only the human who delegated may change the delegation." }),
) {}
