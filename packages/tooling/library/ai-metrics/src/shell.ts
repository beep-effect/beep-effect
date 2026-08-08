/**
 * Shell rendering helpers for AI metrics operator commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";

/**
 * Quote a value as one POSIX shell token.
 *
 * **Example** (Quoting a vault path)
 *
 * ```ts
 * import { shellQuote } from "@beep/repo-ai-metrics"
 *
 * console.log(shellQuote("op://vault/item/field"))
 * ```
 *
 * @param value - The raw shell argument value to quote.
 * @returns A single POSIX shell token with embedded quotes escaped.
 * @category utilities
 * @since 0.0.0
 */
export const shellQuote = (value: string): string => `'${Str.replace(/'/gu, "'\\''")(value)}'`;
