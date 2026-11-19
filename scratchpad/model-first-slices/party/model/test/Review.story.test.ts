import { streamOf } from "@alchemy.run/domain/Aggregate";
import { Story } from "@alchemy.run/domain/Story";
import { describe, it } from "@effect/vitest";
import { ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import type { PrincipalId, RunId } from "@proto/kernel/Ids";
import { byAgent, byProcess, Cause, extend, type Invocation, provenanceOf, Relayer, sagaStep } from "@proto/kernel/Invocation";
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";
import { AddEvidence, EvidenceAdded } from "@proto/party-contract/Claim/AddEvidence.command";
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
import { Authority } from "@proto/party-model/Authority.external";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { ClaimReview } from "@proto/party-model/Claim/ClaimReview.view";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Assessment, Reasoner, ReasonerUnavailable, Usage } from "@proto/party-model/Review/Reasoner.external";
import { ReviewAssist } from "@proto/party-model/Review/ReviewAssist.saga";
import { ReviewOnRequest } from "@proto/party-model/Review/ReviewOnRequest.policy";
import { ReviewPlan, reviewRun } from "@proto/party-model/Review/ReviewPlan";
import { BudgetRefused, ReviewRuns, RunEnded, RunRefused } from "@proto/party-model/Review/ReviewRuns.external";
import * as A from "@beep/utils/Array";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { Cast, rolesOf } from "./Cast.ts";
import { agentRun, delegationOf, grantOf, member, oneSource, onOrg, onRecord, readmitted } from "./fixtures.ts";
import * as O from "@beep/utils/Option";

const { call, fail, given, provide, rejected, saga, succeed, then, view, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns],
});

/**
 * What the outside systems answer in a review story, and what a person says: the Reasoner's
 * assessment and usage, the budget left when a reservation is refused, the reason the runs
 * context refuses a report with, the Reasoner's outage, the status a run ended in, a retraction's
 * reason, and a process that relays a hop.
 */
const Answers = S.Struct({
  assessment: Assessment,
  usage: Usage,
  remaining: BudgetRefused.fields.remaining,
  refusal: RunRefused.fields.reason,
  outage: ReasonerUnavailable.fields.reason,
  ended: RunEnded.fields.status,
  retraction: ClaimRetracted.fields.reason,
  relay: S.Struct({ process: Relayer.cases.Process.fields.process, cause: Cause }),
});
type Answers = typeof Answers.Type;

