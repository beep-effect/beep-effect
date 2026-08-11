/**
 * Event Bus Service
 *
 * Unified interface for event publishing and job queuing.
 * Supports multiple backends: Memory (dev/test), Postgres (durable), PubSub (production).
 *
 * @since 2.0.0
 * @module Service/EventBus
 */

import type * as Event from "effect/unstable/eventlog/Event"
import type * as EventGroup from "effect/unstable/eventlog/EventGroup"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as PersistedQueue from "effect/unstable/persistence/PersistedQueue"
import * as SqlEventJournal from "effect/unstable/eventlog/SqlEventJournal"
import { Context, DateTime, Effect, Layer, Option, Queue, Schema, Stream } from "effect"
import { EventBusError } from "../Domain/Error/EventBus.ts"
import { CurationEventGroup, ExtractionEventGroup } from "../Domain/Schema/EventSchema.ts"
import { type BackgroundJob, BackgroundJobSchema } from "../Domain/Schema/JobSchema.ts"
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
const $I = $ScratchpadId.create("effect-ontology/Service/EventBus");

// =============================================================================
// Types
// =============================================================================

/**
 * Job with metadata for processing
 *
 * @since 2.0.0
 */
export interface JobWithMetadata {
  readonly job: BackgroundJob
  readonly id: string
  readonly attempts: number
}

/**
 * Event entry from journal
 *
 * @since 2.0.0
 */
export interface EventEntry {
  readonly id: string
  readonly event: string
  readonly primaryKey: string
  readonly payload: unknown
  readonly createdAt: DateTime.Utc
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * EventBusService interface for event publishing and job queuing
 *
 * @since 2.0.0
 */
export interface EventBusService {
  /**
   * Publish a curation event
   */
  readonly publishCurationEvent: <Tag extends EventGroup.Events<typeof CurationEventGroup>["tag"]>(
    tag: Tag,
    payload: Event.PayloadWithTag<EventGroup.Events<typeof CurationEventGroup>, Tag>
  ) => Effect.Effect<void, EventBusError>

  /**
   * Publish an extraction event
   */
  readonly publishExtractionEvent: <Tag extends EventGroup.Events<typeof ExtractionEventGroup>["tag"]>(
    tag: Tag,
    payload: Event.PayloadWithTag<EventGroup.Events<typeof ExtractionEventGroup>, Tag>
  ) => Effect.Effect<void, EventBusError>

  /**
   * Enqueue a background job
   */
  readonly enqueueJob: (job: BackgroundJob) => Effect.Effect<string, EventBusError>

  /**
   * Take the next job for processing
   * Returns None if no jobs are available (non-blocking)
   */
  readonly takeJob: () => Effect.Effect<Option.Option<JobWithMetadata>, EventBusError>

  /**
   * Take and process a job with automatic retry handling
   */
  readonly processJob: <A, E, R>(
    handler: (job: BackgroundJob, meta: { id: string; attempts: number }) => Effect.Effect<A, E, R>,
    options?: { readonly maxAttempts?: number }
  ) => Effect.Effect<Option.Option<A>, E | EventBusError, R>

  /**
   * Subscribe to events as a stream
   */
  readonly subscribeEvents: () => Effect.Effect<Stream.Stream<EventEntry, EventBusError>, EventBusError>

  /**
   * Get pending job count
   */
  readonly pendingJobCount: () => Effect.Effect<number, EventBusError>

