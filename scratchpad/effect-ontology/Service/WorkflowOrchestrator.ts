/**
 * Workflow Orchestrator Service
 *
 * Provides a high-level API for executing batch extraction workflows
 * with durable persistence via @effect/workflow's WorkflowEngine.
 *
 * Architecture:
 * - Uses Workflow.make for workflow definition with typed payload/success/error schemas
 * - Durable activities are journaled for crash recovery
 * - ClusterWorkflowEngine provides PostgreSQL-backed persistence
 * - Supports both synchronous (blocking) and fire-and-forget execution
 *
 * @since 2.0.0
 * @module Service/WorkflowOrchestrator
 */

import {$ScratchpadId} from "@beep/identity";
import {NonNegativeInt} from "@beep/schema/Int";
import {
  Cause,
  Context,
  DateTime,
  Effect,
  Exit,
  Hash,
  Layer,
  Match,
  Order,
  Ref,
  Schedule,
} from "effect";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {Workflow, WorkflowEngine} from "effect/unstable/workflow";
import {
  WorkflowError,
  WorkflowNotFoundError,
  WorkflowSuspendedError
} from "../Domain/Error/Workflow.ts";
import type {BatchId, DocumentId, GcsUri} from "../Domain/Identity.ts";
import type {DocumentStatus} from "../Domain/Model/BatchWorkflow.ts";
import {BatchState} from "../Domain/Model/BatchWorkflow.ts";
import {BatchManifest, BatchWorkflowPayload} from "../Domain/Schema/Batch.ts";
import {EnrichedManifest} from "../Domain/Schema/DocumentMetadata.ts";
import {
  makeClaimPersistenceActivity,
  makeCrossBatchResolutionActivity,
  makeInferenceActivity,
  makeIngestionActivity,
  makePreprocessingActivity,
  makeResolutionActivity,
  makeValidationActivity,
} from "../Workflow/DurableActivities.ts";
import {
  makeStreamingExtractionActivity
} from "../Workflow/StreamingExtractionActivity.ts";
import {getBatchStateFromStore, publishState} from "./BatchState.ts";
import {ConfigService} from "./Config.ts";
import {EventBusService} from "./EventBus.ts";
import {StorageService} from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/WorkflowOrchestrator");

/**
 * Serialize an error to a human-readable string
 *
 * Handles:
 * - Standard Error instances (uses message)
 * - Schema ParseError (uses _message property)
 * - Effect Cause objects (uses pretty format)
 * - Objects with message property
 * - Falls back to Schema JSON encoding for other objects
 */
const encodeUnknownJson = S.encodeSync(S.fromJsonString(S.Unknown));

const serializeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  // Schema ParseError has _message property
  if (typeof error === "object" && error !== null) {
    if ("_message" in error && typeof (error as {
      _message: unknown
    })._message === "string") {
      return (error as { _message: string })._message;
    }
    if ("message" in error && typeof (error as {
      message: unknown
    }).message === "string") {
      return (error as { message: string }).message;
    }
    // Try Schema JSON encoding for other objects
    try {
      return encodeUnknownJson(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

/**
 * Extract filename from a path (local or GCS URI)
 */
const extractFilename = (path: string): string => {
  if (Str.startsWith("gs://")(path)) {
    const parts = Str.split("/")(path);
    return parts[parts.length - 1];
  }
  const parts = Str.split("/")(path);
  return parts[parts.length - 1];
};

/**
 * Validate that manifest ontologyUri is consistent with config.
 */
const validateOntologyConsistency = Effect.fn("validateOntologyConsistency")(function* (
  manifestOntologyUri: string,
  configOntologyPath: string,
  strictValidation: boolean,
  batchId: string
) {
  const manifestFilename = extractFilename(manifestOntologyUri);
  const configFilename = extractFilename(configOntologyPath);
  if (manifestFilename !== configFilename) {
    const message =
      `Ontology mismatch: manifest uses "${manifestOntologyUri}" but extraction uses "${configOntologyPath}". ` +
      `Extraction will use the configured ontology, not the manifest ontology.`;
    if (strictValidation) {
      yield* Effect.logError("Ontology validation failed (strict mode)", {
        batchId,
        manifestOntologyUri,
        configOntologyPath,
      });
      return yield* Effect.fail(
        `Ontology mismatch: extraction uses "${configOntologyPath}" but manifest specifies "${manifestOntologyUri}".`
      );
    }
    yield* Effect.logWarning(message, {
      batchId,
      manifestOntologyUri,
      configOntologyPath
    });
  }
});

type BatchWorkflowPayloadType = BatchWorkflowPayload;
type PipelineStage =
  "pending"
  | "preprocessing"
  | "extracting"
  | "resolving"
  | "validating"
  | "ingesting";

// -----------------------------------------------------------------------------
// Workflow Definition
// -----------------------------------------------------------------------------

/**
 * Batch Extraction Workflow
 *
 * Orchestrates the 5-stage pipeline:
 * 1. Preprocessing: Classify documents, compute metadata, determine chunking strategies
 * 2. Extraction: Extract entities/relations from each document
 * 3. Resolution: Merge graphs and resolve entity references
 * 4. Validation: Validate against SHACL shapes (optional)
 * 5. Ingestion: Write to canonical store
 *
 * The workflow is durable - if it crashes, it will resume from the last
 * completed activity on restart. Preprocessing has graceful fallback -
 * if classification fails, the workflow continues with default metadata.
 */
export const BatchExtractionWorkflow = Workflow.make("batch-extraction", {
  payload: BatchWorkflowPayload,
  success: BatchState,
  error: S.String,
  idempotencyKey: (payload: BatchWorkflowPayloadType) => {
    const hash = Hash.string(
      encodeUnknownJson({
        ontologyVersion: payload.ontologyVersion,
        ontologyUri: payload.ontologyUri,
        targetNamespace: payload.targetNamespace,
        shaclUri: payload.shaclUri,
        documentIds: A.sort(payload.documentIds, Order.String),
      })
    );

    return `${payload.batchId}-${Math.abs(hash).toString(16).slice(0, 8)}`;
  },
  annotations: Context.make(Workflow.SuspendOnFailure, true).pipe(Context.add(Workflow.CaptureDefects, true)),
  suspendedRetrySchedule: Schedule.max([Schedule.exponential("1 second"), Schedule.recurs(5)]).pipe(Schedule.jittered),
});

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

const stripGsPrefix = (uri: string): string => (Str.startsWith("gs://")(uri) ? Str.replace(/^gs:\/\/[^/]+\//, "")(uri) : uri);

const parseManifest = S.decodeEffect(S.fromJsonString(BatchManifest));

const expectValue = <A>(opt: O.Option<A>, key: string) =>
  O.match(opt, {
    onNone: () => Effect.fail(WorkflowError.make({message: `Missing object at ${key}`})),
    onSome: (value) => Effect.succeed(value),
  });

const stageFromState = (state: BatchState): PipelineStage =>
  Match.value(state).pipe(
    Match.tag("Pending", () => "pending" as const),
    Match.tag("Preprocessing", () => "preprocessing" as const),
    Match.tag("Extracting", () => "extracting" as const),
    Match.tag("Resolving", () => "resolving" as const),
    Match.tag("Validating", () => "validating" as const),
    Match.tag("Ingesting", () => "ingesting" as const),
    Match.tag("Complete", () => "ingesting" as const),
    Match.tag("Failed", (s) => s.failedInStage),
    Match.exhaustive
  );

const toFailedState = (state: BatchState, cause: Cause.Cause<unknown>): BatchState => {
  if (P.isTagged(state, "Failed")) {
    return state;
  }

  const failedAt = DateTime.nowUnsafe();
  const failedStage = stageFromState(state);

  return BatchState.cases.Failed.make({
    batchId: state.batchId,
    ontologyId: state.ontologyId,
    manifestUri: state.manifestUri,
    ontologyVersion: state.ontologyVersion,
    createdAt: state.createdAt,
    updatedAt: failedAt,
    failedAt,
    failedInStage: failedStage,
    error: {
      code: "WORKFLOW_FAILED",
      message: Cause.pretty(cause),
      cause: O.some(Cause.squash(cause)),
    },
    lastSuccessfulStage: O.fromNullishOr(state._tag === "Pending" ? undefined : failedStage),
  });
};

export const handleWorkflowResult = Effect.fn("WorkflowOrchestrator.handleWorkflowResult")(function* <A, E>(
  executionId: string,
  result: Workflow.Result<A, E>
): Effect.fn.Return<A, E | WorkflowError | WorkflowSuspendedError> {
  return yield* Match.value(result).pipe(
    Match.tag("Complete", (complete) =>
      Exit.match(complete.exit, {
        onSuccess: Effect.succeed,
        onFailure: Effect.failCause,
      })
    ),
    Match.tag("Suspended", (suspended) =>
      Effect.fail(
        WorkflowSuspendedError.make({
          message: `Workflow ${executionId} suspended`,
          cause: O.map(O.fromNullishOr(suspended.cause), Cause.pretty),
          isResumable: true,
        })
      )
    ),
    Match.exhaustive
  );
});

export const pollToBatchState = Effect.fn("WorkflowOrchestrator.pollToBatchState")(function* (executionId: string) {
  const engine = yield* WorkflowEngine.WorkflowEngine;
  const result = yield* engine.poll(BatchExtractionWorkflow, executionId);

  if (O.isNone(result)) {
    const stored = yield* getBatchStateFromStore(executionId as BatchId);
    return yield* O.match(stored, {
      onSome: Effect.succeed,
      onNone: () =>
        WorkflowNotFoundError.make({
          message: `Workflow ${executionId} not found`,
          executionId,
        }),
    });
  }

  return yield* Match.value(result.value).pipe(
    Match.tag("Complete", (complete) =>
      Exit.match(complete.exit, {
        onSuccess: Effect.succeed,
        onFailure: Effect.fn("WorkflowOrchestrator.pollToBatchState.onFailure")(function* (cause: Cause.Cause<string>) {
          const stored = yield* getBatchStateFromStore(executionId as BatchId);
          const fallback = O.getOrUndefined(stored);
          if (P.isNotUndefined(fallback)) {
            return toFailedState(fallback, cause);
          }
          return yield* WorkflowError.make({
            message: `Workflow ${executionId} failed`,
            cause: O.some(Cause.squash(cause)),
          });
        }),
      })
    ),
    Match.tag("Suspended", (suspended) =>
      WorkflowSuspendedError.make({
        message: `Workflow ${executionId} suspended`,
        cause: O.map(O.fromNullishOr(suspended.cause), Cause.pretty),
        isResumable: true,
      })
    ),
    Match.exhaustive
  );
});

// -----------------------------------------------------------------------------
// Workflow Implementation Layer
// -----------------------------------------------------------------------------

/**
 * Layer that registers the batch extraction workflow with WorkflowEngine
 */
export const BatchExtractionWorkflowLayer = BatchExtractionWorkflow.toLayer((payload) =>
  Effect.gen(function* () {
    const {batchId, manifestUri, ontologyVersion} = payload;
    const storage = yield* StorageService;
    const config = yield* ConfigService;
    const eventBus = yield* EventBusService;
    const workflowStart = yield* DateTime.now;
    const progressRef = yield* Ref.make(0);
    let currentStage: PipelineStage = "pending";
    let lastSuccessfulStage: PipelineStage | undefined;

    const manifestKey = stripGsPrefix(manifestUri);
    const manifestRaw = yield* storage
      .get(manifestKey)
      .pipe(Effect.flatMap((opt) => expectValue(O.fromNullishOr(opt), manifestKey)));
    const manifest = yield* parseManifest(manifestRaw);

    // Validate ontology consistency between manifest and config
    yield* validateOntologyConsistency(
      manifest.ontologyUri,
      config.ontology.path,
      config.ontology.strictValidation,
      batchId
    );

    const emitState = Effect.fn("emitState")(
      function* (state: BatchState) {
        const existing = yield* getBatchStateFromStore(batchId);
        const shouldPublish = O.match(existing, {
          onNone: () => true,
          onSome: (e) => DateTime.isGreaterThan(state.updatedAt, e.updatedAt),
        });
        if (shouldPublish) {
          yield* publishState(state);
        } else {
          yield* Effect.logDebug("Skipping state publish (not newer)", {
            batchId,
            existingUpdatedAt: O.map(existing, (e) => e.updatedAt),
            newUpdatedAt: state.updatedAt,
          });
        }
      },
      Effect.catch((error) => Effect.logWarning("Failed to publish batch state", {
        batchId,
        error
      }))
    );

    const runWorkflow = Effect.gen(function* () {
      const pendingState = BatchState.cases.Pending.make({
        batchId,
        ontologyId: manifest.ontologyId,
        manifestUri,
        ontologyVersion,
        createdAt: workflowStart,
        updatedAt: workflowStart,
        documentCount: NonNegativeInt.make(A.length(manifest.documents)),
      });
      yield* emitState(pendingState);

      // -------------------------------------------------------------------------
      // Stage 1: Preprocessing (document classification and metadata enrichment)
      // -------------------------------------------------------------------------
      yield* Effect.logInfo("Starting preprocessing stage", {
        batchId,
        documentCount: manifest.documents.length,
      });

      currentStage = "preprocessing";

      const preprocessingState = BatchState.cases.Preprocessing.make({
        batchId,
        ontologyId: manifest.ontologyId,
        manifestUri,
        ontologyVersion,
        createdAt: workflowStart,
        updatedAt: yield* DateTime.now,
        documentsTotal: NonNegativeInt.make(manifest.documents.length),
        documentsClassified: NonNegativeInt.make(0),
        documentsFailed: NonNegativeInt.make(0),
        enrichedManifestUri: O.none(),
      });
      yield* emitState(preprocessingState);

      // Run preprocessing activity with graceful fallback
      // Skip entirely if preprocessing.enabled is false
      const preprocessingEnabled = payload.preprocessing.enabled;
      const preprocessingResult = yield* (
        preprocessingEnabled
          ? makePreprocessingActivity({
            batchId,
            manifestUri,
            preprocessing: payload.preprocessing,
          }).execute
          : Effect.succeed({
            enrichedManifestUri: manifestUri as GcsUri,
            totalDocuments: manifest.documents.length,
            classifiedCount: 0,
            failedCount: 0,
            totalEstimatedTokens: 0,
            averageComplexity: 0.5,
            durationMs: 0,
          })
      ).pipe(
        Effect.tap(
          Effect.fn(function* (result) {
            const updatedPreprocessingState = BatchState.cases.Preprocessing.make({
              batchId,
              ontologyId: manifest.ontologyId,
              manifestUri,
              ontologyVersion,
              createdAt: workflowStart,
              updatedAt: yield* DateTime.now,
              documentsTotal: NonNegativeInt.make(result.totalDocuments),
              documentsClassified: NonNegativeInt.make(result.classifiedCount),
              documentsFailed: NonNegativeInt.make(result.failedCount),
              enrichedManifestUri: O.some(result.enrichedManifestUri),
            });
            yield* emitState(updatedPreprocessingState);
          })
        ),
        // Graceful fallback: if preprocessing fails, continue with original manifest
        Effect.catch(
          Effect.fnUntraced(function* (error) {
            yield* Effect.logWarning("Preprocessing failed, continuing with original manifest", {
              batchId,
              error: String(error),
            });
            return {
              enrichedManifestUri: manifestUri as GcsUri,
              totalDocuments: manifest.documents.length,
              classifiedCount: 0,
              failedCount: 0,
              totalEstimatedTokens: 0,
              averageComplexity: 0.5,
              durationMs: 0,
            };
          })
        )
      );

      lastSuccessfulStage = "preprocessing";

      yield* Effect.logInfo("Preprocessing complete", {
        batchId,
        classifiedCount: preprocessingResult.classifiedCount,
        failedCount: preprocessingResult.failedCount,
        enrichedManifestUri: preprocessingResult.enrichedManifestUri,
      });

      // -------------------------------------------------------------------------
      // Stage 2: Extraction (extract entities/relations from each document)
      // -------------------------------------------------------------------------

      // Load enriched manifest to get DocumentMetadata with provenance fields
      const enrichedManifestKey = stripGsPrefix(preprocessingResult.enrichedManifestUri);
      const enrichedManifestRaw = yield* storage.get(enrichedManifestKey).pipe(
        Effect.flatMap((opt) => expectValue(O.fromNullishOr(opt), enrichedManifestKey)),
        Effect.catch(
          Effect.fn(function* (error) {
            yield* Effect.logWarning("Failed to load enriched manifest, falling back to basic manifest", {
              batchId,
              enrichedManifestUri: preprocessingResult.enrichedManifestUri,
              error: String(error),
            });
            // Return null to signal fallback
            return null as string | null;
          })
        )
      );

      // Parse enriched manifest or use basic manifest as fallback
      const enrichedManifest = P.isNotNull(enrichedManifestRaw)
        ? yield* EnrichedManifest.decodeFromString(enrichedManifestRaw)
        : null;

      yield* Effect.logInfo("Starting extraction stage", {
        batchId,
        documentCount: manifest.documents.length,
        usingEnrichedManifest: enrichedManifest !== null,
      });

      currentStage = "extracting";

      // Initialize document status tracking for partial failure visibility
      const documentStatusesRef = yield* Ref.make<Array<DocumentStatus>>(
        A.map(manifest.documents, (doc) => ({
          documentId: doc.documentId as DocumentId,
          status: "pending" as const,
        }))
      );

      // Reset progress counter for extraction stage
      yield* Ref.set(progressRef, 0);

      // Process documents with per-document error handling
      // Continues processing remaining documents even when some fail
      const extractionResults = yield* Effect.forEach(
        manifest.documents,
        Effect.fn(function* (doc) {
          const startedAt = yield* DateTime.now;

          // Mark document as processing
          yield* Ref.update(documentStatusesRef, (statuses) =>
            A.map(statuses, (s) =>
              s.documentId === doc.documentId
                ? {
                  documentId: s.documentId,
                  status: "processing" as const,
                  startedAt
                }
                : s
            )
          );

          // Look up DocumentMetadata from enriched manifest if available
          const docMetadata = enrichedManifest?.documents.find((d) => d.documentId === doc.documentId);

          // Execute extraction with error handling per document
          const result = yield* makeStreamingExtractionActivity({
            batchId,
            documentId: doc.documentId,
            sourceUri: doc.sourceUri,
            ontologyUri: manifest.ontologyUri,
            ontologyId: manifest.ontologyId,
            targetNamespace: manifest.targetNamespace,
            ontologyEmbeddingsUri: payload.ontologyEmbeddingsUri,
            eventTime: O.flatMap(O.fromNullishOr(docMetadata), (metadata) => metadata.eventTime),
            publishedAt: O.flatMap(O.fromNullishOr(docMetadata), (metadata) => metadata.publishedAt),
            title: O.flatMap(O.fromNullishOr(docMetadata), (metadata) => metadata.title),
            language: O.map(O.fromNullishOr(docMetadata), (metadata) => metadata.language),
          }).execute.pipe(
            Effect.map((output) => ({
              success: true as const,
              output,
              documentId: doc.documentId
            })),
            Effect.catch(
              Effect.fn(function* (error) {
                const completedAt = yield* DateTime.now;
                const errorMessage = serializeError(error);

                yield* Effect.logWarning("Document extraction failed", {
                  batchId,
                  documentId: doc.documentId,
                  error: errorMessage,
                });

                // Mark document as failed with error details
                yield* Ref.update(documentStatusesRef, (statuses) =>
                  A.map(statuses, (s) =>
                    s.documentId === doc.documentId
                      ? {
                        documentId: s.documentId,
                        status: "failed" as const,
                        startedAt: O.some(startedAt),
                        completedAt,
                        error: {
                          code: "EXTRACTION_FAILED",
                          message: errorMessage
                        },
                      }
                      : s
                  )
                );

                return {
                  success: false as const,
                  documentId: doc.documentId,
                  error: errorMessage
                };
              })
            )
          );

          // Update progress and document status for successful extraction
          if (result.success) {
            const completedAt = yield* DateTime.now;
            yield* Ref.update(documentStatusesRef, (statuses) =>
              A.map(statuses, (s) =>
                s.documentId === doc.documentId
                  ? {
                    documentId: s.documentId,
                    status: "success" as const,
                    startedAt,
                    completedAt,
                    graphUri: result.output.graphUri as GcsUri,
                    entityCount: NonNegativeInt.make(result.output.entityCount),
                    relationCount: NonNegativeInt.make(result.output.relationCount),
                    claimCount: NonNegativeInt.make(result.output.claimCount),
                  }
                  : s
              )
            );
          }

          // Update batch state with current progress
          const currentStatuses = yield* Ref.get(documentStatusesRef);
          const successCount = A.length(A.filter(currentStatuses, (s) => s.status === "success"));
          const failedCount = A.length(A.filter(currentStatuses, (s) => s.status === "failed"));

          const extractingState = BatchState.cases.Extracting.make({
            batchId,
            ontologyId: manifest.ontologyId,
            manifestUri,
            ontologyVersion,
            createdAt: workflowStart,
            updatedAt: yield* DateTime.now,
            documentsTotal: NonNegativeInt.make(manifest.documents.length),
            documentsCompleted: NonNegativeInt.make(successCount),
            documentsFailed: NonNegativeInt.make(failedCount),
            currentDocumentId: O.some(doc.documentId),
            documentStatuses: currentStatuses,
          });
          yield* emitState(extractingState);

          return result;
        }),
        {concurrency: 5}
      );

      // Separate successful and failed results
      const successfulResults = A.flatMap(extractionResults, (r) => (r.success ? [r.output] : []));
      const failedResults = A.flatMap(extractionResults, (r) =>
        !r.success ? [{documentId: r.documentId, error: r.error}] : []
      );

      // Store for use in Complete state
      const _documentStatuses = yield* Ref.get(documentStatusesRef);

      yield* Effect.logInfo("Extraction stage complete", {
        batchId,
        documentsSucceeded: successfulResults.length,
        documentsFailed: failedResults.length,
        failedDocumentIds: failedResults.map((r) => r.documentId),
      });

      // If ALL documents failed, fail the entire batch
      if (!A.isReadonlyArrayNonEmpty(successfulResults)) {
        return yield* Effect.fail(
          `All ${failedResults.length} documents failed extraction. ` +
          `First error: ${failedResults[0]?.error ?? "unknown"}`
        );
      }

      // Continue with successful documents (partial success)
      lastSuccessfulStage = "extracting";

      currentStage = "resolving";

      const resolvingState = BatchState.cases.Resolving.make({
        batchId,
        ontologyId: manifest.ontologyId,
        manifestUri,
        ontologyVersion,
        createdAt: workflowStart,
        updatedAt: yield* DateTime.now,
        extractionOutputUri: successfulResults[0]?.graphUri ?? manifestUri,
        entitiesTotal: NonNegativeInt.make(0),
        clustersFormed: NonNegativeInt.make(0),
      });
      yield* emitState(resolvingState);

      const resolutionResult = yield* makeResolutionActivity({
        batchId,
        documentGraphUris: A.map(successfulResults, (r) => r.graphUri),
      }).execute;

      lastSuccessfulStage = "resolving";

      yield* Effect.logInfo("Resolution complete", {
        batchId,
        entitiesResolved: resolutionResult.entitiesTotal,
      });

      // Cross-batch entity resolution (optional - requires Postgres + pgvector)
      // Links entities to persistent canonical registry across extraction batches
      const crossBatchResult = yield* makeCrossBatchResolutionActivity({
        batchId,
        resolvedGraphUri: resolutionResult.resolvedUri,
        enabled: config.entityRegistry.enabled,
        ontologyId: manifest.ontologyId,
      }).execute;

      if (config.entityRegistry.enabled) {
        yield* Effect.logInfo("Cross-batch resolution complete", {
          batchId,
          matchedToExisting: crossBatchResult.matchedToExisting,
          newCanonicals: crossBatchResult.newCanonicals,
          entitiesTotal: crossBatchResult.entitiesTotal,
        });
      } else {
        yield* Effect.logDebug("Cross-batch resolution skipped (not configured)", {batchId});
      }

      // RDFS Inference stage (optional)
      // Applies RDFS reasoning to generate new facts through forward-chaining inference
      const inferenceEnabled = config.inference.enabled;
      const inferenceResult = yield* makeInferenceActivity({
        batchId,
        resolvedGraphUri: resolutionResult.resolvedUri,
        profile: O.some(config.inference.profile),
        enabled: O.some(inferenceEnabled),
      }).execute;

      // Use enriched graph for validation if inference produced new triples
      const graphForValidation =
        inferenceResult.inferredTripleCount > 0 ? inferenceResult.enrichedGraphUri : resolutionResult.resolvedUri;

      if (inferenceEnabled) {
        yield* Effect.logInfo("Inference complete", {
          batchId,
          inferredTriples: inferenceResult.inferredTripleCount,
          totalTriples: inferenceResult.totalTripleCount,
          provenanceQuads: inferenceResult.provenanceQuadCount,
          rulesApplied: inferenceResult.rulesApplied,
        });
      } else {
        yield* Effect.logDebug("Inference skipped (not configured)", {batchId});
      }

      currentStage = "validating";
      const validatingState = BatchState.cases.Validating.make({
        batchId,
        ontologyId: manifest.ontologyId,
        manifestUri,
        ontologyVersion,
        createdAt: workflowStart,
        updatedAt: yield* DateTime.now,
        resolvedGraphUri: graphForValidation,
        validationStartedAt: yield* DateTime.now,
      });
      yield* emitState(validatingState);

      // Pass validation policy from manifest to activity
      // The activity's validateWithPolicy will fail with ValidationPolicyError if policy violated
      const validationResult = yield* makeValidationActivity({
        batchId,
        resolvedGraphUri: graphForValidation,
        ontologyUri: manifest.ontologyUri,
        shaclUri: manifest.shaclUri,
        validationPolicy: manifest.validationPolicy,
      }).execute;

      yield* Effect.logInfo("Validation complete", {
        batchId,
        conforms: validationResult.conforms,
        violations: validationResult.violations,
        policyApplied: manifest.validationPolicy ?? {
          failOnViolation: true,
          failOnWarning: false
        },
      });

      // Publish ValidationFailed event if there are violations
      if (!validationResult.conforms) {
        yield* eventBus
          .publishExtractionEvent("ValidationFailed", {
            batchId,
            validationId: `val-${batchId}-${yield* Clock.currentTimeMillis}`,
            ontologyId: manifest.ontologyId,
            errorCount: NonNegativeInt.make(validationResult.violations),
            warningCount: NonNegativeInt.make(0),
            reportUri: O.fromNullishOr(validationResult.reportUri),
            timestamp: yield* DateTime.now,
          })
          .pipe(
            Effect.catch((error) =>
              Effect.logWarning("Failed to publish ValidationFailed event", {
                batchId,
                error: String(error),
              })
            )
          );
      }

      // Note: Policy enforcement is handled by validateWithPolicy in the activity.
      // If failOnViolation=true (default) and violations exist, activity throws ValidationPolicyError.
      // If failOnViolation=false, we proceed to ingestion even with non-conformance.

      lastSuccessfulStage = "validating";

      // Persist validated claims to PostgreSQL
      yield* Effect.logInfo("Persisting validated claims to database", {batchId});

      const claimPersistenceResult = yield* makeClaimPersistenceActivity({
        batchId,
        ontologyId: manifest.ontologyId,
        documentGraphUris: A.map(successfulResults, (r) => r.graphUri),
        targetNamespace: manifest.targetNamespace,
        documentMetadata: O.some(
          A.map(manifest.documents, (doc) => ({
            documentId: doc.documentId,
            sourceUri: doc.sourceUri,
            eventTime: O.none(),
            headline: O.none(),
          }))
        ),
      }).execute;

      yield* Effect.logInfo("Claim persistence complete", {
        batchId,
        claimsPersisted: claimPersistenceResult.claimsPersisted,
        documentsProcessed: claimPersistenceResult.documentsProcessed,
        documentsFailed: claimPersistenceResult.documentsFailed,
      });

      yield* Effect.logInfo("Starting ingestion stage", {batchId});

      currentStage = "ingesting";

      const ingestingState = BatchState.cases.Ingesting.make({
        batchId,
        ontologyId: manifest.ontologyId,
        manifestUri,
        ontologyVersion,
        createdAt: workflowStart,
        updatedAt: yield* DateTime.now,
        validatedGraphUri: validationResult.validatedUri,
        triplesTotal: NonNegativeInt.make(0),
        triplesIngested: NonNegativeInt.make(0),
      });
      yield* emitState(ingestingState);

      const ingestionResult = yield* makeIngestionActivity({
        batchId,
        validatedGraphUri: validationResult.validatedUri,
        targetNamespace: manifest.targetNamespace,
      }).execute;

      lastSuccessfulStage = "ingesting";

      yield* Effect.logInfo("Ingestion complete", {
        batchId,
        triplesIngested: ingestionResult.triplesIngested,
      });

      const workflowEnd = yield* DateTime.now;

      const complete = BatchState.cases.Complete.make({
        batchId,
        ontologyId: manifest.ontologyId,
        manifestUri,
        ontologyVersion,
        createdAt: workflowStart,
        updatedAt: workflowEnd,
        canonicalGraphUri: ingestionResult.canonicalUri,
        stats: {
          documentsProcessed: NonNegativeInt.make(successfulResults.length),
          documentsSucceeded: NonNegativeInt.make(successfulResults.length),
          documentsFailed: NonNegativeInt.make(failedResults.length),
          entitiesExtracted: NonNegativeInt.make(successfulResults.reduce((sum, r) => sum + r.entityCount, 0)),
          relationsExtracted: NonNegativeInt.make(successfulResults.reduce((sum, r) => sum + r.relationCount, 0)),
          claimsExtracted: NonNegativeInt.make(successfulResults.reduce((sum, r) => sum + (r.claimCount ?? 0), 0)),
          clustersResolved: NonNegativeInt.make(resolutionResult.clustersFormed),
          triplesIngested: NonNegativeInt.make(ingestionResult.triplesIngested),
          totalDurationMs: DateTime.distance(workflowStart, workflowEnd),
        },
        documentStatuses: _documentStatuses,
        completedAt: workflowEnd,
      });

      yield* Effect.logInfo("Workflow complete", {
        batchId,
        stats: complete.stats,
      });

      yield* emitState(complete);

      // Publish extraction completed event via EventBusService
      yield* eventBus
        .publishExtractionEvent("ExtractionCompleted", {
          batchId,
          ontologyId: manifest.ontologyId,
          entityCount: complete.stats.entitiesExtracted,
          relationCount: complete.stats.relationsExtracted,
          tripleCount: complete.stats.triplesIngested,
          outputUri: O.fromNullishOr(complete.canonicalGraphUri),
          status: failedResults.length === 0 ? "success" : "partial",
          timestamp: yield* DateTime.now,
        })
        .pipe(
          Effect.catch((error) =>
            Effect.logWarning("Failed to publish ExtractionCompleted event", {
              batchId,
              error: String(error),
            })
          )
        );

      return complete;
    });

    return yield* Effect.catchCause(runWorkflow,
      Effect.fnUntraced(function* (cause) {
        const failedAt = yield* DateTime.now;
        const failedState = BatchState.cases.Failed.make({
          batchId,
          ontologyId: manifest.ontologyId,
          manifestUri,
          ontologyVersion,
          createdAt: workflowStart,
          updatedAt: failedAt,
          failedAt,
          failedInStage: currentStage,
          error: {
            code: "WORKFLOW_FAILED",
            message: Cause.pretty(cause),
            cause: O.some(Cause.squash(cause)),
          },
          lastSuccessfulStage: O.fromNullishOr(lastSuccessfulStage),
        });

        yield* emitState(failedState);

        return yield* Effect.fail(Cause.pretty(cause));
      })
    );
  }).pipe(Effect.mapError(String))
);

// -----------------------------------------------------------------------------
// WorkflowOrchestrator Service
// -----------------------------------------------------------------------------

/**
 * WorkflowOrchestrator Service Interface
 *
 * High-level API for batch workflow operations.
 */
export interface WorkflowOrchestratorMethods {
  /**
   * Start a new batch extraction workflow
   *
   * @param payload - Workflow payload containing batchId, manifestUri, ontologyVersion
   * @returns The execution ID (same as batchId for idempotency)
   */
  readonly start: (payload: BatchWorkflowPayloadType) => Effect.Effect<string, string>;

  /**
   * Start and wait for workflow completion
   *
   * @param payload - Workflow payload
   * @returns The final BatchState on success
   */
  readonly startAndWait: (payload: BatchWorkflowPayloadType) => Effect.Effect<BatchState, string>;

  /**
   * Poll for workflow result
   *
   * @param executionId - The workflow execution ID (batchId)
   * @returns The workflow result if complete, undefined if still running
   */
  readonly poll: (executionId: string) => Effect.Effect<O.Option<Workflow.Result<BatchState, string>>>;

  /**
   * Interrupt a running workflow
   *
   * @param executionId - The workflow execution ID
   */
  readonly interrupt: (executionId: string) => Effect.Effect<void>;

  /**
   * Resume a suspended workflow
   *
   * @param executionId - The workflow execution ID
   */
  readonly resume: (executionId: string) => Effect.Effect<void>;
}

export class WorkflowOrchestrator extends Context.Service<WorkflowOrchestrator, WorkflowOrchestratorMethods>()(
  $I`WorkflowOrchestrator`
) {
}

// -----------------------------------------------------------------------------
// WorkflowOrchestrator Implementation
// -----------------------------------------------------------------------------

/**
 * Create the WorkflowOrchestrator service
 *
 * Requires WorkflowEngine to be provided (via ClusterWorkflowEngine or memory layer)
 */
export const makeWorkflowOrchestrator = Effect.fn("WorkflowOrchestrator.make")(function* () {
  const engine = yield* WorkflowEngine.WorkflowEngine;

  return WorkflowOrchestrator.of({
    start: Effect.fn("WorkflowOrchestrator.start")(function* (payload) {
      return yield* BatchExtractionWorkflow.execute(payload, {
        discard: true,
      }).pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine));
    }),

    startAndWait: Effect.fn("WorkflowOrchestrator.startAndWait")(function* (payload) {
      return yield* BatchExtractionWorkflow.execute(payload, {
        discard: false,
      }).pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine));
    }),

    poll: Effect.fn("WorkflowOrchestrator.poll")((executionId) => engine.poll(BatchExtractionWorkflow, executionId)),

    interrupt: Effect.fn("WorkflowOrchestrator.interrupt")((executionId) =>
      engine.interrupt(BatchExtractionWorkflow, executionId)
    ),

    resume: Effect.fn("WorkflowOrchestrator.resume")((executionId) =>
      engine.resume(BatchExtractionWorkflow, executionId)
    ),
  });
});

// -----------------------------------------------------------------------------
// Layers
// -----------------------------------------------------------------------------

/**
 * WorkflowOrchestrator layer
 *
 * Requires:
 * - WorkflowEngine (from ClusterWorkflowEngine or memory)
 */
export const WorkflowOrchestratorLive = Layer.effect(WorkflowOrchestrator, makeWorkflowOrchestrator());

/**
 * Full workflow layer with orchestrator and workflow registration
 *
 * Requires:
 * - StorageService
 * - ConfigService
 * - RdfBuilder
 * - WorkflowEngine
 * - EntityExtractor (for Activities.ts extraction)
 * - RelationExtractor (for Activities.ts extraction)
 * - OntologyService (for Activities.ts ontology lookup)
 */
export const WorkflowOrchestratorFullLive = Layer.mergeAll(WorkflowOrchestratorLive, BatchExtractionWorkflowLayer);

export {BatchWorkflowPayload};
