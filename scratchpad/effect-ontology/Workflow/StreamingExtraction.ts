/**
 * Workflow: Streaming Extraction
 *
 * **Details**
 *
 * Stream-based extraction workflow for large documents.
 * Implements the 6-phase pipeline: chunking, retrieval, entity extraction,
 * property scoping, relation extraction, and merge.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema/Int";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Cause, Chunk, Duration, Effect, Exit, HashSet, Inspectable, Layer, Number as N, pipe, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { ExtractionError } from "../Domain/Error/Extraction.ts";
import { LlmRateLimit, LlmTimeout } from "../Domain/Error/Llm.ts";
import { ChunkId } from "../Domain/Identity.ts";
import { Entity, KnowledgeGraph } from "../Domain/Model/Entity.ts";
import type { RunConfig } from "../Domain/Model/ExtractionRun.ts";
import { ClassDefinition } from "../Domain/Model/Ontology.ts";
import { ConfigService, ConfigServiceDefault } from "../Service/Config.ts";
import type { Mention } from "../Service/Extraction.ts";
import { EntityExtractor, MentionExtractor, RelationExtractor } from "../Service/Extraction.ts";
import { ExtractionRunService, ExtractionRunServiceDefault } from "../Service/ExtractionRun.ts";
import { ExtractionWorkflow } from "../Service/ExtractionWorkflow.ts";
import type { RelationVerificationInput } from "../Service/Grounder.ts";
import { Grounder } from "../Service/Grounder.ts";
import type { TextChunk } from "../Service/Nlp.ts";
import { NlpService } from "../Service/Nlp.ts";
import { OntologyService } from "../Service/Ontology.ts";
import { StorageServiceLive } from "../Service/Storage.ts";
import { annotateExtraction, LlmAttributes } from "../Telemetry/LlmAttributes.ts";
import { mergeGraphs } from "./Merge.ts";

const GROUNDER_CONFIDENCE_THRESHOLD = 0.8;
const SYSTEMIC_ERROR_CODES = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"];
const SYSTEMIC_ERROR_MESSAGES = ["connection refused", "database connection", "too many requests"];

const renderUnknownError = (error: unknown): string =>
  P.isError(error) ? error.message : Inspectable.toStringUnknown(error, 0);

const unknownErrorType = (error: unknown): string =>
  P.hasProperty(error, "_tag") && P.isString(error._tag) ? error._tag : P.isError(error) ? error.name : "Unknown";

/**
 * Determine if an error is systemic and should halt the workflow
 */
const isSystemicError = (error: unknown): boolean => {
  // Unwrap ExtractionError if present
  const cause = ExtractionError.is(error) ? O.getOrElse(error.cause, () => error) : error;

  if (LlmRateLimit.is(cause) || LlmTimeout.is(cause)) {
    return true;
  }

  if (P.isError(cause)) {
    if (P.hasProperty(cause, "code") && P.isString(cause.code) && A.contains(SYSTEMIC_ERROR_CODES, cause.code)) {
      return true;
    }

    const message = Str.toLowerCase(cause.message);
    return A.some(SYSTEMIC_ERROR_MESSAGES, (fragment) => Str.includes(fragment)(message));
  }

  return false;
};

const getChunkId = (runId: string, index: number) => `${runId}_chunk_${index}`;

