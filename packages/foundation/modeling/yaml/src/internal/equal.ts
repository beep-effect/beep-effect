import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

/**
 * Deep-compare two plain JS values for structural equality.
 *
 * **Details**
 *
 * Object key order is ignored (recursively at all nesting levels).
 * Array order is significant.
 *
 * NaN is treated as equal to NaN (unlike `===`) because YAML `.nan` values
 * parsed from two separate documents should compare as semantically
 * equivalent. Object comparison checks that both objects have the same set
 * of keys and recursively compares values by key, matching YAML's semantics
 * where mapping key order is not significant.
 *
 * **Example** (Compare mapping order, array order, and NaN)
 *
 * ```ts
 * import { deepEqual } from "@beep/yaml/internal/equal"
 *
 * console.log(deepEqual({ name: "Ada", age: 30 }, { age: 30, name: "Ada" })) // true
 * console.log(deepEqual([1, 2], [2, 1])) // false
 * console.log(deepEqual(Number.NaN, Number.NaN)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function deepEqual(a: unknown, ...[b]: [b: unknown]): boolean {
  if (a === b || bothNaN(a, b)) return true;
  if (a === null || b === null) return false;
  if (A.isArray(a)) return A.isArray(b) && arraysEqual(a, b);
  if (A.isArray(b)) return false;
  return P.isObject(a) && P.isObject(b) && recordsEqual(a, b);
}

const bothNaN = (a: unknown, b: unknown): boolean =>
  P.isNumber(a) && P.isNumber(b) && Number.isNaN(a) && Number.isNaN(b);

function arraysEqual(a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!deepEqual(a[i], b[i])) return false;
  }
  return true;
}

type PlainRecord = { readonly [x: PropertyKey]: unknown };

function recordsEqual(aObj: PlainRecord, bObj: PlainRecord): boolean {
  const aKeys = R.keys(aObj);
  if (aKeys.length !== R.keys(bObj).length) return false;
  for (const key of aKeys) {
    if (!R.has(bObj, key) || !deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}
