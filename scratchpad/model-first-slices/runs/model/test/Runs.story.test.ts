import { Story } from "@alchemy.run/domain/Story";
import { expect, it } from "@effect/vitest";
import type { GrantTerms } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { DelegationId, GrantId, PrincipalId, RunId } from "@proto/kernel/Ids";
import {
  byProcess,
  Cause,
  extend,
  GrantRef,
  Invocation,
  provenanceOf,
} from "@proto/kernel/Invocation";
import { RunActivated } from "@proto/runs-contract/Run/ActivateRun.command";
import { AwaitApproval, RunAwaitingApproval } from "@proto/runs-contract/Run/AwaitApproval.command";
import { ChildRunFinished } from "@proto/runs-contract/Run/ChildFinished.command";
import { CompleteRun, RunCompleted } from "@proto/runs-contract/Run/CompleteRun.command";
import { ConcludeRun } from "@proto/runs-contract/Run/ConcludeRun.command";
import { BudgetExceeded } from "@proto/runs-contract/Run/BudgetExceeded.rejection";
import { ChildGrantWidens, ChildRequested, DelegateRun } from "@proto/runs-contract/Run/DelegateRun.command";
import { ExhaustRun, RunExhausted } from "@proto/runs-contract/Run/ExhaustRun.command";
import { NotThisRun } from "@proto/runs-contract/Run/NotThisRun.rejection";
import { ChildRunOpened } from "@proto/runs-contract/Run/OpenChildRun.command";
import { ContinuationOpened } from "@proto/runs-contract/Run/OpenContinuation.command";
import { RecordStep, RunContinued, StepRecorded } from "@proto/runs-contract/Run/RecordStep.command";
import { RejectRun, RunRejected } from "@proto/runs-contract/Run/RejectRun.command";
import { ReleaseReservation, ReservationReleased } from "@proto/runs-contract/Run/ReleaseReservation.command";
import { HumanOnly, RequestRun, RunRequested } from "@proto/runs-contract/Run/RequestRun.command";
import { BudgetReserved, ReserveBudget } from "@proto/runs-contract/Run/ReserveBudget.command";
import { RunNotRunning } from "@proto/runs-contract/Run/RunNotRunning.rejection";
import { SettleUsage, UsageSettled } from "@proto/runs-contract/Run/SettleUsage.command";
import { Authority, GrantDenied } from "@proto/runs-model/Authority.external";
import { AgentRun } from "@proto/runs-model/Run/AgentRun.aggregate";
import { SessionRuns } from "@proto/runs-model/Run/SessionRuns.view";
import { RunsHandlers } from "@proto/runs-model/Runs.handlers";
import { RunsModel } from "@proto/runs-model/Runs.model";

