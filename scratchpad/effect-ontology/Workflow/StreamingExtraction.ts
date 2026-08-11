/**
 * Workflow: Streaming Extraction
 *
 * Stream-based extraction workflow for large documents.
 * Implements the 6-phase pipeline: chunking, retrieval, entity extraction,
 * property scoping, relation extraction, and merge.
 *
 * @since 2.0.0
 * @module Workflow/StreamingExtraction
 */

import { Cause, Chunk, Duration, Effect, Exit, Layer, Option, Stream } from "effect"
import { ExtractionError } from "../Domain/Error/Extraction.ts"
import { LlmRateLimit, LlmTimeout } from "../Domain/Error/Llm.ts"
import { Entity, KnowledgeGraph } from "../Domain/Model/Entity.ts"
import { type RunConfig } from "../Domain/Model/ExtractionRun.ts"
import { EntityExtractor, type Mention, MentionExtractor, RelationExtractor } from "../Service/Extraction.ts"
import { ExtractionRunService, ExtractionRunServiceDefault } from "../Service/ExtractionRun.ts"
import { ExtractionWorkflow } from "../Service/ExtractionWorkflow.ts"
import { Grounder } from "../Service/Grounder.ts"
import { NlpService } from "../Service/Nlp.ts"
import { OntologyService } from "../Service/Ontology.ts"
import { StorageServiceLive } from "../Service/Storage.ts"
import { annotateExtraction, LlmAttributes } from "../Telemetry/LlmAttributes.ts"
import { mergeGraphs } from "./Merge.ts"
import * as O from "effect/Option";

const GROUNDER_CONFIDENCE_THRESHOLD = 0.8

/**
 * Determine if an error is systemic and should halt the workflow
 */
const isSystemicError = (error: unknown): boolean => {
  // Unwrap ExtractionError if present
  const cause = error instanceof ExtractionError ? error.cause : error

  if (cause instanceof LlmRateLimit || cause instanceof LlmTimeout) {
    return true
  }

  if (cause instanceof Error) {
    // Check for standard Node.js/Bun system error codes
    // Use type guard to safely access .code property on Error subclasses
    const code = "code" in cause && typeof (cause as { code?: unknown }).code === "string"
      ? (cause as { code: string }).code
      : undefined
    if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
      return true
    }

    const message = cause.message.toLowerCase()
    return (
      message.includes("connection refused") ||
      message.includes("database connection") ||
      message.includes("too many requests")
    )
  }

  return false
}

const getChunkId = (runId: string, index: number) => `${runId}_chunk_${index}`

