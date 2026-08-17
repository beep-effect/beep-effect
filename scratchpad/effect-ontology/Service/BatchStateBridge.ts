/**
 * Batch State Bridge Service
 *
 * **Details**
 *
 * Bridges BatchStateHub updates into the canonical extraction EventLog group.
 * EventBridge then forwards the validated journal entries to WebSocket clients.
 *
 * Architecture:
 * ```
 * WorkflowOrchestrator → publishState() → BatchStateHub (PubSub)
 *                                              ↓
 *                                    BatchStateBridge (this service)
 *                                              ↓
 *                              EventBusService.publishExtractionEvent()
 *                                              ↓
 *                              EventBridge → EventBroadcastHub
 *                                              ↓
 *                                    WebSocket clients
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Cause, Context, Effect, Exit, Layer, PubSub, Ref, Stream } from "effect";
import { OntologyName } from "../Domain/Identity.ts";
import { BatchStateHub } from "./BatchState.ts";
import { EventBusService } from "./EventBus.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/BatchStateBridge");

// =============================================================================
// Service Interface
// =============================================================================

/**
 * BatchStateBridge service
 *
 * **Details**
 *
 * Manages the background fiber that bridges BatchStateHub to EventBroadcastHub.
 * The bridge starts automatically when the service is created and runs until
 * the scope is closed.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface BatchStateBridgeShape {
  /**
   * Get the current status of the bridge fiber
   */
  readonly isRunning: Effect.Effect<boolean>;
}

/**
 * Provides the batch state bridge service capability.
 *
 * **Example** (Inspect batch state bridge)
 *
 * ```ts
 * import { BatchStateBridge } from "@effect-ontology/Service/BatchStateBridge"
 *
 * console.log(BatchStateBridge)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BatchStateBridge extends Context.Service<BatchStateBridge, BatchStateBridgeShape>()(
  $I`BatchStateBridge`
) {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create the BatchStateBridge service
 *
 * Subscribes to BatchStateHub and publishes canonical BatchStateChanged events.
 * The bridge runs as a background fiber and is automatically cleaned up when
 * the service scope closes.
 */
const makeBatchStateBridge = Effect.gen(function* () {
  const batchStateHub = yield* BatchStateHub;
  const eventBus = yield* EventBusService;
  const subscription = yield* PubSub.subscribe(batchStateHub);
  const running = yield* Ref.make(true);
  const bridge = Stream.fromSubscription(subscription).pipe(
    Stream.tap(
      Effect.fn("BatchStateBridge.publishStateChanged")(function* (state) {
        const ontologyId = yield* OntologyName.decodeEffect(state.ontologyId);
        yield* Effect.logDebug("Publishing canonical batch state event", {
          batchId: state.batchId,
          ontologyId,
          stage: state._tag,
        });
        yield* eventBus.publishExtractionEvent("BatchStateChanged", {
          batchId: state.batchId,
          ontologyId,
          state,
          timestamp: state.updatedAt,
        });
      })
    ),
    Stream.runDrain,
    Effect.onExit((exit) =>
      Exit.match(exit, {
        onSuccess: () => Effect.logInfo("BatchStateBridge stream completed"),
        onFailure: (cause) => {
          if (Cause.hasInterruptsOnly(cause)) {
            return Effect.logInfo("BatchStateBridge stopped");
          }
          return Effect.logError("BatchStateBridge failed", {
            cause: Cause.pretty(cause),
          });
        },
      })
    ),
    Effect.ensuring(Ref.set(running, false))
  );
  yield* Effect.forkScoped(bridge);
  yield* Effect.logInfo("BatchStateBridge started");
  return BatchStateBridge.of({
    isRunning: Ref.get(running),
  });
});

// =============================================================================
// Layer
// =============================================================================

/**
 * Layer for BatchStateBridge
 *
 * **Details**
 *
 * Requires BatchStateHub and EventBusService to be provided.
 * Runs as a scoped service - the bridge fiber is cleaned up when the layer scope closes.
 *
 * **Example** (Use BatchStateBridgeLive)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { BatchStateBridgeLive } from "@effect-ontology/Service/BatchStateBridge"
 *
 * console.log(Layer.isLayer(BatchStateBridgeLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BatchStateBridgeLive = Layer.effect(BatchStateBridge, makeBatchStateBridge);

/**
 * Default layer (alias for BatchStateBridgeLive)
 *
 * **Example** (Inspect batch state bridge default)
 *
 * ```ts
 * import { BatchStateBridgeDefault } from "@effect-ontology/Service/BatchStateBridge"
 *
 * console.log(BatchStateBridgeDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BatchStateBridgeDefault = BatchStateBridgeLive;
