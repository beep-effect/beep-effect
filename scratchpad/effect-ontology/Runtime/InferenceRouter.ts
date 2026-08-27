/**
 * Router: Inference API
 *
 * **Details**
 *
 * HTTP endpoints for standalone RDFS reasoning on RDF graphs.
 * Provides synchronous inference with delta computation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Clock, Context, Effect, HashMap, Inspectable, Layer, Random, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import {
  InferenceRunRequest,
  InferenceRunResponse,
  InferenceStats,
  InferenceStatusResponse,
} from "../Domain/Schema/Inference.ts";
import { RdfBuilder, rdfStoreAddQuad, rdfStoreSize } from "../Service/Rdf.ts";
import { Reasoner, ReasoningConfig } from "../Service/Reasoner.ts";
import { computeQuadDelta, summarizeDelta } from "../Utils/QuadDelta.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/InferenceRouter");

// =============================================================================
// Job Storage (in-memory for now, production would use Redis/Postgres)
// =============================================================================

const INFERENCE_JOB_CAPACITY = 256;

interface InferenceJobState {
  readonly order: ReadonlyArray<string>;
  readonly entries: HashMap.HashMap<string, InferenceRunResponse>;
}

/**
 * Scoped storage used by one inference-router runtime.
 *
 * **Example** (Put and get a processing job)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { InferenceRunResponse } from "@effect-ontology/Schema/Inference"
 * import { InferenceJobStore, InferenceJobStoreLive } from "@effect-ontology/Runtime/InferenceRouter"
 *
 * const jobId = Effect.runSync(
 *   Effect.gen(function* () {
 *     const store = yield* InferenceJobStore
 *     yield* store.put(InferenceRunResponse.make({ jobId: "infer-1", status: "processing" }))
 *     const found = yield* store.get("infer-1")
 *     return O.map(found, (value) => value.jobId)
 *   }).pipe(Effect.provide(InferenceJobStoreLive))
 * )
 * console.log(jobId)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InferenceJobStore extends Context.Service<
  InferenceJobStore,
  {
    readonly get: (jobId: string) => Effect.Effect<O.Option<InferenceRunResponse>>;
    readonly put: (response: InferenceRunResponse) => Effect.Effect<void>;
  }
>()($I`InferenceJobStore`) {}

/**
 * Ref-backed bounded inference-job storage isolated per layer instance.
 *
 * **Example** (Provide bounded in-memory job storage)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { InferenceRunResponse } from "@effect-ontology/Schema/Inference"
 * import { InferenceJobStore, InferenceJobStoreLive } from "@effect-ontology/Runtime/InferenceRouter"
 *
 * const status = Effect.runSync(
 *   Effect.gen(function* () {
 *     const store = yield* InferenceJobStore
 *     yield* store.put(InferenceRunResponse.make({ jobId: "infer-1", status: "complete" }))
 *     return O.map(yield* store.get("infer-1"), (value) => value.status)
 *   }).pipe(Effect.provide(InferenceJobStoreLive))
 * )
 * console.log(status)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const InferenceJobStoreLive = Layer.effect(
  InferenceJobStore,
  Effect.gen(function* () {
    const state = yield* Ref.make<InferenceJobState>({
      order: [],
      entries: HashMap.empty(),
    });
    const get = Effect.fn("InferenceJobStore.get")(function* (jobId: string) {
      return HashMap.get((yield* Ref.get(state)).entries, jobId);
    });
    const put = Effect.fn("InferenceJobStore.put")(function* (response: InferenceRunResponse) {
      yield* Ref.update(state, (current) => {
        const withoutCurrent = A.filter(current.order, (jobId) => jobId !== response.jobId);
        const nextOrder = A.append(withoutCurrent, response.jobId);
        const evicted = A.length(nextOrder) > INFERENCE_JOB_CAPACITY ? A.head(nextOrder) : O.none<string>();
        const order = O.match(evicted, {
          onNone: () => nextOrder,
          onSome: () => A.drop(nextOrder, 1),
        });
        const retainedEntries = O.match(evicted, {
          onNone: () => current.entries,
          onSome: (jobId) => HashMap.remove(current.entries, jobId),
        });
        const entries = HashMap.set(retainedEntries, response.jobId, response);
        return { order, entries };
      });
    });
    return InferenceJobStore.of({ get, put });
  })
);

const InferenceFailureStage = LiteralKit(["parse", "reason", "serialize", "statistics"]);

/**
 * Typed failure raised while executing an inference request.
 *
 * **Example** (Construct a parse-stage failure)
 *
 * ```ts
 * import { InferenceExecutionError } from "@effect-ontology/Runtime/InferenceRouter"
 *
 * const error = InferenceExecutionError.make({
 *   stage: "parse",
 *   message: "Turtle parse failed.",
 *   cause: new Error("unexpected token")
 * })
 * console.log(error.stage) // "parse"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class InferenceExecutionError extends S.TaggedError<InferenceExecutionError>($I`InferenceExecutionError`)(
  "InferenceExecutionError",
  {
    stage: InferenceFailureStage,
    message: S.NonEmptyString,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("InferenceExecutionError", {
    description: "Typed inference failure preserving its execution stage and underlying defect.",
  })
) {}

const generateJobId = Random.nextIntBetween(0, 0x7fffffff).pipe(Effect.map((value) => `infer-${value.toString(16)}`));

// =============================================================================
// Router Definition
// =============================================================================

/**
 * Inference API Router
 *
 * **Details**
 *
 * Endpoints:
 * - POST /v1/inference/run - Run RDFS reasoning on a graph
 * - GET /v1/inference/:id - Get inference job result
 *
 * **Example** (Name the inference run route)
 *
 * ```ts
 * import { InferenceRouter } from "@effect-ontology/Runtime/InferenceRouter"
 *
 * const documented = [InferenceRouter, "POST /v1/inference/run"] as const
 * console.log(documented[1]) // "POST /v1/inference/run"
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
const InferenceRouterDefinition = HttpRouter.addAll([
  HttpRouter.route(
    "POST",
    "/v1/inference/run",
    HttpServerRequest.schemaBodyJson(InferenceRunRequest).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          HttpServerResponse.json(
            {
              error: "VALIDATION_ERROR",
              message: Inspectable.toStringUnknown(error, 0),
            },
            { status: 400 }
          ),
        onSuccess: Effect.fnUntraced(
          function* (request) {
            const rdfBuilder = yield* RdfBuilder;
            const reasoner = yield* Reasoner;
            const jobStore = yield* InferenceJobStore;

            yield* Effect.logInfo("Inference API request received", {
              format: request.format,
              profile: request.profile,
              returnDeltaOnly: request.returnDeltaOnly,
              inputLength: request.inputGraph.length,
            });

            const startTime = yield* Clock.currentTimeMillis;

            // Parse input graph
            const originalStore = yield* rdfBuilder.parseTurtle(request.inputGraph).pipe(
              Effect.mapError((cause) =>
                InferenceExecutionError.make({
                  stage: "parse",
                  message: "Failed to parse the input graph.",
                  cause,
                })
              )
            );

            const originalCount = rdfStoreSize(originalStore);

            // Build reasoning config
            const config =
              request.profile === "custom"
                ? ReasoningConfig.custom(O.getOrElse(request.customRules, () => []))
                : ReasoningConfig.make({
                    profile: request.profile,
                  });

            // Apply reasoning (creates a copy)
            const { result: reasoningResult, store: enrichedStore } = yield* reasoner
              .reasonCopy(originalStore, config)
              .pipe(
                Effect.mapError((cause) =>
                  InferenceExecutionError.make({
                    stage: "reason",
                    message: "Failed to apply the configured reasoning profile.",
                    cause,
                  })
                )
              );

            // Compute delta if requested
            const delta = request.returnDeltaOnly ? yield* computeQuadDelta(originalStore, enrichedStore) : null;

            // Serialize output
            let outputGraph: string;
            if (request.returnDeltaOnly && P.isNotNull(delta)) {
              const deltaStore = yield* rdfBuilder.createStore;
              for (const quad of delta.newQuads) {
                rdfStoreAddQuad(deltaStore, quad);
              }
              outputGraph = yield* rdfBuilder.toTurtle(deltaStore).pipe(
                Effect.mapError((cause) =>
                  InferenceExecutionError.make({
                    stage: "serialize",
                    message: "Failed to serialize the inferred graph delta.",
                    cause,
                  })
                )
              );
            } else {
              outputGraph = yield* rdfBuilder.toTurtle(enrichedStore).pipe(
                Effect.mapError((cause) =>
                  InferenceExecutionError.make({
                    stage: "serialize",
                    message: "Failed to serialize the inferred graph.",
                    cause,
                  })
                )
              );
            }

            const durationMs = (yield* Clock.currentTimeMillis) - startTime;

            // Build stats
            const stats: InferenceStats = yield* InferenceStats.decodeEffect(
              P.isNotNull(delta)
                ? { ...summarizeDelta(delta), durationMs }
                : {
                    originalTriples: originalCount,
                    enrichedTriples: reasoningResult.totalTripleCount,
                    inferredTriples: reasoningResult.inferredTripleCount,
                    inferenceRatio: originalCount > 0 ? reasoningResult.inferredTripleCount / originalCount : 0,
                    predicateBreakdown: {},
                    durationMs,
                  }
            ).pipe(
              Effect.mapError((cause) =>
                InferenceExecutionError.make({
                  stage: "statistics",
                  message: "Failed to validate inference statistics.",
                  cause,
                })
              )
            );

            const jobId = yield* generateJobId;
            const response = InferenceRunResponse.make({
              jobId,
              status: "complete",
              outputGraph: O.some(outputGraph),
              stats: O.some(stats),
            });

            // Store for later retrieval
            yield* jobStore.put(response);

            yield* Effect.logInfo("Inference complete", {
              jobId,
              inferredTriples: stats.inferredTriples,
              durationMs,
            });

            return yield* HttpServerResponse.schemaJson(InferenceRunResponse)(response);
          },
          Effect.catchTag(
            "InferenceExecutionError",
            Effect.fnUntraced(function* (error) {
              yield* Effect.logError("Inference failed", { error });

              const jobStore = yield* InferenceJobStore;
              const jobId = yield* generateJobId;
              const response = InferenceRunResponse.make({
                jobId,
                status: "failed",
                error: O.some(error.message),
              });

              yield* jobStore.put(response);

              return yield* HttpServerResponse.schemaJson(InferenceRunResponse)(response);
            })
          )
        ),
      })
    )
  ),
  HttpRouter.route(
    "GET",
    "/v1/inference/:id",
    Effect.gen(function* () {
      const jobStore = yield* InferenceJobStore;
      const { id } = yield* HttpRouter.params;

      if (P.isUndefined(id)) {
        return yield* HttpServerResponse.json(
          { error: "INVALID_PATH", message: "Inference job id is required" },
          { status: 400 }
        );
      }

      const result = yield* jobStore.get(id);

      if (O.isNone(result)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Inference job ${id} not found`,
          },
          { status: 404 }
        );
      }

      return yield* HttpServerResponse.schemaJson(InferenceStatusResponse)(
        InferenceStatusResponse.make({
          jobId: id,
          status: result.value.status,
          result,
        })
      );
    })
  ),
]);

/**
 * Inference router with runtime-local bounded job storage.
 *
 * **Example** (Export the inference HTTP surface)
 *
 * ```ts
 * import { InferenceRouter } from "@effect-ontology/Runtime/InferenceRouter"
 *
 * const documented = [InferenceRouter, "GET /v1/inference/:id"] as const
 * console.log(documented[1]) // "GET /v1/inference/:id"
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
export const InferenceRouter = InferenceRouterDefinition;
