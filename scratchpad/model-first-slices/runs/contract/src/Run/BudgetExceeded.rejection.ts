import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";

/**
 * Refused: the run's remaining allowance does not cover the request.
 *
 * @category rejections
 * @since 0.0.0
 */
export class BudgetExceeded extends Domain.Rejection(
  "BudgetExceeded",
  { requested: S.Int, remaining: S.Int },
  { httpApiStatus: 409, description: "The run's remaining allowance does not cover this." },
) {}
