/**
 * Algebraic monoid primitives and reusable instances.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str, thunk0 } from "@beep/utils";
import { HashMap, HashSet } from "effect";
import { dual } from "effect/Function";
// =============================================================================
// Core Monoid Type Class
// =============================================================================

/**
 * Monoid type class
 *
 * A monoid is an algebraic structure with:
 * - An identity element (empty)
 * - An associative binary operation (combine)
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import { dual } from "effect/Function"
 *
 * const combineScores: Monoid.Monoid<number>["combine"] = dual(2, (left, right) => left + right)
 * const Sum: Monoid.Monoid<number> = Monoid.make(0, combineScores)
 * const total = Monoid.fold(Sum)([2, 3, 5])
 *
 * console.log(total)
 * // 10
 * ```
 *
 * @typeParam A - The carrier type
 *
 * @since 0.0.0
 * @category models
 */
export interface Monoid<A> {
  /**
   * Associative binary operation
   * Must satisfy: combine(combine(x, y), z) = combine(x, combine(y, z))
   */
  readonly combine: {
    (x: A, y: A): A;
    (y: A): (x: A) => A;
  };
  /**
   * The identity element
   * Must satisfy: combine(empty, x) = x = combine(x, empty)
   */
  readonly empty: A;
}

/**
 * Helper to create a Monoid instance
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import { dual } from "effect/Function"
 *
 * const combineScores: Monoid.Monoid<number>["combine"] = dual(2, (left, right) => left + right)
 * const scoreMonoid = Monoid.make(0, combineScores)
 * const score = scoreMonoid.combine(7, 4)
 *
 * console.log(score)
 * // 11
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const make = <A>(empty: A, combine: Monoid<A>["combine"]): Monoid<A> => ({
  empty,
  combine,
});

/**
 * Fold a collection using a monoid
 * This is the fundamental aggregation operation.
 *
 * Category theory: This is a catamorphism from the list functor to the monoid.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const totalCharacters = Monoid.fold(Monoid.NumberSum)([5, 8, 13])
 *
 * console.log(totalCharacters)
 * // 26
 * ```
 *
 * @since 0.0.0
 * @category folding
 */
export const fold =
  <A>(monoid: Monoid<A>) =>
  (values: Iterable<A>): A => {
    let result = monoid.empty;
    for (const value of values) {
      result = monoid.combine(result, value);
    }
    return result;
  };

/**
 * Combine an array of values using a monoid, seeded with the identity.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const joined = Monoid.combineAll(Monoid.StringJoin(" / "))(["title", "summary", "body"])
 *
 * console.log(joined)
 * // "title / summary / body"
 * ```
 *
 * @since 0.0.0
 * @category folding
 */
export const combineAll =
  <A>(monoid: Monoid<A>) =>
  (values: ReadonlyArray<A>): A =>
    values.reduce(monoid.combine, monoid.empty);

// =============================================================================
// String Monoids
// =============================================================================

