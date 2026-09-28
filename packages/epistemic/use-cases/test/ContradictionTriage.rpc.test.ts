import {
  ContradictionActionError,
  ContradictionActionErrorReason,
  ContradictionCandidateDetailView,
  ContradictionEvidenceView,
  ContradictionListPayload,
  ContradictionReviewDecision,
  ContradictionRpcs,
  EvidenceSourceHighlight,
  EvidenceSourceHighlightArbitrary,
  EvidenceSourcePage,
  EvidenceSourcePageArbitrary,
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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as N from "effect/Number";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeEvidenceSourceHighlightResult = S.decodeResult(EvidenceSourceHighlight);
const decodeEvidenceSourcePageResult = S.decodeResult(EvidenceSourcePage);
const decodeUnknownContradictionListPayloadFieldsLimitResult = S.decodeUnknownResult(
  ContradictionListPayload.fields.limit
);
const decodeUnknownEvidenceSourcePageResult = S.decodeUnknownResult(EvidenceSourcePage);
const decodeUnknownListContradictionCandidatesFieldsLimitResult = S.decodeUnknownResult(
  ListContradictionCandidates.fields.limit
);
const encodeEvidenceSourcePageResult = S.encodeResult(EvidenceSourcePage);

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
    pipe(decodeUnknownListContradictionCandidatesFieldsLimitResult(1), Result.isSuccess, assertTrue);
    pipe(decodeUnknownListContradictionCandidatesFieldsLimitResult(100), Result.isSuccess, assertTrue);
    pipe(decodeUnknownListContradictionCandidatesFieldsLimitResult(0), Result.isFailure, assertTrue);
    pipe(decodeUnknownListContradictionCandidatesFieldsLimitResult(101), Result.isFailure, assertTrue);
    pipe(decodeUnknownContradictionListPayloadFieldsLimitResult(1), Result.isSuccess, assertTrue);
    pipe(decodeUnknownContradictionListPayloadFieldsLimitResult(100), Result.isSuccess, assertTrue);
    pipe(decodeUnknownContradictionListPayloadFieldsLimitResult(0), Result.isFailure, assertTrue);
    pipe(decodeUnknownContradictionListPayloadFieldsLimitResult(101), Result.isFailure, assertTrue);
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
    pipe(decodeReviewPayload(reviewPayload({ decision: "reject", reason: " \n\t " })), Result.isFailure, assertTrue);
    pipe(decodeReviewPayload(reviewPayload(supersedeDecisionInput(" \n\t "))), Result.isFailure, assertTrue);
  });

  it("rejects over-limit review reasons for both decisions at the RPC payload boundary", () => {
    const overLimitReason = Str.repeat(2_001)("x");

    pipe(
      decodeReviewPayload(reviewPayload({ decision: "reject", reason: overLimitReason })),
      Result.isFailure,
      assertTrue
    );
    pipe(decodeReviewPayload(reviewPayload(supersedeDecisionInput(overLimitReason))), Result.isFailure, assertTrue);
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

  it.prop(
    "constructs only non-empty forward source highlights and rejects malformed ranges",
    [EvidenceSourceHighlightArbitrary],
    ([highlight]) => {
      expect(highlight.startChar).toBeLessThan(highlight.endChar);
      pipe(
        decodeEvidenceSourceHighlightResult({
          ...highlight,
          endChar: highlight.startChar,
        }),
        Result.isFailure,
        assertTrue
      );
      pipe(
        decodeEvidenceSourceHighlightResult({
          ...highlight,
          endChar: highlight.startChar,
          startChar: highlight.endChar,
        }),
        Result.isFailure,
        assertTrue
      );
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "rejects a page whose source identity differs from its verified highlight",
    [EvidenceSourcePageArbitrary],
    ([sourcePage]) => {
      const otherSource = SourceTextIdentity.make({
        ...sourcePage.highlight.source,
        sourceRef: `${sourcePage.highlight.source.sourceRef}:other`,
      });
      const otherPage = SourceTextPage.make({
        ...sourcePage.page,
        identity: otherSource,
      });

      pipe(
        decodeEvidenceSourcePageResult({
          ...sourcePage,
          page: otherPage,
        }),
        Result.isFailure,
        assertTrue
      );
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "constructs source pages that cover their highlight and rejects out-of-bounds offsets",
    [EvidenceSourcePageArbitrary],
    ([sourcePage]) => {
      expect(sourcePage.highlight.endChar).toBeLessThanOrEqual(sourcePage.page.totalCodeUnits);
      pipe(
        decodeEvidenceSourcePageResult({
          ...sourcePage,
          highlight: {
            ...sourcePage.highlight,
            endChar: N.increment(sourcePage.page.totalCodeUnits),
            startChar: sourcePage.page.totalCodeUnits,
          },
        }),
        Result.isFailure,
        assertTrue
      );
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "round-trips only source-aligned EvidenceSourcePage values",
    [EvidenceSourcePageArbitrary],
    ([sourcePage]) => {
      const equivalent = S.toEquivalence(EvidenceSourcePage);
      const encoded = encodeEvidenceSourcePageResult(sourcePage).pipe(Result.getOrThrow);
      const decoded = decodeUnknownEvidenceSourcePageResult(encoded).pipe(Result.getOrThrow);

      pipe(equivalent(decoded, sourcePage), assertTrue);
      expect(R.keys(encoded.highlight)).toStrictEqual(["endChar", "source", "startChar"]);
      pipe(S.toEquivalence(SourceTextIdentity)(decoded.page.identity, decoded.highlight.source), assertTrue);
    },
    { arbitrary: fcRuns(25) }
  );

  it("carries only a closed, client-safe failure reason", () => {
    const error = ContradictionActionError.make({ reason: "source-access-denied" });

    expect(R.keys(ContradictionActionError.fields)).toStrictEqual(["_tag", "reason"]);
    pipe(ContradictionActionError.is(error), assertTrue);
    pipe(ContradictionActionErrorReason.is["source-access-denied"](error.reason), assertTrue);
    pipe(ContradictionActionErrorReason.is["source-unavailable"](error.reason), assertFalse);
  });
});
