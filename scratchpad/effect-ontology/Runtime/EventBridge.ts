/**
 * Event Bridge Service
 *
 * Bridges EventBusService events to EventBroadcastHub for WebSocket streaming.
 * Runs as a background fiber that subscribes to EventBusService and broadcasts
 * events to connected WebSocket clients.
 *
 * @since 2.0.0
 * @module Runtime/EventBridge
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
import { Context, Effect, Fiber, Layer, Stream } from "effect";
import * as P from "effect/Predicate";
import { EventBusService } from "../Service/EventBus.ts";
import type { BroadcastEvent } from "./EventBroadcastRouter.ts";
import { EventBroadcastHub } from "./EventBroadcastRouter.ts";

// =============================================================================
// Event Bridge Service
// =============================================================================

/**
 * EventBridge service interface
 *
 * Provides methods to start/stop the bridge between EventBusService and EventBroadcastHub
 *
 * @since 2.0.0
 */
export interface EventBridgeServiceMethods {
  /**
   * Start the bridge (runs as background fiber)
   * Returns a handle to stop the bridge
   */
  readonly start: Effect.Effect<{ stop: Effect.Effect<void> }>;
}

const $I = $ScratchpadId.create("effect-ontology/Runtime/EventBridge");

export class EventBridgeService extends Context.Service<EventBridgeService, EventBridgeServiceMethods>()(
  $I`EventBridgeService`
) {}

/**
 * Extract ontologyId from event payload
 */
const extractOntologyId = (payload: unknown): string | null => {
  if (P.isNotNullish(payload) && typeof payload === "object" && "ontologyId" in payload) {
    const val = (payload as { ontologyId: unknown }).ontologyId;
    return typeof val === "string" ? val : null;
  }
  return null;
};

/**
 * Create the EventBridge service
 */
const makeEventBridge = Effect.gen(function* () {
  const eventBus = yield* EventBusService;
  const broadcastHub = yield* EventBroadcastHub;

  const start = Effect.gen(function* () {
    yield* Effect.logInfo("EventBridge starting");
    const eventStream = yield* eventBus.subscribeEvents.pipe(Effect.orDie);
    const fiber = yield* eventStream.pipe(
      Stream.tap((entry) =>
        Effect.gen(function* () {
          const ontologyId = extractOntologyId(entry.payload);
          if (P.isNull(ontologyId)) {
            yield* Effect.logDebug("Event skipped: no ontologyId", { event: entry.event });
            return;
          }
          const broadcastEvent: BroadcastEvent = {
            type: "event",
            id: entry.id,
            event: entry.event,
            primaryKey: entry.primaryKey,
            payload: entry.payload,
            ontologyId,
            timestamp: NonNegativeInt.make(entry.createdAt.epochMilliseconds),
          };
          yield* broadcastHub.broadcast(ontologyId, broadcastEvent);
          yield* Effect.logDebug("Event bridged to WebSocket", {
            event: entry.event,
            ontologyId,
            primaryKey: entry.primaryKey,
          });
        })
      ),
      Stream.runDrain,
      Effect.catch((error) => Effect.logError("EventBridge stream error", { error: String(error) })),
      Effect.forkChild
    );
    yield* Effect.logInfo("EventBridge started");
    return {
      stop: Effect.gen(function* () {
        yield* Fiber.interrupt(fiber);
        yield* Effect.logInfo("EventBridge stopped");
      }).pipe(Effect.ignore),
    };
  });

  return EventBridgeService.of({
    start,
  });
});

/**
 * EventBridge layer
 *
 * Requires EventBusService and EventBroadcastHub
 *
 * @since 2.0.0
 */
export const EventBridgeLive = Layer.effect(EventBridgeService, makeEventBridge);

/**
 * Auto-starting EventBridge layer
 *
 * Automatically starts the bridge when the layer is acquired.
 * Stops when the layer scope closes.
 *
 * @since 2.0.0
 */
export const EventBridgeAutoStart = Layer.effect(
  EventBridgeService,
  Effect.gen(function* () {
    const bridge = yield* makeEventBridge;
    const handle = yield* bridge.start;

    // Stop on scope finalization
    yield* Effect.addFinalizer(() => handle.stop.pipe(Effect.ignore));

    return bridge;
  })
);
