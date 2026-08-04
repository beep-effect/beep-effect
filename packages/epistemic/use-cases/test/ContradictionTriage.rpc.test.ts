import {
  ContradictionActionError,
  ContradictionActionErrorReason,
  ContradictionCandidateDetailView,
  ContradictionEvidenceView,
  ContradictionListPayload,
  ContradictionReviewDecision,
  ContradictionRpcs,
  EvidenceSourceHighlight,
  EvidenceSourcePage,
  EvidenceSourcePagePayload,
  EvidenceSourcePageSelector,
  GetContradictionCandidate,
  GetContradictionCandidateRpc,
  GetEvidenceSourcePageRpc,
  ListContradictionCandidatesRpc,
  ReviewContradictionCandidate,
  ReviewContradictionCandidateRpc,
} from "@beep/epistemic-use-cases/public";
import { ListContradictionCandidates } from "@beep/epistemic-use-cases/server";
import { SourceTextPage } from "@beep/file-processing/SourceText";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as N from "effect/Number";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const decodeReviewPayload = S.decodeUnknownResult(ReviewContradictionCandidateRpc.payloadSchema);
const reviewPayload = (decision: unknown) => ({
  candidateId: 1,
  decision,
  expectedCandidateVersion: 1,
});
const supersedeDecisionInput = (reason: string) => ({
  decision: "supersedeProposal",
  proposalDigest: Str.repeat(64)("a"),
  proposalId: Str.repeat(64)("b"),
  reason,
});

