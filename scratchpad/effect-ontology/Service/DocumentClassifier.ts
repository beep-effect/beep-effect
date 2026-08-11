/**
 * Service: Document Classifier
 *
 * LLM-based document classification for intelligent preprocessing.
 * Extracts document type, domain tags, complexity, and entity density.
 *
 * @since 2.3.0
 * @module Service/DocumentClassifier
 */

import {LanguageModel} from "effect/unstable/ai";
import {Effect, Layer, Schema, Context} from "effect";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import {
  type DocumentType,
  type EntityDensity
} from "../Domain/Schema/DocumentMetadata.ts";
import {ConfigService, ConfigServiceDefault} from "./Config.ts";
import {generateObjectWithRetry} from "./LlmWithRetry.ts";
import {$ScratchpadId} from "@beep/identity";
import {SchemaUtils} from "@beep/schema";
import * as O from "effect/Option";

const $I = $ScratchpadId.create("effect-ontology/Service/DocumentClassifier");

// =============================================================================
// Classification Schemas
// =============================================================================

/**
 * Classification result for a single document
 *
 * @since 2.3.0
 * @category Schemas
 */
export const DocumentClassification = Schema.Struct({
  /** Classified document type */
  documentType: Schema.Literals(
    ["article",
      "transcript",
      "report",
      "contract",
      "correspondence",
      "reference",
      "narrative",
      "structured",
      "unknown"]
  ).annotate({
    description: "Document structure/type classification"
  }),
  /** Domain/topic tags extracted from content */
  domainTags: Schema.Array(Schema.String).annotate({
    description: "2-5 domain tags describing the document topic"
  }),
  /** Complexity score 0-1 */
  complexityScore: Schema.Finite.check(Schema.isBetween({
    minimum: 0,
    maximum: 1
  })).annotate({
    description: "Document complexity (0=simple, 1=complex)"
  }),
  /** Entity density estimation */
  entityDensity: Schema.Literals(["sparse", "moderate", "dense"]).annotate({
    description: "Estimated entity density"
  }),
  /** Optional detected language */
  language: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Detected language code (ISO 639-1)"
  }),
  /** Optional extracted title */
  title: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Document title if detectable"
  })
});
export type DocumentClassification = typeof DocumentClassification.Type

/**
 * Batch classification response for multiple documents
 *
 * @since 2.3.0
 * @category Schemas
 */
export const BatchClassificationResponse = Schema.Struct({
  classifications: Schema.Array(
    Schema.Struct({
      /** Document index in the batch (0-based) */
      index: Schema.Number,
      /** Classification result */
      classification: DocumentClassification
    })
  )
});
export type BatchClassificationResponse = typeof BatchClassificationResponse.Type

/**
 * Input for single document classification
 *
 * @since 2.3.0
 * @category Schemas
 */
export const ClassifyInput = Schema.Struct({
  /** Document text preview (first 1500-4000 chars recommended) */
  preview: Schema.String,
  /** Content type hint (e.g., "text/plain", "text/markdown") */
  contentType: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
});
export type ClassifyInput = typeof ClassifyInput.Type

/**
 * Input for batch document classification
 *
 * @since 2.3.0
 * @category Schemas
 */
export const ClassifyBatchInput = Schema.Struct({
  /** Array of document previews with indices */
  documents: Schema.Array(
    Schema.Struct({
      /** Index for result correlation */
      index: Schema.Number,
      /** Document text preview */
      preview: Schema.String,
      /** Content type hint */
      contentType: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
    })
  )
});
export type ClassifyBatchInput = typeof ClassifyBatchInput.Type

// =============================================================================
// Classification Errors
// =============================================================================

/**
 * Error when document classification fails
 *
 * @since 2.3.0
 * @category Errors
 */
export class ClassificationError extends Schema.TaggedError<ClassificationError>()(
  "ClassificationError",
  {
    message: Schema.String,
    cause: Schema.Unknown.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
  }
) {
}

// =============================================================================
// Prompt Building
// =============================================================================

/** Max preview size to include in prompt */
const MAX_PREVIEW_SIZE = 1500;

/**
 * Build classification prompt for a single document
 */
const buildSinglePrompt = (preview: string, contentType?: string): string => {
  const truncatedPreview = preview.slice(0, MAX_PREVIEW_SIZE);
  const typeHint = contentType ? ` (${contentType})` : "";

  return `You are a document classification assistant. Analyze the following document preview and classify it.

Determine:
1. **documentType**: The structural type (article, transcript, report, contract, correspondence, reference, narrative, structured, unknown)
2. **domainTags**: 2-5 topic tags describing what the document is about
3. **complexityScore**: How complex is the language/structure? (0=very simple, 1=highly technical/complex)
4. **entityDensity**: How many named entities per paragraph?
   - "sparse": Few entities, mostly prose
   - "moderate": Average density
   - "dense": Many entities (lists, tables, rosters)
5. **language**: ISO 639-1 code if detectable (e.g., "en", "es")
6. **title**: Document title if visible

Document${typeHint}:
"""${truncatedPreview}"""

Respond with the classification.`;
};

