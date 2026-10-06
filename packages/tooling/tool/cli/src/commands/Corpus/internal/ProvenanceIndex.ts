/** Corpus provenance services and streaming programs. @since 0.0.0 */

import { parseInternetHeaders, parseOutlookHeaders } from "@beep/libpff";
import { PosixPath } from "@beep/schema/PosixPath";
import { DateTime, Effect, FileSystem, HashSet, Layer, Path, Stream } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { ChildProcess } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CorpusCommandError } from "../Corpus.errors.ts";
import {
  AttachmentMagicSniffer,
  AttachmentRepairJournal,
  FileMetadataCensusReader,
  MailExportTreeIndexer,
} from "./ProvenanceIndex.contracts.ts";
import * as P from "./ProvenanceIndex.schemas.ts";
import { appendCorpusJsonLines, resolveWithinRoot, writeCorpusStringFile } from "./Shared.ts";
import type { ChildProcessSpawner } from "effect/process";
import type { MagicSniffResult, MailExportTreeIndexResult } from "./ProvenanceIndex.contracts.ts";

type Io = FileSystem.FileSystem | Path.Path;
type ProcessIo = Io | ChildProcessSpawner.ChildProcessSpawner;
const fail = CorpusCommandError.new("Corpus provenance operation failed.");
const encoder = new TextEncoder();
const epoch = (info: FileSystem.File.Info) =>
  O.match(info.mtime, { onNone: () => 0, onSome: (date) => Math.floor(date.getTime() / 1000) });
const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));
const bump = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};
const relative = (path: Path.Path, root: string, file: string) =>
  PosixPath.make(Str.replaceAll("\\", "/")(path.relative(root, file)));

const walk = Effect.fn("Provenance.walk")(function* (
  root: string,
  visit: (file: string, info: FileSystem.File.Info) => Effect.Effect<void, CorpusCommandError, Io>
): Effect.fn.Return<void, CorpusCommandError, Io> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const name of yield* fs.readDirectory(root).pipe(Effect.mapError(fail))) {
    const file = yield* resolveWithinRoot(root, path.join(root, name), "Walk path escapes root");
    const info = yield* fs.stat(file).pipe(Effect.mapError(fail));
    if (info.type === "Directory") yield* walk(file, visit);
    else if (info.type === "File") yield* visit(file, info);
  }
});
const readOptional = Effect.fn("Provenance.readOptional")(function* (root: string, candidate: string) {
  const fs = yield* FileSystem.FileSystem;
  const file = yield* checked(root, candidate);
  return (yield* fs.exists(file)) ? yield* fs.readFileString(file) : undefined;
});
const checked = Effect.fn("Provenance.checked")(function* (root: string, candidate: string) {
  return yield* resolveWithinRoot(root, candidate, "Provenance path escapes corpus root");
});
const childrenRoot = Effect.fn("Provenance.childrenRoot")(function* (root: string, tree: string) {
  const path = yield* Path.Path;
  if (tree === "." || tree === ".." || /[/\\\0]/.test(tree))
    return yield* CorpusCommandError.make({ message: "Tree must be one directory name." });
  return yield* checked(root, path.join(root, "staging", tree, "children"));
});

const outlookFields = {
  clientSubmitTime: "Client submit time",
  conversationTopic: "Conversation topic",
  creationTime: "Creation time",
  deliveryTime: "Delivery time",
  flags: "Flags",
  importance: "Importance",
  modificationTime: "Modification time",
  priority: "Priority",
  senderEmailAddress: "Sender email address",
  senderName: "Sender name",
  sensitivity: "Sensitivity",
  sentRepresentingEmailAddress: "Sent representing email address",
  sentRepresentingName: "Sent representing name",
  subject: "Subject",
};
const parseRecipients = (text: string) =>
  A.map(A.filter(Str.split(text, /\r?\n\s*\r?\n/), Str.isNonEmpty), (block) => {
    const fields = parseOutlookHeaders(block);
    const kind = Str.toLowerCase(fields["Recipient type"] ?? "");
    return P.MailRecipient.make({
      kind:
        kind === "to" || kind === "1"
          ? "to"
          : kind === "cc" || kind === "2"
            ? "cc"
            : kind === "bcc" || kind === "3"
              ? "bcc"
              : "unknown",
      ...(fields["Email address"] === undefined ? {} : { emailAddress: fields["Email address"] }),
      ...((fields["Recipient display name"] ?? fields["Display name"]) !== undefined
        ? { displayName: fields["Recipient display name"] ?? fields["Display name"] }
        : {}),
      ...(fields["Address type"] === undefined ? {} : { addressType: fields["Address type"] }),
    });
  });
