import { Actor } from "@proto/kernel/Actor";
import type { PrincipalId } from "@proto/kernel/Ids";
import * as Effect from "effect/Effect";
import { ReviewAssist } from "./ReviewAssist.saga.ts";
import { ReviewOnAssertion } from "./ReviewOnAssertion.policy.ts";

/**
 * Starts the run keyed by the claim. The agent acts on behalf of the person
 * behind the assertion; a `System` assertion has no such person
 * (`Agent.onBehalfOf` is a `PrincipalId`), so it gets no run.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ReviewOnAssertionLive = ReviewOnAssertion.toLayer(
  Effect.gen(function* () {
    const runs = yield* ReviewAssist;
    return Effect.fn(function* ({ source, event }) {
      const start = (onBehalfOf: PrincipalId) =>
        runs
          .start(source, { proposition: event.proposition, signals: event.signals, onBehalfOf, org: event.by.org })
          .pipe(Effect.asVoid);
      yield* Actor.match(event.by, {
        Human: (human) => start(human.principal),
        Agent: (agentActor) => start(agentActor.onBehalfOf),
        System: () => Effect.void,
      });
    });
  }),
);
