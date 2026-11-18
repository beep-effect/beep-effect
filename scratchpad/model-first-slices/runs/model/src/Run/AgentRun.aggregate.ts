import * as Domain from "@alchemy.run/domain";
import { GrantTerms, widens } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { DelegationId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { extend, GrantRef, type Invocation, Provenance, provenanceOf, Root, runOf } from "@proto/kernel/Invocation";
import { ActivateRun, RunActivated } from "@proto/runs-contract/Run/ActivateRun.command";
import { AwaitApproval, RunAwaitingApproval } from "@proto/runs-contract/Run/AwaitApproval.command";
import { BudgetExceeded } from "@proto/runs-contract/Run/BudgetExceeded.rejection";
import { CancelRun, NotRunOwner, RunCancelled } from "@proto/runs-contract/Run/CancelRun.command";
import { ChildFinished, ChildRunFinished } from "@proto/runs-contract/Run/ChildFinished.command";
import { CompleteRun, RunCompleted } from "@proto/runs-contract/Run/CompleteRun.command";
import { ConcludeRun } from "@proto/runs-contract/Run/ConcludeRun.command";
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
import { HeldReservation } from "@proto/runs-contract/Run/Reservation.id";
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
import * as Initial from "@proto/kernel/Initial";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Struct from "effect/Struct";
import { thunk0 } from "@beep/utils"

/**
 * A run's budget, in units: what it was allowed, what is held by open
 * reservations, what it spent, and what it set aside for children.
 *
 * @category models
 * @since 0.0.0
 */
export const Budget = S.Struct({
  allowance: S.Int,
  reserved: S.Int.pipe(Initial.of(0), S.annotateKey({ description: "Units held by open reservations; none at first." })),
  spent: S.Int.pipe(Initial.of(0), S.annotateKey({ description: "Units settled; none at first." })),
  allocated: S.Int.pipe(Initial.of(0), S.annotateKey({ description: "Units handed to child runs; none at first." })),
});
/**
 * @category models
 * @since 0.0.0
 */
export type Budget = typeof Budget.Type;

/**
 * What an active run records: its session and lineage (the run it continues
 * and its parent, each when it has one), what it is for and was made with,
 * who asked and who answers, its grant and the delegation the authority
 * context opened for it, the provenance it acts under, its budget and open
 * reservations, and how far it is from its history bound.
 *
 * **Details**
 *
 * The keys are stored in this order, as phases 2 to 6 stored them.
 *
 * @category models
 * @since 0.0.0
 */
export const RunRecord = S.Struct({
  session: SessionId,
  lineage: RunId,
  generation: S.Int,
  parent: S.OptionFromNullOr(RunId),
  previous: S.OptionFromNullOr(RunId),
  purpose: S.String,
  versions: RunVersions,
  requester: PrincipalId,
  accountable: PrincipalId,
  source: GrantRef,
  terms: GrantTerms,
  delegation: DelegationId,
  provenance: Provenance,
  budget: Budget,
  reservations: Initial.empty(HeldReservation).pipe(S.annotateKey({ description: "The reservations still open; none at first." })),
  steps: S.Int.pipe(Initial.of(0), S.annotateKey({ description: "Steps recorded so far; none at first." })),
  historyBound: S.Int,
});
/**
 * @category models
 * @since 0.0.0
 */
export type RunRecord = typeof RunRecord.Type;

/**
 * What a requested run records before its grant arrives: the active record
 * without the person who answers for it, its delegation or the provenance it
 * will act under, which the authority context supplies on activation.
 *
 * **Details**
 *
 * Phases 2 to 6 stored a requested run with those three keys as `null`; the
 * keys are ignored on read, so those states still decode.
 *
 * @category models
 * @since 0.0.0
 */
export const RunRequest = RunRecord.mapFields(Struct.omit(["accountable", "delegation", "provenance"]));
/**
 * @category models
 * @since 0.0.0
 */
export type RunRequest = typeof RunRequest.Type;

/**
 * A run's lifecycle (D6, D23). `Requested` waits for its grant and keeps
 * only the request; `Withdrawn` is a request cancelled before its grant
 * arrived, and `Rejected` one whose grant was refused. Every state after
 * activation keeps the active record, so a read can still show it;
 * `Refused` is an active run that could not continue because a hop was
 * refused, holding nothing open.
 *
 * @category models
 * @since 0.0.0
 */
export const AgentRunState = S.TaggedUnion({
  Unrequested: {},
  Requested: { run: RunRequest },
  Running: { run: RunRecord },
  AwaitingApproval: { run: RunRecord },
  AwaitingChild: { run: RunRecord, child: RunId, allowance: S.Int },
  Completed: { run: RunRecord, outcome: S.String },
  Rejected: { session: SessionId, reason: S.String },
  Refused: { run: RunRecord, reason: S.String },
  Withdrawn: { run: RunRequest, reason: S.String },
  Cancelled: { run: RunRecord, reason: S.String },
  Exhausted: { run: RunRecord },
  Continued: { run: RunRecord, next: RunId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type AgentRunState = typeof AgentRunState.Type;

/**
 * Phases 2 to 6 stored a request cancelled before its grant as `Cancelled`,
 * with `null` for the keys a request lacks. It reads as `Withdrawn` (D22).
 */
const CancelledBeforeGrant = S.TaggedStruct("Cancelled", {
  run: RunRequest.mapFields(Struct.assign({ accountable: S.Null, delegation: S.Null, provenance: S.Null })),
  reason: S.String,
}).pipe(
  S.decodeTo(
    S.toType(AgentRunState.cases.Withdrawn),
    SchemaTransformation.transform({
      decode: ({ run, reason }) =>
        AgentRunState.cases.Withdrawn.make({ run: Struct.omit(run, ["accountable", "delegation", "provenance"]), reason }),
      encode: ({ run, reason }) => ({
        _tag: "Cancelled" as const,
        run: { ...run, accountable: null, delegation: null, provenance: null },
        reason,
      }),
    }),
  ),
);

/**
 * How a run's state is stored: today's lifecycle, and the phase 2 to 6 form
 * of a request cancelled before its grant, which reads as `Withdrawn`.
 * Today's states are written in today's form.
 *
 * @category models
 * @since 0.0.0
 */
export const StoredAgentRunState = S.Union([AgentRunState, CancelledBeforeGrant]);

/** What remains to reserve or allocate. */
export const remaining = (budget: Budget): number => budget.allowance - budget.reserved - budget.spent - budget.allocated;

/**
 * What a finished run gives back: everything it neither spent nor passed to
 * a child, its open reservations included.
 *
 * @category getters
 * @since 0.0.0
 */
export const unspent = (budget: Budget): number => budget.allowance - budget.spent - budget.allocated;

const statusOf = (state: AgentRunState): RunStatus =>
  AgentRunState.match(state, {
    Unrequested: () => "unrequested" as const,
    Requested: () => "requested" as const,
    Running: () => "running" as const,
    AwaitingApproval: () => "awaiting-approval" as const,
    AwaitingChild: () => "awaiting-child" as const,
    Completed: () => "completed" as const,
    Rejected: () => "rejected" as const,
    Refused: () => "rejected" as const,
    Withdrawn: () => "cancelled" as const,
    Cancelled: () => "cancelled" as const,
    Exhausted: () => "exhausted" as const,
    Continued: () => "continued" as const,
  });

const requireRunning = (state: AgentRunState): Effect.Effect<RunRecord, RunNotRunning> =>
  Match.value(state).pipe(
    Match.tag("Running", ({ run }) => Effect.succeed(run)),
    Match.orElse((other) => Effect.fail(RunNotRunning.make({ status: statusOf(other) }))),
  );

/** Only the run itself, re-admitted under its own delegation, reports on it. */
const requireSelf = (id: RunId): Effect.Effect<Invocation, NotThisRun, CurrentInvocation> =>
  Effect.filterOrFail(
    Effect.service(CurrentInvocation),
    (invocation) => O.contains(runOf(invocation), id),
    () => NotThisRun.make({}),
  );

const reservationOf = (run: RunRecord, reservation: HeldReservation["reservation"]) =>
  A.findFirst(run.reservations, (held) => held.reservation === reservation);

const mapRun = (state: AgentRunState, f: <Run extends RunRequest>(run: Run) => Run): AgentRunState =>
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

const withBudget = <Run extends RunRequest>(run: Run, budget: Partial<Budget>): Run => ({
  ...run,
  budget: { ...run.budget, ...budget },
});

/** A finished run holds nothing open. */
const releaseAll = (run: RunRecord): RunRecord => ({ ...withBudget(run, { reserved: 0 }), reservations: [] });

/**
 * What a run in any state that keeps one was requested as: its lineage,
 * purpose, requester, grant and budget. An active record is also a request.
 *
 * @category getters
 * @since 0.0.0
 */
export const requestOf = (state: AgentRunState): O.Option<RunRequest> =>
  AgentRunState.match(state, {
    Unrequested: O.none<RunRequest>,
    Rejected: O.none<RunRequest>,
    Requested: ({ run }) => O.some(run),
    Withdrawn: ({ run }) => O.some(run),
    Refused: ({ run }) => O.some(run),
    Running: ({ run }) => O.some(run),
    AwaitingApproval: ({ run }) => O.some(run),
    AwaitingChild: ({ run }) => O.some(run),
    Completed: ({ run }) => O.some(run),
    Cancelled: ({ run }) => O.some(run),
    Exhausted: ({ run }) => O.some(run),
    Continued: ({ run }) => O.some(run),
  });

/**
 * The active record of a run that was granted and started, in any state
 * after activation; none before its grant arrived or when it never had one.
 *
 * @category getters
 * @since 0.0.0
 */
export const recordOf = (state: AgentRunState): O.Option<RunRecord> =>
  AgentRunState.match(state, {
    Unrequested: O.none<RunRecord>,
    Rejected: O.none<RunRecord>,
    Requested: O.none<RunRecord>,
    Withdrawn: O.none<RunRecord>,
    Refused: ({ run }) => O.some(run),
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
  AgentRunState.guards.Rejected(state) ? O.some(state.session) : O.map(requestOf(state), (run) => run.session);

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
    state: StoredAgentRunState,
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
      ConcludeRun,
      ChildFinished,
    ],
    decide: {
      RequestRun: Effect.fn(function* (state, command) {
        const invocation = yield* CurrentInvocation;
        if (!Root.guards.Human(invocation.root)) return yield* HumanOnly.make({});
        if (state._tag !== "Unrequested") return yield* RunAlreadyExists.make({});
        return [
          RunRequested.make({
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
              RunActivated.make({
                session: state.run.session,
                delegation: command.delegation,
                accountable: command.accountable,
                runProvenance: command.runProvenance,
                provenance: command.provenance,
              }),
            ],
      // A run refused mid-run gives back what its open reservations held.
      RejectRun: (state, command) => [
        RunRejected.make({
          session: command.session,
          reason: command.reason,
          released: Match.value(state).pipe(
            Match.tag("Running", "AwaitingApproval", "AwaitingChild", ({ run }) => run.budget.reserved),
            Match.orElse(thunk0),
          ),
          provenance: command.provenance,
        }),
      ],

      ReserveBudget: Effect.fn(function* (state, command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        // A redelivered reservation is the same reservation.
        if (O.isSome(reservationOf(run, command.reservation))) return [];
        const left = remaining(run.budget);
        if (command.units > left) return yield* BudgetExceeded.make({ requested: command.units, remaining: left });
        return [
          BudgetReserved.make({
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
          Effect.mapError(() => UnknownReservation.make({ reservation: command.reservation })),
        );
        const after = withBudget(run, {
          reserved: run.budget.reserved - held.units,
          spent: run.budget.spent + command.units,
        });
        return [
          UsageSettled.make({
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
          Effect.mapError(() => UnknownReservation.make({ reservation: command.reservation })),
        );
        return [
          ReservationReleased.make({
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
        const step = StepRecorded.make({ session: run.session, step: command.step, count, provenance });
        if (count < run.historyBound) return [step];
        // At the bound: continue as a new run that carries the work forward (D23).
        return [
          step,
          RunContinued.make({
            session: run.session,
            next: RunId.make(`${run.lineage}~${run.generation + 1}`),
            lineage: run.lineage,
            generation: run.generation + 1,
            parent: run.parent,
            remaining: remaining(run.budget),
            reservations: run.reservations,
            purpose: run.purpose,
            versions: run.versions,
            historyBound: run.historyBound,
            source: GrantRef.make({ grant: run.source.grant, delegation: O.some(run.delegation) }),
            terms: run.terms,
            requester: run.requester,
            provenance,
          }),
        ];
      }),

      AwaitApproval: Effect.fn(function* (state, _command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        return [RunAwaitingApproval.make({ session: run.session, provenance: provenanceOf(invocation) })];
      }),

      CompleteRun: Effect.fn(function* (state, command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* Match.value(state).pipe(
          Match.tag("Running", "AwaitingApproval", "AwaitingChild", ({ run }) => Effect.succeed(run)),
          Match.orElse((other) => Effect.fail(RunNotRunning.make({ status: statusOf(other) }))),
        );
        return [
          RunCompleted.make({
            session: run.session,
            outcome: command.outcome,
            released: run.budget.reserved,
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      ExhaustRun: Effect.fn(function* (state, _command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        return [
          RunExhausted.make({ session: run.session, remaining: remaining(run.budget), provenance: provenanceOf(invocation) }),
        ];
      }),

      CancelRun: Effect.fn(function* (state, command) {
        const invocation = yield* CurrentInvocation;
        const run = yield* Match.value(state).pipe(
          Match.tag("Requested", "Running", "AwaitingApproval", "AwaitingChild", ({ run }): Effect.Effect<RunRequest> =>
            Effect.succeed(run),
          ),
          Match.orElse((other) => Effect.fail(RunNotRunning.make({ status: statusOf(other) }))),
        );
        const { root } = invocation;
        // A requested run has no one answering for it yet: only its requester owns it.
        const owns =
          Root.guards.Human(root) &&
          (root.principal === run.requester || O.exists(recordOf(state), (active) => active.accountable === root.principal));
        if (!owns) return yield* NotRunOwner.make({});
        return [RunCancelled.make({ session: run.session, reason: command.reason, provenance: provenanceOf(invocation) })];
      }),

      DelegateRun: Effect.fn(function* (state, command, { id }) {
        const invocation = yield* requireSelf(id);
        const run = yield* requireRunning(state);
        const left = remaining(run.budget);
        if (command.allowance > left) return yield* BudgetExceeded.make({ requested: command.allowance, remaining: left });
        const wider = widens(run.terms, command.terms);
        if (O.isSome(wider)) return yield* ChildGrantWidens.make({ dimension: wider.value });
        return [
          ChildRequested.make({
            session: run.session,
            child: command.child,
            delegation: command.delegation,
            purpose: command.purpose,
            allowance: command.allowance,
            terms: command.terms,
            versions: run.versions,
            historyBound: run.historyBound,
            source: GrantRef.make({ grant: run.source.grant, delegation: O.some(run.delegation) }),
            provenance: provenanceOf(invocation),
          }),
        ];
      }),

      OpenChildRun: (state, command) =>
        state._tag !== "Unrequested"
          ? []
          : [
              ChildRunOpened.make({
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
              ChildRunRefused.make({
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
              ContinuationOpened.make({
                session: command.session,
                previous: command.previous,
                lineage: command.lineage,
                generation: command.generation,
                parent: command.parent,
                purpose: command.purpose,
                versions: command.versions,
                allowance: command.allowance,
                reservations: command.reservations,
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

      // Internal: the runs host's inbox sends it when a fact decided the run's subject.
      ConcludeRun: (state, command) =>
        Match.value(state).pipe(
          Match.tag("Running", "AwaitingApproval", "AwaitingChild", ({ run }) => [
            RunCompleted.make({
              session: run.session,
              outcome: command.outcome,
              released: run.budget.reserved,
              provenance: extend(run.provenance, command.hop),
            }),
          ]),
          Match.orElse(() => []),
        ),

      // Internal: the runs model's own policy sends it when a child's lineage finished.
      ChildFinished: (state, command) =>
        state._tag !== "AwaitingChild" || state.child !== command.child
          ? []
          : [
              ChildRunFinished.make({
                session: state.run.session,
                child: command.child,
                allowance: state.allowance,
                spent: state.allowance - command.returned,
                outcome: command.outcome,
                provenance: command.provenance,
              }),
            ],
    },
    evolve: {
      RunRequested: (_, event, { id }) =>
        AgentRunState.cases.Requested.make({
          run: RunRequest.make({
            session: event.session,
            lineage: id,
            generation: 0,
            parent: O.none(),
            previous: O.none(),
            purpose: event.purpose,
            versions: event.versions,
            requester: event.requester,
            source: event.source,
            terms: event.terms,
            budget: Budget.make({ allowance: event.allowance }),
            historyBound: event.historyBound,
          }),
        }),
      RunActivated: (state, event) =>
        AgentRunState.matchOrElse(
          state,
          {
            Requested: ({ run }): AgentRunState =>
              AgentRunState.cases.Running.make({
                run: RunRecord.make({
                  ...run,
                  accountable: event.accountable,
                  delegation: event.delegation,
                  provenance: event.runProvenance,
                }),
              }),
          },
          identity,
        ),
      RunRejected: (state, event) =>
        AgentRunState.matchOrElse(
          state,
          {
            Running: ({ run }): AgentRunState => AgentRunState.cases.Refused.make({ run: releaseAll(run), reason: event.reason }),
            AwaitingApproval: ({ run }): AgentRunState =>
              AgentRunState.cases.Refused.make({ run: releaseAll(run), reason: event.reason }),
            AwaitingChild: ({ run }): AgentRunState =>
              AgentRunState.cases.Refused.make({ run: releaseAll(run), reason: event.reason }),
          },
          (other): AgentRunState =>
            AgentRunState.cases.Rejected.make({
              session: O.match(requestOf(other), { onNone: () => event.session, onSome: (run) => run.session }),
              reason: event.reason,
            }),
        ),
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
          onSome: (run) => AgentRunState.cases.Completed.make({ run: releaseAll(run), outcome: event.outcome }),
        }),
      RunExhausted: (state) =>
        AgentRunState.matchOrElse(
          state,
          { Running: ({ run }): AgentRunState => AgentRunState.cases.Exhausted.make({ run }) },
          identity,
        ),
      RunCancelled: (state, event) =>
        AgentRunState.matchOrElse(
          state,
          {
            Requested: ({ run }): AgentRunState => AgentRunState.cases.Withdrawn.make({ run, reason: event.reason }),
            Running: ({ run }): AgentRunState => AgentRunState.cases.Cancelled.make({ run, reason: event.reason }),
            AwaitingApproval: ({ run }): AgentRunState => AgentRunState.cases.Cancelled.make({ run, reason: event.reason }),
            AwaitingChild: ({ run }): AgentRunState => AgentRunState.cases.Cancelled.make({ run, reason: event.reason }),
          },
          identity,
        ),
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
            parent: O.some(event.parent),
            previous: O.none(),
            purpose: event.purpose,
            versions: event.versions,
            requester: event.requester,
            accountable: event.accountable,
            source: event.source,
            terms: event.terms,
            delegation: event.delegation,
            provenance: event.runProvenance,
            budget: Budget.make({ allowance: event.allowance }),
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
      ChildRunFinished: (state, event) =>
        AgentRunState.matchOrElse(
          state,
          {
            AwaitingChild: ({ run }): AgentRunState =>
              AgentRunState.cases.Running.make({
                run: withBudget(run, {
                  allocated: run.budget.allocated - event.allowance,
                  spent: run.budget.spent + event.spent,
                }),
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
            parent: event.parent,
            previous: O.some(event.previous),
            purpose: event.purpose,
            versions: event.versions,
            requester: event.requester,
            accountable: event.accountable,
            source: event.source,
            terms: event.terms,
            delegation: event.delegation,
            provenance: event.runProvenance,
            budget: {
              allowance: event.allowance,
              reserved: A.reduce(event.reservations, 0, (sum, held) => sum + held.units),
              spent: 0,
              allocated: 0,
            },
            reservations: event.reservations,
            steps: 0,
            historyBound: event.historyBound,
          }),
        }),
    },
    reply: {
      ReserveBudget: (state) => ({
        remaining: O.match(requestOf(state), { onNone: thunk0, onSome: (run) => remaining(run.budget) }),
      }),
    },
  },
  { description: "One agent run: its lifecycle, lineage, grant, budget ledger and history bound." },
) {}
