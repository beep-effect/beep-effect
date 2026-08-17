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
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { NonNegNum } from "@beep/schema/Number";
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
const RdfStoreFromSelf: S.Codec<RdfStore, unknown> = S.declare(isRdfStore).annotate({
  title: "RdfStore",
  description: "Opaque mutable RDF workflow store created by RdfBuilder.",
});
type AgentGraphValue = KnowledgeGraph | RdfStore;

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
export const AgentGraph: S.Codec<AgentGraphValue, unknown> = S.Union([KnowledgeGraph, RdfStoreFromSelf]).pipe(
  $I.annoteSchema("AgentGraph", {
    description: "Agent graph boundary accepting a knowledge graph or opaque RDF store.",
    toArbitrary: () => S.toArbitrary(KnowledgeGraph),
  })
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
export type AgentGraph = AgentGraphValue;

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
 * **Example** (Inspect agent task)
 *
 * ```ts
 * import { AgentTask } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(AgentTask)
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
   * **Example** (Inspect agent task.for extraction)
   *
   * ```ts
   * import { AgentTask } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(AgentTask)
   * ```
   *
   * @param taskId - Input consumed by this operation.
   * @param text - Input consumed by this operation.
   * @param documentId - Input consumed by this operation.
   * @param agentConfig - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static forExtraction(
    taskId: string,
    text: string,
    documentId?: string,
    agentConfig?: OntologyAgentConfig
  ): AgentTask {
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
   * **Example** (Inspect agent task.for validation)
   *
   * ```ts
   * import { AgentTask } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(AgentTask)
   * ```
   *
   * @param taskId - Input consumed by this operation.
   * @param graph - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static forValidation(taskId: string, graph: KnowledgeGraph | RdfStore): AgentTask {
    return AgentTask.make({ taskId, graph: O.some(graph), priority: O.some(NonNegativeInt.make(2)) });
  }

  /**
   * Create an ingestion task
   *
   * **Example** (Inspect agent task.for ingestion)
   *
   * ```ts
   * import { AgentTask } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(AgentTask)
   * ```
   *
   * @param taskId - Input consumed by this operation.
   * @param sourceUrl - Input consumed by this operation.
   * @param ingestionOptions - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static forIngestion(taskId: string, sourceUrl: string, ingestionOptions?: unknown): AgentTask {
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
   * **Example** (Inspect agent task.for correction)
   *
   * ```ts
   * import { AgentTask } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(AgentTask)
   * ```
   *
   * @param taskId - Input consumed by this operation.
   * @param graph - Input consumed by this operation.
   * @param validationReport - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static forCorrection(
    taskId: string,
    graph: KnowledgeGraph | RdfStore,
    validationReport: ShaclValidationReport
  ): AgentTask {
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
 * **Example** (Accept an agent task)
 * ```ts
 * import type { AgentTask } from "@effect-ontology/Service/Agent/types"
 *
 * const taskId = (task: AgentTask): string => task.taskId
 * console.log(typeof taskId) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface AgentTask {
  readonly taskId: string;
  readonly ontologyId: O.Option<string>;
  readonly text: O.Option<string>;
  readonly sourceUrl: O.Option<string>;
  readonly agentConfig: O.Option<OntologyAgentConfig>;
  readonly ingestionOptions: O.Option<unknown>;
  readonly ingestionResult: O.Option<unknown>;
  readonly graph: O.Option<AgentGraph>;
  readonly knowledgeGraph: O.Option<KnowledgeGraph>;
  readonly rdfStore: O.Option<RdfStore>;
  readonly turtle: O.Option<string>;
  readonly ontologyContext: O.Option<OntologyContext>;
  readonly ontologyRef: O.Option<OntologyRef>;
  readonly validationReport: O.Option<ShaclValidationReport>;
  readonly validationExplanations: O.Option<ReadonlyArray<ViolationExplanation>>;
  readonly correctionResult: O.Option<unknown>;
  readonly documentId: O.Option<string>;
  readonly context: O.Option<Readonly<Record<string, S.Json>>>;
  readonly priority: O.Option<NonNegativeInt>;
}

type AgentTaskInput = Readonly<Pick<AgentTask, "taskId"> & Partial<Omit<AgentTask, "taskId">>>;

interface AgentTaskSchema extends S.Codec<AgentTask, unknown> {
  readonly make: (props: AgentTaskInput, options?: S.MakeOptions) => AgentTask;
  readonly forExtraction: (
    taskId: string,
    text: string,
    documentId?: string,
    agentConfig?: OntologyAgentConfig
  ) => AgentTask;
  readonly forValidation: (taskId: string, graph: KnowledgeGraph | RdfStore) => AgentTask;
  readonly forIngestion: (taskId: string, sourceUrl: string, ingestionOptions?: unknown) => AgentTask;
  readonly forCorrection: (
    taskId: string,
    graph: KnowledgeGraph | RdfStore,
    validationReport: ShaclValidationReport
  ) => AgentTask;
}

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
export const AgentTask: AgentTaskSchema = AgentTaskModel;

// =============================================================================
// Pipeline Configuration
// =============================================================================

/**
 * PipelineConfig - Configuration for a multi-agent pipeline
 *
 * **Example** (Inspect pipeline config)
 *
 * ```ts
 * import { PipelineConfig } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(PipelineConfig)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PipelineConfig extends S.Class<PipelineConfig>("PipelineConfig")({
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
}) {
  /**
   * Create a simple sequential pipeline
   *
   * **Example** (Inspect pipeline config.sequential)
   *
   * ```ts
   * import { PipelineConfig } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(PipelineConfig)
   * ```
   *
   * @param pipelineId - Input consumed by this operation.
   * @param agents - Input consumed by this operation.
   * @returns Result produced by this operation.
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
   * **Example** (Inspect pipeline config.refinement loop)
   *
   * ```ts
   * import { PipelineConfig } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(PipelineConfig)
   * ```
   *
   * @param pipelineId - Input consumed by this operation.
   * @param maxIterations - Input consumed by this operation.
   * @returns Result produced by this operation.
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
 * HumanApprove - Human approves the current state
 *
 * **Example** (Inspect human approve)
 *
 * ```ts
 * import { HumanApprove } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(HumanApprove)
 * ```
 *
 * @category services
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
 * HumanReject - Human rejects the current state
 *
 * **Example** (Inspect human reject)
 *
 * ```ts
 * import { HumanReject } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(HumanReject)
 * ```
 *
 * @category services
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
 * HumanModify - Human provides modifications to the state
 *
 * **Example** (Inspect human modify)
 *
 * ```ts
 * import { HumanModify } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(HumanModify)
 * ```
 *
 * @category services
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
 * HumanSkip - Human skips a specific agent
 *
 * **Example** (Inspect human skip)
 *
 * ```ts
 * import { HumanSkip } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(HumanSkip)
 * ```
 *
 * @category services
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
 * **Example** (Use the HumanFeedback contract)
 *
 * ```ts
 * import type { HumanFeedback } from "@effect-ontology/Service/Agent/types"
 *
 * const acceptsHumanFeedback = (_value: HumanFeedback): void => undefined
 *
 * console.log(acceptsHumanFeedback)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type HumanFeedback = typeof HumanFeedback.Type;

// =============================================================================
// Refinement Configuration
// =============================================================================

/**
 * RefinementConfig - Configuration for the validation-correction loop
 *
 * **Details**
 *
 * Controls how the refinement loop executes and when it terminates.
 *
 * **Example** (Inspect refinement config)
 *
 * ```ts
 * import { RefinementConfig } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(RefinementConfig)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RefinementConfig extends S.Class<RefinementConfig>("RefinementConfig")({
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
}) {
  /**
   * Create a default refinement config
   *
   * **Example** (Inspect refinement config.default)
   *
   * ```ts
   * import { RefinementConfig } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(RefinementConfig)
   * ```
   *
   * @param maxIterations - Input consumed by this operation.
   * @returns Result produced by this operation.
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
   * **Example** (Inspect refinement config.strict)
   *
   * ```ts
   * import { RefinementConfig } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(RefinementConfig)
   * ```
   *
   * @param maxIterations - Input consumed by this operation.
   * @param minConfidence - Input consumed by this operation.
   * @returns Result produced by this operation.
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
   * **Example** (Inspect refinement config.to termination condition)
   *
   * ```ts
   * import { RefinementConfig } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(RefinementConfig)
   * ```
   *
   * @returns Result produced by this operation.
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
 * **Example** (Use the RefinementStatus contract)
 *
 * ```ts
 * import type { RefinementStatus } from "@effect-ontology/Service/Agent/types"
 *
 * const acceptsRefinementStatus = (_value: RefinementStatus): void => undefined
 *
 * console.log(acceptsRefinementStatus)
 * ```
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
 * RefinementResult - Result of a validation-correction loop
 *
 * **Example** (Inspect refinement result)
 *
 * ```ts
 * import { RefinementResult } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(RefinementResult)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RefinementResult extends S.Class<RefinementResult>("RefinementResult")({
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
}) {
  /**
   * Whether refinement produced a conformant graph
   *
   * **Example** (Inspect refinement result.is conformant)
   *
   * ```ts
   * import { RefinementResult } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(RefinementResult)
   * ```
   *
   * @returns Result produced by this operation.
   */
  get isConformant(): boolean {
    return this.status === "conformant";
  }

  /**
   * Average violations fixed per iteration
   *
   * **Example** (Inspect refinement result.avg violations fixed)
   *
   * ```ts
   * import { RefinementResult } from "@effect-ontology/Service/Agent/types"
   *
   * console.log(RefinementResult)
   * ```
   *
   * @returns Result produced by this operation.
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
 * **Example** (Use the RegisteredAgent contract)
 *
 * ```ts
 * import type { RegisteredAgent } from "@effect-ontology/Service/Agent/types"
 *
 * const acceptsRegisteredAgent = (_value: RegisteredAgent<never, never, never, never>): void => undefined
 *
 * console.log(acceptsRegisteredAgent)
 * ```
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
 * **Example** (Use the AgentRegistry contract)
 *
 * ```ts
 * import type { AgentRegistry } from "@effect-ontology/Service/Agent/types"
 *
 * const acceptsAgentRegistry = (_value: AgentRegistry): void => undefined
 *
 * console.log(acceptsAgentRegistry)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AgentRegistry = HashMap.HashMap<AgentIdType, RegisteredAgent>;

// =============================================================================
// Execution Context
// =============================================================================

/**
 * ExecutionContext - Runtime context for agent execution
 *
 * **Details**
 *
 * Provides access to shared state and utilities during execution.
 *
 * **Example** (Inspect execution context)
 *
 * ```ts
 * import { ExecutionContext } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(ExecutionContext)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExecutionContext extends S.Class<ExecutionContext>("ExecutionContext")(
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
  $I.annote("AgentTask", {
    description: "Schema-backed unit of work routed through the agent pipeline.",
  })
) {}

// =============================================================================
// Error Types
// =============================================================================

/**
 * AgentExecutionError - Error during agent execution
 *
 * **Example** (Inspect agent execution error)
 *
 * ```ts
 * import { AgentExecutionError } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(AgentExecutionError)
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
 * PipelineExecutionError - Error during pipeline execution
 *
 * **Example** (Inspect pipeline execution error)
 *
 * ```ts
 * import { PipelineExecutionError } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(PipelineExecutionError)
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
 * AgentNotFoundError - Requested agent not registered
 *
 * **Example** (Inspect agent not found error)
 *
 * ```ts
 * import { AgentNotFoundError } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(AgentNotFoundError)
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
 * CheckpointTimeoutError - Human approval not received in time
 *
 * **Example** (Inspect checkpoint timeout error)
 *
 * ```ts
 * import { CheckpointTimeoutError } from "@effect-ontology/Service/Agent/types"
 *
 * console.log(CheckpointTimeoutError)
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
