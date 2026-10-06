/**
 * Schema-first tool declarations of the Microsoft 365 outbox server.
 *
 * **Details**
 *
 * Six tools: prepare, read and delete a mail draft; send a draft; create and
 * update a calendar event. Exactly one of them, `m365_outbox_send_draft`,
 * sends mail. None takes a mailbox, and none takes attendees.
 *
 * @category tools
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import { GraphBodyContentType, GraphPathSegment, M365EventDraft, M365EventPatch, M365MailAddress } from "@beep/m365";
import { annotateFourHints, destructiveWriteToolHints, FourHintAnnotations, readOnlyToolHints } from "@beep/mcp-kit";
import { Effect } from "effect";
import { Tool, Toolkit } from "effect/ai";
import * as S from "effect/Schema";
import { emptyByDefault } from "./internal/OutboxFields.ts";
import { OutboxAttachmentDigest } from "./OutboxAttachmentSource.ts";
import { OutboxSendOutcome } from "./OutboxAuditLog.ts";
import { OutboxSendExpectation, OutboxSendMismatchField } from "./OutboxSendGuard.ts";

const $I = $M365McpId.create("OutboxTools");

const draftId = GraphPathSegment.annotateKey({ description: "Graph id of the draft, as create_draft returned it." });

// A write that adds or changes one item and deletes nothing.
const additiveWriteToolHints = FourHintAnnotations.make({
  destructive: false,
  idempotent: false,
  openWorld: true,
  readOnly: false,
});

/**
 * Structured failure returned by the outbox tools.
 *
 * **Example** (Construct a tool failure)
 *
 * ```ts
 * import { OutboxToolError } from "@beep/m365-mcp/OutboxTools"
 * import * as O from "effect/Option"
 *
 * const failure = OutboxToolError.make({
 *   message: "Attachment is outside the configured attachment roots: /etc/hosts",
 *   operation: "resolveAttachments",
 *   reason: O.some("outside-roots"),
 *   retryable: false,
 *   toolName: "m365_outbox_create_draft"
 * })
 * console.log(failure.retryable)
 * // false
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxToolError extends S.Class<OutboxToolError>($I`OutboxToolError`)(
  {
    message: S.NonEmptyString.annotateKey({
      description: "Human-readable failure message safe to return to an MCP tool caller.",
    }),
    operation: S.NonEmptyString.annotateKey({ description: "Step that failed." }),
    reason: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description:
        "Stable failure category: a driver error reason, an attachment refusal reason, or an audit failure reason.",
    }),
    retryable: S.Boolean.annotateKey({
      description: "Whether repeating the same tool call may reasonably succeed. Never true for a send.",
    }),
    toolName: S.NonEmptyString.annotateKey({ description: "MCP tool that returned the failure." }),
  },
  $I.annote("OutboxToolError", { description: "Structured Microsoft 365 outbox tool failure." })
) {}

/**
 * Parameters of `m365_outbox_create_draft`.
 *
 * **Example** (Prepare a draft with one attachment)
 *
 * ```ts
 * import { OutboxCreateDraftParams } from "@beep/m365-mcp/OutboxTools"
 *
 * const params = OutboxCreateDraftParams.make({
 *   attachmentPaths: ["/srv/outbox-staging/receipt.pdf"],
 *   body: "Please find the filing attached.",
 *   bodyType: "text",
 *   subject: "Filing receipt",
 *   to: ["counsel@example.test"]
 * })
 * console.log(params.cc.length)
 * // 0
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxCreateDraftParams extends S.Class<OutboxCreateDraftParams>($I`OutboxCreateDraftParams`)(
  {
    attachmentPaths: emptyByDefault(
      S.NonEmptyString,
      "Absolute paths of files to attach. Each must be a regular file under a configured attachment root."
    ),
    bcc: emptyByDefault(M365MailAddress, "Blind-carbon-copy addresses."),
    body: S.String.annotateKey({ description: "Message body." }),
    bodyType: GraphBodyContentType.annotateKey({ description: "Body format: `text` or `html`." }),
    cc: emptyByDefault(M365MailAddress, "Carbon-copy addresses."),
    subject: S.NonEmptyString.annotateKey({ description: "Message subject." }),
    to: S.Array(M365MailAddress).annotateKey({ description: "Primary recipient addresses." }),
  },
  $I.annote("OutboxCreateDraftParams", { description: "Parameters for preparing a mail draft." })
) {}

/**
 * Result of `m365_outbox_create_draft`.
 *
 * **Example** (Read a created draft result)
 *
 * ```ts
 * import { OutboxDraftCreated } from "@beep/m365-mcp/OutboxTools"
 *
 * const result = OutboxDraftCreated.make({ attachments: [], draftId: "message-id" })
 * console.log(result.draftId)
 * // "message-id"
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxDraftCreated extends S.Class<OutboxDraftCreated>($I`OutboxDraftCreated`)(
  {
    attachments: S.Array(OutboxAttachmentDigest).annotateKey({
      description: "Name, size and sha256 of each attached file. Restate these in send_draft's expect block.",
    }),
    draftId,
    webLink: S.OptionFromOptionalKey(S.String)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Outlook web URL of the draft." }),
  },
  $I.annote("OutboxDraftCreated", { description: "A prepared draft and the digests of its attachments." })
) {}

/**
 * Parameters of the tools that address one draft by id.
 *
 * **Example** (Address a draft)
 *
 * ```ts
 * import { OutboxDraftRef } from "@beep/m365-mcp/OutboxTools"
 *
 * const params = OutboxDraftRef.make({ draftId: "message-id" })
 * console.log(params.draftId)
 * // "message-id"
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxDraftRef extends S.Class<OutboxDraftRef>($I`OutboxDraftRef`)(
  { draftId },
  $I.annote("OutboxDraftRef", { description: "A draft addressed by its Graph id." })
) {}

/**
 * Result of `m365_outbox_get_draft`: the draft as stored, without its body.
 *
 * **Example** (Read a draft view)
 *
 * ```ts
 * import { OutboxDraftView } from "@beep/m365-mcp/OutboxTools"
 *
 * const view = OutboxDraftView.make({
 *   attachments: [],
 *   bcc: [],
 *   bodyLength: 31,
 *   cc: [],
 *   draftId: "message-id",
 *   isDraft: true,
 *   subject: "Filing receipt",
 *   to: ["counsel@example.test"]
 * })
 * console.log(view.isDraft)
 * // true
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxDraftView extends S.Class<OutboxDraftView>($I`OutboxDraftView`)(
  {
    attachments: S.Array(OutboxAttachmentDigest).annotateKey({
      description: "Attachments as stored: name, byte length and sha256 of the stored bytes.",
    }),
    bcc: S.Array(S.String).annotateKey({ description: "Blind-carbon-copy addresses as stored." }),
    bodyLength: S.Natural.annotateKey({
      description: "Length of the stored body in characters; the body is not returned.",
    }),
    cc: S.Array(S.String).annotateKey({ description: "Carbon-copy addresses as stored." }),
    draftId,
    isDraft: S.Boolean.annotateKey({ description: "False once the message has been sent." }),
    subject: S.String.annotateKey({ description: "Subject as stored." }),
    to: S.Array(S.String).annotateKey({ description: "Primary recipient addresses as stored." }),
    webLink: S.OptionFromOptionalKey(S.String)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Outlook web URL of the draft." }),
  },
  $I.annote("OutboxDraftView", { description: "A stored draft's recipients, subject and attachments." })
) {}

/**
 * Parameters of `m365_outbox_send_draft`.
 *
 * **Example** (Send a draft with its expectation)
 *
 * ```ts
 * import { OutboxSendExpectation } from "@beep/m365-mcp/OutboxSendGuard"
 * import { OutboxSendDraftParams } from "@beep/m365-mcp/OutboxTools"
 *
 * const params = OutboxSendDraftParams.make({
 *   draftId: "message-id",
 *   expect: OutboxSendExpectation.make({
 *     attachments: [],
 *     bcc: [],
 *     cc: [],
 *     subject: "Filing receipt",
 *     to: ["counsel@example.test"]
 *   })
 * })
 * console.log(params.expect.subject)
 * // "Filing receipt"
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxSendDraftParams extends S.Class<OutboxSendDraftParams>($I`OutboxSendDraftParams`)(
  {
    draftId,
    expect: OutboxSendExpectation.annotateKey({
      description: "The exact recipients, subject and attachments this send must deliver.",
    }),
  },
  $I.annote("OutboxSendDraftParams", { description: "Parameters for sending a draft." })
) {}

/**
 * Result of `m365_outbox_send_draft`.
 *
 * **Example** (Read a refused send)
 *
 * ```ts
 * import { OutboxSendResult } from "@beep/m365-mcp/OutboxTools"
 *
 * const result = OutboxSendResult.make({
 *   auditId: "audit-4",
 *   auditRecorded: true,
 *   mismatches: ["subject"],
 *   outcome: "refused"
 * })
 * console.log(result.outcome)
 * // "refused"
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxSendResult extends S.Class<OutboxSendResult>($I`OutboxSendResult`)(
  {
    auditId: S.NonEmptyString.annotateKey({ description: "Id of this send's audit records." }),
    auditRecorded: S.Boolean.annotateKey({
      description: "False when the outcome record could not be appended to the audit log.",
    }),
    mismatches: emptyByDefault(
      OutboxSendMismatchField,
      "When refused: the fields in which the stored draft differs from expect."
    ),
    outcome: OutboxSendOutcome.annotateKey({
      description:
        "`sent`: Graph accepted the send. `refused`: nothing was sent. `unknown`: the send may or may not have happened; call get_draft and do not send again blindly.",
    }),
  },
  $I.annote("OutboxSendResult", { description: "How a send ended, with its audit id." })
) {}

/**
 * Result of `m365_outbox_create_event`.
 *
 * **Example** (Read a created event result)
 *
 * ```ts
 * import { OutboxEventCreated } from "@beep/m365-mcp/OutboxTools"
 *
 * const result = OutboxEventCreated.make({ eventId: "event-id" })
 * console.log(result.eventId)
 * // "event-id"
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxEventCreated extends S.Class<OutboxEventCreated>($I`OutboxEventCreated`)(
  {
    eventId: GraphPathSegment.annotateKey({ description: "Graph id of the event." }),
    webLink: S.OptionFromOptionalKey(S.String)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Outlook web URL of the event." }),
  },
  $I.annote("OutboxEventCreated", { description: "A created calendar event." })
) {}

/**
 * Parameters of `m365_outbox_update_event`: the event id and the fields to
 * change.
 *
 * **Example** (Change an event's subject)
 *
 * ```ts
 * import { OutboxUpdateEventParams } from "@beep/m365-mcp/OutboxTools"
 * import * as O from "effect/Option"
 *
 * const params = OutboxUpdateEventParams.make({ eventId: "event-id", subject: O.some("Response due (confirmed)") })
 * console.log(params.eventId)
 * // "event-id"
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxUpdateEventParams extends S.Class<OutboxUpdateEventParams>($I`OutboxUpdateEventParams`)(
  {
    ...M365EventPatch.fields,
    eventId: GraphPathSegment.annotateKey({ description: "Graph id of the event to change." }),
  },
  $I.annote("OutboxUpdateEventParams", {
    description: "An event id and the fields to change; absent fields are left as they are.",
  })
) {}

/**
 * Result of `m365_outbox_update_event`.
 *
 * **Example** (Read an updated event result)
 *
 * ```ts
 * import { OutboxEventUpdated } from "@beep/m365-mcp/OutboxTools"
 *
 * const result = OutboxEventUpdated.make({ eventId: "event-id" })
 * console.log(result.eventId)
 * // "event-id"
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class OutboxEventUpdated extends S.Class<OutboxEventUpdated>($I`OutboxEventUpdated`)(
  {
    eventId: GraphPathSegment.annotateKey({ description: "Graph id of the event." }),
  },
  $I.annote("OutboxEventUpdated", { description: "An updated calendar event." })
) {}

/**
 * Prepares a mail draft with attachments. Sends nothing.
 *
 * **Example** (Read the create draft tool name)
 *
 * ```ts
 * import { OutboxCreateDraftTool } from "@beep/m365-mcp/OutboxTools"
 *
 * console.log(OutboxCreateDraftTool.name)
 * // "m365_outbox_create_draft"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const OutboxCreateDraftTool = annotateFourHints(
  Tool.make("m365_outbox_create_draft", {
    description:
      "Prepare a mail draft in the configured mailbox's Drafts folder, with files attached from absolute local paths under the configured attachment roots. This does not send anything: only m365_outbox_send_draft sends mail. Returns the draft id and the name, size and sha256 of each attachment; restate those in send_draft's expect block. The attachments are read back and compared with the local files; if an attachment fails or does not round-trip, the draft is deleted and the call fails.",
    failure: OutboxToolError,
    failureMode: "return",
    parameters: OutboxCreateDraftParams,
    success: OutboxDraftCreated,
  }),
  additiveWriteToolHints
);

/**
 * Reads a draft's recipients, subject and attachments as stored.
 *
 * **Example** (Read the get draft tool name)
 *
 * ```ts
 * import { OutboxGetDraftTool } from "@beep/m365-mcp/OutboxTools"
 *
 * console.log(OutboxGetDraftTool.name)
 * // "m365_outbox_get_draft"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const OutboxGetDraftTool = annotateFourHints(
  Tool.make("m365_outbox_get_draft", {
    description:
      "Read a draft as the mailbox stores it: whether it is still a draft, its recipients, subject and attachments (name, size and sha256 of the stored bytes, downloaded and hashed on each call). The body is not returned, only its length. Call this after a send_draft outcome of unknown: a draft that is gone or is no longer a draft was sent.",
    failure: OutboxToolError,
    failureMode: "return",
    parameters: OutboxDraftRef,
    success: OutboxDraftView,
  }),
  readOnlyToolHints
);

/**
 * Deletes a draft this server created.
 *
 * **Example** (Read the delete draft tool name)
 *
 * ```ts
 * import { OutboxDeleteDraftTool } from "@beep/m365-mcp/OutboxTools"
 *
 * console.log(OutboxDeleteDraftTool.name)
 * // "m365_outbox_delete_draft"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const OutboxDeleteDraftTool = annotateFourHints(
  Tool.make("m365_outbox_delete_draft", {
    description:
      "Delete a draft that this server created and that is still a draft. Outlook moves it to Deleted Items. Any other message is refused.",
    failure: OutboxToolError,
    failureMode: "return",
    parameters: OutboxDraftRef,
    success: OutboxDraftRef,
  }),
  destructiveWriteToolHints
);

/**
 * Sends a stored draft after checking it against the caller's expectation.
 * The only tool that sends mail.
 *
 * **Example** (Read the send draft tool name)
 *
 * ```ts
 * import { OutboxSendDraftTool } from "@beep/m365-mcp/OutboxTools"
 *
 * console.log(OutboxSendDraftTool.name)
 * // "m365_outbox_send_draft"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const OutboxSendDraftTool = annotateFourHints(
  Tool.make("m365_outbox_send_draft", {
    description:
      "SENDS MAIL. This is the only tool that sends. It sends exactly the stored draft, and only if the draft equals expect: the same to, cc and bcc addresses, the same subject, and the same attachments by name, size and sha256 (restate them exactly as create_draft or get_draft returned them; every attachment needs all three). The stored attachments are downloaded and hashed before sending. If anything differs it sends nothing and returns outcome refused with the differing fields; read the draft again with get_draft before restating. Outcome unknown means the request may or may not have reached Microsoft Graph: call get_draft (a draft that is gone or no longer a draft was sent) and never send again blindly. Every call is written to a local audit log.",
    failure: OutboxToolError,
    failureMode: "return",
    parameters: OutboxSendDraftParams,
    success: OutboxSendResult,
  }),
  destructiveWriteToolHints
);

/**
 * Creates a calendar event without attendees.
 *
 * **Example** (Read the create event tool name)
 *
 * ```ts
 * import { OutboxCreateEventTool } from "@beep/m365-mcp/OutboxTools"
 *
 * console.log(OutboxCreateEventTool.name)
 * // "m365_outbox_create_event"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const OutboxCreateEventTool = annotateFourHints(
  Tool.make("m365_outbox_create_event", {
    description:
      "Create an event in the configured mailbox's default calendar. Every date-time needs an explicit time zone; there is no default. Attendees are not accepted, so no invitation is ever mailed.",
    failure: OutboxToolError,
    failureMode: "return",
    parameters: M365EventDraft,
    success: OutboxEventCreated,
  }),
  additiveWriteToolHints
);

/**
 * Updates fields of a calendar event.
 *
 * **Example** (Read the update event tool name)
 *
 * ```ts
 * import { OutboxUpdateEventTool } from "@beep/m365-mcp/OutboxTools"
 *
 * console.log(OutboxUpdateEventTool.name)
 * // "m365_outbox_update_event"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const OutboxUpdateEventTool = annotateFourHints(
  Tool.make("m365_outbox_update_event", {
    description:
      "Change fields of an event in the configured mailbox's calendar. Absent fields are left as they are; categories replaces the whole category list. Attendees are not accepted.",
    failure: OutboxToolError,
    failureMode: "return",
    parameters: OutboxUpdateEventParams,
    success: OutboxEventUpdated,
  }),
  additiveWriteToolHints
);

/**
 * The Microsoft 365 outbox toolkit.
 *
 * **Example** (Count the outbox tools)
 *
 * ```ts
 * import { OutboxToolkit } from "@beep/m365-mcp/OutboxTools"
 *
 * console.log(Object.keys(OutboxToolkit.tools).length)
 * // 6
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const OutboxToolkit = Toolkit.make(
  OutboxCreateDraftTool,
  OutboxGetDraftTool,
  OutboxDeleteDraftTool,
  OutboxSendDraftTool,
  OutboxCreateEventTool,
  OutboxUpdateEventTool
);

/**
 * The Microsoft 365 outbox toolkit type.
 *
 * **Example** (Type the toolkit value)
 *
 * ```ts
 * import { OutboxToolkit } from "@beep/m365-mcp/OutboxTools"
 *
 * const toolkit: OutboxToolkit = OutboxToolkit
 * console.log(Object.keys(toolkit.tools).includes("m365_outbox_send_draft"))
 * // true
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export type OutboxToolkit = typeof OutboxToolkit;
