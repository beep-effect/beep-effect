/**
 * Live Markdown projector: imports a memory folder into the log and projects
 * the log back to Markdown files with the raw-slice (L0) boundary.
 *
 * **Details**
 *
 * {@link MarkdownProjectorLayer} provides {@link MarkdownProjector} over
 * {@link MemoryLog}, the platform `FileSystem` and a `SqlClient`. It folds the
 * log into memory and catches up from its last cursor before every operation,
 * so several processes can share one log.
 *
 * - Memory files are the regular files under the folder whose relative path
 *   ends in `.md` and has no segment starting with `.` (decision
 *   `memory-files-are-md-files-outside-dot-segments`).
 * - `importFolder` cuts each file with {@link partition} and appends every
 *   `NodeCreated`, one `FileImported` per file and the `FolderImported`
 *   bootstrap event in one journal transaction (decision
 *   `folder-import-is-one-journal-transaction`). It never writes to the folder.
 * - `exportFolder` writes only files whose bytes differ, each through a
 *   temporary file and a rename, and first checks that every memory file in
 *   the folder holds bytes this store imported from or wrote to that same
 *   folder, identified by its resolved path; otherwise it fails with
 *   `UnimportedFolderError` before writing anything (decision
 *   `export-fence-is-bound-to-the-folder`).
 * - A second `importFolder` passes the same fence and returns the current
 *   base; any other folder fails with `ForeignFolderError`.
 * - `projectNode` returns the raw-slice edit from the node's state before its
 *   latest event to its current state and refuses an edit the reparse check
 *   finds disturbing with `ReparseRefusedError` (decision
 *   `projector-refusals-are-typed-errors`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { MarkdownEdit } from "@beep/markdown";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity, TextAnchor } from "@beep/provenance";
import { PosixPath, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import {
  ForeignFolderError,
  ProjectionError,
  ReparseRefusedError,
  UnimportedFolderError,
} from "./AgentMemoryStore.errors.ts";
import { applyEntries, fileNodes, filePaths, joinText, makeProjection } from "./internal/MarkdownProjection.ts";
import { NodeReplacement } from "./MarkdownPartition.models.ts";
import { checkReplacement, partition } from "./MarkdownPartition.parser.ts";
import { MarkdownProjector } from "./MarkdownProjector.service.ts";
import { MemoryLogLayer, makeMemorySqlClientLayer } from "./MemoryLog.layer.ts";
import { MemoryLog } from "./MemoryLog.service.ts";
import { FileImported, FolderImported, NodeCreated } from "./NodeEvent.events.ts";
import { contentHashOf, revisionIdOf, sha256Hex } from "./NodeIdentity.digest.ts";
import { MemoryFilePath, NodeId } from "./NodeIdentity.models.ts";
import { LineageId } from "./Observation.events.ts";
import { BaseExport, BaseFile, BaseNode } from "./Operation.models.ts";
import { OccurrenceAnchor } from "./SpanAnchor.models.ts";
import type { SqliteClientConfig } from "@beep/sqlite";
import type { MemoryLogError } from "./AgentMemoryStore.errors.ts";
import type { ProjectedNode, Projection } from "./internal/MarkdownProjection.ts";
import type { MarkdownPartition, PartitionNode } from "./MarkdownPartition.models.ts";
import type { MemoryEvent } from "./NodeEvent.events.ts";

/**
 * Lineage the projector writes import events under.
 *
 * **Example** (Read the import lineage)
 *
 * ```ts
 * import { MarkdownImportLineage } from "@beep/agent-memory-store"
 *
 * console.log(MarkdownImportLineage) // "agent-memory-store:import"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MarkdownImportLineage: LineageId = LineageId.make("agent-memory-store:import");

/**
 * Extractor pin recorded in every import anchor and base export anchor.
 *
 * **Example** (Read the extractor pin)
 *
 * ```ts
 * import { MarkdownPartitionExtractor } from "@beep/agent-memory-store"
 *
 * console.log(MarkdownPartitionExtractor.version) // "1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MarkdownPartitionExtractor: SourceTextExtractor = SourceTextExtractor.make({
  name: "@beep/agent-memory-store/MarkdownPartition",
  version: "1",
});

/**
 * Whether a path relative to a memory folder names a memory file.
 *
 * **Details**
 *
 * A memory file's relative path ends in `.md` and has no segment starting with
 * `.`, so hidden folders, editor swap files and the projector's own temporary
 * files are never read or written.
 *
 * **Example** (Check memory file paths)
 *
 * ```ts
 * import { isMemoryFilePath } from "@beep/agent-memory-store"
 *
 * console.log(isMemoryFilePath("notes/decisions.md")) // true
 * console.log(isMemoryFilePath(".git/notes.md")) // false
 * ```
 *
 * @param relativePath - The path relative to the memory folder.
 * @returns `true` when the path names a memory file.
 * @category predicates
 * @since 0.0.0
 */
