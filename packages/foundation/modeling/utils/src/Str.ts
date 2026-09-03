/**
 * String helpers for type-preserving prefixes, suffixes, case conversion, and
 * predicates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { cast, dual, flow } from "effect/Function";
import * as Str from "effect/String";
import * as A from "./Array.ts";
import type { LazyArg } from "effect/Function";
import type * as Ordering from "effect/Ordering";
import type * as TF from "type-fest";

/**
 * Compare two strings for equality with data-first and data-last call forms.
 *
 * **Details**
 *
 * This is the canonical string-specific equivalence helper for reusable code.
 * Use `SchemaUtils.toEquivalence(schema)` when comparing values whose equality
 * should be derived from a named schema.
 *
 * **Example** (Call `equivalence`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * const same = Str.equivalence("docs", "docs")
 * const piped = pipe("docs", Str.equivalence("tests"))
 *
 * console.log(same)
 * console.log(piped)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const equivalence: {
  (self: string, that: string): boolean;
  (that: string): (self: string) => boolean;
} = dual(2, Str.Equivalence);

/**
 * Ascending lexicographic order for strings.
 *
 * **Details**
 *
 * The data-first signature is `Order.Order<string>`, so `orderAsc` stays usable
 * wherever an `effect/Order` comparator is expected. The data-last signature
 * partially applies `that` for pipeable comparisons.
 *
 * **Example** (Call `orderAsc`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { A, Str } from "@beep/utils"
 *
 * const sorted = A.sort(["b", "a"], Str.orderAsc)
 * const compared = pipe("a", Str.orderAsc("b"))
 *
 * console.log(sorted)
 * console.log(compared)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const orderAsc: {
  (that: string): (self: string) => Ordering.Ordering;
  (self: string, that: string): Ordering.Ordering;
} = dual(2, Str.Order);

/**
 * Selects the template-literal result of {@link prefix}.
 *
 * **Details**
 *
 * Spelled as a deferred conditional alias so the data-first and data-last
 * signatures of {@link prefix} share a single named return type. Every concrete
 * instantiation resolves back to the corresponding concatenated template-literal type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Prefixed<Pre extends string, S extends string> = Pre extends string ? `${Pre}${S}` : never;

/**
 * Prepends `prefix` to a string, preserving template-literal types.
 *
 * **Details**
 *
 * Supports both data-first and data-last calling conventions.
 *
 * **Example** (Call `prefix`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * // Data-first
 * const prefixed = Str.prefix("world", "hello-")
 * // "hello-world"
 *
 * // Data-last (pipeable)
 * const piped = pipe("bar", Str.prefix("foo-"))
 * // "foo-bar"
 *
 * console.log(prefixed)
 * console.log(piped)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const prefix: {
  <const Pre extends string>(prefix: Pre): <S extends string>(str: S) => Prefixed<Pre, S>;
  <const Pre extends string, const S extends string>(prefix: Pre): (str: S) => Prefixed<Pre, S>;
  <const Pre extends string, const S extends string>(str: S, prefix: Pre): Prefixed<Pre, S>;
} = dual(
  2,
  <const Pre extends string, const S extends string>(str: S, prefix: Pre): Prefixed<Pre, S> =>
    cast(`${prefix}${str}` as const)
);

/**
 * Prepends `prefix` to a string and returns a thunk of the result.
 *
 * **Details**
 *
 * Useful for deferred evaluation when building lazy configuration values.
 * Supports both data-first and data-last calling conventions.
 *
 * **Example** (Call `prefixThunk`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * // Data-first
 * const lazy = Str.prefixThunk("world", "hello-")
 * const value = lazy()
 * // "hello-world"
 *
 * // Data-last (pipeable)
 * const piped = pipe("bar", Str.prefixThunk("foo-"))
 * const result = piped()
 * // "foo-bar"
 *
 * console.log(value)
 * console.log(result)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const prefixThunk: {
  <const Pre extends string>(prefix: Pre): <S extends string>(str: S) => LazyArg<`${Pre}${S}`>;
  <const Pre extends string, const S extends string>(prefix: Pre): (str: S) => LazyArg<`${Pre}${S}`>;
  <const Pre extends string, const S extends string>(str: S, prefix: Pre): LazyArg<`${Pre}${S}`>;
} = dual(
  2,
  <const Pre extends string, const S extends string>(str: S, prefix: Pre): LazyArg<`${Pre}${S}`> =>
    () =>
      `${prefix}${str}` as const
);

/**
 * Selects the template-literal result of {@link postfix}.
 *
 * **Details**
 *
 * Spelled as a deferred conditional alias so the data-first and data-last
 * signatures of {@link postfix} share a single named return type. Every
 * concrete instantiation resolves back to the corresponding concatenated template-literal type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Postfixed<S extends string, Post extends string> = Post extends string ? `${S}${Post}` : never;

/**
 * Appends `postfix` to a string, preserving template-literal types.
 *
 * **Details**
 *
 * Supports both data-first and data-last calling conventions.
 *
 * **Example** (Call `postfix`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * // Data-first
 * const suffixed = Str.postfix("hello", "-world")
 * // "hello-world"
 *
 * // Data-last (pipeable)
 * const piped = pipe("foo", Str.postfix("-bar"))
 * // "foo-bar"
 *
 * console.log(suffixed)
 * console.log(piped)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const postfix: {
  <const Post extends string>(postfix: Post): <S extends string>(str: S) => Postfixed<S, Post>;
  <const Post extends string, const S extends string>(postfix: Post): (str: S) => Postfixed<S, Post>;
  <const Post extends string, const S extends string>(str: S, postfix: Post): Postfixed<S, Post>;
} = dual(
  2,
  <const Post extends string, const S extends string>(str: S, postfix: Post): Postfixed<S, Post> =>
    cast(`${str}${postfix}` as const)
);

/**
 * Appends `postfix` to a string and returns a thunk of the result.
 *
 * **Details**
 *
 * Useful for deferred evaluation when building lazy configuration values.
 * Supports both data-first and data-last calling conventions.
 *
 * **Example** (Call `postfixThunk`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * // Data-first
 * const lazy = Str.postfixThunk("hello", "-world")
 * const value = lazy()
 * // "hello-world"
 *
 * // Data-last (pipeable)
 * const piped = pipe("foo", Str.postfixThunk("-bar"))
 * const result = piped()
 * // "foo-bar"
 *
 * console.log(value)
 * console.log(result)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const postfixThunk: {
  <const Post extends string>(postfix: Post): <S extends string>(str: S) => LazyArg<`${S}${Post}`>;
  <const Post extends string, const S extends string>(postfix: Post): (str: S) => LazyArg<`${S}${Post}`>;
  <const Post extends string, const S extends string>(str: S, postfix: Post): LazyArg<`${S}${Post}`>;
} = dual(
  2,
  <const Post extends string, const S extends string>(str: S, postfix: Post): LazyArg<`${S}${Post}`> =>
    () =>
      `${str}${postfix}` as const
);

/**
 * Maps a non-empty string array by prepending each element with `prefix`.
 *
 * **Details**
 *
 * Preserves `NonEmptyReadonlyArray` in the return type. Supports both
 * data-first and data-last calling conventions.
 *
 * **Example** (Call `mapPrefix`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 * import * as A from "effect/Array"
 *
 * const routes: A.NonEmptyReadonlyArray<string> = ["users", "posts"]
 *
 * // Data-first
 * const prefixed = Str.mapPrefix("/api/", routes)
 *
 * // Data-last (pipeable)
 * const piped = pipe(routes, Str.mapPrefix("/api/"))
 *
 * console.log(prefixed)
 * console.log(piped)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mapPrefix: {
  <const Pre extends string>(
    prefix: Pre
  ): <Arr extends A.NonEmptyReadonlyArray<string>>(arr: Arr) => A.NonEmptyReadonlyArray<`${Pre}${Arr[number]}`>;
  <const Pre extends string, Arr extends A.NonEmptyReadonlyArray<string>>(
    prefix: Pre,
    arr: Arr
  ): A.NonEmptyReadonlyArray<`${Pre}${Arr[number]}`>;
} = dual(
  2,
  <const Pre extends string, Arr extends A.NonEmptyReadonlyArray<string>>(
    pre: Pre,
    arr: Arr
  ): A.NonEmptyReadonlyArray<`${Pre}${Arr[number]}`> => {
    const prefixEl = prefix(pre);
    return A.mapNonEmptyReadonly(arr, prefixEl);
  }
);

/**
 * Maps a non-empty string array by appending each element with `postfix`.
 *
 * **Details**
 *
 * Preserves `NonEmptyReadonlyArray` in the return type. Supports both
 * data-first and data-last calling conventions.
 *
 * **Example** (Call `mapPostfix`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 * import * as A from "effect/Array"
 *
 * const files: A.NonEmptyReadonlyArray<string> = ["index", "main"]
 *
 * // Data-first
 * const withExt = Str.mapPostfix(".ts", files)
 *
 * // Data-last (pipeable)
 * const piped = pipe(files, Str.mapPostfix(".ts"))
 *
 * console.log(withExt)
 * console.log(piped)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mapPostfix: {
  <const Post extends string>(
    postfix: Post
  ): <Arr extends A.NonEmptyReadonlyArray<string>>(arr: Arr) => A.NonEmptyReadonlyArray<`${Arr[number]}${Post}`>;
  <const Post extends string, Arr extends A.NonEmptyReadonlyArray<string>>(
    postfix: Post,
    arr: Arr
  ): A.NonEmptyReadonlyArray<`${Arr[number]}${Post}`>;
} = dual(
  2,
  <const Post extends string, Arr extends A.NonEmptyReadonlyArray<string>>(
    post: Post,
    arr: Arr
  ): A.NonEmptyReadonlyArray<`${Arr[number]}${Post}`> => {
    const postfixEl = postfix(post);
    return A.mapNonEmptyReadonly(arr, postfixEl);
  }
);

/**
 * Converts a string to `camelCase` with a type-level `CamelCase` return.
 *
 * **Example** (Call `camelCase`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.camelCase("my_cool_name")
 * // "myCoolName"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const camelCase = <TStr extends string>(str: TStr): TF.CamelCase<TStr> => cast(Str.camelCase(str));

/**
 * Converts a string to `snake_case` with a type-level `SnakeCase` return.
 *
 * **Example** (Call `snakeCase`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.snakeCase("myCoolName")
 * // "my_cool_name"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const snakeCase = <const TStr extends string>(str: TStr): TF.SnakeCase<TStr> => cast(Str.snakeCase(str));

/**
 * Converts a string to `kebab-case` with a type-level `KebabCase` return.
 *
 * **Example** (Call `kebabCase`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.kebabCase("myCoolName")
 * // "my-cool-name"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const kebabCase = <const TStr extends string>(str: TStr): TF.KebabCase<TStr> => cast(Str.kebabCase(str));

/**
 * Converts a string to `SCREAMING_SNAKE_CASE` with a type-level
 * `ScreamingSnakeCase` return.
 *
 * **Example** (Call `screamingSnake`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.screamingSnake("myCoolName")
 * // "MY_COOL_NAME"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const screamingSnake = <const TStr extends string>(str: TStr): TF.ScreamingSnakeCase<TStr> =>
  cast(Str.constantCase(str));

/**
 * Converts a string to `PascalCase` with a type-level `PascalCase` return.
 *
 * **Example** (Call `pascalCase`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.pascalCase("my_cool_name")
 * // "MyCoolName"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const pascalCase = <const TStr extends string>(str: TStr): TF.PascalCase<TStr> => cast(Str.pascalCase(str));

/**
 * Converts a `PascalCase` string to `snake_case` at both type and value level.
 *
 * **Example** (Call `pascalToSnake`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.pascalToSnake("MyCoolName")
 * // "my_cool_name"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const pascalToSnake = <const TStr extends string>(str: TF.PascalCase<TStr>): TF.SnakeCase<TStr> =>
  cast(Str.pascalToSnake(str));

/**
 * Converts a `snake_case` string to `camelCase` at both type and value level.
 *
 * **Example** (Call `snakeToCamel`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.snakeToCamel("my_cool_name")
 * // "myCoolName"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const snakeToCamel = <const TStr extends string>(str: TF.SnakeCase<TStr>): TF.CamelCase<TStr> =>
  cast(Str.snakeToCamel(str));

/**
 * Converts a `snake_case` string to `kebab-case` at both type and value level.
 *
 * **Example** (Call `snakeToKebab`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.snakeToKebab("my_cool_name")
 * // "my-cool-name"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const snakeToKebab = <const TStr extends string>(str: TF.SnakeCase<TStr>): TF.KebabCase<TStr> =>
  cast(Str.snakeToKebab(str));

/**
 * Converts a `camelCase` string to `snake_case` at both type and value level.
 *
 * **Example** (Call `camelToSnake`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.camelToSnake("myCoolName")
 * // "my_cool_name"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const camelToSnake = <const TStr extends string>(str: TF.CamelCase<TStr>): TF.SnakeCase<TStr> =>
  cast(Str.camelToSnake(str));

/**
 * Converts a `snake_case` string to `PascalCase` at both type and value level.
 *
 * **Example** (Call `snakeToPascal`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.snakeToPascal("my_cool_name")
 * // "MyCoolName"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const snakeToPascal = <const TStr extends TF.SnakeCase<string>>(str: TStr): TF.PascalCase<TStr> =>
  cast(Str.snakeToPascal(str));

/**
 * Converts a `kebab-case` string to `snake_case` at both type and value level.
 *
 * **Example** (Call `kebabToSnake`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.kebabToSnake("my-cool-name")
 * // "my_cool_name"
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const kebabToSnake = <const TStr extends string>(str: TF.KebabCase<TStr>): TF.SnakeCase<TStr> =>
  cast(Str.kebabToSnake(str));

/**
 * Type-narrowing predicate that checks whether a string starts with `searchString`.
 *
 * **Details**
 *
 * Narrows the type to a string with the requested prefix on success. Supports
 * both data-first and data-last calling conventions.
 *
 * **Example** (Call `startsWith`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * const direct = Str.startsWith("hello-world", "hello")
 * const piped = pipe("hello-world", Str.startsWith("hello"))
 *
 * console.log(direct)
 * console.log(piped)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const startsWith: {
  <const SearchString extends string>(
    searchString: SearchString
  ): <const TStr extends string>(str: TStr) => str is TStr & `${SearchString}${string}`;
  <const TStr extends string, const SearchString extends string>(
    str: TStr,
    searchString: SearchString
  ): str is TStr & `${SearchString}${string}`;
} = dual(
  2,
  <const TStr extends string, const SearchString extends string>(
    str: TStr,
    searchString: SearchString
  ): str is TStr & `${SearchString}${string}` => Str.startsWith(searchString)(str)
);

/**
 * Type-narrowing predicate that checks whether a string ends with `searchString`.
 *
 * **Details**
 *
 * Narrows the type to a string with the requested suffix on success. Supports
 * both data-first and data-last calling conventions.
 *
 * **Example** (Call `endsWith`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * const direct = Str.endsWith("hello-world", "world")
 * const piped = pipe("hello-world", Str.endsWith("world"))
 *
 * console.log(direct)
 * console.log(piped)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const endsWith: {
  <const SearchString extends string>(
    searchString: SearchString
  ): <const TStr extends string>(str: TStr) => str is TStr & `${string}${SearchString}`;
  <const TStr extends string, const SearchString extends string>(
    str: TStr,
    searchString: SearchString
  ): str is TStr & `${string}${SearchString}`;
} = dual(
  2,
  <const TStr extends string, const SearchString extends string>(
    str: TStr,
    searchString: SearchString
  ): str is TStr & `${string}${SearchString}` => Str.endsWith(searchString)(str)
);

/**
 * Type-narrowing predicate that checks whether a string contains `searchString`.
 *
 * **Details**
 *
 * Narrows the type to a string that contains the searched substring on
 * success. Supports both data-first and data-last calling conventions.
 *
 * **Example** (Call `contains`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * // Data-first
 * const result = Str.contains("hello world", "lo wo")
 * // true
 *
 * // Data-last (pipeable)
 * const piped = pipe("hello world", Str.contains("xyz"))
 * // false
 *
 * console.log(result)
 * console.log(piped)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const contains: {
  <const SearchString extends string>(
    searchString: SearchString
  ): <const TStr extends string>(str: TStr) => str is TStr & `${string}${SearchString}${string}`;
  <const TStr extends string, const SearchString extends string>(
    str: TStr,
    searchString: SearchString
  ): str is TStr & `${string}${SearchString}${string}`;
} = dual(
  2,
  <const TStr extends string, const SearchString extends string>(
    str: TStr,
    searchString: SearchString
  ): str is TStr & `${string}${SearchString}${string}` => Str.includes(searchString)(str)
);

/**
 * Repeats a string `count` times with a type-level `StringRepeat` return.
 *
 * **Details**
 *
 * Supports both data-first and data-last calling conventions.
 *
 * **Example** (Call `repeat`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * // Data-first
 * const result = Str.repeat("ha", 3)
 * // "hahaha"
 *
 * // Data-last (pipeable)
 * const piped = pipe("na", Str.repeat(2))
 * // "nana"
 *
 * console.log(result)
 * console.log(piped)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const repeat: {
  <const Count extends number>(
    count: Count
  ): <const Input extends string>(self: Input) => TF.StringRepeat<Input, Count>;
  <const Input extends string, const Count extends number>(self: Input, count: Count): TF.StringRepeat<Input, Count>;
} = dual(
  2,
  <const Input extends string, const Count extends number>(self: Input, count: Count): TF.StringRepeat<Input, Count> =>
    cast(Str.repeat(count)(self))
);

/**
 * Replaces the first occurrence of `searchValue` using a callback replacer.
 *
 * **Details**
 *
 * Supports both data-first and data-last calling conventions. Use this helper
 * for native `replace` callback sites that cannot be expressed with
 * `Str.replace(searchValue, replacement)`.
 *
 * **Example** (Call `replaceWith`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 * import { pipe } from "effect"
 *
 * const replaced = Str.replaceWith("beep", (match) => Str.toUpperCase(match))("hello beep")
 * const piped = pipe("hello beep", Str.replaceWith("beep", (match) => Str.toUpperCase(match)))
 *
 * console.log(replaced)
 * console.log(piped)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const replaceWith: {
  (
    searchValue: string | RegExp,
    replacer: (substring: string, ...args: ReadonlyArray<unknown>) => string
  ): (self: string) => string;
  (
    self: string,
    searchValue: string | RegExp,
    replacer: (substring: string, ...args: ReadonlyArray<unknown>) => string
  ): string;
} = dual(
  3,
  (
    self: string,
    searchValue: string | RegExp,
    replacer: (substring: string, ...args: ReadonlyArray<unknown>) => string
  ): string => self.replace(searchValue, replacer)
);

/**
 * Replaces every occurrence of `searchValue` using a callback replacer.
 *
 * **Details**
 *
 * Supports both data-first and data-last calling conventions. Use this helper
 * for native `replaceAll` callback sites that cannot be expressed with
 * `Str.replaceAll(searchValue, replacement)`.
 *
 * **Example** (Call `replaceAllWith`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 * import { pipe } from "effect"
 *
 * const replaced = Str.replaceAllWith(/beep/g, (match) => Str.toUpperCase(match))("beep beep")
 * const piped = pipe("beep beep", Str.replaceAllWith(/beep/g, (match) => Str.toUpperCase(match)))
 *
 * console.log(replaced)
 * console.log(piped)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const replaceAllWith: {
  (
    searchValue: string | RegExp,
    replacer: (substring: string, ...args: ReadonlyArray<unknown>) => string
  ): (self: string) => string;
  (
    self: string,
    searchValue: string | RegExp,
    replacer: (substring: string, ...args: ReadonlyArray<unknown>) => string
  ): string;
} = dual(
  3,
  (
    self: string,
    searchValue: string | RegExp,
    replacer: (substring: string, ...args: ReadonlyArray<unknown>) => string
  ): string => self.replaceAll(searchValue, replacer)
);
/**
 * Re-export of all helpers from `effect/String`.
 *
 * **Example** (Call a re-exported helper)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const lower = Str.toLowerCase("BEEP")
 * console.log(lower)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/String";

/**
 * Returns a thunk that lazily trims whitespace from both ends of a string.
 *
 * **Example** (Call `trimThunk`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const lazy = Str.trimThunk("  hello  ")
 * const value = lazy()
 * // "hello"
 *
 * console.log(value)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const trimThunk = (s: string) => () => Str.trim(s);

/**
 * Convert a numeric literal into its string-literal representation.
 *
 * **Example** (Call `fromNumber`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.fromNumber(42)
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 * @typeParam T - Numeric literal to convert.
 * @param num - The number to convert to a string literal type.
 * @returns The number as a string literal type.
 */
