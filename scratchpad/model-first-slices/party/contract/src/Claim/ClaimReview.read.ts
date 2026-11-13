import * as Domain from "@alchemy.run/domain";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
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
  evidenceRevision: S.Int,
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

/**
 * One claim as a reviewer sees it: its org, where it stands, its
 * proposition, how many signals it has at which evidence revision, the
 * review runs asked for, the latest proposal, and recorded refusals.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimReviewState = S.Struct({
  org: S.NullOr(OrgId),
  status: S.Literals(["unasserted", "pending", "accepted", "retracted"]),
  proposition: S.NullOr(Proposition),
  sources: S.Int,
  revision: S.Int,
  reviews: S.Array(RunId),
  proposal: S.NullOr(ProposalView),
  notes: S.Array(ClaimNote),
});
/**
 * @category models
 * @since 0.0.0
 */
export type ClaimReviewState = typeof ClaimReviewState.Type;

/**
 * The state of a claim nobody has asserted yet.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimReviewInitial: ClaimReviewState = {
  org: null,
  status: "unasserted",
  proposition: null,
  sources: 0,
  revision: 0,
  reviews: [],
  proposal: null,
  notes: [],
};

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
  events: [
    ClaimAsserted,
    ReviewRequested,
    DispositionProposed,
    ClaimAccepted,
    ClaimRetracted,
    EvidenceAdded,
    ProposalApproved,
    MergeRefused,
    ReviewRefused,
  ],
  middleware: [Session],
  rejects: [MissingGrant],
}) {}
