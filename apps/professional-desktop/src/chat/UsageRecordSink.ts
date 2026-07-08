/**
 * Usage-record sink port and its in-memory proof implementation.
 *
 * The {@link UsageRecordSink} is the append-only boundary the chat
 * orchestration handler writes a finalized turn's {@link UsageRecord} to. The
 * real implementation (a later increment) persists into PGlite-backed
 * `usage_record` storage through the app sidecar; this increment ships only the
 * deterministic in-memory implementation that the app-level contract test
 * inspects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as UsageRecordTable from "@beep/epistemic-tables/entities/UsageRecord";
import { PostgresDrizzle } from "@beep/postgres";
import { Context, Effect, Layer, Ref } from "effect";
import type { UsageRecord } from "@beep/epistemic-domain";

/**
 * Service shape of the usage-record sink: append a single {@link UsageRecord}.
 * Appends are total — the sink never fails the calling turn pipeline.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import type { UsageRecordSinkShape } from "@/chat/UsageRecordSink"
 *
 * const sink: UsageRecordSinkShape = {
 *   append: () => Effect.void
 * }
 * console.log(typeof sink.append)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface UsageRecordSinkShape {
  readonly append: (record: UsageRecord) => Effect.Effect<void>;
}

/**
 * Append-only usage-record sink the chat orchestration handler writes finalized
 * turn usage to.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { UsageRecordSink } from "@/chat/UsageRecordSink"
 *
 * const program = Effect.gen(function* () {
 *   const sink = yield* UsageRecordSink
 *   return sink
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class UsageRecordSink extends Context.Service<UsageRecordSink, UsageRecordSinkShape>()(
  "@beep/professional-desktop/chat/UsageRecordSink"
) {}

/**
 * Build the in-memory sink and its backing {@link Ref} in one effect. The
 * shared `Ref` is returned alongside the {@link UsageRecordSink} port so the
 * app-level contract test can assert exactly which {@link UsageRecord}s were
 * appended by reading the `Ref` directly.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeInMemoryUsageRecordSink } from "@/chat/UsageRecordSink"
 *
 * const program = Effect.gen(function* () {
 *   const { ref, sink } = yield* makeInMemoryUsageRecordSink
 *   return { ref, sink }
 * })
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeInMemoryUsageRecordSink: Effect.Effect<{
  readonly ref: Ref.Ref<ReadonlyArray<UsageRecord>>;
  readonly sink: UsageRecordSinkShape;
}> = Effect.gen(function* () {
  const ref = yield* Ref.make<ReadonlyArray<UsageRecord>>([]);
  const sink: UsageRecordSinkShape = {
    append: (record) => Ref.update(ref, (records) => [...records, record]),
  };
  return { ref, sink };
});

/**
 * In-memory {@link UsageRecordSink} layer backed by a shared {@link Ref}.
 *
 * TODO(live sidecar): replace with a PGlite-backed sink that encodes the
 * {@link UsageRecord} and persists it into the `usage_record` table once the
 * usage-record migration and the PGlite-socket runtime land.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { UsageRecordSink, UsageRecordSinkInMemory } from "@/chat/UsageRecordSink"
 *
 * const program = Effect.gen(function* () {
 *   const sink = yield* UsageRecordSink
 *   return sink
 * }).pipe(Effect.provide(UsageRecordSinkInMemory))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const UsageRecordSinkInMemory: Layer.Layer<UsageRecordSink> = Layer.unwrap(
  Effect.map(makeInMemoryUsageRecordSink, ({ sink }) => Layer.succeed(UsageRecordSink, sink))
);

/**
 * Build the Drizzle-backed {@link UsageRecordSink} over a {@link PostgresDrizzle}
 * database. The finalized {@link UsageRecord} is encoded into its persistence row
 * via {@link UsageRecordTable.toUsageRecordInsert} (which drops the SERIAL `id`)
 * and inserted into the epistemic `epistemic_usage_record` table.
 *
 * Appends stay total: a driver-level insert failure is logged and dropped so the
 * sink never fails the calling turn pipeline, matching the in-memory sink's
 * contract and the {@link UsageRecordSinkShape} signature.
 *
 * @category constructors
 * @since 0.0.0
 */
const makeDrizzleUsageRecordSink: Effect.Effect<UsageRecordSinkShape, never, PostgresDrizzle> = Effect.gen(
  function* () {
    const db = yield* PostgresDrizzle;
    const sink: UsageRecordSinkShape = {
      append: (record) =>
        db
          .insert(UsageRecordTable.Table)
          .values(UsageRecordTable.toUsageRecordInsert(record))
          .pipe(
            Effect.asVoid,
            Effect.tapError((cause) =>
              Effect.logError("UsageRecordSink Drizzle adapter dropped driver failure").pipe(
                Effect.annotateLogs({
                  provider: record.provider,
                  table: UsageRecordTable.Table.definition.tableName,
                  cause,
                })
              )
            ),
            Effect.ignore,
            Effect.withSpan("UsageRecordSink.appendDrizzle", {
              attributes: { provider: record.provider, model: record.model },
            })
          ),
    };
    return sink;
  }
);

/**
 * Drizzle-backed {@link UsageRecordSink} layer that persists finalized turn usage
 * into the epistemic `epistemic_usage_record` table through {@link PostgresDrizzle}.
 *
 * @example
 * ```ts
 * import { UsageRecordSinkDrizzle } from "@/chat/UsageRecordSink"
 *
 * console.log(UsageRecordSinkDrizzle)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const UsageRecordSinkDrizzle: Layer.Layer<UsageRecordSink, never, PostgresDrizzle> = Layer.effect(
  UsageRecordSink,
  makeDrizzleUsageRecordSink
);
