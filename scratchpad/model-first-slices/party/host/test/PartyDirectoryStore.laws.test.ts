import type * as Domain from "@alchemy.run/domain";
import { makeLayer } from "@beep/pglite";
import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { Count, Name } from "@proto/kernel/Measure";
import { type DirectoryRow, DirectoryText } from "@proto/party-contract/Directory/FindParties.read";
import { InvalidCursor } from "@proto/party-contract/Directory/InvalidCursor.rejection";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { PartyName } from "@proto/party-contract/Party/PartyName";
import { ClusterSql, clusterSqlFrom, clusterSqlNames } from "@proto/party-host/ClusterSql";
import {
  generationOf,
  PartyDirectoryRowFields,
  PartyDirectoryRowTables,
  StoreKit,
} from "@proto/party-host/Directory/PartyDirectory.table";
import { pgPartyDirectoryStoreFor } from "@proto/party-host/Directory/PgPartyDirectoryStore.adapter";
import { PartyMigrations } from "@proto/party-host/Party.migrations";
import {
  DirectoryChange,
  DirectoryCursor,
  DirectoryWrite,
  GenerationBehind,
  MemoryPartyDirectoryStore,
  PartyDirectoryStore,
} from "@proto/party-model/Directory/PartyDirectory.store";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// The directory store's laws, held by both implementations: the in-memory twin the stories use and
// the Postgres adapter, here on PGlite. Every value is generated: a scene says which parties exist,
// in which org, under which name, and whom each absorbed; the writes are built from it the way the
// projection writes them, so every count, row and page is known by construction.

/** A second generation for the rebuild laws: the same row fields, its own table. */
class PartyDirectoryRowsV1 extends StoreKit.Model<PartyDirectoryRowsV1>("PartyDirectoryRowsV1")(PartyDirectoryRowFields) {}
const rows = { ...PartyDirectoryRowTables, 1: generationOf(PartyDirectoryRowsV1) };

/** One party: its key, which of the scene's two orgs it is in, its name as registered (which may hold `%`, `_` and `\`), and whom it absorbed, in order, by index into the scene's parties (so a party is often absorbed twice). */
const ScenedParty = S.Struct({ key: Name, inSecondOrg: S.Boolean, name: PartyName, merges: S.Array(Count).check(S.isMaxLength(4)) });
type ScenedParty = typeof ScenedParty.Type;

const Scene = S.Struct({
  orgs: S.Tuple([Name, Name]),
  parties: S.Array(ScenedParty).check(S.isMaxLength(8)),
  text: DirectoryText,
  take: Count.check(S.isBetween({ minimum: 1, maximum: 4 })),
});
type Scene = typeof Scene.Type;

type Store = Context.Service.Shape<typeof PartyDirectoryStore>;
type Page = Domain.Query.Page<DirectoryRow>;

const partiesOf = (scene: Scene) => A.dedupeWith(scene.parties, (a, b) => a.key === b.key);
const orgOf = (scene: Scene, party: ScenedParty) => OrgId.make(party.inSecondOrg ? scene.orgs[1] : scene.orgs[0]);
const streamOf = (party: ScenedParty) => `Party/${party.key}`;
const partyIdOf = (key: string) => PartyId.make(key);
/** The keys a party absorbed, in merge order. */
const mergedOf = (scene: Scene, party: ScenedParty) => {
  const keys = A.map(partiesOf(scene), (other) => other.key);
  return A.map(party.merges, (index) => keys[index % keys.length] ?? party.key);
};

/** The writes the projection makes for a party: its registration, then each merge, at positions 1, 2, .... */
const writesOf = (scene: Scene, party: ScenedParty): ReadonlyArray<DirectoryWrite> => [
  DirectoryWrite.make({
    stream: streamOf(party),
    seq: 1,
    change: DirectoryChange.cases.Registered.make({ partyId: partyIdOf(party.key), org: orgOf(scene, party), name: party.name }),
  }),
  ...A.map(mergedOf(scene, party), (merged, index) =>
    DirectoryWrite.make({
      stream: streamOf(party),
      seq: index + 2,
      change: DirectoryChange.cases.Merged.make({ partyId: partyIdOf(party.key), absorbed: partyIdOf(merged) }),
    }),
  ),
];
const allWrites = (scene: Scene) => A.flatMap(partiesOf(scene), (party) => writesOf(scene, party));

