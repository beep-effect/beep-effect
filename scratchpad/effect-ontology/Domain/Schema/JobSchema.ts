/**
 * Persisted background-job contracts with retry metadata.
 *
 * @remarks
 * Jobs use a single tagged union and a content-derived identifier. The
 * upstream delimiter-concatenation helpers were intentionally removed because
 * caller-controlled text and wall-clock milliseconds did not provide
 * unambiguous or collision-resistant identity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { HttpsUrl, LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { ContentHash, OntologyName } from "../Identity.ts";
import { EntityId } from "../Model/shared.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/JobSchema");
const backgroundJobIdPattern = /^job-[0-9a-f]{12}$/;

/**
 * Compact content-derived background-job identifier.
 *
 * @example
 * ```ts
 * import { BackgroundJobId } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * console.log(BackgroundJobId.is("job-abc123def456")) // true
 * ```
 *
 * @invariant Uses `job-` followed by exactly twelve lowercase hexadecimal
 * characters.
 * @category identifiers
 * @since 0.0.0
 */
export const BackgroundJobId = S.String.check(
  S.isPattern(backgroundJobIdPattern, {
    identifier: $I`BackgroundJobIdPatternCheck`,
    title: "Background Job Identifier",
    description: "A job- prefix followed by exactly twelve lowercase hexadecimal characters.",
    message: "Background job ID must use job- followed by exactly twelve lowercase hexadecimal characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(backgroundJobIdPattern),
  })
  .pipe(
    S.brand("BackgroundJobId"),
    $I.annoteSchema("BackgroundJobId", {
      description: "Compact content-derived identifier for a persisted background job.",
    }),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromContentHash: (hash: ContentHash): typeof schema.Type => schema.make(`job-${ContentHash.idFragment(hash)}`),
    }))
  );

/**
 * Runtime value decoded by {@link BackgroundJobId}.
 *
 * @example
 * ```ts
 * import {
 *   BackgroundJobId,
 *   type BackgroundJobId as BackgroundJobIdValue
 * } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * const id: BackgroundJobIdValue = BackgroundJobId.make("job-abc123def456")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BackgroundJobId = typeof BackgroundJobId.Type;

const SimilarityReason = LiteralKit(["alias_added", "embedding_updated", "manual"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("alias_added", "embedding_updated", "manual"),
  })
  .annotate(
    $I.annote("SimilarityReason", {
      description: "Supported reasons for recomputing entity-similarity scores.",
    })
  );

const CommonJobFields = {
  id: BackgroundJobId,
  ontologyId: OntologyName,
  createdAt: S.DateTimeUtcFromString,
};

const BackgroundJobDefinition = S.TaggedUnion({
  EmbeddingJob: {
    ...CommonJobFields,
    canonicalEntityId: EntityId,
    reason: S.NonEmptyString,
  },
  PromptCacheJob: {
    ...CommonJobFields,
    exampleId: S.NonEmptyString,
    isNegative: S.Boolean,
  },
  SimilarityRecomputeJob: {
    ...CommonJobFields,
    entityId: EntityId,
    reason: SimilarityReason,
  },
  BlockingTokenJob: {
    ...CommonJobFields,
    entityId: EntityId,
    text: S.NonEmptyString,
  },
  WebhookJob: {
    id: BackgroundJobId,
    createdAt: S.DateTimeUtcFromString,
    url: HttpsUrl,
    eventType: S.NonEmptyString,
    payload: S.Json,
  },
});

/**
 * Persisted request to re-embed a canonical entity.
 *
 * @example
 * ```ts
 * import { EmbeddingJob } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * console.log(EmbeddingJob.make)
 * ```
 *
 * @category jobs
 * @since 0.0.0
 */
export const EmbeddingJob = BackgroundJobDefinition.cases.EmbeddingJob.pipe(
  $I.annoteSchema("EmbeddingJob", {
    description: "Persisted background job that re-embeds a canonical entity.",
    toArbitrary: () => S.toArbitrary(BackgroundJobDefinition.cases.EmbeddingJob),
  })
);

/**
 * Persisted request to update a prompt cache.
 *
 * @example
 * ```ts
 * import { PromptCacheJob } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * console.log(PromptCacheJob.make)
 * ```
 *
 * @category jobs
 * @since 0.0.0
 */
export const PromptCacheJob = BackgroundJobDefinition.cases.PromptCacheJob.pipe(
  $I.annoteSchema("PromptCacheJob", {
    description: "Persisted background job that updates one prompt-cache example.",
    toArbitrary: () => S.toArbitrary(BackgroundJobDefinition.cases.PromptCacheJob),
  })
);

