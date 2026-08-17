/**
 * Rejection entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { LawPracticeFixtureKey } from "../LawPracticeEntity.fields.ts";
import { RejectionGround } from "./Rejection.values.ts";

const $I = $LawPracticeDomainId.create("entities/Rejection/Rejection.model");
const RejectionEntity = ProductEntity.make(LawPractice.RejectionId);

/**
 * Rejection entity raised against a claim by an office action.
 *
 * **Details**
 *
 * Stores the statutory {@link RejectionGround} as JSONB so the per-statute
 * prior-art cardinality survives persistence while linking to the rejected claim
 * and the office action that raised the rejection.
 *
 * **Example** (Decoding a Rejection entity)
 *
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
export class Rejection extends RejectionEntity.Entity<Rejection>(RejectionEntity.tableName)(
  {
    claimFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the rejected claim.",
    }).pipe(RejectionEntity.pg.text(), RejectionEntity.pg.columnName("claim_fixture_key")),
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the rejection.",
    }).pipe(RejectionEntity.pg.text(), RejectionEntity.pg.columnName("fixture_key")),
    ground: RejectionGround.annotateKey({
      description: "Statutory rejection ground.",
    }).pipe(RejectionEntity.pg.jsonb()),
    officeActionFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the office action that raised this rejection.",
    }).pipe(RejectionEntity.pg.text(), RejectionEntity.pg.columnName("office_action_fixture_key")),
    ...RejectionEntity.identityFields,
  },
  $I.annote("Rejection", {
    description: "A statutory rejection raised against a claim by an office action.",
  }),
  RejectionEntity.entityExtras
) {}
