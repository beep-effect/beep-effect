/**
 * Literal domains of the display-formatting rules a property can carry.
 *
 * **Details**
 *
 * A formatting rule never changes a stored value; it tells an application how
 * to print it. The rules reuse a handful of small closed vocabularies
 * (notation, rounding, units of a duration, calendar presets, ...). Each one is
 * declared once here: the two tag vocabularies as plain kits, and every
 * upper-case wire enum as a mapped kit that decodes to a lower-camel literal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";

const $I = $ScratchpadId.create("osdk/ValueFormat/ValueFormat.values");

// -----------------------------------------------------------------------------
// Tag vocabularies
// -----------------------------------------------------------------------------

/**
 * The kinds of value a formatting rule can print.
 *
 * **Details**
 *
 * A rule only applies to a property of the matching kind: `number` to every
 * numeric property, `timestamp` to instants, `date` to calendar dates,
 * `boolean` to booleans and `knownType` to values that hold a platform
 * identifier.
 *
 * **Example** (List the kinds of formatting rule)
 *
 * ```ts import.meta.vitest name="List the kinds of formatting rule"
 * import { ValueFormatKind } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const kinds = ValueFormatKind.literals
 * kinds // => ["number", "timestamp", "date", "boolean", "knownType"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValueFormatKind = LiteralKit(["number", "timestamp", "date", "boolean", "knownType"]).pipe(
  $I.annoteSchema("ValueFormatKind", {
    description: "The kinds of value a display-formatting rule can print.",
  })
);

/**
 * Runtime type of {@link ValueFormatKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ValueFormatKind = typeof ValueFormatKind.Type;

/**
 * The ways a number can be printed.
 *
 * **Example** (Pick the number formats that carry a unit)
 *
 * ```ts import.meta.vitest name="Pick the number formats that carry a unit"
 * import { NumberFormatKind } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const UnitKind = NumberFormatKind.pick(["currency", "standardUnit", "customUnit"])
 * const kinds = UnitKind.literals
 * kinds // => ["currency", "standardUnit", "customUnit"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumberFormatKind = LiteralKit([
  "standard",
  "fixedValues",
  "currency",
  "standardUnit",
  "customUnit",
  "affix",
  "duration",
  "scale",
  "ratio",
]).pipe(
  $I.annoteSchema("NumberFormatKind", {
    description: "The ways a number can be printed: plain, labelled, with a unit, as a duration, scaled or as a ratio.",
  })
);

/**
 * Runtime type of {@link NumberFormatKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type NumberFormatKind = typeof NumberFormatKind.Type;

// -----------------------------------------------------------------------------
// Number settings
// -----------------------------------------------------------------------------

/**
 * How the magnitude of a number is written.
 *
 * **Details**
 *
 * For 1234: `standard` prints "1,234", `scientific` and `engineering` print
 * "1.234E3" (engineering keeps the exponent a multiple of three) and `compact`
 * prints "1.2K".
 *
 * **Example** (Decode a number notation)
 *
 * ```ts import.meta.vitest name="Decode a number notation"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { NumberNotation } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const notation = await Effect.runPromise(S.decodeEffect(NumberNotation)("SCIENTIFIC"))
 * notation // => "scientific"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumberNotation = MappedLiteralKit([
  ["STANDARD", "standard"],
  ["SCIENTIFIC", "scientific"],
  ["ENGINEERING", "engineering"],
  ["COMPACT", "compact"],
]).pipe(
  $I.annoteSchema("NumberNotation", {
    description: "How the magnitude of a number is written: in full, with an exponent or abbreviated.",
  })
);

/**
 * Runtime type of {@link NumberNotation}.
 *
 * @category models
 * @since 0.0.0
 */
export type NumberNotation = typeof NumberNotation.Type;

