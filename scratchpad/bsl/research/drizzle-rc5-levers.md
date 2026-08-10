# drizzle-orm rc5 levers for programmatic, fully typed table derivation

## Checkout audited

- Branch: `rc5` (tracking `origin/rc5`).
- Commit: `a1f16f0b911888c908283e5d9786a6ff26be0fdf` (`a1f16f0b9`, 2026-08-08, `Typo fix`).
- Package: `drizzle-orm` version `1.0.0-rc.5` (`drizzle-orm/package.json:1-5`).
- The checkout already had an unrelated untracked `.idea/`; it was not touched.

Two requested names are not current rc5 names. A repository-wide search under `drizzle-orm/src` finds no `ColumnBuilderTypeConfig` and no `CasingCache`. The relevant rc5 types are `ColumnBuilderBaseConfig` for the common/MySQL/SQLite path and `PgColumnBuilderConfig` for PostgreSQL. Casing is applied while tables/views are constructed by `getCasingFn`, not cached in a dialect-level `CasingCache`.

**Bottom line:** a generic factory can produce a table whose public type is as precise as a hand-written `pgTable(...)`, but only if the factory preserves (1) the literal table name, (2) literal property keys, and (3) each property's concrete fluent-builder type. A value already widened to `Record<string, ColumnBuilderBase>` or `Record<string, AnyPgColumnBuilder>` has permanently lost (2) and (3). The record type should be a *generic constraint*, never the type annotation of the finished builder map.

**DSL use:** Treat this exact commit as the contract. In particular, use the PostgreSQL-specific rc5 machinery rather than copying 0.x/common-column helper names.

## 1. Column-builder type machinery

### 1.1 Common builder path (MySQL and SQLite)

The common type payload is deliberately small:

```ts
export interface ColumnBuilderBaseConfig<TDataType extends ColumnType> {
  dataType: TDataType;
  data: unknown;
  driverParam: unknown;
  notNull?: boolean;
  hasDefault?: boolean;
}

export interface ColumnBuilderBase<
  out T extends ColumnBuilderBaseConfig<ColumnType> = ColumnBuilderBaseConfig<ColumnType>,
> { _: T }
```

Source: `drizzle-orm/src/column-builder.ts:144-150`, `drizzle-orm/src/column-builder.ts:252-256`.

The fluent calls do not construct a new object. They mutate runtime `config` and return the same object cast to an intersection whose nested `_` payload overrides a flag:

```ts
type NotNull<T> = T & { _: { notNull: true } };
type HasDefault<T> = T & { _: { hasDefault: true } };
type IsPrimaryKey<T> = T & { _: { isPrimaryKey: true; notNull: true } };
type IsAutoincrement<T> = T & { _: { isAutoincrement: true } };
type HasRuntimeDefault<T> = T & { _: { hasRuntimeDefault: true } };
type $Type<T, U> = T & { _: { $type: U } };
type HasGenerated<T, G = {}> = T & { _: { hasDefault: true; generated: G } };
type IsIdentity<T, K extends 'always' | 'byDefault'> =
  T & { _: { notNull: true; hasDefault: true; identity: K } };
```

Source: `drizzle-orm/src/column-builder.ts:200-250`.

The exact fluent rewrites are:

| Call | Return type rewrite | Runtime mutation | Model consequence |
|---|---|---|---|
| `.$type<T>()` | `$Type<this, T>` | none | `MakeColumnConfig` substitutes `$type` for `data` |
| `.notNull()` | `NotNull<this>` | `notNull = true` | select drops `null`; may make insert required |
| `.default(v)` | `HasDefault<this>` | sets `default`, `hasDefault = true` | insert key becomes optional |
| `.$defaultFn(fn)` / `.$default` | `HasRuntimeDefault<HasDefault<this>>` | sets `defaultFn`, `hasDefault = true` | insert optional; runtime-only default |
| `.$onUpdateFn(fn)` / `.$onUpdate` | `HasDefault<this>` | sets `onUpdateFn`, `hasDefault = true` | insert optional even without a SQL default |
| `.primaryKey()` | normally `IsPrimaryKey<this>`; if `primaryKeyHasDefault`, `IsPrimaryKey<HasDefault<this>>` | `primaryKey = true`, `notNull = true` | non-null; SQLite integer PK also insert-optional |
| `.generatedAlwaysAs(...)` | dialect override returning `HasGenerated<this, { type: 'always' }>` | dialect stores generated expression/mode | generated column excluded from insert |

Source: `drizzle-orm/src/column-builder.ts:288-384`. The comments explicitly say `$defaultFn` and `$onUpdateFn` do not affect drizzle-kit (`drizzle-orm/src/column-builder.ts:326-350`). MySQL generated columns choose `virtual | stored` and return `HasGenerated` (`drizzle-orm/src/mysql-core/columns/common.ts:31-33`, `drizzle-orm/src/mysql-core/columns/common.ts:57-66`); SQLite does the same (`drizzle-orm/src/sqlite-core/columns/common.ts:28-30`, `drizzle-orm/src/sqlite-core/columns/common.ts:57-66`).

SQLite integer specializes primary keys:

```ts
override primaryKey(config?: {
  autoIncrement?: boolean;
  onConflict?: OnConflict;
}): IsPrimaryKey<HasDefault<NotNull<this>>>
```

It sets `hasDefault = true` whether or not `autoIncrement` is requested (`drizzle-orm/src/sqlite-core/columns/integer.ts:10-36`). MySQL numeric builders add `.autoincrement(): IsAutoincrement<HasDefault<this>>` (`drizzle-orm/src/mysql-core/columns/common.ts:117-137`).

The common finish step is `MakeColumnConfig`: it resolves booleans to exact `true | false`, substitutes `$type`, carries enum values, builds a base column recursively, and carries identity/generated state (`drizzle-orm/src/column-builder.ts:152-176`). `BuildColumns` then maps each *existing key* independently:

```ts
export type BuildColumns<
  TTableName extends string,
  TConfigMap extends Record<string, ColumnBuilderBase>,
  TDialect extends Dialect,
> = {
  [K in keyof TConfigMap]: BuildColumn<TTableName, TConfigMap[K], TDialect>;
};
```

Source: `drizzle-orm/src/column-builder.ts:393-406`, `drizzle-orm/src/column-builder.ts:421-443`.

**DSL use:** For MySQL/SQLite, make the metadata-to-builder mapper return a key-preserving mapped type whose values are the actual results of the fluent calls. The common `ColumnBuilderBase` should be only a constraint.

### 1.2 PostgreSQL's rc5-specific builder path

PostgreSQL no longer uses `ColumnBuilder`/`MakeColumnConfig` to build tables. Its payload is:

```ts
export interface PgColumnBuilderConfig {
  dataType: ColumnType;
  data: unknown;
  driverParam: unknown;
  notNull?: boolean;
  hasDefault?: boolean;
  isPrimaryKey?: boolean;
  isAutoincrement?: boolean;
  hasRuntimeDefault?: boolean;
  enumValues?: string[];
  identity?: 'always' | 'byDefault';
  generated?: unknown;
  dimensions?: 0 | 1 | 2 | 3 | 4 | 5;
  $type?: unknown;
}

export interface AnyPgColumnBuilder {
  readonly _: PgColumnBuilderConfig;
}
```

Source: `drizzle-orm/src/pg-core/columns/common.ts:13-38`, `drizzle-orm/src/pg-core/columns/common.ts:126-128`.

