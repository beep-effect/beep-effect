import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, Layer, Option, PubSub, Schema } from "effect";
import { KeyValueStore, Persistence } from "effect/unstable/persistence";
import type { BatchId } from "../Domain/Identity.ts";
import { BatchState } from "../Domain/Model/BatchWorkflow.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/BatchState");

const stateKey = (batchId: BatchId) => PathLayout.batch.status(batchId);

const encodeState = Schema.encodeEffect(Schema.fromJsonString(BatchState));
const decodeState = Schema.decodeUnknownEffect(Schema.fromJsonString(BatchState));

/**
 * Maximum number of pending state updates in the PubSub.
 * Uses sliding strategy (drops oldest) to prevent memory growth.
 *
 * Set to 1000 to accommodate ~100 concurrent batches with ~10 state updates each.
 * If subscribers fall behind, oldest state updates are dropped in favor of newer ones.
 */
const BATCH_STATE_HUB_CAPACITY = 1000;

export class BatchStateHub extends Context.Service<BatchStateHub>()($I`BatchStateHub`, {
  make: PubSub.sliding<BatchState>(BATCH_STATE_HUB_CAPACITY),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

export const BatchStateHubLayer = BatchStateHub.Default;

export const BatchStatePersistenceLayer = Persistence.layerKvs.pipe(
  Layer.provide(Layer.effect(KeyValueStore.KeyValueStore, StorageService))
);

export const persistState = Effect.fn(function* (state: BatchState) {
  const storage = yield* StorageService;
  const encoded = yield* encodeState(state);
  yield* storage.set(stateKey(state.batchId), encoded);
});

export const getBatchStateFromStore = Effect.fn(function* (batchId: BatchId) {
  const storage = yield* StorageService;
  const stored = yield* storage.get(stateKey(batchId));

  return yield* Option.match(Option.fromUndefinedOr(stored), {
    onNone: () => Effect.succeed(Option.none<BatchState>()),
    // decodeState uses Schema.fromJsonString, which handles JSON parsing directly
    // No need for explicit JSON.parse - avoids double parse overhead
    onSome: (json) =>
      decodeState(json).pipe(
        Effect.asSome,
        Effect.orElseSucceed(() => Option.none<BatchState>())
      ),
  });
});

export const publishState = Effect.fn(function* (state: BatchState) {
  const hub = yield* BatchStateHub;
  yield* PubSub.publish(hub, state);
  yield* persistState(state);
});
