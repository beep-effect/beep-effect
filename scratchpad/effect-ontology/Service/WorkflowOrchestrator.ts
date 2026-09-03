/**
 * Workflow Orchestrator Service
 *
 * **Details**
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
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { NonNegativeInt } from "@beep/schema/Int";
import { UnitInterval } from "@beep/schema/UnitInterval";
import {
  Cause,
  Clock,
  Context,
  DateTime,
  Effect,
  Exit,
  Hash,
  Inspectable,
  Layer,
  Match,
  Order,
  Ref,
  Schedule,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Workflow, WorkflowEngine } from "effect/unstable/workflow";
import {
  AnyWorkflowError,
  WorkflowError,
  WorkflowNotFoundError,
  WorkflowSuspendedError,
} from "../Domain/Error/Workflow.ts";
import { BatchId, DocumentId, GcsUri } from "../Domain/Identity.ts";
import type { DocumentStatus } from "../Domain/Model/BatchWorkflow.ts";
import { BatchState } from "../Domain/Model/BatchWorkflow.ts";
import { BatchManifest, BatchWorkflowPayload } from "../Domain/Schema/Batch.ts";
import { ChunkingParams, defaultChunkingParams, EnrichedManifest } from "../Domain/Schema/DocumentMetadata.ts";
import {
  makeClaimPersistenceActivity,
  makeCrossBatchResolutionActivity,
  makeInferenceActivity,
  makeIngestionActivity,
  makePreprocessingActivity,
  makeResolutionActivity,
  makeValidationActivity,
} from "../Workflow/DurableActivities.ts";
import { makeStreamingExtractionActivity } from "../Workflow/StreamingExtractionActivity.ts";
import { getBatchStateFromStore, publishState } from "./BatchState.ts";
import { ConfigService } from "./Config.ts";
import { EventBusService } from "./EventBus.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/WorkflowOrchestrator");

/**
 * Serialize an error to a human-readable string
 *
 * Handles:
 * - Standard Error instances (uses message)
 * - Schema ParseError (uses _message property)
 * - Effect Cause objects (uses pretty format)
 * - Objects with message property
 * - Falls back to Effect's unknown-value inspection for other objects
 */
const serializeError = (error: unknown): string => {
  if (P.isError(error)) {
    return error.message;
  }
  // Schema ParseError has _message property
  if (P.isObject(error)) {
    if (P.hasProperty(error, "_message") && P.isString(error._message)) {
      return error._message;
    }
    if (P.hasProperty(error, "message") && P.isString(error.message)) {
      return error.message;
    }
  }
  return Inspectable.toStringUnknown(error);
};

const isWorkflowError = S.is(WorkflowError);

const toWorkflowError = (error: unknown): WorkflowError =>
  isWorkflowError(error)
    ? error
    : WorkflowError.make({
        message: serializeError(error),
        cause: O.some(error),
      });

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
      configOntologyPath,
    });
  }
});

type BatchWorkflowPayloadType = BatchWorkflowPayload;
const PipelineStage = LiteralKit([
  "pending",
  "preprocessing",
  "extracting",
  "resolving",
  "validating",
  "ingesting",
]).pipe(
  $I.annoteSchema("PipelineStage", {
    description: "Durable batch extraction stages reported while polling a workflow.",
  })
);
type PipelineStage = typeof PipelineStage.Type;

// -----------------------------------------------------------------------------
// Workflow Definition
// -----------------------------------------------------------------------------

