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
import { DateTime, Effect, Match } from "effect";
import * as S from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { ErrorMessage } from "../Domain/Error/Base.ts";
import type { BackgroundJob } from "../Domain/Schema/JobSchema.ts";
import { BackgroundJobSchema } from "../Domain/Schema/JobSchema.ts";

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
  BackgroundJobSchema.cases.EmbeddingJob.fields._tag,
  BackgroundJobSchema.cases.PromptCacheJob.fields._tag,
  BackgroundJobSchema.cases.SimilarityRecomputeJob.fields._tag,
  BackgroundJobSchema.cases.BlockingTokenJob.fields._tag,
  BackgroundJobSchema.cases.WebhookJob.fields._tag,
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
const processBackgroundJob = (
  job: BackgroundJob,
  meta: { id: string; attempts: number }
): Effect.Effect<void, JobProcessorNotImplementedError> =>
  Match.value(job).pipe(
    Match.tag(
      "EmbeddingJob",
      Effect.fn(function* (j) {
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
      Effect.gen(function* () {
        yield* Effect.logInfo("Processing PromptCacheJob", {
          id: j.id,
          exampleId: j.exampleId,
          isNegative: j.isNegative,
          attempts: meta.attempts,
        });
        return yield* JobProcessorNotImplementedError.make({ jobType: j._tag });
      })
    ),
    Match.tag(
      "SimilarityRecomputeJob",
      Effect.fn(function* (j) {
        yield* Effect.logInfo("Processing SimilarityRecomputeJob", {
          id: j.id,
          entityId: j.entityId,
          reason: j.reason,
          attempts: meta.attempts,
        });
        return yield* JobProcessorNotImplementedError.make({ jobType: j._tag });
      })
    ),
    Match.tag(
      "BlockingTokenJob",
      Effect.fn(function* (j) {
        yield* Effect.logInfo("Processing BlockingTokenJob", {
          id: j.id,
          entityId: j.entityId,
          attempts: meta.attempts,
        });
        return yield* JobProcessorNotImplementedError.make({ jobType: j._tag });
      })
    ),
    Match.tag(
      "WebhookJob",
      Effect.fn(function* (j) {
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

// =============================================================================
// HTTP Router
// =============================================================================

/**
 * Job Push Handler Router
 *
 * **Details**
 *
 * Provides endpoints for Pub/Sub push subscriptions:
 * - POST /v1/jobs/process - Receive and process pushed jobs
 *
 * **Example** (Inspect job push router)
 *
 * ```ts
 * import { JobPushRouter } from "@effect-ontology/Runtime/JobPushHandler"
 *
 * console.log(JobPushRouter)
 * ```
 *
 * @category schemas
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
              error: `Parse error: ${String(error)}`,
            },
            { status: 400 }
          ),
        onSuccess: Effect.fn(
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
            const jobParseResult = yield* S.decodeEffect(S.fromJsonString(BackgroundJobSchema))(jobDataString).pipe(
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
            yield* processBackgroundJob(jobParseResult, {
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

            yield* Effect.logInfo("Job processed successfully", {
              messageId,
              jobType,
              jobId,
            });

            // Return 200 to acknowledge the message
            // (Pub/Sub will retry on non-2xx responses)
            return yield* HttpServerResponse.json({
              processed: true,
              messageId,
              jobType,
            });
          },
          Effect.catchTags({
            JobParseError: Effect.fn(function* (e) {
              yield* Effect.logError("Failed to parse job payload", {
                error: String(e.cause),
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
            ProcessingError: Effect.fn(function* (e) {
              yield* Effect.logError("Job processing failed", {
                error: String(e.cause),
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

/**
 * Export the router
 */
export default JobPushRouter;
