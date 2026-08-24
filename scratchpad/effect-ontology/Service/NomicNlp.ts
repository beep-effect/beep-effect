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
 * Nomic NLP Errors
 *
 * **Example** (Inspect nomic nlp error)
 *
 * ```ts
 * import { NomicNlpError } from "@effect-ontology/Service/NomicNlp"
 *
 * console.log(NomicNlpError)
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
 * Service Tag
 *
 * **Example** (Inspect nomic nlp service)
 *
 * ```ts
 * import { NomicNlpService } from "@effect-ontology/Service/NomicNlp"
 *
 * console.log(NomicNlpService)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class NomicNlpService extends Context.Service<NomicNlpService, NomicNlpServiceMethods>()($I`NomicNlpService`) {}

/**
 * Live Implementation
 *
 *
 * **Example** (Use the NomicNlpConfigValue contract)
 *
 * ```ts
 * import type { NomicNlpConfigValue } from "@effect-ontology/Service/NomicNlp"
 *
 * const acceptsNomicNlpConfigValue = (_value: NomicNlpConfigValue): void => undefined
 *
 * console.log(acceptsNomicNlpConfigValue)
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
 * Provides the nomic nlp config service capability.
 *
 * **Example** (Inspect nomic nlp config)
 *
 * ```ts
 * import { NomicNlpConfig } from "@effect-ontology/Service/NomicNlp"
 *
 * console.log(NomicNlpConfig)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class NomicNlpConfig extends Context.Service<NomicNlpConfig, NomicNlpConfigValue>()($I`NomicNlpConfig`) {}

/**
 * Provides the Effect layer for nomic nlp service live dependencies.
 *
 * **Example** (Inspect nomic nlp service live)
 *
 * ```ts
 * import { NomicNlpServiceLive } from "@effect-ontology/Service/NomicNlp"
 *
 * console.log(NomicNlpServiceLive)
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
 * Default NomicNlpService layer
 *
 * **Details**
 *
 * Uses NomicNlpServiceLive with default configuration.
 *
 * **Example** (Inspect nomic nlp service default)
 *
 * ```ts
 * import { NomicNlpServiceDefault } from "@effect-ontology/Service/NomicNlp"
 *
 * console.log(NomicNlpServiceDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const NomicNlpServiceDefault = NomicNlpServiceLive;

/**
 * Create NomicNlpConfig from ConfigService embedding settings.
 *
 * **Details**
 *
 * Uses EMBEDDING_TRANSFORMERS_MODEL_ID from config (or ConfigService.embedding.transformersModelId).
 *
 * **Example** (Inspect nomic nlp config from config service)
 *
 * ```ts
 * import { NomicNlpConfigFromConfigService } from "@effect-ontology/Service/NomicNlp"
 *
 * console.log(NomicNlpConfigFromConfigService)
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
 * NomicNlpService with configuration from ConfigService.
 *
 * **Details**
 *
 * Reads embedding model settings from environment:
 * - EMBEDDING_TRANSFORMERS_MODEL_ID (default: "Xenova/nomic-embed-text-v1")
 *
 * **Example** (Inspect nomic nlp service from config)
 *
 * ```ts
 * import { NomicNlpServiceFromConfig } from "@effect-ontology/Service/NomicNlp"
 *
 * console.log(NomicNlpServiceFromConfig)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const NomicNlpServiceFromConfig: Layer.Layer<NomicNlpService, never, ConfigService> = NomicNlpServiceLive.pipe(
  Layer.provideMerge(NomicNlpConfigFromConfigService)
);
