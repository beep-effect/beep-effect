import { PgliteTestLayer } from "@beep/pglite";
import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer, PubSub, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { KeyValueStore } from "effect/unstable/persistence";
import { BatchId, OntologyName } from "../../Domain/Identity.ts";
import { BatchState } from "../../Domain/Model/BatchWorkflow.ts";
import { PathLayout } from "../../Domain/PathLayout.ts";
import { BackgroundJobId, PromptCacheJob } from "../../Domain/Schema/JobSchema.ts";
import { BatchStateHub, BatchStateHubLayer, getBatchStateFromStore, publishState } from "../../Service/BatchState.ts";
import { BatchStateBridge, BatchStateBridgeLive } from "../../Service/BatchStateBridge.ts";
import { EventBusService, EventBusServiceMemory, EventBusServiceSqlLive } from "../../Service/EventBus.ts";
import { StorageService, StorageServiceTest } from "../../Service/Storage.ts";

const makePendingState = Effect.fn("BatchStateEventBusTest.makePendingState")(function* (batchId: BatchId) {
  const now = yield* DateTime.now;
  return yield* S.decodeEffect(BatchState)({
    _tag: "Pending",
    batchId,
    ontologyId: "premier_league",
    manifestUri: "gs://beep-ontology/manifest.json",
    ontologyVersion: "football/premier_league@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    createdAt: DateTime.formatIso(now),
    updatedAt: DateTime.formatIso(now),
    documentCount: 0,
  });
});

const BatchStateChangedPayload = S.Struct({
  batchId: BatchId,
  ontologyId: OntologyName,
  state: BatchState,
  timestamp: S.DateTimeUtcFromString,
});

const StateTestLayer = Layer.merge(BatchStateHubLayer, StorageServiceTest);

const FailingStorageService = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const storage = yield* StorageService;
    return StorageService.of({
      ...storage,
      set: Effect.fn("StorageService.set")((key) =>
        Effect.fail(
          new KeyValueStore.KeyValueStoreError({
            method: "set",
            key,
            message: "Injected persistence failure",
          })
        )
      ),
    });
  })
).pipe(Layer.provide(StorageServiceTest));

const FailingStateTestLayer = Layer.merge(BatchStateHubLayer, FailingStorageService);

const BridgeTestLayer = BatchStateBridgeLive.pipe(
  Layer.provideMerge(Layer.merge(BatchStateHubLayer, EventBusServiceMemory))
);

const SqlEventBusTestLayer = EventBusServiceSqlLive.pipe(Layer.provideMerge(PgliteTestLayer));

const queueLifecycle = Effect.fn("BatchStateEventBusTest.queueLifecycle")(function* () {
  const eventBus = yield* EventBusService;
  const now = yield* DateTime.now;
  const makeJob = (id: BackgroundJobId, exampleId: string) =>
    PromptCacheJob.make({
      id,
      ontologyId: OntologyName.make("queue_test"),
      exampleId,
      isNegative: false,
      createdAt: now,
    });

  yield* eventBus.enqueueJob(makeJob(BackgroundJobId.make("job-000000000001"), "take-example"));
  const afterEnqueueForTake = yield* eventBus.pendingJobCount;
  const taken = yield* eventBus.takeJob;
  const afterTake = yield* eventBus.pendingJobCount;

  yield* eventBus.enqueueJob(makeJob(BackgroundJobId.make("job-000000000002"), "process-example"));
  const afterEnqueueForProcess = yield* eventBus.pendingJobCount;
  const processed = yield* eventBus.processJob(() => Effect.succeed("processed"));
  const afterProcess = yield* eventBus.pendingJobCount;

  assert.isTrue(O.isSome(taken));
  assert.deepEqual(processed, O.some("processed"));
  return [afterEnqueueForTake, afterTake, afterEnqueueForProcess, afterProcess];
});

