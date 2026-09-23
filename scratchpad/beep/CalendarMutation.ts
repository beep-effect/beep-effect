/**
 * Results of deleting calendar events, plus the text shown to the user.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Model, pg } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/CalendarMutation");

/**
 * Untyped calendar event bag.
 *
 * **Details**
 *
 * Python stores the provider event as `dict[str, object]`. The deletion text
 * reads `summary` and `start.dateTime` only.
 *
 * @see {@link eventTitle} for the summary fallback.
 * @category type-level
 * @since 0.0.0
 */
export type CalendarEvent = S.JsonObject;

const CalendarEventSchema = S.JsonObject.pipe(
  $I.annoteSchema("CalendarEvent", {
    description: "Provider calendar event object. Deletion text reads summary and start.dateTime.",
  }),
);

/**
 * JSON object accepted as a calendar event.
 *
 * **Example** (Decode an event summary)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CalendarEventJson } from "@beep/scratchpad/beep/CalendarMutation"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(CalendarEventJson)({ summary: "Standup" }))
 * console.log(decoded.summary) // "Standup"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CalendarEventJson = CalendarEventSchema;

const Failure = S.Tuple([S.String, S.String]);

/**
 * Events that were deleted and events that failed, as title and error pairs.
 *
 * **Details**
 *
 * Both lists construct empty. The failure pair is `(title, error)`. Python's
 * `list[tuple[str, str]]()` default is an empty list, not a callable generic.
 *
 * **Example** (Construct an empty result)
 *
 * ```ts
 * import { CalendarMutationResult } from "@beep/scratchpad/beep/CalendarMutation"
 *
 * const result = CalendarMutationResult.make({})
 * console.log(result.succeeded.length) // 0
 * console.log(result.failed.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CalendarMutationResult extends Model<CalendarMutationResult>("CalendarMutationResult")(
  {
    succeeded: S.Array(CalendarEventJson).pipe(
      S.withConstructorDefault(Effect.sync(() => [])),
      pg.jsonb(),
      pg.columnName("succeeded"),
    ),
    failed: S.Array(Failure).pipe(
      S.withConstructorDefault(Effect.sync(() => [])),
      pg.jsonb(),
      pg.columnName("failed"),
    ),
  },
  $I.annote("CalendarMutationResult", {
    description: "Succeeded calendar deletions and the title/error pairs that failed.",
  }),
) {}

/**
 * Encoded form of {@link CalendarMutationResult}.
 *
 * @see {@link CalendarMutationResult} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CalendarMutationResult {
  export type Encoded = S.Codec.Encoded<typeof CalendarMutationResult>;
}

const primitiveText = (value: S.Json): string => {
  if (P.isString(value)) return value;
  if (value === null) return "None";
  if (P.isNumber(value)) return globalThis.String(value);
  if (value === true) return "True";
  if (value === false) return "False";
  return "Untitled";
};

/**
 * Title used when listing a deleted event.
 *
 * **Details**
 *
 * A missing `summary` is `Untitled`. A string summary is kept. Null becomes
 * Python's `None`. Numbers and booleans use their Python `str` spellings.
 *
 * **Example** (Fall back when summary is missing)
 *
 * ```ts
 * import { eventTitle } from "@beep/scratchpad/beep/CalendarMutation"
 *
 * console.log(eventTitle({})) // "Untitled"
 * console.log(eventTitle({ summary: "Standup" })) // "Standup"
 * console.log(eventTitle({ summary: null })) // "None"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
const SummaryField = S.Struct({ summary: S.Json });

const isSummaryField = S.is(SummaryField);

export const eventTitle = (event: CalendarEvent): string =>
  isSummaryField(event) ? primitiveText(event.summary) : "Untitled";

/**
 * User-facing text for a calendar deletion batch.
 *
 * **Details**
 *
 * A non-empty success list names each event. When `start.dateTime` is a string
 * that parses, the wall-clock `YYYY-MM-DD HH:MM` from that string is appended.
 * An offset is not converted before formatting, matching Python `strftime` on
 * the original datetime fields. Failures are appended after the successes.
 * Failures alone become one error sentence. An empty result says that nothing
 * was deleted.
 *
 * **Example** (Format one timed deletion)
 *
 * ```ts
 * import { CalendarMutationResult, formatDeletedCalendarEvents } from "@beep/scratchpad/beep/CalendarMutation"
 *
 * const text = formatDeletedCalendarEvents(
 *   CalendarMutationResult.make({
 *     succeeded: [{ summary: "Standup", start: { dateTime: "2020-01-02T03:04:05Z" } }],
 *   }),
 * )
 * console.log(text.includes("Standup (2020-01-02 03:04)")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatDeletedCalendarEvents = (result: CalendarMutationResult): string => {
  if (result.succeeded.length > 0) {
    const lines = A.map(result.succeeded, (event) => {
      const summary = eventTitle(event);
      const stamp = wallClock(event);
      return stamp === undefined ? `   - ${summary}` : `   - ${summary} (${stamp})`;
    });
    const deleted = `✅ Successfully deleted ${result.succeeded.length} calendar event(s):\n${A.join(lines, "\n")}`;
    if (result.failed.length === 0) return deleted;
    const failures = A.map(result.failed, ([title, error]) => `   - ${title}: ${error}`);
    return `${deleted}\n\n⚠️ Failed to delete ${result.failed.length} event(s):\n${A.join(failures, "\n")}`;
  }
  if (result.failed.length > 0) {
    const errors = A.join(
      A.map(result.failed, ([title, error]) => `${title}: ${error}`),
      "; ",
    );
    return `Error: Failed to delete events: ${errors}`;
  }
  return "No events were deleted.";
};

const StartStamp = S.Struct({ dateTime: S.String });

const isStartStamp = S.is(StartStamp);

const wallClock = (event: CalendarEvent): string | undefined => {
  const start = event.start;
  if (!isStartStamp(start)) return undefined;
  const parsed = DateTime.make(start.dateTime);
  if (O.isNone(parsed)) return undefined;
  const matched = /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[T ]([0-9]{2}):([0-9]{2}))?/.exec(start.dateTime);
  if (matched === null) return undefined;
  const hour = matched[4] ?? "00";
  const minute = matched[5] ?? "00";
  return `${matched[1]}-${matched[2]}-${matched[3]} ${hour}:${minute}`;
};
