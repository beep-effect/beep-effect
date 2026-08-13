/**
 * Immutable contracts for ontology extraction, validation, querying, and
 * reasoning agents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ExtractionRunId } from "../Identity.ts";
import { ShaclValidationReport, ShaclViolationSeverity, ValidationPolicy } from "../Schema/Shacl.ts";
import type { Entity, Relation } from "./Entity.ts";
import { KnowledgeGraph } from "./Entity.ts";
import { ChunkingConfig } from "./ExtractionRun.ts";
import { OntologyRef } from "./Ontology.ts";
import { Confidence, IRI } from "./shared.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/OntologyAgent");

const AgentConcurrency = S.Int.check(
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
    toArbitrary: () => (fc) => fc.integer({ min: 1, max: 64 }),
  })
  .pipe(
    $I.annoteSchema("AgentConcurrency", {
      description: "Bounded ontology-agent concurrency from one through 64 tasks.",
    }),
    SchemaUtils.withCodecStatics
  );

const OntologyAgentConfigFields = {
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
} as const;

class OntologyAgentConfigModel extends S.Class<OntologyAgentConfigModel>($I`OntologyAgentConfig`)(
  OntologyAgentConfigFields,
  $I.annote("OntologyAgentConfig", {
    description: "Complete schema-defaulted policy for ontology-agent operations.",
  })
) {}

/**
 * Complete policy for ontology extraction, validation, and reasoning.
 *
 * @remarks
 * The ontology override is optional because deployments may supply a default.
 * Validation, concurrency, and chunking always have concrete schema-level
 * values, so agent logic does not branch on missing configuration.
 *
 * @example
 * ```ts
 * import { OntologyAgentConfig } from "@effect-ontology/Model/OntologyAgent.ts"
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
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(OntologyAgentConfigFields))(fc).map((fields) => OntologyAgentConfigModel.make(fields)),
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
 * @example
 * ```ts
 * import type { OntologyAgentConfig } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const concurrency = (config: OntologyAgentConfig): number => config.concurrency
 * console.log(typeof concurrency) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyAgentConfig = typeof OntologyAgentConfig.Type;

const ExtractionMetricsFields = {
  entityCount: NonNegativeInt,
  relationCount: NonNegativeInt,
  chunkCount: NonNegativeInt,
  inputTokens: NonNegativeInt,
  outputTokens: NonNegativeInt,
  duration: S.DurationFromMillis,
  runId: S.OptionFromOptionalKey(ExtractionRunId).pipe(SchemaUtils.withNoneDefault),
} as const;

class ExtractionMetricsModel extends S.Class<ExtractionMetricsModel>($I`ExtractionMetrics`)(
  ExtractionMetricsFields,
  $I.annote("ExtractionMetrics", {
    description: "Non-negative extraction counts, token use, elapsed duration, and optional run identity.",
  })
) {
  /**
   * Total input and output tokens consumed.
   *
   * @example
   * ```ts
   * import { ExtractionMetrics } from "@effect-ontology/Model/OntologyAgent.ts"
   *
   * const metrics = ExtractionMetrics.fromUnknown({
   *   entityCount: 0,
   *   relationCount: 0,
   *   chunkCount: 1,
   *   inputTokens: 80,
   *   outputTokens: 20,
   *   duration: 5
   * })
   * console.log(metrics.totalTokens) // 100
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
 * @example
 * ```ts
 * import { ExtractionMetrics } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const metrics = ExtractionMetrics.fromUnknown({
 *   entityCount: 2,
 *   relationCount: 1,
 *   chunkCount: 1,
 *   inputTokens: 100,
 *   outputTokens: 20,
 *   duration: 40
 * })
 * console.log(metrics.totalTokens) // 120
 * ```
 *
 * @invariant All counters are non-negative and duration is represented by `Duration`.
 * @category models
 * @since 0.0.0
 */
