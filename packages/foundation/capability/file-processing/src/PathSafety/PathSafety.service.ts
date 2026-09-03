/**
 * Filesystem-backed path-safety operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Exit, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { PathSafetyError } from "./PathSafety.errors.ts";
import type { PlatformError } from "effect/PlatformError";

/**
 * Check resolved absolute paths for containment with the active platform's path semantics.
 *
 * **Details**
 *
 * The caller must resolve both paths before comparison. This predicate uses
 * `Path.relative`, so separator, drive, and case behavior comes from the active
 * platform instead of string-style inference.
 *
 * **Example** (Check a resolved descendant)
 *
 * ```ts
 * import * as BunPath from "@effect/platform-bun/BunPath"
 * import { isResolvedPathWithinRoot } from "@beep/file-processing/PathSafety"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   return isResolvedPathWithinRoot(path, {
 *     root: "/srv/data",
 *     candidate: "/srv/data/file.txt"
 *   })
 * }).pipe(Effect.provide(BunPath.layer))
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @param path - Platform path service used for the comparison.
 * @param options - Canonical root and candidate paths to compare.
 * @returns `true` when the candidate is the root or one of its descendants.
 * @category predicates
 * @since 0.0.0
 */
export const isResolvedPathWithinRoot: {
  (options: { readonly root: string; readonly candidate: string }): (path: Path.Path) => boolean;
  (path: Path.Path, options: { readonly root: string; readonly candidate: string }): boolean;
} = dual(2, (path: Path.Path, options: { readonly root: string; readonly candidate: string }): boolean => {
  const relative = path.relative(options.root, options.candidate);
  return (
    Eq.equals(relative, "") ||
    (!path.isAbsolute(relative) && !Eq.equals(relative, "..") && !Str.startsWith(`..${path.sep}`)(relative))
  );
});

/** Canonicalize the configured authority root for a candidate operation. */
const canonicalizeRoot = (fs: FileSystem.FileSystem, root: string, candidate: string) =>
  fs.realPath(root).pipe(Effect.mapError((cause) => PathSafetyError.rootNotResolvable({ root, candidate, cause })));

/**
 * Resolve a candidate path against an allowed root and fail closed if it
 * escapes.
 *
 * **Details**
 *
 * The root is canonicalized with `FileSystem.realPath`, then the candidate is
 * resolved relative to that canonical root (`Path.resolve`) and itself
 * canonicalized, following symlinks. The deepest existing ancestor is
 * canonicalized so that not-yet-created write targets are still checked: a
 * missing leaf does not bypass the guard because its real parent is resolved
 * and the unresolved suffix is re-joined and re-validated. The final real path
 * is rejected (typed {@link PathSafetyError}) unless it is contained by the
 * canonical root.
 *
 * This succeeds with the canonical absolute path that callers should use for
 * the actual read or write. Non-regular/device-file rejection is out of scope
 * and left to callers.
 *
 * **Example** (Resolve candidate under root)
 *
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import * as BunPath from "@effect/platform-bun/BunPath"
 * import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety"
 * import { Effect, Layer } from "effect"
 *
 * const program = resolvePathWithinRoot({ root: ".", candidate: "README.md" }).pipe(
 *   Effect.map((resolved) => resolved.endsWith("README.md")),
 *   Effect.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))
 * )
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @effects Reads canonical filesystem paths through `FileSystem.realPath` and depends on the platform `Path` service for candidate resolution.
 * @category guards
 * @since 0.0.0
 */
export const resolvePathWithinRoot: (options: {
  readonly root: string;
  readonly candidate: string;
}) => Effect.Effect<string, PathSafetyError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "PathSafety.resolvePathWithinRoot"
)(function* (options) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const canonicalRoot = yield* canonicalizeRoot(fs, options.root, options.candidate);

  return yield* resolveCandidateWithinCanonicalRoot(fs, path, canonicalRoot, options.candidate);
});

/**
 * Canonicalize the deepest existing ancestor of an absolute path and re-join
 * the unresolved (not-yet-created) suffix. If the full path exists it is
 * resolved directly; otherwise we walk parents until `realPath` succeeds, then
 * re-append the trailing segments. Fails only when even the filesystem root
 * cannot be resolved.
 */
const canonicalizeExisting: (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  absolute: string
) => Effect.Effect<string, PlatformError> = Effect.fnUntraced(function* (fs, path, absolute) {
  const tryResolve = (target: string): Effect.Effect<O.Option<string>, never> =>
    fs.realPath(target).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));

  let current = absolute;
  let suffix: ReadonlyArray<string> = A.empty<string>();

  while (true) {
    const resolved = yield* tryResolve(current);
    if (O.isSome(resolved)) {
      return A.length(suffix) === 0 ? resolved.value : path.join(resolved.value, ...suffix);
    }

    const parent = path.dirname(current);
    if (Eq.equals(parent, current)) {
      // Reached the filesystem root and it still did not resolve.
      return yield* fs.realPath(current);
    }

    suffix = A.prepend(suffix, path.basename(current));
    current = parent;
  }
});

