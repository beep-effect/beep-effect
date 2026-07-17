/**
 * Patent asset entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";
import { PatentAssetStatus } from "./PatentAsset.values.ts";

const $I = $LawPracticeDomainId.create("entities/PatentAsset/PatentAsset.model");

/**
 * Patent asset entity managed inside a prosecution matter.
 *
 * @example
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
export class PatentAsset extends BaseEntity.Class<PatentAsset>($I`PatentAsset`)(
  LawPractice.PatentAssetId,
  {
    fields: {
      fixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Stable fixture key for the patent asset.",
      }),
      matterFixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Fixture key for the matter this patent asset belongs to.",
      }),
      status: PatentAssetStatus.annotateKey({
        description: "Patent asset lifecycle status.",
      }),
      title: LawPracticeText.annotateKey({
        description: "Human-readable patent asset title.",
      }),
    },
    persisted: {
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      matterFixtureKey: EntitySchema.persist.text({
        columnName: "matter_fixture_key",
      }),
      status: EntitySchema.persist.literal({
        columnName: "status",
      }),
      title: EntitySchema.persist.text({
        columnName: "title",
      }),
    },
  },
  $I.annote("PatentAsset", {
    description: "Patent asset entity managed inside a prosecution matter.",
  })
) {}
