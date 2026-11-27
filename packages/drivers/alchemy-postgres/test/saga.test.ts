/**
 * Sagas on Postgres: `AlchemyPostgres.layer` runs a model's sagas on the
 * cluster workflow engine over SQL storage, so a run survives its runtime
 * being torn down and built again on the same database.
 */

import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgres } from "@beep/alchemy-postgres";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { describe, layer } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Activity from "effect/workflow/Activity";
import * as DurableDeferred from "effect/workflow/DurableDeferred";

const ParcelId = S.String.pipe(S.brand("SagaParcelId"));
class Packed extends Domain.Event("Packed", {}) {}
class Shipped extends Domain.Event("Shipped", {}) {}
class Pack extends Domain.Command("Pack", { target: ParcelId, input: {}, events: [Packed] }) {}
class Ship extends Domain.Command("Ship", { target: ParcelId, input: {}, events: [Shipped] }) {}
class Parcel extends Domain.Aggregate("Parcel", {
  id: ParcelId,
  state: S.Struct({ packed: S.Int, shipped: S.Int }),
  initial: { packed: 0, shipped: 0 },
  commands: [Pack, Ship],
  decide: { Pack: () => [Packed.make({})], Ship: () => [Shipped.make({})] },
  evolve: {
    Packed: (state) => ({ ...state, packed: state.packed + 1 }),
    Shipped: (state) => ({ ...state, shipped: state.shipped + 1 }),
  },
}) {}

const Go = DurableDeferred.make("go");

class Deliver extends Domain.Saga("Deliver", { key: ParcelId, input: { wait: S.Boolean } }) {}
const DeliverLive = Deliver.toLayer(
  Effect.gen(function* () {
    const parcels = yield* Parcel;
    return Effect.fn(function* ({ key, wait }) {
      yield* Activity.make({ name: "pack", execute: parcels.send(key, Pack.make({})).pipe(Effect.asVoid) });
      if (wait === true) yield* DurableDeferred.await(Go);
      yield* Activity.make({ name: "ship", execute: parcels.send(key, Ship.make({})).pipe(Effect.asVoid) });
    });
  })
);

class Fulfilment extends Domain.Model("Fulfilment", { aggregates: [Parcel], sagas: [Deliver] }) {}

const runtime = Layer.fresh(Fulfilment.layer(DeliverLive).pipe(Layer.provide(AlchemyPostgres.layer())));

const withRuntime = Effect.fnUntraced(function* <A, E, R>(
  use: (context: Context.Context<Layer.Success<typeof runtime>>) => Effect.Effect<A, E, R>
) {
  const scope = yield* Scope.make();
  const context = yield* Layer.buildWithScope(runtime, scope);
  return yield* use(context).pipe(Effect.ensuring(Scope.close(scope, Exit.void)));
});

describe("Sagas on AlchemyPostgres over PGlite", () => {
  layer(Layer.merge(PgliteTestLayer, NodeCrypto.layer), {
    timeout: "60 seconds",
    excludeTestServices: true,
    concurrent: false,
  })("sagas", (it) => {
    it.effect("a two-step saga completes once, each step applied once", () =>
      Effect.gen(function* () {
        const context = yield* Layer.build(runtime);
        const id = ParcelId.make("parcel-straight");
        const run = yield* Context.get(context, Deliver).start(id, { wait: false });
        yield* run.result.pipe(Effect.timeout(Duration.seconds(20)));
        const parcel = yield* Context.get(context, Parcel).get(id);
        deepStrictEqual(parcel, { packed: 1, shipped: 1 });
      })
    );

    it.effect("a saga waiting on a deferred resumes in a new runtime after the old one is torn down", () =>
      Effect.gen(function* () {
        const id = ParcelId.make("parcel-resumed");
        yield* withRuntime((context) =>
          Effect.gen(function* () {
            yield* Context.get(context, Deliver).start(id, { wait: true });
            yield* Context.get(context, Parcel)
              .get(id)
              .pipe(
                Effect.repeat({ until: ({ packed }) => packed === 1, schedule: Schedule.spaced(Duration.millis(50)) }),
                Effect.timeout(Duration.seconds(20))
              );
          })
        );

        yield* withRuntime((context) =>
          Effect.gen(function* () {
            const run = Context.get(context, Deliver).get(id);
            yield* run.signal(Go, undefined);
            yield* run.result.pipe(Effect.timeout(Duration.seconds(20)));
            const parcel = yield* Context.get(context, Parcel).get(id);
            deepStrictEqual(parcel, { packed: 1, shipped: 1 });
          })
        );
      })
    );
  });
});
