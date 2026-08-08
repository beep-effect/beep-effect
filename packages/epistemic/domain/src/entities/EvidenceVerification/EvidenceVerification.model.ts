/**
 * Immutable evidence-verification sidecar entity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  EvidenceVerificationManifestation,
  EvidenceVerificationManifestationKey,
  evidenceVerificationManifestationKey,
  isEvidenceVerificationManifestationKey,
} from "@beep/epistemic-domain/values/EvidenceVerification";
import { $EpistemicDomainId } from "@beep/identity/packages";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import * as Epistemic from "../../identity/Epistemic.ts";
import type * as Result from "effect/Result";
import type * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("entities/EvidenceVerification/EvidenceVerification.model");

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
 * console.log(EvidenceVerification.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class EvidenceVerification extends BaseEntity.Class<EvidenceVerification>($I`EvidenceVerification`)(
  Epistemic.EvidenceVerificationId,
  {
    fields: {
      evidenceId: EpistemicIdentity.EvidenceId.annotateKey({
        description: "Existing epistemic evidence row whose source anchor was verified.",
      }),
      manifestationKey: EvidenceVerificationManifestationKey.annotateKey({
        description: "Digest sealing the evidence id and complete verified anchor payload.",
      }),
      verifiedAnchor: TextAnchorVerificationReceipt.annotateKey({
        description:
          "Persisted anchor receipt; canonical source text must be resolved and re-verified before runtime use.",
      }),
    },
    persisted: {
      evidenceId: EntitySchema.persist.entityId({
        columnName: "evidence_id",
      }),
      manifestationKey: EntitySchema.persist.text({
        columnName: "manifestation_key",
      }),
      verifiedAnchor: EntitySchema.persist.jsonb({
        columnName: "verified_anchor",
      }),
    },
  },
  $I.annote("EvidenceVerification", {
    description: "Append-only evidence sidecar binding one evidence row to an exact verified text anchor.",
  })
) {
  /**
   * Recompute and validate this row's manifestation key.
   *
   * **Example** (Validate row manifestation key)
   *
   * ```ts
   * import { EvidenceVerification } from "@beep/epistemic-domain/entities/EvidenceVerification"
   * import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity"
   * import { TextAnchor } from "@beep/provenance/TextAnchor"
   * import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor"
   * import { NonNegativeInt } from "@beep/schema"
   * import { PosixPath } from "@beep/schema/PosixPath"
   * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   *
   * const digest = SourceTextDigest.make(
   *   "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
   * )
   * const verifiedAnchor = TextAnchorVerificationReceipt.make({
   *   anchor: TextAnchor.make({
   *     endChar: NonNegativeInt.make(4),
   *     quote: "fact",
   *     startChar: NonNegativeInt.make(0),
   *   }),
   *   source: SourceTextIdentity.make({
   *     extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
   *     locator: PosixPath.make("sources/fact.txt"),
   *     normalizationVersion: "1",
   *     scopeRef: "matter:example",
   *     sourceDigest: digest,
   *     sourceRef: "source:fact",
   *     textDigest: digest,
   *   }),
   * })
   * const evidenceId = Epistemic.EvidenceId.make(4)
   * const manifestationKey = Result.getOrThrow(
   *   EvidenceVerification.manifestationKeyFor(evidenceId, verifiedAnchor)
   * )
   * const verification = Result.getOrThrow(
   *   S.decodeUnknownResult(EvidenceVerification)({
   *     createdAt: 1,
   *     createdByPrincipal: { component: "Runtime", kind: "System" },
   *     entityType: "EpistemicEvidenceVerification",
   *     evidenceId: 4,
   *     id: 7,
   *     manifestationKey,
   *     orgId: 1,
   *     publicId: "epistemic_evidence_verification_a7",
   *     rowVersion: 1,
   *     schemaVersion: "0.0.0",
   *     source: "System",
   *     updatedAt: 2,
   *     updatedByPrincipal: { component: "Runtime", kind: "System" },
   *     verifiedAnchor,
   *   })
   * )
   *
   * console.log(Result.getOrThrow(verification.hasValidManifestationKey())) // true
   * ```
   *
   * @returns A non-throwing result containing `true` only when the persisted
   * key seals the exact evidence id and verified anchor carried by this row.
   * @category validation
   * @since 0.0.0
   */
  readonly hasValidManifestationKey = (): Result.Result<boolean, S.SchemaError> =>
    isEvidenceVerificationManifestationKey(
      EvidenceVerificationManifestation.make({
        evidenceId: this.evidenceId,
        verifiedAnchor: this.verifiedAnchor,
      }),
      this.manifestationKey
    );

  /**
   * Compute the manifestation key for an evidence id and verified anchor.
   *
   * **Example** (Inspect manifestationKeyFor type)
   *
   * ```ts
   * import { EvidenceVerification } from "@beep/epistemic-domain/entities/EvidenceVerification"
   *
   * console.log(typeof EvidenceVerification.manifestationKeyFor)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly manifestationKeyFor = (
    evidenceId: EpistemicIdentity.EvidenceId,
    verifiedAnchor: TextAnchorVerificationReceipt
  ): Result.Result<EvidenceVerificationManifestationKey, S.SchemaError> =>
    evidenceVerificationManifestationKey(EvidenceVerificationManifestation.make({ evidenceId, verifiedAnchor }));
}
