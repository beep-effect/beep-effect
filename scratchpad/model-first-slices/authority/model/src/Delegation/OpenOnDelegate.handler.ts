import { OpenDelegation } from "@proto/authority-contract/Delegation/OpenDelegation.command";
import { DelegationId, GrantId } from "@proto/kernel/Ids";
import { byProcess, eventCause, extend } from "@proto/kernel/Invocation";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "@beep/utils/Option";
import { Delegation } from "./Delegation.aggregate.ts";
import { OpenOnDelegate } from "./OpenOnDelegate.policy.ts";
import { thunkEffectVoid } from "@beep/utils"

/**
 * Sends `OpenDelegation` with the delegating side's provenance extended by
 * this policy's hop; the delegator is whoever that provenance acts for. A
 * redelivered event finds the delegation already open and records nothing.
 *
 * @category handlers
 * @since 0.0.0
 */
export const OpenOnDelegateLive = OpenOnDelegate.toLayer(
  Effect.gen(function* () {
    const delegations = yield* Delegation;
    return Effect.fn(function* (trigger) {
      const provenance = extend(trigger.event.provenance, byProcess(OpenOnDelegate.policyName, eventCause(trigger)));
      const opening = Match.value(trigger.event).pipe(
        Match.tagsExhaustive({
          GrantDelegated: (event) => ({
            id: event.delegation,
            command: OpenDelegation.make({
              parent: GrantId.make(trigger.source.id),
              parentDelegation: O.none(),
              holder: event.to,
              delegator: event.provenance.onBehalfOf,
              terms: event.terms,
              provenance,
            }),
          }),
          DelegationExtended: (event) => ({
            id: event.child,
            command: OpenDelegation.make({
              parent: event.grant,
              parentDelegation: DelegationId.makeOption(trigger.source.id),
              holder: event.to,
              delegator: event.provenance.onBehalfOf,
              terms: event.terms,
              provenance,
            }),
          }),
        }),
      );
      yield* delegations
        .send(opening.id, opening.command)
        .pipe(Effect.catchTag("DelegationAlreadyOpen", thunkEffectVoid), Effect.asVoid);
    });
  }),
);
