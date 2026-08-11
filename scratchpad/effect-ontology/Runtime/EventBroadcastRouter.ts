/**
 * WebSocket Event Broadcast Router
 *
 * Provides real-time event streaming from server to clients.
 * Broadcasts domain events (extractions, curation) to connected WebSocket clients.
 *
 * **Cloud-Native Architecture:**
 * 1. Events are published to Cloud Pub/Sub via EventBusPubSubBridge
 * 2. Each server instance subscribes to the events Pub/Sub topic
 * 3. When events arrive, they're broadcast to WebSocket clients on that instance
 * 4. Scales horizontally - each instance handles its own connections
 *
 * Protocol:
 * - Server sends JSON events: { type, event, payload, timestamp }
 * - Server sends periodic pings to keep connection alive
 * - Client receives events filtered by ontologyId
 *
 * @since 2.0.0
 * @module Runtime/EventBroadcastRouter
 */

import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import type * as Socket from "effect/unstable/socket/Socket"
import { $ScratchpadId } from "@beep/identity"
import { PubSub as GCloudPubSub } from "@google-cloud/pubsub"
import { Config, Context, Effect, FiberMap, Layer, MutableHashMap, Option, PubSub, Schema, Stream } from "effect"
import type * as Scope from "effect/Scope"
import { OntologyService } from "../Service/Ontology.ts"

// =============================================================================
// Protocol Types
// =============================================================================

/**
 * Event message sent to WebSocket clients
 */
export const BroadcastEvent = Schema.Struct({
  type: Schema.tag("event"),
  id: Schema.String,
  event: Schema.String,
  primaryKey: Schema.String,
  payload: Schema.Unknown,
  ontologyId: Schema.String,
  timestamp: Schema.Number
})
export type BroadcastEvent = typeof BroadcastEvent.Type

/**
 * Ping message to keep connection alive
 */
export const PingMessage = Schema.Struct({
  type: Schema.tag("ping"),
  timestamp: Schema.Number
})

/**
 * Connected message sent on connection
 */
export const ConnectedMessage = Schema.Struct({
  type: Schema.tag("connected"),
  ontologyId: Schema.String,
  serverId: Schema.String,
  timestamp: Schema.Number
})

/**
 * Union of all server-to-client messages
 */
export const ServerMessage = Schema.Union([BroadcastEvent, PingMessage, ConnectedMessage])
export type ServerMessage = typeof ServerMessage.Type

// =============================================================================
// Broadcast Hub Service
// =============================================================================

/**
 * Service for broadcasting events to connected WebSocket clients
 */
export interface EventBroadcastHub {
  /**
   * Broadcast an event to all clients subscribed to an ontology (local)
   * Note: For cloud deployment, events come from Pub/Sub, not this method
   */
  readonly broadcast: (ontologyId: string, event: BroadcastEvent) => Effect.Effect<void>

  /**
   * Subscribe to events for an ontology (used by WebSocket handler)
   */
  readonly subscribe: (ontologyId: string) => Effect.Effect<
    PubSub.Subscription<BroadcastEvent>,
    never,
    Scope.Scope
  >

  /**
   * Get count of connected clients per ontology
   */
  readonly getClientCount: (ontologyId: string) => Effect.Effect<number>
}

const $I = $ScratchpadId.create("effect-ontology/Runtime/EventBroadcastRouter")

export const EventBroadcastHub = Context.Service<EventBroadcastHub>($I`EventBroadcastHub`)

/**
 * Configuration for Cloud Pub/Sub event subscription
 */
export const EventBroadcastConfig = Config.all({
  projectId: Config.string("PUBSUB_PROJECT_ID").pipe(Config.withDefault("")),
  eventsTopicId: Config.string("PUBSUB_EVENTS_TOPIC").pipe(Config.withDefault("ontology-events")),
  eventsSubscriptionId: Config.string("PUBSUB_EVENTS_SUBSCRIPTION").pipe(
    Config.withDefault("ontology-events-broadcast")
  )
})

/**
 * Create the EventBroadcastHub service (in-memory for local development)
 */
