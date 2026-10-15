import {
  GraphAttachment,
  GraphMessage,
  M365,
  M365AttachmentContent,
  M365Error,
  OutlookItemRef,
  OutlookItemRefFromInput,
} from "@beep/m365";
import {
  DrawingIntake,
  DrawingIntakeError,
  DrawingsCommandError,
  drawingIntakeLaneLayer,
  drawingsCommand,
  IntakePick,
  IntakePickFromString,
  IntakeRecord,
  IntakeRequest,
  runDrawingIntake,
} from "@beep/repo-cli/commands/Drawings";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe } from "@effect/vitest";
import {
  assertFalse,
  assertInclude,
  assertInstanceOf,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
  strictEqual,
} from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { M365ListMessagesRequest } from "@beep/m365";

// Every message, address, id and byte below is synthetic.
const MAILBOX = "drawings@example.test";
const CONVERSATION = "AAQkConv1";
const SUBJECT = "Synthetic round two sheets";
const SENDER = "reviewer@example.test";
const NEXT_PAGE = "https://graph.microsoft.com/v1.0/users/drawings@example.test/messages?$skiptoken=page2";
// A listing that never ends: every page of it links to another.
const CAPPED_PAGE = "https://graph.microsoft.com/v1.0/users/drawings@example.test/messages?$skiptoken=capped";
const encoder = new TextEncoder();

const REVIEWER_RAW = "Reviewer@Example.test";
// The mailbox's own address in another case, as Sent Items reports it.
const OWN_RAW = "Drawings@Example.test";
const X500_SENDER =
  "/O=EXCHANGELABS/OU=EXCHANGE ADMINISTRATIVE GROUP (FYDIBOHF23SPDLT)/CN=RECIPIENTS/CN=SYNTHETIC-REVIEWER";

const message = (id: string, conversationId: string, receivedDateTime: string, address = REVIEWER_RAW) => ({
  id,
  conversationId,
  receivedDateTime,
  internetMessageId: `<${id}@mail.example.test>`,
  subject: SUBJECT,
  from: { emailAddress: { name: "Sender", address } },
});

const MESSAGES: Readonly<Record<string, unknown>> = {
  AAMkMsgOld: message("AAMkMsgOld", CONVERSATION, "2026-10-09T10:00:00Z"),
  AAMkMsgNew: message("AAMkMsgNew", CONVERSATION, "2026-10-10T12:00:00Z"),
  // Newer than the reviewer's reply: our own sheet delivery in Sent Items, and a pending outbox draft.
  AAMkMsgOwn: message("AAMkMsgOwn", CONVERSATION, "2026-10-11T09:00:00Z", OWN_RAW),
  AAMkMsgDraft: {
    id: "AAMkMsgDraft",
    conversationId: CONVERSATION,
    isDraft: true,
    subject: SUBJECT,
    sender: { emailAddress: { address: MAILBOX } },
    receivedDateTime: "2026-10-12T09:00:00Z",
  },
  AAMkMsgSolo: message("AAMkMsgSolo", "PlainConv2", "2026-10-08T08:00:00Z"),
  AAQkMsgShaped: message("AAQkMsgShaped", "OtherConv", "2026-10-07T08:00:00Z"),
  AAMkOnlyOwn: message("AAMkOnlyOwn", "OwnConv", "2026-10-06T08:00:00Z", OWN_RAW),
  AAMkOnlyDraft: { id: "AAMkOnlyDraft", conversationId: "DraftConv", isDraft: true, subject: SUBJECT },
  // A conversation-shaped message id whose conversation listing Graph refuses.
  AAQkMsgBadList: message("AAQkMsgBadList", "OtherConv", "2026-10-05T08:00:00Z"),
  // No sender at all.
  AAMkMsgAnon: { id: "AAMkMsgAnon", subject: SUBJECT },
  // An internal sender Graph reports as an Exchange X500 address, with no Message-ID or receipt time.
  AAMkMsgX500: {
    id: "AAMkMsgX500",
    subject: SUBJECT,
    from: { emailAddress: { name: "Reviewer", address: X500_SENDER } },
  },
};