/**
 * Build classification prompt for a batch of documents
 */
const buildBatchPrompt = (
  documents: ReadonlyArray<{
    index: number;
    preview: string;
    contentType?: string
  }>
): string => {
  const docSummaries = documents.map(({contentType, index, preview}) => {
    const typeHint = contentType ? ` (${contentType})` : "";
    return `Document ${index}${typeHint}:\n"""${preview.slice(0, MAX_PREVIEW_SIZE)}"""`;
  }).join("\n\n---\n\n");

  return `You are a document classification assistant. Analyze the following document previews and classify each one.

For each document, determine:
1. **documentType**: The structural type (article, transcript, report, contract, correspondence, reference, narrative, structured, unknown)
2. **domainTags**: 2-5 topic tags describing what the document is about
3. **complexityScore**: How complex is the language/structure? (0=very simple, 1=highly technical/complex)
4. **entityDensity**: How many named entities per paragraph?
   - "sparse": Few entities, mostly prose
   - "moderate": Average density
   - "dense": Many entities (lists, tables, rosters)
5. **language**: ISO 639-1 code if detectable (e.g., "en", "es")
6. **title**: Document title if visible

${docSummaries}

Respond with classifications for each document by index.`;
};

// =============================================================================
// Default Classification
// =============================================================================

/**
 * Default classification when LLM fails or is unavailable
 *
 * @since 2.3.0
 * @category Utilities
 */
export const defaultClassification: DocumentClassification = {
  documentType: "unknown" as DocumentType,
  domainTags: [],
  complexityScore: 0.5,
  entityDensity: "moderate" as EntityDensity,
  language: O.some("en"),
  title: O.none()
};

// =============================================================================
// Service Definition
// =============================================================================

/**
 * DocumentClassifier Service
 *
 * Provides LLM-based document classification for preprocessing.
 *
 * Mode: effect (requires LanguageModel)
 * Dependencies: ConfigService, LanguageModel
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const classifier = yield* DocumentClassifier
 *   const result = yield* classifier.classify({
 *     preview: "The quick brown fox...",
 *     contentType: "text/plain"
 *   })
 *   console.log(result.documentType) // "narrative"
 * }).pipe(Effect.provide(DocumentClassifier.Default))
 * ```
 *
 * @since 2.3.0
 * @category Services
 */
