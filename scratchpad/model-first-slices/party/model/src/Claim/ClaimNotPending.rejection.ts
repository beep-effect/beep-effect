import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";

/**
 * Refused: the claim is not waiting for a decision. Shared by every command
 * that acts on a pending claim, so it gets its own file.
 *
 * **Example** (Refuse a decision on an accepted claim)
 * ```ts
 * import { ClaimNotPending } from "@proto/party/Claim/ClaimNotPending.rejection";
 *
 * const refusal = new ClaimNotPending({ status: "Accepted" });
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class ClaimNotPending extends Domain.Rejection(
  "ClaimNotPending",
  { status: S.Literals(["Unasserted", "Accepted", "Retracted"]) },
  { httpApiStatus: 409, description: "The claim is not pending, so it cannot be decided." },
) {}
