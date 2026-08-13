/**
 * Extraction-run configuration, audit, status, and aggregate values.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import { PrimaryKey } from "effect";
import * as S from "effect/Schema";
import { DocumentId, IdempotencyKey, OntologyVersion } from "../Identity.ts";
import { PathLayout } from "../PathLayout.ts";
import { OntologyRef } from "./Ontology.ts";
import { OutputType } from "./OutputType.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/ExtractionRun");

/**
 * Stable code describing why an extraction run terminated unsuccessfully.
 *
 * @example
 * ```ts
 * import { ErrorCode } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * console.log(ErrorCode.is.rate_limited("rate_limited")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ErrorCode = LiteralKit([
  "validation",
  "llm_error",
  "storage",
  "timeout",
  "rate_limited",
  "cancelled",
  "unknown",
])
  .annotate({
    toArbitrary: () => (fc) =>
      fc.constantFrom("validation", "llm_error", "storage", "timeout", "rate_limited", "cancelled", "unknown"),
  })
  .annotate(
    $I.annote("ErrorCode", {
      description: "Closed set of terminal extraction-run failure categories.",
    })
  );

/**
 * Runtime value accepted by {@link ErrorCode}.
 *
 * @example
 * ```ts
 * import type { ErrorCode } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const code: ErrorCode = "timeout"
 * console.log(code) // "timeout"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ErrorCode = typeof ErrorCode.Type;

/**
 * Audit event category recorded during an extraction run.
 *
 * @example
 * ```ts
 * import { AuditEventType } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * console.log(AuditEventType.is.warning("warning")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AuditEventType = LiteralKit(["started", "completed", "failed", "info", "warning"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("started", "completed", "failed", "info", "warning"),
  })
  .annotate(
    $I.annote("AuditEventType", {
      description: "Closed set of categories for extraction-run audit events.",
    })
  );

/**
 * Runtime value accepted by {@link AuditEventType}.
 *
 * @example
 * ```ts
 * import type { AuditEventType } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const type: AuditEventType = "info"
 * console.log(type) // "info"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AuditEventType = typeof AuditEventType.Type;

const OutputMetadataFields = {
  type: OutputType.annotateKey({
    description: "Logical output artifact kind.",
  }),
  path: S.NonEmptyString.annotateKey({
    description: "Storage-relative artifact path.",
  }),
  hash: Sha256Hex.annotateKey({
    description: "Full SHA-256 digest of the saved artifact.",
  }),
  size: NonNegativeInt.annotateKey({
    description: "Artifact size in bytes.",
  }),
  savedAt: S.DateTimeUtcFromString.annotateKey({
    description: "UTC instant at which persistence completed.",
  }),
} as const;

/**
 * Integrity and location metadata for one persisted run output.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 * import { OutputMetadata } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const output = S.decodeUnknownSync(OutputMetadata)({
 *   type: "entities",
 *   path: "runs/doc-0123456789ab/outputs/entities.json",
 *   hash: "a".repeat(64),
 *   size: 128,
 *   savedAt: DateTime.formatIso(DateTime.nowUnsafe())
 * })
 * console.log(output.type) // "entities"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutputMetadata extends S.Class<OutputMetadata>($I`OutputMetadata`)(
  OutputMetadataFields,
  $I.annote("OutputMetadata", {
    description: "Typed output kind, path, integrity digest, size, and persistence time.",
  })
) {}

const AuditEventFields = {
  timestamp: S.DateTimeUtcFromString,
  type: AuditEventType,
  data: S.Record(S.String, S.Json).pipe(SchemaUtils.withKeyDefaults({})),
} as const;

/**
 * Structured, JSON-compatible extraction-run audit event.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 * import { AuditEvent } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const event = AuditEvent.make({
 *   timestamp: DateTime.nowUnsafe(),
 *   type: "started"
 * })
 * console.log(event.type) // "started"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AuditEvent extends S.Class<AuditEvent>($I`AuditEvent`)(
  AuditEventFields,
  $I.annote("AuditEvent", {
    description: "Timestamped audit event with a stable category and JSON-compatible data.",
  })
) {}

const AuditErrorFields = {
  timestamp: S.DateTimeUtcFromString,
  type: ErrorCode,
  message: S.NonEmptyString,
  context: S.Record(S.String, S.Json).pipe(SchemaUtils.withKeyDefaults({})),
} as const;

/**
 * Structured error retained in an extraction run's audit trail.
 *
 * @example
 * ```ts
 * import { DateTime } from "effect"
 * import { AuditError } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const error = AuditError.make({
 *   timestamp: DateTime.nowUnsafe(),
 *   type: "timeout",
 *   message: "The model call exceeded its deadline."
 * })
 * console.log(error.type) // "timeout"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AuditError extends S.Class<AuditError>($I`AuditError`)(
  AuditErrorFields,
  $I.annote("AuditError", {
    description: "Timestamped extraction failure with a stable code and JSON-compatible context.",
  })
) {}

/**
 * Canonical discriminated lifecycle state for an extraction run.
 *
 * @remarks
 * Failure details and terminal timestamps are nested in their legal variants,
 * eliminating the upstream status string plus optional error/timestamp bag.
 *
 * @example
 * ```ts
 * import { RunStatus } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const status = RunStatus.cases.Pending.make({})
 * console.log(status._tag) // "Pending"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunStatus = S.TaggedUnion({
  Pending: {},
  Running: { startedAt: S.DateTimeUtcFromString },
  Complete: { completedAt: S.DateTimeUtcFromString },
  Failed: {
    failedAt: S.DateTimeUtcFromString,
    error: AuditError,
  },
}).pipe(
  $I.annoteSchema("RunStatus", {
    description: "Discriminated extraction-run lifecycle with variant-specific timing and failure data.",
    toArbitrary: () => (fc) =>
      S.toArbitrary(
        S.TaggedUnion({
          Pending: {},
          Running: { startedAt: S.DateTimeUtcFromString },
          Complete: { completedAt: S.DateTimeUtcFromString },
          Failed: { failedAt: S.DateTimeUtcFromString, error: AuditError },
        })
      )(fc),
  })
);

/**
 * Runtime value decoded by {@link RunStatus}.
 *
 * @example
 * ```ts
 * import type { RunStatus } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const status: RunStatus = { _tag: "Pending" }
 * console.log(status._tag) // "Pending"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunStatus = typeof RunStatus.Type;

const ChunkSize = S.Int.check(
  S.isBetween(
    { minimum: 100, maximum: 10_000 },
    {
      identifier: $I`ChunkSizeRangeCheck`,
      title: "Chunk Size Range",
      description: "A chunk size from 100 through 10,000 tokens.",
      message: "Chunk size must be an integer between 100 and 10000.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 100, max: 10_000 }),
  })
  .pipe(
    $I.annoteSchema("ChunkSize", {
      description: "Maximum extraction chunk size measured in tokens.",
    })
  );

const OverlapTokens = S.Int.check(
  S.isBetween(
    { minimum: 0, maximum: 200 },
    {
      identifier: $I`OverlapTokensRangeCheck`,
      title: "Chunk Overlap Range",
      description: "A chunk overlap from zero through 200 tokens.",
      message: "Chunk overlap must be an integer between 0 and 200.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 0, max: 200 }),
  })
  .pipe(
    $I.annoteSchema("OverlapTokens", {
      description: "Number of tokens repeated between adjacent extraction chunks.",
    })
  );

const ChunkingConfigFields = {
  maxChunkSize: ChunkSize.pipe(SchemaUtils.withKeyDefaults(4_000)),
  preserveSentences: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
  overlapTokens: OverlapTokens.pipe(SchemaUtils.withKeyDefaults(50)),
} as const;

/**
 * Schema-defaulted text chunking policy.
 *
 * @example
 * ```ts
 * import { ChunkingConfig } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const config = ChunkingConfig.default()
 * console.log(config.maxChunkSize) // 4000
 * console.log(config.overlapTokens) // 50
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ChunkingConfig extends S.Class<ChunkingConfig>($I`ChunkingConfig`)(
  ChunkingConfigFields,
  $I.annote("ChunkingConfig", {
    description: "Bounded, schema-defaulted policy for extraction text chunking.",
  })
) {
  /**
   * Constructs the canonical chunking policy.
   *
   * @example
   * ```ts
   * import { ChunkingConfig } from "@effect-ontology/Model/ExtractionRun.ts"
   *
   * const config = ChunkingConfig.default()
   * console.log(config.maxChunkSize) // 4000
   * ```
   *
   * @returns A complete immutable chunking policy populated by schema defaults.
   */
  static default(): ChunkingConfig {
    return ChunkingConfig.make({});
  }
}

