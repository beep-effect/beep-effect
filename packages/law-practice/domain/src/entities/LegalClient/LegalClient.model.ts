/**
 * Legal client entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.ts";
import { LegalClientStatus } from "./LegalClient.values.ts";

const $I = $LawPracticeDomainId.create("entities/LegalClient/LegalClient.model");
const pg = ProductEntity.pg;

/**
 * Legal client entity that owns law-practice contacts and matters.
 *
 * **Example** (Decode LegalClient with Schema)
 *
 * ```ts
 * import { LegalClient } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const systemPrincipal = { component: "Runtime", kind: "System" }
 * const client = S.decodeUnknownSync(LegalClient)({
 *   createdAt: 1,
 *   createdByPrincipal: systemPrincipal,
 *   displayName: "Acme Robotics",
 *   entityType: "LawPracticeLegalClient",
 *   fixtureKey: "legal-client.acme",
 *   id: 1,
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   status: "active_client",
 *   updatedAt: 1,
 *   updatedByPrincipal: systemPrincipal,
 * })
 *
 * console.log(client.status) // "active_client"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class LegalClient extends ProductEntity.Entity<LegalClient>()(LawPractice.LegalClientId)(
  {
    displayName: LawPracticeText.annotateKey({
      description: "Human-readable legal client display name.",
    }).pipe(pg.text(), pg.columnName("display_name")),
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the legal client.",
    }).pipe(pg.text(), pg.columnName("fixture_key")),
    status: LegalClientStatus.annotateKey({
      description: "Legal client lifecycle status.",
    }).pipe(pg.text()),
  },
  $I.annote("LegalClient", {
    description: "Legal client entity that owns law-practice contacts and matters.",
  })
) {}
