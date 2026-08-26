/**
 * Builds PostgreSQL-local kits without importing SQLite implementation code.
 *
 * @since 0.0.0
 */
import { contains, findFirst } from "effect/Array";
import { fromUndefinedOr, isSome, match } from "effect/Option";
import { isFunction } from "effect/Predicate";
import { assign } from "effect/Struct";
import * as Field from "../core/Field.ts";
import { assertUniqueSqlNames } from "../core/names.ts";
import { makeRepository } from "../core/repository.ts";
import { snakeCase } from "../internal/case.ts";
import * as Pg from "./combinators.ts";
import * as Table from "./extras.ts";
import { Model, ModelInvariantError, makeModelClass } from "./model.ts";
import { schema } from "./schema.ts";
import { toPgTable } from "./table.ts";
import type { Annotations } from "effect/Schema";
import type { ValidateDerivedSqlName } from "../core/names.ts";
import type { FieldsInput, MissingSelfGeneric, ModelClass, ValidateFields } from "./model.ts";

/**
 * The dialect namespace a PostgreSQL kit closure receives.
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
 * import { make } from "@beep/effect-drizzle/pg"
 *
 * const kit = make((pg) => ({
 *   defaultColumns: { version: Int.pipe(pg.integer(), pg.default(1)) },
 *   defaultExtras: (columns) => [pg.Table.index("kit_version_btree_idx", [columns.version])]
 * }))
 *
 * kit.pg.Table.index // => PostgreSQL index-node constructor
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PgToolkit = typeof Pg & {
  readonly default: typeof Pg.default_;
  readonly Table: typeof Table;
};

const toolkit: PgToolkit = { ...Pg, default: Pg.default_, Table };

/**
 * Configures invariant PostgreSQL fields and table extras for {@link make}.
 *
 * **When to use**
 *
 * Use when every entity in a PostgreSQL slice must share columns or constraints.
 *
 * **Details**
 *
 * The whole configuration is produced inside one closure receiving the
 * {@link PgToolkit}, so `defaultColumns` is a plain field record and
 * `defaultExtras` closes over the same dialect namespace. Default extras run
 * before model-local extras against the merged field record.
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
 * import type { PgKitConfig } from "@beep/effect-drizzle/pg"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Config = PgKitConfig<Defaults> // => PostgreSQL kit configuration
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface PgKitConfig<Defaults extends FieldsInput> {
  readonly defaultColumns: Defaults & ValidateFields<Defaults>;
  readonly defaultExtras?: Table.Callback<NoInfer<Defaults>> | undefined;
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
 * Rejects own-field keys that shadow an existing kit default column.
 *
 * **Details**
 *
 * Success resolves each key to `unknown`; a shadowing key resolves to a
 * `SqlTypeError` whose literal message appears on the offending property.
 *
 * **Example** (Reject a shadowed default)
 *
 * ```ts
 * import { Int, String } from "effect/Schema"
 * import type { ValidateCollision } from "@beep/effect-drizzle/pg"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Accepted = ValidateCollision<Defaults, { readonly name: typeof String }>
 * // => { readonly name: unknown }
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateCollision<Defaults extends AnyFields, Own extends AnyFields> = {
  readonly [K in keyof Own]: K extends keyof Defaults
    ? Field.SqlTypeError<`'${K & string}' is a kit default column — remove it or use Model`>
    : unknown;
};

/**
 * Validates own fields against the complete merged kit field record.
 *
 * **Details**
 *
 * Per-key diagnostics from {@link ValidateFields} surface on the own-field
 * keys, and whole-model violations (for example a second inline primary key)
 * surface on the record itself.
 *
 * **Example** (Validate merged fields)
 *
 * ```ts
 * import { Int, String } from "effect/Schema"
 * import type { ValidateMergedFields } from "@beep/effect-drizzle/pg"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Accepted = ValidateMergedFields<Defaults, { readonly name: typeof String }>
 * // => own-field record validated against the merged model
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateMergedFields<
  Defaults extends FieldsInput,
  Own extends FieldsInput,
  Effective extends FieldsInput = Merged<Defaults, Own>,
> = {
  readonly [K in keyof Own]: K extends keyof ValidateFields<Effective> ? ValidateFields<Effective>[K] : unknown;
} & (ValidateFields<Effective> extends Field.SqlTypeError<infer Message> ? Field.SqlTypeError<Message> : unknown);

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
 * All model statics and variants observe the merged field record. Pass
 * annotations second and entity-local extras third when a model needs both.
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
 * import type { EntityFactory } from "@beep/effect-drizzle/pg"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Entity = EntityFactory<Defaults> // => defaults-injected model factory
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export type EntityFactory<Defaults extends FieldsInput> = <Self = never, const Identifier extends string = string>(
  identifier: Identifier &
    ValidateDerivedSqlName<Identifier, "kit Entity identifier derives an invalid PostgreSQL table name">
) => <const Own extends FieldsInput>(
  ownFields: Own & ValidateCollision<Defaults, Own> & ValidateMergedFields<Defaults, Own>,
  annotationsOrExtras?: Annotations.Annotations | Table.Callback<Merged<Defaults, Own>>,
  extras?: Table.Callback<Merged<Defaults, Own>>
) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, Merged<Defaults, Own>>;

/**
 * Additional columns and extras layered onto an existing kit by `extend`.
 *
 * **Details**
 *
 * `columns` may not shadow a column the kit already owns; `extras` are
 * concatenated after the kit's existing default extras, so extension can add
 * but never silently drop inherited nodes.
 *
 * **Example** (Describe a kit extension)
 *
 * ```ts
 * import { Int, String } from "effect/Schema"
 * import type { PgKitExtension } from "@beep/effect-drizzle/pg"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Extension = PgKitExtension<Defaults, { readonly label: typeof String }>
 * // => columns and optional extras accepted by extend
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface PgKitExtension<Defaults extends FieldsInput, More extends FieldsInput> {
  readonly columns: More & ValidateCollision<Defaults, More> & ValidateMergedFields<Defaults, More>;
  readonly extras?: Table.Callback<Merged<Defaults, NoInfer<More>>> | undefined;
}

/**
 * Describes the PostgreSQL vocabulary returned by {@link make}.
 *
 * **Details**
 *
 * The kit keeps column operators, bare and defaults-injected model factories,
 * table extras, repository construction, assembly, projection, and capability
 * extension on one dialect-bound object.
 *
 * **Example** (Infer a PostgreSQL kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import type { PgKit } from "@beep/effect-drizzle/pg"
 *
 * type Kit = PgKit<{ readonly version: typeof Int }>
 * type Entity = Kit["Entity"] // => defaults-injected entity factory
 * ```
 *
 * @category models
 * @since 0.0.0
 */
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

