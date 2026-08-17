/**
 * Event Bus Service
 *
 * **Details**
 *
 * Unified interface for event publishing and job queuing.
 * Supports multiple backends: Memory (dev/test), Postgres (durable), PubSub (production).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
import { Clock, Context, DateTime, Duration, Effect, Inspectable, Layer, Queue, Ref, Stream } from "effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type * as Event from "effect/unstable/eventlog/Event";
import type * as EventGroup from "effect/unstable/eventlog/EventGroup";
import * as EventJournal from "effect/unstable/eventlog/EventJournal";
import * as SqlEventJournal from "effect/unstable/eventlog/SqlEventJournal";
import * as PersistedQueue from "effect/unstable/persistence/PersistedQueue";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { EventBusError } from "../Domain/Error/EventBus.ts";
import type { OntologyEventEntry as OntologyEventEntryValue } from "../Domain/Schema/EventSchema.ts";
import { CurationEventGroup, ExtractionEventGroup, OntologyEventEntry } from "../Domain/Schema/EventSchema.ts";
import { BackgroundJob } from "../Domain/Schema/JobSchema.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EventBus");

// =============================================================================
// Types
// =============================================================================

/**
 * Job with metadata for processing
 *
 *
 * **Example** (Use the JobWithMetadata contract)
 *
 * ```ts
 * import type { JobWithMetadata } from "@effect-ontology/Service/EventBus"
 *
 * const acceptsJobWithMetadata = (_value: JobWithMetadata): void => undefined
 *
 * console.log(acceptsJobWithMetadata)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface JobWithMetadata {
  readonly job: BackgroundJob;
  readonly id: string;
  readonly attempts: number;
}

/**
 * Runtime schema for a canonical event entry from the journal.
 *
 *
 * **Example** (Inspect the event entry schema)
 *
 * ```ts
 * import { EventEntry } from "@effect-ontology/Service/EventBus"
 * console.log(EventEntry)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EventEntry: S.Codec<EventEntry, unknown> = S.toType(OntologyEventEntry);

/**
 * Runtime event entry paired with its canonical EventGroup payload.
 *
 * **Example** (Use the EventEntry contract)
 * ```ts
 * import type { EventEntry } from "@effect-ontology/Service/EventBus"
 * const eventName = (entry: EventEntry) => entry.event
 * console.log(eventName)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventEntry = OntologyEventEntryValue;

// =============================================================================
// Service Interface
// =============================================================================

/**
 * EventBusService interface for event publishing and job queuing
 *
 *
 * **Example** (Use the EventBusServiceMethods contract)
 *
 * ```ts
 * import type { EventBusServiceMethods } from "@effect-ontology/Service/EventBus"
 *
 * const acceptsEventBusServiceMethods = (_value: EventBusServiceMethods): void => undefined
 *
 * console.log(acceptsEventBusServiceMethods)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EventBusServiceMethods {
  /**
   * Publish a curation event
   */
  readonly publishCurationEvent: <Tag extends EventGroup.Events<typeof CurationEventGroup>["tag"]>(
    tag: Tag,
    payload: Event.PayloadWithTag<EventGroup.Events<typeof CurationEventGroup>, Tag>
  ) => Effect.Effect<void, EventBusError>;

  /**
   * Publish an extraction event
   */
  readonly publishExtractionEvent: <Tag extends EventGroup.Events<typeof ExtractionEventGroup>["tag"]>(
    tag: Tag,
    payload: Event.PayloadWithTag<EventGroup.Events<typeof ExtractionEventGroup>, Tag>
  ) => Effect.Effect<void, EventBusError>;

  /**
   * Enqueue a background job
   */
  readonly enqueueJob: (job: BackgroundJob) => Effect.Effect<string, EventBusError>;

  /**
   * Take the next job for processing
   * Returns None if no jobs are available (non-blocking)
   */
  readonly takeJob: Effect.Effect<O.Option<JobWithMetadata>, EventBusError>;

  /**
   * Take and process a job with automatic retry handling
   */
  readonly processJob: <A, E, R>(
    handler: (job: BackgroundJob, meta: { id: string; attempts: number }) => Effect.Effect<A, E, R>,
    options?: { readonly maxAttempts?: number }
  ) => Effect.Effect<O.Option<A>, E | EventBusError, R>;

  /**
   * Subscribe to events as a stream
   */
  readonly subscribeEvents: Effect.Effect<Stream.Stream<EventEntry, EventBusError>, EventBusError>;

  /**
   * Get pending job count
   */
  readonly pendingJobCount: Effect.Effect<number, EventBusError>;

  /**
   * Graceful shutdown
   */
  readonly shutdown: Effect.Effect<void, EventBusError>;
}

