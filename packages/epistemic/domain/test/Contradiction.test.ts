import { ContradictionCandidate } from "@beep/epistemic-domain/entities/Contradiction";
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
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

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
    ...baseEntityFixtureInput("EpistemicContradictionCandidate", 1),
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
    const decode = S.decodeUnknownResult(ContradictionMatchBasis);

    expect(Result.isFailure(decode({ ...matchBasis, leftEvidenceIds: [duplicate, duplicate] }))).toBe(true);
    expect(Result.isFailure(decode({ ...matchBasis, rightEvidenceIds: [duplicate, duplicate] }))).toBe(true);
  });

  it("bounds each evidence set retained by one match basis", () => {
    const evidenceIds = A.makeBy(CONTRADICTION_EVIDENCE_SET_MAX_COUNT + 1, (index) =>
      Epistemic.EvidenceId.make(index + 1_000)
    );
    const boundedEvidenceIds = A.take(evidenceIds, CONTRADICTION_EVIDENCE_SET_MAX_COUNT);
    const decode = S.decodeUnknownResult(ContradictionMatchBasis);

    expect(Result.isSuccess(decode({ ...matchBasis, leftEvidenceIds: boundedEvidenceIds }))).toBe(true);
    expect(Result.isFailure(decode({ ...matchBasis, leftEvidenceIds: evidenceIds }))).toBe(true);
    expect(Result.isSuccess(decode({ ...matchBasis, rightEvidenceIds: boundedEvidenceIds }))).toBe(true);
    expect(Result.isFailure(decode({ ...matchBasis, rightEvidenceIds: evidenceIds }))).toBe(true);
  });

  it("bounds detector identities before candidate-key construction", () => {
    const maximumDetector = Str.repeat(CONTRADICTION_DETECTOR_MAX_LENGTH)("d");
    const oversizedDetector = Str.concat(maximumDetector, "d");
    const decode = S.decodeUnknownResult(ContradictionMatchBasis);

    expect(Result.isSuccess(decode({ ...matchBasis, detector: maximumDetector }))).toBe(true);
    expect(Result.isFailure(decode({ ...matchBasis, detector: oversizedDetector }))).toBe(true);
  });

  it("requires independent evidence sets to be disjoint", () => {
    const shared = Epistemic.EvidenceId.make(10);
    const decode = S.decodeUnknownResult(ContradictionMatchBasis);

    expect(
      Result.isFailure(
        decode({
          ...matchBasis,
          leftEvidenceIds: [shared],
          rightEvidenceIds: [shared],
        })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        decode({
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
        S.decodeUnknownResult(ContradictionAssessment)({
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
    const encodeProposal = S.encodeUnknownResult(ContradictionResolutionProposal);
    const encodedProposals = A.map(proposals, (value) => Result.getOrThrow(encodeProposal(value)));
    const decode = S.decodeUnknownResult(ContradictionAssessment);

    expect(
      Result.isSuccess(
        decode({
          confidence: 0.95,
          proposals: A.take(encodedProposals, CONTRADICTION_PROPOSAL_MAX_COUNT),
        })
      )
    ).toBe(true);
    expect(Result.isFailure(decode({ confidence: 0.95, proposals: encodedProposals }))).toBe(true);
  });

  it("rejects empty or reversed proposal validity intervals", () => {
    const encoded = Result.getOrThrow(S.encodeUnknownResult(ContradictionResolutionProposal)(proposal));
    const decode = S.decodeUnknownResult(ContradictionResolutionProposal);

    expect(Result.isFailure(decode({ ...encoded, validFrom: 1_000, validTo: 1_000 }))).toBe(true);
    expect(Result.isFailure(decode({ ...encoded, validFrom: 1_001, validTo: 1_000 }))).toBe(true);
    expect(Result.isSuccess(decode({ ...encoded, validFrom: 1_000, validTo: 1_001 }))).toBe(true);
  });

  it("normalizes and bounds detector rationales in proposal content and attached proposals", () => {
    const encodedContent = Result.getOrThrow(S.encodeUnknownResult(ContradictionProposalContent)(proposalContent));
    const encodedProposal = Result.getOrThrow(S.encodeUnknownResult(ContradictionResolutionProposal)(proposal));
    const maximumRationale = Str.repeat(CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH)("r");
    const oversizedRationale = Str.concat(maximumRationale, "r");
    const paddedRationale = "  The signed amendment controls.  ";
    const whitespaceOnlyRationale = " \n\t ";
    const decodeContent = S.decodeUnknownResult(ContradictionProposalContent);
    const decodeProposal = S.decodeUnknownResult(ContradictionResolutionProposal);

    expect(Result.getOrThrow(decodeContent({ ...encodedContent, rationale: paddedRationale })).rationale).toBe(
      "The signed amendment controls."
    );
    expect(Result.getOrThrow(decodeProposal({ ...encodedProposal, rationale: paddedRationale })).rationale).toBe(
      "The signed amendment controls."
    );
    expect(Result.isFailure(decodeContent({ ...encodedContent, rationale: whitespaceOnlyRationale }))).toBe(true);
    expect(Result.isFailure(decodeProposal({ ...encodedProposal, rationale: whitespaceOnlyRationale }))).toBe(true);
    expect(Result.isSuccess(decodeContent({ ...encodedContent, rationale: maximumRationale }))).toBe(true);
    expect(Result.isFailure(decodeContent({ ...encodedContent, rationale: oversizedRationale }))).toBe(true);
    expect(Result.isSuccess(decodeProposal({ ...encodedProposal, rationale: maximumRationale }))).toBe(true);
    expect(Result.isFailure(decodeProposal({ ...encodedProposal, rationale: oversizedRationale }))).toBe(true);
  });

  it("separates unordered submissions from canonical persisted pairs", () => {
    const reversed = ContradictionBeliefPair.make({ left: right, right: left });
    const reversedBasis = ContradictionMatchBasis.make({
      ...matchBasis,
      leftEvidenceIds: rightEvidenceIds,
      rightEvidenceIds: leftEvidenceIds,
    });
    const canonical = canonicalizeContradiction(reversed, reversedBasis);

    expect(Result.isFailure(S.decodeUnknownResult(CanonicalContradictionBeliefPair)(reversed))).toBe(true);
    expect(Result.isSuccess(S.decodeUnknownResult(CanonicalContradictionBeliefPair)(canonical.pair))).toBe(true);
    expect(canonical.pair.left).toStrictEqual(left);
    expect(canonical.pair.right).toStrictEqual(right);
    expect(canonical.matchBasis.leftEvidenceIds).toStrictEqual(leftEvidenceIds);
    expect(canonical.matchBasis.rightEvidenceIds).toStrictEqual(rightEvidenceIds);
  });

  it("rejects self-contradictions at submission and canonical persistence boundaries", () => {
    const selfPair = { left, right: left };

    expect(Result.isFailure(S.decodeUnknownResult(ContradictionBeliefPair)(selfPair))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(CanonicalContradictionBeliefPair)(selfPair))).toBe(true);
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
    const decode = S.decodeUnknownResult(ContradictionProposalContent);

    expect(Result.isFailure(decode({ ...proposalContent, fact: { amount: Number.NaN } }))).toBe(true);
    expect(Result.isFailure(decode({ ...proposalContent, fact: { amount: Number.POSITIVE_INFINITY } }))).toBe(true);
    expect(Result.isFailure(decode({ ...proposalContent, fact: { amount: undefined } }))).toBe(true);
  });

  it("bounds proposal fact bytes, node count, and nesting before digesting", () => {
    const encodedContent = Result.getOrThrow(S.encodeUnknownResult(ContradictionProposalContent)(proposalContent));
    const encodedProposal = Result.getOrThrow(S.encodeUnknownResult(ContradictionResolutionProposal)(proposal));
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
    const decodeContent = S.decodeUnknownResult(ContradictionProposalContent);
    const decodeProposal = S.decodeUnknownResult(ContradictionResolutionProposal);

    expect(
      A.every(
        rejectedFacts,
        (fact) =>
          Result.isFailure(decodeContent({ ...encodedContent, fact })) &&
          Result.isFailure(decodeProposal({ ...encodedProposal, fact }))
      )
    ).toBe(true);
  });

  it("derives only constructive unique collections and canonical pairs", () => {
    fc.assert(
      fc.property(
        S.toArbitrary(ContradictionMatchBasis),
        S.toArbitrary(ContradictionAssessment),
        S.toArbitrary(CanonicalContradictionBeliefPair),
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
          expect(S.is(CanonicalContradictionBeliefPair)(canonicalPair)).toBe(true);
        }
      ),
      fcRuns(50)
    );
  });

  it("recomputes every immutable candidate seal", () => {
    expect(Result.getOrThrow(candidate.hasValidSeals())).toBe(true);
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

    expect(Result.getOrThrow(unboundCandidate.hasValidSeals())).toBe(false);
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
