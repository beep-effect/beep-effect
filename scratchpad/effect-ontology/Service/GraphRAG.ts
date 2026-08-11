/**
 * Service: GraphRAG
 *
 * Graph-based Retrieval-Augmented Generation for knowledge graph querying.
 * Combines entity embedding search with subgraph extraction to provide
 * structured, coherent context for LLM prompts.
 *
 * Implements patterns from SOTA research:
 * - GraphRAG multi-hop retrieval (Peng et al., 2024)
 * - Ontology-guided reasoning (Zhang et al., 2025)
 * - RRF fusion for hybrid scoring
 *
 * @since 2.0.0
 * @module Service/GraphRAG
 */

import type { AiError, LanguageModel } from "effect/unstable/ai"
import { Data, Effect, Schema, Context, Layer } from "effect"
import type { TimeoutError } from "effect/Cause"
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts"
import type { Entity, KnowledgeGraph, Relation } from "../Domain/Model/Entity.ts"
import { EntityIndex } from "./EntityIndex.ts"
import { generateObjectWithFeedback } from "./GenerateWithFeedback.ts"
import { type Subgraph, SubgraphExtractor } from "./SubgraphExtractor.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/GraphRAG");

/**
 * Scored node in retrieval result
 *
 * @since 2.0.0
 * @category Types
 */
export interface ScoredNode {
  readonly entity: Entity
  /** Combined relevance score (0-1) */
  readonly score: number
  /** Distance from seed entities (0 = seed) */
  readonly hopDistance: number
  /** Whether this was a seed entity from initial retrieval */
  readonly isSeed: boolean
}

/**
 * Retrieval result containing subgraph and formatted context
 *
 * @since 2.0.0
 * @category Types
 */
export interface RetrievalResult {
  /** Extracted subgraph around relevant entities */
  readonly subgraph: Subgraph
  /** All nodes with relevance scores, sorted by score descending */
  readonly scoredNodes: ReadonlyArray<ScoredNode>
  /** Formatted context string for LLM prompts */
  readonly context: string
  /** Original query */
  readonly query: string
  /** Retrieval statistics */
  readonly stats: RetrievalStats
}

/**
 * Statistics about the retrieval operation
 *
 * @since 2.0.0
 * @category Types
 */
export interface RetrievalStats {
  /** Number of seed entities found */
  readonly seedCount: number
  /** Total entities in subgraph */
  readonly nodeCount: number
  /** Total relations in subgraph */
  readonly edgeCount: number
  /** Traversal depth used */
  readonly hops: number
  /** Average relevance score */
  readonly avgScore: number
}

/**
 * Options for retrieval operation
 *
 * @since 2.0.0
 * @category Types
 */
export interface RetrievalOptions {
  /** Number of seed entities to find via embedding search (default: 5) */
  readonly topK?: number
  /** Number of hops to traverse from seeds (default: 1) */
  readonly hops?: number
  /** Maximum nodes in final subgraph (default: 50) */
  readonly maxNodes?: number
  /** Minimum similarity score for seed selection (default: 0.3) */
  readonly minScore?: number
  /** Filter to only entities with these types */
  readonly includeTypes?: ReadonlyArray<string>
  /** Whether to include entity attributes in context (default: true) */
  readonly includeAttributes?: boolean
  /** Whether to include relation predicates in context (default: true) */
  readonly includeRelations?: boolean
}

/**
 * Grounded answer generated from knowledge graph context
 *
 * @since 2.0.0
 * @category Types
 */
export interface GroundedAnswer {
  /** The generated answer text */
  readonly answer: string
  /** Entity IDs cited in the answer */
  readonly citations: ReadonlyArray<string>
  /** Confidence score (0-1) */
  readonly confidence: number
  /** Brief reasoning explanation */
  readonly reasoning: string
  /** The retrieval result used for generation */
  readonly retrieval: RetrievalResult
}

/**
 * Options for answer generation
 *
 * @since 2.0.0
 * @category Types
 */
export interface GenerationOptions {
  /** Temperature for LLM generation (default: 0.3) */
  readonly temperature?: number
  /** Timeout for LLM call in milliseconds (default: 30000) */
  readonly timeoutMs?: number
  /** Maximum retry attempts (default: 3) */
  readonly maxAttempts?: number
}

/**
 * Combined options for answer() convenience method
 *
 * @since 2.0.0
 * @category Types
 */