const { call, fail, provide, rejected, replied, state, succeed, then, view, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(RunsModel, { layer: RunsHandlers, stub: [Authority] });

import {
  active,
  activeBounded,
  asRun,
  hopOn,
  parentTerms,
  requester,
  reservation,
  run1,
  self,
  session,
  source,
  terms,
  versions,
} from "./fixtures.ts";
import * as O from "effect/Option";

it.effect("a person requests a run; the authority context grants its narrowed delegation and it starts", () => {
  const grantHop = hopOn("GrantOnRequest", "AgentRun/run_1", 1, "RunRequested");
  const request = RequestRun.make({ session, purpose: "review", versions, allowance: 100, historyBound: 20, source, terms: parentTerms });
  return story(
    // A run starts a child with DelegateRun; only a person requests a top-level run.
    as(asRun("run_x", "dlg:x")),
    when(run1, request),
    rejected(HumanOnly.make({})),
    as(requester),
    when(run1, request),
    then(
      run1,
      RunRequested.make({
        session,
        purpose: "review",
        versions,
        allowance: 100,
        historyBound: 20,
        source,
        terms: parentTerms,
        requester: PrincipalId.make("p_req"),
        provenance: provenanceOf(requester),
      }),
    ),
    call(Authority.grantRun, { run: RunId.make("run_1"), source, terms: parentTerms, delegation: DelegationId.make("dlg:run_1") }),
    succeed(Authority.grantRun, {
      delegation: DelegationId.make("dlg:run_1"),
      accountable: PrincipalId.make("p_req"),
      provenance: self("run_1", "dlg:run_1"),
    }),
    then(
      run1,
      RunActivated.make({
        session,
        delegation: DelegationId.make("dlg:run_1"),
        accountable: PrincipalId.make("p_req"),
        runProvenance: self("run_1", "dlg:run_1"),
        provenance: extend(provenanceOf(requester), grantHop),
      }),
    ),
    state(run1, (current) => {
      expect(current).toMatchObject({ _tag: "Running", run: { budget: { allowance: 100, reserved: 0, spent: 0, allocated: 0 } } });
    }),
    view(SessionRuns, session, { runs: [{ run: RunId.make("run_1"), previous: O.none(), parent: O.none(), status: "running" }] }),
  );
});

it.effect("a refused grant is recorded as the run's rejection", () =>
  story(
    as(requester),
    when(run1, RequestRun.make({ session, purpose: "review", versions, allowance: 100, historyBound: 20, source, terms: parentTerms })),
    then(
      run1,
      RunRequested.make({
        session,
        purpose: "review",
        versions,
        allowance: 100,
        historyBound: 20,
        source,
        terms: parentTerms,
        requester: PrincipalId.make("p_req"),
        provenance: provenanceOf(requester),
      }),
    ),
    call(Authority.grantRun, { run: RunId.make("run_1") }),
    fail(Authority.grantRun, GrantDenied.make({ reason: "TermsWiden" })),
    then(
      run1,
      RunRejected.make({
        session,
        reason: "grant:TermsWiden",
        released: 0,
        provenance: extend(provenanceOf(requester), hopOn("GrantOnRequest", "AgentRun/run_1", 1, "RunRequested")),
      }),
    ),
    view(SessionRuns, session, { runs: [{ run: RunId.make("run_1"), previous: O.none(), parent: O.none(), status: "rejected" }] }),
  ),
);

it.effect("a run refused mid-run, its hop refused at re-admission, gives back what its open reservation held", () =>
  story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("r1"), units: 40 })),
    then(run1, BudgetReserved.make({ session, reservation: reservation("r1"), units: 40, remaining: 60, provenance: self("run_1", "dlg:run_1") })),
    // The settle hop was refused, so the gateway records the refusal without re-admitting the run.
    when(run1, RejectRun.make({ session, reason: "readmission:lapsed", provenance: self("run_1", "dlg:run_1") })),
    then(run1, RunRejected.make({ session, reason: "readmission:lapsed", released: 40, provenance: self("run_1", "dlg:run_1") })),
    state(run1, (current) =>
      expect(current).toMatchObject({
        _tag: "Refused",
        reason: "readmission:lapsed",
        run: { budget: { allowance: 100, reserved: 0, spent: 0 }, reservations: [] },
      }),
    ),
    // It takes no more reports, and reads as rejected.
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReleaseReservation.make({ reservation: reservation("r1") })),
    rejected(RunNotRunning.make({ status: "rejected" })),
    view(SessionRuns, session, { runs: [{ run: RunId.make("run_1"), previous: O.none(), parent: O.none(), status: "rejected" }] }),
  ),
);

it.effect("reservations never exceed what remains, so two reservations cannot spend one allowance", () =>
  story(
    ...active(100),
    // Only the run itself reports on the run.
    as(requester),
    when(run1, ReserveBudget.make({ reservation: reservation("r0"), units: 1 })),
    rejected(NotThisRun.make({})),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("r1"), units: 60 })),
    then(run1, BudgetReserved.make({ session, reservation: reservation("r1"), units: 60, remaining: 40, provenance: self("run_1", "dlg:run_1") })),
    // A second, parallel call would spend the same allowance: refused.
    when(run1, ReserveBudget.make({ reservation: reservation("r2"), units: 50 })),
    rejected(BudgetExceeded.make({ requested: 50, remaining: 40 })),
    // Settled at the usage reported: the unused part of the reservation returns.
    when(run1, SettleUsage.make({ reservation: reservation("r1"), units: 45 })),
    then(
      run1,
      UsageSettled.make({ session, reservation: reservation("r1"), reserved: 60, units: 45, remaining: 55, provenance: self("run_1", "dlg:run_1") }),
    ),
    when(run1, ReserveBudget.make({ reservation: reservation("r3"), units: 55 })),
    then(run1, BudgetReserved.make({ session, reservation: reservation("r3"), units: 55, remaining: 0, provenance: self("run_1", "dlg:run_1") })),
    // A failed call releases its reservation.
    when(run1, ReleaseReservation.make({ reservation: reservation("r3") })),
    then(run1, ReservationReleased.make({ session, reservation: reservation("r3"), units: 55, provenance: self("run_1", "dlg:run_1") })),
    when(run1, ReserveBudget.make({ reservation: reservation("r4"), units: 56 })),
    rejected(BudgetExceeded.make({ requested: 56, remaining: 55 })),
    state(run1, (current) => {
      expect(current).toMatchObject({ run: { budget: { allowance: 100, reserved: 0, spent: 45, allocated: 0 } } });
    }),
  ),
);

