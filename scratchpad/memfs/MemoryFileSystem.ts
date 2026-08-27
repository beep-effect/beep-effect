/**
 * In-memory `FileSystem` test double: seed a volume, inject faults, and inspect
 * what a program wrote — a kit facade over the vendored engine.
 *
 * Public constructors and layers live on {@link MemoryFileSystem}. This module
 * adds seeding, the delegate-by-default fault wrapper, and the synchronous
 * inspectable view; the engine itself stays in `internal/volume.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// The facade over the vendored engine (see internal/volume.ts for the port
// header and the adaptation ledger pointer). Everything in this file — the
// seeding API and the fault-injection wrapper — is a kit extension, not part
// of the vendored port.

import { $ScratchpadId } from "@beep/identity";
import * as O from "@beep/utils/Option";
import { Context, DateTime, Effect, FileSystem, Layer, Match, MutableHashMap, Option, PlatformError } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as internal from "./internal/volume.ts";

const $I = $ScratchpadId.create("memfs/MemoryFileSystem");

class MemoryFileSystemSyncError extends S.TaggedError<MemoryFileSystemSyncError>($I`MemoryFileSystemSyncError`)(
  "MemoryFileSystemSyncError",
  {
    code: S.Literals(["ENOENT", "ENOTDIR", "EISDIR"]),
    syscall: S.String,
    path: S.String,
    message: S.String,
  }
) {}

class InvalidTransientFaultCount extends S.TaggedError<InvalidTransientFaultCount>($I`InvalidTransientFaultCount`)(
  "InvalidTransientFaultCount",
  { times: S.Finite }
) {}

/**
 * Synchronous, read-only inspection of one memory volume — the write-path
 * counterpart to seeding, for asserting on what a program actually wrote
 * without routing every assertion through an `Effect` read.
 *
 * **Details**
 *
 * Resolved from context via the {@link MemoryFileSystem.Volume} key, published
 * only by {@link MemoryFileSystem.layerInspectable} and
 * {@link MemoryFileSystem.layerInspectableWith} (or obtained value-level from
 * {@link MemoryFileSystem.makeInspectable}). Every read walks the volume's
 * live state at call time — never a copy taken at build — so a read after a
 * write observes the write.
 *
 * The view is **literal**: paths are normalized lexically (`//`, `.`, `..`)
 * but symbolic links are never followed — a symlink is present to `has`
 * yet has no content of its own, and reading *through* one is the `FileSystem`
 * API's job. Hard links surface once per directory entry, each path carrying
 * the same content. Returned byte arrays are defensive copies.
 *
 * Honest absence (the effected#249 contract) carries over: `text`/`bytes`
 * answer `undefined` for a path holding no regular file — `""` only ever
 * means a genuinely empty file.
 *
 * **Gotchas**
 *
 * The engine pre-creates `/tmp` at build, so `has` answers `true` for it even
 * on an unseeded volume; `snapshot`/`paths` are unaffected (it is a directory).
 *
 * @public
 * @category models
 * @since 0.0.0
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
   * **Details**
   *
   * Seeded entries take the volume's clock at seed time, so a seed alone
   * cannot express "this file is older than that one". Give an entry an
   * explicit time with {@link MemoryFileSystem.file}'s `mtime` option, or
   * change it afterwards through the `FileSystem` service's `utimes`.
   *
   * **Gotchas**
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
   * **Details**
   *
   * Literal, like the rest of this view: this reports the link, it does not
   * resolve it. {@link MemoryFileSystem.syncFileSystem} is the surface that
   * follows links, because the port it implements is defined in `stat` terms.
   */
  readonly readLink: (path: string) => string | undefined;
}

/**
 * The four synchronous file operations a consumer-supplied filesystem port
 * needs, as {@link MemoryFileSystem.syncFileSystem} exposes them over a
 * volume.
 *
 * **Details**
 *
 * The shape is the `node:fs` synchronous subset — `existsSync`,
 * `readFileSync(p, "utf8")`, `readdirSync`, `statSync(p).isDirectory()` — which
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
 * non-directory.
 *
 * **Gotchas**
 *
 * Link cycles and paths that take more than 40 hops are reported as absence
 * (`exists` is `false`; `readFile`/`readDirectory` throw `ENOENT`), not
 * `ELOOP`. Choose {@link MemoryFileSystemVolume} when the test must see the
 * link itself rather than the resolved target.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface MemoryFileSystemSyncFileSystem {
  /** Whether anything exists at `path`, following links. A dangling link is absent. Never throws. */
  readonly exists: (path: string) => boolean;
  /** The UTF-8 contents of the file at `path`, following links. Throws `ENOENT`/`EISDIR`/`ENOTDIR`. */
  readonly readFile: (path: string) => string;
  /** The entry names inside the directory at `path`, following links. Throws `ENOENT`/`ENOTDIR`. */
  readonly readDirectory: (path: string) => ReadonlyArray<string>;
  /** Whether `path` resolves to a directory, following links — as `statSync(p).isDirectory()` does. */
  readonly isDirectory: (path: string) => boolean;
}

/**
 * The `FileSystem` service and the {@link MemoryFileSystemVolume} inspecting
 * the same underlying volume — the value-level pair returned by
 * {@link MemoryFileSystem.makeInspectable} and
 * {@link MemoryFileSystem.makeInspectableWith}.
 *
 * Not a runtime schema: both fields are live behavioral services, not data
 * that can cross an encode/decode boundary.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface MemoryFileSystemInspectable {
  readonly fileSystem: FileSystem.FileSystem;
  readonly volume: MemoryFileSystemVolume;
}

/**
 * A seed entry describing a file, optionally carrying its initial permission
 * mode — built with {@link MemoryFileSystem.file}.
 *
 * **Example** (Construct a file seed)
 *
 * ```ts
 * import { MemoryFileSystemSeedFile } from "@beep/scratchpad/memfs"
 *
 * const file = MemoryFileSystemSeedFile.make({ content: "{}", mode: 0o644 })
 * console.log(file._tag) // "MemoryFileSystemSeedFile"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export const MemoryFileSystemSeedFile = S.TaggedStruct("MemoryFileSystemSeedFile", {
  /** File contents; strings are UTF-8 encoded, `Uint8Array`s written verbatim. */
  content: S.Union([S.String, S.Uint8Array]),
  /** Initial permission bits (defaults to the volume's `0o644`). */
  mode: S.optionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0))),
  /**
   * Initial modification time as epoch milliseconds. Defaults to the volume's
   * clock at seed time, which makes every seeded entry effectively
   * simultaneous — set this when a test needs one file to read as older than
   * another.
   */
  mtime: S.optionalKey(S.Finite),
}).pipe(
  $I.annoteSchema("MemoryFileSystemSeedFile", {
    description: "A file seed carrying bytes or UTF-8 text plus optional initial mode and modification time.",
  })
);

