/**
 * Workflow Persistence Layer
 *
 * **Details**
 *
 * Bridges our existing GCS-backed StorageService to @effect/experimental Persistence.
 * This reuses our existing infrastructure for workflow state durability.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";
import { KeyValueStore, Persistence } from "effect/unstable/persistence";
import { StorageService, StorageServiceLive, StorageServiceTest } from "./Storage.ts";

// -----------------------------------------------------------------------------
// KeyValueStore adapter for StorageService
// -----------------------------------------------------------------------------

/**
 * Adapts our StorageService (which extends KeyValueStore) to the standard
 * KeyValueStore.KeyValueStore tag that Persistence.layerKeyValueStore expects.
 *
 * **Details**
 *
 * The prefix "workflow-state/" isolates workflow persistence from other storage.
 *
 * **Example** (Inspect the storage adapter)
 *
 * ```ts
 * import { StorageKeyValueStoreLive } from "@effect-ontology/Service/WorkflowPersistence"
 *
 * import { Layer } from "effect"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 * import { StorageKeyValueStoreLive } from "@effect-ontology/Service/WorkflowPersistence"
 *
 * const layer = Layer.provide(StorageKeyValueStoreLive, StorageServiceTest)
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StorageKeyValueStoreLive = Layer.effect(
  KeyValueStore.KeyValueStore,
  Effect.gen(function* () {
    const storage = yield* StorageService;
    const prefix = "workflow-state/";

    const prefixKey = (key: string) => `${prefix}${key}`;

    return KeyValueStore.make({
      get: (key) => storage.get(prefixKey(key)),

      getUint8Array: (key) => storage.getUint8Array(prefixKey(key)),

      set: (key, value) => storage.set(prefixKey(key), value).pipe(Effect.asVoid),

      remove: (key) => storage.remove(prefixKey(key)).pipe(Effect.asVoid),

      clear: storage.clear,

      size: storage.size,
    });
  })
);

// -----------------------------------------------------------------------------
// Workflow Persistence Layers
// -----------------------------------------------------------------------------

/**
 * Production persistence layer backed by GCS.
 *
 * **Details**
 *
 * Layer composition:
 *   BackingPersistence <- KeyValueStore <- StorageService <- ConfigService
 *
 * **Example** (Inspect workflow persistence live)
 *
 * ```ts
 * import { WorkflowPersistenceLive } from "@effect-ontology/Service/WorkflowPersistence"
 *
 * import { Layer } from "effect"
 * import { WorkflowPersistenceLive, WorkflowPersistenceMemory } from "@effect-ontology/Service/WorkflowPersistence"
 *
 * const layer = Layer.merge(WorkflowPersistenceLive, WorkflowPersistenceMemory)
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkflowPersistenceLive = Persistence.layerKvs.pipe(
  Layer.provide(StorageKeyValueStoreLive),
  Layer.provide(StorageServiceLive)
);

/**
 * Test persistence layer (in-memory).
 *
 * **Details**
 *
 * Uses memory-backed storage - no GCS credentials required.
 * Fast and deterministic for unit tests.
 *
 * **Example** (Inspect workflow persistence test)
 *
 * ```ts
 * import { WorkflowPersistenceTest } from "@effect-ontology/Service/WorkflowPersistence"
 *
 * import { Layer } from "effect"
 * import { WorkflowPersistenceMemory, WorkflowPersistenceTest } from "@effect-ontology/Service/WorkflowPersistence"
 *
 * const layer = Layer.merge(WorkflowPersistenceTest, WorkflowPersistenceMemory)
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkflowPersistenceTest = Persistence.layerKvs.pipe(
  Layer.provide(StorageKeyValueStoreLive),
  Layer.provide(StorageServiceTest)
);

/**
 * Pure in-memory persistence (no StorageService dependency).
 *
 * **Details**
 *
 * The simplest option for isolated unit tests.
 *
 * **Example** (Inspect workflow persistence memory)
 *
 * ```ts
 * import { WorkflowPersistenceMemory } from "@effect-ontology/Service/WorkflowPersistence"
 *
 * import { Layer } from "effect"
 * import { WorkflowPersistenceMemory } from "@effect-ontology/Service/WorkflowPersistence"
 *
 * console.log(Layer.merge(WorkflowPersistenceMemory, WorkflowPersistenceMemory))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const WorkflowPersistenceMemory = Persistence.layerMemory;

// -----------------------------------------------------------------------------
// Re-exports for convenience
// -----------------------------------------------------------------------------

export { Persistence } from "effect/unstable/persistence";
