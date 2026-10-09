/**
 * Schemas for the corpus provenance index: the normalized per-message mail
 * header index over pffexport trees, the attachment clipped-extension repair
 * (proposal, journal, undo), and the document/attachment metadata census.
 *
 * **Details**
 *
 * Every row here is persisted out-of-repo as JSONL under the corpus home and
 * decodes through these schemas. Header values (addresses, subjects,
 * attachment names) are client data and never leave the corpus home; the repo
 * carries only the shapes and aggregate summaries.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/ProvenanceIndex.schemas");

const isTraversalSafe = (value: string): boolean =>
  A.every(Str.split("/")(value), (segment) => Str.isNonEmpty(segment) && segment !== "." && segment !== "..");

/**
 * Path of a corpus file relative to the corpus home, `/`-separated, with a
 * backslash allowed as an ordinary name byte.
 *
 * **Details**
 *
 * pffexport writes Outlook attachment display names verbatim, and those names
 * carry Windows backslashes (793 of the refresh tree's rename proposals).
 * `PosixPath` rejects the byte and the earlier normalization turned it into a
 * separator, which pointed every such row at a path that does not exist. The
 * schema forbids only what is unsafe on the corpus filesystem: absolute
 * paths, NUL, and empty, `.` or `..` segments.
 *
 * **Example** (Keep a backslash inside a name)
 *
 * ```ts
 * import { CorpusRelativePath } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorpusRelativePath)("staging/extract/children/x/Attachments/5_memo\\draft.pdf")) // true
 * console.log(S.is(CorpusRelativePath)("/etc/passwd")) // false
 * console.log(S.is(CorpusRelativePath)("a/../b")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorpusRelativePath = S.NonEmptyString.check(
  S.isPattern(/^(?!\/)[^\u0000]+$/u, {
    identifier: $I`CorpusRelativePathSyntaxCheck`,
    title: "Corpus Relative Path Syntax",
    description: "Corpus-relative paths are not absolute and contain no NUL byte.",
    message: "Expected a corpus-relative path without NUL.",
  }),
  S.makeFilter(isTraversalSafe, {
    identifier: $I`CorpusRelativePathSegmentCheck`,
    title: "Corpus Relative Path Segments",
    description: "Corpus-relative path segments must not be empty, current-directory, or parent-directory markers.",
    message: "Corpus-relative paths must not contain empty, '.' or '..' segments.",
  })
).pipe(
  S.brand("CorpusRelativePath"),
  $I.annoteSchema("CorpusRelativePath", {
    title: "Corpus Relative Path",
    description: "Traversal-safe path relative to the corpus home; a backslash is a name byte, not a separator.",
  })
);

/**
 * Type for {@link CorpusRelativePath}.
 *
 * @category schemas
 * @since 0.0.0
 */
export type CorpusRelativePath = typeof CorpusRelativePath.Type;

