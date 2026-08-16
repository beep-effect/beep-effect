/**
 * Legal matter entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";
import { MatterType } from "./Matter.values.ts";

const $I = $LawPracticeDomainId.create("entities/Matter/Matter.model");
const MatterEntity = ProductEntity.make(LawPractice.MatterId);

/**
 * Legal matter entity grouping prosecution work for one legal client.
 *
 * **Example** (Decode Matter with Schema)
 *
 * ```ts
 * import { Matter } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const systemPrincipal = { component: "Runtime", kind: "System" }
 * const matter = S.decodeUnknownSync(Matter)({
 *   createdAt: 1,
 *   createdByPrincipal: systemPrincipal,
 *   displayName: "Acme hinge application",
 *   entityType: "LawPracticeMatter",
 *   fixtureKey: "matter.hinge",
 *   id: 3,
 *   legalClientFixtureKey: "legal-client.acme",
 *   matterType: "patent_application",
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 1,
 *   updatedByPrincipal: systemPrincipal,
 * })
 *
 * console.log(matter.matterType) // "patent_application"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Matter extends MatterEntity.Entity<Matter>(MatterEntity.tableName)(
  {
    displayName: LawPracticeText.annotateKey({
      description: "Human-readable matter display name.",
    }).pipe(MatterEntity.pg.text(), MatterEntity.pg.columnName("display_name")),
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the matter.",
    }).pipe(MatterEntity.pg.text(), MatterEntity.pg.columnName("fixture_key")),
    legalClientFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the legal client this matter belongs to.",
    }).pipe(MatterEntity.pg.text(), MatterEntity.pg.columnName("legal_client_fixture_key")),
    matterType: MatterType.annotateKey({
      description: "Matter type.",
    }).pipe(MatterEntity.pg.text(), MatterEntity.pg.columnName("matter_type")),
    ...MatterEntity.identityFields,
  },
  $I.annote("Matter", {
    description: "Legal matter entity grouping prosecution work for one legal client.",
  }),
  MatterEntity.entityExtras
) {}
