/**
 * Document classification, adaptive chunking, and enriched manifest schemas.
 *
 * **Details**
 *
 * * Classification-derived behavior is colocated with the schemas that own its
 * finite domains. Defaults are constructor and decoding defaults, so workflow
 * code receives complete preprocessing options and collections.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, MimeType, NonNegativeInt, NonNegNum, PosInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Match, Number as N } from "effect";
import * as S from "effect/Schema";
import { BatchId, DocumentId, GcsUri, Namespace, OntologyVersion } from "../Identity.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/DocumentMetadata");

/**
 * Structural and editorial classification of a source document.
 *
 * **Example** (Use DocumentType)
 * ```ts
 * import { DocumentType } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * console.log(DocumentType.is.transcript("transcript")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentType = LiteralKit([
  "article",
  "transcript",
  "report",
  "contract",
  "correspondence",
  "reference",
  "narrative",
  "structured",
  "unknown",
])
  .annotate({
    toArbitrary: () => (fc) =>
      fc.constantFrom(
        "article",
        "transcript",
        "report",
        "contract",
        "correspondence",
        "reference",
        "narrative",
        "structured",
        "unknown"
      ),
  })
  .annotate(
    $I.annote("DocumentType", {
      description: "Finite structural classifications used to select document-processing behavior.",
    })
  );

/**
 * Runtime value accepted by {@link DocumentType}.
 *
 * **Example** (Use DocumentType)
 * ```ts
 * import type { DocumentType } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const type: DocumentType = "article"
 * console.log(type)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentType = typeof DocumentType.Type;

/**
 * Coarse estimate of named-entity density in source text.
 *
 * **Example** (Use EntityDensity)
 * ```ts
 * import { EntityDensity } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * console.log(EntityDensity.is.dense("dense")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityDensity = LiteralKit(["sparse", "moderate", "dense"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("sparse", "moderate", "dense"),
  })
  .annotate(
    $I.annote("EntityDensity", {
      description: "Sparse, moderate, or dense entity distribution used by adaptive chunking.",
    })
  );

/**
 * Runtime value accepted by {@link EntityDensity}.
 *
 * **Example** (Use EntityDensity)
 * ```ts
 * import type { EntityDensity } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const density: EntityDensity = "moderate"
 * console.log(density)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityDensity = typeof EntityDensity.Type;

const ChunkingStrategyDefinition = LiteralKit([
  "standard",
  "fine_grained",
  "high_overlap",
  "section_aware",
  "speaker_aware",
  "paragraph_based",
]).annotate({
  toArbitrary: () => (fc) =>
    fc.constantFrom("standard", "fine_grained", "high_overlap", "section_aware", "speaker_aware", "paragraph_based"),
});

/**
 * Runtime value accepted by {@link ChunkingStrategy}.
 *
 * **Example** (Use ChunkingStrategy)
 * ```ts
 * import type { ChunkingStrategy } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const strategy: ChunkingStrategy = "standard"
 * console.log(strategy)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ChunkingStrategy = typeof ChunkingStrategyDefinition.Type;

/**
 * Strategy used to divide a document into extraction chunks.
 *
 * **Details**
 *
 * * `recommend` owns the source selection behavior and `parameters` performs a
 * total lookup in the strategy registry.
 *
 * **Example** (Use ChunkingStrategy)
 * ```ts
 * import { ComplexityScore, ChunkingStrategy } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const strategy = ChunkingStrategy.recommend(
 *   "transcript",
 *   "moderate",
 *   ComplexityScore.make(0.5)
 * )
 * console.log(strategy) // "speaker_aware"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChunkingStrategy = ChunkingStrategyDefinition.pipe(
  $I.annoteSchema("ChunkingStrategy", {
    description: "Finite adaptive strategies for splitting source documents into extraction chunks.",
  }),
  SchemaUtils.withStatics(() => ({
    recommend: (
      documentType: DocumentType,
      entityDensity: EntityDensity,
      complexity: ComplexityScore
    ): ChunkingStrategy => recommendChunkingStrategy(documentType, entityDensity, complexity),
    parameters: (strategy: ChunkingStrategy): ChunkingParams => defaultChunkingParams[strategy],
  }))
);

const ChunkSize = PosInt.check(
  S.makeFilterGroup(
    [
      S.isGreaterThan(0, {
        identifier: $I`ChunkSizePositiveCheck`,
        title: "Positive Chunk Size",
        description: "A chunk size strictly greater than zero.",
        message: "Chunk size must be positive.",
      }),
      S.isLessThanOrEqualTo(10_000, {
        identifier: $I`ChunkSizeMaximumCheck`,
        title: "Maximum Chunk Size",
        description: "A positive chunk size no larger than ten thousand characters.",
        message: "Chunk size must not exceed 10,000 characters.",
      }),
    ],
    {
      identifier: $I`ChunkSizeChecks`,
      title: "Chunk Size",
      description: "Positive bounded character-count checks for a chunk.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 1, max: 10_000 }).map(PosInt.make),
  })
  .pipe(
    S.brand("ChunkSize"),
    $I.annoteSchema("ChunkSize", {
      description: "Positive target chunk size from one through ten thousand characters.",
    })
  );

const SentenceOverlap = NonNegativeInt.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`SentenceOverlapLowerBoundCheck`,
        title: "Non-Negative Sentence Overlap",
        description: "A sentence-overlap count greater than or equal to zero.",
        message: "Sentence overlap must be non-negative.",
      }),
      S.isLessThanOrEqualTo(10, {
        identifier: $I`SentenceOverlapMaximumCheck`,
        title: "Maximum Sentence Overlap",
        description: "A non-negative sentence-overlap count no larger than ten.",
        message: "Sentence overlap must not exceed ten.",
      }),
    ],
    {
      identifier: $I`SentenceOverlapChecks`,
      title: "Sentence Overlap",
      description: "Non-negative bounded sentence-overlap checks.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 0, max: 10 }).map(NonNegativeInt.make),
  })
  .pipe(
    S.brand("SentenceOverlap"),
    $I.annoteSchema("SentenceOverlap", {
      description: "Non-negative sentence-overlap count from zero through ten.",
    })
  );

/**
 * Concrete parameters for one chunking strategy.
 *
 * **Example** (Use ChunkingParams)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ChunkingParams } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const params = S.decodeUnknownOption(ChunkingParams)({
 *   chunkSize: 500,
 *   overlapSentences: 2
 * })
 * console.log(O.map(params, (value) => value.preserveSentences)) // true
 * ```
 *
 * @invariant Chunk size is in `[1, 10000]` and overlap is in `[0, 10]`.
 * @category models
 * @since 0.0.0
 */