/**
 * Resolve a candidate against a root that has already been canonicalized.
 * Keeping this separate lets multi-step operations bind their authority root
 * once instead of following a caller-controlled root symlink at every check.
 */
const resolveCandidateWithinCanonicalRoot: (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  canonicalRoot: string,
  candidate: string
) => Effect.Effect<string, PathSafetyError> = Effect.fnUntraced(function* (fs, path, canonicalRoot, candidate) {
  if (!path.isAbsolute(canonicalRoot)) {
    return yield* PathSafetyError.canonicalRootNotAbsolute({ root: canonicalRoot, candidate });
  }

  // Resolve the candidate against the canonical root so a relative candidate
  // is anchored in-root and an absolute candidate stays absolute.
  const anchored = path.resolve(canonicalRoot, candidate);

  // Canonicalize the deepest existing ancestor (following symlinks), then
  // re-attach any not-yet-created suffix. This lets write targets that don't
  // exist yet still be guarded without a realPath failure on the missing leaf.
  const canonicalCandidate = yield* canonicalizeExisting(fs, path, anchored).pipe(
    Effect.mapError((cause) => PathSafetyError.candidateNotResolvable({ root: canonicalRoot, candidate, cause }))
  );

  if (!isResolvedPathWithinRoot(path, { root: canonicalRoot, candidate: canonicalCandidate })) {
    return yield* PathSafetyError.escapesRoot({
      root: canonicalRoot,
      candidate,
      resolved: canonicalCandidate,
    });
  }

  return canonicalCandidate;
});

/**
 * Resolve a candidate beneath a root that the caller already canonicalized.
 *
 * **Details**
 *
 * Unlike {@link resolvePathWithinRoot}, this guard deliberately does not call
 * `FileSystem.realPath` on `canonicalRoot`. This lets a long-lived service pin
 * its authority boundary during layer construction: if the lexical root is
 * later replaced by a symlink, the candidate canonicalizes outside the pinned
 * root and is rejected instead of silently transferring authority.
 *
 * The caller must supply an absolute path previously returned by
 * `FileSystem.realPath`. Candidate paths and their deepest existing ancestors
 * are still canonicalized on every invocation.
 *
 * **Example** (Resolve under pinned root)
 *
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import * as BunPath from "@effect/platform-bun/BunPath"
 * import { resolvePathWithinCanonicalRoot } from "@beep/file-processing/PathSafety"
 * import { Effect, FileSystem, Layer } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const canonicalRoot = yield* fs.realPath(".")
 *   return yield* resolvePathWithinCanonicalRoot({ canonicalRoot, candidate: "README.md" })
 * }).pipe(Effect.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)))
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Canonicalizes the candidate path through `FileSystem.realPath` and depends on the platform `Path` service for candidate resolution; never re-canonicalizes the authority root.
 * @category guards
 * @since 0.0.0
 */
export const resolvePathWithinCanonicalRoot: (options: {
  readonly canonicalRoot: string;
  readonly candidate: string;
}) => Effect.Effect<string, PathSafetyError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "PathSafety.resolvePathWithinCanonicalRoot"
)(function* (options) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  return yield* resolveCandidateWithinCanonicalRoot(fs, path, options.canonicalRoot, options.candidate);
});

/**
 * Shared implementation for atomic writes beneath an already-canonical root.
 */
const writeWithinCanonicalRootAtomically: (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  canonicalRoot: string,
  candidate: string,
  bytes: Uint8Array
) => Effect.Effect<string, PathSafetyError | PlatformError> = Effect.fnUntraced(
  function* (fs, path, canonicalRoot, candidate, bytes) {
    const initialTarget = yield* resolveCandidateWithinCanonicalRoot(fs, path, canonicalRoot, candidate);
    const initialTargetDirectory = yield* resolveCandidateWithinCanonicalRoot(
      fs,
      path,
      canonicalRoot,
      path.dirname(initialTarget)
    );

    yield* fs.makeDirectory(initialTargetDirectory, { recursive: true });

    const checkedTarget = yield* resolveCandidateWithinCanonicalRoot(fs, path, canonicalRoot, candidate);
    const checkedTargetDirectory = yield* resolveCandidateWithinCanonicalRoot(
      fs,
      path,
      canonicalRoot,
      path.dirname(checkedTarget)
    );

    const writeExit = yield* Effect.acquireUseRelease(
      fs.makeTempDirectory({
        directory: checkedTargetDirectory,
        prefix: `.${path.basename(checkedTarget)}.tmp-`,
      }),
      (temporaryDirectory) =>
        Effect.exit(
          Effect.gen(function* () {
            const checkedTemporaryDirectory = yield* resolveCandidateWithinCanonicalRoot(
              fs,
              path,
              checkedTargetDirectory,
              temporaryDirectory
            );
            const temporaryPath = path.join(checkedTemporaryDirectory, "payload");

            yield* fs.writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });

            const finalTarget = yield* resolveCandidateWithinCanonicalRoot(fs, path, canonicalRoot, candidate);
            yield* fs.rename(temporaryPath, finalTarget);
            return finalTarget;
          })
        ),
      (temporaryDirectory, exit) => {
        const cleanup = fs.remove(temporaryDirectory, { force: true, recursive: true });
        return Exit.isSuccess(exit) && Exit.isSuccess(exit.value)
          ? cleanup.pipe(
              Effect.catch(() =>
                Effect.logWarning(
                  "Failed to remove a committed atomic-write temporary directory; the target remains committed."
                )
              )
            )
          : cleanup;
      }
    );
    return yield* writeExit;
  }
);

