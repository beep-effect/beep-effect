import * as Domain from "@alchemy.run/domain";
import { CurrentInvocation, requireGrant } from "@proto/kernel/CurrentInvocation.context";
import { OrgId } from "@proto/kernel/Ids";
import { Operator, operatorOf, provenanceOf, Root } from "@proto/kernel/Invocation";
import { AcceptClaim, ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { AddEvidence, EvidenceAdded } from "@proto/party-contract/Claim/AddEvidence.command";
import { ApprovalId } from "@proto/party-contract/Claim/Approval.id";
import {
  ApproveProposal,
  HumanApprovalRequired,
  ProposalApproved,
  ProposalMismatch,
} from "@proto/party-contract/Claim/ApproveProposal.command";
import { AssertClaim, ClaimAlreadyAsserted, ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ProposalView } from "@proto/party-contract/Claim/ClaimReview.read";
import { proposalDigest } from "@proto/party-contract/Claim/ProposalDigest";
import {
  DispositionProposed,
  NotAnAgent,
  ProposalStale,
  ProposeDisposition,
} from "@proto/party-contract/Claim/ProposeDisposition.command";
import { MergeRefused, RecordMergeRefused } from "@proto/party-contract/Claim/RecordMergeRefused.command";
import { RecordReviewRefused, ReviewRefused } from "@proto/party-contract/Claim/RecordReviewRefused.command";
import { RequestReview } from "@proto/party-contract/Claim/RequestReview.command";
import { ClaimRetracted, RetractClaim } from "@proto/party-contract/Claim/RetractClaim.command";
import { ReviewRequested } from "@proto/party-contract/Claim/ReviewRequested.event";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyIntake, PartyPropose, PartyReview } from "@proto/party-contract/Party.capabilities";
import { Proposition } from "@proto/party-contract/Proposition";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import { reviewRun } from "../Review/ReviewPlan.ts";
import { admission, claimIn, requireAdmission, requireGranted, requirePending, scopeOf } from "./Claim.rules.ts";

/**
 * A claim's lifecycle. The union is the state machine: `decide` guards each
 * transition and `evolve` takes it. A pending claim keeps its evidence
 * revision, how many review runs were asked for, and the latest proposal.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimState = S.TaggedUnion({
  Unasserted: {},
  Pending: {
    org: OrgId,
    proposition: Proposition,
    signals: S.Array(EvidenceSignal),
    revision: S.Int,
    reviews: S.Int,
    proposal: S.OptionFromNullOr(ProposalView),
  },
  Accepted: { org: OrgId, proposition: Proposition },
  Retracted: { org: OrgId, reason: S.String },
});
/**
 * @category models
 * @since 0.0.0
 */
export type ClaimState = typeof ClaimState.Type;
/**
 * @category models
 * @since 0.0.0
 */
export type Pending = typeof ClaimState.cases.Pending.Type;

