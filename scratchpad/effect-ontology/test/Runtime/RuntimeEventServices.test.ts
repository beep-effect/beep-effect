import { $ScratchpadId } from "@beep/identity";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Fiber, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { InferenceRunResponse } from "../../Domain/Schema/Inference.ts";
import { EventBridgeLive, EventBridgeService } from "../../Runtime/EventBridge.ts";
import { EventBroadcastHubMemory } from "../../Runtime/EventBroadcastRouter.ts";
import { InferenceJobStore, InferenceJobStoreLive } from "../../Runtime/InferenceRouter.ts";
import { EventBusService, EventBusServiceMemory } from "../../Service/EventBus.ts";

const $I = $ScratchpadId.create("effect-ontology/test/Runtime/RuntimeEventServices.test");

interface InferenceStoreShape {
  readonly get: (jobId: string) => Effect.Effect<O.Option<InferenceRunResponse>>;
  readonly put: (response: InferenceRunResponse) => Effect.Effect<void>;
}

class FirstInferenceStore extends Context.Service<FirstInferenceStore, InferenceStoreShape>()(
  $I`FirstInferenceStore`
) {}

class SecondInferenceStore extends Context.Service<SecondInferenceStore, InferenceStoreShape>()(
  $I`SecondInferenceStore`
) {}

const FirstInferenceStoreLive = Layer.effect(FirstInferenceStore, InferenceJobStore).pipe(
  Layer.provide(Layer.fresh(InferenceJobStoreLive))
);

const SecondInferenceStoreLive = Layer.effect(SecondInferenceStore, InferenceJobStore).pipe(
  Layer.provide(Layer.fresh(InferenceJobStoreLive))
);

const IsolatedInferenceStores = Layer.merge(FirstInferenceStoreLive, SecondInferenceStoreLive);

describe("InferenceJobStore", () => {
  it.layer(IsolatedInferenceStores)("with isolated runtime-local stores", (it) => {
    it.effect(
      "isolates two layer instances and evicts the oldest bounded entry",
      Effect.fnUntraced(function* () {
        const first = yield* FirstInferenceStore;
        const second = yield* SecondInferenceStore;
        const retained = InferenceRunResponse.make({ jobId: "job-retained", status: "processing" });
        yield* first.put(retained);

        assert.isTrue(O.isNone(yield* second.get(retained.jobId)));

        yield* Effect.forEach(
          A.range(0, 256),
          (index) => first.put(InferenceRunResponse.make({ jobId: `job-${index}`, status: "processing" })),
          { concurrency: 1, discard: true }
        );
        assert.isTrue(O.isNone(yield* first.get("job-retained")));
        assert.isTrue(O.isSome(yield* first.get("job-256")));
      })
    );
  });
});

const EventBridgeTest = EventBridgeLive.pipe(
  Layer.provideMerge(Layer.merge(EventBusServiceMemory, EventBroadcastHubMemory))
);

describe("EventBridge", () => {
  it.layer(EventBridgeTest)("with scoped event services", (it) => {
    it.effect(
      "preserves interruption when the event stream shuts down",
      Effect.fnUntraced(function* () {
        const bridge = yield* EventBridgeService;
        const eventBus = yield* EventBusService;
        const handle = yield* bridge.start;
        const observed = yield* handle.await.pipe(Effect.exit, Effect.forkScoped);

        yield* eventBus.shutdown;

        const exit = yield* Fiber.join(observed);
        assert.isTrue(Exit.isFailure(exit));
        if (Exit.isFailure(exit)) {
          assert.isTrue(Cause.hasInterruptsOnly(exit.cause));
        }
      })
    );
  });
});