const CONTENT: Readonly<Record<string, string>> = {
  fig1: "synthetic sheet one",
  sheet2: "synthetic sheet two",
  escape: "synthetic escape attempt",
  old1: "synthetic sheet one",
  oldCopy: "synthetic sheet one",
  shaped: "synthetic shaped",
  own: "synthetic outbound sheet",
  draft: "synthetic draft sheet",
  x500: "synthetic internal sheet",
};

const file = (id: string, name: string, declared = true) => ({
  id,
  "@odata.type": "#microsoft.graph.fileAttachment",
  name,
  contentType: "application/pdf",
  isInline: false,
  ...(declared ? { size: encoder.encode(CONTENT[id] ?? "").byteLength } : {}),
});

const ATTACHMENTS: Readonly<Record<string, ReadonlyArray<unknown>>> = {
  AAMkMsgNew: [
    file("fig1", "Fig1.pdf"),
    file("sheet2", "Sheet 2.pdf", false),
    {
      id: "inline",
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: "image\u001b[2J\u001b[H.png",
      isInline: true,
      size: 9,
    },
    { id: "item", "@odata.type": "#microsoft.graph.itemAttachment", name: "Forwarded", size: 99 },
    file("escape", "../evil/name.pdf"),
  ],
  AAMkMsgOld: [file("old1", "Fig1.pdf"), file("oldCopy", "Copy of Fig1.pdf")],
  AAQkMsgShaped: [file("shaped", "shaped.pdf")],
  AAMkMsgOwn: [file("own", "Outbound.pdf")],
  AAMkMsgDraft: [file("draft", "Draft.pdf")],
  AAMkMsgX500: [file("x500", "Internal.pdf")],
};

const unused = Effect.fnUntraced(function* () {
  return yield* Effect.die("not used by drawings intake");
});

const notFound = (status: number) =>
  M365Error.failEffectFromReason("response status", { status, resource: "messages" });

const decodeMessage = S.decodeUnknownEffect(GraphMessage);
const decodeAttachments = S.decodeUnknownEffect(S.Array(GraphAttachment));
const page = (value: ReadonlyArray<GraphMessage>, nextLink: O.Option<string>) => ({
  "@odata.context": O.none(),
  "@odata.count": O.none(),
  "@odata.deltaLink": O.none(),
  "@odata.nextLink": nextLink,
  value,
});

const conversationPage = (ids: ReadonlyArray<string>, nextLink: O.Option<string>) =>
  Effect.map(
    Effect.forEach(ids, (id) => decodeMessage(MESSAGES[id])),
    (value) => page(value, nextLink)
  );
const cappedPage = Effect.succeed(page([], O.some(CAPPED_PAGE)));
const emptyPage = Effect.succeed(page([], O.none()));
type Listing = Effect.Effect<ReturnType<typeof page>, M365Error | S.SchemaError>;

// what the fake mailbox answers for each conversation filter
const FILTER_LISTINGS: HashMap.HashMap<string, Listing> = HashMap.make(
  [`conversationId eq '${CONVERSATION}'`, conversationPage(["AAMkMsgOld"], O.some(NEXT_PAGE))],
  ["conversationId eq 'AAQkCapped'", cappedPage],
  ["conversationId eq 'PlainConv2'", conversationPage(["AAMkMsgSolo"], O.none())],
  ["conversationId eq 'OwnConv'", conversationPage(["AAMkOnlyOwn"], O.none())],
  ["conversationId eq 'DraftConv'", conversationPage(["AAMkOnlyDraft"], O.none())],
  ["conversationId eq 'AAQkMsgBadList'", notFound(400)],
  ["conversationId eq 'AAQkGone'", notFound(404)],
  ["conversationId eq 'AAMkBadFilter'", notFound(400)]
);
// a capped listing keeps paging to itself; any other next link is the conversation's second page
const PAGE_LISTINGS: HashMap.HashMap<string, Listing> = HashMap.make([CAPPED_PAGE, cappedPage]);
const secondPage: Listing = conversationPage(["AAMkMsgNew", "AAMkMsgDraft", "AAMkMsgOwn"], O.none());

const listing = (request: M365ListMessagesRequest): Listing =>
  O.match(request.nextLink, {
    onNone: () =>
      pipe(
        request.filter,
        O.flatMap((filter) => HashMap.get(FILTER_LISTINGS, filter)),
        O.getOrElse(() => emptyPage)
      ),
    onSome: (link) => O.getOrElse(HashMap.get(PAGE_LISTINGS, link), () => secondPage),
  });