/** Who acts, and what the review's runs, hops and answers are, in a story over this cast. */
const sceneOf = (cast: Cast, answers: Answers) => {
  const roles = rolesOf(cast);
  const { home } = roles;
  const intake = member(roles.intake, home, [PartyIntake, PartyRead, PartyPropose]);
  const reviewer = member(roles.reviewer, home, [PartyReview, PartyRead, PartyPropose]);
  const claim = Claim.ref(roles.claim);
  const hasIdentifier = cast.identifier;
  const run1 = reviewRun(roles.claim, 1);
  const run2 = reviewRun(roles.claim, 2);
  const signals = oneSource(cast);

  /** The narrowed delegation a review run acts under: propose, on this claim only, from its accountable person's grant. */
  const runGrant = (run: RunId, accountable: PrincipalId) =>
    onRecord({
      grant: grantOf(accountable, PartyPropose),
      delegation: O.some(delegationOf(run)),
      capability: PartyPropose,
      org: home,
      record: streamOf(claim),
      operations: [ProposeDisposition.tag],
    });
  const runInvocation = (run: RunId, accountable: PrincipalId = roles.intake) =>
    agentRun(run, accountable, [runGrant(run, accountable)]);
  const sagaHop = (run: RunId, step: string) => byAgent(run, sagaStep(ReviewAssist.sagaName, { key: run, step }));
  const requestHop = (seq: number) =>
    byProcess(ReviewOnRequest.policyName, Cause.cases.Event.make({ stream: streamOf(claim), seq, event: ReviewRequested.tag }));

  const proposal = { ...answers.assessment, run: run1, evidenceRevision: 1 };
  const digest = proposalDigest(proposal);
  /** What the runs context answers each report with: the live run, here unchanged. */
  const liveAs = (run: RunId, accountable: PrincipalId = roles.intake) => ({ run, provenance: provenanceOf(runInvocation(run, accountable)) });
  /** The Reasoner's answer to the assessment a run asks for. */
  const assessedFor = (run: RunId) => ({
    assessment: answers.assessment,
    usage: answers.usage,
    receipt: { idempotencyKey: `${run}:assess`, promptVersion: ReviewPlan.versions.prompt, model: ReviewPlan.versions.model },
  });

  /** The steps of a run that is opened, reserves, assesses and settles, up to its proposal. */
  const assessUpToPropose = (run: RunId, live = liveAs(run), stepped = live) => [
    call(ReviewRuns.reserve, { run, units: ReviewPlan.maxPerCall }),
    succeed(ReviewRuns.reserve, live),
    call(Reasoner.assess, {
      run,
      step: "assess",
      idempotencyKey: `${run}:assess`,
      promptVersion: ReviewPlan.versions.prompt,
      maxAllowance: ReviewPlan.maxPerCall,
    }),
    succeed(Reasoner.assess, assessedFor(run)),
    call(ReviewRuns.settle, { run, units: answers.usage.units }),
    succeed(ReviewRuns.settle, live),
    call(ReviewRuns.step, { run, step: "assess" }),
    succeed(ReviewRuns.step, stepped),
  ];

  const requested = (run: RunId, by: Invocation) =>
    ReviewRequested.make({ run, org: home, proposition: hasIdentifier, signals, evidenceRevision: 1, provenance: provenanceOf(by) });
  const assertedByIntake = [
    as(intake),
    when(claim, AssertClaim.make({ org: home, proposition: hasIdentifier, signals })),
    then(
      claim,
      ClaimAsserted.make({ org: home, proposition: hasIdentifier, signals, provenance: provenanceOf(intake) }),
      requested(run1, intake),
    ),
    // The policy re-admits the asserter and opens a run under a delegation of their propose grant.
    call(Authority.readmit, { provenance: provenanceOf(intake), hop: requestHop(2) }),
    succeed(Authority.readmit, readmitted(intake, requestHop(2))),
    call(ReviewRuns.open, {
      run: run1,
      source: { grant: grantOf(roles.intake, PartyPropose), delegation: O.none() },
      terms: {
        capability: PartyPropose.id,
        operations: O.some([ProposeDisposition.tag]),
        resource: ResourceScope.cases.Record.make({ org: home, record: streamOf(claim) }),
        expires: O.none(),
      },
    }),
    succeed(ReviewRuns.open, { provenance: provenanceOf(runInvocation(run1)) }),
  ];
  const proposed = [
    given(
      claim,
      ClaimAsserted.make({ org: home, proposition: hasIdentifier, signals, provenance: provenanceOf(intake) }),
      requested(run1, intake),
      DispositionProposed.make({ ...proposal, digest, provenance: provenanceOf(runInvocation(run1)) }),
    ),
  ];
  /** The run proposes as itself, re-admitted for the propose hop. */
  const proposing = readmitted(runInvocation(run1), sagaHop(run1, "propose"));
  const proposes = [
    call(Authority.readmit, { provenance: provenanceOf(runInvocation(run1)), hop: sagaHop(run1, "propose") }),
    succeed(Authority.readmit, proposing),
    // Rooted at the run and its accountable human; its only grant is the delegation.
    then(claim, DispositionProposed.make({ ...proposal, digest, provenance: provenanceOf(proposing) })),
    call(ReviewRuns.awaitApproval, { run: run1 }),
  ];
  const completed = (run: RunId) => saga(ReviewAssist, run, { _tag: "Completed", result: undefined });
  return {
    ...roles,
    intake,
    reviewer,
    claim,
    hasIdentifier,
    run1,
    run2,
    signals,
    runGrant,
    runInvocation,
    sagaHop,
    requestHop,
    proposal,
    digest,
    liveAs,
    assessedFor,
    assessUpToPropose,
    requested,
    assertedByIntake,
    proposed,
    proposes,
    completed,
  };
};