/**
 * EventBusService context tag
 *
 * **Example** (Inspect event bus service)
 *
 * ```ts
 * import { EventBusService } from "@effect-ontology/Service/EventBus"
 *
 * console.log(EventBusService)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EventBusService extends Context.Service<EventBusService, EventBusServiceMethods>()($I`EventBusService`) {}

interface PreparedEvent {
  readonly event: string;
  readonly primaryKey: string;
  readonly payload: unknown;
  readonly encodedPayload: Uint8Array<ArrayBuffer>;
}

const prepareEvent = Effect.fn("EventBus.prepareEvent")(function* <
  PayloadSchema extends S.ConstraintCodec<unknown, Uint8Array<ArrayBuffer>, never, never>,
>(event: string, primaryKey: Event.AnyWithProps["primaryKey"], payloadSchema: PayloadSchema, payload: unknown) {
  const encodedPayload = yield* S.encodeUnknownEffect(payloadSchema)(payload).pipe(
    Effect.mapError((cause) =>
      EventBusError.make({
        method: "prepareEvent",
        message: `Failed to encode ${event} through its event schema`,
        cause: O.some(cause),
      })
    )
  );
  const canonicalPayload = yield* S.decodeEffect(payloadSchema)(encodedPayload).pipe(
    Effect.mapError((cause) =>
      EventBusError.make({
        method: "prepareEvent",
        message: `Failed to decode ${event} through its event schema`,
        cause: O.some(cause),
      })
    )
  );
  return {
    event,
    primaryKey: primaryKey(canonicalPayload),
    payload: canonicalPayload,
    encodedPayload,
  } satisfies PreparedEvent;
});

const eventDefinition = Effect.fn("EventBus.eventDefinition")(function* <Definition extends Event.AnyWithProps>(
  events: R.ReadonlyRecord<string, Definition>,
  tag: string,
  category: "curation" | "extraction"
) {
  return yield* R.get(events, tag).pipe(
    O.match({
      onNone: () =>
        Effect.fail(
          EventBusError.make({
            method: "eventDefinition",
            message: `Unknown ${category} event: ${tag}`,
          })
        ),
      onSome: Effect.succeed,
    })
  );
});

const decodeEventPayload = Effect.fn("EventBus.decodeEventPayload")(function* (event: string, payload: Uint8Array) {
  const definition = yield* R.get(CurationEventGroup.events, event).pipe(
    O.orElse(() => R.get(ExtractionEventGroup.events, event)),
    O.match({
      onNone: () =>
        Effect.fail(
          EventBusError.make({
            method: "decodeEventPayload",
            message: `Unknown journal event: ${event}`,
          })
        ),
      onSome: Effect.succeed,
    })
  );
  const decodePayloadMsgPack = pipe(definition.payloadMsgPack, S.decodeEffect);
  return yield* decodePayloadMsgPack(new Uint8Array(payload)).pipe(
    Effect.mapError((cause) =>
      EventBusError.make({
        method: "decodeEventPayload",
        message: `Failed to decode journal event: ${event}`,
        cause: O.some(cause),
      })
    )
  );
});

// =============================================================================
// Memory Implementation
// =============================================================================

/**
 * In-memory EventBusService implementation for development and testing
 *
 * **Details**
 *
 * Uses Effect Queue for jobs and in-memory event storage.
 * Not durable - events and jobs are lost on restart.
 *
 * **Example** (Inspect event bus service memory)
 *
 * ```ts
 * import { EventBusServiceMemory } from "@effect-ontology/Service/EventBus"
 *
 * console.log(EventBusServiceMemory)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBusServiceMemory = Layer.effect(
  EventBusService,
  Effect.gen(function* () {
    const eventSubscribers = yield* Queue.unbounded<EventEntry>();
    const eventIdCounter = yield* Ref.make(0);

    // In-memory job queue with metadata
    const jobQueue = yield* Queue.bounded<JobWithMetadata>(1000);
    const jobIdCounter = yield* Ref.make(0);

    const publishEvent = (prepared: PreparedEvent): Effect.Effect<void, EventBusError> =>
      Effect.gen(function* () {
        const now = yield* DateTime.now;
        const sequence = yield* Ref.getAndUpdate(eventIdCounter, (value) => value + 1);
        const entry = yield* S.decodeEffect(EventEntry)({
          id: `evt_${yield* Clock.currentTimeMillis}_${sequence}`,
          event: prepared.event,
          primaryKey: prepared.primaryKey,
          payload: prepared.payload,
          createdAt: now,
        }).pipe(
          Effect.mapError((cause) =>
            EventBusError.make({
              method: "publishEvent",
              message: `Failed to validate event entry: ${prepared.event}`,
              cause: O.some(cause),
            })
          )
        );

        yield* Queue.offer(eventSubscribers, entry).pipe(
          Effect.mapError((cause) =>
            EventBusError.make({
              method: "publishEvent",
              message: `Failed to publish event: ${prepared.event}`,
              cause: O.some(cause),
            })
          )
        );
        yield* Effect.logDebug("Event published", {
          event: prepared.event,
          primaryKey: prepared.primaryKey,
        });
      });

    const publishCurationEvent: EventBusServiceMethods["publishCurationEvent"] = Effect.fn("publishCurationEvent")(
      function* (tag, payload) {
        const definition = yield* eventDefinition(CurationEventGroup.events, tag, "curation");
        const prepared = yield* prepareEvent(definition.tag, definition.primaryKey, definition.payloadMsgPack, payload);
        yield* publishEvent(prepared);
      }
    );

    const publishExtractionEvent: EventBusServiceMethods["publishExtractionEvent"] = Effect.fn(
      "publishExtractionEvent"
    )(function* (tag, payload) {
      const definition = yield* eventDefinition(ExtractionEventGroup.events, tag, "extraction");
      const prepared = yield* prepareEvent(definition.tag, definition.primaryKey, definition.payloadMsgPack, payload);
      yield* publishEvent(prepared);
    });

    const enqueueJob: EventBusServiceMethods["enqueueJob"] = Effect.fn("enqueueJob")(
      function* (job) {
        const sequence = yield* Ref.updateAndGet(jobIdCounter, (value) => value + 1);
        const id = `job_${sequence}_${yield* Clock.currentTimeMillis}`;
        const jobWithMeta: JobWithMetadata = {
          job,
          id,
          attempts: 0,
        };
        yield* Queue.offer(jobQueue, jobWithMeta);
        yield* Effect.logDebug("Job enqueued", { id, type: job._tag });
        return id;
      },
      Effect.mapError((cause) =>
        EventBusError.make({
          method: "enqueueJob",
          message: "Failed to enqueue job",
          cause,
        })
      )
    );

    const takeJob: EventBusServiceMethods["takeJob"] = Queue.poll(jobQueue).pipe(
      Effect.map((opt) =>
        O.map(opt, (jwm) => ({
          ...jwm,
          attempts: jwm.attempts + 1,
        }))
      ),
      Effect.mapError((cause) =>
        EventBusError.make({
          method: "takeJob",
          message: "Failed to take job",
          cause,
        })
      )
    );

    const processJob: EventBusServiceMethods["processJob"] = Effect.fn("processJob")(function* (handler, options) {
      const jobOpt = yield* takeJob;
      if (O.isNone(jobOpt)) {
        return O.none();
      }
      const { attempts, id, job } = jobOpt.value;
      const maxAttempts = options?.maxAttempts ?? 5;
      const result = yield* handler(job, { id, attempts }).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            if (attempts < maxAttempts) {
              yield* Queue.offer(jobQueue, { job, id, attempts });
              yield* Effect.logWarning("Job failed, retrying", {
                id,
                attempts,
                maxAttempts,
                error: Inspectable.toStringUnknown(error),
              });
            } else {
              yield* Effect.logError("Job failed, max attempts reached", {
                id,
                attempts,
                error: Inspectable.toStringUnknown(error),
              });
            }
            return yield* Effect.fail(error);
          })
        )
      );
      return O.some(result);
    });

    const subscribeEvents: EventBusServiceMethods["subscribeEvents"] = Effect.succeed(
      Stream.fromQueue(eventSubscribers).pipe(
        Stream.mapError((cause) =>
          EventBusError.make({
            method: "subscribeEvents",
            message: "Event stream error",
            cause,
          })
        )
      )
    );

    const pendingJobCount: EventBusServiceMethods["pendingJobCount"] = Queue.size(jobQueue).pipe(
      Effect.mapError((cause) =>
        EventBusError.make({
          method: "pendingJobCount",
          message: "Failed to get pending job count",
          cause,
        })
      )
    );

    const shutdown: EventBusServiceMethods["shutdown"] = Effect.gen(function* () {
      yield* Queue.shutdown(jobQueue);
      yield* Queue.shutdown(eventSubscribers);
      yield* Effect.logInfo("EventBusService shut down");
    }).pipe(
      Effect.mapError((cause) =>
        EventBusError.make({
          method: "shutdown",
          message: "Failed to shutdown",
          cause,
        })
      )
    );

    // Cleanup on scope finalization
    yield* Effect.addFinalizer(() => shutdown.pipe(Effect.ignore));

    return {
      publishCurationEvent,
      publishExtractionEvent,
      enqueueJob,
      takeJob,
      processJob,
      subscribeEvents,
      pendingJobCount,
      shutdown,
    } satisfies EventBusServiceMethods;
  })
);

// =============================================================================
// SQL Implementation (uses @effect/sql)
// =============================================================================

/**
 * Queue name for background jobs
 */
