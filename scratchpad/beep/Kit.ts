/**
 * Shared OMI field factories for persisted scratchpad models.
 *
 * Repeated identifiers, timestamps, user ids, unit-interval scores, optional
 * text, and non-negative counters are built here once. A field shape that
 * appears once stays inline in its model file.
 *
 * @since 0.0.0
 */
import { sql, type SQL } from "drizzle-orm";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Model } from "@beep/effect-drizzle";
import * as pg from "@beep/effect-drizzle/pg";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("beep/Kit");

const KitFieldProblem = LiteralKit([
  "lookaround",
  "backslash",
  "invalid-pattern",
  "empty-bounds",
  "bound",
  "min-above-max",
  "check-name",
]);

/**
 * Factory input that cannot become a schema check and a parameter-free SQL check.
 *
 * **Details**
 *
 * `problem` names the rejected constraint. `detail` is the pattern, bound, or
 * check name that caused the rejection.
 *
 * **Example** (Reject a lookahead pattern)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { KitFieldError, boundedText } from "@beep/scratchpad/beep"
 *
 * const attempted = Result.try({
 *   try: () => boundedText("title", { pattern: "(?=a)" }),
 *   catch: (error) => error,
 * })
 * const problem = Result.isFailure(attempted) && S.is(KitFieldError)(attempted.failure)
 *   ? attempted.failure.problem
 *   : "absent"
 * Effect.runSync(Effect.log(problem)) // "lookaround"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KitFieldError extends S.TaggedError<KitFieldError>()(
  "KitFieldError",
  {
    problem: KitFieldProblem,
    detail: S.String,
  },
  $I.annoteError<KitFieldError>("KitFieldError", {
    description: "A shared OMI field factory was called with a constraint it cannot represent.",
  }),
) {}

/**
 * Encoded form of {@link KitFieldError}.
 *
 * @see {@link KitFieldError} for the runtime error and its problem codes.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace KitFieldError {
  export type Encoded = S.Codec.Encoded<typeof KitFieldError>;
}

/**
 * OMI stable identifier.
 *
 * **Details**
 *
 * Python `StableId` is a string of 1 to 128 characters matching
 * `^[A-Za-z0-9][A-Za-z0-9._:-]*$`, with whitespace preserved. The same checks
 * drive `Arbitrary.schema` and {@link stableIdCheck}.
 *
 * **Example** (Accept a stable id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StableId } from "@beep/scratchpad/beep"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(StableId)("goal-1"))
 * console.log(decoded) // "goal-1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StableId = S.String.check(
  S.isMinLength(1),
  S.isMaxLength(128),
  S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
).pipe(
  $I.annoteSchema("StableId", {
    description: "OMI stable identifier: 1 to 128 characters, starting alphanumeric, then letters, digits, or . _ : -.",
  }),
);

/**
 * Decoded OMI stable identifier.
 *
 * @see {@link StableId} for the runtime schema and pattern.
 * @category type-level
 * @since 0.0.0
 */
export type StableId = typeof StableId.Type;

/**
 * Closed unit-interval score used by OMI confidence fields.
 *
 * **Details**
 *
 * Python `Field(ge=0, le=1)` on a float. Both ends are inclusive. This is not
 * the string or `high | medium | low` confidence shapes; those stay inline.
 *
 * **Example** (Accept the closed unit interval)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { UnitInterval } from "@beep/scratchpad/beep"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(UnitInterval)(1))
 * console.log(decoded) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnitInterval = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })).pipe(
  $I.annoteSchema("UnitInterval", {
    description: "Finite confidence or score from 0 through 1 inclusive.",
  }),
);

/**
 * Decoded unit-interval score.
 *
 * @see {@link UnitInterval} for the runtime schema and bounds.
 * @category type-level
 * @since 0.0.0
 */
export type UnitInterval = typeof UnitInterval.Type;

/**
 * Non-negative integer used by counters such as `account_generation`.
 *
 * **Details**
 *
 * Python `Field(ge=0)` on an int. PostgreSQL `integer` storage also applies
 * the signed 32-bit range through `pg.integer()`. Fields without `ge` stay inline.
 *
 * **Example** (Accept zero)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { NonNegativeInt } from "@beep/scratchpad/beep"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(NonNegativeInt)(0))
 * console.log(decoded) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NonNegativeInt = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NonNegativeInt", {
    description: "Integer greater than or equal to zero, such as an OMI account generation.",
  }),
);

/**
 * Decoded non-negative integer.
 *
 * @see {@link NonNegativeInt} for the runtime schema and lower bound.
 * @category type-level
 * @since 0.0.0
 */
