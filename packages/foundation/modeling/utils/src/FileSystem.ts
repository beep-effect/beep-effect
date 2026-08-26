/**
 * A module containing utilities for interacting with the file system.
 *
 * Alongside the async, layer-bound `makeWaitForFile` helper (built on
 * `effect/FileSystem`), this module provides synchronous, layer-free `Effect`
 * wrappers over Node's `node:fs` sync API. The wrappers mirror effect's
 * `FileSystem` design — failures travel on the typed `PlatformError` channel
 * and `statSync` returns effect's `FileSystem.File.Info` — but execute
 * synchronously, so callers can run them with `Effect.runSync` without
 * providing a `FileSystem` layer. This is the sanctioned home for `node:fs`
 * access; path helpers live in the sibling `Path` module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UtilsId } from "@beep/identity/packages";
import { Effect, FileSystem, Option, Path, PlatformError, pipe, Stream } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $UtilsId.create("FileSystem");

class NodeFileSystemUnavailableError extends S.TaggedError<NodeFileSystemUnavailableError>(
  $I`NodeFileSystemUnavailableError`
)(
  "NodeFileSystemUnavailableError",
  {
    module: S.Literal("node:fs"),
  },
  $I.annoteError<NodeFileSystemUnavailableError>("NodeFileSystemUnavailableError", {
    description: "Thrown when node:fs is unavailable to sync file system helpers.",
  })
) {}

/**
 * Synchronous `node:fs` handle, resolved lazily via `process.getBuiltinModule`
 * on first call (never via a static Node import) so browser bundles can import
 * this module — and the `@beep/utils` barrel — without evaluating Node
 * builtins. Only invoking a sync wrapper requires a Node-compatible runtime.
 */
let nfsHandle: typeof import("node:fs") | undefined;
const NFS = (): typeof import("node:fs") => {
  if (nfsHandle === undefined) {
    nfsHandle = globalThis.process?.getBuiltinModule?.("node:fs");
    if (nfsHandle === undefined) {
      throw NodeFileSystemUnavailableError.make({ module: "node:fs" });
    }
  }
  return nfsHandle;
};

type NodeStats = import("node:fs").Stats;
type NodeDirent = import("node:fs").Dirent;

const AppendFileSyncEncoding = S.Literals([
  "ascii",
  "utf8",
  "utf-8",
  "utf16le",
  "utf-16le",
  "ucs2",
  "ucs-2",
  "base64",
  "base64url",
  "latin1",
  "binary",
  "hex",
]);

/**
 * Options for {@link appendFileSync}, mirroring Node's `fs.appendFileSync`
 * options object.
 *
 * **Example** (Make append options)
 *
 * ```ts import.meta.vitest name="Make append options"
 * import { AppendFileSyncOptions } from "@beep/utils/FileSystem"
 *
 * const options = AppendFileSyncOptions.make({ encoding: "utf8", flag: "a" })
 * console.log(options.flag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppendFileSyncOptions extends S.Class<AppendFileSyncOptions>($I`AppendFileSyncOptions`)(
  {
    encoding: S.optionalKey(AppendFileSyncEncoding).annotateKey({
      description: "Text encoding forwarded to node:fs appendFileSync.",
    }),
    flag: S.optionalKey(S.String).annotateKey({
      description: "File-system flag forwarded to node:fs appendFileSync.",
    }),
    mode: S.optionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0))).annotateKey({
      description: "Non-negative integer file mode forwarded to node:fs appendFileSync.",
    }),
  },
  $I.annote("AppendFileSyncOptions", {
    description: "Options accepted by appendFileSync.",
  })
) {}

/**
 * Options for {@link rmSync}, mirroring the `recursive`/`force` flags of Node's
 * `fs.rmSync`.
 *
 * **Example** (Make recursive force options)
 *
 * ```ts import.meta.vitest name="Make recursive force options"
 * import { RmSyncOptions } from "@beep/utils/FileSystem"
 *
 * const options = RmSyncOptions.make({ recursive: true, force: true })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RmSyncOptions extends S.Class<RmSyncOptions>($I`RmSyncOptions`)(
  {
    force: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether missing paths should be ignored by node:fs rmSync.",
    }),
    recursive: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether directories should be removed recursively by node:fs rmSync.",
    }),
  },
  $I.annote("RmSyncOptions", {
    description: "Options accepted by rmSync.",
  })
) {}

/**
 * Options for {@link readdirSync}. When `withFileTypes` is `true`, the effect
 * resolves with `node:fs` `Dirent` entries instead of plain name strings.
 *
 * **Example** (Make withFileTypes options)
 *
 * ```ts import.meta.vitest name="Make withFileTypes options"
 * import { ReaddirSyncOptions } from "@beep/utils/FileSystem"
 *
 * const options = ReaddirSyncOptions.make({ withFileTypes: true })
 * console.log(options.withFileTypes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReaddirSyncOptions extends S.Class<ReaddirSyncOptions>($I`ReaddirSyncOptions`)(
  {
    withFileTypes: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether readdirSync should return node:fs Dirent entries instead of names.",
    }),
  },
  $I.annote("ReaddirSyncOptions", {
    description: "Options accepted by readdirSync.",
  })
) {}

/**
 * Maps Node errno codes to effect's normalized `SystemErrorTag`, mirroring the
 * `handleErrnoException` table in `@effect/platform-node-shared`.
 */
