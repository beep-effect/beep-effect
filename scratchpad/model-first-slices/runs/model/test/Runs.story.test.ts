import { Story } from "@alchemy.run/domain/Story";
import { expect, it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { byProcess, Cause, extend, type Invocation, provenanceOf } from "@proto/kernel/Invocation";
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
import { ContinueAtBound } from "@proto/runs-model/Run/ContinueAtBound.policy";
import { GrantOnRequest } from "@proto/runs-model/Run/GrantOnRequest.policy";
import { OpenChildOnRequest } from "@proto/runs-model/Run/OpenChildOnRequest.policy";
import { ResumeParent } from "@proto/runs-model/Run/ResumeParent.policy";
import { SessionRuns } from "@proto/runs-model/Run/SessionRuns.view";
import { RunsHandlers } from "@proto/runs-model/Runs.handlers";
import { RunsModel } from "@proto/runs-model/Runs.model";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { Cast, nextOf } from "./Cast.ts";
import {
  buildersOf,
  childTerms,
  delegatedSource,
  delegationOf,
  parentTerms,
  requesterOf,
  runOf,
  sourceOf,
} from "./fixtures.ts";

const { call, fail, provide, rejected, replied, state, succeed, then, view, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(RunsModel, { layer: RunsHandlers, stub: [Authority] });

// Every story is a property over a generated cast (`Cast.ts`), at the default 100 runs. The
// amounts come from the cast's ledger: `used` is what a call uses, `unused` what its reservation
// held beyond that, `free` what stays free beside it, and `over` how far a refused request goes.

/** What one call's reservation holds: what it uses and what it does not. */
const heldOf = ({ ledger }: Cast) => ledger.used + ledger.unused;

/** A run's allowance: one reservation's worth and what stays free beside it. */
const allowanceOf = (cast: Cast) => heldOf(cast) + cast.ledger.free;

/** The child's share, its own allowance: one reservation's worth and what stays free beside it. */
const shareOf = allowanceOf;

/** A parent's allowance when it delegates: the child's share, and more beside it. */
const parentAllowanceOf = (cast: Cast) => shareOf(cast) + cast.ledger.over;

/** The parent delegates its child's share under the child's narrower terms, and the child opens under its own delegation. */
const childOpens = (cast: Cast) => {
  const { asRun, self, hopOn } = buildersOf(cast);
  const { run, child } = cast.runs;
  const share = shareOf(cast);
  const granted = childTerms(cast);
  const asChild = asRun(child, granted);
  return [
    as(asRun(run)),
    when(
      runOf(cast),
      DelegateRun.make({ child, delegation: delegationOf(child), purpose: cast.purposes.child, allowance: share, terms: granted }),
    ),
    then(
      runOf(cast),
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
        provenance: self(run),
      }),
    ),
    // The authority context delegates the parent's delegation, narrowed, to the child.
    call(Authority.grantRun, { run: child, source: delegatedSource(cast), delegation: delegationOf(child), terms: granted }),
    succeed(Authority.grantRun, {
      delegation: delegationOf(child),
      accountable: cast.principals.requester,
      provenance: provenanceOf(asChild),
    }),
    then(
      AgentRun.ref(child),
      ChildRunOpened.make({
        session: cast.session,
        parent: run,
        purpose: cast.purposes.child,
        versions: cast.versions,
        allowance: share,
        historyBound: cast.bound,
        source: delegatedSource(cast),
        terms: granted,
        delegation: delegationOf(child),
        accountable: cast.principals.requester,
        requester: cast.principals.requester,
        runProvenance: provenanceOf(asChild),
        provenance: extend(self(run), hopOn(OpenChildOnRequest.policyName, run, 3, ChildRequested)),
      }),
    ),
  ];
};

