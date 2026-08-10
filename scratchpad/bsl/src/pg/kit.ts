/**
 * Builds PostgreSQL-local kits without importing SQLite implementation code.
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
import * as Pg from "./combinators.ts";
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
import { toPgTable } from "./table.ts";

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
  readonly dialect: "pg";
  readonly defaultColumns: (pg: typeof Pg) => Defaults & ValidateFields<Defaults>;
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
 * import type { EntityFactory } from "@beep/effect-drizzle/pg"
 *
 * type Defaults = { readonly version: typeof Int }
 * type Entity = EntityFactory<Defaults> // => defaults-injected model factory
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export interface EntityFactory<Defaults extends FieldsInput> {
  <Self = never, const Identifier extends string = string>(
    identifier: Identifier & ValidateDerivedSqlName<Identifier, "kit Entity identifier derives an invalid PostgreSQL table name">,
  ): <const Own extends FieldsInput>(
    ownFields: Own & ValidateCollision<Defaults, Own> & ValidateMergedFields<Defaults, Own>,
    annotationsOrExtras?: Annotations.Annotations | Table.Callback<Merged<Defaults, Own>>,
  ) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, Merged<Defaults, Own>>;
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
  readonly pg: typeof Pg;
  readonly Model: typeof Model;
  readonly Entity: EntityFactory<Defaults>;
  readonly Table: typeof Table;
  readonly Repository: typeof makeRepository;
  readonly schema: typeof schema;
  readonly toPgTable: typeof toPgTable;
}

/**
 * Creates a PostgreSQL-only kit without importing the SQLite implementation.
 *
 * **Example** (Create an isolated PostgreSQL kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { make } from "@beep/effect-drizzle/pg"
 *
 * const kit = make({
 *   dialect: "pg",
 *   defaultColumns: (pg) => ({ version: Int.pipe(pg.integer(), pg.default(1)) })
 * })
 *
 * kit.pg.integer // => PostgreSQL integer combinator
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export function make<const Defaults extends FieldsInput>(config: PgKitConfig<Defaults>): PgKit<Defaults>;
export function make(config: {
  readonly dialect: "pg";
  readonly defaultColumns: (pg: typeof Pg) => FieldsInput;
  readonly defaultExtras?: Table.Callback<FieldsInput> | undefined;
}): object {
  const defaults = config.defaultColumns(Pg);
  assertUniqueSqlNames(
    Object.entries(defaults).map(([key, input]): readonly [string, string] => [
      key,
      Field.from(input).meta.columnName ?? snakeCase(key),
    ]),
    "pg",
    "PostgreSQL kit default column name",
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

  return { pg: Pg, Model, Entity, Table, Repository: makeRepository, schema, toPgTable };
}