const JOBS_QUEUE_NAME = "ontology_jobs";

/**
 * EventBusService using @effect/sql SqlEventJournal and SqlPersistedQueue
 *
 * **Details**
 *
 * Provides durable persistence via PostgreSQL.
 * Tables are auto-created on startup:
 * - effect_event_journal: Event storage with idempotency
 * - effect_event_remotes: Remote sync tracking
 * - effect_queue: Durable job queue with retry semantics
 *
 * **Example** (Inspect event bus service sql)
 *
 * ```ts
 * import { EventBusServiceSql } from "@effect-ontology/Service/EventBus"
 *
 * console.log(EventBusServiceSql)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBusServiceSql = Layer.effect(
  EventBusService,
  Effect.gen(function* () {
    // Get the EventJournal from context (provided by SqlEventJournal.layer)
    const journal = yield* EventJournal.EventJournal;
    const sql = yield* SqlClient.SqlClient;

    // Create a typed PersistedQueue for background jobs
    const jobQueue = yield* PersistedQueue.make({
      name: JOBS_QUEUE_NAME,
      schema: BackgroundJob,
    });

    // Subscribe to journal changes for event streaming
    const eventChanges = yield* journal.changes;

    /**
     * Publish an event to the journal
     */
    const publishEvent = (prepared: PreparedEvent): Effect.Effect<void, EventBusError> =>
      journal
        .write({
          event: prepared.event,
          primaryKey: prepared.primaryKey,
          payload: prepared.encodedPayload,
          effect: () => Effect.void,
        })
        .pipe(
          Effect.mapError((cause) =>
            EventBusError.make({
              method: "publishEvent",
              message: `Failed to publish event: ${prepared.event}`,
              cause: O.some(cause),
            })
          )
        );

    const publishCurationEvent: EventBusServiceMethods["publishCurationEvent"] = Effect.fn("publishCurationEvent")(
      function* (tag, payload) {
        const definition = yield* eventDefinition(CurationEventGroup.events, tag, "curation");
        const prepared = yield* prepareEvent(definition.tag, definition.primaryKey, definition.payloadMsgPack, payload);
        yield* publishEvent(prepared);
        yield* Effect.logDebug("Curation event published", {
          event: prepared.event,
          primaryKey: prepared.primaryKey,
        });
      }
    );

    const publishExtractionEvent: EventBusServiceMethods["publishExtractionEvent"] = Effect.fn(
      "publishExtractionEvent"
    )(function* (tag, payload) {
      const definition = yield* eventDefinition(ExtractionEventGroup.events, tag, "extraction");
      const prepared = yield* prepareEvent(definition.tag, definition.primaryKey, definition.payloadMsgPack, payload);
      yield* publishEvent(prepared);
      yield* Effect.logDebug("Extraction event published", {
        event: prepared.event,
        primaryKey: prepared.primaryKey,
      });
    });

    const enqueueJob: EventBusServiceMethods["enqueueJob"] = Effect.fn("enqueueJob")(
      function* (job) {
        const id = yield* jobQueue.offer(job, { id: job.id });
        yield* Effect.logDebug("Job enqueued", { id, type: job._tag });
        return id;
      },
      Effect.mapError((cause) =>
        EventBusError.make({
          method: "enqueueJob",
          message: "Failed to enqueue job",
          cause: O.some(cause),
        })
      )
    );

    const takeJob: EventBusServiceMethods["takeJob"] = jobQueue
      .take((job, { attempts, id }) => Effect.succeed({ attempts, id, job }), { maxAttempts: 1 })
      .pipe(
        Effect.timeoutOption(Duration.millis(10)),
        Effect.mapError((cause) =>
          EventBusError.make({
            method: "takeJob",
            message: "Failed to take persisted job",
            cause: O.some(cause),
          })
        )
      );

    const processJob: EventBusServiceMethods["processJob"] = Effect.fn("processJob")(
      function* (handler, options) {
        const maxAttempts = options?.maxAttempts ?? 5;
        return yield* jobQueue.take(
          (job, { attempts, id }) =>
            handler(job, {
              id,
              attempts,
            }).pipe(Effect.map(O.some)),
          { maxAttempts }
        );
      },
      Effect.mapError((cause) =>
        EventBusError.make({
          method: "processJob",
          message: "Failed to process job",
          cause: O.some(cause),
        })
      )
    );

    const subscribeEvents: EventBusServiceMethods["subscribeEvents"] = Effect.sync(() =>
      Stream.fromSubscription(eventChanges).pipe(
        Stream.mapEffect((entry) =>
          Effect.gen(function* () {
            const payload = yield* decodeEventPayload(entry.event, entry.payload);
            return yield* S.decodeEffect(EventEntry)({
              id: entry.idString,
              event: entry.event,
              primaryKey: entry.primaryKey,
              payload,
              createdAt: entry.createdAt,
            }).pipe(
              Effect.mapError((cause) =>
                EventBusError.make({
                  method: "subscribeEvents",
                  message: `Failed to validate journal event: ${entry.event}`,
                  cause: O.some(cause),
                })
              )
            );
          })
        ),
        Stream.mapError((cause) =>
          EventBusError.make({
            method: "subscribeEvents",
            message: "Event stream error",
            cause: O.some(cause),
          })
        )
      )
    );

    const readPendingJobCount = SqlSchema.findOne({
      Request: S.Void,
      Result: S.Struct({ count: NonNegativeInt }),
      execute: () => sql`
        SELECT COUNT(*)::int AS count
        FROM effect_queue
        WHERE queue_name = ${JOBS_QUEUE_NAME}
          AND completed = FALSE
      `,
    });
    const pendingJobCount: EventBusServiceMethods["pendingJobCount"] = readPendingJobCount(undefined).pipe(
      Effect.map((row) => row.count),
      Effect.mapError((cause) =>
        EventBusError.make({
          method: "pendingJobCount",
          message: "Failed to count pending persisted jobs",
          cause: O.some(cause),
        })
      )
    );

    const shutdown: EventBusServiceMethods["shutdown"] = Effect.logInfo("EventBusService SQL shutdown");

    return {
      publishCurationEvent,
      publishExtractionEvent,
      enqueueJob,
      takeJob,
      processJob,
      subscribeEvents,
      pendingJobCount,
      shutdown,
    } satisfies EventBusServiceMethods;
  })
);

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * SQL persistence layers for EventBusService
 *
 * **Details**
 *
 * Requires SqlClient.SqlClient in context.
 * Auto-creates tables: effect_event_journal, effect_event_remotes, effect_queue
 *
 * **Example** (Inspect event bus service sql layers)
 *
 * ```ts
 * import { EventBusServiceSqlLayers } from "@effect-ontology/Service/EventBus"
 *
 * console.log(EventBusServiceSqlLayers)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBusServiceSqlLayers = Layer.mergeAll(
  SqlEventJournal.layer({
    entryTable: "effect_event_journal",
    remotesTable: "effect_event_remotes",
  }),
  PersistedQueue.layer.pipe(
    Layer.provide(
      PersistedQueue.layerStoreSql({
        tableName: "effect_queue",
      })
    )
  )
);

/**
 * Complete SQL-backed EventBusService layer
 *
 * **Details**
 *
 * Requires SqlClient.SqlClient in context.
 *
 * **Example** (Inspect event bus service sql live)
 *
 * ```ts
 * import { EventBusServiceSqlLive } from "@effect-ontology/Service/EventBus"
 *
 * console.log(EventBusServiceSqlLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBusServiceSqlLive = EventBusServiceSql.pipe(Layer.provide(EventBusServiceSqlLayers));

// =============================================================================
// Default Layer
// =============================================================================

/**
 * Default EventBusService layer (Memory implementation)
 *
 * **Example** (Inspect event bus service default)
 *
 * ```ts
 * import { EventBusServiceDefault } from "@effect-ontology/Service/EventBus"
 *
 * console.log(EventBusServiceDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBusServiceDefault = EventBusServiceMemory;
