/**
 * Adapter-facing DateTime helpers for UI date/time pickers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { DateTime } from "effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $SchemaId.create("DateTimeUtcFromValid");

/**
 * Nullable string input accepted by date-picker adapters.
 *
 * **Example** (Decode null date input)
 *
 * ```ts import.meta.vitest name="Decode null date input"
 * import * as S from "effect/Schema"
 * import { DateInputToDateTime } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const decode = S.decodeUnknownSync(DateInputToDateTime)
 * console.log(decode(null))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DateInputToDateTime = S.Union([S.Null, S.Undefined, S.String]).pipe(
  $I.annoteSchema("DateInputToDateTime", {
    description: "Nullable or optional string input accepted by DateTime UI adapters.",
  })
);

/**
 * {@inheritDoc DateInputToDateTime}
 * @category models
 * @since 0.0.0
 */
export type DateInputToDateTime = typeof DateInputToDateTime.Type;

/**
 * Time zone token accepted by UI date/time adapters.
 *
 * **Example** (Assign UTC timezone token)
 *
 * ```ts import.meta.vitest name="Assign UTC timezone token"
 * import type { DateTimeAdapterTimezone } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const timezone: DateTimeAdapterTimezone = "UTC"
 * console.log(timezone)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DateTimeAdapterTimezone = string;

/**
 * Applies an adapter timezone token to a DateTime value.
 *
 * **Example** (Apply UTC to DateTime)
 *
 * ```ts import.meta.vitest name="Apply UTC to DateTime"
 * import * as DateTime from "effect/DateTime"
 * import { applyTimezone } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const utc = applyTimezone(DateTime.makeUnsafe("2024-01-01T00:00:00.000Z"), "UTC")
 * console.log(DateTime.formatIso(utc))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const applyTimezone: {
  (timezone: DateTimeAdapterTimezone): (value: DateTime.DateTime) => DateTime.DateTime;
  (value: DateTime.DateTime, timezone: DateTimeAdapterTimezone): DateTime.DateTime;
} = dual(2, (value: DateTime.DateTime, timezone: DateTimeAdapterTimezone): DateTime.DateTime => {
  if (timezone === "UTC") {
    return DateTime.toUtc(value);
  }

  if (timezone === "default" || timezone === "system") {
    return DateTime.setZone(value, DateTime.zoneMakeLocal());
  }

  return pipe(
    DateTime.zoneFromString(timezone),
    O.map((zone) => DateTime.setZone(value, zone)),
    O.getOrElse(() => value)
  );
});

/**
 * Creates an Effect DateTime for a nullable adapter value and timezone.
 *
 * **Example** (Create DateTime with timezone)
 *
 * ```ts import.meta.vitest name="Create DateTime with timezone"
 * import { createDateTimeWithTimezone } from "@beep/schema/DateTimeUtcFromValid"
 *
 * const value = createDateTimeWithTimezone("2024-01-01T00:00:00.000Z", "UTC")
 * console.log(value?._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const createDateTimeWithTimezone: {
  (timezone: DateTimeAdapterTimezone): (value: DateInputToDateTime) => DateTime.DateTime | null;
  (value: DateInputToDateTime, timezone: DateTimeAdapterTimezone): DateTime.DateTime | null;
} = dual(2, (value: DateInputToDateTime, timezone: DateTimeAdapterTimezone): DateTime.DateTime | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return pipe(
    DateTime.make(value),
    O.map((dateTime) => applyTimezone(dateTime, timezone)),
    O.getOrElse(createInvalidDateTime)
  );
});

/**
 * Creates an invalid DateTime-shaped value for picker validation paths.
 *
 * **Example** (Create invalid DateTime value)
 *
 * ```ts import.meta.vitest name="Create invalid DateTime value"
 * import { createInvalidDateTime } from "@beep/schema/DateTimeUtcFromValid"
 *
 * console.log(Number.isNaN(createInvalidDateTime().epochMilliseconds))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
// makeUnsafe rejects NaN since effect 4.0.0-beta.104; fromEpochSeconds still admits it, and the
// MUI picker adapter contract requires an invalid-date sentinel rather than null.
export const createInvalidDateTime = (): DateTime.DateTime => DateTime.fromEpochSeconds(Number.NaN);