const indexTree = Effect.fn("Provenance.indexTree")(function* (
  root: string,
  tree: string,
  emit: (row: P.MailMessageIndexRecord) => Effect.Effect<void, CorpusCommandError>
): Effect.fn.Return<MailExportTreeIndexResult, CorpusCommandError, Io> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const children = yield* childrenRoot(root, tree);
  let sources = HashSet.empty<string>();
  const counts = {
    sourceArtifactCount: 0,
    messageCount: 0,
    embeddedMessageCount: 0,
    internetHeaderCount: 0,
    messageIdCount: 0,
    recipientCount: 0,
    attachmentCount: 0,
    attachmentBytes: 0,
  };
  yield* walk(
    children,
    Effect.fn(function* (file) {
      if (path.basename(file) !== "OutlookHeaders.txt") return;
      const directory = path.dirname(file);
      if (/^(Attachments|Attachment\d+)$/.test(path.basename(directory))) return;
      const messagePath = relative(path, children, directory);
      const parts = Str.split(messagePath, "/");
      const artifactIndex = parts.findIndex((part) => /^artifact:[a-f\d]{64}\.export$/.test(part));
      if (artifactIndex < 0) return;
      const artifact = Str.replace(/\.export$/, "")(parts[artifactIndex] ?? "");
      sources = HashSet.add(sources, artifact);
      const headers = parseOutlookHeaders(yield* fs.readFileString(file).pipe(Effect.mapError(fail)));
      const fields: Record<string, string | number> = {};
      for (const [key, label] of Object.entries(outlookFields))
        if (headers[label] !== undefined) fields[key] = headers[label];
      if (headers.Size !== undefined && /^\d+$/.test(headers.Size)) fields.sizeBytes = Number(headers.Size);
      const outlook = yield* S.decodeEffect(P.OutlookMessageHeaders)(fields).pipe(Effect.mapError(fail));
      const transport = yield* readOptional(root, path.join(directory, "InternetHeaders.txt")).pipe(
        Effect.mapError(fail)
      );
      let internet: P.InternetMessageHeaders | undefined;
      if (transport !== undefined) {
        const h = parseInternetHeaders(transport);
        const selected: Record<string, unknown> = { to: h.to ?? [], cc: h.cc ?? [], references: h.references ?? [] };
        for (const [key, label] of Object.entries({
          contentType: "content-type",
          date: "date",
          from: "from",
          inReplyTo: "in-reply-to",
          messageId: "message-id",
          subject: "subject",
        }))
          if (h[label]?.[0] !== undefined) selected[key] = h[label]?.[0];
        internet = yield* S.decodeUnknownEffect(P.InternetMessageHeaders)(selected).pipe(Effect.mapError(fail));
      }
      const recipients = parseRecipients(
        (yield* readOptional(root, path.join(directory, "Recipients.txt")).pipe(Effect.mapError(fail))) ?? ""
      );
      const attachments: Array<P.MailAttachmentEntry> = [];
      const attachmentDir = path.join(directory, "Attachments");
      if (yield* fs.exists(attachmentDir).pipe(Effect.mapError(fail))) {
        for (const name of yield* fs.readDirectory(attachmentDir).pipe(Effect.mapError(fail))) {
          const attachmentPath = yield* checked(root, path.join(attachmentDir, name));
          const info = yield* fs.stat(attachmentPath).pipe(Effect.mapError(fail));
          if (info.type === "File")
            attachments.push(
              P.MailAttachmentEntry.make({
                kind: "file",
                ordinal: Number(/^(\d+)_/.exec(name)?.[1] ?? 0),
                fileName: name,
                relativePath: relative(path, root, attachmentPath),
                sizeBytes: Number(info.size),
              })
            );
          else if (info.type === "Directory" && /^Attachment\d+$/.test(name)) {
            let embeddedMessagePath: PosixPath | undefined;
            yield* walk(
              attachmentPath,
              Effect.fn(function* (nested) {
                if (embeddedMessagePath === undefined && path.basename(nested) === "OutlookHeaders.txt")
                  embeddedMessagePath = relative(path, root, path.dirname(nested));
              })
            );
            attachments.push(
              P.MailAttachmentEntry.make({
                kind: "embedded-message",
                ordinal: Number(Str.replace("Attachment", "")(name)),
                fileName: name,
                relativePath: relative(path, root, attachmentPath),
                sizeBytes: 0,
                ...(embeddedMessagePath === undefined ? {} : { embeddedMessagePath }),
              })
            );
          }
        }
      }
      let bodyFileName: string | undefined;
      let bodySizeBytes: number | undefined;
      for (const name of ["Message.rtf", "Message.html", "Message.txt"]) {
        if (yield* fs.exists(path.join(directory, name)).pipe(Effect.mapError(fail))) {
          bodyFileName = name;
          bodySizeBytes = Number((yield* fs.stat(path.join(directory, name)).pipe(Effect.mapError(fail))).size);
          break;
        }
      }
      const conversation = yield* readOptional(root, path.join(directory, "ConversationIndex.txt")).pipe(
        Effect.mapError(fail)
      );
      const conversationIndexHex =
        conversation === undefined ? undefined : /Conversation index:\s*([a-f\d]+)/i.exec(conversation)?.[1];
      const embeddedDepth = A.filter(
        parts,
        (part, i) => /^Attachment\d+$/.test(part) && parts[i - 1] === "Attachments"
      ).length;
      const row = P.MailMessageIndexRecord.make({
        tree,
        sourceArtifactId: artifact,
        messagePath,
        folderPath: A.join(parts.slice(artifactIndex + 2, -1), "/"),
        embeddedDepth,
        outlook,
        recipients,
        attachments,
        ...(internet === undefined ? {} : { internet }),
        ...(bodyFileName === undefined ? {} : { bodyFileName }),
        ...(bodySizeBytes === undefined ? {} : { bodySizeBytes }),
        ...(conversationIndexHex === undefined ? {} : { conversationIndexHex }),
      });
      yield* emit(row);
      counts.messageCount++;
      counts.embeddedMessageCount += Number(embeddedDepth > 0);
      counts.internetHeaderCount += Number(internet !== undefined);
      counts.messageIdCount += Number(internet?.messageId !== undefined);
      counts.recipientCount += recipients.length;
      counts.attachmentCount += attachments.length;
      counts.attachmentBytes += A.reduce(attachments, 0, (sum, entry) => sum + entry.sizeBytes);
    })
  );
  counts.sourceArtifactCount = HashSet.size(sources);
  return counts;
});