it.effect("a parent gives a child a share of its budget and a narrower grant; the child cannot widen or overspend", () => {
  const child = AgentRun.ref("run_child");
  const childTerms = terms(O.some(["ProposeDisposition"]));
  const delegate = (allowance: number, granted: GrantTerms) =>
    DelegateRun.make({
      child: RunId.make("run_child"),
      delegation: DelegationId.make("dlg:run_child"),
      purpose: "sub-review",
      allowance,
      terms: granted,
    });
  const childSource = GrantRef.make({ grant: GrantId.make("g_req"), delegation: O.some(DelegationId.make("dlg:run_1")) });
  const openHop = hopOn("OpenChildOnRequest", "AgentRun/run_1", 3, "ChildRequested");
  return story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, delegate(30, terms(O.none()))),
    rejected(ChildGrantWidens.make({ dimension: "operations" })),
    when(run1, delegate(200, childTerms)),
    rejected(BudgetExceeded.make({ requested: 200, remaining: 100 })),
    when(run1, delegate(30, childTerms)),
    then(
      run1,
      ChildRequested.make({
        session,
        child: RunId.make("run_child"),
        delegation: DelegationId.make("dlg:run_child"),
        purpose: "sub-review",
        allowance: 30,
        terms: childTerms,
        versions,
        historyBound: 20,
        source: childSource,
        provenance: self("run_1", "dlg:run_1"),
      }),
    ),
    // The authority context delegates the parent's delegation, narrowed, to the child.
    call(Authority.grantRun, {
      run: RunId.make("run_child"),
      source: childSource,
      delegation: DelegationId.make("dlg:run_child"),
      terms: childTerms,
    }),
    succeed(Authority.grantRun, {
      delegation: DelegationId.make("dlg:run_child"),
      accountable: PrincipalId.make("p_req"),
      provenance: self("run_child", "dlg:run_child", childTerms),
    }),
    then(
      child,
      ChildRunOpened.make({
        session,
        parent: RunId.make("run_1"),
        purpose: "sub-review",
        versions,
        allowance: 30,
        historyBound: 20,
        source: childSource,
        terms: childTerms,
        delegation: DelegationId.make("dlg:run_child"),
        accountable: PrincipalId.make("p_req"),
        requester: PrincipalId.make("p_req"),
        runProvenance: self("run_child", "dlg:run_child", childTerms),
        provenance: extend(self("run_1", "dlg:run_1"), openHop),
      }),
    ),
    // The child's share came out of the parent's budget; the parent waits.
    state(run1, (current) => {
      expect(current).toMatchObject({ _tag: "AwaitingChild", run: { budget: { allowance: 100, allocated: 30 } } });
    }),
    as(asRun("run_child", "dlg:run_child", childTerms)),
    when(child, ReserveBudget.make({ reservation: reservation("c1"), units: 31 })),
    rejected(BudgetExceeded.make({ requested: 31, remaining: 30 })),
    when(child, ReserveBudget.make({ reservation: reservation("c1"), units: 30 })),
    then(
      child,
      BudgetReserved.make({
        session,
        reservation: reservation("c1"),
        units: 30,
        remaining: 0,
        provenance: self("run_child", "dlg:run_child", childTerms),
      }),
    ),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("p1"), units: 1 })),
    rejected(RunNotRunning.make({ status: "awaiting-child" })),
    view(SessionRuns, session, {
      runs: [
        { run: RunId.make("run_1"), previous: O.none(), parent: O.none(), status: "awaiting-child" },
        { run: RunId.make("run_child"), previous: O.none(), parent: O.some(RunId.make("run_1")), status: "running" },
      ],
    }),
  );
});

