/**
 * Creates dialect-bound modeling kits with invariant entity defaults.
 *
 * A kit fixes one SQL dialect, shared columns, and shared table extras once,
 * while retaining the bare model factory as an explicit opt-out.
 *
 * @since 0.0.0
 */
import { contains, findFirst } from "effect/Array";
import { fromUndefinedOr, isSome, match } from "effect/Option";
import { isFunction } from "effect/Predicate";
import type { Annotations } from "effect/Schema";
import { assign } from "effect/Struct";
import * as Field from "./core/Field.ts";
import {
  type FieldsInput as PgFieldsInput,
  type MissingSelfGeneric as PgMissingSelfGeneric,
  Model as PgModel,
  type ModelClass as PgModelClass,
  ModelInvariantError,
  makeModelClass as makePgModelClass,
  type ValidateFields as ValidatePgFields,
} from "./pg/model.ts";
import * as Pg from "./pg/combinators.ts";
import { makeRepository } from "./core/repository.ts";
import { schema } from "./pg/schema.ts";
import * as Table from "./pg/extras.ts";
import { toPgTable } from "./pg/table.ts";
import {
  type FieldsInput as SqliteFieldsInput,
  type MissingSelfGeneric as SqliteMissingSelfGeneric,
  Model as SqliteModel,
  type ModelClass as SqliteModelClass,
  makeModelClass as makeSqliteModelClass,
  type ValidateFields as ValidateSqliteFields,
} from "./sqlite/model.ts";
import * as Sqlite from "./sqlite/combinators.ts";
import { schema as sqliteSchema } from "./sqlite/schema.ts";
import * as SqliteTable from "./sqlite/extras.ts";
import { toSqliteTable } from "./sqlite/table.ts";

/**
 * Narrows the SQL dialects accepted by {@link make}.
 *
 * **When to use**
 *
 * Use when validating configuration before selecting a dialect kit.
 *
 * **Details**
 *
 * The public root entrypoint exposes the literal union `"pg" | "sqlite"` for
 * configuration and kit-selection signatures.
 *
 * **Example** (Select the PostgreSQL dialect)
 *
 * ```ts
 * import type { Dialect } from "@beep/effect-drizzle"
 *
 * type PostgreSQL = Extract<Dialect, "pg"> // => "pg"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Dialect = {
  is: {
    pg: (value: unknown): value is "pg" => value === "pg",
    sqlite: (value: unknown): value is "sqlite" => value === "sqlite",
  },
};
/**
 */
export type Dialect = "pg" | "sqlite";

