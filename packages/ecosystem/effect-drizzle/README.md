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

const db = make("pg", (pg) => ({
  defaultColumns: {
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version())
  },
  defaultExtras: (columns) => [
    pg.Table.check(sql<boolean>`${columns.rowVersion} > 0`, "row_version_positive")
  ]
}))
```

The dialect is the first argument and the whole configuration lives in one closure over the
dialect toolkit — every column combinator plus the `Table` extras namespace — so nothing else
needs importing. Kits are layered with `extend`, which adds columns and extras but can never
shadow or drop what a parent kit declared:

```ts
const audited = db.extend((pg) => ({
  columns: { deletedAt: NullOr(String).pipe(pg.timestamp()) }
}))
```

Then define models by piping SQL intent through ordinary Effect schemas. Bare schemas derive
their columns automatically whenever the encoded representation is unambiguous:

```ts
const { Entity, Model, pg, schema, toPgTable, Repository } = db

class Account extends Entity<Account>("Account")({
  id: Int.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  email: String.check(isMaxLength(320)).pipe(pg.varchar(), pg.unique()),
  status: Literals(["active", "disabled"]).pipe(pg.enum("account_status")),
  displayName: String.pipe(pg.text(), pg.index()),
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

`email` shows `varchar` derive mode: the column length comes from the schema's `isMaxLength`
check, so the bound lives once. `displayName` shows a colocated index — single-column index
intent rides the field and compiles to `account_display_name_btree_idx` (pass
`pg.index({ name })` to pin a legacy name); the extras callback remains for multi-column
indexes, checks, and composite keys.

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

const sqliteDb = make("sqlite", (sqlite) => ({
  defaultColumns: {
    createdAt: EffectModel.DateTimeInsert.pipe(sqlite.text()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(sqlite.text()),
    rowVersion: Int.pipe(sqlite.integer(), sqlite.default(1), sqlite.version())
  }
}))

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
- **Dialect as a kit.** PostgreSQL and SQLite live behind `make("pg" | "sqlite", (toolkit) =>
  config)` and the sibling `./pg` and `./sqlite` subpaths; kits compose with `extend`.
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

<!-- docgen:api-reference:start -->

## API reference

Generated from the package JSDoc by `bun run docgen && bun run readme` — edit the
source doc comments, never this section.

### Root entrypoint — `@beep/effect-drizzle`

Public SQL metadata carriers retained by downstream declaration emit.

#### constructors

##### make

Kit constructor deriving dialect-bound model, entity, and table builders.

**Signature**

```ts
declare const make: { <const Defaults extends FieldsInput>(dialect: "pg", build: (pg: PgToolkit) => PgKitConfig<Defaults>): PgKit<Defaults>; <const Defaults extends FieldsInput>(dialect: "sqlite", build: (sqlite: SqliteToolkit) => SqliteKitConfig<Defaults>): SqliteKit<Defaults>; <const D extends Dialect, const Defaults extends DialectFields<D>>(dialect: D, build: (toolkit: DialectToolkit<D>) => DialectConfig<D, Defaults>): DialectKit<D, Defaults>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L32)

#### errors

##### ModelInvariantError

Runtime error raised when a model violates a construction invariant.

**Signature**

```ts
declare const ModelInvariantError: typeof ModelInvariantError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L22)

#### models

##### Dialect

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const Dialect: Dialect
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L63)

##### EntityFactory

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const EntityFactory: EntityFactory<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L64)

##### FieldExcept

Shared model constructors and variant helpers exposed by the root entrypoint.

**Signature**

```ts
declare const FieldExcept: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => Field<{ readonly [K in Exclude<"update", Keys[number]> | Exclude<"insert", Keys[number]> | Exclude<"select", Keys[number]> | Exclude<"json", Keys[number]> | Exclude<"jsonCreate", Keys[number]> | Exclude<"jsonUpdate", Keys[number]>]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L39)

##### FieldOnly

Shared model constructors and variant helpers exposed by the root entrypoint.

**Signature**

```ts
declare const FieldOnly: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => Field<{ readonly [K in Keys[number]]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L40)

##### Model

Shared model constructors and variant helpers exposed by the root entrypoint.

**Signature**

```ts
declare const Model: <Self = never, const Identifier extends string = string>(identifier: Identifier & ValidateDerivedSqlName<Identifier, "Model identifier derives an invalid PostgreSQL table name">) => <const F extends FieldsInput>(fields: F & ValidateFields<F>, annotationsOrExtras?: Annotations.Annotations | Callback<F>, extras?: Callback<F>) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L42)

##### PgKit

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const PgKit: PgKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L65)

##### PgKitConfig

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const PgKitConfig: PgKitConfig<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L66)

##### PgKitExtension

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const PgKitExtension: PgKitExtension<Defaults, More>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L67)

##### PgToolkit

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const PgToolkit: PgToolkit
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L68)

##### SqliteEntityFactory

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const SqliteEntityFactory: SqliteEntityFactory<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L69)

##### SqliteKit

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const SqliteKit: SqliteKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L70)

##### SqliteKitConfig

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const SqliteKitConfig: SqliteKitConfig<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L71)

##### SqliteKitExtension

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const SqliteKitExtension: SqliteKitExtension<Defaults, More>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L72)

##### SqliteToolkit

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const SqliteToolkit: SqliteToolkit
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L73)

##### ValidateCollision

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const ValidateCollision: ValidateCollision<Defaults, Own>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L74)

##### ValidateMergedFields

Public kit configuration and result types for both supported SQL dialects.

**Signature**

```ts
declare const ValidateMergedFields: ValidateMergedFields<Defaults, Own, Effective>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L75)

##### VariantField

Shared model constructors and variant helpers exposed by the root entrypoint.

**Signature**

```ts
declare const VariantField: <const A extends Field.ConfigWithKeys<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(config: A & { readonly [K in Exclude<keyof A, "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">]: never; }) => Field<A>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L43)

##### extract

Shared model constructors and variant helpers exposed by the root entrypoint.

**Signature**

```ts
declare const extract: { <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">(variant: V): <A extends Struct<any>>(self: A) => Extract<V, A, V extends "select" ? true : false>; <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate", A extends Struct<any>>(self: A, variant: V): Extract<V, A, V extends "select" ? true : false>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L38)

##### fieldEvolve

Shared model constructors and variant helpers exposed by the root entrypoint.

**Signature**

```ts
declare const fieldEvolve: { <Self extends Field<any> | Top, const Mapping extends Self extends Field<infer S extends Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(f: Mapping): (self: Self) => Field<Self extends Field<infer S extends Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; <Self extends Field<any> | Top, const Mapping extends Self extends Field<infer S extends Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(self: Self, f: Mapping): Field<Self extends Field<infer S extends Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L41)

#### repositories

##### VersionConflictError

Optimistic repository constructor and conflict error.

**Signature**

```ts
declare const VersionConflictError: typeof VersionConflictError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L27)

##### makeRepository

Optimistic repository constructor and conflict error.

**Signature**

```ts
declare const makeRepository: { <const M extends RepositoryModel, const Id extends IdKey<M>>(model: M & ValidateVersionModel<M> & ValidateColumnNames<M>, options: { readonly spanPrefix: string; readonly idColumn: Id; }): Effect<Repository<M, Id>, never, SqlClient>; <const Id extends string>(options: { readonly spanPrefix: string; readonly idColumn: Id; }): <const M extends RepositoryModel>(model: M & ValidateVersionModel<M> & ValidateColumnNames<M> & ValidateLocator<M, Id>) => Effect<Repository<M, Id & IdKey<M>>, never, SqlClient>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L27)

#### type-level

##### AnyModel

Shared model inference types exposed by the root entrypoint.

**Signature**

```ts
declare const AnyModel: AnyModel
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L82)

##### ColumnsOf

Shared model inference types exposed by the root entrypoint.

**Signature**

```ts
declare const ColumnsOf: ColumnsOf<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L83)

##### EffectiveSchema

Shared model inference types exposed by the root entrypoint.

**Signature**

```ts
declare const EffectiveSchema: EffectiveSchema<I>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L84)

##### FieldInput

Public field-carrier types retained by downstream declaration emit.

**Signature**

```ts
declare const FieldInput: Input
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L51)

##### FieldsInput

Shared model inference types exposed by the root entrypoint.

**Signature**

```ts
declare const FieldsInput: FieldsInput
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L85)

##### ModelClass

Shared model inference types exposed by the root entrypoint.

**Signature**

```ts
declare const ModelClass: ModelClass<Self, F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L86)

##### PatchedField

Public field-carrier types retained by downstream declaration emit.

**Signature**

```ts
declare const PatchedField: Patched<I, Patch>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L51)

##### Repository

Repository result and version-column types.

**Signature**

```ts
declare const Repository: Repository<M, Id>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L57)

##### Statics

Shared model inference types exposed by the root entrypoint.

**Signature**

```ts
declare const Statics: Statics<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L87)

##### ValidateFields

Shared model inference types exposed by the root entrypoint.

**Signature**

```ts
declare const ValidateFields: ValidateFields<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L88)

##### Variant

Shared model inference types exposed by the root entrypoint.

**Signature**

```ts
declare const Variant: "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L89)

##### VersionKey

Repository result and version-column types.

**Signature**

```ts
declare const VersionKey: VersionKey<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L57)

##### isUniqueKey

Public SQL metadata carriers retained by downstream declaration emit.

**Signature**

```ts
declare const isUniqueKey: (meta: Meta) => boolean
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L17)

#### utils

##### DefaultSqlExpr

**Signature**

```ts
declare const DefaultSqlExpr: DefaultSqlExpr<Carrier>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L52)

##### DefaultValue

**Signature**

```ts
declare const DefaultValue: DefaultValue<Encoded>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L52)

##### IsUniqueKey

**Signature**

```ts
declare const IsUniqueKey: IsUniqueKey<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L52)

##### References

**Signature**

```ts
declare const References: References<TableName, ColumnName>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/index.ts#L52)

### Kit constructor — `@beep/effect-drizzle`

Creates dialect-bound modeling kits with invariant entity defaults.

The root dispatcher is a convenience for configuration-driven dialect
selection. Bundle-sensitive consumers can import `make` from the PostgreSQL
or SQLite subpath so the sibling dialect never enters the module graph.

#### factories

##### make

Creates a dialect kit whose entity defaults and extras are fixed once.

**When to use**

Use when runtime configuration selects PostgreSQL or SQLite from one root
API; import the dialect subpath constructor when bundle isolation matters.

**Details**

The dialect is the first argument and the whole configuration lives in one
closure receiving the dialect toolkit (column combinators plus the `Table`
extras namespace). The returned kit contains the toolkit, bare `Model`,
defaults-injected `Entity`, `Table`, repository factory, schema assembler,
table projector, and `extend`. Default extras execute before entity-local
extras. Literal dialects retain their exact kit type; a `Dialect` union input
receives and returns the corresponding toolkit and kit unions.

**Gotchas**

This convenience dispatcher imports both dialect implementations. Import
`make` from `@beep/effect-drizzle/pg` or `/sqlite` to exclude the sibling.

**Example** (Create a PostgreSQL kit)

```ts
import { Int } from "effect/Schema"
import { make } from "@beep/effect-drizzle"

const kit = make("pg", (pg) => ({
  defaultColumns: { version: Int.pipe(pg.integer(), pg.default(1)) },
  defaultExtras: () => []
}))

kit.pg.integer // => PostgreSQL integer combinator
```

**See**

- `PgKitConfig` for PostgreSQL defaults and extras.
- `SqliteKitConfig` for SQLite defaults and extras.

**Signature**

```ts
declare const make: { <const Defaults extends PgFieldsInput>(dialect: "pg", build: (pg: PgToolkit) => PgKitConfig<Defaults>): PgKit<Defaults>; <const Defaults extends SqliteFieldsInput>(dialect: "sqlite", build: (sqlite: SqliteToolkit) => SqliteKitConfig<Defaults>): SqliteKit<Defaults>; <const D extends Dialect, const Defaults extends DialectFields<D>>(dialect: D, build: (toolkit: DialectToolkit<D>) => DialectConfig<D, Defaults>): DialectKit<D, Defaults>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L139)

#### type-level

##### Dialect (type alias)

Names the SQL dialect selected by the root kit dispatcher.

**When to use**

Use when configuration can select either public dialect subpath.

**Details**

Bundle-sensitive code should import the dialect-local `make` constructor
instead of dispatching on this union at runtime.

**Example** (Select the PostgreSQL dialect)

```ts
import type { Dialect } from "@beep/effect-drizzle"

type PostgreSQL = Extract<Dialect, "pg"> // => "pg"
```

**Signature**

```ts
type Dialect = "pg" | "sqlite"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L66)

##### EntityFactory

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const EntityFactory: EntityFactory<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L23)

##### PgKit

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const PgKit: PgKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L24)

##### PgKitConfig

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const PgKitConfig: PgKitConfig<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L25)

##### PgKitExtension

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const PgKitExtension: PgKitExtension<Defaults, More>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L26)

##### PgToolkit

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const PgToolkit: PgToolkit
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L27)

##### SqliteEntityFactory

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteEntityFactory: SqliteEntityFactory<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L36)

##### SqliteKit

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteKit: SqliteKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L37)

##### SqliteKitConfig

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteKitConfig: SqliteKitConfig<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L38)

##### SqliteKitExtension

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteKitExtension: SqliteKitExtension<Defaults, More>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L39)

##### SqliteToolkit

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteToolkit: SqliteToolkit
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L40)

##### ValidateCollision

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const ValidateCollision: ValidateCollision<Defaults, Own>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L28)

##### ValidateMergedFields

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const ValidateMergedFields: ValidateMergedFields<Defaults, Own, Effective>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/kit.ts#L29)

### PostgreSQL entrypoint — `@beep/effect-drizzle/pg`

PostgreSQL column combinators and SQL modifiers.

#### combinators

##### "./combinators.ts" (namespace export)

Re-exports all named exports from the "./combinators.ts" module.

**Signature**

```ts
export * from "./combinators.ts"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L14)

##### default

Default PostgreSQL column metadata combinator.

**Signature**

```ts
declare const default: <const Value>(value: Value) => <I extends Input>(input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>) => Patched<I, { readonly default: DefaultValue<Value>; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L19)

#### factories

##### make

Creates a PostgreSQL-bound effect-drizzle kit.

**Signature**

```ts
declare const make: <const Defaults extends FieldsInput>(build: (pg: PgToolkit) => PgKitConfig<Defaults>) => PgKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L29)

#### projections

##### SchemaAssemblyError

PostgreSQL schema assembly constructor and error.

**Signature**

```ts
declare const SchemaAssemblyError: typeof SchemaAssemblyError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L34)

##### schema

PostgreSQL schema assembly constructor and error.

**Signature**

```ts
declare const schema: <const Models extends ModelRecord>(models: Models & ValidateSchema<Models>) => Assembly<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L34)

##### toPgTable

Projects one effect-drizzle model into a PostgreSQL Drizzle table.

**Signature**

```ts
declare const toPgTable: <M extends AnyModel>(model: M, additionalExtras?: AdditionalExtras<M>, enums?: EnumRegistry) => TableOf<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L39)

#### tables

##### Table (namespace export)

Re-exports all named exports from the "./extras.ts" module as `Table`.

**Signature**

```ts
export * as Table from "./extras.ts"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L24)

#### type-level

##### AdditionalExtras

PostgreSQL table projection inference types.

**Signature**

```ts
declare const AdditionalExtras: AdditionalExtras<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L76)

##### Assembly

PostgreSQL schema assembly inference types.

**Signature**

```ts
declare const Assembly: Assembly<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L65)

##### Bigint

PostgreSQL column metadata types retained by downstream declaration emit.

**Signature**

```ts
declare const Bigint: Bigint<Mode>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L46)

##### BuilderFor

PostgreSQL table projection inference types.

**Signature**

```ts
declare const BuilderFor: BuilderFor<I>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L77)

##### BuildersOf

PostgreSQL table projection inference types.

**Signature**

```ts
declare const BuildersOf: BuildersOf<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L78)

##### Custom

PostgreSQL column metadata types retained by downstream declaration emit.

**Signature**

```ts
declare const Custom: Custom<SqlType>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L46)

##### EntityFactory

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const EntityFactory: EntityFactory<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L52)

##### Integer

PostgreSQL column metadata types retained by downstream declaration emit.

**Signature**

```ts
declare const Integer: Integer<Ident>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L46)

##### Jsonb

PostgreSQL column metadata types retained by downstream declaration emit.

**Signature**

```ts
declare const Jsonb: { readonly _tag: "jsonb"; readonly dialect: "pg"; readonly kind: "jsonb"; readonly ident: "jsonb"; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L46)

##### ModelRecord

PostgreSQL schema assembly inference types.

**Signature**

```ts
declare const ModelRecord: ModelRecord
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L66)

##### Numeric

PostgreSQL column metadata types retained by downstream declaration emit.

**Signature**

```ts
declare const Numeric: Numeric<Precision, Scale>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L46)

##### PgKit

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const PgKit: PgKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L53)

##### PgKitConfig

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const PgKitConfig: PgKitConfig<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L54)

##### PgKitExtension

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const PgKitExtension: PgKitExtension<Defaults, More>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L55)

##### PgToolkit

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const PgToolkit: PgToolkit
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L56)

##### RelationsConfig

PostgreSQL schema assembly inference types.

**Signature**

```ts
declare const RelationsConfig: RelationsConfig<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L67)

##### Serial

PostgreSQL column metadata types retained by downstream declaration emit.

**Signature**

```ts
declare const Serial: { readonly _tag: "serial"; readonly dialect: "pg"; readonly kind: "serial"; readonly ident: "integer"; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L46)

##### TableOf

PostgreSQL table projection inference types.

**Signature**

```ts
declare const TableOf: TableOf<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L79)

##### TablesOf

PostgreSQL schema assembly inference types.

**Signature**

```ts
declare const TablesOf: TablesOf<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L68)

##### Text

PostgreSQL column metadata types retained by downstream declaration emit.

**Signature**

```ts
declare const Text: { readonly _tag: "text"; readonly dialect: "pg"; readonly kind: "text"; readonly ident: "text"; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L46)

##### Timestamp

PostgreSQL column metadata types retained by downstream declaration emit.

**Signature**

```ts
declare const Timestamp: Timestamp<Mode, Timezone>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L46)

##### ValidateCollision

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const ValidateCollision: ValidateCollision<Defaults, Own>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L57)

##### ValidateMergedFields

PostgreSQL kit configuration and result types.

**Signature**

```ts
declare const ValidateMergedFields: ValidateMergedFields<Defaults, Own, Effective>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L58)

##### ValidateSchema

PostgreSQL schema assembly inference types.

**Signature**

```ts
declare const ValidateSchema: ValidateSchema<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L69)

##### Varchar

PostgreSQL column metadata types retained by downstream declaration emit.

**Signature**

```ts
declare const Varchar: Varchar<L>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/index.ts#L46)

### PostgreSQL kit — `@beep/effect-drizzle/pg`

Builds PostgreSQL-local kits without importing SQLite implementation code.

#### configuration

##### PgKitConfig (interface)

Configures invariant PostgreSQL fields and table extras for `make`.

**When to use**

Use when every entity in a PostgreSQL slice must share columns or constraints.

**Details**

The whole configuration is produced inside one closure receiving the
`PgToolkit`, so `defaultColumns` is a plain field record and
`defaultExtras` closes over the same dialect namespace. Default extras run
before model-local extras against the merged field record.

**Gotchas**

A kit entity cannot redeclare a default field key; use the bare `Model`
returned by the kit when a table must opt out.

**Example** (Describe PostgreSQL defaults)

```ts
import { Int } from "effect/Schema"
import type { PgKitConfig } from "@beep/effect-drizzle/pg"

type Defaults = { readonly version: typeof Int }
type Config = PgKitConfig<Defaults> // => PostgreSQL kit configuration
```

**Signature**

```ts
export interface PgKitConfig<Defaults extends FieldsInput> {
  readonly defaultColumns: Defaults & ValidateFields<Defaults>;
  readonly defaultExtras?: Table.Callback<FieldsInput> | undefined;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/kit.ts#L88)

##### PgKitExtension (interface)

Additional columns and extras layered onto an existing kit by `extend`.

**Details**

`columns` may not shadow a column the kit already owns; `extras` are
concatenated after the kit's existing default extras, so extension can add
but never silently drop inherited nodes.

**Example** (Describe a kit extension)

```ts
import { Int, String } from "effect/Schema"
import type { PgKitExtension } from "@beep/effect-drizzle/pg"