it.effect.prop(
  "a review run proposes under its delegation and waits; a person's approval decides the claim",
  [Cast, Answers],
  ([cast, answers]) => {
    const { home, reviewer, claim, hasIdentifier, run1, proposal, digest, liveAs, assessUpToPropose, assertedByIntake, proposes, completed } =
      sceneOf(cast, answers);
    const accepts = proposal.disposition === "accept";
    return story(
      ...assertedByIntake,
      ...assessUpToPropose(run1),
      ...proposes,
      succeed(ReviewRuns.awaitApproval, liveAs(run1)),
      // The executor's work ends at the wait; the runs context concludes the run from Party's fact.
      completed(run1),
      view(ClaimReview, claim, { _tag: "Pending", reviews: [run1], proposal: O.some({ ...proposal, digest }) }),
      // One authenticated human command decides the claim; no port call follows.
      as(reviewer),
      when(claim, ApproveProposal.make({ digest, evidenceRevision: 1 }), { commandId: cast.approval }),
      then(
        claim,
        ProposalApproved.make({
          approval: cast.approval,
          run: run1,
          digest,
          evidenceRevision: 1,
          outcome: accepts ? "accepted" : "retracted",
          proposition: hasIdentifier,
          corroboration: O.some(1),
          org: O.some(home),
          reviewRuns: O.some([run1]),
          provenance: provenanceOf(reviewer),
        }),
      ),
      view(ClaimReview, claim, { _tag: accepts ? "Accepted" : "Retracted" }),
    );
  },
);

it.effect.prop("an agent-rooted approval, or one a process relays, is refused", [Cast, Answers], ([cast, answers]) => {
  const { home, agent, reviewer, claim, digest, proposed } = sceneOf(cast, answers);
  return story(
    ...proposed,
    // An agent run holding a review grant still cannot approve.
    as(agentRun(agent, rolesOf(cast).reviewer, [onOrg(agent, PartyReview, home)])),
    when(claim, ApproveProposal.make({ digest, evidenceRevision: 1 })),
    rejected(HumanApprovalRequired.make({})),
    // Nor can the reviewer's own authority relayed by a process.
    as(readmitted(reviewer, byProcess(answers.relay.process, answers.relay.cause))),
    when(claim, ApproveProposal.make({ digest, evidenceRevision: 1 })),
    rejected(HumanApprovalRequired.make({})),
  );
});

it.effect.prop("an approval binds the proposal it read: digest and evidence revision", [Cast, Answers], ([cast, answers]) => {
  const { intake, reviewer, claim, run1, signals, proposal, digest, runInvocation, proposed } = sceneOf(cast, answers);
  return story(
    ...proposed,
    as(reviewer),
    // The digest of another proposal.
    when(claim, ApproveProposal.make({ digest: proposalDigest({ ...proposal, evidenceRevision: 2 }), evidenceRevision: 1 })),
    rejected(ProposalMismatch.make({ reason: "digest" })),
    // New evidence makes the proposal stale; the approval no longer names anything.
    as(intake),
    when(claim, AddEvidence.make({ signals })),
    then(claim, EvidenceAdded.make({ signals, revision: 2, provenance: provenanceOf(intake) })),
    as(reviewer),
    when(claim, ApproveProposal.make({ digest, evidenceRevision: 1 })),
    rejected(ProposalMismatch.make({ reason: "no-proposal" })),
    // And a run's proposal against the old revision is refused.
    as(runInvocation(run1)),
    when(claim, ProposeDisposition.make({ ...answers.assessment, evidenceRevision: 1 })),
    rejected(ProposalStale.make({ evidenceRevision: 2 })),
  );
});

