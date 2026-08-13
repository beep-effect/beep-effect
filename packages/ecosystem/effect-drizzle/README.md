# @beep/effect-drizzle

Define your domain once as an Effect Schema. Derive the Drizzle tables, the DDL, the relations, and the repositories from it.

> I have a dream that one day a domain entity can stand as an opaque
> [@EffectTS\_](https://x.com/EffectTS_) Schema, rich enough to describe itself, encoded enough to
> persist itself, and precise enough for [@DrizzleORM](https://x.com/DrizzleORM) to derive its
> table. No mapping layer. No drift. One source of truth.
>
> I have a dream!

It has been realized.

> **Status**: experimental. `@beep/effect-drizzle` stays private (unpublished) until Effect v4 is
> stable and Drizzle 1.0 is final. Until then it lives — fully built, tested, and consumable — in
> the open [beep-effect](https://github.com/beep-effect/beep-effect) monorepo, and feedback is
> very welcome through issues and discussions there.

## The problem

If you use Effect and Drizzle together today, you probably maintain two parallel descriptions of
every entity: an Effect schema for decoding, validation, and application behavior — and a Drizzle
table for persistence. Every nullable flag, default, generated column, length bound, enum member,
and write rule exists twice. Parallel definitions drift, and drift ships.

## The idea

`@beep/effect-drizzle` treats the Effect schema as the single, richer source of truth. It derives
SQL storage from the schema's **encoded side** — the representation that actually travels to the
database — and asks for explicit dialect intent only where the schema alone is ambiguous. What
comes out is a *real* Drizzle table: your existing Drizzle tooling, migrations, and query builder
consume it unchanged.

- **No mapping layer.** Fields carry their SQL metadata as part of the schema pipeline.
- **No drift.** Nullability, defaults, identity, generated columns, lengths, enums, and
  optimistic-locking semantics all flow from one definition — and invalid combinations fail at
  the field where you wrote them, at compile time.
- **One source of truth.** The schema describes the entity, persists the entity, and projects the
  table.

## Quickstart

Create a kit once — usually where several models share audit columns or table constraints:

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
    Table.check(sql<boolean>`${columns.rowVersion} > 0`, "row_version_positive")
  ]
})
```

Then define models by piping SQL intent through ordinary Effect schemas. Bare schemas derive
their columns automatically whenever the encoded representation is unambiguous:

```ts
const { Entity, Model, pg, schema, toPgTable, Repository } = db

class Account extends Entity<Account>("Account")({
  id: Int.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  email: String.check(isMaxLength(320)).pipe(pg.varchar(320), pg.unique()),
  status: Literals(["active", "disabled"]).pipe(pg.enum("account_status")),
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
    Table.compositePrimaryKey("membership_pk", [columns.accountId, columns.organizationId])
  ]
) {}

const accountTable = toPgTable(Account)
const database = schema({ account: Account, membership: Membership })

Account.sql.tableName // => "account"
getTableName(accountTable) // => "account"
getTableName(database.tables.account) // => "account"

const AccountRepository = Repository(Account, { spanPrefix: "Account", idColumn: "id" })
```

`Account` is an opaque Effect schema class — decode with it, construct with it, hand it to
anything that speaks `effect/Schema`. It also carries `sql` statics, projects a genuine
`pgTable`, participates in RQBv2 `defineRelations`, and derives an Effect SQL repository.
`AccountRepository.update` compares the declared `pg.version()` field and increments it
atomically; a stale or missing row fails with `VersionConflictError`.

Insert and update variants keep Effect's write strategies honest: generated columns disappear
from inputs, defaulted fields become optional on insert, row locators stay available for updates,
and optimistic version fields are required exactly where they must be.

### SQLite

The same kit shape and the same domain schemas, exposing only what SQLite can honor —
db-assigned keys are `INTEGER PRIMARY KEY AUTOINCREMENT`, timestamps are ISO text, and literal
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

The SQLite namespace deliberately has no `array` export, and each dialect rejects the other's
column descriptors at the offending field. There is no portable intermediate SQL representation —
dialect precision *is* the value proposition.

## What the type system rejects

The combinators preserve literal metadata end to end, so invalid combinations fail where they are
authored — not after a migration reaches a database. The type-test suite pins exact
`~effect-drizzle.error` diagnostics for (at least) these families:

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

Runtime checks mirror the same laws at author-input seams, including deliberately hand-built
field metadata and extras callback results.

## Honest boundaries

Typed `defaultExpr`, generated columns, checks, and partial-index predicates prove their encoded
carrier and must render with zero parameters — but this library does not parse SQL or certify
dialect semantics. PostgreSQL still owns immutability, generated-column chaining, and CHECK/index
grammar; SQLite still owns constant-expression and determinism rules. The live suites keep
negative DDL probes on these deferred boundaries so they stay visible.

Literal defaults are stricter: model construction validates the complete encoded schema and the
dialect's supported literal representation. `unsafeDefaultSql` exists for the cases where a
trusted SQL spelling is genuinely required. PostgreSQL multidimensional arrays are schema-checked
for rectangular shape; SQLite NUMERIC supports only finite-number and signed-64-bit bigint modes
(use TEXT for representation-preserving decimal strings).

## Design principles

- **Schema truth at boundaries.** User data, field variants, decoding, and errors are
  schema-first. Internal compiler descriptors are lightweight tagged data.
- **Encoded-side derivation.** SQL storage follows the encoded representation; explicit
  combinators corroborate intent only when several SQL mappings are plausible.
- **Dialect as a kit.** PostgreSQL and SQLite live behind `make({ dialect })` and the sibling
  `./pg` and `./sqlite` subpaths.
- **Derivation first, explicit intent when needed.** Strings, numbers, booleans, nullable values,
  and structured JSON derive naturally; length, enum, identity, array, generated, and reference
  semantics stay visible in the pipeline.
- **Zero runtime type assertions.** Implementation boundaries use overloads, schema decoding,
  guards, and tagged constructors — never assertion syntax.

## Status, compatibility, and feedback

PostgreSQL and SQLite are implemented against Effect v4 beta and Drizzle ORM 1.0
release-candidate versions (pinned exactly as peers while upstream is prerelease). Both dialects
project real Drizzle tables, assemble RQBv2 relations, and run through Effect SQL repositories in
live database suites; the published declarations are guarded by a dedicated multi-TypeScript
type-test lane.

Known open boundaries — stated as boundaries, not features: SQL-expression semantic analysis,
PostgreSQL enum arrays, preservation of literal relation names through the complete relation API,
and a symbol-name mismatch between the independently pinned Drizzle ORM and drizzle-kit SQLite RC
hashes (the SQLite live suite carries a test-only compatibility preload; installed packages are
never patched).

Until npm publication, the package is developed in the open inside
[beep-effect](https://github.com/beep-effect/beep-effect) at
`packages/ecosystem/effect-drizzle`. If the dream resonates — a domain entity that describes
itself, persists itself, and derives its table — come kick the tires and tell us where it leaks.
