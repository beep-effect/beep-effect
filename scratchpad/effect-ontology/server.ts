/**
 * HTTP Server Entry Point (MVP)
 *
 * **Details**
 *
 * Starts the extraction API server with all production layers.
 * Use for cloud deployment (Cloud Run, etc.)
 *
 * Environment variables:
 * - PORT: Server port (default: 8080)
 * - POSTGRES_HOST: PostgreSQL host (enables durable workflows)
 * - All EnvConfigService variables (see DEPLOY.md)
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunHttpServer, BunRuntime, BunServices } from "@effect/platform-bun";
import { Config, Effect, Layer } from "effect";
import * as O from "effect/Option";
import { ClusterWorkflowEngine, SingleRunner } from "effect/unstable/cluster";
import { WorkflowEngine } from "effect/unstable/workflow";
import { ArticleRepository } from "./Repository/Article.ts";
import { CachedArticleRepository } from "./Repository/CachedArticle.ts";
import { CachedClaimRepository } from "./Repository/CachedClaim.ts";
import { ClaimRepository } from "./Repository/Claim.ts";
import { EventBridgeAutoStart } from "./Runtime/EventBridge.ts";
import { EventBroadcastHubLive } from "./Runtime/EventBroadcastRouter.ts";
import { HealthCheckService } from "./Runtime/HealthCheck.ts";
import { HttpServerLive, HttpServerWithoutRepositoriesLive } from "./Runtime/HttpServer.ts";
import { InferenceJobStoreLive } from "./Runtime/InferenceRouter.ts";
import { DatabaseReadyLive, PgClientLive } from "./Runtime/Persistence/PostgresLayer.ts";
import { ShutdownService } from "./Runtime/Shutdown.ts";
import { ActivityDependenciesLayer, WorkflowOrchestratorFullLayer } from "./Runtime/WorkflowLayers.ts";
import { BatchStateHubLayer, BatchStatePersistenceLayer } from "./Service/BatchState.ts";
import { BatchStateBridgeLive } from "./Service/BatchStateBridge.ts";
import { ClaimPersistenceService } from "./Service/ClaimPersistence.ts";
import { ContentEnrichmentAgent } from "./Service/ContentEnrichmentAgent.ts";
import { PersistentEmbeddingCache } from "./Service/EmbeddingCache.ts";
import { PersistentEntityIndex } from "./Service/EntityIndex.ts";
import { ImageBlobStore } from "./Service/ImageBlobStore.ts";
import { ImageExtractor } from "./Service/ImageExtractor.ts";
import { ImageFetcher } from "./Service/ImageFetcher.ts";
import { ImageStore } from "./Service/ImageStore.ts";
import { JinaReaderClient } from "./Service/JinaReaderClient.ts";
import { LinkIngestionService } from "./Service/LinkIngestionService.ts";
import { TicketService } from "./Service/Ticket.ts";

// Load port from environment
const port = Effect.runSync(Config.number("PORT").pipe(Config.withDefault(8080)));

// Check if PostgreSQL is configured
const postgresHost = Effect.runSync(Config.string("POSTGRES_HOST").pipe(Config.option));
const usePostgres = O.isSome(postgresHost);

// Check if repository caching is enabled (default: true in production)
const useCaching = Effect.runSync(Config.boolean("ENABLE_REPO_CACHING").pipe(Config.withDefault(true)));

// Base platform layer (provides FileSystem, Path, etc.)
const PlatformLayer = BunServices.layer;

// Durable WorkflowEngine backed by PostgreSQL via @effect/cluster
// SingleRunner with SQL storage enables durable execution with crash recovery
const ClusterWorkflowEngineLive = ClusterWorkflowEngine.layer.pipe(
  Layer.provideMerge(
    SingleRunner.layer({
      runnerStorage: "sql", // Use SQL-backed runner storage for durability
    })
  ),
  Layer.provideMerge(PgClientLive)
);

// Select workflow engine based on PostgreSQL availability
// - With POSTGRES_HOST: Use ClusterWorkflowEngine for durable workflows
// - Without: Use in-memory engine (development only, no crash recovery)
const WorkflowEngineLive = usePostgres ? ClusterWorkflowEngineLive : WorkflowEngine.layerMemory;

// Pre-compose WorkflowOrchestrator with all its dependencies
// Workflow layer has dependencies provided before construction (see WorkflowLayers)
const WorkflowOrchestratorWithDependencies = WorkflowOrchestratorFullLayer.pipe(
  Layer.provideMerge(WorkflowEngineLive),
  Layer.provideMerge(PlatformLayer)
);

// =============================================================================
// Server Layer Composition
// =============================================================================
// Several layers need ConfigService and StorageService from ActivityDependenciesLayer.
// Pre-compose layers that have dependencies on ActivityDependenciesLayer.

// BatchStatePersistenceLayer needs StorageService
const BatchStatePersistenceWithDeps = BatchStatePersistenceLayer.pipe(
  Layer.provideMerge(ActivityDependenciesLayer),
  Layer.provideMerge(PlatformLayer)
);

// HealthCheckService needs ConfigService and StorageService
const HealthCheckWithDeps = HealthCheckService.Default.pipe(
  Layer.provideMerge(ActivityDependenciesLayer),
  Layer.provideMerge(PlatformLayer)
);

// Repository layers (when PostgreSQL is configured)
// PgDrizzle layer provides drizzle ORM access over PgClient
// Base repositories bundle - ClaimRepository + ArticleRepository
const BaseRepositoriesLayer = Layer.mergeAll(ClaimRepository.Default, ArticleRepository.Default).pipe(
  Layer.provideMerge(DatabaseReadyLive)
);

// Cached repositories layer (wraps base repositories with Effect.Cache)
const CachedRepositoriesLayer = Layer.mergeAll(CachedClaimRepository.Default, CachedArticleRepository.Default).pipe(
  Layer.provideMerge(BaseRepositoriesLayer)
);

// Combined repositories layer
// When caching is enabled, provides both base and cached repos
// When disabled, provides only base repos
const RepositoriesLayer = useCaching
  ? Layer.mergeAll(BaseRepositoriesLayer, CachedRepositoriesLayer)
  : BaseRepositoriesLayer;

// ClaimPersistenceService layer (depends on repositories)
const ClaimPersistenceLayer = usePostgres
  ? ClaimPersistenceService.Default.pipe(Layer.provideMerge(RepositoriesLayer))
  : Layer.empty; // No persistence without PostgreSQL

// LinkIngestionService layer (depends on Drizzle, Storage, LLM, Jina, Image services)
// Only available with PostgreSQL
const ImageServicesLayer = ImageStore.Live.pipe(
  Layer.provideMerge(ImageBlobStore.Live),
  Layer.provideMerge(ActivityDependenciesLayer)
);

const PostgresLinkIngestionLayer = LinkIngestionService.Default.pipe(
  Layer.provideMerge(ContentEnrichmentAgent.Default),
  Layer.provideMerge(JinaReaderClient.Default),
  Layer.provideMerge(ImageExtractor.Default),
  Layer.provideMerge(ImageFetcher.Default),
  Layer.provideMerge(ImageServicesLayer),
  Layer.provideMerge(DatabaseReadyLive)
);

const LinkIngestionLayer = usePostgres ? PostgresLinkIngestionLayer : LinkIngestionService.Disabled;

const RepositoryBackedHttpServerLive = HttpServerLive.pipe(Layer.provideMerge(RepositoriesLayer));
const SelectedHttpServerLive = usePostgres ? RepositoryBackedHttpServerLive : HttpServerWithoutRepositoriesLive;

// EventLogServer.Storage layer for WebSocket event streaming
// Uses PostgreSQL for persistence when available, otherwise in-memory

// Uses Layer.provideMerge throughout for order-independent composition.
// Later provideMerge layers PROVIDE to earlier layers in the chain.
const ServerLive = SelectedHttpServerLive.pipe(
  Layer.provideMerge(InferenceJobStoreLive),
  Layer.provideMerge(BunHttpServer.layer({ port, idleTimeout: 255 })), // Bun max is 255s (Cloud Run uses longer timeouts via nginx)
  Layer.provideMerge(WorkflowEngineLive),
  Layer.provideMerge(WorkflowOrchestratorWithDependencies),
  Layer.provideMerge(BatchStateBridgeLive), // Bridge BatchStateHub → EventBroadcastHub for WebSocket
  Layer.provideMerge(BatchStateHubLayer),
  Layer.provideMerge(BatchStatePersistenceWithDeps),
  Layer.provideMerge(HealthCheckWithDeps),
  Layer.provideMerge(ClaimPersistenceLayer), // ClaimPersistenceService (for activity persistence)
  Layer.provideMerge(LinkIngestionLayer), // LinkIngestionService for URL ingestion
  Layer.provideMerge(ImageServicesLayer), // ImageBlobStore + ImageStore for image routes
  Layer.provideMerge(EventBridgeAutoStart), // Bridges EventBusService → EventBroadcastHub (needs both below)
  Layer.provideMerge(EventBroadcastHubLive), // EventBroadcastHub for real-time WebSocket events
  Layer.provideMerge(TicketService.Default), // TicketService for WebSocket authentication
  Layer.provideMerge(ActivityDependenciesLayer), // EventBusService + other activity deps
  Layer.provideMerge(PlatformLayer)
);

// Warm up caches from GCS (if configured)
const warmUpCaches = Effect.gen(function* () {
  // Warm up embedding cache
  const embeddingCacheOpt = yield* Effect.serviceOption(PersistentEmbeddingCache);
  if (O.isSome(embeddingCacheOpt)) {
    const loaded = yield* embeddingCacheOpt.value.warmUp;
    if (loaded > 0) {
      yield* Effect.logInfo("Embedding cache warmed up", { embeddingsLoaded: loaded });
    }
  }

  // Warm up entity index
  const entityIndexOpt = yield* Effect.serviceOption(PersistentEntityIndex);
  if (O.isSome(entityIndexOpt)) {
    const loaded = yield* entityIndexOpt.value.load;
    if (loaded > 0) {
      yield* Effect.logInfo("Entity index loaded from GCS", { entitiesLoaded: loaded });
    }
  }
});

// Server program with graceful shutdown
const server = Effect.gen(function* () {
  const shutdown = yield* ShutdownService;

  yield* Effect.logInfo(
    usePostgres
      ? "PostgreSQL workflow engine enabled (durable workflows)"
      : "Using in-memory workflow engine (no POSTGRES_HOST configured)"
  );
  yield* Effect.logInfo(
    usePostgres ? "EventLog storage: PostgreSQL (persistent)" : "EventLog storage: Memory (events lost on restart)"
  );
  if (usePostgres) {
    yield* Effect.logInfo(`Repository caching: ${useCaching ? "enabled" : "disabled"}`);
  }

  // Warm up caches from GCS (runs in background, doesn't block startup)
  yield* Effect.forkDetach(warmUpCaches);

  yield* Effect.logInfo(`Server starting on port ${port}`);
  yield* Layer.build(ServerLive);

  // BunRuntime.runMain owns SIGINT/SIGTERM handling and interrupts this main
  // fiber. Keep the server layer in the surrounding scope so request draining
  // completes before its resources are released.
  return yield* Effect.never.pipe(
    Effect.onInterrupt(
      Effect.fnUntraced(function* () {
        yield* Effect.logInfo("Received termination signal, initiating graceful shutdown");
        yield* shutdown.initiateShutdown;
        yield* shutdown.drain;
        yield* Effect.logInfo("Graceful shutdown complete");
      })
    )
  );
});

// One ShutdownService instance: SIGTERM drain and HTTP middleware share the same
// in-flight counter. ServerLive must not construct a second Default.
const main = Effect.scoped(
  Effect.gen(function* () {
    const shutdownContext = yield* Layer.build(ShutdownService.Default);
    const platformContext = yield* Layer.build(PlatformLayer);
    return yield* server.pipe(Effect.provide(shutdownContext), Effect.provide(platformContext));
  }).pipe(Effect.tapCause(Effect.logError))
);

BunRuntime.runMain(main);
