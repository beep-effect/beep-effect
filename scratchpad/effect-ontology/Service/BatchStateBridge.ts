/**
 * Batch State Bridge Service
 *
 * Bridges BatchStateHub (internal state changes) to EventBroadcastHub (WebSocket clients).
 * This unifies batch state updates with the WebSocket event stream, allowing the frontend
 * to receive all updates (batch states, extraction events, curation events) through a
 * single WebSocket connection.
 *
 * Architecture:
 * ```
 * WorkflowOrchestrator → publishState() → BatchStateHub (PubSub)
 *                                              ↓
 *                                    BatchStateBridge (this service)
 *                                              ↓
 *                               EventBroadcastHub.broadcast()
 *                                              ↓
 *                                    WebSocket clients
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, Fiber, Layer, PubSub, Stream } from "effect";
import { BatchState } from "../Domain/Model/BatchWorkflow.ts";
import { broadcastDomainEvent } from "../Runtime/EventBroadcastRouter.ts";
import { BatchStateHub } from "./BatchState.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/BatchStateBridge");

// =============================================================================
// Service Interface
// =============================================================================

/**
 * BatchStateBridge service
 *
 * Manages the background fiber that bridges BatchStateHub to EventBroadcastHub.
 * The bridge starts automatically when the service is created and runs until
 * the scope is closed.
 *
 * @since 0.0.0
 */
export interface BatchStateBridgeShape {
  /**
   * Get the current status of the bridge fiber
   */
  readonly isRunning: Effect.Effect<boolean>;
}

export class BatchStateBridge extends Context.Service<BatchStateBridge, BatchStateBridgeShape>()($I `BatchStateBridge`) {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Convert a BatchState to a BroadcastEvent payload
 */
const toBroadcastPayload = (state: BatchState) => ({
  batchId: state.batchId,
  ontologyId: state.ontologyId,
  stage: state._tag,
  manifestUri: state.manifestUri,
  ontologyVersion: state.ontologyVersion,
  createdAt: state.createdAt.toString(),
  updatedAt: state.updatedAt.toString(),
  // Include stage-specific details
  ...getStageDetails(state),
});

/**
 * Extract stage-specific details for the broadcast payload
 */
const getStageDetails = (state: BatchState): Record<string, unknown> =>
  BatchState.match(state, {
    Pending: ({ documentCount }): Record<string, unknown> => ({ documentCount }),
    Preprocessing: ({ documentsClassified, documentsFailed, documentsTotal, enrichedManifestUri }): Record<
      string,
      unknown
    > => ({
      documentsTotal,
      documentsClassified,
      documentsFailed,
      enrichedManifestUri,
    }),
    Extracting: ({ currentDocumentId, documentsCompleted, documentsFailed, documentsTotal }): Record<
      string,
      unknown
    > => ({
      documentsTotal,
      documentsCompleted,
      documentsFailed,
      currentDocumentId,
      progress: documentsTotal > 0 ? Math.round((documentsCompleted / documentsTotal) * 100) : 0,
    }),
    Resolving: ({ clustersFormed, entitiesTotal, extractionOutputUri }): Record<string, unknown> => ({
      extractionOutputUri,
      entitiesTotal,
      clustersFormed,
    }),
    Validating: ({ resolvedGraphUri, validationStartedAt }): Record<string, unknown> => ({
      resolvedGraphUri,
      validationStartedAt: validationStartedAt.toString(),
    }),
    Ingesting: ({ triplesIngested, triplesTotal, validatedGraphUri }): Record<string, unknown> => ({
      validatedGraphUri,
      triplesTotal,
      triplesIngested,
      progress: triplesTotal > 0 ? Math.round((triplesIngested / triplesTotal) * 100) : 0,
    }),
    Complete: ({ canonicalGraphUri, completedAt, stats }): Record<string, unknown> => ({
      canonicalGraphUri,
      stats,
      completedAt: completedAt.toString(),
    }),
    Failed: ({ error, failedAt, failedInStage, lastSuccessfulStage }): Record<string, unknown> => ({
      failedAt: failedAt.toString(),
      failedInStage,
      error,
      lastSuccessfulStage,
    }),
  });

/**
 * Create the BatchStateBridge service
 *
 * Subscribes to BatchStateHub and broadcasts state changes to EventBroadcastHub.
 * The bridge runs as a background fiber and is automatically cleaned up when
 * the service scope closes.
 */
const makeBatchStateBridge = Effect.gen(function* () {
  const batchStateHub = yield* BatchStateHub;
  const subscription = yield* PubSub.subscribe(batchStateHub);
  let running = true;
  const fiber = yield* Stream.fromSubscription(subscription).pipe(
    Stream.tap(
      Effect.fn("BatchStateBridge.broadcastState")(function* (state) {
        yield* Effect.logDebug("Bridging batch state to WebSocket", {
          batchId: state.batchId,
          ontologyId: state.ontologyId,
          stage: state._tag,
        });
        yield* broadcastDomainEvent(state.ontologyId, {
          event: "BatchStateChanged",
          primaryKey: `batch:${state.batchId}`,
          payload: toBroadcastPayload(state),
        });
      })
    ),
    Stream.runDrain,
    Effect.forkChild
  );
  yield* Effect.addFinalizer(
    Effect.fn("BatchStateBridge.finalize")(function* () {
      running = false;
      yield* Fiber.interrupt(fiber);
      yield* Effect.logInfo("BatchStateBridge stopped");
    }, Effect.orDie)
  );
  yield* Effect.logInfo("BatchStateBridge started");
  return BatchStateBridge.of({
    isRunning: Effect.succeed(running),
  });
});

// =============================================================================
// Layer
// =============================================================================

/**
 * Layer for BatchStateBridge
 *
 * Requires BatchStateHub and EventBroadcastHub to be provided.
 * Runs as a scoped service - the bridge fiber is cleaned up when the layer scope closes.
 *
 * **Example** (Use BatchStateBridgeLive)
 * ```ts
 * const AppLayer = Layer.mergeAll(
 *   BatchStateHubLayer,
 *   EventBroadcastHubMemory,
 *   BatchStateBridgeLive
 * )
 * ```
 *
 * @since 0.0.0
 */
export const BatchStateBridgeLive = Layer.effect(BatchStateBridge, makeBatchStateBridge);

/**
 * Default layer (alias for BatchStateBridgeLive)
 *
 * @since 0.0.0
 */
export const BatchStateBridgeDefault = BatchStateBridgeLive;
