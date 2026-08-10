/**
 * Package entry point for `@beep/govinfo` — the keyed driver for the US GPO
 * GovInfo REST API. Aggregates the domain contracts and value models, runtime
 * configuration, typed errors, and the GovInfo service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * GovInfo contracts and value models (search contract, value objects).
 *
 * @since 0.0.0
 * @category models
 */
export * from "./domain/index.ts";
/**
 * Runtime configuration models and constants.
 *
 * @since 0.0.0
 * @category configuration
 */
export * from "./Govinfo.config.ts";
/**
 * Typed GovInfo driver errors.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./Govinfo.errors.ts";
/**
 * GovInfo REST API service.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./Govinfo.service.ts";

/**
 * Package version.
 *
 * **Example** (Import and log version)
 *
 * ```ts
 * import { VERSION } from "@beep/govinfo"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
