/**
 * UTC timestamp value objects, branded ISO string schemas, and epoch-millisecond schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { LocalDate } from "@beep/schema/LocalDate";
import { Str } from "@beep/utils";
import { DateTime, Effect, flow, Order as Order_, pipe, SchemaIssue, SchemaTransformation } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { NonNegativeInt } from "../Int.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { NonEmptyTrimmedStr } from "../String.ts";
import type { Brand } from "effect";
import type * as Ordering from "effect/Ordering";

const $I = $SchemaId.create("Timestamp");

const stripMilliseconds: (value: string) => string = flow(Str.replace(/\.\d{3}Z$/, "Z"));

const normalizeIsoString = (input: string | number): string =>
  pipe(DateTime.makeUnsafe(input), DateTime.formatIso, stripMilliseconds);

/**
 * Branded ISO 8601 datetime string schema.
 *
 * **Details**
 *
 * Accepts a non-empty trimmed string that can be parsed as a valid `DateTime`.
 *
 * **Example** (Decode valid ISO string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ISOStr } from "@beep/schema/Timestamp"
 *
 * const decode = S.decodeUnknownSync(ISOStr)
 *
 * const iso = decode("2024-01-01T00:00:00.000Z")
 * console.log(iso)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ISOStr = NonEmptyTrimmedStr.check(S.makeFilter((i) => O.isSome(DateTime.make(i)))).pipe(
  S.brand("ISOStr"),
  $I.annoteSchema("ISOStr", {
    description: "ISO 8601 datetime string",
  })
);

/**
 * Branded ISO string type extracted from {@link ISOStr}.
 *
 * **Example** (Type annotated ISO decode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { ISOStr } from "@beep/schema/Timestamp"
 * import { ISOStr as ISOStrSchema } from "@beep/schema/Timestamp"
 *
 * const iso: ISOStr = S.decodeUnknownSync(ISOStrSchema)("2024-01-01T00:00:00Z")
 * console.log(iso)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ISOStr = typeof ISOStr.Type;

/**
 * Branded non-negative integer schema for epoch milliseconds since 1970-01-01T00:00:00.000Z.
 *
 * **Example** (Decode epoch milliseconds)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EpochMillis } from "@beep/schema/Timestamp"
 *
 * const decode = S.decodeUnknownSync(EpochMillis)
 *
 * const millis = decode(1704067200000)
 * console.log(millis)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const EpochMillis = S.make<(typeof NonNegativeInt)["Rebuild"]>(NonNegativeInt.ast).pipe(
  S.brand("EpochMillis"),
  $I.annoteSchema("EpochMillis", {
    description: "Epoch milliseconds since 1970-01-01T00:00:00.000Z",
    documentation: "Stores the epoch milliseconds internally.\nEncoded as ISO 8601 datetime string.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"])
);

/**
 * Branded epoch milliseconds type extracted from {@link EpochMillis}.
 *
 * **Example** (Type annotated millis decode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { EpochMillis } from "@beep/schema/Timestamp"
 * import { EpochMillis as EpochMillisSchema } from "@beep/schema/Timestamp"
 *
 * const millis: EpochMillis = S.decodeUnknownSync(EpochMillisSchema)(1704067200000)
 * console.log(millis)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EpochMillis = typeof EpochMillis.Type;

/**
 * Schema that normalizes numeric timestamps or ISO strings into ISO strings without fractional seconds.
 *
 * **Example** (Normalize fractional ISO string)
 *
 * ```ts import.meta.vitest name="Normalize fractional ISO string"
 * import * as S from "effect/Schema"
 * import { ToIsoStr } from "@beep/schema/Timestamp"
 *
 * const decode = S.decodeUnknownSync(ToIsoStr)
 *
 * const iso = decode("2024-01-01T00:00:00.123Z")
 * iso // => "2024-01-01T00:00:00Z"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ToIsoStr = S.Union([ISOStr, S.Finite]).pipe(
  S.decodeTo(
    ISOStr,
    SchemaTransformation.transform({
      decode: (input) => pipe(DateTime.makeUnsafe(input), DateTime.formatIso, stripMilliseconds),
      encode: (isoStr) => pipe(DateTime.makeUnsafe(isoStr), DateTime.formatIso, stripMilliseconds, ISOStr.make),
    })
  ),
  $I.annoteSchema("ToIsoStr", {
    description: "Schema transformer converting timestamps (numbers or ISO strings) into normalized ISO strings.",
    documentation: "Always emits ISO strings without fractional seconds to keep storage consistent.",
  })
);

/**
 * Normalized ISO string type extracted from {@link ToIsoStr}.
 *
 * **Example** (Typed normalized ISO decode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { ToIsoString } from "@beep/schema/Timestamp"
 * import { ToIsoStr } from "@beep/schema/Timestamp"
 *
 * const iso: ToIsoString = S.decodeUnknownSync(ToIsoStr)("2024-01-01T00:00:00.123Z")
 * console.log(iso)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ToIsoString = ToIsoStr;

/**
 * {@inheritDoc ToIsoString}
 * @category models
 * @since 0.0.0
 */