/**
 * Which way a number is rounded when it has more digits than the format shows.
 *
 * **Details**
 *
 * `ceil` rounds toward positive infinity, `floor` toward negative infinity and
 * `roundClosest` to the closest representable value.
 *
 * **Example** (Map a rounding mode to a rounding function)
 *
 * ```ts import.meta.vitest name="Map a rounding mode to a rounding function"
 * import * as A from "effect/Array"
 * import { NumberRoundingMode } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const round = NumberRoundingMode.To.match({
 *   ceil: () => Math.ceil,
 *   floor: () => Math.floor,
 *   roundClosest: () => Math.round,
 * })
 * const rounded = A.map(NumberRoundingMode.Pairs, ([, mode]) => round(mode)(2.5))
 * rounded // => [3, 2, 3]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumberRoundingMode = MappedLiteralKit([
  ["CEIL", "ceil"],
  ["FLOOR", "floor"],
  ["ROUND_CLOSEST", "roundClosest"],
]).pipe(
  $I.annoteSchema("NumberRoundingMode", {
    description: "Which way a number is rounded when it has more digits than the format shows.",
  })
);

/**
 * Runtime type of {@link NumberRoundingMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type NumberRoundingMode = typeof NumberRoundingMode.Type;

/**
 * How a currency amount is abbreviated.
 *
 * **Details**
 *
 * The platform documents `standard` as "USD 1,234.56" and `compact` as
 * "USD 1.2K". This axis is independent of {@link NumberNotation}, which also
 * has a `compact` literal.
 *
 * **Example** (Decode a currency style)
 *
 * ```ts import.meta.vitest name="Decode a currency style"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CurrencyStyle } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const style = await Effect.runPromise(S.decodeEffect(CurrencyStyle)("COMPACT"))
 * style // => "compact"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CurrencyStyle = MappedLiteralKit([
  ["STANDARD", "standard"],
  ["COMPACT", "compact"],
]).pipe(
  $I.annoteSchema("CurrencyStyle", {
    description: "How a currency amount is abbreviated: written in full or compacted.",
  })
);

/**
 * Runtime type of {@link CurrencyStyle}.
 *
 * @category models
 * @since 0.0.0
 */
export type CurrencyStyle = typeof CurrencyStyle.Type;

/**
 * Power of ten a number is divided by before it is printed with a magnitude suffix.
 *
 * **Details**
 *
 * `thousands` prints 1500 as "1.5K", `millions` divides by a million ("M") and
 * `billions` by a billion ("B").
 *
 * **Example** (Find the divisor of a scale)
 *
 * ```ts import.meta.vitest name="Find the divisor of a scale"
 * import { NumberScale } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const divisorOf = NumberScale.To.match({
 *   thousands: () => 1e3,
 *   millions: () => 1e6,
 *   billions: () => 1e9,
 * })
 * const scaled = 1500 / divisorOf("thousands")
 * scaled // => 1.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumberScale = MappedLiteralKit([
  ["THOUSANDS", "thousands"],
  ["MILLIONS", "millions"],
  ["BILLIONS", "billions"],
]).pipe(
  $I.annoteSchema("NumberScale", {
    description: "Power of ten a number is divided by before it is printed with a magnitude suffix.",
  })
);

/**
 * Runtime type of {@link NumberScale}.
 *
 * @category models
 * @since 0.0.0
 */
export type NumberScale = typeof NumberScale.Type;

/**
 * Proportion a fraction is printed as.
 *
 * **Details**
 *
 * `percentage` multiplies by 100 ("%"), `perMille` by 1000 ("‰") and
 * `basisPoints` by 10000 ("bps"), so 0.15 prints as "15%".
 *
 * **Example** (Find the multiplier of a ratio)
 *
 * ```ts import.meta.vitest name="Find the multiplier of a ratio"
 * import * as A from "effect/Array"
 * import { NumberRatio } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const multiplierOf = NumberRatio.To.match({
 *   percentage: () => 100,
 *   perMille: () => 1000,
 *   basisPoints: () => 10000,
 * })
 * const multipliers = A.map(NumberRatio.Pairs, ([, ratio]) => multiplierOf(ratio))
 * multipliers // => [100, 1000, 10000]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumberRatio = MappedLiteralKit([
  ["PERCENTAGE", "percentage"],
  ["PER_MILLE", "perMille"],
  ["BASIS_POINTS", "basisPoints"],
]).pipe(
  $I.annoteSchema("NumberRatio", {
    description: "Proportion a fraction is printed as: per hundred, per thousand or per ten thousand.",
  })
);

/**
 * Runtime type of {@link NumberRatio}.
 *
 * @category models
 * @since 0.0.0
 */
export type NumberRatio = typeof NumberRatio.Type;

// -----------------------------------------------------------------------------
// Durations
// -----------------------------------------------------------------------------

/**
 * Finest unit a printed duration may show.
 *
 * **Details**
 *
 * The wire calls this the maximum precision of the formatted duration. `auto`
 * leaves the choice to the platform.
 *
 * **Example** (Decode a duration precision)
 *
 * ```ts import.meta.vitest name="Decode a duration precision"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DurationPrecision } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const precision = await Effect.runPromise(S.decodeEffect(DurationPrecision)("MINUTES"))
 * precision // => "minutes"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DurationPrecision = MappedLiteralKit([
  ["DAYS", "days"],
  ["HOURS", "hours"],
  ["MINUTES", "minutes"],
  ["SECONDS", "seconds"],
  ["AUTO", "auto"],
]).pipe(
  $I.annoteSchema("DurationPrecision", {
    description: "Finest unit a printed duration may show, or `auto` to leave the choice to the platform.",
  })
);

/**
 * Runtime type of {@link DurationPrecision}.
 *
 * @category models
 * @since 0.0.0
 */
