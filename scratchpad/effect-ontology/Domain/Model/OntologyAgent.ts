/**
 * Immutable contracts for ontology extraction, validation, querying, and
 * reasoning agents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { ShaclSeverity } from "@beep/semantic-web/services/shacl-validation";
import { thunkTrue } from "@beep/utils/thunk";
import { Number as Num } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ExtractionRunId } from "../Identity.ts";
import { ShaclValidationReport, ValidationPolicy } from "../Schema/Shacl.ts";
import type { Entity, Relation } from "./Entity.ts";
import { KnowledgeGraph } from "./Entity.ts";
import { ChunkingConfig } from "./ExtractionRun.ts";
import { OntologyRef } from "./Ontology.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/OntologyAgent");

const AgentConcurrency = PosInt.check(
  S.isBetween(
    { minimum: 1, maximum: 64 },
    {
      identifier: $I`AgentConcurrencyRangeCheck`,
      title: "Ontology Agent Concurrency",
      description: "A bounded number of concurrently executing ontology-agent tasks.",
      message: "Ontology agent concurrency must be an integer between 1 and 64.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 1, max: 64 }).map(PosInt.make),
  })
  .pipe(
    $I.annoteSchema("AgentConcurrency", {
      description: "Bounded ontology-agent concurrency from one through 64 tasks.",
    }),
    SchemaUtils.withCodecStatics
  );

class OntologyAgentConfigModel extends S.Class<OntologyAgentConfigModel>($I`OntologyAgentConfig`)(
  {
    ontology: S.OptionFromOptionalKey(OntologyRef).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Exact ontology version, or no override to use the configured default." })
    ),
    validationPolicy: ValidationPolicy.pipe(
      SchemaUtils.withKeyDefaults(ValidationPolicy.fromUnknown({})),
      S.annotateKey({ description: "Severity-to-workflow failure policy." })
    ),
    concurrency: AgentConcurrency.pipe(
      SchemaUtils.withKeyDefaults(AgentConcurrency.make(4)),
      S.annotateKey({ description: "Maximum concurrently executing extraction tasks." })
    ),
    chunking: ChunkingConfig.pipe(
      SchemaUtils.withKeyDefaults(ChunkingConfig.default()),
      S.annotateKey({ description: "Schema-defaulted text chunking policy." })
    ),
  },
  $I.annote("OntologyAgentConfig", {
    description: "Complete schema-defaulted policy for ontology-agent operations.",
  })
) {}

/**
 * Complete policy for ontology extraction, validation, and reasoning.
 *
 * **Details**
 *
 * * The ontology override is optional because deployments may supply a default.
 * Validation, concurrency, and chunking always have concrete schema-level
 * values, so agent logic does not branch on missing configuration.
 *
 * **Example** (Use OntologyAgentConfig)
 * ```ts
 * import { OntologyAgentConfig } from "@effect-ontology/Model/OntologyAgent"
 *
 * const config = OntologyAgentConfig.default()
 * console.log(config.concurrency) // 4
 * console.log(config.validationPolicy.failOnViolation) // true
 * ```
 *
 * @invariant Concurrency is between one and 64 tasks.
 * @category configuration
 * @since 0.0.0
 */
export const OntologyAgentConfig = OntologyAgentConfigModel.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(OntologyAgentConfigModel)(fc),
}).pipe(
  $I.annoteSchema("OntologyAgentConfig", {
    description: "Complete schema-defaulted policy for ontology-agent operations.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics(() => ({
    /** @returns The canonical ontology-agent policy. */
    default: (): OntologyAgentConfigModel => OntologyAgentConfigModel.make({}),
  }))
);

