import { GraphDateTimeTimeZone, GraphEvent, GraphMessage, M365Error } from "@beep/m365";
import {
  makeOutboxToolkitHandlers,
  OUTBOX_BASIS_STALE_CATEGORY,
  OutboxBasisPin,
  OutboxDraftBasisMarkedRecord,
  OutboxDraftCreatedRecord,
  OutboxDraftDeletedRecord,
  OutboxDraftsChecked,
  OutboxEventInstant,
  OutboxEventView,
  OutboxSendOutcomeRecord,
  OutboxToolkit,
} from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { EVENT_ID, OutboxWorld, OutboxWorldServices, SETTINGS } from "./OutboxWorld.fixture.ts";
import type { OutboxAuditRecord } from "@beep/m365-mcp";

const HandlersLayer = makeOutboxToolkitHandlers(SETTINGS).pipe(Layer.provideMerge(OutboxWorldServices));

const AT = DateTime.makeUnsafe("2030-01-15T12:00:00Z");
const NINE = "2030-01-15T09:00:00.0000000";
const TEN = "2030-01-15T10:00:00.0000000";

const graphAt = (dateTime: string) =>
  O.some(GraphDateTimeTimeZone.make({ dateTime: O.some(dateTime), timeZone: O.some("UTC") }));

const pinnedEvent = GraphEvent.make({
  end: graphAt(TEN),
  id: EVENT_ID,
  start: graphAt(NINE),
  subject: O.some("Hearing"),
});
const movedEvent = GraphEvent.make({ ...pinnedEvent, start: graphAt("2030-01-15T08:00:00.0000000") });

const eventPin = OutboxBasisPin.cases.event.make({
  changeKey: O.none(),
  id: EVENT_ID,
  observedAt: AT,
  view: OutboxEventView.make({
    end: OutboxEventInstant.make({ dateTime: TEN, timeZone: "UTC" }),
    isAllDay: false,
    isCancelled: false,
    start: OutboxEventInstant.make({ dateTime: NINE, timeZone: "UTC" }),
    subject: "Hearing",
  }),
});

const created = (draftId: string, pinned = true) =>
  OutboxDraftCreatedRecord.make({
    at: AT,
    attachments: [],
    auditId: `created-${draftId}`,
    basis: pinned ? [eventPin] : [],
    bcc: [],
    cc: [],
    draftId,
    subject: `Subject of ${draftId}`,
    to: [],
  });

const draft = (id: string, categories: ReadonlyArray<string>, fields: { readonly isDraft?: boolean } = {}) =>
  GraphMessage.make({
    categories: O.some(categories),
    changeKey: O.some(`${id}-key`),
    id,
    isDraft: O.some(fields.isDraft ?? true),
  });

const check = Effect.gen(function* () {
  const toolkit = yield* OutboxToolkit;
  const handle = yield* toolkit.handle("m365_outbox_check_drafts", {});
  const output = yield* Stream.runHead(handle).pipe(Effect.flatMap(Effect.fromOption));
  assert.isFalse(output.isFailure);
  return S.is(OutboxDraftsChecked)(output.result)
    ? output.result
    : yield* Effect.die(new Error("check_drafts returned no result"));
});

const marks = (result: OutboxDraftsChecked) =>
  A.map(result.drafts, (entry) => [entry.draftId, entry.verdict, entry.mark]);

const categoriesOf = Effect.fn("categoriesOf")(function* (id: string) {
  const world = yield* OutboxWorld;
  const { messages } = yield* Ref.get(world.state);
  return pipe(
    A.findFirst(messages, (message) => message.id === id),
    O.flatMap((message) => message.categories),
    O.getOrElse((): ReadonlyArray<string> => [])
  );
});

const tagsOf = A.map((record: OutboxAuditRecord) => record._tag);

// Any Graph verb that writes: check_drafts may only ever use updateMessageCategories.
const WRITE_VERBS = [
  "addMessageAttachment",
  "createDraftMessage",
  "createEvent",
  "deleteDraftMessage",
  "sendDraftMessage",
  "updateEvent",
  "updateMessageCategories",
];
const writes = (calls: ReadonlyArray<string>) => A.filter(calls, (call) => A.contains(WRITE_VERBS, call));

