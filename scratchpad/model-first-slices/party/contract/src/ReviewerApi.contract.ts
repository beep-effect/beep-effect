import * as Domain from "@alchemy.run/domain";
import { PartyCatalog } from "./Party.catalog.ts";

/**
 * The reviewer's client contract: the same RPC group as the model's
 * `ReviewerApi`, with no aggregate in its closure. Connect it with
 * `layerClientHttp(url)`, or `layerClient` over any protocol that speaks the
 * group.
 *
 * **Example** (A reviewer's client over HTTP)
 * ```ts
 * import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
 *
 * const client = ReviewerContract.layerClientHttp("https://practice.example/rpc");
 * ```
 *
 * @category contracts
 * @since 0.0.0
 */
export class ReviewerContract extends Domain.Api(
  "ReviewerContract",
  {
    model: PartyCatalog,
    commands: ["AcceptClaim", "RetractClaim", "ApproveProposal", "RequestReview", "MergeParties"],
    views: ["ClaimReview", "EffectiveParty"],
    queries: ["FindParties"],
    streams: [],
  },
  { description: "Review claims about parties, read them, and search the directory." },
) {}
