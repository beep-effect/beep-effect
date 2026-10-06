/**
 * Scripted stand-ins for the services the outbox handlers use: a recording
 * `M365` stub that stores attachment bytes the way Graph does, an in-memory
 * audit log and a synthetic attachment source.
 */
import {
  GraphAttachment,
  GraphEmailAddress,
  GraphEvent,
  GraphMessage,
  GraphRecipient,
  M365,
  M365AttachmentCollection,
  M365AttachmentContent,
  M365Error,
} from "@beep/m365";
import {
  OutboxAttachment,
  OutboxAttachmentSource,
  OutboxAuditError,
  OutboxAuditLog,
  OutboxDraftCreatedRecord,
  OutboxHandlerSettings,
} from "@beep/m365-mcp";
import { Sha256Hex } from "@beep/schema";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Context, Crypto, DateTime, Effect, Layer, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { OutboxAttachmentDigest, OutboxAuditRecord } from "@beep/m365-mcp";

export const MAILBOX = "mailbox@example.test";
export const DRAFT_ID = "draft-1";
export const EVENT_ID = "event-1";
export const SETTINGS = OutboxHandlerSettings.make({
  mailbox: MAILBOX,
  maxAttachments: 4,
  maxMessageAttachmentBytes: 1024,
});

/** Graph reports an attachment size that includes storage overhead, never the content length. */
const GRAPH_SIZE_OVERHEAD = 200;

const FILE_ATTACHMENT = "#microsoft.graph.fileAttachment";

export const digestOf = (seed: number): Sha256Hex => Sha256Hex.make(`${seed % 10}`.repeat(64));

export const sha256Of = (content: Uint8Array): Effect.Effect<Sha256Hex, never, Crypto.Crypto> =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    return Sha256Hex.make(Hex.encode(yield* Effect.orDie(crypto.digest("SHA-256", content))));
  });

export const recipients = (addresses: ReadonlyArray<string>): ReadonlyArray<GraphRecipient> =>
  A.map(addresses, (address) =>
    GraphRecipient.make({ emailAddress: O.some(GraphEmailAddress.make({ address: O.some(address) })) })
  );

export const storedDraft = GraphMessage.make({
  bccRecipients: O.some([]),
  ccRecipients: O.some(recipients(["copy@example.test"])),
  id: DRAFT_ID,
  internetMessageId: O.some("<fixture@example.test>"),
  isDraft: O.some(true),
  subject: O.some("Fixture subject"),
  toRecipients: O.some(recipients(["first@example.test"])),
  webLink: O.some("https://outlook.example.test/owa/?ItemID=draft-1"),
});

/** One attachment as the mailbox holds it. */
type StoredFile = {
  readonly content: Uint8Array;
  readonly id: string;
  readonly isInline: boolean;
  readonly name: string;
  readonly odataType: string;
  readonly reportsSize: boolean;
};

export const storedFile = (file: {
  readonly content: Uint8Array;
  readonly id?: string;
  readonly name: string;
}): StoredFile => ({
  content: file.content,
  id: file.id ?? `stored-${file.name}`,
  isInline: false,
  name: file.name,
  odataType: FILE_ATTACHMENT,
  reportsSize: true,
});

export const FIXTURE_CONTENT = new Uint8Array(16).fill(7);
export const fixtureFile = storedFile({ content: FIXTURE_CONTENT, name: "fixture.pdf" });

type WorldState = {
  readonly appendFailsFor: ReadonlyArray<OutboxAuditRecord["_tag"]>;
  readonly calls: ReadonlyArray<string>;
  readonly corruptUploads: boolean;
  readonly draft: GraphMessage;
  readonly failDownloads: boolean;
  readonly failAttachmentAt: O.Option<number>;
  readonly files: ReadonlyArray<StoredFile>;
  readonly nextId: number;
  readonly records: ReadonlyArray<OutboxAuditRecord>;
  readonly sendFailure: O.Option<M365Error>;
  readonly userIds: ReadonlyArray<O.Option<string>>;
};

const initialState: WorldState = {
  appendFailsFor: [],
  calls: [],
  corruptUploads: false,
  draft: storedDraft,
  failDownloads: false,
  failAttachmentAt: O.none(),
  files: [fixtureFile],
  nextId: 1,
  records: [],
  sendFailure: O.none(),
  userIds: [],
};

