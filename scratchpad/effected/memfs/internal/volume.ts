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
//   pathological tree or pattern fails through the typed channel, never as a
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

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as MutableHashMap from "effect/MutableHashMap";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import type * as Cause from "effect/Cause";
import * as ByteSize from "effect/ByteSize";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformErrorNs from "effect/PlatformError";
import * as Queue from "effect/Queue";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";

import type { ErrnoCode } from "./errno.ts";
import { ErrnoException, errnoError } from "./errno.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/memfs/internal/volume");

class VolumeInvariantError extends S.TaggedError<VolumeInvariantError>($I`VolumeInvariantError`)(
 "VolumeInvariantError",
 { message: S.String.pipe($I.annoteKey("VolumeInvariantError.message", { description: "The violated internal volume invariant." })) },
 $I.annoteError<VolumeInvariantError>("VolumeInvariantError", { description: "The committed volume state violates an engine invariant." }),
) {}

// localeCompare can return any negative/positive magnitude; Orders require -1/0/1.
const LocaleNameOrder = Order.make<string>((left, right) => {
 const compared = left.localeCompare(right);
 return compared < 0 ? -1 : compared > 0 ? 1 : 0;
});
const InodeNameOrder = Order.mapInput(LocaleNameOrder, (entry: readonly [string, Inode]) => entry[0]);
const ResolutionErrno = LiteralKit(["EISDIR", "ELOOP", "ENOTDIR"]).pipe(
 $I.annoteSchema("ResolutionErrno", { description: "Resource errors raised during inode resolution." }),
);
type ResolutionErrno = typeof ResolutionErrno.Type;
const DescriptorErrno = LiteralKit(["EBADF", "EINVAL", "EISDIR"]).pipe(
 $I.annoteSchema("DescriptorErrno", { description: "Errors raised by descriptor operations." }),
);
type DescriptorErrno = typeof DescriptorErrno.Type;
const DescriptorAccess = LiteralKit(["readable", "writable"]).pipe(
 $I.annoteSchema("DescriptorAccess", { description: "The required descriptor access mode." }),
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

const Inode = S.Finite.pipe(S.brand("MemoryFileSystemInode"),
 $I.annoteSchema("Inode", { description: "A volume inode number." }));
type Inode = typeof Inode.Type;
const RootInode = Inode.make(1);
const FileDescriptor = S.Finite.pipe(S.brand("MemoryFileSystemFileDescriptor"),
 $I.annoteSchema("FileDescriptor", { description: "A volume file descriptor number." }));
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
 birthtime: S.DateTimeUtc.pipe($I.annoteKey("InodeMetadata.birthtime", { description: "The creation time." }))
}).pipe($I.annoteSchema("InodeMetadata", { description: "The engine InodeMetadata data." }));
type InodeMetadata = typeof InodeMetadata.Type;
const FileInode = S.Struct({
 _tag: S.tag("File").pipe($I.annoteKey("FileInode._tag", { description: "The inode variant." })),
 ...InodeMetadata.fields,
 data: S.Uint8Array.pipe($I.annoteKey("FileInode.data", { description: "The live file bytes." }))
}).pipe($I.annoteSchema("FileInode", { description: "The engine FileInode data." }));
type FileInode = typeof FileInode.Type;
const DirectoryInode = S.Struct({
 _tag: S.tag("Directory").pipe($I.annoteKey("DirectoryInode._tag", { description: "The inode variant." })),
 ...InodeMetadata.fields,
 entries: S.HashMap(S.String, Inode).pipe($I.annoteKey("DirectoryInode.entries", { description: "The stored directory entry names and inode numbers." }))
}).pipe($I.annoteSchema("DirectoryInode", { description: "The engine DirectoryInode data." }));
type DirectoryInode = typeof DirectoryInode.Type;
const SymbolicLinkInode = S.Struct({
 _tag: S.tag("SymbolicLink").pipe($I.annoteKey("SymbolicLinkInode._tag", { description: "The inode variant." })),
 ...InodeMetadata.fields,
 target: S.String.pipe($I.annoteKey("SymbolicLinkInode.target", { description: "The stored link target." }))
}).pipe($I.annoteSchema("SymbolicLinkInode", { description: "The engine SymbolicLinkInode data." }));
type SymbolicLinkInode = typeof SymbolicLinkInode.Type;
const InodeEntry = S.Union([FileInode, DirectoryInode, SymbolicLinkInode]).pipe(
 S.toTaggedUnion("_tag"), $I.annoteSchema("InodeEntry", { description: "The file, directory or symbolic-link inode." }),
);
type InodeEntry = typeof InodeEntry.Type;

interface WatchSubscription {
 readonly id: number;
	readonly path: string;
	readonly directory: boolean;
	readonly recursive: boolean;
	queue: Queue.Enqueue<FileSystem.WatchEvent, PlatformError | Cause.Done> | undefined;
	readonly pending: Array<FileSystem.WatchEvent>;
}

const WatchSubscriptionOrder = Order.mapInput(Order.Number, (watcher: WatchSubscription) => watcher.id);

interface TransitionResult<A> {
	readonly state: State;
	readonly value: A;
	readonly events: ReadonlyArray<FileSystem.WatchEvent>;
}

const transitionResult = <A>(
	state: State,
	value: A,
	events: ReadonlyArray<FileSystem.WatchEvent> = [],
): TransitionResult<A> => ({ state, value, events });

interface State {
	readonly inodes: HashMap.HashMap<Inode, InodeEntry>;
	readonly nextInode: number;
	readonly descriptors: HashMap.HashMap<FileDescriptor, OpenFileDescriptor>;
	readonly nextDescriptor: number;
	readonly nextTemporary: number;
	// KIT EXTENSION (case folding): fixed at build, never changed afterwards.
	readonly caseSensitive: boolean;
}

interface Volume {
	readonly watchers: MutableHashMap.MutableHashMap<number, WatchSubscription>;
 readonly allocateSubscriptionId: () => number;
	readonly withState: <A, E, R>(use: (state: State) => Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
	readonly mutate: <A, E, R>(use: (state: State) => Effect.Effect<TransitionResult<A>, E, R>) => Effect.Effect<A, E, R>;
	readonly mutateInterruptibly: <A, E, R>(
		use: (state: State) => Effect.Effect<TransitionResult<A>, E, R>,
	) => Effect.Effect<A, E, R>;
	// Kit extension (volume inspection): the current committed state, readable
	// synchronously. State values are immutable — each transition replaces the
	// reference under the volume lock — so a sync read observes one consistent
	// snapshot and can never see a half-applied transition.
	readonly currentState: () => State;
}

interface OpenFileDescriptor {
	readonly fd: FileDescriptor;
	readonly inode: Inode;
	readonly readable: boolean;
	readonly writable: boolean;
	readonly append: boolean;
	readonly position: bigint;
}

interface ResolveOptions {
	readonly followFinalSymbolicLink?: boolean | undefined;
	readonly method?: string | undefined;
}

interface ResolvedInode {
	readonly inode: Inode;
	readonly entry: InodeEntry;
	readonly path: string;
}

interface ResolvedEntry {
	readonly parent: DirectoryInode;
	readonly name: string;
	readonly entry: InodeEntry;
	readonly path: string;
}

interface CloneContext {
	readonly method: string;
	readonly sourcePath: string;
	readonly preserveTimestamps: boolean;
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

const invalidData = (method: string, path: string, description: string): PlatformError =>
	fileSystemError({ _tag: "InvalidData", method, pathOrDescriptor: path, description });

// Errno fidelity: the errno → tag mapping lives in ./errno.js.

const alreadyExists = (method: string, path: string): PlatformError => errnoError(method, path, "EEXIST", undefined);

const permissionDenied = (method: string, path: string, description: string): PlatformError =>
	fileSystemError({ _tag: "PermissionDenied", method, pathOrDescriptor: path, description });

const badResource = (
	method: string,
	pathOrDescriptor: string | number,
	code: ResolutionErrno,
	description?: string,
): PlatformError => errnoError(method, pathOrDescriptor, code, description);

// A limit of the in-memory model itself (nesting depth, allocation, position
// range), with no errno the real platform would raise: BadResource, no cause.
const volumeLimit = (method: string, pathOrDescriptor: string | number, description: string): PlatformError =>
	fileSystemError({ _tag: "BadResource", method, pathOrDescriptor, description });

const notFound = (method: string, path: string): PlatformError => errnoError(method, path, "ENOENT", undefined);

const argumentError = (method: string, description: string): PlatformError =>
	badArgument({ module: "FileSystem", method, description });

// node rejects a NUL byte in any path argument before touching the filesystem,
// as a BadArgument (ERR_INVALID_ARG_VALUE), not a system error.
const nullBytePath = (method: string): PlatformError => argumentError(method, "path must not contain null bytes");

const findInode = (state: State, inode: Inode): InodeEntry | undefined =>
	O.getOrUndefined(HashMap.get(state.inodes, inode));

// KIT EXTENSION (case folding): a case-insensitive,
// case-preserving volume looks a name up exactly first, then by folded
// comparison, and answers the STORED key alongside the inode. Every mutation of
// an existing entry keys on that stored name, so removal and rekeying hit the
// real entry; path spellings a caller sees keep the queried component.
const lookupEntry = (state: State, directory: DirectoryInode, name: string): readonly [string, Inode] | undefined => {
	const exact = O.getOrUndefined(HashMap.get(directory.entries, name));
	if (exact !== undefined) return [name, exact];
	if (state.caseSensitive) return undefined;
	const folded = name.toLowerCase();
	for (const [key, inode] of directory.entries) {
		if (key.toLowerCase() === folded) return [key, inode];
	}
	return undefined;
};

const findEntry = (state: State, directory: DirectoryInode, name: string): Inode | undefined =>
	lookupEntry(state, directory, name)?.[1];
// END KIT EXTENSION (case folding)

const setInode = (state: State, entry: InodeEntry): State => ({
	...state,
	inodes: HashMap.set(state.inodes, entry.ino, entry),
});

const getInode = Effect.fnUntraced(function* (state: State, inode: Inode, method: string, path: string) {
	const entry = findInode(state, inode);
	if (entry === undefined) {
		return yield* notFound(method, path);
	}
	return entry;
});

const validateEntryName = Effect.fnUntraced(function* (method: string, name: string, pathOrDescriptor: string = name) {
	const invalidName = name.length === 0 || name === "." || name === ".." || name.includes("/") || name.includes("\0");
	if (invalidName) {
		return yield* invalidData(method, pathOrDescriptor, "Invalid directory entry name");
	}
	return;
});

const getDirectory = Effect.fnUntraced(function* (state: State, inode: Inode, method: string, path: string) {
	const entry = yield* getInode(state, inode, method, path);
	if (entry._tag !== "Directory") {
		return yield* badResource(method, path, "ENOTDIR");
	}
	return entry;
});

const touchNamespaceMutation = (
	state: State,
	directory: DirectoryInode,
	target: InodeEntry,
	now: DateTime.Utc,
): State => ({
	...state,
	inodes: HashMap.set(HashMap.set(state.inodes, directory.ino, { ...directory, mtime: now, ctime: now }), target.ino, {
		...target,
		ctime: now,
	}),
});

const childPath = (parent: string, name: string): string => (parent === "/" ? `/${name}` : `${parent}/${name}`);

const parentOfPath = (path: string): string => {
	const separator = path.lastIndexOf("/");
	return separator <= 0 ? "/" : path.slice(0, separator);
};

// PORT NOTE: upstream ignored `WatchOptions` and made every directory watch
// recursive. Here a non-recursive directory watch reports the path itself and
// its DIRECT children (node `fs.watch` semantics); `recursive: true` reports
// all descendants; events on an ancestor of the watched path are always
// reported (upstream behavior, kept).
const includesWatchPath = (watchedPath: string, directory: boolean, recursive: boolean, eventPath: string): boolean =>
	eventPath === watchedPath ||
	(directory && recursive && (watchedPath === "/" || eventPath.startsWith(`${watchedPath}/`))) ||
	(directory && !recursive && eventPath !== "/" && parentOfPath(eventPath) === watchedPath) ||
	(eventPath !== "/" && watchedPath.startsWith(`${eventPath}/`));

// KIT EXTENSION (case folding): on a
// case-insensitive volume a subscription and an event name one entry in any
// spelling, so matching compares FOLDED paths; the delivered event keeps its own.
const publishWatchEvents = (
	watchers: MutableHashMap.MutableHashMap<number, WatchSubscription>,
	events: ReadonlyArray<FileSystem.WatchEvent>,
	caseSensitive: boolean,
) =>
	Effect.sync(() => {
		const fold = caseSensitive ? (path: string) => path : (path: string) => path.toLowerCase();
		for (const watcher of A.sort(MutableHashMap.values(watchers), WatchSubscriptionOrder)) {
			for (const event of events) {
				if (includesWatchPath(fold(watcher.path), watcher.directory, watcher.recursive, fold(event.path))) {
					if (watcher.queue === undefined) {
						watcher.pending.push(event);
					} else {
						Queue.offerUnsafe(watcher.queue, event);
					}
				}
			}
		}
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
			const child = findInode(state, childInode);
			if (child?._tag === "Directory") {
				pending.push([child, path]);
			}
		}
	}
	return paths;
};

const inodeUpdateEvents = (state: State, inode: Inode): ReadonlyArray<FileSystem.WatchEvent.Update> => {
	const root = findInode(state, RootInode);
	if (root?._tag !== "Directory") return [];
	if (inode === RootInode) return [{ _tag: "Update", path: "/" }];
	// NOTE: An inode may be reachable through multiple hard-link aliases, each of
	// which must receive an update event.
	return A.sort(collectInodePaths(state, inode, root), Order.String)
		.map((path) => ({ _tag: "Update", path }));
};

const reclaimInode = (state: State, entry: InodeEntry): State =>
	entry.nlink === 0 && entry.openCount === 0 ? { ...state, inodes: HashMap.remove(state.inodes, entry.ino) } : state;

// =============================================================================
// inode creation and linking
// =============================================================================

const createFile = Effect.fnUntraced(function* (state: State, data: Uint8Array = new Uint8Array()) {
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
				}),
			),
		},
		ino,
	] as const;
});

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
				}),
			),
		},
		ino,
	] as const;
});

