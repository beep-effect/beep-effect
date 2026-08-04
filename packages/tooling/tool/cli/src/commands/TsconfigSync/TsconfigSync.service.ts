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
import { TsconfigSyncCycleError, TsconfigSyncDriftError } from "./TsconfigSync.errors.ts";
import { TsconfigSyncPlan } from "./TsconfigSync.plan.ts";
import { TsconfigSyncRender } from "./TsconfigSync.render.ts";
import { TsconfigSyncModeMatch, TsconfigSyncResult, tsconfigSyncModeEquivalence } from "./TsconfigSync.schemas.ts";
import type { CyclicDependencyError, DomainError, FsUtils, NoSuchFileError } from "@beep/repo-utils";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import type { TsconfigSyncFilterError } from "./TsconfigSync.errors.ts";
import type { PlannedFileChange, TsconfigSyncRunOptions } from "./TsconfigSync.schemas.ts";

const {
  buildAdjacency,
  buildWorkspaceDescriptors,
  planPackageDocgenSync,
  planPackageReferenceSync,
  planRootAliasSync,
  planRootReferenceSync,
  planRootSyncpackSync,
  sortChanges,
  toReportedChange,
  writeFileString,
} = TsconfigSyncPlan;
const { renderChanges } = TsconfigSyncRender;

/**
 * Errors raised by the tsconfig-sync programmatic API.
 *
 * **Example** (Run the tsconfig-sync service)
 *
 * ```ts
 * import type { TsconfigSyncError } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * type Handled = TsconfigSyncError
 * ```
 *
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
 * **Example** (Run the tsconfig-sync service)
 *
 * ```ts
 * import { syncTsconfigAtRoot, TsconfigSyncRunOptions } from "@beep/repo-cli/commands/TsconfigSync"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const options = S.decodeUnknownSync(TsconfigSyncRunOptions)({ mode: "check", verbose: false })
 * // Build the sync effect for a repo root; provide FileSystem/Path/FsUtils to run it.
 * const program = syncTsconfigAtRoot("/repo", options)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param rootDir - Absolute repository root directory.
 * @param options - Mode and logging options.
 * @returns Summary of planned/applied changes.
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
    const rootSyncpackChange = yield* planRootSyncpackSync(rootDir);
    A.appendAllInPlace(plannedChanges, A.getSomes([rootReferenceChange, rootAliasChange, rootSyncpackChange]));

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
