/** Dialect kit factory for invariant model defaults and shared BSL operators. */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import type * as S from "effect/Schema";
import * as Field from "./Field.ts";
import {
  type FieldsInput,
  type MissingSelfGeneric,
  Model,
  type ModelClass,
  ModelInvariantError,
  makeModelClass,
  type ValidateFields,
} from "./factory.ts";
import * as Pg from "./pg.ts";
import { schema } from "./schema.ts";
import * as Table from "./TableExtras.ts";
import { toPgTable } from "./table.ts";

const $I = $ScratchpadId.create("bsl/kit");

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
export const Dialect = LiteralKit(["pg"]).pipe(
  $I.annoteSchema("Dialect", {
    description: "SQL dialect implemented by a BSL kit configuration.",
  })
);
/**
 * SQL dialect literal represented by {@link Dialect}.
 *
 * @category models
 * @since 0.0.0
 */
export type Dialect = typeof Dialect.Type;

/**
 * PostgreSQL kit configuration with invariant default fields and table extras.
 *
 * @category models
 * @since 0.0.0
 */
export interface PgKitConfig<Defaults extends FieldsInput> {
  readonly dialect: "pg";
  readonly defaultColumns: (pg: typeof Pg) => Defaults;
  readonly defaultExtras?: Table.Callback<Defaults> | undefined;
}

type Merged<Defaults extends FieldsInput, Own extends FieldsInput> = Defaults &
  Own;

type ValidateCollision<
  Defaults extends FieldsInput,
  Own extends FieldsInput
> = {
  readonly [K in keyof Own]: K extends keyof Defaults
    ? Field.BslTypeError<`'${K &
        string}' is a kit default column — remove it or use Model`>
    : unknown;
};

type ValidateMergedFields<
  Defaults extends FieldsInput,
  Own extends FieldsInput,
  Effective extends FieldsInput = Merged<Defaults, Own>
> = {
  readonly [K in keyof Own]: K extends keyof ValidateFields<Effective>
    ? ValidateFields<Effective>[K]
    : unknown;
} & (ValidateFields<Effective> extends Field.BslTypeError<infer Message>
  ? Field.BslTypeError<Message>
  : unknown);

/**
 * Defaults-injected model factory returned by a PostgreSQL kit.
 *
 * @category models
 * @since 0.0.0
 */
export interface EntityFactory<Defaults extends FieldsInput> {
  <Self = never>(identifier: string): <const Own extends FieldsInput>(
    ownFields: Own &
      ValidateCollision<Defaults, Own> &
      ValidateMergedFields<Defaults, Own>,
    annotationsOrExtras?:
      | S.Annotations.Annotations
      | Table.Callback<Merged<Defaults, Own>>
  ) => [Self] extends [never]
    ? MissingSelfGeneric
    : ModelClass<Self, Merged<Defaults, Own>>;
}

/**
 * Operators returned by the PostgreSQL branch of {@link make}.
 *
 * @category models
 * @since 0.0.0
 */
export interface PgKit<Defaults extends FieldsInput> {
  readonly pg: typeof Pg;
  readonly Model: typeof Model;
  readonly Entity: EntityFactory<Defaults>;
  readonly Table: typeof Table;
  readonly schema: typeof schema;
  readonly toPgTable: typeof toPgTable;
}

/**
 * Create a dialect kit with immutable entity defaults.
 *
 * **Example** (Create a PostgreSQL kit)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { make } from "./kit.ts"
 *
 * const kit = make({
 *   dialect: "pg",
 *   defaultColumns: (pg) => ({ version: S.Int.pipe(pg.integer(), pg.default(1)) }),
 *   defaultExtras: () => []
 * })
 * console.log(kit.pg.integer)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = <const Defaults extends FieldsInput>(
  config: PgKitConfig<Defaults>
): PgKit<Defaults> => {
  if (!Dialect.is.pg(config.dialect)) {
    throw ModelInvariantError.make({
      message: `Unsupported BSL kit dialect '${config.dialect}'.`,
      fieldName: "(dialect)",
    });
  }
  const defaults = config.defaultColumns(Pg);
  const defaultKeys = R.keys<string, Field.Input>(defaults);

  function Entity<Self = never>(
    identifier: string
  ): <const Own extends FieldsInput>(
    ownFields: Own &
      ValidateCollision<Defaults, Own> &
      ValidateMergedFields<Defaults, Own>,
    annotationsOrExtras?:
      | S.Annotations.Annotations
      | Table.Callback<Merged<Defaults, Own>>
  ) => [Self] extends [never]
    ? MissingSelfGeneric
    : ModelClass<Self, Merged<Defaults, Own>>;
  function Entity(identifier: string): unknown {
    return <const Own extends FieldsInput>(
      ownFields: Own,
      annotationsOrExtras?:
        | S.Annotations.Annotations
        | Table.Callback<Merged<Defaults, Own>>
    ): object => {
      const collision = A.findFirst(
        R.keys<string, Field.Input>(ownFields),
        (key) => A.contains(defaultKeys, key)
      );
      if (O.isSome(collision)) {
        throw ModelInvariantError.make({
          message: `'${collision.value}' is a kit default column — remove it or use Model.`,
          fieldName: collision.value,
        });
      }
      const fields = { ...defaults, ...ownFields };
      const modelExtras = P.isFunction(annotationsOrExtras)
        ? annotationsOrExtras
        : undefined;
      const annotations = P.isFunction(annotationsOrExtras)
        ? undefined
        : annotationsOrExtras;
      const extras: Table.Callback<typeof fields> = (columns) =>
        A.appendAll(
          O.match(O.fromUndefinedOr(config.defaultExtras), {
            onNone: A.empty<Table.Node>,
            onSome: (callback) => callback(columns),
          }),
          O.match(O.fromUndefinedOr(modelExtras), {
            onNone: A.empty<Table.Node>,
            onSome: (callback) => callback(columns),
          })
        );
      return makeModelClass(identifier, fields, annotations, extras);
    };
  }

  return { pg: Pg, Model, Entity, Table, schema, toPgTable };
};
