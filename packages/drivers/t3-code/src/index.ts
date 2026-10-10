/**
 * T3 Code MCP transport and typed wire contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Version of the T3 Code transport package.
 *
 * **Example** (Read the package version)
 *
 * ```ts
 * import { VERSION } from "@beep/t3-code"
 *
 * console.log(VERSION) // "0.0.0"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

export { T3CodeError } from "./T3Code.errors.ts";
export * from "./T3Code.models.ts";
export { T3Code, T3CodeConfig } from "./T3Code.service.ts";