/**
 * Label of one pffexport staging tree under `<corpusRoot>/staging/`.
 *
 * **Example** (Name the two mail extraction trees)
 *
 * ```ts
 * import { MailExportTreeLabel } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailExportTreeLabel)("extract-2026-07-refresh")) // true
 * console.log(S.is(MailExportTreeLabel)("")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MailExportTreeLabel = S.NonEmptyString.pipe(
  $I.annoteSchema("MailExportTreeLabel", {
    title: "Mail Export Tree Label",
    description: "Directory name of one pffexport staging tree under the corpus staging root.",
  })
);

/**
 * Recipient class as recorded by pffexport's `Recipients.txt`.
 *
 * **Example** (Classify a recipient)
 *
 * ```ts
 * import { MailRecipientKind } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailRecipientKind)("cc")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MailRecipientKind = LiteralKit(["to", "cc", "bcc", "unknown"]).pipe(
  $I.annoteSchema("MailRecipientKind", {
    title: "Mail Recipient Kind",
    description:
      "Recipient class parsed from the pffexport recipient type; unknown when the type is absent or unmapped.",
  })
);

/**
 * One recipient of an exported message.
 *
 * **Example** (Build a recipient)
 *
 * ```ts
 * import { MailRecipient } from "@beep/repo-cli/commands/Corpus"
 *
 * const recipient = MailRecipient.make({ kind: "to", displayName: "Ada", emailAddress: "ada@example.com" })
 * console.log(recipient.kind) // "to"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailRecipient extends S.Class<MailRecipient>($I`MailRecipient`)(
  {
    addressType: S.optionalKey(S.String),
    displayName: S.optionalKey(S.String),
    emailAddress: S.optionalKey(S.String),
    kind: MailRecipientKind,
  },
  $I.annote("MailRecipient", {
    title: "Mail Recipient",
    description: "Recipient kind, display name, address, and address type from one Recipients.txt block.",
  })
) {}

/**
 * Normalized MAPI headers from pffexport's `OutlookHeaders.txt`.
 *
 * **Details**
 *
 * Timestamps keep pffexport's verbatim text (for example
 * `Nov 26, 2020 22:18:29.446000000 UTC`); normalization to RFC 5322 happens in
 * the libpff EML synthesizer, not here, so the index never loses precision.
 *
 * **Example** (Record the sender and subject)
 *
 * ```ts
 * import { OutlookMessageHeaders } from "@beep/repo-cli/commands/Corpus"
 *
 * const headers = OutlookMessageHeaders.make({ subject: "Quarterly report", senderName: "Ada" })
 * console.log(headers.subject) // "Quarterly report"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutlookMessageHeaders extends S.Class<OutlookMessageHeaders>($I`OutlookMessageHeaders`)(
  {
    clientSubmitTime: S.optionalKey(S.String),
    conversationTopic: S.optionalKey(S.String),
    creationTime: S.optionalKey(S.String),
    deliveryTime: S.optionalKey(S.String),
    flags: S.optionalKey(S.String),
    importance: S.optionalKey(S.String),
    modificationTime: S.optionalKey(S.String),
    priority: S.optionalKey(S.String),
    senderEmailAddress: S.optionalKey(S.String),
    senderName: S.optionalKey(S.String),
    sensitivity: S.optionalKey(S.String),
    sentRepresentingEmailAddress: S.optionalKey(S.String),
    sentRepresentingName: S.optionalKey(S.String),
    sizeBytes: S.optionalKey(S.Natural),
    subject: S.optionalKey(S.String),
  },
  $I.annote("OutlookMessageHeaders", {
    title: "Outlook Message Headers",
    description: "MAPI header fields of one exported item, verbatim as pffexport wrote them.",
  })
) {}

/**
 * RFC 5322 headers parsed from pffexport's `InternetHeaders.txt`.
 *
 * **Details**
 *
 * Present for messages that transited SMTP (61-82% of the corpus); absent for
 * drafts, sent-items copies without transport headers, and most embedded
 * items. Folded header lines are unfolded before parsing; `To`, `Cc`, and
 * `References` keep one entry per address or message id.
 *
 * **Example** (Capture the message id)
 *
 * ```ts
 * import { InternetMessageHeaders } from "@beep/repo-cli/commands/Corpus"
 *
 * const headers = InternetMessageHeaders.make({
 *   cc: [],
 *   messageId: "<abc@example.com>",
 *   references: [],
 *   to: ["ada@example.com"]
 * })
 * console.log(headers.messageId) // "<abc@example.com>"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InternetMessageHeaders extends S.Class<InternetMessageHeaders>($I`InternetMessageHeaders`)(
  {
    cc: S.Array(S.String),
    contentType: S.optionalKey(S.String),
    date: S.optionalKey(S.String),
    from: S.optionalKey(S.String),
    inReplyTo: S.optionalKey(S.String),
    messageId: S.optionalKey(S.String),
    references: S.Array(S.String),
    subject: S.optionalKey(S.String),
    to: S.Array(S.String),
  },
  $I.annote("InternetMessageHeaders", {
    title: "Internet Message Headers",
    description: "RFC 5322 identity and addressing headers of one exported message.",
  })
) {}

/**
 * Whether an attachment entry is a file or an embedded message item.
 *
 * **Example** (Distinguish embedded messages)
 *
 * ```ts
 * import { MailAttachmentKind } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailAttachmentKind)("embedded-message")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MailAttachmentKind = LiteralKit(["file", "embedded-message"]).pipe(
  $I.annoteSchema("MailAttachmentKind", {
    title: "Mail Attachment Kind",
    description:
      "File attachments are files directly under Attachments/; embedded messages are AttachmentN/ item directories.",
  })
);

/**
 * One attachment of an exported message.
 *
 * **Details**
 *
 * `fileName` is the on-disk name after pffexport, including the `N_` ordinal
 * prefix and any clipped extension; the repair journal maps it to the repaired
 * name. `relativePath` and `embeddedMessagePath` are corpus-root-relative so
 * they join the repair journal and census rows directly; only the parent
 * record's `messagePath` is children-relative.
 *
 * **Example** (Describe a file attachment)
 *
 * ```ts
 * import { MailAttachmentEntry } from "@beep/repo-cli/commands/Corpus"
 *
 * const entry = MailAttachmentEntry.make({
 *   fileName: "1_report.p",
 *   kind: "file",
 *   ordinal: 1,
 *   relativePath: "staging/extract/children/artifact:abc.export/Top of Outlook data file/Inbox/Message00001/Attachments/1_report.p",
 *   sizeBytes: 2048
 * })
 * console.log(entry.ordinal) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailAttachmentEntry extends S.Class<MailAttachmentEntry>($I`MailAttachmentEntry`)(
  {
    embeddedMessagePath: S.optionalKey(CorpusRelativePath),
    fileName: S.String,
    kind: MailAttachmentKind,
    ordinal: S.Natural,
    relativePath: CorpusRelativePath,
    sizeBytes: S.Natural,
  },
  $I.annote("MailAttachmentEntry", {
    title: "Mail Attachment Entry",
    description: "Ordinal, kind, on-disk name, path, size, and (for embedded items) the nested message path.",
  })
) {}

/**
 * Normalized index row for one exported message item.
 *
 * **Details**
 *
 * `messagePath` is relative to the staging tree's `children/` root and encodes
 * the source PST (`artifact:<sha256>.export/...`). `embeddedDepth` is 0 for
 * top-level items and counts `Attachments/AttachmentN/` nesting otherwise.
 * `folderPath` is the folder chain under the export's tree root (empty for
 * items directly under the root).
 *
 * **Example** (Index a message with no transport headers)
 *
 * ```ts
 * import { MailMessageIndexRecord, OutlookMessageHeaders } from "@beep/repo-cli/commands/Corpus"
 *
 * const record = MailMessageIndexRecord.make({
 *   attachments: [],
 *   embeddedDepth: 0,
 *   folderPath: "Top of Outlook data file/Inbox",
 *   messagePath: "artifact:abc.export/Top of Outlook data file/Inbox/Message00001",
 *   outlook: OutlookMessageHeaders.make({ subject: "hi" }),
 *   recipients: [],
 *   sourceArtifactId: "artifact:abc",
 *   tree: "extract"
 * })
 * console.log(record.embeddedDepth) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailMessageIndexRecord extends S.Class<MailMessageIndexRecord>($I`MailMessageIndexRecord`)(
  {
    attachments: S.Array(MailAttachmentEntry),
    bodyFileName: S.optionalKey(S.String),
    bodySizeBytes: S.optionalKey(S.Natural),
    conversationIndexHex: S.optionalKey(S.String),
    embeddedDepth: S.Natural,
    folderPath: S.String,
    internet: S.optionalKey(InternetMessageHeaders),
    messagePath: CorpusRelativePath,
    outlook: OutlookMessageHeaders,
    recipients: S.Array(MailRecipient),
    sourceArtifactId: S.NonEmptyString,
    tree: MailExportTreeLabel,
  },
  $I.annote("MailMessageIndexRecord", {
    title: "Mail Message Index Record",
    description:
      "One normalized per-message row: identity, folder, MAPI and RFC 5322 headers, recipients, body, attachments.",
  })
) {}

/**
 * JSON string codec for {@link MailMessageIndexRecord} JSONL rows.
 *
 * **Example** (Encode one row)
 *
 * ```ts
 * import { MailMessageIndexRecordJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof MailMessageIndexRecordJson.encode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MailMessageIndexRecordJson = JsonStringCodec(MailMessageIndexRecord);

/**
 * Aggregate summary of one indexed mail tree (safe to quote in the repo).
 *
 * **Example** (Summarize a tree)
 *
 * ```ts
 * import { MailMessageIndexSummary } from "@beep/repo-cli/commands/Corpus"
 *
 * const summary = MailMessageIndexSummary.make({
 *   attachmentBytes: 0,
 *   attachmentCount: 0,
 *   embeddedMessageCount: 0,
 *   generatedAt: "2026-10-06T00:00:00.000Z",
 *   internetHeaderCount: 0,
 *   messageCount: 0,
 *   messageIdCount: 0,
 *   recipientCount: 0,
 *   sourceArtifactCount: 0,
 *   tree: "extract"
 * })
 * console.log(summary.messageCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailMessageIndexSummary extends S.Class<MailMessageIndexSummary>($I`MailMessageIndexSummary`)(
  {
    attachmentBytes: S.Natural,
    attachmentCount: S.Natural,
    embeddedMessageCount: S.Natural,
    generatedAt: S.NonEmptyString,
    internetHeaderCount: S.Natural,
    messageCount: S.Natural,
    messageIdCount: S.Natural,
    recipientCount: S.Natural,
    sourceArtifactCount: S.Natural,
    tree: MailExportTreeLabel,
  },
  $I.annote("MailMessageIndexSummary", {
    title: "Mail Message Index Summary",
    description: "Counts only: sources, messages, embedded items, header coverage, recipients, attachments.",
  })
) {}

/**
 * JSON string codec for {@link MailMessageIndexSummary}.
 *
 * **Example** (Reference the codec)
 *
 * ```ts
 * import { MailMessageIndexSummaryJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof MailMessageIndexSummaryJson.decode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MailMessageIndexSummaryJson = JsonStringCodec(MailMessageIndexSummary);

/**
 * Classification flags for one clipped-extension repair proposal.
 *
 * **Details**
 *
 * pffexport (binary 20260608) clips each exported attachment name by the
 * length of its own `N_` ordinal prefix, so `1_report.pdf` lands as
 * `1_report.p`. The flags describe how the magic-sniffed type relates to the
 * surviving name remnant:
 *
 * - `exact-completion`: remnant is a prefix of a magic extension and the
 *   missing length equals the clip length.
 * - `inexact-completion`: remnant is a prefix of a magic extension but the
 *   lengths disagree.
 * - `extension-fully-eaten`: no extension remnant survives (no dot, or a
 *   trailing dot).
 * - `remnant-mismatch`: a remnant exists but no magic extension starts with
 *   it; the remnant is probably part of the stem.
 * - `ambiguous-mime`: the sniffed type has no usable canonical extension
 *   (for example `application/octet-stream`).
 * - `already-consistent`: the on-disk extension already matches the sniffed
 *   type; nothing to repair.
 * - `no-ordinal-prefix`: the name carries no `N_` prefix, so the clip rule
 *   does not apply.
 *
 * **Example** (Validate a flag)
 *
 * ```ts
 * import { AttachmentRepairFlag } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AttachmentRepairFlag)("exact-completion")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttachmentRepairFlag = LiteralKit([
  "exact-completion",
  "inexact-completion",
  "extension-fully-eaten",
  "remnant-mismatch",
  "ambiguous-mime",
  "already-consistent",
  "no-ordinal-prefix",
]).pipe(
  $I.annoteSchema("AttachmentRepairFlag", {
    title: "Attachment Repair Flag",
    description: "How a magic-sniffed attachment type relates to its clipped on-disk name.",
  })
);

/**
 * Whether a proposal renames the file or leaves it.
 *
 * **Example** (Validate a decision)
 *
 * ```ts
 * import { AttachmentRepairDecision } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AttachmentRepairDecision)("skip")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttachmentRepairDecision = LiteralKit(["rename", "skip"]).pipe(
  $I.annoteSchema("AttachmentRepairDecision", {
    title: "Attachment Repair Decision",
    description: "rename when a proposed name exists and the type is unambiguous; skip otherwise.",
  })
);

/**
 * One attachment clipped-extension repair proposal.
 *
 * **Details**
 *
 * The type comes from byte-signature sniffing (`file --mime-type` and
 * `file --extension`), never from the name. `relativePath` is relative to the
 * corpus root so one journal can span trees.
 *
 * **Example** (Propose a PDF completion)
 *
 * ```ts
 * import { AttachmentRepairProposal } from "@beep/repo-cli/commands/Corpus"
 *
 * const proposal = AttachmentRepairProposal.make({
 *   clipLength: 2,
 *   decision: "rename",
 *   flags: ["exact-completion"],
 *   magicExtensions: ["pdf"],
 *   mimeType: "application/pdf",
 *   ordinalPrefix: "1_",
 *   proposedFileName: "1_report.pdf",
 *   relativePath: "staging/extract/children/artifact:abc.export/Inbox/Message00001/Attachments/1_report.p",
 *   remnantExtension: "p",
 *   sizeBytes: 2048,
 *   tree: "extract"
 * })
 * console.log(proposal.decision) // "rename"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttachmentRepairProposal extends S.Class<AttachmentRepairProposal>($I`AttachmentRepairProposal`)(
  {
    clipLength: S.Natural,
    decision: AttachmentRepairDecision,
    flags: S.Array(AttachmentRepairFlag),
    magicExtensions: S.Array(S.String),
    mimeType: S.String,
    ordinalPrefix: S.String,
    proposedFileName: S.optionalKey(S.String),
    relativePath: CorpusRelativePath,
    remnantExtension: S.String,
    sizeBytes: S.Natural,
    tree: MailExportTreeLabel,
  },
  $I.annote("AttachmentRepairProposal", {
    title: "Attachment Repair Proposal",
    description: "Magic-sniffed type, clip analysis, flags, and the proposed repaired name for one attachment.",
  })
) {}

/**
 * JSON string codec for {@link AttachmentRepairProposal} JSONL rows.
 *
 * **Example** (Reference the codec)
 *
 * ```ts
 * import { AttachmentRepairProposalJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof AttachmentRepairProposalJson.decode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const AttachmentRepairProposalJson = JsonStringCodec(AttachmentRepairProposal);

/**
 * Terminal outcome of applying or undoing one rename.
 *
 * **Example** (Validate an outcome)
 *
 * ```ts
 * import { AttachmentRepairOutcome } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AttachmentRepairOutcome)("renamed")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttachmentRepairOutcome = LiteralKit([
  "renamed",
  "reverted",
  "skipped-collision",
  "skipped-missing",
  "skipped-size-changed",
]).pipe(
  $I.annoteSchema("AttachmentRepairOutcome", {
    title: "Attachment Repair Outcome",
    description:
      "renamed/reverted on success; skipped-* when the source is gone, the target exists, or the size changed.",
  })
);

/**
 * Append-only journal row for one attachment rename (the undo record).
 *
 * **Details**
 *
 * A rename never changes bytes, so the journal records size and mtime as the
 * identity check instead of a digest; `undo` renames `toPath` back to
 * `fromPath` only when `toPath` still has the recorded size.
 *
 * **Example** (Journal a rename)
 *
 * ```ts
 * import { AttachmentRepairJournalRow } from "@beep/repo-cli/commands/Corpus"
 *
 * const row = AttachmentRepairJournalRow.make({
 *   fromPath: "staging/extract/children/x.export/Inbox/Message00001/Attachments/1_report.p",
 *   journalRunId: "attachment-repair:2026-10-06T00:00:00.000Z",
 *   mimeType: "application/pdf",
 *   mtimeEpoch: 1754784000,
 *   outcome: "renamed",
 *   recordedAt: "2026-10-06T00:00:00.000Z",
 *   sizeBytes: 2048,
 *   toPath: "staging/extract/children/x.export/Inbox/Message00001/Attachments/1_report.pdf",
 *   tree: "extract"
 * })
 * console.log(row.outcome) // "renamed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttachmentRepairJournalRow extends S.Class<AttachmentRepairJournalRow>($I`AttachmentRepairJournalRow`)(
  {
    fromPath: CorpusRelativePath,
    journalRunId: S.NonEmptyString,
    mimeType: S.String,
    mtimeEpoch: S.Int,
    outcome: AttachmentRepairOutcome,
    recordedAt: S.NonEmptyString,
    sizeBytes: S.Natural,
    toPath: CorpusRelativePath,
    tree: MailExportTreeLabel,
  },
  $I.annote("AttachmentRepairJournalRow", {
    title: "Attachment Repair Journal Row",
    description: "One rename or revert with the size/mtime identity used to undo it safely.",
  })
) {}

/**
 * JSON string codec for {@link AttachmentRepairJournalRow} JSONL rows.
 *
 * **Example** (Reference the codec)
 *
 * ```ts
 * import { AttachmentRepairJournalRowJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof AttachmentRepairJournalRowJson.decode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const AttachmentRepairJournalRowJson = JsonStringCodec(AttachmentRepairJournalRow);

/**
 * Aggregate summary of one attachment repair pass (plan, apply, or undo).
 *
 * **Example** (Summarize a plan)
 *
 * ```ts
 * import { AttachmentRepairSummary } from "@beep/repo-cli/commands/Corpus"
 *
 * const summary = AttachmentRepairSummary.make({
 *   byFlag: {},
 *   byMime: {},
 *   byOutcome: {},
 *   generatedAt: "2026-10-06T00:00:00.000Z",
 *   mode: "plan",
 *   proposedRenames: 0,
 *   scannedFiles: 0,
 *   trees: ["extract"]
 * })
 * console.log(summary.mode) // "plan"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttachmentRepairSummary extends S.Class<AttachmentRepairSummary>($I`AttachmentRepairSummary`)(
  {
    byFlag: S.Record(S.String, S.Natural),
    byMime: S.Record(S.String, S.Natural),
    byOutcome: S.Record(S.String, S.Natural),
    generatedAt: S.NonEmptyString,
    mode: LiteralKit(["plan", "apply", "undo"]),
    proposedRenames: S.Natural,
    scannedFiles: S.Natural,
    trees: S.Array(MailExportTreeLabel),
  },
  $I.annote("AttachmentRepairSummary", {
    title: "Attachment Repair Summary",
    description: "Counts only: scanned files, proposed renames, and breakdowns by flag, MIME type, and outcome.",
  })
) {}

/**
 * JSON string codec for {@link AttachmentRepairSummary}.
 *
 * **Example** (Reference the codec)
 *
 * ```ts
 * import { AttachmentRepairSummaryJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof AttachmentRepairSummaryJson.decode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const AttachmentRepairSummaryJson = JsonStringCodec(AttachmentRepairSummary);

/**
 * Metadata extraction engine used for the census.
 *
 * **Example** (Validate the engine)
 *
 * ```ts
 * import { MetadataCensusEngine } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MetadataCensusEngine)("exiftool")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetadataCensusEngine = LiteralKit(["exiftool"]).pipe(
  $I.annoteSchema("MetadataCensusEngine", {
    title: "Metadata Census Engine",
    description:
      "exiftool identifies files by magic and reads PDF, OOXML, OLE2, image, and archive metadata in one pass.",
  })
);

/**
 * Terminal status of one census row.
 *
 * **Example** (Validate a status)
 *
 * ```ts
 * import { MetadataCensusStatus } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MetadataCensusStatus)("ok")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetadataCensusStatus = LiteralKit(["ok", "error"]).pipe(
  $I.annoteSchema("MetadataCensusStatus", {
    title: "Metadata Census Status",
    description: "ok when the engine produced a tag set; error when it reported a per-file failure.",
  })
);

/**
 * Normalized document metadata fields selected from the engine's tag set.
 *
 * **Details**
 *
 * Values keep the engine's text form. `createDate`/`modifyDate` come from the
 * document's own metadata (PDF Info/XMP, OOXML core properties, OLE2 summary
 * information), not from filesystem timestamps, which the census row carries
 * separately.
 *
 * **Example** (Normalize a PDF)
 *
 * ```ts
 * import { DocumentMetadataFields } from "@beep/repo-cli/commands/Corpus"
 *
 * const fields = DocumentMetadataFields.make({ fileType: "PDF", pageCount: 3, producer: "Acrobat" })
 * console.log(fields.pageCount) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentMetadataFields extends S.Class<DocumentMetadataFields>($I`DocumentMetadataFields`)(
  {
    author: S.optionalKey(S.String),
    company: S.optionalKey(S.String),
    createDate: S.optionalKey(S.String),
    creatorTool: S.optionalKey(S.String),
    fileType: S.optionalKey(S.String),
    lastModifiedBy: S.optionalKey(S.String),
    mimeType: S.optionalKey(S.String),
    modifyDate: S.optionalKey(S.String),
    pageCount: S.optionalKey(S.Natural),
    producer: S.optionalKey(S.String),
    revisionNumber: S.optionalKey(S.String),
    title: S.optionalKey(S.String),
  },
  $I.annote("DocumentMetadataFields", {
    title: "Document Metadata Fields",
    description: "Engine-independent selection: type, dates, author/last-author, creator/producer, title, pages.",
  })
) {}

/**
 * One metadata census row for a base file or attachment.
 *
 * **Details**
 *
 * `root` labels the scanned root (`raw`, `incoming`, `organized`, or a staging
 * tree) and `relativePath` is relative to the corpus root. `tags` keeps the
 * engine's full group-qualified tag set minus filesystem groups so later
 * passes can mine fields the normalized selection missed.
 *
 * **Example** (Record one file)
 *
 * ```ts
 * import { DocumentMetadataFields, MetadataCensusRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * const record = MetadataCensusRecord.make({
 *   engine: "exiftool",
 *   engineVersion: "13.55",
 *   fields: DocumentMetadataFields.make({ fileType: "PDF" }),
 *   mtimeEpoch: 1754784000,
 *   relativePath: "raw/store/report.pdf",
 *   root: "raw",
 *   sizeBytes: 2048,
 *   status: "ok",
 *   tags: {}
 * })
 * console.log(record.status) // "ok"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MetadataCensusRecord extends S.Class<MetadataCensusRecord>($I`MetadataCensusRecord`)(
  {
    engine: MetadataCensusEngine,
    engineVersion: S.String,
    error: S.optionalKey(S.String),
    fields: DocumentMetadataFields,
    mtimeEpoch: S.Int,
    relativePath: CorpusRelativePath,
    root: S.NonEmptyString,
    sizeBytes: S.Natural,
    status: MetadataCensusStatus,
    tags: S.Record(S.String, S.Unknown),
  },
  $I.annote("MetadataCensusRecord", {
    title: "Metadata Census Record",
    description: "Filesystem identity, engine, normalized fields, raw tag set, and status for one file.",
  })
) {}

/**
 * JSON string codec for {@link MetadataCensusRecord} JSONL rows.
 *
 * **Example** (Reference the codec)
 *
 * ```ts
 * import { MetadataCensusRecordJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof MetadataCensusRecordJson.decode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MetadataCensusRecordJson = JsonStringCodec(MetadataCensusRecord);

/**
 * Aggregate summary of one metadata census run.
 *
 * **Example** (Summarize a run)
 *
 * ```ts
 * import { MetadataCensusSummary } from "@beep/repo-cli/commands/Corpus"
 *
 * const summary = MetadataCensusSummary.make({
 *   byFileType: {},
 *   engineVersion: "13.55",
 *   errorCount: 0,
 *   fileCount: 0,
 *   generatedAt: "2026-10-06T00:00:00.000Z",
 *   okCount: 0,
 *   roots: ["raw"],
 *   withAuthor: 0,
 *   withCreateDate: 0
 * })
 * console.log(summary.fileCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MetadataCensusSummary extends S.Class<MetadataCensusSummary>($I`MetadataCensusSummary`)(
  {
    byFileType: S.Record(S.String, S.Natural),
    engineVersion: S.String,
    errorCount: S.Natural,
    fileCount: S.Natural,
    generatedAt: S.NonEmptyString,
    okCount: S.Natural,
    roots: S.Array(S.NonEmptyString),
    withAuthor: S.Natural,
    withCreateDate: S.Natural,
  },
  $I.annote("MetadataCensusSummary", {
    title: "Metadata Census Summary",
    description: "Counts only: files, ok/error, author and create-date coverage, and a file-type breakdown.",
  })
) {}

/**
 * JSON string codec for {@link MetadataCensusSummary}.
 *
 * **Example** (Reference the codec)
 *
 * ```ts
 * import { MetadataCensusSummaryJson } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof MetadataCensusSummaryJson.decode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MetadataCensusSummaryJson = JsonStringCodec(MetadataCensusSummary);

/**
 * Options for the mail header index program.
 *
 * **Details**
 *
 * Outputs land under `<corpusRoot>/staging/provenance/` as
 * `messages-<tree>.jsonl` plus `messages-<tree>.summary.json` unless
 * `outputDir` overrides the directory.
 *
 * **Example** (Index both trees)
 *
 * ```ts
 * import { ProvenanceMessagesOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = ProvenanceMessagesOptions.make({ corpusRoot: "/data/corpus", trees: ["extract", "extract-2026-07-refresh"] })
 * console.log(options.trees.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProvenanceMessagesOptions extends S.Class<ProvenanceMessagesOptions>($I`ProvenanceMessagesOptions`)(
  {
    corpusRoot: S.NonEmptyString,
    outputDir: S.optionalKey(S.NonEmptyString),
    trees: S.Array(MailExportTreeLabel),
  },
  $I.annote("ProvenanceMessagesOptions", {
    title: "Provenance Messages Options",
    description: "Corpus root, staging trees to index, and an optional output directory override.",
  })
) {}

/**
 * Mode of the attachment repair program.
 *
 * **Example** (Validate a mode)
 *
 * ```ts
 * import { AttachmentRepairMode } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AttachmentRepairMode)("apply")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttachmentRepairMode = LiteralKit(["plan", "apply", "undo"]).pipe(
  $I.annoteSchema("AttachmentRepairMode", {
    title: "Attachment Repair Mode",
    description: "plan writes proposals only; apply renames and journals; undo reverts a journal.",
  })
);

/**
 * Options for the attachment repair program.
 *
 * **Details**
 *
 * `plan` and `apply` scan the given trees; `undo` reads `journalPath` and
 * ignores `trees`. Defaults put proposals, journals, and summaries under
 * `<corpusRoot>/staging/provenance/`.
 *
 * **Example** (Plan a repair)
 *
 * ```ts
 * import { AttachmentRepairOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = AttachmentRepairOptions.make({ corpusRoot: "/data/corpus", mode: "plan", trees: ["extract"] })
 * console.log(options.fileCommand) // "file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttachmentRepairOptions extends S.Class<AttachmentRepairOptions>($I`AttachmentRepairOptions`)(
  {
    corpusRoot: S.NonEmptyString,
    fileCommand: S.NonEmptyString.pipe(S.withConstructorDefault(Effect.succeed("file"))),
    journalPath: S.optionalKey(S.NonEmptyString),
    mode: AttachmentRepairMode,
    outputDir: S.optionalKey(S.NonEmptyString),
    trees: S.Array(MailExportTreeLabel),
  },
  $I.annote("AttachmentRepairOptions", {
    title: "Attachment Repair Options",
    description: "Corpus root, mode, trees, the file(1) binary, and optional journal/output overrides.",
  })
) {}

/**
 * Options for the metadata census program.
 *
 * **Details**
 *
 * `roots` are corpus-root-relative directories to scan (for example `raw`,
 * `incoming`, `organized`, `staging/extract/children`). Under staging trees the
 * census visits only `Attachments/` files, never pffexport's own sidecars.
 *
 * **Example** (Census the primary tiers)
 *
 * ```ts
 * import { MetadataCensusOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = MetadataCensusOptions.make({ corpusRoot: "/data/corpus", roots: ["raw", "incoming", "organized"] })
 * console.log(options.batchSize) // 500
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MetadataCensusOptions extends S.Class<MetadataCensusOptions>($I`MetadataCensusOptions`)(
  {
    batchSize: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(S.Natural.make(500)))),
    concurrency: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(S.Natural.make(4)))),
    corpusRoot: S.NonEmptyString,
    exiftoolCommand: S.NonEmptyString.pipe(S.withConstructorDefault(Effect.succeed("exiftool"))),
    outputDir: S.optionalKey(S.NonEmptyString),
    roots: S.Array(S.NonEmptyString),
  },
  $I.annote("MetadataCensusOptions", {
    title: "Metadata Census Options",
    description: "Corpus root, roots to scan, exiftool binary, batch size, concurrency, and output override.",
  })
) {}

/**
 * Walk-level counters for one exported mail tree.
 *
 * **Example** (Summarize a walk)
 *
 * ```ts
 * import { MailExportTreeIndexResult } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex.schemas"
 *
 * const result = MailExportTreeIndexResult.make({ attachmentBytes: 0, attachmentCount: 0, embeddedMessageCount: 0, internetHeaderCount: 0, messageCount: 0, messageIdCount: 0, recipientCount: 0, sourceArtifactCount: 0 })
 * console.log(result.attachmentBytes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailExportTreeIndexResult extends S.Class<MailExportTreeIndexResult>($I`MailExportTreeIndexResult`)(
  {
    attachmentBytes: S.Natural,
    attachmentCount: S.Natural,
    embeddedMessageCount: S.Natural,
    internetHeaderCount: S.Natural,
    messageCount: S.Natural,
    messageIdCount: S.Natural,
    recipientCount: S.Natural,
    sourceArtifactCount: S.Natural,
  },
  $I.annote("MailExportTreeIndexResult", {
    title: "Mail Export Tree Index Result",
    description: "Walk-level counters for one exported mail tree.",
  })
) {}

/**
 * Byte-signature verdict for one file from file(1).
 *
 * **Example** (Construct a verdict)
 *
 * ```ts
 * import { MagicSniffResult } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex.schemas"
 *
 * const result = MagicSniffResult.make({ path: "report.p", mimeType: "application/pdf", extensions: [] })
 * console.log(result.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MagicSniffResult extends S.Class<MagicSniffResult>($I`MagicSniffResult`)(
  {
    path: S.String,
    mimeType: S.String,
    extensions: S.Array(S.String),
  },
  $I.annote("MagicSniffResult", {
    title: "Magic Sniff Result",
    description: "Byte-signature verdict for one file from file(1).",
  })
) {}
