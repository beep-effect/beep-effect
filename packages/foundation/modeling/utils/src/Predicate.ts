/**
 * Predicate helpers and re-exports for structural runtime checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";

type ChainRefinementBuilder<Start> = {
  <A extends Start>(refinements: readonly [P.Refinement<Start, A>]): P.Refinement<Start, A>;
  <A extends Start, B extends A>(
    refinements: readonly [P.Refinement<Start, A>, P.Refinement<A, B>]
  ): P.Refinement<Start, B>;
  <A extends Start, B extends A, C extends B>(
    refinements: readonly [P.Refinement<Start, A>, P.Refinement<A, B>, P.Refinement<B, C>]
  ): P.Refinement<Start, C>;
  <A extends Start, B extends A, C extends B, D extends C>(
    refinements: readonly [P.Refinement<Start, A>, P.Refinement<A, B>, P.Refinement<B, C>, P.Refinement<C, D>]
  ): P.Refinement<Start, D>;
  <A extends Start, B extends A, C extends B, D extends C, E extends D>(
    refinements: readonly [
      P.Refinement<Start, A>,
      P.Refinement<A, B>,
      P.Refinement<B, C>,
      P.Refinement<C, D>,
      P.Refinement<D, E>,
    ]
  ): P.Refinement<Start, E>;
  <A extends Start, B extends A, C extends B, D extends C, E extends D, F extends E>(
    refinements: readonly [
      P.Refinement<Start, A>,
      P.Refinement<A, B>,
      P.Refinement<B, C>,
      P.Refinement<C, D>,
      P.Refinement<D, E>,
      P.Refinement<E, F>,
    ]
  ): P.Refinement<Start, F>;
  <A extends Start, B extends A, C extends B, D extends C, E extends D, F extends E, G extends F>(
    refinements: readonly [
      P.Refinement<Start, A>,
      P.Refinement<A, B>,
      P.Refinement<B, C>,
      P.Refinement<C, D>,
      P.Refinement<D, E>,
      P.Refinement<E, F>,
      P.Refinement<F, G>,
    ]
  ): P.Refinement<Start, G>;
  <A extends Start, B extends A, C extends B, D extends C, E extends D, F extends E, G extends F, H extends G>(
    refinements: readonly [
      P.Refinement<Start, A>,
      P.Refinement<A, B>,
      P.Refinement<B, C>,
      P.Refinement<C, D>,
      P.Refinement<D, E>,
      P.Refinement<E, F>,
      P.Refinement<F, G>,
      P.Refinement<G, H>,
    ]
  ): P.Refinement<Start, H>;
  <
    A extends Start,
    B extends A,
    C extends B,
    D extends C,
    E extends D,
    F extends E,
    G extends F,
    H extends G,
    I extends H,
  >(
    refinements: readonly [
      P.Refinement<Start, A>,
      P.Refinement<A, B>,
      P.Refinement<B, C>,
      P.Refinement<C, D>,
      P.Refinement<D, E>,
      P.Refinement<E, F>,
      P.Refinement<F, G>,
      P.Refinement<G, H>,
      P.Refinement<H, I>,
    ]
  ): P.Refinement<Start, I>;
  <
    A extends Start,
    B extends A,
    C extends B,
    D extends C,
    E extends D,
    F extends E,
    G extends F,
    H extends G,
    I extends H,
    J extends I,
  >(
    refinements: readonly [
      P.Refinement<Start, A>,
      P.Refinement<A, B>,
      P.Refinement<B, C>,
      P.Refinement<C, D>,
      P.Refinement<D, E>,
      P.Refinement<E, F>,
      P.Refinement<F, G>,
      P.Refinement<G, H>,
      P.Refinement<H, I>,
      P.Refinement<I, J>,
    ]
  ): P.Refinement<Start, J>;
};

type RuntimeRefinement = { bivarianceHack(self: unknown): boolean }["bivarianceHack"];

const makeChainRefinement =
  (refinements: ReadonlyArray<RuntimeRefinement>) =>
  (self: unknown): self is never =>
    A.every(refinements, (refinement) => refinement(self));

/**
 * Re-export of all helpers from `effect/Predicate`.
 *
 * @example
 * ```ts
 * import * as P from "@beep/utils/Predicate"
 *
 * const isObject = P.isObject({ ok: true })
 * console.log(isObject)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/Predicate";

/**
 * Returns whether an unknown value can be inspected with reflection without
 * triggering a throwing Proxy trap.
 *
 * @example
 * ```ts
 * import { P } from "@beep/utils"
 *
 * const value = new Proxy({}, { ownKeys: () => { throw new Error("blocked") } })
 * console.log(P.hasInspectableObjectShape(value))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const hasInspectableObjectShape = (value: unknown): boolean => {
  if (!P.isObject(value)) {
    return true;
  }

  return Result.getOrElse(
    Result.try(() => {
      Reflect.getPrototypeOf(value);
      for (const key of Reflect.ownKeys(value)) {
        Reflect.getOwnPropertyDescriptor(value, key);
      }
      return true;
    }),
    () => false
  );
};

/**
 * Chains refinements so each step receives the type narrowed by the previous
 * step.
 *
 * @remarks
 * Use the flat `chainRefinements([...])` form when the first refinement can
 * infer the input type. Use `chainRefinements<Start>()([...])` when the input
 * type must be fixed explicitly. The chain stops at the first failed
 * refinement, so later structural checks can rely on earlier guards.
 *
 * @example
 * ```ts
 * import { P } from "@beep/utils";
 *
 * const hasMessage = P.chainRefinements([
 *   P.isNotNullish,
 *   P.isObject,
 *   P.hasProperty("message"),
 *   P.Struct({ message: P.isString })
 * ]);
 *
 * const candidate: unknown = { message: "hello" };
 *
 * if (hasMessage(candidate)) {
 *   const message: string = candidate.message;
 *   console.log(message);
 * }
 * ```
 *
 * @category refinements
 * @since 0.0.0
 */
