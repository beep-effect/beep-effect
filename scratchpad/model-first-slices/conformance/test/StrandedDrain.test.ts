import * as Domain from "@alchemy.run/domain";
import * as DurableObjects from "@alchemy.run/domain/DurableObjects";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { makeSimHost, type SimHost } from "./SimHost.ts";

// Phase 6, patch 1 (upstream issue 1): a drain that finds its lease held must come back once the
// lease expires, because the instance holding it may be dead. The lease a dead instance left is
// written straight into storage, as it is after a runner is killed mid-drain; the clock is a
// TestClock, so the 10 s backstop and the 60 s lease are stepped through, not waited for.
// Without the patch all three cases fail: every drain that finds the lease held returns without
// scheduling anything, so the rows stay staged after the lease has expired.

class Booked extends Domain.Event("Booked", { n: Schema.Number }) {}
class BookMany extends Domain.Command("BookMany", {
  target: Schema.String,
  input: { count: Schema.Number },
  events: [Booked],
}) {}
class Ledger extends Domain.Aggregate("Ledger", {
  id: Schema.String,
  state: Schema.Struct({ count: Schema.Number }),
  initial: { count: 0 },
  commands: [BookMany],
  decide: {
    BookMany: (ledger, { count }) => A.makeBy(count, (i) => new Booked({ n: ledger.count + i + 1 })),
  },
  evolve: { Booked: (_, e) => ({ count: e.n }) },
}) {}
class Totals extends Domain.View("Totals", {
  from: [Ledger],
  key: Ledger,
  state: Schema.Struct({ count: Schema.Number }),
  initial: { count: 0 },
  evolve: { Booked: (_, e) => ({ count: e.n }) },
}) {}
class Line extends Domain.Event("Line", { n: Schema.Number }) {}
class Lines extends Domain.Stream("Lines", { key: Ledger, entries: [Line] }) {}
class LinesWriter extends Domain.Projection("LinesWriter", {
  from: [Ledger],
  key: Ledger,
  on: [Booked],
  writes: [Lines],
}) {}
const LinesWriterLive = LinesWriter.toLayer(
  Effect.gen(function* () {
    const lines = yield* Lines;
    return Effect.fn(function* (batch) {
      for (const input of batch) yield* lines.append(input, new Line({ n: input.event.n }));
    });
  }),
);
class Books extends Domain.Model("Books", {
  aggregates: [Ledger],
  views: [Totals],
  projections: [LinesWriter],
  streams: [Lines],
}) {}

/** How long a drain's lease lasts (`LEASE_MS` in `DurableObjects.ts`). */
const LEASE_MS = 60_000;

const onSim = (sim: SimHost) =>
  Books.layer(LinesWriterLive).pipe(
    Layer.provideMerge(DurableObjects.makePlatform(sim.host)),
    Layer.provideMerge(SecureRandom.layerWebCrypto),
  );

const AGGREGATE = "Books.LedgerAggregate/main";
const PROJECTION = "Books.LinesWriterProjection/main";

/** The view's count and the stream's length for `main`. */
const readMain = Effect.gen(function* () {
  const ledger = Ledger.ref("main");
  return {
    totals: O.map(yield* (yield* Totals).get(ledger), (s) => s.count),
    lines: (yield* (yield* Lines).list(ledger)).entries.length,
  };
});

/** Book one line on `main`, then read it inside the lease (past every 10 s backstop) and after it. */
const bookAndStep = (sim: SimHost) =>
  Effect.gen(function* () {
    yield* (yield* Ledger).send(Ledger.ref("main"), new BookMany({ count: 1 }));
    yield* TestClock.adjust("15 seconds");
    const insideLease = yield* readMain;
    yield* TestClock.adjust(`${LEASE_MS} millis`);
    const afterLease = yield* readMain;
    return { insideLease, afterLease };
  }).pipe(Effect.ensuring(sim.close), Effect.scoped, Effect.provide(onSim(sim)));

it.effect("an aggregate's outbox drain whose lease a dead instance left is taken over once the lease expires", () =>
  Effect.gen(function* () {
    const sim = makeSimHost((id, now) => (id === AGGREGATE ? { "outbox-lease": now + LEASE_MS } : {}));
    const result = yield* bookAndStep(sim);
    // The lease is live: nothing is delivered yet.
    expect(result.insideLease).toEqual({ totals: O.none(), lines: 0 });
    // The drain came back after the lease and delivered to the view and the projection.
    expect(result.afterLease).toEqual({ totals: O.some(1), lines: 1 });
    // Two acquires: the kick finds the lease and moves the backstop to just after it; the
    // backstop takes over.
    expect(sim.reads(AGGREGATE, "outbox-lease")).toBeLessThanOrEqual(2);
  }),
);

it.effect("a projection key's drain whose lease a dead instance left is taken over once the lease expires", () =>
  Effect.gen(function* () {
    const sim = makeSimHost((id, now) => (id === PROJECTION ? { "drain-lease": now + LEASE_MS } : {}));
    const result = yield* bookAndStep(sim);
    // The view is not behind the projection's lease; the stream is.
    expect(result.insideLease).toEqual({ totals: O.some(1), lines: 0 });
    expect(result.afterLease).toEqual({ totals: O.some(1), lines: 1 });
    // Three acquires: two drains find the lease (its first delivery's kick and one more), the
    // backstop takes over.
    expect(sim.reads(PROJECTION, "drain-lease")).toBeLessThanOrEqual(3);
  }),
);

it.effect("while live drains keep taking the lease, the backstop comes back once per lease, not in a loop", () =>
  Effect.gen(function* () {
    const sim = makeSimHost((id, now) => (id === AGGREGATE ? { "outbox-lease": now + LEASE_MS } : {}));
    const result = yield* Effect.gen(function* () {
      yield* (yield* Ledger).send(Ledger.ref("main"), new BookMany({ count: 1 }));
      // Five minutes of drains that each take a fresh lease 30 s into the last one.
      for (let step = 1; step <= 10; step++) {
        yield* TestClock.adjust("30 seconds");
        yield* sim.write(AGGREGATE, { "outbox-lease": step * 30_000 + LEASE_MS });
      }
      const whileHeld = yield* readMain;
      const readsWhileHeld = sim.reads(AGGREGATE, "outbox-lease");
      // The last of them dies with its lease.
      yield* TestClock.adjust(`${LEASE_MS + 1_000} millis`);
      return { whileHeld, readsWhileHeld, after: yield* readMain };
    }).pipe(Effect.ensuring(sim.close), Effect.scoped, Effect.provide(onSim(sim)));
    expect(result.whileHeld).toEqual({ totals: O.none(), lines: 0 });
    // The kick, then one return per lease (each a minute long): each finds the next one.
    expect(result.readsWhileHeld).toBeLessThanOrEqual(5);
    expect(result.after).toEqual({ totals: O.some(1), lines: 1 });
  }),
);
