import * as Effect from "effect/Effect";
import { ResumeOnApproval } from "./ResumeOnApproval.policy.ts";
import { ApprovalGiven, ReviewAssist } from "./ReviewAssist.saga.ts";

/**
 * Completes the run's durable wait with the approval's id and nothing else:
 * the approval itself is the committed fact on the claim.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ResumeOnApprovalLive = ResumeOnApproval.toLayer(
  Effect.gen(function* () {
    const reviews = yield* ReviewAssist;
    return Effect.fn(function* ({ event }) {
      yield* reviews.get(event.run).signal(ApprovalGiven, { approval: event.approval });
    });
  }),
);
