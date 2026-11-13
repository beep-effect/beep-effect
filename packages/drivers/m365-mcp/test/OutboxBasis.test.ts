import { GraphDateTimeTimeZone, GraphEmailAddress, GraphEvent, GraphMessage, GraphRecipient } from "@beep/m365";
import {
  basisVerdict,
  compareBasisPin,
  eventViewOf,
  makeBasisReport,
  messageViewOf,
  OutboxBasisObservation,
  OutboxBasisPin,
  OutboxBasisStatus,
  OutboxEventInstant,
  OutboxEventView,
  OutboxMessageView,
} from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { OutboxBasisChangedField } from "@beep/m365-mcp";

const MAILBOX = "mailbox@example.test";
const OBSERVED_AT = DateTime.makeUnsafe("2030-01-10T12:00:00Z");

const graphInstant = (instant: { readonly dateTime: string; readonly timeZone: string }) =>
  O.some(GraphDateTimeTimeZone.make({ dateTime: O.some(instant.dateTime), timeZone: O.some(instant.timeZone) }));

// What Graph stores beside the view: none of it may change the comparison.
const Outside = S.Struct({
  categories: S.Array(S.Literals(["Docket", "Client", "Billing"])).check(S.isMaxLength(3)),
  changeKey: S.NonEmptyString,
  isReminderOn: S.Boolean,
  reminderMinutesBeforeStart: S.Int.check(S.isBetween({ minimum: 0, maximum: 10080 })),
});
type Outside = typeof Outside.Type;

const graphEventOf = (view: OutboxEventView, outside: Outside): GraphEvent =>
  GraphEvent.make({
    categories: O.some(outside.categories),
    changeKey: O.some(outside.changeKey),
    end: graphInstant(view.end),
    id: "event-1",
    isAllDay: O.some(view.isAllDay),
    isCancelled: O.some(view.isCancelled),
    isReminderOn: O.some(outside.isReminderOn),
    reminderMinutesBeforeStart: O.some(outside.reminderMinutesBeforeStart),
    start: graphInstant(view.start),
    subject: O.some(view.subject),
    type: O.some("singleInstance"),
  });

const viewOf = (event: GraphEvent): OutboxEventView =>
  O.getOrThrowWith(eventViewOf(event), () => new Error("the event has no start or end"));

const eventPin = (view: OutboxEventView) =>
  OutboxBasisPin.cases.event.make({ changeKey: O.none(), id: "event-1", observedAt: OBSERVED_AT, view });

const messagePin = (view: OutboxMessageView) =>
  OutboxBasisPin.cases.message.make({
    changeKey: O.none(),
    conversationId: "conversation-1",
    id: "message-1",
    observedAt: OBSERVED_AT,
    view,
  });

const eventNow = (view: OutboxEventView) => OutboxBasisObservation.cases.event.make({ view });
const messageNow = (view: OutboxMessageView) => OutboxBasisObservation.cases.message.make({ view });

const changedFields = (status: OutboxBasisStatus): ReadonlyArray<OutboxBasisChangedField> =>
  OutboxBasisStatus.guards.Changed(status) ? status.fields : [];

const later = (instant: { readonly dateTime: string; readonly timeZone: string }) =>
  OutboxEventInstant.make({ ...instant, dateTime: `${instant.dateTime}1` });

const EventField = S.Literals(["subject", "start", "end", "isAllDay", "isCancelled"]);

const editEvent = (view: OutboxEventView, field: typeof EventField.Type): OutboxEventView =>
  OutboxEventView.make({
    ...view,
    ...{
      end: { end: later(view.end) },
      isAllDay: { isAllDay: !view.isAllDay },
      isCancelled: { isCancelled: !view.isCancelled },
      start: { start: later(view.start) },
      subject: { subject: `${view.subject} (moved)` },
    }[field],
  });

const from = (address: string) =>
  O.some(GraphRecipient.make({ emailAddress: O.some(GraphEmailAddress.make({ address: O.some(address) })) }));

const message = (fields: {
  readonly from?: string;
  readonly id: string;
  readonly isDraft?: boolean;
  readonly received?: string;
}): GraphMessage =>
  GraphMessage.make({
    from: pipe(O.fromUndefinedOr(fields.from), O.flatMap(from)),
    id: fields.id,
    internetMessageId: O.some(`<${fields.id}@example.test>`),
    isDraft: O.some(fields.isDraft ?? false),
    receivedDateTime: O.fromUndefinedOr(fields.received),
  });

const PINNED = message({ from: "counsel@example.test", id: "request", received: "2030-01-10T09:00:00Z" });
const pinnedTarget = { internetMessageId: "<request@example.test>", mailbox: MAILBOX };

const replyIn = (page: ReadonlyArray<GraphMessage>) =>
  pipe(
    messageViewOf(page, pinnedTarget),
    O.flatMap((view) => view.newestOtherReply)
  );