Its rewrite helpers are the analogous `SetNotNull`, `SetHasDefault`, `SetIsPrimaryKey`, `SetHasRuntimeDefault`, `Set$Type`, `SetHasGenerated`, `SetDimensions`, and `SetIdentity` intersections (`drizzle-orm/src/pg-core/columns/common.ts:83-100`). The exact fluent methods are at `drizzle-orm/src/pg-core/columns/common.ts:199-372`:

- `$type<T>() -> Set$Type<this, T>`.
- `notNull() -> SetNotNull<this>`.
- `default(...) -> SetHasDefault<this>`.
- `$defaultFn(...) -> SetHasRuntimeDefault<this>`; this helper itself brands both runtime-default and default.
- `$onUpdateFn(...) -> SetHasDefault<this>`.
- `primaryKey() -> SetIsPrimaryKey<this>`.
- `generatedAlwaysAs(SQL | () => SQL) -> SetHasGenerated<this>` and fixes PG mode to `stored`.
- `array()` gives dimension `1`; `array<'[][]'>()` etc. gives dimensions `1..5` (`drizzle-orm/src/pg-core/columns/common.ts:316-341`).
- `references(...)` and `unique(...)` return `this`, so they deliberately do not change model types (`drizzle-orm/src/pg-core/columns/common.ts:343-359`).

`ResolvePgColumnConfig` is the finished type projection:

```ts
type ResolvePgColumnConfig<T extends PgColumnBuilderConfig, TTableName extends string> = {
  name: string;
  tableName: TTableName;
  dataType: T['dataType'];
  data: T['dimensions'] extends 1|2|3|4|5
    ? WrapArray<GetBaseData<T>, T['dimensions']>
    : GetBaseData<T>;
  driverParam: /* dimension-wrapped when array */;
  notNull: T['notNull'] extends true ? true : false;
  hasDefault: T['hasDefault'] extends true ? true : false;
  isPrimaryKey: false;
  isAutoincrement: false;
  hasRuntimeDefault: false;
  enumValues: /* tuple if present */;
  identity: /* always | byDefault | undefined */;
  generated: T['generated'] extends true ? true : undefined;
};
```

Source: `drizzle-orm/src/pg-core/columns/common.ts:102-124`. `PgBuildColumns` preserves keys and applies that projection per entry (`drizzle-orm/src/pg-core/columns/common.ts:130-154`).

Important rc5 detail: the PostgreSQL built-column type intentionally/historically hard-codes `isPrimaryKey`, `isAutoincrement`, and `hasRuntimeDefault` to `false`, even though the builder brands and runtime object may hold those facts. Model inference does not use those three fields; it uses `notNull`, `hasDefault`, `generated`, and `identity`. Do not predicate DSL model types on built PG `isPrimaryKey`.

### 1.3 Identity, serial, generated, and `$type`

Only PG integer-family builders expose identity methods:

```ts
generatedAlwaysAsIdentity(
  sequence?: PgSequenceOptions & { name?: string },
): HasIdentity<this, 'always'>

generatedByDefaultAsIdentity(
  sequence?: PgSequenceOptions & { name?: string },
): HasIdentity<this, 'byDefault'>
```

Both set runtime `hasDefault` and `notNull`; the type carries identity kind (`drizzle-orm/src/pg-core/columns/int.common.ts:7-59`). `serial`/`smallserial` start with `notNull: true; hasDefault: true` in their builder payloads (`drizzle-orm/src/pg-core/columns/serial.ts:5-19`, `drizzle-orm/src/pg-core/columns/smallserial.ts:5-18`); `bigserial` has `number | bigint` modes with the same brands (`drizzle-orm/src/pg-core/columns/bigserial.ts:6-19`, `drizzle-orm/src/pg-core/columns/bigserial.ts:41-54`, `drizzle-orm/src/pg-core/columns/bigserial.ts:76-92`).

`$type<T>()` is a type-only override. Common `MakeColumnConfig` chooses `$type` at `drizzle-orm/src/column-builder.ts:152-164`; PG `GetBaseData`/`ResolvePgColumnConfig` does so at `drizzle-orm/src/pg-core/columns/common.ts:102-115`. It does not change SQL type, driver mapping, or drizzle-kit output.

There is a runtime/type nuance for PG generated columns: `SetHasGenerated` brands `hasDefault: true` (`drizzle-orm/src/pg-core/columns/common.ts:90-92`), but `generatedAlwaysAs` only sets runtime `config.generated` (`drizzle-orm/src/pg-core/columns/common.ts:361-371`). Insert inference still excludes the generated key because `OptionalKeyOnly` rejects any defined `generated` field, while kit reads the runtime generated expression. This divergence is observable in `toBuilder`, whose comment says generated is not a runtime `hasDefault` source (`drizzle-orm/src/pg-core/columns/common.ts:482-487`).

### 1.4 What a finished builder is

At the type boundary, PG accepts `AnyPgColumnBuilder`, while MySQL/SQLite accept `ColumnBuilderBase`. At runtime that is not enough: `pgTableWithSchema` casts each value to `PgColumnBuilder` and invokes `setName`, `build`, `postBuild`, `buildForeignKeys`, and `buildExtraConfigColumn` (`drizzle-orm/src/pg-core/table.ts:107-126`). A fake structural object with only `_` would type-check but fail at runtime.

The built column is a `PgColumn`/`MySqlColumn`/`SQLiteColumn` whose `_` contains exact `data`, `notNull`, `hasDefault`, `generated`, and identity state. `GetColumnData` adds `null` exactly when `notNull` is false (`drizzle-orm/src/column.ts:145-159`).

**DSL use:** Return real dialect builders, never synthetic `_`-only objects. For PG, constrain to `AnyPgColumnBuilder`, not the common `ColumnBuilderBase`, so a MySQL/SQLite builder cannot enter the runtime build path.

## 2. Table construction and model inference

### 2.1 Every `pgTable` overload in rc5

`PgTableFnInternal` has four call overloads, the Cartesian product of:

1. columns supplied as `TColumnsMap`, or as `(columnTypes: PgColumnsBuilders) => TColumnsMap`; and
2. extra config returning the new `PgTableExtraConfigValue[]`, or the deprecated `PgTableExtraConfig` object.

The preferred direct-map overload is trimmed to:

```ts
interface PgTableFnInternal<TSchema extends string | undefined = undefined> {
  <
    TTableName extends string,
    TColumnsMap extends Record<string, AnyPgColumnBuilder>,
  >(
    name: TTableName,
    columns: TColumnsMap,
    extraConfig?: (
      self: PgBuildExtraConfigColumns<TColumnsMap>
    ) => PgTableExtraConfigValue[],
  ): PgTableWithColumns<{
    name: TTableName;
    schema: TSchema;
    columns: PgBuildColumns<TTableName, TColumnsMap>;
    dialect: 'pg';
  }>;
  // same with columns callback
  // deprecated object-return overload for direct map
  // deprecated object-return overload for callback
}
```

Source: array overloads `drizzle-orm/src/pg-core/table.ts:149-178`; deprecated object overloads `drizzle-orm/src/pg-core/table.ts:179-251`. `PgTableFn` adds `withRLS` with the same overload set (`drizzle-orm/src/pg-core/table.ts:254-256`). `pgTable` itself is `pgTableWithCasing(undefined)` (`drizzle-orm/src/pg-core/table.ts:258-274`).

The extra-config union is exactly indexes, checks, foreign keys, primary keys, unique constraints, and PG policies (`drizzle-orm/src/pg-core/table.ts:22-30`). Array return is the rc5 direction; object return is still accepted but deprecated.

The construction path:

1. creates a `PgTable` parameterized by `PgBuildColumns`;
2. resolves the optional columns callback;
3. builds real columns and inline FKs;
4. separately builds `ExtraConfigColumn`s for index modifiers;
5. `Object.assign`s columns as direct table properties;
6. stores columns/extra columns/extra callback under symbols.

