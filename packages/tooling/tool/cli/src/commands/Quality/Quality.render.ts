/**
 * Rendering helpers for Quality command output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { jsonStringifyPretty } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { Console, Effect } from "effect";
import { dual } from "effect/Function";
import { printLines } from "../../internal/cli/Printer.js";
import { QualityScriptCommandError } from "./Quality.errors.js";
import type { QualityProfileConfig, QualityProfileDetection } from "./Quality.schemas.js";

/**
 * Render quality profile configuration as stable `key=value` lines.
 *
 * @param config - Resolved quality profile whose fields are serialized into lines.
 * @returns Stable `key=value` lines describing the profile configuration.
 * @example
 * ```ts
 * import { renderQualityProfileConfigLines } from "@beep/repo-cli/test/Quality"
 *
 * console.log(renderQualityProfileConfigLines({
 *   profile: "current",
 *   turboConcurrency: 3,
 *   docgenParallel: 3,
 *   fullProofSlots: 1,
 *   reviewFixSlots: 1,
 *   notes: []
 * }))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderQualityProfileConfigLines = (config: QualityProfileConfig): ReadonlyArray<string> => [
  `profile=${config.profile}`,
  `turbo_concurrency=${config.turboConcurrency}`,
  `docgen_parallel=${config.docgenParallel}`,
  `full_proof_slots=${config.fullProofSlots}`,
  `review_fix_slots=${config.reviewFixSlots}`,
  ...A.map(config.notes, (note) => `note=${note}`),
];

/**
 * Print a quality profile config as JSON or stable text lines.
 *
 * @example
 * ```ts
 * import { printQualityProfileConfig } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = printQualityProfileConfig({
 *   docgenParallel: 3,
 *   fullProofSlots: 1,
 *   notes: ["local laptop"],
 *   profile: "current",
 *   reviewFixSlots: 1,
 *   turboConcurrency: 3
 * }, false)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const printQualityProfileConfig: {
  (config: QualityProfileConfig, json: boolean): Effect.Effect<void, QualityScriptCommandError>;
  (json: boolean): (config: QualityProfileConfig) => Effect.Effect<void, QualityScriptCommandError>;
} = dual(
  2,
  (config: QualityProfileConfig, json: boolean): Effect.Effect<void, QualityScriptCommandError> =>
    json
      ? jsonStringifyPretty(config).pipe(
          QualityScriptCommandError.mapError("Failed to encode quality profile config."),
          Effect.flatMap(Console.log)
        )
      : printLines(renderQualityProfileConfigLines(config))
);

/**
 * Print a detected quality profile as JSON or stable text lines.
 *
 * @example
 * ```ts
 * import { printQualityProfileDetection } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = printQualityProfileDetection({
 *   config: {
 *     docgenParallel: 3,
 *     fullProofSlots: 1,
 *     notes: [],
 *     profile: "current",
 *     reviewFixSlots: 1,
 *     turboConcurrency: 3
 *   },
 *   cpuCount: 12,
 *   memoryGiB: 64,
 *   profile: "current"
 * }, false)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const printQualityProfileDetection: {
  (detection: QualityProfileDetection, json: boolean): Effect.Effect<void, QualityScriptCommandError>;
  (json: boolean): (detection: QualityProfileDetection) => Effect.Effect<void, QualityScriptCommandError>;
} = dual(
  2,
  (detection: QualityProfileDetection, json: boolean): Effect.Effect<void, QualityScriptCommandError> =>
    json
      ? jsonStringifyPretty(detection).pipe(
          QualityScriptCommandError.mapError("Failed to encode quality profile detection."),
          Effect.flatMap(Console.log)
        )
      : printLines([
          `profile=${detection.profile}`,
          `cpu_count=${detection.cpuCount}`,
          `memory_gib=${detection.memoryGiB}`,
          ...renderQualityProfileConfigLines(detection.config),
        ])
);