// Messages that arrive after the pinned one and are not replies: drafts, and mail the mailbox sent.
const Noise = S.Array(
  S.Struct({
    draft: S.Boolean,
    minutesLater: S.Int.check(S.isBetween({ minimum: 1, maximum: 100000 })),
    shouting: S.Boolean,
  })
).check(S.isMaxLength(6));

const noiseOf = (noise: typeof Noise.Type): ReadonlyArray<GraphMessage> =>
  A.map(noise, (entry, index) =>
    message({
      from: entry.draft ? "counsel@example.test" : entry.shouting ? Str.toUpperCase(MAILBOX) : MAILBOX,
      id: `noise-${index}`,
      isDraft: entry.draft,
      received: DateTime.formatIso(
        DateTime.add(DateTime.makeUnsafe("2030-01-10T09:00:00Z"), { minutes: entry.minutesLater })
      ),
    })
  );

describe("@beep/m365-mcp outbox basis", () => {
  it.prop(
    "an event edit outside the named view (categories, reminder, change key) is Current",
    [Arbitrary.schema(OutboxEventView), Arbitrary.schema(Outside), Arbitrary.schema(Outside)],
    ([view, before, after]) => {
      const pinned = viewOf(graphEventOf(view, before));
      const status = compareBasisPin(eventPin(pinned), eventNow(viewOf(graphEventOf(view, after))));

      assert.isTrue(OutboxBasisStatus.guards.Current(status));
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "an edit to any named event field is Changed naming exactly that field",
    [Arbitrary.schema(OutboxEventView), Arbitrary.schema(Outside), Arbitrary.schema(EventField)],
    ([view, outside, field]) => {
      const now = viewOf(graphEventOf(editEvent(view, field), outside));
      const status = compareBasisPin(eventPin(viewOf(graphEventOf(view, outside))), eventNow(now));

      assert.deepStrictEqual(changedFields(status), [field]);
      if (OutboxBasisStatus.guards.Changed(status)) {
        assert.isTrue(S.toEquivalence(OutboxBasisObservation)(status.now, eventNow(now)));
      }
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "a later draft or a later message from the mailbox leaves a message pin Current",
    [Arbitrary.schema(Noise)],
    ([noise]) => {
      const pinned = O.getOrThrow(messageViewOf([PINNED], pinnedTarget));
      const now = O.getOrThrow(messageViewOf(A.appendAll([PINNED], noiseOf(noise)), pinnedTarget));

      assert.isTrue(OutboxBasisStatus.guards.Current(compareBasisPin(messagePin(pinned), messageNow(now))));
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "an edit to any named message field is Changed naming exactly that field",
    [Arbitrary.schema(OutboxMessageView), Arbitrary.schema(S.Literals(["internetMessageId", "newestOtherReply"]))],
    ([view, field]) => {
      const now = OutboxMessageView.make({
        ...view,
        ...{
          internetMessageId: { internetMessageId: `${view.internetMessageId}1` },
          newestOtherReply: {
            newestOtherReply: O.match(view.newestOtherReply, {
              onNone: () => O.some("<reply@example.test>"),
              onSome: () => O.none(),
            }),
          },
        }[field],
      });

      assert.deepStrictEqual(changedFields(compareBasisPin(messagePin(view), messageNow(now))), [field]);
    },
    { arbitrary: fcRuns(50) }
  );

  it("keeps start and end exactly as Graph returned them, all-day events included", () => {
    const allDay = GraphEvent.make({
      end: O.some(
        GraphDateTimeTimeZone.make({ dateTime: O.some("2030-01-16T00:00:00.0000000"), timeZone: O.some("UTC") })
      ),
      id: "event-1",
      isAllDay: O.some(true),
      start: O.some(
        GraphDateTimeTimeZone.make({ dateTime: O.some("2030-01-15T00:00:00.0000000"), timeZone: O.some("UTC") })
      ),
    });
    const view = viewOf(allDay);

    assert.deepStrictEqual(
      [view.start.dateTime, view.start.timeZone, view.end.dateTime, view.end.timeZone, view.isAllDay],
      ["2030-01-15T00:00:00.0000000", "UTC", "2030-01-16T00:00:00.0000000", "UTC", true]
    );
    assert.isTrue(OutboxBasisStatus.guards.Current(compareBasisPin(eventPin(view), eventNow(viewOf(allDay)))));

    // The same wall-clock time in another zone is another instant: no conversion makes them equal.
    const otherZone = OutboxEventView.make({
      ...view,
      start: OutboxEventInstant.make({ dateTime: view.start.dateTime, timeZone: "Pacific Standard Time" }),
    });
    assert.deepStrictEqual(changedFields(compareBasisPin(eventPin(view), eventNow(otherZone))), ["start"]);
  });

  it("reads an event without a start or end as no view, and defaults the missing fields", () => {
    const start = O.some(
      GraphDateTimeTimeZone.make({ dateTime: O.some("2030-01-15T09:00:00"), timeZone: O.some("UTC") })
    );

    assertNone(eventViewOf(GraphEvent.make({ id: "event-1", start })));
    assertNone(
      eventViewOf(
        GraphEvent.make({
          end: O.some(GraphDateTimeTimeZone.make({ dateTime: O.some("2030-01-15T10:00:00") })),
          id: "e",
          start,
        })
      )
    );
    assertSome(
      O.map(eventViewOf(GraphEvent.make({ end: start, id: "event-1", start })), (view) => [
        view.subject,
        view.isAllDay,
        view.isCancelled,
      ]),
      ["", false, false]
    );
  });

  it("finds the newest later reply from another sender in a conversation page", () => {
    const counsel = (id: string, received: string) => message({ from: "counsel@example.test", id, received });

    assertNone(messageViewOf([counsel("other", "2030-01-11T09:00:00Z")], pinnedTarget));
    assertNone(messageViewOf([PINNED], { internetMessageId: "", mailbox: MAILBOX }));
    assertNone(replyIn([PINNED, counsel("earlier", "2030-01-09T09:00:00Z")]));
    assertSome(
      replyIn([PINNED, counsel("first", "2030-01-11T09:00:00Z"), counsel("newest", "2030-01-12T09:00:00Z")]),
      "<newest@example.test>"
    );
    // Instants, not strings: an offset that sorts lower as text is the later message.
    assertSome(
      replyIn([PINNED, counsel("utc", "2030-01-11T09:00:00Z"), counsel("offset", "2030-01-11T05:30:00-05:00")]),
      "<offset@example.test>"
    );
    // A message without a sender is another sender; one without a readable receipt time is no reply.
    assertSome(
      replyIn([PINNED, message({ id: "anonymous", received: "2030-01-11T09:00:00Z" })]),
      "<anonymous@example.test>"
    );
    assertNone(replyIn([PINNED, counsel("undated", "not a date"), message({ from: "x@example.test", id: "none" })]));
    // A pinned message without a receipt time sorts before every reply.
    assertSome(
      pipe(
        messageViewOf(
          [message({ from: "counsel@example.test", id: "request" }), counsel("any", "2020-01-01T00:00:00Z")],
          pinnedTarget
        ),
        O.flatMap((view) => view.newestOtherReply)
      ),
      "<any@example.test>"
    );
  });

  it("names every field of the pinned kind when the observation is of the other kind", () => {
    const event = OutboxEventView.make({
      end: OutboxEventInstant.make({ dateTime: "2030-01-15T10:00:00", timeZone: "UTC" }),
      isAllDay: false,
      isCancelled: false,
      start: OutboxEventInstant.make({ dateTime: "2030-01-15T09:00:00", timeZone: "UTC" }),
      subject: "Hearing",
    });
    const mail = OutboxMessageView.make({ internetMessageId: "<request@example.test>", newestOtherReply: O.none() });

    assert.deepStrictEqual(changedFields(compareBasisPin(eventPin(event), messageNow(mail))), [
      "subject",
      "start",
      "end",
      "isAllDay",
      "isCancelled",
    ]);
    assert.deepStrictEqual(changedFields(compareBasisPin(messagePin(mail), eventNow(event))), [
      "internetMessageId",
      "newestOtherReply",
    ]);
  });

  it("folds pin statuses into one verdict", () => {
    const current = OutboxBasisStatus.cases.Current.make({});
    const gone = OutboxBasisStatus.cases.Gone.make({});
    const unreadable = OutboxBasisStatus.cases.Unreadable.make({ reason: "throttled" });
    const changed = OutboxBasisStatus.cases.Changed.make({
      fields: ["start"],
      now: messageNow(
        OutboxMessageView.make({ internetMessageId: "<request@example.test>", newestOtherReply: O.none() })
      ),
    });

    assert.deepStrictEqual(
      A.map(
        [[], [current], [current, current], [current, unreadable], [unreadable, gone], [changed, unreadable], [gone]],
        basisVerdict
      ),
      [
        "unpinned",
        "pinned-current",
        "pinned-current",
        "pinned-unverified",
        "pinned-stale",
        "pinned-stale",
        "pinned-stale",
      ]
    );
  });

  it("pairs each pin with its status in order", () => {
    const pin = messagePin(
      OutboxMessageView.make({ internetMessageId: "<request@example.test>", newestOtherReply: O.none() })
    );
    const report = makeBasisReport([pin], [OutboxBasisStatus.cases.Gone.make({})]);

    assert.strictEqual(report.verdict, "pinned-stale");
    assert.deepStrictEqual(
      A.map(report.pins, (entry) => [entry.pin.id, entry.status._tag]),
      [["message-1", "Gone"]]
    );
    assert.strictEqual(makeBasisReport([])([]).verdict, "unpinned");
  });
});
