/**
 * Rejection entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey } from "../LawPracticeEntity.fields.js";
import { RejectionGround } from "./Rejection.values.js";

const $I = $LawPracticeDomainId.create("entities/Rejection/Rejection.model");

/**
 * Rejection entity raised against a claim by an office action.
 *
 * Stores the statutory {@link RejectionGround} as JSONB so the per-statute
 * prior-art cardinality survives persistence while linking to the rejected claim
 * and the office action that raised the rejection.
 *
 * @example
 * ```ts
 * import { Rejection } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const systemPrincipal = { component: "Runtime", kind: "System" }
 * const rejection = S.decodeUnknownSync(Rejection)({
 *   claimFixtureKey: "claim.1",
 *   createdAt: 1,
 *   createdByPrincipal: systemPrincipal,
 *   entityType: "LawPracticeRejection",
 *   fixtureKey: "rejection-example",
 *   ground: { referenceFixtureKey: "prior-art.smith", statute: "102" },
 *   id: 7,
 *   officeActionFixtureKey: "office-action.first",
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 1,
 *   updatedByPrincipal: systemPrincipal,
 * })
 *
 * console.log(rejection.ground.statute) // "102"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Rejection extends BaseEntity.Class<Rejection>($I`Rejection`)(
  LawPractice.RejectionId,
  {
    fields: {
      claimFixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Fixture key for the rejected claim.",
      }),
      fixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Stable fixture key for the rejection.",
      }),
      ground: RejectionGround.annotateKey({
        description: "Statutory rejection ground.",
      }),
      officeActionFixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Fixture key for the office action that raised this rejection.",
      }),
    },
    persisted: {
      claimFixtureKey: EntitySchema.persist.text({
        columnName: "claim_fixture_key",
      }),
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      ground: EntitySchema.persist.jsonb({
        columnName: "ground",
      }),
      officeActionFixtureKey: EntitySchema.persist.text({
        columnName: "office_action_fixture_key",
      }),
    },
  },
  $I.annote("Rejection", {
    description: "A statutory rejection raised against a claim by an office action.",
  })
) {}
