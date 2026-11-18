import * as Domain from "@alchemy.run/domain";
import { ReviewRequested } from "@proto/party-contract/Claim/ReviewRequested.event";
import { Claim } from "../Claim/Claim.aggregate.ts";

/**
 * Every requested review opens a run and starts its executor.
 *
 * @category policies
 * @since 0.0.0
 */
export class ReviewOnRequest extends Domain.Policy(
  "ReviewOnRequest",
  { from: Claim, on: [ReviewRequested] },
  { description: "Open a review run under a delegation from the requester, then start its executor." },
) {}
