import { M365Error } from "@beep/m365";
import {
  makeOutboxToolkitHandlers,
  OutboxDraftCreated,
  OutboxDraftView,
  OutboxSendResult,
  OutboxToolError,
  OutboxToolkit,
} from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import {
  DRAFT_ID,
  digestOf,
  draftCreatedRecord,
  EVENT_ID,
  FIXTURE_CONTENT,
  fixtureFile,
  MAILBOX,
  OutboxWorld,
  OutboxWorldServices,
  SETTINGS,
  sha256Of,
  sourceContent,
  storedDraft,
  storedFile,
} from "./OutboxWorld.fixture.ts";
import type { OutboxAuditRecord } from "@beep/m365-mcp";

const HandlersLayer = makeOutboxToolkitHandlers(SETTINGS).pipe(Layer.provideMerge(OutboxWorldServices));

const head = <A, E, R>(stream: Stream.Stream<A, E, R>): Effect.Effect<A, E, R> =>
  Stream.runHead(stream).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => Effect.die(new Error("the tool returned no result")),
        onSome: Effect.succeed,
      })
    )
  );

const isSendResult = S.is(OutboxSendResult);
const isToolError = S.is(OutboxToolError);
const isDraftCreated = S.is(OutboxDraftCreated);
const isDraftView = S.is(OutboxDraftView);

// The expectation restates the content length (16), never the size Graph reports (216).
const sendParams = Effect.gen(function* () {
  return {
    draftId: DRAFT_ID,
    expect: {
      attachments: [{ name: "fixture.pdf", sha256: yield* sha256Of(FIXTURE_CONTENT), size: 16 }],
      bcc: [],
      cc: ["COPY@example.test"],
      subject: " Fixture subject ",
      to: ["first@example.test"],
    },
  };
});

const createDraftParams = {
  attachmentPaths: ["/staging/one.pdf", "/staging/two.pdf"],
  body: "Synthetic body for a fixture.",
  bodyType: "text",
  subject: "Fixture subject",
  to: ["first@example.test"],
} as const;

const eventParams = {
  end: { dateTime: "2030-01-16T00:00:00", timeZone: "UTC" },
  isAllDay: true,
  start: { dateTime: "2030-01-15T00:00:00", timeZone: "UTC" },
  subject: "Fixture event",
};

