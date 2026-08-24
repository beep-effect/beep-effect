/**
 * Cloud Pub/Sub Client Service
 *
 * **Details**
 *
 * Effect-wrapped Google Cloud Pub/Sub client for event distribution
 * and job queue integration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import type { Topic } from "@google-cloud/pubsub";
import { PubSub } from "@google-cloud/pubsub";
import { Config, Context, DateTime, Duration, Effect, Layer, MutableHashMap, Schedule, Stream } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { PubSubError } from "../Domain/Error/EventBus.ts";
import { OntologyEventEntry } from "../Domain/Schema/EventSchema.ts";
import { BackgroundJob } from "../Domain/Schema/JobSchema.ts";
import type { EventEntry } from "./EventBus.ts";
import { EventBusService } from "./EventBus.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/PubSubClient");

const DeadLetterMessage = S.Struct({
  originalMessage: BackgroundJob,
  error: S.String,
  attempts: NonNegativeInt,
  failedAt: S.DateTimeUtcFromString,
});

// =============================================================================
// Types
// =============================================================================

/**
 * Published message result
 *
 *
 * **Example** (Use the PublishResult contract)
 *
 * ```ts
 * import type { PublishResult } from "@effect-ontology/Service/PubSubClient"
 *
 * const acceptsPublishResult = (_value: PublishResult): void => undefined
 *
 * console.log(acceptsPublishResult)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class PublishResult extends S.Class<PublishResult>($I`PublishResult`)(
  {
    messageId: S.NonEmptyString,
    topicName: S.NonEmptyString,
  },
  $I.annote("PublishResult", {
    description: "Cloud Pub/Sub acknowledgement identifying the published message and topic.",
  })
) {}

/**
 * Received message from subscription
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ReceivedMessage {
  readonly id: string;
  readonly data: Uint8Array;
  readonly attributes: Record<string, string>;
  readonly publishTime: Date;
  readonly ack: Effect.Effect<void, PubSubError>;
  readonly nack: Effect.Effect<void, PubSubError>;
}

/**
 * Pub/Sub client configuration
 *
 *
 * **Example** (Use the PubSubClientConfig contract)
 *
 * ```ts
 * import type { PubSubClientConfig } from "@effect-ontology/Service/PubSubClient"
 *
 * const acceptsPubSubClientConfig = (_value: PubSubClientConfig): void => undefined
 *
 * console.log(acceptsPubSubClientConfig)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface PubSubClientConfig {
  readonly projectId: string;
  readonly eventsTopicId: string;
  readonly jobsTopicId: string;
  readonly jobsSubscriptionId: string;
  readonly dlqTopicId: string;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * PubSubClient service interface
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface PubSubClientMethods {
  /**
   * Publish a message to a topic
   */
  readonly publish: (
    topicId: string,
    encodedData: string,
    attributes?: Record<string, string>
  ) => Effect.Effect<PublishResult, PubSubError>;

  /**
   * Publish an event to the events topic
   */
  readonly publishEvent: (event: EventEntry) => Effect.Effect<PublishResult, PubSubError>;

  /**
   * Publish a job to the jobs topic
   */
  readonly publishJob: (job: BackgroundJob) => Effect.Effect<PublishResult, PubSubError>;

  /**
   * Publish to dead letter queue
   */
  readonly publishToDeadLetter: (
    originalMessage: BackgroundJob,
    error: string,
    attempts: NonNegativeInt
  ) => Effect.Effect<PublishResult, PubSubError>;

  /**
   * Acknowledge a message
   */
  readonly acknowledge: (subscriptionId: string, ackId: string) => Effect.Effect<void, PubSubError>;

  /**
   * Get configuration
   */
  readonly config: PubSubClientConfig;
}

