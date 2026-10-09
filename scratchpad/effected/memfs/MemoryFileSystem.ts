// The public surface over the vendored engine (see internal/volume.ts for the
// port header): the public types and the MemoryFileSystem class. The machinery
// lives in internal/ — seeding (seed.ts), the inspection view (view.ts), the
// node-shaped ports (ports.ts), fault injection (faults.ts) and errno
// (errno.ts) — all extensions beyond the vendored port.

import type * as PlatformError from "effect/PlatformError";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ErrnoException, errnoError, nodeErrno } from "./internal/errno.ts";
import { wrapFaulty } from "./internal/faults.ts";
import {
	makePromisesFileSystem,
	makeSyncFileSystem,
	resolvePath,
	runMutation,
	runNode,
	syscallForMethod,
	withFaults,
} from "./internal/ports.ts";
import { applyRoot, normalizeAbsolute, seedWith } from "./internal/seed.ts";
import { makeVolumeService } from "./internal/view.ts";
import * as internal from "./internal/volume.ts";

/**
 * Synchronous, read-only inspection of one memory volume — the write-path
 * counterpart to seeding, for asserting on what a program actually wrote
 * without routing every assertion through an `Effect` read.
 *
 * @remarks
 * Resolved from context via the {@link MemoryFileSystem.Volume} key, which
 * every memory layer publishes ({@link MemoryFileSystem.layer},
 * {@link MemoryFileSystem.layerWith}, a handle's `layer`), or obtained
 * value-level from {@link MemoryFileSystem.makeHandle}. Every read walks the volume's
 * live state at call time — never a copy taken at build — so a read after a
 * write observes the write.
 *
 * The view is **literal**: paths are normalized lexically (`//`, `.`, `..`)
 * but symbolic links are never followed — a symlink is present to `has`
 * yet has no content of its own, and reading *through* one is the `FileSystem`
 * API's job. Hard links surface once per directory entry, each path carrying
 * the same content. Returned byte arrays are defensive copies.
 *
 * Honest absence carries over: `text`/`bytes`
 * answer `undefined` for a path holding no regular file — `""` only ever
 * means a genuinely empty file.
 *
 * The engine pre-creates `/tmp` at build, so `has` answers `true` for
 * it even on an unseeded volume; `snapshot`/`paths` are unaffected (it is a
 * directory).
 *
 * @public
 */
export interface MemoryFileSystemVolume {
	/**
	 * Every regular file as absolute path → contents. Directories and symbolic
	 * links do not appear; a file reached by several hard links appears once
	 * per path.
	 */
	readonly snapshot: () => Record<string, Uint8Array>;
	/**
	 * The UTF-8 decoded contents of the regular file at `path`, or `undefined`
	 * when the path is absent or not a regular file. `""` means an empty file,
	 * never an absent one.
	 */
	readonly text: (path: string) => string | undefined;
	/**
	 * The raw contents of the regular file at `path`, or `undefined` when the
	 * path is absent or not a regular file.
	 */
	readonly bytes: (path: string) => Uint8Array | undefined;
	/**
	 * Whether anything lives at `path` — a regular file, a directory, or a
	 * symbolic link (the link itself; its target is not consulted).
	 */
	readonly has: (path: string) => boolean;
	/**
	 * The absolute paths of every regular file, sorted lexicographically —
	 * exactly the key set of {@link MemoryFileSystemVolume.snapshot}.
	 */
	readonly paths: () => ReadonlyArray<string>;
	/**
	 * The entry names directly inside the directory at `path`, sorted
	 * lexicographically, or `undefined` when the path is absent or holds
	 * something other than a directory. `[]` means a genuinely empty
	 * directory, never an absent one — the honest-absence contract carried
	 * into the sync view.
	 *
	 * Names only, not paths, matching `readdir`. Symbolic links are listed by
	 * their own name and never followed.
	 */
	readonly readDirectory: (path: string) => ReadonlyArray<string> | undefined;
	/**
	 * Whether `path` holds a directory.
	 *
	 * Literal, like the rest of this view: a symbolic link pointing AT a
	 * directory answers `false`, because the link itself is not one. This is a
	 * deliberate divergence from `statSync(p).isDirectory()`, which resolves
	 * the link first.
	 */
	readonly isDirectory: (path: string) => boolean;
	/**
	 * The modification time of the entry at `path` as epoch milliseconds, or
	 * `undefined` when nothing lives there — the same clock `stat` reports
	 * through `File.Info.mtime`.
	 *
	 * @remarks
	 * Seeded entries take the volume's clock at seed time, so a seed alone
	 * cannot express "this file is older than that one". Give an entry an
	 * explicit time with {@link MemoryFileSystem.file}'s `mtime` option, or
	 * change it afterwards through the `FileSystem` service's `utimes`.
	 *
	 * Distinguishing `undefined` from a real `0` matters: `0` is a legitimate
	 * modification time (the epoch), and a signature built over mtimes must not
	 * read an absent file as one modified in 1970.
	 */
	readonly mtime: (path: string) => number | undefined;
	/**
	 * The stored target of the symbolic link at `path`, or `undefined` when the
	 * path is absent or holds something else. The target is returned verbatim —
	 * it may be relative, and it may dangle.
	 *
	 * @remarks
	 * Literal, like the rest of this view: this reports the link, it does not
	 * resolve it. {@link MemoryFileSystem.syncFileSystem} is the surface that
	 * follows links, because the port it implements is defined in `stat` terms.
	 */
	readonly readLink: (path: string) => string | undefined;
	/**
	 * A literal `lstat` of `path`, or `undefined` when nothing lives there.
	 *
	 * @remarks
	 * Literal like the rest of this view: a symbolic link reports as
	 * `"symlink"`, never as its target, and its `size` is the UTF-8 byte length
	 * of the stored target. A file's `size` is its byte length; a directory's
	 * is `0`. `mtimeMs` is the same clock {@link MemoryFileSystemVolume.mtime}
	 * reads.
	 */
	readonly lstat: (path: string) => MemoryFileSystemVolumeStat | undefined;
}

/**
 * The answer of {@link MemoryFileSystemVolume.lstat}.
 *
 * @public
 */
export interface MemoryFileSystemVolumeStat {
	/** What lives at the path — a link is `"symlink"`, never its target's kind. */
	readonly kind: "file" | "directory" | "symlink";
	/** The entry's modification time as epoch milliseconds. */
	readonly mtimeMs: number;
	/** File byte length, symlink target UTF-8 byte length, or `0` for a directory. */
	readonly size: number;
}

/**
 * The error a synchronous `node:fs` call throws: an `Error` carrying `code`,
 * `syscall` and — for a path-based syscall — `path`, with node's message
 * format (`"ENOENT: no such file or directory, open '/x'"`). Built by
 * {@link MemoryFileSystem.errno}.
 *
 * @remarks
 * `path` is absent for a descriptor-based syscall such as `read`, exactly as
 * on node's own error (reading a directory as a file is
 * `"EISDIR: illegal operation on a directory, read"`, no path).
 *
 * @public
 */
export type MemoryFileSystemErrnoError = Error & {
	readonly code: string;
	readonly syscall: string;
	readonly path?: string;
};

