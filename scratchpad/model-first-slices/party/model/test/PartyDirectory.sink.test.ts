import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import {
  DirectoryChange,
  type DirectoryWrite,
  GenerationBehind,
  MemoryPartyDirectoryStore,
  PartyDirectoryStore,
} from "@proto/party-model/Directory/PartyDirectory.store";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const acme = OrgId.make("org_acme");
const dana = PartyId.make("party_dana");
const dup = PartyId.make("party_dup");
const page = { after: undefined, take: 10 };
const registered = (partyId: PartyId, seq: number): DirectoryWrite => ({
  stream: `Party/${partyId}`,
  seq,
  change: DirectoryChange.cases.Registered.make({ partyId, org: acme, name: `Dana ${partyId}` }),
});
const merged = (seq: number): DirectoryWrite => ({
  stream: `Party/${dana}`,
  seq,
  change: DirectoryChange.cases.Merged.make({ partyId: dana, absorbed: dup }),
});
const fresh = <A, E>(effect: Effect.Effect<A, E, PartyDirectoryStore>) => Effect.provide(effect, Layer.fresh(MemoryPartyDirectoryStore));

it.effect("a registration replayed after a merge is refused, so the merge survives (Astra's counterexample)", () =>
  fresh(
    Effect.gen(function* () {
      const store = yield* PartyDirectoryStore;
      expect(yield* store.apply(0, [registered(dana, 1), registered(dup, 1), merged(3)])).toBe(3);
      // Redelivered after the merge: before the fix it wrote the row again with `absorbed: []`.
      expect(yield* store.apply(0, [registered(dana, 1)])).toBe(0);
      const found = yield* store.search(acme, "dana", page);
      expect(found.entries).toEqual([
        { partyId: dana, org: acme, name: "Dana party_dana", absorbed: [dup] },
        { partyId: dup, org: acme, name: "Dana party_dup", absorbed: [] },
      ]);
    }),
  ),
);

it.effect("a batch replayed after a crash between the write and the library's checkpoint changes nothing", () =>
  fresh(
    Effect.gen(function* () {
      const store = yield* PartyDirectoryStore;
      const batch = [registered(dana, 1), registered(dup, 1), merged(3)];
      yield* store.apply(0, batch);
      const before = yield* store.search(acme, "", page);
      const checkpoints = yield* store.checkpoints(0);
      expect(yield* store.apply(0, batch)).toBe(0);
      expect(yield* store.search(acme, "", page)).toEqual(before);
      expect(yield* store.checkpoints(0)).toEqual(checkpoints);
    }),
  ),
);

it.effect("queries read the active generation; a new one becomes active only once it has caught up", () =>
  fresh(
    Effect.gen(function* () {
      const store = yield* PartyDirectoryStore;
      yield* store.apply(0, [registered(dana, 1), registered(dup, 1), merged(3)]);
      // The rebuild has replayed one stream so far.
      yield* store.apply(1, [registered(dup, 1)]);
      expect(yield* store.active).toEqual(expect.objectContaining({ _tag: "Some", value: 0 }));
      expect((yield* store.search(acme, "", page)).entries).toHaveLength(2);
      expect(yield* Effect.flip(store.switchTo(1))).toEqual(new GenerationBehind({ generation: 1, behind: [`Party/${dana}`] }));
      yield* store.apply(1, [registered(dana, 1), merged(3)]);
      yield* store.switchTo(1);
      expect(yield* store.active).toEqual(expect.objectContaining({ _tag: "Some", value: 1 }));
      expect((yield* store.search(acme, "dana", page)).entries).toEqual([
        { partyId: dana, org: acme, name: "Dana party_dana", absorbed: [dup] },
        { partyId: dup, org: acme, name: "Dana party_dup", absorbed: [] },
      ]);
      // A straggler from the retired generation is refused.
      expect(yield* store.apply(0, [registered(PartyId.make("party_late"), 1)])).toBe(0);
    }),
  ),
);
