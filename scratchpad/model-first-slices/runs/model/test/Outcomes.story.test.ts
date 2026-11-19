import { Story } from "@alchemy.run/domain/Story";
import { expect, it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { extend, type Invocation, provenanceOf } from "@proto/kernel/Invocation";
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
import { UsageExceedsReservation } from "@proto/runs-contract/Run/UsageExceedsReservation.rejection";
import { Authority, GrantDenied } from "@proto/runs-model/Authority.external";
import { OpenChildOnRequest } from "@proto/runs-model/Run/OpenChildOnRequest.policy";
import { RunsHandlers } from "@proto/runs-model/Runs.handlers";
import { RunsModel } from "@proto/runs-model/Runs.model";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { Cast } from "./Cast.ts";
import {
  buildersOf,
  childTerms,
  delegatedSource,
  delegationOf,
  parentTerms,
  requesterOf,
  runOf,
  sourceOf,
  strangerOf,
} from "./fixtures.ts";

// The outcomes the other stories leave unexecuted (`bun run outcomes`): each refusal a run
// command declares, from the side that meets it. Every story is a property over a generated cast
// (`Cast.ts`), at the default 100 runs.
const { call, fail, given, provide, rejected, state, then, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);
const story = Story.make(RunsModel, { layer: RunsHandlers, stub: [Authority] });

/** A run's allowance: one reservation's worth (what a call uses and what it does not) and what stays free beside it. */
const allowanceOf = ({ ledger }: Cast) => ledger.used + ledger.unused + ledger.free;

/** Every report a run makes on itself, about the cast's first reservation, step, outcome and child. */
const reportsOf = (cast: Cast) => {
  const [reservation] = cast.reservations;
  const { child } = cast.runs;
  return [
    SettleUsage.make({ reservation, units: cast.ledger.used }),
    ReleaseReservation.make({ reservation }),
    RecordStep.make({ step: A.headNonEmpty(cast.steps) }),
    AwaitApproval.make({}),
    CompleteRun.make({ outcome: cast.words.outcome }),
    ExhaustRun.make({}),
    DelegateRun.make({
      child,
      delegation: delegationOf(child),
      purpose: cast.purposes.child,
      allowance: cast.ledger.used,
      terms: parentTerms(cast),
    }),
  ] as const;
};

it.effect.prop("only the run reports on itself; a run that ended takes no more reports; a run exists once", [Cast], ([cast]) => {
  const { active, asRun, self } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const unknown = cast.reservations[4];
  const allowance = allowanceOf(cast);
  const reports = reportsOf(cast);
  return story(
    ...active(allowance),
    as(requesterOf(cast)),
    when(
      run,
      RequestRun.make({
        session: cast.session,
        purpose: cast.purposes.run,
        versions: cast.versions,
        allowance: cast.ledger.used,
        historyBound: cast.bound,
        source: sourceOf(cast),
        terms: parentTerms(cast),
      }),
    ),
    rejected(RunAlreadyExists.make({})),
    ...A.flatMap(reports, (report) => [when(run, report), rejected(NotThisRun.make({}))]),
    as(asRun(id)),
    when(run, SettleUsage.make({ reservation: unknown, units: cast.ledger.used })),
    rejected(UnknownReservation.make({ reservation: unknown })),
    when(run, ReleaseReservation.make({ reservation: unknown })),
    rejected(UnknownReservation.make({ reservation: unknown })),
    when(run, ExhaustRun.make({})),
    then(run, RunExhausted.make({ session: cast.session, remaining: allowance, provenance: self(id) })),
    ...A.flatMap(reports, (report) => [when(run, report), rejected(RunNotRunning.make({ status: "exhausted" }))]),
  );
});

it.effect.prop("a settlement never spends past its reservation: usage over what it holds is refused", [Cast], ([cast]) => {
  const { active, asRun, self } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const [reservation] = cast.reservations;
  const { used, unused, free, over } = cast.ledger;
  const held = used + unused;
  return story(
    ...active(allowanceOf(cast)),
    as(asRun(id)),
    when(run, ReserveBudget.make({ reservation, units: held })),
    then(run, BudgetReserved.make({ session: cast.session, reservation, units: held, remaining: free, provenance: self(id) })),
    when(run, SettleUsage.make({ reservation, units: held + over })),
    rejected(UsageExceedsReservation.make({ reservation, reserved: held, units: held + over })),
    // Nothing was spent: the reservation is still held in full.
    state(run, (current) => {
      expect(current).toMatchObject({ _tag: "Running", run: { budget: { reserved: held, spent: 0 }, reservations: [{ reservation, units: held }] } });
    }),
  );
});

it.effect.prop("only its requester or accountable human cancels a run, once", [Cast], ([cast]) => {
  const { active } = buildersOf(cast);
  const run = runOf(cast);
  const [taken, reason, again] = cast.words.reasons;
  return story(
    ...active(allowanceOf(cast)),
    as(strangerOf(cast)),
    when(run, CancelRun.make({ reason: taken })),
    rejected(NotRunOwner.make({})),
    as(requesterOf(cast)),
    when(run, CancelRun.make({ reason })),
    then(run, RunCancelled.make({ session: cast.session, reason, provenance: provenanceOf(requesterOf(cast)) })),
    when(run, CancelRun.make({ reason: again })),
    rejected(RunNotRunning.make({ status: "cancelled" })),
  );
});

it.effect.prop(
  "a request cancelled before its grant arrives is withdrawn: only its requester owns it, and it reads as cancelled",
  [Cast],
  ([cast]) => {
    const { requested } = buildersOf(cast);
    const run = runOf(cast);
    const [taken, reason, again] = cast.words.reasons;
    return story(
      given(run, requested(allowanceOf(cast))),
      as(strangerOf(cast)),
      when(run, CancelRun.make({ reason: taken })),
      rejected(NotRunOwner.make({})),
      as(requesterOf(cast)),
      when(run, CancelRun.make({ reason })),
      then(run, RunCancelled.make({ session: cast.session, reason, provenance: provenanceOf(requesterOf(cast)) })),
      state(run, (current) =>
        expect(current).toMatchObject({ _tag: "Withdrawn", reason, run: { requester: cast.principals.requester, parent: O.none() } }),
      ),
      when(run, CancelRun.make({ reason: again })),
      rejected(RunNotRunning.make({ status: "cancelled" })),
    );
  },
);

it.effect.prop("a child the authority context refuses returns its share to the parent", [Cast], ([cast]) => {
  const { active, asRun, self, hopOn } = buildersOf(cast);
  const { run: id, child } = cast.runs;
  const run = runOf(cast);
  const [reservation] = cast.reservations;
  const allowance = allowanceOf(cast);
  // The child's share: what one reservation would hold.
  const share = cast.ledger.used + cast.ledger.unused;
  const granted = childTerms(cast);
  return story(
    ...active(allowance),
    as(asRun(id)),
    when(
      run,
      DelegateRun.make({ child, delegation: delegationOf(child), purpose: cast.purposes.child, allowance: share, terms: granted }),
    ),
    then(
      run,
      ChildRequested.make({
        session: cast.session,
        child,
        delegation: delegationOf(child),
        purpose: cast.purposes.child,
        allowance: share,
        terms: granted,
        versions: cast.versions,
        historyBound: cast.bound,
        source: delegatedSource(cast),
        provenance: self(id),
      }),
    ),
    call(Authority.grantRun, { run: child }),
    fail(Authority.grantRun, GrantDenied.make({ reason: cast.words.denial })),
    then(
      run,
      ChildRunRefused.make({
        session: cast.session,
        child,
        allowance: share,
        reason: `grant:${cast.words.denial}`,
        provenance: extend(self(id), hopOn(OpenChildOnRequest.policyName, id, 3, ChildRequested)),
      }),
    ),
    // The share is back: the parent can reserve all of it.
    when(run, ReserveBudget.make({ reservation, units: allowance })),
    then(run, BudgetReserved.make({ session: cast.session, reservation, units: allowance, remaining: 0, provenance: self(id) })),
  );
});
