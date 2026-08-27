/**
 * Deep structural equality for plain JavaScript values.
 *
 * This is the primitive behind the facade's semantic `equals` /
 * `equalsValue` statics. Mapping key order is insignificant; sequence order
 * is significant. `NaN` equals `NaN` so YAML `.nan` values from two
 * documents match.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Deep-compare two plain JS values for structural equality.
 *
 * Object key order is ignored (recursively at all nesting levels). Array
 * order is significant. `NaN` is treated as equal to `NaN` (unlike `===`)
 * because YAML `.nan` values parsed from two separate documents should
 * compare as semantically equivalent.
 *
 * **Gotchas**
 *
 * Do not substitute `===` or `Object.is` on the facade equality path: both
 * treat `NaN` as unequal to itself and would fail `.nan` fixtures.
 *
 * **Example** (NaN and unordered mapping keys)
 *
 * ```ts
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Yaml.equals(".nan\n", ".nan\n")) // true
 * console.log(Yaml.equals("{b: 1, a: 2}\n", "{a: 2, b: 1}\n")) // true
 * console.log(Yaml.equals("[1, 2]\n", "[2, 1]\n")) // false
 * ```
 *
 * @see {@link Yaml.equals} for the public YAML-text equality wrapper.
 * @internal
 * @category predicates
 * @since 0.0.0
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
