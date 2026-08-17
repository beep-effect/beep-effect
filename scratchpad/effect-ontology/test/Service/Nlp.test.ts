import { PosInt } from "@beep/schema/Int";
import { WinkLayerAllLive } from "@beep/wink/Wink.layer";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { EmbeddingService } from "../../Service/Embedding.ts";
import { NlpIndexError, NlpService } from "../../Service/Nlp.ts";

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
  it.effect("models index failures with the canonical schema and defect cause", () =>
    Effect.gen(function* () {
      const cause = yield* S.decodeUnknownEffect(S.Finite)("query unavailable").pipe(Effect.flip);
      const error = NlpIndexError.make({
        indexKind: "bm25",
        message: "Canonical Wink corpus query failed",
        cause: O.some(cause),
      });

      assert.isTrue(S.is(NlpIndexError)(error));
      assert.deepEqual(error.cause, O.some(cause));
    })
  );

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
        const results = yield* nlp.searchSimilar(
          "semantic graph",
          ["semantic graph model", "weather report"],
          PosInt.make(2)
        );

        assert.isAtLeast(results.length, 1);
        assert.strictEqual(results[0].index, 0);
        assert.strictEqual(results[0].doc, "semantic graph model");
      })
    );
  });
});