export type ToIsoStr = typeof ToIsoStr.Type;

/**
 * Namespace members for {@link ToIsoStr}.
 *
 * **Example** (Encode ToIsoStr namespace type)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ToIsoStr } from "@beep/schema/Timestamp"
 *
 * const decoded = S.decodeUnknownSync(ToIsoStr)("2024-01-01T00:00:00.123Z")
 * const encoded: ToIsoStr.Encoded = S.encodeSync(ToIsoStr)(decoded)
 * console.log(encoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ToIsoStr {
  /**
   * Encoded representation of {@link ToIsoStr} (string or number union).
   *
   * @since 0.0.0
   * @category models
   */
  export type Encoded = typeof ToIsoStr.Encoded;
}

/**
 * Schema class wrapping `DateTime.Utc` as epoch milliseconds.
 *
 * **Details**
 *
 * Provides conversions to `DateTime.Utc`, `Date`, `ISOStr`, and `LocalDate`.
 *
 * **Example** (Make and convert Timestamp)
 *
 * ```ts
 * import { EpochMillis, Timestamp } from "@beep/schema/Timestamp"
 *
 * const ts = Timestamp.make({ epochMillis: EpochMillis.make(1704067200000) })
 *
 * console.log(ts.toISOStr())
 * console.log(ts.toLocalDate().toISOString())
 * ```
 *
 * **Example** (Compare timestamps with isBefore)
 *
 * ```ts import.meta.vitest name="Compare timestamps with isBefore"
 * import { EpochMillis, Timestamp, isBefore, now } from "@beep/schema/Timestamp"
 *
 * const a = now()
 * const b = Timestamp.make({ epochMillis: EpochMillis.make(0) })
 *
 * isBefore(b, a) // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export class Timestamp extends S.Class<Timestamp>("Timestamp")(
  {
    epochMillis: EpochMillis,
  },
  $I.annote("Timestamp", {
    description: "Timestamp - A Schema.Class wrapping DateTime.Utc for UTC timestamps",
    documentation: "Stores the epoch milliseconds internally.\nEncoded as ISO 8601 datetime string.",
  })
) {
  static readonly is = S.is(Timestamp);

  /**
   * Get the underlying DateTime.Utc instance
   *
   * @since 0.0.0
   * @category utilities
   * @returns * {@link Timestamp.toDateTime}
   */
  readonly toDateTime: () => DateTime.Utc = (): DateTime.Utc => DateTime.makeUnsafe(this.epochMillis);

  /**
   * Convert to JavaScript Date
   *
   * @since 0.0.0
   * @category utilities
   * @returns */
  readonly toDate: () => Date = (): Date => DateTime.toDateUtc(this.toDateTime());

  /**
   * Convert this timestamp to a branded ISO 8601 string without fractional seconds.
   *
   * @since 0.0.0
   * @category utilities
   */
  readonly toISOStr: () => Brand.Branded<Brand.Branded<string, "NonEmptyTrimmedStr">, "ISOStr"> = (): Brand.Branded<
    Brand.Branded<string, "NonEmptyTrimmedStr">,
    "ISOStr"
  > => ISOStr.make(normalizeIsoString(this.epochMillis));

  /**
   * Convert to string representation
   *
   * @since 0.0.0
   * @category utilities
   * @returns */
  readonly toStr: () => ISOStr = (): ISOStr => ISOStr.make(this.toISOStr());

  /**
   * Extract the LocalDate portion (UTC date)
   *
   * @since 0.0.0
   * @category utilities
   * @returns */
  readonly toLocalDate: () => LocalDate = (): LocalDate => {
    const date = DateTime.toPartsUtc(this.toDateTime());
    return LocalDate.make({
      year: date.year,
      month: date.month,
      day: date.day,
    });
  };
}

