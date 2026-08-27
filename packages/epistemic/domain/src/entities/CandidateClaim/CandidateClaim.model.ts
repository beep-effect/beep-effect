/**
 * Candidate claim entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimLifecycle, EpistemicFixtureKey } from "@beep/epistemic-domain/values";
import { $EpistemicDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";

const $I = $EpistemicDomainId.create("entities/CandidateClaim/CandidateClaim.model");
const pg = ProductEntity.pg;

/**
 * Candidate claim proposed by an agent and tracked through admission.
 *
 * **Example** (Decoding CandidateClaim from object)
 *
 * ```ts
 * import { CandidateClaim } from "@beep/epistemic-domain"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const claim = S.decodeUnknownSync(CandidateClaim)({
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: Epistemic.CandidateClaimId.entityType,
 *   fixtureKey: "claim:patentability",
 *   id: 1,
 *   lifecycle: "candidate",
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   snapshot: { text: "The application describes a processor." },
 *   source: "Agent",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(claim.lifecycle)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class CandidateClaim extends ProductEntity.Entity<CandidateClaim>()(Epistemic.CandidateClaimId)(
  {
    fixtureKey: EpistemicFixtureKey.annotateKey({
      description: "Stable fixture key for the candidate claim.",
    }).pipe(pg.text(), pg.columnName("fixture_key")),
    lifecycle: ClaimLifecycle.pipe(pg.text()),
    snapshot: UnknownRecord.pipe(pg.jsonb()),
  },
  $I.annote("CandidateClaim", {
    description: "Candidate claim proposed by an agent with source evidence.",
  })
) {}
