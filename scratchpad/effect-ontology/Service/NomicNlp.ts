/**
 * Nomic NLP Service - Effect wrapper for Nomic Embeddings via Transformers.js
 *
 * **Details**
 *
 * Provides high-quality text embeddings using nomic-embed-text-v1.5.
 * Supports Matryoshka Representation Learning (MRL) and quantization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { pipeline } from "@xenova/transformers";
import { Context, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause } from "../Domain/Error/Base.ts";
import { ConfigService } from "./Config.ts";
import { cosineSimilarity } from "./EmbeddingProvider.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/NomicNlp");

/**
 * Failure while loading a Nomic model or generating embeddings.
 *
 * **Example** (Construct a Nomic NLP error)
 *
 * ```ts
 * import { NomicNlpError } from "@effect-ontology/Service/NomicNlp"
 *
 * const error = NomicNlpError.make({
 *   message: "Failed to load Nomic model Xenova/nomic-embed-text-v1"
 * })
 * console.log(error._tag) // "NomicNlpError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NomicNlpError extends S.TaggedError<NomicNlpError>($I`NomicNlpError`)(
  "NomicNlpError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable Nomic NLP failure diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying Nomic runtime defect.",
    }),
  },
  $I.annote("NomicNlpError", {
    description: "Failure while creating embeddings with the Nomic NLP runtime.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Task types for Nomic embeddings
 * - search_query: Use when embedding a query to find relevant documents
 * - search_document: Use when embedding documents to be searched
 * - clustering: Use for clustering tasks
 * - classification: Use for classification tasks
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type NomicTaskType = "search_query" | "search_document" | "clustering" | "classification";

/**
 * Nomic NLP Service Interface
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface NomicNlpServiceMethods {
  /**
   * Generate embedding for text
   *
   * @param text Input text
   * @param taskType Task type (defaults to "search_document")
   * @param dimensionality Optional dimension to truncate to (64-768)
   */
  readonly embed: (
    text: string,
    taskType?: NomicTaskType,
    dimensionality?: number
  ) => Effect.Effect<ReadonlyArray<number>, NomicNlpError>;

  /**
   * Generate embeddings for multiple texts in a batch
   *
   * More efficient than calling embed() for each text individually
   * as it reduces model loading overhead.
   *
   * @param texts Input texts
   * @param taskType Task type (defaults to "search_document")
   * @param dimensionality Optional dimension to truncate to (64-768)
   */
  readonly embedBatch: (
    texts: ReadonlyArray<string>,
    taskType?: NomicTaskType,
    dimensionality?: number
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<number>>, NomicNlpError>;

  /**
   * Compute cosine similarity between two vectors
   */
  readonly cosineSimilarity: (a: ReadonlyArray<number>, b: ReadonlyArray<number>) => number;
}

