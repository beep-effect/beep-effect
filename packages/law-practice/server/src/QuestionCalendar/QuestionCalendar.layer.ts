/**
 * Server adapter of the `QuestionCalendar` port over the `@beep/m365` calendar operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
import { CalendarPrior, QuestionCalendar, QuestionWriteError } from "@beep/law-practice-use-cases/QuestionWrites";
import {
  GraphPathSegment,
  M365,
  M365CreateEventRequest,
  M365DeleteEventRequest,
  M365EventDraft,
  M365EventPatch,
  M365FindEventsByIdempotencyKeyRequest,
  M365GetEventRequest,
  M365IdempotencyKey,
  M365UpdateEventRequest,
  m365AllDayWindow,
} from "@beep/m365";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { OptionWrite } from "@beep/law-practice-domain";
import type { AppliedWrite, QuestionWriteReason } from "@beep/law-practice-use-cases/QuestionWrites";
import type { GraphEvent, M365Error, M365Shape } from "@beep/m365";
import type { LocalDate } from "@beep/schema/LocalDate";

const $I = $LawPracticeServerId.create("QuestionCalendar/QuestionCalendar.layer");

/**
 * Mailbox and time zone of the calendar question writes go to.
 *
 * **Example** (Decode a calendar config)
 *
 * ```ts
 * import { QuestionCalendarConfig } from "@beep/law-practice-server/QuestionCalendar"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownOption(QuestionCalendarConfig)({ mailbox: "mailbox-id", timeZone: "America/Chicago" })
 * console.log(config._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuestionCalendarConfig extends S.Opaque<QuestionCalendarConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    mailbox: S.NonEmptyString.annotateKey({ description: "Mailbox user id or address; never logged." }),
    timeZone: S.TimeZoneNamedFromString.annotateKey({ description: "IANA time zone of the practice; required." }),
  }).pipe(
    $I.annoteSchema("QuestionCalendarConfig", {
      description: "Mailbox and time zone of the calendar question writes go to.",
    })
  )
) {}

// Question writes land as docket-intake's provisional due-date entries.
const WRITE_CATEGORY: DocketCategory = "Docket - unverified";
const NOT_FOUND = 404;

const isDocketCategory = S.is(DocketCategory);
const isProvisionalCategory = S.is(
  DocketCategory.pick(["Docket - unverified", "Docket - needs review", "Docket - reminder", "Docket - digest"])
);

const writeError =
  (otherwise: QuestionWriteReason) =>
  (error: M365Error): QuestionWriteError =>
    QuestionWriteError.make({
      cause: O.some(error),
      reason: O.contains(error.status, NOT_FOUND) ? "event-not-found" : otherwise,
    });

const refused = (reason: QuestionWriteReason, cause: string): QuestionWriteError =>
  QuestionWriteError.make({ cause: O.some(cause), reason });

const categoriesOf = (event: GraphEvent): ReadonlyArray<string> => O.getOrElse(event.categories, A.empty<string>);

// Swap the event's docket category, keeping every category other workstreams own.
const withOnlyDocketCategory = (existing: ReadonlyArray<string>, category: DocketCategory): ReadonlyArray<string> =>
  A.append(
    A.filter(existing, (name) => !isDocketCategory(name)),
    category
  );

// An event the service may change: every docket category it carries is provisional, and it has one.
const isProvisionalEvent = (event: GraphEvent): boolean => {
  const docket = A.filter(categoriesOf(event), isDocketCategory);
  return A.isReadonlyArrayNonEmpty(docket) && A.every(docket, isProvisionalCategory);
};

// The event's date, title and docket category: what an update overwrites and a restore puts back.
const priorOf = (event: GraphEvent): O.Option<CalendarPrior> =>
  O.map(
    O.all({
      date: pipe(
        event.start,
        O.flatMap(({ dateTime }) => dateTime),
        O.flatMap((dateTime) => S.decodeOption(LocalDateFromString)(Str.slice(0, 10)(dateTime)))
      ),
      title: O.filter(event.subject, Str.isNonEmpty),
      category: A.findFirst(categoriesOf(event), isProvisionalCategory),
    }),
    CalendarPrior.make
  );

const eventPatch = (date: LocalDate, title: string, categories: ReadonlyArray<string>, timeZone: string) => {
  const { start, end } = m365AllDayWindow(date, timeZone);
  return M365EventPatch.make({
    categories: O.some(categories),
    end: O.some(end),
    isAllDay: O.some(true),
    start: O.some(start),
    subject: O.some(title),
  });
};

const makeQuestionCalendar = (m365: M365Shape, config: QuestionCalendarConfig) => {
  const userId = O.some(config.mailbox);
  const timeZone = DateTime.zoneToString(config.timeZone);

  const eventSegment = (eventId: string) =>
    S.decodeEffect(GraphPathSegment)(eventId).pipe(
      Effect.mapError(() => refused("event-not-found", "The event id is not a Graph event id."))
    );

  const readEvent = (eventId: string, otherwise: QuestionWriteReason) =>
    Effect.flatMap(eventSegment(eventId), (segment) =>
      m365.getEvent(M365GetEventRequest.make({ eventId: segment, userId })).pipe(Effect.mapError(writeError(otherwise)))
    );

  const patchEvent = (eventId: string, patch: M365EventPatch, otherwise: QuestionWriteReason) =>
    Effect.flatMap(eventSegment(eventId), (segment) =>
      m365
        .updateEvent(M365UpdateEventRequest.make({ eventId: segment, patch, userId }))
        .pipe(Effect.mapError(writeError(otherwise)))
    );

  // Rewrite an event the service may still change, keeping its state before the write for undo.
  // An event the attorney has verified is refused, whichever path found it.
  const rewrite = Effect.fnUntraced(function* (eventId: string, event: GraphEvent, dueOn: LocalDate, title: string) {
    if (!isProvisionalEvent(event)) {
      return yield* refused("event-verified", "The event is no longer a provisional docket entry.");
    }
    const prior = yield* Effect.fromOption(priorOf(event), () =>
      refused("event-not-found", "The event has no date, title or docket category to restore.")
    );
    yield* patchEvent(
      eventId,
      eventPatch(dueOn, title, withOnlyDocketCategory(categoriesOf(event), WRITE_CATEGORY), timeZone),
      "calendar-unavailable"
    );
    return { eventId, prior: O.some(prior) };
  });

  const updateNamed = Effect.fnUntraced(function* (eventId: string, dueOn: LocalDate, title: string) {
    const readEvent1 = yield* readEvent(eventId, "calendar-unavailable");
    return yield* rewrite(eventId, readEvent1, dueOn, title);
  });

  // Create the event under its key, or bring the event an earlier apply created back to the write.
  const createKeyed = Effect.fnUntraced(function* (key: string, dueOn: LocalDate, title: string) {
    const idempotencyKey = yield* S.decodeEffect(M365IdempotencyKey)(key).pipe(
      Effect.mapError(() => refused("calendar-unavailable", "The question write key is not a valid calendar key."))
    );
    const found = yield* m365
      .findEventsByIdempotencyKey(M365FindEventsByIdempotencyKeyRequest.make({ idempotencyKey, userId }))
      .pipe(Effect.mapError(writeError("calendar-unavailable")));
    const existing = O.filter(A.head(found.value), ({ id }) => Str.isNonEmpty(id));
    if (O.isSome(existing)) {
      return yield* rewrite(existing.value.id, existing.value, dueOn, title);
    }
    const created = yield* m365
      .createEvent(
        M365CreateEventRequest.make({
          event: M365EventDraft.make({
            ...m365AllDayWindow(dueOn, timeZone),
            categories: [WRITE_CATEGORY],
            isAllDay: true,
            showAs: O.some("tentative"),
            subject: title,
          }),
          idempotencyKey: O.some(idempotencyKey),
          userId,
        })
      )
      .pipe(Effect.mapError(writeError("calendar-unavailable")));
    const eventId = yield* Effect.fromOption(O.liftPredicate(created.id, Str.isNonEmpty), () =>
      refused("calendar-unavailable", "The calendar created an event without an id.")
    );
    return { eventId, prior: O.none<CalendarPrior>() };
  });

  const upsert = Effect.fn("QuestionCalendar.upsert")((input: { readonly key: string; readonly write: OptionWrite }) =>
    O.match(input.write.eventId, {
      onNone: () => createKeyed(input.key, input.write.dueOn, input.write.title),
      onSome: (eventId) => updateNamed(eventId, input.write.dueOn, input.write.title),
    })
  );

  // Undo never overrides the attorney: an event moved out of the provisional categories is left alone.
  const restore = Effect.fn("QuestionCalendar.restore")(function* (applied: AppliedWrite) {
    const event = yield* readEvent(applied.eventId, "restore-failed");
    if (!isProvisionalEvent(event)) {
      return yield* refused("restore-failed", "The event is no longer a provisional docket entry.");
    }
    if (O.isNone(applied.prior)) {
      const segment = yield* eventSegment(applied.eventId);
      return yield* m365
        .deleteEvent(M365DeleteEventRequest.make({ eventId: segment, userId }))
        .pipe(Effect.mapError(writeError("restore-failed")));
    }
    const prior = applied.prior.value;
    yield* patchEvent(
      applied.eventId,
      eventPatch(prior.date, prior.title, withOnlyDocketCategory(categoriesOf(event), prior.category), timeZone),
      "restore-failed"
    );
  });

  return QuestionCalendar.of({ restore, upsert });
};

/**
 * Build the `QuestionCalendar` port over the `@beep/m365` calendar operations.
 *
 * **Details**
 *
 * Question writes land as docket-intake's provisional due-date entries: an
 * all-day, tentative event in `Docket - unverified`, titled with the write's
 * title.
 *
 * - A write with `eventId` updates that event. It must be a provisional
 *   docket entry; its date, title and docket category are kept as the prior
 *   state, and every non-docket category stays on it.
 * - A write without `eventId` creates an event stored under the write's key.
 *   When an earlier apply already created it, that event is brought back to
 *   the write instead, so applying twice leaves one event. The found event is
 *   held to the same rule as a named one, and its state before the write is
 *   the prior, so undoing the re-apply puts it back rather than deleting it.
 * - A write to an event the attorney has verified, one whose docket category
 *   is no longer provisional, is refused with `event-verified` and changes
 *   nothing.
 * - `restore` deletes a created event, or puts back the prior date, title and
 *   category of an updated one. It refuses with `restore-failed` when the
 *   attorney has since moved the event out of the provisional categories.
 *
 * A missing event fails with `event-not-found`; any other Graph failure fails
 * with `calendar-unavailable` on a write and `restore-failed` on a restore.
 *
 * **Example** (Make the calendar layer)
 *
 * ```ts
 * import { QuestionCalendarConfig, makeQuestionCalendarLayer } from "@beep/law-practice-server/QuestionCalendar"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const layer = O.map(
 *   S.decodeUnknownOption(QuestionCalendarConfig)({ mailbox: "mailbox-id", timeZone: "America/Chicago" }),
 *   makeQuestionCalendarLayer
 * )
 * console.log(O.isSome(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeQuestionCalendarLayer = (config: QuestionCalendarConfig): Layer.Layer<QuestionCalendar, never, M365> =>
  Layer.effect(
    QuestionCalendar,
    Effect.map(M365, (m365) => makeQuestionCalendar(m365, config))
  );
