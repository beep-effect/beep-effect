/**
 * Usage-record sink port and its in-memory proof implementation.
 *
 * The {@link UsageRecordSink} is the append-only boundary the chat
 * orchestration handler writes a finalized turn's {@link UsageRecord} to. The
 * production implementation persists into PGlite-backed `usage_record`
 * storage through the app sidecar; the deterministic in-memory implementation
 * remains available to app-level contract tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as UsageRecordTable from "@beep/epistemic-tables/entities/UsageRecord";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import { PostgresDrizzle } from "@beep/postgres";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as Ref from "effect/Ref";
import type { UsageRecord } from "@beep/epistemic-domain";

const $I = $ProfessionalDesktopId.create("chat/UsageRecordSink");

const usagePersistenceFailures = Metric.counter("agents_usage_persistence_failures_total", { incremental: true });

/**
 * Service shape of the usage-record sink: append a single {@link UsageRecord}.
 * Appends are total — the sink never fails the calling turn pipeline.
 *
 * **Example** (Define minimal sink shape)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
 * **Example** (Yield usage record sink)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
export class UsageRecordSink extends Context.Service<UsageRecordSink, UsageRecordSinkShape>()($I`UsageRecordSink`) {}

/**
 * Build the in-memory sink and its backing {@link Ref} in one effect. The
 * shared `Ref` is returned alongside the {@link UsageRecordSink} port so the
 * app-level contract test can assert exactly which {@link UsageRecord}s were
 * appended by reading the `Ref` directly.
 *
 * **Example** (Build sink with backing ref)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { makeInMemoryUsageRecordSink } from "@/chat/UsageRecordSink"
 *
 * const program = Effect.gen(function* () {
 *   const { ref, sink } = yield* makeInMemoryUsageRecordSink
 *   return { ref, sink }
 * })
 * ```
 *
 * @effects Allocates a mutable in-memory Ref for usage records.
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
 * **Details**
 *
 * Production composition uses {@link UsageRecordSinkDrizzle}; this layer is the
 * deterministic fixture for isolated contract and smoke tests.
 *
 * **Example** (Provide in-memory sink layer)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
            Effect.tapCause((cause) =>
              Metric.update(Metric.withAttributes(usagePersistenceFailures, { provider: record.provider }), 1).pipe(
                Effect.andThen(
                  logRedactedCause(
                    cause,
                    LogRedactedCauseOptions.make({
                      message: "usage record persistence failed",
                      level: "Error",
                      attributes: {
                        provider: record.provider,
                        subsystem: "usage_record",
                        table: UsageRecordTable.TABLE_NAME,
                      },
                    })
                  )
                )
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
 * **Example** (Verify Drizzle sink layer)
 *
 * ```ts
 * import { UsageRecordSinkDrizzle } from "@/chat/UsageRecordSink"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(UsageRecordSinkDrizzle)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const UsageRecordSinkDrizzle: Layer.Layer<UsageRecordSink, never, PostgresDrizzle> = Layer.effect(
  UsageRecordSink,
  makeDrizzleUsageRecordSink
);
