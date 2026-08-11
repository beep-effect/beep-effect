/**
 * Router: Inference API
 *
 * HTTP endpoints for standalone RDFS reasoning on RDF graphs.
 * Provides synchronous inference with delta computation.
 *
 * @since 2.0.0
 * @module Runtime/InferenceRouter
 */
import * as S from "effect/Schema";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse
} from "effect/unstable/http";
import {Effect} from "effect";
import {
  InferenceRunRequest,
  InferenceRunResponse,
  type InferenceStats,
  InferenceStatusResponse
} from "../Domain/Schema/Inference.ts";
import {RdfBuilder} from "../Service/Rdf.ts";
import {Reasoner, ReasoningConfig} from "../Service/Reasoner.ts";
import {computeQuadDelta, summarizeDelta} from "../Utils/QuadDelta.ts";
import * as O from "effect/Option";

// =============================================================================
// Job Storage (in-memory for now, production would use Redis/Postgres)
// =============================================================================

const jobStore = new Map<string, InferenceRunResponse>();

const generateJobId = (): string => `infer-${crypto.randomUUID().slice(0, 8)}`;

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
 * @since 2.0.0
 * @category Routers
 */
export const InferenceRouter = HttpRouter.addAll([
  HttpRouter.route("POST",
    "/v1/inference/run",
    Effect.gen(function* () {
      return yield* HttpServerRequest.schemaBodyJson(InferenceRunRequest).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json(
              {
                error: "VALIDATION_ERROR",
                message: (error as S.SchemaError).toString()
              },
              {status: 400}
            ),
          onSuccess:
            Effect.fn(function* (request) {
              const rdfBuilder = yield* RdfBuilder;
              const reasoner = yield* Reasoner;

              yield* Effect.logInfo("Inference API request received", {
                format: request.format,
                profile: request.profile,
                returnDeltaOnly: request.returnDeltaOnly,
                inputLength: request.inputGraph.length
              });

              const startTime = Date.now();

              // Parse input graph
              const originalStore = yield* rdfBuilder.parseTurtle(request.inputGraph).pipe(
                Effect.mapError((e) => ({
                  _tag: "ParseError" as const,
                  message: `Failed to parse input graph: ${e.message}`
                }))
              );

              const originalCount = originalStore._store.size;

              // Build reasoning config
              const config = request.profile === "custom"
                ? ReasoningConfig.custom(request.customRules ?? [])
                : ReasoningConfig.make({
                  profile: request.profile as "rdfs" | "rdfs-subclass" | "owl-sameas"
                });

              // Apply reasoning (creates a copy)
              const {
                result: reasoningResult,
                store: enrichedStore
              } = yield* reasoner
                .reasonCopy(originalStore, config)
                .pipe(
                  Effect.mapError((e) => ({
                    _tag: "ReasoningError" as const,
                    message: e.message
                  }))
                );

              // Compute delta if requested
              const delta = request.returnDeltaOnly
                ? yield* computeQuadDelta(originalStore, enrichedStore)
                : null;

              // Serialize output
              const outputGraph = yield* Effect.gen(function* () {
                if (request.returnDeltaOnly && delta) {
                  // Create store with only new quads
                  const deltaStore = yield* rdfBuilder.createStore;
                  for (const quad of delta.newQuads) {
                    deltaStore._store.addQuad(quad);
                  }
                  return yield* rdfBuilder.toTurtle(deltaStore);
                }
                return yield* rdfBuilder.toTurtle(enrichedStore);
              });

              const durationMs = Date.now() - startTime;

              // Build stats
              const stats: InferenceStats = delta
                ? {
                  ...summarizeDelta(delta),
                  durationMs
                }
                : {
                  originalTriples: originalCount,
                  enrichedTriples: reasoningResult.totalTripleCount,
                  inferredTriples: reasoningResult.inferredTripleCount,
                  inferenceRatio: originalCount > 0 ? reasoningResult.inferredTripleCount / originalCount : 0,
                  predicateBreakdown: {},
                  durationMs
                };

              const jobId = generateJobId();
              const response = InferenceRunResponse.make({
                jobId,
                status: "complete",
                outputGraph: O.some(outputGraph),
                stats: O.some(stats)
              });

              // Store for later retrieval
              jobStore.set(jobId, response);

              yield* Effect.logInfo("Inference complete", {
                jobId,
                inferredTriples: stats.inferredTriples,
                durationMs
              });

              return yield* HttpServerResponse.schemaJson(InferenceRunResponse)(response);
            }, Effect.catch(
              Effect.fn(function* (error) {
                yield* Effect.logError("Inference failed", {error});

                const jobId = generateJobId();
                const response = InferenceRunResponse.make({
                  jobId,
                  status: "failed",
                  error: O.some("message" in error ? error.message : String(error))
                });

                jobStore.set(jobId, response);

                return yield* HttpServerResponse.schemaJson(InferenceRunResponse)(response);
              })
            ))
        })
      );
    })
  ),
  HttpRouter.route("GET",
    "/v1/inference/:id",
    Effect.gen(function* () {
      const {id} = yield* HttpRouter.params as Effect.Effect<{ id: string }>;

      const result = jobStore.get(id);

      if (!result) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Inference job ${id} not found`
          },
          {status: 404}
        );
      }

      return yield* HttpServerResponse.schemaJson(InferenceStatusResponse)(
        InferenceStatusResponse.make({
          jobId: id,
          status: result.status,
          result: O.some(result)
        })
      );
    })
  )
]);
