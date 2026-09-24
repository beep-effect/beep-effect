/**
 * Internal DOM global lookups for runtimes that may not provide a DOM.
 *
 * @since 0.0.0
 */

import * as P from "effect/Predicate";

/**
 * Build an `instanceof` guard against a DOM constructor resolved from `globalThis` at call time.
 *
 * **Details**
 *
 * The schema package compiles without the `dom` lib, so DOM constructors such as `HTMLElement`
 * are types only. Resolving the constructor lazily keeps the module loadable on servers where the
 * constructor is absent; the guard then simply answers `false`.
 *
 * @category guards
 * @since 0.0.0
 */
export const instanceOfDomGlobal =
  <T>(constructorName: string) =>
  (u: unknown): u is T => {
    const constructor = (globalThis as Record<string, unknown>)[constructorName];
    return P.isFunction(constructor) && u instanceof constructor;
  };
