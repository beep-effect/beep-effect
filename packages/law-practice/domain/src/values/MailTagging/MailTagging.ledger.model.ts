/**
 * Mail-tagging ledgers and job state: the append-only tag ledger, the filing
 * ledger, and the backfill checkpoint.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  DocumentFileId,
  DocumentFolderId,
  InternetMessageId,
  MailAttachmentId,
  MailMessageId,
  TaggingRunId,
} from "./MailTagging.ids.model.ts";
import { TaggingDecision, UnmatchedReason } from "./MailTagging.matching.model.ts";
import { MailCategoryName, MatterKey } from "./MailTagging.taxonomy.model.ts";
import type { MatterMatched, MatterUnmatched } from "./MailTagging.matching.model.ts";

const $I = $LawPracticeDomainId.create("values/MailTagging/MailTagging.ledger.model");

/**
 * Whether a run only reports (`dry-run`) or also writes (`apply`).
 *
 * **Example** (Guard a tagging mode)
 *
 * ```ts
 * import { TaggingMode } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TaggingMode)("dry-run")) // true
 * console.log(S.is(TaggingMode)("force")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaggingMode = LiteralKit(["dry-run", "apply"]).pipe(
  $I.annoteSchema("TaggingMode", {
    description: "Whether a tagging run only reports or also writes.",
  })
);

/**
 * Runtime type for {@link TaggingMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type TaggingMode = typeof TaggingMode.Type;

/**
 * Outcome tag of a tagging decision, as recorded in the tag ledger.
 *
 * **Example** (Guard a tagging outcome)
 *
 * ```ts
 * import { TaggingOutcome } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TaggingOutcome)("MatterMatched")) // true
 * console.log(S.is(TaggingOutcome)("MatterGuessed")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaggingOutcome = LiteralKit(["MatterMatched", "MatterUnmatched"]).pipe(
  $I.annoteSchema("TaggingOutcome", {
    description: "Outcome tag of a tagging decision.",
  })
);

/**
 * Runtime type for {@link TaggingOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type TaggingOutcome = typeof TaggingOutcome.Type;

/**
 * Ledger-sized summary of a tagging decision: ids and numbers only.
 *
 * **Details**
 *
 * `matterKey` and `confidence` are present for a matched outcome; `reason` is
 * present for an unmatched one. Evidence and candidates are not recorded.
 *
 * **Example** (Decode an unmatched summary)
 *
 * ```ts
 * import { TagDecisionSummary } from "@beep/law-practice-domain/values"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summary = S.decodeUnknownSync(TagDecisionSummary)({ outcome: "MatterUnmatched", reason: "ambiguous" })
 * console.log(O.getOrNull(summary.reason)) // "ambiguous"
 * console.log(O.isNone(summary.matterKey)) // true
 * ```
 *
 * @see {@link summarizeDecision} for the constructor from a full decision.
 * @category models
 * @since 0.0.0
 */
export class TagDecisionSummary extends S.Class<TagDecisionSummary>($I`TagDecisionSummary`)(
  {
    outcome: TaggingOutcome.annotateKey({
      description: "Outcome tag of the decision.",
    }),
    matterKey: S.OptionFromNullOr(MatterKey)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Matched matter; none when unmatched.",
      }),
    confidence: S.OptionFromNullOr(UnitInterval)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Confidence of the match; none when unmatched.",
      }),
    reason: S.OptionFromNullOr(UnmatchedReason)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Why no matter was assigned; none when matched.",
      }),
  },
  $I.annote("TagDecisionSummary", {
    description: "Ledger-sized summary of a tagging decision: outcome, matter, confidence, and reason.",
  })
) {}

const summarizeMatched = (decision: MatterMatched): TagDecisionSummary =>
  TagDecisionSummary.make({
    outcome: TaggingOutcome.Enum.MatterMatched,
    matterKey: O.some(decision.matterKey),
    confidence: O.some(decision.confidence),
  });

const summarizeUnmatched = (decision: MatterUnmatched): TagDecisionSummary =>
  TagDecisionSummary.make({
    outcome: TaggingOutcome.Enum.MatterUnmatched,
    reason: O.some(decision.reason),
  });