const makeEventBroadcastHubMemory = Effect.gen(function*() {
  // In-process PubSub per ontology for local development
  const pubsubs = MutableHashMap.empty<string, PubSub.PubSub<BroadcastEvent>>()
  const clientCounts = MutableHashMap.empty<string, number>()

  const getOrCreatePubSub =
    Effect.fn(function* (ontologyId: string) {
      return yield* Option.match(MutableHashMap.get(pubsubs, ontologyId), {
        onNone: () => PubSub.unbounded<BroadcastEvent>().pipe(
          Effect.tap((pubsub) => Effect.sync(() => MutableHashMap.set(pubsubs, ontologyId, pubsub)))
        ),
        onSome: Effect.succeed
      })
    })

  const broadcast =
    Effect.fn(function* (ontologyId: string, event: BroadcastEvent)  {
      const ps = yield* getOrCreatePubSub(ontologyId)
      yield* PubSub.publish(ps, event)
      yield* Effect.logDebug("Event broadcast (memory)", { ontologyId, event: event.event })
    })

  const subscribe =
    Effect.fn(function*(ontologyId: string)  {
      const ps = yield* getOrCreatePubSub(ontologyId)
      const queue = yield* PubSub.subscribe(ps)
      // Track client count
      const current = Option.getOrElse(MutableHashMap.get(clientCounts, ontologyId), () => 0)
      MutableHashMap.set(clientCounts, ontologyId, current + 1)
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          const count = Option.getOrElse(MutableHashMap.get(clientCounts, ontologyId), () => 1)
          MutableHashMap.set(clientCounts, ontologyId, count - 1)
        })
      )
      return queue
    })

  const getClientCount = (ontologyId: string) =>
    Effect.succeed(Option.getOrElse(MutableHashMap.get(clientCounts, ontologyId), () => 0))

  yield* Effect.logInfo("EventBroadcastHub started (memory mode)")

  return EventBroadcastHub.of({
    broadcast,
    subscribe,
    getClientCount
  })
})

/**
 * Create the EventBroadcastHub service with Cloud Pub/Sub subscription
 */
const makeEventBroadcastHubPubSub = Effect.gen(function*() {
  const config = yield* EventBroadcastConfig

  // Initialize Cloud Pub/Sub client
  const pubsub = new GCloudPubSub({ projectId: config.projectId })

  // In-process PubSub for distributing to WebSocket clients
  const localPubsubs = MutableHashMap.empty<string, PubSub.PubSub<BroadcastEvent>>()
  const clientCounts = MutableHashMap.empty<string, number>()

  const getOrCreatePubSub = (ontologyId: string) =>
    Effect.gen(function*() {
      return yield* Option.match(MutableHashMap.get(localPubsubs, ontologyId), {
        onNone: () => PubSub.unbounded<BroadcastEvent>().pipe(
          Effect.tap((pubsub) => Effect.sync(() => MutableHashMap.set(localPubsubs, ontologyId, pubsub)))
        ),
        onSome: Effect.succeed
      })
    })

  // Subscribe to Cloud Pub/Sub and distribute to local WebSocket clients
  const subscription = pubsub.subscription(config.eventsSubscriptionId)

  subscription.on("message", (message) => {
    try {
      const data = JSON.parse(message.data.toString())
      const ontologyId = message.attributes?.ontologyId || data.ontologyId

      if (ontologyId) {
        const event: BroadcastEvent = {
          type: "event",
          id: message.id,
          event: message.attributes?.eventType || data.event || "unknown",
          primaryKey: message.attributes?.primaryKey || data.primaryKey || message.id,
          payload: data,
          ontologyId,
          timestamp: message.publishTime?.getTime() || Date.now()
        }

        // Broadcast to local WebSocket clients
        Option.map(MutableHashMap.get(localPubsubs, ontologyId), (pubsub) => PubSub.publishUnsafe(pubsub, event))
      }

      message.ack()
    } catch (error) {
      console.error("Failed to process Pub/Sub message:", error)
      message.nack()
    }
  })

  subscription.on("error", (error) => {
    console.error("Pub/Sub subscription error:", error)
  })

  yield* Effect.logInfo("EventBroadcastHub started (Cloud Pub/Sub mode)", {
    projectId: config.projectId,
    subscriptionId: config.eventsSubscriptionId
  })

  // Cleanup on shutdown
  yield* Effect.addFinalizer(() =>
    Effect.tryPromise({
      try: () => subscription.close(),
      catch: () => undefined
    }).pipe(Effect.ignore)
  )

  const broadcast =
    Effect.fn(function* (ontologyId: string, event: BroadcastEvent)  {
      const ps = yield* getOrCreatePubSub(ontologyId)
      yield* PubSub.publish(ps, event)
      yield* Effect.logDebug("Event broadcast (local)", { ontologyId, event: event.event })
    })

  const subscribe =
    Effect.fn(function*(ontologyId: string)  {
      const ps = yield* getOrCreatePubSub(ontologyId)
      const queue = yield* PubSub.subscribe(ps)
      // Track client count
      const current = Option.getOrElse(MutableHashMap.get(clientCounts, ontologyId), () => 0)
      MutableHashMap.set(clientCounts, ontologyId, current + 1)
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          const count = Option.getOrElse(MutableHashMap.get(clientCounts, ontologyId), () => 1)
          MutableHashMap.set(clientCounts, ontologyId, count - 1)
        })
      )
      return queue
    })

  const getClientCount = (ontologyId: string) =>
    Effect.succeed(Option.getOrElse(MutableHashMap.get(clientCounts, ontologyId), () => 0))

  return EventBroadcastHub.of({
    broadcast,
    subscribe,
    getClientCount
  })
})

/**
 * Layer for EventBroadcastHub (memory mode - for local development)
 */
export const EventBroadcastHubMemory = Layer.effect(EventBroadcastHub, makeEventBroadcastHubMemory)

/**
 * Layer for EventBroadcastHub (Cloud Pub/Sub mode - for production)
 */
