/**
 * Schema-backed application configuration and environment loading.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId, CoreVocab } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { XSD_NAMESPACE } from "@beep/rdf/Vocab/Xsd";
import { LiteralKit, PosInt } from "@beep/schema";
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

const llmSettingsApiKeyDefault = Redacted.make("");
const llmSettingsRetryPolicyDefault = RetryPolicy.make({});
const llmSettingsMaxTokensDefault = PosInt.make(4096);
const llmSettingsTemperatureDefault = UnitInterval.make(0.1);
const LlmSettings = S.Struct({
  provider: LlmProvider.pipe(
    S.withConstructorDefault(Effect.succeed(LlmProvider.Enum.anthropic)), S.withDecodingDefaultTypeKey(Effect.succeed(LlmProvider.Enum.anthropic)),
    S.annotateKey({ description: "Configured language-model provider." })
  ),
  model: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("claude-haiku-4-5")), S.withDecodingDefaultTypeKey(Effect.succeed("claude-haiku-4-5")),
    S.annotateKey({ description: "Provider model identifier." })
  ),
  apiKey: S.Redacted(S.String).pipe(
    S.withConstructorDefault(Effect.succeed(llmSettingsApiKeyDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(llmSettingsApiKeyDefault)),
    S.annotateKey({ description: "Redacted language-model provider credential." })
  ),
  retryPolicy: RetryPolicy.pipe(
    S.withConstructorDefault(Effect.succeed(llmSettingsRetryPolicyDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(llmSettingsRetryPolicyDefault)),
    S.annotateKey({ description: "Attempt, retry-delay, and overall-deadline policy for language-model calls." })
  ),
  maxTokens: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(llmSettingsMaxTokensDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(llmSettingsMaxTokensDefault)),
    S.annotateKey({ description: "Maximum output-token budget for one language-model response." })
  ),
  temperature: UnitInterval.pipe(
    S.withConstructorDefault(Effect.succeed(llmSettingsTemperatureDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(llmSettingsTemperatureDefault)),
    S.annotateKey({ description: "Normalized provider sampling temperature." })
  ),
  enablePromptCaching: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(true)), S.withDecodingDefaultTypeKey(Effect.succeed(true)),
    S.annotateKey({ description: "Whether supported providers may cache stable prompt prefixes." })
  ),
});

const storageSettingsBucketDefault = O.none();
const storageSettingsLocalPathDefault = O.none();
const StorageSettings = S.Struct({
  type: StorageType.pipe(
    S.withConstructorDefault(Effect.succeed(StorageType.Enum.local)), S.withDecodingDefaultTypeKey(Effect.succeed(StorageType.Enum.local)),
    S.annotateKey({ description: "Storage backend selected for ontology artifacts." })
  ),
  bucket: S.Option(S.String).pipe(
    S.withConstructorDefault(Effect.succeed(storageSettingsBucketDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(storageSettingsBucketDefault)),
    S.annotateKey({ description: "Optional cloud-storage bucket." })
  ),
  localPath: S.Option(S.String).pipe(
    S.withConstructorDefault(Effect.succeed(storageSettingsLocalPathDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(storageSettingsLocalPathDefault)),
    S.annotateKey({ description: "Optional local storage root." })
  ),
  prefix: S.String.pipe(
    S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultTypeKey(Effect.succeed("")),
    S.annotateKey({ description: "Key prefix applied to stored artifacts." })
  ),
});

const ontologySettingsRegistryPathDefault = O.none();
const ontologySettingsCacheTtlDefault = Duration.hours(1);
const OntologySettings = S.Struct({
  path: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("ontology.ttl")), S.withDecodingDefaultTypeKey(Effect.succeed("ontology.ttl")),
    S.annotateKey({ description: "Primary ontology document path." })
  ),
  externalVocabsPath: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("ontologies/external/merged-external.ttl")), S.withDecodingDefaultTypeKey(Effect.succeed("ontologies/external/merged-external.ttl")),
    S.annotateKey({ description: "Bundled external vocabulary document merged with the primary ontology." })
  ),
  registryPath: S.Option(S.String).pipe(
    S.withConstructorDefault(Effect.succeed(ontologySettingsRegistryPathDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(ontologySettingsRegistryPathDefault)),
    S.annotateKey({ description: "Optional ontology registry manifest path." })
  ),
  cacheTtl: S.Duration.pipe(
    S.withConstructorDefault(Effect.succeed(ontologySettingsCacheTtlDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(ontologySettingsCacheTtlDefault)),
    S.annotateKey({ description: "Lifetime of a cached ontology document." })
  ),
  strictValidation: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)), S.withDecodingDefaultTypeKey(Effect.succeed(false)),
    S.annotateKey({ description: "Whether ontology URI mismatches fail validation." })
  ),
});

const runtimeSettingsConcurrencyDefault = PosInt.make(4);
const runtimeSettingsLlmConcurrencyLimitDefault = PosInt.make(2);
const RuntimeSettings = S.Struct({
  concurrency: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(runtimeSettingsConcurrencyDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(runtimeSettingsConcurrencyDefault)),
    S.annotateKey({ description: "Maximum general workflow concurrency." })
  ),
  llmConcurrencyLimit: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(runtimeSettingsLlmConcurrencyLimitDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(runtimeSettingsLlmConcurrencyLimitDefault)),
    S.annotateKey({ description: "Maximum concurrent language-model calls." })
  ),
  enableTracing: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)), S.withDecodingDefaultTypeKey(Effect.succeed(false)),
    S.annotateKey({ description: "Whether runtime tracing is enabled." })
  ),
});

const grounderSettingsConfidenceThresholdDefault = UnitInterval.make(0.8);
const grounderSettingsBatchSizeDefault = PosInt.make(5);
const GrounderSettings = S.Struct({
  enabled: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(true)), S.withDecodingDefaultTypeKey(Effect.succeed(true)),
    S.annotateKey({ description: "Whether the grounding stage is enabled." })
  ),
  confidenceThreshold: UnitInterval.pipe(
    S.withConstructorDefault(Effect.succeed(grounderSettingsConfidenceThresholdDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(grounderSettingsConfidenceThresholdDefault)),
    S.annotateKey({ description: "Minimum normalized grounding confidence." })
  ),
  batchSize: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(grounderSettingsBatchSizeDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(grounderSettingsBatchSizeDefault)),
    S.annotateKey({ description: "Maximum entities processed in one grounding batch." })
  ),
});

const embeddingSettingsDimensionDefault = PosInt.make(768);
const embeddingSettingsVoyageApiKeyDefault = O.none();
const embeddingSettingsTimeoutDefault = Duration.seconds(30);
const embeddingSettingsRateLimitRpmDefault = PosInt.make(100);
const embeddingSettingsMaxConcurrentDefault = PosInt.make(10);
const embeddingSettingsCachePathDefault = O.none();
const embeddingSettingsCacheTtlDefault = Duration.hours(24);
const embeddingSettingsCacheMaxEntriesDefault = PosInt.make(10_000);
const embeddingSettingsEntityIndexPathDefault = O.none();
const EmbeddingSettings = S.Struct({
  provider: EmbeddingProvider.pipe(
    S.withConstructorDefault(Effect.succeed(EmbeddingProvider.Enum.nomic)), S.withDecodingDefaultTypeKey(Effect.succeed(EmbeddingProvider.Enum.nomic)),
    S.annotateKey({ description: "Configured embedding provider." })
  ),
  model: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("nomic-embed-text-v1.5")), S.withDecodingDefaultTypeKey(Effect.succeed("nomic-embed-text-v1.5")),
    S.annotateKey({ description: "Embedding model identifier." })
  ),
  dimension: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(embeddingSettingsDimensionDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(embeddingSettingsDimensionDefault)),
    S.annotateKey({ description: "Expected embedding vector dimension." })
  ),
  transformersModelId: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("Xenova/nomic-embed-text-v1")), S.withDecodingDefaultTypeKey(Effect.succeed("Xenova/nomic-embed-text-v1")),
    S.annotateKey({ description: "Transformers.js model identifier for local inference." })
  ),
  voyageApiKey: S.String.pipe(
    S.Redacted,
    S.Option,
    S.withConstructorDefault(Effect.succeed(embeddingSettingsVoyageApiKeyDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(embeddingSettingsVoyageApiKeyDefault)),
    S.annotateKey({ description: "Optional redacted Voyage API credential." })
  ),
  voyageModel: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("voyage-3.5-lite")), S.withDecodingDefaultTypeKey(Effect.succeed("voyage-3.5-lite")),
    S.annotateKey({ description: "Voyage embedding model identifier." })
  ),
  timeout: S.Duration.pipe(
    S.withConstructorDefault(Effect.succeed(embeddingSettingsTimeoutDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(embeddingSettingsTimeoutDefault)),
    S.annotateKey({ description: "Maximum duration of one embedding request." })
  ),
  rateLimitRpm: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(embeddingSettingsRateLimitRpmDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(embeddingSettingsRateLimitRpmDefault)),
    S.annotateKey({ description: "Embedding-provider requests allowed per minute." })
  ),
  maxConcurrent: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(embeddingSettingsMaxConcurrentDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(embeddingSettingsMaxConcurrentDefault)),
    S.annotateKey({ description: "Maximum concurrent embedding requests." })
  ),
  cachePath: S.Option(S.String).pipe(
    S.withConstructorDefault(Effect.succeed(embeddingSettingsCachePathDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(embeddingSettingsCachePathDefault)),
    S.annotateKey({ description: "Optional persistent embedding-cache path." })
  ),
  cacheTtl: S.Duration.pipe(
    S.withConstructorDefault(Effect.succeed(embeddingSettingsCacheTtlDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(embeddingSettingsCacheTtlDefault)),
    S.annotateKey({ description: "Lifetime of a cached embedding." })
  ),
  cacheMaxEntries: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(embeddingSettingsCacheMaxEntriesDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(embeddingSettingsCacheMaxEntriesDefault)),
    S.annotateKey({ description: "Maximum number of in-memory embedding-cache entries." })
  ),
  entityIndexPath: S.Option(S.String).pipe(
    S.withConstructorDefault(Effect.succeed(embeddingSettingsEntityIndexPathDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(embeddingSettingsEntityIndexPathDefault)),
    S.annotateKey({ description: "Optional persistent entity-index path." })
  ),
});

const ExtractionSettings = S.Struct({
  runsDir: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("./output/runs")), S.withDecodingDefaultTypeKey(Effect.succeed("./output/runs")),
    S.annotateKey({ description: "Base directory for extraction-run artifacts." })
  ),
  strictPersistence: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(true)), S.withDecodingDefaultTypeKey(Effect.succeed(true)),
    S.annotateKey({ description: "Whether claim-persistence failures fail the extraction workflow." })
  ),
});

const entityRegistrySettingsCandidateThresholdDefault = UnitInterval.make(0.6);
const entityRegistrySettingsResolutionThresholdDefault = UnitInterval.make(0.8);
const entityRegistrySettingsMaxCandidatesPerEntityDefault = PosInt.make(20);
const entityRegistrySettingsMaxBlockingCandidatesDefault = PosInt.make(100);
const EntityRegistrySettings = S.Struct({
  enabled: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)), S.withDecodingDefaultTypeKey(Effect.succeed(false)),
    S.annotateKey({ description: "Whether persistent cross-batch entity resolution is enabled." })
  ),
  candidateThreshold: UnitInterval.pipe(
    S.withConstructorDefault(Effect.succeed(entityRegistrySettingsCandidateThresholdDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(entityRegistrySettingsCandidateThresholdDefault)),
    S.annotateKey({ description: "Minimum similarity for candidate retrieval." })
  ),
  resolutionThreshold: UnitInterval.pipe(
    S.withConstructorDefault(Effect.succeed(entityRegistrySettingsResolutionThresholdDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(entityRegistrySettingsResolutionThresholdDefault)),
    S.annotateKey({ description: "Minimum similarity for a final entity-resolution decision." })
  ),
  maxCandidatesPerEntity: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(entityRegistrySettingsMaxCandidatesPerEntityDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(entityRegistrySettingsMaxCandidatesPerEntityDefault)),
    S.annotateKey({ description: "Maximum ANN candidates retained per entity." })
  ),
  maxBlockingCandidates: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(entityRegistrySettingsMaxBlockingCandidatesDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(entityRegistrySettingsMaxBlockingCandidatesDefault)),
    S.annotateKey({ description: "Maximum token-blocking candidates retained per entity." })
  ),
  canonicalNamespace: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("https://example.org/entities/")), S.withDecodingDefaultTypeKey(Effect.succeed("https://example.org/entities/")),
    S.annotateKey({ description: "Namespace used for generated canonical entity IRIs." })
  ),
});

const InferenceSettings = S.Struct({
  enabled: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)), S.withDecodingDefaultTypeKey(Effect.succeed(false)),
    S.annotateKey({ description: "Whether the inference stage is enabled." })
  ),
  profile: InferenceProfile.pipe(
    S.withConstructorDefault(Effect.succeed(InferenceProfile.Enum.rdfs)), S.withDecodingDefaultTypeKey(Effect.succeed(InferenceProfile.Enum.rdfs)),
    S.annotateKey({ description: "Rule profile used by the inference stage." })
  ),
  persistDerived: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(true)), S.withDecodingDefaultTypeKey(Effect.succeed(true)),
    S.annotateKey({ description: "Whether derived claims are persisted." })
  ),
});

const ValidationSettings = S.Struct({
  logOnly: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)), S.withDecodingDefaultTypeKey(Effect.succeed(false)),
    S.annotateKey({ description: "Whether validation failures are logged without failing workflows." })
  ),
  failOnViolation: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(true)), S.withDecodingDefaultTypeKey(Effect.succeed(true)),
    S.annotateKey({ description: "Whether SHACL violations fail a workflow." })
  ),
  failOnWarning: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)), S.withDecodingDefaultTypeKey(Effect.succeed(false)),
    S.annotateKey({ description: "Whether SHACL warnings fail a workflow." })
  ),
});

const rdfSettingsPrefixesDefault = {
      schema: IRI.make(CoreVocab.schema.iri),
      rdf: IRI.make(CoreVocab.rdf.iri),
      rdfs: IRI.make(CoreVocab.rdfs.iri),
      owl: IRI.make(CoreVocab.owl.iri),
      xsd: IRI.make(XSD_NAMESPACE),
    };
const RdfSettings = S.Struct({
  baseNamespace: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("https://example.org/kg/")), S.withDecodingDefaultTypeKey(Effect.succeed("https://example.org/kg/")),
    S.annotateKey({ description: "Base namespace used for generated graph identifiers." })
  ),
  outputFormat: RdfOutputFormat.pipe(
    S.withConstructorDefault(Effect.succeed(RdfOutputFormat.Enum.Turtle)), S.withDecodingDefaultTypeKey(Effect.succeed(RdfOutputFormat.Enum.Turtle)),
    S.annotateKey({ description: "Default RDF serialization format." })
  ),
  prefixes: S.Struct({
    schema: IRI,
    rdf: IRI,
    rdfs: IRI,
    owl: IRI,
    xsd: IRI,
  }).pipe(
    S.withConstructorDefault(Effect.succeed(rdfSettingsPrefixesDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(rdfSettingsPrefixesDefault)),
    S.annotateKey({ description: "Stable RDF namespace-prefix map." })
  ),
});

const apiSettingsKeysDefault = O.none();
const ApiSettings = S.Struct({
  keys: S.String.pipe(
    S.Redacted,
    S.Option,
    S.withConstructorDefault(Effect.succeed(apiSettingsKeysDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(apiSettingsKeysDefault)),
    S.annotateKey({ description: "Optional redacted comma-separated API keys." })
  ),
  requireAuth: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(true)), S.withDecodingDefaultTypeKey(Effect.succeed(true)),
    S.annotateKey({ description: "Whether versioned API endpoints require authentication." })
  ),
});

const jinaSettingsApiKeyDefault = O.none();
const jinaSettingsRateLimitRpmDefault = PosInt.make(20);
const jinaSettingsTimeoutDefault = Duration.seconds(30);
const jinaSettingsMaxConcurrentDefault = PosInt.make(5);
const JinaSettings = S.Struct({
  apiKey: S.String.pipe(
    S.Redacted,
    S.Option,
    S.withConstructorDefault(Effect.succeed(jinaSettingsApiKeyDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(jinaSettingsApiKeyDefault)),
    S.annotateKey({ description: "Optional redacted Jina Reader API credential." })
  ),
  rateLimitRpm: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(jinaSettingsRateLimitRpmDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(jinaSettingsRateLimitRpmDefault)),
    S.annotateKey({ description: "Jina Reader requests allowed per minute." })
  ),
  timeout: S.Duration.pipe(
    S.withConstructorDefault(Effect.succeed(jinaSettingsTimeoutDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(jinaSettingsTimeoutDefault)),
    S.annotateKey({ description: "Maximum duration of one Jina Reader request." })
  ),
  maxConcurrent: PosInt.pipe(
    S.withConstructorDefault(Effect.succeed(jinaSettingsMaxConcurrentDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(jinaSettingsMaxConcurrentDefault)),
    S.annotateKey({ description: "Maximum concurrent Jina Reader requests." })
  ),
  baseUrl: S.NonEmptyString.pipe(
    S.withConstructorDefault(Effect.succeed("https://r.jina.ai")), S.withDecodingDefaultTypeKey(Effect.succeed("https://r.jina.ai")),
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
    llm: LlmSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultLlmSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultLlmSettings))),
    storage: StorageSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultStorageSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultStorageSettings))),
    ontology: OntologySettings.pipe(S.withConstructorDefault(Effect.succeed(defaultOntologySettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultOntologySettings))),
    runtime: RuntimeSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultRuntimeSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultRuntimeSettings))),
    grounder: GrounderSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultGrounderSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultGrounderSettings))),
    embedding: EmbeddingSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultEmbeddingSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultEmbeddingSettings))),
    extraction: ExtractionSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultExtractionSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultExtractionSettings))),
    entityRegistry: EntityRegistrySettings.pipe(S.withConstructorDefault(Effect.succeed(defaultEntityRegistrySettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultEntityRegistrySettings))),
    inference: InferenceSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultInferenceSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultInferenceSettings))),
    validation: ValidationSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultValidationSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultValidationSettings))),
    rdf: RdfSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultRdfSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultRdfSettings))),
    api: ApiSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultApiSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultApiSettings))),
    jina: JinaSettings.pipe(S.withConstructorDefault(Effect.succeed(defaultJinaSettings)), S.withDecodingDefaultTypeKey(Effect.succeed(defaultJinaSettings))),
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
  attemptTimeout: Config.Duration("ATTEMPT_TIMEOUT").pipe(
    Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.attemptTimeout)
  ),
  overallTimeout: Config.Duration("OVERALL_TIMEOUT").pipe(
    Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.overallTimeout)
  ),
  initialDelay: Config.Duration("RETRY_INITIAL_DELAY").pipe(
    Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.initialDelay)
  ),
  maxDelay: Config.Duration("RETRY_MAX_DELAY").pipe(Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.maxDelay)),
  maxAttempts: Config.schema(PosInt, "RETRY_MAX_ATTEMPTS").pipe(
    Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.maxAttempts)
  ),
  serviceName: Config.succeed(DEFAULT_CONFIG.llm.retryPolicy.serviceName),
  jitter: Config.Boolean("RETRY_JITTER").pipe(Config.withDefault(DEFAULT_CONFIG.llm.retryPolicy.jitter)),
}).pipe(
  Config.mapEffect((input) =>
    RetryPolicy.decodeEffect(input).pipe(Effect.mapError((error) => new Config.ConfigError(error)))
  )
);

const LlmConfig = Config.nested("LLM")(
  Config.all({
    provider: Config.schema(LlmProvider, "PROVIDER").pipe(Config.withDefault(DEFAULT_CONFIG.llm.provider)),
    model: Config.NonEmptyString("MODEL").pipe(Config.withDefault(DEFAULT_CONFIG.llm.model)),
    apiKey: Config.Redacted("API_KEY").pipe(Config.withDefault(DEFAULT_CONFIG.llm.apiKey)),
    retryPolicy: RetryPolicyConfig,
    maxTokens: Config.schema(PosInt, "MAX_TOKENS").pipe(Config.withDefault(DEFAULT_CONFIG.llm.maxTokens)),
    temperature: Config.schema(UnitInterval, "TEMPERATURE").pipe(Config.withDefault(DEFAULT_CONFIG.llm.temperature)),
    enablePromptCaching: Config.Boolean("ENABLE_PROMPT_CACHING").pipe(
      Config.withDefault(DEFAULT_CONFIG.llm.enablePromptCaching)
    ),
  })
);

const StorageConfig = Config.nested("STORAGE")(
  Config.all({
    type: Config.schema(StorageType, "TYPE").pipe(Config.withDefault(DEFAULT_CONFIG.storage.type)),
    bucket: Config.option(Config.String("BUCKET")),
    localPath: Config.option(Config.String("LOCAL_PATH")),
    prefix: Config.String("PREFIX").pipe(Config.withDefault(DEFAULT_CONFIG.storage.prefix)),
  })
);

const OntologyConfig = Config.nested("ONTOLOGY")(
  Config.all({
    path: Config.NonEmptyString("PATH").pipe(Config.withDefault(DEFAULT_CONFIG.ontology.path)),
    externalVocabsPath: Config.NonEmptyString("EXTERNAL_VOCABS_PATH").pipe(
      Config.withDefault(DEFAULT_CONFIG.ontology.externalVocabsPath)
    ),
    registryPath: Config.option(Config.String("REGISTRY_PATH")),
    cacheTtl: Config.Duration("CACHE_TTL").pipe(Config.withDefault(DEFAULT_CONFIG.ontology.cacheTtl)),
    strictValidation: Config.Boolean("STRICT_VALIDATION").pipe(
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
    enableTracing: Config.Boolean("ENABLE_TRACING").pipe(Config.withDefault(DEFAULT_CONFIG.runtime.enableTracing)),
  })
);

const GrounderConfig = Config.nested("GROUNDER")(
  Config.all({
    enabled: Config.Boolean("ENABLED").pipe(Config.withDefault(DEFAULT_CONFIG.grounder.enabled)),
    confidenceThreshold: Config.schema(UnitInterval, "THRESHOLD").pipe(
      Config.withDefault(DEFAULT_CONFIG.grounder.confidenceThreshold)
    ),
    batchSize: Config.schema(PosInt, "BATCH_SIZE").pipe(Config.withDefault(DEFAULT_CONFIG.grounder.batchSize)),
  })
);

const EmbeddingConfig = Config.nested("EMBEDDING")(
  Config.all({
    provider: Config.schema(EmbeddingProvider, "PROVIDER").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.provider)),
    model: Config.NonEmptyString("MODEL").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.model)),
    dimension: Config.schema(PosInt, "DIMENSION").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.dimension)),
    transformersModelId: Config.NonEmptyString("TRANSFORMERS_MODEL_ID").pipe(
      Config.withDefault(DEFAULT_CONFIG.embedding.transformersModelId)
    ),
    voyageApiKey: Config.option(Config.Redacted("VOYAGE_API_KEY")),
    voyageModel: Config.NonEmptyString("VOYAGE_MODEL").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.voyageModel)),
    timeout: Config.Duration("TIMEOUT").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.timeout)),
    rateLimitRpm: Config.schema(PosInt, "RATE_LIMIT_RPM").pipe(
      Config.withDefault(DEFAULT_CONFIG.embedding.rateLimitRpm)
    ),
    maxConcurrent: Config.schema(PosInt, "MAX_CONCURRENT").pipe(
      Config.withDefault(DEFAULT_CONFIG.embedding.maxConcurrent)
    ),
    cachePath: Config.option(Config.String("CACHE_PATH")),
    cacheTtl: Config.Duration("CACHE_TTL").pipe(Config.withDefault(DEFAULT_CONFIG.embedding.cacheTtl)),
    cacheMaxEntries: Config.schema(PosInt, "CACHE_MAX_ENTRIES").pipe(
      Config.withDefault(DEFAULT_CONFIG.embedding.cacheMaxEntries)
    ),
    entityIndexPath: Config.option(Config.String("ENTITY_INDEX_PATH")),
  })
);

const ExtractionConfig = Config.nested("EXTRACTION")(
  Config.all({
    runsDir: Config.NonEmptyString("RUNS_DIR").pipe(Config.withDefault(DEFAULT_CONFIG.extraction.runsDir)),
    strictPersistence: Config.Boolean("STRICT_PERSISTENCE").pipe(
      Config.withDefault(DEFAULT_CONFIG.extraction.strictPersistence)
    ),
  })
);

const EntityRegistryConfig = Config.nested("ENTITY_REGISTRY")(
  Config.all({
    enabled: Config.Boolean("ENABLED").pipe(Config.withDefault(DEFAULT_CONFIG.entityRegistry.enabled)),
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
    canonicalNamespace: Config.NonEmptyString("CANONICAL_NAMESPACE").pipe(
      Config.withDefault(DEFAULT_CONFIG.entityRegistry.canonicalNamespace)
    ),
  })
);

const InferenceConfig = Config.nested("INFERENCE")(
  Config.all({
    enabled: Config.Boolean("ENABLED").pipe(Config.withDefault(DEFAULT_CONFIG.inference.enabled)),
    profile: Config.schema(InferenceProfile, "PROFILE").pipe(Config.withDefault(DEFAULT_CONFIG.inference.profile)),
    persistDerived: Config.Boolean("PERSIST_DERIVED").pipe(Config.withDefault(DEFAULT_CONFIG.inference.persistDerived)),
  })
);

const ValidationConfig = Config.nested("VALIDATION")(
  Config.all({
    logOnly: Config.Boolean("LOG_ONLY").pipe(Config.withDefault(DEFAULT_CONFIG.validation.logOnly)),
    failOnViolation: Config.Boolean("FAIL_ON_VIOLATION").pipe(
      Config.withDefault(DEFAULT_CONFIG.validation.failOnViolation)
    ),
    failOnWarning: Config.Boolean("FAIL_ON_WARNING").pipe(Config.withDefault(DEFAULT_CONFIG.validation.failOnWarning)),
  })
);

const RdfConfig = Config.nested("RDF")(
  Config.all({
    baseNamespace: Config.NonEmptyString("BASE_NAMESPACE").pipe(Config.withDefault(DEFAULT_CONFIG.rdf.baseNamespace)),
    outputFormat: Config.schema(RdfOutputFormat, "OUTPUT_FORMAT").pipe(
      Config.withDefault(DEFAULT_CONFIG.rdf.outputFormat)
    ),
    prefixes: Config.succeed(DEFAULT_CONFIG.rdf.prefixes),
  })
);

const ApiConfig = Config.nested("API")(
  Config.all({
    keys: Config.option(Config.Redacted("KEYS")),
    requireAuth: Config.Boolean("REQUIRE_AUTH").pipe(Config.withDefault(DEFAULT_CONFIG.api.requireAuth)),
  })
);

const JinaConfig = Config.nested("JINA")(
  Config.all({
    apiKey: Config.option(Config.Redacted("API_KEY")),
    rateLimitRpm: Config.schema(PosInt, "RATE_LIMIT_RPM").pipe(Config.withDefault(DEFAULT_CONFIG.jina.rateLimitRpm)),
    timeout: Config.Duration("TIMEOUT").pipe(Config.withDefault(DEFAULT_CONFIG.jina.timeout)),
    maxConcurrent: Config.schema(PosInt, "MAX_CONCURRENT").pipe(Config.withDefault(DEFAULT_CONFIG.jina.maxConcurrent)),
    baseUrl: Config.NonEmptyString("BASE_URL").pipe(Config.withDefault(DEFAULT_CONFIG.jina.baseUrl)),
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
 * **Example** (Read the configured LLM model)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 *
 * const model = Effect.runSync(
 *   Effect.gen(function* () {
 *     const config = yield* ConfigService
 *     return config.llm.model
 *   }).pipe(Effect.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG)))
 * )
 * console.log(model)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ConfigService extends Context.Service<ConfigService, AppConfig>()($I`ConfigService`) {}

/**
 * Live configuration layer backed by the ambient `ConfigProvider`.
 *
 * **Example** (Provide live config and read the LLM model)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ConfigService, ConfigServiceDefault } from "@effect-ontology/Service/Config"
 *
 * const model = Effect.runSync(
 *   Effect.gen(function* () {
 *     const config = yield* ConfigService
 *     return config.llm.model
 *   }).pipe(Effect.provide(ConfigServiceDefault), Effect.orDie)
 * )
 * console.log(model)
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