/**
 * Decoded file seed entry.
 *
 * @see {@link MemoryFileSystemSeedFile} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemSeedFile = typeof MemoryFileSystemSeedFile.Type;

/**
 * A seed entry describing a directory — built with
 * {@link MemoryFileSystem.directory}. The only way a seed can express an *empty*
 * directory, and the way a directory receives an initial permission mode.
 *
 * **Example** (Construct an empty-directory seed)
 *
 * ```ts
 * import { MemoryFileSystemSeedDirectory } from "@beep/scratchpad/memfs"
 *
 * const directory = MemoryFileSystemSeedDirectory.make({ mode: 0o755 })
 * console.log(directory._tag) // "MemoryFileSystemSeedDirectory"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export const MemoryFileSystemSeedDirectory = S.TaggedStruct("MemoryFileSystemSeedDirectory", {
  /** Initial permission bits (defaults to the volume's `0o755`). */
  mode: S.optionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0))),
}).pipe(
  $I.annoteSchema("MemoryFileSystemSeedDirectory", {
    description: "A directory seed carrying an optional initial permission mode.",
  })
);

/**
 * Decoded directory seed entry.
 *
 * @see {@link MemoryFileSystemSeedDirectory} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemSeedDirectory = typeof MemoryFileSystemSeedDirectory.Type;

/**
 * A seed entry describing a symbolic link — built with
 * {@link MemoryFileSystem.symlink}.
 *
 * **Example** (Construct a symbolic-link seed)
 *
 * ```ts
 * import { MemoryFileSystemSeedSymlink } from "@beep/scratchpad/memfs"
 *
 * const link = MemoryFileSystemSeedSymlink.make({ target: "/repo/config.json" })
 * console.log(link.target) // "/repo/config.json"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export const MemoryFileSystemSeedSymlink = S.TaggedStruct("MemoryFileSystemSeedSymlink", {
  /** The link target, stored verbatim; it may dangle. */
  target: S.String,
}).pipe(
  $I.annoteSchema("MemoryFileSystemSeedSymlink", {
    description: "A symbolic-link seed carrying its target verbatim.",
  })
);

/**
 * Decoded symbolic-link seed entry.
 *
 * @see {@link MemoryFileSystemSeedSymlink} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemSeedSymlink = typeof MemoryFileSystemSeedSymlink.Type;

/**
 * One value in a {@link MemoryFileSystemSeed}: plain file contents
 * (`string | Uint8Array`, unchanged from the original seed shape), or a tagged
 * entry describing a file with a mode, a directory, or a symbolic link.
 *
 * **Example** (Guard a shorthand text entry)
 *
 * ```ts
 * import { MemoryFileSystemSeedEntry } from "@beep/scratchpad/memfs"
 * import { Schema } from "effect"
 *
 * console.log(Schema.is(MemoryFileSystemSeedEntry)("{}")) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export const MemoryFileSystemSeedEntry = S.Union([
  S.String,
  S.Uint8Array,
  MemoryFileSystemSeedFile,
  MemoryFileSystemSeedDirectory,
  MemoryFileSystemSeedSymlink,
]).pipe(
  $I.annoteSchema("MemoryFileSystemSeedEntry", {
    description: "One file, directory, or symbolic-link entry in an in-memory filesystem seed.",
  })
);

/**
 * Decoded in-memory filesystem seed entry.
 *
 * @see {@link MemoryFileSystemSeedEntry} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemSeedEntry = typeof MemoryFileSystemSeedEntry.Type;

/**
 * A volume seed: absolute POSIX paths mapped to seed entries.
 *
 * **Details**
 *
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
 * **Example** (Construct a volume seed)
 *
 * ```ts
 * import { MemoryFileSystemSeed } from "@beep/scratchpad/memfs"
 *
 * const seed = MemoryFileSystemSeed.make({ "/config.json": "{}" })
 * console.log(seed["/config.json"]) // "{}"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export const MemoryFileSystemSeed = S.Record(S.String, MemoryFileSystemSeedEntry).pipe(
  $I.annoteSchema("MemoryFileSystemSeed", {
    description: "Absolute POSIX paths mapped to file, directory, or symbolic-link seed entries.",
  })
);

/**
 * Decoded in-memory filesystem volume seed.
 *
 * @see {@link MemoryFileSystemSeed} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemSeed = typeof MemoryFileSystemSeed.Type;

/**
 * The members of `FileSystem.FileSystem` that a fault handler can intercept:
 * every function-valued method, the `Stream`/`Sink`-returning trio (`stream`,
 * `sink`, `watch`) included. Only {@link MemoryFileSystem.failTimes} is
 * narrower — a transient fault substitutes a failing `Effect`, so it slots
 * into the `Effect`-returning methods alone.
 *
 * @public
 * @category type-level
 * @since 0.0.0
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
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemFaultHandler<Method extends MemoryFileSystemFaultMethod> = (
  ...args: Parameters<FileSystem.FileSystem[Method]>
) => ReturnType<FileSystem.FileSystem[Method]> | undefined;

/**
 * A transient fault built with {@link MemoryFileSystem.failTimes}: usable
 * anywhere a fault handler is, it fails a fixed number of calls with a given
 * `PlatformError` and then delegates forever after.
 *
 * **Details**
 *
 * The countdown state is **armed per volume build** — see
 * {@link MemoryFileSystem.failTimes} for exactly when a counter is shared and
 * when it is re-armed.
 *
 * **Example** (Construct a transient platform failure)
 *
 * ```ts
 * import { MemoryFileSystemTransientFault } from "@beep/scratchpad/memfs"
 * import { PlatformError } from "effect"
 *
 * const error = PlatformError.systemError({ _tag: "Busy", module: "FileSystem", method: "readFile" })
 * const fault = MemoryFileSystemTransientFault.make({ times: 1, error })
 * console.log(fault.times) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export const MemoryFileSystemTransientFault = S.TaggedStruct("MemoryFileSystemTransientFault", {
  /** How many calls fail before the fault starts delegating. */
  times: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  /** The typed failure each of those calls fails with. */
  error: S.instanceOf(PlatformError.PlatformError),
}).pipe(
  $I.annoteSchema("MemoryFileSystemTransientFault", {
    description: "A typed platform failure injected for a fixed number of filesystem calls.",
  })
);