/**
 * Configures invariant PostgreSQL fields and table extras for {@link make}.
 *
 * **When to use**
 *
 * Use when every entity in a PostgreSQL slice must share columns or constraints.
 *
 * **Details**
 *
 * `defaultColumns` receives the PostgreSQL combinator namespace. Default extras
 * run before model-local extras against the merged field record.
 *
 * **Gotchas**
 *
 * A kit entity cannot redeclare a default field key; use the bare `Model`
 * returned by the kit when a table must opt out.
 *
 * **Example** (Describe PostgreSQL defaults)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import type { PgKitConfig } from "@beep/effect-drizzle"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Config = PgKitConfig<Defaults> // => PostgreSQL kit configuration
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface PgKitConfig<Defaults extends PgFieldsInput> {
  readonly dialect: "pg";
  readonly defaultColumns: (pg: typeof Pg) => Defaults;
  readonly defaultExtras?: Table.Callback<Defaults> | undefined;
}

/**
 * Configures invariant SQLite fields and table extras for {@link make}.
 *
 * **When to use**
 *
 * Use when every entity in a SQLite slice must share columns or constraints.
 *
 * **Details**
 *
 * `defaultColumns` receives only SQLite operators, preventing PostgreSQL
 * descriptor families from entering the merged model.
 *
 * **Gotchas**
 *
 * SQLite has no array column operator, and default field keys cannot be
 * overridden by kit entities.
 *
 * **Example** (Describe SQLite defaults)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import type { SqliteKitConfig } from "@beep/effect-drizzle"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Config = SqliteKitConfig<Defaults> // => SQLite kit configuration
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface SqliteKitConfig<Defaults extends SqliteFieldsInput> {
  readonly dialect: "sqlite";
  readonly defaultColumns: (sqlite: typeof Sqlite) => Defaults;
  readonly defaultExtras?: SqliteTable.Callback<Defaults> | undefined;
}

type AnyFields = Readonly<Record<string, Field.Input>>;
type Merged<Defaults extends AnyFields, Own extends AnyFields> = Defaults & Own;

function mergeFields<Defaults extends AnyFields, Own extends AnyFields>(
  defaults: Defaults,
  own: Own,
): Merged<Defaults, Own>;
function mergeFields(defaults: AnyFields, own: AnyFields): AnyFields {
  return assign(defaults, own);
}

type ValidateCollision<Defaults extends AnyFields, Own extends AnyFields> = {
  readonly [K in keyof Own]: K extends keyof Defaults
    ? Field.SqlTypeError<`'${K & string}' is a kit default column — remove it or use Model`>
    : unknown;
};

type ValidateMergedFields<
  Defaults extends PgFieldsInput,
  Own extends PgFieldsInput,
  Effective extends PgFieldsInput = Merged<Defaults, Own>,
> = {
  readonly [K in keyof Own]: K extends keyof ValidatePgFields<Effective>
    ? ValidatePgFields<Effective>[K]
    : unknown;
} & (ValidatePgFields<Effective> extends Field.SqlTypeError<infer Message>
  ? Field.SqlTypeError<Message>
  : unknown);

type ValidateMergedSqliteFields<
  Defaults extends SqliteFieldsInput,
  Own extends SqliteFieldsInput,
  Effective extends SqliteFieldsInput = Merged<Defaults, Own>,
> = {
  readonly [K in keyof Own]: K extends keyof ValidateSqliteFields<Effective>
    ? ValidateSqliteFields<Effective>[K]
    : unknown;
} & (ValidateSqliteFields<Effective> extends Field.SqlTypeError<infer Message>
  ? Field.SqlTypeError<Message>
  : unknown);

/**
 * Builds PostgreSQL entity models with a kit's invariant fields and extras.
 *
 * **When to use**
 *
 * Use when a table participates in the kit's shared entity contract; use the
 * sibling bare `Model` for junctions or deliberate opt-outs.
 *
 * **Details**
 *
 * Default fields precede own fields, and default extras precede model extras.
 * All model statics and variants observe the merged field record.
 *
 * **Gotchas**
 *
 * A colliding key produces a readable `~effect-drizzle.error` at compile time
 * and a `ModelInvariantError` if the type boundary is bypassed.
 *
 * **Example** (Name a PostgreSQL entity factory)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import type { EntityFactory } from "@beep/effect-drizzle"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Entity = EntityFactory<Defaults> // => defaults-injected model factory
 * ```
 *
 * @see {@link Model} for the bare model factory without kit defaults.
 * @category factories
 * @since 0.0.0
 */
export interface EntityFactory<Defaults extends PgFieldsInput> {
  <Self = never>(
    identifier: string,
  ): <const Own extends PgFieldsInput>(
    ownFields: Own & ValidateCollision<Defaults, Own> & ValidateMergedFields<Defaults, Own>,
    annotationsOrExtras?: Annotations.Annotations | Table.Callback<Merged<Defaults, Own>>,
  ) => [Self] extends [never] ? PgMissingSelfGeneric : PgModelClass<Self, Merged<Defaults, Own>>;
}