const createSymbolicLink = Effect.fnUntraced(function* (state: State, target: string) {
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
				}),
			),
		},
		ino,
	] as const;
});

const attachDirectory = Effect.fnUntraced(function* (
	state: State,
	parent: Inode,
	name: string,
	inode: Inode,
	method = "makeDirectory",
) {
	yield* validateEntryName(method, name);
	const parentEntry = yield* getDirectory(state, parent, method, name);
	// KIT EXTENSION (case folding): a folded match exists.
	if (findEntry(state, parentEntry, name) !== undefined) {
		return yield* alreadyExists(method, name);
	}
	const entry = yield* getInode(state, inode, method, name);
	const expectedUnlinkedLinks =
		entry._tag === "Directory"
			? DIR_SELF_LINK_COUNT +
				[...HashMap.values(entry.entries)].filter((child) => findInode(state, child)?._tag === "Directory").length
			: 0;
	if (entry._tag !== "Directory" || parent === inode || entry.nlink !== expectedUnlinkedLinks) {
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
	method = "link",
) {
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
});

// =============================================================================
// path resolution
// =============================================================================

// NOTE: Relative paths resolve from the virtual POSIX root because `FileSystem` has
// no `chdir` operation or mutable working-directory state.
const resolve = Effect.fnUntraced(function* (state: State, path: string, options?: ResolveOptions) {
	const method = options?.method ?? "resolve";
	const originalPath = path;
	if (path.includes("\0")) {
		return yield* nullBytePath(method);
	}
	if (path.length === 0) {
		return yield* notFound(method, path);
	}
	let components = path.split("/");
	const stack: Array<Inode> = [RootInode];
	const names: Array<string> = [];
	let symbolicLinkTraversals = 0;

	while (components.length > 0) {
		const component = components.shift();
		if (component === undefined) {
			continue;
		}
		if (component.length === 0) {
			if (components.length === 0) {
				yield* getDirectory(state, stack[stack.length - 1] ?? RootInode, method, originalPath);
			}
			continue;
		}
		if (component === ".") {
			yield* getDirectory(state, stack[stack.length - 1] ?? RootInode, method, originalPath);
			continue;
		}
		if (component === "..") {
			yield* getDirectory(state, stack[stack.length - 1] ?? RootInode, method, originalPath);
			if (stack.length > 1) {
				stack.pop();
				names.pop();
			}
			continue;
		}

		const parent = yield* getDirectory(state, stack[stack.length - 1] ?? RootInode, method, originalPath);
		// KIT EXTENSION (case folding): the lookup
		// folds, but `names` keeps the queried component — node's realpath never
		// canonicalizes case; only a link's target text supplies its own spelling.
		const inode = findEntry(state, parent, component);
		if (inode === undefined) {
			return yield* notFound(method, originalPath);
		}
		const entry = yield* getInode(state, inode, method, originalPath);
		const shouldFollow =
			entry._tag === "SymbolicLink" && (components.length > 0 || options?.followFinalSymbolicLink !== false);
		if (shouldFollow) {
			symbolicLinkTraversals += 1;
			if (symbolicLinkTraversals > MAX_LINK_TRAVERSAL) {
				return yield* badResource(method, originalPath, "ELOOP", "Too many symbolic links");
			}
			if (entry.target.length === 0) {
				return yield* notFound(method, originalPath);
			}
			if (entry.target.startsWith("/")) {
				stack.splice(1);
				names.splice(0);
			}
			components = entry.target.split("/").concat(components);
			continue;
		}

		stack.push(inode);
		names.push(component);
	}

	const inode = stack[stack.length - 1] ?? RootInode;
	const entry = yield* getInode(state, inode, method, originalPath);
	return { inode, entry, path: names.length === 0 ? "/" : `/${names.join("/")}` } satisfies ResolvedInode;
});

interface OpenMode {
	readonly readable: boolean;
	readonly writable: boolean;
	readonly append: boolean;
	readonly create: boolean;
	readonly exclusive: boolean;
	readonly truncate: boolean;
}

interface OpenOptions {
	readonly flag?: FileSystem.OpenFlag | undefined;
	readonly mode?: number | undefined;
}

// =============================================================================
// descriptors
// =============================================================================

const isOpenFlag = (flag: unknown): flag is FileSystem.OpenFlag =>
	flag === "r" ||
	flag === "r+" ||
	flag === "w" ||
	flag === "wx" ||
	flag === "w+" ||
	flag === "wx+" ||
	flag === "a" ||
	flag === "ax" ||
	flag === "a+" ||
	flag === "ax+";

const openMode = (flag: FileSystem.OpenFlag): OpenMode => ({
	readable: flag === "r" || flag.endsWith("+"),
	writable: flag !== "r",
	append: flag.startsWith("a"),
	create: flag.startsWith("w") || flag.startsWith("a"),
	exclusive: flag.includes("x"),
	truncate: flag.startsWith("w"),
});

// node reports a closed descriptor, or one lacking the access an operation
// needs, as EBADF — except `ftruncate` on a descriptor not open for writing,
// which is EINVAL on both Linux and macOS.
const descriptorError = (
	fd: FileDescriptor,
	method: string,
	code: DescriptorErrno,
	description: string,
): PlatformError => errnoError(method, fd, code, description);

const allocateBytes = (length: number, fd: FileDescriptor, method: string) =>
	Effect.try({
		try: () => new Uint8Array(length),
		catch: () => volumeLimit(method, fd, "Unable to allocate file bytes"),
	});

const getOpenFile = (
	state: State,
	fd: FileDescriptor,
	method: string,
	access?: DescriptorAccess,
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
		const entry = findInode(state, descriptor.inode);
		if (entry === undefined || entry._tag !== "File") {
			return Effect.fail(descriptorError(fd, method, "EISDIR", "File descriptor does not refer to a file"));
		}
		return Effect.succeed([descriptor, entry]);
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
				cause:
					S.is(ErrnoException)(error.reason.cause)
						? ErrnoException.from(error.reason.cause.code, path)
						: error.reason.cause,
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
	if (target.startsWith("/")) {
		return target;
	}
	const separator = linkPath.lastIndexOf("/");
	const directory = separator <= 0 ? "/" : linkPath.slice(0, separator);
	return `${directory}/${target}`;
};

// =============================================================================
// entry resolution and removal
// =============================================================================

// KIT EXTENSION (errno fidelity): a trailing slash asserts "this is a
// directory". On an existing directory it is harmless and the entry is
// addressed without it; on an existing non-directory it is ENOTDIR; on a
// missing entry it is ENOENT, except where Linux reports otherwise for the
// calling operation (EISDIR when creating a file, ENOTDIR when renaming a
// non-directory onto it) — the caller passes that code.
const resolveParent = Effect.fnUntraced(function* (
	state: State,
	path: string,
	method: string,
	errorPath: string = path,
	missingWithTrailingSlash: ErrnoCode = "ENOENT",
) {
	if (path.includes("\0")) {
		return yield* nullBytePath(method);
	}
	if (path.length === 0) {
		return yield* notFound(method, errorPath);
	}
	let entryPath = path;
	if (path.endsWith("/")) {
		const trimmed = path.replace(/\/+$/, "");
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
		entryPath = trimmed;
	}
	const components = entryPath.split("/").filter((component) => component.length > 0);
	const name = components.pop();
	if (name === undefined) {
		return yield* badResource(method, errorPath, "EISDIR");
	}
	yield* validateEntryName(method, name, errorPath);
	const parentPath = components.length === 0 ? "/" : `${path.startsWith("/") ? "/" : ""}${components.join("/")}`;
	const parent = yield* resolve(state, parentPath, { method }).pipe(
		Effect.mapError((error) => withSystemErrorPath(error, method, errorPath)),
	);
	if (parent.entry._tag !== "Directory") {
		return yield* badResource(method, errorPath, "ENOTDIR");
	}
	return { inode: parent.inode, entry: parent.entry, name, path: parent.path };
});

const resolveEntry = Effect.fnUntraced(function* (state: State, path: string, method: string) {
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
});

const validateMode = (method: string, mode: number | undefined) =>
	mode === undefined || (Number.isInteger(mode) && mode >= 0 && mode <= 0xffff_ffff)
		? Effect.void
		: Effect.fail(argumentError(method, "mode must be an unsigned 32-bit integer"));

// PORT NOTE: `depth` bounds the recursion at MAX_NESTING_DEPTH, failing typed —
// upstream recursed unbounded.
const detachEntry: (
	state: State,
	target: ResolvedEntry,
	now: DateTime.Utc,
	recursive: boolean,
	method: string,
	path: string,
	depth?: number,
) => Effect.Effect<State, PlatformError> = Effect.fnUntraced(function* (
	state,
	target,
	now,
	recursive,
	method,
	path,
	depth = 0,
) {
	if (depth > MAX_NESTING_DEPTH) {
		return yield* volumeLimit(method, path, "Directory tree exceeds the maximum nesting depth");
	}
	if (target.entry._tag === "Directory" && HashMap.size(target.entry.entries) > 0 && !recursive) {
		return yield* errnoError(method, path, "ENOTEMPTY", "Directory is not empty");
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
				depth + 1,
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
});

// =============================================================================
// directory operations
// =============================================================================

const makeDirectory = (volume: Volume) =>
	Effect.fnUntraced(function* (
		path: string,
		options?: { readonly recursive?: boolean | undefined; readonly mode?: number | undefined },
	) {
		const method = "makeDirectory";
		yield* validateMode(method, options?.mode);
		return yield* volume.mutate(
			Effect.fnUntraced(function* (state) {
				let nextState = state;
				const recursive = options?.recursive === true;
				const pieces = path.split("/").filter((piece) => piece.length > 0);
				if (path.includes("\0")) {
					return yield* nullBytePath(method);
				}
				if (path.length === 0) {
					return yield* notFound(method, path);
				}
				if (pieces.length === 0) {
					// The root always exists: node answers `mkdir("/")` EEXIST, and a
					// recursive `mkdir -p /` succeeds as a no-op.
					return recursive ? transitionResult(nextState, undefined) : yield* alreadyExists(method, path);
				}
				const prefix = path.startsWith("/") ? "/" : "";
				const createdPaths: Array<string> = [];
				for (let index = 0; index < pieces.length; index++) {
					const candidate = `${prefix}${pieces.slice(0, index + 1).join("/")}`;
					const existing = yield* Effect.result(resolve(nextState, candidate, { method }));
					if (existing._tag === "Success") {
						if (existing.success.entry._tag !== "Directory") {
							// A non-directory as the FINAL component is EEXIST; one
							// earlier in the path cannot hold children — ENOTDIR.
							return yield* index === pieces.length - 1
								? alreadyExists(method, path)
								: badResource(method, path, "ENOTDIR");
						}
						if (index === pieces.length - 1) {
							return recursive ? transitionResult(nextState, undefined) : yield* alreadyExists(method, path);
						}
						continue;
					}
					if (!recursive && index !== pieces.length - 1) {
						return yield* withSystemErrorPath(existing.failure, method, path);
					}
					const parent = yield* resolveParent(nextState, candidate, method, path);
					// KIT EXTENSION (case folding)
					if (findEntry(nextState, parent.entry, parent.name) !== undefined) {
						// KIT EXTENSION (errno fidelity): the
						// entry exists but does not resolve, so it is a dangling or looping
						// symbolic link. A recursive mkdir follows it and reports why it
						// failed (node's EEXIST → stat fallback): the final component
						// answers the resolution errno; earlier in the path the node
						// adapter's callback `fs.mkdir` turns a dangling ENOENT into
						// ENOTDIR, while any other code (ELOOP) is what the deeper mkdir
						// syscall raised itself.
						if (recursive) {
							const cause = existing.failure.reason.cause;
							if (!(S.is(ErrnoException)(cause))) {
								return yield* withSystemErrorPath(existing.failure, method, path);
							}
							const final = index === pieces.length - 1;
							return yield* errnoError(method, path, !final && cause.code === "ENOENT" ? "ENOTDIR" : cause.code, undefined);
						}
						// END KIT EXTENSION (errno fidelity)
						return yield* alreadyExists(method, path);
					}
					const [createdState, inode] = yield* createDirectory(nextState);
					nextState = createdState;
					let entry = yield* getDirectory(nextState, inode, method, path);
					if (options?.mode !== undefined) {
						entry = {
							...entry,
							mode: DIR_TYPE_MODE | (options.mode & PERMISSION_MODE),
						};
						nextState = setInode(nextState, entry);
					}
					nextState = yield* attachDirectory(nextState, parent.inode, parent.name, inode, method).pipe(
						Effect.mapError((error) => withSystemErrorPath(error, method, path)),
					);
					createdPaths.push(childPath(parent.path, parent.name));
				}
				return transitionResult(
					nextState,
					undefined,
					createdPaths.map((path) => ({ _tag: "Create", path })),
				);
			}),
		);
	});

const link = (volume: Volume) =>
	Effect.fnUntraced(function* (fromPath: string, toPath: string) {
		const method = "link";
		return yield* volume.mutate(
			Effect.fnUntraced(function* (state) {
				const source = yield* resolve(state, fromPath, { method }).pipe(
					Effect.mapError((error) => withSystemErrorPath(error, method, fromPath)),
				);
				const destination = yield* resolveParent(state, toPath, method);
				const nextState = yield* linkInode(state, destination.inode, destination.name, source.inode, method).pipe(
					Effect.mapError((error) => withSystemErrorPath(error, method, toPath)),
				);
				return transitionResult(nextState, undefined, [
					{
						_tag: "Create",
						path: childPath(destination.path, destination.name),
					},
				]);
			}),
		);
	});

const symlink = (volume: Volume) =>
	Effect.fnUntraced(function* (target: string, path: string) {
		const method = "symlink";
		return yield* volume.mutate(
			Effect.fnUntraced(function* (state) {
				const parent = yield* resolveParent(state, path, method);
				if (target.includes("\0")) {
					return yield* argumentError(method, "target must not contain a null byte");
				}
				const [createdState, inode] = yield* createSymbolicLink(state, target);
				const nextState = yield* linkInode(createdState, parent.inode, parent.name, inode, method).pipe(
					Effect.mapError((error) => withSystemErrorPath(error, method, path)),
				);
				return transitionResult(nextState, undefined, [
					{
						_tag: "Create",
						path: childPath(parent.path, parent.name),
					},
				]);
			}),
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
			}),
		);
	});