export interface AnswerOptions extends RetrievalOptions, GenerationOptions {}

// =============================================================================
// Reasoning Trace Types
// =============================================================================

/**
 * A single step in a reasoning path through the knowledge graph
 *
 * @since 2.0.0
 * @category Types
 */
export interface ReasoningStep {
  /** Source entity in this step */
  readonly from: Entity
  /** Relation connecting from → to */
  readonly relation: Relation
  /** Target entity in this step */
  readonly to: Entity
  /** Human-readable explanation of this step */
  readonly explanation: string
}

/**
 * Complete reasoning trace showing how an answer was derived
 *
 * @since 2.0.0
 * @category Types
 */
export interface ReasoningTrace {
  /** Ordered steps through the knowledge graph */
  readonly steps: ReadonlyArray<ReasoningStep>
  /** Natural language explanation of the full reasoning */
  readonly explanation: string
  /** Confidence inherited from the grounded answer */
  readonly confidence: number
  /** The original query */
  readonly query: string
  /** Entity IDs involved in the reasoning path */
  readonly involvedEntities: ReadonlyArray<string>
}

/**
 * Options for reasoning trace generation
 *
 * @since 2.0.0
 * @category Types
 */
export interface ExplainOptions extends GenerationOptions {
  /** Whether to generate NL explanations for each step (default: true) */
  readonly generateStepExplanations?: boolean
}

/**
 * Error during grounded answer generation
 *
 * @since 2.0.0
 * @category Errors
 */
export class GraphRAGGenerationError extends Data.TaggedError("GraphRAGGenerationError")<{
  readonly message: string
  readonly query: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Schema for LLM structured output
// =============================================================================

/**
 * Schema for grounded answer LLM response
 *
 * @internal
 */
const GroundedAnswerSchema = Schema.Struct({
  answer: Schema.String.annotate({
    title: "Answer",
    description: "The answer to the question based on the knowledge graph context"
  }),
  citations: Schema.Array(Schema.String).annotate({
    title: "Citations",
    description: "Entity IDs from the context that support this answer (use exact IDs like 'alice', 'acme_corp')"
  }),
  confidence: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })).annotate({
    title: "Confidence",
    description: "Confidence score between 0 and 1 based on how well the context supports the answer"
  }),
  reasoning: Schema.String.annotate({
    title: "Reasoning",
    description: "Brief explanation of how the answer was derived from the knowledge graph"
  })
})

/**
 * Schema for reasoning trace LLM response
 *
 * @internal
 */
const ReasoningTraceSchema = Schema.Struct({
  explanation: Schema.String.annotate({
    title: "Explanation",
    description: "Natural language explanation of the complete reasoning process"
  }),
  stepExplanations: Schema.Array(Schema.String).annotate({
    title: "Step Explanations",
    description: "Explanation for each reasoning step in order (one per relationship traversed)"
  })
})

/**
 * GraphRAG service interface
 *
 * @since 2.0.0
 * @category Service
 */
export interface GraphRAGService {
  /**
   * Index a knowledge graph for retrieval
   *
   * @param graph - Knowledge graph to index
   * @returns Number of entities indexed
   */
  readonly index: (graph: KnowledgeGraph) => Effect.Effect<number, AnyEmbeddingError>

  /**
   * Retrieve relevant context for a query
   *
   * Pipeline:
   * 1. Find semantically similar entities via embedding search
   * 2. Extract N-hop subgraph around seed entities
   * 3. Score all nodes using RRF fusion
   * 4. Format as coherent LLM context
   *
   * @param graph - Source knowledge graph
   * @param query - Natural language query
   * @param options - Retrieval configuration
   */
  readonly retrieve: (
    graph: KnowledgeGraph,
    query: string,
    options?: RetrievalOptions
  ) => Effect.Effect<RetrievalResult, AnyEmbeddingError>

  /**
   * Generate a grounded answer using LLM
   *
   * Takes retrieved context and generates an answer with citations.
   *
   * @param llm - Language model service
   * @param query - Natural language query
   * @param retrieval - Retrieved context from retrieve()
   * @param options - Generation options
   */
  readonly generate: (
    llm: LanguageModel.Service,
    query: string,
    retrieval: RetrievalResult,
    options?: GenerationOptions
  ) => Effect.Effect<GroundedAnswer, GraphRAGGenerationError | AiError.AiError | TimeoutError>

