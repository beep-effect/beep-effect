/**
 * Codecs shared by the OMI scratchpad port.
 *
 * **Details**
 *
 * Column factories that are repeated across models stay in {@link ./Kit.ts}.
 * These helpers cover wire-key renaming, optional fields whose missing key
 * is a non-null default, and JSON columns.
 *
 * @since 0.0.0
 */
import type { PatchedField } from "@beep/effect-drizzle";
import type { Jsonb } from "@beep/effect-drizzle/pg";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import * as R from "effect/Record";
import * as P from "effect/Predicate";
import { Model, Table, optionalNull, pg } from "./Kit.ts";

const snakeKey = (key: string): string => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/**
 * True for a non-null, non-array object.
 *
 * **Example** (Tell objects from arrays)
 *
 * ```ts
 * import { isRecord } from "./Port.ts"
 *
 * console.log(isRecord({ id: "a" })) // true
 * console.log(isRecord(["a"])) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isRecord = (value: unknown): value is { readonly [key: string]: unknown } =>
  P.isObject(value);

type FieldRecord = { readonly [key: string]: unknown };

const isFieldKey = (fields: FieldRecord, key: string): key is string => R.has(fields, key);

type Renamable = {
  readonly fields: FieldRecord;
  pipe(f: (self: Renamable) => Renamable): Renamable;
};

/**
 * Renames camelCase fields to snake_case on the encoded wire.
 *
 * **Details**
 *
 * SQL names stay on `pg.columnName`. This helper is the JSON name. Keys that
 * are already a single word are left unchanged. An empty rename returns the
 * schema itself.
 *
 * **Gotchas**
 *
 * The return type is the input schema type, so the static `Encoded` type
 * still shows camelCase keys. Only the runtime codec reads and writes
 * snake_case.
 *
 * **Example** (Decode a snake_case key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { text } from "./Kit.ts"
 * import { Model, toWire } from "./Port.ts"
 *
 * class Row extends Model<Row>("PortRow")({ createdAt: text("created_at") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(toWire(Row))({ created_at: "now" }))
 * console.log(decoded.createdAt) // "now"
 * ```
 *
 * @see {@link S.encodeKeys} for the Effect helper this wraps.
 * @category codecs
 * @since 0.0.0
 */
export function toWire<S extends Renamable>(schema: S): S;
export function toWire(schema: Renamable): Renamable {
  const mapping: Record<string, string> = {};
  for (const key of R.keys(schema.fields)) {
    if (!isFieldKey(schema.fields, key)) continue;
    const encoded = snakeKey(key);
    if (encoded !== key) mapping[key] = encoded;
  }
  if (R.keys(mapping).length === 0) return schema;
  // encodeKeys widens the encoded keys and still decodes to the same class.
  // @ts-expect-error TS2345 encodeKeys' function is wider than Renamable.pipe's parameter.
  return schema.pipe(S.encodeKeys(mapping));
}

const emptyList = <A>(): ReadonlyArray<A> => [];

/**
 * Field built by {@link optionDefault}: an optional, nullable key decoded to
 * `Option` of the schema type, with a constructor default.
 */
type OptionDefault<Sch extends S.ConstraintDecoder<unknown>> = S.withConstructorDefault<
  S.decodeTo<S.Option<Sch>, S.optionalKey<S.NullOr<Sch>>>
>;

