import {
  ClaimEvidenceBasis,
  ClaimEvidenceExplanation,
  ClaimEvidenceReview,
  ClaimEvidenceReviewStatus,
  ClaimEvidenceVerification,
} from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import { ClaimEvidenceReviewPanel } from "@beep/epistemic-ui";
import { describe, expect, it } from "@effect/vitest";
import { constVoid } from "effect/Function";
import * as S from "effect/Schema";
import { renderToStaticMarkup } from "react-dom/server";

const decodeExplanation = S.decodeUnknownSync(ClaimEvidenceExplanation);
const decodeReview = S.decodeUnknownSync(ClaimEvidenceReview);
const encodeBasis = S.encodeSync(ClaimEvidenceBasis);
const digest = "sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca";
const source = {
  scopeRef: "project:example",
  sourceRef: "document:example",
  locator: "documents/example.txt",
  sourceDigest: digest,
  textDigest: digest,
  extractor: { name: "utf8", version: "1" },
  normalizationVersion: "1",
};
const explanation = decodeExplanation({
  basis: {
    claimRef: "claim:fact",
    assertion: "The source states fact.",
    subject: "Example source",
    evidence: { startChar: 0, endChar: 4, quote: "fact", confidence: 0.82 },
    source,
  },
  currentSource: source,
  sourceText: "fact remains open to interpretation.",
  verification: { _tag: "Verified" },
  review: { _tag: "Pending" },
});
const review = decodeReview({
  basis: encodeBasis(explanation.basis),
  reviewedBy: { kind: "User", userId: 1 },
  reviewedAt: 0,
});

describe("ClaimEvidenceReviewPanel", () => {
  it("shows the exact evidence and keeps verification separate from human approval", () => {
    const markup = renderToStaticMarkup(<ClaimEvidenceReviewPanel explanation={explanation} onApprove={constVoid} />);

    expect(markup).toContain("The source states fact.");
    expect(markup).toContain("Example source");
    expect(markup).toContain("documents/example.txt");
    expect(markup).toContain(digest);
    expect(markup).toContain(">fact</mark>");
    expect(markup).toContain("Source verified");
    expect(markup).toContain("Awaiting review");
    expect(markup).toContain("This is an extraction score");
    expect(markup).toContain("Approve this claim");
    expect(markup).not.toContain('disabled=""');
  });

  it("disables approval while the host checks evidence and displays its error", () => {
    const markup = renderToStaticMarkup(
      <ClaimEvidenceReviewPanel
        explanation={explanation}
        onApprove={constVoid}
        pending
        error="Approval could not be saved."
      />
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Checking evidence…");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Approval could not be saved.");
  });

  it("shows the current human receipt and prevents duplicate approval", () => {
    const current = ClaimEvidenceExplanation.make({
      ...explanation,
      review: ClaimEvidenceReviewStatus.cases.Current.make({ review }),
    });
    const markup = renderToStaticMarkup(<ClaimEvidenceReviewPanel explanation={current} onApprove={constVoid} />);

    expect(markup).toContain("Approved by user 1 on 1970-01-01T00:00:00.000Z.");
    expect(markup).toContain("Claim approved");
    expect(markup).toContain('disabled=""');
  });

  it("retains a previous approval after a changed basis and allows another review", () => {
    const changed = ClaimEvidenceExplanation.make({
      ...explanation,
      basis: ClaimEvidenceBasis.make({ ...explanation.basis, assertion: "A revised interpretation." }),
      review: ClaimEvidenceReviewStatus.cases.Stale.make({ review, reason: "basis-changed" }),
    });
    const markup = renderToStaticMarkup(<ClaimEvidenceReviewPanel explanation={changed} onApprove={constVoid} />);

    expect(markup).toContain("A revised interpretation.");
    expect(markup).toContain("Previous approval is stale");
    expect(markup).toContain("is retained as history");
    expect(markup).toContain("The claim or its evidence changed.");
    expect(markup).toContain("Approve this claim");
    expect(markup).not.toContain('disabled=""');
  });

  it("shows unverified source text without a verified highlight or transferable approval", () => {
    const unverified = ClaimEvidenceExplanation.make({
      ...explanation,
      verification: ClaimEvidenceVerification.cases.Unverified.make({ reason: "stale-source" }),
      review: ClaimEvidenceReviewStatus.cases.Stale.make({ review, reason: "source-unverified" }),
    });
    const markup = renderToStaticMarkup(<ClaimEvidenceReviewPanel explanation={unverified} onApprove={constVoid} />);

    expect(markup).toContain("Source unverified");
    expect(markup).toContain("stale-source");
    expect(markup).toContain('aria-label="Current unverified source text"');
    expect(markup).toContain(explanation.sourceText);
    expect(markup).not.toContain("<mark");
    expect(markup).toContain("Previous approval is stale");
    expect(markup).toContain("The current source no longer verifies.");
    expect(markup).toContain('disabled=""');
  });
});
