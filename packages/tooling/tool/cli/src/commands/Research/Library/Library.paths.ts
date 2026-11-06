/**
 * Portable research library paths and configuration.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { LibraryError } from "./Library.errors.ts";

/**
 * Relative path within the portable library layout.
 *
 * **Example** (Use LIBRARY_ONTOLOGY_DIR)
 * ```ts
 * import { LIBRARY_ONTOLOGY_DIR } from "@beep/repo-cli/commands/Research"
 * console.log(LIBRARY_ONTOLOGY_DIR)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LIBRARY_ONTOLOGY_DIR = "ontology";

/**
 * Relative path within the portable library layout.
 *
 * **Example** (Use LIBRARY_TBOX_FILE)
 * ```ts
 * import { LIBRARY_TBOX_FILE } from "@beep/repo-cli/commands/Research"
 * console.log(LIBRARY_TBOX_FILE)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LIBRARY_TBOX_FILE = "ontology/research-library.ttl";

/**
 * Relative path within the portable library layout.
 *
 * **Example** (Use LIBRARY_SHAPES_FILE)
 * ```ts
 * import { LIBRARY_SHAPES_FILE } from "@beep/repo-cli/commands/Research"
 * console.log(LIBRARY_SHAPES_FILE)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LIBRARY_SHAPES_FILE = "ontology/research-library.shacl.ttl";

/**
 * Relative path within the portable library layout.
 *
 * **Example** (Use LIBRARY_MIGRATIONS_DIR)
 * ```ts
 * import { LIBRARY_MIGRATIONS_DIR } from "@beep/repo-cli/commands/Research"
 * console.log(LIBRARY_MIGRATIONS_DIR)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LIBRARY_MIGRATIONS_DIR = "ops/migrations";

/**
 * Resolve the flag, library environment override, XDG data home, or user data home.
 *
 * **Example** (Use resolveLibraryRoot)
 * ```ts
 * import { resolveLibraryRoot } from "@beep/repo-cli/commands/Research"
 * import * as O from "effect/Option"
 * const root = resolveLibraryRoot(O.some("/library"))
 * console.log(root.pipe !== undefined)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const resolveLibraryRoot = Effect.fn("ResearchLibrary.resolveRoot")(function* (flag: O.Option<string>) {
  const path = yield* Path.Path;
  if (O.isSome(flag)) return path.resolve(flag.value);
  const configured = yield* Config.String("BEEP_RESEARCH_LIBRARY").pipe(
    Config.option,
    Effect.mapError((cause) => LibraryError.make({ message: "Cannot resolve library configuration.", cause }))
  );
  if (O.isSome(configured)) return path.resolve(configured.value);
  const dataHome = yield* Config.String("XDG_DATA_HOME").pipe(
    Config.option,
    Effect.mapError((cause) => LibraryError.make({ message: "Cannot resolve XDG data home.", cause }))
  );
  if (O.isSome(dataHome)) return path.resolve(dataHome.value, "beep", "research-library");
  const home = yield* Config.String("HOME").pipe(
    Effect.mapError((cause) => LibraryError.make({ message: "HOME is required to resolve the library.", cause }))
  );
  return path.resolve(home, ".local", "share", "beep", "research-library");
});

/**
 * Resolve explicit input roots or the established default corpus roots.
 *
 * **Example** (Use resolveLibraryInputRoots)
 * ```ts
 * import { resolveLibraryInputRoots } from "@beep/repo-cli/commands/Research"
 * console.log(resolveLibraryInputRoots([]).pipe !== undefined)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const resolveLibraryInputRoots = Effect.fn("ResearchLibrary.resolveInputRoots")(function* (
  input: ReadonlyArray<string>
) {
  if (input.length > 0) return input;
  const path = yield* Path.Path;
  const home = yield* Config.String("HOME").pipe(
    Effect.mapError((cause) => LibraryError.make({ message: "Cannot resolve default corpus roots.", cause }))
  );
  return [path.resolve("research"), path.join(home, "Downloads/Research-10-6-26")];
});

/**
 * Resolve the existing parent of a prospective output relative to the real library root.
 *
 * **Example** (Inspect output ancestry)
 * ```ts
 * import { libraryOutputAncestor } from "@beep/repo-cli/commands/Research/Library/Library.paths"
 * console.log(libraryOutputAncestor("/library", "ontology/model.ttl").pipe !== undefined)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const libraryOutputAncestor = Effect.fn("Library.outputAncestor")(function* (root: string, target: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(root, target);
  const realRoot = yield* fs.realPath(root);
  let ancestor = path.dirname(absolute);
  while (!(yield* fs.exists(ancestor))) ancestor = path.dirname(ancestor);
  const resolved = yield* fs.realPath(ancestor);
  return { absolute, relative: path.relative(realRoot, resolved) };
});
