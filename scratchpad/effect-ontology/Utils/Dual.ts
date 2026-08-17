/**
 * Internal constructors for fixed-arity dual APIs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";

/** @internal */
export const dual2 = <Self, That, Result>(body: (self: Self, that: That) => Result) =>
  dual<(that: That) => (self: Self) => Result, (self: Self, that: That) => Result>(2, body);

/** @internal */
export const dual3 = <Self, First, Second, Result>(body: (self: Self, first: First, second: Second) => Result) =>
  dual<(first: First, second: Second) => (self: Self) => Result, (self: Self, first: First, second: Second) => Result>(
    3,
    body
  );

/** @internal */
export const dual4 = <Self, First, Second, Third, Result>(
  body: (self: Self, first: First, second: Second, third: Third) => Result
) =>
  dual<
    (first: First, second: Second, third: Third) => (self: Self) => Result,
    (self: Self, first: First, second: Second, third: Third) => Result
  >(4, body);

/** @internal */
export const dual5 = <Self, First, Second, Third, Fourth, Result>(
  body: (self: Self, first: First, second: Second, third: Third, fourth: Fourth) => Result
) =>
  dual<
    (first: First, second: Second, third: Third, fourth: Fourth) => (self: Self) => Result,
    (self: Self, first: First, second: Second, third: Third, fourth: Fourth) => Result
  >(5, body);

/** @internal */
export const dual6 = <Self, First, Second, Third, Fourth, Fifth, Result>(
  body: (self: Self, first: First, second: Second, third: Third, fourth: Fourth, fifth: Fifth) => Result
) =>
  dual<
    (first: First, second: Second, third: Third, fourth: Fourth, fifth: Fifth) => (self: Self) => Result,
    (self: Self, first: First, second: Second, third: Third, fourth: Fourth, fifth: Fifth) => Result
  >(6, body);
