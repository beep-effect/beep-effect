/**
 * Claim disposition entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { ClaimDispositionStatus, ClaimGateViolation } from "@beep/epistemic-domain/values";
import { $EpistemicDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("entities/ClaimDisposition/ClaimDisposition.model");

const ClaimDispositionReason = S.NonEmptyString.pipe(
  $I.annoteSchema("ClaimDispositionReason", {
    description: "Human-readable reason recorded with a claim disposition.",
  })
);

/**
 * The durable record of how a claim was resolved. A rejected gate verdict is a
 * decision worth keeping: without this row the rejection lives only in the log
 * line that produced it, and the claim looks merely un-advanced rather than
 * deliberately refused. The violations that blocked admission are stored verbatim
 * so the refusal can be re-read without re-running the gate.
 *
 * **Example** (Decoding a rejected disposition)
 *
 * ```ts
 * import { ClaimDisposition } from "@beep/epistemic-domain"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const disposition = S.decodeUnknownSync(ClaimDisposition)({
 *   claimId: 3,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: Epistemic.ClaimDispositionId.entityType,
 *   id: 1,
 *   orgId: 1,
 *   reason: "Expected at least 1 value(s) for evidence.",
 *   resolvedAt: 1_000,
 *   resolvedBy: { kind: "System", component: "Runtime" },
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   status: "rejected",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   violations: [
 *     {
 *       focusNode: "https://beep.dev/epistemic/claim/patentability",
 *       message: "Expected at least 1 value(s) for evidence.",
 *       path: "https://beep.dev/epistemic/hasEvidenceQuote",
 *       severity: "violation"
 *     }
 *   ]
 * })
 *
 * console.log(disposition.status)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ClaimDisposition extends BaseEntity.Class<ClaimDisposition>($I`ClaimDisposition`)(
  Epistemic.ClaimDispositionId,
  {
    fields: {
      claimId: Epistemic.CandidateClaimId.annotateKey({ description: "Candidate claim this disposition resolves." }),
      reason: ClaimDispositionReason.annotateKey({ description: "Human-readable reason for the disposition." }),
      resolvedAt: EntitySchema.DateTimeFromMillis.annotateKey({
        description: "When the disposition was decided.",
      }),
      resolvedBy: Principal.annotateKey({ description: "Principal that decided the disposition." }),
      status: ClaimDispositionStatus.annotateKey({ description: "Status assigned to the claim." }),
      violations: S.Array(ClaimGateViolation).annotateKey({
        description: "Claim gate violations recorded verbatim with the disposition.",
      }),
    },
    persisted: {
      claimId: EntitySchema.persist.entityId({
        columnName: "claim_id",
      }),
      reason: EntitySchema.persist.text({
        columnName: "reason",
      }),
      resolvedAt: EntitySchema.persist.timestampMillis({
        columnName: "resolved_at",
      }),
      resolvedBy: EntitySchema.persist.jsonb({
        columnName: "resolved_by",
      }),
      status: EntitySchema.persist.literal({
        columnName: "status",
      }),
      violations: EntitySchema.persist.jsonb({
        columnName: "violations",
      }),
    },
  },
  $I.annote("ClaimDisposition", {
    description: "Durable record of how a candidate claim was resolved.",
  })
) {}
