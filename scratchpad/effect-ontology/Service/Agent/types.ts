/**
 * Service Layer Types: Agent Orchestration
 *
 * **Details**
 *
 * Service-level type definitions for multi-agent orchestration.
 * Extends the domain model with service-specific concerns like
 * task definitions, execution contexts, and feedback handling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { NonNegNum } from "@beep/schema/Number";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Duration } from "effect";
import * as A from "effect/Array";
import type * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { OptionalErrorCause } from "../../Domain/Error/Base.ts";
import type { Agent, AgentId as AgentIdType, AgentType } from "../../Domain/Model/Agent.ts";
import { AgentId, CheckpointConfig, PipelineState, TerminationCondition } from "../../Domain/Model/Agent.ts";
import { KnowledgeGraph } from "../../Domain/Model/Entity.ts";
import { OntologyContext, OntologyRef } from "../../Domain/Model/Ontology.ts";
import { OntologyAgentConfig, ViolationExplanation } from "../../Domain/Model/OntologyAgent.ts";
import type { RdfStore } from "../Rdf.ts";
import { isRdfStore } from "../Rdf.ts";
import { ShaclValidationReport } from "../Shacl.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Agent/types");
const RdfStoreFromSelf = S.declare(isRdfStore).annotate({
  title: "RdfStore",
  description: "Opaque mutable RDF workflow store created by RdfBuilder.",
});

/**
 * Graph representation accepted at agent workflow boundaries.
 *
 * **Details**
 *
 * Agents may exchange an immutable knowledge graph or an opaque mutable RDF
 * store without exposing the store implementation through declarations.
 *
 * **Example** (Validate a knowledge graph)
 *
 * ```ts
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { AgentGraph } from "@effect-ontology/Service/Agent/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AgentGraph)(KnowledgeGraph.make({}))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentGraph = S.Union([KnowledgeGraph, RdfStoreFromSelf]).pipe(
  $I.annoteSchema("AgentGraph", {
    description: "Agent graph boundary accepting a knowledge graph or opaque RDF store.",
    toArbitrary: () => S.toArbitrary(KnowledgeGraph),
  }),
  SchemaUtils.withEffectCodecStatics
);

/**
 * Decoded graph value produced by {@link AgentGraph}.
 *
 * **Example** (Accept an agent graph)
 *
 * ```ts
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import type { AgentGraph } from "@effect-ontology/Service/Agent/types"
 *
 * const graph: AgentGraph = KnowledgeGraph.make({})
 * console.log(graph)
 * ```
 *
 * @see {@link AgentGraph} for the runtime schema and accepted graph representations.
 * @category type-level
 * @since 0.0.0
 */
export type AgentGraph = typeof AgentGraph.Type;

// =============================================================================
// Agent Task Definition
// =============================================================================

