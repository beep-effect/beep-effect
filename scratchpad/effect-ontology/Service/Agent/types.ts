/**
 * Service Layer Types: Agent Orchestration
 *
 * Service-level type definitions for multi-agent orchestration.
 * Extends the domain model with service-specific concerns like
 * task definitions, execution contexts, and feedback handling.
 *
 * @since 2.0.0
 * @module Service/Agent/types
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { NonNegNum } from "@beep/schema/Number";
import { Data, Duration, Schema } from "effect";
import * as A from "effect/Array";
import type * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import type { Agent, AgentId as AgentIdType, AgentType } from "../../Domain/Model/Agent.ts";
import { CheckpointConfig, PipelineState, TerminationCondition } from "../../Domain/Model/Agent.ts";
import { KnowledgeGraph } from "../../Domain/Model/Entity.ts";
import { OntologyContext, OntologyRef } from "../../Domain/Model/Ontology.ts";
import { OntologyAgentConfig, ViolationExplanation } from "../../Domain/Model/OntologyAgent.ts";
import { ShaclValidationReport } from "../Shacl.ts";

// =============================================================================
// Agent Task Definition
// =============================================================================

/**
 * AgentTask - A unit of work to be processed by the pipeline
 *
 * Wraps raw input with metadata for tracking and routing.
 *
 * @since 2.0.0
 * @category Domain
 */
export class AgentTask extends Schema.Class<AgentTask>("AgentTask")({
  /**
   * Unique task identifier
   */
  taskId: Schema.String.annotate({
    title: "Task ID",
    description: "Unique identifier for this task",
  }),

  /**
   * Ontology ID for scoping (e.g., "seattle")
   */
  ontologyId: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Source text to process (for extraction tasks)
   */
  text: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Source URL to ingest (for ingestion tasks)
   */
  sourceUrl: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Optional ontology agent config override (for extraction tasks)
   */
  agentConfig: OntologyAgentConfig.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Ingestion options (implementation-specific)
   */
  ingestionOptions: Schema.Unknown.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Ingestion result metadata (implementation-specific)
   */
  ingestionResult: Schema.Unknown.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Input knowledge graph (legacy; prefer knowledgeGraph/rdfStore/turtle)
   */
  graph: Schema.Unknown.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault), // KnowledgeGraph or RdfStore

  /**
   * Extracted knowledge graph
   */
  knowledgeGraph: KnowledgeGraph.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * RDF store for validation/correction
   */
  rdfStore: Schema.Unknown.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Serialized RDF graph (Turtle)
   */
  turtle: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Ontology context used for extraction/correction
   */
  ontologyContext: OntologyContext.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Ontology reference used for extraction
   */
  ontologyRef: OntologyRef.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Validation report (for correction tasks)
   */
  validationReport: ShaclValidationReport.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Human-readable validation explanations
   */
  validationExplanations: Schema.Array(ViolationExplanation).pipe(
    Schema.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault
  ),

  /**
   * Correction result metadata (implementation-specific)
   */
  correctionResult: Schema.Unknown.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Source document ID for provenance
   */
  documentId: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Additional context for agents
   */
  context: Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Priority (lower = higher priority)
   */
  priority: NonNegativeInt.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}) {
  /**
   * Create a text extraction task
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
   */
  static forValidation(taskId: string, graph: unknown): AgentTask {
    return AgentTask.make({ taskId, graph: O.some(graph), priority: O.some(NonNegativeInt.make(2)) });
  }

  /**
   * Create an ingestion task
   */
  static forIngestion(taskId: string, sourceUrl: string, ingestionOptions?: unknown): AgentTask {
    return AgentTask.make({
      taskId,
      sourceUrl: O.some(sourceUrl),
      ingestionOptions: O.some(ingestionOptions),
      priority: O.some(NonNegativeInt.make(0)),
    });
  }

  /**
   * Create a correction task
   */
  static forCorrection(taskId: string, graph: unknown, validationReport: ShaclValidationReport): AgentTask {
    return AgentTask.make({
      taskId,
      graph: O.some(graph),
      validationReport: O.some(validationReport),
      priority: O.some(NonNegativeInt.make(3)),
    });
  }
}

