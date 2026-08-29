/**
 * Legal contact entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";
import { LegalContactRole } from "./LegalContact.values.ts";

const $I = $LawPracticeDomainId.create("entities/LegalContact/LegalContact.model");
const pg = ProductEntity.pg;

/**
 * Legal contact entity attached to a legal client.
 *
 * **Example** (Decode LegalContact entity)
 *
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
export class LegalContact extends ProductEntity.Entity<LegalContact>()(LawPractice.LegalContactId)(
  {
    displayName: LawPracticeText.annotateKey({
      description: "Human-readable legal contact display name.",
    }).pipe(pg.text(), pg.columnName("display_name")),
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the legal contact.",
    }).pipe(pg.text(), pg.columnName("fixture_key")),
    legalClientFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the legal client this contact belongs to.",
    }).pipe(pg.text(), pg.columnName("legal_client_fixture_key")),
    role: LegalContactRole.annotateKey({
      description: "Legal contact role.",
    }).pipe(pg.text()),
  },
  $I.annote("LegalContact", {
    description: "Legal contact entity attached to a legal client.",
  })
) {}
