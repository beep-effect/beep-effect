/**
 * Record helpers and typed constructors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { dual } from "effect/Function";
import * as R from "effect/Record";

/**
 * **Example** (Import Record helpers)
 *
 * ```ts
 * import * as R from "@beep/utils/Record"
 *
 * const entries = R.toEntries({
 *   beep: "beep"
 * })
 * console.log(entries)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/Record";

/**
 * Creates a typed empty readonly record.
 *
 * **Example** (Create empty readonly record)
 *
 * ```ts
 * import * as R from "@beep/utils/Record"
 *
 * const emptyRecord = R.emptyReadonly<string, number>()
 * console.log(emptyRecord) // {}
 *
 * const withValue = R.set(emptyRecord, "count", 42)
 * console.log(withValue) // { count: 42 }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const emptyReadonly = <K extends string | symbol = never, V = never>(): R.ReadonlyRecord<
  R.ReadonlyRecord.NonLiteralKey<K>,
  V
> => R.empty();

/**
 * Writes `value` as an own, enumerable data property of a mutable record.
 *
 * **Details**
 *
 * Plain keys use ordinary assignment. The `__proto__` key is defined as an own
 * data property instead of reaching the `Object.prototype` setter, which
 * matches `JSON.parse` semantics for parsers that materialize untrusted keys.
 *
 * **Gotchas**
 *
 * This mutates `target` in place; use `R.set` for an immutable update.
 *
 * **Example** (Keep a `__proto__` key as data)
 *
 * ```ts
 * import * as R from "@beep/utils/Record"
 *
 * const target: Record<string, unknown> = {}
 * R.setOwnProperty(target, "__proto__", { polluted: true })
 * R.setOwnProperty("port", 3000)(target)
 *
 * console.log(Object.keys(target)) // ["__proto__", "port"]
 * console.log(Object.getPrototypeOf(target) === Object.prototype) // true
 * ```
 *
 * @category setters
 * @since 0.0.0
 */
export const setOwnProperty: {
  (key: string, value: unknown): (target: Record<string, unknown>) => void;
  (target: Record<string, unknown>, key: string, value: unknown): void;
} = dual(3, (target: Record<string, unknown>, key: string, value: unknown): void => {
  if (key !== "__proto__") {
    target[key] = value;
    return;
  }
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true });
});
