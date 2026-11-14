import { ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { type AssertedReview, ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import { ClaimFacts } from "./ClaimFacts.projection.ts";
import { PartyFacts } from "./PartyFacts.stream.ts";

/**
 * Appends both published versions for each decision. The fact id is the
 * claim's (a claim is decided once), so it is stable across redelivery and
 * rebuilds.
 *
 * @category handlers
 * @since 0.0.0
 */
const isAsserted = (review: ClaimReviewState): review is AssertedReview => !ClaimReviewState.guards.Unasserted(review);

export const ClaimFactsLive = ClaimFacts.toLayer(
  Effect.gen(function* () {
    const facts = yield* PartyFacts;
    return Effect.fn(function* (batch) {
      for (const input of batch) {
        const review = O.filter(O.fromNullishOr(input.state), isAsserted);
        if (O.isNone(review)) continue;
        const { org, reviews } = review.value;
        const claim = ClaimId.make(input.source.id);
        const decided = Match.value(input.event).pipe(
          Match.tagsExhaustive({
            ClaimAccepted: () => ({ decision: "accepted" as const, basis: "direct" as const, approval: O.none() }),
            ClaimRetracted: () => ({ decision: "retracted" as const, basis: "direct" as const, approval: O.none() }),
            ProposalApproved: (approved) => ({
              decision: approved.outcome,
              basis: "approval" as const,
              approval: O.some(approved.approval),
            }),
          }),
        );
        const common = { factId: `${claim}:decided`, claim, org, reviewRuns: reviews };
        yield* facts.append(
          input,
          ClaimDecidedV1.make({ ...common, outcome: decided.decision }),
          ClaimDecidedV2.make({ ...common, ...decided }),
        );
      }
    });
  }),
);
