/**
 * Workflow Layer Composition
 *
 * **Details**
 *
 * Provides properly-composed layers for the batch extraction workflow.
 * Uses Layer.provideMerge for order-independent composition.
 *
 * Architecture:
 * - CoreDependenciesLayer: ConfigService (foundation for all other services)
 * - LlmExtractionBundle: EntityExtractor + RelationExtractor + LanguageModel
 * - OntologyBundle: OntologyService + RdfBuilder + NlpService
 * - StorageBundle: StorageService for document/graph persistence
 * - ActivityDependenciesLayer: All services needed by workflow activities
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunServices } from "@effect/platform-bun";
import { ConfigProvider, Layer } from "effect";
import { EntityRegistryRepository } from "../Repository/EntityRegistry.ts";
import { ConfigService, ConfigServiceDefault } from "../Service/Config.ts";
import { CrossBatchEntityResolver } from "../Service/CrossBatchEntityResolver.ts";
import { EmbeddingServiceLive } from "../Service/Embedding.ts";
import { EmbeddingCacheWithPersistence } from "../Service/EmbeddingCache.ts";
import { EntityResolutionService } from "../Service/EntityResolution.ts";
import { EventBusServiceMemory } from "../Service/EventBus.ts";
import { EntityExtractor, RelationExtractor } from "../Service/Extraction.ts";
import { GraphRAG } from "../Service/GraphRAG.ts";
import { StageTimeoutServiceLive } from "../Service/LlmControl/StageTimeout.ts";
import { TokenBudgetServiceLive } from "../Service/LlmControl/TokenBudget.ts";
import { NlpService } from "../Service/Nlp.ts";
import { OntologyService } from "../Service/Ontology.ts";
import { OntologyRegistryService } from "../Service/OntologyRegistry.ts";
import { RdfBuilder } from "../Service/Rdf.ts";
import { Reasoner } from "../Service/Reasoner.ts";
import { ShaclWorkflowService } from "../Service/Shacl.ts";
import { StorageServiceLive } from "../Service/Storage.ts";
import { BatchExtractionWorkflowLayer, WorkflowOrchestratorLive } from "../Service/WorkflowOrchestrator.ts";
import { MetricsService } from "../Telemetry/Metrics.ts";
import { ExtractionWorkflowLive } from "../Workflow/StreamingExtraction.ts";
import { EmbeddingInfrastructure } from "./EmbeddingLayers.ts";
import { makeLanguageModelLayer } from "./ProductionRuntime.ts";

// =============================================================================
// Core Dependencies (foundation layer)
// =============================================================================

/**
 * Core dependencies that all other bundles need.
 * ConfigService is the foundation - must be available first.
 */
const CoreDependenciesLayer = ConfigServiceDefault;

// =============================================================================
// Service Bundles (each with dependencies pre-provided)
// =============================================================================

/**
 * LLM Control services bundle
 *
 * Provides fine-grained control over LLM API usage:
 * - TokenBudgetService: Per-stage token budgets
 * - StageTimeoutService: Soft/hard timeouts per stage
 */
const LlmControlBundle = Layer.mergeAll(TokenBudgetServiceLive, StageTimeoutServiceLive);

/**
 * LLM Extraction services: EntityExtractor + RelationExtractor
 *
 * Dependencies:
 * - LanguageModel (provider-specific, selected by ConfigService)
 * - StageTimeoutService (for per-stage timeout enforcement)
 * - TokenBudgetService (for per-stage token budget tracking)
 * - ConfigService (for LLM settings)
 *
 * Uses Layer.provideMerge for order-independent composition.
 */
const LlmExtractionBundle = Layer.mergeAll(EntityExtractor.Default, RelationExtractor.Default).pipe(
  Layer.provideMerge(LlmControlBundle),
  Layer.provideMerge(makeLanguageModelLayer),
  Layer.provideMerge(CoreDependenciesLayer)
);

/**
 * Embedding infrastructure with ConfigService pre-provided
 *
 * EmbeddingInfrastructure requires ConfigService, so we satisfy that first.
 * This layer provides: EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache
 */
const EmbeddingInfraWithConfig = EmbeddingInfrastructure.pipe(Layer.provide(CoreDependenciesLayer));

/**
 * NLP services with all dependencies satisfied
 *
 * NlpService.Default includes EmbeddingServiceDefault in its dependencies.
 * EmbeddingServiceDefault requires: EmbeddingProvider | EmbeddingCache | MetricsService
 *
 * We provide these by:
 * 1. EmbeddingInfraWithConfig -> EmbeddingProvider | EmbeddingCache (with ConfigService satisfied)
 * 2. MetricsService.Default -> MetricsService
 * 3. CoreDependenciesLayer -> ConfigService (for NlpService itself)
 */
