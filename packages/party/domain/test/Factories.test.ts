import { makeEdgeEndpoint } from "@beep/epistemics/EdgeEndpoint";
import { $PartyDomainId } from "@beep/identity/packages";
import {
  ClaimEvidenceBasis,
  ClaimEvidenceReview,
  ClaimEvidenceVerification,
  reviewStatusFor,
} from "@beep/party-domain/ClaimEvidenceReview";
import { ClaimProjectionView } from "@beep/party-domain/ClaimProjection";
import {
  BeliefVersionRef,
  ContradictionBeliefPair,
  ContradictionCandidateContent,
  ContradictionCandidateContentArbitrary,
  ContradictionMatchBasis,
  canonicalizeContradiction,
  contradictionCandidateDigest,
  contradictionCandidateKey,
  contradictionEvidenceDigest,
} from "@beep/party-domain/Contradiction";
import { ContradictionDetectionSnapshot, DetectionBelief } from "@beep/party-domain/ContradictionDetection";
import { EdgeEndpoint, encodeEdgeEndpointKey } from "@beep/party-domain/EdgeEndpoint";
import {
  EvidenceVerificationManifestation,
  evidenceVerificationManifestationKey,
  isEvidenceVerificationManifestationKey,
} from "@beep/party-domain/EvidenceVerification";
import { AssertionId, PrincipalId } from "@beep/party-domain/Ids";
import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/party-domain/LogicalEdgeIdentity";
import { describe, expect, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";

const source = {
  scopeRef: "synthetic:acme",
  sourceRef: "message:1",
  locator: "messages/1.txt",
  sourceDigest: `sha256:${Str.repeat(64)("a")}`,
  textDigest: `sha256:${Str.repeat(64)("a")}`,
  extractor: { name: "utf8", version: "1" },
  normalizationVersion: "1",
};
const ref = (id: string) =>
  Result.getOrThrow(
    S.decodeResult(BeliefVersionRef)({
      edgeVersionId: `party-cv:${id}`,
      logicalKey: Str.repeat(64)(id),
      version: 1,
    })
  );

describe("party P1b bindings", () => {
  it("uses party schema identities and rejects foreign endpoint identifiers", () => {
    const other = makeEdgeEndpoint({
      $I: $PartyDomainId.create("test/other"),
      ids: { candidateClaim: AssertionId, evidence: AssertionId },
    });
    expect(SchemaAST.resolveIdentifier(EdgeEndpoint.ast)).toContain("@beep/party-domain/");
    expect(SchemaAST.resolveIdentifier(EdgeEndpoint.ast)).not.toEqual(
      SchemaAST.resolveIdentifier(other.EdgeEndpoint.ast)
    );
    pipe(
      S.decodeUnknownResult(EdgeEndpoint)({ kind: "evidence", evidenceId: 1 }),
      Result.isFailure,
      TestUtils.assertTrue
    );
    const endpoint = Result.getOrThrow(S.decodeResult(EdgeEndpoint)({ kind: "claim", claimId: "party-asrt:1" }));
    expect(encodeEdgeEndpointKey(endpoint)).toBe("claim:party-asrt:1");
  });
  it("seals symmetric logical identities independent of endpoint order", () => {
    const left = { kind: "claim", claimId: "party-asrt:1" };
    const right = { kind: "claim", claimId: "party-asrt:2" };
    const make = (source: unknown, target: unknown) =>
      Result.getOrThrow(
        S.decodeUnknownResult(LogicalEdgeIdentity)({
          source,
          target,
          relation: "contradicts",
          orgScope: "synthetic",
          matterScope: null,
          evidenceScope: null,
          qualifiers: {},
        })
      );
    expect(logicalEdgeKey(make(left, right))).toBe(logicalEdgeKey(make(right, left)));
  });
  it("binds verified evidence manifestations to party assertions", () => {
    const row = Result.getOrThrow(
      S.decodeUnknownResult(EvidenceVerificationManifestation)({
        evidenceId: "party-asrt:1",
        verifiedAnchor: { source, anchor: { startChar: 0, endChar: 4, quote: "fact" } },
      })
    );
    const key = Result.getOrThrow(evidenceVerificationManifestationKey(row));
    expect(Result.getOrThrow(isEvidenceVerificationManifestationKey(row, key))).toBe(true);
    expect(
      Result.getOrThrow(
        isEvidenceVerificationManifestationKey(
          EvidenceVerificationManifestation.make({ ...row, evidenceId: AssertionId.make("party-asrt:2") }),
          key
        )
      )
    ).toBe(false);
  });
  it("retains approvals only for the exact evidence basis", () => {
    const basis = Result.getOrThrow(
      S.decodeUnknownResult(ClaimEvidenceBasis)({
        claimRef: "party-cv:1",
        assertion: "The source states fact.",
        subject: "Example source",
        source,
        evidence: { startChar: 0, endChar: 4, quote: "fact", confidence: 0.8 },
      })
    );
    const review = ClaimEvidenceReview.make({
      basis,
      reviewedBy: PrincipalId.make("party-user:reviewer"),
      reviewedAt: DateTime.makeUnsafe(0),
    });
    const verified = ClaimEvidenceVerification.cases.Verified.make({});
    expect(reviewStatusFor(basis, verified, O.none())._tag).toBe("Pending");
    expect(reviewStatusFor(basis, verified, O.some(review))._tag).toBe("Current");
    expect(
      reviewStatusFor(
        ClaimEvidenceBasis.make({ ...basis, assertion: "A changed assertion." }),
        verified,
        O.some(review)
      )._tag
    ).toBe("Stale");
  });
  it("projects only party claim references", () => {
    const row = {
      total: 1,
      counts: { admitted: 1, candidate: 0, consistency_checked: 0, shape_valid: 0 },
      admittedKeys: ["party-cv:1"],
    };
    expect(Result.getOrThrow(S.decodeResult(ClaimProjectionView)(row)).admittedKeys).toEqual(row.admittedKeys);
    pipe(
      S.decodeResult(ClaimProjectionView)({ ...row, admittedKeys: ["other:1"] }),
      Result.isFailure,
      TestUtils.assertTrue
    );
  });
  it("canonicalizes contradictions while retaining side-bound evidence", () => {
    const left = ref("a");
    const right = ref("b");
    const leftEvidenceIds = A.of(AssertionId.make("party-asrt:left"));
    const rightEvidenceIds = A.of(AssertionId.make("party-asrt:right"));
    const basis = ContradictionMatchBasis.make({
      detector: "party",
      detectorVersion: "1.0.0",
      kind: "independent-evidence",
      leftEvidenceIds,
      rightEvidenceIds,
      evidenceDigest: contradictionEvidenceDigest(leftEvidenceIds, rightEvidenceIds),
    });
    expect(S.is(ContradictionBeliefPair)({ left, right: left })).toBe(false);
    expect(canonicalizeContradiction({ left: right, right: left }, basis).matchBasis.leftEvidenceIds).toEqual(
      rightEvidenceIds
    );
    const reversed = ContradictionMatchBasis.make({
      ...basis,
      leftEvidenceIds: rightEvidenceIds,
      rightEvidenceIds: leftEvidenceIds,
    });
    expect(contradictionCandidateKey({ left, right }, basis)).toBe(
      contradictionCandidateKey({ left: right, right: left }, reversed)
    );
  });
  it.prop(
    "generates and seals candidate content using party evidence identifiers",
    [ContradictionCandidateContentArbitrary],
    ([content]) =>
      S.is(ContradictionCandidateContent)(content) && Result.isSuccess(contradictionCandidateDigest(content)),
    { arbitrary: { runs: 100, seed: "party-candidate-content" } }
  );
  it("rejects duplicate detection beliefs and reversed valid intervals", () => {
    const belief = {
      ref: { edgeVersionId: "party-cv:1", logicalKey: Str.repeat(64)("a"), version: 1 },
      subject: "s",
      predicate: "p",
      value: "A",
      polarity: "asserted",
      evidenceIds: ["party-asrt:1"],
      validFrom: 0,
      validTo: null,
    };
    expect(Result.getOrThrow(S.decodeUnknownResult(DetectionBelief)(belief)).ref.edgeVersionId).toBe("party-cv:1");
    pipe(
      S.decodeUnknownResult(DetectionBelief)({ ...belief, validFrom: 10, validTo: 5 }),
      Result.isFailure,
      TestUtils.assertTrue
    );
    pipe(
      S.decodeUnknownResult(ContradictionDetectionSnapshot)({ beliefs: [belief, belief], singleValuedPredicates: [] }),
      Result.isFailure,
      TestUtils.assertTrue
    );
  });
});
