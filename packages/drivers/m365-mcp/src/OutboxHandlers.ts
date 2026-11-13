/**
 * Tool handlers of the Microsoft 365 outbox server.
 *
 * **Details**
 *
 * The handlers compose the `@beep/m365` driver's app-only verbs with the
 * attachment source, the basis reader, the send guard, the event update
 * guard and the audit log. A draft's pins are read and checked against the
 * caller's view before the draft is created, and rechecked whenever it is
 * read. Draft sending is fail-closed
 * until a Graph operation can bind the sent content to the checked
 * snapshot. An event is updated
 * only when this server recorded creating it and it has no attendee, because
 * Graph mails a meeting's attendees when it changes. The send guard sees
 * the stored attachments as they are: each one is downloaded and hashed on
 * every read and every send. Spans carry
 * counts and outcomes only: never an address, a subject, a body, a file name
 * or a path.
 *
 * @category handlers
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import {
  GraphPathSegment,
  M365,
  M365AddMessageAttachmentRequest,
  M365CreateDraftMessageRequest,
  M365CreateEventRequest,
  M365DeleteDraftMessageRequest,
  M365EventPatch,
  M365GetEventRequest,
  M365GetMailFolderRequest,
  M365GetMessageRequest,
  M365IdempotencyKey,
  M365ListMessagesRequest,
  M365MailBody,
  M365MailDraft,
  M365UpdateEventRequest,
  M365UpdateMessageCategoriesRequest,
} from "@beep/m365";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { odataEquals } from "./internal/ODataFilter.ts";
import {
  OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES,
  OUTBOX_DEFAULT_MAX_ATTACHMENTS,
  OutboxAttachmentSource,
} from "./OutboxAttachmentSource.ts";
import {
  OutboxAuditLog,
  OutboxDraftBasisClearedRecord,
  OutboxDraftBasisMarkedRecord,
  OutboxDraftClosedRecord,
  OutboxDraftCreatedRecord,
  OutboxDraftDeletedRecord,
  OutboxDraftIdentifiedRecord,
  OutboxEventCreatedRecord,
  OutboxEventUpdatedRecord,
  OutboxSendOutcomeRecord,
} from "./OutboxAuditLog.ts";
import { makeBasisReport, OutboxBasisStatus } from "./OutboxBasis.ts";
import { OutboxBasisReader } from "./OutboxBasisReader.ts";
import { checkEventUpdate, OutboxEventUpdateCheck, storedAttendeeCount } from "./OutboxEventGuard.ts";
import { checkSendExpectation, OutboxSendCheck, sameAttachments, storedRecipientAddresses } from "./OutboxSendGuard.ts";
import { OutboxStoredAttachmentsRequest, readStoredAttachments } from "./OutboxStoredAttachments.ts";
import {
  OUTBOX_BASIS_STALE_CATEGORY,
  OutboxDraftCheck,
  OutboxDraftClosed,
  OutboxDraftCreated,
  OutboxDraftRef,
  OutboxDraftsChecked,
  OutboxDraftUnreadable,
  OutboxDraftView,
  OutboxEventCreated,
  OutboxEventUpdated,
  OutboxSendResult,
  OutboxToolError,
  OutboxToolkit,
} from "./OutboxTools.ts";
import type { GraphMessage, M365Error, M365EventDraft } from "@beep/m365";
import type * as Tool from "effect/ai/Tool";
import type * as Layer from "effect/Layer";
import type { OutboxAttachmentError } from "./OutboxAttachmentSource.ts";
import type {
  OutboxAuditError,
  OutboxDraftClosedReason,
  OutboxOpenDraft,
  OutboxSendOutcome,
} from "./OutboxAuditLog.ts";
import type {
  OutboxBasisChangedField,
  OutboxBasisError,
  OutboxBasisReport,
  OutboxBasisVerdict,
} from "./OutboxBasis.ts";
import type { OutboxEventUpdateRefusalReason } from "./OutboxEventGuard.ts";
import type { OutboxSendMismatchField } from "./OutboxSendGuard.ts";
import type { OutboxStoredAttachmentError } from "./OutboxStoredAttachments.ts";
import type {
  OutboxCreateDraftParams,
  OutboxDraftMarkOutcome,
  OutboxSendDraftParams,
  OutboxUpdateEventParams,
} from "./OutboxTools.ts";

const $I = $M365McpId.create("OutboxHandlers");

const NOT_FOUND_STATUS = 404;

// A refusal the handlers raise themselves, before or after a driver call.
class OutboxRefusal extends S.TaggedError<OutboxRefusal, { readonly brand: unique symbol }>($I`OutboxRefusal`)(
  "OutboxRefusal",
  {
    message: S.String,
    reason: S.String,
  },
  $I.annoteError<OutboxRefusal>("OutboxRefusal", {
    description: "A refusal raised by an outbox tool handler itself.",
  })
) {}

type OutboxFailure =
  | M365Error
  | OutboxAttachmentError
  | OutboxAuditError
  | OutboxBasisError
  | OutboxRefusal
  | OutboxStoredAttachmentError;

const isRetryableM365Error = (error: M365Error): boolean =>
  error.reason === "throttled" || error.reason === "transport";

const driverMessage = (operation: string, error: M365Error): string =>
  error.reason === "ambiguous write"
    ? `Microsoft 365 ${operation} may or may not have happened (ambiguous write). Check the mailbox before trying again.`
    : error.reason === "response status" && O.contains(error.status, NOT_FOUND_STATUS)
      ? `Microsoft 365 ${operation} failed: no such item in the mailbox. A draft that was sent or deleted is no longer there.`
      : `Microsoft 365 ${operation} failed: ${error.reason}`;

const toOutboxToolError = (toolName: string, operation: string, retryableWhenTransient: boolean) =>
  Match.type<OutboxFailure>().pipe(
    Match.tag("M365Error", (error) =>
      OutboxToolError.make({
        message: driverMessage(operation, error),
        operation,
        reason: O.some(error.reason),
        retryable: retryableWhenTransient && isRetryableM365Error(error),
        toolName,
      })
    ),
    Match.orElse((error) =>
      OutboxToolError.make({
        message: error.message,
        operation,
        reason: O.some(error.reason),
        retryable: false,
        toolName,
      })
    )
  );

const finalizeOutboxTool =
  (toolName: string, operation: string, retryableWhenTransient = true) =>
  <A2, R>(effect: Effect.Effect<A2, OutboxFailure, R>): Effect.Effect<A2, OutboxToolError, R> =>
    effect.pipe(Effect.mapError(toOutboxToolError(toolName, operation, retryableWhenTransient)));

const refuse = (reason: string, message: string): Effect.Effect<never, OutboxRefusal> =>
  Effect.fail(OutboxRefusal.make({ message, reason }));

const completedWithoutAudit = (what: string) => (): OutboxRefusal =>
  OutboxRefusal.make({
    message: `${what}, but its audit record could not be written. Do not repeat the call.`,
    reason: "audit",
  });

const EVENT_UPDATE_REFUSAL_MESSAGE: Readonly<Record<OutboxEventUpdateRefusalReason, string>> = {
  "has-attendees":
    "The event has attendees, and Microsoft 365 mails them when it changes, so it was not updated. This server sends mail only through m365_outbox_send_draft.",
  "not-created-here": "This server has no record of creating that event, so it was not updated.",
};

const decodeIdempotencyKey = S.decodeUnknownOption(M365IdempotencyKey);

const STORED_BYTES_ALLOWANCE = 2;

const PRECONDITION_FAILED_STATUS = 412;

// A moved draft and, at most, a sent copy share one RFC 5322 message id.
const MOVED_DRAFT_PAGE_SIZE = 5;

// The fields check_drafts reads from a draft: never a body, a subject or a recipient.
const CHECK_DRAFT_SELECT = "id,isDraft,categories,changeKey,internetMessageId";

// The lookup of a moved draft also asks for its folder, to tell a deleted draft from a moved one.
const MOVED_DRAFT_SELECT = `${CHECK_DRAFT_SELECT},parentFolderId`;

const DELETED_ITEMS_FOLDER = "deleteditems";

const INTERNET_MESSAGE_ID_SELECT = "id,internetMessageId";

const decodeSegment = S.decodeUnknownEffect(GraphPathSegment);

const nonEmpty = O.filter(Str.isNonEmpty);

// What check_drafts does to one draft's categories.
// Keep: nothing is written. Set or Clear: a new category list. Reconcile: the journal says this
// server marked the draft but the category is gone, so only a draft-basis-cleared record is written.
type MarkPlan =
  | { readonly _tag: "Keep"; readonly outcome: OutboxDraftMarkOutcome }
  | { readonly _tag: "Set"; readonly categories: ReadonlyArray<string> }
  | { readonly _tag: "Clear"; readonly categories: ReadonlyArray<string> }
  | { readonly _tag: "Reconcile" };

const keep = (outcome: OutboxDraftMarkOutcome): MarkPlan => ({ _tag: "Keep", outcome });

// The category is set on a stale draft and removed from a current one only when this server set it.
// Every other category stays, in order. `basisMarked` holds exactly when the journal says this
// server's category is on the draft; a mark the draft no longer carries is reconciled in the journal.
const planMark = (verdict: OutboxBasisVerdict, categories: ReadonlyArray<string>, basisMarked: boolean): MarkPlan => {
  const carries = A.contains(categories, OUTBOX_BASIS_STALE_CATEGORY);
  const without = (): ReadonlyArray<string> =>
    A.filter(categories, (category) => category !== OUTBOX_BASIS_STALE_CATEGORY);
  return Match.value({
    basisMarked,
    carries,
    stale: verdict === "pinned-stale",
    current: verdict === "pinned-current",
  }).pipe(
    Match.when({ carries: true, stale: true }, () => keep("already-set")),
    Match.when(
      { stale: true },
      (): MarkPlan => ({ _tag: "Set", categories: A.append(categories, OUTBOX_BASIS_STALE_CATEGORY) })
    ),
    Match.when(
      { basisMarked: true, carries: true, current: true },
      (): MarkPlan => ({ _tag: "Clear", categories: without() })
    ),
    Match.when({ basisMarked: true, carries: false }, (): MarkPlan => ({ _tag: "Reconcile" })),
    Match.orElse(() => keep("none"))
  );
};

// The changed view fields across a draft's pins, each once.
const changedFieldsOf = (report: OutboxBasisReport): ReadonlyArray<OutboxBasisChangedField> =>
  pipe(
    report.pins,
    A.flatMap(({ status }) => (OutboxBasisStatus.guards.Changed(status) ? status.fields : [])),
    A.dedupe
  );

// Where one open draft ends up in the check_drafts result.
const DraftOutcome = S.TaggedUnion({
  Checked: { entry: OutboxDraftCheck },
  Closed: { entry: OutboxDraftClosed },
  Unreadable: { entry: OutboxDraftUnreadable },
});

const entryOf = <Entry>(outcome: { readonly entry: Entry }): Entry => outcome.entry;

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).annotate({
  title: "PosInt",
  description: "An integer greater than zero.",
});

/**
 * What the outbox handlers are bound to: the one mailbox, and how much they
 * may download when they verify a draft's stored attachments.
 *
 * **Example** (Bind the handlers to a mailbox)
 *
 * ```ts
 * import { OutboxHandlerSettings } from "@beep/m365-mcp/OutboxHandlers"
 *
 * const settings = OutboxHandlerSettings.make({ mailbox: "mailbox@example.test" })
 * console.log(settings.maxAttachments)
 * // 20
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxHandlerSettings extends S.Opaque<OutboxHandlerSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    mailbox: GraphPathSegment.annotateKey({
      description: "The only mailbox any handler addresses; from server configuration, never a tool parameter.",
    }),
    maxAttachments: PosInt.pipe(
      S.withConstructorDefault(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENTS)),
      S.withDecodingDefaultTypeKey(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENTS))
    ).annotateKey({ description: "Largest number of stored attachments a read or send will download." }),
    maxMessageAttachmentBytes: PosInt.pipe(
      S.withConstructorDefault(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES)),
      S.withDecodingDefaultTypeKey(Effect.succeed(OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES))
    ).annotateKey({
      description:
        "Per-message attachment byte limit. A draft whose attachments Graph reports as more than twice this is not downloaded.",
    }),
  }).pipe(
    $I.annoteSchema("OutboxHandlerSettings", {
      description: "The mailbox and download limits the outbox tool handlers are bound to.",
    })
  )
) {}

/**
 * Build the handler layer of the outbox toolkit.
 *
 * **Example** (Compose the handler layer)
 *
 * ```ts
 * import { makeOutboxToolkitHandlers, OutboxHandlerSettings } from "@beep/m365-mcp/OutboxHandlers"
 * import * as Layer from "effect/Layer";
 * const layer = makeOutboxToolkitHandlers(OutboxHandlerSettings.make({ mailbox: "mailbox@example.test" }))
 * console.log(Layer.isLayer(layer))
 * // true
 * ```
 *
 * @category layers
 * @since 0.1.0
 */
