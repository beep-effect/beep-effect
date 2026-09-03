/**
 * Router: Link Ingestion API
 *
 * **Details**
 *
 * HTTP endpoint for creating a workflow batch from already-ingested links.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Context, DateTime, Effect, FiberSet, HashSet, Inspectable, Layer, Random, Schedule } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { BatchId, ContentHash, DocumentId, GcsBucket, GcsUri, Namespace } from "../Domain/Identity.ts";
import { BatchStage, BatchState } from "../Domain/Model/BatchWorkflow.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import { BatchManifest, BatchWorkflowPayload } from "../Domain/Schema/Batch.ts";
import { ConfigService } from "../Service/Config.ts";
import { LinkIngestionService } from "../Service/LinkIngestionService.ts";
import { OntologyService } from "../Service/Ontology.ts";
import { StorageService } from "../Service/Storage.ts";
import { pollToBatchState, WorkflowOrchestrator } from "../Service/WorkflowOrchestrator.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/LinkIngestionRouter");

const CreateBatchFromLinksBody = S.Struct({
  linkIds: S.Array(S.String),
  targetNamespace: S.optionalKey(S.String),
}).pipe(SchemaUtils.withCodecStatics(["decodeUnknownOption"]));

const NonTerminalBatchStage = BatchStage.pick(BatchStage.omitOptions(["Complete", "Failed"]));

class BatchNotTerminalError extends S.TaggedError<BatchNotTerminalError>($I`BatchNotTerminalError`)(
  "BatchNotTerminalError",
  {
    batchId: BatchId.annotateKey({
      description: "Batch whose persisted workflow state is still non-terminal.",
    }),
    status: NonTerminalBatchStage.annotateKey({
      description: "Current lifecycle stage observed while polling for a terminal state.",
    }),
  },
  $I.annote("BatchNotTerminalError", {
    description: "Retryable signal raised while a batch workflow remains in a non-terminal stage.",
  })
) {}

/**
 * Owns background link-status finalizers for the lifetime of the HTTP server layer.
 *
 * **Example** (Provide background task ownership)
 *
 * ```ts
 * import { LinkIngestionBackgroundTasks } from "@effect-ontology/Runtime/LinkIngestionRouter"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const tasks = yield* LinkIngestionBackgroundTasks
 *   yield* tasks.fork(Effect.logInfo("Finalizing link status"))
 * }).pipe(Effect.provide(LinkIngestionBackgroundTasks.Default))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LinkIngestionBackgroundTasks extends Context.Service<LinkIngestionBackgroundTasks>()(
  $I`LinkIngestionBackgroundTasks`,
  {
    make: Effect.gen(function* () {
      const fibers = yield* FiberSet.make<void, never>();
      return {
        fork: <R>(effect: Effect.Effect<void, never, R>): Effect.Effect<void, never, R> =>
          FiberSet.run(fibers, effect).pipe(Effect.asVoid),
      };
    }),
  }
) {
  static readonly Default = Layer.effect(this, this.make);
}

/**
 * HTTP surface for creating a workflow batch from already-ingested link IDs.
 *
 * **Details**
 *
 * Batches from ingested link IDs are created at `POST /v1/ontologies/:ontologyId/batches/from-links`.
 *
 * **Example** (Register the from-links routes on an HTTP router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter } from "effect/unstable/http"
 * import { LinkIngestionRouter } from "@effect-ontology/Runtime/LinkIngestionRouter"
 *
 * const served = Layer.provide(LinkIngestionRouter, HttpRouter.layer)
 * console.log(served !== LinkIngestionRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
export const LinkIngestionRouter = HttpRouter.addAll([
  HttpRouter.route(
    "POST",
    "/v1/ontologies/:ontologyId/batches/from-links",
    Effect.gen(function* () {
      const { ontologyId } = yield* HttpRouter.params;
      if (P.isUndefined(ontologyId)) {
        return yield* HttpServerResponse.json(
          { error: "VALIDATION_ERROR", message: "ontologyId is required" },
          { status: 400 }
        );
      }

      const ontologyService = yield* OntologyService;
      const entry = yield* ontologyService.getRegistryEntry(ontologyId);
      if (O.isNone(entry)) {
        return yield* HttpServerResponse.json(
          { error: "NOT_FOUND", message: `Ontology "${ontologyId}" not found in registry` },
          { status: 404 }
        );
      }

      const httpRequest = yield* HttpServerRequest.HttpServerRequest;
      const request = CreateBatchFromLinksBody.decodeUnknownOption(yield* httpRequest.json);
      if (O.isNone(request)) {
        return yield* HttpServerResponse.json(
          { error: "VALIDATION_ERROR", message: "Invalid create-batch request" },
          { status: 400 }
        );
      }

      const config = yield* ConfigService;
      const storage = yield* StorageService;
      const ingestion = yield* LinkIngestionService;
      const orchestrator = yield* WorkflowOrchestrator;
      const backgroundTasks = yield* LinkIngestionBackgroundTasks;
      const requestedIds = request.value.linkIds;
      const links = yield* ingestion.getByIds(requestedIds);
      const foundIds = HashSet.fromIterable(links.map((link) => link.id));
      const missingIds = requestedIds.filter((id) => !HashSet.has(foundIds, id));
      if (missingIds.length > 0) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: `Unknown or missing link IDs: ${missingIds.join(", ")}`,
          },
          { status: 400 }
        );
      }

      const invalidLinks = A.filter(links, (link) => link.ontologyId !== ontologyId);
      if (invalidLinks.length > 0) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: `Links do not belong to ontology "${ontologyId}": ${invalidLinks.map((link) => link.id).join(", ")}`,
          },
          { status: 400 }
        );
      }

      const bucket = O.getOrElse(config.storage.bucket, () => "local-bucket");
      const randomA = (yield* Random.nextIntBetween(0, 2_176_782_336)).toString(36).padStart(6, "0");
      const randomB = (yield* Random.nextIntBetween(0, 2_176_782_336)).toString(36).padStart(6, "0");
      const batchId = BatchId.decodeUnknownSync(`batch-${randomA}${randomB}`);
      const targetNamespace = Namespace.decodeUnknownSync(request.value.targetNamespace ?? entry.value.targetNamespace);
      const ontologyUri = GcsUri.resolve(entry.value.storagePath, GcsBucket.decodeUnknownSync(bucket));
      const shaclUri = O.map(entry.value.shapesPath, (path) => GcsUri.resolve(path, GcsBucket.decodeUnknownSync(bucket)));
      const embeddingsUri = O.map(entry.value.embeddingsPath, (path) =>
        GcsUri.resolve(path, GcsBucket.decodeUnknownSync(bucket))
      );
      const documents = links.map((link) => ({
        documentId: DocumentId.fromContentHash(ContentHash.decodeUnknownSync(link.contentHash)),
        sourceUri: GcsUri.resolve(link.storageUri, GcsBucket.decodeUnknownSync(bucket)),
        contentType: "text/markdown",
        sizeBytes: NonNegativeInt.make(P.isNotNull(link.wordCount) ? link.wordCount * 5 : 0),
      }));
      const ontologyVersion = yield* ontologyService.generateVersion(ontologyId, entry.value.iri);
      const now = yield* DateTime.now;

      const manifest = yield* BatchManifest.decodeUnknownEffect({
        batchId,
        ontologyId: entry.value.id,
        ontologyUri,
        ontologyVersion,
        shaclUri,
        targetNamespace,
        documents,
        createdAt: now,
      });
      const manifestPath = PathLayout.batch.manifest(batchId);
      yield* storage.set(manifestPath, yield* BatchManifest.encodeEffectFromJsonString(manifest));
      const manifestUri = GcsUri.decodeUnknownSync(`gs://${bucket}/${manifestPath}`);
      const payload = yield* BatchWorkflowPayload.decodeUnknownEffect({
        batchId,
        ontologyId: entry.value.id,
        manifestUri,
        ontologyVersion,
        ontologyUri,
        targetNamespace,
        shaclUri,
        documentIds: documents.map((document) => document.documentId),
        ontologyEmbeddingsUri: embeddingsUri,
      });

      yield* orchestrator.start(payload);
      yield* Effect.forEach(links, (link) => ingestion.markProcessing(link.id), { concurrency: 10 });
      yield* backgroundTasks.fork(
        Effect.gen(function* () {
          const state = yield* pollToBatchState(String(batchId)).pipe(
            Effect.filterOrElse(current => BatchState.isTerminal(current), current => BatchNotTerminalError.make({
    batchId,
    status: current._tag,
})),
            Effect.retry({ times: 120, schedule: Schedule.spaced("5 seconds") })
          );
          const failed = BatchState.guards.Failed(state);
          yield* Effect.forEach(
            links,
            (link) =>
              failed ? ingestion.markFailed(link.id, "batch extraction failed") : ingestion.markProcessed(link.id),
            { concurrency: 10 }
          );
        }).pipe(
          Effect.catch((error) =>
            Effect.logWarning("Failed to finalize ingested-link statuses", {
              error: Inspectable.toStringUnknown(error),
            })
          )
        )
      );
      yield* Effect.logInfo("Batch created from ingested links", {
        ontologyId,
        batchId,
        linkCount: links.length,
      });
      return yield* HttpServerResponse.json(
        {
          batchId,
          ontologyId,
          linkCount: links.length,
          documentCount: documents.length,
          wsEndpoint: `/v1/ontologies/${ontologyId}/events/stream`,
          statusEndpoint: `/v1/extract/batch/${batchId}/status`,
        },
        { status: 202 }
      );
    }).pipe(
      Effect.catch((error) =>
        HttpServerResponse.json(
          { error: "BATCH_CREATION_ERROR", message: Inspectable.toStringUnknown(error) },
          { status: 500 }
        )
      )
    )
  ),
]);
