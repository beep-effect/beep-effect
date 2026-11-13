import { Story } from "@alchemy.run/domain/Story";
import { it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { DelegationId, GrantId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { extend, GrantRef, Invocation, provenanceOf, Root } from "@proto/kernel/Invocation";
import { AwaitApproval } from "@proto/runs-contract/Run/AwaitApproval.command";
import { CancelRun, NotRunOwner, RunCancelled } from "@proto/runs-contract/Run/CancelRun.command";
import { CompleteRun } from "@proto/runs-contract/Run/CompleteRun.command";
import { ChildRequested, DelegateRun } from "@proto/runs-contract/Run/DelegateRun.command";
import { ExhaustRun, RunExhausted } from "@proto/runs-contract/Run/ExhaustRun.command";
import { NotThisRun } from "@proto/runs-contract/Run/NotThisRun.rejection";
import { RecordStep } from "@proto/runs-contract/Run/RecordStep.command";
import { ChildRunRefused } from "@proto/runs-contract/Run/RefuseChild.command";
import { ReleaseReservation } from "@proto/runs-contract/Run/ReleaseReservation.command";
import { RequestRun, RunAlreadyExists } from "@proto/runs-contract/Run/RequestRun.command";
import { BudgetReserved, ReserveBudget } from "@proto/runs-contract/Run/ReserveBudget.command";
import { RunNotRunning } from "@proto/runs-contract/Run/RunNotRunning.rejection";
import { SettleUsage } from "@proto/runs-contract/Run/SettleUsage.command";
import { UnknownReservation } from "@proto/runs-contract/Run/UnknownReservation.rejection";
import { Authority, GrantDenied } from "@proto/runs-model/Authority.external";
import { RunsHandlers } from "@proto/runs-model/Runs.handlers";
import { RunsModel } from "@proto/runs-model/Runs.model";
import { active, asRun, hopOn, parentTerms, requester, reservation, run1, self, session, source, terms, versions } from "./fixtures.ts";

// The outcomes the other stories leave unexecuted (`bun run outcomes`): each refusal a run
// command declares, from the side that meets it.
const { call, fail, provide, rejected, then, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);
const story = Story.make(RunsModel, { layer: RunsHandlers, stub: [Authority] });
const asSelf = as(asRun("run_1", "dlg:run_1"));
const reports = [
  new SettleUsage({ reservation: reservation("r1"), units: 1 }),
  new ReleaseReservation({ reservation: reservation("r1") }),
  new RecordStep({ step: "x" }),
  new AwaitApproval(),
  new CompleteRun({ outcome: "x" }),
  new ExhaustRun(),
  new DelegateRun({ child: RunId.make("c"), delegation: DelegationId.make("d"), purpose: "p", allowance: 1, terms: parentTerms }),
] as const;

it.effect("only the run reports on itself; a run that ended takes no more reports; a run exists once", () =>
  story(
    ...active(100),
    as(requester),
    when(run1, new RequestRun({ session, purpose: "review", versions, allowance: 1, historyBound: 2, source, terms: parentTerms })),
    rejected(new RunAlreadyExists()),
    ...reports.flatMap((report) => [when(run1, report), rejected(new NotThisRun())]),
    asSelf,
    when(run1, new SettleUsage({ reservation: reservation("nope"), units: 1 })),
    rejected(new UnknownReservation({ reservation: reservation("nope") })),
    when(run1, new ReleaseReservation({ reservation: reservation("nope") })),
    rejected(new UnknownReservation({ reservation: reservation("nope") })),
    when(run1, new ExhaustRun()),
    then(run1, new RunExhausted({ session, remaining: 100, provenance: self("run_1", "dlg:run_1") })),
    ...reports.flatMap((report) => [when(run1, report), rejected(new RunNotRunning({ status: "exhausted" }))]),
  ),
);

it.effect("only its requester or accountable human cancels a run, once", () => {
  const stranger = Invocation.make({
    root: Root.cases.Human.make({ principal: PrincipalId.make("p_stranger") }),
    onBehalfOf: PrincipalId.make("p_stranger"),
    grants: [],
    chain: [],
  });
  return story(
    ...active(100),
    as(stranger),
    when(run1, new CancelRun({ reason: "mine now" })),
    rejected(new NotRunOwner()),
    as(requester),
    when(run1, new CancelRun({ reason: "no longer needed" })),
    then(run1, new RunCancelled({ session, reason: "no longer needed", provenance: provenanceOf(requester) })),
    when(run1, new CancelRun({ reason: "again" })),
    rejected(new RunNotRunning({ status: "cancelled" })),
  );
});

it.effect("a child the authority context refuses returns its share to the parent", () => {
  const childTerms = terms(["ProposeDisposition"]);
  const childSource = GrantRef.make({ grant: GrantId.make("g_req"), delegation: DelegationId.make("dlg:run_1") });
  const delegate = new DelegateRun({
    child: RunId.make("run_child"),
    delegation: DelegationId.make("dlg:run_child"),
    purpose: "sub-review",
    allowance: 30,
    terms: childTerms,
  });
  return story(
    ...active(100),
    asSelf,
    when(run1, delegate),
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
    call(Authority.grantRun, { run: RunId.make("run_child") }),
    fail(Authority.grantRun, new GrantDenied({ reason: "TermsWiden" })),
    then(
      run1,
      new ChildRunRefused({
        session,
        child: RunId.make("run_child"),
        allowance: 30,
        reason: "grant:TermsWiden",
        provenance: extend(self("run_1", "dlg:run_1"), hopOn("OpenChildOnRequest", "AgentRun/run_1", 3, "ChildRequested")),
      }),
    ),
    // The share is back: the parent can reserve all of it.
    when(run1, new ReserveBudget({ reservation: reservation("all"), units: 100 })),
    then(
      run1,
      new BudgetReserved({ session, reservation: reservation("all"), units: 100, remaining: 0, provenance: self("run_1", "dlg:run_1") }),
    ),
  );
});
