/**
 * In-memory `FileSystem` engine: an isolated POSIX volume behind
 * Effect's `FileSystem` service, with no host filesystem IO.
 *
 * **Details**
 *
 * Public callers use `@beep/test-utils/MemoryFileSystem`.
 * Deliberate divergences from the pinned upstream — watch recursion, nesting
 * bounds and `access` ignoring mode — are listed in
 * the port notes below.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// Ported from Effect-TS/effect PR #6573 "feat: add MemoryFileSystem module"
// (https://github.com/Effect-TS/effect/pull/6573), pinned head
// c0528bd5cf12154aa95a7ceec243fd2045876853, by lloydrichards, built on fubhy's
// design in effect-smol PR #456 (https://github.com/Effect-TS/effect-smol/pull/456).
// Upstream source: packages/effect/src/internal/memoryFileSystem.ts.
// Copyright: Effectful Technologies Inc.
// MIT License
//
// Copyright (c) 2023 Effectful Technologies Inc
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// The current core was characterized against Effect rc.112 on Node and Bun.
// The schema/helper adaptation preserves the following established semantics.
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
//   pathological tree or pattern fails through the typed channel, never as a
//   stack-overflow defect.
// - `access` deliberately ignores its options (upstream posture: no virtual
//   process identity, permission bits are metadata only); the facade TSDoc
//   states it.
// - `copy` with `overwrite: false` onto an existing destination reports the
//   source path on AlreadyExists, matching the pinned rc.112 conformance
//   contract. Other conflict arms retain their existing path metadata.

import { $TestUtilsId } from "@beep/identity/packages";
import { HasNullByte } from "@beep/schema/FilePath";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as PlatformErrorNs from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import type * as Cause from "effect/Cause";

const $I = $TestUtilsId.create("MemoryFileSystem/MemoryFileSystem.test-kit");

class MemoryFileSystemInvariantError extends S.TaggedError<MemoryFileSystemInvariantError>(
  $I`MemoryFileSystemInvariantError`
)(
  "MemoryFileSystemInvariantError",
  { message: S.String },
  $I.annoteError<MemoryFileSystemInvariantError>("MemoryFileSystemInvariantError", {
    description: "An impossible mismatch between an allocated inode and its expected file variant.",
  })
) {}

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

// These identities preserve the original numeric representation without imposing
// new allocation limits. Only the allocator constructs them.
const Inode = S.Finite.pipe(S.brand("MemoryFileSystemInode")).annotate(
  $I.annote("Inode", {
    description: "Private numeric identity allocated to an inode in one virtual volume.",
  })
);
type Inode = typeof Inode.Type;
const RootInode = Inode.make(1);
const localeEntryOrder: Order.Order<readonly [string, Inode]> = Order.mapInput(
  Order.make<string>((left, right) => Num.sign(left.localeCompare(right))),
  Tuple.get(0)
);

const FileDescriptor = S.Finite.pipe(S.brand("MemoryFileSystemFileDescriptor")).annotate(
  $I.annote("FileDescriptor", {
    description: "Private numeric open-descriptor identity allocated within one virtual volume.",
  })
);
type FileDescriptor = typeof FileDescriptor.Type;

const ModeOrOwner = S.Finite.check(S.isUint32()).annotate(
  $I.annote("ModeOrOwner", {
    description: "The full unsigned 32-bit input accepted by chmod, chown and open mode checks.",
  })
);
type ModeOrOwner = typeof ModeOrOwner.Type;
const isModeOrOwner = S.is(ModeOrOwner);

const SafeSize = S.Int.check(S.isGreaterThanOrEqualTo(0)).annotate(
  $I.annote("SafeSize", {
    description: "A non-negative safe integer byte position or allocation size at an IO boundary.",
  })
);
type SafeSize = typeof SafeSize.Type;
const isSafeSize = S.is(SafeSize);
const isInt = S.is(S.Int);
const isFinite = S.is(S.Finite);
const isNonEmptyString = S.is(S.NonEmptyString);

const EntryName = S.NonEmptyString.check(
  S.makeFilter((value) => value !== "." && value !== ".." && !Str.includes("/")(value) && !HasNullByte.is(value), {
    identifier: $I`EntryNameCheck`,
    title: "Directory entry name",
    description: "Reject only dot names, separators and embedded NUL.",
  })
).annotate(
  $I.annote("EntryName", {
    description: "One virtual directory component, excluding dot components, separators and NUL.",
  })
);
type EntryName = typeof EntryName.Type;
const isEntryName = S.is(EntryName);

const TemporaryFragment = S.String.check(S.isPattern(/^[^/\u0000]*$/)).annotate(
  $I.annote("TemporaryFragment", {
    description: "A possibly empty temporary-name prefix or suffix without separators or NUL.",
  })
);
type TemporaryFragment = typeof TemporaryFragment.Type;
const isTemporaryFragment = S.is(TemporaryFragment);

class InodeMetadata extends S.Class<InodeMetadata>($I`InodeMetadata`)(
  {
    ino: Inode,
    mode: S.Finite,
    uid: ModeOrOwner.pipe(S.withConstructorDefault(Effect.succeed(DEFAULT_UID))),
    gid: ModeOrOwner.pipe(S.withConstructorDefault(Effect.succeed(DEFAULT_GID))),
    nlink: S.Finite,
    openCount: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0))),
    atime: S.DateTimeUtc,
    mtime: S.DateTimeUtc,
    ctime: S.DateTimeUtc,
    birthtime: S.DateTimeUtc,
  },
  $I.annote("InodeMetadata", {
    description: "POSIX metadata shared by stored inodes; namespace operations own timestamps and link counts.",
  })
) {}

const InodeEntry = S.TaggedUnion({
  File: { ...InodeMetadata.fields, data: S.Uint8Array },
  Directory: { ...InodeMetadata.fields, entries: S.HashMap(S.String, Inode) },
  SymbolicLink: { ...InodeMetadata.fields, target: S.String },
}).annotate(
  $I.annote("InodeEntry", {
    description: "Stored file bytes, immutable directory entries or a literal symbolic-link target.",
  })
);
type InodeEntry = typeof InodeEntry.Type;
type FileInode = typeof InodeEntry.cases.File.Type;
type DirectoryInode = typeof InodeEntry.cases.Directory.Type;

// Stored inode dispatch only checks the discriminant. Full .guards validation
// would revisit directory entries on every lookup; construction keeps its schemas.
const isDirectoryInode = InodeEntry.isAnyOf(["Directory"]);
const isFileInode = InodeEntry.isAnyOf(["File"]);
const isSymbolicLinkInode = InodeEntry.isAnyOf(["SymbolicLink"]);

interface WatchSubscription {
  readonly directory: boolean;
  readonly path: string;
  readonly pending: Array<FileSystem.WatchEvent>;
  queue: Queue.Enqueue<FileSystem.WatchEvent, PlatformError | Cause.Done> | undefined;
  readonly recursive: boolean;
}

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

interface Volume {
  readonly mutate: <A, E, R>(use: (state: State) => Effect.Effect<TransitionResult<A>, E, R>) => Effect.Effect<A, E, R>;
  readonly mutateInterruptibly: <A, E, R>(
    use: (state: State) => Effect.Effect<TransitionResult<A>, E, R>
  ) => Effect.Effect<A, E, R>;
  readonly watchers: MutableHashSet.MutableHashSet<WatchSubscription>;
  readonly withState: <A, E, R>(use: (state: State) => Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
}

const Cursor = S.BigInt.annotate(
  $I.annote("Cursor", {
    description: "Stored file position; seek rejects positions before the start of the file.",
  })
);
type Cursor = typeof Cursor.Type;

class OpenFileDescriptor extends S.Class<OpenFileDescriptor>($I`OpenFileDescriptor`)(
  {
    fd: FileDescriptor,
    inode: Inode,
    readable: S.Boolean,
    writable: S.Boolean,
    append: S.Boolean,
    position: Cursor,
  },
  $I.annote("OpenFileDescriptor", {
    description: "Stored access flags and cursor for an open descriptor, separate from its resource handle.",
  })
) {}

class State extends S.Class<State>($I`State`)(
  {
    inodes: S.HashMap(Inode, InodeEntry),
    nextInode: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(FIRST_INODE))),
    descriptors: S.HashMap(FileDescriptor, OpenFileDescriptor).pipe(
      S.withConstructorDefault(Effect.sync(() => HashMap.empty()))
    ),
    nextDescriptor: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(FIRST_DESCRIPTOR))),
    nextTemporary: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(FIRST_TEMP))),
  },
  $I.annote("State", {
    description: "One committed virtual-volume state; transitions replace maps without cloning all inode data.",
  })
) {}

class ResolutionPolicy extends S.Class<ResolutionPolicy>($I`ResolutionPolicy`)(
  {
    followFinalSymbolicLink: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
    method: S.String.pipe(S.withConstructorDefault(Effect.succeed("resolve"))),
  },
  $I.annote("ResolutionPolicy", {
    description: "Private final-symlink and error-method policy for virtual-root path resolution.",
  })
) {}
type ResolveOptions = S.Struct.MakeIn<typeof ResolutionPolicy.fields>;

class ResolvedInode extends S.Class<ResolvedInode>($I`ResolvedInode`)(
  {
    inode: Inode,
    entry: InodeEntry,
    path: S.String,
  },
  $I.annote("ResolvedInode", {
    description: "Resolved inode plus its normalized virtual-root path, distinct from the original error path.",
  })
) {}

class ResolvedParent extends S.Class<ResolvedParent>($I`ResolvedParent`)(
  { inode: Inode, entry: InodeEntry.cases.Directory, name: S.String, path: S.String },
  $I.annote("ResolvedParent", {
    description: "Resolved containing directory and final component, without requiring the child to exist.",
  })
) {}

class ResolvedEntry extends S.Class<ResolvedEntry>($I`ResolvedEntry`)(
  {
    parent: InodeEntry.cases.Directory,
    name: S.String,
    entry: InodeEntry,
    path: S.String,
  },
  $I.annote("ResolvedEntry", {
    description: "A named child and its parent directory for namespace mutations.",
  })
) {}

class CloneContext extends S.Class<CloneContext>($I`CloneContext`)(
  {
    method: S.String,
    sourcePath: S.String,
    preserveTimestamps: S.Boolean,
  },
  $I.annote("CloneContext", {
    description: "Clone error provenance and timestamp policy threaded through bounded directory recursion.",
  })
) {}

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

const invalidData = (method: string, path: string, description: string): PlatformError =>
  fileSystemError({
    _tag: "InvalidData",
    method,
    pathOrDescriptor: path,
    description,
  });

const alreadyExists = (method: string, path: string): PlatformError =>
  fileSystemError({ _tag: "AlreadyExists", method, pathOrDescriptor: path });

const permissionDenied = (method: string, path: string, description: string): PlatformError =>
  fileSystemError({
    _tag: "PermissionDenied",
    method,
    pathOrDescriptor: path,
    description,
  });

const badResource = (method: string, pathOrDescriptor: string | number, description?: string): PlatformError =>
  fileSystemError({ _tag: "BadResource", method, pathOrDescriptor, description });

const notFound = (method: string, path: string): PlatformError =>
  fileSystemError({ _tag: "NotFound", method, pathOrDescriptor: path });

const argumentError = (method: string, description: string): PlatformError =>
  badArgument({ module: "FileSystem", method, description });

const findInode = (state: State, inode: Inode): O.Option<InodeEntry> => HashMap.get(state.inodes, inode);
const findEntry = (directory: DirectoryInode, name: string): O.Option<Inode> => HashMap.get(directory.entries, name);

const setInode = (state: State, entry: InodeEntry): State => ({
  ...state,
  inodes: HashMap.set(state.inodes, entry.ino, entry),
});

const getInode = Effect.fnUntraced(function* (state: State, inode: Inode, method: string, path: string) {
  return yield* Effect.fromOption(findInode(state, inode), () => notFound(method, path));
});

const validateEntryName = Effect.fnUntraced(function* (method: string, name: string, pathOrDescriptor: string = name) {
  const invalidName = !isEntryName(name);
  if (invalidName) {
    return yield* invalidData(method, pathOrDescriptor, "Invalid directory entry name");
  }
  return;
});

const getDirectory = Effect.fnUntraced(function* (state: State, inode: Inode, method: string, path: string) {
  const entry = yield* getInode(state, inode, method, path);
  if (!isDirectoryInode(entry)) {
    return yield* badResource(method, path);
  }
  return entry;
});

const touchNamespaceMutation = (
  state: State,
  directory: DirectoryInode,
  target: InodeEntry,
  now: DateTime.Utc
): State => ({
  ...state,
  inodes: HashMap.set(
    HashMap.set(state.inodes, directory.ino, {
      ...directory,
      mtime: now,
      ctime: now,
    }),
    target.ino,
    {
      ...target,
      ctime: now,
    }
  ),
});

const childPath = (parent: string, name: string): string => (parent === "/" ? `/${name}` : `${parent}/${name}`);

const parentOfPath = (path: string): string => {
  const separator = O.getOrElse(Str.lastIndexOf("/")(path), () => -1);
  return separator <= 0 ? "/" : Str.slice(0, separator)(path);
};

// PORT NOTE: upstream ignored `WatchOptions` and made every directory watch
// recursive. Here a non-recursive directory watch reports the path itself and
// its DIRECT children (node `fs.watch` semantics); `recursive: true` reports
// all descendants; events on an ancestor of the watched path are always
// reported (upstream behavior, kept).
const includesDirectoryWatchPath = (watchedPath: string, recursive: boolean, eventPath: string): boolean =>
  recursive
    ? watchedPath === "/" || Str.startsWith(`${watchedPath}/`)(eventPath)
    : eventPath !== "/" && parentOfPath(eventPath) === watchedPath;

const includesWatchPath = (watchedPath: string, directory: boolean, recursive: boolean, eventPath: string): boolean =>
  eventPath === watchedPath ||
  (directory && includesDirectoryWatchPath(watchedPath, recursive, eventPath)) ||
  (eventPath !== "/" && Str.startsWith(`${eventPath}/`)(watchedPath));

const publishToWatcher = (watcher: WatchSubscription, events: ReadonlyArray<FileSystem.WatchEvent>): void => {
  for (const event of events) {
    if (!includesWatchPath(watcher.path, watcher.directory, watcher.recursive, event.path)) continue;
    if (watcher.queue === undefined) watcher.pending.push(event);
    else Queue.offerUnsafe(watcher.queue, event);
  }
};

const publishWatchEvents = Effect.fnUntraced(function* (
  watchers: MutableHashSet.MutableHashSet<WatchSubscription>,
  events: ReadonlyArray<FileSystem.WatchEvent>
) {
  return yield* Effect.sync(() => {
    for (const watcher of watchers) {
      publishToWatcher(watcher, events);
    }
  });
});

// PORT NOTE: iterative worklist where upstream recursed. Callers sort the
// result, so traversal order is not part of the contract.
const collectInodePaths = (state: State, inode: Inode, directory: DirectoryInode, parent = "/"): Array<string> => {
  const paths: Array<string> = [];
  const pending: Array<readonly [DirectoryInode, string]> = [[directory, parent]];
  while (pending.length > 0) {
    const next = pending.pop();
    if (next === undefined) break;
    const [current, currentPath] = next;
    for (const [name, childInode] of current.entries) {
      const path = childPath(currentPath, name);
      if (childInode === inode) paths.push(path);
      const child = O.filter(findInode(state, childInode), isDirectoryInode);
      O.map(child, (directory) => pending.push(Tuple.make(directory, path)));
    }
  }
  return paths;
};

const inodeUpdateEvents = (state: State, inode: Inode): ReadonlyArray<FileSystem.WatchEvent.Update> => {
  const rootOption = O.filter(findInode(state, RootInode), isDirectoryInode);
  if (O.isNone(rootOption)) return [];
  const root = rootOption.value;
  if (inode === RootInode) return [{ _tag: "Update", path: "/" }];
  // NOTE: An inode may be reachable through multiple hard-link aliases, each of
  // which must receive an update event.
  return A.map(A.sort(collectInodePaths(state, inode, root), Order.String), (path) => ({ _tag: "Update", path }));
};

const reclaimInode = (state: State, entry: InodeEntry): State =>
  entry.nlink === 0 && entry.openCount === 0
    ? {
        ...state,
        inodes: HashMap.remove(state.inodes, entry.ino),
      }
    : state;

// =============================================================================
// inode creation and linking
// =============================================================================

// Allocation owns the clock read, identity and state update; each variant retains
// its schema constructor and payload ownership (in particular the file byte copy).
const allocateInode = Effect.fnUntraced(function* (
  state: State,
  mode: number,
  nlink: number,
  create: (metadata: InodeMetadata) => InodeEntry
) {
  const now = yield* DateTime.now;
  const ino = Inode.make(state.nextInode);
  const entry = create({
    ino,
    mode,
    nlink,
    uid: DEFAULT_UID,
    gid: DEFAULT_GID,
    openCount: 0,
    atime: now,
    mtime: now,
    ctime: now,
    birthtime: now,
  });
  return Tuple.make({ ...state, nextInode: state.nextInode + 1, inodes: HashMap.set(state.inodes, ino, entry) }, ino);
});

const createFile = Effect.fnUntraced(function* (state: State, data: Uint8Array = new Uint8Array()) {
  return yield* allocateInode(state, FILE_MODE, 0, (metadata) =>
    InodeEntry.cases.File.make({ ...metadata, data: data.slice() })
  );
});

const createDirectory = Effect.fnUntraced(function* (state: State) {
  return yield* allocateInode(state, DIR_MODE, DIR_SELF_LINK_COUNT, (metadata) =>
    InodeEntry.cases.Directory.make({ ...metadata, entries: HashMap.empty() })
  );
});

const createSymbolicLink = Effect.fnUntraced(function* (state: State, target: string) {
  return yield* allocateInode(state, LINK_MODE, 0, (metadata) =>
    InodeEntry.cases.SymbolicLink.make({ ...metadata, target })
  );
});

const validateAttachment = Effect.fnUntraced(function* (
  state: State,
  parent: Inode,
  name: string,
  inode: Inode,
  method: string
) {
  yield* validateEntryName(method, name);
  const parentEntry = yield* getDirectory(state, parent, method, name);
  if (HashMap.has(parentEntry.entries, name)) return yield* alreadyExists(method, name);
  const entry = yield* getInode(state, inode, method, name);
  return Tuple.make(parentEntry, entry);
});

const attachDirectory = Effect.fnUntraced(function* (
  state: State,
  parent: Inode,
  name: string,
  inode: Inode,
  method = "makeDirectory"
) {
  const [parentEntry, entry] = yield* validateAttachment(state, parent, name, inode, method);
  const expectedUnlinkedLinks = isDirectoryInode(entry)
    ? DIR_SELF_LINK_COUNT +
      A.filter([...HashMap.values(entry.entries)], (child) => O.exists(findInode(state, child), isDirectoryInode))
        .length
    : 0;
  if (!isDirectoryInode(entry) || parent === inode || entry.nlink !== expectedUnlinkedLinks) {
    return yield* permissionDenied(method, name, "Cannot attach this directory");
  }
  const now = yield* DateTime.now;
  const nextParent = {
    ...parentEntry,
    entries: HashMap.set(parentEntry.entries, name, inode),
    nlink: parentEntry.nlink + 1,
  };
  const nextEntry = { ...entry, nlink: entry.nlink + 1 };
  return touchNamespaceMutation(state, nextParent, nextEntry, now);
});

const linkInode = Effect.fnUntraced(function* (
  state: State,
  parent: Inode,
  name: string,
  inode: Inode,
  method = "link"
) {
  const [parentEntry, entry] = yield* validateAttachment(state, parent, name, inode, method);
  if (isDirectoryInode(entry)) {
    return yield* permissionDenied(method, name, "Cannot create a hard link to a directory");
  }
  const now = yield* DateTime.now;
  const nextParent = {
    ...parentEntry,
    entries: HashMap.set(parentEntry.entries, name, inode),
  };
  const nextEntry = { ...entry, nlink: entry.nlink + 1 };
  return touchNamespaceMutation(state, nextParent, nextEntry, now);
});

// =============================================================================
// path resolution
// =============================================================================

// NOTE: Relative paths resolve from the virtual POSIX root because `FileSystem` has
// no `chdir` operation or mutable working-directory state.
// Mutable path-walk bookkeeping, not a stored inode or an input data model.
interface ResolutionWalk {
  components: Array<string>;
  readonly names: Array<string>;
  readonly stack: Array<Inode>;
  symbolicLinkTraversals: number;
}

const navigatePathComponent = Effect.fnUntraced(function* (
  state: State,
  walk: ResolutionWalk,
  component: string,
  method: string,
  path: string
) {
  if (component.length === 0) {
    if (walk.components.length === 0) yield* getDirectory(state, walk.stack[walk.stack.length - 1], method, path);
    return true;
  }
  if (component !== "." && component !== "..") return false;
  yield* getDirectory(state, walk.stack[walk.stack.length - 1], method, path);
  if (component === ".." && walk.stack.length > 1) {
    walk.stack.pop();
    walk.names.pop();
  }
  return true;
});

const followSymbolicLink = Effect.fnUntraced(function* (
  walk: ResolutionWalk,
  target: string,
  method: string,
  path: string
) {
  walk.symbolicLinkTraversals += 1;
  if (walk.symbolicLinkTraversals > MAX_LINK_TRAVERSAL) {
    return yield* badResource(method, path, "Too many symbolic links");
  }
  if (target.length === 0) return yield* notFound(method, path);
  if (Str.startsWith("/")(target)) {
    walk.stack.splice(1);
    walk.names.splice(0);
  }
  walk.components = A.appendAll(Str.split("/")(target), walk.components);
});

const resolvePathComponent = Effect.fnUntraced(function* (
  state: State,
  walk: ResolutionWalk,
  component: string,
  policy: ResolutionPolicy,
  path: string
) {
  const { method, followFinalSymbolicLink } = policy;
  if (yield* navigatePathComponent(state, walk, component, method, path)) return;
  const parent = yield* getDirectory(state, walk.stack[walk.stack.length - 1], method, path);
  const inode = yield* Effect.fromOption(findEntry(parent, component), () => notFound(method, path));
  const entry = yield* getInode(state, inode, method, path);
  if (isSymbolicLinkInode(entry) && (walk.components.length > 0 || followFinalSymbolicLink)) {
    return yield* followSymbolicLink(walk, entry.target, method, path);
  }
  walk.stack.push(inode);
  walk.names.push(component);
});

const resolve = Effect.fnUntraced(function* (state: State, path: string, options?: ResolveOptions) {
  const policy = ResolutionPolicy.make(options ?? {});
  const { method } = policy;
  if (path.length === 0 || HasNullByte.is(path)) return yield* notFound(method, path);
  const walk: ResolutionWalk = {
    components: Str.split("/")(path),
    stack: [RootInode],
    names: [],
    symbolicLinkTraversals: 0,
  };
  while (walk.components.length > 0) {
    const component = walk.components.shift();
    if (component === undefined) continue;
    yield* resolvePathComponent(state, walk, component, policy, path);
  }
  const inode = walk.stack[walk.stack.length - 1];
  const entry = yield* getInode(state, inode, method, path);
  return {
    inode,
    entry,
    path: walk.names.length === 0 ? "/" : `/${A.join(walk.names, "/")}`,
  } satisfies ResolvedInode;
});

class OpenMode extends S.Class<OpenMode>($I`OpenMode`)(
  {
    readable: S.Boolean,
    writable: S.Boolean,
    append: S.Boolean,
    create: S.Boolean,
    exclusive: S.Boolean,
    truncate: S.Boolean,
  },
  $I.annote("OpenMode", {
    description: "The six operational flags interpreted from a supported upstream open flag.",
  })
) {}

type OpenOptions = Parameters<FileSystem.FileSystem["open"]>[1];

// =============================================================================
// descriptors
// =============================================================================

const OpenFlag = LiteralKit(["r", "r+", "w", "wx", "w+", "wx+", "a", "ax", "a+", "ax+"]).annotate(
  $I.annote("OpenFlag", { description: "The exact ten file-open flags accepted by the upstream filesystem contract." })
);
type OpenFlag = typeof OpenFlag.Type;
const isOpenFlag = S.is(OpenFlag);

const openMode = (flag: OpenFlag): OpenMode =>
  OpenMode.make({
    readable: flag === "r" || Str.endsWith("+")(flag),
    writable: flag !== "r",
    append: Str.startsWith("a")(flag),
    create: Str.startsWith("w")(flag) || Str.startsWith("a")(flag),
    exclusive: Str.includes("x")(flag),
    truncate: Str.startsWith("w")(flag),
  });

const descriptorError = (fd: FileDescriptor, method: string, description?: string): PlatformError =>
  badResource(method, fd, description);

const allocateBytes = Effect.fnUntraced(function* (length: number, fd: FileDescriptor, method: string) {
  return yield* Effect.try({
    try: () => new Uint8Array(length),
    catch: () => descriptorError(fd, method, "Unable to allocate file bytes"),
  });
});

const getOpenFile = Effect.fnUntraced(function* (
  state: State,
  fd: FileDescriptor,
  method: string,
  access?: "readable" | "writable"
): Effect.fn.Return<readonly [OpenFileDescriptor, FileInode], PlatformError> {
  return yield* Effect.suspend(() => {
    const descriptorOption = HashMap.get(state.descriptors, fd);
    if (O.isNone(descriptorOption)) return Effect.fail(descriptorError(fd, method, "File descriptor is closed"));
    const descriptor = descriptorOption.value;
    if (access !== undefined && !descriptor[access]) {
      return Effect.fail(descriptorError(fd, method, `File descriptor is not ${access}`));
    }
    const entryOption = O.filter(findInode(state, descriptor.inode), isFileInode);
    if (O.isNone(entryOption))
      return Effect.fail(descriptorError(fd, method, "File descriptor does not refer to a file"));
    const entry = entryOption.value;
    return Effect.succeed(Tuple.make(descriptor, entry));
  });
});

const withSystemErrorPath = (error: PlatformError, method: string, path: string): PlatformError =>
  error.reason._tag === "BadArgument"
    ? error
    : fileSystemError({
        _tag: error.reason._tag,
        method,
        pathOrDescriptor: path,
        description: error.reason.description,
        syscall: error.reason.syscall,
        cause: error.reason.cause,
      });

const withOperationError = (error: PlatformError, method: string, path: string): PlatformError =>
  error.reason._tag === "BadArgument"
    ? badArgument({
        module: error.reason.module,
        method,
        description: error.reason.description,
        cause: error.reason.cause,
      })
    : withSystemErrorPath(error, method, path);

const symbolicLinkTargetPath = (linkPath: string, target: string): string => {
  if (Str.startsWith("/")(target)) {
    return target;
  }
  const separator = O.getOrElse(Str.lastIndexOf("/")(linkPath), () => -1);
  const directory = separator <= 0 ? "/" : Str.slice(0, separator)(linkPath);
  return `${directory}/${target}`;
};

// =============================================================================
// entry resolution and removal
// =============================================================================

const resolveParent = Effect.fnUntraced(function* (
  state: State,
  path: string,
  method: string,
  errorPath: string = path
) {
  if (path.length === 0 || path === "/" || Str.endsWith("/")(path) || HasNullByte.is(path)) {
    return yield* badResource(method, errorPath);
  }
  const components = A.filter(Str.split("/")(path), (component) => component.length > 0);
  const name = components.pop();
  if (name === undefined) {
    return yield* badResource(method, errorPath);
  }
  yield* validateEntryName(method, name, errorPath);
  const parentPath =
    components.length === 0 ? "/" : `${Str.startsWith("/")(path) ? "/" : ""}${A.join(components, "/")}`;
  const parent = yield* resolve(state, parentPath, { method }).pipe(
    Effect.mapError((error) => withSystemErrorPath(error, method, errorPath))
  );
  if (!isDirectoryInode(parent.entry)) {
    return yield* badResource(method, errorPath);
  }
  return { inode: parent.inode, entry: parent.entry, name, path: parent.path } satisfies ResolvedParent;
});

const resolveEntry = Effect.fnUntraced(function* (state: State, path: string, method: string) {
  const parent = yield* resolveParent(state, path, method);
  const inode = yield* Effect.fromOption(findEntry(parent.entry, parent.name), () => notFound(method, path));
  return {
    parent: parent.entry,
    name: parent.name,
    entry: yield* getInode(state, inode, method, path),
    path: childPath(parent.path, parent.name),
  } satisfies ResolvedEntry;
});

const validateMode = Effect.fnUntraced(function* (method: string, mode: number | undefined) {
  return yield* mode === undefined || isModeOrOwner(mode)
    ? Effect.void
    : Effect.fail(argumentError(method, "mode must be an unsigned 32-bit integer"));
});

// PORT NOTE: `depth` bounds the recursion at MAX_NESTING_DEPTH, failing typed —
// upstream recursed unbounded.
const detachEntry: (
  state: State,
  target: ResolvedEntry,
  now: DateTime.Utc,
  recursive: boolean,
  method: string,
  path: string,
  depth?: number
) => Effect.Effect<State, PlatformError> = Effect.fnUntraced(function* (
  state,
  target,
  now,
  recursive,
  method,
  path,
  depth = 0
) {
  if (depth > MAX_NESTING_DEPTH) {
    return yield* badResource(method, path, "Directory tree exceeds the maximum nesting depth");
  }
  if (isDirectoryInode(target.entry) && HashMap.size(target.entry.entries) > 0 && !recursive) {
    return yield* badResource(method, path, "Directory is not empty");
  }
  let nextState = state;
  if (isDirectoryInode(target.entry)) {
    const children = A.sort([...target.entry.entries], localeEntryOrder);
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
    nlink: isDirectoryInode(entry) ? parent.nlink - 1 : parent.nlink,
  };
  const nextEntry = {
    ...entry,
    nlink: entry.nlink - (isDirectoryInode(entry) ? DIR_LINK_COUNT : 1),
  };
  return reclaimInode(touchNamespaceMutation(nextState, nextParent, nextEntry, now), nextEntry);
});

// =============================================================================
// directory operations
// =============================================================================

const createDirectoryEntry = Effect.fnUntraced(function* (
  state: State,
  candidate: string,
  path: string,
  mode: number | undefined
) {
  const method = "makeDirectory";
  const parent = yield* resolveParent(state, candidate, method, path);
  if (HashMap.has(parent.entry.entries, parent.name)) return yield* alreadyExists(method, path);
  let [nextState, inode] = yield* createDirectory(state);
  const entry = yield* getDirectory(nextState, inode, method, path);
  if (mode !== undefined) nextState = setInode(nextState, { ...entry, mode: DIR_TYPE_MODE | (mode & PERMISSION_MODE) });
  nextState = yield* attachDirectory(nextState, parent.inode, parent.name, inode, method).pipe(
    Effect.mapError((error) => withSystemErrorPath(error, method, path))
  );
  return transitionResult(nextState, false, [{ _tag: "Create", path: childPath(parent.path, parent.name) }]);
});

const makeDirectoryComponent = Effect.fnUntraced(function* (
  state: State,
  candidate: string,
  path: string,
  recursive: boolean,
  final: boolean,
  mode: number | undefined
) {
  const method = "makeDirectory";
  const existing = yield* Effect.result(resolve(state, candidate, { method }));
  if (Result.isSuccess(existing)) {
    if (!isDirectoryInode(existing.success.entry) || (final && !recursive)) {
      return yield* alreadyExists(method, path);
    }
    return transitionResult(state, final);
  }
  if (!recursive && !final) return yield* withSystemErrorPath(existing.failure, method, path);
  return yield* createDirectoryEntry(state, candidate, path, mode);
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
        let nextState = state;
        const recursive = options?.recursive === true;
        const pieces = A.filter(Str.split("/")(path), (piece) => piece.length > 0);
        if (pieces.length === 0 || HasNullByte.is(path)) return yield* badResource(method, path);
        const prefix = Str.startsWith("/")(path) ? "/" : "";
        const events: Array<FileSystem.WatchEvent> = [];
        for (let index = 0; index < pieces.length; index++) {
          const candidate = `${prefix}${A.join(A.take(pieces, index + 1), "/")}`;
          const result = yield* makeDirectoryComponent(
            nextState,
            candidate,
            path,
            recursive,
            index === pieces.length - 1,
            options?.mode
          );
          nextState = result.state;
          // An existing final directory historically returns without publishing
          // any earlier creation events; retain that transaction behavior.
          if (result.value) return transitionResult(nextState, undefined);
          events.push(...result.events);
        }
        return transitionResult(nextState, undefined, events);
      })
    );
  });

const link = (volume: Volume) =>
  Effect.fnUntraced(function* (fromPath: string, toPath: string) {
    const method = "link";
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const source = yield* resolve(state, fromPath, { method, followFinalSymbolicLink: false }).pipe(
          Effect.mapError((error) => withSystemErrorPath(error, method, fromPath))
        );
        const destination = yield* resolveParent(state, toPath, method);
        const nextState = yield* linkInode(state, destination.inode, destination.name, source.inode, method).pipe(
          Effect.mapError((error) => withSystemErrorPath(error, method, toPath))
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
        if (HasNullByte.is(target)) {
          return yield* argumentError(method, "target must not contain a null byte");
        }
        if (!isNonEmptyString(target)) return yield* notFound(method, target);
        const [createdState, inode] = yield* createSymbolicLink(state, target);
        const nextState = yield* linkInode(createdState, parent.inode, parent.name, inode, method).pipe(
          Effect.mapError((error) => withSystemErrorPath(error, method, path))
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
        const resolved = yield* resolve(state, path, {
          followFinalSymbolicLink: false,
          method: "readLink",
        });
        if (!isSymbolicLinkInode(resolved.entry)) {
          return yield* badResource("readLink", path);
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
    options?: {
      readonly recursive?: boolean | undefined;
      readonly force?: boolean | undefined;
    }
  ) {
    const method = "remove";
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const target = yield* Effect.result(resolveEntry(state, path, method));
        if (Result.isFailure(target)) {
          if (options?.force === true && target.failure.reason._tag === "NotFound") {
            return transitionResult(state, undefined);
          }
          return yield* target.failure;
        }
        const now = yield* DateTime.now;
        const nextState = yield* detachEntry(state, target.success, now, options?.recursive === true, method, path);
        return transitionResult(nextState, undefined, [
          {
            _tag: "Remove",
            path: target.success.path,
          },
        ]);
      })
    );
  });

// PORT NOTE: iterative worklist where upstream recursed — a pathological tree
// depth must never become a stack-overflow defect.
const enqueueChildDirectories = (state: State, directory: DirectoryInode, pending: Array<Inode>): void => {
  for (const inode of HashMap.values(directory.entries)) {
    if (O.exists(findInode(state, inode), isDirectoryInode)) pending.push(inode);
  }
};

// Iterative worklist; no recursion or symlink traversal is introduced.
const containsDirectory = (state: State, ancestor: Inode, candidate: Inode): boolean => {
  const pending: Array<Inode> = [ancestor];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (current === candidate) return true;
    const entry = O.filter(findInode(state, current), isDirectoryInode);
    O.map(entry, (directory) => enqueueChildDirectories(state, directory, pending));
  }
  return false;
};

const renameDestination = Effect.fnUntraced(function* (
  state: State,
  source: InodeEntry,
  parent: ResolvedParent,
  inode: Inode,
  path: string
) {
  const method = "rename";
  const entry = yield* getInode(state, inode, method, path);
  if (isDirectoryInode(source) && !isDirectoryInode(entry)) {
    return yield* badResource(method, path, "Cannot replace a non-directory with a directory");
  }
  if (!isDirectoryInode(source) && isDirectoryInode(entry)) {
    return yield* badResource(method, path, "Cannot replace a directory with a non-directory");
  }
  if (isDirectoryInode(entry) && HashMap.size(entry.entries) > 0) {
    return yield* badResource(method, path, "Directory is not empty");
  }
  return {
    parent: parent.entry,
    name: parent.name,
    entry,
    path: childPath(parent.path, parent.name),
  } satisfies ResolvedEntry;
});

const relocateEntry = Effect.fnUntraced(function* (
  state: State,
  source: ResolvedEntry,
  destination: ResolvedParent,
  oldPath: string,
  newPath: string,
  now: DateTime.Utc
) {
  const method = "rename";
  const sourceParent = yield* getDirectory(state, source.parent.ino, method, oldPath);
  const moved = yield* getInode(state, source.entry.ino, method, oldPath);
  let nextState = state;
  if (sourceParent.ino === destination.inode) {
    nextState = setInode(nextState, {
      ...sourceParent,
      entries: HashMap.set(HashMap.remove(sourceParent.entries, source.name), destination.name, moved.ino),
      mtime: now,
      ctime: now,
    });
  } else {
    const destinationParent = yield* getDirectory(nextState, destination.inode, method, newPath);
    nextState = setInode(nextState, {
      ...sourceParent,
      entries: HashMap.remove(sourceParent.entries, source.name),
      nlink: isDirectoryInode(moved) ? sourceParent.nlink - 1 : sourceParent.nlink,
      mtime: now,
      ctime: now,
    });
    nextState = setInode(nextState, {
      ...destinationParent,
      entries: HashMap.set(destinationParent.entries, destination.name, moved.ino),
      nlink: isDirectoryInode(moved) ? destinationParent.nlink + 1 : destinationParent.nlink,
      mtime: now,
      ctime: now,
    });
  }
  return setInode(nextState, { ...moved, ctime: now });
});

const rename = (volume: Volume) =>
  Effect.fnUntraced(function* (oldPath: string, newPath: string) {
    const method = "rename";
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const source = yield* resolveEntry(state, oldPath, method);
        const destinationParent = yield* resolveParent(state, newPath, method);
        if (source.parent.ino === destinationParent.inode && source.name === destinationParent.name) {
          return transitionResult(state, undefined);
        }
        if (isDirectoryInode(source.entry) && containsDirectory(state, source.entry.ino, destinationParent.inode)) {
          return yield* badResource(method, newPath, "Cannot move a directory into itself");
        }
        const destinationInode = findEntry(destinationParent.entry, destinationParent.name);
        if (O.contains(destinationInode, source.entry.ino)) return transitionResult(state, undefined);
        const destination = yield* O.match(destinationInode, {
          onNone: () => Effect.succeed(O.none<ResolvedEntry>()),
          onSome: (inode) => Effect.asSome(renameDestination(state, source.entry, destinationParent, inode, newPath)),
        });
        const now = yield* DateTime.now;
        const detachedState = yield* O.match(destination, {
          onNone: () => Effect.succeed(state),
          onSome: (entry) => detachEntry(state, entry, now, false, method, newPath),
        });
        const nextState = yield* relocateEntry(detachedState, source, destinationParent, oldPath, newPath, now);
        return transitionResult(nextState, undefined, [
          { _tag: "Remove", path: source.path },
          { _tag: "Create", path: childPath(destinationParent.path, destinationParent.name) },
        ]);
      })
    );
  });

// =============================================================================
// copy operations
// =============================================================================

// PORT NOTE: `depth` bounds the recursion at MAX_NESTING_DEPTH, failing typed —
// upstream recursed unbounded.
const cloneInode: (
  state: State,
  source: InodeEntry,
  context: CloneContext,
  depth?: number
) => Effect.Effect<readonly [State, Inode], PlatformError> = Effect.fnUntraced(function* (
  state,
  source,
  context,
  depth = 0
) {
  const { method, sourcePath: path, preserveTimestamps } = context;
  if (depth > MAX_NESTING_DEPTH) {
    return yield* badResource(method, path, "Directory tree exceeds the maximum nesting depth");
  }
  const applyMetadata = (state: State, entry: InodeEntry): State =>
    setInode(state, {
      ...entry,
      mode: source.mode,
      atime: preserveTimestamps && isFileInode(source) ? source.atime : entry.atime,
      mtime: preserveTimestamps ? source.mtime : entry.mtime,
    });
  return yield* InodeEntry.match(source, {
    File: Effect.fnUntraced(function* (source) {
      const [createdState, inode] = yield* createFile(state, source.data);
      const nextState = applyMetadata(createdState, yield* getInode(createdState, inode, method, path));
      return Tuple.make(nextState, inode);
    }),
    SymbolicLink: Effect.fnUntraced(function* (source) {
      const [createdState, inode] = yield* createSymbolicLink(state, source.target);
      const nextState = applyMetadata(createdState, yield* getInode(createdState, inode, method, path));
      return Tuple.make(nextState, inode);
    }),
    Directory: Effect.fnUntraced(function* (source) {
      let [nextState, inode] = yield* createDirectory(state);
      const children = A.sort([...source.entries], localeEntryOrder);
      for (const [name, childInode] of children) {
        const child = yield* getInode(nextState, childInode, method, path);
        const [clonedState, clone] = yield* cloneInode(nextState, child, context, depth + 1);
        nextState = clonedState;
        nextState = yield* attachClonedInode(nextState, inode, name, clone, child, method);
      }
      nextState = applyMetadata(nextState, yield* getDirectory(nextState, inode, method, path));
      return Tuple.make(nextState, inode);
    }),
  });
});

// PORT NOTE: `depth` bounds the recursion at MAX_NESTING_DEPTH, failing typed —
// upstream recursed unbounded.
const validateCopyConflict = Effect.fnUntraced(function* (
  state: State,
  source: InodeEntry,
  destination: InodeEntry,
  overwrite: boolean,
  method: string,
  path: string,
  depth: number
): Effect.fn.Return<void, PlatformError> {
  if (isDirectoryInode(source) && isDirectoryInode(destination)) {
    return yield* validateCopyDirectoryContents(state, source, destination, overwrite, method, path, depth + 1);
  }
  if (!overwrite) return yield* alreadyExists(method, path);
  if (isDirectoryInode(source) || isDirectoryInode(destination)) {
    return yield* badResource(method, path, "Cannot replace a directory with a non-directory");
  }
});

const validateCopyDirectoryContents: (
  state: State,
  source: DirectoryInode,
  destination: DirectoryInode,
  overwrite: boolean,
  method: string,
  path: string,
  depth?: number
) => Effect.Effect<void, PlatformError> = Effect.fnUntraced(function* (
  state,
  source,
  destination,
  overwrite,
  method,
  path,
  depth = 0
) {
  if (depth > MAX_NESTING_DEPTH) {
    return yield* badResource(method, path, "Directory tree exceeds the maximum nesting depth");
  }
  for (const [name, sourceInode] of source.entries) {
    const sourceEntry = yield* getInode(state, sourceInode, method, path);
    const destinationInode = findEntry(destination, name);
    if (O.isNone(destinationInode)) continue;
    const destinationEntry = yield* getInode(state, destinationInode.value, method, path);
    yield* validateCopyConflict(state, sourceEntry, destinationEntry, overwrite, method, path, depth);
  }
});

const attachClonedInode = Effect.fnUntraced(function* (
  state: State,
  parent: Inode,
  name: string,
  inode: Inode,
  source: InodeEntry,
  method: string
) {
  return yield* isDirectoryInode(source)
    ? attachDirectory(state, parent, name, inode, method)
    : linkInode(state, parent, name, inode, method);
});

// This child operation keeps detach-before-clone ordering for directory merges;
// top-level copy intentionally retains its distinct clone-before-detach order.
const copyDirectoryChild = Effect.fnUntraced(function* (
  state: State,
  source: InodeEntry,
  destination: DirectoryInode,
  name: string,
  context: CloneContext,
  depth: number
): Effect.fn.Return<State, PlatformError> {
  const { method, sourcePath: path, preserveTimestamps } = context;
  const destinationInode = findEntry(destination, name);
  if (isDirectoryInode(source) && O.isSome(destinationInode)) {
    const entry = yield* getInode(state, destinationInode.value, method, path);
    if (isDirectoryInode(entry)) {
      return yield* copyDirectoryContents(state, source, entry, method, path, preserveTimestamps, depth + 1);
    }
  }
  let nextState = state;
  if (O.isSome(destinationInode)) {
    const entry = yield* getInode(nextState, destinationInode.value, method, path);
    const now = yield* DateTime.now;
    nextState = yield* detachEntry(
      nextState,
      { parent: destination, name, entry, path: childPath(path, name) },
      now,
      false,
      method,
      path
    );
  }
  const [clonedState, clone] = yield* cloneInode(nextState, source, context);
  return yield* attachClonedInode(clonedState, destination.ino, name, clone, source, method);
});

// Depth is incremented only for a merge, as before; a fresh clone owns its own bound.
const copyDirectoryContents: (
  state: State,
  source: DirectoryInode,
  destination: DirectoryInode,
  method: string,
  path: string,
  preserveTimestamps: boolean,
  depth?: number
) => Effect.Effect<State, PlatformError> = Effect.fnUntraced(function* (
  state,
  source,
  destination,
  method,
  path,
  preserveTimestamps,
  depth = 0
) {
  if (depth > MAX_NESTING_DEPTH) {
    return yield* badResource(method, path, "Directory tree exceeds the maximum nesting depth");
  }
  let nextState = state;
  const context = { method, sourcePath: path, preserveTimestamps } satisfies CloneContext;
  for (const [name, sourceInode] of A.sort([...source.entries], localeEntryOrder)) {
    const sourceEntry = yield* getInode(nextState, sourceInode, method, path);
    const currentDestination = yield* getDirectory(nextState, destination.ino, method, path);
    nextState = yield* copyDirectoryChild(nextState, sourceEntry, currentDestination, name, context, depth);
  }
  return nextState;
});

const resolveMissingParent = Effect.fnUntraced(function* (
  state: State,
  candidate: string,
  error: PlatformError,
  method: string,
  path: string
) {
  if (error.reason._tag !== "NotFound") return yield* withSystemErrorPath(error, method, path);
  return yield* resolveParent(state, candidate, method, path);
});

const unresolvedLinkTarget = Effect.fnUntraced(function* (
  linkPath: string,
  target: string,
  error: PlatformError,
  method: string,
  path: string
) {
  if (error.reason._tag !== "NotFound" || target.length === 0) {
    return yield* withSystemErrorPath(error, method, path);
  }
  return symbolicLinkTargetPath(linkPath, target);
});

const resolveCopyFileDestination = Effect.fnUntraced(function* (state: State, path: string, method: string) {
  let candidate = path;
  while (true) {
    const unresolved = yield* Effect.result(resolve(state, candidate, { followFinalSymbolicLink: false, method }));
    if (Result.isFailure(unresolved)) {
      return yield* resolveMissingParent(state, candidate, unresolved.failure, method, path);
    }
    if (!isSymbolicLinkInode(unresolved.success.entry)) {
      return yield* resolveParent(state, unresolved.success.path, method, path);
    }
    const resolved = yield* Effect.result(resolve(state, candidate, { method }));
    if (Result.isSuccess(resolved)) return yield* resolveParent(state, resolved.success.path, method, path);
    candidate = yield* unresolvedLinkTarget(
      unresolved.success.path,
      unresolved.success.entry.target,
      resolved.failure,
      method,
      path
    );
  }
});

const copyFileUnlocked = Effect.fnUntraced(function* (state: State, fromPath: string, toPath: string) {
  const method = "copyFile";
  const source = yield* resolve(state, fromPath, { method }).pipe(
    Effect.mapError((error) => withSystemErrorPath(error, method, fromPath))
  );
  if (!isFileInode(source.entry)) {
    return yield* badResource(method, fromPath, "Source is not a file");
  }
  const sourceFile = source.entry;
  const destination = yield* resolveCopyFileDestination(state, toPath, method);
  const existingInode = findEntry(destination.entry, destination.name);
  if (O.contains(existingInode, source.inode)) return Tuple.make(state, false);

  if (O.isSome(existingInode)) {
    const existing = yield* getInode(state, existingInode.value, method, toPath);
    if (!isFileInode(existing)) {
      return yield* badResource(method, toPath, "Destination is a directory");
    }
    const data = yield* Effect.try({
      try: () => sourceFile.data.slice(),
      catch: () => badResource(method, toPath, "Unable to allocate file bytes"),
    });
    const now = yield* DateTime.now;
    return Tuple.make(
      setInode(state, {
        ...existing,
        data,
        mode: sourceFile.mode,
        mtime: now,
        ctime: now,
      }),
      true
    );
  }

  const [clonedState, inode] = yield* cloneInode(state, sourceFile, {
    method,
    sourcePath: fromPath,
    preserveTimestamps: false,
  });
  const nextState = yield* linkInode(clonedState, destination.inode, destination.name, inode, method);
  return Tuple.make(nextState, true);
});

const existingCopyTarget = Effect.fnUntraced(function* (
  state: State,
  destination: ResolvedParent,
  fromPath: string,
  toPath: string,
  overwrite: boolean
) {
  const inode = findEntry(destination.entry, destination.name);
  if (O.isNone(inode)) return O.none<InodeEntry>();
  // Preserve rc.112 conformance: overwrite-disabled conflicts name the source.
  if (!overwrite) return yield* alreadyExists("copy", fromPath);
  return O.some(yield* getInode(state, inode.value, "copy", toPath));
});

const mergeCopyDirectory = Effect.fnUntraced(function* (
  state: State,
  source: DirectoryInode,
  destination: InodeEntry,
  path: string,
  overwrite: boolean,
  preserveTimestamps: boolean
) {
  if (!isDirectoryInode(destination)) return yield* badResource("copy", path, "Destination is not a directory");
  yield* validateCopyDirectoryContents(state, source, destination, overwrite, "copy", path);
  return yield* copyDirectoryContents(state, source, destination, "copy", path, preserveTimestamps);
});

const copyClonedEntry = Effect.fnUntraced(function* (
  state: State,
  source: InodeEntry,
  destination: ResolvedParent,
  existing: O.Option<InodeEntry>,
  context: CloneContext,
  toPath: string
) {
  const { method } = context;
  let [nextState, inode] = yield* cloneInode(state, source, context);
  const entry = yield* getInode(nextState, inode, method, toPath);
  const now = yield* DateTime.now;
  if (O.isSome(existing)) {
    nextState = yield* detachEntry(
      nextState,
      {
        parent: destination.entry,
        name: destination.name,
        entry: existing.value,
        path: childPath(destination.path, destination.name),
      },
      now,
      true,
      method,
      toPath
    );
  }
  return yield* attachClonedInode(nextState, destination.inode, destination.name, inode, entry, method);
});

const copyEntryUnlocked = Effect.fnUntraced(function* (
  state: State,
  fromPath: string,
  toPath: string,
  overwrite: boolean,
  preserveTimestamps: boolean
) {
  const method = "copy";
  const source = yield* resolve(state, fromPath, { followFinalSymbolicLink: false, method }).pipe(
    Effect.mapError((error) => withSystemErrorPath(error, method, fromPath))
  );
  const destination = yield* resolveParent(state, toPath, method);
  if (isDirectoryInode(source.entry) && containsDirectory(state, source.inode, destination.inode)) {
    return yield* badResource(method, toPath, "Cannot copy a directory into itself");
  }
  const existing = yield* existingCopyTarget(state, destination, fromPath, toPath, overwrite);
  if (O.exists(existing, (entry) => entry.ino === source.inode)) {
    return isDirectoryInode(source.entry)
      ? yield* badResource(method, toPath, "Cannot copy a directory onto itself")
      : Tuple.make(state, false);
  }
  if (isDirectoryInode(source.entry) && O.isSome(existing)) {
    return Tuple.make(
      yield* mergeCopyDirectory(state, source.entry, existing.value, toPath, overwrite, preserveTimestamps),
      true
    );
  }
  if (O.exists(existing, isDirectoryInode)) return yield* badResource(method, toPath, "Destination is a directory");
  const nextState = yield* copyClonedEntry(
    state,
    source.entry,
    destination,
    existing,
    { method, sourcePath: fromPath, preserveTimestamps },
    toPath
  );
  return Tuple.make(nextState, true);
});

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
          Result.isSuccess(existing)
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
    options?: {
      readonly overwrite?: boolean | undefined;
      readonly preserveTimestamps?: boolean | undefined;
    }
  ) {
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const existing = yield* Effect.result(
          resolve(state, toPath, {
            followFinalSymbolicLink: false,
            method: "copy",
          })
        );
        const [nextState, changed] = yield* copyEntryUnlocked(
          state,
          fromPath,
          toPath,
          options?.overwrite === true,
          options?.preserveTimestamps === true
        );
        if (!changed) return transitionResult(nextState, undefined);
        const destination = yield* resolve(nextState, toPath, {
          followFinalSymbolicLink: false,
          method: "copy",
        });
        return transitionResult(nextState, undefined, [
          {
            _tag: Result.isSuccess(existing) ? "Update" : "Create",
            path: destination.path,
          },
        ]);
      })
    );
  });

// =============================================================================
// open file descriptors
// =============================================================================

const OpenTarget = S.TaggedUnion({
  Retry: { path: S.String },
  Ready: { entry: InodeEntry.cases.File },
}).annotate(
  $I.annote("OpenTarget", {
    description: "One open-path resolution step: continue at a dangling target or allocate a descriptor for a file.",
  })
);
type OpenTarget = typeof OpenTarget.Type;
const isReadyOpenTarget = OpenTarget.isAnyOf(["Ready"]);

const getAllocatedFile = Effect.fnUntraced(function* (state: State, inode: Inode, path: string, operation: string) {
  const entry = yield* getInode(state, inode, "open", path);
  if (!isFileInode(entry)) {
    return yield* Effect.die(
      MemoryFileSystemInvariantError.make({
        message: `MemoryFileSystem.${operation} produced a non-file inode`,
      })
    );
  }
  return entry;
});

const truncateOpenTarget = Effect.fnUntraced(function* (state: State, entry: FileInode, truncate: boolean) {
  if (!truncate) return Tuple.make(state, entry);
  const now = yield* DateTime.now;
  const nextEntry = { ...entry, data: new Uint8Array(), mtime: now, ctime: now };
  return Tuple.make(setInode(state, nextEntry), nextEntry);
});

const openExistingTarget = Effect.fnUntraced(function* (
  state: State,
  unresolved: ResolvedInode,
  candidate: string,
  path: string,
  mode: OpenMode
): Effect.fn.Return<readonly [State, OpenTarget], PlatformError> {
  if (mode.exclusive) return yield* alreadyExists("open", path);
  const resolved = yield* Effect.result(resolve(state, candidate, { method: "open" }));
  if (Result.isFailure(resolved)) {
    if (!isSymbolicLinkInode(unresolved.entry) || !mode.create) {
      return yield* withSystemErrorPath(resolved.failure, "open", path);
    }
    const target = yield* unresolvedLinkTarget(
      unresolved.path,
      unresolved.entry.target,
      resolved.failure,
      "open",
      path
    );
    return Tuple.make(state, { _tag: "Retry", path: target });
  }
  if (!isFileInode(resolved.success.entry)) return yield* badResource("open", path);
  const [nextState, entry] = yield* truncateOpenTarget(state, resolved.success.entry, mode.truncate);
  return Tuple.make(nextState, { _tag: "Ready", entry });
});

const linkOpenTarget = Effect.fnUntraced(function* (
  state: State,
  created: FileInode,
  parent: ResolvedParent,
  candidate: string,
  path: string,
  mode: OpenMode
): Effect.fn.Return<readonly [State, OpenTarget], PlatformError> {
  const linked = yield* Effect.result(linkInode(state, parent.inode, parent.name, created.ino, "open"));
  if (Result.isFailure(linked)) {
    const nextState = reclaimInode(state, created);
    if (linked.failure.reason._tag === "AlreadyExists" && !mode.exclusive) {
      return Tuple.make(nextState, { _tag: "Retry", path: candidate });
    }
    return yield* linked.failure;
  }
  const entry = yield* getAllocatedFile(linked.success, created.ino, path, "linkInode");
  return Tuple.make(linked.success, { _tag: "Ready", entry });
});

const createOpenTarget = Effect.fnUntraced(function* (
  state: State,
  candidate: string,
  path: string,
  mode: OpenMode,
  permissions: number | undefined
): Effect.fn.Return<readonly [State, OpenTarget], PlatformError> {
  const parent = yield* resolveParent(state, candidate, "open", path);
  if (HashMap.has(parent.entry.entries, parent.name)) {
    return Tuple.make(state, { _tag: "Retry", path: candidate });
  }
  let [nextState, inode] = yield* createFile(state);
  let created = yield* getAllocatedFile(nextState, inode, path, "createFile");
  if (permissions !== undefined) {
    created = { ...created, mode: FILE_TYPE_MODE | (permissions & PERMISSION_MODE) };
    nextState = setInode(nextState, created);
  }
  return yield* linkOpenTarget(nextState, created, parent, candidate, path, mode);
});

const selectOpenTarget = Effect.fnUntraced(function* (
  state: State,
  candidate: string,
  path: string,
  mode: OpenMode,
  permissions: number | undefined
): Effect.fn.Return<readonly [State, OpenTarget], PlatformError> {
  const unresolved = yield* Effect.result(
    resolve(state, candidate, { followFinalSymbolicLink: false, method: "open" })
  );
  if (Result.isSuccess(unresolved)) return yield* openExistingTarget(state, unresolved.success, candidate, path, mode);
  if (unresolved.failure.reason._tag !== "NotFound" || !mode.create) {
    return yield* withSystemErrorPath(unresolved.failure, "open", path);
  }
  return yield* createOpenTarget(state, candidate, path, mode, permissions);
});

const allocateDescriptor = (state: State, entry: FileInode, mode: OpenMode): readonly [State, OpenFileDescriptor] => {
  const fd = FileDescriptor.make(state.nextDescriptor);
  const descriptor: OpenFileDescriptor = {
    fd,
    inode: entry.ino,
    readable: mode.readable,
    writable: mode.writable,
    append: mode.append,
    position: BigInt(0),
  };
  return Tuple.make(
    {
      ...state,
      nextDescriptor: state.nextDescriptor + 1,
      descriptors: HashMap.set(state.descriptors, fd, descriptor),
      inodes: HashMap.set(state.inodes, entry.ino, { ...entry, openCount: entry.openCount + 1 }),
    },
    descriptor
  );
};

const openDescriptorUnlocked: (
  state: State,
  path: string,
  options?: OpenOptions
) => Effect.Effect<readonly [State, OpenFileDescriptor], PlatformError> = Effect.fnUntraced(
  function* (state, path, options) {
    const flag = options?.flag ?? "r";
    if (!isOpenFlag(flag)) return yield* argumentError("open", "flag must be a supported file-open flag");
    const mode = openMode(flag);
    yield* validateMode("open", options?.mode);
    let nextState = state;
    let candidate = path;
    while (true) {
      const [selectedState, target] = yield* selectOpenTarget(nextState, candidate, path, mode, options?.mode);
      nextState = selectedState;
      if (isReadyOpenTarget(target)) return allocateDescriptor(nextState, target.entry, mode);
      candidate = target.path;
    }
  }
);

const openDescriptor: (
  volume: Volume,
  path: string,
  options?: OpenOptions
) => Effect.Effect<FileDescriptor, PlatformError> = Effect.fnUntraced(function* (volume, path, options) {
  return yield* volume.mutate(
    Effect.fnUntraced(function* (state) {
      const existing = yield* Effect.result(resolve(state, path, { method: "open" }));
      const [nextState, descriptor] = yield* openDescriptorUnlocked(state, path, options);
      const mode = openMode(options?.flag ?? "r");
      const tag = Result.isFailure(existing) ? "Create" : mode.truncate ? "Update" : undefined;
      if (tag === undefined) return transitionResult(nextState, descriptor.fd);
      const resolved = yield* resolve(nextState, path, { method: "open" });
      return transitionResult(
        nextState,
        descriptor.fd,
        tag === "Update"
          ? inodeUpdateEvents(nextState, descriptor.inode)
          : [
              {
                _tag: "Create",
                path: resolved.path,
              },
            ]
      );
    })
  );
});

const closeDescriptorUnlocked = (state: State, fd: FileDescriptor): State => {
  const descriptorOption = HashMap.get(state.descriptors, fd);
  if (O.isNone(descriptorOption)) return state;
  const descriptor = descriptorOption.value;
  let nextState = {
    ...state,
    descriptors: HashMap.remove(state.descriptors, fd),
  };
  const entryOption = findInode(nextState, descriptor.inode);
  if (O.isNone(entryOption)) return nextState;
  const entry = entryOption.value;
  const nextEntry = { ...entry, openCount: entry.openCount - 1 };
  nextState = setInode(nextState, nextEntry);
  return reclaimInode(nextState, nextEntry);
};

const fileInfo = (entry: InodeEntry): FileSystem.File.Info => ({
  type: entry._tag,
  mtime: entry.mtime.pipe(DateTime.toDateUtc, O.some),
  atime: entry.atime.pipe(DateTime.toDateUtc, O.some),
  birthtime: entry.birthtime.pipe(DateTime.toDateUtc, O.some),
  dev: 0,
  ino: O.some(entry.ino),
  mode: entry.mode,
  nlink: O.some(entry.nlink),
  uid: O.some(entry.uid),
  gid: O.some(entry.gid),
  rdev: O.some(0),
  size: ByteSize.bytes(
    isFileInode(entry)
      ? entry.data.length
      : isSymbolicLinkInode(entry)
        ? new TextEncoder().encode(entry.target).length
        : 0
  ),
  blksize: O.none(),
  blocks: O.none(),
});

const readDescriptorUnlocked = Effect.fnUntraced(function* (
  state: State,
  fd: FileDescriptor,
  length: number,
  method: string
) {
  const [descriptor, entry] = yield* getOpenFile(state, fd, method, "readable");
  if (length === 0) {
    return {
      state,
      bytes: entry.data.subarray(0, 0),
      size: 0,
    };
  }
  const position = Number(descriptor.position);
  if (!isSafeSize(position)) {
    return yield* descriptorError(fd, method, "Invalid file position");
  }
  const now = yield* DateTime.now;
  const bytesRead = Num.min(length, Num.max(0, entry.data.length - position));
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
});

const readDescriptor = Effect.fnUntraced(function* (
  volume: Volume,
  fd: FileDescriptor,
  buffer: Uint8Array,
  method: string
) {
  return yield* volume.mutate((state) =>
    Effect.map(readDescriptorUnlocked(state, fd, buffer.length, method), (result) => {
      buffer.set(result.bytes);
      return transitionResult(result.state, result.size);
    })
  );
});

const writeDescriptorUnlocked = Effect.fnUntraced(function* (
  state: State,
  fd: FileDescriptor,
  buffer: Uint8Array,
  method: string
) {
  const [descriptor, entry] = yield* getOpenFile(state, fd, method, "writable");
  if (buffer.length === 0) {
    return Tuple.make(state, 0);
  }
  const position = descriptor.append ? entry.data.length : Number(descriptor.position);
  if (!isSafeSize(position)) {
    return yield* descriptorError(fd, method, "Invalid file position");
  }
  const length = position + buffer.length;
  if (!isInt(length)) {
    return yield* descriptorError(fd, method, "File is too large");
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
  return Tuple.make(nextState, buffer.length);
});

const writeDescriptor = Effect.fnUntraced(function* (
  volume: Volume,
  fd: FileDescriptor,
  buffer: Uint8Array,
  method: string
) {
  return yield* volume.mutate(
    Effect.fnUntraced(function* (state) {
      const [nextState, written] = yield* writeDescriptorUnlocked(state, fd, buffer, method);
      if (written === 0) return transitionResult(nextState, written);
      const descriptor = HashMap.get(nextState.descriptors, fd);
      return transitionResult(
        nextState,
        written,
        O.isNone(descriptor) ? [] : inodeUpdateEvents(nextState, descriptor.value.inode)
      );
    })
  );
});

// =============================================================================
// file handles
// =============================================================================

class MemoryFile implements FileSystem.File {
  readonly [FileSystem.FileTypeId]: typeof FileSystem.FileTypeId = FileSystem.FileTypeId;
  readonly fd: FileDescriptor;
  private readonly volume: Volume;
  private closedPosition: bigint = BigInt(0);

  constructor(volume: Volume, fd: FileDescriptor) {
    this.volume = volume;
    this.fd = fd;
  }

  // Seek retains a handle-local cursor after close and rejects negative positions.
  // Snapshot under the same permit as descriptor removal, without retaining the
  // descriptor/inode. Repeated close cannot reset that cursor or decrement twice.
  get close(): Effect.Effect<void> {
    return this.volume.mutate((state) =>
      Effect.sync(() => {
        const descriptor = HashMap.get(state.descriptors, this.fd);
        if (O.isSome(descriptor)) this.closedPosition = descriptor.value.position;
        return transitionResult(closeDescriptorUnlocked(state, this.fd), undefined);
      })
    );
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
        const descriptorOption = HashMap.get(state.descriptors, this.fd);
        const currentPosition = O.isSome(descriptorOption) ? descriptorOption.value.position : this.closedPosition;
        const position = from === "start" ? offset : currentPosition + offset;
        if (position < BigInt(0)) {
          return Effect.fail(argumentError("seek", "Cannot seek before the start of the file"));
        }
        if (O.isNone(descriptorOption)) {
          this.closedPosition = position;
          return Effect.succeed(transitionResult(state, position));
        }
        const descriptor = descriptorOption.value;
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
    const length = Number(size);
    if (!isSafeSize(length)) {
      return Effect.fail(argumentError("readAlloc", "size must be a non-negative safe integer"));
    }
    return Effect.flatMap(allocateBytes(length, this.fd, "readAlloc"), (buffer) =>
      Effect.map(readDescriptor(this.volume, this.fd, buffer, "readAlloc"), (bytesRead) =>
        bytesRead === 0 ? O.none() : O.some(bytesRead === length ? buffer : buffer.slice(0, bytesRead))
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
                ? HashMap.set(state.descriptors, fd, {
                    ...descriptor,
                    position: BigInt(size),
                  })
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
  Effect.acquireRelease(
    Effect.map(openDescriptor(volume, path, options), (fd) => new MemoryFile(volume, fd)),
    (file) => file.close
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
// pre-order, per-directory-sorted output order exactly.
const collectDirectoryEntries = (
  state: State,
  directory: DirectoryInode,
  recursive: boolean,
  prefix = ""
): Array<string> => {
  const output: Array<string> = [];

  interface Frame {
    readonly directory: DirectoryInode;
    index: number;
    readonly names: Array<string>;
    readonly prefix: string;
  }

  const directoryFrame = (directory: DirectoryInode, prefix: string): Frame => ({
    names: A.sort([...HashMap.keys(directory.entries)], Order.String),
    directory,
    prefix,
    index: 0,
  });
  const frames: Array<Frame> = [directoryFrame(directory, prefix)];
  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (frame.index >= frame.names.length) {
      frames.pop();
      continue;
    }
    const name = frame.names[frame.index];
    frame.index += 1;
    const relativePath = frame.prefix.length === 0 ? name : `${frame.prefix}/${name}`;
    output.push(relativePath);
    if (!recursive) continue;
    const childOption = O.filter(
      O.flatMap(findEntry(frame.directory, name), (inode) => findInode(state, inode)),
      isDirectoryInode
    );
    O.map(childOption, (child) => frames.push(directoryFrame(child, relativePath)));
  }
  return output;
};

const readDirectory = (volume: Volume) =>
  Effect.fnUntraced(function* (
    path: string,
    options?: {
      readonly recursive?: boolean | undefined;
    }
  ) {
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { method: "readDirectory" });
        if (!isDirectoryInode(resolved.entry)) {
          return yield* badResource("readDirectory", path);
        }
        const nextState = setInode(state, {
          ...resolved.entry,
          atime: yield* DateTime.now,
        });
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
        if (!isFileInode(resolved.entry)) {
          return yield* badResource("readFile", path);
        }
        const nextState = setInode(state, {
          ...resolved.entry,
          atime: yield* DateTime.now,
        });
        return transitionResult(nextState, resolved.entry.data.slice());
      })
    );
  });

const fileMutationEvents = Effect.fnUntraced(function* (
  state: State,
  existed: boolean,
  changed: boolean,
  path: string
): Effect.fn.Return<ReadonlyArray<FileSystem.WatchEvent>, PlatformError> {
  if (existed && !changed) return [];
  const resolved = yield* resolve(state, path, { method: "writeFile" });
  return existed ? inodeUpdateEvents(state, resolved.inode) : [{ _tag: "Create", path: resolved.path }];
});

const writeFile =
  (volume: Volume) =>
  (
    path: string,
    data: Uint8Array,
    options?: {
      readonly flag?: FileSystem.OpenFlag | undefined;
      readonly mode?: number | undefined;
    }
  ): Effect.Effect<void, PlatformError> =>
    volume
      .mutate(
        Effect.fnUntraced(function* (state) {
          const existing = yield* Effect.result(resolve(state, path, { method: "writeFile" }));
          let [nextState, descriptor] = yield* openDescriptorUnlocked(state, path, {
            flag: options?.flag ?? "w",
            mode: options?.mode,
          });
          const [writtenState] = yield* writeDescriptorUnlocked(nextState, descriptor.fd, data, "writeAll");
          nextState = writtenState;
          nextState = closeDescriptorUnlocked(nextState, descriptor.fd);
          const mode = openMode(options?.flag ?? "w");
          const events = yield* fileMutationEvents(
            nextState,
            Result.isSuccess(existing),
            mode.truncate || data.length > 0,
            path
          );
          return transitionResult(nextState, undefined, events);
        })
      )
      .pipe(Effect.mapError((error) => withOperationError(error, "writeFile", path)));

const validateSize = Effect.fnUntraced(function* (method: string, size: number | undefined) {
  const value = Number(size ?? 0);
  return yield* isSafeSize(value)
    ? Effect.succeed(value)
    : Effect.fail(argumentError(method, "size must be a non-negative safe integer"));
});

const allocatePathBytes = Effect.fnUntraced(function* (length: number, method: string, path: string) {
  return yield* Effect.try({
    try: () => new Uint8Array(length),
    catch: () => badResource(method, path, "Unable to allocate file bytes"),
  });
});

const truncate = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string, length?: number) {
    const size = yield* validateSize("truncate", length);
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { method: "truncate" });
        if (!isFileInode(resolved.entry)) {
          return yield* badResource("truncate", path);
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

const validateOwner = Effect.fnUntraced(function* (method: string, name: string, value: number) {
  return yield* isModeOrOwner(value)
    ? Effect.void
    : Effect.fail(argumentError(method, `${name} must be an unsigned 32-bit integer`));
});

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

const dateTimeInput = Effect.fnUntraced(function* (method: string, name: string, value: Date | number) {
  const milliseconds = P.isNumber(value) ? value * 1000 : value.getTime();
  if (!isFinite(milliseconds)) {
    return yield* argumentError(method, `${name} must be a valid Date or epoch-seconds number`);
  }
  const parsed = DateTime.make(milliseconds);
  return yield* Effect.fromOption(parsed, () => argumentError(method, `${name} is outside the supported date range`));
});

const utimes = (volume: Volume) =>
  Effect.fnUntraced(function* (path: string, atime: Date | number, mtime: Date | number) {
    const accessTime = yield* dateTimeInput("utimes", "atime", atime);
    const modificationTime = yield* dateTimeInput("utimes", "mtime", mtime);
    return yield* volume.mutate(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, path, { method: "utimes" });
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

const validateTemporaryFragment = Effect.fnUntraced(function* (method: string, name: string, value: string) {
  return yield* !isTemporaryFragment(value)
    ? Effect.fail(argumentError(method, `${name} must be a file-name fragment`))
    : Effect.void;
});

const allocateTemporaryToken = (state: State): readonly [State, string] => [
  { ...state, nextTemporary: state.nextTemporary + 1 },
  Str.padStart(8, "0")(state.nextTemporary.toString(36)),
];

const allocateTempDirectory = Effect.fnUntraced(function* (
  state: State,
  method: string,
  parentPath: string,
  prefix: string
) {
  const parent = yield* resolve(state, parentPath, { method });
  if (!isDirectoryInode(parent.entry)) {
    return yield* badResource(method, parentPath);
  }
  let nextState = state;
  while (true) {
    const [allocatedState, token] = allocateTemporaryToken(nextState);
    nextState = allocatedState;
    const name = `${prefix}${token}`;
    const currentParent = yield* getDirectory(nextState, parent.inode, method, parentPath);
    if (HashMap.has(currentParent.entries, name)) continue;
    const [createdState, inode] = yield* createDirectory(nextState);
    nextState = createdState;
    nextState = yield* attachDirectory(nextState, parent.inode, name, inode, method);
    return Tuple.make(nextState, {
      inode,
      path: childPath(parent.path, name),
    });
  }
});

const makeTempDirectoryWithMethod = Effect.fnUntraced(function* (
  volume: Volume,
  method: string,
  options?: {
    readonly directory?: string | undefined;
    readonly prefix?: string | undefined;
  }
) {
  const prefix = options?.prefix ?? "";
  yield* validateTemporaryFragment(method, "prefix", prefix);
  return yield* volume.mutate((state) =>
    Effect.map(allocateTempDirectory(state, method, options?.directory ?? TEMP_DIR, prefix), ([nextState, directory]) =>
      transitionResult(nextState, directory.path, [
        {
          _tag: "Create",
          path: directory.path,
        },
      ])
    )
  );
});

const makeTempDirectory =
  (volume: Volume) => (options?: { readonly directory?: string | undefined; readonly prefix?: string | undefined }) =>
    makeTempDirectoryWithMethod(volume, "makeTempDirectory", options);

const makeTempDirectoryScoped =
  (volume: Volume) => (options?: { readonly directory?: string | undefined; readonly prefix?: string | undefined }) =>
    Effect.acquireRelease(makeTempDirectoryWithMethod(volume, "makeTempDirectoryScoped", options), (path) =>
      Effect.orDie(remove(volume)(path, { recursive: true, force: true }))
    );

const makeTempFileWithMethod = Effect.fnUntraced(function* (
  volume: Volume,
  method: string,
  options?: {
    readonly directory?: string | undefined;
    readonly prefix?: string | undefined;
    readonly suffix?: string | undefined;
  }
) {
  const prefix = options?.prefix ?? "";
  const suffix = options?.suffix ?? "";
  yield* validateTemporaryFragment(method, "prefix", prefix);
  yield* validateTemporaryFragment(method, "suffix", suffix);
  return yield* volume.mutateInterruptibly(
    Effect.fnUntraced(
      function* (state) {
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
        return transitionResult(nextState, path, [
          { _tag: "Create", path: directory.path },
          { _tag: "Create", path },
        ]);
      },
      Effect.mapError((error) => withOperationError(error, method, options?.directory ?? TEMP_DIR))
    )
  );
});

const makeTempFile =
  (volume: Volume) =>
  (options?: {
    readonly directory?: string | undefined;
    readonly prefix?: string | undefined;
    readonly suffix?: string | undefined;
  }) =>
    makeTempFileWithMethod(volume, "makeTempFile", options);

const makeTempFileScoped =
  (volume: Volume) =>
  (options?: {
    readonly directory?: string | undefined;
    readonly prefix?: string | undefined;
    readonly suffix?: string | undefined;
  }) =>
    Effect.acquireRelease(makeTempFileWithMethod(volume, "makeTempFileScoped", options), (path) => {
      const separator = O.getOrElse(Str.lastIndexOf("/")(path), () => -1);
      const directory = separator <= 0 ? "/" : Str.slice(0, separator)(path);
      return Effect.orDie(
        remove(volume)(directory, {
          recursive: true,
          force: true,
        })
      );
    });

// =============================================================================
// globbing
// =============================================================================

const MAX_BRACE_EXPANSIONS = 256;

const GlobToken = S.TaggedUnion({
  Literal: { value: S.String },
  Star: {},
  One: {},
  CharacterClass: {
    negated: S.Boolean,
    ranges: S.Array(S.Tuple([S.String, S.String])),
    literals: S.Array(S.String),
  },
}).annotate(
  $I.annote("GlobToken", {
    description: "Literal, wildcard or character-class token in the portable virtual-filesystem glob parser.",
  })
);
type GlobToken = typeof GlobToken.Type;

const CompiledGlobSegment = S.TaggedUnion({
  Segment: { tokens: S.Array(GlobToken), startsWithDot: S.Boolean },
  Globstar: {},
}).annotate(
  $I.annote("CompiledGlobSegment", {
    description: "A compiled single path component or recursive globstar.",
  })
);
type CompiledGlobSegment = typeof CompiledGlobSegment.Type;
type GlobSegment = typeof CompiledGlobSegment.cases.Segment.Type;
type GlobGlobstar = typeof CompiledGlobSegment.cases.Globstar.Type;

class CompiledGlobPattern extends S.Class<CompiledGlobPattern>($I`CompiledGlobPattern`)(
  {
    segments: S.Array(CompiledGlobSegment),
    directoryOnly: S.Boolean,
  },
  $I.annote("CompiledGlobPattern", {
    description: "Compiled root-relative path segments and trailing-slash directory restriction.",
  })
) {}

class BraceExpansion extends S.Class<BraceExpansion>($I`BraceExpansion`)(
  {
    start: S.Finite,
    end: S.Finite,
    alternatives: S.Array(S.String),
  },
  $I.annote("BraceExpansion", {
    description: "Code-unit span and alternatives for the next brace substitution.",
  })
) {}

class GlobCharacterClassAtom extends S.Class<GlobCharacterClassAtom>($I`GlobCharacterClassAtom`)(
  {
    value: S.String,
    escaped: S.Boolean,
  },
  $I.annote("GlobCharacterClassAtom", {
    description: "One parsed character with its escape status, preserving literal versus range hyphens.",
  })
) {}

const globSyntaxCharacters = HashSet.make("*", "?", "[", "]", "{", "}", ",", "\\");
// Code-unit scanner shared by brace discovery and its nesting pre-scan.
// An escape consumes exactly the following code unit, including at end of input.
const unescapedCharacters = function* (pattern: string, start = 0): Iterable<readonly [number, string]> {
  for (let index = start; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === "\\") index += 1;
    else yield Tuple.make(index, character);
  }
};

const outsideCharacterClasses = function* (pattern: string, start = 0): Iterable<readonly [number, string]> {
  let characterClass = false;
  for (const [index, character] of unescapedCharacters(pattern, start)) {
    if (character === "[") {
      characterClass = true;
      continue;
    }
    if (character === "]") {
      characterClass = false;
      continue;
    }
    if (!characterClass) yield Tuple.make(index, character);
  }
};

const braceDepthChange = Match.type<string>().pipe(
  Match.when("{", () => 1),
  Match.when("}", () => -1),
  Match.orElse(() => 0)
);

class BraceGroup extends S.Class<BraceGroup>($I`BraceGroup`)(
  { end: S.Finite, commas: S.Array(S.Finite) },
  $I.annote("BraceGroup", { description: "Closing code-unit offset and top-level commas of a balanced brace group." })
) {}

const scanBraceGroup = (pattern: string, start: number): O.Option<BraceGroup> => {
  let depth = 1;
  const commas: Array<number> = [];
  for (const [end, character] of outsideCharacterClasses(pattern, start + 1)) {
    depth += braceDepthChange(character);
    if (depth === 0) return O.some({ end, commas });
    if (character === "," && depth === 1) commas.push(end);
  }
  return O.none();
};

const expandBraceGroup = (pattern: string, start: number, group: BraceGroup): O.Option<BraceExpansion> => {
  const { end, commas } = group;
  if (commas.length === 0) {
    return O.map(findBraceExpansion(Str.slice(start + 1, end)(pattern)), (nested) => ({
      start: start + nested.start + 1,
      end: start + nested.end + 1,
      alternatives: nested.alternatives,
    }));
  }
  const alternatives: Array<string> = [];
  let alternativeStart = start + 1;
  for (const comma of [...commas, end]) {
    alternatives.push(Str.slice(alternativeStart, comma)(pattern));
    alternativeStart = comma + 1;
  }
  return O.some({ start, end, alternatives });
};

const findBraceExpansion = (pattern: string): O.Option<BraceExpansion> => {
  let index = 0;
  while (index < pattern.length) {
    // The outer scan historically does not skip character classes; only the
    // contents of a selected brace group do. Preserve that distinction.
    const opening = A.findFirst(unescapedCharacters(pattern, index), ([, character]) => character === "{");
    if (O.isNone(opening)) return O.none();
    const start = opening.value[0];
    const group = scanBraceGroup(pattern, start);
    if (O.isNone(group)) return O.none();
    const expansion = expandBraceGroup(pattern, start, group.value);
    if (O.isSome(expansion)) return expansion;
    index = group.value.end + 1;
  }
  return O.none();
};

// Alternatives never deepen nesting, so one up-front scan bounds all later
// recursive searches through comma-free groups.
const braceNestingDepth = (pattern: string): number => {
  let depth = 0;
  let maximum = 0;
  for (const [, character] of outsideCharacterClasses(pattern)) {
    depth = Num.max(0, depth + braceDepthChange(character));
    maximum = Num.max(maximum, depth);
  }
  return maximum;
};

const expandBraces = Effect.fnUntraced(function* (method: string, pattern: string) {
  if (braceNestingDepth(pattern) > MAX_NESTING_DEPTH) {
    return yield* argumentError(method, `brace nesting exceeds ${MAX_NESTING_DEPTH} levels`);
  }
  let patterns = [pattern];
  while (true) {
    const found = A.findFirstIndex(patterns, (pattern) => O.isSome(findBraceExpansion(pattern)));
    if (O.isNone(found)) return yield* Effect.succeed(patterns);
    const index = found.value;
    const current = patterns[index];
    const expansionOption = findBraceExpansion(current);
    if (O.isNone(expansionOption)) return yield* Effect.succeed(patterns);
    const expansion = expansionOption.value;
    if (patterns.length - 1 + expansion.alternatives.length > MAX_BRACE_EXPANSIONS) {
      return yield* argumentError(method, `brace expansion exceeds ${MAX_BRACE_EXPANSIONS} alternatives`);
    }
    patterns = [
      ...A.take(patterns, index),
      ...A.map(
        expansion.alternatives,
        (alternative) =>
          `${Str.slice(0, expansion.start)(current)}${alternative}${Str.slice(expansion.end + 1)(current)}`
      ),
      ...A.drop(patterns, index + 1),
    ];
  }
});

const readCharacterClassAtom = Effect.fnUntraced(function* (method: string, segment: string, index: number) {
  const escaped = segment[index] === "\\";
  const position = escaped ? index + 1 : index;
  if (position === segment.length) return yield* argumentError(method, "character classes must not end with an escape");
  return Tuple.make({ value: segment[position], escaped } satisfies GlobCharacterClassAtom, position + 1);
});

const readCharacterClassAtoms = Effect.fnUntraced(function* (method: string, segment: string, start: number) {
  let index = start;
  const characters: Array<GlobCharacterClassAtom> = [];
  while (index < segment.length) {
    if (segment[index] === "]" && characters.length > 0) break;
    const [atom, next] = yield* readCharacterClassAtom(method, segment, index);
    characters.push(atom);
    index = next;
  }
  if (index === segment.length || characters.length === 0) {
    return yield* argumentError(method, "character classes must be closed and non-empty");
  }
  return Tuple.make(characters, index + 1);
});

const characterClassRangeEnd = (characters: ReadonlyArray<GlobCharacterClassAtom>, index: number): O.Option<string> => {
  if (index + 2 >= characters.length) return O.none();
  const separator = characters[index + 1];
  const end = characters[index + 2].value;
  return separator.value === "-" && !separator.escaped && end !== "-" ? O.some(end) : O.none();
};

const compileCharacterClass = Effect.fnUntraced(function* (
  method: string,
  characters: ReadonlyArray<GlobCharacterClassAtom>,
  negated: boolean
) {
  const literals: Array<string> = [];
  const ranges: Array<readonly [string, string]> = [];
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index];
    const end = characterClassRangeEnd(characters, index);
    if (O.isNone(end)) {
      literals.push(character.value);
      continue;
    }
    if (character.value > end.value) return yield* argumentError(method, "character class ranges must be ascending");
    ranges.push(Tuple.make(character.value, end.value));
    index += 2;
  }
  return GlobToken.cases.CharacterClass.make({ negated, ranges, literals });
});

const parseCharacterClass = Effect.fnUntraced(function* (method: string, segment: string, start: number) {
  const negated = segment[start + 1] === "!";
  const [characters, next] = yield* readCharacterClassAtoms(method, segment, start + (negated ? 2 : 1));
  const token = yield* compileCharacterClass(method, characters, negated);
  return Tuple.make(token, next);
});

const parseGlobEscape = Effect.fnUntraced(function* (method: string, segment: string, index: number) {
  const position = index + 1;
  if (position === segment.length) return yield* argumentError(method, "patterns must not end with an escape");
  const value = segment[position];
  return HashSet.has(globSyntaxCharacters, value)
    ? Tuple.make(GlobToken.cases.Literal.make({ value }), position + 1)
    : Tuple.make(GlobToken.cases.Literal.make({ value: "\\" }), position);
});

const parseGlobToken = Effect.fnUntraced(function* (
  method: string,
  segment: string,
  index: number
): Effect.fn.Return<readonly [GlobToken, number], PlatformError> {
  return yield* Match.value(segment[index]).pipe(
    Match.when("\\", () => parseGlobEscape(method, segment, index)),
    Match.when("*", () => Effect.succeed(Tuple.make(GlobToken.cases.Star.make({}), index + 1))),
    Match.when("?", () => Effect.succeed(Tuple.make(GlobToken.cases.One.make({}), index + 1))),
    Match.when("[", () => parseCharacterClass(method, segment, index)),
    Match.orElse((value) => Effect.succeed(Tuple.make(GlobToken.cases.Literal.make({ value }), index + 1)))
  );
});

const explicitlyMatchesDot = (token: GlobToken): boolean =>
  GlobToken.match(token, {
    Literal: (token) => token.value === ".",
    Star: () => false,
    One: () => false,
    CharacterClass: (token) => !token.negated && matchesGlobToken(token, "."),
  });

const parseGlobSegment = Effect.fnUntraced(function* (method: string, segment: string) {
  if (segment === "**") return CompiledGlobSegment.cases.Globstar.make({}) satisfies GlobGlobstar;
  const tokens: Array<GlobToken> = [];
  let index = 0;
  while (index < segment.length) {
    const [token, next] = yield* parseGlobToken(method, segment, index);
    tokens.push(token);
    index = next;
  }
  return {
    _tag: "Segment",
    tokens,
    startsWithDot: O.exists(A.head(tokens), explicitlyMatchesDot),
  } satisfies GlobSegment;
});

const compileGlobPattern = Effect.fnUntraced(function* (method: string, pattern: string) {
  if (pattern.length === 0 || HasNullByte.is(pattern) || Str.startsWith("/")(pattern)) {
    return yield* argumentError(method, "pattern must be a root-relative POSIX glob");
  }
  const directoryOnly = Str.endsWith("/")(pattern);
  const path = directoryOnly ? Str.slice(0, -1)(pattern) : pattern;
  const segments = Str.split("/")(path);
  if (A.contains(segments, "") || A.contains(segments, ".") || A.contains(segments, "..")) {
    return yield* argumentError(method, "pattern must not contain empty or dot path segments");
  }
  const compiled = yield* Effect.forEach(segments, (segment) => parseGlobSegment(method, segment));
  return { segments: compiled, directoryOnly } satisfies CompiledGlobPattern;
});

const compileGlobPatterns = Effect.fnUntraced(function* (method: string, pattern: string) {
  const expanded = yield* expandBraces(method, pattern);
  return yield* Effect.forEach(expanded, (alternative) => compileGlobPattern(method, alternative));
});

const matchesGlobToken = (token: GlobToken, value: string): boolean =>
  GlobToken.match(token, {
    Literal: (token) => token.value === value,
    Star: () => false,
    One: () => true,
    CharacterClass: (token) => {
      const matches =
        A.contains(token.literals, value) || A.some(token.ranges, ([start, end]) => start <= value && value <= end);
      return token.negated ? !matches : matches;
    },
  });

class GlobMatchCursor extends S.Class<GlobMatchCursor>($I`GlobMatchCursor`)(
  {
    patternIndex: S.Finite.pipe(S.mutableKey),
    valueIndex: S.Finite.pipe(S.mutableKey),
    starIndex: S.Finite.pipe(S.mutableKey),
    starValueIndex: S.Finite.pipe(S.mutableKey),
  },
  $I.annote("GlobMatchCursor", {
    description: "Mutable code-unit matcher positions, including the original minus-one no-star sentinels.",
  })
) {}

const isStarGlobToken = GlobToken.isAnyOf(["Star"]);

const advanceGlobSegment = (cursor: GlobMatchCursor, tokens: ReadonlyArray<GlobToken>, value: string): boolean => {
  const token = A.get(tokens, cursor.patternIndex);
  if (O.exists(token, (token) => matchesGlobToken(token, value[cursor.valueIndex]))) {
    cursor.patternIndex += 1;
    cursor.valueIndex += 1;
    return true;
  }
  if (O.exists(token, isStarGlobToken)) {
    cursor.starIndex = cursor.patternIndex;
    cursor.starValueIndex = cursor.valueIndex;
    cursor.patternIndex += 1;
    return true;
  }
  if (cursor.starIndex === -1) return false;
  cursor.patternIndex = cursor.starIndex + 1;
  cursor.starValueIndex += 1;
  cursor.valueIndex = cursor.starValueIndex;
  return true;
};

const matchesGlobSegment = (pattern: GlobSegment, value: string): boolean => {
  if (Str.startsWith(".")(value) && !pattern.startsWithDot) return false;
  const cursor: GlobMatchCursor = { patternIndex: 0, valueIndex: 0, starIndex: -1, starValueIndex: -1 };
  while (cursor.valueIndex < value.length) {
    if (!advanceGlobSegment(cursor, pattern.tokens, value)) return false;
  }
  while (O.exists(A.get(pattern.tokens, cursor.patternIndex), isStarGlobToken)) cursor.patternIndex += 1;
  return cursor.patternIndex === pattern.tokens.length;
};

// Dynamic-programming rows stay right-to-left: a globstar consumes the current
// row's next path position, while an ordinary segment consumes the following row.
const matchGlobstarPaths = (path: ReadonlyArray<string>, next: ReadonlyArray<boolean>): A.NonEmptyArray<boolean> => {
  const current = A.makeBy(path.length + 1, () => false);
  for (let index = path.length; index >= 0; index--) {
    current[index] = next[index] || (index < path.length && !Str.startsWith(".")(path[index]) && current[index + 1]);
  }
  return current;
};

const matchSegmentPaths = (
  segment: GlobSegment,
  path: ReadonlyArray<string>,
  next: ReadonlyArray<boolean>
): A.NonEmptyArray<boolean> => {
  const current = A.makeBy(path.length + 1, () => false);
  for (let index = path.length - 1; index >= 0; index--) {
    current[index] = matchesGlobSegment(segment, path[index]) && next[index + 1];
  }
  return current;
};

const matchesGlob = (pattern: CompiledGlobPattern, path: ReadonlyArray<string>, directory: boolean): boolean => {
  if (pattern.directoryOnly && !directory) return false;
  let next = A.makeBy(path.length + 1, (index) => index === path.length);
  for (let index = pattern.segments.length - 1; index >= 0; index--) {
    next = CompiledGlobSegment.match(pattern.segments[index], {
      Globstar: () => matchGlobstarPaths(path, next),
      Segment: (segment) => matchSegmentPaths(segment, path, next),
    });
  }
  return next[0];
};

class GlobSelection extends S.Class<GlobSelection>($I`GlobSelection`)(
  { includes: S.Array(CompiledGlobPattern), excludes: S.Array(CompiledGlobPattern) },
  $I.annote("GlobSelection", { description: "Compiled inclusion and exclusion alternatives for one public glob call." })
) {}

// These mutable arrays are traversal bookkeeping, not part of the volume model.
interface GlobWalk {
  readonly matches: Array<string>;
  readonly pending: Array<readonly [DirectoryInode, ReadonlyArray<string>]>;
}

const collectGlobDirectory = (
  state: State,
  directory: DirectoryInode,
  parent: ReadonlyArray<string>,
  selection: GlobSelection,
  walk: GlobWalk
): void => {
  for (const name of A.sort([...HashMap.keys(directory.entries)], Order.String)) {
    const path = [...parent, name];
    const entry = O.flatMap(findEntry(directory, name), (inode) => findInode(state, inode));
    const directoryEntry = O.filter(entry, isDirectoryInode);
    const isDirectory = O.isSome(directoryEntry);
    const excluded = A.some(selection.excludes, (pattern) => matchesGlob(pattern, path, isDirectory));
    if (excluded) continue;
    if (A.some(selection.includes, (pattern) => matchesGlob(pattern, path, isDirectory))) {
      walk.matches.push(A.join(path, "/"));
    }
    O.map(directoryEntry, (child) => walk.pending.push(Tuple.make(child, path)));
  }
};

const collectGlob = (state: State, root: DirectoryInode, selection: GlobSelection): Array<string> => {
  if (A.some(selection.excludes, (pattern) => matchesGlob(pattern, [], true))) return [];
  const walk: GlobWalk = {
    matches: A.some(selection.includes, (pattern) => matchesGlob(pattern, [], true)) ? ["."] : [],
    pending: [[root, []]],
  };
  while (walk.pending.length > 0) {
    const next = walk.pending.pop();
    if (next === undefined) break;
    collectGlobDirectory(state, next[0], next[1], selection, walk);
  }
  return A.sort(walk.matches, Order.String);
};

const glob = (volume: Volume) =>
  Effect.fnUntraced(function* (
    pattern: string,
    options?: { readonly root?: string | undefined; readonly exclude?: ReadonlyArray<string> | undefined }
  ) {
    const includes = yield* compileGlobPatterns("glob", pattern);
    const excludes = yield* Effect.forEach(options?.exclude ?? [], (excluded) =>
      compileGlobPatterns("glob", excluded)
    ).pipe(Effect.map((patterns) => A.flatten(patterns)));
    const rootPath = options?.root ?? "/";
    return yield* volume.withState(
      Effect.fnUntraced(function* (state) {
        const resolved = yield* resolve(state, rootPath, { method: "glob" });
        if (!isDirectoryInode(resolved.entry)) return yield* badResource("glob", rootPath);
        return collectGlob(state, resolved.entry, { includes, excludes });
      })
    );
  });

// =============================================================================
// volume
// =============================================================================

const makeVolume = Effect.gen(function* () {
  const now = yield* DateTime.now;
  // NOTE: One permit covers a transition, its state assignment, and event publication;
  // acquiring that permit remains interruptible.
  const lock = yield* Semaphore.make(1);
  const watchers = MutableHashSet.empty<WatchSubscription>();

  let state: State = State.make({
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
  });

  const commitResult = <A>(result: TransitionResult<A>): Effect.Effect<A> =>
    Effect.sync(() => {
      state = result.state;
    }).pipe(Effect.andThen(publishWatchEvents(watchers, result.events)), Effect.as(result.value));

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
    mutate,
    mutateInterruptibly,
    watchers,
    withState,
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
              path: resolved.path,
              directory: isDirectoryInode(resolved.entry),
              recursive: options?.recursive === true,
              queue: undefined,
              // NOTE: `Stream.callback` attaches its queue after subscription
              // registration, so retain matching events across that handoff.
              pending: [],
            };
            MutableHashSet.add(volume.watchers, subscription);
            return subscription;
          })
        ),
        (subscription) =>
          volume.withState(() =>
            Effect.sync(() => {
              MutableHashSet.remove(volume.watchers, subscription);
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

const makeReadyVolume: Effect.Effect<Volume> = Effect.gen(function* () {
  const volume = yield* makeVolume;
  yield* Effect.orDie(makeDirectory(volume)(TEMP_DIR, { recursive: true }));
  return volume;
});

/**
 * Creates a fresh POSIX in-memory filesystem with an empty pre-created `/tmp`.
 *
 * **Details**
 *
 * Each evaluation allocates an independent volume. Relative paths resolve from
 * the virtual root; no operation falls back to the host filesystem. Permission
 * and owner metadata are retained, but access does not enforce a virtual user.
 *
 * **Example** (Independent observable file contents)
 *
 * ```ts
 * import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const first = yield* MemoryFileSystem.make
 *   const second = yield* MemoryFileSystem.make
 *   yield* first.writeFileString("/note.txt", "in memory")
 *   return [yield* first.readFileString("/note.txt"), yield* second.exists("/note.txt")]
 * })
 * console.log(await Effect.runPromise(program)) // ["in memory", false]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make: Effect.Effect<FileSystem.FileSystem> = Effect.map(makeReadyVolume, toFileSystem);

/**
 * Provides a fresh in-memory filesystem when the layer is built.
 *
 * **Gotchas**
 *
 * An `it.layer` block builds once: its tests share one volume, while scoped
 * resources opened inside a test close with that test. Use separate layer blocks
 * or separate `make` evaluations for independent volumes. Do not replace native
 * filesystem tests when the host platform lifecycle is the subject.
 *
 * **Example** (Scoped temporary files in a shared layer block)
 *
 * ```ts
 * import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem"
 * import { it } from "@effect/vitest"
 * import { strictEqual } from "@effect/vitest/utils"
 * import * as Effect from "effect/Effect"
 * import * as FileSystem from "effect/FileSystem"
 *
 * it.layer(MemoryFileSystem.layer)("virtual files", (it) => {
 *   it.effect("writes and reads a scoped file", Effect.fnUntraced(function* () {
 *     const fs = yield* FileSystem.FileSystem
 *     const path = yield* fs.makeTempFileScoped()
 *     yield* fs.writeFileString(path, "temporary")
 *     strictEqual(yield* fs.readFileString(path), "temporary")
 *   }))
 * })
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<FileSystem.FileSystem> = Layer.effect(FileSystem.FileSystem, make);