type OutboxWorldShape = {
  readonly calls: Effect.Effect<ReadonlyArray<string>>;
  readonly records: Effect.Effect<ReadonlyArray<OutboxAuditRecord>>;
  readonly script: (patch: Partial<WorldState>) => Effect.Effect<void>;
  readonly state: Ref.Ref<WorldState>;
  readonly userIds: Effect.Effect<ReadonlyArray<O.Option<string>>>;
};

export class OutboxWorld extends Context.Service<OutboxWorld, OutboxWorldShape>()(
  "@beep/m365-mcp/test/OutboxWorld.fixture/OutboxWorld"
) {}

const OutboxWorldLayer = Layer.effect(
  OutboxWorld,
  Effect.gen(function* () {
    const state = yield* Ref.make(initialState);
    return OutboxWorld.of({
      calls: Ref.get(state).pipe(Effect.map((current) => current.calls)),
      records: Ref.get(state).pipe(Effect.map((current) => current.records)),
      script: Effect.fn("OutboxWorld.script")(function* (patch) {
        yield* Ref.update(state, (current) => ({ ...current, ...patch }));
      }),
      state,
      userIds: Ref.get(state).pipe(Effect.map((current) => current.userIds)),
    });
  })
);

const notScripted = Effect.fn("OutboxWorld.notScripted")(() =>
  Effect.die(new Error("the outbox handlers must not call this verb"))
);

const corrupted = (content: Uint8Array): Uint8Array => content.map((byte, index) => (index === 0 ? byte ^ 0xff : byte));

const StubM365Layer = Layer.effect(
  M365,
  Effect.gen(function* () {
    const { state } = yield* OutboxWorld;
    const called = (name: string, request: { readonly userId: O.Option<string> }) =>
      Ref.update(state, (current) => ({
        ...current,
        calls: A.append(current.calls, name),
        userIds: A.append(current.userIds, request.userId),
      }));
    const countOf = (name: string) =>
      Ref.get(state).pipe(Effect.map((current) => A.length(A.filter(current.calls, (call) => call === name))));

    return M365.of({
      addMessageAttachment: Effect.fn("StubM365.addMessageAttachment")(function* (request) {
        const index = yield* countOf("addMessageAttachment");
        yield* called("addMessageAttachment", request);
        const current = yield* Ref.get(state);
        if (O.contains(current.failAttachmentAt, index)) {
          return yield* M365Error.fromReason("response status", { resource: "attachments", status: 413 });
        }
        const file = storedFile({
          content: current.corruptUploads ? corrupted(request.content) : request.content,
          id: `uploaded-${index + 1}`,
          name: request.name,
        });
        yield* Ref.update(state, (latest) => ({ ...latest, files: A.append(latest.files, file) }));
        return GraphAttachment.make({
          id: file.id,
          name: O.some(file.name),
          size: O.some(file.content.byteLength + GRAPH_SIZE_OVERHEAD),
        });
      }),
      // A new draft starts with no attachments.
      createDraftMessage: Effect.fn("StubM365.createDraftMessage")(function* (request) {
        yield* called("createDraftMessage", request);
        yield* Ref.update(state, (current) => ({ ...current, files: [] }));
        return GraphMessage.make({ id: DRAFT_ID, isDraft: O.some(true), webLink: storedDraft.webLink });
      }),
      createEvent: Effect.fn("StubM365.createEvent")(function* (request) {
        yield* called("createEvent", request);
        return GraphEvent.make({ id: EVENT_ID, subject: O.some(request.event.subject) });
      }),
      createMasterCategory: notScripted,
      deleteDraftMessage: Effect.fn("StubM365.deleteDraftMessage")(function* (request) {
        yield* called("deleteDraftMessage", request);
      }),
      deleteEvent: notScripted,
      deltaDriveItems: notScripted,
      downloadDriveItemContent: notScripted,
      downloadMessageAttachment: Effect.fn("StubM365.downloadMessageAttachment")(function* (request) {
        yield* called("downloadMessageAttachment", request);
        const current = yield* Ref.get(state);
        return yield* pipe(
          A.findFirst(current.files, (file) => !current.failDownloads && file.id === request.attachmentId),
          O.match({
            onNone: () =>
              Effect.fail(M365Error.fromReason("response status", { resource: "attachments", status: 404 })),
            onSome: (file) => Effect.succeed(M365AttachmentContent.make({ bytes: file.content })),
          })
        );
      }),
      ensureMasterCategories: notScripted,
      findEventsByIdempotencyKey: notScripted,
      getEvent: notScripted,
      getListItem: notScripted,
      getMailFolder: notScripted,
      getMessage: Effect.fn("StubM365.getMessage")(function* (request) {
        yield* called("getMessage", request);
        return (yield* Ref.get(state)).draft;
      }),
      getSite: notScripted,
      listDriveItemVersions: notScripted,
      listDrives: notScripted,
      listEvents: notScripted,
      listMasterCategories: notScripted,
      // Like Graph, the listing reports a size that is not the content length.
      listMessageAttachments: Effect.fn("StubM365.listMessageAttachments")(function* (request) {
        yield* called("listMessageAttachments", request);
        return M365AttachmentCollection.make({
          value: A.map((yield* Ref.get(state)).files, (file) =>
            GraphAttachment.make({
              "@odata.type": O.some(file.odataType),
              id: file.id,
              isInline: O.some(file.isInline),
              name: O.some(file.name),
              size: file.reportsSize ? O.some(file.content.byteLength + GRAPH_SIZE_OVERHEAD) : O.none(),
            })
          ),
        });
      }),
      listMessages: notScripted,
      listSites: notScripted,
      sendDraftMessage: Effect.fn("StubM365.sendDraftMessage")(function* (request) {
        yield* called("sendDraftMessage", request);
        const current = yield* Ref.get(state);
        return yield* pipe(
          current.sendFailure,
          O.match({ onNone: () => Effect.void, onSome: (error) => Effect.fail(error) })
        );
      }),
      updateEvent: Effect.fn("StubM365.updateEvent")(function* (request) {
        yield* called("updateEvent", request);
        return GraphEvent.make({ id: request.eventId });
      }),
      updateMessageCategories: notScripted,
    });
  })
);