/**
 * AgentTask - A unit of work to be processed by the pipeline
 *
 * **Details**
 *
 * Wraps raw input with metadata for tracking and routing.
 *
 * **Example** (Create an extraction task)
 *
 * ```ts
 * import { AgentTask } from "@effect-ontology/Service/Agent/types"
 *
 * const task = AgentTask.forExtraction("task-1", "Ada founded Acme.")
 * console.log(task.taskId) // "task-1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
class AgentTaskModel extends S.Class<AgentTaskModel>($I`AgentTask`)({
  /**
   * Unique task identifier
   */
  taskId: S.String.annotate({
    title: "Task ID",
    description: "Unique identifier for this task",
  }),

  /**
   * Ontology ID for scoping (e.g., "seattle")
   */
  ontologyId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Source text to process (for extraction tasks)
   */
  text: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Source URL to ingest (for ingestion tasks)
   */
  sourceUrl: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Optional ontology agent config override (for extraction tasks)
   */
  agentConfig: OntologyAgentConfig.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Ingestion options (implementation-specific)
   */
  ingestionOptions: S.Unknown.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Ingestion result metadata (implementation-specific)
   */
  ingestionResult: S.Unknown.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Input knowledge graph (legacy; prefer knowledgeGraph/rdfStore/turtle)
   */
  graph: AgentGraph.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Extracted knowledge graph
   */
  knowledgeGraph: KnowledgeGraph.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * RDF store for validation/correction
   */
  rdfStore: RdfStoreFromSelf.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Serialized RDF graph (Turtle)
   */
  turtle: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Ontology context used for extraction/correction
   */
  ontologyContext: OntologyContext.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Ontology reference used for extraction
   */
  ontologyRef: OntologyRef.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Validation report (for correction tasks)
   */
  validationReport: ShaclValidationReport.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Human-readable validation explanations
   */
  validationExplanations: S.Array(ViolationExplanation).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Correction result metadata (implementation-specific)
   */
  correctionResult: S.Unknown.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Source document ID for provenance
   */
  documentId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Additional context for agents
   */
  context: S.Record(S.String, S.Json).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Priority (lower = higher priority)
   */
  priority: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}) {
  /**
   * Create a text extraction task
   *
   * **Example** (Create an extraction task)
   *
   * ```ts
   * import { AgentTask } from "@effect-ontology/Service/Agent/types"
   *
   * const task = AgentTask.forExtraction("task-1", "Ada founded Acme.")
   * console.log(task.taskId) // "task-1"
   * ```
   *
   * @param taskId - Input consumed by this operation.
   * @param text - Input consumed by this operation.
   * @param documentId - Input consumed by this operation.
   * @param agentConfig - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static forExtraction(taskId: string, text: string, documentId?: string, agentConfig?: OntologyAgentConfig) {
    return AgentTask.make({
      taskId,
      text: O.some(text),
      documentId: O.fromUndefinedOr(documentId),
      agentConfig: O.fromUndefinedOr(agentConfig),
      priority: O.some(NonNegativeInt.make(1)),
    });
  }

  /**
   * Create a validation task
   *
   * **Example** (Create a validation task)
   *
   * ```ts
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
   * import { AgentTask } from "@effect-ontology/Service/Agent/types"
   *
   * const task = AgentTask.forValidation("task-2", KnowledgeGraph.make({}))
   * console.log(task.taskId) // "task-2"
   * ```
   *
   * @param taskId - Input consumed by this operation.
   * @param graph - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static forValidation(taskId: string, graph: KnowledgeGraph | RdfStore) {
    return AgentTask.make({ taskId, graph: O.some(graph), priority: O.some(NonNegativeInt.make(2)) });
  }

  /**
   * Create an ingestion task
   *
   * **Example** (Create an ingestion task)
   *
   * ```ts
   * import { AgentTask } from "@effect-ontology/Service/Agent/types"
   *
   * const task = AgentTask.forIngestion("task-3", "https://example.org/ada")
   * console.log(task.taskId) // "task-3"
   * ```
   *
   * @param taskId - Input consumed by this operation.
   * @param sourceUrl - Input consumed by this operation.
   * @param ingestionOptions - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static forIngestion(taskId: string, sourceUrl: string, ingestionOptions?: unknown) {
    return AgentTask.make({
      taskId,
      sourceUrl: O.some(sourceUrl),
      ingestionOptions: O.fromUndefinedOr(ingestionOptions),
      priority: O.some(NonNegativeInt.make(0)),
    });
  }

  /**
   * Create a correction task
   *
   * **Example** (Create a correction task)
   *
   * ```ts
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
   * import { AgentTask } from "@effect-ontology/Service/Agent/types"
   * import { ShaclValidationReport } from "@effect-ontology/Service/Shacl"
   *
   * const task = AgentTask.forCorrection(
   *   "task-4",
   *   KnowledgeGraph.make({}),
   *   ShaclValidationReport.make({ conforms: true, results: [] })
   * )
   * console.log(task.taskId) // "task-4"
   * ```
   *
   * @param taskId - Input consumed by this operation.
   * @param graph - Input consumed by this operation.
   * @param validationReport - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static forCorrection(taskId: string, graph: KnowledgeGraph | RdfStore, validationReport: ShaclValidationReport) {
    return AgentTask.make({
      taskId,
      graph: O.some(graph),
      validationReport: O.some(validationReport),
      priority: O.some(NonNegativeInt.make(3)),
    });
  }
}

/**
 * Runtime value decoded by {@link AgentTask}.
 *
 * @see {@link AgentTask} for the runtime schema and extraction factories.
 * @category type-level
 * @since 0.0.0
 */
export type AgentTask = typeof AgentTask.Type;

/**
 * Schema-backed unit of work processed by the agent pipeline.
 *
 * **Details**
 *
 * Optional task payloads are normalized to `Option` values at construction.
 * The static factories retain the canonical extraction, validation, ingestion,
 * and correction task policies.
 *
 * **Example** (Create an extraction task)
 * ```ts
 * import { AgentTask } from "@effect-ontology/Service/Agent/types"
 *
 * const task = AgentTask.forExtraction("task-1", "Source text")
 * console.log(task.taskId) // "task-1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentTask = AgentTaskModel.pipe(SchemaUtils.withEffectCodecStatics);

// =============================================================================
// Pipeline Configuration
// =============================================================================

/**
 * Execution mode, agent sequence, and termination policy for a pipeline.
 *
 * **Example** (Build a sequential pipeline)
 *
 * ```ts
 * import { PipelineConfig } from "@effect-ontology/Service/Agent/types"
 *
 * const config = PipelineConfig.sequential("extract-validate", ["extractor", "validator"])
 * console.log(config.mode) // "sequential"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PipelineConfig extends S.Class<PipelineConfig>($I`PipelineConfig`)({
  /**
   * Unique pipeline identifier
   */
  pipelineId: S.String,

  /**
   * Execution mode (sequential, loop, parallel, graph)
   */
  mode: S.Literals(["sequential", "loop", "parallel", "graph"]),

  /**
   * Ordered list of agents to execute (for sequential/loop modes)
   */
  agentSequence: S.Array(S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Termination condition (for loop mode)
   */
  termination: TerminationCondition.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Checkpoint configuration
   */
  checkpoint: CheckpointConfig.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Maximum concurrency (for parallel mode)
   */
  concurrency: PosInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Enable detailed tracing
   */
  tracing: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("PipelineConfig", {
    description: "Execution mode, agent sequence, and termination policy for a multi-agent pipeline.",
  })
) {
  /**
   * Create a simple sequential pipeline
   *
   * **Example** (Create a sequential pipeline)
   *
   * ```ts
   * import { PipelineConfig } from "@effect-ontology/Service/Agent/types"
   *
   * const config = PipelineConfig.sequential("extract-validate", ["extractor", "validator"])
   * console.log(config.mode) // "sequential"
   * ```
   *
   * @param pipelineId - Identifier assigned to the pipeline execution
   * @param agents - Ordered agent ids to run
   */
  static sequential(pipelineId: string, agents: ReadonlyArray<string>): PipelineConfig {
    return PipelineConfig.make({
      pipelineId,
      mode: "sequential",
      agentSequence: O.some([...agents]),
    });
  }

  /**
   * Create an extraction-validation-correction loop
   *
   * **Example** (Create a refinement loop)
   *
   * ```ts
   * import { PipelineConfig } from "@effect-ontology/Service/Agent/types"
   *
   * const config = PipelineConfig.refinementLoop("refine-graph", 3)
   * console.log(config.mode) // "loop"
   * ```
   *
   * @param pipelineId - Identifier assigned to the pipeline execution
   * @param maxIterations - Loop bound before the pipeline stops
   */
  static refinementLoop(pipelineId: string, maxIterations: number = 5): PipelineConfig {
    return PipelineConfig.make({
      pipelineId,
      mode: "loop",
      agentSequence: O.some(["extractor", "validator", "corrector"]),
      termination: O.some(
        TerminationCondition.make({
          maxIterations: PosInt.make(maxIterations),
          stopOnConformance: true,
        })
      ),
    });
  }
}

// =============================================================================
// Human Feedback Types
// =============================================================================

/**
 * Human approval of the current pipeline checkpoint.
 *
 * **Example** (Approve the current state)
 *
 * ```ts
 * import { HumanApprove } from "@effect-ontology/Service/Agent/types"
 *
 * const feedback = HumanApprove.make({ comment: "Looks correct." })
 * console.log(feedback._tag) // "HumanApprove"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HumanApprove extends S.TaggedClass<HumanApprove>($I`HumanApprove`)(
  "HumanApprove",
  {
    reviewerId: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    comment: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("HumanApprove", { description: "Human approval of the current pipeline state." })
) {}

/**
 * Human rejection of the current pipeline checkpoint.
 *
 * **Example** (Reject the current state)
 *
 * ```ts
 * import { HumanReject } from "@effect-ontology/Service/Agent/types"
 *
 * const feedback = HumanReject.make({ reason: "Founder relation is inverted." })
 * console.log(feedback._tag) // "HumanReject"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HumanReject extends S.TaggedClass<HumanReject>($I`HumanReject`)(
  "HumanReject",
  {
    reason: S.NonEmptyString,
    reviewerId: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("HumanReject", { description: "Human rejection of the current pipeline state." })
) {}

/**
 * Human-provided modifications to the current pipeline state.
 *
 * **Example** (Supply checkpoint edits)
 *
 * ```ts
 * import { HumanModify } from "@effect-ontology/Service/Agent/types"
 *
 * const feedback = HumanModify.make({
 *   changes: { mention: "Ada Lovelace" },
 *   comment: "Use the full name."
 * })
 * console.log(feedback._tag) // "HumanModify"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HumanModify extends S.TaggedClass<HumanModify>($I`HumanModify`)(
  "HumanModify",
  {
    changes: S.Json,
    reviewerId: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    comment: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("HumanModify", { description: "Human-provided modifications to the current pipeline state." })
) {}

/**
 * Human request to skip one pipeline agent.
 *
 * **Example** (Skip the corrector)
 *
 * ```ts
 * import { AgentId } from "@effect-ontology/Model/Agent"
 * import { HumanSkip } from "@effect-ontology/Service/Agent/types"
 *
 * const feedback = HumanSkip.make({
 *   agentId: AgentId.make("corrector"),
 *   reason: "Validation already passed."
 * })
 * console.log(feedback._tag) // "HumanSkip"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HumanSkip extends S.TaggedClass<HumanSkip>($I`HumanSkip`)(
  "HumanSkip",
  {
    agentId: AgentId,
    reason: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    reviewerId: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("HumanSkip", { description: "Human request to skip one pipeline agent." })
) {}

/**
 * Feedback supplied by a human reviewer at an orchestration checkpoint.
 *
 * **Example** (Inspect human feedback schema)
 *
 * ```ts
 * import { HumanApprove, HumanFeedback } from "@effect-ontology/Service/Agent/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HumanFeedback)(HumanApprove.make({})))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HumanFeedback = S.Union([HumanApprove, HumanReject, HumanModify, HumanSkip]).pipe(
  $I.annoteSchema("HumanFeedback", {
    description: "Tagged union of supported human checkpoint decisions.",
  })
);

/**
 * Runtime feedback decoded by {@link HumanFeedback}.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type HumanFeedback = typeof HumanFeedback.Type;

// =============================================================================
// Refinement Configuration
// =============================================================================

/**
 * Validation-correction loop bounds and stop conditions.
 *
 * **Details**
 *
 * Controls how the refinement loop executes and when it terminates.
 *
 * **Example** (Use the default refinement loop)
 *
 * ```ts
 * import { RefinementConfig } from "@effect-ontology/Service/Agent/types"
 *
 * const config = RefinementConfig.default(3)
 * console.log(config.stopOnConformance) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RefinementConfig extends S.Class<RefinementConfig>($I`RefinementConfig`)({
  /**
   * Maximum number of correction iterations
   */
  maxIterations: PosInt.annotate({
    default: PosInt.make(5),
  }),

  /**
   * Stop when validation report conforms
   */
  stopOnConformance: S.Boolean.annotate({
    default: true,
  }),

  /**
   * Minimum confidence threshold - stop if correction confidence drops below this
   */
  minConfidence: Confidence.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Emit checkpoint every N iterations
   */
  checkpointInterval: PosInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Timeout for the entire refinement loop in milliseconds
   */
  timeoutMs: PosInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Whether to save intermediate states for resume
   */
  enableResume: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Agent ID for the validator
   */
  validatorId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Agent ID for the corrector
   */
  correctorId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("RefinementConfig", {
    description: "Iteration, timeout, and conformance bounds for the validation-correction loop.",
  })
) {
  /**
   * Create a default refinement config
   *
   * **Example** (Create a default refinement config)
   *
   * ```ts
   * import { RefinementConfig } from "@effect-ontology/Service/Agent/types"
   *
   * const config = RefinementConfig.default(3)
   * console.log(config.maxIterations) // 3
   * ```
   *
   * @param maxIterations - Maximum correction iterations before stopping
   */
  static default(maxIterations: number = 5): RefinementConfig {
    return RefinementConfig.make({
      maxIterations: PosInt.make(maxIterations),
      stopOnConformance: true,
    });
  }

  /**
   * Create a strict refinement config with low confidence threshold
   *
   * **Example** (Create a strict refinement config)
   *
   * ```ts
   * import { RefinementConfig } from "@effect-ontology/Service/Agent/types"
   *
   * const config = RefinementConfig.strict(8, 0.9)
   * console.log(config.stopOnConformance) // true
   * ```
   *
   * @param maxIterations - Maximum correction iterations before stopping
   * @param minConfidence - Confidence floor that stops the loop
   */
  static strict(maxIterations: number = 10, minConfidence: number = 0.8): RefinementConfig {
    return RefinementConfig.make({
      maxIterations: PosInt.make(maxIterations),
      stopOnConformance: true,
      minConfidence: O.some(Confidence.make(minConfidence)),
      checkpointInterval: O.some(PosInt.make(2)),
    });
  }

  /**
   * Convert to TerminationCondition
   *
   * **Example** (Convert to a termination condition)
   *
   * ```ts
   * import { RefinementConfig } from "@effect-ontology/Service/Agent/types"
   *
   * const condition = RefinementConfig.default().toTerminationCondition()
   * console.log(condition.stopOnConformance) // true
   * ```
   */
  toTerminationCondition(): TerminationCondition {
    return TerminationCondition.make({
      maxIterations: this.maxIterations,
      stopOnConformance: this.stopOnConformance,
      timeout: O.map(this.timeoutMs, Duration.millis),
    });
  }
}