/**
 * Walk the exported mail layout.
 * **Example** (Provide the walker) `program.pipe(Effect.provide(MailExportTreeIndexerLive))`
 *
 * @category layers
 * @since 0.0.0
 */
export const MailExportTreeIndexerLive = Layer.effect(
  MailExportTreeIndexer,
  Effect.gen(function* () {
    const context = yield* Effect.context<Io>();
    return MailExportTreeIndexer.of({
      indexTree: Effect.fn("MailExportTreeIndexer.indexTree")((root, tree, emit) =>
        indexTree(root, tree, emit).pipe(Effect.provide(context))
      ),
    });
  })
);

const capture = Effect.fn("Provenance.capture")(function* (
  command: string,
  args: ReadonlyArray<string>,
  input?: string
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      // Feeding a regular file through shell redirection avoids platform stdin sink
      // buffering. Arguments remain positional: paths and commands never become shell code.
      const fs = yield* FileSystem.FileSystem;
      let process = ChildProcess.make(command, args, { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
      if (input !== undefined) {
        const inputFile = yield* fs.makeTempFileScoped({ prefix: "beep-magic-" });
        yield* fs.writeFileString(inputFile, input);
        process = ChildProcess.make(
          "sh",
          ["-c", 'input=$1; shift; exec "$@" < "$input"', "beep-provenance", inputFile, command, ...args],
          { stdin: "ignore", stdout: "pipe", stderr: "pipe" }
        );
      }
      const handle = yield* process;
      const [stdout, stderr, code] = yield* Effect.all(
        [
          handle.stdout.pipe(
            Stream.decodeText(),
            Stream.runFold(
              () => "",
              (a, b) => a + b
            )
          ),
          handle.stderr.pipe(
            Stream.decodeText(),
            Stream.runFold(
              () => "",
              (a, b) => a + b
            )
          ),
          handle.exitCode,
        ],
        { concurrency: "unbounded" }
      );
      return { stdout, stderr, code };
    })
  ).pipe(Effect.mapError(fail));
});
const sniff = Effect.fn("Provenance.sniff")(function* (paths: ReadonlyArray<string>, command: string) {
  const results: Array<MagicSniffResult> = [];
  for (const batch of A.chunksOf(paths, 2000)) {
    if (O.isSome(A.findFirst(batch, (file) => /[\r\n\0]/.test(file))))
      return yield* CorpusCommandError.make({ message: "file(1) batch paths cannot contain line breaks or NUL." });
    const input = `${A.join(batch, "\n")}\n`;
    const mime = yield* capture(command, ["-b", "--mime-type", "--print0", "-f", "-"], input);
    const ext = yield* capture(command, ["-b", "--extension", "--print0", "-f", "-"], input);
    if (mime.code !== 0 || ext.code !== 0) return yield* CorpusCommandError.make({ message: "file(1) batch failed." });
    // With -b, file(1) emits verdict lines; --print0 adds filename NULs only without -b.
    const mimes = Str.split(Str.trim(mime.stdout), /\0?\r?\n/);
    const extensions = Str.split(Str.trim(ext.stdout), /\0?\r?\n/);
    if (mimes.length !== batch.length || extensions.length !== batch.length)
      return yield* CorpusCommandError.make({ message: "file(1) output count does not match input batch." });
    for (let i = 0; i < batch.length; i++)
      results.push({
        path: batch[i] ?? "",
        mimeType: Str.trim(mimes[i] ?? ""),
        extensions: A.filter(
          Str.split(Str.toLowerCase(Str.trim(extensions[i] ?? "")), "/"),
          (e) => e !== "???" && Str.isNonEmpty(e)
        ),
      });
  }
  return results;
});
/**
 * Byte-only file identification through `file(1)`.
 *
 * **Example** (Provide a custom binary)
 *
 * ```ts
 * import { AttachmentMagicSnifferLive } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex"
 *
 * const layer = AttachmentMagicSnifferLive("file")
 * console.log(typeof layer) // "object"
 * ```
 *
 * @param command - The `file(1)` binary to spawn; resolved through `PATH` when bare.
 * @returns A layer providing {@link AttachmentMagicSniffer} backed by batched `file` runs.
 * @category layers
 * @since 0.0.0
 */