export const EventBroadcastHubPubSub = Layer.effect(EventBroadcastHub, makeEventBroadcastHubPubSub)

/**
 * Default layer - auto-selects based on PUBSUB_PROJECT_ID being set
 */
export const EventBroadcastHubLive = Layer.unwrap(
  Effect.gen(function*() {
    const config = yield* EventBroadcastConfig
    if (config.projectId) {
      yield* Effect.logInfo("Using Cloud Pub/Sub for event broadcasting")
      return EventBroadcastHubPubSub
    } else {
      yield* Effect.logInfo("Using in-memory event broadcasting (no PUBSUB_PROJECT_ID)")
      return EventBroadcastHubMemory
    }
  })
)

// =============================================================================
// WebSocket Handler
// =============================================================================

/**
 * Generate a simple server ID (stable per process)
 */
const serverId = crypto.randomUUID()

/**
 * Event Broadcast WebSocket Router
 *
 * Provides WebSocket endpoint for real-time event streaming:
 * - GET /v1/ontologies/:ontologyId/events/stream - WebSocket upgrade
 *
 * @since 2.0.0
 */
export const EventBroadcastRouter = HttpRouter.addAll([
HttpRouter.route("GET", 
    "/v1/ontologies/:ontologyId/events/stream",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const ontologyId = params.ontologyId

      if (!ontologyId) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Ontology ID is required"
        }, { status: 400 })
      }

      // Validate ontology exists
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(ontologyId)
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${ontologyId}" not found`
        }, { status: 404 })
      }

      // Upgrade to WebSocket
      const request = yield* HttpServerRequest.HttpServerRequest
      const socket = yield* request.upgrade

      // Handle WebSocket connection
      yield* handleWebSocket(socket, ontologyId).pipe(
        Effect.annotateLogs({ ontologyId, service: "EventBroadcastRouter" })
      )

      return HttpServerResponse.empty()
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          yield* Effect.logError("WebSocket upgrade failed", { error: String(error) })
          return yield* HttpServerResponse.json({
            error: "WEBSOCKET_ERROR",
            message: "Failed to upgrade connection"
          }, { status: 500 })
        })
      )
    )
  )
])

/**
 * Handle a WebSocket connection for event streaming
 */
const handleWebSocket = (socket: Socket.Socket, ontologyId: string) =>
  Effect.gen(function*() {
    const hub = yield* EventBroadcastHub
    const writer = yield* socket.writer

    // Send connected message
    const connected: ServerMessage = {
      type: "connected",
      ontologyId,
      serverId,
      timestamp: Date.now()
    }
    yield* writer(new TextEncoder().encode(JSON.stringify(connected)))

    yield* Effect.logInfo("WebSocket client connected", { ontologyId })

    // Subscribe to events for this ontology
    const eventQueue = yield* hub.subscribe(ontologyId)

    // Create fibers for sending events and pings
    const fibers = yield* FiberMap.make<string>()

    // Event sender fiber
    yield* FiberMap.run(fibers, "events")(
      Stream.fromQueue(eventQueue).pipe(
        Stream.tap((event) =>
          Effect.gen(function*() {
            const message: ServerMessage = { ...event, type: "event" }
            yield* writer(new TextEncoder().encode(JSON.stringify(message)))
          })
        ),
        Stream.runDrain
      )
    )

    // Ping sender fiber (every 30 seconds)
    yield* FiberMap.run(fibers, "ping")(
      Effect.gen(function*() {
        const ping: ServerMessage = { type: "ping", timestamp: Date.now() }
        yield* writer(new TextEncoder().encode(JSON.stringify(ping)))
      }).pipe(
        Effect.delay("30 seconds"),
        Effect.forever,
        Effect.catch(() => Effect.void)
      )
    )

    // Wait for socket to close
    yield* socket.run(() => Effect.void).pipe(
      Effect.catch(() => Effect.void)
    )

    yield* Effect.logInfo("WebSocket client disconnected", { ontologyId })
  }).pipe(Effect.scoped)

// =============================================================================
// Integration Helper
// =============================================================================

/**
 * Publish a domain event to the broadcast hub
 *
 * Call this from EventBusService or WorkflowOrchestrator to broadcast events.
 *
 * @example
 * ```ts
 * yield* broadcastDomainEvent("seattle", {
 *   event: "ExtractionCompleted",
 *   primaryKey: `extraction:${batchId}`,
 *   payload: { batchId, entityCount: 42 }
 * })
 * ```
 */
export const broadcastDomainEvent = (
  ontologyId: string,
  event: {
    event: string
    primaryKey: string
    payload: unknown
  }
) =>
  Effect.gen(function*() {
    const hub = yield* EventBroadcastHub
    const broadcastEvent: BroadcastEvent = {
      type: "event",
      id: crypto.randomUUID(),
      event: event.event,
      primaryKey: event.primaryKey,
      payload: event.payload,
      ontologyId,
      timestamp: Date.now()
    }
    yield* hub.broadcast(ontologyId, broadcastEvent)
  })
