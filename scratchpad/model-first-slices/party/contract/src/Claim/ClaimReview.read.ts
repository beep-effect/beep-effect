import * as Domain from "@alchemy.run/domain";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { Count, Sequence } from "@proto/kernel/Measure";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as O from "@beep/utils/Option";
import * as Initial from "@proto/kernel/Initial";
import * as S from "effect/Schema";
import { Disposition } from "../Disposition.ts";
import { Proposition } from "../Proposition.ts";
import { ClaimAccepted } from "./AcceptClaim.command.ts";
import { EvidenceAdded } from "./AddEvidence.command.ts";
import { ProposalApproved } from "./ApproveProposal.command.ts";
import { ClaimAsserted } from "./AssertClaim.command.ts";
import { ClaimId } from "./Claim.id.ts";
import { DispositionProposed } from "./ProposeDisposition.command.ts";
import { MergeRefused } from "./RecordMergeRefused.command.ts";
import { ReviewRefused } from "./RecordReviewRefused.command.ts";
import { ClaimRetracted } from "./RetractClaim.command.ts";
import { ReviewRequested } from "./ReviewRequested.event.ts";

/**
 * An agent run's proposal, as readers see it: what it proposed, why, which
 * run, against which evidence revision, and the digest an approval names.
 *
 * @category models
 * @since 0.0.0
 */
export const ProposalView = S.Struct({
  disposition: Disposition,
  rationale: S.String,
  run: RunId,
  evidenceRevision: Sequence,
  digest: S.String,
});
/**
 * @category models
 * @since 0.0.0
 */
export type ProposalView = typeof ProposalView.Type;

/**
 * Something that happened to a claim that changed nothing else: a refused
 * merge or a refused review run, with the reason.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimNote = S.TaggedUnion({
  MergeRefused: { reason: S.String },
  ReviewRefused: { run: RunId, reason: S.String },
});
/**
 * @category models
 * @since 0.0.0
 */
export type ClaimNote = typeof ClaimNote.Type;

/** What a reviewer sees of a claim once it is asserted, in every state after. */
const asserted = {
  org: OrgId,
  proposition: Proposition,
  sources: Count,
  revision: Sequence.pipe(Initial.of(1, { description: "The evidence revision; an asserted claim starts at 1." })),
  reviews: Initial.empty(RunId, { description: "The review runs requested so far; none at first." }),
  proposal: Initial.none(ProposalView, { description: "The latest proposal still standing; absent until a review proposes one." }),
  notes: Initial.empty(ClaimNote, { description: "What the reviewer was told about refusals; none at first." }),
};

/**
 * One claim as a reviewer sees it, by where it stands. Once asserted: its
 * org, its proposition, how many signals it has at which evidence revision,
 * the review runs asked for, the latest proposal when there is one, and
 * recorded refusals. Before that, only refusals recorded against it.
 *
 * **Example** (Where a claim stands)
 * ```ts
 * import { ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
 *
 * const standing = ClaimReviewState.match(ClaimReviewState.cases.Unasserted.make({}), {
 *   Unasserted: () => "not asserted",
 *   Pending: ({ revision }) => `pending at revision ${revision}`,
 *   Accepted: () => "accepted",
 *   Retracted: () => "retracted",
 * });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimReviewState = S.TaggedUnion({
  Unasserted: { notes: Initial.empty(ClaimNote, { description: "Refusals noted before the claim exists; none at first." }) },
  Pending: asserted,
  Accepted: asserted,
  Retracted: asserted,
});
/**
 * @category models
 * @since 0.0.0
 */
export type ClaimReviewState = typeof ClaimReviewState.Type;
/**
 * A claim's review in any state after its assertion.
 *
 * @category models
 * @since 0.0.0
 */
export type AssertedReview = Exclude<ClaimReviewState, { readonly _tag: "Unasserted" }>;

/**
 * The latest proposal on a claim's review, when there is one: none before
 * the claim is asserted, or while no run has proposed since the evidence last
 * changed.
 *
 * **Example** (The proposal a reviewer would approve)
 * ```ts
 * import { ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
 * import * as O from "@beep/utils/Option";
 *
 * const none = O.isNone(proposalOf(ClaimReviewState.cases.Unasserted.make({})));
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const proposalOf = (review: ClaimReviewState): O.Option<ProposalView> =>
  ClaimReviewState.match(review, {
    Unasserted: O.none<ProposalView>,
    Pending: ({ proposal }) => proposal,
    Accepted: ({ proposal }) => proposal,
    Retracted: ({ proposal }) => proposal,
  });

/**
 * The state of a claim nobody has asserted yet.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimReviewInitial: ClaimReviewState = ClaimReviewState.cases.Unasserted.make({});

/**
 * The events the `ClaimReview` view emits, in the aggregate's order, as one
 * tagged union: what a reader of its event list discriminates.
 *
 * **Example** (Finding the assertions in a page)
 * ```ts
 * import { ClaimReviewEvent } from "@proto/party-contract/Claim/ClaimReview.read";
 *
 * const isAssertion = ClaimReviewEvent.isAnyOf(["ClaimAsserted"]);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimReviewEvent = S.Union([
  ClaimAsserted,
  ReviewRequested,
  DispositionProposed,
  ClaimAccepted,
  ClaimRetracted,
  EvidenceAdded,
  ProposalApproved,
  MergeRefused,
  ReviewRefused,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * The `ClaimReview` view's read contract, with no aggregate behind it: its
 * key, state, the events it emits, its middleware and rejections. The model's
 * `ClaimReview` view folds the `Claim` aggregate into the same state.
 *
 * **Gotchas**
 *
 * Interim (D9). `events` must list the model view's emitted events in the
 * aggregate's order, so the read RPCs' unions match; the parity test checks.
 *
 * @category reads
 * @since 0.0.0
 */
export class ClaimReviewRead extends Domain.View("ClaimReview", {
  from: [],
  key: ClaimId,
  state: ClaimReviewState,
  initial: ClaimReviewInitial,
  events: ClaimReviewEvent.members,
  middleware: [Session],
  rejects: [MissingGrant],
}, { description: "One claim as a reviewer sees it: the proposition, the agent's proposal, and its status." }) {}