/** A row as the directory lists it: each absorbed party once, in the order first merged. */
const rowOf = (scene: Scene, party: ScenedParty): DirectoryRow => ({
  partyId: partyIdOf(party.key),
  org: orgOf(scene, party),
  name: party.name,
  absorbed: A.map(A.dedupe(mergedOf(scene, party)), partyIdOf),
});

const byPartyId = Order.mapInput(Order.String, (row: DirectoryRow) => row.partyId);
const contains = (text: string) => (row: DirectoryRow) => pipe(Str.toLowerCase(row.name), Str.includes(Str.toLowerCase(text)));
/** What a search of `org` for `text` lists, every page together. */
const expectedSearch = (scene: Scene, org: OrgId, text: string) =>
  pipe(
    partiesOf(scene),
    A.map((party) => rowOf(scene, party)),
    A.filter((row) => row.org === org && contains(text)(row)),
    A.sort(byPartyId),
  );
const expectedCheckpoints = (scene: Scene) =>
  HashMap.fromIterable(A.map(partiesOf(scene), (party) => [streamOf(party), party.merges.length + 1] as const));

/** Every page of a search, from the first until a null cursor (at most 50, so a store that never ends one fails). */
const allPages = (
  store: Store,
  org: OrgId,
  text: string,
  take: number,
  after: string | undefined = undefined,
  read: ReadonlyArray<Page> = [],
): Effect.Effect<ReadonlyArray<Page>, InvalidCursor> =>
  Effect.flatMap(store.search(org, text, { after, take }), (page) =>
    page.cursor === null || read.length >= 50
      ? Effect.succeed(A.append(read, page))
      : allPages(store, org, text, take, page.cursor, A.append(read, page)),
  );

/** What a cursor says, when it is one: the order it follows and the party it resumes after. */
const cursorOf = S.decodeUnknownOption(DirectoryCursor);

/** A cursor of the directory's shape that follows some other order, as a client or another store might forge one. */
const ForeignCursor = S.StringFromBase64Url.pipe(S.decodeTo(S.fromJsonString(S.Struct({ order: Name, partyId: PartyId }))));

/** The pages hold every expected row once, in order: full pages each with a cursor naming its last party, then one last page with none. */
const expectPaged = (pages: ReadonlyArray<Page>, expected: ReadonlyArray<DirectoryRow>, take: number) => {
  expect(A.flatMap(pages, (page) => page.entries)).toEqual(expected);
  expect(pages.length).toBe(Math.max(1, Math.ceil(expected.length / take)));
  expect(A.last(pages).pipe(O.map((page) => page.cursor))).toEqual(O.some(null));
  A.forEach(A.dropRight(pages, 1), (page) => {
    expect(page.entries).toHaveLength(take);
    expect(cursorOf(page.cursor)).toEqual(A.last(page.entries).pipe(O.map((row) => ({ order: "partyId", partyId: row.partyId }))));
  });
};

/** Page through a search and hold it to the expected rows. */
const searchHolds = Effect.fnUntraced(function* (store: Store, scene: Scene, org: OrgId, text: string) {
  const pages = yield* allPages(store, org, text, scene.take);
  expectPaged(pages, expectedSearch(scene, org, text), scene.take);
  return pages;
});

// PGlite, migrated with the committed migrations, plus a table for the test's generation 1.
const testMigrations = Effect.gen(function* () {
  const [empty, withV1] = yield* Effect.all(
    [Effect.promise(() => generateDrizzleJson({})), Effect.promise(() => generateDrizzleJson({ rows: rows[1].table }))],
    { concurrency: 1 },
  );
  const statements = yield* Effect.promise(() => generateMigration(empty, withV1));
  return { ...PartyMigrations, "99_test_generation_1": statements };
});
const Postgres = Layer.unwrap(
  Effect.map(testMigrations, (migrations) =>
    pgPartyDirectoryStoreFor(rows).pipe(Layer.provideMerge(clusterSqlFrom(makeLayer(clusterSqlNames), migrations))),
  ),
);

