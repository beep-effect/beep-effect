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
import {
  DELETED_ITEMS_FOLDER_ID,
  EVENT_ID,
  OutboxWorld,
  OutboxWorldServices,
  SETTINGS,
} from "./OutboxWorld.fixture.ts";
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

const created = (draftId: string, pinned = true, internetMessageId?: string) =>
  OutboxDraftCreatedRecord.make({
    at: AT,
    attachments: [],
    auditId: `created-${draftId}`,
    basis: pinned ? [eventPin] : [],
    bcc: [],
    cc: [],
    draftId,
    internetMessageId: O.fromUndefinedOr(internetMessageId),
    subject: `Subject of ${draftId}`,
    to: [],
  });

const draft = (
  id: string,
  categories: ReadonlyArray<string>,
  fields: { readonly internetMessageId?: string; readonly isDraft?: boolean; readonly parentFolderId?: string } = {}
) =>
  GraphMessage.make({
    categories: O.some(categories),
    changeKey: O.some(`${id}-key`),
    id,
    internetMessageId: O.fromUndefinedOr(fields.internetMessageId),
    isDraft: O.some(fields.isDraft ?? true),
    parentFolderId: O.fromUndefinedOr(fields.parentFolderId),
  });

const markRecord = (draftId: string) =>
  OutboxDraftBasisMarkedRecord.make({ at: AT, auditId: `mark-${draftId}`, draftId, fields: ["start"] });

