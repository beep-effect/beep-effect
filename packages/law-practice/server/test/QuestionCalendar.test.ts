/**
 * The question-write calendar adapter over a fake `M365` calendar: an
 * in-memory map of Graph events. No request leaves the process; every
 * mailbox, event and date here is synthetic.
 */

import { OptionWrite } from "@beep/law-practice-domain";
import { makeQuestionCalendarLayer, QuestionCalendarConfig } from "@beep/law-practice-server/QuestionCalendar";
import {
  AppliedWrite,
  CalendarPrior,
  ProposedWrite,
  QuestionCalendar,
  questionWriteKey,
} from "@beep/law-practice-use-cases/QuestionWrites";
import { GraphDateTimeTimeZone, GraphEvent, M365Error, M365EventCollection } from "@beep/m365";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import { makeM365Stub } from "./MailTagging.adapters.fixture.ts";

type StoredEvent = { readonly event: GraphEvent; readonly key: O.Option<string> };

const config = QuestionCalendarConfig.make({
  mailbox: "attorney@example.test",
  timeZone: DateTime.zoneMakeNamedUnsafe("UTC"),
});
const notFound = () => Effect.fail(M365Error.fromReason("response status", { status: 404, resource: "events" }));

const graphEvent = (id: string, date: string, subject: string, categories: ReadonlyArray<string>) =>
  GraphEvent.make({
    id,
    subject: O.some(subject),
    start: O.some(
      GraphDateTimeTimeZone.make({ dateTime: O.some(`${date}T00:00:00.0000000`), timeZone: O.some("UTC") })
    ),
    categories: O.some(categories),
  });

// A Graph calendar over a map of events: creates keyed events, applies patches, deletes.
const fakeM365 = (store: Ref.Ref<HashMap.HashMap<string, StoredEvent>>) =>
  makeM365Stub({
    createEvent: (request) =>
      Ref.modify(store, (events) => {
        const id = `evt-created-${HashMap.size(events) + 1}`;
        const event = graphEvent(
          id,
          Str.slice(0, 10)(request.event.start.dateTime),
          request.event.subject,
          request.event.categories
        );
        const next: readonly [GraphEvent, HashMap.HashMap<string, StoredEvent>] = [
          event,
          HashMap.set(events, id, { event, key: request.idempotencyKey }),
        ];
        return next;
      }),
    deleteEvent: (request) =>
      Effect.flatMap(Ref.get(store), (events) =>
        HashMap.has(events, request.eventId) ? Ref.set(store, HashMap.remove(events, request.eventId)) : notFound()
      ),
    findEventsByIdempotencyKey: (request) =>
      Effect.map(Ref.get(store), (events) =>
        M365EventCollection.make({
          value: pipe(
            HashMap.toValues(events),
            A.filter(({ key }) => O.contains(key, request.idempotencyKey)),
            A.map(({ event }) => event)
          ),
        })
      ),
    getEvent: (request) =>
      Effect.flatMap(Ref.get(store), (events) =>
        O.match(HashMap.get(events, request.eventId), {
          onNone: notFound,
          onSome: ({ event }) => Effect.succeed(event),
        })
      ),
    updateEvent: (request) =>
      Effect.flatMap(Ref.get(store), (events) =>
        O.match(HashMap.get(events, request.eventId), {
          onNone: notFound,
          onSome: (stored) => {
            const { patch } = request;
            const event = GraphEvent.make({
              ...stored.event,
              subject: O.orElse(patch.subject, () => stored.event.subject),
              start: O.orElse(
                O.map(patch.start, ({ dateTime, timeZone }) =>
                  GraphDateTimeTimeZone.make({ dateTime: O.some(dateTime), timeZone: O.some(timeZone) })
                ),
                () => stored.event.start
              ),
              categories: O.orElse(patch.categories, () => stored.event.categories),
            });
            return Effect.as(Ref.set(store, HashMap.set(events, request.eventId, { ...stored, event })), event);
          },
        })
      ),
  });

/** The fake calendar's events, so a test can read what the adapter did. */
class FakeEvents extends Context.Service<FakeEvents, Ref.Ref<HashMap.HashMap<string, StoredEvent>>>()(
  "@beep/law-practice-server/test/QuestionCalendar.test/FakeEvents"
) {}

const calendarWith = (seed: ReadonlyArray<readonly [string, StoredEvent]>) =>
  makeQuestionCalendarLayer(config).pipe(
    Layer.provide(Layer.unwrap(Effect.map(FakeEvents, fakeM365))),
    Layer.provideMerge(Layer.effect(FakeEvents, Ref.make(HashMap.fromIterable(seed))))
  );

const write = (dueOn: LocalDate, title: string, eventId: O.Option<string> = O.none()) =>
  ProposedWrite.make({
    itemId: "question:calendar:1",
    optionId: "move-date",
    write: OptionWrite.cases["calendar-date"].make({ title, dueOn, eventId }),
    answeredAt: DateTime.makeUnsafe(0),
  });

