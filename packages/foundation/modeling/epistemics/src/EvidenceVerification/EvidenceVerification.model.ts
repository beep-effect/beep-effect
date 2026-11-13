/**
 * Evidence-verification manifestation schema factory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { Sha256Hex } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { canonicalJsonResult } from "../internal/CanonicalJson.ts";
import type { IdCodec, SchemaIdentity } from "../Factory/index.ts";

const manifestationEncodingVersion = "evidence-verification-manifestation/v1";

/**
 * Build the evidence-verification manifestation schemas over a caller-supplied
 * evidence id schema.
 *
 * **Details**
 *
 * Returns `EvidenceVerificationManifestationKey` and
 * `EvidenceVerificationManifestationSchema`, the annotated struct a binding
 * wraps in its own `S.Opaque` class. Pair it with
 * {@link makeEvidenceVerificationManifestationKey} once that class exists.
 *
 * **Example** (Bind manifestations to a local evidence id)
 *
 * ```ts
 * import { makeEvidenceVerification } from "@beep/epistemics/EvidenceVerification"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const { EvidenceVerificationManifestationKey } = makeEvidenceVerification({
 *   $I: $ScratchpadId.create("party/EvidenceVerification"),
 *   ids: { evidence: S.String.pipe(S.brand("EvidenceId")) }
 * })
 * console.log(S.is(EvidenceVerificationManifestationKey)("a".repeat(64))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeEvidenceVerification = <EvidenceId extends IdCodec>(config: {
  readonly $I: SchemaIdentity;
  readonly ids: { readonly evidence: EvidenceId };
}) => {
  const { $I, ids } = config;

  const EvidenceVerificationManifestationKey = Sha256Hex.pipe(
    S.brand("EvidenceVerificationManifestationKey"),
    $I.annoteSchema("EvidenceVerificationManifestationKey", {
      description:
        "SHA-256 digest naming one exact evidence id and verified source-text anchor within an organization.",
    })
  );

  const EvidenceVerificationManifestationSchema = S.Struct({
    evidenceId: ids.evidence.annotateKey({
      description: "Existing epistemic evidence row bound to the verified anchor.",
    }),
    verifiedAnchor: TextAnchorVerificationReceipt.annotateKey({
      description:
        "Persisted receipt for the exact source identity and UTF-16 anchor; runtime use requires re-verification.",
    }),
  }).pipe(
    $I.annoteSchema("EvidenceVerificationManifestation", {
      description: "One exact evidence id and verified source-text anchor pair.",
    })
  );

  return { EvidenceVerificationManifestationKey, EvidenceVerificationManifestationSchema };
};

/**
 * Build the manifestation digest over a caller-bound manifestation class.
 *
 * **Details**
 *
 * `evidenceVerificationManifestationKey` encodes the manifestation, renders it
 * as canonical JSON behind a version line, and returns its SHA-256 hex digest.
 * `isEvidenceVerificationManifestationKey` (dual) compares a stored key against
 * the recomputed digest. Both fail with the encoder's `SchemaError`.
 *
 * **Example** (Recompute a bound manifestation key)
 *
 * ```ts
 * import {
 *   makeEvidenceVerification,
 *   makeEvidenceVerificationManifestationKey
 * } from "@beep/epistemics/EvidenceVerification"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const schemas = makeEvidenceVerification({
 *   $I: $ScratchpadId.create("party/EvidenceVerification"),
 *   ids: { evidence: S.String.pipe(S.brand("EvidenceId")) }
 * })
 * const { evidenceVerificationManifestationKey } = makeEvidenceVerificationManifestationKey({
 *   EvidenceVerificationManifestation: schemas.EvidenceVerificationManifestationSchema,
 *   EvidenceVerificationManifestationKey: schemas.EvidenceVerificationManifestationKey
 * })
 * console.log(typeof evidenceVerificationManifestationKey) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeEvidenceVerificationManifestationKey = <
  Manifestation extends S.Top & { readonly EncodingServices: never },
  Key,
>(config: {
  readonly EvidenceVerificationManifestation: Manifestation;
  readonly EvidenceVerificationManifestationKey: { readonly make: (digest: string) => Key };
}) => {
  const { EvidenceVerificationManifestation, EvidenceVerificationManifestationKey } = config;
  const encodeManifestation = S.encodeResult(EvidenceVerificationManifestation);

  const evidenceVerificationManifestationKey = (
    manifestation: Manifestation["Type"]
  ): Result.Result<Key, S.SchemaError> =>
    Result.flatMap(encodeManifestation(manifestation), (encoded) =>
      Result.map(canonicalJsonResult(encoded), (canonical) =>
        EvidenceVerificationManifestationKey.make(
          bytesToHex(sha256(utf8ToBytes(`${manifestationEncodingVersion}\n${canonical}`)))
        )
      )
    );

  const isEvidenceVerificationManifestationKey: {
    (key: Key): (manifestation: Manifestation["Type"]) => Result.Result<boolean, S.SchemaError>;
    (manifestation: Manifestation["Type"], key: Key): Result.Result<boolean, S.SchemaError>;
  } = dual(
    2,
    (manifestation: Manifestation["Type"], key: Key): Result.Result<boolean, S.SchemaError> =>
      Result.map(evidenceVerificationManifestationKey(manifestation), (expected) => Eq.equals(expected, key))
  );

  return { evidenceVerificationManifestationKey, isEvidenceVerificationManifestationKey };
};
