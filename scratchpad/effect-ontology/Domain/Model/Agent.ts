/**
 * Agent contracts, pipeline state, configuration, and lifecycle events.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { Percentage } from "@beep/schema/Percentage";
import type { Duration, Effect } from "effect";
import { DateTime } from "effect";
import * as A from "effect/Array";
import type * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/Agent");

const agentIdPattern = /^[a-z][a-z0-9_-]*$/;

/**
 * Stable lowercase identifier for an agent implementation.
 *
 * **Example** (Use AgentId)
 * ```ts
 * import { AgentId } from "@effect-ontology/Model/Agent"
 *
 * const id = AgentId.make("corrector-v2")
 * console.log(AgentId.is(id)) // true
 * ```
 *
 * @invariant Starts with a lowercase letter and then contains only lowercase
 * letters, digits, dashes, or underscores.
 * @category identifiers
 * @since 0.0.0
 */
export const AgentId = S.String.check(
  S.isPattern(agentIdPattern, {
    identifier: $I`AgentIdPatternCheck`,
    title: "Agent Identifier",
    description: "A lowercase agent identifier with optional digits, dashes, and underscores.",
    message:
      "Agent identifier must start with a lowercase letter and contain only lowercase letters, digits, dashes, or underscores.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(agentIdPattern),
  })
  .pipe(
    S.brand("AgentId"),
    $I.annoteSchema("AgentId", {
      description: "Stable lowercase identifier assigned to an agent implementation.",
    }),
    SchemaUtils.withCodecStatics(["is"])
  );

/**
 * Runtime value decoded by {@link AgentId}.
 *
 * **Example** (Use AgentId)
 * ```ts
 * import { AgentId, type AgentId as AgentIdentifier } from "@effect-ontology/Model/Agent"
 *
 * const id: AgentIdentifier = AgentId.make("validator")
 * console.log(id) // "validator"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AgentId = typeof AgentId.Type;

/**
 * Functional role played by an agent in an ontology pipeline.
 *
 * **Example** (Use AgentType)
 * ```ts
 * import { AgentType } from "@effect-ontology/Model/Agent"
 *
 * console.log(AgentType.is.reasoner("reasoner")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentType = LiteralKit(["extractor", "validator", "resolver", "corrector", "reasoner", "ingestor"])
  .annotate({
    toArbitrary: () => (fc) =>
      fc.constantFrom("extractor", "validator", "resolver", "corrector", "reasoner", "ingestor"),
  })
  .annotate(
    $I.annote("AgentType", {
      description: "Closed set of functional roles supported by the ontology pipeline.",
    })
  );

/**
 * Runtime value accepted by {@link AgentType}.
 *
 * **Example** (Use AgentType)
 * ```ts
 * import type { AgentType } from "@effect-ontology/Model/Agent"
 *
 * const role: AgentType = "extractor"
 * console.log(role) // "extractor"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AgentType = typeof AgentType.Type;

/**
 * Descriptive identity for an executable agent.
 *
 * **Example** (Use AgentMetadata)
 * ```ts
 * import { AgentId, AgentMetadata } from "@effect-ontology/Model/Agent"
 *
 * const metadata = AgentMetadata.make({
 *   id: AgentId.make("extractor"),
 *   name: "Entity Extractor",
 *   description: "Extracts ontology-typed entities from text.",
 *   type: "extractor"
 * })
 * console.log(metadata.id) // "extractor"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentMetadata extends S.Class<AgentMetadata>($I`AgentMetadata`)(
  {
    id: AgentId.annotateKey({
      description: "Stable implementation identifier.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable display name.",
    }),
    description: S.NonEmptyString.annotateKey({
      description: "Concise explanation of the agent's responsibility.",
    }),
    type: AgentType.annotateKey({
      description: "Functional role played by the agent.",
    }),
    version: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Implementation version when independently versioned." })
    ),
  },
  $I.annote("AgentMetadata", {
    description: "Stable identity and human-readable metadata for an executable agent.",
  })
) {}

/**
 * Immutable diagnostics produced by agent input validation.
 *
 * **Details**
 *
 * * Validity is derived from the error collection, so an impossible
 * `valid: true` plus non-empty errors state cannot be constructed.
 *
 * **Example** (Use ValidationResult)
 * ```ts
 * import { ValidationResult } from "@effect-ontology/Model/Agent"
 *
 * const result = ValidationResult.fail(["Input text is empty."])
 * console.log(result.valid) // false
 * console.log(result.errorCount) // 1
 * ```
 *
 * @invariant `valid` is true exactly when `errors` is empty.
 * @category validation
 * @since 0.0.0
 */
export class ValidationResult extends S.Class<ValidationResult>($I`ValidationResult`)(
  {
    errors: S.Array(S.NonEmptyString).pipe(
      SchemaUtils.withEmptyArrayDefaults<string>(),
      S.annotateKey({ description: "Blocking validation diagnostics." })
    ),
    warnings: S.Array(S.NonEmptyString).pipe(
      SchemaUtils.withEmptyArrayDefaults<string>(),
      S.annotateKey({ description: "Non-blocking validation diagnostics." })
    ),
  },
  $I.annote("ValidationResult", {
    description: "Blocking errors and non-blocking warnings produced by input validation.",
  })
) {
  /**
   * Constructs a validation result without diagnostics.
   *
   * **Example** (Use pass)
   * ```ts
   * import { ValidationResult } from "@effect-ontology/Model/Agent"
   *
   * const result = ValidationResult.pass()
   * console.log(result.valid) // true
   * ```
   *
   * @returns A valid result with empty error and warning collections.
   */
  static pass(): ValidationResult {
    return ValidationResult.make({});
  }

  /**
   * Constructs a failing result from one or more blocking diagnostics.
   *
   * **Example** (Use fail)
   *
   * ```ts
   * import { ValidationResult } from "@effect-ontology/Model/Agent"
   *
   * const result = ValidationResult.fail(["Input text is empty."])
   * console.log(result.valid) // false
   * ```
   *
   * @param errors - Non-empty blocking diagnostic collection.
   * @returns An invalid result containing the supplied errors.
   */
  static fail(errors: A.NonEmptyReadonlyArray<string>): ValidationResult {
    return ValidationResult.make({ errors });
  }

  /**
   * Constructs a valid result carrying one or more warnings.
   *
   * **Example** (Use warn)
   *
   * ```ts
   * import { ValidationResult } from "@effect-ontology/Model/Agent"
   *
   * const result = ValidationResult.warn(["Language was inferred."])
   * console.log(result.warningCount) // 1
   * ```
   *
   * @param warnings - Non-empty non-blocking diagnostic collection.
   * @returns A valid result containing the supplied warnings.
   */
  static warn(warnings: A.NonEmptyReadonlyArray<string>): ValidationResult {
    return ValidationResult.make({ warnings });
  }

  /**
   * Whether no blocking diagnostics were produced.
   *
   * **Example** (Use Agent)
   * ```ts
   * import { ValidationResult } from "@effect-ontology/Model/Agent"
   *
   * console.log(ValidationResult.pass().valid) // true
   * ```
   *
   * @returns `true` exactly when the error collection is empty.
   */
  get valid(): boolean {
    return A.isReadonlyArrayEmpty(this.errors);
  }

  /**
   * Number of blocking diagnostics.
   *
   * **Example** (Use Agent)
   * ```ts
   * import { ValidationResult } from "@effect-ontology/Model/Agent"
   *
   * console.log(ValidationResult.fail(["Invalid input."]).errorCount) // 1
   * ```
   *
   * @returns The number of blocking errors.
   */
  get errorCount(): number {
    return A.length(this.errors);
  }

  /**
   * Number of non-blocking diagnostics.
   *
   * **Example** (Use Agent)
   * ```ts
   * import { ValidationResult } from "@effect-ontology/Model/Agent"
   *
   * console.log(ValidationResult.warn(["Inferred value."]).warningCount) // 1
   * ```
   *
   * @returns The number of non-blocking warnings.
   */
  get warningCount(): number {
    return A.length(this.warnings);
  }
}

/**
 * Stateless executable participant in an agent pipeline.
 *
 * **Details**
 *
 * * This is a service contract rather than a data model, so it intentionally
 * remains an interface. Optional validation is represented explicitly with
 * `Option`.
 *
 * **Example** (Use Agent)
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as Str from "effect/String"
 * import { AgentId, AgentMetadata } from "@effect-ontology/Model/Agent"
 * import type { Agent } from "@effect-ontology/Model/Agent"
 *
 * const agent: Agent<string, number, never> = {
 *   metadata: AgentMetadata.make({
 *     id: AgentId.make("counter"),
 *     name: "Character Counter",
 *     description: "Counts characters in text.",
 *     type: "extractor"
 *   }),
 *   execute: (input) => Effect.succeed(Str.length(input)),
 *   validate: O.none()
 * }
 * console.log(Effect.isEffect(agent.execute("abc"))) // true
 * ```
 *
 * @typeParam Input Value accepted by the agent.
 * @typeParam Output Value produced after successful execution.
 * @typeParam Error Typed failure emitted by execution.
 * @typeParam R Services required by execution and validation.
 * @category services
 * @since 0.0.0
 */
export interface Agent<Input, Output, Error, R = never> {
  /** Stable descriptive identity for the implementation. */
  readonly metadata: AgentMetadata;
  /** Executes the agent's core operation. */
  readonly execute: (input: Input) => Effect.Effect<Output, Error, R>;
  /** Optional pre-execution validation in the same service environment. */
  readonly validate: O.Option<(input: Input) => Effect.Effect<ValidationResult, never, R>>;
}

/**
 * Execution mode used by a multi-agent pipeline.
 *
 * **Example** (Use PipelineMode)
 * ```ts
 * import { PipelineMode } from "@effect-ontology/Model/Agent"
 *
 * console.log(PipelineMode.is.parallel("parallel")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PipelineMode = LiteralKit(["sequential", "loop", "parallel", "graph"]).pipe(
  $I.annoteSchema("PipelineMode", {
    description: "Closed set of orchestration strategies supported by an agent pipeline.",
    toArbitrary: () => (fc) => fc.constantFrom("sequential", "loop", "parallel", "graph"),
  })
);

/**
 * Runtime value accepted by {@link PipelineMode}.
 *
 * **Example** (Use PipelineMode)
 * ```ts
 * import type { PipelineMode } from "@effect-ontology/Model/Agent"
 *
 * const mode: PipelineMode = "graph"
 * console.log(mode) // "graph"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PipelineMode = typeof PipelineMode.Type;

/**
 * Discriminated execution state for an agent pipeline.
 *
 * **Details**
 *
 * * Completion and failure data live inside their respective variants. This
 * replaces the upstream optional-field bag and makes impossible combinations
 * such as a pending pipeline with a completion timestamp unrepresentable.
 *
 * **Example** (Use PipelineStatus)
 * ```ts
 * import { PipelineStatus } from "@effect-ontology/Model/Agent"
 *
 * const status = PipelineStatus.cases.Running.make({})
 * console.log(status._tag) // "Running"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PipelineStatus = S.TaggedUnion({
  Pending: {},
  Running: {},
  Paused: {},
  Completed: {
    completedAt: S.DateTimeUtcFromString,
  },
  Failed: {
    failedAt: S.DateTimeUtcFromString,
    error: S.NonEmptyString,
  },
}).pipe(
  $I.annoteSchema("PipelineStatus", {
    description: "Canonical discriminated lifecycle state for an agent pipeline.",
    toArbitrary: () => (fc) =>
      S.toArbitrary(
        S.TaggedUnion({
          Pending: {},
          Running: {},
          Paused: {},
          Completed: { completedAt: S.DateTimeUtcFromString },
          Failed: { failedAt: S.DateTimeUtcFromString, error: S.NonEmptyString },
        })
      )(fc),
  })
);

/**
 * Runtime value decoded by {@link PipelineStatus}.
 *
 * **Example** (Use PipelineStatus)
 * ```ts
 * import type { PipelineStatus } from "@effect-ontology/Model/Agent"
 *
 * const status: PipelineStatus = { _tag: "Pending" }
 * console.log(status._tag) // "Pending"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PipelineStatus = typeof PipelineStatus.Type;

/**
 * JSON-compatible output retained from a completed agent.
 *
 * **Example** (Use IntermediateResult)
 * ```ts
 * import { DateTime, Duration } from "effect"
 * import { AgentId, IntermediateResult } from "@effect-ontology/Model/Agent"
 *
 * const result = IntermediateResult.make({
 *   agentId: AgentId.make("extractor"),
 *   output: { entities: 3 },
 *   producedAt: DateTime.nowUnsafe(),
 *   duration: Duration.millis(12)
 * })
 * console.log(result.agentId) // "extractor"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntermediateResult extends S.Class<IntermediateResult>($I`IntermediateResult`)(
  {
    agentId: AgentId.annotateKey({
      description: "Agent that produced the result.",
    }),
    output: S.Json.annotateKey({
      description: "JSON-compatible output retained for checkpointing.",
    }),
    producedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant at which the result was produced.",
    }),
    duration: S.DurationFromMillis.annotateKey({
      description: "Non-negative execution duration encoded as milliseconds.",
    }),
  },
  $I.annote("IntermediateResult", {
    description: "Checkpoint-safe JSON output and timing from one completed agent.",
  })
) {}

/**
 * Immutable checkpoint snapshot of a multi-agent pipeline.
 *
 * **Example** (Use PipelineState)
 * ```ts
 * import { DateTime } from "effect"
 * import { PipelineState, PipelineStatus } from "@effect-ontology/Model/Agent"
 *
 * const state = PipelineState.make({
 *   pipelineId: "pipeline-123",
 *   startedAt: DateTime.nowUnsafe(),
 *   status: PipelineStatus.cases.Running.make({})
 * })
 * console.log(state.isTerminal) // false
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class PipelineState extends S.Class<PipelineState>($I`PipelineState`)(
  {
    pipelineId: S.NonEmptyString.annotateKey({
      description: "Unique identifier for this pipeline execution.",
    }),
    currentAgentId: S.OptionFromOptionalKey(AgentId).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Agent currently executing, when any." })
    ),
    completedAgents: S.Array(AgentId).pipe(
      SchemaUtils.withEmptyArrayDefaults<AgentId>(),
      S.annotateKey({ description: "Agents that completed successfully." })
    ),
    intermediateResults: S.Array(IntermediateResult).pipe(
      SchemaUtils.withEmptyArrayDefaults<IntermediateResult>(),
      S.annotateKey({ description: "Checkpoint-safe outputs from completed agents." })
    ),
    startedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant at which execution began.",
    }),
    status: PipelineStatus.annotateKey({
      description: "Canonical discriminated pipeline status.",
    }),
    iterationCount: NonNegativeInt.pipe(
      SchemaUtils.withKeyDefaults(NonNegativeInt.make(0)),
      S.annotateKey({ description: "Completed loop iterations." })
    ),
  },
  $I.annote("PipelineState", {
    description: "Immutable checkpoint snapshot for multi-agent pipeline execution.",
  })
) {
  /**
   * Finds the retained result produced by an agent.
   *
   * **Example** (Use getResult)
   *
   * ```ts
   * import { DateTime } from "effect"
   * import * as O from "effect/Option"
   * import { AgentId, PipelineState, PipelineStatus } from "@effect-ontology/Model/Agent"
   *
   * const state = PipelineState.make({
   *   pipelineId: "pipeline-123",
   *   startedAt: DateTime.nowUnsafe(),
   *   status: PipelineStatus.cases.Running.make({})
   * })
   * console.log(O.isNone(state.getResult(AgentId.make("validator")))) // true
   * ```
   *
   * @param agentId - Stable identifier of the producing agent.
   * @returns The retained intermediate result, or `Option.none()` when absent.
   */
  getResult(agentId: AgentId): O.Option<IntermediateResult> {
    return A.findFirst(this.intermediateResults, (result) => AgentId.is(agentId) && result.agentId === agentId);
  }

  /**
   * Whether the named agent appears in the completed-agent set.
   *
   * **Example** (Use hasCompleted)
   *
   * ```ts
   * import { DateTime } from "effect"
   * import { AgentId, PipelineState, PipelineStatus } from "@effect-ontology/Model/Agent"
   *
   * const state = PipelineState.make({
   *   pipelineId: "pipeline-123",
   *   startedAt: DateTime.nowUnsafe(),
   *   status: PipelineStatus.cases.Running.make({})
   * })
   * console.log(state.hasCompleted(AgentId.make("validator"))) // false
   * ```
   *
   * @param agentId - Stable identifier of the agent to inspect.
   * @returns `true` when the agent has completed in this snapshot.
   */
  hasCompleted(agentId: AgentId): boolean {
    return A.contains(this.completedAgents, agentId);
  }

  /**
   * Elapsed execution duration at the supplied clock instant.
   *
   * **Example** (Use getElapsed)
   *
   * ```ts
   * import { DateTime, Duration } from "effect"
   * import { PipelineState, PipelineStatus } from "@effect-ontology/Model/Agent"
   *
   * const now = DateTime.nowUnsafe()
   * const state = PipelineState.make({
   *   pipelineId: "pipeline-123",
   *   startedAt: now,
   *   status: PipelineStatus.cases.Running.make({})
   * })
   * console.log(Duration.toMillis(state.getElapsed(now))) // 0
   * ```
   *
   * @param now - Current UTC instant used for active or paused pipelines.
   * @returns Duration from pipeline start to the terminal or supplied instant.
   */
  getElapsed(now: DateTime.Utc): Duration.Duration {
    const end = PipelineStatus.match(this.status, {
      Pending: () => now,
      Running: () => now,
      Paused: () => now,
      Completed: ({ completedAt }) => completedAt,
      Failed: ({ failedAt }) => failedAt,
    });
    return DateTime.distance(this.startedAt, end);
  }

  /**
   * Whether the pipeline has completed or failed.
   *
   * **Example** (Inspect a running pipeline)
   * ```ts
   * import { DateTime } from "effect"
   * import { PipelineState, PipelineStatus } from "@effect-ontology/Model/Agent"
   *
   * const state = PipelineState.make({
   *   pipelineId: "pipeline-123",
   *   startedAt: DateTime.nowUnsafe(),
   *   status: PipelineStatus.cases.Running.make({})
   * })
   * console.log(state.isTerminal) // false
   * ```
   *
   * @returns `true` for completed or failed status variants.
   */
  get isTerminal(): boolean {
    return PipelineStatus.isAnyOf(["Completed", "Failed"])(this.status);
  }
}