const tags = A.map((record: OutboxAuditRecord) => record._tag);
const auditIds = A.map((record: OutboxAuditRecord) => record.auditId);
const sends = (calls: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(calls, (call) => call === "sendDraftMessage");

const seedRecordedDraft = Effect.gen(function* () {
  const world = yield* OutboxWorld;
  yield* world.script({ records: [draftCreatedRecord([])] });
  return world;
});

const send = Effect.gen(function* () {
  const toolkit = yield* OutboxToolkit;
  return yield* head(yield* toolkit.handle("m365_outbox_send_draft", yield* sendParams));
});

const refusedWith = Effect.gen(function* () {
  const output = yield* send;
  assert.isFalse(output.isFailure);
  return isSendResult(output.result) ? [output.result.outcome, output.result.mismatches] : [];
});

describe("@beep/m365-mcp outbox handlers", () => {
  it.layer(HandlersLayer, { timeout: "10 seconds" })("create_draft", (it) => {
    it.effect(
      "attaches each file, reads the stored bytes back and returns the local digests",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const toolkit = yield* OutboxToolkit;

        const output = yield* head(yield* toolkit.handle("m365_outbox_create_draft", createDraftParams));
        const records = yield* world.records;

        assert.isFalse(output.isFailure);
        assert.isTrue(isDraftCreated(output.result));
        if (isDraftCreated(output.result)) {
          assert.strictEqual(output.result.draftId, DRAFT_ID);
          assert.deepStrictEqual(
            A.map(output.result.attachments, (attachment) => [attachment.name, attachment.size, attachment.sha256]),
            [
              ["one.pdf", 16, yield* sha256Of(sourceContent(0))],
              ["two.pdf", 16, yield* sha256Of(sourceContent(1))],
            ]
          );
        }
        assert.deepStrictEqual(yield* world.calls, [
          "createDraftMessage",
          "addMessageAttachment",
          "addMessageAttachment",
          "listMessageAttachments",
          "downloadMessageAttachment",
          "downloadMessageAttachment",
        ]);
        assert.deepStrictEqual(tags(records), ["draft-created"]);
        assert.deepStrictEqual(yield* world.userIds, A.replicate(O.some(MAILBOX), 6));
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("create_draft failing on the second attachment", (it) => {
    it.effect(
      "deletes the draft it created and records nothing",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const toolkit = yield* OutboxToolkit;
        yield* world.script({ failAttachmentAt: O.some(1) });

        const output = yield* head(yield* toolkit.handle("m365_outbox_create_draft", createDraftParams));

        assert.isTrue(output.isFailure);
        assert.deepStrictEqual(yield* world.calls, [
          "createDraftMessage",
          "addMessageAttachment",
          "addMessageAttachment",
          "deleteDraftMessage",
        ]);
        assert.deepStrictEqual(yield* world.records, []);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("create_draft whose upload does not round-trip", (it) => {
    it.effect(
      "deletes the draft when the stored bytes differ from the local files",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const toolkit = yield* OutboxToolkit;
        yield* world.script({ corruptUploads: true });

        const output = yield* head(yield* toolkit.handle("m365_outbox_create_draft", createDraftParams));

        assert.isTrue(output.isFailure);
        if (isToolError(output.result)) {
          assertSome(output.result.reason, "round-trip-mismatch");
        }
        assertSome(A.last(yield* world.calls), "deleteDraftMessage");
        assert.deepStrictEqual(yield* world.records, []);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("create_draft whose audit record cannot be written", (it) => {
    it.effect(
      "deletes the draft",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const toolkit = yield* OutboxToolkit;
        yield* world.script({ appendFailsFor: ["draft-created"] });

        const output = yield* head(yield* toolkit.handle("m365_outbox_create_draft", createDraftParams));

        assert.isTrue(output.isFailure);
        assertSome(A.last(yield* world.calls), "deleteDraftMessage");
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("get_draft", (it) => {
    it.effect(
      "returns recipients, subject and the stored attachments by content length and digest, and no body",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const toolkit = yield* OutboxToolkit;
        const getDraft = toolkit.handle("m365_outbox_get_draft", { draftId: DRAFT_ID }).pipe(Effect.flatMap(head));

        const output = yield* getDraft;
        yield* world.script({
          files: [
            fixtureFile,
            {
              ...storedFile({ content: FIXTURE_CONTENT, name: "item.msg" }),
              odataType: "#microsoft.graph.itemAttachment",
            },
          ],
        });
        const unsupported = yield* getDraft;

        assert.isTrue(isDraftView(output.result));
        if (isDraftView(output.result)) {
          assert.isTrue(output.result.isDraft);
          assert.deepStrictEqual(output.result.to, ["first@example.test"]);
          assert.deepStrictEqual(output.result.cc, ["copy@example.test"]);
          assert.strictEqual(output.result.subject, "Fixture subject");
          assert.deepStrictEqual(
            A.map(output.result.attachments, (attachment) => [attachment.name, attachment.size, attachment.sha256]),
            [["fixture.pdf", 16, yield* sha256Of(FIXTURE_CONTENT)]]
          );
        }
        assert.notProperty(output.encodedResult, "body");
        assert.isTrue(unsupported.isFailure);
        if (isToolError(unsupported.result)) {
          assertSome(unsupported.result.reason, "unsupported");
          assert.include(unsupported.result.message, "1 attachment(s)");
          assert.notInclude(unsupported.result.message, "item.msg");
        }
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("send_draft with a matching expectation", (it) => {
    it.effect(
      "hashes the stored bytes, writes the intent, sends once, and writes the outcome under the same audit id",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;

        const output = yield* send;
        const records = yield* world.records;
        const calls = yield* world.calls;

        assert.isFalse(output.isFailure);
        assert.isTrue(isSendResult(output.result));
        if (isSendResult(output.result)) {
          assert.strictEqual(output.result.outcome, "sent");
          assert.isTrue(output.result.auditRecorded);
          assert.deepStrictEqual(auditIds(records), [output.result.auditId, output.result.auditId]);
        }
        assert.deepStrictEqual(tags(records), ["send-intent", "send-outcome"]);
        assert.deepStrictEqual(
          pipe(
            A.head(records),
            O.map((record) => (record._tag === "send-intent" ? A.map(record.attachments, (a) => [a.name, a.size]) : []))
          ),
          O.some([["fixture.pdf", 16]])
        );
        assert.deepStrictEqual(calls, [
          "getMessage",
          "listMessageAttachments",
          "downloadMessageAttachment",
          "sendDraftMessage",
        ]);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("send_draft against a draft edited elsewhere", (it) => {
    it.effect(
      "refuses a changed subject, a swapped attachment, an added attachment and an unverifiable attachment",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const swapped = storedFile({ content: new Uint8Array(16).fill(8), name: "fixture.pdf" });
        const added = storedFile({ content: new Uint8Array(4).fill(1), name: "added.pdf" });

        yield* world.script({ draft: { ...storedDraft, subject: O.some("Edited in Outlook") } });
        const subject = yield* refusedWith;
        // Same name and same reported size, different bytes.
        yield* world.script({ draft: storedDraft, files: [swapped] });
        const digest = yield* refusedWith;
        yield* world.script({ files: [fixtureFile, added] });
        const extra = yield* refusedWith;
        yield* world.script({ files: [] });
        const removed = yield* refusedWith;
        yield* world.script({ files: [{ ...fixtureFile, odataType: "#microsoft.graph.referenceAttachment" }] });
        const reference = yield* refusedWith;
        yield* world.script({ files: [{ ...fixtureFile, isInline: true }] });
        const inline = yield* refusedWith;
        yield* world.script({ files: A.replicate(fixtureFile, 5) });
        const tooMany = yield* refusedWith;
        yield* world.script({ files: [storedFile({ content: new Uint8Array(2048), name: "huge.bin" })] });
        const tooLarge = yield* refusedWith;
        yield* world.script({ files: [{ ...fixtureFile, id: "not/a-path-segment" }] });
        const unsafeId = yield* refusedWith;
        yield* world.script({ failDownloads: true, files: [fixtureFile] });
        const undownloadable = yield* refusedWith;
        const records = yield* world.records;
        const calls = yield* world.calls;

        assert.deepStrictEqual(subject, ["refused", ["subject"]]);
        assert.deepStrictEqual(digest, ["refused", ["attachment-digest"]]);
        assert.deepStrictEqual(extra, ["refused", ["attachments"]]);
        assert.deepStrictEqual(removed, ["refused", ["attachments"]]);
        assert.deepStrictEqual(reference, ["refused", ["attachments"]]);
        assert.deepStrictEqual(inline, ["refused", ["attachments"]]);
        assert.deepStrictEqual(tooMany, ["refused", ["attachments"]]);
        assert.deepStrictEqual(tooLarge, ["refused", ["attachments"]]);
        assert.deepStrictEqual(unsafeId, ["refused", ["attachments"]]);
        assert.deepStrictEqual(undownloadable, ["refused", ["attachments"]]);
        assert.deepStrictEqual(tags(records), A.replicate("send-outcome", 10));
        assert.deepStrictEqual(sends(calls), []);
        // Subject, swap, extra (2 files) and the failing download: 5 attempts. Nothing is downloaded once a
        // limit or an unverifiable attachment is seen.
        assert.lengthOf(
          A.filter(calls, (call) => call === "downloadMessageAttachment"),
          5
        );
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("send_draft when the intent record cannot be written", (it) => {
    it.effect(
      "fails the call and never reaches the send verb",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({ appendFailsFor: ["send-intent"] });

        const output = yield* send;

        assert.isTrue(output.isFailure);
        assert.isTrue(isToolError(output.result));
        if (isToolError(output.result)) {
          assertSome(output.result.reason, "append");
          assert.isFalse(output.result.retryable);
        }
        assert.deepStrictEqual(sends(yield* world.calls), []);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("send_draft with an ambiguous write", (it) => {
    it.effect(
      "returns outcome unknown as a result, with an intent and an outcome record",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({ sendFailure: O.some(M365Error.fromReason("ambiguous write", { resource: "messages" })) });

        const output = yield* send;
        const records = yield* world.records;

        assert.isFalse(output.isFailure);
        if (isSendResult(output.result)) {
          assert.strictEqual(output.result.outcome, "unknown");
          assert.deepStrictEqual(auditIds(records), [output.result.auditId, output.result.auditId]);
        }
        assert.deepStrictEqual(tags(records), ["send-intent", "send-outcome"]);
        assert.deepStrictEqual(sends(yield* world.calls), ["sendDraftMessage"]);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("send_draft rejected by Graph", (it) => {
    it.effect(
      "records a refused outcome with the status and returns a non-retryable tool error",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({
          sendFailure: O.some(M365Error.fromReason("response status", { resource: "messages", status: 403 })),
        });

        const output = yield* send;
        const outcome = A.last(yield* world.records);

        assert.isTrue(output.isFailure);
        if (isToolError(output.result)) {
          assert.isFalse(output.result.retryable);
        }
        assertSome(
          O.map(outcome, (record) => (record._tag === "send-outcome" ? [record.outcome, record.graphStatus] : [])),
          ["refused", O.some(403)]
        );
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("send_draft when the outcome record cannot be written", (it) => {
    it.effect(
      "still reports the send, flagged as not recorded",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        yield* world.script({ appendFailsFor: ["send-outcome"] });

        const output = yield* send;

        assert.isFalse(output.isFailure);
        if (isSendResult(output.result)) {
          assert.strictEqual(output.result.outcome, "sent");
          assert.isFalse(output.result.auditRecorded);
        }
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("delete_draft", (it) => {
    it.effect(
      "refuses a message this server did not create or that is not a draft, and deletes its own draft",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const toolkit = yield* OutboxToolkit;
        const deleteDraft = toolkit
          .handle("m365_outbox_delete_draft", { draftId: DRAFT_ID })
          .pipe(Effect.flatMap(head));

        const unrecorded = yield* deleteDraft;
        yield* world.script({
          draft: { ...storedDraft, isDraft: O.some(false) },
          records: [draftCreatedRecord([])],
        });
        const alreadySent = yield* deleteDraft;
        assert.notInclude(yield* world.calls, "deleteDraftMessage");
        yield* world.script({ draft: storedDraft });
        const own = yield* deleteDraft;

        assert.isTrue(unrecorded.isFailure);
        assert.isTrue(alreadySent.isFailure);
        assert.isFalse(own.isFailure);
        assertSome(A.last(yield* world.calls), "deleteDraftMessage");
        assertSome(
          O.map(A.last(yield* world.records), (record) => record._tag),
          "draft-deleted"
        );
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("event tools", (it) => {
    it.effect(
      "create and update events in the configured mailbox and audit both",
      Effect.fnUntraced(function* () {
        const world = yield* OutboxWorld;
        const toolkit = yield* OutboxToolkit;

        const created = yield* head(yield* toolkit.handle("m365_outbox_create_event", eventParams));
        const updated = yield* head(
          yield* toolkit.handle("m365_outbox_update_event", { eventId: EVENT_ID, subject: "Fixture event (moved)" })
        );

        assert.isFalse(created.isFailure);
        assert.isFalse(updated.isFailure);
        assert.deepStrictEqual(yield* world.calls, ["createEvent", "updateEvent"]);
        assert.deepStrictEqual(yield* world.userIds, [O.some(MAILBOX), O.some(MAILBOX)]);
        assert.deepStrictEqual(tags(yield* world.records), ["event-created", "event-updated"]);
      })
    );
  });

  it.layer(HandlersLayer, { timeout: "10 seconds" })("the send verb", (it) => {
    it.effect(
      "is reached by m365_outbox_send_draft and by no other tool",
      Effect.fnUntraced(function* () {
        const world = yield* seedRecordedDraft;
        const toolkit = yield* OutboxToolkit;
        const sendCalls = world.calls.pipe(Effect.map((calls) => A.length(sends(calls))));
        const failed = <A extends { readonly isFailure: boolean }, E, R>(
          invocation: Effect.Effect<Stream.Stream<A, E, R>, E, R>
        ): Effect.Effect<boolean, E, R> =>
          invocation.pipe(
            Effect.flatMap(head),
            Effect.map((output) => output.isFailure)
          );
        const invocations = [
          ["m365_outbox_get_draft", failed(toolkit.handle("m365_outbox_get_draft", { draftId: DRAFT_ID }))],
          ["m365_outbox_send_draft", failed(toolkit.handle("m365_outbox_send_draft", yield* sendParams))],
          ["m365_outbox_create_event", failed(toolkit.handle("m365_outbox_create_event", eventParams))],
          ["m365_outbox_update_event", failed(toolkit.handle("m365_outbox_update_event", { eventId: EVENT_ID }))],
          ["m365_outbox_create_draft", failed(toolkit.handle("m365_outbox_create_draft", createDraftParams))],
          // Last: it removes the draft the other tools read.
          ["m365_outbox_delete_draft", failed(toolkit.handle("m365_outbox_delete_draft", { draftId: DRAFT_ID }))],
        ] as const;

        const observed = yield* Effect.forEach(invocations, ([name, invocation]) =>
          Effect.gen(function* () {
            const before = yield* sendCalls;
            assert.isFalse(yield* invocation, name);
            return [name, (yield* sendCalls) - before] as const;
          })
        );

        assert.deepStrictEqual(
          pipe(
            A.map(observed, ([name]) => name),
            A.sort(Order.String)
          ),
          pipe(Object.keys(OutboxToolkit.tools), A.sort(Order.String))
        );
        assert.deepStrictEqual(
          A.filter(observed, ([, sent]) => sent > 0),
          [["m365_outbox_send_draft", 1]]
        );
      })
    );
  });

  it("gives no tool a mailbox, user or attendee parameter", () => {
    const forbidden = ["attendees", "mailbox", "userId", "from", "sender"];
    const parameterKeys = (schema: unknown): ReadonlyArray<string> =>
      P.hasProperty(schema, "fields") && P.isObject(schema.fields) ? Object.keys(schema.fields) : [];

    for (const tool of Object.values(OutboxToolkit.tools)) {
      const keys = parameterKeys(tool.parametersSchema);
      assert.isAbove(A.length(keys), 0, tool.name);
      assert.deepStrictEqual(A.intersection(keys, forbidden), [], tool.name);
    }
  });

  it("requires a digest on every expected attachment", () => {
    const decode = S.decodeUnknownOption(OutboxToolkit.tools.m365_outbox_send_draft.parametersSchema);
    const expectWith = (attachment: Readonly<Record<string, unknown>>) => ({
      draftId: DRAFT_ID,
      expect: { attachments: [attachment], bcc: [], cc: [], subject: "Fixture subject", to: [] },
    });

    pipe(expectWith({ name: "fixture.pdf", sha256: digestOf(1), size: 16 }), decode, O.isSome, assertTrue);
    assertNone(decode(expectWith({ name: "fixture.pdf", size: 16 })));
  });
});