it.effect.prop(
  "a second review of the same claim is a second run; out of budget, it stops with no Reasoner call",
  [Cast, Answers],
  ([cast, answers]) => {
    const { reviewer, claim, run1, run2, runInvocation, requestHop, requested, proposed, completed } = sceneOf(cast, answers);
    const run2Provenance = provenanceOf(runInvocation(run2, rolesOf(cast).reviewer));
    return story(
      ...proposed,
      as(reviewer),
      when(claim, RequestReview.make({})),
      then(claim, requested(run2, reviewer)),
      call(Authority.readmit, { provenance: provenanceOf(reviewer), hop: requestHop(4) }),
      succeed(Authority.readmit, readmitted(reviewer, requestHop(4))),
      call(ReviewRuns.open, { run: run2, source: { grant: grantOf(rolesOf(cast).reviewer, PartyPropose), delegation: O.none() } }),
      succeed(ReviewRuns.open, { provenance: run2Provenance }),
      // The reservation is refused, so the run ends exhausted and the story sees no Reasoner call.
      call(ReviewRuns.reserve, { run: run2, units: ReviewPlan.maxPerCall }),
      fail(ReviewRuns.reserve, BudgetRefused.make({ remaining: answers.remaining })),
      call(ReviewRuns.exhaust, { run: run2 }),
      succeed(ReviewRuns.exhaust, { run: run2, provenance: run2Provenance }),
      completed(run2),
      view(ClaimReview, claim, { reviews: [run1, run2] }),
    );
  },
);

it.effect.prop(
  "a delegation revoked mid-run: the next hop is refused at re-admission, and the outcome is recorded",
  [Cast, Answers],
  ([cast, answers]) => {
    const { claim, run1, runGrant, runInvocation, sagaHop, liveAs, assessUpToPropose, assertedByIntake, completed } = sceneOf(cast, answers);
    const runProvenance = provenanceOf(runInvocation(run1));
    const lapsed = [{ grant: grantOf(rolesOf(cast).intake, PartyPropose), delegation: runGrant(run1, rolesOf(cast).intake).delegation }];
    const refused = ReadmissionRefused.make({ reason: "lapsed", lapsed });
    const reason = `readmission:${refused.reason}`;
    return story(
      ...assertedByIntake,
      ...assessUpToPropose(run1),
      call(Authority.readmit, { provenance: runProvenance, hop: sagaHop(run1, "propose") }),
      fail(Authority.readmit, refused),
      then(claim, ReviewRefused.make({ run: run1, reason, provenance: extend(runProvenance, sagaHop(run1, "record-refusal")) })),
      call(ReviewRuns.refuse, { run: run1, reason }),
      succeed(ReviewRuns.refuse, liveAs(run1)),
      completed(run1),
      view(ClaimReview, claim, { _tag: "Pending", notes: [{ _tag: "ReviewRefused", run: run1, reason }] }),
    );
  },
);

