/**
 * Extraction API request and lifecycle-response schemas.
 *
 * **Details**
 *
 * * Input sources and job lifecycle payloads are discriminated so illegal
 * combinations are unrepresentable. Optional configuration is normalized to
 * `Option` at the schema boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { HttpsUrl, LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { RunConfig } from "../Model/ExtractionRun.ts";
import { BackgroundJobId } from "./JobSchema.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Api");

const SubmitJobSourceDefinition = S.TaggedUnion({
  Inline: {
    value: S.Struct({
      text: S.NonEmptyString.annotateKey({
        description: "Non-empty document text supplied directly by the caller.",
      }),
    }),
  },
  Remote: {
    value: S.Struct({
      url: HttpsUrl.annotateKey({
        description: "HTTPS location from which the extraction service fetches the document.",
      }),
    }),
  },
});

/**
 * Exactly one source of content for a submitted extraction job.
 *
 * **Details**
 *
 * * The nested `value` object makes source-specific data available only after
 * matching on `_tag`; callers never correlate two optional fields.
 *
 * **Example** (Use SubmitJobSource)
 * ```ts
 * import { SubmitJobSource } from "@effect-ontology/Schema/Api"
 *
 * const source = SubmitJobSource.cases.Inline.make({
 *   value: { text: "Ada Lovelace wrote the first published algorithm." }
 * })
 * console.log(source._tag) // "Inline"
 * ```
 *
 * @invariant Every value carries exactly one non-empty inline document or one
 * HTTPS remote location.
 * @category dtos
 * @since 0.0.0
 */
export const SubmitJobSource = SubmitJobSourceDefinition.pipe(
  $I.annoteSchema("SubmitJobSource", {
    description: "Discriminated inline-text or remote-HTTPS content source for an extraction job.",
    toArbitrary: () => S.toArbitrary(SubmitJobSourceDefinition),
  })
);

/**
 * Runtime value decoded by {@link SubmitJobSource}.
 *
 * **Example** (Use SubmitJobSource)
 * ```ts
 * import type { SubmitJobSource } from "@effect-ontology/Schema/Api"
 *
 * const tag = (source: SubmitJobSource) => source._tag
 * console.log(typeof tag) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SubmitJobSource = typeof SubmitJobSource.Type;

const SubmitJobRequestFields = {
  source: SubmitJobSource.annotateKey({
    description: "The single validated source from which extraction reads content.",
  }),
  config: S.OptionFromOptionalKey(RunConfig).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "Optional run-configuration override; absence delegates policy to the server.",
    })
  ),
};

/**
 * Request to submit one extraction job.
 *
 * **Details**
 *
 * * Upstream represented `text` and `url` as independent optional properties.
 * This model uses {@link SubmitJobSource} to enforce the documented
 * exactly-one-source rule and normalizes omitted configuration to `Option`.
 *
 * **Example** (Use SubmitJobRequest)
 * ```ts
 * import { SubmitJobRequest, SubmitJobSource } from "@effect-ontology/Schema/Api"
 *
 * const request = SubmitJobRequest.make({
 *   source: SubmitJobSource.cases.Inline.make({
 *     value: { text: "A compact source document." }
 *   })
 * })
 * console.log(request.source._tag) // "Inline"
 * ```
 *
 * @invariant A request always carries one valid content source.
 * @category dtos
 * @since 0.0.0
 */
export class SubmitJobRequest extends S.Class<SubmitJobRequest>($I`SubmitJobRequest`)(
  SubmitJobRequestFields,
  $I.annote("SubmitJobRequest", {
    description: "Extraction submission containing one discriminated source and an optional configuration override.",
  })
) {
  /**
   * Decodes and validates an untrusted request.
   *
   * @param input - Unknown boundary value to validate.
   * @returns An Effect that succeeds with a complete request or fails with a
   * schema parse error.
   *
   * **Example** (Use JobStatus)
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { SubmitJobRequest } from "@effect-ontology/Schema/Api"
   *
   * const program = Effect.gen(function* () {
   *   return yield* SubmitJobRequest.validate({
   *     source: { _tag: "Inline", value: { text: "Hello" } }
   *   })
   * })
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly validate = S.decodeUnknownEffect(SubmitJobRequest);

  /** Derived runtime guard for validated requests. */
  static readonly is = S.is(SubmitJobRequest);
}

