/**
 * Alchemy resources for Vercel: projects, environment variables and domains
 * over `@distilled.cloud/vercel`.
 *
 * **Example** (Import the namespace)
 *
 * ```ts
 * import * as Vercel from "@beep/alchemy-vercel"
 *
 * console.log(Vercel.Project.Type) // "Vercel.Project"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * @since 0.0.0
 */
export * from "./Domain.ts";
/**
 * @since 0.0.0
 */
export * from "./EnvVar.ts";
/**
 * @since 0.0.0
 */
export * from "./Project.ts";
/**
 * @since 0.0.0
 */
export * from "./Providers.ts";
