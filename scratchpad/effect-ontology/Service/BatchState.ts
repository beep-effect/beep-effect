import { Persistence } from "effect/unstable/persistence"
import { KeyValueStore } from "effect/unstable/persistence"
import { Effect, Layer, Option, PubSub, Schema, Context } from "effect"
import type { BatchId } from "../Domain/Identity.ts"
import { BatchState } from "../Domain/Model/BatchWorkflow.ts"
import { PathLayout } from "../Domain/PathLayout.ts"
import { StorageService } from "./Storage.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/BatchState");

const stateKey = (batchId: BatchId) => PathLayout.batch.status(batchId)

const encodeState = Schema.encodeEffect(BatchState)
const decodeState = Schema.decodeUnknownEffect(Schema.fromJsonString(BatchState))

/**
 * Maximum number of pending state updates in the PubSub.
 * Uses sliding strategy (drops oldest) to prevent memory growth.
 *
 * Set to 1000 to accommodate ~100 concurrent batches with ~10 state updates each.
 * If subscribers fall behind, oldest state updates are dropped in favor of newer ones.
 */
const BATCH_STATE_HUB_CAPACITY = 1000

export class BatchStateHub extends Context.Service<BatchStateHub>()($I`BatchStateHub`, {
  make: PubSub.sliding<BatchState>(BATCH_STATE_HUB_CAPACITY)
}) {
    static readonly Default = Layer.effect(this, this.make);
}

export const BatchStateHubLayer = BatchStateHub.Default

const storageAsKeyValueStore = Effect.gen(function*() {
  const storage = yield* StorageService

  return KeyValueStore.make({
    get: (key) => storage.get(key),
    getUint8Array: (key) => storage.getUint8Array(key),
    set: (key, value) => storage.set(key, value),
    remove: (key) => storage.remove(key),
    clear: storage.clear,
    size: storage.size,
    has: (key) => storage.get(key).pipe(Effect.map(Option.isSome)),
    isEmpty: Effect.succeed(false),
    modify: (key, f) =>
      storage.get(key).pipe(
        Effect.flatMap((current) =>
          Option.match(O.fromNullishOr(current), {
            onNone: () => Effect.succeed(Option.none<string>()),
            onSome: (value) =>
              Effect.flatMap(
                storage.set(key, f(value)),
                () => Effect.succeed(Option.some(value))
              )
          })
        )
      )
  })
})

export const BatchStatePersistenceLayer = Persistence.layerKeyValueStore.pipe(
  Layer.provide(Layer.effect(KeyValueStore.KeyValueStore, storageAsKeyValueStore))
)

export const persistState =
  Effect.fn(function*(state: BatchState)  {
    const storage = yield* StorageService
    const encoded = yield* encodeState(state)
    yield* storage.set(stateKey(state.batchId), JSON.stringify(encoded))
  })

export const getBatchStateFromStore =
  Effect.fn(function*(batchId: BatchId)  {
    const storage = yield* StorageService
    const stored = yield* storage.get(stateKey(batchId))

    return yield* Option.match(O.fromNullishOr(stored), {
      onNone: () => Effect.succeed(Option.none<BatchState>()),
      // decodeState uses Schema.fromJsonString, which handles JSON parsing directly
      // No need for explicit JSON.parse - avoids double parse overhead
      onSome: (json) =>
        decodeState(json).pipe(
          Effect.asSome,
          Effect.catch(() => Effect.succeed(Option.none<BatchState>()))
        )
    })
  })

export const publishState =
  Effect.fn(function*(state: BatchState)  {
    const hub = yield* BatchStateHub
    yield* PubSub.publish(hub, state)
    yield* persistState(state)
  })
