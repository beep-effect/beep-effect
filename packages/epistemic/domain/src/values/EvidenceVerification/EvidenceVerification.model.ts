/**
 * Evidence-verification manifestation identity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { SchemaUtils, Sha256Hex } from "@beep/schema";
import * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { Result } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { canonicalJson } from "../internal/CanonicalJson.ts";

const $I = $EpistemicDomainId.create("values/EvidenceVerification/EvidenceVerification.model");
const manifestationEncodingVersion = "evidence-verification-manifestation/v1";

/**
 * Digest naming one exact evidence-to-source verification manifestation.
 *
 * **Details**
 *
 * The key is unique only within an organization. Persistence therefore applies
 * uniqueness to `(org_id, manifestation_key)` rather than to this digest alone.
 *
 * **Example** (Validate 64-character key)
 *
 * ```ts
 * import { EvidenceVerificationManifestationKey } from "@beep/epistemic-domain/values/EvidenceVerification"
 *
 * console.log(EvidenceVerificationManifestationKey.is("a".repeat(64))) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const EvidenceVerificationManifestationKey = Sha256Hex.pipe(
  S.brand("EvidenceVerificationManifestationKey"),
  $I.annoteSchema("EvidenceVerificationManifestationKey", {
    description: "SHA-256 digest naming one exact evidence id and verified source-text anchor within an organization.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Runtime type for {@link EvidenceVerificationManifestationKey}.
 *
 * **Example** (Typed empty keys array)
 *
 * ```ts
 * import type { EvidenceVerificationManifestationKey } from "@beep/epistemic-domain/values/EvidenceVerification"
 *
 * const keys: ReadonlyArray<EvidenceVerificationManifestationKey> = []
 * console.log(keys.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceVerificationManifestationKey = typeof EvidenceVerificationManifestationKey.Type;

/**
 * Exact immutable payload sealed by an evidence-verification manifestation key.
 *
 * **Example** (Check evidenceId field exists)
 *
 * ```ts
 * import { EvidenceVerificationManifestation } from "@beep/epistemic-domain/values/EvidenceVerification"
 *
 * console.log(EvidenceVerificationManifestation.fields.evidenceId !== undefined) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class EvidenceVerificationManifestation extends S.Class<EvidenceVerificationManifestation>(
  $I`EvidenceVerificationManifestation`
)(
  {
    evidenceId: EpistemicIdentity.EvidenceId.annotateKey({
      description: "Existing epistemic evidence row bound to the verified anchor.",
    }),
    verifiedAnchor: TextAnchorVerificationReceipt.annotateKey({
      description:
        "Persisted receipt for the exact source identity and UTF-16 anchor; runtime use requires re-verification.",
    }),
  },
  $I.annote("EvidenceVerificationManifestation", {
    description: "One exact evidence id and verified source-text anchor pair.",
  })
) {}

const encodeManifestation = S.encodeResult(EvidenceVerificationManifestation);

/**
 * Compute the stable key for one exact verification manifestation.
 *
 * **Details**
 *
 * The versioned canonical wire encoding includes the evidence id, exact source
 * identity, and exact anchor. Repeating the same manifestation produces the
 * same key; changing any bound field produces a different key.
 *
 * **Example** (Key function type and fields)
 *
 * ```ts
 * import { EvidenceVerificationManifestation, evidenceVerificationManifestationKey } from "@beep/epistemic-domain/values/EvidenceVerification"
 *
 * console.log(typeof evidenceVerificationManifestationKey)
 * console.log(EvidenceVerificationManifestation.fields.verifiedAnchor !== undefined)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const evidenceVerificationManifestationKey = (
  manifestation: EvidenceVerificationManifestation
): Result.Result<EvidenceVerificationManifestationKey, S.SchemaError> =>
  Result.map(encodeManifestation(manifestation), (encoded) =>
    EvidenceVerificationManifestationKey.make(
      bytesToHex(sha256(utf8ToBytes(`${manifestationEncodingVersion}\n${canonicalJson(encoded)}`)))
    )
  );

type IsEvidenceVerificationManifestationKey = {
  (
    key: EvidenceVerificationManifestationKey
  ): (manifestation: EvidenceVerificationManifestation) => Result.Result<boolean, S.SchemaError>;
  (
    manifestation: EvidenceVerificationManifestation,
    key: EvidenceVerificationManifestationKey
  ): Result.Result<boolean, S.SchemaError>;
};

/**
 * Check a persisted manifestation key against its exact immutable payload.
 *
 * **Example** (Validator function type check)
 *
 * ```ts
 * import { isEvidenceVerificationManifestationKey } from "@beep/epistemic-domain/values/EvidenceVerification"
 *
 * console.log(typeof isEvidenceVerificationManifestationKey)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isEvidenceVerificationManifestationKey: IsEvidenceVerificationManifestationKey = dual(
  2,
  (
    manifestation: EvidenceVerificationManifestation,
    key: EvidenceVerificationManifestationKey
  ): Result.Result<boolean, S.SchemaError> =>
    Result.map(evidenceVerificationManifestationKey(manifestation), (expected) => Eq.equals(expected, key))
);
