/**
 * Full-fidelity glob matching as Effect schemas: the complete minimatch
 * dialect — extglobs, braces, character classes including POSIX classes, true
 * globstar, negation — compiled to pure string predicates, hardened against
 * hostile input, with zero runtime dependencies.
 *
 * @packageDocumentation
 */

export { GlobPattern, GlobPatternError, GlobPatternOptions } from "./GlobPattern.ts";
export { GlobSet } from "./GlobSet.ts";
