/**
 * Shared path-traversal safety guards and atomic writes for local files.
 *
 * Given an allowed root directory and a candidate path, this module resolves
 * the real, canonical absolute path and fails closed (typed
 * {@link PathSafetyError}) when the resolved path escapes the root via an
 * absolute path outside the root, a `..` traversal, or a symlink that points
 * outside the root.
 *
 * The Effect-returning guards ({@link resolvePathWithinRoot} and
 * {@link resolvePathWithinCanonicalRoot}) use the
 * runtime-neutral `FileSystem` and `Path` services from the main `effect`
 * package so callers supply the platform implementation (for example
 * `@effect/platform-node`) through a layer. A pure validation
 * ({@link validateResolvedPath} / {@link isPathWithinRoot}) is provided for
 * already-resolved absolute strings where the filesystem is not consulted.
 *
 * {@link writeFileWithinRootAtomically} and
 * {@link writeFileWithinCanonicalRootAtomically} build on the containment
 * guard with a private, unpredictable temporary directory and exclusive
 * payload creation.
 * Rejecting non-regular or device files is intentionally out of scope for
 * reads; callers stat and reject those after the path is proven in-root.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { Effect, FileSystem, Path, Result } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PlatformError } from "effect/PlatformError";

const $I = $FileProcessingId.create("PathSafety");

/**
 * Machine-readable reasons a path was rejected by the safety guard.
 *
 * Every reason is fail-closed: the guard refuses access rather than guessing.
 *
 * @example
 * ```ts
 * import { PathSafetyViolationReason } from "@beep/file-processing/PathSafety"
 *
 * console.log(PathSafetyViolationReason.Options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PathSafetyViolationReason = LiteralKit([
  "escapes-root",
  "canonical-root-not-absolute",
  "root-not-resolvable",
  "candidate-not-resolvable",
]).pipe(
  $I.annoteSchema("PathSafetyViolationReason", {
    description:
      "Fail-closed reasons a candidate path was rejected: it escapes the allowed root, the pinned canonical root is not absolute, or the root or candidate could not be canonicalized.",
  })
);

/**
 * Type for {@link PathSafetyViolationReason}.
 *
 * @example
 * ```ts
 * import { PathSafetyViolationReason } from "@beep/file-processing/PathSafety"
 *
 * const reason: PathSafetyViolationReason = "escapes-root"
 * console.log(PathSafetyViolationReason.is["escapes-root"](reason)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PathSafetyViolationReason = typeof PathSafetyViolationReason.Type;

/**
 * Typed, fail-closed path-safety violation.
 *
 * Carries the sanitized allowed root, the original candidate path, and (when
 * the candidate canonicalized) the resolved real path that escaped the root.
 *
 * @example
 * ```ts
 * import { PathSafetyError } from "@beep/file-processing/PathSafety"
 *
 * const error = PathSafetyError.escapesRoot({
 *   root: "/srv/data",
 *   candidate: "../etc/passwd",
 *   resolved: "/etc/passwd"
 * })
 * console.log(error.reason) // "escapes-root"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PathSafetyError extends TaggedErrorClass<PathSafetyError>($I`PathSafetyError`)(
  "PathSafetyError",
  {
    candidate: S.String,
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
    message: S.String,
    reason: PathSafetyViolationReason,
    resolved: S.OptionFromOptionalKey(S.String),
    root: S.String,
  },
  $I.annote("PathSafetyError", {
    description:
      "Typed, fail-closed error raised when a candidate path escapes its allowed root or cannot be canonicalized.",
  })
) {
  /**
   * Construct an `escapes-root` violation.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly escapesRoot = (options: {
    readonly root: string;
    readonly candidate: string;
    readonly resolved: string;
  }): PathSafetyError =>
    PathSafetyError.make({
      candidate: options.candidate,
      cause: O.none(),
      message: `Path "${options.candidate}" resolves to "${options.resolved}" which escapes the allowed root "${options.root}".`,
      reason: "escapes-root",
      resolved: O.some(options.resolved),
      root: options.root,
    });

  /**
   * Construct a `root-not-resolvable` violation.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly rootNotResolvable = (options: {
    readonly root: string;
    readonly candidate: string;
    readonly cause: unknown;
  }): PathSafetyError =>
    PathSafetyError.make({
      candidate: options.candidate,
      cause: O.some(options.cause),
      message: `Allowed root "${options.root}" could not be canonicalized.`,
      reason: "root-not-resolvable",
      resolved: O.none(),
      root: options.root,
    });

  /**
   * Construct a `canonical-root-not-absolute` violation.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly canonicalRootNotAbsolute = (options: {
    readonly root: string;
    readonly candidate: string;
  }): PathSafetyError =>
    PathSafetyError.make({
      candidate: options.candidate,
      cause: O.none(),
      message: `Pinned canonical root "${options.root}" must be an absolute path.`,
      reason: "canonical-root-not-absolute",
      resolved: O.none(),
      root: options.root,
    });

  /**
   * Construct a `candidate-not-resolvable` violation.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly candidateNotResolvable = (options: {
    readonly root: string;
    readonly candidate: string;
    readonly cause: unknown;
  }): PathSafetyError =>
    PathSafetyError.make({
      candidate: options.candidate,
      cause: O.some(options.cause),
      message: `Candidate path "${options.candidate}" could not be canonicalized under root "${options.root}".`,
      reason: "candidate-not-resolvable",
      resolved: O.none(),
      root: options.root,
    });
}

/**
 * Detect roots that unambiguously use Windows drive or backslash syntax.
 */