/**
 * The six synchronous file operations a consumer-supplied filesystem port
 * needs — `exists`, `readFile`, `readDirectory`, `isDirectory`, `stat`,
 * `lstat` — as {@link MemoryFileSystem.syncFileSystem} exposes them over a
 * volume.
 *
 * @remarks
 * The shape is the `node:fs` synchronous subset — `existsSync`,
 * `readFileSync(p, "utf8")`, `readdirSync`, `statSync`/`lstatSync` — which
 * is also the port `@effected/workspaces` asks its sync entry points for.
 * Satisfaction is **structural**: this package declares its own type and
 * imports nothing, so no kit edge is created in either direction.
 *
 * Unlike the literal {@link MemoryFileSystemVolume} it is built on, this port
 * **follows symbolic links**, because the operations it stands in for are
 * defined in `stat` terms: a link to a directory IS a directory here, a link is
 * read through to its target, and a dangling link is absent (as `existsSync`
 * reports it). A backend that answered literally would silently drop symlinked
 * package directories from any consumer that enumerates a workspace — the same
 * failure a naive dirent fast path causes, reached through the test double.
 *
 * Absence is reported by throwing, because a synchronous non-`Effect` signature
 * has no other failure channel. It is never papered over with `""` or `[]` —
 * that fabricated-content case is the bug this package exists to prevent.
 * Errors carry the `code` the Node binding would raise: `ENOENT` for an absent
 * path, `EISDIR` for reading a directory as a file, `ENOTDIR` for listing a
 * non-directory, `ELOOP` for a link cycle. The `syscall` matches node's for the
 * same call (`open`, `read`, `scandir`, `stat`, `lstat`).
 *
 * Members are standalone functions, not methods: pass them as callbacks
 * without binding.
 *
 * @public
 */
export interface MemoryFileSystemSyncFileSystem {
	/** Whether anything exists at `path`, following links. A dangling link is absent. Never throws. */
	readonly exists: (path: string) => boolean;
	/** The UTF-8 contents of the file at `path`, following links. Throws `ENOENT`/`EISDIR`/`ENOTDIR`/`ELOOP`. */
	readonly readFile: (path: string) => string;
	/** The entry names inside the directory at `path`, following links. Throws `ENOENT`/`ENOTDIR`/`ELOOP`. */
	readonly readDirectory: (path: string) => ReadonlyArray<string>;
	/** Whether `path` resolves to a directory, following links — as `statSync(p).isDirectory()` does. */
	readonly isDirectory: (path: string) => boolean;
	/** `statSync`: follows links. Throws `ENOENT`/`ENOTDIR`/`ELOOP` with `syscall: "stat"`. */
	readonly stat: (path: string) => MemoryFileSystemPortStats;
	/** `lstatSync`: does not follow a final link. Throws `ENOENT`/`ENOTDIR`/`ELOOP` with `syscall: "lstat"`. */
	readonly lstat: (path: string) => MemoryFileSystemPortStats;
}

/**
 * The stats a {@link MemoryFileSystemSyncFileSystem} `stat`/`lstat` answers —
 * the `node:fs` `Stats` subset a port consumer reads.
 *
 * @public
 */
export interface MemoryFileSystemPortStats {
	/** Whether the entry is a regular file. */
	isFile(): boolean;
	/** Whether the entry is a directory. */
	isDirectory(): boolean;
	/** Whether the entry is a symbolic link (only ever true for `lstat`). */
	isSymbolicLink(): boolean;
	/** The modification time as epoch milliseconds. */
	readonly mtimeMs: number;
	/** File byte length, symlink target UTF-8 byte length, or `0` for a directory. */
	readonly size: number;
}

/**
 * A directory entry as `readdir(path, { withFileTypes: true })` answers it.
 * Literal: a symbolic link is a symbolic link, never its target's kind.
 *
 * @public
 */
export interface MemoryFileSystemDirent {
	/** The entry name (not the path). */
	readonly name: string;
	/** Whether the entry is a regular file. */
	isFile(): boolean;
	/** Whether the entry is a directory. */
	isDirectory(): boolean;
	/** Whether the entry is a symbolic link. */
	isSymbolicLink(): boolean;
}

/**
 * The read-only `node:fs/promises` subset an injected async walker needs, as
 * {@link MemoryFileSystem.promisesFileSystem} exposes it over a volume.
 *
 * @remarks
 * Same semantics and node-shaped rejections as
 * {@link MemoryFileSystemSyncFileSystem}: `stat` and `readFile` follow links,
 * `lstat` and dirents do not. Members are standalone functions, not methods:
 * pass them as callbacks without binding.
 *
 * @public
 */
export interface MemoryFileSystemPromisesFileSystem {
	/** The entry names inside the directory at `path`. */
	readdir(path: string): Promise<ReadonlyArray<string>>;
	/** The entries inside the directory at `path`, with their (literal) kinds. */
	readdir(path: string, options: { readonly withFileTypes: true }): Promise<ReadonlyArray<MemoryFileSystemDirent>>;
	/** `stat`: follows links. */
	stat(path: string): Promise<MemoryFileSystemPortStats>;
	/** `lstat`: does not follow a final link. */
	lstat(path: string): Promise<MemoryFileSystemPortStats>;
	/** The raw contents of the file at `path`, following links — node's Buffer-returning form. */
	readFile(path: string): Promise<Uint8Array>;
	/** The UTF-8 contents of the file at `path`, following links. */
	readFile(path: string, encoding: MemoryFileSystemReadFileEncoding): Promise<string>;
}

/**
 * The encodings `MemoryFileSystemPromisesFileSystem.readFile` accepts:
 * UTF-8, spelled either way, bare or as node's `{ encoding }` options object.
 *
 * @public
 */
export type MemoryFileSystemReadFileEncoding = "utf8" | "utf-8" | { readonly encoding: "utf8" | "utf-8" };

/**
 * Fault handlers for a {@link MemoryFileSystemPromisesFileSystem}: each may
 * return a replacement promise, throw (an errno built with
 * {@link MemoryFileSystem.errno}), or return `undefined` to delegate. A
 * handler that throws synchronously makes the call REJECT, as a real
 * `fs/promises` call does; it never throws at the call site.
 *
 * @public
 */
export type MemoryFileSystemPromisesFaults = {
	readonly [K in Exclude<keyof MemoryFileSystemPromisesFileSystem, "readdir" | "readFile">]?: (
		...args: Parameters<MemoryFileSystemPromisesFileSystem[K]>
	) => ReturnType<MemoryFileSystemPromisesFileSystem[K]> | undefined;
} & {
	/**
	 * Receives `options` as given; a replacement should match them (names
	 * without `withFileTypes`, dirents with it).
	 */
	readonly readdir?: (
		path: string,
		options?: { readonly withFileTypes: true },
	) => Promise<ReadonlyArray<string> | ReadonlyArray<MemoryFileSystemDirent>> | undefined;
	/** Receives `encoding` as given; a replacement should match it (bytes without, a string with). */
	readonly readFile?: (
		path: string,
		encoding?: MemoryFileSystemReadFileEncoding,
	) => Promise<Uint8Array | string> | undefined;
};

/**
 * A synchronously built memory volume with every view over it: the `FileSystem`
 * service, the inspection {@link MemoryFileSystemVolume}, a stable layer, the
 * two read-only ports, and synchronous mutators — for Promise-style suites
 * that never touch `Effect`.
 *
 * @remarks
 * All members share ONE volume. `layer` is a fixed value built over that
 * volume, so every `Effect.provide(handle.layer)` — in one program or many —
 * sees the same state; it is not rebuilt per provide.
 *
 * `sync` and `promises` are read-only views. Mutate through `write`, `mkdir`,
 * `remove` and `symlink`, which throw node-shaped errors (`code`, `syscall`,
 * `path`) on failure, as the `node:fs` calls they stand in for do.
 *
 * `write` and `symlink` create a parent only when it is ABSENT, so their
 * failures match the single node call they stand in for: writing under a
 * parent that is a file fails `ENOTDIR` (as `writeFileSync` does), while
 * `mkdir` — recursive, like `mkdirSync(p, { recursive: true })` — over an
 * existing file fails `EEXIST`. A contradictory seed fails the same way,
 * with node's syscall for the failing step (`mkdir`, `open`, `symlink`,
 * `chmod`, `utime`).
 *
 * @public
 */
