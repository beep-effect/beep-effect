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
// Each test gets a store of its own.
it.layer(MemoryPartyDirectoryStore, { buildPerTest: true })((it) => {
  it.effect("a registration replayed after a merge is refused, so the merge survives (Astra's counterexample)", () =>
    Effect.gen(function* () {
      const store = yield* PartyDirectoryStore;
      const first = yield* store.apply([registered(dana, 1), registered(dup, 1), merged(3)], 0);
      expect(first).toBe(3);
      // Redelivered after the merge: before the fix it wrote the row again with `absorbed: []`.
      const replayed = yield* store.apply([registered(dana, 1)], 0);
      expect(replayed).toBe(0);
      const found = yield* store.search(acme, "dana", page);
      expect(found.entries).toEqual([
        { partyId: dana, org: acme, name: "Dana party_dana", absorbed: [dup] },
        { partyId: dup, org: acme, name: "Dana party_dup", absorbed: [] },
      ]);
    }),
  );

  it.effect("a batch replayed after a crash between the write and the library's checkpoint changes nothing", () =>
    Effect.gen(function* () {
      const store = yield* PartyDirectoryStore;
      const batch = [registered(dana, 1), registered(dup, 1), merged(3)];
      yield* store.apply(batch, 0);
      const before = yield* store.search(acme, "", page);
      const checkpoints = yield* store.checkpoints(0);
      const replayed = yield* store.apply(batch, 0);
      expect(replayed).toBe(0);
      const after = yield* store.search(acme, "", page);
      expect(after).toEqual(before);
      const checkpointsAfter = yield* store.checkpoints(0);
      expect(checkpointsAfter).toEqual(checkpoints);
    }),
  );

  it.effect("queries read the active generation; a new one becomes active only once it has caught up", () =>
    Effect.gen(function* () {
      const store = yield* PartyDirectoryStore;
      yield* store.apply([registered(dana, 1), registered(dup, 1), merged(3)], 0);
      // The rebuild has replayed one stream so far.
      yield* store.apply([registered(dup, 1)], 1);
      const activeBefore = yield* store.active;
      expect(activeBefore).toEqual(expect.objectContaining({ _tag: "Some", value: 0 }));
      expect((yield* store.search(acme, "", page)).entries).toHaveLength(2);
      const behind = yield* Effect.flip(store.switchTo(1));
      expect(behind).toEqual(GenerationBehind.make({ generation: 1, behind: [`Party/${dana}`] }));
      yield* store.apply([registered(dana, 1), merged(3)], 1);
      yield* store.switchTo(1);
      const activeAfter = yield* store.active;
      expect(activeAfter).toEqual(expect.objectContaining({ _tag: "Some", value: 1 }));
      expect((yield* store.search(acme, "dana", page)).entries).toEqual([
        { partyId: dana, org: acme, name: "Dana party_dana", absorbed: [dup] },
        { partyId: dup, org: acme, name: "Dana party_dup", absorbed: [] },
      ]);
      // A straggler from the retired generation is refused.
      const straggler = yield* store.apply([registered(PartyId.make("party_late"), 1)], 0);
      expect(straggler).toBe(0);
    }),
  );
});
