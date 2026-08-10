/** Dialect kit factory for invariant model defaults and shared @beep/effect-drizzle operators. */
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
 * SQL dialects supported by {@link make}.
 *
 * **Example** (Check the PostgreSQL dialect)
 *
 * ```ts
 * import { Dialect } from "./kit.ts"
 *
 * console.log(Dialect.is.pg("pg")) // true
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
 * SQL dialect literal represented by {@link Dialect}.
 *
 * @category models
 * @since 0.0.0
 */
export type Dialect = "pg" | "sqlite";

/**
 * PostgreSQL kit configuration with invariant default fields and table extras.
 *
 * @category models
 * @since 0.0.0
 */
export interface PgKitConfig<Defaults extends PgFieldsInput> {
  readonly dialect: "pg";
  readonly defaultColumns: (pg: typeof Pg) => Defaults;
  readonly defaultExtras?: Table.Callback<Defaults> | undefined;
}

/**
 * SQLite kit configuration with invariant default fields and table extras.
 *
 * @category models
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
 * Defaults-injected model factory returned by a PostgreSQL kit.
 *
 * @category models
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
 * Defaults-injected model factory returned by a SQLite kit.
 *
 * @category models
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
 * Operators returned by the PostgreSQL branch of {@link make}.
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
 * Operators returned by the SQLite branch of {@link make}.
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

/**
 * Create a dialect kit with immutable entity defaults.
 *
 * **Example** (Create a PostgreSQL kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { make } from "./kit.ts"
 *
 * const kit = make({
 *   dialect: "pg",
 *   defaultColumns: (pg) => ({ version: Int.pipe(pg.integer(), pg.default(1)) }),
 *   defaultExtras: () => []
 * })
 * console.log(kit.pg.integer)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
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