/**
 * Runtime value decoded by {@link OntologyAgentConfig}.
 *
 * **Example** (Select the concurrency policy)
 * ```ts
 * import type { OntologyAgentConfig } from "@effect-ontology/Model/OntologyAgent"
 * const field: keyof OntologyAgentConfig = "concurrency"
 * console.log(field) // "concurrency"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyAgentConfig = typeof OntologyAgentConfig.Type;

class ExtractionMetricsModel extends S.Class<ExtractionMetricsModel>($I`ExtractionMetrics`)(
  {
    entityCount: NonNegativeInt,
    relationCount: NonNegativeInt,
    chunkCount: NonNegativeInt,
    inputTokens: NonNegativeInt,
    outputTokens: NonNegativeInt,
    duration: S.DurationFromMillis,
    runId: S.OptionFromOptionalKey(ExtractionRunId).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExtractionMetrics", {
    description: "Non-negative extraction counts, token use, elapsed duration, and optional run identity.",
  })
) {
  /**
   * Total input and output tokens consumed.
   *
   * **Example** (Use ExtractionMetrics)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { ExtractionMetrics } from "@effect-ontology/Model/OntologyAgent"
   *
   * const metrics = S.decodeUnknownOption(ExtractionMetrics)({
   *   entityCount: 0,
   *   relationCount: 0,
   *   chunkCount: 1,
   *   inputTokens: 80,
   *   outputTokens: 20,
   *   duration: 5
   * })
   * console.log(O.map(metrics, (value) => value.totalTokens))
   * ```
   *
   * @returns Sum of the non-negative input and output token counters.
   */
  get totalTokens(): number {
    return Num.sum(this.inputTokens, this.outputTokens);
  }
}

/**
 * Measurements produced by a completed extraction operation.
 *
 * **Example** (Use ExtractionMetrics)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ExtractionMetrics } from "@effect-ontology/Model/OntologyAgent"
 *
 * const metrics = S.decodeUnknownOption(ExtractionMetrics)({
 *   entityCount: 2,
 *   relationCount: 1,
 *   chunkCount: 1,
 *   inputTokens: 100,
 *   outputTokens: 20,
 *   duration: 40
 * })
 * console.log(O.map(metrics, (value) => value.totalTokens))
 * ```
 *
 * @invariant All counters are non-negative and duration is represented by `Duration`.
 * @category models
 * @since 0.0.0
 */
export const ExtractionMetrics = ExtractionMetricsModel.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(ExtractionMetricsModel)(fc),
}).pipe(
  $I.annoteSchema("ExtractionMetrics", {
    description: "Non-negative extraction counts, token use, elapsed duration, and optional run identity.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ExtractionMetrics}.
 *
 * **Example** (Select the token counter)
 * ```ts
 * import type { ExtractionMetrics } from "@effect-ontology/Model/OntologyAgent"
 * const field: keyof ExtractionMetrics = "inputTokens"
 * console.log(field) // "inputTokens"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionMetrics = typeof ExtractionMetrics.Type;

/**
 * Complete result of one ontology extraction operation.
 *
 * **Details**
 *
 * Turtle and validation absence are explicit `Option` values. Convenience
 * accessors are colocated with the schema-backed result.
 *
 * **Example** (Reject an incomplete extraction result)
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExtractionResult } from "@effect-ontology/Model/OntologyAgent"
 * console.log(S.is(ExtractionResult)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionResult extends S.Class<ExtractionResult>($I`ExtractionResult`)(
  {
    graph: KnowledgeGraph,
    metrics: ExtractionMetrics,
    turtle: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional RDF graph serialized as Turtle." })
    ),
    validationReport: S.OptionFromOptionalKey(ShaclValidationReport).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional SHACL report produced for the extracted graph." })
    ),
  },
  $I.annote("ExtractionResult", {
    description: "Knowledge graph, metrics, optional Turtle, and optional SHACL validation report.",
  })
) {
  /**
   * Extracted entities.
   *
   * **Example** (Use OntologyAgent)
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const entityCount = (result: ExtractionResult): number => result.entities.length
   * ```
   *
   * @returns Immutable entities owned by the result's knowledge graph.
   */
  get entities(): ReadonlyArray<Entity> {
    return this.graph.entities;
  }

  /**
   * Extracted relations.
   *
   * **Example** (Use OntologyAgent)
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const relationCount = (result: ExtractionResult): number => result.relations.length
   * ```
   *
   * @returns Immutable relations owned by the result's knowledge graph.
   */
  get relations(): ReadonlyArray<Relation> {
    return this.graph.relations;
  }

  /**
   * Whether no entities were extracted.
   *
   * **Example** (Use onNone)
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const hasNoEntities = (result: ExtractionResult): boolean => result.isEmpty
   * ```
   *
   * @returns `true` when the graph's entity collection is empty.
   */
  get isEmpty(): boolean {
    return A.isReadonlyArrayEmpty(this.graph.entities);
  }

  /**
   * Whether validation passed, treating an absent report as not yet invalid.
   *
   * **Example** (Use onNone)
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const accepted = (result: ExtractionResult): boolean => result.isValid
   * ```
   *
   * @returns Report conformance when present; otherwise `true`.
   */
  get isValid(): boolean {
    return O.match(this.validationReport, {
      onNone: thunkTrue,
      onSome: (report) => report.validation.conforms,
    });
  }

  /**
   * Whether non-empty Turtle output is available.
   *
   * **Example** (Use ExtractionResult)
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const serialized = (result: ExtractionResult): boolean => result.hasTurtle
   * ```
   *
   * @returns `true` when the optional Turtle serialization is populated.
   */
  get hasTurtle(): boolean {
    return O.isSome(this.turtle);
  }
}

class ExtractWithClaimsOptionsModel extends S.Class<ExtractWithClaimsOptionsModel>($I`ExtractWithClaimsOptions`)(
  {
    ontologyId: S.NonEmptyString.annotateKey({
      description: "Ontology-registry identifier used by the extraction operation.",
    }),
    articleId: S.NonEmptyString.annotateKey({
      description: "Source article identifier retained as claim provenance.",
    }),
    autoCreateAssertions: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      S.annotateKey({ description: "Whether extracted claims are immediately promoted to assertions." })
    ),
    defaultConfidence: Confidence.pipe(
      SchemaUtils.withKeyDefaults(Confidence.make(0.8)),
      S.annotateKey({ description: "Confidence used when extraction supplies no measured value." })
    ),
    targetNamespace: S.OptionFromOptionalKey(IRI).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional local namespace used when minting entity IRIs." })
    ),
    agentConfig: S.OptionFromOptionalKey(OntologyAgentConfig).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional per-operation agent-policy override." })
    ),
  },
  $I.annote("ExtractWithClaimsOptions", {
    description: "Schema-defaulted options for extraction with claim provenance.",
  })
) {}

