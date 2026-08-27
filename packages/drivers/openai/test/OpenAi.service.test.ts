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
  OpenAiLanguageModelOptions,
  OpenAiLive,
} from "@beep/openai";
import { PosInt } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { OpenAiClient } from "@effect/ai-openai";
import { describe, expect, it } from "@effect/vitest";
import { Config, ConfigProvider, Effect, Layer, pipe, Redacted } from "effect";
import * as S from "effect/Schema";
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

const OpenAiEmbeddingRequestBody = S.Struct({
  dimensions: S.Finite,
  input: S.Array(S.String),
  model: S.NonEmptyString,
});

const OpenAiLanguageRequestBody = S.Struct({ model: S.NonEmptyString });

const decodeEmbeddingRequestBody = S.decodeUnknownEffect(S.fromJsonString(OpenAiEmbeddingRequestBody));
const decodeLanguageRequestBody = S.decodeUnknownEffect(S.fromJsonString(OpenAiLanguageRequestBody));

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

const requestBodyText = (request: HttpClientRequest.HttpClientRequest) =>
  request.body._tag === "Uint8Array"
    ? Effect.succeed(new TextDecoder().decode(request.body.body))
    : Effect.die("Expected a Uint8Array request body");

describe("OpenAI model Layers", () => {
  it.effect(
    "provides Dimensions and round-trips embedMany through a stubbed HttpClient",
    Effect.fnUntraced(function* () {
      const dimensions = PosInt.make(2);
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined;
      const clientLayer = makeOpenAiClientLayer((request) => {
        capturedRequest = request;
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

      expect(capturedRequest).toBeDefined();
      if (capturedRequest === undefined) {
        return yield* Effect.die("Expected an embedding request");
      }
      const requestBody = yield* capturedRequest.pipe(requestBodyText, Effect.flatMap(decodeEmbeddingRequestBody));

      expect(capturedRequest.method).toBe("POST");
      expect(capturedRequest.url).toBe("https://api.openai.com/v1/embeddings");
      expect(capturedRequest.headers.authorization).toBe("Bearer fixture");
      expect(requestBody).toEqual({ dimensions: 2, input: ["first", "second"], model: "text-embedding-3-small" });
      expect(response.embeddings).toEqual([{ vector: [10, 11] }, { vector: [20, 21] }]);
      expect(response.usage.inputTokens).toBe(7);
    })
  );

  it.effect(
    "forwards an explicit language model and exposes its model metadata through the stubbed client boundary",
    Effect.fnUntraced(function* () {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined;
      const clientLayer = makeOpenAiClientLayer((request) => {
        capturedRequest = request;
        return Effect.succeed(
          new Response(
            JSON.stringify({
              created_at: 1,
              error: null,
              id: "resp_fixture",
              incomplete_details: null,
              instructions: null,
              metadata: null,
              model: "gpt-4.1-mini",
              object: "response",
              output: [],
              parallel_tool_calls: false,
              status: "completed",
              temperature: null,
              tool_choice: "auto",
              tools: [],
              top_p: null,
            }),
            { headers: { "content-type": "application/json" }, status: 200 }
          )
        );
      });
      const languageLayer = makeOpenAiLanguageModelLayer(
        OpenAiLanguageModelOptions.make({ model: "gpt-4.1-mini" })
      ).pipe(Layer.provide(clientLayer));

      const result = yield* Effect.all({
        modelName: AiModel.ModelName,
        providerName: AiModel.ProviderName,
        response: LanguageModel.generateText({ prompt: "test" }),
      }).pipe(provideScopedLayer(languageLayer));

      expect(capturedRequest).toBeDefined();
      if (capturedRequest === undefined) {
        return yield* Effect.die("Expected a language-model request");
      }
      const requestBody = yield* capturedRequest.pipe(requestBodyText, Effect.flatMap(decodeLanguageRequestBody));

      expect(capturedRequest.method).toBe("POST");
      expect(capturedRequest.url).toBe("https://api.openai.com/v1/responses");
      expect(requestBody.model).toBe("gpt-4.1-mini");
      expect(result.modelName).toBe("gpt-4.1-mini");
      expect(result.providerName).toBe("openai");
    })
  );

  it.effect(
    "retains malformed provider output as AiError",
    Effect.fnUntraced(function* () {
      const clientLayer = makeOpenAiClientLayer(() =>
        Effect.succeed(
          new Response('{"data":"invalid"}', {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        )
      );
      const embeddingLayer = makeOpenAiEmbeddingModelLayer(
        OpenAiEmbeddingModelOptions.make({ dimensions: PosInt.make(2) })
      ).pipe(Layer.provide(clientLayer));

      const error = yield* EmbeddingModel.EmbeddingModel.pipe(
        Effect.flatMap((model) => model.embedMany(["input"])),
        provideScopedLayer(embeddingLayer),
        Effect.flip
      );

      expect(error._tag).toBe("AiError");
      expect(error.reason._tag).toBe("InvalidOutputError");
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

  it.effect(
    "fails acquisition when the API key is missing and defaults blank model overrides",
    Effect.fnUntraced(function* () {
      const missingKeyLayer = OpenAiLive.pipe(Layer.provide(makeConfigProviderLayer({})));
      const blankLanguageLayer = OpenAiLanguageModelLive.pipe(
        Layer.provide(makeConfigProviderLayer({ [OPENAI_API_KEY_ENV]: "fixture", [OPENAI_MODEL_ENV]: "" }))
      );
      const blankEmbeddingLayer = makeOpenAiEmbeddingModelLive(PosInt.make(2)).pipe(
        Layer.provide(makeConfigProviderLayer({ [OPENAI_API_KEY_ENV]: "fixture", [OPENAI_EMBEDDING_MODEL_ENV]: "" }))
      );

      const missingKeyError = yield* OpenAiClient.OpenAiClient.pipe(provideScopedLayer(missingKeyLayer), Effect.flip);
      const blankLanguageModel = yield* AiModel.ModelName.pipe(provideScopedLayer(blankLanguageLayer));
      const blankEmbeddingModel = yield* AiModel.ModelName.pipe(provideScopedLayer(blankEmbeddingLayer));

      expect(missingKeyError).toBeInstanceOf(Config.ConfigError);
      expect(blankLanguageModel).toBe(OPENAI_DEFAULT_MODEL);
      expect(blankEmbeddingModel).toBe(OPENAI_DEFAULT_EMBEDDING_MODEL);
    })
  );
});
