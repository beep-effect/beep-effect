/**
 * Inode-bound directory handles for destructive removals that must never follow
 * a path component swapped out from under them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { OpaqueDefect } from "../schema/OpaqueDefect.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as Scope from "effect/Scope";

const $I = $RepoCliId.create("internal/repo-run/DirectoryHandle");

// node:fs is reached through the runtime's builtin registry instead of a static
// import: the FileSystem service cannot express O_DIRECTORY | O_NOFOLLOW or a
// non-recursive rmdir, and the static-import gate maps node:fs onto that service.
type NodeFs = typeof import("node:fs");
type NodeStats = import("node:fs").Stats;
const nodeFs = (): NodeFs => process.getBuiltinModule("node:fs");

const directoryOpenFlags = (fs: NodeFs): number =>
  fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW;

const heldPath = (fd: number): string => `/proc/self/fd/${fd}`;
const heldEntry = (fd: number, name: string): string => `${heldPath(fd)}/${name}`;

/**
 * The descriptor-level operation a {@link DirectoryHandleError} failed in.
 *
 * **Example** (Recognize an operation)
 *
 * ```ts
 * import { DirectoryHandleOperation } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(DirectoryHandleOperation.is.rmdir("rmdir")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DirectoryHandleOperation = LiteralKit([
  "open",
  "stat",
  "list",
  "unlink",
  "rmdir",
  "close",
  "rename",
  "sync",
]).pipe(
  $I.annoteSchema("DirectoryHandleOperation", {
    description: "Descriptor-level directory operation including rename and mandatory parent sync.",
  })
);

/**
 * Operation family recognized by {@link DirectoryHandleError}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DirectoryHandleOperation = typeof DirectoryHandleOperation.Type;

/**
 * Failure of one descriptor-bound directory operation.
 *
 * **Example** (Construct a failure)
 *
 * ```ts
 * import { DirectoryHandleError } from "@beep/repo-cli/test/RepoRun"
 *
 * const error = DirectoryHandleError.make({
 *   message: "rmdir failed for /work/stale",
 *   operation: "rmdir",
 *   path: "/work/stale",
 *   cause: "ENOTEMPTY",
 * })
 * console.log(error.operation) // "rmdir"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DirectoryHandleError extends S.TaggedError<DirectoryHandleError>($I`DirectoryHandleError`)(
  "DirectoryHandleError",
  {
    message: S.String,
    operation: DirectoryHandleOperation,
    path: S.String,
    cause: OpaqueDefect,
  },
  $I.annoteError<DirectoryHandleError>("DirectoryHandleError", {
    description: "A descriptor-bound directory operation failed.",
  })
) {}

const attempt = <A>(
  operation: DirectoryHandleOperation,
  path: string,
  thunk: () => A
): Effect.Effect<A, DirectoryHandleError> =>
  Effect.try({
    try: thunk,
    catch: (cause) => DirectoryHandleError.make({ message: `${operation} failed for ${path}`, operation, path, cause }),
  });

const closeQuietly = (fd: number): Effect.Effect<void> =>
  Effect.ignore(attempt("close", heldPath(fd), () => nodeFs().closeSync(fd)));

/**
 * Device and inode numbers naming one directory independently of every path
 * that reaches it.
 *
 * **Example** (Compare two identities)
 *
 * ```ts
 * import { DirectoryIdentity, sameDirectoryIdentity } from "@beep/repo-cli/test/RepoRun"
 *
 * const left = DirectoryIdentity.make({ dev: 64769, ino: 1234 })
 * const right = DirectoryIdentity.make({ dev: 64769, ino: 5678 })
 * console.log(sameDirectoryIdentity(left, right)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DirectoryIdentity extends S.Class<DirectoryIdentity>($I`DirectoryIdentity`)(
  {
    dev: S.Int,
    ino: S.Int,
  },
  $I.annote("DirectoryIdentity", {
    description: "Device and inode numbers naming one directory independently of every path that reaches it.",
  })
) {}

/**
 * Whether two identities name the same directory.
 *
 * **Example** (Recognize the same inode)
 *
 * ```ts
 * import { DirectoryIdentity, sameDirectoryIdentity } from "@beep/repo-cli/test/RepoRun"
 *
 * const identity = DirectoryIdentity.make({ dev: 64769, ino: 1234 })
 * console.log(sameDirectoryIdentity(identity, DirectoryIdentity.make({ dev: 64769, ino: 1234 }))) // true
 * ```
 *
 * @param left - One identity.
 * @param right - The identity to compare it with.
 * @returns `true` when both device and inode numbers agree.
 * @category utilities
 * @since 0.0.0
 */
