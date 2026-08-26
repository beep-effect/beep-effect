/**
 * Pure path-containment policy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Result } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual, flow } from "effect/Function";
import * as Str from "effect/String";
import { PathSafetyError } from "./PathSafety.errors.ts";

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
 * **Details**
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
 * **Example** (Compare contained absolute paths)
 *
 * ```ts import.meta.vitest name="Compare contained absolute paths"
 * import { isPathWithinRoot } from "@beep/file-processing/PathSafety"
 *
 * isPathWithinRoot("/srv/data", "/srv/data/file.txt") // => true
 * isPathWithinRoot("/srv/data", "/srv/data-evil") // => false
 * isPathWithinRoot("/srv/data", "/etc/passwd") // => false
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
 * Pure, fail-closed validation for an already-resolved candidate path.
 *
 * **Details**
 *
 * Returns `Result.succeed(candidate)` when the candidate is contained by the
 * root and `Result.fail(PathSafetyError)` otherwise. No filesystem access is
 * performed, so symlink resolution is the caller's responsibility; use this
 * only on paths already canonicalized (for example the output of
 * {@link resolvePathWithinRoot}, or a `Path.resolve` result you trust).
 *
 * **Example** (Validate contained resolved path)
 *
 * ```ts import.meta.vitest name="Validate contained resolved path"
 * import { validateResolvedPath } from "@beep/file-processing/PathSafety"
 * import { Result } from "effect"
 *
 * const ok = validateResolvedPath({ root: "/srv/data", candidate: "/srv/data/a.txt" })
 * Result.isSuccess(ok) // => true
 *
 * const bad = validateResolvedPath({ root: "/srv/data", candidate: "/etc/passwd" })
 * Result.isFailure(bad) // => true
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