export class ChunkingParams extends S.Class<ChunkingParams>($I`ChunkingParams`)(
  {
    chunkSize: ChunkSize.annotateKey({
      description: "Target chunk size in characters.",
    }),
    overlapSentences: SentenceOverlap.annotateKey({
      description: "Number of sentences repeated across neighboring chunks.",
    }),
    preserveSentences: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(true),
      S.annotateKey({
        description: "Whether chunks preserve sentence boundaries; defaults to true.",
      })
    ),
  },
  $I.annote("ChunkingParams", {
    description: "Bounded chunk-size and sentence-overlap parameters with an explicit boundary-preservation default.",
  })
) {
  static readonly is = S.is(ChunkingParams);
}

/**
 * Complete immutable parameter registry for {@link ChunkingStrategy}.
 *
 * **Example** (Use defaultChunkingParams)
 * ```ts
 * import { defaultChunkingParams } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * console.log(defaultChunkingParams.fine_grained.chunkSize) // 300
 * ```
 *
 * @invariant Contains exactly one validated parameter set for every strategy.
 * @category constants
 * @since 0.0.0
 */
export const defaultChunkingParams: Readonly<Record<ChunkingStrategy, ChunkingParams>> = {
  standard: ChunkingParams.make({
    chunkSize: ChunkSize.make(500),
    overlapSentences: SentenceOverlap.make(2),
  }),
  fine_grained: ChunkingParams.make({
    chunkSize: ChunkSize.make(300),
    overlapSentences: SentenceOverlap.make(3),
  }),
  high_overlap: ChunkingParams.make({
    chunkSize: ChunkSize.make(400),
    overlapSentences: SentenceOverlap.make(4),
  }),
  section_aware: ChunkingParams.make({
    chunkSize: ChunkSize.make(800),
    overlapSentences: SentenceOverlap.make(1),
  }),
  speaker_aware: ChunkingParams.make({
    chunkSize: ChunkSize.make(1_000),
    overlapSentences: SentenceOverlap.make(3),
    preserveSentences: false,
  }),
  paragraph_based: ChunkingParams.make({
    chunkSize: ChunkSize.make(600),
    overlapSentences: SentenceOverlap.make(2),
  }),
};

