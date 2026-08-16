/**
 * Evidence-verification manifestation behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  EvidenceVerificationManifestation,
  evidenceVerificationManifestationKey,
  isEvidenceVerificationManifestationKey,
} from "@beep/epistemic-domain/values/EvidenceVerification";
import { dual } from "effect/Function";
import type { EvidenceVerificationManifestationKey } from "@beep/epistemic-domain/values/EvidenceVerification";
import type { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import type * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import type * as Result from "effect/Result";
import type * as S from "effect/Schema";
import type { EvidenceVerification } from "./EvidenceVerification.model.ts";

/**
 * Recomputes and validates one evidence-verification row's manifestation key.
 *
 * **Example** (Inspect validation behavior)
 *
 * ```ts
 * import { hasValidManifestationKey } from "@beep/epistemic-domain/entities/EvidenceVerification"
 *
 * console.log(typeof hasValidManifestationKey)
 * ```
 *
 * @returns A non-throwing result containing `true` only when the persisted key
 * seals the exact evidence id and verified anchor carried by the row.
 * @category validation
 * @since 0.0.0
 */
export const hasValidManifestationKey = (verification: EvidenceVerification): Result.Result<boolean, S.SchemaError> =>
  isEvidenceVerificationManifestationKey(
    EvidenceVerificationManifestation.make({
      evidenceId: verification.evidenceId,
      verifiedAnchor: verification.verifiedAnchor,
    }),
    verification.manifestationKey
  );

/**
 * Computes the manifestation key for an evidence id and verified anchor.
 *
 * **Example** (Inspect manifestation-key constructor)
 *
 * ```ts
 * import { manifestationKeyFor } from "@beep/epistemic-domain/entities/EvidenceVerification"
 *
 * console.log(typeof manifestationKeyFor)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const manifestationKeyFor: {
  (
    verifiedAnchor: TextAnchorVerificationReceipt
  ): (evidenceId: EpistemicIdentity.EvidenceId) => Result.Result<EvidenceVerificationManifestationKey, S.SchemaError>;
  (
    evidenceId: EpistemicIdentity.EvidenceId,
    verifiedAnchor: TextAnchorVerificationReceipt
  ): Result.Result<EvidenceVerificationManifestationKey, S.SchemaError>;
} = dual(2, (evidenceId: EpistemicIdentity.EvidenceId, verifiedAnchor: TextAnchorVerificationReceipt) =>
  evidenceVerificationManifestationKey(EvidenceVerificationManifestation.make({ evidenceId, verifiedAnchor }))
);
