import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";
import { StorageService, StorageServiceTest } from "../../Service/Storage.ts";
import { StorageKeyValueStoreLive } from "../../Service/WorkflowPersistence.ts";

const ReadFailureStorage = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const storage = yield* StorageService;
    return StorageService.of({
      ...storage,
      get: Effect.fn("WorkflowPersistenceTest.Storage.get")((key) =>
        Effect.fail(
          new KeyValueStore.KeyValueStoreError({
            method: "get",
            key,
            message: "Injected workflow persistence read failure",
          })
        )
      ),
    });
  })
).pipe(Layer.provide(StorageServiceTest));

const FailingWorkflowKeyValueStore = StorageKeyValueStoreLive.pipe(Layer.provide(ReadFailureStorage));

describe("WorkflowPersistence", () => {
  it.layer(FailingWorkflowKeyValueStore)("with failing storage", (it) => {
    it.effect(
      "preserves a storage read failure instead of returning missing",
      Effect.fnUntraced(function* () {
        const storage = yield* KeyValueStore.KeyValueStore;
        const error = yield* storage.get("workflow-id").pipe(Effect.flip);

        assert.instanceOf(error, KeyValueStore.KeyValueStoreError);
        assert.strictEqual(error.key, "workflow-state/workflow-id");
      })
    );
  });
});
