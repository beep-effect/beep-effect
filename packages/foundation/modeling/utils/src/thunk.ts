/**
 * A module containing utilities which return thunks of data
 * @since 0.0.0
 * @packageDocumentation
 */

import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "./Record.ts";

type LazyArg<A> = () => A;

/**
 * Creates a thunk that always returns the provided value.
 *
 * **Example** (Constant value thunk)
 *
 * ```ts
 * import { thunk } from "@beep/utils/thunk"
 *
 * const getFortyTwo = thunk(42)
 * const value = getFortyTwo()
 * // 42
 *
 * console.log(value)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunk =
  <A>(value: A): LazyArg<A> =>
  () =>
    value;

/**
 * A thunk that always yields `null`.
 *
 * **Example** (Always returns null)
 *
 * ```ts
 * import { thunkNull } from "@beep/utils/thunk"
 *
 * const value = thunkNull()
 * // null
 *
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkNull = thunk(null);

/**
 * A thunk that always yields `undefined`.
 *
 * **Example** (Always returns undefined)
 *
 * ```ts
 * import { thunkUndefined } from "@beep/utils/thunk"
 *
 * const value = thunkUndefined()
 * // undefined
 *
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkUndefined = thunk(undefined);

/**
 * A thunk that always yields `void 0` (equivalent to `undefined`).
 *
 * **Example** (Always returns void)
 *
 * ```ts
 * import { thunkVoid } from "@beep/utils/thunk"
 *
 * const value = thunkVoid()
 * // undefined
 *
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkVoid = thunk(void 0);

/**
 * A thunk that always yields `true`.
 *
 * **Example** (Always returns true)
 *
 * ```ts
 * import { thunkTrue } from "@beep/utils/thunk"
 *
 * const value = thunkTrue()
 * // true
 *
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkTrue = thunk(true as const);

/**
 * A thunk that always yields `false`.
 *
 * **Example** (Always returns false)
 *
 * ```ts
 * import { thunkFalse } from "@beep/utils/thunk"
 *
 * const value = thunkFalse()
 * // false
 *
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkFalse = thunk(false as const);

/**
 * A thunk that always yields the empty string.
 *
 * **Example** (Always returns empty string)
 *
 * ```ts
 * import { thunkEmptyStr } from "@beep/utils/thunk"
 *
 * const value = thunkEmptyStr()
 * // ""
 *
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkEmptyStr = thunk("");

/**
 * A thunk that always yields `0`.
 *
 * **Example** (Always returns zero)
 *
 * ```ts
 * import { thunk0 } from "@beep/utils/thunk"
 *
 * const value = thunk0()
 * // 0
 *
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunk0 = thunk(0);

/**
 * A thunk that always yields `1`.
 *
 * **Example** (Always returns one)
 *
 * ```ts
 * import { thunk1 } from "@beep/utils/thunk"
 *
 * const value = thunk1()
 * // 1
 *
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunk1 = thunk(1);

/**
 * Returns a thunk that yields a fresh empty mutable array on each call.
 *
 * **Example** (Fresh empty mutable array)
 *
 * ```ts
 * import { thunkEmptyArray } from "@beep/utils/thunk"
 *
 * const getArr = thunkEmptyArray<number>()
 * const arr = getArr()
 * // []
 *
 * console.log(arr)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkEmptyArray = <A = never>(): LazyArg<Array<A>> => A.empty<A>;

/**
 * Returns a thunk that yields a fresh empty readonly array on each call.
 *
 * **Example** (Fresh empty readonly array)
 *
 * ```ts
 * import { thunkEmptyReadonlyArray } from "@beep/utils/thunk"
 *
 * const getArr = thunkEmptyReadonlyArray<string>()
 * const arr = getArr()
 * // []
 *
 * console.log(arr)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkEmptyReadonlyArray = <A = never>(): LazyArg<ReadonlyArray<A>> => A.empty<A>;

/**
 * Lifts an Effect value into a thunk that returns it unchanged.
 *
 * **Example** (Lift Effect into thunk)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { thunkEffect } from "@beep/utils/thunk"
 *
 * const getEffect = thunkEffect(Effect.succeed(42))
 * const eff = getEffect()
 *
 * console.log(eff)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkEffect = <T>(effect: T) => thunk(effect);

/**
 * A thunk that returns `Effect.void`.
 *
 * **Example** (Thunk of Effect.void)
 *
 * ```ts
 * import { thunkEffectVoid } from "@beep/utils/thunk"
 *
 * const eff = thunkEffectVoid()
 *
 * console.log(eff)
 * ```
 *
 * @effects Creates a pure `Effect.void` value for callers to execute later; no
 * services are required while constructing the thunk.
 * @category utilities
 * @since 0.0.0
 */
