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
 * Filters out empty string literals and string literals with a leading or trailing `/`.
 *
 * @remarks
 * Interior slashes are permitted. Like {@link NonEmpty}, this only rejects
 * constraints visible in the input type, so broad `string` remains `string`;
 * validate runtime strings separately.
 *
 * @example
 * ```typescript
 * import type { TString } from "@beep/types"
 *
 * type Segment = TString.NonEmptyTrimmed<"users/42">
 * // "users/42"
 *
 * type Empty = TString.NonEmptyTrimmed<"">
 * // never
 *
 * type LeadingSlash = TString.NonEmptyTrimmed<"/users">
 * // never
 *
 * type TrailingSlash = TString.NonEmptyTrimmed<"users/">
 * // never
 *
 * type NonEmptyTrimmedExamples = readonly [Segment, Empty, LeadingSlash, TrailingSlash]
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NonEmptyTrimmed<T extends string = string> = T extends `/${string}` | `${string}/` ? never : NonEmpty<T>;

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

type DotPropertyNameStart = Chars<"ABCDEFGHIJKLMNOPQRSTUVWXYZ"> | Chars<"abcdefghijklmnopqrstuvwxyz"> | "$" | "_";
type DotPropertyNamePart = DotPropertyNameStart | Chars<"0123456789">;
type IsDotPropertyNameRest<S extends string> = S extends ""
  ? true
  : S extends `${DotPropertyNamePart}${infer Rest}`
    ? IsDotPropertyNameRest<Rest>
    : false;

/**
 * Filters string literals to ASCII property names that can be used after `.`.
 *
 * @remarks
 * The first character must be an ASCII letter, `_`, or `$`; later characters
 * may also be decimal digits. Reserved words are permitted because JavaScript
 * member access accepts identifier names. Broad `string` remains `string`;
 * validate runtime strings separately.
 *
 * @example
 * ```typescript
 * import type { TString } from "@beep/types"
 *
 * type Name = TString.DotPropertyName<"hello4">
 * // "hello4"
 *
 * type DollarName = TString.DotPropertyName<"$hello">
 * // "$hello"
 *
 * type LeadingSpace = TString.DotPropertyName<" hello">
 * // never
 *
 * type LeadingDigit = TString.DotPropertyName<"1hello">
 * // never
 *
 * type DotPropertyNameExamples = readonly [Name, DollarName, LeadingSpace, LeadingDigit]
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DotPropertyName<T extends string = string> = string extends T
  ? T
  : T extends `${DotPropertyNameStart}${infer Rest}`
    ? IsDotPropertyNameRest<Rest> extends true
      ? T
      : never
    : never;
