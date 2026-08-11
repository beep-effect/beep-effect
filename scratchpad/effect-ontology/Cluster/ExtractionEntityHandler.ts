/**
 * Extraction Entity Handler
 *
 * Implements the KnowledgeGraphExtractor entity behavior with:
 * - Full LLM Control integration (TokenBudget, StageTimeout, RateLimiter)
 * - Grounding verification stage
 * - Streaming progress events with proper stage tracking
 * - Partial result handling on timeouts
 *
 * @since 2.0.0
 * @module Cluster/ExtractionEntityHandler
 */

import type { Entity } from "effect/unstable/cluster"
import { Chunk, Clock, Deferred, Effect, HashMap, Option, Ref, Stream } from "effect"
import type { ProgressEvent } from "../Contract/ProgressStreaming.ts"
import type { ContentHash, ExtractionRunId, Namespace, OntologyName } from "../Domain/Identity.ts"
import type { Relation } from "../Domain/Model/Entity.ts"
import { OntologyRef } from "../Domain/Model/Ontology.ts"
import { ConfigService } from "../Service/Config.ts"
import { EntityExtractor, RelationExtractor } from "../Service/Extraction.ts"
import { ExtractionRunService, getRunIdFromText } from "../Service/ExtractionRun.ts"
import { Grounder, type RelationVerificationInput } from "../Service/Grounder.ts"
import { CentralRateLimiterService, StageTimeoutService, TokenBudgetService } from "../Service/LlmControl/index.ts"
import { NlpService } from "../Service/Nlp.ts"
import { OntologyService } from "../Service/Ontology.ts"
import type { IdempotencyKey } from "../Utils/IdempotencyKey.ts"
import {
  type CancelExtractionRpc,
  computeIdempotencyKey,
  type ExtractFromTextRpc,
  ExtractionParams,
  type GetCachedResultRpc,
  type GetExtractionStatusRpc,
  KnowledgeGraphExtractor,
  type KnowledgeGraphResult
} from "./ExtractionEntity.ts"
import { NonNegativeInt } from "@beep/schema/Int";

// =============================================================================
// Event Factory
// =============================================================================

const makeEvent = (
  runId: string,
  tag: string,
  overallProgress: number,
  extra: Record<string, unknown> = {}
): ProgressEvent =>
  ({
    _tag: tag,
    eventId: crypto.randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    overallProgress,
    ...extra
  }) as ProgressEvent

/**
 * Stage names as defined in architecture
 */
type ExtractionStage =
  | "chunking"
  | "entity_extraction"
  | "relation_extraction"
  | "grounding"
  | "serialization"

/**
 * Make stage_started event
 */
const makeStageStarted = (
  runId: string,
  stage: ExtractionStage,
  overallProgress: number
): ProgressEvent => makeEvent(runId, "stage_started", overallProgress, { stage })

/**
 * Make stage_progress event
 */
const _makeStageProgress = (
  runId: string,
  stage: ExtractionStage,
  overallProgress: number,
  percent: number,
  itemsProcessed: number,
  itemsTotal: number
): ProgressEvent =>
  makeEvent(runId, "stage_progress", overallProgress, {
    stage,
    percent,
    itemsProcessed,
    itemsTotal
  })

/**
 * Make stage_completed event
 */
const makeStageCompleted = (
  runId: string,
  stage: ExtractionStage,
  overallProgress: number,
  durationMs: number,
  itemCount: number
): ProgressEvent =>
  makeEvent(runId, "stage_completed", overallProgress, {
    stage,
    durationMs,
    itemCount
  })

/**
 * Make rate_limited event
 */
const makeRateLimited = (
  runId: string,
  overallProgress: number,
  waitMs: number,
  reason: "tokens" | "requests" | "concurrent"
): ProgressEvent => makeEvent(runId, "rate_limited", overallProgress, { waitMs, reason })

/**
 * Make grounding_progress event
 */
