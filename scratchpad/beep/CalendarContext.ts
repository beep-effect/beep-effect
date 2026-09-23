/**
 * Calendar meeting metadata used while a conversation is processed.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import { Model, optionalText, pg, text, timestamp } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/CalendarContext");

const optionDefault = <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, fallback: () => Sch["Type"]) =>
  S.NullOr(schema).pipe(
    S.optionalKey,
    S.decodeTo(S.Option(schema), {
      decode: SchemaGetter.transformOptional((present) =>
        present.pipe(
          O.match({
            onNone: () => O.some(fallback()),
            onSome: (value) => (value === null ? O.none() : O.some(value)),
          }),
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
    S.withConstructorDefault(Effect.sync(() => O.some(fallback()))),
  );

/**
 * A person listed on a calendar meeting.
 *
 * **Details**
 *
 * Both `name` and `email` can be missing. A participant with neither identity
 * is still a row.
 *
 * **Example** (Decode a nameless participant)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MeetingParticipant } from "@beep/scratchpad/beep/CalendarContext"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MeetingParticipant)({ name: null }))
 * console.log(O.isNone(decoded.name)) // true
 * console.log(O.isNone(decoded.email)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MeetingParticipant extends Model<MeetingParticipant>("MeetingParticipant")(
  {
    name: optionalText("name"),
    email: optionalText("email"),
  },
  $I.annote("MeetingParticipant", {
    description: "Display name and email for one calendar-meeting participant. Either may be unknown.",
  }),
) {}

/**
 * Encoded form of {@link MeetingParticipant}.
 *
 * @see {@link MeetingParticipant} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MeetingParticipant {
  export type Encoded = S.Codec.Encoded<typeof MeetingParticipant>;
}

/**
 * Calendar meeting metadata attached to conversation processing.
 *
 * **Details**
 *
 * `calendarEventId` is the system calendar event id. `title` comes from the
 * calendar. `participants` constructs as an empty list. `platform` is an open
 * string such as Zoom, Teams, or Google Meet. `meetingLink` is the join URL.
 * `startTime` is the meeting start. `durationMinutes` is the length in minutes.
 * `notes` is the calendar description. `calendarSource` examples include
 * `system_calendar`, `google`, and `outlook`. The string stays open.
 *
 * **Gotchas**
 *
 * `calendarSource` admits null. A missing key decodes as `Some("system_calendar")`.
 * A present null stays `None`. Do not treat that default as a closed union.
 *
 * **Example** (Default the calendar source)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { CalendarMeetingContext } from "@beep/scratchpad/beep/CalendarContext"
 *
 * const meeting = CalendarMeetingContext.make({
 *   calendarEventId: "evt-1",
 *   title: "Standup",
 *   startTime: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   durationMinutes: 15,
 * })
 * console.log(O.getOrNull(meeting.calendarSource)) // "system_calendar"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CalendarMeetingContext extends Model<CalendarMeetingContext>("CalendarMeetingContext")(
  {
    calendarEventId: text("calendar_event_id"),
    title: text("title"),
    participants: S.Array(MeetingParticipant).pipe(
      S.withConstructorDefault(Effect.sync(() => [])),
      pg.jsonb(),
      pg.columnName("participants"),
    ),
    platform: optionalText("platform"),
    meetingLink: optionalText("meeting_link"),
    startTime: timestamp("start_time"),
    durationMinutes: S.Int.pipe(pg.integer(), pg.columnName("duration_minutes")),
    notes: optionalText("notes"),
    calendarSource: optionDefault(S.String, () => "system_calendar").pipe(pg.text(), pg.columnName("calendar_source")),
  },
  $I.annote("CalendarMeetingContext", {
    description: "Calendar meeting metadata used as context while a conversation is processed.",
  }),
) {}

/**
 * Encoded form of {@link CalendarMeetingContext}.
 *
 * @see {@link CalendarMeetingContext} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CalendarMeetingContext {
  export type Encoded = S.Codec.Encoded<typeof CalendarMeetingContext>;
}

const decodeCalendarMeetingContext = S.decodeUnknownEffect(CalendarMeetingContext);

/**
 * Builds meeting contexts from stored records, skipping rows that fail.
 *
 * **Details**
 *
 * Python `from_records` validates each dict independently. One malformed
 * meeting must not hide the rest of a user's meetings. `onError`, when
 * supplied, receives the skipped record and a short failure label.
 *
 * **Example** (Skip one bad record)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { calendarMeetingContextsFromRecords } from "@beep/scratchpad/beep/CalendarContext"
 *
 * const records = [{ title: "missing id" }, {
 *   calendarEventId: "evt-1",
 *   title: "Standup",
 *   startTime: "2020-01-02T03:04:05.000Z",
 *   durationMinutes: 15,
 * }]
 * let skipped = 0
 * const parsed = Effect.runSync(
 *   calendarMeetingContextsFromRecords(records, () => {
 *     skipped = skipped + 1
 *   }),
 * )
 * console.log(parsed.length) // 1
 * console.log(skipped) // 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const calendarMeetingContextsFromRecords = Effect.fn("CalendarMeetingContext.fromRecords")(function* (
  records: ReadonlyArray<unknown>,
  onError?: (record: unknown, message: string) => void,
) {
  const parsed: Array<CalendarMeetingContext> = [];
  for (const record of records) {
    const result = yield* Effect.result(decodeCalendarMeetingContext(record));
    if (Result.isFailure(result)) {
      if (onError !== undefined) onError(record, "invalid calendar meeting");
    } else {
      parsed.push(result.success);
    }
  }
  return parsed;
});
