import { Story } from "@alchemy.run/domain/Story";
import { expect, it } from "@effect/vitest";
import { CapabilityGrant, type GrantTerms, ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { CapabilityId, DelegationId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import {
  byProcess,
  Cause,
  extend,
  GrantRef,
  Invocation,
  type Provenance,
  provenanceOf,
  Root,
} from "@proto/kernel/Invocation";
import { RunActivated } from "@proto/runs-contract/Run/ActivateRun.command";
import { BudgetExceeded } from "@proto/runs-contract/Run/BudgetExceeded.rejection";
import { ChildGrantWidens, ChildRequested, DelegateRun } from "@proto/runs-contract/Run/DelegateRun.command";
import { NotThisRun } from "@proto/runs-contract/Run/NotThisRun.rejection";
import { ChildRunOpened } from "@proto/runs-contract/Run/OpenChildRun.command";
import { ContinuationOpened } from "@proto/runs-contract/Run/OpenContinuation.command";
import { RecordStep, RunContinued, StepRecorded } from "@proto/runs-contract/Run/RecordStep.command";
import { RunRejected } from "@proto/runs-contract/Run/RejectRun.command";
import { ReleaseReservation, ReservationReleased } from "@proto/runs-contract/Run/ReleaseReservation.command";
import { HumanOnly, RequestRun, RunRequested } from "@proto/runs-contract/Run/RequestRun.command";
import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
import { BudgetReserved, ReserveBudget } from "@proto/runs-contract/Run/ReserveBudget.command";
import { RunNotRunning } from "@proto/runs-contract/Run/RunNotRunning.rejection";
import { RunVersions } from "@proto/runs-contract/Run/RunVersions";
import { SessionId } from "@proto/runs-contract/Run/Session.id";
import { SettleUsage, UsageSettled } from "@proto/runs-contract/Run/SettleUsage.command";
import { Authority, GrantDenied } from "@proto/runs-model/Authority.external";
import { AgentRun } from "@proto/runs-model/Run/AgentRun.aggregate";
import { SessionRuns } from "@proto/runs-model/Run/SessionRuns.view";
import { RunsHandlers } from "@proto/runs-model/Runs.handlers";
import { RunsModel } from "@proto/runs-model/Runs.model";

const { call, fail, given, provide, rejected, state, succeed, then, view, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(RunsModel, { layer: RunsHandlers, stub: [Authority] });

// Fixtures build invocations, as the authority context does in a host.
const acme = OrgId.make("org_acme");
const session = SessionId.make("session_1");
const versions = RunVersions.make({ prompt: "p1", model: "m1", tools: "t1" });
const requester = Invocation.make({
  root: Root.cases.Human.make({ principal: PrincipalId.make("p_req") }),
  onBehalfOf: PrincipalId.make("p_req"),
  grants: [
    CapabilityGrant.make({
      grant: GrantId.make("g_req"),
      delegation: null,
      capability: CapabilityId.make("party.propose"),
      operations: null,
      resource: ResourceScope.cases.Org.make({ org: acme }),
      expires: null,
    }),
  ],
  chain: [],
});
const terms = (operations: ReadonlyArray<string> | null): GrantTerms => ({
  capability: CapabilityId.make("party.propose"),
  operations,
  resource: ResourceScope.cases.Org.make({ org: acme }),
  expires: null,
});
const parentTerms = terms(["ProposeDisposition", "AcceptClaim"]);
const source = GrantRef.make({ grant: GrantId.make("g_req"), delegation: null });

/** A run's own invocation: an agent root naming its accountable human, its delegation its only grant. */
const asRun = (run: string, delegation: string, granted: GrantTerms = parentTerms) =>
  Invocation.make({
    root: Root.cases.Agent.make({ run: RunId.make(run), accountable: PrincipalId.make("p_req") }),
    onBehalfOf: PrincipalId.make("p_req"),
    grants: [CapabilityGrant.make({ grant: GrantId.make("g_req"), delegation: DelegationId.make(delegation), ...granted })],
    chain: [],
  });

const run1 = AgentRun.ref("run_1");
const reservation = (id: string) => ReservationId.make(id);
const hopOn = (policy: string, stream: string, seq: number, event: string) =>
  byProcess(policy, Cause.cases.Event.make({ stream, seq, event }));

/** A run requested by p_req and granted, with this budget and history bound. */
const active = (allowance: number, historyBound = 20): ReadonlyArray<ReturnType<typeof given>> => [
  given(
    run1,
    new RunRequested({
      session,
      purpose: "review",
      versions,
      allowance,
      historyBound,
      source,
      terms: parentTerms,
      requester: PrincipalId.make("p_req"),
      provenance: provenanceOf(requester),
    }),
    new RunActivated({
      session,
      delegation: DelegationId.make("dlg:run_1"),
      accountable: PrincipalId.make("p_req"),
      runProvenance: provenanceOf(asRun("run_1", "dlg:run_1")),
      provenance: extend(provenanceOf(requester), hopOn("GrantOnRequest", "AgentRun/run_1", 1, "RunRequested")),
    }),
  ),
];

const self = (run: string, delegation: string, granted?: GrantTerms): Provenance =>
  provenanceOf(asRun(run, delegation, granted));

it.effect("a person requests a run; the authority context grants its narrowed delegation and it starts", () => {
  const grantHop = hopOn("GrantOnRequest", "AgentRun/run_1", 1, "RunRequested");
  const request = new RequestRun({ session, purpose: "review", versions, allowance: 100, historyBound: 20, source, terms: parentTerms });
  return story(
    // A run starts a child with DelegateRun; only a person requests a top-level run.
    as(asRun("run_x", "dlg:x")),
    when(run1, request),
    rejected(new HumanOnly()),
    as(requester),
    when(run1, request),
    then(
      run1,
      new RunRequested({
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
      new RunActivated({
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
    view(SessionRuns, session, { runs: [{ run: RunId.make("run_1"), previous: null, parent: null, status: "running" }] }),
  );
});

it.effect("a refused grant is recorded as the run's rejection", () =>
  story(
    as(requester),
    when(run1, new RequestRun({ session, purpose: "review", versions, allowance: 100, historyBound: 20, source, terms: parentTerms })),
    then(
      run1,
      new RunRequested({
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
    fail(Authority.grantRun, new GrantDenied({ reason: "TermsWiden" })),
    then(
      run1,
      new RunRejected({
        session,
        reason: "grant:TermsWiden",
        provenance: extend(provenanceOf(requester), hopOn("GrantOnRequest", "AgentRun/run_1", 1, "RunRequested")),
      }),
    ),
    view(SessionRuns, session, { runs: [{ run: RunId.make("run_1"), previous: null, parent: null, status: "rejected" }] }),
  ),
);

it.effect("reservations never exceed what remains, so two reservations cannot spend one allowance", () =>
  story(
    ...active(100),
    // Only the run itself reports on the run.
    as(requester),
    when(run1, new ReserveBudget({ reservation: reservation("r0"), units: 1 })),
    rejected(new NotThisRun()),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, new ReserveBudget({ reservation: reservation("r1"), units: 60 })),
    then(run1, new BudgetReserved({ session, reservation: reservation("r1"), units: 60, remaining: 40, provenance: self("run_1", "dlg:run_1") })),
    // A second, parallel call would spend the same allowance: refused.
    when(run1, new ReserveBudget({ reservation: reservation("r2"), units: 50 })),
    rejected(new BudgetExceeded({ requested: 50, remaining: 40 })),
    // Settled at the usage reported: the unused part of the reservation returns.
    when(run1, new SettleUsage({ reservation: reservation("r1"), units: 45 })),
    then(
      run1,
      new UsageSettled({ session, reservation: reservation("r1"), reserved: 60, units: 45, remaining: 55, provenance: self("run_1", "dlg:run_1") }),
    ),
    when(run1, new ReserveBudget({ reservation: reservation("r3"), units: 55 })),
    then(run1, new BudgetReserved({ session, reservation: reservation("r3"), units: 55, remaining: 0, provenance: self("run_1", "dlg:run_1") })),
    // A failed call releases its reservation.
    when(run1, new ReleaseReservation({ reservation: reservation("r3") })),
    then(run1, new ReservationReleased({ session, reservation: reservation("r3"), units: 55, provenance: self("run_1", "dlg:run_1") })),
    when(run1, new ReserveBudget({ reservation: reservation("r4"), units: 56 })),
    rejected(new BudgetExceeded({ requested: 56, remaining: 55 })),
    state(run1, (current) => {
      expect(current).toMatchObject({ run: { budget: { allowance: 100, reserved: 0, spent: 45, allocated: 0 } } });
    }),
  ),
);

it.effect("a parent gives a child a share of its budget and a narrower grant; the child cannot widen or overspend", () => {
  const child = AgentRun.ref("run_child");
  const childTerms = terms(["ProposeDisposition"]);
  const delegate = (allowance: number, granted: GrantTerms) =>
    new DelegateRun({
      child: RunId.make("run_child"),
      delegation: DelegationId.make("dlg:run_child"),
      purpose: "sub-review",
      allowance,
      terms: granted,
    });
  const childSource = GrantRef.make({ grant: GrantId.make("g_req"), delegation: DelegationId.make("dlg:run_1") });
  const openHop = hopOn("OpenChildOnRequest", "AgentRun/run_1", 3, "ChildRequested");
  return story(
    ...active(100),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, delegate(30, terms(null))),
    rejected(new ChildGrantWidens({ dimension: "operations" })),
    when(run1, delegate(200, childTerms)),
    rejected(new BudgetExceeded({ requested: 200, remaining: 100 })),
    when(run1, delegate(30, childTerms)),
    then(
      run1,
      new ChildRequested({
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
      new ChildRunOpened({
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
    when(child, new ReserveBudget({ reservation: reservation("c1"), units: 31 })),
    rejected(new BudgetExceeded({ requested: 31, remaining: 30 })),
    when(child, new ReserveBudget({ reservation: reservation("c1"), units: 30 })),
    then(
      child,
      new BudgetReserved({
        session,
        reservation: reservation("c1"),
        units: 30,
        remaining: 0,
        provenance: self("run_child", "dlg:run_child", childTerms),
      }),
    ),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, new ReserveBudget({ reservation: reservation("p1"), units: 1 })),
    rejected(new RunNotRunning({ status: "awaiting-child" })),
    view(SessionRuns, session, {
      runs: [
        { run: RunId.make("run_1"), previous: null, parent: null, status: "awaiting-child" },
        { run: RunId.make("run_child"), previous: null, parent: RunId.make("run_1"), status: "running" },
      ],
    }),
  );
});

it.effect("a run at its history bound continues as a new run, and the session's chain shows both", () => {
  const next = AgentRun.ref("run_1~1");
  const nextSource = GrantRef.make({ grant: GrantId.make("g_req"), delegation: DelegationId.make("dlg:run_1") });
  const continueHop = hopOn("ContinueAtBound", "AgentRun/run_1", 5, "RunContinued");
  return story(
    ...active(100, 2),
    as(asRun("run_1", "dlg:run_1")),
    when(run1, new RecordStep({ step: "assess" })),
    then(run1, new StepRecorded({ session, step: "assess", count: 1, provenance: self("run_1", "dlg:run_1") })),
    when(run1, new RecordStep({ step: "propose" })),
    then(
      run1,
      new StepRecorded({ session, step: "propose", count: 2, provenance: self("run_1", "dlg:run_1") }),
      new RunContinued({
        session,
        next: RunId.make("run_1~1"),
        lineage: RunId.make("run_1"),
        generation: 1,
        remaining: 100,
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
      new ContinuationOpened({
        session,
        previous: RunId.make("run_1"),
        lineage: RunId.make("run_1"),
        generation: 1,
        purpose: "review",
        versions,
        allowance: 100,
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
        { run: RunId.make("run_1"), previous: null, parent: null, status: "continued" },
        { run: RunId.make("run_1~1"), previous: RunId.make("run_1"), parent: null, status: "running" },
      ],
    }),
  );
});
