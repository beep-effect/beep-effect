/**
 * Postgres table projection: BSL model → real drizzle `pgTable`.
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
 */
import { Str, Struct } from "@beep/utils";
import { sql } from "drizzle-orm";
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
  SetHasDefault,
  SetHasGenerated,
  SetIdentity,
  SetIsPrimaryKey,
  SetNotNull,
} from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { Match, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Derive from "./derive.ts";
import * as Field from "./Field.ts";
import * as Meta from "./Meta.ts";
import * as PgColumn from "./PgColumn.ts";
import type { AnyModel, FieldsInput } from "./factory.ts";
import * as TableExtras from "./TableExtras.ts";

// ---------------------------------------------------------------------------
// Type-level projection
// ---------------------------------------------------------------------------

type BuilderBase<C extends PgColumn.Spec> = C extends PgColumn.Varchar<number>
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

type NullableOf<I extends Field.Input> = null extends Field.EncodedOf<I>
  ? true
  : false;

type ApplyNotNull<B, Nullable extends boolean> = Nullable extends true
  ? B
  : SetNotNull<B>;
type ApplyPrimaryKey<B, M extends Meta.Meta> = M["primaryKey"] extends true
  ? SetIsPrimaryKey<B>
  : B;
type ApplyDefault<B, M extends Meta.Meta> = M["hasDefault"] extends true
  ? SetHasDefault<B>
  : B;
type ApplyGenerated<B, M extends Meta.Meta> = M["generated"] extends {
  readonly _tag: "sqlExpr" | "unsafeSql";
}
  ? SetHasGenerated<B>
  : B;
type ApplyIdentity<B, M extends Meta.Meta> = M["identity"] extends
  | "always"
  | "byDefault"
  ? SetIdentity<B, M["identity"]>
  : B;

/**
 * Exact Drizzle builder type produced for one BSL field.
 *
 * **Example** (Project a string field builder)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { BuilderFor } from "./table.ts"
 *
 * type StringBuilder = BuilderFor<typeof S.String>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BuilderFor<I extends Field.Input> = ApplyPrimaryKey<
  ApplyIdentity<
    ApplyGenerated<
      ApplyDefault<
        ApplyNotNull<
          Set$Type<
            BuilderBase<Derive.ResolvedColumn<I>>,
            Exclude<Field.EncodedOf<I>, null>
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
 * Key-preserving Drizzle builder projection of a BSL field record.
 *
 * **Example** (Project a builder record)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { BuildersOf } from "./table.ts"
 *
 * type Builders = BuildersOf<{ readonly name: typeof S.String }>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BuildersOf<F extends FieldsInput> = {
  readonly [K in keyof F & string]: BuilderFor<F[K]>;
};

/**
 * Fully typed Drizzle PostgreSQL table projected from a BSL model.
 *
 * **Example** (Name a projected table)
 *
 * ```ts
 * import type { AnyModel } from "./factory.ts"
 * import type { TableOf } from "./table.ts"
 *
 * type Table = TableOf<AnyModel>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TableOf<M extends AnyModel> = PgTableWithColumns<{
  name: string;
  schema: undefined;
  columns: PgBuildColumns<string, BuildersOf<M["bsl"]["fields"]>>;
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
  meta: Meta.Meta,
  nullable: boolean,
  enums: EnumRegistry | undefined
): PgColumn.DrizzleBuilder => {
  const spec = O.getOrElse(O.fromUndefinedOr(meta.column), () => {
    throw Derive.DeriveColumnError.make({
      message: `Column for '${key}' was not resolved before projection.`,
      fieldName: key,
      astTag: "(resolved)",
    });
  });
  const name = O.getOrElse(O.fromUndefinedOr(meta.columnName), () =>
    Str.snakeCase(key)
  );
  const base = PgColumn.Spec.guards.enum(spec)
    ? PgColumn.Enum.toDrizzleBuilder(
        spec,
        name,
        O.flatMap(O.fromUndefinedOr(enums), (registry) =>
          R.get(registry, spec.name)
        ).pipe(O.getOrUndefined)
      )
    : pipe(spec, PgColumn.Spec.toDrizzleBuilder(name, meta.identity));
  const withNullability = nullable ? base : base.notNull();
  const withPrimaryKey = meta.primaryKey
    ? withNullability.primaryKey()
    : withNullability;
  const withUnique = meta.unique ? withPrimaryKey.unique() : withPrimaryKey;
  const withDefault = O.match(O.fromUndefinedOr(meta.default), {
    onNone: () => withUnique,
    onSome: Match.type<Meta.Default>().pipe(
      Match.withReturnType<PgColumn.DrizzleBuilder>(),
      Match.tags({
        value: ({ value }) => withUnique.default(value),
        sqlExpr: ({ expression }) => withUnique.default(expression),
        now: () => withUnique.default(sql`now()`),
        unsafeSql: ({ sql: statement }) =>
          withUnique.default(sql.raw(statement)),
      }),
      Match.exhaustive
    ),
  });
  return Match.value(meta.generated).pipe(
    Match.withReturnType<PgColumn.DrizzleBuilder>(),
    Match.when(false, () => withDefault),
    Match.tags({
      identityAlways: () => withDefault,
      sqlExpr: ({ expression }) => withDefault.generatedAlwaysAs(expression),
      unsafeSql: ({ sql: statement }) =>
        withDefault.generatedAlwaysAs(sql.raw(statement)),
    }),
    Match.exhaustive
  );
};

/**
 * Additional table-extra callback evaluated beside model-declared extras.
 *
 * **Example** (Declare no additional extras)
 *
 * ```ts
 * import type { AnyModel } from "./factory.ts"
 * import type { AdditionalExtras } from "./table.ts"
 *
 * const none: AdditionalExtras<AnyModel> = () => []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AdditionalExtras<M extends AnyModel> = (
  columns: TableExtras.BoundColumns<M["bsl"]["fields"]>
) => ReadonlyArray<PgTableExtraConfigValue>;

const DeclaredExtras = S.Array(TableExtras.Node);

const invokeDeclaredExtras = (
  callback: unknown,
  columns: TableExtras.BoundColumns<FieldsInput>
): ReadonlyArray<TableExtras.Node> => {
  if (!P.isFunction(callback)) {
    throw Derive.DeriveColumnError.make({
      message: "Model table extras must be callable.",
      fieldName: "(extras)",
      astTag: "(callback)",
    });
  }
  return S.decodeUnknownSync(DeclaredExtras)(
    Reflect.apply(callback, undefined, [columns])
  );
};

/**
 * Project a BSL model class into a fully typed Drizzle PostgreSQL table.
 *
 * **Example** (Project a model)
 *
 * ```ts
 * import { getTableName } from "drizzle-orm"
 * import * as S from "effect/Schema"
 * import { Model } from "./factory.ts"
 * import { toPgTable } from "./table.ts"
 *
 * class User extends Model<User>("User")({ name: S.String }) {}
 * console.log(getTableName(toPgTable(User))) // "user"
 * ```
 *
 * @category conversions
 * @since 0.0.0
 */
export function toPgTable<M extends AnyModel>(
  model: M,
  additionalExtras?: AdditionalExtras<M>,
  enums?: EnumRegistry
): TableOf<M>;
export function toPgTable(
  model: AnyModel,
  additionalExtras?: AdditionalExtras<AnyModel>,
  enums?: EnumRegistry
): unknown {
  const builders = A.reduce(
    Struct.entries(model.bsl.fields),
    R.empty<string, PgColumn.DrizzleBuilder>(),
    (builders, [key, input]) => {
      const meta = O.getOrElse(R.get(model.bsl.columns, key), () => {
        throw Derive.DeriveColumnError.make({
          message: `Metadata for '${key}' was not resolved before projection.`,
          fieldName: key,
          astTag: "(resolved)",
        });
      });
      return R.set(
        builders,
        key,
        buildColumn(
          key,
          meta,
          Derive.isNullable(Field.from(input).schema),
          enums
        )
      );
    }
  );
  return pgTable(model.bsl.tableName, builders, (columns) => {
    const bound: TableExtras.BoundColumns<FieldsInput> = columns;
    const declared = O.match(O.fromUndefinedOr(model.bsl.extras), {
      onNone: A.empty<PgTableExtraConfigValue>,
      onSome: (extras) =>
        A.map(invokeDeclaredExtras(extras, bound), TableExtras.emit),
    });
    const additional = O.match(O.fromUndefinedOr(additionalExtras), {
      onNone: A.empty<PgTableExtraConfigValue>,
      onSome: (extras) => extras(bound),
    });
    return A.appendAll(declared, additional);
  });
}
