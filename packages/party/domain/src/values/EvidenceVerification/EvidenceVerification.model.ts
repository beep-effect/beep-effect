/**
 * Evidence-verification manifestation identity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- Nominal party bindings instantiate shared epistemics factories with party ids and brands; importing another product slice would violate the boundary. No copied algorithms. Review by 2026-12-03 or on factory/API changes.
import {
  makeEvidenceVerification,
  makeEvidenceVerificationManifestationKey,
} from "@beep/epistemics/EvidenceVerification";
import { $PartyDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as PartyIds from "../../Ids.ts";
import type * as Result from "effect/Result";

const schemas = makeEvidenceVerification({
  $I: $PartyDomainId.create("values/EvidenceVerification/EvidenceVerification.model"),
  ids: { evidence: PartyIds.AssertionId },
});

/**
 * Digest naming one exact evidence-to-source verification manifestation.
 *
 * **Details**
 *
 * The key is unique only within an organization. Persistence therefore applies
 * uniqueness to `(org_id, manifestation_key)` rather than to this digest alone.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EvidenceVerificationManifestationKey } from "@beep/party-domain/EvidenceVerification"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EvidenceVerificationManifestationKey)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const EvidenceVerificationManifestationKey = schemas.EvidenceVerificationManifestationKey;

/**
 * Runtime type for {@link EvidenceVerificationManifestationKey}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceVerificationManifestationKey = typeof EvidenceVerificationManifestationKey.Type;

/**
 * Exact immutable payload sealed by an evidence-verification manifestation key.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { EvidenceVerificationManifestation } from "@beep/party-domain/EvidenceVerification"
 * import * as S from "effect/Schema"
 * const accepts = S.is(EvidenceVerificationManifestation)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class EvidenceVerificationManifestation extends S.Opaque<
  EvidenceVerificationManifestation,
  { readonly brand: unique symbol }
>()(schemas.EvidenceVerificationManifestationSchema) {}

const digest = makeEvidenceVerificationManifestationKey({
  EvidenceVerificationManifestation,
  EvidenceVerificationManifestationKey,
});

/**
 * Compute the stable key for one exact verification manifestation.
 *
 * **Details**
 *
 * The versioned canonical wire encoding includes the evidence id, exact source
 * identity, and exact anchor. Repeating the same manifestation produces the
 * same key; changing any bound field produces a different key.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { evidenceVerificationManifestationKey } from "@beep/party-domain/EvidenceVerification"
 * const binding = evidenceVerificationManifestationKey
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const evidenceVerificationManifestationKey: (
  manifestation: EvidenceVerificationManifestation
) => Result.Result<EvidenceVerificationManifestationKey, S.SchemaError> = digest.evidenceVerificationManifestationKey;

/**
 * Check a persisted manifestation key against its exact immutable payload.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { isEvidenceVerificationManifestationKey } from "@beep/party-domain/EvidenceVerification"
 * const binding = isEvidenceVerificationManifestationKey
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isEvidenceVerificationManifestationKey: {
  (
    key: EvidenceVerificationManifestationKey
  ): (manifestation: EvidenceVerificationManifestation) => Result.Result<boolean, S.SchemaError>;
  (
    manifestation: EvidenceVerificationManifestation,
    key: EvidenceVerificationManifestationKey
  ): Result.Result<boolean, S.SchemaError>;
} = digest.isEvidenceVerificationManifestationKey;