export const thunkEffectVoid = (..._: ReadonlyArray<unknown>) => Effect.void;

/**
 * Creates a thunk that returns `Effect.succeed(a)`.
 *
 * **Example** (Thunk of Effect.succeed)
 *
 * ```ts
 * import { thunkEffectSucceed } from "@beep/utils/thunk"
 *
 * const getEffect = thunkEffectSucceed("hello")
 * const eff = getEffect()
 *
 * console.log(eff)
 * ```
 *
 * @effects Creates a pure `Effect.succeed` value for callers to execute later;
 * no services are required while constructing the thunk.
 * @category constructors
 * @since 0.0.0
 */
export const thunkEffectSucceed = <A>(a: A) => thunkEffect(Effect.succeed(a));

/**
 * A thunk that returns `Effect.succeed(null)`.
 *
 * **Example** (Effect succeeding with null)
 *
 * ```ts
 * import { thunkEffectSucceedNull } from "@beep/utils/thunk"
 * import { Effect } from "effect"
 *
 * const value = Effect.runSync(thunkEffectSucceedNull())
 *
 * console.log(value)
 * ```
 *
 * @effects Creates a pure `Effect` that succeeds with `null`; no services are
 * required and execution is left to the caller.
 * @category constructors
 * @since 0.0.0
 */
export const thunkEffectSucceedNull = (..._: ReadonlyArray<unknown>) => Effect.succeed(null);

/**
 * Returns `Effect.succeed(Option.none())`.
 *
 * **Example** (Effect succeeding with none)
 *
 * ```ts
 * import { thunkEffectSucceedNone } from "@beep/utils/thunk"
 *
 * const eff = thunkEffectSucceedNone<string>()
 *
 * console.log(eff)
 * ```
 *
 * @effects Creates a pure `Effect` that succeeds with `Option.none`; no
 * services are required and execution is left to the caller.
 * @category constructors
 * @since 0.0.0
 */
export const thunkEffectSucceedNone = <A = never>(..._: ReadonlyArray<unknown>) => Effect.succeed(O.none<A>());