/**
 * Decodes missing as `Some(default)`, null as `None`, and a present value as `Some`.
 *
 * **Details**
 *
 * Python `Optional[T] = default` still accepts null. The non-null default applies
 * only when the key is absent. `None` encodes as null.
 *
 * **Gotchas**
 *
 * Inside a `Model(...)({ ... })` field object, use the pipeable form
 * (`thumbnail: S.String.pipe(optionDefault(() => ""))`) or chain the data-first
 * call with `.pipe(...)`. A bare inline data-first call such as
 * `thumbnail: optionDefault(S.String, () => "")` does not compile: TypeScript
 * reports TS2322 with
 * `BslTypeError<"model field derives an invalid PostgreSQL column name">` on
 * every field of that model, not only on the field written that way.
 * `thumbnail` and `thumbName` on `FileChat` in `Chat.ts` show the shape that
 * compiles.
 *
 * **Example** (Fill a missing flag)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { optionDefault } from "./Port.ts"
 *
 * const Flag = S.Struct({ archived: optionDefault(S.Boolean, () => false) })
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Flag)({}))
 * console.log(O.getOrElse(decoded.archived, () => true)) // false
 * ```
 *
 * **Example** (Pipe a schema into a default)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { optionDefault } from "./Port.ts"
 *
 * const Flag = S.Struct({ archived: S.Boolean.pipe(optionDefault(() => false)) })
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Flag)({ archived: null }))
 * console.log(O.isNone(decoded.archived)) // true
 * ```
 *
 * @see {@link optionalNull} when missing and null are both `None`.
 * @category schemas
 * @since 0.0.0
 */
export const optionDefault: {
  <Sch extends S.ConstraintDecoder<unknown>>(fallback: () => Sch["Type"]): (schema: Sch) => OptionDefault<Sch>;
  <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, fallback: () => Sch["Type"]): OptionDefault<Sch>;
} = dual(
  2,
  <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, fallback: () => Sch["Type"]): OptionDefault<Sch> =>
    S.NullOr(schema).pipe(
      S.optionalKey,
      S.decodeTo(S.Option(schema), {
        decode: SchemaGetter.transformOptional((present) =>
          present.pipe(
            O.match({
              onNone: () => O.some(fallback()),
              onSome: (value) => (value === null ? O.none() : O.some(value)),
            }),
            O.some,
          ),
        ),
        encode: SchemaGetter.transformOptional((present) =>
          present.pipe(
            O.flatten,
            O.match({
              onNone: () => null,
              onSome: (value) => value,
            }),
            O.some,
          ),
        ),
      }),
      S.withConstructorDefault(Effect.sync(() => O.some(fallback()))),
    ),
);

/**
 * Schema whose encoded side is an object or null, the shape a JSONB column stores.
 *
 * @see {@link jsonColumn} for the column factory.
 * @category type-level
 * @since 0.0.0
 */
export type JsonSchema = S.Top & { readonly Encoded: object | null };

/**
 * Named JSONB column over `Sch`, the field the JSON column factories return.
 */
type JsonColumn<Sch extends S.Top> = PatchedField<
  PatchedField<Sch, { readonly column: Jsonb }>,
  { readonly columnName: string }
>;

/**
 * Field built by {@link optionalJsonColumn}: {@link optionalNull} over `Sch`,
 * stored as a named JSONB column.
 */
type OptionalJsonColumn<Sch extends S.ConstraintDecoder<unknown>> = JsonColumn<
  S.withConstructorDefault<S.decodeTo<S.Option<S.toType<Sch>>, S.optionalKey<S.NullOr<Sch>>>>
>;

/**
 * JSONB column for a nested model or object, named by the given SQL column.
 *
 * **Details**
 *
 * The schema is used as-is for decoding. Only the Drizzle column metadata
 * changes, so the field stays required.
 *
 * **Example** (Store a nested object)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { jsonColumn, Model } from "./Port.ts"
 *
 * class Row extends Model<Row>("JsonColumnRow")({
 *   payload: jsonColumn(S.Struct({ id: S.String }), "payload"),
 * }) {}
 * const decoded = S.decodeUnknownSync(Row)({ payload: { id: "p1" } })
 *
 * console.log(decoded.payload.id) // "p1"
 * ```
 *
 * **Example** (Pipe a schema into a JSONB column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { jsonColumn, Model } from "./Port.ts"
 *
 * class Row extends Model<Row>("JsonColumnPipeRow")({
 *   payload: S.Struct({ id: S.String }).pipe(jsonColumn("payload")),
 * }) {}
 * const decoded = S.decodeUnknownSync(Row)({ payload: { id: "p1" } })
 *
 * console.log(decoded.payload.id) // "p1"
 * ```
 *
 * @see {@link optionalJsonColumn} when missing and null become `None`.
 * @category factories
 * @since 0.0.0
 */