it.effect.prop("a person requests a run; the authority context grants its narrowed delegation and it starts", [Cast], ([cast]) => {
  const { asRun, self, hopOn, requested } = buildersOf(cast);
  const { run: id, stray } = cast.runs;
  const run = runOf(cast);
  const allowance = allowanceOf(cast);
  const request = RequestRun.make({
    session: cast.session,
    purpose: cast.purposes.run,
    versions: cast.versions,
    allowance,
    historyBound: cast.bound,
    source: sourceOf(cast),
    terms: parentTerms(cast),
  });
  return story(
    // A run starts a child with DelegateRun; only a person requests a top-level run.
    as(asRun(stray)),
    when(run, request),
    rejected(HumanOnly.make({})),
    as(requesterOf(cast)),
    when(run, request),
    then(run, requested(allowance)),
    call(Authority.grantRun, { run: id, source: sourceOf(cast), terms: parentTerms(cast), delegation: delegationOf(id) }),
    succeed(Authority.grantRun, {
      delegation: delegationOf(id),
      accountable: cast.principals.requester,
      provenance: self(id),
    }),
    then(
      run,
      RunActivated.make({
        session: cast.session,
        delegation: delegationOf(id),
        accountable: cast.principals.requester,
        runProvenance: self(id),
        provenance: extend(provenanceOf(requesterOf(cast)), hopOn(GrantOnRequest.policyName, id, 1, RunRequested)),
      }),
    ),
    state(run, (current) => {
      expect(current).toMatchObject({ _tag: "Running", run: { budget: { allowance, reserved: 0, spent: 0, allocated: 0 } } });
    }),
    view(SessionRuns, cast.session, { runs: [{ run: id, previous: O.none(), parent: O.none(), status: "running" }] }),
  );
});

it.effect.prop("a refused grant is recorded as the run's rejection", [Cast], ([cast]) => {
  const { hopOn, requested } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const allowance = allowanceOf(cast);
  return story(
    as(requesterOf(cast)),
    when(
      run,
      RequestRun.make({
        session: cast.session,
        purpose: cast.purposes.run,
        versions: cast.versions,
        allowance,
        historyBound: cast.bound,
        source: sourceOf(cast),
        terms: parentTerms(cast),
      }),
    ),
    then(run, requested(allowance)),
    call(Authority.grantRun, { run: id }),
    fail(Authority.grantRun, GrantDenied.make({ reason: cast.words.denial })),
    then(
      run,
      RunRejected.make({
        session: cast.session,
        reason: `grant:${cast.words.denial}`,
        released: 0,
        provenance: extend(provenanceOf(requesterOf(cast)), hopOn(GrantOnRequest.policyName, id, 1, RunRequested)),
      }),
    ),
    view(SessionRuns, cast.session, { runs: [{ run: id, previous: O.none(), parent: O.none(), status: "rejected" }] }),
  );
});

it.effect.prop("a run refused mid-run, its hop refused at re-admission, gives back what its open reservation held", [Cast], ([cast]) => {
  const { active, asRun, self } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const [reservation] = cast.reservations;
  const allowance = allowanceOf(cast);
  const held = heldOf(cast);
  const { refusal } = cast.words;
  return story(
    ...active(allowance),
    as(asRun(id)),
    when(run, ReserveBudget.make({ reservation, units: held })),
    then(run, BudgetReserved.make({ session: cast.session, reservation, units: held, remaining: cast.ledger.free, provenance: self(id) })),
    // The settle hop was refused, so the gateway records the refusal without re-admitting the run.
    when(run, RejectRun.make({ session: cast.session, reason: refusal, provenance: self(id) })),
    then(run, RunRejected.make({ session: cast.session, reason: refusal, released: held, provenance: self(id) })),
    state(run, (current) =>
      expect(current).toMatchObject({
        _tag: "Refused",
        reason: refusal,
        run: { budget: { allowance, reserved: 0, spent: 0 }, reservations: [] },
      }),
    ),
    // It takes no more reports, and reads as rejected.
    as(asRun(id)),
    when(run, ReleaseReservation.make({ reservation })),
    rejected(RunNotRunning.make({ status: "rejected" })),
    view(SessionRuns, cast.session, { runs: [{ run: id, previous: O.none(), parent: O.none(), status: "rejected" }] }),
  );
});

