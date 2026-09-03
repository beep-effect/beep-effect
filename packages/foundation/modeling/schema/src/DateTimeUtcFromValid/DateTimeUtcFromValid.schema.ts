/**
 * Schemas for normalizing valid Effect `DateTime.Input` values into `DateTime.Utc`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { DateTime, Effect, pipe, SchemaIssue, SchemaTransformation } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("DateTimeUtcFromValid");

/**
 * Literal discriminator values used by tagged date-time input representations.
 *
 * **Example** (Decoding Instant discriminator)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DateTimeInputKind } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const decode = S.decodeUnknownSync(DateTimeInputKind)
 * const kind = decode("Instant")
 * console.log(kind)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const DateTimeInputKind = LiteralKit([
  "number",
  "string",
  "Date",
  "DateTime",
  "Parts",
  "Instant",
  "InstantWithZone",
]).pipe(
  $I.annoteSchema("DateTimeInputKind", {
    description: "Discriminator values for DateTime.Input transport representations.",
  })
);

/**
 * {@inheritDoc DateTimeInputKind}
 * @category models
 * @since 0.0.0
 */
export type DateTimeInputKind = typeof DateTimeInputKind.Type;

interface InputKindStatics<TKind extends DateTimeInputKind, TSchema extends S.Top> extends Record<string, unknown> {
  readonly makeTagged: (input: TSchema["Type"]) => {
    readonly _tag: TKind;
    readonly value: TSchema["Type"];
  };
  readonly Tagged: S.TaggedStruct<
    TKind,
    {
      readonly value: TSchema;
    }
  > & {
    readonly is: (input: unknown) => input is S.TaggedStruct<
      TKind,
      {
        readonly value: TSchema;
      }
    >["Type"];
  };
}

const makeInputKindStatics: {
  <TKind extends DateTimeInputKind>(
    kind: TKind
  ): <TSchema extends S.Top>(self: TSchema) => InputKindStatics<TKind, TSchema>;
  <TKind extends DateTimeInputKind, TSchema extends S.Top>(
    self: TSchema,
    kind: TKind
  ): InputKindStatics<TKind, TSchema>;
} = dual(
  2,
  <TKind extends DateTimeInputKind, TSchema extends S.Top>(
    self: TSchema,
    kind: TKind
  ): InputKindStatics<TKind, TSchema> => {
    const Tagged = S.TaggedStruct(kind, {
      value: self,
    }).pipe(
      SchemaUtils.withStatics((schema) => ({
        is: S.is(schema),
      }))
    );

    return {
      Tagged,
      makeTagged: (input: TSchema["Type"]) => ({
        _tag: kind,
        value: input,
      }),
    };
  }
);

const isValidDateTimeInput = (input: DateTime.DateTime.Input): boolean => pipe(DateTime.make(input), O.isSome);

const DateTimeInputNumberCheck = S.makeFilter((value: number): value is number => isValidDateTimeInput(value), {
  identifier: $I`DateTimeInputNumberCheck`,
  title: "DateTime Input Number",
  description: "A finite number that can be converted into a DateTime.Utc.",
  message: "Expected a number that can be converted into a DateTime.Utc",
});

const DateTimeInputStringCheck = S.makeFilter((value: string): value is string => isValidDateTimeInput(value), {
  identifier: $I`DateTimeInputStringCheck`,
  title: "DateTime Input String",
  description: "A string that can be converted into a DateTime.Utc.",
  message: "Expected a string that can be converted into a DateTime.Utc",
});

const DateTimeInputTimeZoneIdCheck = S.makeFilter(
  (value: string): value is string => pipe(DateTime.zoneFromString(value), O.isSome),
  {
    identifier: $I`DateTimeInputTimeZoneIdCheck`,
    title: "DateTime Input Time Zone Id",
    description: "A time zone identifier accepted by Effect DateTime.",
    message: "Expected a valid DateTime time zone identifier",
  }
);

const DateTimeInputTimeZoneId = S.String.check(DateTimeInputTimeZoneIdCheck).pipe(
  $I.annoteSchema("DateTimeInputTimeZoneId", {
    description: "A time zone identifier accepted by Effect DateTime.",
  })
);

/**
 * Valid string input accepted by Effect `DateTime.make`.
 *
 * **Details**
 *
 * The schema also exposes a tagged representation used when encoding through
 * {@link DateTimeUtcFromValid}.
 *
 * **Example** (Decoding and tagging string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DateTimeInputString } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const decode = S.decodeUnknownSync(DateTimeInputString)
 * const value = decode("2024-01-01T00:00:00.000Z")
 * const tagged = DateTimeInputString.makeTagged(value)
 * console.log(tagged._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const DateTimeInputString = S.String.check(DateTimeInputStringCheck).pipe(
  $I.annoteSchema("DateTimeInputString", {
    description: "A string accepted by Effect DateTime.make as a DateTime input.",
  }),
  SchemaUtils.withStatics(makeInputKindStatics("string"))
);

/**
 * {@inheritDoc DateTimeInputString}
 * @category models
 * @since 0.0.0
 */
