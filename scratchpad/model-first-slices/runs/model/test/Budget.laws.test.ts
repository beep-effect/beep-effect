import { expect, it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { Count } from "@proto/kernel/Measure";
import { ActivateRun } from "@proto/runs-contract/Run/ActivateRun.command";
import { BudgetExceeded } from "@proto/runs-contract/Run/BudgetExceeded.rejection";
import { ChildFinished } from "@proto/runs-contract/Run/ChildFinished.command";
import { DelegateRun } from "@proto/runs-contract/Run/DelegateRun.command";
import { RefuseChild } from "@proto/runs-contract/Run/RefuseChild.command";
import { ReleaseReservation } from "@proto/runs-contract/Run/ReleaseReservation.command";
import type { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
import { RequestRun } from "@proto/runs-contract/Run/RequestRun.command";
import { BudgetReserved, ReserveBudget } from "@proto/runs-contract/Run/ReserveBudget.command";
import { SettleUsage, UsageSettled } from "@proto/runs-contract/Run/SettleUsage.command";
import { UsageExceedsReservation } from "@proto/runs-contract/Run/UsageExceedsReservation.rejection";
import { AgentRun, AgentRunState, Budget, recordOf, remaining, unspent } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { Cast, Units } from "./Cast.ts";
import { buildersOf, childTerms, delegationOf, parentTerms, requesterOf, sourceOf } from "./fixtures.ts";

// The budget ledger's laws (D6), for any budget and any sequence of reports. A scene is a run
// with a generated allowance and the reports its executor and its policies send it, decided and
// evolved by the aggregate itself (`AgentRun.predict`), with no platform. Every expected value is
// read from the state before the report.

/**
 * A budget by its parts: what is reserved, spent, allocated and left over. `Budget`'s own
 * arbitrary draws its four counts apart and keeps only those within the allowance, which is too
 * sparse to sample (fewer than one draw in ten passes), so the laws build budgets from parts.
 */
const Parts = S.Struct({ reserved: Units, spent: Units, allocated: Units, left: Units });
const budgetOf = ({ reserved, spent, allocated, left }: typeof Parts.Type) =>
  Budget.make({ allowance: reserved + spent + allocated + left, reserved, spent, allocated });

it.prop("any budget accounts for its whole allowance, and nothing in it is negative", [Parts], ([parts]) => {
  const budget = budgetOf(parts);
  expect(remaining(budget)).toBe(parts.left);
  expect(S.is(Count)(remaining(budget))).toBe(true);
  // A finished run gives back what remains and what its open reservations held.
  expect(unspent(budget)).toBe(remaining(budget) + budget.reserved);
});

it.prop("a budget whose uses pass its allowance is not a budget", [Parts, Units], ([parts, extra]) => {
  const budget = budgetOf(parts);
  expect(S.is(Budget)({ ...budget, spent: budget.spent + parts.left + extra + 1 })).toBe(false);
});

/**
 * One report a run's executor or a policy of the runs model sends; `pick` chooses among the open
 * reservations, and a settlement `within` its reservation reports at most what it holds.
 */
const Report = S.TaggedUnion({
  Reserve: { reservation: Count, units: Units },
  Settle: { pick: Count, units: Units, within: S.Boolean },
  Release: { pick: Count },
  Delegate: { units: Units },
  ChildFinished: { returned: Units },
  ChildRefused: {},
});
type Report = typeof Report.Type;

/** A requested and granted run with this allowance, and the reports it then receives, in order. */
const Scene = S.Struct({
  cast: Cast,
  allowance: Units,
  reports: S.Array(Report).check(S.isMaxLength(24)),
  now: S.DateTimeUtc,
});
type Scene = typeof Scene.Type;

const isState = S.is(AgentRunState);

/** A command the run takes. */
type RunCommand = InstanceType<(typeof AgentRun.definition.commands)[number]>;

/** One of the cast's reservations, by any count. */
const castReservation = (cast: Cast, n: number) => cast.reservations[n % A.length(cast.reservations)] ?? cast.reservations[0];

/** The open reservation `pick` names, or, with none open, one the run has never held. */
const reservationAt = (cast: Cast, state: AgentRunState, pick: number) =>
  O.match(O.flatMap(recordOf(state), (run) => A.get(run.reservations, pick % A.length(run.reservations))), {
    onNone: () => castReservation(cast, pick),
    onSome: (held) => held.reservation,
  });

/** The reservation the run holds open by this id, with its units. */
const heldAt = (state: AgentRunState, reservation: ReservationId) =>
  O.flatMap(recordOf(state), (run) => A.findFirst(run.reservations, (open) => open.reservation === reservation));

/** The command a report is, against the state it meets. */
const commandOf = (cast: Cast, state: AgentRunState) =>
  Report.match({
    Reserve: ({ reservation, units }) =>
      ReserveBudget.make({ reservation: castReservation(cast, reservation), units }),
    Settle: ({ pick, units, within }) => {
      const reservation = reservationAt(cast, state, pick);
      const held = O.match(heldAt(state, reservation), { onNone: () => units, onSome: (open) => open.units });
      return SettleUsage.make({ reservation, units: within ? units % (held + 1) : units });
    },
    Release: ({ pick }) => ReleaseReservation.make({ reservation: reservationAt(cast, state, pick) }),
    Delegate: ({ units }) =>
      DelegateRun.make({
        child: cast.runs.child,
        delegation: delegationOf(cast.runs.child),
        purpose: cast.purposes.child,
        allowance: units,
        terms: childTerms(cast),
      }),
    // A child gives back at most its share.
    ChildFinished: ({ returned }) =>
      ChildFinished.make({
        child: cast.runs.child,
        returned: AgentRunState.guards.AwaitingChild(state) ? returned % (state.allowance + 1) : 0,
        outcome: cast.words.outcome,
        provenance: buildersOf(cast).self(cast.runs.child),
      }),
    ChildRefused: () => RefuseChild.make({ child: cast.runs.child, reason: cast.words.denial, provenance: buildersOf(cast).self(cast.runs.run) }),
  });

/** The run's ledger, from the state it is in: the active record's budget and open reservations. */
const ledgerOf = (state: AgentRunState) => O.getOrThrow(recordOf(state));

/** Decide one command on the run as the run itself, and evolve the state by what it records. */
const decide = (scene: Scene, state: AgentRunState, command: RunCommand) =>
  AgentRun.predict(state, command, {
    id: scene.cast.runs.run,
    now: scene.now,
    context: Context.make(CurrentInvocation, buildersOf(scene.cast).asRun(scene.cast.runs.run)),
  });

/** The run, requested by the cast's requester and granted, before any report. */
const startOf = (scene: Scene): AgentRunState => {
  const { cast } = scene;
  const requestedRun = AgentRun.predict(
    AgentRunState.cases.Unrequested.make({}),
    RequestRun.make({
      session: cast.session,
      purpose: cast.purposes.run,
      versions: cast.versions,
      allowance: scene.allowance,
      historyBound: cast.bound,
      source: sourceOf(cast),
      terms: parentTerms(cast),
    }),
    { id: cast.runs.run, now: scene.now, context: Context.make(CurrentInvocation, requesterOf(cast)) },
  );
  const requested = requestedRun._tag === "Accepted" ? requestedRun.state : AgentRunState.cases.Unrequested.make({});
  const activated = decide(
    scene,
    requested,
    ActivateRun.make({
      delegation: delegationOf(cast.runs.run),
      accountable: cast.principals.requester,
      runProvenance: buildersOf(cast).self(cast.runs.run),
      provenance: buildersOf(cast).self(cast.runs.run),
    }),
  );
  return activated._tag === "Accepted" ? activated.state : requested;
};

/** Every state the run passes through, each with the report that led to it, its command and the prediction it came from. */
const walk = (scene: Scene) => {
  const start = startOf(scene);
  return A.reduce(
    scene.reports,
    {
      state: start,
      steps: A.empty<{ before: AgentRunState; report: Report; command: RunCommand; prediction: ReturnType<typeof decide> }>(),
    },
    ({ state, steps }, report) => {
      const command = commandOf(scene.cast, state)(report);
      const prediction = decide(scene, state, command);
      const next = prediction._tag === "Accepted" ? prediction.state : state;
      return { state: next, steps: A.append(steps, { before: state, report, command, prediction }) };
    },
  );
};

it.prop("the run starts with its whole allowance remaining", [Scene], ([scene]) => {
  const start = startOf(scene);
  expect(start._tag).toBe("Running");
  expect(ledgerOf(start).budget).toEqual(Budget.make({ allowance: scene.allowance }));
});

it.prop("after any reports, every state is a valid state whose budget is whole and whose reservations add up", [Scene], ([scene]) => {
  const { steps } = walk(scene);
  A.forEach(steps, ({ prediction }) => {
    // No report makes the aggregate die or suspend: it records events or refuses.
    expect(prediction._tag).not.toBe("Unpredictable");
    if (prediction._tag !== "Accepted") return;
    expect(isState(prediction.state)).toBe(true);
    const { budget, reservations } = ledgerOf(prediction.state);
    // Nothing is created or lost: the allowance never moves, and its parts add up to it.
    expect(budget.allowance).toBe(scene.allowance);
    expect(budget.reserved + budget.spent + budget.allocated + remaining(budget)).toBe(scene.allowance);
    expect(remaining(budget)).toBeGreaterThanOrEqual(0);
    expect(budget.reserved).toBe(A.reduce(reservations, 0, (sum, held) => sum + held.units));
  });
});

it.prop("a reservation is accepted exactly when what remains covers it, and reports what is left", [Scene], ([scene]) => {
  A.forEach(walk(scene).steps, ({ before, report, prediction }) => {
    if (!Report.guards.Reserve(report) || !AgentRunState.guards.Running(before)) return;
    const reservation = castReservation(scene.cast, report.reservation);
    const left = remaining(before.run.budget);
    // A redelivered reservation is the same reservation: it records nothing.
    if (A.some(before.run.reservations, (held) => held.reservation === reservation)) {
      expect(prediction).toMatchObject({ _tag: "Accepted", events: [] });
      return;
    }
    if (report.units > left) {
      expect(prediction).toEqual({ _tag: "Rejected", rejection: BudgetExceeded.make({ requested: report.units, remaining: left }) });
      return;
    }
    expect(prediction._tag).toBe("Accepted");
    const [reserved] = prediction._tag === "Accepted" ? A.filter(prediction.events, S.is(BudgetReserved)) : [];
    expect(reserved).toMatchObject({ units: report.units, remaining: left - report.units });
  });
});

it.prop("a settlement is accepted exactly when the reservation covers the usage, and returns what it did not use", [Scene], ([scene]) => {
  A.forEach(walk(scene).steps, ({ before, command, prediction }) => {
    if (command._tag !== "SettleUsage" || !AgentRunState.guards.Running(before)) return;
    const { reservation, units } = command;
    O.match(heldAt(before, reservation), {
      onNone: () => expect(prediction).toMatchObject({ _tag: "Rejected", rejection: { _tag: "UnknownReservation", reservation } }),
      onSome: (held) => {
        if (units > held.units) {
          expect(prediction).toEqual({
            _tag: "Rejected",
            rejection: UsageExceedsReservation.make({ reservation, reserved: held.units, units }),
          });
          return;
        }
        const [settled] = prediction._tag === "Accepted" ? A.filter(prediction.events, S.is(UsageSettled)) : [];
        expect(settled).toMatchObject({
          reserved: held.units,
          units,
          remaining: remaining(before.run.budget) + held.units - units,
        });
      },
    });
  });
});

it.prop("a refused report changes nothing", [Scene], ([scene]) => {
  const { steps } = walk(scene);
  A.forEach(A.zip(steps, A.drop(steps, 1)), ([step, after]) => {
    if (step.prediction._tag === "Rejected") expect(after.before).toBe(step.before);
  });
});