const errnoToTag: Record<string, PlatformError.SystemErrorTag> = {
  ENOENT: "NotFound",
  EACCES: "PermissionDenied",
  EEXIST: "AlreadyExists",
  EISDIR: "BadResource",
  ENOTDIR: "BadResource",
  ELOOP: "BadResource",
  EBUSY: "Busy",
};

/**
 * Builds the `Effect.try` `catch` handler that translates a thrown
 * `NodeJS.ErrnoException` into effect's wrapped `PlatformError`. The reason tag
 * is read from `err.code` (defaulting to `"Unknown"`) and the failing
 * `module`/`method`/`pathOrDescriptor`/`syscall` are preserved, mirroring
 * effect's own `handleErrnoException`.
 */
const toPlatformError =
  (method: string, pathOrDescriptor: string | number) =>
  (cause: unknown): PlatformError.PlatformError => {
    const err = cause as NodeJS.ErrnoException;
    const _tag: PlatformError.SystemErrorTag =
      (err?.code !== undefined ? errnoToTag[err.code] : undefined) ?? "Unknown";
    return PlatformError.systemError({
      _tag,
      module: "FileSystem",
      method,
      pathOrDescriptor,
      syscall: err?.syscall,
      cause: err,
    });
  };

/**
 * Ordered predicate table resolving a `node:fs` `Stats` into effect's
 * `File.Type`. Evaluated top-to-bottom; the first matching predicate wins.
 */
const fileTypeTable: ReadonlyArray<readonly [(stats: NodeStats) => boolean, FileSystem.File.Type]> = [
  [(stats) => stats.isFile(), "File"],
  [(stats) => stats.isDirectory(), "Directory"],
  [(stats) => stats.isSymbolicLink(), "SymbolicLink"],
  [(stats) => stats.isBlockDevice(), "BlockDevice"],
  [(stats) => stats.isCharacterDevice(), "CharacterDevice"],
  [(stats) => stats.isFIFO(), "FIFO"],
  [(stats) => stats.isSocket(), "Socket"],
];

const toFileType = (stats: NodeStats): FileSystem.File.Type =>
  pipe(
    A.findFirst(fileTypeTable, ([predicate]) => predicate(stats)),
    Option.map(([, type]) => type),
    Option.getOrElse((): FileSystem.File.Type => "Unknown")
  );

/**
 * Port of `@effect/platform-node-shared`'s `makeFileInfo`: maps a `node:fs`
 * `Stats` into effect's `FileSystem.File.Info`, wrapping nullable timestamps
 * and ids in `Option` and the size in effect's branded `Size`.
 */
const toFileInfo = (stats: NodeStats): FileSystem.File.Info => ({
  type: toFileType(stats),
  mtime: Option.fromNullishOr(stats.mtime),
  atime: Option.fromNullishOr(stats.atime),
  birthtime: Option.fromNullishOr(stats.birthtime),
  dev: stats.dev,
  rdev: Option.fromNullishOr(stats.rdev),
  ino: Option.fromNullishOr(stats.ino),
  mode: stats.mode,
  nlink: Option.fromNullishOr(stats.nlink),
  uid: Option.fromNullishOr(stats.uid),
  gid: Option.fromNullishOr(stats.gid),
  size: FileSystem.Size(stats.size),
  blksize: pipe(Option.fromUndefinedOr(stats.blksize), Option.map(FileSystem.Size)),
  blocks: Option.fromNullishOr(stats.blocks),
});

/**
 * Appends `data` to the file at `path`, creating it if it does not exist.
 *
 * **Details**
 *
 * Synchronous, layer-free wrapper over `node:fs` `appendFileSync`. Run it with
 * `Effect.runSync` at a boundary. Failures surface on the wrapped
 * `PlatformError` channel; narrow them via `error.reason._tag`.
 *
 * **Example** (Append log entry)
 *
 * ```ts import.meta.vitest name="Append log entry"
 * import { appendFileSync } from "@beep/utils/FileSystem"
 *
 * // Build the effect; run it with `Effect.runSync` at a boundary.
 * const program = appendFileSync("/tmp/beep.log", "entry\n", { flag: "a" })
 * console.log(program)
 * ```
 *
 * @effects Appends bytes to the target file synchronously when the returned
 * effect is run.
 * @category combinators
 * @since 0.0.0
 */