/**
 * Builds SQLite entity models with a kit's invariant fields and extras.
 *
 * **When to use**
 *
 * Use when a SQLite table participates in the kit's shared entity contract.
 *
 * **Details**
 *
 * Default and own fields form one model before SQLite validation, projection,
 * or relation assembly runs.
 *
 * **Gotchas**
 *
 * A default-field collision is rejected statically and again at runtime.
 *
 * **Example** (Name a SQLite entity factory)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import type { SqliteEntityFactory } from "@beep/effect-drizzle"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Entity = SqliteEntityFactory<Defaults> // => defaults-injected SQLite factory
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export interface SqliteEntityFactory<Defaults extends SqliteFieldsInput> {
  <Self = never>(identifier: string): <const Own extends SqliteFieldsInput>(
    ownFields: Own & ValidateCollision<Defaults, Own> & ValidateMergedSqliteFields<Defaults, Own>,
    annotationsOrExtras?: Annotations.Annotations | SqliteTable.Callback<Merged<Defaults, Own>>,
  ) => [Self] extends [never]
    ? SqliteMissingSelfGeneric
    : SqliteModelClass<Self, Merged<Defaults, Own>>;
}

/**
 * Describes the PostgreSQL vocabulary returned by {@link make}.
 *
 * **Details**
 *
 * The kit keeps column operators, bare and defaults-injected model factories,
 * table extras, repository construction, assembly, and projection on one
 * dialect-bound object.
 *
 * **Example** (Infer a PostgreSQL kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import type { PgKit } from "@beep/effect-drizzle"
 *
 * type Kit = PgKit<{ readonly version: typeof Int }>
 * type Entity = Kit["Entity"] // => EntityFactory<{ readonly version: typeof Int }>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PgKit<Defaults extends PgFieldsInput> {
  readonly pg: typeof Pg;
  readonly Model: typeof PgModel;
  readonly Entity: EntityFactory<Defaults>;
  readonly Table: typeof Table;
  readonly Repository: typeof makeRepository;
  readonly schema: typeof schema;
  readonly toPgTable: typeof toPgTable;
}

/**
 * Describes the SQLite vocabulary returned by {@link make}.
 *
 * **Details**
 *
 * The absence of PostgreSQL-only operators, especially arrays and native enum
 * objects, is represented by the returned surface rather than runtime flags.
 *
 * **Example** (Infer a SQLite kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import type { SqliteKit } from "@beep/effect-drizzle"
 *
 * type Kit = SqliteKit<{ readonly version: typeof Int }>
 * type Dialect = keyof Pick<Kit, "sqlite"> // => "sqlite"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SqliteKit<Defaults extends SqliteFieldsInput> {
  readonly sqlite: typeof Sqlite;
  readonly Model: typeof SqliteModel;
  readonly Entity: SqliteEntityFactory<Defaults>;
  readonly Table: typeof SqliteTable;
  readonly Repository: typeof makeRepository;
  readonly schema: typeof sqliteSchema;
  readonly toSqliteTable: typeof toSqliteTable;
}

/** Builds the internal PostgreSQL kit after overload selection. */
const makePgKit = (config: PgKitConfig<PgFieldsInput>): object => {
  const defaults = config.defaultColumns(Pg);
  const defaultKeys = Object.keys(defaults);

  const Entity = (identifier: string) =>
    (
      ownFields: PgFieldsInput,
      annotationsOrExtras?: Annotations.Annotations | Table.Callback<PgFieldsInput>,
    ): object => {
      const collision = findFirst(Object.keys(ownFields), (key) => contains(defaultKeys, key));
      if (isSome(collision)) {
        throw ModelInvariantError.make({
          message: `'${collision.value}' is a kit default column — remove it or use Model.`,
          fieldName: collision.value,
        });
      }
      const fields = mergeFields(defaults, ownFields);
      const modelExtras = isFunction(annotationsOrExtras) ? annotationsOrExtras : undefined;
      const annotations = isFunction(annotationsOrExtras) ? undefined : annotationsOrExtras;
      const extras: Table.Callback<typeof fields> = (columns) => [
        ...match(fromUndefinedOr(config.defaultExtras), {
          onNone: () => [],
          onSome: (callback) => callback(columns),
        }),
        ...match(fromUndefinedOr(modelExtras), {
          onNone: () => [],
          onSome: (callback) => callback(columns),
        }),
      ];
      return makePgModelClass(identifier, fields, annotations, extras);
    };

  return {
    pg: Pg,
    Model: PgModel,
    Entity,
    Table,
    Repository: makeRepository,
    schema,
    toPgTable,
  };
};

