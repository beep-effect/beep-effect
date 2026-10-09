import { dual } from "effect/Function";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
/**
 * A true plain object: `{}` or `Object.create(null)`. Class instances, `Date`,
 * `Map`, `Set`, `RegExp` and arrays are values, not merge targets.
 *
 * **Details**
 *
 * This is deliberately narrower than `typeof v === "object"`. A `Date` spread
 * into a fresh object loses every internal slot and yields `{}`; a class
 * instance loses its prototype, so `instanceof` fails and its getters vanish.
 * Recursion is gated on this predicate so nested values of those kinds stay
 * atomic — the higher-priority source wins them whole.

 * **Example** (Distinguish mergeable nested objects from dates)
 *
 * ```ts
 * import { isPlainObject } from "@beep/scratchpad/effected/config-file/internal/deepMerge";
 *
 * console.log(isPlainObject({ port: 8080 }), isPlainObject(new Date(0))); // true false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (!P.isObjectKeyword(value) || P.isFunction(value) || A.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

/**
 * Record-like: a `[object Object]` whose fields can be merged. Admits plain
 * objects and class instances (a decoded `Schema.Class` document), but not
 * `Date` / `Map` / `Set` / `RegExp` / arrays, whose behaviour lives in internal
 * slots that a field-wise merge would destroy.
 */
const isRecordLike = (value: unknown): value is Record<string, unknown> =>
	P.isObjectKeyword(value) && !P.isFunction(value) && Object.prototype.toString.call(value) === "[object Object]";

/**
 * Two values may be merged only if both are record-like and share a prototype.
 * Same-prototype instances merge field-wise; anything else is atomic.
 *
 * **Details**
 *
 * Requiring an identical prototype is what keeps the merge honest: a document
 * decoded through `Schema.Class` merges with another of the same class and
 * keeps its identity, and nothing else is ever silently reshaped.

 * **Example** (Check top-level prototype compatibility)
 *
 * ```ts
 * import { canMerge } from "@beep/scratchpad/effected/config-file/internal/deepMerge";
 *
 * class Settings { port = 8080; }
 * console.log(canMerge(new Settings(), new Settings())); // true
 * console.log(canMerge(new Settings(), { port: 3000 })); // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const canMerge: {
	(b: unknown): (a: unknown) => boolean;
	(a: unknown, b: unknown): boolean;
} = dual(2, (a: unknown, b: unknown): boolean =>
	isRecordLike(a) && isRecordLike(b) && Object.getPrototypeOf(a) === Object.getPrototypeOf(b));

/**
 * Recursively merge `source` into `target`; keys already present on `target`
 * win. Nested plain objects merge; every other value is atomic.
 *
 * **Details**
 *
 * The result is built on `target`'s prototype rather than spread into `{}`, so
 * a decoded `Schema.Class` document survives the merge as a real instance —
 * `instanceof` holds and its getters still work. Without this, `load` would
 * declare `Effect<A>` and hand back a structurally-equal plain object, and a
 * consumer calling a class method would get a `TypeError` that typechecked.
 *
 * Only own enumerable keys are consulted (`Object.hasOwn`), so a prototype
 * getter on `target` never shadows a real key on `source`.

 * **Example** (Keep higher priority keys and merge nested sections)
 *
 * ```ts
 * import { deepMerge } from "@beep/scratchpad/effected/config-file/internal/deepMerge";
 *
 * const merged = deepMerge(
 *   { server: { port: 8080 }, mode: "local" },
 *   { server: { port: 3000, host: "localhost" }, mode: "base" },
 * );
 * console.log(JSON.stringify(merged)); // {"server":{"port":8080,"host":"localhost"},"mode":"local"}
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const deepMerge: {
	(source: Record<string, unknown>): <T extends Record<string, unknown>>(target: T) => T;
	<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T;
} = dual(2, mergeRecords);

function mergeRecords<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T;
function mergeRecords(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { __proto__: Object.getPrototypeOf(target) };
	// Own keys are copied as data properties, including constructor/prototype.
	// A bare assignment uses [[Set]] semantics, so an own `__proto__` key on the
	// higher-priority document would reach `Object.prototype`'s inherited accessor
	// and reassign `result`'s prototype to attacker-controlled data — defeating
	// the prototype we just installed. `Object.assign` and `result[k] = v`
	// both do this; `defineProperty` does not.
	for (const key of R.keys(target)) {
		if (key === "__proto__") continue;
		define(result, key, target[key]);
	}
	for (const key of R.keys(source)) {
		if (key === "__proto__") continue;
		const sourceValue = source[key];
		if (!R.has(result, key)) {
			define(result, key, sourceValue);
		} else {
			const targetValue = result[key];
			if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
				define(result, key, deepMerge(targetValue, sourceValue));
			}
		}
	}
	return result;
}

/** Create an own data property, never invoking a setter inherited from the prototype chain. */
const define = (target: Record<string, unknown>, key: string, value: unknown): void => {
	Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
};