// =============================================================================
// Pipeline Result Types
// =============================================================================

/**
 * RefinementStatus - Outcome of a refinement loop
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type RefinementStatus =
  | "conformant" // All validations pass
  | "max-iterations" // Hit iteration limit
  | "timeout" // Hit time limit
  | "confidence-threshold" // Confidence dropped too low
  | "human-rejected" // Human rejected at checkpoint
  | "error"; // Pipeline error

/**
 * Outcome of a validation-correction loop, including how it stopped.
 *
 * **Example** (Record a conformant refinement)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { NonNegNum } from "@beep/schema/Number"
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { RefinementResult } from "@effect-ontology/Service/Agent/types"
 *
 * const result = RefinementResult.make({
 *   graph: KnowledgeGraph.make({}),
 *   iterations: NonNegativeInt.make(2),
 *   status: "conformant",
 *   durationMs: NonNegNum.make(1200)
 * })
 * console.log(result.isConformant) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RefinementResult extends S.Class<RefinementResult>($I`RefinementResult`)({
  /**
   * Final knowledge graph
   */
  graph: AgentGraph,

  /**
   * Number of refinement iterations
   */
  iterations: NonNegativeInt,

  /**
   * How the loop terminated
   */
  status: S.Literals(["conformant", "max-iterations", "timeout", "confidence-threshold", "human-rejected", "error"]),

  /**
   * Final validation report
   */
  validationReport: ShaclValidationReport.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Total duration in milliseconds
   */
  durationMs: NonNegNum,

  /**
   * Error message if status is "error"
   */
  error: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Violations fixed per iteration
   */
  violationsFixed: S.Array(NonNegativeInt).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("RefinementResult", {
    description: "Final graph, iteration count, and termination status of a refinement loop.",
  })
) {
  /**
   * Whether refinement produced a conformant graph
   *
   * **Example** (Inspect conformance)
   *
   * ```ts
   * import { NonNegativeInt } from "@beep/schema"
   * import { NonNegNum } from "@beep/schema/Number"
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
   * import { RefinementResult } from "@effect-ontology/Service/Agent/types"
   *
   * const result = RefinementResult.make({
   *   graph: KnowledgeGraph.make({}),
   *   iterations: NonNegativeInt.make(1),
   *   status: "conformant",
   *   durationMs: NonNegNum.make(250)
   * })
   * console.log(result.isConformant) // true
   * ```
   */
  get isConformant(): boolean {
    return this.status === "conformant";
  }

  /**
   * Average violations fixed per iteration
   *
   * **Example** (Average violations fixed)
   *
   * ```ts
   * import { NonNegativeInt } from "@beep/schema"
   * import { NonNegNum } from "@beep/schema/Number"
   * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
   * import { RefinementResult } from "@effect-ontology/Service/Agent/types"
   *
   * const result = RefinementResult.make({
   *   graph: KnowledgeGraph.make({}),
   *   iterations: NonNegativeInt.make(2),
   *   status: "max-iterations",
   *   durationMs: NonNegNum.make(800),
   *   violationsFixed: [2, 1]
   * })
   * console.log(result.avgViolationsFixed) // 1.5
   * ```
   */
  get avgViolationsFixed(): number {
    if (O.isNone(this.violationsFixed) || this.violationsFixed.value.length === 0) return 0;
    const sum = A.reduce(this.violationsFixed.value, 0, (total, value) => total + value);
    return sum / this.violationsFixed.value.length;
  }
}

