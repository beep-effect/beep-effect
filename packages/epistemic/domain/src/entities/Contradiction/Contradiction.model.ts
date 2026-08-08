/**
 * Durable contradiction-candidate entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  BeliefVersionRef,
  CanonicalContradictionBeliefPair,
  ContradictionAssessment,
  ContradictionCandidateDigest,
  ContradictionCandidateKey,
  ContradictionDispositionDecision,
  ContradictionMatchBasis,
  ContradictionProposalContent,
  ContradictionReceiptKey,
  contradictionCandidateDigest,
  contradictionCandidateKey,
  contradictionEvidenceDigest,
  contradictionProposalDigest,
} from "@beep/epistemic-domain/values/Contradiction";
import { $EpistemicDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { identity, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Epistemic from "../../identity/Epistemic.ts";
import type { ContradictionCandidateContent } from "@beep/epistemic-domain/values/Contradiction";

const $I = $EpistemicDomainId.create("entities/Contradiction/Contradiction.model");
const beliefVersionRefEquivalence = S.toEquivalence(BeliefVersionRef);

const proposalTargetsPair = (
  pair: CanonicalContradictionBeliefPair,
  proposal: ContradictionAssessment["proposals"][number]
): boolean =>
  beliefVersionRefEquivalence(proposal.losingBelief, pair.left) ||
  beliefVersionRefEquivalence(proposal.losingBelief, pair.right);

/**
 * Immutable, evidence-backed proposal that two exact belief versions
 * contradict.
 *
 * **Example** (Log entity table name)
 *
 * ```ts
 * import { ContradictionCandidate } from "@beep/epistemic-domain/entities/Contradiction"
 *
 * console.log(ContradictionCandidate.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ContradictionCandidate extends BaseEntity.Class<ContradictionCandidate>($I`ContradictionCandidate`)(
  Epistemic.ContradictionCandidateId,
  {
    fields: {
      candidateKey: ContradictionCandidateKey.annotateKey({
        description: "Order-independent duplicate-suppression key for the pair and match basis.",
      }),
      candidateDigest: ContradictionCandidateDigest.annotateKey({
        description: "Collision guard over the complete immutable candidate payload.",
      }),
      assessment: ContradictionAssessment.annotateKey({
        description: "Detector confidence and explicit proposals presented for human review.",
      }),
      matchBasis: ContradictionMatchBasis.annotateKey({
        description: "Evidence references and detector revision forming the exact match basis.",
      }),
      pair: CanonicalContradictionBeliefPair.annotateKey({
        description: "Canonical pair of immutable belief-version references.",
      }),
      recordedAt: EntitySchema.DateTimeFromMillis.annotateKey({
        description: "Transaction-time instant when this candidate first became known.",
      }),
      validFrom: EntitySchema.DateTimeFromMillis.annotateKey({
        description: "Inclusive valid-time lower bound of the detected contradiction.",
      }),
      validTo: EntitySchema.DateTimeFromMillis.pipe(S.OptionFromNullOr).annotateKey({
        description: "Exclusive valid-time upper bound; absent while the contradiction remains temporally applicable.",
      }),
    },
    persisted: {
      candidateKey: EntitySchema.persist.text({
        columnName: "candidate_key",
      }),
      candidateDigest: EntitySchema.persist.text({
        columnName: "candidate_digest",
      }),
      assessment: EntitySchema.persist.jsonb({
        columnName: "assessment",
      }),
      matchBasis: EntitySchema.persist.jsonb({
        columnName: "match_basis",
      }),
      pair: EntitySchema.persist.jsonb({
        columnName: "belief_pair",
      }),
      recordedAt: EntitySchema.persist.timestampMillis({
        columnName: "recorded_at",
        indexHints: [EntitySchema.IndexHint.btree],
      }),
      validFrom: EntitySchema.persist.timestampMillis({
        columnName: "valid_from",
        indexHints: [EntitySchema.IndexHint.btree],
      }),
      validTo: EntitySchema.persist.timestampMillis({
        columnName: "valid_to",
      }),
    },
  },
  $I.annote("ContradictionCandidate", {
    description: "Immutable evidence-backed proposal that two exact belief versions contradict.",
  })
) {
  /**
   * Recompute every digest and key sealing this immutable candidate.
   *
   * **Example** (Validate candidate seals)
   *
   * ```ts
   * import type { ContradictionCandidate } from "@beep/epistemic-domain/entities/Contradiction"
   * import * as Result from "effect/Result"
   *
   * const acceptsCandidate = (candidate: ContradictionCandidate): boolean =>
   *   Result.getOrThrow(candidate.hasValidSeals())
   * ```
   *
   * @returns A non-throwing result containing `true` only when the evidence
   * digest, candidate key, every proposal digest, and candidate payload digest
   * all seal the exact values carried by this row.
   * @category validation
   * @since 0.0.0
   */
  readonly hasValidSeals = (): Result.Result<boolean, S.SchemaError> => {
    const proposalSeals = pipe(
      this.assessment.proposals,
      A.map((proposal) =>
        Result.map(
          contradictionProposalDigest(
            ContradictionProposalContent.make({
              fact: proposal.fact,
              losingBelief: proposal.losingBelief,
              proposalId: proposal.proposalId,
              rationale: proposal.rationale,
              validFrom: proposal.validFrom,
              validTo: proposal.validTo,
            })
          ),
          (digest) => Eq.equals(digest, proposal.proposalDigest)
        )
      ),
      Result.all
    );

    const candidateContent = {
      assessment: this.assessment,
      matchBasis: this.matchBasis,
      pair: this.pair,
      validFrom: this.validFrom,
      validTo: this.validTo,
    } satisfies ContradictionCandidateContent;

    return Result.flatMap(proposalSeals, (validProposalSeals) =>
      Result.map(contradictionCandidateDigest(candidateContent), (candidateDigest) =>
        A.every(
          [
            Eq.equals(
              contradictionEvidenceDigest(this.matchBasis.leftEvidenceIds, this.matchBasis.rightEvidenceIds),
              this.matchBasis.evidenceDigest
            ),
            Eq.equals(contradictionCandidateKey(this.pair, this.matchBasis), this.candidateKey),
            A.every(this.assessment.proposals, (proposal) => proposalTargetsPair(this.pair, proposal)),
            ...validProposalSeals,
            Eq.equals(candidateDigest, this.candidateDigest),
          ],
          identity
        )
      )
    );
  };
}

