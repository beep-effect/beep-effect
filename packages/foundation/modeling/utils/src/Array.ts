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
 * **Details**
 *
 * A thin wrapper around `Array.match` that collapses a readonly array into a
 * boolean without inspecting its elements.
 *
 * **Example** (Non-empty vs empty arrays)
 *
 * ```ts import.meta.vitest name="Non-empty vs empty arrays"
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
 * **Details**
 *
 * Uses `Schema.asserts` under the hood so the error includes full decode
 * context when the assertion fails.
 *
 * **Example** (Assert and narrow mutable)
 *
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
 * **Details**
 *
 * Uses `Schema.asserts` under the hood so the error includes full decode
 * context when the assertion fails.
 *
 * **Example** (Assert and narrow readonly)
 *
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
 * **Details**
 *
 * Safe because mapping a non-empty input always produces a non-empty output.
 * Supports both data-first and data-last calling conventions.
 *
 * **Example** (Data-first and data-last map)
 *
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
 * **Details**
 *
 * Safe because flat-mapping non-empty input with a function returning
 * non-empty arrays always produces a non-empty output.
 * Supports both data-first and data-last calling conventions.
 *
 * **Example** (Data-first and data-last flatMap)
 *
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
 * **Details**
 *
 * Safe because mapping a non-empty input always produces a non-empty output.
 * Supports both data-first and data-last calling conventions.
 *
 * **Example** (Readonly data-first and data-last)
 *
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
 * **Details**
 *
 * Safe because flat-mapping non-empty input with a function returning
 * non-empty arrays always produces a non-empty output.
 * Supports both data-first and data-last calling conventions.
 *
 * **Example** (Readonly flatMap both styles)
 *
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
 * Options accepted by the `fromIndex`-taking element-lookup helpers
 * (`indexOf`, `lastIndexOf`).
 */
interface IndexLookupOptions {
  readonly fromIndex?: number;
}

/** Shared dual call-signature for `indexOf`/`lastIndexOf`. */
type IndexLookupSignature = {
  <T>(value: T, options?: IndexLookupOptions): (self: ReadonlyArray<T>) => O.Option<number>;
  <T>(self: ReadonlyArray<T>, value: T, options?: IndexLookupOptions): O.Option<number>;
};

const hasArrayAndValueArgs = (args: IArguments): boolean => args.length >= 2 && A.isArray(args[0]);

/** Wraps a native `-1`-sentinel index lookup result as an `Option`. */
const optionFromNativeIndex = (index: number): O.Option<number> => (index === -1 ? O.none() : O.some(index));

/**
 * Finds the first index where `value` appears in `self`.
 *
 * **Details**
 *
 * Returns `Option.none()` when the value is absent instead of leaking the
 * native `-1` sentinel. The optional `fromIndex` is collapsed into an options
 * object so the helper stays schema-shaped rather than mirroring the native
 * positional overload.
 *
 * **Example** (Find index with Option)
 *
 * ```ts import.meta.vitest name="Find index with Option"
 * import { pipe } from "effect"
 * import { A, O } from "@beep/utils"
 *
 * const index = pipe(["alpha", "beta"], A.indexOf("beta"))
 * console.log(O.getOrUndefined(index))
 *
 * const fromOffset = A.indexOf(["a", "b", "a"], "a", { fromIndex: 1 })
 * console.log(O.getOrUndefined(fromOffset))
 * ```
 *
 * @category elements
 * @since 0.0.0
 */
export const indexOf: IndexLookupSignature = dual(
  hasArrayAndValueArgs,
  <T>(self: ReadonlyArray<T>, value: T, options?: IndexLookupOptions): O.Option<number> =>
    optionFromNativeIndex(self.indexOf(value, options?.fromIndex))
);

/**
 * Finds the last index where `value` appears in `self`.
 *
 * **Details**
 *
 * Returns `Option.none()` when the value is absent instead of leaking the
 * native `-1` sentinel. The optional `fromIndex` is collapsed into an options
 * object so the helper stays schema-shaped rather than mirroring the native
 * positional overload.
 *
 * **Example** (Find last index with Option)
 *
 * ```ts import.meta.vitest name="Find last index with Option"
 * import { pipe } from "effect"
 * import { A, O } from "@beep/utils"
 *
 * const index = pipe(["a", "b", "a"], A.lastIndexOf("a"))
 * console.log(O.getOrUndefined(index))
 *
 * const fromOffset = A.lastIndexOf(["a", "b", "a"], "a", { fromIndex: 1 })
 * console.log(O.getOrUndefined(fromOffset))
 * ```
 *
 * @category elements
 * @since 0.0.0
 */
export const lastIndexOf: IndexLookupSignature = dual(
  hasArrayAndValueArgs,
  <T>(self: ReadonlyArray<T>, value: T, options?: IndexLookupOptions): O.Option<number> =>
    optionFromNativeIndex(
      options?.fromIndex === undefined ? self.lastIndexOf(value) : self.lastIndexOf(value, options.fromIndex)
    )
);

/**
 * Returns an immutable copy of the selected range from `self`.
 *
 * **Details**
 *
 * The `start`/`end` range is an options object rather than the native
 * positional `slice(start, end)` overload, keeping the helper's public shape
 * options-object-first per RC-DUAL rather than mirroring native call syntax.
 *
 * **Example** (Slice with options object)
 *
 * ```ts import.meta.vitest name="Slice with options object"
 * import { pipe } from "effect"
 * import { A } from "@beep/utils"
 *
 * const middle = pipe([1, 2, 3, 4], A.slice({ start: 1, end: 3 }))
 * console.log(middle)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const slice: {
  (options?: { readonly start?: number; readonly end?: number }): <T>(self: ReadonlyArray<T>) => Array<T>;
  <T>(self: ReadonlyArray<T>, options?: { readonly start?: number; readonly end?: number }): Array<T>;
} = dual(
  (args) => args.length >= 1 && A.isArray(args[0]),
  <T>(self: ReadonlyArray<T>, options?: { readonly start?: number; readonly end?: number }): Array<T> =>
    self.slice(options?.start, options?.end)
);

