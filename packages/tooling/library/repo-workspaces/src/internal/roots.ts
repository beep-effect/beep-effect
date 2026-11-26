import { $RepoWorkspacesId } from "@beep/identity/packages";
import { ResolvedPackage } from "@beep/lockfiles/ResolvedPackage";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { Lockfile } from "@beep/lockfiles";

const $I = $RepoWorkspacesId.create("internal/roots");

const OwnImporterRoots = S.TaggedStruct("own", {
  instance: ResolvedPackage.pipe(
    $I.annoteKey("OwnImporterRoots.instance", {
      description: "The workspace instance whose edges are the importer's dependencies.",
    })
  ),
}).pipe($I.annoteSchema("OwnImporterRoots", { description: "An importer's own workspace instance." }));

const DependencyImporterRoots = S.TaggedStruct("dependencies", {
  instances: S.Array(ResolvedPackage).pipe(
    $I.annoteKey("DependencyImporterRoots.instances", {
      description: "Resolved dependency instances in importer dependency order.",
    })
  ),
}).pipe($I.annoteSchema("DependencyImporterRoots", { description: "An importer's resolved dependency instances." }));

/**
 * The two lookups every walk needs, built once per lockfile.
 *
 * @category models
 * @since 0.0.0
 */
export interface InstanceIndex {
  /** Every instance by its `instanceId`. */
  readonly byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>;
  /** Workspace rows by the importer path they stand for. */
  readonly workspaceByPath: MutableHashMap.MutableHashMap<string, ResolvedPackage>;
}

/**
 * Builds the instance-id and workspace-importer lookups used by lockfile walks.
 *
 * **Details**
 *
 * Every package is indexed by its opaque `instanceId`. Only workspace packages
 * with a `relativePath` enter the importer-path lookup.
 *
 * **Example** (Index an empty lockfile)
 *
 * ```ts
 * import { indexInstances } from "@beep/repo-workspaces/internal/roots";
 * import { Lockfile } from "@beep/lockfiles/Lockfile";
 * import * as MutableHashMap from "effect/MutableHashMap";
 *
 * const lockfile = Lockfile.make({
 *   format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: []
 * });
 * const index = indexInstances(lockfile);
 * console.log(MutableHashMap.size(index.byId)); // 0
 * console.log(MutableHashMap.size(index.workspaceByPath)); // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const indexInstances = (lockfile: Lockfile): InstanceIndex => {
  const byId = MutableHashMap.fromIterable(A.map(lockfile.packages, (pkg) => [pkg.instanceId, pkg] as const));
  const workspaceByPath = MutableHashMap.empty<string, ResolvedPackage>();
  for (const pkg of lockfile.packages) {
    if (pkg.isWorkspace && pkg.relativePath !== undefined) MutableHashMap.set(workspaceByPath, pkg.relativePath, pkg);
  }
  return { byId, workspaceByPath };
};

/**
 * **Details**
 *
 * - `"own"` — the lockfile records a workspace row for the importer. The row
 *   carries both its declared peers (npm, bun) and its resolved edges, so it is
 *   the walk's first node and its edges ARE the importer's dependencies.
 * - `"dependencies"` — no row (the root under every format, and any importer
 *   whose row the lockfile omits); the instances are what the importer entry's
 *   own dependency records joined to.
 *
 * **Example** (Check plain dependency roots)
 *
 * ```ts
 * import { ImporterRoots } from "@beep/repo-workspaces/internal/roots";
 * import * as S from "effect/Schema";
 *
 * const roots: ImporterRoots = { _tag: "dependencies", instances: [] };
 * console.log(S.is(ImporterRoots)(roots)); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImporterRoots = S.Union([OwnImporterRoots, DependencyImporterRoots]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ImporterRoots", { description: "Where an importer's lockfile walk starts." })
);

/**
 * The plain-object own/dependencies variants described by {@link ImporterRoots}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ImporterRoots = typeof ImporterRoots.Type;

/**
 * The instances an importer's dependencies resolved to, or the importer's own
 * workspace row when the lockfile records one.
 *
 * **Gotchas**
 *
 * Returns `undefined` when the importer cannot be resolved at all, which every
 * caller reports rather than treating as "no problems here".
 *
 * **Example** (Distinguish a dependency-free importer from a missing importer)
 *
 * ```ts
 * import { indexInstances, rootInstances } from "@beep/repo-workspaces/internal/roots";
 * import { Lockfile } from "@beep/lockfiles/Lockfile";
 * import { LockfileImporter } from "@beep/lockfiles/LockfileImporter";
 *
 * const lockfile = Lockfile.make({
 *   format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [],
 *   importers: [LockfileImporter.make({ path: ".", dependencies: [] })]
 * });
 * const index = indexInstances(lockfile);
 * console.log(rootInstances(lockfile, ".", index)?._tag); // dependencies
 * console.log(rootInstances("missing", index)(lockfile)); // undefined
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const rootInstances: {
  (importerPath: string, index: InstanceIndex): (lockfile: Lockfile) => ImporterRoots | undefined;
  (lockfile: Lockfile, importerPath: string, index: InstanceIndex): ImporterRoots | undefined;
} = dual(3, (lockfile: Lockfile, importerPath: string, index: InstanceIndex): ImporterRoots | undefined => {
  const own = MutableHashMap.get(index.workspaceByPath, importerPath);
  if (O.isSome(own)) return { _tag: "own", instance: own.value };

  const importer = lockfile.importer(importerPath);
  if (importer._tag === "None") return undefined;

  const instances = A.getSomes(A.map(importer.value.dependencies, (dep) => composedThenVerifiedInstance(index, dep)));

  const everyDependencyFailedToJoin = instances.length === 0 && importer.value.dependencies.length > 0;
  if (everyDependencyFailedToJoin) return undefined;
  return { _tag: "dependencies", instances };
});

const composedThenVerifiedInstance = (
  index: InstanceIndex,
  dep: { readonly name: string; readonly version?: string | undefined; readonly peerSuffix?: string | undefined }
): O.Option<ResolvedPackage> =>
  dep.version === undefined
    ? O.none()
    : MutableHashMap.get(index.byId, `${dep.name}@${dep.version}${dep.peerSuffix ?? ""}`);