/**
 * Stop conditions for a looping agent pipeline.
 *
 * **Example** (Use TerminationCondition)
 * ```ts
 * import { TerminationCondition } from "@effect-ontology/Model/Agent"
 *
 * const condition = TerminationCondition.default()
 * console.log(condition.maxIterations) // 5
 * console.log(condition.stopOnConformance) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class TerminationCondition extends S.Class<TerminationCondition>($I`TerminationCondition`)(
  {
    maxIterations: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(5)),
      S.annotateKey({ description: "Maximum completed iterations before forced termination." })
    ),
    stopOnConformance: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(true),
      S.annotateKey({ description: "Whether validation conformance terminates the loop." })
    ),
    minConfidence: S.OptionFromOptionalKey(Confidence).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional confidence floor for continued execution." })
    ),
    timeout: S.OptionFromOptionalKey(S.DurationFromMillis).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional execution timeout encoded as milliseconds." })
    ),
  },
  $I.annote("TerminationCondition", {
    description: "Schema-defaulted stop policy for iterative agent pipelines.",
  })
) {
  /**
   * Constructs the canonical default loop-termination policy.
   *
   * **Example** (Inspect default termination)
   * ```ts
   * import { TerminationCondition } from "@effect-ontology/Model/Agent"
   *
   * const condition = TerminationCondition.default()
   * console.log(condition.maxIterations) // 5
   * ```
   *
   * @returns A complete immutable policy populated by schema defaults.
   */
  static default(): TerminationCondition {
    return TerminationCondition.make({});
  }
}