export const fromNumber = <const T extends number>(num: T): `${T}` => `${num}` as const;

/**
 * Converts arbitrary text into a lowercase kebab-case slug.
 *
 * **Example** (Call `toSlug`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const value = Str.toSlug("Hello, Beep Effect!")
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const toSlug = flow(
  Str.toLowerCase,
  Str.replace(/[^a-z0-9\s-]/g, ""),
  Str.replace(/\s+/g, "-"),
  Str.replace(/-+/g, "-"),
  Str.replace(/^-|-$/g, "")
);

/**
 * Trim text and truncate it to the requested visible character count.
 *
 * **Details**
 *
 * When the trimmed text is longer than `maxLength`, the result keeps the first
 * `maxLength` characters and appends `...`.
 *
 * **Example** (Call `truncate`)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { Str } from "@beep/utils"
 *
 * const direct = Str.truncate("  hello world  ", 5)
 * // "hello..."
 *
 * const piped = pipe("  beep effect  ", Str.truncate(4))
 * // "beep..."
 *
 * console.log(direct)
 * console.log(piped)
 * ```
 *
 * @param text - The text to trim and truncate.
 * @param maxLength - The number of characters to keep before appending `...`.
 * @returns The trimmed text, or the truncated text with an ellipsis suffix.
 * @category combinators
 * @since 0.0.0
 */
