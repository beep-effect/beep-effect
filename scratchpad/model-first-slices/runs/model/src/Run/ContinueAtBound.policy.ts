import * as Domain from "@alchemy.run/domain";
import { RunContinued } from "@proto/runs-contract/Run/RecordStep.command";
import { AgentRun } from "./AgentRun.aggregate.ts";

/**
 * A run at its history bound continues as a new run (D23).
 *
 * @category policies
 * @since 0.0.0
 */
export class ContinueAtBound extends Domain.Policy(
  "ContinueAtBound",
  { from: AgentRun, on: [RunContinued] },
  { description: "Delegate the bounded run's grant to the run it continues as, then open that run." },
) {}
