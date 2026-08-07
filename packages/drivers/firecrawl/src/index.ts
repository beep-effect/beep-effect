/**
 * Schema-first, Effect-first Firecrawl technical driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Firecrawl driver configuration exports.
 *
 * **Example** (Import FirecrawlConfigInput)
 *
 * ```ts
 * import { FirecrawlConfigInput } from "@beep/firecrawl"
 *
 * console.log(FirecrawlConfigInput)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Firecrawl.config.ts";
/**
 * Firecrawl technical error exports.
 *
 * **Example** (Import FirecrawlError)
 *
 * ```ts
 * import { FirecrawlError } from "@beep/firecrawl"
 *
 * console.log(FirecrawlError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Firecrawl.errors.ts";
/**
 * Firecrawl payload, success, failure, and watcher model exports.
 *
 * **Example** (Import FirecrawlScrapePayload)
 *
 * ```ts
 * import { FirecrawlScrapePayload } from "@beep/firecrawl"
 *
 * console.log(FirecrawlScrapePayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Firecrawl.models.ts";
/**
 * Firecrawl service and Layer exports.
 *
 * **Example** (Import Firecrawl service)
 *
 * ```ts
 * import { Firecrawl } from "@beep/firecrawl"
 *
 * console.log(Firecrawl)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Firecrawl.service.ts";

/**
 * Package version for `@beep/firecrawl`.
 *
 * **Example** (Import package VERSION)
 *
 * ```ts
 * import { VERSION } from "@beep/firecrawl"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0";
