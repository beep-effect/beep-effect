import type { RunId } from "@proto/kernel/Ids";
import { AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as P from "@beep/utils/Predicate";
import * as Schedule from "effect/Schedule";

/**
 * How long a caller waits for a policy the runs model runs after a commit:
 * about three seconds.
 *
 * @category constants
 * @since 0.0.0
 */
export const settling = { schedule: Schedule.spaced("10 millis"), times: 300 } as const;

/**
 * The live run of a lineage: a run that continued at its history bound is
 * followed to the run it continued as, waiting for the policy that opens
 * it. A run that did not continue is its own live run.
 *
 * **Example** (Following a run)
 * ```ts
 * import { RunId } from "@proto/kernel/Ids";
 * import { AgentRun } from "@proto/runs-model/Run/AgentRun.aggregate";
 * import { liveRun } from "@proto/runs-host/Lineage";
 * import * as Effect from "effect/Effect";
 * import { pipe } from "effect/Function";
 *
 * const live = Effect.flatMap(Effect.service(AgentRun), (runs) => liveRun(RunId.make("run_1"), runs));
 * const same = Effect.flatMap(Effect.service(AgentRun), (runs) => pipe(RunId.make("run_1"), liveRun(runs)));
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const liveRun: {
  (runs: RunReader): (run: RunId) => Effect.Effect<LiveRun>;
  (run: RunId, runs: RunReader): Effect.Effect<LiveRun>;
} = dual(
  2,
  (run: RunId, runs: RunReader): Effect.Effect<LiveRun> =>
    Effect.flatMap(runs.get(run), (state) =>
      AgentRunState.guards.Continued(state)
        ? runs.get(state.next).pipe(
            Effect.repeat({ ...settling, until: P.not(AgentRunState.guards.Unrequested) }),
            Effect.andThen(liveRun(state.next, runs)),
          )
        : Effect.succeed({ run, state }),
    ),
);

/** What {@link liveRun} reads: a run's state by id. */
interface RunReader {
  readonly get: (run: RunId) => Effect.Effect<AgentRunState>;
}

/** The run a lineage continues in now, with its state. */
interface LiveRun {
  readonly run: RunId;
  readonly state: AgentRunState;
}
