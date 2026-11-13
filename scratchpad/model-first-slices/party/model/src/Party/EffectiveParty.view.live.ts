import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import { NotAMember } from "@proto/kernel/NotAMember.rejection";
import * as Effect from "effect/Effect";
import { EffectiveParty } from "./EffectiveParty.view.ts";

/**
 * Who may read a party: anyone acting in its org.
 *
 * @category handlers
 * @since 0.0.0
 */
export const EffectivePartyLive = EffectiveParty.toLayer(
  Effect.succeed(
    Effect.fn(function* (_request, party) {
      const actor = yield* CurrentActor;
      const org = party?.org ?? null;
      if (org !== null && org !== actor.org) return yield* new NotAMember();
    }),
  ),
);
