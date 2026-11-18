import * as Domain from "@alchemy.run/domain";
import { RunsModel } from "./Runs.model.ts";

/**
 * What a person's client reaches: request and cancel runs, read a session.
 * Runs report through the runs host's gateway, as themselves.
 *
 * @category apis
 * @since 0.0.0
 */
export class RunsApi extends Domain.Api(
  "RunsApi",
  { model: RunsModel, commands: ["RequestRun", "CancelRun"], views: ["SessionRuns"], queries: [], streams: [] },
  { description: "Request and cancel agent runs, and read a session's chain of runs." },
) {}
