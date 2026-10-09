// Deep structural equality for plain JavaScript values — the primitive
// behind the facade's semantic `equals`/`equalsValue` statics.

/**
 * Deep-compare two plain JS values for structural equality.
 * Object key order is ignored (recursively at all nesting levels).
 * Array order is significant.
 *
 * NaN is treated as equal to NaN (unlike `===`) because YAML `.nan` values
 * parsed from two separate documents should compare as semantically
 * equivalent. Object comparison checks that both objects have the same set
 * of keys and recursively compares values by key, matching YAML's semantics
 * where mapping key order is not significant.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;

	// Handle NaN (NaN !== NaN but should be considered equal)
	if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) {
		return true;
	}

	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;

	if (Array.isArray(a)) {
		if (!Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}
	if (Array.isArray(b)) return false;

	if (typeof a === "object" && typeof b === "object") {
		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;
		const aKeys = Object.keys(aObj);
		const bKeys = Object.keys(bObj);
		if (aKeys.length !== bKeys.length) return false;
		for (const key of aKeys) {
			if (!Object.hasOwn(bObj, key)) return false;
			if (!deepEqual(aObj[key], bObj[key])) return false;
		}
		return true;
	}

	return false;
}
