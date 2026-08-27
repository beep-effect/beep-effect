/**
 * Public effect-ontology APIs for service/batch state.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, Layer, PubSub } from "effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { KeyValueStore, Persistence } from "effect/unstable/persistence";
import { BatchId } from "../Domain/Identity.ts";
import { BatchState } from "../Domain/Model/BatchWorkflow.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/BatchState");

const stateKey = (batchId: BatchId) => PathLayout.batch.status(batchId);

const encodeState = S.encodeEffect(S.fromJsonString(BatchState));
const decodeState = S.decodeUnknownEffect(S.fromJsonString(BatchState));

/**
 * Failure while encoding or storing a batch state.
 *
 * **Example** (Create a persistence failure)
 *
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity"
 * import { BatchStatePersistenceError } from "@effect-ontology/Service/BatchState"
 *
 * const error = BatchStatePersistenceError.make({
 *   batchId: BatchId.make("batch-deadbeefcafe"),
 *   message: "Failed to persist batch state",
 *   cause: "storage unavailable"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BatchStatePersistenceError extends S.TaggedError<BatchStatePersistenceError>(
  $I`BatchStatePersistenceError`
)(
  "BatchStatePersistenceError",
  {
    batchId: BatchId,
    message: S.NonEmptyString,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("BatchStatePersistenceError", {
    description: "Failure while loading, encoding, or storing a durable batch state.",
  })
) {}

/**
 * Failure while decoding a stored batch state.
 *
 * **Example** (Create a decode failure)
 *
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity"
 * import { BatchStateDecodeError } from "@effect-ontology/Service/BatchState"
 *
 * const error = BatchStateDecodeError.make({
 *   batchId: BatchId.make("batch-deadbeefcafe"),
 *   message: "Failed to decode persisted batch state",
 *   cause: "invalid state document"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BatchStateDecodeError extends S.TaggedError<BatchStateDecodeError>($I`BatchStateDecodeError`)(
  "BatchStateDecodeError",
  {
    batchId: BatchId,
    message: S.NonEmptyString,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("BatchStateDecodeError", {
    description: "Failure while decoding a durable batch state through the canonical BatchState schema.",
  })
) {}

/**
 * Maximum number of pending state updates in the PubSub.
 * Uses sliding strategy (drops oldest) to prevent memory growth.
 *
 * Set to 1000 to accommodate ~100 concurrent batches with ~10 state updates each.
 * If subscribers fall behind, oldest state updates are dropped in favor of newer ones.
 */
const BATCH_STATE_HUB_CAPACITY = 1000;