Source: `drizzle-orm/src/pg-core/table.ts:80-148`.

`BuildExtraConfigColumns` intentionally maps every key to the broad `ExtraConfigColumn`, not the original concrete data-specific column class (`drizzle-orm/src/pg-core/columns/common.ts:148-154`). Its purpose is index order/null/op-class fluency.

MySQL and SQLite have the same four overload shapes but use the common `BuildColumns`: MySQL `drizzle-orm/src/mysql-core/table.ts:123-224`; SQLite `drizzle-orm/src/sqlite-core/table.ts:64-165`.

### 2.2 `TableConfig`, table intersections, and `$infer*`

Core table type state is only:

```ts
interface TableConfig<TColumns extends Columns = Columns> {
  name: string;
  schema: string | undefined;
  columns: TColumns;
  dialect: string;
}
```

`Table._` exposes the brand/name/schema/columns/dialect (`drizzle-orm/src/table.ts:8-13`, `drizzle-orm/src/table.ts:42-53`). A PG result is the intersection:

```ts
type PgTableWithColumns<T extends TableConfig> =
  PgTable<T>
  & T['columns']
  & {
      readonly $inferSelect: InferModelFromColumns<T['columns'], 'select'>;
      readonly $inferInsert: InferModelFromColumns<T['columns'], 'insert'>;
    }
  & { enableRLS: ... };
```

Source: `drizzle-orm/src/pg-core/table.ts:64-77`. MySQL/SQLite use the equivalent `InferTableColumnsModels` intersection (`drizzle-orm/src/mysql-core/table.ts:59-62`, `drizzle-orm/src/sqlite-core/table.ts:59-62`; model members are defined at `drizzle-orm/src/table.ts:202-205`).

`InferSelectModel<T>` and `InferInsertModel<T>` are aliases over `T['_']['columns']` (`drizzle-orm/src/table.ts:183-197`). Selection maps every key and relies on `GetColumnData` for nullability. Insert splits keys:

```ts
type RequiredKeyOnly<K, C extends Column> =
  C['_']['notNull'] extends true
    ? C['_']['hasDefault'] extends false ? K : never
    : never;
```

Optional insert keys exclude generated columns and exclude `identity: 'always'` unless the override flag is true; `byDefault` identity remains optional (`drizzle-orm/src/operations.ts:7-26`). The mapped model itself is at `drizzle-orm/src/table.ts:149-181`.

### 2.3 The generic `pgTable`-wrapping factory: what preserves inference

This minimal wrapper preserves exactly what `pgTable` would infer:

```ts
import {
  pgTable,
  type AnyPgColumnBuilder,
} from 'drizzle-orm/pg-core';

export function makePgTable<
  const TName extends string,
  const TColumns extends Record<string, AnyPgColumnBuilder>,
>(name: TName, columns: TColumns) {
  return pgTable(name, columns);
}
```

The `const` modifiers help callers retain literal metadata/name information. The decisive property is that `TColumns` is inferred and *constrained* by the record; it is not annotated as the record.

Good:

```ts
const columns = {
  id: integer().generatedAlwaysAsIdentity(),
  displayName: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow(),
} satisfies Record<string, AnyPgColumnBuilder>;

const users = makePgTable('users', columns);
// keyof users._.columns = 'id' | 'displayName' | 'createdAt'
// id: number, notNull true, hasDefault true, identity 'always'
```

Bad—the annotation erases the keys and per-column configs before `pgTable` sees them:

```ts
const columns: Record<string, AnyPgColumnBuilder> = { ... };
const users = makePgTable('users', columns);
// keyof columns is string; every value has broad PgColumnBuilderConfig
```

For metadata-driven construction, the key-preserving boundary should look like:

```ts
type BuilderFor<F extends FieldMeta> =
  F extends { kind: 'text'; notNull: true } ? ReturnType<typeof requiredText>
  : F extends { kind: 'text' } ? ReturnType<typeof optionalText>
  : F extends { kind: 'integer'; identity: 'always' } ? ReturnType<typeof identityInteger>
  : /* exhaustive dialect-narrowed cases */ never;

type BuildersFor<M extends Record<string, FieldMeta>> = {
  [K in keyof M]: BuilderFor<M[K]>;
};

function buildPgColumns<const M extends Record<string, FieldMeta>>(
  metadata: M,
): BuildersFor<M> {
  // Object.keys/Object.fromEntries cannot prove this mapped correlation.
  // Keep the one necessary assertion here, after exhaustive runtime dispatch.
  return runtimeBuild(metadata) as BuildersFor<M>;
}

function derivePgTable<
  const N extends string,
  const M extends Record<string, FieldMeta>,
>(name: N, metadata: M) {
  return pgTable(name, buildPgColumns(metadata));
}
```

The assertion is not faking Drizzle's output; it restores the key/value correlation that JavaScript enumeration APIs erase. It must be backed by an exhaustive runtime dispatcher and type tests.

Inference cliffs:

- `Object.fromEntries(...)` naturally returns string-indexed data; assert to `BuildersFor<M>` at one audited boundary.
- A `BuilderA | BuilderB` union is less precise than a metadata-conditioned `BuilderFor<F>`; broad booleans such as `notNull: boolean` necessarily produce a union/broad result. Require literal metadata for exact brands.
- Reassigning `let b = text(); if (...) b = b.notNull()` commonly widens or becomes assignment-incompatible. Return each fluent chain from an explicit branch, or cast only the exhaustive mapper's final result.
- A table name already typed `string` cannot be recovered as a literal table name.
- `satisfies Record<string, AnyPgColumnBuilder>` checks without widening; `: Record<...>` widens.
- For PG use `AnyPgColumnBuilder`; for MySQL/SQLite mirror their actual overload constraint `ColumnBuilderBase`.

rc5's `PgColumn.toBuilder(overrides?)` is explicitly documented as a derivation helper and reconstructs the concrete runtime column class (`drizzle-orm/src/pg-core/columns/common.ts:456-493`, `drizzle-orm/src/pg-core/columns/common.ts:511-543`). However, its declared return is the unparameterized `PgColumnBuilder`, so it loses the original column's precise compile-time config. It is a runtime cloning lever, not by itself a fully typed generic-derivation solution.

**DSL use:** Preserve metadata as `const`, define an exhaustive `BuilderFor<Field>` conditional type, restore `Object.fromEntries` correlation once, and pass that mapped result directly to `pgTable`. Never expose the intermediate map as a broad record.

## 3. Casing and name derivation

Current casing is:

```ts
type Casing = 'snake_case' | 'camelCase';

function getCasingFn(casing: Casing | undefined) {
  if (casing === 'snake_case') return toSnakeCase;
  if (casing === 'camelCase') return toCamelCase;
  return (name: string) => name;
}
```

Source including the runtime regex transforms: `drizzle-orm/src/casing.ts:1-26`.

For an unnamed builder (`text()` rather than `text('db_name')`), `keyAsName` starts true and `setName` applies the casing function to the table property's runtime key. An explicit builder name is left untouched (`drizzle-orm/src/pg-core/columns/common.ts:179-196`, `drizzle-orm/src/pg-core/columns/common.ts:310-314`; common builder equivalent `drizzle-orm/src/column-builder.ts:271-285`, `drizzle-orm/src/column-builder.ts:386-390`). `pgTableWithSchema` invokes this before building columns (`drizzle-orm/src/pg-core/table.ts:99-126`).