export const isMemoryFilePath = (relativePath: string): boolean =>
  Str.endsWith(".md")(relativePath) &&
  A.every(Str.split(relativePath, "/"), (segment) => Str.isNonEmpty(segment) && !Str.startsWith(".")(segment));

// A memory file as read from disk.
interface DiskFile {
  readonly bytes: Uint8Array;
  readonly digest: Sha256Hex;
  readonly path: MemoryFilePath;
}

// A memory file as the log projects it.
interface BuiltFile {
  readonly bytes: Uint8Array;
  readonly digest: Sha256Hex;
  readonly nodes: ReadonlyArray<ProjectedNode>;
  readonly path: MemoryFilePath;
}

const FolderListing = S.Array(S.Tuple([MemoryFilePath, Sha256Hex]));
const encodeFolderListing = S.encodeEffect(S.fromJsonString(FolderListing));

const FolderFileRows = S.Array(S.Struct({ file_path: S.String, file_digest: S.String }));
const decodeFolderFileRows = S.decodeUnknownEffect(FolderFileRows);

const utf8 = new TextEncoder();
// `ignoreBOM` keeps a leading byte order mark in the text, so it becomes the
// file's first gap node and the bytes round-trip; `fatal` refuses bytes that
// are not UTF-8, which could not round-trip.
const strictUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

const knownKey = (path: string, digest: string): string => `${path}\u0000${digest}`;

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index]);

const joinPath = (root: string, relative: string): string =>
  Str.endsWith("/")(root) ? `${root}${relative}` : `${root}/${relative}`;

const parentOf = (path: string): string =>
  O.match(Str.lastIndexOf("/")(path), {
    onNone: () => ".",
    onSome: (slash) => (slash === 0 ? "/" : Str.slice(0, slash)(path)),
  });

const nameOf = (path: string): string =>
  O.match(Str.lastIndexOf("/")(path), {
    onNone: () => path,
    onSome: (slash) => Str.slice(slash + 1)(path),
  });

const failure = (operation: string, path: O.Option<MemoryFilePath>) => (cause: unknown) =>
  ProjectionError.make({ ...ProjectionError.fromUnknown(operation, cause), path });

const createTables = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  // Bytes this store imported from or wrote to each folder, keyed by the
  // folder's resolved path.
  yield* sql`
    CREATE TABLE IF NOT EXISTS agent_memory_folder_files (
      root TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_digest TEXT NOT NULL,
      PRIMARY KEY (root, file_path, file_digest)
    )`;
});

// The node run of `base` the raw slice [offset, offset + length) touches,
// widened to node boundaries, with the replacement text for that run. An
// insertion on a node boundary touches no node.
const replacementRun = (
  base: MarkdownPartition,
  baseText: string,
  offset: number,
  length: number,
  content: string
): NodeReplacement => {
  const { nodes } = base;
  const end = offset + length;
  const endOf = (node: PartitionNode): number => node.range.offset + node.range.length;
  const first = O.getOrElse(
    A.findFirstIndex(nodes, (node) => endOf(node) > offset),
    () => nodes.length
  );
  const onBoundary =
    length === 0 &&
    O.match(A.get(nodes, first), { onNone: () => true, onSome: (node) => node.range.offset === offset });
  const last = onBoundary
    ? first
    : O.getOrElse(
        A.findFirstIndex(nodes, (node) => node.range.offset >= end),
        () => nodes.length
      );
  const runStart = O.getOrElse(
    O.map(A.get(nodes, first), (node) => node.range.offset),
    () => offset
  );
  const runEnd = O.getOrElse(O.map(A.get(nodes, last - 1), endOf), () => end);
  return NodeReplacement.make({
    start: first,
    end: last,
    text: onBoundary
      ? content
      : `${Str.slice(runStart, offset)(baseText)}${content}${Str.slice(end, runEnd)(baseText)}`,
  });
};