const realPath = (volume: Volume) =>
	Effect.fnUntraced(function* (path: string) {
		return yield* volume.withState((state) => Effect.map(resolve(state, path, { method: "realPath" }), (_) => _.path));
	});

const remove = (volume: Volume) =>
	Effect.fnUntraced(function* (
		path: string,
		options?: { readonly recursive?: boolean | undefined; readonly force?: boolean | undefined },
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
			}),
		);
	});

// PORT NOTE: iterative worklist where upstream recursed — a pathological tree
// depth must never become a stack-overflow defect.
const containsDirectory = (state: State, ancestor: Inode, candidate: Inode): boolean => {
	const pending: Array<Inode> = [ancestor];
	while (pending.length > 0) {
		const current = pending.pop();
		if (current === undefined) break;
		if (current === candidate) return true;
		const entry = findInode(state, current);
		if (entry === undefined || entry._tag !== "Directory") continue;
		for (const inode of HashMap.values(entry.entries)) {
			if (findInode(state, inode)?._tag === "Directory") {
				pending.push(inode);
			}
		}
	}
	return false;
};

const rename = (volume: Volume) =>
	Effect.fnUntraced(function* (oldPath: string, newPath: string) {
		const method = "rename";
		return yield* volume.mutate(
			Effect.fnUntraced(function* (state) {
				const source = yield* resolveEntry(state, oldPath, method);
				// A directory may be renamed onto a trailing-slash path that does not
				// exist yet; a non-directory cannot (ENOTDIR on Linux).
				const destinationParent =
					source.entry._tag === "Directory" && /[^/]\/+$/.test(newPath)
						? yield* resolveParent(state, newPath.replace(/\/+$/, ""), method, newPath)
						: yield* resolveParent(state, newPath, method, newPath, "ENOTDIR");
				// KIT EXTENSION (case folding): the no-op
				// guard compares the QUERIED source leaf — XNU skips a byte-identical
				// rename, so `rename("dir", "dir")` over a stored `Dir` keeps `Dir`.
				if (source.parent.ino === destinationParent.inode && source.requestedName === destinationParent.name) {
					return transitionResult(state, undefined);
				}
				if (source.entry._tag === "Directory" && containsDirectory(state, source.entry.ino, destinationParent.inode)) {
					return yield* errnoError(method, newPath, "EINVAL", "Cannot move a directory into itself");
				}
				// KIT EXTENSION (case folding): one folded
				// lookup gives the destination's stored key and inode. A hit on the source
				// entry ITSELF (same directory, same stored key) is a case-only rename: it
				// rekeys the entry under the requested spelling, children attached, and
				// detaches nothing. Any other hit is replaced under its STORED spelling
				// (host-proven on APFS); a miss takes the requested spelling.
				const found = lookupEntry(state, destinationParent.entry, destinationParent.name);
				const caseOnly =
					found !== undefined &&
					found[1] === source.entry.ino &&
					found[0] === source.name &&
					source.parent.ino === destinationParent.inode;
				if (found !== undefined && found[1] === source.entry.ino && !caseOnly) {
					return transitionResult(state, undefined);
				}
				const destinationName = found === undefined || caseOnly ? destinationParent.name : found[0];
				const destinationInode = caseOnly ? undefined : found?.[1];
				// END KIT EXTENSION (case folding)
				let destination: ResolvedEntry | undefined;
				if (destinationInode !== undefined) {
					destination = {
						parent: destinationParent.entry,
						name: destinationName,
						entry: yield* getInode(state, destinationInode, method, newPath),
						path: childPath(destinationParent.path, destinationName),
					};
					if (source.entry._tag === "Directory" && destination.entry._tag !== "Directory") {
						return yield* badResource(method, newPath, "ENOTDIR", "Cannot replace a non-directory with a directory");
					}
					if (source.entry._tag !== "Directory" && destination.entry._tag === "Directory") {
						return yield* badResource(method, newPath, "EISDIR", "Cannot replace a directory with a non-directory");
					}
					if (destination.entry._tag === "Directory" && HashMap.size(destination.entry.entries) > 0) {
						return yield* errnoError(method, newPath, "ENOTEMPTY", "Directory is not empty");
					}
				}
				const now = yield* DateTime.now;
				let nextState = state;
				if (destination !== undefined) {
					nextState = yield* detachEntry(nextState, destination, now, false, method, newPath);
				}

				const sourceParent = yield* getDirectory(nextState, source.parent.ino, method, oldPath);
				const moved = yield* getInode(nextState, source.entry.ino, method, oldPath);
				if (sourceParent.ino === destinationParent.inode) {
					nextState = setInode(nextState, {
						...sourceParent,
						entries: HashMap.set(HashMap.remove(sourceParent.entries, source.name), destinationName, moved.ino),
						mtime: now,
						ctime: now,
					});
				} else {
					const nextDestinationParent = yield* getDirectory(nextState, destinationParent.inode, method, newPath);
					nextState = setInode(nextState, {
						...sourceParent,
						entries: HashMap.remove(sourceParent.entries, source.name),
						nlink: moved._tag === "Directory" ? sourceParent.nlink - 1 : sourceParent.nlink,
						mtime: now,
						ctime: now,
					});
					nextState = setInode(nextState, {
						...nextDestinationParent,
						entries: HashMap.set(nextDestinationParent.entries, destinationName, moved.ino),
						nlink: moved._tag === "Directory" ? nextDestinationParent.nlink + 1 : nextDestinationParent.nlink,
						mtime: now,
						ctime: now,
					});
				}
				nextState = setInode(nextState, { ...moved, ctime: now });
				return transitionResult(nextState, undefined, [
					{ _tag: "Remove", path: source.path },
					{ _tag: "Create", path: childPath(destinationParent.path, destinationName) },
				]);
			}),
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
	depth?: number,
) => Effect.Effect<readonly [State, Inode], PlatformError> = Effect.fnUntraced(function* (
	state,
	source,
	context,
	depth = 0,
) {
	const { method, sourcePath: path, preserveTimestamps } = context;
	if (depth > MAX_NESTING_DEPTH) {
		return yield* volumeLimit(method, path, "Directory tree exceeds the maximum nesting depth");
	}
	const applyMetadata = (state: State, entry: InodeEntry): State =>
		setInode(state, {
			...entry,
			mode: source.mode,
			mtime: preserveTimestamps ? source.mtime : entry.mtime,
		});
	return yield* InodeEntry.match(source, {
		File: Effect.fn("File")(function* (source: FileInode) {
				const [createdState, inode] = yield* createFile(state, source.data);
				const nextState = applyMetadata(createdState, yield* getInode(createdState, inode, method, path));
				return [nextState, inode] as const;
			}),
		SymbolicLink: Effect.fn("SymbolicLink")(function* (source: SymbolicLinkInode) {
				const [createdState, inode] = yield* createSymbolicLink(state, source.target);
				const nextState = applyMetadata(createdState, yield* getInode(createdState, inode, method, path));
				return [nextState, inode] as const;
			}),
		Directory: Effect.fn("Directory")(function* (source: DirectoryInode) {
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
});

// PORT NOTE: `depth` bounds the recursion at MAX_NESTING_DEPTH, failing typed —
// upstream recursed unbounded.
const validateCopyDirectoryContents: (
	state: State,
	source: DirectoryInode,
	destination: DirectoryInode,
	overwrite: boolean,
	method: string,
	path: string,
	depth?: number,
) => Effect.Effect<void, PlatformError> = Effect.fnUntraced(function* (
	state,
	source,
	destination,
	overwrite,
	method,
	path,
	depth = 0,
) {
	if (depth > MAX_NESTING_DEPTH) {
		return yield* volumeLimit(method, path, "Directory tree exceeds the maximum nesting depth");
	}
	for (const [name, sourceInode] of source.entries) {
		const sourceEntry = yield* getInode(state, sourceInode, method, path);
		// KIT EXTENSION (case folding): folded lookup.
		const destinationInode = findEntry(state, destination, name);
		if (destinationInode === undefined) continue;
		const destinationEntry = yield* getInode(state, destinationInode, method, path);
		if (sourceEntry._tag === "Directory" && destinationEntry._tag === "Directory") {
			yield* validateCopyDirectoryContents(state, sourceEntry, destinationEntry, overwrite, method, path, depth + 1);
			continue;
		}
		// KIT EXTENSION (errno fidelity): node's `fs.cp` checks entry kinds before
		// it consults `force`, so a kind mismatch fails even without overwrite.
		if (sourceEntry._tag === "Directory") {
			return yield* errnoError(
				method,
				path,
				"ERR_FS_CP_DIR_TO_NON_DIR",
				"Cannot replace a non-directory with a directory",
			);
		}
		if (destinationEntry._tag === "Directory") {
			return yield* errnoError(
				method,
				path,
				"ERR_FS_CP_NON_DIR_TO_DIR",
				"Cannot replace a directory with a non-directory",
			);
		}
		// A file-onto-file conflict without overwrite is left to the caller's
		// top-level AlreadyExists, so a kind mismatch anywhere in the tree wins.
	}
});

// PORT NOTE: `depth` bounds the recursion at MAX_NESTING_DEPTH, failing typed —
// upstream recursed unbounded.
const copyDirectoryContents: (
	state: State,
	source: DirectoryInode,
	destination: DirectoryInode,
	method: string,
	path: string,
	preserveTimestamps: boolean,
	depth?: number,
) => Effect.Effect<State, PlatformError> = Effect.fnUntraced(function* (
	state,
	source,
	destination,
	method,
	path,
	preserveTimestamps,
	depth = 0,
) {
	if (depth > MAX_NESTING_DEPTH) {
		return yield* volumeLimit(method, path, "Directory tree exceeds the maximum nesting depth");
	}
	let nextState = state;
	const cloneContext = { method, sourcePath: path, preserveTimestamps } satisfies CloneContext;
	const children = A.sort(source.entries, InodeNameOrder);
	for (const [name, sourceInode] of children) {
		const sourceEntry = yield* getInode(nextState, sourceInode, method, path);
		const currentDestination = yield* getDirectory(nextState, destination.ino, method, path);
		// KIT EXTENSION (case folding): a folded-equal
		// destination child is detached by its STORED key and the copy linked under
		// the SOURCE spelling — node's async `fs.cp` unlinks then recreates
		// (host-proven: `x.txt` replaced from `X.txt` lists as `X.txt`).
		const found = lookupEntry(nextState, currentDestination, name);
		const destinationName = found?.[0] ?? name;
		const destinationInode = found?.[1];
		if (sourceEntry._tag === "Directory" && destinationInode !== undefined) {
			const destinationEntry = yield* getInode(nextState, destinationInode, method, path);
			if (destinationEntry._tag === "Directory") {
				nextState = yield* copyDirectoryContents(
					nextState,
					sourceEntry,
					destinationEntry,
					method,
					path,
					preserveTimestamps,
					depth + 1,
				);
				continue;
			}
		}
		if (destinationInode !== undefined) {
			const destinationEntry = yield* getInode(nextState, destinationInode, method, path);
			const now = yield* DateTime.now;
			nextState = yield* detachEntry(
				nextState,
				{
					parent: currentDestination,
					name: destinationName,
					entry: destinationEntry,
					path: childPath(path, destinationName),
				},
				now,
				false,
				method,
				path,
			);
		}
		const [clonedState, clone] = yield* cloneInode(nextState, sourceEntry, cloneContext);
		nextState = clonedState;
		if (sourceEntry._tag === "Directory") {
			nextState = yield* attachDirectory(nextState, destination.ino, name, clone, method);
		} else {
			nextState = yield* linkInode(nextState, destination.ino, name, clone, method);
		}
	}
	return nextState;
});

const resolveCopyFileDestination = Effect.fnUntraced(function* (state: State, path: string, method: string) {
	let candidate = path;
	while (true) {
		const unresolved = yield* Effect.result(
			resolve(state, candidate, {
				followFinalSymbolicLink: false,
				method,
			}),
		);
		if (unresolved._tag === "Failure") {
			if (unresolved.failure.reason._tag === "NotFound") {
				return yield* resolveParent(state, candidate, method, path, "EISDIR");
			}
			return yield* withSystemErrorPath(unresolved.failure, method, path);
		}
		if (unresolved.success.entry._tag !== "SymbolicLink") {
			return yield* resolveParent(state, unresolved.success.path, method, path);
		}
		const resolved = yield* Effect.result(resolve(state, candidate, { method }));
		if (resolved._tag === "Success") {
			return yield* resolveParent(state, resolved.success.path, method, path);
		}
		if (resolved.failure.reason._tag !== "NotFound" || unresolved.success.entry.target.length === 0) {
			return yield* withSystemErrorPath(resolved.failure, method, path);
		}
		candidate = symbolicLinkTargetPath(unresolved.success.path, unresolved.success.entry.target);
	}
});

const copyFileUnlocked = Effect.fnUntraced(function* (state: State, fromPath: string, toPath: string) {
	const method = "copyFile";
	const source = yield* resolve(state, fromPath, { method }).pipe(
		Effect.mapError((error) => withSystemErrorPath(error, method, fromPath)),
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
});

const copyEntryUnlocked = Effect.fnUntraced(function* (
	state: State,
	fromPath: string,
	toPath: string,
	overwrite: boolean,
	preserveTimestamps: boolean,
) {
	const method = "copy";
	const source = yield* resolve(state, fromPath, {
		followFinalSymbolicLink: false,
		method,
	}).pipe(Effect.mapError((error) => withSystemErrorPath(error, method, fromPath)));
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
	const existingInode = found?.[1];
	let existing: InodeEntry | undefined;
	if (existingInode !== undefined) {
		existing = yield* getInode(state, existingInode, method, toPath);
		// KIT EXTENSION (errno fidelity): node's `fs.cp` rejects a source and
		// destination that are one inode (the same path, or two hard links) and
		// a directory/non-directory mismatch BEFORE it consults `force`, with its
		// own ERR_FS_CP_* codes (tag Unknown).
		if (existingInode === source.inode) {
			return yield* errnoError(method, toPath, "ERR_FS_CP_EINVAL", "Source and destination are the same entry");
		}
		if (source.entry._tag === "Directory" && existing._tag !== "Directory") {
			return yield* errnoError(method, toPath, "ERR_FS_CP_DIR_TO_NON_DIR", "Destination is not a directory");
		}
		if (source.entry._tag !== "Directory" && existing._tag === "Directory") {
			return yield* errnoError(method, toPath, "ERR_FS_CP_NON_DIR_TO_DIR", "Destination is a directory");
		}
		if (source.entry._tag === "Directory" && existing._tag === "Directory") {
			yield* validateCopyDirectoryContents(state, source.entry, existing, overwrite, method, toPath);
		}
		// PORT NOTE: upstream reported `fromPath` here — the one conflict arm in
		// this function blaming the SOURCE while every sibling arm reports the
		// destination. The conflict is the existing DESTINATION entry, so the
		// error names `toPath` (upstream 6573 bug, fixed in this port).
		// Known divergence, kept: node's `fs.cp` without `force` silently keeps
		// an existing destination instead of failing.
		if (!overwrite) return yield* alreadyExists(method, toPath);
	}

	if (source.entry._tag === "Directory" && existing?._tag === "Directory") {
		const nextState = yield* copyDirectoryContents(state, source.entry, existing, method, toPath, preserveTimestamps);
		return [nextState, true] as const;
	}

	let [nextState, inode] = yield* cloneInode(state, source.entry, {
		method,
		sourcePath: fromPath,
		preserveTimestamps,
	});
	const entry = yield* getInode(nextState, inode, method, toPath);
	const now = yield* DateTime.now;
	if (existing !== undefined) {
		nextState = yield* detachEntry(
			nextState,
			{
				parent: destination.entry,
				name: destinationName,
				entry: existing,
				path: childPath(destination.path, destinationName),
			},
			now,
			true,
			method,
			toPath,
		);
	}
	if (entry._tag === "Directory") {
		nextState = yield* attachDirectory(nextState, destination.inode, destination.name, inode, method);
	} else {
		nextState = yield* linkInode(nextState, destination.inode, destination.name, inode, method);
	}
	return [nextState, true] as const;
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
					existing._tag === "Success"
						? inodeUpdateEvents(nextState, destination.inode)
						: [{ _tag: "Create", path: destination.path }],
				);
			}),
		);
	});

const copy = (volume: Volume) =>
	Effect.fnUntraced(function* (
		fromPath: string,
		toPath: string,
		options?: { readonly overwrite?: boolean | undefined; readonly preserveTimestamps?: boolean | undefined },
	) {
		return yield* volume.mutate(
			Effect.fnUntraced(function* (state) {
				const existing = yield* Effect.result(
					resolve(state, toPath, {
						followFinalSymbolicLink: false,
						method: "copy",
					}),
				);
				const [nextState, changed] = yield* copyEntryUnlocked(
					state,
					fromPath,
					toPath,
					options?.overwrite === true,
					options?.preserveTimestamps === true,
				);
				if (!changed) return transitionResult(nextState, undefined);
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
			}),
		);
	});

// =============================================================================
// open file descriptors
// =============================================================================

const openDescriptorUnlocked: (
	state: State,
	path: string,
	options?: OpenOptions,
) => Effect.Effect<readonly [State, OpenFileDescriptor], PlatformError> = Effect.fnUntraced(
	function* (state, path, options) {
		const flag = options?.flag ?? "r";
		if (!isOpenFlag(flag)) {
			return yield* argumentError("open", "flag must be a supported file-open flag");
		}
		const mode = openMode(flag);
		yield* validateMode("open", options?.mode);
		let entry: FileInode | undefined;
		let candidatePath = path;
		let nextState = state;

		while (entry === undefined) {
			const unresolved = yield* Effect.result(
				resolve(nextState, candidatePath, {
					followFinalSymbolicLink: false,
					method: "open",
				}),
			);

			if (unresolved._tag === "Success") {
				if (mode.exclusive) {
					return yield* alreadyExists("open", path);
				}
				const resolved = yield* Effect.result(resolve(nextState, candidatePath, { method: "open" }));
				if (resolved._tag === "Failure") {
					if (
						unresolved.success.entry._tag === "SymbolicLink" &&
						unresolved.success.entry.target.length > 0 &&
						resolved.failure.reason._tag === "NotFound" &&
						mode.create
					) {
						candidatePath = symbolicLinkTargetPath(unresolved.success.path, unresolved.success.entry.target);
						continue;
					}
					return yield* withSystemErrorPath(resolved.failure, "open", path);
				}
				if (resolved.success.entry._tag !== "File") {
					return yield* badResource("open", path, "EISDIR");
				}
				entry = resolved.success.entry;
				if (mode.truncate) {
					const now = yield* DateTime.now;
					entry = {
						...entry,
						data: new Uint8Array(),
						mtime: now,
						ctime: now,
					};
					nextState = setInode(nextState, entry);
				}
				continue;
			}

			if (unresolved.failure.reason._tag !== "NotFound" || !mode.create) {
				return yield* withSystemErrorPath(unresolved.failure, "open", path);
			}
			const parent = yield* resolveParent(nextState, candidatePath, "open", path, "EISDIR");
			// KIT EXTENSION (case folding)
			if (findEntry(nextState, parent.entry, parent.name) !== undefined) {
				continue;
			}
			const [createdState, inode] = yield* createFile(nextState);
			nextState = createdState;
			let created = yield* getInode(nextState, inode, "open", path);
			if (created._tag !== "File") {
				return yield* Effect.die(VolumeInvariantError.make({ message: "MemoryFileSystem.createFile produced a non-file inode" }));
			}
			if (options?.mode !== undefined) {
				created = {
					...created,
					mode: FILE_TYPE_MODE | (options.mode & PERMISSION_MODE),
				};
				nextState = setInode(nextState, created);
			}
			const linked = yield* Effect.result(linkInode(nextState, parent.inode, parent.name, inode, "open"));
			if (linked._tag === "Failure") {
				nextState = reclaimInode(nextState, created);
				if (linked.failure.reason._tag === "AlreadyExists" && !mode.exclusive) {
					continue;
				}
				return yield* linked.failure;
			}
			nextState = linked.success;
			const linkedEntry = yield* getInode(nextState, inode, "open", path);
			if (linkedEntry._tag !== "File") {
				return yield* Effect.die(VolumeInvariantError.make({ message: "MemoryFileSystem.linkInode produced a non-file inode" }));
			}
			entry = linkedEntry;
		}

		const fd = FileDescriptor.make(nextState.nextDescriptor);
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
				...nextState,
				nextDescriptor: nextState.nextDescriptor + 1,
				descriptors: HashMap.set(nextState.descriptors, fd, descriptor),
				inodes: HashMap.set(nextState.inodes, entry.ino, {
					...entry,
					openCount: entry.openCount + 1,
				}),
			},
			descriptor,
		] as const;
	},
);

const openDescriptor: (
	volume: Volume,
	path: string,
	options?: OpenOptions,
) => Effect.Effect<FileDescriptor, PlatformError> = Effect.fnUntraced(function* (volume, path, options) {
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
				tag === "Update" ? inodeUpdateEvents(nextState, descriptor.inode) : [{ _tag: "Create", path: resolved.path }],
			);
		}),
	);
});

