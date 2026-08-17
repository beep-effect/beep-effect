/**
 * RDFS and lightweight OWL inference request/response contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, NonNegNum, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Inference");

/**
 * Reasoning strategy applied to an input RDF graph.
 *
 * **Details**
 *
 * * `custom` identifies runs whose rule material is supplied through
 * `InferenceRunRequest.customRules`; the other values select built-in profiles.
 *
 * **Example** (Use ReasoningProfile)
 * ```ts
 * import { ReasoningProfile } from "@effect-ontology/Schema/Inference"
 *
 * console.log(ReasoningProfile.is.rdfs("rdfs")) // true
 * console.log(ReasoningProfile.is.custom("owl-sameas")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReasoningProfile = LiteralKit(["rdfs", "rdfs-subclass", "owl-sameas", "custom"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("rdfs", "rdfs-subclass", "owl-sameas", "custom"),
  })
  .annotate(
    $I.annote("ReasoningProfile", {
      description: "Supported built-in and custom inference reasoning profiles.",
    })
  );

/**
 * Runtime value accepted by {@link ReasoningProfile}.
 *
 * **Example** (Use ReasoningProfile)
 * ```ts
 * import type { ReasoningProfile } from "@effect-ontology/Schema/Inference"
 *
 * const profile: ReasoningProfile = "rdfs"
 * console.log(profile)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReasoningProfile = typeof ReasoningProfile.Type;

const InferenceGraphFormat = LiteralKit(["turtle", "trig"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("turtle", "trig"),
  })
  .annotate(
    $I.annote("InferenceGraphFormat", {
      description: "RDF concrete syntaxes accepted by the inference endpoint.",
    })
  );

/**
 * Measurements collected from one inference run.
 *
 * **Details**
 *
 * * Counts and elapsed time are constrained to non-negative values. The
 * `inferenceRatio` may exceed one because one source triple can entail several
 * derived triples.
 *
 * **Example** (Use InferenceStats)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { InferenceStats } from "@effect-ontology/Schema/Inference"
 *
 * const stats = S.decodeUnknownOption(InferenceStats)({
 *   originalTriples: 10,
 *   enrichedTriples: 13,
 *   inferredTriples: 3,
 *   inferenceRatio: 0.3,
 *   predicateBreakdown: { "https://www.w3.org/2000/01/rdf-schema#type": 3 },
 *   durationMs: 8
 * })
 * console.log(O.map(stats, (value) => value.inferredTriples)) // 3
 * ```
 *
 * @invariant Every count, ratio, and duration is finite and non-negative.
 * @category models
 * @since 0.0.0
 */
export class InferenceStats extends S.Class<InferenceStats>($I`InferenceStats`)(
  {
    originalTriples: NonNegativeInt.annotateKey({
      description: "Number of triples in the input graph before reasoning.",
    }),
    enrichedTriples: NonNegativeInt.annotateKey({
      description: "Number of triples in the graph after reasoning reaches its configured result.",
    }),
    inferredTriples: NonNegativeInt.annotateKey({
      description: "Number of triples derived by reasoning.",
    }),
    inferenceRatio: NonNegNum.annotateKey({
      description: "Finite ratio of inferred triples to original triples.",
    }),
    predicateBreakdown: S.Record(S.String, NonNegativeInt).annotateKey({
      description: "Non-negative inferred-triple counts keyed by predicate IRI.",
    }),
    durationMs: NonNegNum.annotateKey({
      description: "Finite non-negative inference duration in milliseconds.",
    }),
  },
  $I.annote("InferenceStats", {
    description: "Non-negative triple counts, predicate breakdown, ratio, and elapsed time from inference.",
  })
) {
  static readonly is = S.is(InferenceStats);

  static readonly decodeEffect = S.decodeEffect(InferenceStats);
}

/**
 * Request to run inference over one serialized RDF graph.
 *
 * **Details**
 *
 * * Defaults are codec-owned: omitted format decodes to Turtle, omitted profile
 * decodes to full RDFS, omitted `returnDeltaOnly` decodes to `true`, and
 * omitted custom rules decode to `Option.none()`.
 *
 * **Example** (Use InferenceRunRequest)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { InferenceRunRequest } from "@effect-ontology/Schema/Inference"
 *
 * const request = S.decodeUnknownOption(InferenceRunRequest)({
 *   inputGraph: "@prefix ex: <https://example.com/> . ex:a ex:p ex:b ."
 * })
 * console.log(O.map(request, (value) => value.profile)) // Some("rdfs")
 * console.log(O.map(request, (value) => value.returnDeltaOnly)) // Some(true)
 * ```
 *
 * @invariant The input graph is non-empty and all optional behavior has an
 * explicit decoded representation.
 * @category dtos
 * @since 0.0.0
 */