const isWindowsStyleRoot = (root: string): boolean =>
  Str.startsWith("\\")(root) || Eq.equals(Str.slice(1, 3)(root), ":\\") || Eq.equals(Str.slice(1, 3)(root), ":/");

/**
 * Normalize a pure path string according to its root's detected path style and
 * drop a single trailing separator. POSIX roots deliberately preserve literal
 * backslashes; Windows-style roots collapse them to forward slashes.
 */
const normalizeForComparison = (value: string, windowsStyle: boolean): string => {
  const forward = windowsStyle ? Str.replaceAll("\\", "/")(value) : value;
  return Str.length(forward) > 1 && Str.endsWith("/")(forward)
    ? Str.slice(0, Str.length(forward) - 1)(forward)
    : forward;
};

/**
 * Split a normalized path into non-empty segments.
 */
const segmentsOf: (normalized: string) => ReadonlyArray<string> = flow(Str.split("/"), A.filter(Str.isNonEmpty));

/**
 * Pure containment check for two already-resolved absolute paths.
 *
 * Returns `true` when `candidate` is the root itself or a descendant of it.
 * This consults no filesystem; it only compares canonicalized strings, so the
 * caller must pass paths that have already been resolved. Windows drive and
 * backslash roots normalize Windows separators, while a root beginning with
 * `/` uses POSIX semantics and treats a backslash as a literal filename
 * character. A `..` segment surviving in `candidate` always fails
 * containment. Filesystem operations use their platform `Path` service rather
 * than this style-inference helper.
 *
 * @example
 * ```ts
 * import { isPathWithinRoot } from "@beep/file-processing/PathSafety"
 *
 * console.log(isPathWithinRoot("/srv/data", "/srv/data/file.txt")) // true
 * console.log(isPathWithinRoot("/srv/data", "/srv/data-evil")) // false
 * console.log(isPathWithinRoot("/srv/data", "/etc/passwd")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPathWithinRoot: {
  (root: string, candidate: string): boolean;
  (candidate: string): (root: string) => boolean;
} = dual(2, (root: string, candidate: string): boolean => {
  const windowsStyle = isWindowsStyleRoot(root);
  const normalizedRoot = normalizeForComparison(root, windowsStyle);
  const normalizedCandidate = normalizeForComparison(candidate, windowsStyle);

  if (A.some(segmentsOf(normalizedCandidate), Eq.equals(".."))) {
    return false;
  }

  if (Eq.equals(normalizedCandidate, normalizedRoot)) {
    return true;
  }

  const rootPrefix = Str.endsWith("/")(normalizedRoot) ? normalizedRoot : `${normalizedRoot}/`;
  return Str.startsWith(rootPrefix)(normalizedCandidate);
});

/**
 * Platform-aware containment for canonical absolute filesystem paths.
 */
