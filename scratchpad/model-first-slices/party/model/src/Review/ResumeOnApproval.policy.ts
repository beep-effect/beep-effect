import * as Domain from "@alchemy.run/domain";
import { ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { Claim } from "../Claim/Claim.aggregate.ts";

/**
 * The committed approval wakes the run that made the proposal.
 *
 * @category policies
 * @since 0.0.0
 */
export class ResumeOnApproval extends Domain.Policy(
  "ResumeOnApproval",
  { from: Claim, on: [ProposalApproved] },
  { description: "Wake the review run whose proposal a person approved, with the approval's id." },
) {}
