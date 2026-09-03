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

import { $ScratchpadId } from "@beep/identity";
import { ObjectRef } from "@beep/rdf/Prov";
import { NonNegativeInt } from "@beep/schema/Int";
import { Cause, Chunk, Duration, Effect, Exit, HashSet, Inspectable, Layer, Number as N, pipe, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ExtractionError } from "../Domain/Error/Extraction.ts";
import { LlmRateLimit, LlmTimeout } from "../Domain/Error/Llm.ts";
import { ChunkId } from "../Domain/Identity.ts";
import {
  Entity,
  EntityObservation,
  EvidenceSpan,
  GroundingDecision,
  KnowledgeGraph,
  makeExtractionProvenanceBundle,
  Relation,
  RelationObject,
  RelationObservation,
} from "../Domain/Model/Entity.ts";
import type { RunConfig } from "../Domain/Model/ExtractionRun.ts";
import { GroundingPolicy } from "../Domain/Model/ExtractionRun.ts";
import { ExtractionOutcome } from "../Domain/Model/ExtractionTelemetry.ts";
import { ClassDefinition } from "../Domain/Model/Ontology.ts";
import { ConfigService, ConfigServiceDefault } from "../Service/Config.ts";
import type { Mention } from "../Service/Extraction.ts";
import { EntityExtractor, MentionExtractor, RelationExtractor } from "../Service/Extraction.ts";
import { ExtractionRunService, ExtractionRunServiceDefault } from "../Service/ExtractionRun.ts";
import { ExtractionWorkflow } from "../Service/ExtractionWorkflow.ts";
import {
  EntityGrounderResult,
  Grounder,
  GrounderResult,
  RelationEntityContext,
  RelationVerificationInput,
} from "../Service/Grounder.ts";
import type { TextChunk } from "../Service/Nlp.ts";
import { NlpService } from "../Service/Nlp.ts";
import { OntologyService } from "../Service/Ontology.ts";
import { StorageServiceLive } from "../Service/Storage.ts";
import { captureExtractionTelemetry, recordExtractionChunkCount } from "../Telemetry/ExtractionTelemetry.ts";
import { annotateExtraction, LlmAttributes } from "../Telemetry/LlmAttributes.ts";
import { mergeGraphs } from "./Merge.ts";

const $I = $ScratchpadId.create("effect-ontology/Workflow/StreamingExtraction");

const SYSTEMIC_ERROR_CODES = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"];
const SYSTEMIC_ERROR_MESSAGES = ["connection refused", "database connection", "too many requests"];

class GroundingWorkflowError extends S.TaggedError<GroundingWorkflowError>($I`GroundingWorkflowError`)(
  "GroundingWorkflowError",
  {
    message: S.NonEmptyString,
    cause: S.Defect({ includeStack: true }),
    text: S.NonEmptyString,
  },
  $I.annote("GroundingWorkflowError", {
    description: "Typed failure preserving an enabled grounding operation that must halt extraction.",
  })
) {
  static readonly is = S.is(this);
}

const renderUnknownError = (error: unknown): string =>
  P.isError(error) ? error.message : Inspectable.toStringUnknown(error, 0);

const unknownErrorType = (error: unknown): string =>
  P.hasProperty(error, "_tag") && P.isString(error._tag) ? error._tag : P.isError(error) ? error.name : "Unknown";

/**
 * Determine if an error is systemic and should halt the workflow
 */