// =============================================================================
// Pipeline Configuration
// =============================================================================

/**
 * PipelineConfig - Configuration for a multi-agent pipeline
 *
 * @since 2.0.0
 * @category Domain
 */
export class PipelineConfig extends Schema.Class<PipelineConfig>("PipelineConfig")({
  /**
   * Unique pipeline identifier
   */
  pipelineId: Schema.String,

  /**
   * Execution mode (sequential, loop, parallel, graph)
   */
  mode: Schema.Literals(["sequential", "loop", "parallel", "graph"]),

  /**
   * Ordered list of agents to execute (for sequential/loop modes)
   */
  agentSequence: Schema.Array(Schema.String).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Termination condition (for loop mode)
   */
  termination: TerminationCondition.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Checkpoint configuration
   */
  checkpoint: CheckpointConfig.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Maximum concurrency (for parallel mode)
   */
  concurrency: PosInt.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Enable detailed tracing
   */
  tracing: Schema.Boolean.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}) {
  /**
   * Create a simple sequential pipeline
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
   */
  static refinementLoop(pipelineId: string, maxIterations: number = 5): PipelineConfig {
    return PipelineConfig.make({
      pipelineId,
      mode: "loop",
      agentSequence: O.some(["extractor", "validator", "corrector"]),
      termination: O.some(
        TerminationCondition.make({
          maxIterations,
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
 * HumanFeedback - Feedback from human review at checkpoints
 *
 * @since 2.0.0
 * @category Events
 */
export type HumanFeedback = HumanApprove | HumanReject | HumanModify | HumanSkip;

/**
 * HumanApprove - Human approves the current state
 *
 * @since 2.0.0
 * @category Events
 */
export class HumanApprove extends Data.TaggedClass("HumanApprove")<{
  readonly reviewerId?: string;
  readonly comment?: string;
}> {}

/**
 * HumanReject - Human rejects the current state
 *
 * @since 2.0.0
 * @category Events
 */
export class HumanReject extends Data.TaggedClass("HumanReject")<{
  readonly reason: string;
  readonly reviewerId?: string;
}> {}

/**
 * HumanModify - Human provides modifications to the state
 *
 * @since 2.0.0
 * @category Events
 */
export class HumanModify extends Data.TaggedClass("HumanModify")<{
  /**
   * Changes to apply (agent-specific)
   */
  readonly changes: unknown;
  readonly reviewerId?: string;
  readonly comment?: string;
}> {}

/**
 * HumanSkip - Human skips a specific agent
 *
 * @since 2.0.0
 * @category Events
 */
export class HumanSkip extends Data.TaggedClass("HumanSkip")<{
  readonly agentId: AgentIdType;
  readonly reason?: string;
  readonly reviewerId?: string;
}> {}

// =============================================================================
// Refinement Configuration
// =============================================================================

/**
 * RefinementConfig - Configuration for the validation-correction loop
 *
 * Controls how the refinement loop executes and when it terminates.
 *
 * @since 2.0.0
 * @category Domain
 */
export class RefinementConfig extends Schema.Class<RefinementConfig>("RefinementConfig")({
  /**
   * Maximum number of correction iterations
   */
  maxIterations: PosInt.annotate({
    default: PosInt.make(5),
  }),

  /**
   * Stop when validation report conforms
   */
  stopOnConformance: Schema.Boolean.annotate({
    default: true,
  }),

  /**
   * Minimum confidence threshold - stop if correction confidence drops below this
   */
  minConfidence: Confidence.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Emit checkpoint every N iterations
   */
  checkpointInterval: PosInt.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Timeout for the entire refinement loop in milliseconds
   */
  timeoutMs: Schema.Finite.check(Schema.isGreaterThan(0)).pipe(
    Schema.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault
  ),

  /**
   * Whether to save intermediate states for resume
   */
  enableResume: Schema.Boolean.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Agent ID for the validator
   */
  validatorId: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Agent ID for the corrector
   */
  correctorId: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}) {
  /**
   * Create a default refinement config
   */
  static default(maxIterations: number = 5): RefinementConfig {
    return RefinementConfig.make({
      maxIterations: PosInt.make(maxIterations),
      stopOnConformance: true,
    });
  }

  /**
   * Create a strict refinement config with low confidence threshold
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
 * @since 2.0.0
 * @category Types
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
 * @since 2.0.0
 * @category Domain
 */
export class RefinementResult extends Schema.Class<RefinementResult>("RefinementResult")({
  /**
   * Final knowledge graph
   */
  graph: Schema.Unknown, // KnowledgeGraph

  /**
   * Number of refinement iterations
   */
  iterations: NonNegativeInt,

  /**
   * How the loop terminated
   */
  status: Schema.Literals([
    "conformant",
    "max-iterations",
    "timeout",
    "confidence-threshold",
    "human-rejected",
    "error",
  ]),

  /**
   * Final validation report
   */
  validationReport: Schema.Unknown.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault), // ShaclValidationReport

  /**
   * Total duration in milliseconds
   */
  durationMs: NonNegNum,

  /**
   * Error message if status is "error"
   */
  error: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Violations fixed per iteration
   */
  violationsFixed: Schema.Array(Schema.Finite).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}) {
  /**
   * Whether refinement produced a conformant graph
   */
  get isConformant(): boolean {
    return this.status === "conformant";
  }

  /**
   * Average violations fixed per iteration
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
 * Wraps the Agent interface with registration metadata.
 *
 * @since 2.0.0
 * @category Domain
 */
export interface RegisteredAgent<I = unknown, O = unknown, E = unknown, R = never> {
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
 * @since 2.0.0
 * @category Types
 */
export type AgentRegistry = HashMap.HashMap<AgentIdType, RegisteredAgent>;

// =============================================================================
// Execution Context
// =============================================================================

/**
 * ExecutionContext - Runtime context for agent execution
 *
 * Provides access to shared state and utilities during execution.
 *
 * @since 2.0.0
 * @category Domain
 */
export class ExecutionContext extends Schema.Class<ExecutionContext>("ExecutionContext")({
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
  tracingEnabled: Schema.Boolean,

  /**
   * Parent span ID for distributed tracing
   */
  parentSpanId: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Correlation ID for request tracking
   */
  correlationId: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}) {}

// =============================================================================
// Error Types
// =============================================================================

/**
 * AgentExecutionError - Error during agent execution
 *
 * @since 2.0.0
 * @category Errors
 */
export class AgentExecutionError extends Data.TaggedError("AgentExecutionError")<{
  readonly agentId: AgentIdType;
  readonly message: string;
  readonly cause?: unknown;
  readonly retryable: boolean;
}> {}

/**
 * PipelineExecutionError - Error during pipeline execution
 *
 * @since 2.0.0
 * @category Errors
 */
export class PipelineExecutionError extends Data.TaggedError("PipelineExecutionError")<{
  readonly pipelineId: string;
  readonly message: string;
  readonly failedAgentId?: AgentIdType;
  readonly state: PipelineState;
  readonly cause?: unknown;
}> {}

/**
 * AgentNotFoundError - Requested agent not registered
 *
 * @since 2.0.0
 * @category Errors
 */
export class AgentNotFoundError extends Data.TaggedError("AgentNotFoundError")<{
  readonly agentId: AgentIdType;
  readonly registeredAgents: ReadonlyArray<AgentIdType>;
}> {}

/**
 * CheckpointTimeoutError - Human approval not received in time
 *
 * @since 2.0.0
 * @category Errors
 */
export class CheckpointTimeoutError extends Data.TaggedError("CheckpointTimeoutError")<{
  readonly pipelineId: string;
  readonly checkpointId: string;
  readonly timeoutMs: number;
}> {}
