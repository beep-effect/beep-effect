import * as Domain from "@alchemy.run/domain";
import { Session } from "@proto/kernel/Session.middleware";
import type { RunId } from "@proto/kernel/Ids";
import type { RunStatus } from "@proto/runs-contract/Run/RunStatus";
import { NotInSession, type SessionRun, SessionRunsState } from "@proto/runs-contract/Run/SessionRuns.read";
import { SessionId } from "@proto/runs-contract/Run/Session.id";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { AgentRun } from "./AgentRun.aggregate.ts";

type State = SessionRunsState;

/** Add a run to the chain, or move it to a new status. */
const upsert = (view: State, run: RunId, status: RunStatus, from: Partial<SessionRun> = {}): State =>
  A.some(view.runs, (entry) => entry.run === run)
    ? { ...view, runs: A.map(view.runs, (entry) => (entry.run === run ? { ...entry, status, ...from } : entry)) }
    : { ...view, runs: A.append(view.runs, { run, previous: O.none(), parent: O.none(), status, ...from }) };

/**
 * A session's chain of runs (D23): every run requested in it, every child
 * and every continuation, with where each came from and where it is.
 *
 * @category views
 * @since 0.0.0
 */
export class SessionRuns extends Domain.View(
  "SessionRuns",
  {
    from: [AgentRun],
    key: SessionId,
    keyOf: { AgentRun: ({ event }) => event.session },
    middleware: [Session],
    rejects: [NotInSession],
    state: SessionRunsState,
    initial: SessionRunsState.make({}),
    evolve: {
      RunRequested: (view, event, { source }) => ({
        ...upsert(view, source.id, "requested"),
        requesters: A.union(view.requesters, [event.requester]),
      }),
      RunActivated: (view, _event, { source }) => upsert(view, source.id, "running"),
      RunRejected: (view, _event, { source }) => upsert(view, source.id, "rejected"),
      RunAwaitingApproval: (view, _event, { source }) => upsert(view, source.id, "awaiting-approval"),
      RunCompleted: (view, _event, { source }) => upsert(view, source.id, "completed"),
      RunExhausted: (view, _event, { source }) => upsert(view, source.id, "exhausted"),
      RunContinued: (view, _event, { source }) => upsert(view, source.id, "continued"),
      RunCancelled: (view, _event, { source }) => upsert(view, source.id, "cancelled"),
      ChildRequested: (view, _event, { source }) => upsert(view, source.id, "awaiting-child"),
      ChildRunOpened: (view, event, { source }) => upsert(view, source.id, "running", { parent: O.some(event.parent) }),
      ChildRunRefused: (view, _event, { source }) => upsert(view, source.id, "running"),
      ContinuationOpened: (view, event, { source }) =>
        upsert(view, source.id, "running", { previous: O.some(event.previous) }),
      ChildRunFinished: (view, _event, { source }) => upsert(view, source.id, "running"),
    },
  },
  { description: "A session's chain of runs: requests, children and continuations, with their status." },
) {}
