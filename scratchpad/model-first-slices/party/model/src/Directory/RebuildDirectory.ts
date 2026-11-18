import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import { PartyDirectory } from "./PartyDirectory.projection.ts";
import { PartyDirectoryStore } from "./PartyDirectory.store.ts";

/**
 * The switch at the end of a directory rebuild: wait until the library has
 * replayed the history into the new generation's logs (`Progress.history`),
 * then until the store's new generation has applied everything the active
 * one has, and make it the generation queries read. Until then queries read
 * the old generation.
 *
 * **Details**
 *
 * A rebuild starts by deploying the model with `partyDirectoryLive(next)`
 * (projection `version` = `next`). Only the projection runs again: policies,
 * sagas and the fact outbox keep their own checkpoints, so nothing fires,
 * nothing calls out and nothing is published (the phase 3 rebuild test).
 *
 * **Example** (Switching to generation 1)
 * ```ts
 * import { switchWhenCaughtUp } from "@proto/party-model/Directory/RebuildDirectory";
 *
 * const done = switchWhenCaughtUp(1);
 * ```
 *
 * @category operations
 * @since 0.0.0
 */
export const switchWhenCaughtUp = Effect.fn(function* (generation: number) {
  const progress = yield* PartyDirectory.Progress;
  const store = yield* PartyDirectoryStore;
  const poll = { schedule: Schedule.spaced("20 millis"), times: 500 } as const;
  yield* progress.history.pipe(Effect.repeat({ ...poll, until: (history) => history.complete }));
  yield* store.switchTo(generation).pipe(Effect.retry(poll));
});
