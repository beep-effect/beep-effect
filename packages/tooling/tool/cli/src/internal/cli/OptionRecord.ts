import { dual } from "effect/Function";
import * as O from "effect/Option";

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
  <Key extends string, Value>(key: Key, value: O.Option<Value>): { readonly [K in Key]?: Value };
  <Value>(value: O.Option<Value>): <Key extends string>(key: Key) => { readonly [K in Key]?: Value };
} = dual(2, <Key extends string, Value>(key: Key, value: O.Option<Value>): { readonly [K in Key]?: Value } =>
  O.isSome(value) ? ({ [key]: value.value } as { readonly [K in Key]?: Value }) : {}
);
