/**
 * Router: Link Ingestion API
 *
 * HTTP endpoint for creating a workflow batch from already-ingested links.
 *
 * @since 2.0.0
 * @module Runtime/LinkIngestionRouter
 */

import { NonNegativeInt } from "@beep/schema/Int";
import { DateTime, Effect, Option, Random, Schema } from "effect";
import * as P from "effect/Predicate";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { BatchId, ContentHash, DocumentId, GcsBucket, GcsUri, Namespace } from "../Domain/Identity.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import { BatchManifest, BatchWorkflowPayload } from "../Domain/Schema/Batch.ts";
import { ConfigService } from "../Service/Config.ts";
import { LinkIngestionService } from "../Service/LinkIngestionService.ts";
import { OntologyService } from "../Service/Ontology.ts";
import { StorageService } from "../Service/Storage.ts";
import { WorkflowOrchestrator } from "../Service/WorkflowOrchestrator.ts";

const CreateBatchFromLinksBody = Schema.Struct({
  linkIds: Schema.Array(Schema.String),
  targetNamespace: Schema.optionalKey(Schema.String),
});

const decodeCreateBatchRequest = Schema.decodeUnknownOption(CreateBatchFromLinksBody);
const decodeBatchManifest = Schema.decodeUnknownEffect(BatchManifest);
const encodeBatchManifest = Schema.encodeEffect(Schema.fromJsonString(BatchManifest));
const decodeWorkflowPayload = Schema.decodeUnknownEffect(BatchWorkflowPayload);

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
      if (Option.isNone(entry)) {
        return yield* HttpServerResponse.json(
          { error: "NOT_FOUND", message: `Ontology "${ontologyId}" not found in registry` },
          { status: 404 }
        );
      }

      const httpRequest = yield* HttpServerRequest.HttpServerRequest;
      const request = decodeCreateBatchRequest(yield* httpRequest.json);
      if (Option.isNone(request)) {
        return yield* HttpServerResponse.json(
          { error: "VALIDATION_ERROR", message: "Invalid create-batch request" },
          { status: 400 }
        );
      }

      const config = yield* ConfigService;
      const storage = yield* StorageService;
      const ingestion = yield* LinkIngestionService;
      const orchestrator = yield* WorkflowOrchestrator;
      const links = yield* ingestion.getByIds(request.value.linkIds);
      if (links.length === 0) {
        return yield* HttpServerResponse.json(
          { error: "VALIDATION_ERROR", message: "No valid link IDs provided" },
          { status: 400 }
        );
      }

      const invalidLinks = links.filter((link) => link.ontologyId !== ontologyId);
      if (invalidLinks.length > 0) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: `Links do not belong to ontology "${ontologyId}": ${invalidLinks.map((link) => link.id).join(", ")}`,
          },
          { status: 400 }
        );
      }

      const bucket = Option.getOrElse(config.storage.bucket, () => "local-bucket");
      const randomA = (yield* Random.nextIntBetween(0, 2_176_782_336)).toString(36).padStart(6, "0");
      const randomB = (yield* Random.nextIntBetween(0, 2_176_782_336)).toString(36).padStart(6, "0");
      const batchId = BatchId.fromUnknown(`batch-${randomA}${randomB}`);
      const targetNamespace = Namespace.fromUnknown(request.value.targetNamespace ?? entry.value.targetNamespace);
      const ontologyUri = GcsUri.resolve(entry.value.storagePath, GcsBucket.fromUnknown(bucket));
      const shaclUri = Option.map(entry.value.shapesPath, (path) =>
        GcsUri.resolve(path, GcsBucket.fromUnknown(bucket))
      );
      const embeddingsUri = Option.map(entry.value.embeddingsPath, (path) =>
        GcsUri.resolve(path, GcsBucket.fromUnknown(bucket))
      );
      const documents = links.map((link) => ({
        documentId: DocumentId.fromContentHash(ContentHash.fromUnknown(link.contentHash)),
        sourceUri: GcsUri.resolve(link.storageUri, GcsBucket.fromUnknown(bucket)),
        contentType: "text/markdown",
        sizeBytes: NonNegativeInt.make(P.isNotNull(link.wordCount) ? link.wordCount * 5 : 0),
      }));
      const ontologyVersion = ontologyService.generateVersion(ontologyId, entry.value.iri);
      const now = yield* DateTime.now;

      const manifest = yield* decodeBatchManifest({
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
      yield* storage.set(manifestPath, yield* encodeBatchManifest(manifest));
      const manifestUri = GcsUri.fromUnknown(`gs://${bucket}/${manifestPath}`);
      const payload = yield* decodeWorkflowPayload({
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
        HttpServerResponse.json({ error: "BATCH_CREATION_ERROR", message: String(error) }, { status: 500 })
      )
    )
  ),
]);
