import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { Root } from "@proto/kernel/Invocation";
import { NotInSession } from "@proto/runs-contract/Run/SessionRuns.read";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import { SessionRuns } from "./SessionRuns.view.ts";

/**
 * Who may read a session: a person who requested a run in it, or one of its
 * runs. A session nobody has started reads as empty.
 *
 * @category handlers
 * @since 0.0.0
 */
export const SessionRunsLive = SessionRuns.toLayer(
  Effect.succeed(
    Effect.fn(function* (_request, session) {
      if (session === null || A.isReadonlyArrayEmpty(session.runs)) return;
      const invocation = yield* CurrentInvocation;
      const takesPart = Root.match(invocation.root, {
        Human: ({ principal }) => A.contains(session.requesters, principal),
        Agent: ({ run }) => A.some(session.runs, (entry) => entry.run === run),
      });
      if (!takesPart) return yield* NotInSession.make({});
    }),
  ),
);
