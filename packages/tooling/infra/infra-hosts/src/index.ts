/**
 * Alchemy stacks for the host deployments: AI metrics (Arize Phoenix) on
 * dankserver and the OpenClaw generation applicator on the operator
 * workstation. Each stack is a program composed in its own entry file at the
 * package root (`alchemy.run.ts` and `openclaw.alchemy.run.ts`); `prod`
 * deploys from the operator workstation only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Typed configuration for the AI metrics (Arize Phoenix) host stack.
 *
 * **Example** (Import the module)
 * ```ts
 * import { AiMetricsConfig } from "@beep/infra-hosts"
 *
 * console.log(AiMetricsConfig.aiMetricsConfigEnvKey) // "BEEP_AI_METRICS_HOST_CONFIG"
 * ```
 *
 * @category re-exports
 * @since 0.0.0
 */
export * as AiMetricsConfig from "./AiMetricsConfig.ts";
/**
 * The AI metrics host stack program, its resource graph and its operator commands.
 *
 * **Example** (Import the module)
 * ```ts
 * import { AiMetricsStack } from "@beep/infra-hosts"
 *
 * console.log(AiMetricsStack.aiMetricsStackName) // "HostsAiMetrics"
 * ```
 *
 * @category re-exports
 * @since 0.0.0
 */
export * as AiMetricsStack from "./AiMetricsStack.ts";
/**
 * Loads a host stack's typed configuration from the JSON file an environment variable names.
 *
 * **Example** (Import the module)
 * ```ts
 * import { HostConfigFile } from "@beep/infra-hosts"
 *
 * console.log(typeof HostConfigFile.loadHostConfigFile) // "function"
 * ```
 *
 * @category re-exports
 * @since 0.0.0
 */
export * as HostConfigFile from "./HostConfigFile.ts";
/**
 * Stage policy shared by the host stacks, including the workstation-only prod guard.
 *
 * **Example** (Import the module)
 * ```ts
 * import { HostsStage } from "@beep/infra-hosts"
 *
 * console.log(HostsStage.stageKind("prod")) // "prod"
 * ```
 *
 * @category re-exports
 * @since 0.0.0
 */
export * as HostsStage from "./HostsStage.ts";
/**
 * Exact immutable workspace artifacts for the OpenClaw workstation agent.
 *
 * **Example** (Import the module)
 * ```ts
 * import { OpenClawArtifacts } from "@beep/infra-hosts"
 *
 * console.log(OpenClawArtifacts.openClawSoulRelativePath) // "workspace/SOUL.md"
 * ```
 *
 * @category re-exports
 * @since 0.0.0
 */
export * as OpenClawArtifacts from "./OpenClawArtifacts.ts";
/**
 * Content-addressed OpenClaw generation model and applicator scripts.
 *
 * **Example** (Import the module)
 * ```ts
 * import { OpenClawGeneration } from "@beep/infra-hosts"
 *
 * console.log(OpenClawGeneration.OpenClawFileMode.literals) // ["0644", "0755"]
 * ```
 *
 * @category re-exports
 * @since 0.0.0
 */
export * as OpenClawGeneration from "./OpenClawGeneration.ts";
/**
 * The OpenClaw host stack program: the generation applicator as ordered command steps.
 *
 * **Example** (Import the module)
 * ```ts
 * import { OpenClawStack } from "@beep/infra-hosts"
 *
 * console.log(OpenClawStack.openClawStackName) // "HostsOpenClaw"
 * ```
 *
 * @category re-exports
 * @since 0.0.0
 */
export * as OpenClawStack from "./OpenClawStack.ts";
