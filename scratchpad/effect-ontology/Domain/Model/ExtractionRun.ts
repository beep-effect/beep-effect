/**
 * Extraction-run configuration, audit, status, and aggregate values.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import { PrimaryKey, Tuple } from "effect";
import * as S from "effect/Schema";
import { ChunkId, DocumentId, IdempotencyKey, OntologyVersion } from "../Identity.ts";
import { PathLayout } from "../PathLayout.ts";
import { OntologyRef } from "./Ontology.ts";
import { OutputType } from "./OutputType.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/ExtractionRun");

/**
 * Stable code describing why an extraction run terminated unsuccessfully.
 *
 * **Example** (Use ErrorCode)
 * ```ts
 * import { ErrorCode } from "@effect-ontology/Model/ExtractionRun"
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
 * **Example** (Use ErrorCode)
 * ```ts
 * import type { ErrorCode } from "@effect-ontology/Model/ExtractionRun"
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
 * **Example** (Use AuditEventType)
 * ```ts
 * import { AuditEventType } from "@effect-ontology/Model/ExtractionRun"
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
 * **Example** (Use AuditEventType)
 * ```ts
 * import type { AuditEventType } from "@effect-ontology/Model/ExtractionRun"
 *
 * const type: AuditEventType = "info"
 * console.log(type) // "info"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AuditEventType = typeof AuditEventType.Type;

/**
 * Integrity and location metadata for one persisted run output.
 *
 * **Example** (Use OutputMetadata)
 * ```ts
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OutputMetadata } from "@effect-ontology/Model/ExtractionRun"
 *
 * const output = S.decodeUnknownOption(OutputMetadata)({
 *   type: "entities",
 *   path: "runs/doc-0123456789ab/outputs/entities.json",
 *   hash: "a".repeat(64),
 *   size: 128,
 *   savedAt: DateTime.formatIso(DateTime.nowUnsafe())
 * })
 * console.log(O.map(output, (value) => value.type)) // "entities"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutputMetadata extends S.Class<OutputMetadata>($I`OutputMetadata`)(
  {
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
  },
  $I.annote("OutputMetadata", {
    description: "Typed output kind, path, integrity digest, size, and persistence time.",
  })
) {}

/**
 * Structured, JSON-compatible extraction-run audit event.
 *
 * **Example** (Use AuditEvent)
 * ```ts
 * import { DateTime } from "effect"
 * import { AuditEvent } from "@effect-ontology/Model/ExtractionRun"
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
  {
    timestamp: S.DateTimeUtcFromString,
    type: AuditEventType,
    data: S.Record(S.String, S.Json).pipe(SchemaUtils.withKeyDefaults({})),
  },
  $I.annote("AuditEvent", {
    description: "Timestamped audit event with a stable category and JSON-compatible data.",
  })
) {}

/**
 * Structured error retained in an extraction run's audit trail.
 *
 * **Example** (Use AuditError)
 * ```ts
 * import { DateTime } from "effect"
 * import { AuditError } from "@effect-ontology/Model/ExtractionRun"
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
  {
    timestamp: S.DateTimeUtcFromString,
    type: ErrorCode,
    message: S.NonEmptyString,
    context: S.Record(S.String, S.Json).pipe(SchemaUtils.withKeyDefaults({})),
  },
  $I.annote("AuditError", {
    description: "Timestamped extraction failure with a stable code and JSON-compatible context.",
  })
) {}

/**
 * Canonical discriminated lifecycle state for an extraction run.
 *
 * **Details**
 *
 * * Failure details and terminal timestamps are nested in their legal variants,
 * eliminating the upstream status string plus optional error/timestamp bag.
 *
 * **Example** (Use RunStatus)
 * ```ts
 * import { RunStatus } from "@effect-ontology/Model/ExtractionRun"
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
 * **Example** (Use RunStatus)
 * ```ts
 * import type { RunStatus } from "@effect-ontology/Model/ExtractionRun"
 *
 * const status: RunStatus = { _tag: "Pending" }
 * console.log(status._tag) // "Pending"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunStatus = typeof RunStatus.Type;

const ChunkSize = PosInt.check(
  S.isBetween(
    { minimum: 100, maximum: 10_000 },
    {
      identifier: $I`ChunkSizeRangeCheck`,
      title: "Chunk Size Range",
      description: "A chunk size from 100 through 10,000 UTF-16 characters.",
      message: "Chunk size must be an integer between 100 and 10000.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .integer({
          min: 100,
          max: 10_000,
        })
        .map(PosInt.make),
  })
  .pipe(
    $I.annoteSchema("ChunkSize", {
      description: "Maximum extraction chunk size measured in UTF-16 characters.",
    })
  );

const SentenceOverlap = NonNegativeInt.check(
  S.isBetween(
    { minimum: 0, maximum: 20 },
    {
      identifier: $I`SentenceOverlapRangeCheck`,
      title: "Sentence Overlap Range",
      description: "A chunk overlap from zero through 20 sentences.",
      message: "Sentence overlap must be an integer between 0 and 20.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .integer({
          min: 0,
          max: 20,
        })
        .map(NonNegativeInt.make),
  })
  .pipe(
    $I.annoteSchema("SentenceOverlap", {
      description: "Number of complete sentences repeated between adjacent extraction chunks.",
    })
  );

/**
 * Schema-defaulted text chunking policy.
 *
 * **Example** (Use ChunkingConfig)
 * ```ts
 * import { ChunkingConfig } from "@effect-ontology/Model/ExtractionRun"
 *
 * const config = ChunkingConfig.default()
 * console.log(config.maxChunkSize) // 4000
 * console.log(config.overlapSentences) // 2
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ChunkingConfig extends S.Class<ChunkingConfig>($I`ChunkingConfig`)(
  {
    maxChunkSize: ChunkSize.pipe(SchemaUtils.withKeyDefaults(ChunkSize.make(4_000))),
    preserveSentences: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    overlapSentences: SentenceOverlap.pipe(SchemaUtils.withKeyDefaults(SentenceOverlap.make(2))),
  },
  $I.annote("ChunkingConfig", {
    description: "Bounded, schema-defaulted policy for extraction text chunking.",
  })
) {
  /**
   * Constructs the canonical chunking policy.
   *
   * **Example** (Use the default chunking policy)
   * ```ts
   * import { ChunkingConfig } from "@effect-ontology/Model/ExtractionRun"
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
    toArbitrary: () => (fc) =>
      fc.double({
        min: 0,
        max: 2,
        noNaN: true,
        noDefaultInfinity: true,
      }),
  })
  .pipe(
    $I.annoteSchema("Temperature", {
      description: "Finite model sampling temperature in the closed interval [0, 2].",
    })
  );

const LlmTimeout = PosInt.check(
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
    toArbitrary: () => (fc) =>
      fc
        .integer({
          min: 1_000,
          max: 300_000,
        })
        .map(PosInt.make),
  })
  .pipe(
    S.decodeTo(S.DurationFromMillis),
    $I.annoteSchema("LlmTimeout", {
      description: "Bounded model-call timeout encoded in milliseconds and decoded as Duration.",
    })
  );

/**
 * Model-execution policy captured by an extraction run.
 *
 * **Example** (Use LlmConfig)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LlmConfig } from "@effect-ontology/Model/ExtractionRun"
 *
 * const config = S.decodeUnknownOption(LlmConfig)({
 *   model: "gpt-5",
 *   temperature: 0,
 *   maxTokens: 4096,
 *   timeout: 30_000
 * })
 * console.log(O.isSome(config)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class LlmConfig extends S.Class<LlmConfig>($I`LlmConfig`)(
  {
    model: S.NonEmptyString,
    temperature: Temperature,
    maxTokens: PosInt,
    timeout: LlmTimeout,
  },
  $I.annote("LlmConfig", {
    description: "Bounded model identifier, sampling, token, and timeout policy.",
  })
) {}

const Concurrency = PosInt.check(
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
    toArbitrary: () => (fc) => fc.integer({ min: 1, max: 32 }).map(PosInt.make),
  })
  .pipe(
    $I.annoteSchema("Concurrency", {
      description: "Bounded extraction-run concurrency.",
    })
  );

const GroundingMode = LiteralKit(["Disabled", "Enabled"]);

class GroundingDisabled extends S.Class<GroundingDisabled>($I`GroundingDisabled`)(
  { mode: S.tag(GroundingMode.Enum.Disabled) },
  $I.annote("GroundingDisabled", {
    description: "Grounding verification is disabled while observations remain explicitly not evaluated.",
  })
) {}

class GroundingEnabled extends S.Class<GroundingEnabled>($I`GroundingEnabled`)(
  {
    mode: S.tag(GroundingMode.Enum.Enabled),
    threshold: Confidence.pipe(
      SchemaUtils.withKeyDefaults(Confidence.make(0.8)),
      S.annotateKey({ description: "Minimum verifier confidence required to publish a supported fact." })
    ),
    batchSize: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(5)),
      S.annotateKey({ description: "Positive maximum number of facts sent in one grounding request." })
    ),
  },
  $I.annote("GroundingEnabled", {
    description: "Enabled grounding policy with schema-owned confidence and batch-size bounds.",
  })
) {}

/**
 * Grounding policy captured with an extraction run.
 *
 * **Example** (Configure grounding)
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import { PosInt } from "@beep/schema"
 * import { GroundingPolicy } from "@effect-ontology/Model/ExtractionRun"
 *
 * const policy = GroundingPolicy.cases.Enabled.make({
 *   threshold: Confidence.make(0.8),
 *   batchSize: PosInt.make(5)
 * })
 * console.log(policy.mode) // "Enabled"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GroundingPolicy = GroundingMode.mapMembers(
  Tuple.evolve([() => GroundingDisabled, () => GroundingEnabled])
).pipe(
  $I.annoteSchema("GroundingPolicy", {
    description: "Disabled or enabled extraction grounding with explicit operational policy.",
    toArbitrary: () => (fc) => fc.oneof(S.toArbitrary(GroundingDisabled)(fc), S.toArbitrary(GroundingEnabled)(fc)),
  }),
  S.toTaggedUnion("mode")
);

/**
 * Runtime value decoded by {@link GroundingPolicy}.
 *
 * **Example** (Disable grounding explicitly)
 * ```ts
 * import { GroundingPolicy } from "@effect-ontology/Model/ExtractionRun"
 *
 * const policy = GroundingPolicy.cases.Disabled.make({})
 * console.log(policy.mode) // "Disabled"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GroundingPolicy = typeof GroundingPolicy.Type;

/**
 * Complete immutable configuration snapshot for an extraction run.
 *
 * **Example** (Use RunConfig)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { RunConfig } from "@effect-ontology/Model/ExtractionRun"
 *
 * const config = S.decodeUnknownOption(RunConfig)({
 *   ontology: {
 *     namespace: "football",
 *     name: "premier-league",
 *     contentHash: "a".repeat(64)
 *   },
 *   chunking: {},
 *   llm: {
 *     model: "gpt-5",
 *     temperature: 0,
 *     maxTokens: 4096,
 *     timeout: 30_000
 *   }
 * })
 * console.log(O.isSome(config)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RunConfig extends S.Class<RunConfig>($I`RunConfig`)(
  {
    ontology: OntologyRef,
    chunking: ChunkingConfig,
    llm: LlmConfig,
    concurrency: Concurrency.pipe(SchemaUtils.withKeyDefaults(Concurrency.make(4))),
    grounding: GroundingPolicy.pipe(
      SchemaUtils.withKeyDefaults(GroundingPolicy.cases.Enabled.make({})),
      S.annotateKey({ description: "Grounding policy applied to extracted facts." })
    ),
  },
  $I.annote("RunConfig", {
    description: "Ontology, chunking, model, concurrency, and grounding snapshot for a run.",
  })
) {}

/**
 * Non-negative measurements collected during extraction.
 *
 * **Example** (Use RunStats)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { RunStats } from "@effect-ontology/Model/ExtractionRun"
 *
 * const stats = S.decodeUnknownOption(RunStats)({
 *   chunkCount: 1,
 *   entityCount: 2,
 *   relationCount: 1,
 *   resolvedCount: 2,
 *   clusterCount: 2,
 *   tokensUsed: 128,
 *   duration: 20
 * })
 * console.log(O.map(stats, (value) => value.entityCount)) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunStats extends S.Class<RunStats>($I`RunStats`)(
  {
    chunkCount: NonNegativeInt,
    entityCount: NonNegativeInt,
    relationCount: NonNegativeInt,
    resolvedCount: NonNegativeInt,
    clusterCount: NonNegativeInt,
    tokensUsed: NonNegativeInt,
    duration: S.DurationFromMillis,
  },
  $I.annote("RunStats", {
    description: "Non-negative extraction counts, token use, and elapsed duration.",
  })
) {}

/**
 * Root aggregate for one execution of the knowledge-extraction pipeline.
 *
 * **Details**
 *
 * * Lifecycle-specific completion and failure data is carried by
 * {@link RunStatus}. Audit collections receive schema defaults, and storage
 * paths derive through the shared `PathLayout` source of truth.
 *
 * **Example** (Use ExtractionRun)
 * ```ts
 * import { ExtractionRun } from "@effect-ontology/Model/ExtractionRun"
 *
 * const metadataPath = (run: ExtractionRun): string => run.metadataPath
 * console.log(typeof metadataPath) // "function"
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class ExtractionRun extends S.Class<ExtractionRun>($I`ExtractionRun`)(
  {
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
  },
  $I.annote("ExtractionRun", {
    description: "Immutable extraction-run aggregate with status, config, outputs, audit, and paths.",
  })
) {
  /**
   * Builds the stable identifier for one indexed input chunk.
   *
   * **Example** (Use chunkId)
   *
   * ```ts
   * import { NonNegativeInt } from "@beep/schema"
   * import { DocumentId } from "@effect-ontology/Identity"
   * import { ExtractionRun } from "@effect-ontology/Model/ExtractionRun"
   *
   * const id = ExtractionRun.chunkId(
   *   DocumentId.make("doc-abc123def456"),
   *   NonNegativeInt.make(2)
   * )
   * console.log(id) // "doc-abc123def456-chunk-2"
   * ```
   *
   * @param runId - Document identifier of the owning extraction run.
   * @param index - Zero-based chunk index.
   * @returns A run-scoped chunk identifier in `{runId}-chunk-{index}` form.
   */
  static chunkId(runId: DocumentId, index: NonNegativeInt): ChunkId {
    return ChunkId.fromDocument(runId, index);
  }

  /**
   * Effect primary key used for aggregate identity and deduplication.
   *
   * **Example** (Use ExtractionRun)
   *
   * ```ts
   * import { PrimaryKey } from "effect"
   * import type { ExtractionRun } from "@effect-ontology/Model/ExtractionRun"
   *
   * const primaryKey = (run: ExtractionRun) => run[PrimaryKey.symbol]()
   * console.log(typeof primaryKey) // "function"
   * ```
   *
   * @returns This run's validated document identifier.
   */
  [PrimaryKey.symbol](): DocumentId {
    return this.id;
  }

  /**
   * Canonical storage path for serialized run metadata.
   *
   * **Example** (Use ExtractionRun)
   *
   * ```ts
   * import type { ExtractionRun } from "@effect-ontology/Model/ExtractionRun"
   *
   * const metadataPath = (run: ExtractionRun) => run.metadataPath
   * console.log(typeof metadataPath) // "function"
   * ```
   *
   * @returns Storage-relative metadata path derived from the run identifier.
   */
  get metadataPath(): string {
    return PathLayout.run.metadata(this.id);
  }

  /**
   * Canonical storage path for the immutable run input.
   *
   * **Example** (Use outputPath)
   *
   * ```ts
   * import type { ExtractionRun } from "@effect-ontology/Model/ExtractionRun"
   *
   * const inputPath = (run: ExtractionRun) => run.inputPath
   * console.log(typeof inputPath) // "function"
   * ```
   *
   * @returns Storage-relative input path derived from the run identifier.
   */
  get inputPath(): string {
    return PathLayout.run.input(this.id);
  }

  /**
   * Canonical storage path for a typed run output.
   *
   * **Example** (Use AuditErrorType)
   *
   * ```ts
   * import type { ExtractionRun } from "@effect-ontology/Model/ExtractionRun"
   *
   * const outputPath = (run: ExtractionRun) => run.outputPath("metadata")
   * console.log(typeof outputPath) // "function"
   * ```
   *
   * @param type - Logical output kind whose canonical filename is requested.
   * @returns Storage-relative path under this run's output directory.
   */
  outputPath(type: OutputType): string {
    return PathLayout.run.output(this.id, type);
  }

  static readonly encodeJsonStringEffect = S.encodeEffect(S.fromJsonString(ExtractionRun, { space: 2 }));
}

/**
 * Alias for the stable audit-error category.
 *
 * **Example** (Use AuditErrorType)
 * ```ts
 * import type { AuditErrorType } from "@effect-ontology/Model/ExtractionRun"
 *
 * const type: AuditErrorType = "storage"
 * console.log(type) // "storage"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AuditErrorType = ErrorCode;