const day = (month: number, dayOfMonth: number) => LocalDate.make({ year: 2026, month, day: dayOfMonth });

const stored = (store: Ref.Ref<HashMap.HashMap<string, StoredEvent>>, eventId: string) =>
  Effect.map(Ref.get(store), (events) =>
    O.map(HashMap.get(events, eventId), ({ event }) => ({
      date: O.map(
        O.flatMap(event.start, ({ dateTime }) => dateTime),
        Str.slice(0, 10)
      ),
      subject: event.subject,
      categories: event.categories,
    }))
  );

const provisionalEvent = (categories: ReadonlyArray<string>): readonly [string, StoredEvent] => [
  "evt-docket-1",
  { event: graphEvent("evt-docket-1", "2026-10-02", "Response due", categories), key: O.none() },
];

// An event an earlier apply created under the write's key, as the calendar now holds it.
const KEYED_EVENT = "evt-keyed-1";
const keyedWrite = write(day(11, 2), "Response due (moved)");
const keyedEvent = (categories: ReadonlyArray<string>): readonly [string, StoredEvent] => [
  KEYED_EVENT,
  {
    event: graphEvent(KEYED_EVENT, "2026-10-02", "Response due", categories),
    key: O.some(questionWriteKey(keyedWrite)),
  },
];

