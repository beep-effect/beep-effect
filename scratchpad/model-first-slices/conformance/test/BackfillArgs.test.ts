import * as Domain from "@alchemy.run/domain";
import * as DurableObjects from "@alchemy.run/domain/DurableObjects";
import { expect, it } from "@effect/vitest";
import * as A from "@beep/utils/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { makeSimHostWith, type SimHostOptions } from "./SimHost.ts";
import { thunk0 } from "@beep/utils"

// Phase 10, patch 5 (D46): a consumer added by a deploy receives the history of the instances that
// were there before it. Its backfill lists the directory, and the first page of a listing passes
// no cursor. In process, calls cross the way the Effect Cluster transport carries them
// (`SimHost` `args`): `json`, as before patch 5 (the missing cursor arrives as `null`, every
// listing is empty and the new view gets only what is committed after the deploy), and `cluster`,
// with patch 5's `encodeCallArgs`.

class Booked extends Domain.Event("Booked", { n: Schema.Finite }) {}
class BookMany extends Domain.Command("BookMany", {
  target: Schema.String,
  input: { count: Schema.Finite },
  events: [Booked],
}) {}
class Ledger extends Domain.Aggregate("Ledger", {
  id: Schema.String,
  state: Schema.Struct({ count: Schema.Finite }),
  initial: { count: 0 },
  commands: [BookMany],
  decide: {
    BookMany: (ledger, { count }) => A.makeBy(count, (i) => Booked.make({ n: ledger.count + i + 1 })),
  },
  evolve: { Booked: (_, e) => ({ count: e.n }) },
}) {}
/** Every booking of every ledger, under one key: a consumer the second deploy adds. */
class Census extends Domain.View("Census", {
  from: [Ledger],
  key: Schema.Literal("all"),
  keyOf: { Ledger: () => "all" as const },
  state: Schema.Struct({ bookings: Schema.Finite }),
  initial: { bookings: 0 },
  evolve: { Booked: (view) => ({ bookings: view.bookings + 1 }) },
}) {}
class BooksBefore extends Domain.Model("Books", { aggregates: [Ledger] }) {}
class BooksAfter extends Domain.Model("Books", { aggregates: [Ledger], views: [Census] }) {}

/** Three bookings before the deploy that adds `Census`, one after; what `Census` holds then. */
const deployOverHistory = Effect.fn("deployOverHistory")(function* (args: SimHostOptions["args"]) {
  const sim = makeSimHostWith({ args })(() => ({}));
  const platform = DurableObjects.makePlatform(sim.host);
  // The first deploy, on runner 0.
  yield* Effect.scoped(
    Effect.gen(function* () {
      const before = yield* Layer.build(BooksBefore.layer(Layer.empty).pipe(Layer.provideMerge(platform), Layer.provideMerge(SecureRandom.layerWebCrypto)));
      yield* Effect.gen(function* () {
        const ledgers = yield* Ledger;
        yield* ledgers.send("a", BookMany.make({ count: 2 }));
        yield* ledgers.send("b", BookMany.make({ count: 1 }));
      }).pipe(Effect.provideContext(before));
    }),
  );
  // The second deploy, on runner 1: new code over the same storage.
  sim.serveFrom(1);
  const after = yield* Layer.build(BooksAfter.layer(Layer.empty).pipe(Layer.provideMerge(platform), Layer.provideMerge(SecureRandom.layerWebCrypto)));
  return yield* Effect.gen(function* () {
    const ledgers = yield* Ledger;
    const census = yield* Census;
    yield* ledgers.send("c", BookMany.make({ count: 1 }));
    // Until the backfill has brought the three earlier bookings, or eight seconds have passed.
    const bookings = census.get("all").pipe(Effect.map(O.match({ onNone: thunk0, onSome: (view) => view.bookings })));
    return yield* bookings.pipe(Effect.repeat({ schedule: Schedule.spaced("100 millis"), until: (n) => n >= 4, times: 80 }));
  }).pipe(Effect.ensuring(sim.close), Effect.provideContext(after));
});

it.live("a consumer added by a deploy receives the earlier history when calls cross as patch 5 sends them", () =>
  Effect.gen(function* () {
    const bookings = yield* deployOverHistory("cluster");
    expect(bookings).toBe(4);
  }),
);

it.live("with arguments through JSON as before patch 5, the new consumer gets only what came after it", () =>
  Effect.gen(function* () {
    const bookings = yield* deployOverHistory("json");
    expect(bookings).toBe(1);
  }),
);