/**
 * Decoded transient filesystem fault configuration.
 *
 * @see {@link MemoryFileSystemTransientFault} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemTransientFault = typeof MemoryFileSystemTransientFault.Type;

/**
 * The fault registration map for {@link MemoryFileSystem.makeFaulty} and
 * {@link MemoryFileSystem.layerFaulty}: per intercepted method, either a
 * {@link MemoryFileSystemFaultHandler} or — on the `Effect`-returning methods
 * — a {@link MemoryFileSystemTransientFault}. Methods absent from the map are
 * never intercepted.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFileSystemFaults = {
  readonly [Method in MemoryFileSystemFaultMethod]?:
    | MemoryFileSystemFaultHandler<Method>
    | (Effect.Effect<never, PlatformError.PlatformError> extends ReturnType<FileSystem.FileSystem[Method]>
        ? MemoryFileSystemTransientFault
        : never);
};

const encoder = new TextEncoder();

const seedFile = Effect.fn("MemoryFileSystem.seedFile")(function* (
  fs: FileSystem.FileSystem,
  path: string,
  entry: MemoryFileSystemSeedFile
) {
  const data = P.isString(entry.content) ? encoder.encode(entry.content) : entry.content;
  yield* fs.writeFile(path, data, entry.mode !== undefined ? { mode: entry.mode } : undefined);
  if (entry.mtime !== undefined) {
    const stamp = DateTime.toDateUtc(DateTime.makeUnsafe(entry.mtime));
    yield* fs.utimes(path, stamp, stamp);
  }
});

const seedDirectory = Effect.fn("MemoryFileSystem.seedDirectory")(function* (
  fs: FileSystem.FileSystem,
  path: string,
  entry: MemoryFileSystemSeedDirectory
) {
  yield* fs.makeDirectory(path, { recursive: true });
  if (entry.mode !== undefined) {
    yield* fs.chmod(path, entry.mode);
  }
});

const seedVolume = (
  fs: FileSystem.FileSystem,
  seed: MemoryFileSystemSeed
): Effect.Effect<void, PlatformError.PlatformError> =>
  Effect.gen(function* () {
    for (const [path, entry] of R.toEntries(seed)) {
      const separator = path.lastIndexOf("/");
      const parent = separator <= 0 ? "/" : path.slice(0, separator);
      if (parent !== "/") {
        yield* fs.makeDirectory(parent, { recursive: true });
      }
      if (P.isString(entry) || entry instanceof Uint8Array) {
        yield* fs.writeFile(path, P.isString(entry) ? encoder.encode(entry) : entry);
        continue;
      }
      yield* Match.value(entry).pipe(
        Match.tagsExhaustive({
          MemoryFileSystemSeedFile: (entry) => seedFile(fs, path, entry),
          MemoryFileSystemSeedDirectory: (entry) => seedDirectory(fs, path, entry),
          MemoryFileSystemSeedSymlink: (entry) => fs.symlink(entry.target, path),
        })
      );
    }
  });

const decoder = new TextDecoder();

// Lexical-only normalization for inspection queries: collapses "//" and ".",
// applies "..", resolves relative paths from the virtual root — matching the
// engine's canonical "/a/b" spelling. Deliberately does NOT follow symlinks:
// the inspection view is literal.
const normalizeQueryPath = (path: string): string => {
  const segments: Array<string> = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join("/")}`;
};

const findEntryAt = (
  entries: ReadonlyArray<internal.VolumeEntrySnapshot>,
  path: string
): internal.VolumeEntrySnapshot | undefined => {
  const normalized = normalizeQueryPath(path);
  return entries.find((entry) => entry.path === normalized);
};

const makeVolumeService = (entries: () => Array<internal.VolumeEntrySnapshot>): MemoryFileSystemVolume => ({
  snapshot: () => {
    const record: Record<string, Uint8Array> = {};
    for (const entry of entries()) {
      if (entry.data !== undefined) {
        record[entry.path] = entry.data.slice();
      }
    }
    return record;
  },
  text: (path) => {
    const data = findEntryAt(entries(), path)?.data;
    return data === undefined ? undefined : decoder.decode(data);
  },
  bytes: (path) => findEntryAt(entries(), path)?.data?.slice(),
  has: (path) => findEntryAt(entries(), path) !== undefined,
  paths: () =>
    entries()
      .filter((entry) => entry.data !== undefined)
      .map((entry) => entry.path)
      .sort(),
  readDirectory: (path) => {
    const snapshot = entries();
    const normalized = normalizeQueryPath(path);
    if (findEntryAt(snapshot, normalized)?.type !== "Directory") {
      return undefined;
    }
    // "/" would otherwise build the prefix "//" and match nothing.
    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    return snapshot
      .filter(
        (entry) =>
          entry.path !== normalized && entry.path.startsWith(prefix) && !entry.path.slice(prefix.length).includes("/")
      )
      .map((entry) => entry.path.slice(prefix.length))
      .sort();
  },
  isDirectory: (path) => findEntryAt(entries(), path)?.type === "Directory",
  mtime: (path) => findEntryAt(entries(), path)?.mtime,
  readLink: (path) => {
    const entry = findEntryAt(entries(), path);
    return entry?.type === "SymbolicLink" ? entry.target : undefined;
  },
});

// Absence in a synchronous, non-`Effect` signature can only be reported by
// throwing — the honest-absence contract's sync form. `code` mirrors the
// `node:fs` errno a consumer written against the Node binding may inspect.
const syncAbsence = (code: "ENOENT" | "ENOTDIR" | "EISDIR", syscall: string, path: string): Error =>
  MemoryFileSystemSyncError.make({ code, syscall, path, message: `${code}: ${syscall} '${path}'` });

// The port is defined in `stat` terms, so it FOLLOWS symbolic links — unlike
// the literal inspection view it is built on. `MAX_LINK_HOPS` mirrors the
// ELOOP guard a real filesystem applies; a cycle resolves to absence rather
// than spinning.
const MAX_LINK_HOPS = 40;

const resolveLinks = (volume: MemoryFileSystemVolume, path: string): string | undefined => {
  // Resolution is per COMPONENT, not just the final one: `/links/pkg/a.json`
  // has to follow the link at `/links/pkg` before it can see `a.json`, exactly
  // as a real filesystem walks a path. Resolving only the last component makes
  // every path *underneath* a symlinked directory read as absent.
  let current = "";
  let hops = 0;
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      // Applied to the RESOLVED location, so ".." after a link ascends from
      // the target rather than from the link's own parent.
      current = current.slice(0, Math.max(0, current.lastIndexOf("/")));
      continue;
    }
    let candidate = `${current}/${part}`;
    for (;;) {
      const target = volume.readLink(candidate);
      if (target === undefined) break;
      hops += 1;
      if (hops > MAX_LINK_HOPS) return undefined;
      candidate = target.startsWith("/") ? target : `${current}/${target}`;
    }
    if (!volume.has(candidate)) return undefined;
    current = candidate;
  }
  const final = current === "" ? "/" : current;
  return volume.has(final) ? final : undefined;
};

const makeSyncFileSystem = (volume: MemoryFileSystemVolume): MemoryFileSystemSyncFileSystem => {
  // A dangling link is ABSENT to this port, matching `existsSync`, even though
  // the literal view reports the link itself as present.
  const resolved = (path: string) => resolveLinks(volume, path);
  return {
    exists: (path) => resolved(path) !== undefined,
    readFile: (path) => {
      const target = resolved(path);
      if (target === undefined) {
        throw syncAbsence("ENOENT", "readFile", path);
      }
      const text = volume.text(target);
      if (text === undefined) {
        // Reading a directory as a file is EISDIR in `readFileSync`;
        // anything else that is not a regular file is ENOTDIR.
        throw syncAbsence(volume.isDirectory(target) ? "EISDIR" : "ENOTDIR", "readFile", path);
      }
      return text;
    },
    readDirectory: (path) => {
      const target = resolved(path);
      if (target === undefined) {
        throw syncAbsence("ENOENT", "readDirectory", path);
      }
      const names = volume.readDirectory(target);
      if (names === undefined) {
        throw syncAbsence("ENOTDIR", "readDirectory", path);
      }
      return names;
    },
    isDirectory: (path) => {
      const target = resolved(path);
      return target !== undefined && volume.isDirectory(target);
    },
  };
};

const inspectableContext = ({
  fileSystem,
  volume,
}: MemoryFileSystemInspectable): Context.Context<FileSystem.FileSystem | MemoryFileSystemVolume> =>
  Context.make(FileSystem.FileSystem, fileSystem).pipe(Context.add(MemoryFileSystem.Volume, volume));

// The armed form of a fault: per-method parameter and return typing is erased
// for storage in the method → handler map (a handler may return an Effect, a
// Stream, a Sink, or undefined); `wrapFaulty` restores it at each call site.
type ArmedHandler = (...args: ReadonlyArray<unknown>) => unknown;

const armFault = (fault: NonNullable<MemoryFileSystemFaults[MemoryFileSystemFaultMethod]>): ArmedHandler => {
  if (P.isFunction(fault)) {
    return fault as ArmedHandler;
  }
  let remaining = fault.times;
  return () => {
    if (remaining <= 0) {
      return undefined;
    }
    remaining -= 1;
    return Effect.fail(fault.error);
  };
};

const wrapFaulty = (base: FileSystem.FileSystem, faults: MemoryFileSystemFaults): FileSystem.FileSystem => {
  const armed = MutableHashMap.empty<MemoryFileSystemFaultMethod, ArmedHandler>();
  for (const method of R.keys(faults as Record<MemoryFileSystemFaultMethod, unknown>)) {
    const fault = faults[method];
    if (fault !== undefined) {
      MutableHashMap.set(armed, method, armFault(fault));
    }
  }
  // Effect-returning methods defer through Effect.suspend so each EXECUTION
  // re-consults its handler — a retried effect re-decides, which is what lets
  // failTimes count Effect.retry attempts rather than method invocations.
  const intercept = <Method extends MemoryFileSystemFaultMethod>(
    method: Method,
    target: FileSystem.FileSystem[Method]
  ): FileSystem.FileSystem[Method] => {
    const handler = Option.getOrUndefined(MutableHashMap.get(armed, method));
    if (handler === undefined) {
      return target;
    }
    const delegate = target as (...args: ReadonlyArray<unknown>) => Effect.Effect<unknown, PlatformError.PlatformError>;
    const intercepted = (...args: ReadonlyArray<unknown>) =>
      Effect.suspend(
        () => (handler(...args) ?? delegate(...args)) as Effect.Effect<unknown, PlatformError.PlatformError>
      );
    return intercepted as FileSystem.FileSystem[Method];
  };
  // `stream`, `sink` and `watch` return Streams/Sinks — lazy by construction
  // — so their handlers are consulted when the method is called; the value
  // the handler returns (or the delegate's) carries its own per-run laziness.
  const interceptLazy = <Method extends "sink" | "stream" | "watch">(
    method: Method,
    target: FileSystem.FileSystem[Method]
  ): FileSystem.FileSystem[Method] => {
    const handler = Option.getOrUndefined(MutableHashMap.get(armed, method));
    if (handler === undefined) {
      return target;
    }
    const delegate = target as (...args: ReadonlyArray<unknown>) => unknown;
    const intercepted = (...args: ReadonlyArray<unknown>) => handler(...args) ?? delegate(...args);
    return intercepted as FileSystem.FileSystem[Method];
  };
  // Rebuilding through FileSystem.make re-derives `exists`, `readFileString`,
  // `writeFileString`, `stream` and `sink` from the intercepted core methods,
  // so a fault registered on e.g. `readFile` or `open` propagates coherently
  // into the members derived from it — exactly as an OS-level failure would.
  // The five derived members are destructured out of the spread so the
  // contract is explicit rather than relying on `make` to overwrite them.
  const {
    exists: _exists,
    readFileString: _readFileString,
    sink: _sink,
    stream: _stream,
    writeFileString: _writeFileString,
    ...primitives
  } = base;
  const core = FileSystem.make({
    ...primitives,
    access: intercept("access", base.access),
    chmod: intercept("chmod", base.chmod),
    chown: intercept("chown", base.chown),
    copy: intercept("copy", base.copy),
    copyFile: intercept("copyFile", base.copyFile),
    glob: intercept("glob", base.glob),
    link: intercept("link", base.link),
    makeDirectory: intercept("makeDirectory", base.makeDirectory),
    makeTempDirectory: intercept("makeTempDirectory", base.makeTempDirectory),
    makeTempDirectoryScoped: intercept("makeTempDirectoryScoped", base.makeTempDirectoryScoped),
    makeTempFile: intercept("makeTempFile", base.makeTempFile),
    makeTempFileScoped: intercept("makeTempFileScoped", base.makeTempFileScoped),
    open: intercept("open", base.open),
    readDirectory: intercept("readDirectory", base.readDirectory),
    readFile: intercept("readFile", base.readFile),
    readLink: intercept("readLink", base.readLink),
    realPath: intercept("realPath", base.realPath),
    remove: intercept("remove", base.remove),
    rename: intercept("rename", base.rename),
    stat: intercept("stat", base.stat),
    symlink: intercept("symlink", base.symlink),
    truncate: intercept("truncate", base.truncate),
    utimes: intercept("utimes", base.utimes),
    watch: interceptLazy("watch", base.watch),
    writeFile: intercept("writeFile", base.writeFile),
  });
  return {
    ...core,
    exists: intercept("exists", core.exists),
    readFileString: intercept("readFileString", core.readFileString),
    sink: interceptLazy("sink", core.sink),
    stream: interceptLazy("stream", core.stream),
    writeFileString: intercept("writeFileString", core.writeFileString),
  };
};

/**
 * An in-memory implementation of core Effect's `FileSystem` service: an
 * isolated virtual POSIX volume — files, directories, symlinks, hard links,
 * open descriptors, temporary resources, globbing, watching — behind the
 * standard `FileSystem.FileSystem` key.
 *
 * **Details**
 *
 * The founding contract is **honest absence**: reading, statting, or opening
 * (without a create flag) a path nothing seeded fails typed with a `NotFound`
 * `SystemError` — the volume never fabricates content for a path nothing
 * arranged.
 *
 * Each built filesystem is one isolated volume, and layer memoization is
 * **per-build**: every `Effect.provide` of a layer value — even the same bound
 * `const` — builds and re-seeds a fresh volume. Sharing one volume across
 * several effects therefore requires one provide over one composed layer graph
 * (compose with `Layer.provideMerge`, or a suite-boundary `layer(...)` block);
 * within that one build, every consumer of the layer value sees the same
 * volume, and `Layer.fresh` is how a consumer *inside* the same graph opts back
 * out into its own volume. Across separate builds `Layer.fresh` has no role —
 * separate provides already build separate volumes, so there is nothing to
 * isolate.
 *
 * Relative paths resolve from the virtual root `/`: the `FileSystem` contract
 * has no working-directory operation. Malformed input fails through the typed
 * `PlatformError` channel, never as a defect; pathological directory or
 * brace-nesting depth fails typed at the engine's nesting bound.
 *
 * **Gotchas**
 *
 * Permission modes are metadata, never enforced. Modes set by seeding,
 * `chmod`, `makeDirectory` or `writeFile` are recorded faithfully and readable
 * via `stat`, but no operation checks them: the volume models no process
 * identity (no uid/gid/umask), so no read, write, traversal or removal ever
 * fails `PermissionDenied` on its own. Likewise `access` checks existence
 * only, deliberately ignoring its `readable`/`writable`/`ok` options. To
 * exercise a permission-failure code path, inject the failure with
 * {@link MemoryFileSystem.layerFaulty} instead.
 *
 * **Example** (Read a seeded fixture)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
 * import { Effect, FileSystem } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   return yield* fs.readFileString("/repo/package.json")
 * })
 *
 * const SeededFs = MemoryFileSystem.layerWith({
 *   "/repo/package.json": `{ "name": "fixture" }`,
 *   "/repo/tools/build.sh": MemoryFileSystem.file("#!/bin/sh\n", { mode: 0o755 }),
 *   "/repo/.cache": MemoryFileSystem.directory(),
 *   "/repo/latest": MemoryFileSystem.symlink("/repo/package.json"),
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(SeededFs))).then(console.log)
 * // { "name": "fixture" }
 * ```
 *
 * @public
 * @category adapters
 * @since 0.0.0
 */
