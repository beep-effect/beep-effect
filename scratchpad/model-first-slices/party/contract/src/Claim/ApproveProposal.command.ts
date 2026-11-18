import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Count, Sequence } from "@proto/kernel/Measure";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { Proposition } from "../Proposition.ts";
import { AdmissionGateUnmet } from "./AcceptClaim.command.ts";
import { ApprovalId } from "./Approval.id.ts";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";
import { DecisionScope } from "./DecisionScope.ts";
import { $PartyContractId } from "@proto/kernel/Identity";

const $I = $PartyContractId.create("Claim/ApproveProposal.command");

/**
 * Refused: approval is a person's act. An agent-rooted invocation, or one a
 * process or agent is operating, cannot approve.
 *
 * @category rejections
 * @since 0.0.0
 */
export class HumanApprovalRequired extends S.TaggedError<HumanApprovalRequired, { readonly brand: unique symbol }>()(
  "HumanApprovalRequired",
  {},
  $I.annote("HumanApprovalRequired", { httpApiStatus: 403, description: "Only a person, signed in and acting directly, may approve a proposal." }),
) {}

/**
 * Refused: the approval does not name the proposal the claim holds now.
 *
 * @category rejections
 * @since 0.0.0
 */
export class ProposalMismatch extends S.TaggedError<ProposalMismatch, { readonly brand: unique symbol }>()(
  "ProposalMismatch",
  { reason: S.Literals(["no-proposal", "digest", "evidence-revision"]) },
  $I.annote("ProposalMismatch", { httpApiStatus: 409, description: "The approval names a proposal or evidence revision the claim no longer holds." }),
) {}

/**
 * The fact: a person approved the run's proposal, as read. It decides the
 * claim (accepted or retracted, per the proposal) and wakes the run.
 *
 * @category events
 * @since 0.0.0
 */
export class ProposalApproved extends Domain.Event(
  "ProposalApproved",
  carry({
    approval: ApprovalId,
    run: RunId,
    digest: S.String,
    evidenceRevision: Sequence,
    outcome: S.Literals(["accepted", "retracted"]),
    proposition: Proposition,
    // Widened in phase 3 (D22): every stored integer still reads; absent is stored as `null`.
    corroboration: S.OptionFromNullOr(Count),
    // Added in phase 9 (D43): the decision's scope, absent on events stored before it.
    ...DecisionScope,
  }),
  { description: "A person approved the agent run's proposal as read. It decides the claim, accepted or retracted as the proposal said, and wakes the run." },
) {}

/**
 * Approve the proposal a review run made, naming its digest and the evidence
 * revision it was made against.
 *
 * @category commands
 * @since 0.0.0
 */
export class ApproveProposal extends Domain.Command(
  "ApproveProposal",
  {
    target: ClaimId,
    middleware: [Session],
    input: { digest: S.String, evidenceRevision: Sequence },
    events: [ProposalApproved],
    rejects: [HumanApprovalRequired, MissingGrant, ClaimNotPending, ProposalMismatch, AdmissionGateUnmet],
  },
  { description: "Approve a review run's proposal, as read: its digest and evidence revision." },
) {}
