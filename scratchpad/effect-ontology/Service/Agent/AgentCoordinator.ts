/**
 * Service: AgentCoordinator
 *
 * **Details**
 *
 * Orchestrates multiple agents in configurable pipeline patterns.
 * Supports sequential, loop, and parallel execution modes with
 * event streaming for real-time monitoring.
 *
 * ## Pipeline Modes
 * 1. **Sequential**: Agent1 → Agent2 → Agent3
 * 2. **Loop**: Extract → Validate → Correct → Validate (until conformant)
 * 3. **Parallel**: Run independent agents concurrently
 *
 * ## Event Streaming
 * All pipeline executions emit `AgentEvent` streams for:
 * - Progress monitoring
 * - SSE streaming to frontends
 * - Checkpoint/resume support
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
import { Percentage } from "@beep/schema/Percentage";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { thunk0 } from "@beep/utils/thunk";
import type { Config } from "effect";
import { Clock, Context, DateTime, Duration, Effect, HashMap, Inspectable, Layer, Match, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Agent, AgentId as AgentIdType, AgentType } from "../../Domain/Model/Agent.ts";
import {
  AgentCompleted,
  AgentEvent,
  AgentFailed,
  AgentId,
  AgentMetadata,
  AgentProgress,
  AgentStarted,
  IntermediateResult,
  PipelineCheckpoint,
  PipelineState,
  PipelineStatus,
  TerminationCondition,
} from "../../Domain/Model/Agent.ts";
import type { KnowledgeGraph } from "../../Domain/Model/Entity.ts";
import { ConfigService, ConfigServiceDefault } from "../Config.ts";
import type { RdfStore } from "../Rdf.ts";
import type { ShaclValidationReport } from "../Shacl.ts";
import { BatchCorrectionResult } from "./CorrectorAgent.ts";
import type { PipelineConfig, RefinementConfig, RefinementStatus, RegisteredAgent } from "./types.ts";
import {
  AgentExecutionError,
  AgentNotFoundError,
  AgentTask,
  PipelineExecutionError,
  RefinementResult,
} from "./types.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Agent/AgentCoordinator");

// =============================================================================
// Coordinator Types
// =============================================================================

/**
 * Schema-backed policy controlling agent execution.
 *
 * **Example** (Use fail-fast defaults)
 *
 * ```ts
 * import { ExecutionPolicy } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * const policy = ExecutionPolicy.make({})
 * console.log(policy.continueOnError) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExecutionPolicy extends S.Class<ExecutionPolicy>($I`ExecutionPolicy`)(
  {
    agentTimeout: S.Duration.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
      description: "Maximum duration allowed for one agent execution.",
    }),
    continueOnError: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)).annotateKey({
      description: "Whether the pipeline should continue after an agent fails.",
    }),
  },
  $I.annote("ExecutionPolicy", {
    description: "Timeout and failure-continuation policy shared by agent pipeline execution modes.",
  })
) {}

/**
 * Constructor input accepted by {@link ExecutionPolicy}.
 *
 * **Example** (Enable failure continuation)
 *
 * ```ts
 * import type { ExecutionPolicyInput } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * const policy: ExecutionPolicyInput = { continueOnError: true }
 * console.log(policy)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionPolicyInput = Exclude<(typeof ExecutionPolicy)["~type.make.in"], void>;

/**
 * Behavioral hooks invoked while a pipeline executes.
 *
 * **Example** (Observe pipeline events)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { ExecutionHooks } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * const hooks: ExecutionHooks = { onEvent: () => Effect.void }
 * console.log(hooks)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ExecutionHooks {
  /**
   * Callback for checkpoint events
   */
  readonly onCheckpoint?: (state: PipelineState) => Effect.Effect<void>;

  /**
   * Callback for agent events
   */
  readonly onEvent?: (event: AgentEvent) => Effect.Effect<void>;
}