  /**
   * Answer a question using knowledge graph (retrieve + generate)
   *
   * Convenience method that combines retrieval and generation in one call.
   *
   * @param llm - Language model service
   * @param graph - Source knowledge graph
   * @param query - Natural language query
   * @param options - Combined retrieval and generation options
   */
  readonly answer: (
    llm: LanguageModel.Service,
    graph: KnowledgeGraph,
    query: string,
    options?: AnswerOptions
  ) => Effect.Effect<GroundedAnswer, AnyEmbeddingError | GraphRAGGenerationError | AiError.AiError | TimeoutError>

  /**
   * Format a subgraph as LLM context
   *
   * Creates a structured, human-readable representation of the graph
   * suitable for inclusion in prompts.
   *
   * @param subgraph - Subgraph to format
   * @param query - Original query for context
   * @param options - Formatting options
   */
  readonly formatContext: (
    subgraph: Subgraph,
    query: string,
    options?: Pick<RetrievalOptions, "includeAttributes" | "includeRelations">
  ) => Effect.Effect<string>

  /**
   * Generate a reasoning trace explaining how an answer was derived
   *
   * Extracts paths through the knowledge graph connecting cited entities
   * and generates natural language explanations for each step.
   *
   * @param llm - Language model service
   * @param answer - Grounded answer to explain
   * @param options - Explain options
   */
  readonly explain: (
    llm: LanguageModel.Service,
    answer: GroundedAnswer,
    options?: ExplainOptions
  ) => Effect.Effect<ReasoningTrace, GraphRAGGenerationError | AiError.AiError | TimeoutError>

  /**
   * Clear the entity index
   */
  readonly clear: () => Effect.Effect<void>

  /**
   * Get index size
   */
  readonly size: () => Effect.Effect<number>
}

/**
 * RRF k constant (experimentally optimal per research)
 */
const RRF_K = 60

/**
 * Compute Reciprocal Rank Fusion score
 *
 * RRF score = Σ (1 / (rank_i + k))
 *
 * This avoids score normalization issues by using rank-based aggregation.
 *
 * @param ranks - Array of ranks from different scoring methods (1-indexed)
 */
const computeRRFScore = (ranks: ReadonlyArray<number>): number => {
  return ranks.reduce((sum, rank) => sum + 1 / (rank + RRF_K), 0)
}

/**
 * Extract type label from IRI
 */