export type DateTimeInputString = typeof DateTimeInputString.Type;

/**
 * Valid numeric epoch-millisecond input accepted by Effect `DateTime.make`.
 *
 * **Details**
 *
 * The schema also exposes a tagged representation used by callers that need a
 * discriminated transport shape.
 *
 * **Example** (Decoding and tagging number)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DateTimeInputNumber } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const decode = S.decodeUnknownSync(DateTimeInputNumber)
 * const value = decode(1_704_067_200_000)
 * const tagged = DateTimeInputNumber.makeTagged(value)
 * console.log(tagged._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const DateTimeInputNumber = S.Finite.check(DateTimeInputNumberCheck).pipe(
  $I.annoteSchema("DateTimeInputNumber", {
    description: "A finite epoch-millisecond number accepted by Effect DateTime.make.",
  }),
  SchemaUtils.withStatics(makeInputKindStatics("number"))
);

/**
 * {@inheritDoc DateTimeInputNumber}
 * @category models
 * @since 0.0.0
 */
export type DateTimeInputNumber = typeof DateTimeInputNumber.Type;

/**
 * Valid JavaScript `Date` input accepted by Effect `DateTime.make`.
 *
 * **Details**
 *
 * The schema also exposes a tagged representation for encoded transport.
 *
 * **Example** (Decoding and tagging Date)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DateTimeInputDate } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const decode = S.decodeUnknownSync(DateTimeInputDate)
 * const value = decode(new Date("2024-01-01T00:00:00.000Z"))
 * const tagged = DateTimeInputDate.makeTagged(value)
 * console.log(tagged._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const DateTimeInputDate = S.Date.pipe(
  $I.annoteSchema("DateTimeInputDate", {
    description: "A valid JavaScript Date accepted by Effect DateTime.make.",
  }),
  SchemaUtils.withStatics(makeInputKindStatics("Date"))
);

/**
 * {@inheritDoc DateTimeInputDate}
 * @category models
 * @since 0.0.0
 */
export type DateTimeInputDate = typeof DateTimeInputDate.Type;

/**
 * Existing Effect `DateTime` values accepted by {@link DateTimeUtcFromValid}.
 *
 * **Details**
 *
 * Zoned values decode to the same instant in UTC.
 *
 * **Example** (Decoding DateTime input)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as S from "effect/Schema"
 * import { DateTimeInputDateTime } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const decode = S.decodeUnknownSync(DateTimeInputDateTime)
 * const value = decode(DateTime.makeUnsafe("2024-01-01T00:00:00.000Z"))
 * console.log(DateTime.formatIso(value))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const DateTimeInputDateTime = S.Union([S.DateTimeUtc, S.DateTimeZoned]).pipe(
  $I.annoteSchema("DateTimeInputDateTime", {
    description: "An existing Effect DateTime value accepted as a DateTime input.",
  })
);

/**
 * {@inheritDoc DateTimeInputDateTime}
 * @category models
 * @since 0.0.0
 */
export type DateTimeInputDateTime = typeof DateTimeInputDateTime.Type;

