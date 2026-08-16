/**
 * Immutable evidence-verification sidecar entity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { EvidenceVerificationManifestationKey } from "@beep/epistemic-domain/values/EvidenceVerification";
import { $EpistemicDomainId } from "@beep/identity/packages";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";

const $I = $EpistemicDomainId.create("entities/EvidenceVerification/EvidenceVerification.model");
const EvidenceVerificationEntity = ProductEntity.make(Epistemic.EvidenceVerificationId);

/**
 * Append-only link from an existing evidence row to one exact verified source
 * manifestation.
 *
 * **Details**
 *
 * `manifestationKey` seals `evidenceId` and `verifiedAnchor`. Persistence owns
 * the `(org_id, manifestation_key)` unique constraint and denies UPDATE and
 * DELETE so an exact repeat is idempotent while a changed source identity or
 * anchor appends a distinct row.
 *
 * **Example** (Access entity table name)
 *
 * ```ts
 * import { EvidenceVerification } from "@beep/epistemic-domain/entities/EvidenceVerification"
 *
 * console.log(EvidenceVerification.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class EvidenceVerification extends EvidenceVerificationEntity.Entity<EvidenceVerification>(
  EvidenceVerificationEntity.tableName
)(
  {
    evidenceId: EpistemicIdentity.EvidenceId.annotateKey({
      description: "Existing epistemic evidence row whose source anchor was verified.",
    }).pipe(EvidenceVerificationEntity.pg.integer(), EvidenceVerificationEntity.pg.columnName("evidence_id")),
    manifestationKey: EvidenceVerificationManifestationKey.annotateKey({
      description: "Digest sealing the evidence id and complete verified anchor payload.",
    }).pipe(EvidenceVerificationEntity.pg.text(), EvidenceVerificationEntity.pg.columnName("manifestation_key")),
    verifiedAnchor: TextAnchorVerificationReceipt.annotateKey({
      description:
        "Persisted anchor receipt; canonical source text must be resolved and re-verified before runtime use.",
    }).pipe(EvidenceVerificationEntity.pg.jsonb(), EvidenceVerificationEntity.pg.columnName("verified_anchor")),
    ...EvidenceVerificationEntity.identityFields,
  },
  $I.annote("EvidenceVerification", {
    description: "Append-only evidence sidecar binding one evidence row to an exact verified text anchor.",
  }),
  EvidenceVerificationEntity.entityExtras
) {}
