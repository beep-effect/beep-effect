/**
 * Service: AgentCoordinator
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
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const coordinator = yield* AgentCoordinator
 *
 *   // Register agents
 *   yield* coordinator.register(extractorAgent)
 *   yield* coordinator.register(validatorAgent)
 *
 *   // Execute sequential pipeline
 *   const result = yield* coordinator.executeSequential(
 *     task,
 *     ["extractor", "validator"]
 *   )
 *
 *   console.log(`Completed: ${result.state.completedAgents.length} agents`)
 * })
 * ```
 *
 * @since 2.0.0
 * @module Service/Agent/AgentCoordinator
 */

import {$ScratchpadId} from "@beep/identity";
import {NonNegativeInt} from "@beep/schema/Int";
import {Percentage} from "@beep/schema/Percentage";
import {
  Context,
  DateTime,
  Duration,
  Effect,
  HashMap,
  Layer,
  Option,
  Ref
} from "effect";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type {
  Agent,
  AgentEvent,
  AgentId as AgentIdType,
  AgentType
} from "../../Domain/Model/Agent.ts";
import {
  AgentCompleted,
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
import {ConfigService, ConfigServiceDefault} from "../Config.ts";
import type {
  AgentTask,
  PipelineConfig,
  RefinementConfig,
  RefinementStatus,
  RegisteredAgent
} from "./types.ts";
import {
  AgentExecutionError,
  AgentNotFoundError,
  PipelineExecutionError,
  RefinementResult
} from "./types.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Agent/AgentCoordinator");

// =============================================================================
// Coordinator Types
// =============================================================================

/**
 * Options for pipeline execution
 *
 * @since 2.0.0
 * @category Types
 */
