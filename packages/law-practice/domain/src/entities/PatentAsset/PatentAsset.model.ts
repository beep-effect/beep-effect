/**
 * Patent asset entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";
import { PatentAssetStatus } from "./PatentAsset.values.ts";

const $I = $LawPracticeDomainId.create("entities/PatentAsset/PatentAsset.model");
const PatentAssetEntity = ProductEntity.make(LawPractice.PatentAssetId);

/**
 * Patent asset entity managed inside a prosecution matter.
 *
 * **Example** (Decoding a PatentAsset)
 *
 * ```ts
 * import { PatentAsset } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const systemPrincipal = { component: "Runtime", kind: "System" }
 * const asset = S.decodeUnknownSync(PatentAsset)({
 *   createdAt: 1,
 *   createdByPrincipal: systemPrincipal,
 *   entityType: "LawPracticePatentAsset",
 *   fixtureKey: "patent-asset.hinge",
 *   id: 5,
 *   matterFixtureKey: "matter.hinge",
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   status: "pre_filing",
 *   title: "Hinged lid assembly",
 *   updatedAt: 1,
 *   updatedByPrincipal: systemPrincipal,
 * })
 *
 * console.log(asset.status) // "pre_filing"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class PatentAsset extends PatentAssetEntity.Entity<PatentAsset>(PatentAssetEntity.tableName)(
  {
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the patent asset.",
    }).pipe(PatentAssetEntity.pg.text(), PatentAssetEntity.pg.columnName("fixture_key")),
    matterFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the matter this patent asset belongs to.",
    }).pipe(PatentAssetEntity.pg.text(), PatentAssetEntity.pg.columnName("matter_fixture_key")),
    status: PatentAssetStatus.annotateKey({
      description: "Patent asset lifecycle status.",
    }).pipe(PatentAssetEntity.pg.text()),
    title: LawPracticeText.annotateKey({
      description: "Human-readable patent asset title.",
    }).pipe(PatentAssetEntity.pg.text()),
    ...PatentAssetEntity.identityFields,
  },
  $I.annote("PatentAsset", {
    description: "Patent asset entity managed inside a prosecution matter.",
  }),
  PatentAssetEntity.entityExtras
) {}
