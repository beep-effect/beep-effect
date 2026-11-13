import * as Domain from "@alchemy.run/domain";
import { GrantTerms, widens } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { DelegationId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { GrantRef, type Invocation, Provenance, provenanceOf, Root, runOf } from "@proto/kernel/Invocation";
import { ActivateRun, RunActivated } from "@proto/runs-contract/Run/ActivateRun.command";
import { AwaitApproval, RunAwaitingApproval } from "@proto/runs-contract/Run/AwaitApproval.command";
import { BudgetExceeded } from "@proto/runs-contract/Run/BudgetExceeded.rejection";
import { CancelRun, NotRunOwner, RunCancelled } from "@proto/runs-contract/Run/CancelRun.command";
import { CompleteRun, RunCompleted } from "@proto/runs-contract/Run/CompleteRun.command";
import { ChildGrantWidens, ChildRequested, DelegateRun } from "@proto/runs-contract/Run/DelegateRun.command";
import { ExhaustRun, RunExhausted } from "@proto/runs-contract/Run/ExhaustRun.command";
import { NotThisRun } from "@proto/runs-contract/Run/NotThisRun.rejection";
import { ChildRunOpened, OpenChildRun } from "@proto/runs-contract/Run/OpenChildRun.command";
import { ContinuationOpened, OpenContinuation } from "@proto/runs-contract/Run/OpenContinuation.command";
import { RecordStep, RunContinued, StepRecorded } from "@proto/runs-contract/Run/RecordStep.command";
import { ChildRunRefused, RefuseChild } from "@proto/runs-contract/Run/RefuseChild.command";
import { RejectRun, RunRejected } from "@proto/runs-contract/Run/RejectRun.command";
import { ReleaseReservation, ReservationReleased } from "@proto/runs-contract/Run/ReleaseReservation.command";
import { RequestRun, RunAlreadyExists, HumanOnly, RunRequested } from "@proto/runs-contract/Run/RequestRun.command";
import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
import { BudgetReserved, ReserveBudget } from "@proto/runs-contract/Run/ReserveBudget.command";
import { RunNotRunning } from "@proto/runs-contract/Run/RunNotRunning.rejection";
import type { RunStatus } from "@proto/runs-contract/Run/RunStatus";
import { RunVersions } from "@proto/runs-contract/Run/RunVersions";
import { SessionId } from "@proto/runs-contract/Run/Session.id";
import { SettleUsage, UsageSettled } from "@proto/runs-contract/Run/SettleUsage.command";
import { UnknownReservation } from "@proto/runs-contract/Run/UnknownReservation.rejection";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";

/**
 * A run's budget, in units: what it was allowed, what is held by open
 * reservations, what it spent, and what it set aside for children.
 *
 * @category models
 * @since 0.0.0
 */
export const Budget = S.Struct({ allowance: S.Int, reserved: S.Int, spent: S.Int, allocated: S.Int });
/**
 * @category models
 * @since 0.0.0
 */
export type Budget = typeof Budget.Type;

/**
 * What every run records, whatever its state: its session and lineage, what
 * it is for and was made with, who asked and who answers, its grant, the
 * provenance it acts under, its budget and open reservations, and how far
 * it is from its history bound.
 *
 * @category models
 * @since 0.0.0
 */
export const RunRecord = S.Struct({
  session: SessionId,
  lineage: RunId,
  generation: S.Int,
  parent: S.NullOr(RunId),
  previous: S.NullOr(RunId),
  purpose: S.String,
  versions: RunVersions,
  requester: PrincipalId,
  accountable: S.NullOr(PrincipalId),
  source: GrantRef,
  terms: GrantTerms,
  delegation: S.NullOr(DelegationId),
  provenance: S.NullOr(Provenance),
  budget: Budget,
  reservations: S.Array(S.Struct({ reservation: ReservationId, units: S.Int })),
  steps: S.Int,
  historyBound: S.Int,
});
/**
 * @category models
 * @since 0.0.0
 */
export type RunRecord = typeof RunRecord.Type;

/**
 * A run's lifecycle (D6, D23). `Requested` waits for its grant; the four
 * terminal-or-waiting states keep the record so a read can still show it.
 *
 * @category models
 * @since 0.0.0
 */
export const AgentRunState = S.TaggedUnion({
  Unrequested: {},
  Requested: { run: RunRecord },
  Running: { run: RunRecord },
  AwaitingApproval: { run: RunRecord },
  AwaitingChild: { run: RunRecord, child: RunId, allowance: S.Int },
  Completed: { run: RunRecord, outcome: S.String },
  Rejected: { session: SessionId, reason: S.String },
  Cancelled: { run: RunRecord, reason: S.String },
  Exhausted: { run: RunRecord },
  Continued: { run: RunRecord, next: RunId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type AgentRunState = typeof AgentRunState.Type;

/** What remains to reserve or allocate. */
export const remaining = (budget: Budget): number => budget.allowance - budget.reserved - budget.spent - budget.allocated;

const statusOf = (state: AgentRunState): RunStatus =>
  AgentRunState.match(state, {
    Unrequested: () => "unrequested" as const,
    Requested: () => "requested" as const,
    Running: () => "running" as const,
    AwaitingApproval: () => "awaiting-approval" as const,
    AwaitingChild: () => "awaiting-child" as const,
    Completed: () => "completed" as const,
    Rejected: () => "rejected" as const,
    Cancelled: () => "cancelled" as const,
    Exhausted: () => "exhausted" as const,
    Continued: () => "continued" as const,
  });

const requireRunning = (state: AgentRunState): Effect.Effect<RunRecord, RunNotRunning> =>
  Match.value(state).pipe(
    Match.tag("Running", ({ run }) => Effect.succeed(run)),
    Match.orElse((other) => Effect.fail(new RunNotRunning({ status: statusOf(other) }))),
  );

/** Only the run itself, re-admitted under its own delegation, reports on it. */
const requireSelf = (id: RunId): Effect.Effect<Invocation, NotThisRun, CurrentInvocation> =>
  Effect.filterOrFail(
    Effect.service(CurrentInvocation),
    (invocation) => O.contains(runOf(invocation), id),
    () => new NotThisRun(),
  );

const reservationOf = (run: RunRecord, reservation: ReservationId) =>
  A.findFirst(run.reservations, (held) => held.reservation === reservation);

const mapRun = (state: AgentRunState, f: (run: RunRecord) => RunRecord): AgentRunState =>
  AgentRunState.matchOrElse(
    state,
    {
      Requested: (s): AgentRunState => ({ ...s, run: f(s.run) }),
      Running: (s): AgentRunState => ({ ...s, run: f(s.run) }),
      AwaitingApproval: (s): AgentRunState => ({ ...s, run: f(s.run) }),
      AwaitingChild: (s): AgentRunState => ({ ...s, run: f(s.run) }),
    },
    identity,
  );

const withBudget = (run: RunRecord, budget: Partial<Budget>): RunRecord => ({ ...run, budget: { ...run.budget, ...budget } });

const recordOf = (state: AgentRunState): O.Option<RunRecord> =>
  AgentRunState.match(state, {
    Unrequested: () => O.none(),
    Rejected: () => O.none(),
    Requested: ({ run }) => O.some(run),
    Running: ({ run }) => O.some(run),
    AwaitingApproval: ({ run }) => O.some(run),
    AwaitingChild: ({ run }) => O.some(run),
    Completed: ({ run }) => O.some(run),
    Cancelled: ({ run }) => O.some(run),
    Exhausted: ({ run }) => O.some(run),
    Continued: ({ run }) => O.some(run),
  });

/**
 * The session a run belongs to, from any state that knows it.
 *
 * @category getters
 * @since 0.0.0
 */
export const sessionOf = (state: AgentRunState): O.Option<SessionId> =>
  AgentRunState.guards.Rejected(state) ? O.some(state.session) : O.map(recordOf(state), (run) => run.session);

/**
 * One agent run: the system of record for a bounded piece of work (D6). It
 * owns its lifecycle, lineage, grant, budget ledger and history bound; an
 * executor in a product context reports to it as the run.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class AgentRun extends Domain.Aggregate(
  "AgentRun",
  {
    id: RunId,
    state: AgentRunState,
    initial: { _tag: "Unrequested" },
    commands: [
      RequestRun,
      ActivateRun,
      RejectRun,
      ReserveBudget,
      SettleUsage,
      ReleaseReservation,
      RecordStep,
      AwaitApproval,
      CompleteRun,
      ExhaustRun,
      CancelRun,
      DelegateRun,
      OpenChildRun,
      RefuseChild,
      OpenContinuation,
    ],
    decide: {
      RequestRun: Effect.fn(function* (state, command) {
        const invocation = yield* CurrentInvocation;
        if (!Root.guards.Human(invocation.root)) return yield* new HumanOnly();
        if (state._tag !== "Unrequested") return yield* new RunAlreadyExists();
        return [
          new RunRequested({
            session: command.session,
            purpose: command.purpose,
            versions: command.versions,
            allowance: command.allowance,
            historyBound: command.historyBound,
            source: command.source,
            terms: command.terms,
            requester: invocation.root.principal,
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      // Internal: the runs model's own policy sends these with the provenance it acted on.
      ActivateRun: (state, command) =>
        state._tag !== "Requested"
          ? []
          : [
              new RunActivated({
                session: state.run.session,
                delegation: command.delegation,
                accountable: command.accountable,
                runProvenance: command.runProvenance,
                provenance: command.provenance,
              }),
            ],
      RejectRun: (_, command) => [
        new RunRejected({ session: command.session, reason: command.reason, provenance: command.provenance }),
      ],

      ReserveBudget: Effect.fn(function* (state, command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        // A redelivered reservation is the same reservation.
        if (O.isSome(reservationOf(run, command.reservation))) return [];
        const left = remaining(run.budget);
        if (command.units > left) return yield* new BudgetExceeded({ requested: command.units, remaining: left });
        return [
          new BudgetReserved({
            session: run.session,
            reservation: command.reservation,
            units: command.units,
            remaining: left - command.units,
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      SettleUsage: Effect.fn(function* (state, command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        const held = yield* Effect.fromOption(reservationOf(run, command.reservation)).pipe(
          Effect.mapError(() => new UnknownReservation({ reservation: command.reservation })),
        );
        const after = withBudget(run, {
          reserved: run.budget.reserved - held.units,
          spent: run.budget.spent + command.units,
        });
        return [
          new UsageSettled({
            session: run.session,
            reservation: command.reservation,
            reserved: held.units,
            units: command.units,
            remaining: remaining(after.budget),
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      ReleaseReservation: Effect.fn(function* (state, command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        const held = yield* Effect.fromOption(reservationOf(run, command.reservation)).pipe(
          Effect.mapError(() => new UnknownReservation({ reservation: command.reservation })),
        );
        return [
          new ReservationReleased({
            session: run.session,
            reservation: command.reservation,
            units: held.units,
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      RecordStep: Effect.fn(function* (state, command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        const provenance = provenanceOf(invocation);
        const count = run.steps + 1;
        const step = new StepRecorded({ session: run.session, step: command.step, count, provenance });
        if (count < run.historyBound) return [step];
        // At the bound: continue as a new run that carries the work forward (D23).
        return [
          step,
          new RunContinued({
            session: run.session,
            next: RunId.make(`${run.lineage}~${run.generation + 1}`),
            lineage: run.lineage,
            generation: run.generation + 1,
            remaining: remaining(run.budget),
            purpose: run.purpose,
            versions: run.versions,
            historyBound: run.historyBound,
            source: GrantRef.make({ grant: run.source.grant, delegation: run.delegation }),
            terms: run.terms,
            requester: run.requester,
            provenance,
          }),
        ];
      }),

      AwaitApproval: Effect.fn(function* (state, _command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        return [new RunAwaitingApproval({ session: run.session, provenance: provenanceOf(invocation) })];
      }),

      CompleteRun: Effect.fn(function* (state, command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* Match.value(state).pipe(
          Match.tag("Running", "AwaitingApproval", "AwaitingChild", ({ run }) => Effect.succeed(run)),
          Match.orElse((other) => Effect.fail(new RunNotRunning({ status: statusOf(other) }))),
        );
        return [new RunCompleted({ session: run.session, outcome: command.outcome, provenance: provenanceOf(invocation) })];
      }),

      ExhaustRun: Effect.fn(function* (state, _command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        return [
          new RunExhausted({ session: run.session, remaining: remaining(run.budget), provenance: provenanceOf(invocation) }),
        ];
      }),

      CancelRun: Effect.fn(function* (state, command) {
        const invocation = yield* CurrentInvocation;
        const run = yield* Match.value(state).pipe(
          Match.tag("Requested", "Running", "AwaitingApproval", "AwaitingChild", ({ run }) => Effect.succeed(run)),
          Match.orElse((other) => Effect.fail(new RunNotRunning({ status: statusOf(other) }))),
        );
        const owns =
          Root.guards.Human(invocation.root) &&
          (invocation.root.principal === run.requester || invocation.root.principal === run.accountable);
        if (!owns) return yield* new NotRunOwner();
        return [new RunCancelled({ session: run.session, reason: command.reason, provenance: provenanceOf(invocation) })];
      }),

      DelegateRun: Effect.fn(function* (state, command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        const left = remaining(run.budget);
        if (command.allowance > left) return yield* new BudgetExceeded({ requested: command.allowance, remaining: left });
        const wider = widens(run.terms, command.terms);
        if (O.isSome(wider)) return yield* new ChildGrantWidens({ dimension: wider.value });
        return [
          new ChildRequested({
            session: run.session,
            child: command.child,
            delegation: command.delegation,
            purpose: command.purpose,
            allowance: command.allowance,
            terms: command.terms,
            versions: run.versions,
            historyBound: run.historyBound,
            source: GrantRef.make({ grant: run.source.grant, delegation: run.delegation }),
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      OpenChildRun: (state, command) =>
        state._tag !== "Unrequested"
          ? []
          : [
              new ChildRunOpened({
                session: command.session,
                parent: command.parent,
                purpose: command.purpose,
                versions: command.versions,
                allowance: command.allowance,
                historyBound: command.historyBound,
                source: command.source,
                terms: command.terms,
                delegation: command.delegation,
                accountable: command.accountable,
                requester: command.requester,
                runProvenance: command.runProvenance,
                provenance: command.provenance,
              }),
            ],

      RefuseChild: (state, command) =>
        state._tag !== "AwaitingChild" || state.child !== command.child
          ? []
          : [
              new ChildRunRefused({
                session: state.run.session,
                child: command.child,
                allowance: state.allowance,
                reason: command.reason,
                provenance: command.provenance,
              }),
            ],

      OpenContinuation: (state, command) =>
        state._tag !== "Unrequested"
          ? []
          : [
              new ContinuationOpened({
                session: command.session,
                previous: command.previous,
                lineage: command.lineage,
                generation: command.generation,
                purpose: command.purpose,
                versions: command.versions,
                allowance: command.allowance,
                historyBound: command.historyBound,
                source: command.source,
                terms: command.terms,
                delegation: command.delegation,
                accountable: command.accountable,
                requester: command.requester,
                runProvenance: command.runProvenance,
                provenance: command.provenance,
              }),
            ],
    },
    evolve: {
      RunRequested: (_, event, { id }) =>
        AgentRunState.cases.Requested.make({
          run: RunRecord.make({
            session: event.session,
            lineage: id,
            generation: 0,
            parent: null,
            previous: null,
            purpose: event.purpose,
            versions: event.versions,
            requester: event.requester,
            accountable: null,
            source: event.source,
            terms: event.terms,
            delegation: null,
            provenance: null,
            budget: { allowance: event.allowance, reserved: 0, spent: 0, allocated: 0 },
            reservations: [],
            steps: 0,
            historyBound: event.historyBound,
          }),
        }),
      RunActivated: (state, event) =>
        AgentRunState.matchOrElse(
          state,
          {
            Requested: ({ run }): AgentRunState =>
              AgentRunState.cases.Running.make({
                run: { ...run, delegation: event.delegation, accountable: event.accountable, provenance: event.runProvenance },
              }),
          },
          identity,
        ),
      RunRejected: (state, event) =>
        AgentRunState.cases.Rejected.make({
          session: O.match(recordOf(state), { onNone: () => event.session, onSome: (run) => run.session }),
          reason: event.reason,
        }),
      BudgetReserved: (state, event) =>
        mapRun(state, (run) => ({
          ...withBudget(run, { reserved: run.budget.reserved + event.units }),
          reservations: A.append(run.reservations, { reservation: event.reservation, units: event.units }),
        })),
      UsageSettled: (state, event) =>
        mapRun(state, (run) => ({
          ...withBudget(run, { reserved: run.budget.reserved - event.reserved, spent: run.budget.spent + event.units }),
          reservations: A.filter(run.reservations, (held) => held.reservation !== event.reservation),
        })),
      ReservationReleased: (state, event) =>
        mapRun(state, (run) => ({
          ...withBudget(run, { reserved: run.budget.reserved - event.units }),
          reservations: A.filter(run.reservations, (held) => held.reservation !== event.reservation),
        })),
      StepRecorded: (state, event) => mapRun(state, (run) => ({ ...run, steps: event.count })),
      RunContinued: (state, event) =>
        AgentRunState.matchOrElse(
          state,
          { Running: ({ run }): AgentRunState => AgentRunState.cases.Continued.make({ run, next: event.next }) },
          identity,
        ),
      RunAwaitingApproval: (state) =>
        AgentRunState.matchOrElse(
          state,
          { Running: ({ run }): AgentRunState => AgentRunState.cases.AwaitingApproval.make({ run }) },
          identity,
        ),
      RunCompleted: (state, event) =>
        O.match(recordOf(state), {
          onNone: () => state,
          onSome: (run) => AgentRunState.cases.Completed.make({ run, outcome: event.outcome }),
        }),
      RunExhausted: (state) =>
        AgentRunState.matchOrElse(
          state,
          { Running: ({ run }): AgentRunState => AgentRunState.cases.Exhausted.make({ run }) },
          identity,
        ),
      RunCancelled: (state, event) =>
        O.match(recordOf(state), {
          onNone: () => state,
          onSome: (run) => AgentRunState.cases.Cancelled.make({ run, reason: event.reason }),
        }),
      ChildRequested: (state, event) =>
        AgentRunState.matchOrElse(
          state,
          {
            Running: ({ run }): AgentRunState =>
              AgentRunState.cases.AwaitingChild.make({
                run: withBudget(run, { allocated: run.budget.allocated + event.allowance }),
                child: event.child,
                allowance: event.allowance,
              }),
          },
          identity,
        ),
      ChildRunOpened: (_, event, { id }) =>
        AgentRunState.cases.Running.make({
          run: RunRecord.make({
            session: event.session,
            lineage: id,
            generation: 0,
            parent: event.parent,
            previous: null,
            purpose: event.purpose,
            versions: event.versions,
            requester: event.requester,
            accountable: event.accountable,
            source: event.source,
            terms: event.terms,
            delegation: event.delegation,
            provenance: event.runProvenance,
            budget: { allowance: event.allowance, reserved: 0, spent: 0, allocated: 0 },
            reservations: [],
            steps: 0,
            historyBound: event.historyBound,
          }),
        }),
      ChildRunRefused: (state, event) =>
        AgentRunState.matchOrElse(
          state,
          {
            AwaitingChild: ({ run }): AgentRunState =>
              AgentRunState.cases.Running.make({
                run: withBudget(run, { allocated: run.budget.allocated - event.allowance }),
              }),
          },
          identity,
        ),
      ContinuationOpened: (_, event) =>
        AgentRunState.cases.Running.make({
          run: RunRecord.make({
            session: event.session,
            lineage: event.lineage,
            generation: event.generation,
            parent: null,
            previous: event.previous,
            purpose: event.purpose,
            versions: event.versions,
            requester: event.requester,
            accountable: event.accountable,
            source: event.source,
            terms: event.terms,
            delegation: event.delegation,
            provenance: event.runProvenance,
            budget: { allowance: event.allowance, reserved: 0, spent: 0, allocated: 0 },
            reservations: [],
            steps: 0,
            historyBound: event.historyBound,
          }),
        }),
    },
  },
  { description: "One agent run: its lifecycle, lineage, grant, budget ledger and history bound." },
) {}