export const jsonColumn: {
  (column: string): <Sch extends S.Top>(schema: Sch) => JsonColumn<Sch>;
  <Sch extends S.Top>(schema: Sch, column: string): JsonColumn<Sch>;
} = dual(2, <Sch extends S.Top>(schema: Sch, column: string): JsonColumn<Sch> => {
  // pg.jsonb's encoded-object proof does not survive a generic schema parameter.
  // The explicit annotation keeps the field type when the overload check fails.
  const jsonb: PatchedField<Sch, { readonly column: Jsonb }> =
    // @ts-expect-error TS2345 — callers pass object or array schemas; the column is jsonb.
    pg.jsonb()(schema);
  return jsonb.pipe(pg.columnName(column));
});

/**
 * Optional JSONB column. Missing and null become `None`.
 *
 * **Example** (Decode a null object)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalJsonColumn } from "./Port.ts"
 *
 * class Row extends Model<Row>("OptionalJsonRow")({
 *   payload: optionalJsonColumn(S.Struct({ id: S.String }), "payload"),
 * }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ payload: null }))
 * console.log(O.isNone(decoded.payload)) // true
 * ```
 *
 * **Example** (Pipe a schema into an optional JSONB column)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalJsonColumn } from "./Port.ts"
 *
 * class Row extends Model<Row>("OptionalJsonPipeRow")({
 *   payload: S.Struct({ id: S.String }).pipe(optionalJsonColumn("payload")),
 * }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({}))
 * console.log(O.isNone(decoded.payload)) // true
 * ```
 *
 * @see {@link jsonColumn} for the required form.
 * @category factories
 * @since 0.0.0
 */
export const optionalJsonColumn: {
  (column: string): <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch) => OptionalJsonColumn<Sch>;
  <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, column: string): OptionalJsonColumn<Sch>;
} = dual(
  2,
  <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, column: string): OptionalJsonColumn<Sch> => {
    const wrapped = optionalNull(schema);
    // The explicit annotation keeps the field type when the overload check fails.
    const jsonb: PatchedField<typeof wrapped, { readonly column: Jsonb }> =
      // @ts-expect-error TS2345 — optionalNull keeps an object or array carrier; the column is jsonb.
      pg.jsonb()(wrapped);
    return jsonb.pipe(pg.columnName(column));
  },
);

/**
 * JSONB array that constructs as `[]` when omitted.
 *
 * **Details**
 *
 * The default is construction-only. Decode still requires the key, matching
 * {@link S.withConstructorDefault}.
 *
 * **Example** (Construct an empty list)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Model, jsonList } from "./Port.ts"
 *
 * class Row extends Model<Row>("JsonListRow")({ labels: jsonList(S.String, "labels") }) {}
 * console.log(Row.make({}).labels.length) // 0
 * ```
 *
 * **Example** (Pipe an element schema into a list)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Model, jsonList } from "./Port.ts"
 *
 * class Row extends Model<Row>("JsonListPipeRow")({ labels: S.String.pipe(jsonList("labels")) }) {}
 * console.log(Row.make({}).labels.length) // 0
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const jsonList: {
  (column: string): <A extends S.Top>(schema: A) => JsonColumn<S.withConstructorDefault<S.$Array<A>>>;
  <A extends S.Top>(schema: A, column: string): JsonColumn<S.withConstructorDefault<S.$Array<A>>>;
} = dual(
  2,
  <A extends S.Top>(schema: A, column: string): JsonColumn<S.withConstructorDefault<S.$Array<A>>> =>
    S.Array(schema).pipe(
      S.withConstructorDefault(Effect.sync(() => emptyList<A["Type"]>())),
      pg.jsonb(),
      pg.columnName(column),
    ),
);

const intColumn = (schema: S.Int, column: string) => schema.pipe(pg.integer(), pg.columnName(column));

const finiteColumn = (schema: S.Finite, column: string) => schema.pipe(pg.doublePrecision(), pg.columnName(column));

/**
 * Named `integer` column over `S.Int`, the field {@link intBetween} and
 * {@link intAtLeast} return.
 */
type IntColumn = ReturnType<typeof intColumn>;

