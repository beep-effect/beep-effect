import * as Domain from "@alchemy.run/domain";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import { EffectivePartyInitial, EffectivePartyState } from "@proto/party-contract/Party/EffectiveParty.read";
import * as A from "effect/Array";
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
    evolve: {
      PartyRegistered: (view, event) => ({ ...view, org: event.org, name: event.name }),
      PartiesMerged: (view, event) => ({ ...view, absorbed: A.append(view.absorbed, event.absorbed) }),
    },
  },
  { description: "A party as it is now, with every duplicate merged into it." },
) {}