const NlpBundle = NlpService.Default.pipe(
  Layer.provide(EmbeddingInfraWithConfig),
  Layer.provide(MetricsService.Default),
  Layer.provide(CoreDependenciesLayer)
);

/**
 * RdfBuilder with ConfigService dependency satisfied
 *
 * RdfBuilder.Default requires ConfigService, so we provide it first.
 */
const RdfBuilderBundle = RdfBuilder.Default.pipe(Layer.provideMerge(CoreDependenciesLayer));

/**
 * Platform layer: FileSystem, Path from BunServices
 *
 * Required by StorageServiceLive when using local storage.
 */
const PlatformBundle = BunServices.layer;

/**
 * Storage bundle: StorageService for document and graph persistence
 *
 * Dependencies:
 * - ConfigService (for storage type, bucket, path settings)
 * - FileSystem, Path (from BunServices, needed for local storage)
 */
const StorageBundle = StorageServiceLive.pipe(
  Layer.provideMerge(CoreDependenciesLayer),
  Layer.provideMerge(PlatformBundle)
);

/**
 * OntologyRegistry service bundle
 *
 * Provides multi-ontology registry support when ONTOLOGY_REGISTRY_PATH is configured.
 * Required by (yield* OntologyService).resolveAndLoad() for dynamic ontology resolution.
 *
 * Dependencies:
 * - ConfigService (for registry path setting)
 * - StorageService (for loading registry.json)
 */
const OntologyRegistryBundle = OntologyRegistryService.Default.pipe(
  Layer.provideMerge(StorageBundle),
  Layer.provideMerge(CoreDependenciesLayer)
);

/**
 * Ontology services: OntologyService + OntologyRegistryService + RdfBuilder
 *
 * Dependencies:
 * - StorageService (for loading ontology from storage)
 * - NlpService (for text processing)
 * - RdfBuilder (for parsing Turtle)
 * - OntologyRegistryService (for resolveAndLoad with registry lookup)
 * - ConfigService (for RDF namespace settings)
 *
 * CRITICAL: OntologyRegistryBundle must be PROVIDED to OntologyService.Default
 * (not merged) because OntologyService uses Effect.serviceOption to access it.
 * When merged, layers build in parallel so serviceOption can't find the service.
 * With provideMerge, the registry is available when OntologyService effect runs.
 */
const OntologyServiceWithRegistry = OntologyService.Default.pipe(
  Layer.provideMerge(OntologyRegistryBundle) // Registry must be available BEFORE OntologyService constructs
);

const OntologyBundle = Layer.mergeAll(OntologyServiceWithRegistry, RdfBuilderBundle).pipe(
  Layer.provideMerge(StorageBundle),
  Layer.provideMerge(NlpBundle),
  Layer.provideMerge(CoreDependenciesLayer)
);

/**
 * SHACL validation services
 *
 * Dependencies:
 * - RdfBuilder (graph parsing)
 * - StorageService (shape loading)
 * - ConfigService (provided via CoreDependenciesLayer)
 */
const ShaclBundle = ShaclWorkflowService.Default.pipe(
  Layer.provideMerge(RdfBuilderBundle),
  Layer.provideMerge(StorageBundle)
);

/**
 * Embedding services for vector similarity operations
 *
 * EmbeddingService provides text-to-embedding conversion used by:
 * - Entity resolution (clustering similar entities)
 * - Ontology embeddings (semantic class/property matching)
 * - GraphRAG (query embedding for retrieval)
 *
 * Uses PersistentEmbeddingCache when EMBEDDING_CACHE_PATH is configured,
 * falling back to in-memory cache otherwise. Persisted embeddings survive
 * server restarts and can be warmed up on startup.
 */
const EmbeddingBundle = EmbeddingServiceLive.pipe(
  // EmbeddingInfrastructure provides: EmbeddingProvider | EmbeddingRateLimiter | EmbeddingCache
  // This respects EMBEDDING_PROVIDER config (nomic vs voyage)
  Layer.provideMerge(EmbeddingInfrastructure),
  // Override cache with persistent version when EMBEDDING_CACHE_PATH is configured
  Layer.provideMerge(EmbeddingCacheWithPersistence),
  Layer.provideMerge(MetricsService.Default),
  Layer.provideMerge(StorageBundle),
  Layer.provideMerge(CoreDependenciesLayer)
);

