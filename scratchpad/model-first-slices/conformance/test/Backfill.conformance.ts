import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type * as Scope from "effect/Scope";
import { eventually, get, psql, record, registration, services } from "./Stack.ts";

// Phase 10 (D46): a consumer added by a deploy over existing data receives the history. With
// RESTORE_PHASE=tally, the stack runs this phase's code over phase 9's dump: the two-runners slots
// phase 9 wrote are there, and `SlotTally`, new in phase 10, has never seen them. Its backfill
// lists the directory; before patch 5 every listing was empty on Effect Cluster.

/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

if (O.contains(registration.restorePhase, "tally")) {
  live("a consumer added by a deploy over phase 9's data receives every earlier write", Effect.gen(function* () {
    // What phase 9 left: every slot write stored before this code was deployed.
    const stored = yield* psql(
      "SELECT count(*) FROM alchemy_domain_objects WHERE object LIKE 'Practice/TwoRunners.SlotAggregate/%' AND key LIKE 'event:%'",
    );
    const writes = Number(stored);
    const tally = yield* eventually(get<{ readonly writes: number }>("/tworunners/tally"), (read) => read.writes >= writes, 120);
    const run = yield* psql(
      "SELECT key, left(value, 240) FROM alchemy_domain_objects WHERE object LIKE 'Practice/TwoRunners.SlotTallyViewRun/%' AND key LIKE 'prog:%'",
    );
    yield* record("tally", { stored: writes, tally, run });
    expect(writes).toBeGreaterThan(0);
    expect(tally.writes).toBe(writes);
  }));
}
