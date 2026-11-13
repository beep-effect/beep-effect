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
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

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

/**
 * {@link canonicalJson} returning a `Result`: the owner's refusal of a value
 * outside plain JSON is an `S.SchemaError` whose message carries the owner's
 * code and JSON pointer, so a digest helper with a `SchemaError` channel
 * reports it there instead of throwing.
 *
 * @category encoding
 * @since 0.0.0
 */
export const canonicalJsonResult = (value: unknown): Result.Result<string, S.SchemaError> =>
  Result.mapError(
    JsoncFingerprint.canonicalizeResult(value),
    (error) => new S.SchemaError(new SchemaIssue.InvalidValue({ message: error.message }))
  );
