// Deep structural equality for plain JavaScript values — the primitive
// behind the facade's semantic `equals`/`equalsValue` statics.

import * as P from "effect/Predicate";
import * as A from "effect/Array";
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
 * import { deepEqual } from "@beep/scratchpad/effected/yaml/internal/equal"
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
	if (a === b) return true;

	// Handle NaN (NaN !== NaN but should be considered equal)
	if (P.isNumber(a) && P.isNumber(b) && Number.isNaN(a) && Number.isNaN(b)) {
		return true;
	}

	if (a === null || b === null) return false;

	if (A.isArray(a)) {
		if (!A.isArray(b)) return false;
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}
	if (A.isArray(b)) return false;

	if (P.isObject(a) && P.isObject(b)) {
		const aObj = a;
		const bObj = b;
		const aKeys = R.keys(aObj);
		const bKeys = R.keys(bObj);
		if (aKeys.length !== bKeys.length) return false;
		for (const key of aKeys) {
			if (!R.has(bObj, key)) return false;
			if (!deepEqual(aObj[key], bObj[key])) return false;
		}
		return true;
	}

	return false;
}