const makeResolved = (defaults: FieldsInput, defaultExtras: Table.Callback<FieldsInput> | undefined): object => {
  assertUniqueSqlNames(
    Object.entries(defaults).map(([key, input]): readonly [string, string] => [
      key,
      Field.from(input).meta.columnName ?? snakeCase(key),
    ]),
    "pg",
    "PostgreSQL kit default column name"
  );
  const defaultKeys = Object.keys(defaults);
  const Entity =
    (identifier: string) =>
    (
      ownFields: FieldsInput,
      annotationsOrExtras?: Annotations.Annotations | Table.Callback<FieldsInput>,
      declaredExtras?: Table.Callback<FieldsInput>
    ): object => {
      const collision = findFirst(Object.keys(ownFields), (key) => contains(defaultKeys, key));
      if (isSome(collision)) {
        throw ModelInvariantError.make({
          message: `'${collision.value}' is a kit default column — remove it or use Model.`,
          fieldName: collision.value,
        });
      }
      const fields = mergeFields(defaults, ownFields);
      const modelExtras = isFunction(annotationsOrExtras) ? annotationsOrExtras : declaredExtras;
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
  const extend = (build: (pg: PgToolkit) => PgKitExtension<FieldsInput, FieldsInput>): object => {
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

  return { pg: toolkit, Model, Entity, extend, Table, Repository: makeRepository, schema, toPgTable };
};

/**
 * Creates a PostgreSQL-only kit without importing the SQLite implementation.
 *
 * **Details**
 *
 * The whole configuration lives in one closure receiving the {@link PgToolkit},
 * so column combinators and the `Table` extras namespace need no separate
 * imports. The returned kit can be layered with `extend`.
 *
 * **Example** (Create an isolated PostgreSQL kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { make } from "@beep/effect-drizzle/pg"
 *
 * const kit = make((pg) => ({
 *   defaultColumns: { version: Int.pipe(pg.integer(), pg.default(1)) }
 * }))
 *
 * kit.pg.integer // => PostgreSQL integer combinator
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export function make<const Defaults extends FieldsInput>(
  build: (pg: PgToolkit) => PgKitConfig<Defaults>
): PgKit<Defaults>;
export function make(
  build: (pg: PgToolkit) => {
    readonly defaultColumns: FieldsInput;
    readonly defaultExtras?: Table.Callback<FieldsInput> | undefined;
  }
): object {
  const config = build(toolkit);
  return makeResolved(config.defaultColumns, config.defaultExtras);
}
