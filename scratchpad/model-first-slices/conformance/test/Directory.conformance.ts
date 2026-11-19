import { expect, it } from "@effect/vitest";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { PartyMigrations } from "@proto/party-host/Party.migrations";
import { RunsMigrations } from "@proto/runs-host/Runs.migrations";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import type * as Scope from "effect/Scope";
import {
  blockedByLock,
  clients,
  containersOf,
  docker,
  eventually,
  frontService,
  holdLock,
  human,
  lockHeld,
  psql,
  record,
  releaseLock,
  runnerService,
  services,
  setup,
  url,
} from "./Stack.ts";

// Phase 16: what phases 14 and 15 proved only on PGlite or in memory, against the cluster's own
// Postgres through the production client: the migrations of both hosts under a concurrent first
// use, the directory's row and position tables, the position row's lock, cursors over both wires,
// and search across letters outside ASCII. Run this file first on a fresh deploy: its first case
// is the directory's first use.

/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

/** The non-empty lines of a `psql` answer. */
const lines = (out: string) => A.filter(Str.split(out, "\n"), Str.isNonEmpty);

/** A migrations record's ids and names as the migrator's table holds them: `<id>|<name>`, in id order. */
const recordedAs = (migrations: Readonly<Record<string, ReadonlyArray<string>>>) =>
  A.map(R.keys(migrations), (key) => pipe(key, Str.replace("_", "|")));

/** What a migrations table holds: `<id>|<name>` per row, in id order; empty before the table exists. */
const migrationsIn = (table: string) =>
  psql(`SELECT migration_id, name FROM ${table} ORDER BY migration_id`).pipe(
    Effect.map(lines),
    Effect.orElseSucceed(() => A.empty<string>()),
  );

/** Every line a service's containers logged about connecting to the cluster's database. */
const sqlLogOf = (service: string) =>
  Effect.flatMap(containersOf(service), (ids) =>
    Effect.forEach(ids, (id) => Effect.map(docker("logs", id), (out) => A.filter(Str.split(out, "\n"), Str.includes("cluster sql:"))), {
      concurrency: 1,
    }),
  ).pipe(Effect.map(A.flatten));

live("both runners and the front use the directory for the first time at once: each migration is recorded once, and every party is found", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake, reviewer } = yield* clients;
  const before = yield* migrationsIn("party_migrations");
  // Twelve registrations at once, spread over the shards of both runners, with a search from the
  // front in the same instant: every process that touches the directory connects and migrates now.
  const parties = A.makeBy(12, (i) => PartyId.make(`party_${r}_${i}`));
  const [receipts, early] = yield* Effect.all(
    [
      Effect.forEach(parties, (party, i) => intake.RegisterParty(party, { org, name: `Mig ${r} ${i}` }, human("p_intake")), {
        concurrency: "unbounded",
      }),
      Effect.exit(reviewer.FindParties({ org, text: r }, human("p_rev"))),
    ],
    { concurrency: "unbounded" },
  );
  const page = yield* reviewer.FindParties({ org, text: r }, { ...human("p_rev"), atLeast: receipts });
  const party = yield* migrationsIn("party_migrations");
  const runs = yield* migrationsIn("runs_migrations");
  const logged = yield* Effect.all({ runners: sqlLogOf(runnerService), front: Effect.flatMap(frontService, sqlLogOf) }, { concurrency: 1 });
  yield* record("migrations-at-once", { before, early: early._tag, found: page.entries.length, party, runs, logged });
  expect(party).toEqual(recordedAs(PartyMigrations));
  expect(runs).toEqual(recordedAs(RunsMigrations));
  expect(A.filter([...logged.runners, ...logged.front], Str.includes("failed"))).toEqual([]);
  // Ordered bytewise, as the in-memory store orders them, whatever the database's collation.
  expect(A.map(page.entries, (row) => row.partyId)).toEqual(A.sort(parties, Str.Order));
}));

live("a directory batch waits while another session holds its stream's position row, and applies once when the row is free", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake, reviewer } = yield* clients;
  const survivor = PartyId.make(`party_${r}_keep`);
  const absorbed = PartyId.make(`party_${r}_gone`);
  const registered = yield* Effect.all(
    [
      intake.RegisterParty(survivor, { org, name: `Lock ${r} keep` }, human("p_intake")),
      intake.RegisterParty(absorbed, { org, name: `Lock ${r} gone` }, human("p_intake")),
    ],
    { concurrency: 1 },
  );
  // The rows as the production client reads them: snake_case columns back as the contract's keys,
  // and the text array as a list.
  const rows = yield* reviewer.FindParties({ org, text: r }, { ...human("p_rev"), atLeast: registered });
  expect(rows.entries).toEqual([
    { partyId: absorbed, org, name: `Lock ${r} gone`, absorbed: [] },
    { partyId: survivor, org, name: `Lock ${r} keep`, absorbed: [] },
  ]);
  // Another session takes the survivor's position row, as a second runner applying the same stream
  // would: the merge's batch must wait on it.
  const position = `FROM party_directory_positions WHERE generation = 0 AND stream = 'Party/${survivor}'`;
  const stored = Effect.all({
    absorbed: psql(`SELECT absorbed FROM party_directory_rows_v_0 WHERE party_id = '${survivor}'`),
    position: psql(`SELECT seq ${position}`),
  }, { concurrency: 1 });
  const lock = yield* holdLock("SELECT 1", `SELECT stream ${position}`);
  yield* eventually(lockHeld, (n) => n !== "0", 40);
  const merged = yield* reviewer.MergeParties(survivor, { absorbed }, human("p_rev"));
  const waiting = yield* eventually(blockedByLock, Str.isNonEmpty, 60);
  // Held for three more seconds: nothing of the batch is visible while it waits.
  yield* Effect.sleep("3 seconds");
  const held = yield* stored;
  yield* releaseLock;
  yield* Fiber.join(lock);
  const after = yield* reviewer.FindParties({ org, text: `${r} keep` }, { ...human("p_rev"), atLeast: merged });
  const applied = yield* stored;
  yield* record("position-row-lock", { waiting, held, applied, after: after.entries });
  expect(pipe(waiting, Str.includes("party_directory_positions"))).toBe(true);
  expect(held).toEqual({ absorbed: "{}", position: "1" });
  expect(applied).toEqual({ absorbed: `{${absorbed}}`, position: "2" });
  expect(after.entries).toEqual([{ partyId: survivor, org, name: `Lock ${r} keep`, absorbed: [absorbed] }]);
}));

