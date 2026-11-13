// Generated from PartyModel by scripts/handlers.ts. Do not edit:
// `bun run handlers` rewrites it, and `bun run handlers --check` fails on drift.
import * as Layer from "effect/Layer";
import { ClaimReviewLive } from "./Claim/ClaimReview.handler.ts";
import { FindPartiesLive } from "./Directory/FindParties.handler.ts";
import { PartyDirectoryLive } from "./Directory/PartyDirectory.handler.ts";
import { ClaimFactsLive } from "./Facts/ClaimFacts.handler.ts";
import { EffectivePartyLive } from "./Party/EffectiveParty.handler.ts";
import { MergeOnSamePartyLive } from "./Party/MergeOnSameParty.handler.ts";
import { ReviewAssistLive } from "./Review/ReviewAssist.handler.ts";
import { ReviewOnRequestLive } from "./Review/ReviewOnRequest.handler.ts";

/**
 * Every handler PartyModel needs, as one Layer, in model order.
 *
 * @category handlers
 * @since 0.0.0
 */
export const PartyHandlers = Layer.mergeAll(
  ClaimReviewLive,
  EffectivePartyLive,
  MergeOnSamePartyLive,
  ReviewOnRequestLive,
  ReviewAssistLive,
  PartyDirectoryLive,
  ClaimFactsLive,
  FindPartiesLive,
);
