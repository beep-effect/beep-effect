/**
 * String utility types for `@beep/types`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Matches any non-empty string at the type level.
 *
 * Returns `never` when instantiated with an empty string or when an empty string
 * is a subtype of the instantiated type (e.g. `string`, `Uppercase<string>`).
 *
 * @example
 * ```typescript
 * import type { TString } from "@beep/types"
 *
 * type Hello = TString.NonEmpty<"hello">
 * // "hello"
 *
 * type Empty = TString.NonEmpty<"">
 * // never
 *
 * type NonEmptyExamples = readonly [Hello, Empty]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export type NonEmpty<T extends string = string> = T extends "" ? never : T;

/**
 * Splits a string literal type into a union of its individual characters.
 *
 * @example
 * ```typescript
 * import type { TString } from "@beep/types"
 *
 * type ABC = TString.Chars<"abc">
 * // "a" | "b" | "c"
 *
 * type Digits = TString.Chars<"0123456789">
 * // "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
 *
 * type CharsExamples = readonly [ABC, Digits]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export type Chars<S extends string> = S extends `${infer C}${infer Rest}` ? C | Chars<Rest> : never;