/**
 * Entity Resolution services with cached embeddings
 *
 * Dependencies:
 * - EmbeddingService (with cache-through behavior)
 * - EmbeddingCache (in-memory with TTL/LRU eviction)
 * - MetricsService (cache hit/miss tracking)
 *
 * CRITICAL: EntityResolutionService.Default has EmbeddingServiceDefault in its
 * dependencies, which requires EmbeddingProvider | EmbeddingCache | MetricsService.
 * We provide EmbeddingBundle to satisfy these requirements.
 */
const EntityResolutionBundle = EntityResolutionService.Live.pipe(Layer.provideMerge(EmbeddingBundle));

/**
 * GraphRAG services for intelligent query retrieval
 *
 * Dependencies:
 * - EntityIndex (entity embedding index) - needs EmbeddingService
 * - SubgraphExtractor (N-hop subgraph extraction)
 *
 * CRITICAL: GraphRAG.Default includes EntityIndex.Default which has
 * EmbeddingServiceDefault in its dependencies. EmbeddingServiceDefault
 * requires EmbeddingProvider | EmbeddingCache | MetricsService.
 * We provide EmbeddingBundle to satisfy these requirements.
 */
const GraphRAGBundle = GraphRAG.Default.pipe(Layer.provideMerge(EmbeddingBundle));

/**
 * Cross-Batch Entity Resolution bundle (OPTIONAL)
 *
 * **Details**
 *
 * Provides cross-batch entity linking when Postgres with pgvector is available.
 * This bundle is NOT included in ActivityDependenciesLayer by default because
 * the activity uses Effect.serviceOption to gracefully handle the missing service.
 *
 * Dependencies:
 * - EntityRegistryRepository (requires Drizzle + PgClient)
 * - EmbeddingService (for computing entity embeddings)
 *
 * To enable cross-batch resolution:
 * 1. Configure POSTGRES_* environment variables
 * 2. Run migrations (v4 adds pgvector tables)
 * 3. Merge CrossBatchEntityResolverBundle into your layer composition
 *
 * **Gotchas**
 *
 * Do not merge this bundle into {@link ActivityDependenciesLayer} by default.
 * The activity uses `Effect.serviceOption` so missing Postgres is a graceful
 * skip; merging too late still leaves ConfigService and pgvector holes.
 *
 * **Example** (Enable cross-batch resolution when Postgres is configured)
 *
 * ```ts
 * import { ActivityDependenciesLayer, CrossBatchEntityResolverBundle } from "@effect-ontology/Runtime/WorkflowLayers"
 *
 * console.log(CrossBatchEntityResolverBundle !== ActivityDependenciesLayer) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CrossBatchEntityResolverBundle = CrossBatchEntityResolver.Default.pipe(
  Layer.provideMerge(EntityRegistryRepository.Default),
  Layer.provideMerge(EmbeddingBundle)
);

/**
 * ExtractionWorkflow service bundle
 *
 * Provides the unified streaming extraction workflow with all dependencies.
 * ExtractionWorkflowLive internally provides:
 * - NlpService, OntologyService, MentionExtractor
 * - EntityExtractor, RelationExtractor, Grounder
 * - ExtractionRunService
 *
 * We provide additional dependencies it needs from other bundles.
 */
const ExtractionWorkflowBundle = ExtractionWorkflowLive.pipe(
  Layer.provideMerge(OntologyBundle),
  Layer.provideMerge(LlmExtractionBundle),
  Layer.provideMerge(NlpBundle),
  Layer.provideMerge(StorageBundle),
  Layer.provideMerge(CoreDependenciesLayer)
);

// =============================================================================
// Activity Dependencies (complete bundle for workflow activities)
// =============================================================================

/**
 * Reasoner bundle for RDFS/OWL inference
 *
 * Reasoner.Default has no external dependencies - it uses N3.js internally.
 */
const ReasonerBundle = Reasoner.Default;

const ActivityCoreLayer = Layer.mergeAll(
  StorageBundle,
  CoreDependenciesLayer,
  LlmExtractionBundle,
  OntologyBundle,
  ReasonerBundle,
  EventBusServiceMemory
);

const ActivityEmbeddingLayer = EmbeddingBundle.pipe(Layer.provideMerge(ActivityCoreLayer));
const ActivityShaclLayer = ShaclBundle.pipe(Layer.provideMerge(ActivityEmbeddingLayer));
const ActivityEntityResolutionLayer = EntityResolutionBundle.pipe(Layer.provideMerge(ActivityShaclLayer));
const ActivityGraphRagLayer = GraphRAGBundle.pipe(Layer.provideMerge(ActivityEntityResolutionLayer));
const ActivityEmbeddingRequirements = Layer.mergeAll(EmbeddingInfrastructure, MetricsService.Default).pipe(
  Layer.provideMerge(CoreDependenciesLayer)
);

