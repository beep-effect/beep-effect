import {
  makeOpenAiEmbeddingModelLayer,
  makeOpenAiEmbeddingModelLive,
  makeOpenAiLanguageModelLayer,
  OPENAI_API_KEY_ENV,
  OPENAI_DEFAULT_EMBEDDING_MODEL,
  OPENAI_DEFAULT_MODEL,
  OPENAI_EMBEDDING_MODEL_ENV,
  OPENAI_MODEL_ENV,
  OpenAiEmbeddingModelOptions,
  OpenAiLanguageModelLive,
} from "@beep/openai";
import { PosInt } from "@beep/schema";
import { OpenAiClient } from "@effect/ai-openai";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, pipe, Redacted } from "effect";
import * as EmbeddingModel from "effect/unstable/ai/EmbeddingModel";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as AiModel from "effect/unstable/ai/Model";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";

type TestRespond = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

const makeHttpClientLayer = (respond: TestRespond): Layer.Layer<HttpClient.HttpClient> =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.succeed(
      HttpClient.make((request) =>
        pipe(
          respond(request),
          Effect.map((response) => HttpClientResponse.fromWeb(request, response))
        )
      )
    )
  );

const makeOpenAiClientLayer = (respond: TestRespond) =>
  OpenAiClient.layer({ apiKey: Redacted.make("fixture") }).pipe(Layer.provide(makeHttpClientLayer(respond)));

const makeConfigProviderLayer = (env: Readonly<Record<string, string>>) =>
  ConfigProvider.layer(ConfigProvider.fromEnv({ env }));

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("OpenAI model Layers", () => {
  it.effect(
    "provides Dimensions and round-trips embedMany through a stubbed HttpClient",
    Effect.fnUntraced(function* () {
      const dimensions = PosInt.make(2);
      const clientLayer = makeOpenAiClientLayer((request) => {
        expect(request.url).toBe("https://api.openai.com/v1/embeddings");
        return Effect.succeed(
          new Response(
            '{"data":[{"index":1,"embedding":[20,21],"object":"embedding"},{"index":0,"embedding":[10,11],"object":"embedding"}],"model":"text-embedding-3-small","object":"list","usage":{"prompt_tokens":7,"total_tokens":7}}',
            { headers: { "content-type": "application/json" }, status: 200 }
          )
        );
      });

      const embeddingLayer = makeOpenAiEmbeddingModelLayer(OpenAiEmbeddingModelOptions.make({ dimensions })).pipe(
        Layer.provide(clientLayer)
      );
      const response = yield* Effect.gen(function* () {
        const providedDimensions = yield* EmbeddingModel.Dimensions;
        const model = yield* EmbeddingModel.EmbeddingModel;
        const embedded = yield* model.embedMany(["first", "second"]);

        expect(providedDimensions).toBe(dimensions);
        return embedded;
      }).pipe(provideScopedLayer(embeddingLayer));

      expect(response.embeddings).toEqual([{ vector: [10, 11] }, { vector: [20, 21] }]);
      expect(response.usage.inputTokens).toBe(7);
    })
  );

  it.effect(
    "provides LanguageModel over the same stubbed client boundary",
    Effect.fnUntraced(function* () {
      const clientLayer = makeOpenAiClientLayer(() => Effect.die("unexpected HTTP request"));
      const languageLayer = makeOpenAiLanguageModelLayer().pipe(Layer.provide(clientLayer));

      const languageModel = yield* LanguageModel.LanguageModel.pipe(provideScopedLayer(languageLayer));

      expect(languageModel).toBeDefined();
    })
  );

  it.effect(
    "resolves default model ids when the model environment variables are absent",
    Effect.fnUntraced(function* () {
      const configProvider = makeConfigProviderLayer({ [OPENAI_API_KEY_ENV]: "fixture" });
      const languageLayer = OpenAiLanguageModelLive.pipe(Layer.provide(configProvider));
      const embeddingLayer = makeOpenAiEmbeddingModelLive(PosInt.make(2)).pipe(Layer.provide(configProvider));

      const languageModelName = yield* AiModel.ModelName.pipe(provideScopedLayer(languageLayer));
      const embedding = yield* Effect.all({
        dimensions: EmbeddingModel.Dimensions,
        modelName: AiModel.ModelName,
      }).pipe(provideScopedLayer(embeddingLayer));

      expect(languageModelName).toBe(OPENAI_DEFAULT_MODEL);
      expect(embedding.modelName).toBe(OPENAI_DEFAULT_EMBEDDING_MODEL);
      expect(embedding.dimensions).toBe(2);
    })
  );

  it.effect(
    "resolves model id overrides from the language and embedding environment bindings",
    Effect.fnUntraced(function* () {
      const configProvider = makeConfigProviderLayer({
        [OPENAI_API_KEY_ENV]: "fixture",
        [OPENAI_EMBEDDING_MODEL_ENV]: "text-embedding-3-large",
        [OPENAI_MODEL_ENV]: "gpt-4.1-mini",
      });
      const languageLayer = OpenAiLanguageModelLive.pipe(Layer.provide(configProvider));
      const embeddingLayer = makeOpenAiEmbeddingModelLive(PosInt.make(3)).pipe(Layer.provide(configProvider));

      const languageModelName = yield* AiModel.ModelName.pipe(provideScopedLayer(languageLayer));
      const embeddingModelName = yield* AiModel.ModelName.pipe(provideScopedLayer(embeddingLayer));

      expect(languageModelName).toBe("gpt-4.1-mini");
      expect(embeddingModelName).toBe("text-embedding-3-large");
    })
  );
});
