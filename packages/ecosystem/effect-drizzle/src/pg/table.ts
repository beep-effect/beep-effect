/**
 * Postgres table projection: `@beep/effect-drizzle` model → real drizzle `pgTable`.
 *
 * The type side maps every field's resolved column spec + meta brands onto
 * rc4's actual builder classes (`PgBuilderBase`) wrapped in the `Set*` brand
 * intersections drizzle's model inference consumes. The runtime side is one
 * exhaustive dispatch producing real builders and delegating to the public
 * `pgTable` — so the result is query-builder- and drizzle-kit-equivalent to a
 * hand-written table.
 *
 * The public overload preserves each field's exact builder projection while
 * the broad runtime implementation assembles Drizzle's structural builder
 * record without assertions. Cross-table foreign keys arrive through
 * `schema.ts`; declared table extras and per-column unique metadata share this
 * single projection path.
 *
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- unique-constraint naming intentionally mirrors pg/schema.ts so table-local and assembly-level extras render identical SQL names (doc 14 family; review at next dialect addition)
import { sql } from "drizzle-orm";
import { getTableConfig, PgDialect, pgTable, uniqueKeyName } from "drizzle-orm/pg-core";
import { isArray, reduce } from "effect/Array";
import { pipe } from "effect/Function";
import {
  exhaustive,
  tags as matchTags,
  type as matchType,
  value as matchValue,
  when as matchWhen,
  withReturnType,
} from "effect/Match";
import { flatMap, fromUndefinedOr, getOrElse, getOrUndefined, match } from "effect/Option";
import { isFunction } from "effect/Predicate";
import { empty, get, set } from "effect/Record";
import { validateSchemaNames } from "../core/assembly.ts";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import { ModelInvariantError } from "../core/model.ts";
import { snakeCase } from "../internal/case.ts";
import * as PgColumn from "./Column.ts";
import * as Derive from "./derive.ts";
import * as TableExtras from "./extras.ts";
import type {
  PgBigInt53Builder,
  PgBigInt64Builder,
  PgBigSerial53Builder,
  PgBigSerial64Builder,
  PgBooleanBuilder,
  PgBuildColumns,
  PgByteaBuilder,
  PgCharBuilder,
  PgDateBuilder,
  PgDateStringBuilder,
  PgDoublePrecisionBuilder,
  PgEnumColumnBuilder,
  PgIntegerBuilder,
  PgJsonBuilder,
  PgJsonbBuilder,
  PgNumericBuilder,
  PgRealBuilder,
  PgSerialBuilder,
  PgSmallIntBuilder,
  PgSmallSerialBuilder,
  PgTableExtraConfigValue,
  PgTableWithColumns,
  PgTextBuilder,
  PgTimestampBuilder,
  PgTimestampStringBuilder,
  PgUUIDBuilder,
  PgVarcharBuilder,
  Set$Type,
  SetDimensions,
  SetHasDefault,
  SetHasGenerated,
  SetIdentity,
  SetIsPrimaryKey,
  SetNotNull,
} from "drizzle-orm/pg-core";
import type { SchemaName } from "../core/assembly.ts";
import type { AnyModel, FieldsInput } from "./model.ts";

const pgDialect = new PgDialect();
const assertSchemaExpression = (expression: import("drizzle-orm").SQL, context: string): void =>
  Meta.assertNoSqlParameters(pgDialect.sqlToQuery(expression).params, context);

// ---------------------------------------------------------------------------
// Type-level projection
// ---------------------------------------------------------------------------

type BuilderBase<C extends PgColumn.Spec> =
  C extends PgColumn.Varchar<number>
    ? PgVarcharBuilder
    : C extends PgColumn.Char<number>
      ? PgCharBuilder
      : C extends PgColumn.Numeric
        ? PgNumericBuilder
        : C extends PgColumn.DateColumn<infer Mode>
          ? Mode extends "date"
            ? PgDateBuilder
            : PgDateStringBuilder
          : C extends PgColumn.Enum<string, infer Value>
            ? PgEnumColumnBuilder<[Value, ...Value[]]>
            : C extends PgColumn.Custom
              ? PgColumn.CustomBuilder
              : C extends PgColumn.Text
                ? PgTextBuilder
                : C extends PgColumn.Uuid
                  ? PgUUIDBuilder
                  : C extends PgColumn.Integer<"integer" | PgColumn.EntityIdIdent<string>>
                    ? PgIntegerBuilder
                    : C extends PgColumn.Smallint
                      ? PgSmallIntBuilder
                      : C extends PgColumn.Serial
                        ? PgSerialBuilder
                        : C extends PgColumn.Smallserial
                          ? PgSmallSerialBuilder
                          : C extends PgColumn.Bigserial<infer SerialMode>
                            ? SerialMode extends "number"
                              ? PgBigSerial53Builder
                              : PgBigSerial64Builder
                            : C extends PgColumn.Bigint<infer M>
                              ? M extends "number"
                                ? PgBigInt53Builder
                                : PgBigInt64Builder
                              : C extends PgColumn.DoublePrecision
                                ? PgDoublePrecisionBuilder
                                : C extends PgColumn.Real
                                  ? PgRealBuilder
                                  : C extends PgColumn.Bool
                                    ? PgBooleanBuilder
                                    : C extends PgColumn.Jsonb
                                      ? PgJsonbBuilder
                                      : C extends PgColumn.Json
                                        ? PgJsonBuilder
                                        : C extends PgColumn.Timestamp<infer M>
                                          ? M extends "date"
                                            ? PgTimestampBuilder
                                            : PgTimestampStringBuilder
                                          : C extends PgColumn.Bytea
                                            ? PgByteaBuilder
                                            : never;

type NullableOf<I extends Field.Input> = null extends Field.EncodedOf<I> ? true : false;

type ApplyNotNull<B, Nullable extends boolean> = Nullable extends true ? B : SetNotNull<B>;
type ApplyPrimaryKey<B, M extends Meta.Meta> = M["primaryKey"] extends true ? SetIsPrimaryKey<B> : B;
type ApplyDefault<B, M extends Meta.Meta> = M["hasDefault"] extends true ? SetHasDefault<B> : B;
type ApplyGenerated<B, M extends Meta.Meta> = M["generated"] extends {
  readonly _tag: "sqlExpr" | "unsafeSql";
}
  ? SetHasGenerated<B>
  : B;
type ApplyIdentity<B, M extends Meta.Meta> = M["identity"] extends "always" | "byDefault"
  ? SetIdentity<B, M["identity"]>
  : B;
type ApplyDimensions<B, M extends Meta.Meta> = M["dimensions"] extends 0 ? B : SetDimensions<B, M["dimensions"]>;
type ElementAtDepth<Carrier, Dimensions extends PgColumn.ArrayDimension> = Dimensions extends 0
  ? Carrier
  : Carrier extends ReadonlyArray<infer Element>
    ? Dimensions extends 1
      ? Element
      : Dimensions extends 2
        ? Element extends ReadonlyArray<infer Element2>
          ? Element2
          : never
        : Dimensions extends 3
          ? Element extends ReadonlyArray<infer Element2>
            ? Element2 extends ReadonlyArray<infer Element3>
              ? Element3
              : never
            : never
          : Dimensions extends 4
            ? Element extends ReadonlyArray<infer Element2>
              ? Element2 extends ReadonlyArray<infer Element3>
                ? Element3 extends ReadonlyArray<infer Element4>
                  ? Element4
                  : never
                : never
              : never
            : Element extends ReadonlyArray<infer Element2>
              ? Element2 extends ReadonlyArray<infer Element3>
                ? Element3 extends ReadonlyArray<infer Element4>
                  ? Element4 extends ReadonlyArray<infer Element5>
                    ? Element5
                    : never
                  : never
                : never
              : never
    : never;

/**
 * Projects one schema-owned field to its exact Drizzle PostgreSQL builder type.
 *
 * **Details**
 *
 * Encoded carrier, nullability, defaults, generation, identity, primary-key
 * state, and array depth become the Drizzle brands used by model inference.
 *
 * **Example** (Project a string field builder)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { BuilderFor } from "@beep/effect-drizzle/pg"
 *
 * type StringBuilder = BuilderFor<typeof String>
 * // => non-null PgTextBuilder with string data
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export type BuilderFor<I extends Field.Input> = ApplyPrimaryKey<
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
>;

/**
 * Projects a field record to key-preserving Drizzle builder types.
 *
 * **Example** (Project a builder record)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { BuildersOf } from "@beep/effect-drizzle/pg"
 *
 * type Builders = BuildersOf<{ readonly name: typeof String }>
 * type NameBuilder = Builders["name"] // => builder for the name field
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export type BuildersOf<F extends FieldsInput> = {
  readonly [K in keyof F & string]: BuilderFor<F[K]>;
};

/**
 * Projects one model type to its complete Drizzle PostgreSQL table type.
 *
 * **Details**
 *
 * The result preserves model field keys and every builder brand used by
 * `$inferSelect` and `$inferInsert`.
 *
 * **Example** (Name a projected table)
 *
 * ```ts
 * import type { AnyModel } from "@beep/effect-drizzle"
 * import type { TableOf } from "@beep/effect-drizzle/pg"
 *
 * type Table = TableOf<AnyModel>
 * type Dialect = Table["_"]["dialect"] // => "pg"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type TableOf<M extends AnyModel> = PgTableWithColumns<{
  name: string;
  schema: undefined;
  columns: PgBuildColumns<string, BuildersOf<M["sql"]["fields"]>>;
  dialect: "pg";
}>;

// ---------------------------------------------------------------------------
// Runtime projection
// ---------------------------------------------------------------------------

/**
 * Assembly-owned Drizzle enum instances keyed by PostgreSQL enum name.
 *
 * @category models
 * @since 0.0.0
 */
