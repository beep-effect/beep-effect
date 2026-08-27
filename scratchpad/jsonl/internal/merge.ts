/**
 * Pollution-safe shallow merge for `appendPatch`.
 *
 * Ported from `@effected/config-file`'s `internal/deepMerge.ts` recipe, minus
 * the recursion: `appendPatch` is a **shallow** merge by decision, so a nested
 * object in the patch replaces the one beneath it rather than merging into it.
 *
 * @internal
 */

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
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

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
 * @internal
 */
export const isRecordLike = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && Object.prototype.toString.call(value) === "[object Object]";

/**
 * Whether a plain record, not a class instance, `Date`, array or `null`.
 *
 * @internal
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
 * @internal
 */
export const canMerge = (base: unknown, patch: unknown): boolean => {
	if (!isRecordLike(base) || !isRecordLike(patch)) {
		return false;
	}
	const patchProto = Object.getPrototypeOf(patch);
	return patchProto === Object.prototype || patchProto === null || patchProto === Object.getPrototypeOf(base);
};

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
 * **The merged value is TRANSIENT, and that is what makes this safe.** Building
 * on `base`'s prototype means a class-based payload passes `instanceof`
 * **without its constructor having run** — the object was assembled by
 * `Object.create` plus `defineProperty`, not by `new`. That is acceptable here
 * only because the value's sole use is to be encoded: the caller receives a
 * genuine instance produced by the subsequent decode, never this one. If a
 * future refactor ever returns the merged value to a caller directly, any
 * invariant a constructor establishes is silently bypassed.
 *
 * @internal
 */
export const shallowMerge = (
	base: Record<string, unknown>,
	patch: Record<string, unknown>,
): Record<string, unknown> => {
	const result: Record<string, unknown> = Object.create(Object.getPrototypeOf(base));
	for (const key of Object.keys(base)) {
		if (FORBIDDEN.has(key)) continue;
		define(result, key, base[key]);
	}
	for (const key of Object.keys(patch)) {
		if (FORBIDDEN.has(key)) continue;
		define(result, key, patch[key]);
	}
	return result;
};
