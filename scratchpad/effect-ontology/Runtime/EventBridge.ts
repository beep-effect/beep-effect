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
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { Cause, Context, Duration, Effect, Fiber, Layer, Schedule, Stream } from "effect";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
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
  readonly start: Effect.Effect<
    {
      readonly await: Effect.Effect<void, EventBridgeError>;
      readonly stop: Effect.Effect<void>;
    },
    EventBridgeError,
    Scope.Scope
  >;
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
 * Typed setup or runtime failure from the EventBus-to-websocket bridge.
 *
 * **Example** (Inspect the typed event bridge failure)
 * ```ts
 * import { EventBridgeError } from "@effect-ontology/Runtime/EventBridge"
 * console.log(EventBridgeError.make)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EventBridgeError extends S.TaggedError<EventBridgeError>($I`EventBridgeError`)(
  "EventBridgeError",
  {
    phase: LiteralKit(["setup", "runtime"]),
    message: S.NonEmptyString,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("EventBridgeError", {
    description: "Typed event-bridge failure preserving whether setup or stream execution failed.",
  })
) {}

const bridgeRetrySchedule = Schedule.max([Schedule.exponential(Duration.millis(100)), Schedule.recurs(3)]);

/**
 * Create the EventBridge service
 */
const makeEventBridge = Effect.gen(function* () {
  const eventBus = yield* EventBusService;
  const broadcastHub = yield* EventBroadcastHub;

  const start = Effect.gen(function* () {
    yield* Effect.logInfo("EventBridge starting");
    const eventStream = yield* eventBus.subscribeEvents.pipe(
      Effect.mapError((cause) =>
        EventBridgeError.make({ phase: "setup", message: "Failed to subscribe to ontology events.", cause })
      )
    );
    const run = eventStream.pipe(
      Stream.runForEach((entry) =>
        Effect.gen(function* () {
          const ontologyId = entry.payload.ontologyId;
          const broadcastEvent: BroadcastEvent = {
            type: "event",
            entry,
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
      Effect.catchCause((cause) =>
        Effect.fail(
          EventBridgeError.make({
            phase: "runtime",
            message: "Ontology event stream terminated.",
            cause: Cause.squash(cause),
          })
        )
      ),
      Effect.tapError((error) => Effect.logError("EventBridge stream failed", { error })),
      Effect.retry(bridgeRetrySchedule)
    );
    const fiber = yield* Effect.forkScoped(run);
    yield* Effect.logInfo("EventBridge started");
    return {
      await: Fiber.join(fiber),
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

    yield* Effect.addFinalizer(() => handle.stop);

    return bridge;
  })
);
