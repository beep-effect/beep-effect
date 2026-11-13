import * as Domain from "@alchemy.run/domain";
import { ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { ClaimRetracted } from "@proto/party-contract/Claim/RetractClaim.command";
import { ClaimFeed } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { ClaimReview } from "../Claim/ClaimReview.view.ts";
import { PartyFacts } from "./PartyFacts.stream.ts";

/**
 * Translates a claim's private decision events into the published fact. It
 * reads the review view's state after the event, so the fact can name the
 * claim's org and review runs without the private events carrying them.
 *
 * @category projections
 * @since 0.0.0
 */
export class ClaimFacts extends Domain.Projection(
  "ClaimFacts",
  {
    from: [ClaimReview],
    key: ClaimFeed,
    keyOf: { ClaimReview: () => "claims" as const },
    on: [ClaimAccepted, ClaimRetracted, ProposalApproved],
    writes: [PartyFacts],
  },
  { description: "Publish ClaimDecided, versions 1 and 2, when a claim is decided." },
) {}
