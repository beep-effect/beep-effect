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
 * **Example** (Inspect the coordinator layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { AgentCoordinator } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * console.log(Layer.isLayer(AgentCoordinator.Default)) // true
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
import { Percentage } from "@beep/schema/Percentage";
import type { Config } from "effect";
import { Cause, Clock, Context, DateTime, Duration, Effect, HashMap, Inspectable, Layer, Match, Ref } from "effect";
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
 * Options for pipeline execution
 *
 *
 * **Example** (Use the ExecutionOptions contract)
 *
 * ```ts
 * import type { ExecutionOptions } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * const acceptsExecutionOptions = (_value: ExecutionOptions): void => undefined
 *
 * console.log(acceptsExecutionOptions)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ExecutionOptions {
  /**
   * Maximum duration allowed for one agent execution.
   */
  readonly agentTimeout?: Duration.Duration;

  /**
   * Whether to continue on agent failure
   */
  readonly continueOnError?: boolean;

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
 * Result of pipeline execution
 *
 *
 * **Example** (Use the ExecutionResult contract)
 *
 * ```ts
 * import type { ExecutionResult } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * const acceptsExecutionResult = (_value: ExecutionResult): void => undefined
 *
 * console.log(acceptsExecutionResult)
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
  readonly register: <E>(agent: Agent<AgentTask, AgentTask, E, never>, agentType?: AgentType) => Effect.Effect<void>;
  readonly unregister: (agentId: AgentIdType) => Effect.Effect<void>;
  readonly getAgent: (
    agentId: AgentIdType
  ) => Effect.Effect<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError, never>, AgentNotFoundError>;
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
 * **Example** (Inspect agent coordinator)
 *
 * ```ts
 * import { AgentCoordinator } from "@effect-ontology/Service/Agent/AgentCoordinator"
 *
 * console.log(AgentCoordinator)
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
      HashMap.HashMap<AgentIdType, RegisteredAgent<AgentTask, AgentTask, AgentExecutionError, never>>
    >(HashMap.empty());

    /**
     * Register an agent with the coordinator
     */
    const register = Effect.fn("AgentCoordinator.register")(function* <E>(
      agent: Agent<AgentTask, AgentTask, E, never>,
      agentType: AgentType = agent.metadata.type
    ) {
      const normalizedAgent: Agent<AgentTask, AgentTask, AgentExecutionError, never> = {
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
      const registered: RegisteredAgent<AgentTask, AgentTask, AgentExecutionError, never> = {
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

    /**
     * Execute a single agent and collect events
     */
    const executeAgent = Effect.fn("AgentCoordinator.executeAgent")(
      function* <I, O, E>(
        agent: Agent<I, O, E, never>,
        input: I,
        eventsRef: Ref.Ref<Array<AgentEvent>>,
        options?: ExecutionOptions
      ): Effect.fn.Return<
        {
          output: O;
          duration: number;
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
        if (P.isNotUndefined(options?.onEvent)) yield* options.onEvent(startedEvent);

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
            if (P.isNotUndefined(options?.onEvent)) yield* options.onEvent(failedEvent);

            return yield* AgentExecutionError.make({
              agentId,
              message: `Validation failed: ${validation.errors?.join(", ")}`,
              retryable: false,
            });
          }
        }

        // Execute agent with optional timeout
        const executeWithTimeout = P.isNotUndefined(options?.agentTimeout)
          ? agent.execute(input).pipe(Effect.timeout(options.agentTimeout))
          : agent.execute(input);

        const result = yield* executeWithTimeout.pipe(
          Effect.catch(
            Effect.fnUntraced(function* (error) {
              const isTimeout = Cause.isTimeoutError(error);
              const failedAt = yield* DateTime.now;
              const failedEvent = AgentFailed.make({
                agentId,
                failedAt,
                duration: DateTime.distance(startTime, failedAt),
                error: isTimeout ? "Agent execution timed out" : Inspectable.toStringUnknown(error),
                retryable: !isTimeout,
              });
              yield* Ref.update(eventsRef, (events) => [...events, failedEvent]);
              if (P.isNotUndefined(options?.onEvent)) yield* options.onEvent(failedEvent);

              return yield* AgentExecutionError.make({
                agentId,
                message: isTimeout ? "Agent execution timed out" : String(error),
                cause: O.some(error),
                retryable: !isTimeout,
              });
            })
          )
        );

        const completedAt = yield* DateTime.now;
        const duration = Duration.toMillis(DateTime.distance(startTime, completedAt));

        // Emit completed event
        const completedEvent = AgentCompleted.make({
          agentId,
          completedAt,
          duration: Duration.millis(duration),
          outputSummary: O.some(summarizeOutput(result)),
        });
        yield* Ref.update(eventsRef, (events) => [...events, completedEvent]);
        if (P.isNotUndefined(options?.onEvent)) yield* options.onEvent(completedEvent);

        return { output: result, duration };
      },
      (effect, agent, _input, eventsRef, options) =>
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
                error: String(error),
                retryable: false,
              });
              yield* Ref.update(eventsRef, (events) => [...events, failedEvent]);
              if (P.isNotUndefined(options?.onEvent)) yield* options.onEvent(failedEvent);
              return yield* AgentExecutionError.make({
                agentId: agent.metadata.id,
                message: String(error),
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
    const executeSequential = Effect.fn(function* (
      task: AgentTask,
      agentIds: ReadonlyArray<AgentIdType>,
      options?: ExecutionOptions
    ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
      const pipelineId = `seq-${task.taskId}-${yield* Clock.currentTimeMillis}`;
      let state = yield* createPipelineState(pipelineId);
      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Running.make({}),
      });
      const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);
      let outputsMap = HashMap.empty<AgentIdType, unknown>();

      // Get all agents upfront
      const agents: Array<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError, never>> = [];
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

        const result = yield* executeAgent(agent, currentInput, eventsRef, options).pipe(
          Effect.mapError((e) =>
            PipelineExecutionError.make({
              pipelineId,
              message: e.message,
              failedAgentId: O.some(agentId),
              state,
              cause: O.some(e),
            })
          ),
          Effect.catch((error) => {
            if (P.isNotUndefined(options?.continueOnError)) {
              return Effect.succeed({ output: null, duration: 0 });
            }
            state = PipelineState.make({
              ...state,
              status: PipelineStatus.cases.Failed.make({
                failedAt: DateTime.nowUnsafe(),
                error: error.message,
              }),
            });
            return Effect.fail(error);
          })
        );

        if (result.output !== null) {
          // Store intermediate result
          const now = yield* DateTime.now;
          const intermediateResult = IntermediateResult.make({
            agentId,
            output: result.output,
            producedAt: now,
            duration: Duration.millis(result.duration),
          });

          state = PipelineState.make({
            ...state,
            completedAgents: [...state.completedAgents, agentId],
            intermediateResults: [...state.intermediateResults, intermediateResult],
            currentAgentId: O.none(),
          });

          outputsMap = HashMap.set(outputsMap, agentId, result.output);
          currentInput = result.output;
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
      if (P.isNotUndefined(options?.onCheckpoint)) yield* options.onCheckpoint(state);

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
    const executeLoop = Effect.fn(function* (
      task: AgentTask,
      agentIds: ReadonlyArray<AgentIdType>,
      termination: TerminationCondition,
      options?: ExecutionOptions
    ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
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
      const agents: Array<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError, never>> = [];
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
        const progressEvent = AgentProgress.make({
          agentId: AgentId.make("coordinator"),
          progress: Percentage.make((iteration / termination.maxIterations) * 100),
          message: O.some(`Starting iteration ${iteration}`),
          timestamp: DateTime.nowUnsafe(),
        });
        yield* Ref.update(eventsRef, (events) => [...events, progressEvent]);
        if (P.isNotUndefined(options?.onEvent)) yield* options.onEvent(progressEvent);

        // Execute each agent in sequence
        for (const registered of agents) {
          const agent = registered.agent;
          const agentId = agent.metadata.id;

          state = PipelineState.make({
            ...state,
            currentAgentId: O.some(agentId),
            iterationCount: NonNegativeInt.make(iteration),
          });

          const result = yield* executeAgent(agent, currentInput, eventsRef, options).pipe(
            Effect.mapError((e) =>
              PipelineExecutionError.make({
                pipelineId,
                message: e.message,
                failedAgentId: O.some(agentId),
                state,
                cause: O.some(e),
              })
            ),
            Effect.catch((error) => {
              if (P.isNotUndefined(options?.continueOnError)) {
                return Effect.succeed({ output: null, duration: 0 });
              }
              state = PipelineState.make({
                ...state,
                status: PipelineStatus.cases.Failed.make({
                  failedAt: DateTime.nowUnsafe(),
                  error: error.message,
                }),
              });
              return Effect.fail(error);
            })
          );

          if (result.output !== null) {
            outputsMap = HashMap.set(outputsMap, agentId, result.output);

            // Check termination conditions
            if (termination.stopOnConformance) {
              const maybeReport = result.output;
              if (P.isObject(maybeReport) && P.hasProperty(maybeReport, "conforms") && maybeReport.conforms === true) {
                shouldContinue = false;
                break;
              }
            }

            currentInput = result.output;
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
      if (P.isNotUndefined(options?.onCheckpoint)) yield* options.onCheckpoint(state);

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
    const executeParallel = Effect.fn(function* (
      task: AgentTask,
      agentIds: ReadonlyArray<AgentIdType>,
      options?: ExecutionOptions & { concurrency?: number }
    ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
      const pipelineId = `par-${task.taskId}-${yield* Clock.currentTimeMillis}`;
      let state = yield* createPipelineState(pipelineId);
      state = PipelineState.make({
        ...state,
        status: PipelineStatus.cases.Running.make({}),
      });
      const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);
      const concurrency = options?.concurrency ?? config.runtime.concurrency;

      // Get all agents upfront
      const agents: Array<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError, never>> = [];
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
        agents.map((registered) => {
          const agent = registered.agent;
          return executeAgent(agent, task, eventsRef, options).pipe(
            Effect.map(({ duration, output }) => ({
              agentId: agent.metadata.id,
              output,
              duration,
              success: true,
            })),
            Effect.catch((error) => {
              if (P.isNotUndefined(options?.continueOnError)) {
                return Effect.succeed({
                  agentId: agent.metadata.id,
                  output: null,
                  duration: 0,
                  success: false,
                  error,
                });
              }
              return Effect.fail(
                PipelineExecutionError.make({
                  pipelineId,
                  message: error.message,
                  failedAgentId: O.some(agent.metadata.id),
                  state,
                  cause: O.some(error),
                })
              );
            })
          );
        }),
        { concurrency }
      );

      // Build outputs map
      let outputsMap = HashMap.empty<AgentIdType, unknown>();
      const completedAgentIds: Array<AgentIdType> = [];
      const intermediateResults: Array<IntermediateResult> = [];
      const completedAt = yield* DateTime.now;

      for (const r of results) {
        if (r.success && r.output !== null) {
          outputsMap = HashMap.set(outputsMap, r.agentId, r.output);
          completedAgentIds.push(r.agentId);
          intermediateResults.push(
            IntermediateResult.make({
              agentId: r.agentId,
              output: r.output,
              producedAt: completedAt,
              duration: Duration.millis(r.duration),
            })
          );
        }
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
      if (P.isNotUndefined(options?.onCheckpoint)) yield* options.onCheckpoint(state);

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

    const execute = (
      task: AgentTask,
      pipelineConfig: PipelineConfig,
      options?: ExecutionOptions
    ): Effect.Effect<ExecutionResult, PipelineExecutionError> => {
      const agentIds = A.map(O.getOrElse(pipelineConfig.agentSequence, A.empty<string>), (id) => AgentId.make(id));

      return executePipelineMode(pipelineConfig.mode)(task, pipelineConfig, agentIds, options);
    };

    /**
     * Run pipeline until a condition is met
     */
    const runUntil = Effect.fn(function* (
      task: AgentTask,
      agentIds: ReadonlyArray<AgentIdType>,
      condition: (state: PipelineState) => boolean,
      maxIterations: number,
      options?: ExecutionOptions
    ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
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
      const agents: Array<RegisteredAgent<AgentTask, AgentTask, AgentExecutionError, never>> = [];
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

          const result = yield* executeAgent(agent, currentInput, eventsRef, options).pipe(
            Effect.mapError((e) =>
              PipelineExecutionError.make({
                pipelineId,
                message: e.message,
                failedAgentId: O.some(agentId),
                state,
                cause: O.some(e),
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
                duration: Duration.millis(result.duration),
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
    const refineUntilConformant = Effect.fn(function* (
      graph: KnowledgeGraph | RdfStore,
      refinementConfig: RefinementConfig,
      options?: ExecutionOptions
    ): Effect.fn.Return<RefinementResult, PipelineExecutionError> {
      const pipelineId = `refine-${yield* Clock.currentTimeMillis}`;
      const startTime = yield* DateTime.now;
      const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);

      // Determine validator and corrector agent IDs
      const validatorId = AgentId.make(O.getOrElse(refinementConfig.validatorId, () => "validator"));
      const correctorId = AgentId.make(O.getOrElse(refinementConfig.correctorId, () => "corrector"));

      // Get agents
      const validatorRegistered = yield* getAgent(validatorId).pipe(
        Effect.mapError(() =>
          PipelineExecutionError.make({
            pipelineId,
            message: `Validator agent not found: ${validatorId}`,
            state: PipelineState.make({
              pipelineId,
              completedAgents: [],
              intermediateResults: [],
              startedAt: startTime,
              status: PipelineStatus.cases.Failed.make({
                failedAt: DateTime.nowUnsafe(),
                error: "Pipeline execution failed",
              }),
            }),
          })
        )
      );

      const correctorRegistered = yield* getAgent(correctorId).pipe(
        Effect.mapError(() =>
          PipelineExecutionError.make({
            pipelineId,
            message: `Corrector agent not found: ${correctorId}`,
            state: PipelineState.make({
              pipelineId,
              completedAgents: [],
              intermediateResults: [],
              startedAt: startTime,
              status: PipelineStatus.cases.Failed.make({
                failedAt: DateTime.nowUnsafe(),
                error: "Pipeline execution failed",
              }),
            }),
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
        const progressEvent = AgentProgress.make({
          agentId: AgentId.make("refiner"),
          progress: Percentage.make((iteration / refinementConfig.maxIterations) * 100),
          message: O.some(`Refinement iteration ${iteration}/${refinementConfig.maxIterations}`),
          timestamp: DateTime.nowUnsafe(),
        });
        yield* Ref.update(eventsRef, (events) => [...events, progressEvent]);
        if (P.isNotUndefined(options?.onEvent)) yield* options.onEvent(progressEvent);

        // Step 1: Validate
        const validationResult = yield* executeAgent(
          validator,
          AgentTask.make({
            taskId: `${pipelineId}:validate:${iteration}`,
            graph: O.some(currentGraph),
          }),
          eventsRef,
          options
        ).pipe(
          Effect.mapError((e) =>
            PipelineExecutionError.make({
              pipelineId,
              message: `Validation failed: ${e.message}`,
              failedAgentId: O.some(validatorId),
              state: PipelineState.make({
                pipelineId,
                completedAgents: [],
                intermediateResults: [],
                startedAt: startTime,
                status: PipelineStatus.cases.Failed.make({
                  failedAt: DateTime.nowUnsafe(),
                  error: "Pipeline execution failed",
                }),
                iterationCount: NonNegativeInt.make(iteration),
              }),
              cause: O.some(e),
            })
          )
        );

        const validationTask = yield* S.decodeEffect(AgentTask)(validationResult.output).pipe(
          Effect.mapError((cause) =>
            PipelineExecutionError.make({
              pipelineId,
              message: "Validator returned an invalid agent task",
              failedAgentId: O.some(validatorId),
              state: PipelineState.make({
                pipelineId,
                completedAgents: [],
                intermediateResults: [],
                startedAt: startTime,
                status: PipelineStatus.cases.Failed.make({
                  failedAt: DateTime.nowUnsafe(),
                  error: "Pipeline execution failed",
                }),
                iterationCount: NonNegativeInt.make(iteration),
              }),
              cause: O.some(cause),
            })
          )
        );
        if (O.isNone(validationTask.validationReport)) {
          return yield* PipelineExecutionError.make({
            pipelineId,
            message: "Validator returned no SHACL validation report",
            failedAgentId: O.some(validatorId),
            state: PipelineState.make({
              pipelineId,
              completedAgents: [],
              intermediateResults: [],
              startedAt: startTime,
              status: PipelineStatus.cases.Failed.make({
                failedAt: DateTime.nowUnsafe(),
                error: "Pipeline execution failed",
              }),
              iterationCount: NonNegativeInt.make(iteration),
            }),
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
          options
        ).pipe(
          Effect.mapError((e) =>
            PipelineExecutionError.make({
              pipelineId,
              message: `Correction failed: ${e.message}`,
              failedAgentId: O.some(correctorId),
              state: PipelineState.make({
                pipelineId,
                completedAgents: [],
                intermediateResults: [],
                startedAt: startTime,
                status: PipelineStatus.cases.Failed.make({
                  failedAt: DateTime.nowUnsafe(),
                  error: "Pipeline execution failed",
                }),
                iterationCount: NonNegativeInt.make(iteration),
              }),
              cause: O.some(e),
            })
          )
        );

        const correctionOutput = yield* S.decodeEffect(AgentTask)(correctionResult.output).pipe(
          Effect.mapError((cause) =>
            PipelineExecutionError.make({
              pipelineId,
              message: "Corrector returned an invalid agent task",
              failedAgentId: O.some(correctorId),
              state: PipelineState.make({
                pipelineId,
                completedAgents: [],
                intermediateResults: [],
                startedAt: startTime,
                status: PipelineStatus.cases.Failed.make({
                  failedAt: DateTime.nowUnsafe(),
                  error: "Pipeline execution failed",
                }),
                iterationCount: NonNegativeInt.make(iteration),
              }),
              cause: O.some(cause),
            })
          )
        );
        currentGraph = O.getOrElse(correctionOutput.graph, () => currentGraph);
        const correctionBatch = O.flatMap(
          correctionOutput.correctionResult,
          S.decodeUnknownOption(BatchCorrectionResult)
        );
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
            () => 0
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
            timestamp: DateTime.nowUnsafe(),
          });
          yield* Ref.update(eventsRef, (events) => [...events, checkpointEvent]);
          if (P.isNotUndefined(options?.onCheckpoint)) {
            yield* options.onCheckpoint(checkpointEvent.state);
          }
        }

        // Check timeout
        if (O.isSome(refinementConfig.timeoutMs)) {
          const elapsed = DateTime.distance(startTime, DateTime.nowUnsafe());
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
      if (P.isNotUndefined(options?.onCheckpoint)) {
        yield* options.onCheckpoint(finalState);
      }

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
