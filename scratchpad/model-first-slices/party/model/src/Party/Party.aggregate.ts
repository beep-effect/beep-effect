import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import { OrgId } from "@proto/kernel/Ids";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import { MergeParties, MergeVetoed, PartiesMerged } from "./MergeParties.command.ts";
import { PartyId } from "./Party.id.ts";
import { PartyAlreadyRegistered, PartyRegistered, RegisterParty } from "./RegisterParty.command.ts";

/**
 * A party's lifecycle: not registered yet, or active with the parties merged into it.
 *
 * @category models
 * @since 0.0.0
 */
export const PartyState = S.TaggedUnion({
  Unregistered: {},
  Active: { org: OrgId, name: S.String, absorbed: S.Array(PartyId) },
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
      RegisterParty: Effect.fn(function* (state, command) {
        if (state._tag !== "Unregistered") return yield* new PartyAlreadyRegistered();
        const by = yield* CurrentActor;
        return [new PartyRegistered({ name: command.name, by })];
      }),

      MergeParties: Effect.fn(function* (state, command, { id }) {
        const by = yield* CurrentActor;
        if (state._tag !== "Active") return yield* new MergeVetoed({ reason: "not-registered" });
        if (command.absorbed === id) return yield* new MergeVetoed({ reason: "self-merge" });
        if (state.org !== by.org) return yield* new MergeVetoed({ reason: "other-org" });
        // Already absorbed: the state already is what the command asks for.
        if (A.contains(state.absorbed, command.absorbed)) return [];
        return [new PartiesMerged({ absorbed: command.absorbed, by })];
      }),
    },
    evolve: {
      PartyRegistered: (_, event) =>
        PartyState.cases.Active.make({ org: event.by.org, name: event.name, absorbed: [] }),
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
