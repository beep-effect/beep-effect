import * as Domain from "@alchemy.run/domain";
import { RunCancelled } from "@proto/runs-contract/Run/CancelRun.command";
import { RunCompleted } from "@proto/runs-contract/Run/CompleteRun.command";
import { RunExhausted } from "@proto/runs-contract/Run/ExhaustRun.command";
import { RunRejected } from "@proto/runs-contract/Run/RejectRun.command";
import { AgentRun } from "./AgentRun.aggregate.ts";

/**
 * A child run that finished, whatever the way, resumes its parent: a child
 * refused mid-run (phase 7) included. A child whose grant was refused never
 * opened, and its parent hears of it through `RefuseChild` instead.
 *
 * @category policies
 * @since 0.0.0
 */
export class ResumeParent extends Domain.Policy(
  "ResumeParent",
  { from: AgentRun, on: [RunCompleted, RunExhausted, RunCancelled, RunRejected] },
  { description: "Tell a finished child's parent, which settles the child's share and runs on." },
) {}