/**
 * Reduces a tagging decision to its ledger summary.
 *
 * **Example** (Summarize an unmatched decision)
 *
 * ```ts
 * import { MatterUnmatched, summarizeDecision } from "@beep/law-practice-domain/values"
 *
 * const summary = summarizeDecision(MatterUnmatched.make({ reason: "below-threshold" }))
 * console.log(summary.outcome) // "MatterUnmatched"
 * ```
 *
 * @param decision - Tagging decision for one message.
 * @returns The outcome tag with the matter and confidence, or the reason.
 * @category constructors
 * @since 0.0.0
 */
export const summarizeDecision: (decision: TaggingDecision) => TagDecisionSummary = TaggingDecision.match({
  MatterMatched: summarizeMatched,
  MatterUnmatched: summarizeUnmatched,
});

/**
 * Tag-ledger line: categories one run added to one message.
 *
 * **Gotchas**
 *
 * `addedCategories` lists only what this run added. Undo may remove exactly
 * these, and only the ones still present on the message.
 *
 * **Example** (Record applied categories)
 *
 * ```ts
 * import {
 *   MailMessageId,
 *   MatterUnmatched,
 *   TaggingRunId,
 *   TagLedgerEntry,
 *   summarizeDecision
 * } from "@beep/law-practice-domain/values"
 * import * as DateTime from "effect/DateTime"
 *
 * const entry = TagLedgerEntry.make({
 *   runId: TaggingRunId.make("run-0001"),
 *   messageId: MailMessageId.make("msg-0001"),
 *   addedCategories: ["P: USPTO"],
 *   decision: summarizeDecision(MatterUnmatched.make({ reason: "no-signal", practiceCategories: ["P: USPTO"] })),
 *   recordedAt: DateTime.makeUnsafe("2026-07-01T12:00:00.000Z")
 * })
 * console.log(entry._tag) // "TagApplied"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TagLedgerEntry extends S.TaggedClass<TagLedgerEntry>($I`TagLedgerEntry`)(
  "TagApplied",
  {
    runId: TaggingRunId.annotateKey({
      description: "Run that added the categories.",
    }),
    messageId: MailMessageId.annotateKey({
      description: "Provider id of the tagged message.",
    }),
    internetMessageId: S.OptionFromNullOr(InternetMessageId)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "RFC 5322 Message-ID of the tagged message, when known.",
      }),
    addedCategories: S.Array(MailCategoryName).annotateKey({
      description: "Owned categories this run added to the message.",
    }),
    decision: TagDecisionSummary.annotateKey({
      description: "Summary of the decision behind the write.",
    }),
    recordedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant the line was recorded.",
    }),
  },
  $I.annote("TagLedgerEntry", {
    description: "Tag-ledger line recording the categories one run added to one message.",
  })
) {}

/**
 * Tag-ledger line: categories an undo run removed from one message.
 *
 * **Example** (Record removed categories)
 *
 * ```ts
 * import { MailMessageId, TaggingRunId, TagUndoEntry } from "@beep/law-practice-domain/values"
 * import * as DateTime from "effect/DateTime"
 *
 * const entry = TagUndoEntry.make({
 *   runId: TaggingRunId.make("undo-0001"),
 *   originalRunId: TaggingRunId.make("run-0001"),
 *   messageId: MailMessageId.make("msg-0001"),
 *   removedCategories: ["P: USPTO"],
 *   recordedAt: DateTime.makeUnsafe("2026-07-02T12:00:00.000Z")
 * })
 * console.log(entry._tag) // "TagUndone"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TagUndoEntry extends S.TaggedClass<TagUndoEntry>($I`TagUndoEntry`)(
  "TagUndone",
  {
    runId: TaggingRunId.annotateKey({
      description: "Undo run that removed the categories.",
    }),
    originalRunId: TaggingRunId.annotateKey({
      description: "Run whose additions were undone.",
    }),
    messageId: MailMessageId.annotateKey({
      description: "Provider id of the message.",
    }),
    removedCategories: S.Array(MailCategoryName).annotateKey({
      description: "Owned categories the undo run removed from the message.",
    }),
    recordedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant the line was recorded.",
    }),
  },
  $I.annote("TagUndoEntry", {
    description: "Tag-ledger line recording the categories an undo run removed from one message.",
  })
) {}

/**
 * Any line of the append-only tag ledger.
 *
 * **Example** (Branch on a ledger record)
 *
 * ```ts
 * import { MailMessageId, TaggingRunId, TagLedgerRecord, TagUndoEntry } from "@beep/law-practice-domain/values"
 * import * as DateTime from "effect/DateTime"
 *
 * const record = TagUndoEntry.make({
 *   runId: TaggingRunId.make("undo-0002"),
 *   originalRunId: TaggingRunId.make("run-0002"),
 *   messageId: MailMessageId.make("msg-0002"),
 *   removedCategories: [],
 *   recordedAt: DateTime.makeUnsafe("2026-07-02T12:00:00.000Z")
 * })
 * const count = TagLedgerRecord.match(record, {
 *   TagApplied: ({ addedCategories }) => addedCategories.length,
 *   TagUndone: ({ removedCategories }) => removedCategories.length
 * })
 * console.log(count) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TagLedgerRecord = S.Union([TagLedgerEntry, TagUndoEntry]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("TagLedgerRecord", {
    description: "Any line of the append-only tag ledger: applied or undone.",
  })
);

/**
 * Runtime type for {@link TagLedgerRecord}.
 *
 * @category models
 * @since 0.0.0
 */
