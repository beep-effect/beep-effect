# Mining `effect-qb` for the BSL SQL DSL

Research snapshot: local `effect-qb` checkout on `main` at `c898496`, inspected 2026-08-08. Source references are relative to the `effect-qb` repository unless prefixed with `scratchpad/bsl/`, which refers to the BSL experiment in `beep-effect20`.

## Executive verdict

`effect-qb` is a substantial, Effect-native, multi-dialect **SQL query builder**, not an ORM and not a Drizzle/Kysely wrapper. A table declaration creates column/schema/DDL metadata and also feeds a first-party typed query AST; a renderer turns a complete, dialect-compatible plan into SQL plus projection metadata; an executor normalizes driver values and Effect-Schema-decodes the result. That is the architecture the README itself claims (`README.md:3-8`, `README.md:150-176`), and the package has no Drizzle or Kysely runtime dependency (`packages/querybuilder/package.json:22-50`, `packages/querybuilder/package.json:63-68`).

For BSL, the most valuable material is **below** the surface syntax:

1. the separate decoded-runtime and SQL-database type witnesses on every expression;
2. state transitions for default/generated/identity/key metadata;
3. exact foreign-key compatibility against SQL type identity;
4. typed DDL expressions instead of raw SQL strings;
5. source-provenance and predicate-fact machinery that computes result nullability;
6. the runtime encode/normalize/decode pipeline and structured row-decode errors.

BSL should not port the full query-plan engine if Drizzle remains the query backend. It should lift the smaller invariants into `Field<Schema, Meta>` and let Drizzle keep owning query construction. The two projects meet at table metadata, but they point in opposite directions: effect-qb begins with a SQL column constructor and optionally replaces its runtime codec, while BSL begins with an Effect Schema/Variant field and decorates it with SQL intent (`packages/querybuilder/src/standard/column.ts:48-84`, `packages/querybuilder/src/internal/column.ts:475-482`; `scratchpad/bsl/Field.ts:1-9`, `scratchpad/bsl/Field.ts:20-27`).

## 1. What effect-qb is

### Purpose and scope

The package defines tables, typed SQL expressions and query plans; renders PostgreSQL, MySQL, and SQLite SQL; and executes through Effect SQL or a caller-provided driver. The root API is intended to be portable and dialect modules add engine-specific types/functions/options (`README.md:91-96`, `README.md:144-146`, `README.md:181-190`). Schema migration/introspection is explicitly outside `effect-qb`; the workspace's separate `effect-db` package owns pull, push, and migration workflows (`README.md:1902-1922`).

This is an **own-builder architecture**:

```text
ColumnDefinition + TableDefinition
  -> typed expression/query AST
  -> dialect Renderer
  -> { sql, params, projections, valueMappings }
  -> dialect Executor / custom Driver
  -> normalized and Schema-decoded rows
```

The public renderer accepts only a `DialectCompatiblePlan` and preserves the inferred row as phantom metadata on `RenderedQuery` (`packages/querybuilder/src/internal/renderer.ts:13-30`, `packages/querybuilder/src/internal/renderer.ts:35-47`). A table is itself a `RowSet`, so table identity, bound columns, schemas, and query-source state all live on one object (`packages/querybuilder/src/internal/table.ts:351-376`).

### Effect version

It is on **Effect v4 beta**, specifically peer dependency `effect@4.0.0-beta.98`, not Effect v3 (`packages/querybuilder/package.json:63-68`). The workspace pins the same Effect beta across `effect`, Platform, and SQL adapters and uses the native TypeScript preview compiler (`package.json:20-46`). Runtime code imports v4 `effect/Schema` and `effect/unstable/sql/SqlClient`, for example in the executor (`packages/querybuilder/src/internal/executor.ts:1-8`).

### Maturity and test posture

The audited package version is `0.22.0`, Node `>=22`, MIT-licensed (`packages/querybuilder/package.json:1-16`). The changelog shows a dated 0.22.0 release with recent typed composition, analytics, result-contract, and query-inspection work (`CHANGELOG.md:7-32`). It is therefore much more than a sketch, but it is still pre-1.0 and coupled to a beta Effect API; “mature implementation, unstable public contract” is the fairest classification.

Measured locally in this checkout:

- `bun test --coverage`: **550 pass, 0 fail**, 1,413 assertions across 38 executed test files; aggregate workspace coverage was **84.45% lines / 80.56% functions**. The configured gate is 80% for both lines and functions (`bunfig.test.toml:1-8`). The aggregate includes `effect-db` and built `dist` files, so it is not a clean querybuilder-only coverage percentage.
- `bunx tsgo -p tsconfig.type-tests.json`: passed. The type-test corpus contains 540 `@ts-expect-error` assertions across 46 files; representative negative tests cover nullable primary keys, mutually-exclusive generated/default state, mismatched inline references, empty keys, unknown columns, and composite-FK arity (`test/internal/types/table-types.ts:457-484`, `test/internal/types/table-types.ts:491-527`).
- `bunx tsgo -p tsconfig.node.json`: passed.
- Integration tests were not run locally for this report. CI builds, runs coverage and type tests, smoke-tests packed packages on Node 22/24, and has a separate Node 22/24 integration matrix (`.github/workflows/ci.yml:19-47`, `.github/workflows/ci.yml:49-84`, `.github/workflows/ci.yml:86-116`).

The type-level machinery is unusually well exercised. The caveat is complexity: the core standard DSL alone is about 7,000 lines, and `QueryPlan` has thirteen generic state axes (`packages/querybuilder/src/internal/query.ts:2354-2388`).

## 2. Architecture in more detail

### Column layer

`ColumnState` carries three application-facing types (`Select`, `Insert`, `Update`), a structural `DbType`, and boolean flags for nullability, default, generated, primary key, and uniqueness. It also carries references, index/unique detail, default/generated expressions, exact DDL type, driver mappings, identity, enum, and dependencies (`packages/querybuilder/src/internal/column-state.ts:51-91`).

`ColumnDefinition` is simultaneously:

- a pipeable metadata node;
- a typed scalar SQL expression;
- an Effect runtime schema holder;
- a phantom state carrier.

Its scalar nullability is derived from the column's explicit boolean flag, and its dialect comes from the `DbType` (`packages/querybuilder/src/internal/column-state.ts:93-153`). `makeColumnDefinition` copies the same data into the column state, expression state, and runtime metadata (`packages/querybuilder/src/internal/column-state.ts:249-321`). This duplication makes downstream inference powerful, but it is also one of the places BSL's smaller `{ schema, meta }` wrapper is cleaner.

Binding a definition to a table adds table/column/base-table/schema provenance, changes dependencies to the table binding, and installs a concrete column AST (`packages/querybuilder/src/internal/column-state.ts:155-199`, `packages/querybuilder/src/internal/column-state.ts:470-478`). Opt-in `Column.brand` then brands values with the literal `` `${table}.${column}` `` while preserving `null`/`undefined` (`packages/querybuilder/src/internal/column.ts:288-338`, `packages/querybuilder/src/internal/column-state.ts:504-537`).

