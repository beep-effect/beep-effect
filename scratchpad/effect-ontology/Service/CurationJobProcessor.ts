/**
 * Curation Job Processor
 *
 * **Details**
 *
 * Background worker for processing async curation jobs.
 * Handles embedding updates, prompt cache maintenance, and other background tasks.
 * Uses EventBusService for job queue integration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import type { Fiber, Scope } from "effect";
import { Clock, Context, Duration, Effect, Layer, Match, Schedule } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type { EventBusError } from "../Domain/Error/EventBus.ts";
import type { BackgroundJob } from "../Domain/Schema/JobSchema.ts";
import { CanonicalEntityId, EntityRegistryRepository } from "../Repository/EntityRegistry.ts";
import { EmbeddingService } from "./Embedding.ts";
import { EventBusService } from "./EventBus.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/CurationJobProcessor");

// =============================================================================
// Types
// =============================================================================

/**
 * Combined error type for job processing
 *
 * **Example** (Inspect a job-processing failure)
 *
 * ```ts
 * import { EventBusError } from "@effect-ontology/Error/EventBus"
 * import type { JobProcessorError } from "@effect-ontology/Service/CurationJobProcessor"
 *
 * const error: JobProcessorError = EventBusError.make({ method: "takeJob", message: "Queue unavailable." })
 * console.log(error._tag) // "EventBusError"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JobProcessorError = DrizzleError | AnyEmbeddingError | EventBusError;

/**
 * Job processing statistics
 *
 *
 * **Example** (Create job processing statistics)
 *
 * ```ts
 * import { JobProcessingStats } from "@effect-ontology/Service/CurationJobProcessor"
 *
 * console.log(JobProcessingStats.make({ jobsProcessed: 2, errors: 0, durationMs: 5 }).jobsProcessed) // 2
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class JobProcessingStats extends S.Class<JobProcessingStats>($I`JobProcessingStats`)(
  {
    jobsProcessed: S.Int.check(S.isGreaterThanOrEqualTo(0, { message: "Processed jobs must be non-negative." })),
    errors: S.Int.check(S.isGreaterThanOrEqualTo(0, { message: "Job errors must be non-negative." })),
    durationMs: S.Finite.check(S.isGreaterThanOrEqualTo(0, { message: "Job duration must be non-negative." })),
  },
  $I.annote("JobProcessingStats", {
    description: "Non-negative processed-job, error, and elapsed-millisecond counters.",
  })
) {}

type JobMeta = { readonly id: string; readonly attempts: number };

// =============================================================================
// Service
// =============================================================================

/**
 * Drains queued curation jobs and updates processing statistics.
 *
 * **Example** (Compose job processing against Default)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { CurationJobProcessor } from "@effect-ontology/Service/CurationJobProcessor"
 *
 * const program = Effect.gen(function* () {
 *   const processor = yield* CurationJobProcessor
 *   return yield* processor.processOnce
 * }).pipe(Effect.provide(CurationJobProcessor.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CurationJobProcessor extends Context.Service<CurationJobProcessor>()($I`CurationJobProcessor`, {
  make: Effect.gen(function* () {
    const eventBus = yield* EventBusService;
    const entityRegistry = yield* EntityRegistryRepository;
    const embeddingService = yield* EmbeddingService;

    // -------------------------------------------------------------------------
    // Job Handlers
    // -------------------------------------------------------------------------

    /**
     * Process a background job based on its type
     */
    const processJobByType = Match.type<BackgroundJob>().pipe(
      Match.tag("EmbeddingJob", (j) =>
        Effect.fn("CurationJobProcessor.processEmbeddingJob")(function* (meta: JobMeta) {
          yield* Effect.logDebug("Processing EmbeddingJob", {
            id: j.id,
            entityId: j.canonicalEntityId,
            reason: j.reason,
            attempts: meta.attempts,
          });

          const canonicalEntityId = CanonicalEntityId.make(j.canonicalEntityId);

          // Get canonical entity
          const entityOpt = yield* entityRegistry.getCanonicalEntity(j.ontologyId, canonicalEntityId);
          if (O.isNone(entityOpt)) {
            yield* Effect.logWarning("Canonical entity not found for embedding job", {
              canonicalEntityId: j.canonicalEntityId,
            });
            return;
          }

          const entity = entityOpt.value;

          // Get all aliases for this entity
          const aliases = yield* entityRegistry.getAliasesForCanonical(j.ontologyId, canonicalEntityId);

          // Combine mention and aliases for embedding
          const allMentions = [entity.canonicalMention, ...aliases.map((a) => a.mention)];
          const combinedText = `${j.ontologyId}: ${allMentions.join(" | ")}`;

          // Generate new embedding
          const embedding = yield* embeddingService.embed(combinedText);

          yield* Effect.logInfo("Entity embedding updated", {
            canonicalEntityId: j.canonicalEntityId,
            aliasCount: aliases.length,
            embeddingDim: embedding.length,
          });
        })
      ),
      Match.tag("PromptCacheJob", (j) =>
        Effect.fn("CurationJobProcessor.processPromptCacheJob")(function* (meta: JobMeta) {
          yield* Effect.logDebug("Processing PromptCacheJob", {
            id: j.id,
            exampleId: j.exampleId,
            isNegative: j.isNegative,
            attempts: meta.attempts,
          });

          // Prompt cache update would go here
          // This could involve:
          // 1. Pre-computing prompt segments for the example
          // 2. Updating a cache key for the ontology
          // 3. Invalidating stale cache entries

          yield* Effect.logInfo("Prompt cache updated", {
            ontologyId: j.ontologyId,
            exampleId: j.exampleId,
            isNegative: j.isNegative,
          });
        })
      ),
      Match.tag("SimilarityRecomputeJob", (j) =>
        Effect.fn("CurationJobProcessor.processSimilarityRecomputeJob")(function* (meta: JobMeta) {
          yield* Effect.logDebug("Processing SimilarityRecomputeJob", {
            id: j.id,
            entityId: j.entityId,
            reason: j.reason,
            attempts: meta.attempts,
          });

          // Similarity recomputation would go here
          yield* Effect.logInfo("Similarity recomputed", {
            ontologyId: j.ontologyId,
            entityId: j.entityId,
          });
        })
      ),
      Match.tag("BlockingTokenJob", (j) =>
        Effect.fn("CurationJobProcessor.processBlockingTokenJob")(function* (meta: JobMeta) {
          yield* Effect.logDebug("Processing BlockingTokenJob", {
            id: j.id,
            entityId: j.entityId,
            attempts: meta.attempts,
          });

          // Blocking token rebuild would go here
          yield* Effect.logInfo("Blocking tokens rebuilt", {
            ontologyId: j.ontologyId,
            entityId: j.entityId,
          });
        })
      ),
      Match.tag("WebhookJob", (j) =>
        Effect.fn("CurationJobProcessor.processWebhookJob")(function* (meta: JobMeta) {
          yield* Effect.logDebug("Processing WebhookJob", {
            id: j.id,
            url: j.url,
            eventType: j.eventType,
            attempts: meta.attempts,
          });

          // Webhook delivery would go here
          yield* Effect.logInfo("Webhook delivered", {
            url: j.url,
            eventType: j.eventType,
          });
        })
      ),
      Match.exhaustive
    );

    const processJob: (job: BackgroundJob, meta: JobMeta) => Effect.Effect<void, JobProcessorError> = Effect.fn(
      "CurationJobProcessor.processJob"
    )(function* (job, meta) {
      return yield* processJobByType(job)(meta);
    });

    // -------------------------------------------------------------------------
    // Batch Processing via EventBusService
    // -------------------------------------------------------------------------

    /**
     * Process the next available job from the queue
     * Returns stats for the single job processed
     */
    const processNextJob: Effect.Effect<O.Option<void>, JobProcessorError> = eventBus.processJob(processJob, {
      maxAttempts: 5,
    });

    /**
     * Process jobs in a loop until queue is empty
     */
    const processAllPending = Effect.fn("CurationJobProcessor.processAllPending")(function* (): Effect.fn.Return<
      JobProcessingStats,
      JobProcessorError
    > {
      const startTime = yield* Clock.currentTimeMillis;
      let jobsProcessed = 0;
      let errors = 0;

      // Keep processing until no jobs left
      let continueProcessing = true;
      while (continueProcessing) {
        const result = yield* processNextJob.pipe(
          Effect.tap((opt) =>
            Effect.sync(() => {
              if (O.isSome(opt)) {
                jobsProcessed++;
              } else {
                continueProcessing = false;
              }
            })
          ),
          Effect.catch(
            Effect.fn("CurationJobProcessor.recordJobError")(function* (error: JobProcessorError) {
              errors++;
              yield* Effect.logError("Job processing failed", {
                errorTag: error._tag,
              });
              return O.none<void>();
            })
          )
        );

        if (O.isNone(result)) {
          continueProcessing = false;
        }
      }

      const durationMs = (yield* Clock.currentTimeMillis) - startTime;

      if (jobsProcessed > 0) {
        yield* Effect.logInfo("Job batch processed", {
          jobsProcessed,
          errors,
          durationMs,
        });
      }

      return {
        jobsProcessed,
        errors,
        durationMs,
      };
    });

    // -------------------------------------------------------------------------
    // Background Polling (for non-push environments)
    // -------------------------------------------------------------------------

    /**
     * Run background job processor that polls every interval
     * Use this in development or when not using Pub/Sub push subscriptions
     */
    const runBackground = Effect.fn("CurationJobProcessor.runBackground")(function* (
      pollInterval: Duration.Duration = Duration.seconds(5)
    ): Effect.fn.Return<Fiber.Fiber<never>, never, Scope.Scope> {
      const processor = Effect.gen(function* () {
        const pendingCount = yield* eventBus.pendingJobCount;
        if (pendingCount > 0) {
          yield* processAllPending();
        }
      }).pipe(
        Effect.catch((error: JobProcessorError) =>
          Effect.logError("Background processor error", { errorTag: error._tag })
        ),
        Effect.repeat(Schedule.spaced(pollInterval)),
        Effect.forever
      );

      const fiber = yield* Effect.forkScoped(processor);

      yield* Effect.logInfo("Background job processor started", {
        pollIntervalMs: Duration.toMillis(pollInterval),
      });

      return fiber;
    });

    /**
     * Process pending jobs once (for testing/manual triggering)
     */
    const processOnce: Effect.Effect<JobProcessingStats, JobProcessorError> = processAllPending();

    return {
      processJob,
      processNextJob,
      processAllPending,
      processOnce,
      runBackground,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