  /**
   * Graceful shutdown
   */
  readonly shutdown: () => Effect.Effect<void, EventBusError>
}

/**
 * EventBusService context tag
 *
 * @since 2.0.0
 */
export const EventBusService = Context.Service<EventBusService>($I`EventBusService`)

// =============================================================================
// Memory Implementation
// =============================================================================

/**
 * In-memory EventBusService implementation for development and testing
 *
 * Uses Effect Queue for jobs and in-memory event storage.
 * Not durable - events and jobs are lost on restart.
 *
 * @since 2.0.0
 */
export const EventBusServiceMemory = Layer.effect(
  EventBusService,
  Effect.gen(function*() {
    // In-memory event storage
    const events: Array<EventEntry> = []
    const eventSubscribers = yield* Queue.unbounded<EventEntry>()

    // In-memory job queue with metadata
    const jobQueue = yield* Queue.bounded<JobWithMetadata>(1000)
    let jobIdCounter = 0

    const publishEvent = (
      event: string,
      primaryKey: string,
      payload: unknown
    ): Effect.Effect<void, EventBusError> =>
      Effect.gen(function*() {
        const now = yield* DateTime.now
        const entry: EventEntry = {
          id: `evt_${Date.now()}_${events.length}`,
          event,
          primaryKey,
          payload,
          createdAt: now
        }

        // Check for duplicate by primaryKey
        const existing = events.find((e) => e.event === event && e.primaryKey === primaryKey)
        if (existing) {
          yield* Effect.logDebug("Duplicate event ignored", { event, primaryKey })
          return
        }

        events.push(entry)
        yield* Queue.offer(eventSubscribers, entry)
        yield* Effect.logDebug("Event published", { event, primaryKey })
      }).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            EventBusError.make({
              method: "publishEvent",
              message: `Failed to publish event: ${event}`,
              cause
            })
          )
        )
      )

    const publishCurationEvent: EventBusService["publishCurationEvent"] = (tag, payload) =>
      Effect.gen(function*() {
        const eventDef = CurationEventGroup.events[tag]
        if (!eventDef) {
          return yield* Effect.fail(
            EventBusError.make({
              method: "publishCurationEvent",
              message: `Unknown curation event: ${tag}`
            })
          )
        }
        const primaryKey = (eventDef as any).primaryKey(payload)
        yield* publishEvent(tag, primaryKey, payload)
      })

    const publishExtractionEvent: EventBusService["publishExtractionEvent"] = (tag, payload) =>
      Effect.gen(function*() {
        const eventDef = ExtractionEventGroup.events[tag]
        if (!eventDef) {
          return yield* Effect.fail(
            EventBusError.make({
              method: "publishExtractionEvent",
              message: `Unknown extraction event: ${tag}`
            })
          )
        }
        const primaryKey = (eventDef as any).primaryKey(payload)
        yield* publishEvent(tag, primaryKey, payload)
      })

    const enqueueJob: EventBusService["enqueueJob"] = (job) =>
      Effect.gen(function*() {
        const id = `job_${++jobIdCounter}_${Date.now()}`
        const jobWithMeta: JobWithMetadata = {
          job,
          id,
          attempts: 0
        }
        yield* Queue.offer(jobQueue, jobWithMeta)
        yield* Effect.logDebug("Job enqueued", { id, type: job._tag })
        return id
      }).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            EventBusError.make({
              method: "enqueueJob",
              message: "Failed to enqueue job",
              cause
            })
          )
        )
      )

    const takeJob: EventBusService["takeJob"] = () =>
      Queue.poll(jobQueue).pipe(
        Effect.map((opt) =>
          Option.map(opt, (jwm) => ({
            ...jwm,
            attempts: jwm.attempts + 1
          }))
        ),
        Effect.catch((cause) =>
          Effect.fail(
            EventBusError.make({
              method: "takeJob",
              message: "Failed to take job",
              cause
            })
          )
        )
      )

    const processJob: EventBusService["processJob"] = (handler, options) =>
      Effect.gen(function*() {
        const jobOpt = yield* takeJob()
        if (Option.isNone(jobOpt)) {
          return Option.none()
        }

        const { attempts, id, job } = jobOpt.value
        const maxAttempts = options?.maxAttempts ?? 5

        const result = yield* handler(job, { id, attempts }).pipe(
          Effect.catch((error) =>
            Effect.gen(function*() {
              if (attempts < maxAttempts) {
                // Re-queue for retry
                yield* Queue.offer(jobQueue, { job, id, attempts })
                yield* Effect.logWarning("Job failed, retrying", {
                  id,
                  attempts,
                  maxAttempts,
                  error: String(error)
                })
              } else {
                yield* Effect.logError("Job failed, max attempts reached", {
                  id,
                  attempts,
                  error: String(error)
                })
              }
              return yield* Effect.fail(error)
            })
          )
        )

        return Option.some(result)
      })

    const subscribeEvents: EventBusService["subscribeEvents"] = () =>
      Effect.succeed(
        Stream.fromQueue(eventSubscribers).pipe(
          Stream.mapError((cause) =>
            EventBusError.make({
              method: "subscribeEvents",
              message: "Event stream error",
              cause
            })
          )
        )
      )

    const pendingJobCount: EventBusService["pendingJobCount"] = () =>
      Queue.size(jobQueue).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            EventBusError.make({
              method: "pendingJobCount",
              message: "Failed to get pending job count",
              cause
            })
          )
        )
      )

    const shutdown: EventBusService["shutdown"] = () =>
      Effect.gen(function*() {
        yield* Queue.shutdown(jobQueue)
        yield* Queue.shutdown(eventSubscribers)
        yield* Effect.logInfo("EventBusService shut down")
      }).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            EventBusError.make({
              method: "shutdown",
              message: "Failed to shutdown",
              cause
            })
          )
        )
      )

    // Cleanup on scope finalization
    yield* Effect.addFinalizer(() => shutdown().pipe(Effect.catch(() => Effect.void)))

    return {
      publishCurationEvent,
      publishExtractionEvent,
      enqueueJob,
      takeJob,
      processJob,
      subscribeEvents,
      pendingJobCount,
      shutdown
    } satisfies EventBusService
  })
)

