/**
 * Job Push Handler
 *
 * **Details**
 *
 * HTTP endpoint for Cloud Pub/Sub push subscriptions to process background jobs.
 * This handler receives Pub/Sub push messages and dispatches them to the appropriate job processor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { DateTime, Effect, Inspectable, Match } from "effect";
import * as S from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { ErrorMessage } from "../Domain/Error/Base.ts";
import { BackgroundJob } from "../Domain/Schema/JobSchema.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/JobPushHandler");

// =============================================================================
// Pub/Sub Push Message Schema
// =============================================================================

/**
 * Pub/Sub push message envelope
 *
 * @since 0.0.0
 */
const PubSubPushMessage = S.Struct({
  message: S.Struct({
    data: S.String, // Base64 encoded
    messageId: S.String,
    publishTime: S.String,
    attributes: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults({})),
  }),
  subscription: S.String,
});

type PubSubPushMessage = typeof PubSubPushMessage.Type;

const BackgroundJobType = S.Union([
  BackgroundJob.cases.EmbeddingJob.fields._tag,
  BackgroundJob.cases.PromptCacheJob.fields._tag,
  BackgroundJob.cases.SimilarityRecomputeJob.fields._tag,
  BackgroundJob.cases.BlockingTokenJob.fields._tag,
  BackgroundJob.cases.WebhookJob.fields._tag,
]);

class JobProcessorNotImplementedError extends S.TaggedError<JobProcessorNotImplementedError>(
  $I`JobProcessorNotImplementedError`
)(
  "JobProcessorNotImplementedError",
  {
    jobType: BackgroundJobType.annotateKey({
      description: "Background-job variant whose processor has not been implemented.",
    }),
  },
  $I.annote("JobProcessorNotImplementedError", {
    description: "Typed failure raised when a recognized background job has no processor implementation.",
  })
) {}

class JobParseError extends S.TaggedError<JobParseError>($I`JobParseError`)(
  "JobParseError",
  {
    message: ErrorMessage.annotateKey({
      description: "Stable diagnostic for the background-job decoding failure.",
    }),
    cause: S.Defect({ includeStack: true }).annotateKey({
      description: "Schema defect raised while decoding the pushed background job.",
    }),
  },
  $I.annote("JobParseError", {
    description: "Failure raised when a pushed background-job payload does not satisfy its schema.",
  })
) {}

class ProcessingError extends S.TaggedError<ProcessingError>($I`ProcessingError`)(
  "ProcessingError",
  {
    message: ErrorMessage.annotateKey({
      description: "Stable diagnostic for the background-job processing failure.",
    }),
    cause: JobProcessorNotImplementedError.annotateKey({
      description: "Typed processor failure raised for the decoded background job.",
    }),
  },
  $I.annote("ProcessingError", {
    description: "Failure raised after a background job decodes but its processor cannot complete it.",
  })
) {}

// =============================================================================
// Job Processing
// =============================================================================

/**
 * Process a background job based on its type
 *
 * @since 0.0.0
 */
type JobMeta = { readonly id: string; readonly attempts: number };

const processBackgroundJobByType = Match.type<BackgroundJob>().pipe(
  Match.tag("EmbeddingJob", (j) =>
    Effect.fn("processEmbeddingJob")(function* (meta: JobMeta) {
      yield* Effect.logInfo("Processing EmbeddingJob", {
        id: j.id,
        entityId: j.canonicalEntityId,
        reason: j.reason,
        attempts: meta.attempts,
      });
      return yield* JobProcessorNotImplementedError.make({ jobType: j._tag });
    })
  ),
  Match.tag("PromptCacheJob", (j) =>
    Effect.fn("processPromptCacheJob")(function* (meta: JobMeta) {
      yield* Effect.logInfo("Processing PromptCacheJob", {
        id: j.id,
        exampleId: j.exampleId,
        isNegative: j.isNegative,
        attempts: meta.attempts,
      });
      return yield* JobProcessorNotImplementedError.make({ jobType: j._tag });
    })
  ),
  Match.tag("SimilarityRecomputeJob", (j) =>
    Effect.fn("processSimilarityRecomputeJob")(function* (meta: JobMeta) {
      yield* Effect.logInfo("Processing SimilarityRecomputeJob", {
        id: j.id,
        entityId: j.entityId,
        reason: j.reason,
        attempts: meta.attempts,
      });
      return yield* JobProcessorNotImplementedError.make({ jobType: j._tag });
    })
  ),
  Match.tag("BlockingTokenJob", (j) =>
    Effect.fn("processBlockingTokenJob")(function* (meta: JobMeta) {
      yield* Effect.logInfo("Processing BlockingTokenJob", {
        id: j.id,
        entityId: j.entityId,
        attempts: meta.attempts,
      });
      return yield* JobProcessorNotImplementedError.make({ jobType: j._tag });
    })
  ),
  Match.tag("WebhookJob", (j) =>
    Effect.fn("processWebhookJob")(function* (meta: JobMeta) {
      yield* Effect.logInfo("Processing WebhookJob", {
        id: j.id,
        url: j.url,
        eventType: j.eventType,
        attempts: meta.attempts,
      });
      return yield* JobProcessorNotImplementedError.make({ jobType: j._tag });
    })
  ),
  Match.exhaustive
);

