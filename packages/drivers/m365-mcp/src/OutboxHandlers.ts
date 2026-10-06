/**
 * Tool handlers of the Microsoft 365 outbox server.
 *
 * **Details**
 *
 * The handlers compose the `@beep/m365` driver's app-only verbs with the
 * attachment source, the send guard and the audit log. Exactly one handler,
 * `m365_outbox_send_draft`, calls the driver's send verb, and it does so only
 * after the guard has passed and the intent record is on disk. The guard sees
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
  M365GetMessageRequest,
  M365IdempotencyKey,
  M365MailBody,
  M365MailDraft,
  M365SendDraftMessageRequest,
  M365UpdateEventRequest,
} from "@beep/m365";
import { Crypto, DateTime, Effect, Match, pipe, Result, Struct } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES,
  OUTBOX_DEFAULT_MAX_ATTACHMENTS,
  OutboxAttachmentSource,
} from "./OutboxAttachmentSource.ts";
import {
  OutboxAuditLog,
  OutboxDraftCreatedRecord,
  OutboxDraftDeletedRecord,
  OutboxEventCreatedRecord,
  OutboxEventUpdatedRecord,
  OutboxSendIntentRecord,
  OutboxSendOutcomeRecord,
} from "./OutboxAuditLog.ts";
import { checkSendExpectation, OutboxSendCheck, sameAttachments, storedRecipientAddresses } from "./OutboxSendGuard.ts";
import { OutboxStoredAttachmentsRequest, readStoredAttachments } from "./OutboxStoredAttachments.ts";
import {
  OutboxDraftCreated,
  OutboxDraftRef,
  OutboxDraftView,
  OutboxEventCreated,
  OutboxEventUpdated,
  OutboxSendResult,
  OutboxToolError,
  OutboxToolkit,
} from "./OutboxTools.ts";
import type { M365Error, M365EventDraft } from "@beep/m365";
import type * as Tool from "effect/ai/Tool";
import type * as Layer from "effect/Layer";
import type { OutboxAttachmentError } from "./OutboxAttachmentSource.ts";
import type { OutboxAuditError, OutboxSendOutcome } from "./OutboxAuditLog.ts";
import type { OutboxSendMismatchField } from "./OutboxSendGuard.ts";
import type { OutboxStoredAttachmentError } from "./OutboxStoredAttachments.ts";
import type { OutboxCreateDraftParams, OutboxSendDraftParams, OutboxUpdateEventParams } from "./OutboxTools.ts";

const $I = $M365McpId.create("OutboxHandlers");

const NOT_FOUND_STATUS = 404;

// A refusal the handlers raise themselves, before or after a driver call.
class OutboxRefusal extends S.TaggedError<OutboxRefusal>($I`OutboxRefusal`)(
  "OutboxRefusal",
  {
    message: S.String,
    reason: S.String,
  },
  $I.annoteError<OutboxRefusal>("OutboxRefusal", {
    description: "A refusal raised by an outbox tool handler itself.",
  })
) {}

type OutboxFailure = M365Error | OutboxAttachmentError | OutboxAuditError | OutboxRefusal | OutboxStoredAttachmentError;

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

const decodeIdempotencyKey = S.decodeUnknownOption(M365IdempotencyKey);

const STORED_BYTES_ALLOWANCE = 2;

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
export class OutboxHandlerSettings extends S.Class<OutboxHandlerSettings>($I`OutboxHandlerSettings`)(
  {
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
  },
  $I.annote("OutboxHandlerSettings", {
    description: "The mailbox and download limits the outbox tool handlers are bound to.",
  })
) {}

/**
 * Build the handler layer of the outbox toolkit.
 *
 * **Example** (Compose the handler layer)
 *
 * ```ts
 * import { makeOutboxToolkitHandlers, OutboxHandlerSettings } from "@beep/m365-mcp/OutboxHandlers"
 * import { Layer } from "effect"
 *
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
  M365 | OutboxAttachmentSource | OutboxAuditLog | Crypto.Crypto
> =>
  OutboxToolkit.toLayer(
    Effect.gen(function* () {
      const m365 = yield* M365;
      const crypto = yield* Crypto.Crypto;
      const source = yield* OutboxAttachmentSource;
      const audit = yield* OutboxAuditLog;
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
        ).pipe(Effect.provideService(M365, m365), Effect.provideService(Crypto.Crypto, crypto));

      const deleteDraft = (draftId: string) =>
        m365.deleteDraftMessage(M365DeleteDraftMessageRequest.make({ messageId: draftId, userId }));

      return OutboxToolkit.of({
        m365_outbox_create_draft: Effect.fn("M365Outbox.m365_outbox_create_draft")(
          function* (params: OutboxCreateDraftParams) {
            // Every path is checked and read before Graph is touched.
            const attachments = yield* source.resolve(params.attachmentPaths);
            yield* Effect.annotateCurrentSpan({
              m365_outbox_attachment_count: A.length(attachments),
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
                  bcc: params.bcc,
                  cc: params.cc,
                  draftId: message.id,
                  subject: params.subject,
                  to: params.to,
                })
              );
            }).pipe(Effect.onError(() => Effect.ignore(deleteDraft(message.id))));

            return OutboxDraftCreated.make({ attachments: digests, draftId: message.id, webLink: message.webLink });
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
            yield* Effect.annotateCurrentSpan({ m365_outbox_attachment_count: A.length(stored) });

            return OutboxDraftView.make({
              attachments: stored,
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
            const draft = yield* readMessage(params.draftId);
            // Attachments that cannot be listed are a tool error; ones that cannot be verified refuse the send.
            const stored = yield* readStored(params.draftId).pipe(
              Effect.asSome,
              Effect.catchTag("OutboxStoredAttachmentError", () => Effect.succeedNone)
            );
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

            if (O.isNone(stored)) {
              return yield* refused(["attachments"]);
            }
            const mismatch = checkSendExpectation(
              OutboxSendCheck.make({ draft, expect: params.expect, stored: stored.value })
            );
            if (O.isSome(mismatch)) {
              return yield* refused(mismatch.value.fields);
            }

            // The intent record must be on disk first: if it cannot be written, nothing is sent.
            yield* audit.append(
              OutboxSendIntentRecord.make({
                at: yield* DateTime.now,
                attachments: stored.value,
                auditId,
                bcc: storedRecipientAddresses(draft.bccRecipients),
                cc: storedRecipientAddresses(draft.ccRecipients),
                draftId: params.draftId,
                subject: pipe(
                  draft.subject,
                  O.getOrElse(() => "")
                ),
                to: storedRecipientAddresses(draft.toRecipients),
              })
            );

            const sent = yield* Effect.result(
              m365.sendDraftMessage(M365SendDraftMessageRequest.make({ messageId: params.draftId, userId }))
            );
            if (Result.isSuccess(sent)) {
              const auditRecorded = yield* recordOutcome({
                internetMessageId: draft.internetMessageId,
                outcome: "sent",
              });
              return OutboxSendResult.make({ auditId, auditRecorded, outcome: "sent" });
            }
            if (sent.failure.reason === "ambiguous write") {
              const auditRecorded = yield* recordOutcome({ outcome: "unknown" });
              return OutboxSendResult.make({ auditId, auditRecorded, outcome: "unknown" });
            }
            // Graph or the token endpoint rejected the request: nothing was sent.
            yield* recordOutcome({ graphStatus: sent.failure.status, outcome: "refused" });
            return yield* sent.failure;
          },
          finalizeOutboxTool("m365_outbox_send_draft", "sendDraft", false)
        ),
        m365_outbox_update_event: Effect.fn("M365Outbox.m365_outbox_update_event")(
          function* (params: OutboxUpdateEventParams) {
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