/**
 * PubSubClient context tag
 *
 * **Example** (Inspect pub sub client)
 *
 * ```ts
 * import { PubSubClient } from "@effect-ontology/Service/PubSubClient"
 *
 * console.log(PubSubClient)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PubSubClient extends Context.Service<PubSubClient, PubSubClientMethods>()($I`PubSubClient`) {}

// =============================================================================
// Configuration
// =============================================================================

/**
 * PubSub configuration from environment
 *
 * **Example** (Inspect pub sub client config)
 *
 * ```ts
 * import { PubSubClientConfig } from "@effect-ontology/Service/PubSubClient"
 *
 * console.log(PubSubClientConfig)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const PubSubClientConfig = Config.all({
  projectId: Config.string("PUBSUB_PROJECT_ID").pipe(Config.withDefault("effect-ontology")),
  eventsTopicId: Config.string("PUBSUB_EVENTS_TOPIC").pipe(Config.withDefault("ontology-events")),
  jobsTopicId: Config.string("PUBSUB_JOBS_TOPIC").pipe(Config.withDefault("ontology-jobs")),
  jobsSubscriptionId: Config.string("PUBSUB_JOBS_SUBSCRIPTION").pipe(Config.withDefault("ontology-jobs-push")),
  dlqTopicId: Config.string("PUBSUB_DLQ_TOPIC").pipe(Config.withDefault("ontology-jobs-dlq")),
});

// =============================================================================
// Implementation
// =============================================================================

/**
 * PubSubClient layer with Google Cloud Pub/Sub integration
 *
 * **Details**
 *
 * Provides durable event distribution via Cloud Pub/Sub.
 * Used for production deployments where events need to be distributed
 * across multiple Cloud Run instances.
 *
 * **Example** (Inspect pub sub client live)
 *
 * ```ts
 * import { PubSubClientLive } from "@effect-ontology/Service/PubSubClient"
 *
 * console.log(PubSubClientLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PubSubClientLive = Layer.effect(
  PubSubClient,
  Effect.gen(function* () {
    const config = yield* PubSubClientConfig;

    // Initialize the Pub/Sub client
    const pubsub = new PubSub({
      projectId: config.projectId,
    });

    yield* Effect.logInfo("PubSubClient initialized", {
      projectId: config.projectId,
      eventsTopicId: config.eventsTopicId,
      jobsTopicId: config.jobsTopicId,
    });

    // Cache topic references
    const topicCache = MutableHashMap.empty<string, Topic>();
    const getTopic = (topicId: string): Topic =>
      O.getOrElse(MutableHashMap.get(topicCache, topicId), () => {
        const topic = pubsub.topic(topicId);
        MutableHashMap.set(topicCache, topicId, topic);
        return topic;
      });

    const publish: PubSubClientMethods["publish"] = Effect.fn("publish")(function* (topicId, encodedData, attributes) {
      const topic = getTopic(topicId);
      const dataBuffer = Buffer.from(encodedData);
      const messageId = yield* Effect.tryPromise({
        try: () =>
          topic.publishMessage({
            data: dataBuffer,
            attributes: attributes ?? {},
          }),
        catch: (error) =>
          PubSubError.make({
            method: "publish",
            topic: topicId,
            message: `Failed to publish message: ${error}`,
            cause: O.some(error),
          }),
      });
      yield* Effect.logDebug("Message published", {
        topicId,
        messageId,
        attributes,
      });
      return PublishResult.make({
        messageId,
        topicName: topicId,
      });
    });

    const publishEvent: PubSubClientMethods["publishEvent"] = Effect.fn("publishEvent")(function* (event) {
      const timestamp = DateTime.formatIso(yield* DateTime.now);
      const encoded = yield* S.encodeEffect(S.fromJsonString(OntologyEventEntry))(event).pipe(
        Effect.mapError((cause) =>
          PubSubError.make({
            method: "publishEvent",
            topic: config.eventsTopicId,
            message: "Failed to encode the canonical ontology event.",
            cause: O.some(cause),
          })
        )
      );
      return yield* publish(config.eventsTopicId, encoded, {
        eventType: event.event,
        primaryKey: event.primaryKey,
        ontologyId: event.payload.ontologyId,
        timestamp,
      });
    });

    const publishJob: PubSubClientMethods["publishJob"] = Effect.fn("publishJob")(function* (job) {
      const timestamp = DateTime.formatIso(yield* DateTime.now);
      const encoded = yield* S.encodeEffect(S.fromJsonString(BackgroundJob))(job).pipe(
        Effect.mapError((cause) =>
          PubSubError.make({
            method: "publishJob",
            topic: config.jobsTopicId,
            message: "Failed to encode the canonical background job.",
            cause: O.some(cause),
          })
        )
      );
      return yield* publish(config.jobsTopicId, encoded, {
        jobType: job._tag,
        jobId: job.id,
        timestamp,
      });
    });

    const publishToDeadLetter: PubSubClientMethods["publishToDeadLetter"] = Effect.fn("publishToDeadLetter")(
      function* (originalMessage, error, attempts) {
        const failedAt = DateTime.formatIso(yield* DateTime.now);
        const encoded = yield* S.encodeUnknownEffect(S.fromJsonString(DeadLetterMessage))({
          originalMessage,
          error,
          attempts,
          failedAt,
        }).pipe(
          Effect.mapError((cause) =>
            PubSubError.make({
              method: "publishToDeadLetter",
              topic: config.dlqTopicId,
              message: "Failed to encode the dead-letter message.",
              cause: O.some(cause),
            })
          )
        );
        return yield* publish(config.dlqTopicId, encoded, {
          messageType: "dead_letter",
          attempts: String(attempts),
        });
      }
    );

    const acknowledge: PubSubClientMethods["acknowledge"] = Effect.fn("acknowledge")(function* (subscriptionId, ackId) {
      yield* Effect.sync(() => {
        const subscription = pubsub.subscription(subscriptionId);
        // Use modifyAckDeadline with 0 to nack, or just ignore
        // Push subscriptions handle ack via HTTP response
        // For pull subscriptions, would use subscription.ackWithResponse
        void subscription;
        void ackId;
      });
    });

    // Cleanup on scope finalization
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* Effect.logInfo("PubSubClient shutting down");
        yield* Effect.tryPromise({
          try: () => pubsub.close(),
          catch: () => undefined,
        }).pipe(Effect.ignore);
      })
    );

    return {
      publish,
      publishEvent,
      publishJob,
      publishToDeadLetter,
      acknowledge,
      config,
    } satisfies PubSubClientMethods;
  })
);

// =============================================================================
// EventBus PubSub Bridge
// =============================================================================

/**
 * Bridge EventJournal changes to Cloud Pub/Sub
 *
 * **Details**
 *
 * This layer subscribes to EventJournal changes and publishes them
 * to Cloud Pub/Sub for distribution across instances.
 *
 * **Example** (Inspect event bus pub sub bridge)
 *
 * ```ts
 * import { EventBusPubSubBridge } from "@effect-ontology/Service/PubSubClient"
 *
 * console.log(EventBusPubSubBridge)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBusPubSubBridge = Layer.effectDiscard(
  Effect.gen(function* () {
    const eventBus = yield* EventBusService;
    const pubsubClient = yield* PubSubClient;

    const events = yield* eventBus.subscribeEvents;

    yield* events.pipe(
      Stream.runForEach((entry) => pubsubClient.publishEvent(entry)),
      Effect.tapError((error) => Effect.logError("EventBus Pub/Sub bridge failed; retrying", { error })),
      Effect.retry(Schedule.exponential(Duration.millis(100))),
      Effect.forkScoped
    );

    yield* Effect.logInfo("EventBus Pub/Sub bridge started");
  })
);

// =============================================================================
// Default Layer
// =============================================================================

/**
 * Default PubSubClient layer
 *
 * **Example** (Inspect pub sub client default)
 *
 * ```ts
 * import { PubSubClientDefault } from "@effect-ontology/Service/PubSubClient"
 *
 * console.log(PubSubClientDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PubSubClientDefault = PubSubClientLive;