const FakeM365 = Layer.succeed(
  M365,
  M365.of({
    addMessageAttachment: unused,
    createDraftMessage: unused,
    createEvent: unused,
    createMasterCategory: unused,
    deleteDraftMessage: unused,
    deleteEvent: unused,
    deltaDriveItems: unused,
    downloadDriveItemContent: unused,
    downloadMessageAttachment: Effect.fnUntraced(function* (request) {
      return M365AttachmentContent.make({ bytes: encoder.encode(CONTENT[request.attachmentId] ?? "") });
    }),
    ensureMasterCategories: unused,
    findEventsByIdempotencyKey: unused,
    getEvent: unused,
    getListItem: unused,
    getMailFolder: unused,
    getMessage: Effect.fnUntraced(function* (request) {
      const found = MESSAGES[request.messageId];
      if (found === undefined) {
        return yield* notFound(Str.startsWith("AAQk")(request.messageId) ? 400 : 404);
      }
      return yield* decodeMessage(found).pipe(Effect.orDie);
    }),
    getMessageAuthoredText: unused,
    getSite: unused,
    listDriveItemVersions: unused,
    listDrives: unused,
    listEvents: unused,
    listMasterCategories: unused,
    listMessageAttachments: Effect.fnUntraced(function* (request) {
      const value = yield* decodeAttachments(ATTACHMENTS[request.messageId] ?? []).pipe(Effect.orDie);
      return {
        "@odata.context": O.none(),
        "@odata.count": O.none(),
        "@odata.deltaLink": O.none(),
        "@odata.nextLink": O.none(),
        value,
      };
    }),
    listMessages: Effect.fnUntraced(function* (request) {
      return yield* listing(request).pipe(Effect.catchTag("SchemaError", Effect.die));
    }),
    listSites: unused,
    sendDraftMessage: unused,
    updateEvent: unused,
    updateMessageCategories: unused,
  })
);

const sha256Of = S.decodeEffect(Sha256HexFromBytes);
const decodeRecord = S.decodeUnknownEffect(S.fromJsonString(IntakeRecord));

const corpus = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  return { root, out: path.join(root, "matter", "inputs", "round-2") };
});

const listOut = Effect.fnUntraced(function* (out: string) {
  const fs = yield* FileSystem.FileSystem;
  return A.sort(yield* fs.readDirectory(out), Order.String);
});

const pullWith = (fields: {
  readonly ref: OutlookItemRef;
  readonly outDir: string;
  readonly corpusRoot: string;
  readonly pick?: number;
  readonly maxBytes?: number;
  readonly includeOwn?: boolean;
}) =>
  DrawingIntake.use((intake) =>
    intake.pull(
      IntakeRequest.make({
        ref: fields.ref,
        mailbox: MAILBOX,
        outDir: fields.outDir,
        corpusRoot: fields.corpusRoot,
        ...(fields.pick === undefined ? {} : { pick: fields.pick }),
        ...(fields.maxBytes === undefined ? {} : { maxBytes: fields.maxBytes }),
        ...(fields.includeOwn === undefined ? {} : { includeOwn: fields.includeOwn }),
      })
    )
  );

const conversation = OutlookItemRef.cases.conversation.make({ id: CONVERSATION });

const ServiceLayer = DrawingIntake.layer.pipe(Layer.provide(FakeM365), Layer.provideMerge(NodeServices.layer));

