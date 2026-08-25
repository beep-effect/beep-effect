/**
 * Tagged errors for the TsconfigSync command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/TsconfigSync/TsconfigSync.errors");

/**
 * Drift error raised in check mode when changes are required.
 *
 * **Example** (Make tsconfig drift error)
 *
 * ```ts
 * import { TsconfigSyncDriftError } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const error = TsconfigSyncDriftError.make({ fileCount: 2, summary: "2 config files need updates" })
 * console.log(error.summary.includes("updates")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class TsconfigSyncDriftError extends S.TaggedError<TsconfigSyncDriftError>($I`TsconfigSyncDriftError`)(
  "TsconfigSyncDriftError",
  {
    fileCount: S.Finite,
    summary: S.String,
  },
  $I.annoteError<TsconfigSyncDriftError>("TsconfigSyncDriftError", {
    title: "Tsconfig Sync Drift Error",
    description: "Raised when tsconfig-sync --check detects one or more files that are out of sync.",
  })
) {
  /**
   * Construct a tsconfig drift error from the changed file count.
   *
   * @category constructors
   */
  static readonly new: {
    (fileCount: number, summary: string): TsconfigSyncDriftError;
    (summary: string): (fileCount: number) => TsconfigSyncDriftError;
  } = dual(
    2,
    (fileCount: number, summary: string): TsconfigSyncDriftError =>
      TsconfigSyncDriftError.make({
        fileCount,
        summary,
      })
  );

  static readonly mapError = Err.mapToError<TsconfigSyncDriftError, [fileCount: number, summary: string]>(
    (fileCount, summary) => TsconfigSyncDriftError.new(fileCount, summary)
  );
}

/**
 * Cycle error raised when workspace dependency cycles are detected.
 *
 * **Example** (Make workspace cycle error)
 *
 * ```ts
 * import { TsconfigSyncCycleError } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const error = TsconfigSyncCycleError.make({ cycles: [["@beep/a", "@beep/b"]], message: "Workspace cycle detected" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class TsconfigSyncCycleError extends S.TaggedError<TsconfigSyncCycleError>($I`TsconfigSyncCycleError`)(
  "TsconfigSyncCycleError",
  {
    cycles: S.String.pipe(S.Array, S.Array),
    message: S.String,
  },
  $I.annoteError<TsconfigSyncCycleError>("TsconfigSyncCycleError", {
    title: "Tsconfig Sync Cycle Error",
    description: "Raised when workspace dependency graph contains one or more cycles.",
  })
) {
  /**
   * Construct a tsconfig cycle error from detected workspace cycles.
   *
   * @category constructors
   */
  static readonly new: {
    (cycles: string[][], message: string): TsconfigSyncCycleError;
    (message: string): (cycles: string[][]) => TsconfigSyncCycleError;
  } = dual(
    2,
    (cycles: string[][], message: string): TsconfigSyncCycleError =>
      TsconfigSyncCycleError.make({
        cycles,
        message,
      })
  );

  static readonly mapError = Err.mapToError<TsconfigSyncCycleError, [cycles: string[][], message: string]>(
    (cycles, message) => TsconfigSyncCycleError.new(cycles, message)
  );
}

/**
 * Filter error raised when `--filter` does not match any workspace package.
 *
 * **Example** (Make filter match error)
 *
 * ```ts
 * import { TsconfigSyncFilterError } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const error = TsconfigSyncFilterError.make({ filter: "@beep/missing", message: "No workspace matched filter" })
 * console.log(error.filter === "@beep/missing") // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class TsconfigSyncFilterError extends S.TaggedError<TsconfigSyncFilterError>($I`TsconfigSyncFilterError`)(
  "TsconfigSyncFilterError",
  {
    filter: S.String,
    message: S.String,
  },
  $I.annoteError<TsconfigSyncFilterError>("TsconfigSyncFilterError", {
    title: "Tsconfig Sync Filter Error",
    description: "Raised when tsconfig-sync filter does not match any workspace package name or path.",
  })
) {
  /**
   * Construct a tsconfig filter error from the unmatched filter.
   *
   * @category constructors
   */
  static readonly new: {
    (filter: string, message: string): TsconfigSyncFilterError;
    (message: string): (filter: string) => TsconfigSyncFilterError;
  } = dual(
    2,
    (filter: string, message: string): TsconfigSyncFilterError =>
      TsconfigSyncFilterError.make({
        filter,
        message,
      })
  );

  static readonly mapError = Err.mapToError<TsconfigSyncFilterError, [filter: string, message: string]>(
    (filter, message) => TsconfigSyncFilterError.new(filter, message)
  );
}