// Phase 7 (phase 6's P5): the delegation is revoked before a report hop, so the runs context
// refuses that report at re-admission. The refusal is recorded on the claim and reported to the
// run, which gives back its reservation (the runs model's stories prove the release), and the
// executor stops there.
describe("a delegation revoked before a report hop: the refused report is recorded, and the executor stops", () => {
  /** The refused report's scene: the refusal, and the steps that record it. */
  const refusedOf = (cast: Cast, answers: Answers) => {
    const scene = sceneOf(cast, answers);
    const { claim, run1, runInvocation, sagaHop, liveAs, assessUpToPropose, completed } = scene;
    const reason = answers.refusal;
    const runProvenance = provenanceOf(runInvocation(run1));
    const refusalRecorded = [
      then(claim, ReviewRefused.make({ run: run1, reason, provenance: extend(runProvenance, sagaHop(run1, "record-refusal")) })),
      call(ReviewRuns.refuse, { run: run1, reason }),
      succeed(ReviewRuns.refuse, liveAs(run1)),
      completed(run1),
      view(ClaimReview, claim, { _tag: "Pending", proposal: O.none(), notes: [{ _tag: "ReviewRefused", run: run1, reason }] }),
    ];
    const upTo = (count: number) => A.take(assessUpToPropose(run1), count);
    const assessFails = [
      ...upTo(3),
      fail(Reasoner.assess, ReasonerUnavailable.make({ reason: answers.outage })),
      call(ReviewRuns.release, { run: run1 }),
    ];
    const outOfBudget = [
      call(ReviewRuns.reserve, { run: run1, units: ReviewPlan.maxPerCall }),
      fail(ReviewRuns.reserve, BudgetRefused.make({ remaining: answers.remaining })),
      call(ReviewRuns.exhaust, { run: run1 }),
    ];
    return { ...scene, refused: RunRefused.make({ reason }), refusalRecorded, upTo, assessFails, outOfBudget };
  };

  it.effect.prop("before the reserve hop: no Reasoner call is made", [Cast, Answers], ([cast, answers]) => {
    const { assertedByIntake, upTo, refused, refusalRecorded } = refusedOf(cast, answers);
    return story(...assertedByIntake, ...upTo(1), fail(ReviewRuns.reserve, refused), ...refusalRecorded);
  });
  it.effect.prop("before the settle hop: the reservation it held is reported refused, not left open", [Cast, Answers], ([cast, answers]) => {
    const { assertedByIntake, upTo, refused, refusalRecorded } = refusedOf(cast, answers);
    return story(...assertedByIntake, ...upTo(5), fail(ReviewRuns.settle, refused), ...refusalRecorded);
  });
  it.effect.prop("before the step hop", [Cast, Answers], ([cast, answers]) => {
    const { assertedByIntake, upTo, refused, refusalRecorded } = refusedOf(cast, answers);
    return story(...assertedByIntake, ...upTo(7), fail(ReviewRuns.step, refused), ...refusalRecorded);
  });
  it.effect.prop("before the release hop, after the Reasoner failed", [Cast, Answers], ([cast, answers]) => {
    const { assertedByIntake, assessFails, refused, refusalRecorded } = refusedOf(cast, answers);
    return story(...assertedByIntake, ...assessFails, fail(ReviewRuns.release, refused), ...refusalRecorded);
  });
  it.effect.prop("before the exhaust hop, out of budget", [Cast, Answers], ([cast, answers]) => {
    const { assertedByIntake, outOfBudget, refused, refusalRecorded } = refusedOf(cast, answers);
    return story(...assertedByIntake, ...outOfBudget, fail(ReviewRuns.exhaust, refused), ...refusalRecorded);
  });
  it.effect.prop("before the wait, after the proposal was made: the proposal stands", [Cast, Answers], ([cast, answers]) => {
    const { claim, run1, proposal, digest, assessUpToPropose, assertedByIntake, proposes, refused, refusalRecorded } = refusedOf(cast, answers);
    return story(
      ...assertedByIntake,
      ...assessUpToPropose(run1),
      ...proposes,
      fail(ReviewRuns.awaitApproval, refused),
      ...A.take(refusalRecorded, 4),
      view(ClaimReview, claim, {
        _tag: "Pending",
        proposal: O.some({ ...proposal, digest }),
        notes: [{ _tag: "ReviewRefused", run: run1, reason: answers.refusal }],
      }),
    );
  });
});