export type TagLedgerRecord = typeof TagLedgerRecord.Type;

/**
 * Codec between one JSONL line and a {@link TagLedgerRecord}.
 *
 * **Example** (Decode one tag-ledger line)
 *
 * ```ts
 * import { TagLedgerRecordJsonLine } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const line =
 *   '{"_tag":"TagUndone","runId":"undo-0003","originalRunId":"run-0003","messageId":"msg-0003","removedCategories":["P: Admin"],"recordedAt":"2026-07-02T12:00:00.000Z"}'
 * const record = S.decodeUnknownSync(TagLedgerRecordJsonLine)(line)
 * console.log(record._tag) // "TagUndone"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const TagLedgerRecordJsonLine = S.fromJsonString(TagLedgerRecord).pipe(
  $I.annoteSchema("TagLedgerRecordJsonLine", {
    description: "One JSONL line of the tag ledger.",
  })
);

/**
 * Runtime type for {@link TagLedgerRecordJsonLine}.
 *
 * @category models
 * @since 0.0.0
 */
export type TagLedgerRecordJsonLine = typeof TagLedgerRecordJsonLine.Type;

/**
 * SHA-256 of an attachment's bytes: 64 lowercase hex characters.
 *
 * **Example** (Reject a malformed content hash)
 *
 * ```ts
 * import { ContentSha256 } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * console.log(S.is(ContentSha256)(digest)) // true
 * console.log(S.is(ContentSha256)(digest.toUpperCase())) // false
 * console.log(S.is(ContentSha256)("e3b0c442")) // false
 * ```
 *
 * @see {@link Sha256Hex} for the underlying digest schema.
 * @category value-objects
 * @since 0.0.0
 */
export const ContentSha256 = Sha256Hex.pipe(
  S.brand("ContentSha256"),
  $I.annoteSchema("ContentSha256", {
    description: "SHA-256 of an attachment's bytes as 64 lowercase hex characters.",
  })
);

/**
 * Type-level brand produced by {@link ContentSha256}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContentSha256 = typeof ContentSha256.Type;

/**
 * Filing-ledger line: one attachment filed into a matter's folder.
 *
 * **Details**
 *
 * The dedupe key is `(contentSha256, matterKey)`: the same bytes are filed at
 * most once per matter.
 *
 * **Example** (Decode a filing-ledger entry)
 *
 * ```ts
 * import { FilingLedgerEntry } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const entry = S.decodeUnknownSync(FilingLedgerEntry)({
 *   contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   matterKey: "acme.10001",
 *   folderId: "100001",
 *   fileId: "200001",
 *   fileName: "office-action.pdf",
 *   messageId: "msg-0001",
 *   attachmentId: "att-0001",
 *   byteLength: 1024,
 *   recordedAt: "2026-07-01T12:00:00.000Z"
 * })
 * console.log(entry.fileName) // "office-action.pdf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FilingLedgerEntry extends S.Class<FilingLedgerEntry>($I`FilingLedgerEntry`)(
  {
    contentSha256: ContentSha256.annotateKey({
      description: "SHA-256 of the filed bytes.",
    }),
    matterKey: MatterKey.annotateKey({
      description: "Matter the attachment was filed under.",
    }),
    folderId: DocumentFolderId.annotateKey({
      description: "Document-store folder the file was uploaded into.",
    }),
    fileId: DocumentFileId.annotateKey({
      description: "Document-store id of the uploaded file.",
    }),
    fileName: S.NonEmptyString.annotateKey({
      description: "Name the file was stored under, including any collision suffix.",
    }),
    messageId: MailMessageId.annotateKey({
      description: "Message the attachment came from.",
    }),
    attachmentId: MailAttachmentId.annotateKey({
      description: "Provider id of the attachment.",
    }),
    byteLength: S.Natural.annotateKey({
      description: "Size of the filed bytes.",
    }),
    recordedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant the line was recorded.",
    }),
  },
  $I.annote("FilingLedgerEntry", {
    description: "Filing-ledger line recording one attachment filed into a matter's folder.",
  })
) {}

/**
 * Codec between one JSONL line and a {@link FilingLedgerEntry}.
 *
 * **Example** (Decode one filing-ledger line)
 *
 * ```ts
 * import { FilingLedgerEntryJsonLine } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const line =
 *   '{"contentSha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","matterKey":"acme.10001","folderId":"100001","fileId":"200002","fileName":"response.pdf","messageId":"msg-0002","attachmentId":"att-0002","byteLength":2048,"recordedAt":"2026-07-01T12:00:00.000Z"}'
 * const entry = S.decodeUnknownSync(FilingLedgerEntryJsonLine)(line)
 * console.log(entry.byteLength) // 2048
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const FilingLedgerEntryJsonLine = S.fromJsonString(FilingLedgerEntry).pipe(
  $I.annoteSchema("FilingLedgerEntryJsonLine", {
    description: "One JSONL line of the filing ledger.",
  })
);

/**
 * Runtime type for {@link FilingLedgerEntryJsonLine}.
 *
 * @category models
 * @since 0.0.0
 */