export class DocumentClassifier extends Context.Service<DocumentClassifier>()(
  $I`DocumentClassifier`,
  {
    make: Effect.gen(function* () {
      const config = yield* ConfigService;
      const llm = yield* LanguageModel.LanguageModel;

      return {
        /**
         * Classify a single document
         *
         * @param input - Document preview and content type
         * @returns Classification result
         */
        classify: (input: ClassifyInput) =>
          Effect.gen(function* () {
            const result = yield* generateObjectWithRetry({
              llm,
              prompt: buildSinglePrompt(input.preview, O.getOrUndefined(input.contentType)),
              schema: DocumentClassification,
              objectName: "document_classification",
              serviceName: "DocumentClassifier",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: 1000,
                maxDelayMs: 30000,
                maxAttempts: 3,
                timeoutMs: 30000
              },
              spanAttributes: {
                "classifier.mode": "single",
                "classifier.content_type": O.getOrElse(input.contentType, () => "unknown")
              }
            });

            return result.value;
          }).pipe(
            Effect.catch((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning("Document classification failed, using defaults", {
                  error: String(error)
                });
                return defaultClassification;
              })
            )
          ),

        /**
         * Classify multiple documents in a single LLM call
         *
         * More efficient than multiple single calls for large batches.
         * Recommended batch size: 5-15 documents.
         *
         * @param input - Batch of document previews
         * @returns Map of index to classification result
         */
        classifyBatch: Effect.fn("DocumentClassifier.classifyBatch")(function* (input: ClassifyBatchInput) {
          return yield* Effect.gen(function*() {
            if (input.documents.length === 0) {
              return MutableHashMap.empty<number, DocumentClassification>();
            }

            const result = yield* generateObjectWithRetry({
              llm,
              prompt: buildBatchPrompt(A.map(input.documents, (document) => ({
                index: document.index,
                preview: document.preview,
                ...(O.isSome(document.contentType) ? { contentType: document.contentType.value } : {})
              }))),
              schema: BatchClassificationResponse,
              objectName: "batch_classification",
              serviceName: "DocumentClassifier",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: 1000,
                maxDelayMs: 30000,
                maxAttempts: 3,
                timeoutMs: 60000
              },
              spanAttributes: {
                "classifier.mode": "batch",
                "classifier.batch_size": input.documents.length
              }
            });

            // Build result map
            const classifications = MutableHashMap.empty<number, DocumentClassification>();
            for (const item of result.value.classifications) {
              MutableHashMap.set(classifications, item.index, item.classification);
            }

            // Fill in defaults for any missing indices
            for (const doc of input.documents) {
              if (!MutableHashMap.has(classifications, doc.index)) {
                MutableHashMap.set(classifications, doc.index, defaultClassification);
              }
            }

            return classifications;
          }).pipe(Effect.catch((error) => Effect.gen(function*() {
              yield* Effect.logWarning("Batch classification failed, using defaults for all", {
                batchSize: input.documents.length,
                error: String(error)
              });
              // Return defaults for all documents
              const classifications = MutableHashMap.empty<number, DocumentClassification>();
              for (const doc of input.documents) {
                MutableHashMap.set(classifications, doc.index, defaultClassification);
              }
              return classifications;
            })))
          }),

        /**
         * Classify documents with automatic batching
         *
         * Splits large document sets into optimal batches and processes
         * them with controlled concurrency.
         *
         * @param documents - Array of documents to classify
         * @param batchSize - Documents per LLM call (default: 10)
         * @param concurrency - Parallel batches (default: 2)
         * @returns Map of index to classification result
         */
        classifyWithAutoBatching: Effect.fn("DocumentClassifier.classifyWithAutoBatching")(function* (
          documents: ReadonlyArray<{
            index: number;
            preview: string;
            contentType?: string
          }>,
          batchSize = 10,
          concurrency = 2
        ) {
            if (documents.length === 0) {
              return MutableHashMap.empty<number, DocumentClassification>();
            }

            // Split into batches
            const batches: Array<typeof documents> = [];
            for (let i = 0; i < documents.length; i += batchSize) {
              batches.push(documents.slice(i, i + batchSize));
            }

            yield* Effect.logDebug("Starting auto-batched classification", {
              totalDocuments: documents.length,
              batchCount: batches.length,
              batchSize,
              concurrency
            });

            // Process batches with concurrency
            const results = yield* Effect.forEach(
              batches,
              (batch, batchIndex) =>
                Effect.gen(function* () {
                  yield* Effect.logDebug("Processing classification batch", {
                    batchIndex,
                    batchSize: batch.length
                  });

                  const result = yield* generateObjectWithRetry({
                    llm,
                    prompt: buildBatchPrompt(batch),
                    schema: BatchClassificationResponse,
                    objectName: "batch_classification",
                    serviceName: "DocumentClassifier",
                    model: config.llm.model,
                    provider: config.llm.provider,
                    retryConfig: {
                      initialDelayMs: 1000,
                      maxDelayMs: 30000,
                      maxAttempts: 3,
                      timeoutMs: 60000
                    },
                    spanAttributes: {
                      "classifier.mode": "auto_batch",
                      "classifier.batch_index": batchIndex,
                      "classifier.batch_size": batch.length
                    }
                  }).pipe(
                    Effect.catch((error) =>
                      Effect.gen(function* () {
                        yield* Effect.logWarning("Classification batch failed", {
                          batchIndex,
                          error: String(error)
                        });
                        return {value: {classifications: []}};
                      })
                    )
                  );

                  return result.value.classifications;
                }),
              {concurrency}
            );

            // Merge all results
            const classifications = MutableHashMap.empty<number, DocumentClassification>();
            for (const batchResult of results) {
              for (const item of batchResult) {
                MutableHashMap.set(classifications, item.index, item.classification);
              }
            }

            // Fill in defaults for any missing
            for (const doc of documents) {
              if (!MutableHashMap.has(classifications, doc.index)) {
                MutableHashMap.set(classifications, doc.index, defaultClassification);
              }
            }

            yield* Effect.logInfo("Auto-batched classification complete", {
              totalDocuments: documents.length,
              classifiedCount: MutableHashMap.size(classifications)
            });

            return classifications;
          })
      };
    }),
  }
) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([
    ConfigServiceDefault
    // LanguageModel.LanguageModel provided by parent scope (runtime-selected provider)
  ]));

  /**
   * Default layer with ConfigService provided
   *
   * Note: LanguageModel must still be provided by the caller
   */
  static readonly DefaultWithConfig = DocumentClassifier.Default.pipe(
    Layer.provide(ConfigServiceDefault)
  );

  /**
   * Test layer with mock classification that returns defaults
   */
  static readonly Test = Layer.succeed(DocumentClassifier, DocumentClassifier.of({
    classify: (_input: ClassifyInput) => Effect.succeed(defaultClassification),

    classifyBatch: (input: ClassifyBatchInput) =>
      Effect.succeed(
        MutableHashMap.fromIterable(A.map(input.documents, (doc) => [doc.index, defaultClassification] as const))
      ),

    classifyWithAutoBatching: (documents) =>
      Effect.succeed(
        MutableHashMap.fromIterable(A.map(documents, (doc) => [doc.index, defaultClassification] as const))
      )
  }));
}
