/**
 * The Postgres projection store, mirroring `Domain.InMemory`'s: each key's
 * immutable input log accepts a delivery once per `(source, seq)`, is processed
 * in order in batches (`kit.options.batch`), and records what it processed and
 * the per-source checkpoints only once `kit.run` succeeded.
 */
import { targetId } from "@alchemy.run/domain/CatchUp";
import { A, O, R } from "@beep/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as MutableHashSet from "effect/MutableHashSet";
import * as S from "effect/Schema";
import { AcceptedJson, encodeJson, PartitionRow } from "../AlchemyPostgres.schema.ts";
import { orDieAs, rowsOf } from "./host.ts";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";
import type * as Projection from "@alchemy.run/domain/Projection";
import type * as SqlError from "effect/sql/SqlError";
import type { HostContext } from "./host.ts";

const decodePartitions = rowsOf(PartitionRow);
const decodeAccepted = rowsOf(AcceptedJson);
/** `COALESCE(MAX(...), 0)` always answers one row. */
const decodeCount = S.decodeUnknownEffect(S.NonEmptyArray(S.Struct({ position: S.Int })));
const decodeKeys = rowsOf(S.Struct({ key: S.String }));
const decodeOldest = S.decodeUnknownEffect(S.NonEmptyArray(AcceptedJson));

const emptyPartition = PartitionRow.make({ processed: 0, intake: {}, checkpoints: {} });

