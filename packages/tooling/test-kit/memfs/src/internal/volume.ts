// Ported from Effect-TS/effect PR #6573 "feat: add MemoryFileSystem module"
// (https://github.com/Effect-TS/effect/pull/6573), pinned head
// c0528bd5cf12154aa95a7ceec243fd2045876853, by lloydrichards, built on fubhy's
// design in effect-smol PR #456 (https://github.com/Effect-TS/effect-smol/pull/456).
// Upstream source: packages/effect/src/internal/memoryFileSystem.ts.
// Copyright: Effectful Technologies Inc.
// License: MIT (https://github.com/Effect-TS/effect/blob/main/LICENSE)
//
// Port notes, the deliberate changes from the pinned upstream (anything else
// diverging from the pinned head is drift, not design):
// - Imports come from the installed `effect` package instead of sibling source
//   files; `badArgument`/`systemError` and the PlatformError types are reached
//   through the root `PlatformError` namespace via local aliases so the ported
//   body reads as upstream wrote it.
// - `watch` honors core's `WatchOptions.recursive` instead of inferring
//   recursion from the target being a directory: a non-recursive directory
//   watch reports the path itself and its DIRECT children (node `fs.watch`
//   semantics); `recursive: true` reports all descendants.
// - Recursion surfaces are bounded. Upstream recursed unbounded over directory
//   trees (`containsDirectory`, `collectInodePaths`, `collectDirectoryEntries`
//   are now iterative worklists) and over Effect-returning tree walks
//   (`detachEntry`, `cloneInode`, `validateCopyDirectoryContents`,
//   `copyDirectoryContents` carry a depth counter failing typed at
//   MAX_NESTING_DEPTH); `expandBraces` pre-scans brace nesting depth and fails
//   typed instead of letting `findBraceExpansion` recurse unbounded. A
//   pathological tree or pattern fails through the typed channel as a
//   stack-overflow defect.
// - `access` deliberately ignores its options (upstream posture: no virtual
//   process identity, permission bits are metadata only); the facade TSDoc
//   states it.
// - Upstream bug fixed (worth reporting upstream): `copy` with
//   `overwrite: false` onto an existing destination reported the SOURCE path
//   on its AlreadyExists error while every sibling conflict arm reports the
//   destination; the port reports the destination.
// - Errno fidelity: errors are built from the errno node raises (`errnoError`),
//   the `_tag` derived by @effect/platform-node's own errno mapping and the
//   code carried as `cause.code`; sites whose upstream tag or success/failure
//   disagreed with node were corrected (readLink EINVAL, non-recursive remove
//   of any directory, ENOTEMPTY, EBADF, fs.cp codes, trailing slashes, NUL
//   bytes, glob roots, negative truncate).
// - Case folding: State.caseSensitive, lookupEntry, case-only rename.

import { $MemfsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as PlatformErrorNs from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as Queue from "effect/Queue";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ErrnoException, errnoError } from "./errno.ts";
import type * as Cause from "effect/Cause";
import type { ErrnoCode } from "./errno.ts";

const $I = $MemfsId.create("internal/volume");

// localeCompare can return any negative/positive magnitude; Orders require -1/0/1.
const LocaleNameOrder = Order.make<string>((left, right) => {
  const compared = Str.localeCompare(right)(left);
  return Order.Number(compared, 0);
});
const InodeNameOrder = Order.mapInput(LocaleNameOrder, (entry: readonly [string, Inode]) => entry[0]);
const ResolutionErrno = LiteralKit(["EISDIR", "ELOOP", "ENOTDIR"]).pipe(
  $I.annoteSchema("ResolutionErrno", { description: "Resource errors raised during inode resolution." })
);
type ResolutionErrno = typeof ResolutionErrno.Type;
const DescriptorErrno = LiteralKit(["EBADF", "EINVAL", "EISDIR"]).pipe(
  $I.annoteSchema("DescriptorErrno", { description: "Errors raised by descriptor operations." })
);
type DescriptorErrno = typeof DescriptorErrno.Type;
const DescriptorAccess = LiteralKit(["readable", "writable"]).pipe(
  $I.annoteSchema("DescriptorAccess", { description: "The required descriptor access mode." })
);
type DescriptorAccess = typeof DescriptorAccess.Type;

const { badArgument, systemError } = PlatformErrorNs;
type PlatformError = PlatformErrorNs.PlatformError;
type SystemErrorTag = PlatformErrorNs.SystemErrorTag;

const MAX_LINK_TRAVERSAL = 40;
const MAX_NESTING_DEPTH = 256;
const DEFAULT_UID = 0;
const DEFAULT_GID = 0;
const FILE_MODE = 0o100644;
const FILE_TYPE_MODE = 0o100000;
const DIR_MODE = 0o40755;
const DIR_TYPE_MODE = 0o040000;
const LINK_MODE = 0o120777;
const PERMISSION_MODE = 0o7777;
const DIR_SELF_LINK_COUNT = 1;
const DIR_LINK_COUNT = 2;
const FIRST_INODE = 2;
const FIRST_DESCRIPTOR = 3;
const FIRST_TEMP = 1;
const TEMP_DIR = "/tmp";

// =============================================================================
// models
// =============================================================================

const Inode = S.Finite.pipe(
  S.brand("MemoryFileSystemInode"),
  $I.annoteSchema("Inode", { description: "A volume inode number." })
);
type Inode = typeof Inode.Type;
const RootInode = Inode.make(1);
const FileDescriptor = S.Finite.pipe(
  S.brand("MemoryFileSystemFileDescriptor"),
  $I.annoteSchema("FileDescriptor", { description: "A volume file descriptor number." })
);
type FileDescriptor = typeof FileDescriptor.Type;
const InodeMetadata = S.Struct({
  ino: Inode.pipe($I.annoteKey("InodeMetadata.ino", { description: "The inode number." })),
  mode: S.Finite.pipe($I.annoteKey("InodeMetadata.mode", { description: "The inode mode bits." })),
  uid: S.Finite.pipe($I.annoteKey("InodeMetadata.uid", { description: "The owning user id." })),
  gid: S.Finite.pipe($I.annoteKey("InodeMetadata.gid", { description: "The owning group id." })),
  nlink: S.Finite.pipe($I.annoteKey("InodeMetadata.nlink", { description: "The hard-link count." })),
  openCount: S.Finite.pipe($I.annoteKey("InodeMetadata.openCount", { description: "The open descriptor count." })),
  atime: S.DateTimeUtc.pipe($I.annoteKey("InodeMetadata.atime", { description: "The access time." })),
  mtime: S.DateTimeUtc.pipe($I.annoteKey("InodeMetadata.mtime", { description: "The modification time." })),
  ctime: S.DateTimeUtc.pipe($I.annoteKey("InodeMetadata.ctime", { description: "The metadata change time." })),
  birthtime: S.DateTimeUtc.pipe($I.annoteKey("InodeMetadata.birthtime", { description: "The creation time." })),
}).pipe($I.annoteSchema("InodeMetadata", { description: "The engine InodeMetadata data." }));
type InodeMetadata = typeof InodeMetadata.Type;
const FileInode = S.TaggedStruct("File", {
  ...InodeMetadata.fields,
  data: S.Uint8Array.pipe($I.annoteKey("FileInode.data", { description: "The live file bytes." })),
}).pipe($I.annoteSchema("FileInode", { description: "The engine FileInode data." }));
type FileInode = typeof FileInode.Type;
const DirectoryInode = S.TaggedStruct("Directory", {
  ...InodeMetadata.fields,
  entries: S.HashMap(S.String, Inode).pipe(
    $I.annoteKey("DirectoryInode.entries", { description: "The stored directory entry names and inode numbers." })
  ),
}).pipe($I.annoteSchema("DirectoryInode", { description: "The engine DirectoryInode data." }));
type DirectoryInode = typeof DirectoryInode.Type;
const SymbolicLinkInode = S.TaggedStruct("SymbolicLink", {
  ...InodeMetadata.fields,
  target: S.String.pipe($I.annoteKey("SymbolicLinkInode.target", { description: "The stored link target." })),
}).pipe($I.annoteSchema("SymbolicLinkInode", { description: "The engine SymbolicLinkInode data." }));
type SymbolicLinkInode = typeof SymbolicLinkInode.Type;
const InodeEntry = S.Union([FileInode, DirectoryInode, SymbolicLinkInode]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("InodeEntry", { description: "The file, directory or symbolic-link inode." })
);
type InodeEntry = typeof InodeEntry.Type;

interface WatchSubscription {
  readonly directory: boolean;
  readonly id: number;
  readonly path: string;
  readonly pending: Array<FileSystem.WatchEvent>;
  queue: Queue.Enqueue<FileSystem.WatchEvent, PlatformError | Cause.Done> | undefined;
  readonly recursive: boolean;
}

const WatchSubscriptionOrder = Order.mapInput(Order.Number, (watcher: WatchSubscription) => watcher.id);

interface TransitionResult<A> {
  readonly events: ReadonlyArray<FileSystem.WatchEvent>;
  readonly state: State;
  readonly value: A;
}

const transitionResult = <A>(
  state: State,
  value: A,
  events: ReadonlyArray<FileSystem.WatchEvent> = []
): TransitionResult<A> => ({ state, value, events });

interface State {
  // KIT EXTENSION (case folding): fixed at build changed afterwards.
  readonly caseSensitive: boolean;
  readonly descriptors: HashMap.HashMap<FileDescriptor, OpenFileDescriptor>;
  readonly inodes: HashMap.HashMap<Inode, InodeEntry>;
  readonly nextDescriptor: number;
  readonly nextInode: number;
  readonly nextTemporary: number;
}

