/**
 * Strict source timestamps shared by transcript bounds and OTLP serialization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as Ordering from "effect/Ordering";

const $I = $RepoAiMetricsId.create("internal/source-event-time");
const SourceTimestampText = S.String.check(
  S.isPattern(
    /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u
  )
).pipe(
  $I.annoteSchema("SourceTimestampText", {
    description: "Explicitly zoned ISO event timestamp with bounded clock components and nanosecond precision.",
  })
);

/**
 * Validated event time represented without floating point nanosecond loss.
 *
 * **Example**
 * ```ts
 * import { parseSourceEventTime } from "@beep/repo-ai-metrics/internal/source-event-time"
 * console.log(parseSourceEventTime("2026-10-27T00:00:00.000000001Z"))
 * ```
 * **Details** Seconds and fractional nanoseconds remain separate until OTLP encoding.
 * @category models
 * @since 0.0.0
 */
export class SourceEventTime extends S.Opaque<SourceEventTime, { readonly brand: unique symbol }>()(
  S.Struct({
    text: SourceTimestampText,
    seconds: S.Natural,
    nanoseconds: S.Natural.check(S.isLessThan(1_000_000_000)),
  }).pipe(
    $I.annoteSchema("SourceEventTime", { description: "Validated source timestamp and exact OTLP time components." })
  )
) {}

/**
 * Parse a real calendar timestamp that fits OTLP's unsigned nanosecond range.
 *
 * **Example**
 * ```ts
 * import { parseSourceEventTime } from "@beep/repo-ai-metrics/internal/source-event-time"
 * console.log(parseSourceEventTime("2026-02-30T00:00:00Z")) // None
 * ```
 * **Details** Rejects rollover dates, timezone-free values, leap seconds and unsigned overflow. Invalid input is never returned as an error payload.
 * @category utilities
 * @since 0.0.0
 */
export const parseSourceEventTime = (input: string): O.Option<SourceEventTime> =>
  O.gen(function* () {
    const text = yield* S.decodeOption(SourceTimestampText)(input);
    const dateText = Str.slice(0, 10)(text);
    const calendarDate = yield* DateTime.make(`${dateText}T00:00:00Z`);
    if (pipe(calendarDate, DateTime.formatIso, Str.slice(0, 10)) !== dateText) return yield* O.none();
    const instant = yield* DateTime.make(text);
    const millis = DateTime.toEpochMillis(instant);
    if (millis < 0) return yield* O.none();
    const seconds = Math.floor(millis / 1000);
    const nanoseconds = pipe(
      text,
      Str.match(/\.(\d{1,9})/u),
      O.flatMap(A.get(1)),
      O.map(Str.padEnd(9, "0")),
      O.flatMap(S.decodeUnknownOption(S.FiniteFromString)),
      O.getOrElse(() => 0)
    );
    // OTLP uses an unsigned 64-bit nanosecond count, not the full JavaScript Date range.
    if (seconds > 18_446_744_073 || (seconds === 18_446_744_073 && nanoseconds > 709_551_615)) return yield* O.none();
    return SourceEventTime.make({ text, seconds, nanoseconds });
  });

/**
 * Order exact instants regardless of the source timezone or fractional formatting.
 *
 * **Example**
 * ```ts
 * import { SourceEventTimeOrder } from "@beep/repo-ai-metrics/internal/source-event-time"
 * console.log(typeof SourceEventTimeOrder)
 * ```
 * **Details** Nanoseconds break ties between events in the same second.
 * @category utilities
 * @since 0.0.0
 */
export const SourceEventTimeOrder: {
  (self: SourceEventTime, that: SourceEventTime): Ordering.Ordering;
  (that: SourceEventTime): (self: SourceEventTime) => Ordering.Ordering;
} = dual(
  2,
  Order.combine(
    Order.mapInput(Order.Number, (value: SourceEventTime) => value.seconds),
    Order.mapInput(Order.Number, (value: SourceEventTime) => value.nanoseconds)
  )
);