it.effect.prop("reservations never exceed what remains, so two reservations cannot spend one allowance", [Cast], ([cast]) => {
  const { active, asRun, self } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const [stray, first, second, third, fourth] = cast.reservations;
  const { used, free, over } = cast.ledger;
  const allowance = allowanceOf(cast);
  const held = heldOf(cast);
  // After the first settles, everything but what it used is left.
  const left = allowance - used;
  return story(
    ...active(allowance),
    // Only the run itself reports on the run.
    as(requesterOf(cast)),
    when(run, ReserveBudget.make({ reservation: stray, units: used })),
    rejected(NotThisRun.make({})),
    as(asRun(id)),
    when(run, ReserveBudget.make({ reservation: first, units: held })),
    then(run, BudgetReserved.make({ session: cast.session, reservation: first, units: held, remaining: free, provenance: self(id) })),
    // A second, parallel call would spend the same allowance: refused.
    when(run, ReserveBudget.make({ reservation: second, units: free + over })),
    rejected(BudgetExceeded.make({ requested: free + over, remaining: free })),
    // Settled at the usage reported: the unused part of the reservation returns.
    when(run, SettleUsage.make({ reservation: first, units: used })),
    then(
      run,
      UsageSettled.make({ session: cast.session, reservation: first, reserved: held, units: used, remaining: left, provenance: self(id) }),
    ),
    when(run, ReserveBudget.make({ reservation: third, units: left })),
    then(run, BudgetReserved.make({ session: cast.session, reservation: third, units: left, remaining: 0, provenance: self(id) })),
    // A failed call releases its reservation.
    when(run, ReleaseReservation.make({ reservation: third })),
    then(run, ReservationReleased.make({ session: cast.session, reservation: third, units: left, provenance: self(id) })),
    when(run, ReserveBudget.make({ reservation: fourth, units: left + over })),
    rejected(BudgetExceeded.make({ requested: left + over, remaining: left })),
    state(run, (current) => {
      expect(current).toMatchObject({ run: { budget: { allowance, reserved: 0, spent: used, allocated: 0 } } });
    }),
  );
});

it.effect.prop(
  "a parent gives a child a share of its budget and a narrower grant; the child cannot widen or overspend",
  [Cast],
  ([cast]) => {
    const { active, termsOf, asRun, self } = buildersOf(cast);
    const { run: id, child } = cast.runs;
    const run = runOf(cast);
    const childRun = AgentRun.ref(child);
    const [first, second] = cast.reservations;
    const { over } = cast.ledger;
    const allowance = parentAllowanceOf(cast);
    const share = shareOf(cast);
    const granted = childTerms(cast);
    const delegate = (units: number, terms: typeof granted) =>
      DelegateRun.make({ child, delegation: delegationOf(child), purpose: cast.purposes.child, allowance: units, terms });
    return story(
      ...active(allowance),
      as(asRun(id)),
      when(run, delegate(share, termsOf(O.none()))),
      rejected(ChildGrantWidens.make({ dimension: "operations" })),
      when(run, delegate(allowance + over, granted)),
      rejected(BudgetExceeded.make({ requested: allowance + over, remaining: allowance })),
      ...childOpens(cast),
      // The child's share came out of the parent's budget; the parent waits.
      state(run, (current) => {
        expect(current).toMatchObject({ _tag: "AwaitingChild", run: { budget: { allowance, allocated: share } } });
      }),
      as(asRun(child, granted)),
      when(childRun, ReserveBudget.make({ reservation: first, units: share + over })),
      rejected(BudgetExceeded.make({ requested: share + over, remaining: share })),
      when(childRun, ReserveBudget.make({ reservation: first, units: share })),
      then(
        childRun,
        BudgetReserved.make({ session: cast.session, reservation: first, units: share, remaining: 0, provenance: self(child, granted) }),
      ),
      as(asRun(id)),
      when(run, ReserveBudget.make({ reservation: second, units: over })),
      rejected(RunNotRunning.make({ status: "awaiting-child" })),
      view(SessionRuns, cast.session, {
        runs: [
          { run: id, previous: O.none(), parent: O.none(), status: "awaiting-child" },
          { run: child, previous: O.none(), parent: O.some(id), status: "running" },
        ],
      }),
    );
  },
);

