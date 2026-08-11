/**
 * Nomic NLP Service - Effect wrapper for Nomic Embeddings via Transformers.js
 *
 * Provides high-quality text embeddings using nomic-embed-text-v1.5.
 * Supports Matryoshka Representation Learning (MRL) and quantization.
 */
import { pipeline } from "@xenova/transformers"
import { Context, Data, Effect, Layer, Option } from "effect"
import { ConfigService } from "./Config.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/NomicNlp");

/**
 * Nomic NLP Errors
 */
export class NomicNlpError extends Data.TaggedError("NomicNlpError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Task types for Nomic embeddings
 * - search_query: Use when embedding a query to find relevant documents
 * - search_document: Use when embedding documents to be searched
 * - clustering: Use for clustering tasks
 * - classification: Use for classification tasks
 */
export type NomicTaskType = "search_query" | "search_document" | "clustering" | "classification"

/**
 * Nomic NLP Service Interface
 */
export interface NomicNlpService {
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
  ) => Effect.Effect<ReadonlyArray<number>, NomicNlpError>

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
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<number>>, NomicNlpError>

  /**
   * Compute cosine similarity between two vectors
   */
  readonly cosineSimilarity: (
    a: ReadonlyArray<number>,
    b: ReadonlyArray<number>
  ) => number
}

/**
 * Service Tag
 */
export const NomicNlpService = Context.Service<NomicNlpService>($I`NomicNlpService`)

/**
 * Live Implementation
 */
export interface NomicNlpConfig {
  readonly modelId: string
  readonly quantized: boolean
}

export const NomicNlpConfig = Context.Service<NomicNlpConfig>($I`NomicNlpConfig`)

export const NomicNlpServiceLive = Layer.effect(
  NomicNlpService,
  Effect.gen(function*() {
    // Get config or default to v1.5
    const config = yield* Effect.serviceOption(NomicNlpConfig).pipe(
      Effect.map(Option.getOrElse(() => ({
        modelId: "Xenova/nomic-embed-text-v1",
        quantized: true
      })))
    )

    // Lazy initialization of the pipeline
    // We use Effect.cached to ensure the pipeline is only created once
    // and shared across all calls.
    const getPipeline = yield* Effect.cached(
      Effect.tryPromise({
        try: () =>
          pipeline("feature-extraction", config.modelId, {
            quantized: config.quantized
          }),
        catch: (cause) => new NomicNlpError({ message: `Failed to load Nomic model ${config.modelId}`, cause })
      })
    )

    const embed = (
      text: string,
      taskType: NomicTaskType = "search_document",
      dimensionality: number = 768
    ) =>
      Effect.gen(function*() {
        const pipe = yield* getPipeline

        // Add task prefix as required by Nomic v1.5
        const prefix = `${taskType}: `
        const input = prefix + text

        return yield* Effect.tryPromise({
          try: async () => {
            const output = await pipe(input, {
              pooling: "mean",
              normalize: true
            })

            // Convert Float32Array to regular array
            let vector = Array.from(output.data) as Array<number>

            // Matryoshka Representation Learning (MRL) - Truncate if needed
            // Nomic v1.5 supports 64, 128, 256, 512, 768
            if (dimensionality < 768 && dimensionality > 0) {
              vector = vector.slice(0, dimensionality)

              // Re-normalize after truncation (important for MRL)
              const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
              if (norm > 0) {
                vector = vector.map((val) => val / norm)
              }
            }

            return vector
          },
          catch: (cause) => new NomicNlpError({ message: "Failed to generate embedding", cause })
        })
      })

    const cosineSimilarity = (a: ReadonlyArray<number>, b: ReadonlyArray<number>): number => {
      // Dimension mismatch means vectors are incomparable - return 0 (orthogonal)
      if (a.length !== b.length) return 0

      let dotProduct = 0
      let normA = 0
      let normB = 0

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
      }

      if (normA === 0 || normB === 0) return 0
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
    }

    const embedBatch = (
      texts: ReadonlyArray<string>,
      taskType: NomicTaskType = "search_document",
      dimensionality: number = 768
    ) =>
      Effect.gen(function*() {
        if (texts.length === 0) {
          return [] as ReadonlyArray<ReadonlyArray<number>>
        }

        const pipe = yield* getPipeline

        // Add task prefix to all texts
        const prefix = `${taskType}: `
        const inputs = texts.map((text) => prefix + text)

        return yield* Effect.tryPromise({
          try: async () => {
            // Process each text through the pipeline
            // Note: transformers.js doesn't support true batching well,
            // so we process sequentially but share the loaded model
            const results: Array<Array<number>> = []

            for (const input of inputs) {
              const output = await pipe(input, {
                pooling: "mean",
                normalize: true
              })

              let vector = Array.from(output.data) as Array<number>

              // Matryoshka Representation Learning (MRL) - Truncate if needed
              if (dimensionality < 768 && dimensionality > 0) {
                vector = vector.slice(0, dimensionality)

                // Re-normalize after truncation
                const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
                if (norm > 0) {
                  vector = vector.map((val) => val / norm)
                }
              }

              results.push(vector)
            }

            return results
          },
          catch: (cause) => new NomicNlpError({ message: "Failed to generate batch embeddings", cause })
        })
      })

    return {
      embed,
      embedBatch,
      cosineSimilarity
    }
  })
)

/**
 * Default NomicNlpService layer
 *
 * Uses NomicNlpServiceLive with default configuration.
 *
 * @since 2.0.0
 */
export const NomicNlpServiceDefault = NomicNlpServiceLive

/**
 * Create NomicNlpConfig from ConfigService embedding settings.
 *
 * Uses EMBEDDING_TRANSFORMERS_MODEL_ID from config (or ConfigService.embedding.transformersModelId).
 *
 * @since 2.0.0
 */
export const NomicNlpConfigFromConfigService: Layer.Layer<NomicNlpConfig, never, ConfigService> = Layer.effect(
  NomicNlpConfig,
  Effect.gen(function*() {
    const config = yield* ConfigService
    return {
      modelId: config.embedding.transformersModelId,
      quantized: true
    }
  })
)

/**
 * NomicNlpService with configuration from ConfigService.
 *
 * Reads embedding model settings from environment:
 * - EMBEDDING_TRANSFORMERS_MODEL_ID (default: "Xenova/nomic-embed-text-v1")
 *
 * @since 2.0.0
 */
export const NomicNlpServiceFromConfig: Layer.Layer<NomicNlpService, never, ConfigService> = NomicNlpServiceLive.pipe(
  Layer.provideMerge(NomicNlpConfigFromConfigService)
)
