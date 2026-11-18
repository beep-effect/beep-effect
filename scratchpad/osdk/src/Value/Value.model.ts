/**
 * Scalar value codecs: how each scalar type tag travels on the wire and what it becomes in the domain.
 *
 * **Details**
 *
 * OSDK keeps six parallel tables from type tag to TypeScript type (read, send,
 * create, update and two function-edit forms) and leaves 64-bit integers,
 * decimals, dates and instants as strings. Here each tag has exactly one codec
 * whose `Encoded` side is the documented JSON encoding and whose `Type` side is
 * the richest faithful domain value. Both directions and every table fall out
 * of that one schema.
 *
 * | Tag | Wire JSON | Domain |
 * | --- | --- | --- |
 * | boolean | boolean (or `"true"` / `"false"`) | `boolean` |
 * | byte, short, integer | number (or numeric string) | bounded integer `number` |
 * | float, double | number (or numeric string) | finite `number` |
 * | long | decimal string (or a JSON integer on decode) | `bigint` |
 * | decimal | plain decimal string (or a JSON number on decode) | `BigDecimal` |
 * | string | string | `string` |
 * | date | `YYYY-MM-DD` | `LocalDate` |
 * | timestamp | ISO 8601 UTC instant | `DateTime.Utc` |
 * | binary | base64 string | `Uint8Array` |
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { daysInMonth, LocalDateFromString } from "@beep/schema/LocalDate";
import * as A from "effect/Array";
import * as BigDecimal from "effect/BigDecimal";
import { flow, pipe } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { MarkingId } from "../Identifier/Identifier.model.ts";

const $I = $ScratchpadId.create("osdk/Value/Value.model");

// The wire documents that boolean, byte, short, integer, float and double "can also be encoded as
// JSON strings" for backwards compatibility. Decoding accepts both; encoding always emits the JSON
// number, because the numeric member comes first in the union.
//
// The string member is gated by a decimal grammar: JavaScript's own number coercion would also accept
// the empty string (as 0), surrounding whitespace and hexadecimal, octal and binary literals.
const DecimalNumberText = S.String.check(
  S.isPattern(
    /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/,
    $I.annote("DecimalNumberTextCheck", {
      title: "Decimal number text",
      description: "A base-10 number: optional sign, digits with an optional fraction, optional exponent.",
      message: "Expected a base-10 number such as 31, -2.5 or 1e3",
    })
  )
);

const acceptingNumericString = <Numeric extends S.Codec<number, number>>(numeric: Numeric) =>
  S.Union([numeric, DecimalNumberText.pipe(S.decodeTo(numeric, SchemaTransformation.numberFromString))]);

/**
 * Value of a `boolean` property: a JSON boolean, or the legacy `"true"` / `"false"` strings on decode.
 *
 * **Example** (Accept the legacy string encoding)
 *
 * ```ts import.meta.vitest name="Accept the legacy string encoding"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BooleanValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const decode = S.decodeUnknownEffect(BooleanValue)
 * const values = await Effect.runPromise(Effect.all([decode(true), decode("false")]))
 * values // => [true, false]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const BooleanValue = S.Union([
  S.Boolean,
  S.Literals(["true", "false"]).pipe(
    S.decodeTo(
      S.Boolean,
      SchemaTransformation.transform({
        decode: (text) => text === "true",
        encode: (value) => (value ? "true" : "false"),
      })
    )
  ),
]).pipe(
  $I.annoteSchema("BooleanValue", {
    description: "Value of a boolean property: a JSON boolean, or the legacy true/false strings on decode.",
  })
);

/**
 * Runtime type of {@link BooleanValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type BooleanValue = typeof BooleanValue.Type;

const ByteRange = S.Int.check(
  S.isBetween(
    { minimum: -128, maximum: 127 },
    $I.annote("ByteRangeCheck", {
      title: "Signed 8-bit range",
      description: "An integer in the inclusive range -128 through 127.",
      message: "Expected a signed 8-bit integer between -128 and 127",
    })
  )
);

/**
 * Value of a `byte` property: a signed 8-bit integer.
 *
 * **Example** (Hold both ends of the signed 8-bit range)
 *
 * ```ts import.meta.vitest name="Hold both ends of the signed 8-bit range"
 * import * as S from "effect/Schema"
 * import { ByteValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const isByte = S.is(ByteValue)
 * const verdicts = [isByte(-128), isByte(127), isByte(128), isByte(255)]
 * verdicts // => [true, true, false, false]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ByteValue = acceptingNumericString(ByteRange).pipe(
  $I.annoteSchema("ByteValue", { description: "Value of a byte property: a signed 8-bit integer." })
);

/**
 * Runtime type of {@link ByteValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type ByteValue = typeof ByteValue.Type;

const ShortRange = S.Int.check(
  S.isBetween(
    { minimum: -32_768, maximum: 32_767 },
    $I.annote("ShortRangeCheck", {
      title: "Signed 16-bit range",
      description: "An integer in the inclusive range -32768 through 32767.",
      message: "Expected a signed 16-bit integer between -32768 and 32767",
    })
  )
);

/**
 * Value of a `short` property: a signed 16-bit integer.
 *
 * **Example** (Decode a short sent as text and refuse one past the range)
 *
 * ```ts import.meta.vitest name="Decode a short sent as text and refuse one past the range"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ShortValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const decode = S.decodeUnknownEffect(ShortValue)
 * const value = await Effect.runPromise(decode("32767"))
 * const refused = await Effect.runPromise(Effect.isFailure(decode("32768")))
 * const outcome = [value, refused]
 * outcome // => [32767, true]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ShortValue = acceptingNumericString(ShortRange).pipe(
  $I.annoteSchema("ShortValue", { description: "Value of a short property: a signed 16-bit integer." })
);

/**
 * Runtime type of {@link ShortValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type ShortValue = typeof ShortValue.Type;

const Int32 = S.Int.check(S.isInt32());

/**
 * Value of an `integer` property: a signed 32-bit integer.
 *
 * **Example** (Reject a value outside the 32-bit range)
 *
 * ```ts import.meta.vitest name="Reject a value outside the 32-bit range"
 * import * as S from "effect/Schema"
 * import { IntegerValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const isInteger = S.is(IntegerValue)
 * const verdicts = [isInteger(238940), isInteger(2147483648), isInteger(1.5)]
 * verdicts // => [true, false, false]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const IntegerValue = acceptingNumericString(Int32).pipe(
  $I.annoteSchema("IntegerValue", { description: "Value of an integer property: a signed 32-bit integer." })
);

/**
 * Runtime type of {@link IntegerValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type IntegerValue = typeof IntegerValue.Type;

const Int64FromString = S.BigIntFromString.check(
  S.isBetweenBigInt(
    { minimum: BigInt("-9223372036854775808"), maximum: BigInt("9223372036854775807") },
    $I.annote("LongRangeCheck", {
      title: "Signed 64-bit range",
      description: "An integer in the inclusive signed 64-bit range.",
      message: "Expected a signed 64-bit integer",
    })
  )
);

/**
 * Value of a `long` property: a signed 64-bit integer that travels as a decimal string.
 *
 * **Details**
 *
 * JSON numbers lose integers above 2^53, so the wire uses a string and OSDK
 * hands that string to the caller. The domain value is a `bigint`, which can be
 * compared and added without parsing. Decoding also accepts a JSON integer,
 * which some producers send for small values; encoding always emits the string.
 *
 * **Example** (Decode a long beyond the safe integer range)
 *
 * ```ts import.meta.vitest name="Decode a long beyond the safe integer range"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LongValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(LongValue)("9007199254740993"))
 * const next = value + BigInt(1)
 * next.toString() // => "9007199254740994"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const LongValue = S.Union([
  Int64FromString,
  S.Int.pipe(S.decodeTo(Int64FromString, SchemaTransformation.numberFromString.flip())),
]).pipe(
  $I.annoteSchema("LongValue", {
    description: "Value of a long property: a signed 64-bit integer that travels as a decimal string.",
  })
);

/**
 * Runtime type of {@link LongValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type LongValue = typeof LongValue.Type;

const Float32Range = S.Finite.check(
  S.isBetween(
    { minimum: -3.4028234663852886e38, maximum: 3.4028234663852886e38 },
    $I.annote("Float32RangeCheck", {
      title: "32-bit float range",
      description: "A finite number whose magnitude a 32-bit float can hold.",
      message: "Expected a finite number within the 32-bit float range",
    })
  )
);

/**
 * Value of a `float` property: a finite number within the range of a 32-bit float.
 *
 * **Gotchas**
 *
 * The range is enforced; the precision is not. A value inside the range that a
 * 32-bit float cannot represent exactly is accepted as given.
 *
 * **Example** (Enforce the range of a float but not its precision)
 *
 * ```ts import.meta.vitest name="Enforce the range of a float but not its precision"
 * import * as S from "effect/Schema"
 * import { FloatValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const isFloat = S.is(FloatValue)
 * const verdicts = [isFloat(0.1), isFloat(3.4e38), isFloat(3.5e38)]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const FloatValue = acceptingNumericString(Float32Range).pipe(
  $I.annoteSchema("FloatValue", { description: "Value of a float property: a finite 32-bit floating point number." })
);

/**
 * Runtime type of {@link FloatValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type FloatValue = typeof FloatValue.Type;

/**
 * Value of a `double` property: a finite 64-bit floating point number.
 *
 * **Example** (Read an exponent from text but refuse hexadecimal)
 *
 * ```ts import.meta.vitest name="Read an exponent from text but refuse hexadecimal"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DoubleValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const decode = S.decodeUnknownEffect(DoubleValue)
 * const value = await Effect.runPromise(decode("1e3"))
 * const refusals = await Effect.runPromise(
 *   Effect.all([Effect.isFailure(decode("0x10")), Effect.isFailure(decode("")), Effect.isFailure(decode("Infinity"))])
 * )
 * const outcome = { value, refusals }
 * outcome // => { value: 1000, refusals: [true, true, true] }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const DoubleValue = acceptingNumericString(S.Finite).pipe(
  $I.annoteSchema("DoubleValue", { description: "Value of a double property: a finite 64-bit floating point number." })
);

/**
 * Runtime type of {@link DoubleValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type DoubleValue = typeof DoubleValue.Type;

// `BigDecimal.format` normalises the scale and switches to exponent notation for large scales; the wire
// wants every digit, so decimals are written from the unscaled value and the scale directly.
const formatPlainDecimal = (decimal: BigDecimal.BigDecimal): string => {
  // Zero at a non-positive scale is just "0": padding it would write leading zeros.
  if (BigDecimal.isZero(decimal) && decimal.scale <= 0) {
    return "0";
  }
  const negative = decimal.value < BigInt(0);
  const absolute = `${negative ? -decimal.value : decimal.value}`;
  const digits =
    decimal.scale > 0
      ? pipe(absolute, Str.padStart(decimal.scale + 1, "0"))
      : pipe(absolute, Str.padEnd(Str.length(absolute) - decimal.scale, "0"));
  const point = Str.length(digits) - decimal.scale;
  const complete = decimal.scale > 0 ? `${pipe(digits, Str.slice(0, point))}.${pipe(digits, Str.slice(point))}` : digits;
  return negative ? `-${complete}` : complete;
};

// The wire form of a decimal is a plain decimal string: no exponent. That also bounds the scale by the
// length of the text, so re-encoding can never be asked to write an astronomically long number.
const PlainDecimalText = S.String.check(
  S.isPattern(
    /^-?(?:\d+(?:\.\d*)?|\.\d+)$/,
    $I.annote("PlainDecimalTextCheck", {
      title: "Plain decimal text",
      description: "A base-10 number written out in full: optional sign, digits, optional fraction, no exponent.",
      message: "Expected a plain decimal number such as 2.718281828",
    })
  )
);

const maximumDecimalScale = 4096;

const BoundedDecimal = S.BigDecimal.check(
  S.makeFilter(
    ({ scale }) => scale <= maximumDecimalScale && scale >= -maximumDecimalScale,
    $I.annote("DecimalScaleBoundCheck", {
      title: "Bounded decimal scale",
      description: "A decimal whose scale is small enough to be written out in full.",
      message: "Expected a decimal whose scale is within 4096 digits",
    })
  )
);

const DecimalFromText = PlainDecimalText.pipe(
  S.decodeTo(
    BoundedDecimal,
    SchemaTransformation.transform({
      decode: BigDecimal.fromStringUnsafe,
      encode: formatPlainDecimal,
    })
  )
);

/**
 * Value of a `decimal` property: an arbitrary-precision decimal that travels as a plain decimal string.
 *
 * **Details**
 *
 * Encoding writes every digit and never switches to exponent notation, and it
 * keeps the scale it was given, so `"12.50"` survives a round trip as written.
 * Decoding also accepts a JSON number; encoding always emits the string.
 *
 * **Example** (Keep trailing zeros and large magnitudes exact)
 *
 * ```ts import.meta.vitest name="Keep trailing zeros and large magnitudes exact"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DecimalValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const roundTrip = (text: string) =>
 *   S.decodeUnknownEffect(DecimalValue)(text).pipe(Effect.flatMap(S.encodeEffect(DecimalValue)))
 * const wire = await Effect.runPromise(Effect.all([roundTrip("12.50"), roundTrip("12345678901234567890.5")]))
 * wire // => ["12.50", "12345678901234567890.5"]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const DecimalValue = S.Union([
  DecimalFromText,
  // A JSON number goes straight to the decimal: its JavaScript text may carry an exponent ("1e-7"),
  // which the plain-text grammar rightly refuses.
  S.Finite.pipe(
    S.decodeTo(
      BoundedDecimal,
      SchemaTransformation.transform({
        decode: BigDecimal.fromNumberUnsafe,
        encode: BigDecimal.toNumberUnsafe,
      })
    )
  ),
]).pipe(
  $I.annoteSchema("DecimalValue", {
    description: "Value of a decimal property: an arbitrary-precision decimal that travels as a plain decimal string.",
  })
);

/**
 * Runtime type of {@link DecimalValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type DecimalValue = typeof DecimalValue.Type;

/**
 * Value of a `string` property.
 *
 * **Example** (Accept empty text and refuse a number)
 *
 * ```ts import.meta.vitest name="Accept empty text and refuse a number"
 * import * as S from "effect/Schema"
 * import { StringValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const isText = S.is(StringValue)
 * const verdicts = [isText(""), isText("Ishmael"), isText(42)]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const StringValue = S.String.pipe(
  $I.annoteSchema("StringValue", { description: "Value of a string property: any Unicode text, including empty." })
);

/**
 * Runtime type of {@link StringValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type StringValue = typeof StringValue.Type;

/**
 * Value of a `date` property: a calendar date decoded from its `YYYY-MM-DD` wire form.
 *
 * **Details**
 *
 * OSDK calls this tag `datetime` and hands back the string. A calendar date has
 * no time and no zone, so the domain value is a `LocalDate`, never a `Date` or
 * an instant.
 *
 * **Example** (Decode a leap day and refuse one that never happened)
 *
 * ```ts import.meta.vitest name="Decode a leap day and refuse one that never happened"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DateValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const decode = S.decodeUnknownEffect(DateValue)
 * const date = await Effect.runPromise(decode("2024-02-29"))
 * const refused = await Effect.runPromise(Effect.isFailure(decode("2023-02-29")))
 * const outcome = [date.year, date.month, date.day, refused]
 * outcome // => [2024, 2, 29, true]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const DateValue = LocalDateFromString.check(
  S.makeFilter(
    ({ year, month, day }) => day <= daysInMonth(year, month),
    $I.annote("CalendarDayCheck", {
      title: "Calendar day",
      description: "A day that exists in its month and year.",
      message: "Expected a day that exists in the given month",
    })
  )
).pipe(
  $I.annoteSchema("DateValue", {
    description: "Value of a date property: a calendar date decoded from its YYYY-MM-DD wire form.",
  })
);

/**
 * Runtime type of {@link DateValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type DateValue = typeof DateValue.Type;

// The JavaScript date parser rolls a day its month does not have into the next month
// ("2021-02-30" becomes 2 March). The grammar bounds widths only, so the date part is checked here.
const hasRealCalendarDay: (text: string) => boolean = flow(
  Str.match(/^([+-]?\d{4,6})-(\d{2})-(\d{2})T/),
  O.flatMap((groups) => O.all([A.get(groups, 1), A.get(groups, 2), A.get(groups, 3)])),
  O.flatMap(([year, month, day]) => O.all([N.parse(year), N.parse(month), N.parse(day)])),
  O.exists(([year, month, day]) => month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month))
);

/**
 * Value of a `timestamp` property: an instant decoded from an ISO 8601 UTC string.
 *
 * **Gotchas**
 *
 * Encoding emits the canonical form with milliseconds
 * (`2021-01-04T05:00:00.000Z`), so a wire value written without them
 * (`2021-01-04T05:00:00Z`) re-encodes to an equal instant spelled differently.
 * `DateTime` has millisecond resolution, so finer digits are truncated.
 *
 * **Example** (Decode an instant and compare it)
 *
 * ```ts import.meta.vitest name="Decode an instant and compare it"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TimestampValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const instant = await Effect.runPromise(S.decodeUnknownEffect(TimestampValue)("2021-01-04T05:00:00Z"))
 * DateTime.toEpochMillis(instant) // => 1609736400000
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const TimestampValue = S.String.check(
  S.isPattern(
    /^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/,
    $I.annote("IsoInstantCheck", {
      title: "ISO 8601 instant",
      description: "An ISO 8601 extended date-time with a time zone designator; years beyond 9999 use the signed six-digit form.",
      message: "Expected an ISO 8601 instant such as 2021-01-04T05:00:00Z",
    })
  ),
  S.makeFilter(
    hasRealCalendarDay,
    $I.annote("InstantCalendarDayCheck", {
      title: "Calendar day of an instant",
      description: "The date part names a day that exists in its month and year.",
      message: "Expected the date part of the instant to be a day that exists in its month",
    })
  )
).pipe(
  S.decodeTo(S.DateTimeUtcFromString),
  $I.annoteSchema("TimestampValue", {
    description: "Value of a timestamp property: an instant decoded from an ISO 8601 UTC string.",
  })
);

/**
 * Runtime type of {@link TimestampValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type TimestampValue = typeof TimestampValue.Type;

/**
 * Value of a `binary` value type: bytes that travel as base64 text.
 *
 * **Example** (Decode base64 text into bytes and write it back)
 *
 * ```ts import.meta.vitest name="Decode base64 text into bytes and write it back"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BinaryValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const bytes = await Effect.runPromise(S.decodeUnknownEffect(BinaryValue)("SGVsbG8="))
 * const wire = await Effect.runPromise(S.encodeEffect(BinaryValue)(bytes))
 * const outcome = { bytes: A.fromIterable(bytes), wire }
 * outcome // => { bytes: [72, 101, 108, 108, 111], wire: "SGVsbG8=" }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const BinaryValue = S.Uint8ArrayFromBase64.pipe(
  $I.annoteSchema("BinaryValue", { description: "Value of a binary value type: bytes that travel as base64 text." })
);

/**
 * Runtime type of {@link BinaryValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type BinaryValue = typeof BinaryValue.Type;

/**
 * Value of a `marking` property: the identifier of one security marking.
 *
 * **Example** (Accept any non-empty identifier, whatever its format)
 *
 * ```ts import.meta.vitest name="Accept any non-empty identifier, whatever its format"
 * import * as S from "effect/Schema"
 * import { MarkingValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const isMarking = S.is(MarkingValue)
 * const verdicts = [isMarking("18212f9a-0e63-4b79-96a0-aae04df23336"), isMarking("MU"), isMarking("")]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MarkingValue = MarkingId.pipe(
  $I.annoteSchema("MarkingValue", {
    description: "Value of a marking property: the identifier of one security marking.",
  })
);

/**
 * Runtime type of {@link MarkingValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type MarkingValue = typeof MarkingValue.Type;

/**
 * Value of a `vector` property: the components of one embedding.
 *
 * **Example** (Check the components but not the dimension)
 *
 * ```ts import.meta.vitest name="Check the components but not the dimension"
 * import * as S from "effect/Schema"
 * import { VectorValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const isVector = S.is(VectorValue)
 * const verdicts = [isVector([0.25, -0.5, 1]), isVector([]), isVector([0.25, Number.NaN])]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const VectorValue = S.Array(S.Finite).pipe(
  $I.annoteSchema("VectorValue", { description: "Value of a vector property: the components of one embedding." })
);

/**
 * Runtime type of {@link VectorValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type VectorValue = typeof VectorValue.Type;

/**
 * Value of a `vector` property with exactly `dimension` components.
 *
 * **Details**
 *
 * This is the vector rule, stated once. The property projection, the argument
 * projection and the typed spec `Model.vector` all call it, so a vector of the
 * same dimension is read by the same check wherever its type appears.
 *
 * **Example** (Hold a vector to its dimension)
 *
 * ```ts import.meta.vitest name="Hold a vector to its dimension"
 * import * as S from "effect/Schema"
 * import { VectorOf } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const isEmbedding = S.is(VectorOf(3))
 * const verdicts = [isEmbedding([0.25, -0.5, 1]), isEmbedding([0.25, -0.5]), isEmbedding([])]
 * verdicts // => [true, false, false]
 * ```
 *
 * @param dimension - Number of components every vector has.
 * @category codecs
 * @since 0.0.0
 */
