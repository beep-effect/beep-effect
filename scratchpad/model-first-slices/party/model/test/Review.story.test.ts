import { Story } from "@alchemy.run/domain/Story";
import { it } from "@effect/vitest";
import { ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { GrantId, RunId } from "@proto/kernel/Ids";
import { byAgent, byProcess, Cause, extend, type Invocation, provenanceOf, sagaStep } from "@proto/kernel/Invocation";
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";
import { AddEvidence, EvidenceAdded } from "@proto/party-contract/Claim/AddEvidence.command";
import { ApprovalId } from "@proto/party-contract/Claim/Approval.id";
import {
  ApproveProposal,
  HumanApprovalRequired,
  ProposalApproved,
  ProposalMismatch,
} from "@proto/party-contract/Claim/ApproveProposal.command";
import { AssertClaim, ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { proposalDigest } from "@proto/party-contract/Claim/ProposalDigest";
import {
  DispositionProposed,
  ProposalStale,
  ProposeDisposition,
} from "@proto/party-contract/Claim/ProposeDisposition.command";
import { ReviewRefused } from "@proto/party-contract/Claim/RecordReviewRefused.command";
import { RequestReview } from "@proto/party-contract/Claim/RequestReview.command";
import { ClaimRetracted, RetractClaim } from "@proto/party-contract/Claim/RetractClaim.command";
import { ReviewRequested } from "@proto/party-contract/Claim/ReviewRequested.event";
import { PartyIntake, PartyPropose, PartyRead, PartyReview } from "@proto/party-contract/Party.capabilities";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { ClaimReview } from "@proto/party-model/Claim/ClaimReview.view";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { ReviewAssist } from "@proto/party-model/Review/ReviewAssist.saga";
import { BudgetRefused, ReviewRuns, RunEnded } from "@proto/party-model/Review/ReviewRuns.external";
import * as Layer from "effect/Layer";
import { acme, agentRun, delegated, human, onOrg, oneSource, readmitted } from "./fixtures.ts";

const { call, fail, given, provide, rejected, saga, succeed, then, view, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns],
});

const intake = human("p_intake", [
  onOrg("g_intake", PartyIntake, acme),
  onOrg("g_intake_read", PartyRead, acme),
  onOrg("g_intake_propose", PartyPropose, acme),
]);
const reviewer = human("p_rev", [
  onOrg("g_rev", PartyReview, acme),
  onOrg("g_rev_read", PartyRead, acme),
  onOrg("g_rev_propose", PartyPropose, acme),
]);

const claim = Claim.ref("claim_1");
const hasIdentifier = Proposition.cases.HasIdentifier.make({
  party: PartyId.make("party_dana"),
  scheme: "email",
  value: "dana@acme.test",
});
const run1 = RunId.make("review:claim_1:1");
const run2 = RunId.make("review:claim_1:2");

/** The narrowed delegation a review run acts under: propose, on this claim only. */
const runGrant = (run: RunId, grant: string) =>
  delegated(grant, `dlg:${run}`, PartyPropose, acme, "Claim/claim_1", ["ProposeDisposition"]);
const runInvocation = (run: RunId, accountable: string, grant: string) =>
  agentRun(run, accountable, [runGrant(run, grant)]);
const sagaHop = (run: RunId, step: string) => byAgent(run, sagaStep("ReviewAssist", run, step));
const requestHop = (seq: number) =>
  byProcess("ReviewOnRequest", Cause.cases.Event.make({ stream: "Claim/claim_1", seq, event: "ReviewRequested" }));

const rationale = "the intake mailbox names the address";
const proposal = { disposition: "accept" as const, rationale, run: run1, evidenceRevision: 1 };
const digest = proposalDigest(proposal);

/** What the runs context answers each report with: the live run, here unchanged. */
const liveAs = (run: RunId, accountable: string, grant: string) => ({
  run,
  provenance: provenanceOf(runInvocation(run, accountable, grant)),
});

