/**
 * Router: Link Ingestion API
 *
 * HTTP endpoints for URL ingestion via Jina Reader API.
 *
 * @since 2.0.0
 * @module Runtime/LinkIngestionRouter
 */

import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse
} from "effect/unstable/http";
import {DateTime, Effect, Option, Schema} from "effect";
import {
  type BatchId,
  DocumentId,
  GcsBucket,
  GcsUri,
  type Namespace
} from "../Domain/Identity.ts";
import {PathLayout} from "../Domain/PathLayout.ts";
import {
  BatchManifest,
  type BatchWorkflowPayload
} from "../Domain/Schema/Batch.ts";
import {
  BatchIngestResponse,
  BatchIngestResult,
  IngestLinkResponse,
  LinkDetail,
  LinkSummary,
  ListLinksResponse
} from "../Domain/Schema/LinkIngestion.ts";
import {ConfigService} from "../Service/Config.ts";
import {JinaReaderClient} from "../Service/JinaReaderClient.ts";
import {
  LinkIngestionError,
  LinkIngestionService
} from "../Service/LinkIngestionService.ts";
import {OntologyService} from "../Service/Ontology.ts";
import {StorageService} from "../Service/Storage.ts";
import {WorkflowOrchestrator} from "../Service/WorkflowOrchestrator.ts";
import {SchemaUtils} from "@beep/schema";
import * as O from "effect/Option";
import { NonNegativeInt } from "@beep/schema/Int";

// =============================================================================
// Query Param Schemas (use NumberFromString for URL query params)
// =============================================================================

const ListLinksQueryParams = Schema.Struct({
  status: Schema.Literals(["pending", "enriched", "processed", "failed"]).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  sourceType: Schema.Literals(["news", "blog", "press_release", "official", "academic", "unknown"]).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  organization: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  limit: Schema.NumberFromString.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  offset: Schema.NumberFromString.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
});

const PreviewRequest = Schema.Struct({
  url: Schema.String.pipe(Schema.check(Schema.isPattern(/^https?:\/\/.+/)))
});

// =============================================================================
// Request Body Schemas (without ontologyId - comes from path)
// =============================================================================

const IngestLinkBody = Schema.Struct({
  /** URL to ingest */
  url: Schema.String.pipe(Schema.check(Schema.isPattern(/^https?:\/\/.+/))),
  /** Skip AI enrichment */
  skipEnrich: Schema.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  /** Override source type classification */
  sourceType: Schema.Literals(["news", "blog", "press_release", "official", "academic", "unknown"]).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  /** Allow duplicate content */
  allowDuplicates: Schema.Boolean.pipe(SchemaUtils.withKeyDefaults(false))
});

const BatchIngestBody = Schema.Struct({
  /** URLs to ingest */
  urls: Schema.Array(Schema.String.pipe(Schema.check(Schema.isPattern(/^https?:\/\/.+/)))),
  /** Concurrency limit */
  concurrency: Schema.Int.check(Schema.isGreaterThan(0)).pipe(SchemaUtils.withKeyDefaults(5)),
  /** Skip AI enrichment */
  skipEnrich: Schema.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  /** Continue on individual failures */
  continueOnError: Schema.Boolean.pipe(SchemaUtils.withKeyDefaults(true))
});

/**
 * Request body for creating a batch from ingested links
 */
const CreateBatchFromLinksBody = Schema.Struct({
  /** IDs of ingested links to include in the batch */
  linkIds: Schema.Array(Schema.String),
  /** Override target namespace (defaults to ontology namespace) */
  targetNamespace: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  /** Optional preprocessing configuration */
  preprocessing: Schema.Unknown.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
});

// =============================================================================
// Link Ingestion Router
// =============================================================================