export type EnumRegistry = Readonly<Record<string, PgColumn.EnumInstance>>;

const buildColumn = (
  key: string,
  meta: Meta.Meta<PgColumn.Spec>,
  nullable: boolean,
  enums: EnumRegistry | undefined
): PgColumn.DrizzleBuilder => {
  const spec = getOrElse(fromUndefinedOr(meta.column), () => {
    throw Derive.DeriveColumnError.make({
      message: `Column for '${key}' was not resolved before projection.`,
      fieldName: key,
      astTag: "(resolved)",
    });
  });
  const name = getOrElse(fromUndefinedOr(meta.columnName), () => snakeCase(key));
  const base = PgColumn.Spec.guards.enum(spec)
    ? PgColumn.Enum.toDrizzleBuilder(
        spec,
        name,
        flatMap(fromUndefinedOr(enums), (registry) => get(registry, spec.name)).pipe(getOrUndefined)
      )
    : pipe(spec, PgColumn.Spec.toDrizzleBuilder(name, meta.identity));
  const withDimensions = matchValue(meta.dimensions).pipe(
    matchWhen(0, () => base),
    matchWhen(1, () => base.array("[]")),
    matchWhen(2, () => base.array("[][]")),
    matchWhen(3, () => base.array("[][][]")),
    matchWhen(4, () => base.array("[][][][]")),
    matchWhen(5, () => base.array("[][][][][]")),
    exhaustive
  );
  const withNullability = nullable ? withDimensions : withDimensions.notNull();
  const withPrimaryKey = meta.primaryKey ? withNullability.primaryKey() : withNullability;
  const withUnique = meta.unique ? withPrimaryKey.unique() : withPrimaryKey;
  const withDefault = match(fromUndefinedOr(meta.default), {
    onNone: () => withUnique,
    onSome: matchType<Meta.Default>().pipe(
      withReturnType<PgColumn.DrizzleBuilder>(),
      matchTags({
        value: ({ value }) => withUnique.default(value),
        sqlExpr: ({ expression }) => {
          assertSchemaExpression(expression, `PostgreSQL default expression for '${key}'`);
          return withUnique.default(expression);
        },
        now: () => withUnique.default(sql`now()`),
        unsafeSql: ({ sql: statement }) => withUnique.default(sql.raw(statement)),
      }),
      exhaustive
    ),
  });
  return matchValue(meta.generated).pipe(
    withReturnType<PgColumn.DrizzleBuilder>(),
    matchWhen(false, () => withDefault),
    matchTags({
      identityAlways: () => withDefault,
      sqlExpr: ({ expression }) => {
        assertSchemaExpression(expression, `PostgreSQL generated expression for '${key}'`);
        return withDefault.generatedAlwaysAs(expression);
      },
      unsafeSql: ({ sql: statement }) => withDefault.generatedAlwaysAs(sql.raw(statement)),
    }),
    exhaustive
  );
};

