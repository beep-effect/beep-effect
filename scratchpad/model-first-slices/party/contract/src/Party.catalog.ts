import * as Catalog from "@proto/contract-kit/Catalog";
import { AcceptClaim } from "./Claim/AcceptClaim.command.ts";
import { AddEvidence } from "./Claim/AddEvidence.command.ts";
import { ApproveProposal } from "./Claim/ApproveProposal.command.ts";
import { AssertClaim } from "./Claim/AssertClaim.command.ts";
import { ClaimReviewRead } from "./Claim/ClaimReview.read.ts";
import { ProposeDisposition } from "./Claim/ProposeDisposition.command.ts";
import { RequestReview } from "./Claim/RequestReview.command.ts";
import { RetractClaim } from "./Claim/RetractClaim.command.ts";
import { FindPartiesRead } from "./Directory/FindParties.read.ts";
import { EffectivePartyRead } from "./Party/EffectiveParty.read.ts";
import { MergeParties } from "./Party/MergeParties.command.ts";
import { RegisterParty } from "./Party/RegisterParty.command.ts";

/**
 * Everything of Party a client can call, with no aggregate behind it. The
 * contract Apis are declared over this catalog.
 *
 * @category contracts
 * @since 0.0.0
 */
export const PartyCatalog = Catalog.make({
  name: "Party",
  commands: [
    AssertClaim,
    ProposeDisposition,
    AcceptClaim,
    RetractClaim,
    AddEvidence,
    RequestReview,
    ApproveProposal,
    RegisterParty,
    MergeParties,
  ],
  views: [ClaimReviewRead, EffectivePartyRead],
  queries: [FindPartiesRead],
});