export const AttachmentMagicSnifferLive = (command = "file") =>
  Layer.effect(
    AttachmentMagicSniffer,
    Effect.gen(function* () {
      const context = yield* Effect.context<ProcessIo>();
      return AttachmentMagicSniffer.of({
        sniff: Effect.fn("AttachmentMagicSniffer.sniff")((paths) =>
          sniff(paths, command).pipe(Effect.provide(context))
        ),
      });
    })
  );

/**
 * Durable JSONL repair journal.
 * **Example** (Provide the journal) `program.pipe(Effect.provide(AttachmentRepairJournalLive))`
 *
 * @category layers
 * @since 0.0.0
 */
export const AttachmentRepairJournalLive = Layer.effect(
  AttachmentRepairJournal,
  Effect.gen(function* () {
    const context = yield* Effect.context<Io>();
    return AttachmentRepairJournal.of({
      append: Effect.fn(
        function* (file, row) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const text = yield* P.AttachmentRepairJournalRowJson.encode(row);
          yield* fs.makeDirectory(path.dirname(file), { recursive: true });
          yield* Effect.scoped(
            Effect.gen(function* () {
              const handle = yield* fs.open(file, { flag: "a" });
              yield* handle.writeAll(encoder.encode(`${text}\n`));
              yield* handle.sync;
              const directory = yield* fs.open(path.dirname(file), { flag: "r" });
              yield* directory.sync;
            })
          );
        },
        Effect.mapError(fail),
        Effect.provide(context)
      ),
      readAll: Effect.fn(
        function* (file) {
          const fs = yield* FileSystem.FileSystem;
          const text = yield* fs.readFileString(file);
          return yield* Effect.forEach(
            A.filter(Str.split(text, /\r?\n/), Str.isNonEmpty),
            P.AttachmentRepairJournalRowJson.decode
          );
        },
        Effect.mapError(fail),
        Effect.provide(context)
      ),
    });
  })
);

/**
 * Determine a clipped-name repair without reading file contents or changing state.
 *
 * **Example** (Complete a PDF name)
 *
 * ```ts
 * import { proposeAttachmentRepair } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex"
 *
 * const result = proposeAttachmentRepair("1_report.p", "application/pdf", ["pdf"])
 * console.log(result.proposedFileName) // "1_report.pdf"
 * ```
 *
 * @param name - The on-disk attachment name including its `N_` ordinal prefix.
 * @param mime - The byte-signature MIME type reported by `file --mime-type`.
 * @param extensions - Lower-case extension candidates from `file --extension`.
 * @returns The clip analysis, flags, decision, and proposed name for the attachment.
 * @category utilities
 * @since 0.0.0
 */
