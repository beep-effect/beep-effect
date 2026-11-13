import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";

/**
 * Refused: the delegation is not active.
 *
 * @category rejections
 * @since 0.0.0
 */
export class DelegationNotActive extends Domain.Rejection(
  "DelegationNotActive",
  { status: S.Literals(["Unopened", "Revoked"]) },
  { httpApiStatus: 409, description: "The delegation is not active." },
) {}