export interface MemoryFileSystemHandle {
	/** The `FileSystem` service over the volume. */
	readonly fileSystem: FileSystem.FileSystem;
	/** The synchronous inspection view of the same volume. */
	readonly volume: MemoryFileSystemVolume;
	/**
	 * Provides `FileSystem` (this volume, faulted when `options.faults` was
	 * given), {@link MemoryFileSystem.Volume} and `Path`; stable across
	 * provides. Unlike {@link MemoryFileSystem.layer} it includes `Path`, for
	 * Promise-style suites that never compose layers.
	 */
	readonly layer: Layer.Layer<FileSystem.FileSystem | MemoryFileSystemVolume | Path.Path>;
	/** The read-only `node:fs` sync port over the volume. */
	readonly sync: MemoryFileSystemSyncFileSystem;
	/** The read-only `node:fs/promises` port over the volume. */
	readonly promises: MemoryFileSystemPromisesFileSystem;
	/**
	 * The normalized `options.root` the handle was built with, or `undefined`.
	 * The mutators join a relative path to it.
	 *
	 * @remarks
	 * Seed keys and mutator paths join the root differently, on purpose. A
	 * seed key is plain data and joins LEXICALLY (`"../x"` under `/ws/repo` is
	 * `/ws/x`, whatever links exist). A mutator path is a filesystem call and
	 * is handed to the engine unnormalized, so `.` and `..` resolve AFTER
	 * following links, POSIX-style: with `/r/link` pointing at `/elsewhere/dir`,
	 * `write("link/../x")` lands at `/elsewhere/x`, exactly as
	 * `write("/r/link/../x")` and the host's `writeFileSync` do.
	 */
	readonly root: string | undefined;
	/**
	 * Read-only ports over the same volume with faults injected — the same
	 * machinery (and unknown-key `RangeError`) as
	 * {@link MemoryFileSystem.syncFileSystem} and
	 * {@link MemoryFileSystem.promisesFileSystem}. The handle's own `sync` and
	 * `promises` stay unfaulted, and `options.faults` never reaches them: it
	 * faults the `FileSystem` service only.
	 */
	readonly withFaults: (faults: {
		readonly sync?: MemoryFileSystemSyncFaults | undefined;
		readonly promises?: MemoryFileSystemPromisesFaults | undefined;
	}) => {
		readonly sync: MemoryFileSystemSyncFileSystem;
		readonly promises: MemoryFileSystemPromisesFileSystem;
	};
	/**
	 * Writes `content` at `path`, creating a missing parent. A relative `path`
	 * joins {@link MemoryFileSystemHandle.root} (or `/` without one).
	 */
	readonly write: (path: string, content: string | Uint8Array) => void;
	/** Creates the directory at `path` (recursively); a relative `path` joins the root. */
	readonly mkdir: (path: string) => void;
	/** Removes `path` (recursively); a relative `path` joins the root. */
	readonly remove: (path: string) => void;
	/**
	 * Creates a symbolic link at `path` pointing at `target`, creating a missing
	 * parent. A relative `path` joins the root; `target` is stored verbatim.
	 */
	readonly symlink: (target: string, path: string) => void;
}

/**
 * Fault handlers for a {@link MemoryFileSystemSyncFileSystem}: each receives
 * the real call arguments and may throw (an errno built with
 * {@link MemoryFileSystem.errno}), return a replacement, or return `undefined`
 * to delegate to the volume.
 *
 * @public
 */
export type MemoryFileSystemSyncFaults = {
	readonly [K in keyof MemoryFileSystemSyncFileSystem]?: (
		...args: Parameters<MemoryFileSystemSyncFileSystem[K]>
	) => ReturnType<MemoryFileSystemSyncFileSystem[K]> | undefined;
};

/**
 * Options for a synchronous port built over a volume.
 *
 * @public
 */
export interface MemoryFileSystemPortOptions<Faults> {
	/** Handlers that intercept individual port members. */
	readonly faults?: Faults | undefined;
}

/**
 * A seed entry describing a file, optionally carrying its initial permission
 * mode — built with {@link MemoryFileSystem.file}.
 *
 * @public
 */
export interface MemoryFileSystemSeedFile {
	readonly _tag: "MemoryFileSystemSeedFile";
	/** File contents; strings are UTF-8 encoded, `Uint8Array`s written verbatim. */
	readonly content: string | Uint8Array;
	/** Initial permission bits (defaults to the volume's `0o644`). */
	readonly mode?: number;
	/**
	 * Initial modification time as epoch milliseconds. Defaults to the volume's
	 * clock at seed time, which makes every seeded entry effectively
	 * simultaneous — set this when a test needs one file to read as older than
	 * another.
	 */
	readonly mtime?: number;
}

/**
 * A seed entry describing a directory — built with
 * {@link MemoryFileSystem.directory}. The only way a seed can express an *empty*
 * directory, and the way a directory receives an initial permission mode.
 *
 * @public
 */
export interface MemoryFileSystemSeedDirectory {
	readonly _tag: "MemoryFileSystemSeedDirectory";
	/** Initial permission bits (defaults to the volume's `0o755`). */
	readonly mode?: number;
}

/**
 * A seed entry describing a symbolic link — built with
 * {@link MemoryFileSystem.symlink}.
 *
 * @public
 */
export interface MemoryFileSystemSeedSymlink {
	readonly _tag: "MemoryFileSystemSeedSymlink";
	/** The link target, stored verbatim; it may dangle. */
	readonly target: string;
}

/**
 * One value in a {@link MemoryFileSystemSeed}: plain file contents
 * (`string | Uint8Array`, unchanged from the original seed shape), or a tagged
 * entry describing a file with a mode, a directory, or a symbolic link.
 *
 * @public
 */
export type MemoryFileSystemSeedEntry =
	| string
	| Uint8Array
	| MemoryFileSystemSeedFile
	| MemoryFileSystemSeedDirectory
	| MemoryFileSystemSeedSymlink;

/**
 * A volume seed: absolute POSIX paths mapped to seed entries.
 *
 * @remarks
 * Plain `string` values are UTF-8 encoded; `Uint8Array` values are written
 * verbatim. Tagged entries built with {@link MemoryFileSystem.file},
 * {@link MemoryFileSystem.directory} and {@link MemoryFileSystem.symlink} let one
 * seed literal describe a whole tree — empty directories, symbolic links, and
 * initial permission modes included. Parent directories are created
 * recursively before each entry, so a seed never has to list them.
 *
 * Entries are applied in the seed's own key order; a symlink may target a path
 * seeded later (or never — dangling links are legal).
 *
 * @public
 */
export interface MemoryFileSystemSeed {
	readonly [path: string]: MemoryFileSystemSeedEntry;
}

/**
 * Options shared by every seeded constructor.
 *
 * @public
 */