/**
 * Batch Extraction Workflow
 *
 * **Details**
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
 *
 * **Gotchas**
 *
 * SHACL policy enforcement is fail-closed: `failOnViolation` defaults to
 * `true`, so non-conforming graphs fail the workflow with
 * `ValidationPolicyError` instead of continuing to ingestion.
 *
 * **Example** (Compose a start call)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WorkflowOrchestrator, WorkflowOrchestratorLive } from "@effect-ontology/Service/WorkflowOrchestrator"
 *
 * const program = Effect.gen(function* () {
 *   const orchestrator = yield* WorkflowOrchestrator
 *   return orchestrator.poll
 * }).pipe(Effect.provide(WorkflowOrchestratorLive))
 *
 * console.log(program)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BatchExtractionWorkflow: Workflow.Workflow<
  "batch-extraction",
  typeof BatchWorkflowPayload,
  typeof BatchState,
  typeof AnyWorkflowError
> = Workflow.make("batch-extraction", {
  payload: BatchWorkflowPayload,
  success: BatchState,
  error: AnyWorkflowError,
  idempotencyKey: (payload: BatchWorkflowPayloadType) => {
    const hash = Hash.string(
      Inspectable.toStringUnknown({
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

const stripGsPrefix = (uri: string): string =>
  Str.startsWith("gs://")(uri) ? Str.replace(/^gs:\/\/[^/]+\//, "")(uri) : uri;

const parseManifest = S.decodeEffect(S.fromJsonString(BatchManifest));

const expectValue = <A>(opt: O.Option<A>, key: string) =>
  Effect.fromOption(opt, () => WorkflowError.make({ message: `Missing object at ${key}` }));

const stageFromState = Match.type<BatchState>().pipe(
  Match.tag("Pending", (): PipelineStage => "pending"),
  Match.tag("Preprocessing", (): PipelineStage => "preprocessing"),
  Match.tag("Extracting", (): PipelineStage => "extracting"),
  Match.tag("Resolving", (): PipelineStage => "resolving"),
  Match.tag("Validating", (): PipelineStage => "validating"),
  Match.tag("Ingesting", (): PipelineStage => "ingesting"),
  Match.tag("Complete", (): PipelineStage => "ingesting"),
  Match.tag("Failed", (s) => s.failedInStage),
  Match.exhaustive
);

const toFailedState = (state: BatchState, cause: Cause.Cause<unknown>, failedAt: DateTime.Utc): BatchState => {
  if (P.isTagged(state, "Failed")) {
    return state;
  }

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

type PollContext = {
  readonly batchId: BatchId;
  readonly executionId: string;
};

const pollResultToBatchState = Match.type<Workflow.Result<BatchState, AnyWorkflowError>>().pipe(
  Match.tag(
    "Complete",
    (complete) => (context: PollContext) =>
      Exit.match(complete.exit, {
        onSuccess: Effect.succeed,
        onFailure: Effect.fn("WorkflowOrchestrator.pollToBatchState.onFailure")(function* (cause) {
          const stored = yield* getBatchStateFromStore(context.batchId);
          const fallback = O.getOrUndefined(stored);
          if (P.isNotUndefined(fallback)) {
            return toFailedState(fallback, cause, yield* DateTime.now);
          }
          return yield* WorkflowError.make({
            message: `Workflow ${context.executionId} failed`,
            cause: O.some(Cause.squash(cause)),
          });
        }),
      })
  ),
  Match.tag(
    "Suspended",
    (suspended) => (context: PollContext) =>
      WorkflowSuspendedError.make({
        message: `Workflow ${context.executionId} suspended`,
        cause: O.map(O.fromNullishOr(suspended.cause), Cause.pretty),
        isResumable: true,
      })
  ),
  Match.exhaustive
);

/**
 * Poll a batch-extraction execution and project the engine result to BatchState.
 *
 * **Example** (Compose a poll)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { pollToBatchState } from "@effect-ontology/Service/WorkflowOrchestrator"
 *
 * const program = pollToBatchState("batch-deadbeefcafe")
 * console.log(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const pollToBatchState = Effect.fn("WorkflowOrchestrator.pollToBatchState")(function* (executionId: string) {
  const engine = yield* WorkflowEngine.WorkflowEngine;
  const batchId = yield* BatchId.decodeEffect(executionId).pipe(
    Effect.mapError(() => WorkflowError.make({ message: `Invalid batch workflow execution ID: ${executionId}` }))
  );
  const result = yield* engine.poll(BatchExtractionWorkflow, executionId);

  if (O.isNone(result)) {
    const stored = yield* getBatchStateFromStore(batchId);
    return yield* O.match(stored, {
      onSome: Effect.succeed,
      onNone: () =>
        WorkflowNotFoundError.make({
          message: `Workflow ${executionId} not found`,
          executionId,
        }),
    });
  }

  return yield* pollResultToBatchState(result.value)({ batchId, executionId });
});

// -----------------------------------------------------------------------------
// Workflow Implementation Layer
// -----------------------------------------------------------------------------

/**
 * Layer that registers the batch extraction workflow with WorkflowEngine
 *
 * **Example** (Register the workflow with the engine)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { BatchExtractionWorkflowLayer, WorkflowOrchestratorLive } from "@effect-ontology/Service/WorkflowOrchestrator"
 *
 * const layer = Layer.merge(WorkflowOrchestratorLive, BatchExtractionWorkflowLayer)
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BatchExtractionWorkflowLayer = BatchExtractionWorkflow.toLayer((payload) =>
  Effect.gen(function* () {
    const { batchId, manifestUri, ontologyVersion } = payload;
    const storage = yield* StorageService;
    const config = yield* ConfigService;
    const eventBus = yield* EventBusService;
    const workflowStart = yield* DateTime.now;
    const progressRef = yield* Ref.make(0);
    let currentStage: PipelineStage = "pending";
    let lastSuccessfulStage: PipelineStage | undefined;

    const manifestKey = stripGsPrefix(manifestUri);
    const manifestRaw = yield* storage
      .getOption(manifestKey)
      .pipe(Effect.flatMap((content) => expectValue(content, manifestKey)));
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
      Effect.catch((error) =>
        Effect.logWarning("Failed to publish batch state", {
          batchId,
          error,
        })
      )
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
              enrichedManifestUri: GcsUri.decodeUnknownSync(manifestUri),
              totalDocuments: NonNegativeInt.make(manifest.documents.length),
              classifiedCount: NonNegativeInt.make(0),
              failedCount: NonNegativeInt.make(0),
              totalEstimatedTokens: NonNegativeInt.make(0),
              averageComplexity: UnitInterval.make(0.5),
              durationMs: 0,
            })
      ).pipe(
        Effect.tap(
          Effect.fnUntraced(function* (result) {
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
              error: Inspectable.toStringUnknown(error),
            });
            return {
              enrichedManifestUri: GcsUri.decodeUnknownSync(manifestUri),
              totalDocuments: NonNegativeInt.make(manifest.documents.length),
              classifiedCount: NonNegativeInt.make(0),
              failedCount: NonNegativeInt.make(0),
              totalEstimatedTokens: NonNegativeInt.make(0),
              averageComplexity: UnitInterval.make(0.5),
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
      const enrichedManifest = yield* storage.getOption(enrichedManifestKey).pipe(
        Effect.flatMap(
          O.match({
            onNone: () => Effect.succeedNone,
            onSome: (content) => EnrichedManifest.decodeFromString(content).pipe(Effect.asSome),
          })
        ),
        Effect.catch(
          Effect.fnUntraced(function* (error) {
            yield* Effect.logWarning("Failed to load or decode enriched manifest, falling back to basic manifest", {
              batchId,
              enrichedManifestUri: preprocessingResult.enrichedManifestUri,
              error: Inspectable.toStringUnknown(error),
            });
            return O.none();
          })
        )
      );

      yield* Effect.logInfo("Starting extraction stage", {
        batchId,
        documentCount: manifest.documents.length,
        usingEnrichedManifest: O.isSome(enrichedManifest),
      });

      currentStage = "extracting";

      // Initialize document status tracking for partial failure visibility
      const documentStatusesRef = yield* Ref.make<Array<DocumentStatus>>(
        A.map(manifest.documents, (doc) => ({
          documentId: DocumentId.decodeUnknownSync(doc.documentId),
          status: "pending",
        }))
      );

      // Reset progress counter for extraction stage
      yield* Ref.set(progressRef, 0);

      // Process documents with per-document error handling
      // Continues processing remaining documents even when some fail
      const extractionResults = yield* Effect.forEach(
        manifest.documents,
        Effect.fnUntraced(function* (doc) {
          const startedAt = yield* DateTime.now;

          // Mark document as processing
          yield* Ref.update(documentStatusesRef, (statuses) =>
            A.map(statuses, (s) =>
              s.documentId === doc.documentId
                ? {
                    documentId: s.documentId,
                    status: "processing",
                    startedAt,
                  }
                : s
            )
          );

          // Look up DocumentMetadata from enriched manifest if available
          const docMetadata = O.flatMap(enrichedManifest, (metadata) =>
            A.findFirst(metadata.documents, (candidate) => candidate.documentId === doc.documentId)
          );

          // Execute extraction with error handling per document
          const result = yield* makeStreamingExtractionActivity({
            batchId,
            documentId: doc.documentId,
            sourceUri: doc.sourceUri,
            ontologyUri: manifest.ontologyUri,
            ontologyId: manifest.ontologyId,
            targetNamespace: manifest.targetNamespace,
            ontologyEmbeddingsUri: payload.ontologyEmbeddingsUri,
            chunking: O.match(docMetadata, {
              onNone: () => defaultChunkingParams.standard,
              onSome: (metadata) =>
                ChunkingParams.make({
                  chunkSize: metadata.suggestedChunkSize,
                  overlapSentences: metadata.suggestedOverlap,
                  preserveSentences: defaultChunkingParams[metadata.chunkingStrategy].preserveSentences,
                }),
            }),
            eventTime: O.flatMap(docMetadata, (metadata) => metadata.eventTime),
            publishedAt: O.flatMap(docMetadata, (metadata) => metadata.publishedAt),
            title: O.flatMap(docMetadata, (metadata) => metadata.title),
            language: O.map(docMetadata, (metadata) => metadata.language),
          }).execute.pipe(
            Effect.map(
              (
                output
              ): { readonly success: true; readonly output: typeof output; readonly documentId: DocumentId } => ({
                success: true,
                output,
                documentId: doc.documentId,
              })
            ),
            Effect.catch(
              Effect.fnUntraced(function* (error) {
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
                          status: "failed",
                          startedAt: O.some(startedAt),
                          completedAt,
                          error: {
                            code: "EXTRACTION_FAILED",
                            message: errorMessage,
                          },
                        }
                      : s
                  )
                );

                return {
                  success: false,
                  documentId: doc.documentId,
                  error: errorMessage,
                } satisfies { readonly success: false; readonly documentId: DocumentId; readonly error: string };
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
                      status: "success",
                      startedAt,
                      completedAt,
                      graphUri: GcsUri.decodeUnknownSync(result.output.graphUri),
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
        { concurrency: 5 }
      );

      // Separate successful and failed results
      const successfulResults = A.flatMap(extractionResults, (r) => (r.success ? [r.output] : []));
      const failedResults = A.flatMap(extractionResults, (r) =>
        !r.success ? [{ documentId: r.documentId, error: r.error }] : []
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
        yield* Effect.logDebug("Cross-batch resolution skipped (not configured)", { batchId });
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
        yield* Effect.logDebug("Inference skipped (not configured)", { batchId });
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
          failOnWarning: false,
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
                error: Inspectable.toStringUnknown(error),
              })
            )
          );
      }

      // Note: Policy enforcement is handled by validateWithPolicy in the activity.
      // If failOnViolation=true (default) and violations exist, activity throws ValidationPolicyError.
      // If failOnViolation=false, we proceed to ingestion even with non-conformance.

      lastSuccessfulStage = "validating";

      // Persist validated claims to PostgreSQL
      yield* Effect.logInfo("Persisting validated claims to database", { batchId });

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

      yield* Effect.logInfo("Starting ingestion stage", { batchId });

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
              error: Inspectable.toStringUnknown(error),
            })
          )
        );

      return complete;
    });

    return yield* runWorkflow.pipe(
      Effect.onError(
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
        })
      )
    );
  }).pipe(Effect.mapError(toWorkflowError))
);

// -----------------------------------------------------------------------------
// WorkflowOrchestrator Service
// -----------------------------------------------------------------------------

/**
 * WorkflowOrchestrator Service Interface
 *
 * **Details**
 *
 * High-level API for batch workflow operations. This remains a behavioral
 * interface because every member starts, polls, interrupts, or resumes live
 * durable workflow effects; payload and state data are schema-backed upstream.
 *
 *
 * @category services
 * @since 0.0.0
 */
