import * as Domain from "@alchemy.run/domain";
import { PrincipalId, RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import * as Initial from "@proto/kernel/Initial";
import * as S from "effect/Schema";
import { RunActivated } from "./ActivateRun.command.ts";
import { RunAwaitingApproval } from "./AwaitApproval.command.ts";
import { RunCancelled } from "./CancelRun.command.ts";
import { RunCompleted } from "./CompleteRun.command.ts";
import { ChildRunFinished } from "./ChildFinished.command.ts";
import { ChildRequested } from "./DelegateRun.command.ts";
import { RunExhausted } from "./ExhaustRun.command.ts";
import { ChildRunOpened } from "./OpenChildRun.command.ts";
import { ContinuationOpened } from "./OpenContinuation.command.ts";
import { RunContinued } from "./RecordStep.command.ts";
import { ChildRunRefused } from "./RefuseChild.command.ts";
import { RunRejected } from "./RejectRun.command.ts";
import { RunRequested } from "./RequestRun.command.ts";
import { RunStatus } from "./RunStatus.ts";
import { SessionId } from "./Session.id.ts";
import { $RunsContractId } from "@proto/kernel/Identity";

const $I = $RunsContractId.create("Run/SessionRuns.read");

/**
 * Refused: the reader is neither a person who requested a run in this
 * session nor one of its runs.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotInSession extends S.TaggedError<NotInSession, { readonly brand: unique symbol }>()(
  "NotInSession",
  {},
  $I.annote("NotInSession", { httpApiStatus: 403, description: "The reader takes no part in this session." }),
) {}

/**
 * One run in a session's chain: where it came from (the run it continues,
 * or its parent) and where it is.
 *
 * @category models
 * @since 0.0.0
 */
export const SessionRun = S.Struct({
  run: RunId,
  previous: S.OptionFromNullOr(RunId),
  parent: S.OptionFromNullOr(RunId),
  status: RunStatus,
});
/**
 * @category models
 * @since 0.0.0
 */
export type SessionRun = typeof SessionRun.Type;

/**
 * A session: every run in its chain, in order, and the people who requested them.
 *
 * @category models
 * @since 0.0.0
 */
export const SessionRunsState = S.Struct({
  runs: Initial.empty(SessionRun, { description: "Every run of the session, in the order requested; none at first." }),
  requesters: Initial.empty(PrincipalId, { description: "Everyone who requested a run in the session; none at first." }),
});
/**
 * @category models
 * @since 0.0.0
 */
export type SessionRunsState = typeof SessionRunsState.Type;

/**
 * The `SessionRuns` view's read contract, with no aggregate behind it.
 *
 * **Gotchas**
 *
 * Interim (D9): `events` lists the model view's emitted events in the
 * aggregate's order; the parity test checks.
 *
 * @category reads
 * @since 0.0.0
 */
export class SessionRunsRead extends Domain.View("SessionRuns", {
  from: [],
  key: SessionId,
  state: SessionRunsState,
  initial: SessionRunsState.make({}),
  events: [
    RunRequested,
    RunActivated,
    RunRejected,
    RunContinued,
    RunAwaitingApproval,
    RunCompleted,
    RunExhausted,
    RunCancelled,
    ChildRequested,
    ChildRunOpened,
    ChildRunRefused,
    ContinuationOpened,
    ChildRunFinished,
  ],
  middleware: [Session],
  rejects: [NotInSession],
}, { description: "A session's chain of runs: requests, children and continuations, with their status." }) {}

