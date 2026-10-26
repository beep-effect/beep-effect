import * as P from "effect/Predicate";

// "Is there a file / a directory at this path?" — the probe the installers
// ask before deciding whether to reinstall, skip or fail typed.

import * as Effect from "effect/Effect";
import * as Function from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";

/**
 * The entry's type, or `undefined` when nothing readable is there. Absence
 * and unreadability collapse together on purpose: every caller's next move
 * (reinstall, write the shim, fail `layoutUnexpected`) is the same for both.
 *
 * **Example** (Treat an unreadable path as absent)
 *
 * ```ts
 * import { typeAt } from "@beep/github-actions/internal/fsProbe";
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 *
 * const fs = FileSystem.makeNoop({});
 * console.log(await Effect.runPromise(typeAt(fs, "/missing"))) // undefined
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const typeAt: {
  (fs: FileSystem.FileSystem, path: string): Effect.Effect<FileSystem.File.Type | undefined>;
  (path: string): (fs: FileSystem.FileSystem) => Effect.Effect<FileSystem.File.Type | undefined>;
} = Function.dual(
  2,
  (fs: FileSystem.FileSystem, path: string): Effect.Effect<FileSystem.File.Type | undefined> =>
    Effect.map(Effect.option(fs.stat(path)), (info) => (info._tag === "Some" ? info.value.type : undefined))
);

/**
 * Whether a thrown value is a Node errno error with the given code — the
 * platform's `SystemError` keeps the raw exception as its `cause`, and codes
 * it maps to no named tag (`EXDEV`, `ESRCH`) are only recoverable from there.
 *
 * **Example** (Recognize a cross-device errno)
 *
 * ```ts
 * import { isErrno } from "@beep/github-actions/internal/fsProbe";
 *
 * console.log(isErrno({ code: "EXDEV" }, "EXDEV")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isErrno: {
  (cause: unknown, code: string): boolean;
  (code: string): (cause: unknown) => boolean;
} = Function.dual(
  2,
  (cause: unknown, code: string): boolean => P.isObjectOrArray(cause) && "code" in cause && cause.code === code
);

/**
 * Whether a `path.relative(root, target)` answer leaves `root`: the root
 * itself, its parent, anything under its parent, or another drive.
 *
 * **Example** (Reject an escaping relative path)
 *
 * ```ts
 * import { escapesRoot } from "@beep/github-actions/internal/fsProbe";
 * import * as Path from "effect/Path";
 * import * as Effect from "effect/Effect";
 *
 * const path = Effect.runSync(Effect.provide(Path.Path, Path.layer));
 * console.log(escapesRoot(path, "../outside")) // true
 * console.log(escapesRoot(path, "bin/tool")) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const escapesRoot: {
  (path: Path.Path, relative: string): boolean;
  (relative: string): (path: Path.Path) => boolean;
} = Function.dual(
  2,
  (path: Path.Path, relative: string): boolean =>
    relative === "" || relative === ".." || Str.startsWith(`..${path.sep}`)(relative) || path.isAbsolute(relative)
);

/**
 * Resolve a destination that may not exist yet through its nearest existing
 * ancestor, without following a dangling link: a missing name resolves as its
 * real parent joined with the name, and a missing path that is itself a link
 * keeps the `NotFound` failure.
 *
 * **Example** (Resolve a new file under a real directory)
 *
 * ```ts
 * import { realDestination } from "@beep/github-actions/internal/fsProbe";
 * import * as Effect from "effect/Effect";
 *
 * console.log(typeof realDestination) // function
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const realDestination = ({
  fs,
  path,
}: {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
}): ((file: string) => Effect.Effect<string, PlatformError.PlatformError>) => {
  const resolve = Effect.fnUntraced(function* (file: string): Effect.fn.Return<string, PlatformError.PlatformError> {
    return yield* fs.realPath(file).pipe(
      Effect.catchIf(
        (error) => error.reason._tag === "NotFound",
        Effect.fnUntraced(function* (
          error: PlatformError.PlatformError
        ): Effect.fn.Return<string, PlatformError.PlatformError> {
          const link = yield* Effect.option(fs.readLink(file));
          const parent = path.dirname(file);
          if (O.isSome(link) || parent === file) {
            return yield* error;
          }
          return path.join(yield* resolve(parent), path.basename(file));
        })
      )
    );
  });
  return resolve;
};

/**
 * The entry's metadata, `Option.none()` only for a provable `NotFound`: every
 * other stat failure (permission denied, a broken mount) stays a failure,
 * because a caller that read it as absence would act on state it could not see.
 *
 * **Example** (Probe a path that may be absent)
 *
 * ```ts
 * import { statIfPresent } from "@beep/github-actions/internal/fsProbe";
 *
 * console.log(typeof statIfPresent) // function
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const statIfPresent: {
  (fs: FileSystem.FileSystem, path: string): Effect.Effect<O.Option<FileSystem.File.Info>, PlatformError.PlatformError>;
  (
    path: string
  ): (fs: FileSystem.FileSystem) => Effect.Effect<O.Option<FileSystem.File.Info>, PlatformError.PlatformError>;
} = Function.dual(
  2,
  (
    fs: FileSystem.FileSystem,
    path: string
  ): Effect.Effect<O.Option<FileSystem.File.Info>, PlatformError.PlatformError> =>
    Effect.catchIf(
      Effect.asSome(fs.stat(path)),
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeedNone
    )
);