it.effect("a run at its history bound continues as a new run, and the session's chain shows both", () => {
  const next = AgentRun.ref("run_1~1");
  const nextSource = GrantRef.make({ grant: GrantId.make("g_req"), delegation: O.some(DelegationId.make("dlg:run_1")) });
  const continueHop = hopOn("ContinueAtBound", "AgentRun/run_1", 5, "RunContinued");
  return story(
    ...activeBounded(100, 2),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, RecordStep.make({ step: "assess" })),
    then(run1, StepRecorded.make({ session, step: "assess", count: 1, provenance: self("run_1", "dlg:run_1") })),
    when(run1, RecordStep.make({ step: "propose" })),
    then(
      run1,
      StepRecorded.make({ session, step: "propose", count: 2, provenance: self("run_1", "dlg:run_1") }),
      RunContinued.make({
        session,
        next: RunId.make("run_1~1"),
        lineage: RunId.make("run_1"),
        generation: 1,
        parent: O.none(),
        remaining: 100,
        reservations: [],
        purpose: "review",
        versions,
        historyBound: 2,
        source: nextSource,
        terms: parentTerms,
        requester: PrincipalId.make("p_req"),
        provenance: self("run_1", "dlg:run_1"),
      }),
    ),
    call(Authority.grantRun, {
      run: RunId.make("run_1~1"),
      source: nextSource,
      delegation: DelegationId.make("dlg:run_1~1"),
      terms: parentTerms,
    }),
    succeed(Authority.grantRun, {
      delegation: DelegationId.make("dlg:run_1~1"),
      accountable: PrincipalId.make("p_req"),
      provenance: self("run_1~1", "dlg:run_1~1"),
    }),
    then(
      next,
      ContinuationOpened.make({
        session,
        previous: RunId.make("run_1"),
        lineage: RunId.make("run_1"),
        generation: 1,
        parent: O.none(),
        purpose: "review",
        versions,
        allowance: 100,
        reservations: [],
        historyBound: 2,
        source: nextSource,
        terms: parentTerms,
        delegation: DelegationId.make("dlg:run_1~1"),
        accountable: PrincipalId.make("p_req"),
        requester: PrincipalId.make("p_req"),
        runProvenance: self("run_1~1", "dlg:run_1~1"),
        provenance: extend(self("run_1", "dlg:run_1"), continueHop),
      }),
    ),
    state(run1, { _tag: "Continued", next: RunId.make("run_1~1") }),
    view(SessionRuns, session, {
      runs: [
        { run: RunId.make("run_1"), previous: O.none(), parent: O.none(), status: "continued" },
        { run: RunId.make("run_1~1"), previous: O.some(RunId.make("run_1")), parent: O.none(), status: "running" },
      ],
    }),
  );
});

it.effect("completing a run releases its open reservations, so a finished run holds no budget", () =>
  story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("r1"), units: 60 })),
    then(run1, BudgetReserved.make({ session, reservation: reservation("r1"), units: 60, remaining: 40, provenance: self("run_1", "dlg:run_1") })),
    when(run1, CompleteRun.make({ outcome: "done" })),
    then(run1, RunCompleted.make({ session, outcome: "done", released: 60, provenance: self("run_1", "dlg:run_1") })),
    state(run1, (current) => {
      expect(current).toMatchObject({
        _tag: "Completed",
        run: { budget: { allowance: 100, reserved: 0, spent: 0 }, reservations: [] },
      });
    }),
  ),
);

