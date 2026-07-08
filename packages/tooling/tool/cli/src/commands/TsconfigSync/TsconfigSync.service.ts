/**
 * Programmatic tsconfig-sync service entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { buildRepoDependencyIndex, detectCycles } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { Effect } from "effect";
import { dual } from "effect/Function";
import { TsconfigSyncCycleError, TsconfigSyncDriftError } from "./TsconfigSync.errors.js";
import { TsconfigSyncPlan } from "./TsconfigSync.plan.js";
import { TsconfigSyncRender } from "./TsconfigSync.render.js";
import { TsconfigSyncModeMatch, TsconfigSyncResult, tsconfigSyncModeEquivalence } from "./TsconfigSync.schemas.js";
import type { CyclicDependencyError, DomainError, FsUtils, NoSuchFileError } from "@beep/repo-utils";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import type { TsconfigSyncFilterError } from "./TsconfigSync.errors.js";
import type { PlannedFileChange, TsconfigSyncRunOptions } from "./TsconfigSync.schemas.js";

const {
  buildAdjacency,
  buildWorkspaceDescriptors,
  planPackageDocgenSync,
  planPackageReferenceSync,
  planRootAliasSync,
  planRootReferenceSync,
  planRootSyncpackSync,
  planRootTstycheSync,
  sortChanges,
  toReportedChange,
  writeFileString,
} = TsconfigSyncPlan;
const { renderChanges } = TsconfigSyncRender;

/**
 * Errors raised by the tsconfig-sync programmatic API.
 *
 * @example
 * ```ts
 * import type { TsconfigSyncError } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * type Handled = TsconfigSyncError
 * ```
 * @category errors
 * @since 0.0.0
 */
export type TsconfigSyncError =
  | DomainError
  | NoSuchFileError
  | CyclicDependencyError
  | TsconfigSyncCycleError
  | TsconfigSyncDriftError
  | TsconfigSyncFilterError;
/**
 * Synchronize tsconfig references and root aliases under a specific repository root.
 *
 * @param rootDir - Absolute repository root directory.
 * @param options - Mode and logging options.
 * @returns Summary of planned/applied changes.
 * @example
 * ```ts
 * import { syncTsconfigAtRoot } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(syncTsconfigAtRoot)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const syncTsconfigAtRoot: {
  (
    rootDir: string,
    options: TsconfigSyncRunOptions
  ): Effect.Effect<
    TsconfigSyncResult,
    TsconfigSyncError,
    FileSystem.FileSystem | Path.Path | FsUtils | ChildProcessSpawner
  >;
  (
    options: TsconfigSyncRunOptions
  ): (
    rootDir: string
  ) => Effect.Effect<
    TsconfigSyncResult,
    TsconfigSyncError,
    FileSystem.FileSystem | Path.Path | FsUtils | ChildProcessSpawner
  >;
} = dual(
  2,
  Effect.fn(function* (rootDir: string, options: TsconfigSyncRunOptions) {
    const workspaces = yield* buildWorkspaceDescriptors(rootDir);
    const depIndex = yield* buildRepoDependencyIndex(rootDir);

    const adjacency = buildAdjacency(depIndex);
    const cycles = yield* detectCycles(adjacency);

    if (!A.isReadonlyArrayEmpty(cycles)) {
      return yield* TsconfigSyncCycleError.new(
        A.map(cycles, (cycle) => [...cycle]),
        `Detected ${cycles.length} workspace dependency cycle(s)`
      );
    }

    const plannedChanges = A.empty<PlannedFileChange>();

    const rootReferenceChange = yield* planRootReferenceSync(rootDir, workspaces);
    const rootAliasChange = yield* planRootAliasSync(rootDir, workspaces);
    const rootTstycheChange = yield* planRootTstycheSync(rootDir, workspaces);
    const rootSyncpackChange = yield* planRootSyncpackSync(rootDir);
    A.appendAllInPlace(
      plannedChanges,
      A.getSomes([rootReferenceChange, rootAliasChange, rootTstycheChange, rootSyncpackChange])
    );

    const packageChanges = yield* planPackageReferenceSync(
      rootDir,
      workspaces,
      depIndex,
      adjacency,
      options.filter,
      options.verbose
    );
    A.appendAllInPlace(plannedChanges, packageChanges);

    const docgenChanges = yield* planPackageDocgenSync(rootDir, workspaces, options.filter);
    A.appendAllInPlace(plannedChanges, docgenChanges);

    const sortedPlannedChanges = sortChanges(plannedChanges);

    if (tsconfigSyncModeEquivalence(options.mode, "sync")) {
      yield* Effect.forEach(sortedPlannedChanges, (change) => writeFileString(change.filePath, change.content), {
        discard: true,
      });
    }

    const reportedChanges = A.map(sortedPlannedChanges, toReportedChange);
    yield* renderChanges(rootDir, options.mode, reportedChanges);

    if (tsconfigSyncModeEquivalence(options.mode, "check") && !A.isArrayEmpty(reportedChanges)) {
      return yield* TsconfigSyncDriftError.new(
        reportedChanges.length,
        `Run "beep tsconfig-sync" to apply ${reportedChanges.length} change(s).`
      );
    }

    const result: TsconfigSyncResult = TsconfigSyncModeMatch(options.mode, {
      sync: () =>
        TsconfigSyncResult.cases.sync.make({
          mode: "sync",
          changedFiles: A.length(reportedChanges),
          changes: reportedChanges,
        }),
      check: () =>
        TsconfigSyncResult.cases.check.make({
          mode: "check",
          changedFiles: A.length(reportedChanges),
          changes: reportedChanges,
        }),
      "dry-run": () =>
        TsconfigSyncResult.cases["dry-run"].make({
          mode: "dry-run",
          changedFiles: A.length(reportedChanges),
          changes: reportedChanges,
        }),
    });
    return result;
  })
);
