/**
 * Office action entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";

const $I = $LawPracticeDomainId.create("entities/OfficeAction/OfficeAction.model");

/**
 * USPTO office action entity for a patent asset under examination.
 *
 * **Details**
 *
 * Links the action to the prosecuting matter and patent asset fixture while
 * carrying the application number extracted from the action.
 *
 * **Example** (Decode OfficeAction entity)
 *
 * ```ts
 * import { OfficeAction } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const systemPrincipal = { component: "Runtime", kind: "System" }
 * const action = S.decodeUnknownSync(OfficeAction)({
 *   applicationNumber: "18/123,456",
 *   createdAt: 1,
 *   createdByPrincipal: systemPrincipal,
 *   entityType: "LawPracticeOfficeAction",
 *   fixtureKey: "office-action.first",
 *   id: 4,
 *   matterFixtureKey: "matter.hinge",
 *   orgId: 1,
 *   patentAssetFixtureKey: "patent-asset.hinge",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 1,
 *   updatedByPrincipal: systemPrincipal,
 * })
 *
 * console.log(action.applicationNumber) // "18/123,456"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class OfficeAction extends BaseEntity.Class<OfficeAction>($I`OfficeAction`)(
  LawPractice.OfficeActionId,
  {
    fields: {
      applicationNumber: LawPracticeText.annotateKey({
        description: "Application number text extracted from the office action.",
      }),
      fixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Stable fixture key for the office action.",
      }),
      matterFixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Fixture key for the matter this office action belongs to.",
      }),
      patentAssetFixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Fixture key for the patent asset examined by this office action.",
      }),
    },
    persisted: {
      applicationNumber: EntitySchema.persist.text({
        columnName: "application_number",
      }),
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      matterFixtureKey: EntitySchema.persist.text({
        columnName: "matter_fixture_key",
      }),
      patentAssetFixtureKey: EntitySchema.persist.text({
        columnName: "patent_asset_fixture_key",
      }),
    },
  },
  $I.annote("OfficeAction", {
    description: "USPTO office action entity for a patent asset under examination.",
  })
) {}