it.effect("a child that finishes resumes its parent, which keeps what the child did not spend", () => {
  const child = AgentRun.ref("run_child");
  const childTerms = terms(O.some(["ProposeDisposition"]));
  const childSource = GrantRef.make({ grant: GrantId.make("g_req"), delegation: O.some(DelegationId.make("dlg:run_1")) });
  const asChild = asRun("run_child", "dlg:run_child", childTerms);
  return story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(
      run1,
      DelegateRun.make({
        child: RunId.make("run_child"),
        delegation: DelegationId.make("dlg:run_child"),
        purpose: "sub-review",
        allowance: 30,
        terms: childTerms,
      }),
    ),
    then(
      run1,
      ChildRequested.make({
        session,
        child: RunId.make("run_child"),
        delegation: DelegationId.make("dlg:run_child"),
        purpose: "sub-review",
        allowance: 30,
        terms: childTerms,
        versions,
        historyBound: 20,
        source: childSource,
        provenance: self("run_1", "dlg:run_1"),
      }),
    ),
    call(Authority.grantRun, { run: RunId.make("run_child"), source: childSource }),
    succeed(Authority.grantRun, {
      delegation: DelegationId.make("dlg:run_child"),
      accountable: PrincipalId.make("p_req"),
      provenance: provenanceOf(asChild),
    }),
    then(
      child,
      ChildRunOpened.make({
        session,
        parent: RunId.make("run_1"),
        purpose: "sub-review",
        versions,
        allowance: 30,
        historyBound: 20,
        source: childSource,
        terms: childTerms,
        delegation: DelegationId.make("dlg:run_child"),
        accountable: PrincipalId.make("p_req"),
        requester: PrincipalId.make("p_req"),
        runProvenance: provenanceOf(asChild),
        provenance: extend(self("run_1", "dlg:run_1"), hopOn("OpenChildOnRequest", "AgentRun/run_1", 3, "ChildRequested")),
      }),
    ),
    as(asChild),
    when(child, ReserveBudget.make({ reservation: reservation("c1"), units: 20 })),
    then(child, BudgetReserved.make({ session, reservation: reservation("c1"), units: 20, remaining: 10, provenance: provenanceOf(asChild) })),
    when(child, SettleUsage.make({ reservation: reservation("c1"), units: 12 })),
    then(
      child,
      UsageSettled.make({ session, reservation: reservation("c1"), reserved: 20, units: 12, remaining: 18, provenance: provenanceOf(asChild) }),
    ),
    when(child, CompleteRun.make({ outcome: "done" })),
    then(child, RunCompleted.make({ session, outcome: "done", released: 0, provenance: provenanceOf(asChild) })),
    // The policy reads the finished child and tells its parent: 18 of 30 come back.
    then(
      run1,
      ChildRunFinished.make({
        session,
        child: RunId.make("run_child"),
        allowance: 30,
        spent: 12,
        outcome: "done",
        provenance: extend(provenanceOf(asChild), hopOn("ResumeParent", "AgentRun/run_child", 4, "RunCompleted")),
      }),
    ),
    state(run1, (current) => {
      expect(current).toMatchObject({ _tag: "Running", run: { budget: { allowance: 100, allocated: 0, spent: 12 } } });
    }),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("p1"), units: 88 })),
    then(run1, BudgetReserved.make({ session, reservation: reservation("p1"), units: 88, remaining: 0, provenance: self("run_1", "dlg:run_1") })),
  );
});

