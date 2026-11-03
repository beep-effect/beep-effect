/**
 * POSIX shell token quoting for rendered operator commands.
 *
 * **Details**
 *
 * Spawned processes in this repository take discrete `argv` entries and need
 * no quoting (see `ProcessArgs`). This module is for the other case: text that
 * a shell will parse later, such as a systemd `ExecStart=` line, a printed
 * resume command or an `op read` substitution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";

/**
 * Quote a value as one POSIX shell token.
 *
 * **Details**
 *
 * The value is wrapped in single quotes and every embedded single quote is
 * rewritten as `'\''`, so the shell reads the whole value as one literal
 * token with no expansion.
 *
 * **Example** (Quote a vault path and a path with a quote)
 *
 * ```ts
 * import { shellQuote } from "@beep/repo-utils/Shell"
 *
 * console.log(shellQuote("op://vault/item/field")) // 'op://vault/item/field'
 * console.log(shellQuote("it's")) // 'it'\''s'
 * ```
 *
 * @param value - The raw shell argument value to quote.
 * @returns A single POSIX shell token with embedded quotes escaped.
 * @category utilities
 * @since 0.0.0
 */
export const shellQuote = (value: string): string => `'${Str.replace(/'/gu, "'\\''")(value)}'`;