interface Volume {
  readonly allocateSubscriptionId: () => number;
  // Kit extension (volume inspection): the current committed state, readable
  // synchronously. State values are immutable — each transition replaces the
  // reference under the volume lock — so a sync read observes one consistent
  // snapshot and can never see a half-applied transition.
  readonly currentState: () => State;
  readonly mutate: <A, E, R>(use: (state: State) => Effect.Effect<TransitionResult<A>, E, R>) => Effect.Effect<A, E, R>;
  readonly mutateInterruptibly: <A, E, R>(
    use: (state: State) => Effect.Effect<TransitionResult<A>, E, R>
  ) => Effect.Effect<A, E, R>;
  readonly watchers: MutableHashMap.MutableHashMap<number, WatchSubscription>;
  readonly withState: <A, E, R>(use: (state: State) => Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
}

const isState = (u: unknown): u is State => P.hasProperty(u, "inodes") && P.hasProperty(u, "nextInode");
const isVolume = (u: unknown): u is Volume => P.hasProperty(u, "withState") && P.hasProperty(u, "mutate");

interface OpenFileDescriptor {
  readonly append: boolean;
  readonly fd: FileDescriptor;
  readonly inode: Inode;
  readonly position: bigint;
  readonly readable: boolean;
  readonly writable: boolean;
}

interface ResolveOptions {
  readonly followFinalSymbolicLink?: boolean | undefined;
  readonly method: string;
}

interface ResolvedInode {
  readonly entry: InodeEntry;
  readonly inode: Inode;
  readonly path: string;
}

interface ResolvedEntry {
  readonly entry: InodeEntry;
  readonly name: string;
  readonly parent: DirectoryInode;
  readonly path: string;
}

interface CloneContext {
  readonly method: string;
  readonly preserveTimestamps: boolean;
  readonly sourcePath: string;
}

// =============================================================================
// state
// =============================================================================

const fileSystemError = (options: {
  readonly _tag: SystemErrorTag;
  readonly method: string;
  readonly pathOrDescriptor?: string | number | undefined;
  readonly description?: string | undefined;
  readonly syscall?: string | undefined;
  readonly cause?: unknown;
}): PlatformError => systemError({ module: "FileSystem", ...options });

const invalidData: {
  (method: string, path: string, description: string): PlatformError;
  (path: string, description: string): (method: string) => PlatformError;
} = dual(
  3,
  (method: string, path: string, description: string): PlatformError =>
    fileSystemError({ _tag: "InvalidData", method, pathOrDescriptor: path, description })
);

// Errno fidelity: the errno → tag mapping lives in ./errno.js.

const alreadyExists: {
  (method: string, path: string): PlatformError;
  (path: string): (method: string) => PlatformError;
} = dual(2, (method: string, path: string): PlatformError => errnoError(method, path, "EEXIST", undefined));

const badResource = (
  method: string,
  pathOrDescriptor: string | number,
  code: ResolutionErrno,
  description?: string
): PlatformError => errnoError(method, pathOrDescriptor, code, description);

// A limit of the in-memory model itself (nesting depth, allocation, position
// range), with no errno the real platform would raise: BadResource, no cause.
const volumeLimit: {
  (method: string, pathOrDescriptor: string | number, description: string): PlatformError;
  (pathOrDescriptor: string | number, description: string): (method: string) => PlatformError;
} = dual(
  3,
  (method: string, pathOrDescriptor: string | number, description: string): PlatformError =>
    fileSystemError({ _tag: "BadResource", method, pathOrDescriptor, description })
);

const notFound: {
  (method: string, path: string): PlatformError;
  (path: string): (method: string) => PlatformError;
} = dual(2, (method: string, path: string): PlatformError => errnoError(method, path, "ENOENT", undefined));

const argumentError: {
  (method: string, description: string): PlatformError;
  (description: string): (method: string) => PlatformError;
} = dual(
  2,
  (method: string, description: string): PlatformError => badArgument({ module: "FileSystem", method, description })
);

// node rejects a NUL byte in any path argument before touching the filesystem,
// as a BadArgument (ERR_INVALID_ARG_VALUE), not a system error.
const nullBytePath = (method: string): PlatformError => argumentError(method, "path must not contain null bytes");

const findInode: {
  (state: State, inode: Inode): InodeEntry | undefined;
  (inode: Inode): (state: State) => InodeEntry | undefined;
} = dual(2, (state: State, inode: Inode): InodeEntry | undefined => O.getOrUndefined(HashMap.get(state.inodes, inode)));

// KIT EXTENSION (case folding): a case-insensitive,
// case-preserving volume looks a name up exactly first, then by folded
// comparison, and answers the STORED key alongside the inode. Every mutation of
// an existing entry keys on that stored name, so removal and rekeying hit the
// real entry; path spellings a caller sees keep the queried component.
const lookupEntry: {
  (state: State, directory: DirectoryInode, name: string): readonly [string, Inode] | undefined;
  (directory: DirectoryInode, name: string): (state: State) => readonly [string, Inode] | undefined;
} = dual(3, (state: State, directory: DirectoryInode, name: string): readonly [string, Inode] | undefined => {
  const exact = O.getOrUndefined(HashMap.get(directory.entries, name));
  if (exact !== undefined) return [name, exact];
  if (state.caseSensitive) return undefined;
  const folded = Str.toLowerCase(name);
  for (const [key, inode] of directory.entries) {
    if (Str.toLowerCase(key) === folded) return [key, inode];
  }
  return undefined;
});

const findEntry: {
  (state: State, directory: DirectoryInode, name: string): Inode | undefined;
  (directory: DirectoryInode, name: string): (state: State) => Inode | undefined;
} = dual(
  3,
  (state: State, directory: DirectoryInode, name: string): Inode | undefined => lookupEntry(state, directory, name)?.[1]
);
// END KIT EXTENSION (case folding)

const setInode: {
  (state: State, entry: InodeEntry): State;
  (entry: InodeEntry): (state: State) => State;
} = dual(
  2,
  (state: State, entry: InodeEntry): State => ({
    ...state,
    inodes: HashMap.set(state.inodes, entry.ino, entry),
  })
);

// Namespace entries and live descriptors retain their inode until the last reference is released.
const getInode: {
  (state: State, inode: Inode, _method: string, _path: string): Effect.Effect<InodeEntry>;
  (inode: Inode, _method: string, _path: string): (state: State) => Effect.Effect<InodeEntry>;
} = dual(
  4,
  Effect.fnUntraced(function* (state: State, inode: Inode, _method: string, _path: string) {
    return state.inodes.pipe(HashMap.get(inode), O.getOrThrow);
  })
);

const validateEntryName = Effect.fnUntraced(function* (method: string, name: string, pathOrDescriptor: string = name) {
  const invalidName =
    name.length === 0 || name === "." || name === ".." || Str.includes("/")(name) || Str.includes("\0")(name);
  if (invalidName) {
    return yield* invalidData(method, pathOrDescriptor, "Invalid directory entry name");
  }
  return;
});

const getDirectory: {
  (state: State, inode: Inode, method: string, path: string): Effect.Effect<DirectoryInode, PlatformError>;
  (inode: Inode, method: string, path: string): (state: State) => Effect.Effect<DirectoryInode, PlatformError>;
} = dual(
  4,
  Effect.fnUntraced(function* (state: State, inode: Inode, method: string, path: string) {
    const entry = yield* getInode(state, inode, method, path);
    if (entry._tag !== "Directory") {
      return yield* badResource(method, path, "ENOTDIR");
    }
    return entry;
  })
);

const touchNamespaceMutation: {
  (state: State, directory: DirectoryInode, target: InodeEntry, now: DateTime.Utc): State;
  (directory: DirectoryInode, target: InodeEntry, now: DateTime.Utc): (state: State) => State;
} = dual(
  4,
  (state: State, directory: DirectoryInode, target: InodeEntry, now: DateTime.Utc): State => ({
    ...state,
    inodes: HashMap.set(
      HashMap.set(state.inodes, directory.ino, { ...directory, mtime: now, ctime: now }),
      target.ino,
      {
        ...target,
        ctime: now,
      }
    ),
  })
);

const childPath: {
  (parent: string, name: string): string;
  (name: string): (parent: string) => string;
} = dual(2, (parent: string, name: string): string => (parent === "/" ? `/${name}` : `${parent}/${name}`));

const parentOfPath = (path: string): string => {
  const separator = pipe(path, Str.lastIndexOf("/"), O.getOrElse(constant(-1)));
  return separator <= 0 ? "/" : Str.slice(0, separator)(path);
};

const isStrictAncestorPath = (ancestor: string, path: string): boolean =>
  ancestor !== "/" && Str.startsWith(`${ancestor}/`)(path);

const isDescendantPath = (ancestor: string, path: string): boolean =>
  ancestor === "/" || Str.startsWith(`${ancestor}/`)(path);

const isDirectChildPath = (parent: string, path: string): boolean => path !== "/" && parentOfPath(path) === parent;

const watchedDirectoryIncludes = (watchedPath: string, recursive: boolean, eventPath: string): boolean =>
  recursive ? isDescendantPath(watchedPath, eventPath) : isDirectChildPath(watchedPath, eventPath);

// PORT NOTE: upstream ignored `WatchOptions` and made every directory watch
// recursive. Here a non-recursive directory watch reports the path itself and
// its DIRECT children (node `fs.watch` semantics); `recursive: true` reports
// all descendants; events on an ancestor of the watched path are always
// reported (upstream behavior, kept).
const includesWatchPath: {
  (watchedPath: string, directory: boolean, recursive: boolean, eventPath: string): boolean;
  (directory: boolean, recursive: boolean, eventPath: string): (watchedPath: string) => boolean;
} = dual(
  4,
  (watchedPath: string, directory: boolean, recursive: boolean, eventPath: string): boolean =>
    eventPath === watchedPath ||
    (directory && watchedDirectoryIncludes(watchedPath, recursive, eventPath)) ||
    isStrictAncestorPath(eventPath, watchedPath)
);

// A subscription whose stream has not started yet buffers the event.
const deliverWatchEvent = (watcher: WatchSubscription, event: FileSystem.WatchEvent): void => {
  if (watcher.queue === undefined) {
    watcher.pending.push(event);
  } else {
    Queue.offerUnsafe(watcher.queue, event);
  }
};

// KIT EXTENSION (case folding): on a
// case-insensitive volume a subscription and an event name one entry in any
// spelling, so matching compares FOLDED paths; the delivered event keeps its own.
const publishWatchEvents: {
  (
    watchers: MutableHashMap.MutableHashMap<number, WatchSubscription>,
    events: ReadonlyArray<FileSystem.WatchEvent>,
    caseSensitive: boolean
  ): Effect.Effect<void>;
  (
    events: ReadonlyArray<FileSystem.WatchEvent>,
    caseSensitive: boolean
  ): (watchers: MutableHashMap.MutableHashMap<number, WatchSubscription>) => Effect.Effect<void>;
} = dual(
  3,
  (
    watchers: MutableHashMap.MutableHashMap<number, WatchSubscription>,
    events: ReadonlyArray<FileSystem.WatchEvent>,
    caseSensitive: boolean
  ): Effect.Effect<void> =>
    Effect.sync(() => {
      const fold = caseSensitive ? (path: string) => path : (path: string) => Str.toLowerCase(path);
      for (const watcher of A.sort(MutableHashMap.values(watchers), WatchSubscriptionOrder)) {
        const watchedPath = fold(watcher.path);
        for (const event of events) {
          if (includesWatchPath(watchedPath, watcher.directory, watcher.recursive, fold(event.path))) {
            deliverWatchEvent(watcher, event);
          }
        }
      }
    })
);

// Records `path` when it names `inode`, and queues it for descent when it is a directory.
const visitInodePathChild = (
  state: State,
  inode: Inode,
  childInode: Inode,
  path: string,
  paths: Array<string>,
  pending: Array<readonly [DirectoryInode, string]>
): void => {
  if (childInode === inode) paths.push(path);
  const child = findInode(state, childInode);
  if (child?._tag === "Directory") {
    pending.push([child, path]);
  }
};

// PORT NOTE: iterative worklist where upstream recursed. Callers sort the
// result, so traversal order is not part of the contract.
const collectInodePaths: {
  (state: State, inode: Inode, directory: DirectoryInode, parent?: string): Array<string>;
  (inode: Inode, directory: DirectoryInode, parent?: string): (state: State) => Array<string>;
} = dual(
  (args) => isState(args[0]),
  (state: State, inode: Inode, directory: DirectoryInode, parent = "/"): Array<string> => {
    const paths: Array<string> = [];
    const pending: Array<readonly [DirectoryInode, string]> = [[directory, parent]];
    while (pending.length > 0) {
      const [current, currentPath] = O.getOrThrow(O.fromUndefinedOr(pending.pop()));
      for (const [name, childInode] of current.entries) {
        visitInodePathChild(state, inode, childInode, childPath(currentPath, name), paths, pending);
      }
    }
    return paths;
  }
);

const inodeUpdateEvents: {
  (state: State, inode: Inode): ReadonlyArray<FileSystem.WatchEvent.Update>;
  (inode: Inode): (state: State) => ReadonlyArray<FileSystem.WatchEvent.Update>;
} = dual(2, (state: State, inode: Inode): ReadonlyArray<FileSystem.WatchEvent.Update> => {
  const root = O.getOrThrow(O.filter(HashMap.get(state.inodes, RootInode), InodeEntry.isAnyOf(["Directory"])));
  if (inode === RootInode) return [{ _tag: "Update", path: "/" }];
  // NOTE: An inode may be reachable through multiple hard-link aliases, each of
  // which must receive an update event.
  return pipe(
    A.sort(collectInodePaths(state, inode, root), Order.String),
    A.map((path): FileSystem.WatchEvent.Update => ({ _tag: "Update", path }))
  );
});

const reclaimInode: {
  (state: State, entry: InodeEntry): State;
  (entry: InodeEntry): (state: State) => State;
} = dual(
  2,
  (state: State, entry: InodeEntry): State =>
    entry.nlink === 0 && entry.openCount === 0 ? { ...state, inodes: HashMap.remove(state.inodes, entry.ino) } : state
);

// =============================================================================
// inode creation and linking
// =============================================================================

const createFile: {
  (state: State, data?: Uint8Array): Effect.Effect<readonly [State, Inode]>;
  (data?: Uint8Array): (state: State) => Effect.Effect<readonly [State, Inode]>;
} = dual(
  (args) => isState(args[0]),
  Effect.fnUntraced(function* (state: State, data: Uint8Array = new Uint8Array()) {
    const now = yield* DateTime.now;
    const ino = Inode.make(state.nextInode);
    return [
      {
        ...state,
        nextInode: state.nextInode + 1,
        inodes: HashMap.set(
          state.inodes,
          ino,
          InodeEntry.cases.File.make({
            ino,
            mode: FILE_MODE,
            uid: DEFAULT_UID,
            gid: DEFAULT_GID,
            nlink: 0,
            openCount: 0,
            atime: now,
            mtime: now,
            ctime: now,
            birthtime: now,
            data: data.slice(),
          })
        ),
      },
      ino,
    ] as const;
  })
);

const createDirectory = Effect.fnUntraced(function* (state: State) {
  const now = yield* DateTime.now;
  const ino = Inode.make(state.nextInode);
  return [
    {
      ...state,
      nextInode: state.nextInode + 1,
      inodes: HashMap.set(
        state.inodes,
        ino,
        InodeEntry.cases.Directory.make({
          ino,
          mode: DIR_MODE,
          uid: DEFAULT_UID,
          gid: DEFAULT_GID,
          nlink: DIR_SELF_LINK_COUNT,
          openCount: 0,
          atime: now,
          mtime: now,
          ctime: now,
          birthtime: now,
          entries: HashMap.empty(),
        })
      ),
    },
    ino,
  ] as const;
});

const createSymbolicLink: {
  (state: State, target: string): Effect.Effect<readonly [State, Inode]>;
  (target: string): (state: State) => Effect.Effect<readonly [State, Inode]>;
} = dual(
  2,
  Effect.fnUntraced(function* (state: State, target: string) {
    const now = yield* DateTime.now;
    const ino = Inode.make(state.nextInode);
    return [
      {
        ...state,
        nextInode: state.nextInode + 1,
        inodes: HashMap.set(
          state.inodes,
          ino,
          InodeEntry.cases.SymbolicLink.make({
            ino,
            mode: LINK_MODE,
            uid: DEFAULT_UID,
            gid: DEFAULT_GID,
            nlink: 0,
            openCount: 0,
            atime: now,
            mtime: now,
            ctime: now,
            birthtime: now,
            target,
          })
        ),
      },
      ino,
    ] as const;
  })
);

const attachDirectory: {
  (state: State, parent: Inode, name: string, inode: Inode, method?: string): Effect.Effect<State, PlatformError>;
  (parent: Inode, name: string, inode: Inode, method?: string): (state: State) => Effect.Effect<State, PlatformError>;
} = dual(
  (args) => isState(args[0]),
  Effect.fnUntraced(function* (state: State, parent: Inode, name: string, inode: Inode, method = "makeDirectory") {
    yield* validateEntryName(method, name);
    const parentEntry = yield* getDirectory(state, parent, method, name);
    // Callers attach only fresh clones or newly created directories to an absent name.
    const entry = O.getOrThrow(O.filter(HashMap.get(state.inodes, inode), InodeEntry.isAnyOf(["Directory"])));
    const now = yield* DateTime.now;
    const nextParent = {
      ...parentEntry,
      entries: HashMap.set(parentEntry.entries, name, inode),
      nlink: parentEntry.nlink + 1,
    };
    const nextEntry = { ...entry, nlink: entry.nlink + 1 };
    return touchNamespaceMutation(state, nextParent, nextEntry, now);
  })
);

const linkInode: {
  (state: State, parent: Inode, name: string, inode: Inode, method?: string): Effect.Effect<State, PlatformError>;
  (parent: Inode, name: string, inode: Inode, method?: string): (state: State) => Effect.Effect<State, PlatformError>;
} = dual(
  (args) => isState(args[0]),
  Effect.fnUntraced(function* (state: State, parent: Inode, name: string, inode: Inode, method = "link") {
    yield* validateEntryName(method, name);
    const parentEntry = yield* getDirectory(state, parent, method, name);
    // KIT EXTENSION (case folding): a folded match exists.
    if (findEntry(state, parentEntry, name) !== undefined) {
      return yield* alreadyExists(method, name);
    }
    const entry = yield* getInode(state, inode, method, name);
    if (entry._tag === "Directory") {
      return yield* errnoError(method, name, "EPERM", "Cannot create a hard link to a directory");
    }
    const now = yield* DateTime.now;
    const nextParent = { ...parentEntry, entries: HashMap.set(parentEntry.entries, name, inode) };
    const nextEntry = { ...entry, nlink: entry.nlink + 1 };
    return touchNamespaceMutation(state, nextParent, nextEntry, now);
  })
);

// =============================================================================
// path resolution
// =============================================================================

// The mutable walk state of one `resolve`: the components still to visit,
// the inode stack and queried names of the resolved prefix, and the link budget.
interface ResolveCursor {
  components: Array<string>;
  readonly names: Array<string>;
  readonly stack: Array<Inode>;
  traversals: number;
}

const isDotComponent = (component: string): boolean =>
  component.length === 0 || component === "." || component === "..";

const cursorDirectory = (
  state: State,
  cursor: ResolveCursor,
  method: string,
  originalPath: string
): Effect.Effect<DirectoryInode, PlatformError> =>
  getDirectory(state, O.getOrThrow(A.last(cursor.stack)), method, originalPath);

// "", "." and ".." never name an entry: each asserts the resolved prefix is a
// directory (an empty component only at the end of the path), and ".."
// ascends — never above the root.
const resolveDotComponent = Effect.fnUntraced(function* (
  state: State,
  cursor: ResolveCursor,
  component: string,
  method: string,
  originalPath: string
) {
  if (component.length === 0 && cursor.components.length > 0) return;
  yield* cursorDirectory(state, cursor, method, originalPath);
  if (component === ".." && cursor.stack.length > 1) {
    cursor.stack.pop();
    cursor.names.pop();
  }
});

// Splices a followed link's target in front of the remaining components; an
// absolute target restarts from the root.
const followSymbolicLink = Effect.fnUntraced(function* (
  cursor: ResolveCursor,
  target: string,
  method: string,
  originalPath: string
) {
  cursor.traversals += 1;
  if (cursor.traversals > MAX_LINK_TRAVERSAL) {
    return yield* badResource(method, originalPath, "ELOOP", "Too many symbolic links");
  }
  if (target.length === 0) {
    return yield* notFound(method, originalPath);
  }
  if (Str.startsWith("/")(target)) {
    cursor.stack.splice(1);
    cursor.names.splice(0);
  }
  cursor.components = Str.split("/")(target).concat(cursor.components);
});

const resolveNamedComponent = Effect.fnUntraced(function* (
  state: State,
  cursor: ResolveCursor,
  component: string,
  options: ResolveOptions,
  originalPath: string
) {
  const method = options.method;
  const parent = yield* cursorDirectory(state, cursor, method, originalPath);
  // KIT EXTENSION (case folding): the lookup
  // folds, but `names` keeps the queried component — node's realpath never
  // canonicalizes case; only a link's target text supplies its own spelling.
  const inode = findEntry(state, parent, component);
  if (inode === undefined) {
    return yield* notFound(method, originalPath);
  }
  const entry = yield* getInode(state, inode, method, originalPath);
  const shouldFollow =
    entry._tag === "SymbolicLink" && (cursor.components.length > 0 || options.followFinalSymbolicLink !== false);
  if (shouldFollow) {
    return yield* followSymbolicLink(cursor, entry.target, method, originalPath);
  }
  cursor.stack.push(inode);
  cursor.names.push(component);
});

// NOTE: Relative paths resolve from the virtual POSIX root because `FileSystem` has
// no `chdir` operation or mutable working-directory state.
const resolve: {
  (state: State, path: string, options: ResolveOptions): Effect.Effect<ResolvedInode, PlatformError>;
  (path: string, options: ResolveOptions): (state: State) => Effect.Effect<ResolvedInode, PlatformError>;
} = dual(
  3,
  Effect.fnUntraced(function* (state: State, path: string, options: ResolveOptions) {
    const method = options.method;
    const originalPath = path;
    if (Str.includes("\0")(path)) {
      return yield* nullBytePath(method);
    }
    if (path.length === 0) {
      return yield* notFound(method, path);
    }
    const cursor: ResolveCursor = { components: Str.split("/")(path), stack: [RootInode], names: [], traversals: 0 };

    while (cursor.components.length > 0) {
      const component = O.getOrThrow(O.fromUndefinedOr(cursor.components.shift()));
      yield* isDotComponent(component)
        ? resolveDotComponent(state, cursor, component, method, originalPath)
        : resolveNamedComponent(state, cursor, component, options, originalPath);
    }

    const inode = O.getOrThrow(A.last(cursor.stack));
    const entry = yield* getInode(state, inode, method, originalPath);
    return {
      inode,
      entry,
      path: cursor.names.length === 0 ? "/" : `/${A.join(cursor.names, "/")}`,
    } satisfies ResolvedInode;
  })
);

// A trailing slash asserts the entry is a directory: the trimmed path must
// resolve to one. The answer for a missing entry depends on the calling
// operation, which passes `missingWithTrailingSlash`.
const trimTrailingSlashParentPath = Effect.fnUntraced(function* (
  state: State,
  path: string,
  method: string,
  errorPath: string,
  missingWithTrailingSlash: ErrnoCode
) {
  const trimmed = Str.replace(/\/+$/, "")(path);
  if (trimmed.length === 0) {
    return yield* badResource(method, errorPath, "EISDIR");
  }
  const existing = yield* Effect.result(resolve(state, trimmed, { method }));
  if (existing._tag === "Failure") {
    return yield* existing.failure.reason._tag === "NotFound"
      ? errnoError(method, errorPath, missingWithTrailingSlash, undefined)
      : withSystemErrorPath(existing.failure, method, errorPath);
  }
  if (existing.success.entry._tag !== "Directory") {
    return yield* badResource(method, errorPath, "ENOTDIR");
  }
  return trimmed;
});

interface OpenMode {
  readonly append: boolean;
  readonly create: boolean;
  readonly exclusive: boolean;
  readonly readable: boolean;
  readonly truncate: boolean;
  readonly writable: boolean;
}

interface OpenOptions {
  readonly flag?: FileSystem.OpenFlag | undefined;
  readonly mode?: number | undefined;
}

// =============================================================================
// descriptors
// =============================================================================

const OpenFlag = LiteralKit(["r", "r+", "w", "wx", "w+", "wx+", "a", "ax", "a+", "ax+"]).pipe(
  $I.annoteSchema("OpenFlag", { description: "The supported file-open flags." })
);
const isOpenFlag = S.is(OpenFlag);

const openMode = (flag: FileSystem.OpenFlag): OpenMode => ({
  readable: flag === "r" || Str.endsWith("+")(flag),
  writable: flag !== "r",
  append: Str.startsWith("a")(flag),
  create: Str.startsWith("w")(flag) || Str.startsWith("a")(flag),
  exclusive: Str.includes("x")(flag),
  truncate: Str.startsWith("w")(flag),
});

// node reports a closed descriptor, or one lacking the access an operation
// needs, as EBADF — except `ftruncate` on a descriptor not open for writing,
// which is EINVAL on both Linux and macOS.
const descriptorError: {
  (fd: FileDescriptor, method: string, code: DescriptorErrno, description: string): PlatformError;
  (method: string, code: DescriptorErrno, description: string): (fd: FileDescriptor) => PlatformError;
} = dual(
  4,
  (fd: FileDescriptor, method: string, code: DescriptorErrno, description: string): PlatformError =>
    errnoError(method, fd, code, description)
);

const allocateBytes: {
  (length: number, fd: FileDescriptor, method: string): Effect.Effect<Uint8Array<ArrayBuffer>, PlatformError>;
  (fd: FileDescriptor, method: string): (length: number) => Effect.Effect<Uint8Array<ArrayBuffer>, PlatformError>;
} = dual(
  3,
  (length: number, fd: FileDescriptor, method: string): Effect.Effect<Uint8Array<ArrayBuffer>, PlatformError> =>
    Effect.try({
      try: () => new Uint8Array(length),
      catch: () => volumeLimit(method, fd, "Unable to allocate file bytes"),
    })
);

const getOpenFile: {
  (
    state: State,
    fd: FileDescriptor,
    method: string,
    access?: DescriptorAccess
  ): Effect.Effect<readonly [OpenFileDescriptor, FileInode], PlatformError>;
  (
    fd: FileDescriptor,
    method: string,
    access?: DescriptorAccess
  ): (state: State) => Effect.Effect<readonly [OpenFileDescriptor, FileInode], PlatformError>;
} = dual(
  (args) => isState(args[0]),
  (
    state: State,
    fd: FileDescriptor,
    method: string,
    access?: DescriptorAccess
  ): Effect.Effect<readonly [OpenFileDescriptor, FileInode], PlatformError> =>
    Effect.suspend(() => {
      const descriptor = O.getOrUndefined(HashMap.get(state.descriptors, fd));
      if (descriptor === undefined) {
        return Effect.fail(descriptorError(fd, method, "EBADF", "File descriptor is closed"));
      }
      if (access !== undefined && !descriptor[access]) {
        const code = method === "truncate" ? "EINVAL" : "EBADF";
        return Effect.fail(descriptorError(fd, method, code, `File descriptor is not ${access}`));
      }
      const entry = O.getOrThrow(O.filter(HashMap.get(state.inodes, descriptor.inode), InodeEntry.isAnyOf(["File"])));
      return Effect.succeed([descriptor, entry]);
    })
);

const withSystemErrorPath: {
  (error: PlatformError, method: string, path: string): PlatformError;
  (method: string, path: string): (error: PlatformError) => PlatformError;
} = dual(
  3,
  (error: PlatformError, method: string, path: string): PlatformError =>
    error.reason._tag === "BadArgument"
      ? error
      : fileSystemError({
          _tag: error.reason._tag,
          method,
          pathOrDescriptor: path,
          description: error.reason.description,
          syscall: error.reason.syscall,
          cause: S.is(ErrnoException)(error.reason.cause)
            ? ErrnoException.from(error.reason.cause.code, path)
            : error.reason.cause,
        })
);

const withOperationError: {
  (error: PlatformError, method: string, path: string): PlatformError;
  (method: string, path: string): (error: PlatformError) => PlatformError;
} = dual(
  3,
  (error: PlatformError, method: string, path: string): PlatformError =>
    error.reason._tag === "BadArgument"
      ? badArgument({
          module: error.reason.module,
          method,
          description: error.reason.description,
          cause: error.reason.cause,
        })
      : withSystemErrorPath(error, method, path)
);

const symbolicLinkTargetPath: {
  (linkPath: string, target: string): string;
  (target: string): (linkPath: string) => string;
} = dual(2, (linkPath: string, target: string): string => {
  if (Str.startsWith("/")(target)) {
    return target;
  }
  const separator = pipe(linkPath, Str.lastIndexOf("/"), O.getOrElse(constant(-1)));
  const directory = separator <= 0 ? "/" : Str.slice(0, separator)(linkPath);
  return `${directory}/${target}`;
});

// =============================================================================
// entry resolution and removal
// =============================================================================

// KIT EXTENSION (errno fidelity): a trailing slash asserts "this is a
// directory". On an existing directory it is harmless and the entry is
// addressed without it; on an existing non-directory it is ENOTDIR; on a
// missing entry it is ENOENT, except where Linux reports otherwise for the
// calling operation (EISDIR when creating a file, ENOTDIR when renaming a
// non-directory onto it) — the caller passes that code.
const resolveParent: {
  (
    state: State,
    path: string,
    method: string,
    errorPath?: string,
    missingWithTrailingSlash?: ErrnoCode
  ): Effect.Effect<{ inode: Inode; entry: DirectoryInode; name: string; path: string }, PlatformError>;
  (
    path: string,
    method: string,
    errorPath?: string,
    missingWithTrailingSlash?: ErrnoCode
  ): (
    state: State
  ) => Effect.Effect<{ inode: Inode; entry: DirectoryInode; name: string; path: string }, PlatformError>;
} = dual(
  (args) => isState(args[0]),
  Effect.fnUntraced(function* (
    state: State,
    path: string,
    method: string,
    errorPath: string = path,
    missingWithTrailingSlash: ErrnoCode = "ENOENT"
  ) {
    if (Str.includes("\0")(path)) {
      return yield* nullBytePath(method);
    }
    if (path.length === 0) {
      return yield* notFound(method, errorPath);
    }
    const entryPath = Str.endsWith("/")(path)
      ? yield* trimTrailingSlashParentPath(state, path, method, errorPath, missingWithTrailingSlash)
      : path;
    const components = A.filter(Str.split("/")(entryPath), (component) => component.length > 0);
    const name = O.getOrThrow(O.fromUndefinedOr(components.pop()));
    yield* validateEntryName(method, name, errorPath);
    const parentPath =
      components.length === 0 ? "/" : `${Str.startsWith("/")(path) ? "/" : ""}${A.join(components, "/")}`;
    const parent = yield* resolve(state, parentPath, { method }).pipe(
      Effect.mapError(withSystemErrorPath(method, errorPath))
    );
    if (parent.entry._tag !== "Directory") {
      return yield* badResource(method, errorPath, "ENOTDIR");
    }
    return { inode: parent.inode, entry: parent.entry, name, path: parent.path };
  })
);

const resolveEntry: {
  (
    state: State,
    path: string,
    method: string
  ): Effect.Effect<ResolvedEntry & { readonly requestedName: string }, PlatformError>;
  (
    path: string,
    method: string
  ): (state: State) => Effect.Effect<ResolvedEntry & { readonly requestedName: string }, PlatformError>;
} = dual(
  3,
  Effect.fnUntraced(function* (state: State, path: string, method: string) {
    const parent = yield* resolveParent(state, path, method);
    // KIT EXTENSION (case folding): the entry is
    // addressed by its STORED key, so `detachEntry` and `rename` mutate the real
    // map entry rather than a folded spelling of it; `requestedName` keeps the
    // queried leaf for rename's byte-identical no-op guard.
    const found = lookupEntry(state, parent.entry, parent.name);
    if (found === undefined) {
      return yield* notFound(method, path);
    }
    const [name, inode] = found;
    return {
      parent: parent.entry,
      name,
      entry: yield* getInode(state, inode, method, path),
      path: childPath(parent.path, name),
      requestedName: parent.name,
    } satisfies ResolvedEntry & { readonly requestedName: string };
  })
);

const Unsigned32BitInteger = S.Number.check(
  S.isInt(
    $I.annote("Unsigned32BitIntegerInteger", {
      message: "Integer",
      description: "An integer filesystem mode or owner id.",
    })
  ),
  S.isBetween(
    { minimum: 0, maximum: 0xffff_ffff },
    $I.annote("Unsigned32BitIntegerRange", {
      message: "Unsigned 32-bit range",
      description: "A number from zero through 2^32 - 1, inclusive.",
    })
  )
).pipe(
  $I.annoteSchema("Unsigned32BitInteger", {
    description: "The unsigned 32-bit integer domain shared by modes and owner ids.",
  })
);
const isUnsigned32BitInteger = S.is(Unsigned32BitInteger);

const validateMode: {
  (method: string, mode: number | undefined): Effect.Effect<void, PlatformError>;
  (mode: number | undefined): (method: string) => Effect.Effect<void, PlatformError>;
} = dual(
  2,
  (method: string, mode: number | undefined): Effect.Effect<void, PlatformError> =>
    mode === undefined || isUnsigned32BitInteger(mode)
      ? Effect.void
      : Effect.fail(argumentError(method, "mode must be an unsigned 32-bit integer"))
);

// PORT NOTE: `depth` bounds the recursion at MAX_NESTING_DEPTH, failing typed —
// upstream recursed unbounded.
const detachEntry: {
  (
    state: State,
    target: ResolvedEntry,
    now: DateTime.Utc,
    _recursive: boolean,
    method: string,
    path: string,
    depth?: number | undefined
  ): Effect.Effect<State, PlatformError>;
  (
    target: ResolvedEntry,
    now: DateTime.Utc,
    _recursive: boolean,
    method: string,
    path: string,
    depth?: number | undefined
  ): (state: State) => Effect.Effect<State, PlatformError>;
} = dual(
  (args) => isState(args[0]),
  Effect.fnUntraced(function* (
    state: State,
    target: ResolvedEntry,
    now: DateTime.Utc,
    _recursive: boolean,
    method: string,
    path: string,
    depth: number | undefined = 0
  ) {
    if (depth > MAX_NESTING_DEPTH) {
      return yield* volumeLimit(method, path, "Directory tree exceeds the maximum nesting depth");
    }
    let nextState = state;
    if (target.entry._tag === "Directory") {
      const children = A.sort(target.entry.entries, InodeNameOrder);
      for (const [childName, childInode] of children) {
        const directory = yield* getDirectory(nextState, target.entry.ino, method, path);
        const child = yield* getInode(nextState, childInode, method, path);
        nextState = yield* detachEntry(
          nextState,
          {
            parent: directory,
            name: childName,
            entry: child,
            path: childPath(target.path, childName),
          },
          now,
          true,
          method,
          path,
          depth + 1
        );
      }
    }
    const parent = yield* getDirectory(nextState, target.parent.ino, method, path);
    const entry = yield* getInode(nextState, target.entry.ino, method, path);
    const nextParent = {
      ...parent,
      entries: HashMap.remove(parent.entries, target.name),
      nlink: entry._tag === "Directory" ? parent.nlink - 1 : parent.nlink,
    };
    const nextEntry = {
      ...entry,
      nlink: entry.nlink - (entry._tag === "Directory" ? DIR_LINK_COUNT : 1),
    };
    return reclaimInode(touchNamespaceMutation(nextState, nextParent, nextEntry, now), nextEntry);
  })
);

// =============================================================================
// directory operations
// =============================================================================

// The per-component context of one `makeDirectory` walk.
interface MakeDirectoryStep {
  readonly candidate: string;
  readonly final: boolean;
  readonly method: string;
  readonly mode: number | undefined;
  readonly path: string;
  readonly recursive: boolean;
}

// The state threaded through a `makeDirectory` walk and the paths it created.
interface MakeDirectoryWalk {
  readonly createdPaths: Array<string>;
  state: State;
}

// An existing component: a non-directory as the FINAL component is EEXIST; one
// earlier in the path cannot hold children — ENOTDIR. Answers `true` when the
// walk ends here successfully (a recursive mkdir of an existing directory).
const existingDirectoryComponent = Effect.fnUntraced(function* (entry: InodeEntry, step: MakeDirectoryStep) {
  if (entry._tag !== "Directory") {
    return yield* step.final ? alreadyExists(step.method, step.path) : badResource(step.method, step.path, "ENOTDIR");
  }
  if (!step.final) return false;
  return step.recursive ? true : yield* alreadyExists(step.method, step.path);
});

// KIT EXTENSION (errno fidelity): the entry exists but does not resolve, so it
// is a dangling or looping symbolic link. A recursive mkdir follows it and
// reports why it failed (node's EEXIST → stat fallback): the final component
// answers the resolution errno; earlier in the path the node adapter's callback
// `fs.mkdir` turns a dangling ENOENT into ENOTDIR, while any other code (ELOOP)
// is what the deeper mkdir syscall raised itself.
const unresolvedDirectoryComponent = (step: MakeDirectoryStep, failure: PlatformError): PlatformError => {
  if (!step.recursive) return alreadyExists(step.method, step.path);
  const cause = O.getOrThrow(O.filter(O.some(failure.reason.cause), S.is(ErrnoException)));
  return errnoError(step.method, step.path, !step.final && cause.code === "ENOENT" ? "ENOTDIR" : cause.code, undefined);
};
// END KIT EXTENSION (errno fidelity)

const applyCreatedDirectoryMode = Effect.fnUntraced(function* (state: State, inode: Inode, step: MakeDirectoryStep) {
  const entry = yield* getDirectory(state, inode, step.method, step.path);
  return step.mode === undefined
    ? state
    : setInode(state, { ...entry, mode: DIR_TYPE_MODE | (step.mode & PERMISSION_MODE) });
});

const createDirectoryComponent = Effect.fnUntraced(function* (
  walk: MakeDirectoryWalk,
  step: MakeDirectoryStep,
  failure: PlatformError
) {
  const parent = yield* resolveParent(walk.state, step.candidate, step.method, step.path);
  // KIT EXTENSION (case folding)
  if (findEntry(walk.state, parent.entry, parent.name) !== undefined) {
    return yield* unresolvedDirectoryComponent(step, failure);
  }
  const [createdState, inode] = yield* createDirectory(walk.state);
  const modedState = yield* applyCreatedDirectoryMode(createdState, inode, step);
  walk.state = yield* attachDirectory(modedState, parent.inode, parent.name, inode, step.method);
  walk.createdPaths.push(childPath(parent.path, parent.name));
});

// One component of the walk; answers `true` when the walk ends successfully early.
const makeDirectoryComponent = Effect.fnUntraced(function* (walk: MakeDirectoryWalk, step: MakeDirectoryStep) {
  const existing = yield* Effect.result(resolve(walk.state, step.candidate, { method: step.method }));
  if (existing._tag === "Success") {
    return yield* existingDirectoryComponent(existing.success.entry, step);
  }
  if (!step.recursive && !step.final) {
    return yield* withSystemErrorPath(existing.failure, step.method, step.path);
  }
  yield* createDirectoryComponent(walk, step, existing.failure);
  return false;
});

// Walks every component of a non-root path, creating what is missing.
const makeDirectoryPieces = Effect.fnUntraced(function* (
  state: State,
  path: string,
  pieces: ReadonlyArray<string>,
  recursive: boolean,
  mode: number | undefined
) {
  const method = "makeDirectory";
  const prefix = Str.startsWith("/")(path) ? "/" : "";
  const walk: MakeDirectoryWalk = { state, createdPaths: [] };
  for (let index = 0; index < pieces.length; index++) {
    const candidate = `${prefix}${A.join(pieces.slice(0, index + 1), "/")}`;
    const final = index === pieces.length - 1;
    if (yield* makeDirectoryComponent(walk, { method, path, candidate, final, recursive, mode })) {
      return transitionResult(walk.state, undefined);
    }
  }
  return transitionResult(
    walk.state,
    undefined,
    A.map(walk.createdPaths, (path): FileSystem.WatchEvent.Create => ({ _tag: "Create", path }))
  );
});

const makeDirectory = (volume: Volume) =>
  Effect.fnUntraced(function* (
    path: string,
    options?: { readonly recursive?: boolean | undefined; readonly mode?: number | undefined }
  ) {
    const method = "makeDirectory";
    yield* validateMode(method, options?.mode);
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const recursive = options?.recursive === true;
        const pieces = A.filter(Str.split("/")(path), (piece) => piece.length > 0);
        if (Str.includes("\0")(path)) {
          return yield* nullBytePath(method);
        }
        if (path.length === 0) {
          return yield* notFound(method, path);
        }
        if (pieces.length === 0) {
          // The root always exists: node answers `mkdir("/")` EEXIST, and a
          // recursive `mkdir -p /` succeeds as a no-op.
          return recursive ? transitionResult(state, undefined) : yield* alreadyExists(method, path);
        }
        return yield* makeDirectoryPieces(state, path, pieces, recursive, options?.mode);
      })
    );
  });