const isDraftCreated = S.is(OutboxDraftCreatedRecord);

const StubAuditLogLayer = Layer.effect(
  OutboxAuditLog,
  Effect.gen(function* () {
    const { state } = yield* OutboxWorld;
    return OutboxAuditLog.of({
      append: Effect.fn("StubAuditLog.append")(function* (record) {
        const current = yield* Ref.get(state);
        if (A.contains(current.appendFailsFor, record._tag)) {
          return yield* OutboxAuditError.make({ message: "The audit record could not be appended.", reason: "append" });
        }
        yield* Ref.update(state, (latest) => ({ ...latest, records: A.append(latest.records, record) }));
      }),
      hasCreatedDraft: Effect.fn("StubAuditLog.hasCreatedDraft")(function* (draftId) {
        const current = yield* Ref.get(state);
        return A.some(current.records, (record) => isDraftCreated(record) && record.draftId === draftId);
      }),
      nextAuditId: Ref.modify(state, (current) => [
        `audit-${current.nextId}`,
        { ...current, nextId: current.nextId + 1 },
      ]),
    });
  })
);

/** The bytes the synthetic attachment source yields for the path at `index`. */
export const sourceContent = (index: number): Uint8Array => new Uint8Array(16).fill(index + 1);

// One synthetic 16-byte attachment per path, named by the path's last segment.
const StubAttachmentSourceLayer = Layer.effect(
  OutboxAttachmentSource,
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    return OutboxAttachmentSource.of({
      resolve: Effect.fn("StubAttachmentSource.resolve")(function* (paths) {
        return yield* Effect.forEach(paths, (path, index) =>
          sha256Of(sourceContent(index)).pipe(
            Effect.provideService(Crypto.Crypto, crypto),
            Effect.map((sha256) =>
              OutboxAttachment.make({
                content: sourceContent(index),
                contentType: "application/pdf",
                name: pipe(
                  A.last(Str.split("/")(path)),
                  O.getOrElse(() => path)
                ),
                sha256,
                size: 16,
              })
            )
          )
        );
      }),
    });
  })
);

/**
 * The scripted world: provides `OutboxWorld`, `Crypto` and the three services
 * the outbox handlers depend on.
 */
export const OutboxWorldServices = Layer.mergeAll(StubM365Layer, StubAuditLogLayer, StubAttachmentSourceLayer).pipe(
  Layer.provideMerge(Layer.mergeAll(OutboxWorldLayer, NodeCrypto.layer))
);

const FIXED_AT = DateTime.makeUnsafe("2030-01-15T12:00:00Z");

/** The record `create_draft` would have written for the stored draft. */
export const draftCreatedRecord = (attachments: ReadonlyArray<OutboxAttachmentDigest>): OutboxDraftCreatedRecord =>
  OutboxDraftCreatedRecord.make({
    at: FIXED_AT,
    attachments,
    auditId: "audit-0",
    bcc: [],
    cc: ["copy@example.test"],
    draftId: DRAFT_ID,
    subject: "Fixture subject",
    to: ["first@example.test"],
  });