export type NonNegativeInt = typeof NonNegativeInt.Type;

const isNonNegativeInt = S.is(NonNegativeInt);

/**
 * UTC timestamp stored as an ISO-8601 string.
 *
 * **Details**
 *
 * OMI `datetime` and `AwareDatetime` values are wire strings. Naive strings are
 * read as UTC. This is not a Unix-float or date-only field.
 *
 * **Example** (Decode a UTC instant)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { UtcTimestamp } from "@beep/scratchpad/beep"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(UtcTimestamp)("2020-01-02T03:04:05.000Z"))
 * console.log(DateTime.formatIso(decoded)) // "2020-01-02T03:04:05.000Z"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UtcTimestamp = S.DateTimeUtcFromString.pipe(
  $I.annoteSchema("UtcTimestamp", {
    description: "UTC instant encoded as an ISO-8601 string for an OMI datetime field.",
  }),
);

/**
 * Decoded UTC timestamp.
 *
 * @see {@link UtcTimestamp} for the runtime schema and string encoding.
 * @category type-level
 * @since 0.0.0
 */
export type UtcTimestamp = typeof UtcTimestamp.Type;

/**
 * Length and pattern limits copied from a Python `Field`.
 *
 * At least one limit is required. `pattern` is a JavaScript regular expression
 * source with no flags, and the same source is copied into the SQL check.
 *
 * @see {@link boundedText} for the column factory that applies these limits.
 * @category type-level
 * @since 0.0.0
 */
export interface TextBounds {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

const fail = (problem: typeof KitFieldProblem.Type, detail: string): never => {
  throw KitFieldError.make({ problem, detail });
};

const compilePattern = (pattern: string): Result.Result<RegExp, KitFieldError> => {
  if (
    Str.includes("(?=")(pattern) ||
    Str.includes("(?!")(pattern) ||
    Str.includes("(?<=")(pattern) ||
    Str.includes("(?<!")(pattern)
  ) {
    return Result.fail(KitFieldError.make({ problem: "lookaround", detail: pattern }));
  }
  if (Str.includes("\\")(pattern)) {
    return Result.fail(KitFieldError.make({ problem: "backslash", detail: pattern }));
  }
  if (Str.includes("\n")(pattern) || Str.includes("\r")(pattern) || Str.includes("\u0000")(pattern)) {
    return Result.fail(KitFieldError.make({ problem: "invalid-pattern", detail: pattern }));
  }
  return Result.try({
    try: () => new RegExp(pattern),
    catch: () => KitFieldError.make({ problem: "invalid-pattern", detail: pattern }),
  });
};

const patternOf = (pattern: string): RegExp => {
  const compiled = compilePattern(pattern);
  if (Result.isFailure(compiled)) throw compiled.failure;
  return compiled.success;
};

const requireBound = (value: number, label: string): number =>
  isNonNegativeInt(value) ? value : fail("bound", label);

const checkedName = (column: string, suffix: string): string => {
  const name = `${column}_${suffix}`;
  if (!/^[_a-z][_a-z0-9]*$/.test(name) || Str.endsWith("_")(name) || name.length > 63) {
    return fail("check-name", name);
  }
  return name;
};

const rawInt = (value: number): SQL => sql.raw(`${value}`);

const rawLiteral = (value: string): SQL => sql.raw(`'${Str.replaceAll("'", "''")(value)}'`);

const boundedString = (bounds: TextBounds): S.String => {
  const minLength = bounds.minLength === undefined ? undefined : requireBound(bounds.minLength, "minLength");
  const maxLength = bounds.maxLength === undefined ? undefined : requireBound(bounds.maxLength, "maxLength");
  const pattern = bounds.pattern === undefined ? undefined : patternOf(bounds.pattern);
  if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
    return fail("min-above-max", `${minLength}>${maxLength}`);
  }
  if (minLength !== undefined && maxLength !== undefined && pattern !== undefined) {
    return S.String.check(S.isMinLength(minLength), S.isMaxLength(maxLength), S.isPattern(pattern));
  }
  if (minLength !== undefined && maxLength !== undefined) {
    return S.String.check(S.isMinLength(minLength), S.isMaxLength(maxLength));
  }
  if (minLength !== undefined && pattern !== undefined) {
    return S.String.check(S.isMinLength(minLength), S.isPattern(pattern));
  }
  if (maxLength !== undefined && pattern !== undefined) {
    return S.String.check(S.isMaxLength(maxLength), S.isPattern(pattern));
  }
  if (minLength !== undefined) return S.String.check(S.isMinLength(minLength));
  if (maxLength !== undefined) return S.String.check(S.isMaxLength(maxLength));
  if (pattern !== undefined) return S.String.check(S.isPattern(pattern));
  return fail("empty-bounds", "");
};