export interface ExecutionOptions {
  /**
   * Maximum time per agent in milliseconds
   */
  readonly agentTimeoutMs?: number;

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
 * @since 2.0.0
 * @category Types
 */
export interface ExecutionResult {
  readonly state: PipelineState;
  readonly events: ReadonlyArray<AgentEvent>;
  readonly outputs: HashMap.HashMap<AgentIdType, unknown>;
}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * AgentCoordinator - Multi-agent pipeline orchestrator
 *
 * Coordinates the execution of multiple agents in configurable patterns.
 * Manages agent registration, pipeline execution, and event collection.
 *
 * @since 2.0.0
 * @category Services
 */
export class AgentCoordinator extends Context.Service<AgentCoordinator>()($I`AgentCoordinator`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;

    // Agent registry (mutable ref)
    const registryRef = yield* Ref.make<HashMap.HashMap<AgentIdType, RegisteredAgent>>(HashMap.empty());

    /**
     * Register an agent with the coordinator
     */
    const register = Effect.fn("AgentCoordinator.register")(function* <I, O, E, R>(
      agent: Agent<I, O, E, R>,
      agentType: AgentType = agent.metadata.type
    ) {
      const registered: RegisteredAgent<I, O, E, R> = {
        agent,
        registeredAt: DateTime.toEpochMillis(yield* DateTime.now),
        agentType,
        enabled: true,
      };

      yield* Ref.update(registryRef, (registry) =>
        HashMap.set(registry, agent.metadata.id, registered as RegisteredAgent)
      );

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

      yield* Effect.logInfo("AgentCoordinator: Unregistered agent", {agentId});
    });

    /**
     * Get a registered agent
     */
    const getAgent = Effect.fn("AgentCoordinator.getAgent")(function* (agentId: AgentIdType) {
      const registry = yield* Ref.get(registryRef);
      const agent = HashMap.get(registry, agentId);

      if (Option.isNone(agent)) {
        const registeredIds = Array.from(HashMap.keys(registry));
        return yield* new AgentNotFoundError({
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
      return Array.from(HashMap.values(registry)).map((r) => r.agent.metadata);
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
      ): Effect.fn.Return<{
        output: O;
        duration: number
      }, AgentExecutionError> {
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

            return yield* new AgentExecutionError({
              agentId,
              message: `Validation failed: ${validation.errors?.join(", ")}`,
              retryable: false,
            });
          }
        }

        // Execute agent with optional timeout
        const executeWithTimeout = P.isNotUndefined(options?.agentTimeoutMs)
          ? agent.execute(input).pipe(Effect.timeout(options.agentTimeoutMs))
          : agent.execute(input);

        const result = yield* executeWithTimeout.pipe(
          Effect.catch((error) =>
            Effect.gen(function* () {
              const isTimeout = error && typeof error === "object" && "_tag" in error && error._tag === "TimeoutError";
              const failedAt = yield* DateTime.now;
              const failedEvent = AgentFailed.make({
                agentId,
                failedAt,
                duration: DateTime.distance(startTime, failedAt),
                error: isTimeout ? "Agent execution timed out" : String(error),
                retryable: !isTimeout,
              });
              yield* Ref.update(eventsRef, (events) => [...events, failedEvent]);
              if (P.isNotUndefined(options?.onEvent)) yield* options.onEvent(failedEvent);

              return yield* new AgentExecutionError({
                agentId,
                message: isTimeout ? "Agent execution timed out" : String(error),
                cause: error,
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

        return {output: result, duration};
      },
      (effect, agent, _input, eventsRef, options) =>
        effect.pipe(
          Effect.catch((error) => {
            if (error._tag === "AgentExecutionError") {
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
              return yield* new AgentExecutionError({
                agentId: agent.metadata.id,
                message: String(error),
                cause: error,
                retryable: false,
              });
            });
          })
        )
    );

    /**
     * Execute agents sequentially
     */
    const executeSequential =
      Effect.fn(function* (
        task: AgentTask,
        agentIds: ReadonlyArray<AgentIdType>,
        options?: ExecutionOptions
      ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
        const pipelineId = `seq-${task.taskId}-${yield* Clock.currentTimeMillis}`;
        let state = yield* createPipelineState(pipelineId);
        state = PipelineState.make({
          ...state,
          status: PipelineStatus.cases.Running.make({})
        });
        const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);
        let outputsMap = HashMap.empty<AgentIdType, unknown>();

        // Get all agents upfront
        const agents: Array<RegisteredAgent> = [];
        for (const id of agentIds) {
          const agent = yield* getAgent(id).pipe(
            Effect.mapError(
              (e) =>
                new PipelineExecutionError({
                  pipelineId,
                  message: `Agent not found: ${e.agentId}`,
                  state,
                })
            )
          );
          agents.push(agent);
        }

        let currentInput: unknown = task;

        for (let i = 0; i < agents.length; i++) {
          const registered = agents[i];
          const agent = registered.agent as Agent<unknown, unknown, unknown, never>;
          const agentId = agent.metadata.id;

          // Update state
          state = PipelineState.make({
            ...state,
            currentAgentId: O.some(agentId),
          });

          const result = yield* executeAgent(agent, currentInput, eventsRef, options).pipe(
            Effect.mapError(
              (e) =>
                new PipelineExecutionError({
                  pipelineId,
                  message: e.message,
                  failedAgentId: agentId,
                  state,
                  cause: e,
                })
            ),
            Effect.catch((error) => {
              if (P.isNotUndefined(options?.continueOnError)) {
                return Effect.succeed({output: null, duration: 0});
              }
              state = PipelineState.make({
                ...state,
                status: PipelineStatus.cases.Failed.make({
                  failedAt: DateTime.nowUnsafe(),
                  error: error.message
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
          status: PipelineStatus.cases.Completed.make({completedAt}),
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

        return {
          state,
          events,
          outputs: outputsMap,
        };
      });

    /**
     * Execute agents in a loop until condition is met
     */
    const executeLoop =
      Effect.fn(function* (
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
        const agents: Array<RegisteredAgent> = [];
        for (const id of agentIds) {
          const agent = yield* getAgent(id).pipe(
            Effect.mapError(
              (e) =>
                new PipelineExecutionError({
                  pipelineId,
                  message: `Agent not found: ${e.agentId}`,
                  state,
                })
            )
          );
          agents.push(agent);
        }

        let iteration = 0;
        let currentInput: unknown = task;
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
            const agent = registered.agent as Agent<unknown, unknown, unknown, never>;
            const agentId = agent.metadata.id;

            state = PipelineState.make({
              ...state,
              currentAgentId: O.some(agentId),
              iterationCount: NonNegativeInt.make(iteration),
            });

            const result = yield* executeAgent(agent, currentInput, eventsRef, options).pipe(
              Effect.mapError(
                (e) =>
                  new PipelineExecutionError({
                    pipelineId,
                    message: e.message,
                    failedAgentId: agentId,
                    state,
                    cause: e,
                  })
              ),
              Effect.catch((error) => {
                if (P.isNotUndefined(options?.continueOnError)) {
                  return Effect.succeed({output: null, duration: 0});
                }
                state = PipelineState.make({
                  ...state,
                  status: PipelineStatus.cases.Failed.make({
                    failedAt: DateTime.nowUnsafe(),
                    error: error.message
                  }),
                });
                return Effect.fail(error);
              })
            );

            if (result.output !== null) {
              outputsMap = HashMap.set(outputsMap, agentId, result.output);

              // Check termination conditions
              if (termination.stopOnConformance) {
                const maybeReport = result.output as { conforms?: boolean };
                if (maybeReport?.conforms === true) {
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
          status: PipelineStatus.cases.Completed.make({completedAt}),
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

        return {
          state,
          events,
          outputs: outputsMap,
        };
      });

    /**
     * Execute agents in parallel
     */
    const executeParallel =
      Effect.fn(function* (
        task: AgentTask,
        agentIds: ReadonlyArray<AgentIdType>,
        options?: ExecutionOptions & { concurrency?: number }
      ): Effect.fn.Return<ExecutionResult, PipelineExecutionError> {
        const pipelineId = `par-${task.taskId}-${yield* Clock.currentTimeMillis}`;
        let state = yield* createPipelineState(pipelineId);
        state = PipelineState.make({
          ...state,
          status: PipelineStatus.cases.Running.make({})
        });
        const eventsRef = yield* Ref.make<Array<AgentEvent>>([]);
        const concurrency = options?.concurrency ?? config.runtime.concurrency;

        // Get all agents upfront
        const agents: Array<RegisteredAgent> = [];
        for (const id of agentIds) {
          const agent = yield* getAgent(id).pipe(
            Effect.mapError(
              (e) =>
                new PipelineExecutionError({
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
            const agent = registered.agent as Agent<unknown, unknown, unknown, never>;
            return executeAgent(agent, task, eventsRef, options).pipe(
              Effect.map(({duration, output}) => ({
                agentId: agent.metadata.id,
                output,
                duration,
                success: true as const,
              })),
              Effect.catch((error) => {
                if (P.isNotUndefined(options?.continueOnError)) {
                  return Effect.succeed({
                    agentId: agent.metadata.id,
                    output: null as unknown,
                    duration: 0,
                    success: false as const,
                    error,
                  });
                }
                return Effect.fail(
                  new PipelineExecutionError({
                    pipelineId,
                    message: error.message,
                    failedAgentId: agent.metadata.id,
                    state,
                    cause: error,
                  })
                );
              })
            );
          }),
          {concurrency}
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
          status: PipelineStatus.cases.Completed.make({completedAt}),
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

        return {
          state,
          events,
          outputs: outputsMap,
        };
      });

    /**
     * Execute pipeline based on configuration
     */
    const execute = (
      task: AgentTask,
      pipelineConfig: PipelineConfig,
      options?: ExecutionOptions
    ): Effect.Effect<ExecutionResult, PipelineExecutionError> => {
      const agentIds = A.map(O.getOrElse(pipelineConfig.agentSequence, A.empty<string>), (id) => AgentId.make(id));

      switch (pipelineConfig.mode) {
        case "sequential":
          return executeSequential(task, agentIds, options);

        case "loop":
          return executeLoop(
            task,
            agentIds,
            O.getOrElse(pipelineConfig.termination, TerminationCondition.default),
            options
          );

        case "parallel":
          return executeParallel(task, agentIds, {
            ...options,
            ...(O.isSome(pipelineConfig.concurrency) ? {concurrency: pipelineConfig.concurrency.value} : {}),
          });

        case "graph":
          // Graph mode not yet implemented - fall back to sequential
          return executeSequential(task, agentIds, options);
      }
    };

    /**
     * Run pipeline until a condition is met
     */
    const runUntil =
      Effect.fn(function* (
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
        const agents: Array<RegisteredAgent> = [];
        for (const id of agentIds) {
          const agent = yield* getAgent(id).pipe(
            Effect.mapError(
              (e) =>
                new PipelineExecutionError({
                  pipelineId,
                  message: `Agent not found: ${e.agentId}`,
                  state,
                })
            )
          );
          agents.push(agent);
        }

        let iteration = 0;
        let currentInput: unknown = task;

        while (!condition(state) && iteration < maxIterations) {
          iteration++;

          for (const registered of agents) {
            const agent = registered.agent as Agent<unknown, unknown, unknown, never>;
            const agentId = agent.metadata.id;

            state = PipelineState.make({
              ...state,
              currentAgentId: O.some(agentId),
              iterationCount: NonNegativeInt.make(iteration),
            });

            const result = yield* executeAgent(agent, currentInput, eventsRef, options).pipe(
              Effect.mapError(
                (e) =>
                  new PipelineExecutionError({
                    pipelineId,
                    message: e.message,
                    failedAgentId: agentId,
                    state,
                    cause: e,
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
          status: PipelineStatus.cases.Completed.make({completedAt}),
        });

        const events = yield* Ref.get(eventsRef);

        return {
          state,
          events,
          outputs: outputsMap,
        };
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
    const refineUntilConformant =
      Effect.fn(function* (
        graph: unknown,
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
          Effect.mapError(
            () =>
              new PipelineExecutionError({
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
          Effect.mapError(
            () =>
              new PipelineExecutionError({
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

        const validator = validatorRegistered.agent as Agent<
          unknown,
          { conforms: boolean; violations?: Array<unknown> },
          unknown,
          never
        >;
        const corrector = correctorRegistered.agent as Agent<
          unknown,
          { correctedGraph: unknown; confidence: number },
          unknown,
          never
        >;

        let currentGraph = graph;
        let iteration = 0;
        let status: RefinementStatus = "max-iterations";
        let lastValidationReport: unknown;
        const violationsFixed: Array<number> = [];

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
          const validationResult = yield* executeAgent(validator, {graph: currentGraph}, eventsRef, options).pipe(
            Effect.mapError(
              (e) =>
                new PipelineExecutionError({
                  pipelineId,
                  message: `Validation failed: ${e.message}`,
                  failedAgentId: validatorId,
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
                  cause: e,
                })
            )
          );

          const validationReport = validationResult.output as {
            conforms: boolean;
            violations?: Array<unknown>
          };
          lastValidationReport = validationReport;

          // Check if conformant
          if (refinementConfig.stopOnConformance && validationReport.conforms) {
            status = "conformant";
            break;
          }

          // Step 2: Correct violations
          const correctionResult = yield* executeAgent(
            corrector,
            {graph: currentGraph, validationReport},
            eventsRef,
            options
          ).pipe(
            Effect.mapError(
              (e) =>
                new PipelineExecutionError({
                  pipelineId,
                  message: `Correction failed: ${e.message}`,
                  failedAgentId: correctorId,
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
                  cause: e,
                })
            )
          );

          const correctionOutput = correctionResult.output as {
            correctedGraph: unknown;
            confidence: number;
            correctedCount?: number;
          };
          currentGraph = correctionOutput.correctedGraph;
          violationsFixed.push(correctionOutput.correctedCount ?? 0);

          // Check confidence threshold
          if (O.isSome(refinementConfig.minConfidence)) {
            if (correctionOutput.confidence < refinementConfig.minConfidence.value) {
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
          status: PipelineStatus.cases.Completed.make({completedAt}),
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
          iterations: iteration,
          status,
          validationReport: O.some(lastValidationReport),
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
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([ConfigServiceDefault]));
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Summarize input for logging
 */
const summarizeInput = (input: unknown): string => {
  if (input === null || input === undefined) return "null";
  if (typeof input === "string") return input.slice(0, 100);
  if (typeof input === "object") {
    if ("taskId" in input) return `Task: ${(input as {
      taskId: string
    }).taskId}`;
    return `Object with ${Object.keys(input).length} keys`;
  }
  return String(input).slice(0, 50);
};

/**
 * Summarize output for logging
 */
const summarizeOutput = (output: unknown): string => {
  if (output === null || output === undefined) return "null";
  if (typeof output === "string") return output.slice(0, 100);
  if (typeof output === "object") {
    if ("entities" in output) {
      const kg = output as { entities: Array<unknown> };
      return `KnowledgeGraph: ${kg.entities.length} entities`;
    }
    if ("conforms" in output) {
      const report = output as {
        conforms: boolean;
        violations?: Array<unknown>
      };
      return `ValidationReport: conforms=${report.conforms}, violations=${report.violations?.length ?? 0}`;
    }
    if ("correctedCount" in output) {
      const batch = output as {
        correctedCount: number;
        totalViolations: number
      };
      return `BatchCorrection: ${batch.correctedCount}/${batch.totalViolations} fixed`;
    }
    return `Object with ${Object.keys(output).length} keys`;
  }
  return String(output).slice(0, 50);
};
