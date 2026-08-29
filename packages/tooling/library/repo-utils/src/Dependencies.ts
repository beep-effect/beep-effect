/**
 * Dependency extraction and classification for workspace packages.
 *
 * Reads a decoded `PackageJson` and classifies each dependency as either
 * a workspace-internal dependency (the package name exists in the monorepo)
 * or an external NPM dependency.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { HashSet } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type { PackageJson } from "./schemas/PackageJson.ts";
import type { DependencyRecord, WorkspaceDeps } from "./schemas/WorkspaceDeps.ts";

/**
 * Classify a single dependency record into workspace and npm buckets.
 *
 * @param record - Dependency record keyed by package name.
 * @param workspaceNames - Set of package names that belong to local workspaces.
 * @returns Classified dependency maps for workspace and npm packages.
 */
const classifyRecord = (
  record: PackageJson["dependencies"] | Readonly<Record<string, string>> | undefined,
  workspaceNames: HashSet.HashSet<string>
): { readonly workspace: DependencyRecord; readonly npm: DependencyRecord } => {
  const workspace = R.empty<string, string>();
  const npm = R.empty<string, string>();
  const presentRecord = O.isOption(record) ? (O.isSome(record) ? record.value : undefined) : record;

  if (presentRecord !== undefined) {
    for (const [name, version] of R.toEntries(presentRecord)) {
      if (HashSet.has(workspaceNames, name)) {
        workspace[name] = version;
      } else {
        npm[name] = version;
      }
    }
  }

  return { workspace, npm };
};

/**
 * Extract and classify dependencies from a decoded `PackageJson`.
 *
 * **Details**
 *
 * Each dependency field (`dependencies`, `devDependencies`,
 * `peerDependencies`, `optionalDependencies`) is split into workspace
 * deps (names found in `workspaceNames`) and NPM deps (everything else).
 *
 * **Example** (Classify workspace and NPM deps)
 *
 * ```typescript
 * import { HashSet } from "effect"
 * import * as O from "effect/Option"
 * import { extractWorkspaceDependencies } from "@beep/repo-utils/Dependencies"
 * import { decodePackageJson } from "@beep/repo-utils/schemas/PackageJson"
 *
 * const pkg = decodePackageJson({
 *
 *
 * })
 * const deps = extractWorkspaceDependencies(pkg, HashSet.make("@my/other", "@my/another"))
 * console.log(deps)
 * // deps.workspace.dependencies -> { "@my/other": "workspace:*" }
 * // deps.npm.dependencies -> { "lodash": "^4.0.0" }
 * ```
 *
 * @param packageJson - A decoded PackageJson object.
 * @param workspaceNames - A HashSet of all workspace package names in the monorepo.
 * @returns A `WorkspaceDeps` object with classified dependencies.
 * @category utilities
 * @since 0.0.0
 */
export const extractWorkspaceDependencies: {
  (workspaceNames: HashSet.HashSet<string>): (packageJson: PackageJson) => WorkspaceDeps;
  (packageJson: PackageJson, workspaceNames: HashSet.HashSet<string>): WorkspaceDeps;
} = dual(2, (packageJson: PackageJson, workspaceNames: HashSet.HashSet<string>): WorkspaceDeps => {
  const deps = classifyRecord(packageJson.dependencies, workspaceNames);
  const devDeps = classifyRecord(packageJson.devDependencies, workspaceNames);
  const peerDeps = classifyRecord(packageJson.peerDependencies, workspaceNames);
  const optDeps = classifyRecord(packageJson.optionalDependencies, workspaceNames);

  return {
    packageName: packageJson.name,
    workspace: {
      dependencies: deps.workspace,
      devDependencies: devDeps.workspace,
      peerDependencies: peerDeps.workspace,
      optionalDependencies: optDeps.workspace,
    },
    npm: {
      dependencies: deps.npm,
      devDependencies: devDeps.npm,
      peerDependencies: peerDeps.npm,
      optionalDependencies: optDeps.npm,
    },
  };
});
