import { dual } from "effect/Function";
import * as O from "effect/Option";

/** Spreadable record carrying `Key` only when the source option is present. */
type OptionalPropRecord<Key extends string, Value> = { readonly [K in Key]?: Value };

/**
 * Builds an object containing one property only when the option is present.
 *
 * **Example** (Build property from Option)
 *
 * ```ts
 * import * as O from "effect/Option"
 *
 * console.log(optionalProp("line", O.some(42)))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const optionalProp: {
  <Key extends string, Value>(key: Key, value: O.Option<Value>): OptionalPropRecord<Key, Value>;
  <Value>(value: O.Option<Value>): <Key extends string>(key: Key) => OptionalPropRecord<Key, Value>;
} = dual(
  2,
  <Key extends string, Value>(key: Key, value: O.Option<Value>): OptionalPropRecord<Key, Value> =>
    O.isSome(value) ? ({ [key]: value.value } as OptionalPropRecord<Key, Value>) : {}
);
