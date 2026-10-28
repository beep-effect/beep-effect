/**
 * Retention deterministic primitives.
 * @packageDocumentation
 * @since 0.0.0
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { canonicalJson } from "../internal/CanonicalJson.ts";
import { RetentionPolicy } from "./Retention.model.ts";

/**
 * Digest binding a calibration receipt to the exact canonical candidate policy.
 *
 * **Example** (Compose policy identity)
 * ```ts
 * import { retentionPolicyDigest, RetentionPolicy } from "@beep/epistemic-domain/values/Retention"
 * const policy = RetentionPolicy.make({ hotThroughMillis: 2, warmThroughMillis: 4, coldThroughMillis: 8, decayScaleMillis: 4, payloadBudgetBytes: 100 })
 * console.log(retentionPolicyDigest(policy))
 * ```
 * @category identifiers
 * @since 0.0.0
 */
export const retentionPolicyDigest = Effect.fn("Retention.policyDigest")(function* (policy: RetentionPolicy) {
  const encoded = yield* S.encodeEffect(RetentionPolicy)(policy);
  return bytesToHex(sha256(utf8ToBytes(canonicalJson(encoded))));
});

/**
 * UTF-8 bytes of a canonical wire-form authority payload, independent of object key insertion order.
 *
 * **Example** (Measure payload)
 * ```ts
 * import { retentionPayloadBytes } from "@beep/epistemic-domain/values/Retention"
 * console.log(retentionPayloadBytes({ text: "é" }))
 * ```
 * @category projections
 * @since 0.0.0
 */
export const retentionPayloadBytes = (payload: Readonly<Record<string, unknown>>): number =>
  utf8ToBytes(canonicalJson(payload)).length;