/**
 * Options for extracting a graph and provenance-bearing claims.
 *
 * **Details**
 *
 * * The source article and ontology registry identifiers are mandatory. Booleans
 * and confidence receive schema defaults; namespace and agent overrides are
 * `Option` values.
 *
 * **Example** (Use ExtractWithClaimsOptions)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ExtractWithClaimsOptions } from "@effect-ontology/Model/OntologyAgent"
 *
 * const options = S.decodeUnknownOption(ExtractWithClaimsOptions)({
 *   ontologyId: "seattle",
 *   articleId: "article-001"
 * })
 * console.log(O.map(options, (value) => value.autoCreateAssertions))
 * console.log(O.map(options, (value) => value.defaultConfidence))
 * ```
 *
 * @invariant Default confidence lies on the closed unit interval.
 * @category configuration
 * @since 0.0.0
 */
export const ExtractWithClaimsOptions = ExtractWithClaimsOptionsModel.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(ExtractWithClaimsOptionsModel)(fc),
}).pipe(
  $I.annoteSchema("ExtractWithClaimsOptions", {
    description: "Schema-defaulted options for extraction with claim provenance.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ExtractWithClaimsOptions}.
 *
 * **Example** (Select the article identifier)
 * ```ts
 * import type { ExtractWithClaimsOptions } from "@effect-ontology/Model/OntologyAgent"
 * const field: keyof ExtractWithClaimsOptions = "articleId"
 * console.log(field) // "articleId"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractWithClaimsOptions = typeof ExtractWithClaimsOptions.Type;

/**
 * Extraction result augmented with claim-provenance metadata.
 *
 * **Example** (Reject an incomplete claim extraction result)
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent"
 * console.log(S.is(ExtractWithClaimsResult)({})) // false
 * ```
 *
 * @invariant Claim count is non-negative and article identity is non-empty.
 * @category models
 * @since 0.0.0
 */
export class ExtractWithClaimsResult extends S.Class<ExtractWithClaimsResult>($I`ExtractWithClaimsResult`)(
  {
    ...ExtractionResult.fields,
    claimCount: NonNegativeInt.annotateKey({
      description: "Number of provenance-bearing claims created from extracted relations.",
    }),
    articleId: S.NonEmptyString.annotateKey({
      description: "Source article identifier assigned to claim provenance.",
    }),
  },
  $I.annote("ExtractWithClaimsResult", {
    description: "Extraction result extended with claim count and source-article provenance.",
  })
) {
  /**
   * Extracted entities.
   *
   * **Example** (Use OntologyAgent)
   * ```ts
   * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const entityCount = (result: ExtractWithClaimsResult): number => result.entities.length
   * ```
   *
   * @returns Immutable entities owned by the result's knowledge graph.
   */
  get entities(): ReadonlyArray<Entity> {
    return this.graph.entities;
  }

  /**
   * Extracted relations.
   *
   * **Example** (Use OntologyAgent)
   * ```ts
   * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const relationCount = (result: ExtractWithClaimsResult): number => result.relations.length
   * ```
   *
   * @returns Immutable relations owned by the result's knowledge graph.
   */
  get relations(): ReadonlyArray<Relation> {
    return this.graph.relations;
  }

  /**
   * Whether no entities were extracted.
   *
   * **Example** (Use OntologyAgent)
   * ```ts
   * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const hasNoEntities = (result: ExtractWithClaimsResult): boolean => result.isEmpty
   * ```
   *
   * @returns `true` when the graph's entity collection is empty.
   */
  get isEmpty(): boolean {
    return A.isReadonlyArrayEmpty(this.graph.entities);
  }

  /**
   * Whether one or more claims were created.
   *
   * **Example** (Use ExtractWithClaimsResult)
   * ```ts
   * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const producedClaims = (result: ExtractWithClaimsResult): boolean => result.hasClaims
   * ```
   *
   * @returns `true` when the non-negative claim count is greater than zero.
   */
  get hasClaims(): boolean {
    return this.claimCount > 0;
  }
}

class QueryBindingModel extends S.Class<QueryBindingModel>($I`QueryBinding`)(
  {
    bindings: S.Record(S.String, S.String).pipe(
      SchemaUtils.withKeyDefaults({}),
      S.annotateKey({ description: "SPARQL variable names mapped to serialized RDF terms." })
    ),
  },
  $I.annote("QueryBinding", {
    description: "One immutable row of SPARQL variable bindings.",
  })
) {}

/**
 * One row of variable bindings returned by a SPARQL query.
 *
 * **Example** (Use QueryBinding)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { QueryBinding } from "@effect-ontology/Model/OntologyAgent"
 *
 * const row = S.decodeUnknownOption(QueryBinding)({ bindings: { player: "Cristiano Ronaldo" } })
 * console.log(O.map(row, (value) => value.bindings.player))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryBinding = QueryBindingModel.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(QueryBindingModel)(fc),
}).pipe(
  $I.annoteSchema("QueryBinding", {
    description: "One immutable row of SPARQL variable bindings.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link QueryBinding}.
 *
 * **Example** (Select the binding map)
 * ```ts
 * import type { QueryBinding } from "@effect-ontology/Model/OntologyAgent"
 * const field: keyof QueryBinding = "bindings"
 * console.log(field) // "bindings"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QueryBinding = typeof QueryBinding.Type;

class QueryResultModel extends S.Class<QueryResultModel>($I`QueryResult`)(
  {
    answer: S.NonEmptyString.annotateKey({
      description: "Natural-language answer grounded in the query bindings.",
    }),
    sparql: S.NonEmptyString.annotateKey({
      description: "Generated SPARQL query retained for transparency.",
    }),
    bindings: S.Array(QueryBinding).pipe(
      SchemaUtils.withEmptyArrayDefaults<QueryBinding>(),
      S.annotateKey({ description: "Raw result rows returned by SPARQL evaluation." })
    ),
    confidence: Confidence.annotateKey({
      description: "Confidence in the grounded natural-language answer.",
    }),
  },
  $I.annote("QueryResult", {
    description: "Natural-language answer, transparent SPARQL, bindings, and confidence.",
  })
) {
  /**
   * Whether the query returned at least one binding row.
   *
   * **Example** (Use QueryResult)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { QueryResult } from "@effect-ontology/Model/OntologyAgent"
   *
   * const result = S.decodeUnknownOption(QueryResult)({
   *   answer: "No matching entities.",
   *   sparql: "SELECT ?entity WHERE { ?entity a <https://schema.org/Person> }",
   *   confidence: 1
   * })
   * console.log(O.map(result, (value) => value.hasResults))
   * ```
   *
   * @returns `true` when at least one SPARQL binding row is present.
   */
  get hasResults(): boolean {
    return A.isReadonlyArrayNonEmpty(this.bindings);
  }
}

/**
 * Grounded result of a natural-language graph query.
 *
 * **Example** (Use QueryResult)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { QueryResult } from "@effect-ontology/Model/OntologyAgent"
 *
 * const result = S.decodeUnknownOption(QueryResult)({
 *   answer: "Cristiano Ronaldo scored the most goals.",
 *   sparql: "SELECT ?player WHERE { ?player a <https://schema.org/Person> }",
 *   confidence: 0.9
 * })
 * console.log(O.map(result, (value) => value.hasResults))
 * ```
 *
 * @invariant Confidence lies on the closed unit interval.
 * @category models
 * @since 0.0.0
 */
export const QueryResult = QueryResultModel.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(QueryResultModel)(fc),
}).pipe(
  $I.annoteSchema("QueryResult", {
    description: "Natural-language answer, transparent SPARQL, bindings, and confidence.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link QueryResult}.
 *
 * **Example** (Select the answer field)
 * ```ts
 * import type { QueryResult } from "@effect-ontology/Model/OntologyAgent"
 * const field: keyof QueryResult = "answer"
 * console.log(field) // "answer"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QueryResult = typeof QueryResult.Type;

class ReasoningResultModel extends S.Class<ReasoningResultModel>($I`ReasoningResult`)(
  {
    inferredTripleCount: NonNegativeInt,
    rulesApplied: S.Array(S.NonEmptyString).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
    duration: S.DurationFromMillis,
  },
  $I.annote("ReasoningResult", {
    description: "Inferred-triple count, applied reasoning rules, and elapsed duration.",
  })
) {}

/**
 * Result of RDFS or OWL reasoning over a knowledge graph.
 *
 * **Example** (Use ReasoningResult)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ReasoningResult } from "@effect-ontology/Model/OntologyAgent"
 *
 * const result = S.decodeUnknownOption(ReasoningResult)({
 *   inferredTripleCount: 4,
 *   rulesApplied: ["rdfs9"],
 *   duration: 3
 * })
 * console.log(O.map(result, (value) => value.inferredTripleCount))
 * ```
 *
 * @invariant Inferred triple count is non-negative.
 * @category models
 * @since 0.0.0
 */
export const ReasoningResult = ReasoningResultModel.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(ReasoningResultModel)(fc),
}).pipe(
  $I.annoteSchema("ReasoningResult", {
    description: "Inferred-triple count, applied reasoning rules, and elapsed duration.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ReasoningResult}.
 *
 * **Example** (Select inferred triples)
 * ```ts
 * import type { ReasoningResult } from "@effect-ontology/Model/OntologyAgent"
 * const field: keyof ReasoningResult = "inferredTripleCount"
 * console.log(field) // "inferredTripleCount"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReasoningResult = typeof ReasoningResult.Type;

class ViolationsByLevelModel extends S.Class<ViolationsByLevelModel>($I`ViolationsByLevel`)(
  {
    violations: S.Array(S.NonEmptyString).pipe(
      SchemaUtils.withEmptyArrayDefaults<string>(),
      S.annotateKey({ description: "Blocking SHACL Violation diagnostics." })
    ),
    warnings: S.Array(S.NonEmptyString).pipe(
      SchemaUtils.withEmptyArrayDefaults<string>(),
      S.annotateKey({ description: "Non-blocking SHACL Warning diagnostics." })
    ),
    info: S.Array(S.NonEmptyString).pipe(
      SchemaUtils.withEmptyArrayDefaults<string>(),
      S.annotateKey({ description: "Informational SHACL diagnostics." })
    ),
  },
  $I.annote("ViolationsByLevel", {
    description: "SHACL diagnostics partitioned by standard severity.",
  })
) {
  /**
   * Total number of diagnostics across all severity levels.
   *
   * **Example** (Use OntologyAgent)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { ViolationsByLevel } from "@effect-ontology/Model/OntologyAgent"
   *
   * const grouped = S.decodeUnknownOption(ViolationsByLevel)({
   *   violations: ["Missing required name."],
   *   warnings: ["Label uses a deprecated language tag."]
   * })
   * console.log(O.map(grouped, (value) => value.totalCount))
   * ```
   *
   * @returns Sum of violation, warning, and informational diagnostic counts.
   */
  get totalCount(): number {
    return Num.sumAll([A.length(this.violations), A.length(this.warnings), A.length(this.info)]);
  }

  /**
   * Whether at least one blocking violation is present.
   *
   * **Example** (Use ViolationsByLevel)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { ViolationsByLevel } from "@effect-ontology/Model/OntologyAgent"
   *
   * const grouped = S.decodeUnknownOption(ViolationsByLevel)({
   *   violations: ["Missing required name."]
   * })
   * console.log(O.map(grouped, (value) => value.hasCritical))
   * ```
   *
   * @returns `true` when the blocking-violation collection is non-empty.
   */
  get hasCritical(): boolean {
    return A.isReadonlyArrayNonEmpty(this.violations);
  }
}

/**
 * SHACL diagnostics partitioned by standard severity.
 *
 * **Example** (Use ViolationsByLevel)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ViolationsByLevel } from "@effect-ontology/Model/OntologyAgent"
 *
 * const grouped = S.decodeUnknownOption(ViolationsByLevel)({ warnings: ["A label is missing."] })
 * console.log(O.map(grouped, (value) => value.totalCount))
 * console.log(O.map(grouped, (value) => value.hasCritical))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ViolationsByLevel = ViolationsByLevelModel.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(ViolationsByLevelModel)(fc),
}).pipe(
  $I.annoteSchema("ViolationsByLevel", {
    description: "SHACL diagnostics partitioned by standard severity.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ViolationsByLevel}.
 *
 * **Example** (Select blocking violations)
 * ```ts
 * import type { ViolationsByLevel } from "@effect-ontology/Model/OntologyAgent"
 * const field: keyof ViolationsByLevel = "violations"
 * console.log(field) // "violations"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ViolationsByLevel = typeof ViolationsByLevel.Type;

class ViolationExplanationModel extends S.Class<ViolationExplanationModel>($I`ViolationExplanation`)(
  {
    focusNode: S.NonEmptyString.annotateKey({
      description: "Serialized RDF term for the focus node that failed validation.",
    }),
    path: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional serialized SHACL property path." })
    ),
    explanation: S.NonEmptyString.annotateKey({
      description: "Context-aware human-readable explanation of the violation.",
    }),
    suggestion: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional corrective action when one can be determined." })
    ),
    severity: ShaclSeverity.annotateKey({
      description: "Standard SHACL severity assigned to the diagnostic.",
    }),
  },
  $I.annote("ViolationExplanation", {
    description: "Explainable SHACL diagnostic with focus, path, severity, and optional correction.",
  })
) {}

/**
 * Context-aware explanation of one SHACL validation result.
 *
 * **Example** (Use ViolationExplanation)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ViolationExplanation } from "@effect-ontology/Model/OntologyAgent"
 *
 * const explanation = S.decodeUnknownOption(ViolationExplanation)({
 *   focusNode: "https://example.org/alice",
 *   explanation: "Expected at least one name.",
 *   severity: "violation"
 * })
 * console.log(O.map(explanation, (value) => value.severity))
 * ```
 *
 * @invariant Focus node and explanation are non-empty; severity is standard SHACL.
 * @category validation
 * @since 0.0.0
 */
export const ViolationExplanation = ViolationExplanationModel.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(ViolationExplanationModel)(fc),
}).pipe(
  $I.annoteSchema("ViolationExplanation", {
    description: "Explainable SHACL diagnostic with focus, path, severity, and optional correction.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ViolationExplanation}.
 *
 * **Example** (Select the explanation)
 * ```ts
 * import type { ViolationExplanation } from "@effect-ontology/Model/OntologyAgent"
 * const field: keyof ViolationExplanation = "explanation"
 * console.log(field) // "explanation"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ViolationExplanation = typeof ViolationExplanation.Type;

class EnhancedValidationReportModel extends S.Class<EnhancedValidationReportModel>($I`EnhancedValidationReport`)(
  {
    conforms: S.Boolean.annotateKey({
      description: "Whether the data graph conforms to every evaluated shape.",
    }),
    explanations: S.Array(ViolationExplanation).pipe(
      SchemaUtils.withEmptyArrayDefaults<ViolationExplanation>(),
      S.annotateKey({ description: "Context-aware explanation for each surfaced diagnostic." })
    ),
    byLevel: ViolationsByLevel.pipe(
      SchemaUtils.withKeyDefaults(ViolationsByLevelModel.make({})),
      S.annotateKey({ description: "Diagnostics partitioned by SHACL severity." })
    ),
    duration: S.DurationFromMillis,
    dataGraphTripleCount: NonNegativeInt,
    shapesCount: NonNegativeInt,
  },
  $I.annote("EnhancedValidationReport", {
    description: "SHACL conformance report augmented with grouped and explainable diagnostics.",
  })
) {
  /**
   * Total number of grouped diagnostics.
   *
   * **Example** (Use OntologyAgent)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent"
   *
   * const report = S.decodeUnknownOption(EnhancedValidationReport)({
   *   conforms: false,
   *   byLevel: { violations: ["Missing required name."] },
   *   duration: 5,
   *   dataGraphTripleCount: 10,
   *   shapesCount: 2
   * })
   * console.log(O.map(report, (value) => value.violationCount))
   * ```
   *
   * @returns Derived count across every grouped severity level.
   */
  get violationCount(): number {
    return this.byLevel.totalCount;
  }

  /**
   * Whether standards-level validation conforms.
   *
   * **Example** (Use OntologyAgent)
   * ```ts
   * import type { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent"
   *
   * const accepted = (report: EnhancedValidationReport): boolean => report.isValid
   * ```
   *
   * @returns The standards-level conformance decision.
   */
  get isValid(): boolean {
    return this.conforms;
  }

  /**
   * Whether validation conforms while still surfacing non-blocking warnings.
   *
   * **Example** (Use OntologyAgent)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent"
   *
   * const report = S.decodeUnknownOption(EnhancedValidationReport)({
   *   conforms: true,
   *   byLevel: { warnings: ["A recommended label is missing."] },
   *   duration: 5,
   *   dataGraphTripleCount: 10,
   *   shapesCount: 2
   * })
   * console.log(O.map(report, (value) => value.hasWarningsOnly))
   * ```
   *
   * @returns `true` when the report conforms and has at least one warning.
   */
  get hasWarningsOnly(): boolean {
    return this.conforms && A.isReadonlyArrayNonEmpty(this.byLevel.warnings);
  }
}

/**
 * SHACL report augmented with grouped and explainable diagnostics.
 *
 * **Details**
 *
 * * `violationCount` is derived from the severity groups instead of stored as a
 * second potentially stale value. Duration is a `Duration` at runtime while
 * remaining millisecond-encoded at persistence boundaries.
 *
 * **Example** (Use EnhancedValidationReport)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent"
 *
 * const report = S.decodeUnknownOption(EnhancedValidationReport)({
 *   conforms: true,
 *   duration: 5,
 *   dataGraphTripleCount: 42,
 *   shapesCount: 3
 * })
 * console.log(O.map(report, (value) => value.violationCount))
 * ```
 *
 * @invariant Stored counts are non-negative and violation count is derived.
 * @category validation
 * @since 0.0.0
 */
export const EnhancedValidationReport = EnhancedValidationReportModel.annotate({
  toArbitrary: () => (fc) => S.toArbitrary(EnhancedValidationReportModel)(fc),
}).pipe(
  $I.annoteSchema("EnhancedValidationReport", {
    description: "SHACL conformance report augmented with grouped and explainable diagnostics.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link EnhancedValidationReport}.
 *
 * **Example** (Select the conformance field)
 * ```ts
 * import type { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent"
 * const field: keyof EnhancedValidationReport = "conforms"
 * console.log(field) // "conforms"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EnhancedValidationReport = typeof EnhancedValidationReport.Type;