export class InferenceRunRequest extends S.Class<InferenceRunRequest>($I`InferenceRunRequest`)(
  {
    inputGraph: S.NonEmptyString.annotateKey({
      description: "Non-empty input RDF graph serialized as Turtle or TriG.",
    }),
    format: InferenceGraphFormat.pipe(
      SchemaUtils.withKeyDefaults(InferenceGraphFormat.Enum.turtle),
      S.annotateKey({
        description: "Concrete syntax used by inputGraph; defaults to Turtle.",
      })
    ),
    profile: ReasoningProfile.pipe(
      SchemaUtils.withKeyDefaults(ReasoningProfile.Enum.rdfs),
      S.annotateKey({
        description: "Reasoning strategy; defaults to full RDFS.",
      })
    ),
    customRules: S.NonEmptyString.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional non-empty N3 rule strings used by the custom profile.",
      })
    ),
    returnDeltaOnly: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(true),
      S.annotateKey({
        description: "Whether the response graph contains only newly inferred triples.",
      })
    ),
  },
  $I.annote("InferenceRunRequest", {
    description: "Inference request with a non-empty RDF graph and schema-owned format, profile, and delta defaults.",
  })
) {
  static readonly is = S.is(InferenceRunRequest);
  static readonly fromUnknown = S.decodeUnknownSync(InferenceRunRequest);
  static readonly decodeOption = S.decodeUnknownOption(InferenceRunRequest);
}

/**
 * Lifecycle status reported for an inference job.
 *
 * **Example** (Use InferenceStatus)
 * ```ts
 * import { InferenceStatus } from "@effect-ontology/Schema/Inference"
 *
 * console.log(InferenceStatus.is.processing("processing")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InferenceStatus = LiteralKit(["complete", "processing", "failed"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("complete", "processing", "failed"),
  })
  .annotate(
    $I.annote("InferenceStatus", {
      description: "Terminal and in-flight statuses emitted by an inference job.",
    })
  );

/**
 * Runtime value accepted by {@link InferenceStatus}.
 *
 * **Example** (Use InferenceStatus)
 * ```ts
 * import type { InferenceStatus } from "@effect-ontology/Schema/Inference"
 *
 * const status: InferenceStatus = "complete"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type InferenceStatus = typeof InferenceStatus.Type;

/**
 * Result envelope for a submitted inference run.
 *
 * **Details**
 *
 * * Optional output, statistics, and diagnostic fields decode to `Option`, so
 * downstream matching follows the job status instead of inspecting nullish
 * values.
 *
 * **Example** (Use InferenceRunResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { InferenceRunResponse } from "@effect-ontology/Schema/Inference"
 *
 * const response = S.decodeUnknownOption(InferenceRunResponse)({
 *   jobId: "inference-42",
 *   status: "processing"
 * })
 * console.log(O.map(response, (value) => value.status)) // Some("processing")
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class InferenceRunResponse extends S.Class<InferenceRunResponse>($I`InferenceRunResponse`)(
  {
    jobId: S.NonEmptyString.annotateKey({
      description: "Non-empty identifier assigned to the inference job.",
    }),
    status: InferenceStatus.annotateKey({
      description: "Current lifecycle status of the inference job.",
    }),
    outputGraph: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional serialized result graph, present when a result is available.",
      })
    ),
    stats: S.OptionFromOptionalKey(InferenceStats).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional measurements produced by a completed inference run.",
      })
    ),
    error: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional non-empty failure diagnostic.",
      })
    ),
  },
  $I.annote("InferenceRunResponse", {
    description: "Inference job result envelope with Option-normalized graph, statistics, and error fields.",
  })
) {
  static readonly is = S.is(InferenceRunResponse);
  static readonly fromUnknown = S.decodeUnknownSync(InferenceRunResponse);
}

/**
 * Polling response for one inference job.
 *
 * **Example** (Use InferenceStatusResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { InferenceStatusResponse } from "@effect-ontology/Schema/Inference"
 *
 * const status = S.decodeUnknownOption(InferenceStatusResponse)({
 *   jobId: "inference-42",
 *   status: "processing"
 * })
 * console.log(O.map(status, (value) => value.status)) // Some("processing")
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class InferenceStatusResponse extends S.Class<InferenceStatusResponse>($I`InferenceStatusResponse`)(
  {
    jobId: S.NonEmptyString.annotateKey({
      description: "Non-empty identifier assigned to the inference job.",
    }),
    status: InferenceStatus.annotateKey({
      description: "Current lifecycle status of the inference job.",
    }),
    result: S.OptionFromOptionalKey(InferenceRunResponse).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional complete run response once the result is available.",
      })
    ),
  },
  $I.annote("InferenceStatusResponse", {
    description: "Poll response containing current inference status and an Option-normalized final result.",
  })
) {
  static readonly is = S.is(InferenceStatusResponse);
  static readonly fromUnknown = S.decodeUnknownSync(InferenceStatusResponse);
}