describe("DrawingIntake over a fake mailbox", () => {
  it.layer(ServiceLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "saves the newest reviewer message of a conversation, skips inline and item attachments, and records sha256",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, out } = yield* corpus();
        const result = yield* pullWith({ ref: conversation, outDir: out, corpusRoot: root });
        const { record } = result;
        assertSome(result.conversationSize, 2);
        strictEqual(result.setAside, 2);
        strictEqual(record.message.messageId, "AAMkMsgNew");
        assertSome(record.message.from, REVIEWER_RAW);
        assertSome(O.map(record.message.fromEmail, String), SENDER);
        assertSome(record.message.internetMessageId, "<AAMkMsgNew@mail.example.test>");
        deepStrictEqual(
          A.map(record.attachments, (row) => row.outcome),
          ["saved", "saved", "skipped-inline", "skipped-item", "saved"]
        );
        deepStrictEqual(
          A.map(record.attachments, (row) => row.savedAs),
          [O.some("Fig1.pdf"), O.some("Sheet 2.pdf"), O.none(), O.none(), O.some("_evil_name.pdf")]
        );
        deepStrictEqual(yield* listOut(out), ["Fig1.pdf", "Sheet 2.pdf", "_evil_name.pdf", "intake.json"]);
        strictEqual(result.recordPath, path.join(yield* fs.realPath(out), "intake.json"));
        const written = yield* decodeRecord(yield* fs.readFileString(result.recordPath));
        strictEqual(written.schemaVersion, "drawing-intake/v1");
        const fig1 = yield* fs.readFile(path.join(out, "Fig1.pdf"));
        assertSome(written.attachments[0]?.sha256 ?? O.none(), yield* sha256Of(fig1));
        assertNone(written.attachments[2]?.sha256 ?? O.some("unexpected"));
        strictEqual(written.attachments[2]?.name, "image\u001b[2J\u001b[H.png");
      })
    );

    it.effect(
      "pulls the n-th newest with --pick and dedupes by sha256 without overwriting",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, out } = yield* corpus();
        yield* pullWith({ ref: conversation, outDir: out, corpusRoot: root });
        const before = yield* fs.readFile(path.join(out, "Fig1.pdf"));
        const second = yield* pullWith({ ref: conversation, outDir: out, corpusRoot: root, pick: 2 });
        strictEqual(second.record.message.messageId, "AAMkMsgOld");
        deepStrictEqual(
          A.map(second.record.attachments, (row) => [row.outcome, row.savedAs, row.duplicateOf]),
          [
            ["unchanged", O.some("Fig1.pdf"), O.none()],
            ["duplicate", O.none(), O.some("Fig1.pdf")],
          ]
        );
        assertTrue(Str.endsWith("intake-2.json")(second.recordPath));
        deepStrictEqual(yield* fs.readFile(path.join(out, "Fig1.pdf")), before);
        const error = yield* Effect.flip(pullWith({ ref: conversation, outDir: out, corpusRoot: root, pick: 3 }));
        strictEqual(error.reason, "refused");
        assertInclude(error.message, "--pick 3 is out of range");
      })
    );

    it.effect(
      "sets drafts aside always and the mailbox's own mail unless included",
      Effect.fnUntraced(function* () {
        const { root, out } = yield* corpus();
        const own = yield* pullWith({ ref: conversation, outDir: out, corpusRoot: root, includeOwn: true });
        strictEqual(own.record.message.messageId, "AAMkMsgOwn");
        assertSome(own.conversationSize, 3);
        strictEqual(own.setAside, 1);
        deepStrictEqual(
          A.map(own.record.attachments, (row) => row.savedAs),
          [O.some("Outbound.pdf")]
        );
        const onlyOwn = yield* Effect.flip(
          pullWith({ ref: OutlookItemRef.cases.conversation.make({ id: "OwnConv" }), outDir: out, corpusRoot: root })
        );
        strictEqual(onlyOwn.reason, "refused");
        assertInclude(onlyOwn.message, "--include-own");
        const included = yield* pullWith({
          ref: OutlookItemRef.cases.conversation.make({ id: "OwnConv" }),
          outDir: out,
          corpusRoot: root,
          includeOwn: true,
        });
        strictEqual(included.record.message.messageId, "AAMkOnlyOwn");
        const onlyDraft = yield* Effect.flip(
          pullWith({
            ref: OutlookItemRef.cases.conversation.make({ id: "DraftConv" }),
            outDir: out,
            corpusRoot: root,
            includeOwn: true,
          })
        );
        strictEqual(onlyDraft.reason, "refused");
        assertInclude(onlyDraft.message, "all drafts; nothing to pull.");
      })
    );

    it.effect(
      "pulls a message whose sender is an Exchange X500 address and that has no Message-ID",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { root, out } = yield* corpus();
        const result = yield* pullWith({
          ref: OutlookItemRef.cases.message.make({ id: "AAMkMsgX500" }),
          outDir: out,
          corpusRoot: root,
        });
        assertSome(result.record.message.from, X500_SENDER);
        assertNone(result.record.message.fromEmail);
        assertNone(result.record.message.internetMessageId);
        assertNone(result.record.message.receivedAt);
        deepStrictEqual(yield* listOut(out), ["Internal.pdf", "intake.json"]);
        const written = yield* decodeRecord(yield* fs.readFileString(result.recordPath));
        assertNone(written.message.internetMessageId);
        const anonymous = yield* pullWith({
          ref: OutlookItemRef.cases.message.make({ id: "AAMkMsgAnon" }),
          outDir: out,
          corpusRoot: root,
        });
        assertNone(anonymous.record.message.from);
        assertNone(anonymous.record.message.fromEmail);
      })
    );

    it.effect(
      "gives new bytes under a taken name a short-hash name and leaves the old file alone",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, out } = yield* corpus();
        yield* fs.makeDirectory(out, { recursive: true });
        yield* fs.writeFileString(path.join(out, "Fig1.pdf"), "an earlier, different sheet");
        yield* fs.makeDirectory(path.join(out, "notes"));
        const { record } = yield* pullWith({ ref: conversation, outDir: out, corpusRoot: root });
        const saved = O.getOrElse(record.attachments[0]?.savedAs ?? O.none(), () => "");
        assertTrue(/^Fig1 \([0-9a-f]{8}\)\.pdf$/.test(saved));
        strictEqual(yield* fs.readFileString(path.join(out, "Fig1.pdf")), "an earlier, different sheet");
      })
    );

    it.effect(
      "refuses a conversation still paging at the page cap instead of picking from a cut-off listing",
      Effect.fnUntraced(function* () {
        const { root, out } = yield* corpus();
        const error = yield* Effect.flip(
          pullWith({ ref: OutlookItemRef.cases.conversation.make({ id: "AAQkCapped" }), outDir: out, corpusRoot: root })
        );
        assertInstanceOf(error, DrawingIntakeError);
        strictEqual(error.reason, "refused");
        assertInclude(error.message, "more than 1000 messages");
      })
    );

    it.effect(
      "falls back between message and conversation, and reports a refused listing instead of not-found",
      Effect.fnUntraced(function* () {
        const { root, out } = yield* corpus();
        const viaConversation = yield* pullWith({
          ref: OutlookItemRef.cases.message.make({ id: "PlainConv2" }),
          outDir: out,
          corpusRoot: root,
        });
        strictEqual(viaConversation.record.message.messageId, "AAMkMsgSolo");
        assertSome(viaConversation.conversationSize, 1);
        const viaMessage = yield* pullWith({
          ref: OutlookItemRef.cases.conversation.make({ id: "AAQkMsgShaped" }),
          outDir: out,
          corpusRoot: root,
        });
        strictEqual(viaMessage.record.message.messageId, "AAQkMsgShaped");
        assertNone(viaMessage.conversationSize);
        const missing = yield* Effect.flip(
          pullWith({ ref: OutlookItemRef.cases.message.make({ id: "AAMkBadFilter" }), outDir: out, corpusRoot: root })
        );
        assertInstanceOf(missing, DrawingIntakeError);
        strictEqual(missing.reason, "mail");
        assertInclude(missing.message, "Could not list the conversation's messages (response status 400)");
        const absent = yield* Effect.flip(
          pullWith({ ref: OutlookItemRef.cases.message.make({ id: "AAMkNowhere" }), outDir: out, corpusRoot: root })
        );
        strictEqual(absent.reason, "not-found");
        const refusedListing = yield* pullWith({
          ref: OutlookItemRef.cases.conversation.make({ id: "AAQkMsgBadList" }),
          outDir: out,
          corpusRoot: root,
        });
        strictEqual(refusedListing.record.message.messageId, "AAQkMsgBadList");
        const gone = yield* Effect.flip(
          pullWith({ ref: OutlookItemRef.cases.conversation.make({ id: "AAQkGone" }), outDir: out, corpusRoot: root })
        );
        strictEqual(gone.reason, "not-found");
      })
    );

    it.effect(
      "refuses an out directory outside the corpus root, the root itself, or one reached through a symlink",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root } = yield* corpus();
        const elsewhere = yield* fs.makeTempDirectoryScoped();
        const outside = yield* Effect.flip(
          pullWith({ ref: conversation, outDir: path.join(elsewhere, "in"), corpusRoot: root })
        );
        strictEqual(outside.reason, "refused");
        assertInclude(outside.message, "is not under the corpus root");
        const itself = yield* Effect.flip(pullWith({ ref: conversation, outDir: root, corpusRoot: root }));
        strictEqual(itself.reason, "refused");
        yield* fs.symlink(elsewhere, path.join(root, "link"));
        const linked = yield* Effect.flip(
          pullWith({ ref: conversation, outDir: path.join(root, "link", "in"), corpusRoot: root })
        );
        strictEqual(linked.reason, "refused");
        assertInclude(linked.message, "resolves outside the corpus root");
        deepStrictEqual(yield* listOut(elsewhere), []);
        yield* fs.symlink(root, path.join(root, "self"));
        const rooted = yield* Effect.flip(
          pullWith({ ref: conversation, outDir: path.join(root, "self"), corpusRoot: root })
        );
        assertInclude(rooted.message, "resolves to the corpus root itself");
      })
    );

    it.effect(
      "skips attachments over the size limit, declared or downloaded",
      Effect.fnUntraced(function* () {
        const { root, out } = yield* corpus();
        const { record } = yield* pullWith({ ref: conversation, outDir: out, corpusRoot: root, maxBytes: 5 });
        deepStrictEqual(
          A.map(record.attachments, (row) => row.outcome),
          ["skipped-oversize", "skipped-oversize", "skipped-inline", "skipped-item", "skipped-oversize"]
        );
        deepStrictEqual(yield* listOut(out), ["intake.json"]);
      })
    );
  });
});

