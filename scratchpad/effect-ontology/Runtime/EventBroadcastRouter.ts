/**
 * WebSocket Event Broadcast Router
 *
 * **Details**
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
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
import { PubSub as GCloudPubSub } from "@google-cloud/pubsub";
import {
  Cause,
  Clock,
  Config,
  Context,
  Deferred,
  Duration,
  Effect,
  FiberMap,
  Layer,
  MutableHashMap,
  PubSub,
  Random,
  Schedule,
  Stream,
} from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import type * as Socket from "effect/unstable/socket/Socket";
import { OntologyName } from "../Domain/Identity.ts";
import { OntologyEventEntry } from "../Domain/Schema/EventSchema.ts";
import type { EventEntry } from "../Service/EventBus.ts";
import { OntologyService } from "../Service/Ontology.ts";
import { TicketService } from "../Service/Ticket.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/EventBroadcastRouter");

// =============================================================================
// Protocol Types
// =============================================================================

/**
 * Schema for ontology event envelopes broadcast to WebSocket clients.
 *
 * **Example** (Reject an incomplete event envelope)
 *
 * ```ts
 * import { BroadcastEvent } from "@effect-ontology/Runtime/EventBroadcastRouter"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BroadcastEvent)({ type: "event" })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BroadcastEvent = S.Struct({
  type: S.tag("event"),
  entry: OntologyEventEntry,
  ontologyId: OntologyName,
  timestamp: NonNegativeInt,
}).pipe(
  $I.annoteSchema("BroadcastEvent", {
    description: "Ontology event envelope broadcast to WebSocket clients.",
  })
);

/**
 * Decoded ontology event envelope produced by {@link BroadcastEvent}.
 *
 * **Example** (Read an event envelope)
 *
 * ```ts
 * import type { BroadcastEvent } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const readOntology = (event: BroadcastEvent): string => event.ontologyId
 *
 * console.log(readOntology)
 * ```
 *
 * @see {@link BroadcastEvent} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type BroadcastEvent = typeof BroadcastEvent.Type;

/**
 * Ping message to keep connection alive
 *
 * **Example** (Validate ping message)
 *
 * ```ts
 * import { PingMessage } from "@effect-ontology/Runtime/EventBroadcastRouter"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PingMessage)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PingMessage = S.Struct({
  type: S.tag("ping"),
  timestamp: NonNegativeInt,
}).pipe(
  $I.annoteSchema("PingMessage", {
    description: "Keep-alive message emitted by the WebSocket event stream.",
  })
);

/**
 * Decoded keep-alive message produced by {@link PingMessage}.
 *
 * **Example** (Read a ping timestamp)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Int"
 * import { PingMessage } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const message: PingMessage = PingMessage.make({ timestamp: NonNegativeInt.make(0) })
 * console.log(message.timestamp) // 0
 * ```
 *
 * @see {@link PingMessage} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type PingMessage = typeof PingMessage.Type;

/**
 * Connected message sent on connection
 *
 * **Example** (Validate connected message)
 *
 * ```ts
 * import { ConnectedMessage } from "@effect-ontology/Runtime/EventBroadcastRouter"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ConnectedMessage)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConnectedMessage = S.Struct({
  type: S.tag("connected"),
  ontologyId: S.String,
  serverId: S.String,
  timestamp: NonNegativeInt,
}).pipe(
  $I.annoteSchema("ConnectedMessage", {
    description: "Connection acknowledgement identifying the ontology and serving instance.",
  })
);

/**
 * Decoded connection acknowledgement produced by {@link ConnectedMessage}.
 *
 * **Example** (Read the serving instance)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Int"
 * import { ConnectedMessage } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const message: ConnectedMessage = ConnectedMessage.make({
 *   ontologyId: "football",
 *   serverId: "server-1",
 *   timestamp: NonNegativeInt.make(0)
 * })
 * console.log(message.serverId) // "server-1"
 * ```
 *
 * @see {@link ConnectedMessage} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ConnectedMessage = typeof ConnectedMessage.Type;

/**
 * Union of all server-to-client messages
 *
 * **Example** (Validate server message)
 *
 * ```ts
 * import { ServerMessage } from "@effect-ontology/Runtime/EventBroadcastRouter"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ServerMessage)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ServerMessage: S.Codec<BroadcastEvent | PingMessage | ConnectedMessage, unknown> = S.Union([
  BroadcastEvent,
  PingMessage,
  ConnectedMessage,
]);
/**
 * Describes the server message data exposed by this module.
 *
 *
 * **Example** (Use the ServerMessage contract)
 *
 * ```ts
 * import type { ServerMessage } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const acceptsServerMessage = (_value: ServerMessage): void => undefined
 *
 * console.log(acceptsServerMessage)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ServerMessage = BroadcastEvent | PingMessage | ConnectedMessage;

const decodePubSubEventPayload = S.decodeUnknownOption(S.fromJsonString(OntologyEventEntry));
const encodeServerMessage = S.encodeEffect(S.fromJsonString(ServerMessage));

// =============================================================================
// Broadcast Hub Service
// =============================================================================

/**
 * Service for broadcasting events to connected WebSocket clients
 *
 *
 * **Example** (Use the EventBroadcastHubMethods contract)
 *
 * ```ts
 * import type { EventBroadcastHubMethods } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const acceptsEventBroadcastHubMethods = (_value: EventBroadcastHubMethods): void => undefined
 *
 * console.log(acceptsEventBroadcastHubMethods)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EventBroadcastHubMethods {
  /**
   * Broadcast an event to all clients subscribed to an ontology (local)
   * Note: For cloud deployment, events come from Pub/Sub, not this method
   */
  readonly broadcast: (ontologyId: string, event: BroadcastEvent) => Effect.Effect<void>;

  /**
   * Subscribe to events for an ontology (used by WebSocket handler)
   */
  readonly subscribe: (ontologyId: string) => Effect.Effect<PubSub.Subscription<BroadcastEvent>, never, Scope.Scope>;

  /**
   * Get count of connected clients per ontology
   */
  readonly getClientCount: (ontologyId: string) => Effect.Effect<number>;
}

