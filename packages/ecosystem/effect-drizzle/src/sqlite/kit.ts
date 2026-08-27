/**
 * Builds SQLite-local kits without importing PostgreSQL implementation code.
 *
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- pg/sqlite are deliberately mirrored dialect implementations; shared logic lives in src/core and the remaining parallelism is per-dialect vocabulary that must evolve independently (doc 14 family; review at next dialect addition)
import { contains, findFirst } from "effect/Array";
import { fromUndefinedOr, isSome, match } from "effect/Option";
import { isFunction } from "effect/Predicate";
import { assign } from "effect/Struct";
import * as Field from "../core/Field.ts";
import { assertUniqueSqlNames } from "../core/names.ts";
import { makeRepository } from "../core/repository.ts";
import { snakeCase } from "../internal/case.ts";
import * as Sqlite from "./combinators.ts";
import * as Table from "./extras.ts";
import { Model, ModelInvariantError, makeModelClass } from "./model.ts";
import { schema } from "./schema.ts";
import { toSqliteTable } from "./table.ts";
import type { Annotations } from "effect/Schema";
import type { ValidateDerivedSqlName } from "../core/names.ts";
import type { FieldsInput, MissingSelfGeneric, ModelClass, ValidateFields } from "./model.ts";

/**
 * The dialect namespace a SQLite kit closure receives.
 *
 * **Details**
 *
 * One binding carries every column combinator, the `default` alias for
 * `default_`, and the `Table` extras namespace, so kit configuration never
 * imports dialect modules separately.
 *
 * **Example** (Use the toolkit inside a kit closure)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { make } from "@beep/effect-drizzle/sqlite"
 *
 * const kit = make((sqlite) => ({
 *   defaultColumns: { version: Int.pipe(sqlite.integer(), sqlite.default(1)) }
 * }))
 *
 * kit.sqlite.Table.index // => SQLite index-node constructor
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SqliteToolkit = typeof Sqlite & {
  readonly default: typeof Sqlite.default_;
  readonly Table: typeof Table;
};

const toolkit: SqliteToolkit = { ...Sqlite, default: Sqlite.default_, Table };

/**
 * Configures invariant SQLite fields and table extras for {@link make}.
 *
 * **When to use**
 *
 * Use when every entity in a SQLite slice must share columns or constraints.
 *
 * **Details**
 *
 * The whole configuration is produced inside one closure receiving the
 * {@link SqliteToolkit}, so `defaultColumns` is a plain field record and
 * `defaultExtras` closes over the same dialect namespace.
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
  readonly defaultColumns: Defaults & ValidateFields<Defaults>;
  readonly defaultExtras?: Table.Callback<FieldsInput> | undefined;
}

type AnyFields = Readonly<Record<string, Field.Input>>;
type Merged<Defaults extends AnyFields, Own extends AnyFields> = Defaults & Own;

function mergeFields<Defaults extends AnyFields, Own extends AnyFields>(
  defaults: Defaults,
  own: Own
): Merged<Defaults, Own>;
function mergeFields(defaults: AnyFields, own: AnyFields): AnyFields {
  return assign(defaults, own);
}

/**
 * Rejects own-field keys that shadow an existing SQLite kit default column.
 *
 * **Example** (Reject a shadowed default)
 *
 * ```ts
 * import { Int, String } from "effect/Schema"
 * import type { SqliteValidateCollision } from "@beep/effect-drizzle/sqlite"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Accepted = SqliteValidateCollision<Defaults, { readonly name: typeof String }>
 * // => { readonly name: unknown }
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type SqliteValidateCollision<Defaults extends AnyFields, Own extends AnyFields> = {
  readonly [K in keyof Own]: K extends keyof Defaults
    ? Field.SqlTypeError<`'${K & string}' is a kit default column — remove it or use Model`>
    : unknown;
};

/**
 * Validates own fields against the complete merged SQLite kit field record.
 *
 * **Example** (Validate merged fields)
 *
 * ```ts
 * import { Int, String } from "effect/Schema"
 * import type { SqliteValidateMergedFields } from "@beep/effect-drizzle/sqlite"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Accepted = SqliteValidateMergedFields<Defaults, { readonly name: typeof String }>
 * // => own-field record validated against the merged model
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type SqliteValidateMergedFields<
  Defaults extends FieldsInput,
  Own extends FieldsInput,
  Effective extends FieldsInput = Merged<Defaults, Own>,
> = {
  readonly [K in keyof Own]: K extends keyof ValidateFields<Effective> ? ValidateFields<Effective>[K] : unknown;
} & (ValidateFields<Effective> extends Field.SqlTypeError<infer Message> ? Field.SqlTypeError<Message> : unknown);

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
export type SqliteEntityFactory<Defaults extends FieldsInput> = <
  Self = never,
  const Identifier extends string = string,
>(
  identifier: Identifier &
    ValidateDerivedSqlName<Identifier, "kit Entity identifier derives an invalid SQLite table name">
) => <const Own extends FieldsInput>(
  ownFields: Own & SqliteValidateCollision<Defaults, Own> & SqliteValidateMergedFields<Defaults, Own>,
  annotationsOrExtras?: Annotations.Annotations | Table.Callback<Merged<Defaults, NoInfer<Own>>>
) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, Merged<Defaults, Own>>;

/**
 * Additional columns and extras layered onto an existing SQLite kit by `extend`.
 *
 * **Example** (Describe a SQLite kit extension)
 *
 * ```ts
 * import { Int, String } from "effect/Schema"
 * import type { SqliteKitExtension } from "@beep/effect-drizzle/sqlite"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Extension = SqliteKitExtension<Defaults, { readonly label: typeof String }>
 * // => columns and optional extras accepted by extend
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface SqliteKitExtension<Defaults extends FieldsInput, More extends FieldsInput> {
  readonly columns: More & SqliteValidateCollision<Defaults, More> & SqliteValidateMergedFields<Defaults, More>;
  readonly extras?: Table.Callback<FieldsInput> | undefined;
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

const makeResolved = (defaults: FieldsInput, defaultExtras: Table.Callback<FieldsInput> | undefined): object => {
  assertUniqueSqlNames(
    Object.entries(defaults).map(([key, input]): readonly [string, string] => [
      key,
      Field.from(input).meta.columnName ?? snakeCase(key),
    ]),
    "sqlite",
    "SQLite kit default column name"
  );
  const defaultKeys = Object.keys(defaults);
  const Entity =
    (identifier: string) =>
    (ownFields: FieldsInput, annotationsOrExtras?: Annotations.Annotations | Table.Callback<FieldsInput>): object => {
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
        ...match(fromUndefinedOr(defaultExtras), {
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
  const extend = (build: (sqlite: SqliteToolkit) => SqliteKitExtension<FieldsInput, FieldsInput>): object => {
    const extension = build(toolkit);
    const collision = findFirst(Object.keys(extension.columns), (key) => contains(defaultKeys, key));
    if (isSome(collision)) {
      throw ModelInvariantError.make({
        message: `'${collision.value}' is already a kit default column — extensions cannot shadow it.`,
        fieldName: collision.value,
      });
    }
    const mergedExtras: Table.Callback<FieldsInput> | undefined = match(fromUndefinedOr(extension.extras), {
      onNone: () => defaultExtras,
      onSome:
        (extensionExtras): Table.Callback<FieldsInput> =>
        (columns) => [
          ...match(fromUndefinedOr(defaultExtras), {
            onNone: () => [],
            onSome: (callback) => callback(columns),
          }),
          ...extensionExtras(columns),
        ],
    });
    return makeResolved(mergeFields(defaults, extension.columns), mergedExtras);
  };

  return { sqlite: toolkit, Model, Entity, extend, Table, Repository: makeRepository, schema, toSqliteTable };
};

/**
 * Creates a SQLite-only kit without importing the PostgreSQL implementation.
 *
 * **Details**
 *
 * The whole configuration lives in one closure receiving the
 * {@link SqliteToolkit}. The returned kit can be layered with `extend`.
 *
 * **Example** (Create an isolated SQLite kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { make } from "@beep/effect-drizzle/sqlite"
 *
 * const kit = make((sqlite) => ({
 *   defaultColumns: { version: Int.pipe(sqlite.integer()) }
 * }))
 *
 * kit.sqlite.integer // => SQLite integer combinator
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export function make<const Defaults extends FieldsInput>(
  build: (sqlite: SqliteToolkit) => SqliteKitConfig<Defaults>
): SqliteKit<Defaults>;
export function make(
  build: (sqlite: SqliteToolkit) => {
    readonly defaultColumns: FieldsInput;
    readonly defaultExtras?: Table.Callback<FieldsInput> | undefined;
  }
): object {
  const config = build(toolkit);
  return makeResolved(config.defaultColumns, config.defaultExtras);
}