const make = Effect.gen(function* () {
  yield* createTables().pipe(Effect.mapError(failure("openTables", O.none())));
  const sql = yield* SqlClient.SqlClient;
  const log = yield* MemoryLog;
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const random = yield* SecureRandom.SecureRandom;
  const lock = yield* Semaphore.make(1);
  const projection: Projection = makeProjection();

  const withServices = <A, E>(effect: Effect.Effect<A, E, Digest.Digest>) =>
    Effect.provideService(effect, Digest.Digest, digest);

  // Folds every entry committed since the last operation, so the fold
  // reflects writes by other processes.
  const catchUp = (operation: string) =>
    log.entriesAfter(projection.cursor).pipe(
      Effect.flatMap((entries) => applyEntries(projection, entries)),
      Effect.mapError(failure(operation, O.none()))
    );

  const folderDigestOf = (operation: string, listing: ReadonlyArray<readonly [MemoryFilePath, Sha256Hex]>) =>
    encodeFolderListing(listing).pipe(
      Effect.flatMap((json) => withServices(sha256Hex(utf8.encode(json)))),
      Effect.mapError(failure(operation, O.none()))
    );

  const scanFolder = Effect.fnUntraced(function* (operation: string, root: PosixPath) {
    const exists = yield* fs.exists(root).pipe(Effect.mapError(failure(operation, O.none())));
    if (!exists) {
      return A.empty<DiskFile>();
    }
    const entries = yield* fs
      .readDirectory(root, { recursive: true })
      .pipe(Effect.mapError(failure(operation, O.none())));
    const files: Array<DiskFile> = [];
    for (const relative of A.sort(A.filter(entries, isMemoryFilePath), Order.String)) {
      const path = MemoryFilePath.make(relative);
      const absolute = joinPath(root, relative);
      const info = yield* fs.stat(absolute).pipe(Effect.mapError(failure(operation, O.some(path))));
      if (info.type === "File") {
        const bytes = yield* fs.readFile(absolute).pipe(Effect.mapError(failure(operation, O.some(path))));
        const fileDigest = yield* withServices(sha256Hex(bytes));
        files.push({ path, bytes, digest: fileDigest });
      }
    }
    return files;
  });

  const decodeText = (path: MemoryFilePath, bytes: Uint8Array) =>
    Effect.try({
      try: () => strictUtf8.decode(bytes),
      catch: failure("importFolder", O.some(path)),
    });

  const listingOf = (files: ReadonlyArray<{ readonly path: MemoryFilePath; readonly digest: Sha256Hex }>) =>
    A.map(files, (file) => [file.path, file.digest] as const);

  // A folder is identified by its resolved path, so two spellings of one
  // folder share their records and a copy elsewhere shares none.
  const folderKeyOf = (operation: string, root: PosixPath) =>
    fs.realPath(root).pipe(Effect.mapError(failure(operation, O.none())));

  // Bytes this store imported from or wrote to the folder `key` names.
  const knownBytes = Effect.fnUntraced(function* (operation: string, key: string) {
    const rows = yield* sql`SELECT file_path, file_digest FROM agent_memory_folder_files WHERE root = ${key}`.pipe(
      Effect.flatMap(decodeFolderFileRows),
      Effect.mapError(failure(operation, O.none()))
    );
    const known = MutableHashSet.empty<string>();
    for (const row of rows) {
      MutableHashSet.add(known, knownKey(row.file_path, row.file_digest));
    }
    return known;
  });

  // Records the bytes of `files` as known in the folder `key` names. The rows
  // land before the bytes they describe, so a write cut short leaves every
  // file at bytes the fence knows.
  const recordFolderFiles = (
    operation: string,
    key: string,
    files: ReadonlyArray<{ readonly path: MemoryFilePath; readonly digest: Sha256Hex }>
  ) =>
    A.match(files, {
      onEmpty: () => Effect.void,
      onNonEmpty: (rows) =>
        sql`
          INSERT INTO agent_memory_folder_files ${sql.insert(
            A.map(rows, (file) => ({ root: key, file_path: file.path, file_digest: file.digest }))
          )}
          ON CONFLICT DO NOTHING`.pipe(Effect.asVoid, Effect.mapError(failure(operation, O.none()))),
    });

  // The fence of AC-8: the log imported a folder, and every memory file in
  // this folder holds bytes this store imported from or wrote to this same
  // folder. A folder with no memory files passes, so the log can be rebuilt
  // into an empty folder.
  const isProjectedFolder = Effect.fnUntraced(function* (
    operation: string,
    root: PosixPath,
    disk: ReadonlyArray<DiskFile>
  ) {
    if (MutableHashSet.size(projection.folders) === 0) {
      return false;
    }
    if (!A.isReadonlyArrayNonEmpty(disk)) {
      return true;
    }
    const key = yield* folderKeyOf(operation, root);
    const known = yield* knownBytes(operation, key);
    return A.every(disk, (file) => MutableHashSet.has(known, knownKey(file.path, file.digest)));
  });

  const buildFile = Effect.fnUntraced(function* (path: MemoryFilePath) {
    const nodes = fileNodes(projection, path);
    const bytes = utf8.encode(joinText(nodes));
    const fileDigest = yield* withServices(sha256Hex(bytes));
    return { path, nodes, bytes, digest: fileDigest } satisfies BuiltFile;
  });

  const buildAll = Effect.suspend(() => Effect.forEach(filePaths(projection), buildFile));

  const baseOf = Effect.fnUntraced(function* (operation: string, built: ReadonlyArray<BuiltFile>) {
    const folderDigest = yield* folderDigestOf(operation, listingOf(built));
    const files = A.map(built, (file) => {
      const source = SourceTextIdentity.make({
        scopeRef: "agent-memory-store",
        sourceRef: "export",
        locator: PosixPath.make(file.path),
        sourceDigest: SourceTextDigest.make(`sha256:${file.digest}`),
        textDigest: SourceTextDigest.make(`sha256:${file.digest}`),
        extractor: MarkdownPartitionExtractor,
        normalizationVersion: "1",
      });
      const nodes: Array<BaseNode> = [];
      let offset = 0;
      for (const node of file.nodes) {
        if (Str.isNonEmpty(node.text)) {
          nodes.push(
            BaseNode.make({
              nodeId: node.nodeId,
              revisionId: node.revisionId,
              anchor: OccurrenceAnchor.make({
                source,
                unit: "utf16",
                anchor: TextAnchor.make({ startChar: offset, endChar: offset + node.text.length, quote: node.text }),
              }),
            })
          );
        }
        offset += node.text.length;
      }
      return BaseFile.make({ path: file.path, fileDigest: file.digest, nodes });
    });
    return BaseExport.make({ folderDigest, files, cursor: projection.cursor });
  });

  const currentBase = (operation: string) => Effect.flatMap(buildAll, (built) => baseOf(operation, built));

  const importEvents = Effect.fnUntraced(function* (disk: ReadonlyArray<DiskFile>) {
    const events: Array<MemoryEvent> = [];
    let nodeCount = 0;
    for (const file of disk) {
      const text = yield* decodeText(file.path, file.bytes);
      const parts = partition(text);
      if (parts.fallback !== "none") {
        yield* Effect.logWarning(`partition fell back to ${parts.fallback}`).pipe(
          Effect.annotateLogs({ filePath: file.path })
        );
      }
      const source = SourceTextIdentity.make({
        scopeRef: "agent-memory-store",
        sourceRef: "import",
        locator: PosixPath.make(file.path),
        sourceDigest: SourceTextDigest.make(`sha256:${file.digest}`),
        textDigest: SourceTextDigest.make(`sha256:${file.digest}`),
        extractor: MarkdownPartitionExtractor,
        normalizationVersion: "1",
      });
      let after = O.none<NodeId>();
      for (const node of parts.nodes) {
        const uuid = yield* random.uuidV7();
        const nodeId = NodeId.make(uuid);
        const contentHash = yield* withServices(contentHashOf(node.text));
        const revisionId = yield* withServices(revisionIdOf(nodeId, [], contentHash));
        events.push({
          _tag: "NodeCreated",
          payload: NodeCreated.make({
            nodeId,
            kind: node.kind,
            contentHash,
            revisionId,
            text: node.text,
            anchor: O.some(
              OccurrenceAnchor.make({
                source,
                unit: "utf16",
                anchor: TextAnchor.make({
                  startChar: node.range.offset,
                  endChar: node.range.offset + node.range.length,
                  quote: node.text,
                }),
              })
            ),
            filePath: file.path,
            after,
            author: MarkdownImportLineage,
          }),
        });
        after = O.some(nodeId);
      }
      nodeCount += parts.nodes.length;
      events.push({
        _tag: "FileImported",
        payload: FileImported.make({
          filePath: file.path,
          fileDigest: file.digest,
          nodeCount: parts.nodes.length,
          author: MarkdownImportLineage,
        }),
      });
    }
    const folderDigest = yield* folderDigestOf("importFolder", listingOf(disk));
    events.push({
      _tag: "FolderImported",
      payload: FolderImported.make({
        folderDigest,
        fileCount: disk.length,
        nodeCount,
        author: MarkdownImportLineage,
      }),
    });
    return events;
  });

  const importFolderUnlocked = Effect.fnUntraced(function* (root: PosixPath) {
    yield* catchUp("importFolder");
    const exists = yield* fs.exists(root).pipe(Effect.mapError(failure("importFolder", O.none())));
    if (!exists) {
      return yield* failure("importFolder", O.none())(`memory folder ${root} does not exist`);
    }
    const disk = yield* scanFolder("importFolder", root);
    if (MutableHashSet.size(projection.folders) > 0) {
      // Decision `second-import-is-idempotent-on-a-projected-folder`.
      const projected = yield* isProjectedFolder("importFolder", root, disk);
      if (!projected) {
        const folderDigest = yield* folderDigestOf("importFolder", listingOf(disk));
        return yield* ForeignFolderError.make({ root, folderDigest });
      }
      return yield* currentBase("importFolder");
    }
    const events = yield* importEvents(disk);
    // The folder's rows say only that it held these bytes, which stays true
    // if the append below fails.
    const key = yield* folderKeyOf("importFolder", root);
    yield* recordFolderFiles("importFolder", key, disk);
    yield* A.match(events, {
      onEmpty: () => Effect.void,
      onNonEmpty: (batch) => log.appendMany(batch),
    }).pipe(Effect.mapError(failure("importFolder", O.none())));
    yield* catchUp("importFolder");
    return yield* currentBase("importFolder");
  });

  const writeAtomically = Effect.fnUntraced(function* (root: PosixPath, file: BuiltFile) {
    const target = joinPath(root, file.path);
    const directory = parentOf(target);
    const temporary = joinPath(directory, `.${nameOf(target)}.agent-memory-store-tmp`);
    yield* fs.makeDirectory(directory, { recursive: true });
    yield* fs.writeFile(temporary, file.bytes);
    yield* fs.rename(temporary, target);
  });

  const exportFolderUnlocked = Effect.fnUntraced(function* (root: PosixPath) {
    yield* catchUp("exportFolder");
    const disk = yield* scanFolder("exportFolder", root);
    const projected = yield* isProjectedFolder("exportFolder", root, disk);
    if (!projected) {
      const folderDigest = yield* folderDigestOf("exportFolder", listingOf(disk));
      return yield* UnimportedFolderError.make({ root: O.some(root), folderDigest: O.some(folderDigest) });
    }
    const onDisk = MutableHashMap.empty<MemoryFilePath, DiskFile>();
    for (const file of disk) {
      MutableHashMap.set(onDisk, file.path, file);
    }
    const built = yield* buildAll;
    const changed = A.filter(
      built,
      (file) =>
        !pipe(
          MutableHashMap.get(onDisk, file.path),
          O.exists((current) => current.digest === file.digest && sameBytes(current.bytes, file.bytes))
        )
    );
    // The fence rows land before the bytes, in one statement, so a write cut
    // short leaves either the old bytes or the new ones, both known.
    if (A.isReadonlyArrayNonEmpty(changed)) {
      yield* fs.makeDirectory(root, { recursive: true }).pipe(Effect.mapError(failure("exportFolder", O.none())));
      const key = yield* folderKeyOf("exportFolder", root);
      yield* recordFolderFiles("exportFolder", key, changed);
    }
    for (const file of changed) {
      yield* writeAtomically(root, file).pipe(Effect.mapError(failure("exportFolder", O.some(file.path))));
    }
    return yield* baseOf("exportFolder", built);
  });

  const projectNodeUnlocked = Effect.fnUntraced(function* (nodeId: NodeId) {
    yield* catchUp("projectNode");
    const node = yield* Effect.fromOption(MutableHashMap.get(projection.nodes, nodeId)).pipe(
      Effect.mapError(() => failure("projectNode", O.none())(`node ${nodeId} is not in the log`))
    );
    if (MutableHashSet.size(projection.folders) === 0) {
      // projectNode names no folder, so the refusal names none either.
      return yield* UnimportedFolderError.make({});
    }
    const nodes = fileNodes(projection, node.filePath);
    const index = O.getOrElse(
      A.findFirstIndex(nodes, (candidate) => candidate.nodeId === nodeId),
      () => -1
    );
    if (index < 0) {
      return yield* failure("projectNode", O.some(node.filePath))(`node ${nodeId} has no place in its file`);
    }
    const previousText = O.getOrElse(node.previousText, () => "");
    const before = joinText(A.take(nodes, index));
    const after = joinText(A.drop(nodes, index + 1));
    const edit = MarkdownEdit.make({ offset: before.length, length: previousText.length, content: node.text });
    // Decision `projectnode-refuses-a-disturbing-edit-in-p1`: the edit is
    // applied only when no node outside the touched run changes its parse.
    const baseText = `${before}${previousText}${after}`;
    const base = partition(baseText);
    const replacement = replacementRun(base, baseText, edit.offset, edit.length, edit.content);
    const check = yield* Result.match(checkReplacement(base, replacement), {
      onFailure: (error) => Effect.fail(error.pipe(failure("reparseCheck", O.some(node.filePath)))),
      onSuccess: Effect.succeed,
    });
    if (!check.stable) {
      return yield* ReparseRefusedError.make({ nodeId, path: node.filePath, disturbed: check.disturbed });
    }
    return edit;
  });

  return MarkdownProjector.of({
    importFolder: Effect.fn("MarkdownProjector.importFolder")((root: PosixPath) =>
      lock.withPermit(importFolderUnlocked(root))
    ),
    exportFolder: Effect.fn("MarkdownProjector.exportFolder")((root: PosixPath) =>
      lock.withPermit(exportFolderUnlocked(root))
    ),
    projectNode: Effect.fn("MarkdownProjector.projectNode")((nodeId: NodeId) =>
      lock.withPermit(projectNodeUnlocked(nodeId))
    ),
  });
});

