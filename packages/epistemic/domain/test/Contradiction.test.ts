import { ContradictionCandidate, hasValidSeals } from "@beep/epistemic-domain/entities/Contradiction";
import {
  BeliefVersionRef,
  CanonicalContradictionBeliefPair,
  CONTRADICTION_DETECTOR_MAX_LENGTH,
  CONTRADICTION_EVIDENCE_SET_MAX_COUNT,
  CONTRADICTION_PROPOSAL_FACT_MAX_BYTES,
  CONTRADICTION_PROPOSAL_MAX_COUNT,
  CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH,
  ContradictionAssessment,
  ContradictionBeliefPair,
  ContradictionCandidateContent,
  ContradictionDispositionDecision,
  ContradictionMatchBasis,
  ContradictionMatchBasisKind,
  ContradictionProposalContent,
  ContradictionProposalId,
  ContradictionResolutionProposal,
  canonicalizeContradiction,
  contradictionCandidateDigest,
  contradictionCandidateKey,
  contradictionEvidenceDigest,
  contradictionProposalDigest,
} from "@beep/epistemic-domain/values/Contradiction";
import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { LogicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity";
import { PosInt } from "@beep/schema/Int";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const decodeCanonicalContradictionBeliefPairResult = S.decodeResult(CanonicalContradictionBeliefPair);
const decodeContradictionBeliefPairResult = S.decodeResult(ContradictionBeliefPair);
const decodeUnknownContradictionAssessmentResult = S.decodeUnknownResult(ContradictionAssessment);
const decodeUnknownContradictionMatchBasisResult = S.decodeUnknownResult(ContradictionMatchBasis);
const decodeUnknownContradictionProposalContentResult = S.decodeUnknownResult(ContradictionProposalContent);
const decodeUnknownContradictionResolutionProposalResult = S.decodeUnknownResult(ContradictionResolutionProposal);
const encodeUnknownContradictionProposalContentResult = S.encodeUnknownResult(ContradictionProposalContent);
const encodeUnknownContradictionResolutionProposalResult = S.encodeUnknownResult(ContradictionResolutionProposal);
const isCanonicalContradictionBeliefPair = S.is(CanonicalContradictionBeliefPair);

const left = BeliefVersionRef.make({
  edgeVersionId: Epistemic.EdgeVersionId.make(1),
  logicalKey: LogicalEdgeKey.make(Str.repeat(64)("a")),
  version: PosInt.make(1),
});
const right = BeliefVersionRef.make({
  edgeVersionId: Epistemic.EdgeVersionId.make(2),
  logicalKey: LogicalEdgeKey.make(Str.repeat(64)("b")),
  version: PosInt.make(1),
});
const outsider = BeliefVersionRef.make({
  edgeVersionId: Epistemic.EdgeVersionId.make(3),
  logicalKey: LogicalEdgeKey.make(Str.repeat(64)("d")),
  version: PosInt.make(1),
});
const leftEvidenceIds: readonly [Epistemic.EvidenceId] = [Epistemic.EvidenceId.make(10)];
const rightEvidenceIds: readonly [Epistemic.EvidenceId] = [Epistemic.EvidenceId.make(20)];
const validFrom = DateTime.makeUnsafe(0);
const validTo = O.none<DateTime.Utc>();
const pair = CanonicalContradictionBeliefPair.make({ left, right });
const matchBasis = ContradictionMatchBasis.make({
  detector: "fixture-detector",
  detectorVersion: "0.0.0",
  evidenceDigest: contradictionEvidenceDigest(leftEvidenceIds, rightEvidenceIds),
  kind: "independent-evidence",
  leftEvidenceIds,
  rightEvidenceIds,
});
const proposalContent = ContradictionProposalContent.make({
  fact: { amount: "125" },
  losingBelief: left,
  proposalId: ContradictionProposalId.make(Str.repeat(64)("c")),
  rationale: "The signed amendment controls.",
  validFrom,
  validTo,
});
const proposal = ContradictionResolutionProposal.make({
  ...proposalContent,
  proposalDigest: Result.getOrThrow(contradictionProposalDigest(proposalContent)),
});
const assessment = ContradictionAssessment.make({
  confidence: Confidence.make(0.95),
  proposals: [proposal],
});
const candidateDigest = Result.getOrThrow(
  contradictionCandidateDigest(
    ContradictionCandidateContent.make({
      assessment,
      matchBasis,
      pair,
      validFrom,
      validTo,
    })
  )
);
const encodedAssessment = Result.getOrThrow(S.encodeResult(ContradictionAssessment)(assessment));
const encodedMatchBasis = Result.getOrThrow(S.encodeResult(ContradictionMatchBasis)(matchBasis));
const encodedPair = Result.getOrThrow(S.encodeResult(CanonicalContradictionBeliefPair)(pair));
const candidate = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionCandidate)({
    ...productEntityFixtureInput("EpistemicContradictionCandidate", 1),
    assessment: encodedAssessment,
    candidateDigest,
    candidateKey: contradictionCandidateKey(pair, matchBasis),
    matchBasis: encodedMatchBasis,
    pair: encodedPair,
    recordedAt: 0,
    validFrom: 0,
    validTo: null,
  })
);
const decodeDispositionDecision = S.decodeUnknownResult(ContradictionDispositionDecision);
const supersededDecisionInput = (reason: string) => ({
  formerEdgeVersionId: 1,
  proposalDigest: proposal.proposalDigest,
  proposalId: proposal.proposalId,
  reason,
  replacementEdgeVersionId: 2,
  status: "superseded",
});