describe("@beep/m365-mcp outbox check_drafts", () => {
  it.layer(HandlersLayer, { timeout: "10 seconds" })("a draft whose basis changes and comes back", (it) => {
    it.effect(
      "sets the category once, keeps the others in order, and clears it when the basis is current again",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          event: movedEvent,
          messages: [draft("stale", ["Client", "Billing"])],
          records: [created("stale")],
        });

        const first = yield* check;
        const marked = yield* categoriesOf("stale");
        const second = yield* check;
        yield* world.script({ event: pinnedEvent });
        const third = yield* check;
        const cleared = yield* categoriesOf("stale");
        const records = yield* world.records;
        const calls = yield* world.calls;

        assert.deepStrictEqual(marks(first), [["stale", "pinned-stale", "set"]]);
        assert.strictEqual(first.drafts[0]?.subject, "Subject of stale");
        assert.deepStrictEqual(first.counts, {
          "pinned-current": 0,
          "pinned-stale": 1,
          "pinned-unverified": 0,
          unpinned: 0,
        });
        assert.deepStrictEqual(marked, ["Client", "Billing", OUTBOX_BASIS_STALE_CATEGORY]);
        assert.deepStrictEqual(marks(second), [["stale", "pinned-stale", "already-set"]]);
        assert.deepStrictEqual(marks(third), [["stale", "pinned-current", "cleared"]]);
        assert.deepStrictEqual(cleared, ["Client", "Billing"]);
        assert.deepStrictEqual(tagsOf(records), ["draft-created", "draft-basis-marked", "draft-basis-cleared"]);
        const markRecord = records[1];
        assert.deepStrictEqual(markRecord?._tag === "draft-basis-marked" ? markRecord.fields : [], ["start"]);
        // Two category writes in three calls, and no other write verb at all.
        assert.deepStrictEqual(writes(calls), ["updateMessageCategories", "updateMessageCategories"]);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("categories this server did not set", (it) => {
    it.effect(
      "leaves a person's category on a current draft and never touches an unpinned or unverified one",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          event: pinnedEvent,
          messages: [
            draft("by-hand", [OUTBOX_BASIS_STALE_CATEGORY]),
            draft("unpinned", [OUTBOX_BASIS_STALE_CATEGORY]),
            draft("unverified-marked", [OUTBOX_BASIS_STALE_CATEGORY]),
            draft("unverified-clean", ["Client"]),
          ],
          records: [
            created("by-hand"),
            created("unpinned", false),
            created("unverified-marked"),
            created("unverified-clean"),
          ],
        });

        const current = yield* check;
        yield* world.script({ eventFailure: O.some(M365Error.fromReason("throttled", { status: 429 })) });
        const unverified = yield* check;
        const calls = yield* world.calls;

        assert.deepStrictEqual(marks(current), [
          ["by-hand", "pinned-current", "none"],
          ["unpinned", "unpinned", "none"],
          ["unverified-marked", "pinned-current", "none"],
          ["unverified-clean", "pinned-current", "none"],
        ]);
        assert.deepStrictEqual(marks(unverified), [
          ["by-hand", "pinned-unverified", "none"],
          ["unpinned", "unpinned", "none"],
          ["unverified-marked", "pinned-unverified", "none"],
          ["unverified-clean", "pinned-unverified", "none"],
        ]);
        assert.deepStrictEqual(unverified.counts, {
          "pinned-current": 0,
          "pinned-stale": 0,
          "pinned-unverified": 3,
          unpinned: 1,
        });
        assert.deepStrictEqual(writes(calls), []);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("drafts that left Drafts", (it) => {
    it.effect(
      "retires a missing and a sent draft once, keeps an unreadable one open, and skips deleted or sent ones",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          event: movedEvent,
          failingMessageIds: ["flaky"],
          messages: [draft("sent", [], { isDraft: false }), draft("flaky", [])],
          missingMessageIds: ["missing"],
          records: [
            created("missing"),
            created("sent"),
            created("flaky"),
            created("deleted"),
            OutboxDraftDeletedRecord.make({ at: AT, auditId: "d", draftId: "deleted" }),
            created("sent-here"),
            OutboxSendOutcomeRecord.make({ at: AT, auditId: "s", draftId: "sent-here", outcome: "sent" }),
          ],
        });

        const first = yield* check;
        const firstCalls = yield* world.calls;
        yield* world.script({ calls: [] });
        const second = yield* check;
        const secondCalls = yield* world.calls;
        const records = yield* world.records;

        assert.deepStrictEqual(
          A.map(first.closed, (closed) => [closed.draftId, closed.reason, closed.recorded]),
          [
            ["missing", "missing", true],
            ["sent", "sent", true],
          ]
        );
        assert.deepStrictEqual(
          A.map(first.unreadable, (entry) => [entry.draftId, entry.reason]),
          [["flaky", "transport"]]
        );
        assert.deepStrictEqual(first.drafts, []);
        // Deleted and sent-here drafts are never read: only the three open drafts are.
        assert.deepStrictEqual(
          A.filter(firstCalls, (call) => call === "getMessage"),
          ["getMessage", "getMessage", "getMessage"]
        );
        assert.deepStrictEqual(second.closed, []);
        assert.deepStrictEqual(
          A.map(second.unreadable, (entry) => entry.draftId),
          ["flaky"]
        );
        assert.deepStrictEqual(secondCalls, ["getMessage"]);
        assert.deepStrictEqual(
          A.map(
            A.filter(records, (record) => record._tag === "draft-closed"),
            (record) => (record._tag === "draft-closed" ? [record.draftId, record.reason] : [])
          ),
          [
            ["missing", "missing"],
            ["sent", "sent"],
          ]
        );
        assert.deepStrictEqual(writes(firstCalls), []);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("a category write that fails", (it) => {
    it.effect(
      "reports a 412 or a missing change key as failed, writes no record, and marks on the next call",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          categoryFailure: O.some(M365Error.fromReason("response status", { resource: "messages", status: 412 })),
          event: movedEvent,
          messages: [draft("conflict", []), GraphMessage.make({ ...draft("keyless", []), changeKey: O.none() })],
          records: [created("conflict"), created("keyless"), created("bad/id")],
        });

        const refused = yield* check;
        const recordsAfterRefused = yield* world.records;
        yield* world.script({ categoryFailure: O.some(M365Error.fromReason("transport")) });
        const transport = yield* check;
        yield* world.script({ categoryFailure: O.none() });
        const retried = yield* check;

        assert.deepStrictEqual(
          A.map(refused.drafts, (entry) => [entry.draftId, entry.mark, entry.markFailure]),
          [
            ["conflict", "failed", O.some("changed-since-read")],
            ["keyless", "failed", O.some("no-change-key")],
          ]
        );
        assert.deepStrictEqual(
          A.map(refused.unreadable, (entry) => [entry.draftId, entry.reason]),
          [["bad/id", "invalid-id"]]
        );
        assert.deepStrictEqual(tagsOf(recordsAfterRefused), ["draft-created", "draft-created", "draft-created"]);
        assert.deepStrictEqual(
          A.map(transport.drafts, (entry) => entry.markFailure),
          [O.some("transport"), O.some("no-change-key")]
        );
        assert.deepStrictEqual(marks(retried), [
          ["conflict", "pinned-stale", "set"],
          ["keyless", "pinned-stale", "failed"],
        ]);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("an audit log that refuses the record", (it) => {
    it.effect(
      "says the category was written without its record, and that a closing was not recorded",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          appendFailsFor: ["draft-basis-marked", "draft-basis-cleared", "draft-closed"],
          event: movedEvent,
          messages: [draft("stale", []), draft("marked", [OUTBOX_BASIS_STALE_CATEGORY])],
          missingMessageIds: ["missing"],
          records: [created("stale"), created("missing")],
        });

        const result = yield* check;
        yield* world.script({
          event: pinnedEvent,
          records: [
            created("marked"),
            OutboxDraftBasisMarkedRecord.make({ at: AT, auditId: "m", draftId: "marked", fields: ["start"] }),
          ],
        });
        const clearing = yield* check;
        const clearedCategories = yield* categoriesOf("marked");
        const records = yield* world.records;

        assert.deepStrictEqual(marks(result), [["stale", "pinned-stale", "set-unrecorded"]]);
        assert.deepStrictEqual(
          A.map(result.closed, (closed) => [closed.draftId, closed.recorded]),
          [["missing", false]]
        );
        assert.deepStrictEqual(marks(clearing), [["marked", "pinned-current", "cleared-unrecorded"]]);
        assert.deepStrictEqual(clearedCategories, []);
        assert.deepStrictEqual(tagsOf(records), ["draft-created", "draft-basis-marked"]);
      })
    );
  });
});