export const LinkIngestionRouter = HttpRouter.addAll([
  HttpRouter.route("POST",
    "/v1/ontologies/:ontologyId/links",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const ontologyId = params.ontologyId;

      if (!ontologyId) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "ontologyId is required"
        }, {status: 400});
      }

      return yield* HttpServerRequest.schemaBodyJson(IngestLinkBody).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, {status: 400}),
          onSuccess:
            Effect.fn(function* (request) {
              const ingestion = yield* LinkIngestionService;

              const result = yield* ingestion.ingestUrl(request.url, {
                ontologyId,
                enrich: !request.skipEnrich,
                sourceType: request.sourceType,
                skipDuplicates: !request.allowDuplicates
              }).pipe(
                Effect.mapError((error) => ({
                  error: "INGESTION_ERROR" as const,
                  message: error.message,
                  phase: error.phase
                }))
              );

              return yield* HttpServerResponse.schemaJson(IngestLinkResponse)({
                id: result.id,
                contentHash: result.contentHash,
                storageUri: result.storageUri,
                headline: O.fromNullishOr(result.headline ?? null),
                wordCount: O.fromNullishOr(result.wordCount ?? null),
                duplicate: result.duplicate
              }, {status: result.duplicate ? 200 : 201});
            }, Effect.catch((error) => HttpServerResponse.json(error, {status: 500})))
        })
      );
    })
  ),
  HttpRouter.route("POST",
    "/v1/ontologies/:ontologyId/links/batch",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const ontologyId = params.ontologyId;

      if (!ontologyId) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "ontologyId is required"
        }, {status: 400});
      }

      return yield* HttpServerRequest.schemaBodyJson(BatchIngestBody).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, {status: 400}),
          onSuccess:
            Effect.fn(function* (request) {
              const ingestion = yield* LinkIngestionService;

              const results = yield* ingestion.ingestUrls(request.urls, {
                ontologyId,
                concurrency: request.concurrency,
                enrich: !request.skipEnrich,
                continueOnError: request.continueOnError
              });

              // Transform results
              let successCount = 0;
              let duplicateCount = 0;
              let errorCount = 0;

              const batchResults: Array<BatchIngestResult> = results.map((result, index) => {
                const url = request.urls[index];
                if (result instanceof LinkIngestionError) {
                  errorCount++;
                  return BatchIngestResult.make({
                    url,
                    status: "error",
                    id: null,
                    contentHash: null,
                    error: result.message
                  });
                }

                if (result.duplicate) {
                  duplicateCount++;
                  return BatchIngestResult.make({
                    url,
                    status: "duplicate",
                    id: result.id,
                    contentHash: result.contentHash,
                    error: null
                  });
                }

                successCount++;
                return BatchIngestResult.make({
                  url,
                  status: "success",
                  id: result.id,
                  contentHash: result.contentHash,
                  error: null
                });
              });

              return yield* HttpServerResponse.schemaJson(BatchIngestResponse)({
                results: batchResults,
                summary: {
                  total: NonNegativeInt.make(results.length),
                  success: NonNegativeInt.make(successCount),
                  duplicate: NonNegativeInt.make(duplicateCount),
                  error: NonNegativeInt.make(errorCount)
                }
              });
            })
        })
      );
    })
  ),
  HttpRouter.route("GET",
    "/v1/ontologies/:ontologyId/links",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const ontologyId = params.ontologyId;

      if (!ontologyId) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "ontologyId is required"
        }, {status: 400});
      }

      const queryParams = yield* HttpServerRequest.schemaSearchParams(ListLinksQueryParams).pipe(
        Effect.catch(() =>
          Effect.succeed({
            status: undefined,
            sourceType: undefined,
            organization: undefined,
            limit: undefined,
            offset: undefined
          })
        )
      );

      const ingestion = yield* LinkIngestionService;
      const limit = queryParams.limit ?? 20;
      const offset = queryParams.offset ?? 0;

      const links = yield* ingestion.list({
        ontologyId,
        status: queryParams.status,
        sourceType: queryParams.sourceType,
        organization: queryParams.organization,
        limit: limit + 1,
        offset
      });

      const hasMore = links.length > limit;
      const linkResults = hasMore ? links.slice(0, limit) : links;

      const summaries: Array<LinkSummary> = linkResults.map((link) =>
        LinkSummary.make({
          id: link.id,
          contentHash: link.contentHash,
          sourceUri: O.fromNullishOr(link.sourceUri),
          sourceType: O.fromNullishOr(link.sourceType),
          headline: O.fromNullishOr(link.headline),
          organization: O.fromNullishOr(link.organization),
          status: link.status,
          wordCount: O.fromNullishOr(link.wordCount),
          fetchedAt: O.fromNullishOr(link.fetchedAt ? DateTime.fromDateUnsafe(link.fetchedAt) : null),
          enrichedAt: O.fromNullishOr(link.enrichedAt ? DateTime.fromDateUnsafe(link.enrichedAt) : null)
        })
      );

      // Count total (simplified - would need a count query for efficiency)
      const total = links.length + offset;

      return yield* HttpServerResponse.schemaJson(ListLinksResponse)({
        links: summaries,
        total,
        limit,
        offset,
        hasMore
      });
    })
  ),
  HttpRouter.route("GET",
    "/v1/ontologies/:ontologyId/links/:id",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const ontologyId = params.ontologyId;
      const id = params.id;

      if (!ontologyId || !id) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "Ontology ID and Link ID are required"
        }, {status: 400});
      }

      // Validate ontology exists in registry
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(ontologyId);
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${ontologyId}" not found in registry`
        }, {status: 404});
      }

      const ingestion = yield* LinkIngestionService;
      const linkOpt = yield* ingestion.getById(id);

      if (Option.isNone(linkOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Link "${id}" not found`
        }, {status: 404});
      }

      const link = linkOpt.value;

      // Validate link belongs to the specified ontology
      if (link.ontologyId !== ontologyId) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Link "${id}" not found in ontology "${ontologyId}"`
        }, {status: 404});
      }

      return yield* HttpServerResponse.schemaJson(LinkDetail)({
        id: link.id,
        contentHash: link.contentHash,
        sourceUri: O.fromNullishOr(link.sourceUri),
        sourceType: O.fromNullishOr(link.sourceType),
        headline: O.fromNullishOr(link.headline),
        description: O.fromNullishOr(link.description),
        author: O.fromNullishOr(link.author),
        organization: O.fromNullishOr(link.organization),
        language: O.fromNullishOr(link.language),
        topics: (link.topics as Array<string>) ?? [],
        keyEntities: (link.keyEntities as Array<string>) ?? [],
        storageUri: link.storageUri,
        status: link.status,
        wordCount: O.fromNullishOr(link.wordCount),
        publishedAt: O.fromNullishOr(link.publishedAt ? DateTime.fromDateUnsafe(link.publishedAt) : null),
        fetchedAt: O.fromNullishOr(link.fetchedAt ? DateTime.fromDateUnsafe(link.fetchedAt) : null),
        enrichedAt: O.fromNullishOr(link.enrichedAt ? DateTime.fromDateUnsafe(link.enrichedAt) : null),
        processedAt: O.fromNullishOr(link.processedAt ? DateTime.fromDateUnsafe(link.processedAt) : null),
        errorMessage: O.fromNullishOr(link.errorMessage)
      });
    })
  ),
  HttpRouter.route("GET",
    "/v1/links/:id",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const id = params.id;

      if (!id) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "Link ID is required"
        }, {status: 400});
      }

      yield* Effect.logWarning("Deprecated: Use /v1/ontologies/:ontologyId/links/:id instead of /v1/links/:id");

      const ingestion = yield* LinkIngestionService;
      const linkOpt = yield* ingestion.getById(id);

      if (Option.isNone(linkOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Link "${id}" not found`
        }, {status: 404});
      }

      const link = linkOpt.value;

      return yield* HttpServerResponse.schemaJson(LinkDetail)({
        id: link.id,
        contentHash: link.contentHash,
        sourceUri: O.fromNullishOr(link.sourceUri),
        sourceType: O.fromNullishOr(link.sourceType),
        headline: O.fromNullishOr(link.headline),
        description: O.fromNullishOr(link.description),
        author: O.fromNullishOr(link.author),
        organization: O.fromNullishOr(link.organization),
        language: O.fromNullishOr(link.language),
        topics: (link.topics as Array<string>) ?? [],
        keyEntities: (link.keyEntities as Array<string>) ?? [],
        storageUri: link.storageUri,
        status: link.status,
        wordCount: O.fromNullishOr(link.wordCount),
        publishedAt: O.fromNullishOr(link.publishedAt ? DateTime.fromDateUnsafe(link.publishedAt) : null),
        fetchedAt: O.fromNullishOr(link.fetchedAt ? DateTime.fromDateUnsafe(link.fetchedAt) : null),
        enrichedAt: O.fromNullishOr(link.enrichedAt ? DateTime.fromDateUnsafe(link.enrichedAt) : null),
        processedAt: O.fromNullishOr(link.processedAt ? DateTime.fromDateUnsafe(link.processedAt) : null),
        errorMessage: O.fromNullishOr(link.errorMessage)
      });
    })
  ),
  HttpRouter.route("POST",
    "/v1/links/preview",
    Effect.gen(function* () {
      return yield* HttpServerRequest.schemaBodyJson(PreviewRequest).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, {status: 400}),
          onSuccess:
            Effect.fn(function* (request) {
              const jina = yield* JinaReaderClient;

              const response = yield* jina.fetchUrl(request.url).pipe(
                Effect.mapError((error) => ({
                  error: "FETCH_ERROR" as const,
                  message: error.message
                }))
              );

              const {content} = response;

              return yield* HttpServerResponse.json({
                url: request.url,
                title: content.title,
                siteName: content.siteName,
                description: content.description,
                publishedDate: content.publishedDate,
                wordCount: content.wordCount,
                contentPreview: content.content.slice(0, 500) +
                  (content.content.length > 500 ? "..." : "")
              });
            },  Effect.catch((error) => HttpServerResponse.json(error, {status: 502})))
        })
      );
    })
  ),
  HttpRouter.route("POST",
    "/v1/ontologies/:ontologyId/batches/from-links",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const ontologyId = params.ontologyId;

      if (!ontologyId) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "ontologyId is required"
        }, {status: 400});
      }

      // Validate ontology exists in registry
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(ontologyId);
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${ontologyId}" not found in registry`
        }, {status: 404});
      }
      const ontologyEntry = entryOpt.value;

      return yield* HttpServerRequest.schemaBodyJson(CreateBatchFromLinksBody).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, {status: 400}),
          onSuccess: (request) =>
            Effect.gen(function* () {
              const config = yield* ConfigService;
              const storage = yield* StorageService;
              const ingestion = yield* LinkIngestionService;
              const orchestrator = yield* WorkflowOrchestrator;
              const ontologyService = yield* OntologyService;
              const now = yield* DateTime.now;

              // Fetch all requested links
              const links = yield* ingestion.getByIds(request.linkIds);

              if (links.length === 0) {
                return yield* HttpServerResponse.json({
                  error: "VALIDATION_ERROR",
                  message: "No valid link IDs provided"
                }, {status: 400});
              }

              // Verify all links belong to this ontology
              const invalidLinks = links.filter((l) => l.ontologyId !== ontologyId);
              if (invalidLinks.length > 0) {
                return yield* HttpServerResponse.json({
                  error: "VALIDATION_ERROR",
                  message: `Links do not belong to ontology "${ontologyId}": ${
                    invalidLinks.map((l) => l.id).join(", ")
                  }`
                }, {status: 400});
              }

              // Resolve bucket for GCS URIs
              const bucket = Option.getOrElse(config.storage.bucket, () => "local-bucket");

              // Generate batch ID
              const batchId = `batch-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}` as BatchId;

              // Determine target namespace (use simple ontologyId, not full IRI)
              // The registry targetNamespace is a full IRI but the schema expects a simple namespace
              const targetNamespace = (request.targetNamespace ?? ontologyId) as Namespace;

              // Resolve ontology URI - storage path needs bucket prefix
              const ontologyUri = GcsUri.resolve(ontologyEntry.storagePath, GcsBucket.fromUnknown(bucket));

              // Build documents from links
              // Use contentHash to generate DocumentId (not link.id which is UUID)
              const documents = links.map((link) => ({
                documentId: DocumentId.fromContentHash(link.contentHash),
                sourceUri: GcsUri.resolve(link.storageUri, GcsBucket.fromUnknown(bucket)),
                contentType: "text/markdown" as const,
                sizeBytes: link.wordCount ? link.wordCount * 5 : 0 // Rough estimate
              }));

              // Resolve SHACL URI if provided
              const shaclUri = ontologyEntry.shapesPath
                ? GcsUri.resolve(ontologyEntry.shapesPath, GcsBucket.fromUnknown(bucket))
                : undefined;

              // Generate proper OntologyVersion from registry entry
              const ontologyVersion = ontologyService.generateVersion(ontologyId, ontologyEntry.iri);

              // Create batch manifest
              const manifest: BatchManifest = {
                batchId,
                ontologyId,
                ontologyUri,
                ontologyVersion,
                shaclUri,
                targetNamespace,
                documents,
                createdAt: now
              };

              // Stage manifest to storage
              const encodeManifest = Schema.encodeEffect(BatchManifest);
              const encoded = yield* encodeManifest(manifest);
              const manifestJson = JSON.stringify(encoded);
              const manifestPath = PathLayout.batch.manifest(batchId);
              yield* storage.set(manifestPath, manifestJson);
              const manifestUri = GcsUri.fromUnknown(`gs://${bucket}/${manifestPath}`);

              // Resolve embeddings URI if provided
              const embeddingsUri = ontologyEntry.embeddingsPath
                ? GcsUri.resolve(ontologyEntry.embeddingsPath, GcsBucket.fromUnknown(bucket))
                : undefined;

              // Build workflow payload
              const documentIds = documents.map((d) => d.documentId);
              const payload: BatchWorkflowPayload = {
                batchId,
                ontologyId,
                manifestUri,
                ontologyVersion, // Use the already-computed version from line 575
                ontologyUri,
                targetNamespace,
                shaclUri,
                documentIds,
                ontologyEmbeddingsUri: embeddingsUri
              };

              // Start the workflow
              yield* orchestrator.start(payload);

              // Mark links as processing
              yield* Effect.forEach(
                links,
                (link) => ingestion.markProcessing(link.id),
                {concurrency: 10}
              );

              yield* Effect.logInfo("Batch created from ingested links", {
                ontologyId,
                batchId,
                linkCount: links.length
              });

              // Return 202 Accepted
              return yield* HttpServerResponse.json({
                batchId,
                ontologyId,
                linkCount: links.length,
                documentCount: documents.length,
                wsEndpoint: `/v1/ontologies/${ontologyId}/events/stream`,
                statusEndpoint: `/v1/extract/batch/${batchId}/status`
              }, {status: 202});
            }).pipe(
              Effect.catch((error) =>
                HttpServerResponse.json({
                  error: "BATCH_CREATION_ERROR",
                  message: String(error)
                }, {status: 500})
              )
            )
        })
      );
    })
  ),
  HttpRouter.route("POST",
    "/v1/ontologies/:ontologyId/links/:linkId/re-enrich",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const {linkId, ontologyId} = params;

      if (!ontologyId || !linkId) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "ontologyId and linkId are required"
        }, {status: 400});
      }

      const ingestion = yield* LinkIngestionService;

      // First verify the link exists and belongs to this ontology
      const existingLink = yield* ingestion.getById(linkId).pipe(
        Effect.map((opt) => Option.getOrNull(opt))
      );

      if (existingLink === null) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Link "${linkId}" not found`
        }, {status: 404});
      }

      if (existingLink.ontologyId !== ontologyId) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Link "${linkId}" not found in ontology "${ontologyId}"`
        }, {status: 404});
      }

      // Run re-enrichment
      const result = yield* ingestion.reEnrich(linkId).pipe(
        Effect.mapError((error) => ({
          error: "RE_ENRICH_ERROR" as const,
          message: error.message,
          phase: error.phase
        }))
      );

      if (Option.isNone(result)) {
        return yield* HttpServerResponse.json({
          error: "RE_ENRICH_ERROR",
          message: "Failed to re-enrich link"
        }, {status: 500});
      }

      const link = result.value;

      yield* Effect.logInfo("Link re-enriched successfully", {
        linkId,
        ontologyId,
        status: link.status,
        headline: link.headline
      });

      return yield* HttpServerResponse.json({
        id: link.id,
        status: link.status,
        headline: link.headline,
        topics: link.topics,
        keyEntities: link.keyEntities,
        enrichedAt: link.enrichedAt
      });
    }).pipe(
      Effect.catch((error) => {
        if (typeof error === "object" && error !== null && "error" in error) {
          return HttpServerResponse.json(error, {status: 500});
        }
        return HttpServerResponse.json({
          error: "RE_ENRICH_ERROR",
          message: String(error)
        }, {status: 500});
      })
    )
  )
]);