export class MemoryFileSystem {
  /**
   * Builds a `FileSystem` service backed by a fresh, empty in-memory volume.
   */
  static readonly make: Effect.Effect<FileSystem.FileSystem> = internal.make;

  /**
   * Builds a `FileSystem` service backed by a fresh volume pre-populated from
   * `seed`.
   *
   * **Details**
   *
   * Fails typed when the seed contradicts itself — for example a file seeded
   * at a path another entry needs as a directory, or a tagged entry carrying
   * an invalid mode. Everything absent from the seed stays absent: reads of
   * unseeded paths fail `NotFound`.
   *
   * @param seed - Absolute POSIX paths mapped to seed entries.
   */
  static readonly makeWith = (
    seed: MemoryFileSystemSeed
  ): Effect.Effect<FileSystem.FileSystem, PlatformError.PlatformError> =>
    Effect.gen(function* () {
      const fs = yield* internal.make;
      yield* seedVolume(fs, seed);
      return fs;
    });

  /**
   * Wraps an existing `FileSystem` so that registered faults can intercept
   * calls, delegating everything else — and every declined call — to the
   * wrapped filesystem.
   *
   * **Details**
   *
   * The pure core of {@link MemoryFileSystem.layerFaulty} — most tests want
   * that layer form (or {@link MemoryFileSystem.layerFaultyWith}) and its
   * `Layer.provide` composition; see there for the interception semantics.
   * Reach for `makeFaulty` directly when composing a filesystem *value* by
   * hand (e.g. over {@link MemoryFileSystem.makeWith}). Each call arms its
   * own transient-fault counters.
   *
   * @param base - The filesystem to wrap; any implementation works.
   * @param faults - The fault registration map.
   */
  static readonly makeFaulty = (base: FileSystem.FileSystem, faults: MemoryFileSystemFaults): FileSystem.FileSystem =>
    wrapFaulty(base, faults);

