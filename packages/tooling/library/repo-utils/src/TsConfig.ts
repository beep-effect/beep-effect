/**
 * TypeScript configuration file discovery for monorepo workspaces.
 *
 * Scans each workspace (and the root) for `tsconfig*.json` files and
 * returns a mapping of package names to their tsconfig file paths.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import { FsUtils, GlobOptions } from "./FsUtils.ts";
import type { DomainError } from "./errors/index.ts";

/**
 * The root package identifier used in the returned HashMap.
 *
 * @category configuration
 * @since 0.0.0
 */
const ROOT_KEY = "@beep/root";

const IGNORED_TSCONFIG_DIRS = ["**/ci-runners/sdks/**"];

/**
 * Collect all `tsconfig*.json` file paths for each workspace and the root.
 *
 * **Details**
 *
 * For every workspace package named in `workspaceDirs` (plus the monorepo
 * root), this function globs for files matching `tsconfig*.json` and returns
 * a HashMap mapping each package name to its array of tsconfig paths. The
 * caller supplies the workspace directories (repo-cli reads them from
 * `@beep/repo-workspaces` `WorkspaceDiscovery`).
 *
 * The root directory is indexed under `"@beep/root"`.
 *
 * **Example** (Collect workspace tsconfig paths)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
 * import * as HashMap from "effect/HashMap";
 * import { collectTsConfigPaths } from "@beep/repo-utils/TsConfig"
 *
 * const program = collectTsConfigPaths("/repo", HashMap.make(["@beep/utils", "/repo/packages/utils"]))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param rootDir - Absolute path to the monorepo root directory.
 * @param workspaceDirs - Each workspace package's absolute directory, keyed by package name.
 * @returns A HashMap mapping package names to arrays of tsconfig file paths.
 * @category utilities
 * @since 0.0.0
 */
export const collectTsConfigPaths: {
  (
    rootDir: string,
    workspaceDirs: HashMap.HashMap<string, string>
  ): Effect.Effect<HashMap.HashMap<string, ReadonlyArray<string>>, DomainError, FsUtils>;
  (
    workspaceDirs: HashMap.HashMap<string, string>
  ): (rootDir: string) => Effect.Effect<HashMap.HashMap<string, ReadonlyArray<string>>, DomainError, FsUtils>;
} = dual(
  2,
  Effect.fn(function* (rootDir: string, workspaceDirs: HashMap.HashMap<string, string>) {
    const fsUtils = yield* FsUtils;

    let result = HashMap.empty<string, ReadonlyArray<string>>();

    // Collect tsconfig files for root
    const rootConfigs = yield* fsUtils.globFiles(
      "tsconfig*.json",
      GlobOptions.make({
        cwd: rootDir,
        absolute: true,
        ignore: IGNORED_TSCONFIG_DIRS,
      })
    );
    if (rootConfigs.length > 0) {
      result = HashMap.set(result, ROOT_KEY, rootConfigs);
    }

    // Collect tsconfig files for each workspace
    for (const [name, dir] of workspaceDirs) {
      const configs = yield* fsUtils.globFiles(
        "tsconfig*.json",
        GlobOptions.make({
          cwd: dir,
          absolute: true,
          ignore: IGNORED_TSCONFIG_DIRS,
        })
      );
      if (configs.length > 0) {
        result = HashMap.set(result, name, configs);
      }
    }

    return result;
  })
);
