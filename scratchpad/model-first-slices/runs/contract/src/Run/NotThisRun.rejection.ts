import * as Domain from "@alchemy.run/domain";

/**
 * Refused: only the run itself, re-admitted under its own delegation, reports
 * its budget, steps and outcome.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotThisRun extends Domain.Rejection(
  "NotThisRun",
  {},
  { httpApiStatus: 403, description: "Only the run itself may report on this run." },
) {}