const link = (volume: Volume) =>
  Effect.fnUntraced(function* (fromPath: string, toPath: string) {
    const method = "link";
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const source = yield* resolve(state, fromPath, { method }).pipe(
          Effect.mapError(withSystemErrorPath(method, fromPath))
        );
        const destination = yield* resolveParent(state, toPath, method);
        const nextState = yield* linkInode(state, destination.inode, destination.name, source.inode, method).pipe(
          Effect.mapError(withSystemErrorPath(method, toPath))
        );
        return transitionResult(nextState, undefined, [
          {
            _tag: "Create",
            path: childPath(destination.path, destination.name),
          },
        ]);
      })
    );
  });

const symlink = (volume: Volume) =>
  Effect.fnUntraced(function* (target: string, path: string) {
    const method = "symlink";
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const parent = yield* resolveParent(state, path, method);
        if (Str.includes("\0")(target)) {
          return yield* argumentError(method, "target must not contain a null byte");
        }
        const [createdState, inode] = yield* createSymbolicLink(state, target);
        const nextState = yield* linkInode(createdState, parent.inode, parent.name, inode, method).pipe(
          Effect.mapError(withSystemErrorPath(method, path))
        );
        return transitionResult(nextState, undefined, [
          {
            _tag: "Create",
            path: childPath(parent.path, parent.name),
          },
        ]);
      })
    );
  });

const readLink = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string) {
    return yield* volume.withState(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { followFinalSymbolicLink: false, method: "readLink" });
        if (resolved.entry._tag !== "SymbolicLink") {
          return yield* errnoError("readLink", path, "EINVAL", "Not a symbolic link");
        }
        return resolved.entry.target;
      })
    );
  });

const realPath = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string) {
    return yield* volume.withState((state) => Effect.map(resolve(state, path, { method: "realPath" }), (_) => _.path));
  });

const remove = (volume: Volume) =>
  Effect.fnUntraced(function* (
    path: string,
    options?: { readonly recursive?: boolean | undefined; readonly force?: boolean | undefined }
  ) {
    const method = "remove";
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const target = yield* Effect.result(resolveEntry(state, path, method));
        if (target._tag === "Failure") {
          if (options?.force === true && target.failure.reason._tag === "NotFound") {
            return transitionResult(state, undefined);
          }
          return yield* target.failure;
        }
        // KIT EXTENSION (errno fidelity): node's `fs.rm` refuses ANY directory
        // without `recursive` — empty or not, `force` or not — with
        // ERR_FS_EISDIR before it touches the entry.
        if (target.success.entry._tag === "Directory" && options?.recursive !== true) {
          return yield* errnoError(method, path, "ERR_FS_EISDIR", "Path is a directory");
        }
        const now = yield* DateTime.now;
        const nextState = yield* detachEntry(state, target.success, now, options?.recursive === true, method, path);
        return transitionResult(nextState, undefined, [{ _tag: "Remove", path: target.success.path }]);
      })
    );
  });

// PORT NOTE: iterative worklist where upstream recursed — a pathological tree
// depth must never become a stack-overflow defect.
const containsDirectory: {
  (state: State, ancestor: Inode, candidate: Inode): boolean;
  (ancestor: Inode, candidate: Inode): (state: State) => boolean;
} = dual(3, (state: State, ancestor: Inode, candidate: Inode): boolean => {
  const pending: Array<Inode> = [ancestor];
  while (pending.length > 0) {
    const current = O.getOrThrow(O.fromUndefinedOr(pending.pop()));
    if (current === candidate) return true;
    const entry = O.getOrThrow(O.filter(HashMap.get(state.inodes, current), InodeEntry.isAnyOf(["Directory"])));
    for (const inode of HashMap.values(entry.entries)) {
      if (findInode(state, inode)?._tag === "Directory") {
        pending.push(inode);
      }
    }
  }
  return false;
});

type ResolvedSourceEntry = ResolvedEntry & { readonly requestedName: string };

interface ResolvedParentDirectory {
  readonly entry: DirectoryInode;
  readonly inode: Inode;
  readonly name: string;
  readonly path: string;
}

// Where a rename lands: the stored spelling it takes, and the inode it replaces.
interface RenameDestination {
  readonly inode: Inode | undefined;
  readonly name: string;
}

// A directory may be renamed onto a trailing-slash path that does not exist
// yet; a non-directory cannot (ENOTDIR on Linux).
const resolveRenameDestinationParent = (
  state: State,
  source: ResolvedSourceEntry,
  newPath: string,
  method: string
): Effect.Effect<ResolvedParentDirectory, PlatformError> =>
  source.entry._tag === "Directory" && /[^/]\/+$/.test(newPath)
    ? resolveParent(state, Str.replace(/\/+$/, "")(newPath), method, newPath)
    : resolveParent(state, newPath, method, newPath, "ENOTDIR");

const isCaseOnlyRename = (
  source: ResolvedSourceEntry,
  destinationParent: ResolvedParentDirectory,
  found: readonly [string, Inode]
): boolean =>
  found[1] === source.entry.ino && found[0] === source.name && source.parent.ino === destinationParent.inode;

// KIT EXTENSION (case folding): one folded
// lookup gives the destination's stored key and inode. A hit on the source
// entry ITSELF (same directory, same stored key) is a case-only rename: it
// rekeys the entry under the requested spelling, children attached, and
// detaches nothing. Any other hit is replaced under its STORED spelling
// (host-proven on APFS); a miss takes the requested spelling. `undefined`
// means the rename is a no-op (another link to the same inode).
const renameDestination = (
  state: State,
  source: ResolvedSourceEntry,
  destinationParent: ResolvedParentDirectory
): RenameDestination | undefined => {
  const found = lookupEntry(state, destinationParent.entry, destinationParent.name);
  if (found === undefined || isCaseOnlyRename(source, destinationParent, found)) {
    return { name: destinationParent.name, inode: undefined };
  }
  if (found[1] === source.entry.ino) return undefined;
  return { name: found[0], inode: found[1] };
};
// END KIT EXTENSION (case folding)

const validateRenameReplacement = Effect.fnUntraced(function* (
  source: InodeEntry,
  destination: InodeEntry,
  method: string,
  newPath: string
) {
  if (source._tag === "Directory" && destination._tag !== "Directory") {
    return yield* badResource(method, newPath, "ENOTDIR", "Cannot replace a non-directory with a directory");
  }
  if (source._tag !== "Directory" && destination._tag === "Directory") {
    return yield* badResource(method, newPath, "EISDIR", "Cannot replace a directory with a non-directory");
  }
  if (destination._tag === "Directory" && HashMap.size(destination.entries) > 0) {
    return yield* errnoError(method, newPath, "ENOTEMPTY", "Directory is not empty");
  }
});

// The entry a rename replaces, validated against the source, if any.
const resolveRenameReplacement = Effect.fnUntraced(function* (
  state: State,
  source: ResolvedSourceEntry,
  destinationParent: ResolvedParentDirectory,
  destination: RenameDestination,
  method: string,
  newPath: string
) {
  if (destination.inode === undefined) return undefined;
  const replaced: ResolvedEntry = {
    parent: destinationParent.entry,
    name: destination.name,
    entry: yield* getInode(state, destination.inode, method, newPath),
    path: childPath(destinationParent.path, destination.name),
  };
  yield* validateRenameReplacement(source.entry, replaced.entry, method, newPath);
  return replaced;
});

const relinkAcrossDirectories = Effect.fnUntraced(function* (
  state: State,
  sourceParent: DirectoryInode,
  sourceName: string,
  moved: InodeEntry,
  destinationParentInode: Inode,
  destinationName: string,
  now: DateTime.Utc,
  method: string,
  newPath: string
) {
  const nextDestinationParent = yield* getDirectory(state, destinationParentInode, method, newPath);
  const detached = setInode(state, {
    ...sourceParent,
    entries: HashMap.remove(sourceParent.entries, sourceName),
    nlink: moved._tag === "Directory" ? sourceParent.nlink - 1 : sourceParent.nlink,
    mtime: now,
    ctime: now,
  });
  return setInode(detached, {
    ...nextDestinationParent,
    entries: HashMap.set(nextDestinationParent.entries, destinationName, moved.ino),
    nlink: moved._tag === "Directory" ? nextDestinationParent.nlink + 1 : nextDestinationParent.nlink,
    mtime: now,
    ctime: now,
  });
});

const moveRenamedEntry = Effect.fnUntraced(function* (
  state: State,
  source: ResolvedSourceEntry,
  destinationParentInode: Inode,
  destinationName: string,
  now: DateTime.Utc,
  method: string,
  oldPath: string,
  newPath: string
) {
  const sourceParent = yield* getDirectory(state, source.parent.ino, method, oldPath);
  const moved = yield* getInode(state, source.entry.ino, method, oldPath);
  const relinked =
    sourceParent.ino === destinationParentInode
      ? setInode(state, {
          ...sourceParent,
          entries: HashMap.set(HashMap.remove(sourceParent.entries, source.name), destinationName, moved.ino),
          mtime: now,
          ctime: now,
        })
      : yield* relinkAcrossDirectories(
          state,
          sourceParent,
          source.name,
          moved,
          destinationParentInode,
          destinationName,
          now,
          method,
          newPath
        );
  return setInode(relinked, { ...moved, ctime: now });
});

