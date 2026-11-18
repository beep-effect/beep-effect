import * as Domain from "@alchemy.run/domain";
import { ResourceScope } from "@proto/kernel/Capability";
import { requireGrant } from "@proto/kernel/CurrentInvocation.context";
import { OrgId } from "@proto/kernel/Ids";
import { provenanceOf } from "@proto/kernel/Invocation";
import { PartyIntake, PartyReview } from "@proto/party-contract/Party.capabilities";
import { MergeParties, MergeVetoed, PartiesMerged } from "@proto/party-contract/Party/MergeParties.command";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { PartyName } from "@proto/party-contract/Party/PartyName";
import {
  PartyAlreadyRegistered,
  PartyRegistered,
  RegisterParty,
} from "@proto/party-contract/Party/RegisterParty.command";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Initial from "@proto/kernel/Initial";
import * as S from "effect/Schema";

/**
 * A party's lifecycle: not registered yet, or active with the parties merged into it.
 *
 * @category models
 * @since 0.0.0
 */
export const PartyState = S.TaggedUnion({
  Unregistered: {},
  Active: {
    org: OrgId,
    name: PartyName,
    absorbed: Initial.empty(PartyId, { description: "The parties merged into this one; none at first." }),
  },
});
/**
 * @category models
 * @since 0.0.0
 */
export type PartyState = typeof PartyState.Type;

/**
 * A party the practice deals with. Merging is idempotent: a party already
 * absorbed records nothing new.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Party extends Domain.Aggregate(
  "Party",
  {
    id: PartyId,
    state: PartyState,
    initial: { _tag: "Unregistered" },
    commands: [RegisterParty, MergeParties],
    decide: {
      RegisterParty: Effect.fn(function* (state, command, { stream, now }) {
        // The org is the command's, so the grant is checked before existence is revealed.
        const invocation = yield* requireGrant(
          PartyIntake,
          command._tag,
          ResourceScope.cases.Record.make({ org: command.org, record: stream }),
          now,
        );
        if (!PartyState.guards.Unregistered(state)) return yield* PartyAlreadyRegistered.make({});
        return [PartyRegistered.make({ org: command.org, name: command.name, provenance: provenanceOf(invocation) })];
      }),

      MergeParties: Effect.fn(function* (state, command, { id, stream, now }) {
        if (!PartyState.guards.Active(state)) return yield* MergeVetoed.make({ reason: "not-registered" });
        const invocation = yield* requireGrant(
          PartyReview,
          command._tag,
          ResourceScope.cases.Record.make({ org: state.org, record: stream }),
          now,
        );
        if (command.absorbed === id) return yield* MergeVetoed.make({ reason: "self-merge" });
        // Already absorbed: the state already is what the command asks for.
        if (A.contains(state.absorbed, command.absorbed)) return [];
        return [PartiesMerged.make({ absorbed: command.absorbed, provenance: provenanceOf(invocation) })];
      }),
    },
    evolve: {
      PartyRegistered: (_, event) => PartyState.cases.Active.make({ org: event.org, name: event.name }),
      PartiesMerged: (state, event) =>
        PartyState.matchOrElse(
          state,
          {
            Active: (active): PartyState => ({ ...active, absorbed: A.append(active.absorbed, event.absorbed) }),
          },
          identity,
        ),
    },
  },
  { description: "A person or organization the practice deals with, and the duplicates merged into it." },
) {}