const isResolvedPathWithinRoot = (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    Eq.equals(relative, "") ||
    (!path.isAbsolute(relative) && !Eq.equals(relative, "..") && !Str.startsWith(`..${path.sep}`)(relative))
  );
};

/**
 * Pure, fail-closed validation for an already-resolved candidate path.
 *
 * Returns `Result.succeed(candidate)` when the candidate is contained by the
 * root and `Result.fail(PathSafetyError)` otherwise. No filesystem access is
 * performed, so symlink resolution is the caller's responsibility; use this
 * only on paths already canonicalized (for example the output of
 * {@link resolvePathWithinRoot}, or a `Path.resolve` result you trust).
 *
 * @example
 * ```ts
 * import { validateResolvedPath } from "@beep/file-processing/PathSafety"
 * import { Result } from "effect"
 *
 * const ok = validateResolvedPath({ root: "/srv/data", candidate: "/srv/data/a.txt" })
 * console.log(Result.isSuccess(ok)) // true
 *
 * const bad = validateResolvedPath({ root: "/srv/data", candidate: "/etc/passwd" })
 * console.log(Result.isFailure(bad)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateResolvedPath = (options: {
  readonly root: string;
  readonly candidate: string;
}): Result.Result<string, PathSafetyError> =>
  isPathWithinRoot(options.root, options.candidate)
    ? Result.succeed(options.candidate)
    : Result.fail(
        PathSafetyError.escapesRoot({
          root: options.root,
          candidate: options.candidate,
          resolved: options.candidate,
        })
      );

/**
 * Resolve a candidate path against an allowed root and fail closed if it
 * escapes.
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
 * @example
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

  const canonicalRoot = yield* fs
    .realPath(options.root)
    .pipe(
      Effect.mapError((cause) =>
        PathSafetyError.rootNotResolvable({ root: options.root, candidate: options.candidate, cause })
      )
    );

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
    fs.realPath(target).pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<string>));

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

  if (!isResolvedPathWithinRoot(path, canonicalRoot, canonicalCandidate)) {
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
 * @example
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

    return yield* Effect.acquireUseRelease(
      fs.makeTempDirectory({
        directory: checkedTargetDirectory,
        prefix: `.${path.basename(checkedTarget)}.tmp-`,
      }),
      Effect.fnUntraced(function* (temporaryDirectory) {
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
      }),
      (temporaryDirectory) => fs.remove(temporaryDirectory, { force: true, recursive: true }).pipe(Effect.ignore)
    );
  }
);

/**
 * Write bytes atomically beneath a root that the caller already canonicalized.
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
 * @example
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
 * @effects Canonicalizes candidate paths, creates destination directories and a private temporary directory, writes a new file exclusively, atomically renames it, and removes temporary artifacts; never re-canonicalizes the authority root.
 * @category mutations
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
 * The destination is containment-checked before and after parent-directory
 * creation. The bytes are then written with exclusive creation and mode
 * `0o600` inside an unpredictable temporary directory beside the destination,
 * before an atomic rename promotes them into place. Temporary artifacts are
 * removed on success, failure, or interruption.
 *
 * This prevents writes through a pre-positioned predictable temporary-file
 * symlink. Callers that allow another principal to rename entries in the
 * destination directory still need an operating-system boundary with
 * directory-handle-relative operations for complete concurrent-adversary
 * protection.
 *
 * @example
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
 * @effects Canonicalizes paths, creates destination directories and a private temporary directory, writes a new file exclusively, atomically renames it, and removes temporary artifacts.
 * @category mutations
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
  const canonicalRoot = yield* fs
    .realPath(options.root)
    .pipe(
      Effect.mapError((cause) =>
        PathSafetyError.rootNotResolvable({ root: options.root, candidate: options.candidate, cause })
      )
    );
  return yield* writeWithinCanonicalRootAtomically(fs, path, canonicalRoot, options.candidate, options.bytes);
});