live("pages follow the cursors the store issues, and a cursor it did not issue is refused: InvalidCursor over the contract, 400 over plain HTTP", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake, reviewer } = yield* clients;
  const parties = A.makeBy(5, (i) => PartyId.make(`party_${r}_${i}`));
  const receipts = yield* Effect.forEach(parties, (party, i) => intake.RegisterParty(party, { org, name: `Page ${r} ${i}` }, human("p_intake")), {
    concurrency: 1,
  });
  const input = { org, text: r };
  const pageAfter = (after: string | undefined) =>
    reviewer.FindParties(input, { ...human("p_rev"), atLeast: receipts, take: 2, ...(after === undefined ? {} : { after }) });
  const first = yield* pageAfter(undefined);
  const second = yield* pageAfter(first.cursor ?? undefined);
  const third = yield* pageAfter(second.cursor ?? undefined);
  const refused = yield* Effect.flip(pageAfter("not-a-cursor"));
  // The same search as plain HTTP JSON: `QUERY /reviewer-http/FindParties`, the input in the body.
  const front = yield* Effect.orDie(url);
  const client = yield* HttpClient.HttpClient;
  const overHttp = Effect.fn("overHttp")(function* (body: unknown) {
    const request = yield* HttpClientRequest.make("QUERY")(`${front}/reviewer-http/FindParties`).pipe(
      HttpClientRequest.setHeaders(human("p_rev").headers),
      HttpClientRequest.bodyJson(body),
    );
    const response = yield* client.execute(request);
    const answered = yield* response.json;
    return { status: response.status, body: answered };
  });
  const httpPage = yield* overHttp({ input, take: 2 });
  const httpRefused = yield* overHttp({ input, after: "not-a-cursor" });
  yield* record("cursors", {
    pages: A.map([first, second, third], (page) => ({ ids: A.map(page.entries, (row) => row.partyId), cursor: page.cursor })),
    refused,
    httpPage,
    httpRefused,
  });
  expect(A.flatMap([first, second, third], (page) => A.map(page.entries, (row) => row.partyId))).toEqual(A.sort(parties, Str.Order));
  expect(A.map([first, second, third], (page) => O.isSome(O.fromNullOr(page.cursor)))).toEqual([true, true, false]);
  expect(refused).toMatchObject({ _tag: "InvalidCursor" });
  expect(httpPage).toMatchObject({ status: 200, body: { entries: [{ partyId: parties[0] }, { partyId: parties[1] }], cursor: first.cursor } });
  expect(httpRefused).toEqual({ status: 400, body: { _tag: "InvalidCursor" } });
}));

live("search ignores case for letters outside ASCII, as the in-memory store does", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake, reviewer } = yield* clients;
  const party = PartyId.make(`party_${r}`);
  const name = `Élodie Ünal Øst ${r}`;
  const registered = yield* intake.RegisterParty(party, { org, name }, human("p_intake"));
  const typed = { exact: `Élodie Ünal Øst ${r}`, lower: `élodie ünal øst ${r}`, upper: pipe(`élodie ünal øst ${r}`, Str.toUpperCase), ascii: r };
  const found = yield* Effect.forEach(
    R.toEntries(typed),
    ([how, text]) =>
      Effect.map(reviewer.FindParties({ org, text }, { ...human("p_rev"), atLeast: registered }), (page) => [how, A.map(page.entries, (row) => row.partyId)] as const),
    { concurrency: 1 },
  );
  // What the cluster's Postgres folds with, and what it makes of the letters themselves.
  const locale = yield* psql(`SELECT datlocprovider, datcollate, datctype, coalesce(datlocale, '') FROM pg_database WHERE datname = current_database()`);
  const folded = yield* psql(`SELECT lower('ÉÜØ'), version()`);
  yield* record("non-ascii-search", { typed, found, locale, folded });
  expect(R.fromEntries(found)).toEqual({ exact: [party], lower: [party], upper: [party], ascii: [party] });
}));
