/**
 * Tagged errors for the Ci command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Err } from "@beep/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { OpaqueDefect } from "../../internal/schema/OpaqueDefect.ts";

const $I = $RepoCliId.create("commands/Ci/Ci.errors");

/**
 * Typed failure for CI helper commands.
 *
 * **Example** (Create typed CI error)
 *
 * ```ts
 * import { CiCommandError } from "@beep/repo-cli/commands/Ci"
 *
 * const error = CiCommandError.make({ message: "Turbo summary not found" })
 * console.log(error.message) // "Turbo summary not found"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CiCommandError extends S.TaggedError<CiCommandError, { readonly brand: unique symbol }>(
  $I`CiCommandError`
)(
  "CiCommandError",
  {
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<CiCommandError>("CiCommandError", {
    description: "Failure raised by CI helper commands.",
  })
) {
  /**
   * Construct a CI command error from an original cause and message.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string): CiCommandError;
    (message: string): (cause: unknown) => CiCommandError;
  } = dual(2, (cause: unknown, message: string): CiCommandError => CiCommandError.make({ cause, message }));

  static readonly mapError = Err.mapToError(this.new);
}

/**
 * Failure reasons emitted by the fail-closed CI lane partition proof.
 *
 * **Details**
 *
 * The `shard-*` reasons cover a package that is split across several
 * partitions with Vitest `--shard`: every such partition must carry a shard,
 * share one total, hold exactly that package, and together enumerate the
 * indexes `1..total` exactly once.
 *
 * **Example** (Recognize a stale package failure)
 *
 * ```ts
 * import { CiLanePartitionErrorReason } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLanePartitionErrorReason.is["stale-package"]("stale-package"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLanePartitionErrorReason = LiteralKit([
  "invalid-assignment",
  "invalid-options",
  "duplicate-partition",
  "duplicate-package",
  "incomplete-selection",
  "missing-package",
  "stale-package",
  "shard-index-duplicate",
  "shard-set-incomplete",
  "shard-total-mismatch",
  "sharded-bin-package-count",
  "sharded-package-unsharded",
  "unknown-selected-task",
  "workspace-read",
  "turbo-dry-run",
]).pipe(
  $I.annoteSchema("CiLanePartitionErrorReason", {
    description: "Reason a fail-closed CI lane partition proof could not proceed.",
  })
);

/**
 * Reason a fail-closed CI lane partition proof could not proceed.
 *
 * **Example** (Type a partition failure reason)
 *
 * ```ts
 * import type { CiLanePartitionErrorReason } from "@beep/repo-cli/commands/Ci"
 *
 * const reason: CiLanePartitionErrorReason = "missing-package"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiLanePartitionErrorReason = typeof CiLanePartitionErrorReason.Type;

/**
 * Failure raised when a CI lane partition cannot be proved safe to execute.
 *
 * **Example** (Create a missing placement error)
 *
 * ```ts
 * import { CiLanePartitionError } from "@beep/repo-cli/commands/Ci"
 *
 * const error = CiLanePartitionError.make({
 *   reason: "missing-package",
 *   laneId: "lint",
 *   tablePath: "packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts",
 *   repair: "Regenerate the deterministic LPT table.",
 *   message: "Missing package @beep/example."
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CiLanePartitionError extends S.TaggedError<CiLanePartitionError, { readonly brand: unique symbol }>(
  $I`CiLanePartitionError`
)(
  "CiLanePartitionError",
  {
    reason: CiLanePartitionErrorReason,
    laneId: S.String,
    partition: S.optionalKey(S.String),
    tablePath: S.String,
    repair: S.String,
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<CiLanePartitionError>("CiLanePartitionError", {
    description: "Fail-closed CI lane partition validation or discovery failure.",
  })
) {}

/**
 * Report a `ci` command failure the way every `ci` subcommand does: the
 * `[ci] <message>` line on stderr, then a reported non-zero exit.
 *
 * **Example** (Report a failure)
 *
 * ```ts
 * import { CiCommandError, reportCiCommandError } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const program = reportCiCommandError(CiCommandError.make({ message: "no event" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param error - The failure to report.
 * @returns An effect that prints the line and fails with the reported exit.
 * @category error-handling
 * @since 0.0.0
 */
export const reportCiCommandError = (error: CiCommandError | CiLanePartitionError) =>
  Console.error(`[ci] ${error.message}`).pipe(Effect.andThen(failWithReportedExit(`[ci] ${error.message}`)));
