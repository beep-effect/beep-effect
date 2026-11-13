/**
 * Internal canonical JSON encoder for the digest-bearing epistemic values
 * (contradiction seals, detection proposal ids, evidence-verification keys).
 * Not part of the public API surface: the package `exports` map nulls
 * `./internal/*`.
 *
 * `@beep/epistemic-domain`'s agent-authority seals (grant sets, execution
 * records) reuse this one implementation through `canonicalDetectionJson`, so
 * every seal that shares a digest shares the encoder.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { identity } from "effect/Function";
import * as Result from "effect/Result";

/**
 * Deterministic canonical JSON over wire-form values: the RFC 8785 text that
 * `JsoncFingerprint` owns, so equal values always encode to equal strings.
 * Operates on already-encoded (wire-form) values, which are plain JSON by
 * construction.
 *
 * **Gotchas**
 *
 * A value outside plain JSON throws the owner's `JsoncCanonicalizeError`
 * instead of being coerced: an object member whose value is `undefined`, a
 * non-finite number, a bigint, a non-plain object, a string or key with an
 * unpaired surrogate, and nesting past the owner's depth cap.
 *
 * @category encoding
 * @since 0.0.0
 */
export const canonicalJson = (value: unknown): string =>
  Result.getOrThrowWith(JsoncFingerprint.canonicalizeResult(value), identity);