const proposal = (name: string, mime: string, extensions: ReadonlyArray<string>) => {
  const candidates = A.map(extensions, Str.toLowerCase);
  const match = /^(\d+_)(.*)$/.exec(name);
  const prefix = match?.[1] ?? "";
  const rest = match?.[2] ?? name;
  const dot = rest.lastIndexOf(".");
  const remnant = dot < 0 ? "" : Str.toLowerCase(rest.slice(dot + 1));
  let flag: typeof P.AttachmentRepairFlag.Type;
  let proposedFileName: string | undefined;
  if (match === null) flag = "no-ordinal-prefix";
  else if (mime === "application/octet-stream" || candidates.length === 0) flag = "ambiguous-mime";
  else if (A.contains(candidates, remnant)) flag = "already-consistent";
  else if (remnant === "") {
    flag = "extension-fully-eaten";
    proposedFileName = `${prefix}${Str.replace(/\.$/, "")(rest)}.${candidates[0]}`;
  } else {
    const completions = A.filter(candidates, (extension) => Str.startsWith(remnant)(extension));
    const exact = completions.find((extension) => extension.length - remnant.length === prefix.length);
    const candidate = exact ?? completions[0];
    flag =
      exact !== undefined ? "exact-completion" : candidate !== undefined ? "inexact-completion" : "remnant-mismatch";
    proposedFileName =
      candidate === undefined ? `${prefix}${rest}.${candidates[0]}` : `${prefix}${rest.slice(0, dot)}.${candidate}`;
  }
  return {
    clipLength: prefix.length,
    decision:
      proposedFileName === undefined ? P.AttachmentRepairDecision.Enum.skip : P.AttachmentRepairDecision.Enum.rename,
    flags: [flag],
    magicExtensions: candidates,
    mimeType: mime,
    ordinalPrefix: prefix,
    remnantExtension: remnant,
    ...(proposedFileName === undefined ? {} : { proposedFileName }),
  };
};

/**
 * Pure clipped-name proposal with data-first and pipeable signatures.
 * **Example** (Complete a PDF) `proposeAttachmentRepair("1_report.p", "application/pdf", ["pdf"])`
 *
 * @category utilities
 * @since 0.0.0
 */
export const proposeAttachmentRepair: {
  (name: string, mime: string, extensions: ReadonlyArray<string>): ReturnType<typeof proposal>;
  (mime: string, extensions: ReadonlyArray<string>): (name: string) => ReturnType<typeof proposal>;
} = dual(3, proposal);

const metadataFields = {
  fileType: ["File:FileType"],
  mimeType: ["File:MIMEType"],
  createDate: ["PDF:CreateDate", "XMP-xmp:CreateDate", "XML:CreateDate", "FlashPix:CreateDate", "EXIF:CreateDate"],
  modifyDate: ["PDF:ModifyDate", "XMP-xmp:ModifyDate", "XML:ModifyDate", "FlashPix:ModifyDate"],
  author: ["PDF:Author", "XMP-dc:Creator", "XML:Creator", "FlashPix:Author"],
  lastModifiedBy: ["XML:LastModifiedBy", "FlashPix:LastModifiedBy"],
  creatorTool: ["PDF:Creator", "XMP-xmp:CreatorTool", "XML:Application", "FlashPix:Software"],
  producer: ["PDF:Producer"],
  title: ["PDF:Title", "XMP-dc:Title", "XML:Title", "FlashPix:Title"],
  company: ["XML:Company", "FlashPix:Company"],
  pageCount: ["PDF:PageCount", "XML:Pages", "FlashPix:PageCount"],
  revisionNumber: ["XML:RevisionNumber", "FlashPix:RevisionNumber"],
};
const ExiftoolTagSet = S.Record(S.String, S.Unknown);
const ExiftoolRows = S.Array(ExiftoolTagSet).pipe(S.fromJsonString);
const TagText = S.Union([S.String, S.Finite, S.Array(S.String)]);
const normalizeTag = (value: unknown) =>
  S.decodeUnknownOption(TagText)(value).pipe(
    O.map((tag) => (S.is(S.Array(S.String))(tag) ? A.join(tag, "; ") : `${tag}`))
  );
