/**
 * Tagged errors for the Ci command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Defect, LiteralKit } from "@beep/schema";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

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
export class CiCommandError extends S.TaggedError<CiCommandError>($I`CiCommandError`)(
  "CiCommandError",
  {
    message: S.String,
    cause: S.optionalKey(Defect({ includeStack: true })),
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
export class CiLanePartitionError extends S.TaggedError<CiLanePartitionError>($I`CiLanePartitionError`)(
  "CiLanePartitionError",
  {
    reason: CiLanePartitionErrorReason,
    laneId: S.String,
    partition: S.optionalKey(S.String),
    tablePath: S.String,
    repair: S.String,
    message: S.String,
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<CiLanePartitionError>("CiLanePartitionError", {
    description: "Fail-closed CI lane partition validation or discovery failure.",
  })
) {}
