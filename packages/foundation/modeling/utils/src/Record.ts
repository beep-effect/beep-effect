import * as R from "effect/Record";

/**
 * Re-export of all helpers from `effect/Record`.
 *
 * @example
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
 * @example
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