const rename = (volume: Volume) =>
  Effect.fnUntraced(function* (oldPath: string, newPath: string) {
    const method = "rename";
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const source = yield* resolveEntry(state, oldPath, method);
        const destinationParent = yield* resolveRenameDestinationParent(state, source, newPath, method);
        // KIT EXTENSION (case folding): the no-op
        // guard compares the QUERIED source leaf — XNU skips a byte-identical
        // rename, so `rename("dir", "dir")` over a stored `Dir` keeps `Dir`.
        if (source.parent.ino === destinationParent.inode && source.requestedName === destinationParent.name) {
          return transitionResult(state, undefined);
        }
        if (source.entry._tag === "Directory" && containsDirectory(state, source.entry.ino, destinationParent.inode)) {
          return yield* errnoError(method, newPath, "EINVAL", "Cannot move a directory into itself");
        }
        const destination = renameDestination(state, source, destinationParent);
        if (destination === undefined) {
          return transitionResult(state, undefined);
        }
        const replaced = yield* resolveRenameReplacement(
          state,
          source,
          destinationParent,
          destination,
          method,
          newPath
        );
        const now = yield* DateTime.now;
        const detached =
          replaced === undefined ? state : yield* detachEntry(state, replaced, now, false, method, newPath);
        const nextState = yield* moveRenamedEntry(
          detached,
          source,
          destinationParent.inode,
          destination.name,
          now,
          method,
          oldPath,
          newPath
        );
        return transitionResult(nextState, undefined, [
          { _tag: "Remove", path: source.path },
          { _tag: "Create", path: childPath(destinationParent.path, destination.name) },
        ]);
      })
    );
  });

// =============================================================================
// copy operations
// =============================================================================

// PORT NOTE: `depth` bounds the recursion at MAX_NESTING_DEPTH, failing typed —
// upstream recursed unbounded.
const cloneInode: {
  (
    state: State,
    source: InodeEntry,
    context: CloneContext,
    depth?: number | undefined
  ): Effect.Effect<readonly [State, Inode], PlatformError>;
  (
    source: InodeEntry,
    context: CloneContext,
    depth?: number | undefined
  ): (state: State) => Effect.Effect<readonly [State, Inode], PlatformError>;
} = dual(
  (args) => isState(args[0]),
  Effect.fnUntraced(function* (state: State, source: InodeEntry, context: CloneContext, depth: number | undefined = 0) {
    const { method, sourcePath: path, preserveTimestamps } = context;
    if (depth > MAX_NESTING_DEPTH) {
      return yield* volumeLimit(method, path, "Directory tree exceeds the maximum nesting depth");
    }
    const applyMetadata: {
      (state: State, entry: InodeEntry): State;
      (entry: InodeEntry): (state: State) => State;
    } = dual(
      2,
      (state: State, entry: InodeEntry): State =>
        setInode(state, {
          ...entry,
          mode: source.mode,
          mtime: preserveTimestamps ? source.mtime : entry.mtime,
        })
    );
    return yield* InodeEntry.match(source, {
      File: Effect.fn("Volume.cloneFile")(function* (source: FileInode) {
        const [createdState, inode] = yield* createFile(state, source.data);
        const nextState = applyMetadata(createdState, yield* getInode(createdState, inode, method, path));
        return [nextState, inode] as const;
      }),
      SymbolicLink: Effect.fn("Volume.cloneSymbolicLink")(function* (source: SymbolicLinkInode) {
        const [createdState, inode] = yield* createSymbolicLink(state, source.target);
        const nextState = applyMetadata(createdState, yield* getInode(createdState, inode, method, path));
        return [nextState, inode] as const;
      }),
      Directory: Effect.fn("Volume.cloneDirectory")(function* (source: DirectoryInode) {
        let [nextState, inode] = yield* createDirectory(state);
        const children = A.sort(source.entries, InodeNameOrder);
        for (const [name, childInode] of children) {
          const child = yield* getInode(nextState, childInode, method, path);
          const [clonedState, clone] = yield* cloneInode(nextState, child, context, depth + 1);
          nextState = clonedState;
          if (child._tag === "Directory") {
            nextState = yield* attachDirectory(nextState, inode, name, clone, method);
          } else {
            nextState = yield* linkInode(nextState, inode, name, clone, method);
          }
        }
        nextState = applyMetadata(nextState, yield* getDirectory(nextState, inode, method, path));
        return [nextState, inode] as const;
      }),
    });
  })
);

// PORT NOTE: `depth` bounds the recursion at MAX_NESTING_DEPTH, failing typed —
// upstream recursed unbounded.
const validateCopyDirectoryContents: {
  (
    state: State,
    source: DirectoryInode,
    destination: DirectoryInode,
    overwrite: boolean,
    method: string,
    path: string,
    depth?: number | undefined
  ): Effect.Effect<void, PlatformError>;
  (
    source: DirectoryInode,
    destination: DirectoryInode,
    overwrite: boolean,
    method: string,
    path: string,
    depth?: number | undefined
  ): (state: State) => Effect.Effect<void, PlatformError>;
} = dual(
  (args) => isState(args[0]),
  Effect.fnUntraced(function* (
    state: State,
    source: DirectoryInode,
    destination: DirectoryInode,
    overwrite: boolean,
    method: string,
    path: string,
    depth: number | undefined = 0
  ) {
    if (depth > MAX_NESTING_DEPTH) {
      return yield* volumeLimit(method, path, "Directory tree exceeds the maximum nesting depth");
    }
    for (const [name, sourceInode] of source.entries) {
      const sourceEntry = yield* getInode(state, sourceInode, method, path);
      // KIT EXTENSION (case folding): folded lookup.
      const destinationInode = findEntry(state, destination, name);
      if (destinationInode !== undefined) {
        const destinationEntry = yield* getInode(state, destinationInode, method, path);
        yield* validateCopyChild(state, sourceEntry, destinationEntry, overwrite, method, path, depth);
      }
    }
  })
);

// One source child against the existing destination child of the same name.
const validateCopyChild = Effect.fnUntraced(function* (
  state: State,
  sourceEntry: InodeEntry,
  destinationEntry: InodeEntry,
  overwrite: boolean,
  method: string,
  path: string,
  depth: number
) {
  if (sourceEntry._tag === "Directory" && destinationEntry._tag === "Directory") {
    return yield* validateCopyDirectoryContents(
      state,
      sourceEntry,
      destinationEntry,
      overwrite,
      method,
      path,
      depth + 1
    );
  }
  // KIT EXTENSION (errno fidelity): node's `fs.cp` checks entry kinds before
  // it consults `force`, so a kind mismatch fails even without overwrite.
  if (sourceEntry._tag === "Directory") {
    return yield* errnoError(
      method,
      path,
      "ERR_FS_CP_DIR_TO_NON_DIR",
      "Cannot replace a non-directory with a directory"
    );
  }
  if (destinationEntry._tag === "Directory") {
    return yield* errnoError(
      method,
      path,
      "ERR_FS_CP_NON_DIR_TO_DIR",
      "Cannot replace a directory with a non-directory"
    );
  }
  // A file-onto-file conflict without overwrite is left to the caller's
  // top-level AlreadyExists, so a kind mismatch anywhere in the tree wins.
});

// Shared destination subtrees have already passed the depth and kind validation;
// new subtrees retain cloneInode's independent depth bound.
const copyDirectoryContents: {
  (
    state: State,
    source: DirectoryInode,
    destination: DirectoryInode,
    method: string,
    path: string,
    preserveTimestamps: boolean,
    depth?: number | undefined
  ): Effect.Effect<State, PlatformError>;
  (
    source: DirectoryInode,
    destination: DirectoryInode,
    method: string,
    path: string,
    preserveTimestamps: boolean,
    depth?: number | undefined
  ): (state: State) => Effect.Effect<State, PlatformError>;
} = dual(
  (args) => isState(args[0]),
  Effect.fnUntraced(function* (
    state: State,
    source: DirectoryInode,
    destination: DirectoryInode,
    method: string,
    path: string,
    preserveTimestamps: boolean,
    depth: number | undefined = 0
  ) {
    let nextState = state;
    const cloneContext = { method, sourcePath: path, preserveTimestamps } satisfies CloneContext;
    const children = A.sort(source.entries, InodeNameOrder);
    for (const [name, sourceInode] of children) {
      nextState = yield* copyDirectoryChild(nextState, cloneContext, destination.ino, name, sourceInode, depth);
    }
    return nextState;
  })
);

// Clones `sourceEntry` and links it into `parent` under `name`.
const attachCopiedClone = Effect.fnUntraced(function* (
  state: State,
  sourceEntry: InodeEntry,
  context: CloneContext,
  parent: Inode,
  name: string
) {
  const [clonedState, clone] = yield* cloneInode(state, sourceEntry, context);
  return sourceEntry._tag === "Directory"
    ? yield* attachDirectory(clonedState, parent, name, clone, context.method)
    : yield* linkInode(clonedState, parent, name, clone, context.method);
});

// Detaches the existing destination child `name` (its stored key) of `parent`.
const detachCopyDestinationChild = Effect.fnUntraced(function* (
  state: State,
  parent: DirectoryInode,
  name: string,
  inode: Inode,
  method: string,
  path: string
) {
  const entry = yield* getInode(state, inode, method, path);
  const now = yield* DateTime.now;
  return yield* detachEntry(state, { parent, name, entry, path: childPath(path, name) }, now, false, method, path);
});

const copyDirectoryChild = Effect.fnUntraced(function* (
  state: State,
  context: CloneContext,
  destinationIno: Inode,
  name: string,
  sourceInode: Inode,
  depth: number
) {
  const { method, sourcePath: path, preserveTimestamps } = context;
  const sourceEntry = yield* getInode(state, sourceInode, method, path);
  const currentDestination = yield* getDirectory(state, destinationIno, method, path);
  // KIT EXTENSION (case folding): a folded-equal
  // destination child is detached by its STORED key and the copy linked under
  // the SOURCE spelling — node's async `fs.cp` unlinks then recreates
  // (host-proven: `x.txt` replaced from `X.txt` lists as `X.txt`).
  const found = lookupEntry(state, currentDestination, name);
  if (found === undefined) {
    return yield* attachCopiedClone(state, sourceEntry, context, destinationIno, name);
  }
  const [destinationName, destinationInode] = found;
  if (sourceEntry._tag === "Directory") {
    // Kind and nesting checks completed in validateCopyDirectoryContents before mutation.
    const destinationEntry = yield* getDirectory(state, destinationInode, method, path);
    return yield* copyDirectoryContents(
      state,
      sourceEntry,
      destinationEntry,
      method,
      path,
      preserveTimestamps,
      depth + 1
    );
  }
  const detached = yield* detachCopyDestinationChild(
    state,
    currentDestination,
    destinationName,
    destinationInode,
    method,
    path
  );
  return yield* attachCopiedClone(detached, sourceEntry, context, destinationIno, name);
});

// A missing destination is created in its parent; a trailing slash on a
// missing destination is EISDIR.
const missingCopyFileDestination = (
  state: State,
  failure: PlatformError,
  candidate: string,
  path: string,
  method: string
): Effect.Effect<ResolvedParentDirectory, PlatformError> =>
  failure.reason._tag === "NotFound"
    ? resolveParent(state, candidate, method, path, "EISDIR")
    : Effect.fail(withSystemErrorPath(failure, method, path));

// A destination link is written THROUGH: a resolving link names its target's
// parent; a dangling one continues at its target text (an empty target or any
// other failure is final).
const followCopyFileDestinationLink = Effect.fnUntraced(function* (
  state: State,
  candidate: string,
  link: ResolvedInode & { readonly entry: SymbolicLinkInode },
  path: string,
  method: string
) {
  const resolved = yield* Effect.result(resolve(state, candidate, { method }));
  if (resolved._tag === "Success") {
    return yield* resolveParent(state, resolved.success.path, method, path);
  }
  if (resolved.failure.reason._tag !== "NotFound" || link.entry.target.length === 0) {
    return yield* withSystemErrorPath(resolved.failure, method, path);
  }
  return symbolicLinkTargetPath(link.path, link.entry.target);
});

// One hop of the destination walk: the resolved parent, or the next candidate path.
const copyFileDestinationStep = Effect.fnUntraced(function* (
  state: State,
  candidate: string,
  path: string,
  method: string
) {
  const unresolved = yield* Effect.result(resolve(state, candidate, { followFinalSymbolicLink: false, method }));
  if (unresolved._tag === "Failure") {
    return yield* missingCopyFileDestination(state, unresolved.failure, candidate, path, method);
  }
  const { entry } = unresolved.success;
  if (entry._tag !== "SymbolicLink") {
    return yield* resolveParent(state, unresolved.success.path, method, path);
  }
  return yield* followCopyFileDestinationLink(state, candidate, { ...unresolved.success, entry }, path, method);
});

const resolveCopyFileDestination: {
  (
    state: State,
    path: string,
    method: string
  ): Effect.Effect<{ inode: Inode; entry: DirectoryInode; name: string; path: string }, PlatformError>;
  (
    path: string,
    method: string
  ): (
    state: State
  ) => Effect.Effect<{ inode: Inode; entry: DirectoryInode; name: string; path: string }, PlatformError>;
} = dual(
  3,
  Effect.fnUntraced(function* (state: State, path: string, method: string) {
    let candidate: string | ResolvedParentDirectory = path;
    while (P.isString(candidate)) {
      candidate = yield* copyFileDestinationStep(state, candidate, path, method);
    }
    return candidate;
  })
);

const copyFileUnlocked: {
  (
    state: State,
    fromPath: string,
    toPath: string
  ): Effect.Effect<readonly [State, false] | readonly [State, true], PlatformError>;
  (
    fromPath: string,
    toPath: string
  ): (state: State) => Effect.Effect<readonly [State, false] | readonly [State, true], PlatformError>;
} = dual(
  3,
  Effect.fnUntraced(function* (state: State, fromPath: string, toPath: string) {
    const method = "copyFile";
    const source = yield* resolve(state, fromPath, { method }).pipe(
      Effect.mapError(withSystemErrorPath(method, fromPath))
    );
    if (source.entry._tag !== "File") {
      return yield* badResource(method, fromPath, "EISDIR", "Source is not a file");
    }
    const sourceFile = source.entry;
    const destination = yield* resolveCopyFileDestination(state, toPath, method);
    // KIT EXTENSION (case folding): folded lookup.
    const existingInode = findEntry(state, destination.entry, destination.name);
    if (existingInode === source.inode) return [state, false] as const;

    if (existingInode !== undefined) {
      const existing = yield* getInode(state, existingInode, method, toPath);
      if (existing._tag !== "File") {
        return yield* badResource(method, toPath, "EISDIR", "Destination is a directory");
      }
      const data = yield* Effect.try({
        try: () => sourceFile.data.slice(),
        catch: () => volumeLimit(method, toPath, "Unable to allocate file bytes"),
      });
      const now = yield* DateTime.now;
      return [
        setInode(state, {
          ...existing,
          data,
          mode: sourceFile.mode,
          mtime: now,
          ctime: now,
        }),
        true,
      ] as const;
    }

    const [clonedState, inode] = yield* cloneInode(state, sourceFile, {
      method,
      sourcePath: fromPath,
      preserveTimestamps: false,
    });
    const nextState = yield* linkInode(clonedState, destination.inode, destination.name, inode, method);
    return [nextState, true] as const;
  })
);

// KIT EXTENSION (errno fidelity): node's `fs.cp` rejects a source and
// destination that are one inode (the same path, or two hard links) and a
// directory/non-directory mismatch BEFORE it consults `force`, with its own
// ERR_FS_CP_* codes (tag Unknown).
const validateCopyEntryKinds = Effect.fnUntraced(function* (
  state: State,
  source: InodeEntry,
  existing: InodeEntry,
  overwrite: boolean,
  method: string,
  toPath: string
) {
  if (source._tag === "Directory" && existing._tag !== "Directory") {
    return yield* errnoError(method, toPath, "ERR_FS_CP_DIR_TO_NON_DIR", "Destination is not a directory");
  }
  if (source._tag !== "Directory" && existing._tag === "Directory") {
    return yield* errnoError(method, toPath, "ERR_FS_CP_NON_DIR_TO_DIR", "Destination is a directory");
  }
  if (source._tag === "Directory" && existing._tag === "Directory") {
    yield* validateCopyDirectoryContents(state, source, existing, overwrite, method, toPath);
  }
});

// The existing destination entry, once the copy may replace or merge into it.
const validateCopyEntryExisting = Effect.fnUntraced(function* (
  state: State,
  source: ResolvedInode,
  existingInode: Inode,
  overwrite: boolean,
  method: string,
  toPath: string
) {
  const existing = yield* getInode(state, existingInode, method, toPath);
  if (existingInode === source.inode) {
    return yield* errnoError(method, toPath, "ERR_FS_CP_EINVAL", "Source and destination are the same entry");
  }
  yield* validateCopyEntryKinds(state, source.entry, existing, overwrite, method, toPath);
  // PORT NOTE: upstream reported `fromPath` here — the one conflict arm in
  // this function blaming the SOURCE while every sibling arm reports the
  // destination. The conflict is the existing DESTINATION entry, so the
  // error names `toPath` (upstream 6573 bug, fixed in this port).
  // Known divergence, kept: node's `fs.cp` without `force` silently keeps
  // an existing destination instead of failing.
  if (!overwrite) return yield* alreadyExists(method, toPath);
  return existing;
});

// Clones the source, detaches any replaced destination, and links the clone
// under the REQUESTED spelling.
const replaceWithCopy = Effect.fnUntraced(function* (
  state: State,
  source: InodeEntry,
  context: CloneContext,
  destination: ResolvedParentDirectory,
  destinationName: string,
  existing: InodeEntry | undefined,
  toPath: string
) {
  const { method } = context;
  const [clonedState, inode] = yield* cloneInode(state, source, context);
  const entry = yield* getInode(clonedState, inode, method, toPath);
  const now = yield* DateTime.now;
  const detached =
    existing === undefined
      ? clonedState
      : yield* detachEntry(
          clonedState,
          {
            parent: destination.entry,
            name: destinationName,
            entry: existing,
            path: childPath(destination.path, destinationName),
          },
          now,
          true,
          method,
          toPath
        );
  return entry._tag === "Directory"
    ? yield* attachDirectory(detached, destination.inode, destination.name, inode, method)
    : yield* linkInode(detached, destination.inode, destination.name, inode, method);
});

const copyEntryUnlocked: {
  (
    state: State,
    fromPath: string,
    toPath: string,
    overwrite: boolean,
    preserveTimestamps: boolean
  ): Effect.Effect<readonly [State, true], PlatformError>;
  (
    fromPath: string,
    toPath: string,
    overwrite: boolean,
    preserveTimestamps: boolean
  ): (state: State) => Effect.Effect<readonly [State, true], PlatformError>;
} = dual(
  5,
  Effect.fnUntraced(function* (
    state: State,
    fromPath: string,
    toPath: string,
    overwrite: boolean,
    preserveTimestamps: boolean
  ) {
    const method = "copy";
    const source = yield* resolve(state, fromPath, {
      followFinalSymbolicLink: false,
      method,
    }).pipe(Effect.mapError(withSystemErrorPath(method, fromPath)));
    const destination = yield* resolveParent(state, toPath, method);
    if (source.entry._tag === "Directory" && containsDirectory(state, source.inode, destination.inode)) {
      return yield* errnoError(method, toPath, "ERR_FS_CP_EINVAL", "Cannot copy a directory into itself");
    }

    // KIT EXTENSION (case folding): an existing
    // folded-equal destination is detached by its STORED key and the copy linked
    // under the REQUESTED spelling — node's async `fs.cp` unlinks then recreates
    // (host-proven: `a.txt` copied onto `B.TXT` over `b.txt` lists as `B.TXT`).
    const found = lookupEntry(state, destination.entry, destination.name);
    const destinationName = found?.[0] ?? destination.name;
    const existing =
      found === undefined
        ? undefined
        : yield* validateCopyEntryExisting(state, source, found[1], overwrite, method, toPath);

    if (source.entry._tag === "Directory" && existing?._tag === "Directory") {
      const nextState = yield* copyDirectoryContents(state, source.entry, existing, method, toPath, preserveTimestamps);
      return [nextState, true] as const;
    }

    const nextState = yield* replaceWithCopy(
      state,
      source.entry,
      { method, sourcePath: fromPath, preserveTimestamps },
      destination,
      destinationName,
      existing,
      toPath
    );
    return [nextState, true] as const;
  })
);