export const makeExtractionWorkflow = Effect.gen(function*() {
  const [nlp, ontology, mentionExtractor, entityExtractor, relationExtractor, grounder, runService] = yield* Effect.all(
    [
      NlpService,
      OntologyService,
      MentionExtractor,
      EntityExtractor,
      RelationExtractor,
      Grounder,
      ExtractionRunService
    ]
  )

  return {
    /**
     * Extract knowledge graph from text using streaming extraction
     *
     * @param text - Source text to extract from
     * @param config - Run configuration (chunking params, concurrency, ontology path)
     * @param concurrency - Max parallel extraction tasks (default: from config)
     * @returns Effect yielding merged KnowledgeGraph
     */
    extract: (
      text: string,
      config: RunConfig,
      concurrency?: number
    ): Effect.Effect<KnowledgeGraph, ExtractionError, never> => {
      return (Effect.gen(function*() {
        // Create extraction run from text hash
        const run = yield* runService.createRun(text, config).pipe(
          Effect.mapError(
            (error: Error) =>
              ExtractionError.make({
                message: `Failed to create extraction run: ${error.message}`,
                cause: O.some(error),
                text: O.some(text)
              })
          )
        )

        const effectiveConcurrency = concurrency ?? config.concurrency

        yield* Effect.logInfo("Starting streaming extraction", {
          stage: "streaming-extraction",
          textLength: text.length,
          concurrency: effectiveConcurrency,
          runId: run.id
        })

        // Get class hierarchy checker for OWL subclass reasoning in domain/range validation
        const isSubClassOf = yield* ontology.getClassHierarchyChecker()

        // Phase 1: Chunk text
        const chunks = yield* nlp.chunkText(text, {
          maxChunkSize: config.chunking.maxChunkSize,
          preserveSentences: config.chunking.preserveSentences
        }).pipe(
          Effect.withLogSpan("chunking"),
          Effect.tap((chunks) =>
            Effect.logInfo("Text chunking complete", {
              stage: "chunking",
              chunkCount: chunks.length,
              avgChunkSize: chunks.length > 0
                ? Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length)
                : 0
            })
          )
        )

        // Save chunks to run folder
        yield* Effect.all(
          chunks.map((chunk) =>
            runService.saveChunk(run.id, chunk.index, chunk.text).pipe(
              Effect.tapError((error) =>
                Effect.logWarning("Failed to save chunk", {
                  stage: "chunking",
                  chunkIndex: chunk.index,
                  error: String(error)
                })
              ),
              Effect.orElseSucceed(() => undefined)
            )
          ),
          { concurrency: 4 }
        )

        // Short-circuit if no chunks
        if (chunks.length === 0) {
          yield* Effect.logWarning("No chunks generated from text", {
            stage: "chunking",
            textLength: text.length
          })
          return KnowledgeGraph.make({
            entities: [],
            relations: []
          })
        }

        // Phase 2-5: Process chunks in parallel with bounded concurrency (unordered for max throughput)
        const graphFragments = yield* Stream.fromIterable(chunks)
          .pipe(
            Stream.mapEffect(
              (chunk) =>
                Effect.gen(function*() {
                  yield* Effect.logDebug("Processing chunk", {
                    stage: "chunk-processing",
                    chunkIndex: chunk.index,
                    chunkLength: chunk.text.length,
                    chunkPreview: chunk.text.slice(0, 100)
                  })

                  // Phase 2a: Mention extraction - extract entity mentions without types
                  const mentions = yield* mentionExtractor
                    .extract(chunk.text)
                    .pipe(
                      Effect.withLogSpan(`chunk-${chunk.index}-mention-extraction`),
                      Effect.tap((mentions) =>
                        Effect.logDebug("Mention extraction complete", {
                          stage: "mention-extraction",
                          chunkIndex: chunk.index,
                          mentionCount: Chunk.toReadonlyArray(mentions).length
                        })
                      ),
                      Effect.mapError(
                        (error) =>
                          ExtractionError.make({
                            message: `Mention extraction failed for chunk ${chunk.index}`,
                            cause: O.some(error),
                            text: O.some(chunk.text)
                          })
                      )
                    )

                  const mentionArray: ReadonlyArray<Mention> = Chunk.toReadonlyArray(mentions) as ReadonlyArray<Mention>

                  // Skip if no mentions found
                  if (mentionArray.length === 0) {
                    yield* Effect.logWarning("No mentions found for chunk", {
                      stage: "mention-extraction",
                      chunkIndex: chunk.index
                    })
                    return KnowledgeGraph.make({
                      entities: [],
                      relations: []
                    })
                  }

                  // Phase 2b: Chunk-level hybrid search - get candidate classes for all mentions
                  // Aggregate all mention contexts for better retrieval (1 search instead of N)
                  const aggregatedQuery = mentionArray
                    .map((m: Mention) => m.context ? `${m.mention}: ${m.context}` : m.mention)
                    .join(" ")

                  const candidateClasses = yield* ontology.searchClassesHybrid(aggregatedQuery, 100).pipe(
                    Effect.timeout(Duration.seconds(30)),
                    Effect.withLogSpan(`chunk-${chunk.index}-hybrid-class-retrieval`),
                    Effect.tap((classes) =>
                      Effect.logDebug("Hybrid class retrieval complete", {
                        stage: "hybrid-class-retrieval",
                        chunkIndex: chunk.index,
                        mentionCount: mentionArray.length,
                        candidateClassCount: Chunk.size(classes)
                      })
                    ),
                    // Graceful fallback: if hybrid search fails, get all ontology classes up to limit
                    Effect.catch((error) =>
                      Effect.gen(function*() {
                        yield* Effect.logWarning("Hybrid search failed, using ontology fallback", {
                          stage: "hybrid-class-retrieval",
                          chunkIndex: chunk.index,
                          error: String(error)
                        })
                        const ctx = yield* ontology.ontology
                        return Chunk.fromIterable(ctx.classes.slice(0, 100))
                      })
                    )
                  )

                  const classArray = Chunk.toReadonlyArray(candidateClasses)

                  // Skip if no classes found
                  if (classArray.length === 0) {
                    yield* Effect.logWarning("No classes found for any mention", {
                      stage: "entity-level-retrieval",
                      chunkIndex: chunk.index
                    })
                    return KnowledgeGraph.make({
                      entities: [],
                      relations: []
                    })
                  }

                  // Phase 3: Entity extraction with aggregated candidate classes
                  // Pre-compute datatype properties allowed for these classes (attribute constraints)
                  const candidateDatatypeProperties = yield* ontology
                    .getPropertiesFor(classArray.map((c) => c.id))
                    .pipe(
                      Effect.withLogSpan(`chunk-${chunk.index}-datatype-properties`),
                      Effect.tap((properties) =>
                        Effect.logDebug("Datatype properties scoped", {
                          stage: "datatype-properties",
                          chunkIndex: chunk.index,
                          propertyCount: Chunk.toReadonlyArray(properties).length
                        })
                      ),
                      Effect.map((properties) =>
                        Chunk.toReadonlyArray(properties).filter((p) => p.rangeType === "datatype")
                      ),
                      Effect.mapError(
                        (error) =>
                          ExtractionError.make({
                            message: `Datatype property scoping failed for chunk ${chunk.index}`,
                            cause: O.some(error),
                            text: O.some(chunk.text)
                          })
                      )
                    )

                  const rawEntities = yield* entityExtractor
                    .extract(chunk.text, classArray, candidateDatatypeProperties)
                    .pipe(
                      Effect.annotateLogs({ chunkIndex: chunk.index }),
                      Effect.withLogSpan(`chunk-${chunk.index}-entity-extraction`),
                      Effect.mapError(
                        (error) =>
                          ExtractionError.make({
                            message: `Entity extraction failed for chunk ${chunk.index}`,
                            cause: O.some(error),
                            text: O.some(chunk.text)
                          })
                      )
                    )

                  // Add chunk index and chunk ID to each entity for provenance tracking
                  const chunkId = getChunkId(run.id, chunk.index)
                  const rawEntityArray = Chunk.toReadonlyArray(rawEntities)

                  // Phase 3b: Entity grounding verification - verify entities are grounded in source text
                  // Uses batched verification to reduce LLM API calls
                  const entityVerificationResults = rawEntityArray.length > 0
                    ? yield* grounder.verifyEntityBatch(chunk.text, rawEntityArray).pipe(
                      Effect.annotateLogs({ chunkIndex: chunk.index }),
                      Effect.withLogSpan(`chunk-${chunk.index}-entity-grounding`),
                      Effect.mapError(
                        (error) =>
                          ExtractionError.make({
                            message: `Entity grounding verification failed for chunk ${chunk.index}`,
                            cause: O.some(error),
                            text: O.some(chunk.text)
                          })
                      )
                    )
                    : []

                  // Map verification results back to entities with groundingConfidence and chunk metadata
                  const entities = entityVerificationResults.map((result) => {
                    const entity = result.entity
                    const groundingConfidence = result.grounded
                      ? result.confidence
                      : 0.0

                    return Entity.make({
                      id: entity.id,
                      mention: entity.mention,
                      types: [...entity.types],
                      attributes: { ...entity.attributes },
                      chunkIndex: O.some(chunk.index),
                      chunkId: O.some(chunkId),
                      groundingConfidence
                    })
                  })

                  yield* Effect.logInfo("Entity grounding verification complete", {
                    stage: "entity-grounding",
                    chunkIndex: chunk.index,
                    inputEntities: rawEntityArray.length,
                    groundedEntities: entityVerificationResults.filter((r) => r.grounded).length
                  })

                  // Convert back to Chunk for downstream API compatibility
                  const entitiesChunk = Chunk.fromIterable(entities)
                  const entityArray = entities

                  // Short-circuit if no entities
                  if (entityArray.length === 0) {
                    yield* Effect.logWarning("No entities extracted from chunk", {
                      stage: "entity-extraction",
                      chunkIndex: chunk.index
                    })
                    return KnowledgeGraph.make({
                      entities: [],
                      relations: []
                    })
                  }

                  // Phase 4: Property scoping - get properties for entity types
                  // Collect all unique types from entities
                  const typeSet = new Set<string>()
                  for (const entity of entityArray) {
                    for (const type of entity.types) {
                      typeSet.add(type)
                    }
                  }

                  const typeArray = Array.from(typeSet)
                  const properties = yield* ontology.getPropertiesFor(typeArray).pipe(
                    Effect.withLogSpan(`chunk-${chunk.index}-property-scoping`),
                    Effect.tap((properties) =>
                      Effect.logDebug("Property scoping complete", {
                        stage: "property-scoping",
                        chunkIndex: chunk.index,
                        typeCount: typeArray.length,
                        propertyCount: Chunk.toReadonlyArray(properties).length
                      })
                    ),
                    Effect.mapError(
                      (error) =>
                        ExtractionError.make({
                          message: `Property scoping failed for chunk ${chunk.index}`,
                          cause: O.some(error),
                          text: O.some(chunk.text)
                        })
                    )
                  )

                  const propertyArray = Chunk.toReadonlyArray(properties)

                  // Phase 5: Relation extraction
                  // Short-circuit if insufficient entities or properties
                  if (entityArray.length < 2 || propertyArray.length === 0) {
                    yield* Effect.logDebug("Skipping relation extraction", {
                      stage: "relation-extraction",
                      chunkIndex: chunk.index,
                      reason: entityArray.length < 2 ? "insufficient entities" : "no properties",
                      entityCount: entityArray.length,
                      propertyCount: propertyArray.length
                    })
                    return KnowledgeGraph.make({
                      entities: entityArray,
                      relations: []
                    })
                  }

                  const relations = yield* relationExtractor.extract(chunk.text, entitiesChunk, propertyArray, isSubClassOf).pipe(
                    Effect.annotateLogs({ chunkIndex: chunk.index }),
                    Effect.withLogSpan(`chunk-${chunk.index}-relation-extraction`),
                    Effect.mapError(
                      (error) =>
                        ExtractionError.make({
                          message: `Relation extraction failed for chunk ${chunk.index}`,
                          cause: O.some(error),
                          text: O.some(chunk.text)
                        })
                    )
                  )

                  const relationArray = Chunk.toReadonlyArray(relations)

                  // Phase 5b: Grounding verification - filter relations by context alignment
                  // Uses batched verification to reduce LLM API calls
                  const verificationInputs = relationArray.map((relation) => {
                    const subject = entityArray.find((entity) => entity.id === relation.subjectId)
                    const objectEntity = typeof relation.object === "string"
                      ? entityArray.find((entity) => entity.id === relation.object)
                      : undefined
                    const predicate = propertyArray.find((property) => property.id === relation.predicate)

                    return {
                      context: chunk.text,
                      relation,
                      subject: subject && {
                        entityId: subject.id,
                        mention: subject.mention,
                        types: subject.types
                      },
                      predicate,
                      object: typeof relation.object === "string"
                        ? {
                          entityId: relation.object,
                          mention: objectEntity?.mention,
                          types: objectEntity?.types
                        }
                        : {
                          literal: relation.object
                        }
                    }
                  })

                  // Batch verify all relations in one LLM call (or skip if none)
                  const verificationResults = verificationInputs.length > 0
                    ? yield* grounder.verifyRelationBatch(chunk.text, verificationInputs).pipe(
                      Effect.annotateLogs({ chunkIndex: chunk.index }),
                      Effect.withLogSpan(`chunk-${chunk.index}-grounding`),
                      Effect.mapError(
                        (error) =>
                          ExtractionError.make({
                            message: `Grounder verification failed for chunk ${chunk.index}`,
                            cause: O.some(error),
                            text: O.some(chunk.text)
                          })
                      )
                    )
                    : []

                  // Filter to only grounded relations with sufficient confidence
                  const verifiedRelationArray = verificationResults
                    .filter((result) => result.grounded && result.confidence >= GROUNDER_CONFIDENCE_THRESHOLD)
                    .map((result) => result.relation)

                  yield* Effect.logInfo("Grounder verification complete", {
                    stage: "grounder",
                    chunkIndex: chunk.index,
                    inputRelations: relationArray.length,
                    verifiedRelations: verifiedRelationArray.length
                  })

                  // Build KnowledgeGraph fragment
                  const fragment = KnowledgeGraph.make({
                    entities: entityArray,
                    relations: verifiedRelationArray
                  })

                  yield* Effect.all([
                    Effect.logDebug("Chunk processing complete", {
                      stage: "chunk-processing",
                      chunkIndex: chunk.index,
                      entityCount: fragment.entities.length,
                      relationCount: fragment.relations.length
                    }),
                    annotateExtraction({
                      chunkIndex: chunk.index,
                      chunkTextLength: chunk.text.length,
                      entityCount: fragment.entities.length,
                      relationCount: fragment.relations.length,
                      mentionCount: mentionArray.length,
                      candidateClassCount: classArray.length
                    })
                  ])

                  return fragment
                }).pipe(
                  Effect.withSpan(`chunk-${chunk.index}-processing`, {
                    attributes: {
                      [LlmAttributes.CHUNK_INDEX]: chunk.index,
                      [LlmAttributes.CHUNK_TEXT_LENGTH]: chunk.text.length
                    }
                  }),
                  // Catch all errors from chunk processing
                  Effect.catch((error) => {
                    if (isSystemicError(error)) {
                      // Fail fast for systemic errors (propagates failure to Stream)
                      return Effect.fail(error)
                    }

                    // Log and suppress content errors (return empty graph)
                    return Effect.gen(function*() {
                      yield* Effect.logError("Chunk processing failed (content error - skipping)", {
                        stage: "chunk-processing",
                        chunkIndex: chunk.index,
                        error: error instanceof Error ? error.message : String(error),
                        errorType: error instanceof Error ? error.constructor.name : "Unknown",
                        isSystemic: false
                      })
                      yield* Effect.annotateCurrentSpan("chunk.failed", true)
                      yield* Effect.annotateCurrentSpan(
                        "chunk.error_type",
                        error instanceof Error ? error.constructor.name : "Unknown"
                      )
                      return KnowledgeGraph.make({ entities: [], relations: [] })
                    })
                  })
                ).pipe(Effect.exit),
              { concurrency: effectiveConcurrency, unordered: true }
            ),
            Stream.mapEffect((exit) =>
              Effect.gen(function*() {
                if (Exit.isSuccess(exit)) return Option.some(exit.value)

                const cause = exit.cause
                if (Cause.isDie(cause)) {
                  yield* Effect.logWarning("Defect in chunk processing", {
                    defect: Cause.pretty(cause)
                  })
                  return Option.none()
                }
                // Propagate systemic errors or interruptions
                return yield* Effect.failCause(cause)
              })
            ),
            Stream.filterMap((x) => x),
            // Add buffer for backpressure - limits memory accumulation for in-flight chunks
            Stream.buffer({ capacity: effectiveConcurrency * 2 }),
            // Phase 6: Merge all fragments using monoid operation
            Stream.runFold(
              KnowledgeGraph.make({ entities: [], relations: [] }), // Identity element
              mergeGraphs
            )
          ).pipe(
            Effect.tap((graph) =>
              Effect.all([
                Effect.logInfo("Streaming extraction complete", {
                  stage: "streaming-extraction",
                  totalEntities: graph.entities.length,
                  totalRelations: graph.relations.length,
                  uniqueEntityTypes: Array.from(new Set(graph.entities.flatMap((e) => e.types))).length
                }),
                Effect.annotateCurrentSpan(LlmAttributes.ENTITY_COUNT, graph.entities.length),
                Effect.annotateCurrentSpan(LlmAttributes.RELATION_COUNT, graph.relations.length)
              ])
            ),
            Effect.withSpan("graph-merge")
          )

        return graphFragments
      }).pipe(
        Effect.mapError(
          (error: unknown): ExtractionError =>
            error instanceof ExtractionError
              ? error
              : ExtractionError.make({
                message: `Streaming extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                cause: O.some(error instanceof Error ? error : new Error(String(error))),
                text: O.some(text)
              })
        ),
        Effect.withSpan("extraction-pipeline", {
          attributes: {
            "extraction.type": "streaming"
          }
        })
      )) as Effect.Effect<KnowledgeGraph, ExtractionError, never>
    }
  }
})

/**
 * ExtractionWorkflow Service
 *
 * Stream-based extraction workflow for large documents.
 * Implements the 6-phase pipeline: chunking, retrieval, entity extraction,
 * property scoping, relation extraction, and merge.
 *
 * @since 2.0.0
 * @category Services
 */
/**
 * ExtractionWorkflow Implementation Layer
 *
 * @since 2.0.0
 * @category Layers
 */
export const ExtractionWorkflowLive = Layer.effect(
  ExtractionWorkflow,
  makeExtractionWorkflow
).pipe(
  Layer.provideMerge(NlpService.Default),
  Layer.provideMerge(OntologyService.Default),
  Layer.provideMerge(MentionExtractor.Default),
  Layer.provideMerge(EntityExtractor.Default),
  Layer.provideMerge(RelationExtractor.Default),
  Layer.provideMerge(Grounder.Default),
  Layer.provideMerge(ExtractionRunServiceDefault),
  // StorageService is required by OntologyService.Default but not in its dependencies array.
  // We import StorageServiceLive here to ensure it's provided before OntologyService constructs.
  Layer.provideMerge(StorageServiceLive)
)

/**
 * ExtractionWorkflow Default layer
 *
 * Alias for ExtractionWorkflowLive, following the Effect.Service convention.
 *
 * @since 2.0.0
 * @category Layers
 */
export const ExtractionWorkflowDefault = ExtractionWorkflowLive