/** Each implementation, fresh for every generated scene: a new memory store, or the Postgres tables emptied. */
const implementations = {
  memory: MemoryPartyDirectoryStore.pipe(Layer.fresh, Layer.build, Effect.map(Context.get(PartyDirectoryStore))),
  postgres: Effect.gen(function* () {
    const { connect } = yield* ClusterSql;
    const { sql } = yield* connect;
    yield* sql`TRUNCATE party_directory_rows_v_0, party_directory_rows_v_1, party_directory_positions, party_directory_active`;
    return yield* Effect.service(PartyDirectoryStore);
  }).pipe(Effect.orDie),
};
const options = { timeout: 120_000, arbitrary: { runs: 30 } };

it.layer(Postgres, { timeout: "60 seconds" })("the directory store's laws", (it) => {
  A.forEach(["memory", "postgres"] as const, (name) => {
    const fresh = implementations[name];

    it.effect.prop(`${name}: each write applies once; a redelivered batch applies none and changes nothing`, [Scene], ([scene]) =>
      Effect.gen(function* () {
        const store = yield* fresh;
        const writes = allWrites(scene);
        const org = OrgId.make(scene.orgs[0]);
        const before = yield* store.active;
        expect(before).toEqual(O.none());
        const applied = yield* store.apply(writes, 0);
        expect(applied).toBe(writes.length);
        const checkpoints = yield* store.checkpoints(0);
        expect(checkpoints).toEqual(expectedCheckpoints(scene));
        const pages = yield* searchHolds(store, scene, org, "");
        const replayed = yield* store.apply(writes, 0);
        expect(replayed).toBe(0);
        const checkpointsAfter = yield* store.checkpoints(0);
        expect(checkpointsAfter).toEqual(checkpoints);
        const pagesAfter = yield* allPages(store, org, "", scene.take);
        expect(pagesAfter).toEqual(pages);
        const after = yield* store.active;
        expect(after).toEqual(O.some(0));
      }),
      options,
    );

    it.effect.prop(
      `${name}: a batch cut anywhere and redelivered whole, as after a crash before the library's checkpoint, gives the same directory`,
      [Scene, Count],
      ([scene, cut]) =>
        Effect.gen(function* () {
          const store = yield* fresh;
          const writes = allWrites(scene);
          const at = cut % (writes.length + 1);
          const first = yield* store.apply(A.take(writes, at), 0);
          expect(first).toBe(at);
          // Redelivered after the merges: a replayed registration must not reset what was absorbed.
          const rest = yield* store.apply(writes, 0);
          expect(rest).toBe(writes.length - at);
          yield* searchHolds(store, scene, OrgId.make(scene.orgs[0]), "");
        }),
      options,
    );

    it.effect.prop(
      `${name}: a search lists exactly the org's rows whose name contains the text in any case, in party id order, a page at a time`,
      [Scene, S.Boolean],
      ([scene, second]) =>
        Effect.gen(function* () {
          const store = yield* fresh;
          yield* store.apply(allWrites(scene), 0);
          yield* searchHolds(store, scene, OrgId.make(second ? scene.orgs[1] : scene.orgs[0]), scene.text);
        }),
      options,
    );

    it.effect.prop(
      `${name}: a part of a row's name, upper-cased, finds that row, whatever it holds of % _ and \\`,
      [Scene, Count, Count],
      ([scene, start, length]) =>
        Effect.gen(function* () {
          const store = yield* fresh;
          yield* store.apply(allWrites(scene), 0);
          yield* Effect.forEach(
            partiesOf(scene),
            Effect.fnUntraced(function* (party) {
              // A search text has no outer whitespace: the part is trimmed, and is still a part of the name.
              const from = start % party.name.length;
              const text = Str.trim(Str.toUpperCase(Str.slice(from, from + (length % 5))(party.name)));
              const pages = yield* searchHolds(store, scene, orgOf(scene, party), text);
              expect(A.some(A.flatMap(pages, (page) => page.entries), (row) => row.partyId === party.key)).toBe(true);
            }),
            { concurrency: 1, discard: true },
          );
        }),
      options,
    );

    it.effect.prop(
      `${name}: a cursor the store did not issue is refused with InvalidCursor: arbitrary text, a bare party id, another order's cursor`,
      [Scene, S.String, Name, Name],
      ([scene, text, key, order]) =>
        Effect.gen(function* () {
          const store = yield* fresh;
          yield* store.apply(allWrites(scene), 0);
          const org = OrgId.make(scene.orgs[0]);
          const everyRow = expectedSearch(scene, org, "");
          const otherOrder = yield* S.encodeEffect(ForeignCursor)({ order, partyId: partyIdOf(key) }).pipe(Effect.orDie);
          yield* Effect.forEach(
            [text, key, otherOrder],
            Effect.fnUntraced(function* (after) {
              const exit = yield* Effect.exit(store.search(org, "", { after, take: scene.take }));
              // The store answers as the cursor schema reads the cursor: refused unless it decodes,
              // and then the page after the party it names.
              O.match(cursorOf(after), {
                onNone: () =>
                  expect(exit).toMatchObject({ _tag: "Failure", cause: { reasons: [{ _tag: "Fail", error: InvalidCursor.make({}) }] } }),
                onSome: ({ partyId }) =>
                  expect(Exit.map(exit, (page) => page.entries)).toEqual(
                    Exit.succeed(A.take(A.filter(everyRow, (row) => row.partyId > partyId), scene.take)),
                  ),
              });
            }),
            { concurrency: 1, discard: true },
          );
        }),
      options,
    );

    it.effect.prop(
      `${name}: a rebuilt generation becomes active only once it has caught up, and the retired one is refused`,
      [Scene, Count],
      ([scene, cut]) =>
        Effect.gen(function* () {
          const store = yield* fresh;
          const parties = partiesOf(scene);
          const org = OrgId.make(scene.orgs[0]);
          yield* store.apply(allWrites(scene), 0);
          // The rebuild has replayed the first `at` parties' streams so far; queries still read generation 0.
          const [replayed, pending] = A.splitAt(parties, cut % (parties.length + 1));
          yield* store.apply(A.flatMap(replayed, (party) => writesOf(scene, party)), 1);
          yield* searchHolds(store, scene, org, "");
          if (A.isReadonlyArrayNonEmpty(pending)) {
            const refused = yield* Effect.flip(store.switchTo(1));
            expect(refused).toBeInstanceOf(GenerationBehind);
            expect(A.sort(refused.behind, Order.String)).toEqual(A.sort(A.map(pending, streamOf), Order.String));
            const still = yield* store.active;
            expect(still).toEqual(O.some(0));
          }
          yield* store.apply(A.flatMap(pending, (party) => writesOf(scene, party)), 1);
          yield* store.switchTo(1);
          const active = yield* store.active;
          expect(active).toEqual(O.some(1));
          yield* searchHolds(store, scene, org, "");
          const rebuilt = yield* store.checkpoints(1);
          expect(rebuilt).toEqual(expectedCheckpoints(scene));
          const retired = yield* store.checkpoints(0);
          expect(retired).toEqual(HashMap.empty());
          // A straggler from the retired generation is refused.
          const straggler = yield* store.apply(allWrites(scene), 0);
          expect(straggler).toBe(0);
        }),
      options,
    );
  });

  it.effect.prop("postgres: a generation with no declared row table dies, saying what to add", [Name, Name, PartyName], ([key, org, name]) =>
    Effect.gen(function* () {
      const store = yield* implementations.postgres;
      const write = DirectoryWrite.make({
        stream: `Party/${key}`,
        seq: 1,
        change: DirectoryChange.cases.Registered.make({ partyId: partyIdOf(key), org: OrgId.make(org), name }),
      });
      const exit = yield* Effect.exit(store.apply([write], 2));
      expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain("declare PartyDirectoryRowsV2");
    }),
    { arbitrary: { runs: 3 } },
  );
});
