/**
 * Whether `code` is an exit status a POSIX process can carry: an integer in
 * `0..255`. `NaN`, fractions and out-of-range values all fail — a relational
 * check alone would admit `NaN`.
 *
 * @internal
 */
export const isExitCode = (code: number): boolean => Number.isInteger(code) && code >= 0 && code <= 255;
