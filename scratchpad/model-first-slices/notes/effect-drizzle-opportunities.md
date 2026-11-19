# Opportunities for `@beep/effect-drizzle`

What using `@beep/effect-drizzle` for projection stores in this prototype showed about the library.
Each entry: what we were doing, the evidence, and what would have helped. Add entries as they come
up; do not edit old ones.

Context: here a table is never the system of record. Aggregates live in the host's storage, and the
only tables are projection stores (rebuilt from history, one table per generation) and small process
tables. So this is the library used without its entity half: no audit columns, no optimistic
version, and writes that must be safe to repeat.

## 2026-11-18: a kit with no default columns throws an untyped error

- **Doing:** declaring a kit for projection stores, which have no audit columns:
  `make("pg", () => ({}))`.
- **Evidence:** `TypeError: undefined is not an object (evaluating 'keys(self)')` from
  `R.collect` inside `makeResolved` (`src/pg/kit.ts:271`). `make("pg", () => ({ defaultColumns: {} }))`
  works.
- **Would have helped:** `defaultColumns` optional, defaulting to none. Failing that, a typed error
  at the kit that names the missing key.

## 2026-11-18: an array column names its element twice, and the error does not show the form

- **Doing:** `absorbed: S.Array(PartyId)` as a `text[]` column.
- **Evidence:** `S.Array(PartyId).pipe(pg.array(pg.text()))` and
  `S.Array(PartyId.pipe(pg.text())).pipe(pg.array())` both fail with "pg.array requires an element
  schema with one explicit scalar column combinator". The accepted form restates the element:
  `S.Array(PartyId).pipe(pg.array(PartyId.pipe(pg.text())))`. The README has no array example; the
  form is only in the tests and in the combinator's own JSDoc.
- **Would have helped:** an array example in the README quickstart; the error showing the accepted
  form; and an overload that takes the element's column from the schema already in the pipe
  (`S.Array(PartyId).pipe(pg.array(pg.text()))`), so the element is written once.

## 2026-11-18: a table name cannot be set, so a generation cannot be part of it cleanly

- **Doing:** one table per projection generation, named from the projection and the generation.
- **Evidence:** the table name is derived from the model identifier alone
  (`deriveTableName(identifier)`, `src/pg/model.ts:568`). `Model<Row>("PartyDirectoryRowsV0")`
  derives `party_directory_rows_v_0`: the digit is split off (`v_0`), and the only way to get a
  generation into the name is to put it into the class identifier.
- **Would have helped:** a `tableName` option on `Model`, or a first-class notion of a model family
  by generation: one field set, a table per generation, each with its own class and its own derived
  index names.

## 2026-11-18: a consumer installed apart from the monorepo needs one `drizzle-orm`

- **Doing:** linking `@beep/effect-drizzle` into this standalone workspace, which has its own
  `node_modules` (and its own `drizzle-orm`, the same version, through `alchemy`).
- **Evidence:** the model and `toPgTable` type-check, but `eq(rows.org, org)` fails: the table's
  columns are typed by the monorepo's `drizzle-orm`, `eq` by the workspace's, and the two `SQL`
  types do not unify (TS2769, "Types of property 'codecs' are incompatible"). Linking the
  workspace's `drizzle-orm` to the monorepo's copy fixes it. At run time both copies interoperate.
- **Would have helped:** a line in the README: `drizzle-orm` is a peer dependency and the consumer
  must resolve the same physical copy; and re-exporting the handful of operators a store needs, so
  a consumer can stay on the library's copy without importing `drizzle-orm` itself.

## 2026-11-18: repositories have no write that is safe to repeat

- **Doing:** looking for the write a projection handler needs. Inputs arrive at least once, so a
  write must be an upsert, and a batch.
- **Evidence:** `makeNativeRepository` returns Effect SQL's repository (`insert`, `insertVoid`,
  `update`, `updateVoid`, `findById`, `delete`). A second `insert` of the same key fails on the
  primary key. There is no upsert and no multi-row write.
