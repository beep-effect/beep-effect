/**
 * Projects SQLite models onto real Drizzle `sqliteTable` builders.
 *
 * Encoded carriers, SQLite metadata, generated enum checks, and table extras
 * share one projection path used by standalone tables and schema assembly.
 *
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- pg/sqlite are deliberately mirrored dialect implementations; shared logic lives in src/core and the remaining parallelism is per-dialect vocabulary that must evolve independently (doc 14 family; review at next dialect addition)
import { is as isDrizzleEntity, sql } from "drizzle-orm";
import {
  check,
  getTableConfig,
  SQLiteColumn,
  SQLiteDialect,
  sqliteTable,
  uniqueKeyName,
} from "drizzle-orm/sqlite-core";
import { isArray, reduce } from "effect/Array";
import {
  exhaustive,
  tags as matchTags,
  type as matchType,
  value as matchValue,
  when as matchWhen,
  withReturnType,
} from "effect/Match";
import { fromUndefinedOr, getOrElse, match } from "effect/Option";
import { hasProperty, isFunction } from "effect/Predicate";
import { empty, get, set } from "effect/Record";
import { validateSchemaNames } from "../core/assembly.ts";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import { ModelInvariantError } from "../core/model.ts";
import { snakeCase } from "../internal/case.ts";
import * as SqliteColumn from "./Column.ts";
import * as Derive from "./derive.ts";
import * as TableExtras from "./extras.ts";
import type { $Type, BuildColumns, HasDefault, HasGenerated, IsPrimaryKey, NotNull } from "drizzle-orm/column-builder";
import type {
  SQLiteBigIntBuilder,
  SQLiteBlobBufferBuilder,
  SQLiteBlobJsonBuilder,
  SQLiteBooleanBuilder,
  SQLiteIntegerBuilder,
  SQLiteNumericBigIntBuilder,
  SQLiteNumericNumberBuilder,
  SQLiteRealBuilder,
  SQLiteTableExtraConfigValue,
  SQLiteTableWithColumns,
  SQLiteTextBuilder,
  SQLiteTextJsonBuilder,
  SQLiteTimestampBuilder,
} from "drizzle-orm/sqlite-core";
import type { SchemaName } from "../core/assembly.ts";
import type { AnyModel, FieldsInput } from "./model.ts";

const sqliteDialect = new SQLiteDialect();
const assertSchemaExpression = (expression: import("drizzle-orm").SQL, context: string): void =>
  Meta.assertNoSqlParameters(sqliteDialect.sqlToQuery(expression).params, context);

type BuilderBase<C extends SqliteColumn.Spec> =
  C extends SqliteColumn.Text<infer Mode>
    ? Mode extends "json"
      ? SQLiteTextJsonBuilder
      : SQLiteTextBuilder<[string, ...string[]]>
    : C extends SqliteColumn.Enum<infer Value>
      ? SQLiteTextBuilder<[Value, ...Value[]]>
      : C extends SqliteColumn.Integer<infer Mode>
        ? Mode extends "number"
          ? SQLiteIntegerBuilder
          : Mode extends "boolean"
            ? SQLiteBooleanBuilder
            : SQLiteTimestampBuilder
        : C extends SqliteColumn.Real
          ? SQLiteRealBuilder
          : C extends SqliteColumn.Blob<infer Mode>
            ? Mode extends "buffer"
              ? SQLiteBlobBufferBuilder
              : Mode extends "bigint"
                ? SQLiteBigIntBuilder
                : SQLiteBlobJsonBuilder
            : C extends SqliteColumn.Numeric<infer Mode>
              ? Mode extends "number"
                ? SQLiteNumericNumberBuilder
                : SQLiteNumericBigIntBuilder
              : never;

type NullableOf<I extends Field.Input> = null extends Field.EncodedOf<I> ? true : false;
type ApplyNotNull<B, Nullable extends boolean> = Nullable extends true ? B : NotNull<B>;
type ApplyDefault<B, M extends Meta.Meta> = M["hasDefault"] extends true ? HasDefault<B> : B;
type ApplyGenerated<B, M extends Meta.Meta> = M["generated"] extends {
  readonly _tag: "sqlExpr" | "unsafeSql";
}
  ? HasGenerated<B>
  : B;
type ApplyPrimaryKey<B, C extends SqliteColumn.Spec, M extends Meta.Meta> = M["primaryKey"] extends true
  ? C extends SqliteColumn.Integer
    ? IsPrimaryKey<HasDefault<NotNull<B>>>
    : IsPrimaryKey<B>
  : B;

/**
 * Projects one schema-owned field to its exact Drizzle SQLite builder type.
 *
 * **Details**
 *
 * Encoded carrier, nullability, defaults, generation, and primary-key state
 * become the Drizzle brands consumed by model inference.
 *
 * **Example** (Project a SQLite text builder)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { BuilderFor } from "@beep/effect-drizzle/sqlite"
 *
 * type StringBuilder = BuilderFor<typeof String>
 * // => non-null SQLiteTextBuilder with string data
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export type BuilderFor<I extends Field.Input> = ApplyPrimaryKey<
  ApplyGenerated<
    ApplyDefault<
      ApplyNotNull<$Type<BuilderBase<Derive.ResolvedColumn<I>>, Exclude<Field.EncodedOf<I>, null>>, NullableOf<I>>,
      Field.MetaFrom<I>
    >,
    Field.MetaFrom<I>
  >,
  Derive.ResolvedColumn<I>,
  Field.MetaFrom<I>
>;

/**
 * Projects a SQLite field record to key-preserving Drizzle builder types.
 *
 * **Example** (Project SQLite builders)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import type { BuildersOf } from "@beep/effect-drizzle/sqlite"
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
 * Projects one model type to its complete Drizzle SQLite table type.
 *
 * **Details**
 *
 * The result preserves model field keys and every builder brand used by
 * `$inferSelect` and `$inferInsert`.
 *
 * **Example** (Name a projected SQLite table)
 *
 * ```ts
 * import type { AnyModel, TableOf } from "@beep/effect-drizzle/sqlite"
 *
 * type Table = TableOf<AnyModel>
 * type Dialect = Table["_"]["dialect"] // => "sqlite"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type TableOf<M extends AnyModel> = SQLiteTableWithColumns<{
  name: string;
  schema: undefined;
  columns: BuildColumns<string, BuildersOf<M["sql"]["fields"]>, "sqlite">;
  dialect: "sqlite";
}>;

const buildColumn = (
  key: string,
  meta: Meta.Meta<SqliteColumn.Spec>,
  nullable: boolean
): SqliteColumn.DrizzleBuilder => {
  if (meta.dimensions !== 0) {
    throw Derive.DeriveColumnError.make({
      message: `SQLite projector rejects array dimensions on '${key}'.`,
      fieldName: key,
      astTag: "(dimensions)",
    });
  }
  const spec = getOrElse(fromUndefinedOr(meta.column), () => {
    throw Derive.DeriveColumnError.make({
      message: `Column for '${key}' was not resolved before projection.`,
      fieldName: key,
      astTag: "(resolved)",
    });
  });
  const name = getOrElse(fromUndefinedOr(meta.columnName), () => snakeCase(key));
  const base = SqliteColumn.Spec.toDrizzleBuilder(spec, name);
  const withNullability = nullable ? base : base.notNull();
  const withPrimaryKey = meta.primaryKey
    ? meta.identity === "byDefault"
      ? withNullability.primaryKey({ autoIncrement: true })
      : withNullability.primaryKey()
    : withNullability;
  const withUnique = meta.unique ? withPrimaryKey.unique() : withPrimaryKey;
  const withDefault = match(fromUndefinedOr(meta.default), {
    onNone: () => withUnique,
    onSome: matchType<Meta.Default>().pipe(
      withReturnType<SqliteColumn.DrizzleBuilder>(),
      matchTags({
        value: ({ value }) => withUnique.default(value),
        sqlExpr: ({ expression }) => {
          assertSchemaExpression(expression, `SQLite default expression for '${key}'`);
          return withUnique.default(expression);
        },
        now: () => withUnique.default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
        unsafeSql: ({ sql: statement }) => withUnique.default(sql.raw(statement)),
      }),
      exhaustive
    ),
  });
  return matchValue(meta.generated).pipe(
    withReturnType<SqliteColumn.DrizzleBuilder>(),
    matchWhen(false, () => withDefault),
    matchTags({
      identityAlways: () => withDefault,
      sqlExpr: ({ expression }) => {
        assertSchemaExpression(expression, `SQLite generated expression for '${key}'`);
        return withDefault.generatedAlwaysAs(expression, { mode: "stored" });
      },
      unsafeSql: ({ sql: statement }) => withDefault.generatedAlwaysAs(sql.raw(statement), { mode: "stored" }),
    }),
    exhaustive
  );
};

/**
 * Adds assembly-owned Drizzle extras beside a model's declared SQLite extras.
 *
 * **Details**
 *
 * Automatic enum checks run first, model extras second, and additional extras
 * last. Schema assembly uses this seam for resolved foreign keys.
 *
 * **Example** (Declare no additional SQLite extras)
 *
 * ```ts
 * import type { AdditionalExtras, AnyModel } from "@beep/effect-drizzle/sqlite"
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
) => ReadonlyArray<SQLiteTableExtraConfigValue>;

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
    message: "Model table extras must return valid SQLite extra nodes.",
    fieldName: "(extras)",
    astTag: "(callback result)",
  });
};

const enumChecks = (
  model: AnyModel,
  columns: TableExtras.BoundColumns<FieldsInput>
): ReadonlyArray<SQLiteTableExtraConfigValue> =>
  Object.entries(model.sql.columns).flatMap(([key, meta]) => {
    if (!SqliteColumn.Spec.guards.enum(meta.column) || !hasProperty(columns, key)) return [];
    const column = columns[key];
    if (!isDrizzleEntity(column, SQLiteColumn)) return [];
    const values = sql.join(
      meta.column.values.map((value) => sql.raw(`'${value.replaceAll("'", "''")}'`)),
      sql`, `
    );
    return [check(`${model.sql.tableName}_${snakeCase(key)}_enum_check`, sql`${column} in (${values})`)];
  });

/**
 * Projects one model class into a real, fully typed Drizzle SQLite table.
 *
 * **When to use**
 *
 * Use when a standalone table needs no cross-model reference wiring. Use
 * `schema` when foreign keys or RQBv2 relations are involved.
 *
 * **Details**
 *
 * Projection compiles storage classes, emits one `CHECK` per enum field, then
 * appends model-declared and caller-supplied table extras.
 *
 * **Gotchas**
 *
 * SQLite enums are table-local checks rather than shared schema objects, so the
 * same logical enum used on multiple tables produces multiple constraints.
 * Arrays are rejected before projection because SQLite has no array columns.
 *
 * **Example** (Project a SQLite model)
 *
 * ```ts
 * import { getTableName } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { Model, toSqliteTable } from "@beep/effect-drizzle/sqlite"
 *
 * class User extends Model<User>("User")({ name: String }) {}
 *
 * getTableName(toSqliteTable(User)) // => "user"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
type TableProjectionOptions<M extends AnyModel> = {
  readonly additionalExtras?: AdditionalExtras<M>;
  readonly model: M;
};

export function toSqliteTable<M extends AnyModel>(model: M): TableOf<M>;
export function toSqliteTable(model: AnyModel): unknown {
  return toSqliteTableWithOptions({ model });
}

/** @internal */
export function toSqliteTableWithOptions<M extends AnyModel>(options: TableProjectionOptions<M>): TableOf<M>;
/** @internal */
export function toSqliteTableWithOptions(options: TableProjectionOptions<AnyModel>): unknown {
  const { additionalExtras, model } = options;
  const builders = reduce(
    Object.entries(model.sql.fields),
    empty<string, SqliteColumn.DrizzleBuilder>(),
    (builders, [key, input]) => {
      const meta = getOrElse(get(model.sql.columns, key), () => {
        throw Derive.DeriveColumnError.make({
          message: `Metadata for '${key}' was not resolved before projection.`,
          fieldName: key,
          astTag: "(resolved)",
        });
      });
      return set(builders, key, buildColumn(key, meta, Derive.isNullable(Field.from(input).schema)));
    }
  );
  const table = sqliteTable(model.sql.tableName, builders, (columns) => {
    const bound: TableExtras.BoundColumns<FieldsInput> = columns;
    const automatic = enumChecks(model, bound);
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
    return [...automatic, ...declared, ...additional];
  });
  if (additionalExtras === undefined) {
    const config = getTableConfig(table);
    const named = (owner: string, kind: string, name: string | undefined): ReadonlyArray<SchemaName> =>
      name === undefined ? [] : [{ owner, kind, name }];
    validateSchemaNames(
      [
        { owner: "table", kind: "table", name: config.name },
        ...config.indexes.map(
          (value, index): SchemaName => ({ owner: `index:${index}`, kind: "index", name: value.config.name })
        ),
        ...config.primaryKeys.flatMap((value, index) =>
          named(`primary-key:${index}`, "primary-key constraint", value.getName())
        ),
        ...config.uniqueConstraints.map(
          (value, index): SchemaName => ({ owner: `unique:${index}`, kind: "unique constraint", name: value.getName() })
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
      "sqlite",
      (message, sourceTable, fieldName) => {
        throw ModelInvariantError.make({ message, fieldName: `${sourceTable}:${fieldName}` });
      }
    );
  }
  return table;
}
