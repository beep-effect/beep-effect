/**
 * Distinction entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { ClaimLifecycle } from "@beep/shared-domain/values/ClaimLifecycle";
import { LawPracticeFixtureKey } from "../LawPracticeEntity.fields.ts";
import { DistinctionDetail } from "./Distinction.values.ts";

const $I = $LawPracticeDomainId.create("entities/Distinction/Distinction.model");
const pg = ProductEntity.pg;

/**
 * Distinction entity asserted to overcome a rejection against a claim.
 *
 * **Details**
 *
 * Stores the argued {@link DistinctionDetail}, a source {@link TextAnchor}, and
 * the {@link ClaimLifecycle} state while linking to the claim it defends and the
 * rejection it answers.
 *
 * **Example** (Decode Distinction via Schema)
 *
 * ```ts
 * import { Distinction } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const systemPrincipal = { component: "Runtime", kind: "System" }
 * const distinction = S.decodeUnknownSync(Distinction)({
 *   anchor: { endChar: 58, quote: "does not disclose the hinged lid", startChar: 21 },
 *   claimFixtureKey: "claim.1",
 *   createdAt: 1,
 *   createdByPrincipal: systemPrincipal,
 *   detail: {
 *     kind: "missing_limitation",
 *     limitation: "a hinge coupling the lid to the base",
 *   },
 *   entityType: "LawPracticeDistinction",
 *   fixtureKey: "distinction.hinge",
 *   id: 5,
 *   lifecycleState: "candidate",
 *   orgId: 1,
 *   rejectionFixtureKey: "rejection-example",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 1,
 *   updatedByPrincipal: systemPrincipal,
 * })
 *
 * console.log(distinction.detail.kind) // "missing_limitation"
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Distinction extends ProductEntity.Entity<Distinction>()(LawPractice.DistinctionId)(
  {
    anchor: TextAnchor.annotateKey({
      description: "Source text anchor for the asserted distinction.",
    }).pipe(pg.jsonb()),
    claimFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the claim defended by this distinction.",
    }).pipe(pg.text(), pg.columnName("claim_fixture_key")),
    detail: DistinctionDetail.annotateKey({
      description: "Substantive distinction detail.",
    }).pipe(pg.jsonb()),
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the distinction.",
    }).pipe(pg.text(), pg.columnName("fixture_key")),
    lifecycleState: ClaimLifecycle.annotateKey({
      description: "Lifecycle state of the distinction claim.",
    }).pipe(pg.text(), pg.columnName("lifecycle_state")),
    rejectionFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the rejection answered by this distinction.",
    }).pipe(pg.text(), pg.columnName("rejection_fixture_key")),
  },
  $I.annote("Distinction", {
    description: "Distinction entity asserted to overcome a rejection against a claim.",
  })
) {}
