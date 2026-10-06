/** Immutable artifact integrity and library containment.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { hashBytes } from "./Library.store.ts";
import type { LibraryArtifact } from "./Library.schemas.ts";

const escapesLibraryPath = (path: Path.Path, relative: string) =>
  path.isAbsolute(relative) || relative === ".." || Str.startsWith(`..${path.sep}`)(relative);
const artifactRealPathEscapes = (path: Path.Path, realRoot: O.Option<string>, realTarget: O.Option<string>) => {
  if (O.isNone(realRoot) || O.isNone(realTarget)) return false;
  return escapesLibraryPath(path, path.relative(realRoot.value, realTarget.value));
};
const canonicalObjectIntegrity = Effect.fn("Library.canonicalObjectIntegrity")(function* (
  root: string,
  artifact: LibraryArtifact,
  realRoot: O.Option<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonicalPath = path.join(root, "objects/sha256", artifact.sha256);
  const canonicalReal = yield* fs.realPath(canonicalPath).pipe(Effect.option);
  if (O.isNone(canonicalReal) || O.isNone(realRoot)) {
    return O.some("canonical content object missing or corrupt");
  }
  const canonicalRelative = path.relative(realRoot.value, canonicalReal.value);
  if (escapesLibraryPath(path, canonicalRelative)) {
    return O.some("canonical object symlink escapes library");
  }
  const object = yield* fs.readFile(path.join(root, "objects/sha256", artifact.sha256)).pipe(Effect.option);
  if (
    O.isNone(object) ||
    object.value.length !== artifact.bytes ||
    (yield* hashBytes(object.value)) !== artifact.sha256
  ) {
    return O.some("canonical content object missing or corrupt");
  }
  return O.none<string>();
});
/** Return the concrete integrity failure, or None when alias and canonical object both validate.
 * **Example** (Prepare an integrity check)
 * ```ts
 * import { libraryArtifactIntegrity } from "@beep/repo-cli/test/ResearchLibrary"
 * import type { LibraryArtifact } from "@beep/repo-cli/commands/Research"
 * const check = (artifact: LibraryArtifact) => libraryArtifactIntegrity("/library", artifact)
 * console.log(typeof check) // function
 * ```
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const libraryArtifactIntegrity = Effect.fn("Library.artifactIntegrity")(function* (
  root: string,
  artifact: LibraryArtifact
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.resolve(root, artifact.path);
  const relative = path.relative(path.resolve(root), absolute);
  if (path.isAbsolute(artifact.path) || escapesLibraryPath(path, relative)) {
    return O.some("evidence path escapes library");
  }
  const realRoot = yield* fs.realPath(root).pipe(Effect.option);
  const realTarget = yield* fs.realPath(absolute).pipe(Effect.option);
  if (artifactRealPathEscapes(path, realRoot, realTarget)) return O.some("evidence symlink escapes library");
  if (O.isNone(realTarget)) return O.some("evidence missing or unreadable");
  const bytes = yield* fs.readFile(absolute).pipe(Effect.option);
  if (O.isNone(bytes)) {
    return O.some("evidence missing or unreadable");
  }
  const hash = yield* hashBytes(bytes.value);
  if (hash !== artifact.sha256 || bytes.value.length !== artifact.bytes) {
    return O.some("hash or byte-count mismatch");
  }
  return yield* canonicalObjectIntegrity(root, artifact, realRoot);
});