it.effect.prop(
  "a run that continues at its history bound is followed: the next step acts as the run it continued as",
  [Cast, Answers],
  ([cast, answers]) => {
    const { claim, run1, continued, proposal, runInvocation, liveAs, assessUpToPropose, assertedByIntake, completed } = sceneOf(cast, answers);
    const nextRun = runInvocation(continued);
    // The saga stays keyed by the run it started as; the relayer is the live run.
    const proposeHop = byAgent(continued, sagaStep(ReviewAssist.sagaName, { key: run1, step: "propose" }));
    const proposing = readmitted(nextRun, proposeHop);
    const next = { run: continued, provenance: provenanceOf(nextRun) };
    return story(
      ...assertedByIntake,
      // The step report reached the bound: the runs context answers with the continuation.
      ...assessUpToPropose(run1, liveAs(run1), next),
      // The proposal is made as the continuation, under its own delegation.
      call(Authority.readmit, { provenance: provenanceOf(nextRun), hop: proposeHop }),
      succeed(Authority.readmit, proposing),
      then(
        claim,
        DispositionProposed.make({
          ...proposal,
          run: continued,
          digest: proposalDigest({ ...proposal, run: continued }),
          provenance: provenanceOf(proposing),
        }),
      ),
      call(ReviewRuns.awaitApproval, { run: continued, provenance: provenanceOf(nextRun) }),
      succeed(ReviewRuns.awaitApproval, next),
      completed(run1),
    );
  },
);

it.effect.prop("a decision that concluded the run while it was assessing ends the executor cleanly", [Cast, Answers], ([cast, answers]) => {
  const { run1, liveAs, assessedFor, assertedByIntake, completed } = sceneOf(cast, answers);
  return story(
    ...assertedByIntake,
    call(ReviewRuns.reserve, { run: run1, units: ReviewPlan.maxPerCall }),
    succeed(ReviewRuns.reserve, liveAs(run1)),
    call(Reasoner.assess, { run: run1 }),
    succeed(Reasoner.assess, assessedFor(run1)),
    // The runs context concluded the run from Party's fact in the meantime.
    call(ReviewRuns.settle, { run: run1, units: answers.usage.units }),
    fail(ReviewRuns.settle, RunEnded.make({ status: answers.ended })),
    // No step, no proposal, no wait: the saga completes without an error.
    completed(run1),
  );
});

it.effect.prop(
  "a claim decided before the proposal lands ends the executor cleanly, with nothing recorded",
  [Cast, Answers],
  ([cast, answers]) => {
    const { home, reviewer, claim, run1, runInvocation, sagaHop, liveAs, assessedFor, assertedByIntake, completed } = sceneOf(cast, answers);
    const runProvenance = provenanceOf(runInvocation(run1));
    return story(
      ...assertedByIntake,
      call(ReviewRuns.reserve, { run: run1, units: ReviewPlan.maxPerCall }),
      succeed(ReviewRuns.reserve, liveAs(run1)),
      call(Reasoner.assess, { run: run1 }),
      // While the Reasoner works, a reviewer decides the claim directly.
      as(reviewer),
      when(claim, RetractClaim.make({ reason: answers.retraction })),
      then(
        claim,
        ClaimRetracted.make({ reason: answers.retraction, org: O.some(home), reviewRuns: O.some([run1]), provenance: provenanceOf(reviewer) }),
      ),
      succeed(Reasoner.assess, assessedFor(run1)),
      call(ReviewRuns.settle, { run: run1, units: answers.usage.units }),
      succeed(ReviewRuns.settle, liveAs(run1)),
      call(ReviewRuns.step, { run: run1, step: "assess" }),
      succeed(ReviewRuns.step, liveAs(run1)),
      call(Authority.readmit, { provenance: runProvenance, hop: sagaHop(run1, "propose") }),
      succeed(Authority.readmit, readmitted(runInvocation(run1), sagaHop(run1, "propose"))),
      // The proposal answers ClaimNotPending: no refusal is recorded and no wait is reported.
      then(claim),
      completed(run1),
      view(ClaimReview, claim, { _tag: "Retracted", notes: [] }),
    );
  },
);
