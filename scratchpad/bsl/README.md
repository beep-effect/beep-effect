# @beep/effect-drizzle

Define a domain once with `effect/Schema`, then derive Drizzle tables, relational metadata, and optimistic repositories from it.

> Experimental package design. This implementation currently lives in a scratchpad and is not published.

## Why

Applications that use Effect and Drizzle often maintain parallel maps of the same domain: an Effect schema for decoding and application behavior, then a Drizzle table for persistence. The two definitions can drift in nullability, defaults, generated values, lengths, enum members, and write semantics.

`@beep/effect-drizzle` treats the Effect schema as the richer source of domain truth. It derives from the schema's **encoded side**, because that is the representation sent to SQL, and corroborates inferred storage with explicit dialect intent when the schema alone is ambiguous. The result is still a real Drizzle table; existing Drizzle tooling can consume it for queries and DDL workflows.

## Quickstart

Create a PostgreSQL kit when several models share audit columns or table constraints. Use the PostgreSQL subpath for table helpers needed while configuring the kit:

```ts
import { getTableName, sql } from "drizzle-orm"
import { Int, Literals, NullOr, String, Struct, isMaxLength } from "effect/Schema"
import { Model as EffectModel } from "effect/unstable/schema"
import { make } from "@beep/effect-drizzle"
import { Table } from "@beep/effect-drizzle/pg"

const db = make({
  dialect: "pg",
  defaultColumns: (pg) => ({
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version())
  }),
  defaultExtras: (columns) => [
    Table.check(
      sql<boolean>`${columns.rowVersion} > 0`,
      "row_version_positive"
    )
  ]
})
```

Define models by piping SQL intent through Effect schemas. Bare schemas are derived when their encoded representation is unambiguous:

```ts
const { Entity, Model, pg, schema, toPgTable, Repository } = db

class Account extends Entity<Account>("Account")({
  id: Int.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  email: String.check(isMaxLength(320)).pipe(
    pg.varchar(320),
    pg.unique()
  ),
  status: Literals(["active", "disabled"]).pipe(
    pg.enum("account_status")
  ),
  displayName: String,
  settings: Struct({ theme: String }),
  nickname: NullOr(String)
}) {}

class Membership extends Model<Membership>("Membership")(
  {
    accountId: Int.pipe(pg.integer()),
    organizationId: Int.pipe(pg.integer()),
    role: Literals(["owner", "member"]).pipe(pg.enum())
  },
  (columns) => [
    Table.compositePrimaryKey("membership_pk", [
      columns.accountId,
      columns.organizationId
    ])
  ]
) {}

const accountTable = toPgTable(Account)
const database = schema({
  account: Account,
  membership: Membership
})

Account.sql.tableName // => "account"
getTableName(accountTable) // => "account"
getTableName(database.tables.account) // => "account"

const AccountRepository = Repository(Account, {
  spanPrefix: "Account",
  idColumn: "id"
})
```

`AccountRepository` is an Effect that requires `SqlClient.SqlClient`. Its `update` operation compares the declared `pg.version()` field and increments it atomically; a stale or missing row fails with `VersionConflictError`.

SQLite uses the same kit shape and domain schemas, but exposes only SQLite capabilities. Its
db-assigned key is an `INTEGER PRIMARY KEY AUTOINCREMENT`, timestamps use ISO text, and literal
enums become table-local `CHECK` constraints:

```ts
import { Int, Literals, OptionFromNullOr, String } from "effect/Schema"
import { Model as EffectModel } from "effect/unstable/schema"
import { make } from "@beep/effect-drizzle"

const sqliteDb = make({
  dialect: "sqlite",
  defaultColumns: (sqlite) => ({
    createdAt: EffectModel.DateTimeInsert.pipe(sqlite.text()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(sqlite.text()),
    rowVersion: Int.pipe(sqlite.integer(), sqlite.default(1), sqlite.version())
  })
})

const { Entity, sqlite, schema, toSqliteTable } = sqliteDb

class LocalAccount extends Entity<LocalAccount>("LocalAccount")({
  id: Int.pipe(sqlite.integer(), sqlite.autoIncrement()),
  name: String,
  nickname: OptionFromNullOr(String),
  status: Literals(["active", "disabled"]).pipe(sqlite.enum())
}) {}

const localAccountTable = toSqliteTable(LocalAccount)
const localDatabase = schema({ local_account: LocalAccount })
```

The SQLite namespace intentionally has no `array` export. SQLite models reject PostgreSQL column
descriptors (and PostgreSQL models reject SQLite descriptors) at the offending field.

Use `Entity` for kit defaults and `Model` when a table must opt out. Insert and update variants retain Effect's write strategies: generated columns disappear, insert defaults are optional or constructed as declared, row locators remain available for updates, and optimistic version fields remain required.

## What the type system rejects

The public combinators preserve literal metadata, so invalid combinations fail where they are authored rather than after a migration reaches a database. The test fixture proves at least these families:

- a schema whose encoded carrier cannot inhabit its requested SQL column;
- an underivable or ambiguous schema without an explicit column combinator;
- nullable, duplicate, or array primary keys;
- identity on a non-integer column or on an array;
- optimistic versions on non-integer, generated, identity, array, or duplicate fields;
- fields that are both defaulted and generated;
- `varchar` and `char` bounds that contradict schema checks;
- enum declarations backed by broad strings or conflicting literal sets;
- foreign keys whose SQL identities, entity identities, or array depths differ;
- references to absent assembly targets and colliding reverse relation names;
- malformed table extras, partial-index predicates, and composite keys with too few columns;
- overriding a kit's invariant default columns;
- optimistic repositories for models without exactly one version field.

Runtime checks mirror the same laws at author-input seams, including deliberately hand-built field metadata and extras callback results.

## Design principles

- **Schema truth at boundaries.** User data, field variants, decoding, and errors remain schema-first. Internal compiler descriptors are lightweight tagged data and readonly records.
- **Encoded-side derivation.** SQL storage follows the encoded representation, then explicit combinators corroborate intent when multiple SQL mappings are plausible.
- **Dialect as a kit.** PostgreSQL and SQLite behavior live behind `make({ dialect: "pg" | "sqlite" })` and sibling `./pg` and `./sqlite` subpaths. There is no portable intermediate SQL representation.
- **Derivation first, explicit intent when needed.** Strings, numbers, booleans, nullable values, and structured JSON can derive naturally; length, enum, identity, array, generated, and reference semantics stay visible in pipelines.
- **Zero runtime type assertions.** Implementation boundaries use overloads, schema decoding, guards, and tagged constructors rather than assertion syntax.

## Status and compatibility

This design is experimental. PostgreSQL and SQLite are implemented against Effect v4 beta and Drizzle ORM 1.0 release-candidate versions. Both dialects project real Drizzle tables, assemble RQBv2 relations, and run through Effect SQL repositories in the live suites.

Known open boundaries are PostgreSQL enum arrays, preservation of literal relation names through the complete relation API, and a symbol-name mismatch between the independently pinned Drizzle ORM and drizzle-kit SQLite RC hashes. The SQLite live suite carries a test-only compatibility preload for that tooling mismatch; it does not patch installed packages. Those boundaries are not presented as finished features.