/**
 * Context tag for local Nomic embed, batch-embed, and cosine-similarity calls.
 *
 * **Example** (Score vectors through a test Nomic service)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { cosineSimilarity } from "@effect-ontology/Service/EmbeddingProvider"
 * import { NomicNlpService } from "@effect-ontology/Service/NomicNlp"
 *
 * const TestNlp = Layer.succeed(NomicNlpService, {
 *   embed: () => Effect.succeed([1, 0]),
 *   embedBatch: (texts) => Effect.succeed(texts.map(() => [1, 0])),
 *   cosineSimilarity
 * })
 *
 * const score = Effect.runSync(
 *   Effect.gen(function* () {
 *     const nlp = yield* NomicNlpService
 *     return nlp.cosineSimilarity([1, 0], [1, 0])
 *   }).pipe(Effect.provide(TestNlp))
 * )
 * console.log(score) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class NomicNlpService extends Context.Service<NomicNlpService, NomicNlpServiceMethods>()($I`NomicNlpService`) {}

/**
 * Model identifier and quantization flags supplied to {@link NomicNlpConfig}.
 *
 * **Example** (Describe a quantized local model)
 *
 * ```ts
 * import type { NomicNlpConfigValue } from "@effect-ontology/Service/NomicNlp"
 *
 * const config: NomicNlpConfigValue = {
 *   modelId: "Xenova/nomic-embed-text-v1",
 *   quantized: true
 * }
 * console.log(config.quantized) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface NomicNlpConfigValue {
  readonly modelId: string;
  readonly quantized: boolean;
}

/**
 * Context tag for the Nomic model identifier and quantization setting.
 *
 * **Example** (Read Nomic config from a test layer)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { NomicNlpConfig } from "@effect-ontology/Service/NomicNlp"
 *
 * const ConfigLive = Layer.succeed(NomicNlpConfig, {
 *   modelId: "Xenova/nomic-embed-text-v1",
 *   quantized: true
 * })
 *
 * const modelId = Effect.runSync(
 *   Effect.gen(function* () {
 *     const config = yield* NomicNlpConfig
 *     return config.modelId
 *   }).pipe(Effect.provide(ConfigLive))
 * )
 * console.log(modelId) // "Xenova/nomic-embed-text-v1"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class NomicNlpConfig extends Context.Service<NomicNlpConfig, NomicNlpConfigValue>()($I`NomicNlpConfig`) {}

/**
 * Live Transformers.js layer for {@link NomicNlpService}.
 *
 * **Example** (Compose embed against the live layer)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { NomicNlpConfig, NomicNlpService, NomicNlpServiceLive } from "@effect-ontology/Service/NomicNlp"
 *
 * const layer = Layer.provide(
 *   NomicNlpServiceLive,
 *   Layer.succeed(NomicNlpConfig, {
 *     modelId: "Xenova/nomic-embed-text-v1",
 *     quantized: true
 *   })
 * )
 *
 * const program = Effect.gen(function* () {
 *   const nlp = yield* NomicNlpService
 *   return yield* nlp.embed("Ada founded Acme.", "search_document", 256)
 * }).pipe(Effect.provide(layer))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const NomicNlpServiceLive = Layer.effect(
  NomicNlpService,
  Effect.gen(function* () {
    // Get config or default to v1.5
    const config = yield* Effect.serviceOption(NomicNlpConfig).pipe(
      Effect.map(
        O.getOrElse(() => ({
          modelId: "Xenova/nomic-embed-text-v1",
          quantized: true,
        }))
      )
    );

    // Lazy initialization of the pipeline
    // We use Effect.cached to ensure the pipeline is only created once
    // and shared across all calls.
    const getPipeline = yield* Effect.cached(
      Effect.tryPromise({
        try: () =>
          pipeline("feature-extraction", config.modelId, {
            quantized: config.quantized,
          }),
        catch: (cause) =>
          NomicNlpError.make({
            message: `Failed to load Nomic model ${config.modelId}`,
            cause: O.some(cause),
          }),
      })
    );

    const embed = Effect.fn("embed")(function* (
      text: string,
      taskType: NomicTaskType = "search_document",
      dimensionality: number = 768
    ) {
      const pipe = yield* getPipeline;
      const prefix = `${taskType}: `;
      const input = prefix + text;
      const output = yield* Effect.tryPromise({
        try: () =>
          pipe(input, {
            pooling: "mean",
            normalize: true,
          }),
        catch: (cause) =>
          NomicNlpError.make({
            message: "Failed to generate embedding",
            cause: O.some(cause),
          }),
      });
      let vector = A.fromIterable(output.data);
      if (dimensionality < 768 && dimensionality > 0) {
        vector = vector.slice(0, dimensionality);
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (norm > 0) {
          vector = vector.map((val) => val / norm);
        }
      }
      return vector;
    });

    const embedBatch = Effect.fn("embedBatch")(function* (
      texts: ReadonlyArray<string>,
      taskType: NomicTaskType = "search_document",
      dimensionality: number = 768
    ) {
      if (texts.length === 0) {
        return [];
      }
      return yield* Effect.forEach(texts, (text) => embed(text, taskType, dimensionality), {
        concurrency: 1,
      }).pipe(
        Effect.mapError((cause) =>
          NomicNlpError.make({
            message: "Failed to generate batch embeddings",
            cause: O.some(cause),
          })
        )
      );
    });

    return {
      embed,
      embedBatch,
      cosineSimilarity,
    };
  })
);

/**
 * Default Nomic NLP layer using {@link NomicNlpServiceLive} without extra config.
 *
 * **Details**
 *
 * Equivalent to {@link NomicNlpServiceLive}; the model falls back to
 * `Xenova/nomic-embed-text-v1` when {@link NomicNlpConfig} is absent.
 *
 * **Example** (Compose similarity against the default layer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NomicNlpService, NomicNlpServiceDefault } from "@effect-ontology/Service/NomicNlp"
 *
 * const program = Effect.gen(function* () {
 *   const nlp = yield* NomicNlpService
 *   return nlp.cosineSimilarity([1, 0], [0, 1])
 * }).pipe(Effect.provide(NomicNlpServiceDefault))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const NomicNlpServiceDefault = NomicNlpServiceLive;

/**
 * Layer that copies embedding model settings from {@link ConfigService}.
 *
 * **Details**
 *
 * Reads `config.embedding.transformersModelId` and always enables quantization.
 *
 * **Example** (Provide Nomic config from application config)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 * import { NomicNlpConfig, NomicNlpConfigFromConfigService } from "@effect-ontology/Service/NomicNlp"
 *
 * const modelId = Effect.runSync(
 *   Effect.gen(function* () {
 *     const config = yield* NomicNlpConfig
 *     return config.modelId
 *   }).pipe(
 *     Effect.provide(NomicNlpConfigFromConfigService),
 *     Effect.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG))
 *   )
 * )
 * console.log(modelId)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const NomicNlpConfigFromConfigService: Layer.Layer<NomicNlpConfig, never, ConfigService> = Layer.effect(
  NomicNlpConfig,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    return {
      modelId: config.embedding.transformersModelId,
      quantized: true,
    };
  })
);

/**
 * Nomic NLP layer that reads model settings from {@link ConfigService}.
 *
 * **Details**
 *
 * Merges {@link NomicNlpServiceLive} with {@link NomicNlpConfigFromConfigService}.
 *
 * **Example** (Wire Nomic through application config)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 * import { NomicNlpService, NomicNlpServiceFromConfig } from "@effect-ontology/Service/NomicNlp"
 *
 * const program = Effect.gen(function* () {
 *   const nlp = yield* NomicNlpService
 *   return yield* nlp.embed("Ada founded Acme.")
 * }).pipe(
 *   Effect.provide(NomicNlpServiceFromConfig),
 *   Effect.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG))
 * )
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const NomicNlpServiceFromConfig: Layer.Layer<NomicNlpService, never, ConfigService> = NomicNlpServiceLive.pipe(
  Layer.provideMerge(NomicNlpConfigFromConfigService)
);