const typeLabel = (typeIri: string): string => {
  const parts = typeIri.split(/[#/]/)
  return parts[parts.length - 1] || typeIri
}

/**
 * Extract predicate label from IRI
 */
const predicateLabel = (predicateIri: string): string => {
  const parts = predicateIri.split(/[#/]/)
  return parts[parts.length - 1] || predicateIri
}

/**
 * GraphRAG - Retrieval-Augmented Generation with Knowledge Graphs
 *
 * @since 2.0.0
 * @category Service
 */
export class GraphRAG extends Context.Service<GraphRAG>()($I`GraphRAG`, {
  make: Effect.gen(function*() {
    const entityIndex = yield* EntityIndex
    const subgraphExtractor = yield* SubgraphExtractor

    /**
     * Build scored nodes with RRF fusion
     */
    const buildScoredNodes = (
      subgraph: Subgraph,
      seedScores: Map<string, number>,
      seedRanks: Map<string, number>
    ): ReadonlyArray<ScoredNode> => {
      const scored: Array<ScoredNode> = []

      for (const entity of subgraph.nodes) {
        const isSeed = subgraph.centerNodes.includes(entity.id)
        const embeddingScore = seedScores.get(entity.id) ?? 0

        // Compute hop distance (0 for seeds, estimate for others)
        let hopDistance = 0
        if (!isSeed) {
          // Estimate: non-seeds are at least 1 hop away
          // Could be more sophisticated with actual BFS tracking
          hopDistance = 1
        }

        // Compute RRF score combining:
        // 1. Embedding similarity rank
        // 2. Hop distance (closer = better rank)
        // 3. Type relevance (could be added)
        const embeddingRank = seedRanks.get(entity.id) ?? subgraph.nodes.length
        const hopRank = hopDistance + 1 // 1-indexed

        const rrfScore = computeRRFScore([embeddingRank, hopRank])

        // Normalize to 0-1 range (max possible is 2 / (1 + 60) ≈ 0.033)
        // We scale up for readability
        const normalizedScore = Math.min(1, rrfScore * 30)

        scored.push({
          entity,
          score: isSeed ? Math.max(normalizedScore, embeddingScore) : normalizedScore,
          hopDistance,
          isSeed
        })
      }

      // Sort by score descending
      return scored.sort((a, b) => b.score - a.score)
    }

    /**
     * Format entities section of context
     */
    const formatEntities = (
      nodes: ReadonlyArray<ScoredNode>,
      includeAttributes: boolean
    ): string => {
      const lines: Array<string> = []

      for (const { entity, isSeed, score } of nodes) {
        const types = entity.types.map(typeLabel).join(", ")
        const seedMarker = isSeed ? " [SEED]" : ""
        const scoreStr = (score * 100).toFixed(0)

        lines.push(`- ${entity.mention} (${types})${seedMarker} [relevance: ${scoreStr}%]`)

        if (includeAttributes && Object.keys(entity.attributes).length > 0) {
          for (const [prop, value] of Object.entries(entity.attributes)) {
            const propLabel = predicateLabel(prop)
            lines.push(`    ${propLabel}: ${String(value)}`)
          }
        }
      }

      return lines.join("\n")
    }

    /**
     * Format relations section of context
     */
    const formatRelations = (
      edges: ReadonlyArray<Relation>,
      entityMap: Map<string, Entity>
    ): string => {
      const lines: Array<string> = []

      for (const rel of edges) {
        const subject = entityMap.get(rel.subjectId)
        const subjectName = subject?.mention ?? rel.subjectId
        const predLabel = predicateLabel(rel.predicate)

        if (rel.isEntityReference && typeof rel.object === "string") {
          const object = entityMap.get(rel.object)
          const objectName = object?.mention ?? rel.object
          lines.push(`- ${subjectName} → ${predLabel} → ${objectName}`)
        } else {
          lines.push(`- ${subjectName} → ${predLabel} → "${String(rel.object)}"`)
        }
      }

      return lines.join("\n")
    }

    /**
     * Format complete context for LLM
     */
    const formatContextImpl = (
      subgraph: Subgraph,
      query: string,
      scoredNodes: ReadonlyArray<ScoredNode>,
      options: Pick<RetrievalOptions, "includeAttributes" | "includeRelations">
    ): string => {
      const includeAttributes = options.includeAttributes ?? true
      const includeRelations = options.includeRelations ?? true

      const entityMap = new Map(subgraph.nodes.map((e) => [e.id, e]))

      // Build context sections
      const sections: Array<string> = []

      // Header with query context
      sections.push("## Retrieved Knowledge Graph Context")
      sections.push("")
      sections.push(`Query: "${query}"`)
      sections.push("")

      // Summary statistics
      const seedCount = scoredNodes.filter((n) => n.isSeed).length
      sections.push(`Found ${subgraph.nodes.length} relevant entities (${seedCount} primary matches)`)
      sections.push(`with ${subgraph.edges.length} relationships.`)
      sections.push("")

      // Entities section
      sections.push("### Relevant Entities")
      sections.push("")
      sections.push(formatEntities(scoredNodes, includeAttributes))
      sections.push("")

      // Relations section
      if (includeRelations && subgraph.edges.length > 0) {
        sections.push("### Relationships")
        sections.push("")
        sections.push(formatRelations(subgraph.edges, entityMap))
        sections.push("")
      }

      // Footer guidance for LLM
      sections.push("---")
      sections.push("Use the above knowledge graph context to answer the query.")
      sections.push("Cite specific entities and relationships when relevant.")

      return sections.join("\n")
    }

    const service: GraphRAGService = {
      index: (graph) => entityIndex.index(graph),

      retrieve: (graph, query, options = {}) =>
        Effect.gen(function*() {
          const topK = options.topK ?? 5
          const hops = options.hops ?? 1
          const maxNodes = options.maxNodes ?? 50
          const minScore = options.minScore ?? 0.3

          // Step 1: Find similar entities via embedding search
          const similar = yield* entityIndex.findSimilar(query, topK, {
            minScore,
            filterTypes: options.includeTypes
          })

          if (similar.length === 0) {
            // Return empty result
            const emptySubgraph: Subgraph = {
              nodes: [],
              edges: [],
              centerNodes: [],
              depth: 0
            }
            return {
              subgraph: emptySubgraph,
              scoredNodes: [],
              context:
                `## Retrieved Knowledge Graph Context\n\nQuery: "${query}"\n\nNo relevant entities found in the knowledge graph.`,
              query,
              stats: {
                seedCount: 0,
                nodeCount: 0,
                edgeCount: 0,
                hops: 0,
                avgScore: 0
              }
            }
          }

          // Build seed score maps
          const seedScores = new Map<string, number>()
          const seedRanks = new Map<string, number>()
          similar.forEach((s, idx) => {
            seedScores.set(s.entity.id, s.score)
            seedRanks.set(s.entity.id, idx + 1) // 1-indexed ranks
          })

          const seedIds = similar.map((s) => s.entity.id)

          // Step 2: Extract N-hop subgraph
          const subgraph = yield* subgraphExtractor.extract(graph, seedIds, hops, {
            maxNodes
          })

          // Step 3: Score all nodes using RRF fusion
          const scoredNodes = buildScoredNodes(subgraph, seedScores, seedRanks)

          // Step 4: Format context
          const context = formatContextImpl(subgraph, query, scoredNodes, options)

          // Compute stats
          const avgScore = scoredNodes.length > 0
            ? scoredNodes.reduce((sum, n) => sum + n.score, 0) / scoredNodes.length
            : 0

          return {
            subgraph,
            scoredNodes,
            context,
            query,
            stats: {
              seedCount: similar.length,
              nodeCount: subgraph.nodes.length,
              edgeCount: subgraph.edges.length,
              hops,
              avgScore
            }
          }
        }),

      formatContext: (subgraph, query, options = {}) =>
        Effect.sync(() => {
          // Build basic scored nodes (no embedding scores available)
          const scoredNodes: Array<ScoredNode> = subgraph.nodes.map((entity) => ({
            entity,
            score: subgraph.centerNodes.includes(entity.id) ? 1 : 0.5,
            hopDistance: subgraph.centerNodes.includes(entity.id) ? 0 : 1,
            isSeed: subgraph.centerNodes.includes(entity.id)
          }))

          return formatContextImpl(subgraph, query, scoredNodes, options)
        }),

      generate: (llm, query, retrieval, options = {}) =>
        Effect.gen(function*() {
          const timeoutMs = options.timeoutMs ?? 30000
          const maxAttempts = options.maxAttempts ?? 3

          // Build prompt with context
          const prompt =
            `You are a knowledge graph assistant. Answer the user's question based ONLY on the provided knowledge graph context.

${retrieval.context}

## Question
${query}

## Instructions
1. Answer the question using ONLY information from the knowledge graph context above
2. Cite specific entity IDs (like 'alice', 'acme_corp') that support your answer
3. If the context doesn't contain enough information, say so and explain what's missing
4. Provide a confidence score based on how well the context supports your answer
5. Briefly explain your reasoning

Respond with a JSON object containing:
- answer: Your answer to the question
- citations: Array of entity IDs that support your answer
- confidence: A number between 0 and 1
- reasoning: Brief explanation of how you derived the answer`

          // Call LLM with structured output
          const response = yield* generateObjectWithFeedback(llm, {
            prompt,
            schema: GroundedAnswerSchema,
            objectName: "grounded_answer",
            maxAttempts,
            serviceName: "GraphRAG",
            timeoutMs
          }).pipe(
            Effect.mapError((e) =>
              e._tag === "TimeoutError"
                ? e
                : new GraphRAGGenerationError({
                  message: `Failed to generate answer: ${e._tag}`,
                  query,
                  cause: e
                })
            )
          )

          // Return full grounded answer
          return {
            answer: response.value.answer,
            citations: response.value.citations,
            confidence: response.value.confidence,
            reasoning: response.value.reasoning,
            retrieval
          }
        }),

      answer: (llm, graph, query, options = {}) =>
        Effect.gen(function*() {
          // Index the graph first
          yield* entityIndex.index(graph)

          // Retrieve relevant context
          const retrieval = yield* service.retrieve(graph, query, options)

          // Generate grounded answer
          return yield* service.generate(llm, query, retrieval, options)
        }),

      explain: (llm, answer, options = {}) =>
        Effect.gen(function*() {
          const timeoutMs = options.timeoutMs ?? 30000
          const maxAttempts = options.maxAttempts ?? 3
          const generateStepExplanations = options.generateStepExplanations ?? true

          const { subgraph } = answer.retrieval
          const entityMap = new Map<string, Entity>(subgraph.nodes.map((e) => [e.id, e]))

          // Extract reasoning steps from edges connecting cited entities
          // Find all edges where both subject and object are in citations or connected
          const citedSet = new Set(answer.citations)
          const relevantEdges: Array<{ from: Entity; relation: Relation; to: Entity }> = []

          for (const edge of subgraph.edges) {
            const fromEntity = entityMap.get(edge.subjectId)
            const toEntityId = edge.isEntityReference ? String(edge.object) : null
            const toEntity = toEntityId ? entityMap.get(toEntityId) : null

            // Include edge if it connects cited entities or spans from cited to relevant
            if (fromEntity && toEntity) {
              const fromCited = citedSet.has(edge.subjectId)
              const toCited = toEntityId && citedSet.has(toEntityId)

              if (fromCited || toCited) {
                relevantEdges.push({ from: fromEntity, relation: edge, to: toEntity })
              }
            }
          }

          // If no edges found, create steps from individual cited entities
          const involvedEntities = new Set<string>()
          for (const edge of relevantEdges) {
            involvedEntities.add(edge.from.id)
            involvedEntities.add(edge.to.id)
          }
          // Also add any cited entities not in edges
          for (const citedId of answer.citations) {
            involvedEntities.add(citedId)
          }

          // Build reasoning steps (without explanations yet)
          const steps: Array<ReasoningStep> = relevantEdges.map((edge) => ({
            from: edge.from,
            relation: edge.relation,
            to: edge.to,
            explanation: "" // Will be filled by LLM
          }))

          // Generate explanations using LLM
          if (generateStepExplanations && steps.length > 0) {
            // Build prompt for step explanations
            const stepsDescription = steps.map((s, i) => {
              const predLabel = predicateLabel(s.relation.predicate)
              return `${i + 1}. ${s.from.mention} → ${predLabel} → ${s.to.mention}`
            }).join("\n")

            const prompt = `You are explaining how an answer was derived from a knowledge graph.

## Original Question
${answer.retrieval.query}

## Answer Given
${answer.answer}

## Reasoning Steps (relationships used)
${stepsDescription}

## Task
Generate a natural language explanation of the overall reasoning, plus a brief explanation for each step showing how it contributes to the answer.

For the step explanations:
- Keep each explanation to 1-2 sentences
- Explain how the relationship helps answer the question
- Reference the actual entities involved`

            const response = yield* generateObjectWithFeedback(llm, {
              prompt,
              schema: ReasoningTraceSchema,
              objectName: "reasoning_trace",
              maxAttempts,
              serviceName: "GraphRAG.explain",
              timeoutMs
            }).pipe(
              Effect.mapError((e) =>
                e._tag === "TimeoutError"
                  ? e
                  : new GraphRAGGenerationError({
                    message: `Failed to generate reasoning trace: ${e._tag}`,
                    query: answer.retrieval.query,
                    cause: e
                  })
              )
            )

            // Merge explanations into steps
            const stepsWithExplanations: Array<ReasoningStep> = steps.map((step, i) => ({
              ...step,
              explanation: response.value.stepExplanations[i] ||
                `${step.from.mention} is connected to ${step.to.mention} via ${predicateLabel(step.relation.predicate)}`
            }))

            return {
              steps: stepsWithExplanations,
              explanation: response.value.explanation,
              confidence: answer.confidence,
              query: answer.retrieval.query,
              involvedEntities: Array.from(involvedEntities)
            }
          }

          // Return trace without LLM explanations
          const stepsWithBasicExplanations: Array<ReasoningStep> = steps.map((step) => ({
            ...step,
            explanation: `${step.from.mention} is connected to ${step.to.mention} via ${
              predicateLabel(step.relation.predicate)
            }`
          }))

          return {
            steps: stepsWithBasicExplanations,
            explanation: answer.reasoning,
            confidence: answer.confidence,
            query: answer.retrieval.query,
            involvedEntities: Array.from(involvedEntities)
          }
        }),

      clear: () => entityIndex.clear(),

      size: () => entityIndex.size()
    }

    return service
  }),
}) {
    static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([EntityIndex.Default, SubgraphExtractor.Default]));
}

/**
 * Default GraphRAG layer
 *
 * Requires EmbeddingService dependencies to be provided.
 *
 * @since 2.0.0
 * @category Layers
 */
export const GraphRAGDefault = GraphRAG.Default