const textBoundsSql = (column: ExtraConfigColumn, bounds: TextBounds): SQL<boolean> => {
  const minLength = bounds.minLength === undefined ? undefined : requireBound(bounds.minLength, "minLength");
  const maxLength = bounds.maxLength === undefined ? undefined : requireBound(bounds.maxLength, "maxLength");
  const pattern = bounds.pattern;
  if (pattern !== undefined) patternOf(pattern);
  if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
    return fail("min-above-max", `${minLength}>${maxLength}`);
  }
  if (minLength !== undefined && maxLength !== undefined && pattern !== undefined) {
    return sql<boolean>`char_length(${column}) >= ${rawInt(minLength)} and char_length(${column}) <= ${rawInt(maxLength)} and ${column} ~ ${rawLiteral(pattern)}`;
  }
  if (minLength !== undefined && maxLength !== undefined) {
    return sql<boolean>`char_length(${column}) >= ${rawInt(minLength)} and char_length(${column}) <= ${rawInt(maxLength)}`;
  }
  if (minLength !== undefined && pattern !== undefined) {
    return sql<boolean>`char_length(${column}) >= ${rawInt(minLength)} and ${column} ~ ${rawLiteral(pattern)}`;
  }
  if (maxLength !== undefined && pattern !== undefined) {
    return sql<boolean>`char_length(${column}) <= ${rawInt(maxLength)} and ${column} ~ ${rawLiteral(pattern)}`;
  }
  if (minLength !== undefined) return sql<boolean>`char_length(${column}) >= ${rawInt(minLength)}`;
  if (maxLength !== undefined) return sql<boolean>`char_length(${column}) <= ${rawInt(maxLength)}`;
  if (pattern !== undefined) return sql<boolean>`${column} ~ ${rawLiteral(pattern)}`;
  return fail("empty-bounds", "");
};