const crypto = Layer.mergeAll(Digest.layerWebCrypto, SecureRandom.layerWebCrypto);

/**
 * Live {@link MarkdownProjector} over {@link MemoryLog}, the platform
 * `FileSystem` and a `SqlClient`.
 *
 * **Details**
 *
 * The `SqlClient` is the one the memory log writes through, so the
 * projector's table of projected file digests lives in the log's database.
 * Provide a platform `FileSystem` such as `NodeFileSystem.layer` from
 * `@effect/platform-node`. Digests use `Digest.layerWebCrypto` and node ids
 * are UUIDv7 strings from `SecureRandom.layerWebCrypto`.
 *
 * **Example** (Compose the projector over a memory log)
 *
 * ```ts
 * import { MarkdownProjectorLayer, MemoryLogLayer, makeMemorySqlClientLayer } from "@beep/agent-memory-store"
 * import * as Layer from "effect/Layer"
 *
 * const store = MarkdownProjectorLayer.pipe(
 *   Layer.provideMerge(MemoryLogLayer),
 *   Layer.provide(makeMemorySqlClientLayer({ filename: ":memory:" }))
 * )
 * console.log(store)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MarkdownProjectorLayer: Layer.Layer<
  MarkdownProjector,
  ProjectionError,
  MemoryLog | FileSystem.FileSystem | SqlClient.SqlClient
> = Layer.effect(MarkdownProjector, make).pipe(Layer.provide(crypto));

/**
 * The memory log and the Markdown projector over one Bun SQLite database.
 *
 * **Details**
 *
 * Both layers share the database `config` names; only the platform
 * `FileSystem` remains to be provided. The driver is loaded as
 * {@link makeMemorySqlClientLayer} describes, so building the layer outside
 * Bun fails with a `MemoryLogError` whose operation is `"loadDriver"`.
 *
 * **Example** (Open a store on a database file)
 *
 * ```ts
 * import { makeMarkdownStoreSqliteLayer } from "@beep/agent-memory-store"
 *
 * const store = makeMarkdownStoreSqliteLayer({ filename: "./.beep/memory.db" })
 * console.log(store)
 * ```
 *
 * @param config - Bun SQLite client options; `filename` names the database.
 * @returns A layer providing the memory log and the projector.
 * @category layers
 * @since 0.0.0
 */
export const makeMarkdownStoreSqliteLayer = (
  config: SqliteClientConfig
): Layer.Layer<MemoryLog | MarkdownProjector, MemoryLogError | ProjectionError, FileSystem.FileSystem> =>
  MarkdownProjectorLayer.pipe(Layer.provideMerge(MemoryLogLayer), Layer.provide(makeMemorySqlClientLayer(config)));