### Table layer

`Table.make(name, fields)` binds every column, gathers inline options, validates dialect consistency, resolves primary keys and conflict arbiters, and returns a table that is also a query row source (`packages/querybuilder/src/internal/table.ts:503-528`, `packages/querybuilder/src/internal/table.ts:906-940`). The table exposes bound columns directly (`users.id`), a `.columns` record, and lazy `.schemas.select/.insert/.update` (`packages/querybuilder/src/internal/table.ts:351-376`, `packages/querybuilder/src/internal/table.ts:530-640`).

There is also a class-shaped table API, but it is a static SQL table object “mirroring `Schema.Class`,” not a domain Schema/Model class whose instances represent rows (`packages/querybuilder/src/internal/table.ts:378-409`, `packages/querybuilder/src/internal/table.ts:1062-1161`). This distinction matters for BSL: BSL's returned class really is a six-variant `VariantSchema.Class` with SQL statics layered onto it (`scratchpad/bsl/factory.ts:39-49`, `scratchpad/bsl/factory.ts:121-127`).

### Query, renderer, executor

Each expression carries decoded runtime type, SQL `DbType`, a three-state nullability lattice, dialect, scalar/aggregate/window kind, runtime schema, driver mapping, dependencies, and grouping identity (`packages/querybuilder/src/internal/scalar.ts:19-41`, `packages/querybuilder/src/internal/scalar.ts:154-205`). Query combinators transform a phantom state containing outstanding and available sources, grouping, predicate assumptions/facts, capabilities, statement kind, mutation target, and insert-source readiness (`packages/querybuilder/src/internal/query.ts:116-142`).

The renderer emits projection paths/aliases with the SQL. The executor uses those projections to reconstruct nested selections, normalize raw driver values, and decode each scalar with its runtime schema (`packages/querybuilder/src/internal/renderer.ts:20-29`, `packages/querybuilder/src/internal/executor.ts:386-471`, `packages/querybuilder/src/internal/executor.ts:474-541`).

## 3. Schema-to-SQL story

### 3.1 It is SQL-first, not general Schema-to-column derivation

The central orientation is:

```ts
Column.varchar(320)                 // chooses Schema + SQL DbType + DDL
Column.date().pipe(Column.schema(Schema.DateFromString))
```

Primitive constructors choose both the Effect Schema and SQL descriptor. For example, `varchar(length)` constructs `Schema.String.check(Schema.isMaxLength(length))`, a `varchar` database witness, and a `varchar(n)` DDL override (`packages/querybuilder/src/standard/column.ts:48-53`, `packages/querybuilder/src/standard/column.ts:71-96`). PostgreSQL constructors repeat that pattern with PostgreSQL-specific datatype witnesses (`packages/querybuilder/src/postgres/column.ts:25-37`, `packages/querybuilder/src/postgres/column.ts:51-72`, `packages/querybuilder/src/postgres/column.ts:74-155`).

There is no general traversal of an arbitrary Effect Schema AST to infer column families. Arbitrary schemas enter through `Column.custom(schema, dbType)`, JSON/JSONB constructors, or `Column.schema(nextSchema)` on an already-typed SQL column (`packages/querybuilder/src/standard/column.ts:55-69`, `packages/querybuilder/src/standard/column.ts:118-129`, `packages/querybuilder/src/internal/column.ts:475-482`). This is the inverse of BSL's `Field<Schema, Meta>` design, where bare schemas can derive conservative PostgreSQL column specs from their **encoded AST** and ambiguous schemas fail loudly (`scratchpad/bsl/derive.ts:1-20`, `scratchpad/bsl/derive.ts:67-107`, `scratchpad/bsl/derive.ts:177-227`).

### 3.2 Encoded versus decoded sides

This is effect-qb's cleverest Schema bridge. Replacing a column codec is permitted only when the column's existing non-null select carrier can feed the new codec's **encoded** side; after replacement, select/insert/update types become the new codec's decoded `Schema.Type`, with SQL nullability reapplied.

Verbatim (`packages/querybuilder/src/internal/column.ts:257-286`):

```ts
type SchemaCompatibleColumn<
  Column extends AnyColumnDefinition,
  SchemaType extends Schema.Top
> = [BaseSelectType<Column>] extends [Schema.Codec.Encoded<SchemaType>]
  ? Column
  : never

type ColumnSchemaOutput<
  Column extends AnyColumnDefinition,
  SchemaType extends Schema.Top
> = IsNullable<Column> extends true
  ? Schema.Schema.Type<SchemaType> | null
  : Schema.Schema.Type<SchemaType>

type ColumnWithSchema<
  Column extends AnyColumnDefinition,
  SchemaType extends Schema.Top
> = ColumnDefinition<
  ColumnSchemaOutput<Column, SchemaType>,
  ColumnSchemaOutput<Column, SchemaType>,
  ColumnSchemaOutput<Column, SchemaType>,
  Column[typeof ColumnTypeId]["dbType"],
  IsNullable<Column>,
  HasDefault<Column>,
  IsGenerated<Column>,
  IsPrimaryKey<Column>,
  Column[typeof ColumnTypeId]["unique"],
  ReferencesOf<Column>,
  Column[typeof ColumnTypeId]["dependencies"]
> & PreserveBrand<Column>
```

The public implementation is only a schema replacement after that constraint (`packages/querybuilder/src/internal/column.ts:475-482`). Thus a string-backed SQL date can become a decoded `Date` via `Schema.DateFromString`, as the README demonstrates (`README.md:286-307`).

At execution time the boundary is honored in both directions:

- outgoing values are checked as decoded values and passed through `Schema.encodeUnknownSync` before driver normalization (`packages/querybuilder/src/internal/runtime/driver-value-mapping.ts:101-121`, `packages/querybuilder/src/internal/runtime/driver-value-mapping.ts:149-172`);
- incoming driver values are normalized by SQL type/mapping, then checked or decoded by the expression runtime schema (`packages/querybuilder/src/internal/runtime/driver-value-mapping.ts:174-195`, `packages/querybuilder/src/internal/executor.ts:386-471`).

This split is highly relevant to BSL. BSL already defines `EncodedOf<I>` from the select variant and uses that encoded type for Drizzle's `$type` (`scratchpad/bsl/Field.ts:79-97`, `scratchpad/bsl/table.ts:101-123`). effect-qb supplies the missing conceptual name: keep at least three contracts distinct—domain decoded type, database encoded carrier, and driver's raw/normalized representation.

### 3.3 Column-state transitions and invariants

Modifiers are typed state transitions, not mutable flags. `NullableColumn`, `PrimaryKeyColumn`, `HasDefaultColumn`, `GeneratedColumn`, and the two identity states each rebuild `ColumnDefinition<...>` with exact booleans (`packages/querybuilder/src/internal/column.ts:58-178`). The public functions constrain illegal prior states at the pipe callsite:

- `nullable` rejects primary keys; `primaryKey` rejects nullable columns and forces unique/non-null (`packages/querybuilder/src/internal/column.ts:511-529`);
- `default` rejects generated columns; `generated` rejects defaulted columns, and each checks the DDL expression's runtime/DB-type compatibility (`packages/querybuilder/src/internal/column.ts:180-196`, `packages/querybuilder/src/internal/column.ts:556-581`);
- `identityByDefault` means insert-optional (`hasDefault: true`), whereas `identityAlways` means generated and omitted (`packages/querybuilder/src/internal/column.ts:649-677`);
- array mapping preserves all state and independently controls element nullability (`packages/querybuilder/src/internal/column.ts:340-394`, `packages/querybuilder/src/internal/column.ts:599-621`).

The default/generated expression representation is particularly good: `DdlExpression` is a typed query expression or schema expression, not an unstructured string (`packages/querybuilder/src/internal/column-state.ts:19-29`). By contrast, BSL currently records `defaultSql: string` and emits it with `sql.raw(...)` (`scratchpad/bsl/Meta.ts:28-41`, `scratchpad/bsl/pg.ts:153-159`, `scratchpad/bsl/table.ts:198-213`). This is a direct safety and type-information opportunity.

### 3.4 Derived select/insert/update row types

The table payload rules are direct projections of column flags:

- select: every key is present;
- insert: generated keys are absent; nullable or defaulted keys are optional; all others required;
- update: generated and primary-key keys are absent; every remaining key is optional;
- opt-in provenance brands are applied consistently to all three types.

The central type-level code is concise compared with the query engine. Verbatim (`packages/querybuilder/src/internal/schema-derivation.ts:19-36`, `packages/querybuilder/src/internal/schema-derivation.ts:76-102`):

```ts
type GeneratedKeys<Fields extends TableFieldMap> = {
  [K in keyof Fields]: IsGenerated<Fields[K]> extends true ? K : never
}[keyof Fields]

type OptionalInsertKeys<Fields extends TableFieldMap> = {
  [K in keyof Fields]:
    IsGenerated<Fields[K]> extends true ? never :
      IsNullable<Fields[K]> extends true ? K :
        HasDefault<Fields[K]> extends true ? K :
          never
}[keyof Fields]

type RequiredInsertKeys<Fields extends TableFieldMap> = Exclude<keyof Fields, GeneratedKeys<Fields> | OptionalInsertKeys<Fields>>

type UpdateKeys<Fields extends TableFieldMap, PrimaryKey extends keyof Fields> = Exclude<
  keyof Fields,
  GeneratedKeys<Fields> | PrimaryKey
>

export type SelectRow<
  TableName extends string,
  Fields extends TableFieldMap
> = Simplify<{
  [K in keyof Fields]: BrandedSelectType<Fields[K], TableName, Extract<K, string>>
}>

export type InsertRow<
  TableName extends string,
  Fields extends TableFieldMap
> = Simplify<
  { [K in RequiredInsertKeys<Fields>]: BrandedInsertType<Fields[K], TableName, Extract<K, string>> } &
    { [K in OptionalInsertKeys<Fields>]?: BrandedInsertType<Fields[K], TableName, Extract<K, string>> }
>

export type UpdateRow<
  TableName extends string,
  Fields extends TableFieldMap,
  PrimaryKey extends keyof Fields
> = Simplify<
  Partial<{
    [K in UpdateKeys<Fields, PrimaryKey>]: BrandedUpdateType<Fields[K], TableName, Extract<K, string>>
  }>
>
```

The runtime algorithm mirrors those rules by building a fresh `Schema.Struct`: null wraps select fields, nullable/default makes insert properties optional, and generated/PK fields are omitted as appropriate (`packages/querybuilder/src/internal/schema-derivation.ts:104-147`, `packages/querybuilder/src/internal/schema-derivation.ts:158-195`). The schemas are derived lazily and cached on a table (`packages/querybuilder/src/internal/table.ts:530-588`).

### 3.5 Nullability: strong downstream reasoning, weak declaration source of truth

Declaration nullability is an explicit column flag, copied into expression state (`packages/querybuilder/src/internal/column-state.ts:128-152`, `packages/querybuilder/src/internal/column-state.ts:290-320`). effect-qb does **not** inspect the encoded Schema AST to determine whether `null` is admitted. `Column.custom` even casts any supplied schema to `Schema<NonNullable<Type>>` while hard-coding `nullable: false` (`packages/querybuilder/src/standard/column.ts:55-69`). A caller can therefore construct a schema/metadata disagreement at that escape hatch.

BSL has the stronger declaration model: nullability is deliberately absent from SQL metadata and derives from the encoded AST (`scratchpad/bsl/Meta.ts:1-10`); the runtime classifier strips `Null`, rejects encoded `Undefined`/`Void`, and returns one `{ column, nullable }` answer (`scratchpad/bsl/derive.ts:177-218`); the Drizzle builder type applies `SetNotNull` from `EncodedOf`, not from an independent flag (`scratchpad/bsl/table.ts:101-123`). Keep that BSL decision.

However, effect-qb is much stronger **after joins and predicates**. Its result type uses source availability and proof facts to change nullability—left-joined sources are optional, `isNotNull` can promote a column and its source, and `coalesce` seals nullability (`packages/querybuilder/src/internal/query.ts:1788-1834`, `packages/querybuilder/src/internal/query.ts:1884-1923`). Tests cover two chained left joins and promotion of upstream sources from a deepest-source predicate (`test/public/types/nullability-types.ts:85-141`). This is query-engine work, not column derivation, and Drizzle should own the analogous behavior in BSL.

### 3.6 DDL generation

For PostgreSQL, table metadata is normalized into a `SchemaModel` with enum, table, and column models (`packages/querybuilder/src/postgres/internal/schema-model.ts:12-49`). `toTableModel` resolves physical casing and emits DDL type, nullability, defaults, generated expressions, identity, and normalized constraints from the column/table metadata (`packages/querybuilder/src/postgres/internal/schema-model.ts:270-320`). The companion database package renders identity/generated/default/not-null clauses and PK/unique/FK/check constraints (`packages/database/src/internal/postgres-schema-sql.ts:132-162`).

This is not a Drizzle table projection. effect-qb owns its DDL model and renderers; BSL instead maps each field to exact Drizzle RC builder classes/brands and calls the real `pgTable` (`scratchpad/bsl/table.ts:1-19`, `scratchpad/bsl/table.ts:71-135`, `scratchpad/bsl/table.ts:216-228`). BSL thereby inherits Drizzle's query/migration ecosystem but is also coupled to its internal builder brands.

### 3.7 Primary keys, unique constraints, indexes, defaults

Inline column flags are normalized to table options. An inline PK, unique, reference, or index becomes a common `TableOptionSpec`; references stay lazy so cyclic table declarations can resolve after construction (`packages/querybuilder/src/internal/table-options.ts:317-380`). Table-level callback options accept bound columns, which makes keys typo-resistant and keeps physical naming/casing available (`packages/querybuilder/src/internal/table.ts:1184-1281`). PostgreSQL then decorates portable options with names, deferrability, `NULLS NOT DISTINCT`, unique-index status, access method, includes, predicates, and key options through additional pipe transforms (`packages/querybuilder/src/postgres/table.ts:87-180`).