it.effect.prop("a run at its history bound continues as a new run, and the session's chain shows both", [Cast], ([cast]) => {
  const { active, asRun, self, hopOn } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const next = nextOf(id);
  const allowance = allowanceOf(cast);
  const bound = A.length(cast.steps);
  // The continuation follows the request, the grant and one step for each place up to the bound.
  const continueHop = hopOn(ContinueAtBound.policyName, id, 2 + bound + 1, RunContinued);
  const steps = A.flatMap(cast.steps, (step, index) => {
    const recorded = StepRecorded.make({ session: cast.session, step, count: index + 1, provenance: self(id) });
    return [
      when(run, RecordStep.make({ step })),
      index + 1 < bound
        ? then(run, recorded)
        : then(
            run,
            recorded,
            RunContinued.make({
              session: cast.session,
              next,
              lineage: id,
              generation: 1,
              parent: O.none(),
              remaining: allowance,
              reservations: [],
              purpose: cast.purposes.run,
              versions: cast.versions,
              historyBound: bound,
              source: delegatedSource(cast),
              terms: parentTerms(cast),
              requester: cast.principals.requester,
              provenance: self(id),
            }),
          ),
    ];
  });
  return story(
    ...active(allowance, bound),
    as(asRun(id)),
    ...steps,
    call(Authority.grantRun, { run: next, source: delegatedSource(cast), delegation: delegationOf(next), terms: parentTerms(cast) }),
    succeed(Authority.grantRun, { delegation: delegationOf(next), accountable: cast.principals.requester, provenance: self(next) }),
    then(
      AgentRun.ref(next),
      ContinuationOpened.make({
        session: cast.session,
        previous: id,
        lineage: id,
        generation: 1,
        parent: O.none(),
        purpose: cast.purposes.run,
        versions: cast.versions,
        allowance,
        reservations: [],
        historyBound: bound,
        source: delegatedSource(cast),
        terms: parentTerms(cast),
        delegation: delegationOf(next),
        accountable: cast.principals.requester,
        requester: cast.principals.requester,
        runProvenance: self(next),
        provenance: extend(self(id), continueHop),
      }),
    ),
    state(run, { _tag: "Continued", next }),
    view(SessionRuns, cast.session, {
      runs: [
        { run: id, previous: O.none(), parent: O.none(), status: "continued" },
        { run: next, previous: O.some(id), parent: O.none(), status: "running" },
      ],
    }),
  );
});

it.effect.prop("completing a run releases its open reservations, so a finished run holds no budget", [Cast], ([cast]) => {
  const { active, asRun, self } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const [reservation] = cast.reservations;
  const allowance = allowanceOf(cast);
  const held = heldOf(cast);
  const { outcome } = cast.words;
  return story(
    ...active(allowance),
    as(asRun(id)),
    when(run, ReserveBudget.make({ reservation, units: held })),
    then(run, BudgetReserved.make({ session: cast.session, reservation, units: held, remaining: cast.ledger.free, provenance: self(id) })),
    when(run, CompleteRun.make({ outcome })),
    then(run, RunCompleted.make({ session: cast.session, outcome, released: held, provenance: self(id) })),
    state(run, (current) => {
      expect(current).toMatchObject({
        _tag: "Completed",
        run: { budget: { allowance, reserved: 0, spent: 0 }, reservations: [] },
      });
    }),
  );
});

it.effect.prop("a child that finishes resumes its parent, which keeps what the child did not spend", [Cast], ([cast]) => {
  const { active, asRun, self, hopOn } = buildersOf(cast);
  const { run: id, child } = cast.runs;
  const run = runOf(cast);
  const childRun = AgentRun.ref(child);
  const [first, second] = cast.reservations;
  const { used, unused, free } = cast.ledger;
  const allowance = parentAllowanceOf(cast);
  const share = shareOf(cast);
  const held = heldOf(cast);
  const { outcome } = cast.words;
  const asChild = asRun(child, childTerms(cast));
  return story(
    ...active(allowance),
    ...childOpens(cast),
    as(asChild),
    when(childRun, ReserveBudget.make({ reservation: first, units: held })),
    then(childRun, BudgetReserved.make({ session: cast.session, reservation: first, units: held, remaining: free, provenance: provenanceOf(asChild) })),
    when(childRun, SettleUsage.make({ reservation: first, units: used })),
    then(
      childRun,
      UsageSettled.make({
        session: cast.session,
        reservation: first,
        reserved: held,
        units: used,
        remaining: unused + free,
        provenance: provenanceOf(asChild),
      }),
    ),
    when(childRun, CompleteRun.make({ outcome })),
    then(childRun, RunCompleted.make({ session: cast.session, outcome, released: 0, provenance: provenanceOf(asChild) })),
    // The policy reads the finished child and tells its parent: all but what it used of its share come back.
    then(
      run,
      ChildRunFinished.make({
        session: cast.session,
        child,
        allowance: share,
        spent: used,
        outcome,
        provenance: extend(provenanceOf(asChild), hopOn(ResumeParent.policyName, child, 4, RunCompleted)),
      }),
    ),
    state(run, (current) => {
      expect(current).toMatchObject({ _tag: "Running", run: { budget: { allowance, allocated: 0, spent: used } } });
    }),
    as(asRun(id)),
    when(run, ReserveBudget.make({ reservation: second, units: allowance - used })),
    then(
      run,
      BudgetReserved.make({ session: cast.session, reservation: second, units: allowance - used, remaining: 0, provenance: self(id) }),
    ),
  );
});