export function chainRefinements<Start, A extends Start>(
  refinements: readonly [P.Refinement<Start, A>]
): P.Refinement<Start, A>;
export function chainRefinements<Start, A extends Start, B extends A>(
  refinements: readonly [P.Refinement<Start, A>, P.Refinement<A, B>]
): P.Refinement<Start, B>;
export function chainRefinements<Start, A extends Start, B extends A, C extends B>(
  refinements: readonly [P.Refinement<Start, A>, P.Refinement<A, B>, P.Refinement<B, C>]
): P.Refinement<Start, C>;
export function chainRefinements<Start, A extends Start, B extends A, C extends B, D extends C>(
  refinements: readonly [P.Refinement<Start, A>, P.Refinement<A, B>, P.Refinement<B, C>, P.Refinement<C, D>]
): P.Refinement<Start, D>;
export function chainRefinements<Start, A extends Start, B extends A, C extends B, D extends C, E extends D>(
  refinements: readonly [
    P.Refinement<Start, A>,
    P.Refinement<A, B>,
    P.Refinement<B, C>,
    P.Refinement<C, D>,
    P.Refinement<D, E>,
  ]
): P.Refinement<Start, E>;
export function chainRefinements<
  Start,
  A extends Start,
  B extends A,
  C extends B,
  D extends C,
  E extends D,
  F extends E,
>(
  refinements: readonly [
    P.Refinement<Start, A>,
    P.Refinement<A, B>,
    P.Refinement<B, C>,
    P.Refinement<C, D>,
    P.Refinement<D, E>,
    P.Refinement<E, F>,
  ]
): P.Refinement<Start, F>;
export function chainRefinements<
  Start,
  A extends Start,
  B extends A,
  C extends B,
  D extends C,
  E extends D,
  F extends E,
  G extends F,
