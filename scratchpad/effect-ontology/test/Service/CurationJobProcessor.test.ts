import { PgliteTestLayer } from "@beep/pglite";
import { makeDrizzleLayer } from "@beep/postgres";
import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Layer, Ref } from "effect";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { EntityRegistryRepository } from "../../Repository/EntityRegistry.ts";
import { CurationJobProcessor } from "../../Service/CurationJobProcessor.ts";
import { EmbeddingService } from "../../Service/Embedding.ts";
import type { EventBusServiceMethods } from "../../Service/EventBus.ts";
import { EventBusService } from "../../Service/EventBus.ts";

const DatabaseTestLayer = makeDrizzleLayer().pipe(Layer.provideMerge(PgliteTestLayer));

const EmbeddingServiceTest = Layer.succeed(
  EmbeddingService,
  EmbeddingService.of({
    embed: Effect.fn("CurationJobProcessorTest.embed")(() => Effect.die("EmbeddingServiceTest.embed is unused")),
    embedBatch: Effect.fn("CurationJobProcessorTest.embedBatch")(() =>
      Effect.die("EmbeddingServiceTest.embedBatch is unused")
    ),
    cosineSimilarity: () => 0,
    getProviderMetadata: Effect.succeed({ providerId: "nomic", modelId: "test", dimension: 1 }),
  })
);

const CurationProcessorDependencies = Layer.mergeAll(EntityRegistryRepository.Default, EmbeddingServiceTest).pipe(
  Layer.provideMerge(DatabaseTestLayer)
);

describe("CurationJobProcessor", () => {
  it.layer(CurationProcessorDependencies)("with scoped background polling", (it) => {
    it.effect(
      "polls while its scope is open and stops when the scope closes",
      Effect.fnUntraced(function* () {
        const polls = yield* Ref.make(0);
        const processJob: EventBusServiceMethods["processJob"] = () => Effect.succeedNone;
        const eventBus = EventBusService.of({
          publishCurationEvent: Effect.fn("CurationJobProcessorTest.publishCurationEvent")(() => Effect.void),
          publishExtractionEvent: Effect.fn("CurationJobProcessorTest.publishExtractionEvent")(() => Effect.void),
          enqueueJob: Effect.fn("CurationJobProcessorTest.enqueueJob")(() => Effect.succeed("job-unused")),
          takeJob: Effect.succeedNone,
          processJob,
          subscribeEvents: Effect.succeed(Stream.empty),
          pendingJobCount: Ref.updateAndGet(polls, (count) => count + 1).pipe(Effect.as(0)),
          shutdown: Effect.void,
        });
        const processor = yield* CurationJobProcessor.make.pipe(Effect.provideService(EventBusService, eventBus));

        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* processor.runBackground(Duration.millis(5));
            yield* TestClock.adjust(Duration.millis(25));
            assert.isAbove(yield* Ref.get(polls), 0);
          })
        );

        const pollsAtScopeClose = yield* Ref.get(polls);
        yield* TestClock.adjust(Duration.millis(25));
        assert.strictEqual(yield* Ref.get(polls), pollsAtScopeClose);
      })
    );
  });
});
