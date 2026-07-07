/**
 * Helpers for non-empty array invariants and Effect array interop.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { thunkFalse, thunkTrue } from "./thunk.ts";
import type { TUnsafe } from "@beep/types";
import type * as Order from "effect/Order";

/**
 * Returns `true` when the array is non-empty, `false` otherwise.
 *
 * A thin wrapper around `Array.match` that collapses a readonly array into a
 * boolean without inspecting its elements.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const hasItems = A.matchToBoolean([1, 2, 3])
 * // true
 *
 * const empty = A.matchToBoolean([])
 * // false
 *
 * console.log(hasItems)
 * console.log(empty)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const matchToBoolean = flow(
  A.match({
    onNonEmpty: thunkTrue,
    onEmpty: thunkFalse,
  })
);
const NonEmptyReadonlyArraySchema = S.NonEmptyArray(S.Any);
const NonEmptyArraySchema = NonEmptyReadonlyArraySchema.pipe(S.mutable);

/**
 * Asserts that `input` is a mutable non-empty array, throwing on failure.
 *
 * Uses `Schema.asserts` under the hood so the error includes full decode
 * context when the assertion fails.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const items: unknown = [1, 2, 3]
 * A.assertNonEmptyArray(items)
 * // items is now narrowed to NonEmptyArray<unknown>
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const assertNonEmptyArray: (input: unknown) => asserts input is A.NonEmptyArray<TUnsafe.Any> = (input) => {
  S.asserts(NonEmptyArraySchema, input);
};
/**
 * Asserts that `input` is a readonly non-empty array, throwing on failure.
 *
 * Uses `Schema.asserts` under the hood so the error includes full decode
 * context when the assertion fails.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const items: unknown = ["a", "b"]
 * A.assertNonEmptyReadonlyArray(items)
 * // items is now narrowed to NonEmptyReadonlyArray<unknown>
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const assertNonEmptyReadonlyArray: (input: unknown) => asserts input is A.NonEmptyReadonlyArray<TUnsafe.Any> = (
  input
) => {
  S.asserts(NonEmptyReadonlyArraySchema, input);
};

function asNonEmptyArray<T>(out: Array<T>): A.NonEmptyArray<T> {
  assertNonEmptyArray(out);
  return out;
}

function asNonEmptyReadonlyArray<T>(out: ReadonlyArray<T>): A.NonEmptyReadonlyArray<T> {
  assertNonEmptyReadonlyArray(out);
  return out;
}

/**
 * Like `Array.map` but asserts the result as `NonEmptyArray`.
 *
 * Safe because mapping a non-empty input always produces a non-empty output.
 * Supports both data-first and data-last calling conventions.
 *
 * @example
 * ```ts
 * import { pipe } from "effect"
 * import { A } from "@beep/utils"
 *
 * const items: A.NonEmptyReadonlyArray<number> = [1, 2, 3]
 *
 * // Data-first
 * const doubled = A.mapNonEmpty(items, (n) => n * 2)
 *
 * // Data-last (pipeable)
 * const tripled = pipe(items, A.mapNonEmpty((n) => n * 3))
 *
 * console.log(doubled)
 * console.log(tripled)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mapNonEmpty: {
  <T, U>(f: (a: T, i: number) => U): (self: A.NonEmptyReadonlyArray<T>) => A.NonEmptyArray<U>;
  <T, U>(self: A.NonEmptyReadonlyArray<T>, f: (a: T, i: number) => U): A.NonEmptyArray<U>;
} = dual(2, <T, U>(self: A.NonEmptyReadonlyArray<T>, f: (a: T, i: number) => U): A.NonEmptyArray<U> => {
  const result = A.map(self, f);
  assertNonEmptyArray(result);
  return result;
});

/**
 * Like `Array.flatMap` but asserts the result as `NonEmptyArray`.
 *
 * Safe because flat-mapping non-empty input with a function returning
 * non-empty arrays always produces a non-empty output.
 * Supports both data-first and data-last calling conventions.
 *
 * @example
 * ```ts
 * import { pipe } from "effect"
 * import { A } from "@beep/utils"
 *
 * const items: A.NonEmptyReadonlyArray<number> = [1, 2, 3]
 *
 * // Data-first
 * const expanded = A.flatMapNonEmpty(items, (n): A.NonEmptyReadonlyArray<number> => [n, n * 10])
 *
 * // Data-last (pipeable)
 * const doubled = pipe(items, A.flatMapNonEmpty((n): A.NonEmptyReadonlyArray<number> => [n, n]))
 *
 * console.log(expanded)
 * console.log(doubled)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const flatMapNonEmpty: {
  <T, U>(f: (a: T, i: number) => A.NonEmptyReadonlyArray<U>): (self: A.NonEmptyReadonlyArray<T>) => A.NonEmptyArray<U>;
  <T, U>(self: A.NonEmptyReadonlyArray<T>, f: (a: T, i: number) => A.NonEmptyReadonlyArray<U>): A.NonEmptyArray<U>;
} = dual(
  2,
  flow(
    <T, U>(self: A.NonEmptyReadonlyArray<T>, f: (a: T, i: number) => A.NonEmptyReadonlyArray<U>): A.NonEmptyArray<U> =>
      A.flatMap(self, f),
    asNonEmptyArray
  )
);

/**
 * Like `Array.map` but asserts the result as `NonEmptyReadonlyArray`.
 *
 * Safe because mapping a non-empty input always produces a non-empty output.
 * Supports both data-first and data-last calling conventions.
 *
 * @example
 * ```ts
 * import { pipe } from "effect"
 * import { A } from "@beep/utils"
 *
 * const items: A.NonEmptyReadonlyArray<string> = ["a", "b", "c"]
 *
 * // Data-first
 * const upper = A.mapNonEmptyReadonly(items, (s) => s.toUpperCase())
 *
 * // Data-last (pipeable)
 * const prefixed = pipe(items, A.mapNonEmptyReadonly((s) => `item-${s}`))
 *
 * console.log(upper)
 * console.log(prefixed)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mapNonEmptyReadonly: {
  <T, U>(f: (a: T, i: number) => U): (self: A.NonEmptyReadonlyArray<T>) => A.NonEmptyReadonlyArray<U>;
  <T, U>(self: A.NonEmptyReadonlyArray<T>, f: (a: T, i: number) => U): A.NonEmptyReadonlyArray<U>;
} = dual(2, <T, U>(self: A.NonEmptyReadonlyArray<T>, f: (a: T, i: number) => U): A.NonEmptyReadonlyArray<U> => {
  const result = A.map(self, f);
  assertNonEmptyReadonlyArray(result);
  return result;
});

/**
 * Like `Array.flatMap` but asserts the result as `NonEmptyReadonlyArray`.
 *
 * Safe because flat-mapping non-empty input with a function returning
 * non-empty arrays always produces a non-empty output.
 * Supports both data-first and data-last calling conventions.
 *
 * @example
 * ```ts
 * import { pipe } from "effect"
 * import { A } from "@beep/utils"
 *
 * const items: A.NonEmptyReadonlyArray<string> = ["hi", "bye"]
 *
 * // Data-first
 * const expanded = A.flatMapNonEmptyReadonly(
 *   items,
 *   (item): A.NonEmptyReadonlyArray<string> => [item, item.toUpperCase()]
 * )
 *
 * // Data-last (pipeable)
 * const doubled = pipe(
 *   items,
 *   A.flatMapNonEmptyReadonly((item): A.NonEmptyReadonlyArray<string> => [item, item])
 * )
 *
 * console.log(expanded)
 * console.log(doubled)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const flatMapNonEmptyReadonly: {
  <T, U>(
    f: (a: T, i: number) => A.NonEmptyReadonlyArray<U>
  ): (self: A.NonEmptyReadonlyArray<T>) => A.NonEmptyReadonlyArray<U>;
  <T, U>(
    self: A.NonEmptyReadonlyArray<T>,
    f: (a: T, i: number) => A.NonEmptyReadonlyArray<U>
  ): A.NonEmptyReadonlyArray<U>;
} = dual(
  2,
  <T, U>(
    self: A.NonEmptyReadonlyArray<T>,
    f: (a: T, i: number) => A.NonEmptyReadonlyArray<U>
  ): A.NonEmptyReadonlyArray<U> => asNonEmptyReadonlyArray(A.flatMap<T, U>(self, f))
);

/**
 * Finds the first index where `value` appears in `self`.
 *
 * Returns `Option.none()` when the value is absent instead of leaking the
 * native `-1` sentinel.
 *
 * @example
 * ```ts
 * import { pipe } from "effect"
 * import { A, O } from "@beep/utils"
 *
 * const index = pipe(["alpha", "beta"], A.indexOf("beta"))
 * console.log(O.getOrUndefined(index))
 * ```
 *
 * @category elements
 * @since 0.0.0
 */
