/**
 * Mail-tagging identifiers: opaque provider, run, and document-store ids.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/MailTagging/MailTagging.ids.model");

const opaqueTokenPattern = /^\S+$/u;

const opaqueToken = (identifier: string, subject: string) =>
  S.isPattern(opaqueTokenPattern, {
    identifier,
    title: subject,
    description: `${subject}: a non-empty token without whitespace.`,
    message: `${subject} must be a non-empty token without whitespace.`,
  });

/**
 * Provider message id of one mailbox message (the Graph `id`).
 *
 * **Example** (Guard a message id)
 *
 * ```ts
 * import { MailMessageId } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailMessageId)("msg-0001")) // true
 * console.log(S.is(MailMessageId)("")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MailMessageId = S.String.check(opaqueToken($I`MailMessageIdPatternCheck`, "Mailbox message id")).pipe(
  S.brand("MailMessageId"),
  $I.annoteSchema("MailMessageId", {
    description: "Provider message id of one mailbox message.",
  })
);

/**
 * Type-level brand produced by {@link MailMessageId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MailMessageId = typeof MailMessageId.Type;

/**
 * RFC 5322 `Message-ID` of a message, stable across mailboxes and moves.
 *
 * **Example** (Guard an internet message id)
 *
 * ```ts
 * import { InternetMessageId } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(InternetMessageId)("<0001@example.test>")) // true
 * console.log(S.is(InternetMessageId)("two words")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InternetMessageId = S.String.check(
  opaqueToken($I`InternetMessageIdPatternCheck`, "Internet message id")
).pipe(
  S.brand("InternetMessageId"),
  $I.annoteSchema("InternetMessageId", {
    description: "RFC 5322 Message-ID of a message.",
  })
);

/**
 * Type-level brand produced by {@link InternetMessageId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type InternetMessageId = typeof InternetMessageId.Type;

/**
 * Provider conversation (thread) id shared by the messages of one thread.
 *
 * **Example** (Guard a conversation id)
 *
 * ```ts
 * import { MailConversationId } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailConversationId)("conv-0001")) // true
 * console.log(S.is(MailConversationId)(" ")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MailConversationId = S.String.check(
  opaqueToken($I`MailConversationIdPatternCheck`, "Conversation id")
).pipe(
  S.brand("MailConversationId"),
  $I.annoteSchema("MailConversationId", {
    description: "Provider conversation id shared by the messages of one thread.",
  })
);

/**
 * Type-level brand produced by {@link MailConversationId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MailConversationId = typeof MailConversationId.Type;

/**
 * Docket number of one filing inside a matter, as the practice KG spells it.
 *
 * **Example** (Guard a docket number)
 *
 * ```ts
 * import { MatterDocketNumber } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MatterDocketNumber)("acme.10001US01")) // true
 * console.log(S.is(MatterDocketNumber)("10001 US 01")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MatterDocketNumber = S.String.check(opaqueToken($I`MatterDocketNumberPatternCheck`, "Docket number")).pipe(
  S.brand("MatterDocketNumber"),
  $I.annoteSchema("MatterDocketNumber", {
    description: "Docket number of one filing inside a matter.",
  })
);

/**
 * Type-level brand produced by {@link MatterDocketNumber}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MatterDocketNumber = typeof MatterDocketNumber.Type;

/**
 * Provider id of one attachment on a mailbox message.
 *
 * **Example** (Guard an attachment id)
 *
 * ```ts
 * import { MailAttachmentId } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailAttachmentId)("att-0001")) // true
 * console.log(S.is(MailAttachmentId)("att 0001")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MailAttachmentId = S.String.check(opaqueToken($I`MailAttachmentIdPatternCheck`, "Attachment id")).pipe(
  S.brand("MailAttachmentId"),
  $I.annoteSchema("MailAttachmentId", {
    description: "Provider id of one attachment on a mailbox message.",
  })
);

/**
 * Type-level brand produced by {@link MailAttachmentId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MailAttachmentId = typeof MailAttachmentId.Type;

/**
 * Identifier of one tagging or undo run, shared by every ledger line the run writes.
 *
 * **Example** (Guard a tagging run id)
 *
 * ```ts
 * import { TaggingRunId } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TaggingRunId)("run-2026-07-01-0001")) // true
 * console.log(S.is(TaggingRunId)("")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const TaggingRunId = S.String.check(opaqueToken($I`TaggingRunIdPatternCheck`, "Tagging run id")).pipe(
  S.brand("TaggingRunId"),
  $I.annoteSchema("TaggingRunId", {
    description: "Identifier of one tagging or undo run.",
  })
);

/**
 * Type-level brand produced by {@link TaggingRunId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TaggingRunId = typeof TaggingRunId.Type;

/**
 * Document-store id of the folder a matter files into.
 *
 * **Example** (Guard a document folder id)
 *
 * ```ts
 * import { DocumentFolderId } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DocumentFolderId)("100001")) // true
 * console.log(S.is(DocumentFolderId)("folder 100001")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DocumentFolderId = S.String.check(
  opaqueToken($I`DocumentFolderIdPatternCheck`, "Document folder id")
).pipe(
  S.brand("DocumentFolderId"),
  $I.annoteSchema("DocumentFolderId", {
    description: "Document-store id of the folder a matter files into.",
  })
);

/**
 * Type-level brand produced by {@link DocumentFolderId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentFolderId = typeof DocumentFolderId.Type;

/**
 * Document-store id of one filed attachment.
 *
 * **Example** (Guard a document file id)
 *
 * ```ts
 * import { DocumentFileId } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DocumentFileId)("200001")) // true
 * console.log(S.is(DocumentFileId)("file 200001")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DocumentFileId = S.String.check(opaqueToken($I`DocumentFileIdPatternCheck`, "Document file id")).pipe(
  S.brand("DocumentFileId"),
  $I.annoteSchema("DocumentFileId", {
    description: "Document-store id of one filed attachment.",
  })
);

/**
 * Type-level brand produced by {@link DocumentFileId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentFileId = typeof DocumentFileId.Type;
