import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { identity } from "effect/Function";
import * as Result from "effect/Result";

/**
 * Encodes a JSON-compatible value with recursively sorted object keys and no whitespace.
 *
 * **Details**
 *
 * The output is RFC 8785 canonical JSON from `JsoncFingerprint` in
 * `@beep/jsonc`, the one owner of the bytes the lab's content ids and digests
 * hash. Callers pass schema-encoded wire forms, which are plain JSON.
 *
 * **Gotchas**
 *
 * A value outside plain JSON throws the owner's `JsoncCanonicalizeError`
 * instead of being coerced: an object member whose value is `undefined`, an
 * `undefined` array element or root, a non-finite number, a bigint, a
 * non-plain object such as a `Date`, a string or key with an unpaired
 * surrogate, and nesting past the owner's depth cap.
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
export const canonicalJson = (value: unknown): string =>
  Result.getOrThrowWith(JsoncFingerprint.canonicalizeResult(value), identity);
