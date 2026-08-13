/**
 * Contradiction candidate validation behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  BeliefVersionRef,
  ContradictionProposalContent,
  contradictionCandidateDigest,
  contradictionCandidateKey,
  contradictionEvidenceDigest,
  contradictionProposalDigest,
} from "@beep/epistemic-domain/values/Contradiction";
import { identity, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type {
  CanonicalContradictionBeliefPair,
  ContradictionAssessment,
  ContradictionCandidateContent,
} from "@beep/epistemic-domain/values/Contradiction";
import type { ContradictionCandidate } from "./Contradiction.model.ts";

const beliefVersionRefEquivalence = S.toEquivalence(BeliefVersionRef);

const proposalTargetsPair = (
  pair: CanonicalContradictionBeliefPair,
  proposal: ContradictionAssessment["proposals"][number]
): boolean =>
  beliefVersionRefEquivalence(proposal.losingBelief, pair.left) ||
  beliefVersionRefEquivalence(proposal.losingBelief, pair.right);

/**
 * Recomputes every digest and key sealing an immutable contradiction candidate.
 *
 * **Example** (Validate candidate seals)
 *
 * ```ts
 * import { hasValidSeals } from "@beep/epistemic-domain/entities/Contradiction"
 * import type { ContradictionCandidate } from "@beep/epistemic-domain/entities/Contradiction"
 * import * as Result from "effect/Result"
 *
 * const acceptsCandidate = (candidate: ContradictionCandidate): boolean =>
 *   Result.getOrThrow(hasValidSeals(candidate))
 * ```
 *
 * @returns A non-throwing result containing `true` only when every persisted
 * seal matches the exact values carried by the candidate.
 * @category validation
 * @since 0.0.0
 */
export const hasValidSeals = (candidate: ContradictionCandidate): Result.Result<boolean, S.SchemaError> => {
  const proposalSeals = pipe(
    candidate.assessment.proposals,
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
    assessment: candidate.assessment,
    matchBasis: candidate.matchBasis,
    pair: candidate.pair,
    validFrom: candidate.validFrom,
    validTo: candidate.validTo,
  } satisfies ContradictionCandidateContent;

  return Result.flatMap(proposalSeals, (validProposalSeals) =>
    Result.map(contradictionCandidateDigest(candidateContent), (candidateDigest) =>
      A.every(
        [
          Eq.equals(
            contradictionEvidenceDigest(candidate.matchBasis.leftEvidenceIds, candidate.matchBasis.rightEvidenceIds),
            candidate.matchBasis.evidenceDigest
          ),
          Eq.equals(contradictionCandidateKey(candidate.pair, candidate.matchBasis), candidate.candidateKey),
          A.every(candidate.assessment.proposals, (proposal) => proposalTargetsPair(candidate.pair, proposal)),
          ...validProposalSeals,
          Eq.equals(candidateDigest, candidate.candidateDigest),
        ],
        identity
      )
    )
  );
};
