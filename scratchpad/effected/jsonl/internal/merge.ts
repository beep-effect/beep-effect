/**
 * Pollution-safe shallow merge for `appendPatch`.
 *
 * **Details**
 *
 * Ported from `@effected/config-file`'s `internal/deepMerge.ts` recipe, minus
 * the recursion: `appendPatch` is a **shallow** merge by decision, so a nested
 * object in the patch replaces the one beneath it rather than merging into it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Tuple from "effect/Tuple";

/**
 * Keys that must never be copied from either side.
 *
 * **Details**
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
 * Whether a value can take part in a merge at all.
 *
 * **Details**
 *
 * Record-**like**, deliberately: a decoded `Schema.Class` payload is a class
 * instance, and excluding those would make the kit's dominant payload idiom
 * silently unpatchable. Arrays, `Date`s, scalars and `null` are excluded —
 * Effect predicates exclude arrays and built-in containers while retaining
 * ordinary records and decoded class instances.
 *
 * **Example** (Distinguish records from arrays)
 *
 * ```ts import.meta.vitest name="Distinguish records from arrays"
 * import { isRecordLike } from "@beep/scratchpad/effected/jsonl/internal/merge";
 * isRecordLike({count:1}) // => true
 * isRecordLike([]) // => false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isRecordLike = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value) &&
  !P.isDate(value) &&
  !P.isRegExp(value) &&
  !P.isError(value) &&
  !P.isMap(value) &&
  !P.isSet(value) &&
  !P.isUint8Array(value) &&
  !P.isPromise(value) &&
  !(value instanceof Number) &&
  !(value instanceof String) &&
  !(value instanceof Boolean) &&
  (!P.hasProperty(value, Symbol.toStringTag) ||
    !P.isString(value[Symbol.toStringTag]) ||
    value[Symbol.toStringTag] === "Object");

/**
 * Whether `patch` may be merged into `base`.
 *
 * **Details**
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
 * **Example** (Check a partial patch)
 *
 * ```ts import.meta.vitest name="Check a partial patch"
 * import { canMerge } from "@beep/scratchpad/effected/jsonl/internal/merge";
 * canMerge({count:1,label:"a"},{count:2}) // => true
 * ```
 *
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
  const patchProto = Reflect.getPrototypeOf(patch);
  return (
    patchProto === Reflect.getPrototypeOf({}) || P.isNull(patchProto) || patchProto === Reflect.getPrototypeOf(base)
  );
});

// Filter keys before reading values: forbidden getters never run and each
// retained own field is read once, just as in the upstream copy loop.
const safeFields = (value: Record<string, unknown>): Record<string, unknown> =>
  R.fromEntries(
    A.map(
      A.filter(R.keys(value), (key) => !HashSet.has(FORBIDDEN, key)),
      (key) => Tuple.make(key, value[key])
    )
  );

/**
 * Shallow-merge `patch` over `base`, with `patch` winning.
 *
 * **Details**
 *
 * Copies only safe own enumerable fields into a plain record. Record filtering
 * and spread semantics ensure inherited setters never run. Schema construction
 * and encoding in the journal validate the patch and create its class instance.
 * The transient record does not retain the base's prototype.
 *
 * **Example** (Retain untouched fields)
 *
 * ```ts import.meta.vitest name="Retain untouched fields"
 * import { shallowMerge } from "@beep/scratchpad/effected/jsonl/internal/merge";
 * shallowMerge({count:1,label:"a"},{count:2}) // => {count:2,label:"a"}
 * ```
 *
 * @internal
 * @category combinators
 * @since 0.0.0
 */
export const shallowMerge: {
  (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown>;
  (patch: Record<string, unknown>): (base: Record<string, unknown>) => Record<string, unknown>;
} = dual(2, (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => ({
  ...safeFields(base),
  ...safeFields(patch),
}));
