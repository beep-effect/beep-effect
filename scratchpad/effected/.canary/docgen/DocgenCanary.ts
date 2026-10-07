/**
 * Docgen canary for the effected-port `docgen` gate: its one Example does not
 * compile on purpose, so a docgen run that skips example typechecking is
 * caught. Never "fix" this file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Doubles a number.
 *
 * **Example** (A deliberately ill-typed call)
 *
 * ```ts
 * import { canaryDouble } from "@beep/scratchpad/effected/.canary/docgen/DocgenCanary"
 *
 * const doubled: string = canaryDouble("not a number")
 * console.log(doubled)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const canaryDouble = (value: number): number => value * 2;
