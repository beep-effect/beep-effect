import { WinkLayerAllLive } from "@beep/wink/Wink.layer";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { EmbeddingService } from "../../Service/Embedding.ts";
import { NlpService } from "../../Service/Nlp.ts";

const EmbeddingServiceTest = Layer.succeed(
  EmbeddingService,
  EmbeddingService.of({
    embed: Effect.fn("EmbeddingService.embed")(() => Effect.succeed([1])),
    embedBatch: Effect.fn("EmbeddingService.embedBatch")((texts) => Effect.succeed(texts.map(() => [1]))),
    cosineSimilarity: () => 1,
    getProviderMetadata: Effect.succeed({
      providerId: "nomic",
      modelId: "test",
      dimension: 1,
    }),
  })
);

const NlpServiceTest = Layer.effect(NlpService, NlpService.make).pipe(
  Layer.provide([EmbeddingServiceTest, WinkLayerAllLive])
);

describe("NlpService canonical Wink adapter", () => {
  it.layer(NlpServiceTest)("with canonical Wink services", (it) => {
    it.effect("decodes canonical Wink token, sentence, and entity output", () =>
      Effect.gen(function* () {
        const nlp = yield* NlpService;
        const result = yield* nlp.tokenize("Ada Lovelace wrote the first algorithm.");

        assert.include(result.tokens, "ada");
        assert.isAtLeast(result.sentences.length, 1);
        assert.isArray(result.entities);
      })
    );

    it.effect("ranks documents without exposing a Wink runtime index", () =>
      Effect.gen(function* () {
        const nlp = yield* NlpService;
        const results = yield* nlp.searchSimilar("semantic graph", ["semantic graph model", "weather report"], 2);

        assert.isAtLeast(results.length, 1);
        assert.strictEqual(results[0].index, 0);
        assert.strictEqual(results[0].doc, "semantic graph model");
      })
    );
  });
});