Conflict targets are also inferred from unconditional PK/unique constraints and unique indexes, then checked before `onConflict`/`upsert` is allowed (`packages/querybuilder/src/internal/table.ts:470-501`; `README.md:523-571`). That is useful future material if BSL ever generates repository/upsert helpers from model metadata.

### 3.8 Foreign keys and relations

There are two explicit FK paths:

1. **Inline single-column**: `Column.references(() => users.id)` stores a lazy bound-column reference. The input column's entire SQL `DbType` descriptor must be bidirectionally equal to the target descriptor (`packages/querybuilder/src/internal/column.ts:49-56`, `packages/querybuilder/src/internal/column.ts:679-720`). This is stricter and more SQL-correct than comparing decoded TypeScript types.
2. **Table-level/composite**: callbacks select local and target bound columns and the type layer checks non-empty selections, known columns, and equal arity (`packages/querybuilder/src/internal/table.ts:1283-1339`, `packages/querybuilder/src/internal/table-options.ts:239-246`, `packages/querybuilder/src/internal/table-options.ts:458-476`). It does **not** pairwise compare the selected columns' DB descriptors, so the composite path is weaker than the inline path.

There is no current EntityId convention, automatic FK derivation, or relations graph/query-navigation API in the exported standard surface; foreign keys are explicitly exposed as a table option, while no relation namespace is exported (`packages/querybuilder/src/standard.ts:21-36`). BSL already detects EntityId-like schemas, avoids self-reference on a primary key, and derives target table/`id` reference metadata (`scratchpad/bsl/factory.ts:60-80`, `scratchpad/bsl/factory.ts:148-163`). BSL's next gap is emission: its own table projector explicitly says DDL FKs and `defineRelations` wiring are not implemented yet (`scratchpad/bsl/table.ts:16-19`).

### 3.9 VariantSchema status: documentation drift

Current effect-qb source is **not VariantSchema-aware**. Its variant union is literally only `"select" | "insert" | "update"`, and it constructs each result with `Schema.Struct` (`packages/querybuilder/src/internal/schema-derivation.ts:14-17`, `packages/querybuilder/src/internal/schema-derivation.ts:149-195`). No `VariantSchema` occurs in the current `packages/querybuilder/src` tree.

There is a design note claiming the v4 migration decision was to retain `effect/unstable/schema/VariantSchema`, and the note correctly inventories Model's six variants and useful helpers (`docs/effect-v4-schema-model.md:1-25`). But the note's recommendation to “keep” `schema-derivation.ts` on VariantSchema does not describe the audited implementation (`docs/effect-v4-schema-model.md:91-104`). Treat it as historical intent, not current capability.

This is a clear BSL advantage. BSL creates `select`, `insert`, `update`, `json`, `jsonCreate`, and `jsonUpdate` from one variant family and returns an actual `VariantSchema.Class` (`scratchpad/bsl/factory.ts:39-49`, `scratchpad/bsl/factory.ts:121-127`, `scratchpad/bsl/factory.ts:165-223`). effect-qb can inspire SQL metadata rules, but not BSL's model-variant architecture.

## 4. Query-building and end-to-end typing

### 4.1 Two types per scalar: runtime and database identity

The best query-level design is the refusal to equate “same TypeScript type” with “same SQL type.” `Scalar<Runtime, Db, Nullable, Dialect, Kind, Deps, GroupKey>` keeps decoded runtime type and SQL identity independent (`packages/querybuilder/src/internal/scalar.ts:173-205`). `DbType` can represent bases, JSON, arrays, ranges, multiranges, composites, domains, enums, and sets (`packages/querybuilder/src/internal/scalar.ts:43-138`). Datatype witnesses add family, runtime tag, comparison group, explicit cast targets, implicit targets, and traits (`packages/querybuilder/src/internal/datatypes/define.ts:9-34`).

Comparisons consult those database witnesses, including domain unwrapping, comparable groups, and implicit conversion rules (`packages/querybuilder/src/internal/datatypes/lookup.ts:123-174`). The DSL turns a failed check into an operator-specific type error instead of accepting any two values with a shared JS carrier (`packages/querybuilder/src/internal/standard-dsl.ts:296-320`). This prevents, for example, unrelated SQL domains that both decode to `string` from silently comparing.

### 4.2 Plans as state machines

`Query.select` recursively collects every selected expression's source dependencies and dialect (`packages/querybuilder/src/internal/query.ts:485-516`). Its initial plan records those dependencies as both required and outstanding (`packages/querybuilder/src/internal/standard-dsl.ts:5876-5892`). `from`, joins, `where`, grouping, returning, mutation operations, and set operations each transform the plan's phantom state. For example, `where` updates requirements, dialect, assumptions, and facts (`packages/querybuilder/src/internal/standard-dsl.ts:5950-5969`), while joins add a source with required/optional mode plus a presence formula and merge dependency/capability/fact state (`packages/querybuilder/src/internal/standard-dsl.ts:5999-6100`).

Before render or execute, `CompletePlan` rejects missing sources, missing insert values, or invalid grouping. `DialectCompatiblePlan` then rejects a plan whose concrete dialect cannot run on the selected renderer/executor (`packages/querybuilder/src/internal/query.ts:2165-2247`). The error carriers are intersections with readable `__effect_qb_error__` and `__effect_qb_hint__` literals, which makes failures show the reason rather than collapsing to bare `never` (`packages/querybuilder/src/internal/query.ts:2165-2196`). BSL independently uses the same excellent callsite-error pattern via `BslTypeError<Msg>` and parameter intersections (`scratchpad/bsl/Field.ts:103-130`, `scratchpad/bsl/pg.ts:21-121`). Keep it.

### 4.3 Result-row inference includes logical facts

The result type is not merely a mapped selection. It recomputes effective nullability from source presence and predicate facts, recursively maps nested selections, and refines finite literal/JSON discriminant unions (`packages/querybuilder/src/internal/query.ts:1788-1923`, `packages/querybuilder/src/internal/query.ts:2030-2118`). The final `ResultRow` combines selection, available sources, assumptions, and facts (`packages/querybuilder/src/internal/query.ts:2132-2145`).

A compact verbatim core (`packages/querybuilder/src/internal/query.ts:2081-2118`):

