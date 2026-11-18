import * as Domain from "@alchemy.run/domain";
import { ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { Claim } from "../Claim/Claim.aggregate.ts";

/**
 * When a `SameParty` claim is accepted (directly, or by approving a review
 * run's proposal to accept it), the absorbed party merges into the survivor.
 *
 * @category policies
 * @since 0.0.0
 */
export class MergeOnSameParty extends Domain.Policy(
  "MergeOnSameParty",
  { from: Claim, on: [ClaimAccepted, ProposalApproved] },
  { description: "Merge the parties an accepted SameParty claim names; record why when it cannot." },
) {}