// =============================================================================
// SQL Implementation (uses @effect/sql)
// =============================================================================

/**
 * Queue name for background jobs
 */
const JOBS_QUEUE_NAME = "ontology_jobs"

/**
 * EventBusService using @effect/sql SqlEventJournal and SqlPersistedQueue
 *
 * Provides durable persistence via PostgreSQL.
 * Tables are auto-created on startup:
 * - effect_event_journal: Event storage with idempotency
 * - effect_event_remotes: Remote sync tracking
 * - effect_queue: Durable job queue with retry semantics
 *
 * @since 2.0.0
 */
export const EventBusServiceSql = Layer.effect(
  EventBusService,
  Effect.gen(function*() {
    // Get the EventJournal from context (provided by SqlEventJournal.layer)
    const journal = yield* EventJournal.EventJournal

    // Create a typed PersistedQueue for background jobs
    const jobQueue = yield* PersistedQueue.make({
      name: JOBS_QUEUE_NAME,
      schema: BackgroundJobSchema
    })

    // Subscribe to journal changes for event streaming
    const eventChanges = yield* journal.changes

    /**
     * Publish an event to the journal
     */
    const publishEvent = (
      event: string,
      primaryKey: string,
      payload: unknown
    ): Effect.Effect<void, EventBusError> =>
      journal.write({
        event,
        primaryKey,
        payload: Schema.encodeSync(Schema.Unknown)(payload) as Uint8Array,
        effect: () => Effect.void
      }).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            EventBusError.make({
              method: "publishEvent",
              message: `Failed to publish event: ${event}`,
              cause: O.some(cause)
            })
          )
        )
      )

    const publishCurationEvent: EventBusService["publishCurationEvent"] = (tag, payload) =>
      Effect.gen(function*() {
        const eventDef = CurationEventGroup.events[tag]
        if (!eventDef) {
          return yield* Effect.fail(
            EventBusError.make({
              method: "publishCurationEvent",
              message: `Unknown curation event: ${tag}`
            })
          )
        }
        const primaryKey = (eventDef as any).primaryKey(payload)
        yield* publishEvent(tag, primaryKey, payload)
        yield* Effect.logDebug("Curation event published", { event: tag, primaryKey })
      })

    const publishExtractionEvent: EventBusService["publishExtractionEvent"] = (tag, payload) =>
      Effect.gen(function*() {
        const eventDef = ExtractionEventGroup.events[tag]
        if (!eventDef) {
          return yield* Effect.fail(
            EventBusError.make({
              method: "publishExtractionEvent",
              message: `Unknown extraction event: ${tag}`
            })
          )
        }
        const primaryKey = (eventDef as any).primaryKey(payload)
        yield* publishEvent(tag, primaryKey, payload)
        yield* Effect.logDebug("Extraction event published", { event: tag, primaryKey })
      })

    const enqueueJob: EventBusService["enqueueJob"] = (job) =>
      Effect.gen(function*() {
        const id = yield* jobQueue.offer(job, { id: job.id })
        yield* Effect.logDebug("Job enqueued", { id, type: job._tag })
        return id
      }).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            EventBusError.make({
              method: "enqueueJob",
              message: "Failed to enqueue job",
              cause: O.some(cause)
            })
          )
        )
      )

    // Note: takeJob for SQL implementation works differently - jobs are taken via processJob
    // which handles the full lifecycle (take + complete/retry)
    const takeJob: EventBusService["takeJob"] = () => Effect.succeed(Option.none())

    const processJob: EventBusService["processJob"] = (handler, options) =>
      Effect.gen(function*() {
        const maxAttempts = options?.maxAttempts ?? 5

        // Use the PersistedQueue take() which handles retry/complete lifecycle
        const result = yield* jobQueue.take(
          (job, { attempts, id }) =>
            handler(job, { id, attempts }).pipe(
              Effect.map(Option.some)
            ),
          { maxAttempts }
        )

        return result
      }).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            EventBusError.make({
              method: "processJob",
              message: "Failed to process job",
              cause: O.some(cause)
            })
          )
        )
      )

    const subscribeEvents: EventBusService["subscribeEvents"] = () =>
      Effect.sync(() =>
        Stream.fromSubscription(eventChanges).pipe(
          Stream.map((entry) => ({
            id: entry.idString,
            event: entry.event,
            primaryKey: entry.primaryKey,
            payload: entry.payload,
            createdAt: entry.createdAt
          })),
          Stream.mapError((cause) =>
            EventBusError.make({
              method: "subscribeEvents",
              message: "Event stream error",
              cause: O.some(cause)
            })
          )
        )
      )

    // SQL implementation doesn't have a pending count API - would need custom query
    const pendingJobCount: EventBusService["pendingJobCount"] = () => Effect.succeed(0)

    const shutdown: EventBusService["shutdown"] = () =>
      Effect.gen(function*() {
        yield* Effect.logInfo("EventBusService SQL shutdown")
      }).pipe(
        Effect.catch((cause) =>
          Effect.fail(
            EventBusError.make({
              method: "shutdown",
              message: "Failed to shutdown",
              cause
            })
          )
        )
      )

    return {
      publishCurationEvent,
      publishExtractionEvent,
      enqueueJob,
      takeJob,
      processJob,
      subscribeEvents,
      pendingJobCount,
      shutdown
    } satisfies EventBusService
  })
)

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * SQL persistence layers for EventBusService
 *
 * Requires SqlClient.SqlClient in context.
 * Auto-creates tables: effect_event_journal, effect_event_remotes, effect_queue
 *
 * @since 2.0.0
 */
export const EventBusServiceSqlLayers = Layer.mergeAll(
  SqlEventJournal.layer({
    entryTable: "effect_event_journal",
    remotesTable: "effect_event_remotes"
  }),
  PersistedQueue.layerStoreSql({
    tableName: "effect_queue"
  })
)

/**
 * Complete SQL-backed EventBusService layer
 *
 * Requires SqlClient.SqlClient in context.
 *
 * @since 2.0.0
 */
export const EventBusServiceSqlLive = EventBusServiceSql.pipe(
  Layer.provide(EventBusServiceSqlLayers)
)

// =============================================================================
// Default Layer
// =============================================================================

/**
 * Default EventBusService layer (Memory implementation)
 *
 * @since 2.0.0
 */
export const EventBusServiceDefault = EventBusServiceMemory