export const sameDirectoryIdentity: {
  (right: DirectoryIdentity): (left: DirectoryIdentity) => boolean;
  (left: DirectoryIdentity, right: DirectoryIdentity): boolean;
} = dual(
  2,
  (left: DirectoryIdentity, right: DirectoryIdentity): boolean =>
    N.Equivalence(left.dev, right.dev) && N.Equivalence(left.ino, right.ino)
);

/**
 * Read the identity of a stat result, absent when the platform reports no inode.
 *
 * **Example** (Identify a directory from its stat)
 *
 * ```ts
 * import { directoryIdentity } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 * import * as O from "effect/Option"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const info = yield* fs.stat("/tmp")
 *   return O.isSome(directoryIdentity(info))
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param info - The stat result to read.
 * @returns The identity, or `None` when the inode is not reported.
 * @category utilities
 * @since 0.0.0
 */
export const directoryIdentity = (info: FileSystem.File.Info): O.Option<DirectoryIdentity> =>
  O.map(info.ino, (ino) => DirectoryIdentity.make({ dev: info.dev, ino }));

/**
 * An open descriptor on a directory together with the identity it was bound to
 * when opened. It is valid only inside the scope that opened it.
 *
 * **Example** (Construct a handle value)
 *
 * ```ts
 * import { DirectoryHandle, DirectoryIdentity } from "@beep/repo-cli/test/RepoRun"
 *
 * const handle = DirectoryHandle.make({ fd: 7, identity: DirectoryIdentity.make({ dev: 64769, ino: 1234 }) })
 * console.log(handle.identity.ino) // 1234
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DirectoryHandle extends S.Class<DirectoryHandle>($I`DirectoryHandle`)(
  {
    fd: S.Int,
    identity: DirectoryIdentity,
  },
  $I.annote("DirectoryHandle", {
    description:
      "An open descriptor on a directory and the identity it was bound to at open time; valid only inside the scope that opened it.",
  })
) {}

const bindDirectory = Effect.fnUntraced(function* (
  path: string
): Effect.fn.Return<DirectoryHandle, DirectoryHandleError, Scope.Scope> {
  const fs = nodeFs();
  const fd = yield* Effect.acquireRelease(
    attempt("open", path, () => fs.openSync(path, directoryOpenFlags(fs))),
    closeQuietly
  );
  const stats = yield* attempt("stat", path, () => fs.fstatSync(fd));
  return DirectoryHandle.make({ fd, identity: DirectoryIdentity.make({ dev: stats.dev, ino: stats.ino }) });
});

/**
 * Open a directory without following a final symlink and bind the handle to the
 * inode actually opened.
 *
 * **Details**
 *
 * The open uses `O_DIRECTORY | O_NOFOLLOW`, so a path that names a file, a
 * symlink, or nothing at all yields `None` instead of a handle on whatever the
 * link pointed at. The descriptor is released when the enclosing scope closes.
 *
 * **Example** (Bind the working directory)
 *
 * ```ts
 * import { openDirectoryHandle } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const scan = Effect.scoped(openDirectoryHandle(process.cwd()))
 * console.log(Effect.isEffect(scan)) // true
 * ```
 *
 * @param path - Directory to open.
 * @returns The bound handle, or `None` when the path is not an openable directory.
 * @category utilities
 * @since 0.0.0
 */
export const openDirectoryHandle = (path: string): Effect.Effect<O.Option<DirectoryHandle>, never, Scope.Scope> =>
  bindDirectory(path).pipe(Effect.option);

const removeHeldEntry: (fd: number, name: string) => Effect.Effect<void, DirectoryHandleError> = Effect.fnUntraced(
  function* (fd: number, name: string) {
    const fs = nodeFs();
    const entry = heldEntry(fd, name);
    // Only a real directory opens: a file fails with ENOTDIR and a link with ELOOP,
    // so neither is ever traversed and both are unlinked in place.
    const child = yield* attempt("open", entry, () => fs.openSync(entry, directoryOpenFlags(fs))).pipe(Effect.option);
    if (O.isNone(child)) {
      return yield* attempt("unlink", entry, () => fs.unlinkSync(entry));
    }
    yield* Effect.acquireUseRelease(Effect.succeed(child.value), emptyHeldDirectory, closeQuietly);
    yield* attempt("rmdir", entry, () => fs.rmdirSync(entry));
  }
);

const emptyHeldDirectory: (fd: number) => Effect.Effect<void, DirectoryHandleError> = Effect.fnUntraced(function* (
  fd: number
) {
  const names = yield* attempt("list", heldPath(fd), () => nodeFs().readdirSync(heldPath(fd)));
  yield* Effect.forEach(names, (name) => removeHeldEntry(fd, name), { discard: true });
});

