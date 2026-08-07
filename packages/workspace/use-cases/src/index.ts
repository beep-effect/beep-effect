/**
 * Package entry point for `@beep/workspace-use-cases`.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

/**
 * Package version for the workspace use-case role.
 *
 * **Example** (Check initial package version)
 *
 * ```ts
 * import { VERSION } from "@beep/workspace-use-cases"
 *
 * const isInitialPackageVersion = VERSION === "0.0.0"
 * console.log(isInitialPackageVersion) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Public use-case exports for the workspace package.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./public.ts";
