/**
 * Job Push Handler
 *
 * HTTP endpoint for Cloud Pub/Sub push subscriptions to process background jobs.
 * This handler receives Pub/Sub push messages and dispatches them to the appropriate job processor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Data, Effect, Match, Schema } from "effect";
import * as DateTime from "effect/DateTime";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type { BackgroundJob } from "../Domain/Schema/JobSchema.ts";
import { BackgroundJobSchema } from "../Domain/Schema/JobSchema.ts";

// =============================================================================
// Pub/Sub Push Message Schema
// =============================================================================

/**
 * Pub/Sub push message envelope
 *
 * @since 0.0.0
 */
const PubSubPushMessage = Schema.Struct({
  message: Schema.Struct({
    data: Schema.String, // Base64 encoded
    messageId: Schema.String,
    publishTime: Schema.String,
    attributes: Schema.Record(Schema.String, Schema.String).pipe(SchemaUtils.withKeyDefaults({})),
  }),
  subscription: Schema.String,
});

type PubSubPushMessage = typeof PubSubPushMessage.Type;

class JobProcessorNotImplementedError extends Data.TaggedError("JobProcessorNotImplementedError")<{
  readonly jobType: BackgroundJob["_tag"];
}> {}

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
        return yield* new JobProcessorNotImplementedError({ jobType: j._tag });
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
        return yield* new JobProcessorNotImplementedError({ jobType: j._tag });
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
        return yield* new JobProcessorNotImplementedError({ jobType: j._tag });
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
        return yield* new JobProcessorNotImplementedError({ jobType: j._tag });
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
        return yield* new JobProcessorNotImplementedError({ jobType: j._tag });
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
 * Provides endpoints for Pub/Sub push subscriptions:
 * - POST /v1/jobs/process - Receive and process pushed jobs
 *
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
            const jobParseResult = yield* Schema.decodeEffect(Schema.fromJsonString(BackgroundJobSchema))(
              jobDataString
            ).pipe(
              Effect.mapError((e) => ({
                _tag: "JobParseError",
                error: e,
              }))
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
              Effect.mapError((e) => ({
                _tag: "ProcessingError",
                error: e,
              }))
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
                error: String(e.error),
              });
              // Return 400 to not retry on job schema errors
              return yield* HttpServerResponse.json(
                {
                  processed: false,
                  messageId: "unknown",
                  error: `Job parse error: ${String(e.error)}`,
                },
                { status: 400 }
              );
            }),
            ProcessingError: Effect.fn(function* (e) {
              yield* Effect.logError("Job processing failed", {
                error: String(e.error),
              });
              // Return 500 to trigger retry
              return yield* HttpServerResponse.json(
                {
                  processed: false,
                  messageId: "unknown",
                  error: `Processing error: ${String(e.error)}`,
                },
                { status: 500 }
              );
            }),
          }),
          Effect.catch(
            Effect.fn(function* (e) {
              yield* Effect.logError("Unexpected error in job push handler", {
                error: String(e),
              });
              // Return 500 to trigger retry
              return yield* HttpServerResponse.json(
                {
                  processed: false,
                  messageId: "unknown",
                  error: `Unexpected error: ${String(e)}`,
                },
                { status: 500 }
              );
            })
          )
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
