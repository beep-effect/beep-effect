import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";

/**
 * Refused: the grant is not active, so it cannot change or be delegated.
 *
 * @category rejections
 * @since 0.0.0
 */
export class GrantNotActive extends Domain.Rejection(
  "GrantNotActive",
  { status: S.Literals(["Unissued", "Revoked", "Expired"]) },
  { httpApiStatus: 409, description: "The grant is not active." },
) {}
