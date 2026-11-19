import * as Domain from "@alchemy.run/domain";
import * as Catalog from "@proto/contract-kit/Catalog";
import { CancelRun } from "./Run/CancelRun.command.ts";
import { RequestRun } from "./Run/RequestRun.command.ts";
import { RunStateRead } from "./Run/RunState.read.ts";
import { SessionRunsRead } from "./Run/SessionRuns.read.ts";

/**
 * Everything of the runs context a person's client can call, with no aggregate behind it.
 *
 * @category contracts
 * @since 0.0.0
 */
export const RunsCatalog = Catalog.make({
  name: "Runs",
  commands: [RequestRun, CancelRun],
  views: [SessionRunsRead],
  queries: [RunStateRead],
});

/**
 * The runs context's client contract: the same RPC group as the model's `RunsApi`.
 *
 * @category contracts
 * @since 0.0.0
 */
export class RunsContract extends Domain.Api(
  "RunsContract",
  { model: RunsCatalog, commands: ["RequestRun", "CancelRun"], views: ["SessionRuns"], queries: ["RunState"], streams: [] },
  { description: "Request and cancel agent runs, read a session's chain of runs, and read a run's status." },
) {}