it.effect("a child that runs out of budget is exhausted, and its parent resumes with what the child left", () => {
  const child = AgentRun.ref("run_child");
  const childTerms = terms(O.some(["ProposeDisposition"]));
  const childSource = GrantRef.make({ grant: GrantId.make("g_req"), delegation: O.some(DelegationId.make("dlg:run_1")) });
  const asChild = asRun("run_child", "dlg:run_child", childTerms);
  return story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(
      run1,
      DelegateRun.make({
        child: RunId.make("run_child"),
        delegation: DelegationId.make("dlg:run_child"),
        purpose: "sub-review",
        allowance: 30,
        terms: childTerms,
      }),
    ),
    then(
      run1,
      ChildRequested.make({
        session,
        child: RunId.make("run_child"),
        delegation: DelegationId.make("dlg:run_child"),
        purpose: "sub-review",
        allowance: 30,
        terms: childTerms,
        versions,
        historyBound: 20,
        source: childSource,
        provenance: self("run_1", "dlg:run_1"),
      }),
    ),
    call(Authority.grantRun, { run: RunId.make("run_child"), source: childSource }),
    succeed(Authority.grantRun, {
      delegation: DelegationId.make("dlg:run_child"),
      accountable: PrincipalId.make("p_req"),
      provenance: provenanceOf(asChild),
    }),
    then(
      child,
      ChildRunOpened.make({
        session,
        parent: RunId.make("run_1"),
        purpose: "sub-review",
        versions,
        allowance: 30,
        historyBound: 20,
        source: childSource,
        terms: childTerms,
        delegation: DelegationId.make("dlg:run_child"),
        accountable: PrincipalId.make("p_req"),
        requester: PrincipalId.make("p_req"),
        runProvenance: provenanceOf(asChild),
        provenance: extend(self("run_1", "dlg:run_1"), hopOn("OpenChildOnRequest", "AgentRun/run_1", 3, "ChildRequested")),
      }),
    ),
    as(asChild),
    when(child, ReserveBudget.make({ reservation: reservation("c1"), units: 20 })),
    then(child, BudgetReserved.make({ session, reservation: reservation("c1"), units: 20, remaining: 10, provenance: provenanceOf(asChild) })),
    when(child, SettleUsage.make({ reservation: reservation("c1"), units: 12 })),
    then(
      child,
      UsageSettled.make({ session, reservation: reservation("c1"), reserved: 20, units: 12, remaining: 18, provenance: provenanceOf(asChild) }),
    ),
    // The next call needs more than the 18 left: the child's executor ends it as exhausted.
    when(child, ReserveBudget.make({ reservation: reservation("c2"), units: 30 })),
    rejected(BudgetExceeded.make({ requested: 30, remaining: 18 })),
    when(child, ExhaustRun.make({})),
    then(child, RunExhausted.make({ session, remaining: 18, provenance: provenanceOf(asChild) })),
    // The policy reads the finished child and tells its parent: 18 of 30 come back.
    then(
      run1,
      ChildRunFinished.make({
        session,
        child: RunId.make("run_child"),
        allowance: 30,
        spent: 12,
        outcome: "RunExhausted",
        provenance: extend(provenanceOf(asChild), hopOn("ResumeParent", "AgentRun/run_child", 4, "RunExhausted")),
      }),
    ),
    state(run1, (current) => {
      expect(current).toMatchObject({ _tag: "Running", run: { budget: { allowance: 100, allocated: 0, spent: 12 } } });
    }),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("p1"), units: 88 })),
    then(run1, BudgetReserved.make({ session, reservation: reservation("p1"), units: 88, remaining: 0, provenance: self("run_1", "dlg:run_1") })),
  );
});

it.effect("a child refused mid-run gives back its reservation and resumes its parent, which keeps the child's share", () => {
  const child = AgentRun.ref("run_child");
  const childTerms = terms(O.some(["ProposeDisposition"]));
  const childSource = GrantRef.make({ grant: GrantId.make("g_req"), delegation: O.some(DelegationId.make("dlg:run_1")) });
  const asChild = asRun("run_child", "dlg:run_child", childTerms);
  return story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(
      run1,
      DelegateRun.make({
        child: RunId.make("run_child"),
        delegation: DelegationId.make("dlg:run_child"),
        purpose: "sub-review",
        allowance: 30,
        terms: childTerms,
      }),
    ),
    then(
      run1,
      ChildRequested.make({
        session,
        child: RunId.make("run_child"),
        delegation: DelegationId.make("dlg:run_child"),
        purpose: "sub-review",
        allowance: 30,
        terms: childTerms,
        versions,
        historyBound: 20,
        source: childSource,
        provenance: self("run_1", "dlg:run_1"),
      }),
    ),
    call(Authority.grantRun, { run: RunId.make("run_child"), source: childSource }),
    succeed(Authority.grantRun, {
      delegation: DelegationId.make("dlg:run_child"),
      accountable: PrincipalId.make("p_req"),
      provenance: provenanceOf(asChild),
    }),
    then(
      child,
      ChildRunOpened.make({
        session,
        parent: RunId.make("run_1"),
        purpose: "sub-review",
        versions,
        allowance: 30,
        historyBound: 20,
        source: childSource,
        terms: childTerms,
        delegation: DelegationId.make("dlg:run_child"),
        accountable: PrincipalId.make("p_req"),
        requester: PrincipalId.make("p_req"),
        runProvenance: provenanceOf(asChild),
        provenance: extend(self("run_1", "dlg:run_1"), hopOn("OpenChildOnRequest", "AgentRun/run_1", 3, "ChildRequested")),
      }),
    ),
    as(asChild),
    when(child, ReserveBudget.make({ reservation: reservation("c1"), units: 20 })),
    then(child, BudgetReserved.make({ session, reservation: reservation("c1"), units: 20, remaining: 10, provenance: provenanceOf(asChild) })),
    // The child's next hop was refused at re-admission: the refusal is recorded without re-admitting it.
    when(child, RejectRun.make({ session, reason: "readmission:lapsed", provenance: provenanceOf(asChild) })),
    then(child, RunRejected.make({ session, reason: "readmission:lapsed", released: 20, provenance: provenanceOf(asChild) })),
    // The policy reads the refused child and tells its parent: it spent nothing, so all 30 come back.
    then(
      run1,
      ChildRunFinished.make({
        session,
        child: RunId.make("run_child"),
        allowance: 30,
        spent: 0,
        outcome: "RunRejected",
        provenance: extend(provenanceOf(asChild), hopOn("ResumeParent", "AgentRun/run_child", 3, "RunRejected")),
      }),
    ),
    state(run1, (current) => {
      expect(current).toMatchObject({ _tag: "Running", run: { budget: { allowance: 100, allocated: 0, spent: 0 } } });
    }),
  );
});