describe("ContradictionTriage RPC contract", () => {
  it("registers exactly the four authenticated triage RPCs", () => {
    expect(R.fromEntries(ContradictionRpcs.requests)).toStrictEqual({
      GetContradictionCandidate: GetContradictionCandidateRpc,
      GetEvidenceSourcePage: GetEvidenceSourcePageRpc,
      ListContradictionCandidates: ListContradictionCandidatesRpc,
      ReviewContradictionCandidate: ReviewContradictionCandidateRpc,
    });
  });

  it("keeps renderer payloads narrow and tenant-neutral", () => {
    expect(R.keys(ContradictionListPayload.fields)).toStrictEqual([
      "disposition",
      "knownAt",
      "limit",
      "offset",
      "validAt",
    ]);
    expect(R.keys(GetContradictionCandidate.fields)).toStrictEqual(["candidateId", "knownAt", "validAt"]);
    expect(R.keys(ReviewContradictionCandidate.fields)).toStrictEqual([
      "candidateId",
      "decision",
      "expectedCandidateVersion",
    ]);
    expect(R.keys(ContradictionReviewDecision.cases.reject.fields)).toStrictEqual(["decision", "reason"]);
    expect(R.keys(ContradictionReviewDecision.cases.supersedeProposal.fields)).toStrictEqual([
      "decision",
      "proposalDigest",
      "proposalId",
      "reason",
    ]);
    expect(R.keys(EvidenceSourcePagePayload.fields)).toStrictEqual([
      "candidateId",
      "evidenceId",
      "knownAt",
      "selector",
      "validAt",
    ]);
    expect(R.keys(EvidenceSourcePageSelector.cases.anchor.fields)).toStrictEqual(["kind"]);
    expect(R.keys(EvidenceSourcePageSelector.cases.page.fields)).toStrictEqual(["kind", "pageIndex"]);
  });

  it("bounds both internal and public queue pages to 1 through 100 rows", () => {
    const decodeServerLimit = S.decodeUnknownResult(ListContradictionCandidates.fields.limit);
    const decodePublicLimit = S.decodeUnknownResult(ContradictionListPayload.fields.limit);

    expect(Result.isSuccess(decodeServerLimit(1))).toBe(true);
    expect(Result.isSuccess(decodeServerLimit(100))).toBe(true);
    expect(Result.isFailure(decodeServerLimit(0))).toBe(true);
    expect(Result.isFailure(decodeServerLimit(101))).toBe(true);
    expect(Result.isSuccess(decodePublicLimit(1))).toBe(true);
    expect(Result.isSuccess(decodePublicLimit(100))).toBe(true);
    expect(Result.isFailure(decodePublicLimit(0))).toBe(true);
    expect(Result.isFailure(decodePublicLimit(101))).toBe(true);
  });

  it("normalizes both review reasons at the RPC payload boundary", () => {
    const rejected = Result.getOrThrow(
      decodeReviewPayload(
        reviewPayload({
          decision: "reject",
          reason: "  The passages address different issues.  ",
        })
      )
    );
    const superseded = Result.getOrThrow(
      decodeReviewPayload(reviewPayload(supersedeDecisionInput("  The signed amendment controls.  ")))
    );

    expect(rejected.decision.reason).toBe("The passages address different issues.");
    expect(superseded.decision.reason).toBe("The signed amendment controls.");
  });

  it("rejects blank review reasons for both decisions at the RPC payload boundary", () => {
    expect(Result.isFailure(decodeReviewPayload(reviewPayload({ decision: "reject", reason: " \n\t " })))).toBe(true);
    expect(Result.isFailure(decodeReviewPayload(reviewPayload(supersedeDecisionInput(" \n\t "))))).toBe(true);
  });

  it("rejects over-limit review reasons for both decisions at the RPC payload boundary", () => {
    const overLimitReason = Str.repeat(2_001)("x");

    expect(Result.isFailure(decodeReviewPayload(reviewPayload({ decision: "reject", reason: overLimitReason })))).toBe(
      true
    );
    expect(Result.isFailure(decodeReviewPayload(reviewPayload(supersedeDecisionInput(overLimitReason))))).toBe(true);
  });

  it("exposes exact belief, evidence, anchor, and bounded source-page read models", () => {
    expect(R.keys(ContradictionCandidateDetailView.fields)).toStrictEqual([
      "candidate",
      "disposition",
      "left",
      "right",
    ]);
    expect(R.keys(ContradictionEvidenceView.fields)).toStrictEqual(["evidence", "verifiedAnchor"]);
    expect(R.keys(EvidenceSourceHighlight.fields)).toStrictEqual(["endChar", "source", "startChar"]);
    expect(R.keys(EvidenceSourcePage.fields)).toStrictEqual(["evidenceId", "highlight", "page"]);
  });

  it("constructs only non-empty forward source highlights and rejects malformed ranges", () =>
    fc.assert(
      fc.property(S.toArbitrary(EvidenceSourceHighlight), (highlight) => {
        expect(highlight.startChar).toBeLessThan(highlight.endChar);
        expect(
          Result.isFailure(
            S.decodeUnknownResult(EvidenceSourceHighlight)({
              ...highlight,
              endChar: highlight.startChar,
            })
          )
        ).toBe(true);
        expect(
          Result.isFailure(
            S.decodeUnknownResult(EvidenceSourceHighlight)({
              ...highlight,
              endChar: highlight.startChar,
              startChar: highlight.endChar,
            })
          )
        ).toBe(true);
      }),
      fcRuns(25)
    ));

  it("rejects a page whose source identity differs from its verified highlight", () =>
    fc.assert(
      fc.property(S.toArbitrary(EvidenceSourcePage), (sourcePage) => {
        const otherSource = SourceTextIdentity.make({
          ...sourcePage.highlight.source,
          sourceRef: `${sourcePage.highlight.source.sourceRef}:other`,
        });
        const otherPage = SourceTextPage.make({
          ...sourcePage.page,
          identity: otherSource,
        });

        expect(
          Result.isFailure(
            S.decodeUnknownResult(EvidenceSourcePage)({
              ...sourcePage,
              page: otherPage,
            })
          )
        ).toBe(true);
      }),
      fcRuns(25)
    ));

  it("constructs source pages that cover their highlight and rejects out-of-bounds offsets", () =>
    fc.assert(
      fc.property(S.toArbitrary(EvidenceSourcePage), (sourcePage) => {
        expect(sourcePage.highlight.endChar).toBeLessThanOrEqual(sourcePage.page.totalCodeUnits);
        expect(
          Result.isFailure(
            S.decodeUnknownResult(EvidenceSourcePage)({
              ...sourcePage,
              highlight: {
                ...sourcePage.highlight,
                endChar: N.increment(sourcePage.page.totalCodeUnits),
                startChar: sourcePage.page.totalCodeUnits,
              },
            })
          )
        ).toBe(true);
      }),
      fcRuns(25)
    ));

  it("round-trips only source-aligned EvidenceSourcePage values", () => {
    const encode = S.encodeResult(EvidenceSourcePage);
    const decode = S.decodeUnknownResult(EvidenceSourcePage);
    const equivalent = S.toEquivalence(EvidenceSourcePage);

    fc.assert(
      fc.property(S.toArbitrary(EvidenceSourcePage), (sourcePage) => {
        const encoded = encode(sourcePage).pipe(Result.getOrThrow);
        const decoded = decode(encoded).pipe(Result.getOrThrow);

        expect(equivalent(decoded, sourcePage)).toBe(true);
        expect(R.keys(encoded.highlight)).toStrictEqual(["endChar", "source", "startChar"]);
        expect(S.toEquivalence(SourceTextIdentity)(decoded.page.identity, decoded.highlight.source)).toBe(true);
      }),
      fcRuns(25)
    );
  });

  it("carries only a closed, client-safe failure reason", () => {
    const error = ContradictionActionError.make({ reason: "source-access-denied" });

    expect(R.keys(ContradictionActionError.fields)).toStrictEqual(["_tag", "reason"]);
    expect(ContradictionActionError.is(error)).toBe(true);
    expect(ContradictionActionErrorReason.is["source-access-denied"](error.reason)).toBe(true);
    expect(ContradictionActionErrorReason.is["source-unavailable"](error.reason)).toBe(false);
  });
});