/**
 * Adds assembly-owned Drizzle extras beside a model's declared extras.
 *
 * **Details**
 *
 * Model extras are emitted first and additional extras second. Schema assembly
 * uses this seam for foreign keys after every model reference is known.
 *
 * **Example** (Declare no additional extras)
 *
 * ```ts
 * import type { AnyModel } from "@beep/effect-drizzle"
 * import type { AdditionalExtras } from "@beep/effect-drizzle/pg"
 *
 * const none: AdditionalExtras<AnyModel> = () => []
 * none({}) // => []
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type AdditionalExtras<M extends AnyModel> = (
  columns: TableExtras.BoundColumns<M["sql"]["fields"]>
) => ReadonlyArray<PgTableExtraConfigValue>;

const isDeclaredExtras = (value: unknown): value is ReadonlyArray<TableExtras.Node> =>
  isArray(value) && value.every(TableExtras.isNode);

const invokeDeclaredExtras = (
  callback: unknown,
  columns: TableExtras.BoundColumns<FieldsInput>
): ReadonlyArray<TableExtras.Node> => {
  if (!isFunction(callback)) {
    throw Derive.DeriveColumnError.make({
      message: "Model table extras must be callable.",
      fieldName: "(extras)",
      astTag: "(callback)",
    });
  }
  const result = Reflect.apply(callback, undefined, [columns]);
  if (isDeclaredExtras(result)) return result;
  throw Derive.DeriveColumnError.make({
    message: "Model table extras must return valid PostgreSQL extra nodes.",
    fieldName: "(extras)",
    astTag: "(callback result)",
  });
};

/**
 * Projects one model class into a real, fully typed Drizzle PostgreSQL table.
 *
 * **When to use**
 *
 * Use when a standalone table needs no cross-model reference wiring. Use
 * `schema` when foreign keys, shared enum instances, or relations are involved.
 *
 * **Details**
 *
 * Projection compiles resolved columns, then emits model extras followed by
 * caller-supplied extras through Drizzle's public `pgTable` API.
 *
 * **Gotchas**
 *
 * A standalone enum field creates its own enum instance. Cross-table enum
 * sharing and conflicting-value detection require assembly through `schema`.
 *
 * **Example** (Project a model)
 *
 * ```ts
 * import { getTableName } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { Model } from "@beep/effect-drizzle"
 * import { toPgTable } from "@beep/effect-drizzle/pg"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 * getTableName(toPgTable(User)) // => "user"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
type TableProjectionOptions<M extends AnyModel> = {
  readonly additionalExtras?: AdditionalExtras<M>;
  readonly enums?: EnumRegistry;
  readonly model: M;
};

export function toPgTable<M extends AnyModel>(model: M): TableOf<M>;
export function toPgTable(model: AnyModel): unknown {
  return toPgTableWithOptions({ model });
}

/** @internal */
export function toPgTableWithOptions<M extends AnyModel>(options: TableProjectionOptions<M>): TableOf<M>;
/** @internal */
export function toPgTableWithOptions(options: TableProjectionOptions<AnyModel>): unknown {
  const { additionalExtras, enums, model } = options;
  const builders = reduce(
    Object.entries(model.sql.fields),
    empty<string, PgColumn.DrizzleBuilder>(),
    (builders, [key, input]) => {
      const meta = getOrElse(get(model.sql.columns, key), () => {
        throw Derive.DeriveColumnError.make({
          message: `Metadata for '${key}' was not resolved before projection.`,
          fieldName: key,
          astTag: "(resolved)",
        });
      });
      return set(builders, key, buildColumn(key, meta, Derive.isNullable(Field.from(input).schema), enums));
    }
  );
  const table = pgTable(model.sql.tableName, builders, (columns) => {
    const bound: TableExtras.BoundColumns<FieldsInput> = columns;
    const declared = match(fromUndefinedOr(model.sql.extras), {
      onNone: () => [],
      onSome: (extras) => {
        const nodes = invokeDeclaredExtras(extras, bound);
        const inlinePrimaryKeys = Object.values(model.sql.columns).filter((meta) => meta.primaryKey).length;
        TableExtras.validateNodes(nodes, inlinePrimaryKeys);
        return nodes.map(TableExtras.emit);
      },
    });
    const additional = match(fromUndefinedOr(additionalExtras), {
      onNone: () => [],
      onSome: (extras) => extras(bound),
    });
    return [...declared, ...additional];
  });
  if (additionalExtras === undefined) {
    const config = getTableConfig(table);
    const named = (owner: string, kind: string, name: string | undefined): ReadonlyArray<SchemaName> =>
      name === undefined ? [] : [{ owner, kind, name }];
    validateSchemaNames(
      [
        { owner: "table", kind: "table", name: config.name },
        ...config.indexes.flatMap((value, index) => named(`index:${index}`, "index", value.config.name)),
        ...config.primaryKeys.flatMap((value, index) =>
          named(`primary-key:${index}`, "primary-key constraint", value.getName())
        ),
        ...config.uniqueConstraints.flatMap((value, index) =>
          named(`unique:${index}`, "unique constraint", value.getName())
        ),
        ...config.columns
          .filter((column) => column.primary)
          .map(
            (_, index): SchemaName => ({
              owner: `inline-primary-key:${index}`,
              kind: "primary-key constraint",
              name: `${config.name}_pkey`,
            })
          ),
        ...config.columns
          .filter((column) => column.isUnique)
          .map(
            (column, index): SchemaName => ({
              owner: `inline-unique:${index}`,
              kind: "unique constraint",
              name: column.uniqueName ?? uniqueKeyName(table, [column.name]),
            })
          ),
        ...config.checks.map(
          (value, index): SchemaName => ({ owner: `check:${index}`, kind: "check constraint", name: value.name })
        ),
        ...config.foreignKeys.map(
          (value, index): SchemaName => ({
            owner: `foreign-key:${index}`,
            kind: "foreign-key constraint",
            name: value.getName(),
          })
        ),
      ],
      "pg",
      (message, sourceTable, fieldName) => {
        throw ModelInvariantError.make({ message, fieldName: `${sourceTable}:${fieldName}` });
      }
    );
  }
  return table;
}