it.effect.prop("a child that runs out of budget is exhausted, and its parent resumes with what the child left", [Cast], ([cast]) => {
  const { active, asRun, self, hopOn } = buildersOf(cast);
  const { run: id, child } = cast.runs;
  const run = runOf(cast);
  const childRun = AgentRun.ref(child);
  const [first, second, third] = cast.reservations;
  const { used, unused, free, over } = cast.ledger;
  const allowance = parentAllowanceOf(cast);
  const share = shareOf(cast);
  const held = heldOf(cast);
  const left = unused + free;
  const asChild = asRun(child, childTerms(cast));
  return story(
    ...active(allowance),
    ...childOpens(cast),
    as(asChild),
    when(childRun, ReserveBudget.make({ reservation: first, units: held })),
    then(childRun, BudgetReserved.make({ session: cast.session, reservation: first, units: held, remaining: free, provenance: provenanceOf(asChild) })),
    when(childRun, SettleUsage.make({ reservation: first, units: used })),
    then(
      childRun,
      UsageSettled.make({ session: cast.session, reservation: first, reserved: held, units: used, remaining: left, provenance: provenanceOf(asChild) }),
    ),
    // The next call needs more than is left: the child's executor ends it as exhausted.
    when(childRun, ReserveBudget.make({ reservation: second, units: left + over })),
    rejected(BudgetExceeded.make({ requested: left + over, remaining: left })),
    when(childRun, ExhaustRun.make({})),
    then(childRun, RunExhausted.make({ session: cast.session, remaining: left, provenance: provenanceOf(asChild) })),
    // The policy reads the finished child and tells its parent: what the child left comes back.
    then(
      run,
      ChildRunFinished.make({
        session: cast.session,
        child,
        allowance: share,
        spent: used,
        outcome: RunExhausted.tag,
        provenance: extend(provenanceOf(asChild), hopOn(ResumeParent.policyName, child, 4, RunExhausted)),
      }),
    ),
    state(run, (current) => {
      expect(current).toMatchObject({ _tag: "Running", run: { budget: { allowance, allocated: 0, spent: used } } });
    }),
    as(asRun(id)),
    when(run, ReserveBudget.make({ reservation: third, units: allowance - used })),
    then(
      run,
      BudgetReserved.make({ session: cast.session, reservation: third, units: allowance - used, remaining: 0, provenance: self(id) }),
    ),
  );
});

it.effect.prop("a child refused mid-run gives back its reservation and resumes its parent, which keeps the child's share", [Cast], ([cast]) => {
  const { active, asRun, hopOn } = buildersOf(cast);
  const { child } = cast.runs;
  const run = runOf(cast);
  const childRun = AgentRun.ref(child);
  const [reservation] = cast.reservations;
  const allowance = parentAllowanceOf(cast);
  const share = shareOf(cast);
  const held = heldOf(cast);
  const { refusal } = cast.words;
  const asChild = asRun(child, childTerms(cast));
  return story(
    ...active(allowance),
    ...childOpens(cast),
    as(asChild),
    when(childRun, ReserveBudget.make({ reservation, units: held })),
    then(
      childRun,
      BudgetReserved.make({ session: cast.session, reservation, units: held, remaining: cast.ledger.free, provenance: provenanceOf(asChild) }),
    ),
    // The child's next hop was refused at re-admission: the refusal is recorded without re-admitting it.
    when(childRun, RejectRun.make({ session: cast.session, reason: refusal, provenance: provenanceOf(asChild) })),
    then(childRun, RunRejected.make({ session: cast.session, reason: refusal, released: held, provenance: provenanceOf(asChild) })),
    // The policy reads the refused child and tells its parent: it spent nothing, so its whole share comes back.
    then(
      run,
      ChildRunFinished.make({
        session: cast.session,
        child,
        allowance: share,
        spent: 0,
        outcome: RunRejected.tag,
        provenance: extend(provenanceOf(asChild), hopOn(ResumeParent.policyName, child, 3, RunRejected)),
      }),
    ),
    state(run, (current) => {
      expect(current).toMatchObject({ _tag: "Running", run: { budget: { allowance, allocated: 0, spent: 0 } } });
    }),
  );
});

