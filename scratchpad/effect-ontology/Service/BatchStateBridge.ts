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
 * @since 2.0.0
 * @module Service/BatchStateBridge
 */

import { Context, Effect, Fiber, Layer, Stream } from "effect"
import type { BatchState } from "../Domain/Model/BatchWorkflow.ts"
import { broadcastDomainEvent } from "../Runtime/EventBroadcastRouter.ts"
import { BatchStateHub } from "./BatchState.ts"
import { $ScratchpadId } from "@beep/identity";
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
 * @since 2.0.0
 */
export interface BatchStateBridge {
  /**
   * Get the current status of the bridge fiber
   */
  readonly isRunning: Effect.Effect<boolean>
}

export const BatchStateBridge = Context.Service<BatchStateBridge>($I`BatchStateBridge`)

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
  ...getStageDetails(state)
})

/**
 * Extract stage-specific details for the broadcast payload
 */
const getStageDetails = (state: BatchState): Record<string, unknown> => {
  switch (state._tag) {
    case "Pending":
      return { documentCount: state.documentCount }

    case "Preprocessing":
      return {
        documentsTotal: state.documentsTotal,
        documentsClassified: state.documentsClassified,
        documentsFailed: state.documentsFailed,
        enrichedManifestUri: state.enrichedManifestUri
      }

    case "Extracting":
      return {
        documentsTotal: state.documentsTotal,
        documentsCompleted: state.documentsCompleted,
        documentsFailed: state.documentsFailed,
        currentDocumentId: state.currentDocumentId,
        progress: state.documentsTotal > 0
          ? Math.round((state.documentsCompleted / state.documentsTotal) * 100)
          : 0
      }

    case "Resolving":
      return {
        extractionOutputUri: state.extractionOutputUri,
        entitiesTotal: state.entitiesTotal,
        clustersFormed: state.clustersFormed
      }

    case "Validating":
      return {
        resolvedGraphUri: state.resolvedGraphUri,
        validationStartedAt: state.validationStartedAt.toString()
      }

    case "Ingesting":
      return {
        validatedGraphUri: state.validatedGraphUri,
        triplesTotal: state.triplesTotal,
        triplesIngested: state.triplesIngested,
        progress: state.triplesTotal > 0
          ? Math.round((state.triplesIngested / state.triplesTotal) * 100)
          : 0
      }

    case "Complete":
      return {
        canonicalGraphUri: state.canonicalGraphUri,
        stats: state.stats,
        completedAt: state.completedAt.toString()
      }

    case "Failed":
      return {
        failedAt: state.failedAt.toString(),
        failedInStage: state.failedInStage,
        error: state.error,
        lastSuccessfulStage: state.lastSuccessfulStage
      }

    default:
      return {}
  }
}

/**
 * Create the BatchStateBridge service
 *
 * Subscribes to BatchStateHub and broadcasts state changes to EventBroadcastHub.
 * The bridge runs as a background fiber and is automatically cleaned up when
 * the service scope closes.
 */
const makeBatchStateBridge = Effect.gen(function*() {
  const batchStateHub = yield* BatchStateHub

  // Subscribe to batch state changes
  const subscription = yield* batchStateHub.subscribe

  // Track running status
  let running = true

  // Start background fiber to bridge states to events
  const fiber = yield* Stream.fromQueue(subscription).pipe(
    Stream.tap(
      Effect.fn(function*(state)  {
        yield* Effect.logDebug("Bridging batch state to WebSocket", {
          batchId: state.batchId,
          ontologyId: state.ontologyId,
          stage: state._tag
        })

        yield* broadcastDomainEvent(state.ontologyId, {
          event: "BatchStateChanged",
          primaryKey: `batch:${state.batchId}`,
          payload: toBroadcastPayload(state)
        })
      })
    ),
    Stream.runDrain,
    Effect.catch((error) => Effect.logError("BatchStateBridge error", { error: String(error) })),
    Effect.forkChild
  )

  // Cleanup on scope close
  yield* Effect.addFinalizer(
    Effect.fn(function*() {
      running = false
      yield* Fiber.interrupt(fiber)
      yield* Effect.logInfo("BatchStateBridge stopped")
    }, Effect.orDie)
  )

  yield* Effect.logInfo("BatchStateBridge started")

  return BatchStateBridge.of({
    isRunning: Effect.succeed(running)
  })
})

// =============================================================================
// Layer
// =============================================================================

/**
 * Layer for BatchStateBridge
 *
 * Requires BatchStateHub and EventBroadcastHub to be provided.
 * Runs as a scoped service - the bridge fiber is cleaned up when the layer scope closes.
 *
 * @example
 * ```ts
 * const AppLayer = Layer.mergeAll(
 *   BatchStateHubLayer,
 *   EventBroadcastHubMemory,
 *   BatchStateBridgeLive
 * )
 * ```
 *
 * @since 2.0.0
 */
export const BatchStateBridgeLive = Layer.effect(BatchStateBridge, makeBatchStateBridge)

/**
 * Default layer (alias for BatchStateBridgeLive)
 *
 * @since 2.0.0
 */
export const BatchStateBridgeDefault = BatchStateBridgeLive
