import * as Domain from "@alchemy.run/domain";
import { Claim } from "./Claim/Claim.aggregate.ts";
import { ClaimReview } from "./Claim/ClaimReview.view.ts";
import { FindParties } from "./Directory/FindParties.query.ts";
import { PartyDirectory } from "./Directory/PartyDirectory.projection.ts";
import { ClaimDecisions } from "./Facts/ClaimDecisions.projection.ts";
import { PartyFacts } from "./Facts/PartyFacts.stream.ts";
import { PartyFacts2 } from "./Facts/PartyFacts2.stream.ts";
import { EffectiveParty } from "./Party/EffectiveParty.view.ts";
import { MergeOnSameParty } from "./Party/MergeOnSameParty.policy.ts";
import { Party } from "./Party/Party.aggregate.ts";
import { ReviewAssist } from "./Review/ReviewAssist.saga.ts";
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
    policies: [MergeOnSameParty, ReviewOnRequest],
    sagas: [ReviewAssist],
    projections: [PartyDirectory, ClaimDecisions],
    // Published facts: generation 1 (closed) and generation 2 (StreamPins.ts).
    streams: [PartyFacts, PartyFacts2],
    queries: [FindParties],
  },
  { description: "Parties, claims about them, and the review that admits those claims." },
) {}