```ts
export type ExpressionOutput<
  Value extends Expression.Any,
  Available extends Record<string, RowSet.AnySource>,
  Assumptions extends PredicateFormula = TrueAssumptions,
  Facts extends PredicateContext = EmptyFacts
> = AstOf<Value> extends infer Ast extends ExpressionAst.Any
  ? Ast extends ExpressionAst.CaseNode<infer Branches extends readonly ExpressionAst.CaseBranchNode[], infer Else extends Expression.Any>
    ? CaseOutputOf<Branches, Else, Available, Assumptions, Facts>
    : EffectiveNullabilityOfAst<Value, Ast, Available, Assumptions, Facts> extends infer Nullability
      ? Expression.NullabilityOf<Value> extends infer BaseNullability
        ? Expression.RuntimeOf<Value> extends infer Runtime
          ? AssumptionRefinedRuntime<Ast, Runtime, Facts> extends infer RefinedRuntime
            ? Nullability extends "never"
              ? BaseNullability extends "never"
                ? RefinedRuntime
                : NonNullable<RefinedRuntime>
              : Nullability extends "always"
                ? null
                : RefinedRuntime | null
            : never
          : never
        : never
      : never
    : never

export type OutputOfSelection<
  Selection,
  Available extends Record<string, RowSet.AnySource>,
  Assumptions extends PredicateFormula = TrueAssumptions,
  Facts extends PredicateContext = EmptyFacts
> = Selection extends Expression.Any
  ? ExpressionOutput<Selection, Available, Assumptions, Facts>
  : Selection extends Record<string, any>
    ? {
        readonly [K in keyof Selection]: OutputOfSelection<Selection[K], Available, Assumptions, Facts>
      }
    : never
```

The README shows the payoff: `isNotNull(posts.title)` not only narrows `title`, it proves the left-joined `posts` row exists and makes `postId` non-null (`README.md:573-617`). It also narrows a JSON discriminated union through a path equality (`README.md:619-667`).

### 4.4 Renderer and projection typing

`RenderedQuery<Row, Dialect>` carries SQL, parameters, dialect, projection path/alias metadata, optional driver mappings, and phantom row type (`packages/querybuilder/src/internal/renderer.ts:13-33`). A custom renderer is runtime-checked so projection paths exactly match the typed selection (`packages/querybuilder/src/internal/renderer.ts:58-79`, `packages/querybuilder/src/internal/renderer.ts:107-136`). This is a useful pattern whenever a typed AST is separated from a lower-level driver: preserve enough runtime evidence to validate and reconstruct the static shape.

### 4.5 Effect services, context, and error channels

The generic driver/executor contracts preserve Effect's error and context parameters all the way through `execute`, `executeResult`, prepared handles, and streams (`packages/querybuilder/src/internal/executor.ts:48-53`, `packages/querybuilder/src/internal/executor.ts:95-137`). A built-in PostgreSQL executor uses the ambient `SqlClient.SqlClient`; a custom driver retains its own `Context` (`packages/querybuilder/src/postgres/executor.ts:217-277`). Transactions are Effect transforms over the ambient SQL transaction service rather than hidden executor state (`README.md:1368-1416`).

Decode failures have a structured `RowDecodeError` with dialect, SQL/params, projection alias/path, DB descriptor, raw/normalized values, failing stage, cause, and Schema issue (`packages/querybuilder/src/internal/executor.ts:64-85`). Cardinality policies are separate pipeable transforms from `Effect<ReadonlyArray<Row>, E, R>` to `Option`, exactly-one, or non-empty results, adding only `ResultCardinalityError` (`packages/querybuilder/src/internal/executor.ts:151-188`). This separation is exceptionally clean and matches the repository's stated boundary that the driver owns result metadata while cardinality remains composable.

One apparent soundness hole should **not** be copied: PostgreSQL's read-plan `PostgresQueryError<Plan>` narrows to `PostgresReadQueryError`, which does not include `RowDecodeError` (`packages/querybuilder/src/postgres/executor.ts:38-42`; `packages/querybuilder/src/postgres/errors/requirements.ts:29-33`). Yet the implementation explicitly preserves a `RowDecodeError` during read decoding and casts the composed effect to the advertised type (`packages/querybuilder/src/postgres/executor.ts:150-176`). A read can therefore fail with a value absent from its static error channel. The plan-capability narrowing is clever, but decode errors must remain unioned in every branch.

## 5. API ergonomics

### What is terse and elegant

The basic query reads in SQL order without builder nesting. Verbatim from the README (`README.md:10-36`):

```ts
import { Column, Function, Query, Table } from "effect-qb"
import * as Pg from "effect-qb/postgres"

const users = Table.make("users", {
  id: Column.uuid().pipe(Column.primaryKey),
  email: Column.text(),
  active: Column.boolean()
})

const activeUsers = Query.select({
  id: users.id,
  email: Pg.Function.lower(users.email)
}).pipe(
  Query.from(users),
  Query.where(Query.eq(users.active, true)),
  Query.orderBy(users.email)
)

type ActiveUser = Query.ResultRow<typeof activeUsers>
// { readonly id: string; readonly email: string }
```

The strongest ergonomic choices are:

- columns and plans are ordinary Effect-style `Pipeable` values (`packages/querybuilder/src/internal/column-state.ts:93-114`, `packages/querybuilder/src/internal/query.ts:104-114`);
- a bound table exposes columns as `users.id`, removing a separate column lookup layer (`packages/querybuilder/src/internal/table.ts:351-376`);
- table-level constraints use callbacks over the typed table instead of string arrays (`README.md:198-230`);
- a single declaration yields row types and runtime schemas (`README.md:443-521`);
- cardinality is a pipe transform on an Effect, not a proliferation of executor methods (`README.md:1558-1599`);
- PostgreSQL-specific option features decorate portable option nodes, so `Index.make(...).pipe(Pg.Index.using("btree"), Pg.Index.where(...))` stays compositional (`packages/querybuilder/src/postgres/table.ts:132-180`).

The schema-transform example is also excellent because it makes encoded/decoded behavior visible. Verbatim (`README.md:286-303`):

```ts
import * as Schema from "effect/Schema"
import { Column, Table } from "effect-qb"

const events = Table.make("events", {
  id: Column.uuid().pipe(Column.primaryKey),
  happenedOn: Column.date().pipe(Column.schema(Schema.DateFromString)),
  payload: Column.json(Schema.Struct({
    visits: Schema.Number
  }))
})

type EventRow = Table.SelectOf<typeof events>
// {
//   readonly id: string
//   readonly happenedOn: Date          // decoded by Schema.DateFromString
//   readonly payload: { readonly visits: number }
// }
```

The type tests show errors at the operation that violates the state, not at final table use. Verbatim excerpt (`test/internal/types/table-types.ts:457-472`):

```ts
// @ts-expect-error nullable columns cannot become primary keys
const badNullablePrimaryKey = Std.Column.text().pipe(Std.Column.nullable, Std.Column.primaryKey)

// @ts-expect-error primary keys cannot become nullable
const badPrimaryKeyNullable = Std.Column.text().pipe(Std.Column.primaryKey, Std.Column.nullable)

const badGeneratedDefault = Std.Column.text().pipe(
  Std.Column.generated(Q.literal("generated")),
  // @ts-expect-error generated and default are mutually exclusive
  Std.Column.default(Q.literal("default"))
)

const badReferenceType = Std.Table.make("bad_reference", {
  // @ts-expect-error references require compatible base select types
  userId: Std.Column.int().pipe(Std.Column.references(() => orgs.id))
})
```

