import type { RunId } from "@proto/kernel/Ids";
import type { AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
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
import { dual } from "effect/Function";
 *
 * const live = Effect.flatMap(Effect.service(AgentRun), (runs) => liveRun(runs, RunId.make("run_1")));
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const liveRun: {
  (run: RunId): (runs: RunReader) => Effect.Effect<LiveRun>;
  (runs: RunReader, run: RunId): Effect.Effect<LiveRun>;
} = dual(
  2,
  (runs: RunReader, run: RunId): Effect.Effect<LiveRun> =>
    Effect.flatMap(runs.get(run), (state) =>
      state._tag !== "Continued"
        ? Effect.succeed({ run, state })
        : runs.get(state.next).pipe(
            Effect.repeat({ ...settling, until: (next) => next._tag !== "Unrequested" }),
            Effect.andThen(liveRun(runs, state.next)),
          ),
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