Public entry points are `snakeCase.table`, `.view`, `.materializedView`, and `.schema` for PG (`drizzle-orm/src/pg-core/casing.ts:1-20`), with analogous MySQL and SQLite objects (`drizzle-orm/src/mysql-core/casing.ts:1-18`, `drizzle-orm/src/sqlite-core/casing.ts:1-12`). `pgTableCreator` and schema constructors also accept casing (`drizzle-orm/src/pg-core/table.ts:276-295`, `drizzle-orm/src/pg-core/schema.ts:84-93`). `DrizzleConfig` no longer has a `casing` option at all (`drizzle-orm/src/utils.ts:647-656`), and `PgDialectConfig` has no casing/cache field (`drizzle-orm/src/pg-core/dialect.ts:59-88`).

This affects drizzle-kit DDL, not just client SQL: kit gets the already-built runtime `column.name` from `getTableConfig` and writes it into its interim column (`drizzle-kit/src/dialects/postgres/drizzle.ts:313-340`, `drizzle-kit/src/dialects/postgres/drizzle.ts:381-401`).

There is no type-level snake-case mapping in this path. `ResolvePgColumnConfig.name` and common `MakeColumnConfig.name` are both just `string` (`drizzle-orm/src/pg-core/columns/common.ts:104-115`, `drizzle-orm/src/column-builder.ts:152-164`). Table object keys remain the original TS keys; only runtime database names are transformed. `MapColumnName` can choose a column's `_['name']`, but that type is still `string` (`drizzle-orm/src/table.ts:149-151`).

**DSL use:** Let keys remain schema-field/TS names, call the dialect's `snakeCase.table` (or a casing-enabled creator), and omit explicit DB names when standard casing is desired. If the DSL needs a compile-time snake-case string, it must implement its own type-level transform; Drizzle does not supply it here.

## 4. Full requested dialect column inventory

The authoritative builder bundles are `getPgColumnBuilders` (`drizzle-orm/src/pg-core/columns/all.ts:1-73`), `getMySqlColumnBuilders` (`drizzle-orm/src/mysql-core/columns/all.ts:1-63`), and `getSQLiteColumnBuilders` (`drizzle-orm/src/sqlite-core/columns/all.ts:1-19`). `pgEnum` is separate because it first creates a database enum factory.

### PostgreSQL

| Column kind | Dialects | Builder | Type/config parameters and TS data |
|---|---|---|---|
| small integer | PG | `smallint()` | no config; `number` |
| integer | PG | `integer()` | no config; `number`; identity methods available |
| bigint | PG | `bigint({ mode })` | `mode: 'number' | 'bigint' | 'string'` (`drizzle-orm/src/pg-core/columns/bigint.ts:91-110`) |
| serial | PG | `smallserial()`, `serial()` | `number`, built-in non-null/default (`drizzle-orm/src/pg-core/columns/smallserial.ts:5-41`, `drizzle-orm/src/pg-core/columns/serial.ts:5-39`) |
| bigserial | PG | `bigserial({ mode })` | `mode: 'number' | 'bigint'` (`drizzle-orm/src/pg-core/columns/bigserial.ts:76-92`) |
| real/double | PG | `real()`, `doublePrecision()` | `number`; no config (`drizzle-orm/src/pg-core/columns/real.ts:1-42`, `drizzle-orm/src/pg-core/columns/double-precision.ts:1-37`) |
| arbitrary numeric/decimal | PG | `numeric()` / `decimal` | `{ precision?, scale?, mode?: 'string'|'number'|'bigint' }`; config union requires a discriminating member when supplied (`drizzle-orm/src/pg-core/columns/numeric.ts:169-195`) |
| boolean | PG | `boolean()` | `boolean` (`drizzle-orm/src/pg-core/columns/boolean.ts:5-34`) |
| text | PG | `text({ enum? })` | readonly nonempty tuple narrows data to `T[number]`; otherwise `string` (`drizzle-orm/src/pg-core/columns/text.ts:6-70`) |
| varchar/char | PG | `varchar`, `char` | `{ length?: number; enum?: readonly nonempty tuple }`; tuple narrows data (`drizzle-orm/src/pg-core/columns/varchar.ts:51-71`, `drizzle-orm/src/pg-core/columns/char.ts:54-75`) |
| byte array | PG | `bytea()` | `Buffer`-style binary builder; no config (`drizzle-orm/src/pg-core/columns/bytea.ts:5-34`) |
| JSON | PG | `json()`, `jsonb()` | initial data `unknown`; specialize with `$type<T>()` (`drizzle-orm/src/pg-core/columns/json.ts:5-40`, `drizzle-orm/src/pg-core/columns/jsonb.ts:5-38`) |
| UUID | PG | `uuid()` | `string` (`drizzle-orm/src/pg-core/columns/uuid.ts:5-42`) |
| date | PG | `date({ mode? })` | `mode: 'date' | 'string'` (`drizzle-orm/src/pg-core/columns/date.ts:76-93`) |
| time | PG | `time({ precision?, withTimezone? })` | `Precision = 0..6`; data `string` (`drizzle-orm/src/pg-core/columns/time.ts:55-65`) |
| timestamp | PG | `timestamp({ mode?, precision?, withTimezone? })` | mode `date | string`, precision `0..6` (`drizzle-orm/src/pg-core/columns/timestamp.ts:116-136`) |
| interval | PG | `interval({ fields?, precision? })` | fields include single units and `year to month`, `day to second`, etc.; data `string` (`drizzle-orm/src/pg-core/columns/interval.ts:50-78`) |
| network | PG | `inet()`, `cidr()`, `macaddr()`, `macaddr8()` | string data; no config (`drizzle-orm/src/pg-core/columns/inet.ts:5-34`, `drizzle-orm/src/pg-core/columns/cidr.ts:5-34`, `drizzle-orm/src/pg-core/columns/macaddr.ts:5-34`, `drizzle-orm/src/pg-core/columns/macaddr8.ts:5-34`) |
| geometric point | PG | `point({ mode? })` | `tuple` gives `[number, number]`; `xy` gives `{x,y}` (`drizzle-orm/src/pg-core/columns/point.ts:80-99`) |
| geometric line | PG | `line({ mode? })` | `tuple` vs `{a,b,c}` (`drizzle-orm/src/pg-core/columns/line.ts:80-99`) |
| PostGIS geometry(point) | PG | `geometry({ mode?, type?, srid? })` | tuple vs `{x,y}`; `type: 'point' | string`; SRID (`drizzle-orm/src/pg-core/columns/postgis_extension/geometry.ts:89-108`) |
| bit vector | PG extension | `bit({ dimensions })` | required numeric dimensions (`drizzle-orm/src/pg-core/columns/vector_extension/bit.ts:42-56`) |
| pg_vector vector | PG extension | `vector({ dimensions })` | `number[]`, required dimensions (`drizzle-orm/src/pg-core/columns/vector_extension/vector.ts:46-60`) |
| pg_vector halfvec | PG extension | `halfvec({ dimensions })` | `number[]`, required dimensions (`drizzle-orm/src/pg-core/columns/vector_extension/halfvec.ts:46-60`) |
| pg_vector sparsevec | PG extension | `sparsevec({ dimensions })` | sparse-vector string representation, required dimensions (`drizzle-orm/src/pg-core/columns/vector_extension/sparsevec.ts:46-60`) |
| named enum | PG | `pgEnum(name, tupleOrTsEnumObject)` then returned callable | tuple preserves a string union; a non-array string enum object preserves `E[keyof E]` (`drizzle-orm/src/pg-core/columns/enum.ts:7-24`, `drizzle-orm/src/pg-core/columns/enum.ts:64-145`) |
| custom | PG | `customType<T>(params)(name?, config?)` | `T` controls data/driver/json/config/default/not-null; detailed below (`drizzle-orm/src/pg-core/columns/custom.ts:338-365`) |
| array of any PG builder | PG | `builder.array()` / `.array('[][]' ... '[][][][][]')` | wraps data and driver types to dimensions 1..5 (`drizzle-orm/src/pg-core/columns/common.ts:13-21`, `drizzle-orm/src/pg-core/columns/common.ts:316-341`) |