/**
 * Policy controlling pipeline checkpoint creation and approval.
 *
 * **Example** (Use CheckpointConfig)
 * ```ts
 * import { CheckpointConfig } from "@effect-ontology/Model/Agent"
 *
 * const config = CheckpointConfig.default()
 * console.log(config.requireApproval) // false
 * console.log(config.afterAgents.length) // 0
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class CheckpointConfig extends S.Class<CheckpointConfig>($I`CheckpointConfig`)(
  {
    afterAgents: S.Array(AgentId).pipe(
      SchemaUtils.withEmptyArrayDefaults<AgentId>(),
      S.annotateKey({ description: "Agents whose completion triggers a checkpoint." })
    ),
    everyNIterations: S.OptionFromOptionalKey(PosInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional periodic checkpoint interval for loop mode." })
    ),
    requireApproval: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      S.annotateKey({ description: "Whether a human must approve checkpoint continuation." })
    ),
    approvalTimeout: S.OptionFromOptionalKey(S.DurationFromMillis).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional approval timeout encoded as milliseconds." })
    ),
  },
  $I.annote("CheckpointConfig", {
    description: "Schema-defaulted policy for pipeline checkpoint timing and approval.",
  })
) {
  /**
   * Constructs the canonical default checkpoint policy.
   *
   * **Example** (Inspect default checkpoint approval)
   * ```ts
   * import { CheckpointConfig } from "@effect-ontology/Model/Agent"
   *
   * const config = CheckpointConfig.default()
   * console.log(config.requireApproval) // false
   * ```
   *
   * @returns A complete immutable checkpoint policy populated by schema defaults.
   */
  static default(): CheckpointConfig {
    return CheckpointConfig.make({});
  }
}

