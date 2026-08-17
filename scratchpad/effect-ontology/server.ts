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
import { LinkIngestionBackgroundTasks } from "./Runtime/LinkIngestionRouter.ts";
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

const ServerConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(8080)),
  postgresHost: Config.string("POSTGRES_HOST").pipe(Config.option),
  useCaching: Config.boolean("ENABLE_REPO_CACHING").pipe(Config.withDefault(true)),
});

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

const ImageServicesLayer = ImageStore.Live.pipe(
  Layer.provideMerge(ImageBlobStore.Live),
  Layer.provideMerge(ActivityDependenciesLayer)
);

const makeServerLive = (config: Config.Success<typeof ServerConfig>) => {
  const usePostgres = O.isSome(config.postgresHost);
  const workflowEngineLive = usePostgres ? ClusterWorkflowEngineLive : WorkflowEngine.layerMemory;
  const workflowOrchestratorWithDependencies = WorkflowOrchestratorFullLayer.pipe(
    Layer.provideMerge(workflowEngineLive),
    Layer.provideMerge(PlatformLayer)
  );
  const batchStatePersistenceWithDeps = BatchStatePersistenceLayer.pipe(
    Layer.provideMerge(ActivityDependenciesLayer),
    Layer.provideMerge(PlatformLayer)
  );
  const healthCheckWithDeps = HealthCheckService.Default.pipe(
    Layer.provideMerge(ActivityDependenciesLayer),
    Layer.provideMerge(PlatformLayer)
  );
  const baseRepositoriesLayer = Layer.mergeAll(ClaimRepository.Default, ArticleRepository.Default).pipe(
    Layer.provideMerge(DatabaseReadyLive)
  );
  const cachedRepositoriesLayer = Layer.mergeAll(CachedClaimRepository.Default, CachedArticleRepository.Default).pipe(
    Layer.provideMerge(baseRepositoriesLayer)
  );
  const repositoriesLayer = config.useCaching
    ? Layer.mergeAll(baseRepositoriesLayer, cachedRepositoriesLayer)
    : baseRepositoriesLayer;
  const claimPersistenceLayer = usePostgres
    ? ClaimPersistenceService.Default.pipe(Layer.provideMerge(repositoriesLayer))
    : Layer.empty;
  const postgresLinkIngestionLayer = LinkIngestionService.Default.pipe(
    Layer.provideMerge(ContentEnrichmentAgent.Default),
    Layer.provideMerge(JinaReaderClient.Default),
    Layer.provideMerge(ImageExtractor.Default),
    Layer.provideMerge(ImageFetcher.Default),
    Layer.provideMerge(ImageServicesLayer),
    Layer.provideMerge(DatabaseReadyLive)
  );
  const linkIngestionLayer = usePostgres ? postgresLinkIngestionLayer : LinkIngestionService.Disabled;
  const repositoryBackedHttpServerLive = HttpServerLive.pipe(Layer.provideMerge(repositoriesLayer));
  const selectedHttpServerLive = usePostgres ? repositoryBackedHttpServerLive : HttpServerWithoutRepositoriesLive;

  return selectedHttpServerLive.pipe(
    Layer.provideMerge(InferenceJobStoreLive),
    Layer.provideMerge(BunHttpServer.layer({ port: config.port, idleTimeout: 255 })),
    Layer.provideMerge(workflowEngineLive),
    Layer.provideMerge(workflowOrchestratorWithDependencies),
    Layer.provideMerge(BatchStateBridgeLive),
    Layer.provideMerge(BatchStateHubLayer),
    Layer.provideMerge(batchStatePersistenceWithDeps),
    Layer.provideMerge(healthCheckWithDeps),
    Layer.provideMerge(claimPersistenceLayer),
    Layer.provideMerge(linkIngestionLayer),
    Layer.provideMerge(ImageServicesLayer),
    Layer.provideMerge(EventBridgeAutoStart),
    Layer.provideMerge(EventBroadcastHubLive),
    Layer.provideMerge(TicketService.Default),
    Layer.provideMerge(LinkIngestionBackgroundTasks.Default),
    Layer.provideMerge(ActivityDependenciesLayer),
    Layer.provideMerge(PlatformLayer)
  );
};

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
const server = Effect.fn("EffectOntology.server")(function* (config: Config.Success<typeof ServerConfig>) {
  const shutdown = yield* ShutdownService;
  const usePostgres = O.isSome(config.postgresHost);

  yield* Effect.logInfo(
    usePostgres
      ? "PostgreSQL workflow engine enabled (durable workflows)"
      : "Using in-memory workflow engine (no POSTGRES_HOST configured)"
  );
  yield* Effect.logInfo(
    usePostgres ? "EventLog storage: PostgreSQL (persistent)" : "EventLog storage: Memory (events lost on restart)"
  );
  if (usePostgres) {
    yield* Effect.logInfo(`Repository caching: ${config.useCaching ? "enabled" : "disabled"}`);
  }

  // Warm up caches from GCS (runs in background, doesn't block startup)
  yield* Effect.forkChild(warmUpCaches);

  yield* Effect.logInfo(`Server starting on port ${config.port}`);
  yield* Layer.build(makeServerLive(config));

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
    const config = yield* ServerConfig;
    const shutdownContext = yield* Layer.build(ShutdownService.Default);
    const platformContext = yield* Layer.build(PlatformLayer);
    return yield* server(config).pipe(Effect.provide(shutdownContext), Effect.provide(platformContext));
  }).pipe(Effect.tapCause(Effect.logError))
);

BunRuntime.runMain(main);
