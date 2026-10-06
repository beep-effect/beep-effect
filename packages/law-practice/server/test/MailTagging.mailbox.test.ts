/**
 * The `@beep/m365` mailbox adapter driven through a stub of the driver
 * service. Every message and address is synthetic.
 */

import {
  MailAttachmentId,
  MailMessageId,
  MasterCategoryIntent,
  MatterKey,
  matterCategoryName,
} from "@beep/law-practice-domain/values/MailTagging";
import { MailboxM365, MailboxM365Config, MailboxM365Options } from "@beep/law-practice-server/MailTagging";
import {
  DownloadAttachmentRequest,
  ListMessagesSinceRequest,
  Mailbox,
  MailPageCursor,
  MailTaggingPortError,
  SetCategoriesRequest,
} from "@beep/law-practice-use-cases/MailTagging";
import {
  GraphAttachment,
  GraphEmailAddress,
  GraphMessage,
  GraphOutlookCategory,
  GraphRecipient,
  M365AttachmentCollection,
  M365AttachmentContent,
  M365EnsuredMasterCategories,
  M365Error,
  M365MessageCollection,
} from "@beep/m365";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as N from "effect/Number";
import * as O from "effect/Option";
import { mailboxUserId, makeM365Stub, serviceOf } from "./MailTagging.adapters.fixture.ts";
import type { MailEnvelope } from "@beep/law-practice-domain/values/MailTagging";
import type { M365Shape } from "@beep/m365";

const since = DateTime.makeUnsafe("2026-07-01T00:00:00.000Z");
const messageId = MailMessageId.make("msg-1");
const nextLink = "https://graph.example.test/v1.0/users/attorney/messages?$skiptoken=page-2";

const Options = Layer.succeed(
  MailboxM365Options,
  MailboxM365Config.make({ userId: mailboxUserId, pageSize: 2, excludedFolderIds: ["folder-deleted", "folder-junk"] })
);

const mailboxOver = (overrides: Partial<M365Shape>) =>
  serviceOf(Mailbox)(MailboxM365.pipe(Layer.provide(Layer.merge(makeM365Stub(overrides), Options))));

const recipient = (address: string) =>
  GraphRecipient.make({ emailAddress: O.some(GraphEmailAddress.make({ address: O.some(address) })) });

const received = (id: string, minute: number) => ({
  id,
  receivedDateTime: O.some(`2026-07-02T09:0${minute}:00Z`),
});

const full = GraphMessage.make({
  ...received("msg-1", 1),
  subject: O.some("Office action for 16/123,456"),
  from: O.some(recipient("Notices@USPTO.gov")),
  sender: O.some(recipient("relay@example.test")),
  toRecipients: O.some([recipient("attorney@example.test"), recipient("not an address")]),
  ccRecipients: O.some([recipient("counsel@acme.example.test"), GraphRecipient.make({})]),
  categories: O.some(["Personal"]),
  changeKey: O.some("ck-1"),
  conversationId: O.some("conv-1"),
  internetMessageId: O.some("<msg-1@example.test>"),
  hasAttachments: O.some(true),
  bodyPreview: O.some("Please find the office action attached."),
  parentFolderId: O.some("folder-inbox"),
});

const bare = GraphMessage.make({
  ...received("msg-2", 2),
  sender: O.some(recipient("nobody")),
  internetMessageId: O.some("two words"),
  conversationId: O.some("two words"),
});

const outOfScope = [
  GraphMessage.make({ ...received("msg-draft", 3), isDraft: O.some(true) }),
  GraphMessage.make({ ...received("msg-deleted", 4), parentFolderId: O.some("folder-deleted") }),
  GraphMessage.make({ id: "msg-undated" }),
  GraphMessage.make({ id: "msg-misdated", receivedDateTime: O.some("the day before yesterday") }),
  GraphMessage.make({ ...received("two words", 5) }),
];

type Write = readonly [ReadonlyArray<string>, string | null];

const writeOf = (request: Parameters<M365Shape["updateMessageCategories"]>[0]): Write => [
  request.categories,
  O.getOrNull(request.changeKey),
];

const queryOf = (request: Parameters<M365Shape["listMessages"]>[0]) => ({
  userId: O.getOrNull(request.userId),
  bodyContentType: O.getOrNull(request.bodyContentType),
  filter: O.getOrNull(request.filter),
  orderby: O.getOrNull(request.orderby),
  top: O.getOrNull(request.top),
  nextLink: O.getOrNull(request.nextLink),
});