const closeDescriptorUnlocked = (state: State, fd: FileDescriptor): State => {
	const descriptor = O.getOrUndefined(HashMap.get(state.descriptors, fd));
	if (descriptor === undefined) return state;
	let nextState = {
		...state,
		descriptors: HashMap.remove(state.descriptors, fd),
	};
	const entry = findInode(nextState, descriptor.inode);
	if (entry === undefined) return nextState;
	const nextEntry = { ...entry, openCount: entry.openCount - 1 };
	nextState = setInode(nextState, nextEntry);
	return reclaimInode(nextState, nextEntry);
};

// NOTE: Closing is idempotent so a scope finalizer cannot decrement an inode's
// open-reference count more than once.
const closeDescriptor = Effect.fnUntraced(function* (volume: Volume, fd: FileDescriptor) {
	return yield* volume.mutate((state) =>
		Effect.succeed(transitionResult(closeDescriptorUnlocked(state, fd), undefined)),
	);
});

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
		entry._tag === "File"
			? entry.data.length
			: entry._tag === "SymbolicLink"
				? new TextEncoder().encode(entry.target).length
				: 0,
	),
	blksize: O.none(),
	blocks: O.none(),
});

const readDescriptorUnlocked = Effect.fnUntraced(function* (
	state: State,
	fd: FileDescriptor,
	length: number,
	method: string,
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
});

