import * as Domain from "@alchemy.run/domain";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import {
  type AssertedReview,
  ClaimNote,
  ClaimReviewInitial,
  ClaimReviewRead,
  ClaimReviewState,
} from "@proto/party-contract/Claim/ClaimReview.read";
import { renderMergeRefusal } from "@proto/party-contract/Claim/RecordMergeRefused.command";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import { Claim } from "./Claim.aggregate.ts";

/** Change what an asserted claim's review shows, in whichever state it is; a claim not asserted yet keeps its review. */
const whenAsserted = (view: ClaimReviewState, f: (review: AssertedReview) => AssertedReview): ClaimReviewState =>
  ClaimReviewState.matchOrElse(view, { Pending: f, Accepted: f, Retracted: f }, identity);

/** The asserted claim's review, now standing as `tag`. */
const standing = (view: ClaimReviewState, tag: "Accepted" | "Retracted"): ClaimReviewState =>
  whenAsserted(view, (review) => ({ ...review, _tag: tag }));

/** A refusal recorded against the claim, in any state. */
const noted = (view: ClaimReviewState, note: ClaimNote): ClaimReviewState => ({ ...view, notes: A.append(view.notes, note) });

/**
 * One claim as a reviewer sees it, folded from the `Claim` aggregate into
 * the state the contract's `ClaimReviewRead` declares. Readable under a
 * `party.read` grant on the claim's org or on the claim.
 *
 * @category views
 * @since 0.0.0
 */
export class ClaimReview extends Domain.View(
  "ClaimReview",
  {
    from: [Claim],
    key: Claim,
    middleware: [Session],
    rejects: [MissingGrant],
    state: ClaimReviewState,
    initial: ClaimReviewInitial,
    // Phase 7: the state became a union by where the claim stands.
    version: 1,
    evolve: {
      ClaimAsserted: (view, event) =>
        ClaimReviewState.cases.Pending.make({
          org: event.org,
          proposition: event.proposition,
          sources: event.signals.length,
          notes: view.notes,
        }),
      ReviewRequested: (view, event) => whenAsserted(view, (review) => ({ ...review, reviews: A.append(review.reviews, event.run) })),
      DispositionProposed: (view, event) =>
        whenAsserted(view, (review) => ({
          ...review,
          proposal: O.some({
            disposition: event.disposition,
            rationale: event.rationale,
            run: event.run,
            evidenceRevision: event.evidenceRevision,
            digest: event.digest,
          }),
        })),
      ClaimAccepted: (view) => standing(view, "Accepted"),
      ClaimRetracted: (view) => standing(view, "Retracted"),
      EvidenceAdded: (view, event) =>
        whenAsserted(view, (review) => ({
          ...review,
          sources: review.sources + event.signals.length,
          revision: event.revision,
          proposal: O.none(),
        })),
      ProposalApproved: (view, event) => standing(view, event.outcome === "accepted" ? "Accepted" : "Retracted"),
      MergeRefused: (view, event) => noted(view, ClaimNote.cases.MergeRefused.make({ reason: renderMergeRefusal(event.reason) })),
      ReviewRefused: (view, event) => noted(view, ClaimNote.cases.ReviewRefused.make({ run: event.run, reason: event.reason })),
    },
  },
  ClaimReviewRead.annotations,
) {}
