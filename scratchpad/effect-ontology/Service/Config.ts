/**
 * Schema-backed application configuration and environment loading.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId, CoreVocab } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { XSD_NAMESPACE } from "@beep/rdf/Vocab/Xsd";
import { LiteralKit, PosInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Config, ConfigProvider, Context, Duration, Effect, Layer, Redacted } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { RetryPolicy } from "./Retry.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Config");

const LlmProvider = LiteralKit(["anthropic", "openai", "google"]);
const StorageType = LiteralKit(["local", "gcs", "memory"]);
const EmbeddingProvider = LiteralKit(["nomic", "voyage"]);
const InferenceProfile = LiteralKit(["rdfs", "rdfs-subclass", "owl-sameas", "custom"]);
const RdfOutputFormat = LiteralKit(["Turtle", "N-Triples", "JSON-LD"]);

const LlmSettings = S.Struct({
  provider: LlmProvider.pipe(
    SchemaUtils.withKeyDefaults(LlmProvider.Enum.anthropic),
    S.annotateKey({ description: "Configured language-model provider." })
  ),
  model: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("claude-haiku-4-5"),
    S.annotateKey({ description: "Provider model identifier." })
  ),
  apiKey: S.Redacted(S.String).pipe(
    SchemaUtils.withKeyDefaults(Redacted.make("")),
    S.annotateKey({ description: "Redacted language-model provider credential." })
  ),
  retryPolicy: RetryPolicy.pipe(
    SchemaUtils.withKeyDefaults(RetryPolicy.make({})),
    S.annotateKey({ description: "Attempt, retry-delay, and overall-deadline policy for language-model calls." })
  ),
  maxTokens: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(4096)),
    S.annotateKey({ description: "Maximum output-token budget for one language-model response." })
  ),
  temperature: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0.1)),
    S.annotateKey({ description: "Normalized provider sampling temperature." })
  ),
  enablePromptCaching: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(true),
    S.annotateKey({ description: "Whether supported providers may cache stable prompt prefixes." })
  ),
});

const StorageSettings = S.Struct({
  type: StorageType.pipe(
    SchemaUtils.withKeyDefaults(StorageType.Enum.local),
    S.annotateKey({ description: "Storage backend selected for ontology artifacts." })
  ),
  bucket: S.Option(S.String).pipe(
    SchemaUtils.withKeyDefaults(O.none()),
    S.annotateKey({ description: "Optional cloud-storage bucket." })
  ),
  localPath: S.Option(S.String).pipe(
    SchemaUtils.withKeyDefaults(O.none()),
    S.annotateKey({ description: "Optional local storage root." })
  ),
  prefix: S.String.pipe(
    SchemaUtils.withKeyDefaults(""),
    S.annotateKey({ description: "Key prefix applied to stored artifacts." })
  ),
});

const OntologySettings = S.Struct({
  path: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("ontology.ttl"),
    S.annotateKey({ description: "Primary ontology document path." })
  ),
  externalVocabsPath: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("ontologies/external/merged-external.ttl"),
    S.annotateKey({ description: "Bundled external vocabulary document merged with the primary ontology." })
  ),
  registryPath: S.Option(S.String).pipe(
    SchemaUtils.withKeyDefaults(O.none()),
    S.annotateKey({ description: "Optional ontology registry manifest path." })
  ),
  cacheTtl: S.Duration.pipe(
    SchemaUtils.withKeyDefaults(Duration.hours(1)),
    S.annotateKey({ description: "Lifetime of a cached ontology document." })
  ),
  strictValidation: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(false),
    S.annotateKey({ description: "Whether ontology URI mismatches fail validation." })
  ),
});

const RuntimeSettings = S.Struct({
  concurrency: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(4)),
    S.annotateKey({ description: "Maximum general workflow concurrency." })
  ),
  llmConcurrencyLimit: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(2)),
    S.annotateKey({ description: "Maximum concurrent language-model calls." })
  ),
  enableTracing: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(false),
    S.annotateKey({ description: "Whether runtime tracing is enabled." })
  ),
});

const GrounderSettings = S.Struct({
  enabled: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(true),
    S.annotateKey({ description: "Whether the grounding stage is enabled." })
  ),
  confidenceThreshold: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0.8)),
    S.annotateKey({ description: "Minimum normalized grounding confidence." })
  ),
  batchSize: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(5)),
    S.annotateKey({ description: "Maximum entities processed in one grounding batch." })
  ),
});

const EmbeddingSettings = S.Struct({
  provider: EmbeddingProvider.pipe(
    SchemaUtils.withKeyDefaults(EmbeddingProvider.Enum.nomic),
    S.annotateKey({ description: "Configured embedding provider." })
  ),
  model: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("nomic-embed-text-v1.5"),
    S.annotateKey({ description: "Embedding model identifier." })
  ),
  dimension: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(768)),
    S.annotateKey({ description: "Expected embedding vector dimension." })
  ),
  transformersModelId: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("Xenova/nomic-embed-text-v1"),
    S.annotateKey({ description: "Transformers.js model identifier for local inference." })
  ),
  voyageApiKey: S.String.pipe(
    S.Redacted,
    S.Option,
    SchemaUtils.withKeyDefaults(O.none()),
    S.annotateKey({ description: "Optional redacted Voyage API credential." })
  ),
  voyageModel: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("voyage-3.5-lite"),
    S.annotateKey({ description: "Voyage embedding model identifier." })
  ),
  timeout: S.Duration.pipe(
    SchemaUtils.withKeyDefaults(Duration.seconds(30)),
    S.annotateKey({ description: "Maximum duration of one embedding request." })
  ),
  rateLimitRpm: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(100)),
    S.annotateKey({ description: "Embedding-provider requests allowed per minute." })
  ),
  maxConcurrent: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(10)),
    S.annotateKey({ description: "Maximum concurrent embedding requests." })
  ),
  cachePath: S.Option(S.String).pipe(
    SchemaUtils.withKeyDefaults(O.none()),
    S.annotateKey({ description: "Optional persistent embedding-cache path." })
  ),
  cacheTtl: S.Duration.pipe(
    SchemaUtils.withKeyDefaults(Duration.hours(24)),
    S.annotateKey({ description: "Lifetime of a cached embedding." })
  ),
  cacheMaxEntries: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(10_000)),
    S.annotateKey({ description: "Maximum number of in-memory embedding-cache entries." })
  ),
  entityIndexPath: S.Option(S.String).pipe(
    SchemaUtils.withKeyDefaults(O.none()),
    S.annotateKey({ description: "Optional persistent entity-index path." })
  ),
});

const ExtractionSettings = S.Struct({
  runsDir: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("./output/runs"),
    S.annotateKey({ description: "Base directory for extraction-run artifacts." })
  ),
  strictPersistence: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(true),
    S.annotateKey({ description: "Whether claim-persistence failures fail the extraction workflow." })
  ),
});

const EntityRegistrySettings = S.Struct({
  enabled: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(false),
    S.annotateKey({ description: "Whether persistent cross-batch entity resolution is enabled." })
  ),
  candidateThreshold: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0.6)),
    S.annotateKey({ description: "Minimum similarity for candidate retrieval." })
  ),
  resolutionThreshold: UnitInterval.pipe(
    SchemaUtils.withKeyDefaults(UnitInterval.make(0.8)),
    S.annotateKey({ description: "Minimum similarity for a final entity-resolution decision." })
  ),
  maxCandidatesPerEntity: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(20)),
    S.annotateKey({ description: "Maximum ANN candidates retained per entity." })
  ),
  maxBlockingCandidates: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(100)),
    S.annotateKey({ description: "Maximum token-blocking candidates retained per entity." })
  ),
  canonicalNamespace: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("https://example.org/entities/"),
    S.annotateKey({ description: "Namespace used for generated canonical entity IRIs." })
  ),
});

const InferenceSettings = S.Struct({
  enabled: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(false),
    S.annotateKey({ description: "Whether the inference stage is enabled." })
  ),
  profile: InferenceProfile.pipe(
    SchemaUtils.withKeyDefaults(InferenceProfile.Enum.rdfs),
    S.annotateKey({ description: "Rule profile used by the inference stage." })
  ),
  persistDerived: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(true),
    S.annotateKey({ description: "Whether derived claims are persisted." })
  ),
});

const ValidationSettings = S.Struct({
  logOnly: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(false),
    S.annotateKey({ description: "Whether validation failures are logged without failing workflows." })
  ),
  failOnViolation: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(true),
    S.annotateKey({ description: "Whether SHACL violations fail a workflow." })
  ),
  failOnWarning: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(false),
    S.annotateKey({ description: "Whether SHACL warnings fail a workflow." })
  ),
});

const RdfSettings = S.Struct({
  baseNamespace: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("https://example.org/kg/"),
    S.annotateKey({ description: "Base namespace used for generated graph identifiers." })
  ),
  outputFormat: RdfOutputFormat.pipe(
    SchemaUtils.withKeyDefaults(RdfOutputFormat.Enum.Turtle),
    S.annotateKey({ description: "Default RDF serialization format." })
  ),
  prefixes: S.Struct({
    schema: IRI,
    rdf: IRI,
    rdfs: IRI,
    owl: IRI,
    xsd: IRI,
  }).pipe(
    SchemaUtils.withKeyDefaults({
      schema: IRI.make(CoreVocab.schema.iri),
      rdf: IRI.make(CoreVocab.rdf.iri),
      rdfs: IRI.make(CoreVocab.rdfs.iri),
      owl: IRI.make(CoreVocab.owl.iri),
      xsd: IRI.make(XSD_NAMESPACE),
    }),
    S.annotateKey({ description: "Stable RDF namespace-prefix map." })
  ),
});

const ApiSettings = S.Struct({
  keys: S.String.pipe(
    S.Redacted,
    S.Option,
    SchemaUtils.withKeyDefaults(O.none()),
    S.annotateKey({ description: "Optional redacted comma-separated API keys." })
  ),
  requireAuth: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(true),
    S.annotateKey({ description: "Whether versioned API endpoints require authentication." })
  ),
});

const JinaSettings = S.Struct({
  apiKey: S.String.pipe(
    S.Redacted,
    S.Option,
    SchemaUtils.withKeyDefaults(O.none()),
    S.annotateKey({ description: "Optional redacted Jina Reader API credential." })
  ),
  rateLimitRpm: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(20)),
    S.annotateKey({ description: "Jina Reader requests allowed per minute." })
  ),
  timeout: S.Duration.pipe(
    SchemaUtils.withKeyDefaults(Duration.seconds(30)),
    S.annotateKey({ description: "Maximum duration of one Jina Reader request." })
  ),
  maxConcurrent: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(5)),
    S.annotateKey({ description: "Maximum concurrent Jina Reader requests." })
  ),
  baseUrl: S.NonEmptyString.pipe(
    SchemaUtils.withKeyDefaults("https://r.jina.ai"),
    S.annotateKey({ description: "Jina Reader service base URL." })
  ),
});

const defaultLlmSettings = LlmSettings.make({});
const defaultStorageSettings = StorageSettings.make({});
const defaultOntologySettings = OntologySettings.make({});
const defaultRuntimeSettings = RuntimeSettings.make({});
const defaultGrounderSettings = GrounderSettings.make({});
const defaultEmbeddingSettings = EmbeddingSettings.make({});
const defaultExtractionSettings = ExtractionSettings.make({});
const defaultEntityRegistrySettings = EntityRegistrySettings.make({});
const defaultInferenceSettings = InferenceSettings.make({});
const defaultValidationSettings = ValidationSettings.make({});
const defaultRdfSettings = RdfSettings.make({});
const defaultApiSettings = ApiSettings.make({});
const defaultJinaSettings = JinaSettings.make({});

/**
 * Complete validated application configuration.
 *
 * **Details**
 *
 * Defaults live on the schemas that own each setting. Durations remain
 * `Duration.Duration` values from configuration loading through service use;
 * numeric millisecond conversion is reserved for external wire contracts.
 *
 * **Example** (Construct default configuration)
 *
 * ```ts
 * import { AppConfig } from "@effect-ontology/Service/Config"
 *
 * const config = AppConfig.make({})
 * console.log(config.llm.retryPolicy.maxAttempts) // 3
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class AppConfig extends S.Class<AppConfig>($I`AppConfig`)(
  {
    llm: LlmSettings.pipe(SchemaUtils.withKeyDefaults(defaultLlmSettings)),
    storage: StorageSettings.pipe(SchemaUtils.withKeyDefaults(defaultStorageSettings)),
    ontology: OntologySettings.pipe(SchemaUtils.withKeyDefaults(defaultOntologySettings)),
    runtime: RuntimeSettings.pipe(SchemaUtils.withKeyDefaults(defaultRuntimeSettings)),
    grounder: GrounderSettings.pipe(SchemaUtils.withKeyDefaults(defaultGrounderSettings)),
    embedding: EmbeddingSettings.pipe(SchemaUtils.withKeyDefaults(defaultEmbeddingSettings)),
    extraction: ExtractionSettings.pipe(SchemaUtils.withKeyDefaults(defaultExtractionSettings)),
    entityRegistry: EntityRegistrySettings.pipe(SchemaUtils.withKeyDefaults(defaultEntityRegistrySettings)),
    inference: InferenceSettings.pipe(SchemaUtils.withKeyDefaults(defaultInferenceSettings)),
    validation: ValidationSettings.pipe(SchemaUtils.withKeyDefaults(defaultValidationSettings)),
    rdf: RdfSettings.pipe(SchemaUtils.withKeyDefaults(defaultRdfSettings)),
    api: ApiSettings.pipe(SchemaUtils.withKeyDefaults(defaultApiSettings)),
    jina: JinaSettings.pipe(SchemaUtils.withKeyDefaults(defaultJinaSettings)),
  },
  $I.annote("AppConfig", {
    description: "Schema-backed configuration for ontology extraction, storage, inference, and provider services.",
  })
) {}

/**
 * Application configuration constructed exclusively from schema defaults.
 *
 * **Example** (Inspect the default LLM deadline)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 *
 * console.log(Duration.toSeconds(DEFAULT_CONFIG.llm.retryPolicy.attemptTimeout)) // 60
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_CONFIG = AppConfig.make({});

const RetryPolicyConfig = Config.all({
  attemptTimeout: Config.duration("ATTEMPT_TIMEOUT").pipe(
    Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.attemptTimeout)
  ),
  overallTimeout: Config.duration("OVERALL_TIMEOUT").pipe(
    Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.overallTimeout)
  ),
  initialDelay: Config.duration("RETRY_INITIAL_DELAY").pipe(
    Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.initialDelay)
  ),
  maxDelay: Config.duration("RETRY_MAX_DELAY").pipe(Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.maxDelay)),
  maxAttempts: Config.schema(PosInt, "RETRY_MAX_ATTEMPTS").pipe(
    Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.maxAttempts)
  ),
  serviceName: Config.succeed(DEFAULT_CONFIG.llm.retryPolicy.serviceName),
  jitter: Config.boolean("RETRY_JITTER").pipe(Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.jitter)),
}).pipe(
  Config.mapOrFail((input) =>
    RetryPolicy.decodeEffect(input).pipe(Effect.mapError((error) => new Config.ConfigError(error)))
  )
);

const LlmConfig = Config.nested("LLM")(
  Config.all({
    provider: Config.schema(LlmProvider, "PROVIDER").pipe(Config.withDefault(DEFAULT_CONFIG.llm.provider)),
    model: Config.nonEmptyString("MODEL").pipe(Config.withDefault(DEFAULT_CONFIG.llm.model)),
    apiKey: Config.redacted("API_KEY").pipe(Config.withDefault(DEFAULT_CONFIG.llm.apiKey)),
    retryPolicy: RetryPolicyConfig,
    maxTokens: Config.schema(PosInt, "MAX_TOKENS").pipe(Config.withDefault(DEFAULT_CONFIG.llm.maxTokens)),
    temperature: Config.schema(UnitInterval, "TEMPERATURE").pipe(Config.withDefault(DEFAULT_CONFIG.llm.temperature)),
    enablePromptCaching: Config.boolean("ENABLE_PROMPT_CACHING").pipe(
      Config.withDefault(DEFAULT_CONFIG.llm.enablePromptCaching)
    ),
  })
);

const StorageConfig = Config.nested("STORAGE")(
  Config.all({
    type: Config.schema(StorageType, "TYPE").pipe(Config.withDefault(DEFAULT_CONFIG.storage.type)),
    bucket: Config.option(Config.string("BUCKET")),
    localPath: Config.option(Config.string("LOCAL_PATH")),
    prefix: Config.string("PREFIX").pipe(Config.withDefault(DEFAULT_CONFIG.storage.prefix)),
  })
);

const OntologyConfig = Config.nested("ONTOLOGY")(
  Config.all({
    path: Config.nonEmptyString("PATH").pipe(Config.withDefault(DEFAULT_CONFIG.ontology.path)),
    externalVocabsPath: Config.nonEmptyString("EXTERNAL_VOCABS_PATH").pipe(
      Config.withDefault(DEFAULT_CONFIG.ontology.externalVocabsPath)
    ),
    registryPath: Config.option(Config.string("REGISTRY_PATH")),
    cacheTtl: Config.duration("CACHE_TTL").pipe(Config.withDefault(DEFAULT_CONFIG.ontology.cacheTtl)),
    strictValidation: Config.boolean("STRICT_VALIDATION").pipe(
      Config.withDefault(DEFAULT_CONFIG.ontology.strictValidation)
    ),
  })
);

const RuntimeConfig = Config.nested("RUNTIME")(
  Config.all({
    concurrency: Config.schema(PosInt, "CONCURRENCY").pipe(Config.withDefault(DEFAULT_CONFIG.runtime.concurrency)),
    llmConcurrencyLimit: Config.schema(PosInt, "LLM_CONCURRENCY").pipe(
      Config.withDefault(DEFAULT_CONFIG.runtime.llmConcurrencyLimit)
    ),
    enableTracing: Config.boolean("ENABLE_TRACING").pipe(Config.withDefault(DEFAULT_CONFIG.runtime.enableTracing)),
  })
);

const GrounderConfig = Config.nested("GROUNDER")(
  Config.all({
    enabled: Config.boolean("ENABLED").pipe(Config.withDefault(DEFAULT_CONFIG.grounder.enabled)),
    confidenceThreshold: Config.schema(UnitInterval, "THRESHOLD").pipe(
      Config.withDefault(DEFAULT_CONFIG.grounder.confidenceThreshold)
    ),
    batchSize: Config.schema(PosInt, "BATCH_SIZE").pipe(Config.withDefault(DEFAULT_CONFIG.grounder.batchSize)),
  })
);

const EmbeddingConfig = Config.nested("EMBEDDING")(
  Config.all({
    provider: Config.schema(EmbeddingProvider, "PROVIDER").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.provider)),
    model: Config.nonEmptyString("MODEL").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.model)),
    dimension: Config.schema(PosInt, "DIMENSION").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.dimension)),
    transformersModelId: Config.nonEmptyString("TRANSFORMERS_MODEL_ID").pipe(
      Config.withDefault(DEFAULT_CONFIG.embedding.transformersModelId)
    ),
    voyageApiKey: Config.option(Config.redacted("VOYAGE_API_KEY")),
    voyageModel: Config.nonEmptyString("VOYAGE_MODEL").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.voyageModel)),
    timeout: Config.duration("TIMEOUT").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.timeout)),
    rateLimitRpm: Config.schema(PosInt, "RATE_LIMIT_RPM").pipe(
      Config.withDefault(DEFAULT_CONFIG.embedding.rateLimitRpm)
    ),
    maxConcurrent: Config.schema(PosInt, "MAX_CONCURRENT").pipe(
      Config.withDefault(DEFAULT_CONFIG.embedding.maxConcurrent)
    ),
    cachePath: Config.option(Config.string("CACHE_PATH")),
    cacheTtl: Config.duration("CACHE_TTL").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.cacheTtl)),
    cacheMaxEntries: Config.schema(PosInt, "CACHE_MAX_ENTRIES").pipe(
      Config.withDefault(DEFAULT_CONFIG.embedding.cacheMaxEntries)
    ),
    entityIndexPath: Config.option(Config.string("ENTITY_INDEX_PATH")),
  })
);

const ExtractionConfig = Config.nested("EXTRACTION")(
  Config.all({
    runsDir: Config.nonEmptyString("RUNS_DIR").pipe(Config.withDefault(DEFAULT_CONFIG.extraction.runsDir)),
    strictPersistence: Config.boolean("STRICT_PERSISTENCE").pipe(
      Config.withDefault(DEFAULT_CONFIG.extraction.strictPersistence)
    ),
  })
);

const EntityRegistryConfig = Config.nested("ENTITY_REGISTRY")(
  Config.all({
    enabled: Config.boolean("ENABLED").pipe(Config.withDefault(DEFAULT_CONFIG.entityRegistry.enabled)),
    candidateThreshold: Config.schema(UnitInterval, "CANDIDATE_THRESHOLD").pipe(
      Config.withDefault(DEFAULT_CONFIG.entityRegistry.candidateThreshold)
    ),
    resolutionThreshold: Config.schema(UnitInterval, "RESOLUTION_THRESHOLD").pipe(
      Config.withDefault(DEFAULT_CONFIG.entityRegistry.resolutionThreshold)
    ),
    maxCandidatesPerEntity: Config.schema(PosInt, "MAX_CANDIDATES").pipe(
      Config.withDefault(DEFAULT_CONFIG.entityRegistry.maxCandidatesPerEntity)
    ),
    maxBlockingCandidates: Config.schema(PosInt, "MAX_BLOCKING").pipe(
      Config.withDefault(DEFAULT_CONFIG.entityRegistry.maxBlockingCandidates)
    ),
    canonicalNamespace: Config.nonEmptyString("CANONICAL_NAMESPACE").pipe(
      Config.withDefault(DEFAULT_CONFIG.entityRegistry.canonicalNamespace)
    ),
  })
);

const InferenceConfig = Config.nested("INFERENCE")(
  Config.all({
    enabled: Config.boolean("ENABLED").pipe(Config.withDefault(DEFAULT_CONFIG.inference.enabled)),
    profile: Config.schema(InferenceProfile, "PROFILE").pipe(Config.withDefault(DEFAULT_CONFIG.inference.profile)),
    persistDerived: Config.boolean("PERSIST_DERIVED").pipe(Config.withDefault(DEFAULT_CONFIG.inference.persistDerived)),
  })
);

const ValidationConfig = Config.nested("VALIDATION")(
  Config.all({
    logOnly: Config.boolean("LOG_ONLY").pipe(Config.withDefault(DEFAULT_CONFIG.validation.logOnly)),
    failOnViolation: Config.boolean("FAIL_ON_VIOLATION").pipe(
      Config.withDefault(DEFAULT_CONFIG.validation.failOnViolation)
    ),
    failOnWarning: Config.boolean("FAIL_ON_WARNING").pipe(Config.withDefault(DEFAULT_CONFIG.validation.failOnWarning)),
  })
);

const RdfConfig = Config.nested("RDF")(
  Config.all({
    baseNamespace: Config.nonEmptyString("BASE_NAMESPACE").pipe(Config.withDefault(DEFAULT_CONFIG.rdf.baseNamespace)),
    outputFormat: Config.schema(RdfOutputFormat, "OUTPUT_FORMAT").pipe(
      Config.withDefault(DEFAULT_CONFIG.rdf.outputFormat)
    ),
    prefixes: Config.succeed(DEFAULT_CONFIG.rdf.prefixes),
  })
);

const ApiConfig = Config.nested("API")(
  Config.all({
    keys: Config.option(Config.redacted("KEYS")),
    requireAuth: Config.boolean("REQUIRE_AUTH").pipe(Config.withDefault(DEFAULT_CONFIG.api.requireAuth)),
  })
);

const JinaConfig = Config.nested("JINA")(
  Config.all({
    apiKey: Config.option(Config.redacted("API_KEY")),
    rateLimitRpm: Config.schema(PosInt, "RATE_LIMIT_RPM").pipe(Config.withDefault(DEFAULT_CONFIG.jina.rateLimitRpm)),
    timeout: Config.duration("TIMEOUT").pipe(Config.withDefault(DEFAULT_CONFIG.jina.timeout)),
    maxConcurrent: Config.schema(PosInt, "MAX_CONCURRENT").pipe(Config.withDefault(DEFAULT_CONFIG.jina.maxConcurrent)),
    baseUrl: Config.nonEmptyString("BASE_URL").pipe(Config.withDefault(DEFAULT_CONFIG.jina.baseUrl)),
  })
);

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

  return AppConfig.make({
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
  });
});

/**
 * Application configuration service.
 *
 * **Example** (Access application configuration)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ConfigService } from "@effect-ontology/Service/Config"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* ConfigService
 *   return config.llm.model
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ConfigService extends Context.Service<ConfigService, AppConfig>()($I`ConfigService`) {}

/**
 * Live configuration layer backed by the ambient `ConfigProvider`.
 *
 * **Example** (Inspect the live configuration layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { ConfigServiceDefault } from "@effect-ontology/Service/Config"
 *
 * console.log(Layer.isLayer(ConfigServiceDefault)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ConfigServiceDefault = Layer.effect(ConfigService, makeConfigService);

/**
 * Builds a configuration layer using a specific provider.
 *
 * **Example** (Provide configuration overrides)
 *
 * ```ts
 * import { ConfigProvider } from "effect"
 * import { makeConfigServiceLayer } from "@effect-ontology/Service/Config"
 *
 * const provider = ConfigProvider.fromUnknown({ LLM_MODEL: "claude-haiku-4-5" })
 * console.log(makeConfigServiceLayer(provider))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeConfigServiceLayer = (
  configProvider: ConfigProvider.ConfigProvider
): Layer.Layer<ConfigService, Config.ConfigError> =>
  Layer.effect(ConfigService, makeConfigService).pipe(Layer.provide(ConfigProvider.layer(configProvider)));