/**
 * Closed extraction-job lifecycle domain.
 *
 * **Example** (Use JobStatus)
 * ```ts
 * import { JobStatus } from "@effect-ontology/Schema/Api"
 *
 * console.log(JobStatus.is.running("running")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JobStatus = LiteralKit(["pending", "running", "completed", "failed", "cancelled"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("pending", "running", "completed", "failed", "cancelled"),
  })
  .annotate(
    $I.annote("JobStatus", {
      description: "Closed lifecycle states reported by the extraction API.",
    })
  );

/**
 * Runtime value accepted by {@link JobStatus}.
 *
 * **Example** (Use JobStatus)
 * ```ts
 * import type { JobStatus } from "@effect-ontology/Schema/Api"
 *
 * const status: JobStatus = "completed"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JobStatus = typeof JobStatus.Type;

/**
 * Coarse failure-origin category exposed by the extraction API.
 *
 * **Example** (Use JobErrorType)
 * ```ts
 * import { JobErrorType } from "@effect-ontology/Schema/Api"
 *
 * console.log(JobErrorType.is.timeout("timeout")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const JobErrorType = LiteralKit(["expected", "defect", "interrupted", "timeout", "unknown"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("expected", "defect", "interrupted", "timeout", "unknown"),
  })
  .annotate(
    $I.annote("JobErrorType", {
      description: "Closed coarse categories for terminal extraction-job failures.",
    })
  );

/**
 * Runtime value accepted by {@link JobErrorType}.
 *
 * **Example** (Use JobErrorType)
 * ```ts
 * import type { JobErrorType } from "@effect-ontology/Schema/Api"
 *
 * const type: JobErrorType = "expected"
 * console.log(type)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JobErrorType = typeof JobErrorType.Type;

const JobProgressFields = {
  chunksTotal: NonNegativeInt.annotateKey({
    description: "Total chunks planned for the job.",
  }),
  chunksProcessed: NonNegativeInt.annotateKey({
    description: "Chunks whose extraction work has completed.",
  }),
  entitiesExtracted: NonNegativeInt.annotateKey({
    description: "Entities extracted so far.",
  }),
  relationsExtracted: NonNegativeInt.annotateKey({
    description: "Relations extracted so far.",
  }),
};

/**
 * Non-negative progress counters for an extraction job.
 *
 * **Example** (Use JobProgress)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { JobProgress } from "@effect-ontology/Schema/Api"
 *
 * const progress = S.decodeUnknownOption(JobProgress)({
 *   chunksTotal: 2,
 *   chunksProcessed: 1,
 *   entitiesExtracted: 3,
 *   relationsExtracted: 2
 * })
 * console.log(O.map(progress, (value) => value.chunksProcessed)) // 1
 * ```
 *
 * @invariant Every counter is a non-negative integer.
 * @category dtos
 * @since 0.0.0
 */
export class JobProgress extends S.Class<JobProgress>($I`JobProgress`)(
  JobProgressFields,
  $I.annote("JobProgress", {
    description: "Non-negative chunk, entity, and relation progress counters for one extraction job.",
  })
) {}

const JobFailureFields = {
  message: S.NonEmptyString.annotateKey({
    description: "Non-empty human-readable explanation of the terminal failure.",
  }),
  type: JobErrorType.annotateKey({
    description: "Coarse origin category for the terminal failure.",
  }),
};

class JobFailure extends S.Class<JobFailure>($I`JobFailure`)(
  JobFailureFields,
  $I.annote("JobFailure", {
    description: "Nested diagnostic available only on a failed extraction job.",
  })
) {}

const JobResponseCommonFields = {
  jobId: BackgroundJobId.annotateKey({
    description: "Stable identifier of the submitted extraction job.",
  }),
  submittedAt: S.DateTimeUtcFromString.annotateKey({
    description: "UTC instant at which the service accepted the job.",
  }),
  progress: JobProgress.annotateKey({
    description: "Current non-negative extraction progress counters.",
  }),
};

const JobStatusResponseDefinition = S.Union([
  S.Struct({
    ...JobResponseCommonFields,
    status: S.tag("pending"),
  }),
  S.Struct({
    ...JobResponseCommonFields,
    status: S.tag("running"),
  }),
  S.Struct({
    ...JobResponseCommonFields,
    status: S.tag("completed"),
    completedAt: S.DateTimeUtcFromString,
  }),
  S.Struct({
    ...JobResponseCommonFields,
    status: S.tag("failed"),
    completedAt: S.DateTimeUtcFromString,
    failure: JobFailure,
  }),
  S.Struct({
    ...JobResponseCommonFields,
    status: S.tag("cancelled"),
    completedAt: S.DateTimeUtcFromString,
  }),
]).pipe(S.toTaggedUnion("status"));

/**
 * Extraction-job status response discriminated by lifecycle state.
 *
 * **Details**
 *
 * * Completion timestamps and failure details occur only in terminal variants,
 * replacing the upstream optional-field bag.
 *
 * **Example** (Use JobStatusResponse)
 * ```ts
 * import { JobStatusResponse } from "@effect-ontology/Schema/Api"
 *
 * console.log(Object.keys(JobStatusResponse.cases)) // lifecycle variants
 * ```
 *
 * @invariant Failed responses always include a non-empty diagnostic and an
 * error category; non-failed responses cannot carry failure data.
 * @category dtos
 * @since 0.0.0
 */
export const JobStatusResponse = JobStatusResponseDefinition.pipe(
  $I.annoteSchema("JobStatusResponse", {
    description: "Lifecycle-discriminated extraction response with state-specific terminal data.",
    toArbitrary: () => S.toArbitrary(JobStatusResponseDefinition),
  })
);

/**
 * Runtime value decoded by {@link JobStatusResponse}.
 *
 * **Example** (Use JobStatusResponse)
 * ```ts
 * import type { JobStatusResponse } from "@effect-ontology/Schema/Api"
 *
 * const status = (response: JobStatusResponse) => response.status
 * console.log(typeof status) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JobStatusResponse = typeof JobStatusResponse.Type;
