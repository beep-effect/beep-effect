import {
  ContradictionCandidate,
  ContradictionDisposition,
  ContradictionReceipt,
} from "@beep/epistemic-domain/entities/Contradiction";
import * as EpistemicIdentity from "@beep/epistemic-domain/identity/Epistemic";
import {
  BeliefVersionRef,
  CanonicalContradictionBeliefPair,
  ContradictionAssessment,
  ContradictionCandidateContent,
  ContradictionCandidateDigest,
  ContradictionCandidateKey,
  ContradictionEvidenceDigest,
  ContradictionMatchBasis,
  ContradictionProposalContent,
  ContradictionProposalDigest,
  ContradictionProposalId,
  ContradictionResolutionProposal,
  contradictionCandidateDigest,
  contradictionCandidateKey,
  contradictionEvidenceDigest,
  contradictionProposalDigest,
} from "@beep/epistemic-domain/values/Contradiction";
import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { LogicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity";
import {
  fromContradictionCandidateRow,
  fromContradictionDispositionRow,
  fromContradictionReceiptRow,
  toContradictionCandidateInsert,
  toContradictionDispositionInsert,
  toContradictionReceiptInsert,
} from "@beep/epistemic-tables/entities/Contradiction";
import { PosInt } from "@beep/schema/Int";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as SharedIdentity from "@beep/shared-domain/identity/Shared";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Result } from "effect";
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
const pair = CanonicalContradictionBeliefPair.make({ left, right });
const leftEvidenceIds: readonly [Epistemic.EvidenceId] = [Epistemic.EvidenceId.make(10)];
const rightEvidenceIds: readonly [Epistemic.EvidenceId] = [Epistemic.EvidenceId.make(20)];
const validFrom = DateTime.makeUnsafe(0);
const validTo = O.none<DateTime.Utc>();
const matchBasis = ContradictionMatchBasis.make({
  detector: "fixture-detector",
  detectorVersion: "0.0.0",
  evidenceDigest: contradictionEvidenceDigest(leftEvidenceIds, rightEvidenceIds),
  kind: "independent-evidence",
  leftEvidenceIds,
  rightEvidenceIds,
});
const firstProposalContent = ContradictionProposalContent.make({
  fact: { amount: "125" },
  losingBelief: left,
  proposalId: ContradictionProposalId.make(Str.repeat(64)("c")),
  rationale: "The signed amendment controls.",
  validFrom,
  validTo,
});
const secondProposalContent = ContradictionProposalContent.make({
  fact: { amount: "150" },
  losingBelief: right,
  proposalId: ContradictionProposalId.make(Str.repeat(64)("d")),
  rationale: "The later signed schedule controls.",
  validFrom,
  validTo,
});
const firstProposal = ContradictionResolutionProposal.make({
  ...firstProposalContent,
  proposalDigest: Result.getOrThrow(contradictionProposalDigest(firstProposalContent)),
});
const secondProposal = ContradictionResolutionProposal.make({
  ...secondProposalContent,
  proposalDigest: Result.getOrThrow(contradictionProposalDigest(secondProposalContent)),
});
const assessment = ContradictionAssessment.make({
  confidence: Confidence.make(0.95),
  proposals: [firstProposal, secondProposal],
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
const systemPrincipal = { component: "Runtime", kind: "System" } as const;
const receipt = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionReceipt)({
    ...baseEntityFixtureInput("EpistemicContradictionReceipt", 2),
    candidateId: candidate.id,
    receiptKey: Str.repeat(64)("7"),
    receivedAt: 0,
    receivedBy: systemPrincipal,
  })
);
const disposition = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionDisposition)({
    ...baseEntityFixtureInput("EpistemicContradictionDisposition", 3),
    candidateId: candidate.id,
    decision: {
      reason: "The passages concern different obligations.",
      status: "rejected",
    },
    resolvedAt: 0,
    resolvedBy: systemPrincipal,
  })
);

const otherCandidateKey = ContradictionCandidateKey.make(Str.repeat(64)("e"));
const otherCandidateDigest = ContradictionCandidateDigest.make(Str.repeat(64)("f"));
const otherEvidenceDigest = ContradictionEvidenceDigest.make(Str.repeat(64)("9"));
const otherProposalDigest = ContradictionProposalDigest.make(Str.repeat(64)("8"));
const tamperedFirstProposal = ContradictionResolutionProposal.make({
  ...firstProposal,
  proposalDigest: otherProposalDigest,
});
const tamperedSecondProposal = ContradictionResolutionProposal.make({
  ...secondProposal,
  proposalDigest: otherProposalDigest,
});
const tamperedFirstAssessment = ContradictionAssessment.make({
  ...assessment,
  proposals: [tamperedFirstProposal, secondProposal],
});
const tamperedSecondAssessment = ContradictionAssessment.make({
  ...assessment,
  proposals: [firstProposal, tamperedSecondProposal],
});