export interface MemoryFileSystemOptions {
	/**
	 * An absolute directory the seed is rooted at. Seed keys are then relative
	 * to it, and the empty key `""` addresses the root itself. The root is
	 * normalized lexically (`//`, `.`, `..`) and is always created, even for an
	 * empty seed.
	 *
	 * @remarks
	 * The root is a join base, not a jail: a key is joined to it lexically, as
	 * `path.posix.join` does, so `"../extra/a.ts"` under `root: "/ws/repo"`
	 * lands at `/ws/extra/a.ts`. A handle's mutators join relative paths to it
	 * too, but UNNORMALIZED, so `.` and `..` resolve after links are followed
	 * (see {@link MemoryFileSystemHandle.root}). A relative root, or an
	 * absolute seed key alongside a root,
	 * is a typed `BadArgument` naming the offending value (`makeSync` throws
	 * `EINVAL` with it in the path slot).
	 */
	readonly root?: string | undefined;
	/**
	 * Whether path lookups are case-sensitive. Defaults to `true`; `false`
	 * models a case-insensitive, case-PRESERVING volume such as default APFS.
	 *
	 * @remarks
	 * Semantics are taken from a real APFS volume: a lookup in any spelling finds the stored entry, and
	 * listings, `paths()` and `snapshot()` keep the stored spelling. `realPath`
	 * keeps the QUERIED spelling (only a link's target text supplies its own),
	 * as the node adapter's `realPath` does. Renaming or `copyFile`-ing onto a
	 * differently-cased existing entry keeps the destination's stored spelling,
	 * while `copy` (unlink-then-create) takes the requested one; a case-only
	 * rename rekeys the entry. Folding is `toLowerCase` per UTF-16 unit, so a
	 * character whose case mapping changes length or is locale-specific (`İ`,
	 * `ß`) does not fold as a regex `i` flag would, and names are not
	 * Unicode-normalized (APFS treats NFC and NFD spellings as one name; this
	 * volume does not).
	 */
	readonly caseSensitive?: boolean | undefined;
	/**
	 * Faults to inject into the built `FileSystem` — the same registration map
	 * (or factory) {@link MemoryFileSystem.makeFaulty} takes. The seed is
	 * written beneath the faults, and {@link MemoryFileSystem.Volume} inspects
	 * the raw volume, so a test can inject a failure and still assert on what
	 * actually landed.
	 *
	 * @remarks
	 * `FileSystem`-scoped: it does not reach a handle's `sync` or `promises`
	 * ports. Fault those with {@link MemoryFileSystemHandle.withFaults}.
	 */
	readonly faults?: MemoryFileSystemFaults | MemoryFileSystemFaultsFactory | undefined;
}

const engineOptions = (options: MemoryFileSystemOptions | undefined): internal.EngineOptions => ({
	caseSensitive: options?.caseSensitive ?? true,
});

/**
 * The members of `FileSystem.FileSystem` that a fault handler can intercept:
 * every function-valued method, the `Stream`/`Sink`-returning trio (`stream`,
 * `sink`, `watch`) included. Only {@link MemoryFileSystem.failTimes} is
 * narrower — a transient fault substitutes a failing `Effect`, so it slots
 * into the `Effect`-returning methods alone.
 *
 * @public
 */
export type MemoryFileSystemFaultMethod = {
	[Method in keyof FileSystem.FileSystem]: FileSystem.FileSystem[Method] extends (...args: never) => unknown
		? Method
		: never;
}[keyof FileSystem.FileSystem];

/**
 * A fault handler for one `FileSystem` method. It receives the real call
 * arguments (path, mode, options…), so a fault can be path- or mode-specific.
 * Returning a value replaces the call — typically
 * `Effect.fail(PlatformError.systemError({...}))`, a `Stream`/`Sink` for the
 * `stream`/`sink`/`watch` members, though a canned success is equally valid;
 * returning `undefined` **declines**, delegating the call to the wrapped
 * filesystem. The return type is the method's own, so an injected failure is
 * constrained to the method's `PlatformError` channel — a bare `new Error`
 * does not typecheck. This delegate-by-default posture is the whole
 * difference from `FileSystem.layerNoop`, which denies unlisted methods.
 *
 * @public
 */
export type MemoryFileSystemFaultHandler<Method extends MemoryFileSystemFaultMethod> = (
	...args: Parameters<FileSystem.FileSystem[Method]>
) => ReturnType<FileSystem.FileSystem[Method]> | undefined;

/**
 * A transient fault built with {@link MemoryFileSystem.failTimes}: usable
 * anywhere a fault handler is, it fails a fixed number of calls with a given
 * `PlatformError` and then delegates forever after.
 *
 * @remarks
 * The countdown state is **armed per volume build** — see
 * {@link MemoryFileSystem.failTimes} for exactly when a counter is shared and
 * when it is re-armed.
 *
 * @public
 */
export interface MemoryFileSystemTransientFault {
	readonly _tag: "MemoryFileSystemTransientFault";
	/** How many calls fail before the fault starts delegating. */
	readonly times: number;
	/** The typed failure each of those calls fails with. */
	readonly error: PlatformError.PlatformError;
}

/**
 * The fault registration map for {@link MemoryFileSystem.makeFaulty} and
 * {@link MemoryFileSystem.layerFaulty}: per intercepted method, either a
 * {@link MemoryFileSystemFaultHandler} or — on the `Effect`-returning methods
 * — a {@link MemoryFileSystemTransientFault}. Methods absent from the map are
 * never intercepted.
 *
 * @public
 */
export type MemoryFileSystemFaults = {
	readonly [Method in MemoryFileSystemFaultMethod]?:
		| MemoryFileSystemFaultHandler<Method>
		| (Effect.Effect<never, PlatformError.PlatformError> extends ReturnType<FileSystem.FileSystem[Method]>
				? MemoryFileSystemTransientFault
				: never);
};

/**
 * The factory form of {@link MemoryFileSystemFaults}: called with the
 * filesystem being wrapped, it returns the fault map. Accepted wherever a
 * fault map is.
 *
 * @remarks
 * `base` is the UNFAULTED filesystem, so a handler can rewrite a call's
 * arguments and delegate — `stat: (path) => base.stat(fold(path))` — without
 * re-entering its own fault. A declining handler (`undefined`) still reaches
 * the same `base`. The factory runs once per volume build, so any
 * {@link MemoryFileSystem.failTimes} it creates is armed per build too.
 *
 * @public
 */
export type MemoryFileSystemFaultsFactory = (base: FileSystem.FileSystem) => MemoryFileSystemFaults;

const handleContext = ({
	fileSystem,
	volume,
}: Pick<MemoryFileSystemHandle, "fileSystem" | "volume">): Context.Context<
	FileSystem.FileSystem | MemoryFileSystemVolume
> => Context.make(FileSystem.FileSystem, fileSystem).pipe(Context.add(MemoryFileSystem.Volume, volume));

