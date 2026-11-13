import { ExpireGrant } from "@proto/authority-contract/Grant/ExpireGrant.command";
import { byProcess, eventCause, extend } from "@proto/kernel/Invocation";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { ExpireAtDeadline } from "./ExpireAtDeadline.policy.ts";
import { Grant } from "./Grant.aggregate.ts";

/**
 * Schedules `ExpireGrant` at the grant's expiry under one command id per
 * grant, so narrowing re-arms the same deadline. A grant without an expiry
 * schedules nothing.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ExpireAtDeadlineLive = ExpireAtDeadline.toLayer(
  Effect.gen(function* () {
    const grants = yield* Grant;
    return Effect.fn(function* (trigger) {
      yield* O.match(O.fromNullishOr(trigger.event.terms.expires), {
        onNone: () => Effect.void,
        onSome: (at) =>
          grants
            .schedule(
              trigger.source,
              new ExpireGrant({
                provenance: extend(trigger.event.provenance, byProcess(ExpireAtDeadline.policyName, eventCause(trigger))),
              }),
              { at, commandId: `expire:${trigger.source.id}` },
            )
            .pipe(Effect.asVoid),
      });
    });
  }),
);