/**
 * Durable receipt proving a submission was observed even when its candidate
 * was duplicate-suppressed.
 *
 * **Example** (Log entity table name)
 *
 * ```ts
 * import { ContradictionReceipt } from "@beep/epistemic-domain/entities/Contradiction"
 *
 * console.log(ContradictionReceipt.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ContradictionReceipt extends BaseEntity.Class<ContradictionReceipt>($I`ContradictionReceipt`)(
  Epistemic.ContradictionReceiptId,
  {
    fields: {
      candidateId: Epistemic.ContradictionCandidateId.annotateKey({
        description: "Canonical candidate this submission resolved to.",
      }),
      receiptKey: ContradictionReceiptKey.annotateKey({
        description: "Caller-owned idempotency key for this submission receipt.",
      }),
      receivedAt: EntitySchema.DateTimeFromMillis.annotateKey({
        description: "Transaction-time instant when the submission was received.",
      }),
      receivedBy: Principal.annotateKey({
        description: "Principal responsible for the submitted candidate.",
      }),
    },
    persisted: {
      candidateId: EntitySchema.persist.entityId({
        columnName: "candidate_id",
        indexHints: [EntitySchema.IndexHint.btree],
      }),
      receiptKey: EntitySchema.persist.text({
        columnName: "receipt_key",
      }),
      receivedAt: EntitySchema.persist.timestampMillis({
        columnName: "received_at",
      }),
      receivedBy: EntitySchema.persist.jsonb({
        columnName: "received_by",
      }),
    },
  },
  $I.annote("ContradictionReceipt", {
    description: "Durable receipt for a contradiction submission, including duplicate submissions.",
  })
) {}

/**
 * Append-only record of a human contradiction review.
 *
 * **Example** (Log entity table name)
 *
 * ```ts
 * import { ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction"
 *
 * console.log(ContradictionDisposition.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ContradictionDisposition extends BaseEntity.Class<ContradictionDisposition>($I`ContradictionDisposition`)(
  Epistemic.ContradictionDispositionId,
  {
    fields: {
      candidateId: Epistemic.ContradictionCandidateId.annotateKey({
        description: "Contradiction candidate resolved by this disposition.",
      }),
      decision: ContradictionDispositionDecision.annotateKey({
        description: "Typed rejection or completed supersession outcome.",
      }),
      resolvedAt: EntitySchema.DateTimeFromMillis.annotateKey({
        description: "Transaction-time instant when the human disposition was recorded.",
      }),
      resolvedBy: Principal.annotateKey({
        description: "Principal who decided the contradiction disposition.",
      }),
    },
    persisted: {
      candidateId: EntitySchema.persist.entityId({
        columnName: "candidate_id",
        indexHints: [EntitySchema.IndexHint.unique],
      }),
      decision: EntitySchema.persist.jsonb({
        columnName: "decision",
      }),
      resolvedAt: EntitySchema.persist.timestampMillis({
        columnName: "resolved_at",
      }),
      resolvedBy: EntitySchema.persist.jsonb({
        columnName: "resolved_by",
      }),
    },
  },
  $I.annote("ContradictionDisposition", {
    description: "Append-only human disposition rejecting a contradiction or recording its atomic supersession.",
  })
) {}
