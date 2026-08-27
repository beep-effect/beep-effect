/**
 * Lexical schemas and Effect codecs for WHATWG HTML microdata values, the
 * W3C Microdata-to-RDF XSD subsets, and RFC 6350 vCard VALUE types. Pick a
 * `*String` filter for a spelling, `MicrodataXsd*` when RDF typing requires
 * XML Schema, or a `*FromString` codec when the decoded value should be
 * Duration, DateTime, bigint, URL, or another runtime type.
 *
 * **Gotchas**
 *
 * Lexical spaces without specification bounds remain unbounded. A
 * multi-megabyte year, TEXT-CHAR, URL token, or integer lexeme still
 * decodes; apply payload-size budgets at the transport layer, not in these
 * filters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Double } from "@beep/schema/Double";
import { Int64 } from "@beep/schema/Int";
import { UriReferenceString } from "@beep/schema/JSONSchema";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import {
  BigDecimal,
  BigInt as BInt,
  DateTime,
  Duration,
  Effect,
  Match,
  Number as Num,
  SchemaGetter,
  SchemaIssue,
  SchemaParser,
} from "effect";
import * as A from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("microdata/Microdata.model");

const asciiWhitespacePattern = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;
const htmlYearPattern = /^\d{4,}$/;
const htmlMonthPattern = /^(\d{4,})-(\d{2})$/;
const htmlDatePattern = /^(\d{4,})-(\d{2})-(\d{2})$/;
const htmlYearlessDatePattern = /^(?:--)?(\d{2})-(\d{2})$/;
const htmlTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/;
const htmlLocalDateTimePattern = /^(\d{4,}-\d{2}-\d{2})[T ](.+)$/;
const htmlTimeZoneOffsetPattern = /^(?:Z|\+(?:[01]\d|2[0-3]):?[0-5]\d|-(?!00:?00$)(?:[01]\d|2[0-3]):?[0-5]\d)$/;
const htmlGlobalDateTimePattern = /^(\d{4,}-\d{2}-\d{2})[T ](.+?)(Z|[+-]\d{2}:?\d{2})$/;
const htmlWeekPattern = /^(\d{4,})-W(\d{2})$/;
const htmlIsoDurationPattern = /^P(?=\d+D|T\d)(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d{1,3})?S)?)?$/;
const htmlDurationComponentPattern = /([0-9]+(?:\.[0-9]{1,3})?)[\t\n\f\r ]*([WwDdHhMmSs])/g;
const xsdIntegerPattern = /^[+-]?\d+$/;
const xsdDoublePattern = /^(?:[+-]?INF|NaN|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/;

const vCardYearPattern = /^\d{4}$/;
const vCardMonthPattern = /^(?:0[1-9]|1[0-2])$/;
const vCardDayPattern = /^(?:0[1-9]|[12]\d|3[01])$/;
const vCardIntegerPattern = /^[+-]?\d+$/;
const vCardFloatPattern = /^[+-]?\d+(?:\.\d+)?$/;
const vCardUtcOffsetPattern = /^[+-](?:[01]\d|2[0-3])(?:[0-5]\d)?$/;
const vCardTextPattern =
  /^(?:[\t ]|[\x21-\x2B]|[\x2D-\x5B]|[\x5D-\x7E]|[\u0080-\uD7FF\uE000-\uFFFF]|[\u{10000}-\u{10FFFF}]|\\(?:\\|,|[nN]))*$/u;
const vCardUriSchemePattern = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const privateLanguageTagPattern = /^x(?:-[A-Za-z0-9]{1,8})+$/i;
const rfc5646LanguageTagPattern =
  /^(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3}){0,3}|[A-Za-z]{4}|[A-Za-z]{5,8})(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|\d{3}))?(?:-(?:[A-Za-z0-9]{5,8}|\d[A-Za-z0-9]{3}))*(?:-[0-9A-WY-Za-wy-z](?:-[A-Za-z0-9]{2,8})+)*(?:-x(?:-[A-Za-z0-9]{1,8})+)?$/i;
const rfc5646VariantPattern = /^(?:[A-Za-z0-9]{5,8}|\d[A-Za-z0-9]{3})$/;
const rfc5646ExtensionSingletonPattern = /^[0-9A-WY-Za-wy-z]$/;
const GrandfatheredLanguageTagBase = LiteralKit([
  "art-lojban",
  "cel-gaulish",
  "en-gb-oed",
  "i-ami",
  "i-bnn",
  "i-default",
  "i-enochian",
  "i-hak",
  "i-klingon",
  "i-lux",
  "i-mingo",
  "i-navajo",
  "i-pwn",
  "i-tao",
  "i-tay",
  "i-tsu",
  "no-bok",
  "no-nyn",
  "sgn-be-fr",
  "sgn-be-nl",
  "sgn-ch-de",
  "zh-guoyu",
  "zh-hakka",
  "zh-min",
  "zh-min-nan",
  "zh-xiang",
]);
const GrandfatheredLanguageTag = GrandfatheredLanguageTagBase.pipe(
  $I.annoteSchema("GrandfatheredLanguageTag", {
    description: "Grandfathered language tags admitted by RFC 5646 and RFC 6350.",
  }),
  SchemaUtils.withLiteralKitStatics(GrandfatheredLanguageTagBase)
);
const isGrandfatheredLanguageTag = S.is(GrandfatheredLanguageTag);

const invalidValue = (message: string): SchemaIssue.InvalidValue => new SchemaIssue.InvalidValue({ message });

const capture = (match: O.Option<RegExpMatchArray>, index: number): O.Option<string> =>
  pipe(
    match,
    O.flatMap((parts) => O.fromNullishOr(parts[index]))
  );

const parseDecimalNumber = flow(Num.parse, O.filter(S.is(S.Finite)));

const isValidBcp47LanguageTag = (value: string): boolean => {
  if (isGrandfatheredLanguageTag(Str.toLowerCase(value)) || privateLanguageTagPattern.test(value)) return true;
  if (!rfc5646LanguageTagPattern.test(value)) return false;

  const beforePrivateUse = pipe(
    value,
    Str.toLowerCase,
    Str.split("-"),
    A.drop(1),
    A.takeWhile((subtag) => subtag !== "x")
  );
  const variants = pipe(
    beforePrivateUse,
    A.takeWhile((subtag) => !rfc5646ExtensionSingletonPattern.test(subtag)),
    A.filter((subtag) => rfc5646VariantPattern.test(subtag))
  );
  const extensionSingletons = A.filter(beforePrivateUse, (subtag) => rfc5646ExtensionSingletonPattern.test(subtag));

  return (
    A.length(A.dedupe(variants)) === A.length(variants) &&
    A.length(A.dedupe(extensionSingletons)) === A.length(extensionSingletons)
  );
};

// crispen: These predicates implement cross-field calendar rules used to construct the schemas themselves.
const isLeapYear = (year: bigint): boolean => year % 400n === 0n || (year % 4n === 0n && year % 100n !== 0n);

const daysInMonth = (year: bigint, month: number): number => {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return A.contains([4, 6, 9, 11], month) ? 30 : 31;
};

const isHtmlYear = (value: string): boolean =>
  htmlYearPattern.test(value) &&
  pipe(
    BInt.fromString(value),
    O.exists((year) => year > 0n)
  );

const isHtmlMonth = (value: string): boolean => {
  const match = Str.match(htmlMonthPattern)(value);
  return pipe(
    O.all({ year: capture(match, 1), month: capture(match, 2) }),
    O.exists(
      ({ year, month }) =>
        isHtmlYear(year) && pipe(parseDecimalNumber(month), O.exists(Num.between({ minimum: 1, maximum: 12 })))
    )
  );
};

const isHtmlDate = (value: string): boolean => {
  const match = Str.match(htmlDatePattern)(value);
  return pipe(
    O.all({
      year: capture(match, 1),
      month: capture(match, 2),
      day: capture(match, 3),
    }),
    O.flatMap(({ year, month, day }) =>
      O.all({
        year: BInt.fromString(year),
        month: parseDecimalNumber(month),
        day: parseDecimalNumber(day),
      })
    ),
    O.exists(
      ({ year, month, day }) =>
        year > 0n &&
        Num.between({ minimum: 1, maximum: 12 })(month) &&
        Num.between({ minimum: 1, maximum: daysInMonth(year, month) })(day)
    )
  );
};

const isHtmlYearlessDate = (value: string): boolean => {
  const match = Str.match(htmlYearlessDatePattern)(value);
  return pipe(
    O.all({ month: capture(match, 1), day: capture(match, 2) }),
    O.flatMap(({ month, day }) =>
      O.all({
        month: parseDecimalNumber(month),
        day: parseDecimalNumber(day),
      })
    ),
    O.exists(
      ({ month, day }) =>
        Num.between({ minimum: 1, maximum: 12 })(month) &&
        Num.between({ minimum: 1, maximum: daysInMonth(2000n, month) })(day)
    )
  );
};

const isHtmlLocalDateTime = (value: string): boolean => {
  const match = Str.match(htmlLocalDateTimePattern)(value);
  return pipe(
    O.all({ date: capture(match, 1), time: capture(match, 2) }),
    O.exists(({ date, time }) => isHtmlDate(date) && htmlTimePattern.test(time))
  );
};

const isHtmlGlobalDateTime = (value: string): boolean => {
  const match = Str.match(htmlGlobalDateTimePattern)(value);
  return pipe(
    O.all({
      date: capture(match, 1),
      time: capture(match, 2),
      zone: capture(match, 3),
    }),
    O.exists(
      ({ date, time, zone }) => isHtmlDate(date) && htmlTimePattern.test(time) && htmlTimeZoneOffsetPattern.test(zone)
    )
  );
};

const maximumIsoWeek = (year: bigint): number => {
  const priorYear = year - 1n;
  const januaryFirst = Num.Number((year + priorYear / 4n - priorYear / 100n + priorYear / 400n) % 7n);
  return januaryFirst === 4 || (januaryFirst === 3 && isLeapYear(year)) ? 53 : 52;
};

const isHtmlWeek = (value: string): boolean => {
  const match = Str.match(htmlWeekPattern)(value);
  return pipe(
    O.all({ year: capture(match, 1), week: capture(match, 2) }),
    O.flatMap(({ year, week }) =>
      O.all({
        year: BInt.fromString(year),
        week: parseDecimalNumber(week),
      })
    ),
    O.exists(({ year, week }) => year > 0n && Num.between({ minimum: 1, maximum: maximumIsoWeek(year) })(week))
  );
};

const htmlDurationComponents = (value: string): ReadonlyArray<readonly [string, HtmlDurationUnit]> =>
  pipe(
    Str.matchAll(htmlDurationComponentPattern)(value),
    A.fromIterable,
    A.map((match) =>
      pipe(
        O.all({
          amount: O.fromNullishOr(match[1]),
          unit: O.fromNullishOr(match[2]).pipe(O.flatMap(htmlDurationUnit)),
        }),
        O.map(({ amount, unit }) => [amount, unit] as const)
      )
    ),
    A.getSomes
  );

const isHtmlHumanDuration = (value: string): boolean => {
  const components = htmlDurationComponents(value);
  const consumed = pipe(value, Str.replace(htmlDurationComponentPattern, ""), Str.replace(/[\t\n\f\r ]/g, ""));
  const units = pipe(
    components,
    A.map(([, unit]) => unit)
  );
  return (
    A.isReadonlyArrayNonEmpty(components) &&
    Str.isEmpty(consumed) &&
    A.length(A.dedupe(units)) === A.length(units) &&
    A.every(components, ([amount, unit]) => unit === "S" || !Str.includes(".")(amount))
  );
};

const makeStringCheck = (identifier: string, expected: string, predicate: (value: string) => boolean) =>
  S.makeFilter(predicate, {
    identifier,
    title: expected,
    description: `Accepts ${expected}.`,
    expected,
    message: `Expected ${expected}`,
  });

const makePatternCheck = (identifier: string, expected: string, pattern: RegExp) =>
  S.isPattern(pattern, {
    identifier,
    title: expected,
    description: `Accepts ${expected}.`,
    expected,
    message: `Expected ${expected}`,
  });

const stripAsciiWhitespace = Str.replace(asciiWhitespacePattern, "");
const isAbsoluteUrlString = flow(S.decodeUnknownOption(S.URLFromString), O.isSome);

/**
 * WHATWG positive year microsyntax with at least four ASCII digits.
 *
 * **Example** (Decode an HTML year)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlYearString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlYearString.decodeUnknownEffect("2024"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataXsdYearString} for the xsd:gYear subset required by Microdata-to-RDF.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlYearString = S.String.check(
  makeStringCheck($I`HtmlYearStringCheck`, "a valid HTML year string", isHtmlYear)
).pipe(
  S.brand("HtmlYearString"),
  $I.annoteSchema("HtmlYearString", {
    description: "Positive proleptic-Gregorian year in the WHATWG HTML lexical form.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlYearString}.
 *
 * @see {@link HtmlYearString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlYearString = typeof HtmlYearString.Type;

/**
 * WHATWG month microsyntax.
 *
 * **Example** (Decode an HTML month)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlMonthString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlMonthString.decodeUnknownEffect("2024-02"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataXsdYearMonthString} for the xsd:gYearMonth subset required by Microdata-to-RDF.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlMonthString = S.String.check(
  makeStringCheck($I`HtmlMonthStringCheck`, "a valid HTML month string", isHtmlMonth)
).pipe(
  S.brand("HtmlMonthString"),
  $I.annoteSchema("HtmlMonthString", {
    description: "Proleptic-Gregorian year and month in the WHATWG HTML lexical form.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlMonthString}.
 *
 * @see {@link HtmlMonthString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlMonthString = typeof HtmlMonthString.Type;

/**
 * WHATWG proleptic-Gregorian date microsyntax with calendar validation.
 *
 * **Example** (Decode a calendar-valid HTML date)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlDateString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlDateString.decodeUnknownEffect("2024-02-29"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataXsdDateString} for the xsd:date subset required by Microdata-to-RDF.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlDateString = S.String.check(
  makeStringCheck($I`HtmlDateStringCheck`, "a valid HTML date string", isHtmlDate)
).pipe(
  S.brand("HtmlDateString"),
  $I.annoteSchema("HtmlDateString", {
    description: "Calendar-valid proleptic-Gregorian date in the WHATWG HTML lexical form.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlDateString}.
 *
 * @see {@link HtmlDateString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlDateString = typeof HtmlDateString.Type;

/**
 * WHATWG yearless date microsyntax. February 29 is valid in this domain.
 *
 * **Example** (Decode an HTML yearless date)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlYearlessDateString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlYearlessDateString.decodeUnknownEffect("--02-29"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlYearlessDateString = S.String.check(
  makeStringCheck($I`HtmlYearlessDateStringCheck`, "a valid HTML yearless date string", isHtmlYearlessDate)
).pipe(
  S.brand("HtmlYearlessDateString"),
  $I.annoteSchema("HtmlYearlessDateString", {
    description: "Month and day in the WHATWG HTML yearless-date lexical form.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlYearlessDateString}.
 *
 * @see {@link HtmlYearlessDateString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlYearlessDateString = typeof HtmlYearlessDateString.Type;

/**
 * WHATWG time microsyntax. Leap seconds and fractions beyond milliseconds are rejected.
 *
 * **Example** (Decode an HTML time)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlTimeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlTimeString.decodeUnknownEffect("12:30:45.125"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataXsdTimeString} for the xsd:time subset required by Microdata-to-RDF.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlTimeString = S.String.check(
  makePatternCheck($I`HtmlTimeStringCheck`, "a valid HTML time string", htmlTimePattern)
).pipe(
  S.brand("HtmlTimeString"),
  $I.annoteSchema("HtmlTimeString", {
    description: "Time of day in the WHATWG HTML lexical form at millisecond precision.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlTimeString}.
 *
 * @see {@link HtmlTimeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlTimeString = typeof HtmlTimeString.Type;

/**
 * WHATWG local date-time microsyntax, including its permitted space separator.
 *
 * **Example** (Decode an HTML local date-time)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlLocalDateTimeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlLocalDateTimeString.decodeUnknownEffect("2024-02-29 12:30"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataXsdDateTimeString} for the xsd:dateTime subset (requires seconds and a `T` separator).
 * @category schemas
 * @since 0.0.0
 */
