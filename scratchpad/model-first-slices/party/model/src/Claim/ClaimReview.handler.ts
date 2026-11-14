import { streamOf } from "@alchemy.run/domain/Aggregate";
import { requireGrant } from "@proto/kernel/CurrentInvocation.context";
import { ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
import { PartyRead } from "@proto/party-contract/Party.capabilities";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { claimIn } from "./Claim.rules.ts";
import { ClaimReview } from "./ClaimReview.view.ts";

/**
 * Who may read a claim: an invocation with a `party.read` grant on its org
 * or on the claim. A claim not asserted yet reads as empty, so a client can
 * wait for it to appear.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ClaimReviewLive = ClaimReview.toLayer(
  Effect.succeed(
    Effect.fn(function* (request, review) {
      const now = yield* DateTime.now;
      const asserted = O.filter(O.fromNullishOr(review), (found) => !ClaimReviewState.guards.Unasserted(found));
      yield* O.match(O.map(asserted, (found) => found.org), {
        onNone: () => Effect.void,
        onSome: (org) =>
          requireGrant(PartyRead, ClaimReview.viewName, claimIn(org, streamOf(request.key)), now).pipe(Effect.asVoid),
      });
    }),
  ),
);