  /**
   * A layer that wraps whatever `FileSystem` is provided to it with fault
   * interception: only methods registered in `faults` are intercepted, and a
   * handler that declines (returns `undefined`) delegates to the wrapped
   * filesystem — delegate-by-default, the opposite of `layerNoop`'s
   * deny-by-default.
   *
   * **Details**
   *
   * Note the naming points the opposite way from the `R` types: `layerFaulty`
   * wraps a base and so leaves `FileSystem` in `R`, while
   * {@link MemoryFileSystem.layerFaultyWith} is self-contained (`R = never`)
   * — for the no-seed case, reach for `layerFaultyWith({}, faults)`, not
   * this.
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
   * **Example** (Fail chmod while other methods delegate)
   *
   * ```ts
   * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
   * import { Effect, FileSystem, Layer, PlatformError } from "effect"
   *
   * const Volume = MemoryFileSystem.layerWith({ "/repo/src/a.ts": "export {}\n" })
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
   * }).pipe(Layer.provide(Volume))
   *
   * const program = Effect.gen(function* () {
   *   const fs = yield* FileSystem.FileSystem
   *   const unlocked = yield* Effect.result(fs.chmod("/repo/src/a.ts", 0o755))
   *   const locked = yield* Effect.result(fs.chmod("/repo/src/a.ts", 0o444))
   *   const contents = yield* fs.readFileString("/repo/src/a.ts")
   *   return { unlocked: unlocked._tag, locked: locked._tag, contents }
   * })
   *
   * Effect.runPromise(program.pipe(Effect.provide(Faulty))).then(console.log)
   * // { unlocked: "Success", locked: "Failure", contents: "export {}\n" }
   * ```
   *
   * @param faults - The fault registration map.
   */
  static readonly layerFaulty = (
    faults: MemoryFileSystemFaults
  ): Layer.Layer<FileSystem.FileSystem, never, FileSystem.FileSystem> =>
    Layer.effect(
      FileSystem.FileSystem,
      Effect.gen(function* () {
        const base = yield* FileSystem.FileSystem;
        return wrapFaulty(base, faults);
      })
    );