### What feels clunky or risky

1. **The authoring direction is backwards for a domain-schema-first system.** `Column.varchar(320)` creates a Schema rather than decorating an existing domain field (`packages/querybuilder/src/standard/column.ts:48-84`). BSL's `S.NonEmptyString.pipe(pg.varchar(320), pg.unique())` preserves the domain declaration as the source (`scratchpad/bsl/pg.ts:1-10`, `scratchpad/bsl/pg.ts:28-33`).
2. **Nullability is duplicated state.** A boolean and a schema can disagree through `custom`, whereas BSL derives nullability from the encoded AST (`packages/querybuilder/src/standard/column.ts:55-69`; `scratchpad/bsl/Meta.ts:1-10`).
3. **Schema and metadata constructors are duplicated across standard/Postgres/MySQL/SQLite modules.** The standard and PostgreSQL primitive factories are near copies (`packages/querybuilder/src/standard/column.ts:22-34`, `packages/querybuilder/src/postgres/column.ts:25-37`). BSL's discriminated `PgColumn.Spec` plus one exhaustive type mapping and one runtime dispatch is smaller and compiler-checked (`scratchpad/bsl/PgColumn.ts:1-12`, `scratchpad/bsl/PgColumn.ts:67-105`; `scratchpad/bsl/table.ts:71-135`, `scratchpad/bsl/table.ts:161-196`).
4. **The query phantom state is intimidating.** Thirteen generic axes and large repeated transform signatures produce remarkable guarantees but raise maintenance and compiler costs (`packages/querybuilder/src/internal/query.ts:2354-2388`, `packages/querybuilder/src/internal/standard-dsl.ts:5950-6100`). It is unjustified duplication if Drizzle remains BSL's query layer.
5. **Runtime/type state is maintained through many assertions.** `makeColumnDefinition` mirrors values into multiple symbol-keyed records (`packages/querybuilder/src/internal/column-state.ts:249-321`), and current schema derivation ends in a broad assertion after dynamically constructing a Struct (`packages/querybuilder/src/internal/schema-derivation.ts:175-195`). BSL deliberately centralizes its generic loss at a small number of audited seams (`scratchpad/bsl/Field.ts:56-76`, `scratchpad/bsl/table.ts:216-228`).
6. **Variant support is too narrow for domain/API models.** Only three DB variants are generated, with no JSON family (`packages/querybuilder/src/internal/schema-derivation.ts:14-17`, `packages/querybuilder/src/internal/schema-derivation.ts:230-255`).
7. **The table-class API looks model-like without being a model.** It creates static query metadata, not row instances/codecs (`packages/querybuilder/src/internal/table.ts:1062-1161`). BSL should keep the stronger semantic meaning of its class.
8. **The read error-channel narrowing currently drops decode errors.** See the executor mismatch above (`packages/querybuilder/src/postgres/executor.ts:38-42`, `packages/querybuilder/src/postgres/executor.ts:150-176`).

One subtle point cuts both ways: effect-qb's `varchar(n)` injects a max-length Schema check as it creates the SQL type (`packages/querybuilder/src/standard/column.ts:48-53`, `packages/querybuilder/src/standard/column.ts:73-84`). BSL's current `pg.varchar(n)` proves only that the encoded carrier is `string` and records `n`; it does not prove or add a maximum-length refinement (`scratchpad/bsl/pg.ts:28-33`). If BSL's promise is that schema and DDL constraints cannot disagree, it should add a construction-time AST/refinement check or deliberately evolve the schema with `maxLength(n)`.

## 6. Ranked direct steal-list for BSL

### 1. Add a structural SQL type witness beside the Drizzle builder spec

Port the idea behind `DbType.Base` plus datatype family/compare/cast metadata (`packages/querybuilder/src/internal/scalar.ts:43-138`, `packages/querybuilder/src/internal/datatypes/define.ts:9-34`). BSL's `PgColumn.Spec` currently knows builder family and carrier, which is enough for table projection (`scratchpad/bsl/PgColumn.ts:67-105`), but a separate database identity would let FK validation, typed defaults/checks, repository filters, and future operators distinguish `uuid`, `text`, domains, enums, and JSON even when their TypeScript carriers coincide.

**Why #1:** this is the foundation for several other invariants and is orthogonal to Drizzle. Keep it small and PostgreSQL-only initially.

### 2. Make defaults/generated expressions typed, never arbitrary strings

Port `DdlExpression = Expression.Any | SchemaExpression.Any` and its compatibility gate (`packages/querybuilder/src/internal/column-state.ts:19-29`, `packages/querybuilder/src/internal/column.ts:180-196`, `packages/querybuilder/src/internal/column.ts:556-581`). Replace or quarantine BSL's `defaultSql(string)`/`sql.raw` path (`scratchpad/bsl/pg.ts:153-159`, `scratchpad/bsl/table.ts:198-213`). A minimal BSL version can accept a branded SQL expression parameterized by carrier and dialect without importing effect-qb's query AST.

**Why #2:** it closes an injection/typo seam and lets the type system reject a timestamp default on an integer column.

### 3. Validate foreign keys by SQL identity, not merely encoded carrier

Port the bidirectional descriptor equality used by inline references (`packages/querybuilder/src/internal/column.ts:49-56`, `packages/querybuilder/src/internal/column.ts:679-720`). BSL's EntityId derivation is more ergonomic, but it currently records a `Meta.References` target without a target-column SQL witness (`scratchpad/bsl/Meta.ts:14-23`, `scratchpad/bsl/factory.ts:148-163`). Resolve the target model/field during relation assembly and prove source/target specs compatible.

**Why #3:** `string` is not enough to prove `uuid` can reference `text`, nor that two named domains are interchangeable.

### 4. Preserve the decoded / encoded / normalized-driver distinction explicitly

Port the conceptual split in `Scalar.State` and the runtime boundary (`packages/querybuilder/src/internal/scalar.ts:154-179`, `packages/querybuilder/src/internal/runtime/driver-value-mapping.ts:149-195`, `packages/querybuilder/src/internal/executor.ts:386-471`). BSL already correctly projects `EncodedOf` into Drizzle (`scratchpad/bsl/Field.ts:79-97`, `scratchpad/bsl/table.ts:110-123`); document and type the third driver layer before repositories introduce transforms such as Date/string, BigInt/string, JSON text, or custom domains.

**Why #4:** it prevents a future repository from passing decoded domain values directly to a driver that expects encoded carriers.

### 5. Port the state-transition truth table for default/generated/identity

Adopt effect-qb's precise distinctions: defaulted means insert-optional; generated means omitted from insert/update; identity-by-default is defaulted; identity-always is generated (`packages/querybuilder/src/internal/column.ts:141-178`, `packages/querybuilder/src/internal/column.ts:649-677`; `packages/querybuilder/src/internal/schema-derivation.ts:19-36`). BSL currently gives both identity modes `hasDefault: true` (`scratchpad/bsl/pg.ts:139-151`) and delegates variant inclusion primarily to the wrapped Variant field. Add explicit, variant-aware invariants so SQL generation policy and the model variants cannot drift.

