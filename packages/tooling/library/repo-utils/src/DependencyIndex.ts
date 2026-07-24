/**
 * Dependency index for the entire monorepo.
 *
 * Builds a complete mapping of every workspace package (plus the root)
 * to its classified dependencies (workspace vs NPM).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { thunkEffectSucceedNull } from "@beep/utils";
import { Effect, HashMap, HashSet } from "effect";
import * as O from "effect/Option";
import { extractWorkspaceDependencies } from "./Dependencies.ts";
import { DomainError } from "./errors/index.ts";
import { FsUtils } from "./FsUtils.ts";
import { decodePackageJsonEffect } from "./schemas/PackageJson.ts";
import { resolveWorkspaceDirs } from "./Workspaces.ts";
import type { NoSuchFileError } from "./errors/index.ts";
import type { WorkspaceDeps } from "./schemas/WorkspaceDeps.ts";

/**
 * The root package identifier used in the returned HashMap.
 *
 * @category configuration
 * @since 0.0.0
 */
const ROOT_KEY = "@beep/root";

/**
 * Build a complete dependency index for the entire monorepo.
 *
 * For every workspace package and the root, reads its `package.json`,
 * classifies each dependency as workspace-internal or external NPM,
 * and returns a HashMap mapping each package name to its `WorkspaceDeps`.
 *
 * The root directory is indexed under `"@beep/root"`.
 *
 * @param rootDir - Absolute path to the monorepo root directory.
 * @returns A HashMap mapping package names to their classified dependencies.
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { buildRepoDependencyIndex } from "@beep/repo-utils/DependencyIndex"
 *
 * const program = buildRepoDependencyIndex(".")
 * console.log(program)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const buildRepoDependencyIndex: (
  rootDir: string
) => Effect.Effect<HashMap.HashMap<string, WorkspaceDeps>, NoSuchFileError | DomainError, FsUtils> = Effect.fn(
  function* (rootDir) {
    const fsUtils = yield* FsUtils;
    const workspaces = yield* resolveWorkspaceDirs(rootDir);

    // Build a HashSet of all workspace package names
    let workspaceNames = HashSet.empty<string>();
    for (const [name] of workspaces) {
      workspaceNames = HashSet.add(workspaceNames, name);
    }

    let result = HashMap.empty<string, WorkspaceDeps>();

    // Process root package.json
    const rootPkgPath = `${rootDir}/package.json`;
    const rawRootPkg = yield* fsUtils.readJson(rootPkgPath);
    if (O.isNone(rawRootPkg)) {
      return yield* DomainError.newMessage(`Failed to parse JSON at "${rootPkgPath}"`);
    }
    const rootPkg = yield* decodePackageJsonEffect(rawRootPkg.value).pipe(
      Effect.mapError(DomainError.newCause(`Failed to decode root package.json at "${rootPkgPath}"`))
    );
    const rootDeps = extractWorkspaceDependencies(rootPkg, workspaceNames);
    result = HashMap.set(result, ROOT_KEY, { ...rootDeps, packageName: ROOT_KEY });

    // Process each workspace package.json
    for (const [name, dir] of workspaces) {
      const pkgPath = `${dir}/package.json`;
      const rawPkg = yield* fsUtils.readJson(pkgPath).pipe(Effect.catchTag("NoSuchFileError", thunkEffectSucceedNull));
      if (rawPkg === null) {
        continue;
      }
      if (O.isNone(rawPkg)) {
        return yield* DomainError.newMessage(`Failed to parse JSON at "${pkgPath}"`);
      }
      const pkg = yield* decodePackageJsonEffect(rawPkg.value).pipe(
        Effect.mapError(DomainError.newCause(`Failed to decode package.json at "${pkgPath}"`))
      );
      const deps = extractWorkspaceDependencies(pkg, workspaceNames);
      result = HashMap.set(result, name, deps);
    }

    return result;
  }
);
