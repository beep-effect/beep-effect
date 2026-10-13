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
 * instance also needs its constructor-created private state, which a copied
 * prototype cannot supply. Merging is gated on this predicate so values of those kinds stay
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
export const isPlainObject = (value: unknown): value is Record<PropertyKey, unknown> => {
	if (!P.isObjectKeyword(value) || P.isFunction(value) || A.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

/**
 * Two values may be merged only if both are plain records and share a prototype.
 * Class instances are atomic, even when their prototypes match.
 *
 * **Details**
 *
 * Plain records merge field-wise without changing their prototype kind.
 * A document decoded through `Schema.Class` keeps its identity and private
 * state because the higher-priority instance is returned intact.

 * **Example** (Check top-level prototype compatibility)
 *
 * ```ts
 * import { canMerge } from "@beep/scratchpad/effected/config-file/internal/deepMerge";
 *
 * class Settings { port = 8080; }
 * console.log(canMerge({ port: 8080 }, { port: 3000 })); // true
 * console.log(canMerge(new Settings(), new Settings())); // false
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
	isPlainObject(a) && isPlainObject(b) && Object.getPrototypeOf(a) === Object.getPrototypeOf(b));

/**
 * Recursively merge `source` into `target`; keys already present on `target`
 * win. Compatible plain records merge; every other value is atomic.
 *
 * **Details**
 *
 * When either input is not a plain record or their prototypes differ, `target`
 * is returned intact. This preserves class identity, private-field brands and
 * internal slots. Otherwise the result keeps `target`'s plain-record prototype.
 *
 * Only own enumerable string and symbol keys are copied as inert data
 * properties. Inherited and non-enumerable fields are excluded, and the string
 * `__proto__` is filtered. An inherited getter on `target` never shadows an
 * own key on `source`; neither input is mutated.

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
	(source: object): <T extends object>(target: T) => T;
	<T extends object>(target: T, source: object): T;
} = dual(2, mergeRecords);

function mergeRecords<T extends object>(target: T, source: object): T;
function mergeRecords(
	target: object,
	source: object,
): object {
	if (!isPlainObject(target) || !isPlainObject(source) || !canMerge(target, source)) return target;
	const result: Record<PropertyKey, unknown> = { __proto__: Object.getPrototypeOf(target) };
	// Own keys are copied as data properties, including constructor/prototype.
	// A bare assignment uses [[Set]] semantics, so an own `__proto__` key on the
	// higher-priority document would reach `Object.prototype`'s inherited accessor
	// and reassign `result`'s prototype to attacker-controlled data — defeating
	// the prototype we just installed. `Object.assign` and `result[k] = v`
	// both do this; `defineProperty` does not.
	for (const key of Reflect.ownKeys(target)) {
		if (key === "__proto__" || !Object.prototype.propertyIsEnumerable.call(target, key)) continue;
		define(result, key, target[key]);
	}
	for (const key of Reflect.ownKeys(source)) {
		if (key === "__proto__" || !Object.prototype.propertyIsEnumerable.call(source, key)) continue;
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
const define = (target: Record<PropertyKey, unknown>, key: PropertyKey, value: unknown): void => {
	Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
};
