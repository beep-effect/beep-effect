/**
 * DateTime helpers and Effect DateTime re-exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Clock, Context, DateTime, Effect, Layer } from "effect";

/**
 * Constructs a `DateTime.Utc` from any supported `DateTime` input.
 *
 * **Details**
 *
 * This helper normalizes zoned inputs to UTC while preserving the instant.
 *
 * **Example** (Parse ISO string as UTC)
 *
 * ```ts import.meta.vitest name="Parse ISO string as UTC"
 * import { makeUnsafeUtc } from "@beep/utils/DateTime"
 *
 * const value = makeUnsafeUtc("2026-01-01T00:00:00.000Z")
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeUnsafeUtc = <A extends Parameters<typeof DateTime.make>[0]>(input: A): DateTime.Utc =>
  DateTime.makeUnsafe(input).pipe(DateTime.toUtc);

/**
 * Re-export of all helpers from `effect/DateTime`.
 *
 * **Example** (Import DateTime module helpers)
 *
 * ```ts import.meta.vitest name="Import DateTime module helpers"
 * import * as DateTime from "@beep/utils/DateTime"
 *
 * console.log(DateTime)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/DateTime";

/**
 * Time service with live and fixed clock-backed helpers.
 *
 * **Example** (Access Default DateTimes layer)
 *
 * ```ts import.meta.vitest name="Access Default DateTimes layer"
 * import { DateTimes } from "@beep/utils/DateTime"
 *
 * console.log(DateTimes.Default)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export class DateTimes extends Context.Service<DateTimes>()("@beep/utils/DateTime/DateTimes", {
  make: Effect.clockWith((clock) => {
    const now = clock.currentTimeMillis;
    const dateTime = now.pipe(Effect.map(DateTime.makeUnsafe));
    const date = dateTime.pipe(Effect.map(DateTime.toDateUtc));

    return Effect.succeed({ now, date });
  }),
}) {
  static readonly now = Effect.suspend(() => DateTimes.use(({ now }) => now));
  static readonly date = Effect.suspend(() => DateTimes.use(({ date }) => date));

  static readonly Default = Layer.effect(DateTimes, DateTimes.make);

  static readonly Fixed = (baseDate: number | string | Date) =>
    Layer.effect(
      DateTimes,
      Effect.gen(function* () {
        const clock = yield* Clock.Clock;
        const baseN = BigInt(makeUnsafeUtc(baseDate).pipe(DateTime.toEpochMillis));
        const startMillis = yield* clock.currentTimeMillis;
        const now = clock.currentTimeMillis.pipe(
          Effect.map((millis) =>
            // Use BigInt to avoid floating point precision issues which can break deterministic testing
            Number(baseN + BigInt(millis) - BigInt(startMillis))
          )
        );
        const date = now.pipe(Effect.map((millis) => DateTime.makeUnsafe(millis).pipe(DateTime.toDateUtc)));

        return DateTimes.of({ now, date });
      })
    );
}