const isSystemicError = (error: unknown): boolean => {
  if (GroundingWorkflowError.is(error)) {
    return true;
  }
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

const notEvaluated = GroundingDecision.cases.NotEvaluated.make({});

const isPublishable = (decision: GroundingDecision): boolean =>
  GroundingDecision.guards.NotEvaluated(decision) || GroundingDecision.guards.Supported(decision);

const applyGroundingThreshold = (decision: GroundingDecision, threshold: number): GroundingDecision =>
  GroundingDecision.match(decision, {
    NotEvaluated: () => decision,
    Supported: ({ confidence }) =>
      confidence >= threshold ? decision : GroundingDecision.cases.Rejected.make({ confidence }),
    Rejected: () => decision,
  });

const rejectTypeMismatch = (decision: GroundingDecision, typeMatch: boolean): GroundingDecision =>
  GroundingDecision.match(decision, {
    NotEvaluated: () => decision,
    Supported: ({ confidence }) => (typeMatch ? decision : GroundingDecision.cases.Rejected.make({ confidence })),
    Rejected: () => decision,
  });

const evidenceForContext = Effect.fn("StreamingExtraction.evidenceForContext")(function* (context: string) {
  return yield* S.decodeEffect(EvidenceSpan)({
    text: context,
    startChar: 0,
    endChar: context.length,
  });
});

const entityEvidence = Effect.fn("StreamingExtraction.entityEvidence")(function* (entity: Entity, context: string) {
  return yield* A.match(entity.mentions, {
    onEmpty: () => evidenceForContext(context).pipe(Effect.map(A.of)),
    onNonEmpty: Effect.succeed,
  });
});

const relationEvidence = Effect.fn("StreamingExtraction.relationEvidence")(function* (
  relation: Relation,
  context: string
) {
  return yield* O.match(relation.evidence, {
    onNone: () => evidenceForContext(context).pipe(Effect.map(A.of)),
    onSome: (evidence) => Effect.succeed(A.of(evidence)),
  });
});

const decodeObjectRef = Effect.fn("StreamingExtraction.decodeObjectRef")(function* (value: string) {
  return yield* S.decodeEffect(ObjectRef)(value);
});

/**
 * Constructs the 6-phase streaming extraction program (chunk, retrieve, type, scope, relate, merge).
 *
 * **Example** (Construct the 6-phase workflow layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { ExtractionWorkflow } from "@effect-ontology/Service/ExtractionWorkflow"
 * import { ExtractionWorkflowLive, makeExtractionWorkflow } from "@effect-ontology/Workflow/StreamingExtraction"
 *
 * const layer = Layer.effect(ExtractionWorkflow, makeExtractionWorkflow)
 * console.log(layer !== ExtractionWorkflowLive) // true
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
            overlapSentences: config.chunking.overlapSentences,
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
        yield* recordExtractionChunkCount(NonNegativeInt.make(chunks.length));

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
                const chunkId = ChunkId.fromDocument(run.id, NonNegativeInt.make(chunk.index));
                const rawEntityArray = Chunk.toReadonlyArray(rawEntities);
                const activity = yield* decodeObjectRef(
                  `urn:beep:effect-ontology:activity:extraction:${run.id}:chunk:${chunk.index}`
                );
                const source = yield* decodeObjectRef(`urn:beep:effect-ontology:source:${run.id}:chunk:${chunk.index}`);
                const entityVerificationResults = yield* GroundingPolicy.match(config.grounding, {
                  Disabled: () =>
                    Effect.succeed(
                      A.map(rawEntityArray, (entity) =>
                        EntityGrounderResult.make({ decision: notEvaluated, entity, typeMatch: true })
                      )
                    ),
                  Enabled: (policy) =>
                    Effect.forEach(
                      A.chunksOf(rawEntityArray, policy.batchSize),
                      (batch) => grounder.verifyEntityBatch(chunk.text, batch),
                      { concurrency: 1 }
                    ).pipe(
                      Effect.map((batches) => A.flatten(batches)),
                      Effect.map((results) =>
                        A.map(results, (result) =>
                          EntityGrounderResult.make({
                            decision: rejectTypeMismatch(
                              applyGroundingThreshold(result.decision, policy.threshold),
                              result.typeMatch
                            ),
                            entity: result.entity,
                            typeMatch: result.typeMatch,
                          })
                        )
                      ),
                      Effect.annotateLogs({ chunkIndex: chunk.index }),
                      Effect.withLogSpan(`chunk-${chunk.index}-entity-grounding`),
                      Effect.mapError((error) =>
                        GroundingWorkflowError.make({
                          message: `Entity grounding verification failed for chunk ${chunk.index}`,
                          cause: error,
                          text: chunk.text,
                        })
                      )
                    ),
                });
                const entityAudit = yield* Effect.forEach(
                  entityVerificationResults,
                  Effect.fn("StreamingExtraction.makeEntityObservation")(function* (
                    result: EntityGrounderResult,
                    index: number
                  ) {
                    const provenance = yield* decodeObjectRef(
                      `urn:beep:effect-ontology:artifact:${run.id}:chunk:${chunk.index}:entity:${index}`
                    );
                    const observationId = yield* decodeObjectRef(`${provenance}:observation`);
                    const evidence = yield* entityEvidence(result.entity, chunk.text);
                    const observation = EntityObservation.make({
                      id: observationId,
                      provenance,
                      activity,
                      source,
                      evidence,
                      grounding: result.decision,
                    });
                    return {
                      entity: Entity.make({
                        id: result.entity.id,
                        mention: result.entity.mention,
                        types: result.entity.types,
                        attributes: result.entity.attributes,
                        chunkIndex: O.some(NonNegativeInt.make(chunk.index)),
                        chunkId: O.some(chunkId),
                        documentId: result.entity.documentId,
                        sourceUri: result.entity.sourceUri,
                        extractedAt: result.entity.extractedAt,
                        eventTime: result.entity.eventTime,
                        mentions: result.entity.mentions,
                        grounding: result.decision,
                        observations: [observation],
                      }),
                      observation,
                      provenance,
                    };
                  })
                );
                const entityObservations = A.map(entityAudit, ({ observation }) => observation);
                const entityProvenance = makeExtractionProvenanceBundle(
                  activity,
                  source,
                  A.map(entityAudit, ({ provenance }) => provenance)
                );
                const entities = pipe(
                  entityAudit,
                  A.map(({ entity }) => entity),
                  A.filter((entity) => isPublishable(entity.grounding))
                );
                yield* Effect.logInfo("Entity grounding verification complete", {
                  stage: "entity-grounding",
                  chunkIndex: chunk.index,
                  inputEntities: rawEntityArray.length,
                  supportedEntities: A.length(
                    A.filter(entityVerificationResults, (result) => GroundingDecision.guards.Supported(result.decision))
                  ),
                  rejectedEntities: A.length(
                    A.filter(entityVerificationResults, (result) => GroundingDecision.guards.Rejected(result.decision))
                  ),
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
                    provenance: entityProvenance,
                    entityObservations,
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
                    provenance: entityProvenance,
                    entityObservations,
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
                    const subject = A.findFirst(entityArray, (entity) => entity.id === relation.subjectId);
                    const predicate = A.findFirst(propertyArray, (property) => property.id === relation.predicate);
                    return RelationVerificationInput.make({
                      context: chunk.text,
                      relation,
                      subject: O.map(subject, (value) =>
                        RelationEntityContext.make({
                          entityId: value.id,
                          mention: value.mention,
                          types: value.types,
                        })
                      ),
                      predicate,
                      object: RelationObject.match(relation.object, {
                        EntityReference: ({ value }) => {
                          const referencedEntity = A.findFirst(entityArray, (entity) => entity.id === value);
                          return O.map(referencedEntity, ({ mention, types }) =>
                            RelationEntityContext.make({ entityId: value, mention, types })
                          );
                        },
                        Text: O.none,
                        Number: O.none,
                        Boolean: O.none,
                      }),
                    });
                  }
                );
                const verificationResults = yield* GroundingPolicy.match(config.grounding, {
                  Disabled: () =>
                    Effect.succeed(
                      A.map(verificationInputs, ({ relation }) =>
                        GrounderResult.make({ decision: notEvaluated, relation })
                      )
                    ),
                  Enabled: (policy) =>
                    Effect.forEach(
                      A.chunksOf(verificationInputs, policy.batchSize),
                      (batch) => grounder.verifyRelationBatch(chunk.text, batch),
                      { concurrency: 1 }
                    ).pipe(
                      Effect.map((batches) => A.flatten(batches)),
                      Effect.map((results) =>
                        A.map(results, (result) =>
                          GrounderResult.make({
                            decision: applyGroundingThreshold(result.decision, policy.threshold),
                            relation: result.relation,
                          })
                        )
                      ),
                      Effect.annotateLogs({ chunkIndex: chunk.index }),
                      Effect.withLogSpan(`chunk-${chunk.index}-relation-grounding`),
                      Effect.mapError((error) =>
                        GroundingWorkflowError.make({
                          message: `Relation grounding verification failed for chunk ${chunk.index}`,
                          cause: error,
                          text: chunk.text,
                        })
                      )
                    ),
                });
                const relationAudit = yield* Effect.forEach(
                  verificationResults,
                  Effect.fn("StreamingExtraction.makeRelationObservation")(function* (
                    result: GrounderResult,
                    index: number
                  ) {
                    const provenance = yield* decodeObjectRef(
                      `urn:beep:effect-ontology:artifact:${run.id}:chunk:${chunk.index}:relation:${index}`
                    );
                    const observationId = yield* decodeObjectRef(`${provenance}:observation`);
                    const evidence = yield* relationEvidence(result.relation, chunk.text);
                    const observation = RelationObservation.make({
                      id: observationId,
                      provenance,
                      activity,
                      source,
                      evidence,
                      grounding: result.decision,
                    });
                    return {
                      relation: Relation.make({
                        subjectId: result.relation.subjectId,
                        predicate: result.relation.predicate,
                        object: result.relation.object,
                        evidence: result.relation.evidence,
                        grounding: result.decision,
                        observations: [observation],
                      }),
                      observation,
                      provenance,
                    };
                  })
                );
                const relationObservations = A.map(relationAudit, ({ observation }) => observation);
                const verifiedRelationArray = pipe(
                  relationAudit,
                  A.map(({ relation }) => relation),
                  A.filter((relation) => isPublishable(relation.grounding))
                );
                yield* Effect.logInfo("Grounder verification complete", {
                  stage: "grounder",
                  chunkIndex: chunk.index,
                  inputRelations: relationArray.length,
                  publishedRelations: verifiedRelationArray.length,
                  rejectedRelations: A.length(
                    A.filter(verificationResults, (result) => GroundingDecision.guards.Rejected(result.decision))
                  ),
                });
                const fragment = KnowledgeGraph.make({
                  entities: entityArray,
                  relations: verifiedRelationArray,
                  provenance: makeExtractionProvenanceBundle(
                    activity,
                    source,
                    A.appendAll(
                      A.map(entityAudit, ({ provenance }) => provenance),
                      A.map(relationAudit, ({ provenance }) => provenance)
                    )
                  ),
                  entityObservations,
                  relationObservations,
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
                  Effect.catchIf(P.not(isSystemicError), (error) =>
                    Effect.gen(function* () {
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
                    })
                  ),
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
        captureExtractionTelemetry(
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
        ).pipe(Effect.map(([graph, telemetry]) => ExtractionOutcome.make({ graph, telemetry })))
    ),
  };
});

/**
 * ExtractionWorkflow Implementation Layer
 *
 * **Gotchas**
 *
 * `OntologyService.Default` requires StorageService even though it is missing
 * from that service's declared dependencies. This layer `provideMerge`s
 * `StorageServiceLive` so construction does not leave a hole.
 *
 * **Example** (Provide the live 6-phase workflow)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { ExtractionWorkflow } from "@effect-ontology/Service/ExtractionWorkflow"
 * import { StorageServiceLive } from "@effect-ontology/Service/Storage"
 * import { ExtractionWorkflowLive, makeExtractionWorkflow } from "@effect-ontology/Workflow/StreamingExtraction"
 *
 * const constructed = Layer.effect(ExtractionWorkflow, makeExtractionWorkflow)
 * console.log(ExtractionWorkflowLive !== constructed) // true
 * console.log(ExtractionWorkflowLive !== StorageServiceLive) // true
 * ```
 *
 * @see {@link ExtractionWorkflow} for the service contract defined in Service/ExtractionWorkflow.
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
 * **Example** (Alias the live extraction workflow layer)
 *
 * ```ts
 * import { ExtractionWorkflowDefault, ExtractionWorkflowLive } from "@effect-ontology/Workflow/StreamingExtraction"
 *
 * console.log(ExtractionWorkflowDefault === ExtractionWorkflowLive) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExtractionWorkflowDefault = ExtractionWorkflowLive;
