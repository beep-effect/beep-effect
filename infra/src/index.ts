/**
 * Project-level constants and helpers for the infra workspace.
 *
 * @example
 * ```ts
 * import { infraProjectName } from "@beep/infra"
 *
 * console.log(infraProjectName)
 * // "beep-effect"
 * ```
 *
 * @since 0.0.0
 */

/**
 * Canonical project name for this repository's infrastructure workspace.
 *
 * @example
 * ```ts
 * import { infraProjectName } from "@beep/infra"
 *
 * console.log(infraProjectName)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const infraProjectName = "beep-effect";

/**
 * AI metrics Pulumi orchestration exports.
 *
 * @example
 * ```ts
 * import { AIMetricsStack } from "@beep/infra"
 *
 * console.log(AIMetricsStack)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export * from "./AIMetrics.ts";
/**
 * CI runner fleet controller bridge exports.
 *
 * @category resources
 * @since 0.0.0
 */
export * from "./CiFleetController.ts";
/**
 * CI runner fleet groundwork Pulumi orchestration exports.
 *
 * **Example** (Reference the CI runners stack)
 *
 * ```ts
 * import { CiRunnersStack } from "@beep/infra"
 *
 * console.log(CiRunnersStack)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export * from "./CiRunners.ts";
/**
 * Asymmetric Turbo remote-cache component exports.
 *
 * **Example** (Reference the cache component)
 *
 * ```ts
 * import { CiTurboCache } from "@beep/infra"
 *
 * console.log(CiTurboCache)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export * from "./CiTurboCache.ts";
/**
 * OIP web Pulumi orchestration exports.
 *
 * @example
 * ```ts
 * import { OipWebStack } from "@beep/infra"
 *
 * console.log(OipWebStack)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export * from "./OipWeb.ts";
/**
 * OpenClaw workstation Pulumi orchestration exports.
 *
 * @example
 * ```ts
 * import { OpenClawStack } from "@beep/infra"
 *
 * console.log(OpenClawStack)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export * from "./OpenClaw.ts";
/**
 * OpenClaw immutable workspace artifact exports.
 *
 * @example
 * ```ts
 * import { openClawSoulRelativePath } from "@beep/infra"
 *
 * console.log(openClawSoulRelativePath) // "workspace/SOUL.md"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./OpenClawArtifacts.ts";
/**
 * Storybook Pulumi orchestration exports.
 *
 * @example
 * ```ts
 * import { StorybookStack } from "@beep/infra"
 *
 * console.log(StorybookStack)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export * from "./Storybook.ts";
/**
 * Shared Vercel provider schemas for infra stacks.
 *
 * @example
 * ```ts
 * import { VercelAuthenticationDeploymentType } from "@beep/infra"
 *
 * console.log(VercelAuthenticationDeploymentType.Enum.none)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Vercel.ts";
