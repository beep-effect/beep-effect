/**
 * Event Bridge Service
 *
 * **Details**
 *
 * Bridges EventBusService events to EventBroadcastHub for WebSocket streaming.
 * Runs as a background fiber that subscribes to EventBusService and broadcasts
 * events to connected WebSocket clients.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
import { Context, Effect, Fiber, Layer, Stream } from "effect";
import * as O from "effect/Option";
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
 * **Details**
 *
 * Provides methods to start/stop the bridge between EventBusService and EventBroadcastHub
 *
 *
 * **Example** (Use the EventBridgeServiceMethods contract)
 *
 * ```ts
 * import type { EventBridgeServiceMethods } from "@effect-ontology/Runtime/EventBridge"
 *
 * const acceptsEventBridgeServiceMethods = (_value: EventBridgeServiceMethods): void => undefined
 *
 * console.log(acceptsEventBridgeServiceMethods)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EventBridgeServiceMethods {
  /**
   * Start the bridge (runs as background fiber)
   * Returns a handle to stop the bridge
   */
  readonly start: Effect.Effect<{ stop: Effect.Effect<void> }>;
}

const $I = $ScratchpadId.create("effect-ontology/Runtime/EventBridge");

/**
 * Provides the event bridge service service capability.
 *
 * **Example** (Inspect event bridge service)
 *
 * ```ts
 * import { EventBridgeService } from "@effect-ontology/Runtime/EventBridge"
 *
 * console.log(EventBridgeService)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EventBridgeService extends Context.Service<EventBridgeService, EventBridgeServiceMethods>()(
  $I`EventBridgeService`
) {}

/**
 * Extract ontologyId from event payload
 */
const extractOntologyId = (payload: unknown): O.Option<string> =>
  P.hasProperty(payload, "ontologyId") && P.isString(payload.ontologyId) ? O.some(payload.ontologyId) : O.none();

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
          if (O.isNone(ontologyId)) {
            yield* Effect.logDebug("Event skipped: no ontologyId", { event: entry.event });
            return;
          }
          const broadcastEvent: BroadcastEvent = {
            type: "event",
            id: entry.id,
            event: entry.event,
            primaryKey: entry.primaryKey,
            payload: entry.payload,
            ontologyId: ontologyId.value,
            timestamp: NonNegativeInt.make(entry.createdAt.epochMilliseconds),
          };
          yield* broadcastHub.broadcast(ontologyId.value, broadcastEvent);
          yield* Effect.logDebug("Event bridged to WebSocket", {
            event: entry.event,
            ontologyId: ontologyId.value,
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
 * **Details**
 *
 * Requires EventBusService and EventBroadcastHub
 *
 * **Example** (Inspect event bridge live)
 *
 * ```ts
 * import { EventBridgeLive } from "@effect-ontology/Runtime/EventBridge"
 *
 * console.log(EventBridgeLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EventBridgeLive = Layer.effect(EventBridgeService, makeEventBridge);

/**
 * Auto-starting EventBridge layer
 *
 * **Details**
 *
 * Automatically starts the bridge when the layer is acquired.
 * Stops when the layer scope closes.
 *
 * **Example** (Inspect event bridge auto start)
 *
 * ```ts
 * import { EventBridgeAutoStart } from "@effect-ontology/Runtime/EventBridge"
 *
 * console.log(EventBridgeAutoStart)
 * ```
 *
 * @category layers
 * @since 0.0.0
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
