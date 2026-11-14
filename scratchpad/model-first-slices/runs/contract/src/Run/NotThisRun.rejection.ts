import * as S from "effect/Schema";
import { $RunsContractId } from "@proto/kernel/Identity";

const $I = $RunsContractId.create("Run/NotThisRun.rejection");

/**
 * Refused: only the run itself, re-admitted under its own delegation, reports
 * its budget, steps and outcome.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotThisRun extends S.TaggedError<NotThisRun, { readonly brand: unique symbol }>()(
  "NotThisRun",
  {},
  $I.annote("NotThisRun", { httpApiStatus: 403, description: "Only the run itself may report on this run." }),
) {}