/**
 * Named `double precision` column over `S.Finite`, the field
 * {@link finiteBetween} and {@link finiteAtLeast} return.
 */
type FiniteColumn = ReturnType<typeof finiteColumn>;

/**
 * Inclusive integer column.
 *
 * **Example** (Bound a counter)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, intBetween } from "./Port.ts"
 *
 * class Row extends Model<Row>("IntBetweenRow")({ count: intBetween("count", 1, 3) }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ count: 2 }))
 * console.log(decoded.count) // 2
 * ```
 *
 * @see {@link betweenCheck} for the matching SQL check.
 * @category factories
 * @since 0.0.0
 */
export const intBetween: {
  (minimum: number, maximum: number): (column: string) => IntColumn;
  (column: string, minimum: number, maximum: number): IntColumn;
} = dual(
  3,
  (column: string, minimum: number, maximum: number): IntColumn =>
    intColumn(S.Int.check(S.isBetween({ minimum, maximum })), column),
);

/**
 * Inclusive finite column.
 *
 * **Example** (Bound a coordinate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, finiteBetween } from "./Port.ts"
 *
 * class Row extends Model<Row>("FiniteBetweenRow")({ latitude: finiteBetween("latitude", -90, 90) }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ latitude: 1.5 }))
 * console.log(decoded.latitude) // 1.5
 * ```
 *
 * @see {@link betweenCheck} for the matching SQL check.
 * @category factories
 * @since 0.0.0
 */
export const finiteBetween: {
  (minimum: number, maximum: number): (column: string) => FiniteColumn;
  (column: string, minimum: number, maximum: number): FiniteColumn;
} = dual(
  3,
  (column: string, minimum: number, maximum: number): FiniteColumn =>
    finiteColumn(S.Finite.check(S.isBetween({ minimum, maximum })), column),
);

/**
 * Integer column with a lower bound.
 *
 * **Example** (Require a positive count)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, intAtLeast } from "./Port.ts"
 *
 * class Row extends Model<Row>("IntAtLeastRow")({ count: intAtLeast("count", 1) }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ count: 1 }))
 * console.log(decoded.count) // 1
 * ```
 *
 * @see {@link atLeastCheck} for the matching SQL check.
 * @category factories
 * @since 0.0.0
 */
export const intAtLeast: {
  (minimum: number): (column: string) => IntColumn;
  (column: string, minimum: number): IntColumn;
} = dual(
  2,
  (column: string, minimum: number): IntColumn => intColumn(S.Int.check(S.isGreaterThanOrEqualTo(minimum)), column),
);

/**
 * Finite column with a lower bound.
 *
 * **Example** (Reject a negative duration)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, finiteAtLeast } from "./Port.ts"
 *
 * class Row extends Model<Row>("FiniteAtLeastRow")({ accuracy: finiteAtLeast("accuracy", 0) }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ accuracy: 0 }))
 * console.log(decoded.accuracy) // 0
 * ```
 *
 * @see {@link atLeastCheck} for the matching SQL check.
 * @category factories
 * @since 0.0.0
 */
export const finiteAtLeast: {
  (minimum: number): (column: string) => FiniteColumn;
  (column: string, minimum: number): FiniteColumn;
} = dual(
  2,
  (column: string, minimum: number): FiniteColumn =>
    finiteColumn(S.Finite.check(S.isGreaterThanOrEqualTo(minimum)), column),
);

const rawNumber = (value: number) => sql.raw(`${value}`);

const checkedName = (column: string, suffix: string): string => `${column}_${suffix}`;

/**
 * Table check bound to one column, the value the SQL check factories return.
 */
type ColumnCheck = (column: ExtraConfigColumn) => Table.Check;

/**
 * Inclusive bounds on a jsonb array length, read by {@link jsonbArrayLengthCheck}.
 */
type JsonbArrayLengthBounds = { readonly minimum?: number; readonly maximum?: number };

