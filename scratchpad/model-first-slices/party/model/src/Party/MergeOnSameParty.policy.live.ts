import { system } from "@proto/kernel/Actor";
import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import * as Effect from "effect/Effect";
import { Proposition } from "../Proposition.ts";
import { MergeParties } from "./MergeParties.command.ts";
import { MergeOnSameParty } from "./MergeOnSameParty.policy.ts";
import { Party } from "./Party.aggregate.ts";

/**
 * Sends `MergeParties` to the survivor, as the system acting in the claim's
 * org. A policy has no session, so it provides `CurrentActor` itself. Sends
 * made while handling a trigger get deterministic command ids, so a
 * redelivered event applies once.
 *
 * @category handlers
 * @since 0.0.0
 */
export const MergeOnSamePartyLive = MergeOnSameParty.toLayer(
  Effect.gen(function* () {
    const parties = yield* Party;
    return Effect.fn(function* ({ event }) {
      yield* Proposition.match(event.proposition, {
        SameParty: ({ survivor, absorbed }) =>
          parties.send(survivor, new MergeParties({ absorbed })).pipe(
            Effect.provideService(CurrentActor, system("MergeOnSameParty", event.by.org)),
            // Every declared rejection is handled: a vetoed merge records nothing.
            Effect.catchTag("MergeVetoed", () => Effect.void),
            Effect.asVoid,
          ),
        HasIdentifier: () => Effect.void,
      });
    });
  }),
);