describe("@beep/law-practice-server QuestionCalendar", () => {
  it.layer(
    calendarWith([
      [
        "incomplete",
        {
          event: graphEvent("incomplete", "2026-10-02", "", ["Docket - unverified"]),
          key: O.none(),
        },
      ],
    ]),
    { timeout: "10 seconds" }
  )("malformed calendar boundaries", (it) => {
    it.effect("rejects invalid identifiers and unrestorable prior state without writes", () =>
      Effect.gen(function* () {
        const calendar = yield* QuestionCalendar;
        const store = yield* FakeEvents;
        const before = yield* Ref.get(store);
        const proposal = write(day(11, 2), "Response due");
        const badKey = yield* calendar.upsert({ key: "", write: proposal.write }).pipe(Effect.flip);
        expect(badKey.reason).toBe("calendar-unavailable");
        const badId = write(day(11, 2), "Response due", O.some("/invalid/event"));
        const invalid = yield* calendar.upsert({ key: questionWriteKey(badId), write: badId.write }).pipe(Effect.flip);
        expect(invalid.reason).toBe("event-not-found");
        const incomplete = write(day(11, 2), "Response due", O.some("incomplete"));
        const prior = yield* calendar
          .upsert({ key: questionWriteKey(incomplete), write: incomplete.write })
          .pipe(Effect.flip);
        expect(prior.reason).toBe("event-not-found");
        const after = yield* Ref.get(store);
        expect(after).toEqual(before);
      })
    );
  });
  it.layer(
    makeQuestionCalendarLayer(config).pipe(
      Layer.provide(
        makeM365Stub({
          findEventsByIdempotencyKey: () => Effect.succeed(M365EventCollection.make({ value: [] })),
          createEvent: () => Effect.succeed(GraphEvent.make({ id: "" })),
        })
      )
    )
  )("incomplete Graph create response", (it) => {
    it.effect("refuses a created event with no identifier", () =>
      Effect.gen(function* () {
        const calendar = yield* QuestionCalendar;
        const proposal = write(day(11, 2), "Response due");
        const error = yield* calendar
          .upsert({ key: questionWriteKey(proposal), write: proposal.write })
          .pipe(Effect.flip);
        expect(error.reason).toBe("calendar-unavailable");
      })
    );
  });

  it.layer(calendarWith([provisionalEvent(["M: 90001", "Docket - unverified"])]), { timeout: "10 seconds" })(
    "a named provisional event",
    (it) => {
      it.effect("updates a named provisional event, keeps other categories, and restores it", () =>
        Effect.gen(function* () {
          const store = yield* FakeEvents;
          const calendar = yield* QuestionCalendar;
          const proposal = write(day(11, 2), "Response due (moved)", O.some("evt-docket-1"));
          const result = yield* calendar.upsert({ key: questionWriteKey(proposal), write: proposal.write });

          expect(result.eventId).toBe("evt-docket-1");
          assertSome(
            result.prior,
            CalendarPrior.make({
              date: day(10, 2),
              title: "Response due",
              category: "Docket - unverified",
            })
          );
          const stored1 = yield* stored(store, "evt-docket-1");
          assertSome(stored1, {
            date: O.some("2026-11-02"),
            subject: O.some("Response due (moved)"),
            categories: O.some(["M: 90001", "Docket - unverified"]),
          });

          yield* calendar.restore(AppliedWrite.make({ proposal, eventId: result.eventId, prior: result.prior }));
          const stored2 = yield* stored(store, "evt-docket-1");
          assertSome(stored2, {
            date: O.some("2026-10-02"),
            subject: O.some("Response due"),
            categories: O.some(["M: 90001", "Docket - unverified"]),
          });
        })
      );
    }
  );

  it.layer(calendarWith([]), { timeout: "10 seconds" })("a keyed event", (it) => {
    it.effect("creates a keyed event once, however often it is applied, and deletes it on restore", () =>
      Effect.gen(function* () {
        const store = yield* FakeEvents;
        const calendar = yield* QuestionCalendar;
        const proposal = write(day(10, 20), "Check with the client");
        const key = questionWriteKey(proposal);
        const first = yield* calendar.upsert({ key, write: proposal.write });
        const second = yield* calendar.upsert({ key, write: proposal.write });

        expect(second.eventId).toBe(first.eventId);
        assertNone(first.prior);
        assertSome(
          second.prior,
          CalendarPrior.make({ date: day(10, 20), title: "Check with the client", category: "Docket - unverified" })
        );
        const got = yield* Ref.get(store);
        expect(HashMap.size(got)).toBe(1);
        const stored3 = yield* stored(store, first.eventId);
        assertSome(
          O.flatMap(stored3, ({ categories }) => categories),
          ["Docket - unverified"]
        );

        yield* calendar.restore(AppliedWrite.make({ proposal, eventId: first.eventId }));
        const got4 = yield* Ref.get(store);
        expect(HashMap.size(got4)).toBe(0);
      })
    );
  });

  it.layer(calendarWith([keyedEvent(["Docket - verified"])]), { timeout: "10 seconds" })(
    "a keyed event the attorney verified",
    (it) => {
      it.effect("refuses to re-apply the write and changes nothing", () =>
        Effect.gen(function* () {
          const store = yield* FakeEvents;
          const before = yield* Ref.get(store);

          const error = yield* Effect.flip(
            (yield* QuestionCalendar).upsert({ key: questionWriteKey(keyedWrite), write: keyedWrite.write })
          );

          expect(error.reason).toBe("event-verified");
          const got5 = yield* Ref.get(store);
          expect(got5).toStrictEqual(before);
        })
      );
    }
  );

  it.layer(calendarWith([keyedEvent(["M: 90001", "Docket - needs review"])]), { timeout: "10 seconds" })(
    "a provisional keyed event",
    (it) => {
      it.effect("re-applies the write, records the event's prior state, and undo restores it", () =>
        Effect.gen(function* () {
          const store = yield* FakeEvents;
          const calendar = yield* QuestionCalendar;

          const result = yield* calendar.upsert({ key: questionWriteKey(keyedWrite), write: keyedWrite.write });
          const written = yield* stored(store, KEYED_EVENT);
          yield* calendar.restore(
            AppliedWrite.make({ proposal: keyedWrite, eventId: result.eventId, prior: result.prior })
          );

          expect(result.eventId).toBe(KEYED_EVENT);
          assertSome(
            result.prior,
            CalendarPrior.make({ date: day(10, 2), title: "Response due", category: "Docket - needs review" })
          );
          assertSome(written, {
            date: O.some("2026-11-02"),
            subject: O.some("Response due (moved)"),
            categories: O.some(["M: 90001", "Docket - unverified"]),
          });
          const stored6 = yield* stored(store, KEYED_EVENT);
          assertSome(stored6, {
            date: O.some("2026-10-02"),
            subject: O.some("Response due"),
            categories: O.some(["M: 90001", "Docket - needs review"]),
          });
        })
      );
    }
  );

  it.layer(calendarWith([provisionalEvent(["Docket - verified"])]), { timeout: "10 seconds" })(
    "a verified event",
    (it) => {
      it.effect("refuses events that are missing or no longer provisional", () =>
        Effect.gen(function* () {
          const calendar = yield* QuestionCalendar;
          const verified = write(day(11, 2), "Response due", O.some("evt-docket-1"));
          const missing = write(day(11, 2), "Response due", O.some("evt-missing"));
          const reasons = yield* Effect.all([
            Effect.flip(calendar.upsert({ key: questionWriteKey(verified), write: verified.write })),
            Effect.flip(calendar.upsert({ key: questionWriteKey(missing), write: missing.write })),
            Effect.flip(calendar.restore(AppliedWrite.make({ proposal: verified, eventId: "evt-docket-1" }))),
            Effect.flip(calendar.restore(AppliedWrite.make({ proposal: missing, eventId: "evt-missing" }))),
          ]);

          expect(A.map(reasons, ({ reason }) => reason)).toStrictEqual([
            "event-verified",
            "event-not-found",
            "restore-failed",
            "event-not-found",
          ]);
        })
      );
    }
  );
});
