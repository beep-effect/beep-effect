/**
 * Unique NPM dependency aggregation across the entire monorepo.
 *
 * Collects all external (non-workspace) dependencies from every workspace
 * package and the root, deduplicates them, and returns sorted arrays of
 * unique dependency names.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Effect, flow, MutableHashSet, Order, Struct } from "effect";
import * as S from "effect/Schema";
import { buildRepoDependencyIndex } from "./DependencyIndex.ts";
import { NpmPackageName } from "./schemas/PackageJson.ts";
import type { DomainError, NoSuchFileError } from "./errors/index.ts";
import type { FsUtils } from "./FsUtils.ts";

const $I = $RepoUtilsId.create("UniqueDeps");
const sameNpmPackageName = S.toEquivalence(NpmPackageName);
const UniqueNpmPackageNames = S.Array(NpmPackageName)
  .check(
    S.makeFilter(
      (values: ReadonlyArray<NpmPackageName>) =>
        A.length(A.dedupeWith(sameNpmPackageName)(values)) === A.length(values),
      {
        identifier: $I`UniqueNpmPackageNamesUniqueItemsCheck`,
        title: "Unique NPM Package Names",
        description: "Unique NPM dependency name arrays must not contain duplicate package names.",
        message: "Dependency names must be unique.",
      }
    )
  )
  .pipe(
    $I.annoteSchema("UniqueNpmPackageNames", {
      description: "Sorted unique npm package names aggregated from workspace package manifests.",
    })
  );

/**
 * Result of collecting unique NPM dependencies across the monorepo.
 *
 * **Example** (Create UniqueNpmDeps instance)
 *
 * ```ts
 * import { UniqueNpmDeps } from "@beep/repo-utils/UniqueDeps"
 * const deps = UniqueNpmDeps.make({
 *   dependencies: ["effect"],
 *   devDependencies: ["vitest"]
 * })
 * console.log(deps.dependencies)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UniqueNpmDeps extends S.Class<UniqueNpmDeps>($I`UniqueNpmDeps`)(
  {
    dependencies: UniqueNpmPackageNames.annotateKey({
      description: "Sorted unique runtime npm dependency names.",
    }),
    devDependencies: UniqueNpmPackageNames.annotateKey({
      description: "Sorted unique development npm dependency names.",
    }),
  },
  $I.annote("UniqueNpmDeps", {
    description: "Sorted runtime and development dependency names aggregated across the monorepo.",
  })
) {}

/**
 * Collect all unique external NPM dependency names from every package
 * in the monorepo.
 *
 * **Details**
 *
 * Scans all workspace packages plus the root, extracts their NPM
 * (non-workspace) dependencies and devDependencies, deduplicates,
 * and returns sorted arrays.
 *
 * Peer and optional dependencies are folded into their respective
 * categories: peerDependencies are counted as runtime `dependencies`
 * and optionalDependencies are also counted as runtime `dependencies`.
 *
 * **Example** (Collect monorepo NPM dependencies)
 *
 * ```ts
 * import { collectUniqueNpmDependencies } from "@beep/repo-utils/UniqueDeps"
 * const program = collectUniqueNpmDependencies(process.cwd())
 * console.log(program)
 * ```
 *
 * @param rootDir - Absolute path to the monorepo root directory.
 * @returns An object with sorted, deduplicated dependencies and devDependencies.
 * @category utilities
 * @since 0.0.0
 */
export const collectUniqueNpmDependencies: (
  rootDir: string
) => Effect.Effect<UniqueNpmDeps, NoSuchFileError | DomainError, FsUtils> = Effect.fn(function* (rootDir) {
  const index = yield* buildRepoDependencyIndex(rootDir);

  const depsSet = MutableHashSet.empty<string>();
  const devDepsSet = MutableHashSet.empty<string>();

  for (const [_name, workspaceDeps] of index) {
    // Runtime dependencies
    for (const depName of Struct.keys(workspaceDeps.npm.dependencies)) {
      MutableHashSet.add(depsSet, depName);
    }
    // Peer dependencies count as runtime
    for (const depName of Struct.keys(workspaceDeps.npm.peerDependencies)) {
      MutableHashSet.add(depsSet, depName);
    }
    // Optional dependencies count as runtime
    for (const depName of Struct.keys(workspaceDeps.npm.optionalDependencies)) {
      MutableHashSet.add(depsSet, depName);
    }
    // Dev dependencies
    for (const depName of Struct.keys(workspaceDeps.npm.devDependencies)) {
      MutableHashSet.add(devDepsSet, depName);
    }
  }

  return UniqueNpmDeps.make({
    dependencies: sortHashSet(depsSet),
    devDependencies: sortHashSet(devDepsSet),
  });
});

const sortHashSet: (set: MutableHashSet.MutableHashSet<string>) => ReadonlyArray<string> = flow(
  A.fromIterable,
  A.sort(Order.String)
);
