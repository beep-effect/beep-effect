/**
 * Service: Configuration Service
 *
 * Centralized configuration for LLM, RDF, Ontology, and Runtime settings.
 * Uses Effect.Config for environment-based configuration.
 *
 * @since 2.0.0
 * @module Service/Config
 */

import { $ScratchpadId } from "@beep/identity";
import { Config, ConfigProvider, Context, Effect, Layer, Option, Redacted } from "effect";

const $I = $ScratchpadId.create("effect-ontology/Service/Config");

// =============================================================================
// Config Groups
// =============================================================================

const LlmConfig = Config.nested("LLM")(
  Config.all({
    provider: Config.literals(["anthropic", "openai", "google"], "PROVIDER").pipe(Config.withDefault("anthropic")),
    model: Config.string("MODEL").pipe(Config.withDefault("claude-haiku-4-5")),
    apiKey: Config.redacted("API_KEY"),
    timeoutMs: Config.int("TIMEOUT_MS").pipe(Config.withDefault(60_000)),
    maxTokens: Config.int("MAX_TOKENS").pipe(Config.withDefault(4096)),
    temperature: Config.number("TEMPERATURE").pipe(Config.withDefault(0.1)),
    enablePromptCaching: Config.boolean("ENABLE_PROMPT_CACHING").pipe(Config.withDefault(true)),
  })
);

const StorageConfig = Config.nested("STORAGE")(
  Config.all({
    type: Config.literals(["local", "gcs", "memory"], "TYPE").pipe(Config.withDefault("local")),
    bucket: Config.option(Config.string("BUCKET")),
    localPath: Config.option(Config.string("LOCAL_PATH")),
    prefix: Config.string("PREFIX").pipe(Config.withDefault("")),
  })
);

const OntologyConfig = Config.nested("ONTOLOGY")(
  Config.all({
    path: Config.string("PATH"),
    /**
     * Path to bundled external vocabularies (PROV-O, W3C ORG, OWL-Time, etc.)
     * This file is loaded alongside the main ontology and merged for domain/range
     * constraint enforcement. Defaults to ontologies/external/merged-external.ttl.
     */
    externalVocabsPath: Config.string("EXTERNAL_VOCABS_PATH").pipe(
      Config.withDefault("ontologies/external/merged-external.ttl")
    ),
    /**
     * Path to ontology registry manifest (registry.json).
     * When set, enables multi-ontology support via OntologyRegistryService.
     * Defaults to "registry.json" at bucket root.
     */
    registryPath: Config.option(Config.string("REGISTRY_PATH")),
    cacheTtlSeconds: Config.int("CACHE_TTL").pipe(Config.withDefault(3600)),
    /**
     * When true, workflow fails if manifest.ontologyUri doesn't match the configured ontology path.
     * This prevents silent mismatches between extraction (uses config) and validation (uses manifest).
     */
    strictValidation: Config.boolean("STRICT_VALIDATION").pipe(Config.withDefault(false)),
  })
);

const RuntimeConfig = Config.nested("RUNTIME")(
  Config.all({
    concurrency: Config.int("CONCURRENCY").pipe(Config.withDefault(4)),
    llmConcurrencyLimit: Config.int("LLM_CONCURRENCY").pipe(Config.withDefault(2)),
    retryMaxAttempts: Config.int("RETRY_MAX").pipe(Config.withDefault(3)),
    retryInitialDelayMs: Config.int("RETRY_INITIAL_DELAY").pipe(Config.withDefault(1000)),
    retryMaxDelayMs: Config.int("RETRY_MAX_DELAY").pipe(Config.withDefault(30000)),
    enableTracing: Config.boolean("ENABLE_TRACING").pipe(Config.withDefault(false)),
  })
);

const GrounderConfig = Config.nested("GROUNDER")(
  Config.all({
    enabled: Config.boolean("ENABLED").pipe(Config.withDefault(true)),
    confidenceThreshold: Config.number("THRESHOLD").pipe(Config.withDefault(0.8)),
    batchSize: Config.int("BATCH_SIZE").pipe(Config.withDefault(5)),
  })
);

