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
import { dual } from "effect/Function";
import * as Str from "effect/String";
import { runCaptured } from "../../../../internal/process/StepExec.ts";
import {
  assertNoOrphanDocgenConfigPaths,
  discoverDocgenWorkspacePackages,
  resolveDocgenWorkspacePackage,
} from "../Workspace.ts";
import { byPackagePathAscending } from "./Quality.schemas.ts";
import type * as PlatformError from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { DocgenWorkspacePackage } from "../../Docgen.schemas.ts";
import type { DocgenQualityScopeMode } from "./Quality.schemas.ts";

const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);

const REPO_BASE_CHANGED_FILE_COMMAND = [
  "diff",
  "--name-only",
  "--diff-filter=ACMR",
  "origin/main...HEAD",
  "--",
  "*.ts",
  "*.tsx",
] as const;
const WORKING_TREE_CHANGED_FILE_COMMANDS = [
  ["diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--", "*.ts", "*.tsx"],
  ["ls-files", "--others", "--exclude-standard", "--", "*.ts", "*.tsx"],
] as const;

const runGitLines: {
  (
    repoRoot: string,
    args: readonly string[]
  ): Effect.Effect<string[], DomainError | PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner>;
  (
    args: readonly string[]
  ): (
    repoRoot: string
  ) => Effect.Effect<string[], DomainError | PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  2,
  Effect.fn("DocgenQuality.runGitLines")(function* (repoRoot: string, args: ReadonlyArray<string>) {
    const captured = yield* runCaptured({
      command: "git",
      args,
      cwd: repoRoot,
      source: "stdout",
    });
    if (captured.exitCode !== 0) {
      return yield* DomainError.make({
        message: `git ${A.join(args, " ")} failed with exit code ${captured.exitCode}.`,
      });
    }
    return pipe(Str.split(/\r?\n/)(captured.output), A.map(Str.trim), A.filter(Str.isNonEmpty));
  })
);

const collectWorkingTreeChangedFiles = Effect.fn("DocgenQuality.collectWorkingTreeChangedFiles")(function* (
  repoRoot: string
) {
  const files = yield* Effect.forEach(
    WORKING_TREE_CHANGED_FILE_COMMANDS,
    (args) => runGitLines(repoRoot, args).pipe(Effect.option, Effect.map(O.getOrElse(A.empty<string>))),
    { concurrency: "unbounded" }
  );
  return pipe(A.flatten(files), A.map(normalizeSlashes), A.dedupe);
});

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

  return pipe([...baseChanged, ...workingTreeChanged], A.map(normalizeSlashes), A.dedupe);
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
 * @effects Requires workspace discovery and git state for affected or changed-file scopes.
 * @example
 * ```ts
 * import { FsUtilsLive } from "@beep/repo-utils"
 * import { resolveDocgenQualityTargets } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.scope"
 * import { BunChildProcessSpawner, BunServices } from "@effect/platform-bun"
 * import { Effect, Layer } from "effect"
 * import * as O from "effect/Option"
 *
 * const RuntimeLayer = Layer.mergeAll(BunChildProcessSpawner.layer, FsUtilsLive).pipe(
 *   Layer.provideMerge(BunServices.layer)
 * )
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
