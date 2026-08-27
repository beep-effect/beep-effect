/**
 * Service: Document Classifier
 *
 * **Details**
 *
 * LLM-based document classification for intelligent preprocessing.
 * Extracts document type, domain tags, complexity, and entity density.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Context, Effect, Inspectable, Layer, MutableHashMap } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { LanguageModel } from "effect/unstable/ai";
import { ErrorMessage, OptionalErrorCause } from "../Domain/Error/Base.ts";
import { ConfigService, ConfigServiceDefault } from "./Config.ts";
import { generateObjectWithRetry } from "./LlmWithRetry.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/DocumentClassifier");

// =============================================================================
// Classification Schemas
// =============================================================================

/**
 * Classification result for a single document
 *
 * **Example** (Decode a classified article)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DocumentClassification } from "@effect-ontology/Service/DocumentClassifier"
 *
 * const decoded = S.decodeUnknownOption(DocumentClassification)({
 *   documentType: "article",
 *   domainTags: ["history", "computing"],
 *   complexityScore: 0.4,
 *   entityDensity: "moderate"
 * })
 * console.log(O.map(decoded, (value) => value.documentType)) // Some("article")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentClassification = S.Struct({
  /** Classified document type */
  documentType: S.Literals([
    "article",
    "transcript",
    "report",
    "contract",
    "correspondence",
    "reference",
    "narrative",
    "structured",
    "unknown",
  ]).annotate({
    description: "Document structure/type classification",
  }),
  /** Domain/topic tags extracted from content */
  domainTags: S.Array(S.String).annotate({
    description: "2-5 domain tags describing the document topic",
  }),
  /** Complexity score 0-1 */
  complexityScore: UnitInterval.annotate({
    description: "Document complexity (0=simple, 1=complex)",
  }),
  /** Entity density estimation */
  entityDensity: S.Literals(["sparse", "moderate", "dense"]).annotate({
    description: "Estimated entity density",
  }),
  /** Optional detected language */
  language: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Detected language code (ISO 639-1)",
  }),
  /** Optional extracted title */
  title: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Document title if detectable",
  }),
}).pipe(
  $I.annoteSchema("DocumentClassification", {
    description: "Document type, domain tags, complexity, and entity density from classification.",
  })
);
/**
 * Describes the document classification data exposed by this module.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentClassification = typeof DocumentClassification.Type;

/**
 * Batch classification response for multiple documents
 *
 * **Example** (Decode a batch of classifications)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BatchClassificationResponse } from "@effect-ontology/Service/DocumentClassifier"
 *
 * const decoded = S.decodeUnknownOption(BatchClassificationResponse)({
 *   classifications: [
 *     {
 *       index: 0,
 *       classification: {
 *         documentType: "article",
 *         domainTags: ["history"],
 *         complexityScore: 0.3,
 *         entityDensity: "sparse"
 *       }
 *     }
 *   ]
 * })
 * console.log(O.isSome(decoded)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BatchClassificationResponse = S.Struct({
  classifications: S.Array(
    S.Struct({
      /** Document index in the batch (0-based) */
      index: NonNegativeInt,
      /** Classification result */
      classification: DocumentClassification,
    })
  ),
}).pipe(
  $I.annoteSchema("BatchClassificationResponse", {
    description: "Indexed classification results for one document batch.",
  })
);
/**
 * Describes the batch classification response data exposed by this module.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchClassificationResponse = typeof BatchClassificationResponse.Type;

/**
 * Input for single document classification
 *
 * **Example** (Build a single-document preview)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClassifyInput } from "@effect-ontology/Service/DocumentClassifier"
 *
 * const input = S.decodeUnknownOption(ClassifyInput)({
 *   preview: "Ada founded Acme in 1843."
 * })
 * console.log(O.map(input, (value) => value.preview))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClassifyInput = S.Struct({
  /** Document text preview (first 1500-4000 chars recommended) */
  preview: S.String,
  /** Content type hint (e.g., "text/plain", "text/markdown") */
  contentType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}).pipe(
  $I.annoteSchema("ClassifyInput", {
    description: "Document preview and optional content-type hint for single classification.",
  })
);
/**
 * Describes the classify input data exposed by this module.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClassifyInput = typeof ClassifyInput.Type;

/**
 * Input for batch document classification
 *
 * **Example** (Build a batch of previews)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ClassifyBatchInput } from "@effect-ontology/Service/DocumentClassifier"
 *
 * const input = S.decodeUnknownOption(ClassifyBatchInput)({
 *   documents: [{ index: 0, preview: "Ada founded Acme in 1843." }]
 * })
 * console.log(O.isSome(input)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClassifyBatchInput = S.Struct({
  /** Array of document previews with indices */
  documents: S.Array(
    S.Struct({
      /** Index for result correlation */
      index: NonNegativeInt,
      /** Document text preview */
      preview: S.String,
      /** Content type hint */
      contentType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    })
  ),
}).pipe(
  $I.annoteSchema("ClassifyBatchInput", {
    description: "Indexed document previews submitted for batch classification.",
  })
);
/**
 * Describes the classify batch input data exposed by this module.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClassifyBatchInput = typeof ClassifyBatchInput.Type;

// =============================================================================
// Classification Errors
// =============================================================================

/**
 * Error when document classification fails
 *
 * **Example** (Construct a classification error)
 *
 * ```ts
 * import { ClassificationError } from "@effect-ontology/Service/DocumentClassifier"
 *
 * const error = ClassificationError.make({
 *   message: "Language model returned an empty classification"
 * })
 * console.log(error._tag) // "ClassificationError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ClassificationError extends S.TaggedError<ClassificationError>($I`ClassificationError`)(
  "ClassificationError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable document classification failure diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying language-model or decoding defect.",
    }),
  },
  $I.annote("ClassificationError", {
    description: "Failure while classifying a document with the language model.",
  })
) {
  static readonly is = S.is(this);
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
  const typeHint = P.isNotUndefined(contentType) ? ` (${contentType})` : "";

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
    contentType?: string;
  }>
): string => {
  const docSummaries = documents
    .map(({ contentType, index, preview }) => {
      const typeHint = P.isNotUndefined(contentType) ? ` (${contentType})` : "";
      return `Document ${index}${typeHint}:\n"""${preview.slice(0, MAX_PREVIEW_SIZE)}"""`;
    })
    .join("\n\n---\n\n");

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
 * **Example** (Inspect the fallback classification)
 *
 * ```ts
 * import { defaultClassification } from "@effect-ontology/Service/DocumentClassifier"
 *
 * console.log(defaultClassification.documentType) // "unknown"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const defaultClassification: DocumentClassification = {
  documentType: "unknown",
  domainTags: [],
  complexityScore: UnitInterval.make(0.5),
  entityDensity: "moderate",
  language: O.some("en"),
  title: O.none(),
};

// =============================================================================
// Service Definition
// =============================================================================

/**
 * DocumentClassifier Service
 *
 * **Details**
 *
 * Provides LLM-based document classification for preprocessing.
 *
 * Mode: effect (requires LanguageModel)
 * Dependencies: ConfigService, LanguageModel
 *
 * **Example** (Classify a document preview)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { DocumentClassifier } from "@effect-ontology/Service/DocumentClassifier"
 *
 * const program = Effect.gen(function* () {
 *   const classifier = yield* DocumentClassifier
 *   return yield* classifier.classify({ preview: "Ada founded Acme in 1843.", contentType: O.none() })
 * }).pipe(Effect.provide(DocumentClassifier.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DocumentClassifier extends Context.Service<DocumentClassifier>()($I`DocumentClassifier`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const llm = yield* LanguageModel.LanguageModel;

    return {
      classify: Effect.fn("DocumentClassifier.classify")(
        function* (input: ClassifyInput) {
          const result = yield* generateObjectWithRetry({
            prompt: buildSinglePrompt(input.preview, O.getOrUndefined(input.contentType)),
            schema: DocumentClassification,
            objectName: "document_classification",
            serviceName: "DocumentClassifier",
            model: config.llm.model,
            provider: config.llm.provider,
            retryPolicy: config.llm.retryPolicy,
            spanAttributes: {
              "classifier.mode": "single",
              "classifier.content_type": O.getOrElse(input.contentType, () => "unknown"),
            },
          }).pipe(Effect.provideService(LanguageModel.LanguageModel, llm));
          return result.value;
        },
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.logWarning("Document classification failed, using defaults", {
              error: Inspectable.toStringUnknown(error),
            });
            return defaultClassification;
          })
        )
      ),
      classifyBatch: Effect.fn("DocumentClassifier.classifyBatch")(function* (input: ClassifyBatchInput) {
        return yield* Effect.gen(function* () {
          if (input.documents.length === 0) {
            return MutableHashMap.empty<number, DocumentClassification>();
          }
          const result = yield* generateObjectWithRetry({
            prompt: buildBatchPrompt(
              A.map(input.documents, (document) => ({
                index: document.index,
                preview: document.preview,
                ...(O.isSome(document.contentType) ? { contentType: document.contentType.value } : {}),
              }))
            ),
            schema: BatchClassificationResponse,
            objectName: "batch_classification",
            serviceName: "DocumentClassifier",
            model: config.llm.model,
            provider: config.llm.provider,
            retryPolicy: config.llm.retryPolicy,
            spanAttributes: {
              "classifier.mode": "batch",
              "classifier.batch_size": input.documents.length,
            },
          }).pipe(Effect.provideService(LanguageModel.LanguageModel, llm));
          const classifications = MutableHashMap.empty<number, DocumentClassification>();
          for (const item of result.value.classifications) {
            MutableHashMap.set(classifications, item.index, item.classification);
          }
          for (const doc of input.documents) {
            if (!MutableHashMap.has(classifications, doc.index)) {
              MutableHashMap.set(classifications, doc.index, defaultClassification);
            }
          }
          return classifications;
        }).pipe(
          Effect.catch((error) =>
            Effect.gen(function* () {
              yield* Effect.logWarning("Batch classification failed, using defaults for all", {
                batchSize: input.documents.length,
                error: Inspectable.toStringUnknown(error),
              });
              const classifications = MutableHashMap.empty<number, DocumentClassification>();
              for (const doc of input.documents) {
                MutableHashMap.set(classifications, doc.index, defaultClassification);
              }
              return classifications;
            })
          )
        );
      }),
      classifyWithAutoBatching: Effect.fn("DocumentClassifier.classifyWithAutoBatching")(function* (
        documents: ReadonlyArray<{
          index: number;
          preview: string;
          contentType?: string;
        }>,
        batchSize = 10,
        concurrency = 2
      ) {
        if (documents.length === 0) {
          return MutableHashMap.empty<number, DocumentClassification>();
        }
        const batches: Array<typeof documents> = [];
        for (let i = 0; i < documents.length; i += batchSize) {
          batches.push(documents.slice(i, i + batchSize));
        }
        yield* Effect.logDebug("Starting auto-batched classification", {
          totalDocuments: documents.length,
          batchCount: batches.length,
          batchSize,
          concurrency,
        });
        const results = yield* Effect.forEach(
          batches,
          (batch, batchIndex) =>
            Effect.gen(function* () {
              yield* Effect.logDebug("Processing classification batch", {
                batchIndex,
                batchSize: batch.length,
              });
              const result = yield* generateObjectWithRetry({
                prompt: buildBatchPrompt(batch),
                schema: BatchClassificationResponse,
                objectName: "batch_classification",
                serviceName: "DocumentClassifier",
                model: config.llm.model,
                provider: config.llm.provider,
                retryPolicy: config.llm.retryPolicy,
                spanAttributes: {
                  "classifier.mode": "auto_batch",
                  "classifier.batch_index": batchIndex,
                  "classifier.batch_size": batch.length,
                },
              }).pipe(
                Effect.provideService(LanguageModel.LanguageModel, llm),
                Effect.catch((error) =>
                  Effect.gen(function* () {
                    yield* Effect.logWarning("Classification batch failed", {
                      batchIndex,
                      error: Inspectable.toStringUnknown(error),
                    });
                    return { value: { classifications: [] } };
                  })
                )
              );
              return result.value.classifications;
            }),
          { concurrency }
        );
        const classifications = MutableHashMap.empty<number, DocumentClassification>();
        for (const batchResult of results) {
          for (const item of batchResult) {
            MutableHashMap.set(classifications, item.index, item.classification);
          }
        }
        for (const doc of documents) {
          if (!MutableHashMap.has(classifications, doc.index)) {
            MutableHashMap.set(classifications, doc.index, defaultClassification);
          }
        }
        yield* Effect.logInfo("Auto-batched classification complete", {
          totalDocuments: documents.length,
          classifiedCount: MutableHashMap.size(classifications),
        });
        return classifications;
      }),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      ConfigServiceDefault,
      // LanguageModel.LanguageModel provided by parent scope (runtime-selected provider)
    ])
  );

  /**
   * Default layer with ConfigService provided
   *
   * Note: LanguageModel must still be provided by the caller
   */
  static readonly DefaultWithConfig = DocumentClassifier.Default.pipe(Layer.provide(ConfigServiceDefault));

  /**
   * Test layer with mock classification that returns defaults
   */
  static readonly Test = Layer.succeed(
    DocumentClassifier,
    DocumentClassifier.of({
      classify: Effect.fn("DocumentClassifier.classify")((_input: ClassifyInput) =>
        Effect.succeed(defaultClassification)
      ),

      classifyBatch: Effect.fn("DocumentClassifier.classifyBatch")((input: ClassifyBatchInput) =>
        Effect.succeed(MutableHashMap.fromIterable(A.map(input.documents, (doc) => [doc.index, defaultClassification])))
      ),

      classifyWithAutoBatching: Effect.fn("DocumentClassifier.classifyWithAutoBatching")((documents) =>
        Effect.succeed(MutableHashMap.fromIterable(A.map(documents, (doc) => [doc.index, defaultClassification])))
      ),
    })
  );
}