/**
 * Validates and represents make extraction workflow values at runtime.
 *
 * **Example** (Inspect make extraction workflow)
 *
 * ```ts
 * import { makeExtractionWorkflow } from "@effect-ontology/Workflow/StreamingExtraction"
 *
 * console.log(makeExtractionWorkflow)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeExtractionWorkflow = Effect.gen(function* () {
  const configService = yield* ConfigService;
  const [nlp, ontology, mentionExtractor, entityExtractor, relationExtractor, grounder, runService] = yield* Effect.all(
    [NlpService, OntologyService, MentionExtractor, EntityExtractor, RelationExtractor, Grounder, ExtractionRunService]
  );

  return {
    /**
     * Extract knowledge graph from text using streaming extraction
     *
     * @param text - Source text to extract from
     * @param config - Run configuration (chunking params, concurrency, ontology path)
     * @param concurrency - Max parallel extraction tasks (default: from config)
     * @returns Effect yielding merged KnowledgeGraph
     */
    extract: Effect.fn("ExtractionWorkflow.extract")(
      function* (text: string, config: RunConfig, concurrency?: number) {
        // Create extraction run from text hash
        const run = yield* runService.createRun(text, config).pipe(
          Effect.mapError((error) =>
            ExtractionError.make({
              message: `Failed to create extraction run: ${error.message}`,
              cause: O.some(error),
              text: O.some(text),
            })
          )
        );

        const effectiveConcurrency = concurrency ?? config.concurrency;

        yield* Effect.logInfo("Starting streaming extraction", {
          stage: "streaming-extraction",
          textLength: text.length,
          concurrency: effectiveConcurrency,
          runId: run.id,
        });

        // Get class hierarchy checker for OWL subclass reasoning in domain/range validation
        const isSubClassOf = yield* ontology.getClassHierarchyChecker();

        // Phase 1: Chunk text
        const chunks = yield* nlp
          .chunkText(text, {
            maxChunkSize: config.chunking.maxChunkSize,
            preserveSentences: config.chunking.preserveSentences,
          })
          .pipe(
            Effect.withLogSpan("chunking"),
            Effect.tap((chunks) =>
              Effect.logInfo("Text chunking complete", {
                stage: "chunking",
                chunkCount: chunks.length,
                avgChunkSize: A.match(chunks, {
                  onEmpty: () => 0,
                  onNonEmpty: (values) =>
                    N.round(A.reduce(values, 0, (sum, chunk) => sum + chunk.text.length) / values.length),
                }),
              })
            )
          );

        // Save chunks to run folder
        yield* Effect.all(
          A.map(chunks, (chunk) =>
            runService.saveChunk(run.id, NonNegativeInt.make(chunk.index), chunk.text).pipe(
              Effect.tapError((error) =>
                Effect.logWarning("Failed to save chunk", {
                  stage: "chunking",
                  chunkIndex: chunk.index,
                  error: renderUnknownError(error),
                })
              ),
              Effect.orElseSucceed(() => undefined)
            )
          ),
          { concurrency: 4 }
        );

        // Short-circuit if no chunks
        if (A.isReadonlyArrayEmpty(chunks)) {
          yield* Effect.logWarning("No chunks generated from text", {
            stage: "chunking",
            textLength: text.length,
          });
          return KnowledgeGraph.make({
            entities: [],
            relations: [],
          });
        }

        // Phase 2-5: Process chunks in parallel with bounded concurrency (unordered for max throughput)
        return yield* Stream.fromIterable(chunks).pipe(
          Stream.mapEffect(
            Effect.fnUntraced(
              function* (chunk: TextChunk) {
                yield* Effect.logDebug("Processing chunk", {
                  stage: "chunk-processing",
                  chunkIndex: chunk.index,
                  chunkLength: chunk.text.length,
                  chunkPreview: Str.slice(0, 100)(chunk.text),
                });
                const mentions = yield* mentionExtractor.extract(chunk.text).pipe(
                  Effect.withLogSpan(`chunk-${chunk.index}-mention-extraction`),
                  Effect.tap((mentions) =>
                    Effect.logDebug("Mention extraction complete", {
                      stage: "mention-extraction",
                      chunkIndex: chunk.index,
                      mentionCount: Chunk.toReadonlyArray(mentions).length,
                    })
                  ),
                  Effect.mapError((error) =>
                    ExtractionError.make({
                      message: `Mention extraction failed for chunk ${chunk.index}`,
                      cause: O.some(error),
                      text: O.some(chunk.text),
                    })
                  )
                );
                const mentionArray: ReadonlyArray<Mention> = Chunk.toReadonlyArray(mentions);
                if (A.isReadonlyArrayEmpty(mentionArray)) {
                  yield* Effect.logWarning("No mentions found for chunk", {
                    stage: "mention-extraction",
                    chunkIndex: chunk.index,
                  });
                  return KnowledgeGraph.make({
                    entities: [],
                    relations: [],
                  });
                }
                const aggregatedQuery = pipe(
                  A.map(mentionArray, (m: Mention) =>
                    P.isNotUndefined(m.context) ? `${m.mention}: ${m.context}` : m.mention
                  ),
                  A.join(" ")
                );
                const candidateClasses = yield* ontology.searchClassesHybrid(aggregatedQuery, 100).pipe(
                  Effect.timeout(Duration.seconds(30)),
                  Effect.withLogSpan(`chunk-${chunk.index}-hybrid-class-retrieval`),
                  Effect.tap((classes) =>
                    Effect.logDebug("Hybrid class retrieval complete", {
                      stage: "hybrid-class-retrieval",
                      chunkIndex: chunk.index,
                      mentionCount: mentionArray.length,
                      candidateClassCount: Chunk.size(classes),
                    })
                  ),
                  Effect.catch(
                    Effect.fnUntraced(function* (error) {
                      yield* Effect.logWarning("Hybrid search failed, using ontology fallback", {
                        stage: "hybrid-class-retrieval",
                        chunkIndex: chunk.index,
                        error: renderUnknownError(error),
                      });
                      const ctx = yield* ontology.ontology;
                      const classes = yield* Effect.forEach(A.take(ctx.classes, 100), (value) =>
                        ClassDefinition.decodeUnknownEffect(value)
                      );
                      return Chunk.fromIterable(classes);
                    })
                  )
                );
                const classArray = Chunk.toReadonlyArray(candidateClasses);
                if (A.isReadonlyArrayEmpty(classArray)) {
                  yield* Effect.logWarning("No classes found for any mention", {
                    stage: "entity-level-retrieval",
                    chunkIndex: chunk.index,
                  });
                  return KnowledgeGraph.make({
                    entities: [],
                    relations: [],
                  });
                }
                const candidateDatatypeProperties = yield* ontology
                  .getPropertiesFor(A.map(classArray, (c) => c.id))
                  .pipe(
                    Effect.withLogSpan(`chunk-${chunk.index}-datatype-properties`),
                    Effect.tap((properties) =>
                      Effect.logDebug("Datatype properties scoped", {
                        stage: "datatype-properties",
                        chunkIndex: chunk.index,
                        propertyCount: Chunk.toReadonlyArray(properties).length,
                      })
                    ),
                    Effect.map((properties) =>
                      A.filter(Chunk.toReadonlyArray(properties), (p) => p.rangeType === "datatype")
                    ),
                    Effect.mapError((error) =>
                      ExtractionError.make({
                        message: `Datatype property scoping failed for chunk ${chunk.index}`,
                        cause: O.some(error),
                        text: O.some(chunk.text),
                      })
                    )
                  );
                const rawEntities = yield* entityExtractor
                  .extract(chunk.text, classArray, candidateDatatypeProperties)
                  .pipe(
                    Effect.annotateLogs({ chunkIndex: chunk.index }),
                    Effect.withLogSpan(`chunk-${chunk.index}-entity-extraction`),
                    Effect.mapError((error) =>
                      ExtractionError.make({
                        message: `Entity extraction failed for chunk ${chunk.index}`,
                        cause: O.some(error),
                        text: O.some(chunk.text),
                      })
                    )
                  );
                const chunkId = getChunkId(run.id, chunk.index);
                const rawEntityArray = Chunk.toReadonlyArray(rawEntities);
                const entityVerificationResults = A.isReadonlyArrayNonEmpty(rawEntityArray)
                  ? yield* grounder.verifyEntityBatch(chunk.text, rawEntityArray).pipe(
                      Effect.annotateLogs({ chunkIndex: chunk.index }),
                      Effect.withLogSpan(`chunk-${chunk.index}-entity-grounding`),
                      Effect.mapError((error) =>
                        ExtractionError.make({
                          message: `Entity grounding verification failed for chunk ${chunk.index}`,
                          cause: O.some(error),
                          text: O.some(chunk.text),
                        })
                      )
                    )
                  : [];
                const entities = A.map(entityVerificationResults, (result) => {
                  const entity = result.entity;
                  const groundingConfidence = result.grounded ? result.confidence : 0;
                  return Entity.make({
                    id: entity.id,
                    mention: entity.mention,
                    types: [...entity.types],
                    attributes: { ...entity.attributes },
                    chunkIndex: O.some(NonNegativeInt.make(chunk.index)),
                    chunkId: O.some(ChunkId.make(chunkId)),
                    groundingConfidence: O.some(UnitInterval.make(groundingConfidence)),
                  });
                });
                yield* Effect.logInfo("Entity grounding verification complete", {
                  stage: "entity-grounding",
                  chunkIndex: chunk.index,
                  inputEntities: rawEntityArray.length,
                  groundedEntities: A.length(A.filter(entityVerificationResults, (result) => result.grounded)),
                });
                const entitiesChunk = Chunk.fromIterable(entities);
                const entityArray = entities;
                if (A.isReadonlyArrayEmpty(entityArray)) {
                  yield* Effect.logWarning("No entities extracted from chunk", {
                    stage: "entity-extraction",
                    chunkIndex: chunk.index,
                  });
                  return KnowledgeGraph.make({
                    entities: [],
                    relations: [],
                  });
                }
                const typeArray = A.fromIterable(
                  HashSet.fromIterable(A.flatMap(entityArray, (entity) => entity.types))
                );
                const properties = yield* ontology.getPropertiesFor(typeArray).pipe(
                  Effect.withLogSpan(`chunk-${chunk.index}-property-scoping`),
                  Effect.tap((properties) =>
                    Effect.logDebug("Property scoping complete", {
                      stage: "property-scoping",
                      chunkIndex: chunk.index,
                      typeCount: typeArray.length,
                      propertyCount: Chunk.toReadonlyArray(properties).length,
                    })
                  ),
                  Effect.mapError((error) =>
                    ExtractionError.make({
                      message: `Property scoping failed for chunk ${chunk.index}`,
                      cause: O.some(error),
                      text: O.some(chunk.text),
                    })
                  )
                );
                const propertyArray = Chunk.toReadonlyArray(properties);
                if (entityArray.length < 2 || propertyArray.length === 0) {
                  yield* Effect.logDebug("Skipping relation extraction", {
                    stage: "relation-extraction",
                    chunkIndex: chunk.index,
                    reason: entityArray.length < 2 ? "insufficient entities" : "no properties",
                    entityCount: entityArray.length,
                    propertyCount: propertyArray.length,
                  });
                  return KnowledgeGraph.make({
                    entities: entityArray,
                    relations: [],
                  });
                }
                const relations = yield* relationExtractor
                  .extract(chunk.text, entitiesChunk, propertyArray, isSubClassOf)
                  .pipe(
                    Effect.annotateLogs({ chunkIndex: chunk.index }),
                    Effect.withLogSpan(`chunk-${chunk.index}-relation-extraction`),
                    Effect.mapError((error) =>
                      ExtractionError.make({
                        message: `Relation extraction failed for chunk ${chunk.index}`,
                        cause: O.some(error),
                        text: O.some(chunk.text),
                      })
                    )
                  );
                const relationArray = Chunk.toReadonlyArray(relations);
                const verificationInputs: ReadonlyArray<RelationVerificationInput> = A.map(
                  relationArray,
                  (relation) => {
                    const subject = O.getOrUndefined(
                      A.findFirst(entityArray, (entity) => entity.id === relation.subjectId)
                    );
                    const objectEntity = P.isTagged(relation.object, "EntityReference")
                      ? O.getOrUndefined(A.findFirst(entityArray, (entity) => entity.id === relation.object.value))
                      : undefined;
                    const predicate = O.getOrUndefined(
                      A.findFirst(propertyArray, (property) => property.id === relation.predicate)
                    );
                    return {
                      context: chunk.text,
                      relation,
                      ...(P.isNotUndefined(subject)
                        ? {
                            subject: {
                              entityId: subject.id,
                              mention: subject.mention,
                              types: subject.types,
                            },
                          }
                        : {}),
                      ...(P.isNotUndefined(predicate) ? { predicate } : {}),
                      object:
                        relation.object._tag === "EntityReference"
                          ? {
                              entityId: relation.object.value,
                              ...(P.isNotUndefined(objectEntity)
                                ? {
                                    mention: objectEntity.mention,
                                    types: objectEntity.types,
                                  }
                                : {}),
                            }
                          : {
                              literal: relation.object.value,
                            },
                    };
                  }
                );
                const verificationResults = A.isReadonlyArrayNonEmpty(verificationInputs)
                  ? yield* grounder.verifyRelationBatch(chunk.text, verificationInputs).pipe(
                      Effect.annotateLogs({ chunkIndex: chunk.index }),
                      Effect.withLogSpan(`chunk-${chunk.index}-grounding`),
                      Effect.mapError((error) =>
                        ExtractionError.make({
                          message: `Grounder verification failed for chunk ${chunk.index}`,
                          cause: O.some(error),
                          text: O.some(chunk.text),
                        })
                      )
                    )
                  : [];
                const verifiedRelationArray = pipe(
                  verificationResults,
                  A.filter((result) => result.grounded && result.confidence >= GROUNDER_CONFIDENCE_THRESHOLD),
                  A.map((result) => result.relation)
                );
                yield* Effect.logInfo("Grounder verification complete", {
                  stage: "grounder",
                  chunkIndex: chunk.index,
                  inputRelations: relationArray.length,
                  verifiedRelations: verifiedRelationArray.length,
                });
                const fragment = KnowledgeGraph.make({
                  entities: entityArray,
                  relations: verifiedRelationArray,
                });
                yield* Effect.all([
                  Effect.logDebug("Chunk processing complete", {
                    stage: "chunk-processing",
                    chunkIndex: chunk.index,
                    entityCount: fragment.entities.length,
                    relationCount: fragment.relations.length,
                  }),
                  annotateExtraction({
                    chunkIndex: chunk.index,
                    chunkTextLength: chunk.text.length,
                    entityCount: fragment.entities.length,
                    relationCount: fragment.relations.length,
                    mentionCount: mentionArray.length,
                    candidateClassCount: classArray.length,
                  }),
                ]);
                return fragment;
              },
              (effect, chunk) =>
                effect.pipe(
                  Effect.withSpan(`chunk-${chunk.index}-processing`, {
                    attributes: {
                      [LlmAttributes.CHUNK_INDEX]: chunk.index,
                      [LlmAttributes.CHUNK_TEXT_LENGTH]: chunk.text.length,
                    },
                  }),
                  Effect.catch((error) => {
                    if (isSystemicError(error)) {
                      return Effect.fail(error);
                    }
                    return Effect.gen(function* () {
                      yield* Effect.logError("Chunk processing failed (content error - skipping)", {
                        stage: "chunk-processing",
                        chunkIndex: chunk.index,
                        error: renderUnknownError(error),
                        errorType: unknownErrorType(error),
                        isSystemic: false,
                      });
                      yield* Effect.annotateCurrentSpan("chunk.failed", true);
                      yield* Effect.annotateCurrentSpan("chunk.error_type", unknownErrorType(error));
                      return KnowledgeGraph.make({ entities: [], relations: [] });
                    });
                  }),
                  Effect.exit
                )
            ),
            { concurrency: effectiveConcurrency, unordered: true }
          ),
          Stream.mapEffect(
            Effect.fnUntraced(function* (exit): Effect.fn.Return<Chunk.Chunk<KnowledgeGraph>, ExtractionError> {
              if (Exit.isSuccess(exit)) return Chunk.of(exit.value);
              const cause = exit.cause;
              yield* Effect.when(
                Effect.logError("Defect in chunk processing", {
                  defect: Cause.pretty(cause),
                }),
                Effect.succeed(Cause.hasDies(cause))
              );
              return yield* Effect.failCause(
                Cause.map(cause, (error) =>
                  ExtractionError.is(error)
                    ? error
                    : ExtractionError.make({
                        message: "Unexpected chunk processing failure",
                        cause: O.some(error),
                      })
                )
              );
            })
          ),
          Stream.flatMap((graphs) => Stream.fromIterable(graphs)),
          Stream.buffer({ capacity: effectiveConcurrency * 2 }),
          Stream.runFold(
            () =>
              KnowledgeGraph.make({
                entities: [],
                relations: [],
              }),
            mergeGraphs
          ),
          Effect.tap((graph) =>
            Effect.all([
              Effect.logInfo("Streaming extraction complete", {
                stage: "streaming-extraction",
                totalEntities: graph.entities.length,
                totalRelations: graph.relations.length,
                uniqueEntityTypes: HashSet.size(
                  HashSet.fromIterable(A.flatMap(graph.entities, (entity) => entity.types))
                ),
              }),
              Effect.annotateCurrentSpan(LlmAttributes.ENTITY_COUNT, graph.entities.length),
              Effect.annotateCurrentSpan(LlmAttributes.RELATION_COUNT, graph.relations.length),
            ])
          ),
          Effect.withSpan("graph-merge")
        );
      },
      (effect, text) =>
        effect.pipe(
          Effect.mapError(
            (error: unknown): ExtractionError =>
              ExtractionError.is(error)
                ? error
                : ExtractionError.make({
                    message: `Streaming extraction failed: ${renderUnknownError(error)}`,
                    cause: O.some(error),
                    text: O.some(text),
                  })
          ),
          Effect.withSpan("extraction-pipeline", {
            attributes: {
              "extraction.type": "streaming",
            },
          }),
          Effect.provideService(ConfigService, configService)
        )
    ),
  };
});

/**
 * ExtractionWorkflow Service
 *
 * Stream-based extraction workflow for large documents.
 * Implements the 6-phase pipeline: chunking, retrieval, entity extraction,
 * property scoping, relation extraction, and merge.
 *
 * @since 0.0.0
 * @category services
 */
/**
 * ExtractionWorkflow Implementation Layer
 *
 * **Example** (Inspect extraction workflow live)
 *
 * ```ts
 * import { ExtractionWorkflowLive } from "@effect-ontology/Workflow/StreamingExtraction"
 *
 * console.log(ExtractionWorkflowLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExtractionWorkflowLive = Layer.effect(ExtractionWorkflow, makeExtractionWorkflow).pipe(
  Layer.provideMerge(ConfigServiceDefault),
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
);

/**
 * ExtractionWorkflow Default layer
 *
 * **Details**
 *
 * Alias for ExtractionWorkflowLive, following the Effect.Service convention.
 *
 * **Example** (Inspect extraction workflow default)
 *
 * ```ts
 * import { ExtractionWorkflowDefault } from "@effect-ontology/Workflow/StreamingExtraction"
 *
 * console.log(ExtractionWorkflowDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExtractionWorkflowDefault = ExtractionWorkflowLive;
