import * as Domain from "@alchemy.run/domain";
import { RunStatus } from "./RunStatus.ts";

/**
 * Refused: the run is not in a state that takes this command.
 *
 * @category rejections
 * @since 0.0.0
 */
export class RunNotRunning extends Domain.Rejection(
  "RunNotRunning",
  { status: RunStatus },
  { httpApiStatus: 409, description: "The run is not in a state that takes this command." },
) {}