const copyFile = (volume: Volume) =>
  Effect.fnUntraced(function* (fromPath: string, toPath: string) {
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const existing = yield* Effect.result(resolve(state, toPath, { method: "copyFile" }));
        const [nextState, changed] = yield* copyFileUnlocked(state, fromPath, toPath);
        if (!changed) return transitionResult(nextState, undefined);
        const destination = yield* resolve(nextState, toPath, { method: "copyFile" });
        return transitionResult(
          nextState,
          undefined,
          existing._tag === "Success"
            ? inodeUpdateEvents(nextState, destination.inode)
            : [{ _tag: "Create", path: destination.path }]
        );
      })
    );
  });

const copy = (volume: Volume) =>
  Effect.fnUntraced(function* (
    fromPath: string,
    toPath: string,
    options?: { readonly overwrite?: boolean | undefined; readonly preserveTimestamps?: boolean | undefined }
  ) {
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const existing = yield* Effect.result(
          resolve(state, toPath, {
            followFinalSymbolicLink: false,
            method: "copy",
          })
        );
        const [nextState] = yield* copyEntryUnlocked(
          state,
          fromPath,
          toPath,
          options?.overwrite === true,
          options?.preserveTimestamps === true
        );
        const destination = yield* resolve(nextState, toPath, {
          followFinalSymbolicLink: false,
          method: "copy",
        });
        return transitionResult(nextState, undefined, [
          {
            _tag: existing._tag === "Success" ? "Update" : "Create",
            path: destination.path,
          },
        ]);
      })
    );
  });

// =============================================================================
// open file descriptors
// =============================================================================

// Allocates the next descriptor for `entry` and counts the open.
const registerDescriptor = (state: State, entry: FileInode, mode: OpenMode): readonly [State, OpenFileDescriptor] => {
  const fd = FileDescriptor.make(state.nextDescriptor);
  const descriptor: OpenFileDescriptor = {
    fd,
    inode: entry.ino,
    readable: mode.readable,
    writable: mode.writable,
    append: mode.append,
    position: BigInt(0),
  };
  return [
    {
      ...state,
      nextDescriptor: state.nextDescriptor + 1,
      descriptors: HashMap.set(state.descriptors, fd, descriptor),
      inodes: HashMap.set(state.inodes, entry.ino, {
        ...entry,
        openCount: entry.openCount + 1,
      }),
    },
    descriptor,
  ] as const;
};

const truncateOnOpen = Effect.fnUntraced(function* (state: State, entry: FileInode, truncate: boolean) {
  if (!truncate) return [state, entry] as const;
  const now = yield* DateTime.now;
  const truncated: FileInode = {
    ...entry,
    data: new Uint8Array(),
    mtime: now,
    ctime: now,
  };
  return [setInode(state, truncated), truncated] as const;
});

const fileInodeOf = (state: State, inode: Inode): FileInode =>
  O.getOrThrow(O.filter(HashMap.get(state.inodes, inode), InodeEntry.isAnyOf(["File"])));

const applyCreatedFileMode = (state: State, inode: Inode, mode: number | undefined): State => {
  const created = fileInodeOf(state, inode);
  return mode === undefined ? state : setInode(state, { ...created, mode: FILE_TYPE_MODE | (mode & PERMISSION_MODE) });
};

// Creates the missing file `candidatePath` for an open with the create flag.
const createOpenedFile = Effect.fnUntraced(function* (
  state: State,
  candidatePath: string,
  path: string,
  mode: number | undefined
) {
  const parent = yield* resolveParent(state, candidatePath, "open", path, "EISDIR");
  const [createdState, inode] = yield* createFile(state);
  const moded = applyCreatedFileMode(createdState, inode, mode);
  const linked = yield* linkInode(moded, parent.inode, parent.name, inode, "open");
  return [linked, fileInodeOf(linked, inode)] as const;
});

const nonEmptyLinkTarget = (entry: InodeEntry): string | undefined =>
  entry._tag === "SymbolicLink" && entry.target.length > 0 ? entry.target : undefined;

// An existing entry that does not resolve: a creating open writes THROUGH a
// dangling link (continuing at its target text); anything else fails.
const openUnresolvedEntry = (
  link: ResolvedInode,
  failure: PlatformError,
  path: string,
  mode: OpenMode
): Effect.Effect<string, PlatformError> => {
  const target = nonEmptyLinkTarget(link.entry);
  return target !== undefined && failure.reason._tag === "NotFound" && mode.create
    ? Effect.succeed(symbolicLinkTargetPath(link.path, target))
    : Effect.fail(withSystemErrorPath(failure, "open", path));
};

const openExistingEntry = Effect.fnUntraced(function* (
  state: State,
  candidatePath: string,
  link: ResolvedInode,
  path: string,
  mode: OpenMode
) {
  if (mode.exclusive) {
    return yield* alreadyExists("open", path);
  }
  const resolved = yield* Effect.result(resolve(state, candidatePath, { method: "open" }));
  if (resolved._tag === "Failure") {
    return yield* openUnresolvedEntry(link, resolved.failure, path, mode);
  }
  if (resolved.success.entry._tag !== "File") {
    return yield* badResource("open", path, "EISDIR");
  }
  return yield* truncateOnOpen(state, resolved.success.entry, mode.truncate);
});

// One hop of an open: the opened state and file, or the next candidate path.
const openStep = Effect.fnUntraced(function* (
  state: State,
  candidatePath: string,
  path: string,
  mode: OpenMode,
  createMode: number | undefined
) {
  const unresolved = yield* Effect.result(
    resolve(state, candidatePath, {
      followFinalSymbolicLink: false,
      method: "open",
    })
  );
  if (unresolved._tag === "Success") {
    return yield* openExistingEntry(state, candidatePath, unresolved.success, path, mode);
  }
  if (unresolved.failure.reason._tag !== "NotFound" || !mode.create) {
    return yield* withSystemErrorPath(unresolved.failure, "open", path);
  }
  return yield* createOpenedFile(state, candidatePath, path, createMode);
});

const openDescriptorUnlocked: {
  (
    state: State,
    path: string,
    options: OpenOptions | undefined
  ): Effect.Effect<readonly [State, OpenFileDescriptor], PlatformError>;
  (
    path: string,
    options: OpenOptions | undefined
  ): (state: State) => Effect.Effect<readonly [State, OpenFileDescriptor], PlatformError>;
} = dual(
  3,
  Effect.fnUntraced(function* (state: State, path: string, options: OpenOptions | undefined) {
    const flag = options?.flag ?? "r";
    if (!isOpenFlag(flag)) {
      return yield* argumentError("open", "flag must be a supported file-open flag");
    }
    const mode = openMode(flag);
    yield* validateMode("open", options?.mode);
    let opened: string | readonly [State, FileInode] = path;
    while (P.isString(opened)) {
      opened = yield* openStep(state, opened, path, mode, options?.mode);
    }
    const [nextState, entry] = opened;
    return registerDescriptor(nextState, entry, mode);
  })
);

const openDescriptor: {
  (volume: Volume, path: string, options: OpenOptions | undefined): Effect.Effect<FileDescriptor, PlatformError>;
  (path: string, options: OpenOptions | undefined): (volume: Volume) => Effect.Effect<FileDescriptor, PlatformError>;
} = dual(
  3,
  Effect.fnUntraced(function* (volume: Volume, path: string, options: OpenOptions | undefined) {
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const existing = yield* Effect.result(resolve(state, path, { method: "open" }));
        const [nextState, descriptor] = yield* openDescriptorUnlocked(state, path, options);
        const mode = openMode(options?.flag ?? "r");
        const tag = existing._tag === "Failure" ? "Create" : mode.truncate ? "Update" : undefined;
        if (tag === undefined) return transitionResult(nextState, descriptor.fd);
        const resolved = yield* resolve(nextState, path, { method: "open" });
        return transitionResult(
          nextState,
          descriptor.fd,
          tag === "Update" ? inodeUpdateEvents(nextState, descriptor.inode) : [{ _tag: "Create", path: resolved.path }]
        );
      })
    );
  })
);

const closeDescriptorUnlocked: {
  (state: State, fd: FileDescriptor): State;
  (fd: FileDescriptor): (state: State) => State;
} = dual(2, (state: State, fd: FileDescriptor): State => {
  const descriptor = O.getOrThrow(HashMap.get(state.descriptors, fd));
  let nextState = {
    ...state,
    descriptors: HashMap.remove(state.descriptors, fd),
  };
  const entry = O.getOrThrow(HashMap.get(nextState.inodes, descriptor.inode));
  const nextEntry = { ...entry, openCount: entry.openCount - 1 };
  nextState = setInode(nextState, nextEntry);
  return reclaimInode(nextState, nextEntry);
});

// NOTE: Scope invokes each descriptor finalizer once, so closing decrements
// the retained inode's open-reference count exactly once.
const closeDescriptor: {
  (volume: Volume, fd: FileDescriptor): Effect.Effect<undefined>;
  (fd: FileDescriptor): (volume: Volume) => Effect.Effect<undefined>;
} = dual(
  2,
  Effect.fnUntraced(function* (volume: Volume, fd: FileDescriptor) {
    return yield* volume.mutate((state) =>
      Effect.succeed(transitionResult(closeDescriptorUnlocked(state, fd), undefined))
    );
  })
);

const fileInfo = (entry: InodeEntry): FileSystem.File.Info => ({
  type: entry._tag,
  mtime: entry.mtime.pipe(DateTime.toDateUtc, O.some),
  atime: entry.atime.pipe(DateTime.toDateUtc, O.some),
  birthtime: entry.birthtime.pipe(DateTime.toDateUtc, O.some),
  dev: BigInt(0),
  ino: O.some(BigInt(entry.ino)),
  mode: entry.mode,
  nlink: O.some(BigInt(entry.nlink)),
  uid: O.some(entry.uid),
  gid: O.some(entry.gid),
  rdev: O.some(BigInt(0)),
  size: ByteSize.bytes(entry._tag === "File" ? entry.data.length : 0),
  blksize: O.none(),
  blocks: O.none(),
});

const readDescriptorUnlocked: {
  (
    state: State,
    fd: FileDescriptor,
    length: number,
    method: string
  ): Effect.Effect<{ state: State; bytes: Uint8Array<ArrayBufferLike>; size: number }, PlatformError>;
  (
    fd: FileDescriptor,
    length: number,
    method: string
  ): (state: State) => Effect.Effect<{ state: State; bytes: Uint8Array<ArrayBufferLike>; size: number }, PlatformError>;
} = dual(
  4,
  Effect.fnUntraced(function* (state: State, fd: FileDescriptor, length: number, method: string) {
    const [descriptor, entry] = yield* getOpenFile(state, fd, method, "readable");
    if (length === 0) {
      return {
        state,
        bytes: entry.data.subarray(0, 0),
        size: 0,
      };
    }
    const position = Number(descriptor.position);
    if (!Number.isSafeInteger(position) || position < 0) {
      return yield* volumeLimit(method, fd, "Invalid file position");
    }
    const now = yield* DateTime.now;
    const bytesRead = Math.min(length, Math.max(0, entry.data.length - position));
    return {
      state: {
        ...state,
        descriptors: HashMap.set(state.descriptors, fd, {
          ...descriptor,
          position: BigInt(position + bytesRead),
        }),
        inodes: HashMap.set(state.inodes, entry.ino, { ...entry, atime: now }),
      },
      bytes: entry.data.subarray(position, position + bytesRead),
      size: bytesRead,
    };
  })
);

const readDescriptor: {
  (volume: Volume, fd: FileDescriptor, buffer: Uint8Array, method: string): Effect.Effect<number, PlatformError>;
  (fd: FileDescriptor, buffer: Uint8Array, method: string): (volume: Volume) => Effect.Effect<number, PlatformError>;
} = dual(
  4,
  (volume: Volume, fd: FileDescriptor, buffer: Uint8Array, method: string): Effect.Effect<number, PlatformError> =>
    volume.mutate((state) =>
      Effect.map(readDescriptorUnlocked(state, fd, buffer.length, method), (result) => {
        buffer.set(result.bytes);
        return transitionResult(result.state, result.size);
      })
    )
);

const writeDescriptorUnlocked: {
  (
    state: State,
    fd: FileDescriptor,
    buffer: Uint8Array,
    method: string
  ): Effect.Effect<readonly [State, number], PlatformError>;
  (
    fd: FileDescriptor,
    buffer: Uint8Array,
    method: string
  ): (state: State) => Effect.Effect<readonly [State, number], PlatformError>;
} = dual(
  4,
  Effect.fnUntraced(function* (state: State, fd: FileDescriptor, buffer: Uint8Array, method: string) {
    const [descriptor, entry] = yield* getOpenFile(state, fd, method, "writable");
    if (buffer.length === 0) {
      return [state, 0] as const;
    }
    const position = descriptor.append ? entry.data.length : Number(descriptor.position);
    if (!Number.isSafeInteger(position) || position < 0) {
      return yield* volumeLimit(method, fd, "Invalid file position");
    }
    const length = position + buffer.length;
    if (!Number.isSafeInteger(length)) {
      return yield* volumeLimit(method, fd, "File is too large");
    }
    const now = yield* DateTime.now;
    const data = length > entry.data.length ? yield* allocateBytes(length, fd, method) : entry.data;
    const descriptors = descriptor.append
      ? state.descriptors
      : HashMap.set(state.descriptors, fd, {
          ...descriptor,
          position: BigInt(length),
        });
    const nextState = {
      ...state,
      descriptors,
      inodes: HashMap.set(state.inodes, entry.ino, {
        ...entry,
        data,
        mtime: now,
        ctime: now,
      }),
    };
    if (data !== entry.data) {
      data.set(entry.data);
    }
    // NOTE: This is the only mutation of committed file bytes. All typed failure and
    // allocation points have completed, and the volume permit excludes readers.
    data.set(buffer, position);
    return [nextState, buffer.length] as const;
  })
);

const writeDescriptor: {
  (volume: Volume, fd: FileDescriptor, buffer: Uint8Array, method: string): Effect.Effect<number, PlatformError>;
  (fd: FileDescriptor, buffer: Uint8Array, method: string): (volume: Volume) => Effect.Effect<number, PlatformError>;
} = dual(
  4,
  (volume: Volume, fd: FileDescriptor, buffer: Uint8Array, method: string): Effect.Effect<number, PlatformError> =>
    volume.mutate(
      Effect.fnUntraced(function* (state) {
        const [nextState, written] = yield* writeDescriptorUnlocked(state, fd, buffer, method);
        if (written === 0) return transitionResult(nextState, written);
        const descriptor = O.getOrThrow(HashMap.get(nextState.descriptors, fd));
        return transitionResult(nextState, written, inodeUpdateEvents(nextState, descriptor.inode));
      })
    )
);

// =============================================================================
// file handles
// =============================================================================

class MemoryFile implements FileSystem.File {
  readonly [FileSystem.FileTypeId]: typeof FileSystem.FileTypeId = FileSystem.FileTypeId;
  readonly fd: FileDescriptor;
  private readonly volume: Volume;

  constructor(volume: Volume, fd: FileDescriptor) {
    this.volume = volume;
    this.fd = fd;
  }

  get stat(): Effect.Effect<FileSystem.File.Info, PlatformError> {
    return this.volume.withState((state) =>
      Effect.map(getOpenFile(state, this.fd, "stat"), ([, entry]) => fileInfo(entry))
    );
  }

  get sync(): Effect.Effect<void, PlatformError> {
    return this.volume.withState((state) => Effect.asVoid(getOpenFile(state, this.fd, "sync")));
  }

  seek(offset: bigint, from: FileSystem.SeekMode): Effect.Effect<bigint, PlatformError> {
    return this.volume.mutate((state) =>
      Effect.suspend(() => {
        const descriptor = O.getOrUndefined(HashMap.get(state.descriptors, this.fd));
        if (descriptor === undefined) return Effect.succeed(transitionResult(state, BigInt(0)));
        const position = from === "start" ? offset : descriptor.position + offset;
        if (position < BigInt(0)) {
          return Effect.fail(argumentError("seek", "Cannot seek before the start of the file"));
        }
        return Effect.succeed(
          transitionResult(
            {
              ...state,
              descriptors: HashMap.set(state.descriptors, this.fd, {
                ...descriptor,
                position,
              }),
            },
            position
          )
        );
      })
    );
  }

  read(buffer: Uint8Array): Effect.Effect<number, PlatformError> {
    return readDescriptor(this.volume, this.fd, buffer, "read");
  }

  readAlloc(size: number): Effect.Effect<O.Option<Uint8Array>, PlatformError> {
    if (!Number.isSafeInteger(size) || size < 0) {
      return Effect.fail(argumentError("readAlloc", "size must be a non-negative safe integer"));
    }
    return Effect.flatMap(allocateBytes(size, this.fd, "readAlloc"), (buffer) =>
      Effect.map(readDescriptor(this.volume, this.fd, buffer, "readAlloc"), (bytesRead) =>
        bytesRead === 0 ? O.none() : O.some(bytesRead === size ? buffer : buffer.slice(0, bytesRead))
      )
    );
  }

  truncate(length = 0): Effect.Effect<void, PlatformError> {
    const volume = this.volume;
    const fd = this.fd;
    return Effect.flatMap(validateSize("truncate", length), (size) =>
      volume.mutate(
        Effect.fnUntraced(function* (state) {
          const [descriptor, entry] = yield* getOpenFile(state, fd, "truncate", "writable");
          const now = yield* DateTime.now;
          const data = yield* allocateBytes(size, fd, "truncate");
          data.set(entry.data.subarray(0, size));
          const nextState = {
            ...state,
            descriptors:
              !descriptor.append && descriptor.position > BigInt(size)
                ? HashMap.set(state.descriptors, fd, { ...descriptor, position: BigInt(size) })
                : state.descriptors,
            inodes: HashMap.set(state.inodes, entry.ino, {
              ...entry,
              data,
              mtime: now,
              ctime: now,
            }),
          };
          return transitionResult(nextState, undefined, inodeUpdateEvents(nextState, descriptor.inode));
        })
      )
    );
  }

  write(buffer: Uint8Array): Effect.Effect<number, PlatformError> {
    return writeDescriptor(this.volume, this.fd, buffer, "write");
  }

  writeAll(buffer: Uint8Array): Effect.Effect<void, PlatformError> {
    return Effect.asVoid(writeDescriptor(this.volume, this.fd, buffer, "writeAll"));
  }
}

const open = (volume: Volume) => (path: string, options?: OpenOptions) =>
  Effect.acquireRelease(openDescriptor(volume, path, options), (fd) => closeDescriptor(volume, fd)).pipe(
    Effect.map((fd) => new MemoryFile(volume, fd))
  );

// =============================================================================
// filesystem operations
// =============================================================================

// NOTE: Permission bits are metadata only until the adapter models a virtual process
// identity, so `access` deliberately checks existence rather than permissions.
const access = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string) {
    yield* volume.withState((state) => Effect.asVoid(resolve(state, path, { method: "access" })));
  });

