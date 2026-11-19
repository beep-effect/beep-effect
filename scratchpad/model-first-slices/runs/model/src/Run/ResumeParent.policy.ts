import * as Domain from "@alchemy.run/domain";
import { RunCancelled } from "@proto/runs-contract/Run/CancelRun.command";
import { RunCompleted } from "@proto/runs-contract/Run/CompleteRun.command";
import { RunExhausted } from "@proto/runs-contract/Run/ExhaustRun.command";
import { RunRejected } from "@proto/runs-contract/Run/RejectRun.command";
import * as S from "effect/Schema";
import { AgentRun } from "./AgentRun.aggregate.ts";

/**
 * The ways a run finishes that resume its parent, as one tagged union.
 *
 * **Example** (A finished run's outcome)
 * ```ts
 * import { ResumeParentTrigger } from "@proto/runs-model/Run/ResumeParent.policy";
 *
 * const outcomeOf = ResumeParentTrigger.matchOrElse({ RunCompleted: ({ outcome }) => outcome }, ({ _tag }) => _tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResumeParentTrigger = S.Union([RunCompleted, RunExhausted, RunCancelled, RunRejected]).pipe(S.toTaggedUnion("_tag"));

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
  { from: AgentRun, on: ResumeParentTrigger.members },
  { description: "Tell a finished child's parent, which settles the child's share and runs on." },
) {}
