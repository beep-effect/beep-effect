/**
 * Shared harness for the Markdown projector suites: a store over one SQLite
 * file, a file system spy that counts writes and can fail a read part-way,
 * folder snapshots, and builders for the node events the edit replays append.
 */
import {
  contentHashOf,
  FileImportedEvent,
  LineageId,
  MarkdownProjector,
  MarkdownProjectorLayer,
  MemoryLog,
  MemoryLogLayer,
  makeMemorySqlClientLayer,
  NodeCreated,
  NodeCreatedEvent,
  NodeRetired,
  NodeRevised,
  NodeStatusChanged,
  revisionIdOf,
  StatusTransition,
  StatusValue,
  TombstoneContentHash,
} from "@beep/agent-memory-store";
import { mulberry32 } from "@beep/agent-memory-store/internal/Mulberry32";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import type { FileImported, MemoryEvent, MemoryFilePath, NodeId, NodeKind, RevisionId } from "@beep/agent-memory-store";
import type { Entry } from "effect/eventlog/EventJournal";

export const isBunRuntime = P.isNotUndefined(process.versions.bun);

const editor = LineageId.make("agent-memory-store-p1:edit-replay");

/** Mutable counters a spied file system updates. */
export interface FileSystemSpy {
  /** Fail the read with this 1-based index, when set. */
  failReadAt: O.Option<number>;
  reads: number;
  renames: number;
  writes: number;
}

export const makeSpy = (): FileSystemSpy => ({ failReadAt: O.none(), reads: 0, renames: 0, writes: 0 });

/** The Node file system with every write and rename counted. */
export const spiedFileSystem = (spy: FileSystemSpy): Layer.Layer<FileSystem.FileSystem> =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.map(FileSystem.FileSystem, (fs) =>
      FileSystem.FileSystem.of({
        ...fs,
        readFile: Effect.fn("FileSystemSpy.readFile")((path: string) => {
          spy.reads += 1;
          return O.exists(spy.failReadAt, (index) => index === spy.reads)
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "Unknown",
                  module: "FileSystem",
                  method: "readFile",
                  description: "injected read failure",
                  pathOrDescriptor: path,
                })
              )
            : fs.readFile(path);
        }),
        writeFile: Effect.fn("FileSystemSpy.writeFile")(
          (path: string, data: Uint8Array, options?: Parameters<FileSystem.FileSystem["writeFile"]>[2]) => {
            spy.writes += 1;
            return fs.writeFile(path, data, options);
          }
        ),
        rename: Effect.fn("FileSystemSpy.rename")((from: string, to: string) => {
          spy.renames += 1;
          return fs.rename(from, to);
        }),
      })
    )
  ).pipe(Layer.provide(NodeFileSystem.layer));

/**
 * The Node file system running `before` once, ahead of the first file read:
 * another writer's commit lands between this projector's catch-up and its
 * append.
 */
export const fileSystemRunningFirst = <E>(before: Effect.Effect<unknown, E>): Layer.Layer<FileSystem.FileSystem> =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.map(FileSystem.FileSystem, (fs) => {
      let pending = true;
      return FileSystem.FileSystem.of({
        ...fs,
        readFile: Effect.fn("FileSystemRunningFirst.readFile")(function* (path: string) {
          if (pending) {
            pending = false;
            yield* Effect.orDie(before);
          }
          return yield* fs.readFile(path);
        }),
      });
    })
  ).pipe(Layer.provide(NodeFileSystem.layer));

/** A store opened on one database file: the log, the projector and the SQL client they share. */
export const openStore = Effect.fnUntraced(function* (
  filename: string,
  fileSystem: Layer.Layer<FileSystem.FileSystem> = NodeFileSystem.layer
) {
  const context = yield* Layer.build(
    MarkdownProjectorLayer.pipe(
      Layer.provideMerge(MemoryLogLayer),
      Layer.provideMerge(makeMemorySqlClientLayer({ filename })),
      Layer.provide(fileSystem)
    )
  );
  return {
    log: Context.get(context, MemoryLog),
    projector: Context.get(context, MarkdownProjector),
    sql: Context.get(context, SqlClient.SqlClient),
  };
});

/** A scoped temporary directory. */
export const tempDirectory = (prefix: string) =>
  FileSystem.FileSystem.use((fs) => fs.makeTempDirectoryScoped({ prefix }));

/** One file of a folder snapshot. */
interface SnapshotFile {
  readonly bytes: Uint8Array;
  readonly mtime: number;
  readonly path: string;
}

/** Every regular file under `root` with its bytes and modification time, sorted by path. */
export const snapshotFolder = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(root, { recursive: true });
  const files: Array<SnapshotFile> = [];
  for (const path of A.sort(entries, Order.String)) {
    const info = yield* fs.stat(`${root}/${path}`);
    if (info.type === "File") {
      const bytes = yield* fs.readFile(`${root}/${path}`);
      files.push({
        path,
        bytes,
        mtime: O.getOrElse(
          O.map(info.mtime, (date) => date.getTime()),
          () => 0
        ),
      });
    }
  }
  return files;
});

