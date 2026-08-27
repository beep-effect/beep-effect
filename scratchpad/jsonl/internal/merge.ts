/**
 * Pollution-safe shallow merge for `appendPatch`.
 *
 * Ported from `@effected/config-file`'s `internal/deepMerge.ts` recipe, minus
 * the recursion: `appendPatch` is a **shallow** merge by decision, so a nested
 * object in the patch replaces the one beneath it rather than merging into it.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { HashSet } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { dual } from "effect/Function";

/**
 * Keys that must never be copied from either side.
 *
 * `__proto__` reaches `Object.prototype`'s inherited accessor; `constructor`
 * and `prototype` are the neighbouring escape hatches. Filtering only the
 * *patch* would not be enough — the base is decoded journal data, which an
 * external writer controls just as directly.
 *
 * @internal
 */
const FORBIDDEN = HashSet.make("__proto__", "constructor", "prototype");

/**
 * Create an own data property, never invoking a setter inherited from the
 * prototype chain.
 *
 * @internal
 */
const define = (target: Record<string, unknown>, key: string, value: unknown): void => {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
};

/**
 * Whether a value can take part in a merge at all.
 *
 * Record-**like**, deliberately: a decoded `Schema.Class` payload is a class
 * instance, and excluding those would make the kit's dominant payload idiom
 * silently unpatchable. Arrays, `Date`s, scalars and `null` are excluded —
 * `Object.prototype.toString` distinguishes them where a `typeof` check does
 * not.
 *
 * **Gotchas**
 *
 * A `Schema.Class` instance is record-like on purpose. Tightening this guard
 * to plain objects would make `appendPatch` replace class payloads instead of
 * merging into them.
 *
 * **Example** (Class instance is record-like)
 *
 * ```ts
 * class MailPayload {
 *   round = 1
 * }
 *
 * console.log(isRecordLike(new MailPayload())) // true
 * console.log(isRecordLike([1, 2])) // false
 * console.log(isRecordLike(null)) // false
 * ```
 *
 * @see {@link canMerge} for the asymmetric patch-into-base guard built on this.
 * @see {@link JournalShape.appendPatch} for the public inherit-and-patch primitive.
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isRecordLike = (value: unknown): value is Record<string, unknown> =>
  P.isObjectKeyword(value) && Object.prototype.toString.call(value) === "[object Object]";

/**
 * Whether a plain record, not a class instance, `Date`, array or `null`.
 *
 * **Example** (Plain literal vs class instance)
 *
 * ```ts
 * class MailPayload {
 *   round = 1
 * }
 *
 * console.log(isPlainRecord({ round: 1 })) // true
 * console.log(isPlainRecord(new MailPayload())) // false
 * ```
 *
 * @see {@link isRecordLike} for the broader guard that admits class payloads.
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecordLike(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Whether `patch` may be merged into `base`.
 *
 * **Asymmetric, and deliberately unlike `@effected/config-file`'s `canMerge`.**
 * There, two *peer documents* are merged and requiring an identical prototype
 * keeps the merge honest. Here the patch is a caller-supplied **partial** —
 * `{ round: 2 }` written at the call site — so it is a plain literal even when
 * the base is a decoded `Schema.Class` instance. A symmetric same-prototype
 * test would therefore reject exactly the case that matters most and fall back
 * to replacement, which is the silent-loss trap this guard exists to close.
 *
 * So: both must be record-like, and the patch must not bring a *conflicting*
 * prototype — it is either a plain object (the normal case) or shares the
 * base's. Two instances of different classes do not merge.
 *
 * **Gotchas**
 *
 * Do not symmetrize this guard. A plain patch into a class base must succeed;
 * a class instance as the patch against a plain base must not.
 *
 * **Example** (Plain patch merges into a class base)
 *
 * ```ts
 * class MailPayload {
 *   round = 1
 * }
 *
 * console.log(canMerge(new MailPayload(), { round: 2 })) // true
 * console.log(canMerge({ round: 1 }, new MailPayload())) // false
 * ```
 *
 * @see {@link isRecordLike} for the record-like test both sides must pass.
 * @see {@link shallowMerge} for the copy that runs after this guard.
 * @see {@link JournalShape.appendPatch} for the public inherit-and-patch primitive.
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const canMerge: {
  (base: unknown, patch: unknown): boolean;
  (patch: unknown): (base: unknown) => boolean;
} = dual(2, (base: unknown, patch: unknown): boolean => {
  if (!isRecordLike(base) || !isRecordLike(patch)) {
    return false;
  }
  const patchProto = Object.getPrototypeOf(patch);
  return patchProto === Object.prototype || patchProto === null || patchProto === Object.getPrototypeOf(base);
});

/**
 * Shallow-merge `patch` over `base`, with `patch` winning.
 *
 * **Assignment is the hazard, not the keys.** `result[key] = value` and
 * `Object.assign` both use `[[Set]]`, which for a key named `__proto__` reaches
 * `Object.prototype`'s inherited accessor and reassigns the result's prototype
 * to attacker-controlled data — defeating the key filter that appears to be
 * guarding it. `Object.defineProperty` defines an own data property and never
 * consults the prototype chain, so it is the only safe copy primitive here.
 *
 * The result is built on `base`'s prototype so a decoded payload survives as
 * whatever it was, rather than being flattened into a bare object literal.
 *
 * **Gotchas**
 *
 * The merged value is TRANSIENT: it is assembled by `Object.create` plus
 * `defineProperty`, so a class-based payload passes `instanceof` without its
 * constructor having run. That is safe only because the value's sole use is to
 * be encoded — the caller receives a genuine instance from the subsequent
 * decode, never this one. Nested objects in the patch replace the ones beneath
 * them; they are not deep-merged. Pollution keys (`__proto__`, `constructor`,
 * `prototype`) are dropped from both sides.
 *
 * **Example** (Nested replace and dropped pollution keys)
 *
 * ```ts
 * const base: Record<string, unknown> = { round: 1, nested: { a: 1 } }
 * const patch: Record<string, unknown> = { nested: { b: 2 } }
 * Object.defineProperty(patch, "__proto__", {
 *   value: { polluted: true },
 *   enumerable: true,
 *   configurable: true,
 *   writable: true,
 * })
 * const merged = shallowMerge(base, patch)
 * console.log(merged.nested) // { b: 2 }
 * console.log(Object.getPrototypeOf(merged) === Object.prototype) // true
 * console.log(Object.hasOwn(merged, "__proto__")) // false
 * ```
 *
 * @see {@link canMerge} for the guard that decides merge vs replace.
 * @see {@link JournalShape.appendPatch} for the public inherit-and-patch primitive.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const shallowMerge: {
  (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown>;
  (patch: Record<string, unknown>): (base: Record<string, unknown>) => Record<string, unknown>;
} = dual(2, (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const prototype = Object.getPrototypeOf(base);
  const constructor = prototype?.constructor;
  const result: Record<string, unknown> = P.isFunction(constructor)
    ? (Reflect.construct(Object, [], constructor) as Record<string, unknown>)
    : R.empty();
  for (const key of R.keys(base)) {
    if (HashSet.has(FORBIDDEN, key)) continue;
    define(result, key, base[key]);
  }
  for (const key of R.keys(patch)) {
    if (HashSet.has(FORBIDDEN, key)) continue;
    define(result, key, patch[key]);
  }
  return result;
});