### MySQL

| Column kind | Dialects | Builder | Type/config parameters and TS data |
|---|---|---|---|
| integer widths | MySQL | `tinyint`, `smallint`, `mediumint`, `int` | `{ unsigned?: boolean }`; literal unsigned changes data constraint; each supports `.autoincrement()` (`drizzle-orm/src/mysql-core/columns/int.ts:38-52`; width builders follow the same config, e.g. `drizzle-orm/src/mysql-core/columns/mediumint.ts:42-52`) |
| bigint | MySQL | `bigint({ mode, unsigned? })` | mode `number | bigint | string` (`drizzle-orm/src/mysql-core/columns/bigint.ts:115-143`) |
| serial | MySQL | `serial()` | number, unsigned/default/autoincrement brands (`drizzle-orm/src/mysql-core/columns/serial.ts:6-43`) |
| decimal | MySQL | `decimal({ precision?, scale?, unsigned?, mode? })` | mode `string | number | bigint` (`drizzle-orm/src/mysql-core/columns/decimal.ts:161-190`) |
| floating point | MySQL | `float`, `double` | `{ precision?, scale?, unsigned? }` (`drizzle-orm/src/mysql-core/columns/float.ts:52-68`, `drizzle-orm/src/mysql-core/columns/double.ts:52-68`) |
| real | MySQL | `real({ precision?, scale? })` | `number`, no unsigned parameter (`drizzle-orm/src/mysql-core/columns/real.ts:52-67`) |
| boolean | MySQL | `boolean()` | `boolean` (`drizzle-orm/src/mysql-core/columns/boolean.ts:6-38`) |
| binary | MySQL | `binary({ length? })` | `string`; optional length (`drizzle-orm/src/mysql-core/columns/binary.ts:43-57`) |
| varbinary | MySQL | `varbinary({ length })` | required length (`drizzle-orm/src/mysql-core/columns/varbinary.ts:42-56`) |
| blobs | MySQL | `tinyblob`, `blob`, `mediumblob`, `longblob` | `{ mode?: 'buffer' | 'string' }`, default buffer (`drizzle-orm/src/mysql-core/columns/blob.ts:116-188`) |
| char | MySQL | `char({ length?, enum? })` | enum tuple narrows data (`drizzle-orm/src/mysql-core/columns/char.ts:51-70`) |
| varchar | MySQL | `varchar({ length, enum? })` | length required; enum tuple narrows (`drizzle-orm/src/mysql-core/columns/varchar.ts:48-68`) |
| text widths | MySQL | `tinytext`, `text`, `mediumtext`, `longtext` | `{ enum? }`; tuple narrows data (`drizzle-orm/src/mysql-core/columns/text.ts:67-119`) |
| native enum | MySQL | `mysqlEnum(tupleOrTsEnumObject)` | tuple or non-array string enum object (`drizzle-orm/src/mysql-core/columns/enum.ts:82-109`) |
| JSON | MySQL | `json()` | `unknown`, specialize with `$type<T>()` (`drizzle-orm/src/mysql-core/columns/json.ts:6-39`) |
| date | MySQL | `date({ mode? })` | `date | string` (`drizzle-orm/src/mysql-core/columns/date.ts:80-97`) |
| datetime | MySQL | `datetime({ mode?, fsp? })` | `date | string`, FSP `0..6` (`drizzle-orm/src/mysql-core/columns/datetime.ts:103-123`) |
| timestamp | MySQL | `timestamp({ mode?, fsp? })` | `date | string`, FSP `0..6` (`drizzle-orm/src/mysql-core/columns/timestamp.ts:91-113`) |
| time | MySQL | `time({ fsp? })` | string, FSP `0..6` (`drizzle-orm/src/mysql-core/columns/time.ts:47-61`) |
| year | MySQL | `year()` | number (`drizzle-orm/src/mysql-core/columns/year.ts:6-37`) |
| custom | MySQL | `customType<T>(params)(name?, config?)` | typed data/driver/json/config/default/not-null (`drizzle-orm/src/mysql-core/columns/custom.ts:322-350`) |

### SQLite

SQLite's exported storage-affinity builders are six functions (`blob`, `customType`, `integer`, `numeric`, `real`, `text`) at `drizzle-orm/src/sqlite-core/columns/all.ts:1-19`.

| Column kind/storage | Dialects | Builder | Type/config parameters and TS data |
|---|---|---|---|
| INTEGER | SQLite | `integer({ mode? })` / `int` | mode `number | timestamp | timestamp_ms | boolean`; data respectively number/Date/Date/boolean (`drizzle-orm/src/sqlite-core/columns/integer.ts:165-197`) |
| NUMERIC | SQLite | `numeric({ mode })` | mode `string | number | bigint` (`drizzle-orm/src/sqlite-core/columns/numeric.ts:108-130`) |
| REAL | SQLite | `real()` | number (`drizzle-orm/src/sqlite-core/columns/real.ts:6-32`) |
| TEXT | SQLite | `text({ mode?, length?, enum? })` | text mode can narrow by enum; JSON mode maps JSON and disallows length/enum in its config branch (`drizzle-orm/src/sqlite-core/columns/text.ts:94-128`) |
| BLOB | SQLite | `blob({ mode? })` | `buffer | json | bigint`; runtime with no mode selects JSON; source recommends TEXT JSON for JSON functions (`drizzle-orm/src/sqlite-core/columns/blob.ts:160-190`) |
| custom affinity/type spelling | SQLite | `customType<T>(params)(name?, config?)` | typed mapping with arbitrary `dataType()` string (`drizzle-orm/src/sqlite-core/columns/custom.ts:333-355`) |

The `.enum` options on PG/MySQL string builders and SQLite text are TypeScript narrowing devices, not named database enums. Their `getSQLType()` still returns text/varchar/char (`drizzle-orm/src/pg-core/columns/text.ts:30-49`, `drizzle-orm/src/pg-core/columns/varchar.ts:31-48`, `drizzle-orm/src/sqlite-core/columns/text.ts:35-51`). Use `pgEnum`/`mysqlEnum` when the database type itself must be enum.

**DSL use:** Model the field-kind union per dialect from these exact builder bundles. Make optional feature fields dialect-discriminated: PG arrays/vector/network/geometry/interval, MySQL unsigned/width/FSP/native enum, and SQLite storage mode are not portable aliases.

## 5. Constraints and indexes by dialect

### 5.1 Foreign keys and inline `references()`

All three requested dialects use the same action union, verbatim:

```ts
type UpdateDeleteAction =
  | 'cascade'
  | 'restrict'
  | 'no action'
  | 'set null'
  | 'set default';
```

Sources: PG `drizzle-orm/src/pg-core/foreign-keys.ts:6`; MySQL `drizzle-orm/src/mysql-core/foreign-keys.ts:6`; SQLite `drizzle-orm/src/sqlite-core/foreign-keys.ts:6`.

Inline PG:

```ts
references(
  ref: () => PgColumn,
  config?: { name?: string; onUpdate?: UpdateDeleteAction; onDelete?: UpdateDeleteAction },
): this
```

