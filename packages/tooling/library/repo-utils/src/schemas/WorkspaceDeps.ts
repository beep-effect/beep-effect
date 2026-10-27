/**
 * Schema and types for classified workspace dependencies.
 *
 * Dependencies are split into workspace-internal dependencies (packages
 * that live within the monorepo) and external NPM dependencies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { NonEmptyStringValue, RepoPackageName } from "./PackageJson.ts";

const $I = $RepoUtilsId.create("schemas/WorkspaceDeps");

/**
 * A map from dependency package names to version specifiers.
 *
 * **Example** (Check a dependency map value)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import * as S from "effect/Schema"
 * import { DependencyMap } from "@beep/repo-utils/schemas/WorkspaceDeps"
 *
 * console.log(S.is(DependencyMap)(HashMap.make(["effect", "^4.0.0"]))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DependencyMap = S.HashMap(RepoPackageName, NonEmptyStringValue).pipe(
  $I.annoteSchema("DependencyMap", {
    description: "A HashMap of repo dependency package names to non-empty version specifiers.",
  })
);

/**
 * A map from dependency package names to version specifiers.
 *
 * **Example** (Type a dependency map)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import type { DependencyMap } from "@beep/repo-utils/schemas/WorkspaceDeps"
 *
 * const deps: DependencyMap = HashMap.make(["effect", "^4.0.0"])
 * console.log(HashMap.size(deps)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DependencyMap = typeof DependencyMap.Type;

/**
 * Runtime dependency package names mapped to version specifiers.
 *
 * @category models
 * @since 0.0.0
 */
class WorkspaceDependencyBuckets extends S.Opaque<WorkspaceDependencyBuckets, { readonly brand: unique symbol }>()(
  S.Struct({
    dependencies: DependencyMap.annotateKey({
      description: "Runtime dependency package names mapped to version specifiers.",
    }),
    devDependencies: DependencyMap.annotateKey({
      description: "Development dependency package names mapped to version specifiers.",
    }),
    peerDependencies: DependencyMap.annotateKey({
      description: "Peer dependency package names mapped to version specifiers.",
    }),
    optionalDependencies: DependencyMap.annotateKey({
      description: "Optional dependency package names mapped to version specifiers.",
    }),
  }).pipe(
    $I.annoteSchema("WorkspaceDependencyBuckets", {
      description: "Dependency buckets grouped by dependency kind for either workspace or npm references.",
    })
  )
) {}

/**
 * Classified dependencies for a single workspace package.
 *
 * **Details**
 *
 * Dependencies are separated into workspace-internal and external (NPM)
 * categories, each further divided by dependency type (runtime, dev, peer,
 * optional).
 *
 * **Example** (Create empty workspace deps)
 *
 * ```ts
 * import { emptyWorkspaceDeps } from "@beep/repo-utils/schemas/WorkspaceDeps"
 * const deps = emptyWorkspaceDeps("@beep/example")
 * console.log(deps.packageName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkspaceDeps extends S.Opaque<WorkspaceDeps, { readonly brand: unique symbol }>()(
  S.Struct({
    npm: WorkspaceDependencyBuckets.annotateKey({
      description: "External npm dependency buckets for this workspace.",
    }),
    packageName: RepoPackageName.annotateKey({
      description: "Workspace package name these dependencies belong to.",
    }),
    workspace: WorkspaceDependencyBuckets.annotateKey({
      description: "Workspace-local dependency buckets for this package.",
    }),
  }).pipe(
    $I.annoteSchema("WorkspaceDeps", {
      description:
        "Classified dependencies for a workspace package, split into workspace-local and external npm buckets.",
    })
  )
) {}

/**
 * Create an empty WorkspaceDeps for a given package name.
 *
 * **Example** (Initialize empty deps structure)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import { emptyWorkspaceDeps } from "@beep/repo-utils/schemas/WorkspaceDeps"
 * const deps = emptyWorkspaceDeps("@beep/example")
 * console.log(HashMap.isEmpty(deps.workspace.dependencies)) // true
 * ```
 *
 * @param packageName - Package name to initialize.
 * @returns Empty dependency structure for the package.
 * @category constructors
 * @since 0.0.0
 */
export const emptyWorkspaceDeps = (packageName: string): WorkspaceDeps =>
  WorkspaceDeps.make({
    packageName,
    workspace: WorkspaceDependencyBuckets.make({
      dependencies: HashMap.empty(),
      devDependencies: HashMap.empty(),
      peerDependencies: HashMap.empty(),
      optionalDependencies: HashMap.empty(),
    }),
    npm: WorkspaceDependencyBuckets.make({
      dependencies: HashMap.empty(),
      devDependencies: HashMap.empty(),
      peerDependencies: HashMap.empty(),
      optionalDependencies: HashMap.empty(),
    }),
  });