const Temperature = S.Finite.check(
  S.isBetween(
    { minimum: 0, maximum: 2 },
    {
      identifier: $I`TemperatureRangeCheck`,
      title: "Model Temperature Range",
      description: "A model sampling temperature in the inclusive range zero through two.",
      message: "Model temperature must be between 0 and 2.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.double({ min: 0, max: 2, noNaN: true, noDefaultInfinity: true }),
  })
  .pipe(
    $I.annoteSchema("Temperature", {
      description: "Finite model sampling temperature in the closed interval [0, 2].",
    })
  );

const PositiveTokenCount = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`PositiveTokenCountCheck`,
    title: "Positive Token Count",
    description: "A token limit greater than zero.",
    message: "Token limit must be greater than zero.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 1, max: 1_000_000 }),
  })
  .pipe(
    $I.annoteSchema("PositiveTokenCount", {
      description: "Strictly positive model token limit.",
    })
  );

const LlmTimeout = S.Int.check(
  S.isBetween(
    { minimum: 1_000, maximum: 300_000 },
    {
      identifier: $I`LlmTimeoutRangeCheck`,
      title: "LLM Timeout Range",
      description: "A model-call timeout from one second through five minutes.",
      message: "LLM timeout must be between 1000 and 300000 milliseconds.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 1_000, max: 300_000 }),
  })
  .pipe(
    S.decodeTo(S.DurationFromMillis),
    $I.annoteSchema("LlmTimeout", {
      description: "Bounded model-call timeout encoded in milliseconds and decoded as Duration.",
    })
  );

const LlmConfigFields = {
  model: S.NonEmptyString,
  temperature: Temperature,
  maxTokens: PositiveTokenCount,
  timeout: LlmTimeout,
} as const;

/**
 * Model-execution policy captured by an extraction run.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 * import { LlmConfig } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const config = LlmConfig.make({
 *   model: "gpt-5",
 *   temperature: 0,
 *   maxTokens: 4096,
 *   timeout: Duration.seconds(30)
 * })
 * console.log(config.model) // "gpt-5"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class LlmConfig extends S.Class<LlmConfig>($I`LlmConfig`)(
  LlmConfigFields,
  $I.annote("LlmConfig", {
    description: "Bounded model identifier, sampling, token, and timeout policy.",
  })
) {}

const Concurrency = S.Int.check(
  S.isBetween(
    { minimum: 1, maximum: 32 },
    {
      identifier: $I`RunConcurrencyRangeCheck`,
      title: "Run Concurrency Range",
      description: "A run concurrency from one through 32 tasks.",
      message: "Run concurrency must be an integer between 1 and 32.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 1, max: 32 }),
  })
  .pipe(
    $I.annoteSchema("Concurrency", {
      description: "Bounded extraction-run concurrency.",
    })
  );

const RunConfigFields = {
  ontology: OntologyRef,
  chunking: ChunkingConfig,
  llm: LlmConfig,
  concurrency: Concurrency.pipe(SchemaUtils.withKeyDefaults(4)),
  enableGrounding: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
} as const;

/**
 * Complete immutable configuration snapshot for an extraction run.
 *
 * @example
 * ```ts
 * import { Duration } from "effect"
 * import * as S from "effect/Schema"
 * import { ChunkingConfig, LlmConfig, RunConfig } from "@effect-ontology/Model/ExtractionRun.ts"
 * import { OntologyRef } from "@effect-ontology/Model/Ontology.ts"
 *
 * const config = RunConfig.make({
 *   ontology: S.decodeUnknownSync(OntologyRef)({
 *     namespace: "football",
 *     name: "premier-league",
 *     contentHash: "a".repeat(64)
 *   }),
 *   chunking: ChunkingConfig.default(),
 *   llm: LlmConfig.make({
 *     model: "gpt-5",
 *     temperature: 0,
 *     maxTokens: 4096,
 *     timeout: Duration.seconds(30)
 *   })
 * })
 * console.log(config.concurrency) // 4
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RunConfig extends S.Class<RunConfig>($I`RunConfig`)(
  RunConfigFields,
  $I.annote("RunConfig", {
    description: "Ontology, chunking, model, concurrency, and grounding snapshot for a run.",
  })
) {}

const RunStatsFields = {
  chunkCount: NonNegativeInt,
  entityCount: NonNegativeInt,
  relationCount: NonNegativeInt,
  resolvedCount: NonNegativeInt,
  clusterCount: NonNegativeInt,
  tokensUsed: NonNegativeInt,
  duration: S.DurationFromMillis,
} as const;

/**
 * Non-negative measurements collected during extraction.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RunStats } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const stats = S.decodeUnknownSync(RunStats)({
 *   chunkCount: 1,
 *   entityCount: 2,
 *   relationCount: 1,
 *   resolvedCount: 2,
 *   clusterCount: 2,
 *   tokensUsed: 128,
 *   duration: 20
 * })
 * console.log(stats.entityCount) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunStats extends S.Class<RunStats>($I`RunStats`)(
  RunStatsFields,
  $I.annote("RunStats", {
    description: "Non-negative extraction counts, token use, and elapsed duration.",
  })
) {}

const ExtractionRunFields = {
  id: DocumentId,
  idempotencyKey: S.OptionFromOptionalKey(IdempotencyKey).pipe(SchemaUtils.withNoneDefault),
  status: RunStatus,
  config: RunConfig,
  ontologyVersion: S.OptionFromOptionalKey(OntologyVersion).pipe(SchemaUtils.withNoneDefault),
  createdAt: S.DateTimeUtcFromString,
  updatedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
  outputDir: S.NonEmptyString,
  stats: S.OptionFromOptionalKey(RunStats).pipe(SchemaUtils.withNoneDefault),
  outputs: S.Array(OutputMetadata).pipe(SchemaUtils.withEmptyArrayDefaults<OutputMetadata>()),
  events: S.Array(AuditEvent).pipe(SchemaUtils.withEmptyArrayDefaults<AuditEvent>()),
  errors: S.Array(AuditError).pipe(SchemaUtils.withEmptyArrayDefaults<AuditError>()),
} as const;

/**
 * Root aggregate for one execution of the knowledge-extraction pipeline.
 *
 * @remarks
 * Lifecycle-specific completion and failure data is carried by
 * {@link RunStatus}. Audit collections receive schema defaults, and storage
 * paths derive through the shared `PathLayout` source of truth.
 *
 * @example
 * ```ts
 * import { ExtractionRun } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const metadataPath = (run: ExtractionRun): string => run.metadataPath
 * console.log(typeof metadataPath) // "function"
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class ExtractionRun extends S.Class<ExtractionRun>($I`ExtractionRun`)(
  ExtractionRunFields,
  $I.annote("ExtractionRun", {
    description: "Immutable extraction-run aggregate with status, config, outputs, audit, and paths.",
  })
) {
  /**
   * Builds the stable identifier for one indexed input chunk.
   *
   * @param runId - Document identifier of the owning extraction run.
   * @param index - Zero-based chunk index.
   * @returns A run-scoped chunk identifier in `{runId}-chunk-{index}` form.
   *
   * @example
   * ```ts
   * import { NonNegativeInt } from "@beep/schema"
   * import { DocumentId } from "@effect-ontology/Identity.ts"
   * import { ExtractionRun } from "@effect-ontology/Model/ExtractionRun.ts"
   *
   * const id = ExtractionRun.chunkId(
   *   DocumentId.make("doc-abc123def456"),
   *   NonNegativeInt.make(2)
   * )
   * console.log(id) // "doc-abc123def456-chunk-2"
   * ```
   */
  static chunkId(runId: DocumentId, index: NonNegativeInt): string {
    return `${runId}-chunk-${index}`;
  }

  /**
   * Effect primary key used for aggregate identity and deduplication.
   *
   * @returns This run's validated document identifier.
   *
   * @example
   * ```ts
   * import { PrimaryKey } from "effect"
   * import type { ExtractionRun } from "@effect-ontology/Model/ExtractionRun.ts"
   *
   * const primaryKey = (run: ExtractionRun) => run[PrimaryKey.symbol]()
   * console.log(typeof primaryKey) // "function"
   * ```
   */
  [PrimaryKey.symbol](): DocumentId {
    return this.id;
  }

  /**
   * Canonical storage path for serialized run metadata.
   *
   * @returns Storage-relative metadata path derived from the run identifier.
   *
   * @example
   * ```ts
   * import type { ExtractionRun } from "@effect-ontology/Model/ExtractionRun.ts"
   *
   * const metadataPath = (run: ExtractionRun) => run.metadataPath
   * console.log(typeof metadataPath) // "function"
   * ```
   */
  get metadataPath(): string {
    return PathLayout.run.metadata(this.id);
  }

  /**
   * Canonical storage path for the immutable run input.
   *
   * @returns Storage-relative input path derived from the run identifier.
   *
   * @example
   * ```ts
   * import type { ExtractionRun } from "@effect-ontology/Model/ExtractionRun.ts"
   *
   * const inputPath = (run: ExtractionRun) => run.inputPath
   * console.log(typeof inputPath) // "function"
   * ```
   */
  get inputPath(): string {
    return PathLayout.run.input(this.id);
  }

  /**
   * Canonical storage path for a typed run output.
   *
   * @param type - Logical output kind whose canonical filename is requested.
   * @returns Storage-relative path under this run's output directory.
   *
   * @example
   * ```ts
   * import type { ExtractionRun } from "@effect-ontology/Model/ExtractionRun.ts"
   *
   * const outputPath = (run: ExtractionRun) => run.outputPath("metadata")
   * console.log(typeof outputPath) // "function"
   * ```
   */
  outputPath(type: OutputType): string {
    return PathLayout.run.output(this.id, type);
  }

  static readonly encodeJsonStringEffect = S.encodeEffect(S.fromJsonString(ExtractionRun, { space: 2 }))
}

/**
 * Alias for the stable audit-error category.
 *
 * @example
 * ```ts
 * import type { AuditErrorType } from "@effect-ontology/Model/ExtractionRun.ts"
 *
 * const type: AuditErrorType = "storage"
 * console.log(type) // "storage"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AuditErrorType = ErrorCode;
