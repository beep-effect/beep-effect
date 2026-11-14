import * as S from "effect/Schema";
import { $PartyContractId } from "@proto/kernel/Identity";

const $I = $PartyContractId.create("Claim/ClaimNotPending.rejection");

/**
 * Refused: the claim is not waiting for a decision. Shared by every command
 * that acts on a pending claim, so it gets its own file.
 *
 * **Example** (Refuse a decision on an accepted claim)
 * ```ts
 * import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
 *
 * const refusal = ClaimNotPending.make({ status: "Accepted" });
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class ClaimNotPending extends S.TaggedError<ClaimNotPending, { readonly brand: unique symbol }>()(
  "ClaimNotPending",
  { status: S.Literals(["Unasserted", "Accepted", "Retracted"]) },
  $I.annote("ClaimNotPending", { httpApiStatus: 409, description: "The claim is not pending, so it cannot be decided." }),
) {}
