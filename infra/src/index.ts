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
