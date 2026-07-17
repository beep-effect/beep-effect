/**
 * Prior art reference entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";

const $I = $LawPracticeDomainId.create("entities/PriorArtReference/PriorArtReference.model");

/**
 * Prior-art reference entity cited by an office action.
 *
 * Captures the examiner-cited document number and title while linking back to
 * the office action fixture that introduced the reference.
 *
 * @example
 * ```ts
 * import { PriorArtReference } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const systemPrincipal = { component: "Runtime", kind: "System" }
 * const reference = S.decodeUnknownSync(PriorArtReference)({
 *   createdAt: 1,
 *   createdByPrincipal: systemPrincipal,
 *   documentNumber: "US 7,654,321 B2",
 *   entityType: "LawPracticePriorArtReference",
 *   fixtureKey: "prior-art.smith",
 *   id: 6,
 *   officeActionFixtureKey: "office-action.first",
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   title: "Smith hinge assembly",
 *   updatedAt: 1,
 *   updatedByPrincipal: systemPrincipal,
 * })
 *
 * console.log(reference.documentNumber) // "US 7,654,321 B2"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class PriorArtReference extends BaseEntity.Class<PriorArtReference>($I`PriorArtReference`)(
  LawPractice.PriorArtReferenceId,
  {
    fields: {
      documentNumber: LawPracticeText.annotateKey({
        description: "Examiner-cited prior-art document number.",
      }),
      fixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Stable fixture key for the prior-art reference.",
      }),
      officeActionFixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Fixture key for the office action that cited this prior art.",
      }),
      title: LawPracticeText.annotateKey({
        description: "Human-readable prior-art reference title.",
      }),
    },
    persisted: {
      documentNumber: EntitySchema.persist.text({
        columnName: "document_number",
      }),
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      officeActionFixtureKey: EntitySchema.persist.text({
        columnName: "office_action_fixture_key",
      }),
      title: EntitySchema.persist.text({
        columnName: "title",
      }),
    },
  },
  $I.annote("PriorArtReference", {
    description: "Prior-art reference entity cited by an office action.",
  })
) {}
