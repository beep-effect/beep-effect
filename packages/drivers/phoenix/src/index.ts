/**
 * Phoenix API driver package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version for `@beep/phoenix`.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { VERSION } from "@beep/phoenix"
 *
 * console.log(VERSION)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Runtime configuration exports for the Phoenix driver.
 *
 * **Example** (Make empty Phoenix config)
 *
 * ```ts
 * import { PhoenixConfigInput } from "@beep/phoenix"
 *
 * const config = PhoenixConfigInput.make({})
 * console.log(config)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Phoenix.config.ts";
/**
 * Error exports for the Phoenix driver.
 *
 * **Example** (Create operation Phoenix error)
 *
 * ```ts
 * import { PhoenixError } from "@beep/phoenix"
 *
 * const error = PhoenixError.operation("doctor", "transport")
 * console.log(error.reason)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Phoenix.errors.ts";
/**
 * Model exports for the Phoenix driver.
 *
 * **Example** (Make dataset name selector)
 *
 * ```ts
 * import { PhoenixDatasetSelector } from "@beep/phoenix"
 *
 * const selector = PhoenixDatasetSelector.make({ kind: "dataset-name", value: "agent-loop-health-v1" })
 * console.log(selector.value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Phoenix.models.ts";
/**
 * Service exports for the Phoenix driver.
 *
 * **Example** (Access Phoenix service layer)
 *
 * ```ts
 * import { Phoenix } from "@beep/phoenix"
 *
 * const layer = Phoenix.layer
 * console.log(layer)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Phoenix.service.ts";
