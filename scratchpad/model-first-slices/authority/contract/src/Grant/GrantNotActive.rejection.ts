import * as S from "effect/Schema";
import { $AuthorityContractId } from "@proto/kernel/Identity";

const $I = $AuthorityContractId.create("Grant/GrantNotActive.rejection");

/**
 * Refused: the grant is not active, so it cannot change or be delegated.
 *
 * @category rejections
 * @since 0.0.0
 */
export class GrantNotActive extends S.TaggedError<GrantNotActive, { readonly brand: unique symbol }>()(
  "GrantNotActive",
  { status: S.Literals(["Unissued", "Revoked", "Expired"]) },
  $I.annote("GrantNotActive", { httpApiStatus: 409, description: "The grant is not active." }),
) {}
