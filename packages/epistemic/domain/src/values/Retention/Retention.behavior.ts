/**
 * Retention deterministic primitives.
 * @packageDocumentation
 * @since 0.0.0
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { canonicalJson } from "../internal/CanonicalJson.ts";
import { RetentionPolicy, RetentionTier } from "./Retention.model.ts";

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

/**
 * Classify nonnegative assertion age with the inclusive retention-v1 cutoffs.
 *
 * **Details**
 * This pure calculation confers no admission, approval or authority to evict.
 * Callers validate age with RetentionRow and policy with RetentionPolicy.
 *
 * **Example** (Inclusive cutoff)
 * ```ts
 * import { retentionTierAtAge, RetentionPolicy } from "@beep/epistemic-domain/values/Retention"
 * const policy = RetentionPolicy.make({ hotThroughMillis: 2, warmThroughMillis: 4, coldThroughMillis: 8, decayScaleMillis: 4, payloadBudgetBytes: 100 })
 * console.log(retentionTierAtAge(2, policy)) // hot
 * ```
 * @category policies
 * @since 0.0.0
 */
export const retentionTierAtAge: {
  (ageMillis: number, policy: RetentionPolicy): RetentionTier;
  (policy: RetentionPolicy): (ageMillis: number) => RetentionTier;
} = dual(
  2,
  (ageMillis: number, policy: RetentionPolicy): RetentionTier =>
    Match.value(ageMillis).pipe(
      Match.when(
        (age) => age <= policy.hotThroughMillis,
        () => RetentionTier.Enum.hot
      ),
      Match.when(
        (age) => age <= policy.warmThroughMillis,
        () => RetentionTier.Enum.warm
      ),
      Match.when(
        (age) => age <= policy.coldThroughMillis,
        () => RetentionTier.Enum.cold
      ),
      Match.orElse(() => RetentionTier.Enum.evictable)
    )
);

/**
 * Compute retention-v1 rational decay from validated nonnegative assertion age.
 *
 * **Example** (One scale of age)
 * ```ts
 * import { retentionDecayAtAge, RetentionPolicy } from "@beep/epistemic-domain/values/Retention"
 * const policy = RetentionPolicy.make({ hotThroughMillis: 2, warmThroughMillis: 4, coldThroughMillis: 8, decayScaleMillis: 4, payloadBudgetBytes: 100 })
 * console.log(retentionDecayAtAge(4, policy)) // 0.5
 * ```
 * @category policies
 * @since 0.0.0
 */
export const retentionDecayAtAge: {
  (ageMillis: number, policy: RetentionPolicy): number;
  (policy: RetentionPolicy): (ageMillis: number) => number;
} = dual(2, (ageMillis: number, policy: RetentionPolicy): number => 1 / (1 + ageMillis / policy.decayScaleMillis));