const summaryOf = (envelope: MailEnvelope) => ({
  subject: envelope.subject,
  senderAddress: O.getOrNull(envelope.senderAddress),
  recipientAddresses: envelope.recipientAddresses,
  categories: envelope.categories,
  changeKey: O.getOrNull(envelope.changeKey),
  conversationId: O.getOrNull(envelope.conversationId),
  internetMessageId: O.getOrNull(envelope.internetMessageId),
  hasAttachments: envelope.hasAttachments,
  bodyPreview: O.getOrNull(envelope.bodyPreview),
  receivedAt: DateTime.formatIso(envelope.receivedAt),
});

const status = (code: number) => M365Error.fromReason("response status", { status: code, resource: "messages" });

const portError = (error: unknown) => {
  assertInstanceOf(error, MailTaggingPortError);
  return [error.port, error.operation, error.failure, error.reason];
};

describe("MailTagging M365 mailbox", () => {
  it.effect(
    "pages ascending from the since instant, then follows the next link, and maps messages totally",
    Effect.fnUntraced(function* () {
      const requests = yield* Ref.make<ReadonlyArray<ReturnType<typeof queryOf>>>([]);
      const mailbox = yield* mailboxOver({
        listMessages: (request) =>
          Effect.as(
            Ref.update(requests, A.append(queryOf(request))),
            O.isNone(request.nextLink)
              ? M365MessageCollection.make({ value: [full, ...outOfScope, bare], "@odata.nextLink": O.some(nextLink) })
              : M365MessageCollection.make({ value: [] })
          ),
      });
      const first = yield* mailbox.listMessagesSince(ListMessagesSinceRequest.make({ since }));
      const second = yield* mailbox.listMessagesSince(ListMessagesSinceRequest.make({ since, cursor: first.next }));

      expect(yield* Ref.get(requests)).toStrictEqual([
        {
          userId: mailboxUserId,
          bodyContentType: "text",
          filter: "receivedDateTime ge 2026-07-01T00:00:00.000Z and isDraft eq false",
          orderby: "receivedDateTime asc",
          top: 2,
          nextLink: null,
        },
        { userId: mailboxUserId, bodyContentType: "text", filter: null, orderby: null, top: null, nextLink },
      ]);
      assertSome(first.next, MailPageCursor.make(nextLink));
      expect(A.map(first.envelopes, (envelope) => envelope.messageId)).toStrictEqual(["msg-1", "msg-2"]);
      expect(A.map(first.envelopes, summaryOf)).toStrictEqual([
        {
          subject: "Office action for 16/123,456",
          senderAddress: "notices@uspto.gov",
          recipientAddresses: ["attorney@example.test", "counsel@acme.example.test"],
          categories: ["Personal"],
          changeKey: "ck-1",
          conversationId: "conv-1",
          internetMessageId: "<msg-1@example.test>",
          hasAttachments: true,
          bodyPreview: "Please find the office action attached.",
          receivedAt: "2026-07-02T09:01:00.000Z",
        },
        {
          subject: "",
          senderAddress: null,
          recipientAddresses: [],
          categories: [],
          changeKey: null,
          conversationId: null,
          internetMessageId: null,
          hasAttachments: false,
          bodyPreview: null,
          receivedAt: "2026-07-02T09:02:00.000Z",
        },
      ]);
      expect(second.envelopes).toStrictEqual([]);
      assertNone(second.next);
    })
  );

  it.effect(
    "reads one envelope, answers none for a 404, and reports every other driver failure by reason and status",
    Effect.fnUntraced(function* () {
      const found = yield* mailboxOver({ getMessage: () => Effect.succeed(full) });
      const missing = yield* mailboxOver({ getMessage: () => Effect.fail(status(404)) });
      const broken = yield* mailboxOver({ getMessage: () => Effect.fail(status(500)) });
      const throttled = yield* mailboxOver({
        getMessage: () => Effect.fail(M365Error.fromReason("throttled", { status: 429, retryAfterSeconds: 30 })),
        listMessages: () => Effect.fail(M365Error.fromReason("transport", { url: "https://graph.example.test/x" })),
      });
      const envelope = yield* found.getEnvelope(messageId);

      expect(O.getOrNull(O.map(envelope, (read) => read.messageId))).toBe(messageId);
      assertNone(yield* missing.getEnvelope(messageId));
      expect(portError(yield* Effect.flip(broken.getEnvelope(messageId)))).toStrictEqual([
        "Mailbox",
        "getEnvelope",
        "unavailable",
        "response status 500",
      ]);
      expect(portError(yield* Effect.flip(throttled.getEnvelope(messageId)))).toStrictEqual([
        "Mailbox",
        "getEnvelope",
        "throttled",
        "throttled 429",
      ]);
      expect(
        portError(yield* Effect.flip(throttled.listMessagesSince(ListMessagesSinceRequest.make({ since }))))
      ).toStrictEqual(["Mailbox", "listMessagesSince", "unavailable", "transport"]);
      expect(portError(yield* Effect.flip(found.getEnvelope(MailMessageId.make("folder/msg-1"))))).toStrictEqual([
        "Mailbox",
        "getEnvelope",
        "unavailable",
        "request encoding",
      ]);
    })
  );

  it.effect(
    "writes the category list with the change key, and without one when the envelope has none",
    Effect.fnUntraced(function* () {
      const writes = yield* Ref.make<ReadonlyArray<Write>>([]);
      const mailbox = yield* mailboxOver({
        updateMessageCategories: (request) => Effect.as(Ref.update(writes, A.append(writeOf(request))), full),
      });
      yield* mailbox.setCategories(
        SetCategoriesRequest.make({
          messageId,
          expected: ["Personal"],
          categories: ["Personal", "", "P: USPTO"],
          changeKey: O.some("ck-1"),
        })
      );
      yield* mailbox.setCategories(SetCategoriesRequest.make({ messageId, expected: [], categories: ["P: USPTO"] }));

      expect(yield* Ref.get(writes)).toStrictEqual([
        [["Personal", "P: USPTO"], "ck-1"],
        [["P: USPTO"], null],
      ]);
    })
  );

  it.effect(
    "on a stale change key re-reads once and replays the caller's edit on what the message carries now",
    Effect.fnUntraced(function* () {
      const writes = yield* Ref.make<ReadonlyArray<Write>>([]);
      const fresh = yield* Ref.make(
        GraphMessage.make({
          ...received("msg-1", 1),
          categories: O.some(["Personal", "Follow up"]),
          changeKey: O.some("ck-2"),
        })
      );
      const mailbox = yield* mailboxOver({
        getMessage: () => Ref.get(fresh),
        updateMessageCategories: (request) =>
          Effect.andThen(
            Ref.update(writes, A.append(writeOf(request))),
            O.contains(request.changeKey, "ck-1") ? Effect.fail(status(412)) : Effect.succeed(full)
          ),
      });
      // The attorney dropped "Docket - unverified" and added "Follow up" after the job read the message.
      yield* mailbox.setCategories(
        SetCategoriesRequest.make({
          messageId,
          expected: ["Personal", "Docket - unverified"],
          categories: ["Personal", "Docket - unverified", "M: acme.10001"],
          changeKey: O.some("ck-1"),
        })
      );
      // An undo that removes its own tag keeps "Urgent", which the attorney added meanwhile.
      yield* Ref.set(
        fresh,
        GraphMessage.make({
          ...received("msg-1", 1),
          categories: O.some(["Personal", "M: acme.10001", "Follow up", "Urgent"]),
          changeKey: O.some("ck-3"),
        })
      );
      yield* mailbox.setCategories(
        SetCategoriesRequest.make({
          messageId,
          expected: ["Personal", "M: acme.10001", "Follow up"],
          categories: ["Personal", "Follow up"],
          changeKey: O.some("ck-1"),
        })
      );
      yield* Ref.set(fresh, GraphMessage.make({ ...received("msg-1", 1), changeKey: O.some("ck-4") }));
      yield* mailbox.setCategories(
        SetCategoriesRequest.make({ messageId, expected: [], categories: ["P: USPTO"], changeKey: O.some("ck-1") })
      );

      expect(A.filter(yield* Ref.get(writes), ([, changeKey]) => changeKey !== "ck-1")).toStrictEqual([
        [["Personal", "Follow up", "M: acme.10001"], "ck-2"],
        [["Personal", "Follow up", "Urgent"], "ck-3"],
        [["P: USPTO"], "ck-4"],
      ]);
      expect(yield* Ref.get(writes)).toHaveLength(6);
    })
  );

  it.effect(
    "fails with the typed port error on a second stale write, and when the message is gone by the re-read",
    Effect.fnUntraced(function* () {
      const calls = yield* Ref.make(0);
      const counted = <A>(effect: Effect.Effect<A, M365Error>) =>
        Effect.andThen(Ref.update(calls, N.increment), effect);
      const request = SetCategoriesRequest.make({
        messageId,
        expected: [],
        categories: ["P: USPTO"],
        changeKey: O.some("ck-1"),
      });
      const alwaysStale = yield* mailboxOver({
        getMessage: () => counted(Effect.succeed(full)),
        updateMessageCategories: () => counted(Effect.fail(status(412))),
      });
      const gone = yield* mailboxOver({
        getMessage: () => Effect.fail(status(404)),
        updateMessageCategories: () => Effect.fail(status(412)),
      });

      expect(portError(yield* Effect.flip(alwaysStale.setCategories(request)))).toStrictEqual([
        "Mailbox",
        "setCategories",
        "unavailable",
        "response status 412",
      ]);
      expect(yield* Ref.get(calls)).toBe(3);
      expect(portError(yield* Effect.flip(gone.setCategories(request)))).toStrictEqual([
        "Mailbox",
        "setCategories",
        "unavailable",
        "response status 404",
      ]);
    })
  );

  it.effect(
    "ensures master categories with their presets and answers how many were created",
    Effect.fnUntraced(function* () {
      const drafts = yield* Ref.make<ReadonlyArray<readonly [string, string]>>([]);
      const mailbox = yield* mailboxOver({
        ensureMasterCategories: (request) =>
          Effect.as(
            Ref.set(
              drafts,
              A.map(request.categories, (category) => [category.displayName, category.color] as const)
            ),
            M365EnsuredMasterCategories.make({
              created: [GraphOutlookCategory.make({ displayName: "M: acme.10001" })],
              existing: ["P: USPTO"],
            })
          ),
      });
      const created = yield* mailbox.ensureMasterCategories([
        MasterCategoryIntent.make({ displayName: "P: USPTO", color: "preset7" }),
        MasterCategoryIntent.make({ displayName: matterCategoryName(MatterKey.make("acme.10001")), color: "preset3" }),
      ]);

      expect(created).toBe(1);
      expect(yield* Ref.get(drafts)).toStrictEqual([
        ["P: USPTO", "preset7"],
        ["M: acme.10001", "preset3"],
      ]);
    })
  );

  it.effect(
    "maps attachment metadata, marking only Graph file attachments as files, and downloads bytes",
    Effect.fnUntraced(function* () {
      const mailbox = yield* mailboxOver({
        listMessageAttachments: () =>
          Effect.succeed(
            M365AttachmentCollection.make({
              value: [
                GraphAttachment.make({
                  id: "att-1",
                  "@odata.type": O.some("#microsoft.graph.fileAttachment"),
                  name: O.some("office-action.pdf"),
                  contentType: O.some("application/pdf"),
                  size: O.some(2048),
                  isInline: O.some(true),
                }),
                GraphAttachment.make({ id: "att-2", "@odata.type": O.some("#microsoft.graph.itemAttachment") }),
                GraphAttachment.make({ id: "att-3" }),
                GraphAttachment.make({ id: "two words" }),
              ],
            })
          ),
        downloadMessageAttachment: (request) =>
          Effect.succeed(
            M365AttachmentContent.make({
              bytes: new TextEncoder().encode(`${request.messageId}/${request.attachmentId}`),
            })
          ),
      });
      const metas = yield* mailbox.listAttachments(messageId);
      const bytes = yield* mailbox.downloadAttachment(
        DownloadAttachmentRequest.make({ messageId, attachmentId: MailAttachmentId.make("att-1") })
      );

      expect(
        A.map(metas, (meta) => [
          meta.attachmentId,
          meta.name,
          O.getOrNull(meta.contentType),
          meta.byteLength,
          meta.isInline,
          meta.isFile,
        ])
      ).toStrictEqual([
        ["att-1", "office-action.pdf", "application/pdf", 2048, true, true],
        ["att-2", "", null, 0, false, false],
        ["att-3", "", null, 0, false, false],
      ]);
      expect(new TextDecoder().decode(bytes)).toBe("msg-1/att-1");
    })
  );
});