Source: config `drizzle-orm/src/pg-core/columns/common.ts:158-165`; method/build `drizzle-orm/src/pg-core/columns/common.ts:343-349`, `drizzle-orm/src/pg-core/columns/common.ts:374-395`. MySQL/SQLite inline references accept the two actions but no inline name (`drizzle-orm/src/mysql-core/columns/common.ts:23-49`, `drizzle-orm/src/sqlite-core/columns/common.ts:20-47`).

Composite FK shape is:

```ts
foreignKey<
  TTableName extends string,
  TForeignTableName extends string,
  TColumns extends [AnyPgColumn<{ tableName: TTableName }>, ...same[]],
>(config: {
  name?: string;
  columns: TColumns;
  foreignColumns: { [K in keyof TColumns]: AnyPgColumn<{ tableName: TForeignTableName }> };
}): ForeignKeyBuilder
```

Source: PG `drizzle-orm/src/pg-core/foreign-keys.ts:98-124`; MySQL equivalent `drizzle-orm/src/mysql-core/foreign-keys.ts:97-130`; SQLite equivalent `drizzle-orm/src/sqlite-core/foreign-keys.ts:100-132`. The builder then has `.onUpdate(action)` and `.onDelete(action)` (PG `drizzle-orm/src/pg-core/foreign-keys.ts:15-60`). Tuple length and same-table membership are typed; source/target data-type compatibility is not preserved by `ColumnsWithTable`.

### 5.2 Checks, primary keys, and unique constraints

- `check(name: string, value: SQL): CheckBuilder` is identical in shape across dialects (PG `drizzle-orm/src/pg-core/checks.ts:5-31`; MySQL `drizzle-orm/src/mysql-core/checks.ts:5-31`; SQLite `drizzle-orm/src/sqlite-core/checks.ts:5-34`).
- PG composite `primaryKey({ name?, columns: [first, ...rest] })`; positional arguments remain deprecated (`drizzle-orm/src/pg-core/primary-keys.ts:5-23`).
- SQLite composite PK has the same optional name (`drizzle-orm/src/sqlite-core/primary-keys.ts:5-23`).
- MySQL composite PK's config has only `columns`, no name (`drizzle-orm/src/mysql-core/primary-keys.ts:5-23`).
- `unique(name?).on(first, ...rest)` exists in all three. PG adds `.nullsNotDistinct()` (`drizzle-orm/src/pg-core/unique-constraint.ts:6-54`); MySQL and SQLite do not (`drizzle-orm/src/mysql-core/unique-constraint.ts:6-50`, `drizzle-orm/src/sqlite-core/unique-constraint.ts:6-47`).
- Inline PG `.unique(name?, { nulls: 'distinct' | 'not distinct' })` stores unique metadata (`drizzle-orm/src/pg-core/columns/common.ts:351-359`); MySQL/SQLite inline `.unique(name?)` only stores the name.

No PostgreSQL exclusion-constraint builder exists in this rc5 source, and `PgTableExtraConfigValue` does not include one (`drizzle-orm/src/pg-core/table.ts:22-30`).

### 5.3 Index feature matrix

| Feature | PostgreSQL | MySQL | SQLite |
|---|---|---|---|
| constructors | `index(name?)`, `uniqueIndex(name?)` | name required | name required |
| columns | `.on(...)`, `.onOnly(...)`, `.using(method, ...)` | `.on(...)` | `.on(...)` |
| methods | `btree`, `hash`, `gist`, `spgist`, `gin`, `brin`, `hnsw`, `ivfflat`, or custom string | `btree | hash` | none |
| partial predicate | `.where(SQL)` | no | `.where(SQL)` |
| build modifiers | `.concurrently()`, `.with(record)` | `.algorithm('default'|'inplace'|'copy')`, `.lock('default'|'none'|'shared'|'exclusive')` | none |
| per-column modifiers | `.asc()`, `.desc()`, `.nullsFirst()`, `.nullsLast()`, `.op(PgIndexOpClass)` | none | none |

PG exact signatures/method union are `drizzle-orm/src/pg-core/indexes.ts:8-46`, `drizzle-orm/src/pg-core/indexes.ts:109-230`, `drizzle-orm/src/pg-core/indexes.ts:239-303`. The verbatim `PgIndexOpClass` union, including built-ins and pg_vector classes, is `drizzle-orm/src/pg-core/indexes.ts:48-107`. Per-column modifiers are implemented on `ExtraConfigColumn` (`drizzle-orm/src/pg-core/columns/common.ts:545-622`). There are not separate `.btree()`/`.gin()` methods: these are values passed to `.using(...)`.

MySQL exact config and methods: `drizzle-orm/src/mysql-core/indexes.ts:6-29`, `drizzle-orm/src/mysql-core/indexes.ts:32-110`. SQLite exact config and partial-index method: `drizzle-orm/src/sqlite-core/indexes.ts:6-50`, `drizzle-orm/src/sqlite-core/indexes.ts:74-80`.

Generated default names include PG unique `${table}_${columns}_unique` (`drizzle-orm/src/pg-core/unique-constraint.ts:10-12`), PG PK `${table}_${columns}_pk` (`drizzle-orm/src/pg-core/primary-keys.ts:55-63`), and FK `${localTable}_${localColumns}_${foreignTable}_${foreignColumns}_fk` (`drizzle-orm/src/pg-core/foreign-keys.ts:80-95`).

**DSL use:** Emit constraint/index builders through the table's array-form `extraConfig`. Keep inline `.references()` for simple single-column FKs, but use `foreignKey(...)` for composite/name-controlled constraints. Encode index features as a dialect-discriminated union; do not expose PG-only `where/op/concurrently` or MySQL-only `algorithm/lock` cross-dialect.

## 6. rc5 relations API / RQBv2

This is the new `drizzle-orm/src/relations.ts` API, not the legacy `_relations.ts` API.

### 6.1 Input and helper shape

`defineRelations` first filters a supplied module-like record down to top-level `Table`/`View` values (`drizzle-orm/src/relations.ts:1632-1669`). Its overload is:

```ts
defineRelations<
  TSchema extends Record<string, unknown>,
  TConfig extends RelationsBuilderConfig<TTables>,
  TTables extends Schema = ExtractTablesFromSchema<TSchema>,
>(
  schema: TSchema,
  relations: (helpers: RelationsBuilder<TTables>) => TConfig,
): ExtractTablesWithRelations<TConfig, TTables>
```

Source: `drizzle-orm/src/relations.ts:1672-1702`. The result is a record keyed by the TS schema keys, each `{ table, name, relations }` (`drizzle-orm/src/relations.ts:634-662`). `defineRelationsPart` builds only configured tables; `defineRelations` builds every table (`drizzle-orm/src/relations.ts:1704-1732`).

`RelationsBuilder<TSchema>` intersects:

- `r.<tableKey>.<columnKey>` wrappers for every column; and
- `r.one.<targetTableKey>(config?)` / `r.many.<targetTableKey>(config?)` factories.

Source: `drizzle-orm/src/relations.ts:1563-1620`. This is property access, not a TypeScript generic invocation.

Exact configs:

```ts
interface OneConfig<TTargetTable extends SchemaEntry, TOptional extends boolean> {
  from?: RBColumn | [RBColumn, ...RBColumn[]];
  to?: RBColumn | [RBColumn, ...RBColumn[]];
  where?: TableFilter<TTargetTable> | EmptyFilter;
  optional?: TOptional;
  alias?: string;
}

interface ManyConfig<TTargetTable extends SchemaEntry> {
  from?: RBColumn | [RBColumn, ...RBColumn[]];
  to?: RBColumn | [RBColumn, ...RBColumn[]];
  where?: TableFilter<TTargetTable> | EmptyFilter;
  alias?: string;
}
```