/** The steps of a run that is opened, reserves, assesses and settles, up to its proposal. */
const assessUpToPropose = (run: RunId, live = liveAs(run, "p_intake", "g_intake_propose"), stepped = live) => [
  call(ReviewRuns.reserve, { run, units: 40 }),
  succeed(ReviewRuns.reserve, live),
  call(Reasoner.assess, { run, step: "assess", idempotencyKey: `${run}:assess`, promptVersion: "review-v1", maxAllowance: 40 }),
  succeed(Reasoner.assess, {
    assessment: { disposition: "accept", rationale },
    usage: { units: 12, cachedUnits: 0 },
    receipt: { idempotencyKey: `${run}:assess`, promptVersion: "review-v1", model: "fixture" },
  }),
  call(ReviewRuns.settle, { run, units: 12 }),
  succeed(ReviewRuns.settle, live),
  call(ReviewRuns.step, { run, step: "assess" }),
  succeed(ReviewRuns.step, stepped),
];

const assertedByIntake = [
  as(intake),
  when(claim, new AssertClaim({ org: acme, proposition: hasIdentifier, signals: oneSource })),
  then(
    claim,
    new ClaimAsserted({ org: acme, proposition: hasIdentifier, signals: oneSource, provenance: provenanceOf(intake) }),
    new ReviewRequested({
      run: run1,
      org: acme,
      proposition: hasIdentifier,
      signals: oneSource,
      evidenceRevision: 1,
      provenance: provenanceOf(intake),
    }),
  ),
  // The policy re-admits the asserter and opens a run under a delegation of their propose grant.
  call(Authority.readmit, { provenance: provenanceOf(intake), hop: requestHop(2) }),
  succeed(Authority.readmit, readmitted(intake, requestHop(2))),
  call(ReviewRuns.open, {
    run: run1,
    source: { grant: GrantId.make("g_intake_propose"), delegation: null },
    terms: {
      capability: PartyPropose.id,
      operations: ["ProposeDisposition"],
      resource: ResourceScope.cases.Record.make({ org: acme, record: "Claim/claim_1" }),
      expires: null,
    },
  }),
  succeed(ReviewRuns.open, { provenance: provenanceOf(runInvocation(run1, "p_intake", "g_intake_propose")) }),
];

it.effect("a review run proposes under its delegation and waits; a person's approval decides the claim", () => {
  const runProvenance = provenanceOf(runInvocation(run1, "p_intake", "g_intake_propose"));
  const proposing = readmitted(runInvocation(run1, "p_intake", "g_intake_propose"), sagaHop(run1, "propose"));
  return story(
    ...assertedByIntake,
    ...assessUpToPropose(run1),
    call(Authority.readmit, { provenance: runProvenance, hop: sagaHop(run1, "propose") }),
    succeed(Authority.readmit, proposing),
    // Rooted at the run and its accountable human; its only grant is the delegation.
    then(claim, new DispositionProposed({ ...proposal, digest, provenance: provenanceOf(proposing) })),
    call(ReviewRuns.awaitApproval, { run: run1 }),
    succeed(ReviewRuns.awaitApproval, liveAs(run1, "p_intake", "g_intake_propose")),
    // The executor's work ends at the wait; the runs context concludes the run from Party's fact.
    saga(ReviewAssist, run1, { _tag: "Completed", result: undefined }),
    view(ClaimReview, claim, { status: "pending", reviews: [run1], proposal: { ...proposal, digest } }),
    // One authenticated human command decides the claim; no port call follows.
    as(reviewer),
    when(claim, new ApproveProposal({ digest, evidenceRevision: 1 }), { commandId: "approval_1" }),
    then(
      claim,
      new ProposalApproved({
        approval: ApprovalId.make("approval_1"),
        run: run1,
        digest,
        evidenceRevision: 1,
        outcome: "accepted",
        proposition: hasIdentifier,
        corroboration: 1,
        provenance: provenanceOf(reviewer),
      }),
    ),
    view(ClaimReview, claim, { status: "accepted" }),
  );
});

const proposed = [
  given(
    claim,
    new ClaimAsserted({ org: acme, proposition: hasIdentifier, signals: oneSource, provenance: provenanceOf(intake) }),
    new ReviewRequested({
      run: run1,
      org: acme,
      proposition: hasIdentifier,
      signals: oneSource,
      evidenceRevision: 1,
      provenance: provenanceOf(intake),
    }),
    new DispositionProposed({
      ...proposal,
      digest,
      provenance: provenanceOf(runInvocation(run1, "p_intake", "g_intake_propose")),
    }),
  ),
];