export const makeOutboxToolkitHandlers = (
  settings: OutboxHandlerSettings
): Layer.Layer<
  Tool.HandlersFor<typeof OutboxToolkit.tools>,
  never,
  M365 | OutboxAttachmentSource | OutboxAuditLog | OutboxBasisReader | Digest.Digest
> =>
  OutboxToolkit.toLayer(
    Effect.gen(function* () {
      const m365 = yield* M365;
      const crypto = yield* Digest.Digest;
      const source = yield* OutboxAttachmentSource;
      const audit = yield* OutboxAuditLog;
      const reader = yield* OutboxBasisReader;
      const userId = O.some(settings.mailbox);

      const readMessage = (draftId: string) =>
        m365.getMessage(M365GetMessageRequest.make({ messageId: draftId, userId }));

      // What the draft stores, hashed from the stored bytes. Never a record of what was uploaded.
      const readStored = (draftId: string) =>
        readStoredAttachments(
          OutboxStoredAttachmentsRequest.make({
            draftId,
            mailbox: settings.mailbox,
            maxAttachments: settings.maxAttachments,
            maxReportedBytes: settings.maxMessageAttachmentBytes * STORED_BYTES_ALLOWANCE,
          })
        ).pipe(Effect.provideService(M365, m365), Effect.provideService(Digest.Digest, crypto));

      const deleteDraft = (draftId: string) =>
        m365.deleteDraftMessage(M365DeleteDraftMessageRequest.make({ messageId: draftId, userId }));

      const closeDraft = Effect.fnUntraced(function* (open: OutboxOpenDraft, reason: OutboxDraftClosedReason) {
        const { draftId, subject } = open.created;
        const recorded = yield* Effect.isSuccess(
          audit.append(
            OutboxDraftClosedRecord.make({
              at: yield* DateTime.now,
              auditId: yield* audit.nextAuditId,
              draftId,
              reason,
            })
          )
        );
        return OutboxDraftClosed.make({ draftId, reason, recorded, subject });
      });

      const appendMark = Effect.fnUntraced(function* (draftId: string, fields: ReadonlyArray<OutboxBasisChangedField>) {
        const at = yield* DateTime.now;
        const auditId = yield* audit.nextAuditId;
        return yield* audit.append(OutboxDraftBasisMarkedRecord.make({ at, auditId, draftId, fields }));
      });

      const appendIdentified = Effect.fnUntraced(function* (draftId: string, internetMessageId: string) {
        const at = yield* DateTime.now;
        const auditId = yield* audit.nextAuditId;
        return yield* audit.append(OutboxDraftIdentifiedRecord.make({ at, auditId, draftId, internetMessageId }));
      });

      const appendClear = Effect.fnUntraced(function* (draftId: string) {
        const at = yield* DateTime.now;
        const auditId = yield* audit.nextAuditId;
        return yield* audit.append(OutboxDraftBasisClearedRecord.make({ at, auditId, draftId }));
      });

      // The only Graph write check_drafts makes, always conditional on the change key just read.
      const writeCategories = (messageId: GraphPathSegment, changeKey: string, categories: ReadonlyArray<string>) =>
        m365
          .updateMessageCategories(
            M365UpdateMessageCategoriesRequest.make({ categories, changeKey: O.some(changeKey), messageId, userId })
          )
          .pipe(
            Effect.asVoid,
            Effect.mapError((error) =>
              O.contains(error.status, PRECONDITION_FAILED_STATUS) ? "changed-since-read" : error.reason
            )
          );

      const marked = (mark: OutboxDraftMarkOutcome, markFailure: O.Option<string> = O.none()) => ({
        mark,
        markFailure,
      });

      // Records always lead or follow the category so that a failure leaves "recorded as marked,
      // category absent" (repaired by Reconcile next call), never "category present, no record".
      const applyMark = Effect.fnUntraced(function* (
        draftId: string,
        messageId: GraphPathSegment,
        changeKey: O.Option<string>,
        plan: MarkPlan,
        fields: ReadonlyArray<OutboxBasisChangedField>
      ) {
        if (plan._tag === "Keep") {
          return marked(plan.outcome);
        }
        if (plan._tag === "Reconcile") {
          yield* Effect.ignore(appendClear(draftId));
          return marked("none");
        }
        if (O.isNone(changeKey)) {
          return marked("failed", O.some("no-change-key"));
        }
        if (plan._tag === "Set") {
          // Intent first, as a send records its intent before acting.
          const recorded = yield* Effect.isSuccess(appendMark(draftId, fields));
          if (!recorded) {
            return marked("failed", O.some("audit"));
          }
          return yield* writeCategories(messageId, changeKey.value, plan.categories).pipe(
            Effect.match({
              onFailure: (reason) => marked("failed", O.some(reason)),
              onSuccess: () => marked("set"),
            })
          );
        }
        const cleared = yield* writeCategories(messageId, changeKey.value, plan.categories).pipe(
          Effect.mapError(O.some),
          Effect.result
        );
        if (cleared._tag === "Failure") {
          return marked("failed", cleared.failure);
        }
        const recorded = yield* Effect.isSuccess(appendClear(draftId).pipe(Effect.retry({ times: 1 })));
        return marked(recorded ? "cleared" : "cleared-unrecorded");
      });

      // Where an open draft is now: by its recorded id, or after a 404 by its RFC 5322 message id,
      // because Graph gives a message a new id when it moves to another folder. Fails with an
      // unreadable reason.
      const locateDraft = (open: OutboxOpenDraft, deletedItemsId: Effect.Effect<string, string>) =>
        decodeSegment(open.created.draftId).pipe(
          Effect.mapError(() => "invalid-id"),
          Effect.flatMap((messageId) =>
            m365.getMessage(M365GetMessageRequest.make({ messageId, select: O.some(CHECK_DRAFT_SELECT), userId })).pipe(
              Effect.asSome,
              Effect.catch((error) =>
                O.contains(error.status, NOT_FOUND_STATUS) && error.reason === "response status"
                  ? findMoved(open.internetMessageId, deletedItemsId)
                  : Effect.fail(error.reason)
              )
            )
          ),
          Effect.flatMap(
            O.match({
              onNone: () => Effect.succeedNone,
              onSome: (message) =>
                decodeSegment(message.id).pipe(
                  Effect.mapBoth({
                    onFailure: () => "invalid-id",
                    onSuccess: (messageId) => O.some({ message, messageId }),
                  })
                ),
            })
          )
        );

      // A hit in Deleted Items is a draft someone deleted in Outlook, not a moved one. The folder's
      // id is asked for only when a draft hit names a folder.
      const liveDraftHit = (
        drafts: ReadonlyArray<GraphMessage>,
        deletedItemsId: Effect.Effect<string, string>
      ): Effect.Effect<O.Option<GraphMessage>, string> =>
        A.some(drafts, (message) => O.isSome(message.parentFolderId))
          ? Effect.map(deletedItemsId, (deleted) =>
              A.findFirst(drafts, (message) => !O.contains(message.parentFolderId, deleted))
            )
          : Effect.succeed(A.head(drafts));

      // One list call, only after a 404: the draft's current copy. A draft outside Deleted Items
      // wins; otherwise a copy that is no longer a draft (sent); otherwise none (missing).
      const findMoved = (
        internetMessageId: O.Option<string>,
        deletedItemsId: Effect.Effect<string, string>
      ): Effect.Effect<O.Option<GraphMessage>, string> =>
        O.match(internetMessageId, {
          onNone: () => Effect.succeedNone,
          onSome: (id) =>
            m365
              .listMessages(
                M365ListMessagesRequest.make({
                  filter: O.some(odataEquals("internetMessageId", id)),
                  select: O.some(MOVED_DRAFT_SELECT),
                  top: O.some(MOVED_DRAFT_PAGE_SIZE),
                  userId,
                })
              )
              .pipe(
                Effect.mapError((error) => error.reason),
                Effect.flatMap((page) => {
                  const isStillDraft = (message: GraphMessage): boolean => O.contains(message.isDraft, true);
                  const drafts = A.filter(page.value, isStillDraft);
                  const others = A.filter(page.value, (message) => !isStillDraft(message));
                  return A.isReadonlyArrayEmpty(drafts)
                    ? Effect.succeed(A.head(others))
                    : Effect.map(liveDraftHit(drafts, deletedItemsId), (live) =>
                        O.orElse(live, () => A.findFirst(others, (message) => O.contains(message.isDraft, false)))
                      );
                })
              ),
        });

      // One open draft: closed when sent or missing, unreadable when Graph could not be asked,
      // otherwise rechecked and marked.
      const checkOpenDraft = Effect.fnUntraced(function* (
        open: OutboxOpenDraft,
        deletedItemsId: Effect.Effect<string, string>
      ) {
        const { basis, draftId, subject } = open.created;
        const unreadable = (reason: string) => OutboxDraftUnreadable.make({ draftId, reason, subject });
        const closed = (reason: OutboxDraftClosedReason) =>
          closeDraft(open, reason).pipe(Effect.map((entry) => DraftOutcome.cases.Closed.make({ entry })));
        const located = yield* Effect.result(locateDraft(open, deletedItemsId));
        if (located._tag === "Failure") {
          return DraftOutcome.cases.Unreadable.make({ entry: unreadable(located.failure) });
        }
        if (O.isNone(located.success)) {
          return yield* closed("missing");
        }
        const { message, messageId } = located.success.value;
        // Only an explicit false means sent; a missing flag is not evidence either way.
        if (O.isNone(message.isDraft)) {
          return DraftOutcome.cases.Unreadable.make({ entry: unreadable("incomplete-draft") });
        }
        if (!message.isDraft.value) {
          return yield* closed("sent");
        }
        // A draft recorded without a message id learns it now, so a later move can still find it.
        // Best effort: a failed append is retried on the next call.
        if (O.isNone(open.internetMessageId)) {
          yield* O.match(nonEmpty(message.internetMessageId), {
            onNone: () => Effect.void,
            onSome: (internetMessageId) => Effect.ignore(appendIdentified(draftId, internetMessageId)),
          });
        }
        const statuses = yield* Effect.forEach(basis, reader.recheck);
        const report = makeBasisReport(basis, statuses);
        const plan = planMark(
          report.verdict,
          A.filter(O.getOrElse(message.categories, A.empty), Str.isNonEmpty),
          open.basisMarked
        );
        const markResult = yield* applyMark(
          draftId,
          messageId,
          nonEmpty(message.changeKey),
          plan,
          changedFieldsOf(report)
        );
        return DraftOutcome.cases.Checked.make({
          entry: OutboxDraftCheck.make({ draftId, ...markResult, subject, verdict: report.verdict }),
        });
      });

      return OutboxToolkit.of({
        m365_outbox_create_draft: Effect.fn("M365Outbox.m365_outbox_create_draft")(
          function* (params: OutboxCreateDraftParams) {
            // Every path is checked and read before Graph is touched.
            const attachments = yield* source.resolve(params.attachmentPaths);
            // Every pin is read before the draft exists: an unreadable pin creates nothing.
            const basis = yield* Effect.forEach(params.basis, reader.observe);
            yield* Effect.annotateCurrentSpan({
              m365_outbox_attachment_count: A.length(attachments),
              m365_outbox_basis_count: A.length(basis),
              m365_outbox_recipient_count: A.length(params.to) + A.length(params.cc) + A.length(params.bcc),
            });
            const message = yield* m365.createDraftMessage(
              M365CreateDraftMessageRequest.make({
                draft: M365MailDraft.make({
                  bccRecipients: params.bcc,
                  body: M365MailBody.make({ content: params.body, contentType: params.bodyType }),
                  ccRecipients: params.cc,
                  subject: params.subject,
                  toRecipients: params.to,
                }),
                userId,
              })
            );
            // The RFC 5322 message id lets check_drafts find the draft after it moves; one narrow read
            // when the create response lacks it, and none recorded when that read fails.
            const internetMessageId = yield* O.match(nonEmpty(message.internetMessageId), {
              onNone: () =>
                m365
                  .getMessage(
                    M365GetMessageRequest.make({
                      messageId: message.id,
                      select: O.some(INTERNET_MESSAGE_ID_SELECT),
                      userId,
                    })
                  )
                  .pipe(
                    Effect.map((read) => nonEmpty(read.internetMessageId)),
                    Effect.orElseSucceed(O.none<string>)
                  ),
              onSome: Effect.succeedSome,
            });
            const digests = A.map(attachments, (attachment) => attachment.digest);
            // A failed prepare leaves nothing in Drafts: any failure from here on removes the draft.
            yield* Effect.gen(function* () {
              yield* Effect.forEach(
                attachments,
                (attachment) =>
                  m365.addMessageAttachment(
                    M365AddMessageAttachmentRequest.make({
                      content: attachment.content,
                      contentType: attachment.contentType,
                      messageId: message.id,
                      name: attachment.name,
                      userId,
                    })
                  ),
                { discard: true }
              );
              // Prove the upload round-trip: what Graph stores must be the local files, byte for byte,
              // so the digests returned here are exactly what send_draft will compute later.
              const stored = yield* readStored(message.id);
              if (!sameAttachments(stored, digests)) {
                return yield* refuse(
                  "round-trip-mismatch",
                  "The attachments Microsoft 365 stored do not match the local files, so the draft was deleted."
                );
              }
              yield* audit.append(
                OutboxDraftCreatedRecord.make({
                  at: yield* DateTime.now,
                  attachments: digests,
                  auditId: yield* audit.nextAuditId,
                  basis,
                  bcc: params.bcc,
                  cc: params.cc,
                  draftId: message.id,
                  internetMessageId,
                  subject: params.subject,
                  to: params.to,
                })
              );
            }).pipe(Effect.onError(() => Effect.ignore(deleteDraft(message.id))));

            return OutboxDraftCreated.make({
              attachments: digests,
              basis,
              draftId: message.id,
              webLink: message.webLink,
            });
          },
          finalizeOutboxTool("m365_outbox_create_draft", "createDraft", false)
        ),
        m365_outbox_create_event: Effect.fn("M365Outbox.m365_outbox_create_event")(
          function* (params: M365EventDraft) {
            const auditId = yield* audit.nextAuditId;
            // The audit id doubles as the event's idempotency key, so Graph drops a duplicate create.
            const event = yield* m365.createEvent(
              M365CreateEventRequest.make({
                event: params,
                idempotencyKey: decodeIdempotencyKey(`outbox:${auditId}`),
                userId,
              })
            );
            yield* audit
              .append(
                OutboxEventCreatedRecord.make({
                  at: yield* DateTime.now,
                  auditId,
                  eventId: event.id,
                  subject: params.subject,
                })
              )
              .pipe(Effect.mapError(completedWithoutAudit("The event was created")));

            return OutboxEventCreated.make({ eventId: event.id, webLink: event.webLink });
          },
          finalizeOutboxTool("m365_outbox_create_event", "createEvent", false)
        ),
        m365_outbox_delete_draft: Effect.fn("M365Outbox.m365_outbox_delete_draft")(
          function* (params: OutboxDraftRef) {
            const message = yield* readMessage(params.draftId);
            if (!O.contains(message.isDraft, true)) {
              return yield* refuse("not-a-draft", "The message is not a draft, so it was not deleted.");
            }
            if (!(yield* audit.hasCreatedDraft(params.draftId))) {
              return yield* refuse(
                "not-created-here",
                "This server has no record of creating that draft, so it was not deleted."
              );
            }
            yield* deleteDraft(params.draftId);
            yield* audit
              .append(
                OutboxDraftDeletedRecord.make({
                  at: yield* DateTime.now,
                  auditId: yield* audit.nextAuditId,
                  draftId: params.draftId,
                })
              )
              .pipe(Effect.mapError(completedWithoutAudit("The draft was deleted")));

            return OutboxDraftRef.make({ draftId: params.draftId });
          },
          finalizeOutboxTool("m365_outbox_delete_draft", "deleteDraft")
        ),
        m365_outbox_get_draft: Effect.fn("M365Outbox.m365_outbox_get_draft")(
          function* (params: OutboxDraftRef) {
            const draft = yield* readMessage(params.draftId);
            const stored = yield* readStored(params.draftId);
            // A draft this server did not record creating has no pins and reports unpinned.
            const created = yield* audit.createdDraft(params.draftId);
            const pins = O.match(created, { onNone: A.empty, onSome: (record) => record.basis });
            const statuses = yield* Effect.forEach(pins, reader.recheck);
            const basis = makeBasisReport(pins, statuses);
            yield* Effect.annotateCurrentSpan({
              m365_outbox_attachment_count: A.length(stored),
              m365_outbox_basis_count: A.length(pins),
              m365_outbox_basis_verdict: basis.verdict,
            });

            return OutboxDraftView.make({
              attachments: stored,
              basis,
              bcc: storedRecipientAddresses(draft.bccRecipients),
              bodyLength: pipe(
                draft.body,
                O.flatMap((body) => body.content),
                O.map((content) => content.length),
                O.getOrElse(() => 0)
              ),
              cc: storedRecipientAddresses(draft.ccRecipients),
              draftId: params.draftId,
              isDraft: O.contains(draft.isDraft, true),
              subject: pipe(
                draft.subject,
                O.getOrElse(() => "")
              ),
              to: storedRecipientAddresses(draft.toRecipients),
              webLink: draft.webLink,
            });
          },
          finalizeOutboxTool("m365_outbox_get_draft", "getDraft")
        ),
        m365_outbox_send_draft: Effect.fn("M365Outbox.m365_outbox_send_draft")(
          function* (params: OutboxSendDraftParams) {
            const auditId = yield* audit.nextAuditId;

            // Returns whether the outcome record reached the log; the send has already been decided.
            const recordOutcome = Effect.fnUntraced(function* (fields: {
              readonly graphStatus?: O.Option<number>;
              readonly internetMessageId?: O.Option<string>;
              readonly mismatches?: ReadonlyArray<OutboxSendMismatchField>;
              readonly outcome: OutboxSendOutcome;
            }) {
              yield* Effect.annotateCurrentSpan({ m365_outbox_send_outcome: fields.outcome });
              return yield* Effect.isSuccess(
                audit.append(
                  OutboxSendOutcomeRecord.make({
                    at: yield* DateTime.now,
                    auditId,
                    draftId: params.draftId,
                    ...fields,
                  })
                )
              );
            });
            const refused = Effect.fnUntraced(function* (mismatches: ReadonlyArray<OutboxSendMismatchField>) {
              const auditRecorded = yield* recordOutcome({ mismatches, outcome: "refused" });
              return OutboxSendResult.make({ auditId, auditRecorded, mismatches, outcome: "refused" });
            });

            // Only a draft this server recorded creating is sent. The guard below proves the caller
            // restated the draft, not that the draft is the session's own. Nothing is read or downloaded.
            if (!(yield* audit.hasCreatedDraft(params.draftId))) {
              return yield* refused(["not-created-here"]);
            }
            const draft = yield* readMessage(params.draftId);
            // Attachments that cannot be listed are a tool error; ones that cannot be verified refuse the send.
            const stored = yield* readStored(params.draftId).pipe(
              Effect.asSome,
              Effect.catchTag("OutboxStoredAttachmentError", () => Effect.succeedNone)
            );
            if (O.isNone(stored)) {
              return yield* refused(["attachments"]);
            }
            const mismatch = checkSendExpectation(
              OutboxSendCheck.make({ draft, expect: params.expect, stored: stored.value })
            );
            if (O.isSome(mismatch)) {
              return yield* refused(mismatch.value.fields);
            }

            // Graph's draft-send action accepts only the mutable message id. The
            // checked snapshot can change after this guard, so do not delegate
            // Mail.Send to an unversioned operation.
            return yield* refused(["version-unbound"]);
          },
          finalizeOutboxTool("m365_outbox_send_draft", "sendDraft", false)
        ),
        m365_outbox_check_drafts: Effect.fn("M365Outbox.m365_outbox_check_drafts")(
          function* () {
            const open = yield* audit.openDrafts;
            // Deleted Items is resolved at most once per call, and only when a moved draft needs it.
            const deletedItemsId = yield* Effect.cached(
              m365
                .getMailFolder(M365GetMailFolderRequest.make({ folder: DELETED_ITEMS_FOLDER, userId }))
                .pipe(Effect.mapBoth({ onFailure: (error) => error.reason, onSuccess: (folder) => folder.id }))
            );
            const outcomes = yield* Effect.forEach(open, (draft) => checkOpenDraft(draft, deletedItemsId));
            const drafts = A.map(A.filter(outcomes, DraftOutcome.guards.Checked), entryOf);
            const closed = A.map(A.filter(outcomes, DraftOutcome.guards.Closed), entryOf);
            const unreadable = A.map(A.filter(outcomes, DraftOutcome.guards.Unreadable), entryOf);
            const countOf = (verdict: OutboxBasisVerdict): number =>
              A.length(A.filter(drafts, (draft) => draft.verdict === verdict));
            const counts = {
              "pinned-current": countOf("pinned-current"),
              "pinned-stale": countOf("pinned-stale"),
              "pinned-unverified": countOf("pinned-unverified"),
              unpinned: countOf("unpinned"),
            };
            yield* Effect.annotateCurrentSpan({
              m365_outbox_closed_count: A.length(closed),
              m365_outbox_draft_count: A.length(open),
              m365_outbox_marked_count: A.length(A.filter(drafts, (draft) => draft.mark === "set")),
              m365_outbox_stale_count: counts["pinned-stale"],
              m365_outbox_unreadable_count: A.length(unreadable),
            });

            return OutboxDraftsChecked.make({ closed, counts, drafts, unreadable });
          },
          finalizeOutboxTool("m365_outbox_check_drafts", "checkDrafts")
        ),
        m365_outbox_update_event: Effect.fn("M365Outbox.m365_outbox_update_event")(
          function* (params: OutboxUpdateEventParams) {
            // Both gates run before any PATCH: Graph mails a meeting's attendees when it changes,
            // which would be a send outside the send guard.
            const createdHere = yield* audit.hasCreatedEvent(params.eventId);
            const stored = yield* m365.getEvent(M365GetEventRequest.make({ eventId: params.eventId, userId }));
            yield* Effect.annotateCurrentSpan({
              m365_outbox_event_attendee_count: storedAttendeeCount(stored),
              m365_outbox_event_created_here: createdHere,
            });
            const refusal = checkEventUpdate(OutboxEventUpdateCheck.make({ createdHere, event: stored }));
            if (O.isSome(refusal)) {
              return yield* refuse(refusal.value.reason, EVENT_UPDATE_REFUSAL_MESSAGE[refusal.value.reason]);
            }
            const event = yield* m365.updateEvent(
              M365UpdateEventRequest.make({
                eventId: params.eventId,
                patch: M365EventPatch.make(Struct.omit(params, ["eventId"])),
                userId,
              })
            );
            yield* audit
              .append(
                OutboxEventUpdatedRecord.make({
                  at: yield* DateTime.now,
                  auditId: yield* audit.nextAuditId,
                  eventId: event.id,
                  subject: params.subject,
                })
              )
              .pipe(Effect.mapError(completedWithoutAudit("The event was updated")));

            return OutboxEventUpdated.make({ eventId: event.id });
          },
          finalizeOutboxTool("m365_outbox_update_event", "updateEvent")
        ),
      });
    })
  );