export const indexOf: {
  <T>(value: T, fromIndex?: number): (self: ReadonlyArray<T>) => O.Option<number>;
  <T>(self: ReadonlyArray<T>, value: T, fromIndex?: number): O.Option<number>;
} = dual(
  (args) => args.length >= 2 && A.isArray(args[0]),
  <T>(self: ReadonlyArray<T>, value: T, fromIndex?: number): O.Option<number> => {
    const index = self.indexOf(value, fromIndex);
    return index === -1 ? O.none() : O.some(index);
  }
);

/**
 * Finds the last index where `value` appears in `self`.
 *
 * Returns `Option.none()` when the value is absent instead of leaking the
 * native `-1` sentinel.
 *
 * @example
 * ```ts
 * import { pipe } from "effect"
 * import { A, O } from "@beep/utils"
 *
 * const index = pipe(["a", "b", "a"], A.lastIndexOf("a"))
 * console.log(O.getOrUndefined(index))
 * ```
 *
 * @category elements
 * @since 0.0.0
 */
export const lastIndexOf: {
  <T>(value: T, fromIndex?: number): (self: ReadonlyArray<T>) => O.Option<number>;
  <T>(self: ReadonlyArray<T>, value: T, fromIndex?: number): O.Option<number>;
} = dual(
  (args) => args.length >= 2 && A.isArray(args[0]),
  <T>(self: ReadonlyArray<T>, value: T, fromIndex?: number): O.Option<number> => {
    const index = fromIndex === undefined ? self.lastIndexOf(value) : self.lastIndexOf(value, fromIndex);
    return index === -1 ? O.none() : O.some(index);
  }
);