// PORT NOTE: iterative frame stack where upstream recursed, preserving the
// pre-order, per-directory-sorted output order exactly. Shared by directory
// listing and inspection snapshots: `visit` sees each entry below `directory`
// with its joined path and answers whether a directory entry is descended.
const walkDirectory = (
  state: State,
  directory: DirectoryInode,
  prefix: string,
  join: (prefix: string, name: string) => string,
  visit: (path: string, entry: InodeEntry) => boolean
): void => {
  interface Frame {
    readonly directory: DirectoryInode;
    index: number;
    readonly names: Array<string>;
    readonly prefix: string;
  }
  const frames: Array<Frame> = [
    { names: A.sort(HashMap.keys(directory.entries), Order.String), directory, prefix, index: 0 },
  ];
  while (frames.length > 0) {
    const frame = O.getOrThrow(A.last(frames));
    if (frame.index >= frame.names.length) {
      frames.pop();
      continue;
    }
    const name = O.getOrThrow(A.get(frame.names, frame.index));
    frame.index += 1;
    const path = join(frame.prefix, name);
    // KIT EXTENSION (case folding): `name` is a stored key; exact hit.
    const inode = O.getOrThrow(HashMap.get(frame.directory.entries, name));
    const entry = O.getOrThrow(HashMap.get(state.inodes, inode));
    if (visit(path, entry) && entry._tag === "Directory") {
      frames.push({
        names: A.sort(HashMap.keys(entry.entries), Order.String),
        directory: entry,
        prefix: path,
        index: 0,
      });
    }
  }
};

const relativeJoin = (prefix: string, name: string): string => (prefix.length === 0 ? name : `${prefix}/${name}`);

const collectDirectoryEntries: {
  (state: State, directory: DirectoryInode, recursive: boolean, prefix?: string): Array<string>;
  (directory: DirectoryInode, recursive: boolean, prefix?: string): (state: State) => Array<string>;
} = dual(
  (args) => isState(args[0]),
  (state: State, directory: DirectoryInode, recursive: boolean, prefix = ""): Array<string> => {
    const output: Array<string> = [];
    walkDirectory(state, directory, prefix, relativeJoin, (path) => {
      output.push(path);
      return recursive;
    });
    return output;
  }
);

const readDirectory = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string, options?: { readonly recursive?: boolean | undefined }) {
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { method: "readDirectory" });
        if (resolved.entry._tag !== "Directory") {
          return yield* badResource("readDirectory", path, "ENOTDIR");
        }
        const nextState = setInode(state, { ...resolved.entry, atime: yield* DateTime.now });
        return transitionResult(
          nextState,
          collectDirectoryEntries(nextState, resolved.entry, options?.recursive === true)
        );
      })
    );
  });

const readFile = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string) {
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { method: "readFile" });
        if (resolved.entry._tag !== "File") {
          return yield* badResource("readFile", path, "EISDIR");
        }
        const nextState = setInode(state, { ...resolved.entry, atime: yield* DateTime.now });
        return transitionResult(nextState, resolved.entry.data.slice());
      })
    );
  });

// A new file is a Create; an existing one is an Update only when the write
// changed it (truncated or wrote bytes).
const writeFileEventTag = (existed: boolean, truncate: boolean, written: number): "Create" | "Update" | undefined => {
  if (!existed) return "Create";
  return truncate || written > 0 ? "Update" : undefined;
};

const writeFile =
  (volume: Volume) =>
  (
    path: string,
    data: Uint8Array,
    options?: { readonly flag?: FileSystem.OpenFlag | undefined; readonly mode?: number | undefined }
  ): Effect.Effect<void, PlatformError> =>
    volume
      .mutate(
        Effect.fnUntraced(function* (state) {
          const existing = yield* Effect.result(resolve(state, path, { method: "writeFile" }));
          const flag = options?.flag ?? "w";
          const [openedState, descriptor] = yield* openDescriptorUnlocked(state, path, { flag, mode: options?.mode });
          const [writtenState] = yield* writeDescriptorUnlocked(openedState, descriptor.fd, data, "writeAll");
          const nextState = closeDescriptorUnlocked(writtenState, descriptor.fd);
          const tag = writeFileEventTag(existing._tag === "Success", openMode(flag).truncate, data.length);
          if (tag === undefined) return transitionResult(nextState, undefined);
          const resolved = yield* resolve(nextState, path, { method: "writeFile" });
          return transitionResult(
            nextState,
            undefined,
            tag === "Update" ? inodeUpdateEvents(nextState, resolved.inode) : [{ _tag: "Create", path: resolved.path }]
          );
        })
      )
      .pipe(Effect.mapError(withOperationError("writeFile", path)));

// node validates the length as an integer, then clamps a negative one to 0
// (`truncate(path, -1)` empties the file rather than failing).
const validateSize: {
  (method: string, size: number | undefined): Effect.Effect<number, PlatformError>;
  (size: number | undefined): (method: string) => Effect.Effect<number, PlatformError>;
} = dual(2, (method: string, size: number | undefined): Effect.Effect<number, PlatformError> => {
  const value = size ?? 0;
  return Number.isSafeInteger(value)
    ? Effect.succeed(Math.max(0, value))
    : Effect.fail(argumentError(method, "size must be a safe integer"));
});

const allocatePathBytes: {
  (length: number, method: string, path: string): Effect.Effect<Uint8Array<ArrayBuffer>, PlatformError>;
  (method: string, path: string): (length: number) => Effect.Effect<Uint8Array<ArrayBuffer>, PlatformError>;
} = dual(
  3,
  (length: number, method: string, path: string): Effect.Effect<Uint8Array<ArrayBuffer>, PlatformError> =>
    Effect.try({
      try: () => new Uint8Array(length),
      catch: () => volumeLimit(method, path, "Unable to allocate file bytes"),
    })
);

const truncate = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string, length?: number) {
    const size = yield* validateSize("truncate", length);
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { method: "truncate" });
        if (resolved.entry._tag !== "File") {
          return yield* badResource("truncate", path, "EISDIR");
        }
        const data = yield* allocatePathBytes(size, "truncate", path);
        const now = yield* DateTime.now;
        data.set(resolved.entry.data.subarray(0, size));
        const nextState = setInode(state, {
          ...resolved.entry,
          data,
          mtime: now,
          ctime: now,
        });
        return transitionResult(nextState, undefined, inodeUpdateEvents(nextState, resolved.inode));
      })
    );
  });

const stat = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string) {
    return yield* volume.withState((state) =>
      Effect.map(resolve(state, path, { method: "stat" }), ({ entry }) => fileInfo(entry))
    );
  });

// `lstat` resolves every intermediate link but reports a final symbolic link
// as itself (type `SymbolicLink`, the link's own size and times).
const lstat = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string) {
    return yield* volume.withState((state) =>
      Effect.map(resolve(state, path, { followFinalSymbolicLink: false, method: "lstat" }), ({ entry }) =>
        fileInfo(entry)
      )
    );
  });

const chmod = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string, mode: number) {
    yield* validateMode("chmod", mode);
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { method: "chmod" });
        const now = yield* DateTime.now;
        const nextState = setInode(state, {
          ...resolved.entry,
          mode: (resolved.entry.mode & ~PERMISSION_MODE) | (mode & PERMISSION_MODE),
          ctime: now,
        });
        return transitionResult(nextState, undefined, inodeUpdateEvents(nextState, resolved.inode));
      })
    );
  });

const validateOwner: {
  (method: string, name: string, value: number): Effect.Effect<void, PlatformError>;
  (name: string, value: number): (method: string) => Effect.Effect<void, PlatformError>;
} = dual(
  3,
  (method: string, name: string, value: number): Effect.Effect<void, PlatformError> =>
    isUnsigned32BitInteger(value)
      ? Effect.void
      : Effect.fail(argumentError(method, `${name} must be an unsigned 32-bit integer`))
);

const chown = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string, uid: number, gid: number) {
    yield* validateOwner("chown", "uid", uid);
    yield* validateOwner("chown", "gid", gid);
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { method: "chown" });
        const now = yield* DateTime.now;
        const nextState = setInode(state, {
          ...resolved.entry,
          uid,
          gid,
          ctime: now,
        });
        return transitionResult(nextState, undefined, inodeUpdateEvents(nextState, resolved.inode));
      })
    );
  });

const dateTimeInput: {
  (method: string, name: string, value: Date | number): Effect.Effect<DateTime.Utc, PlatformError>;
  (name: string, value: Date | number): (method: string) => Effect.Effect<DateTime.Utc, PlatformError>;
} = dual(3, (method: string, name: string, value: Date | number): Effect.Effect<DateTime.Utc, PlatformError> => {
  const milliseconds = P.isNumber(value) ? value * 1000 : value.getTime();
  if (!Number.isFinite(milliseconds)) {
    return Effect.fail(argumentError(method, `${name} must be a valid Date or epoch-seconds number`));
  }
  const parsed = DateTime.make(milliseconds);
  return Effect.fromOption(parsed, () => argumentError(method, `${name} is outside the supported date range`));
});

const utimes = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string, atime: Date | number, mtime: Date | number) {
    const accessTime = yield* dateTimeInput("utime", "atime", atime);
    const modificationTime = yield* dateTimeInput("utime", "mtime", mtime);
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { method: "utime" });
        const now = yield* DateTime.now;
        const nextState = setInode(state, {
          ...resolved.entry,
          atime: accessTime,
          mtime: modificationTime,
          ctime: now,
        });
        return transitionResult(nextState, undefined, inodeUpdateEvents(nextState, resolved.inode));
      })
    );
  });

// =============================================================================
// temporary resources
// =============================================================================

const validateTemporaryFragment: {
  (method: string, name: string, value: string): Effect.Effect<void, PlatformError>;
  (name: string, value: string): (method: string) => Effect.Effect<void, PlatformError>;
} = dual(
  3,
  (method: string, name: string, value: string): Effect.Effect<void, PlatformError> =>
    Str.includes("/")(value) || Str.includes("\0")(value)
      ? Effect.fail(argumentError(method, `${name} must be a file-name fragment`))
      : Effect.void
);

const allocateTemporaryToken = (state: State): readonly [State, string] => [
  { ...state, nextTemporary: state.nextTemporary + 1 },
  Str.padStart(8, "0")(state.nextTemporary.toString(36)),
];

const allocateTempDirectory: {
  (
    state: State,
    method: string,
    parentPath: string,
    prefix: string
  ): Effect.Effect<readonly [State, { readonly inode: Inode; readonly path: string }], PlatformError>;
  (
    method: string,
    parentPath: string,
    prefix: string
  ): (state: State) => Effect.Effect<readonly [State, { readonly inode: Inode; readonly path: string }], PlatformError>;
} = dual(
  4,
  Effect.fnUntraced(function* (state: State, method: string, parentPath: string, prefix: string) {
    const parent = yield* resolve(state, parentPath, { method });
    if (parent.entry._tag !== "Directory") {
      return yield* badResource(method, parentPath, "ENOTDIR");
    }
    let nextState = state;
    while (true) {
      const [allocatedState, token] = allocateTemporaryToken(nextState);
      nextState = allocatedState;
      const name = `${prefix}${token}`;
      const currentParent = yield* getDirectory(nextState, parent.inode, method, parentPath);
      // KIT EXTENSION (case folding)
      if (findEntry(nextState, currentParent, name) !== undefined) continue;
      const [createdState, inode] = yield* createDirectory(nextState);
      nextState = createdState;
      nextState = yield* attachDirectory(nextState, parent.inode, name, inode, method);
      return [
        nextState,
        {
          inode,
          path: childPath(parent.path, name),
        },
      ] as const;
    }
  })
);

// The upstream option bags, named once for every temporary-resource signature.
type TempDirectoryOptions = NonNullable<Parameters<FileSystem.FileSystem["makeTempDirectory"]>[0]>;
type TempFileOptions = NonNullable<Parameters<FileSystem.FileSystem["makeTempFile"]>[0]>;

const makeTempDirectoryWithMethod: {
  (volume: Volume, method: string, options?: TempDirectoryOptions): Effect.Effect<string, PlatformError>;
  (method: string, options?: TempDirectoryOptions): (volume: Volume) => Effect.Effect<string, PlatformError>;
} = dual(
  (args) => isVolume(args[0]),
  Effect.fnUntraced(function* (volume: Volume, method: string, options?: TempDirectoryOptions) {
    const prefix = options?.prefix ?? "";
    yield* validateTemporaryFragment(method, "prefix", prefix);
    return yield* volume.mutate((state) =>
      Effect.map(
        allocateTempDirectory(state, method, options?.directory ?? TEMP_DIR, prefix),
        ([nextState, directory]) =>
          transitionResult(nextState, directory.path, [{ _tag: "Create", path: directory.path }])
      )
    );
  })
);

const makeTempDirectory = (volume: Volume) => (options?: TempDirectoryOptions) =>
  makeTempDirectoryWithMethod(volume, "makeTempDirectory", options);

const makeTempDirectoryScoped = (volume: Volume) => (options?: TempDirectoryOptions) =>
  Effect.acquireRelease(makeTempDirectoryWithMethod(volume, "makeTempDirectoryScoped", options), (path) =>
    Effect.orDie(remove(volume)(path, { recursive: true, force: true }))
  );

const makeTempFileWithMethod: {
  (volume: Volume, method: string, options?: TempFileOptions): Effect.Effect<string, PlatformError>;
  (method: string, options?: TempFileOptions): (volume: Volume) => Effect.Effect<string, PlatformError>;
} = dual(
  (args) => isVolume(args[0]),
  Effect.fnUntraced(function* (volume: Volume, method: string, options?: TempFileOptions) {
    const prefix = options?.prefix ?? "";
    const suffix = options?.suffix ?? "";
    yield* validateTemporaryFragment(method, "prefix", prefix);
    yield* validateTemporaryFragment(method, "suffix", suffix);
    return yield* volume.mutateInterruptibly((state) =>
      Effect.gen(function* () {
        let [nextState, directory] = yield* allocateTempDirectory(
          state,
          method,
          options?.directory ?? TEMP_DIR,
          prefix
        );
        const [allocatedState, token] = allocateTemporaryToken(nextState);
        nextState = allocatedState;
        const name = `${token}${suffix}`;
        const [createdState, inode] = yield* createFile(nextState);
        nextState = createdState;
        nextState = yield* linkInode(nextState, directory.inode, name, inode, method);
        const path = childPath(directory.path, name);
        return transitionResult(nextState, path, [{ _tag: "Create", path }]);
      }).pipe(Effect.mapError(withOperationError(method, options?.directory ?? TEMP_DIR)))
    );
  })
);

const makeTempFile = (volume: Volume) => (options?: TempFileOptions) =>
  makeTempFileWithMethod(volume, "makeTempFile", options);

const makeTempFileScoped = (volume: Volume) => (options?: TempFileOptions) =>
  Effect.acquireRelease(makeTempFileWithMethod(volume, "makeTempFileScoped", options), (path) => {
    const separator = pipe(path, Str.lastIndexOf("/"), O.getOrElse(constant(-1)));
    const directory = Str.slice(0, separator)(path);
    return Effect.orDie(remove(volume)(directory, { recursive: true, force: true }));
  });

// =============================================================================
// globbing
// =============================================================================

const MAX_BRACE_EXPANSIONS = 256;

const GlobLiteral = S.TaggedStruct("Literal", {
  value: S.String.pipe($I.annoteKey("GlobLiteral.value", { description: "The literal character." })),
}).pipe($I.annoteSchema("GlobLiteral", { description: "The engine GlobLiteral data." }));
type GlobLiteral = typeof GlobLiteral.Type;
const GlobStar = S.TaggedStruct("Star", {}).pipe(
  $I.annoteSchema("GlobStar", { description: "The engine GlobStar data." })
);
type GlobStar = typeof GlobStar.Type;
const GlobOne = S.TaggedStruct("One", {}).pipe($I.annoteSchema("GlobOne", { description: "The engine GlobOne data." }));
type GlobOne = typeof GlobOne.Type;
const GlobCharacterClass = S.TaggedStruct("CharacterClass", {
  negated: S.Boolean.pipe($I.annoteKey("GlobCharacterClass.negated", { description: "Whether the class is negated." })),
  ranges: S.Array(S.Tuple([S.String, S.String])).pipe(
    $I.annoteKey("GlobCharacterClass.ranges", { description: "The inclusive character ranges." })
  ),
  literals: S.Array(S.String).pipe(
    $I.annoteKey("GlobCharacterClass.literals", { description: "The class literal characters." })
  ),
}).pipe($I.annoteSchema("GlobCharacterClass", { description: "The engine GlobCharacterClass data." }));
type GlobCharacterClass = typeof GlobCharacterClass.Type;
const GlobToken = S.Union([GlobLiteral, GlobStar, GlobOne, GlobCharacterClass]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("GlobToken", { description: "A compiled glob token." })
);
type GlobToken = typeof GlobToken.Type;
const GlobSegment = S.TaggedStruct("Segment", {
  tokens: S.Array(GlobToken).pipe($I.annoteKey("GlobSegment.tokens", { description: "The compiled tokens." })),
  startsWithDot: S.Boolean.pipe(
    $I.annoteKey("GlobSegment.startsWithDot", { description: "Whether the segment explicitly starts with a dot." })
  ),
}).pipe($I.annoteSchema("GlobSegment", { description: "The engine GlobSegment data." }));
type GlobSegment = typeof GlobSegment.Type;
const GlobGlobstar = S.TaggedStruct("Globstar", {}).pipe(
  $I.annoteSchema("GlobGlobstar", { description: "The engine GlobGlobstar data." })
);
type GlobGlobstar = typeof GlobGlobstar.Type;
const CompiledGlobSegment = S.Union([GlobSegment, GlobGlobstar]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CompiledGlobSegment", { description: "A normal or recursive glob segment." })
);
type CompiledGlobSegment = typeof CompiledGlobSegment.Type;
const CompiledGlobPattern = S.Struct({
  segments: S.Array(CompiledGlobSegment).pipe(
    $I.annoteKey("CompiledGlobPattern.segments", { description: "The compiled path segments." })
  ),
  directoryOnly: S.Boolean.pipe(
    $I.annoteKey("CompiledGlobPattern.directoryOnly", { description: "Whether a trailing slash requires a directory." })
  ),
}).pipe($I.annoteSchema("CompiledGlobPattern", { description: "The engine CompiledGlobPattern data." }));
type CompiledGlobPattern = typeof CompiledGlobPattern.Type;
const BraceExpansion = S.Struct({
  start: S.Finite.pipe($I.annoteKey("BraceExpansion.start", { description: "The opening brace offset." })),
  end: S.Finite.pipe($I.annoteKey("BraceExpansion.end", { description: "The closing brace offset." })),
  alternatives: S.Array(S.String).pipe(
    $I.annoteKey("BraceExpansion.alternatives", { description: "The expansion alternatives." })
  ),
}).pipe($I.annoteSchema("BraceExpansion", { description: "The engine BraceExpansion data." }));
type BraceExpansion = typeof BraceExpansion.Type;
const GlobCharacterClassAtom = S.Struct({
  value: S.String.pipe($I.annoteKey("GlobCharacterClassAtom.value", { description: "The class character." })),
  escaped: S.Boolean.pipe(
    $I.annoteKey("GlobCharacterClassAtom.escaped", { description: "Whether the character was escaped." })
  ),
}).pipe($I.annoteSchema("GlobCharacterClassAtom", { description: "The engine GlobCharacterClassAtom data." }));
type GlobCharacterClassAtom = typeof GlobCharacterClassAtom.Type;

const globSyntaxCharacters: HashSet.HashSet<string> = HashSet.make("*", "?", "[", "]", "{", "}", ",", "\\");

// The mutable state of one brace-group scan.
interface BraceGroupScan {
  characterClass: boolean;
  readonly commas: Array<number>;
  depth: number;
}

// Applies one structural character outside a character class; answers `true`
// when it closes the group.
const scanBraceStructure = (scan: BraceGroupScan, character: string, offset: number): boolean => {
  if (character === "{") {
    scan.depth += 1;
    return false;
  }
  if (character === "}") {
    scan.depth -= 1;
    return scan.depth === 0;
  }
  if (character === "," && scan.depth === 1) scan.commas.push(offset);
  return false;
};

