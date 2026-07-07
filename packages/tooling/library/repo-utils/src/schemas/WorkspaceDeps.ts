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
import * as S from "effect/Schema";
import { NonEmptyStringValue, NpmPackageName, RepoPackageName } from "./PackageJson.js";

const $I = $RepoUtilsId.create("schemas/WorkspaceDeps");

/**
 * A record mapping package names to version specifiers.
 *
 * @example
 * ```ts
 * import { DependencyRecord } from "@beep/repo-utils/schemas/WorkspaceDeps"
 * const isRecord = DependencyRecord
 * console.log(isRecord)
 * ```
 * @category models
 * @since 0.0.0
 */
export const DependencyRecord = S.Record(NpmPackageName, NonEmptyStringValue).pipe(
  $I.annoteSchema("DependencyRecord", {
    description: "A mapping of npm-compatible dependency package names to non-empty version specifiers.",
  })
);

/**
 * A record mapping package names to version specifiers.
 *
 * @example
 * ```ts
 * import type { DependencyRecord } from "@beep/repo-utils/schemas/WorkspaceDeps"
 * const deps: DependencyRecord = {
 *   effect: "^4.0.0"
 * }
 * console.log(deps)
 * ```
 * @category models
 * @since 0.0.0
 */
export type DependencyRecord = typeof DependencyRecord.Type;

class WorkspaceDependencyBuckets extends S.Class<WorkspaceDependencyBuckets>($I`WorkspaceDependencyBuckets`)(
  {
    dependencies: DependencyRecord.annotateKey({
      description: "Runtime dependency package names mapped to version specifiers.",
    }),
    devDependencies: DependencyRecord.annotateKey({
      description: "Development dependency package names mapped to version specifiers.",
    }),
    peerDependencies: DependencyRecord.annotateKey({
      description: "Peer dependency package names mapped to version specifiers.",
    }),
    optionalDependencies: DependencyRecord.annotateKey({
      description: "Optional dependency package names mapped to version specifiers.",
    }),
  },
  $I.annote("WorkspaceDependencyBuckets", {
    description: "Dependency buckets grouped by dependency kind for either workspace or npm references.",
  })
) {}

/**
 * Classified dependencies for a single workspace package.
 *
 * Dependencies are separated into workspace-internal and external (NPM)
 * categories, each further divided by dependency type (runtime, dev, peer,
 * optional).
 *
 * @example
 * ```ts
 * import { emptyWorkspaceDeps } from "@beep/repo-utils/schemas/WorkspaceDeps"
 * const deps = emptyWorkspaceDeps("@beep/example")
 * console.log(deps.packageName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class WorkspaceDeps extends S.Class<WorkspaceDeps>($I`WorkspaceDeps`)(
  {
    npm: WorkspaceDependencyBuckets.annotateKey({
      description: "External npm dependency buckets for this workspace.",
    }),
    packageName: RepoPackageName.annotateKey({
      description: "Workspace package name these dependencies belong to.",
    }),
    workspace: WorkspaceDependencyBuckets.annotateKey({
      description: "Workspace-local dependency buckets for this package.",
    }),
  },
  $I.annote("WorkspaceDeps", {
    description:
      "Classified dependencies for a workspace package, split into workspace-local and external npm buckets.",
  })
) {}

/**
 * Create an empty WorkspaceDeps for a given package name.
 *
 * @param packageName - Package name to initialize.
 * @returns Empty dependency structure for the package.
 * @example
 * ```ts
 * import { emptyWorkspaceDeps } from "@beep/repo-utils/schemas/WorkspaceDeps"
 * const deps = emptyWorkspaceDeps("@beep/example")
 * console.log(deps.workspace.dependencies)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const emptyWorkspaceDeps = (packageName: string): WorkspaceDeps =>
  WorkspaceDeps.make({
    packageName,
    workspace: WorkspaceDependencyBuckets.make({
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    }),
    npm: WorkspaceDependencyBuckets.make({
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    }),
  });