const metadataVersion = Effect.fn("Provenance.metadataVersion")(function* (command: string) {
  const result = yield* capture(command, ["-ver"]);
  if (result.code !== 0) return yield* CorpusCommandError.make({ message: "exiftool version lookup failed." });
  return Str.trim(result.stdout);
});
const readBatch = Effect.fn("Provenance.readBatch")(function* (
  command: string,
  version: string,
  root: string,
  label: string,
  paths: ReadonlyArray<string>
) {
  if (paths.length === 0) return [];
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (A.some(paths, (file) => /[\r\n\0]/.test(file)))
    return yield* CorpusCommandError.make({ message: "exiftool argfile paths cannot contain line breaks or NUL." });
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const argfile = yield* fs.makeTempFileScoped({ prefix: "beep-metadata-" });
      yield* fs.writeFileString(argfile, `${A.join(paths, "\n")}\n`);
      const output = yield* capture(command, ["-j", "-G1", "-n", "-fast2", "-@", argfile]);
      const decoded = yield* S.decodeEffect(ExiftoolRows)(output.stdout);
      return yield* Effect.forEach(
        paths,
        Effect.fn(function* (file) {
          const safeFile = yield* checked(root, file);
          const info = yield* fs.stat(safeFile);
          const tags = decoded.find((tags) => tags.SourceFile === file);
          const errorTag = tags?.["ExifTool:Error"] ?? tags?.Error;
          const error =
            tags === undefined ? "exiftool returned no row for file" : O.getOrUndefined(normalizeTag(errorTag));
          const fields: Record<string, unknown> = {};
          if (tags !== undefined)
            for (const [key, keys] of Object.entries(metadataFields)) {
              const tag = keys.find((candidate) => tags[candidate] !== undefined);
              if (tag === undefined) continue;
              const value = tags[tag];
              if (key === "pageCount") {
                const count = Number(O.getOrElse(normalizeTag(value), () => "NaN"));
                if (Number.isSafeInteger(count) && count >= 0) fields[key] = count;
              } else {
                const text = normalizeTag(value);
                if (O.isSome(text)) fields[key] = text.value;
              }
            }
          const retained: Record<string, unknown> = {};
          if (tags !== undefined)
            for (const [key, value] of Object.entries(tags))
              if (!/^(System|File):/.test(key) && key !== "SourceFile") retained[key] = value;
          return P.MetadataCensusRecord.make({
            engine: "exiftool",
            engineVersion: version,
            root: label,
            relativePath: relative(path, root, file),
            sizeBytes: Number(info.size),
            mtimeEpoch: epoch(info),
            status: error === undefined ? "ok" : "error",
            ...(error === undefined ? {} : { error }),
            fields: yield* S.decodeEffect(P.DocumentMetadataFields)(fields),
            tags: retained,
          });
        })
      );
    })
  ).pipe(Effect.mapError(fail));
});
/**
 * Read document tags through exiftool and decode every JSON result.
 *
 * **Example** (Provide the reader)
 *
 * ```ts
 * import { FileMetadataCensusReaderLive } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex"
 *
 * const layer = FileMetadataCensusReaderLive("exiftool")
 * console.log(typeof layer) // "object"
 * ```
 *
 * @param command - The exiftool binary to spawn; resolved through `PATH` when bare.
 * @returns A layer providing {@link FileMetadataCensusReader} backed by batched exiftool runs.
 * @category layers
 * @since 0.0.0
 */
export const FileMetadataCensusReaderLive = (command = "exiftool") =>
  Layer.effect(
    FileMetadataCensusReader,
    Effect.gen(function* () {
      const context = yield* Effect.context<ProcessIo>();
      const version = yield* Effect.cached(metadataVersion(command).pipe(Effect.provide(context)));
      return FileMetadataCensusReader.of({
        version,
        readBatch: Effect.fn("FileMetadataCensusReader.readBatch")((root, label, paths) =>
          version.pipe(
            Effect.flatMap((version) => readBatch(command, version, root, label, paths)),
            Effect.provide(context)
          )
        ),
      });
    })
  );

const outputRoot = Effect.fn("Provenance.outputRoot")(function* (root: string, output?: string) {
  const path = yield* Path.Path;
  return yield* checked(
    root,
    output === undefined ? path.join(root, "staging", "provenance") : path.resolve(root, output)
  );
});

