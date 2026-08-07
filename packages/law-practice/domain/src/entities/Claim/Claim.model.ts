/**
 * Patent claim entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";
import { ClaimNumber, LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";

const $I = $LawPracticeDomainId.create("entities/Claim/Claim.model");

/**
 * Patent claim entity for a single numbered claim under a patent asset.
 *
 * **Details**
 *
 * Carries the claim number, full claim text, and independent/dependent marker
 * while linking back to the patent asset fixture that owns it.
 *
 * **Example** (Decode a Claim entity)
 *
 * ```ts
 * import { Claim } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const systemPrincipal = { component: "Runtime", kind: "System" }
 * const claim = S.decodeUnknownSync(Claim)({
 *   claimNumber: 1,
 *   createdAt: 1,
 *   createdByPrincipal: systemPrincipal,
 *   entityType: "LawPracticeClaim",
 *   fixtureKey: "claim.1",
 *   id: 2,
 *   independent: true,
 *   orgId: 1,
 *   patentAssetFixtureKey: "patent-asset.spike",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   text: "1. A hinge assembly comprising a lid and a base.",
 *   updatedAt: 1,
 *   updatedByPrincipal: systemPrincipal,
 * })
 *
 * console.log(claim.independent) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Claim extends BaseEntity.Class<Claim>($I`Claim`)(
  LawPractice.ClaimId,
  {
    fields: {
      claimNumber: ClaimNumber.annotateKey({
        description: "One-based patent claim number.",
      }),
      fixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Stable fixture key for the claim.",
      }),
      independent: S.Boolean.annotateKey({
        description: "Whether the claim is independent.",
      }),
      patentAssetFixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Fixture key for the patent asset this claim belongs to.",
      }),
      text: LawPracticeText.annotateKey({
        description: "Full claim text.",
      }),
    },
    persisted: {
      claimNumber: EntitySchema.persist.int({
        columnName: "claim_number",
      }),
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      independent: EntitySchema.persist.bool({
        columnName: "independent",
      }),
      patentAssetFixtureKey: EntitySchema.persist.text({
        columnName: "patent_asset_fixture_key",
      }),
      text: EntitySchema.persist.text({
        columnName: "text",
      }),
    },
  },
  $I.annote("Claim", {
    description: "Patent claim entity for a single numbered claim under a patent asset.",
  })
) {}
