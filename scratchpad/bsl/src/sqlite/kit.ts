/**
 * Builds SQLite-local kits without importing PostgreSQL implementation code.
 *
 * @since 0.0.0
 */
import { contains, findFirst } from "effect/Array";
import { fromUndefinedOr, isSome, match } from "effect/Option";
import { isFunction } from "effect/Predicate";
import type { Annotations } from "effect/Schema";
import { assign } from "effect/Struct";
import * as Field from "../core/Field.ts";
import {
  assertUniqueSqlNames,
  type ValidateDerivedSqlName,
} from "../core/names.ts";
import { snakeCase } from "../internal/case.ts";
import { makeRepository } from "../core/repository.ts";
import * as Sqlite from "./combinators.ts";
import * as Table from "./extras.ts";
import {
  type FieldsInput,
  type MissingSelfGeneric,
  Model,
  ModelInvariantError,
  type ModelClass,
  makeModelClass,
  type ValidateFields,
} from "./model.ts";
import { schema } from "./schema.ts";
import { toSqliteTable } from "./table.ts";

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
 * import type { SqliteKitConfig } from "@beep/effect-drizzle/sqlite"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Config = SqliteKitConfig<Defaults> // => SQLite kit configuration
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface SqliteKitConfig<Defaults extends FieldsInput> {
  readonly dialect: "sqlite";
  readonly defaultColumns: (sqlite: typeof Sqlite) => Defaults & ValidateFields<Defaults>;
  readonly defaultExtras?: Table.Callback<Defaults> | undefined;
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
  Defaults extends FieldsInput,
  Own extends FieldsInput,
  Effective extends FieldsInput = Merged<Defaults, Own>,
> = {
  readonly [K in keyof Own]: K extends keyof ValidateFields<Effective>
    ? ValidateFields<Effective>[K]
    : unknown;
} & (ValidateFields<Effective> extends Field.SqlTypeError<infer Message>
  ? Field.SqlTypeError<Message>
  : unknown);

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
 * import type { SqliteEntityFactory } from "@beep/effect-drizzle/sqlite"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Entity = SqliteEntityFactory<Defaults> // => defaults-injected SQLite factory
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export interface SqliteEntityFactory<Defaults extends FieldsInput> {
  <Self = never, const Identifier extends string = string>(
    identifier: Identifier & ValidateDerivedSqlName<Identifier, "kit Entity identifier derives an invalid SQLite table name">,
  ): <const Own extends FieldsInput>(
    ownFields: Own & ValidateCollision<Defaults, Own> & ValidateMergedFields<Defaults, Own>,
    annotationsOrExtras?: Annotations.Annotations | Table.Callback<Merged<Defaults, Own>>,
  ) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, Merged<Defaults, Own>>;
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
 * import type { SqliteKit } from "@beep/effect-drizzle/sqlite"
 *
 * type Kit = SqliteKit<{ readonly version: typeof Int }>
 * type Dialect = keyof Pick<Kit, "sqlite"> // => "sqlite"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SqliteKit<Defaults extends FieldsInput> {
  readonly sqlite: typeof Sqlite;
  readonly Model: typeof Model;
  readonly Entity: SqliteEntityFactory<Defaults>;
  readonly Table: typeof Table;
  readonly Repository: typeof makeRepository;
  readonly schema: typeof schema;
  readonly toSqliteTable: typeof toSqliteTable;
}

/**
 * Creates a SQLite-only kit without importing the PostgreSQL implementation.
 *
 * **Example** (Create an isolated SQLite kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { make } from "@beep/effect-drizzle/sqlite"
 *
 * const kit = make({
 *   dialect: "sqlite",
 *   defaultColumns: (sqlite) => ({ version: Int.pipe(sqlite.integer()) })
 * })
 *
 * kit.sqlite.integer // => SQLite integer combinator
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export function make<const Defaults extends FieldsInput>(
  config: SqliteKitConfig<Defaults>,
): SqliteKit<Defaults>;
export function make(config: {
  readonly dialect: "sqlite";
  readonly defaultColumns: (sqlite: typeof Sqlite) => FieldsInput;
  readonly defaultExtras?: Table.Callback<FieldsInput> | undefined;
}): object {
  const defaults = config.defaultColumns(Sqlite);
  assertUniqueSqlNames(
    Object.entries(defaults).map(([key, input]): readonly [string, string] => [
      key,
      Field.from(input).meta.columnName ?? snakeCase(key),
    ]),
    "sqlite",
    "SQLite kit default column name",
  );
  const defaultKeys = Object.keys(defaults);
  const Entity = (identifier: string) =>
    (
      ownFields: FieldsInput,
      annotationsOrExtras?: Annotations.Annotations | Table.Callback<FieldsInput>,
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
      return makeModelClass(identifier, fields, annotations, extras);
    };

  return { sqlite: Sqlite, Model, Entity, Table, Repository: makeRepository, schema, toSqliteTable };
}
