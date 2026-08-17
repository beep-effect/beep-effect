/**
 * Router: Inference API
 *
 * HTTP endpoints for standalone RDFS reasoning on RDF graphs.
 * Provides synchronous inference with delta computation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Random } from "effect";
import * as Clock from "effect/Clock";
import * as MutableHashMap from "effect/MutableHashMap";
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

// =============================================================================
// Job Storage (in-memory for now, production would use Redis/Postgres)
// =============================================================================

const jobStore = MutableHashMap.empty<string, InferenceRunResponse>();

const generateJobId = Random.nextInt.pipe(Effect.map((value) => `infer-${Math.abs(value).toString(16)}`));

// =============================================================================
// Router Definition
// =============================================================================

/**
 * Inference API Router
 *
 * Endpoints:
 * - POST /v1/inference/run - Run RDFS reasoning on a graph
 * - GET /v1/inference/:id - Get inference job result
 *
 * @since 0.0.0
 * @category endpoints
 */
export const InferenceRouter = HttpRouter.addAll([
  HttpRouter.route(
    "POST",
    "/v1/inference/run",
    HttpServerRequest.schemaBodyJson(InferenceRunRequest).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          HttpServerResponse.json(
            {
              error: "VALIDATION_ERROR",
              message: error.toString(),
            },
            { status: 400 }
          ),
        onSuccess: Effect.fn(
          function* (request) {
            const rdfBuilder = yield* RdfBuilder;
            const reasoner = yield* Reasoner;

            yield* Effect.logInfo("Inference API request received", {
              format: request.format,
              profile: request.profile,
              returnDeltaOnly: request.returnDeltaOnly,
              inputLength: request.inputGraph.length,
            });

            const startTime = yield* Clock.currentTimeMillis;

            // Parse input graph
            const originalStore = yield* rdfBuilder.parseTurtle(request.inputGraph).pipe(
              Effect.mapError((e) => ({
                _tag: "ParseError",
                message: `Failed to parse input graph: ${e.message}`,
              }))
            );

            const originalCount = rdfStoreSize(originalStore);

            // Build reasoning config
            const config =
              request.profile === "custom"
                ? ReasoningConfig.custom(O.getOrElse(request.customRules, () => []))
                : ReasoningConfig.make({
                    profile: request.profile as "rdfs" | "rdfs-subclass" | "owl-sameas",
                  });

            // Apply reasoning (creates a copy)
            const { result: reasoningResult, store: enrichedStore } = yield* reasoner
              .reasonCopy(originalStore, config)
              .pipe(
                Effect.mapError((e) => ({
                  _tag: "ReasoningError",
                  message: e.message,
                }))
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
              outputGraph = yield* rdfBuilder.toTurtle(deltaStore);
            } else {
              outputGraph = yield* rdfBuilder.toTurtle(enrichedStore);
            }

            const durationMs = (yield* Clock.currentTimeMillis) - startTime;

            // Build stats
            const stats: InferenceStats = yield* S.decodeEffect(InferenceStats)(
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
            ).pipe(Effect.orDie);

            const jobId = yield* generateJobId;
            const response = InferenceRunResponse.make({
              jobId,
              status: "complete",
              outputGraph: O.some(outputGraph),
              stats: O.some(stats),
            });

            // Store for later retrieval
            MutableHashMap.set(jobStore, jobId, response);

            yield* Effect.logInfo("Inference complete", {
              jobId,
              inferredTriples: stats.inferredTriples,
              durationMs,
            });

            return yield* HttpServerResponse.schemaJson(InferenceRunResponse)(response);
          },
          Effect.catch(
            Effect.fn(function* (error) {
              yield* Effect.logError("Inference failed", { error });

              const jobId = yield* generateJobId;
              const response = InferenceRunResponse.make({
                jobId,
                status: "failed",
                error: O.some("message" in error ? error.message : String(error)),
              });

              MutableHashMap.set(jobStore, jobId, response);

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
      const { id } = yield* HttpRouter.params;

      if (P.isUndefined(id)) {
        return yield* HttpServerResponse.json(
          { error: "INVALID_PATH", message: "Inference job id is required" },
          { status: 400 }
        );
      }

      const result = MutableHashMap.get(jobStore, id);

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
