/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * Runtime: Test Runtime
 *
 * Layer composition for testing with mocks.
 * Uses test layers for EntityExtractor and RelationExtractor,
 * and provides a mock LanguageModel for LLM operations.
 *
 * Includes LLM Control test layers for:
 * - TokenBudgetService
 * - StageTimeoutService
 * - CentralRateLimiterService
 * - Grounder
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Rdf from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { BunServices } from "@effect/platform-bun";
import { ConfigProvider, DateTime, Effect, Layer, ManagedRuntime, Stream } from "effect";
import * as P from "effect/Predicate";
import * as A from "effect/Array";
import type { Response } from "effect/unstable/ai";
import { LanguageModel } from "effect/unstable/ai";
import { ConfigServiceDefault } from "../Service/Config.ts";
import { EmbeddingCache } from "../Service/EmbeddingCache.ts";
import type { EmbeddingProviderMethods } from "../Service/EmbeddingProvider.ts";
import { EmbeddingProvider } from "../Service/EmbeddingProvider.ts";
import { EntityExtractor, RelationExtractor } from "../Service/Extraction.ts";
import { Grounder } from "../Service/Grounder.ts";
import {
  CentralRateLimiterServiceTest,
  StageTimeoutServiceTest,
  TokenBudgetServiceTest,
} from "../Service/LlmControl/index.ts";
import { NlpService } from "../Service/Nlp.ts";
import { OntologyService } from "../Service/Ontology.ts";
import type { RdfStore } from "../Service/Rdf.ts";
import { emptyRdfStore, RdfBuilder, rdfStoreSize } from "../Service/Rdf.ts";
import type { ValidationPolicy } from "../Service/Shacl.ts";
import { ShaclValidationReport, ShaclWorkflowService } from "../Service/Shacl.ts";
import { StorageServiceTest } from "../Service/Storage.ts";
import { MetricsService } from "../Telemetry/Metrics.ts";

/**
 * Mock LanguageModel for testing
 *
 * Provides a stub implementation that returns empty responses.
 * Used by EntityExtractor and RelationExtractor test layers.
 *
 * @since 0.0.0
 */
const MockLanguageModel = Layer.succeed(
  LanguageModel.LanguageModel,
  LanguageModel.LanguageModel.of({
    generateText: Effect.fn("LanguageModel.LanguageModel.generateText")(() =>
      Effect.succeed(new LanguageModel.GenerateTextResponse<{}>([]))
    ),
    streamText: () => Stream.fromIterable<Response.StreamPart<{}>>([]),
    generateObject: Effect.fn("LanguageModel.LanguageModel.generateObject")(() =>
      Effect.succeed(
        new LanguageModel.GenerateObjectResponse<{}, any>(
          { entities: [], relations: [] },
          []
        ) as LanguageModel.GenerateObjectResponse<any, any>
      )
    ),
  })
);

/**
 * LLM Control Test Layers
 *
 * Provides test implementations with high limits for testing:
 * - TokenBudgetServiceTest: Full 4096 token budget
 * - StageTimeoutServiceTest: Default timeouts (can be overridden)
 * - CentralRateLimiterServiceTest: High limits for testing
 *
 * @since 0.0.0
 */
const LlmControlTestLayers = Layer.mergeAll(
  TokenBudgetServiceTest(4096),
  StageTimeoutServiceTest(),
  CentralRateLimiterServiceTest({
    requestsPerMinute: 1000,
    tokensPerMinute: 1_000_000,
    maxConcurrent: 100,
  })
);

/**
 * Test ConfigProvider with required values
 *
 * Provides default config values for all tests so they don't need
 * environment variables to be set.
 */
export const TestConfigProvider = ConfigProvider.fromUnknown({
  ONTOLOGY_PATH: "/tmp/test-ontology.ttl",
  LLM_API_KEY: "test-key-for-testing",
  LLM_PROVIDER: "anthropic",
  LLM_MODEL: "claude-haiku-4-5",
  STORAGE_TYPE: "memory",
  RUNTIME_CONCURRENCY: "4",
  RUNTIME_LLM_CONCURRENCY: "2",
  RUNTIME_ENABLE_TRACING: "false",
});

/**
 * Mock SHACL Service for testing
 *
 * Provides deterministic SHACL validation behaviour for unit/integration tests.
 */