/**
 * Event emitted when an agent begins execution.
 *
 * **Example** (Use AgentStarted)
 * ```ts
 * import { DateTime } from "effect"
 * import { AgentId, AgentStarted } from "@effect-ontology/Model/Agent"
 *
 * const event = AgentStarted.make({
 *   agentId: AgentId.make("extractor"),
 *   startedAt: DateTime.nowUnsafe()
 * })
 * console.log(event._tag) // "AgentStarted"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AgentStarted extends S.TaggedClass<AgentStarted>($I`AgentStarted`)(
  "AgentStarted",
  {
    agentId: AgentId,
    startedAt: S.DateTimeUtcFromString,
    inputSummary: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentStarted", {
    description: "Lifecycle event recording the start of one agent execution.",
  })
) {}

/**
 * Progress update emitted during agent execution.
 *
 * **Example** (Use AgentProgress)
 * ```ts
 * import { Percentage } from "@beep/schema/Percentage"
 * import { DateTime } from "effect"
 * import { AgentId, AgentProgress } from "@effect-ontology/Model/Agent"
 *
 * const event = AgentProgress.make({
 *   agentId: AgentId.make("extractor"),
 *   progress: Percentage.make(50),
 *   timestamp: DateTime.nowUnsafe()
 * })
 * console.log(event.progress) // 50
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AgentProgress extends S.TaggedClass<AgentProgress>($I`AgentProgress`)(
  "AgentProgress",
  {
    agentId: AgentId,
    progress: Percentage,
    message: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    timestamp: S.DateTimeUtcFromString,
  },
  $I.annote("AgentProgress", {
    description: "Bounded percentage progress reported by an executing agent.",
  })
) {}

/**
 * Event emitted after successful agent execution.
 *
 * **Example** (Use AgentCompleted)
 * ```ts
 * import { DateTime, Duration } from "effect"
 * import { AgentCompleted, AgentId } from "@effect-ontology/Model/Agent"
 *
 * const event = AgentCompleted.make({
 *   agentId: AgentId.make("extractor"),
 *   completedAt: DateTime.nowUnsafe(),
 *   duration: Duration.millis(10)
 * })
 * console.log(event._tag) // "AgentCompleted"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AgentCompleted extends S.TaggedClass<AgentCompleted>($I`AgentCompleted`)(
  "AgentCompleted",
  {
    agentId: AgentId,
    completedAt: S.DateTimeUtcFromString,
    duration: S.DurationFromMillis,
    outputSummary: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentCompleted", {
    description: "Lifecycle event recording successful agent completion and duration.",
  })
) {}

/**
 * Event emitted after failed agent execution.
 *
 * **Example** (Use AgentFailed)
 * ```ts
 * import { DateTime, Duration } from "effect"
 * import { AgentFailed, AgentId } from "@effect-ontology/Model/Agent"
 *
 * const event = AgentFailed.make({
 *   agentId: AgentId.make("extractor"),
 *   failedAt: DateTime.nowUnsafe(),
 *   duration: Duration.millis(10),
 *   error: "Model request timed out."
 * })
 * console.log(event.retryable) // false
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AgentFailed extends S.TaggedClass<AgentFailed>($I`AgentFailed`)(
  "AgentFailed",
  {
    agentId: AgentId,
    failedAt: S.DateTimeUtcFromString,
    duration: S.DurationFromMillis,
    error: S.NonEmptyString,
    retryable: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("AgentFailed", {
    description: "Lifecycle event recording typed failure information for one agent execution.",
  })
) {}

/**
 * Reason a pipeline checkpoint was written.
 *
 * **Example** (Use CheckpointReason)
 * ```ts
 * import { CheckpointReason } from "@effect-ontology/Model/Agent"
 *
 * console.log(CheckpointReason.is.manual("manual")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CheckpointReason = LiteralKit(["scheduled", "agent-completed", "manual", "error-recovery"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("scheduled", "agent-completed", "manual", "error-recovery"),
  })
  .annotate(
    $I.annote("CheckpointReason", {
      description: "Closed set of reasons for persisting pipeline state.",
    })
  );

/**
 * Runtime value accepted by {@link CheckpointReason}.
 *
 * **Example** (Use CheckpointReason)
 * ```ts
 * import type { CheckpointReason } from "@effect-ontology/Model/Agent"
 *
 * const reason: CheckpointReason = "scheduled"
 * console.log(reason) // "scheduled"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CheckpointReason = typeof CheckpointReason.Type;

/**
 * Event carrying an immutable pipeline checkpoint.
 *
 * **Example** (Use PipelineCheckpoint)
 * ```ts
 * import { DateTime } from "effect"
 * import { PipelineCheckpoint, PipelineState, PipelineStatus } from "@effect-ontology/Model/Agent"
 *
 * const state = PipelineState.make({
 *   pipelineId: "pipeline-1",
 *   startedAt: DateTime.nowUnsafe(),
 *   status: PipelineStatus.cases.Running.make({})
 * })
 * const event = PipelineCheckpoint.make({
 *   state,
 *   reason: "manual",
 *   timestamp: DateTime.nowUnsafe()
 * })
 * console.log(event.reason) // "manual"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class PipelineCheckpoint extends S.TaggedClass<PipelineCheckpoint>($I`PipelineCheckpoint`)(
  "PipelineCheckpoint",
  {
    state: PipelineState,
    reason: CheckpointReason,
    timestamp: S.DateTimeUtcFromString,
  },
  $I.annote("PipelineCheckpoint", {
    description: "Lifecycle event carrying an immutable pipeline-state checkpoint.",
  })
) {}

const AgentEventDefinition = S.Union([
  AgentStarted,
  AgentProgress,
  AgentCompleted,
  AgentFailed,
  PipelineCheckpoint,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustively discriminated union of agent and pipeline lifecycle events.
 *
 * **Example** (Use AgentEvent)
 * ```ts
 * import { DateTime } from "effect"
 * import { AgentEvent, AgentId } from "@effect-ontology/Model/Agent"
 *
 * const event = AgentEvent.cases.AgentStarted.make({
 *   agentId: AgentId.make("extractor"),
 *   startedAt: DateTime.nowUnsafe()
 * })
 * const label = AgentEvent.match(event, {
 *   AgentStarted: () => "started",
 *   AgentProgress: () => "progress",
 *   AgentCompleted: () => "completed",
 *   AgentFailed: () => "failed",
 *   PipelineCheckpoint: () => "checkpoint"
 * })
 * console.log(label) // "started"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export const AgentEvent = AgentEventDefinition.pipe(
  $I.annoteSchema("AgentEvent", {
    description: "Agent-execution and pipeline-checkpoint lifecycle event union.",
    toArbitrary: () => S.toArbitrary(AgentEventDefinition),
  })
);

/**
 * Runtime value decoded by {@link AgentEvent}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AgentEvent = typeof AgentEvent.Type;
