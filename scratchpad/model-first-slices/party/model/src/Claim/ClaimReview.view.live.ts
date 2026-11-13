import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import { NotAMember } from "@proto/kernel/NotAMember.rejection";
import * as Effect from "effect/Effect";
import { ClaimReview } from "./ClaimReview.view.ts";

/**
 * Who may read a claim: anyone acting in its org. A claim not asserted yet
 * reads as empty, so a client can wait for it to appear.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ClaimReviewLive = ClaimReview.toLayer(
  Effect.succeed(
    Effect.fn(function* (_request, review) {
      const actor = yield* CurrentActor;
      const org = review?.org ?? null;
      if (org !== null && org !== actor.org) return yield* new NotAMember();
    }),
  ),
);
