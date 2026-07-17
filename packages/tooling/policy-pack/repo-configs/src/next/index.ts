/**
 * Next.js configuration schemas for `@beep/repo-configs`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Constituent Next.js configuration model schemas.
 *
 * @example
 * ```ts
 * import { NextConfig } from "@beep/repo-configs/next"
 * const schema = NextConfig
 * console.log(schema)
 * ```
 * @category models
 * @since 0.0.0
 */
export * from "./models/index.ts";
/**
 * Public Next.js configuration model.
 *
 * @example
 * ```ts
 * import { defineNextConfig } from "@beep/repo-configs/next"
 * const config = defineNextConfig({ reactStrictMode: true })
 * console.log(config)
 * ```
 * @category models
 * @since 0.0.0
 */
export * from "./NextConfig.model.ts";
/**
 * Shared repo-owned Next.js preset and plugin composition helpers.
 *
 * @example
 * ```ts
 * import { defineBeepNextConfig } from "@beep/repo-configs/next"
 * const config = defineBeepNextConfig({
 *   repoRoot: "/repo",
 *   allowedDevOrigins: ["oip-web.localhost"]
 * })
 * console.log(config)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export * from "./SharedNextConfig.model.ts";
/**
 * Secure header helpers for shared Next.js configuration.
 *
 * @example
 * ```ts
 * import { withSecureHeaders } from "@beep/repo-configs/next"
 * const config = withSecureHeaders({ reactStrictMode: true })
 * console.log(config)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export * from "./security/index.ts";
