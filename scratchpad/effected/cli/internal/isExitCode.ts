/**
 * Whether `code` is an exit status a POSIX process can carry: an integer in
 * `0..255`. `NaN`, fractions and out-of-range values all fail — a relational
 * check alone would admit `NaN`.
 *
 * **Example** (Validate POSIX exit status bounds)
 *
 * ```ts
 * import { isExitCode } from "@beep/scratchpad/effected/cli/internal/isExitCode"
 *
 * console.log(isExitCode(255)) // true
 * console.log(isExitCode(256)) // false
 * console.log(isExitCode(Number.NaN)) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isExitCode = (code: number): boolean => Number.isInteger(code) && code >= 0 && code <= 255;
