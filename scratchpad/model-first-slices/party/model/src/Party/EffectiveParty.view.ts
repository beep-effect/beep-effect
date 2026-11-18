import * as Domain from "@alchemy.run/domain";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import { EffectivePartyInitial, EffectivePartyState, EffectivePartyRead } from "@proto/party-contract/Party/EffectiveParty.read";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import { Party } from "./Party.aggregate.ts";

/**
 * A party as it is now: its name and every party merged into it. Readable
 * under a `party.read` grant on its org or on the party.
 *
 * @category views
 * @since 0.0.0
 */
export class EffectiveParty extends Domain.View(
  "EffectiveParty",
  {
    from: [Party],
    key: Party,
    middleware: [Session],
    rejects: [MissingGrant],
    state: EffectivePartyState,
    initial: EffectivePartyInitial,
    // Phase 7: the state became a union of `Unregistered` and `Registered`.
    version: 1,
    evolve: {
      PartyRegistered: (view, event) =>
        EffectivePartyState.cases.Registered.make({
          org: event.org,
          name: event.name,
          absorbed: EffectivePartyState.guards.Registered(view) ? view.absorbed : [],
        }),
      PartiesMerged: (view, event) =>
        EffectivePartyState.matchOrElse(
          view,
          {
            Registered: (party): EffectivePartyState => ({ ...party, absorbed: A.append(party.absorbed, event.absorbed) }),
          },
          identity,
        ),
    },
  },
  EffectivePartyRead.annotations,
) {}
