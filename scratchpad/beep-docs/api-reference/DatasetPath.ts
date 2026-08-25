/**
 * Path containment guard shared by the dataset and reflection loaders: every
 * relative path read from a manifest must stay inside the dataset directory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Effect, Path } from "effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("beep-docs/api-reference/DatasetPath");

/**
 * Raised when a manifest path resolves outside the dataset directory it was
 * read from.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { PathEscapesDataset } from "./DatasetPath.ts"
 *
 * const error = PathEscapesDataset.make({ baseDirectory: "/data/v4", path: "../secrets.json" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PathEscapesDataset extends S.TaggedError<PathEscapesDataset>($I`PathEscapesDataset`)(
  "PathEscapesDataset",
  {
    baseDirectory: S.String,
    path: S.String,
  },
  $I.annote("PathEscapesDataset", {
    description: "A manifest-supplied path resolved outside the dataset directory it belongs to.",
  })
) {}

/**
 * Resolves `relativePath` against `baseDirectory` and fails with
 * {@link PathEscapesDataset} when the result leaves the base directory.
 *
 * **Details**
 *
 * This is a trust boundary: manifests are generated artifacts, but the loader
 * still refuses to read outside the dataset root.
 *
 * **Example** (Resolve a contained path)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Path from "effect/Path"
 * import { resolveWithinDataset } from "./DatasetPath.ts"
 *
 * const program = resolveWithinDataset("/data/api-reference", "v4/effect/manifest.json").pipe(
 *   Effect.provide(Path.layer)
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveWithinDataset = Effect.fn("DatasetPath.resolveWithinDataset")(function* (
  baseDirectory: string,
  relativePath: string
) {
  const path = yield* Path.Path;
  const resolvedBase = path.resolve(baseDirectory);
  const resolved = path.resolve(resolvedBase, relativePath);
  const relative = path.relative(resolvedBase, resolved);
  const escapes = pipe(relative, Str.startsWith("..")) || path.isAbsolute(relative);
  if (escapes) {
    return yield* PathEscapesDataset.make({ baseDirectory: resolvedBase, path: relativePath });
  }
  return resolved;
});
