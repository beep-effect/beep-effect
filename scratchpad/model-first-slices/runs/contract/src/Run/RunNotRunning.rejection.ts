import { RunStatus } from "./RunStatus.ts";
import * as S from "effect/Schema";
import { $RunsContractId } from "@proto/kernel/Identity";

const $I = $RunsContractId.create("Run/RunNotRunning.rejection");

/**
 * Refused: the run is not in a state that takes this command.
 *
 * @category rejections
 * @since 0.0.0
 */
export class RunNotRunning extends S.TaggedError<RunNotRunning, { readonly brand: unique symbol }>()(
  "RunNotRunning",
  { status: RunStatus },
  $I.annote("RunNotRunning", { httpApiStatus: 409, description: "The run is not in a state that takes this command." }),
) {}