/**
 * In-memory PubSub hub for live batch-state updates.
 *
 * **Example** (Publish a pending batch)
 *
 * ```ts
 * import { DateTime, Effect, PubSub } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BatchState } from "@effect-ontology/Model/BatchWorkflow"
 * import { BatchStateHub } from "@effect-ontology/Service/BatchState"
 *
 * const published = Effect.runSync(
 *   Effect.gen(function* () {
 *     const hub = yield* BatchStateHub
 *     const now = DateTime.formatIso(DateTime.nowUnsafe())
 *     const state = S.decodeUnknownOption(BatchState)({
 *       _tag: "Pending",
 *       batchId: "batch-deadbeefcafe",
 *       ontologyId: "premier_league",
 *       manifestUri: "gs://beep-ontology/manifest.json",
 *       ontologyVersion: "football/premier_league@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *       createdAt: now,
 *       updatedAt: now,
 *       documentCount: 0
 *     })
 *     if (O.isNone(state)) return false
 *     yield* PubSub.publish(hub, state.value)
 *     return true
 *   }).pipe(Effect.provide(BatchStateHub.Default))
 * )
 * console.log(published) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BatchStateHub extends Context.Service<BatchStateHub>()($I`BatchStateHub`, {
  make: PubSub.sliding<BatchState>(BATCH_STATE_HUB_CAPACITY),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

/**
 * Default layer for {@link BatchStateHub}.
 *
 * **Example** (Provide the hub layer)
 *
 * ```ts
 * import { Effect, PubSub } from "effect"
 * import { BatchStateHub, BatchStateHubLayer } from "@effect-ontology/Service/BatchState"
 *
 * const empty = Effect.runSync(
 *   Effect.gen(function* () {
 *     const hub = yield* BatchStateHub
 *     return yield* PubSub.isActive(hub)
 *   }).pipe(Effect.provide(BatchStateHubLayer))
 * )
 * console.log(empty) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BatchStateHubLayer = BatchStateHub.Default;

/**
 * Persistence layer that stores batch state through {@link StorageService}.
 *
 * **Example** (Provide persistence over test storage)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { BatchStatePersistenceLayer } from "@effect-ontology/Service/BatchState"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const layer = Layer.provide(BatchStatePersistenceLayer, StorageServiceTest)
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BatchStatePersistenceLayer = Persistence.layerKvs.pipe(
  Layer.provide(Layer.effect(KeyValueStore.KeyValueStore, StorageService))
);

/**
 * Encode a batch snapshot and write it to {@link StorageService}.
 *
 * **Example** (Persist a pending batch)
 *
 * ```ts
 * import { DateTime, Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BatchState } from "@effect-ontology/Model/BatchWorkflow"
 * import { persistState } from "@effect-ontology/Service/BatchState"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const persisted = Effect.runSync(
 *   Effect.gen(function* () {
 *     const now = DateTime.formatIso(DateTime.nowUnsafe())
 *     const state = S.decodeUnknownOption(BatchState)({
 *       _tag: "Pending",
 *       batchId: "batch-deadbeefcafe",
 *       ontologyId: "premier_league",
 *       manifestUri: "gs://beep-ontology/manifest.json",
 *       ontologyVersion: "football/premier_league@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *       createdAt: now,
 *       updatedAt: now,
 *       documentCount: 0
 *     })
 *     if (O.isNone(state)) return false
 *     yield* persistState(state.value)
 *     return true
 *   }).pipe(Effect.provide(StorageServiceTest), Effect.orDie)
 * )
 * console.log(persisted) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const persistState = Effect.fn("BatchState.persistState")(function* (state: BatchState) {
  const storage = yield* StorageService;
  const encoded = yield* encodeState(state).pipe(
    Effect.mapError((cause) =>
      BatchStatePersistenceError.make({
        batchId: state.batchId,
        message: "Failed to encode batch state for persistence",
        cause,
      })
    )
  );
  yield* storage.set(stateKey(state.batchId), encoded).pipe(
    Effect.mapError((cause) =>
      BatchStatePersistenceError.make({
        batchId: state.batchId,
        message: "Failed to persist batch state",
        cause,
      })
    )
  );
});

/**
 * Load a persisted batch snapshot, returning none when the key is absent.
 *
 * **Example** (Read a missing batch)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { BatchId } from "@effect-ontology/Identity"
 * import { getBatchStateFromStore } from "@effect-ontology/Service/BatchState"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const found = Effect.runSync(
 *   getBatchStateFromStore(BatchId.make("batch-deadbeefcafe")).pipe(
 *     Effect.provide(StorageServiceTest),
 *     Effect.orDie
 *   )
 * )
 * console.log(O.isNone(found)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const getBatchStateFromStore = Effect.fn("BatchState.getFromStore")(function* (batchId: BatchId) {
  const storage = yield* StorageService;
  const stored = yield* storage.getOption(stateKey(batchId)).pipe(
    Effect.mapError((cause) =>
      BatchStatePersistenceError.make({
        batchId,
        message: "Failed to load persisted batch state",
        cause,
      })
    )
  );

  return yield* Effect.transposeOption(
    O.map(
      stored,
      flow(
        decodeState,
        Effect.mapError((cause) =>
          BatchStateDecodeError.make({
            batchId,
            message: "Failed to decode persisted batch state",
            cause,
          })
        )
      )
    )
  );
});

/**
 * Persist a batch snapshot and publish it on {@link BatchStateHub}.
 *
 * **Example** (Publish after persist)
 *
 * ```ts
 * import { DateTime, Effect, Layer } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BatchState } from "@effect-ontology/Model/BatchWorkflow"
 * import { BatchStateHub, publishState } from "@effect-ontology/Service/BatchState"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const published = Effect.runSync(
 *   Effect.gen(function* () {
 *     const now = DateTime.formatIso(DateTime.nowUnsafe())
 *     const state = S.decodeUnknownOption(BatchState)({
 *       _tag: "Pending",
 *       batchId: "batch-deadbeefcafe",
 *       ontologyId: "premier_league",
 *       manifestUri: "gs://beep-ontology/manifest.json",
 *       ontologyVersion: "football/premier_league@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *       createdAt: now,
 *       updatedAt: now,
 *       documentCount: 0
 *     })
 *     if (O.isNone(state)) return false
 *     yield* publishState(state.value)
 *     return true
 *   }).pipe(
 *     Effect.provide(Layer.merge(BatchStateHub.Default, StorageServiceTest)),
 *     Effect.orDie
 *   )
 * )
 * console.log(published) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const publishState = Effect.fn("BatchState.publishState")(function* (state: BatchState) {
  const hub = yield* BatchStateHub;
  yield* persistState(state);
  yield* PubSub.publish(hub, state);
});