export const MockShaclService = (options?: {
  readonly conforms?: boolean;
  readonly violations?: ReadonlyArray<{
    readonly severity: "violation" | "warning" | "info";
    readonly message: string;
    readonly focusNode?: string;
    readonly path?: string;
    readonly value?: string;
    readonly sourceShape?: string;
  }>;
}) => {
  const makeReport = Effect.fn("ShaclService.makeTestReport")(function* (dataStore: RdfStore, shapesStore: RdfStore) {
    const violations = (options?.violations ?? []).map((violation) => ({
      focusNode: violation.focusNode ?? "test:node",
      path: Rdf.makeNamedNode(violation.path ?? "urn:beep:shacl:path:unknown"),
      message: violation.message,
      severity: violation.severity,
      sourceConstraintComponent: Rdf.makeNamedNode("urn:beep:shacl:constraint:test"),
      ...(P.isNotUndefined(violation.value)
        ? {
            value: Rdf.Literal.encodeSync(Rdf.makeLiteral(violation.value, XSD_STRING.value)),
          }
        : {}),
      ...(P.isNotUndefined(violation.sourceShape) ? { sourceShape: Rdf.makeNamedNode(violation.sourceShape) } : {}),
    }));
    return yield* ShaclValidationReport.decodeEffect({
      validation: { conforms: A.isReadonlyArrayEmpty(violations), violations, truncated: false },
      validatedAt: DateTime.formatIso(yield* DateTime.now),
      dataGraphTripleCount: rdfStoreSize(dataStore),
      shapesGraphTripleCount: rdfStoreSize(shapesStore),
      durationMs: 0,
    }).pipe(Effect.orDie);
  });

  return Layer.succeed(ShaclWorkflowService, {
    validateWithReport: makeReport,
    loadShapes: Effect.fn("ShaclService.loadShapes")((_turtle: string) => Effect.succeed(emptyRdfStore())),
    loadShapesFromUri: Effect.fn("ShaclService.loadShapesFromUri")(() => Effect.succeed(emptyRdfStore())),
    generateShapesFromOntology: Effect.fn("ShaclService.generateShapesFromOntology")(() =>
      Effect.succeed(emptyRdfStore())
    ),
    clearShapesCache: Effect.void,
    getShapesCacheStats: Effect.succeed({ size: 0, keys: [] as ReadonlyArray<string> }),
    validateWithPolicy: Effect.fn("ShaclService.validateWithPolicy")(function* (
      dataStore: RdfStore,
      shapesStore: RdfStore,
      _policy: ValidationPolicy
    ) {
      return yield* makeReport(dataStore, shapesStore);
    }),
  });
};

/**
 * Mock EmbeddingProvider for testing
 *
 * Returns deterministic zero vectors for all embedding requests.
 *
 * @since 0.0.0
 */
const MockEmbeddingProvider = Layer.succeed(EmbeddingProvider, {
  metadata: {
    providerId: "nomic",
    modelId: "test-model",
    dimension: 768,
  },
  embedBatch: (_requests) => Effect.succeed(_requests.map(() => new Array(768).fill(0))),
  cosineSimilarity: (_a, _b) => 0,
} as EmbeddingProviderMethods);

/**
 * Test Layers
 *
 * Uses test/mock implementations for deterministic testing:
 * - EntityExtractor.Test: Returns deterministic fake entities
 * - RelationExtractor.Test: Returns deterministic fake relations
 * - Grounder.Test: Returns deterministic pass for all relations
 * - MockLanguageModel: Stub LLM that returns empty responses
 * - MockEmbeddingProvider: Returns zero vectors
 * - LLM Control: Test layers with high limits
 * - Other services use Default layers (can be mocked per test)
 *
 * @since 0.0.0
 */
// Embedding infrastructure for NlpService.Default
const EmbeddingInfraLayer = Layer.mergeAll(MockEmbeddingProvider, EmbeddingCache.Default, MetricsService.Default);

// OntologyService.Default includes NlpService.Default which needs embedding infrastructure
const ontologyLayer = OntologyService.Default.pipe(
  Layer.provide(EmbeddingInfraLayer),
  Layer.provide(StorageServiceTest),
  Layer.provideMerge(BunServices.layer)
);

// NlpService bundle with embedding infrastructure provided
const NlpBundle = NlpService.Default.pipe(Layer.provide(EmbeddingInfraLayer));

export const TestLayers = Layer.mergeAll(
  NlpBundle,
  RdfBuilder.Default,
  ontologyLayer,
  MockShaclService(),
  MockLanguageModel,
  EmbeddingInfraLayer, // Export for other services that may need it
  EntityExtractor.Test,
  RelationExtractor.Test,
  Grounder.Test,
  LlmControlTestLayers,
  BunServices.layer
).pipe(Layer.provideMerge(ConfigServiceDefault), Layer.provideMerge(ConfigProvider.layer(TestConfigProvider)));

/**
 * Test Runtime
 *
 * Managed runtime for testing with all test layers provided.
 *
 * @since 0.0.0
 */
export const TestRuntime = ManagedRuntime.make(TestLayers);