type Defaults = { readonly version: typeof Int }
type Extension = PgKitExtension<Defaults, { readonly label: typeof String }>
// => columns and optional extras accepted by extend
```

**Signature**

```ts
export interface PgKitExtension<Defaults extends FieldsInput, More extends FieldsInput> {
  readonly columns: More & ValidateCollision<Defaults, More> & ValidateMergedFields<Defaults, More>;
  readonly extras?: Table.Callback<FieldsInput> | undefined;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/kit.ts#L227)

#### factories

##### EntityFactory (type alias)

Builds PostgreSQL entity models with a kit's invariant fields and extras.

**When to use**

Use when a table participates in the kit's shared entity contract; use the
sibling bare `Model` for junctions or deliberate opt-outs.

**Details**

Default fields precede own fields, and default extras precede model extras.
All model statics and variants observe the merged field record. Pass
annotations second and entity-local extras third when a model needs both.

**Gotchas**

A colliding key produces a readable `~effect-drizzle.error` at compile time
and a `ModelInvariantError` if the type boundary is bypassed.

**Example** (Name a PostgreSQL entity factory)

```ts
import { Int } from "effect/Schema"
import type { EntityFactory } from "@beep/effect-drizzle/pg"

type Defaults = { readonly version: typeof Int }
type Entity = EntityFactory<Defaults> // => defaults-injected model factory
```

**Signature**

```ts
type EntityFactory<Defaults> = <Self = never, const Identifier extends string = string>(
  identifier: Identifier &
    ValidateDerivedSqlName<Identifier, "kit Entity identifier derives an invalid PostgreSQL table name">
) => <const Own extends FieldsInput>(
  ownFields: Own & ValidateCollision<Defaults, Own> & ValidateMergedFields<Defaults, Own>,
  annotationsOrExtras?: Annotations.Annotations | Table.Callback<Merged<Defaults, NoInfer<Own>>>,
  extras?: Table.Callback<Merged<Defaults, NoInfer<Own>>>
) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, Merged<Defaults, Own>>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/kit.ts#L195)

##### make

Creates a PostgreSQL-only kit without importing the SQLite implementation.

**Details**

The whole configuration lives in one closure receiving the `PgToolkit`,
so column combinators and the `Table` extras namespace need no separate
imports. The returned kit can be layered with `extend`.

**Example** (Create an isolated PostgreSQL kit)

```ts
import { Int } from "effect/Schema"
import { make } from "@beep/effect-drizzle/pg"

const kit = make((pg) => ({
  defaultColumns: { version: Int.pipe(pg.integer(), pg.default(1)) }
}))

kit.pg.integer // => PostgreSQL integer combinator
```

**Signature**

```ts
declare const make: <const Defaults extends FieldsInput>(build: (pg: PgToolkit) => PgKitConfig<Defaults>) => PgKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/kit.ts#L361)

#### models

##### PgKit (interface)

Describes the PostgreSQL vocabulary returned by `make`.

**Details**

The kit keeps column operators, bare and defaults-injected model factories,
table extras, repository construction, assembly, projection, and capability
extension on one dialect-bound object.

**Example** (Infer a PostgreSQL kit)

```ts
import { Int } from "effect/Schema"
import type { PgKit } from "@beep/effect-drizzle/pg"

type Kit = PgKit<{ readonly version: typeof Int }>
type Entity = Kit["Entity"] // => defaults-injected entity factory
```

**Signature**

```ts
export interface PgKit<Defaults extends FieldsInput> {
  readonly Entity: EntityFactory<Defaults>;
  readonly extend: <const More extends FieldsInput>(
    build: (pg: PgToolkit) => PgKitExtension<Defaults, More>
  ) => PgKit<Merged<Defaults, More>>;
  readonly Model: typeof Model;
  readonly pg: PgToolkit;
  readonly Repository: typeof makeRepository;
  readonly schema: typeof schema;
  readonly Table: typeof Table;
  readonly toPgTable: typeof toPgTable;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/kit.ts#L254)

##### PgToolkit (type alias)

The dialect namespace a PostgreSQL kit closure receives.

**Details**

One binding carries every column combinator, the `default` alias for
`default_`, and the `Table` extras namespace, so kit configuration never
imports dialect modules separately.

**Example** (Use the toolkit inside a kit closure)

```ts
import { Int } from "effect/Schema"
import { make } from "@beep/effect-drizzle/pg"

const kit = make((pg) => ({
  defaultColumns: { version: Int.pipe(pg.integer(), pg.default(1)) },
  defaultExtras: (columns) => [pg.Table.index("kit_version_btree_idx", [columns.version])]
}))

kit.pg.Table.index // => PostgreSQL index-node constructor
```

**Signature**

```ts
type PgToolkit = typeof Pg & {
  readonly default: typeof Pg.default_;
  readonly Table: typeof Table;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/kit.ts#L49)

#### validation

##### ValidateCollision (type alias)

Rejects own-field keys that shadow an existing kit default column.

**Details**

Success resolves each key to `unknown`; a shadowing key resolves to a
`SqlTypeError` whose literal message appears on the offending property.

**Example** (Reject a shadowed default)

```ts
import { Int, String } from "effect/Schema"
import type { ValidateCollision } from "@beep/effect-drizzle/pg"

type Defaults = { readonly version: typeof Int }
type Accepted = ValidateCollision<Defaults, { readonly name: typeof String }>
// => { readonly name: unknown }
```

**Signature**

```ts
type ValidateCollision<Defaults, Own> = {
  readonly [K in keyof Own]: K extends keyof Defaults
    ? Field.SqlTypeError<`'${K & string}' is a kit default column — remove it or use Model`>
    : unknown;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/kit.ts#L126)

##### ValidateMergedFields (type alias)

Validates own fields against the complete merged kit field record.

**Details**

Per-key diagnostics from `ValidateFields` surface on the own-field
keys, and whole-model violations (for example a second inline primary key)
surface on the record itself.

**Example** (Validate merged fields)

```ts
import { Int, String } from "effect/Schema"
import type { ValidateMergedFields } from "@beep/effect-drizzle/pg"

type Defaults = { readonly version: typeof Int }
type Accepted = ValidateMergedFields<Defaults, { readonly name: typeof String }>
// => own-field record validated against the merged model
```

**Signature**

```ts
type ValidateMergedFields<Defaults, Own, Effective> = {
  readonly [K in keyof Own]: K extends keyof ValidateFields<Effective> ? ValidateFields<Effective>[K] : unknown;
} & (ValidateFields<Effective> extends Field.SqlTypeError<infer Message> ? Field.SqlTypeError<Message> : unknown)
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/kit.ts#L155)

### PostgreSQL column combinators — `@beep/effect-drizzle/pg`

Postgres combinators.

Every combinator is parameter-constrained: an incompatible schema fails to
satisfy the input intersection, so the compile error lands AT the pipe
callsite with a readable `~effect-drizzle.error` message — not downstream where the
field gets used. All combinators funnel through `Field.patch`, the single
audited merge seam.

Usage: `NonEmptyString.pipe(pg.varchar(320), pg.unique())`.

#### combinators

##### array

Declares a PostgreSQL array over an explicitly compiled scalar element.

**Details**

The scalar element owns the column descriptor; the outer schema must match
its encoded element at the declared depth. Dimensions range from one to five.

**Gotchas**

The element must have exactly one scalar column combinator. Arrays cannot be
primary keys, identity columns, or optimistic versions, and SQLite exposes no
corresponding operator. Multidimensional inputs are checked for rectangular
shape at the schema boundary; ragged arrays are rejected before insertion.

**Example** (Declare a two-dimensional text array)

```ts
import { Array, String } from "effect/Schema"
import { array, text } from "@beep/effect-drizzle/pg"

const matrix = Array(Array(String)).pipe(
  array(String.pipe(text()), "[][]")
)
matrix.meta.dimensions // => 2
```

**Signature**

```ts
declare const array: { <const Element extends Field.Input>(element: Element & Field.ValidateArrayElement<Element>): <I extends Field.Input>(input: I & Field.ValidateArrayEncoded<I, Element, 1> & ValidateArrayModifiers<I>) => Field.Patched<I, ArrayPatch<Element, 1>>; <const Element extends Field.Input, const Suffix extends PgColumn.ArrayDimensionString>(element: Element & Field.ValidateArrayElement<Element>, suffix: Suffix): <I extends Field.Input>(input: I & Field.ValidateArrayEncoded<I, Element, PgColumn.DimensionOf<Suffix>> & ValidateArrayModifiers<I>) => Field.Patched<I, ArrayPatch<Element, PgColumn.DimensionOf<Suffix>>>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1103)

##### bigint

Sets a bigint column whose mode matches the encoded carrier.

**When to use**

Use with number mode only within JavaScript's safe integer range; use bigint mode
when the schema and callers carry native `bigint` values.

**Example** (Set a native-bigint column)

```ts
import { BigInt } from "effect/Schema"
import { bigint } from "@beep/effect-drizzle/pg"

BigInt.pipe(bigint("bigint")).meta.column?.kind // => "bigint"
```

**Signature**

```ts
declare const bigint: { (mode: "number"): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "pg.bigint('number') requires a number-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Bigint<"number">; }>; (mode: "bigint"): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, bigint, "pg.bigint('bigint') requires a bigint-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Bigint<"bigint">; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L868)

##### bigserial

Sets a PostgreSQL bigserial column and marks inserts as defaulted.

**When to use**

Use with legacy serial semantics at bigint range. Prefer
`bigint(...).pipe(identity())` when explicit identity policy is required.

**Example** (Set number-mode bigserial)

```ts
import { Int } from "effect/Schema"
import { bigserial } from "@beep/effect-drizzle/pg"

Int.pipe(bigserial("number")).meta.hasDefault // => true
```

**Signature**

```ts
declare const bigserial: { (mode: "number"): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "pg.bigserial('number') requires a number-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Bigserial<"number">; readonly hasDefault: true; }>; (mode: "bigint"): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, bigint, "pg.bigserial('bigint') requires a bigint-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Bigserial<"bigint">; readonly hasDefault: true; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L685)

##### boolean

Set a PostgreSQL boolean column on a boolean-encoded schema.

**Example** (Set a boolean column)

```ts
import { Boolean } from "effect/Schema"
import { boolean } from "@beep/effect-drizzle/pg"

Boolean.pipe(boolean()).meta.column?.kind // => "boolean"
```

**Signature**

```ts
declare const boolean: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, boolean, "pg.boolean requires a boolean-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Bool; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L914)

##### bytea

Set a PostgreSQL bytea column on a Uint8Array-encoded schema.

**Example** (Set a bytea column)

```ts
import { Uint8Array } from "effect/Schema"
import { bytea } from "@beep/effect-drizzle/pg"

Uint8Array.pipe(bytea()).meta.column?.kind // => "bytea"
```

**Signature**

```ts
declare const bytea: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, Uint8Array, "pg.bytea requires a Uint8Array-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Bytea; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L963)

##### char

Sets a fixed-width PostgreSQL char column with exact-length authoring.

**When to use**

Use with truly fixed-width codes; use `varchar` for bounded variable text.

**Details**

Omitted length derives an `isLengthBetween(n, n)` check. An explicit length
verifies or injects that exact check.

**Gotchas**

PostgreSQL blank-pads shorter `char(n)` values. Exact-length validation keeps
valid encoded values stable across a database round trip.

**Example** (Derive a char length)

```ts
import { String, isLengthBetween } from "effect/Schema"
import { char } from "@beep/effect-drizzle/pg"

String.check(isLengthBetween(2, 2)).pipe(char()).meta.column?.kind // => "char"
```

**Signature**

```ts
declare const char: { (): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.char requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Char; }>; <const Length extends number>(length: Length): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.char requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Char<Length>; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L589)

##### columnName

Overrides the physical column name while preserving the model field key.

**When to use**

Use with legacy schemas or names that differ from snake-case derivation.

**Example** (Override a column name)

```ts
import { String } from "effect/Schema"
import { columnName } from "@beep/effect-drizzle/pg"

String.pipe(columnName("legacy_name")).meta.columnName // => "legacy_name"
```

**Signature**

```ts
declare const columnName: <const N extends string>(name: N & ValidateSqlName<N, "pg.columnName requires a lowercase SQL identifier">) => <I extends Field.Input>(input: I) => Field.Patched<I, { readonly columnName: N; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1709)

##### date

Sets a PostgreSQL date column in string or JavaScript `Date` mode.

**When to use**

Use with string mode for ISO date carriers and date mode only when the encoded
schema deliberately exposes JavaScript `Date` values to the driver.

**Gotchas**

String mode is carrier-only: installed Effect v4 exposes `DateFromString` as
a transformation, not a reusable encoded-string format check
(`node_modules/effect/src/Schema.ts`, `DateFromString`, lines 11851-11885).
Supply a validating schema when PostgreSQL date syntax must be rejected
before insertion.

**Example** (Set string date mode)

```ts
import { String } from "effect/Schema"
import { date } from "@beep/effect-drizzle/pg"

String.pipe(date()).meta.column?.kind // => "date"
```

**Signature**

```ts
declare const date: { (): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.date (string mode) requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.DateColumn<"string">; }>; (options: { readonly mode: "date"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, Date, "pg.date (date mode) requires a Date-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.DateColumn<"date">; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L540)

##### default

Named export for the PostgreSQL literal-default combinator.

**Signature**

```ts
declare const default: <const Value>(value: Value) => <I extends Field.Input>(input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.DefaultValue<Value>; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1421)

##### defaultExpr

Sets a typed SQL default expression with carrier equality checking.

**When to use**

Use when PostgreSQL should compute an insert default and typed Drizzle SQL
can represent it.

**Gotchas**

Schema expressions must render with zero parameters. Carrier typing does not
prove PostgreSQL expression legality; volatility, column references, and
other database rules remain migration-time checks.

**Example** (Set an expression default)

```ts
import { sql } from "drizzle-orm"
import { String } from "effect/Schema"
import { defaultExpr } from "@beep/effect-drizzle/pg"

String.pipe(defaultExpr(sql<string>`'active'`)).meta.hasDefault // => true
```

**Signature**

```ts
declare const defaultExpr: <Carrier>(expression: SQL<Carrier>) => <I extends Field.Input>(input: I & ValidateExpression<I, Carrier> & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.DefaultSqlExpr<Carrier>; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1450)

##### defaultNow

Sets PostgreSQL's current time as a timestamp database default.

**When to use**

Use when PostgreSQL is the single authority for an insert timestamp.

**Gotchas**

Do not combine this database clock with an Effect constructor default for
the same field; two clocks can disagree.

**Example** (Set the current-time default)

```ts
import { String } from "effect/Schema"
import { defaultNow, timestamp } from "@beep/effect-drizzle/pg"

String.pipe(timestamp(), defaultNow()).meta.hasDefault // => true
```

**Signature**

```ts
declare const defaultNow: () => <I extends Field.Input>(input: I & ValidateTimestamp<I> & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.DefaultNow; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1494)

##### default_

Sets a typed literal default matching the encoded database carrier.

**Details**

The field becomes insert-optional while the literal stays correlated with
the schema's encoded type. Model construction also validates the value against
the complete encoded schema and PostgreSQL literal representation. Non-finite
numbers, NUL text, and unproven `bytea` literals are rejected; use
`unsafeDefaultSql` only for a trusted SQL spelling that intentionally escapes
these checks.

**Example** (Set a literal default)

```ts
import { String } from "effect/Schema"
import { default as defaultValue } from "@beep/effect-drizzle/pg"

String.pipe(defaultValue("active")).meta.hasDefault // => true
```

**Signature**

```ts
declare const default_: <const Value>(value: Value) => <I extends Field.Input>(input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.DefaultValue<Value>; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1407)

##### doublePrecision

Set a PostgreSQL double-precision column on a number-encoded schema.

**Example** (Set a double-precision column)

```ts
import { Finite } from "effect/Schema"
import { doublePrecision } from "@beep/effect-drizzle/pg"

Finite.pipe(doublePrecision()).meta.column?.kind // => "doublePrecision"
```

**Signature**

```ts
declare const doublePrecision: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "pg.doublePrecision requires a number-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.DoublePrecision; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L831)

##### enum

Named export for the PostgreSQL enum combinator.

**Signature**

```ts
declare const enum: { (): <I extends Field.Input>(input: I & ValidateEnum<I>) => Field.Patched<I, { readonly column: PgColumn.Enum<"", EnumValue<I>>; }>; <const Name extends string>(name: Name & ValidateSqlName<Name, "pg.enum name must be a lowercase SQL identifier">): <I extends Field.Input>(input: I & ValidateEnum<I>) => Field.Patched<I, { readonly column: PgColumn.Enum<Name, EnumValue<I>>; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L425)

##### enum_

Set a real PostgreSQL enum column whose values come from the encoded schema.

**When to use**

Use when a finite string domain should become a reusable PostgreSQL enum;
use `varchar` or `text` for open-ended strings.

**Details**

Omitting the name derives it from the declaring model field key. A broad
string schema is rejected because PostgreSQL enum values must be finite.

**Gotchas**

Omitting the name is safe only inside model construction, where the field key
resolves it. Assembly requires repeated enum names to use identical values.
Duplicate literals collapse in first-occurrence order; literals containing
NUL (U+0000) are rejected loudly. The empty string is a legal enum label; if
it is intended to mean absence, model absence explicitly with
`OptionFromNullOr(...)` so the encoded database value is `NULL`.

**Example** (Set a named enum)

```ts
import { Literals } from "effect/Schema"
import { enum as pgEnum } from "@beep/effect-drizzle/pg"

Literals(["draft", "active"]).pipe(pgEnum("status")).meta.column?.kind
// => "enum"
```

**Signature**

```ts
declare const enum_: { (): <I extends Field.Input>(input: I & ValidateEnum<I>) => Field.Patched<I, { readonly column: PgColumn.Enum<"", EnumValue<I>>; }>; <const Name extends string>(name: Name & ValidateSqlName<Name, "pg.enum name must be a lowercase SQL identifier">): <I extends Field.Input>(input: I & ValidateEnum<I>) => Field.Patched<I, { readonly column: PgColumn.Enum<Name, EnumValue<I>>; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L398)

##### generated

Sets a typed stored generated expression omitted from author writes.

**Details**

The expression carrier must equal the field's encoded carrier. The field
remains readable through select and JSON variants.

**Gotchas**

Schema expressions must render with zero parameters. Carrier typing does not
prove immutability or forbid generated-column chaining; PostgreSQL validates
those deeper semantics when DDL is applied.

**Example** (Set a generated expression)

```ts
import { sql } from "drizzle-orm"
import { String } from "effect/Schema"
import { generated } from "@beep/effect-drizzle/pg"

String.pipe(generated(sql<string>`lower(name)`)).meta.generated._tag // => "sqlExpr"
```

**Signature**

```ts
declare const generated: <Carrier>(expression: SQL<Carrier>) => <I extends Field.Input>(input: I & ValidateExpression<I, Carrier> & ValidateNotDefaulted<I> & ValidateNotVersion<I>) => Field.Patched<I, { readonly generated: Meta.GeneratedSqlExpr<Carrier>; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1649)

##### identity

Applies PostgreSQL identity generation after an integer-family column setter.

**When to use**

Use with `always` when callers must never author inserted ids, and `byDefault`
when explicit ids remain allowed. Use serial combinators for legacy policy.

**Details**

Identity-always is absent from insert but remains required in update as the
row locator. Identity-by-default is insert-optional and not generated.

**Gotchas**

Update membership for identity-always does not put the id in `SET`; repository
code consumes it in `WHERE`. Identity requires an explicit integer-family
column and is incompatible with defaults, versions, and arrays.

**Example** (Apply always identity generation)

```ts
import { Int } from "effect/Schema"
import { identity, integer } from "@beep/effect-drizzle/pg"

Int.pipe(integer(), identity()).meta.identity // => "always"
```

**Signature**

```ts
declare const identity: <const K extends "always" | "byDefault" = "always">(kind?: K) => <I extends Field.Input>(input: I & ValidateIdentity<I> & ValidateNotDefaulted<I> & ValidateNotGenerated<I> & ValidateNotVersion<I> & ValidateNotArray<I>) => Field.Patched<I, K extends "always" ? { readonly identity: K; readonly generated: Meta.GeneratedIdentityAlways; } : { readonly identity: K; readonly hasDefault: true; readonly generated: false; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1358)

##### index

Colocate a single-column btree index with the field it indexes.

**When to use**

Use for single-column indexes so the intent lives on the column instead of
a table-extras callback; keep the callback for multi-column or expression
indexes.

**Details**

Model construction harvests the intent into an ordinary index node named
`{table}_{column}_btree_idx` (respecting `columnName` overrides), before any
kit or model extras callback runs. Pass `name` to pin a legacy index name
the derivation cannot reproduce.

**Example** (Colocate an index on a column)

```ts
import { String } from "effect/Schema"
import { index, text } from "@beep/effect-drizzle/pg"

const field = String.pipe(text(), index())
field.meta.indexed // => { name: undefined, unique: false }
```

**See**

- `uniqueIndex` for the unique-index form.

**Signature**

```ts
declare const index: (options?: { readonly name?: string; }) => <I extends Field.Input>(input: I) => Field.Patched<I, { readonly indexed: { readonly name: string | undefined; readonly unique: false; }; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1239)

##### integer

Sets a PostgreSQL integer column on a number-encoded schema.

**Details**

EntityId schemas retain an `entityId<...>` identity for foreign-key equality;
ordinary number schemas use the plain `integer` identity. Both plain and
variant fields gain PostgreSQL's signed 32-bit value-domain check.

**Example** (Set an integer column)

```ts
import { Int } from "effect/Schema"
import { integer } from "@beep/effect-drizzle/pg"

Int.pipe(integer()).meta.column?.kind // => "integer"
```

**Signature**

```ts
declare const integer: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "pg.integer requires a number-encoded schema">) => Field.Patched<I, { readonly column: IntegerColumn<I>; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L773)

##### json

Sets textual PostgreSQL JSON storage distinct from JSONB.

**When to use**

Use when preserving the input JSON text representation matters; use `jsonb`
for normalized binary JSON and its indexing/operator support.

**Example** (Set JSON storage)

```ts
import { Boolean, Struct } from "effect/Schema"
import { json } from "@beep/effect-drizzle/pg"

Struct({ ok: Boolean }).pipe(json()).meta.column?.ident // => "json"
```

**Signature**

```ts
declare const json: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, object, "pg.json requires an object- or array-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Json; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L613)

##### jsonb

Sets normalized PostgreSQL JSONB storage on an object-encoded schema.

**When to use**

Use with queryable and indexable structured data; use `json()` when textual
representation preservation is required.

**Example** (Set a JSONB column)

```ts
import { String, Struct } from "effect/Schema"
import { jsonb } from "@beep/effect-drizzle/pg"

Struct({ theme: String }).pipe(jsonb()).meta.column?.kind // => "jsonb"
```

**Signature**

```ts
declare const jsonb: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, object, "pg.jsonb requires an object- or array-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Jsonb; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L941)

##### numeric

Sets an exact PostgreSQL numeric column carried as a string.

**Details**

Precision and scale are optional Drizzle configuration; string encoding
avoids narrowing arbitrary-precision decimal values to JavaScript numbers.
The encoded schema gains Effect v4's `isStringFinite` check
(`node_modules/effect/src/Schema.ts`, `isStringFinite`, lines 6765-6768).

**Example** (Set numeric precision and scale)

```ts
import { String } from "effect/Schema"
import { numeric } from "@beep/effect-drizzle/pg"

String.pipe(numeric(10, 2)).meta.column?.kind // => "numeric"
```

**Signature**

```ts
declare const numeric: { (): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.numeric requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Numeric<undefined, undefined>; }>; <const Precision extends number>(precision: Precision): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.numeric requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Numeric<Precision, undefined>; }>; <const Precision extends number, const Scale extends number>(precision: Precision, scale: Scale): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.numeric requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Numeric<Precision, Scale>; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L497)

##### primaryKey

Marks a non-nullable field as the inline primary key.

**Gotchas**

A model accepts at most one inline key; use `Table.compositePrimaryKey` for
multi-column keys. Arrays and nullable carriers are rejected.

**Example** (Mark a primary key)

```ts
import { String } from "effect/Schema"
import { primaryKey } from "@beep/effect-drizzle/pg"

String.pipe(primaryKey()).meta.primaryKey // => true
```

**Signature**

```ts
declare const primaryKey: () => <I extends Field.Input>(input: I & Field.ValidateNonNullable<I, "primaryKey() forbids a nullable schema \u2014 a primary key cannot admit null"> & ValidateNotArray<I>) => Field.Patched<I, { readonly primaryKey: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1180)

##### real

Sets a PostgreSQL single-precision real column.

**When to use**

Use when single precision is intentional; ordinary number derivation
and `doublePrecision()` retain wider precision.

**Example** (Set real storage)

```ts
import { Number } from "effect/Schema"
import { real } from "@beep/effect-drizzle/pg"

Number.pipe(real()).meta.column?.ident // => "real"
```

**Signature**

```ts
declare const real: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "pg.real requires a number-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Real; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L640)

##### references

Attaches a foreign-key target and referential actions to a field.

**Signature**

```ts
declare const references: <const Id extends EntityIdLike, const Options extends ReferenceOptions | undefined = undefined>(id: Id, options?: Options & ValidateReferenceName<Options>) => <I extends Field.Input>(input: I & ValidateReferenceActions<NoInfer<I>, Options>) => Field.Patched<I, { readonly references: Meta.References<Id["tableName"], "id">; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1787)

##### serial

Sets a PostgreSQL serial column and marks inserts as defaulted.

**When to use**

Use with legacy serial semantics. Prefer `integer().pipe(identity())` when the
choice between identity-always and identity-by-default matters.

**Example** (Set a serial column)

```ts
import { Int } from "effect/Schema"
import { serial } from "@beep/effect-drizzle/pg"

Int.pipe(serial()).meta.hasDefault // => true
```

**Signature**

```ts
declare const serial: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "pg.serial requires a number-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Serial; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L892)

##### smallint

Set a PostgreSQL smallint column on a number-encoded schema.

**Details**

Plain and variant fields gain the signed 16-bit range check.

**Example** (Set a smallint column)

```ts
import { Int } from "effect/Schema"
import { smallint } from "@beep/effect-drizzle/pg"

Int.pipe(smallint()).meta.column?.kind // => "smallint"
```

**Signature**

```ts
declare const smallint: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "pg.smallint requires a number-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Smallint; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L807)

##### smallserial

Sets a PostgreSQL smallserial column and marks inserts as defaulted.

**Example** (Set smallserial storage)

```ts
import { Int } from "effect/Schema"
import { smallserial } from "@beep/effect-drizzle/pg"

Int.pipe(smallserial()).meta.hasDefault // => true
```

**Signature**

```ts
declare const smallserial: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "pg.smallserial requires a number-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Smallserial; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L708)

##### text

Set an unbounded PostgreSQL text column on a string-encoded schema.

**Example** (Set a text column)

```ts
import { String } from "effect/Schema"
import { text } from "@beep/effect-drizzle/pg"

const field = String.pipe(text())
field.meta.column?.kind // => "text"
```

**Signature**

```ts
declare const text: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.text requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Text; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L183)

##### timestamp

Sets a timestamp column with explicit carrier and timezone policy.

**When to use**

Use with string mode for Effect's ISO-encoded date-time schemas and date mode only
for schemas encoded as JavaScript `Date`. Disable timezone only for deliberately
zone-free database values.

**Gotchas**

Carrier mode is an encoded-side choice, not a Type-side convenience. A
millis-encoded schema does not fit timestamp storage.

**Example** (Set a string timestamp)

```ts
import { String } from "effect/Schema"
import { timestamp } from "@beep/effect-drizzle/pg"

String.pipe(timestamp()).meta.column?.kind // => "timestamp"
```

**Signature**

```ts
declare const timestamp: { <const TZ extends boolean = true>(options?: { readonly mode?: "string"; readonly withTimezone?: TZ; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.timestamp (string mode) requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Timestamp<"string", TZ>; }>; <const TZ extends boolean = true>(options: { readonly mode: "date"; readonly withTimezone?: TZ; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, Date, "pg.timestamp (date mode) requires a Date-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Timestamp<"date", TZ>; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1008)

##### unique

Mark a field as carrying a single-column unique constraint.

**Example** (Mark a unique field)

```ts
import { String } from "effect/Schema"
import { unique } from "@beep/effect-drizzle/pg"

String.pipe(unique()).meta.unique // => true
```

**Signature**

```ts
declare const unique: () => <I extends Field.Input>(input: I) => Field.Patched<I, { readonly unique: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1204)

##### uniqueIndex

Colocate a single-column unique index with the field it constrains.

**When to use**

Use when DDL compatibility requires a named unique index rather than the
inline `unique()` column constraint, and the index covers one column.

**Details**

Model construction harvests the intent into a unique-index node named
`{table}_{column}_unique_idx` (respecting `columnName` overrides). Pass
`name` to pin a legacy index name the derivation cannot reproduce.

**Example** (Colocate a unique index on a column)

```ts
import { String } from "effect/Schema"
import { text, uniqueIndex } from "@beep/effect-drizzle/pg"

const field = String.pipe(text(), uniqueIndex())
field.meta.indexed // => { name: undefined, unique: true }
```

**See**

- `index` for the non-unique form.
- `unique` for the inline unique column constraint.

**Signature**

```ts
declare const uniqueIndex: (options?: { readonly name?: string; }) => <I extends Field.Input>(input: I) => Field.Patched<I, { readonly indexed: { readonly name: string | undefined; readonly unique: true; }; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1277)

##### unsafeCustom

Sets an explicitly unsafe custom PostgreSQL type with no carrier validation.

**When to use**

Use when extension or domain types are not modeled by the built-in combinators.

**Gotchas**

The SQL type string is emitted verbatim, and foreign-key compatibility uses
exact `custom<...>` identity rather than validating the schema carrier.

**Example** (Set a tsvector column)

```ts
import { String } from "effect/Schema"
import { unsafeCustom } from "@beep/effect-drizzle/pg"

String.pipe(unsafeCustom("tsvector")).meta.column?.ident // => "custom<tsvector>"
```

**Signature**

```ts
declare const unsafeCustom: <const SqlType extends string>(sqlType: SqlType) => <I extends Field.Input>(input: I) => Field.Patched<I, { readonly column: PgColumn.Custom<SqlType>; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L451)

##### unsafeDefaultSql

Sets an explicitly unsafe raw-SQL default.

**When to use**

Use when only trusted raw SQL can represent the default.

**Gotchas**

The string bypasses carrier checking, parameterization, and escaping.

**Example** (Set a raw default)

```ts
import { String } from "effect/Schema"
import { unsafeDefaultSql } from "@beep/effect-drizzle/pg"

String.pipe(unsafeDefaultSql("current_user")).meta.hasDefault // => true
```

**Signature**

```ts
declare const unsafeDefaultSql: (sql: string) => <I extends Field.Input>(input: I & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.UnsafeDefaultSql; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1527)

##### unsafeGeneratedSql

Sets an explicitly unsafe stored generated expression.

**When to use**

Use when only trusted raw SQL can represent the generated expression.

**Gotchas**

The raw statement bypasses carrier checking and escaping.

**Example** (Set a raw generated expression)

```ts
import { String } from "effect/Schema"
import { unsafeGeneratedSql } from "@beep/effect-drizzle/pg"

String.pipe(unsafeGeneratedSql("lower(name)")).meta.generated._tag // => "unsafeSql"
```

**Signature**

```ts
declare const unsafeGeneratedSql: (sql: string) => <I extends Field.Input>(input: I & ValidateNotDefaulted<I> & ValidateNotVersion<I>) => Field.Patched<I, { readonly generated: Meta.UnsafeGeneratedSql; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1681)

##### uuid

Set a PostgreSQL UUID column on a string-encoded schema.

**Details**

Plain string schemas gain Effect v4's UUID format check
(`node_modules/effect/src/Schema.ts`, `isUUID`, lines 6913-6925).

**Example** (Set a UUID column)

```ts
import { String } from "effect/Schema"
import { uuid } from "@beep/effect-drizzle/pg"

String.pipe(uuid()).meta.column?.kind // => "uuid"
```

**Signature**

```ts
declare const uuid: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.uuid requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Uuid; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L738)

##### varchar

Sets a varchar column while keeping schema and storage bounds aligned.

**When to use**

Use when a string needs a database length bound. Prefer `text()` when no
meaningful maximum exists and `char()` only for genuinely fixed-width data.

**Details**

- `pg.varchar()` — DERIVE: the length comes from the schema's `isMaxLength`
  check (tightest bound wins); no check is a loud construction error.
- `pg.varchar(n)` on a schema WITH a maxLength `m` — VERIFY: `m ≤ n` passes,
  `m > n` fails at model construction (column would truncate).
- `pg.varchar(n)` on a plain schema WITHOUT one — INJECT: the field's schema
  gains `check(isMaxLength(n))`, so the domain validates exactly what
  the column enforces. Variant-field inputs are verify-only (their per-variant
  codecs are author-owned).

**Gotchas**

Derive mode fails without an `isMaxLength` check. An explicit length on a
variant field verifies existing codecs but never rewrites them.

**Example** (Derive varchar length)

```ts
import { String, isMaxLength } from "effect/Schema"
import { varchar } from "@beep/effect-drizzle/pg"

const field = String.check(isMaxLength(320)).pipe(varchar())
field.meta.column?.kind // => "varchar"
```

**Signature**

```ts
declare const varchar: { (): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.varchar requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Varchar; }>; <const L extends number>(length: L): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "pg.varchar requires a string-encoded schema">) => Field.Patched<I, { readonly column: PgColumn.Varchar<L>; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L342)

##### version

Marks one number-encoded integer-family field as the optimistic-concurrency token.

**When to use**

Use with `makeRepository` when updates must compare and increment one version
atomically.

**Details**

The field is optional on insert so its SQL default applies, required on
update as the expected version, and present on selected and JSON rows.

**Gotchas**

Every update payload must include the current version. Native-bigint and
explicit variant fields are rejected; version fields also cannot use
identity, generated-column, or array semantics.

**Example** (Mark a row version)

```ts
import { Int } from "effect/Schema"
import { default as defaultValue, integer, version } from "@beep/effect-drizzle/pg"

Int.pipe(integer(), defaultValue(1), version()).meta.version // => true
```

**Signature**

```ts
declare const version: () => <I extends Field.Input>(input: I & ValidateVersionColumn<I> & ValidateVersionCompatibility<I> & ValidateVersionSchema<I> & Field.ValidateNonNullable<I, "version() forbids a nullable schema"> & ValidateNotArray<I>) => Field.Patched<I, { readonly version: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/combinators.ts#L1586)

### PostgreSQL table extras — `@beep/effect-drizzle/pg`

Models PostgreSQL table constraints and indexes as typed descriptor nodes.

Model callbacks receive bound Drizzle columns, return this small algebra,
and defer compilation until the owning table is projected.

#### constructors

##### Check

Constructs a typed check-constraint node.

**Example** (Infer the constructed node type)

```ts
import { Table } from "@beep/effect-drizzle/pg"

type Made = ReturnType<typeof Table.Check.make> // => tagged check node
```

**See**

- `check` for the validated factory used in table extras.

**Signature**

```ts
declare const Check: { make: TaggedEnum.ConstructorFrom<{ readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }, "_tag">; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L421)

##### CompositePrimaryKey

Constructs a composite primary-key node.

**Example** (Infer the constructed node type)

```ts
import { Table } from "@beep/effect-drizzle/pg"

type Made = ReturnType<typeof Table.CompositePrimaryKey.make> // => tagged compositePrimaryKey node
```

**See**

- `compositePrimaryKey` for the validated factory used in table extras.

**Signature**

```ts
declare const CompositePrimaryKey: { make: TaggedEnum.ConstructorFrom<{ readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }, "_tag">; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L365)

##### CompositeUnique

Constructs a composite unique-constraint node.

**Example** (Infer the constructed node type)

```ts
import { Table } from "@beep/effect-drizzle/pg"

type Made = ReturnType<typeof Table.CompositeUnique.make> // => tagged compositeUnique node
```

**See**

- `compositeUnique` for the validated factory used in table extras.

**Signature**

```ts
declare const CompositeUnique: { make: TaggedEnum.ConstructorFrom<{ readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }, "_tag">; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L349)

##### Index

Constructs an index node.

**Example** (Infer the constructed node type)

```ts
import { Table } from "@beep/effect-drizzle/pg"

type Made = ReturnType<typeof Table.Index.make> // => tagged index node
```

**See**

- `index` for the validated factory used in table extras.

**Signature**

```ts
declare const Index: { make: TaggedEnum.ConstructorFrom<{ readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; }, "_tag">; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L381)

##### Node

Constructors, guard, and exhaustive matcher for table-extra nodes.

**Example** (Construct and recognize a PostgreSQL check)

```ts
import { Table } from "@beep/effect-drizzle/pg"

const node = Table.UnsafeCheckSql.make({ name: "positive_count", sql: "count > 0" })
Table.Node.is(node) // => true
```

**Signature**

```ts
declare const Node: { $is: <Tag extends "compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql">(tag: Tag) => (u: unknown) => u is Extract<{ readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }, { readonly _tag: Tag; }>; $match: { <Cases extends { readonly compositeUnique: (args: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly compositePrimaryKey: (args: { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly index: (args: { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; }) => any; readonly uniqueIndex: (args: { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly check: (args: { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }) => any; readonly unsafeCheckSql: (args: { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => any; }>(cases: Cases): (value: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; } | { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => Unify<ReturnType<Cases["compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql"]>>; <Cases extends { readonly compositeUnique: (args: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly compositePrimaryKey: (args: { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly index: (args: { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; }) => any; readonly uniqueIndex: (args: { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly check: (args: { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }) => any; readonly unsafeCheckSql: (args: { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => any; }>(value: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; } | { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }, cases: Cases): Unify<ReturnType<Cases["compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql"]>>; }; is: (value: unknown) => value is Node; match: { <Cases extends { readonly compositeUnique: (args: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly compositePrimaryKey: (args: { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly index: (args: { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; }) => any; readonly uniqueIndex: (args: { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly check: (args: { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }) => any; readonly unsafeCheckSql: (args: { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => any; }>(cases: Cases): (value: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; } | { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => Unify<ReturnType<Cases["compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql"]>>; <Cases extends { readonly compositeUnique: (args: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly compositePrimaryKey: (args: { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly index: (args: { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; }) => any; readonly uniqueIndex: (args: { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly check: (args: { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }) => any; readonly unsafeCheckSql: (args: { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => any; }>(value: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly using: PgIndexMethod | undefined; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; } | { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }, cases: Cases): Unify<ReturnType<Cases["compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql"]>>; }; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L508)

##### UniqueIndex

Constructs a named unique-index node.

**Example** (Infer the constructed node type)

```ts
import { Table } from "@beep/effect-drizzle/pg"
import { pgTable, text } from "drizzle-orm/pg-core"

const user = pgTable("user", { email: text("email").notNull() }, (columns) => [
  Table.UniqueIndex.make({
    name: "user_email_unique_idx",
    columns: [columns.email],
    where: undefined
  })
])
console.log(user.email.name)
```

**See**

- `uniqueIndex` for the validated factory used in table extras.

**Signature**

```ts
declare const UniqueIndex: { make: TaggedEnum.ConstructorFrom<{ readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }, "_tag">; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L405)

##### UnsafeCheckSql

Constructs an explicitly unsafe SQL check node.

**Example** (Build an unsafe SQL check node)

```ts
import { Table } from "@beep/effect-drizzle/pg"

const node = Table.UnsafeCheckSql.make({ name: "user_name_check", sql: "name <> ''" })
console.log(node._tag) // "unsafeCheckSql"
```

**See**

- `unsafeCheckSql` for the validated factory used in table extras.

**Signature**

```ts
declare const UnsafeCheckSql: { make: TaggedEnum.ConstructorFrom<{ readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }, "_tag">; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L438)

##### check

Constructs a typed SQL check in data-first or data-last form.

**When to use**

Use when Drizzle's typed SQL builder can express the constraint.

**Gotchas**

CHECK expressions must render with zero parameters. BSL does not parse SQL or
detect forbidden subqueries; PostgreSQL remains the semantic authority.

**Example** (Define a typed check)

```ts
import { sql } from "drizzle-orm"
import { Table } from "@beep/effect-drizzle/pg"

Table.check("positive_count")(sql<boolean>`count > 0`)._tag // => "check"
```

**See**

- `unsafeCheckSql` for an explicitly raw alternative.

**Signature**

```ts
declare const check: { <const Name extends string>(name: Name & ValidateSqlName<Name, "Table.check name must be a lowercase SQL identifier">): (expression: SQL<boolean>) => Check; <const Name extends string>(expression: SQL<boolean>, name: Name & ValidateSqlName<Name, "Table.check name must be a lowercase SQL identifier">): Check; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L696)

##### compositePrimaryKey

Constructs a named primary key over at least two columns.

**When to use**

Use with junction or natural-key tables; a model permits only one inline
single-column primary key.

**Example** (Define a composite primary key)

```ts
import { Int } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/pg"

const extras: Table.Callback<{ leftId: typeof Int; rightId: typeof Int }> =
  (columns) => [
    Table.compositePrimaryKey("membership_pk", [columns.leftId, columns.rightId])
  ] // => callback producing one compositePrimaryKey node
```

**Signature**

```ts
declare const compositePrimaryKey: <const Name extends string, const Columns extends CompositeColumns>(name: Name & ValidateSqlName<Name, "Table.compositePrimaryKey name must be a lowercase SQL identifier">, columns: Columns & ValidateDistinctColumns<Columns> & ValidatePrimaryKeyColumns<Columns>) => CompositePrimaryKey
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L587)

##### compositeUnique

Constructs a named unique constraint over at least two columns.

**Example** (Define a composite unique constraint)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/pg"

const extras: Table.Callback<{ first: typeof String; last: typeof String }> =
  (columns) => [
    Table.compositeUnique("person_name_unique", [columns.first, columns.last])
  ] // => callback producing one compositeUnique node
```

**Signature**

```ts
declare const compositeUnique: <const Name extends string, const Columns extends CompositeColumns>(name: Name & ValidateSqlName<Name, "Table.compositeUnique name must be a lowercase SQL identifier">, columns: Columns & ValidateDistinctColumns<Columns>) => CompositeUnique
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L559)

##### index

Constructs a PostgreSQL index with an optional method and predicate.

**Details**

At least one column is required. `where` creates a partial index and `using`
selects the PostgreSQL index method.

**Gotchas**

Partial predicates must render with zero parameters. BSL does not analyze SQL
semantics such as function immutability; PostgreSQL validates them when DDL
is applied.

**Example** (Define a partial index)

```ts
import { sql } from "drizzle-orm"
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/pg"

const extras: Table.Callback<{ email: typeof String }> = (columns) => [
  Table.index("user_email_idx", [columns.email], {
    using: "btree",
    where: sql<boolean>`${columns.email} <> ''`
  })
] // => callback producing one partial index node
```

**Signature**

```ts
declare const index: <const Name extends string, const Columns extends NonEmptyColumns>(name: Name & ValidateSqlName<Name, "Table.index name must be a lowercase SQL identifier">, columns: Columns & ValidateDistinctColumns<Columns>, options?: { readonly using?: PgIndexMethod; readonly where?: SQL<boolean>; }) => Index
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L624)

##### uniqueIndex

Constructs a named unique index over one or more columns.

**When to use**

Use when DDL compatibility requires an index rather than a table-level
unique constraint.

**Example** (Define a public-id unique index)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/pg"

const extras: Table.Callback<{ publicId: typeof String }> = (columns) => [
  Table.uniqueIndex("account_public_id_unique_idx", [columns.publicId])
]

console.log(extras)
```

**Signature**

```ts
declare const uniqueIndex: <const Name extends string, const Columns extends NonEmptyColumns>(name: Name & ValidateSqlName<Name, "Table.uniqueIndex name must be a lowercase SQL identifier">, columns: Columns & ValidateDistinctColumns<Columns>, options?: { readonly where?: SQL<boolean>; }) => UniqueIndex
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L660)

##### unsafeCheckSql

Constructs an explicitly unsafe raw-SQL check descriptor.

**When to use**

Use when only raw SQL can represent the constraint.

**Gotchas**

The statement is emitted verbatim and is not parameterized or escaped.

**Example** (Define a raw check)

```ts
import { Table } from "@beep/effect-drizzle/pg"

Table.unsafeCheckSql("positive_count", "count > 0")._tag
// => "unsafeCheckSql"
```

**See**

- `check` for typed SQL checks.

**Signature**

```ts
declare const unsafeCheckSql: <const Name extends string>(name: Name & ValidateSqlName<Name, "Table.unsafeCheckSql name must be a lowercase SQL identifier">, value: string) => UnsafeCheckSql
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L730)

#### guards

##### isNode

Guards the tag and required outer shape of an author-returned extra node.

**When to use**

Use when values cross a hand-built or type-suppressed extras callback boundary.

**Gotchas**

The check is deliberately shallow; it does not validate Drizzle column
internals or execute SQL expressions.

**Example** (Guard an unknown extra)

```ts
import { Table } from "@beep/effect-drizzle/pg"

const candidate: unknown = Table.unsafeCheckSql("positive_count", "count > 0")

Table.isNode(candidate) // => true
```

**See**

- `Node` for constructors and exhaustive matching.

**Signature**

```ts
declare const isNode: (value: unknown) => value is Node
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L491)

#### mappers

##### emit

Compiles one table-extra descriptor to a Drizzle PostgreSQL config value.

**Details**

Exhaustive tag matching selects the corresponding public Drizzle builder;
raw SQL appears only in the explicitly unsafe variant.

**Example** (Emit a Drizzle check)

```ts
import { Table } from "@beep/effect-drizzle/pg"

Table.emit(Table.unsafeCheckSql("positive_count", "count > 0"))
// => Drizzle PostgreSQL check builder
```

**Signature**

```ts
declare const emit: (node: Node) => PgTableExtraConfigValue
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L820)

#### models

##### Check (type alias)

Describes a check backed by a typed Drizzle SQL expression.

**When to use**

Use when the check can be expressed through Drizzle's typed SQL builder.

**Example** (Construct a typed check node)

```ts
import { sql } from "drizzle-orm"
import { Table } from "@beep/effect-drizzle/pg"

Table.Check.make({
  name: "positive_count",
  expression: sql<boolean>`count > 0`
})._tag // => "check"
```

**See**

- `UnsafeCheckSql` for raw SQL without typed interpolation.

**Signature**

```ts
type Check = Extract<Node, { readonly _tag: "check" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L302)

##### CompositePrimaryKey (type alias)

Describes a named primary key over at least two bound columns.

**Example** (Construct a composite primary-key node)

```ts
import { Int } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/pg"

const extras: Table.Callback<{ leftId: typeof Int; rightId: typeof Int }> =
  (columns) => [Table.CompositePrimaryKey.make({
    name: "membership_pk",
    columns: [columns.leftId, columns.rightId]
  })] // => one compositePrimaryKey node
```

**See**

- `compositePrimaryKey` for the concise constructor.

**Signature**

```ts
type CompositePrimaryKey = Extract<Node, { readonly _tag: "compositePrimaryKey" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L226)

##### CompositeUnique (type alias)

Describes a named unique constraint over at least two bound columns.

**Example** (Construct a composite unique node)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/pg"

const extras: Table.Callback<{ first: typeof String; last: typeof String }> =
  (columns) => [Table.CompositeUnique.make({
    name: "person_name_unique",
    columns: [columns.first, columns.last]
  })] // => one compositeUnique node
```

**See**

- `compositeUnique` for the concise constructor.

**Signature**

```ts
type CompositeUnique = Extract<Node, { readonly _tag: "compositeUnique" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L204)

##### Index (type alias)

Describes a PostgreSQL index, including method and optional predicate.

**Example** (Construct an index node)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/pg"

const extras: Table.Callback<{ email: typeof String }> = (columns) => [
  Table.Index.make({
    name: "user_email_idx",
    columns: [columns.email],
    using: "btree",
    where: undefined
  })
] // => one index node
```

**See**

- `index` for the concise constructor.

**Signature**

```ts
type Index = Extract<Node, { readonly _tag: "index" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L251)

##### Node (type alias)

Represents every PostgreSQL table-extra descriptor accepted from a model.

**Details**

The closed union contains composite unique and primary keys, indexes, typed
checks, and explicitly unsafe raw-SQL checks. The value companion exposes
shallow guards and exhaustive matching.

**Gotchas**

`Node.is` validates the tag and required outer fields, not complete Drizzle
column internals. It protects the callback seam rather than decoding input.

**Example** (Match a table-extra node)

```ts
import { Table } from "@beep/effect-drizzle/pg"

const node = Table.unsafeCheckSql("user_name_check", "name <> ''")

Table.Node.is(node) // => true
Table.Node.match(node, {
  check: () => "typed",
  compositePrimaryKey: () => "primary",
  compositeUnique: () => "unique",
  index: () => "index",
  uniqueIndex: () => "unique-index",
  unsafeCheckSql: () => "unsafe"
}) // => "unsafe"
```

**See**

- `isNode` for the callback-boundary guard.

**Signature**

```ts
type Node = TaggedEnum<NodeDefinition>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L182)

##### UniqueIndex (type alias)

Describes a named unique index over one or more PostgreSQL columns.

**Example** (Construct a unique index node)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/pg"

const extras: Table.Callback<{ email: typeof String }> = (columns) => [
  Table.UniqueIndex.make({
    name: "user_email_unique_idx",
    columns: [columns.email],
    where: undefined
  })
]

console.log(extras)
```

**See**

- `uniqueIndex` for the concise constructor.

**Signature**

```ts
type UniqueIndex = Extract<Node, { readonly _tag: "uniqueIndex" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L277)

##### UnsafeCheckSql (type alias)

Describes a raw-SQL check whose safety is owned entirely by the caller.

**When to use**

Use when only raw SQL can represent the constraint.

**Gotchas**

The SQL string is emitted verbatim and receives no carrier validation,
escaping, or parameterization.

**Example** (Construct an unsafe check node)

```ts
import { Table } from "@beep/effect-drizzle/pg"

Table.UnsafeCheckSql.make({
  name: "positive_count",
  sql: "count > 0"
})._tag // => "unsafeCheckSql"
```

**See**

- `Check` for typed SQL checks.

**Signature**

```ts
type UnsafeCheckSql = Extract<Node, { readonly _tag: "unsafeCheckSql" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L331)

#### projections

##### BoundColumns (type alias)

Maps a field record to the key-preserving columns received by table extras.

**Example** (Project bound columns)

```ts
import { String } from "effect/Schema"
import type { Table } from "@beep/effect-drizzle/pg"

type Columns = Table.BoundColumns<{ readonly email: typeof String }>
type Email = Columns["email"] // => bound PostgreSQL email column
```

**Signature**

```ts
type BoundColumns<F> = {
  readonly [K in keyof F & string]: BoundColumn<F[K], K>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L100)

#### tables

##### BoundColumn (type alias)

Retains a field's schema type on the Drizzle column exposed to table extras.

**Example** (Name a bound PostgreSQL column)

```ts
import { String } from "effect/Schema"
import type { Table } from "@beep/effect-drizzle/pg"

type NameColumn = Table.BoundColumn<typeof String>
// => PostgreSQL extra-config column carrying the name field type
```

**Signature**

```ts
type BoundColumn<I, Name> = ExtraConfigColumn & {
  readonly "~effect-drizzle.field"?: I;
  readonly "~effect-drizzle.field-name"?: Name;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L79)

##### Callback (type alias)

Types a model callback that builds table extras from bound columns.

**Details**

Column keys and originating field types are preserved. Returned nodes are
compiled only after the Drizzle table supplies real bound columns.

**Example** (Declare a PostgreSQL extras callback)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/pg"

const extras: Table.Callback<{ email: typeof String }> = (columns) => [
  Table.index("user_email_idx", [columns.email])
] // => callback producing one index node
```

**Signature**

```ts
type Callback<F> = (
  columns: BoundColumns<F>
) => ReadonlyArray<Node>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/extras.ts#L537)

### PostgreSQL models — `@beep/effect-drizzle/pg`

Builds PostgreSQL-aware Effect model classes from schema-owned fields.

`class User extends EffectDrizzle.Model<User>(identifier)(fields) {}` produces an
Effect schema class (via `@beep/effect-drizzle`'s own `VariantSchema.make` instance — the same
six variants as effect's `Model`, so `SqlModel.makeRepository` compatibility
stays structural) with `sql` statics carrying the resolved SQL metadata.

Whole-model invariants are enforced twice, at different altitudes:
- compile time: the `fields` parameter intersects `ValidateFields<F>`, so an
  underivable column or a second primary key fails on the offending key with
  a `~effect-drizzle.error` message literal;
- construction time: runtime checks mirror the same rules (nullable PK,
  multiple PKs) as tagged errors, catching hand-built field nodes.

#### errors

##### MissingSelfGeneric (type alias)

Compile-time diagnostic returned when `Model` omits its self type.

**Signature**

```ts
type MissingSelfGeneric = `Missing \`Self\` generic — use \`class Self extends EffectDrizzle.Model<Self>(identifier)({ ... }) {}\``
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L322)

##### ModelInvariantError

Internal dialect re-export of the shared model invariant error.

**Signature**

```ts
declare const ModelInvariantError: typeof ModelInvariantError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L59)

#### factories

##### Model

Builds a PostgreSQL model class whose schemas own resolved SQL metadata.

**When to use**

Use when standalone models and tables intentionally opt out of kit
defaults; use a kit's `Entity` factory for invariant shared columns.

**Details**

The identifier's final segment becomes a snake-case table name. Field
schemas drive model variants, Drizzle column metadata, automatic EntityId
references, and optional table extras from one declaration. Pass annotations
as the second argument and table extras as the third when both are needed.

**Gotchas**

Supply the class itself as `Self`. PostgreSQL and SQLite column descriptors
cannot be mixed, and constructor-time validation still runs if type errors
were suppressed.

**Example** (Define a `@beep/effect-drizzle` model)

```ts
import { String } from "effect/Schema"
import { Model } from "@beep/effect-drizzle"

class User extends Model<User>("User")({ name: String }) {}
User.sql.tableName // => "user"
Object.keys(User.insert.fields) // => ["name"]
```

**See**

- `ValidateFields` for compile-time model invariants.

**Signature**

```ts
declare const Model: <Self = never, const Identifier extends string = string>(identifier: Identifier & ValidateDerivedSqlName<Identifier, "Model identifier derives an invalid PostgreSQL table name">) => <const F extends FieldsInput>(fields: F & ValidateFields<F>, annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<F>, extras?: TableExtras.Callback<F>) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L794)