/**
 * Type guard for `Timestamp` instances.
 *
 * **Example** (Guard Timestamp instance)
 *
 * ```ts
 * import { EpochMillis, Timestamp, isTimestamp } from "@beep/schema/Timestamp"
 *
 * const timestamp = Timestamp.make({ epochMillis: EpochMillis.make(1704067200000) })
 * console.log(isTimestamp(timestamp))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isTimestamp = Timestamp.is;

/**
 * Create a `Timestamp` from a `DateTime.Utc`.
 *
 * **Example** (Create from DateTime.Utc)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { fromDateTime } from "@beep/schema/Timestamp"
 *
 * const timestamp = fromDateTime(DateTime.makeUnsafe("2024-01-01T00:00:00Z"))
 * console.log(timestamp.epochMillis)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromDateTime = (dateTime: DateTime.Utc): Timestamp =>
  Timestamp.make({ epochMillis: EpochMillis.make(dateTime.epochMilliseconds) });

/**
 * Create a `Timestamp` from a JavaScript `Date`.
 *
 * **Example** (Create from JavaScript Date)
 *
 * ```ts
 * import { fromDate } from "@beep/schema/Timestamp"
 *
 * const timestamp = fromDate(new Date("2024-01-01T00:00:00Z"))
 * console.log(timestamp.toISOStr())
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromDate = (date: Date): Timestamp => Timestamp.make({ epochMillis: EpochMillis.make(date.getTime()) });

/**
 * Create a `Timestamp` from an ISO 8601 string, returning an `Effect` that fails for invalid input.
 *
 * **Example** (Parse ISO string Effect)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { fromString } from "@beep/schema/Timestamp"
 *
 * const program = fromString("2024-01-01T00:00:00Z")
 * const timestamp = await Effect.runPromise(program)
 * console.log(timestamp.epochMillis)
 * ```
 *
 * @effects Parses a date string and fails with `SchemaIssue.InvalidValue` when the input is not a valid DateTime.
 * @category constructors
 * @since 0.0.0
 */
export const fromString = (dateString: string): Effect.Effect<Timestamp, SchemaIssue.InvalidValue> =>
  pipe(
    DateTime.make(dateString),
    O.match({
      onNone: () => Effect.fail(new SchemaIssue.InvalidValue()),
      onSome: (dateTime) =>
        Effect.succeed(Timestamp.make({ epochMillis: EpochMillis.make(DateTime.toEpochMillis(dateTime)) })),
    })
  );

/**
 * Create a `Timestamp` for the current wall-clock time.
 *
 * **Example** (Current wall-clock timestamp)
 *
 * ```ts
 * import { now } from "@beep/schema/Timestamp"
 *
 * const timestamp = now()
 * console.log(timestamp.epochMillis > 0)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const now = (): Timestamp =>
  Timestamp.make({ epochMillis: EpochMillis.make(DateTime.nowUnsafe().epochMilliseconds) });

/**
 * Get the current timestamp as an `Effect` using the Clock service, testable with `TestClock`.
 *
 * **Example** (Clock-based current timestamp)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { nowEffect } from "@beep/schema/Timestamp"
 *
 * const timestamp = await Effect.runPromise(nowEffect)
 * console.log(timestamp.epochMillis > 0)
 * ```
 *
 * @effects Reads the Effect Clock service and returns the current wall-clock timestamp.
 * @category constructors
 * @since 0.0.0
 */
export const nowEffect: Effect.Effect<Timestamp> = Effect.map(
  Effect.clockWith((clock) => clock.currentTimeMillis),
  (millis) => Timestamp.make({ epochMillis: EpochMillis.make(Number(millis)) })
);