const EmbeddingConfig = Config.nested("EMBEDDING")(
  Config.all({
    /** Embedding provider: nomic (local), voyage (API) */
    provider: Config.literals(["nomic", "voyage"], "PROVIDER").pipe(Config.withDefault("nomic")),

    // --- Nomic (local) configuration ---
    model: Config.string("MODEL").pipe(Config.withDefault("nomic-embed-text-v1.5")),
    dimension: Config.int("DIMENSION").pipe(Config.withDefault(768)),
    /** Transformers.js model ID for local inference */
    transformersModelId: Config.string("TRANSFORMERS_MODEL_ID").pipe(Config.withDefault("Xenova/nomic-embed-text-v1")),

    // --- Voyage (API) configuration ---
    /** Voyage AI API key */
    voyageApiKey: Config.option(Config.redacted("VOYAGE_API_KEY")),
    /** Voyage model to use (voyage-3.5-lite, voyage-3, voyage-code-3, voyage-law-2) */
    voyageModel: Config.string("VOYAGE_MODEL").pipe(Config.withDefault("voyage-3.5-lite")),
    /** Request timeout in milliseconds */
    timeoutMs: Config.int("TIMEOUT_MS").pipe(Config.withDefault(30_000)),
    /** Requests per minute limit for Voyage API */
    rateLimitRpm: Config.int("RATE_LIMIT_RPM").pipe(Config.withDefault(100)),
    /** Maximum concurrent requests to Voyage API */
    maxConcurrent: Config.int("MAX_CONCURRENT").pipe(Config.withDefault(10)),

    // --- Cache configuration ---
    /** GCS/local path for persisting embedding cache (optional, enables persistence when set) */
    cachePath: Config.option(Config.string("CACHE_PATH")),
    /** TTL for cached embeddings in hours (default: 24 hours) */
    cacheTtlHours: Config.int("CACHE_TTL_HOURS").pipe(Config.withDefault(24)),
    /** Maximum entries in in-memory cache before LRU eviction (default: 10000) */
    cacheMaxEntries: Config.int("CACHE_MAX_ENTRIES").pipe(Config.withDefault(10000)),
    /** GCS/local path for persisting entity index (optional, enables GraphRAG persistence when set) */
    entityIndexPath: Config.option(Config.string("ENTITY_INDEX_PATH")),
  })
);

const ExtractionConfig = Config.nested("EXTRACTION")(
  Config.all({
    /** Base directory for extraction run artifacts */
    runsDir: Config.string("RUNS_DIR").pipe(Config.withDefault("./output/runs")),
    /** Whether claim persistence failures should fail the workflow (true) or just log warning (false) */
    strictPersistence: Config.boolean("STRICT_PERSISTENCE").pipe(Config.withDefault(true)),
  })
);

const EntityRegistryConfig = Config.nested("ENTITY_REGISTRY")(
  Config.all({
    /** Enable cross-batch entity resolution via persistent entity registry */
    enabled: Config.boolean("ENABLED").pipe(Config.withDefault(false)),
    /** Minimum embedding similarity for candidate retrieval (0.0-1.0) */
    candidateThreshold: Config.number("CANDIDATE_THRESHOLD").pipe(Config.withDefault(0.6)),
    /** Minimum similarity for final resolution decision (0.0-1.0) */
    resolutionThreshold: Config.number("RESOLUTION_THRESHOLD").pipe(Config.withDefault(0.8)),
    /** Maximum candidates per entity from ANN search */
    maxCandidatesPerEntity: Config.int("MAX_CANDIDATES").pipe(Config.withDefault(20)),
    /** Maximum candidates from token blocking */
    maxBlockingCandidates: Config.int("MAX_BLOCKING").pipe(Config.withDefault(100)),
    /** Namespace prefix for generated canonical entity IRIs */
    canonicalNamespace: Config.string("CANONICAL_NAMESPACE").pipe(Config.withDefault("http://example.org/entities/")),
  })
);

const InferenceConfig = Config.nested("INFERENCE")(
  Config.all({
    /** Enable RDFS inference stage in extraction pipeline */
    enabled: Config.boolean("ENABLED").pipe(Config.withDefault(false)),
    /** Reasoning profile: rdfs (full), rdfs-subclass, owl-sameas, custom */
    profile: Config.literals(["rdfs", "rdfs-subclass", "owl-sameas", "custom"], "PROFILE").pipe(
      Config.withDefault("rdfs")
    ),
    /** Whether to persist derived claims to database */
    persistDerived: Config.boolean("PERSIST_DERIVED").pipe(Config.withDefault(true)),
  })
);