/**
 * Policy input and behavioral hooks accepted by pipeline operations.
 *
 * **Example** (Configure execution)
 *
 * ```ts
 * import type { ExecutionOptions } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * const options: ExecutionOptions = { continueOnError: false }
 * console.log(options)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionOptions = ExecutionPolicyInput & ExecutionHooks;

interface ResolvedExecutionOptions {
  readonly policy: ExecutionPolicy;
  readonly onCheckpoint: O.Option<(state: PipelineState) => Effect.Effect<void>>;
  readonly onEvent: O.Option<(event: AgentEvent) => Effect.Effect<void>>;
}

const resolveExecutionOptions = (options?: ExecutionOptions): ResolvedExecutionOptions => {
  const option = O.fromUndefinedOr(options);
  return {
    policy: ExecutionPolicy.make(O.getOrElse(option, () => ({}))),
    onCheckpoint: O.flatMap(option, ({ onCheckpoint }) => O.fromUndefinedOr(onCheckpoint)),
    onEvent: O.flatMap(option, ({ onEvent }) => O.fromUndefinedOr(onEvent)),
  };
};

/**
 * Result of pipeline execution
 *
 * **Example** (Capture a pending pipeline result)
 *
 * ```ts
 * import { DateTime, HashMap } from "effect"
 * import { AgentId, PipelineState, PipelineStatus } from "@effect-ontology/Model/Agent"
 * import { ExecutionResult } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * const result = ExecutionResult.make({
 *   state: PipelineState.make({
 *     pipelineId: "pipeline-ada",
 *     startedAt: DateTime.nowUnsafe(),
 *     status: PipelineStatus.cases.Pending.make({})
 *   }),
 *   events: [],
 *   outputs: HashMap.empty<typeof AgentId.Type, unknown>()
 * })
 * console.log(result.state.status._tag) // "Pending"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionResult extends S.Class<ExecutionResult>($I`ExecutionResult`)(
  {
    state: PipelineState,
    events: S.Array(AgentEvent),
    outputs: S.HashMap(AgentId, S.Unknown),
  },
  $I.annote("ExecutionResult", { description: "Validated state, events, and outputs from one pipeline execution." })
) {}

interface AgentCoordinatorShape {
  readonly register: <E>(agent: Agent<AgentTask, AgentTask, E>, agentType?: AgentType) => Effect.Effect<void>;
  readonly unregister: (agentId: AgentIdType) => Effect.Effect<void>;
  readonly getAgent: (
    agentId: AgentIdType
  ) => Effect.Effect<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError>, AgentNotFoundError>;
  readonly listAgents: Effect.Effect<ReadonlyArray<AgentMetadata>>;
  readonly executeSequential: (
    task: AgentTask,
    agentIds: ReadonlyArray<AgentIdType>,
    options?: ExecutionOptions
  ) => Effect.Effect<ExecutionResult, PipelineExecutionError>;
  readonly executeLoop: (
    task: AgentTask,
    agentIds: ReadonlyArray<AgentIdType>,
    termination: TerminationCondition,
    options?: ExecutionOptions
  ) => Effect.Effect<ExecutionResult, PipelineExecutionError>;
  readonly executeParallel: (
    task: AgentTask,
    agentIds: ReadonlyArray<AgentIdType>,
    options?: ExecutionOptions & { readonly concurrency?: number }
  ) => Effect.Effect<ExecutionResult, PipelineExecutionError>;
  readonly execute: (
    task: AgentTask,
    pipelineConfig: PipelineConfig,
    options?: ExecutionOptions
  ) => Effect.Effect<ExecutionResult, PipelineExecutionError>;
  readonly runUntil: (
    task: AgentTask,
    agentIds: ReadonlyArray<AgentIdType>,
    condition: (state: PipelineState) => boolean,
    maxIterations: number,
    options?: ExecutionOptions
  ) => Effect.Effect<ExecutionResult, PipelineExecutionError>;
  readonly refineUntilConformant: (
    graph: KnowledgeGraph | RdfStore,
    refinementConfig: RefinementConfig,
    options?: ExecutionOptions
  ) => Effect.Effect<RefinementResult, PipelineExecutionError>;
  readonly metadata: AgentMetadata;
}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * AgentCoordinator - Multi-agent pipeline orchestrator
 *
 * **Details**
 *
 * Coordinates the execution of multiple agents in configurable patterns.
 * Manages agent registration, pipeline execution, and event collection.
 *
 * **Example** (List registered agents)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { AgentCoordinator } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * const program = Effect.gen(function* () {
 *   const coordinator = yield* AgentCoordinator
 *   return yield* coordinator.listAgents
 * }).pipe(Effect.provide(AgentCoordinator.Default))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class AgentCoordinator extends Context.Service<AgentCoordinator, AgentCoordinatorShape>()($I`AgentCoordinator`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;

    // Agent registry (mutable ref)
    const registryRef = yield* Ref.make<
      HashMap.HashMap<AgentIdType, RegisteredAgent<AgentTask, AgentTask, AgentExecutionError>>
    >(HashMap.empty());

    /**
     * Register an agent with the coordinator
     */
    const register = Effect.fn("AgentCoordinator.register")(function* <E>(
      agent: Agent<AgentTask, AgentTask, E>,
      agentType: AgentType = agent.metadata.type
    ) {
      const normalizedAgent: Agent<AgentTask, AgentTask, AgentExecutionError> = {
        metadata: agent.metadata,
        validate: agent.validate,
        execute: (input) =>
          agent.execute(input).pipe(
            Effect.mapError((error) =>
              AgentExecutionError.is(error)
                ? error
                : AgentExecutionError.make({
                    agentId: agent.metadata.id,
                    message: Inspectable.toStringUnknown(error),
                    cause: O.some(error),
                    retryable: false,
                  })
            )
          ),
      };
      const registered: RegisteredAgent<AgentTask, AgentTask, AgentExecutionError> = {
        agent: normalizedAgent,
        registeredAt: DateTime.toEpochMillis(yield* DateTime.now),
        agentType,
        enabled: true,
      };

      yield* Ref.update(registryRef, (registry) => HashMap.set(registry, agent.metadata.id, registered));

      yield* Effect.logInfo("AgentCoordinator: Registered agent", {
        agentId: agent.metadata.id,
        type: agentType,
      });
    });

    /**
     * Unregister an agent
     */
    const unregister = Effect.fn("AgentCoordinator.unregister")(function* (agentId: AgentIdType) {
      yield* Ref.update(registryRef, (registry) => HashMap.remove(registry, agentId));

      yield* Effect.logInfo("AgentCoordinator: Unregistered agent", { agentId });
    });

    /**
     * Get a registered agent
     */
    const getAgent = Effect.fn("AgentCoordinator.getAgent")(function* (agentId: AgentIdType) {
      const registry = yield* Ref.get(registryRef);
      const agent = HashMap.get(registry, agentId);

      if (O.isNone(agent)) {
        const registeredIds = A.fromIterable(HashMap.keys(registry));
        return yield* AgentNotFoundError.make({
          agentId,
          registeredAgents: registeredIds,
        });
      }

      return agent.value;
    });

    /**
     * List all registered agents
     */
    const listAgents: Effect.Effect<ReadonlyArray<AgentMetadata>> = Effect.gen(function* () {
      const registry = yield* Ref.get(registryRef);
      return A.map(A.fromIterable(HashMap.values(registry)), (registered) => registered.agent.metadata);
    });

    /**
     * Create initial pipeline state
     */
    const createPipelineState = Effect.fn("AgentCoordinator.createPipelineState")(function* (pipelineId: string) {
      const now = yield* DateTime.now;
      return PipelineState.make({
        pipelineId,
        completedAgents: [],
        intermediateResults: [],
        startedAt: now,
        status: PipelineStatus.cases.Pending.make({}),
      });
    });

    const invokeHook = Effect.fn("AgentCoordinator.invokeHook")(function* <A>(
      hook: O.Option<(value: A) => Effect.Effect<void>>,
      value: A
    ) {
      if (O.isSome(hook)) yield* hook.value(value);
    });

    const makeFailedPipelineState = Effect.fn("AgentCoordinator.makeFailedPipelineState")(function* (
      pipelineId: string,
      startedAt: DateTime.Utc,
      iterationCount: NonNegativeInt = NonNegativeInt.make(0)
    ) {
      const failedAt = yield* DateTime.now;
      return PipelineState.make({
        pipelineId,
        completedAgents: [],
        intermediateResults: [],
        startedAt,
        status: PipelineStatus.cases.Failed.make({
          failedAt,
          error: "Pipeline execution failed",
        }),
        iterationCount,
      });
    });

    /**
     * Execute a single agent and collect events
     */
    const executeAgent = Effect.fn("AgentCoordinator.executeAgent")(
      function* <I, O, E>(
        agent: Agent<I, O, E>,
        input: I,
        eventsRef: Ref.Ref<Array<AgentEvent>>,
        execution: ResolvedExecutionOptions
      ): Effect.fn.Return<
        {
          output: O;
          duration: Duration.Duration;
        },
        AgentExecutionError
      > {
        const agentId = agent.metadata.id;
        const startTime = yield* DateTime.now;

        // Emit started event
        const startedEvent = AgentStarted.make({
          agentId,
          startedAt: startTime,
          inputSummary: O.some(summarizeInput(input)),
        });
        yield* Ref.update(eventsRef, (events) => [...events, startedEvent]);
        yield* invokeHook(execution.onEvent, startedEvent);

        // Run validation if present
        if (O.isSome(agent.validate)) {
          const validation = yield* agent.validate.value(input);
          if (!validation.valid) {
            const failedAt = yield* DateTime.now;
            const failedEvent = AgentFailed.make({
              agentId,
              failedAt,
              duration: DateTime.distance(startTime, failedAt),
              error: `Validation failed: ${validation.errors?.join(", ")}`,
              retryable: false,
            });
            yield* Ref.update(eventsRef, (events) => [...events, failedEvent]);
            yield* invokeHook(execution.onEvent, failedEvent);

            return yield* AgentExecutionError.make({
              agentId,
              message: `Validation failed: ${validation.errors?.join(", ")}`,
              retryable: false,
            });
          }
        }

        // Execute agent with optional timeout
        const executeWithTimeout = O.match(execution.policy.agentTimeout, {
          onNone: () => agent.execute(input).pipe(Effect.asSome),
          onSome: (timeout) => agent.execute(input).pipe(Effect.timeoutOption(timeout)),
        });

        const resultOption = yield* executeWithTimeout.pipe(
          Effect.catch(
            Effect.fnUntraced(function* (error) {
              const failedAt = yield* DateTime.now;
              const failedEvent = AgentFailed.make({
                agentId,
                failedAt,
                duration: DateTime.distance(startTime, failedAt),
                error: Inspectable.toStringUnknown(error),
                retryable: true,
              });
              yield* Ref.update(eventsRef, (events) => [...events, failedEvent]);
              yield* invokeHook(execution.onEvent, failedEvent);

              return yield* AgentExecutionError.make({
                agentId,
                message: Inspectable.toStringUnknown(error),
                cause: O.some(error),
                retryable: true,
              });
            })
          )
        );

        if (O.isNone(resultOption)) {
          const failedAt = yield* DateTime.now;
          const failedEvent = AgentFailed.make({
            agentId,
            failedAt,
            duration: DateTime.distance(startTime, failedAt),
            error: "Agent execution timed out",
            retryable: false,
          });
          yield* Ref.update(eventsRef, (events) => [...events, failedEvent]);
          yield* invokeHook(execution.onEvent, failedEvent);

          return yield* AgentExecutionError.make({
            agentId,
            message: "Agent execution timed out",
            retryable: false,
          });
        }
        const result = resultOption.value;

        const completedAt = yield* DateTime.now;
        const duration = DateTime.distance(startTime, completedAt);

        // Emit completed event
        const completedEvent = AgentCompleted.make({
          agentId,
          completedAt,
          duration,
          outputSummary: O.some(summarizeOutput(result)),
        });
        yield* Ref.update(eventsRef, (events) => [...events, completedEvent]);
        yield* invokeHook(execution.onEvent, completedEvent);

        return { output: result, duration };
      },
      (effect, agent, _input, eventsRef, execution) =>
        effect.pipe(
          Effect.catch((error) => {
            if (AgentExecutionError.is(error)) {
              return error;
            }
            return Effect.gen(function* () {
              const failedAt = yield* DateTime.now;
              const failedEvent = AgentFailed.make({
                agentId: agent.metadata.id,
                failedAt,
                duration: Duration.zero,
                error: Inspectable.toStringUnknown(error),
                retryable: false,
              });
              yield* Ref.update(eventsRef, (events) => [...events, failedEvent]);
              yield* invokeHook(execution.onEvent, failedEvent);
              return yield* AgentExecutionError.make({
                agentId: agent.metadata.id,
                message: Inspectable.toStringUnknown(error),
                cause: O.some(error),
                retryable: false,
              });
            });
          })
        )
    );

    /**
     * Execute agents sequentially
     */
    const executeSequential = Effect.fn("AgentCoordinator.executeSequential")(function* (
      task: AgentTask,
      agentIds: ReadonlyArray<AgentIdType>,
      options?: ExecutionOptions
    ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
      const execution = resolveExecutionOptions(options);
      const pipelineId = `seq-${task.taskId}-${yield* Clock.currentTimeMillis}`;
      let state = yield* createPipelineState(pipelineId);
      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Running.make({}),
      });
      const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);
      let outputsMap = HashMap.empty<AgentIdType, unknown>();

      // Get all agents upfront
      const agents: Array<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError>> = [];
      for (const id of agentIds) {
        const agent = yield* getAgent(id).pipe(
          Effect.mapError((e) =>
            PipelineExecutionError.make({
              pipelineId,
              message: `Agent not found: ${e.agentId}`,
              state,
            })
          )
        );
        agents.push(agent);
      }

      let currentInput = task;

      for (let i = 0; i < agents.length; i++) {
        const registered = agents[i];
        const agent = registered.agent;
        const agentId = agent.metadata.id;

        // Update state
        state = PipelineState.make({
          ...state,
          currentAgentId: O.some(agentId),
        });

        const result = yield* executeAgent(agent, currentInput, eventsRef, execution).pipe(
          Effect.asSome,
          Effect.catch(
            Effect.fnUntraced(function* (error) {
              if (execution.policy.continueOnError) {
                state = PipelineState.make({
                  ...state,
                  currentAgentId: O.none(),
                });
                return O.none();
              }

              const failedAt = yield* DateTime.now;
              state = PipelineState.make({
                ...state,
                status: PipelineStatus.cases.Failed.make({
                  failedAt,
                  error: error.message,
                }),
              });
              return yield* PipelineExecutionError.make({
                pipelineId,
                message: error.message,
                failedAgentId: O.some(agentId),
                state,
                cause: O.some(error),
              });
            })
          )
        );

        if (O.isSome(result)) {
          const { duration, output } = result.value;
          // Store intermediate result
          const now = yield* DateTime.now;
          const intermediateResult = IntermediateResult.make({
            agentId,
            output,
            producedAt: now,
            duration,
          });

          state = PipelineState.make({
            ...state,
            completedAgents: [...state.completedAgents, agentId],
            intermediateResults: [...state.intermediateResults, intermediateResult],
            currentAgentId: O.none(),
          });

          outputsMap = HashMap.set(outputsMap, agentId, output);
          currentInput = output;
        }
      }

      // Mark complete
      const completedAt = yield* DateTime.now;
      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Completed.make({ completedAt }),
      });

      // Emit checkpoint
      const checkpointEvent = PipelineCheckpoint.make({
        state,
        reason: "agent-completed",
        timestamp: completedAt,
      });
      yield* Ref.update(eventsRef, (events) => [...events, checkpointEvent]);
      yield* invokeHook(execution.onCheckpoint, state);

      const events = yield* Ref.get(eventsRef);

      return ExecutionResult.make({
        state,
        events,
        outputs: outputsMap,
      });
    });

    /**
     * Execute agents in a loop until condition is met
     */
    const executeLoop = Effect.fn("AgentCoordinator.executeLoop")(function* (
      task: AgentTask,
      agentIds: ReadonlyArray<AgentIdType>,
      termination: TerminationCondition,
      options?: ExecutionOptions
    ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
      const execution = resolveExecutionOptions(options);
      const pipelineId = `loop-${task.taskId}-${yield* Clock.currentTimeMillis}`;
      let state = yield* createPipelineState(pipelineId);
      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Running.make({}),
        iterationCount: NonNegativeInt.make(0),
      });
      const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);
      let outputsMap = HashMap.empty<AgentIdType, unknown>();

      // Get all agents upfront
      const agents: Array<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError>> = [];
      for (const id of agentIds) {
        const agent = yield* getAgent(id).pipe(
          Effect.mapError((e) =>
            PipelineExecutionError.make({
              pipelineId,
              message: `Agent not found: ${e.agentId}`,
              state,
            })
          )
        );
        agents.push(agent);
      }

      let iteration = 0;
      let currentInput = task;
      let shouldContinue = true;

      while (shouldContinue && iteration < termination.maxIterations) {
        iteration++;

        // Emit iteration progress
        const progressAt = yield* DateTime.now;
        const progressEvent = AgentProgress.make({
          agentId: AgentId.make("coordinator"),
          progress: Percentage.make((iteration / termination.maxIterations) * 100),
          message: O.some(`Starting iteration ${iteration}`),
          timestamp: progressAt,
        });
        yield* Ref.update(eventsRef, (events) => [...events, progressEvent]);
        yield* invokeHook(execution.onEvent, progressEvent);

        // Execute each agent in sequence
        for (const registered of agents) {
          const agent = registered.agent;
          const agentId = agent.metadata.id;

          state = PipelineState.make({
            ...state,
            currentAgentId: O.some(agentId),
            iterationCount: NonNegativeInt.make(iteration),
          });

          const result = yield* executeAgent(agent, currentInput, eventsRef, execution).pipe(
            Effect.asSome,
            Effect.catch(
              Effect.fnUntraced(function* (error) {
                if (execution.policy.continueOnError) return O.none();

                const failedAt = yield* DateTime.now;
                state = PipelineState.make({
                  ...state,
                  status: PipelineStatus.cases.Failed.make({
                    failedAt,
                    error: error.message,
                  }),
                });
                return yield* PipelineExecutionError.make({
                  pipelineId,
                  message: error.message,
                  failedAgentId: O.some(agentId),
                  state,
                  cause: O.some(error),
                });
              })
            )
          );

          if (O.isSome(result)) {
            outputsMap = HashMap.set(outputsMap, agentId, result.value.output);

            // Check termination conditions
            if (termination.stopOnConformance) {
              const maybeReport = result.value.output;
              if (P.isObject(maybeReport) && P.hasProperty(maybeReport, "conforms") && maybeReport.conforms === true) {
                shouldContinue = false;
                break;
              }
            }

            currentInput = result.value.output;
          }
        }

        // Checkpoint after each iteration
        const now = yield* DateTime.now;
        state = PipelineState.make({
          ...state,
          iterationCount: NonNegativeInt.make(iteration),
          currentAgentId: O.none(),
        });

        const checkpointEvent = PipelineCheckpoint.make({
          state,
          reason: "scheduled",
          timestamp: now,
        });
        yield* Ref.update(eventsRef, (events) => [...events, checkpointEvent]);

        // Check timeout
        if (O.isSome(termination.timeout)) {
          const elapsed = DateTime.distance(state.startedAt, now);
          if (Duration.toMillis(elapsed) >= Duration.toMillis(termination.timeout.value)) {
            shouldContinue = false;
          }
        }
      }

      // Mark complete
      const completedAt = yield* DateTime.now;
      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Completed.make({ completedAt }),
        iterationCount: NonNegativeInt.make(iteration),
      });

      const finalCheckpoint = PipelineCheckpoint.make({
        state,
        reason: "agent-completed",
        timestamp: completedAt,
      });
      yield* Ref.update(eventsRef, (events) => [...events, finalCheckpoint]);
      yield* invokeHook(execution.onCheckpoint, state);

      const events = yield* Ref.get(eventsRef);

      return ExecutionResult.make({
        state,
        events,
        outputs: outputsMap,
      });
    });

    /**
     * Execute agents in parallel
     */
    const executeParallel = Effect.fn("AgentCoordinator.executeParallel")(function* (
      task: AgentTask,
      agentIds: ReadonlyArray<AgentIdType>,
      options?: ExecutionOptions & { concurrency?: number }
    ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
      const execution = resolveExecutionOptions(options);
      const pipelineId = `par-${task.taskId}-${yield* Clock.currentTimeMillis}`;
      let state = yield* createPipelineState(pipelineId);
      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Running.make({}),
      });
      const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);
      const concurrency = O.getOrElse(O.fromUndefinedOr(options?.concurrency), () => config.runtime.concurrency);

      // Get all agents upfront
      const agents: Array<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError>> = [];
      for (const id of agentIds) {
        const agent = yield* getAgent(id).pipe(
          Effect.mapError((e) =>
            PipelineExecutionError.make({
              pipelineId,
              message: `Agent not found: ${e.agentId}`,
              state,
            })
          )
        );
        agents.push(agent);
      }

      // Execute all agents in parallel
      const results = yield* Effect.all(
        A.map(agents, (registered) => {
          const agent = registered.agent;
          return executeAgent(agent, task, eventsRef, execution).pipe(
            Effect.map(({ duration, output }) =>
              O.some({
                agentId: agent.metadata.id,
                output,
                duration,
              })
            ),
            Effect.catch(
              Effect.fnUntraced(function* (error) {
                if (execution.policy.continueOnError) return O.none();

                const failedAt = yield* DateTime.now;
                return yield* PipelineExecutionError.make({
                  pipelineId,
                  message: error.message,
                  failedAgentId: O.some(agent.metadata.id),
                  state: PipelineState.make({
                    ...state,
                    status: PipelineStatus.cases.Failed.make({
                      failedAt,
                      error: error.message,
                    }),
                  }),
                  cause: O.some(error),
                });
              })
            )
          );
        }),
        { concurrency }
      );

      // Build outputs map
      let outputsMap = HashMap.empty<AgentIdType, unknown>();
      const completedAgentIds: Array<AgentIdType> = [];
      const intermediateResults: Array<IntermediateResult> = [];
      const completedAt = yield* DateTime.now;

      for (const result of A.getSomes(results)) {
        outputsMap = HashMap.set(outputsMap, result.agentId, result.output);
        completedAgentIds.push(result.agentId);
        intermediateResults.push(
          IntermediateResult.make({
            agentId: result.agentId,
            output: result.output,
            producedAt: completedAt,
            duration: result.duration,
          })
        );
      }

      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Completed.make({ completedAt }),
        completedAgents: completedAgentIds,
        intermediateResults,
      });

      const checkpointEvent = PipelineCheckpoint.make({
        state,
        reason: "agent-completed",
        timestamp: completedAt,
      });
      yield* Ref.update(eventsRef, (events) => [...events, checkpointEvent]);
      yield* invokeHook(execution.onCheckpoint, state);

      const events = yield* Ref.get(eventsRef);

      return ExecutionResult.make({
        state,
        events,
        outputs: outputsMap,
      });
    });

    /**
     * Execute pipeline based on configuration
     */
    const executePipelineMode = Match.type<PipelineConfig["mode"]>().pipe(
      Match.when(
        "sequential",
        () =>
          (
            task: AgentTask,
            _pipelineConfig: PipelineConfig,
            agentIds: ReadonlyArray<AgentId>,
            options: ExecutionOptions | undefined
          ) =>
            executeSequential(task, agentIds, options)
      ),
      Match.when(
        "loop",
        () =>
          (
            task: AgentTask,
            pipelineConfig: PipelineConfig,
            agentIds: ReadonlyArray<AgentId>,
            options: ExecutionOptions | undefined
          ) =>
            executeLoop(task, agentIds, O.getOrElse(pipelineConfig.termination, TerminationCondition.default), options)
      ),
      Match.when(
        "parallel",
        () =>
          (
            task: AgentTask,
            pipelineConfig: PipelineConfig,
            agentIds: ReadonlyArray<AgentId>,
            options: ExecutionOptions | undefined
          ) =>
            executeParallel(task, agentIds, {
              ...options,
              ...(O.isSome(pipelineConfig.concurrency) ? { concurrency: pipelineConfig.concurrency.value } : {}),
            })
      ),
      Match.when(
        "graph",
        () =>
          (
            task: AgentTask,
            _pipelineConfig: PipelineConfig,
            agentIds: ReadonlyArray<AgentId>,
            options: ExecutionOptions | undefined
          ) =>
            executeSequential(task, agentIds, options)
      ),
      Match.exhaustive
    );

    const execute = Effect.fn("AgentCoordinator.execute")(
      (
        task: AgentTask,
        pipelineConfig: PipelineConfig,
        options?: ExecutionOptions
      ): Effect.Effect<ExecutionResult, PipelineExecutionError> => {
        const agentIds = A.map(O.getOrElse(pipelineConfig.agentSequence, A.empty<string>), (id) => AgentId.make(id));

        return executePipelineMode(pipelineConfig.mode)(task, pipelineConfig, agentIds, options);
      }
    );

    /**
     * Run pipeline until a condition is met
     */
    const runUntil = Effect.fn("AgentCoordinator.runUntil")(function* (
      task: AgentTask,
      agentIds: ReadonlyArray<AgentIdType>,
      condition: (state: PipelineState) => boolean,
      maxIterations: number,
      options?: ExecutionOptions
    ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
      const execution = resolveExecutionOptions(options);
      const pipelineId = `until-${task.taskId}-${yield* Clock.currentTimeMillis}`;
      let state = yield* createPipelineState(pipelineId);
      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Running.make({}),
        iterationCount: NonNegativeInt.make(0),
      });
      const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);
      let outputsMap = HashMap.empty<AgentIdType, unknown>();

      // Get all agents upfront
      const agents: Array<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError>> = [];
      for (const id of agentIds) {
        const agent = yield* getAgent(id).pipe(
          Effect.mapError((e) =>
            PipelineExecutionError.make({
              pipelineId,
              message: `Agent not found: ${e.agentId}`,
              state,
            })
          )
        );
        agents.push(agent);
      }

      let iteration = 0;
      let currentInput = task;

      while (!condition(state) && iteration < maxIterations) {
        iteration++;

        for (const registered of agents) {
          const agent = registered.agent;
          const agentId = agent.metadata.id;

          state = PipelineState.make({
            ...state,
            currentAgentId: O.some(agentId),
            iterationCount: NonNegativeInt.make(iteration),
          });

          const result = yield* executeAgent(agent, currentInput, eventsRef, execution).pipe(
            Effect.catch(
              Effect.fnUntraced(function* (error) {
                const failedAt = yield* DateTime.now;
                state = PipelineState.make({
                  ...state,
                  status: PipelineStatus.cases.Failed.make({
                    failedAt,
                    error: error.message,
                  }),
                });
                return yield* PipelineExecutionError.make({
                  pipelineId,
                  message: error.message,
                  failedAgentId: O.some(agentId),
                  state,
                  cause: O.some(error),
                });
              })
            )
          );

          outputsMap = HashMap.set(outputsMap, agentId, result.output);
          currentInput = result.output;

          // Update state for condition check
          const now = yield* DateTime.now;
          state = PipelineState.make({
            ...state,
            completedAgents: [...state.completedAgents, agentId],
            intermediateResults: [
              ...state.intermediateResults,
              IntermediateResult.make({
                agentId,
                output: result.output,
                producedAt: now,
                duration: result.duration,
              }),
            ],
            currentAgentId: O.none(),
          });

          if (condition(state)) break;
        }
      }

      const completedAt = yield* DateTime.now;
      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Completed.make({ completedAt }),
      });

      const events = yield* Ref.get(eventsRef);

      return ExecutionResult.make({
        state,
        events,
        outputs: outputsMap,
      });
    });

    /**
     * Validation-correction refinement loop
     *
     * Iteratively validates and corrects a knowledge graph until it conforms
     * to SHACL shapes or reaches termination conditions.
     *
     * Flow: validate → correct → validate → correct → ... → conformant
     *
     * @param graph - Initial knowledge graph (as RdfStore or similar)
     * @param refinementConfig - Configuration for the refinement loop
     * @param options - Execution options (callbacks, timeouts)
     * @returns RefinementResult with final graph, status, and metrics
     */
    const refineUntilConformant = Effect.fn("AgentCoordinator.refineUntilConformant")(function* (
      graph: KnowledgeGraph | RdfStore,
      refinementConfig: RefinementConfig,
      options?: ExecutionOptions
    ): Effect.fn.Return<RefinementResult, PipelineExecutionError> {
      const execution = resolveExecutionOptions(options);
      const pipelineId = `refine-${yield* Clock.currentTimeMillis}`;
      const startTime = yield* DateTime.now;
      const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);

      // Determine validator and corrector agent IDs
      const validatorId = AgentId.make(O.getOrElse(refinementConfig.validatorId, () => "validator"));
      const correctorId = AgentId.make(O.getOrElse(refinementConfig.correctorId, () => "corrector"));

      // Get agents
      const validatorRegistered = yield* getAgent(validatorId).pipe(
        Effect.catch(
          Effect.fnUntraced(function* () {
            return yield* PipelineExecutionError.make({
              pipelineId,
              message: `Validator agent not found: ${validatorId}`,
              state: yield* makeFailedPipelineState(pipelineId, startTime),
            });
          })
        )
      );

      const correctorRegistered = yield* getAgent(correctorId).pipe(
        Effect.catch(
          Effect.fnUntraced(function* () {
            return yield* PipelineExecutionError.make({
              pipelineId,
              message: `Corrector agent not found: ${correctorId}`,
              state: yield* makeFailedPipelineState(pipelineId, startTime),
            });
          })
        )
      );

      const validator = validatorRegistered.agent;
      const corrector = correctorRegistered.agent;

      let currentGraph = graph;
      let iteration = 0;
      let status: RefinementStatus = "max-iterations";
      let lastValidationReport = O.none<ShaclValidationReport>();
      const violationsFixed: Array<NonNegativeInt> = [];

      // Main refinement loop
      while (iteration < refinementConfig.maxIterations) {
        iteration++;

        // Emit progress event
        const progressAt = yield* DateTime.now;
        const progressEvent = AgentProgress.make({
          agentId: AgentId.make("refiner"),
          progress: Percentage.make((iteration / refinementConfig.maxIterations) * 100),
          message: O.some(`Refinement iteration ${iteration}/${refinementConfig.maxIterations}`),
          timestamp: progressAt,
        });
        yield* Ref.update(eventsRef, (events) => [...events, progressEvent]);
        yield* invokeHook(execution.onEvent, progressEvent);

        // Step 1: Validate
        const validationResult = yield* executeAgent(
          validator,
          AgentTask.make({
            taskId: `${pipelineId}:validate:${iteration}`,
            graph: O.some(currentGraph),
          }),
          eventsRef,
          execution
        ).pipe(
          Effect.catch(
            Effect.fnUntraced(function* (e) {
              return yield* PipelineExecutionError.make({
                pipelineId,
                message: `Validation failed: ${e.message}`,
                failedAgentId: O.some(validatorId),
                state: yield* makeFailedPipelineState(pipelineId, startTime, NonNegativeInt.make(iteration)),
                cause: O.some(e),
              });
            })
          )
        );

        const validationTask = yield* S.decodeEffect(S.toType(AgentTask))(validationResult.output).pipe(
          Effect.catch(
            Effect.fnUntraced(function* (cause) {
              return yield* PipelineExecutionError.make({
                pipelineId,
                message: "Validator returned an invalid agent task",
                failedAgentId: O.some(validatorId),
                state: yield* makeFailedPipelineState(pipelineId, startTime, NonNegativeInt.make(iteration)),
                cause: O.some(cause),
              });
            })
          )
        );
        if (O.isNone(validationTask.validationReport)) {
          return yield* PipelineExecutionError.make({
            pipelineId,
            message: "Validator returned no SHACL validation report",
            failedAgentId: O.some(validatorId),
            state: yield* makeFailedPipelineState(pipelineId, startTime, NonNegativeInt.make(iteration)),
          });
        }
        const validationReport = validationTask.validationReport.value;
        lastValidationReport = O.some(validationReport);

        // Check if conformant
        if (refinementConfig.stopOnConformance && validationReport.validation.conforms) {
          status = "conformant";
          break;
        }

        // Step 2: Correct violations
        const correctionResult = yield* executeAgent(
          corrector,
          AgentTask.make({
            taskId: `${pipelineId}:correct:${iteration}`,
            graph: O.some(currentGraph),
            validationReport: O.some(validationReport),
          }),
          eventsRef,
          execution
        ).pipe(
          Effect.catch(
            Effect.fnUntraced(function* (e) {
              return yield* PipelineExecutionError.make({
                pipelineId,
                message: `Correction failed: ${e.message}`,
                failedAgentId: O.some(correctorId),
                state: yield* makeFailedPipelineState(pipelineId, startTime, NonNegativeInt.make(iteration)),
                cause: O.some(e),
              });
            })
          )
        );

        const correctionOutput = yield* S.decodeEffect(S.toType(AgentTask))(correctionResult.output).pipe(
          Effect.catch(
            Effect.fnUntraced(function* (cause) {
              return yield* PipelineExecutionError.make({
                pipelineId,
                message: "Corrector returned an invalid agent task",
                failedAgentId: O.some(correctorId),
                state: yield* makeFailedPipelineState(pipelineId, startTime, NonNegativeInt.make(iteration)),
                cause: O.some(cause),
              });
            })
          )
        );
        currentGraph = O.getOrElse(correctionOutput.graph, () => currentGraph);
        const correctionBatch = O.flatMap(correctionOutput.correctionResult, BatchCorrectionResult.decodeUnknownOption);
        violationsFixed.push(
          O.getOrElse(
            O.map(correctionBatch, (batch) => batch.correctedCount),
            () => NonNegativeInt.make(0)
          )
        );

        // Check confidence threshold
        if (O.isSome(refinementConfig.minConfidence)) {
          const correctionConfidence = O.getOrElse(
            O.map(correctionBatch, (batch) => batch.successRate),
            thunk0
          );
          if (correctionConfidence < refinementConfig.minConfidence.value) {
            status = "confidence-threshold";
            break;
          }
        }

        // Emit checkpoint at intervals
        if (
          O.isSome(refinementConfig.checkpointInterval) &&
          iteration % refinementConfig.checkpointInterval.value === 0
        ) {
          const checkpointAt = yield* DateTime.now;
          const checkpointEvent = PipelineCheckpoint.make({
            state: PipelineState.make({
              pipelineId,
              completedAgents: [],
              intermediateResults: [],
              startedAt: startTime,
              status: PipelineStatus.cases.Running.make({}),
              iterationCount: NonNegativeInt.make(iteration),
            }),
            reason: "scheduled",
            timestamp: checkpointAt,
          });
          yield* Ref.update(eventsRef, (events) => [...events, checkpointEvent]);
          yield* invokeHook(execution.onCheckpoint, checkpointEvent.state);
        }

        // Check timeout
        if (O.isSome(refinementConfig.timeoutMs)) {
          const now = yield* DateTime.now;
          const elapsed = DateTime.distance(startTime, now);
          if (Duration.toMillis(elapsed) >= refinementConfig.timeoutMs.value) {
            status = "timeout";
            break;
          }
        }
      }

      const completedAt = yield* DateTime.now;
      const durationMs = Duration.toMillis(DateTime.distance(startTime, completedAt));

      // Final checkpoint
      const finalState = PipelineState.make({
        pipelineId,
        completedAgents: [validatorId, correctorId],
        intermediateResults: [],
        startedAt: startTime,
        status: PipelineStatus.cases.Completed.make({ completedAt }),
        iterationCount: NonNegativeInt.make(iteration),
      });

      const finalCheckpoint = PipelineCheckpoint.make({
        state: finalState,
        reason: "agent-completed",
        timestamp: completedAt,
      });
      yield* Ref.update(eventsRef, (events) => [...events, finalCheckpoint]);
      yield* invokeHook(execution.onCheckpoint, finalState);

      return RefinementResult.make({
        graph: currentGraph,
        iterations: NonNegativeInt.make(iteration),
        status,
        validationReport: lastValidationReport,
        durationMs,
        violationsFixed: O.some(violationsFixed),
      });
    });

    // Return service object
    return {
      /**
       * Register an agent with the coordinator
       */
      register,

      /**
       * Unregister an agent
       */
      unregister,

      /**
       * Get a registered agent by ID
       */
      getAgent,

      /**
       * List all registered agents
       */
      listAgents,

      /**
       * Execute agents sequentially
       */
      executeSequential,

      /**
       * Execute agents in a loop until termination condition
       */
      executeLoop,

      /**
       * Execute agents in parallel
       */
      executeParallel,

      /**
       * Execute pipeline based on configuration
       */
      execute,

      /**
       * Run pipeline until condition is met
       */
      runUntil,

      /**
       * Validation-correction refinement loop
       */
      refineUntilConformant,

      /**
       * Get coordinator metadata
       */
      get metadata(): AgentMetadata {
        return AgentMetadata.make({
          id: AgentId.make("coordinator"),
          name: "Agent Coordinator",
          description: "Orchestrates multi-agent pipelines",
          type: "extractor",
          version: O.some("1.0.0"),
        });
      },
    };
  }),
}) {
  static readonly Default: Layer.Layer<AgentCoordinator, Config.ConfigError> = Layer.effect(this, this.make).pipe(
    Layer.provide([ConfigServiceDefault])
  );
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Summarize input for logging
 */
const summarizeInput = (input: unknown): string => {
  if (P.isNullish(input)) return "null";
  if (P.isString(input)) return Str.slice(0, 100)(input);
  if (P.isObject(input)) {
    if (P.hasProperty(input, "taskId")) return `Task: ${Inspectable.toStringUnknown(input.taskId)}`;
    return `Object with ${R.size(input)} keys`;
  }
  return Str.slice(0, 50)(Inspectable.toStringUnknown(input));
};

/**
 * Summarize output for logging
 */
const summarizeOutput = (output: unknown): string => {
  if (P.isNullish(output)) return "null";
  if (P.isString(output)) return Str.slice(0, 100)(output);
  if (P.isObject(output)) {
    if (P.hasProperty(output, "entities") && A.isArray(output.entities)) {
      return `KnowledgeGraph: ${output.entities.length} entities`;
    }
    if (P.hasProperty(output, "conforms") && P.isBoolean(output.conforms)) {
      const violations =
        P.hasProperty(output, "violations") && A.isArray(output.violations) ? output.violations.length : 0;
      return `ValidationReport: conforms=${output.conforms}, violations=${violations}`;
    }
    if (
      P.hasProperty(output, "correctedCount") &&
      P.isNumber(output.correctedCount) &&
      P.hasProperty(output, "totalViolations") &&
      P.isNumber(output.totalViolations)
    ) {
      return `BatchCorrection: ${output.correctedCount}/${output.totalViolations} fixed`;
    }
    return `Object with ${R.size(output)} keys`;
  }
  return Str.slice(0, 50)(Inspectable.toStringUnknown(output));
};