/**
 * Write bytes atomically beneath a root that the caller already canonicalized.
 *
 * **Details**
 *
 * This is the mutation counterpart to
 * {@link resolvePathWithinCanonicalRoot}: it never re-canonicalizes
 * `canonicalRoot`, so a long-lived service does not transfer its authority if
 * the configured root path is later replaced by a symlink. All candidate,
 * parent, temporary-directory, and pre-rename containment checks still run.
 *
 * The caller must supply an absolute path previously returned by
 * `FileSystem.realPath`.
 *
 * **Example** (Atomic write under pinned root)
 *
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import * as BunPath from "@effect/platform-bun/BunPath"
 * import { writeFileWithinCanonicalRootAtomically } from "@beep/file-processing/PathSafety"
 * import { Effect, FileSystem, Layer } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const canonicalRoot = yield* fs.realPath(".")
 *   return yield* writeFileWithinCanonicalRootAtomically({
 *     canonicalRoot,
 *     candidate: "artifacts/report.txt",
 *     bytes: new TextEncoder().encode("ready")
 *   })
 * }).pipe(Effect.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)))
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Canonicalizes candidate paths, creates destination directories and a private temporary directory, writes a new file exclusively, atomically renames it, and attempts to remove temporary artifacts; cleanup failure after a committed rename is logged without changing the successful result, and the authority root is never re-canonicalized.
 * @category resource-management
 * @since 0.0.0
 */
export const writeFileWithinCanonicalRootAtomically: (options: {
  readonly canonicalRoot: string;
  readonly candidate: string;
  readonly bytes: Uint8Array;
}) => Effect.Effect<string, PathSafetyError | PlatformError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "PathSafety.writeFileWithinCanonicalRootAtomically"
)(function* (options) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  return yield* writeWithinCanonicalRootAtomically(fs, path, options.canonicalRoot, options.candidate, options.bytes);
});

/**
 * Write bytes atomically to a root-contained destination.
 *
 * **Details**
 *
 * The destination is containment-checked before and after parent-directory
 * creation. The bytes are then written with exclusive creation and mode
 * `0o600` inside an unpredictable temporary directory beside the destination,
 * before an atomic rename promotes them into place. Temporary artifacts are
 * removed on success, failure, or interruption. Cleanup remains fail-closed
 * before promotion. After the rename commits the target, cleanup is
 * best-effort so a leftover empty temporary directory cannot make callers
 * treat the committed write as failed and retry it.
 *
 * This prevents writes through a pre-positioned predictable temporary-file
 * symlink. Callers that allow another principal to rename entries in the
 * destination directory still need an operating-system boundary with
 * directory-handle-relative operations for complete concurrent-adversary
 * protection.
 *
 * **Example** (Atomic write under root)
 *
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import * as BunPath from "@effect/platform-bun/BunPath"
 * import { writeFileWithinRootAtomically } from "@beep/file-processing/PathSafety"
 * import { Effect, Layer } from "effect"
 *
 * const program = writeFileWithinRootAtomically({
 *   root: ".",
 *   candidate: "artifacts/report.txt",
 *   bytes: new TextEncoder().encode("ready")
 * }).pipe(Effect.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)))
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Canonicalizes paths, creates destination directories and a private temporary directory, writes a new file exclusively, atomically renames it, and attempts to remove temporary artifacts; cleanup failure after a committed rename is logged without changing the successful result.
 * @category resource-management
 * @since 0.0.0
 */
export const writeFileWithinRootAtomically: (options: {
  readonly root: string;
  readonly candidate: string;
  readonly bytes: Uint8Array;
}) => Effect.Effect<string, PathSafetyError | PlatformError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "PathSafety.writeFileWithinRootAtomically"
)(function* (options) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonicalRoot = yield* canonicalizeRoot(fs, options.root, options.candidate);
  return yield* writeWithinCanonicalRootAtomically(fs, path, canonicalRoot, options.candidate, options.bytes);
});