const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

export const textOf = (bytes: Uint8Array): string => decoder.decode(bytes);

const decodeCreated = S.decodeUnknownEffect(NodeCreatedEvent.payloadSchemaBinary);
const decodeFileImported = S.decodeUnknownEffect(FileImportedEvent.payloadSchemaBinary);

/** The `NodeCreated` payloads of `entries`, in commit order, with their entries. */
export const createdNodes = (entries: ReadonlyArray<Entry>) =>
  Effect.forEach(
    A.filter(entries, (entry) => entry.event === NodeCreatedEvent.tag),
    (entry) => Effect.map(decodeCreated(entry.payload), (payload): readonly [Entry, NodeCreated] => [entry, payload])
  );

/** The `FileImported` payloads of `entries`. */
export const importedFiles = (
  entries: ReadonlyArray<Entry>
): Effect.Effect<ReadonlyArray<FileImported>, S.SchemaError> =>
  Effect.forEach(
    A.filter(entries, (entry) => entry.event === FileImportedEvent.tag),
    (entry) => decodeFileImported(entry.payload)
  );

/** The platform services the projector suites run on. */
export const TestPlatform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, Digest.layerWebCrypto);

/** A `NodeRevised` event on the node's current head, with its revision id. */
export const reviseEvent = Effect.fnUntraced(function* (nodeId: NodeId, head: RevisionId, text: string) {
  const contentHash = yield* contentHashOf(text);
  const revisionId = yield* revisionIdOf(nodeId, [head], contentHash);
  const event: MemoryEvent = {
    _tag: "NodeRevised",
    payload: NodeRevised.make({ nodeId, revisionId, parents: [head], contentHash, text, author: editor }),
  };
  return { event, revisionId };
});

/** A `NodeStatusChanged` event on the node's current head moving `status` from `from` to `to`. */
export const statusEvent = Effect.fnUntraced(function* (
  nodeId: NodeId,
  head: RevisionId,
  text: string,
  from: string,
  to: string
) {
  const contentHash = yield* contentHashOf(text);
  const revisionId = yield* revisionIdOf(nodeId, [head], contentHash);
  const transition = StatusTransition.make({
    field: "status",
    from: O.some(StatusValue.make(from)),
    to: StatusValue.make(to),
  });
  const event: MemoryEvent = {
    _tag: "NodeStatusChanged",
    payload: NodeStatusChanged.make({
      nodeId,
      revisionId,
      parents: [head],
      contentHash,
      text,
      transition,
      author: editor,
    }),
  };
  return { event, revisionId };
});

/** A `NodeRetired` tombstone event on the node's current head. */
export const retireEvent = Effect.fnUntraced(function* (nodeId: NodeId, head: RevisionId) {
  const revisionId = yield* revisionIdOf(nodeId, [head], TombstoneContentHash);
  const event: MemoryEvent = {
    _tag: "NodeRetired",
    payload: NodeRetired.make({ nodeId, revisionId, parents: [head], author: editor }),
  };
  return { event, revisionId };
});

/** A `NodeCreated` event an agent wrote: no anchor, placed after `after`. */
export const insertEvent = Effect.fnUntraced(function* (
  nodeId: NodeId,
  after: O.Option<NodeId>,
  filePath: MemoryFilePath,
  kind: NodeKind,
  text: string
) {
  const contentHash = yield* contentHashOf(text);
  const revisionId = yield* revisionIdOf(nodeId, [], contentHash);
  const event: MemoryEvent = {
    _tag: "NodeCreated",
    payload: NodeCreated.make({
      nodeId,
      kind,
      contentHash,
      revisionId,
      text,
      anchor: O.none(),
      filePath,
      after,
      author: editor,
    }),
  };
  return { event, revisionId };
});

/**
 * Appends a measurement line to the file `BEEP_TEST_AGENT_MEMORY_REPORT` names,
 * when it is set; the measured numbers are also asserted in the tests.
 */
export const report = Effect.fnUntraced(function* (line: string) {
  const target = yield* Config.option(Config.String("BEEP_TEST_AGENT_MEMORY_REPORT"));
  if (O.isSome(target)) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(target.value, `${line}\n`, { flag: "a" });
  }
});

/** A deterministic pseudo-random sequence (mulberry32) for the edit replays. */
export const seededRandom = (seed: number) => {
  const next = mulberry32(seed);
  return (): number => next() / 4294967296;
};

/** A deterministic UUID for the `index`-th node a replay mints. */
export const replayNodeId = (index: number): string =>
  `00000000-0000-4000-8000-${Str.padStart(12, "0")(index.toString(16))}`;