  /**
   * The seeded convenience form of {@link MemoryFileSystem.layerFaulty}: a
   * self-contained layer wrapping a fresh volume seeded from `seed`.
   *
   * **Details**
   *
   * Equivalent to `layerFaulty(faults)` provided with `layerWith(seed)`. All
   * of {@link MemoryFileSystem.layerFaulty}'s interception semantics and
   * {@link MemoryFileSystem.layerWith}'s seeding and memoization semantics
   * apply.
   *
   * @param seed - Absolute POSIX paths mapped to seed entries.
   * @param faults - The fault registration map.
   */
  static readonly layerFaultyWith = (
    seed: MemoryFileSystemSeed,
    faults: MemoryFileSystemFaults
  ): Layer.Layer<FileSystem.FileSystem> =>
    Layer.provide(MemoryFileSystem.layerFaulty(faults), MemoryFileSystem.layerWith(seed));

  /**
   * A transient fault: fails the first `times` intercepted calls with `error`,
   * then delegates to the wrapped filesystem forever after — the shape a
   * retry-policy test needs.
   *
   * **Details**
   *
   * Usable as any value of the fault registration map. The countdown is
   * **armed per volume build**: each `makeFaulty` call — and each build of a
   * `layerFaulty`/`layerFaultyWith` layer — starts a fresh counter from
   * `times`. Layer memoization is per-build, so consumers within one provided
   * layer graph share one counter, while a separate `Effect.provide` of the
   * same layer value re-arms it.
   *
   * Transient faults slot into the `Effect`-returning methods only — the
   * substitute is a failing `Effect`, which cannot stand in for the
   * `Stream`/`Sink`-returning members (use a handler returning `Stream.fail`
   * there instead).
   *
   * **Gotchas**
   *
   * A suite-boundary `@effect/vitest` `layer(...)` memoizes ONE build for the
   * whole suite, so a transient fault declared there is consumed by whichever
   * test runs first and later tests silently see it exhausted — declare the
   * fault in a `Layer.fresh`-wrapped (or per-test-provided) layer instead.
   *
   * Throws a `RangeError` at construction when `times` is negative or not an
   * integer — misuse is a wiring bug, matching `layerWith`'s posture on
   * contradictory seeds, never runtime input.
   *
   * **Example** (Fail twice, then read the seeded file)
   *
   * ```ts
   * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
   * import { Effect, FileSystem, PlatformError } from "effect"
   *
   * const flaky = MemoryFileSystem.layerFaultyWith(
   *   { "/config.json": "{}" },
   *   {
   *     readFileString: MemoryFileSystem.failTimes(
   *       2,
   *       PlatformError.systemError({
   *         _tag: "Busy",
   *         module: "FileSystem",
   *         method: "readFileString",
   *         pathOrDescriptor: "/config.json",
   *       }),
   *     ),
   *   },
   * )
   *
   * const program = Effect.gen(function* () {
   *   const fs = yield* FileSystem.FileSystem
   *   const first = yield* Effect.result(fs.readFileString("/config.json"))
   *   const second = yield* Effect.result(fs.readFileString("/config.json"))
   *   const third = yield* fs.readFileString("/config.json")
   *   return { first: first._tag, second: second._tag, third }
   * })
   *
   * Effect.runPromise(program.pipe(Effect.provide(flaky))).then(console.log)
   * // { first: "Failure", second: "Failure", third: "{}" }
   * ```
   *
   * @param times - How many calls fail before delegation begins.
   * @param error - The typed failure each of those calls fails with.
   * @throws {@link InvalidTransientFaultCount} when `times` is negative or not an integer.
   */
  static readonly failTimes = (times: number, error: PlatformError.PlatformError): MemoryFileSystemTransientFault => {
    if (!Number.isInteger(times) || times < 0) {
      throw InvalidTransientFaultCount.make({ times });
    }
    return MemoryFileSystemTransientFault.make({ times, error });
  };