const makeSqliteKit = (
  config: SqliteKitConfig<SqliteFieldsInput>,
): object => {
  const defaults = config.defaultColumns(Sqlite);
  const defaultKeys = Object.keys(defaults);

  const Entity = (identifier: string) =>
    (
      ownFields: SqliteFieldsInput,
      annotationsOrExtras?: Annotations.Annotations | SqliteTable.Callback<SqliteFieldsInput>,
    ): object => {
      const collision = findFirst(Object.keys(ownFields), (key) => contains(defaultKeys, key));
      if (isSome(collision)) {
        throw ModelInvariantError.make({
          message: `'${collision.value}' is a kit default column — remove it or use Model.`,
          fieldName: collision.value,
        });
      }
      const fields = mergeFields(defaults, ownFields);
      const modelExtras = isFunction(annotationsOrExtras) ? annotationsOrExtras : undefined;
      const annotations = isFunction(annotationsOrExtras) ? undefined : annotationsOrExtras;
      const extras: SqliteTable.Callback<typeof fields> = (columns) => [
        ...match(fromUndefinedOr(config.defaultExtras), {
          onNone: () => [],
          onSome: (callback) => callback(columns),
        }),
        ...match(fromUndefinedOr(modelExtras), {
          onNone: () => [],
          onSome: (callback) => callback(columns),
        }),
      ];
      return makeSqliteModelClass(identifier, fields, annotations, extras);
    };

  return {
    sqlite: Sqlite,
    Model: SqliteModel,
    Entity,
    Table: SqliteTable,
    Repository: makeRepository,
    schema: sqliteSchema,
    toSqliteTable,
  };
};

/**
 * Creates a dialect kit whose entity defaults and extras are fixed once.
 *
 * **When to use**
 *
 * Use when a model family shares audit columns, optimistic versions, table
 * constraints, or another invariant that should not be repeated per entity.
 *
 * **Details**
 *
 * The returned kit contains the selected dialect namespace, bare `Model`,
 * defaults-injected `Entity`, `Table`, repository factory, schema assembler,
 * and table projector. Default extras execute before entity-local extras.
 *
 * **Gotchas**
 *
 * Kit defaults are application-schema policy. Do not pair an Effect constructor
 * clock such as `Model.DateTimeUpdate` with a database `defaultNow()` for the
 * same field, or two clocks can disagree.
 *
 * **Example** (Create a PostgreSQL kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { make } from "@beep/effect-drizzle"
 *
 * const kit = make({
 *   dialect: "pg",
 *   defaultColumns: (pg) => ({ version: Int.pipe(pg.integer(), pg.default(1)) }),
 *   defaultExtras: () => []
 * })
 *
 * kit.pg.integer // => PostgreSQL integer combinator
 * kit.Entity // => defaults-injected model factory
 * ```
 *
 * @see {@link PgKitConfig} for PostgreSQL defaults and extras.
 * @see {@link SqliteKitConfig} for SQLite defaults and extras.
 * @category factories
 * @since 0.0.0
 */
export function make<const Defaults extends PgFieldsInput>(
  config: PgKitConfig<Defaults>,
): PgKit<Defaults>;
export function make<const Defaults extends SqliteFieldsInput>(
  config: SqliteKitConfig<Defaults>,
): SqliteKit<Defaults>;
export function make(
  config: PgKitConfig<PgFieldsInput> | SqliteKitConfig<SqliteFieldsInput>,
): unknown {
  if (config.dialect === "pg") return makePgKit(config);
  if (config.dialect === "sqlite") return makeSqliteKit(config);
  throw ModelInvariantError.make({
    message: "Unsupported @beep/effect-drizzle kit dialect.",
    fieldName: "(dialect)",
  });
}