it.effect("a fact that decided the run's subject concludes it under its own provenance, once", () => {
  const factHop = byProcess(
    "ClaimDecisionInbox",
    Cause.cases.Fact.make({ producer: "party", contract: "ClaimDecided", version: 1, fact: "claim_1:decided" }),
  );
  return story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("r1"), units: 10 })),
    then(run1, BudgetReserved.make({ session, reservation: reservation("r1"), units: 10, remaining: 90, provenance: self("run_1", "dlg:run_1") })),
    when(run1, AwaitApproval.make({})),
    then(run1, RunAwaitingApproval.make({ session, provenance: self("run_1", "dlg:run_1") })),
    when(run1, ConcludeRun.make({ outcome: "accepted", hop: factHop })),
    then(run1, RunCompleted.make({ session, outcome: "accepted", released: 10, provenance: extend(self("run_1", "dlg:run_1"), factHop) })),
    // The same fact again finds the run finished and records nothing.
    when(run1, ConcludeRun.make({ outcome: "accepted", hop: factHop })),
    then(run1),
    state(run1, (current) => {
      expect(current).toMatchObject({ _tag: "Completed", outcome: "accepted", run: { budget: { reserved: 0 } } });
    }),
  );
});

// Idempotency (D14), pinned as the library behaves today: the receipt is looked up by command
// id before the command is decoded, authorized or decided (InMemory.ts:646-650).
it.effect("a reused command id with the same payload returns the first receipt and records nothing", () =>
  story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("r1"), units: 40 }), { commandId: "reserve-1" }),
    then(run1, BudgetReserved.make({ session, reservation: reservation("r1"), units: 40, remaining: 60, provenance: self("run_1", "dlg:run_1") })),
    replied({ remaining: 60 }),
    when(run1, ReserveBudget.make({ reservation: reservation("r1"), units: 40 }), { commandId: "reserve-1" }),
    then(run1),
    replied({ remaining: 60 }),
  ),
);

it.effect("PINNED HAZARD: a reused command id with a different payload returns the first request's receipt", () =>
  story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("r1"), units: 40 }), { commandId: "reserve-1" }),
    then(run1, BudgetReserved.make({ session, reservation: reservation("r1"), units: 40, remaining: 60, provenance: self("run_1", "dlg:run_1") })),
    replied({ remaining: 60 }),
    // A different reservation under the same id: not decided, not refused, answered with the old reply.
    when(run1, ReserveBudget.make({ reservation: reservation("r2"), units: 50 }), { commandId: "reserve-1" }),
    then(run1),
    replied({ remaining: 60 }),
    state(run1, (current) => {
      expect(current).toMatchObject({ run: { reservations: [{ reservation: "r1", units: 40 }] } });
    }),
  ),
);

it.effect("PINNED HAZARD: a caller without the grant, reusing the id, receives the stored result", () =>
  story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, ReserveBudget.make({ reservation: reservation("r1"), units: 40 }), { commandId: "reserve-1" }),
    then(run1, BudgetReserved.make({ session, reservation: reservation("r1"), units: 40, remaining: 60, provenance: self("run_1", "dlg:run_1") })),
    replied({ remaining: 60 }),
    // The requester is not the run, so a fresh id is refused ...
    as(requester),
    when(run1, ReserveBudget.make({ reservation: reservation("r9"), units: 1 })),
    rejected(NotThisRun.make({})),
    // ... but the reused id is answered from the receipt, before any check runs.
    when(run1, ReserveBudget.make({ reservation: reservation("r1"), units: 40 }), { commandId: "reserve-1" }),
    then(run1),
    replied({ remaining: 60 }),
  ),
);