/**
 * SQL check `minimum <= column <= maximum`.
 *
 * **Example** (Bound an integer column)
 *
 * ```ts
 * import { toPgTable } from "@beep/effect-drizzle/pg"
 * import { getTableConfig, PgDialect } from "drizzle-orm/pg-core"
 * import * as S from "effect/Schema"
 * import { betweenCheck, Model, pg } from "./Port.ts"
 *
 * class Row extends Model<Row>("CountRow")({ count: S.Int.pipe(pg.integer(), pg.columnName("count")) }, (columns) => [
 *   betweenCheck("count", 1, 3)(columns.count),
 * ]) {}
 * const [check] = getTableConfig(Row.pipe(toPgTable)).checks
 *
 * console.log(check?.name) // "count_between"
 * console.log(check && new PgDialect().sqlToQuery(check.value).sql) // "count_row"."count" >= 1 and "count_row"."count" <= 3
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const betweenCheck: {
  (minimum: number, maximum: number): (columnName: string) => ColumnCheck;
  (columnName: string, minimum: number, maximum: number): ColumnCheck;
} = dual(3, (columnName: string, minimum: number, maximum: number): ColumnCheck => {
  const name = checkedName(columnName, "between");
  return (column) =>
    Table.check(name)(
      sql<boolean>`${column} >= ${rawNumber(minimum)} and ${column} <= ${rawNumber(maximum)}`,
    );
});

/**
 * SQL check `column >= minimum`.
 *
 * **Example** (Keep a count non-negative)
 *
 * ```ts
 * import { toPgTable } from "@beep/effect-drizzle/pg"
 * import { getTableConfig, PgDialect } from "drizzle-orm/pg-core"
 * import * as S from "effect/Schema"
 * import { atLeastCheck, Model, pg } from "./Port.ts"
 *
 * class Row extends Model<Row>("CountRow")({ count: S.Int.pipe(pg.integer(), pg.columnName("count")) }, (columns) => [
 *   atLeastCheck("count", 0)(columns.count),
 * ]) {}
 * const [check] = getTableConfig(Row.pipe(toPgTable)).checks
 *
 * console.log(check?.name) // "count_min"
 * console.log(check && new PgDialect().sqlToQuery(check.value).sql) // "count_row"."count" >= 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const atLeastCheck: {
  (minimum: number): (columnName: string) => ColumnCheck;
  (columnName: string, minimum: number): ColumnCheck;
} = dual(2, (columnName: string, minimum: number): ColumnCheck => {
  const name = checkedName(columnName, "min");
  return (column) => Table.check(name)(sql<boolean>`${column} >= ${rawNumber(minimum)}`);
});

/**
 * SQL check on the length of a jsonb array column.
 *
 * **Example** (Cap an array column)
 *
 * ```ts
 * import { toPgTable } from "@beep/effect-drizzle/pg"
 * import { getTableConfig, PgDialect } from "drizzle-orm/pg-core"
 * import * as S from "effect/Schema"
 * import { jsonbArrayLengthCheck, jsonColumn, Model } from "./Port.ts"
 *
 * class Row extends Model<Row>("SectionRow")({ sections: jsonColumn(S.Array(S.String), "sections") }, (columns) => [
 *   jsonbArrayLengthCheck("sections", { maximum: 12 })(columns.sections),
 * ]) {}
 * const [check] = getTableConfig(Row.pipe(toPgTable)).checks
 *
 * console.log(check?.name) // "sections_alen"
 * console.log(check && new PgDialect().sqlToQuery(check.value).sql) // jsonb_array_length("section_row"."sections") <= 12
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const jsonbArrayLengthCheck: {
  (bounds: JsonbArrayLengthBounds): (columnName: string) => ColumnCheck;
  (columnName: string, bounds: JsonbArrayLengthBounds): ColumnCheck;
} = dual(2, (columnName: string, bounds: JsonbArrayLengthBounds): ColumnCheck => {
  const name = checkedName(columnName, "alen");
  return (column) => {
    const minimum = bounds.minimum;
    const maximum = bounds.maximum;
    if (minimum !== undefined && maximum !== undefined) {
      return Table.check(name)(
        sql<boolean>`jsonb_array_length(${column}) >= ${rawNumber(minimum)} and jsonb_array_length(${column}) <= ${rawNumber(maximum)}`,
      );
    }
    if (minimum !== undefined) {
      return Table.check(name)(sql<boolean>`jsonb_array_length(${column}) >= ${rawNumber(minimum)}`);
    }
    return Table.check(name)(sql<boolean>`jsonb_array_length(${column}) <= ${rawNumber(maximum ?? 0)}`);
  };
});

const boolDefaultColumn = (column: string, fallback: boolean) =>
  S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(fallback)), pg.boolean(), pg.columnName(column));

const textDefaultColumn = (column: string, fallback: string) =>
  S.String.pipe(S.withConstructorDefault(Effect.succeed(fallback)), pg.text(), pg.columnName(column));

const finiteDefaultColumn = (column: string, fallback: number) =>
  S.Finite.pipe(
    S.withConstructorDefault(Effect.succeed(fallback)),
    pg.doublePrecision(),
    pg.columnName(column),
  );

const intDefaultColumn = (column: string, fallback: number) =>
  S.Int.pipe(S.withConstructorDefault(Effect.succeed(fallback)), pg.integer(), pg.columnName(column));

/**
 * Named `boolean` column with a constructor default, the field {@link boolDefault} returns.
 */
