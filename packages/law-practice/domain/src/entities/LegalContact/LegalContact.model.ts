/**
 * Legal contact entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.js";
import { LegalContactRole } from "./LegalContact.values.js";

const $I = $LawPracticeDomainId.create("entities/LegalContact/LegalContact.model");

/**
 * Legal contact entity attached to a legal client.
 *
 * @example
 * ```ts
 * import { LegalContact } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const systemPrincipal = { component: "Runtime", kind: "System" }
 * const contact = S.decodeUnknownSync(LegalContact)({
 *   createdAt: 1,
 *   createdByPrincipal: systemPrincipal,
 *   displayName: "Ada Founder",
 *   entityType: "LawPracticeLegalContact",
 *   fixtureKey: "contact.ada",
 *   id: 2,
 *   legalClientFixtureKey: "legal-client.acme",
 *   orgId: 1,
 *   role: "founder",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 1,
 *   updatedByPrincipal: systemPrincipal,
 * })
 *
 * console.log(contact.legalClientFixtureKey) // "legal-client.acme"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class LegalContact extends BaseEntity.Class<LegalContact>($I`LegalContact`)(
  LawPractice.LegalContactId,
  {
    fields: {
      displayName: LawPracticeText.annotateKey({
        description: "Human-readable legal contact display name.",
      }),
      fixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Stable fixture key for the legal contact.",
      }),
      legalClientFixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Fixture key for the legal client this contact belongs to.",
      }),
      role: LegalContactRole.annotateKey({
        description: "Legal contact role.",
      }),
    },
    persisted: {
      displayName: EntitySchema.persist.text({
        columnName: "display_name",
      }),
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      legalClientFixtureKey: EntitySchema.persist.text({
        columnName: "legal_client_fixture_key",
      }),
      role: EntitySchema.persist.literal({
        columnName: "role",
      }),
    },
  },
  $I.annote("LegalContact", {
    description: "Legal contact entity attached to a legal client.",
  })
) {}
