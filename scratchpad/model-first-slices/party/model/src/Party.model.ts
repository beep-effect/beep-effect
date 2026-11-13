import * as Domain from "@alchemy.run/domain";
import { Claim } from "./Claim/Claim.aggregate.ts";
import { ClaimReview } from "./Claim/ClaimReview.view.ts";
import { FindParties } from "./Directory/FindParties.query.ts";
import { PartyDirectory } from "./Directory/PartyDirectory.projection.ts";
import { EffectiveParty } from "./Party/EffectiveParty.view.ts";
import { MergeOnSameParty } from "./Party/MergeOnSameParty.policy.ts";
import { Party } from "./Party/Party.aggregate.ts";
import { ReviewAssist } from "./Review/ReviewAssist.saga.ts";
import { ResumeOnApproval } from "./Review/ResumeOnApproval.policy.ts";
import { ReviewOnRequest } from "./Review/ReviewOnRequest.policy.ts";

/**
 * The Party bounded context: one `Domain.Model`. It lists declarations only;
 * their handlers live in `.handler.ts` files, and `Party.handlers.ts` is
 * generated from this list.
 *
 * @category models
 * @since 0.0.0
 */
export class PartyModel extends Domain.Model(
  "Party",
  {
    aggregates: [Claim, Party],
    views: [ClaimReview, EffectiveParty],
    policies: [MergeOnSameParty, ReviewOnRequest, ResumeOnApproval],
    sagas: [ReviewAssist],
    projections: [PartyDirectory],
    queries: [FindParties],
  },
  { description: "Parties, claims about them, and the review that admits those claims." },
) {}