export type FilingLedgerEntryJsonLine = typeof FilingLedgerEntryJsonLine.Type;

/**
 * Why an attachment was not filed.
 *
 * **Example** (Guard a skip reason)
 *
 * ```ts
 * import { AttachmentSkipReason } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AttachmentSkipReason)("inline")) // true
 * console.log(S.is(AttachmentSkipReason)("duplicate")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttachmentSkipReason = LiteralKit(["inline", "not-a-file", "empty", "too-large"]).pipe(
  $I.annoteSchema("AttachmentSkipReason", {
    description: "Why an attachment was not filed.",
  })
);

/**
 * Runtime type for {@link AttachmentSkipReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type AttachmentSkipReason = typeof AttachmentSkipReason.Type;

/**
 * Resume point of the backfill: where the ascending received-time scan stands.
 *
 * **Example** (Decode a fresh checkpoint)
 *
 * ```ts
 * import { BackfillCheckpoint } from "@beep/law-practice-domain/values"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const checkpoint = S.decodeUnknownSync(BackfillCheckpoint)({ since: "2026-07-01T00:00:00.000Z" })
 * console.log(checkpoint.processed) // 0
 * console.log(O.isNone(checkpoint.lastMessageId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BackfillCheckpoint extends S.Class<BackfillCheckpoint>($I`BackfillCheckpoint`)(
  {
    since: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant the backfill starts from.",
    }),
    lastReceivedAt: S.OptionFromNullOr(S.DateTimeUtcFromString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Received instant of the last processed message; none before the first page.",
      }),
    lastMessageId: S.OptionFromNullOr(MailMessageId)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Id of the last processed message; none before the first page.",
      }),
    processed: S.Natural.pipe(
      S.withDecodingDefaultKey(Effect.succeed(0)),
      S.withConstructorDefault(Effect.succeed(0))
    ).annotateKey({
      description: "Messages processed so far.",
    }),
  },
  $I.annote("BackfillCheckpoint", {
    description: "Resume point of the mail-tagging backfill.",
  })
) {}

/**
 * Codec between the checkpoint file's JSON text and a
 * {@link BackfillCheckpoint}.
 *
 * **Example** (Decode checkpoint JSON)
 *
 * ```ts
 * import { BackfillCheckpointJson } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const checkpoint = S.decodeUnknownSync(BackfillCheckpointJson)(
 *   '{"since":"2026-07-01T00:00:00.000Z","lastReceivedAt":null,"lastMessageId":null,"processed":12}'
 * )
 * console.log(checkpoint.processed) // 12
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const BackfillCheckpointJson = S.fromJsonString(BackfillCheckpoint).pipe(
  $I.annoteSchema("BackfillCheckpointJson", {
    description: "JSON text of the backfill checkpoint.",
  })
);

/**
 * Runtime type for {@link BackfillCheckpointJson}.
 *
 * @category models
 * @since 0.0.0
 */
export type BackfillCheckpointJson = typeof BackfillCheckpointJson.Type;