const readDescriptor = (volume: Volume, fd: FileDescriptor, buffer: Uint8Array, method: string) =>
	volume.mutate((state) =>
		Effect.map(readDescriptorUnlocked(state, fd, buffer.length, method), (result) => {
			buffer.set(result.bytes);
			return transitionResult(result.state, result.size);
		}),
	);

const writeDescriptorUnlocked = Effect.fnUntraced(function* (
	state: State,
	fd: FileDescriptor,
	buffer: Uint8Array,
	method: string,
) {
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
});

const writeDescriptor = (volume: Volume, fd: FileDescriptor, buffer: Uint8Array, method: string) =>
	volume.mutate(
		Effect.fnUntraced(function* (state) {
			const [nextState, written] = yield* writeDescriptorUnlocked(state, fd, buffer, method);
			if (written === 0) return transitionResult(nextState, written);
			const descriptor = O.getOrUndefined(HashMap.get(nextState.descriptors, fd));
			return transitionResult(
				nextState,
				written,
				descriptor === undefined ? [] : inodeUpdateEvents(nextState, descriptor.inode),
			);
		}),
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
			Effect.map(getOpenFile(state, this.fd, "stat"), ([, entry]) => fileInfo(entry)),
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
						position,
					),
				);
			}),
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
				bytesRead === 0 ? O.none() : O.some(bytesRead === size ? buffer : buffer.slice(0, bytesRead)),
			),
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
				}),
			),
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
		Effect.map((fd) => new MemoryFile(volume, fd)),
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
	prefix = "",
): Array<string> => {
	const output: Array<string> = [];
	interface Frame {
		readonly names: Array<string>;
		readonly directory: DirectoryInode;
		readonly prefix: string;
		index: number;
	}
	const frames: Array<Frame> = [{ names: A.sort(HashMap.keys(directory.entries), Order.String), directory, prefix, index: 0 }];
	while (frames.length > 0) {
		const frame = frames[frames.length - 1];
		if (frame === undefined) break;
		if (frame.index >= frame.names.length) {
			frames.pop();
			continue;
		}
		const name = frame.names[frame.index];
		frame.index += 1;
		if (name === undefined) continue;
		const relativePath = frame.prefix.length === 0 ? name : `${frame.prefix}/${name}`;
		output.push(relativePath);
		if (!recursive) continue;
		// KIT EXTENSION (case folding): `name` is a stored key; exact hit.
		const inode = findEntry(state, frame.directory, name);
		const child = inode === undefined ? undefined : findInode(state, inode);
		if (child?._tag === "Directory") {
			frames.push({
				names: A.sort(HashMap.keys(child.entries), Order.String),
				directory: child,
				prefix: relativePath,
				index: 0,
			});
		}
	}
	return output;
};

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
					collectDirectoryEntries(nextState, resolved.entry, options?.recursive === true),
				);
			}),
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
			}),
		);
	});