export const appendFileSync: {
  (
    data: string | Uint8Array,
    options?: AppendFileSyncOptions
  ): (path: string) => Effect.Effect<void, PlatformError.PlatformError>;
  (
    path: string,
    data: string | Uint8Array,
    options?: AppendFileSyncOptions
  ): Effect.Effect<void, PlatformError.PlatformError>;
} = dual(
  (args) => args.length === 3 || (args.length === 2 && (P.isString(args[1]) || args[1] instanceof Uint8Array)),
  (
    path: string,
    data: string | Uint8Array,
    options?: AppendFileSyncOptions
  ): Effect.Effect<void, PlatformError.PlatformError> =>
    Effect.try({
      try: () => NFS().appendFileSync(path, data, options),
      catch: toPlatformError("appendFileSync", path),
    })
);

/**
 * Reports whether a path exists.
 *
 * **Details**
 *
 * Synchronous, layer-free wrapper over `node:fs` `existsSync`. Because
 * `fs.existsSync` swallows every error and returns `false` instead of throwing,
 * this effect has no failure channel.
 *
 * **Example** (Check path exists)
 *
 * ```ts import.meta.vitest name="Check path exists"
 * import { Effect } from "effect"
 * import { existsSync } from "@beep/utils/FileSystem"
 *
 * const exists = Effect.runSync(existsSync("."))
 * console.log(exists)
 * ```
 *
 * @effects Performs a synchronous existence check when the returned effect is run.
 * @category getters
 * @since 0.0.0
 */
export const existsSync = (path: string): Effect.Effect<boolean> => Effect.sync(() => NFS().existsSync(path));

/**
 * Removes the file or directory at `path`, honoring `recursive`/`force`.
 *
 * **Details**
 *
 * Synchronous, layer-free wrapper over `node:fs` `rmSync`. Run it with
 * `Effect.runSync` at a boundary. Failures surface on the wrapped
 * `PlatformError` channel.
 *
 * **Example** (Remove directory recursively)
 *
 * ```ts import.meta.vitest name="Remove directory recursively"
 * import { rmSync } from "@beep/utils/FileSystem"
 *
 * const program = rmSync("/tmp/beep-scratch", { recursive: true, force: true })
 * console.log(program)
 * ```
 *
 * @effects Deletes the target path synchronously when the returned effect is run.
 * @category combinators
 * @since 0.0.0
 */
export const rmSync: {
  (options?: RmSyncOptions): (path: string) => Effect.Effect<void, PlatformError.PlatformError>;
  (path: string, options?: RmSyncOptions): Effect.Effect<void, PlatformError.PlatformError>;
} = dual(
  (args) => P.isString(args[0]),
  (path: string, options?: RmSyncOptions): Effect.Effect<void, PlatformError.PlatformError> =>
    Effect.try({
      try: () => NFS().rmSync(path, options),
      catch: toPlatformError("rmSync", path),
    })
);

/**
 * Renames (moves) a path from `oldPath` to `newPath`.
 *
 * **Details**
 *
 * Synchronous, layer-free wrapper over `node:fs` `renameSync`. Run it with
 * `Effect.runSync` at a boundary. Failures surface on the wrapped
 * `PlatformError` channel.
 *
 * **Example** (Rename temporary file)
 *
 * ```ts import.meta.vitest name="Rename temporary file"
 * import { renameSync } from "@beep/utils/FileSystem"
 *
 * const program = renameSync("/tmp/beep-old.txt", "/tmp/beep-new.txt")
 * console.log(program)
 * ```
 *
 * @effects Renames the target path synchronously when the returned effect is run.
 * @category combinators
 * @since 0.0.0
 */
export const renameSync: {
  (newPath: string): (oldPath: string) => Effect.Effect<void, PlatformError.PlatformError>;
  (oldPath: string, newPath: string): Effect.Effect<void, PlatformError.PlatformError>;
} = dual(
  2,
  (oldPath: string, newPath: string): Effect.Effect<void, PlatformError.PlatformError> =>
    Effect.try({
      try: () => NFS().renameSync(oldPath, newPath),
      catch: toPlatformError("renameSync", oldPath),
    })
);

function readdirSyncImpl(path: string): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError>;
function readdirSyncImpl(
  path: string,
  options: { readonly withFileTypes: true }
): Effect.Effect<ReadonlyArray<NodeDirent>, PlatformError.PlatformError>;
function readdirSyncImpl(
  path: string,
  options?: ReaddirSyncOptions
): Effect.Effect<ReadonlyArray<string | NodeDirent>, PlatformError.PlatformError> {
  return Effect.try({
    try: (): ReadonlyArray<string | NodeDirent> =>
      options?.withFileTypes === true ? NFS().readdirSync(path, { withFileTypes: true }) : NFS().readdirSync(path),
    catch: toPlatformError("readdirSync", path),
  });
}

