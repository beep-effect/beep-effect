/**
 * Extended Option utilities built on `effect/Option`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { cast, dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { unsafeDotGet } from "./internal/StructPath.ts";
import type { Get, Paths, Simplify } from "type-fest";
import type { PathInput } from "./internal/StructPath.ts";

type OptionStruct = Readonly<Record<string, O.Option<unknown>>>;

type GetSomesStruct<Self extends OptionStruct> = Simplify<
  Partial<{
    [K in keyof Self & string]: O.Option.Value<Self[K]>;
  }>
>;

/**
 * Retrieves a value from a struct by path and converts missing or nullish
 * results into an `Option`.
 *
 * **Details**
 *
 * Mirrors `Struct.dotGet` path validation and tuple path support, then
 * applies `Option.fromNullishOr` to the retrieved value.
 *
 * Supports a dual API:
 * - Data-last: `pipe(person, O.propFromNullishOr("age"))`
 * - Data-first: `O.propFromNullishOr(person, "age")`
 * - Tuple paths: `O.propFromNullishOr(person, ["profile", "age"] as const)`
 *
 * **Example** (Get path as Option)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { O } from "@beep/utils"
 *
 * const user: { readonly name: string; readonly age: number | null } = {
 *   name: "Alice",
 *   age: null,
 * }
 *
 * // Data-first -- nullish becomes none
 * const age = O.propFromNullishOr(user, "age")
 * // Option.none()
 *
 * // Data-last (pipeable)
 * const name = pipe(user, O.propFromNullishOr("name"))
 * // Option.some("Alice")
 *
 * console.log(age)
 * console.log(name)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const propFromNullishOr: {
  <const P extends string>(
    path: P
  ): <S extends object>(self: P extends Paths<S> ? S : never) => O.Option<NonNullable<Get<S, P>>>;
  <const P extends ReadonlyArray<string>>(path: P): <S extends object>(self: S) => O.Option<NonNullable<Get<S, P>>>;
  <S extends object, const P extends string & Paths<S>>(path: P): (self: S) => O.Option<NonNullable<Get<S, P>>>;
  <S extends object, const P extends ReadonlyArray<string>>(path: P): (self: S) => O.Option<NonNullable<Get<S, P>>>;
  <S extends object, const P extends string & Paths<S>>(self: S, path: P): O.Option<NonNullable<Get<S, P>>>;
  <S extends object, const P extends ReadonlyArray<string>>(self: S, path: P): O.Option<NonNullable<Get<S, P>>>;
} = dual(
  2,
  <S extends object>(self: S, path: PathInput): O.Option<unknown> => O.fromNullishOr(unsafeDotGet(self, path))
) as {
  <const P extends string>(
    path: P
  ): <S extends object>(self: P extends Paths<S> ? S : never) => O.Option<NonNullable<Get<S, P>>>;
  <const P extends ReadonlyArray<string>>(path: P): <S extends object>(self: S) => O.Option<NonNullable<Get<S, P>>>;
  <S extends object, const P extends string & Paths<S>>(path: P): (self: S) => O.Option<NonNullable<Get<S, P>>>;
  <S extends object, const P extends ReadonlyArray<string>>(path: P): (self: S) => O.Option<NonNullable<Get<S, P>>>;
  <S extends object, const P extends string & Paths<S>>(self: S, path: P): O.Option<NonNullable<Get<S, P>>>;
  <S extends object, const P extends ReadonlyArray<string>>(self: S, path: P): O.Option<NonNullable<Get<S, P>>>;
};

/**
 * Compact a struct of `Option` values into an object containing only `Some`
 * fields.
 *
 * **Details**
 *
 * This mirrors `Record.getSomes` at runtime while preserving heterogeneous
 * per-key value types for object-constructor payloads.
 *
 * **Example** (Compact Option struct fields)
 *
 * ```ts
 * import { O } from "@beep/utils"
 *
 * const props = O.getSomesStruct({
 *   id: O.some(1),
 *   name: O.none<string>(),
 * })
 *
 * console.log(props)
 * // { id: 1 }
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const getSomesStruct = <const Self extends OptionStruct>(self: Self): GetSomesStruct<Self> =>
  cast<Record<string, unknown>, GetSomesStruct<Self>>(R.getSomes(self));

/**
 * Re-export of all helpers from `effect/Option`.
 *
 * **Example** (Import Option helpers)
 *
 * ```ts
 * import * as O from "@beep/utils/Option"
 *
 * const value = O.some("beep")
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/Option";
