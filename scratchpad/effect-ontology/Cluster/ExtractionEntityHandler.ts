/**
 * Extraction Entity Handler
 *
 * **Details**
 *
 * Implements the KnowledgeGraphExtractor entity behavior with Effect-native
 * time, randomness, cancellation, rate limiting, and extraction services.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { Percentage } from "@beep/schema/Percentage";
import type { UnitInterval } from "@beep/schema/UnitInterval";
import { thunk0 } from "@beep/utils/thunk";
import {
  Chunk,
  DateTime,
  Deferred,
  Duration,
  Effect,
  HashMap,
  HashSet,
  Inspectable,
  Random,
  Ref,
  Stream,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Entity as ClusterEntity } from "effect/unstable/cluster";
import { ProgressEventSchema } from "../Contract/ProgressStreaming.ts";
import { ExtractionError } from "../Domain/Error/Extraction.ts";
import { ContentHash, IdempotencyKey, Namespace, OntologyName } from "../Domain/Identity.ts";
import { RunStatus } from "../Domain/Model/ExtractionRun.ts";
import { OntologyRef } from "../Domain/Model/Ontology.ts";
import { ConfigService } from "../Service/Config.ts";
import { EntityExtractor, RelationExtractor } from "../Service/Extraction.ts";
import { ExtractionRunService, getRunIdFromText } from "../Service/ExtractionRun.ts";
import { Grounder } from "../Service/Grounder.ts";
import { CentralRateLimiterService, StageTimeoutService, TokenBudgetService } from "../Service/LlmControl/index.ts";
import { NlpService } from "../Service/Nlp.ts";
import { OntologyService } from "../Service/Ontology.ts";
import { computeIdempotencyKey, ExtractionParams } from "../Utils/IdempotencyKey.ts";
import type {
  CancelExtractionRpc,
  ExtractFromTextRpc,
  GetCachedResultRpc,
  GetExtractionStatusRpc,
  KnowledgeGraphResult,
} from "./ExtractionEntity.ts";
import { ExtractionStatus, KnowledgeGraphExtractor } from "./ExtractionEntity.ts";

const $I = $ScratchpadId.create("effect-ontology/Cluster/ExtractionEntityHandler");

class ExtractionStats extends S.Class<ExtractionStats>($I`ExtractionStats`)(
  {
    totalEntities: NonNegativeInt.pipe(S.withConstructorDefault(Effect.succeed(NonNegativeInt.make(0)))).annotateKey({
      description: "Total entities extracted across completed chunks.",
    }),
    totalRelations: NonNegativeInt.pipe(S.withConstructorDefault(Effect.succeed(NonNegativeInt.make(0)))).annotateKey({
      description: "Total relations extracted across completed chunks.",
    }),
    verifiedRelations: NonNegativeInt.pipe(
      S.withConstructorDefault(Effect.succeed(NonNegativeInt.make(0)))
    ).annotateKey({
      description: "Extracted relations accepted by grounding.",
    }),
    successfulChunks: NonNegativeInt.pipe(S.withConstructorDefault(Effect.succeed(NonNegativeInt.make(0)))).annotateKey(
      {
        description: "Chunks that completed extraction successfully.",
      }
    ),
    failedChunks: NonNegativeInt.pipe(S.withConstructorDefault(Effect.succeed(NonNegativeInt.make(0)))).annotateKey({
      description: "Chunks whose extraction failed.",
    }),
    entityTypes: S.HashSet(S.String)
      .pipe(S.withConstructorDefault(Effect.succeed(HashSet.empty())))
      .annotateKey({
        description: "Distinct entity types observed during extraction.",
      }),
    tokensUsed: NonNegativeInt.pipe(S.withConstructorDefault(Effect.succeed(NonNegativeInt.make(0)))).annotateKey({
      description: "Estimated language-model tokens consumed.",
    }),
  },
  $I.annote("ExtractionStats", {
    description: "Running extraction counters with schema-owned empty defaults.",
  })
) {}

const emptyStats = ExtractionStats.make({});

type CancellationSignal = Deferred.Deferred<void>;

const toExtractionError = (error: unknown): ExtractionError =>
  ExtractionError.is(error)
    ? error
    : ExtractionError.make({
        message: Inspectable.toStringUnknown(error),
        cause: O.some(error),
      });

const makeEvent = Effect.fn("ExtractionEntityHandler.makeEvent")(function* (
  runId: string,
  tag: string,
  overallProgress: number,
  extra: Record<string, unknown> = {}
) {
  const eventNumber = yield* Random.nextInt;
  const timestamp = DateTime.formatIso(yield* DateTime.now);
  return yield* S.decodeUnknownEffect(ProgressEventSchema)({
    _tag: tag,
    eventId: `evt-${eventNumber}`,
    runId,
    timestamp,
    overallProgress,
    ...extra,
  }).pipe(Effect.mapError(toExtractionError));
});

const toExtractionParams = (
  params: O.Option<{
    readonly maxTokens: O.Option<PosInt>;
    readonly temperature: O.Option<number>;
    readonly includeConfidence: O.Option<boolean>;
    readonly groundingThreshold: O.Option<UnitInterval>;
  }>
) =>
  O.match(params, {
    onNone: () => ExtractionParams.make({}),
    onSome: (value) =>
      ExtractionParams.make({
        maxTokens: value.maxTokens,
        temperature: value.temperature,
        groundingThreshold: value.groundingThreshold,
        ...(O.isSome(value.includeConfidence) ? { includeConfidence: value.includeConfidence.value } : {}),
      }),
  });

/**
 * Validates and represents make extraction entity handler values at runtime.
 *
 * **Example** (Inspect make extraction entity handler)
 *
 * ```ts
 * import { makeExtractionEntityHandler } from "@effect-ontology/Cluster/ExtractionEntityHandler"
 *
 * console.log(makeExtractionEntityHandler)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeExtractionEntityHandler = Effect.gen(function* () {
  const runService = yield* ExtractionRunService;
  const nlpService = yield* NlpService;
  const entityExtractor = yield* EntityExtractor;
  const relationExtractor = yield* RelationExtractor;
  const grounder = yield* Grounder;
  const ontologyService = yield* OntologyService;
  const config = yield* ConfigService;
  const tokenBudget = yield* TokenBudgetService;
  const stageTimeout = yield* StageTimeoutService;
  const rateLimiter = yield* CentralRateLimiterService;
  const cancellationRegistry = yield* Ref.make(HashMap.empty<IdempotencyKey, CancellationSignal>());

  const ontology = yield* ontologyService.ontology;
  const datatypeProperties = ontology.properties.filter((property) => property.rangeType === "datatype");
  const objectProperties = ontology.properties.filter((property) => property.rangeType === "object");

  const acquireRateLimit = Effect.fn("ExtractionEntityHandler.acquireRateLimit")(
    function* (estimatedTokens: number) {
      yield* rateLimiter.acquire(estimatedTokens);
    },
    (effect, estimatedTokens) =>
      effect.pipe(
        Effect.catchTag("RateLimitError", (error) =>
          Effect.sleep(O.getOrElse(error.retryAfterMs, () => 5_000)).pipe(
            Effect.andThen(rateLimiter.acquire(estimatedTokens))
          )
        )
      )
  );

  const extractFromText = Effect.fn("ExtractionEntityHandler.extractFromText")(
    function* (envelope: ClusterEntity.Request<typeof ExtractFromTextRpc>) {
      const { ontologyId, ontologyVersion, params, text } = envelope.payload;
      const idempotencyKey = IdempotencyKey.make(
        computeIdempotencyKey(text, ontologyId, ontologyVersion, toExtractionParams(params))
      );
      const runId = getRunIdFromText(text);
      const keyString = idempotencyKey;
      const startTime = yield* DateTime.now;
      const cancelSignal = yield* Deferred.make<void>();
      yield* Ref.update(cancellationRegistry, HashMap.set(keyString, cancelSignal));

      const existingRun = yield* runService.getByKey(idempotencyKey);
      if (P.isNotNull(existingRun) && existingRun.status._tag === "Complete") {
        const stats = O.getOrElse(existingRun.stats, () => emptyStats);
        return Stream.make(
          yield* makeEvent(runId, "extraction_complete", 100, {
            totalEntities: "entityCount" in stats ? stats.entityCount : stats.totalEntities,
            totalRelations: "relationCount" in stats ? stats.relationCount : stats.verifiedRelations,
            uniqueEntityTypes: 0,
            totalDurationMs: "duration" in stats ? Duration.toMillis(stats.duration) : 0,
            successfulChunks: "chunkCount" in stats ? stats.chunkCount : stats.successfulChunks,
            failedChunks: 0,
          })
        );
      }

      yield* tokenBudget.reset(config.llm.maxTokens);
      const chunkingStart = yield* DateTime.now;
      const chunks = yield* stageTimeout
        .withTimeout(
          "chunking",
          nlpService.chunkText(text, {
            maxChunkSize: PosInt.make(500),
            preserveSentences: true,
          }),
          () => Effect.logWarning("Chunking soft timeout reached")
        )
        .pipe(
          Effect.catchTag("TimeoutError", () =>
            Effect.succeed([
              {
                index: 0,
                text,
                startOffset: 0,
                endOffset: text.length,
              },
            ])
          )
        );

      const ontologyParts = Str.includes("/")(ontologyId) ? Str.split("/")(ontologyId) : ["default", ontologyId];
      const namespace = yield* S.decodeEffect(Namespace)(ontologyParts[0]);
      const name = yield* S.decodeEffect(OntologyName)(ontologyParts[1] ?? ontologyParts[0]);
      const ontologyRef = OntologyRef.make({
        namespace,
        name,
        contentHash: yield* S.decodeEffect(ContentHash)(ontologyVersion),
      });

      yield* runService.createRun(
        text,
        {
          chunking: {
            maxChunkSize: PosInt.make(500),
            preserveSentences: true,
            overlapTokens: NonNegativeInt.make(0),
          },
          llm: {
            model: config.llm.model,
            temperature: config.llm.temperature,
            maxTokens: PosInt.make(config.llm.maxTokens),
            timeout: config.llm.retryPolicy.attemptTimeout,
          },
          concurrency: PosInt.make(config.runtime.concurrency),
          ontology: ontologyRef,
          enableGrounding: config.grounder.enabled,
        },
        { idempotencyKey, ontologyVersion }
      );
      yield* runService.setStatus(runId, RunStatus.cases.Running.make({ startedAt: yield* DateTime.now }));

      const statsRef = yield* Ref.make(emptyStats);
      const initialEvents = [
        yield* makeEvent(runId, "extraction_started", 0, {
          totalChunks: chunks.length,
          textMetadata: {
            characterCount: text.length,
            estimatedAvgChunkSize: Math.round(text.length / Math.max(chunks.length, 1)),
            contentType: "text/plain",
          },
        }),
        yield* makeEvent(runId, "stage_started", 5, { stage: "chunking" }),
        yield* makeEvent(runId, "stage_completed", 10, {
          stage: "chunking",
          durationMs: DateTime.distance(chunkingStart, yield* DateTime.now).pipe(Duration.toMillis),
          itemCount: chunks.length,
        }),
      ];

      const chunkEvents = yield* Effect.forEach(
        chunks,
        Effect.fn("ExtractionEntityHandler.processChunk")(function* (chunk) {
          const chunkProgress = 10 + Math.round((chunk.index / Math.max(chunks.length, 1)) * 80);
          const estimatedTokens = Math.ceil(chunk.text.length / 4);
          const events = [
            yield* makeEvent(runId, "chunk_processing_started", chunkProgress, {
              chunkIndex: chunk.index,
              totalChunks: chunks.length,
              characterCount: chunk.text.length,
            }),
          ];

          yield* acquireRateLimit(estimatedTokens);
          const entities = yield* entityExtractor.extract(chunk.text, ontology.classes, datatypeProperties);
          const relations = yield* relationExtractor.extract(chunk.text, entities, objectProperties);
          const relationArray = Chunk.toReadonlyArray(relations);
          const verifiedRelations = config.grounder.enabled
            ? (yield* grounder.verifyRelationBatch(
                chunk.text,
                A.map(relationArray, (relation) => ({
                  context: chunk.text,
                  relation,
                }))
              )).filter((result) => result.grounded)
            : A.map(relationArray, (relation) => ({
                relation,
                grounded: true,
                confidence: Confidence.make(1),
              }));

          const entityArray = Chunk.toReadonlyArray(entities);
          const entityTypes = HashSet.fromIterable(entityArray.flatMap((entity) => entity.types));
          yield* tokenBudget.recordUsage("entity_extraction", estimatedTokens);
          yield* Ref.update(statsRef, (stats) =>
            ExtractionStats.make({
              totalEntities: NonNegativeInt.make(stats.totalEntities + entityArray.length),
              totalRelations: NonNegativeInt.make(stats.totalRelations + relationArray.length),
              verifiedRelations: NonNegativeInt.make(stats.verifiedRelations + verifiedRelations.length),
              successfulChunks: NonNegativeInt.make(stats.successfulChunks + 1),
              failedChunks: stats.failedChunks,
              entityTypes: HashSet.union(stats.entityTypes, entityTypes),
              tokensUsed: NonNegativeInt.make(stats.tokensUsed + estimatedTokens),
            })
          );
          yield* rateLimiter.release(estimatedTokens, true);

          events.push(
            yield* makeEvent(runId, "chunk_processing_complete", chunkProgress + 5, {
              chunkIndex: chunk.index,
              entityCount: entityArray.length,
              relationCount: verifiedRelations.length,
            })
          );
          return events;
        }),
        { concurrency: config.runtime.concurrency }
      );

      const stats = yield* Ref.get(statsRef);
      const totalDuration = DateTime.distance(startTime, yield* DateTime.now).pipe(Duration.toMillis);
      yield* runService.updateStats(runId, {
        chunkCount: NonNegativeInt.make(chunks.length),
        entityCount: NonNegativeInt.make(stats.totalEntities),
        relationCount: NonNegativeInt.make(stats.verifiedRelations),
        resolvedCount: NonNegativeInt.make(0),
        clusterCount: NonNegativeInt.make(0),
        tokensUsed: NonNegativeInt.make(stats.tokensUsed),
        duration: Duration.millis(totalDuration),
      });
      yield* runService.completeRun(runId);

      const completion = yield* makeEvent(runId, "extraction_complete", 100, {
        totalEntities: stats.totalEntities,
        totalRelations: stats.verifiedRelations,
        uniqueEntityTypes: HashSet.size(stats.entityTypes),
        totalDurationMs: totalDuration,
        successfulChunks: stats.successfulChunks,
        failedChunks: stats.failedChunks,
      });
      const stream = Stream.fromIterable([...initialEvents, ...chunkEvents.flat(), completion]);
      return stream.pipe(
        Stream.interruptWhen(Deferred.await(cancelSignal)),
        Stream.ensuring(Ref.update(cancellationRegistry, HashMap.remove(keyString)))
      );
    },
    (effect, envelope) =>
      effect.pipe(
        Effect.catch((error) => {
          const text = envelope.payload.text;
          const runId = getRunIdFromText(text);
          const { ontologyId, ontologyVersion, params } = envelope.payload;
          const idempotencyKey = IdempotencyKey.make(
            computeIdempotencyKey(text, ontologyId, ontologyVersion, toExtractionParams(params))
          );
          const extractionError = toExtractionError(error);
          return Effect.gen(function* () {
            yield* runService.failRun(runId, "llm_error", extractionError.message).pipe(Effect.ignore);
            yield* Ref.update(cancellationRegistry, HashMap.remove(idempotencyKey));
            return Stream.make(
              yield* makeEvent(runId, "extraction_failed", 0, {
                errorType: "extraction_error",
                errorMessage: extractionError.message,
                isRecoverable: false,
              })
            );
          });
        })
      )
  );

  const getCachedResult = Effect.fn("ExtractionEntityHandler.getCachedResult")(
    function* (envelope: ClusterEntity.Request<typeof GetCachedResultRpc>) {
      const key = IdempotencyKey.make(envelope.payload.idempotencyKey);
      const run = yield* runService.getByKey(key);
      if (P.isNull(run) || !P.isTagged(run.status, "Complete")) return O.none<KnowledgeGraphResult>();
      const durationMs = O.match(run.stats, {
        onNone: thunk0,
        onSome: (stats) => Duration.toMillis(stats.duration),
      });
      return O.some({
        entities: [],
        relations: [],
        metadata: {
          idempotencyKey: envelope.payload.idempotencyKey,
          ontologyId: `${run.config.ontology.namespace}/${run.config.ontology.name}`,
          ontologyVersion: O.getOrElse(run.ontologyVersion, () => ""),
          extractedAt: DateTime.formatIso(run.status.completedAt),
          durationMs,
        },
      });
    },
    (effect) => effect.pipe(Effect.mapError(toExtractionError))
  );

  const cancelExtraction = Effect.fn("ExtractionEntityHandler.cancelExtraction")(
    function* (envelope: ClusterEntity.Request<typeof CancelExtractionRpc>) {
      const key = IdempotencyKey.make(envelope.payload.idempotencyKey);
      const run = yield* runService.getByKey(key);
      if (P.isNull(run)) return yield* ExtractionError.make({ message: "Extraction not found" });
      if (P.isTagged(run.status, "Complete") || P.isTagged(run.status, "Failed")) return false;

      const signal = HashMap.get(yield* Ref.get(cancellationRegistry), key);
      if (O.isSome(signal)) {
        yield* Deferred.succeed(signal.value, void 0);
        yield* Ref.update(cancellationRegistry, HashMap.remove(key));
      }
      yield* runService.failRun(
        run.id,
        "cancelled",
        O.getOrElse(envelope.payload.reason, () => "User cancelled")
      );
      return true;
    },
    (effect) => effect.pipe(Effect.mapError(toExtractionError))
  );

  const getExtractionStatus = Effect.fn("ExtractionEntityHandler.getExtractionStatus")(
    function* (envelope: ClusterEntity.Request<typeof GetExtractionStatusRpc>) {
      const run = yield* runService.getByKey(IdempotencyKey.make(envelope.payload.idempotencyKey));
      if (P.isNull(run)) {
        return ExtractionStatus.cases.pending.make({
          progress: O.some(Percentage.make(0)),
          startedAt: O.none<string>(),
          completedAt: O.none<string>(),
          error: O.none<string>(),
        });
      }
      const completedAt = P.isTagged(run.status, "Complete")
        ? O.some(DateTime.formatIso(run.status.completedAt))
        : O.none();
      const error = P.isTagged(run.status, "Failed") ? O.some(run.status.error.message) : O.none();
      const fields = {
        progress: O.some(
          Percentage.make(P.isTagged(run.status, "Complete") ? 100 : P.isTagged(run.status, "Running") ? 50 : 0)
        ),
        startedAt: O.some(DateTime.formatIso(run.createdAt)),
        completedAt,
        error,
      };
      return RunStatus.match(run.status, {
        Pending: (): ExtractionStatus => ExtractionStatus.cases.pending.make(fields),
        Running: (): ExtractionStatus => ExtractionStatus.cases.running.make(fields),
        Complete: (): ExtractionStatus => ExtractionStatus.cases.complete.make(fields),
        Failed: (): ExtractionStatus => ExtractionStatus.cases.failed.make(fields),
      });
    },
    (effect) => effect.pipe(Effect.mapError(toExtractionError))
  );

  return {
    ExtractFromText: (envelope: ClusterEntity.Request<typeof ExtractFromTextRpc>) =>
      Stream.unwrap(extractFromText(envelope)),
    GetCachedResult: getCachedResult,
    CancelExtraction: cancelExtraction,
    GetExtractionStatus: getExtractionStatus,
  };
});

/**
 * Provides the Effect layer for extraction entity handler layer dependencies.
 *
 * **Example** (Inspect extraction entity handler layer)
 *
 * ```ts
 * import { ExtractionEntityHandlerLayer } from "@effect-ontology/Cluster/ExtractionEntityHandler"
 *
 * console.log(ExtractionEntityHandlerLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExtractionEntityHandlerLayer = KnowledgeGraphExtractor.toLayer(
  makeExtractionEntityHandler.pipe(Effect.orDie)
);