/** Host one projection. */
export const makeProjectionStore =
  (ctx: HostContext) => (_definition: Projection.Any, kit: DomainPlatform.ProjectionKit) =>
    Effect.gen(function* () {
      const { modelName, now, scope, sql, tables } = ctx;
      const name = kit.name;
      const consumerId = `projection:${name}`;
      const orDie = orDieAs("receive")(tables.projectionPartition);
      // Rebuilt (a new generation): start every key's log over; the history is replayed to it.
      yield* ctx.resetConsumer(
        consumerId,
        kit.generation,
        Effect.all(
          [
            sql`DELETE FROM ${sql(tables.projectionPartition)} WHERE model = ${modelName} AND projection = ${name}`,
            sql`DELETE FROM ${sql(tables.consumerInput)} WHERE model = ${modelName} AND consumer = ${consumerId}`,
          ],
          { discard: true }
        )
      );
      /** One lock per key: intake, processing and the key's consumer role hold it. */
      const lockOf = (key: string) => `projection:${name}/${key}`;
      const batch = kit.options.batch;
      const target = targetId({
        kind: "projection",
        name,
        ...(kit.generation > 0 ? { generation: kit.generation } : {}),
      });

      const partitionOf = (key: string) =>
        sql`SELECT processed, intake, checkpoints FROM ${sql(tables.projectionPartition)}
        WHERE model = ${modelName} AND projection = ${name} AND key = ${key}`.pipe(
          Effect.flatMap(decodePartitions),
          Effect.map((rows) => O.getOrElse(A.head(rows), () => emptyPartition))
        );
      const save = Effect.fnUntraced(function* (key: string, partition: PartitionRow) {
        const intake = yield* encodeJson(partition.intake);
        const checkpoints = yield* encodeJson(partition.checkpoints);
        yield* sql`INSERT INTO ${sql(tables.projectionPartition)} (model, projection, key, processed, intake, checkpoints)
        VALUES (${modelName}, ${name}, ${key}, ${partition.processed}, ${intake}::jsonb, ${checkpoints}::jsonb)
        ON CONFLICT (model, projection, key) DO UPDATE
        SET processed = EXCLUDED.processed, intake = EXCLUDED.intake, checkpoints = EXCLUDED.checkpoints`;
      });
      const countOf = (key: string) =>
        sql`SELECT COALESCE(MAX(position), 0)::int AS position FROM ${sql(tables.consumerInput)}
        WHERE model = ${modelName} AND consumer = ${consumerId} AND key = ${key}`.pipe(
          Effect.flatMap(decodeCount),
          Effect.map((rows) => A.headNonEmpty(rows).position)
        );
      const inputs = (key: string, after: number, limit: number) =>
        sql`SELECT position, delivery, at FROM ${sql(tables.consumerInput)}
        WHERE model = ${modelName} AND consumer = ${consumerId} AND key = ${key} AND position > ${after}
        ORDER BY position LIMIT ${limit}`.pipe(Effect.flatMap(decodeAccepted));

      /** Keys with a timer armed to process a short batch once it has waited long enough. */
      const timers = MutableHashSet.empty<string>();

      /** Handle the key's unprocessed inputs in order, in batches; leave a short batch to fill. */
      const process = (key: string, flush: boolean): Effect.Effect<void> =>
        ctx.exclusive(lockOf(key))(run(key, flush)).pipe(orDie);

      /** Process `key` in the background, once the caller's transaction committed. */
      const background = (work: Effect.Effect<void>) =>
        sql.afterCommit(
          Effect.forkIn(work.pipe(Effect.catchCause(ctx.logFailure(`projection ${name}`))), scope).pipe(Effect.asVoid)
        );
      const kick = (key: string, flush: boolean) => background(process(key, flush));

      const run = Effect.fnUntraced(function* (
        key: string,
        flush: boolean
      ): Effect.fn.Return<void, SqlError.SqlError | S.SchemaError> {
        const partition = yield* partitionOf(key);
        const count = yield* countOf(key);
        if (partition.processed >= count) return;
        const size = batch?.size ?? 1;
        const at = yield* now;
        // There is an unprocessed input, so the oldest one exists.
        const oldest = yield* sql`SELECT position, delivery, at FROM ${sql(tables.consumerInput)}
            WHERE model = ${modelName} AND consumer = ${consumerId} AND key = ${key} AND position > ${partition.processed}
            ORDER BY position LIMIT 1`.pipe(Effect.flatMap(decodeOldest));
        const waited = at - A.headNonEmpty(oldest).at;
        if (!flush && batch !== undefined && count - partition.processed < size && waited < batch.waitMillis) {
          if (!MutableHashSet.has(timers, key)) {
            MutableHashSet.add(timers, key);
            yield* background(
              Duration.millis(batch.waitMillis - waited).pipe(
                Effect.sleep,
                Effect.andThen(Effect.sync(() => MutableHashSet.remove(timers, key))),
                Effect.andThen(process(key, true))
              )
            );
          }
          return;
        }
        const accepted = yield* inputs(key, partition.processed, size);
        yield* kit.run(key, accepted);
        const checkpoints = A.reduce(accepted, { ...partition.checkpoints }, (acc, { delivery }) => ({
          ...acc,
          [delivery.source]: Math.max(
            O.getOrElse(R.get(acc, delivery.source), () => 0),
            delivery.seq
          ),
        }));
        yield* save(
          key,
          PartitionRow.make({
            processed: partition.processed + A.length(accepted),
            intake: partition.intake,
            checkpoints,
          })
        );
        yield* run(key, flush);
      });

      /** Accept a delivery into its key's log (once), then handle the log. */
      const intake = (delivery: DomainPlatform.Delivery): Effect.Effect<void> =>
        // For an earlier generation of the projection: nothing to run.
        (delivery.target.generation ?? 0) < kit.generation
          ? Effect.void
          : ctx
              .exclusive(lockOf(delivery.key))(
                Effect.gen(function* () {
                  const partition = yield* partitionOf(delivery.key);
                  if (O.getOrElse(R.get(partition.intake, delivery.source), () => 0) >= delivery.seq) return;
                  const count = yield* countOf(delivery.key);
                  const at = yield* now;
                  const json = yield* encodeJson(delivery);
                  yield* sql`INSERT INTO ${sql(tables.consumerInput)}
                  (model, consumer, key, position, source, source_seq, delivery, at)
                  VALUES (${modelName}, ${consumerId}, ${delivery.key}, ${count + 1}, ${delivery.source},
                    ${delivery.seq}, ${json}::jsonb, ${at})`;
                  yield* save(
                    delivery.key,
                    PartitionRow.make({
                      processed: partition.processed,
                      intake: { ...partition.intake, [delivery.source]: delivery.seq },
                      checkpoints: partition.checkpoints,
                    })
                  );
                  yield* kick(delivery.key, false);
                })
              )
              .pipe(orDie);

      // Buffers and merges history while a backfill runs.
      const consumer = ctx.consumerKeys({
        id: consumerId,
        target,
        lockOf,
        singleSource: kit.singleSource,
        history: kit.history,
        apply: (_key, deliveries) => Effect.forEach(deliveries, intake, { discard: true }),
      });

      // Keys a previous process accepted but did not finish processing resume once workers start.
      ctx.workers.push(
        sql`SELECT partition.key FROM ${sql(tables.projectionPartition)} partition
        WHERE partition.model = ${modelName} AND partition.projection = ${name}
          AND partition.processed < (
            SELECT COALESCE(MAX(position), 0) FROM ${sql(tables.consumerInput)} input
            WHERE input.model = partition.model AND input.consumer = ${consumerId} AND input.key = partition.key
          )`.pipe(
          Effect.flatMap(decodeKeys),
          Effect.flatMap(Effect.forEach(({ key }) => kick(key, false), { discard: true })),
          orDie
        )
      );

      return {
        receive: Effect.fn("AlchemyPostgres.projection.receive")(function* (delivery: DomainPlatform.Delivery) {
          if (yield* consumer(delivery.key).admit(target, [delivery])) yield* intake(delivery);
        }),
        checkpoints: (key) => Effect.map(partitionOf(key), ({ checkpoints }) => checkpoints).pipe(orDie),
      } satisfies DomainPlatform.ProjectionStore;
    }).pipe(orDieAs("receive")(ctx.tables.projectionPartition));