  /**
   * A seed entry for a file, optionally carrying its initial permission mode.
   *
   * **Details**
   *
   * `MemoryFileSystem.file(content)` is equivalent to seeding `content`
   * directly; the tagged form exists for the `mode` and `mtime` options.
   * Modes are recorded and readable via `stat`, never enforced (see the class
   * notes).
   *
   * **Gotchas**
   *
   * `mtime` is epoch **milliseconds**. Passing a Unix-seconds number here
   * (or later through `utimes` as a bare number) is silently 1000× off: the
   * factory converts via `new Date(mtime)`, while `utimes` reads a numeric
   * argument as Unix seconds.
   *
   * @param content - File contents; strings are UTF-8 encoded.
   * @param options - `mode`: initial permission bits (default `0o644`).
   * `mtime`: epoch milliseconds (not Unix seconds); omit it and every seeded
   * entry shares the volume clock.
   */
  static readonly file = (
    content: string | Uint8Array,
    options?: { readonly mode?: number | undefined; readonly mtime?: number | undefined }
  ): MemoryFileSystemSeedFile =>
    MemoryFileSystemSeedFile.make({
      content,
      ...O.getSomesStruct({
        mode: O.fromUndefinedOr(options?.mode),
        mtime: O.fromUndefinedOr(options?.mtime),
      }),
    });

  /**
   * A seed entry for a directory — the way a seed expresses an *empty*
   * directory, or one with an initial permission mode.
   *
   * **Details**
   *
   * The mode also applies when the directory already exists at seeding time
   * (for example, created implicitly as an earlier entry's parent). Modes are
   * recorded and readable via `stat`, never enforced (see the class notes).
   *
   * @param options - `mode`: initial permission bits (default `0o755`).
   */
  static readonly directory = (options?: { readonly mode?: number | undefined }): MemoryFileSystemSeedDirectory =>
    MemoryFileSystemSeedDirectory.make({
      ...O.getSomesStruct({ mode: O.fromUndefinedOr(options?.mode) }),
    });

  /**
   * A seed entry for a symbolic link to `target`.
   *
   * **Details**
   *
   * The target is stored verbatim and resolved lazily on traversal, exactly
   * like `fs.symlink` — it may point at a path seeded later, or dangle.
   *
   * @param target - The link target path.
   */
  static readonly symlink = (target: string): MemoryFileSystemSeedSymlink =>
    MemoryFileSystemSeedSymlink.make({ target });

  /**
   * Provides `FileSystem.FileSystem` backed by a fresh, empty volume.
   *
   * **Details**
   *
   * Layer memoization is per-build: consumers within one provided layer graph
   * share one volume; each separate `Effect.provide` builds a new one.
   */
  static readonly layer: Layer.Layer<FileSystem.FileSystem> = internal.layer;

  /**
   * Provides `FileSystem.FileSystem` backed by a fresh volume pre-populated
   * from `seed`.
   *
   * **Details**
   *
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
   * **Gotchas**
   *
   * A contradictory seed is a test-wiring bug and **dies** with the
   * underlying typed error as its cause; use
   * {@link MemoryFileSystem.makeWith} to handle seeding failures in the error
   * channel instead.
   *
   * **Example** (One provide shares a volume; two provides re-seed)
   *
   * ```ts
   * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
   * import { Effect, FileSystem } from "effect"
   *
   * const Volume = MemoryFileSystem.layerWith({ "/a.txt": "seed" })
   *
   * const write = Effect.gen(function* () {
   *   const fs = yield* FileSystem.FileSystem
   *   yield* fs.writeFileString("/a.txt", "written")
   * })
   * const read = Effect.gen(function* () {
   *   const fs = yield* FileSystem.FileSystem
   *   return yield* fs.readFileString("/a.txt")
   * })
   *
   * // ONE provide, one build, one volume — reads back "written".
   * const shared = Effect.provide(Effect.andThen(write, read), Volume)
   *
   * // TWO provides are two builds: the second is re-seeded — reads back "seed".
   * const reseeded = Effect.andThen(Effect.provide(write, Volume), Effect.provide(read, Volume))
   *
   * Effect.runPromise(Effect.all({ shared, reseeded })).then(console.log)
   * // { shared: "written", reseeded: "seed" }
   * ```
   *
   * @param seed - Absolute POSIX paths mapped to seed entries.
   */
  static readonly layerWith = (seed: MemoryFileSystemSeed): Layer.Layer<FileSystem.FileSystem> =>
    Layer.effect(FileSystem.FileSystem, Effect.orDie(MemoryFileSystem.makeWith(seed)));

  /**
   * The context key for {@link MemoryFileSystemVolume}, mirroring the shape
   * of `FileSystem.FileSystem` itself (the interface is both identifier and
   * shape).
   *
   * **Details**
   *
   * Published only by the opt-in {@link MemoryFileSystem.layerInspectable}
   * and {@link MemoryFileSystem.layerInspectableWith} — no other constructor
   * provides it, and none of them changed shape to carry it. Resolve it in a
   * test with `yield* MemoryFileSystem.Volume`.
   */
  static readonly Volume: Context.Service<MemoryFileSystemVolume, MemoryFileSystemVolume> =
    Context.Service($I`MemoryFileSystemVolume`);