export const ExtractionMetrics = ExtractionMetricsModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(ExtractionMetricsFields))(fc).map((fields) => ExtractionMetricsModel.make(fields)),
}).pipe(
  $I.annoteSchema("ExtractionMetrics", {
    description: "Non-negative extraction counts, token use, elapsed duration, and optional run identity.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ExtractionMetrics}.
 *
 * @example
 * ```ts
 * import type { ExtractionMetrics } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const tokens = (metrics: ExtractionMetrics): number => metrics.totalTokens
 * console.log(typeof tokens) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionMetrics = typeof ExtractionMetrics.Type;

const ExtractionResultFields = {
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
} as const;

class ExtractionResultModel extends S.Class<ExtractionResultModel>($I`ExtractionResult`)(
  ExtractionResultFields,
  $I.annote("ExtractionResult", {
    description: "Knowledge graph, metrics, optional Turtle, and optional SHACL validation report.",
  })
) {
  /**
   * Extracted entities.
   *
   * @example
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent.ts"
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
   * @example
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent.ts"
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
   * @example
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent.ts"
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
   * @example
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent.ts"
   *
   * const accepted = (result: ExtractionResult): boolean => result.isValid
   * ```
   *
   * @returns Report conformance when present; otherwise `true`.
   */
  get isValid(): boolean {
    return O.match(this.validationReport, {
      onNone: () => true,
      onSome: (report) => report.conforms,
    });
  }

  /**
   * Whether non-empty Turtle output is available.
   *
   * @example
   * ```ts
   * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent.ts"
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

/**
 * Complete result of one ontology extraction operation.
 *
 * @remarks
 * Turtle and validation absence are explicit `Option` values. Convenience
 * accessors are colocated with the schema-backed result.
 *
 * @example
 * ```ts
 * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const count = (result: ExtractionResult): number => result.entities.length
 * console.log(typeof count) // "function"
 * ```
 *
 * @category results
 * @since 0.0.0
 */
export const ExtractionResult = ExtractionResultModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(ExtractionResultFields))(fc).map((fields) => ExtractionResultModel.make(fields)),
}).pipe(
  $I.annoteSchema("ExtractionResult", {
    description: "Knowledge graph, metrics, optional Turtle, and optional SHACL validation report.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ExtractionResult}.
 *
 * @example
 * ```ts
 * import type { ExtractionResult } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const valid = (result: ExtractionResult): boolean => result.isValid
 * console.log(typeof valid) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionResult = typeof ExtractionResult.Type;

const ExtractWithClaimsOptionsFields = {
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
} as const;

class ExtractWithClaimsOptionsModel extends S.Class<ExtractWithClaimsOptionsModel>($I`ExtractWithClaimsOptions`)(
  ExtractWithClaimsOptionsFields,
  $I.annote("ExtractWithClaimsOptions", {
    description: "Schema-defaulted options for extraction with claim provenance.",
  })
) {}

/**
 * Options for extracting a graph and provenance-bearing claims.
 *
 * @remarks
 * The source article and ontology registry identifiers are mandatory. Booleans
 * and confidence receive schema defaults; namespace and agent overrides are
 * `Option` values.
 *
 * @example
 * ```ts
 * import { ExtractWithClaimsOptions } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const options = ExtractWithClaimsOptions.fromUnknown({
 *   ontologyId: "seattle",
 *   articleId: "article-001"
 * })
 * console.log(options.autoCreateAssertions) // false
 * console.log(options.defaultConfidence) // 0.8
 * ```
 *
 * @invariant Default confidence lies on the closed unit interval.
 * @category configuration
 * @since 0.0.0
 */
export const ExtractWithClaimsOptions = ExtractWithClaimsOptionsModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(ExtractWithClaimsOptionsFields))(fc).map((fields) =>
      ExtractWithClaimsOptionsModel.make(fields)
    ),
}).pipe(
  $I.annoteSchema("ExtractWithClaimsOptions", {
    description: "Schema-defaulted options for extraction with claim provenance.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ExtractWithClaimsOptions}.
 *
 * @example
 * ```ts
 * import type { ExtractWithClaimsOptions } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const article = (options: ExtractWithClaimsOptions): string => options.articleId
 * console.log(typeof article) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractWithClaimsOptions = typeof ExtractWithClaimsOptions.Type;

const ExtractWithClaimsResultFields = {
  ...ExtractionResultFields,
  claimCount: NonNegativeInt.annotateKey({
    description: "Number of provenance-bearing claims created from extracted relations.",
  }),
  articleId: S.NonEmptyString.annotateKey({
    description: "Source article identifier assigned to claim provenance.",
  }),
} as const;

class ExtractWithClaimsResultModel extends S.Class<ExtractWithClaimsResultModel>($I`ExtractWithClaimsResult`)(
  ExtractWithClaimsResultFields,
  $I.annote("ExtractWithClaimsResult", {
    description: "Extraction result extended with claim count and source-article provenance.",
  })
) {
  /**
   * Extracted entities.
   *
   * @example
   * ```ts
   * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent.ts"
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
   * @example
   * ```ts
   * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent.ts"
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
   * @example
   * ```ts
   * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent.ts"
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
   * @example
   * ```ts
   * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent.ts"
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

/**
 * Extraction result augmented with claim-provenance metadata.
 *
 * @example
 * ```ts
 * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const hasClaims = (result: ExtractWithClaimsResult): boolean => result.hasClaims
 * console.log(typeof hasClaims) // "function"
 * ```
 *
 * @invariant Claim count is non-negative and article identity is non-empty.
 * @category results
 * @since 0.0.0
 */
export const ExtractWithClaimsResult = ExtractWithClaimsResultModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(ExtractWithClaimsResultFields))(fc).map((fields) =>
      ExtractWithClaimsResultModel.make(fields)
    ),
}).pipe(
  $I.annoteSchema("ExtractWithClaimsResult", {
    description: "Extraction result extended with claim count and source-article provenance.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ExtractWithClaimsResult}.
 *
 * @example
 * ```ts
 * import type { ExtractWithClaimsResult } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const count = (result: ExtractWithClaimsResult): number => result.claimCount
 * console.log(typeof count) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractWithClaimsResult = typeof ExtractWithClaimsResult.Type;

const QueryBindingFields = {
  bindings: S.Record(S.String, S.String).pipe(
    SchemaUtils.withKeyDefaults({}),
    S.annotateKey({ description: "SPARQL variable names mapped to serialized RDF terms." })
  ),
} as const;

class QueryBindingModel extends S.Class<QueryBindingModel>($I`QueryBinding`)(
  QueryBindingFields,
  $I.annote("QueryBinding", {
    description: "One immutable row of SPARQL variable bindings.",
  })
) {}

/**
 * One row of variable bindings returned by a SPARQL query.
 *
 * @example
 * ```ts
 * import { QueryBinding } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const row = QueryBinding.fromUnknown({ bindings: { player: "Cristiano Ronaldo" } })
 * console.log(row.bindings.player) // "Cristiano Ronaldo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryBinding = QueryBindingModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(QueryBindingFields))(fc).map((fields) => QueryBindingModel.make(fields)),
}).pipe(
  $I.annoteSchema("QueryBinding", {
    description: "One immutable row of SPARQL variable bindings.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link QueryBinding}.
 *
 * @example
 * ```ts
 * import type { QueryBinding } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const width = (row: QueryBinding): number => Object.keys(row.bindings).length
 * console.log(typeof width) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QueryBinding = typeof QueryBinding.Type;

const QueryResultFields = {
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
} as const;

class QueryResultModel extends S.Class<QueryResultModel>($I`QueryResult`)(
  QueryResultFields,
  $I.annote("QueryResult", {
    description: "Natural-language answer, transparent SPARQL, bindings, and confidence.",
  })
) {
  /**
   * Whether the query returned at least one binding row.
   *
   * @example
   * ```ts
   * import { QueryResult } from "@effect-ontology/Model/OntologyAgent.ts"
   *
   * const result = QueryResult.fromUnknown({
   *   answer: "No matching entities.",
   *   sparql: "SELECT ?entity WHERE { ?entity a <https://schema.org/Person> }",
   *   confidence: 1
   * })
   * console.log(result.hasResults) // false
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
 * @example
 * ```ts
 * import { QueryResult } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const result = QueryResult.fromUnknown({
 *   answer: "Cristiano Ronaldo scored the most goals.",
 *   sparql: "SELECT ?player WHERE { ?player a <https://schema.org/Person> }",
 *   confidence: 0.9
 * })
 * console.log(result.hasResults) // false
 * ```
 *
 * @invariant Confidence lies on the closed unit interval.
 * @category results
 * @since 0.0.0
 */
export const QueryResult = QueryResultModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(QueryResultFields))(fc).map((fields) => QueryResultModel.make(fields)),
}).pipe(
  $I.annoteSchema("QueryResult", {
    description: "Natural-language answer, transparent SPARQL, bindings, and confidence.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link QueryResult}.
 *
 * @example
 * ```ts
 * import type { QueryResult } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const answer = (result: QueryResult): string => result.answer
 * console.log(typeof answer) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QueryResult = typeof QueryResult.Type;

const ReasoningResultFields = {
  inferredTripleCount: NonNegativeInt,
  rulesApplied: S.Array(S.NonEmptyString).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
  duration: S.DurationFromMillis,
} as const;

class ReasoningResultModel extends S.Class<ReasoningResultModel>($I`ReasoningResult`)(
  ReasoningResultFields,
  $I.annote("ReasoningResult", {
    description: "Inferred-triple count, applied reasoning rules, and elapsed duration.",
  })
) {}

/**
 * Result of RDFS or OWL reasoning over a knowledge graph.
 *
 * @example
 * ```ts
 * import { ReasoningResult } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const result = ReasoningResult.fromUnknown({
 *   inferredTripleCount: 4,
 *   rulesApplied: ["rdfs9"],
 *   duration: 3
 * })
 * console.log(result.inferredTripleCount) // 4
 * ```
 *
 * @invariant Inferred triple count is non-negative.
 * @category results
 * @since 0.0.0
 */
export const ReasoningResult = ReasoningResultModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(ReasoningResultFields))(fc).map((fields) => ReasoningResultModel.make(fields)),
}).pipe(
  $I.annoteSchema("ReasoningResult", {
    description: "Inferred-triple count, applied reasoning rules, and elapsed duration.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ReasoningResult}.
 *
 * @example
 * ```ts
 * import type { ReasoningResult } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const count = (result: ReasoningResult): number => result.inferredTripleCount
 * console.log(typeof count) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReasoningResult = typeof ReasoningResult.Type;

const ViolationsByLevelFields = {
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
} as const;

class ViolationsByLevelModel extends S.Class<ViolationsByLevelModel>($I`ViolationsByLevel`)(
  ViolationsByLevelFields,
  $I.annote("ViolationsByLevel", {
    description: "SHACL diagnostics partitioned by standard severity.",
  })
) {
  /**
   * Total number of diagnostics across all severity levels.
   *
   * @example
   * ```ts
   * import { ViolationsByLevel } from "@effect-ontology/Model/OntologyAgent.ts"
   *
   * const grouped = ViolationsByLevel.fromUnknown({
   *   violations: ["Missing required name."],
   *   warnings: ["Label uses a deprecated language tag."]
   * })
   * console.log(grouped.totalCount) // 2
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
   * @example
   * ```ts
   * import { ViolationsByLevel } from "@effect-ontology/Model/OntologyAgent.ts"
   *
   * const grouped = ViolationsByLevel.fromUnknown({
   *   violations: ["Missing required name."]
   * })
   * console.log(grouped.hasCritical) // true
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
 * @example
 * ```ts
 * import { ViolationsByLevel } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const grouped = ViolationsByLevel.fromUnknown({ warnings: ["A label is missing."] })
 * console.log(grouped.totalCount) // 1
 * console.log(grouped.hasCritical) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ViolationsByLevel = ViolationsByLevelModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(ViolationsByLevelFields))(fc).map((fields) => ViolationsByLevelModel.make(fields)),
}).pipe(
  $I.annoteSchema("ViolationsByLevel", {
    description: "SHACL diagnostics partitioned by standard severity.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ViolationsByLevel}.
 *
 * @example
 * ```ts
 * import type { ViolationsByLevel } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const count = (grouped: ViolationsByLevel): number => grouped.totalCount
 * console.log(typeof count) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ViolationsByLevel = typeof ViolationsByLevel.Type;

const ViolationExplanationFields = {
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
  severity: ShaclViolationSeverity.annotateKey({
    description: "Standard SHACL severity assigned to the diagnostic.",
  }),
} as const;

class ViolationExplanationModel extends S.Class<ViolationExplanationModel>($I`ViolationExplanation`)(
  ViolationExplanationFields,
  $I.annote("ViolationExplanation", {
    description: "Explainable SHACL diagnostic with focus, path, severity, and optional correction.",
  })
) {}

/**
 * Context-aware explanation of one SHACL validation result.
 *
 * @example
 * ```ts
 * import { ViolationExplanation } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const explanation = ViolationExplanation.fromUnknown({
 *   focusNode: "https://example.org/alice",
 *   explanation: "Expected at least one name.",
 *   severity: "Violation"
 * })
 * console.log(explanation.severity) // "Violation"
 * ```
 *
 * @invariant Focus node and explanation are non-empty; severity is standard SHACL.
 * @category validation
 * @since 0.0.0
 */
export const ViolationExplanation = ViolationExplanationModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(ViolationExplanationFields))(fc).map((fields) => ViolationExplanationModel.make(fields)),
}).pipe(
  $I.annoteSchema("ViolationExplanation", {
    description: "Explainable SHACL diagnostic with focus, path, severity, and optional correction.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ViolationExplanation}.
 *
 * @example
 * ```ts
 * import type { ViolationExplanation } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const text = (value: ViolationExplanation): string => value.explanation
 * console.log(typeof text) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ViolationExplanation = typeof ViolationExplanation.Type;

const EnhancedValidationReportFields = {
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
} as const;

class EnhancedValidationReportModel extends S.Class<EnhancedValidationReportModel>($I`EnhancedValidationReport`)(
  EnhancedValidationReportFields,
  $I.annote("EnhancedValidationReport", {
    description: "SHACL conformance report augmented with grouped and explainable diagnostics.",
  })
) {
  /**
   * Total number of grouped diagnostics.
   *
   * @example
   * ```ts
   * import { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent.ts"
   *
   * const report = EnhancedValidationReport.fromUnknown({
   *   conforms: false,
   *   byLevel: { violations: ["Missing required name."] },
   *   duration: 5,
   *   dataGraphTripleCount: 10,
   *   shapesCount: 2
   * })
   * console.log(report.violationCount) // 1
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
   * @example
   * ```ts
   * import type { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent.ts"
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
   * @example
   * ```ts
   * import { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent.ts"
   *
   * const report = EnhancedValidationReport.fromUnknown({
   *   conforms: true,
   *   byLevel: { warnings: ["A recommended label is missing."] },
   *   duration: 5,
   *   dataGraphTripleCount: 10,
   *   shapesCount: 2
   * })
   * console.log(report.hasWarningsOnly) // true
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
 * @remarks
 * `violationCount` is derived from the severity groups instead of stored as a
 * second potentially stale value. Duration is a `Duration` at runtime while
 * remaining millisecond-encoded at persistence boundaries.
 *
 * @example
 * ```ts
 * import { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const report = EnhancedValidationReport.fromUnknown({
 *   conforms: true,
 *   duration: 5,
 *   dataGraphTripleCount: 42,
 *   shapesCount: 3
 * })
 * console.log(report.violationCount) // 0
 * ```
 *
 * @invariant Stored counts are non-negative and violation count is derived.
 * @category validation
 * @since 0.0.0
 */
export const EnhancedValidationReport = EnhancedValidationReportModel.annotate({
  toArbitrary: () => (fc) =>
    S.toArbitrary(S.Struct(EnhancedValidationReportFields))(fc).map((fields) =>
      EnhancedValidationReportModel.make(fields)
    ),
}).pipe(
  $I.annoteSchema("EnhancedValidationReport", {
    description: "SHACL conformance report augmented with grouped and explainable diagnostics.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link EnhancedValidationReport}.
 *
 * @example
 * ```ts
 * import type { EnhancedValidationReport } from "@effect-ontology/Model/OntologyAgent.ts"
 *
 * const conforms = (report: EnhancedValidationReport): boolean => report.isValid
 * console.log(typeof conforms) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EnhancedValidationReport = typeof EnhancedValidationReport.Type;
