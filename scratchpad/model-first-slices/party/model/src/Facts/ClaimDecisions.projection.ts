import * as Domain from "@alchemy.run/domain";
import { ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { ClaimRetracted } from "@proto/party-contract/Claim/RetractClaim.command";
import { ClaimFeed } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { Claim } from "../Claim/Claim.aggregate.ts";
import { PartyFacts2 } from "./PartyFacts2.stream.ts";

/**
 * Translates a claim's decision events into the published fact. It reads the
 * claim's own events, never a view (D43): a view's version bump cannot change
 * its generation, so it is never rebuilt behind the stream it writes.
 *
 * @category projections
 * @since 0.0.0
 */
export class ClaimDecisions extends Domain.Projection(
  "ClaimDecisions",
  {
    from: [Claim],
    key: ClaimFeed,
    keyOf: { Claim: () => "claims" as const },
    on: [ClaimAccepted, ClaimRetracted, ProposalApproved],
    writes: [PartyFacts2],
  },
  { description: "Publish ClaimDecided, versions 1 and 2, when a claim is decided, from the claim's events." },
) {}