  /**
   * Adapts a {@link MemoryFileSystemVolume} to the synchronous `node:fs`
   * subset — `exists`, `readFile`, `readDirectory`, `isDirectory` — for code
   * that takes a consumer-supplied sync filesystem port rather than requiring
   * `FileSystem` from the environment.
   *
   * **Details**
   *
   * A pure adapter over the inspection view: no service, no layer, no
   * `Effect`. Get a volume from
   * {@link MemoryFileSystem.makeInspectableWith} (or resolve
   * {@link MemoryFileSystem.Volume}) and pass the result wherever the port is
   * expected. The shape is structural, so `@effected/workspaces`'s
   * `SyncFileSystem` — and anything else asking for the same four operations —
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
   * **Gotchas**
   *
   * Link cycles and paths that take more than 40 hops are reported as absence
   * (`exists` is `false`; `readFile`/`readDirectory` throw `ENOENT`), not
   * `ELOOP`. Use {@link MemoryFileSystemVolume} when the test must observe the
   * link itself rather than the resolved target.
   *
   * **Example** (List a seeded directory through the sync port)
   *
   * ```ts
   * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
   * import { Effect } from "effect"
   *
   * Effect.runPromise(
   *   Effect.gen(function* () {
   *     const { volume } = yield* MemoryFileSystem.makeInspectableWith({
   *       "/repo/package.json": `{ "name": "root" }`,
   *       "/repo/packages": MemoryFileSystem.directory(),
   *     })
   *     const sync = MemoryFileSystem.syncFileSystem(volume)
   *     return sync.readDirectory("/repo")
   *   }),
   * ).then(console.log)
   * // ["package.json", "packages"]
   * ```
   */
  static readonly syncFileSystem = (volume: MemoryFileSystemVolume): MemoryFileSystemSyncFileSystem =>
    makeSyncFileSystem(volume);

  /**
   * Builds a fresh, empty volume exposed twice: as the `FileSystem` service
   * and as the {@link MemoryFileSystemVolume} inspecting it.
   *
   * **Details**
   *
   * The two halves of the pair observe the SAME volume — a write through
   * `fileSystem` is immediately visible to `volume`. The value-level
   * primitive beneath {@link MemoryFileSystem.layerInspectable}, for tests
   * composing a filesystem by hand.
   *
   * Reach for the make forms when assertions run AFTER the effect: the layer
   * forms build (and re-seed) a fresh pair per provide, so a post-run
   * assertion would read a different volume than the code under test wrote
   * to. Build the pair once, wrap the filesystem in
   * `Layer.succeed(FileSystem.FileSystem, pair.fileSystem)` (optionally
   * decorated by {@link MemoryFileSystem.makeFaulty} first), and let the
   * assertion read `pair.volume` — the identity is pinned. The layer forms
   * are for tests that resolve `Volume` and assert INSIDE the provided
   * effect.
   */
  static readonly makeInspectable: Effect.Effect<MemoryFileSystemInspectable> = Effect.map(
    internal.makeInspectable,
    ({ entries, fileSystem }): MemoryFileSystemInspectable => ({
      fileSystem,
      volume: makeVolumeService(entries),
    })
  );

  /**
   * Builds a volume pre-populated from `seed`, exposed as the
   * {@link MemoryFileSystemInspectable} pair.
   *
   * **Details**
   *
   * Seeding runs through the pair's own `fileSystem`, so the volume half
   * reads seeded entries back exactly as written. Fails typed when the seed
   * contradicts itself, mirroring {@link MemoryFileSystem.makeWith}.
   *
   * @param seed - Absolute POSIX paths mapped to seed entries.
   */
  static readonly makeInspectableWith = (
    seed: MemoryFileSystemSeed
  ): Effect.Effect<MemoryFileSystemInspectable, PlatformError.PlatformError> =>
    Effect.gen(function* () {
      const pair = yield* MemoryFileSystem.makeInspectable;
      yield* seedVolume(pair.fileSystem, seed);
      return pair;
    });

  /**
   * Provides `FileSystem.FileSystem` AND {@link MemoryFileSystem.Volume},
   * both backed by one fresh, empty volume per build.
   *
   * **Details**
   *
   * The opt-in inspection form of {@link MemoryFileSystem.layer} — the
   * existing constructors are unchanged and never carry the extra service.
   * Within one build the resolved `Volume` inspects the same volume instance
   * backing the `FileSystem`; per-build semantics hold as everywhere else
   * (two provides are two volumes, each pair internally consistent).
   */
  static readonly layerInspectable: Layer.Layer<FileSystem.FileSystem | MemoryFileSystemVolume> = Layer.effectContext(
    Effect.map(MemoryFileSystem.makeInspectable, inspectableContext)
  );

  /**
   * Provides `FileSystem.FileSystem` AND {@link MemoryFileSystem.Volume},
   * both backed by one volume per build, pre-populated from `seed`.
   *
   * **Details**
   *
   * The opt-in inspection form of {@link MemoryFileSystem.layerWith}, with
   * the same discipline: a parameterized factory (bind to a `const`),
   * per-build memoization (each provide re-seeds), and a contradictory seed
   * **dies** as a wiring bug — use
   * {@link MemoryFileSystem.makeInspectableWith} for the error channel. To
   * inspect a volume UNDER fault injection, compose with `Layer.provideMerge`
   * so the decorated `FileSystem` wins while `Volume` survives:
   * `MemoryFileSystem.layerFaulty(faults).pipe(Layer.provideMerge(Inspectable))`.
   *
   * @param seed - Absolute POSIX paths mapped to seed entries.
   */
  static readonly layerInspectableWith = (
    seed: MemoryFileSystemSeed
  ): Layer.Layer<FileSystem.FileSystem | MemoryFileSystemVolume> =>
    Layer.effectContext(Effect.orDie(Effect.map(MemoryFileSystem.makeInspectableWith(seed), inspectableContext)));

  private constructor() {}
}
