/**
 * Package entry point for `@beep/architecture-lab-use-cases`.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

/**
 * Package version for the architecture lab use-case role.
 *
 * **Example** (Check initial package version)
 *
 * ```ts
 * import { VERSION } from "@beep/architecture-lab-use-cases"
 *
 * const isInitialUseCaseApi = VERSION === "0.0.0"
 *
 * console.log(isInitialUseCaseApi) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Public use-case exports for the architecture lab package.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./public.ts";
