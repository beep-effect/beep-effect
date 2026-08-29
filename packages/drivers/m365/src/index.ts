/**
 * Microsoft Graph `v1.0` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * MSAL-backed delegated token provider.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./M365.auth.ts";
/**
 * Runtime configuration models and constants.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./M365.config.ts";
/**
 * Typed Microsoft 365 driver errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./M365.errors.ts";
/**
 * Microsoft Graph response schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./M365.schemas.ts";
/**
 * Microsoft Graph read-only service.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./M365.service.ts";

/**
 * Package version.
 *
 * **Example** (Check initial package version)
 *
 * ```ts
 * import { VERSION } from "@beep/m365"
 *
 * const isInitialPackageVersion = VERSION === "0.0.0"
 * console.log(isInitialPackageVersion) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