/**
 * Exposes event broadcast hub for composition by callers of this module.
 *
 * **Example** (Inspect event broadcast hub)
 *
 * ```ts
 * import { EventBroadcastHub } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * console.log(EventBroadcastHub)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EventBroadcastHub extends Context.Service<EventBroadcastHub, EventBroadcastHubMethods>()(
  $I`EventBroadcastHub`
) {}

/**
 * Configuration for Cloud Pub/Sub event subscription
 */
class PubSubSubscriptionError extends S.TaggedError<PubSubSubscriptionError>($I`PubSubSubscriptionError`)(
  "PubSubSubscriptionError",
  {
    message: S.NonEmptyString,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("PubSubSubscriptionError", {
    description: "Typed failure while creating or running the Cloud Pub/Sub event subscription.",
  })
) {}

const isSubscriptionAlreadyExists = S.is(S.Struct({ code: S.Literal(6) }));

class PubSubCreateError extends S.TaggedError<PubSubCreateError>($I`PubSubCreateError`)("PubSubCreateError", {
  alreadyExists: S.Boolean,
  cause: S.Defect({ includeStack: true }),
}) {}

/**
 * Exposes event broadcast config for composition by callers of this module.
 *
 * **Example** (Inspect event broadcast config)
 *
 * ```ts
 * import { EventBroadcastConfig } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * console.log(EventBroadcastConfig)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const EventBroadcastConfig = Config.all({
  projectId: Config.string("PUBSUB_PROJECT_ID").pipe(Config.withDefault("")),
  eventsTopicId: Config.string("PUBSUB_EVENTS_TOPIC").pipe(Config.withDefault("ontology-events")),
  eventsSubscriptionId: Config.string("PUBSUB_EVENTS_SUBSCRIPTION").pipe(
    Config.withDefault("ontology-events-broadcast")
  ),
});

const makeLocalBroadcastState = (options: { readonly spanPrefix: string; readonly broadcastLogMessage: string }) => {
  const pubsubs = MutableHashMap.empty<string, PubSub.PubSub<BroadcastEvent>>();
  const clientCounts = MutableHashMap.empty<string, number>();

  const getOrCreatePubSub = Effect.fn(`${options.spanPrefix}.getOrCreatePubSub`)(function* (ontologyId: string) {
    return yield* O.match(MutableHashMap.get(pubsubs, ontologyId), {
      onNone: () =>
        PubSub.unbounded<BroadcastEvent>().pipe(
          Effect.tap((pubsub) => Effect.sync(() => MutableHashMap.set(pubsubs, ontologyId, pubsub)))
        ),
      onSome: Effect.succeed,
    });
  });

  const broadcast = Effect.fn(`${options.spanPrefix}.broadcast`)(function* (ontologyId: string, event: BroadcastEvent) {
    const pubsub = yield* getOrCreatePubSub(ontologyId);
    yield* PubSub.publish(pubsub, event);
    yield* Effect.logDebug(options.broadcastLogMessage, { ontologyId, event: event.entry.event });
  });

  const subscribe = Effect.fn(`${options.spanPrefix}.subscribe`)(function* (ontologyId: string) {
    const pubsub = yield* getOrCreatePubSub(ontologyId);
    const queue = yield* PubSub.subscribe(pubsub);
    const current = O.getOrElse(MutableHashMap.get(clientCounts, ontologyId), () => 0);
    MutableHashMap.set(clientCounts, ontologyId, current + 1);
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        const count = O.getOrElse(MutableHashMap.get(clientCounts, ontologyId), () => 1);
        MutableHashMap.set(clientCounts, ontologyId, count - 1);
      })
    );
    return queue;
  });

  const getClientCount = (ontologyId: string) =>
    Effect.succeed(O.getOrElse(MutableHashMap.get(clientCounts, ontologyId), () => 0));

  const publishUnsafe = (ontologyId: string, event: BroadcastEvent): void => {
    O.map(MutableHashMap.get(pubsubs, ontologyId), (pubsub) => PubSub.publishUnsafe(pubsub, event));
  };

  return { broadcast, subscribe, getClientCount, publishUnsafe };
};

/**
 * Create the EventBroadcastHub service (in-memory for local development)
 */
const makeEventBroadcastHubMemory = Effect.gen(function* () {
  const local = makeLocalBroadcastState({
    spanPrefix: "EventBroadcastRouter.memory",
    broadcastLogMessage: "Event broadcast (memory)",
  });

  yield* Effect.logInfo("EventBroadcastHub started (memory mode)");

  return EventBroadcastHub.of({
    broadcast: local.broadcast,
    subscribe: local.subscribe,
    getClientCount: local.getClientCount,
  });
});

/**
 * Create the EventBroadcastHub service with Cloud Pub/Sub subscription
 */
const makeEventBroadcastHubPubSub = Effect.gen(function* () {
  const config = yield* EventBroadcastConfig;
  const runFork = Effect.runForkWith(yield* Effect.context());

  // Initialize Cloud Pub/Sub client
  const pubsub = new GCloudPubSub({ projectId: config.projectId });

  const local = makeLocalBroadcastState({
    spanPrefix: "EventBroadcastRouter.cloud",
    broadcastLogMessage: "Event broadcast (local)",
  });

  // One subscription per replica so every instance receives every event.
  const nowMillis = yield* Clock.currentTimeMillis;
  const instanceSubscriptionId = `${config.eventsSubscriptionId}-${process.pid}-${nowMillis.toString(36)}`;
  const createSubscription = Effect.fn("EventBroadcastHub.createSubscription")(function* () {
    return yield* Effect.tryPromise({
      try: () =>
        pubsub.topic(config.eventsTopicId).createSubscription(instanceSubscriptionId, {
          expirationPolicy: { ttl: { seconds: 86_400 } },
        }),
      catch: (cause) => PubSubCreateError.make({ alreadyExists: isSubscriptionAlreadyExists(cause), cause }),
    }).pipe(
      Effect.map(([created]) => created),
      Effect.catchIf(
        (error) => error.alreadyExists,
        () => Effect.succeed(pubsub.subscription(instanceSubscriptionId))
      ),
      Effect.mapError((error) =>
        PubSubSubscriptionError.make({
          message: "Failed to create the Cloud Pub/Sub subscription.",
          cause: error.cause,
        })
      )
    );
  });

  const runSubscription = Effect.fn("EventBroadcastHub.runSubscription")(function* (
    subscription: ReturnType<typeof pubsub.subscription>
  ) {
    const failed = yield* Deferred.make<void, PubSubSubscriptionError>();
    subscription.on("message", (message) => {
      const data = decodePubSubEventPayload(message.data.toString());
      if (O.isSome(data)) {
        const ontologyId = data.value.payload.ontologyId;
        const event: BroadcastEvent = {
          type: "event",
          entry: data.value,
          ontologyId,
          timestamp: NonNegativeInt.make(message.publishTime?.getTime() ?? 0),
        };
        local.publishUnsafe(ontologyId, event);
        message.ack();
      } else {
        message.nack();
      }
    });
    subscription.on("error", (cause) => {
      runFork(
        Deferred.fail(
          failed,
          PubSubSubscriptionError.make({ message: "Cloud Pub/Sub event subscription terminated.", cause })
        )
      );
    });
    return yield* Deferred.await(failed).pipe(
      Effect.ensuring(
        Effect.tryPromise({
          try: () => subscription.close(),
          catch: (cause) =>
            PubSubSubscriptionError.make({ message: "Failed to close the Cloud Pub/Sub subscription.", cause }),
        }).pipe(
          Effect.catchTag("PubSubSubscriptionError", (error) =>
            Effect.logWarning("Pub/Sub subscription cleanup failed", { error })
          )
        )
      )
    );
  });

  const initialSubscription = yield* createSubscription();
  const reconnect = createSubscription().pipe(
    Effect.flatMap(runSubscription),
    Effect.tapError((error) => Effect.logError("Pub/Sub subscription failed; reconnecting", { error })),
    Effect.retry(Schedule.exponential(Duration.millis(100)))
  );
  yield* runSubscription(initialSubscription).pipe(
    Effect.catchTag("PubSubSubscriptionError", () => reconnect),
    Effect.forkScoped
  );

  yield* Effect.logInfo("EventBroadcastHub started (Cloud Pub/Sub mode)", {
    projectId: config.projectId,
    subscriptionId: instanceSubscriptionId,
  });

  return EventBroadcastHub.of({
    broadcast: local.broadcast,
    subscribe: local.subscribe,
    getClientCount: local.getClientCount,
  });
});

/**
 * Layer for EventBroadcastHub (memory mode - for local development)
 *
 * **Example** (Inspect event broadcast hub memory)
 *
 * ```ts
 * import { EventBroadcastHubMemory } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * console.log(EventBroadcastHubMemory)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBroadcastHubMemory = Layer.effect(EventBroadcastHub, makeEventBroadcastHubMemory);

/**
 * Layer for EventBroadcastHub (Cloud Pub/Sub mode - for production)
 *
 * **Example** (Inspect event broadcast hub pub sub)
 *
 * ```ts
 * import { EventBroadcastHubPubSub } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * console.log(EventBroadcastHubPubSub)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBroadcastHubPubSub = Layer.effect(EventBroadcastHub, makeEventBroadcastHubPubSub);

/**
 * Default layer - auto-selects based on PUBSUB_PROJECT_ID being set
 *
 * **Example** (Inspect event broadcast hub live)
 *
 * ```ts
 * import { EventBroadcastHubLive } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * console.log(EventBroadcastHubLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBroadcastHubLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* EventBroadcastConfig;
    if (P.isTruthy(config.projectId)) {
      yield* Effect.logInfo("Using Cloud Pub/Sub for event broadcasting");
      return EventBroadcastHubPubSub;
    } else {
      yield* Effect.logInfo("Using in-memory event broadcasting (no PUBSUB_PROJECT_ID)");
      return EventBroadcastHubMemory;
    }
  })
);

// =============================================================================
// WebSocket Handler
// =============================================================================

/**
 * Event Broadcast WebSocket Router
 *
 * **Details**
 *
 * Provides WebSocket endpoint for real-time event streaming:
 * - GET /v1/ontologies/:ontologyId/events/stream - WebSocket upgrade
 *
 * **Example** (Inspect event broadcast router)
 *
 * ```ts
 * import { EventBroadcastRouter } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * console.log(EventBroadcastRouter)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const EventBroadcastRouter = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    "/v1/ontologies/:ontologyId/events/stream",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const ontologyId = params.ontologyId;

      if (P.isUndefined(ontologyId)) {
        return yield* HttpServerResponse.json(
          {
            error: "INVALID_REQUEST",
            message: "Ontology ID is required",
          },
          { status: 400 }
        );
      }

      // Validate ontology exists
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(ontologyId);
      if (O.isNone(entryOpt)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Ontology "${ontologyId}" not found`,
          },
          { status: 404 }
        );
      }

      const request = yield* HttpServerRequest.HttpServerRequest;
      const ticket = O.fromNullishOr(new URL(request.url, "https://localhost").searchParams.get("ticket")).pipe(
        O.filter(Str.isNonEmpty)
      );
      if (O.isNone(ticket)) {
        return yield* HttpServerResponse.json(
          { error: "UNAUTHORIZED", message: "Missing ticket query parameter" },
          { status: 401 }
        );
      }
      const scopedOntologyId = yield* (yield* TicketService).validateTicket(ticket.value);
      if (scopedOntologyId !== ontologyId) {
        return yield* HttpServerResponse.json(
          { error: "FORBIDDEN", message: "Ticket is not scoped to this ontology" },
          { status: 403 }
        );
      }

      const socket = yield* request.upgrade;

      // Handle WebSocket connection
      yield* handleWebSocket(socket, ontologyId).pipe(
        Effect.annotateLogs({ ontologyId, service: "EventBroadcastRouter" })
      );

      return HttpServerResponse.empty();
    }).pipe(
      Effect.catchCause((cause) =>
        Cause.hasInterrupts(cause)
          ? Effect.failCause(cause)
          : Effect.gen(function* () {
              yield* Effect.logError("WebSocket upgrade failed", { cause: Cause.pretty(cause) });
              return yield* HttpServerResponse.json(
                {
                  error: "WEBSOCKET_ERROR",
                  message: "Failed to upgrade connection",
                },
                { status: 500 }
              );
            })
      )
    )
  ),
]);

/**
 * Handle a WebSocket connection for event streaming
 */
const handleWebSocket = Effect.fn("handleWebSocket")(function* (socket: Socket.Socket, ontologyId: string) {
  const hub = yield* EventBroadcastHub;
  const writer = yield* socket.writer;
  const serverId = (yield* Random.nextIntBetween(0, 0x7fffffff)).toString(16);
  const connected: ServerMessage = {
    type: "connected",
    ontologyId,
    serverId,
    timestamp: NonNegativeInt.make(yield* Clock.currentTimeMillis),
  };
  yield* writer(new TextEncoder().encode(yield* encodeServerMessage(connected)));
  yield* Effect.logInfo("WebSocket client connected", { ontologyId });
  const eventQueue = yield* hub.subscribe(ontologyId);
  const fibers = yield* FiberMap.make<string>();
  yield* FiberMap.run(
    fibers,
    "events"
  )(
    Stream.fromSubscription(eventQueue).pipe(
      Stream.tap(
        Effect.fnUntraced(function* (event) {
          const message: ServerMessage = { ...event, type: "event" };
          yield* writer(new TextEncoder().encode(yield* encodeServerMessage(message)));
        })
      ),
      Stream.runDrain
    )
  );
  yield* FiberMap.run(
    fibers,
    "ping"
  )(
    Effect.gen(function* () {
      const ping: ServerMessage = { type: "ping", timestamp: NonNegativeInt.make(yield* Clock.currentTimeMillis) };
      yield* writer(new TextEncoder().encode(yield* encodeServerMessage(ping)));
    }).pipe(Effect.delay("30 seconds"), Effect.forever, Effect.ignore)
  );
  yield* socket.run(() => Effect.void).pipe(Effect.ignore);
  yield* Effect.logInfo("WebSocket client disconnected", { ontologyId });
}, Effect.scoped);

// =============================================================================
// Integration Helper
// =============================================================================

/**
 * Publish a domain event to the broadcast hub
 *
 * **Details**
 *
 * Call this from EventBusService or WorkflowOrchestrator to broadcast events.
 *
 * **Example** (Use broadcastDomainEvent)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { broadcastDomainEvent } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * console.log(Effect.isEffect(broadcastDomainEvent)) // false
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const broadcastDomainEvent = Effect.fn("broadcastDomainEvent")(function* (event: EventEntry) {
  const hub = yield* EventBroadcastHub;
  const ontologyId = event.payload.ontologyId;
  const broadcastEvent: BroadcastEvent = {
    type: "event",
    entry: event,
    ontologyId,
    timestamp: NonNegativeInt.make(yield* Clock.currentTimeMillis),
  };
  yield* hub.broadcast(ontologyId, broadcastEvent);
});