// The one build path behind every seeded constructor: engine, seed (written
// beneath any faults), view, then the optional fault wrapper over the service.
// The mutators and ports use the RAW filesystem and view — they are setup and
// inspection, not the code under test.
const buildHandle = (
	seed: MemoryFileSystemSeed,
	options: MemoryFileSystemOptions | undefined,
): Effect.Effect<MemoryFileSystemHandle, PlatformError.PlatformError> =>
	Effect.gen(function* () {
		const engine = yield* internal.makeInspectableWith(engineOptions(options));
		const raw = engine.fileSystem;
		yield* seedWith(raw, seed, options);
		const volume = makeVolumeService(engine);
		const fileSystem = options?.faults === undefined ? raw : wrapFaulty(raw, options.faults);
		// `seedWith` has already rejected a relative root, so this is the normalized join base.
		const root = options?.root === undefined ? undefined : normalizeAbsolute(options.root);
		// A mutator path: absolute as given; relative joined to the root (or to
		// "/" without one). The join is deliberately NOT normalized: the engine
		// resolves "." and ".." AFTER following links, POSIX-style, so
		// "link/../x" lands where the link leads — as the host and the absolute
		// spelling do. (Seed keys, by contrast, join lexically.) Errors still
		// report the caller's own path.
		const at = (path: string) => (path.startsWith("/") ? path : `${root ?? ""}/${path}`);
		const parentOf = (path: string) => path.slice(0, Math.max(1, path.lastIndexOf("/")));
		const sync = makeSyncFileSystem(volume);
		// Only creates a parent that is absent: an existing parent that is a file
		// must reach the write itself, which fails ENOTDIR as `writeFileSync` does
		// (a recursive mkdir over an existing file would say EEXIST instead).
		// Presence is checked with the port's `lstat`: intermediate links and
		// ".." resolve (so it agrees with the engine on an unnormalized path —
		// never the lexical view), but the FINAL component is not followed. A
		// dangling or looping link AS the parent is therefore present, so the
		// write itself fails ENOENT / ELOOP, as `writeFileSync` does — never a
		// mkdir over the link (EEXIST).
		const present = (path: string) => {
			try {
				sync.lstat(path);
				return true;
			} catch {
				return false;
			}
		};
		// errno fidelity: a recursive mkdir fails with an errno only when some component blocks
		// it — a non-directory, or a dangling or looping link HIGHER up (which
		// makes `lstat` of the parent fail too). The call that follows walks
		// the same component, so it is bound to fail on it: swallow the mkdir's
		// errno and let that call report node's own errno and syscall (ENOENT /
		// ELOOP / ENOTDIR on `open` or `symlink`, never the mkdir's).
		const ensureParent = (path: string) => {
			const parent = parentOf(path);
			return present(parent)
				? Effect.void
				: raw
						.makeDirectory(parent, { recursive: true })
						.pipe(
							Effect.catchIf((error) => error.reason.cause instanceof ErrnoException, () => Effect.void),
						);
		};
		// `mkdir` stands in for `mkdirSync(p, { recursive: true })`, whose walk
		// reports a dangling link EARLIER in the path as ENOENT; the engine
		// models the node adapter's callback `fs.mkdir`, which says ENOTDIR
		// there. The first component that does not resolve tells them apart:
		// ENOENT from it can only be a dangling link (mkdir -p creates anything
		// merely missing), while a file or a link through one answers ENOTDIR,
		// as `mkdirSync` does.
		const mkdirSync = (path: string) =>
			raw.makeDirectory(path, { recursive: true }).pipe(
				Effect.mapError((error) => {
					const cause = error.reason.cause;
					if (!(cause instanceof ErrnoException) || cause.code !== "ENOTDIR") return error;
					const pieces = path.split("/");
					for (let index = 1; index < pieces.length; index++) {
						const prefix = pieces.slice(0, index + 1).join("/");
						const resolved = resolvePath(volume, prefix === "" ? "/" : prefix);
						if ("code" in resolved) {
							return resolved.code === "ENOENT" ? errnoError("makeDirectory", path, "ENOENT", undefined) : error;
						}
					}
					return error;
				}),
			);
		const handle: MemoryFileSystemHandle = {
			fileSystem,
			volume,
			layer: Layer.merge(Layer.succeedContext(handleContext({ fileSystem, volume })), Path.layer),
			sync,
			promises: makePromisesFileSystem(volume),
			root,
			withFaults: (faults) => ({
				sync: MemoryFileSystem.syncFileSystem(volume, { faults: faults.sync }),
				promises: MemoryFileSystem.promisesFileSystem(volume, { faults: faults.promises }),
			}),
			write: (path, content) =>
				runMutation(
					Effect.andThen(
						ensureParent(at(path)),
						typeof content === "string" ? raw.writeFileString(at(path), content) : raw.writeFile(at(path), content),
					),
					"writeFile",
					path,
				),
			mkdir: (path) => runMutation(mkdirSync(at(path)), "makeDirectory", path),
			remove: (path) => runMutation(raw.remove(at(path), { recursive: true }), "remove", path),
			// Only the link's own path resolves against the root; the target text is stored verbatim.
			symlink: (target, path) =>
				runMutation(Effect.andThen(ensureParent(at(path)), raw.symlink(target, at(path))), "symlink", path),
		};
		return handle;
	});

/**
 * An in-memory implementation of core Effect's `FileSystem` service: an
 * isolated virtual POSIX volume — files, directories, symlinks, hard links,
 * open descriptors, temporary resources, globbing, watching — behind the
 * standard `FileSystem.FileSystem` key.
 *
 * @remarks
 * The founding contract is **honest absence**: reading, statting, or opening
 * (without a create flag) a path nothing seeded fails typed with a `NotFound`
 * `SystemError` — the volume never fabricates content for a path nothing
 * arranged.
 *
 * Behavioral notes shared by every constructor:
 *
 * - Each built filesystem is one isolated volume, and layer memoization is
 *   **per-build**: every `Effect.provide` of a layer value — even the same
 *   bound `const` — builds and re-seeds a fresh volume. Sharing one volume
 *   across several effects therefore requires one provide over one composed
 *   layer graph (compose with `Layer.provideMerge`, or a suite-boundary
 *   `layer(...)` block); within that one build, every consumer of the layer
 *   value sees the same volume, and `Layer.fresh` is how a consumer *inside*
 *   the same graph opts back out into its own volume. Across separate builds
 *   `Layer.fresh` has no role — separate provides already build separate
 *   volumes, so there is nothing to isolate.
 * - **Permission modes are metadata, never enforced.** Modes set by seeding,
 *   `chmod`, `makeDirectory` or `writeFile` are recorded faithfully and
 *   readable via `stat`, but no operation checks them: the volume models no
 *   process identity (no uid/gid/umask), so no read, write, traversal or
 *   removal ever fails `PermissionDenied` on its own. Likewise `access`
 *   checks existence only, deliberately ignoring its
 *   `readable`/`writable`/`ok` options. To exercise a permission-failure code
 *   path, inject the failure with `options.faults` on
 *   {@link MemoryFileSystem.layerWith} instead (or
 *   {@link MemoryFileSystem.layerFaulty} over any other filesystem).
 * - Relative paths resolve from the virtual root `/`: the `FileSystem`
 *   contract has no working-directory operation.
 * - Malformed input fails through the typed `PlatformError` channel, never as
 *   a defect; pathological directory or brace-nesting depth fails typed at the
 *   engine's nesting bound.
 * - **Failures take the shape `@effect/platform-node` gives them.** Each
 *   failure the real platform would raise carries the errno node reports as
 *   `reason.cause.code` (`ENOENT`, `EINVAL`, `ERR_FS_EISDIR`, …), and its
 *   `_tag` is derived from that code by the node adapter's own mapping:
 *   `ENOENT` → `NotFound`, `EEXIST` → `AlreadyExists`,
 *   `EISDIR`/`ENOTDIR`/`ELOOP` → `BadResource`, every other code →
 *   `Unknown`. So `readLink` on a regular file fails `Unknown` with `EINVAL`,
 *   renaming onto a non-empty directory `Unknown` with `ENOTEMPTY`, and
 *   removing any directory without `recursive` `Unknown` with
 *   `ERR_FS_EISDIR`. Match on `_tag` and `cause.code` exactly as you would
 *   against the node adapter. Unlike node's `ErrnoException`, an Effect
 *   failure's `cause` carries only `code` (and `path` for a path operation):
 *   no `errno` number, no `syscall` and no `dest`, and `reason.syscall` is
 *   never set. The thrown errors of the synchronous
 *   {@link MemoryFileSystem.syncFileSystem} port are the exception: they do
 *   carry `syscall`. Where Linux and macOS report different errnos the Linux
 *   one is modelled. Limits of
 *   the in-memory model itself (nesting depth, allocation) fail
 *   `BadResource` with no `cause`.
 *
 * @example
 * ```ts
 * import { MemoryFileSystem } from "./index.ts";
 * import { Effect, FileSystem } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem;
 *   return yield* fs.readFileString("/repo/package.json");
 * });
 *
 * const SeededFs = MemoryFileSystem.layerWith({
 *   "/repo/package.json": `{ "name": "fixture" }`,
 *   "/repo/tools/build.sh": MemoryFileSystem.file("#!/bin/sh\n", { mode: 0o755 }),
 *   "/repo/.cache": MemoryFileSystem.directory(),
 *   "/repo/latest": MemoryFileSystem.symlink("/repo/package.json"),
 * });
 *
 * program.pipe(Effect.provide(SeededFs));
 * ```
 *
 * @public
 */
export class MemoryFileSystem {
	/**
	 * Builds a `FileSystem` service backed by a fresh, empty in-memory volume.
	 */
	static readonly make: Effect.Effect<FileSystem.FileSystem> = internal.make;