export const truncate: {
  (text: string, maxLength: number): string;
  (maxLength: number): (text: string) => string;
} = dual(2, (text: string, maxLength: number): string => {
  const trimmed = Str.trim(text);
  if (Str.length(trimmed) <= maxLength) {
    return trimmed;
  }
  return `${Str.slice(0, maxLength)(trimmed)}...`;
});

/**
 * Returns an empty string if the provided input is null or undefined
 *
 * **Example** (Call `orEmpty`)
 *
 * ```ts
 * import { Str } from "@beep/utils";
 *
 * const fn = (someStr: string | null | undefined) => console.log(Str.orEmpty(someStr)) // "" if null or undefined
 * ```
 *
 * @category combinators
 * @param str - The nullish string
 * @since 0.0.0
 */
export const orEmpty = (str: string | null | undefined): string => str ?? "";

/**
 * Selects the statically reachable result of {@link matchEmpty}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MatchEmptyResult<Self extends string, OnEmpty, OnNonEmpty> = string extends Self
  ? OnEmpty | OnNonEmpty
  : Self extends ""
    ? OnEmpty
    : OnNonEmpty;

/**
 * Pattern-matches on a string, handling the empty and non-empty cases
 * separately — the string analogue of `effect/Array`'s `match`.
 *
 * **Details**
 *
 * `onEmpty` is evaluated lazily and only when the string is `""`; `onNonEmpty`
 * receives the non-empty string. Supports both data-first and data-last
 * calling conventions.
 *
 * **Example** (Call `matchEmpty`)
 *
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * // Data-last (pipeable)
 * const summarize = Str.matchEmpty({
 *   onEmpty: () => "<empty>",
 *   onNonEmpty: (s) => `${s.length} chars`
 * })
 * console.log(summarize("")) // "<empty>"
 * console.log(summarize("beep")) // "4 chars"
 *
 * // Data-first
 * const direct = Str.matchEmpty("beep", {
 *   onEmpty: () => 0,
 *   onNonEmpty: (s) => s.length
 * })
 * console.log(direct) // 4
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const matchEmpty: {
  <const B, const C = B>(options: {
    readonly onEmpty: LazyArg<B>;
    readonly onNonEmpty: (self: string) => C;
  }): <const Self extends string>(self: Self) => MatchEmptyResult<Self, B, C>;
  <const Self extends string, const B, const C = B>(options: {
    readonly onEmpty: LazyArg<B>;
    readonly onNonEmpty: (self: Exclude<Self, "">) => C;
  }): (self: Self) => MatchEmptyResult<Self, B, C>;
  <const Self extends string, const B, const C = B>(
    self: Self,
    options: {
      readonly onEmpty: LazyArg<B>;
      readonly onNonEmpty: (self: Exclude<Self, "">) => C;
    }
  ): MatchEmptyResult<Self, B, C>;
} = dual(
  2,
  <Self extends string, B, C = B>(
    self: Self,
    {
      onEmpty,
      onNonEmpty,
    }: {
      readonly onEmpty: LazyArg<B>;
      readonly onNonEmpty: (self: Exclude<Self, "">) => C;
    }
  ): MatchEmptyResult<Self, B, C> => cast(Str.isEmpty(self) ? onEmpty() : onNonEmpty(cast(self)))
);