**Why #5:** the distinction affects both Drizzle insert inference and Effect `insert`/`update` variants.

### 6. Add typed table-level option nodes for composite constraints and indexes

Port the callback-over-bound-columns ergonomics and staged dialect decorators (`packages/querybuilder/src/internal/table.ts:1184-1339`, `packages/querybuilder/src/postgres/table.ts:87-180`). This is a better extension point than squeezing composite PK/unique/index/check state into per-field metadata.

**Why #6:** BSL round one supports one PK and inline unique only; composite constraints and functional/partial indexes are inherently table-level (`scratchpad/bsl/factory.ts:89-104`, `scratchpad/bsl/table.ts:16-19`).

### 7. Add typed conflict-arbiter metadata if BSL generates repositories

Port the normalization of PK/unique/unconditional-unique-index metadata into conflict arbiters (`packages/querybuilder/src/internal/table.ts:139-192`, `packages/querybuilder/src/internal/table.ts:470-501`). Use it to constrain generated upsert APIs rather than accepting any field name.

**Why #7:** it converts schema metadata into a valuable application-facing guarantee without taking over query construction.

### 8. Preserve bound-field provenance where Drizzle loses domain identity

Port the lightweight table/field/base-table provenance and optional ``table.column`` brand (`packages/querybuilder/src/internal/column-state.ts:155-199`, `packages/querybuilder/src/internal/column-state.ts:504-537`). BSL can attach this to relation descriptors or repository field witnesses rather than rebuilding effect-qb's scalar AST.

**Why #8:** it improves join/FK diagnostics and prevents accidental interchange of multiple numeric EntityIds while keeping SQL aliases separate from physical tables.

### 9. Keep readable type-error carriers and expand their coverage

Both projects use the right technique: parameter intersections with a branded literal diagnostic (`packages/querybuilder/src/internal/query.ts:2165-2196`; `scratchpad/bsl/Field.ts:103-130`). Extend BSL's existing carrier to cross-field/table checks: FK mismatch, generated/default conflict, duplicate physical column name, identity/default contradictions, and unsupported composite rules.

**Why #9:** it makes advanced types usable; `never` alone is not an API.

### 10. Adopt effect-qb's negative-test matrix discipline

Mirror the pairing of runtime behavior tests and `@ts-expect-error` fixtures. Representative effect-qb tests verify state-transition and FK failures exactly at the offending call (`test/internal/types/table-types.ts:457-527`), while CI runs unit coverage, native type tests, packed Node smoke tests, and live integration (`.github/workflows/ci.yml:35-47`, `.github/workflows/ci.yml:77-84`, `.github/workflows/ci.yml:86-116`).

**Why #10:** BSL's value proposition is compile-time rejection; those failures are product behavior and need first-class regression tests.

### 11. Align `varchar(n)`'s runtime schema with its DDL constraint

Steal the effect-qb behavior that couples `varchar(n)` to a max-length Schema check (`packages/querybuilder/src/standard/column.ts:48-53`, `packages/querybuilder/src/standard/column.ts:73-84`). In BSL, either evolve each selected variant appropriately or reject a declaration whose encoded Schema lacks a compatible maximum.

**Why #11:** lower priority only because robustly inspecting arbitrary v4 refinements may be difficult; conceptually it is an important schema/DDL invariant.

### 12. Use rich row-decode errors in generated repository boundaries

If BSL repositories decode rows themselves, port the error payload shape: path/alias, DB type, raw and normalized values, stage, and Schema issue (`packages/querybuilder/src/internal/executor.ts:64-85`). Ensure the error stays in every Effect error branch; do not copy the PostgreSQL read-channel omission (`packages/querybuilder/src/postgres/executor.ts:38-42`, `packages/querybuilder/src/postgres/executor.ts:150-176`).

## 7. Not relevant / do not port

1. **The full `QueryPlan` state machine.** It solves source completeness, grouping, dialect composition, statement capabilities, joins, mutation state, predicate facts, and result refinement (`packages/querybuilder/src/internal/query.ts:121-142`, `packages/querybuilder/src/internal/query.ts:2354-2388`). Drizzle is already BSL's query engine; duplicating this creates two authorities.
2. **The renderer/projection engine.** It is excellent for an own-builder but redundant when BSL produces real Drizzle tables (`packages/querybuilder/src/internal/renderer.ts:13-47`; `scratchpad/bsl/table.ts:216-228`).
3. **The multi-dialect portable facade, for now.** effect-qb invests heavily in standard-vs-concrete dialect merging (`packages/querybuilder/src/internal/query.ts:144-173`). BSL's experiment explicitly targets Drizzle PostgreSQL builders, so portability would dilute the schema/metadata proof.
4. **Manual select/insert/update `Schema.Struct` derivation.** It is strictly less expressive than BSL's six VariantSchema variants (`packages/querybuilder/src/internal/schema-derivation.ts:149-195`; `scratchpad/bsl/factory.ts:39-49`).
5. **Explicit nullable metadata.** Keep BSL's encoded-AST source of truth (`packages/querybuilder/src/internal/column-state.ts:51-91`; `scratchpad/bsl/Meta.ts:1-10`).
6. **SQL-first primitive column factories.** Their ergonomics make sense for a query builder, not a domain-model-first DSL (`packages/querybuilder/src/standard/column.ts:71-129`).
7. **effect-qb's static `Table.Class`.** It resembles `Schema.Class` only syntactically and does not replace BSL's actual `VariantSchema.Class` model (`packages/querybuilder/src/internal/table.ts:1062-1161`; `scratchpad/bsl/factory.ts:121-127`).
8. **The `effect-db` migration/introspection CLI.** It is explicitly a companion package and BSL should obtain migration support through the Drizzle table it derives (`README.md:1914-1922`; `scratchpad/bsl/table.ts:1-9`).
9. **Generated vendor SQLSTATE catalog machinery.** Query-capability-specific driver errors are outside BSL's schema/table experiment. If needed later, consume them at a repository/driver layer, not in `Field` metadata (`packages/querybuilder/src/postgres/errors/requirements.ts:11-33`).
10. **The current composite-FK check as-is.** It validates arity and names but not per-position SQL identity (`packages/querybuilder/src/internal/table.ts:1283-1339`, `packages/querybuilder/src/internal/table-options.ts:458-476`). BSL should combine its callback ergonomics with the stricter inline descriptor equality.

## 8. Honest overlap analysis