>(
  refinements: readonly [
    P.Refinement<Start, A>,
    P.Refinement<A, B>,
    P.Refinement<B, C>,
    P.Refinement<C, D>,
    P.Refinement<D, E>,
    P.Refinement<E, F>,
    P.Refinement<F, G>,
  ]
): P.Refinement<Start, G>;
export function chainRefinements<
  Start,
  A extends Start,
  B extends A,
  C extends B,
  D extends C,
  E extends D,
  F extends E,
  G extends F,
  H extends G,
>(
  refinements: readonly [
    P.Refinement<Start, A>,
    P.Refinement<A, B>,
    P.Refinement<B, C>,
    P.Refinement<C, D>,
    P.Refinement<D, E>,
    P.Refinement<E, F>,
    P.Refinement<F, G>,
    P.Refinement<G, H>,
  ]
): P.Refinement<Start, H>;
export function chainRefinements<
  Start,
  A extends Start,
  B extends A,
  C extends B,
  D extends C,
  E extends D,
  F extends E,
  G extends F,
  H extends G,
  I extends H,
>(
  refinements: readonly [
    P.Refinement<Start, A>,
    P.Refinement<A, B>,
    P.Refinement<B, C>,
    P.Refinement<C, D>,
    P.Refinement<D, E>,
    P.Refinement<E, F>,
    P.Refinement<F, G>,
    P.Refinement<G, H>,
    P.Refinement<H, I>,
  ]
): P.Refinement<Start, I>;
export function chainRefinements<
  Start,
  A extends Start,
  B extends A,
  C extends B,
  D extends C,
  E extends D,
  F extends E,
  G extends F,
  H extends G,
  I extends H,
  J extends I,
>(
  refinements: readonly [
    P.Refinement<Start, A>,
    P.Refinement<A, B>,
    P.Refinement<B, C>,
    P.Refinement<C, D>,
    P.Refinement<D, E>,
    P.Refinement<E, F>,
    P.Refinement<F, G>,
    P.Refinement<G, H>,
    P.Refinement<H, I>,
    P.Refinement<I, J>,
  ]
): P.Refinement<Start, J>;
export function chainRefinements<Start>(): ChainRefinementBuilder<Start>;
export function chainRefinements(refinements?: ReadonlyArray<RuntimeRefinement>): unknown {
  return refinements === undefined ? makeChainRefinement : makeChainRefinement(refinements);
}

/**
 * Returns a predicate that succeeds when an unknown value is an object with all
 *	the requested own or inherited properties.
 *
 * Supports both data-last and data-first invocation styles.
 *
 * @since 0.0.0
 * @category utilities
 * @example
 * ```ts
 * import { hasProperties } from "@beep/utils/Predicate"
 *
 * // Data-last style
 * const hasFooBar = hasProperties("foo", "bar")
 * const result1 = hasFooBar({ foo: 1, bar: 2 })
 * // true
 *
 * // Data-first style
 * const required: readonly ["foo", "bar"] = ["foo", "bar"]
 * const result2 = hasProperties({ foo: 1, bar: 2 }, required)
 * // true
 *
 * console.log(result1)
 * console.log(result2)
 * ```
 */
export const hasProperties: {
  <Properties extends A.NonEmptyReadonlyArray<PropertyKey>>(
    ...properties: Properties
  ): (self: unknown) => self is { [K in Properties[number]]: unknown };
  <Properties extends A.NonEmptyReadonlyArray<PropertyKey>>(
    self: unknown,
    properties: Properties
  ): self is { [K in Properties[number]]: unknown };
} = dual(
  (args) => args.length === 2 && A.isArray(args[1]),
  <Properties extends A.NonEmptyReadonlyArray<PropertyKey>>(
    self: unknown,
    firstPropertyOrProperties: PropertyKey | Properties,
    ...remainingProperties: ReadonlyArray<PropertyKey>
  ): self is { [K in Properties[number]]: unknown } => {
    const properties = (A.isArray(firstPropertyOrProperties)
      ? firstPropertyOrProperties
      : [firstPropertyOrProperties, ...remainingProperties]) as unknown as Properties;

    return P.isObject(self) && A.every(properties, (property) => P.hasProperty(self, property));
  }
);