Source: `drizzle-orm/src/relations.ts:1533-1561`. A `One` defaults `optional` to `true` (`drizzle-orm/src/relations.ts:378-387`).

### 6.2 Structure the DSL should emit

For direct FK metadata:

```ts
export const schema = { users, posts } as const;

export const relations = defineRelations(schema, (r) => ({
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
      optional: false,
      alias: 'posts_author',
    }),
  },
  users: {
    posts: r.many.posts({ alias: 'posts_author' }),
  },
}));
```

The explicit side supplies both `from` and `to`. The reverse may omit them; `processRelations` finds and reverses the matching relation. If multiple edges connect the same tables, both sides need the same nonempty alias. The runtime validation and reverse-resolution rules are exact at `drizzle-orm/src/relations.ts:78-245`: both or neither of `from`/`to`, same lengths without a through table, correct source/target table ownership, no empty aliases, and unambiguous reverse edges.

For junction metadata:

```ts
users: {
  groups: r.many.groups({
    from: r.users.id.through(r.usersToGroups.userId),
    to: r.groups.id.through(r.usersToGroups.groupId),
  }),
}
```

`.through(column)` wraps an endpoint column plus a junction column (`drizzle-orm/src/relations.ts:1336-1408`). Every through wrapper on an edge must use the same junction table, and a composite relation must use through consistently on every component (`drizzle-orm/src/relations.ts:153-178`).

`Relation`, `One`, and `Many` carry source/target columns, alias, filter, optionality, and optional junction state (`drizzle-orm/src/relations.ts:288-445`). Relation objects do **not** derive from DDL foreign-key objects. The DSL must emit both DDL `references/foreignKey` builders and RQBv2 relation config from the same metadata.

### 6.3 RQBv2 wiring

`DrizzleConfig` accepts `relations?: TRelationConfigs` separately from `schema` (`drizzle-orm/src/utils.ts:647-656`). Drivers pass this relation record into sessions/databases (PG example `drizzle-orm/src/postgres/driver-core.ts:35-67`). `PgAsyncDatabase.query` maps exactly over relation-record keys and constructs a `RelationalQueryBuilder` for each (`drizzle-orm/src/pg-core/async/db.ts:37-84`).

**DSL use:** Generate a single `defineRelations(schema, ...)` call from FK metadata, use explicit `from/to` on at least one side, use a stable shared alias for multiple edges, infer `One.optional` from FK nullability/semantic optionality, and emit through wrappers for junctions. Pass the resulting record as `relations` to `drizzle(...)`.

## 7. drizzle-kit discovery contract

### 7.1 Discovery is runtime/entity based, not AST-shape based

For PG, kit loads every configured schema file, examines `Object.values(moduleExports)`, and accepts values for which `is(value, PgTable)` succeeds (`drizzle-kit/src/dialects/postgres/drizzle.ts:785-846`, `drizzle-kit/src/dialects/postgres/drizzle.ts:848-887`). MySQL and SQLite do the same (`drizzle-kit/src/dialects/mysql/drizzle.ts:321-341`, `drizzle-kit/src/dialects/sqlite/drizzle.ts:224-264`). TS schema files are executed through `jiti`; JS files are dynamically imported (`drizzle-kit/src/utils/utils-node.ts:429-474`).

`is` first uses `instanceof`, then walks constructors and compares the global `Symbol.for('drizzle:entityKind')` string, which tolerates multiple package instances (`drizzle-orm/src/entity.ts:1-31`). `PgTable` declares entity kind `PgTable` (`drizzle-orm/src/pg-core/table.ts:39-60`).

Consequences:

- Kit does not care whether source text contains a literal `pgTable(...)` call.
- A generic factory that actually returns `pgTable(...)`'s result is a genuine `PgTable` and is discoverable.
- Tables must be top-level exported values. Kit does not recursively walk an exported `{ tables: {...} }` object or array; it only applies `is` to each immediate `Object.values(exports)` entry.
- Module import must synchronously/deterministically construct the tables. Import-time environment/secret/database dependencies are a kit hazard.

### 7.2 Symbols/config that matter

Core table symbols are:

```ts
Table.Symbol = {
  Name, Schema, OriginalName, Columns,
  ExtraConfigColumns, BaseName, IsAlias, ExtraConfigBuilder,
};
```

Source: global symbols `drizzle-orm/src/table.ts:19-40`; `Table.Symbol` and stored fields `drizzle-orm/src/table.ts:50-107`. `PgTable` adds `InlineForeignKeys` and `EnableRLS` (`drizzle-orm/src/pg-core/table.ts:34-59`). MySQL/SQLite add their own inline-FK symbols (`drizzle-orm/src/mysql-core/table.ts:30-52`, `drizzle-orm/src/sqlite-core/table.ts:30-52`).

`pgTableWithSchema` populates `Columns`, `ExtraConfigColumns`, inline FKs, and `ExtraConfigBuilder` (`drizzle-orm/src/pg-core/table.ts:107-135`). `getTableConfig` reads those symbols, executes the extra-config callback, recognizes builders by `entityKind`, builds them, and returns columns/indexes/FKs/checks/PKs/uniques/name/schema/policies/RLS (`drizzle-orm/src/pg-core/utils.ts:21-67`). MySQL/SQLite equivalents are `drizzle-orm/src/mysql-core/utils.ts:37-79` and `drizzle-orm/src/sqlite-core/utils.ts:21-59`.

Kit calls `getTableConfig` on discovered tables (`drizzle-kit/src/dialects/postgres/drizzle.ts:264-268`) and serializes runtime column flags including name, PK, not-null, default, generated expression, unique, and identity (`drizzle-kit/src/dialects/postgres/drizzle.ts:313-401`). Therefore standard factory-produced tables work with `drizzle-kit generate`; no manual symbol fabrication is needed or advisable.

New `defineRelations` output is not needed for DDL generation. Kit's currently discovered `Relations` entity is the legacy `drizzle-orm/_relations` class (`drizzle-kit/src/dialects/postgres/drizzle.ts:1-3`, `drizzle-kit/src/dialects/postgres/drizzle.ts:830-832`), whereas RQBv2 relations are passed explicitly in `DrizzleConfig`.

**DSL use:** Export every derived table directly from the schema module and always delegate construction to the public dialect table function. Keep factories import-pure. Never construct `Table`/symbols manually.

## 8. `customType()` as an escape hatch

PG's type projection is:

```ts
type ConvertCustomConfig<T extends Partial<CustomTypeValues>> = {
  dataType: 'custom';
  data: T['data'];
  driverParam: T['driverData'];
} & (T['notNull'] extends true ? { notNull: true } : {})
  & (T['default'] extends true ? { hasDefault: true } : {});
```

Source: `drizzle-orm/src/pg-core/columns/custom.ts:10-17`.

`CustomTypeValues` supplies `data`, optional `driverData`, `driverOutput`, `jsonData`, `config`, `configRequired`, `notNull`, and `default` (`drizzle-orm/src/pg-core/columns/custom.ts:101-166`). `CustomTypeParams` requires `dataType(config): string` and can supply `toDriver`, `fromDriver`, `fromJson`, `forJsonSelect`, and a PG codec (`drizzle-orm/src/pg-core/columns/custom.ts:168-335`). The returned callable makes its config argument required exactly when `configRequired: true`:

```ts
customType<T extends CustomTypeValues>(
  params: CustomTypeParams<T>,
): /* callable returning PgCustomColumnBuilder<ConvertCustomConfig<T>> */
```

Source: `drizzle-orm/src/pg-core/columns/custom.ts:338-365`.