it.effect("an agent-rooted approval, or one a process relays, is refused", () =>
  story(
    ...proposed,
    // An agent run holding a review grant still cannot approve.
    as(agentRun("run_x", "p_rev", [onOrg("g_x", PartyReview, acme)])),
    when(claim, new ApproveProposal({ digest, evidenceRevision: 1 })),
    rejected(new HumanApprovalRequired()),
    // Nor can the reviewer's own authority relayed by a process.
    as(readmitted(reviewer, byProcess("SomePolicy", Cause.cases.Session.make({ scheme: "test" })))),
    when(claim, new ApproveProposal({ digest, evidenceRevision: 1 })),
    rejected(new HumanApprovalRequired()),
  ),
);

it.effect("an approval binds the proposal it read: digest and evidence revision", () =>
  story(
    ...proposed,
    as(reviewer),
    when(claim, new ApproveProposal({ digest: "p-other", evidenceRevision: 1 })),
    rejected(new ProposalMismatch({ reason: "digest" })),
    // New evidence makes the proposal stale; the approval no longer names anything.
    as(intake),
    when(claim, new AddEvidence({ signals: oneSource })),
    then(claim, new EvidenceAdded({ signals: oneSource, revision: 2, provenance: provenanceOf(intake) })),
    as(reviewer),
    when(claim, new ApproveProposal({ digest, evidenceRevision: 1 })),
    rejected(new ProposalMismatch({ reason: "no-proposal" })),
    // And a run's proposal against the old revision is refused.
    as(runInvocation(run1, "p_intake", "g_intake_propose")),
    when(claim, new ProposeDisposition({ disposition: "accept", rationale, evidenceRevision: 1 })),
    rejected(new ProposalStale({ evidenceRevision: 2 })),
  ),
);

it.effect("a second review of the same claim is a second run; out of budget, it stops with no Reasoner call", () => {
  const run2Provenance = provenanceOf(runInvocation(run2, "p_rev", "g_rev_propose"));
  return story(
    ...proposed,
    as(reviewer),
    when(claim, new RequestReview()),
    then(
      claim,
      new ReviewRequested({
        run: run2,
        org: acme,
        proposition: hasIdentifier,
        signals: oneSource,
        evidenceRevision: 1,
        provenance: provenanceOf(reviewer),
      }),
    ),
    call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: requestHop(4) }),
    succeed(Authority.readmit, readmitted(reviewer, requestHop(4))),
    call(ReviewRuns.open, { run: run2, source: { grant: GrantId.make("g_rev_propose"), delegation: null } }),
    succeed(ReviewRuns.open, { provenance: run2Provenance }),
    // The reservation is refused, so the run ends exhausted and the story sees no Reasoner call.
    call(ReviewRuns.reserve, { run: run2, units: 40 }),
    fail(ReviewRuns.reserve, new BudgetRefused({ remaining: 10 })),
    call(ReviewRuns.exhaust, { run: run2 }),
    succeed(ReviewRuns.exhaust, { run: run2, provenance: run2Provenance }),
    saga(ReviewAssist, run2, { _tag: "Completed", result: undefined }),
    view(ClaimReview, claim, { reviews: [run1, run2] }),
  );
});

it.effect("a delegation revoked mid-run: the next hop is refused at re-admission, and the outcome is recorded", () => {
  const runProvenance = provenanceOf(runInvocation(run1, "p_intake", "g_intake_propose"));
  const lapsed = [{ grant: GrantId.make("g_intake_propose"), delegation: runGrant(run1, "g_intake_propose").delegation }];
  return story(
    ...assertedByIntake,
    ...assessUpToPropose(run1),
    call(Authority.readmit, { provenance: runProvenance, hop: sagaHop(run1, "propose") }),
    fail(Authority.readmit, new ReadmissionRefused({ reason: "lapsed", lapsed })),
    then(
      claim,
      new ReviewRefused({
        run: run1,
        reason: "readmission:lapsed",
        provenance: extend(runProvenance, sagaHop(run1, "record-refusal")),
      }),
    ),
    call(ReviewRuns.refuse, { run: run1, reason: "readmission:lapsed" }),
    succeed(ReviewRuns.refuse, liveAs(run1, "p_intake", "g_intake_propose")),
    saga(ReviewAssist, run1, { _tag: "Completed", result: undefined }),
    view(ClaimReview, claim, { status: "pending", notes: [{ _tag: "ReviewRefused", run: run1, reason: "readmission:lapsed" }] }),
  );
});