| Concern | effect-qb | BSL | Assessment |
|---|---|---|---|
| Primary abstraction | SQL-first `ColumnDefinition` that is also a scalar expression (`packages/querybuilder/src/internal/column-state.ts:93-153`) | Schema-first `Field<Schema, Meta>` wrapper (`scratchpad/bsl/Field.ts:1-27`) | BSL's orientation is correct for domain models; effect-qb's is correct for an own query builder. |
| Metadata visibility | Symbol-keyed phantom `ColumnState` plus runtime `.metadata` (`packages/querybuilder/src/internal/column-state.ts:51-91`, `packages/querybuilder/src/internal/column-state.ts:115-152`) | Literal-preserving generic `Meta` because v4 annotations are not type-visible (`scratchpad/bsl/Field.ts:1-9`, `scratchpad/bsl/Meta.ts:28-41`) | Wrapper metadata is more direct for BSL. Do not move it to annotations. |
| Column derivation | Constructors choose Schema and SQL type; arbitrary Schema needs explicit SQL witness (`packages/querybuilder/src/standard/column.ts:55-129`) | Conservative type/runtime derivation from encoded Schema, with explicit metadata winning (`scratchpad/bsl/derive.ts:67-107`, `scratchpad/bsl/derive.ts:177-218`) | BSL has the real schema-to-SQL story. effect-qb has stronger SQL type witnesses. Combine those strengths. |
| Encoded/decoded transforms | `.schema(codec)` checks old carrier against codec Encoded and changes result to codec Type (`packages/querybuilder/src/internal/column.ts:257-286`, `packages/querybuilder/src/internal/column.ts:475-482`) | `EncodedOf` comes directly from plain or select-variant schema and drives Drizzle `$type` (`scratchpad/bsl/Field.ts:79-97`, `scratchpad/bsl/table.ts:110-123`) | Same fundamental distinction. effect-qb additionally specifies driver normalization and decoding. |
| Nullability declaration | Explicit flag, re-applied around the schema (`packages/querybuilder/src/internal/column.ts:58-71`, `packages/querybuilder/src/internal/schema-derivation.ts:113-146`) | Derived from encoded AST; absent from `Meta` (`scratchpad/bsl/Meta.ts:1-10`, `scratchpad/bsl/derive.ts:177-227`) | BSL wins: one source of truth. |
| Nullability in query results | Three-state lattice plus join presence/predicate implications (`packages/querybuilder/src/internal/scalar.ts:24-32`, `packages/querybuilder/src/internal/query.ts:1788-1923`) | Delegated to Drizzle; BSL only projects table nullability (`scratchpad/bsl/table.ts:101-123`) | Do not duplicate it unless Drizzle demonstrably fails a required case. |
| SQL type compatibility | Rich database descriptors, families, comparison/cast matrices (`packages/querybuilder/src/internal/scalar.ts:43-138`, `packages/querybuilder/src/internal/datatypes/lookup.ts:123-174`) | Column spec maps to a carrier and exact Drizzle builder (`scratchpad/bsl/PgColumn.ts:67-105`, `scratchpad/bsl/table.ts:71-123`) | effect-qb has the stronger semantic layer; this is the best concept to port. |
| Select/insert/update | Flag-derived mapped types plus three manual runtime Structs (`packages/querybuilder/src/internal/schema-derivation.ts:19-36`, `packages/querybuilder/src/internal/schema-derivation.ts:76-147`) | VariantSchema owns six database/JSON variants (`scratchpad/bsl/factory.ts:39-49`, `scratchpad/bsl/factory.ts:121-127`) | BSL is more expressive. Port flag semantics into variant helpers, not the manual derivation implementation. |
| Table output | effect-qb's own table/row-set/DDL model (`packages/querybuilder/src/internal/table.ts:351-376`, `packages/querybuilder/src/postgres/internal/schema-model.ts:270-320`) | Exact Drizzle RC `PgTableWithColumns` (`scratchpad/bsl/table.ts:71-135`, `scratchpad/bsl/table.ts:216-228`) | Fundamental non-overlap after metadata resolution. Retain Drizzle delegation. |
| PK/default/generated state | Explicit, mutually-constrained transitions; by-default vs always identity differ (`packages/querybuilder/src/internal/column.ts:511-581`, `packages/querybuilder/src/internal/column.ts:649-677`) | Parameter-constrained PK/identity; defaults are raw SQL and identity modes both set `hasDefault` (`scratchpad/bsl/pg.ts:127-159`) | Port the finer state truth table and typed default expressions. |
| Foreign keys | Explicit lazy bound-column references; inline path checks exact DB descriptors (`packages/querybuilder/src/internal/column.ts:49-56`, `packages/querybuilder/src/internal/column.ts:679-720`) | Explicit or EntityId-derived metadata; DDL/relations emission pending (`scratchpad/bsl/factory.ts:63-80`, `scratchpad/bsl/table.ts:16-19`) | BSL wins on convention/ergonomics; effect-qb wins on target-type proof and current DDL emission. |
| Relations | No relation graph in the exported querybuilder surface (`packages/querybuilder/src/standard.ts:21-36`) | Intended EntityId-driven `defineRelations`, not yet implemented (`scratchpad/bsl/table.ts:16-19`) | effect-qb offers no implementation to steal. |
| Query typing | First-party AST and plan state; typed comparisons, joins, grouping, mutations, facts (`packages/querybuilder/src/internal/query.ts:121-142`, `packages/querybuilder/src/internal/standard-dsl.ts:5950-6100`) | Drizzle owns query typing | Different layer. Treat effect-qb as a test oracle/idea mine, not a dependency blueprint. |
| Effect services/errors | Executors preserve `Effect<A,E,R>`, use ambient `SqlClient`, decode rows (`packages/querybuilder/src/internal/executor.ts:95-137`, `packages/querybuilder/src/postgres/executor.ts:217-277`) | Current experiment stops at model/table derivation (`scratchpad/bsl/table.ts:1-19`) | Relevant later at repository assembly, not inside the field/table DSL. |

## 9. Recommended BSL direction after this mining pass

Keep BSL's architecture: `VariantSchema` domain model → pipeable `Field<Schema, Meta>` → encoded-AST nullability/column derivation → exact Drizzle PostgreSQL table. effect-qb does not offer a better replacement for any of those four choices (`scratchpad/bsl/Field.ts:1-9`, `scratchpad/bsl/derive.ts:177-227`, `scratchpad/bsl/factory.ts:39-49`, `scratchpad/bsl/table.ts:216-228`).

Strengthen that architecture in this order:

1. enrich BSL metadata with a small PostgreSQL DB-identity witness distinct from the Drizzle builder spec;
2. replace raw default SQL with typed DDL expressions and model generated/default/identity states precisely;
3. implement FK emission/relations with lazy target resolution and descriptor equality;
4. add table-level composite constraint/index nodes;
5. validate SQL parameter constraints such as `varchar(n)` against the runtime Schema, not just its broad encoded carrier;
6. keep execution, join nullability, query ASTs, dialect matrices, and migration infrastructure delegated to Drizzle/Effect SQL unless a concrete gap appears.

The key synthesis is: **BSL should remain schema-first and Drizzle-backed, while borrowing effect-qb's SQL semantic witnesses and state-transition rigor.** Port the invariants, not the engine.