const ApiConfig = Config.nested("API")(
  Config.all({
    /**
     * API keys for authentication (comma-separated list).
     * When set, all /v1/* endpoints require X-API-Key header.
     * Health endpoints (/health/*) are always public.
     */
    keys: Config.option(Config.redacted("KEYS")),
    /**
     * Whether to require authentication for API endpoints.
     * Defaults to false for backwards compatibility.
     */
    requireAuth: Config.boolean("REQUIRE_AUTH").pipe(Config.withDefault(false)),
  })
);

const JinaConfig = Config.nested("JINA")(
  Config.all({
    /**
     * Jina Reader API key (optional).
     * Without key: 20 RPM rate limit.
     * With key: 500 RPM rate limit.
     * @see https://jina.ai/reader/
     */
    apiKey: Config.option(Config.redacted("API_KEY")),
    /**
     * Rate limit in requests per minute.
     * Defaults to 20 (free tier). Set to 500 if using API key.
     */
    rateLimitRpm: Config.int("RATE_LIMIT_RPM").pipe(Config.withDefault(20)),
    /**
     * Request timeout in milliseconds.
     * Jina may take longer for JS-heavy sites.
     */
    timeoutMs: Config.int("TIMEOUT_MS").pipe(Config.withDefault(30_000)),
    /**
     * Maximum concurrent requests.
     * Used with Effect.Semaphore for client-side limiting.
     */
    maxConcurrent: Config.int("MAX_CONCURRENT").pipe(Config.withDefault(5)),
    /**
     * Base URL for Jina Reader API.
     * Defaults to production endpoint.
     */
    baseUrl: Config.string("BASE_URL").pipe(Config.withDefault("https://r.jina.ai")),
  })
);

const ValidationConfig = Config.nested("VALIDATION")(
  Config.all({
    /**
     * Log violations but don't fail workflows.
     * Useful for development where quality is improving.
     * Defaults to false for production safety.
     */
    logOnly: Config.boolean("LOG_ONLY").pipe(Config.withDefault(false)),
    /**
     * Fail if any SHACL Violation-level results are present.
     * Defaults to true for data integrity.
     */
    failOnViolation: Config.boolean("FAIL_ON_VIOLATION").pipe(Config.withDefault(true)),
    /**
     * Fail if any SHACL Warning-level results are present.
     * Defaults to false as warnings are often acceptable.
     */
    failOnWarning: Config.boolean("FAIL_ON_WARNING").pipe(Config.withDefault(false)),
  })
);

const RdfConfig = Config.nested("RDF")(
  Config.all({
    baseNamespace: Config.string("BASE_NAMESPACE").pipe(Config.withDefault("http://example.org/kg/")),
    outputFormat: Config.literals(["Turtle", "N-Triples", "JSON-LD"], "OUTPUT_FORMAT").pipe(
      Config.withDefault("Turtle")
    ),
    prefixes: Config.succeed({
      schema: "http://schema.org/",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      owl: "http://www.w3.org/2002/07/owl#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
    }),
  })
);

// =============================================================================
// App Config Interface
// =============================================================================

export interface AppConfig {
  readonly llm: Config.Success<typeof LlmConfig>;
  readonly storage: Config.Success<typeof StorageConfig>;
  readonly ontology: Config.Success<typeof OntologyConfig>;
  readonly runtime: Config.Success<typeof RuntimeConfig>;
  readonly grounder: Config.Success<typeof GrounderConfig>;
  readonly embedding: Config.Success<typeof EmbeddingConfig>;
  readonly extraction: Config.Success<typeof ExtractionConfig>;
  readonly entityRegistry: Config.Success<typeof EntityRegistryConfig>;
  readonly inference: Config.Success<typeof InferenceConfig>;
  readonly validation: Config.Success<typeof ValidationConfig>;
  readonly rdf: Config.Success<typeof RdfConfig>;
  readonly api: Config.Success<typeof ApiConfig>;
  readonly jina: Config.Success<typeof JinaConfig>;
}