type ReaddirSyncDataLast = (options: {
  readonly withFileTypes: true;
}) => (path: string) => Effect.Effect<ReadonlyArray<NodeDirent>, PlatformError.PlatformError>;

type ReaddirSyncDataFirst = {
  (path: string): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError>;
  (
    path: string,
    options: { readonly withFileTypes: true }
  ): Effect.Effect<ReadonlyArray<NodeDirent>, PlatformError.PlatformError>;
};

/**
 * Lists the entries of a directory.
 *
 * **Details**
 *
 * Synchronous, layer-free wrapper over `node:fs` `readdirSync`. By default the
 * effect resolves with entry name strings; pass `{ withFileTypes: true }` to
 * resolve with `node:fs` `Dirent` entries (whose `isDirectory()`/
 * `isSymbolicLink()` predicates support directory walking). Run it with
 * `Effect.runSync` at a boundary; failures surface on the wrapped
 * `PlatformError` channel.
 *
 * **Example** (List directory names)
 *
 * ```ts import.meta.vitest name="List directory names"
 * import { Effect } from "effect"
 * import { readdirSync } from "@beep/utils/FileSystem"
 *
 * const names = Effect.runSync(readdirSync("."))
 * console.log(names.length >= 0)
 * ```
 *
 * @effects Reads the directory synchronously when the returned effect is run.
 * @category getters
 * @since 0.0.0
 */
export const readdirSync: ReaddirSyncDataLast & ReaddirSyncDataFirst = dual<ReaddirSyncDataLast, ReaddirSyncDataFirst>(
  (args) => P.isString(args[0]),
  readdirSyncImpl
);

/**
 * Returns effect's `FileSystem.File.Info` for a path.
 *
 * **Details**
 *
 * Synchronous, layer-free wrapper over `node:fs` `statSync`, mapping the
 * resulting `Stats` into effect's `File.Info` (so `info.type === "Directory"`
 * replaces the raw `stats.isDirectory()` check, timestamps are `Option<Date>`,
 * and `info.size` is a `bigint`). Run it with `Effect.runSync` at a boundary;
 * failures surface on the wrapped `PlatformError` channel.
 *
 * **Example** (Read path file info)
 *
 * ```ts import.meta.vitest name="Read path file info"
 * import { Effect } from "effect"
 * import { statSync } from "@beep/utils/FileSystem"
 *
 * const info = Effect.runSync(statSync("."))
 * console.log(info.type)
 * ```
 *
 * @effects Reads file metadata synchronously when the returned effect is run.
 * @category getters
 * @since 0.0.0
 */
export const statSync = (path: string): Effect.Effect<FileSystem.File.Info, PlatformError.PlatformError> =>
  Effect.try({
    try: () => toFileInfo(NFS().statSync(path)),
    catch: toPlatformError("statSync", path),
  });

/**
 * Creates a dual API helper that waits for the first file-system watch event
 * in `directory` whose basename matches `name`.
 *
 * **Details**
 *
 * The returned function subscribes to `FileSystem.watch(directory)`, filters
 * events by exact file name, and resolves with the first matching
 * `WatchEvent`. If the watch stream ends before a match is observed, the
 * effect succeeds with `Option.none()`.
 *
 * Supports both call styles:
 * - Data-first: `waitForFile("/tmp", "done.txt")`
 * - Data-last: `pipe("/tmp", waitForFile("done.txt"))`
 *
 * **Example** (Wait for ready file)
 *
 * ```ts import.meta.vitest name="Wait for ready file"
 * import { Effect } from "effect"
 * import { makeWaitForFile } from "@beep/utils/FileSystem"
 *
 * const program = Effect.gen(function* () {
 *   const waitForFile = yield* makeWaitForFile
 *   return yield* waitForFile("/tmp", "ready.txt")
 * })
 *
 * console.log(program)
 * ```
 *
 * @effects Requires FileSystem and Path services, subscribes to a file-system
 * watch stream, and resolves when the requested basename is observed.
 * @category utilities
 * @since 0.0.0
 */
export const makeWaitForFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const waitForFile = (directory: string, name: string) =>
    pipe(
      fs.watch(directory),
      Stream.filter((e) => path.basename(e.path) === name),
      Stream.runHead
    );

  const fn: {
    (directory: string, name: string): ReturnType<typeof waitForFile>;
    (name: string): (directory: string) => ReturnType<typeof waitForFile>;
  } = dual(2, waitForFile);

  return fn;
});