export const VectorOf = (dimension: number) => VectorValue.check(S.isMinLength(dimension), S.isMaxLength(dimension));

/**
 * A comparison operand as the wire carries it: a JSON string, a finite number or a boolean.
 *
 * **Details**
 *
 * The wire types every filter operand, range bound and default as `any`. This
 * union is the exact domain of those positions for code that has no property
 * type in hand: `Type` and `Encoded` are both `string | number | boolean`, so
 * the codec is its own inverse and a schema that holds an operand round-trips
 * exactly.
 *
 * A 64-bit integer, a decimal, a calendar date and an instant all travel as
 * text, so text is what this tier holds for them. The tier that knows the
 * property's type holds the rich value: `operandCodec(type)` of the `Property`
 * concept is the codec between a wire operand and the value of the addressed
 * property, and the typed filter constructors of `Model` take the rich value
 * and write the wire scalar with the property's own codec.
 *
 * **Example** (Hold the wire scalars and refuse a rich value)
 *
 * ```ts import.meta.vitest name="Hold the wire scalars and refuse a rich value"
 * import * as S from "effect/Schema"
 * import { ScalarValue } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const isOperand = S.is(ScalarValue)
 * const scalars = [isOperand("2021-01-04"), isOperand(3.5), isOperand(true)]
 * const others = [isOperand(BigInt(7)), isOperand(Number.NaN), isOperand(null)]
 * const verdicts = [scalars, others]
 * verdicts // => [[true, true, true], [false, false, false]]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ScalarValue = S.Union([S.String, S.Finite, S.Boolean]).pipe(
  $I.annoteSchema("ScalarValue", {
    description: "A comparison operand as the wire carries it: a JSON string, a finite number or a boolean.",
  })
);

/**
 * Runtime type of {@link ScalarValue}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type ScalarValue = typeof ScalarValue.Type;
