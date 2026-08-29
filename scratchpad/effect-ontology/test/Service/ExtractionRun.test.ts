import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SystemError } from "effect/PlatformError";
import { KeyValueStore } from "effect/unstable/persistence";
import { IdempotencyKey } from "../../Domain/Identity.ts";
import { ExtractionRunError, ExtractionRunService, ExtractionRunServiceLive } from "../../Service/ExtractionRun.ts";
import { StorageService, StorageServiceTest } from "../../Service/Storage.ts";

const key = IdempotencyKey.make("a".repeat(64));

const FailingStorage = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const storage = yield* StorageService;
    return StorageService.of({
      ...storage,
      getOption: Effect.fn("ExtractionRunTest.Storage.getOption")((storageKey) =>
        Effect.fail(
          new KeyValueStore.KeyValueStoreError({
            method: "get",
            key: storageKey,
            message: "Injected extraction-run read failure",
          })
        )
      ),
      list: Effect.fn("ExtractionRunTest.Storage.list")((prefix) =>
        Effect.fail(
          new SystemError({
            _tag: "Unknown",
            module: "KeyValueStore",
            method: "list",
            pathOrDescriptor: prefix,
            description: "Injected extraction-run list failure",
          })
        )
      ),
    });
  })
).pipe(Layer.provide(StorageServiceTest));

const CorruptIndexStorage = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const storage = yield* StorageService;
    yield* storage.set("runs/key-index.json", "not-json");
    return storage;
  })
).pipe(Layer.provide(StorageServiceTest));

const MissingIndexLayer = ExtractionRunServiceLive.pipe(Layer.provide(StorageServiceTest));
const FailingStorageLayer = ExtractionRunServiceLive.pipe(Layer.provide(FailingStorage));
const CorruptIndexLayer = ExtractionRunServiceLive.pipe(Layer.provide(CorruptIndexStorage));

describe("ExtractionRunService storage boundaries", () => {
  it.layer(MissingIndexLayer)("with an absent idempotency index", (it) => {
    it.effect(
      "initializes only missing index state as empty",
      Effect.fnUntraced(function* () {
        const runs = yield* ExtractionRunService;
        assert.isFalse(yield* runs.existsByKey(key));
      })
    );
  });

  it.layer(CorruptIndexLayer)("with a corrupt idempotency index", (it) => {
    it.effect(
      "preserves the decode failure",
      Effect.fnUntraced(function* () {
        const runs = yield* ExtractionRunService;
        const error = yield* runs.existsByKey(key).pipe(Effect.flip);

        assert.instanceOf(error, ExtractionRunError);
        assert.strictEqual(error.message, "Failed to decode extraction idempotency index");
      })
    );
  });

  it.layer(FailingStorageLayer)("with failed durable storage", (it) => {
    it.effect(
      "preserves read and list failures",
      Effect.fnUntraced(function* () {
        const runs = yield* ExtractionRunService;
        const readError = yield* runs.existsByKey(key).pipe(Effect.flip);
        const listError = yield* runs.listRuns.pipe(Effect.flip);

        assert.instanceOf(readError, ExtractionRunError);
        assert.strictEqual(readError.message, "Failed to read extraction idempotency index");
        assert.instanceOf(listError, ExtractionRunError);
        assert.strictEqual(listError.message, "Failed to list extraction runs");
      })
    );
  });
});
