/**
 * Internal constructors for fixed-arity dual APIs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";

/**
 * Lifts a binary data-first function into equivalent data-first and data-last call forms.
 *
 * **Example** (Call a binary operation in both forms)
 *
 * ```ts
 * import { dual2 } from "@effect-ontology/Utils/Dual"
 *
 * const add = dual2((self: number, that: number) => self + that)
 * console.log(add(1, 2)) // 3
 * console.log(add(2)(1)) // 3
 * ```
 *
 * @internal
 * @category combinators
 * @since 0.0.0
 */
export const dual2 = <Self, That, Result>(body: (self: Self, that: That) => Result) =>
  dual<(that: That) => (self: Self) => Result, (self: Self, that: That) => Result>(2, body);

/**
 * Lifts a ternary data-first function into equivalent data-first and data-last call forms.
 *
 * **Example** (Call a ternary operation in both forms)
 *
 * ```ts
 * import { dual3 } from "@effect-ontology/Utils/Dual"
 *
 * const add = dual3((self: number, first: number, second: number) => self + first + second)
 * console.log(add(1, 2, 3)) // 6
 * console.log(add(2, 3)(1)) // 6
 * ```
 *
 * @internal
 * @category combinators
 * @since 0.0.0
 */
export const dual3 = <Self, First, Second, Result>(body: (self: Self, first: First, second: Second) => Result) =>
  dual<(first: First, second: Second) => (self: Self) => Result, (self: Self, first: First, second: Second) => Result>(
    3,
    body
  );

/**
 * Lifts a four-argument data-first function into equivalent data-first and data-last call forms.
 *
 * **Example** (Call a four-argument operation in both forms)
 *
 * ```ts
 * import { dual4 } from "@effect-ontology/Utils/Dual"
 *
 * const add = dual4((self: number, first: number, second: number, third: number) =>
 *   self + first + second + third
 * )
 * console.log(add(1, 2, 3, 4)) // 10
 * console.log(add(2, 3, 4)(1)) // 10
 * ```
 *
 * @internal
 * @category combinators
 * @since 0.0.0
 */
export const dual4 = <Self, First, Second, Third, Result>(
  body: (self: Self, first: First, second: Second, third: Third) => Result
) =>
  dual<
    (first: First, second: Second, third: Third) => (self: Self) => Result,
    (self: Self, first: First, second: Second, third: Third) => Result
  >(4, body);

/**
 * Lifts a five-argument data-first function into equivalent data-first and data-last call forms.
 *
 * **Example** (Call a five-argument operation in both forms)
 *
 * ```ts
 * import { dual5 } from "@effect-ontology/Utils/Dual"
 *
 * const add = dual5((self: number, first: number, second: number, third: number, fourth: number) =>
 *   self + first + second + third + fourth
 * )
 * console.log(add(1, 2, 3, 4, 5)) // 15
 * console.log(add(2, 3, 4, 5)(1)) // 15
 * ```
 *
 * @internal
 * @category combinators
 * @since 0.0.0
 */
export const dual5 = <Self, First, Second, Third, Fourth, Result>(
  body: (self: Self, first: First, second: Second, third: Third, fourth: Fourth) => Result
) =>
  dual<
    (first: First, second: Second, third: Third, fourth: Fourth) => (self: Self) => Result,
    (self: Self, first: First, second: Second, third: Third, fourth: Fourth) => Result
  >(5, body);

/**
 * Lifts a six-argument data-first function into equivalent data-first and data-last call forms.
 *
 * **Example** (Call a six-argument operation in both forms)
 *
 * ```ts
 * import { dual6 } from "@effect-ontology/Utils/Dual"
 *
 * const add = dual6((self: number, first: number, second: number, third: number, fourth: number, fifth: number) =>
 *   self + first + second + third + fourth + fifth
 * )
 * console.log(add(1, 2, 3, 4, 5, 6)) // 21
 * console.log(add(2, 3, 4, 5, 6)(1)) // 21
 * ```
 *
 * @internal
 * @category combinators
 * @since 0.0.0
 */
export const dual6 = <Self, First, Second, Third, Fourth, Fifth, Result>(
  body: (self: Self, first: First, second: Second, third: Third, fourth: Fourth, fifth: Fifth) => Result
) =>
  dual<
    (first: First, second: Second, third: Third, fourth: Fourth, fifth: Fifth) => (self: Self) => Result,
    (self: Self, first: First, second: Second, third: Third, fourth: Fourth, fifth: Fifth) => Result
  >(6, body);