const writeFile =
	(volume: Volume) =>
	(
		path: string,
		data: Uint8Array,
		options?: { readonly flag?: FileSystem.OpenFlag | undefined; readonly mode?: number | undefined },
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
					const tag = existing._tag === "Failure" ? "Create" : mode.truncate || data.length > 0 ? "Update" : undefined;
					if (tag === undefined) return transitionResult(nextState, undefined);
					const resolved = yield* resolve(nextState, path, { method: "writeFile" });
					return transitionResult(
						nextState,
						undefined,
						tag === "Update" ? inodeUpdateEvents(nextState, resolved.inode) : [{ _tag: "Create", path: resolved.path }],
					);
				}),
			)
			.pipe(Effect.mapError((error) => withOperationError(error, "writeFile", path)));

// node validates the length as an integer, then clamps a negative one to 0
// (`truncate(path, -1)` empties the file rather than failing).
const validateSize = (method: string, size: number | undefined) => {
	const value = size ?? 0;
	return Number.isSafeInteger(value)
		? Effect.succeed(Math.max(0, value))
		: Effect.fail(argumentError(method, "size must be a safe integer"));
};

const allocatePathBytes = (length: number, method: string, path: string) =>
	Effect.try({
		try: () => new Uint8Array(length),
		catch: () => volumeLimit(method, path, "Unable to allocate file bytes"),
	});

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
			}),
		);
	});

const stat = (volume: Volume) =>
	Effect.fnUntraced(function* (path: string) {
		return yield* volume.withState((state) =>
			Effect.map(resolve(state, path, { method: "stat" }), ({ entry }) => fileInfo(entry)),
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
			}),
		);
	});

const validateOwner = (method: string, name: string, value: number) =>
	Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff
		? Effect.void
		: Effect.fail(argumentError(method, `${name} must be an unsigned 32-bit integer`));

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
			}),
		);
	});

const dateTimeInput = (method: string, name: string, value: Date | number) => {
	const milliseconds = P.isNumber(value) ? value * 1000 : value.getTime();
	if (!Number.isFinite(milliseconds)) {
		return Effect.fail(argumentError(method, `${name} must be a valid Date or epoch-seconds number`));
	}
	const parsed = DateTime.make(milliseconds);
	return Effect.fromOption(parsed, () => argumentError(method, `${name} is outside the supported date range`));
};

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
			}),
		);
	});

// =============================================================================
// temporary resources
// =============================================================================

const validateTemporaryFragment = (method: string, name: string, value: string) =>
	value.includes("/") || value.includes("\0")
		? Effect.fail(argumentError(method, `${name} must be a file-name fragment`))
		: Effect.void;

const allocateTemporaryToken = (state: State): readonly [State, string] => [
	{ ...state, nextTemporary: state.nextTemporary + 1 },
	state.nextTemporary.toString(36).padStart(8, "0"),
];

const allocateTempDirectory = Effect.fnUntraced(function* (
	state: State,
	method: string,
	parentPath: string,
	prefix: string,
) {
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
});

const makeTempDirectoryWithMethod = Effect.fnUntraced(function* (
	volume: Volume,
	method: string,
	options?: { readonly directory?: string | undefined; readonly prefix?: string | undefined },
) {
	const prefix = options?.prefix ?? "";
	yield* validateTemporaryFragment(method, "prefix", prefix);
	return yield* volume.mutate((state) =>
		Effect.map(allocateTempDirectory(state, method, options?.directory ?? TEMP_DIR, prefix), ([nextState, directory]) =>
			transitionResult(nextState, directory.path, [{ _tag: "Create", path: directory.path }]),
		),
	);
});

const makeTempDirectory =
	(volume: Volume) => (options?: { readonly directory?: string | undefined; readonly prefix?: string | undefined }) =>
		makeTempDirectoryWithMethod(volume, "makeTempDirectory", options);

const makeTempDirectoryScoped =
	(volume: Volume) => (options?: { readonly directory?: string | undefined; readonly prefix?: string | undefined }) =>
		Effect.acquireRelease(makeTempDirectoryWithMethod(volume, "makeTempDirectoryScoped", options), (path) =>
			Effect.orDie(remove(volume)(path, { recursive: true, force: true })),
		);

