import * as Domain from "@alchemy.run/domain";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import { ClaimNote, ClaimReviewInitial, ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
import { renderMergeRefusal } from "@proto/party-contract/Claim/RecordMergeRefused.command";
import * as A from "effect/Array";
import { Claim } from "./Claim.aggregate.ts";

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
    evolve: {
      ClaimAsserted: (view, event) => ({
        ...view,
        org: event.org,
        status: "pending" as const,
        proposition: event.proposition,
        sources: event.signals.length,
        revision: 1,
      }),
      ReviewRequested: (view, event) => ({ ...view, reviews: A.append(view.reviews, event.run) }),
      DispositionProposed: (view, event) => ({
        ...view,
        proposal: {
          disposition: event.disposition,
          rationale: event.rationale,
          run: event.run,
          evidenceRevision: event.evidenceRevision,
          digest: event.digest,
        },
      }),
      ClaimAccepted: (view) => ({ ...view, status: "accepted" as const }),
      ClaimRetracted: (view) => ({ ...view, status: "retracted" as const }),
      EvidenceAdded: (view, event) => ({
        ...view,
        sources: view.sources + event.signals.length,
        revision: event.revision,
        proposal: null,
      }),
      ProposalApproved: (view, event) => ({
        ...view,
        status: event.outcome === "accepted" ? ("accepted" as const) : ("retracted" as const),
      }),
      MergeRefused: (view, event) => ({
        ...view,
        notes: A.append(view.notes, ClaimNote.cases.MergeRefused.make({ reason: renderMergeRefusal(event.reason) })),
      }),
      ReviewRefused: (view, event) => ({
        ...view,
        notes: A.append(view.notes, ClaimNote.cases.ReviewRefused.make({ run: event.run, reason: event.reason })),
      }),
    },
  },
  { description: "One claim as a reviewer sees it: the proposition, the agent's proposal, and its status." },
) {}
