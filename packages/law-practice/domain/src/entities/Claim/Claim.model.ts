/**
 * Patent claim entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";
import { ClaimNumber, LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";

const $I = $LawPracticeDomainId.create("entities/Claim/Claim.model");
const ClaimEntity = ProductEntity.make(LawPractice.ClaimId);

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
export class Claim extends ClaimEntity.Entity<Claim>(ClaimEntity.tableName)(
  {
    claimNumber: ClaimNumber.annotateKey({
      description: "One-based patent claim number.",
    }).pipe(ClaimEntity.pg.integer(), ClaimEntity.pg.columnName("claim_number")),
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the claim.",
    }).pipe(ClaimEntity.pg.text(), ClaimEntity.pg.columnName("fixture_key")),
    independent: S.Boolean.annotateKey({
      description: "Whether the claim is independent.",
    }).pipe(ClaimEntity.pg.boolean()),
    patentAssetFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the patent asset this claim belongs to.",
    }).pipe(ClaimEntity.pg.text(), ClaimEntity.pg.columnName("patent_asset_fixture_key")),
    text: LawPracticeText.annotateKey({
      description: "Full claim text.",
    }).pipe(ClaimEntity.pg.text()),
    ...ClaimEntity.identityFields,
  },
  $I.annote("Claim", {
    description: "Patent claim entity for a single numbered claim under a patent asset.",
  }),
  ClaimEntity.entityExtras
) {}
