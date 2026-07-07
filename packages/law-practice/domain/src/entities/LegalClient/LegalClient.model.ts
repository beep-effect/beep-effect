/**
 * Legal client entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey, LawPracticeText } from "../LawPracticeEntity.fields.js";
import { LegalClientStatus } from "./LegalClient.values.ts";

const $I = $LawPracticeDomainId.create("entities/LegalClient/LegalClient.model");

/**
 * Legal client entity that owns law-practice contacts and matters.
 *
 * @example
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
export class LegalClient extends BaseEntity.Class<LegalClient>($I`LegalClient`)(
  LawPractice.LegalClientId,
  {
    fields: {
      displayName: LawPracticeText.annotateKey({
        description: "Human-readable legal client display name.",
      }),
      fixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Stable fixture key for the legal client.",
      }),
      status: LegalClientStatus.annotateKey({
        description: "Legal client lifecycle status.",
      }),
    },
    persisted: {
      displayName: EntitySchema.persist.text({
        columnName: "display_name",
      }),
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      status: EntitySchema.persist.literal({
        columnName: "status",
      }),
    },
  },
  $I.annote("LegalClient", {
    description: "Legal client entity that owns law-practice contacts and matters.",
  })
) {}