type BoolDefaultColumn = ReturnType<typeof boolDefaultColumn>;

/**
 * Named `text` column with a constructor default, the field {@link textDefault} returns.
 */
type TextDefaultColumn = ReturnType<typeof textDefaultColumn>;

/**
 * Named `double precision` column with a constructor default, the field
 * {@link finiteDefault} returns.
 */
type FiniteDefaultColumn = ReturnType<typeof finiteDefaultColumn>;

/**
 * Named `integer` column with a constructor default, the field {@link intDefault} returns.
 */
type IntDefaultColumn = ReturnType<typeof intDefaultColumn>;

/**
 * Boolean column that constructs as `fallback` when omitted.
 *
 * **Example** (Construct a false flag)
 *
 * ```ts
 * import { Model, boolDefault } from "./Port.ts"
 *
 * class Row extends Model<Row>("BoolDefaultRow")({ starred: boolDefault("starred", false) }) {}
 * console.log(Row.make({}).starred) // false
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const boolDefault: {
  (fallback: boolean): (column: string) => BoolDefaultColumn;
  (column: string, fallback: boolean): BoolDefaultColumn;
} = dual(2, boolDefaultColumn);

/**
 * Text column that constructs as `fallback` when omitted.
 *
 * **Example** (Construct an empty overview)
 *
 * ```ts
 * import { Model, textDefault } from "./Port.ts"
 *
 * class Row extends Model<Row>("TextDefaultRow")({ overview: textDefault("overview", "") }) {}
 * console.log(Row.make({}).overview) // ""
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const textDefault: {
  (fallback: string): (column: string) => TextDefaultColumn;
  (column: string, fallback: string): TextDefaultColumn;
} = dual(2, textDefaultColumn);

/**
 * Finite column that constructs as `fallback` when omitted.
 *
 * **Example** (Construct a zero score)
 *
 * ```ts
 * import { Model, finiteDefault } from "./Port.ts"
 *
 * class Row extends Model<Row>("FiniteDefaultRow")({ value: finiteDefault("value", 0) }) {}
 * console.log(Row.make({}).value) // 0
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const finiteDefault: {
  (fallback: number): (column: string) => FiniteDefaultColumn;
  (column: string, fallback: number): FiniteDefaultColumn;
} = dual(2, finiteDefaultColumn);

/**
 * Integer column that constructs as `fallback` when omitted.
 *
 * **Example** (Construct a default duration)
 *
 * ```ts
 * import { Model, intDefault } from "./Port.ts"
 *
 * class Row extends Model<Row>("IntDefaultRow")({ duration: intDefault("duration", 30) }) {}
 * console.log(Row.make({}).duration) // 30
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const intDefault: {
  (fallback: number): (column: string) => IntDefaultColumn;
  (column: string, fallback: number): IntDefaultColumn;
} = dual(2, intDefaultColumn);

export { Model, optionalNull, pg, Table };