const countOf = (calls: ReadonlyArray<string>, verb: string) => A.length(A.filter(calls, (call) => call === verb));

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
        // No moved draft, so Deleted Items is never asked for.
        assert.strictEqual(countOf(calls, "getMailFolder"), 0);
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
      "records the mark first, reports a 412, a transport failure or a missing change key as failed, and marks on a later call",
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
        // The mark is recorded before the write; a draft without a change key is not attempted at all.
        assert.deepStrictEqual(tagsOf(recordsAfterRefused), [
          "draft-created",
          "draft-created",
          "draft-created",
          "draft-basis-marked",
        ]);
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

  it.layer(HandlersLayer, { timeout: "10 seconds" })("a mark recorded but never written", (it) => {
    it.effect(
      "reconciles the journal without a Graph write once the basis is current, then leaves a person's category alone",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          categoryFailure: O.some(M365Error.fromReason("transport")),
          event: movedEvent,
          messages: [draft("stranded", [])],
          records: [created("stranded")],
        });
        const failed = yield* check;
        yield* world.script({ calls: [], categoryFailure: O.none(), event: pinnedEvent });
        const reconciled = yield* check;
        const reconcileCalls = yield* world.calls;
        const records = yield* world.records;
        yield* world.script({ messages: [draft("stranded", ["Client", OUTBOX_BASIS_STALE_CATEGORY])] });
        const byHand = yield* check;
        const kept = yield* categoriesOf("stranded");

        assert.deepStrictEqual(marks(failed), [["stranded", "pinned-stale", "failed"]]);
        assert.deepStrictEqual(marks(reconciled), [["stranded", "pinned-current", "none"]]);
        assert.deepStrictEqual(tagsOf(records), ["draft-created", "draft-basis-marked", "draft-basis-cleared"]);
        assert.deepStrictEqual(writes(reconcileCalls), []);
        assert.deepStrictEqual(marks(byHand), [["stranded", "pinned-current", "none"]]);
        assert.deepStrictEqual(kept, ["Client", OUTBOX_BASIS_STALE_CATEGORY]);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("an audit log that refuses a mark", (it) => {
    it.effect(
      "writes no category when the mark cannot be recorded, sets it once the log works, and reports an unrecorded closing",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          appendFailsFor: ["draft-basis-marked", "draft-closed"],
          event: movedEvent,
          messages: [draft("stale", [])],
          missingMessageIds: ["missing"],
          records: [created("stale"), created("missing")],
        });

        const refused = yield* check;
        const untouched = yield* categoriesOf("stale");
        const callsAfterRefused = yield* world.calls;
        yield* world.script({ appendFailsFor: [] });
        const retried = yield* check;
        const marked = yield* categoriesOf("stale");
        const records = yield* world.records;

        assert.deepStrictEqual(
          A.map(refused.drafts, (entry) => [entry.draftId, entry.mark, entry.markFailure]),
          [["stale", "failed", O.some("audit")]]
        );
        assert.deepStrictEqual(untouched, []);
        assert.deepStrictEqual(writes(callsAfterRefused), []);
        assert.deepStrictEqual(
          A.map(refused.closed, (closed) => [closed.draftId, closed.recorded]),
          [["missing", false]]
        );
        assert.deepStrictEqual(marks(retried), [["stale", "pinned-stale", "set"]]);
        assert.deepStrictEqual(marked, [OUTBOX_BASIS_STALE_CATEGORY]);
        assert.deepStrictEqual(tagsOf(records), [
          "draft-created",
          "draft-created",
          "draft-basis-marked",
          "draft-closed",
        ]);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("an audit log that refuses a clear", (it) => {
    it.effect(
      "retries the record once, reports cleared-unrecorded when it still fails, and records it on the next call",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          appendFailsFor: ["draft-basis-cleared"],
          event: pinnedEvent,
          messages: [draft("marked", [OUTBOX_BASIS_STALE_CATEGORY]), draft("flaky-log", [OUTBOX_BASIS_STALE_CATEGORY])],
          records: [created("marked"), markRecord("marked")],
        });

        const unrecorded = yield* check;
        const cleared = yield* categoriesOf("marked");
        yield* world.script({ appendFailsFor: [] });
        const reconciled = yield* check;
        const recordsAfterReconcile = yield* world.records;
        yield* world.script({
          appendFailsOnce: ["draft-basis-cleared"],
          messages: [
            draft("marked", ["Client", OUTBOX_BASIS_STALE_CATEGORY]),
            draft("flaky-log", [OUTBOX_BASIS_STALE_CATEGORY]),
          ],
          records: [...recordsAfterReconcile, created("flaky-log"), markRecord("flaky-log")],
        });
        const retried = yield* check;
        const kept = yield* categoriesOf("marked");
        const flakyCleared = yield* categoriesOf("flaky-log");
        const records = yield* world.records;

        assert.deepStrictEqual(marks(unrecorded), [["marked", "pinned-current", "cleared-unrecorded"]]);
        assert.deepStrictEqual(cleared, []);
        assert.deepStrictEqual(marks(reconciled), [["marked", "pinned-current", "none"]]);
        assert.deepStrictEqual(tagsOf(recordsAfterReconcile), [
          "draft-created",
          "draft-basis-marked",
          "draft-basis-cleared",
        ]);
        // A category a person adds to the reconciled draft is not this server's to remove.
        assert.deepStrictEqual(marks(retried), [
          ["marked", "pinned-current", "none"],
          ["flaky-log", "pinned-current", "cleared"],
        ]);
        assert.deepStrictEqual(kept, ["Client", OUTBOX_BASIS_STALE_CATEGORY]);
        assert.deepStrictEqual(flakyCleared, []);
        assert.strictEqual(A.length(A.filter(records, (record) => record._tag === "draft-basis-cleared")), 2);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("a draft moved out of Drafts", (it) => {
    it.effect(
      "finds a moved draft by its message id with one list call after a 404, and closes only what is really gone",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          event: movedEvent,
          messages: [
            draft("here", [], { internetMessageId: "<here@example.test>" }),
            draft("moved-now", ["Client"], { internetMessageId: "<moved@example.test>" }),
            draft("sent-copy", [], { internetMessageId: "<sent@example.test>", isDraft: false }),
            GraphMessage.make({ id: "bare" }),
          ],
          missingMessageIds: ["moved", "sent", "gone", "no-id"],
          records: [
            created("here", true, "<here@example.test>"),
            created("moved", true, "<moved@example.test>"),
            created("sent", true, "<sent@example.test>"),
            created("gone", true, "<gone@example.test>"),
            created("no-id"),
            created("bare"),
          ],
        });

        const first = yield* check;
        const firstCalls = yield* world.calls;
        const movedCategories = yield* categoriesOf("moved-now");
        yield* world.script({ calls: [] });
        const second = yield* check;
        const secondCalls = yield* world.calls;
        const records = yield* world.records;

        assert.deepStrictEqual(marks(first), [
          ["here", "pinned-stale", "set"],
          ["moved", "pinned-stale", "set"],
        ]);
        assert.deepStrictEqual(
          A.map(first.closed, (closed) => [closed.draftId, closed.reason]),
          [
            ["sent", "sent"],
            ["gone", "missing"],
            ["no-id", "missing"],
          ]
        );
        // Only an explicit isDraft false means sent: a message with only an id stays open.
        assert.deepStrictEqual(
          A.map(first.unreadable, (entry) => [entry.draftId, entry.reason]),
          [["bare", "incomplete-draft"]]
        );
        assert.deepStrictEqual(movedCategories, ["Client", OUTBOX_BASIS_STALE_CATEGORY]);
        // One list call per 404 with a recorded message id; none for a draft found by its id.
        assert.strictEqual(countOf(firstCalls, "listMessages"), 3);
        // No hit names a folder, so Deleted Items is never asked for.
        assert.strictEqual(countOf(firstCalls, "getMailFolder"), 0);
        // Records keep the recorded id as the draft's identity.
        assert.deepStrictEqual(
          A.map(
            A.filter(records, (record) => record._tag === "draft-basis-marked"),
            (record) => record.draftId
          ),
          ["here", "moved"]
        );
        assert.deepStrictEqual(marks(second), [
          ["here", "pinned-stale", "already-set"],
          ["moved", "pinned-stale", "already-set"],
        ]);
        assert.deepStrictEqual(
          A.map(second.unreadable, (entry) => entry.draftId),
          ["bare"]
        );
        assert.strictEqual(countOf(secondCalls, "listMessages"), 1);
        assert.deepStrictEqual(writes(secondCalls), []);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("a failing lookup by message id", (it) => {
    it.effect(
      "keeps a draft open as unreadable when the lookup by message id fails",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          calls: [],
          listFailure: O.some(M365Error.fromReason("throttled", { status: 429 })),
          messages: [],
          missingMessageIds: ["lost"],
          records: [created("lost", true, "<lost@example.test>")],
        });

        const failed = yield* check;
        const again = yield* check;

        assert.deepStrictEqual(
          A.map([...failed.unreadable, ...again.unreadable], (entry) => [entry.draftId, entry.reason]),
          [
            ["lost", "throttled"],
            ["lost", "throttled"],
          ]
        );
        assert.deepStrictEqual(failed.closed, []);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("a clear that cannot be written", (it) => {
    it.effect(
      "keeps the mark record and the category when the write fails, and reports a moved copy with an unusable id",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          categoryFailure: O.some(M365Error.fromReason("transport")),
          event: pinnedEvent,
          messages: [
            draft("marked", [OUTBOX_BASIS_STALE_CATEGORY]),
            draft("odd/id", [], { internetMessageId: "<odd@example.test>" }),
          ],
          missingMessageIds: ["odd"],
          records: [created("marked"), markRecord("marked"), created("odd", true, "<odd@example.test>")],
        });

        const result = yield* check;
        const kept = yield* categoriesOf("marked");
        const records = yield* world.records;

        assert.deepStrictEqual(
          A.map(result.drafts, (entry) => [entry.draftId, entry.mark, entry.markFailure]),
          [["marked", "failed", O.some("transport")]]
        );
        assert.deepStrictEqual(kept, [OUTBOX_BASIS_STALE_CATEGORY]);
        assert.deepStrictEqual(tagsOf(records), ["draft-created", "draft-basis-marked", "draft-created"]);
        assert.deepStrictEqual(
          A.map(result.unreadable, (entry) => [entry.draftId, entry.reason]),
          [["odd", "invalid-id"]]
        );
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("a draft deleted in Outlook", (it) => {
    it.effect(
      "retires a draft whose only copy is in Deleted Items, prefers a live copy, and asks for the folder once per call",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          event: movedEvent,
          messages: [
            draft("trashed", [], {
              internetMessageId: "<trashed@example.test>",
              parentFolderId: DELETED_ITEMS_FOLDER_ID,
            }),
            draft("live-copy", [], { internetMessageId: "<live@example.test>", parentFolderId: "archive-folder" }),
            draft("live-trash", [], {
              internetMessageId: "<live@example.test>",
              parentFolderId: DELETED_ITEMS_FOLDER_ID,
            }),
            // A sent copy beside a deleted one: the draft was sent.
            draft("sent-trash", [], {
              internetMessageId: "<sent@example.test>",
              parentFolderId: DELETED_ITEMS_FOLDER_ID,
            }),
            draft("sent-copy", [], { internetMessageId: "<sent@example.test>", isDraft: false }),
          ],
          missingMessageIds: ["deleted", "moved", "sent"],
          records: [
            created("deleted", true, "<trashed@example.test>"),
            created("moved", true, "<live@example.test>"),
            created("sent", true, "<sent@example.test>"),
          ],
        });

        const first = yield* check;
        const firstCalls = yield* world.calls;
        const live = yield* categoriesOf("live-copy");
        const trashed = yield* categoriesOf("trashed");
        const liveTrash = yield* categoriesOf("live-trash");
        yield* world.script({ calls: [] });
        const second = yield* check;
        const secondCalls = yield* world.calls;

        assert.deepStrictEqual(
          A.map(first.closed, (closed) => [closed.draftId, closed.reason]),
          [
            ["deleted", "missing"],
            ["sent", "sent"],
          ]
        );
        assert.deepStrictEqual(marks(first), [["moved", "pinned-stale", "set"]]);
        assert.deepStrictEqual(live, [OUTBOX_BASIS_STALE_CATEGORY]);
        assert.deepStrictEqual(trashed, []);
        assert.deepStrictEqual(liveTrash, []);
        // The deleted draft is never rechecked: one event read for the one live draft.
        assert.strictEqual(countOf(firstCalls, "getEvent"), 1);
        assert.strictEqual(countOf(firstCalls, "getMailFolder"), 1);
        assert.deepStrictEqual(writes(firstCalls), ["updateMessageCategories"]);
        assert.deepStrictEqual(second.closed, []);
        assert.deepStrictEqual(marks(second), [["moved", "pinned-stale", "already-set"]]);
        assert.strictEqual(countOf(secondCalls, "getMessage"), 1);
        assert.strictEqual(countOf(secondCalls, "getMailFolder"), 1);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("Deleted Items that cannot be read", (it) => {
    it.effect(
      "keeps a moved draft open as unreadable when the folder cannot be resolved",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          event: movedEvent,
          mailFolderFailure: O.some(M365Error.fromReason("throttled", { status: 429 })),
          messages: [draft("copy", [], { internetMessageId: "<copy@example.test>", parentFolderId: "archive-folder" })],
          missingMessageIds: ["moved"],
          records: [created("moved", true, "<copy@example.test>")],
        });

        const failed = yield* check;
        const again = yield* check;
        const calls = yield* world.calls;

        assert.deepStrictEqual(
          A.map([...failed.unreadable, ...again.unreadable], (entry) => [entry.draftId, entry.reason]),
          [
            ["moved", "throttled"],
            ["moved", "throttled"],
          ]
        );
        assert.deepStrictEqual([...failed.closed, ...again.closed], []);
        assert.deepStrictEqual(writes(calls), []);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("a draft recorded without a message id", (it) => {
    it.effect(
      "learns the message id once, retries a failed record, and then finds the draft after it moves",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          appendFailsOnce: ["draft-identified"],
          event: pinnedEvent,
          messages: [draft("old", [], { internetMessageId: "<old@example.test>" }), draft("anonymous", [])],
          records: [created("old"), created("anonymous")],
        });
        const identified = Effect.map(world.records, (records) =>
          A.map(
            A.filter(records, (record) => record._tag === "draft-identified"),
            (record) => (record._tag === "draft-identified" ? [record.draftId, record.internetMessageId] : [])
          )
        );

        const failedBackfill = yield* check;
        const afterFailed = yield* identified;
        yield* check;
        const afterRetry = yield* identified;
        yield* world.script({ calls: [] });
        yield* check;
        const afterThird = yield* identified;
        const thirdCalls = yield* world.calls;
        yield* world.script({
          calls: [],
          messages: [draft("old-moved", [], { internetMessageId: "<old@example.test>" })],
          missingMessageIds: ["old", "anonymous"],
        });
        const moved = yield* check;
        const movedCalls = yield* world.calls;

        assert.deepStrictEqual(marks(failedBackfill), [
          ["old", "pinned-current", "none"],
          ["anonymous", "pinned-current", "none"],
        ]);
        assert.deepStrictEqual(afterFailed, []);
        assert.deepStrictEqual(afterRetry, [["old", "<old@example.test>"]]);
        assert.deepStrictEqual(afterThird, [["old", "<old@example.test>"]]);
        // The backfill costs no Graph call of its own.
        assert.deepStrictEqual(thirdCalls, ["getMessage", "getEvent", "getMessage", "getEvent"]);
        // The draft that learned its id is found after the move; the one Graph gave no id is retired.
        assert.deepStrictEqual(marks(moved), [["old", "pinned-current", "none"]]);
        assert.deepStrictEqual(
          A.map(moved.closed, (closed) => [closed.draftId, closed.reason]),
          [["anonymous", "missing"]]
        );
        assert.strictEqual(countOf(movedCalls, "listMessages"), 1);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("create_draft and the message id", (it) => {
    it.effect(
      "records the message id from the create response, or from one narrow read, or not at all",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const toolkit = yield* OutboxToolkit;
        const create = toolkit
          .handle("m365_outbox_create_draft", {
            body: "Synthetic body for a fixture.",
            bodyType: "text",
            subject: "Fixture subject",
            to: ["first@example.test"],
          })
          .pipe(Effect.flatMap((handle) => Stream.runHead(handle)));
        const recordedIds = Effect.map(world.records, (records) =>
          A.map(
            A.filter(records, (record) => record._tag === "draft-created"),
            (record) => record.internetMessageId
          )
        );

        yield* create;
        const fromCreate = yield* world.calls;
        yield* world.script({ calls: [], createdInternetMessageId: O.none() });
        yield* create;
        const fromRead = yield* world.calls;
        yield* world.script({ calls: [], failingMessageIds: ["draft-1"] });
        yield* create;
        const ids = yield* recordedIds;

        assert.strictEqual(countOf(fromCreate, "getMessage"), 0);
        assert.strictEqual(countOf(fromRead, "getMessage"), 1);
        assert.deepStrictEqual(ids, [O.some("<fixture@example.test>"), O.some("<fixture@example.test>"), O.none()]);
      })
    );
  });
});