/**
 * String concatenation monoid.
 *
 * - Empty: ""
 * - Combine: (x, y) =\> x + y
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const token = Monoid.fold(Monoid.StringConcat)(["sub", "word"])
 *
 * console.log(token)
 * // "subword"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const StringConcat: Monoid<string> = {
  empty: "",
  combine: dual(2, (x, y) => x + y),
};

/**
 * String join with separator monoid.
 *
 * Combines strings with a separator, intelligently handling empty strings.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const phrase = Monoid.fold(Monoid.StringJoin(" "))(["effect", "", "schemas"])
 *
 * console.log(phrase)
 * // "effect schemas"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const StringJoin = (separator: string): Monoid<string> => ({
  empty: "",
  combine: dual(2, (x, y) => {
    if (Str.isEmpty(x)) return y;
    if (Str.isEmpty(y)) return x;
    return `${x}${separator}${y}`;
  }),
});

/**
 * String join with prefix and suffix, useful for creating delimited lists.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const list = Monoid.fold(Monoid.StringDelimited({ prefix: "[", suffix: "]", separator: ", " }))(["alpha", "beta", "gamma"])
 *
 * console.log(list)
 * // "[alpha, beta, gamma]"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const StringDelimited = (options: {
  readonly prefix: string;
  readonly suffix: string;
  readonly separator: string;
}): Monoid<string> => {
  const { prefix, suffix, separator } = options;
  return {
    empty: "",
    combine: dual(2, (x, y) => {
      if (Str.isEmpty(x) && Str.isEmpty(y)) return "";
      if (Str.isEmpty(x)) return `${prefix}${y}${suffix}`;
      if (Str.isEmpty(y)) return `${prefix}${x}${suffix}`;
      const inner = `${Str.slice(prefix.length, -suffix.length)(x)}${separator}${Str.slice(prefix.length, -suffix.length)(y)}`;
      return `${prefix}${inner}${suffix}`;
    }),
  };
};

// =============================================================================
// Numeric Monoids
// =============================================================================

/**
 * Addition monoid for numbers (empty: 0).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const wordCount = Monoid.fold(Monoid.NumberSum)([120, 80, 30])
 *
 * console.log(wordCount)
 * // 230
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const NumberSum: Monoid<number> = {
  empty: 0,
  combine: dual(2, (x, y) => x + y),
};

/**
 * Multiplication monoid for numbers (empty: 1).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const combinedWeight = Monoid.fold(Monoid.NumberProduct)([0.8, 0.5, 0.25])
 *
 * console.log(combinedWeight)
 * // 0.1
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const NumberProduct: Monoid<number> = {
  empty: 1,
  combine: dual(2, (x, y) => x * y),
};

/**
 * Max monoid for numbers (empty: -Infinity).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const peakScore = Monoid.fold(Monoid.NumberMax)([0.42, 0.91, 0.73])
 *
 * console.log(peakScore)
 * // 0.91
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const NumberMax: Monoid<number> = {
  empty: Number.NEGATIVE_INFINITY,
  combine: dual(2, (x, y) => Math.max(x, y)),
};

/**
 * Min monoid for numbers (empty: Infinity).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const nearestDistance = Monoid.fold(Monoid.NumberMin)([12, 4, 19])
 *
 * console.log(nearestDistance)
 * // 4
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const NumberMin: Monoid<number> = {
  empty: Number.POSITIVE_INFINITY,
  combine: dual(2, (x, y) => Math.min(x, y)),
};

// =============================================================================
// Array Monoids
// =============================================================================

/**
 * Array concatenation monoid (empty: []).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const tokens = Monoid.fold(Monoid.ArrayConcat<string>())([["effect"], ["schema", "model"]])
 *
 * console.log(tokens)
 * // ["effect", "schema", "model"]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const ArrayConcat = <A>(): Monoid<ReadonlyArray<A>> => ({
  empty: [],
  combine: dual(2, (x, y) => [...x, ...y]),
});

// =============================================================================
// Collection Monoids (Bag-of-Words, Multisets)
// =============================================================================

/**
 * Multiset (bag) union monoid.
 *
 * A multiset is a collection where elements can appear multiple times.
 * Union adds the multiplicities.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import { HashMap } from "effect"
 *
 * const first = HashMap.make(["effect", 2], ["schema", 1])
 * const second = HashMap.make(["effect", 3], ["nlp", 1])
 * const counts = Monoid.MultiSet<string>().combine(first, second)
 *
 * console.log(HashMap.get(counts, "effect"))
 * // Option.some(5)
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const MultiSet = <K>(): Monoid<HashMap.HashMap<K, number>> => ({
  empty: HashMap.empty(),
  combine: dual(2, (x, y) =>
    HashMap.reduce(y, x, (map: HashMap.HashMap<K, number>, count: number, key: K) =>
      HashMap.modifyAt(map, key, (existing: O.Option<number>) => O.some(O.getOrElse(existing, thunk0) + count))
    )
  ),
});

/**
 * Set union monoid (empty: ∅).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import * as HashSet from "effect/HashSet"
 *
 * const vocabulary = Monoid.fold(Monoid.SetUnion<string>())([
 *   HashSet.make("effect", "schema"),
 *   HashSet.make("schema", "nlp")
 * ])
 *
 * console.log(Array.from(vocabulary).sort())
 * // ["effect", "nlp", "schema"]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const SetUnion = <A>(): Monoid<HashSet.HashSet<A>> => ({
  empty: HashSet.empty(),
  combine: dual(2, (x, y) => HashSet.union(x, y)),
});

/**
 * Set intersection monoid.
 *
 * Note: There is no universal identity element for intersection over an
 * unbounded universe, so we model the identity as the "universal set" via
 * `Option.none()` (intersecting with the universal set is the identity).
 * Only use when all elements come from a finite universe.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const commonTags = Monoid.fold(Monoid.SetIntersection<string>())([
 *   O.some(HashSet.make("noun", "topic", "entity")),
 *   O.some(HashSet.make("topic", "entity"))
 * ])
 *
 * console.log(O.map(commonTags, (tags) => Array.from(tags).sort()))
 * // Option.some(["entity", "topic"])
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const SetIntersection: <A>() => Monoid<O.Option<HashSet.HashSet<A>>> = <A>(): Monoid<
  O.Option<HashSet.HashSet<A>>
> => ({
  empty: O.none(),
  combine: dual(2, (x, y) => {
    if (O.isNone(x)) return y;
    if (O.isNone(y)) return x;
    return O.some(HashSet.intersection(x.value, y.value));
  }),
});

// =============================================================================
// Vector Monoids (for embeddings)
// =============================================================================

/**
 * Vector addition monoid (element-wise addition; empty: zero vector).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const embeddingSum = Monoid.fold(Monoid.VectorAdd(3))([
 *   [1, 2, 3],
 *   [4, 5, 6]
 * ])
 *
 * console.log(embeddingSum)
 * // [5, 7, 9]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const VectorAdd = (dimension: number): Monoid<ReadonlyArray<number>> => ({
  empty: A.replicate(0, dimension),
  combine: dual(2, (x, y) => A.map(x, (xi, i) => xi + (y[i] ?? 0))),
});

/**
 * Vector average monoid (tracks sum and count to compute a running average).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const accumulated = Monoid.fold(Monoid.VectorAverage(2))([
 *   { sum: [2, 4], count: 1 },
 *   { sum: [4, 8], count: 1 }
 * ])
 * const average = Monoid.getAverage(accumulated)
 *
 * console.log(average)
 * // [3, 6]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const VectorAverage = (
  dimension: number
): Monoid<{ readonly sum: ReadonlyArray<number>; readonly count: number }> => ({
  empty: { sum: A.replicate(0, dimension), count: 0 },
  combine: dual(2, (x, y) => ({
    sum: A.map(x.sum, (xi, i) => xi + (y.sum[i] ?? 0)),
    count: x.count + y.count,
  })),
});

/**
 * Extract the average from a {@link VectorAverage} result.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const average = Monoid.getAverage({ sum: [12, 18], count: 3 })
 *
 * console.log(average)
 * // [4, 6]
 * ```
 *
 * @since 0.0.0
 * @category accessors
 */
