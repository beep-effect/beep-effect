import * as S from "effect/Schema";
import { $RunsContractId } from "@proto/kernel/Identity";

const $I = $RunsContractId.create("Run/BudgetExceeded.rejection");

/**
 * Refused: the run's remaining allowance does not cover the request.
 *
 * @category rejections
 * @since 0.0.0
 */
export class BudgetExceeded extends S.TaggedError<BudgetExceeded, { readonly brand: unique symbol }>()(
  "BudgetExceeded",
  { requested: S.Int, remaining: S.Int },
  $I.annote("BudgetExceeded", { httpApiStatus: 409, description: "The run's remaining allowance does not cover this." }),
) {}
