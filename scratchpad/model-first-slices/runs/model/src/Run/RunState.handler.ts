import { PublicRunState } from "@proto/runs-contract/Run/RunState.read";
import { SessionRunsState } from "@proto/runs-contract/Run/SessionRuns.read";
import * as O from "@beep/utils/Option";
import { thunkEffectVoid } from "@beep/utils/thunk";
import * as Effect from "effect/Effect";
import { AgentRun, outcomeOf, sessionOf, statusOf } from "./AgentRun.aggregate.ts";
import { RunState } from "./RunState.query.ts";
import { requireInSession } from "./SessionRuns.handler.ts";
import { SessionRuns } from "./SessionRuns.view.ts";

/**
 * Reads the run as of its latest commit, refuses a caller who takes no part
 * in its session (the rule `SessionRuns` applies), and answers only its
 * status and, once it completed, its outcome. A run nobody requested has no
 * session and reads as `unrequested`.
 *
 * **Details**
 *
 * A session the view has not caught up with yet takes in nobody, so the run
 * is refused until it has; a caller passes its command's receipt as
 * `atLeast` to wait for it.
 *
 * @category handlers
 * @since 0.0.0
 */
export const RunStateLive = RunState.toLayer(
  Effect.gen(function* () {
    const runs = yield* AgentRun;
    const sessions = yield* SessionRuns;
    return Effect.fn(function* ({ run }) {
      const state = yield* runs.get(run);
      yield* O.match(sessionOf(state), {
        onNone: thunkEffectVoid,
        onSome: (session) =>
          sessions.get(session).pipe(
            Effect.orDie,
            Effect.flatMap((read) => requireInSession(O.getOrElse(read, () => SessionRunsState.make({})))),
          ),
      });
      return PublicRunState.make({ status: statusOf(state), outcome: outcomeOf(state) });
    });
  }),
);
