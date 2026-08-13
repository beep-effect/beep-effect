/**
 * Tagged errors for the AIMetrics command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import {
  AiMetricsArchiveError,
  AiMetricsConfigSnapshotError,
  AiMetricsForwarderError,
  AiMetricsIngestError,
  AiMetricsInstallConfigurationError,
  AiMetricsMirrorError,
  AiMetricsOtlpExportError,
  AiMetricsPrivacyError,
  AiMetricsRetentionError,
  AiMetricsScorecardError,
  AiMetricsSourceDiscoveryError,
} from "@beep/repo-ai-metrics";
import { TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import { Effect, Runtime } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/AIMetrics/AIMetrics.errors");

/**
 * Error raised by the AI metrics CLI.
 *
 * **Example** (Create metrics command error)
 *
 * ```ts
 * import { AiMetricsCommandError } from "@beep/repo-cli/commands/AIMetrics/AIMetrics.errors"
 *
 * const error = AiMetricsCommandError.make({
 *   cause: new Error("archive unavailable"),
 *   message: "AI metrics archive unavailable"
 * })
 * console.log(error._tag === "AiMetricsCommandError") // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsCommandError extends S.TaggedError<AiMetricsCommandError>($I`AiMetricsCommandError`)(
  "AiMetricsCommandError",
  {
    message: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("AiMetricsCommandError", {
    description: "User-facing failure raised by the AI metrics CLI command suite.",
  })
) {}

/**
 * Silent non-zero status used after the status command has already rendered output.
 *
 * **Example** (Create status exit error)
 *
 * ```ts
 * import { AiMetricsStatusExit } from "@beep/repo-cli/commands/AIMetrics/AIMetrics.errors"
 *
 * const error = AiMetricsStatusExit.new("AI metrics status failed.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsStatusExit extends TaggedErrorClass<AiMetricsStatusExit>($I`AiMetricsStatusExit`)(
  "AiMetricsStatusExit",
  {
    message: S.String,
  },
  $I.annote("AiMetricsStatusExit", {
    description: "Silent non-zero process exit requested after a command has already rendered its result.",
  })
) {
  /** Process exit code reported when this status sentinel reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;

  /** Suppress duplicate runtime reporting after command output has already been rendered. */
  override readonly [Runtime.errorReported] = false;

  static readonly new = (message: string): AiMetricsStatusExit => AiMetricsStatusExit.make({ message });

  static readonly mapError = Err.mapToError(this.new);
}

/**
 * Unified typed failure channel for AI metrics command programs.
 *
 * **Example** (Validate program error schema)
 *
 * ```ts
 * import { AiMetricsProgramError } from "@beep/repo-cli/commands/AIMetrics/AIMetrics.errors"
 * import * as S from "effect/Schema"
 *
 * const isProgramError = S.is(AiMetricsProgramError)
 * console.log(isProgramError({ _tag: "not-an-ai-metrics-error" })) // false
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AiMetricsProgramError = S.Union([
  AiMetricsArchiveError,
  AiMetricsCommandError,
  AiMetricsConfigSnapshotError,
  AiMetricsForwarderError,
  AiMetricsIngestError,
  AiMetricsInstallConfigurationError,
  AiMetricsMirrorError,
  AiMetricsOtlpExportError,
  AiMetricsPrivacyError,
  AiMetricsRetentionError,
  AiMetricsScorecardError,
  AiMetricsSourceDiscoveryError,
  AiMetricsStatusExit,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AiMetricsProgramError", {
    description: "Unified typed failure channel for AI metrics command programs.",
  })
);

/**
 * Unified typed failure channel for AI metrics command programs.
 *
 * **Example** (Type program error variable)
 *
 * ```ts
 * import type { AiMetricsProgramError } from "@beep/repo-cli/commands/AIMetrics/AIMetrics.errors"
 *
 * const error: AiMetricsProgramError | undefined = undefined
 * console.log(error === undefined) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type AiMetricsProgramError = typeof AiMetricsProgramError.Type;

/**
 * Adapt an AI metrics command program to the CLI command runtime shape.
 *
 * **Example** (Adapt program for CLI)
 *
 * ```ts
 * import { runAiMetricsProgram } from "@beep/repo-cli/commands/AIMetrics/AIMetrics.errors"
 * import { Effect } from "effect"
 *
 * const program = runAiMetricsProgram(Effect.succeed("rendered"))
 * console.log(program.pipe !== undefined) // true
 * ```
 *
 * @param effect - AI metrics command effect after the command handler has built its typed program.
 * @returns A command-runtime effect that preserves the original error and requirement channels while discarding success data.
 * @category errors
 * @since 0.0.0
 */
export const runAiMetricsProgram = <A, R>(
  effect: Effect.Effect<A, AiMetricsProgramError, R>
): Effect.Effect<void, AiMetricsProgramError, R> => effect.pipe(Effect.asVoid);
