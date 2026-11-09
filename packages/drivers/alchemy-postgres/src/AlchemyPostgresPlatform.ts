/**
 * Postgres `Platform` for `@alchemy.run/domain`: aggregates, views, policies,
 * projections and streams hosted on any effect/sql `SqlClient` speaking
 * Postgres (Postgres itself or PGlite), with catch-up for consumers added after
 * their sources recorded events.
 *
 * **Details**
 *
 * Semantics follow the installed beta.85 `Platform` contract, with
 * `Domain.InMemory` as the executable reference.
 *
 * - Aggregates: one writer per instance (an advisory lock plus
 *   `SELECT ... FOR UPDATE` on its instance row inside one transaction), `commandId` dedupe
 *   through stored receipts, an atomic commit of events, state, receipt and
 *   outbox deliveries, scheduled commands fired by a polling worker.
 * - Views: one writer per key; snapshot, entries, input log and downstream
 *   deliveries are written together; a rebuilt generation starts every key
 *   over; a view keyed by its one aggregate reads that instance's history
 *   before its first answer.
 * - Projections: each key's input log accepts a delivery once per
 *   `(source, seq)` and is processed in order in batches; what it processed is
 *   recorded only once the handler succeeded.
 * - Streams: appends apply in origin order, stamped as InMemory stamps them.
 * - Catch-up: the upstream `Backfill` roles run unchanged over a per-object KV
 *   table (`exclusive` is a transaction holding `pg_advisory_xact_lock`) and a
 *   due-job table drained by a worker; the network between roles is in-process.
 * - Delivery: outbox rows are claimed with `FOR UPDATE SKIP LOCKED` under a
 *   per-host lease, oldest pending row per `(source, target)` first, so several
 *   hosts on one database deliver each row once and in order; a failed
 *   delivery stays pending with bounded backoff. A host that closes mid-pass
 *   frees the rows it claimed, so the next host need not wait out the lease.
 * - Upcasting: an event class may declare `static readonly schemaVersion`
 *   (default 1) and `static readonly upcast: (fromVersion, json) => json`,
 *   which lifts the stored JSON of version `fromVersion` to `fromVersion + 1`.
 *   Every read (`events`, `tail`, catch-up rows) applies it from the row's
 *   `schema_version` up to the class's current version before the kernel
 *   decodes the event.
 *
 * Live reads (`changes`, `tail`) poll at `pollMillis`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Backfill from "@alchemy.run/domain/Backfill";
import { hostedModels, Platform } from "@alchemy.run/domain/Platform";
import { O } from "@beep/utils";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Queue from "effect/Queue";
import * as Random from "effect/Random";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import { AlchemyPostgresConfig } from "./AlchemyPostgres.config.ts";
import { AlchemyPostgresTables, encodeJson, migrate } from "./AlchemyPostgres.schema.ts";
import { makeAggregateStore } from "./internal/aggregate.ts";
import { makeContext, orDieAs } from "./internal/host.ts";
import { makeProjectionStore } from "./internal/projection.ts";
import { makeStreamStore } from "./internal/stream.ts";
import { makeViewStore } from "./internal/view.ts";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";
import type { AlchemyPostgresError } from "./AlchemyPostgres.errors.ts";

const makeHost = (deps: Parameters<typeof makeContext>[0]): DomainPlatform.ModelHost => {
  const ctx = makeContext(deps);

  const policy = (_definition: unknown, kit: DomainPlatform.PolicyKit) =>
    Effect.sync((): DomainPlatform.PolicyStore => {
      const locks = MutableHashMap.empty<string, Semaphore.Semaphore>();
      const lockFor = (key: string) =>
        O.getOrElse(MutableHashMap.get(locks, key), () => {
          const created = Semaphore.makeUnsafe(1);
          MutableHashMap.set(locks, key, created);
          return created;
        });
      return {
        // The outbox marks a delivery done only after this succeeds: at least once, in order per key.
        // A failed run fails the delivery: the outbox keeps the row pending and retries it.
        receive: (delivery) => lockFor(delivery.key).withPermits(1)(kit.run(delivery)),
      };
    });

  return {
    aggregate: (definition, kit) => makeAggregateStore(ctx)(definition, kit),
    view: (definition, kit) => makeViewStore(ctx)(definition, kit),
    policy,
    projection: (definition, kit) => makeProjectionStore(ctx)(definition, kit),
    stream: (definition, kit) => makeStreamStore(ctx)(definition, kit),
    // Every store is built: deliveries find their targets hosted, and a deploy that adds
    // consumers starts their runs.
    start: Effect.fn("AlchemyPostgresPlatform.start")(function* (
      targets: ReadonlyArray<string>,
      plans: (target: string) => Backfill.Plan | undefined,
      backfill: ReadonlyArray<string>
    ) {
      ctx.plans.model = targets;
      ctx.plans.planOf = plans;
      yield* ctx.startWorkers;
      yield* Effect.forEach(
        backfill,
        (target) =>
          O.match(O.fromUndefinedOr(plans(target)), {
            onNone: () => Effect.void,
            // A consumer that reads other sources than its run started with, at the same
            // version: building the model fails, saying to bump the version.
            onSome: (plan) =>
              Effect.flatMap(ctx.net.run.begin(target, plan), (begun) =>
                begun.status === "changed"
                  ? Effect.die(new Backfill.PlanChanged({ message: Backfill.planChanged(target, begun.started, plan) }))
                  : Effect.void
              ),
          }),
        { discard: true }
      );
    }),
    history: (target) => Effect.map(ctx.net.run.phase(target), (phase) => ({ complete: phase === "complete" })),
  };
};

const make = Effect.fn("AlchemyPostgresPlatform.make")(function* (config: AlchemyPostgresConfig) {
  const sql = yield* SqlClient.SqlClient;
  const clock = yield* Clock.Clock;
  yield* migrate(config);
  const tables = AlchemyPostgresTables.of(config);
  const claim = hostedModels({ release: true });
  const model = Effect.fn("AlchemyPostgresPlatform.model")(function* (hosted: DomainPlatform.HostedModel) {
    yield* claim(hosted.modelName, hosted.id);
    const scope = yield* Scope.Scope;
    const now = clock.currentTimeMillis;
    const builtAt = yield* now;
    const sagas = yield* encodeJson(hosted.sagas).pipe(Effect.orDie);
    yield* sql`INSERT INTO ${sql(tables.hostedModel)} (model, legacy_data, sagas, built_at)
      VALUES (${hosted.modelName}, ${hosted.legacyData}, ${sagas}::jsonb, ${builtAt})
      ON CONFLICT (model) DO UPDATE
      SET legacy_data = EXCLUDED.legacy_data, sagas = EXCLUDED.sagas, built_at = EXCLUDED.built_at`.pipe(
      orDieAs("claim")(tables.hostedModel)
    );
    const wakeDeliveries = yield* Queue.sliding<void>(1);
    const wakeJobs = yield* Queue.sliding<void>(1);
    const nonce = yield* Random.nextInt;
    const owner = `${hosted.modelName}:${builtAt}:${nonce}`;
    return makeHost({
      sql,
      tables,
      config,
      now,
      owner,
      scope,
      modelName: hosted.modelName,
      wakeDeliveries,
      wakeJobs,
    });
  });
  return Platform.of({ model });
});

/**
 * Host `@alchemy.run/domain` models on Postgres: the `Platform` service over the
 * ambient effect/sql `SqlClient`, with the driver's tables migrated when the
 * Layer is built.
 *
 * **Details**
 *
 * Provenance columns are filled from `meta.context` per `config.provenance`
 * and `config.provenanceMappings` (string fields only);
 * each event row's `schema_version` is its class's static `schemaVersion`
 * (default 1), and reads lift older rows with the class's static `upcast`.
 * Hosting two different models with the same name on one built platform
 * dies, as upstream.
 *
 * **Example** (Build the platform Layer)
 *
 * ```ts
 * import { AlchemyPostgresConfig } from "@beep/alchemy-postgres/AlchemyPostgres.config"
 * import * as AlchemyPostgresPlatform from "@beep/alchemy-postgres/AlchemyPostgresPlatform"
 * import * as Layer from "effect/Layer"
 *
 * // Provide an effect/sql `SqlClient` (Postgres or PGlite) to finish it.
 * const PlatformLive = AlchemyPostgresPlatform.layer(AlchemyPostgresConfig.make({ pollMillis: 50 }))
 * console.log(Layer.isLayer(PlatformLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (
  config: AlchemyPostgresConfig = AlchemyPostgresConfig.make({})
): Layer.Layer<Platform, AlchemyPostgresError, SqlClient.SqlClient> => Layer.effect(Platform)(make(config));