const processBackgroundJob = Effect.fn("processBackgroundJob")(function* (job: BackgroundJob, meta: JobMeta) {
  return yield* processBackgroundJobByType(job)(meta);
});

// =============================================================================
// HTTP Router
// =============================================================================

/**
 * Pub/Sub push ingress for background jobs, including a health probe.
 *
 * **Details**
 *
 * Provides endpoints for Pub/Sub push subscriptions:
 * - POST /v1/jobs/process - Receive and process pushed jobs
 * - GET /v1/jobs/health - Handler liveness
 *
 * **Gotchas**
 *
 * Return 400 for job schema / parse failures so Pub/Sub does not retry a
 * permanently invalid payload. Return 500 for processing failures so the
 * subscriber retries.
 *
 * **Example** (Name the health probe)
 *
 * ```ts
 * import { JobPushRouter } from "@effect-ontology/Runtime/JobPushHandler"
 *
 * const documented = [JobPushRouter, "GET /v1/jobs/health"] as const
 * console.log(documented[1]) // "GET /v1/jobs/health"
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
export const JobPushRouter = HttpRouter.addAll([
  HttpRouter.route(
    "POST",
    "/v1/jobs/process",
    HttpServerRequest.schemaBodyJson(PubSubPushMessage).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          HttpServerResponse.json(
            {
              processed: false,
              messageId: "unknown",
              error: `Parse error: ${Inspectable.toStringUnknown(error)}`,
            },
            { status: 400 }
          ),
        onSuccess: Effect.fn("JobPushHandler.onSuccess")(
          function* (body) {
            const messageId = body.message.messageId;

            yield* Effect.logInfo("Received Pub/Sub push message", {
              messageId,
              subscription: body.subscription,
              attributes: body.message.attributes,
            });

            // Decode the base64 job payload
            const jobDataBuffer = Buffer.from(body.message.data, "base64");
            const jobDataString = jobDataBuffer.toString("utf-8");

            // Parse the job schema
            const jobParseResult = yield* BackgroundJob.decodeEffectFromJsonString(jobDataString).pipe(
              Effect.mapError((cause) =>
                JobParseError.make({
                  message: "Failed to decode the pushed background-job payload.",
                  cause,
                })
              )
            );

            const jobType = jobParseResult._tag;
            const jobId = jobParseResult.id;
            const attempts = Number(body.message.attributes.attempts ?? "1");

            yield* Effect.logInfo("Processing job from push", {
              messageId,
              jobType,
              jobId,
              attempts,
            });

            // Process the job
            return yield* processBackgroundJob(jobParseResult, {
              id: jobId,
              attempts,
            }).pipe(
              Effect.mapError((cause) =>
                ProcessingError.make({
                  message: `No processor is implemented for ${cause.jobType}.`,
                  cause,
                })
              )
            );
          },
          Effect.catchTags({
            JobParseError: Effect.fnUntraced(function* (e) {
              yield* Effect.logError("Failed to parse job payload", {
                error: Inspectable.toStringUnknown(e.cause, 0),
              });
              // Return 400 to not retry on job schema errors
              return yield* HttpServerResponse.json(
                {
                  processed: false,
                  messageId: "unknown",
                  error: `Job parse error: ${e.message}`,
                },
                { status: 400 }
              );
            }),
            ProcessingError: Effect.fnUntraced(function* (e) {
              yield* Effect.logError("Job processing failed", {
                error: Inspectable.toStringUnknown(e.cause, 0),
              });
              // Return 500 to trigger retry
              return yield* HttpServerResponse.json(
                {
                  processed: false,
                  messageId: "unknown",
                  error: `Processing error: ${e.message}`,
                },
                { status: 500 }
              );
            }),
          })
        ),
      })
    )
  ),
  HttpRouter.route(
    "GET",
    "/v1/jobs/health",
    Effect.gen(function* () {
      return yield* HttpServerResponse.json({
        status: "healthy",
        service: "job-push-handler",
        timestamp: DateTime.toDateUtc(yield* DateTime.now).toISOString(),
      });
    })
  ),
]);

export default JobPushRouter;