// Applies one unescaped character; answers `true` when it closes the group.
const scanBraceCharacter = (scan: BraceGroupScan, character: string, offset: number): boolean => {
  if (character === "[") {
    scan.characterClass = true;
    return false;
  }
  if (character === "]") {
    scan.characterClass = false;
    return false;
  }
  return !scan.characterClass && scanBraceStructure(scan, character, offset);
};

// Scans the group opened at `start`: its closing offset and top-level comma
// offsets, or `undefined` when the group never closes.
const scanBraceGroup = (pattern: string, start: number): readonly [number, ReadonlyArray<number>] | undefined => {
  const scan: BraceGroupScan = { depth: 1, characterClass: false, commas: [] };
  for (let end = start + 1; end < pattern.length; end++) {
    const character = Str.slice(end, end + 1)(pattern);
    if (character === "\\") {
      end += 1;
    } else if (scanBraceCharacter(scan, character, end)) {
      return [end, scan.commas] as const;
    }
  }
  return undefined;
};

// The offset of the next unescaped "{" at or after `from`, or -1.
const nextBraceOpen = (pattern: string, from: number): number => {
  for (let index = from; index < pattern.length; index++) {
    const character = Str.slice(index, index + 1)(pattern);
    if (character === "\\") {
      index += 1;
    } else if (character === "{") {
      return index;
    }
  }
  return -1;
};

const braceAlternatives = (
  pattern: string,
  start: number,
  end: number,
  commas: ReadonlyArray<number>
): BraceExpansion => {
  const alternatives: Array<string> = [];
  let alternativeStart = start + 1;
  for (const comma of [...commas, end]) {
    alternatives.push(Str.slice(alternativeStart, comma)(pattern));
    alternativeStart = comma + 1;
  }
  return { start, end, alternatives };
};

// A closed group with commas expands; a comma-free group expands the first
// expandable group nested inside it, if any.
const expansionOfBraceGroup = (
  pattern: string,
  start: number,
  end: number,
  commas: ReadonlyArray<number>
): BraceExpansion | undefined => {
  if (commas.length > 0) return braceAlternatives(pattern, start, end, commas);
  const nested = findBraceExpansion(Str.slice(start + 1, end)(pattern));
  return nested === undefined
    ? undefined
    : { start: start + nested.start + 1, end: start + nested.end + 1, alternatives: nested.alternatives };
};

const findBraceExpansion = (pattern: string): BraceExpansion | undefined => {
  let start = nextBraceOpen(pattern, 0);
  while (start !== -1) {
    const group = scanBraceGroup(pattern, start);
    if (group === undefined) return undefined;
    const expansion = expansionOfBraceGroup(pattern, start, group[0], group[1]);
    if (expansion !== undefined) return expansion;
    start = nextBraceOpen(pattern, group[0] + 1);
  }
  return undefined;
};

// The mutable state of the brace-nesting pre-scan.
interface BraceNestingScan {
  characterClass: boolean;
  depth: number;
  maximum: number;
}

const trackBraceDepth = (scan: BraceNestingScan, character: string): void => {
  if (character === "{") {
    scan.depth += 1;
    scan.maximum = Math.max(scan.maximum, scan.depth);
  } else if (character === "}") {
    scan.depth = Math.max(0, scan.depth - 1);
  }
};

const trackBraceNesting = (scan: BraceNestingScan, character: string): void => {
  if (character === "[") {
    scan.characterClass = true;
  } else if (character === "]") {
    scan.characterClass = false;
  } else if (!scan.characterClass) {
    trackBraceDepth(scan, character);
  }
};

// PORT NOTE: a linear pre-scan bounds brace nesting at MAX_NESTING_DEPTH,
// failing typed — upstream let `findBraceExpansion` recurse unbounded into
// nested comma-free groups, so a deeply nested pattern was a stack-overflow
// defect. Alternatives substitute substrings, so expansion never deepens
// nesting and the one up-front scan bounds every later recursion.
const braceNestingDepth = (pattern: string): number => {
  const scan: BraceNestingScan = { depth: 0, maximum: 0, characterClass: false };
  for (let index = 0; index < pattern.length; index++) {
    const character = Str.slice(index, index + 1)(pattern);
    if (character === "\\") {
      index += 1;
    } else {
      trackBraceNesting(scan, character);
    }
  }
  return scan.maximum;
};

const expandBraces: {
  (method: string, pattern: string): Effect.Effect<Array<string>, PlatformError>;
  (pattern: string): (method: string) => Effect.Effect<Array<string>, PlatformError>;
} = dual(2, (method: string, pattern: string): Effect.Effect<Array<string>, PlatformError> => {
  if (braceNestingDepth(pattern) > MAX_NESTING_DEPTH) {
    return Effect.fail(argumentError(method, `brace nesting exceeds ${MAX_NESTING_DEPTH} levels`));
  }
  let patterns = [pattern];
  while (true) {
    const found = A.findFirstIndex(patterns, (pattern) => findBraceExpansion(pattern) !== undefined);
    if (O.isNone(found)) return Effect.succeed(patterns);
    const index = found.value;
    const current = O.getOrThrow(A.get(patterns, index));
    const expansion = O.getOrThrow(O.fromUndefinedOr(findBraceExpansion(current)));
    if (patterns.length - 1 + expansion.alternatives.length > MAX_BRACE_EXPANSIONS) {
      return Effect.fail(argumentError(method, `brace expansion exceeds ${MAX_BRACE_EXPANSIONS} alternatives`));
    }
    patterns = [
      ...patterns.slice(0, index),
      ...A.map(
        expansion.alternatives,
        (alternative) =>
          `${Str.slice(0, expansion.start)(current)}${alternative}${Str.slice(expansion.end + 1)(current)}`
      ),
      ...patterns.slice(index + 1),
    ];
  }
});

// The mutable state of one character-class scan.
interface CharacterClassScan {
  readonly characters: Array<GlobCharacterClassAtom>;
  index: number;
}

// Reads one class atom at `scan.index`; an escape at the very end is an error.
const readCharacterClassAtom = (
  method: string,
  segment: string,
  scan: CharacterClassScan
): PlatformError | undefined => {
  const escaped = segment[scan.index] === "\\";
  if (escaped) {
    scan.index += 1;
    if (scan.index === segment.length) {
      return argumentError(method, "character classes must not end with an escape");
    }
  }
  scan.characters.push({ value: Str.slice(scan.index, scan.index + 1)(segment), escaped });
  scan.index += 1;
  return undefined;
};

// A "]" closes the class only after at least one atom ("[]a]" holds "]").
const closesCharacterClass = (segment: string, scan: CharacterClassScan): boolean =>
  segment[scan.index] === "]" && scan.characters.length > 0;

// Reads the class atoms up to the closing "]", leaving `scan.index` on it.
const scanCharacterClassAtoms = (
  method: string,
  segment: string,
  scan: CharacterClassScan
): PlatformError | undefined => {
  while (scan.index < segment.length && !closesCharacterClass(segment, scan)) {
    const failure = readCharacterClassAtom(method, segment, scan);
    if (failure !== undefined) return failure;
  }
  return scan.index === segment.length || scan.characters.length === 0
    ? argumentError(method, "character classes must be closed and non-empty")
    : undefined;
};

// The end of a range starting at `characterIndex` ("a-z"), if it starts one:
// an unescaped "-" followed by anything but another "-".
const characterClassRangeEnd = (
  characters: ReadonlyArray<GlobCharacterClassAtom>,
  characterIndex: number
): string | undefined => {
  const separator = characters[characterIndex + 1];
  const rangeEnd = characters[characterIndex + 2];
  return separator !== undefined &&
    rangeEnd !== undefined &&
    separator.value === "-" &&
    !separator.escaped &&
    rangeEnd.value !== "-"
    ? rangeEnd.value
    : undefined;
};

// Splits the atoms into literals and ascending ranges.
const classifyCharacterClassAtoms = (
  method: string,
  characters: ReadonlyArray<GlobCharacterClassAtom>,
  literals: Array<string>,
  ranges: Array<readonly [string, string]>
): PlatformError | undefined => {
  for (let characterIndex = 0; characterIndex < characters.length; characterIndex++) {
    const character = O.getOrThrow(A.get(characters, characterIndex));
    const end = characterClassRangeEnd(characters, characterIndex);
    if (end === undefined) {
      literals.push(character.value);
      continue;
    }
    if (character.value > end) {
      return argumentError(method, "character class ranges must be ascending");
    }
    ranges.push([character.value, end]);
    characterIndex += 2;
  }
  return undefined;
};

const parseCharacterClass: {
  (
    method: string,
    segment: string,
    start: number
  ): PlatformError | Effect.Effect<readonly [GlobCharacterClass, number]>;
  (
    segment: string,
    start: number
  ): (method: string) => PlatformError | Effect.Effect<readonly [GlobCharacterClass, number]>;
} = dual(
  3,
  (
    method: string,
    segment: string,
    start: number
  ): PlatformError | Effect.Effect<readonly [GlobCharacterClass, number]> => {
    const negated = segment[start + 1] === "!";
    const scan: CharacterClassScan = { index: negated ? start + 2 : start + 1, characters: [] };
    const scanFailure = scanCharacterClassAtoms(method, segment, scan);
    if (scanFailure !== undefined) return scanFailure;
    const literals: Array<string> = [];
    const ranges: Array<readonly [string, string]> = [];
    const rangeFailure = classifyCharacterClassAtoms(method, scan.characters, literals, ranges);
    if (rangeFailure !== undefined) return rangeFailure;
    return Effect.succeed([
      GlobToken.cases.CharacterClass.make({ negated, ranges, literals }),
      scan.index + 1,
    ] as const);
  }
);

// An escaped syntax character is a literal; any other escaped character keeps
// its backslash literally and is then read again on its own.
const readGlobEscape = (
  method: string,
  segment: string,
  index: number
): PlatformError | Effect.Effect<readonly [GlobToken, number]> => {
  if (index + 1 === segment.length) {
    return argumentError(method, "patterns must not end with an escape");
  }
  const value = Str.slice(index + 1, index + 2)(segment);
  return HashSet.has(globSyntaxCharacters, value)
    ? Effect.succeed([GlobToken.cases.Literal.make({ value }), index + 2] as const)
    : Effect.succeed([GlobToken.cases.Literal.make({ value: "\\" }), index + 1] as const);
};

// "*" and "?" are wildcards; any other unescaped character is itself.
const singleCharacterGlobToken = (character: string): GlobToken => {
  if (character === "*") return GlobToken.cases.Star.make({});
  if (character === "?") return GlobToken.cases.One.make({});
  return GlobToken.cases.Literal.make({ value: character });
};

// Reads the token at `index` and the offset after it.
const readGlobToken = (
  method: string,
  segment: string,
  index: number
): PlatformError | Effect.Effect<readonly [GlobToken, number]> => {
  const character = Str.slice(index, index + 1)(segment);
  if (character === "\\") return readGlobEscape(method, segment, index);
  if (character === "[") return parseCharacterClass(method, segment, index);
  return Effect.succeed([singleCharacterGlobToken(character), index + 1] as const);
};

const characterClassIncludes = (token: GlobCharacterClass, candidate: string): boolean =>
  token.literals.includes(candidate) || A.some(token.ranges, ([start, end]) => start <= candidate && candidate <= end);

// Whether a segment's first token can match a leading ".": a literal dot, or a
// non-negated class that holds one.
const tokenAdmitsLeadingDot = (token: GlobToken | undefined): boolean => {
  if (token?._tag === "Literal") return token.value === ".";
  if (token?._tag === "CharacterClass") return !token.negated && characterClassIncludes(token, ".");
  return false;
};

const parseGlobSegment: {
  (method: string, segment: string): Effect.Effect<CompiledGlobSegment, PlatformError>;
  (segment: string): (method: string) => Effect.Effect<CompiledGlobSegment, PlatformError>;
} = dual(
  2,
  Effect.fnUntraced(function* (method: string, segment: string) {
    if (segment === "**") return { _tag: "Globstar" } satisfies GlobGlobstar;
    const tokens: Array<GlobToken> = [];
    let index = 0;
    while (index < segment.length) {
      const [token, next] = yield* readGlobToken(method, segment, index);
      tokens.push(token);
      index = next;
    }
    return {
      _tag: "Segment",
      tokens,
      startsWithDot: tokenAdmitsLeadingDot(tokens[0]),
    } satisfies GlobSegment;
  })
);

const compileGlobPattern: {
  (method: string, pattern: string): Effect.Effect<CompiledGlobPattern, PlatformError>;
  (pattern: string): (method: string) => Effect.Effect<CompiledGlobPattern, PlatformError>;
} = dual(
  2,
  Effect.fnUntraced(function* (method: string, pattern: string) {
    if (pattern.length === 0 || Str.includes("\0")(pattern) || Str.startsWith("/")(pattern)) {
      return yield* argumentError(method, "pattern must be a root-relative POSIX glob");
    }
    const directoryOnly = Str.endsWith("/")(pattern);
    const path = directoryOnly ? Str.slice(0, -1)(pattern) : pattern;
    const segments = Str.split("/")(path);
    if (segments.includes("") || segments.includes(".") || segments.includes("..")) {
      return yield* argumentError(method, "pattern must not contain empty or dot path segments");
    }
    const compiled = yield* Effect.forEach(segments, (segment) => parseGlobSegment(method, segment));
    return { segments: compiled, directoryOnly } satisfies CompiledGlobPattern;
  })
);

const compileGlobPatterns: {
  (method: string, pattern: string): Effect.Effect<Array<CompiledGlobPattern>, PlatformError>;
  (pattern: string): (method: string) => Effect.Effect<Array<CompiledGlobPattern>, PlatformError>;
} = dual(
  2,
  Effect.fnUntraced(function* (method: string, pattern: string) {
    const expanded = yield* expandBraces(method, pattern);
    return yield* Effect.forEach(expanded, (alternative) => compileGlobPattern(method, alternative));
  })
);

const matchesLiteral = (literal: string, value: string, fold: boolean): boolean =>
  literal === value || (fold && Str.toLowerCase(literal) === Str.toLowerCase(value));

const matchesCharacterClass = (token: GlobCharacterClass, value: string, fold: boolean): boolean => {
  const matches =
    characterClassIncludes(token, value) ||
    (fold &&
      (characterClassIncludes(token, Str.toLowerCase(value)) || characterClassIncludes(token, Str.toUpperCase(value))));
  return token.negated ? !matches : matches;
};

// KIT EXTENSION (case folding): `fold` matches
// the way a case-insensitive regex does — a literal compares folded, and a
// character class accepts the value in either case. Host-proven: node's
// `fs.glob` on a folding volume matches `*.JSON` against a stored `docs.json`.
const matchesGlobToken: {
  (token: Exclude<GlobToken, GlobStar>, value: string, fold?: boolean): boolean;
  (value: string, fold?: boolean): (token: Exclude<GlobToken, GlobStar>) => boolean;
} = dual(
  (args) => P.hasProperty(args[0], "_tag"),
  (token: Exclude<GlobToken, GlobStar>, value: string, fold: boolean | undefined = false): boolean =>
    Match.value(token).pipe(
      Match.tagsExhaustive({
        Literal: (token) => matchesLiteral(token.value, value, fold),
        One: () => true,
        CharacterClass: (token) => matchesCharacterClass(token, value, fold),
      })
    )
);

// The backtracking state of one wildcard segment match.
interface SegmentMatchCursor {
  patternIndex: number;
  starIndex: number;
  starValueIndex: number;
  valueIndex: number;
}

// One step of the wildcard match: a star records a backtrack point, a matching
// token advances both sides, and a mismatch retries from the last star with
// one more character swallowed. Answers `false` when no backtrack point is left.
const stepSegmentMatch = (pattern: GlobSegment, value: string, fold: boolean, cursor: SegmentMatchCursor): boolean => {
  const token = pattern.tokens[cursor.patternIndex];
  if (token?._tag === "Star") {
    cursor.starIndex = cursor.patternIndex;
    cursor.starValueIndex = cursor.valueIndex;
    cursor.patternIndex += 1;
    return true;
  }
  if (
    token !== undefined &&
    matchesGlobToken(token, Str.slice(cursor.valueIndex, cursor.valueIndex + 1)(value), fold)
  ) {
    cursor.patternIndex += 1;
    cursor.valueIndex += 1;
    return true;
  }
  if (cursor.starIndex === -1) return false;
  cursor.patternIndex = cursor.starIndex + 1;
  cursor.starValueIndex += 1;
  cursor.valueIndex = cursor.starValueIndex;
  return true;
};

// KIT EXTENSION (case folding): `fold`, see matchesGlobToken.
const matchesGlobSegment: {
  (pattern: GlobSegment, value: string, fold?: boolean): boolean;
  (value: string, fold?: boolean): (pattern: GlobSegment) => boolean;
} = dual(
  (args) => P.isTagged(args[0], "Segment"),
  (pattern: GlobSegment, value: string, fold = false): boolean => {
    if (Str.startsWith(".")(value) && !pattern.startsWithDot) return false;
    const cursor: SegmentMatchCursor = { patternIndex: 0, valueIndex: 0, starIndex: -1, starValueIndex: -1 };
    while (cursor.valueIndex < value.length) {
      if (!stepSegmentMatch(pattern, value, fold, cursor)) return false;
    }
    let patternIndex = cursor.patternIndex;
    while (pattern.tokens[patternIndex]?._tag === "Star") {
      patternIndex += 1;
    }
    return patternIndex === pattern.tokens.length;
  }
);

// A globstar row: suffix `pathIndex` matches when the rest of the pattern
// matches it, or when a non-dot component can be swallowed first.
const globstarMatchRow = (path: ReadonlyArray<string>, next: ReadonlyArray<boolean>): Array<boolean> => {
  const current = A.makeBy(path.length + 1, () => false);
  for (let pathIndex = path.length; pathIndex >= 0; pathIndex--) {
    const component = path[pathIndex];
    current[pathIndex] =
      next[pathIndex] === true ||
      (pathIndex < path.length && component !== undefined && component[0] !== "." && current[pathIndex + 1] === true);
  }
  return current;
};

// A segment row: suffix `pathIndex` matches when its first component matches
// the segment and the rest of the pattern matches the remainder.
const segmentMatchRow = (
  segment: GlobSegment,
  path: ReadonlyArray<string>,
  next: ReadonlyArray<boolean>,
  fold: boolean
): Array<boolean> => {
  const current = A.makeBy(path.length + 1, () => false);
  for (let pathIndex = path.length - 1; pathIndex >= 0; pathIndex--) {
    const part = path[pathIndex];
    current[pathIndex] = part !== undefined && matchesGlobSegment(segment, part, fold) && next[pathIndex + 1] === true;
  }
  return current;
};

// KIT EXTENSION (case folding): `fold`, see matchesGlobToken.
const matchesGlob: {
  (pattern: CompiledGlobPattern, path: ReadonlyArray<string>, directory: boolean, fold?: boolean): boolean;
  (path: ReadonlyArray<string>, directory: boolean, fold?: boolean): (pattern: CompiledGlobPattern) => boolean;
} = dual(
  (args) => P.hasProperty(args[0], "segments"),
  (pattern: CompiledGlobPattern, path: ReadonlyArray<string>, directory: boolean, fold = false): boolean => {
    if (pattern.directoryOnly && !directory) return false;
    let next: ReadonlyArray<boolean> = A.makeBy(path.length + 1, (index) => index === path.length);
    for (let patternIndex = pattern.segments.length - 1; patternIndex >= 0; patternIndex--) {
      const segment = O.getOrThrow(A.get(pattern.segments, patternIndex));
      next = segment._tag === "Globstar" ? globstarMatchRow(path, next) : segmentMatchRow(segment, path, next, fold);
    }
    return next[0] === true;
  }
);