/**
 * Returns an immutable copy of the selected range from `self`.
 *
 * This central wrapper preserves native `slice` range semantics while keeping
 * consumers on the Effect-first `A` helper surface.
 *
 * @example
 * ```ts
 * import { pipe } from "effect"
 * import { A } from "@beep/utils"
 *
 * const middle = pipe([1, 2, 3, 4], A.slice(1, 3))
 * console.log(middle)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const slice: {
  (start?: number, end?: number): <T>(self: ReadonlyArray<T>) => Array<T>;
  <T>(self: ReadonlyArray<T>, start?: number, end?: number): Array<T>;
} = dual(
  (args) => args.length >= 1 && A.isArray(args[0]),
  <T>(self: ReadonlyArray<T>, start?: number, end?: number): Array<T> => self.slice(start, end)
);

/**
 * Materializes array entries as readonly `[index, value]` pairs.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const indexed = A.entries(["x", "y"])
 * const first = indexed[0]
 *
 * console.log(first)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const entries = <T>(self: ReadonlyArray<T>): Array<readonly [number, T]> =>
  A.map(self, (value, index) => [index, value] as const);

/**
 * Materializes the numeric indexes of `self`.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const indexes = A.keys(["x", "y"])
 * console.log(indexes)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const keys = (self: ReadonlyArray<unknown>): Array<number> => A.makeBy(self.length, (index) => index);

/**
 * Returns a shallow immutable copy of the values in `self`.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const source = ["x", "y"]
 * const copy = A.values(source)
 *
 * console.log(copy)
 * console.log(copy === source)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const values = <T>(self: ReadonlyArray<T>): Array<T> => A.copy(self);

/**
 * Appends `value` to a mutable array and returns the same array reference.
 *
 * Use this only at mutation-preserving boundaries such as local accumulators,
 * queue state, or adapter APIs where replacing the array identity would change
 * behavior. Pure code should prefer `A.append`.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const values = [1, 2]
 * const same = A.appendInPlace(values, 3)
 *
 * console.log(same === values)
 * console.log(values)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const appendInPlace: {
  <T>(value: T): (self: Array<T>) => Array<T>;
  <T>(self: Array<T>, value: T): Array<T>;
} = dual(2, <T>(self: Array<T>, value: T): Array<T> => {
  self.push(value);
  return self;
});

/**
 * Appends all `values` to a mutable array and returns the same array reference.
 *
 * Use this only when mutation identity is intentional. Pure code should prefer
 * `A.appendAll`.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const values = ["a"]
 * A.appendAllInPlace(values, ["b", "c"])
 *
 * console.log(values)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const appendAllInPlace: {
  <T>(values: Iterable<T>): (self: Array<T>) => Array<T>;
  <T>(self: Array<T>, values: Iterable<T>): Array<T>;
} = dual(2, <T>(self: Array<T>, values: Iterable<T>): Array<T> => {
  for (const value of values) {
    self.push(value);
  }
  return self;
});

/**
 * Sorts a mutable array in place using an explicit `Order`.
 *
 * Prefer pure `A.sort` unless callers intentionally rely on the same array
 * reference being reordered.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 * import * as Order from "effect/Order"
 *
 * const values = [3, 1, 2]
 * const same = A.sortInPlace(values, Order.Number)
 *
 * console.log(same === values)
 * console.log(values)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sortInPlace: {
  <T>(order: Order.Order<T>): (self: Array<T>) => Array<T>;
  <T>(self: Array<T>, order: Order.Order<T>): Array<T>;
} = dual(2, <T>(self: Array<T>, order: Order.Order<T>): Array<T> => {
  self.sort(order);
  return self;
});

/**
 * Removes and inserts items in a mutable array and returns the removed values.
 *
 * This intentionally mirrors native `splice` return semantics while keeping
 * mutation explicit and centralized. Prefer immutable composition with
 * `A.remove`, `A.insertAt`, `A.appendAll`, and `A.slice` when identity is not
 * required.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const values = ["a", "b", "c"]
 * const removed = A.spliceInPlace(values, 1, 1, "x")
 *
 * console.log(removed)
 * console.log(values)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const spliceInPlace: {
  <T>(start: number, deleteCount?: number, ...items: Array<T>): (self: Array<T>) => Array<T>;
  <T>(self: Array<T>, start: number, deleteCount?: number, ...items: Array<T>): Array<T>;
} = dual(
  (args) => args.length >= 2 && A.isArray(args[0]),
  <T>(self: Array<T>, start: number, deleteCount?: number, ...items: Array<T>): Array<T> => {
    if (deleteCount === undefined) {
      return self.splice(start);
    }
    return self.splice(start, deleteCount, ...items);
  }
);

/**
 * Re-export of all helpers from `effect/Array`.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const values = A.makeReadonly("beep")
 * console.log(values)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/Array";

/**
 * Normalizes a value-or-array into a `ReadonlyArray`.
 *
 * If the input is already an array it is returned as-is; otherwise it is
 * wrapped in a single-element array via `Array.of`.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const single = A.makeReadonly("hello")
 * // ["hello"]
 *
 * const multi = A.makeReadonly(["a", "b"])
 * // ["a", "b"]
 *
 * console.log(single)
 * console.log(multi)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeReadonly = <T>(a: T | Array<T>): ReadonlyArray<T> => A.ensure(a);
/**
 * Converts an iterable into a `NonEmptyReadonlyArray`, asserting that at
 * least one element is present.
 *
 * Throws if the iterable yields zero elements.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const fromSet = A.fromIterableNonEmpty(new Set([1, 2, 3]))
 * // [1, 2, 3] narrowed to NonEmptyReadonlyArray<number>
 *
 * console.log(fromSet)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromIterableNonEmpty = <const TArray>(collection: Iterable<TArray>): A.NonEmptyReadonlyArray<TArray> =>
  asNonEmptyReadonlyArray(A.fromIterable(collection));

/**
 * Creates an empty array.
 *
 * **When to use**
 *
 * Use to create a typed empty readonly array without allocating placeholder elements.
 *
 * **Example** (Creating an empty readonly array)
 *
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const result = A.emptyReadonly<number>()
 * console.log(result) // []
 * ```
 *
 * @see {@link of} — create a single-element array
 * @see {@link make} — create from multiple values
 *
 * @category constructors
 * @since 0.0.0
 */
export const emptyReadonly: <A = never>() => ReadonlyArray<A> = () => [];