	/**
	 * Builds a `FileSystem` service backed by a fresh volume, optionally
	 * pre-populated from `seed` and configured by `options`.
	 *
	 * @remarks
	 * Fails typed when the seed contradicts itself — for example a file seeded
	 * at a path another entry needs as a directory, or a tagged entry carrying
	 * an invalid mode. Everything absent from the seed stays absent: reads of
	 * unseeded paths fail `NotFound`.
	 *
	 * With `options.faults`, the returned filesystem is the faulted one; the
	 * seed is written beneath the faults, never through them. Each call arms its
	 * own transient-fault counters.
	 *
	 * @param seed - Absolute POSIX paths mapped to seed entries (relative keys
	 *   when `options.root` is given). Defaults to an empty seed.
	 * @param options - See {@link MemoryFileSystemOptions}.
	 */
	static readonly makeWith = (
		seed: MemoryFileSystemSeed = {},
		options?: MemoryFileSystemOptions,
	): Effect.Effect<FileSystem.FileSystem, PlatformError.PlatformError> =>
		Effect.map(buildHandle(seed, options), (handle) => handle.fileSystem);

	/**
	 * Wraps an existing `FileSystem` so that registered faults can intercept
	 * calls, delegating everything else — and every declined call — to the
	 * wrapped filesystem.
	 *
	 * @remarks
	 * The pure core of {@link MemoryFileSystem.layerFaulty}; see there for the
	 * interception semantics. For a MEMORY volume with faults, pass
	 * `options.faults` to {@link MemoryFileSystem.makeWith} or
	 * {@link MemoryFileSystem.layerWith} instead. Reach for `makeFaulty` to
	 * decorate any other filesystem value by hand. Each call arms its own
	 * transient-fault counters.
	 *
	 * Fault keys are checked against the OWN enumerable function members of
	 * `base` (a `RangeError` names any other key). Every `FileSystem.make`-built
	 * service — memfs, the node adapter — has them; a class instance whose
	 * methods live on its prototype is rejected, so wrap such a value in
	 * `FileSystem.make({ ... })` first.
	 *
	 * @param base - The filesystem to wrap; any implementation works.
	 * @param faults - The fault registration map, or a
	 *   {@link MemoryFileSystemFaultsFactory} that builds it from the wrapped
	 *   filesystem.
	 */
	static readonly makeFaulty = (
		base: FileSystem.FileSystem,
		faults: MemoryFileSystemFaults | MemoryFileSystemFaultsFactory,
	): FileSystem.FileSystem => wrapFaulty(base, faults);

	/**
	 * A layer that wraps whatever `FileSystem` is provided to it with fault
	 * interception: only methods registered in `faults` are intercepted, and a
	 * handler that declines (returns `undefined`) delegates to the wrapped
	 * filesystem — delegate-by-default, the opposite of `layerNoop`'s
	 * deny-by-default.
	 *
	 * @remarks
	 * `layerFaulty` decorates whatever `FileSystem` is provided to it — the
	 * node adapter, a hand-built double — and so leaves `FileSystem` in `R`.
	 * For a memory volume with faults, use
	 * `MemoryFileSystem.layerWith(seed, { faults })`, which is self-contained
	 * and also publishes {@link MemoryFileSystem.Volume} over the raw volume.
	 *
	 * Handlers receive the real call arguments, so a fault can key on the path
	 * or mode of one specific call. Injected failures should be genuine
	 * `PlatformError` values (`PlatformError.systemError` /
	 * `PlatformError.badArgument`) — that is what every real `FileSystem`
	 * implementation fails with, and tests asserting on the error channel
	 * depend on it.
	 *
	 * Delegate-by-default also makes this the supported way to build a **spy**:
	 * push the arguments somewhere, return `undefined`, and the recorded call
	 * still actually happens — assertions can run against both the recording
	 * and the volume's resulting state, and the double keeps working when the
	 * code under test grows a new method call, where a deny-by-default stub
	 * (`FileSystem.layerNoop`) only survives the exact calls its author
	 * anticipated.
	 *
	 * Interception scope: every function-valued method
	 * ({@link MemoryFileSystemFaultMethod}). Handlers on the Effect-returning
	 * methods are consulted at each *execution* — a retried effect re-consults
	 * its handler, which is what lets {@link MemoryFileSystem.failTimes} count
	 * `Effect.retry` attempts; handlers on `stream`, `sink` and `watch` are
	 * consulted when the method is called and return a replacement `Stream` or
	 * `Sink`. The derived members (`exists` from `access`, `readFileString`
	 * from `readFile`, `writeFileString` from `writeFile`, `stream` and `sink`
	 * from `open`) are re-derived over the intercepted core methods, so a
	 * fault on a core method propagates coherently into them — and each
	 * derived member remains directly interceptable in its own right.
	 *
	 * A parameterized layer factory: bind the result to a `const`. Transient
	 * counters ({@link MemoryFileSystem.failTimes}) are armed once per layer
	 * build — consumers within one provided layer graph share them, and a
	 * separate `Effect.provide` re-arms them.
	 *
	 * @example
	 * ```ts
	 * import { MemoryFileSystem } from "./index.ts";
	 * import { Effect, Layer, PlatformError } from "effect";
	 *
	 * const Volume = MemoryFileSystem.layerWith({ "/repo/src/a.ts": "export {}\n" });
	 *
	 * // chmod fails only when relocking (0o555/0o444); the unlock pass (0o755)
	 * // and every other method reach the real volume.
	 * const Faulty = MemoryFileSystem.layerFaulty({
	 *   chmod: (path, mode) =>
	 *     mode === 0o555 || mode === 0o444
	 *       ? Effect.fail(
	 *           PlatformError.systemError({
	 *             _tag: "PermissionDenied",
	 *             module: "FileSystem",
	 *             method: "chmod",
	 *             pathOrDescriptor: path,
	 *           }),
	 *         )
	 *       : undefined,
	 * }).pipe(Layer.provide(Volume));
	 * ```
	 *
	 * @param faults - The fault registration map, or a
	 *   {@link MemoryFileSystemFaultsFactory} that builds it from the wrapped
	 *   filesystem.
	 */
	static readonly layerFaulty = (
		faults: MemoryFileSystemFaults | MemoryFileSystemFaultsFactory,
	): Layer.Layer<FileSystem.FileSystem, never, FileSystem.FileSystem> =>
		Layer.effect(
			FileSystem.FileSystem,
			Effect.gen(function* () {
				const base = yield* FileSystem.FileSystem;
				return wrapFaulty(base, faults);
			}),
		);

	/**
	 * A transient fault: fails the first `times` intercepted calls with `error`,
	 * then delegates to the wrapped filesystem forever after — the shape a
	 * retry-policy test needs.
	 *
	 * @remarks
	 * Usable as any value of the fault registration map. The countdown is
	 * **armed per volume build**: each `makeFaulty` call — and each build of a
	 * `layerFaulty` layer or `options.faults` build — starts a fresh counter from
	 * `times`. Layer memoization is per-build, so consumers within one provided
	 * layer graph share one counter, while a separate `Effect.provide` of the
	 * same layer value re-arms it. In particular, a suite-boundary
	 * `@effect/vitest` `layer(...)` memoizes ONE build for the whole suite, so a
	 * transient fault declared there is consumed by whichever test runs first
	 * and later tests silently see it exhausted — declare the fault in a
	 * `Layer.fresh`-wrapped (or per-test-provided) layer instead.
	 *
	 * Transient faults slot into the `Effect`-returning methods only — the
	 * substitute is a failing `Effect`, which cannot stand in for the
	 * `Stream`/`Sink`-returning members (use a handler returning `Stream.fail`
	 * there instead).
	 *
	 * Throws a `RangeError` at construction when `times` is negative or not an
	 * integer — misuse is a wiring bug, matching `layerWith`'s posture on
	 * contradictory seeds, never runtime input.
	 *
	 * @example
	 * ```ts
	 * import { MemoryFileSystem } from "./index.ts";
	 * import { PlatformError } from "effect";
	 *
	 * const flaky = MemoryFileSystem.layerWith(
	 *   { "/config.json": "{}" },
	 *   {
	 *     faults: {
	 *       readFileString: MemoryFileSystem.failTimes(
	 *         2,
	 *         PlatformError.systemError({
	 *           _tag: "Busy",
	 *           module: "FileSystem",
	 *           method: "readFileString",
	 *           pathOrDescriptor: "/config.json",
	 *         }),
	 *       ),
	 *     },
	 *   },
	 * );
	 * ```
	 *
	 * @param times - How many calls fail before delegation begins.
	 * @param error - The typed failure each of those calls fails with.
	 */
	static readonly failTimes = (times: number, error: PlatformError.PlatformError): MemoryFileSystemTransientFault => {
		if (!Number.isInteger(times) || times < 0) {
			throw new RangeError(`failTimes: times must be a non-negative integer, got ${String(times)}`);
		}
		return { _tag: "MemoryFileSystemTransientFault", times, error };
	};