it.effect("a run that continues at its history bound is followed: the next step acts as the run it continued as", () => {
  const next = RunId.make("review:claim_1:1~1");
  const nextRun = runInvocation(next, "p_intake", "g_intake_propose");
  // The saga stays keyed by the run it started as; the relayer is the live run.
  const proposeHop = byAgent(next, sagaStep("ReviewAssist", run1, "propose"));
  const proposing = readmitted(nextRun, proposeHop);
  const continued = { run: next, provenance: provenanceOf(nextRun) };
  return story(
    ...assertedByIntake,
    // The step report reached the bound: the runs context answers with the continuation.
    ...assessUpToPropose(run1, liveAs(run1, "p_intake", "g_intake_propose"), continued),
    // The proposal is made as the continuation, under its own delegation.
    call(Authority.readmit, { provenance: provenanceOf(nextRun), hop: proposeHop }),
    succeed(Authority.readmit, proposing),
    then(claim, new DispositionProposed({ ...proposal, run: next, digest: proposalDigest({ ...proposal, run: next }), provenance: provenanceOf(proposing) })),
    call(ReviewRuns.awaitApproval, { run: next, provenance: provenanceOf(nextRun) }),
    succeed(ReviewRuns.awaitApproval, continued),
    saga(ReviewAssist, run1, { _tag: "Completed", result: undefined }),
  );
});

it.effect("a decision that concluded the run while it was assessing ends the executor cleanly", () =>
  story(
    ...assertedByIntake,
    call(ReviewRuns.reserve, { run: run1, units: 40 }),
    succeed(ReviewRuns.reserve, liveAs(run1, "p_intake", "g_intake_propose")),
    call(Reasoner.assess, { run: run1 }),
    succeed(Reasoner.assess, {
      assessment: { disposition: "accept", rationale },
      usage: { units: 12, cachedUnits: 0 },
      receipt: { idempotencyKey: `${run1}:assess`, promptVersion: "review-v1", model: "fixture" },
    }),
    // The runs context concluded the run from Party's fact in the meantime.
    call(ReviewRuns.settle, { run: run1, units: 12 }),
    fail(ReviewRuns.settle, new RunEnded({ status: "completed" })),
    // No step, no proposal, no wait: the saga completes without an error.
    saga(ReviewAssist, run1, { _tag: "Completed", result: undefined }),
  ),
);

it.effect("a claim decided before the proposal lands ends the executor cleanly, with nothing recorded", () => {
  const runProvenance = provenanceOf(runInvocation(run1, "p_intake", "g_intake_propose"));
  return story(
    ...assertedByIntake,
    call(ReviewRuns.reserve, { run: run1, units: 40 }),
    succeed(ReviewRuns.reserve, liveAs(run1, "p_intake", "g_intake_propose")),
    call(Reasoner.assess, { run: run1 }),
    // While the Reasoner works, a reviewer decides the claim directly.
    as(reviewer),
    when(claim, new RetractClaim({ reason: "duplicate" })),
    then(claim, new ClaimRetracted({ reason: "duplicate", provenance: provenanceOf(reviewer) })),
    succeed(Reasoner.assess, {
      assessment: { disposition: "accept", rationale },
      usage: { units: 12, cachedUnits: 0 },
      receipt: { idempotencyKey: `${run1}:assess`, promptVersion: "review-v1", model: "fixture" },
    }),
    call(ReviewRuns.settle, { run: run1, units: 12 }),
    succeed(ReviewRuns.settle, liveAs(run1, "p_intake", "g_intake_propose")),
    call(ReviewRuns.step, { run: run1, step: "assess" }),
    succeed(ReviewRuns.step, liveAs(run1, "p_intake", "g_intake_propose")),
    call(Authority.readmit, { provenance: runProvenance, hop: sagaHop(run1, "propose") }),
    succeed(Authority.readmit, readmitted(runInvocation(run1, "p_intake", "g_intake_propose"), sagaHop(run1, "propose"))),
    // The proposal answers ClaimNotPending: no refusal is recorded and no wait is reported.
    then(claim),
    saga(ReviewAssist, run1, { _tag: "Completed", result: undefined }),
    view(ClaimReview, claim, { status: "retracted", notes: [] }),
  );
});
