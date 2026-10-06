/**
 * Service contracts for the corpus provenance index: mail export tree
 * indexing, byte-signature attachment sniffing, the rename journal, and the
 * metadata census reader.
 *
 * **Details**
 *
 * Contracts are defined before implementations (schema → service →
 * implementation). Each service owns one external boundary: the pffexport
 * directory layout, the `file(1)` subprocess, the append-only journal file,
 * and the `exiftool` subprocess. Programs in `ProvenanceIndex.ts` compose
 * them; the CLI only wires options.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type { CorpusCommandError } from "../Corpus.errors.ts";
import type {
  AttachmentRepairJournalRow,
  MailExportTreeLabel,
  MailMessageIndexRecord,
  MetadataCensusRecord,
} from "./ProvenanceIndex.schemas.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/ProvenanceIndex.contracts");

/**
 * Walks one pffexport staging tree and yields a normalized record per item.
 *
 * **Details**
 *
 * `indexTree` reads `<corpusRoot>/staging/<tree>/children/*.export/` and
 * emits one {@link MailMessageIndexRecord} per item directory (a directory
 * that directly contains `OutlookHeaders.txt`, excluding `Attachments/` and
 * `AttachmentN/` names). Embedded items under `Attachments/AttachmentN/`
 * are their own records with `embeddedDepth > 0` and are referenced from the
 * parent's attachment list. Records are delivered through `emit` in walk
 * order so the caller can stream them to JSONL without holding the tree in
 * memory.
 *
 * @category services
 * @since 0.0.0
 */
export interface MailExportTreeIndexerShape {
  readonly indexTree: (
    corpusRoot: string,
    tree: typeof MailExportTreeLabel.Type,
    emit: (record: MailMessageIndexRecord) => Effect.Effect<void, CorpusCommandError>
  ) => Effect.Effect<MailExportTreeIndexResult, CorpusCommandError>;
}

/**
 * Walk-level counters returned by {@link MailExportTreeIndexerShape.indexTree}.
 *
 * @category models
 * @since 0.0.0
 */
export interface MailExportTreeIndexResult {
  readonly attachmentBytes: number;
  readonly attachmentCount: number;
  readonly embeddedMessageCount: number;
  readonly internetHeaderCount: number;
  readonly messageCount: number;
  readonly messageIdCount: number;
  readonly recipientCount: number;
  readonly sourceArtifactCount: number;
}

/**
 * Service tag for {@link MailExportTreeIndexerShape}.
 *
 * **Example** (Reference the tag)
 *
 * ```ts
 * import { MailExportTreeIndexer } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof MailExportTreeIndexer) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MailExportTreeIndexer extends Context.Service<MailExportTreeIndexer, MailExportTreeIndexerShape>()(
  $I`MailExportTreeIndexer`
) {}

/**
 * Byte-signature verdict for one file from `file(1)`.
 *
 * **Details**
 *
 * `extensions` is `file --extension`'s slash-separated candidate list split
 * into entries (for example `["jpeg", "jpg", "jpe", "jfif"]`), empty when the
 * tool prints `???`.
 *
 * @category models
 * @since 0.0.0
 */
export interface MagicSniffResult {
  readonly extensions: ReadonlyArray<string>;
  readonly mimeType: string;
  readonly path: string;
}

/**
 * Sniffs file types by magic bytes in batches.
 *
 * **Details**
 *
 * Implementations run `file --mime-type` and `file --extension` over a
 * NUL-delimited name list (`-f - --print0`) and never infer anything from the
 * file name. Results are returned in input order.
 *
 * @category services
 * @since 0.0.0
 */
export interface AttachmentMagicSnifferShape {
  readonly sniff: (paths: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<MagicSniffResult>, CorpusCommandError>;
}

/**
 * Service tag for {@link AttachmentMagicSnifferShape}.
 *
 * **Example** (Reference the tag)
 *
 * ```ts
 * import { AttachmentMagicSniffer } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof AttachmentMagicSniffer) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AttachmentMagicSniffer extends Context.Service<AttachmentMagicSniffer, AttachmentMagicSnifferShape>()(
  $I`AttachmentMagicSniffer`
) {}

/**
 * Append-only JSONL journal of attachment renames.
 *
 * **Details**
 *
 * `append` durably writes one row (fsync before returning) so a crash between
 * the rename and the journal row is the only loss window, and `readAll`
 * decodes every row through the schema. The journal is the undo input.
 *
 * @category services
 * @since 0.0.0
 */
export interface AttachmentRepairJournalShape {
  readonly append: (journalPath: string, row: AttachmentRepairJournalRow) => Effect.Effect<void, CorpusCommandError>;
  readonly readAll: (
    journalPath: string
  ) => Effect.Effect<ReadonlyArray<AttachmentRepairJournalRow>, CorpusCommandError>;
}

/**
 * Service tag for {@link AttachmentRepairJournalShape}.
 *
 * **Example** (Reference the tag)
 *
 * ```ts
 * import { AttachmentRepairJournal } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof AttachmentRepairJournal) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AttachmentRepairJournal extends Context.Service<AttachmentRepairJournal, AttachmentRepairJournalShape>()(
  $I`AttachmentRepairJournal`
) {}

/**
 * Reads document metadata for a batch of files.
 *
 * **Details**
 *
 * Implementations run one `exiftool -j -G1 -n -fast2 -@ <argfile>` process
 * per batch and map each JSON object to a {@link MetadataCensusRecord},
 * selecting the normalized fields from group-qualified tags (PDF, XMP,
 * FlashPix, XML, ZIP, EXIF) and dropping the `System`/`File` filesystem
 * groups from `tags`. A file the engine rejects yields a row with
 * `status: "error"` rather than failing the batch.
 *
 * @category services
 * @since 0.0.0
 */
export interface FileMetadataCensusReaderShape {
  readonly readBatch: (
    corpusRoot: string,
    root: string,
    paths: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<MetadataCensusRecord>, CorpusCommandError>;
  readonly version: Effect.Effect<string, CorpusCommandError>;
}

/**
 * Service tag for {@link FileMetadataCensusReaderShape}.
 *
 * **Example** (Reference the tag)
 *
 * ```ts
 * import { FileMetadataCensusReader } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(typeof FileMetadataCensusReader) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FileMetadataCensusReader extends Context.Service<
  FileMetadataCensusReader,
  FileMetadataCensusReaderShape
>()($I`FileMetadataCensusReader`) {}