	/**
	 * A fault handler that fails its member as a DEFECT (`Effect.die`) rather
	 * than a typed `PlatformError`.
	 *
	 * @remarks
	 * The two are not interchangeable to the code under test. A caller's
	 * defensive `Effect.catch` absorbs a typed failure and cannot absorb a
	 * defect, so a suite that injects a typed fault passes while the real code
	 * path dies. Core's `FileSystem.layerNoop` splits its unstubbed members
	 * three ways: typed `NotFound` for most, silent success for `exists`
	 * (`false`) and `remove`, and a defect for the five `make*` members
	 * (`makeDirectory`, `makeTempDirectory`, `makeTempDirectoryScoped`,
	 * `makeTempFile`, `makeTempFileScoped`). `failTimes` or an
	 * `Effect.fail` handler models the first arm, a handler returning
	 * `Effect.succeed(...)` models the second, and `die` models the third.
	 *
	 * Usable on any `Effect`-returning member; it is not assignable to the lazy
	 * members, whose handlers return their own type: `Stream.die` for `stream`
	 * and `watch`, `Sink.die` for `sink`.
	 *
	 * @example
	 * ```ts
	 * import { MemoryFileSystem } from "./index.ts";
	 *
	 * const layer = MemoryFileSystem.layerWith(undefined, {
	 *   faults: { makeDirectory: MemoryFileSystem.die(new Error("makeDirectory is not stubbed")) },
	 * });
	 * ```
	 *
	 * @param defect - The defect every intercepted call dies with.
	 */
	static readonly die =
		(defect: unknown): (() => Effect.Effect<never>) =>
		() =>
			Effect.die(defect);

	/**
	 * A seed entry for a file, optionally carrying its initial permission mode.
	 *
	 * @remarks
	 * `MemoryFileSystem.file(content)` is equivalent to seeding `content`
	 * directly; the tagged form exists for the `mode` option. Modes are
	 * recorded and readable via `stat`, never enforced (see the class notes).
	 *
	 * @param content - File contents; strings are UTF-8 encoded.
	 * @param options - `mode`: initial permission bits (default `0o644`).
	 */
	static readonly file = (
		content: string | Uint8Array,
		options?: { readonly mode?: number | undefined; readonly mtime?: number | undefined },
	): MemoryFileSystemSeedFile => ({
		_tag: "MemoryFileSystemSeedFile",
		content,
		...(options?.mode !== undefined ? { mode: options.mode } : {}),
		...(options?.mtime !== undefined ? { mtime: options.mtime } : {}),
	});

	/**
	 * A seed entry for a directory — the way a seed expresses an *empty*
	 * directory, or one with an initial permission mode.
	 *
	 * @remarks
	 * The mode also applies when the directory already exists at seeding time
	 * (for example, created implicitly as an earlier entry's parent). Modes are
	 * recorded and readable via `stat`, never enforced (see the class notes).
	 *
	 * @param options - `mode`: initial permission bits (default `0o755`).
	 */
	static readonly directory = (options?: { readonly mode?: number | undefined }): MemoryFileSystemSeedDirectory => ({
		_tag: "MemoryFileSystemSeedDirectory",
		...(options?.mode !== undefined ? { mode: options.mode } : {}),
	});

	/**
	 * A seed entry for a symbolic link to `target`.
	 *
	 * @remarks
	 * The target is stored verbatim and resolved lazily on traversal, exactly
	 * like `fs.symlink` — it may point at a path seeded later, or dangle.
	 *
	 * @param target - The link target path.
	 */
	static readonly symlink = (target: string): MemoryFileSystemSeedSymlink => ({
		_tag: "MemoryFileSystemSeedSymlink",
		target,
	});

	/**
	 * Provides `FileSystem.FileSystem` backed by a fresh, empty volume, and
	 * {@link MemoryFileSystem.Volume} inspecting it.
	 *
	 * @remarks
	 * Layer memoization is per-build: consumers within one provided layer graph
	 * share one volume; each separate `Effect.provide` builds a new one. The
	 * extra `Volume` service is harmless where only `FileSystem` is needed — a
	 * layer providing more is assignable to `Layer<FileSystem.FileSystem>`.
	 */
	static readonly layer: Layer.Layer<FileSystem.FileSystem | MemoryFileSystemVolume> = Layer.effectContext(
		buildHandle({}, undefined).pipe(Effect.orDie, Effect.map(handleContext)),
	);

	/**
	 * Provides `FileSystem.FileSystem` backed by a fresh volume pre-populated
	 * from `seed`.
	 *
	 * @remarks
	 * A parameterized layer factory mints a fresh reference per call — bind the
	 * result to a `const` and reuse it rather than calling `layerWith(...)` at
	 * each composition site.
	 *
	 * Layer memoization is **per-build**, not per-value: each separate
	 * `Effect.provide` of the bound `const` builds — and re-seeds — its own
	 * volume, so a write in one provide is invisible to the next. To share one
	 * volume across several effects, run them under a single provide of one
	 * composed layer graph; within that build every consumer of the `const`
	 * sees the same volume (and `Layer.fresh` is how a consumer inside that
	 * graph opts back out into its own).
	 *
	 * A contradictory seed is a test-wiring bug and **dies** with the
	 * underlying typed error as its cause; use
	 * {@link MemoryFileSystem.makeWith} to handle seeding failures in the error
	 * channel instead.
	 *
	 * @example
	 * ```ts
	 * import { MemoryFileSystem } from "./index.ts";
	 * import { Effect, FileSystem } from "effect";
	 *
	 * const Volume = MemoryFileSystem.layerWith({ "/a.txt": "seed" });
	 *
	 * const write = Effect.gen(function* () {
	 *   const fs = yield* FileSystem.FileSystem;
	 *   yield* fs.writeFileString("/a.txt", "written");
	 * });
	 * const read = Effect.gen(function* () {
	 *   const fs = yield* FileSystem.FileSystem;
	 *   return yield* fs.readFileString("/a.txt");
	 * });
	 *
	 * // ONE provide, one build, one volume — reads back "written".
	 * const shared = Effect.provide(Effect.andThen(write, read), Volume);
	 *
	 * // TWO provides are two builds: the second is re-seeded — reads back "seed".
	 * const reseeded = Effect.andThen(Effect.provide(write, Volume), Effect.provide(read, Volume));
	 * ```
	 *
	 * @param seed - Absolute POSIX paths mapped to seed entries (relative keys
	 *   when `options.root` is given).
	 * @param options - See {@link MemoryFileSystemOptions}.
	 */
	static readonly layerWith = (
		seed: MemoryFileSystemSeed = {},
		options?: MemoryFileSystemOptions,
	): Layer.Layer<FileSystem.FileSystem | MemoryFileSystemVolume> =>
		buildHandle(seed, options).pipe(Effect.orDie, Effect.map(handleContext), Layer.effectContext);