- **Would have helped:** `upsert` / `upsertMany` on the native repository (insert, on conflict on
  the locator update the non-key columns), typed by the model's insert variant; that would make the
  repository the whole store for a projection.

## 2026-11-18: a field with a decoding default gives an encoded row Drizzle will not insert

- **Doing:** writing a registration through the row model's insert variant. The row's `absorbed`
  is the contract's `Initial.empty(PartyId)`: a constructor default and a decoding default, so its
  key is optional on the encoded side.
- **Evidence:** the derived column is `text[] NOT NULL` and Drizzle's insert type requires
  `absorbed: string[]`, while `typeof Row.insert.Encoded` has `absorbed?: ReadonlyArray<string>`.
  `db.insert(table).values(yield* S.encodeEffect(Row.insert)(row))` fails to type-check (TS2769,
  "readonly string[] | undefined is not assignable to string[] | ..."). The adapter passes the
  decoded `Row.insert.make(...)` value with `absorbed: A.copy(row.absorbed)` instead
  (`party/host/src/Directory/PgPartyDirectoryStore.adapter.ts`).
- **Would have helped:** the projected table's insert type following the model's insert variant
  (a decoding-default key that the encoder always writes typed as present), so an encoded insert row
  is a valid `values(...)` argument.

## 2026-11-18: array columns take mutable arrays, the model's are readonly

- **Doing:** the same insert, and `onConflictDoUpdate({ set: { absorbed } })`.
- **Evidence:** every Effect Schema array is `ReadonlyArray` on both sides; Drizzle's array column
  insert and update types are `T[]`. Each write of an array column needs `A.copy(...)` (a runtime
  copy for a type-level difference).
- **Would have helped:** `toPgTable` typing array columns' insert and update inputs as
  `ReadonlyArray<T>` (Drizzle only reads them), or a documented helper.

## 2026-11-18: no collation on a text column, so ordering is fixed at every query

- **Doing:** paging the directory by party id with a cursor, which must order exactly as the
  in-memory store orders (`Order.String`, code units), whatever the database's default collation.
- **Evidence:** the combinators have no collation (`rg -i collat src` finds nothing). The adapter
  writes `sql\`${table.partyId} collate "C"\`` in both the `ORDER BY` and the cursor comparison.
  PGlite's default collation hides the difference, so a test cannot show the need.
- **Would have helped:** `pg.text({ collation: "C" })` (and on `varchar` and `char`), emitted in the
  DDL, so the ordering lives with the column.

## 2026-11-18: a repository needs a SqlClient when it is built, not when it is used

- **Doing:** reading the inbox checkpoint and the directory's active pointer through
  `NativeRepository(...).findById`, over a client that connects on first use (the deploy builds
  every runner Layer once where the database URL is not set).
- **Evidence:** `makeNativeRepository` returns `Effect<NativeRepository, never, SqlClient>`, so each
  adapter builds its repositories after connecting and caches them beside the connection
  (`storeOf` in both adapters). `findById` fails with `NoSuchElementError` for an absent row, so
  every read adds `Effect.catchTag("NoSuchElementError", ...)` to get an `Option` or a default.
- **Would have helped:** a repository whose methods resolve the `SqlClient` per call (so it can be
  built once, at Layer construction), and a `findByIdOption` (or `findById` returning `Option`).

## 2026-11-18: drizzle-kit sees only top-level table exports, so a table record is restated

- **Doing:** declaring the directory's row tables as a record by generation
  (`PartyDirectoryRowTables`), the one place that says which generations a deploy keeps.
- **Evidence:** drizzle-kit collects tables from `Object.values(module)` of the schema file; a table
  inside a record is not seen. `party/host/src/Party.schema.ts` restates each generation's table as
  its own export, and `party/host/test/PartyDirectory.table.test.ts` holds the two lists equal.
  `schema({...})` assembles tables for relations, not a module drizzle-kit can read.
- **Would have helped:** a way to hand drizzle-kit (and Alchemy's `Drizzle.Schema`) an assembled
  schema object, or a generator that writes the flat schema module from it.