const makeTempFileWithMethod = Effect.fnUntraced(function* (
	volume: Volume,
	method: string,
	options?: {
		readonly directory?: string | undefined;
		readonly prefix?: string | undefined;
		readonly suffix?: string | undefined;
	},
) {
	const prefix = options?.prefix ?? "";
	const suffix = options?.suffix ?? "";
	yield* validateTemporaryFragment(method, "prefix", prefix);
	yield* validateTemporaryFragment(method, "suffix", suffix);
	return yield* volume.mutateInterruptibly((state) =>
		Effect.gen(function* () {
			let [nextState, directory] = yield* allocateTempDirectory(state, method, options?.directory ?? TEMP_DIR, prefix);
			const [allocatedState, token] = allocateTemporaryToken(nextState);
			nextState = allocatedState;
			const name = `${token}${suffix}`;
			const [createdState, inode] = yield* createFile(nextState);
			nextState = createdState;
			nextState = yield* linkInode(nextState, directory.inode, name, inode, method);
			const path = childPath(directory.path, name);
			return transitionResult(nextState, path, [{ _tag: "Create", path }]);
		}).pipe(Effect.mapError((error) => withOperationError(error, method, options?.directory ?? TEMP_DIR))),
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
			const separator = path.lastIndexOf("/");
			const directory = separator <= 0 ? "/" : path.slice(0, separator);
			return Effect.orDie(remove(volume)(directory, { recursive: true, force: true }));
		});

// =============================================================================
// globbing
// =============================================================================

const MAX_BRACE_EXPANSIONS = 256;

const GlobLiteral = S.Struct({
 _tag: S.tag("Literal").pipe($I.annoteKey("GlobLiteral._tag", { description: "The glob token variant." })),
 value: S.String.pipe($I.annoteKey("GlobLiteral.value", { description: "The literal character." }))
}).pipe($I.annoteSchema("GlobLiteral", { description: "The engine GlobLiteral data." }));
type GlobLiteral = typeof GlobLiteral.Type;
const GlobStar = S.Struct({
 _tag: S.tag("Star").pipe($I.annoteKey("GlobStar._tag", { description: "The glob token variant." }))
}).pipe($I.annoteSchema("GlobStar", { description: "The engine GlobStar data." }));
type GlobStar = typeof GlobStar.Type;
const GlobOne = S.Struct({
 _tag: S.tag("One").pipe($I.annoteKey("GlobOne._tag", { description: "The glob token variant." }))
}).pipe($I.annoteSchema("GlobOne", { description: "The engine GlobOne data." }));
type GlobOne = typeof GlobOne.Type;
const GlobCharacterClass = S.Struct({
 _tag: S.tag("CharacterClass").pipe($I.annoteKey("GlobCharacterClass._tag", { description: "The glob token variant." })),
 negated: S.Boolean.pipe($I.annoteKey("GlobCharacterClass.negated", { description: "Whether the class is negated." })),
 ranges: S.Array(S.Tuple([S.String, S.String])).pipe($I.annoteKey("GlobCharacterClass.ranges", { description: "The inclusive character ranges." })),
 literals: S.Array(S.String).pipe($I.annoteKey("GlobCharacterClass.literals", { description: "The class literal characters." }))
}).pipe($I.annoteSchema("GlobCharacterClass", { description: "The engine GlobCharacterClass data." }));
type GlobCharacterClass = typeof GlobCharacterClass.Type;
const GlobToken = S.Union([GlobLiteral, GlobStar, GlobOne, GlobCharacterClass]).pipe(
 S.toTaggedUnion("_tag"), $I.annoteSchema("GlobToken", { description: "A compiled glob token." }),
);
type GlobToken = typeof GlobToken.Type;
const GlobSegment = S.Struct({
 _tag: S.tag("Segment").pipe($I.annoteKey("GlobSegment._tag", { description: "The segment variant." })),
 tokens: S.Array(GlobToken).pipe($I.annoteKey("GlobSegment.tokens", { description: "The compiled tokens." })),
 startsWithDot: S.Boolean.pipe($I.annoteKey("GlobSegment.startsWithDot", { description: "Whether the segment explicitly starts with a dot." }))
}).pipe($I.annoteSchema("GlobSegment", { description: "The engine GlobSegment data." }));
type GlobSegment = typeof GlobSegment.Type;
const GlobGlobstar = S.Struct({
 _tag: S.tag("Globstar").pipe($I.annoteKey("GlobGlobstar._tag", { description: "A recursive globstar segment." }))
}).pipe($I.annoteSchema("GlobGlobstar", { description: "The engine GlobGlobstar data." }));
type GlobGlobstar = typeof GlobGlobstar.Type;
const CompiledGlobSegment = S.Union([GlobSegment, GlobGlobstar]).pipe(
 S.toTaggedUnion("_tag"), $I.annoteSchema("CompiledGlobSegment", { description: "A normal or recursive glob segment." }),
);
type CompiledGlobSegment = typeof CompiledGlobSegment.Type;
const CompiledGlobPattern = S.Struct({
 segments: S.Array(CompiledGlobSegment).pipe($I.annoteKey("CompiledGlobPattern.segments", { description: "The compiled path segments." })),
 directoryOnly: S.Boolean.pipe($I.annoteKey("CompiledGlobPattern.directoryOnly", { description: "Whether a trailing slash requires a directory." }))
}).pipe($I.annoteSchema("CompiledGlobPattern", { description: "The engine CompiledGlobPattern data." }));
type CompiledGlobPattern = typeof CompiledGlobPattern.Type;
const BraceExpansion = S.Struct({
 start: S.Finite.pipe($I.annoteKey("BraceExpansion.start", { description: "The opening brace offset." })),
 end: S.Finite.pipe($I.annoteKey("BraceExpansion.end", { description: "The closing brace offset." })),
 alternatives: S.Array(S.String).pipe($I.annoteKey("BraceExpansion.alternatives", { description: "The expansion alternatives." }))
}).pipe($I.annoteSchema("BraceExpansion", { description: "The engine BraceExpansion data." }));
type BraceExpansion = typeof BraceExpansion.Type;
const GlobCharacterClassAtom = S.Struct({
 value: S.String.pipe($I.annoteKey("GlobCharacterClassAtom.value", { description: "The class character." })),
 escaped: S.Boolean.pipe($I.annoteKey("GlobCharacterClassAtom.escaped", { description: "Whether the character was escaped." }))
}).pipe($I.annoteSchema("GlobCharacterClassAtom", { description: "The engine GlobCharacterClassAtom data." }));
type GlobCharacterClassAtom = typeof GlobCharacterClassAtom.Type;

const globSyntaxCharacters: HashSet.HashSet<string> = HashSet.make("*", "?", "[", "]", "{", "}", ",", "\\");

const findBraceExpansion = (pattern: string): BraceExpansion | undefined => {
	for (let start = 0; start < pattern.length; start++) {
		if (pattern[start] === "\\") {
			start += 1;
			continue;
		}
		if (pattern[start] !== "{") continue;
		let depth = 1;
		let characterClass = false;
		let closed = false;
		const commas: Array<number> = [];
		for (let end = start + 1; end < pattern.length; end++) {
			if (pattern[end] === "\\") {
				end += 1;
				continue;
			}
			if (pattern[end] === "[") {
				characterClass = true;
			} else if (pattern[end] === "]") {
				characterClass = false;
			} else if (!characterClass && pattern[end] === "{") {
				depth += 1;
			} else if (!characterClass && pattern[end] === "}") {
				depth -= 1;
				if (depth === 0) {
					closed = true;
					if (commas.length === 0) {
						const nested = findBraceExpansion(pattern.slice(start + 1, end));
						if (nested !== undefined) {
							return {
								start: start + nested.start + 1,
								end: start + nested.end + 1,
								alternatives: nested.alternatives,
							};
						}
						start = end;
						break;
					}
					const alternatives: Array<string> = [];
					let alternativeStart = start + 1;
					for (const comma of [...commas, end]) {
						alternatives.push(pattern.slice(alternativeStart, comma));
						alternativeStart = comma + 1;
					}
					return { start, end, alternatives };
				}
			} else if (!characterClass && pattern[end] === "," && depth === 1) {
				commas.push(end);
			}
		}
		if (!closed) return undefined;
	}
	return undefined;
};

// PORT NOTE: a linear pre-scan bounds brace nesting at MAX_NESTING_DEPTH,
// failing typed — upstream let `findBraceExpansion` recurse unbounded into
// nested comma-free groups, so a deeply nested pattern was a stack-overflow
// defect. Alternatives substitute substrings, so expansion never deepens
// nesting and the one up-front scan bounds every later recursion.
const braceNestingDepth = (pattern: string): number => {
	let depth = 0;
	let maximum = 0;
	let characterClass = false;
	for (let index = 0; index < pattern.length; index++) {
		const character = pattern[index];
		if (character === "\\") {
			index += 1;
		} else if (character === "[") {
			characterClass = true;
		} else if (character === "]") {
			characterClass = false;
		} else if (!characterClass && character === "{") {
			depth += 1;
			maximum = Math.max(maximum, depth);
		} else if (!characterClass && character === "}") {
			depth = Math.max(0, depth - 1);
		}
	}
	return maximum;
};

const expandBraces = (method: string, pattern: string) => {
	if (braceNestingDepth(pattern) > MAX_NESTING_DEPTH) {
		return Effect.fail(argumentError(method, `brace nesting exceeds ${MAX_NESTING_DEPTH} levels`));
	}
	let patterns = [pattern];
	while (true) {
		const index = patterns.findIndex((pattern) => findBraceExpansion(pattern) !== undefined);
		if (index === -1) return Effect.succeed(patterns);
		const current = patterns[index];
		if (current === undefined) return Effect.succeed(patterns);
		const expansion = findBraceExpansion(current);
		if (expansion === undefined) return Effect.succeed(patterns);
		if (patterns.length - 1 + expansion.alternatives.length > MAX_BRACE_EXPANSIONS) {
			return Effect.fail(argumentError(method, `brace expansion exceeds ${MAX_BRACE_EXPANSIONS} alternatives`));
		}
		patterns = [
			...patterns.slice(0, index),
			...expansion.alternatives.map(
				(alternative) => `${current.slice(0, expansion.start)}${alternative}${current.slice(expansion.end + 1)}`,
			),
			...patterns.slice(index + 1),
		];
	}
};

const parseCharacterClass = (method: string, segment: string, start: number) => {
	let index = start + 1;
	const negated = segment[index] === "!";
	if (negated) index += 1;
	const characters: Array<GlobCharacterClassAtom> = [];
	while (index < segment.length) {
		if (segment[index] === "]" && characters.length > 0) break;
		let escaped = false;
		if (segment[index] === "\\") {
			escaped = true;
			index += 1;
			if (index === segment.length) {
				return argumentError(method, "character classes must not end with an escape");
			}
		}
		characters.push({ value: segment.charAt(index), escaped });
		index += 1;
	}
	if (index === segment.length || characters.length === 0) {
		return argumentError(method, "character classes must be closed and non-empty");
	}
	const literals: Array<string> = [];
	const ranges: Array<readonly [string, string]> = [];
	for (let characterIndex = 0; characterIndex < characters.length; characterIndex++) {
		const character = characters[characterIndex];
		if (character === undefined) continue;
		const separator = characters[characterIndex + 1];
		const rangeEnd = characters[characterIndex + 2];
		if (
			separator !== undefined &&
			rangeEnd !== undefined &&
			separator.value === "-" &&
			!separator.escaped &&
			rangeEnd.value !== "-"
		) {
			const end = rangeEnd.value;
			if (character.value > end) {
				return argumentError(method, "character class ranges must be ascending");
			}
			ranges.push([character.value, end]);
			characterIndex += 2;
		} else {
			literals.push(character.value);
		}
	}
	return Effect.succeed([GlobToken.cases.CharacterClass.make({ negated, ranges, literals }), index + 1] as const);
};

const parseGlobSegment = Effect.fnUntraced(function* (method: string, segment: string) {
	if (segment === "**") return { _tag: "Globstar" } satisfies GlobGlobstar;
	const tokens: Array<GlobToken> = [];
	let index = 0;
	while (index < segment.length) {
		const character = segment.charAt(index);
		if (character === "\\") {
			index += 1;
			if (index === segment.length) {
				return yield* argumentError(method, "patterns must not end with an escape");
			}
			const value = segment.charAt(index);
			if (HashSet.has(globSyntaxCharacters, value)) {
				tokens.push(GlobToken.cases.Literal.make({ value }));
			} else {
				tokens.push(GlobToken.cases.Literal.make({ value: "\\" }));
				index -= 1;
			}
		} else if (character === "*") {
			tokens.push(GlobToken.cases.Star.make({}));
		} else if (character === "?") {
			tokens.push(GlobToken.cases.One.make({}));
		} else if (character === "[") {
			const parsed = yield* parseCharacterClass(method, segment, index);
			tokens.push(parsed[0]);
			index = parsed[1] - 1;
		} else {
			tokens.push(GlobToken.cases.Literal.make({ value: character }));
		}
		index += 1;
	}
	return {
		_tag: "Segment",
		tokens,
		startsWithDot:
			(tokens[0]?._tag === "Literal" && tokens[0].value === ".") ||
			(tokens[0]?._tag === "CharacterClass" &&
				!tokens[0].negated &&
				(tokens[0].literals.includes(".") || tokens[0].ranges.some(([start, end]) => start <= "." && "." <= end))),
	} satisfies GlobSegment;
});

const compileGlobPattern = Effect.fnUntraced(function* (method: string, pattern: string) {
	if (pattern.length === 0 || pattern.includes("\0") || pattern.startsWith("/")) {
		return yield* argumentError(method, "pattern must be a root-relative POSIX glob");
	}
	const directoryOnly = pattern.endsWith("/");
	const path = directoryOnly ? pattern.slice(0, -1) : pattern;
	const segments = path.split("/");
	if (segments.includes("") || segments.includes(".") || segments.includes("..")) {
		return yield* argumentError(method, "pattern must not contain empty or dot path segments");
	}
	const compiled = yield* Effect.forEach(segments, (segment) => parseGlobSegment(method, segment));
	return { segments: compiled, directoryOnly } satisfies CompiledGlobPattern;
});

const compileGlobPatterns = Effect.fnUntraced(function* (method: string, pattern: string) {
	const expanded = yield* expandBraces(method, pattern);
	return yield* Effect.forEach(expanded, (alternative) => compileGlobPattern(method, alternative));
});

// KIT EXTENSION (case folding): `fold` matches
// the way a case-insensitive regex does — a literal compares folded, and a
// character class accepts the value in either case. Host-proven: node's
// `fs.glob` on a folding volume matches `*.JSON` against a stored `docs.json`.
const matchesGlobToken = (token: GlobToken, value: string, fold = false): boolean =>
	GlobToken.match(token, {
		Literal: (token) => token.value === value || (fold && token.value.toLowerCase() === value.toLowerCase()),
		Star: () => false,
		One: () => true,
		CharacterClass: (token) => {
			const inClass = (candidate: string) =>
				token.literals.includes(candidate) ||
				token.ranges.some(([start, end]) => start <= candidate && candidate <= end);
			const matches = inClass(value) || (fold && (inClass(value.toLowerCase()) || inClass(value.toUpperCase())));
			return token.negated ? !matches : matches;
		},
	});

// KIT EXTENSION (case folding): `fold`, see matchesGlobToken.
const matchesGlobSegment = (pattern: GlobSegment, value: string, fold = false): boolean => {
	if (value.startsWith(".") && !pattern.startsWithDot) return false;
	let patternIndex = 0;
	let valueIndex = 0;
	let starIndex = -1;
	let starValueIndex = -1;
	while (valueIndex < value.length) {
		const token = pattern.tokens[patternIndex];
		if (token !== undefined && token._tag !== "Star" && matchesGlobToken(token, value.charAt(valueIndex), fold)) {
			patternIndex += 1;
			valueIndex += 1;
		} else if (token?._tag === "Star") {
			starIndex = patternIndex;
			starValueIndex = valueIndex;
			patternIndex += 1;
		} else if (starIndex !== -1) {
			patternIndex = starIndex + 1;
			starValueIndex += 1;
			valueIndex = starValueIndex;
		} else {
			return false;
		}
	}
	while (pattern.tokens[patternIndex]?._tag === "Star") {
		patternIndex += 1;
	}
	return patternIndex === pattern.tokens.length;
};

// KIT EXTENSION (case folding): `fold`, see matchesGlobToken.
const matchesGlob = (
	pattern: CompiledGlobPattern,
	path: ReadonlyArray<string>,
	directory: boolean,
	fold = false,
): boolean => {
	if (pattern.directoryOnly && !directory) return false;
	let next = A.makeBy(path.length + 1, (index) => index === path.length);
	for (let patternIndex = pattern.segments.length - 1; patternIndex >= 0; patternIndex--) {
		const current = A.makeBy(path.length + 1, () => false);
		const segment = pattern.segments[patternIndex];
		if (segment === undefined) continue;
		if (segment._tag === "Globstar") {
			for (let pathIndex = path.length; pathIndex >= 0; pathIndex--) {
				current[pathIndex] =
					next[pathIndex] === true || (pathIndex < path.length && path[pathIndex]?.startsWith(".") === false && current[pathIndex + 1] === true);
			}
		} else {
			for (let pathIndex = path.length - 1; pathIndex >= 0; pathIndex--) {
				const part = path[pathIndex];
				current[pathIndex] = part !== undefined && matchesGlobSegment(segment, part, fold) && next[pathIndex + 1] === true;
			}
		}
		next = current;
	}
	return next[0] === true;
};

const glob = (volume: Volume) =>
	Effect.fnUntraced(function* (
		pattern: string,
		options?: { readonly root?: string | undefined; readonly exclude?: ReadonlyArray<string> | undefined },
	) {
		const includes = yield* compileGlobPatterns("glob", pattern);
		const excludes = yield* Effect.forEach(options?.exclude ?? [], (excluded) =>
			compileGlobPatterns("glob", excluded),
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
				// KIT EXTENSION (case folding)
				const fold = !state.caseSensitive;
				const rootExcluded = excludes.some((pattern) => matchesGlob(pattern, [], true, fold));
				if (rootExcluded) return [];
				const matches: Array<string> = includes.some((pattern) => matchesGlob(pattern, [], true, fold)) ? ["."] : [];
				const pending: Array<readonly [DirectoryInode, ReadonlyArray<string>]> = [[resolved.entry, []]];
				while (pending.length > 0) {
					const next = pending.pop();
					if (next === undefined) break;
					const [directory, parent] = next;
					for (const name of A.sort(HashMap.keys(directory.entries), Order.String)) {
						const path = [...parent, name];
						// KIT EXTENSION (case folding): folded lookup.
						const inode = findEntry(state, directory, name);
						const entry = inode === undefined ? undefined : findInode(state, inode);
						const isDirectory = entry?._tag === "Directory";
						const excluded = excludes.some((pattern) => matchesGlob(pattern, path, isDirectory, fold));
						if (!excluded && includes.some((pattern) => matchesGlob(pattern, path, isDirectory, fold))) {
							matches.push(path.join("/"));
						}
						if (excluded) continue;
						if (entry?._tag === "Directory") pending.push([entry, path]);
					}
				}
				return A.sort(matches, Order.String);
			}),
		);
	});

