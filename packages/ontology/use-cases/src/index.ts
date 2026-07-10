/**
 * Package entry point for `@beep/ontology-use-cases`.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

/**
 * Package version for the ontology use-case role.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/ontology-use-cases"
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
 * Public use-case exports for the ontology package.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./public.js";
