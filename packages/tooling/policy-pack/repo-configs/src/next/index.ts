/**
 * Next.js configuration schemas for `@beep/repo-configs`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Constituent Next.js configuration model schemas.
 *
 * **Example** (Import NextConfig schema)
 *
 * ```ts
 * import { NextConfig } from "@beep/repo-configs/next"
 * const schema = NextConfig
 * console.log(schema)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./models/index.ts";
/**
 * Public Next.js configuration model.
 *
 * **Example** (Define Next.js config)
 *
 * ```ts
 * import { defineNextConfig } from "@beep/repo-configs/next"
 * const config = defineNextConfig({ reactStrictMode: true })
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./NextConfig.model.ts";
/**
 * Shared repo-owned Next.js preset and plugin composition helpers.
 *
 * **Example** (Define Beep Next config)
 *
 * ```ts
 * import { defineBeepNextConfig } from "@beep/repo-configs/next"
 * const config = defineBeepNextConfig({
 *   repoRoot: "/repo",
 *   allowedDevOrigins: ["oip-web.beep.localhost"]
 * })
 * console.log(config)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./SharedNextConfig.model.ts";
/**
 * Secure header helpers for shared Next.js configuration.
 *
 * **Example** (Apply secure headers helper)
 *
 * ```ts
 * import { withSecureHeaders } from "@beep/repo-configs/next"
 * const config = withSecureHeaders({ reactStrictMode: true })
 * console.log(config)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./security/index.ts";