const makeGroundingProgress = (
  runId: string,
  overallProgress: number,
  chunkIndex: number,
  inputRelations: number,
  verifiedRelations: number
): ProgressEvent =>
  makeEvent(runId, "grounding_progress", overallProgress, {
    chunkIndex,
    inputRelations,
    verifiedRelations,
    percent: Math.round((verifiedRelations / Math.max(inputRelations, 1)) * 100)
  })

// =============================================================================
// Stats Accumulator (immutable via Ref)
// =============================================================================

interface ExtractionStats {
  readonly totalEntities: number
  readonly totalRelations: number
  readonly verifiedRelations: number
  readonly successfulChunks: number
  readonly failedChunks: number
  readonly entityTypes: Set<string>
  readonly tokensUsed: number
}

const emptyStats: ExtractionStats = {
  totalEntities: 0,
  totalRelations: 0,
  verifiedRelations: 0,
  successfulChunks: 0,
  failedChunks: 0,
  entityTypes: new Set(),
  tokensUsed: 0
}

// =============================================================================
// Entity Handler
// =============================================================================

/**
 * Cancellation signal type - a Deferred that when completed triggers interruption
 */
type CancellationSignal = Deferred.Deferred<void, never>

export const makeExtractionEntityHandler = Effect.gen(function*() {
  // Capture all dependencies at construction
  const runService = yield* ExtractionRunService
  const nlpService = yield* NlpService
  const entityExtractor = yield* EntityExtractor
  const relationExtractor = yield* RelationExtractor
  const grounder = yield* Grounder
  const ontologyService = yield* OntologyService
  const config = yield* ConfigService

  // LLM Control services
  const tokenBudget = yield* TokenBudgetService
  const stageTimeout = yield* StageTimeoutService
  const rateLimiter = yield* CentralRateLimiterService

  // CANCELLATION REGISTRY: Track running extractions for interruption
  // Key is the idempotencyKey string (not branded to avoid type complexity)
  const cancellationRegistry = yield* Ref.make(
    HashMap.empty<string, CancellationSignal>()
  )

  const ontology = yield* ontologyService.ontology
  const datatypeProperties = ontology.properties.filter((p: any) => p.rangeType === "datatype")
  const objectProperties = ontology.properties.filter((p: any) => p.rangeType === "object")

  // Return handlers directly (no .of() wrapper needed)
  return {
    /**
     * Extract knowledge graph from text with streaming progress
     *
     * Integrates LLM Control services for:
     * - Token budget tracking per stage
     * - Stage timeouts (soft/hard)
     * - Rate limiting with circuit breaker
     * - Grounding verification for relations
     */
    ExtractFromText: (envelope: Entity.Request<typeof ExtractFromTextRpc>) => {
      const { ontologyId, ontologyVersion, params, text } = envelope.payload
      const idempotencyKey = computeIdempotencyKey(
        text,
        ontologyId,
        ontologyVersion,
        ExtractionParams.make(params ?? {})
      )
      const runId = getRunIdFromText(text)

      // Use Stream.unwrapScoped for proper resource management
      return Stream.unwrapScoped(
        Effect.gen(function*() {
          const startTime = yield* Clock.currentTimeMillis

          // CANCELLATION: Create and register cancellation signal
          const cancelSignal = yield* Deferred.make<void, never>()
          const keyString = idempotencyKey as string
          yield* Ref.update(cancellationRegistry, (map) => HashMap.set(map, keyString, cancelSignal))

          // Check cache
          const existingRun = yield* runService.getByKey(idempotencyKey)
          if (existingRun?.status === "complete") {
            return Stream.make(
              makeEvent(runId, "extraction_complete", 100, {
                totalEntities: existingRun.stats?.entityCount ?? 0,
                totalRelations: existingRun.stats?.relationCount ?? 0,
                uniqueEntityTypes: 0,
                totalDurationMs: 0,
                successfulChunks: existingRun.stats?.chunkCount ?? 1,
                failedChunks: 0
              })
            )
          }

          // Reset token budget for new request
          yield* tokenBudget.reset(config.llm.maxTokens)

          // Chunk text with timeout
          const chunkingStart = yield* Clock.currentTimeMillis
          const chunks = yield* stageTimeout.withTimeout(
            "chunking",
            nlpService.chunkText(text, { maxChunkSize: 500, preserveSentences: true }),
            () => Effect.logWarning("Chunking soft timeout reached")
          ).pipe(
            Effect.catchTag(
              "TimeoutError",
              () => Effect.succeed([{ index: 0, text, startOffset: 0, endOffset: text.length }])
            )
          )

          const totalChunks = chunks.length
          const concurrency = config.runtime.concurrency

          // Parse ontologyId to create OntologyRef
          // ontologyId format: "namespace/name" or just "name"
          const ontologyParts = ontologyId.includes("/")
            ? ontologyId.split("/")
            : ["default", ontologyId]
          const ontologyRef = OntologyRef.make({
            namespace: ontologyParts[0] as Namespace,
            name: (ontologyParts[1] ?? ontologyParts[0]) as OntologyName,
            contentHash: ontologyVersion.slice(0, 16) as ContentHash
          })

          yield* runService.createRun(
            text,
            {
              chunking: { maxChunkSize: 500, preserveSentences: true, overlapTokens: 0 },
              llm: {
                model: config.llm.model,
                temperature: config.llm.temperature,
                maxTokens: config.llm.maxTokens,
                timeoutMs: config.llm.timeoutMs
              },
              concurrency,
              ontology: ontologyRef,
              enableGrounding: config.grounder.enabled
            },
            { idempotencyKey, ontologyVersion }
          )
          yield* runService.setStatus(runId as ExtractionRunId, "running")

          // Stats ref for accumulation across chunks
          const statsRef = yield* Ref.make(emptyStats)

          // Events accumulator for building the complete stream
          const events: Array<ProgressEvent> = []

          // Emit extraction started
          events.push(
            makeEvent(runId, "extraction_started", 0, {
              totalChunks,
              textMetadata: {
                characterCount: text.length,
                estimatedAvgChunkSize: Math.round(text.length / Math.max(totalChunks, 1)),
                contentType: "text/plain"
              }
            })
          )

          // Emit chunking stage events
          const chunkingEndTime = yield* Clock.currentTimeMillis
          events.push(makeStageStarted(runId, "chunking", 5))
          events.push(makeStageCompleted(runId, "chunking", 10, Number(chunkingEndTime - chunkingStart), totalChunks))

          // Process chunks with bounded concurrency
          const chunkEventsStream = Stream.fromIterable(chunks).pipe(
            Stream.mapEffect(
              (chunk) =>
                Effect.gen(function*() {
                  const chunkStartTime = yield* Clock.currentTimeMillis
                  const chunkProgress = 10 + ((chunk.index / totalChunks) * 70)
                  const chunkEvents: Array<ProgressEvent> = []

                  // Emit chunk processing started
                  chunkEvents.push(
                    makeEvent(runId, "chunk_processing_started", chunkProgress, {
                      chunkIndex: chunk.index,
                      chunkTextLength: chunk.text.length,
                      textPreview: chunk.text.slice(0, 200)
                    })
                  )

                  // =================================================================
                  // Stage: Entity Extraction with LLM Control
                  // =================================================================
                  chunkEvents.push(makeStageStarted(runId, "entity_extraction", chunkProgress + 5))

                  // Check rate limits before LLM call
                  const estimatedEntityTokens = Math.min(1440, Math.ceil(chunk.text.length * 0.3))
                  yield* rateLimiter.acquire(estimatedEntityTokens).pipe(
                    Effect.catchTags({
                      RateLimitError: (e) =>
                        Effect.gen(function*() {
                          chunkEvents.push(makeRateLimited(runId, chunkProgress, e.retryAfterMs ?? 5000, e.reason))
                          yield* Effect.sleep(e.retryAfterMs ?? 5000)
                          yield* rateLimiter.acquire(estimatedEntityTokens)
                        }),
                      CircuitOpenError: (e) =>
                        Effect.gen(function*() {
                          const retryMs = e.retryAfterMs ?? e.resetTimeoutMs
                          chunkEvents.push(makeRateLimited(runId, chunkProgress, retryMs, "requests"))
                          yield* Effect.sleep(retryMs)
                          yield* rateLimiter.acquire(estimatedEntityTokens)
                        })
                    })
                  )

                  // Check token budget
                  const canAffordEntity = yield* tokenBudget.canAfford("entity_extraction", estimatedEntityTokens)
                  if (!canAffordEntity) {
                    yield* Effect.logWarning("Entity extraction budget exceeded, using reduced scope", {
                      chunkIndex: chunk.index
                    })
                  }

                  // Extract entities with timeout
                  const entityStart = yield* Clock.currentTimeMillis
                  const entities = yield* stageTimeout.withTimeout(
                    "entity_extraction",
                    entityExtractor
                      .extract(chunk.text, ontology.classes, datatypeProperties)
                      .pipe(Effect.orElseSucceed(() => Chunk.empty())),
                    () => Effect.logWarning("Entity extraction soft timeout", { chunkIndex: chunk.index })
                  ).pipe(
                    Effect.tap(() => rateLimiter.release(estimatedEntityTokens, true)),
                    Effect.tap(() => tokenBudget.recordUsage("entity_extraction", estimatedEntityTokens)),
                    Effect.catchTag("TimeoutError", () =>
                      Effect.gen(function*() {
                        yield* rateLimiter.release(estimatedEntityTokens, false)
                        return Chunk.empty()
                      }))
                  )

                  const entityEndTime = yield* Clock.currentTimeMillis
                  chunkEvents.push(
                    makeStageCompleted(
                      runId,
                      "entity_extraction",
                      chunkProgress + 20,
                      Number(entityEndTime - entityStart),
                      Chunk.size(entities)
                    )
                  )

                  // Emit entity_found events
                  for (const entity of Chunk.toReadonlyArray(entities)) {
                    chunkEvents.push(
                      makeEvent(runId, "entity_found", chunkProgress + 25, {
                        chunkIndex: chunk.index,
                        entityId: entity.id,
                        mention: entity.mention,
                        types: entity.types,
                        confidence: 0.9
                      })
                    )
                  }

                  // =================================================================
                  // Stage: Relation Extraction with LLM Control
                  // =================================================================
                  let relations: Chunk.Chunk<Relation> = Chunk.empty()

                  if (Chunk.size(entities) > 1) {
                    chunkEvents.push(makeStageStarted(runId, "relation_extraction", chunkProgress + 30))

                    const estimatedRelationTokens = Math.min(1440, Math.ceil(chunk.text.length * 0.3))
                    yield* rateLimiter.acquire(estimatedRelationTokens).pipe(
                      Effect.catchTags({
                        RateLimitError: (e) =>
                          Effect.gen(function*() {
                            chunkEvents.push(
                              makeRateLimited(runId, chunkProgress + 30, e.retryAfterMs ?? 5000, e.reason)
                            )
                            yield* Effect.sleep(e.retryAfterMs ?? 5000)
                            yield* rateLimiter.acquire(estimatedRelationTokens)
                          }),
                        CircuitOpenError: (e) =>
                          Effect.gen(function*() {
                            const retryMs = e.retryAfterMs ?? e.resetTimeoutMs
                            chunkEvents.push(makeRateLimited(runId, chunkProgress + 30, retryMs, "requests"))
                            yield* Effect.sleep(retryMs)
                            yield* rateLimiter.acquire(estimatedRelationTokens)
                          })
                      })
                    )

                    const relationStart = yield* Clock.currentTimeMillis
                    relations = yield* stageTimeout.withTimeout(
                      "relation_extraction",
                      relationExtractor
                        .extract(chunk.text, entities, objectProperties)
                        .pipe(Effect.orElseSucceed(() => Chunk.empty())),
                      () => Effect.logWarning("Relation extraction soft timeout", { chunkIndex: chunk.index })
                    ).pipe(
                      Effect.tap(() => rateLimiter.release(estimatedRelationTokens, true)),
                      Effect.tap(() => tokenBudget.recordUsage("relation_extraction", estimatedRelationTokens)),
                      Effect.catchTag("TimeoutError", () =>
                        Effect.gen(function*() {
                          yield* rateLimiter.release(estimatedRelationTokens, false)
                          return Chunk.empty()
                        }))
                    )

                    const relationEndTime = yield* Clock.currentTimeMillis
                    chunkEvents.push(
                      makeStageCompleted(
                        runId,
                        "relation_extraction",
                        chunkProgress + 45,
                        Number(relationEndTime - relationStart),
                        Chunk.size(relations)
                      )
                    )
                  }

                  // =================================================================
                  // Stage: Grounding Verification (if enabled)
                  // =================================================================
                  const entityArray = Chunk.toReadonlyArray(entities)
                  const relationArray = Chunk.toReadonlyArray(relations)
                  let verifiedRelations = relationArray

                  if (config.grounder.enabled && relationArray.length > 0) {
                    chunkEvents.push(makeStageStarted(runId, "grounding", chunkProgress + 50))

                    const estimatedGroundingTokens = Math.min(615, relationArray.length * 100)
                    yield* rateLimiter.acquire(estimatedGroundingTokens).pipe(
                      Effect.catchTags({
                        RateLimitError: (e) =>
                          Effect.gen(function*() {
                            chunkEvents.push(
                              makeRateLimited(runId, chunkProgress + 50, e.retryAfterMs ?? 5000, e.reason)
                            )
                            yield* Effect.sleep(e.retryAfterMs ?? 5000)
                            yield* rateLimiter.acquire(estimatedGroundingTokens)
                          }),
                        CircuitOpenError: (e) =>
                          Effect.gen(function*() {
                            const retryMs = e.retryAfterMs ?? e.resetTimeoutMs
                            chunkEvents.push(makeRateLimited(runId, chunkProgress + 50, retryMs, "requests"))
                            yield* Effect.sleep(retryMs)
                            yield* rateLimiter.acquire(estimatedGroundingTokens)
                          })
                      })
                    )

                    // Build verification inputs
                    const verificationInputs: Array<RelationVerificationInput> = relationArray.map((relation) => {
                      const subject = entityArray.find((e: any) => e.id === relation.subjectId)
                      const objectEntity = typeof relation.object === "string"
                        ? entityArray.find((e: any) => e.id === relation.object)
                        : undefined
                      const predicate = objectProperties.find((p: any) => p.id === relation.predicate)

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

                    const groundingStart = yield* Clock.currentTimeMillis
                    const verificationResults = yield* stageTimeout.withTimeout(
                      "grounding",
                      grounder.verifyRelationBatch(chunk.text, verificationInputs),
                      () => Effect.logWarning("Grounding soft timeout", { chunkIndex: chunk.index })
                    ).pipe(
                      Effect.tap(() => rateLimiter.release(estimatedGroundingTokens, true)),
                      Effect.tap(() => tokenBudget.recordUsage("grounding", estimatedGroundingTokens)),
                      Effect.catchTag("TimeoutError", () =>
                        Effect.gen(function*() {
                          yield* rateLimiter.release(estimatedGroundingTokens, false)
                          // On timeout, accept all relations (unverified)
                          return relationArray.map((r) => ({ grounded: true, confidence: 0.5, relation: r }))
                        })),
                      Effect.catch(() =>
                        Effect.succeed(relationArray.map((r) => ({ grounded: true, confidence: 0.5, relation: r })))
                      )
                    )

                    // Filter by confidence threshold
                    verifiedRelations = verificationResults
                      .filter((r: any) => r.grounded && r.confidence >= config.grounder.confidenceThreshold)
                      .map((r: any) => r.relation)

                    // Emit grounding_progress event
                    chunkEvents.push(
                      makeGroundingProgress(
                        runId,
                        chunkProgress + 60,
                        chunk.index,
                        relationArray.length,
                        verifiedRelations.length
                      )
                    )

                    const groundingEndTime = yield* Clock.currentTimeMillis
                    chunkEvents.push(
                      makeStageCompleted(
                        runId,
                        "grounding",
                        chunkProgress + 65,
                        Number(groundingEndTime - groundingStart),
                        verifiedRelations.length
                      )
                    )
                  }

                  // Emit relation_found events for verified relations
                  for (const relation of verifiedRelations) {
                    chunkEvents.push(
                      makeEvent(runId, "relation_found", chunkProgress + 70, {
                        chunkIndex: chunk.index,
                        subjectId: relation.subjectId,
                        predicate: relation.predicate,
                        object: relation.object,
                        isEntityReference: relation.isEntityReference,
                        confidence: 0.85
                      })
                    )
                  }

                  // Update stats
                  yield* Ref.update(statsRef, (s) => ({
                    totalEntities: s.totalEntities + Chunk.size(entities),
                    totalRelations: s.totalRelations + relationArray.length,
                    verifiedRelations: s.verifiedRelations + verifiedRelations.length,
                    successfulChunks: s.successfulChunks + 1,
                    failedChunks: s.failedChunks,
                    entityTypes: new Set([...s.entityTypes, ...entityArray.flatMap((e) => e.types)]),
                    tokensUsed: s.tokensUsed + estimatedEntityTokens
                  }))

                  // Save chunk
                  yield* runService.saveChunk(runId as ExtractionRunId, chunk.index, chunk.text).pipe(Effect.ignore)

                  // Emit chunk complete
                  const chunkEndTime = yield* Clock.currentTimeMillis
                  chunkEvents.push(
                    makeEvent(runId, "chunk_processing_complete", chunkProgress + 80, {
                      chunkIndex: chunk.index,
                      entityCount: Chunk.size(entities),
                      relationCount: verifiedRelations.length,
                      durationMs: Number(chunkEndTime - chunkStartTime)
                    })
                  )

                  return chunkEvents
                }).pipe(
                  Effect.catch(
                    Effect.fn(function*(error)  {
                      yield* Ref.update(statsRef, (s) => ({
                        ...s,
                        failedChunks: s.failedChunks + 1
                      }))
                      yield* Effect.logError("Chunk processing failed", {
                        chunkIndex: chunk.index,
                        error: error instanceof Error ? error.message : String(error)
                      })
                      return [
                        makeEvent(runId, "error_recoverable", 0, {
                          chunkIndex: chunk.index,
                          errorType: "chunk_failure",
                          errorMessage: error instanceof Error ? error.message : String(error),
                          phase: "chunk_processing",
                          recoveryAction: "skipped_chunk"
                        })
                      ]
                    })
                  )
                ),
              { concurrency }
            ),
            Stream.flattenIterable
          )

          // Complete event
          const completeEventStream = Stream.fromEffect(
            Effect.gen(function*() {
              const stats = yield* Ref.get(statsRef)
              const endTime = yield* Clock.currentTimeMillis
              const totalDuration = Number(endTime - startTime)

              yield* runService.updateStats(runId as ExtractionRunId, {
                chunkCount: NonNegativeInt.make(totalChunks),
                entityCount: NonNegativeInt.make(stats.totalEntities),
                relationCount: NonNegativeInt.make(stats.verifiedRelations),
                resolvedCount: NonNegativeInt.make(0),
                clusterCount: NonNegativeInt.make(0),
                tokensUsed: NonNegativeInt.make(stats.tokensUsed),
                durationMs: totalDuration
              })
              yield* runService.completeRun(runId as ExtractionRunId)

              return makeEvent(runId, "extraction_complete", 100, {
                totalEntities: stats.totalEntities,
                totalRelations: stats.verifiedRelations,
                uniqueEntityTypes: stats.entityTypes.size,
                totalDurationMs: totalDuration,
                successfulChunks: stats.successfulChunks,
                failedChunks: stats.failedChunks
              })
            }).pipe(Effect.mapError((e) => (e instanceof Error ? e.message : String(e))))
          )

          // Compose: initial events → chunk events → complete
          const startEvents = Stream.fromIterable(events)
          const mainStream = Stream.concat(startEvents, Stream.concat(chunkEventsStream, completeEventStream))

          // CANCELLATION: Make stream interruptible and clean up on completion/failure/interruption
          // Using Stream.ensuring ensures cleanup runs regardless of termination reason
          return mainStream.pipe(
            Stream.interruptWhen(Deferred.await(cancelSignal)),
            Stream.ensuring(
              Ref.update(cancellationRegistry, (map) => HashMap.remove(map, keyString))
            )
          )
        }).pipe(
          Effect.catch(
            Effect.fn(function*(error)  {
              const errorMsg = error instanceof Error ? error.message : String(error)
              yield* runService.failRun(runId as ExtractionRunId, "llm_error", errorMsg).pipe(Effect.ignore)
              // Clean up cancellation registry on error
              yield* Ref.update(cancellationRegistry, (map) => HashMap.remove(map, idempotencyKey as string))
              return Stream.make(
                makeEvent(runId, "extraction_failed", 0, {
                  errorType: "extraction_error",
                  errorMessage: errorMsg,
                  isRecoverable: false
                })
              )
            })
          ),
          Effect.mapError((e) => (typeof e === "string" ? e : String(e)))
        )
      )
    },

    GetCachedResult:
      Effect.fn(function*(envelope: Entity.Request<typeof GetCachedResultRpc>)  {
        const run = yield* runService.getByKey(envelope.payload.idempotencyKey as IdempotencyKey)
        if (!run || run.status !== "complete") return Option.none<KnowledgeGraphResult>()

        return Option.some({
          entities: [],
          relations: [],
          metadata: {
            idempotencyKey: envelope.payload.idempotencyKey,
            ontologyId: `${run.config.ontology.namespace}/${run.config.ontology.name}`,
            ontologyVersion: run.ontologyVersion ?? "",
            extractedAt: run.completedAt ?? run.createdAt,
            durationMs: run.stats?.durationMs ?? 0
          }
        } )
      }).pipe(Effect.mapError((e) => e.message)),

    CancelExtraction:
      Effect.fn(function* (envelope: Entity.Request<typeof CancelExtractionRpc>)  {
        const key = envelope.payload.idempotencyKey
        const run = yield* runService.getByKey(key as IdempotencyKey).pipe(
          Effect.mapError((e) => e.message)
        )
        if (!run) return yield* Effect.fail("Extraction not found")
        if (run.status === "complete" || run.status === "failed") return false

        // CANCELLATION: Trigger the cancellation signal to interrupt running fibers
        const registry = yield* Ref.get(cancellationRegistry)
        const signal = HashMap.get(registry, key)
        if (Option.isSome(signal)) {
          yield* Deferred.succeed(signal.value, void 0)
          yield* Ref.update(cancellationRegistry, HashMap.remove(key))
          yield* Effect.logInfo(`Cancellation signal sent for extraction: ${key}`)
        }

        yield* runService.failRun(run.id, "cancelled", envelope.payload.reason ?? "User cancelled").pipe(
          Effect.mapError((e) => e.message)
        )
        return true
      }),

    GetExtractionStatus:
      Effect.fn(function*(envelope: Entity.Request<typeof GetExtractionStatusRpc>)  {
        const run = yield* runService.getByKey(envelope.payload.idempotencyKey as IdempotencyKey)
        if (!run) return { status: "pending" as const, progress: 0 }

        return {
          status: run.status,
          progress: run.status === "complete" ? 100 : run.status === "running" ? 50 : 0,
          startedAt: run.createdAt,
          completedAt: run.completedAt,
          error: run.errors.length > 0 ? run.errors[run.errors.length - 1].message : undefined
        }
      }).pipe(Effect.mapError((e) => e.message))
  }
})

export const ExtractionEntityHandlerLayer = KnowledgeGraphExtractor.toLayer(
  makeExtractionEntityHandler.pipe(Effect.orDie)
)
