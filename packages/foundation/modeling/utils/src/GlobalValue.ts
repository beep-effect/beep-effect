/**
 * The `GlobalValue` module ensures that a single instance of a value is created globally,
 * even when modules are imported multiple times (e.g., due to mixing CommonJS and ESM builds)
 * or during hot-reloading in development environments like Next.js or Remix.
 *
 * It achieves this by using a versioned global store, identified by a unique `Symbol` tied to
 * the current version of the `effect` library. The store holds values that are keyed by an identifier,
 * allowing the reuse of previously computed instances across imports or reloads.
 *
 * This pattern is particularly useful in scenarios where frequent reloading can cause services or
 * single-instance objects to be recreated unnecessarily, such as in development environments with hot-reloading.
 *
 * @since 0.0.0
 */

import { HashMap } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import type { TUnsafe } from "@beep/types";

const globalStoreId = `effect/GlobalValue`;
type GlobalStore = HashMap.HashMap<unknown, TUnsafe.Any>;

/**
 * Retrieves or computes a global value associated with the given `id`. If the value for this `id`
 * has already been computed, it will be returned from the global store. If it does not exist yet,
 * the provided `compute` function will be executed to compute the value, store it, and then return it.
 *
 * **Details**
 *
 * This ensures that even in cases where the module is imported multiple times (e.g., in mixed environments
 * like CommonJS and ESM, or during hot-reloading in development), the value is computed only once and reused
 * thereafter.
 *
 * **Example** (Cached compute across imports)
 *
 * ```ts
 * import { globalValue } from "@beep/utils"
 *
 * let computed = 0
 * const cacheId = Symbol("docs-cache")
 *
 * const first = globalValue(cacheId, () => {
 *   computed += 1
 *   return { value: computed }
 * })
 * const second = globalValue(cacheId, () => {
 *   computed += 1
 *   return { value: computed }
 * })
 *
 * console.log(first === second)
 * console.log(computed)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const globalValue: {
  <A>(compute: () => A): (id: unknown) => A;
  <A>(id: unknown, compute: () => A): A;
} = dual(2, <A>(id: unknown, compute: () => A): A => {
  const globalScope = globalThis as typeof globalThis & Record<string, GlobalStore | undefined>;
  const store = globalScope[globalStoreId] ?? HashMap.empty<unknown, TUnsafe.Any>();
  const existing = HashMap.get(store, id);
  if (O.isSome(existing)) {
    return existing.value as A;
  }
  const value = compute();
  globalScope[globalStoreId] = HashMap.set(store, id, value);
  return value;
});