export const getAverage = (result: {
  readonly sum: ReadonlyArray<number>;
  readonly count: number;
}): ReadonlyArray<number> => (result.count === 0 ? result.sum : A.map(result.sum, (x) => x / result.count));

// =============================================================================
// Tuple Monoids (Product)
// =============================================================================

/**
 * Product monoid: combine two monoids component-wise.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const Stats = Monoid.Product(Monoid.NumberSum, Monoid.NumberMax)
 * const result = Monoid.fold(Stats)([
 *   [10, 0.4],
 *   [15, 0.9]
 * ])
 *
 * console.log(result)
 * // [25, 0.9]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const Product: {
  <A, B>(ma: Monoid<A>, mb: Monoid<B>): Monoid<readonly [A, B]>;
  <B>(mb: Monoid<B>): <A>(ma: Monoid<A>) => Monoid<readonly [A, B]>;
} = dual(
  2,
  <A, B>(ma: Monoid<A>, mb: Monoid<B>): Monoid<readonly [A, B]> => ({
    empty: [ma.empty, mb.empty],
    combine: dual(2, ([xa, xb], [ya, yb]) => [ma.combine(xa, ya), mb.combine(xb, yb)]),
  })
);

/**
 * Triple product monoid.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const CorpusStats = Monoid.Product3(Monoid.NumberSum, Monoid.NumberSum, Monoid.NumberMax)
 * const result = Monoid.fold(CorpusStats)([
 *   [100, 4, 0.71],
 *   [80, 3, 0.92]
 * ])
 *
 * console.log(result)
 * // [180, 7, 0.92]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const Product3: {
  <A, B, C>(ma: Monoid<A>, mb: Monoid<B>, mc: Monoid<C>): Monoid<readonly [A, B, C]>;
  <B, C>(mb: Monoid<B>, mc: Monoid<C>): <A>(ma: Monoid<A>) => Monoid<readonly [A, B, C]>;
} = dual(
  3,
  <A, B, C>(ma: Monoid<A>, mb: Monoid<B>, mc: Monoid<C>): Monoid<readonly [A, B, C]> => ({
    empty: [ma.empty, mb.empty, mc.empty],
    combine: dual(2, ([xa, xb, xc], [ya, yb, yc]) => [ma.combine(xa, ya), mb.combine(xb, yb), mc.combine(xc, yc)]),
  })
);

// =============================================================================
// Functor Monoids
// =============================================================================

/**
 * Lift a monoid through Option: combine point-wise, treating `None` as the identity.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import * as O from "effect/Option"
 *
 * const OptionalScores = Monoid.Option(Monoid.NumberSum)
 * const score = Monoid.fold(OptionalScores)([O.some(2), O.none(), O.some(5)])
 *
 * console.log(score)
 * // Option.some(7)
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const Option = <A>(monoid: Monoid<A>): Monoid<O.Option<A>> => ({
  empty: O.none(),
  combine: dual(2, (x, y) => {
    if (O.isNone(x)) return y;
    if (O.isNone(y)) return x;

    return O.some(monoid.combine(x.value, y.value));
  }),
});

// =============================================================================
// Endomorphism Monoid
// =============================================================================

/**
 * Endomorphism monoid: functions from A to A under composition (empty: identity).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const normalize = Monoid.fold(Monoid.Endo<string>())([
 *   (value) => value.trim(),
 *   (value) => value.toLowerCase()
 * ])
 * const result = normalize("  EFFECT  ")
 *
 * console.log(result)
 * // "effect"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const Endo = <A>(): Monoid<(a: A) => A> => ({
  empty: (a) => a,
  combine: dual(2, (f, g) => (a: A) => f(g(a))),
});

// =============================================================================
// Dual Monoid
// =============================================================================

/**
 * Dual monoid: reverse the order of combination (x ⊕' y = y ⊕ x).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const reversed = Monoid.fold(Monoid.Dual(Monoid.StringJoin(" -> ")))(["parse", "rank", "answer"])
 *
 * console.log(reversed)
 * // "answer -> rank -> parse"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const Dual = <A>(monoid: Monoid<A>): Monoid<A> => ({
  empty: monoid.empty,
  combine: dual(2, (x, y) => monoid.combine(y, x)),
});

// =============================================================================
// Boolean Monoids
// =============================================================================

/**
 * Logical AND monoid (empty: true).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const allChecksPassed = Monoid.fold(Monoid.BooleanAll)([true, true, false])
 *
 * console.log(allChecksPassed)
 * // false
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const BooleanAll: Monoid<boolean> = {
  empty: true,
  combine: dual(2, (x, y) => x && y),
};

/**
 * Logical OR monoid (empty: false).
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const anyMatch = Monoid.fold(Monoid.BooleanAny)([false, false, true])
 *
 * console.log(anyMatch)
 * // true
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const BooleanAny: Monoid<boolean> = {
  empty: false,
  combine: dual(2, (x, y) => x || y),
};

// =============================================================================
// Monoid Laws (for testing)
// =============================================================================

/**
 * Check left identity law: empty ⊕ x = x
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const valid = Monoid.checkLeftIdentity(Monoid.StringJoin(" "), { x: "token" })
 *
 * console.log(valid)
 * // true
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const checkLeftIdentity: {
  <A>(monoid: Monoid<A>, options: { readonly x: A; readonly equals?: (a: A, b: A) => boolean }): boolean;
  <A>(options: { readonly x: A; readonly equals?: (a: A, b: A) => boolean }): (monoid: Monoid<A>) => boolean;
} = dual(2, <A>(monoid: Monoid<A>, options: { readonly x: A; readonly equals?: (a: A, b: A) => boolean }): boolean => {
  const { x, equals = (a: A, b: A) => a === b } = options;
  return equals(monoid.combine(monoid.empty, x), x);
});

/**
 * Check right identity law: x ⊕ empty = x
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const valid = Monoid.checkRightIdentity(Monoid.NumberSum, { x: 42 })
 *
 * console.log(valid)
 * // true
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const checkRightIdentity: {
  <A>(monoid: Monoid<A>, options: { readonly x: A; readonly equals?: (a: A, b: A) => boolean }): boolean;
  <A>(options: { readonly x: A; readonly equals?: (a: A, b: A) => boolean }): (monoid: Monoid<A>) => boolean;
} = dual(2, <A>(monoid: Monoid<A>, options: { readonly x: A; readonly equals?: (a: A, b: A) => boolean }): boolean => {
  const { x, equals = (a: A, b: A) => a === b } = options;
  return equals(monoid.combine(x, monoid.empty), x);
});

/**
 * Check associativity law: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const valid = Monoid.checkAssociativity({ monoid: Monoid.NumberProduct, x: 2, y: 3, z: 4 })
 *
 * console.log(valid)
 * // true
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const checkAssociativity = <A>(options: {
  readonly monoid: Monoid<A>;
  readonly x: A;
  readonly y: A;
  readonly z: A;
  readonly equals?: (a: A, b: A) => boolean;
}): boolean => {
  const { monoid, x, y, z, equals = (a, b) => a === b } = options;
  const left = monoid.combine(monoid.combine(x, y), z);
  const right = monoid.combine(x, monoid.combine(y, z));
  return equals(left, right);
};

/**
 * Check all monoid laws against a representative triple.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 *
 * const valid = Monoid.checkLaws(Monoid.NumberSum, { values: [1, 2, 3] })
 *
 * console.log(valid)
 * // true
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const checkLaws: {
  <A>(
    monoid: Monoid<A>,
    options: { readonly values: readonly [A, A, A]; readonly equals?: (a: A, b: A) => boolean }
  ): boolean;
  <A>(options: {
    readonly values: readonly [A, A, A];
    readonly equals?: (a: A, b: A) => boolean;
  }): (monoid: Monoid<A>) => boolean;
} = dual(
  2,
  <A>(
    monoid: Monoid<A>,
    options: { readonly values: readonly [A, A, A]; readonly equals?: (a: A, b: A) => boolean }
  ): boolean => {
    const { values, equals = (a: A, b: A) => a === b } = options;
    const [x, y, z] = values;
    return (
      checkLeftIdentity(monoid, { x, equals }) &&
      checkRightIdentity(monoid, { x, equals }) &&
      checkAssociativity({ monoid, x, y, z, equals })
    );
  }
);
