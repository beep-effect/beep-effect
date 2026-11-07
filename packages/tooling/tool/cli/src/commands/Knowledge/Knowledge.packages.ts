/**
 * Tree-backed package export facts shared by knowledge scanners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeKnowledgeUtf8 } from "./Knowledge.refs.ts";
import { KnowledgePackageEntrypoint, KnowledgeWorkspacePackage } from "./KnowledgeDoctor.schemas.ts";
import type { KnowledgeTreeOracle } from "./Knowledge.refs.ts";

const $I = $RepoCliId.create("commands/Knowledge/Knowledge.packages");
const PACKAGE_MANIFEST = "package.json";
const WORKSPACE_SCOPE = "@beep/";
const isRegularBlob = (mode: string): boolean => mode === "100644" || mode === "100755";

const readText = (oracle: KnowledgeTreeOracle, repoPath: string) =>
  Effect.flatMap(oracle.readBytes(repoPath), (bytes) =>
    decodeKnowledgeUtf8(bytes, `Malformed UTF-8 in tracked file "${repoPath}".`)
  );

const readTextIfTracked = (oracle: KnowledgeTreeOracle, paths: HashSet.HashSet<string>, repoPath: string) =>
  HashSet.has(paths, repoPath) ? Effect.asSome(readText(oracle, repoPath)) : Effect.succeed(O.none<string>());

const dirname = (repoPath: string): string => A.join(A.dropRight(Str.split("/")(repoPath), 1), "/");

// Joins a relative spelling onto a repository directory, resolving `.` and `..` segments. A path
// that climbs above the repository root is not a repository path.
const joinRepoPath = (base: string, relative: string): O.Option<string> =>
  pipe(
    A.appendAll(Str.isEmpty(base) ? A.empty<string>() : Str.split("/")(base), Str.split("/")(relative)),
    A.reduce(O.some(A.empty<string>()), (state, segment) =>
      O.flatMap(state, (segments) =>
        segment === "" || segment === "."
          ? O.some(segments)
          : segment === ".."
            ? A.isReadonlyArrayNonEmpty(segments)
              ? O.some(A.dropRight(segments, 1))
              : O.none()
            : O.some(A.append(segments, segment))
      )
    ),
    O.map(A.join("/"))
  );

/**
 * Internal archive reads and repository-path operations shared by package and doctor facts.
 *
 * **Example** (Resolve a path without reading the working tree)
 *
 * ```ts
 * import { knowledgeTreeFacts } from "@beep/repo-cli/commands/Knowledge/Knowledge.packages"
 * import * as O from "effect/Option"
 *
 * const target = knowledgeTreeFacts.joinRepoPath("packages/demo", "./src/index.ts")
 * console.log(O.getOrNull(target)) // "packages/demo/src/index.ts"
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const knowledgeTreeFacts = { readText, readTextIfTracked, dirname, joinRepoPath };

class PackageManifestJson extends S.Opaque<PackageManifestJson, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.optionalKey(S.String),
    exports: S.optionalKey(S.Unknown),
    workspaces: S.optionalKey(S.Unknown),
  }).pipe(
    $I.annoteSchema("PackageManifestJson", {
      description: "The package.json fields the symbols evaluator reads: name, exports map, and workspace globs.",
    })
  )
) {}

const decodePackageManifest = Jsonc.bind(PackageManifestJson).decode;
const CONDITION_ORDER = ["bun", "import", "default", "types", "require", "node"] as const;

// Resolves one exports-map value to its target spelling: a string is the target, `null` blocks the
// key, an array falls through to its first resolvable member, and a condition object prefers the
// runtime conditions in `CONDITION_ORDER` before any other key.
const exportTarget = (value: unknown): O.Option<string> => {
  if (P.isString(value)) {
    return O.some(value);
  }
  if (A.isArray(value)) {
    return A.findFirst(value, exportTarget);
  }
  if (P.isObject(value)) {
    const record: Readonly<Record<string, unknown>> = value;
    const keys = A.appendAll(
      A.filter(CONDITION_ORDER, (key) => R.has(record, key)),
      A.filter(R.keys(record), (key) => !A.contains(CONDITION_ORDER, key))
    );
    return A.findFirst(keys, (key) => O.flatMap(R.get(record, key), exportTarget));
  }
  return O.none();
};

const entrypoint = (root: string, key: string, value: unknown): KnowledgePackageEntrypoint =>
  KnowledgePackageEntrypoint.make({
    key,
    target: O.flatMap(
      O.filter(
        exportTarget(value),
        (target) =>
          Str.startsWith("./")(target) &&
          !A.some(
            Str.split("/")(Str.slice(2)(target)),
            (segment) => segment === "." || segment === ".." || segment === "node_modules"
          )
      ),
      (target) => joinRepoPath(root, target)
    ),
  });

const packageEntrypoints = (root: string, exportsValue: unknown): ReadonlyArray<KnowledgePackageEntrypoint> => {
  if (P.isUndefined(exportsValue)) {
    return A.empty();
  }
  if (P.isObject(exportsValue) && !A.isArray(exportsValue)) {
    const record: Readonly<Record<string, unknown>> = exportsValue;
    const subpathKeys = A.filter(R.keys(record), Str.startsWith("."));
    return A.isReadonlyArrayNonEmpty(subpathKeys)
      ? A.map(subpathKeys, (key) => entrypoint(root, key, record[key]))
      : [entrypoint(root, ".", exportsValue)];
  }
  return [entrypoint(root, ".", exportsValue)];
};

const isPackageManifestEntry = (repoPath: string): boolean =>
  repoPath === PACKAGE_MANIFEST || Str.endsWith(`/${PACKAGE_MANIFEST}`)(repoPath);

const readWorkspacePackage = (oracle: KnowledgeTreeOracle, manifestPath: string) =>
  readText(oracle, manifestPath).pipe(
    Effect.flatMap((text) => decodePackageManifest(text).pipe(Effect.option)),
    Effect.map((manifest) =>
      pipe(
        O.flatMap(manifest, (value) => O.fromUndefinedOr(value.name)),
        O.filter(Str.startsWith(WORKSPACE_SCOPE)),
        O.map((name) => {
          const root = dirname(manifestPath);
          return KnowledgeWorkspacePackage.make({
            name,
            manifestPath,
            root,
            entrypoints: packageEntrypoints(
              root,
              O.getOrUndefined(O.flatMap(manifest, (value) => O.fromUndefinedOr(value.exports)))
            ),
          });
        })
      )
    )
  );

// The root manifest's workspace globs, in either the array or the `{ packages }` spelling.
const workspaceGlobs = (value: unknown): ReadonlyArray<string> => {
  const list = P.isObject(value) && !A.isArray(value) ? O.getOrUndefined(R.get(value, "packages")) : value;
  return A.isArray(list) ? A.filter(list, P.isString) : A.empty();
};

const matchesWorkspaceGlob = (directory: string, glob: string): boolean => {
  const segments = Str.split("/")(directory);
  const pattern = Str.split("/")(Str.replace(/^\.\//u, "")(glob));
  return (
    A.length(segments) === A.length(pattern) &&
    A.every(A.zip(segments, pattern), ([segment, part]) => part === "*" || part === segment)
  );
};

const readWorkspaceGlobs = (oracle: KnowledgeTreeOracle, paths: HashSet.HashSet<string>) =>
  readTextIfTracked(oracle, paths, PACKAGE_MANIFEST).pipe(
    Effect.flatMap((text) =>
      O.match(text, {
        onNone: () => Effect.succeedNone,
        onSome: (value) => decodePackageManifest(value).pipe(Effect.option),
      })
    ),
    Effect.map((manifest) =>
      O.filter(
        O.map(
          O.flatMap(manifest, (value) => O.fromUndefinedOr(value.workspaces)),
          workspaceGlobs
        ),
        A.isReadonlyArrayNonEmpty
      )
    )
  );

const isWorkspaceManifest = (globs: O.Option<ReadonlyArray<string>>, manifestPath: string): boolean =>
  manifestPath === PACKAGE_MANIFEST ||
  O.match(globs, {
    onNone: () => true,
    onSome: A.some((glob) => matchesWorkspaceGlob(dirname(manifestPath), glob)),
  });

/**
 * Reads workspace package exports from one immutable tree's regular manifests.
 *
 * **Details**
 * Shared by semantic delta and doctor; callers provide only regular tracked paths.
 * Invalid manifests cannot prove ownership or an export. No runtime or alias resolution runs.
 *
 * **Example** (Prepare an archive-side package query)
 *
 * ```ts
 * import { deriveKnowledgePackages } from "@beep/repo-cli/commands/Knowledge/Knowledge.packages"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 *
 * const packages = deriveKnowledgePackages({
 *   commit: "HEAD",
 *   treeish: "HEAD",
 *   trackedEntries: [],
 *   readBytes: () => Effect.succeed(new Uint8Array())
 * }, HashSet.empty<string>())
 * Effect.runPromise(packages).then(entries => console.log(entries.length)) // 0
 * ```
 *
 * @param oracle - Archive-side tracked bytes and entries.
 * @param paths - Regular tracked paths eligible for manifest reads.
 * @returns Workspace package identities and their export entry points.
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const deriveKnowledgePackages = Effect.fn("KnowledgeDoctorDomain.packages")(function* (
  oracle: KnowledgeTreeOracle,
  paths: HashSet.HashSet<string>
) {
  const globs = yield* readWorkspaceGlobs(oracle, paths);
  const manifests = A.filter(
    oracle.trackedEntries,
    (entry) => isRegularBlob(entry.mode) && isPackageManifestEntry(entry.path) && isWorkspaceManifest(globs, entry.path)
  );
  const forEach1 = yield* Effect.forEach(manifests, (entry) => readWorkspacePackage(oracle, entry.path));
  return A.getSomes(forEach1);
});

const patternTarget = (entry: KnowledgePackageEntrypoint, key: string): O.Option<KnowledgePackageEntrypoint> => {
  const [prefix = "", suffix = ""] = Str.split("*")(entry.key);
  const fits =
    Str.startsWith(prefix)(key) &&
    Str.endsWith(suffix)(key) &&
    Str.length(key) > Str.length(prefix) + Str.length(suffix);
  return fits
    ? O.some(
        KnowledgePackageEntrypoint.make({
          key: entry.key,
          target: O.map(
            entry.target,
            Str.replace("*", Str.slice(Str.length(prefix), Str.length(key) - Str.length(suffix))(key))
          ),
        })
      )
    : O.none();
};

const patternLength = Order.mapInput(Order.Number, (entry: KnowledgePackageEntrypoint) => Str.length(entry.key));

/**
 * Matches a subpath against entry points the way Node resolves `exports`: an exact key first, then
 * the wildcard key with the longest pattern.
 *
 * **Example** (Resolve through a wildcard key)
 *
 * ```ts
 * import { matchKnowledgeEntrypoint } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.evaluators"
 * import { KnowledgePackageEntrypoint } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const entry = matchKnowledgeEntrypoint(
 *   [KnowledgePackageEntrypoint.make({ key: "./commands/*", target: O.some("pkg/src/commands/*\/index.ts") })],
 *   "./commands/Goals"
 * )
 *
 * console.log(O.getOrNull(O.flatMap(entry, (value) => value.target))) // "pkg/src/commands/Goals/index.ts"
 * ```
 *
 * @param entrypoints - Exports-map keys or path aliases of one manifest.
 * @param key - Subpath (`.`, `./Sub`) or full specifier for a path alias.
 * @returns The matched entry point with its target substituted, when one matches.
 * @category predicates
 * @since 0.0.0
 */
export const matchKnowledgeEntrypoint: {
  (key: string): (entrypoints: ReadonlyArray<KnowledgePackageEntrypoint>) => O.Option<KnowledgePackageEntrypoint>;
  (entrypoints: ReadonlyArray<KnowledgePackageEntrypoint>, key: string): O.Option<KnowledgePackageEntrypoint>;
} = dual(
  2,
  (entrypoints: ReadonlyArray<KnowledgePackageEntrypoint>, key: string): O.Option<KnowledgePackageEntrypoint> =>
    O.orElse(
      A.findFirst(entrypoints, (entry) => entry.key === key),
      () =>
        A.head(
          A.sort(
            A.getSomes(
              A.map(
                A.filter(entrypoints, (entry) => Str.includes("*")(entry.key)),
                (entry) => patternTarget(entry, key)
              )
            ),
            Order.flip(patternLength)
          )
        )
    )
);