export interface WorkflowOrchestratorMethods {
  /**
   * Start a new batch extraction workflow
   *
   * @param payload - Workflow payload containing batchId, manifestUri, ontologyVersion
   * @returns The execution ID (same as batchId for idempotency)
   */
  readonly start: (payload: BatchWorkflowPayloadType) => Effect.Effect<string, AnyWorkflowError>;

  /**
   * Start and wait for workflow completion
   *
   * @param payload - Workflow payload
   * @returns The final BatchState on success
   */
  readonly startAndWait: (payload: BatchWorkflowPayloadType) => Effect.Effect<BatchState, AnyWorkflowError>;

  /**
   * Poll for workflow result
   *
   * @param executionId - The workflow execution ID (batchId)
   * @returns The workflow result if complete, undefined if still running
   */
  readonly poll: (executionId: string) => Effect.Effect<O.Option<Workflow.Result<BatchState, AnyWorkflowError>>>;

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

/**
 * Provides the workflow orchestrator service capability.
 *
 * **Example** (Poll through the orchestrator)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WorkflowOrchestrator, WorkflowOrchestratorLive } from "@effect-ontology/Service/WorkflowOrchestrator"
 *
 * const program = Effect.gen(function* () {
 *   const orchestrator = yield* WorkflowOrchestrator
 *   return yield* orchestrator.poll("batch-deadbeefcafe")
 * }).pipe(Effect.provide(WorkflowOrchestratorLive))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WorkflowOrchestrator extends Context.Service<WorkflowOrchestrator, WorkflowOrchestratorMethods>()(
  $I`WorkflowOrchestrator`
) {}

// -----------------------------------------------------------------------------
// WorkflowOrchestrator Implementation
// -----------------------------------------------------------------------------

/**
 * Create the WorkflowOrchestrator service
 *
 * **Details**
 *
 * Requires WorkflowEngine to be provided (via ClusterWorkflowEngine or memory layer)
 *
 * **Example** (Construct the orchestrator)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeWorkflowOrchestrator } from "@effect-ontology/Service/WorkflowOrchestrator"
 *
 * const program = Effect.gen(function* () {
 *   const orchestrator = yield* makeWorkflowOrchestrator()
 *   return yield* orchestrator.poll("batch-deadbeefcafe")
 * })
 * console.log(program)
 * ```
 *
 * @category constructors
 * @since 0.0.0
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
 * **Details**
 *
 * Requires:
 * - WorkflowEngine (from ClusterWorkflowEngine or memory)
 *
 * **Example** (Provide the live orchestrator)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WorkflowOrchestrator, WorkflowOrchestratorLive } from "@effect-ontology/Service/WorkflowOrchestrator"
 *
 * const program = Effect.gen(function* () {
 *   const orchestrator = yield* WorkflowOrchestrator
 *   return yield* orchestrator.poll("batch-deadbeefcafe")
 * }).pipe(Effect.provide(WorkflowOrchestratorLive))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkflowOrchestratorLive = Layer.effect(WorkflowOrchestrator, makeWorkflowOrchestrator());

/**
 * Full workflow layer with orchestrator and workflow registration
 *
 * **Details**
 *
 * Requires:
 * - StorageService
 * - ConfigService
 * - RdfBuilder
 * - WorkflowEngine
 * - EntityExtractor (for Activities.ts extraction)
 * - RelationExtractor (for Activities.ts extraction)
 * - OntologyService (for Activities.ts ontology lookup)
 *
 * **Example** (Merge orchestrator and workflow registration)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { WorkflowOrchestrator, WorkflowOrchestratorFullLive } from "@effect-ontology/Service/WorkflowOrchestrator"
 *
 * const program = Effect.gen(function* () {
 *   const orchestrator = yield* WorkflowOrchestrator
 *   return yield* orchestrator.poll("batch-deadbeefcafe")
 * }).pipe(Effect.provide(WorkflowOrchestratorFullLive))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkflowOrchestratorFullLive = Layer.mergeAll(WorkflowOrchestratorLive, BatchExtractionWorkflowLayer);

export { BatchWorkflowPayload };