#### models

##### AnyModel (interface)

Structural model bound accepted by PostgreSQL projectors and assembly.

**When to use**

Use as a generic constraint for utilities that consume any PostgreSQL model
without preserving its exact fields.

**Example** (Accept any `@beep/effect-drizzle` model)

```ts
import { String } from "effect/Schema"
import { Model, type AnyModel } from "@beep/effect-drizzle"

const tableName = (model: AnyModel) => model.sql.tableName
class User extends Model<User>("User")({ name: String }) {}

tableName(User) // => "user"
```

**Signature**

```ts
export interface AnyModel extends CoreAnyModel {
  readonly sql: {
    readonly tableName: string;
    readonly fields: FieldsInput;
    readonly columns: Record<string, Meta.Meta<PgColumn.Spec>>;
    readonly extras: ((columns: never) => ReadonlyArray<TableExtras.Node>) | undefined;
  };
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L409)

##### ColumnsOf (type alias)

Projects every declared field to its resolved PostgreSQL metadata.

**Details**

Keys are preserved while explicit metadata, encoded-carrier derivation,
physical names, and EntityId references are merged.

**Example** (Project field metadata)

```ts
import { String } from "effect/Schema"
import type { ColumnsOf } from "@beep/effect-drizzle"

type Columns = ColumnsOf<{ readonly displayName: typeof String }>
type Column = Columns["displayName"]["column"] // => PostgreSQL text descriptor
```

**Signature**

```ts
type ColumnsOf<F> = {
  readonly [K in keyof F]: ResolvedMetaOf<F[K], K & string>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L137)

##### EffectiveSchema (type alias)

Applies SQL write strategy to a field's six Effect model variants.

**Details**

Ordinary fields appear everywhere, with defaults optional on insert and all
ordinary updates optional. Generated expressions are read-only. Identity-
always fields remain in update only as row locators, and version fields are
optional on insert but required on update.

**Gotchas**

Identity-always update membership does not authorize changing the identity;
repository updates consume it for `WHERE`. Explicit `VariantField` inputs
retain their author-defined membership instead of this derived truth table.

**Example** (Infer effective membership)

```ts
import { String } from "effect/Schema"
import type { EffectiveSchema } from "@beep/effect-drizzle"

type NameField = EffectiveSchema<typeof String>
type Update = NameField["schemas"]["update"] // => optional String schema
```

**Signature**