/**
 * All services required by workflow activities.
 *
 * **Details**
 *
 * Activities yield these in their execute effects:
 * - StorageService: Read/write documents and graphs
 * - ConfigService: Access configuration (bucket, paths)
 * - RdfBuilder: Serialize knowledge graphs to Turtle
 * - EntityExtractor: LLM-based entity extraction
 * - RelationExtractor: LLM-based relation extraction
 * - OntologyService: Ontology class/property lookup
 * - EntityResolutionService: Entity clustering with cached embeddings
 * - EmbeddingService: Embedding generation with cache-through
 *
 * Optional services are not included: enable {@link CrossBatchEntityResolverBundle}
 * separately when Postgres + pgvector are configured. ConfigService remains in
 * the output for HTTP handlers that need config.
 *
 * **Example** (Compose activity dependencies)
 *
 * ```ts
 * import { ActivityDependenciesLayer, CrossBatchEntityResolverBundle } from "@effect-ontology/Runtime/WorkflowLayers"
 *
 * console.log(ActivityDependenciesLayer !== CrossBatchEntityResolverBundle) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ActivityDependenciesLayer = ExtractionWorkflowBundle.pipe(
  Layer.provideMerge(ActivityGraphRagLayer),
  Layer.provideMerge(ActivityEmbeddingRequirements)
);

// =============================================================================
// Workflow Layers (with dependencies pre-provided)
// =============================================================================

/**
 * BatchExtractionWorkflowLayer with all activity dependencies provided.
 *
 * **Details**
 *
 * CRITICAL: The workflow's execute effect yields services like EntityExtractor.
 * These must be available when the workflow layer is constructed, not after.
 *
 * **Gotchas**
 *
 * GraphRAG's EntityIndex still needs ConfigService through EmbeddingServiceDefault.
 * Provide it before constructing the workflow layer, not after `Layer.launch`.
 *
 * **Example** (Provide activity dependencies at construction time)
 *
 * ```ts
 * import { ActivityDependenciesLayer, BatchExtractionWorkflowWithDepsLayer } from "@effect-ontology/Runtime/WorkflowLayers"
 *
 * console.log(BatchExtractionWorkflowWithDepsLayer !== ActivityDependenciesLayer) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BatchExtractionWorkflowWithDepsLayer = BatchExtractionWorkflowLayer.pipe(
  Layer.provideMerge(ActivityDependenciesLayer)
);

/**
 * Complete WorkflowOrchestrator layer with workflow and all dependencies.
 *
 * **Details**
 *
 * Provides:
 * - WorkflowOrchestrator service
 * - BatchExtractionWorkflow (registered with engine)
 * - All activity dependencies
 *
 * Requires:
 * - WorkflowEngine (from WorkflowEngine.layerMemory or ClusterWorkflowEngine)
 * - FileSystem, Path (from BunServices)
 *
 * **Example** (Compose orchestrator with the workflow and activity deps)
 *
 * ```ts
 * import { BatchExtractionWorkflowWithDepsLayer, WorkflowOrchestratorFullLayer } from "@effect-ontology/Runtime/WorkflowLayers"
 *
 * console.log(WorkflowOrchestratorFullLayer !== BatchExtractionWorkflowWithDepsLayer) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkflowOrchestratorFullLayer = BatchExtractionWorkflowWithDepsLayer.pipe(
  Layer.provideMerge(WorkflowOrchestratorLive)
);

// =============================================================================
// CLI Extraction Layer
// =============================================================================

/**
 * Complete extraction layer for CLI usage
 *
 * **Details**
 *
 * Provides all services needed for ad-hoc extraction:
 * - ExtractionWorkflow (main extraction interface)
 * - RdfBuilder (for Turtle serialization)
 *
 * This layer is fully self-contained with no input requirements.
 * It explicitly provides embedding infrastructure to satisfy requirements
 * from NlpService and other services that depend on EmbeddingService.
 *
 * Use with BunServices.layer for platform services (FileSystem, Path).
 *
 * **Example** (Use the self-contained CLI extraction stack)
 *
 * ```ts
 * import { ConfigProvider } from "effect"
 * import { CliExtractionLayer, makeCliExtractionLayer } from "@effect-ontology/Runtime/WorkflowLayers"
 *
 * const withPath = makeCliExtractionLayer(
 *   ConfigProvider.fromUnknown({ ONTOLOGY_PATH: "ontologies/people.ttl" })
 * )
 * console.log(withPath !== CliExtractionLayer) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CliExtractionLayer = Layer.mergeAll(ExtractionWorkflowBundle, RdfBuilderBundle).pipe(
  // Provide embedding infrastructure to satisfy EmbeddingServiceDefault requirements
  // that bubble up through NlpService.Default and other services
  Layer.provideMerge(EmbeddingBundle)
);

/**
 * Create a CLI extraction layer with a custom ConfigProvider.
 *
 * **Details**
 *
 * Use this when you need to override config values via CLI flags.
 * The custom provider is set BEFORE any layers are built, ensuring
 * all services read from the custom provider.
 *
 * **Example** (Override ONTOLOGY_PATH before constructing CLI services)
 *
 * ```ts
 * import { ConfigProvider } from "effect"
 * import { CliExtractionLayer, makeCliExtractionLayer } from "@effect-ontology/Runtime/WorkflowLayers"
 *
 * const ontologyPath = "ontologies/people.ttl"
 * const customProvider = ConfigProvider.fromUnknown({
 *   ONTOLOGY_PATH: ontologyPath,
 *   ONTOLOGY_EXTERNAL_VOCABS_PATH: ""
 * }).pipe(ConfigProvider.orElse(ConfigProvider.fromEnv()))
 * const layer = makeCliExtractionLayer(customProvider)
 * console.log(ontologyPath.endsWith(".ttl")) // true
 * console.log(layer !== CliExtractionLayer) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeCliExtractionLayer = (configProvider: ConfigProvider.ConfigProvider) =>
  CliExtractionLayer.pipe(Layer.provide(ConfigProvider.layer(configProvider)));

// =============================================================================
// Open Bundles (ConfigService as requirement - for testing)
// =============================================================================

/**
 * NLP services without config baked in
 *
 * **Details**
 *
 * Requires: ConfigService | EmbeddingProvider | EmbeddingCache. These open
 * bundles do not pre-provide ConfigService, so tests can inject
 * {@link TestConfigProvider}.
 *
 * **Gotchas**
 *
 * Do not bake ConfigService into test bundles. Provide a test ConfigProvider
 * before constructing NLP, embedding, RDF, or storage layers.
 *
 * **Example** (Provide a test ConfigProvider into the open NLP bundle)
 *
 * ```ts
 * import { ConfigProvider, Layer } from "effect"
 * import { TestConfigProvider } from "@effect-ontology/Runtime/TestRuntime"
 * import { NlpBundleOpen } from "@effect-ontology/Runtime/WorkflowLayers"
 *
 * const TestLayer = NlpBundleOpen.pipe(Layer.provide(ConfigProvider.layer(TestConfigProvider)))
 * console.log(TestLayer !== NlpBundleOpen) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const NlpBundleOpen = NlpService.Default.pipe(
  Layer.provide(EmbeddingInfrastructure),
  Layer.provide(MetricsService.Default)
);

/**
 * Embedding services without config baked in
 *
 * **Details**
 *
 * Requires: ConfigService
 *
 * **Example** (Leave ConfigService open for tests)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { EmbeddingBundleOpen } from "@effect-ontology/Runtime/WorkflowLayers"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 *
 * const closed = EmbeddingBundleOpen.pipe(Layer.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG)))
 * console.log(closed !== EmbeddingBundleOpen) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingBundleOpen = EmbeddingServiceLive.pipe(
  Layer.provideMerge(EmbeddingInfrastructure),
  Layer.provideMerge(EmbeddingCacheWithPersistence),
  Layer.provideMerge(MetricsService.Default),
  Layer.provideMerge(StorageServiceLive),
  Layer.provideMerge(BunServices.layer)
);

/**
 * RDF builder without config baked in
 *
 * **Details**
 *
 * Requires: ConfigService
 *
 * **Example** (Use the open RDF builder layer)
 *
 * ```ts
 * import { EmbeddingBundleOpen, RdfBuilderBundleOpen } from "@effect-ontology/Runtime/WorkflowLayers"
 *
 * console.log(RdfBuilderBundleOpen !== EmbeddingBundleOpen) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RdfBuilderBundleOpen = RdfBuilder.Default;

/**
 * Storage service without config baked in
 *
 * **Details**
 *
 * Requires: ConfigService
 *
 * **Example** (Leave storage ConfigService open for tests)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { StorageBundleOpen } from "@effect-ontology/Runtime/WorkflowLayers"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 *
 * const closed = StorageBundleOpen.pipe(Layer.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG)))
 * console.log(closed !== StorageBundleOpen) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StorageBundleOpen = StorageServiceLive.pipe(Layer.provideMerge(BunServices.layer));

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { ConfigService, ConfigServiceDefault };
