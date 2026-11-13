/**
 * Internal canonical JSON encoder shared by every digest-bearing execution
 * authority module. Not part of the public API surface: the `values` barrel
 * never re-exports it and the package `exports` map nulls `./values/internal/*`.
 *
 * One implementation on purpose — {@link canonicalJson} feeds both the
 * grant-set seal and the ledger record seals, and it is the same encoder the
 * `@beep/epistemics` contradiction, detection and evidence-verification seals
 * use, so a second private copy could drift and silently split the digests
 * those seals are supposed to share.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { canonicalDetectionJson, canonicalDetectionJsonResult } from "@beep/epistemics/ContradictionDetection";
import type * as Result from "effect/Result";
import type * as S from "effect/Schema";

/**
 * Deterministic canonical JSON over wire-form values: object keys sorted
 * recursively so equal values always encode to equal strings. Operates on
 * already-encoded (wire-form) values, which are plain JSON by construction.
 *
 * @category encoding
 * @since 0.0.0
 */
export const canonicalJson: (value: unknown) => string = canonicalDetectionJson;

/**
 * {@link canonicalJson} returning a `Result`: the canonical JSON owner's
 * refusal of a value outside plain JSON is an `S.SchemaError` naming its code
 * and JSON pointer, for digest helpers that already carry that channel.
 *
 * @category encoding
 * @since 0.0.0
 */
export const canonicalJsonResult: (value: unknown) => Result.Result<string, S.SchemaError> =
  canonicalDetectionJsonResult;