// Synthetic lane settings; none of these is a real tenant, application or key.
const laneEnv = (overrides: Record<string, string> = {}) =>
  ConfigProvider.layer(
    ConfigProvider.fromEnv({
      env: {
        INTAKE_TEST_TENANT_ID: "00000000-0000-0000-0000-000000000001",
        INTAKE_TEST_CLIENT_ID: "00000000-0000-0000-0000-000000000002",
        INTAKE_TEST_CERT_THUMBPRINT_SHA256: "AB12CD34".repeat(8),
        INTAKE_TEST_CERT_PRIVATE_KEY: "synthetic-private-key-text",
        INTAKE_TEST_MAILBOX: MAILBOX,
        ...overrides,
      },
    })
  );

const laneLayer = (overrides: Record<string, string> = {}) =>
  drawingIntakeLaneLayer({ envPrefix: "INTAKE_TEST", mailLayer: () => FakeM365 }).pipe(
    Layer.provide(laneEnv(overrides)),
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, TestConsole.layer))
  );

const logged = TestConsole.logLines.pipe(Effect.map((lines) => A.join(A.map(lines, String), "\n")));

describe("beep drawings intake", () => {
  it.effect(
    "decodes a pasted Outlook link whose id carries %2B, %2F and %3D",
    Effect.fnUntraced(function* () {
      const ref = yield* S.decodeEffect(OutlookItemRefFromInput)(
        "https://outlook.cloud.microsoft/mail/inbox/id/AAQkAGI2%2BQx%2FZz%3D"
      );
      deepStrictEqual(ref, OutlookItemRef.cases.conversation.make({ id: "AAQkAGI2_Qx-Zz=" }));
    })
  );

  it.layer(laneLayer(), { timeout: "30 seconds" })((it) => {
    it.effect(
      "pulls through the lane and prints names, sizes and sha256 but never the subject or sender",
      Effect.fnUntraced(function* () {
        const { root, out } = yield* corpus();
        yield* runDrawingIntake({
          message: `https://outlook.cloud.microsoft/mail/inbox/id/${CONVERSATION}`,
          mailbox: O.none(),
          out,
          corpusRoot: root,
          pick: "latest",
          includeOwn: false,
        });
        const output = yield* logged;
        assertInclude(output, "intake: 5 attachment(s)");
        assertInclude(output, "--pick chose among 2 message(s), newest first (2 draft or own message(s) set aside)");
        assertInclude(output, "Fig1.pdf  19 bytes  sha256 ");
        assertInclude(output, "skipped-inline");
        assertInclude(output, "image�[2J�[H.png");
        assertFalse(Str.includes("\u001b")(output));
        assertInclude(output, "record: ");
        assertFalse(Str.includes(SUBJECT)(output));
        assertFalse(Str.includes(SENDER)(output));
      })
    );

    it.effect(
      "refuses a bad --message, --pick or --mailbox before any mail call",
      Effect.fnUntraced(function* () {
        const { root, out } = yield* corpus();
        const base = {
          message: CONVERSATION,
          mailbox: O.none(),
          out,
          corpusRoot: root,
          pick: "latest",
          includeOwn: false,
        };
        const badMessage = yield* Effect.flip(runDrawingIntake({ ...base, message: "two words" }));
        assertInstanceOf(badMessage, DrawingsCommandError);
        const badPick = yield* Effect.flip(runDrawingIntake({ ...base, pick: "0" }));
        assertInclude(badPick.message, "--pick");
        const badMailbox = yield* Effect.flip(runDrawingIntake({ ...base, mailbox: O.some("../users") }));
        assertInclude(badMailbox.message, "--mailbox");
        const outside = yield* Effect.flip(runDrawingIntake({ ...base, corpusRoot: out, out: root }));
        assertInclude(outside.message, "is not under the corpus root");
      })
    );
  });

  it.layer(Layer.mergeAll(NodeServices.layer, TestConsole.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "the lane refuses an unresolved op:// value and names only the setting",
      Effect.fnUntraced(function* () {
        const error = yield* Effect.flip(
          laneLayer({ INTAKE_TEST_CLIENT_ID: "op://Synthetic/Item/client id" }).pipe(Layer.build)
        );
        assertInstanceOf(error, DrawingsCommandError);
        assertInclude(error.message, "INTAKE_TEST_CLIENT_ID is an unresolved 1Password reference");
        assertFalse(Str.includes("Synthetic")(error.message));
      })
    );

    it.effect(
      "the command loads <PREFIX>_* settings and stops when they are missing",
      Effect.fnUntraced(function* () {
        const { root, out } = yield* corpus();
        const error = yield* Effect.flip(
          Command.runWith(drawingsCommand, { version: "0.0.0" })([
            "intake",
            "--message",
            CONVERSATION,
            "--out",
            out,
            "--corpus-root",
            root,
            "--env-prefix",
            "BEEP_INTAKE_TEST_UNSET",
          ])
        );
        assertInstanceOf(error, DrawingsCommandError);
        assertInclude(error.message, "BEEP_INTAKE_TEST_UNSET_TENANT_ID is not set");
      })
    );
  });

  // An empty environment, so the default prefix can never reach a live registration.
  const emptyEnv = ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }));
  it.layer(Layer.mergeAll(NodeServices.layer, TestConsole.layer, emptyEnv), { timeout: "30 seconds" })((it) => {
    it.effect(
      "the command defaults to the docket-intake registration (Mail.ReadWrite, no Mail.Send)",
      Effect.fnUntraced(function* () {
        const { root, out } = yield* corpus();
        const error = yield* Effect.flip(
          Command.runWith(drawingsCommand, { version: "0.0.0" })([
            "intake",
            "--message",
            CONVERSATION,
            "--out",
            out,
            "--corpus-root",
            root,
          ])
        );
        assertInstanceOf(error, DrawingsCommandError);
        assertInclude(error.message, "CLOUD_M365_DOCKET_TENANT_ID is not set");
      })
    );
  });
});

describe("drawing intake codecs", () => {
  it.effect.prop(
    "round-trips arbitrary intake records through their JSON codec",
    [Arbitrary.schema(IntakeRecord)],
    Effect.fnUntraced(function* ([record]) {
      const json = S.fromJsonString(IntakeRecord);
      const decoded = yield* S.decodeEffect(json)(yield* S.encodeEffect(json)(record));
      assertTrue(S.toEquivalence(IntakeRecord)(record, decoded));
    }),
    { arbitrary: { runs: 25 } }
  );

  it.effect.prop(
    "round-trips arbitrary picks through the --pick text codec",
    [Arbitrary.schema(IntakePick)],
    Effect.fnUntraced(function* ([pick]) {
      const decoded = yield* S.decodeEffect(IntakePickFromString)(yield* S.encodeEffect(IntakePickFromString)(pick));
      strictEqual(decoded, pick);
    }),
    { arbitrary: { runs: 50 } }
  );
});