export type DurationPrecision = typeof DurationPrecision.Type;

/**
 * Unit the stored number of a duration property is counted in.
 *
 * **Example** (Convert a stored duration to milliseconds)
 *
 * ```ts import.meta.vitest name="Convert a stored duration to milliseconds"
 * import { DurationInputUnit } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const millisPer = DurationInputUnit.To.match({ seconds: () => 1000, milliseconds: () => 1 })
 * const millis = 90 * millisPer("seconds")
 * millis // => 90000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DurationInputUnit = MappedLiteralKit([
  ["SECONDS", "seconds"],
  ["MILLISECONDS", "milliseconds"],
]).pipe(
  $I.annoteSchema("DurationInputUnit", {
    description: "Unit the stored number of a duration property is counted in.",
  })
);

/**
 * Runtime type of {@link DurationInputUnit}.
 *
 * @category models
 * @since 0.0.0
 */
export type DurationInputUnit = typeof DurationInputUnit.Type;

// -----------------------------------------------------------------------------
// Dates and instants
// -----------------------------------------------------------------------------

/**
 * Predefined, locale-aware ways to print a calendar date or an instant.
 *
 * **Details**
 *
 * Every wire word starts with `DATE_FORMAT_`, and so does every literal here:
 * a mapped enum's literal is the lowerCamel form of the wire word, nothing else.
 *
 * - `dateFormatRelativeToNow`: "5 minutes ago" within a day of now, an absolute date and time beyond that
 * - `dateFormatDate`: weekday, day, month and year
 * - `dateFormatYearAndMonth`: month and year
 * - `dateFormatDateTime`: `dateFormatDate` plus hours, minutes and seconds
 * - `dateFormatDateTimeShort`: day, month, year, hours and minutes (no weekday, no seconds)
 * - `dateFormatTime`: hours, minutes and seconds
 * - `dateFormatIsoInstant`: the ISO 8601 instant, independent of locale and time zone
 *
 * **Example** (Decode a datetime preset)
 *
 * ```ts import.meta.vitest name="Decode a datetime preset"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DatetimePreset } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const preset = await Effect.runPromise(S.decodeEffect(DatetimePreset)("DATE_FORMAT_YEAR_AND_MONTH"))
 * preset // => "dateFormatYearAndMonth"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DatetimePreset = MappedLiteralKit([
  ["DATE_FORMAT_RELATIVE_TO_NOW", "dateFormatRelativeToNow"],
  ["DATE_FORMAT_DATE", "dateFormatDate"],
  ["DATE_FORMAT_YEAR_AND_MONTH", "dateFormatYearAndMonth"],
  ["DATE_FORMAT_DATE_TIME", "dateFormatDateTime"],
  ["DATE_FORMAT_DATE_TIME_SHORT", "dateFormatDateTimeShort"],
  ["DATE_FORMAT_TIME", "dateFormatTime"],
  ["DATE_FORMAT_ISO_INSTANT", "dateFormatIsoInstant"],
]).pipe(
  $I.annoteSchema("DatetimePreset", {
    description: "Predefined, locale-aware ways to print a calendar date or an instant.",
  })
);

/**
 * Runtime type of {@link DatetimePreset}.
 *
 * @category models
 * @since 0.0.0
 */
export type DatetimePreset = typeof DatetimePreset.Type;

// -----------------------------------------------------------------------------
// Platform identifiers
// -----------------------------------------------------------------------------

/**
 * Kind of platform identifier a string property holds, so applications can print the thing it names.
 *
 * **Details**
 *
 * `userOrGroupId` renders the identified user or group, `resourceRid` the
 * platform resource behind a resource identifier and `artifactGid` the artifact
 * behind a global artifact identifier. Resolving any of them needs a lookup
 * service.
 *
 * **Example** (Decode a known identifier kind)
 *
 * ```ts import.meta.vitest name="Decode a known identifier kind"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { KnownType } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const kind = await Effect.runPromise(S.decodeEffect(KnownType)("USER_OR_GROUP_ID"))
 * kind // => "userOrGroupId"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnownType = MappedLiteralKit([
  ["USER_OR_GROUP_ID", "userOrGroupId"],
  ["RESOURCE_RID", "resourceRid"],
  ["ARTIFACT_GID", "artifactGid"],
]).pipe(
  $I.annoteSchema("KnownType", {
    description: "Kind of platform identifier a string property holds: a user or group, a resource or an artifact.",
  })
);

/**
 * Runtime type of {@link KnownType}.
 *
 * @category models
 * @since 0.0.0
 */
export type KnownType = typeof KnownType.Type;