	/**
	 * The context key for {@link MemoryFileSystemVolume}, mirroring the shape
	 * of `FileSystem.FileSystem` itself (the interface is both identifier and
	 * shape).
	 *
	 * @remarks
	 * Published by every memory layer — {@link MemoryFileSystem.layer},
	 * {@link MemoryFileSystem.layerWith} and a handle's `layer` — beside the
	 * `FileSystem` it inspects; under `options.faults` it inspects the raw
	 * volume beneath the faults. Resolve it in a test with
	 * `yield* MemoryFileSystem.Volume`.
	 */
	static readonly Volume: Context.Service<MemoryFileSystemVolume, MemoryFileSystemVolume> = Context.Service(
		"@effected/memfs/MemoryFileSystemVolume",
	);

	/**
	 * Adapts a {@link MemoryFileSystemVolume} to the synchronous `node:fs`
	 * subset — `exists`, `readFile`, `readDirectory`, `isDirectory`, `stat`,
	 * `lstat` — for code
	 * that takes a consumer-supplied sync filesystem port rather than requiring
	 * `FileSystem` from the environment.
	 *
	 * @remarks
	 * A pure adapter over the inspection view: no service, no layer, no
	 * `Effect`. Get a volume from
	 * {@link MemoryFileSystem.makeHandle} (or resolve
	 * {@link MemoryFileSystem.Volume}) and pass the result wherever the port is
	 * expected. The shape is structural, so `@effected/workspaces`'s
	 * `SyncFileSystem` — and anything else asking for a subset of these operations —
	 * is satisfied without either package importing the other.
	 *
	 * This is deliberately NOT a general escape hatch from the `FileSystem`
	 * service. Code that calls `node:fs` directly still does not see the volume;
	 * only code that accepts an injected port does. Reaching for the service
	 * remains the better answer whenever the call site can be changed.
	 *
	 * The port follows symbolic links even though the view underneath is literal,
	 * because the operations it stands in for are `stat`-defined. Absence throws
	 * rather than returning `""` or `[]`, carrying honest absence into a
	 * signature that has no error channel; thrown errors carry
	 * `code`/`syscall`/`path`, matching what the `node:fs` binding would raise.
	 *
	 * @example
	 * ```ts
	 * import { MemoryFileSystem } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const program = Effect.gen(function* () {
	 * 	const { volume } = yield* MemoryFileSystem.makeHandle({
	 * 		"/repo/package.json": `{ "name": "root" }`,
	 * 		"/repo/packages": MemoryFileSystem.directory(),
	 * 	});
	 * 	const sync = MemoryFileSystem.syncFileSystem(volume);
	 * 	return sync.readDirectory("/repo"); // => ["package.json", "packages"]
	 * });
	 * ```
	 */
	static readonly syncFileSystem = (
		volume: MemoryFileSystemVolume,
		options?: MemoryFileSystemPortOptions<MemoryFileSystemSyncFaults>,
	): MemoryFileSystemSyncFileSystem =>
		withFaults(
			makeSyncFileSystem(volume),
			options?.faults,
			"MemoryFileSystem.syncFileSystem faults",
		);

	/**
	 * Adapts a {@link MemoryFileSystemVolume} to the read-only
	 * `node:fs/promises` subset — `readdir` (with `withFileTypes`), `stat`,
	 * `lstat`, `readFile` — for code that takes an injected async filesystem.
	 *
	 * @remarks
	 * The async twin of {@link MemoryFileSystem.syncFileSystem}: identical
	 * resolution, link-following and node-shaped errors, surfaced as rejected
	 * promises.
	 *
	 * @param volume - The volume to adapt.
	 * @param options - Optional fault handlers.
	 */
	static readonly promisesFileSystem = (
		volume: MemoryFileSystemVolume,
		options?: MemoryFileSystemPortOptions<MemoryFileSystemPromisesFaults>,
	): MemoryFileSystemPromisesFileSystem =>
		withFaults(
			makePromisesFileSystem(volume),
			options?.faults,
			"MemoryFileSystem.promisesFileSystem faults",
			true,
		);

	/**
	 * Builds a volume synchronously and returns every view over it as a
	 * {@link MemoryFileSystemHandle}.
	 *
	 * @remarks
	 * For suites that construct their volume at `describe` scope and never
	 * touch `Effect`. Throws synchronously — a node-shaped error carrying
	 * `code`, `syscall` and `path` — when the seed contradicts itself or the
	 * `root` is invalid (`EINVAL`).
	 *
	 * The handle reads the real clock, so writes do not follow `TestClock`.
	 *
	 * @param seed - Seed entries; relative keys when `options.root` is given.
	 * @param options - See {@link MemoryFileSystemOptions}.
	 */
	static readonly makeSync = (
		seed: MemoryFileSystemSeed = {},
		options?: MemoryFileSystemOptions,
	): MemoryFileSystemHandle => {
		// A bad root or seed key throws node's EINVAL naming the offending value
		// in the path slot (and so in the message), before anything is built.
		// This DUPLICATES the check `seedWith` makes inside `buildHandle` — on
		// purpose: there the failure is a typed BadArgument, which carries no
		// path, so `runNode` could only report `seed ''`. Validating here first is
		// the only way the thrown error can name the key. Do not dedup it away.
		const applied = applyRoot(seed, options?.root);
		if (applied._tag === "Failure") throw nodeErrno("EINVAL", "seed", applied.failure.subject);
		return runNode(buildHandle(seed, options), (error) => ({
			syscall: syscallForMethod(error.reason.method),
			path: "pathOrDescriptor" in error.reason ? String(error.reason.pathOrDescriptor ?? "") : "",
		}));
	};

	/**
	 * Builds a volume and returns every view over it as a
	 * {@link MemoryFileSystemHandle}: the `FileSystem` service, the inspection
	 * {@link MemoryFileSystemVolume}, a layer pinned to this one volume, the two
	 * read-only ports, and synchronous setup mutators.
	 *
	 * @remarks
	 * The `Effect` twin of {@link MemoryFileSystem.makeSync}. Reach for it when
	 * assertions run AFTER the effect under test: the layer forms build (and
	 * re-seed) a fresh volume per provide, so a post-run assertion would read a
	 * different volume than the code under test wrote to. Provide
	 * `handle.layer` — fixed to this volume, stable across provides — and assert
	 * on `handle.volume`.
	 *
	 * With `options.faults`, `handle.fileSystem` (and `handle.layer`) are
	 * faulted; `handle.volume`, the ports and the mutators work beneath the
	 * faults, because they are test setup and inspection, not the code under
	 * test. Fails typed when the seed contradicts itself.
	 *
	 * @param seed - Seed entries; relative keys when `options.root` is given.
	 *   Defaults to an empty seed.
	 * @param options - See {@link MemoryFileSystemOptions}.
	 */
	static readonly makeHandle = (
		seed: MemoryFileSystemSeed = {},
		options?: MemoryFileSystemOptions,
	): Effect.Effect<MemoryFileSystemHandle, PlatformError.PlatformError> => buildHandle(seed, options);

	/**
	 * Builds the error a synchronous `node:fs` call throws: an `Error` carrying
	 * `code`, `syscall` and `path`, for a sync port that has to fail the way the
	 * Node binding does.
	 *
	 * @param code - The errno code, e.g. `"ENOENT"`.
	 * @param syscall - The failing call, e.g. `"open"`.
	 * @param path - The path the call was given; omit it for a
	 *   descriptor-based syscall (`read`), whose node error carries none.
	 */
	static readonly errno = (code: string, syscall: string, path?: string): MemoryFileSystemErrnoError =>
		nodeErrno(code, syscall, path);

	private constructor() {}
}
