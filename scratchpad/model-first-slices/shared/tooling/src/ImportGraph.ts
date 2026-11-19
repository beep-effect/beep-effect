import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "@beep/utils/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "@beep/utils/Str";
import { thunkEffectSucceedNone } from "@beep/utils"

/**
 * A workspace package as the walker resolves it: its directory and its exact
 * `exports` map.
 *
 * @category models
 * @since 0.0.0
 */
export const WorkspacePackage = S.Struct({
  name: S.String,
  dir: S.String,
  exports: S.Record(S.String, S.String),
});
/**
 * @category models
 * @since 0.0.0
 */
export type WorkspacePackage = typeof WorkspacePackage.Type;

/** A package.json, as the graph reads it: a missing `workspaces` or `exports` reads as empty. */
const Manifest = S.Struct({
  name: S.String,
  workspaces: S.String.pipe(S.Array, S.withDecodingDefaultKey(Effect.succeed([]))),
  exports: S.Record(S.String, S.String).pipe(S.withDecodingDefaultKey(Effect.succeed({}))),
});
const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(Manifest));

/**
 * An import names a workspace package entry its `exports` does not list.
 *
 * @category errors
 * @since 0.0.0
 */
export class UnlistedEntry extends S.TaggedError<UnlistedEntry, { readonly brand: unique symbol }>()("UnlistedEntry", {
  from: S.String,
  specifier: S.String,
}) {}

/**
 * Every package of the workspace rooted at `root`, by name.
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadWorkspace = Effect.fn("ImportGraph.loadWorkspace")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestOf = (dir: string) => fs.readFileString(path.join(dir, "package.json")).pipe(Effect.flatMap(decodeManifest));
  const rootManifest = yield* manifestOf(root);
  const packages = yield* Effect.forEach(rootManifest.workspaces, (workspace) => {
    const dir = path.join(root, workspace);
    return Effect.map(manifestOf(dir), (manifest) =>
      WorkspacePackage.make({ name: manifest.name, dir, exports: manifest.exports }),
    );
  }, { concurrency: 1 });
  return HashMap.fromIterable(A.map(packages, (pkg) => [pkg.name, pkg] as const));
});

// Static import and re-export specifiers, type-only ones included; dynamic `import("…")` too.
// Lines inside JSDoc start with `*`, so the anchor skips the examples in comments.
const SPECIFIER = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Every module specifier a source file names.
 *
 * @category getters
 * @since 0.0.0
 */
export const specifiersOf = (source: string): ReadonlyArray<string> =>
  pipe(
    A.fromIterable(pipe(source, Str.matchAll(SPECIFIER))),
    A.flatMap((match) => A.filter([match[1], match[2], match[3]], (s): s is string => s !== undefined)),
  );

const packageNameOf = (specifier: string): string => {
  const [scope, name] = Str.split(specifier, "/");
  return Str.startsWith("@")(specifier) ? `${scope}/${name}` : (scope ?? specifier);
};

/**
 * Every source file reachable from `entries` (absolute paths) through
 * relative imports and workspace package entries. Imports of packages
 * outside the workspace (`effect`, the library) are not followed. The
 * entries come first, so a package's entry list pipes into
 * `reachable(workspace)`.
 *
 * @category getters
 * @since 0.0.0
 */
export const reachable: {
  (
    workspace: HashMap.HashMap<string, WorkspacePackage>,
  ): (entries: ReadonlyArray<string>) => Effect.Effect<Array<string>, UnlistedEntry | PlatformError, FileSystem.FileSystem | Path.Path>;
  (
    entries: ReadonlyArray<string>,
    workspace: HashMap.HashMap<string, WorkspacePackage>,
  ): Effect.Effect<Array<string>, UnlistedEntry | PlatformError, FileSystem.FileSystem | Path.Path>;
} = dual(2, Effect.fn("ImportGraph.reachable")(function* (
  entries: ReadonlyArray<string>,
  workspace: HashMap.HashMap<string, WorkspacePackage>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const seen = MutableHashSet.empty<string>();
  const resolve = (from: string, specifier: string): Effect.Effect<O.Option<string>, UnlistedEntry> =>
    Str.startsWith(".")(specifier)
      ? Effect.succeedSome(path.resolve(path.dirname(from), specifier))
      : O.match(HashMap.get(workspace, packageNameOf(specifier)), {
          onNone: thunkEffectSucceedNone,
          onSome: (pkg) => {
            const subpath = `.${Str.slice(pkg.name.length)(specifier)}`;
            return O.match(O.fromNullishOr(pkg.exports[subpath]), {
              onNone: () => Effect.fail(UnlistedEntry.make({ from, specifier })),
              onSome: (target) => Effect.succeedSome(path.join(pkg.dir, target)),
            });
          },
        });
  const visit = (file: string): Effect.Effect<void, UnlistedEntry | PlatformError> =>
    MutableHashSet.has(seen, file)
      ? Effect.void
      : Effect.gen(function* () {
          MutableHashSet.add(seen, file);
          const source = yield* fs.readFileString(file);
          const next = yield* Effect.forEach(specifiersOf(source), (specifier) => resolve(file, specifier), { concurrency: 1 });
          yield* Effect.forEach(A.getSomes(next), visit, { concurrency: 1, discard: true });
        });
  yield* Effect.forEach(entries, visit, { concurrency: 1, discard: true });
  return A.sort(A.fromIterable(seen), Order.String);
}));

/**
 * The absolute entry files a package's `exports` names.
 *
 * @category getters
 * @since 0.0.0
 */
export const entriesOf: {
  (join: (...parts: ReadonlyArray<string>) => string): (pkg: WorkspacePackage) => Array<string>;
  (pkg: WorkspacePackage, join: (...parts: ReadonlyArray<string>) => string): Array<string>;
} = dual(2, (pkg: WorkspacePackage, join: (...parts: ReadonlyArray<string>) => string): Array<string> =>
  A.map(R.values(pkg.exports), (target) => join(pkg.dir, target)),
);