/**
 * Outcome of a removal bound to an inode.
 *
 * **Example** (Recognize a completed removal)
 *
 * ```ts
 * import { BoundRemovalOutcome } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(BoundRemovalOutcome.is.removed("removed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BoundRemovalOutcome = LiteralKit(["removed", "identity-changed", "removal-failed"]).pipe(
  $I.annoteSchema("BoundRemovalOutcome", {
    description:
      "Result of an inode-bound removal: removed, the assessed inode is no longer at the path, or a step failed.",
  })
);

/**
 * Outcome family of the inode-bound removals.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoundRemovalOutcome = typeof BoundRemovalOutcome.Type;

// The last name-based syscall of a removal: its entry is resolved inside a held
// parent directory, after the entry's shape and identity were checked through that
// same parent.
type BoundFinish = {
  readonly operation: DirectoryHandleOperation;
  readonly accepts: (stats: NodeStats) => boolean;
  readonly finish: (fs: NodeFs, entry: string) => void;
};

const rmdirFinish: BoundFinish = {
  operation: "rmdir",
  accepts: (stats) => stats.isDirectory(),
  finish: (fs, entry) => fs.rmdirSync(entry),
};

const unlinkFinish: BoundFinish = {
  operation: "unlink",
  accepts: (stats) => stats.isFile(),
  finish: (fs, entry) => fs.unlinkSync(entry),
};

const finishBoundEntry = Effect.fnUntraced(function* (
  path: string,
  expected: DirectoryIdentity,
  bound: BoundFinish
): Effect.fn.Return<BoundRemovalOutcome, never, Path.Path | Scope.Scope> {
  const fs = nodeFs();
  const pathService = yield* Path.Path;
  // Bind the parent so the last component is looked up inside a held directory, then
  // compare the entry's shape and identity through that parent immediately before the
  // syscall. Only that one syscall remains between the check and the removal.
  const parent = yield* openDirectoryHandle(pathService.dirname(path));
  if (O.isNone(parent)) {
    return "removal-failed";
  }
  const entry = heldEntry(parent.value.fd, pathService.basename(path));
  const stats = yield* attempt("stat", entry, () => fs.lstatSync(entry)).pipe(Effect.option);
  const bindsExpected = O.exists(
    stats,
    (found) =>
      bound.accepts(found) &&
      sameDirectoryIdentity(expected, DirectoryIdentity.make({ dev: found.dev, ino: found.ino }))
  );
  if (!bindsExpected) {
    return "identity-changed";
  }
  return yield* attempt(bound.operation, entry, () => bound.finish(fs, entry)).pipe(
    Effect.as<BoundRemovalOutcome>("removed"),
    Effect.orElseSucceed((): BoundRemovalOutcome => "removal-failed")
  );
});

/**
 * Remove everything under a bound directory through its descriptor, then the
 * now-empty directory itself through a handle on its parent.
 *
 * **Details**
 *
 * Every entry is reached through `/proc/self/fd/<fd>` and every subdirectory is
 * opened with `O_NOFOLLOW` before it is descended, so a component swapped for a
 * symlink after the handle was bound is unlinked where it stands and never
 * followed. The final `rmdir` is resolved inside a handle on the parent
 * directory and runs only once the entry there is confirmed to be a directory
 * carrying the handle's own identity: a link or another directory put in its
 * place is left alone and reported as `identity-changed`. A directory that
 * gained an entry since it was emptied makes the `rmdir` fail, so a late write
 * surfaces as `removal-failed` instead of disappearing.
 *
 * **Example** (Build a removal effect)
 *
 * ```ts
 * import { DirectoryHandle, DirectoryIdentity, removeThroughDirectoryHandle } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const handle = DirectoryHandle.make({ fd: 7, identity: DirectoryIdentity.make({ dev: 64769, ino: 1234 }) })
 * console.log(Effect.isEffect(Effect.scoped(removeThroughDirectoryHandle(handle, "/work/stale")))) // true
 * ```
 *
 * @param handle - The bound directory to empty.
 * @param path - The path the directory was bound at; its parent is bound for the final `rmdir`.
 * @returns The removal outcome.
 * @category utilities
 * @since 0.0.0
 */
export const removeThroughDirectoryHandle = Effect.fnUntraced(function* (
  handle: DirectoryHandle,
  path: string
): Effect.fn.Return<BoundRemovalOutcome, never, Path.Path | Scope.Scope> {
  const emptied = yield* Effect.result(emptyHeldDirectory(handle.fd));
  if (Result.isFailure(emptied)) {
    return "removal-failed";
  }
  return yield* finishBoundEntry(path, handle.identity, rmdirFinish);
});