const ClassificationBatchSize = PosInt.check(
  S.makeFilterGroup(
    [
      S.isGreaterThan(0, {
        identifier: $I`ClassificationBatchSizePositiveCheck`,
        title: "Positive Classification Batch Size",
        description: "A classification batch size strictly greater than zero.",
        message: "Classification batch size must be positive.",
      }),
      S.isLessThanOrEqualTo(50, {
        identifier: $I`ClassificationBatchSizeMaximumCheck`,
        title: "Maximum Classification Batch Size",
        description: "A positive classification batch size no larger than fifty documents.",
        message: "Classification batch size must not exceed fifty documents.",
      }),
    ],
    {
      identifier: $I`ClassificationBatchSizeChecks`,
      title: "Classification Batch Size",
      description: "Positive bounded document-count checks for one classification batch.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 1, max: 50 }).map(PosInt.make),
  })
  .pipe(
    S.brand("ClassificationBatchSize"),
    $I.annoteSchema("ClassificationBatchSize", {
      description: "Positive document-classification batch size from one through fifty.",
    })
  );

/**
 * Feature controls for document preprocessing.
 *
 * **Details**
 *
 * * Every boolean and batch-size setting has a schema-owned default. A chunking
 * override is represented as `Option`, so callers never inspect undefined.
 *
 * **Example** (Use PreprocessingOptions)
 * ```ts
 * import { PreprocessingOptions } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const options = PreprocessingOptions.make({})
 * console.log(options.enabled) // true
 * console.log(options.classificationBatchSize) // 10
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class PreprocessingOptions extends S.Class<PreprocessingOptions>($I`PreprocessingOptions`)(
  {
    enabled: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    classifyDocuments: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    adaptiveChunking: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    priorityOrdering: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    chunkingStrategyOverride: S.OptionFromOptionalKey(ChunkingStrategy).pipe(SchemaUtils.withNoneDefault),
    classificationBatchSize: ClassificationBatchSize.pipe(
      SchemaUtils.withKeyDefaults(ClassificationBatchSize.make(10))
    ),
  },
  $I.annote("PreprocessingOptions", {
    description:
      "Complete preprocessing feature controls with schema-owned defaults and an Option-normalized override.",
  })
) {
  static readonly is = S.is(PreprocessingOptions);
}

/**
 * Canonical fully-enabled preprocessing configuration.
 *
 * **Example** (Use defaultPreprocessingOptions)
 * ```ts
 * import { defaultPreprocessingOptions } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * console.log(defaultPreprocessingOptions.adaptiveChunking) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultPreprocessingOptions = PreprocessingOptions.make({});

const languageCodePattern = /^[a-z]{2}$/;

/**
 * Syntactically valid lowercase ISO 639-1 language-code representation.
 *
 * **Details**
 *
 * * The schema validates the two-letter representation. Registry membership is
 * intentionally delegated to any language-detection adapter that owns an
 * authoritative ISO catalog.
 *
 * **Example** (Use LanguageCode)
 * ```ts
 * import { LanguageCode } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * console.log(LanguageCode.is("en")) // true
 * ```
 *
 * @invariant Exactly two lowercase ASCII letters.
 * @category value-objects
 * @since 0.0.0
 */
export const LanguageCode = S.String.check(
  S.isPattern(languageCodePattern, {
    identifier: $I`LanguageCodePatternCheck`,
    title: "Language Code",
    description: "A two-letter lowercase ISO 639-1 representation.",
    message: "Language code must contain exactly two lowercase ASCII letters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(languageCodePattern),
  })
  .pipe(
    S.brand("LanguageCode"),
    $I.annoteSchema("LanguageCode", {
      description: "Two-letter lowercase language-code representation.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime value decoded by {@link LanguageCode}.
 *
 * **Example** (Use LanguageCode)
 * ```ts
 * import { LanguageCode, type LanguageCode as LanguageCodeValue } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const language: LanguageCodeValue = LanguageCode.make("en")
 * console.log(language)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LanguageCode = typeof LanguageCode.Type;

/**
 * Finite document-complexity score in the closed unit interval.
 *
 * **Example** (Use ComplexityScore)
 * ```ts
 * import { ComplexityScore } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * console.log(ComplexityScore.is(0.75)) // true
 * ```
 *
 * @invariant Finite and in `[0, 1]`.
 * @category value-objects
 * @since 0.0.0
 */
export const ComplexityScore = UnitInterval.annotate({
  toArbitrary: () => S.toArbitrary(UnitInterval),
}).pipe(
  $I.annoteSchema("ComplexityScore", {
    description: "Finite normalized document-complexity score.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ComplexityScore}.
 *
 * **Example** (Use ComplexityScore)
 * ```ts
 * import { ComplexityScore, type ComplexityScore as ComplexityScoreValue } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const score: ComplexityScoreValue = ComplexityScore.make(0.5)
 * console.log(score)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ComplexityScore = typeof ComplexityScore.Type;

const tokenAdjustment = (estimatedTokens: NonNegativeInt): number =>
  Match.value(estimatedTokens).pipe(
    Match.when(
      (tokens) => tokens < 1_000,
      () => -10
    ),
    Match.when(
      (tokens) => tokens > 10_000,
      () => 10
    ),
    Match.orElse(() => 0)
  );

const densityAdjustment = EntityDensity.$match({
  sparse: () => -5,
  moderate: () => 0,
  dense: () => 5,
});

const fallbackChunkingStrategy = (entityDensity: EntityDensity, complexity: ComplexityScore): ChunkingStrategy =>
  Match.value(entityDensity).pipe(
    Match.when("dense", () => ChunkingStrategy.Enum.fine_grained),
    Match.orElse(() =>
      Match.value(complexity).pipe(
        Match.when(
          (score) => score > 0.8,
          () => ChunkingStrategy.Enum.high_overlap
        ),
        Match.orElse(() => ChunkingStrategy.Enum.standard)
      )
    )
  );

const recommendChunkingStrategy = (
  documentType: DocumentType,
  entityDensity: EntityDensity,
  complexity: ComplexityScore
): ChunkingStrategy =>
  DocumentType.$match(documentType, {
    article: () => ChunkingStrategy.Enum.paragraph_based,
    transcript: () => ChunkingStrategy.Enum.speaker_aware,
    report: () => fallbackChunkingStrategy(entityDensity, complexity),
    contract: () => ChunkingStrategy.Enum.section_aware,
    correspondence: () => fallbackChunkingStrategy(entityDensity, complexity),
    reference: () => fallbackChunkingStrategy(entityDensity, complexity),
    narrative: () => ChunkingStrategy.Enum.paragraph_based,
    structured: () => fallbackChunkingStrategy(entityDensity, complexity),
    unknown: () => fallbackChunkingStrategy(entityDensity, complexity),
  });

/**
 * Complete preprocessing metadata for one source document.
 *
 * **Details**
 *
 * * The class owns pure token estimation, priority calculation, and fallback
 * construction as statics. Optional title and real-world timestamps are
 * normalized to `Option`; tag collections always exist.
 *
 * **Example** (Use DocumentMetadata)
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { DocumentMetadata } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * console.log(DocumentMetadata.estimateTokens(NonNegativeInt.make(1_001))) // 251
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentMetadata extends S.Class<DocumentMetadata>($I`DocumentMetadata`)(
  {
    documentId: DocumentId,
    sourceUri: GcsUri,
    contentType: MimeType,
    sizeBytes: NonNegativeInt,
    eventTime: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    publishedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    ingestedAt: S.DateTimeUtcFromString,
    preprocessedAt: S.DateTimeUtcFromString,
    title: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    language: LanguageCode,
    estimatedTokens: NonNegativeInt,
    documentType: DocumentType,
    domainTags: S.Array(S.NonEmptyString).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
    complexityScore: ComplexityScore,
    entityDensityHint: EntityDensity,
    chunkingStrategy: ChunkingStrategy,
    suggestedChunkSize: ChunkSize,
    suggestedOverlap: SentenceOverlap,
    priority: NonNegativeInt,
    estimatedExtractionCost: NonNegativeInt,
  },
  $I.annote("DocumentMetadata", {
    description: "Validated source, temporal, classification, chunking, and scheduling metadata for one document.",
  })
) {
  static readonly is = S.is(DocumentMetadata);

  /**
   * Estimate LLM tokens from a non-negative character count.
   *
   * @param characterCount - Non-negative number of source characters.
   * @returns The heuristic token count, rounded upward at four characters per token.
   * **Example** (Use estimateTokens)
   * ```ts
   * import { DocumentMetadata } from "@effect-ontology/Schema/DocumentMetadata"
   *
   * console.log(DocumentMetadata.estimateTokens(9)) // 3
   * ```
   * @category utilities
   * @since 0.0.0
   */
  static readonly estimateTokens = (characterCount: NonNegativeInt): NonNegativeInt =>
    NonNegativeInt.make(globalThis.Math.ceil(characterCount / 4));

  /**
   * Compute a deterministic processing priority.
   *
   * @param complexity - Normalized document-complexity score.
   * @param estimatedTokens - Non-negative estimated token count.
   * @param entityDensity - Coarse entity-density classification.
   * @returns A non-negative integer priority where lower values run first.
   * **Example** (Use computePriority)
   * ```ts
   * import { ComplexityScore, DocumentMetadata } from "@effect-ontology/Schema/DocumentMetadata"
   *
   * console.log(DocumentMetadata.computePriority(
   *   ComplexityScore.make(0.5),
   *   500,
   *   "sparse"
   * ))
   * ```
   * @category utilities
   * @since 0.0.0
   */
  static readonly computePriority = (
    complexity: ComplexityScore,
    estimatedTokens: NonNegativeInt,
    entityDensity: EntityDensity
  ): NonNegativeInt =>
    NonNegativeInt.make(
      N.round(0)(50 - (1 - complexity) * 20 + tokenAdjustment(estimatedTokens) + densityAdjustment(entityDensity))
    );

  /**
   * Build conservative metadata when classification is unavailable.
   *
   * @param input - Validated source identity, content metadata, and processing instant.
   * @returns Complete metadata using neutral classification and standard chunking defaults.
   * **Example** (Use fallback)
   * ```ts
   * import { DocumentMetadata } from "@effect-ontology/Schema/DocumentMetadata"
   *
   * console.log(DocumentMetadata.fallback)
   * ```
   * @category constructors
   * @since 0.0.0
   */
  static readonly fallback = (input: {
    readonly documentId: DocumentId;
    readonly sourceUri: GcsUri;
    readonly contentType: MimeType;
    readonly sizeBytes: NonNegativeInt;
    readonly preprocessedAt: typeof S.DateTimeUtc.Type;
  }): DocumentMetadata => {
    const estimatedTokens = DocumentMetadata.estimateTokens(input.sizeBytes);
    const params = defaultChunkingParams.standard;

    return DocumentMetadata.make({
      ...input,
      ingestedAt: input.preprocessedAt,
      language: LanguageCode.make("en"),
      estimatedTokens,
      documentType: DocumentType.Enum.unknown,
      complexityScore: ComplexityScore.make(0.5),
      entityDensityHint: EntityDensity.Enum.moderate,
      chunkingStrategy: ChunkingStrategy.Enum.standard,
      suggestedChunkSize: params.chunkSize,
      suggestedOverlap: params.overlapSentences,
      priority: NonNegativeInt.make(50),
      estimatedExtractionCost: NonNegativeInt.make(estimatedTokens * 2),
    });
  };
}

/**
 * Aggregated measurements from preprocessing a batch.
 *
 * **Example** (Use PreprocessingStats)
 * ```ts
 * import type { PreprocessingStats } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const failures = (stats: PreprocessingStats) => stats.failedCount
 * console.log(failures)
 * ```
 *
 * @invariant Counts and durations are finite and non-negative; average
 * complexity is in `[0, 1]`.
 * @category models
 * @since 0.0.0
 */
export class PreprocessingStats extends S.Class<PreprocessingStats>($I`PreprocessingStats`)(
  {
    totalDocuments: NonNegativeInt,
    classifiedCount: NonNegativeInt,
    failedCount: NonNegativeInt,
    totalEstimatedTokens: NonNegativeInt,
    preprocessingDurationMs: NonNegNum,
    averageComplexity: ComplexityScore,
    documentTypeDistribution: S.Record(S.String, NonNegativeInt),
  },
  $I.annote("PreprocessingStats", {
    description: "Non-negative aggregate counts, token estimate, duration, complexity, and type distribution.",
  })
) {
  static readonly is = S.is(PreprocessingStats);
}

/**
 * Batch manifest enriched with preprocessing results.
 *
 * **Example** (Use EnrichedManifest)
 * ```ts
 * import type { EnrichedManifest } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const count = (manifest: EnrichedManifest) => manifest.documents.length
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EnrichedManifest extends S.Class<EnrichedManifest>($I`EnrichedManifest`)(
  {
    batchId: BatchId,
    ontologyUri: GcsUri,
    ontologyVersion: OntologyVersion,
    shaclUri: S.OptionFromOptionalKey(GcsUri).pipe(SchemaUtils.withNoneDefault),
    targetNamespace: Namespace,
    documents: S.Array(DocumentMetadata).pipe(SchemaUtils.withEmptyArrayDefaults<DocumentMetadata>()),
    createdAt: S.DateTimeUtcFromString,
    preprocessedAt: S.DateTimeUtcFromString,
    preprocessingStats: PreprocessingStats,
  },
  $I.annote("EnrichedManifest", {
    description: "Versioned batch manifest containing normalized document metadata and preprocessing statistics.",
  })
) {
  static readonly decodeFromString = S.decodeEffect(S.fromJsonString(this));
}

/**
 * Input to the document-preprocessing activity.
 *
 * **Details**
 *
 * * The deprecated `skipClassification` source flag is absorbed by
 * `preprocessing.classifyDocuments`, leaving one source of truth.
 *
 * **Example** (Use PreprocessingActivityInput)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { PreprocessingActivityInput } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const input = S.decodeUnknownOption(PreprocessingActivityInput)({
 *   batchId: "batch-abc123def456",
 *   manifestUri: "gs://beep-ontology-state/batches/manifest.json"
 * })
 * console.log(O.map(input, (value) => value.preprocessing.enabled)) // true
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class PreprocessingActivityInput extends S.Class<PreprocessingActivityInput>($I`PreprocessingActivityInput`)(
  {
    batchId: BatchId,
    manifestUri: GcsUri,
    preprocessing: PreprocessingOptions.pipe(SchemaUtils.withKeyDefaults(defaultPreprocessingOptions)),
  },
  $I.annote("PreprocessingActivityInput", {
    description: "Preprocessing activity input with a complete schema-defaulted configuration.",
  })
) {}

/**
 * Output produced by the document-preprocessing activity.
 *
 * **Example** (Use PreprocessingActivityOutput)
 * ```ts
 * import type { PreprocessingActivityOutput } from "@effect-ontology/Schema/DocumentMetadata"
 *
 * const duration = (output: PreprocessingActivityOutput) => output.durationMs
 * console.log(duration)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class PreprocessingActivityOutput extends S.Class<PreprocessingActivityOutput>($I`PreprocessingActivityOutput`)(
  {
    enrichedManifestUri: GcsUri,
    stats: PreprocessingStats,
    durationMs: NonNegNum,
  },
  $I.annote("PreprocessingActivityOutput", {
    description: "Preprocessing activity output with its enriched manifest location, statistics, and finite duration.",
  })
) {}
