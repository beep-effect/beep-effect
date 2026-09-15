/**
 * Inspect one extracted assertion and its source before human approval.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import {
  ClaimEvidenceReviewStatus,
  ClaimEvidenceVerification,
} from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@beep/ui/components/card";
import { VerifiedSourceTextViewer } from "@beep/ui/components/verified-source-text-viewer";
import * as DateTime from "effect/DateTime";
import type { ClaimEvidenceExplanation } from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import type { JSX } from "react";

/**
 * Controlled presentation of an already resolved evidence explanation.
 *
 * **Details**
 *
 * The host supplies the explanation, runs approval through the use case,
 * and persists the returned receipt. Pending work disables approval. This
 * view owns no authentication, source resolution, or persistence behavior.
 *
 * **Example** (Render with application-owned approval)
 *
 * ```tsx
 * import { ClaimEvidenceReviewPanel, type ClaimEvidenceReviewPanelProps } from "@beep/epistemic-ui"
 *
 * const Review = (props: ClaimEvidenceReviewPanelProps) => <ClaimEvidenceReviewPanel {...props} />
 * console.log(typeof Review) // function
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export interface ClaimEvidenceReviewPanelProps {
  readonly error?: string | undefined;
  readonly explanation: ClaimEvidenceExplanation;
  readonly onApprove: () => void;
  readonly pending?: boolean | undefined;
}

const verificationMessage = ClaimEvidenceVerification.match({
  Verified: () => "The quote and source identity match the document resolved for this review.",
  Unverified: ({ reason }) =>
    `The source could not be verified (${reason}). Resolve the source and extract the evidence again before approval.`,
});
const reviewMessage = ClaimEvidenceReviewStatus.match({
  Pending: () => "This interpretation is waiting for human review.",
  Current: ({ review }) => `Approved by user ${review.reviewedBy.userId} on ${DateTime.formatIso(review.reviewedAt)}.`,
  Stale: ({ review, reason }) =>
    `The approval by user ${review.reviewedBy.userId} on ${DateTime.formatIso(review.reviewedAt)} is retained as history. ${reason === "basis-changed" ? "The claim or its evidence changed." : "The current source no longer verifies."}`,
});
const reviewBadge = ClaimEvidenceReviewStatus.match({
  Pending: () => <Badge variant="outline">Awaiting review</Badge>,
  Current: () => <Badge variant="outline">Approved</Badge>,
  Stale: () => <Badge variant="destructive">Previous approval is stale</Badge>,
});

/**
 * Show assertion, source correspondence, extraction confidence, and human review.
 *
 * **Details**
 *
 * The source view uses the text carried by the explanation, so its metadata
 * and text come from the same verification snapshot. An unverified source is
 * shown without a verified highlight. Historical approval remains visible
 * after drift, while approval is enabled only for a verified current source.
 *
 * **Example** (Application wrapper)
 *
 * ```tsx
 * import { ClaimEvidenceReviewPanel, type ClaimEvidenceReviewPanelProps } from "@beep/epistemic-ui"
 *
 * export function EvidenceReview(props: ClaimEvidenceReviewPanelProps) {
 *   return <ClaimEvidenceReviewPanel {...props} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ClaimEvidenceReviewPanel({
  explanation,
  onApprove,
  pending = false,
  error,
}: ClaimEvidenceReviewPanelProps): JSX.Element {
  const { basis, currentSource, sourceText, verification, review } = explanation;
  const verified = ClaimEvidenceVerification.guards.Verified(verification);
  const approved = ClaimEvidenceReviewStatus.guards.Current(review);

  return (
    <article className="grid gap-5" aria-label="Claim evidence review" aria-busy={pending}>
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">Extracted claim · {basis.claimRef}</p>
          <CardTitle className="text-xl leading-relaxed">{basis.assertion}</CardTitle>
          <p className="text-sm">
            <span className="text-muted-foreground">Subject</span> · {basis.subject}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <blockquote className="border-l-2 pl-4 text-lg">“{basis.evidence.quote}”</blockquote>
          <p className="text-sm text-muted-foreground">
            Extractor confidence: {basis.evidence.confidence} / 1. This is an extraction score; a matching quote still
            needs interpretation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Source document</CardTitle>
            <Badge variant={verified ? "secondary" : "destructive"}>
              {verified ? "Source verified" : "Source unverified"}
            </Badge>
          </div>
          <p className="text-sm" role="status">
            {verificationMessage(verification)}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Scope</dt>
              <dd className="wrap-anywhere">{currentSource.scopeRef}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="wrap-anywhere">{currentSource.sourceRef}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Document</dt>
              <dd className="wrap-anywhere">{currentSource.locator}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current extractor</dt>
              <dd>
                {currentSource.extractor.name} · {currentSource.extractor.version}
              </dd>
            </div>
          </dl>
          {verified ? (
            <VerifiedSourceTextViewer
              className="h-52"
              pageText={sourceText}
              pageStartOffset={0}
              anchorStartOffset={basis.evidence.startChar}
              anchorEndOffset={basis.evidence.endChar}
              autoScrollToAnchor={false}
            />
          ) : (
            <pre
              role="region"
              className="max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-sm"
              aria-label="Current unverified source text"
            >
              {sourceText}
            </pre>
          )}
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Evidence identity and extraction details</summary>
            <dl className="mt-3 grid gap-3">
              <div>
                <dt className="text-muted-foreground">Extracted source scope</dt>
                <dd className="wrap-anywhere">{basis.source.scopeRef}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Extracted with</dt>
                <dd>
                  {basis.source.extractor.name} · {basis.source.extractor.version}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Normalization version</dt>
                <dd>
                  {basis.source.normalizationVersion} (extracted) · {currentSource.normalizationVersion} (current)
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">UTF-16 evidence offsets</dt>
                <dd>
                  {basis.evidence.startChar}–{basis.evidence.endChar}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Extracted text digest</dt>
                <dd className="wrap-anywhere font-mono text-xs">{basis.source.textDigest}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Current text digest</dt>
                <dd className="wrap-anywhere font-mono text-xs">{currentSource.textDigest}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Extracted artifact digest</dt>
                <dd className="wrap-anywhere font-mono text-xs">{basis.source.sourceDigest}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Current artifact digest</dt>
                <dd className="wrap-anywhere font-mono text-xs">{currentSource.sourceDigest}</dd>
              </div>
            </dl>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Human review</CardTitle>
            {reviewBadge(review)}
          </div>
          <p className="text-sm" aria-live="polite">
            {reviewMessage(review)}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Approval records your assessment of this assertion, subject, and exact evidence. A changed basis requires
            another review.
          </p>
          {error !== undefined ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button className="w-fit" type="button" disabled={pending || !verified || approved} onClick={onApprove}>
            {pending ? "Checking evidence…" : approved ? "Claim approved" : "Approve this claim"}
          </Button>
        </CardContent>
      </Card>
    </article>
  );
}