MySQL has the same generic callable and includes MySQL codec/JSON-selection hooks (`drizzle-orm/src/mysql-core/columns/custom.ts:85-150`, `drizzle-orm/src/mysql-core/columns/custom.ts:152-320`, `drizzle-orm/src/mysql-core/columns/custom.ts:322-350`). SQLite has the same typed mappings but no codec selector in `CustomTypeParams` (`drizzle-orm/src/sqlite-core/columns/custom.ts:110-175`, `drizzle-orm/src/sqlite-core/columns/custom.ts:177-330`, `drizzle-orm/src/sqlite-core/columns/custom.ts:333-355`).

This is the correct escape hatch for an exotic SQL type not represented by a native builder: kit consumes the custom column's `getSQLType()` string, while ORM data/driver mappings remain typed. It is not the best substitute for native builders when kit needs structured semantics (named enum identity, generated identity, vector dimensions/opclasses, geometry metadata, precision/scale round-tripping). Those semantics may collapse to an opaque SQL type string during introspection/diffing.

**DSL use:** Put `customType` behind an explicit dialect-specific `custom` field variant with typed data/driver/config and an audited SQL type generator. Prefer first-class builders whenever kit must understand more than the raw type spelling.

## 9. Additional levers

### Typed SQL is opt-in/phantom

The template overload is `sql<T>(strings, ...params): SQL<T>` (`drizzle-orm/src/sql/sql.ts:650-673`). The generic is asserted by the caller; Drizzle does not infer SQL result types from expressions. `.as(alias)` preserves `T`, `.mapWith(decoder)` derives a decoder result, and `.nullable()` adds null (`drizzle-orm/src/sql/sql.ts:465-505`). `sql.identifier` only escapes an identifier and explicitly warns that the input still requires validation (`drizzle-orm/src/sql/sql.ts:722-734`).

**DSL use:** Type checks/generated expressions as `SQL` and query projections as `sql<T>` only when the DSL owns the expression contract. Do not treat `sql<T>` as validation.

### Base `Table` versus dialect tables

`Table` contains common identity/symbol storage; `PgTable`, `MySqlTable`, and `SQLiteTable` add dialect entity kinds and inline-FK/config storage. Query builders and kit test the dialect subclass, not merely `Table` (`drizzle-orm/src/table.ts:50-112`, `drizzle-orm/src/pg-core/table.ts:39-60`).

**DSL use:** A cross-dialect factory should dispatch to the dialect's table function and return a dialect-conditioned table type. A manually constructed base `Table` is neither query-builder- nor kit-equivalent.

### Enum tuple preservation

Enum overloads use `U extends string, T extends Readonly<[U, ...U[]]>` plus `Writable<T>`, preventing empty tuples while preserving literal members. PG additionally accepts `NonArray<Record<string,string>>` for TS string enums (`drizzle-orm/src/pg-core/columns/enum.ts:128-145`). String builders use an `Equal` test to fall back to plain `string` when the generic is broad (`drizzle-orm/src/pg-core/columns/text.ts:6-12`).

**DSL use:** Keep enum values as readonly nonempty tuples in metadata. A widened `readonly string[]` cannot yield a literal union.

## Top 10 levers ranked

1. **Key-preserving mapped builder type.** `PgBuildColumns` is precise if and only if `keyof TColumnsMap` and each `TColumnsMap[K]['_']` are precise.
2. **Generic constraint, not broad annotation.** `T extends Record<string, AnyPgColumnBuilder>` preserves inference; `x: Record<string, ...>` erases it.
3. **One audited `Object.fromEntries` assertion.** Restore `BuildersFor<Metadata>` only after exhaustive runtime dispatch.
4. **Literal metadata discriminants.** `notNull`, default, generated, identity, mode, enum tuple, and dialect must remain literals for conditional builder types to resolve.
5. **Use rc5's PG-specific builder path.** `PgColumnBuilderConfig`/`Set*`/`ResolvePgColumnConfig`, not a remembered common `ColumnBuilderTypeConfig` API.
6. **Delegate to the public dialect table constructor.** It supplies real entity kinds, columns, inline FKs, extra-config symbols, query-builder compatibility, and kit discovery.
7. **Generate DDL FKs and RQBv2 relations separately from the same metadata.** Neither derives the other.
8. **Use array-form extra config.** It is the forward rc5 API and carries indexes/checks/composite keys/FKs/uniques/policies.
9. **Use construction-time casing.** `snakeCase.table` changes actual runtime column names and therefore kit DDL, while TS keys stay unchanged.
10. **Use `customType` narrowly.** It preserves data/driver types and raw DDL spelling but not every native structured semantic.

## Traps/gotchas

1. **Already-widened records cannot be repaired.** Once the columns value is typed `Record<string, AnyPgColumnBuilder>`, literal keys and individual flag/data types are gone.
2. **`ColumnBuilderTypeConfig` is not an rc5 symbol.** PG and common paths are distinct; importing or reimplementing an older helper will drift.
3. **PG accepts `AnyPgColumnBuilder`, not arbitrary common builders.** The structural type signature is looser than the runtime methods `pgTableWithSchema` calls.
4. **Generic runtime loops lose correlations.** `Object.keys`, `Object.entries`, `reduce`, and `Object.fromEntries` need a mapped-type boundary; scattering casts makes soundness unauditable.
5. **Broad metadata booleans force broad/union types.** Fully exact `notNull`/default brands require literal field metadata.
6. **PG built config hard-codes some informational flags false.** `isPrimaryKey`, `isAutoincrement`, and `hasRuntimeDefault` are not reliable built-column type discriminants in `ResolvePgColumnConfig`; infer models from the fields Drizzle itself uses.
7. **Runtime default/update functions do not reach kit.** `$defaultFn` and `$onUpdateFn` affect ORM inserts only; they do not emit SQL defaults/triggers.
8. **PG generated has a runtime/type `hasDefault` nuance.** Type branding and generated exclusion produce correct insert behavior, while runtime `hasDefault` itself is not set by `generatedAlwaysAs`.
9. **`PgColumn.toBuilder()` is runtime-faithful but type-broad.** Its return type does not preserve the source column's detailed config.
10. **Casing is runtime-only for column names.** There is no built-in type-level `SnakeCase<Key>`; TS property keys remain original.
11. **Explicit names bypass casing.** Passing `text('someName')` prevents `setName` from deriving a name from the key.
12. **Kit only scans immediate module export values.** An exported registry object containing tables is not recursively discovered.
13. **RQBv2 relations are not DDL constraints.** `defineRelations` alone will not make drizzle-kit emit a foreign key.
14. **Reverse relations can be ambiguous.** Multiple edges require a shared nonempty alias on both sides; otherwise runtime processing throws.
15. **Through relations require consistent junction wrappers.** All components must use the same through table.
16. **Composite FK typing does not check data-type equality.** It checks tuple arity and table names, so the DSL should validate source/target type compatibility.
17. **PG extra-config columns are intentionally broadened.** They enable index fluency but are not the concrete column classes returned on the table.
18. **Array dimensions are type-limited to five.** Runtime/string metadata outside `[]` through five pairs is not represented by the overload.
19. **String-builder `.enum` is not a database enum.** Use `pgEnum`/`mysqlEnum` for native enum DDL.
20. **`sql<T>` is an assertion.** It supplies result typing without parsing or validating the SQL.
21. **The deprecated object extra-config form still works but is a migration liability.** New DSL output should always return an array.
22. **Import-time side effects break kit.** Schema modules are executed by kit; factories must not require a live DB or unavailable runtime state.
23. **Custom types may diff as opaque spellings.** Prefer native builders for structured dialect behavior and stable round trips.