/**
 * Unlink a regular file only while it is still the assessed inode.
 *
 * **Details**
 *
 * The parent directory is bound by descriptor, the entry is `lstat`ed through
 * it, and the unlink runs only when that entry is a regular file whose device
 * and inode match `expected`. A replacement file or a link put in its place is
 * left alone and reported as `identity-changed`; `unlink` itself never follows
 * a link.
 *
 * **Example** (Build a bound unlink)
 *
 * ```ts
 * import { DirectoryIdentity, unlinkBoundFile } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.scoped(unlinkBoundFile("/work/stale.jsonl", DirectoryIdentity.make({ dev: 64769, ino: 1234 })))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param path - File to unlink.
 * @param expected - Identity captured when the file was assessed.
 * @returns The removal outcome.
 * @category utilities
 * @since 0.0.0
 */
export const unlinkBoundFile = Effect.fnUntraced(function* (
  path: string,
  expected: DirectoryIdentity
): Effect.fn.Return<BoundRemovalOutcome, never, Path.Path | Scope.Scope> {
  return yield* finishBoundEntry(path, expected, unlinkFinish);
});

/**
 * Fence an assessed inode into a same-filesystem archive and sync both parents.
 *
 * **Details**
 * Both parent directories are held by descriptor. The destination must be absent
 * and on the source device. No recursive deletion occurs. Callers must serialize
 * archive writers and fsync their intent before invoking this operation. A sync
 * failure may follow a successful rename; the journal can reconcile that case
 * using the recorded device and inode.
 *
 * **Example** (Build a recoverable fence)
 *
 * ```ts
 * import { DirectoryIdentity, renameBoundEntry } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 * const move = Effect.scoped(renameBoundEntry("/repo/.beep/old", "/repo/.beep/archive/0",
 *   DirectoryIdentity.make({ dev: 1, ino: 42 })))
 * console.log(Effect.isEffect(move)) // true
 * ```
 *
 * @param source - Assessed source entry.
 * @param destination - Absent archive entry under a serialized run directory.
 * @param expected - Device and inode captured during reassessment.
 * @returns The bound move outcome; failures leave the intent available for recovery.
 * @category utilities
 * @since 0.0.0
 */
export const renameBoundEntry = Effect.fnUntraced(function* (
  source: string,
  destination: string,
  expected: DirectoryIdentity
): Effect.fn.Return<BoundRemovalOutcome | "renamed-unsynced", never, Path.Path | Scope.Scope> {
  const path = yield* Path.Path;
  const fs = nodeFs();
  const sourceParent = yield* openDirectoryHandle(path.dirname(source));
  const destinationParent = yield* openDirectoryHandle(path.dirname(destination));
  if (O.isNone(sourceParent) || O.isNone(destinationParent)) return "identity-changed";
  if (!N.Equivalence(sourceParent.value.identity.dev, destinationParent.value.identity.dev)) return "identity-changed";
  const from = heldEntry(sourceParent.value.fd, path.basename(source));
  const to = heldEntry(destinationParent.value.fd, path.basename(destination));
  const stats = yield* attempt("stat", from, () => fs.lstatSync(from)).pipe(Effect.option);
  if (
    !O.exists(
      stats,
      (info) =>
        !info.isSymbolicLink() &&
        sameDirectoryIdentity(expected, DirectoryIdentity.make({ dev: info.dev, ino: info.ino }))
    )
  )
    return "identity-changed";
  const destinationStatus = yield* attempt("stat", to, () => fs.lstatSync(to, { throwIfNoEntry: false })).pipe(
    Effect.result
  );
  if (Result.isFailure(destinationStatus) || O.isSome(O.fromUndefinedOr(destinationStatus.success)))
    return "identity-changed";
  const renamed = yield* attempt("rename", from, () => fs.renameSync(from, to)).pipe(Effect.result);
  if (Result.isFailure(renamed)) return "removal-failed";
  const synced = yield* attempt("sync", to, () => {
    fs.fsyncSync(sourceParent.value.fd);
    fs.fsyncSync(destinationParent.value.fd);
  }).pipe(Effect.result);
  return Result.isFailure(synced) ? "renamed-unsynced" : "removed";
});

/**
 * Sync a directory through an O_NOFOLLOW descriptor and surface durability failures.
 *
 * **Example** (Build a mandatory directory sync)
 *
 * ```ts
 * import { syncDirectoryHandle } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(Effect.scoped(syncDirectoryHandle("/repo/.beep")))) // true
 * ```
 *
 * @param path - Directory whose metadata must reach durable storage.
 * @returns A typed failure if the directory cannot be bound or synced.
 * @category utilities
 * @since 0.0.0
 */
export const syncDirectoryHandle = Effect.fnUntraced(function* (path: string) {
  const handle = yield* openDirectoryHandle(path);
  if (O.isNone(handle))
    return yield* DirectoryHandleError.make({
      message: "Cannot bind directory for sync",
      operation: "sync",
      path,
      cause: "unavailable",
    });
  yield* attempt("sync", path, () => nodeFs().fsyncSync(handle.value.fd));
});
