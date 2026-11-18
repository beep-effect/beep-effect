import * as Domain from "@alchemy.run/domain";
import { PartyModel } from "./Party.model.ts";

/**
 * What a reviewer reaches. Every kind is listed: a kind left out is served
 * whole. Who may call each entry is a grant, checked where it is decided.
 *
 * @category apis
 * @since 0.0.0
 */
export class ReviewerApi extends Domain.Api(
  "ReviewerApi",
  {
    model: PartyModel,
    commands: ["AcceptClaim", "RetractClaim", "ApproveProposal", "RequestReview", "MergeParties"],
    views: ["ClaimReview", "EffectiveParty"],
    queries: ["FindParties"],
    streams: [],
  },
  { description: "Review claims about parties, read them, and search the directory." },
) {}