```ts
type EffectiveSchema<I> = Field.SchemaFrom<I> extends VariantSchema.Field.Any
    ? Field.SchemaFrom<I>
    : Field.SchemaFrom<I> extends Top
      ? PlainVariants<Field.SchemaFrom<I>, ResolvedMetaOf<I>>
      : never
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L199)

##### FieldExcept

Shared variant helpers exposed by the PostgreSQL model surface.

**Signature**

```ts
declare const FieldExcept: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => VariantSchema.Field<{ readonly [K in Exclude<"update", Keys[number]> | Exclude<"insert", Keys[number]> | Exclude<"select", Keys[number]> | Exclude<"json", Keys[number]> | Exclude<"jsonCreate", Keys[number]> | Exclude<"jsonUpdate", Keys[number]>]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L47)

##### FieldOnly

Shared variant helpers exposed by the PostgreSQL model surface.

**Signature**

```ts
declare const FieldOnly: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => VariantSchema.Field<{ readonly [K in Keys[number]]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L48)

##### FieldsInput (interface)

Describes the string-keyed field record accepted by `Model`.

**Details**

Each property is either an Effect schema or a pipeable field that already
carries SQL metadata.

**Example** (Declare a field record)

```ts
import { String } from "effect/Schema"
import type { FieldsInput } from "@beep/effect-drizzle"

type UserFields = { readonly name: typeof String }
type Accepted = UserFields extends FieldsInput ? true : false // => true
```

**Signature**

```ts
export interface FieldsInput {
  readonly [key: string]: Field.Input;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L82)

##### ModelClass (type alias)

Combines an Effect variant class with resolved SQL statics.

**Details**

The class constructor represents the select variant and exposes all six
operation schemas as statics alongside `sql` metadata.

**Example** (Name a generated model type)

```ts
import { String } from "effect/Schema"
import type { ModelClass } from "@beep/effect-drizzle"

interface User { readonly name: string }
type Generated = ModelClass<User, { readonly name: typeof String }>
type Insert = Generated["insert"]["Type"] // => { readonly name: string }
```

**Signature**

```ts
type ModelClass<Self, F> = VariantSchema.Class<
  Self,
  UnwrappedFields<F>,
  StructSchema<VariantSchema.ExtractFields<"select", UnwrappedFields<F>, true>>
> & {
  readonly [Va in Variant]: VariantSchema.Extract<Va, VariantSchema.Struct<UnwrappedFields<F>>>;
} & Statics<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L378)

##### Statics (interface)

Metadata statics attached by `@beep/effect-drizzle` to every generated model class.

**Details**

`sql` retains the derived table name, original field record, resolved column
metadata, and optional table-extras callback.

**Example** (Read model statics)

```ts
import { String } from "effect/Schema"
import type { Statics } from "@beep/effect-drizzle"

type UserStatics = Statics<{ readonly name: typeof String }>
type Fields = UserStatics["sql"]["fields"]
// => { readonly name: typeof String }
```

**Signature**

```ts
export interface Statics<F extends FieldsInput> {
  readonly sql: {
    readonly tableName: string;
    readonly fields: F;
    readonly columns: ColumnsOf<F>;
    readonly extras: TableExtras.Callback<F> | undefined;
  };
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L347)

##### Variant

Shared variant helpers exposed by the PostgreSQL model surface.

**Signature**

```ts
declare const Variant: { is: { select: (value: unknown) => value is "select"; insert: (value: unknown) => value is "insert"; update: (value: unknown) => value is "update"; json: (value: unknown) => value is "json"; jsonCreate: (value: unknown) => value is "jsonCreate"; jsonUpdate: (value: unknown) => value is "jsonUpdate"; }; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L50)

##### VariantField

Shared variant helpers exposed by the PostgreSQL model surface.

**Signature**

```ts
declare const VariantField: <const A extends VariantSchema.Field.ConfigWithKeys<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(config: A & { readonly [K in Exclude<keyof A, "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">]: never; }) => VariantSchema.Field<A>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L51)

##### extract

Shared variant helpers exposed by the PostgreSQL model surface.

**Signature**

```ts
declare const extract: { <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">(variant: V): <A extends VariantSchema.Struct<any>>(self: A) => VariantSchema.Extract<V, A, V extends "select" ? true : false>; <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate", A extends VariantSchema.Struct<any>>(self: A, variant: V): VariantSchema.Extract<V, A, V extends "select" ? true : false>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L46)

##### fieldEvolve

Shared variant helpers exposed by the PostgreSQL model surface.

**Signature**

```ts
declare const fieldEvolve: { <Self extends VariantSchema.Field<any> | Top, const Mapping extends Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(f: Mapping): (self: Self) => VariantSchema.Field<Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; <Self extends VariantSchema.Field<any> | Top, const Mapping extends Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(self: Self, f: Mapping): VariantSchema.Field<Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L49)

#### validation

##### ValidateFields (type alias)

Per-key and whole-model compile-time validation for a field record.

**Details**

Success resolves each key to `unknown`; a violation resolves to a
`SqlTypeError` whose literal message appears on the offending key.

**Example** (Validate a model field record)

```ts
import { Date as DateSchema, String } from "effect/Schema"
import type { ValidateFields } from "@beep/effect-drizzle"

type Accepted = ValidateFields<{ readonly name: typeof String }>
// => { readonly name: unknown }

type Rejected = ValidateFields<{ readonly createdAt: typeof DateSchema }>
// => createdAt carries ~effect-drizzle.error:
// "this field's encoded type does not derive a column — add explicit metadata (...)"
```

**Signature**

```ts
type ValidateFields<F> = {
  readonly [K in keyof F]: ValidateSpecFamily<F[K]> &
    ValidateResolvedColumn<F[K]> &
    ValidateVersionField<F[K]> &
    ValidateArrayField<F[K]> &
    ValidateSqlName<Lowercase<K & string>, "model field derives an invalid PostgreSQL column name">;
} & (IsUnion<PrimaryKeyKeys<F>> extends true
  ? Field.SqlTypeError<"model declares multiple inline primary keys — use Table.compositePrimaryKey in the extras callback">
  : unknown) &
  (IsUnion<VersionKeys<F>> extends true
    ? Field.SqlTypeError<"model declares multiple optimistic-version fields">
    : unknown)
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/model.ts#L299)

### PostgreSQL schema assembly — `@beep/effect-drizzle/pg`

Assembles PostgreSQL models into validated Drizzle schema objects.

The assembler resolves foreign keys, shares enum instances, projects tables,
and derives RQBv2 relations from the same model metadata graph.

#### errors

##### SchemaAssemblyError (class)

Reports a cross-model reference or enum conflict during schema assembly.

**Details**

The error retains source table, field, and target table so a dynamic or
type-suppressed model registry can be traced back to its declaration.

**Example** (Construct an assembly error)

```ts
import { SchemaAssemblyError } from "@beep/effect-drizzle/pg"

const error = SchemaAssemblyError.make({
  message: "missing target",
  sourceTable: "user",
  fieldName: "orgId",
  targetTable: "organization"
})
error._tag // => "SchemaAssemblyError"
error.fieldName // => "orgId"
```

**See**

- `schema` for the assembly boundary that raises this error.

**Signature**

```ts
declare class SchemaAssemblyError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/schema.ts#L84)

#### factories

##### schema

Assembles models into shared enums, wired tables, and RQBv2 relations.

**When to use**

Use when two or more models share references or enums, or when callers need
one Drizzle schema object for migrations and relational queries. Use
`toPgTable` for a standalone model without cross-model wiring.

**Details**

Assembly validates every foreign key, interns one PostgreSQL enum instance
per enum name, projects all tables, applies declared extras, then derives
forward, reverse, and junction relations in deterministic order.

**Gotchas**

Models using the same enum name must declare identical values. Foreign-key
equality includes SQL identity, encoded carrier, and array depth rather than
accepting merely assignable TypeScript values. Self-referential junctions
emit direct and reverse relations only; through-relation naming is deferred.
References resolve an exact registry key first, otherwise one unique physical
table name. Physical table names must be unique across the registry.
Compile-time validation recognizes registry keys; physical-name fallback is
runtime-only until model statics preserve literal table names.

**Example** (Assemble one model)

```ts
import { String } from "effect/Schema"
import { getTableName } from "drizzle-orm"
import { Model } from "@beep/effect-drizzle"
import { schema } from "@beep/effect-drizzle/pg"

class User extends Model<User>("User")({ name: String }) {}
const assembly = schema({ user: User })

getTableName(assembly.tables.user) // => "user"
```

**See**

- `ValidateSchema` for the compile-time reference check.

**Signature**

```ts
declare const schema: <const Models extends ModelRecord>(models: Models & ValidateSchema<Models>) => Assembly<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/schema.ts#L648)

#### models

##### Assembly (interface)

Describes the complete PostgreSQL assembly returned by `schema`.

**Details**

The assembly retains source models, shared enum instances, projected tables,
a collision-safe combined Drizzle export record, the reusable relation
callback, and Drizzle's processed relation object.

**Example** (Read assembled tables)

```ts
import type { Assembly, ModelRecord } from "@beep/effect-drizzle/pg"

type UserAssembly = Assembly<ModelRecord>
type Tables = UserAssembly["tables"] // => key-preserving Drizzle tables
```

**Signature**

```ts
export interface Assembly<Models extends ModelRecord> {
  readonly drizzleSchema: Readonly<Record<string, unknown>>;
  readonly enums: EnumRegistry;
  readonly models: Models;
  readonly relations: ReturnType<typeof defineRelations>;
  readonly relationsConfig: RelationsConfig<Models>;
  readonly tables: TablesOf<Models>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/schema.ts#L313)

##### ModelRecord (interface)

Describes the string-keyed model registry accepted by `schema`.

**Details**

Registry keys become the stable keys of projected tables and relation helpers;
each model retains its independently derived SQL table name.

**Example** (Accept a model registry)

```ts
import { String } from "effect/Schema"
import { Model } from "@beep/effect-drizzle"
import type { ModelRecord } from "@beep/effect-drizzle/pg"

class User extends Model<User>("User")({ name: String }) {}
type Models = { readonly user: typeof User }
type Accepted = Models extends ModelRecord ? true : false // => true
```

**Signature**

```ts
export interface ModelRecord {
  readonly [key: string]: AnyModel;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/schema.ts#L121)

##### RelationsConfig (type alias)

Types the RQBv2 relation-builder callback derived for a model registry.

**Details**

Forward, reverse, and recognized two-key junction relations share the same
key-preserving table projection.

**Example** (Name a relation config)

```ts
import type { ModelRecord, RelationsConfig } from "@beep/effect-drizzle/pg"

type Config = RelationsConfig<ModelRecord>
// => callback from typed tables to an RQBv2 relation configuration
```

**Signature**

```ts
type RelationsConfig<Models> = (
  helpers: RelationsBuilder<TablesOf<Models>>
) => RelationsBuilderConfig<TablesOf<Models>>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/schema.ts#L288)

#### projections

##### TablesOf (type alias)

Projects model-registry keys to their exact Drizzle PostgreSQL table types.

**Example** (Name a projected registry)

```ts
import type { ModelRecord, TablesOf } from "@beep/effect-drizzle/pg"

type Tables = TablesOf<ModelRecord>
type UserTable = Tables["user"] // => projected PostgreSQL table
```

**Signature**

```ts
type TablesOf<Models> = {
  readonly [K in keyof Models]: TableOf<Models[K]>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/schema.ts#L264)

#### validation

##### ValidateSchema (type alias)

Reduces a model registry to `unknown` or a readable foreign-key diagnostic.

**Details**

Validation compares both SQL identity and encoded carrier, including array
depth and EntityId identity, for every declared reference.

**Example** (Inspect reference validation)

```ts
import { Int, String } from "effect/Schema"
import { Model } from "@beep/effect-drizzle"
import { integer, primaryKey, references, text, type ValidateSchema } from "@beep/effect-drizzle/pg"

class UserId {
  static readonly tableName = "user"
  static readonly entityType = "User"
}
class User extends Model<User>("User")({ id: Int.pipe(integer(), primaryKey()) }) {}
class Membership extends Model<Membership>("Membership")({
  userId: Int.pipe(integer(), references(UserId))
}) {}
class Broken extends Model<Broken>("Broken")({
  userId: String.pipe(text(), references(UserId))
}) {}

type Accepted = ValidateSchema<{ user: typeof User; membership: typeof Membership }>
// => unknown
type Rejected = ValidateSchema<{ user: typeof User; broken: typeof Broken }>
// => ~effect-drizzle.error: "foreign-key SQL identities do not match"
```

**Signature**

```ts
type ValidateSchema<Models> = [SchemaFailures<Models>] extends [never]
  ? unknown
  : SchemaFailures<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/schema.ts#L245)

### PostgreSQL table projection — `@beep/effect-drizzle/pg`

Postgres table projection: `@beep/effect-drizzle` model → real drizzle `pgTable`.

The type side maps every field's resolved column spec + meta brands onto
rc4's actual builder classes (`PgBuilderBase`) wrapped in the `Set*` brand
intersections drizzle's model inference consumes. The runtime side is one
exhaustive dispatch producing real builders and delegating to the public
`pgTable` — so the result is query-builder- and drizzle-kit-equivalent to a
hand-written table.

The public overload preserves each field's exact builder projection while
the broad runtime implementation assembles Drizzle's structural builder
record without assertions. Cross-table foreign keys arrive through
`schema.ts`; declared table extras and per-column unique metadata share this
single projection path.

#### models

##### EnumRegistry (type alias)

Assembly-owned Drizzle enum instances keyed by PostgreSQL enum name.

**Signature**

```ts
type EnumRegistry = Readonly<Record<string, PgColumn.EnumInstance>>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/table.ts#L290)

#### projections

##### BuilderFor (type alias)

Projects one schema-owned field to its exact Drizzle PostgreSQL builder type.

**Details**

Encoded carrier, nullability, defaults, generation, identity, primary-key
state, and array depth become the Drizzle brands used by model inference.

**Example** (Project a string field builder)

```ts
import { String } from "effect/Schema"
import type { BuilderFor } from "@beep/effect-drizzle/pg"

type StringBuilder = BuilderFor<typeof String>
// => non-null PgTextBuilder with string data
```

**Signature**

```ts
type BuilderFor<I> = ApplyPrimaryKey<
  ApplyIdentity<
    ApplyGenerated<
      ApplyDefault<
        ApplyNotNull<
          Set$Type<
            ApplyDimensions<BuilderBase<Derive.ResolvedColumn<I>>, Field.MetaFrom<I>>,
            ElementAtDepth<Exclude<Field.EncodedOf<I>, null>, Field.MetaFrom<I>["dimensions"]>
          >,
          NullableOf<I>
        >,
        Field.MetaFrom<I>
      >,
      Field.MetaFrom<I>
    >,
    Field.MetaFrom<I>
  >,
  Field.MetaFrom<I>
>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/table.ts#L212)

##### BuildersOf (type alias)

Projects a field record to key-preserving Drizzle builder types.

**Example** (Project a builder record)

```ts
import { String } from "effect/Schema"
import type { BuildersOf } from "@beep/effect-drizzle/pg"

type Builders = BuildersOf<{ readonly name: typeof String }>
type NameBuilder = Builders["name"] // => builder for the name field
```

**Signature**

```ts
type BuildersOf<F> = {
  readonly [K in keyof F & string]: BuilderFor<F[K]>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/table.ts#L248)

#### tables

##### AdditionalExtras (type alias)

Adds assembly-owned Drizzle extras beside a model's declared extras.

**Details**

Model extras are emitted first and additional extras second. Schema assembly
uses this seam for foreign keys after every model reference is known.

**Example** (Declare no additional extras)

```ts
import type { AnyModel } from "@beep/effect-drizzle"
import type { AdditionalExtras } from "@beep/effect-drizzle/pg"

const none: AdditionalExtras<AnyModel> = () => []
none({}) // => []
```

**Signature**

```ts
type AdditionalExtras<M> = (
  columns: TableExtras.BoundColumns<M["sql"]["fields"]>
) => ReadonlyArray<PgTableExtraConfigValue>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/table.ts#L377)

##### TableOf (type alias)

Projects one model type to its complete Drizzle PostgreSQL table type.

**Details**

The result preserves model field keys and every builder brand used by
`$inferSelect` and `$inferInsert`.

**Example** (Name a projected table)

```ts
import type { AnyModel } from "@beep/effect-drizzle"
import type { TableOf } from "@beep/effect-drizzle/pg"

type Table = TableOf<AnyModel>
type Dialect = Table["_"]["dialect"] // => "pg"
```

**Signature**

```ts
type TableOf<M> = PgTableWithColumns<{
  name: string;
  schema: undefined;
  columns: PgBuildColumns<string, BuildersOf<M["sql"]["fields"]>>;
  dialect: "pg";
}>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/table.ts#L273)

##### toPgTable

Projects one model class into a real, fully typed Drizzle PostgreSQL table.

**When to use**

Use when a standalone table needs no cross-model reference wiring. Use
`schema` when foreign keys, shared enum instances, or relations are involved.

**Details**

Projection compiles resolved columns, then emits model extras followed by
caller-supplied extras through Drizzle's public `pgTable` API.

**Gotchas**

A standalone enum field creates its own enum instance. Cross-table enum
sharing and conflicting-value detection require assembly through `schema`.

**Example** (Project a model)

```ts
import { getTableName } from "drizzle-orm"
import { String } from "effect/Schema"
import { Model } from "@beep/effect-drizzle"
import { toPgTable } from "@beep/effect-drizzle/pg"

class User extends Model<User>("User")({ name: String }) {}
getTableName(toPgTable(User)) // => "user"
```

**Signature**

```ts
declare const toPgTable: <M extends AnyModel>(model: M, additionalExtras?: AdditionalExtras<M>, enums?: EnumRegistry) => TableOf<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/table.ts#L442)

### PostgreSQL column descriptors — `@beep/effect-drizzle/pg`

PostgreSQL column descriptors and their colocated Drizzle compilers.

#### models

##### ArrayDimension (type alias)

PostgreSQL scalar or array depth.

**Signature**

```ts
type ArrayDimension = Meta.ArrayDimension
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L92)

##### ArrayDimensionString (type alias)

Drizzle-supported PostgreSQL array suffix.

**Signature**

```ts
type ArrayDimensionString = "[]" | "[][]" | "[][][]" | "[][][][]" | "[][][][][]"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L100)

##### DimensionOf (type alias)

Numeric array depth represented by a suffix.

**Signature**

```ts
type DimensionOf<Suffix> = Suffix extends "[]"
  ? 1
  : Suffix extends "[][]"
    ? 2
    : Suffix extends "[][][]"
      ? 3
      : Suffix extends "[][][][]"
        ? 4
        : 5
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L108)

##### EntityIdIdent (type alias)

Storage identity for a number-encoded entity id.

**Signature**

```ts
type `entityId<"${TableName}">` = `entityId<"${TableName}">`
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L146)

##### ResolveName (type alias)

Resolve a field-derived enum name without widening its literals.

**Signature**

```ts
type ResolveName<C, Key> = C extends Enum<"", infer Value> ? Enum<Key, Value> : C
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L1096)

##### Spec (type alias)

Complete PostgreSQL descriptor algebra exposed through public field inference.

**Signature**

```ts
type Spec = TaggedEnum<SpecDefinition>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L238)

#### type-level

##### ArrayCarrier (type alias)

Encoded carrier nested to a PostgreSQL array depth.

**Signature**

```ts
type ArrayCarrier<Carrier, Dimensions> = Dimensions extends 0
  ? Carrier
  : Dimensions extends 1
    ? ReadonlyArray<Carrier>
    : Dimensions extends 2
      ? ReadonlyArray<ReadonlyArray<Carrier>>
      : Dimensions extends 3
        ? ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>
        : Dimensions extends 4
          ? ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>>
          : ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<ReadonlyArray<Carrier>>>>>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L1156)

##### Bigint (type alias)

PostgreSQL bigint descriptor carried by `bigint()` fields.

**Signature**

```ts
type Bigint<Mode> = Omit<
  Extract<Spec, { readonly _tag: "bigint" }>,
  "mode"
> & {
  readonly mode: Mode;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L379)

##### Bigserial (type alias)

PostgreSQL bigserial descriptor carried by `bigserial()` fields.

**Signature**

```ts
type Bigserial<Mode> = Omit<
  Extract<Spec, { readonly _tag: "bigserial" }>,
  "mode"
> & {
  readonly mode: Mode;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L334)

##### Bool (type alias)

PostgreSQL boolean descriptor carried by `boolean()` fields.

**Signature**

```ts
type Bool = Extract<Spec, { readonly _tag: "boolean" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L405)

##### Bytea (type alias)

PostgreSQL byte-array descriptor carried by `bytea()` fields.

**Signature**

```ts
type Bytea = Extract<Spec, { readonly _tag: "bytea" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L433)

##### CarrierOf (type alias)

Encoded carrier represented by a PostgreSQL descriptor.

**Signature**

```ts
type CarrierOf<C> = C extends Text | Varchar | Uuid | Enum | Char | Numeric
  ? string
  : C extends Integer<"integer" | EntityIdIdent<string>> | Smallint | Serial | Smallserial | DoublePrecision | Real
    ? number
    : C extends Bigint<infer Mode>
      ? Mode extends "number"
        ? number
        : bigint
      : C extends Bool
        ? boolean
        : C extends Timestamp<infer Mode>
          ? Mode extends "date"
            ? Date
            : string
          : C extends Jsonb | Json
            ? object
            : C extends DateColumn<infer Mode>
              ? Mode extends "date"
                ? Date
                : string
              : C extends Bigserial<infer Mode>
                ? Mode extends "number"
                  ? number
                  : bigint
                : C extends Bytea
                  ? Uint8Array
                  : C extends Custom
                    ? unknown
                    : never
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L1200)

##### Char (type alias)

PostgreSQL fixed-length string descriptor carried by `char()` fields.

**Signature**

```ts
type Char<Length> = Omit<Extract<Spec, { readonly _tag: "char" }>, "length"> & {
  readonly length: Length;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L311)

##### Custom (type alias)

PostgreSQL custom-column descriptor carried by `custom()` fields.

**Signature**

```ts
type Custom<SqlType> = Omit<
  Extract<Spec, { readonly _tag: "custom" }>,
  "ident" | "sqlType"
> & { readonly ident: `custom<${SqlType}>`; readonly sqlType: SqlType }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L276)

##### CustomBuilder (type alias)

Drizzle builder type produced for a custom PostgreSQL descriptor.

**Signature**

```ts
type CustomBuilder = ReturnType<ReturnType<typeof customType<{ data: unknown; driverData: unknown }>>>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L538)

##### DateColumn (type alias)

PostgreSQL date descriptor carried by `date()` fields.

**Signature**

```ts
type DateColumn<Mode> = Omit<
  Extract<Spec, { readonly _tag: "date" }>,
  "mode"
> & {
  readonly mode: Mode;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L299)

##### DoublePrecision (type alias)

PostgreSQL double-precision descriptor carried by `doublePrecision()` fields.

**Signature**

```ts
type DoublePrecision = Extract<Spec, { readonly _tag: "doublePrecision" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L398)

##### Enum (type alias)

PostgreSQL named-enum descriptor carried by `enum()` fields.

**Signature**

```ts
type Enum<Name, Value> = Omit<
  Extract<Spec, { readonly _tag: "enum" }>,
  "ident" | "name" | "values"
> & {
  readonly ident: `enum<${Name}>`;
  readonly name: Name;
  readonly values: readonly [Value, ...Value[]];
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L262)

##### EnumInstance (type alias)

Drizzle enum instance retained by PostgreSQL schema assembly.

**Signature**

```ts
type EnumInstance = PgEnum<[string, ...string[]]>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L505)

##### IdentityKind (type alias)

PostgreSQL integer families that support generated identities.

**Signature**

```ts
type IdentityKind = "integer" | "smallint" | "bigint"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L1174)

##### Integer (type alias)

PostgreSQL integer descriptor carried by `integer()` fields.

**Signature**

```ts
type Integer<Ident> = Omit<
  Extract<Spec, { readonly _tag: "integer" }>,
  "ident"
> & {
  readonly ident: Ident;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L360)

##### Json (type alias)

PostgreSQL JSON descriptor carried by `json()` fields.

**Signature**

```ts
type Json = Extract<Spec, { readonly _tag: "json" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L320)

##### Jsonb (type alias)

PostgreSQL JSONB descriptor carried by `jsonb()` fields.

**Signature**

```ts
type Jsonb = Extract<Spec, { readonly _tag: "jsonb" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L412)

##### Numeric (type alias)

PostgreSQL numeric descriptor carried by `numeric()` fields.

**Signature**

```ts
type Numeric<Precision, Scale> = Omit<Extract<Spec, { readonly _tag: "numeric" }>, "precision" | "scale"> & {
  readonly precision: Precision;
  readonly scale: Scale;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L286)

##### Real (type alias)

PostgreSQL real-number descriptor carried by `real()` fields.

**Signature**

```ts
type Real = Extract<Spec, { readonly _tag: "real" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L327)

##### Serial (type alias)

PostgreSQL serial descriptor carried by `serial()` fields.

**Signature**

```ts
type Serial = Extract<Spec, { readonly _tag: "serial" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L391)

##### Smallint (type alias)

PostgreSQL smallint descriptor carried by `smallint()` fields.

**Signature**

```ts
type Smallint = Extract<Spec, { readonly _tag: "smallint" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L372)

##### Smallserial (type alias)

PostgreSQL smallserial descriptor carried by `smallserial()` fields.

**Signature**

```ts
type Smallserial = Extract<Spec, { readonly _tag: "smallserial" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L346)

##### StorageIdent (type alias)

Storage identity inferred for a PostgreSQL descriptor and array depth.

**Signature**

```ts
type StorageIdent<C, Dimensions> = Dimensions extends 0
  ? IdentOf<C>
  : `array<${IdentOf<C>},${Dimensions}>`
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L1127)

##### Text (type alias)

PostgreSQL text descriptor carried by `text()` fields.

**Signature**

```ts
type Text = Extract<Spec, { readonly _tag: "text" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L246)

