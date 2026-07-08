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
import { CauseTaggedError, TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import { Effect, Runtime } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/AIMetrics/AIMetrics.errors");

/**
 * Error raised by the AI metrics CLI.
 *
 * @example
 * ```ts
 * import { aiMetricsCommand } from "@beep/repo-cli/commands/AIMetrics/index"
 * console.log(aiMetricsCommand)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsCommandError extends CauseTaggedError<AiMetricsCommandError>($I`AiMetricsCommandError`)(
  "AiMetricsCommandError",
  {},
  $I.annote("AiMetricsCommandError", {
    description: "User-facing failure raised by the AI metrics CLI command suite.",
  })
) {}

/**
 * Silent non-zero status used after the status command has already rendered output.
 *
 * @example
 * ```ts
 * import { AiMetricsStatusExit } from "@beep/repo-cli/commands/AIMetrics/AIMetrics.errors"
 *
 * const error = AiMetricsStatusExit.new("AI metrics status failed.")
 * console.log(error.message)
 * ```
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
 * @example
 * ```ts
 * import { AiMetricsProgramError } from "@beep/repo-cli/commands/AIMetrics/AIMetrics.errors"
 * import * as S from "effect/Schema"
 *
 * const isProgramError = S.is(AiMetricsProgramError)
 * console.log(isProgramError({ _tag: "not-an-ai-metrics-error" })) // false
 * ```
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
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Adapt an AI metrics command program to the CLI command runtime shape.
 *
 * @example
 * ```ts
 * import { runAiMetricsProgram } from "@beep/repo-cli/commands/AIMetrics/AIMetrics.errors"
 * import { Effect } from "effect"
 *
 * const program = runAiMetricsProgram(Effect.succeed("rendered"))
 * console.log(program.pipe !== undefined) // true
 * ```
 * @param effect - AI metrics command effect after the command handler has built its typed program.
 * @returns A command-runtime effect that preserves the original error and requirement channels while discarding success data.
 * @category errors
 * @since 0.0.0
 */
export const runAiMetricsProgram = <A, R>(
  effect: Effect.Effect<A, typeof AiMetricsProgramError.Type, R>
): Effect.Effect<void, typeof AiMetricsProgramError.Type, R> => effect.pipe(Effect.asVoid);
