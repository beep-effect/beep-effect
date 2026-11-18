import * as Domain from "@alchemy.run/domain";
import { ChildRequested } from "@proto/runs-contract/Run/DelegateRun.command";
import { AgentRun } from "./AgentRun.aggregate.ts";

/**
 * A run's child gets its narrowed grant, then opens.
 *
 * @category policies
 * @since 0.0.0
 */
export class OpenChildOnRequest extends Domain.Policy(
  "OpenChildOnRequest",
  { from: AgentRun, on: [ChildRequested] },
  { description: "Ask the authority context to delegate the parent's narrowed terms to the child, then open it." },
) {}
