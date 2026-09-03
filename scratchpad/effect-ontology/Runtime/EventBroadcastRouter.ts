/**
 * WebSocket Event Broadcast Router
 *
 * **Details**
 *
 * Provides real-time event streaming from server to clients.
 * Broadcasts domain events (extractions, curation) to connected WebSocket clients.
 *
 * Events are published to Cloud Pub/Sub via EventBusPubSubBridge. Each server
 * instance subscribes to that topic and fans events out to WebSocket clients on
 * that replica, so the surface scales horizontally with instance count. The
 * server sends JSON envelopes `{ type, event, payload, timestamp }`, periodic
 * pings to keep the connection alive, and ontology-filtered events to each
 * client.
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

const BroadcastEventDefinition = S.Struct({
  type: S.tag("event"),
  entry: OntologyEventEntry,
  ontologyId: OntologyName,
  timestamp: NonNegativeInt,
});

type BroadcastEventCodec = S.Codec<typeof BroadcastEventDefinition.Type, typeof BroadcastEventDefinition.Encoded>;

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
export const BroadcastEvent: BroadcastEventCodec = BroadcastEventDefinition.pipe(
  $I.annoteSchema("BroadcastEvent", {
    description: "Ontology event envelope broadcast to WebSocket clients.",
  })
);

/**
 * Decoded ontology event envelope produced by {@link BroadcastEvent}.
 *
 * @see {@link BroadcastEvent} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type BroadcastEvent = typeof BroadcastEvent.Type;

/**
 * Ping message to keep connection alive
 *
 * **Example** (Construct a ping keep-alive)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Int"
 * import { PingMessage } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const message = PingMessage.make({ timestamp: NonNegativeInt.make(0) })
 * console.log(message.type) // "ping"
 * console.log(message.timestamp) // 0
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
 * **Example** (Construct a connected greeting)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Int"
 * import { ConnectedMessage } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const message = ConnectedMessage.make({
 *   ontologyId: "football",
 *   serverId: "server-1",
 *   timestamp: NonNegativeInt.make(0)
 * })
 * console.log(message.type) // "connected"
 * console.log(message.serverId) // "server-1"
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
 * **Example** (Decode a ping envelope)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Int"
 * import { PingMessage, ServerMessage } from "@effect-ontology/Runtime/EventBroadcastRouter"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ServerMessage)(
 *   PingMessage.make({ timestamp: NonNegativeInt.make(0) })
 * )
 * console.log(O.map(decoded, (message) => message.type))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ServerMessage: S.Codec<BroadcastEvent | PingMessage | ConnectedMessage, unknown> = S.Union([
  BroadcastEvent,
  PingMessage,
  ConnectedMessage,
]).pipe(
  $I.annoteSchema("ServerMessage", {
    description: "Discriminated union of event, ping, and connected envelopes sent to WebSocket clients.",
  })
);

/**
 * Decoded server-to-client envelope produced by {@link ServerMessage}.
 *
 * @see {@link ServerMessage} for the runtime schema and decoding behavior.
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
 * Broadcast, subscribe, and client-count operations implemented by {@link EventBroadcastHub}.
 *
 * @see {@link EventBroadcastHub} for the Context tag and {@link EventBroadcastHubMemory} for local development.
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
 * Context tag for fanning ontology events to WebSocket subscribers.
 *
 * **Example** (Read the local client count)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EventBroadcastHub, EventBroadcastHubMemory } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const count = Effect.runSync(
 *   Effect.gen(function* () {
 *     const hub = yield* EventBroadcastHub
 *     return yield* hub.getClientCount("foaf")
 *   }).pipe(Effect.provide(EventBroadcastHubMemory))
 * )
 * console.log(count) // 0
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
 * Pub/Sub project, topic, and subscription identifiers used by the cloud hub.
 *
 * **Example** (Load default Pub/Sub identifiers)
 *
 * ```ts
 * import { ConfigProvider, Effect } from "effect"
 * import { EventBroadcastConfig } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const config = Effect.runSync(
 *   Effect.provide(
 *     EventBroadcastConfig,
 *     ConfigProvider.layer(ConfigProvider.fromUnknown({}))
 *   )
 * )
 * console.log(config.eventsTopicId) // "ontology-events"
 * ```
 *
 * @category configuration
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
 * **Example** (Provide the in-memory hub)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EventBroadcastHub, EventBroadcastHubMemory } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const count = Effect.runSync(
 *   Effect.succeed(0).pipe(
 *     Effect.flatMap(() =>
 *       Effect.gen(function* () {
 *         const hub = yield* EventBroadcastHub
 *         return yield* hub.getClientCount("foaf")
 *       })
 *     ),
 *     Effect.provide(EventBroadcastHubMemory)
 *   )
 * )
 * console.log(count) // 0
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBroadcastHubMemory = Layer.effect(EventBroadcastHub, makeEventBroadcastHubMemory);

/**
 * Layer for EventBroadcastHub (Cloud Pub/Sub mode - for production)
 *
 * **Example** (Select the cloud Pub/Sub hub)
 *
 * ```ts
 * import { EventBroadcastHubMemory, EventBroadcastHubPubSub } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * console.log(EventBroadcastHubPubSub !== EventBroadcastHubMemory) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBroadcastHubPubSub = Layer.effect(EventBroadcastHub, makeEventBroadcastHubPubSub);

/**
 * Default layer - auto-selects based on PUBSUB_PROJECT_ID being set
 *
 * **Details**
 *
 * Selects Pub/Sub when `PUBSUB_PROJECT_ID` is set; otherwise uses the in-memory hub.
 *
 * **Example** (Auto-select memory versus Pub/Sub)
 *
 * ```ts
 * import { EventBroadcastHubLive, EventBroadcastHubMemory } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * console.log(EventBroadcastHubLive !== EventBroadcastHubMemory) // true
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
 * **Example** (Register the event stream on an HTTP router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter } from "effect/unstable/http"
 * import { EventBroadcastRouter } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const served = Layer.provide(EventBroadcastRouter, HttpRouter.layer)
 * console.log(served !== EventBroadcastRouter) // true
 * ```
 *
 * @category endpoints
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
      Effect.catchCauseIf(
        P.not(Cause.hasInterrupts),
        (cause) =>
          Effect.gen(function* () {
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
 * **Example** (Yield the broadcast effect for a fixture entry)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EventEntry } from "@effect-ontology/Service/EventBus"
 * import { broadcastDomainEvent } from "@effect-ontology/Runtime/EventBroadcastRouter"
 *
 * const entry = O.getOrThrow(
 *   S.decodeUnknownOption(EventEntry)({
 *     id: "evt-claim-corrected-1",
 *     primaryKey: "football:correction:claim-abc123def456",
 *     createdAt: DateTime.makeUnsafe("2026-07-25T12:00:00.000Z"),
 *     event: "ClaimCorrected",
 *     payload: {
 *       ontologyId: "football",
 *       originalClaimId: "claim-abc123def456",
 *       newClaimId: "claim-def456abc123",
 *       correctionId: "corr-1",
 *       timestamp: "2026-07-25T12:00:00.000Z"
 *     }
 *   })
 * )
 * const program = broadcastDomainEvent(entry)
 * console.log(entry.payload.ontologyId) // "football"
 * console.log(program)
 * ```
 *
 * @category handlers
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
