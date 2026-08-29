/**
 * Target and changed-file resolution for `beep docgen quality`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError, findRepoRoot } from "@beep/repo-utils";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, flow, pipe } from "effect";
import * as Str from "effect/String";
import { collectDirtyWorktreeFiles, runGitLines } from "../../../../internal/repo-run/ChangedFiles.ts";
import {
  assertNoOrphanDocgenConfigPaths,
  discoverDocgenWorkspacePackages,
  resolveDocgenWorkspacePackage,
} from "../Workspace.ts";
import { byPackagePathAscending } from "./Quality.schemas.ts";
import type { DocgenWorkspacePackage } from "../../Docgen.schemas.ts";
import type { DocgenQualityScopeMode } from "./Quality.schemas.ts";

const REPO_BASE_CHANGED_FILE_COMMAND = [
  "diff",
  "--name-only",
  "--diff-filter=ACMR",
  "origin/main...HEAD",
  "--",
  "*.ts",
  "*.tsx",
] as const;

// Docgen quality tolerates broken worktree probes: `--changed-files` must still resolve a
// scope in repositories without a HEAD commit, where the `git diff HEAD` probe fails.
const WORKING_TREE_CHANGED_FILE_SCAN = {
  diffArgs: ["--diff-filter=ACMR"],
  pathspecs: ["*.ts", "*.tsx"],
  onProbeFailure: "ignore",
} as const;

const collectWorkingTreeChangedFiles = (repoRoot: string) =>
  collectDirtyWorktreeFiles(repoRoot, WORKING_TREE_CHANGED_FILE_SCAN).pipe(Effect.map(A.dedupe));

const collectChangedFiles = Effect.fn("DocgenQuality.collectChangedFiles")(function* (
  repoRoot: string,
  scope: DocgenQualityScopeMode
) {
  if (scope === "changed-files") {
    return yield* collectWorkingTreeChangedFiles(repoRoot);
  }

  const baseChanged = yield* runGitLines(repoRoot, REPO_BASE_CHANGED_FILE_COMMAND).pipe(
    Effect.mapError(
      DomainError.newCause(
        "Unable to resolve affected docgen quality scope from origin/main...HEAD. Use --changed-files, --all, or --package explicitly, or refresh origin/main."
      )
    )
  );
  const workingTreeChanged = yield* collectWorkingTreeChangedFiles(repoRoot);

  return A.dedupe([...baseChanged, ...workingTreeChanged]);
});

const selectPackagesForFiles = (
  packages: ReadonlyArray<DocgenWorkspacePackage>,
  files: ReadonlyArray<string>
): ReadonlyArray<DocgenWorkspacePackage> =>
  pipe(
    packages,
    A.filter((pkg) => A.some(files, (filePath) => Str.startsWith(`${pkg.relativePath}/`)(filePath))),
    A.sort(byPackagePathAscending)
  );

const countSelectedScopes = (packageSelector: O.Option<string>, all: boolean, changedFiles: boolean): number =>
  (O.isSome(packageSelector) ? 1 : 0) + (all ? 1 : 0) + (changedFiles ? 1 : 0);

/**
 * Resolves `docgen quality` targets using the v1 scope policy.
 *
 * **Example** (Resolve changed-file docgen targets)
 *
 * ```ts
 * import { FsUtilsLive } from "@beep/repo-utils"
 * import { resolveDocgenQualityTargets } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.scope"
 * import { BunServices } from "@effect/platform-bun"
 * import { Effect, Layer } from "effect"
 * import * as O from "effect/Option"
 *
 * const RuntimeLayer = FsUtilsLive.pipe(Layer.provideMerge(BunServices.layer))
 *
 * const program = Effect.gen(function* () {
 *   const targets = yield* resolveDocgenQualityTargets({
 *     all: false,
 *     changedFiles: true,
 *     packageSelector: O.none()
 *   })
 *   return `${targets.scope}: ${targets.targets.length} packages`
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(RuntimeLayer))).then(console.log)
 * ```
 *
 * @effects Requires workspace discovery and git state for affected or changed-file scopes.
 * @category workflows
 * @since 0.0.0
 */
export const resolveDocgenQualityTargets = Effect.fn("DocgenQuality.resolveDocgenQualityTargets")(function* ({
  all,
  changedFiles,
  packageSelector,
}: {
  readonly all: boolean;
  readonly changedFiles: boolean;
  readonly packageSelector: O.Option<string>;
}) {
  yield* assertNoOrphanDocgenConfigPaths();

  if (countSelectedScopes(packageSelector, all, changedFiles) > 1) {
    return yield* DomainError.make({
      message: "Choose only one docgen quality scope: --package, --all, or --changed-files.",
    });
  }

  if (O.isSome(packageSelector)) {
    return {
      scope: "package" as const,
      targets: [yield* resolveDocgenWorkspacePackage(packageSelector.value)] as const,
    };
  }

  const configuredPackages = yield* discoverDocgenWorkspacePackages().pipe(
    Effect.map(
      flow(
        A.filter((pkg: DocgenWorkspacePackage) => pkg.hasDocgenConfig),
        A.sort(byPackagePathAscending)
      )
    )
  );

  if (all) {
    return {
      scope: "all" as const,
      targets: configuredPackages,
    };
  }

  const repoRoot = yield* findRepoRoot();
  const scope: DocgenQualityScopeMode = changedFiles ? "changed-files" : "affected";
  const changed = yield* collectChangedFiles(repoRoot, scope);

  return {
    scope,
    targets: selectPackagesForFiles(configuredPackages, changed),
  };
});