// =============================================================================
// volume
// =============================================================================

// KIT EXTENSION (case folding): the engine's build-time options.
/** @internal */
export interface EngineOptions {
	readonly caseSensitive: boolean;
}
const defaultEngineOptions: EngineOptions = { caseSensitive: true };

const makeVolume = Effect.fn("makeVolume")(function* (options: EngineOptions) {
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
				Effect.as(result.value),
			);

		const commit = <A, E, R>(use: (state: State) => Effect.Effect<TransitionResult<A>, E, R>): Effect.Effect<A, E, R> =>
			Effect.flatMap(
				Effect.suspend(() => use(state)),
				commitResult,
			);

		const withState: Volume["withState"] = (use) => lock.withPermit(Effect.suspend(() => use(state)));
		const mutate: Volume["mutate"] = (use) => lock.withPermit(Effect.uninterruptible(commit(use)));
		const mutateInterruptibly: Volume["mutateInterruptibly"] = (use) =>
			lock.withPermit(
				Effect.uninterruptibleMask((restore) =>
					Effect.flatMap(restore(Effect.suspend(() => use(state))), commitResult),
				),
			);

		return { currentState: () => state, mutate, mutateInterruptibly, watchers, withState, allocateSubscriptionId: () => nextSubscriptionId++ } satisfies Volume;
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
					}),
				),
				(subscription) =>
					volume.withState(() =>
						Effect.sync(() => {
							MutableHashMap.remove(volume.watchers, subscription.id);
						}),
					),
			),
			(subscription) =>
				Stream.callback<FileSystem.WatchEvent, PlatformError>((queue) =>
					Effect.sync(() => {
						subscription.queue = queue;
						for (const event of subscription.pending) {
							Queue.offerUnsafe(queue, event);
						}
						subscription.pending.length = 0;
					}),
				),
		),
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

const makeReadyVolume: (options: EngineOptions) => Effect.Effect<Volume> = Effect.fn("makeReadyVolume")(function* (options) {
	const volume = yield* makeVolume(options);
	yield* Effect.orDie(makeDirectory(volume)(TEMP_DIR, { recursive: true }));
	return volume;
});

/** @internal */
export const make: Effect.Effect<FileSystem.FileSystem> = Effect.map(
	makeReadyVolume(defaultEngineOptions),
	toFileSystem,
);

// Kit extension (volume inspection): a literal, synchronous walk of the tree
// for test assertions. Symbolic links are reported as themselves (never
// followed); hard links surface once per directory entry, each path carrying
// the same underlying data reference.

/** @internal */
export interface VolumeEntrySnapshot {
	readonly path: string;
	readonly type: "File" | "Directory" | "SymbolicLink";
	/** The live data reference for a `File` entry (callers must copy), `undefined` otherwise. */
	readonly data: Uint8Array | undefined;
	/** The entry's modification time as epoch milliseconds — the same clock `stat` reports. */
	readonly mtime: number;
	/** The stored target of a `SymbolicLink` entry (never resolved), `undefined` otherwise. */
	readonly target: string | undefined;
	// KIT EXTENSION (entry size): file byte length, symlink target UTF-8 length, 0 for a directory.
	readonly size: number;
}

const encoder = new TextEncoder();

const snapshotOf = (path: string, entry: InodeEntry): VolumeEntrySnapshot => ({
	path,
	type: entry._tag,
	data: entry._tag === "File" ? entry.data : undefined,
	mtime: DateTime.toEpochMillis(entry.mtime),
	target: entry._tag === "SymbolicLink" ? entry.target : undefined,
	size:
		entry._tag === "File" ? entry.data.length : entry._tag === "SymbolicLink" ? encoder.encode(entry.target).length : 0,
});

const collectEntrySnapshots = (state: State): Array<VolumeEntrySnapshot> => {
	const output: Array<VolumeEntrySnapshot> = [];
	const root = findInode(state, RootInode);
	if (root === undefined || root._tag !== "Directory") {
		return output;
	}
	// The root itself, which the walk below never reaches — it starts FROM the
	// root and reports descendants. Emitting it lets the inspection view answer
	// `has`/`isDirectory`/`mtime` for "/" from real state rather than a
	// synthesized stand-in. `snapshot`/`paths` filter on `data`, so a directory
	// entry does not disturb them.
	output.push(snapshotOf("/", root));
	interface Frame {
		readonly names: Array<string>;
		readonly directory: DirectoryInode;
		readonly prefix: string;
		index: number;
	}
	const frames: Array<Frame> = [
		{ names: A.sort(HashMap.keys(root.entries), Order.String), directory: root, prefix: "", index: 0 },
	];
	while (frames.length > 0) {
		const frame = frames[frames.length - 1];
		if (frame === undefined) break;
		if (frame.index >= frame.names.length) {
			frames.pop();
			continue;
		}
		const name = frame.names[frame.index];
		frame.index += 1;
		if (name === undefined) continue;
		// KIT EXTENSION (case folding): `name` is a stored key; exact hit.
		const inode = findEntry(state, frame.directory, name);
		const entry = inode === undefined ? undefined : findInode(state, inode);
		if (entry === undefined) {
			continue;
		}
		const path = `${frame.prefix}/${name}`;
		output.push(snapshotOf(path, entry));
		if (entry._tag === "Directory") {
			frames.push({ names: A.sort(HashMap.keys(entry.entries), Order.String), directory: entry, prefix: path, index: 0 });
		}
	}
	return output;
};

// KIT EXTENSION (inspection lookup): a literal, O(depth) lookup for the
// inspection view, so a point query never walks the whole tree. Components
// resolve through `lookupEntry` (so a case-insensitive volume folds for free)
// and a symbolic link is NEVER followed — not even an
// intermediate one: a component under a link is absent, which is the view's
// literal contract. `components` is the already-normalized path split on "/",
// "" segments removed.
const lookupLiteral = (state: State, components: ReadonlyArray<string>): InodeEntry | undefined => {
	let entry = findInode(state, RootInode);
	for (const component of components) {
		if (entry === undefined || entry._tag !== "Directory") return undefined;
		const found = lookupEntry(state, entry, component);
		if (found === undefined) return undefined;
		entry = findInode(state, found[1]);
	}
	return entry;
};

const splitComponents = (path: string): ReadonlyArray<string> => path.split("/").filter((part) => part.length > 0);
// END KIT EXTENSION (inspection lookup)

/** @internal */
export interface InspectableFileSystem {
	readonly fileSystem: FileSystem.FileSystem;
	/** Walks the volume's live state at call time — never a copy taken at build. */
	readonly entries: () => Array<VolumeEntrySnapshot>;
	/**
	 * The literal entry at a lexically normalized absolute path, or `undefined`.
	 * O(depth). The snapshot's `path` is the query as given, not the stored
	 * spelling — point queries never expose it.
	 */
	readonly lookup: (path: string) => VolumeEntrySnapshot | undefined;
	/** The stored names inside the directory at `path`, sorted; `undefined` when it is not one. */
	readonly list: (path: string) => ReadonlyArray<string> | undefined;
}

/** @internal */
export const makeInspectableWith = (options: EngineOptions): Effect.Effect<InspectableFileSystem> =>
	Effect.map(makeReadyVolume(options), (volume) => ({
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
	}));

/** @internal */
export const layer = Layer.effect(FileSystem.FileSystem, make);
