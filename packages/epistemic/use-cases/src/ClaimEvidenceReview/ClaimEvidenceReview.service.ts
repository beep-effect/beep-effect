/**
 * Exact-source explanation and human approval without persistence side effects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ClaimEvidenceExplanation,
  ClaimEvidenceReview,
  ClaimEvidenceVerification,
  reviewStatusFor,
} from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import { VerifyTextAnchorInput, verifyTextAnchor } from "@beep/provenance/VerifiedTextAnchor";
import { DateTime, Effect, flow } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ApproveClaimEvidence, ExplainClaimEvidence } from "./ClaimEvidenceReview.commands.ts";

const ExplainJson = S.fromJsonString(ExplainClaimEvidence);
const ApproveJson = S.fromJsonString(ApproveClaimEvidence);
const snapshotExplanation = flow(S.encodeEffect(ExplainJson), Effect.flatMap(S.decodeEffect(ExplainJson)));
const snapshotApproval = flow(S.encodeEffect(ApproveJson), Effect.flatMap(S.decodeEffect(ApproveJson)));

/**
 * Verify the current source and explain the applicability of historical review.
 *
 * **Details**
 *
 * The command is snapshotted through its schema before asynchronous hashing.
 * Mutating caller-owned objects cannot change the assertion or reviewer while
 * verification is in progress. Source mismatch is a visible unverified state;
 * malformed input remains a typed schema failure. A verified quote establishes
 * source correspondence, not the truth of its interpretation.
 *
 * **Example** (Compose an explanation with an application command)
 *
 * ```ts
 * import { explainClaimEvidence, type ExplainClaimEvidence } from "@beep/epistemic-use-cases/ClaimEvidenceReview"
 * import { Effect } from "effect"
 *
 * const sourceStatus = (command: ExplainClaimEvidence) =>
 *   explainClaimEvidence(command).pipe(Effect.map((explanation) => explanation.verification._tag))
 * console.log(typeof sourceStatus) // function
 * ```
 *
 * @param input - Extracted basis, currently resolved source, and optional review.
 * @returns Independent source-verification and human-review states.
 * @category use-cases
 * @since 0.0.0
 */
export const explainClaimEvidence = Effect.fn("ClaimEvidenceReview.explain")(function* (input: ExplainClaimEvidence) {
  const snapshot = yield* snapshotExplanation(input);
  const result = yield* verifyTextAnchor(
    VerifyTextAnchorInput.make({
      anchor: snapshot.basis.evidence,
      expectedSource: snapshot.basis.source,
      source: snapshot.currentSource,
      sourceText: snapshot.sourceText,
    })
  ).pipe(Effect.result);
  const verification = Result.match(result, {
    onFailure: (failure) => ClaimEvidenceVerification.cases.Unverified.make({ reason: failure.reason }),
    onSuccess: () => ClaimEvidenceVerification.cases.Verified.make({}),
  });
  return ClaimEvidenceExplanation.make({
    basis: snapshot.basis,
    currentSource: snapshot.currentSource,
    sourceText: snapshot.sourceText,
    verification,
    review: reviewStatusFor(snapshot.basis, verification, snapshot.review),
  });
});

/**
 * Return a portable human approval only after exact-source verification succeeds.
 *
 * **Details**
 *
 * The returned record owns a detached snapshot of the reviewed basis and
 * principal. The host application must persist it and re-run explanation when
 * the source is resolved again. Approval records are not cryptographic proofs
 * or authorization tokens. The function never approves a stale or mismatched
 * source and never carries an earlier approval onto changed evidence.
 *
 * **Example** (Compose approval with persistence supplied by the application)
 *
 * ```ts
 * import { approveClaimEvidence, type ApproveClaimEvidence } from "@beep/epistemic-use-cases/ClaimEvidenceReview"
 * import { Effect } from "effect"
 *
 * const reviewedSubject = (command: ApproveClaimEvidence) =>
 *   approveClaimEvidence(command).pipe(Effect.map((review) => review.basis.subject))
 * console.log(typeof reviewedSubject) // function
 * ```
 *
 * @param input - Exact basis and the application's authenticated human reviewer.
 * @returns A timestamped approval or a typed schema/source-verification failure.
 * @category use-cases
 * @since 0.0.0
 */
export const approveClaimEvidence = Effect.fn("ClaimEvidenceReview.approve")(function* (input: ApproveClaimEvidence) {
  const snapshot = yield* snapshotApproval(input);
  yield* verifyTextAnchor(
    VerifyTextAnchorInput.make({
      anchor: snapshot.basis.evidence,
      expectedSource: snapshot.basis.source,
      source: snapshot.currentSource,
      sourceText: snapshot.sourceText,
    })
  );
  return ClaimEvidenceReview.make({
    basis: snapshot.basis,
    reviewedBy: snapshot.reviewedBy,
    reviewedAt: yield* DateTime.now,
  });
});
