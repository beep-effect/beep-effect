import { GraphDateTimeTimeZone, GraphEvent, GraphMessage, M365Error } from "@beep/m365";
import {
  OutboxBasisPin,
  OutboxBasisPinRef,
  OutboxBasisReader,
  OutboxEventInstant,
  OutboxEventView,
  OutboxMessageView,
} from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { EVENT_ID, MAILBOX, OutboxWorld, OutboxWorldServices } from "./OutboxWorld.fixture.ts";
import type { OutboxBasisStatus } from "@beep/m365-mcp";

const at = (dateTime: string) =>
  O.some(GraphDateTimeTimeZone.make({ dateTime: O.some(dateTime), timeZone: O.some("UTC") }));

const pinnedMessage = GraphMessage.make({
  changeKey: O.some("message-key-1"),
  conversationId: O.some("conversation-o'brien"),
  id: "message-1",
  internetMessageId: O.some("<request@example.test>"),
  receivedDateTime: O.some("2030-01-10T09:00:00Z"),
});

// What the caller read: the stored event below, which has no subject.
const eventView = OutboxEventView.make({
  end: OutboxEventInstant.make({ dateTime: "2030-01-15T10:00:00.0000000", timeZone: "UTC" }),
  isAllDay: false,
  isCancelled: false,
  start: OutboxEventInstant.make({ dateTime: "2030-01-15T09:00:00.0000000", timeZone: "UTC" }),
  subject: "",
});

const eventRef = OutboxBasisPinRef.cases.event.make({ id: EVENT_ID, view: eventView });

const messageRef = OutboxBasisPinRef.cases.message.make({
  id: "message-1",
  view: OutboxMessageView.make({ internetMessageId: "<request@example.test>", newestOtherReply: O.none() }),
});

const eventPin = (id: string) =>
  OutboxBasisPin.cases.event.make({
    changeKey: O.none(),
    id,
    observedAt: DateTime.makeUnsafe("2030-01-10T12:00:00Z"),
    view: eventView,
  });

const reasonOf = (status: OutboxBasisStatus): string => (status._tag === "Unreadable" ? status.reason : status._tag);

describe("@beep/m365-mcp outbox basis reader", () => {
  it.layer(OutboxWorldServices, { timeout: "10 seconds" })("events", (it) => {
    it.effect(
      "pins an event with its change key, and refuses one without a start or end",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const reader = yield* OutboxBasisReader;
        yield* world.script({
          event: GraphEvent.make({
            changeKey: O.some("event-key-1"),
            end: at("2030-01-15T10:00:00.0000000"),
            id: EVENT_ID,
            start: at("2030-01-15T09:00:00.0000000"),
          }),
        });

        const pin = yield* reader.observe(eventRef);
        yield* world.script({ event: GraphEvent.make({ id: EVENT_ID, start: at("2030-01-15T09:00:00.0000000") }) });
        const incomplete = yield* reader.observe(eventRef).pipe(Effect.flip);
        const recheck = yield* reader.recheck(pin);

        assert.strictEqual(pin.kind, "event");
        assert.deepStrictEqual(pin.changeKey, O.some("event-key-1"));
        assert.strictEqual(incomplete.reason, "basis-unreadable");
        assert.strictEqual(reasonOf(recheck), "incomplete-event");
        // A recorded id that is not a Graph path segment is never sent to Graph.
        const escaped = yield* reader.recheck(eventPin("../escape"));
        const userIds = yield* world.userIds;
        assert.strictEqual(reasonOf(escaped), "invalid-id");
        assert.deepStrictEqual(userIds, [O.some(MAILBOX), O.some(MAILBOX), O.some(MAILBOX)]);
      })
    );
  });

  it.layer(OutboxWorldServices, { timeout: "10 seconds" })("the caller's view", (it) => {
    it.effect(
      "refuses a view that differs from the read with basis-changed, naming the fields and no values",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const reader = yield* OutboxBasisReader;
        yield* world.script({
          event: GraphEvent.make({
            end: at("2030-01-15T10:00:00.0000000"),
            id: EVENT_ID,
            start: at("2030-01-15T08:00:00.0000000"),
            subject: O.some("Hearing moved"),
          }),
        });

        const refused = yield* reader.observe(eventRef).pipe(Effect.flip);

        assert.strictEqual(refused.reason, "basis-changed");
        assert.deepStrictEqual(refused.fields, ["subject", "start"]);
        assert.include(refused.message, "(subject, start)");
        assert.notInclude(refused.message, "Hearing");
        assert.notInclude(refused.message, "08:00");
      })
    );
  });

  it.layer(OutboxWorldServices, { timeout: "10 seconds" })("messages", (it) => {
    it.effect(
      "lists the conversation by its id with the quote doubled, and refuses what it cannot read",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const reader = yield* OutboxBasisReader;
        const observe = reader.observe(messageRef);
        yield* world.script({ messages: [pinnedMessage] });

        // The stub answers only `conversationId eq '<id>'` with OData's doubled quote.
        const quoted = yield* observe;
        yield* world.script({ messages: [GraphMessage.make({ ...pinnedMessage, conversationId: O.none() })] });
        const noConversation = yield* observe.pipe(Effect.flip);
        yield* world.script({
          listFailure: O.some(M365Error.fromReason("transport")),
          messages: [GraphMessage.make({ ...pinnedMessage, conversationId: O.some("conversation-1") })],
        });
        const listFailed = yield* observe.pipe(Effect.flip);
        yield* world.script({ listFailure: O.none(), pagedConversation: true });
        const paged = yield* observe.pipe(Effect.flip);
        yield* world.script({ pagedConversation: false });
        const pin = yield* observe;

        assert.deepStrictEqual(
          [noConversation.reason, listFailed.reason, paged.reason],
          ["basis-unreadable", "basis-unreadable", "basis-unreadable"]
        );
        assert.strictEqual(quoted.kind === "message" ? quoted.conversationId : "", "conversation-o'brien");
        assert.strictEqual(pin.kind, "message");
        if (pin.kind === "message") {
          assert.strictEqual(pin.conversationId, "conversation-1");
          assert.deepStrictEqual(pin.changeKey, O.some("message-key-1"));
        }

        yield* world.script({ pagedConversation: true });
        const pagedRecheck = yield* reader.recheck(pin);
        yield* world.script({ listFailure: O.some(M365Error.fromReason("throttled")), pagedConversation: false });
        const failedRecheck = yield* reader.recheck(pin);
        yield* world.script({ listFailure: O.none(), messages: [] });
        const goneRecheck = yield* reader.recheck(pin);

        assert.deepStrictEqual(
          [reasonOf(pagedRecheck), reasonOf(failedRecheck), reasonOf(goneRecheck)],
          ["conversation-too-long", "throttled", "Gone"]
        );
      })
    );
  });
});
