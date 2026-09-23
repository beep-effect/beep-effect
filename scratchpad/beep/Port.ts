/**
 * Codecs shared by the OMI scratchpad port.
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
import * as O from "effect/Option";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
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
  typeof value === "object" && value !== null && !Array.isArray(value);

type FieldRecord = { readonly [key: string]: unknown };

const isFieldKey = (fields: FieldRecord, key: string): key is string => Object.hasOwn(fields, key);

/**
 * Renames camelCase fields to snake_case on the encoded wire.
 *
 * **Details**
 *
 * SQL names stay on `pg.columnName`. This helper is the JSON name. Keys that
 * are already a single word are left unchanged. An empty rename returns the
 * schema itself.
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
type Renamable = {
  readonly fields: FieldRecord;
  pipe(f: (self: Renamable) => Renamable): Renamable;
};

export function toWire<S extends Renamable>(schema: S): S;
export function toWire(schema: Renamable): Renamable {
  const mapping: Record<string, string> = {};
  for (const key of Object.keys(schema.fields)) {
    if (!isFieldKey(schema.fields, key)) continue;
    const encoded = snakeKey(key);
    if (encoded !== key) mapping[key] = encoded;
  }
  if (Object.keys(mapping).length === 0) return schema;
  // encodeKeys widens the encoded keys and still decodes to the same class.
  // @ts-expect-error TS2345 encodeKeys' function is wider than Renamable.pipe's parameter.
  return schema.pipe(S.encodeKeys(mapping));
}

const emptyList = <A>(): ReadonlyArray<A> => [];

/**
 * Decodes missing as `Some(default)`, null as `None`, and a present value as `Some`.
 *
 * **Details**
 *
 * Python `Optional[T] = default` still accepts null. The non-null default applies
 * only when the key is absent. `None` encodes as null.
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
 * @see {@link optionalNull} when missing and null are both `None`.
 * @category schemas
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Schema and fallback are co-primary inputs, and neither is a pipeable value.
export const optionDefault = <Sch extends S.ConstraintDecoder<unknown>>(
  schema: Sch,
  fallback: () => Sch["Type"],
) =>
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
  );

/**
 * JSONB column for a nested model or object.
 *
 * **Example** (Store a nested object)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { jsonColumn } from "./Port.ts"
 *
 * console.log(jsonColumn(S.Struct({ id: S.String }), "payload").meta.column?.kind) // "jsonb"
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export type JsonSchema = S.Top & { readonly Encoded: object | null };

// @effect-diagnostics-next-line missingPipeableSignature:off -- Schema and column name are co-primary inputs, and neither is a pipeable value.
export const jsonColumn = <Sch extends S.Top>(schema: Sch, column: string) => {
  // pg.jsonb's encoded-object proof does not survive a generic schema parameter.
  // The explicit annotation keeps the field type when the overload check fails.
  const jsonb: PatchedField<Sch, { readonly column: Jsonb }> =
    // @ts-expect-error TS2345 — callers pass object or array schemas; the column is jsonb.
    pg.jsonb()(schema);
  return jsonb.pipe(pg.columnName(column));
};

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
 * @see {@link jsonColumn} for the required form.
 * @category factories
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Schema and column name are co-primary inputs, and neither is a pipeable value.
export const optionalJsonColumn = <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, column: string) => {
  const wrapped = optionalNull(schema);
  // The explicit annotation keeps the field type when the overload check fails.
  const jsonb: PatchedField<typeof wrapped, { readonly column: Jsonb }> =
    // @ts-expect-error TS2345 — optionalNull keeps an object or array carrier; the column is jsonb.
    pg.jsonb()(wrapped);
  return jsonb.pipe(pg.columnName(column));
};

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
 * @category factories
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Schema and column name are co-primary inputs, and neither is a pipeable value.
export const jsonList = <A extends S.Top>(schema: A, column: string) =>
  S.Array(schema).pipe(
    S.withConstructorDefault(Effect.sync(() => emptyList<A["Type"]>())),
    pg.jsonb(),
    pg.columnName(column),
  );

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
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bounds are co-primary inputs, and neither is a pipeable value.
export const intBetween = (column: string, minimum: number, maximum: number) =>
  S.Int.check(S.isBetween({ minimum, maximum })).pipe(pg.integer(), pg.columnName(column));

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
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bounds are co-primary inputs, and neither is a pipeable value.
export const finiteBetween = (column: string, minimum: number, maximum: number) =>
  S.Finite.check(S.isBetween({ minimum, maximum })).pipe(pg.doublePrecision(), pg.columnName(column));

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
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bound are co-primary inputs, and neither is a pipeable value.
export const intAtLeast = (column: string, minimum: number) =>
  S.Int.check(S.isGreaterThanOrEqualTo(minimum)).pipe(pg.integer(), pg.columnName(column));

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
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bound are co-primary inputs, and neither is a pipeable value.
export const finiteAtLeast = (column: string, minimum: number) =>
  S.Finite.check(S.isGreaterThanOrEqualTo(minimum)).pipe(pg.doublePrecision(), pg.columnName(column));

const rawNumber = (value: number) => sql.raw(`${value}`);

const checkedName = (column: string, suffix: string): string => `${column}_${suffix}`;

/**
 * SQL check `minimum <= column <= maximum`.
 *
 * **Example** (Name a between check)
 *
 * ```ts
 * import { betweenCheck } from "./Port.ts"
 *
 * console.log(typeof betweenCheck("count", 1, 3)) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bounds are co-primary inputs, and neither is a pipeable value.
export const betweenCheck = (columnName: string, minimum: number, maximum: number) => {
  const name = checkedName(columnName, "between");
  return (column: ExtraConfigColumn) =>
    Table.check(name)(
      sql<boolean>`${column} >= ${rawNumber(minimum)} and ${column} <= ${rawNumber(maximum)}`,
    );
};

/**
 * SQL check `column >= minimum`.
 *
 * **Example** (Name a lower-bound check)
 *
 * ```ts
 * import { atLeastCheck } from "./Port.ts"
 *
 * console.log(typeof atLeastCheck("count", 0)) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bound are co-primary inputs, and neither is a pipeable value.
export const atLeastCheck = (columnName: string, minimum: number) => {
  const name = checkedName(columnName, "min");
  return (column: ExtraConfigColumn) => Table.check(name)(sql<boolean>`${column} >= ${rawNumber(minimum)}`);
};

/**
 * SQL check on the length of a jsonb array column.
 *
 * **Example** (Cap an array column)
 *
 * ```ts
 * import { jsonbArrayLengthCheck } from "./Port.ts"
 *
 * console.log(typeof jsonbArrayLengthCheck("sections", { maximum: 12 })) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bounds are co-primary inputs, and neither is a pipeable value.
export const jsonbArrayLengthCheck = (
  columnName: string,
  bounds: { readonly minimum?: number; readonly maximum?: number },
) => {
  const name = checkedName(columnName, "alen");
  return (column: ExtraConfigColumn) => {
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
};

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
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and fallback are co-primary inputs, and neither is a pipeable value.
export const boolDefault = (column: string, fallback: boolean) =>
  S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(fallback)), pg.boolean(), pg.columnName(column));

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
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and fallback are co-primary inputs, and neither is a pipeable value.
export const textDefault = (column: string, fallback: string) =>
  S.String.pipe(S.withConstructorDefault(Effect.succeed(fallback)), pg.text(), pg.columnName(column));

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
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and fallback are co-primary inputs, and neither is a pipeable value.
export const finiteDefault = (column: string, fallback: number) =>
  S.Finite.pipe(
    S.withConstructorDefault(Effect.succeed(fallback)),
    pg.doublePrecision(),
    pg.columnName(column),
  );

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
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and fallback are co-primary inputs, and neither is a pipeable value.
export const intDefault = (column: string, fallback: number) =>
  S.Int.pipe(S.withConstructorDefault(Effect.succeed(fallback)), pg.integer(), pg.columnName(column));

export { Model, optionalNull, pg, Table };
