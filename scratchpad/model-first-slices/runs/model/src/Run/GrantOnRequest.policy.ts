import * as Domain from "@alchemy.run/domain";
import { RunRequested } from "@proto/runs-contract/Run/RequestRun.command";
import { AgentRun } from "./AgentRun.aggregate.ts";

/**
 * A requested run gets its grant from the authority context, then starts.
 *
 * @category policies
 * @since 0.0.0
 */
export class GrantOnRequest extends Domain.Policy(
  "GrantOnRequest",
  { from: AgentRun, on: [RunRequested] },
  { description: "Ask the authority context to grant a requested run, then activate or reject it." },
) {}