/**
 * Returns a thunk that yields an empty record.
 *
 * **Example** (Empty typed record thunk)
 *
 * ```ts
 * import { thunkEmptyRecord } from "@beep/utils/thunk"
 *
 * const rec = thunkEmptyRecord<string, number>()
 *
 * console.log(rec)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkEmptyRecord = <K extends string | symbol = never, V = never>() => R.empty<K, V>();

/**
 * A thunk that yields a fresh typed empty readonly record.
 *
 * **Example** (Empty readonly record fallback)
 *
 * ```ts
 * import { O, R, thunkEmptyReadonlyRecord } from "@beep/utils"
 *
 * const value = O.getOrElse(
 *   O.none<R.ReadonlyRecord<string, number>>(),
 *   thunkEmptyReadonlyRecord
 * )
 * console.log(value) // {}
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkEmptyReadonlyRecord = <K extends string | symbol = never, V = never>(): R.ReadonlyRecord<
  R.ReadonlyRecord.NonLiteralKey<K>,
  V
> => R.emptyReadonly<K, V>();

/**
 * Creates a thunk that yields `Option.some(value)`.
 *
 * **Example** (Thunk of Option.some)
 *
 * ```ts
 * import { thunkSome } from "@beep/utils/thunk"
 *
 * const getSome = thunkSome(42)
 * const opt = getSome()
 * // Option.some(42)
 *
 * console.log(opt)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkSome =
  <A>(value: A): (() => O.Option<A>) =>
  () =>
    O.some(value);

/**
 * A thunk yielding `Option.some("")`.
 *
 * **Example** (Option.some empty string)
 *
 * ```ts
 * import { thunkSomeEmptyStr } from "@beep/utils/thunk"
 *
 * const opt = thunkSomeEmptyStr()
 * // Option.some("")
 *
 * console.log(opt)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkSomeEmptyStr = thunkSome("");

/**
 * A thunk yielding `-1`.
 *
 * **Example** (Always returns negative one)
 *
 * ```ts
 * import { thunkNegative1 } from "@beep/utils/thunk"
 *
 * const value = thunkNegative1()
 * // -1
 *
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkNegative1 = thunk(-1);

/**
 * A thunk yielding `Option.some(false)`.
 *
 * **Example** (Option.some false)
 *
 * ```ts
 * import { thunkSomeFalse } from "@beep/utils/thunk"
 *
 * const opt = thunkSomeFalse()
 * // Option.some(false)
 *
 * console.log(opt)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkSomeFalse = thunkSome(false);

/**
 * A thunk yielding `Option.some(true)`.
 *
 * **Example** (Option.some true)
 *
 * ```ts
 * import { thunkSomeTrue } from "@beep/utils/thunk"
 *
 * const opt = thunkSomeTrue()
 * // Option.some(true)
 *
 * console.log(opt)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const thunkSomeTrue = thunkSome(true as const);

/**
 * Returns a thunk yielding `Option.some([])`.
 *
 * **Example** (Option.some empty array)
 *
 * ```ts
 * import { thunkSomeEmptyArray } from "@beep/utils/thunk"
 *
 * const opt = thunkSomeEmptyArray<number>()
 * // Option.some([])
 *
 * console.log(opt)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkSomeEmptyArray = <A = never>() => O.some(A.empty<A>());

/**
 * Returns a thunk yielding `Option.some({})`.
 *
 * **Example** (Option.some empty record)
 *
 * ```ts
 * import { thunkSomeEmptyRecord } from "@beep/utils/thunk"
 *
 * const opt = thunkSomeEmptyRecord<string, number>()
 * // Option.some({})
 *
 * console.log(opt)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkSomeEmptyRecord = <K extends string | symbol = never, V = never>() => O.some(R.empty<K, V>());

/**
 * Returns a thunk yielding `Option.some(Option.none())`.
 *
 * **Details**
 *
 * Useful for representing an explicitly-set "empty" value inside a nested
 * `Option` structure.
 *
 * **Example** (Nested Option.some none)
 *
 * ```ts
 * import { thunkSomeNone } from "@beep/utils/thunk"
 *
 * const opt = thunkSomeNone<string>()
 * // Option.some(Option.none())
 *
 * console.log(opt)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkSomeNone = <A>(): O.Option<O.Option<A>> => O.some(O.none<A>());

/**
 * Returns a thunk yielding `Result.failVoid`.
 *
 * **Details**
 *
 * Useful for representing an explicitly-set "empty" value inside a nested
 * `Result` structure.
 *
 * **Example** (Result.failVoid thunk)
 *
 * ```ts
 * import { thunkResultFailVoid } from "@beep/utils/thunk"
 *
 * const resultFailure = thunkResultFailVoid()
 *
 *
 * console.log(resultFailure)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const thunkResultFailVoid = () => Result.failVoid;