/**
 * Chronological `Order` for `Timestamp` values.
 *
 * **Example** (Compare chronological order)
 *
 * ```ts
 * import { EpochMillis, Order, Timestamp } from "@beep/schema/Timestamp"
 *
 * const earlier = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * const later = Timestamp.make({ epochMillis: EpochMillis.make(2) })
 * console.log(Order(earlier, later))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const Order: {
  (that: Timestamp): (self: Timestamp) => Ordering.Ordering;
  (self: Timestamp, that: Timestamp): Ordering.Ordering;
} = dual(
  2,
  Order_.make<Timestamp>((a, b) => {
    if (a.epochMillis < b.epochMillis) return -1;
    if (a.epochMillis > b.epochMillis) return 1;
    return 0;
  })
);

/**
 * Dual predicate returning `true` when `self` is chronologically before `that`.
 *
 * **Example** (Check earlier timestamp)
 *
 * ```ts
 * import { EpochMillis, Timestamp, isBefore } from "@beep/schema/Timestamp"
 *
 * const earlier = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * const later = Timestamp.make({ epochMillis: EpochMillis.make(2) })
 * console.log(isBefore(earlier, later))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isBefore: {
  (that: Timestamp): (self: Timestamp) => boolean;
  (self: Timestamp, that: Timestamp): boolean;
} = dual(2, (self: Timestamp, that: Timestamp): boolean => Order(self, that) === -1);

/**
 * Dual predicate returning `true` when `self` is chronologically after `that`.
 *
 * **Example** (Check later timestamp)
 *
 * ```ts
 * import { EpochMillis, Timestamp, isAfter } from "@beep/schema/Timestamp"
 *
 * const earlier = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * const later = Timestamp.make({ epochMillis: EpochMillis.make(2) })
 * console.log(isAfter(later, earlier))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isAfter: {
  (that: Timestamp): (self: Timestamp) => boolean;
  (self: Timestamp, that: Timestamp): boolean;
} = dual(2, (self: Timestamp, that: Timestamp): boolean => Order(self, that) === 1);

/**
 * Check whether two timestamps represent the same point in time.
 *
 * **Example** (Equal epoch timestamps)
 *
 * ```ts
 * import { EpochMillis, Timestamp, equals } from "@beep/schema/Timestamp"
 *
 * const a = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * const b = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * console.log(equals(a, b))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const equals: {
  (that: Timestamp): (self: Timestamp) => boolean;
  (self: Timestamp, that: Timestamp): boolean;
} = dual(2, S.toEquivalence(Timestamp));

/**
 * Add milliseconds to a timestamp.
 *
 * **Example** (Add milliseconds to timestamp)
 *
 * ```ts
 * import { EpochMillis, Timestamp, addMillis } from "@beep/schema/Timestamp"
 *
 * const timestamp = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * console.log(addMillis(timestamp, 999).epochMillis)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const addMillis: {
  (millis: number): (self: Timestamp) => Timestamp;
  (self: Timestamp, millis: number): Timestamp;
} = dual(
  2,
  (self: Timestamp, millis: number): Timestamp =>
    Timestamp.make({ epochMillis: EpochMillis.make(self.epochMillis + millis) })
);

/**
 * Add seconds to a timestamp.
 *
 * **Example** (Add seconds to timestamp)
 *
 * ```ts
 * import { EpochMillis, Timestamp, addSeconds } from "@beep/schema/Timestamp"
 *
 * const timestamp = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * console.log(addSeconds(timestamp, 1).epochMillis)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const addSeconds: {
  (seconds: number): (self: Timestamp) => Timestamp;
  (self: Timestamp, seconds: number): Timestamp;
} = dual(2, (self: Timestamp, seconds: number): Timestamp => addMillis(self, seconds * 1000));

/**
 * Add minutes to a timestamp.
 *
 * **Example** (Add minutes to timestamp)
 *
 * ```ts
 * import { EpochMillis, Timestamp, addMinutes } from "@beep/schema/Timestamp"
 *
 * const timestamp = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * console.log(addMinutes(timestamp, 1).epochMillis)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const addMinutes: {
  (minutes: number): (self: Timestamp) => Timestamp;
  (self: Timestamp, minutes: number): Timestamp;
} = dual(2, (self: Timestamp, minutes: number): Timestamp => addMillis(self, minutes * 60 * 1000));

/**
 * Add hours to a timestamp.
 *
 * **Example** (Add hours to timestamp)
 *
 * ```ts
 * import { EpochMillis, Timestamp, addHours } from "@beep/schema/Timestamp"
 *
 * const timestamp = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * console.log(addHours(timestamp, 1).epochMillis)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const addHours: {
  (hours: number): (self: Timestamp) => Timestamp;
  (self: Timestamp, hours: number): Timestamp;
} = dual(2, (self: Timestamp, hours: number): Timestamp => addMillis(self, hours * 60 * 60 * 1000));

/**
 * Add days to a timestamp.
 *
 * **Example** (Add days to timestamp)
 *
 * ```ts
 * import { EpochMillis, Timestamp, addDays } from "@beep/schema/Timestamp"
 *
 * const timestamp = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * console.log(addDays(timestamp, 1).epochMillis)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const addDays: {
  (days: number): (self: Timestamp) => Timestamp;
  (self: Timestamp, days: number): Timestamp;
} = dual(2, (self: Timestamp, days: number): Timestamp => addMillis(self, days * 24 * 60 * 60 * 1000));

/**
 * Get the difference in milliseconds between two timestamps.
 *
 * **Example** (Difference in milliseconds)
 *
 * ```ts
 * import { EpochMillis, Timestamp, diffInMillis } from "@beep/schema/Timestamp"
 *
 * const earlier = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * const later = Timestamp.make({ epochMillis: EpochMillis.make(1001) })
 * console.log(diffInMillis(later, earlier))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const diffInMillis: {
  (that: Timestamp): (self: Timestamp) => number;
  (self: Timestamp, that: Timestamp): number;
} = dual(2, (self: Timestamp, that: Timestamp): number => self.epochMillis - that.epochMillis);

/**
 * Get the difference in seconds between two timestamps.
 *
 * **Example** (Difference in seconds)
 *
 * ```ts
 * import { EpochMillis, Timestamp, diffInSeconds } from "@beep/schema/Timestamp"
 *
 * const earlier = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * const later = Timestamp.make({ epochMillis: EpochMillis.make(2001) })
 * console.log(diffInSeconds(later, earlier))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const diffInSeconds: {
  (that: Timestamp): (self: Timestamp) => number;
  (self: Timestamp, that: Timestamp): number;
} = dual(2, (self: Timestamp, that: Timestamp): number => Math.floor(diffInMillis(self, that) / 1000));

/**
 * Get the minimum of two timestamps.
 *
 * **Example** (Earlier of two timestamps)
 *
 * ```ts
 * import { EpochMillis, Timestamp, min } from "@beep/schema/Timestamp"
 *
 * const earlier = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * const later = Timestamp.make({ epochMillis: EpochMillis.make(2) })
 * console.log(min(earlier, later).epochMillis)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const min: {
  (that: Timestamp): (self: Timestamp) => Timestamp;
  (self: Timestamp, that: Timestamp): Timestamp;
} = dual(2, (self: Timestamp, that: Timestamp): Timestamp => (Order(self, that) <= 0 ? self : that));

/**
 * Get the maximum of two timestamps.
 *
 * **Example** (Later of two timestamps)
 *
 * ```ts
 * import { EpochMillis, Timestamp, max } from "@beep/schema/Timestamp"
 *
 * const earlier = Timestamp.make({ epochMillis: EpochMillis.make(1) })
 * const later = Timestamp.make({ epochMillis: EpochMillis.make(2) })
 * console.log(max(earlier, later).epochMillis)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const max: {
  (that: Timestamp): (self: Timestamp) => Timestamp;
  (self: Timestamp, that: Timestamp): Timestamp;
} = dual(2, (self: Timestamp, that: Timestamp): Timestamp => (Order(self, that) >= 0 ? self : that));

/**
 * The Unix epoch timestamp representing `1970-01-01T00:00:00.000Z`.
 *
 * **Example** (Unix epoch ISO string)
 *
 * ```ts
 * import { EPOCH } from "@beep/schema/Timestamp"
 *
 * console.log(EPOCH.toISOStr())
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const EPOCH: Timestamp = Timestamp.make({ epochMillis: EpochMillis.make(0) });