/**
 * Stream each staging tree to an index and aggregate summary.
 * **Example** (Build an index program)
 * ```ts
 * import { indexMailExportTrees } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex"
 * import { ProvenanceMessagesOptions } from "@beep/repo-cli/commands/Corpus"
 * const program = indexMailExportTrees(ProvenanceMessagesOptions.make({corpusRoot: "/tmp/corpus", trees: ["extract"]}))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const indexMailExportTrees = Effect.fn("Provenance.indexMailExportTrees")(function* (
  options: P.ProvenanceMessagesOptions
) {
  const path = yield* Path.Path;
  const context = yield* Effect.context<Io>();
  const indexer = yield* MailExportTreeIndexer;
  const output = yield* outputRoot(options.corpusRoot, options.outputDir);
  return yield* Effect.forEach(
    options.trees,
    Effect.fn(function* (tree) {
      yield* childrenRoot(options.corpusRoot, tree);
      const file = path.join(output, `messages-${tree}.jsonl`);
      yield* writeCorpusStringFile(file, "");
      const counts = yield* indexer.indexTree(
        options.corpusRoot,
        tree,
        Effect.fn(function* (row) {
          const text = yield* P.MailMessageIndexRecordJson.encode(row).pipe(Effect.mapError(fail));
          yield* appendCorpusJsonLines(file, [text]);
        }, Effect.provide(context))
      );
      const summary = P.MailMessageIndexSummary.make({ ...counts, tree, generatedAt: yield* now });
      yield* writeCorpusStringFile(
        path.join(output, `messages-${tree}.summary.json`),
        yield* P.MailMessageIndexSummaryJson.encode(summary).pipe(Effect.mapError(fail))
      );
      return summary;
    })
  );
});

const attachmentFiles = Effect.fn("Provenance.attachmentFiles")(function* (root: string) {
  const path = yield* Path.Path;
  const files: Array<string> = [];
  yield* walk(
    root,
    Effect.fn(function* (file) {
      if (path.basename(path.dirname(file)) === "Attachments") files.push(file);
    })
  );
  return files;
});
const renameChecked = Effect.fn("Provenance.renameChecked")(function* (
  root: string,
  from: string,
  to: string,
  size: number
) {
  const fs = yield* FileSystem.FileSystem;
  const source = yield* checked(root, from);
  const target = yield* checked(root, to);
  if (!(yield* fs.exists(source))) return P.AttachmentRepairOutcome.Enum["skipped-missing"];
  if (Number((yield* fs.stat(source)).size) !== size) return P.AttachmentRepairOutcome.Enum["skipped-size-changed"];
  if (yield* fs.exists(target)) return P.AttachmentRepairOutcome.Enum["skipped-collision"];
  yield* fs.rename(source, target);
  return P.AttachmentRepairOutcome.Enum.renamed;
}, Effect.mapError(fail));

/**
 * Plan, apply, or undo byte-signature attachment extension repairs.
 * **Example** (Build a plan)
 * ```ts
 * import { repairAttachmentExtensions } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex"
 * import { AttachmentRepairOptions } from "@beep/repo-cli/commands/Corpus"
 * const program = repairAttachmentExtensions(AttachmentRepairOptions.make({corpusRoot: "/tmp/corpus", trees: ["extract"], mode: "plan"}))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const repairAttachmentExtensions = Effect.fn("Provenance.repairAttachmentExtensions")(function* (
  options: P.AttachmentRepairOptions
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const journal = yield* AttachmentRepairJournal;
  const output = yield* outputRoot(options.corpusRoot, options.outputDir);
  const generatedAt = yield* now;
  const runId = Str.replaceAll(/[:.]/g, "-")(generatedAt);
  const journalPath =
    options.mode === "undo"
      ? path.join(output, `attachments-undo-${runId}.journal.jsonl`)
      : options.journalPath === undefined
        ? path.join(output, `attachments-${runId}.journal.jsonl`)
        : yield* checked(options.corpusRoot, path.resolve(options.corpusRoot, options.journalPath));
  const byFlag: Record<string, number> = {};
  const byMime: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  let scannedFiles = 0;
  let proposedRenames = 0;
  if (options.mode === "undo") {
    if (options.journalPath === undefined)
      return yield* CorpusCommandError.make({ message: "Undo requires --journal." });
    const inputPath = yield* checked(options.corpusRoot, path.resolve(options.corpusRoot, options.journalPath));
    const rows = yield* journal.readAll(inputPath);
    for (const row of A.reverse(rows)) {
      if (row.outcome !== "renamed") continue;
      scannedFiles++;
      proposedRenames++;
      bump(byMime, row.mimeType);
      const result = yield* renameChecked(
        options.corpusRoot,
        path.join(options.corpusRoot, row.toPath),
        path.join(options.corpusRoot, row.fromPath),
        row.sizeBytes
      );
      const outcome = result === "renamed" ? "reverted" : result;
      bump(byOutcome, outcome);
      yield* journal.append(
        journalPath,
        P.AttachmentRepairJournalRow.make({ ...row, journalRunId: runId, recordedAt: yield* now, outcome })
      );
    }
  } else {
    const sniffer = yield* AttachmentMagicSniffer;
    for (const tree of options.trees) {
      const root = yield* childrenRoot(options.corpusRoot, tree);
      const files = yield* attachmentFiles(root);
      const proposalFile = path.join(output, `proposals-${tree}.jsonl`);
      yield* writeCorpusStringFile(proposalFile, "");
      for (const batch of A.chunksOf(files, 2000)) {
        const observations = yield* Effect.forEach(batch, (file) => fs.stat(file).pipe(Effect.mapError(fail)));
        const verdicts = yield* sniffer.sniff(batch);
        for (let i = 0; i < verdicts.length; i++) {
          const verdict = verdicts[i];
          const observation = observations[i];
          if (verdict === undefined || observation === undefined) continue;
          const row = P.AttachmentRepairProposal.make({
            ...proposeAttachmentRepair(path.basename(verdict.path), verdict.mimeType, verdict.extensions),
            tree,
            relativePath: relative(path, options.corpusRoot, verdict.path),
            sizeBytes: Number(observation.size),
          });
          scannedFiles++;
          bump(byMime, row.mimeType);
          for (const flag of row.flags) bump(byFlag, flag);
          yield* appendCorpusJsonLines(proposalFile, [
            yield* P.AttachmentRepairProposalJson.encode(row).pipe(Effect.mapError(fail)),
          ]);
          if (row.decision !== "rename" || row.proposedFileName === undefined) continue;
          proposedRenames++;
          if (options.mode !== "apply") continue;
          if (/[/\\\0]/.test(row.proposedFileName))
            return yield* CorpusCommandError.make({ message: "Unsafe magic extension proposal." });
          const target = path.join(path.dirname(verdict.path), row.proposedFileName);
          const outcome = yield* renameChecked(options.corpusRoot, verdict.path, target, row.sizeBytes);
          bump(byOutcome, outcome);
          yield* journal.append(
            journalPath,
            P.AttachmentRepairJournalRow.make({
              fromPath: row.relativePath,
              toPath: relative(path, options.corpusRoot, target),
              tree,
              mimeType: row.mimeType,
              sizeBytes: row.sizeBytes,
              mtimeEpoch: epoch(observation),
              journalRunId: runId,
              recordedAt: yield* now,
              outcome,
            })
          );
        }
      }
    }
  }
  const summary = P.AttachmentRepairSummary.make({
    mode: options.mode,
    trees: options.trees,
    generatedAt,
    scannedFiles,
    proposedRenames,
    byFlag,
    byMime,
    byOutcome,
  });
  yield* writeCorpusStringFile(
    path.join(output, `attachments-${options.mode}.summary.json`),
    yield* P.AttachmentRepairSummaryJson.encode(summary).pipe(Effect.mapError(fail))
  );
  return summary;
});

/**
 * Batch document metadata reads with bounded concurrency and serialize output rows.
 * **Example** (Build a census)
 * ```ts
 * import { runMetadataCensus } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex"
 * import { MetadataCensusOptions } from "@beep/repo-cli/commands/Corpus"
 * const program = runMetadataCensus(MetadataCensusOptions.make({corpusRoot: "/tmp/corpus", roots: ["raw"]}))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runMetadataCensus = Effect.fn("Provenance.runMetadataCensus")(function* (
  options: P.MetadataCensusOptions
) {
  if (options.batchSize < 1 || options.concurrency < 1)
    return yield* CorpusCommandError.make({ message: "Batch size and concurrency must be positive." });
  const path = yield* Path.Path;
  const reader = yield* FileMetadataCensusReader;
  const output = yield* outputRoot(options.corpusRoot, options.outputDir);
  const file = path.join(output, "metadata.jsonl");
  yield* writeCorpusStringFile(file, "");
  const engineVersion = yield* reader.version;
  const byFileType: Record<string, number> = {};
  let fileCount = 0;
  let errorCount = 0;
  let withAuthor = 0;
  let withCreateDate = 0;
  let seen = HashSet.empty<string>();
  for (const label of options.roots) {
    const root = yield* checked(options.corpusRoot, path.resolve(options.corpusRoot, label));
    const rootRelative = relative(path, options.corpusRoot, root);
    const staging = rootRelative === "staging" || Str.startsWith("staging/")(rootRelative);
    const files: Array<string> = [];
    yield* walk(
      root,
      Effect.fn(function* (candidate) {
        if (staging && path.basename(path.dirname(candidate)) !== "Attachments") return;
        if (HashSet.has(seen, candidate)) return;
        seen = HashSet.add(seen, candidate);
        files.push(candidate);
      })
    );
    // Bound each concurrent wave so the full census is never retained in memory.
    for (const wave of A.chunksOf(A.chunksOf(files, options.batchSize), options.concurrency)) {
      const batches = yield* Effect.forEach(wave, (batch) => reader.readBatch(options.corpusRoot, label, batch), {
        concurrency: options.concurrency,
      });
      for (const batch of batches)
        for (const row of batch) {
          fileCount++;
          errorCount += Number(row.status === "error");
          withAuthor += Number(row.fields.author !== undefined);
          withCreateDate += Number(row.fields.createDate !== undefined);
          bump(byFileType, row.fields.fileType ?? "unknown");
          yield* appendCorpusJsonLines(file, [
            yield* P.MetadataCensusRecordJson.encode(row).pipe(Effect.mapError(fail)),
          ]);
        }
    }
  }
  const summary = P.MetadataCensusSummary.make({
    engineVersion,
    roots: options.roots,
    generatedAt: yield* now,
    fileCount,
    okCount: fileCount - errorCount,
    errorCount,
    withAuthor,
    withCreateDate,
    byFileType,
  });
  yield* writeCorpusStringFile(
    path.join(output, "metadata.summary.json"),
    yield* P.MetadataCensusSummaryJson.encode(summary).pipe(Effect.mapError(fail))
  );
  return summary;
});
