/**
 * Schema-backed graph retrieval, grounded generation, and path explanation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { Context, Effect, HashMap, HashSet, Inspectable, Layer, Match, Number as Num, Order as Ord } from "effect";
import * as A from "effect/Array";
import type { TimeoutError } from "effect/Cause";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as AiError from "effect/unstable/ai/AiError";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { OptionalErrorCause } from "../Domain/Error/Base.ts";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type { KnowledgeGraph } from "../Domain/Model/Entity.ts";
import { Entity, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { EntityIndex } from "./EntityIndex.ts";
import { generateObjectWithFeedback } from "./GenerateWithFeedback.ts";
import { RetryPolicy } from "./Retry.ts";
import { Subgraph, SubgraphExtractor } from "./SubgraphExtractor.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/GraphRAG");

const RetrievalOptionsFields = {
  topK: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(5)),
    S.annotateKey({ description: "Maximum embedding matches used as graph seeds." })
  ),
  hops: NonNegativeInt.pipe(
    SchemaUtils.withKeyDefaults(NonNegativeInt.make(1)),
    S.annotateKey({ description: "Maximum breadth-first distance from a seed." })
  ),
  maxNodes: PosInt.pipe(
    SchemaUtils.withKeyDefaults(PosInt.make(50)),
    S.annotateKey({ description: "Maximum entities admitted to the retrieved subgraph, including seeds." })
  ),
  minScore: Confidence.pipe(
    SchemaUtils.withKeyDefaults(Confidence.make(0.3)),
    S.annotateKey({ description: "Minimum embedding similarity admitted as a seed." })
  ),
  includeTypes: S.Array(IRI).pipe(
    SchemaUtils.withEmptyArrayDefaults<IRI>(),
    S.annotateKey({ description: "Optional ontology classes restricting seed candidates." })
  ),
  includeAttributes: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(true),
    S.annotateKey({ description: "Whether entity attributes are rendered into generation context." })
  ),
  includeRelations: S.Boolean.pipe(
    SchemaUtils.withKeyDefaults(true),
    S.annotateKey({ description: "Whether relations are rendered into generation context." })
  ),
};

const GenerationOptionsFields = {
  retryPolicy: RetryPolicy.pipe(
    SchemaUtils.withKeyDefaults(RetryPolicy.make({})),
    S.annotateKey({ description: "Validated attempt, backoff, and overall deadline policy." })
  ),
};

/**
 * Retrieved entity with its fused relevance and exact graph distance.
 *
 * **Example** (Inspect the scored-node schema)
 *
 * ```ts
 * import { ScoredNode } from "@effect-ontology/Service/GraphRAG"
 *
 * console.log(ScoredNode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScoredNode extends S.Class<ScoredNode>($I`ScoredNode`)(
  {
    entity: Entity.annotateKey({ description: "Retrieved entity." }),
    score: Confidence.annotateKey({ description: "Fused embedding-rank and hop-distance relevance." }),
    hopDistance: NonNegativeInt.annotateKey({ description: "Shortest measured distance from any accepted seed." }),
    isSeed: S.Boolean.annotateKey({ description: "Whether the entity came directly from embedding search." }),
  },
  $I.annote("ScoredNode", {
    description: "Retrieved entity with a unit-interval relevance score and measured seed distance.",
  })
) {}

/**
 * Statistics for one graph-retrieval operation.
 *
 * **Example** (Inspect retrieval statistics)
 *
 * ```ts
 * import { RetrievalStats } from "@effect-ontology/Service/GraphRAG"
 *
 * console.log(RetrievalStats)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetrievalStats extends S.Class<RetrievalStats>($I`RetrievalStats`)(
  {
    seedCount: NonNegativeInt.annotateKey({ description: "Accepted embedding seeds present in the subgraph." }),
    nodeCount: NonNegativeInt.annotateKey({ description: "Total retrieved entities." }),
    edgeCount: NonNegativeInt.annotateKey({ description: "Total retrieved relations." }),
    hops: NonNegativeInt.annotateKey({ description: "Deepest breadth-first distance actually reached." }),
    avgScore: Confidence.annotateKey({ description: "Mean fused relevance across retrieved entities." }),
  },
  $I.annote("RetrievalStats", {
    description: "Schema-backed counts, actual depth, and average relevance for graph retrieval.",
  })
) {}

/**
 * Validated graph-retrieval policy.
 *
 * **Example** (Use the default retrieval policy)
 *
 * ```ts
 * import { RetrievalOptions } from "@effect-ontology/Service/GraphRAG"
 *
 * const options = RetrievalOptions.make({})
 * console.log(options.maxNodes) // 50
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetrievalOptions extends S.Class<RetrievalOptions>($I`RetrievalOptions`)(
  RetrievalOptionsFields,
  $I.annote("RetrievalOptions", {
    description: "Validated semantic seed, traversal-bound, and context-rendering policy.",
  })
) {}

/**
 * Constructor input accepted by {@link RetrievalOptions}.
 *
 *
 * **Example** (Use the RetrievalOptionsInput contract)
 *
 * ```ts
 * import type { RetrievalOptionsInput } from "@effect-ontology/Service/GraphRAG"
 *
 * const acceptsRetrievalOptionsInput = (_value: RetrievalOptionsInput): void => undefined
 *
 * console.log(acceptsRetrievalOptionsInput)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RetrievalOptionsInput = (typeof RetrievalOptions)["~type.make.in"];

/**
 * Complete retrieval output used to ground a generated answer.
 *
 * **Example** (Inspect the retrieval-result schema)
 *
 * ```ts
 * import { RetrievalResult } from "@effect-ontology/Service/GraphRAG"
 *
 * console.log(RetrievalResult)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetrievalResult extends S.Class<RetrievalResult>($I`RetrievalResult`)(
  {
    subgraph: Subgraph.annotateKey({ description: "Bounded graph context selected for the query." }),
    scoredNodes: S.Array(ScoredNode).annotateKey({ description: "Retrieved entities in descending relevance order." }),
    context: S.String.annotateKey({ description: "Human-readable context supplied to the language model." }),
    query: S.String.annotateKey({ description: "Natural-language query used for retrieval." }),
    stats: RetrievalStats.annotateKey({ description: "Measured retrieval statistics." }),
  },
  $I.annote("RetrievalResult", {
    description: "Bounded subgraph, fused scores, rendered context, query, and measured retrieval statistics.",
  })
) {}

/**
 * Validated language-model retry and timeout policy.
 *
 * **Example** (Use the default generation policy)
 *
 * ```ts
 * import { GenerationOptions } from "@effect-ontology/Service/GraphRAG"
 *
 * const options = GenerationOptions.make({})
 * console.log(options.retryPolicy.maxAttempts) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GenerationOptions extends S.Class<GenerationOptions>($I`GenerationOptions`)(
  GenerationOptionsFields,
  $I.annote("GenerationOptions", {
    description: "Validated retry and deadline policy for grounded language-model generation.",
  })
) {}

/**
 * Constructor input accepted by {@link GenerationOptions}.
 *
 *
 * **Example** (Use the GenerationOptionsInput contract)
 *
 * ```ts
 * import type { GenerationOptionsInput } from "@effect-ontology/Service/GraphRAG"
 *
 * const acceptsGenerationOptionsInput = (_value: GenerationOptionsInput): void => undefined
 *
 * console.log(acceptsGenerationOptionsInput)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GenerationOptionsInput = (typeof GenerationOptions)["~type.make.in"];

/**
 * Combined retrieval and generation policy for {@link GraphRAGService.answer}.
 *
 * **Example** (Use default answer options)
 *
 * ```ts
 * import { AnswerOptions } from "@effect-ontology/Service/GraphRAG"
 *
 * const options = AnswerOptions.make({})
 * console.log(options.topK, options.retryPolicy.maxAttempts)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnswerOptions extends S.Class<AnswerOptions>($I`AnswerOptions`)(
  { ...RetrievalOptionsFields, ...GenerationOptionsFields },
  $I.annote("AnswerOptions", {
    description: "Validated retrieval, context-rendering, timeout, and retry policy for answering a query.",
  })
) {}

/**
 * Constructor input accepted by {@link AnswerOptions}.
 *
 *
 * **Example** (Use the AnswerOptionsInput contract)
 *
 * ```ts
 * import type { AnswerOptionsInput } from "@effect-ontology/Service/GraphRAG"
 *
 * const acceptsAnswerOptionsInput = (_value: AnswerOptionsInput): void => undefined
 *
 * console.log(acceptsAnswerOptionsInput)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnswerOptionsInput = (typeof AnswerOptions)["~type.make.in"];

/**
 * Formatting policy for a graph context block.
 *
 * **Example** (Use default context formatting)
 *
 * ```ts
 * import { FormatContextOptions } from "@effect-ontology/Service/GraphRAG"
 *
 * const options = FormatContextOptions.make({})
 * console.log(options.includeRelations) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FormatContextOptions extends S.Class<FormatContextOptions>($I`FormatContextOptions`)(
  {
    includeAttributes: RetrievalOptionsFields.includeAttributes,
    includeRelations: RetrievalOptionsFields.includeRelations,
  },
  $I.annote("FormatContextOptions", {
    description: "Validated switches controlling attribute and relation rendering in graph context.",
  })
) {}

/**
 * Constructor input accepted by {@link FormatContextOptions}.
 *
 *
 * **Example** (Use the FormatContextOptionsInput contract)
 *
 * ```ts
 * import type { FormatContextOptionsInput } from "@effect-ontology/Service/GraphRAG"
 *
 * const acceptsFormatContextOptionsInput = (_value: FormatContextOptionsInput): void => undefined
 *
 * console.log(acceptsFormatContextOptionsInput)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FormatContextOptionsInput = (typeof FormatContextOptions)["~type.make.in"];

/**
 * Grounded language-model answer whose citations are canonical entity IDs.
 *
 * **Example** (Inspect the grounded-answer schema)
 *
 * ```ts
 * import { GroundedAnswer } from "@effect-ontology/Service/GraphRAG"
 *
 * console.log(GroundedAnswer)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroundedAnswer extends S.Class<GroundedAnswer>($I`GroundedAnswer`)(
  {
    answer: S.NonEmptyString.annotateKey({ description: "Answer derived only from retrieved graph context." }),
    citations: S.Array(EntityId).annotateKey({ description: "Exact entity IDs supporting the answer." }),
    confidence: Confidence.annotateKey({ description: "Model confidence that retrieved context supports the answer." }),
    reasoning: S.NonEmptyString.annotateKey({ description: "Brief derivation of the answer from graph context." }),
    retrieval: RetrievalResult.annotateKey({ description: "Retrieval result used to ground generation." }),
  },
  $I.annote("GroundedAnswer", {
    description: "Generated answer with validated confidence, exact entity citations, and its retrieval provenance.",
  })
) {}

/**
 * One directed knowledge-graph relation in an answer explanation path.
 *
 * **Example** (Inspect the reasoning-step schema)
 *
 * ```ts
 * import { ReasoningStep } from "@effect-ontology/Service/GraphRAG"
 *
 * console.log(ReasoningStep)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReasoningStep extends S.Class<ReasoningStep>($I`ReasoningStep`)(
  {
    from: Entity.annotateKey({ description: "Canonical relation subject." }),
    relation: Relation.annotateKey({ description: "Relation traversed by the explanation path." }),
    to: Entity.annotateKey({ description: "Canonical entity-reference object." }),
    explanation: S.String.annotateKey({ description: "Human-readable explanation of this relation's role." }),
  },
  $I.annote("ReasoningStep", {
    description: "Directed entity-relation-entity step selected from a shortest connecting path.",
  })
) {}

/**
 * Complete path-based derivation for a grounded answer.
 *
 * **Example** (Inspect the reasoning-trace schema)
 *
 * ```ts
 * import { ReasoningTrace } from "@effect-ontology/Service/GraphRAG"
 *
 * console.log(ReasoningTrace)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReasoningTrace extends S.Class<ReasoningTrace>($I`ReasoningTrace`)(
  {
    steps: S.Array(ReasoningStep).annotateKey({ description: "Ordered relations connecting cited entities." }),
    explanation: S.String.annotateKey({ description: "Natural-language explanation of the complete path." }),
    confidence: Confidence.annotateKey({ description: "Confidence inherited from the grounded answer." }),
    query: S.String.annotateKey({ description: "Original query answered by the trace." }),
    involvedEntities: S.Array(EntityId).annotateKey({ description: "Cited and intermediate entity IDs in the path." }),
  },
  $I.annote("ReasoningTrace", {
    description: "Shortest-path reasoning steps, explanation, confidence, query, and involved entity IDs.",
  })
) {}

/**
 * Generation policy for a path explanation.
 *
 * **Example** (Disable generated step explanations)
 *
 * ```ts
 * import { ExplainOptions } from "@effect-ontology/Service/GraphRAG"
 *
 * const options = ExplainOptions.make({ generateStepExplanations: false })
 * console.log(options.generateStepExplanations)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExplainOptions extends S.Class<ExplainOptions>($I`ExplainOptions`)(
  {
    ...GenerationOptionsFields,
    generateStepExplanations: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(true),
      S.annotateKey({ description: "Whether a language model explains the selected path and each step." })
    ),
  },
  $I.annote("ExplainOptions", {
    description: "Validated timeout, retry, and natural-language explanation policy.",
  })
) {}

/**
 * Constructor input accepted by {@link ExplainOptions}.
 *
 *
 * **Example** (Use the ExplainOptionsInput contract)
 *
 * ```ts
 * import type { ExplainOptionsInput } from "@effect-ontology/Service/GraphRAG"
 *
 * const acceptsExplainOptionsInput = (_value: ExplainOptionsInput): void => undefined
 *
 * console.log(acceptsExplainOptionsInput)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExplainOptionsInput = (typeof ExplainOptions)["~type.make.in"];

/**
 * Typed failure while generating or validating a grounded answer or trace.
 *
 * **Example** (Create a grounding failure)
 *
 * ```ts
 * import { GraphRAGGenerationError } from "@effect-ontology/Service/GraphRAG"
 *
 * const error = GraphRAGGenerationError.make({ message: "Citation is outside context.", query: "Who?" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraphRAGGenerationError extends S.TaggedError<GraphRAGGenerationError>($I`GraphRAGGenerationError`)(
  "GraphRAGGenerationError",
  {
    message: S.NonEmptyString.annotateKey({ description: "Human-readable generation or grounding diagnostic." }),
    query: S.String.annotateKey({ description: "Query whose answer or explanation failed." }),
    cause: OptionalErrorCause.annotateKey({ description: "Optional underlying provider defect." }),
  },
  $I.annote("GraphRAGGenerationError", {
    description: "Grounded generation failure retaining its query and optional provider cause.",
  })
) {
  static readonly is = S.is(this);
}

const GroundedAnswerOutput = S.Struct({
  answer: S.NonEmptyString.annotateKey({ description: "Answer supported by the supplied graph context." }),
  citations: S.Array(EntityId).annotateKey({ description: "Exact supporting entity IDs copied from context." }),
  confidence: Confidence.annotateKey({ description: "Unit-interval support confidence." }),
  reasoning: S.NonEmptyString.annotateKey({ description: "Brief grounding explanation." }),
}).pipe(
  $I.annoteSchema("GroundedAnswerOutput", {
    description: "Language-model response contract before retrieval provenance is attached.",
  })
);

const ReasoningTraceOutput = S.Struct({
  explanation: S.NonEmptyString.annotateKey({ description: "Explanation of the complete connecting path." }),
  stepExplanations: S.Array(S.String).annotateKey({ description: "Explanation for each path step in order." }),
}).pipe(
  $I.annoteSchema("ReasoningTraceOutput", {
    description: "Language-model explanation for a precomputed graph path.",
  })
);

/**
 * Effectful GraphRAG service with natural data-first and data-last methods.
 *
 *
 * **Example** (Use the GraphRAGService contract)
 *
 * ```ts
 * import type { GraphRAGService } from "@effect-ontology/Service/GraphRAG"
 *
 * const acceptsGraphRAGService = (_value: GraphRAGService): void => undefined
 *
 * console.log(acceptsGraphRAGService)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface GraphRAGService {
  readonly index: (graph: KnowledgeGraph) => Effect.Effect<number, AnyEmbeddingError>;
  readonly retrieve: {
    (
      graph: KnowledgeGraph,
      query: string,
      options: RetrievalOptionsInput
    ): Effect.Effect<RetrievalResult, AnyEmbeddingError>;
    (
      query: string,
      options: RetrievalOptionsInput
    ): (graph: KnowledgeGraph) => Effect.Effect<RetrievalResult, AnyEmbeddingError>;
  };
  readonly generate: {
    (
      retrieval: RetrievalResult,
      query: string,
      options: GenerationOptionsInput
    ): Effect.Effect<GroundedAnswer, GraphRAGGenerationError | TimeoutError, LanguageModel.LanguageModel>;
    (
      query: string,
      options: GenerationOptionsInput
    ): (
      retrieval: RetrievalResult
    ) => Effect.Effect<GroundedAnswer, GraphRAGGenerationError | TimeoutError, LanguageModel.LanguageModel>;
  };
  readonly answer: {
    (
      graph: KnowledgeGraph,
      query: string,
      options: AnswerOptionsInput
    ): Effect.Effect<
      GroundedAnswer,
      AnyEmbeddingError | GraphRAGGenerationError | TimeoutError,
      LanguageModel.LanguageModel
    >;
    (
      query: string,
      options: AnswerOptionsInput
    ): (
      graph: KnowledgeGraph
    ) => Effect.Effect<
      GroundedAnswer,
      AnyEmbeddingError | GraphRAGGenerationError | TimeoutError,
      LanguageModel.LanguageModel
    >;
  };
  readonly formatContext: {
    (subgraph: Subgraph, query: string, options: FormatContextOptionsInput): Effect.Effect<string>;
    (query: string, options: FormatContextOptionsInput): (subgraph: Subgraph) => Effect.Effect<string>;
  };
  readonly explain: {
    (
      answer: GroundedAnswer,
      options: ExplainOptionsInput
    ): Effect.Effect<ReasoningTrace, GraphRAGGenerationError | TimeoutError, LanguageModel.LanguageModel>;
    (
      options: ExplainOptionsInput
    ): (
      answer: GroundedAnswer
    ) => Effect.Effect<ReasoningTrace, GraphRAGGenerationError | TimeoutError, LanguageModel.LanguageModel>;
  };
  readonly clear: Effect.Effect<void>;
  readonly size: Effect.Effect<number>;
}

const RRF_K = 60;

const computeRRFScore = (ranks: ReadonlyArray<number>): number =>
  A.reduce(ranks, 0, (sum, rank) => sum + 1 / (rank + RRF_K));

const finalIriSegment = (iri: string): string =>
  pipe(
    Str.split(/[#/]/)(iri),
    A.last,
    O.getOrElse(() => iri)
  );

const entityEntry = (entity: Entity): readonly [EntityId, Entity] => [entity.id, entity];
const scoreEntry = (entityId: EntityId, score: number): readonly [EntityId, number] => [entityId, score];
const rankEntry = (entityId: EntityId, rank: number): readonly [EntityId, number] => [entityId, rank];

const buildScoredNodes: {
  (
    subgraph: Subgraph,
    seedScores: HashMap.HashMap<EntityId, number>,
    seedRanks: HashMap.HashMap<EntityId, number>
  ): ReadonlyArray<ScoredNode>;
  (
    seedScores: HashMap.HashMap<EntityId, number>,
    seedRanks: HashMap.HashMap<EntityId, number>
  ): (subgraph: Subgraph) => ReadonlyArray<ScoredNode>;
} = dual(
  3,
  (
    subgraph: Subgraph,
    seedScores: HashMap.HashMap<EntityId, number>,
    seedRanks: HashMap.HashMap<EntityId, number>
  ): ReadonlyArray<ScoredNode> => {
    const distances = HashMap.fromIterable(
      A.map(subgraph.distances, (distance): readonly [EntityId, NonNegativeInt] => [distance.entityId, distance.hops])
    );
    const scored = A.map(subgraph.nodes, (entity) => {
      const isSeed = A.contains(subgraph.centerNodes, entity.id);
      const embeddingScore = O.getOrElse(HashMap.get(seedScores, entity.id), () => 0);
      const hopDistance = O.getOrElse(HashMap.get(distances, entity.id), () => NonNegativeInt.make(0));
      const embeddingRank = O.getOrElse(HashMap.get(seedRanks, entity.id), () => A.length(subgraph.nodes) + 1);
      const normalized = Num.min(1, computeRRFScore([embeddingRank, hopDistance + 1]) * 30);
      return ScoredNode.make({
        entity,
        score: Confidence.make(isSeed ? Num.max(normalized, embeddingScore) : normalized),
        hopDistance,
        isSeed,
      });
    });
    return A.sortWith(scored, (node) => node.score, Ord.flip(Ord.Number));
  }
);

const formatEntities = (nodes: ReadonlyArray<ScoredNode>, includeAttributes: boolean): string =>
  pipe(
    nodes,
    A.flatMap(({ entity, isSeed, score }) => {
      const types = pipe(entity.types, A.map(finalIriSegment), A.join(", "));
      const seedMarker = isSeed ? " [SEED]" : "";
      const base = `- [id: ${entity.id}] ${entity.mention} (${types})${seedMarker} [relevance: ${Num.round(score * 100)}%]`;
      const attributes = includeAttributes
        ? A.map(
            R.toEntries(entity.attributes),
            ([property, value]) => `    ${finalIriSegment(property)}: ${Inspectable.toStringUnknown(value, 0)}`
          )
        : A.empty<string>();
      return A.prepend(attributes, base);
    }),
    A.join("\n")
  );

const formatRelations = (edges: ReadonlyArray<Relation>, entityMap: HashMap.HashMap<EntityId, Entity>): string =>
  pipe(
    edges,
    A.map((relation) => {
      const subjectName = pipe(
        HashMap.get(entityMap, relation.subjectId),
        O.map((entity) => entity.mention),
        O.getOrElse(() => relation.subjectId)
      );
      const object = RelationObject.match(relation.object, {
        EntityReference: ({ value }) => {
          const mention = pipe(
            HashMap.get(entityMap, value),
            O.map((entity) => entity.mention),
            O.getOrElse(() => value)
          );
          return `[id: ${value}] ${mention}`;
        },
        Text: ({ value }) => Inspectable.toStringUnknown(value, 0),
        Number: ({ value }) => Inspectable.toStringUnknown(value, 0),
        Boolean: ({ value }) => Inspectable.toStringUnknown(value, 0),
      });
      return `- [id: ${relation.subjectId}] ${subjectName} → ${finalIriSegment(relation.predicate)} → ${object}`;
    }),
    A.join("\n")
  );

const formatContextImpl = (
  subgraph: Subgraph,
  query: string,
  scoredNodes: ReadonlyArray<ScoredNode>,
  options: FormatContextOptions
): string => {
  const entityMap = HashMap.fromIterable(A.map(subgraph.nodes, entityEntry));
  const seedCount = A.length(A.filter(scoredNodes, (node) => node.isSeed));
  const header = [
    "## Retrieved Knowledge Graph Context",
    "",
    `Query: "${query}"`,
    "",
    `Found ${A.length(subgraph.nodes)} relevant entities (${seedCount} primary matches)`,
    `with ${A.length(subgraph.edges)} relationships.`,
    "",
    "### Relevant Entities",
    "",
    formatEntities(scoredNodes, options.includeAttributes),
    "",
  ];
  const relations =
    options.includeRelations && A.length(subgraph.edges) > 0
      ? ["### Relationships", "", formatRelations(subgraph.edges, entityMap), ""]
      : A.empty<string>();
  return pipe(
    header,
    A.appendAll(relations),
    A.appendAll([
      "---",
      "Use only the graph context above to answer the query.",
      "Citations must copy exact entity IDs from the [id: ...] markers.",
    ]),
    A.join("\n")
  );
};

interface PathPredecessor {
  readonly previous: EntityId;
  readonly step: ReasoningStep;
}

const appendAdjacency = (
  adjacency: HashMap.HashMap<EntityId, ReadonlyArray<ReasoningStep>>,
  entityId: EntityId,
  step: ReasoningStep
): HashMap.HashMap<EntityId, ReadonlyArray<ReasoningStep>> =>
  HashMap.set(
    adjacency,
    entityId,
    A.append(O.getOrElse(HashMap.get(adjacency, entityId), A.empty<ReasoningStep>), step)
  );

const buildAdjacency = (
  subgraph: Subgraph,
  entityMap: HashMap.HashMap<EntityId, Entity>
): HashMap.HashMap<EntityId, ReadonlyArray<ReasoningStep>> => {
  let adjacency = HashMap.empty<EntityId, ReadonlyArray<ReasoningStep>>();
  for (const relation of subgraph.edges) {
    if (RelationObject.guards.EntityReference(relation.object)) {
      const from = HashMap.get(entityMap, relation.subjectId);
      const to = HashMap.get(entityMap, relation.object.value);
      if (O.isSome(from) && O.isSome(to)) {
        const step = ReasoningStep.make({ from: from.value, relation, to: to.value, explanation: "" });
        adjacency = appendAdjacency(adjacency, from.value.id, step);
        adjacency = appendAdjacency(adjacency, to.value.id, step);
      }
    }
  }
  return adjacency;
};

const reconstructPath = (
  predecessors: HashMap.HashMap<EntityId, PathPredecessor>,
  start: EntityId,
  target: EntityId
): O.Option<ReadonlyArray<ReasoningStep>> => {
  let current = target;
  let path = A.empty<ReasoningStep>();
  while (!EntityId.equivalence(current, start)) {
    const predecessor = HashMap.get(predecessors, current);
    if (O.isNone(predecessor)) {
      return O.none();
    }
    path = A.prepend(path, predecessor.value.step);
    current = predecessor.value.previous;
  }
  return O.some(path);
};

const shortestPath = (
  adjacency: HashMap.HashMap<EntityId, ReadonlyArray<ReasoningStep>>,
  start: EntityId,
  target: EntityId
): O.Option<ReadonlyArray<ReasoningStep>> => {
  if (EntityId.equivalence(start, target)) {
    return O.some([]);
  }
  let visited = HashSet.make(start);
  let frontier: ReadonlyArray<EntityId> = [start];
  let predecessors = HashMap.empty<EntityId, PathPredecessor>();

  while (A.length(frontier) > 0) {
    let nextFrontier = A.empty<EntityId>();
    for (const current of frontier) {
      const adjacent = O.getOrElse(HashMap.get(adjacency, current), A.empty<ReasoningStep>);
      for (const step of adjacent) {
        const next = EntityId.equivalence(current, step.from.id) ? step.to.id : step.from.id;
        if (!HashSet.has(visited, next)) {
          visited = HashSet.add(visited, next);
          predecessors = HashMap.set(predecessors, next, { previous: current, step });
          if (EntityId.equivalence(next, target)) {
            return reconstructPath(predecessors, start, target);
          }
          nextFrontier = A.append(nextFrontier, next);
        }
      }
    }
    frontier = nextFrontier;
  }
  return O.none();
};

const connectingSteps = (subgraph: Subgraph, citations: ReadonlyArray<EntityId>): ReadonlyArray<ReasoningStep> => {
  const entityMap = HashMap.fromIterable(A.map(subgraph.nodes, entityEntry));
  const validCitations = A.filter(citations, (citation) => HashMap.has(entityMap, citation));
  const anchor = A.head(validCitations);
  if (O.isNone(anchor)) {
    return [];
  }
  const adjacency = buildAdjacency(subgraph, entityMap);
  let selectedRelations = HashSet.empty<Relation>();
  let result = A.empty<ReasoningStep>();
  for (const target of A.drop(validCitations, 1)) {
    const path = shortestPath(adjacency, anchor.value, target);
    if (O.isSome(path)) {
      for (const step of path.value) {
        if (!HashSet.has(selectedRelations, step.relation)) {
          selectedRelations = HashSet.add(selectedRelations, step.relation);
          result = A.append(result, step);
        }
      }
    }
  }
  return result;
};

const defaultStepExplanation = (step: ReasoningStep): string =>
  `${step.from.mention} is connected to ${step.to.mention} via ${finalIriSegment(step.relation.predicate)}`;

const mapGenerationError =
  (query: string, operation: string) =>
  (error: AiError.AiError | S.SchemaError | TimeoutError): GraphRAGGenerationError | TimeoutError =>
    Match.value(error).pipe(
      Match.tag("TimeoutError", (timeout) => timeout),
      Match.tag("SchemaError", (cause) =>
        GraphRAGGenerationError.make({
          message: `${operation} policy validation failed: ${cause.message}`,
          query,
          cause: O.some(cause),
        })
      ),
      Match.orElse((cause) =>
        GraphRAGGenerationError.make({
          message: `${operation} failed: ${cause.reason._tag}`,
          query,
          cause: O.some(cause),
        })
      )
    );

/**
 * GraphRAG service backed by semantic entity search and bounded graph traversal.
 *
 * **Example** (Access the GraphRAG service tag)
 *
 * ```ts
 * import { GraphRAG } from "@effect-ontology/Service/GraphRAG"
 *
 * console.log(GraphRAG.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GraphRAG extends Context.Service<GraphRAG>()($I`GraphRAG`, {
  make: Effect.gen(function* () {
    const entityIndex = yield* EntityIndex;
    const subgraphExtractor = yield* SubgraphExtractor;

    const retrieveImpl = Effect.fn("GraphRAG.retrieve")(function* (
      graph: KnowledgeGraph,
      query: string,
      optionsInput: RetrievalOptionsInput
    ) {
      const options = RetrievalOptions.make(optionsInput);
      yield* entityIndex.index(graph);
      const similar = yield* entityIndex.findSimilar(
        query,
        options.topK,
        A.length(options.includeTypes) === 0
          ? { minScore: options.minScore }
          : { minScore: options.minScore, filterTypes: options.includeTypes }
      );
      if (A.length(similar) === 0) {
        const subgraph = Subgraph.make({
          nodes: [],
          edges: [],
          centerNodes: [],
          depth: NonNegativeInt.make(0),
          distances: [],
        });
        return RetrievalResult.make({
          subgraph,
          scoredNodes: [],
          context: `## Retrieved Knowledge Graph Context\n\nQuery: "${query}"\n\nNo relevant entities found in the knowledge graph.`,
          query,
          stats: RetrievalStats.make({
            seedCount: NonNegativeInt.make(0),
            nodeCount: NonNegativeInt.make(0),
            edgeCount: NonNegativeInt.make(0),
            hops: NonNegativeInt.make(0),
            avgScore: Confidence.make(0),
          }),
        });
      }

      const seedScores = HashMap.fromIterable(A.map(similar, (match) => scoreEntry(match.entity.id, match.score)));
      const seedRanks = HashMap.fromIterable(A.map(similar, (match, index) => rankEntry(match.entity.id, index + 1)));
      const seedIds = A.map(similar, (match) => match.entity.id);
      const subgraph = yield* subgraphExtractor.extract(graph, seedIds, options.hops, {
        maxNodes: options.maxNodes,
        followIncoming: true,
        followOutgoing: true,
      });
      const scoredNodes = buildScoredNodes(subgraph, seedScores, seedRanks);
      const context = formatContextImpl(
        subgraph,
        query,
        scoredNodes,
        FormatContextOptions.make({
          includeAttributes: options.includeAttributes,
          includeRelations: options.includeRelations,
        })
      );
      const avgScore =
        A.length(scoredNodes) === 0
          ? 0
          : A.reduce(scoredNodes, 0, (sum, node) => sum + node.score) / A.length(scoredNodes);
      return RetrievalResult.make({
        subgraph,
        scoredNodes,
        context,
        query,
        stats: RetrievalStats.make({
          seedCount: NonNegativeInt.make(A.length(subgraph.centerNodes)),
          nodeCount: NonNegativeInt.make(A.length(subgraph.nodes)),
          edgeCount: NonNegativeInt.make(A.length(subgraph.edges)),
          hops: subgraph.depth,
          avgScore: Confidence.make(avgScore),
        }),
      });
    });

    const retrieve: GraphRAGService["retrieve"] = dual(3, retrieveImpl);

    const formatContextImplEffect = Effect.fn("GraphRAG.formatContext")(function* (
      subgraph: Subgraph,
      query: string,
      optionsInput: FormatContextOptionsInput
    ) {
      const options = FormatContextOptions.make(optionsInput);
      const distances = HashMap.fromIterable(
        A.map(subgraph.distances, (distance): readonly [EntityId, NonNegativeInt] => [distance.entityId, distance.hops])
      );
      const scoredNodes = A.map(subgraph.nodes, (entity) => {
        const isSeed = A.contains(subgraph.centerNodes, entity.id);
        return ScoredNode.make({
          entity,
          score: Confidence.make(isSeed ? 1 : 0.5),
          hopDistance: O.getOrElse(HashMap.get(distances, entity.id), () => NonNegativeInt.make(0)),
          isSeed,
        });
      });
      return formatContextImpl(subgraph, query, scoredNodes, options);
    });

    const formatContext: GraphRAGService["formatContext"] = dual(3, formatContextImplEffect);

    const generateImpl = Effect.fn("GraphRAG.generate")(function* (
      retrieval: RetrievalResult,
      query: string,
      optionsInput: GenerationOptionsInput
    ) {
      const options = GenerationOptions.make(optionsInput);
      const response = yield* generateObjectWithFeedback({
        prompt: `You are a knowledge graph assistant. Answer the question using only the supplied context.

${retrieval.context}

## Question
${query}

Return exact entity IDs from [id: ...] markers as citations. Explain when the graph is insufficient.`,
        schema: GroundedAnswerOutput,
        objectName: "grounded_answer",
        serviceName: "GraphRAG.generate",
        retryPolicy: options.retryPolicy,
      }).pipe(Effect.mapError(mapGenerationError(query, "Grounded answer generation")));

      const availableIds = HashSet.fromIterable(A.map(retrieval.subgraph.nodes, (entity) => entity.id));
      const invalidCitations = A.filter(response.value.citations, (citation) => !HashSet.has(availableIds, citation));
      if (A.length(invalidCitations) > 0) {
        return yield* GraphRAGGenerationError.make({
          message: `Generated citations are outside the retrieved subgraph: ${A.join(invalidCitations, ", ")}`,
          query,
        });
      }

      return GroundedAnswer.make({
        answer: response.value.answer,
        citations: response.value.citations,
        confidence: response.value.confidence,
        reasoning: response.value.reasoning,
        retrieval,
      });
    });

    const generate: GraphRAGService["generate"] = dual(3, generateImpl);

    const answerImpl = Effect.fn("GraphRAG.answer")(function* (
      graph: KnowledgeGraph,
      query: string,
      optionsInput: AnswerOptionsInput
    ) {
      const options = AnswerOptions.make(optionsInput);
      const retrieval = yield* retrieve(graph, query, {
        topK: options.topK,
        hops: options.hops,
        maxNodes: options.maxNodes,
        minScore: options.minScore,
        includeTypes: options.includeTypes,
        includeAttributes: options.includeAttributes,
        includeRelations: options.includeRelations,
      });
      return yield* generate(retrieval, query, {
        retryPolicy: options.retryPolicy,
      });
    });

    const answer: GraphRAGService["answer"] = dual(3, answerImpl);

    const explainImpl = Effect.fn("GraphRAG.explain")(function* (
      answerValue: GroundedAnswer,
      optionsInput: ExplainOptionsInput
    ) {
      const options = ExplainOptions.make(optionsInput);
      const steps = connectingSteps(answerValue.retrieval.subgraph, answerValue.citations);
      const involvedEntities = A.fromIterable(
        A.reduce(steps, HashSet.fromIterable(answerValue.citations), (ids, step) =>
          HashSet.add(HashSet.add(ids, step.from.id), step.to.id)
        )
      );

      if (!options.generateStepExplanations || A.length(steps) === 0) {
        return ReasoningTrace.make({
          steps: A.map(steps, (step) => ReasoningStep.make({ ...step, explanation: defaultStepExplanation(step) })),
          explanation: answerValue.reasoning,
          confidence: answerValue.confidence,
          query: answerValue.retrieval.query,
          involvedEntities,
        });
      }

      const stepsDescription = pipe(
        steps,
        A.map(
          (step, index) =>
            `${index + 1}. [id: ${step.from.id}] ${step.from.mention} → ${finalIriSegment(step.relation.predicate)} → [id: ${step.to.id}] ${step.to.mention}`
        ),
        A.join("\n")
      );
      const response = yield* generateObjectWithFeedback({
        prompt: `Explain how the precomputed knowledge-graph path supports this answer.

## Question
${answerValue.retrieval.query}

## Answer
${answerValue.answer}

## Connecting Path
${stepsDescription}`,
        schema: ReasoningTraceOutput,
        objectName: "reasoning_trace",
        serviceName: "GraphRAG.explain",
        retryPolicy: options.retryPolicy,
      }).pipe(Effect.mapError(mapGenerationError(answerValue.retrieval.query, "Reasoning trace generation")));

      return ReasoningTrace.make({
        steps: A.map(steps, (step, index) =>
          ReasoningStep.make({
            ...step,
            explanation: O.getOrElse(A.get(response.value.stepExplanations, index), () => defaultStepExplanation(step)),
          })
        ),
        explanation: response.value.explanation,
        confidence: answerValue.confidence,
        query: answerValue.retrieval.query,
        involvedEntities,
      });
    });

    const explain: GraphRAGService["explain"] = dual(2, explainImpl);

    return {
      index: entityIndex.index,
      retrieve,
      generate,
      answer,
      formatContext,
      explain,
      clear: entityIndex.clear,
      size: entityIndex.size,
    } satisfies GraphRAGService;
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([EntityIndex.Default, SubgraphExtractor.Default])
  );
}

/**
 * Live GraphRAG layer backed by the default entity index and subgraph extractor.
 *
 * **Example** (Compose the live GraphRAG layer)
 *
 * ```ts
 * import { GraphRAGDefault } from "@effect-ontology/Service/GraphRAG"
 *
 * console.log(GraphRAGDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GraphRAGDefault = GraphRAG.Default;