##### Timestamp (type alias)

PostgreSQL timestamp descriptor carried by `timestamp()` fields.

**Signature**

```ts
type Timestamp<Mode, Timezone> = Omit<
  Extract<Spec, { readonly _tag: "timestamp" }>,
  "ident" | "mode" | "withTimezone"
> & {
  readonly ident: Timezone extends true ? "timestamptz" : "timestamp";
  readonly mode: Mode;
  readonly withTimezone: Timezone;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L419)

##### Uuid (type alias)

PostgreSQL UUID descriptor carried by `uuid()` fields.

**Signature**

```ts
type Uuid = Extract<Spec, { readonly _tag: "uuid" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L353)

##### Varchar (type alias)

PostgreSQL variable-length string descriptor carried by `varchar()` fields.

**Signature**

```ts
type Varchar<L> = Omit<Extract<Spec, { readonly _tag: "varchar" }>, "length"> & {
  readonly length: L;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/Column.ts#L253)

### PostgreSQL column derivation — `@beep/effect-drizzle/pg`

Column derivation for bare schema fields.

Policy (deliberately identical at the type level and at runtime — the v3
experiment's fatal flaw was two derivation algorithms that disagreed):

- EntityId-like schemas (statics `tableName` + `entityType`, number-encoded)
  derive `integer`.
- Unambiguous carriers derive directly: string → text, boolean → boolean,
  bigint → bigint, object/array → jsonb.
- `number` derives `doublePrecision` — v4 checks are not type-visible, so
  `Int` cannot be distinguished from `NumberSchema` statically; integer
  columns are explicit (`pg.integer()`).
- Declarations (Date, Uint8Array, Option, …), heterogeneous unions, and
  everything else DO NOT derive: explicit column metadata is required.
  Ambiguity is a loud error, never a silent fallback.

Nullability never derives a column: `Null` union members are stripped (they
feed `.notNull()` instead), and an encoded `Undefined` is rejected — SQL
absence must be represented as `null` in selected rows.

#### errors

##### DeriveColumnError

Error raised when an encoded schema AST cannot determine one SQL column.

**Signature**

```ts
declare const DeriveColumnError: typeof DeriveColumnError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/derive.ts#L65)

#### guards

##### isEntityIdLike

Test unknown input for EntityId schema statics.

**Signature**

```ts
declare const isEntityIdLike: <I>(input: I) => input is I & EntityIdLikeShape
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/derive.ts#L81)

#### models

##### EntityIdLike (type alias)

Static EntityId metadata consumed by PostgreSQL derivation.

**Signature**

```ts
type EntityIdLike = EntityIdLikeType
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/derive.ts#L88)

##### ResolvedColumn (type alias)

Column descriptor an input resolves to: explicit metadata wins, then derivation.

**Signature**

```ts
type ResolvedColumn<I> = Field.MetaFrom<I>["column"] extends undefined
  ? Derived<I>
  : Field.MetaFrom<I>["column"] extends PgColumn.Spec
    ? Field.MetaFrom<I>["column"]
    : Exclude<Field.MetaFrom<I>["column"], undefined> extends {
          readonly dialect: infer Dialect;
        }
      ? string extends Dialect
        ? Derived<I>
        : never
      : never
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/derive.ts#L150)

##### SelectSchemaOf (type alias)

Select-side schema type of an input; variant fields contribute `select`.

**Signature**

```ts
type SelectSchemaOf<Sch> = Sch extends VariantSchema.Field<infer Config> ? (Config extends { readonly select: infer Sel } ? Sel : never) : Sch
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/pg/derive.ts#L102)

### SQLite entrypoint — `@beep/effect-drizzle/sqlite`

SQLite storage-class combinators and SQL modifiers.

#### combinators

##### "./combinators.ts" (namespace export)

Re-exports all named exports from the "./combinators.ts" module.

**Signature**

```ts
export * from "./combinators.ts"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L14)

##### default

Default SQLite column metadata combinator.

**Signature**

```ts
declare const default: <const Value>(value: Value) => <I extends Input>(input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>) => Patched<I, { readonly default: DefaultValue<Value>; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L19)

#### factories

##### make

Creates a SQLite-bound effect-drizzle kit.

**Signature**

```ts
declare const make: <const Defaults extends FieldsInput>(build: (sqlite: SqliteToolkit) => SqliteKitConfig<Defaults>) => SqliteKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L29)

#### models

##### FieldExcept

Shared model constructors and variant helpers for SQLite models.

**Signature**

```ts
declare const FieldExcept: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => Field<{ readonly [K in Exclude<"update", Keys[number]> | Exclude<"insert", Keys[number]> | Exclude<"select", Keys[number]> | Exclude<"json", Keys[number]> | Exclude<"jsonCreate", Keys[number]> | Exclude<"jsonUpdate", Keys[number]>]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L36)

##### FieldOnly

Shared model constructors and variant helpers for SQLite models.

**Signature**

```ts
declare const FieldOnly: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => Field<{ readonly [K in Keys[number]]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L37)

##### Model

Shared model constructors and variant helpers for SQLite models.

**Signature**

```ts
declare const Model: <Self = never, const Identifier extends string = string>(identifier: Identifier & ValidateDerivedSqlName<Identifier, "Model identifier derives an invalid SQLite table name">) => <const F extends FieldsInput>(fields: F & ValidateFields<F>, annotationsOrExtras?: Annotations.Annotations | Callback<F>) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L39)

##### Variant

Shared model constructors and variant helpers for SQLite models.

**Signature**

```ts
declare const Variant: { is: { select: (value: unknown) => value is "select"; insert: (value: unknown) => value is "insert"; update: (value: unknown) => value is "update"; json: (value: unknown) => value is "json"; jsonCreate: (value: unknown) => value is "jsonCreate"; jsonUpdate: (value: unknown) => value is "jsonUpdate"; }; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L40)

##### VariantField

Shared model constructors and variant helpers for SQLite models.

**Signature**

```ts
declare const VariantField: <const A extends Field.ConfigWithKeys<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(config: A & { readonly [K in Exclude<keyof A, "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">]: never; }) => Field<A>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L41)

##### extract

Shared model constructors and variant helpers for SQLite models.

**Signature**

```ts
declare const extract: { <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">(variant: V): <A extends Struct<any>>(self: A) => Extract<V, A, V extends "select" ? true : false>; <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate", A extends Struct<any>>(self: A, variant: V): Extract<V, A, V extends "select" ? true : false>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L35)

##### fieldEvolve

Shared model constructors and variant helpers for SQLite models.

**Signature**

```ts
declare const fieldEvolve: { <Self extends Field<any> | Top, const Mapping extends Self extends Field<infer S extends Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(f: Mapping): (self: Self) => Field<Self extends Field<infer S extends Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; <Self extends Field<any> | Top, const Mapping extends Self extends Field<infer S extends Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(self: Self, f: Mapping): Field<Self extends Field<infer S extends Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L38)

#### projections

##### SchemaAssemblyError

SQLite schema assembly constructor and error.

**Signature**

```ts
declare const SchemaAssemblyError: typeof SchemaAssemblyError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L47)

##### schema

SQLite schema assembly constructor and error.

**Signature**

```ts
declare const schema: <const Models extends ModelRecord>(models: Models & ValidateSchema<Models>) => Assembly<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L47)

##### toSqliteTable

Projects one effect-drizzle model into a SQLite Drizzle table.

**Signature**

```ts
declare const toSqliteTable: <M extends AnyModel>(model: M, additionalExtras?: AdditionalExtras<M>) => TableOf<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L52)

#### tables

##### Table (namespace export)

Re-exports all named exports from the "./extras.ts" module as `Table`.

**Signature**

```ts
export * as Table from "./extras.ts"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L24)

#### type-level

##### AdditionalExtras

SQLite table projection inference types.

**Signature**

```ts
declare const AdditionalExtras: AdditionalExtras<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L88)

##### AnyModel

SQLite model inference types.

**Signature**

```ts
declare const AnyModel: AnyModel
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L71)

##### Assembly

SQLite schema assembly inference types.

**Signature**

```ts
declare const Assembly: Assembly<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L83)

##### BuilderFor

SQLite table projection inference types.

**Signature**

```ts
declare const BuilderFor: BuilderFor<I>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L88)

##### BuildersOf

SQLite table projection inference types.

**Signature**

```ts
declare const BuildersOf: BuildersOf<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L88)

##### ColumnsOf

SQLite model inference types.

**Signature**

```ts
declare const ColumnsOf: ColumnsOf<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L72)

##### EffectiveSchema

SQLite model inference types.

**Signature**

```ts
declare const EffectiveSchema: EffectiveSchema<I>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L73)

##### FieldsInput

SQLite model inference types.

**Signature**

```ts
declare const FieldsInput: FieldsInput
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L74)

##### ModelClass

SQLite model inference types.

**Signature**

```ts
declare const ModelClass: ModelClass<Self, F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L75)

##### ModelRecord

SQLite schema assembly inference types.

**Signature**

```ts
declare const ModelRecord: ModelRecord
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L83)

##### RelationsConfig

SQLite schema assembly inference types.

**Signature**

```ts
declare const RelationsConfig: RelationsConfig<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L83)

##### SqliteEntityFactory

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteEntityFactory: SqliteEntityFactory<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L58)

##### SqliteKit

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteKit: SqliteKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L59)

##### SqliteKitConfig

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteKitConfig: SqliteKitConfig<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L60)

##### SqliteKitExtension

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteKitExtension: SqliteKitExtension<Defaults, More>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L61)

##### SqliteToolkit

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteToolkit: SqliteToolkit
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L62)

##### SqliteValidateCollision

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteValidateCollision: SqliteValidateCollision<Defaults, Own>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L63)

##### SqliteValidateMergedFields

SQLite kit configuration and result types.

**Signature**

```ts
declare const SqliteValidateMergedFields: SqliteValidateMergedFields<Defaults, Own, Effective>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L64)

##### Statics

SQLite model inference types.

**Signature**

```ts
declare const Statics: Statics<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L76)

##### TableOf

SQLite table projection inference types.

**Signature**

```ts
declare const TableOf: TableOf<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L88)

##### TablesOf

SQLite schema assembly inference types.

**Signature**

```ts
declare const TablesOf: TablesOf<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L83)

##### ValidateFields

SQLite model inference types.

**Signature**

```ts
declare const ValidateFields: ValidateFields<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L77)

##### ValidateSchema

SQLite schema assembly inference types.

**Signature**

```ts
declare const ValidateSchema: ValidateSchema<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/index.ts#L83)

### SQLite kit — `@beep/effect-drizzle/sqlite`

Builds SQLite-local kits without importing PostgreSQL implementation code.

#### configuration

##### SqliteKitConfig (interface)

Configures invariant SQLite fields and table extras for `make`.

**When to use**

Use when every entity in a SQLite slice must share columns or constraints.

**Details**

The whole configuration is produced inside one closure receiving the
`SqliteToolkit`, so `defaultColumns` is a plain field record and
`defaultExtras` closes over the same dialect namespace.

**Gotchas**

SQLite has no array column operator, and default field keys cannot be
overridden by kit entities.

**Example** (Describe SQLite defaults)

```ts
import { Int } from "effect/Schema"
import type { SqliteKitConfig } from "@beep/effect-drizzle/sqlite"

