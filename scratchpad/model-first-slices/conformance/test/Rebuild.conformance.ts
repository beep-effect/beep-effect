import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { DirectoryRow } from "@proto/party-contract/Directory/FindParties.read";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import { blockedByLock, clients, eventually, human, lockHeld, psql, record, registration, releaseLock, services, setup } from "./Stack.ts";

// Phase 16: a directory rebuild on the cluster, in two halves around a deploy (README). The first
// half runs on the build that writes generation 0. Then a session of the conformance's own takes
// the active pointer's row, the build that writes generation 1 is deployed over the same state,
// and the second half runs while the host's switch waits on that row: a write made while the new
// generation is building must be found at once (the building generation forwards it to the one
// queries read), and the switch must happen by itself once the row is free.

/** What the first half leaves for the second (`RESTORE_FILE`). */
const Seeded = S.Struct({
  r: S.String,
  org: OrgId,
  survivor: PartyId,
  absorbed: PartyId,
  rows: S.Array(DirectoryRow),
});
const seededJson = Seeded.pipe(S.toCodecJson, S.fromJsonString);
const restoreFile = Config.String("RESTORE_FILE").pipe(Config.withDefault("/dev/null"));

/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

/** The generation queries read. */
const active = psql("SELECT generation FROM party_directory_active");
/** How many rows a generation's table holds, for one org or for every org. */
const rowsIn = (generation: number, where = "true") => psql(`SELECT count(*) FROM party_directory_rows_v_${generation} WHERE ${where}`);

if (O.contains(registration.restorePhase, "rebuild-before")) {
  live("rebuild, before: generation 0 holds two parties, one merged into the other", Effect.gen(function* () {
    const { org, r } = yield* setup;
    const { intake, reviewer } = yield* clients;
    const survivor = PartyId.make(`party_${r}_keep`);
    const absorbed = PartyId.make(`party_${r}_gone`);
    yield* intake.RegisterParty(survivor, { org, name: `Old ${r} keep` }, human("p_intake"));
    yield* intake.RegisterParty(absorbed, { org, name: `Old ${r} gone` }, human("p_intake"));
    const merged = yield* reviewer.MergeParties(survivor, { absorbed }, human("p_rev"));
    const page = yield* reviewer.FindParties({ org, text: r }, { ...human("p_rev"), atLeast: merged });
    const generation = yield* active;
    const fs = yield* FileSystem.FileSystem;
    const file = yield* restoreFile;
    const text = yield* S.encodeEffect(seededJson)({ r, org, survivor, absorbed, rows: page.entries });
    yield* fs.writeFileString(file, text);
    yield* record("rebuild-before", { generation, rows: page.entries });
    expect(generation).toBe("0");
    expect(page.entries).toEqual([
      { partyId: absorbed, org, name: `Old ${r} gone`, absorbed: [] },
      { partyId: survivor, org, name: `Old ${r} keep`, absorbed: [absorbed] },
    ]);
  }));
}

if (O.contains(registration.restorePhase, "rebuild-during")) {
  live("rebuild, during and after: a party registered while generation 1 builds is found at once, and the host switches by itself", Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const file = yield* restoreFile;
    const stored = yield* fs.readFileString(file);
    const { r, org, rows } = yield* S.decodeEffect(seededJson)(stored);
    const { intake, reviewer } = yield* clients;
    const search = (atLeast?: { readonly stream: string; readonly version: number }) =>
      reviewer.FindParties({ org, text: r }, { ...human("p_rev"), ...(atLeast === undefined ? {} : { atLeast }) });
    // The pointer's row is held from before the deploy, so the switch cannot have happened.
    const held = yield* lockHeld;
    const activeAtStart = yield* active;
    const beforeLate = yield* search();
    // Registered on the build that writes generation 1; queries still read generation 0.
    const late = PartyId.make(`party_${r}_late`);
    const lateRow = { partyId: late, org, name: `Late ${r}`, absorbed: [] };
    const registered = yield* intake.RegisterParty(late, { org, name: lateRow.name }, human("p_intake"));
    const found = yield* search(registered);
    const lateStored = yield* Effect.all([rowsIn(0, `party_id = '${late}'`), rowsIn(1, `party_id = '${late}'`)], { concurrency: 1 });
    // Generation 1 replays the history by itself, and the host's switch waits on the held row.
    const replayed = yield* eventually(rowsIn(1, `org = '${org}'`), (count) => count === "3", 240);
    const waiting = yield* eventually(blockedByLock, Str.includes("party_directory_active"), 240);
    const activeHeld = yield* active;
    yield* releaseLock;
    const activeAfter = yield* eventually(active, (generation) => generation === "1", 240);
    const after = yield* search();
    const totals = yield* Effect.all({ zero: rowsIn(0), one: rowsIn(1) }, { concurrency: 1 });
    const oldPositions = yield* psql("SELECT count(*) FROM party_directory_positions WHERE generation = 0");
    // After the switch a write goes to generation 1 alone.
    const post = PartyId.make(`party_${r}_post`);
    const posted = yield* intake.RegisterParty(post, { org, name: `Post ${r}` }, human("p_intake"));
    const last = yield* search(posted);
    const postStored = yield* Effect.all([rowsIn(0, `party_id = '${post}'`), rowsIn(1, `party_id = '${post}'`)], { concurrency: 1 });
    yield* record("rebuild-during", {
      held,
      activeAtStart,
      beforeLate: beforeLate.entries,
      found: found.entries,
      lateStored,
      replayed,
      waiting,
      activeHeld,
      activeAfter,
      after: after.entries,
      totals,
      oldPositions,
      last: A.map(last.entries, (row) => row.partyId),
      postStored,
    });
    const withLate = pipe([...rows, lateRow], A.sortBy((a, b) => Str.Order(a.partyId, b.partyId)));
    expect(held).not.toBe("0");
    expect(activeAtStart).toBe("0");
    expect(beforeLate.entries).toEqual(rows);
    // Read-your-own-write during the rebuild: the building generation forwarded it.
    expect(found.entries).toEqual(withLate);
    expect(lateStored).toEqual(["1", "1"]);
    expect(activeHeld).toBe("0");
    expect(activeAfter).toBe("1");
    expect(after.entries).toEqual(withLate);
    // The new generation holds every row the old one did, and the old one's positions are gone.
    expect(totals.one).toBe(totals.zero);
    expect(oldPositions).toBe("0");
    expect(A.map(last.entries, (row) => row.partyId)).toEqual(A.sort([...A.map(withLate, (row) => row.partyId), post], Str.Order));
    expect(postStored).toEqual(["0", "1"]);
  }));
}