/**
 * Tagged Effect `DateTime.Instant` transport value.
 *
 * **Example** (Creating Instant tagged value)
 *
 * ```ts
 * import { DateTimeInputInstant } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const value = new DateTimeInputInstant({ epochMilliseconds: 1_704_067_200_000 })
 * console.log(value._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export class DateTimeInputInstant extends S.TaggedClass<DateTimeInputInstant>($I`DateTimeInputInstant`)(
  "Instant",
  {
    epochMilliseconds: DateTimeInputNumber,
  },
  $I.annote("DateTimeInputInstant", {
    description: "A tagged DateTime.Instant transport value with epoch milliseconds.",
  })
) {}

/**
 * Tagged Effect `DateTime.InstantWithZone` transport value.
 *
 * **Example** (Creating InstantWithZone tagged value)
 *
 * ```ts
 * import { DateTimeInputInstantWithZone } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const value = new DateTimeInputInstantWithZone({
 *   epochMilliseconds: 1_704_067_200_000,
 *   timeZoneId: "UTC"
 * })
 * console.log(value._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export class DateTimeInputInstantWithZone extends S.TaggedClass<DateTimeInputInstantWithZone>(
  $I`DateTimeInputInstantWithZone`
)(
  "InstantWithZone",
  {
    epochMilliseconds: DateTimeInputNumber,
    timeZoneId: DateTimeInputTimeZoneId,
  },
  $I.annote("DateTimeInputInstantWithZone", {
    description: "A tagged DateTime.InstantWithZone transport value with a valid time zone identifier.",
  })
) {}

const DateTimePart = S.Finite;
const DateTimePartKey = S.optionalKey(DateTimePart);

/**
 * Tagged `Partial<DateTime.Parts>` transport value.
 *
 * **Details**
 *
 * Missing fields default the same way Effect `DateTime.make` defaults partial
 * parts: from the Unix epoch in UTC.
 *
 * **Example** (Creating Parts tagged value)
 *
 * ```ts
 * import { DateTimeInputParts } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const value = new DateTimeInputParts({ year: 2024, month: 1, day: 1 })
 * console.log(value._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export class DateTimeInputParts extends S.TaggedClass<DateTimeInputParts>($I`DateTimeInputParts`)(
  "Parts",
  {
    millisecond: DateTimePartKey,
    second: DateTimePartKey,
    minute: DateTimePartKey,
    hour: DateTimePartKey,
    day: DateTimePartKey,
    month: DateTimePartKey,
    year: DateTimePartKey,
  },
  $I.annote("DateTimeInputParts", {
    description: "A tagged Partial<DateTime.Parts> transport value.",
  })
) {}

/**
 * Union of raw and tagged values accepted by {@link DateTimeUtcFromValid}.
 *
 * **Details**
 *
 * Raw `DateTime.Input` values are supported for decoding. Tagged string,
 * number, and Date wrappers provide deterministic encoded representations.
 *
 * **Example** (Decoding DateTimeInput union)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DateTimeInput } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const decode = S.decodeUnknownSync(DateTimeInput)
 * const input = decode("2024-01-01T00:00:00.000Z")
 * console.log(input)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const DateTimeInput = S.Union([
  DateTimeInputString,
  DateTimeInputString.Tagged,
  DateTimeInputNumber,
  DateTimeInputNumber.Tagged,
  DateTimeInputDate,
  DateTimeInputDate.Tagged,
  DateTimeInputDateTime,
  DateTimeInputInstant,
  DateTimeInputInstantWithZone,
  DateTimeInputParts,
]).pipe(
  $I.annoteSchema("DateTimeInput", {
    description: "Raw Effect DateTime.Input values plus tagged primitive transports accepted by DateTimeUtcFromValid.",
  })
);

/**
 * {@inheritDoc DateTimeInput}
 * @category models
 * @since 0.0.0
 */
export type DateTimeInput = typeof DateTimeInput.Type;

const toDateTimeInput = (input: DateTimeInput): DateTime.DateTime.Input => {
  if (DateTimeInputString.Tagged.is(input)) {
    return input.value;
  }
  if (DateTimeInputNumber.Tagged.is(input)) {
    return input.value;
  }
  if (DateTimeInputDate.Tagged.is(input)) {
    return input.value;
  }
  return input;
};

const decodeDateTimeInput = (input: DateTimeInput): Effect.Effect<DateTime.Utc, SchemaIssue.Issue> =>
  pipe(
    DateTime.make(toDateTimeInput(input)),
    O.map(DateTime.toUtc),
    Effect.fromOption(
      () =>
        new SchemaIssue.InvalidValue({
          message: "Expected a valid Effect DateTime.Input value",
        })
    )
  );

const encodeDateTimeInput = (value: DateTime.Utc): Effect.Effect<DateTimeInput> =>
  Effect.succeed(DateTimeInputString.makeTagged(DateTime.formatIso(value)));

/**
 * Bidirectional schema transformation from valid DateTime input to `DateTime.Utc`.
 *
 * **Details**
 *
 * Decoding accepts raw Effect `DateTime.Input` values and this module's tagged
 * primitive/object transport values. Encoding produces a canonical tagged ISO
 * string representation so the encoded value is deterministic.
 *
 * **Example** (Decoding and encoding UTC)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as S from "effect/Schema"
 * import { DateTimeUtcFromValid } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const decode = S.decodeUnknownSync(DateTimeUtcFromValid)
 * const encode = S.encodeSync(DateTimeUtcFromValid)
 *
 * const utc = decode("2024-01-01T00:00:00.000Z")
 * const encoded = encode(utc)
 *
 * console.log(DateTime.formatIso(utc))
 * console.log(encoded)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const DateTimeUtcFromValid = DateTimeInput.pipe(
  S.decodeTo(
    S.DateTimeUtc,
    SchemaTransformation.transformOrFail({
      decode: decodeDateTimeInput,
      encode: encodeDateTimeInput,
    })
  ),
  $I.annoteSchema("DateTimeUtcFromValid", {
    description: "Bidirectional schema transformation from valid Effect DateTime.Input values into DateTime.Utc.",
  })
);

/**
 * {@inheritDoc DateTimeUtcFromValid}
 * @category models
 * @since 0.0.0
 */
export type DateTimeUtcFromValid = typeof DateTimeUtcFromValid.Type;
