import { streamOf } from "@alchemy.run/domain/Aggregate";
import { ResourceScope } from "@proto/kernel/Capability";
import { requireGrant } from "@proto/kernel/CurrentInvocation.context";
import { PartyRead } from "@proto/party-contract/Party.capabilities";
import { EffectivePartyState } from "@proto/party-contract/Party/EffectiveParty.read";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { EffectiveParty } from "./EffectiveParty.view.ts";
import { thunkEffectVoid } from "@beep/utils"

/**
 * Who may read a party: an invocation with a `party.read` grant on its org
 * or on the party. A party not registered yet reads as empty.
 *
 * @category handlers
 * @since 0.0.0
 */
export const EffectivePartyLive = EffectiveParty.toLayer(
  Effect.succeed(
    Effect.fn(function* (request, party) {
      const now = yield* DateTime.now;
      const registered = O.filter(O.fromNullishOr(party), EffectivePartyState.guards.Registered);
      yield* O.match(O.map(registered, (found) => found.org), {
        onNone: thunkEffectVoid,
        onSome: (org) =>
          requireGrant(
            PartyRead,
            EffectiveParty.viewName,
            ResourceScope.cases.Record.make({ org, record: streamOf(request.key) }),
            now,
          ).pipe(Effect.asVoid),
      });
    }),
  ),
);