// The shared state of one glob walk.
interface GlobWalk {
  readonly excludes: ReadonlyArray<CompiledGlobPattern>;
  readonly fold: boolean;
  readonly includes: ReadonlyArray<CompiledGlobPattern>;
  readonly matches: Array<string>;
  readonly pending: Array<readonly [DirectoryInode, ReadonlyArray<string>]>;
  readonly state: State;
}

// An excluded entry is neither reported nor descended into.
const visitGlobEntry = (
  walk: GlobWalk,
  directory: DirectoryInode,
  parent: ReadonlyArray<string>,
  name: string
): void => {
  const path = [...parent, name];
  // KIT EXTENSION (case folding): folded lookup.
  const inode = O.getOrThrow(HashMap.get(directory.entries, name));
  const entry = O.getOrThrow(HashMap.get(walk.state.inodes, inode));
  const isDirectory = entry._tag === "Directory";
  if (A.some(walk.excludes, matchesGlob(path, isDirectory, walk.fold))) return;
  if (A.some(walk.includes, matchesGlob(path, isDirectory, walk.fold))) {
    walk.matches.push(A.join(path, "/"));
  }
  if (entry._tag === "Directory") walk.pending.push([entry, path]);
};

const walkGlob = (
  state: State,
  root: DirectoryInode,
  includes: ReadonlyArray<CompiledGlobPattern>,
  excludes: ReadonlyArray<CompiledGlobPattern>
): Array<string> => {
  // KIT EXTENSION (case folding)
  const fold = !state.caseSensitive;
  if (A.some(excludes, matchesGlob([], true, fold))) return [];
  const matches: Array<string> = A.some(includes, matchesGlob([], true, fold)) ? ["."] : [];
  const walk: GlobWalk = { state, includes, excludes, fold, matches, pending: [[root, []]] };
  while (walk.pending.length > 0) {
    const [directory, parent] = O.getOrThrow(O.fromUndefinedOr(walk.pending.pop()));
    for (const name of A.sort(HashMap.keys(directory.entries), Order.String)) {
      visitGlobEntry(walk, directory, parent, name);
    }
  }
  return A.sort(matches, Order.String);
};

const glob = (volume: Volume) =>
  Effect.fnUntraced(function* (
    pattern: string,
    options?: { readonly root?: string | undefined; readonly exclude?: ReadonlyArray<string> | undefined }
  ) {
    const includes = yield* compileGlobPatterns("glob", pattern);
    const excludes = yield* Effect.forEach(options?.exclude ?? [], (excluded) =>
      compileGlobPatterns("glob", excluded)
    ).pipe(Effect.map((patterns) => patterns.flat()));
    const rootPath = options?.root ?? "/";
    return yield* volume.withState(
      Effect.fnUntraced(function* (state) {
        // KIT EXTENSION (errno fidelity): node's `fs.glob` answers an empty
        // match set for a root that is missing, not a directory, or
        // unresolvable — it never fails on the root. A malformed root (a NUL
        // byte) is still a BadArgument.
        const root = yield* Effect.result(resolve(state, rootPath, { method: "glob" }));
        if (root._tag === "Failure") {
          if (root.failure.reason._tag === "BadArgument") return yield* root.failure;
          return [];
        }
        const resolved = root.success;
        if (resolved.entry._tag !== "Directory") return [];
        return walkGlob(state, resolved.entry, includes, excludes);
      })
    );
  });

// =============================================================================
// volume
// =============================================================================

// KIT EXTENSION (case folding): the engine's build-time options.
/**
 * Fixes the engine's path-matching policy when the volume is built.
 *
 * **Details**
 *
 * `caseSensitive: false` folds path components during lookup while retaining
 * stored entry spellings. The policy remains fixed for the volume's lifetime.
 *
 * **Example** (Decode a case-folding policy)
 *
 * ```ts
 * import { EngineOptions } from "@beep/memfs/internal/volume"
 * import * as S from "effect/Schema"
 *
 * const options = EngineOptions.make({ caseSensitive: false })
 * console.log(S.is(EngineOptions)(options), options.caseSensitive) // true false
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export class EngineOptions extends S.Opaque<EngineOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    caseSensitive: S.Boolean.pipe(
      $I.annoteKey("EngineOptions.caseSensitive", {
        description: "Whether path lookups distinguish letter case.",
      })
    ),
  }).pipe(
    $I.annoteSchema("EngineOptions", {
      description: "The engine's fixed path-matching policy, supplied as a plain object.",
    })
  )
) {}
const defaultEngineOptions = EngineOptions.make({ caseSensitive: true });

const makeVolume = Effect.fn("Volume.make")(function* (options: EngineOptions) {
  const now = yield* DateTime.now;
  // NOTE: One permit covers a transition, its state assignment, and event publication;
  // acquiring that permit remains interruptible.
  const lock = yield* Semaphore.make(1);
  const watchers = MutableHashMap.empty<number, WatchSubscription>();
  let nextSubscriptionId = 0;

  let state: State = {
    inodes: HashMap.make([
      RootInode,
      {
        _tag: "Directory",
        ino: RootInode,
        mode: DIR_MODE,
        uid: DEFAULT_UID,
        gid: DEFAULT_GID,
        nlink: DIR_LINK_COUNT,
        openCount: 0,
        atime: now,
        mtime: now,
        ctime: now,
        birthtime: now,
        entries: HashMap.empty(),
      } satisfies DirectoryInode,
    ]),
    nextInode: FIRST_INODE,
    descriptors: HashMap.empty(),
    nextDescriptor: FIRST_DESCRIPTOR,
    nextTemporary: FIRST_TEMP,
    caseSensitive: options.caseSensitive,
  };

  const commitResult = <A>(result: TransitionResult<A>): Effect.Effect<A> =>
    Effect.sync(() => {
      state = result.state;
    }).pipe(
      Effect.andThen(publishWatchEvents(watchers, result.events, options.caseSensitive)),
      Effect.as(result.value)
    );

  const commit = <A, E, R>(use: (state: State) => Effect.Effect<TransitionResult<A>, E, R>): Effect.Effect<A, E, R> =>
    Effect.flatMap(
      Effect.suspend(() => use(state)),
      commitResult
    );

  const withState: Volume["withState"] = (use) => lock.withPermit(Effect.suspend(() => use(state)));
  const mutate: Volume["mutate"] = (use) => lock.withPermit(Effect.uninterruptible(commit(use)));
  const mutateInterruptibly: Volume["mutateInterruptibly"] = (use) =>
    lock.withPermit(
      Effect.uninterruptibleMask((restore) => Effect.flatMap(restore(Effect.suspend(() => use(state))), commitResult))
    );

  return {
    currentState: () => state,
    mutate,
    mutateInterruptibly,
    watchers,
    withState,
    allocateSubscriptionId: () => nextSubscriptionId++,
  } satisfies Volume;
});

// =============================================================================
// watching
// =============================================================================

const watch = (volume: Volume) => (path: string, options?: FileSystem.WatchOptions) =>
  Stream.unwrap(
    Effect.map(
      Effect.acquireRelease(
        volume.withState(
          Effect.fnUntraced(function* (state) {
            const resolved = yield* resolve(state, path, { method: "stat" });
            const subscription: WatchSubscription = {
              id: volume.allocateSubscriptionId(),
              path: resolved.path,
              directory: resolved.entry._tag === "Directory",
              recursive: options?.recursive === true,
              queue: undefined,
              // NOTE: `Stream.callback` attaches its queue after subscription
              // registration, so retain matching events across that handoff.
              pending: [],
            };
            MutableHashMap.set(volume.watchers, subscription.id, subscription);
            return subscription;
          })
        ),
        (subscription) =>
          volume.withState(() =>
            Effect.sync(() => {
              MutableHashMap.remove(volume.watchers, subscription.id);
            })
          )
      ),
      (subscription) =>
        Stream.callback<FileSystem.WatchEvent, PlatformError>((queue) =>
          Effect.sync(() => {
            subscription.queue = queue;
            for (const event of subscription.pending) {
              Queue.offerUnsafe(queue, event);
            }
            subscription.pending.length = 0;
          })
        )
    )
  );

// =============================================================================
// exports
// =============================================================================

const toFileSystem = (volume: Volume): FileSystem.FileSystem =>
  FileSystem.make({
    access: access(volume),
    copy: copy(volume),
    copyFile: copyFile(volume),
    chmod: chmod(volume),
    chown: chown(volume),
    glob: glob(volume),
    link: link(volume),
    lstat: lstat(volume),
    makeDirectory: makeDirectory(volume),
    makeTempDirectory: makeTempDirectory(volume),
    makeTempDirectoryScoped: makeTempDirectoryScoped(volume),
    makeTempFile: makeTempFile(volume),
    makeTempFileScoped: makeTempFileScoped(volume),
    open: open(volume),
    readDirectory: readDirectory(volume),
    readFile: readFile(volume),
    readLink: readLink(volume),
    realPath: realPath(volume),
    remove: remove(volume),
    rename: rename(volume),
    stat: stat(volume),
    symlink: symlink(volume),
    truncate: truncate(volume),
    utimes: utimes(volume),
    watch: watch(volume),
    writeFile: writeFile(volume),
  });

const makeReadyVolume: (options: EngineOptions) => Effect.Effect<Volume> = Effect.fn("Volume.makeReady")(
  function* (options) {
    const volume = yield* makeVolume(options);
    yield* Effect.orDie(makeDirectory(volume)(TEMP_DIR, { recursive: true }));
    return volume;
  }
);

/**
 * Creates a fresh in-memory file system with case-sensitive path lookup.
 *
 * **Details**
 *
 * The initial volume contains the root directory and `/tmp`. Each execution
 * creates independent state, file descriptors, and watch subscriptions.
 *
 * **Example** (Write and read text in a fresh file system)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { make } from "@beep/memfs/internal/volume"
 *
 * const fileSystem = Effect.runSync(make)
 * Effect.runSync(fileSystem.writeFileString("/note.txt", "memory"))
 * console.log(Effect.runSync(fileSystem.readFileString("/note.txt"))) // memory
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const make: Effect.Effect<FileSystem.FileSystem> = Effect.map(
  makeReadyVolume(defaultEngineOptions),
  toFileSystem
);

// Kit extension (volume inspection): a literal, synchronous walk of the tree
// for test assertions. Symbolic links are reported as themselves (never
// followed); hard links surface once per directory entry, each path carrying
// the same underlying data reference.

const SnapshotEntryType = LiteralKit(["File", "Directory", "SymbolicLink"]).pipe(
  $I.annoteSchema("SnapshotEntryType", { description: "The literal entry kind reported by volume inspection." })
);

/**
 * Describes a literal directory entry and its current metadata for inspection.
 *
 * **Details**
 *
 * Symbolic links are reported as themselves and never followed. Hard links
 * appear once per directory entry, with each path sharing the underlying data
 * reference. Size is the file byte length, the link target's UTF-8 byte length,
 * or zero for a directory.
 *
 * **Gotchas**
 *
 * File data is a live reference; callers must copy it before exposing or
 * modifying bytes outside the engine.
 *
 * **Example** (Decode a directory entry)
 *
 * ```ts
 * import { VolumeEntrySnapshot } from "@beep/memfs/internal/volume"
 * import * as S from "effect/Schema"
 *
 * const entry = S.decodeUnknownSync(VolumeEntrySnapshot)({
 *   path: "/docs",
 *   type: "Directory",
 *   data: undefined,
 *   mtime: 0,
 *   target: undefined,
 *   size: 0
 * })
 * console.log(entry.type) // "Directory"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class VolumeEntrySnapshot extends S.Opaque<VolumeEntrySnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String.pipe($I.annoteKey("VolumeEntrySnapshot.path", { description: "The literal entry path." })),
    type: SnapshotEntryType.pipe(
      $I.annoteKey("VolumeEntrySnapshot.type", { description: "The entry kind, without following symbolic links." })
    ),
    data: S.UndefinedOr(S.Uint8Array).pipe(
      $I.annoteKey("VolumeEntrySnapshot.data", {
        description: "The live file bytes (callers must copy), or undefined for other entries; the key is required.",
      })
    ),
    mtime: S.Finite.pipe(
      $I.annoteKey("VolumeEntrySnapshot.mtime", {
        description: "The modification time in epoch milliseconds, using the same clock as stat.",
      })
    ),
    target: S.UndefinedOr(S.String).pipe(
      $I.annoteKey("VolumeEntrySnapshot.target", {
        description: "The stored symbolic-link target resolved, or undefined for other entries; the key is required.",
      })
    ),
    size: S.Finite.pipe(
      $I.annoteKey("VolumeEntrySnapshot.size", {
        description: "The file byte length, link target UTF-8 byte length, or zero for a directory.",
      })
    ),
  }).pipe(
    $I.annoteSchema("VolumeEntrySnapshot", {
      description: "A plain-object inspection payload retaining required undefined-valued keys and live file bytes.",
    })
  )
) {}

const encoder = new TextEncoder();

const snapshotOf: {
  (path: string, entry: InodeEntry): VolumeEntrySnapshot;
  (entry: InodeEntry): (path: string) => VolumeEntrySnapshot;
} = dual(
  2,
  (path: string, entry: InodeEntry): VolumeEntrySnapshot =>
    VolumeEntrySnapshot.make({
      path,
      type: entry._tag,
      data: entry._tag === "File" ? entry.data : undefined,
      mtime: DateTime.toEpochMillis(entry.mtime),
      target: entry._tag === "SymbolicLink" ? entry.target : undefined,
      size:
        entry._tag === "File"
          ? entry.data.length
          : entry._tag === "SymbolicLink"
            ? encoder.encode(entry.target).length
            : 0,
    })
);

const collectEntrySnapshots = (state: State): Array<VolumeEntrySnapshot> => {
  const output: Array<VolumeEntrySnapshot> = [];
  const root = O.getOrThrow(O.filter(HashMap.get(state.inodes, RootInode), InodeEntry.isAnyOf(["Directory"])));
  // The root itself, which the walk below never reaches — it starts FROM the
  // root and reports descendants. Emitting it lets the inspection view answer
  // `has`/`isDirectory`/`mtime` for "/" from real state rather than a
  // synthesized stand-in. `snapshot`/`paths` filter on `data`, so a directory
  // entry does not disturb them.
  output.push(snapshotOf("/", root));
  walkDirectory(
    state,
    root,
    "",
    (prefix, name) => `${prefix}/${name}`,
    (path, entry) => {
      output.push(snapshotOf(path, entry));
      return true;
    }
  );
  return output;
};

// KIT EXTENSION (inspection lookup): a literal, O(depth) lookup for the
// inspection view, so a point query never walks the whole tree. Components
// resolve through `lookupEntry` (so a case-insensitive volume folds for free)
// and a symbolic link is NEVER followed — not even an
// intermediate one: a component under a link is absent, which is the view's
// literal contract. `components` is the already-normalized path split on "/",
// "" segments removed.
const lookupLiteral: {
  (state: State, components: ReadonlyArray<string>): InodeEntry | undefined;
  (components: ReadonlyArray<string>): (state: State) => InodeEntry | undefined;
} = dual(2, (state: State, components: ReadonlyArray<string>): InodeEntry | undefined => {
  let entry = findInode(state, RootInode);
  for (const component of components) {
    if (entry === undefined || entry._tag !== "Directory") return undefined;
    const found = lookupEntry(state, entry, component);
    if (found === undefined) return undefined;
    entry = findInode(state, found[1]);
  }
  return entry;
});

const splitComponents = (path: string): ReadonlyArray<string> =>
  A.filter(Str.split("/")(path), (part) => part.length > 0);
// END KIT EXTENSION (inspection lookup)

// A member that is behavior: held by reference, recognized as a function.
const declareFunction = <F>() => S.declare((u: unknown): u is F => P.isFunction(u));

/**
 * Couples the effectful file system with synchronous inspection of committed state.
 *
 * **Details**
 *
 * Inspection reads the live volume at call time rather than a copy taken at
 * construction. Literal lookup never follows symbolic links, even in
 * intermediate components, and applies the engine's case-folding policy.
 *
 * **Example** (Look up a written file)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { EngineOptions, makeInspectableWith } from "@beep/memfs/internal/volume"
 *
 * const engine = Effect.runSync(makeInspectableWith(EngineOptions.make({ caseSensitive: true })))
 * Effect.runSync(engine.fileSystem.writeFileString("/a.txt", "a"))
 * console.log(engine.lookup("/a.txt")?.type) // File
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class InspectableFileSystem extends S.Opaque<InspectableFileSystem, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Walks the volume's live state at call time — never a copy taken at build.
     */
    entries: declareFunction<() => Array<VolumeEntrySnapshot>>().pipe(
      $I.annoteKey("InspectableFileSystem.entries", { description: "Every literal entry of the live volume." })
    ),
    fileSystem: S.declare((u: unknown): u is FileSystem.FileSystem => P.hasProperty(u, "~effect/FileSystem")).pipe(
      $I.annoteKey("InspectableFileSystem.fileSystem", { description: "The FileSystem service over the volume." })
    ),
    /**
     * The stored names inside the directory at `path`, sorted; `undefined` when it is not one.
     */
    list: declareFunction<(path: string) => ReadonlyArray<string> | undefined>().pipe(
      $I.annoteKey("InspectableFileSystem.list", { description: "The stored names inside a directory." })
    ),
    /**
     * The literal entry at a lexically normalized absolute path, or `undefined`.
     *
     * **Details**
     *
     * O(depth). The snapshot's `path` is the query as given, not the stored
     * spelling — point queries never expose it.
     */
    lookup: declareFunction<(path: string) => VolumeEntrySnapshot | undefined>().pipe(
      $I.annoteKey("InspectableFileSystem.lookup", { description: "The literal entry at a path." })
    ),
  }).pipe(
    $I.annoteSchema("InspectableFileSystem", {
      description: "An effectful file system coupled with synchronous inspection of its committed state.",
    })
  )
) {}

/**
 * Creates an independent volume with effectful operations and synchronous inspection.
 *
 * **Details**
 *
 * The root directory and `/tmp` exist initially. Inspection observes committed
 * state without acquiring the asynchronous mutation lock; each read sees one
 * consistent state. Lookup reports the supplied path, while directory listing
 * preserves stored spellings and sorts them in string order.
 *
 * **Example** (Inspect a file through case-insensitive lookup)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { EngineOptions, makeInspectableWith } from "@beep/memfs/internal/volume"
 *
 * const engine = Effect.runSync(makeInspectableWith(EngineOptions.make({ caseSensitive: false })))
 * Effect.runSync(engine.fileSystem.writeFileString("/Note.txt", "hello"))
 * console.log(engine.lookup("/note.txt")?.size) // 5
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeInspectableWith = (options: EngineOptions): Effect.Effect<InspectableFileSystem> =>
  Effect.map(makeReadyVolume(options), (volume) =>
    InspectableFileSystem.make({
      fileSystem: toFileSystem(volume),
      entries: () => collectEntrySnapshots(volume.currentState()),
      lookup: (path) => {
        const entry = lookupLiteral(volume.currentState(), splitComponents(path));
        return entry === undefined ? undefined : snapshotOf(path, entry);
      },
      list: (path) => {
        const entry = lookupLiteral(volume.currentState(), splitComponents(path));
        return entry?._tag === "Directory" ? A.sort(HashMap.keys(entry.entries), Order.String) : undefined;
      },
    })
  );

/**
 * Provides a fresh case-sensitive in-memory file system through the FileSystem service.
 *
 * **Details**
 *
 * The provided volume starts with the root directory and `/tmp`; operations in
 * the same layer build share its state.
 *
 * **Example** (Provide the file system to a text-writing program)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as FileSystem from "effect/FileSystem"
 * import { layer } from "@beep/memfs/internal/volume"
 *
 * const program = Effect.gen(function* () {
 *   const fileSystem = yield* FileSystem.FileSystem
 *   yield* fileSystem.writeFileString("/message.txt", "provided")
 *   return yield* fileSystem.readFileString("/message.txt")
 * })
 * console.log(await Effect.runPromise(Effect.provide(program, layer))) // provided
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const layer = Layer.effect(FileSystem.FileSystem, make);