describe("Contradiction candidate row converters", () => {
  it("round-trips schema-derived canonical belief pairs used by candidate JSONB rows", () => {
    const encode = S.encodeResult(CanonicalContradictionBeliefPair);
    const decode = S.decodeUnknownResult(CanonicalContradictionBeliefPair);
    const equivalent = S.toEquivalence(CanonicalContradictionBeliefPair);

    fc.assert(
      fc.property(S.toArbitrary(CanonicalContradictionBeliefPair), (arbitraryPair) => {
        const decoded = encode(arbitraryPair).pipe(Result.getOrThrow, decode, Result.getOrThrow);
        expect(equivalent(decoded, arbitraryPair)).toBe(true);
      }),
      fcRuns(25)
    );
  });

  it("round-trips a candidate only when every persisted seal is valid", () => {
    const insert = Result.getOrThrow(toContradictionCandidateInsert(candidate));
    const decoded = Result.getOrThrow(fromContradictionCandidateRow({ ...insert, id: 1 }));

    expect("id" in insert).toBe(false);
    expect(Result.getOrThrow(decoded.hasValidSeals())).toBe(true);
    expect(decoded.candidateKey).toBe(candidate.candidateKey);
    expect(decoded.assessment.proposals).toHaveLength(2);
  });

  it("round-trips receipt and disposition rows without generated identifiers", () => {
    const receiptInsert = Result.getOrThrow(toContradictionReceiptInsert(receipt, candidate));
    const dispositionInsert = Result.getOrThrow(toContradictionDispositionInsert(disposition, candidate));
    const decodedReceipt = Result.getOrThrow(fromContradictionReceiptRow({ ...receiptInsert, id: receipt.id }));
    const decodedDisposition = Result.getOrThrow(
      fromContradictionDispositionRow({ ...dispositionInsert, id: disposition.id })
    );

    expect("id" in receiptInsert).toBe(false);
    expect("id" in dispositionInsert).toBe(false);
    expect(decodedReceipt.receiptKey).toBe(receipt.receiptKey);
    expect(decodedDisposition.decision).toEqual(disposition.decision);
  });

  it("rejects a receipt that predates or does not reference its supplied candidate", () => {
    const futureCandidate = ContradictionCandidate.make({
      ...candidate,
      recordedAt: DateTime.makeUnsafe(1),
    });
    const differentCandidate = ContradictionCandidate.make({
      ...candidate,
      id: EpistemicIdentity.ContradictionCandidateId.make(99),
    });
    const differentOrganizationReceipt = ContradictionReceipt.make({
      ...receipt,
      orgId: SharedIdentity.OrganizationId.make(2),
    });

    expect(Result.isFailure(toContradictionReceiptInsert(receipt, futureCandidate))).toBe(true);
    expect(Result.isFailure(toContradictionReceiptInsert(receipt, differentCandidate))).toBe(true);
    expect(Result.isFailure(toContradictionReceiptInsert(differentOrganizationReceipt, candidate))).toBe(true);
  });

  it("rejects a disposition that predates or does not reference its supplied candidate", () => {
    const futureCandidate = ContradictionCandidate.make({
      ...candidate,
      recordedAt: DateTime.makeUnsafe(1),
    });
    const differentCandidate = ContradictionCandidate.make({
      ...candidate,
      id: EpistemicIdentity.ContradictionCandidateId.make(99),
    });

    expect(Result.isFailure(toContradictionDispositionInsert(disposition, futureCandidate))).toBe(true);
    expect(Result.isFailure(toContradictionDispositionInsert(disposition, differentCandidate))).toBe(true);
  });

  it("rejects each tampered seal before writing", () => {
    const tamperedCandidates: ReadonlyArray<readonly [string, ContradictionCandidate]> = [
      ["candidate key", ContradictionCandidate.make({ ...candidate, candidateKey: otherCandidateKey })],
      ["candidate digest", ContradictionCandidate.make({ ...candidate, candidateDigest: otherCandidateDigest })],
      [
        "evidence digest",
        ContradictionCandidate.make({
          ...candidate,
          matchBasis: ContradictionMatchBasis.make({ ...matchBasis, evidenceDigest: otherEvidenceDigest }),
        }),
      ],
      ["first proposal digest", ContradictionCandidate.make({ ...candidate, assessment: tamperedFirstAssessment })],
      ["second proposal digest", ContradictionCandidate.make({ ...candidate, assessment: tamperedSecondAssessment })],
    ];

    for (const [label, tampered] of tamperedCandidates) {
      expect(Result.isFailure(toContradictionCandidateInsert(tampered)), label).toBe(true);
    }
  });

  it("rejects an unordered candidate validity interval before writing", () => {
    const unorderedValidTo = O.some(validFrom);
    const unorderedCandidate = ContradictionCandidate.make({
      ...candidate,
      validTo: unorderedValidTo,
    });

    expect(() =>
      ContradictionCandidateContent.make({
        assessment,
        matchBasis,
        pair,
        validFrom,
        validTo: unorderedValidTo,
      })
    ).toThrow("Expected validFrom to be earlier than validTo when validTo is present.");
    expect(Result.isFailure(toContradictionCandidateInsert(unorderedCandidate))).toBe(true);
  });

  it("rejects each tampered seal and a non-canonical pair after reading", () => {
    const insert = Result.getOrThrow(toContradictionCandidateInsert(candidate));
    const row = { ...insert, id: 1 };
    const tamperedRows: ReadonlyArray<readonly [string, unknown]> = [
      ["candidate key", { ...row, candidateKey: otherCandidateKey }],
      ["candidate digest", { ...row, candidateDigest: otherCandidateDigest }],
      ["evidence digest", { ...row, matchBasis: { ...row.matchBasis, evidenceDigest: otherEvidenceDigest } }],
      [
        "first proposal digest",
        {
          ...row,
          assessment: {
            ...row.assessment,
            proposals: [
              { ...row.assessment.proposals[0], proposalDigest: otherProposalDigest },
              row.assessment.proposals[1],
            ],
          },
        },
      ],
      [
        "second proposal digest",
        {
          ...row,
          assessment: {
            ...row.assessment,
            proposals: [
              row.assessment.proposals[0],
              { ...row.assessment.proposals[1], proposalDigest: otherProposalDigest },
            ],
          },
        },
      ],
      ["belief pair order", { ...row, pair: { left: row.pair.right, right: row.pair.left } }],
    ];

    for (const [label, tampered] of tamperedRows) {
      expect(Result.isFailure(fromContradictionCandidateRow(tampered)), label).toBe(true);
    }
  });
});
