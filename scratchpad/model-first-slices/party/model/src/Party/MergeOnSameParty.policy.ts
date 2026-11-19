import * as Domain from "@alchemy.run/domain";
import { ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import * as S from "effect/Schema";
import { Claim } from "../Claim/Claim.aggregate.ts";

/**
 * The claim decisions that may merge parties, as one tagged union: a direct
 * acceptance, or an approved review run's proposal.
 *
 * **Example** (Whether a decision accepted the claim)
 * ```ts
 * import { MergeOnSamePartyTrigger } from "@proto/party-model/Party/MergeOnSameParty.policy";
 *
 * const accepted = MergeOnSamePartyTrigger.match({
 *   ClaimAccepted: () => true,
 *   ProposalApproved: ({ outcome }) => outcome === "accepted",
 * });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MergeOnSamePartyTrigger = S.Union([ClaimAccepted, ProposalApproved]).pipe(S.toTaggedUnion("_tag"));

/**
 * When a `SameParty` claim is accepted (directly, or by approving a review
 * run's proposal to accept it), the absorbed party merges into the survivor.
 *
 * @category policies
 * @since 0.0.0
 */
export class MergeOnSameParty extends Domain.Policy(
  "MergeOnSameParty",
  { from: Claim, on: MergeOnSamePartyTrigger.members },
  { description: "Merge the parties an accepted SameParty claim names; record why when it cannot." },
) {}
