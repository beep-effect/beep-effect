/**
 * Full-fidelity glob matching as Effect schemas: the complete minimatch
 * dialect — extglobs, braces, character classes including POSIX classes, true
 * globstar, negation — compiled to pure string predicates, hardened against
 * hostile input, with zero runtime dependencies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Single-pattern schemas, options, and typed compile failure.
 *
 * **Example** (Compile one matcher)
 *
 * ```ts
 * import { GlobPattern } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobPattern.compileResult("**\/*.ts")
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("src/index.ts")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export { GlobPattern, GlobPatternError, GlobPatternOptions } from "./GlobPattern.ts";

/**
 * Multi-pattern include/exclude schema.
 *
 * **Example** (Compile a set)
 *
 * ```ts
 * import { GlobSet } from "@beep/scratchpad/glob"
 * import { Result } from "effect"
 *
 * const compiled = GlobSet.compileResult(["packages/*", "!packages/docs"])
 * console.log(Result.isSuccess(compiled) && compiled.success.matches("packages/cli")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export { GlobSet } from "./GlobSet.ts";