/**
 * Persisted request to recompute entity-similarity scores.
 *
 * @example
 * ```ts
 * import { SimilarityRecomputeJob } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * console.log(SimilarityRecomputeJob.make)
 * ```
 *
 * @category jobs
 * @since 0.0.0
 */
export const SimilarityRecomputeJob = BackgroundJobDefinition.cases.SimilarityRecomputeJob.pipe(
  $I.annoteSchema("SimilarityRecomputeJob", {
    description: "Persisted background job that recomputes similarity for one entity.",
    toArbitrary: () => S.toArbitrary(BackgroundJobDefinition.cases.SimilarityRecomputeJob),
  })
);

/**
 * Persisted request to rebuild blocking tokens for an entity.
 *
 * @example
 * ```ts
 * import { BlockingTokenJob } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * console.log(BlockingTokenJob.make)
 * ```
 *
 * @category jobs
 * @since 0.0.0
 */
export const BlockingTokenJob = BackgroundJobDefinition.cases.BlockingTokenJob.pipe(
  $I.annoteSchema("BlockingTokenJob", {
    description: "Persisted background job that rebuilds blocking tokens for one entity.",
    toArbitrary: () => S.toArbitrary(BackgroundJobDefinition.cases.BlockingTokenJob),
  })
);

/**
 * Persisted request to deliver an HTTPS webhook.
 *
 * @example
 * ```ts
 * import { WebhookJob } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * console.log(WebhookJob.make)
 * ```
 *
 * @invariant Webhook destinations use HTTPS and payloads are JSON-safe.
 * @category jobs
 * @since 0.0.0
 */
export const WebhookJob = BackgroundJobDefinition.cases.WebhookJob.pipe(
  $I.annoteSchema("WebhookJob", {
    description: "Persisted background job that delivers a JSON payload to an HTTPS webhook.",
    toArbitrary: () => S.toArbitrary(BackgroundJobDefinition.cases.WebhookJob),
  })
);

/**
 * Schema for every persisted background-job variant.
 *
 * @example
 * ```ts
 * import { BackgroundJobSchema } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * console.log(Object.keys(BackgroundJobSchema.cases).length) // 5
 * ```
 *
 * @category unions
 * @since 0.0.0
 */
export const BackgroundJobSchema = BackgroundJobDefinition.pipe(
  $I.annoteSchema("BackgroundJob", {
    description: "Tagged persisted background-job union for embedding, caching, similarity, blocking, and webhooks.",
    toArbitrary: () => S.toArbitrary(BackgroundJobDefinition),
  })
);

/**
 * Runtime job decoded by {@link BackgroundJobSchema}.
 *
 * @example
 * ```ts
 * import type { BackgroundJob } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * const jobName = (job: BackgroundJob) => job._tag
 * console.log(jobName)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BackgroundJob = typeof BackgroundJobSchema.Type;

const JobMetadataDefinition = S.Struct({
  id: BackgroundJobId.annotateKey({
    description: "Identifier of the job whose retries are tracked.",
  }),
  attempts: NonNegativeInt.pipe(
    SchemaUtils.withKeyDefaults(NonNegativeInt.make(0)),
    S.annotateKey({
      description: "Number of completed delivery attempts; defaults to zero.",
    })
  ),
  lastError: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "Optional diagnostic from the most recent failed attempt.",
    })
  ),
  lastAttemptAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "Optional UTC instant of the most recent attempt.",
    })
  ),
});

/**
 * Retry metadata stored alongside a background job.
 *
 * @example
 * ```ts
 * import { JobMetadataSchema } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * const metadata = JobMetadataSchema.fromUnknown({ id: "job-abc123def456" })
 * console.log(metadata.attempts) // 0
 * ```
 *
 * @invariant Attempt count is a non-negative integer and optional failure state
 * is represented with `Option`.
 * @category models
 * @since 0.0.0
 */
export const JobMetadataSchema = JobMetadataDefinition.annotate({
  toArbitrary: () => S.toArbitrary(JobMetadataDefinition),
}).pipe(
  $I.annoteSchema("JobMetadata", {
    description: "Retry metadata with a schema-owned zero-attempt default and Option-normalized failure details.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime metadata decoded by {@link JobMetadataSchema}.
 *
 * @example
 * ```ts
 * import type { JobMetadata } from "@effect-ontology/Schema/JobSchema.ts"
 *
 * const attempts = (metadata: JobMetadata) => metadata.attempts
 * console.log(attempts)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JobMetadata = typeof JobMetadataSchema.Type;
