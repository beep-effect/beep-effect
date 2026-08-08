/**
 * Planning helpers for Quality command profiles.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { cpus, totalmem } from "node:os";
import { Str } from "@beep/utils";
import { QualityHardwareProfile, QualityProfileConfig, QualityProfileDetection } from "./Quality.schemas.ts";
import type { QualityProfileDetectionInput } from "./Quality.schemas.ts";

const gibibytes = (bytes: number): number => Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10;

/**
 * Return static quality scheduling settings for a hardware profile.
 *
 * **Example** (Workstation scheduling settings)
 *
 * ```ts
 * import { qualityProfileConfigForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(qualityProfileConfigForTesting("workstation").reviewFixSlots)
 * ```
 *
 * @param profile - Quality hardware profile to map to scheduling settings.
 * @returns Static quality scheduling configuration for the profile.
 * @category configuration
 * @since 0.0.0
 */
export const qualityProfileConfigForTesting = (profile: QualityHardwareProfile): QualityProfileConfig =>
  QualityHardwareProfile.$match(profile, {
    ci: () =>
      QualityProfileConfig.make({
        profile,
        turboConcurrency: 3,
        docgenParallel: 3,
        fullProofSlots: 1,
        reviewFixSlots: 1,
        notes: ["CI keeps conservative parallelism and relies on hosted job sharding."],
      }),
    current: () =>
      QualityProfileConfig.make({
        profile,
        turboConcurrency: 3,
        docgenParallel: 3,
        fullProofSlots: 1,
        reviewFixSlots: 1,
        notes: ["Current local profile keeps one heavyweight proof active at a time."],
      }),
    workstation: () =>
      QualityProfileConfig.make({
        profile,
        turboConcurrency: 8,
        docgenParallel: 6,
        fullProofSlots: 1,
        reviewFixSlots: 3,
        notes: ["Workstation profile allows parallel review-fix loops while keeping full proofs serialized."],
      }),
  });

/**
 * Detect the quality hardware profile from host facts.
 *
 * **Example** (Detect from host facts)
 *
 * ```ts
 * import { detectQualityProfileForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const profile = detectQualityProfileForTesting({
 *   ci: false,
 *   cpuCount: 64,
 *   totalMemoryBytes: 128 * 1024 * 1024 * 1024
 * })
 * console.log(profile.profile)
 * ```
 *
 * @param input - Host and CI facts used for profile detection.
 * @returns Detected quality profile with derived scheduling configuration.
 * @category configuration
 * @since 0.0.0
 */
export const detectQualityProfileForTesting = (input: QualityProfileDetectionInput): QualityProfileDetection => {
  const profile: QualityHardwareProfile = input.ci
    ? "ci"
    : input.cpuCount >= 32 && input.totalMemoryBytes >= 64 * 1024 * 1024 * 1024
      ? "workstation"
      : "current";

  return QualityProfileDetection.make({
    profile,
    cpuCount: input.cpuCount,
    memoryGiB: gibibytes(input.totalMemoryBytes),
    config: qualityProfileConfigForTesting(profile),
  });
};

/**
 * Detect the quality hardware profile from the current process environment.
 *
 * **Example** (Detect from environment)
 *
 * ```ts
 * import { detectQualityProfile } from "@beep/repo-cli/commands/Quality/Quality.plan"
 *
 * console.log(detectQualityProfile().profile)
 * ```
 *
 * @returns Detected quality profile with derived scheduling configuration.
 * @category configuration
 * @since 0.0.0
 */
export const detectQualityProfile = (): QualityProfileDetection =>
  detectQualityProfileForTesting({
    ci: Str.isNonEmpty(Bun.env.CI ?? ""),
    cpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
  });