it.effect.prop("a fact that decided the run's subject concludes it under its own provenance, once", [Cast], ([cast]) => {
  const { active, asRun, self } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const [reservation] = cast.reservations;
  const allowance = allowanceOf(cast);
  const held = heldOf(cast);
  const { outcome } = cast.words;
  const { process, producer, contract, version, fact } = cast.fact;
  const factHop = byProcess(process, Cause.cases.Fact.make({ producer, contract, version, fact }));
  return story(
    ...active(allowance),
    as(asRun(id)),
    when(run, ReserveBudget.make({ reservation, units: held })),
    then(run, BudgetReserved.make({ session: cast.session, reservation, units: held, remaining: cast.ledger.free, provenance: self(id) })),
    when(run, AwaitApproval.make({})),
    then(run, RunAwaitingApproval.make({ session: cast.session, provenance: self(id) })),
    when(run, ConcludeRun.make({ outcome, hop: factHop })),
    then(run, RunCompleted.make({ session: cast.session, outcome, released: held, provenance: extend(self(id), factHop) })),
    // The same fact again finds the run finished and records nothing.
    when(run, ConcludeRun.make({ outcome, hop: factHop })),
    then(run),
    state(run, (current) => {
      expect(current).toMatchObject({ _tag: "Completed", outcome, run: { budget: { reserved: 0 } } });
    }),
  );
});

// Idempotency (D14), pinned as the library behaves today: the receipt is looked up by command
// id before the command is decoded, authorized or decided (InMemory.ts:646-650).
it.effect.prop("a reused command id with the same payload returns the first receipt and records nothing", [Cast], ([cast]) => {
  const { active, asRun, self } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const [reservation] = cast.reservations;
  const held = heldOf(cast);
  const { free } = cast.ledger;
  const reserve = ReserveBudget.make({ reservation, units: held });
  return story(
    ...active(allowanceOf(cast)),
    as(asRun(id)),
    when(run, reserve, { commandId: cast.commandId }),
    then(run, BudgetReserved.make({ session: cast.session, reservation, units: held, remaining: free, provenance: self(id) })),
    replied({ remaining: free }),
    when(run, reserve, { commandId: cast.commandId }),
    then(run),
    replied({ remaining: free }),
  );
});

it.effect.prop("PINNED HAZARD: a reused command id with a different payload returns the first request's receipt", [Cast], ([cast]) => {
  const { active, asRun, self } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const [first, second] = cast.reservations;
  const held = heldOf(cast);
  const { free, over } = cast.ledger;
  return story(
    ...active(allowanceOf(cast)),
    as(asRun(id)),
    when(run, ReserveBudget.make({ reservation: first, units: held }), { commandId: cast.commandId }),
    then(run, BudgetReserved.make({ session: cast.session, reservation: first, units: held, remaining: free, provenance: self(id) })),
    replied({ remaining: free }),
    // A different reservation under the same id: not decided, not refused, answered with the old reply.
    when(run, ReserveBudget.make({ reservation: second, units: over }), { commandId: cast.commandId }),
    then(run),
    replied({ remaining: free }),
    state(run, (current) => {
      expect(current).toMatchObject({ run: { reservations: [{ reservation: first, units: held }] } });
    }),
  );
});

it.effect.prop("PINNED HAZARD: a caller without the grant, reusing the id, receives the stored result", [Cast], ([cast]) => {
  const { active, asRun, self } = buildersOf(cast);
  const { run: id } = cast.runs;
  const run = runOf(cast);
  const [first, , third] = cast.reservations;
  const held = heldOf(cast);
  const { free, used } = cast.ledger;
  const reserve = ReserveBudget.make({ reservation: first, units: held });
  return story(
    ...active(allowanceOf(cast)),
    as(asRun(id)),
    when(run, reserve, { commandId: cast.commandId }),
    then(run, BudgetReserved.make({ session: cast.session, reservation: first, units: held, remaining: free, provenance: self(id) })),
    replied({ remaining: free }),
    // The requester is not the run, so a fresh id is refused ...
    as(requesterOf(cast)),
    when(run, ReserveBudget.make({ reservation: third, units: used })),
    rejected(NotThisRun.make({})),
    // ... but the reused id is answered from the receipt, before any check runs.
    when(run, reserve, { commandId: cast.commandId }),
    then(run),
    replied({ remaining: free }),
  );
});