describe("BatchState persistence", () => {
  it.layer(StateTestLayer)("with in-memory storage", (it) => {
    it.effect(
      "round-trips a durable state and publishes it after persistence",
      Effect.fnUntraced(function* () {
        const state = yield* makePendingState(BatchId.make("batch-deadbeefcafe"));
        const hub = yield* BatchStateHub;
        const subscription = yield* PubSub.subscribe(hub);

        yield* publishState(state);

        const stored = yield* getBatchStateFromStore(state.batchId);
        const published = yield* PubSub.take(subscription);

        assert.deepEqual(stored, O.some(state));
        assert.deepEqual(published, state);
      })
    );

    it.effect(
      "distinguishes corrupt durable state from an absent state",
      Effect.fnUntraced(function* () {
        const batchId = BatchId.make("batch-feedfacecafe");
        const storage = yield* StorageService;
        yield* storage.set(PathLayout.batch.status(batchId), "not-json");

        const error = yield* getBatchStateFromStore(batchId).pipe(Effect.flip);

        assert.strictEqual(error._tag, "BatchStateDecodeError");
        assert.strictEqual(error.batchId, batchId);
      })
    );
  });

  it.layer(FailingStateTestLayer)("with failing storage", (it) => {
    it.effect(
      "does not publish a state that failed to persist",
      Effect.fnUntraced(function* () {
        const state = yield* makePendingState(BatchId.make("batch-cafebabefeed"));
        const hub = yield* BatchStateHub;
        const subscription = yield* PubSub.subscribe(hub);

        const error = yield* publishState(state).pipe(Effect.flip);
        const published = yield* PubSub.takeUpTo(subscription, 1);

        assert.strictEqual(error._tag, "BatchStatePersistenceError");
        assert.isTrue(A.isReadonlyArrayEmpty(published));
      })
    );
  });
});

describe("BatchStateBridge", () => {
  it.layer(BridgeTestLayer)("with the canonical in-memory EventBus", (it) => {
    it.effect(
      "publishes canonical repeated state events and tracks stream exit",
      Effect.fnUntraced(function* () {
        const state = yield* makePendingState(BatchId.make("batch-acdeabcdef12"));
        const bridge = yield* BatchStateBridge;
        const hub = yield* BatchStateHub;
        const eventBus = yield* EventBusService;
        const events = yield* eventBus.subscribeEvents;

        assert.isTrue(yield* bridge.isRunning);
        yield* PubSub.publish(hub, state);
        yield* PubSub.publish(hub, state);
        yield* Effect.repeat(Effect.yieldNow, { times: 4 });
        assert.isTrue(yield* bridge.isRunning);

        const entries = yield* Stream.runCollect(Stream.take(events, 2));
        const first = yield* A.head(entries).pipe(
          O.match({
            onNone: () => Effect.die("Expected a BatchStateChanged event"),
            onSome: Effect.succeed,
          })
        );
        const encodedPayload = yield* S.encodeUnknownEffect(BatchStateChangedPayload)(first.payload);
        const payload = yield* S.decodeEffect(BatchStateChangedPayload)(encodedPayload);

        assert.strictEqual(A.length(entries), 2);
        assert.strictEqual(first.event, "BatchStateChanged");
        assert.strictEqual(first.primaryKey, `batch:${state.batchId}`);
        assert.strictEqual(payload.batchId, state.batchId);
        assert.strictEqual(payload.ontologyId, "premier_league");
        assert.strictEqual(payload.state._tag, "Pending");
        assert.strictEqual(DateTime.toEpochMillis(payload.timestamp), DateTime.toEpochMillis(state.updatedAt));

        yield* PubSub.shutdown(hub);
        yield* Effect.repeat(Effect.yieldNow, { times: 4 });
        assert.isFalse(yield* bridge.isRunning);
      })
    );
  });
});

describe("EventBus queue backend parity", () => {
  it.layer(EventBusServiceMemory)("with the memory backend", (it) => {
    it.effect(
      "tracks enqueue, take, and process lifecycle counts",
      Effect.fnUntraced(function* () {
        assert.deepEqual(yield* queueLifecycle(), [1, 0, 1, 0]);
      })
    );
  });

  it.layer(SqlEventBusTestLayer)("with the SQL backend", (it) => {
    it.effect(
      "tracks enqueue, take, and process lifecycle counts",
      Effect.fnUntraced(function* () {
        assert.deepEqual(yield* queueLifecycle(), [1, 0, 1, 0]);
      })
    );
  });
});