describe("Contradiction domain invariants", () => {
  it("rejects duplicate evidence ids on either side of a match basis", () => {
    const duplicate = Epistemic.EvidenceId.make(10);
    expect(
      Result.isFailure(
        decodeUnknownContradictionMatchBasisResult({ ...matchBasis, leftEvidenceIds: [duplicate, duplicate] })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeUnknownContradictionMatchBasisResult({ ...matchBasis, rightEvidenceIds: [duplicate, duplicate] })
      )
    ).toBe(true);
  });

  it("bounds each evidence set retained by one match basis", () => {
    const evidenceIds = A.makeBy(CONTRADICTION_EVIDENCE_SET_MAX_COUNT + 1, (index) =>
      Epistemic.EvidenceId.make(index + 1_000)
    );
    const boundedEvidenceIds = A.take(evidenceIds, CONTRADICTION_EVIDENCE_SET_MAX_COUNT);
    expect(
      Result.isSuccess(
        decodeUnknownContradictionMatchBasisResult({ ...matchBasis, leftEvidenceIds: boundedEvidenceIds })
      )
    ).toBe(true);
    expect(
      Result.isFailure(decodeUnknownContradictionMatchBasisResult({ ...matchBasis, leftEvidenceIds: evidenceIds }))
    ).toBe(true);
    expect(
      Result.isSuccess(
        decodeUnknownContradictionMatchBasisResult({ ...matchBasis, rightEvidenceIds: boundedEvidenceIds })
      )
    ).toBe(true);
    expect(
      Result.isFailure(decodeUnknownContradictionMatchBasisResult({ ...matchBasis, rightEvidenceIds: evidenceIds }))
    ).toBe(true);
  });

  it("normalizes and bounds detector identities before candidate-key construction", () => {
    const maximumDetector = Str.repeat(CONTRADICTION_DETECTOR_MAX_LENGTH)("d");
    const oversizedDetector = Str.concat(maximumDetector, "d");
    const decodedPadded = Result.getOrThrow(
      decodeUnknownContradictionMatchBasisResult({ ...matchBasis, detector: "  fixture-detector  " })
    );

    expect(decodedPadded.detector).toBe("fixture-detector");
    expect(contradictionCandidateKey(pair, decodedPadded)).toBe(contradictionCandidateKey(pair, matchBasis));
    expect(Result.isFailure(decodeUnknownContradictionMatchBasisResult({ ...matchBasis, detector: " \n\t " }))).toBe(
      true
    );
    expect(
      Result.isSuccess(decodeUnknownContradictionMatchBasisResult({ ...matchBasis, detector: maximumDetector }))
    ).toBe(true);
    expect(
      Result.isFailure(decodeUnknownContradictionMatchBasisResult({ ...matchBasis, detector: oversizedDetector }))
    ).toBe(true);
  });

  it("requires independent evidence sets to be disjoint", () => {
    const shared = Epistemic.EvidenceId.make(10);
    expect(
      Result.isFailure(
        decodeUnknownContradictionMatchBasisResult({
          ...matchBasis,
          leftEvidenceIds: [shared],
          rightEvidenceIds: [shared],
        })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        decodeUnknownContradictionMatchBasisResult({
          ...matchBasis,
          kind: "same-source-overlap",
          leftEvidenceIds: [shared],
          rightEvidenceIds: [shared],
        })
      )
    ).toBe(true);
  });

  it("rejects duplicate proposal ids within one assessment", () => {
    expect(
      Result.isFailure(
        decodeUnknownContradictionAssessmentResult({
          confidence: 0.95,
          proposals: [proposal, proposal],
        })
      )
    ).toBe(true);
  });

  it("bounds the number of proposals retained by one assessment", () => {
    const proposals = A.makeBy(CONTRADICTION_PROPOSAL_MAX_COUNT + 1, (index) => {
      const content = ContradictionProposalContent.make({
        ...proposalContent,
        proposalId: ContradictionProposalId.make(`${Str.repeat(62)("0")}${Str.padStart(2, "0")(`${index}`)}`),
      });
      return ContradictionResolutionProposal.make({
        ...content,
        proposalDigest: Result.getOrThrow(contradictionProposalDigest(content)),
      });
    });
    const encodedProposals = A.map(proposals, (value) =>
      Result.getOrThrow(encodeUnknownContradictionResolutionProposalResult(value))
    );
    expect(
      Result.isSuccess(
        decodeUnknownContradictionAssessmentResult({
          confidence: 0.95,
          proposals: A.take(encodedProposals, CONTRADICTION_PROPOSAL_MAX_COUNT),
        })
      )
    ).toBe(true);
    expect(
      Result.isFailure(decodeUnknownContradictionAssessmentResult({ confidence: 0.95, proposals: encodedProposals }))
    ).toBe(true);
  });

  it("rejects empty or reversed proposal validity intervals", () => {
    const encoded = Result.getOrThrow(encodeUnknownContradictionResolutionProposalResult(proposal));
    expect(
      Result.isFailure(
        decodeUnknownContradictionResolutionProposalResult({ ...encoded, validFrom: 1_000, validTo: 1_000 })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeUnknownContradictionResolutionProposalResult({ ...encoded, validFrom: 1_001, validTo: 1_000 })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        decodeUnknownContradictionResolutionProposalResult({ ...encoded, validFrom: 1_000, validTo: 1_001 })
      )
    ).toBe(true);
  });

  it("normalizes and bounds detector rationales in proposal content and attached proposals", () => {
    const encodedContent = Result.getOrThrow(encodeUnknownContradictionProposalContentResult(proposalContent));
    const encodedProposal = Result.getOrThrow(encodeUnknownContradictionResolutionProposalResult(proposal));
    const maximumRationale = Str.repeat(CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH)("r");
    const oversizedRationale = Str.concat(maximumRationale, "r");
    const paddedRationale = "  The signed amendment controls.  ";
    const whitespaceOnlyRationale = " \n\t ";
    expect(
      Result.getOrThrow(
        decodeUnknownContradictionProposalContentResult({ ...encodedContent, rationale: paddedRationale })
      ).rationale
    ).toBe("The signed amendment controls.");
    expect(
      Result.getOrThrow(
        decodeUnknownContradictionResolutionProposalResult({ ...encodedProposal, rationale: paddedRationale })
      ).rationale
    ).toBe("The signed amendment controls.");
    expect(
      Result.isFailure(
        decodeUnknownContradictionProposalContentResult({ ...encodedContent, rationale: whitespaceOnlyRationale })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeUnknownContradictionResolutionProposalResult({ ...encodedProposal, rationale: whitespaceOnlyRationale })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        decodeUnknownContradictionProposalContentResult({ ...encodedContent, rationale: maximumRationale })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeUnknownContradictionProposalContentResult({ ...encodedContent, rationale: oversizedRationale })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        decodeUnknownContradictionResolutionProposalResult({ ...encodedProposal, rationale: maximumRationale })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeUnknownContradictionResolutionProposalResult({ ...encodedProposal, rationale: oversizedRationale })
      )
    ).toBe(true);
  });

  it("separates unordered submissions from canonical persisted pairs", () => {
    const reversed = ContradictionBeliefPair.make({ left: right, right: left });
    const reversedBasis = ContradictionMatchBasis.make({
      ...matchBasis,
      leftEvidenceIds: rightEvidenceIds,
      rightEvidenceIds: leftEvidenceIds,
    });
    const canonical = canonicalizeContradiction(reversed, reversedBasis);

    expect(Result.isFailure(decodeCanonicalContradictionBeliefPairResult(reversed))).toBe(true);
    expect(Result.isSuccess(decodeCanonicalContradictionBeliefPairResult(canonical.pair))).toBe(true);
    expect(canonical.pair.left).toStrictEqual(left);
    expect(canonical.pair.right).toStrictEqual(right);
    expect(canonical.matchBasis.leftEvidenceIds).toStrictEqual(leftEvidenceIds);
    expect(canonical.matchBasis.rightEvidenceIds).toStrictEqual(rightEvidenceIds);
  });

  it("rejects self-contradictions at submission and canonical persistence boundaries", () => {
    const selfPair = { left, right: left };

    expect(Result.isFailure(decodeContradictionBeliefPairResult(selfPair))).toBe(true);
    expect(Result.isFailure(decodeCanonicalContradictionBeliefPairResult(selfPair))).toBe(true);
  });

  it("keys detector identities and versions independently", () => {
    const originalKey = contradictionCandidateKey(pair, matchBasis);
    const otherDetectorKey = contradictionCandidateKey(
      pair,
      ContradictionMatchBasis.make({ ...matchBasis, detector: "independent-detector" })
    );
    const otherVersionKey = contradictionCandidateKey(
      pair,
      ContradictionMatchBasis.make({ ...matchBasis, detectorVersion: "0.0.1" })
    );

    expect(otherDetectorKey).not.toBe(originalKey);
    expect(otherVersionKey).not.toBe(originalKey);
    expect(otherDetectorKey).not.toBe(otherVersionKey);
  });

  it("binds evidence partitions to beliefs while canonicalization remains reversal invariant", () => {
    const evidenceA = Epistemic.EvidenceId.make(10);
    const evidenceB = Epistemic.EvidenceId.make(20);
    const evidenceC = Epistemic.EvidenceId.make(30);
    const oneVersusTwo = contradictionEvidenceDigest([evidenceA], [evidenceB, evidenceC]);
    const reversed = contradictionEvidenceDigest([evidenceB, evidenceC], [evidenceA]);
    const originalBasis = ContradictionMatchBasis.make({
      ...matchBasis,
      evidenceDigest: oneVersusTwo,
      leftEvidenceIds: [evidenceA],
      rightEvidenceIds: [evidenceB, evidenceC],
    });
    const reversedPair = ContradictionBeliefPair.make({ left: right, right: left });
    const reversedBasis = ContradictionMatchBasis.make({
      ...originalBasis,
      evidenceDigest: reversed,
      leftEvidenceIds: originalBasis.rightEvidenceIds,
      rightEvidenceIds: originalBasis.leftEvidenceIds,
    });
    const canonicalOriginal = canonicalizeContradiction(pair, originalBasis);
    const canonicalReversed = canonicalizeContradiction(reversedPair, reversedBasis);
    const reorderedBasis = ContradictionMatchBasis.make({
      ...originalBasis,
      leftEvidenceIds: originalBasis.leftEvidenceIds,
      rightEvidenceIds: [evidenceC, evidenceB],
    });
    const canonicalReordered = canonicalizeContradiction(pair, reorderedBasis);

    expect(reversed).not.toBe(oneVersusTwo);
    expect(canonicalReversed).toStrictEqual(canonicalOriginal);
    expect(canonicalReordered).toStrictEqual(canonicalOriginal);
    expect(contradictionCandidateKey(reversedPair, reversedBasis)).toBe(contradictionCandidateKey(pair, originalBasis));
    expect(contradictionCandidateKey(pair, reversedBasis)).not.toBe(contradictionCandidateKey(pair, originalBasis));
  });

  it("rejects proposal facts outside canonical JSON", () => {
    expect(
      Result.isFailure(
        decodeUnknownContradictionProposalContentResult({ ...proposalContent, fact: { amount: Number.NaN } })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeUnknownContradictionProposalContentResult({
          ...proposalContent,
          fact: { amount: Number.POSITIVE_INFINITY },
        })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeUnknownContradictionProposalContentResult({ ...proposalContent, fact: { amount: undefined } })
      )
    ).toBe(true);
  });

  it("bounds proposal fact bytes, node count, and nesting before digesting", () => {
    const encodedContent = Result.getOrThrow(encodeUnknownContradictionProposalContentResult(proposalContent));
    const encodedProposal = Result.getOrThrow(encodeUnknownContradictionResolutionProposalResult(proposal));
    const deeplyNestedFact = A.reduce(
      A.makeBy(34, (index) => index),
      { leaf: true } as S.Json,
      (nested) => ({ nested })
    );
    const rejectedFacts: ReadonlyArray<unknown> = [
      { payload: Str.repeat(CONTRADICTION_PROPOSAL_FACT_MAX_BYTES)("x") },
      { values: A.makeBy(4_096, () => null) },
      deeplyNestedFact,
    ];
    expect(
      A.every(
        rejectedFacts,
        (fact) =>
          Result.isFailure(decodeUnknownContradictionProposalContentResult({ ...encodedContent, fact })) &&
          Result.isFailure(decodeUnknownContradictionResolutionProposalResult({ ...encodedProposal, fact }))
      )
    ).toBe(true);
  });

  it("derives only constructive unique collections and canonical pairs", () => {
    fc.assert(
      fc.property(
        S.toArbitrary(ContradictionMatchBasis)(fc),
        S.toArbitrary(ContradictionAssessment)(fc),
        S.toArbitrary(CanonicalContradictionBeliefPair)(fc),
        (basis, arbitraryAssessment, canonicalPair) => {
          expect(A.dedupe(basis.leftEvidenceIds)).toHaveLength(basis.leftEvidenceIds.length);
          expect(A.dedupe(basis.rightEvidenceIds)).toHaveLength(basis.rightEvidenceIds.length);
          ContradictionMatchBasisKind.$match(basis.kind, {
            "independent-evidence": () =>
              expect(A.dedupe([...basis.leftEvidenceIds, ...basis.rightEvidenceIds])).toHaveLength(
                basis.leftEvidenceIds.length + basis.rightEvidenceIds.length
              ),
            "same-source-overlap": () => undefined,
          });
          expect(A.dedupe(arbitraryAssessment.proposals.map(({ proposalId }) => proposalId))).toHaveLength(
            arbitraryAssessment.proposals.length
          );
          expect(
            A.every(arbitraryAssessment.proposals, ({ validFrom, validTo }) =>
              O.match(validTo, {
                onNone: () => true,
                onSome: (upperBound) => DateTime.isLessThan(validFrom, upperBound),
              })
            )
          ).toBe(true);
          expect(isCanonicalContradictionBeliefPair(canonicalPair)).toBe(true);
        }
      ),
      fcRuns(50)
    );
  });

  it("recomputes every immutable candidate seal", () => {
    expect(Result.getOrThrow(hasValidSeals(candidate))).toBe(true);
  });

  it("rejects otherwise valid seals when a proposal targets a belief outside the candidate pair", () => {
    const unboundContent = ContradictionProposalContent.make({
      ...proposalContent,
      losingBelief: outsider,
      proposalId: ContradictionProposalId.make(Str.repeat(64)("e")),
    });
    const unboundAssessment = ContradictionAssessment.make({
      confidence: assessment.confidence,
      proposals: [
        ContradictionResolutionProposal.make({
          ...unboundContent,
          proposalDigest: Result.getOrThrow(contradictionProposalDigest(unboundContent)),
        }),
      ],
    });
    const unboundCandidateDigest = Result.getOrThrow(
      contradictionCandidateDigest(
        ContradictionCandidateContent.make({
          assessment: unboundAssessment,
          matchBasis,
          pair,
          validFrom,
          validTo,
        })
      )
    );
    const unboundCandidate = ContradictionCandidate.make({
      ...candidate,
      assessment: unboundAssessment,
      candidateDigest: unboundCandidateDigest,
    });

    expect(Result.getOrThrow(hasValidSeals(unboundCandidate))).toBe(false);
  });

  it("normalizes and bounds reasons persisted with both disposition decisions", () => {
    const rejected = Result.getOrThrow(
      decodeDispositionDecision({
        reason: "  The passages address different issues.  ",
        status: "rejected",
      })
    );
    const superseded = Result.getOrThrow(
      decodeDispositionDecision(supersededDecisionInput("  The signed amendment controls.  "))
    );
    const overLimitReason = Str.repeat(2_001)("x");

    expect(rejected.reason).toBe("The passages address different issues.");
    expect(superseded.reason).toBe("The signed amendment controls.");
    expect(Result.isFailure(decodeDispositionDecision({ reason: " \n\t ", status: "rejected" }))).toBe(true);
    expect(Result.isFailure(decodeDispositionDecision(supersededDecisionInput(" \n\t ")))).toBe(true);
    expect(Result.isFailure(decodeDispositionDecision({ reason: overLimitReason, status: "rejected" }))).toBe(true);
    expect(Result.isFailure(decodeDispositionDecision(supersededDecisionInput(overLimitReason)))).toBe(true);
  });
});
