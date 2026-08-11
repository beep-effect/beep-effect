/**
 * Cloud Pub/Sub Client Service
 *
 * Effect-wrapped Google Cloud Pub/Sub client for event distribution
 * and job queue integration.
 *
 * @since 2.0.0
 * @module Service/PubSubClient
 */

import { $ScratchpadId } from "@beep/identity";
import type { Topic } from "@google-cloud/pubsub";
import { PubSub } from "@google-cloud/pubsub";
import { Config, Context, DateTime, Effect, Layer, Stream } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as EventJournal from "effect/unstable/eventlog/EventJournal";
import { PubSubError } from "../Domain/Error/EventBus.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/PubSubClient");

// =============================================================================
// Types
// =============================================================================

/**
 * Published message result
 *
 * @since 2.0.0
 */
export interface PublishResult {
  readonly messageId: string;
  readonly topicName: string;
}

/**
 * Received message from subscription
 *
 * @since 2.0.0
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
 * @since 2.0.0
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
 * @since 2.0.0
 */
export interface PubSubClientMethods {
  /**
   * Publish a message to a topic
   */
  readonly publish: (
    topicId: string,
    data: unknown,
    attributes?: Record<string, string>
  ) => Effect.Effect<PublishResult, PubSubError>;

  /**
   * Publish an event to the events topic
   */
  readonly publishEvent: (
    eventType: string,
    payload: unknown,
    primaryKey: string
  ) => Effect.Effect<PublishResult, PubSubError>;

  /**
   * Publish a job to the jobs topic
   */
  readonly publishJob: (jobType: string, payload: unknown, jobId: string) => Effect.Effect<PublishResult, PubSubError>;

  /**
   * Publish to dead letter queue
   */
  readonly publishToDeadLetter: (
    originalMessage: unknown,
    error: string,
    attempts: number
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
 * @since 2.0.0
 */
export class PubSubClient extends Context.Service<PubSubClient, PubSubClientMethods>()($I`PubSubClient`) {}

// =============================================================================
// Configuration
// =============================================================================

/**
 * PubSub configuration from environment
 *
 * @since 2.0.0
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
 * Provides durable event distribution via Cloud Pub/Sub.
 * Used for production deployments where events need to be distributed
 * across multiple Cloud Run instances.
 *
 * @since 2.0.0
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
    const topicCache = new Map<string, Topic>();
    const getTopic = (topicId: string): Topic => {
      let topic = topicCache.get(topicId);
      if (P.isUndefined(topic)) {
        topic = pubsub.topic(topicId);
        topicCache.set(topicId, topic);
      }
      return topic;
    };

    const publish: PubSubClientMethods["publish"] = Effect.fn("publish")(function* (topicId, data, attributes) {
      const topic = getTopic(topicId);
      const dataJson = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(data).pipe(
        Effect.mapError((cause) =>
          PubSubError.make({
            method: "publish",
            topic: topicId,
            message: "Failed to encode Pub/Sub message",
            cause: O.some(cause),
          })
        )
      );
      const dataBuffer = Buffer.from(dataJson);
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
            cause: O.some(error as Error),
          }),
      });
      yield* Effect.logDebug("Message published", {
        topicId,
        messageId,
        attributes,
      });
      return {
        messageId,
        topicName: topicId,
      };
    });

    const publishEvent: PubSubClientMethods["publishEvent"] = Effect.fn("publishEvent")(
      function* (eventType, payload, primaryKey) {
        const timestamp = DateTime.formatIso(yield* DateTime.now);
        return yield* publish(config.eventsTopicId, payload, {
          eventType,
          primaryKey,
          timestamp,
        });
      }
    );

    const publishJob: PubSubClientMethods["publishJob"] = Effect.fn("publishJob")(function* (jobType, payload, jobId) {
      const timestamp = DateTime.formatIso(yield* DateTime.now);
      return yield* publish(config.jobsTopicId, payload, {
        jobType,
        jobId,
        timestamp,
      });
    });

    const publishToDeadLetter: PubSubClientMethods["publishToDeadLetter"] = Effect.fn("publishToDeadLetter")(
      function* (originalMessage, error, attempts) {
        const failedAt = DateTime.formatIso(yield* DateTime.now);
        return yield* publish(
          config.dlqTopicId,
          {
            originalMessage,
            error,
            attempts,
            failedAt,
          },
          {
            messageType: "dead_letter",
            attempts: String(attempts),
          }
        );
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
 * This layer subscribes to EventJournal changes and publishes them
 * to Cloud Pub/Sub for distribution across instances.
 *
 * @since 2.0.0
 */
export const EventBusPubSubBridge = Layer.effectDiscard(
  Effect.gen(function* () {
    const journal = yield* EventJournal.EventJournal;
    const pubsubClient = yield* PubSubClient;

    // Subscribe to journal changes and publish to Pub/Sub
    const changes = yield* journal.changes;

    yield* Stream.fromSubscription(changes).pipe(
      Stream.tap((entry: EventJournal.Entry) =>
        pubsubClient.publishEvent(entry.event, entry.payload, entry.primaryKey).pipe(
          Effect.catch((error) =>
            Effect.logError("Failed to publish event to Pub/Sub", {
              event: entry.event,
              primaryKey: entry.primaryKey,
              error: String(error),
            })
          )
        )
      ),
      Stream.runDrain,
      Effect.forkChild
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
 * @since 2.0.0
 */
export const PubSubClientDefault = PubSubClientLive;
