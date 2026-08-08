/**
 * Candidate claim entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimLifecycle, EpistemicFixtureKey } from "@beep/epistemic-domain/values";
import { $EpistemicDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";

const $I = $EpistemicDomainId.create("entities/CandidateClaim/CandidateClaim.model");

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
export class CandidateClaim extends BaseEntity.Class<CandidateClaim>($I`CandidateClaim`)(
  Epistemic.CandidateClaimId,
  {
    fields: {
      fixtureKey: EpistemicFixtureKey.annotateKey({
        description: "Stable fixture key for the candidate claim.",
      }),
      lifecycle: ClaimLifecycle,
      snapshot: UnknownRecord,
    },
    persisted: {
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      lifecycle: EntitySchema.persist.literal({
        columnName: "lifecycle",
      }),
      snapshot: EntitySchema.persist.jsonb({
        columnName: "snapshot",
      }),
    },
  },
  $I.annote("CandidateClaim", {
    description: "Candidate claim proposed by an agent with source evidence.",
  })
) {}
