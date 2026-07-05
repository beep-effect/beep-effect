/**
 * `@beep/api-transport` — shared hand-authored HTTP transport transformer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * The shared transport transformer (auth, rate-limit, retry) and its models.
 *
 * @since 0.0.0
 * @category ports
 */
export * from "./Transport.ts";

/**
 * Package version.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/api-transport"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
