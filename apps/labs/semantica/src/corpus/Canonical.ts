import { Order, pipe, Struct } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";

const canonicalPrimitive = (value: string | number | boolean | null): string => JSON.stringify(value);

const canonicalArray = (value: ReadonlyArray<unknown>): string => `[${pipe(value, A.map(canonicalJson), A.join(","))}]`;

const canonicalObject = (value: { [x: PropertyKey]: unknown }): string => {
  const entries = pipe(
    Struct.keys(value),
    A.sort(Order.String),
    A.map((key) => {
      const entry = value[key];
      return P.isUndefined(entry)
        ? O.none<readonly [string, unknown]>()
        : O.some<readonly [string, unknown]>([key, entry]);
    }),
    A.getSomes
  );

  return `{${pipe(
    entries,
    A.map(([key, entry]) => `${canonicalPrimitive(key)}:${canonicalJson(entry)}`),
    A.join(",")
  )}}`;
};

/**
 * Encodes a JSON-compatible value with recursively sorted object keys and no whitespace.
 *
 * **Details**
 *
 * Object properties whose value is `undefined` are omitted. Unsupported array
 * entries use JSON's `null` representation. Primitive escaping delegates only
 * the scalar token to the native JSON encoder; object ordering remains explicit.
 *
 * **Example** (Compare different key insertion orders)
 *
 * ```ts
 * import { canonicalJson } from "@/corpus/Canonical"
 *
 * console.log(canonicalJson({ b: 2, a: 1 })) // {"a":1,"b":2}
 * console.log(canonicalJson({ a: 1, b: 2 })) // {"a":1,"b":2}
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const canonicalJson = (value: unknown): string => {
  if (P.isNull(value)) {
    return canonicalPrimitive(value);
  }
  if (P.isString(value)) {
    return canonicalPrimitive(value);
  }
  if (P.isNumber(value)) {
    return canonicalPrimitive(value);
  }
  if (P.isBoolean(value)) {
    return canonicalPrimitive(value);
  }
  if (A.isArray(value)) {
    return canonicalArray(value);
  }
  return P.isObject(value) ? canonicalObject(value) : "null";
};