/**
 * Materializes array entries as readonly `[index, value]` pairs.
 *
 * **Example** (Index-value entry pairs)
 *
 * ```ts import.meta.vitest name="Index-value entry pairs"
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
 * **Example** (Materialize numeric indexes)
 *
 * ```ts import.meta.vitest name="Materialize numeric indexes"
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
 * **Example** (Shallow immutable value copy)
 *
 * ```ts import.meta.vitest name="Shallow immutable value copy"
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
 * **Details**
 *
 * Use this only at mutation-preserving boundaries such as local accumulators,
 * queue state, or adapter APIs where replacing the array identity would change
 * behavior. Pure code should prefer `A.append`.
 *
 * **Example** (Mutating append same reference)
 *
 * ```ts import.meta.vitest name="Mutating append same reference"
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
 * **Details**
 *
 * Use this only when mutation identity is intentional. Pure code should prefer
 * `A.appendAll`.
 *
 * **Example** (Mutating append multiple values)
 *
 * ```ts import.meta.vitest name="Mutating append multiple values"
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
 * **Details**
 *
 * Prefer pure `A.sort` unless callers intentionally rely on the same array
 * reference being reordered.
 *
 * **Example** (In-place sort with Order)
 *
 * ```ts import.meta.vitest name="In-place sort with Order"
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
 * **Details**
 *
 * The native `splice(start, deleteCount, ...items)` variadic-insert shape is
 * collapsed into a single options object (`items` as an array field) so the
 * helper stays object-shaped per RC-DUAL, at the cost of the native
 * "just append more args" ergonomics for multi-item inserts. Prefer immutable
 * composition with `A.remove`, `A.insertAt`, `A.appendAll`, and `A.slice` when
 * identity is not required.
 *
 * **Example** (In-place splice with options)
 *
 * ```ts import.meta.vitest name="In-place splice with options"
 * import { A } from "@beep/utils"
 *
 * const values = ["a", "b", "c"]
 * const removed = A.spliceInPlace(values, { start: 1, deleteCount: 1, items: ["x"] })
 *
 * console.log(removed)
 * console.log(values)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const spliceInPlace: {
  <T>(options: {
    readonly start: number;
    readonly deleteCount?: number;
    readonly items?: ReadonlyArray<T>;
  }): (self: Array<T>) => Array<T>;
  <T>(
    self: Array<T>,
    options: { readonly start: number; readonly deleteCount?: number; readonly items?: ReadonlyArray<T> }
  ): Array<T>;
} = dual(
  2,
  <T>(
    self: Array<T>,
    options: { readonly start: number; readonly deleteCount?: number; readonly items?: ReadonlyArray<T> }
  ): Array<T> => {
    const { start, deleteCount, items = [] } = options;
    if (deleteCount === undefined) {
      return self.splice(start);
    }
    return self.splice(start, deleteCount, ...items);
  }
);

/**
 * Re-export of all helpers from `effect/Array`.
 *
 * **Example** (Re-export makeReadonly usage)
 *
 * ```ts import.meta.vitest name="Re-export makeReadonly usage"
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
 * **Details**
 *
 * If the input is already an array it is returned as-is; otherwise it is
 * wrapped in a single-element array via `Array.of`.
 *
 * **Example** (Normalize value or array)
 *
 * ```ts import.meta.vitest name="Normalize value or array"
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
 * **Details**
 *
 * Throws if the iterable yields zero elements.
 *
 * **Example** (Non-empty from Set iterable)
 *
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
 * **Details**
 *
 * Use to create a typed empty readonly array without allocating placeholder elements.
 *
 * **Example** (Typed empty readonly array)
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
 * @category constructors
 * @since 0.0.0
 */
export const emptyReadonly: <A = never>() => ReadonlyArray<A> = () => [];
