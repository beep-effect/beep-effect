/**
 * Effect AI client and model Layers for the OpenAI provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { OpenAiClient, OpenAiEmbeddingModel, OpenAiLanguageModel } from "@effect/ai-openai";
import { Config, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import {
  OPENAI_API_KEY_ENV,
  OPENAI_DEFAULT_EMBEDDING_MODEL,
  OPENAI_DEFAULT_MODEL,
  OPENAI_EMBEDDING_MODEL_ENV,
  OPENAI_MODEL_ENV,
  OpenAiEmbeddingModelOptions,
  OpenAiLanguageModelOptions,
} from "./OpenAi.config.ts";
import type { PosInt } from "@beep/schema";

/**
 * Live OpenAI client Layer backed by a redacted Effect Config value and Fetch.
 *
 * **Example** (Check the live client Layer type)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { OpenAiLive } from "@beep/openai"
 * import type { OpenAiClient } from "@effect/ai-openai"
 * import type { Config, Layer } from "effect"
 *
 * const layer: Layer.Layer<OpenAiClient.OpenAiClient, Config.ConfigError, never> = OpenAiLive
 *
 * strictEqual(typeof layer, "object")
 * ```
 *
 * @effects Reads `AI_OPENAI_API_KEY` when the Layer is acquired and provides a Fetch HTTP client.
 * @category layers
 * @since 0.0.0
 */
export const OpenAiLive: Layer.Layer<OpenAiClient.OpenAiClient, Config.ConfigError, never> = OpenAiClient.layerConfig({
  apiKey: Config.redacted(OPENAI_API_KEY_ENV),
}).pipe(Layer.provide(FetchHttpClient.layer));

/**
 * Builds an OpenAI language-model Layer while leaving `OpenAiClient` to the caller.
 *
 * **Example** (Build a language-model Layer)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { makeOpenAiLanguageModelLayer, OpenAiLanguageModelOptions } from "@beep/openai"
 *
 * const layer = makeOpenAiLanguageModelLayer(
 *   OpenAiLanguageModelOptions.make({ model: "gpt-4o-mini" })
 * )
 *
 * strictEqual(typeof layer, "object")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeOpenAiLanguageModelLayer = (
  options: OpenAiLanguageModelOptions = OpenAiLanguageModelOptions.make({})
) => OpenAiLanguageModel.layer({ model: options.model });

/**
 * Builds an OpenAI embedding-model Layer that also provides its vector dimensions.
 *
 * **Details**
 *
 * This factory uses `OpenAiEmbeddingModel.model()` rather than `.layer()` so
 * consumers receive both `EmbeddingModel.EmbeddingModel` and
 * `EmbeddingModel.Dimensions`. It leaves `OpenAiClient` to the caller.
 *
 * **Example** (Build an embedding-model Layer)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { makeOpenAiEmbeddingModelLayer, OpenAiEmbeddingModelOptions } from "@beep/openai"
 * import { PosInt } from "@beep/schema"
 *
 * const layer = makeOpenAiEmbeddingModelLayer(
 *   OpenAiEmbeddingModelOptions.make({ dimensions: PosInt.make(1536) })
 * )
 *
 * strictEqual(typeof layer, "object")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeOpenAiEmbeddingModelLayer = (options: OpenAiEmbeddingModelOptions) =>
  OpenAiEmbeddingModel.model(options.model, { dimensions: options.dimensions });

/**
 * Live language-model Layer whose model id comes from Effect Config.
 *
 * **Details**
 *
 * `AI_OPENAI_MODEL` overrides {@link OPENAI_DEFAULT_MODEL}. The Layer provides
 * `OpenAiClient` through {@link OpenAiLive} and also carries Effect AI model
 * metadata.
 *
 * **Example** (Use the live language-model Layer)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { OpenAiLanguageModelLive } from "@beep/openai"
 *
 * strictEqual(typeof OpenAiLanguageModelLive, "object")
 * ```
 *
 * @effects Reads `AI_OPENAI_MODEL` and `AI_OPENAI_API_KEY` when the Layer is acquired.
 * @category layers
 * @since 0.0.0
 */
export const OpenAiLanguageModelLive = Layer.unwrap(
  Config.nonEmptyString(OPENAI_MODEL_ENV).pipe(
    Config.withDefault(OPENAI_DEFAULT_MODEL),
    Effect.map((model) => OpenAiLanguageModel.model(model).pipe(Layer.provide(OpenAiLive)))
  )
);

/**
 * Builds a live embedding-model Layer whose model id comes from Effect Config.
 *
 * **Gotchas**
 *
 * The caller must supply a positive dimension. Only the model id falls back to
 * {@link OPENAI_DEFAULT_EMBEDDING_MODEL}; vector dimensions never come from the
 * environment.
 *
 * **Example** (Build the live embedding-model Layer)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { makeOpenAiEmbeddingModelLive } from "@beep/openai"
 * import { PosInt } from "@beep/schema"
 *
 * const layer = makeOpenAiEmbeddingModelLive(PosInt.make(1536))
 *
 * strictEqual(typeof layer, "object")
 * ```
 *
 * @effects Reads `AI_OPENAI_EMBEDDING_MODEL` and `AI_OPENAI_API_KEY` when the Layer is acquired.
 * @category layers
 * @since 0.0.0
 */
export const makeOpenAiEmbeddingModelLive = (dimensions: PosInt) =>
  Layer.unwrap(
    Config.nonEmptyString(OPENAI_EMBEDDING_MODEL_ENV).pipe(
      Config.withDefault(OPENAI_DEFAULT_EMBEDDING_MODEL),
      Effect.map((model) =>
        makeOpenAiEmbeddingModelLayer(OpenAiEmbeddingModelOptions.make({ dimensions, model })).pipe(
          Layer.provide(OpenAiLive)
        )
      )
    )
  );
