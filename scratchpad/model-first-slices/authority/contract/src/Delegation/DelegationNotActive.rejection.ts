import * as S from "effect/Schema";
import { $AuthorityContractId } from "@proto/kernel/Identity";

const $I = $AuthorityContractId.create("Delegation/DelegationNotActive.rejection");

/**
 * Refused: the delegation is not active.
 *
 * @category rejections
 * @since 0.0.0
 */
export class DelegationNotActive extends S.TaggedError<DelegationNotActive, { readonly brand: unique symbol }>()(
  "DelegationNotActive",
  { status: S.Literals(["Unopened", "Revoked"]) },
  $I.annote("DelegationNotActive", { httpApiStatus: 409, description: "The delegation is not active." }),
) {}
