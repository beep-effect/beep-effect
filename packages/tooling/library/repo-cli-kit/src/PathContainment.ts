/**
 * Shared path-containment check for the repo CLI.
 *
 * The Drawings intake and review lanes and the worktree command each carried a
 * copy of the same predicate: a candidate path lies strictly inside a root when
 * the relative path from the root is non-empty, does not climb out with `..`,
 * and is not absolute (a different drive on Windows). This module owns it once.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as Str from "effect/String";
import type * as Path from "effect/Path";

/**
 * Reports whether `candidate` lies strictly inside `root`.
 *
 * **Details**
 *
 * The root itself is not inside itself, and a sibling that only shares a name
 * prefix (`/a/bc` under `/a/b`) is outside, because the check works on the
 * relative path rather than on string prefixes.
 *
 * **Example** (Check a path against a root)
 *
 * ```ts
 * import { isWithinRoot } from "@beep/repo-cli-kit/PathContainment"
 * import * as Effect from "effect/Effect"
 * import * as Path from "effect/Path"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   return isWithinRoot(path, "/corpus", "/corpus/in/a.pdf")
 * })
 * const inside = Effect.runSync(program.pipe(Effect.provide(Path.layer)))
 * console.log(inside) // true
 * ```
 *
 * @param path - The platform path service used to relate the two paths.
 * @param root - The directory that must contain `candidate`.
 * @param candidate - The path to test.
 * @returns `true` when `candidate` is a descendant of `root`.
 * @category predicates
 * @since 0.0.0
 */
export const isWithinRoot: {
  (root: string, candidate: string): (path: Path.Path) => boolean;
  (path: Path.Path, root: string, candidate: string): boolean;
} = dual(3, (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return relative.length > 0 && !Str.startsWith("..")(relative) && !path.isAbsolute(relative);
});
