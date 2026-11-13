import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { Claim } from "./Claim/Claim.aggregate.ts";
import { ClaimReview } from "./Claim/ClaimReview.view.ts";
import { FindParties } from "./Directory/FindParties.query.ts";
import { PartyDirectory } from "./Directory/PartyDirectory.projection.ts";
import { EffectiveParty } from "./Party/EffectiveParty.view.ts";
import { MergeOnSameParty } from "./Party/MergeOnSameParty.policy.ts";
import { Party } from "./Party/Party.aggregate.ts";
import { ReviewAssist } from "./Review/ReviewAssist.saga.ts";
import { ReviewOnAssertion } from "./Review/ReviewOnAssertion.policy.ts";

/**
 * The Party bounded context: one `Domain.Model`. It lists declarations only;
 * their handlers live in `.live.ts` files and meet the model in `Handlers.ts`.
 *
 * @category models
 * @since 0.0.0
 */
export class PartyModel extends Domain.Model(
  "Party",
  {
    aggregates: [Claim, Party],
    views: [ClaimReview, EffectiveParty],
    policies: [MergeOnSameParty, ReviewOnAssertion],
    sagas: [ReviewAssist],
    projections: [PartyDirectory],
    queries: [FindParties],
  },
  { description: "Parties, claims about them, and the review that admits those claims." },
) {}