export const HtmlLocalDateTimeString = S.String.check(
  makeStringCheck($I`HtmlLocalDateTimeStringCheck`, "a valid HTML local date and time string", isHtmlLocalDateTime)
).pipe(
  S.brand("HtmlLocalDateTimeString"),
  $I.annoteSchema("HtmlLocalDateTimeString", { description: "Local date and time in the WHATWG HTML lexical form." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlLocalDateTimeString}.
 *
 * @see {@link HtmlLocalDateTimeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlLocalDateTimeString = typeof HtmlLocalDateTimeString.Type;

/**
 * WHATWG time-zone offset microsyntax, including offsets through 23:59.
 *
 * **Gotchas**
 *
 * Negative zero (`-00:00` / `-0000`) is rejected; use `Z` or `+00:00`.
 *
 * **Example** (Decode an HTML time-zone offset)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlTimeZoneOffsetString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlTimeZoneOffsetString.decodeUnknownEffect("+05:30"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardUtcOffsetString} for the RFC 6350 `±HHMM` form without `Z`, which admits `-0000`.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlTimeZoneOffsetString = S.String.check(
  makePatternCheck($I`HtmlTimeZoneOffsetStringCheck`, "a valid HTML time-zone offset string", htmlTimeZoneOffsetPattern)
).pipe(
  S.brand("HtmlTimeZoneOffsetString"),
  $I.annoteSchema("HtmlTimeZoneOffsetString", { description: "Time-zone offset in the WHATWG HTML lexical form." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlTimeZoneOffsetString}.
 *
 * @see {@link HtmlTimeZoneOffsetString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlTimeZoneOffsetString = typeof HtmlTimeZoneOffsetString.Type;

/**
 * WHATWG global date-time microsyntax with a required time-zone offset.
 *
 * **Example** (Decode an HTML global date-time)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlGlobalDateTimeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlGlobalDateTimeString.decodeUnknownEffect("2024-02-29T12:30:45Z"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataDateTimeFromString} to decode the lexeme to `DateTime.Utc`; {@link MicrodataXsdDateTimeString} for the xsd:dateTime subset used by Microdata-to-RDF.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlGlobalDateTimeString = S.String.check(
  makeStringCheck($I`HtmlGlobalDateTimeStringCheck`, "a valid HTML global date and time string", isHtmlGlobalDateTime)
).pipe(
  S.brand("HtmlGlobalDateTimeString"),
  $I.annoteSchema("HtmlGlobalDateTimeString", {
    description: "Globally qualified date and time in the WHATWG HTML lexical form.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlGlobalDateTimeString}.
 *
 * @see {@link HtmlGlobalDateTimeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlGlobalDateTimeString = typeof HtmlGlobalDateTimeString.Type;

/**
 * WHATWG ISO week microsyntax with the correct 52- or 53-week bound.
 *
 * **Example** (Decode an HTML week)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlWeekString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlWeekString.decodeUnknownEffect("2024-W01"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlWeekString = S.String.check(
  makeStringCheck($I`HtmlWeekStringCheck`, "a valid HTML week string", isHtmlWeek)
).pipe(
  S.brand("HtmlWeekString"),
  $I.annoteSchema("HtmlWeekString", { description: "Calendar-valid ISO week in the WHATWG HTML lexical form." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlWeekString}.
 *
 * @see {@link HtmlWeekString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlWeekString = typeof HtmlWeekString.Type;

const HtmlDurationUnitBase = LiteralKit(["W", "D", "H", "M", "S"]);

/**
 * Units admitted by the human-readable WHATWG duration syntax.
 *
 * **Example** (Decode a duration unit)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { HtmlDurationUnit } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(S.decodeUnknownEffect(HtmlDurationUnit)("H"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlDurationUnit = HtmlDurationUnitBase.pipe(
  $I.annoteSchema("HtmlDurationUnit", {
    description: "Units admitted by the human-readable WHATWG duration syntax.",
  }),
  SchemaUtils.withLiteralKitStatics(HtmlDurationUnitBase)
);

/**
 * Decoded value produced by {@link HtmlDurationUnit}.
 *
 * @see {@link HtmlDurationUnit} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlDurationUnit = typeof HtmlDurationUnit.Type;

const htmlDurationUnit = flow(Str.toUpperCase, O.liftPredicate(S.is(HtmlDurationUnit)));

/**
 * Restricted ISO 8601 duration syntax admitted by HTML. Years and months are excluded.
 *
 * **Example** (Decode an ISO-form HTML duration)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlIsoDurationString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlIsoDurationString.decodeUnknownEffect("PT1H"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlHumanDurationString} for the unordered unique-scale human form; {@link HtmlDurationString} to accept either spelling.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlIsoDurationString = S.String.check(
  makePatternCheck($I`HtmlIsoDurationStringCheck`, "a valid HTML ISO duration string", htmlIsoDurationPattern)
).pipe(
  S.brand("HtmlIsoDurationString"),
  $I.annoteSchema("HtmlIsoDurationString", {
    description: "Restricted ISO 8601 duration lexical form admitted by HTML.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlIsoDurationString}.
 *
 * @see {@link HtmlIsoDurationString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlIsoDurationString = typeof HtmlIsoDurationString.Type;

/**
 * Human-readable WHATWG duration syntax with unique scales in any order.
 *
 * **Gotchas**
 *
 * Only the `S` scale may include a `.` fraction, at most three digits.
 * Duplicate scales still fail.
 *
 * **Example** (Decode a human-readable HTML duration)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlHumanDurationString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlHumanDurationString.decodeUnknownEffect("1h 30m"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlIsoDurationString} for the restricted ISO form; {@link MicrodataDurationFromString} to decode either spelling to an Effect Duration.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlHumanDurationString = S.String.check(
  makeStringCheck($I`HtmlHumanDurationStringCheck`, "a valid HTML human-readable duration string", isHtmlHumanDuration)
).pipe(
  S.brand("HtmlHumanDurationString"),
  $I.annoteSchema("HtmlHumanDurationString", { description: "Human-readable duration lexical form admitted by HTML." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlHumanDurationString}.
 *
 * @see {@link HtmlHumanDurationString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlHumanDurationString = typeof HtmlHumanDurationString.Type;

/**
 * Either duration lexical form accepted by the HTML Standard.
 *
 * **Example** (Decode either HTML duration form)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlDurationString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlDurationString.decodeUnknownEffect("PT1H"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataDurationFromString} to decode either HTML duration lexeme to an Effect Duration.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlDurationString = S.Union([HtmlIsoDurationString, HtmlHumanDurationString]).pipe(
  $I.annoteSchema("HtmlDurationString", { description: "Either duration lexical form admitted by the HTML Standard." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlDurationString}.
 *
 * @see {@link HtmlDurationString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlDurationString = typeof HtmlDurationString.Type;

/**
 * URL parser input after the HTML ASCII-whitespace preprocessing step.
 *
 * **Example** (Decode a URL parser token)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlUrlTokenString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlUrlTokenString.decodeUnknownEffect("/item"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlUrlPotentiallySurroundedBySpaces} to strip surrounding ASCII whitespace before treating the token as parser input.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlUrlTokenString = S.String.pipe(
  S.check(
    makeStringCheck(
      $I`HtmlUrlTokenStringCheck`,
      "a URL parser token without surrounding ASCII whitespace",
      (value) => stripAsciiWhitespace(value) === value
    )
  ),
  S.brand("HtmlUrlTokenString"),
  $I.annoteSchema("HtmlUrlTokenString", {
    description: "URL parser input after HTML ASCII-whitespace preprocessing, including an empty relative URL.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlUrlTokenString}.
 *
 * @see {@link HtmlUrlTokenString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlUrlTokenString = typeof HtmlUrlTokenString.Type;

/**
 * HTML URL preprocessing that strips only leading and trailing ASCII whitespace.
 *
 * **Example** (Strip surrounding ASCII whitespace)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { HtmlUrlPotentiallySurroundedBySpaces } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(HtmlUrlPotentiallySurroundedBySpaces.decodeUnknownEffect("  /item  "))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlUrlTokenString} for the already-stripped parser token; {@link makeHtmlUrlFromString} to resolve it against a document base.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlUrlPotentiallySurroundedBySpaces = S.String.pipe(
  S.decodeTo(HtmlUrlTokenString, {
    decode: SchemaGetter.transform(stripAsciiWhitespace),
    encode: SchemaGetter.passthroughSubtype(),
  }),
  $I.annoteSchema("HtmlUrlPotentiallySurroundedBySpaces", {
    description: "HTML URL text decoded after stripping surrounding ASCII whitespace.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link HtmlUrlPotentiallySurroundedBySpaces}.
 *
 * @see {@link HtmlUrlPotentiallySurroundedBySpaces} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlUrlPotentiallySurroundedBySpaces = typeof HtmlUrlPotentiallySurroundedBySpaces.Type;

/**
 * Builds a WHATWG URL codec using the document URL as the parser base.
 *
 * **Details**
 *
 * The base is required because a valid HTML URL can be relative. Decoding
 * strips ASCII whitespace, resolves the token, and returns a platform URL.
 * An empty post-strip token is valid and resolves to the base itself.
 *
 * **Example** (Resolve a relative URL)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeHtmlUrlFromString } from "./Microdata.model.ts"
 *
 * const HtmlUrlFromString = makeHtmlUrlFromString(new URL("https://example.com/base/"))
 * const value = Effect.runSync(HtmlUrlFromString.decodeUnknownEffect("../item"))
 *
 * console.log(value.href) // "https://example.com/item"
 * ```
 *
 * @see {@link MicrodataUrlFromString} for already-absolute microdata URL properties that do not need a document base.
 * @category constructors
 * @since 0.0.0
 */
export const makeHtmlUrlFromString = (base: URL) =>
  HtmlUrlPotentiallySurroundedBySpaces.pipe(
    S.decodeTo(S.URLFromString, {
      decode: SchemaGetter.transformOrFail((value) =>
        Effect.try({
          try: () => new URL(value, base).href,
          catch: () => invalidValue("Could not parse the HTML URL relative to its document base"),
        })
      ),
      encode: SchemaGetter.transformOrFail(SchemaParser.decodeEffect(HtmlUrlTokenString)),
    }),
    $I.annoteSchema("HtmlUrlFromString", { description: "WHATWG URL resolved against an explicit document base." }),
    SchemaUtils.withEffectCodecStatics
  );

/**
 * Serialized absolute WHATWG URL emitted by the microdata value algorithm.
 *
 * **Example** (Decode a serialized microdata URL)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataSerializedUrlString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataSerializedUrlString.decodeUnknownEffect("https://example.com/item"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link makeHtmlUrlFromString} to resolve document-relative HTML URLs; {@link MicrodataUrlFromString} to decode this serialized form to a platform URL.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataSerializedUrlString = S.String.pipe(
  S.check(
    makeStringCheck(
      $I`MicrodataSerializedUrlStringCheck`,
      "an absolute serialized URL without surrounding ASCII whitespace",
      (value) => HtmlUrlTokenString.is(value) && isAbsoluteUrlString(value)
    )
  ),
  S.brand("MicrodataSerializedUrlString"),
  $I.annoteSchema("MicrodataSerializedUrlString", {
    description: "Absolute serialized URL emitted by the HTML microdata value algorithm.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataSerializedUrlString}.
 *
 * @see {@link MicrodataSerializedUrlString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataSerializedUrlString = typeof MicrodataSerializedUrlString.Type;

/**
 * Absolute serialized URL produced by the WHATWG microdata value algorithm.
 *
 * **Example** (Decode a microdata URL)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataUrlFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataUrlFromString.decodeUnknownEffect("https://example.com/item"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link makeHtmlUrlFromString} to resolve document-relative HTML URLs against a parser base.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataUrlFromString = MicrodataSerializedUrlString.pipe(
  S.decodeTo(S.URLFromString, {
    decode: SchemaGetter.passthroughSubtype(),
    encode: SchemaGetter.transformOrFail(SchemaParser.decodeEffect(MicrodataSerializedUrlString)),
  }),
  $I.annoteSchema("MicrodataUrlFromString", {
    description: "Microdata URL-property string decoded to a platform URL.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataUrlFromString}.
 *
 * @see {@link MicrodataUrlFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataUrlFromString = typeof MicrodataUrlFromString.Type;

const nanosecondsPerMillisecond = 1_000_000n;
const nanosecondsPerSecond = 1_000_000_000n;
const nanosecondsPerMinute = 60n * nanosecondsPerSecond;
const nanosecondsPerHour = 60n * nanosecondsPerMinute;
const nanosecondsPerDay = 24n * nanosecondsPerHour;

const durationUnitNanoseconds = HtmlDurationUnit.$match({
  W: () => 7n * nanosecondsPerDay,
  D: () => nanosecondsPerDay,
  H: () => nanosecondsPerHour,
  M: () => nanosecondsPerMinute,
  S: () => nanosecondsPerSecond,
});

const parseDurationAmount = (amount: string, unit: HtmlDurationUnit): O.Option<bigint> => {
  const match = Str.match(/^(\d+)(?:\.(\d{1,3}))?$/)(amount);
  return pipe(
    capture(match, 1),
    O.flatMap(BInt.fromString),
    O.map((whole) => {
      const fractionMilliseconds = pipe(
        capture(match, 2),
        O.map((digits) => BInt.BigInt(Str.padEnd(3, "0")(digits))),
        O.getOrElse(() => 0n)
      );
      return whole * durationUnitNanoseconds(unit) + fractionMilliseconds * nanosecondsPerMillisecond;
    })
  );
};

const parseHtmlHumanDuration = (value: string): O.Option<Duration.Duration> =>
  pipe(
    htmlDurationComponents(value),
    A.reduce(O.some(0n), (total, [amount, unit]) =>
      pipe(
        O.all({ total, component: parseDurationAmount(amount, unit) }),
        O.map(({ component, total }) => total + component)
      )
    ),
    O.map(Duration.nanos)
  );

const htmlIsoDurationCapturePattern = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d{1,3}))?S)?)?$/;

const captureBigIntOrZero = (match: O.Option<RegExpMatchArray>, index: number): O.Option<bigint> =>
  pipe(
    capture(match, index),
    O.flatMap(BInt.fromString),
    O.orElseSome(() => 0n)
  );

const parseHtmlIsoDuration = (value: string): O.Option<Duration.Duration> => {
  const match = Str.match(htmlIsoDurationCapturePattern)(value);
  return pipe(
    O.all({
      days: captureBigIntOrZero(match, 1),
      hours: captureBigIntOrZero(match, 2),
      minutes: captureBigIntOrZero(match, 3),
      seconds: captureBigIntOrZero(match, 4),
      fraction: O.some(capture(match, 5)),
    }),
    O.map(({ days, fraction, hours, minutes, seconds }) => {
      const fractionMilliseconds = pipe(
        fraction,
        O.map((digits) => BInt.BigInt(Str.padEnd(3, "0")(digits))),
        O.getOrElse(() => 0n)
      );
      return Duration.nanos(
        days * nanosecondsPerDay +
          hours * nanosecondsPerHour +
          minutes * nanosecondsPerMinute +
          seconds * nanosecondsPerSecond +
          fractionMilliseconds * nanosecondsPerMillisecond
      );
    })
  );
};

const parseHtmlDuration = (value: HtmlDurationString): O.Option<Duration.Duration> =>
  HtmlIsoDurationString.is(value) ? parseHtmlIsoDuration(value) : parseHtmlHumanDuration(value);

const isHtmlDurationValue = (value: Duration.Duration): boolean =>
  pipe(
    Duration.toNanos(value),
    O.exists((nanoseconds) => nanoseconds >= 0n && nanoseconds % nanosecondsPerMillisecond === 0n)
  );

const formatHtmlDuration = (value: Duration.Duration): O.Option<string> =>
  pipe(
    Duration.toNanos(value),
    O.filter(() => isHtmlDurationValue(value)),
    O.map((nanoseconds) => {
      const days = nanoseconds / nanosecondsPerDay;
      const afterDays = nanoseconds % nanosecondsPerDay;
      const hours = afterDays / nanosecondsPerHour;
      const afterHours = afterDays % nanosecondsPerHour;
      const minutes = afterHours / nanosecondsPerMinute;
      const afterMinutes = afterHours % nanosecondsPerMinute;
      const seconds = afterMinutes / nanosecondsPerSecond;
      const milliseconds = (afterMinutes % nanosecondsPerSecond) / nanosecondsPerMillisecond;
      const dayPart = days > 0n ? `${days}D` : "";
      const hourPart = hours > 0n ? `${hours}H` : "";
      const minutePart = minutes > 0n ? `${minutes}M` : "";
      const secondPart =
        milliseconds > 0n
          ? `${seconds}.${Str.padStart(3, "0")(Str.String(milliseconds))}S`
          : seconds > 0n || (days === 0n && hours === 0n && minutes === 0n)
            ? `${seconds}S`
            : "";
      const timePart = `${hourPart}${minutePart}${secondPart}`;
      return `P${dayPart}${Str.isNonEmpty(timePart) ? `T${timePart}` : ""}`;
    })
  );

/**
 * Finite, non-negative Effect duration at HTML's millisecond precision.
 *
 * **Example** (Validate an HTML-representable duration)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { HtmlDurationValue } from "./Microdata.model.ts"
 *
 * console.log(HtmlDurationValue.is(Duration.seconds(1))) // true
 * ```
 *
 * @see {@link MicrodataDurationFromString} to decode either HTML duration lexeme to this duration type.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlDurationValue = S.Duration.check(
  S.makeFilter(isHtmlDurationValue, {
    identifier: $I`HtmlDurationValueCheck`,
    title: "HTML-representable duration",
    description: "Accepts finite non-negative durations whose precision does not exceed milliseconds.",
    expected: "a finite, non-negative duration with millisecond precision",
    message: "Expected an HTML-representable duration",
  })
).pipe(
  S.brand("HtmlDurationValue"),
  $I.annoteSchema("HtmlDurationValue", {
    description: "Finite non-negative Effect duration representable at HTML millisecond precision.",
  }),
  SchemaUtils.withEffectCodecStatics,
  SchemaUtils.withStatics(() => ({
    parse: parseHtmlDuration,
    format: formatHtmlDuration,
  }))
);

/**
 * Decoded value produced by {@link HtmlDurationValue}.
 *
 * @see {@link HtmlDurationValue} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type HtmlDurationValue = typeof HtmlDurationValue.Type;

/**
 * Reversible codec from either HTML duration lexical form to an Effect duration.
 *
 * **Gotchas**
 *
 * Encode always emits restricted ISO spelling, so `1h 30m` decodes then
 * encodes as `PT1H30M`.
 *
 * **Example** (Decode an HTML duration)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataDurationFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataDurationFromString.decodeUnknownEffect("1h 30m"))
 * const encoded = Effect.runSync(MicrodataDurationFromString.encodeEffect(value))
 *
 * console.log(encoded) // "PT1H30M"
 * ```
 *
 * @see {@link HtmlDurationString} to validate the lexical form without converting.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataDurationFromString = HtmlDurationString.pipe(
  S.decodeTo(HtmlDurationValue, {
    decode: SchemaGetter.transformOrFail(
      flow(
        HtmlDurationValue.parse,
        Effect.fromOption(() => invalidValue("Could not parse the valid HTML duration"))
      )
    ),
    encode: SchemaGetter.transformOrFail(
      flow(
        HtmlDurationValue.format,
        Effect.fromOption(() => invalidValue("Duration cannot be encoded as an HTML duration")),
        Effect.flatMap(SchemaParser.decodeEffect(HtmlDurationString))
      )
    ),
  }),
  $I.annoteSchema("MicrodataDurationFromString", {
    description: "HTML duration lexical value decoded to an Effect duration.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataDurationFromString}.
 *
 * @see {@link MicrodataDurationFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataDurationFromString = typeof MicrodataDurationFromString.Type;

const normalizeHtmlGlobalDateTime: (value: HtmlGlobalDateTimeString) => string = flow(
  Str.replace(" ", "T"),
  Str.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
);

/**
 * Codec from an HTML global date-time to `DateTime.Utc`.
 *
 * **Gotchas**
 *
 * Valid HTML lexemes outside Effect's representable instant range remain
 * accepted by {@link HtmlGlobalDateTimeString} and fail only at this codec.
 *
 * **Example** (Decode an HTML global date-time)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataDateTimeFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataDateTimeFromString.decodeUnknownEffect("2024-02-29T12:30:45Z"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlGlobalDateTimeString} to validate the HTML lexeme without converting to an instant.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataDateTimeFromString = HtmlGlobalDateTimeString.pipe(
  S.decodeTo(S.DateTimeUtcFromString, {
    decode: SchemaGetter.transform(normalizeHtmlGlobalDateTime),
    encode: SchemaGetter.transformOrFail(SchemaParser.decodeEffect(HtmlGlobalDateTimeString)),
  }),
  $I.annoteSchema("MicrodataDateTimeFromString", {
    description: "HTML global date-time lexical value decoded to DateTime.Utc.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataDateTimeFromString}.
 *
 * @see {@link MicrodataDateTimeFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataDateTimeFromString = typeof MicrodataDateTimeFromString.Type;

/**
 * XML Schema integer lexical space used by the Microdata-to-RDF algorithm.
 *
 * **Example** (Decode an XML Schema integer lexeme)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { XsdIntegerString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(XsdIntegerString.decodeUnknownEffect("+42"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link XsdIntegerFromString} to decode to unbounded bigint; {@link VCardIntegerFromString} for the Int64-bounded RFC 6350 INTEGER codec.
 * @category schemas
 * @since 0.0.0
 */
export const XsdIntegerString = S.String.check(
  makePatternCheck($I`XsdIntegerStringCheck`, "an xsd:integer lexical value", xsdIntegerPattern)
).pipe(
  S.brand("XsdIntegerString"),
  $I.annoteSchema("XsdIntegerString", {
    description: "XML Schema integer lexical value recognized by the Microdata-to-RDF algorithm.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link XsdIntegerString}.
 *
 * @see {@link XsdIntegerString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type XsdIntegerString = typeof XsdIntegerString.Type;

/**
 * Arbitrary-precision integer value decoded from xsd:integer lexical space.
 *
 * **Example** (Validate an arbitrary-precision integer)
 *
 * ```ts
 * import { XsdIntegerValue } from "./Microdata.model.ts"
 *
 * console.log(XsdIntegerValue.is(42n)) // true
 * ```
 *
 * @see {@link VCardIntegerValue} for the Int64-bounded vCard integer; {@link XsdIntegerFromString} to decode xsd:integer lexemes to this type.
 * @category schemas
 * @since 0.0.0
 */
export const XsdIntegerValue = S.BigInt.pipe(
  S.brand("XsdIntegerValue"),
  $I.annoteSchema("XsdIntegerValue", {
    description: "Arbitrary-precision integer decoded from XML Schema integer lexical space.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link XsdIntegerValue}.
 *
 * @see {@link XsdIntegerValue} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type XsdIntegerValue = typeof XsdIntegerValue.Type;

/**
 * Reversible arbitrary-precision xsd:integer codec.
 *
 * **Example** (Decode an arbitrary-precision integer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { XsdIntegerFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(XsdIntegerFromString.decodeUnknownEffect("+42"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardIntegerFromString} for the Int64-bounded RFC 6350 INTEGER codec.
 * @category schemas
 * @since 0.0.0
 */
export const XsdIntegerFromString = XsdIntegerString.pipe(
  S.decodeTo(XsdIntegerValue, {
    decode: SchemaGetter.transformOrFail(
      flow(
        BInt.fromString,
        Effect.fromOption(() => invalidValue("Could not parse xsd:integer"))
      )
    ),
    encode: SchemaGetter.transformOrFail(flow(Str.String, SchemaParser.decodeEffect(XsdIntegerString))),
  }),
  $I.annoteSchema("XsdIntegerFromString", {
    description: "XML Schema integer string decoded to a branded arbitrary-precision integer.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link XsdIntegerFromString}.
 *
 * @see {@link XsdIntegerFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type XsdIntegerFromString = typeof XsdIntegerFromString.Type;

const parseXsdDouble = Match.type<string>().pipe(
  Match.when("INF", () => Num.Number.POSITIVE_INFINITY),
  Match.when("+INF", () => Num.Number.POSITIVE_INFINITY),
  Match.when("-INF", () => Num.Number.NEGATIVE_INFINITY),
  Match.when("NaN", () => Num.Number.NaN),
  Match.orElse(Num.Number)
);

const formatXsdDouble = Match.type<number>().pipe(
  Match.when(Num.Number.isNaN, () => "NaN"),
  Match.when(Num.Number.POSITIVE_INFINITY, () => "INF"),
  Match.when(Num.Number.NEGATIVE_INFINITY, () => "-INF"),
  Match.when(
    (value) => value === 0 && 1 / value === Num.Number.NEGATIVE_INFINITY,
    () => "-0.0"
  ),
  Match.orElse((value) => {
    const serialized = Str.String(value);
    return xsdIntegerPattern.test(serialized) ? `${serialized}.0` : serialized;
  })
);

/**
 * XML Schema double lexical space used by the Microdata-to-RDF algorithm.
 *
 * **Example** (Decode an XML Schema double lexeme)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { XsdDoubleString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(XsdDoubleString.decodeUnknownEffect("1.25E2"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XsdDoubleString = S.String.check(
  makePatternCheck($I`XsdDoubleStringCheck`, "an xsd:double lexical value", xsdDoublePattern)
).pipe(
  S.brand("XsdDoubleString"),
  $I.annoteSchema("XsdDoubleString", {
    description: "XML Schema double lexical value recognized by the Microdata-to-RDF algorithm.",
  }),
  SchemaUtils.withEffectCodecStatics,
  SchemaUtils.withStatics(() => ({
    parse: parseXsdDouble,
    format: formatXsdDouble,
  }))
);

/**
 * Decoded value produced by {@link XsdDoubleString}.
 *
 * @see {@link XsdDoubleString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type XsdDoubleString = typeof XsdDoubleString.Type;

/**
 * Reversible xsd:double codec backed by the repository's branded binary64 type.
 *
 * **Gotchas**
 *
 * Encode canonicalizes integer-looking numbers to `n.0` and signed zero to
 * `-0.0`; `INF` / `NaN` keep their XML Schema spellings.
 *
 * **Example** (Decode an XML Schema double)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { XsdDoubleFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(XsdDoubleFromString.decodeUnknownEffect("1.25E2"))
 * const encoded = Effect.runSync(XsdDoubleFromString.encodeEffect(value))
 *
 * console.log(value) // 125
 * console.log(encoded) // "125.0"
 * ```
 *
 * @see {@link VCardFloatFromString} for RFC 6350 FLOAT as BigDecimal without scientific notation.
 * @category schemas
 * @since 0.0.0
 */
export const XsdDoubleFromString = XsdDoubleString.pipe(
  S.decodeTo(Double, {
    decode: SchemaGetter.transform(XsdDoubleString.parse),
    encode: SchemaGetter.transformOrFail(flow(XsdDoubleString.format, SchemaParser.decodeEffect(XsdDoubleString))),
  }),
  $I.annoteSchema("XsdDoubleFromString", {
    description: "XML Schema double string decoded to a branded IEEE-754 binary64 value.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link XsdDoubleFromString}.
 *
 * @see {@link XsdDoubleFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type XsdDoubleFromString = typeof XsdDoubleFromString.Type;

/**
 * Integer-first RDF typing for values extracted from `data` and `meter`.
 *
 * **Example** (Decode a numeric microdata value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataNumericValueFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataNumericValueFromString.decodeUnknownEffect("42"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataDataValueFromString} to keep a string fallback when the value is not xsd:integer or xsd:double.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataNumericValueFromString = S.Union([XsdIntegerFromString, XsdDoubleFromString]).pipe(
  $I.annoteSchema("MicrodataNumericValueFromString", {
    description: "Integer-first numeric codec used for microdata data and meter values.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataNumericValueFromString}.
 *
 * @see {@link MicrodataNumericValueFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataNumericValueFromString = typeof MicrodataNumericValueFromString.Type;

const MicrodataNonNumericString = S.String.check(
  makeStringCheck(
    $I`MicrodataNonNumericStringCheck`,
    "a non-numeric microdata string",
    (value) => !XsdIntegerString.is(value) && !XsdDoubleString.is(value)
  )
).pipe(
  $I.annoteSchema("MicrodataNonNumericString", {
    description: "Microdata string outside XML Schema integer and double lexical spaces.",
  })
);

/**
 * RDF value typing for `data` and `meter`, with an untyped string fallback.
 *
 * **Example** (Retain a non-numeric data value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataDataValueFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataDataValueFromString.decodeUnknownEffect("plain text"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataNumericValueFromString} to require integer-first numeric typing without a string fallback.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataDataValueFromString = S.Union([
  XsdIntegerFromString,
  XsdDoubleFromString,
  MicrodataNonNumericString,
]).pipe(
  $I.annoteSchema("MicrodataDataValueFromString", {
    description: "Microdata data or meter value with numeric typing and a string fallback.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataDataValueFromString}.
 *
 * @see {@link MicrodataDataValueFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataDataValueFromString = typeof MicrodataDataValueFromString.Type;

const xsdTimeFromHtmlPattern = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?$/;
const xsdDateFromHtmlPattern = /^(?:0\d{3}|[1-9]\d{3,})-\d{2}-\d{2}$/;
const xsdYearMonthFromHtmlPattern = /^(?:0\d{3}|[1-9]\d{3,})-\d{2}$/;
const xsdYearFromHtmlPattern = /^(?:0\d{3}|[1-9]\d{3,})$/;
const xsdDateTimeFromHtmlPattern =
  /^(?:0\d{3}|[1-9]\d{3,})-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))?$/;

/**
 * HTML date values that also inhabit xsd:date lexical space.
 *
 * **Example** (Decode the xsd:date subset)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataXsdDateString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataXsdDateString.decodeUnknownEffect("2024-02-29"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlDateString} for the broader WHATWG date space that still admits years outside xsd:date.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataXsdDateString = HtmlDateString.check(
  makePatternCheck($I`MicrodataXsdDateStringCheck`, "an HTML date in xsd:date lexical space", xsdDateFromHtmlPattern)
).pipe(
  S.brand("MicrodataXsdDateString"),
  $I.annoteSchema("MicrodataXsdDateString", {
    description: "HTML date value that also inhabits XML Schema date lexical space.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataXsdDateString}.
 *
 * @see {@link MicrodataXsdDateString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataXsdDateString = typeof MicrodataXsdDateString.Type;

/**
 * HTML month values that also inhabit xsd:gYearMonth lexical space.
 *
 * **Example** (Decode the xsd:gYearMonth subset)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataXsdYearMonthString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataXsdYearMonthString.decodeUnknownEffect("2024-02"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlMonthString} for the broader WHATWG month space.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataXsdYearMonthString = HtmlMonthString.check(
  makePatternCheck(
    $I`MicrodataXsdYearMonthStringCheck`,
    "an HTML month in xsd:gYearMonth lexical space",
    xsdYearMonthFromHtmlPattern
  )
).pipe(
  S.brand("MicrodataXsdYearMonthString"),
  $I.annoteSchema("MicrodataXsdYearMonthString", {
    description: "HTML month value that also inhabits XML Schema gYearMonth lexical space.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataXsdYearMonthString}.
 *
 * @see {@link MicrodataXsdYearMonthString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataXsdYearMonthString = typeof MicrodataXsdYearMonthString.Type;

/**
 * HTML year values that also inhabit xsd:gYear lexical space.
 *
 * **Example** (Decode the xsd:gYear subset)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataXsdYearString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataXsdYearString.decodeUnknownEffect("2024"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlYearString} for the broader WHATWG year space.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataXsdYearString = HtmlYearString.check(
  makePatternCheck($I`MicrodataXsdYearStringCheck`, "an HTML year in xsd:gYear lexical space", xsdYearFromHtmlPattern)
).pipe(
  S.brand("MicrodataXsdYearString"),
  $I.annoteSchema("MicrodataXsdYearString", {
    description: "HTML year value that also inhabits XML Schema gYear lexical space.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataXsdYearString}.
 *
 * @see {@link MicrodataXsdYearString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataXsdYearString = typeof MicrodataXsdYearString.Type;

/**
 * HTML time values that also inhabit xsd:time lexical space.
 *
 * **Example** (Decode the xsd:time subset)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataXsdTimeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataXsdTimeString.decodeUnknownEffect("12:30:45"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlTimeString} for the broader WHATWG time space that still admits omitted seconds.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataXsdTimeString = HtmlTimeString.check(
  makePatternCheck($I`MicrodataXsdTimeStringCheck`, "an HTML time in xsd:time lexical space", xsdTimeFromHtmlPattern)
).pipe(
  S.brand("MicrodataXsdTimeString"),
  $I.annoteSchema("MicrodataXsdTimeString", {
    description: "HTML time value that also inhabits XML Schema time lexical space.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataXsdTimeString}.
 *
 * @see {@link MicrodataXsdTimeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataXsdTimeString = typeof MicrodataXsdTimeString.Type;

const isMicrodataXsdDateTime = (value: string): boolean =>
  xsdDateTimeFromHtmlPattern.test(value) && (HtmlLocalDateTimeString.is(value) || HtmlGlobalDateTimeString.is(value));

/**
 * HTML date-time values that also inhabit xsd:dateTime lexical space.
 *
 * **Example** (Decode the xsd:dateTime subset)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataXsdDateTimeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataXsdDateTimeString.decodeUnknownEffect("2024-02-29T12:30:45Z"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link HtmlGlobalDateTimeString} for the broader WHATWG global date-time space; {@link HtmlLocalDateTimeString} for local (unoffset) HTML date-times.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataXsdDateTimeString = S.String.check(
  makeStringCheck(
    $I`MicrodataXsdDateTimeStringCheck`,
    "an HTML date-time in xsd:dateTime lexical space",
    isMicrodataXsdDateTime
  )
).pipe(
  S.brand("MicrodataXsdDateTimeString"),
  $I.annoteSchema("MicrodataXsdDateTimeString", {
    description: "HTML date-time value that also inhabits XML Schema dateTime lexical space.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataXsdDateTimeString}.
 *
 * @see {@link MicrodataXsdDateTimeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataXsdDateTimeString = typeof MicrodataXsdDateTimeString.Type;

/**
 * W3C Microdata-to-RDF typing order for a `time` element.
 *
 * **Gotchas**
 *
 * Yearless HTML dates intentionally fall through to `string`, because their
 * lexical form differs from xsd:gMonthDay.
 *
 * **Example** (Decode a microdata time value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataRdfTimeValueFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataRdfTimeValueFromString.decodeUnknownEffect("2024-02-29"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataRuntimeValueFromString} to decode to Effect DateTime, Duration, or number types instead of XSD lexical subsets; {@link MicrodataContextualValueFromString} to tag the value with DOM or vocabulary context.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataRdfTimeValueFromString = S.Union([
  MicrodataXsdDateString,
  MicrodataXsdTimeString,
  MicrodataXsdDateTimeString,
  MicrodataXsdYearMonthString,
  MicrodataXsdYearString,
  HtmlIsoDurationString,
  S.String,
]).pipe(
  $I.annoteSchema("MicrodataRdfTimeValueFromString", {
    description: "W3C Microdata-to-RDF value-typing order for HTML time elements.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataRdfTimeValueFromString}.
 *
 * @see {@link MicrodataRdfTimeValueFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataRdfTimeValueFromString = typeof MicrodataRdfTimeValueFromString.Type;

/**
 * Runtime-value union for non-URL microdata values.
 *
 * **Details**
 *
 * URL is excluded because URL-property status comes from element or
 * vocabulary context, not from the spelling of the string.
 *
 * **Example** (Derive an Effect runtime value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataRuntimeValueFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataRuntimeValueFromString.decodeUnknownEffect("PT1H"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataRdfTimeValueFromString} for W3C Microdata-to-RDF time-element typing; {@link MicrodataContextualValueFromString} when URL versus numeric versus time typing depends on element context.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataRuntimeValueFromString = S.Union([
  MicrodataDateTimeFromString,
  XsdIntegerFromString,
  XsdDoubleFromString,
  MicrodataDurationFromString,
]).pipe(
  $I.annoteSchema("MicrodataRuntimeValueFromString", {
    description: "Non-URL microdata string decoded to supported Effect-first runtime values.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataRuntimeValueFromString}.
 *
 * @see {@link MicrodataRuntimeValueFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataRuntimeValueFromString = typeof MicrodataRuntimeValueFromString.Type;

const isVCardMonthDay = (month: string, day: string, year = "2000"): boolean =>
  vCardMonthPattern.test(month) &&
  vCardDayPattern.test(day) &&
  Num.Number(day) <= daysInMonth(BInt.BigInt(year), Num.Number(month));

// crispen: RFC 6350 DATE has complete, reduced, and truncated grammars that share calendar validation.
const isVCardDate = (value: string): boolean => {
  if (vCardYearPattern.test(value)) {
    return true;
  }
  const full = Str.match(/^(\d{4})(\d{2})(\d{2})$/)(value);
  if (O.isSome(full)) {
    return pipe(
      O.all({
        year: capture(full, 1),
        month: capture(full, 2),
        day: capture(full, 3),
      }),
      O.exists(({ day, month, year }) => isVCardMonthDay(month, day, year))
    );
  }
  const reduced = Str.match(/^(\d{4})-(\d{2})$/)(value);
  if (O.isSome(reduced)) {
    return pipe(
      capture(reduced, 2),
      O.exists((month) => vCardMonthPattern.test(month))
    );
  }
  const monthDay = Str.match(/^--(\d{2})(\d{2})?$/)(value);
  if (O.isSome(monthDay)) {
    return pipe(
      capture(monthDay, 1),
      O.exists((month) =>
        pipe(
          capture(monthDay, 2),
          O.map((day) => isVCardMonthDay(month, day)),
          O.getOrElse(() => vCardMonthPattern.test(month))
        )
      )
    );
  }
  const day = Str.match(/^---(\d{2})$/)(value);
  return pipe(
    capture(day, 1),
    O.exists((value) => vCardDayPattern.test(value))
  );
};

const vCardTimePattern =
  /^(?:(?:[01]\d|2[0-3])(?:[0-5]\d(?:[0-5]\d|60)?)?|-[0-5]\d(?:[0-5]\d|60)?|--(?:[0-5]\d|60))(?:Z|[+-](?:[01]\d|2[0-3])(?:[0-5]\d)?)?$/;
const vCardTimeNotTruncatedPattern =
  /^(?:[01]\d|2[0-3])(?:[0-5]\d(?:[0-5]\d|60)?)?(?:Z|[+-](?:[01]\d|2[0-3])(?:[0-5]\d)?)?$/;
const vCardTimeCompletePattern = /^(?:[01]\d|2[0-3])[0-5]\d(?:[0-5]\d|60)(?:Z|[+-](?:[01]\d|2[0-3])(?:[0-5]\d)?)?$/;

const isVCardDateNoReduction = (value: string): boolean =>
  /^(?:\d{8}|--\d{4}|---\d{2})$/.test(value) && isVCardDate(value);

const isVCardDateComplete = (value: string): boolean => /^\d{8}$/.test(value) && isVCardDate(value);

const isVCardDateTime = (value: string): boolean => {
  const match = Str.match(/^(.+)T(.+)$/)(value);
  return pipe(
    O.all({ date: capture(match, 1), time: capture(match, 2) }),
    O.exists(({ date, time }) => isVCardDateNoReduction(date) && vCardTimeNotTruncatedPattern.test(time))
  );
};

const isVCardTimestamp = (value: string): boolean => {
  const match = Str.match(/^(\d{8})T(.+)$/)(value);
  return pipe(
    O.all({ date: capture(match, 1), time: capture(match, 2) }),
    O.exists(
      P.Struct({
        date: isVCardDateComplete,
        time: (value) => vCardTimeCompletePattern.test(value),
      })
    )
  );
};

const VCardValueTypeBase = LiteralKit([
  "text",
  "uri",
  "date",
  "time",
  "date-time",
  "date-and-or-time",
  "timestamp",
  "boolean",
  "integer",
  "float",
  "utc-offset",
  "language-tag",
]);

/**
 * RFC 6350 predefined VALUE parameter names. Extension tokens remain separate.
 *
 * **Example** (Decode a predefined VALUE type)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { VCardValueType } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(S.decodeUnknownEffect(VCardValueType)("text"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardValueTypeFromString} to canonicalize case-insensitive spellings; {@link VCardDeclaredValueTypeString} to also admit IANA and `x-` extension tokens.
 * @category schemas
 * @since 0.0.0
 */
export const VCardValueType = VCardValueTypeBase.pipe(
  $I.annoteSchema("VCardValueType", {
    description: "Predefined RFC 6350 VALUE parameter names.",
  }),
  SchemaUtils.withLiteralKitStatics(VCardValueTypeBase)
);

/**
 * Decoded value produced by {@link VCardValueType}.
 *
 * @see {@link VCardValueType} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardValueType = typeof VCardValueType.Type;

const isVCardPredefinedValueType = flow(Str.toLowerCase, S.is(VCardValueType));

/**
 * Case-insensitive RFC 6350 spelling of a predefined VALUE type.
 *
 * **Example** (Decode case-insensitive VALUE syntax)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardValueTypeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardValueTypeString.decodeUnknownEffect("TEXT"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardValueType} for the lowercase literal kit; {@link VCardValueTypeFromString} to decode to that kit.
 * @category schemas
 * @since 0.0.0
 */
export const VCardValueTypeString = S.String.pipe(
  S.check(
    makeStringCheck($I`VCardValueTypeStringCheck`, "an RFC 6350 predefined VALUE type", isVCardPredefinedValueType)
  ),
  S.brand("VCardValueTypeString"),
  $I.annoteSchema("VCardValueTypeString", {
    description: "Case-insensitive lexical spelling of a predefined RFC 6350 VALUE type.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardValueTypeString}.
 *
 * @see {@link VCardValueTypeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardValueTypeString = typeof VCardValueTypeString.Type;

/**
 * Canonicalizes a predefined RFC 6350 VALUE type to lower case.
 *
 * **Example** (Canonicalize a VALUE type)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardValueTypeFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardValueTypeFromString.decodeUnknownEffect("TEXT"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardValueType} for the lowercase literals; {@link VCardDeclaredValueTypeString} to also admit IANA and `x-` extension tokens.
 * @category schemas
 * @since 0.0.0
 */
export const VCardValueTypeFromString = VCardValueTypeString.pipe(
  S.decodeTo(VCardValueType, {
    decode: SchemaGetter.transformOrFail(flow(Str.toLowerCase, SchemaParser.decodeUnknownEffect(VCardValueType))),
    encode: SchemaGetter.transformOrFail(SchemaParser.decodeEffect(VCardValueTypeString)),
  }),
  $I.annoteSchema("VCardValueTypeFromString", {
    description: "Predefined RFC 6350 VALUE type normalized to its lowercase literal.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardValueTypeFromString}.
 *
 * @see {@link VCardValueTypeFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardValueTypeFromString = typeof VCardValueTypeFromString.Type;

/**
 * RFC 6350 registered VALUE extension token. Registration is external to syntax validation.
 *
 * **Example** (Decode a registered extension token)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardIanaValueTypeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardIanaValueTypeString.decodeUnknownEffect("vendor-token"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardIanaValueTypeString = S.String.check(
  makeStringCheck(
    $I`VCardIanaValueTypeStringCheck`,
    "an RFC 6350 IANA VALUE token",
    (value) =>
      /^[A-Za-z0-9-]+$/.test(value) &&
      !Str.startsWith("x-")(Str.toLowerCase(value)) &&
      !isVCardPredefinedValueType(value)
  )
).pipe(
  S.brand("VCardIanaValueTypeString"),
  $I.annoteSchema("VCardIanaValueTypeString", {
    description: "Syntactically valid registered RFC 6350 VALUE extension token.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardIanaValueTypeString}.
 *
 * @see {@link VCardIanaValueTypeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardIanaValueTypeString = typeof VCardIanaValueTypeString.Type;

/**
 * RFC 6350 experimental `x-` VALUE type token.
 *
 * **Example** (Decode an experimental extension token)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardExperimentalValueTypeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardExperimentalValueTypeString.decodeUnknownEffect("x-example"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardExperimentalValueTypeString = S.String.check(
  makePatternCheck(
    $I`VCardExperimentalValueTypeStringCheck`,
    "an RFC 6350 experimental VALUE type",
    /^x-[A-Za-z0-9-]+$/i
  )
).pipe(
  S.brand("VCardExperimentalValueTypeString"),
  $I.annoteSchema("VCardExperimentalValueTypeString", {
    description: "Experimental RFC 6350 VALUE extension token beginning with x-.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardExperimentalValueTypeString}.
 *
 * @see {@link VCardExperimentalValueTypeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardExperimentalValueTypeString = typeof VCardExperimentalValueTypeString.Type;

/**
 * Any VALUE type token declared by RFC 6350 section 5.2.
 *
 * **Example** (Decode a declared VALUE type)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardDeclaredValueTypeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardDeclaredValueTypeString.decodeUnknownEffect("text"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardValueTypeString} for predefined VALUE names only; {@link VCardValueTypeFromString} to canonicalize those names.
 * @category schemas
 * @since 0.0.0
 */
export const VCardDeclaredValueTypeString = S.Union([
  VCardValueTypeString,
  VCardExperimentalValueTypeString,
  VCardIanaValueTypeString,
]).pipe(
  $I.annoteSchema("VCardDeclaredValueTypeString", {
    description: "Any predefined, registered, or experimental RFC 6350 VALUE type token.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardDeclaredValueTypeString}.
 *
 * @see {@link VCardDeclaredValueTypeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardDeclaredValueTypeString = typeof VCardDeclaredValueTypeString.Type;

/**
 * RFC 6350 TEXT-CHAR lexical space after content-line unfolding.
 *
 * **Example** (Decode escaped vCard text)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardTextString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardTextString.decodeUnknownEffect("hello\\, world"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardTextString = S.String.check(
  makePatternCheck($I`VCardTextStringCheck`, "an RFC 6350 text value", vCardTextPattern)
).pipe(
  S.brand("VCardTextString"),
  $I.annoteSchema("VCardTextString", { description: "RFC 6350 TEXT-CHAR lexical value after content-line unfolding." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardTextString}.
 *
 * @see {@link VCardTextString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardTextString = typeof VCardTextString.Type;

/**
 * RFC 3986 URI value required by RFC 6350 section 4.2.
 *
 * **Example** (Decode an absolute vCard URI)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardUriString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardUriString.decodeUnknownEffect("urn:example:item"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardUrlFromString} to decode the WHATWG URL-compatible subset to a platform URL.
 * @category schemas
 * @since 0.0.0
 */
export const VCardUriString = UriReferenceString.pipe(
  S.check(makePatternCheck($I`VCardUriStringCheck`, "an absolute RFC 3986 URI", vCardUriSchemePattern)),
  S.brand("VCardUriString"),
  $I.annoteSchema("VCardUriString", { description: "Absolute RFC 3986 URI lexical value admitted by RFC 6350." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardUriString}.
 *
 * @see {@link VCardUriString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardUriString = typeof VCardUriString.Type;

/**
 * RFC 6350 basic-format DATE lexical space, including reduced and truncated forms.
 *
 * **Example** (Decode a vCard date)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardDateString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardDateString.decodeUnknownEffect("20240229"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardDateString = S.String.check(
  makeStringCheck($I`VCardDateStringCheck`, "an RFC 6350 date value", isVCardDate)
).pipe(
  S.brand("VCardDateString"),
  $I.annoteSchema("VCardDateString", {
    description: "RFC 6350 DATE lexical value, including reduced and truncated forms.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardDateString}.
 *
 * @see {@link VCardDateString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardDateString = typeof VCardDateString.Type;

/**
 * RFC 6350 TIME lexical space, including reduced, truncated, and zoned forms.
 * Second 60 is a lexical leap-second candidate; occurrence validation needs
 * a date and the applicable leap-second table.
 *
 * **Example** (Decode a vCard time)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardTimeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardTimeString.decodeUnknownEffect("123045Z"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardTimeString = S.String.check(
  makePatternCheck($I`VCardTimeStringCheck`, "an RFC 6350 time value", vCardTimePattern)
).pipe(
  S.brand("VCardTimeString"),
  $I.annoteSchema("VCardTimeString", {
    description: "RFC 6350 TIME lexical value, including reduced, truncated, and zoned forms.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardTimeString}.
 *
 * @see {@link VCardTimeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardTimeString = typeof VCardTimeString.Type;

/**
 * RFC 6350 DATE-TIME lexical space.
 *
 * **Example** (Decode a vCard date-time)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardDateTimeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardDateTimeString.decodeUnknownEffect("20240229T123045Z"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardDateTimeString = S.String.check(
  makeStringCheck($I`VCardDateTimeStringCheck`, "an RFC 6350 date-time value", isVCardDateTime)
).pipe(
  S.brand("VCardDateTimeString"),
  $I.annoteSchema("VCardDateTimeString", { description: "RFC 6350 DATE-TIME lexical value." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardDateTimeString}.
 *
 * @see {@link VCardDateTimeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardDateTimeString = typeof VCardDateTimeString.Type;

const isVCardDateAndOrTime = (value: string): boolean =>
  VCardDateTimeString.is(value) ||
  VCardDateString.is(value) ||
  (Str.startsWith("T")(value) && VCardTimeString.is(Str.slice(1)(value)));

/**
 * RFC 6350 DATE-AND-OR-TIME lexical space.
 *
 * **Example** (Decode a vCard date-and-or-time)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardDateAndOrTimeString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardDateAndOrTimeString.decodeUnknownEffect("T123045Z"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardDateAndOrTimeString = S.String.check(
  makeStringCheck($I`VCardDateAndOrTimeStringCheck`, "an RFC 6350 date-and-or-time value", isVCardDateAndOrTime)
).pipe(
  S.brand("VCardDateAndOrTimeString"),
  $I.annoteSchema("VCardDateAndOrTimeString", { description: "RFC 6350 DATE-AND-OR-TIME lexical value." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardDateAndOrTimeString}.
 *
 * @see {@link VCardDateAndOrTimeString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardDateAndOrTimeString = typeof VCardDateAndOrTimeString.Type;

/**
 * RFC 6350 complete basic-format TIMESTAMP lexical space.
 *
 * **Example** (Decode a vCard timestamp)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardTimestampString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardTimestampString.decodeUnknownEffect("20240229T123045Z"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardZonedTimestampString} for the zoned subset convertible to an instant; {@link VCardTimestampFromString} to decode that subset to `DateTime.Utc`.
 * @category schemas
 * @since 0.0.0
 */
export const VCardTimestampString = S.String.pipe(
  S.check(makeStringCheck($I`VCardTimestampStringCheck`, "an RFC 6350 timestamp value", isVCardTimestamp)),
  S.brand("VCardTimestampString"),
  $I.annoteSchema("VCardTimestampString", { description: "Complete basic-format RFC 6350 TIMESTAMP lexical value." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardTimestampString}.
 *
 * @see {@link VCardTimestampString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardTimestampString = typeof VCardTimestampString.Type;

/**
 * Zoned RFC 6350 TIMESTAMP lexical space convertible to an absolute instant.
 *
 * **Example** (Decode a zoned vCard timestamp)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardZonedTimestampString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardZonedTimestampString.decodeUnknownEffect("20240229T123045Z"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardTimestampString} for floating (unzoned) timestamps; {@link VCardTimestampFromString} to decode this zoned subset to `DateTime.Utc`.
 * @category schemas
 * @since 0.0.0
 */
export const VCardZonedTimestampString = VCardTimestampString.check(
  makePatternCheck(
    $I`VCardZonedTimestampStringCheck`,
    "an RFC 6350 timestamp with a UTC designator or numeric offset",
    /(?:Z|[+-]\d{2}(?:\d{2})?)$/
  )
).pipe(
  S.brand("VCardZonedTimestampString"),
  $I.annoteSchema("VCardZonedTimestampString", {
    description: "Zoned RFC 6350 TIMESTAMP lexical value convertible to an absolute instant.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardZonedTimestampString}.
 *
 * @see {@link VCardZonedTimestampString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardZonedTimestampString = typeof VCardZonedTimestampString.Type;

/**
 * RFC 6350 case-insensitive BOOLEAN lexical space.
 *
 * **Example** (Decode a vCard boolean lexeme)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardBooleanString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardBooleanString.decodeUnknownEffect("true"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardBooleanString = S.String.pipe(
  S.check(makePatternCheck($I`VCardBooleanStringCheck`, "an RFC 6350 boolean value", /^(?:TRUE|FALSE)$/i)),
  S.brand("VCardBooleanString"),
  $I.annoteSchema("VCardBooleanString", { description: "Case-insensitive RFC 6350 BOOLEAN lexical value." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardBooleanString}.
 *
 * @see {@link VCardBooleanString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardBooleanString = typeof VCardBooleanString.Type;

/**
 * RFC 6350 signed decimal INTEGER lexical space.
 *
 * **Gotchas**
 *
 * Magnitude is unbounded here; {@link VCardIntegerFromString} rejects values outside Int64.
 *
 * **Example** (Decode a vCard integer lexeme)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardIntegerString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardIntegerString.decodeUnknownEffect("+42"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardIntegerFromString} for the Int64-bounded codec; {@link XsdIntegerFromString} for unbounded xsd:integer.
 * @category schemas
 * @since 0.0.0
 */
export const VCardIntegerString = S.String.pipe(
  S.check(makePatternCheck($I`VCardIntegerStringCheck`, "an RFC 6350 integer lexical value", vCardIntegerPattern)),
  S.brand("VCardIntegerString"),
  $I.annoteSchema("VCardIntegerString", { description: "Signed decimal RFC 6350 INTEGER lexical value." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardIntegerString}.
 *
 * @see {@link VCardIntegerString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardIntegerString = typeof VCardIntegerString.Type;

/**
 * RFC 6350 FLOAT lexical space. Scientific notation is rejected.
 *
 * **Example** (Decode a vCard decimal lexeme)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardFloatString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardFloatString.decodeUnknownEffect("12.50"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardFloatString = S.String.pipe(
  S.check(makePatternCheck($I`VCardFloatStringCheck`, "an RFC 6350 float lexical value", vCardFloatPattern)),
  S.brand("VCardFloatString"),
  $I.annoteSchema("VCardFloatString", {
    description: "Plain-decimal RFC 6350 FLOAT lexical value without exponent notation.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardFloatString}.
 *
 * @see {@link VCardFloatString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardFloatString = typeof VCardFloatString.Type;

/**
 * RFC 6350 UTC-OFFSET lexical space, from -2359 through +2359.
 *
 * **Example** (Decode a vCard UTC offset lexeme)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardUtcOffsetString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardUtcOffsetString.decodeUnknownEffect("+0530"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardUtcOffsetString = S.String.pipe(
  S.check(makePatternCheck($I`VCardUtcOffsetStringCheck`, "an RFC 6350 UTC offset", vCardUtcOffsetPattern)),
  S.brand("VCardUtcOffsetString"),
  $I.annoteSchema("VCardUtcOffsetString", {
    description: "RFC 6350 UTC-OFFSET lexical value from negative 23:59 through positive 23:59.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardUtcOffsetString}.
 *
 * @see {@link VCardUtcOffsetString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardUtcOffsetString = typeof VCardUtcOffsetString.Type;

/**
 * RFC 5646 language tag, including grandfathered and private-use forms.
 *
 * **Example** (Decode a vCard language tag)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardLanguageTagString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardLanguageTagString.decodeUnknownEffect("en-US"))
 *
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardLanguageTagString = S.String.check(
  makeStringCheck($I`VCardLanguageTagStringCheck`, "an RFC 5646 language tag", isValidBcp47LanguageTag)
).pipe(
  S.brand("VCardLanguageTagString"),
  $I.annoteSchema("VCardLanguageTagString", { description: "RFC 5646 language tag admitted by RFC 6350." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardLanguageTagString}.
 *
 * @see {@link VCardLanguageTagString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardLanguageTagString = typeof VCardLanguageTagString.Type;

/**
 * Reversible RFC 6350 BOOLEAN codec.
 *
 * **Gotchas**
 *
 * Encode always writes uppercase `TRUE` / `FALSE`, even when decode accepted mixed case.
 *
 * **Example** (Decode a vCard boolean)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardBooleanFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardBooleanFromString.decodeUnknownEffect("true"))
 * const encoded = Effect.runSync(VCardBooleanFromString.encodeEffect(value))
 *
 * console.log(value) // true
 * console.log(encoded) // "TRUE"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardBooleanFromString = VCardBooleanString.pipe(
  S.decodeTo(S.Boolean, {
    decode: SchemaGetter.transform((value) => Str.toUpperCase(value) === "TRUE"),
    encode: SchemaGetter.transformOrFail((value) =>
      SchemaParser.decodeEffect(VCardBooleanString)(value ? "TRUE" : "FALSE")
    ),
  }),
  $I.annoteSchema("VCardBooleanFromString", {
    description: "RFC 6350 BOOLEAN string decoded to boolean with canonical uppercase encoding.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardBooleanFromString}.
 *
 * @see {@link VCardBooleanFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardBooleanFromString = typeof VCardBooleanFromString.Type;

/**
 * Signed 64-bit integer value admitted by RFC 6350.
 *
 * **Gotchas**
 *
 * This is Int64 (`-2^63` through `2^63-1`), not unbounded {@link XsdIntegerValue}.
 *
 * **Example** (Validate a vCard integer)
 *
 * ```ts
 * import { VCardIntegerValue } from "./Microdata.model.ts"
 *
 * console.log(VCardIntegerValue.is(42n)) // true
 * ```
 *
 * @see {@link XsdIntegerValue} for unbounded xsd:integer bigint; {@link VCardIntegerFromString} to decode RFC 6350 INTEGER lexemes into this Int64 type.
 * @category schemas
 * @since 0.0.0
 */
export const VCardIntegerValue = Int64.pipe(
  S.brand("VCardIntegerValue"),
  $I.annoteSchema("VCardIntegerValue", {
    description: "Signed 64-bit integer decoded from an RFC 6350 INTEGER value.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardIntegerValue}.
 *
 * @see {@link VCardIntegerValue} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardIntegerValue = typeof VCardIntegerValue.Type;

/**
 * Reversible RFC 6350 INTEGER codec backed by a signed 64-bit bigint.
 *
 * **Gotchas**
 *
 * Lexical integers outside signed 64-bit range remain accepted by
 * {@link VCardIntegerString} and fail only here. Use
 * {@link XsdIntegerFromString} for arbitrary-precision XML Schema integers.
 *
 * **Example** (Decode a vCard integer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardIntegerFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardIntegerFromString.decodeUnknownEffect("+42"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link XsdIntegerFromString} for unbounded xsd:integer; {@link VCardIntegerString} for the unbounded lexical filter that still accepts overflow digits.
 * @category schemas
 * @since 0.0.0
 */
export const VCardIntegerFromString = VCardIntegerString.pipe(
  S.decodeTo(VCardIntegerValue, {
    decode: SchemaGetter.transformOrFail(
      flow(
        BInt.fromString,
        Effect.fromOption(() => invalidValue("Could not parse RFC 6350 integer"))
      )
    ),
    encode: SchemaGetter.transformOrFail(flow(Str.String, SchemaParser.decodeEffect(VCardIntegerString))),
  }),
  $I.annoteSchema("VCardIntegerFromString", {
    description: "RFC 6350 INTEGER string decoded to a signed 64-bit branded bigint.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardIntegerFromString}.
 *
 * @see {@link VCardIntegerFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardIntegerFromString = typeof VCardIntegerFromString.Type;

/**
 * Arbitrary-precision decimal value admitted by RFC 6350 FLOAT.
 *
 * **Example** (Validate an arbitrary-precision vCard decimal)
 *
 * ```ts
 * import { BigDecimal } from "effect"
 * import { VCardFloatValue } from "./Microdata.model.ts"
 *
 * console.log(VCardFloatValue.is(BigDecimal.make(125n, 2))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardFloatValue = S.BigDecimal.pipe(
  S.brand("VCardFloatValue"),
  $I.annoteSchema("VCardFloatValue", {
    description: "Arbitrary-precision decimal decoded from an RFC 6350 FLOAT value.",
  }),
  SchemaUtils.withEffectCodecStatics,
  SchemaUtils.withStatics(() => ({
    format: (value: BigDecimal.BigDecimal): string => {
      const normalized = BigDecimal.normalize(value);
      const sign = normalized.value < 0n ? "-" : "";
      const digits = `${BInt.abs(normalized.value)}`;
      return Match.value(normalized.scale).pipe(
        Match.when(
          (scale) => scale <= 0,
          (scale) => `${sign}${digits}${Str.repeat(-scale)("0")}`
        ),
        Match.when(
          (scale) => scale >= Str.length(digits),
          (scale) => `${sign}0.${Str.repeat(scale - Str.length(digits))("0")}${digits}`
        ),
        Match.orElse((scale) => {
          const decimalPosition = Str.length(digits) - scale;
          return `${sign}${Str.slice(0, decimalPosition)(digits)}.${Str.slice(decimalPosition)(digits)}`;
        })
      );
    },
  }))
);

/**
 * Decoded value produced by {@link VCardFloatValue}.
 *
 * @see {@link VCardFloatValue} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardFloatValue = typeof VCardFloatValue.Type;

/**
 * Reversible RFC 6350 FLOAT codec without scientific notation.
 *
 * **Example** (Decode an arbitrary-precision vCard decimal)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardFloatFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardFloatFromString.decodeUnknownEffect("12.50"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link XsdDoubleFromString} for IEEE-754 xsd:double with exponent and INF/NaN.
 * @category schemas
 * @since 0.0.0
 */
export const VCardFloatFromString = VCardFloatString.pipe(
  S.decodeTo(VCardFloatValue, {
    decode: SchemaGetter.transformOrFail(
      flow(
        BigDecimal.fromString,
        Effect.fromOption(() => invalidValue("Could not parse RFC 6350 float"))
      )
    ),
    encode: SchemaGetter.transformOrFail(flow(VCardFloatValue.format, SchemaParser.decodeEffect(VCardFloatString))),
  }),
  $I.annoteSchema("VCardFloatFromString", {
    description: "RFC 6350 FLOAT string decoded to an arbitrary-precision branded decimal.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardFloatFromString}.
 *
 * @see {@link VCardFloatFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardFloatFromString = typeof VCardFloatFromString.Type;

const maximumVCardOffsetNanoseconds = (23n * 60n + 59n) * nanosecondsPerMinute;

const isVCardUtcOffsetValue = (value: Duration.Duration): boolean =>
  pipe(
    Duration.toNanos(value),
    O.exists(
      (nanoseconds) =>
        nanoseconds >= -maximumVCardOffsetNanoseconds &&
        nanoseconds <= maximumVCardOffsetNanoseconds &&
        nanoseconds % nanosecondsPerMinute === 0n
    )
  );

const parseVCardUtcOffset = (value: VCardUtcOffsetString): O.Option<Duration.Duration> => {
  const match = Str.match(/^([+-])(\d{2})(\d{2})?$/)(value);
  return pipe(
    O.all({
      sign: capture(match, 1),
      hours: capture(match, 2).pipe(O.flatMap(BInt.fromString)),
      minutes: O.some(
        pipe(
          capture(match, 3),
          O.flatMap(BInt.fromString),
          O.getOrElse(() => 0n)
        )
      ),
    }),
    O.map(({ hours, minutes, sign }) =>
      Duration.nanos((sign === "-" ? -1n : 1n) * (hours * 60n + minutes) * nanosecondsPerMinute)
    )
  );
};

const formatVCardUtcOffset = (value: Duration.Duration): O.Option<string> =>
  pipe(
    Duration.toNanos(value),
    O.filter(() => isVCardUtcOffsetValue(value)),
    O.map((nanoseconds) => {
      const sign = nanoseconds < 0n ? "-" : "+";
      const absoluteMinutes = (nanoseconds < 0n ? -nanoseconds : nanoseconds) / nanosecondsPerMinute;
      const hours = absoluteMinutes / 60n;
      const minutes = absoluteMinutes % 60n;
      return `${sign}${Str.padStart(2, "0")(Str.String(hours))}${Str.padStart(2, "0")(Str.String(minutes))}`;
    })
  );

/**
 * Effect duration constrained to RFC 6350 UTC-OFFSET range and precision.
 *
 * **Example** (Validate a vCard UTC offset duration)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { VCardUtcOffsetValue } from "./Microdata.model.ts"
 *
 * console.log(VCardUtcOffsetValue.is(Duration.minutes(330))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardUtcOffsetValue = S.Duration.check(
  S.makeFilter(isVCardUtcOffsetValue, {
    identifier: $I`VCardUtcOffsetValueCheck`,
    title: "RFC 6350 UTC offset duration",
    description: "Accepts minute-precision durations from negative 23:59 through positive 23:59.",
    expected: "a minute-precision duration from -23:59 through +23:59",
    message: "Expected an RFC 6350 UTC offset",
  })
).pipe(
  S.brand("VCardUtcOffsetValue"),
  $I.annoteSchema("VCardUtcOffsetValue", {
    description: "Effect duration constrained to the RFC 6350 UTC-OFFSET range and minute precision.",
  }),
  SchemaUtils.withEffectCodecStatics,
  SchemaUtils.withStatics(() => ({
    parse: parseVCardUtcOffset,
    format: formatVCardUtcOffset,
  }))
);

/**
 * Decoded value produced by {@link VCardUtcOffsetValue}.
 *
 * @see {@link VCardUtcOffsetValue} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardUtcOffsetValue = typeof VCardUtcOffsetValue.Type;

/**
 * Reversible RFC 6350 UTC-OFFSET codec backed by Effect duration.
 *
 * **Gotchas**
 *
 * Encode always writes `±HHMM`, so `+05` becomes `+0500`.
 *
 * **Example** (Decode a vCard UTC offset)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardUtcOffsetFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardUtcOffsetFromString.decodeUnknownEffect("+05"))
 * const encoded = Effect.runSync(VCardUtcOffsetFromString.encodeEffect(value))
 *
 * console.log(encoded) // "+0500"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardUtcOffsetFromString = VCardUtcOffsetString.pipe(
  S.decodeTo(VCardUtcOffsetValue, {
    decode: SchemaGetter.transformOrFail(
      flow(
        VCardUtcOffsetValue.parse,
        Effect.fromOption(() => invalidValue("Could not parse RFC 6350 UTC offset"))
      )
    ),
    encode: SchemaGetter.transformOrFail(
      flow(
        VCardUtcOffsetValue.format,
        Effect.fromOption(() => invalidValue("Could not encode RFC 6350 UTC offset")),
        Effect.flatMap(SchemaParser.decodeEffect(VCardUtcOffsetString))
      )
    ),
  }),
  $I.annoteSchema("VCardUtcOffsetFromString", {
    description: "RFC 6350 UTC-OFFSET string decoded to an Effect duration.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardUtcOffsetFromString}.
 *
 * @see {@link VCardUtcOffsetFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardUtcOffsetFromString = typeof VCardUtcOffsetFromString.Type;

const normalizeVCardTimestamp = (value: VCardZonedTimestampString): string => {
  const match = Str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z|[+-]\d{2}(?:\d{2})?)?$/)(value);
  return pipe(
    O.all({
      year: capture(match, 1),
      month: capture(match, 2),
      day: capture(match, 3),
      hour: capture(match, 4),
      minute: capture(match, 5),
      second: capture(match, 6),
      zone: capture(match, 7),
    }),
    O.map(({ day, hour, minute, month, second, year, zone }) => {
      const normalizedZone =
        zone === "Z" ? zone : Str.length(zone) === 3 ? `${zone}:00` : `${Str.slice(0, 3)(zone)}:${Str.slice(3)(zone)}`;
      return `${year}-${month}-${day}T${hour}:${minute}:${second}${normalizedZone}`;
    }),
    O.getOrElse(() => value)
  );
};

const isoUtcToVCardTimestamp = flow(Str.replace(/\.000Z$/, "Z"), Str.replace(/[-:]/g, ""));

const isWholeSecondDateTimeUtc = (value: DateTime.Utc): boolean => DateTime.toEpochMillis(value) % 1_000 === 0;

/**
 * UTC instant constrained to the whole-second precision of RFC 6350 TIMESTAMP.
 *
 * **Example** (Validate a whole-second UTC instant)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { VCardTimestampValue } from "./Microdata.model.ts"
 *
 * console.log(VCardTimestampValue.is(DateTime.makeUnsafe("2024-02-29T12:30:45.000Z"))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VCardTimestampValue = S.DateTimeUtc.check(
  S.makeFilter(isWholeSecondDateTimeUtc, {
    identifier: $I`VCardTimestampValueCheck`,
    title: "RFC 6350 timestamp instant",
    description: "Accepts UTC instants with whole-second precision.",
    expected: "a UTC instant with whole-second precision",
    message: "Expected an RFC 6350 timestamp instant",
  })
).pipe(
  S.brand("VCardTimestampValue"),
  $I.annoteSchema("VCardTimestampValue", {
    description: "UTC instant constrained to the whole-second precision representable by RFC 6350 TIMESTAMP.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardTimestampValue}.
 *
 * @see {@link VCardTimestampValue} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardTimestampValue = typeof VCardTimestampValue.Type;

/**
 * RFC 6350 TIMESTAMP codec to `DateTime.Utc`.
 *
 * **Gotchas**
 *
 * Floating timestamps remain valid in {@link VCardTimestampString} but fail
 * this UTC conversion. Leap-second timestamps likewise remain valid lexical
 * values but cannot be represented by `DateTime.Utc`. Encode drops offsets
 * to a `Z` UTC spelling (`20240229T123045Z`), not the original offset form.
 *
 * **Example** (Decode a vCard timestamp instant)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardTimestampFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardTimestampFromString.decodeUnknownEffect("20240229T123045Z"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardTimestampString} for the complete TIMESTAMP lexeme including floating forms; {@link VCardZonedTimestampString} for the zoned subset this codec consumes.
 * @category schemas
 * @since 0.0.0
 */
export const VCardTimestampFromString = VCardZonedTimestampString.pipe(
  S.decodeTo(VCardTimestampValue, {
    decode: SchemaGetter.transformOrFail(
      flow(normalizeVCardTimestamp, SchemaParser.decodeEffect(S.DateTimeUtcFromString))
    ),
    encode: SchemaGetter.transformOrFail(
      flow(DateTime.formatIso, isoUtcToVCardTimestamp, SchemaParser.decodeEffect(VCardZonedTimestampString))
    ),
  }),
  $I.annoteSchema("VCardTimestampFromString", { description: "RFC 6350 TIMESTAMP string decoded to DateTime.Utc." }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardTimestampFromString}.
 *
 * @see {@link VCardTimestampFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardTimestampFromString = typeof VCardTimestampFromString.Type;

/**
 * URL-compatible subset of RFC 6350 URI values, decoded to the platform URL type.
 *
 * **Gotchas**
 *
 * Values such as `urn:example:item` remain valid {@link VCardUriString} and
 * fail WHATWG URL parsing here.
 *
 * **Example** (Decode a vCard URL)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardUrlFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardUrlFromString.decodeUnknownEffect("https://example.com/item"))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardUriString} for any absolute RFC 3986 URI, including URNs that fail WHATWG URL parsing.
 * @category schemas
 * @since 0.0.0
 */
export const VCardUrlFromString = VCardUriString.pipe(
  S.decodeTo(S.URLFromString, {
    decode: SchemaGetter.passthroughSubtype(),
    encode: SchemaGetter.transformOrFail(SchemaParser.decodeEffect(VCardUriString)),
  }),
  $I.annoteSchema("VCardUrlFromString", {
    description: "RFC 6350 URI value in the URL-compatible subset decoded to a platform URL.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardUrlFromString}.
 *
 * @see {@link VCardUrlFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardUrlFromString = typeof VCardUrlFromString.Type;

/**
 * Context-discriminated microdata property value.
 *
 * **Details**
 *
 * The tag carries the DOM or vocabulary fact that a bare string cannot
 * provide. Each branch still encodes its `value` field back to a string.
 *
 * **Example** (Decode a contextual microdata value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MicrodataContextualValueFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(MicrodataContextualValueFromString.decodeUnknownEffect({ _tag: "TextProperty", value: "plain text" }))
 *
 * console.log(value)
 * ```
 *
 * @see {@link MicrodataRuntimeValueFromString} for untagged Effect-first decoding; {@link MicrodataRdfTimeValueFromString} for W3C time-element RDF typing.
 * @category schemas
 * @since 0.0.0
 */
export const MicrodataContextualValueFromString = S.TaggedUnion({
  UrlProperty: { value: MicrodataUrlFromString },
  DataOrMeterProperty: { value: MicrodataDataValueFromString },
  TimeProperty: { value: MicrodataRdfTimeValueFromString },
  RuntimeTypedProperty: { value: MicrodataRuntimeValueFromString },
  TextProperty: { value: S.String },
}).pipe(
  $I.annoteSchema("MicrodataContextualValueFromString", {
    description: "Microdata property value discriminated by the DOM or vocabulary context that determines typing.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link MicrodataContextualValueFromString}.
 *
 * @see {@link MicrodataContextualValueFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type MicrodataContextualValueFromString = typeof MicrodataContextualValueFromString.Type;

/**
 * RFC 6350 scalar value selected by its declared VALUE type.
 *
 * **Details**
 *
 * This tagged boundary prevents ambiguous strings such as `TRUE`, `10`, or
 * `urn:example:x` from being assigned a scalar type by branch order. Only
 * `boolean`, `integer`, `float`, and `utc-offset` decode through the
 * `*FromString` codecs to runtime values (boolean, Int64, BigDecimal,
 * Duration). `text`, `uri`, `date`, `time`, `date-time`, `date-and-or-time`,
 * `timestamp`, and `language-tag` stay branded lexical strings —
 * `timestamp` remains {@link VCardTimestampString}, not
 * {@link VCardTimestampFromString}. Convert timestamps with that codec
 * separately; {@link MicrodataContextualValueFromString} does decode URL,
 * numeric, and runtime branches.
 *
 * **Example** (Decode a declared vCard scalar)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VCardTypedScalarFromString } from "./Microdata.model.ts"
 *
 * const value = Effect.runSync(VCardTypedScalarFromString.decodeUnknownEffect({ _tag: "text", value: "plain text" }))
 *
 * console.log(value)
 * ```
 *
 * @see {@link VCardTimestampFromString} to convert a tagged `timestamp` lexeme to `DateTime.Utc`; {@link VCardUrlFromString} to convert a tagged `uri` lexeme to a platform URL.
 * @category schemas
 * @since 0.0.0
 */
export const VCardTypedScalarFromString = VCardValueType.toTaggedUnion("_tag")({
  text: { value: VCardTextString },
  uri: { value: VCardUriString },
  date: { value: VCardDateString },
  time: { value: VCardTimeString },
  "date-time": { value: VCardDateTimeString },
  "date-and-or-time": { value: VCardDateAndOrTimeString },
  timestamp: { value: VCardTimestampString },
  boolean: { value: VCardBooleanFromString },
  integer: { value: VCardIntegerFromString },
  float: { value: VCardFloatFromString },
  "utc-offset": { value: VCardUtcOffsetFromString },
  "language-tag": { value: VCardLanguageTagString },
}).pipe(
  $I.annoteSchema("VCardTypedScalarFromString", {
    description: "RFC 6350 scalar value discriminated by its declared VALUE type.",
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded value produced by {@link VCardTypedScalarFromString}.
 *
 * @see {@link VCardTypedScalarFromString} for runtime validation and Effect codecs.
 * @category models
 * @since 0.0.0
 */
export type VCardTypedScalarFromString = typeof VCardTypedScalarFromString.Type;