/**
 * A claim about parties, from assertion to acceptance or retraction. Every
 * decision on an existing claim checks the grant before it reveals anything
 * about the claim's state, and records the invocation's provenance.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Claim extends Domain.Aggregate(
  "Claim",
  {
    id: ClaimId,
    state: ClaimState,
    initial: { _tag: "Unasserted" },
    commands: [
      AssertClaim,
      ProposeDisposition,
      AcceptClaim,
      RetractClaim,
      AddEvidence,
      RequestReview,
      ApproveProposal,
      RecordMergeRefused,
      RecordReviewRefused,
    ],
    decide: {
      AssertClaim: Effect.fn(function* (state, command, { id, stream, now }) {
        // The org is the command's, so the grant is checked before existence is revealed.
        const invocation = yield* requireGrant(PartyIntake, command._tag, claimIn(command.org, stream), now);
        if (state._tag !== "Unasserted") return yield* ClaimAlreadyAsserted.make({});
        const provenance = provenanceOf(invocation);
        return [
          ClaimAsserted.make({ org: command.org, proposition: command.proposition, signals: command.signals, provenance }),
          ReviewRequested.make({
            run: reviewRun(id, 1),
            org: command.org,
            proposition: command.proposition,
            signals: command.signals,
            evidenceRevision: 1,
            provenance,
          }),
        ];
      }),

      ProposeDisposition: Effect.fn(function* (state, command, { stream, now }) {
        const run = yield* Effect.service(CurrentInvocation).pipe(
          Effect.map(operatorOf),
          Effect.filterOrFail(Operator.guards.Agent, () => NotAnAgent.make({})),
          Effect.map((agent) => agent.run),
        );
        const invocation = yield* requireGranted({ capability: PartyPropose, operation: command._tag, state, stream, at: now });
        const pending = yield* requirePending(state);
        if (command.evidenceRevision !== pending.revision) {
          return yield* ProposalStale.make({ evidenceRevision: pending.revision });
        }
        const proposal = {
          disposition: command.disposition,
          rationale: command.rationale,
          run,
          evidenceRevision: command.evidenceRevision,
        };
        return [
          DispositionProposed.make({ ...proposal, digest: proposalDigest(proposal), provenance: provenanceOf(invocation) }),
        ];
      }),

      AcceptClaim: Effect.fn(function* (state, command, { id, stream, now }) {
        const invocation = yield* requireGranted({ capability: PartyReview, operation: command._tag, state, stream, at: now });
        const pending = yield* requirePending(state);
        yield* requireAdmission(pending);
        return [
          ClaimAccepted.make({ proposition: pending.proposition, ...scopeOf(id, pending), provenance: provenanceOf(invocation) }),
        ];
      }),

      RetractClaim: Effect.fn(function* (state, command, { id, stream, now }) {
        const invocation = yield* requireGranted({ capability: PartyReview, operation: command._tag, state, stream, at: now });
        const pending = yield* requirePending(state);
        return [ClaimRetracted.make({ reason: command.reason, ...scopeOf(id, pending), provenance: provenanceOf(invocation) })];
      }),

      AddEvidence: Effect.fn(function* (state, command, { stream, now }) {
        const invocation = yield* requireGranted({ capability: PartyIntake, operation: command._tag, state, stream, at: now });
        const pending = yield* requirePending(state);
        return [
          EvidenceAdded.make({
            signals: command.signals,
            revision: pending.revision + 1,
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      RequestReview: Effect.fn(function* (state, command, { id, stream, now }) {
        const invocation = yield* requireGranted({ capability: PartyReview, operation: command._tag, state, stream, at: now });
        const pending = yield* requirePending(state);
        return [
          ReviewRequested.make({
            run: reviewRun(id, pending.reviews + 1),
            org: pending.org,
            proposition: pending.proposition,
            signals: pending.signals,
            evidenceRevision: pending.revision,
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      ApproveProposal: Effect.fn(function* (state, command, { id, stream, now, commandId }) {
        // A person approves, signed in and acting directly: never an agent root, never a relayed hop.
        const acting = yield* Effect.service(CurrentInvocation);
        if (!Root.guards.Human(acting.root) || !Operator.guards.Human(operatorOf(acting))) {
          return yield* HumanApprovalRequired.make({});
        }
        const invocation = yield* requireGranted({ capability: PartyReview, operation: command._tag, state, stream, at: now });
        const pending = yield* requirePending(state);
        if (O.isNone(pending.proposal)) return yield* ProposalMismatch.make({ reason: "no-proposal" });
        const proposal = pending.proposal.value;
        if (proposal.digest !== command.digest) return yield* ProposalMismatch.make({ reason: "digest" });
        if (proposal.evidenceRevision !== command.evidenceRevision || pending.revision !== command.evidenceRevision) {
          return yield* ProposalMismatch.make({ reason: "evidence-revision" });
        }
        const corroboration =
          proposal.disposition === "accept" ? (yield* requireAdmission(pending)).have : admission(pending).have;
        return [
          ProposalApproved.make({
            approval: ApprovalId.make(commandId),
            run: proposal.run,
            digest: proposal.digest,
            evidenceRevision: proposal.evidenceRevision,
            outcome: proposal.disposition === "accept" ? "accepted" : "retracted",
            proposition: pending.proposition,
            corroboration: O.some(corroboration),
            ...scopeOf(id, pending),
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      // Internal records: only the model's own policy and saga send them.
      RecordMergeRefused: (_, command) => [
        MergeRefused.make({ reason: command.reason, provenance: command.provenance }),
      ],
      RecordReviewRefused: (_, command) => [
        ReviewRefused.make({ run: command.run, reason: command.reason, provenance: command.provenance }),
      ],
    },
    // Total: decide already refused what cannot happen, so a handler keeps any
    // state its event cannot follow.
    evolve: {
      ClaimAsserted: (_, event) =>
        ClaimState.cases.Pending.make({
          org: event.org,
          proposition: event.proposition,
          signals: event.signals,
          revision: 1,
          reviews: 0,
          proposal: O.none(),
        }),
      ReviewRequested: (state) =>
        ClaimState.matchOrElse(
          state,
          { Pending: (pending): ClaimState => ({ ...pending, reviews: pending.reviews + 1 }) },
          identity,
        ),
      DispositionProposed: (state, event) =>
        ClaimState.matchOrElse(
          state,
          {
            Pending: (pending): ClaimState => ({
              ...pending,
              proposal: O.some({
                disposition: event.disposition,
                rationale: event.rationale,
                run: event.run,
                evidenceRevision: event.evidenceRevision,
                digest: event.digest,
              }),
            }),
          },
          identity,
        ),
      ClaimAccepted: (state) =>
        ClaimState.matchOrElse(
          state,
          {
            Pending: (pending): ClaimState =>
              ClaimState.cases.Accepted.make({ org: pending.org, proposition: pending.proposition }),
          },
          identity,
        ),
      ClaimRetracted: (state, event) =>
        ClaimState.matchOrElse(
          state,
          {
            Pending: (pending): ClaimState =>
              ClaimState.cases.Retracted.make({ org: pending.org, reason: event.reason }),
          },
          identity,
        ),
      EvidenceAdded: (state, event) =>
        ClaimState.matchOrElse(
          state,
          {
            // New evidence makes the latest proposal stale.
            Pending: (pending): ClaimState => ({
              ...pending,
              signals: A.appendAll(pending.signals, event.signals),
              revision: event.revision,
              proposal: O.none(),
            }),
          },
          identity,
        ),
      ProposalApproved: (state, event) =>
        ClaimState.matchOrElse(
          state,
          {
            Pending: (pending): ClaimState =>
              event.outcome === "accepted"
                ? ClaimState.cases.Accepted.make({ org: pending.org, proposition: pending.proposition })
                : ClaimState.cases.Retracted.make({ org: pending.org, reason: `approved proposal ${event.digest}` }),
          },
          identity,
        ),
      MergeRefused: identity,
      ReviewRefused: identity,
    },
    reply: {
      // The review run the assertion asked for, so a caller can follow it.
      AssertClaim: (_, events) => ({
        reviewRun: A.findFirst(events, (event) => (event._tag === "ReviewRequested" ? O.some(event.run) : O.none())),
      }),
    },
  },
  { description: "A proposition about parties, from assertion through review to acceptance or retraction." },
) {}

