/**
 * Public effect-ontology APIs for index.
 *
 * **Details**
 *
 * Package marker: `@effect-ontology/core-v2`.
 *
 * Effect-native knowledge extraction framework
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// Domain (pure types, no service dependencies)
export * as Domain from "./Domain/index.ts";

// Entity Resolution Domain Types
export {
  type EntityResolutionConfig,
  EREdge,
  ERNode,
  MentionRecord,
  RelationEdge,
  ResolutionEdge,
  ResolvedEntity,
} from "./Domain/Model/EntityResolution.ts";
// Entity Resolution Types (from Domain)
export type {
  ClusteringResult,
  EntityCluster,
  EntityResolutionGraph,
  EntityResolutionInfo,
  EntityResolutionStats,
  SimilarityEdge,
} from "./Domain/Model/EntityResolutionGraph.ts";
// Runtime (pre-composed layers)
export {
  ExtractionLayersLive,
  makeLanguageModelLayer,
  ProductionLayersWithTracing,
  RateLimitedLlmLayer,
  TracingLive,
} from "./Runtime/ProductionRuntime.ts";
// Services (Effect.Service classes with .Default layers)
export { ConfigService, ConfigServiceDefault } from "./Service/Config.ts";
// Entity Linker Service (query helpers)
export { getCanonicalId, getMentionsForEntity, toMermaid } from "./Service/EntityLinker.ts";
export { EntityExtractor, RelationExtractor } from "./Service/Extraction.ts";
// Workflows (composable business logic)
export { ExtractionWorkflow } from "./Service/ExtractionWorkflow.ts";
export { NlpService } from "./Service/Nlp.ts";
export { OntologyService } from "./Service/Ontology.ts";
// New Phase 3 Services
export { type LinkedRelation, type LinkingResult, RelationLinker } from "./Service/RelationLinker.ts";
export { type SimilarityResult, SimilarityScorer } from "./Service/SimilarityScorer.ts";
// Telemetry (OpenTelemetry integration)
export * as Telemetry from "./Telemetry/index.ts";
// Entity Resolution Workflow
export { buildEntityResolutionGraph, clusterEntities } from "./Workflow/EntityResolutionGraph.ts";
export {
  ExtractionWorkflowDefault,
  ExtractionWorkflowLive,
  makeExtractionWorkflow,
} from "./Workflow/StreamingExtraction.ts";