type Defaults = { readonly version: typeof Int }
type Config = SqliteKitConfig<Defaults> // => SQLite kit configuration
```

**Signature**

```ts
export interface SqliteKitConfig<Defaults extends FieldsInput> {
  readonly defaultColumns: Defaults & ValidateFields<Defaults>;
  readonly defaultExtras?: Table.Callback<FieldsInput> | undefined;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/kit.ts#L87)

##### SqliteKitExtension (interface)

Additional columns and extras layered onto an existing SQLite kit by `extend`.

**Example** (Describe a SQLite kit extension)

```ts
import { Int, String } from "effect/Schema"
import type { SqliteKitExtension } from "@beep/effect-drizzle/sqlite"

type Defaults = { readonly version: typeof Int }
type Extension = SqliteKitExtension<Defaults, { readonly label: typeof String }>
// => columns and optional extras accepted by extend
```

**Signature**

```ts
export interface SqliteKitExtension<Defaults extends FieldsInput, More extends FieldsInput> {
  readonly columns: More & SqliteValidateCollision<Defaults, More> & SqliteValidateMergedFields<Defaults, More>;
  readonly extras?: Table.Callback<FieldsInput> | undefined;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/kit.ts#L208)

#### factories

##### SqliteEntityFactory (type alias)

Builds SQLite entity models with a kit's invariant fields and extras.

**When to use**

Use when a SQLite table participates in the kit's shared entity contract.

**Details**

Default and own fields form one model before SQLite validation, projection,
or relation assembly runs.

**Gotchas**

A default-field collision is rejected statically and again at runtime.

**Example** (Name a SQLite entity factory)

```ts
import { Int } from "effect/Schema"
import type { SqliteEntityFactory } from "@beep/effect-drizzle/sqlite"

type Defaults = { readonly version: typeof Int }
type Entity = SqliteEntityFactory<Defaults> // => defaults-injected SQLite factory
```

**Signature**

```ts
type SqliteEntityFactory<Defaults> = <
  Self = never,
  const Identifier extends string = string,
>(
  identifier: Identifier &
    ValidateDerivedSqlName<Identifier, "kit Entity identifier derives an invalid SQLite table name">
) => <const Own extends FieldsInput>(
  ownFields: Own & SqliteValidateCollision<Defaults, Own> & SqliteValidateMergedFields<Defaults, Own>,
  annotationsOrExtras?: Annotations.Annotations | Table.Callback<Merged<Defaults, NoInfer<Own>>>
) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, Merged<Defaults, Own>>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/kit.ts#L180)

##### make

Creates a SQLite-only kit without importing the PostgreSQL implementation.

**Details**

The whole configuration lives in one closure receiving the
`SqliteToolkit`. The returned kit can be layered with `extend`.

**Example** (Create an isolated SQLite kit)

```ts
import { Int } from "effect/Schema"
import { make } from "@beep/effect-drizzle/sqlite"

const kit = make((sqlite) => ({
  defaultColumns: { version: Int.pipe(sqlite.integer()) }
}))

kit.sqlite.integer // => SQLite integer combinator
```

**Signature**

```ts
declare const make: <const Defaults extends FieldsInput>(build: (sqlite: SqliteToolkit) => SqliteKitConfig<Defaults>) => SqliteKit<Defaults>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/kit.ts#L336)

#### models

##### SqliteKit (interface)

Describes the SQLite vocabulary returned by `make`.

**Details**

The absence of PostgreSQL-only operators, especially arrays and native enum
objects, is represented by the returned surface rather than runtime flags.

**Example** (Infer a SQLite kit)

```ts
import { Int } from "effect/Schema"
import type { SqliteKit } from "@beep/effect-drizzle/sqlite"

type Kit = SqliteKit<{ readonly version: typeof Int }>
type Dialect = keyof Pick<Kit, "sqlite"> // => "sqlite"
```

**Signature**

```ts
export interface SqliteKit<Defaults extends FieldsInput> {
  readonly Entity: SqliteEntityFactory<Defaults>;
  readonly extend: <const More extends FieldsInput>(
    build: (sqlite: SqliteToolkit) => SqliteKitExtension<Defaults, More>
  ) => SqliteKit<Merged<Defaults, More>>;
  readonly Model: typeof Model;
  readonly Repository: typeof makeRepository;
  readonly schema: typeof schema;
  readonly sqlite: SqliteToolkit;
  readonly Table: typeof Table;
  readonly toSqliteTable: typeof toSqliteTable;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/kit.ts#L234)

##### SqliteToolkit (type alias)

The dialect namespace a SQLite kit closure receives.

**Details**

One binding carries every column combinator, the `default` alias for
`default_`, and the `Table` extras namespace, so kit configuration never
imports dialect modules separately.

**Example** (Use the toolkit inside a kit closure)

```ts
import { Int } from "effect/Schema"
import { make } from "@beep/effect-drizzle/sqlite"

const kit = make((sqlite) => ({
  defaultColumns: { version: Int.pipe(sqlite.integer(), sqlite.default(1)) }
}))

kit.sqlite.Table.index // => SQLite index-node constructor
```

**Signature**

```ts
type SqliteToolkit = typeof Sqlite & {
  readonly default: typeof Sqlite.default_;
  readonly Table: typeof Table;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/kit.ts#L49)

#### validation

##### SqliteValidateCollision (type alias)

Rejects own-field keys that shadow an existing SQLite kit default column.

**Example** (Reject a shadowed default)

```ts
import { Int, String } from "effect/Schema"
import type { SqliteValidateCollision } from "@beep/effect-drizzle/sqlite"

type Defaults = { readonly version: typeof Int }
type Accepted = SqliteValidateCollision<Defaults, { readonly name: typeof String }>
// => { readonly name: unknown }
```

**Signature**

```ts
type SqliteValidateCollision<Defaults, Own> = {
  readonly [K in keyof Own]: K extends keyof Defaults
    ? Field.SqlTypeError<`'${K & string}' is a kit default column — remove it or use Model`>
    : unknown;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/kit.ts#L120)

##### SqliteValidateMergedFields (type alias)

Validates own fields against the complete merged SQLite kit field record.

**Example** (Validate merged fields)

```ts
import { Int, String } from "effect/Schema"
import type { SqliteValidateMergedFields } from "@beep/effect-drizzle/sqlite"

type Defaults = { readonly version: typeof Int }
type Accepted = SqliteValidateMergedFields<Defaults, { readonly name: typeof String }>
// => own-field record validated against the merged model
```

**Signature**

```ts
type SqliteValidateMergedFields<Defaults, Own, Effective> = {
  readonly [K in keyof Own]: K extends keyof ValidateFields<Effective> ? ValidateFields<Effective>[K] : unknown;
} & (ValidateFields<Effective> extends Field.SqlTypeError<infer Message> ? Field.SqlTypeError<Message> : unknown)
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/kit.ts#L143)

### SQLite column combinators — `@beep/effect-drizzle/sqlite`

Defines pipeable SQLite storage-class setters and SQL modifiers.

Encoded carriers constrain every setter at the call site. SQLite-specific
omissions are deliberate: in particular, this module has no array operator.

#### combinators

##### autoIncrement

Declares an `INTEGER PRIMARY KEY AUTOINCREMENT` value assigned by SQLite.

**When to use**

Use with SQLite rowid-backed surrogate keys. Ordinary primary keys should use
`primaryKey()` without database assignment.

**Details**

The field becomes primary, insert-optional, and identity-by-default in one
correlated metadata change.

**Gotchas**

SQLite requires number-mode `integer()` and does not support PostgreSQL's
separate identity-always policy.

**Example** (Declare a database-assigned key)

```ts
import { Int } from "effect/Schema"
import { autoIncrement, integer } from "@beep/effect-drizzle/sqlite"
Int.pipe(integer(), autoIncrement()).meta.identity // => "byDefault"
```

**Signature**

```ts
declare const autoIncrement: () => <I extends Field.Input>(input: I & Field.ValidateNonNullable<I, "autoIncrement() forbids a nullable schema"> & ValidateRowidKey<I> & ValidateNotDefaulted<I> & ValidateNotGenerated<I> & ValidateNotVersion<I>) => Field.Patched<I, { readonly primaryKey: true; readonly identity: "byDefault"; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L563)

##### blob

Sets SQLite BLOB storage in buffer, JSON, or bigint mode.

**When to use**

Use with buffer mode for bytes, JSON mode for structured binary storage, and
bigint mode for native bigint carriers.

**Example** (Store a bigint as a blob)

```ts
import { BigInt } from "effect/Schema"
import { blob } from "@beep/effect-drizzle/sqlite"

BigInt.pipe(blob({ mode: "bigint" })).meta.column?.kind // => "blob"
```

**Signature**

```ts
declare const blob: { (options: { readonly mode: "buffer"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, Uint8Array, "sqlite.blob buffer mode requires a Uint8Array-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Blob<"buffer">; }>; (options: { readonly mode: "json"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, StructuralJson, "sqlite.blob json mode requires an array- or record-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Blob<"json">; }>; (options: { readonly mode: "bigint"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, bigint, "sqlite.blob bigint mode requires a bigint-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Blob<"bigint">; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L263)

##### columnName

Overrides the physical SQLite column name while preserving the field key.

**When to use**

Use with legacy schemas or names that differ from the default snake-case policy.

**Example** (Choose a physical name)

```ts
import { String } from "effect/Schema"
import { columnName } from "@beep/effect-drizzle/sqlite"

String.pipe(columnName("display_name")).meta.columnName // => "display_name"
```

**Signature**

```ts
declare const columnName: <const Name extends string>(name: Name & ValidateSqlName<Name, "sqlite.columnName requires a lowercase SQL identifier">) => <I extends Field.Input>(input: I) => Field.Patched<I, { readonly columnName: Name; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L883)

##### default

Named export for the SQLite literal-default combinator.

**Signature**

```ts
declare const default: <const Value>(value: Value) => <I extends Field.Input>(input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.DefaultValue<Value>; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L624)

##### defaultExpr

Sets a typed SQLite expression default with carrier equality checking.

**When to use**

Use when the database, rather than the application constructor, should
compute an insert default and a typed Drizzle expression is available.

**Gotchas**

Schema expressions must render with zero parameters. Carrier typing does not
prove SQLite's constant-expression rules; column references and other deeper
semantics remain database-checked.

**Example** (Default from an expression)

```ts
import { sql } from "drizzle-orm"
import { String } from "effect/Schema"
import { defaultExpr } from "@beep/effect-drizzle/sqlite"

String.pipe(defaultExpr(sql<string>`lower('A')`)).meta.hasDefault // => true
```

**Signature**

```ts
declare const defaultExpr: <Carrier>(expression: SQL<Carrier>) => <I extends Field.Input>(input: I & ValidateExpression<I, Carrier> & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.DefaultSqlExpr<Carrier>; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L653)

##### defaultNow

Sets SQLite's current time as an ISO-text database default.

**When to use**

Use when SQLite is the single authority for an insert timestamp.

**Gotchas**

Do not combine this database clock with an Effect model constructor default
for the same field; two clocks can produce inconsistent values.

**Example** (Default an ISO timestamp)

```ts
import { String } from "effect/Schema"
import { defaultNow, text } from "@beep/effect-drizzle/sqlite"

String.pipe(text(), defaultNow()).meta.hasDefault // => true
```

**Signature**

```ts
declare const defaultNow: () => <I extends Field.Input>(input: I & ValidateTimestampText<I> & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.DefaultNow; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L689)

##### default_

Sets a literal SQL default that matches the encoded carrier.

**Details**

The insert variant becomes optional while selected and update values retain
the schema's encoded type. Model construction validates the literal against
the complete encoded schema and SQLite representation. Non-finite numbers,
NUL text, and unproven BLOB literals are rejected; `unsafeDefaultSql` is the
explicit escape for a trusted SQL spelling.

**Example** (Default a status)

```ts
import { Literals } from "effect/Schema"
import { default as defaultValue } from "@beep/effect-drizzle/sqlite"

Literals(["draft", "active"]).pipe(defaultValue("draft")).meta.hasDefault // => true
```

**Signature**

```ts
declare const default_: <const Value>(value: Value) => <I extends Field.Input>(input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.DefaultValue<Value>; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L614)

##### enum

Named export for the SQLite enum combinator.

**Signature**

```ts
declare const enum: () => <I extends Field.Input>(input: I & ValidateEnum<I>) => Field.Patched<I, { readonly column: SqliteColumn.Enum<EnumValue<I>>; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L394)

##### enum_

Compiles a finite string domain to TEXT plus a table-local `CHECK`.

**When to use**

Use when a literal schema should be enforced by SQLite without inventing a
native enum type that the dialect does not provide.

**Details**

Values come from the encoded schema, so the domain is never restated in SQL
metadata. Projection emits the check automatically.

**Gotchas**

Each table receives its own check. Reusing one logical enum across tables
duplicates the constraint, and broad string schemas are rejected. Duplicate
literals collapse in first-occurrence order; NUL-containing literals fail.
The empty string is a legal label; represent absence with
`OptionFromNullOr(...)` when the encoded database value should be `NULL`.

**Example** (Declare a checked domain)

```ts
import { Literals } from "effect/Schema"
import { enum as sqliteEnum } from "@beep/effect-drizzle/sqlite"
Literals(["draft", "active"]).pipe(sqliteEnum()).meta.column?.values
// => ["draft", "active"]
```

**Signature**

```ts
declare const enum_: () => <I extends Field.Input>(input: I & ValidateEnum<I>) => Field.Patched<I, { readonly column: SqliteColumn.Enum<EnumValue<I>>; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L378)

##### generated

Sets a typed stored generated expression omitted from author writes.

**Details**

The expression carrier must equal the field's encoded carrier. The field
remains in selected and JSON rows but disappears from insert and update.

**Gotchas**

Schema expressions must render with zero parameters. BSL does not analyze
determinism or SQLite's generated-expression grammar; DDL application is the
semantic check.

**Example** (Generate a normalized value)

```ts
import { sql } from "drizzle-orm"
import { String } from "effect/Schema"
import { generated } from "@beep/effect-drizzle/sqlite"

String.pipe(generated(sql<string>`lower(name)`)).meta.generated._tag // => "sqlExpr"
```

**Signature**

```ts
declare const generated: <Carrier>(expression: SQL<Carrier>) => <I extends Field.Input>(input: I & ValidateExpression<I, Carrier> & ValidateNotDefaulted<I> & ValidateNotVersion<I>) => Field.Patched<I, { readonly generated: Meta.GeneratedSqlExpr<Carrier>; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L827)

##### index

Colocate a single-column index with the field it indexes.

**When to use**

Use for single-column indexes so the intent lives on the column instead of
a table-extras callback; keep the callback for multi-column indexes.

**Details**

Model construction harvests the intent into an ordinary index node named
`{table}_{column}_btree_idx` (respecting `columnName` overrides), before any
kit or model extras callback runs. Pass `name` to pin a legacy index name
the derivation cannot reproduce.

**Example** (Colocate an index on a column)

```ts
import { String } from "effect/Schema"
import { index, text } from "@beep/effect-drizzle/sqlite"

const field = String.pipe(text(), index())
field.meta.indexed // => { name: undefined, unique: false }
```

**See**

- `uniqueIndex` for the unique-index form.

**Signature**

```ts
declare const index: (options?: { readonly name?: string; }) => <I extends Field.Input>(input: I) => Field.Patched<I, { readonly indexed: { readonly name: string | undefined; readonly unique: false; }; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L482)

##### integer

Sets SQLite INTEGER storage in number, boolean, or timestamp mode.

**When to use**

Use with the mode matching the encoded carrier; number mode is also required for
database-assigned rowid keys and optimistic versions.

**Details**

Number-encoded EntityId schemas retain an `entityId<...>` storage identity
so foreign keys cannot cross domain identities accidentally.

**Example** (Store an integer)

```ts
import { Int } from "effect/Schema"
import { integer } from "@beep/effect-drizzle/sqlite"
Int.pipe(integer()).meta.column?.mode // => "number"
```

**Signature**

```ts
declare const integer: { (): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "sqlite.integer requires a number-encoded schema">) => Field.Patched<I, { readonly column: IntegerColumn<I>; }>; (options: { readonly mode: "number"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "sqlite.integer number mode requires a number-encoded schema">) => Field.Patched<I, { readonly column: IntegerColumn<I>; }>; (options: { readonly mode: "boolean"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, boolean, "sqlite.integer boolean mode requires a boolean-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Integer<"boolean", "integer">; }>; (options: { readonly mode: "timestamp" | "timestamp_ms"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, Date, "sqlite.integer timestamp modes require a Date-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Integer<"timestamp" | "timestamp_ms", "integer">; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L194)

##### numeric

Sets SQLite NUMERIC storage in faithful number or signed-64-bit bigint mode.

**When to use**

Use number mode for finite JavaScript numbers and bigint mode for signed
64-bit integers.

**Gotchas**

SQLite NUMERIC affinity rewrites decimal strings (exponents, leading zeros,
and high precision), so string mode is deliberately unavailable. Use
`text()` for representation-preserving decimal strings.

**Example** (Preserve a numeric string)

```ts
import { Finite } from "effect/Schema"
import { numeric } from "@beep/effect-drizzle/sqlite"

Finite.pipe(numeric({ mode: "number" })).meta.column?.kind // => "numeric"
```

**Signature**

```ts
declare const numeric: { (options: { readonly mode: "number"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "sqlite.numeric number mode requires a number-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Numeric<"number">; }>; (options: { readonly mode: "bigint"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, bigint, "sqlite.numeric bigint mode requires a bigint-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Numeric<"bigint">; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L312)

##### primaryKey

Marks a non-null field as an inline primary key.

**Gotchas**

A model accepts at most one inline key; use `Table.compositePrimaryKey` for
multi-column keys.

**Example** (Declare a text primary key)

```ts
import { String } from "effect/Schema"
import { primaryKey, text } from "@beep/effect-drizzle/sqlite"

String.pipe(text(), primaryKey()).meta.primaryKey // => true
```

**Signature**

```ts
declare const primaryKey: () => <I extends Field.Input>(input: I & Field.ValidateNonNullable<I, "primaryKey() forbids a nullable schema">) => Field.Patched<I, { readonly primaryKey: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L426)

##### real

Set SQLite REAL storage for a number-encoded schema.

**Example** (Store a double-precision number)

```ts
import { Finite } from "effect/Schema"
import { real } from "@beep/effect-drizzle/sqlite"

Finite.pipe(real()).meta.column?.kind // => "real"
```

**Signature**

```ts
declare const real: () => <I extends Field.Input>(input: I & Field.ValidateEncoded<I, number, "sqlite.real requires a number-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Real; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L220)

##### references

Attaches a foreign-key target and referential actions to a field.

**Signature**

```ts
declare const references: <const Id extends EntityIdLike, const Options extends ReferenceOptions | undefined = undefined>(id: Id, options?: Options) => <I extends Field.Input>(input: I & ValidateReferenceActions<NoInfer<I>, Options>) => Field.Patched<I, { readonly references: Meta.References<Id["tableName"], "id">; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L950)

##### text

Sets SQLite TEXT storage in string or JSON mode.

**When to use**

Use with string mode for textual carriers and JSON mode for structured values
that should remain text-backed rather than BLOB-backed.

**Details**

JSON mode delegates serialization to Drizzle while retaining SQLite's TEXT
storage class.

**Example** (Store text)

```ts
import { String } from "effect/Schema"
import { text } from "@beep/effect-drizzle/sqlite"
String.pipe(text()).meta.column?.mode // => "text"
```

**Signature**

```ts
declare const text: { (): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, string, "sqlite.text requires a string-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Text<"text">; }>; (options: { readonly mode: "json"; }): <I extends Field.Input>(input: I & Field.ValidateEncoded<I, StructuralJson, "sqlite.text({ mode: 'json' }) requires an array- or record-encoded schema">) => Field.Patched<I, { readonly column: SqliteColumn.Text<"json">; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L132)

##### unique

Marks a field as carrying a single-column unique constraint.

**Example** (Declare a unique field)

```ts
import { String } from "effect/Schema"
import { unique } from "@beep/effect-drizzle/sqlite"

String.pipe(unique()).meta.unique // => true
```

**Signature**

```ts
declare const unique: () => <I extends Field.Input>(input: I) => Field.Patched<I, { readonly unique: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L448)

##### uniqueIndex

Colocate a single-column unique index with the field it constrains.

**When to use**

Use when DDL compatibility requires a named unique index rather than the
inline `unique()` column constraint, and the index covers one column.

**Details**

Model construction harvests the intent into a unique-index node named
`{table}_{column}_unique_idx` (respecting `columnName` overrides). Pass
`name` to pin a legacy index name the derivation cannot reproduce.

**Example** (Colocate a unique index on a column)

```ts
import { String } from "effect/Schema"
import { text, uniqueIndex } from "@beep/effect-drizzle/sqlite"

const field = String.pipe(text(), uniqueIndex())
field.meta.indexed // => { name: undefined, unique: true }
```

**See**

- `index` for the non-unique form.
- `unique` for the inline unique column constraint.

**Signature**

```ts
declare const uniqueIndex: (options?: { readonly name?: string; }) => <I extends Field.Input>(input: I) => Field.Patched<I, { readonly indexed: { readonly name: string | undefined; readonly unique: true; }; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L520)

##### unsafeDefaultSql

Sets an explicitly unsafe raw SQLite default.

**When to use**

Use when only trusted raw SQL can represent the default.

**Gotchas**

The string bypasses carrier checking, parameterization, and escaping.

**Example** (Use a trusted SQLite expression)

```ts
import { String } from "effect/Schema"
import { unsafeDefaultSql } from "@beep/effect-drizzle/sqlite"

String.pipe(unsafeDefaultSql("lower('A')")).meta.hasDefault // => true
```

**Signature**

```ts
declare const unsafeDefaultSql: (sql: string) => <I extends Field.Input>(input: I & ValidateNotGenerated<I>) => Field.Patched<I, { readonly default: Meta.UnsafeDefaultSql; readonly hasDefault: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L719)

##### unsafeGeneratedSql

Sets an explicitly unsafe stored generated expression.

**When to use**

Use when only trusted raw SQL can represent the generated expression.

**Gotchas**

The raw statement bypasses carrier checking and escaping.

**Example** (Generate from trusted SQL)

```ts
import { String } from "effect/Schema"
import { unsafeGeneratedSql } from "@beep/effect-drizzle/sqlite"

String.pipe(unsafeGeneratedSql("lower(name)")).meta.generated._tag // => "unsafeSql"
```

**Signature**

```ts
declare const unsafeGeneratedSql: (sql: string) => <I extends Field.Input>(input: I & ValidateNotDefaulted<I> & ValidateNotVersion<I>) => Field.Patched<I, { readonly generated: Meta.UnsafeGeneratedSql; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L857)

##### version

Marks one number-mode integer as the optimistic concurrency token.

**Details**

The field is optional on insert, required on update, and interpreted as the
expected version by the optimistic repository.

**Gotchas**

Update payloads must include the current value. Explicit variant fields are
rejected; version fields also cannot be generated or database-assigned keys.

**Example** (Declare a row version)

```ts
import { Int } from "effect/Schema"
import { integer, version } from "@beep/effect-drizzle/sqlite"

Int.pipe(integer(), version()).meta.version // => true
```

**Signature**

```ts
declare const version: () => <I extends Field.Input>(input: I & ValidateVersionColumn<I> & ValidateVersionCompatibility<I> & ValidateVersionSchema<I> & Field.ValidateNonNullable<I, "version() forbids a nullable schema">) => Field.Patched<I, { readonly version: true; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts#L764)

### SQLite table extras — `@beep/effect-drizzle/sqlite`

Models SQLite table constraints and indexes as typed descriptor nodes.

Model callbacks receive bound Drizzle columns, return this small algebra,
and defer compilation until the owning table is projected.

#### constructors

##### Node

Constructors, guard, and exhaustive matcher for SQLite table-extra nodes.

**Example** (Recognize a SQLite extra node)

```ts
import { Table } from "@beep/effect-drizzle/sqlite"

const node = Table.unsafeCheckSql("positive_count", "count > 0")
Table.Node.is(node) // => true
```

**Signature**

```ts
declare const Node: { $is: <Tag extends "compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql">(tag: Tag) => (u: unknown) => u is Extract<{ readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }, { readonly _tag: Tag; }> | Extract<{ readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }, { readonly _tag: Tag; }>; $match: { <Cases extends { readonly compositeUnique: (args: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly compositePrimaryKey: (args: { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly index: (args: { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly uniqueIndex: (args: { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly check: (args: { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }) => any; readonly unsafeCheckSql: (args: { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => any; }>(cases: Cases): (value: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; } | { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => Unify<ReturnType<Cases["compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql"]>>; <Cases extends { readonly compositeUnique: (args: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly compositePrimaryKey: (args: { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly index: (args: { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly uniqueIndex: (args: { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly check: (args: { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }) => any; readonly unsafeCheckSql: (args: { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => any; }>(value: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; } | { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }, cases: Cases): Unify<ReturnType<Cases["compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql"]>>; }; is: (value: unknown) => value is Node; match: { <Cases extends { readonly compositeUnique: (args: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly compositePrimaryKey: (args: { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly index: (args: { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly uniqueIndex: (args: { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly check: (args: { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }) => any; readonly unsafeCheckSql: (args: { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => any; }>(cases: Cases): (value: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; } | { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => Unify<ReturnType<Cases["compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql"]>>; <Cases extends { readonly compositeUnique: (args: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly compositePrimaryKey: (args: { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; }) => any; readonly index: (args: { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly uniqueIndex: (args: { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; }) => any; readonly check: (args: { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; }) => any; readonly unsafeCheckSql: (args: { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }) => any; }>(value: { readonly _tag: "compositeUnique"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "compositePrimaryKey"; readonly name: string; readonly columns: CompositeColumns; } | { readonly _tag: "index"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "uniqueIndex"; readonly name: string; readonly columns: NonEmptyColumns; readonly where: SQL<boolean> | undefined; } | { readonly _tag: "check"; readonly name: string; readonly expression: SQL<boolean>; } | { readonly _tag: "unsafeCheckSql"; readonly name: string; readonly sql: string; }, cases: Cases): Unify<ReturnType<Cases["compositeUnique" | "compositePrimaryKey" | "index" | "uniqueIndex" | "check" | "unsafeCheckSql"]>>; }; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L356)

##### check

Constructs a typed SQLite check in data-first or data-last form.

**When to use**

Use when Drizzle's typed SQL builder can express the constraint.

**Gotchas**

CHECK expressions must render with zero parameters. Carrier typing is not SQL
semantic analysis; SQLite remains authoritative for forbidden constructs.

**Example** (Define a typed SQLite check)

```ts
import { sql } from "drizzle-orm"
import { Table } from "@beep/effect-drizzle/sqlite"

Table.check("positive_count")(sql<boolean>`count > 0`)._tag // => "check"
```

**See**

- `unsafeCheckSql` for raw SQL.

**Signature**

```ts
declare const check: { <const Name extends string>(name: Name & ValidateSqlName<Name, "Table.check name must be a lowercase SQL identifier">): (expression: SQL<boolean>) => Check; <const Name extends string>(expression: SQL<boolean>, name: Name & ValidateSqlName<Name, "Table.check name must be a lowercase SQL identifier">): Check; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L517)

##### compositePrimaryKey

Constructs a named primary key over at least two SQLite columns.

**When to use**

Use with junction or natural-key tables instead of multiple inline keys.

**Example** (Define a composite primary key)

```ts
import { Int } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/sqlite"

const extras: Table.Callback<{ leftId: typeof Int; rightId: typeof Int }> =
  (columns) => [
    Table.compositePrimaryKey("membership_pk", [columns.leftId, columns.rightId])
  ] // => callback producing one compositePrimaryKey node
```

**Signature**

```ts
declare const compositePrimaryKey: <const Name extends string, const Columns extends CompositeColumns>(name: Name & ValidateSqlName<Name, "Table.compositePrimaryKey name must be a lowercase SQL identifier">, columns: Columns & ValidateDistinctColumns<Columns> & ValidatePrimaryKeyColumns<Columns>) => CompositePrimaryKey
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L428)

##### compositeUnique

Constructs a named unique constraint over at least two SQLite columns.

**Example** (Define a composite unique constraint)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/sqlite"

const extras: Table.Callback<{ first: typeof String; last: typeof String }> =
  (columns) => [
    Table.compositeUnique("person_name_unique", [columns.first, columns.last])
  ] // => callback producing one compositeUnique node
```

**Signature**

```ts
declare const compositeUnique: <const Name extends string, const Columns extends CompositeColumns>(name: Name & ValidateSqlName<Name, "Table.compositeUnique name must be a lowercase SQL identifier">, columns: Columns & ValidateDistinctColumns<Columns>) => CompositeUnique
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L402)

##### index

Constructs a SQLite index with an optional partial-index predicate.

**Gotchas**

Partial predicates must render with zero parameters. BSL does not analyze
determinism, subqueries, or SQLite's deeper predicate grammar.

**Example** (Define a partial SQLite index)

```ts
import { sql } from "drizzle-orm"
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/sqlite"

const extras: Table.Callback<{ email: typeof String }> = (columns) => [
  Table.index("user_email_idx", [columns.email], {
    where: sql<boolean>`${columns.email} <> ''`
  })
] // => callback producing one partial index node
```

**Signature**

```ts
declare const index: <const Name extends string, const Columns extends NonEmptyColumns>(name: Name & ValidateSqlName<Name, "Table.index name must be a lowercase SQL identifier">, columns: Columns & ValidateDistinctColumns<Columns>, options?: { readonly where?: SQL<boolean>; }) => Index
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L457)

##### uniqueIndex

Constructs a named unique index over one or more SQLite columns.

**When to use**

Use when DDL compatibility requires a unique index rather than a table-level
unique constraint.

**Example** (Define a public-id unique index)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/sqlite"

const extras: Table.Callback<{ publicId: typeof String }> = (columns) => [
  Table.uniqueIndex("account_public_id_unique_idx", [columns.publicId])
]

console.log(extras)
```

**Signature**

```ts
declare const uniqueIndex: <const Name extends string, const Columns extends NonEmptyColumns>(name: Name & ValidateSqlName<Name, "Table.uniqueIndex name must be a lowercase SQL identifier">, columns: Columns & ValidateDistinctColumns<Columns>, options?: { readonly where?: SQL<boolean>; }) => UniqueIndex
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L487)

##### unsafeCheckSql

Constructs an explicitly unsafe raw-SQL SQLite check.

**When to use**

Use when only raw SQL can represent the constraint.

**Gotchas**

The statement is emitted verbatim and is not parameterized or escaped.

**Example** (Define a raw SQLite check)

```ts
import { Table } from "@beep/effect-drizzle/sqlite"

Table.unsafeCheckSql("positive_count", "count > 0")._tag
// => "unsafeCheckSql"
```

**See**

- `check` for typed SQL checks.

**Signature**

```ts
declare const unsafeCheckSql: <const Name extends string>(name: Name & ValidateSqlName<Name, "Table.unsafeCheckSql name must be a lowercase SQL identifier">, value: string) => UnsafeCheckSql
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L550)

#### guards

##### isNode

Guards the tag and required outer shape of an author-returned SQLite node.

**When to use**

Use when values cross a hand-built or type-suppressed extras callback boundary.

**Gotchas**

The guard is shallow and does not validate Drizzle column internals.

**Example** (Guard an unknown SQLite extra)

```ts
import { Table } from "@beep/effect-drizzle/sqlite"

const candidate: unknown = Table.unsafeCheckSql("positive_count", "count > 0")

Table.isNode(candidate) // => true
```

**See**

- `Node` for matching and constructors.

**Signature**

```ts
declare const isNode: (value: unknown) => value is Node
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L339)

#### mappers

##### emit

Compiles one descriptor to a Drizzle SQLite extra-config value.

**Details**

Exhaustive tag matching selects the public Drizzle builder; raw SQL appears
only in the explicitly unsafe variant.

**Example** (Emit a SQLite check)

```ts
import { Table } from "@beep/effect-drizzle/sqlite"

Table.emit(Table.unsafeCheckSql("positive_count", "count > 0"))
// => Drizzle SQLite check builder
```

**Signature**

```ts
declare const emit: (node: Node) => SQLiteTableExtraConfigValue
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L633)

#### models

##### Check (type alias)

Describes a check backed by typed Drizzle SQL.

**When to use**

Use when the constraint can be expressed through Drizzle's SQL builder.

**Example** (Name a typed check node)

```ts
import type { Table } from "@beep/effect-drizzle/sqlite"

type Node = Table.Check // => tagged typed-check descriptor
```

**See**

- `UnsafeCheckSql` for raw SQL.

**Signature**

```ts
type Check = Extract<Node, { readonly _tag: "check" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L266)

##### CompositePrimaryKey (type alias)

Describes a named primary key over at least two SQLite columns.

**Example** (Name a composite primary-key node)

```ts
import type { Table } from "@beep/effect-drizzle/sqlite"

type Node = Table.CompositePrimaryKey // => tagged compositePrimaryKey descriptor
```

**See**

- `compositePrimaryKey` for construction.

**Signature**

```ts
type CompositePrimaryKey = Extract<Node, { readonly _tag: "compositePrimaryKey" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L206)

##### CompositeUnique (type alias)

Describes a named unique constraint over at least two SQLite columns.

**Example** (Name a composite unique node)

```ts
import type { Table } from "@beep/effect-drizzle/sqlite"

type Node = Table.CompositeUnique // => tagged compositeUnique descriptor
```

**See**

- `compositeUnique` for construction.

**Signature**

```ts
type CompositeUnique = Extract<Node, { readonly _tag: "compositeUnique" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L189)

##### Index (type alias)

Describes a SQLite index with an optional partial-index predicate.

**Example** (Name an index node)

```ts
import type { Table } from "@beep/effect-drizzle/sqlite"

type Node = Table.Index // => tagged index descriptor
```

**See**

- `index` for construction.

**Signature**

```ts
type Index = Extract<Node, { readonly _tag: "index" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L223)

##### Node (type alias)

Represents every SQLite table-extra descriptor accepted from a model.

**Details**

The union contains composite unique and primary keys, indexes, typed checks,
and explicitly unsafe raw-SQL checks. The value companion supplies shallow
guards and exhaustive matching.

**Gotchas**

`Node.is` validates the tag and outer fields, not complete Drizzle column
internals. It guards the callback seam rather than decoding untrusted input.

**Example** (Match a SQLite extra node)

```ts
import { Table } from "@beep/effect-drizzle/sqlite"

const node = Table.unsafeCheckSql("user_name_check", "name <> ''")

Table.Node.is(node) // => true
Table.Node.match(node, {
  check: () => "typed",
  compositePrimaryKey: () => "primary",
  compositeUnique: () => "unique",
  index: () => "index",
  uniqueIndex: () => "unique-index",
  unsafeCheckSql: () => "unsafe"
}) // => "unsafe"
```

**See**

- `isNode` for the callback-boundary guard.

**Signature**

```ts
type Node = TaggedEnum<NodeDefinition>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L172)

##### UniqueIndex (type alias)

Describes a named unique index over one or more SQLite columns.

**Example** (Construct a unique index node)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/sqlite"

const extras: Table.Callback<{ publicId: typeof String }> = (columns) => [
  Table.uniqueIndex("account_public_id_unique_idx", [columns.publicId])
]

console.log(extras)
```

**See**

- `uniqueIndex` for the concise constructor.

**Signature**

```ts
type UniqueIndex = Extract<Node, { readonly _tag: "uniqueIndex" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L245)

##### UnsafeCheckSql (type alias)

Describes a raw-SQL check owned entirely by the caller.

**When to use**

Use when only raw SQL can represent the constraint.

**Gotchas**

The SQL string is emitted verbatim without validation or escaping.

**Example** (Name an unsafe check node)

```ts
import type { Table } from "@beep/effect-drizzle/sqlite"

type Node = Table.UnsafeCheckSql // => tagged raw-SQL check descriptor
```

**See**

- `Check` for typed SQL checks.

**Signature**

```ts
type UnsafeCheckSql = Extract<Node, { readonly _tag: "unsafeCheckSql" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L291)

#### projections

##### BoundColumns (type alias)

Maps a field record to key-preserving columns received by SQLite extras.

**Example** (Project bound SQLite columns)

```ts
import { String } from "effect/Schema"
import type { Table } from "@beep/effect-drizzle/sqlite"

type Columns = Table.BoundColumns<{ readonly email: typeof String }>
type Email = Columns["email"] // => bound SQLite email column
```

**Signature**

```ts
type BoundColumns<F> = {
  readonly [K in keyof F & string]: BoundColumn<F[K], K>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L99)

#### tables

##### BoundColumn (type alias)

Retains a field's schema type on the SQLite column exposed to table extras.

**Example** (Name a bound SQLite column)

```ts
import { String } from "effect/Schema"
import type { Table } from "@beep/effect-drizzle/sqlite"

type NameColumn = Table.BoundColumn<typeof String>
// => SQLite column carrying the name field type
```

**Signature**

```ts
type BoundColumn<I, Name> = SQLiteColumn & {
  readonly "~effect-drizzle.field"?: I;
  readonly "~effect-drizzle.field-name"?: Name;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L79)

##### Callback (type alias)

Types a model callback that builds SQLite extras from bound columns.

**Details**

Field keys remain correlated with columns until table projection compiles the
returned descriptor nodes.

**Example** (Declare SQLite extras)

```ts
import { String } from "effect/Schema"
import { Table } from "@beep/effect-drizzle/sqlite"

const extras: Table.Callback<{ email: typeof String }> = (columns) => [
  Table.index("user_email_idx", [columns.email])
] // => callback producing one index node
```

**Signature**

```ts
type Callback<F> = (
  columns: BoundColumns<F>
) => ReadonlyArray<Node>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/extras.ts#L380)

### SQLite models — `@beep/effect-drizzle/sqlite`

Builds SQLite-aware Effect model classes from schema-owned fields.

Encoded carriers are classified into SQLite storage classes, then the same
metadata drives model variants, Drizzle projection, and relation assembly.

#### errors

##### ModelInvariantError

Internal dialect re-export of the shared model invariant error.

**Signature**

```ts
declare const ModelInvariantError: typeof ModelInvariantError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L49)

#### factories

##### Model

Builds a SQLite model class whose schemas own resolved storage metadata.

**When to use**

Use when standalone SQLite models and tables opt out of kit defaults;
use a SQLite kit's `Entity` for invariant shared fields.

**Details**

The final identifier segment becomes a snake-case table name. The model
factory derives SQLite storage classes, variants, references, and table extras
from one field declaration.

**Gotchas**

SQLite has no array columns. Database-assigned keys must be number-mode
`INTEGER PRIMARY KEY`, and PostgreSQL descriptors are rejected.

**Example** (Define a SQLite model)

```ts
import { String } from "effect/Schema"
import { Model } from "@beep/effect-drizzle/sqlite"

class User extends Model<User>("User")({ name: String }) {}

User.sql.tableName // => "user"
Object.keys(User.insert.fields) // => ["name"]
```

**See**

- `ValidateFields` for SQLite model invariants.

**Signature**

```ts
declare const Model: <Self = never, const Identifier extends string = string>(identifier: Identifier & ValidateDerivedSqlName<Identifier, "Model identifier derives an invalid SQLite table name">) => <const F extends FieldsInput>(fields: F & ValidateFields<F>, annotationsOrExtras?: Annotations.Annotations | TableExtras.Callback<F>) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L725)

#### models

##### AnyModel (interface)

Structural model bound accepted by SQLite projectors and assembly.

**When to use**

Use as a generic constraint when exact model fields do not need preservation.

**Example** (Accept any SQLite model)

```ts
import { String } from "effect/Schema"
import { Model, type AnyModel } from "@beep/effect-drizzle/sqlite"

const tableName = (model: AnyModel) => model.sql.tableName
class User extends Model<User>("User")({ name: String }) {}

tableName(User) // => "user"
```

**Signature**

```ts
export interface AnyModel extends CoreAnyModel {
  readonly sql: {
    readonly tableName: string;
    readonly fields: FieldsInput;
    readonly columns: Record<string, Meta.Meta<SqliteColumn.Spec>>;
    readonly extras: ((columns: never) => ReadonlyArray<TableExtras.Node>) | undefined;
  };
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L355)

##### FieldExcept

Shared variant helpers exposed by the SQLite model surface.

**Signature**

```ts
declare const FieldExcept: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => VariantSchema.Field<{ readonly [K in Exclude<"update", Keys[number]> | Exclude<"insert", Keys[number]> | Exclude<"select", Keys[number]> | Exclude<"json", Keys[number]> | Exclude<"jsonCreate", Keys[number]> | Exclude<"jsonUpdate", Keys[number]>]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L38)

##### FieldOnly

Shared variant helpers exposed by the SQLite model surface.

**Signature**

```ts
declare const FieldOnly: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => VariantSchema.Field<{ readonly [K in Keys[number]]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L39)

##### FieldsInput (interface)

Describes the string-keyed field record accepted by SQLite `Model`.

**Details**

Each property is either an Effect schema or a field carrying SQLite metadata.

**Example** (Describe SQLite fields)

```ts
import { String } from "effect/Schema"
import type { FieldsInput } from "@beep/effect-drizzle/sqlite"

type UserFields = { readonly name: typeof String }
type Accepted = UserFields extends FieldsInput ? true : false // => true
```

**Signature**

```ts
export interface FieldsInput {
  readonly [key: string]: Field.Input;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L71)

##### ModelClass (type alias)

Combines an Effect variant class with resolved SQLite statics.

**Details**

The constructor represents selected rows and the six operation schemas are
exposed as statics beside the SQL metadata.

**Example** (Name a SQLite model class)

```ts
import { String } from "effect/Schema"
import type { ModelClass } from "@beep/effect-drizzle/sqlite"

interface User { readonly name: string }
type Generated = ModelClass<User, { readonly name: typeof String }>
type Insert = Generated["insert"]["Type"] // => { readonly name: string }
```

**Signature**

```ts
type ModelClass<Self, F> = VariantSchema.Class<
  Self,
  UnwrappedFields<F>,
  StructSchema<VariantSchema.ExtractFields<"select", UnwrappedFields<F>, true>>
> & { readonly [Va in Variant]: VariantSchema.Extract<Va, VariantSchema.Struct<UnwrappedFields<F>>> } & Statics<F>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L327)

##### Statics (interface)

Captures SQLite metadata statics attached to every generated model.

**Details**

`sql` retains the table name, original fields, resolved columns, and optional
extras callback used by projection and assembly.

**Example** (Inspect static field types)

```ts
import { String } from "effect/Schema"
import type { Statics } from "@beep/effect-drizzle/sqlite"

type UserStatics = Statics<{ readonly name: typeof String }>
type Fields = UserStatics["sql"]["fields"]
// => { readonly name: typeof String }
```

**Signature**

```ts
export interface Statics<F extends FieldsInput> {
  readonly sql: {
    readonly tableName: string;
    readonly fields: F;
    readonly columns: ColumnsOf<F>;
    readonly extras: TableExtras.Callback<F> | undefined;
  };
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L296)

##### Variant

Shared variant helpers exposed by the SQLite model surface.

**Signature**

```ts
declare const Variant: { is: { select: (value: unknown) => value is "select"; insert: (value: unknown) => value is "insert"; update: (value: unknown) => value is "update"; json: (value: unknown) => value is "json"; jsonCreate: (value: unknown) => value is "jsonCreate"; jsonUpdate: (value: unknown) => value is "jsonUpdate"; }; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L41)

##### VariantField

Shared variant helpers exposed by the SQLite model surface.

**Signature**

```ts
declare const VariantField: <const A extends VariantSchema.Field.ConfigWithKeys<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(config: A & { readonly [K in Exclude<keyof A, "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">]: never; }) => VariantSchema.Field<A>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L42)

##### extract

Shared variant helpers exposed by the SQLite model surface.

**Signature**

```ts
declare const extract: { <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">(variant: V): <A extends VariantSchema.Struct<any>>(self: A) => VariantSchema.Extract<V, A, V extends "select" ? true : false>; <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate", A extends VariantSchema.Struct<any>>(self: A, variant: V): VariantSchema.Extract<V, A, V extends "select" ? true : false>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L37)

##### fieldEvolve

Shared variant helpers exposed by the SQLite model surface.

**Signature**

```ts
declare const fieldEvolve: { <Self extends VariantSchema.Field<any> | Top, const Mapping extends Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(f: Mapping): (self: Self) => VariantSchema.Field<Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; <Self extends VariantSchema.Field<any> | Top, const Mapping extends Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(self: Self, f: Mapping): VariantSchema.Field<Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L40)

#### type-level

##### ColumnsOf (type alias)

Projects every declared field to its resolved SQLite metadata.

**Details**

Explicit metadata, storage-class derivation, and EntityId references merge
without losing field keys.

**Example** (Project SQLite field metadata)

```ts
import { String } from "effect/Schema"
import type { ColumnsOf } from "@beep/effect-drizzle/sqlite"

type Columns = ColumnsOf<{ readonly displayName: typeof String }>
type Column = Columns["displayName"]["column"] // => SQLite text descriptor
```

**Signature**

```ts
type ColumnsOf<F> = {
  readonly [K in keyof F]: ResolvedMetaOf<F[K]>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L114)

##### EffectiveSchema (type alias)

Applies SQL write strategy to a SQLite field's six model variants.

**Details**

Defaults make inserts optional, generated expressions are read-only,
identity row locators remain available on update, and optimistic versions
are required on update.

**Gotchas**

Update membership for a database-assigned id is locator policy, not permission
to modify the primary key. Explicit variant fields keep their own membership.

**Example** (Infer SQLite update membership)

```ts
import { String } from "effect/Schema"
import type { EffectiveSchema } from "@beep/effect-drizzle/sqlite"

type NameField = EffectiveSchema<typeof String>
type Update = NameField["schemas"]["update"] // => optional String schema
```

**Signature**

```ts
type EffectiveSchema<I> = Field.SchemaFrom<I> extends VariantSchema.Field.Any
    ? Field.SchemaFrom<I>
    : Field.SchemaFrom<I> extends Top
      ? PlainVariants<Field.SchemaFrom<I>, ResolvedMetaOf<I>>
      : never
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L173)

#### validation

##### MissingSelfGeneric (type alias)

Diagnostic returned when Model omits its self type.

**Signature**

```ts
type MissingSelfGeneric = "Missing `Self` generic — use `class Self extends sqlite.Model<Self>(identifier)({ ... }) {}`"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L271)

##### ValidateFields (type alias)

Validates per-field and whole-model SQLite invariants at compile time.

**Details**

Accepted keys reduce to `unknown`. Rejections carry a readable
`~effect-drizzle.error` on the offending key or complete model.

**Gotchas**

SQLite rejects every array dimension and every descriptor from another
dialect; those constraints are part of the type result, not runtime flags.

**Example** (Inspect SQLite validation results)

```ts
import { Date as DateSchema, String } from "effect/Schema"
import type { ValidateFields } from "@beep/effect-drizzle/sqlite"

type Accepted = ValidateFields<{ readonly name: typeof String }>
// => { readonly name: unknown }

type Rejected = ValidateFields<{ readonly createdAt: typeof DateSchema }>
// => createdAt carries ~effect-drizzle.error:
// "this field's encoded type does not derive a SQLite column — add explicit sqlite metadata"
```

**Signature**

```ts
type ValidateFields<F> = {
  readonly [K in keyof F]: ValidateSpecFamily<F[K]> &
    ValidateDimensions<F[K]> &
    ValidateResolvedColumn<F[K]> &
    ValidateVersion<F[K]> &
    ValidateSqlName<Lowercase<K & string>, "model field derives an invalid SQLite column name">;
} & (IsUnion<PrimaryKeyKeys<F>> extends true
  ? Field.SqlTypeError<"model declares multiple inline primary keys — use Table.compositePrimaryKey">
  : unknown) &
  (IsUnion<VersionKeys<F>> extends true
    ? Field.SqlTypeError<"model declares multiple optimistic-version fields">
    : unknown)
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/model.ts#L252)

### SQLite schema assembly — `@beep/effect-drizzle/sqlite`

Assembles SQLite models into validated Drizzle schema objects.

The assembler resolves foreign keys, projects tables, and derives RQBv2
relations while preserving SQLite's storage-class constraints.

#### errors

##### SchemaAssemblyError (class)

Reports a cross-model reference failure during SQLite schema assembly.

**Details**

Source table, field, and target table remain available for diagnosing
dynamic or type-suppressed registries.

**Example** (Construct an assembly error)

```ts
import { SchemaAssemblyError } from "@beep/effect-drizzle/sqlite"

const error = SchemaAssemblyError.make({
  message: "missing target",
  sourceTable: "user",
  fieldName: "orgId",
  targetTable: "organization"
})
error._tag // => "SchemaAssemblyError"
error.fieldName // => "orgId"
```

**See**

- `schema` for the assembly boundary that raises this error.

**Signature**

```ts
declare class SchemaAssemblyError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/schema.ts#L81)

#### factories

##### schema

Assembles models into wired SQLite tables and RQBv2 relations.

**When to use**

Use when models share references or callers need one Drizzle schema object
for migrations and relational queries. Use `toSqliteTable` for a standalone
model without cross-model wiring.

**Details**

Assembly validates every foreign key, projects all tables, applies generated
enum checks and declared extras, then derives relations deterministically.

**Gotchas**

SQLite has no native named enum object. Each enum field becomes a table-local
`CHECK`, so repeating one logical enum across tables duplicates its constraint.
Foreign-key equality still requires matching storage identity and carrier.
Self-referential junctions emit direct and reverse relations only;
through-relation naming remains deferred. References resolve an exact registry
key first, otherwise one unique physical table name. Physical names are unique.
Compile-time validation recognizes registry keys; physical-name fallback is
runtime-only until model statics preserve literal table names.

**Example** (Assemble one model)

```ts
import { String } from "effect/Schema"
import { getTableName } from "drizzle-orm"
import { Model, schema } from "@beep/effect-drizzle/sqlite"

class User extends Model<User>("User")({ name: String }) {}
const assembly = schema({ user: User })

getTableName(assembly.tables.user) // => "user"
```

**See**

- `ValidateSchema` for compile-time reference validation.

**Signature**

```ts
declare const schema: <const Models extends ModelRecord>(models: Models & ValidateSchema<Models>) => Assembly<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/schema.ts#L605)

#### models

##### Assembly (interface)

Describes the complete SQLite assembly returned by `schema`.

**Details**

The assembly retains source models, projected tables, the reusable relation
callback, and Drizzle's processed relation object.

**Example** (Read assembled tables)

```ts
import type { Assembly, ModelRecord } from "@beep/effect-drizzle/sqlite"

type UserAssembly = Assembly<ModelRecord>
type Tables = UserAssembly["tables"] // => key-preserving Drizzle tables
```

**Signature**

```ts
export interface Assembly<Models extends ModelRecord> {
  readonly models: Models;
  readonly relations: ReturnType<typeof defineRelations>;
  readonly relationsConfig: RelationsConfig<Models>;
  readonly tables: TablesOf<Models>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/schema.ts#L307)

##### ModelRecord (interface)

Describes the string-keyed SQLite model registry accepted by `schema`.

**Details**

Registry keys become projected-table and relation-helper keys while model
table names retain their own snake-case derivation.

**Example** (Accept a model registry)

```ts
import { String } from "effect/Schema"
import { Model, type ModelRecord } from "@beep/effect-drizzle/sqlite"

class User extends Model<User>("User")({ name: String }) {}
type Models = { readonly user: typeof User }
type Accepted = Models extends ModelRecord ? true : false // => true
```

**Signature**

```ts
export interface ModelRecord {
  readonly [key: string]: AnyModel;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/schema.ts#L117)

##### RelationsConfig (type alias)

Types the RQBv2 relation-builder callback derived for a SQLite registry.

**Details**

Forward, reverse, and recognized two-key junction relations share the same
key-preserving table projection.

**Example** (Name a relation config)

```ts
import type { ModelRecord, RelationsConfig } from "@beep/effect-drizzle/sqlite"

type Config = RelationsConfig<ModelRecord>
// => callback from typed tables to an RQBv2 relation configuration
```

**Signature**

```ts
type RelationsConfig<Models> = (
  helpers: RelationsBuilder<TablesOf<Models>>
) => RelationsBuilderConfig<TablesOf<Models>>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/schema.ts#L283)

#### projections

##### TablesOf (type alias)

Projects registry keys to their exact Drizzle SQLite table types.

**Example** (Name a projected registry)

```ts
import type { ModelRecord, TablesOf } from "@beep/effect-drizzle/sqlite"

type Tables = TablesOf<ModelRecord>
type UserTable = Tables["user"] // => projected SQLite table
```

**Signature**

```ts
type TablesOf<Models> = {
  readonly [K in keyof Models]: TableOf<Models[K]>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/schema.ts#L259)

#### validation

##### ValidateSchema (type alias)

Reduces a SQLite model registry to `unknown` or a readable reference diagnostic.

**Details**

Validation compares SQLite storage identity and encoded carrier for every
declared reference; array depth remains zero by dialect law.

**Example** (Inspect SQLite reference validation)

```ts
import { Int, String } from "effect/Schema"
import { Model, integer, primaryKey, references, text, type ValidateSchema } from "@beep/effect-drizzle/sqlite"

class UserId {
  static readonly tableName = "user"
  static readonly entityType = "User"
}
class User extends Model<User>("User")({ id: Int.pipe(integer(), primaryKey()) }) {}
class Membership extends Model<Membership>("Membership")({
  userId: Int.pipe(integer(), references(UserId))
}) {}
class Broken extends Model<Broken>("Broken")({
  userId: String.pipe(text(), references(UserId))
}) {}

type Accepted = ValidateSchema<{ user: typeof User; membership: typeof Membership }>
// => unknown
type Rejected = ValidateSchema<{ user: typeof User; broken: typeof Broken }>
// => ~effect-drizzle.error: "foreign-key SQL identities do not match"
```

**Signature**

```ts
type ValidateSchema<Models> = [SchemaFailures<Models>] extends [never]
  ? unknown
  : SchemaFailures<Models>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/schema.ts#L240)

### SQLite table projection — `@beep/effect-drizzle/sqlite`

Projects SQLite models onto real Drizzle `sqliteTable` builders.

Encoded carriers, SQLite metadata, generated enum checks, and table extras
share one projection path used by standalone tables and schema assembly.

#### projections

##### BuilderFor (type alias)

Projects one schema-owned field to its exact Drizzle SQLite builder type.

**Details**

Encoded carrier, nullability, defaults, generation, and primary-key state
become the Drizzle brands consumed by model inference.

**Example** (Project a SQLite text builder)

```ts
import { String } from "effect/Schema"
import type { BuilderFor } from "@beep/effect-drizzle/sqlite"

type StringBuilder = BuilderFor<typeof String>
// => non-null SQLiteTextBuilder with string data
```

**Signature**

```ts
type BuilderFor<I> = ApplyPrimaryKey<
  ApplyGenerated<
    ApplyDefault<
      ApplyNotNull<$Type<BuilderBase<Derive.ResolvedColumn<I>>, Exclude<Field.EncodedOf<I>, null>>, NullableOf<I>>,
      Field.MetaFrom<I>
    >,
    Field.MetaFrom<I>
  >,
  Derive.ResolvedColumn<I>,
  Field.MetaFrom<I>
>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/table.ts#L124)

##### BuildersOf (type alias)

Projects a SQLite field record to key-preserving Drizzle builder types.

**Example** (Project SQLite builders)

```ts
import { String } from "effect/Schema"
import type { BuildersOf } from "@beep/effect-drizzle/sqlite"

type Builders = BuildersOf<{ readonly name: typeof String }>
type NameBuilder = Builders["name"] // => builder for the name field
```

**Signature**

```ts
type BuildersOf<F> = {
  readonly [K in keyof F & string]: BuilderFor<F[K]>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/table.ts#L152)

#### tables

##### AdditionalExtras (type alias)

Adds assembly-owned Drizzle extras beside a model's declared SQLite extras.

**Details**

Automatic enum checks run first, model extras second, and additional extras
last. Schema assembly uses this seam for resolved foreign keys.

**Example** (Declare no additional SQLite extras)

```ts
import type { AdditionalExtras, AnyModel } from "@beep/effect-drizzle/sqlite"

const none: AdditionalExtras<AnyModel> = () => []
none({}) // => []
```

**Signature**

```ts
type AdditionalExtras<M> = (
  columns: TableExtras.BoundColumns<M["sql"]["fields"]>
) => ReadonlyArray<SQLiteTableExtraConfigValue>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/table.ts#L262)

##### TableOf (type alias)

Projects one model type to its complete Drizzle SQLite table type.

**Details**

The result preserves model field keys and every builder brand used by
`$inferSelect` and `$inferInsert`.

**Example** (Name a projected SQLite table)

```ts
import type { AnyModel, TableOf } from "@beep/effect-drizzle/sqlite"

type Table = TableOf<AnyModel>
type Dialect = Table["_"]["dialect"] // => "sqlite"
```

**Signature**

```ts
type TableOf<M> = SQLiteTableWithColumns<{
  name: string;
  schema: undefined;
  columns: BuildColumns<string, BuildersOf<M["sql"]["fields"]>, "sqlite">;
  dialect: "sqlite";
}>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/table.ts#L176)

##### toSqliteTable

Projects one model class into a real, fully typed Drizzle SQLite table.

**When to use**

Use when a standalone table needs no cross-model reference wiring. Use
`schema` when foreign keys or RQBv2 relations are involved.

**Details**

Projection compiles storage classes, emits one `CHECK` per enum field, then
appends model-declared and caller-supplied table extras.

**Gotchas**

SQLite enums are table-local checks rather than shared schema objects, so the
same logical enum used on multiple tables produces multiple constraints.
Arrays are rejected before projection because SQLite has no array columns.

**Example** (Project a SQLite model)

```ts
import { getTableName } from "drizzle-orm"
import { String } from "effect/Schema"
import { Model, toSqliteTable } from "@beep/effect-drizzle/sqlite"

class User extends Model<User>("User")({ name: String }) {}

getTableName(toSqliteTable(User)) // => "user"
```

**Signature**

```ts
declare const toSqliteTable: <M extends AnyModel>(model: M, additionalExtras?: AdditionalExtras<M>) => TableOf<M>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/table.ts#L338)

### SQLite column descriptors — `@beep/effect-drizzle/sqlite`

SQLite storage-class descriptors and their colocated Drizzle compilers.

#### models

##### BlobMode (type alias)

Modes supported by the installed SQLite blob builder.

**Signature**

```ts
type BlobMode = "buffer" | "json" | "bigint"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L93)

##### CarrierOf (type alias)

Encoded carrier represented by a SQLite descriptor.

**Signature**

```ts
type CarrierOf<C> = C extends Text<infer Mode>
    ? Mode extends "json"
      ? object
      : string
    : C extends Enum
      ? string
      : C extends Integer<infer Mode>
        ? Mode extends "boolean"
          ? boolean
          : Mode extends "number"
            ? number
            : Date
        : C extends Real
          ? number
          : C extends Blob<infer Mode>
            ? Mode extends "buffer"
              ? Uint8Array
              : Mode extends "bigint"
                ? bigint
                : object
            : C extends Numeric<infer Mode>
              ? Mode extends "string"
                ? string
                : Mode extends "number"
                  ? number
                  : bigint
              : never
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L496)

##### EntityIdIdent (type alias)

SQLite number-encoded EntityId storage identity.

**Signature**

```ts
type `entityId<"${TableName}">` = `entityId<"${TableName}">`
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L67)

##### IntegerMode (type alias)

Modes supported by the installed SQLite integer builder.

**Signature**

```ts
type IntegerMode = "number" | "boolean" | "timestamp" | "timestamp_ms"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L85)

##### NumericMode (type alias)

Modes supported by the installed SQLite numeric builder.

**Signature**

```ts
type NumericMode = "number" | "bigint"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L101)

##### Spec (type alias)

Complete SQLite descriptor algebra exposed through public field inference.

**Signature**

```ts
type Spec = TaggedEnum<SpecDefinition>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L147)

##### StorageIdent (type alias)

SQLite storage identity used by foreign-key compatibility checks.

**Signature**

```ts
type StorageIdent<C, Dimensions> = Dimensions extends 0 ? C["ident"] : never
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L546)

#### type-level

##### ArrayCarrier (type alias)

Encoded carrier accepted by SQLite's scalar-only storage model.

**Signature**

```ts
type ArrayCarrier<Carrier, Dimensions> = Dimensions extends 0 ? Carrier : never
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L554)

##### ArrayDimension (type alias)

SQLite scalar depth retained by public storage inference.

**Signature**

```ts
type ArrayDimension = Meta.ArrayDimension
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L74)

##### Blob (type alias)

SQLite blob descriptor carried by `blob()` fields.

**Signature**

```ts
type Blob<Mode> = Omit<Extract<Spec, { readonly _tag: "blob" }>, "mode"> & {
  readonly mode: Mode;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L193)

##### Enum (type alias)

SQLite enum descriptor carried by `enum()` fields.

**Signature**

```ts
type Enum<Value> = Omit<Extract<Spec, { readonly _tag: "enum" }>, "values"> & {
  readonly values: readonly [Value, ...Value[]];
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L164)

##### Integer (type alias)

SQLite integer descriptor carried by `integer()` fields.

**Signature**

```ts
type Integer<Mode, Ident> = Omit<Extract<Spec, { readonly _tag: "integer" }>, "ident" | "mode"> & {
  readonly ident: Ident;
  readonly mode: Mode;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L173)

##### Numeric (type alias)

SQLite numeric descriptor carried by `numeric()` fields.

**Signature**

```ts
type Numeric<Mode> = Omit<
  Extract<Spec, { readonly _tag: "numeric" }>,
  "mode"
> & { readonly mode: Mode }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L202)

##### Real (type alias)

SQLite real-number descriptor carried by `real()` fields.

**Signature**

```ts
type Real = Extract<Spec, { readonly _tag: "real" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L186)

##### Text (type alias)

SQLite text descriptor carried by `text()` fields.

**Signature**

```ts
type Text<Mode> = Omit<Extract<Spec, { readonly _tag: "text" }>, "mode"> & {
  readonly mode: Mode;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/Column.ts#L155)

### SQLite column derivation — `@beep/effect-drizzle/sqlite`

SQLite column derivation from encoded Effect schema carriers.

#### models

##### EntityIdLike (type alias)

Static EntityId metadata consumed by SQLite derivation.

**Signature**

```ts
type EntityIdLike = EntityIdLikeType
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/derive.ts#L41)

##### ResolvedColumn (type alias)

Explicit SQLite descriptor when present, otherwise the derived descriptor.

**Signature**

```ts
type ResolvedColumn<I> = Field.MetaFrom<I>["column"] extends undefined
  ? Derived<I>
  : Field.MetaFrom<I>["column"] extends SqliteColumn.Spec
    ? Field.MetaFrom<I>["column"]
    : Exclude<Field.MetaFrom<I>["column"], undefined> extends {
          readonly dialect: infer Dialect;
        }
      ? string extends Dialect
        ? Derived<I>
        : never
      : never
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/derive.ts#L117)

##### SelectSchemaOf (type alias)

Select-side schema type of a plain schema or variant field.

**Signature**

```ts
type SelectSchemaOf<Sch> = Sch extends VariantSchema.Field<infer Config>
    ? Config extends { readonly select: infer Select }
      ? Select
      : never
    : Sch
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/derive.ts#L52)

##### StructuralJson (type alias)

Structural JSON carrier shared by SQLite JSON-mode combinator constraints.

**Signature**

```ts
type StructuralJson = JsonCarrier
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/derive.ts#L99)

#### validation

##### DeriveColumnError

Internal shared derivation error and EntityId guard re-exports.

**Signature**

```ts
declare const DeriveColumnError: typeof DeriveColumnError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/derive.ts#L26)

##### isEntityIdLike

Internal shared derivation error and EntityId guard re-exports.

**Signature**

```ts
declare const isEntityIdLike: <I>(input: I) => input is I & EntityIdLikeShape
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/sqlite/derive.ts#L26)

### Core: field metadata — `@beep/effect-drizzle`

Defines dialect-neutral SQL intent carried beside Effect schemas.

Metadata records defaults, generation, keys, references, and physical
naming before a dialect projector compiles those choices to Drizzle.

#### models

##### ArrayDimension (type alias)

Supported array depth carried by field metadata.

**Signature**

```ts
type ArrayDimension = 0 | 1 | 2 | 3 | 4 | 5
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L65)

##### ColumnSpec (interface)

Minimal column identity carried through public field inference.

**Signature**

```ts
export interface ColumnSpec {
  readonly dialect: string;
  readonly ident: string;
  readonly kind: string;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L53)

##### Default (type alias)

Server-default descriptor union.

**Signature**

```ts
type Default = TaggedEnum<{
  sqlExpr: { readonly expression: SQL<unknown> };
  value: { readonly value: unknown };
  now: {};
  unsafeSql: { readonly sql: string };
}>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L132)

##### DefaultNow (type alias)

Current-time default descriptor.

**Signature**

```ts
type DefaultNow = Extract<Default, { readonly _tag: "now" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L174)

##### DefaultSqlExpr (type alias)

Typed SQL-expression default descriptor.

**Signature**

```ts
type DefaultSqlExpr<Carrier> = Omit<Extract<Default, { readonly _tag: "sqlExpr" }>, "expression"> & {
  readonly expression: SQL<Carrier>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L154)

##### DefaultValue (type alias)

Literal-value default descriptor.

**Signature**

```ts
type DefaultValue<Encoded> = Omit<Extract<Default, { readonly _tag: "value" }>, "value"> & {
  readonly value: Encoded;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L164)

##### Empty (interface)

Exact initial metadata type inferred for a bare schema field.

**Signature**

```ts
export interface Empty extends Meta {
  readonly column: undefined;
  readonly columnName: undefined;
  readonly default: undefined;
  readonly dimensions: 0;
  readonly generated: false;
  readonly hasDefault: false;
  readonly identity: false;
  readonly indexed: false;
  readonly primaryKey: false;
  readonly references: undefined;
  readonly unique: false;
  readonly version: false;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L324)

##### FkAction (type alias)

Foreign-key referential actions understood by Drizzle.

**Signature**

```ts
type FkAction = "cascade" | "restrict" | "no action" | "set null" | "set default"
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L81)

##### Generated (type alias)

Generated-column descriptor union.

**Signature**

```ts
type Generated = TaggedEnum<{
  sqlExpr: { readonly expression: SQL<unknown> };
  unsafeSql: { readonly sql: string };
  identityAlways: {};
}>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L190)

##### GeneratedIdentityAlways (type alias)

Identity-always generated descriptor.

**Signature**

```ts
type GeneratedIdentityAlways = Extract<Generated, { readonly _tag: "identityAlways" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L229)

##### GeneratedSqlExpr (type alias)

Typed generated SQL-expression descriptor.

**Signature**

```ts
type GeneratedSqlExpr<Carrier> = Omit<Extract<Generated, { readonly _tag: "sqlExpr" }>, "expression"> & {
  readonly expression: SQL<Carrier>;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L211)

##### IdentityMode (type alias)

Identity-generation intent shared by integer-capable dialects.

**Signature**

```ts
type IdentityMode = "always" | "byDefault" | false
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L73)

##### IndexIntent (interface)

Single-column index intent carried on a field until model construction.

**Details**

`name` pins an explicit index name; `undefined` derives
`{table}_{column}_btree_idx` (or `{table}_{column}_unique_idx` when
`unique` is set) at model construction. Harvested intents compile through
the same table-extras node algebra as callback-declared indexes.

**Example** (Read a colocated index intent)

```ts
import { String } from "effect/Schema"
import { index } from "@beep/effect-drizzle/pg"

const field = String.pipe(index())
field.meta.indexed // => { name: undefined, unique: false }
```

**Signature**

```ts
export interface IndexIntent {
  readonly name: string | undefined;
  readonly unique: boolean;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L254)

##### Merge (type alias)

Literal-preserving metadata merge type.

**Signature**

```ts
type Merge<M, P> = {
  readonly [K in keyof Meta]: K extends keyof P ? (P[K] extends undefined ? M[K] : Exclude<P[K], undefined>) : M[K];
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L375)

##### Meta (interface)

Literal-preserving SQL intent exposed by inferred field metadata.

**Signature**

```ts
export interface Meta<C extends ColumnSpec = ColumnSpec> {
  readonly column: C | undefined;
  readonly columnName: string | undefined;
  readonly default: Default | undefined;
  readonly dimensions: ArrayDimension;
  readonly generated: Generated | false;
  readonly hasDefault: boolean;
  readonly identity: IdentityMode;
  readonly indexed: IndexIntent | false;
  readonly primaryKey: boolean;
  readonly references: References | undefined;
  readonly unique: boolean;
  readonly version: boolean;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L265)

##### Patch (type alias)

Partial metadata update produced by a field combinator.

**Signature**

```ts
type Patch = { readonly [K in keyof Meta]?: Meta[K] }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L367)

##### References (interface)

Foreign-key target resolved from identity statics or supplied explicitly.

**Signature**

```ts
export interface References<TableName extends string = string, ColumnName extends string = string> {
  readonly columnName: ColumnName;
  readonly name?: string;
  readonly onDelete: FkAction | undefined;
  readonly onUpdate: FkAction | undefined;
  readonly tableName: TableName;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L98)

##### UnsafeDefaultSql (type alias)

Explicit raw-SQL default descriptor.

**Signature**

```ts
type UnsafeDefaultSql = Extract<Default, { readonly _tag: "unsafeSql" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L182)

##### UnsafeGeneratedSql (type alias)

Explicit raw-SQL generated descriptor.

**Signature**

```ts
type UnsafeGeneratedSql = Extract<Generated, { readonly _tag: "unsafeSql" }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L221)

##### isUniqueKey

Reports whether metadata guarantees that one column uniquely locates a row.

**Details**

Primary keys, inline unique constraints, and colocated single-column unique
indexes all provide the same locator and foreign-key-target guarantee. A
non-unique index does not.

**Example** (Recognize a colocated unique index)

```ts
import { isUniqueKey } from "@beep/effect-drizzle"
import { String } from "effect/Schema"
import { uniqueIndex } from "@beep/effect-drizzle/pg"

isUniqueKey(String.pipe(uniqueIndex()).meta) // => true
```

**Signature**

```ts
declare const isUniqueKey: (meta: Meta) => boolean
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L302)

#### type-level

##### IsUniqueKey (type alias)

Type-level counterpart of `isUniqueKey`.

**Signature**

```ts
type IsUniqueKey<M> = M extends
  | { readonly primaryKey: true }
  | { readonly unique: true }
  | { readonly indexed: { readonly unique: true } }
  ? true
  : false
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Meta.ts#L311)

### Core: field carriers — `@beep/effect-drizzle`

The `@beep/effect-drizzle` field node: one correlated value owning an Effect schema AND its
SQL metadata, with both visible to the type system.

This is the load-bearing design decision of the experiment. Effect v4
annotations cannot carry type-visible metadata (`.annotate` returns
`Rebuild`), so — following the `VariantSchema.Field` precedent — the field
is a small pipeable wrapper `{ schema, meta }` whose combinators transform
both the runtime value and the phantom generics without loss.

#### errors

##### SqlTypeError (interface)

Carrier for compile-time `@beep/effect-drizzle` diagnostics at a combinator callsite.

**Details**

When a constraint fails, its message literal appears in the assignability
diagnostic on the offending pipe call.

**Signature**

```ts
export interface SqlTypeError<Msg extends string> {
  readonly "~effect-drizzle.error": Msg;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L207)

#### models

##### Any (type alias)

Existential field carrier exposed through public combinator inference.

**Signature**

```ts
type Any = Field<AnySchema, Meta.Meta>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L69)

##### AnySchema (type alias)

Schema forms a `@beep/effect-drizzle` field can wrap.

**Gotchas**

Effect's current usable existential is `VariantSchema.Field<any>`. Its
structural `Field.Any` marker omits `schemas` and `pipe`, while a concrete
config is invariant and rejects valid literal variant records. This mirrors
Effect's own erased-field boundary rather than widening `@beep/effect-drizzle` data.

**Signature**

```ts
type AnySchema = Top | VariantSchema.Field<any>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L49)

##### EncodedOf (type alias)

Encoded database-facing type of an input; variant fields use `select`.

**Signature**

```ts
type EncodedOf<I> = SchemaEncoded<SchemaFrom<I>>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L179)

##### Field (interface)

Pipeable carrier correlating one schema with its inferred SQL metadata.

**Signature**

```ts
export interface Field<out Sch extends AnySchema, out M extends Meta.Meta> extends Pipeable {
  readonly meta: M;
  readonly schema: Sch;
  readonly [TypeId]: TypeId;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L57)

##### Input (type alias)

Bare schema, variant field, or existing field accepted by public combinators.

**Signature**

```ts
type Input = AnySchema | Any
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L77)

##### MetaFrom (type alias)

The metadata type an input resolves to; bare schemas start at `Meta.Empty`.

**Signature**

```ts
type MetaFrom<I> = I extends Field<AnySchema, infer M> ? M : Meta.Empty
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L123)

##### Patched (type alias)

Field type produced after applying a metadata patch to an input.

**Signature**

```ts
type Patched<I, Patch> = Field<SchemaFrom<I>, Meta.Merge<MetaFrom<I>, Patch>>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L153)

##### SchemaFrom (type alias)

Schema type obtained by normalizing an `Input`.

**Signature**

```ts
type SchemaFrom<I> = I extends Field<infer Sch, Meta.Meta> ? Sch : Extract<I, AnySchema>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L115)

#### validation

##### ValidateArrayElement (type alias)

Validate that an array element declaration owns one scalar column spec.

**Signature**

```ts
type ValidateArrayElement<I> = MetaFrom<I>["column"] extends undefined
  ? SqlTypeError<"pg.array requires an element schema with an explicit base column combinator">
  : MetaFrom<I>["dimensions"] extends 0
    ? unknown
    : SqlTypeError<"pg.array element declarations must be scalar">
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L255)

##### ValidateArrayEncoded (type alias)

Validate an outer schema against an element carrier and declared array depth.

**Signature**

```ts
type ValidateArrayEncoded<I, Element, Dimensions> = [
  Exclude<EncodedOf<I>, null>,
] extends [ArrayCarrier<EncodedOf<Element>, Dimensions>]
  ? [ArrayCarrier<EncodedOf<Element>, Dimensions>] extends [Exclude<EncodedOf<I>, null>]
    ? unknown
    : SqlTypeError<"pg.array outer schema must exactly match the element carrier at the declared depth">
  : SqlTypeError<"pg.array outer schema must exactly match the element carrier at the declared depth">
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L267)

##### ValidateEncoded (type alias)

Validate an input's non-null encoded carrier against an allowed SQL carrier.

**Signature**

```ts
type ValidateEncoded<I, Allowed, Msg> = [Exclude<EncodedOf<I>, null>] extends [
  Allowed,
]
  ? unknown
  : SqlTypeError<Msg>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L217)

##### ValidateNonNullable (type alias)

Reject inputs whose encoded database representation admits `null`.

**Signature**

```ts
type ValidateNonNullable<I, Msg> = [EncodedOf<I>] extends [
  NonNullable<EncodedOf<I>>,
]
  ? unknown
  : SqlTypeError<Msg>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/Field.ts#L233)

### Core: model contract — `@beep/effect-drizzle`

Defines the dialect-neutral model statics consumed by projectors and repositories.

The structural contract keeps table identity, original fields, resolved
metadata, and table extras available without coupling core services to a dialect.

#### errors

##### AnyModel (interface)

Structural model bound exposed by repository and dialect projector inference.

**Signature**

```ts
export interface AnyModel {
  readonly sql: {
    readonly tableName: string;
    readonly fields: Readonly<Record<string, Field.Input>>;
    readonly columns: Readonly<Record<string, Meta.Meta>>;
    readonly extras: ((columns: never) => ReadonlyArray<unknown>) | undefined;
  };
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/model.ts#L59)

##### ModelInvariantError (class)

Reports a model declaration that violates a SQL invariant at runtime.

**Details**

The error names the offending field when possible. It mirrors compile-time
validators for callers that suppress types or hand-build field metadata.

**Example** (Inspect a model invariant)

```ts
import { ModelInvariantError } from
  "@beep/effect-drizzle"

const error = ModelInvariantError.make({
  message: "primary keys cannot be nullable",
  fieldName: "id"
})

error._tag // => "ModelInvariantError"
error.fieldName // => "id"
```

**Signature**

```ts
declare class ModelInvariantError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/model.ts#L41)

### Core: model variants — `@beep/effect-drizzle`

Defines the shared Effect model-variant vocabulary for every dialect.

One factory keeps select, insert, update, and JSON membership identical
across PostgreSQL and SQLite model construction.

#### combinators

##### FieldExcept

Includes one schema in every model variant except those named.

**When to use**

Use when membership is easier to state as a short exclusion list.

**Example** (Exclude a field from create variants)

```ts
import { String } from "effect/Schema"
import { FieldExcept } from
  "@beep/effect-drizzle"

const field = String.pipe(FieldExcept(["insert", "jsonCreate"]))

"insert" in field.schemas // => false
```

**See**

- `FieldOnly` for the complementary inclusion form.

**Signature**

```ts
declare const FieldExcept: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => VariantSchema.Field<{ readonly [K in Exclude<"update", Keys[number]> | Exclude<"insert", Keys[number]> | Exclude<"select", Keys[number]> | Exclude<"json", Keys[number]> | Exclude<"jsonCreate", Keys[number]> | Exclude<"jsonUpdate", Keys[number]>]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/variant.ts#L146)

##### FieldOnly

Includes one schema in only the named model variants.

**When to use**

Use when membership is easier to state as a short inclusion list.

**Example** (Keep a field in read variants)

```ts
import { String } from "effect/Schema"
import { FieldOnly } from
  "@beep/effect-drizzle"

const field = String.pipe(FieldOnly(["select", "json"]))

Object.keys(field.schemas) // => ["select", "json"]
```

**See**

- `FieldExcept` for the complementary exclusion form.

**Signature**

```ts
declare const FieldOnly: <const Keys extends ReadonlyArray<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(keys: Keys) => <S extends Top>(schema: S) => VariantSchema.Field<{ readonly [K in Keys[number]]: S; }>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/variant.ts#L121)

##### fieldEvolve

Evolves selected variant schemas while leaving other variants unchanged.

**When to use**

Use to refine one or more members of an existing variant field without
rebuilding its complete membership map.

**Example** (Evolve one member)

```ts
import { NullOr, String } from "effect/Schema"
import { VariantField, fieldEvolve } from
  "@beep/effect-drizzle"

const field = VariantField({ select: String, update: String }).pipe(
  fieldEvolve({ update: NullOr })
)

field.schemas.update // => NullOr(String)
```

**Signature**

```ts
declare const fieldEvolve: { <Self extends VariantSchema.Field<any> | Top, const Mapping extends Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(f: Mapping): (self: Self) => VariantSchema.Field<Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; <Self extends VariantSchema.Field<any> | Top, const Mapping extends Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]?: ((variant: S[K]) => Top) | undefined; } : { readonly update?: ((variant: Self) => Top) | undefined; readonly insert?: ((variant: Self) => Top) | undefined; readonly select?: ((variant: Self) => Top) | undefined; readonly json?: ((variant: Self) => Top) | undefined; readonly jsonCreate?: ((variant: Self) => Top) | undefined; readonly jsonUpdate?: ((variant: Self) => Top) | undefined; }>(self: Self, f: Mapping): VariantSchema.Field<Self extends VariantSchema.Field<infer S extends VariantSchema.Field.Config> ? { readonly [K in keyof S]: K extends keyof Mapping ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K] : S[K]; } : { readonly update: "update" extends keyof Mapping ? Mapping[keyof Mapping & "update"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "update"]> : Self : Self; readonly insert: "insert" extends keyof Mapping ? Mapping[keyof Mapping & "insert"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "insert"]> : Self : Self; readonly select: "select" extends keyof Mapping ? Mapping[keyof Mapping & "select"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "select"]> : Self : Self; readonly json: "json" extends keyof Mapping ? Mapping[keyof Mapping & "json"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "json"]> : Self : Self; readonly jsonCreate: "jsonCreate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonCreate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonCreate"]> : Self : Self; readonly jsonUpdate: "jsonUpdate" extends keyof Mapping ? Mapping[keyof Mapping & "jsonUpdate"] extends (arg: any) => any ? ReturnType<Mapping[keyof Mapping & "jsonUpdate"]> : Self : Self; }>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/variant.ts#L173)

#### constructors

##### VariantField

Assigns distinct schemas to selected model variants.

**When to use**

Use when a field's database or JSON representation differs by operation and
the ordinary default/generated truth table is insufficient.

**Details**

Only listed variants contain the field. The supplied mapping remains the
source of truth instead of being regenerated from SQL metadata.

**Example** (Define explicit variant membership)

```ts
import { String } from "effect/Schema"
import { VariantField } from
  "@beep/effect-drizzle"

const field = VariantField({ select: String, update: String })

Object.keys(field.schemas) // => ["select", "update"]
```

**See**

- `FieldOnly` for assigning one schema to an inclusion list.
- `FieldExcept` for assigning one schema outside an exclusion list.

**Signature**

```ts
declare const VariantField: <const A extends VariantSchema.Field.ConfigWithKeys<"update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">>(config: A & { readonly [K in Exclude<keyof A, "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">]: never; }) => VariantSchema.Field<A>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/variant.ts#L96)

#### destructors

##### extract

Extracts the schema for one variant from a variant-aware model structure.

**When to use**

Use when generic code receives a variant structure and needs one concrete
operation schema; model classes also expose their common variants as statics.

**Example** (Extract an insert schema)

```ts
import { String } from "effect/Schema"
import { Model, extract } from
  "@beep/effect-drizzle"

class User extends Model<User>("User")({ name: String }) {}

extract(User, "insert") // => schema for User's insert payload
```

**Signature**

```ts
declare const extract: { <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate">(variant: V): <A extends VariantSchema.Struct<any>>(self: A) => VariantSchema.Extract<V, A, V extends "select" ? true : false>; <V extends "update" | "insert" | "select" | "json" | "jsonCreate" | "jsonUpdate", A extends VariantSchema.Struct<any>>(self: A, variant: V): VariantSchema.Extract<V, A, V extends "select" ? true : false>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/variant.ts#L198)

#### guards

##### Variant

Guards each supported model projection name for dialect-aware consumers.

**Signature**

```ts
declare const Variant: { is: { select: (value: unknown) => value is "select"; insert: (value: unknown) => value is "insert"; update: (value: unknown) => value is "update"; json: (value: unknown) => value is "json"; jsonCreate: (value: unknown) => value is "jsonCreate"; jsonUpdate: (value: unknown) => value is "jsonUpdate"; }; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/variant.ts#L43)

#### schemas

##### Variant (type alias)

Names the six model projections shared by both SQL dialects.

**Details**

`select`, `insert`, and `update` serve database operations; `json`,
`jsonCreate`, and `jsonUpdate` serve transport boundaries.

**Example** (Select write variants)

```ts
import type { Variant } from
  "@beep/effect-drizzle"

type WriteVariant = Extract<Variant, "insert" | "update"> // => "insert" | "update"
```

**Signature**

```ts
type Variant = (typeof variants)[number]
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/variant.ts#L36)

### Core: optimistic repositories — `@beep/effect-drizzle`

Derives optimistic repositories from model SQL metadata.

The repository layer delegates ordinary CRUD to Effect SQL and owns the
atomic compare-and-increment update required by versioned models.

#### errors

##### VersionConflictError (class)

Reports an optimistic update whose id/version pair matched no current row.

**When to use**

Use to recover from concurrent writes at a repository boundary, usually by
reloading the entity or asking the caller to retry.

**Details**

Missing rows and stale rows intentionally share this error. A follow-up
read would add a round trip and could race with another writer.

**Example** (Construct a version conflict)

```ts
import { VersionConflictError } from
  "@beep/effect-drizzle"

const error = VersionConflictError.make({ table: "user", id: 1, expectedVersion: 2 })
error._tag // => "VersionConflictError"
error.expectedVersion // => 2
```

**See**

- `makeRepository` for the operation that produces this error.

**Signature**

```ts
declare class VersionConflictError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/repository.ts#L63)

#### factories

##### makeRepository

Builds a repository whose version field is discovered from model metadata.

**When to use**

Use when a model has exactly one `version()` field and updates must be
optimistic rather than Effect SQL's native id-only update.

**Details**

Repository acquisition is an Effect requiring `SqlClient`. The generated
update performs one `UPDATE ... WHERE id = ... AND version = ... RETURNING`
statement and increments the version inside SQL. Both
`makeRepository(model, options)` and `makeRepository(options)(model)` retain
model-specific locator inference.

**Gotchas**

The id field must remain in the model's update variant as a row locator, and
the version field is required in every update payload. A zero-row result
deliberately cannot distinguish a missing id from a stale version.

**Example** (Run an optimistic repository)

```ts
import { PgliteTestLayer } from
  "@beep/pglite"
import { gen, provide, runPromise } from "effect/Effect"
import { Int, String } from "effect/Schema"
import { SqlClient } from "effect/unstable/sql/SqlClient"
import { Model, makeRepository } from
  "@beep/effect-drizzle"
import { default as defaultValue, identity, integer, primaryKey, version } from
  "@beep/effect-drizzle/pg"

class User extends Model<User>("User")({
  id: Int.pipe(integer(), identity("always"), primaryKey()),
  email: String,
  revision: Int.pipe(integer(), defaultValue(1), version())
}) {}

const program = gen(function*() {
  const sql = yield* SqlClient
  yield* sql`create table user (
    id integer generated always as identity primary key,
    email text not null,
    revision integer not null default 1
  )`
  const repository = yield* makeRepository(User, {
    spanPrefix: "User",
    idColumn: "id"
  })
  return yield* repository.insert({ email: "ada@example.com" })
})

await runPromise(provide(program, PgliteTestLayer))
// => User { id: 1, email: "ada@example.com", revision: 1 }
```

**See**

- `Repository` for the returned CRUD surface.
- `VersionConflictError` for stale or missing update matches.

**Signature**

```ts
declare const makeRepository: { <const M extends RepositoryModel, const Id extends IdKey<M>>(model: M & ValidateVersionModel<M> & ValidateColumnNames<M>, options: { readonly spanPrefix: string; readonly idColumn: Id; }): Effect<Repository<M, Id>, never, SqlClient>; <const Id extends string>(options: { readonly spanPrefix: string; readonly idColumn: Id; }): <const M extends RepositoryModel>(model: M & ValidateVersionModel<M> & ValidateColumnNames<M> & ValidateLocator<M, Id>) => Effect<Repository<M, Id & IdKey<M>>, never, SqlClient>; }
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/repository.ts#L361)

#### repositories

##### Repository (type alias)

Exposes CRUD with an atomic compare-and-increment update operation.

**When to use**

Use as an application port when writes must reject stale versions without a
preceding read.

**Details**

Insert, lookup, and delete retain Effect SQL's native repository behavior.
Update locates by id and expected version, excludes both from `SET`, and
increments the stored version in the same statement.

**Gotchas**

The update payload must contain both the row id and current version even
though neither value is written verbatim. Missing rows and stale rows both
fail with `VersionConflictError`.

**Example** (Name an optimistic repository port)

```ts
import { Int, String } from "effect/Schema"
import { Model, type Repository } from
  "@beep/effect-drizzle"
import { default as defaultValue, identity, integer, primaryKey, version } from
  "@beep/effect-drizzle/pg"

class User extends Model<User>("User")({
  id: Int.pipe(integer(), identity("always"), primaryKey()),
  email: String,
  revision: Int.pipe(integer(), defaultValue(1), version())
}) {}

type UserRepository = Repository<typeof User, "id">
// => CRUD port whose update can fail with VersionConflictError
```

**See**

- `makeRepository` for deriving this port from model metadata.

**Signature**

```ts
type Repository<M, Id> = Pick<
  NativeRepository<M, Id>,
  "insert" | "insertVoid" | "findById" | "delete"
> & {
  readonly update: (
    update: M["update"]["Type"]
  ) => Effect<
    M["Type"],
    SchemaError | SqlError | VersionConflictError,
    M["DecodingServices"] | M["update"]["EncodingServices"]
  >;
}
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/repository.ts#L203)

#### type-level

##### VersionKey (type alias)

Selects the field key marked as a model's optimistic version.

**Details**

The projection inspects resolved SQL metadata and returns `never` when the
model has no version field.

**Example** (Infer a version key)

```ts
import { Int } from "effect/Schema"
import { Model, type VersionKey } from
  "@beep/effect-drizzle"
import { default as defaultValue, integer, version } from
  "@beep/effect-drizzle/pg"

class User extends Model<User>("User")({
  revision: Int.pipe(integer(), defaultValue(1), version())
}) {}

type Key = VersionKey<typeof User> // => "revision"
```

**Signature**

```ts
type VersionKey<M> = {
  readonly [K in keyof M["sql"]["columns"] & string]: M["sql"]["columns"][K] extends {
    readonly version: true;
  }
    ? K
    : never;
}[keyof M["sql"]["columns"] & string]
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/repository.ts#L127)

### Core: SQL naming invariants — `@beep/effect-drizzle`

Shared type-level and runtime SQL naming invariants.

#### type-level

##### ValidateDerivedSqlName (type alias)

Validates the lowercase approximation of a model's derived table name.

**Signature**

```ts
type ValidateDerivedSqlName<Identifier, Message> = string extends Identifier
  ? unknown
  : ValidateSqlName<Lowercase<IdentifierTail<Identifier>>, Message>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/names.ts#L89)

##### ValidateSqlName (type alias)

Adds a surface-specific diagnostic without changing the validation cache key.

**Signature**

```ts
type ValidateSqlName<Name, Message> = string extends Name
  ? unknown
  : IsValidSqlName<Name> extends true
    ? unknown
    : BslTypeError<Message>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/names.ts#L76)

### Core: assembly contracts — `@beep/effect-drizzle`

Builds deterministic relation names and RQBv2 relation configurations.

Dialect assemblers provide resolved tables and foreign-key edges; this
module turns that graph into forward, reverse, and junction relations.

### Core: encoded classification — `@beep/effect-drizzle`

Classifies encoded Effect schema ASTs into dialect column descriptors.

The shared traversal strips nullability, rejects ambiguous unions, and lets
each dialect supply the carrier-to-column policy without duplicating it.

#### utilities

##### DeriveColumnError (class)

Failure to derive one unambiguous SQL column from an encoded schema.

**Signature**

```ts
declare class DeriveColumnError
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/classification.ts#L42)

### Core: EntityId statics — `@beep/effect-drizzle`

Recognizes EntityId schemas through their stable structural metadata.

Dialect model factories use these statics to derive integer storage and
automatic references without importing an application identity package.

#### guards

##### isEntityIdLike

Test unknown input for EntityId schema statics.

**Signature**

```ts
declare const isEntityIdLike: <I>(input: I) => input is I & EntityIdLikeShape
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/entity-id.ts#L52)

#### models

##### EntityIdLike (type alias)

Decoded structural statics recognized by `EntityIdLike`.

**Signature**

```ts
type EntityIdLike = typeof EntityIdLike.Type
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/entity-id.ts#L44)

#### schemas

##### EntityIdLike

Structural statics carried by dialect-free EntityId schemas in public inference.

**Signature**

```ts
declare const EntityIdLike: declare<EntityIdLikeShape, EntityIdLikeShape>
```

[Source](https://github.com/beep-effect/beep-effect/tree/main/packages/ecosystem/effect-drizzle/src/core/entity-id.ts#L25)

### Core: literal collection — `@beep/effect-drizzle`

Collects finite string-literal domains from encoded Effect schemas.

Dialect enum combinators share this traversal so runtime values and
type-level literal unions follow the same schema boundary.

<!-- docgen:api-reference:end -->