const optionalWire = <Wire extends S.ConstraintDecoder<unknown>, Value extends S.ConstraintDecoder<unknown>>(
  wire: Wire,
  schema: Value,
) =>
  S.NullOr(wire).pipe(
    S.optionalKey,
    S.decodeTo(S.Option(schema), {
      decode: SchemaGetter.transformOptional((present) =>
        present.pipe(
          O.flatMap((value) => (value === null ? O.none() : O.some(value))),
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
    SchemaUtils.withNoneDefault,
  );

const optionalUtcTimestamp = optionalWire(S.String, UtcTimestamp);

/**
 * Decodes a missing key or JSON null as `None`, and encodes `None` as null.
 *
 * **Details**
 *
 * `OptionFromOptionalNullOr` puts `undefined` in the encoded AST, and
 * effect-drizzle refuses that node for a SQL column. This wrapper is the
 * persisted form of that codec: the key may be absent, null becomes `None`,
 * and `None` is written back as SQL null. A present JavaScript `undefined` is
 * rejected. Pipe a `pg` column combinator and {@link pg.columnName} after it.
 *
 * **Gotchas**
 *
 * Constructor calls may omit the field. Decode still requires the key to be
 * absent or null; it does not invent `None` from `undefined`.
 *
 * The `decodeTo` target is `S.Option(S.toType(schema))`, not
 * `S.Option(schema)`. The inner schema already ran inside `NullOr`, so the
 * target must only validate the decoded type; a second decode pass fails for
 * any nested model whose fields are themselves `Option`.
 *
 * **Example** (Decode null and encode None)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { optionalNull } from "@beep/scratchpad/beep"
 *
 * const Note = S.Struct({ body: optionalNull(S.String) })
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Note)({ body: null }))
 * const encoded = Effect.runSync(S.encodeEffect(Note)(Note.make({})))
 * console.log(O.isNone(decoded.body)) // true
 * console.log(encoded.body) // null
 * ```
 *
 * @see {@link optionalText} for the text-column form.
 * @category schemas
 * @since 0.0.0
 */
export const optionalNull = <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch) =>
  optionalWire(schema, S.toType(schema));

/**
 * Required stable-id text column.
 *
 * **Example** (Store a goal id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, stableId } from "@beep/scratchpad/beep"
 *
 * class Goal extends Model<Goal>("Goal")({ id: stableId("id") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Goal)({ id: "goal-1" }))
 * console.log(decoded.id) // "goal-1"
 * ```
 *
 * @see {@link stableIdCheck} for the matching SQL check.
 * @category factories
 * @since 0.0.0
 */
export const stableId = (column: string) => StableId.pipe(pg.text(), pg.columnName(column));

/**
 * Optional stable-id text column. Missing and null become `None`.
 *
 * **Example** (Omit a parent id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalStableId } from "@beep/scratchpad/beep"
 *
 * class Link extends Model<Link>("Link")({ parentId: optionalStableId("parent_id") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Link)({}))
 * console.log(O.isNone(decoded.parentId)) // true
 * ```
 *
 * @see {@link stableId} for the required form.
 * @category factories
 * @since 0.0.0
 */
export const optionalStableId = (column: string) => optionalNull(StableId).pipe(pg.text(), pg.columnName(column));

/**
 * Required unbounded text column.
 *
 * **Details**
 *
 * Use for OMI strings that have no shared length or pattern. Bounded strings
 * use {@link boundedText}. Plain `str` ids that are not `StableId` use this too.
 *
 * **Example** (Store a title)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, text } from "@beep/scratchpad/beep"
 *
 * class Item extends Model<Item>("Item")({ title: text("title") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Item)({ title: "Notes" }))
 * console.log(decoded.title) // "Notes"
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const text = (column: string) => S.String.pipe(pg.text(), pg.columnName(column));

/**
 * Optional unbounded text column. Missing and null become `None`.
 *
 * **Details**
 *
 * This is the shared shape for OMI `Optional[str] = None` fields with no
 * length or pattern. `None` encodes as null.
 *
 * **Example** (Decode a null note)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalText } from "@beep/scratchpad/beep"
 *
 * class Note extends Model<Note>("Note")({ body: optionalText("body") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Note)({ body: null }))
 * console.log(O.isNone(decoded.body)) // true
 * ```
 *
 * @see {@link optionalNull} for the absence codec used by every optional factory.
 * @category factories
 * @since 0.0.0
 */
export const optionalText = (column: string) => optionalNull(S.String).pipe(pg.text(), pg.columnName(column));

/**
 * Required text column with Python length or pattern checks.
 *
 * **Gotchas**
 *
 * Patterns cannot use lookaround or backslashes. `Arbitrary.schema` cannot
 * derive lookaround, and PostgreSQL POSIX regex does not share JavaScript
 * escapes such as `\d`. Pass at least one bound.
 *
 * **Example** (Limit a title)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, boundedText } from "@beep/scratchpad/beep"
 *
 * class Item extends Model<Item>("Item")({
 *   title: boundedText("title", { minLength: 1, maxLength: 256 }),
 * }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Item)({ title: "Notes" }))
 * console.log(decoded.title) // "Notes"
 * ```
 *
 * @see {@link textBoundsCheck} for the matching SQL check.
 * @category factories
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bounds are co-primary inputs, and neither is a pipeable value.
export const boundedText = (column: string, bounds: TextBounds) =>
  boundedString(bounds).pipe(pg.text(), pg.columnName(column));

/**
 * Optional bounded text column. Missing and null become `None`.
 *
 * **Example** (Cap an optional summary)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalBoundedText } from "@beep/scratchpad/beep"
 *
 * class Item extends Model<Item>("Item")({
 *   summary: optionalBoundedText("summary", { maxLength: 200 }),
 * }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Item)({ summary: null }))
 * console.log(O.isNone(decoded.summary)) // true
 * ```
 *
 * @see {@link boundedText} for the required form.
 * @category factories
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bounds are co-primary inputs, and neither is a pipeable value.
export const optionalBoundedText = (column: string, bounds: TextBounds) =>
  optionalNull(boundedString(bounds)).pipe(pg.text(), pg.columnName(column));

/**
 * Required OMI user id column (`uid` or `user_id`).
 *
 * **Details**
 *
 * The Python fields are plain strings. Two call sites add a length check and
 * stay inline. This factory does not invent a beep user id.
 *
 * **Example** (Store a uid)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, userId } from "@beep/scratchpad/beep"
 *
 * class Owner extends Model<Owner>("Owner")({ uid: userId("uid") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Owner)({ uid: "user-1" }))
 * console.log(decoded.uid) // "user-1"
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const userId = (column: string) => text(column);

/**
 * Optional OMI user id column. Missing and null become `None`.
 *
 * **Example** (Omit a uid)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalUserId } from "@beep/scratchpad/beep"
 *
 * class Owner extends Model<Owner>("Owner")({ uid: optionalUserId("uid") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Owner)({}))
 * console.log(O.isNone(decoded.uid)) // true
 * ```
 *
 * @see {@link userId} for the required form.
 * @category factories
 * @since 0.0.0
 */
export const optionalUserId = (column: string) => optionalText(column);

/**
 * Required `timestamptz` column encoded as a UTC ISO string.
 *
 * **Example** (Store a creation instant)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, timestamp } from "@beep/scratchpad/beep"
 *
 * class Row extends Model<Row>("Row")({ createdAt: timestamp("created_at") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ createdAt: "2020-01-02T03:04:05.000Z" }))
 * console.log(DateTime.formatIso(decoded.createdAt)) // "2020-01-02T03:04:05.000Z"
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const timestamp = (column: string) =>
  UtcTimestamp.pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

/**
 * Optional `timestamptz` column. Missing and null become `None`.
 *
 * **Example** (Decode a null update time)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalTimestamp } from "@beep/scratchpad/beep"
 *
 * class Row extends Model<Row>("Row")({ updatedAt: optionalTimestamp("updated_at") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ updatedAt: null }))
 * console.log(O.isNone(decoded.updatedAt)) // true
 * ```
 *
 * @see {@link timestamp} for the required form.
 * @category factories
 * @since 0.0.0
 */
export const optionalTimestamp = (column: string) =>
  optionalUtcTimestamp.pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

/**
 * Required timestamp that defaults to the current UTC instant at construction.
 *
 * **Details**
 *
 * Matches OMI `default_factory=lambda: datetime.now(timezone.utc)`. The default
 * is construction-only. Decode still requires the string. Wire values are not
 * replaced with "now".
 *
 * **Example** (Omit the instant at construction)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Model, timestampDefaultNow } from "@beep/scratchpad/beep"
 *
 * class Row extends Model<Row>("Row")({ createdAt: timestampDefaultNow("created_at") }) {}
 * console.log(DateTime.isDateTime(Row.make({}).createdAt)) // true
 * ```
 *
 * @see {@link timestamp} when the caller always supplies the instant.
 * @category factories
 * @since 0.0.0
 */
export const timestampDefaultNow = (column: string) =>
  UtcTimestamp.pipe(
    S.withConstructorDefault(Effect.sync(DateTime.nowUnsafe)),
    pg.timestamp({ mode: "string", withTimezone: true }),
    pg.columnName(column),
  );

/**
 * Required unit-interval `double precision` column.
 *
 * **Example** (Store a confidence)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, confidence } from "@beep/scratchpad/beep"
 *
 * class Score extends Model<Score>("Score")({ confidence: confidence("confidence") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Score)({ confidence: 0.5 }))
 * console.log(decoded.confidence) // 0.5
 * ```
 *
 * @see {@link unitIntervalCheck} for the matching SQL check.
 * @category factories
 * @since 0.0.0
 */
export const confidence = (column: string) => UnitInterval.pipe(pg.doublePrecision(), pg.columnName(column));

/**
 * Optional unit-interval column. Missing and null become `None`.
 *
 * **Example** (Decode a null confidence)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalConfidence } from "@beep/scratchpad/beep"
 *
 * class Score extends Model<Score>("Score")({ dueConfidence: optionalConfidence("due_confidence") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Score)({ dueConfidence: null }))
 * console.log(O.isNone(decoded.dueConfidence)) // true
 * ```
 *
 * @see {@link confidence} for the required form.
 * @category factories
 * @since 0.0.0
 */
export const optionalConfidence = (column: string) =>
  optionalNull(UnitInterval).pipe(pg.doublePrecision(), pg.columnName(column));

/**
 * Required non-negative integer column.
 *
 * **Example** (Store a generation counter)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, nonNegativeInt } from "@beep/scratchpad/beep"
 *
 * class Row extends Model<Row>("Row")({ attempt: nonNegativeInt("attempt") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ attempt: 2 }))
 * console.log(decoded.attempt) // 2
 * ```
 *
 * @see {@link nonNegativeIntCheck} for the matching SQL check.
 * @category factories
 * @since 0.0.0
 */
export const nonNegativeInt = (column: string) => NonNegativeInt.pipe(pg.integer(), pg.columnName(column));

/**
 * Optional non-negative integer column. Missing and null become `None`.
 *
 * **Example** (Decode a null counter)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalNonNegativeInt } from "@beep/scratchpad/beep"
 *
 * class Row extends Model<Row>("Row")({ attempt: optionalNonNegativeInt("attempt") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({}))
 * console.log(O.isNone(decoded.attempt)) // true
 * ```
 *
 * @see {@link nonNegativeInt} for the required form.
 * @category factories
 * @since 0.0.0
 */
export const optionalNonNegativeInt = (column: string) =>
  optionalNull(NonNegativeInt).pipe(pg.integer(), pg.columnName(column));

/**
 * Required `account_generation` style counter, `ge=0`, with no constructor default.
 *
 * **Example** (Require the generation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, accountGeneration } from "@beep/scratchpad/beep"
 *
 * class Row extends Model<Row>("Row")({ accountGeneration: accountGeneration("account_generation") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ accountGeneration: 3 }))
 * console.log(decoded.accountGeneration) // 3
 * ```
 *
 * @see {@link accountGenerationDefault} when Python defaults the field to 0.
 * @category factories
 * @since 0.0.0
 */
export const accountGeneration = (column: string) => nonNegativeInt(column);

/**
 * Non-negative integer that constructs as 0 when omitted.
 *
 * **Details**
 *
 * The default is construction-only. Encoded rows still include the integer.
 * Use this for OMI `account_generation: int = Field(default=0, ge=0)`.
 *
 * **Example** (Construct the zero default)
 *
 * ```ts
 * import { Model, accountGenerationDefault } from "@beep/scratchpad/beep"
 *
 * class Row extends Model<Row>("Row")({
 *   accountGeneration: accountGenerationDefault("account_generation"),
 * }) {}
 * console.log(Row.make({}).accountGeneration) // 0
 * ```
 *
 * @see {@link accountGeneration} when the caller must supply the counter.
 * @category factories
 * @since 0.0.0
 */
export const accountGenerationDefault = (column: string) =>
  NonNegativeInt.pipe(S.withConstructorDefault(Effect.succeed(0)), pg.integer(), pg.columnName(column));

/**
 * Required boolean column.
 *
 * **Example** (Store an enabled flag)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model, bool } from "@beep/scratchpad/beep"
 *
 * class Row extends Model<Row>("Row")({ enabled: bool("enabled") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ enabled: true }))
 * console.log(decoded.enabled) // true
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const bool = (column: string) => S.Boolean.pipe(pg.boolean(), pg.columnName(column));

/**
 * Optional boolean column. Missing and null become `None`.
 *
 * **Example** (Decode a null flag)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Model, optionalBool } from "@beep/scratchpad/beep"
 *
 * class Row extends Model<Row>("Row")({ archived: optionalBool("archived") }) {}
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Row)({ archived: null }))
 * console.log(O.isNone(decoded.archived)) // true
 * ```
 *
 * @see {@link bool} for the required form.
 * @category factories
 * @since 0.0.0
 */
export const optionalBool = (column: string) => optionalNull(S.Boolean).pipe(pg.boolean(), pg.columnName(column));

/**
 * SQL check for a {@link stableId} or {@link optionalStableId} column.
 *
 * **Details**
 *
 * The check name is `${column}_sid`. Null passes, so the same check covers
 * optional columns. The expression has no bound parameters.
 *
 * **Example** (Name the stable-id check)
 *
 * ```ts
 * import { stableIdCheck } from "@beep/scratchpad/beep"
 *
 * const build = stableIdCheck("goal_id")
 * console.log(typeof build) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const stableIdCheck = (columnName: string) => {
  const name = checkedName(columnName, "sid");
  return (column: ExtraConfigColumn) =>
    pg.Table.check(name)(
      sql<boolean>`char_length(${column}) >= 1 and char_length(${column}) <= 128 and ${column} ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'`,
    );
};

/**
 * SQL check for a {@link confidence} column: `0 <= value <= 1`.
 *
 * **Example** (Build the check from a column name)
 *
 * ```ts
 * import { unitIntervalCheck } from "@beep/scratchpad/beep"
 *
 * const build = unitIntervalCheck("confidence")
 * console.log(typeof build) // "function"
 * ```
 *
 * @see {@link confidence} for the schema half of the same bound.
 * @category constructors
 * @since 0.0.0
 */
export const unitIntervalCheck = (columnName: string) => {
  const name = checkedName(columnName, "unit");
  return (column: ExtraConfigColumn) => pg.Table.check(name)(sql<boolean>`${column} >= 0 and ${column} <= 1`);
};

/**
 * SQL check for a {@link nonNegativeInt} column: `value >= 0`.
 *
 * **Example** (Build the non-negative check)
 *
 * ```ts
 * import { nonNegativeIntCheck } from "@beep/scratchpad/beep"
 *
 * const build = nonNegativeIntCheck("account_generation")
 * console.log(typeof build) // "function"
 * ```
 *
 * @see {@link nonNegativeInt} for the schema half of the same bound.
 * @category constructors
 * @since 0.0.0
 */
export const nonNegativeIntCheck = (columnName: string) => {
  const name = checkedName(columnName, "nn");
  return (column: ExtraConfigColumn) => pg.Table.check(name)(sql<boolean>`${column} >= 0`);
};

/**
 * SQL check for {@link boundedText} limits. The name is `${column}_text`.
 *
 * **Gotchas**
 *
 * Empty bounds throw {@link KitFieldError}. The rendered SQL inlines digits and
 * the pattern literal, so the check has no parameters.
 *
 * **Example** (Build a length check)
 *
 * ```ts
 * import { textBoundsCheck } from "@beep/scratchpad/beep"
 *
 * const build = textBoundsCheck("title", { minLength: 1, maxLength: 256 })
 * console.log(typeof build) // "function"
 * ```
 *
 * @see {@link boundedText} for the schema half of the same limits.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Column name and bounds are co-primary inputs, and neither is a pipeable value.
export const textBoundsCheck = (columnName: string, bounds: TextBounds) => {
  const name = checkedName(columnName, "text");
  boundedString(bounds);
  return (column: ExtraConfigColumn) => pg.Table.check(name)(textBoundsSql(column, bounds));
};

/**
 * PostgreSQL model constructor for ported OMI rows.
 *
 * **Details**
 *
 * The class does not add beep entity id, entity type, or public id columns.
 * Pass field factories as the record, identity annotations second, and SQL
 * checks third.
 *
 * **Example** (Declare a row)
 *
 * ```ts
 * import { Model, text } from "@beep/scratchpad/beep"
 *
 * class Item extends Model<Item>("Item")({ title: text("title") }) {}
 * console.log(Item.sql.tableName) // "item"
 * ```
 *
 * @see {@link pg} for the column combinators used inside the factories.
 * @category factories
 * @since 0.0.0
 */
export { Model };

/**
 * PostgreSQL column combinators and table extras, including `Table.check`.
 *
 * **Example** (Read a text column kind)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { pg } from "@beep/scratchpad/beep"
 *
 * console.log(String.pipe(pg.text()).meta.column?.kind) // "text"
 * ```
 *
 * @see {@link Table} for `Table.check` as its own export.
 * @category combinators
 * @since 0.0.0
 */
export { pg };

/**
 * PostgreSQL table-extra constructors. {@link Table.check} builds a typed check.
 *
 * **Example** (Read the check tag)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { Table } from "@beep/scratchpad/beep"
 *
 * console.log(Table.check("positive_count")(sql<boolean>`count > 0`)._tag) // "check"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export { Table } from "@beep/effect-drizzle/pg";