// =============================================================================
// Agent Registry Types
// =============================================================================

/**
 * RegisteredAgent - An agent registered with the coordinator
 *
 * **Details**
 *
 * Wraps the Agent interface with registration metadata.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface RegisteredAgent<I = unknown, O = unknown, E = never, R = never> {
  /**
   * The agent implementation
   */
  readonly agent: Agent<I, O, E, R>;

  /**
   * Registration timestamp
   */
  readonly registeredAt: number;

  /**
   * Agent type for routing
   */
  readonly agentType: AgentType;

  /**
   * Whether this agent is currently enabled
   */
  readonly enabled: boolean;
}

/**
 * AgentRegistry - Type for the agent registry map
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type AgentRegistry = HashMap.HashMap<AgentIdType, RegisteredAgent>;

// =============================================================================
// Execution Context
// =============================================================================

/**
 * Runtime context shared with agents during pipeline execution.
 *
 * **Details**
 *
 * Carries the current pipeline snapshot, loop iteration, and tracing identifiers.
 *
 * **Example** (Create an execution context)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { NonNegativeInt } from "@beep/schema"
 * import { PipelineState, PipelineStatus } from "@effect-ontology/Model/Agent"
 * import { ExecutionContext } from "@effect-ontology/Service/Agent/types"
 *
 * const context = ExecutionContext.make({
 *   pipelineState: PipelineState.make({
 *     pipelineId: "pipeline-ada",
 *     startedAt: DateTime.nowUnsafe(),
 *     status: PipelineStatus.cases.Pending.make({})
 *   }),
 *   iteration: NonNegativeInt.make(0),
 *   tracingEnabled: false
 * })
 * console.log(context.tracingEnabled) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExecutionContext extends S.Class<ExecutionContext>($I`ExecutionContext`)(
  {
    /**
     * Current pipeline state
     */
    pipelineState: PipelineState,

    /**
     * Current iteration (for loop mode)
     */
    iteration: NonNegativeInt,

    /**
     * Whether tracing is enabled
     */
    tracingEnabled: S.Boolean,

    /**
     * Parent span ID for distributed tracing
     */
    parentSpanId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

    /**
     * Correlation ID for request tracking
     */
    correlationId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ExecutionContext", {
    description: "Pipeline snapshot, iteration, and tracing identifiers supplied to executing agents.",
  })
) {}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Failure while executing a single orchestration agent.
 *
 * **Example** (Construct an agent execution error)
 *
 * ```ts
 * import { AgentId } from "@effect-ontology/Model/Agent"
 * import { AgentExecutionError } from "@effect-ontology/Service/Agent/types"
 *
 * const error = AgentExecutionError.make({
 *   agentId: AgentId.make("extractor"),
 *   message: "Language model returned an empty graph"
 * })
 * console.log(error._tag) // "AgentExecutionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AgentExecutionError extends S.TaggedError<AgentExecutionError>($I`AgentExecutionError`)(
  "AgentExecutionError",
  {
    agentId: AgentId,
    message: S.NonEmptyString,
    cause: OptionalErrorCause,
    retryable: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("AgentExecutionError", { description: "Failure while executing a single orchestration agent." })
) {
  static readonly is = S.is(AgentExecutionError);
}

/**
 * Failure while executing an orchestration pipeline.
 *
 * **Example** (Construct a pipeline execution error)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { PipelineState, PipelineStatus } from "@effect-ontology/Model/Agent"
 * import { PipelineExecutionError } from "@effect-ontology/Service/Agent/types"
 *
 * const error = PipelineExecutionError.make({
 *   pipelineId: "pipeline-ada",
 *   message: "Extractor failed before validation",
 *   state: PipelineState.make({
 *     pipelineId: "pipeline-ada",
 *     startedAt: DateTime.nowUnsafe(),
 *     status: PipelineStatus.cases.Failed.make({
 *       failedAt: DateTime.nowUnsafe(),
 *       error: "Extractor failed before validation"
 *     })
 *   })
 * })
 * console.log(error._tag) // "PipelineExecutionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PipelineExecutionError extends S.TaggedError<PipelineExecutionError>($I`PipelineExecutionError`)(
  "PipelineExecutionError",
  {
    pipelineId: S.NonEmptyString,
    message: S.NonEmptyString,
    failedAgentId: AgentId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    state: PipelineState,
    cause: OptionalErrorCause,
  },
  $I.annote("PipelineExecutionError", { description: "Failure while executing an orchestration pipeline." })
) {}

/**
 * Requested orchestration agent is not registered.
 *
 * **Example** (Construct an agent-not-found error)
 *
 * ```ts
 * import { AgentId } from "@effect-ontology/Model/Agent"
 * import { AgentNotFoundError } from "@effect-ontology/Service/Agent/types"
 *
 * const error = AgentNotFoundError.make({
 *   agentId: AgentId.make("corrector"),
 *   registeredAgents: [AgentId.make("extractor")]
 * })
 * console.log(error._tag) // "AgentNotFoundError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AgentNotFoundError extends S.TaggedError<AgentNotFoundError>($I`AgentNotFoundError`)(
  "AgentNotFoundError",
  {
    agentId: AgentId,
    registeredAgents: S.Array(AgentId),
  },
  $I.annote("AgentNotFoundError", { description: "Requested orchestration agent is not registered." })
) {}

/**
 * Human checkpoint approval exceeded its configured timeout.
 *
 * **Example** (Construct a checkpoint timeout)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { CheckpointTimeoutError } from "@effect-ontology/Service/Agent/types"
 *
 * const error = CheckpointTimeoutError.make({
 *   pipelineId: "pipeline-ada",
 *   checkpointId: "checkpoint-1",
 *   timeout: Duration.minutes(5)
 * })
 * console.log(error._tag) // "CheckpointTimeoutError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CheckpointTimeoutError extends S.TaggedError<CheckpointTimeoutError>($I`CheckpointTimeoutError`)(
  "CheckpointTimeoutError",
  {
    pipelineId: S.NonEmptyString,
    checkpointId: S.NonEmptyString,
    timeout: S.Duration,
  },
  $I.annote("CheckpointTimeoutError", { description: "Human checkpoint approval exceeded its configured timeout." })
) {}
