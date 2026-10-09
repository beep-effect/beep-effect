/**
 * A true plain object: `{}` or `Object.create(null)`. Class instances, `Date`,
 * `Map`, `Set`, `RegExp` and arrays are values, not merge targets.
 *
 * @remarks
 * This is deliberately narrower than `typeof v === "object"`. A `Date` spread
 * into a fresh object loses every internal slot and yields `{}`; a class
 * instance loses its prototype, so `instanceof` fails and its getters vanish.
 * Recursion is gated on this predicate so nested values of those kinds stay
 * atomic — the higher-priority source wins them whole.
 */
export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
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
	typeof value === "object" && value !== null && Object.prototype.toString.call(value) === "[object Object]";

/**
 * Two values may be merged only if both are record-like and share a prototype.
 * Same-prototype instances merge field-wise; anything else is atomic.
 *
 * @remarks
 * Requiring an identical prototype is what keeps the merge honest: a document
 * decoded through `Schema.Class` merges with another of the same class and
 * keeps its identity, and nothing else is ever silently reshaped.
 */
export const canMerge = (a: unknown, b: unknown): boolean =>
	isRecordLike(a) && isRecordLike(b) && Object.getPrototypeOf(a) === Object.getPrototypeOf(b);

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Recursively merge `source` into `target`; keys already present on `target`
 * win. Nested plain objects merge; every other value is atomic.
 *
 * @remarks
 * The result is built on `target`'s prototype rather than spread into `{}`, so
 * a decoded `Schema.Class` document survives the merge as a real instance —
 * `instanceof` holds and its getters still work. Without this, `load` would
 * declare `Effect<A>` and hand back a structurally-equal plain object, and a
 * consumer calling a class method would get a `TypeError` that typechecked.
 *
 * Only own enumerable keys are consulted (`Object.hasOwn`), so a prototype
 * getter on `target` never shadows a real key on `source`.
 */
export const deepMerge = (
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> => {
	const result: Record<string, unknown> = Object.create(Object.getPrototypeOf(target));
	// `target`'s keys must be filtered too, and copied as data properties. A bare
	// assignment uses [[Set]] semantics, so an own `__proto__` key on the
	// higher-priority document would reach `Object.prototype`'s inherited accessor
	// and reassign `result`'s prototype to attacker-controlled data — defeating
	// FORBIDDEN and the prototype we just installed. `Object.assign` and `result[k] = v`
	// both do this; `defineProperty` does not.
	for (const key of Object.keys(target)) {
		if (FORBIDDEN.has(key)) continue;
		define(result, key, target[key]);
	}
	for (const key of Object.keys(source)) {
		if (FORBIDDEN.has(key)) continue;
		const sourceValue = source[key];
		const targetValue = result[key];
		if (Object.hasOwn(result, key) && isPlainObject(targetValue) && isPlainObject(sourceValue)) {
			define(result, key, deepMerge(targetValue, sourceValue));
		} else if (!Object.hasOwn(result, key)) {
			define(result, key, sourceValue);
		}
	}
	return result;
};

/** Create an own data property, never invoking a setter inherited from the prototype chain. */
const define = (target: Record<string, unknown>, key: string, value: unknown): void => {
	Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
};