export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    apiKey: Redacted.make(""),
    timeoutMs: 60_000,
    maxTokens: 4096,
    temperature: 0.1,
    enablePromptCaching: true,
  },
  storage: {
    type: "local",
    bucket: Option.none(),
    localPath: Option.none(),
    prefix: "",
  },
  ontology: {
    path: "ontology.ttl",
    externalVocabsPath: "ontologies/external/merged-external.ttl",
    registryPath: Option.none(),
    cacheTtlSeconds: 3600,
    strictValidation: false,
  },
  runtime: {
    concurrency: 4,
    llmConcurrencyLimit: 2,
    retryMaxAttempts: 3,
    retryInitialDelayMs: 1000,
    retryMaxDelayMs: 30000,
    enableTracing: false,
  },
  grounder: {
    enabled: true,
    confidenceThreshold: 0.8,
    batchSize: 5,
  },
  embedding: {
    provider: "nomic" as const,
    model: "nomic-embed-text-v1.5",
    dimension: 768,
    transformersModelId: "Xenova/nomic-embed-text-v1",
    voyageApiKey: Option.none<Redacted.Redacted<string>>(),
    voyageModel: "voyage-3.5-lite",
    timeoutMs: 30_000,
    rateLimitRpm: 100,
    maxConcurrent: 10,
    cachePath: Option.none(),
    cacheTtlHours: 24,
    cacheMaxEntries: 10000,
    entityIndexPath: Option.none(),
  },
  extraction: {
    runsDir: "./output/runs",
    strictPersistence: true,
  },
  entityRegistry: {
    enabled: false,
    candidateThreshold: 0.6,
    resolutionThreshold: 0.8,
    maxCandidatesPerEntity: 20,
    maxBlockingCandidates: 100,
    canonicalNamespace: "http://example.org/entities/",
  },
  inference: {
    enabled: false,
    profile: "rdfs",
    persistDerived: true,
  },
  validation: {
    logOnly: false,
    failOnViolation: true,
    failOnWarning: false,
  },
  rdf: {
    baseNamespace: "http://example.org/kg/",
    outputFormat: "Turtle",
    prefixes: {
      schema: "http://schema.org/",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      owl: "http://www.w3.org/2002/07/owl#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
    },
  },
  api: {
    keys: Option.none(),
    requireAuth: false,
  },
  jina: {
    apiKey: Option.none(),
    rateLimitRpm: 20,
    timeoutMs: 30_000,
    maxConcurrent: 5,
    baseUrl: "https://r.jina.ai",
  },
};

// =============================================================================
// Service Definition
// =============================================================================

const makeConfigService = Effect.gen(function* () {
  const [
    llm,
    storage,
    ontology,
    runtime,
    grounder,
    embedding,
    extraction,
    entityRegistry,
    inference,
    validation,
    rdf,
    api,
    jina,
  ] = yield* Effect.all([
    LlmConfig,
    StorageConfig,
    OntologyConfig,
    RuntimeConfig,
    GrounderConfig,
    EmbeddingConfig,
    ExtractionConfig,
    EntityRegistryConfig,
    InferenceConfig,
    ValidationConfig,
    RdfConfig,
    ApiConfig,
    JinaConfig,
  ]);

  return {
    api,
    embedding,
    entityRegistry,
    extraction,
    grounder,
    inference,
    jina,
    llm,
    ontology,
    rdf,
    runtime,
    storage,
    validation,
  } satisfies AppConfig;
});


export class ConfigService extends Context.Service<ConfigService, AppConfig>()($I `ConfigService`) {}

/**
 * Default ConfigService layer reading from environment variables with defaults.
 */
export const ConfigServiceDefault = Layer.effect(ConfigService, makeConfigService);

/**
 * Create a ConfigService layer with a custom ConfigProvider.
 *
 * Use this when you need to override config values (e.g., CLI flags).
 * The custom provider takes precedence over environment variables.
 *
 * **Example** (Provide configuration overrides)
 *
 * ```ts
 * const customProvider = ConfigProvider.fromUnknown({ ONTOLOGY_EXTERNAL_VOCABS_PATH: "" }).pipe(
 *   ConfigProvider.orElse(() => ConfigProvider.fromEnv())
 * )
 * const CustomConfigLayer = makeConfigServiceLayer(customProvider)
 * ```
 */
export const makeConfigServiceLayer = (
  configProvider: import("effect").ConfigProvider.ConfigProvider
): Layer.Layer<ConfigService, Config.ConfigError> =>
  Layer.effect(ConfigService, makeConfigService).pipe(Layer.provide(ConfigProvider.layer(configProvider)));
