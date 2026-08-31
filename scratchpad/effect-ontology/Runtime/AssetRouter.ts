/**
 * Router: Asset Download API
 *
 * **Details**
 *
 * HTTP endpoints for downloading raw assets: documents, RDF graphs,
 * validation reports, and link content.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { Effect, Inspectable } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { BatchId, DocumentId } from "../Domain/Identity.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import { LinkIngestionService } from "../Service/LinkIngestionService.ts";
import { StorageService } from "../Service/Storage.ts";

// =============================================================================
// Asset Router
// =============================================================================

/**
 * HTTP surface for downloading raw documents, Turtle graphs, link content, and batch reports.
 *
 * **Details**
 *
 * Document bytes are served at `GET /v1/ontologies/:ontologyId/documents/:docId/content`.
 *
 * **Example** (Register the asset routes on an HTTP router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter } from "effect/unstable/http"
 * import { AssetRouter } from "@effect-ontology/Runtime/AssetRouter"
 *
 * const served = Layer.provide(AssetRouter, HttpRouter.layer)
 * console.log(served !== AssetRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
export const AssetRouter = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    "/v1/ontologies/:ontologyId/documents/:docId/content",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const { docId, ontologyId } = params;

      if (P.isUndefined(ontologyId) || P.isUndefined(docId)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "ontologyId and docId are required",
          },
          { status: 400 }
        );
      }

      if (!DocumentId.is(docId)) {
        return yield* HttpServerResponse.json(
          { error: "VALIDATION_ERROR", message: "docId must be a canonical document identifier" },
          { status: 400 }
        );
      }

      const storage = yield* StorageService;
      const path = PathLayout.document.input(docId);

      const content = yield* storage.getOption(path).pipe(
        Effect.tapError((error) =>
          Effect.logWarning("Storage error fetching document content", {
            path,
            docId,
            error: Inspectable.toStringUnknown(error),
          })
        )
      );

      if (O.isNone(content)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Document ${docId} content not found`,
          },
          { status: 404 }
        );
      }

      return HttpServerResponse.text(content.value, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400", // 24 hours
        },
      });
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/ontologies/:ontologyId/documents/:docId/graph.ttl",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const { docId, ontologyId } = params;

      if (P.isUndefined(ontologyId) || P.isUndefined(docId)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "ontologyId and docId are required",
          },
          { status: 400 }
        );
      }

      if (!DocumentId.is(docId)) {
        return yield* HttpServerResponse.json(
          { error: "VALIDATION_ERROR", message: "docId must be a canonical document identifier" },
          { status: 400 }
        );
      }

      const storage = yield* StorageService;
      const path = PathLayout.document.graph(docId);

      const content = yield* storage.getOption(path).pipe(
        Effect.tapError((error) =>
          Effect.logWarning("Storage error fetching document graph", {
            path,
            docId,
            error: Inspectable.toStringUnknown(error),
          })
        )
      );

      if (O.isNone(content)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Document ${docId} graph not found`,
          },
          { status: 404 }
        );
      }

      return HttpServerResponse.text(content.value, {
        headers: {
          "Content-Type": "text/turtle; charset=utf-8",
          "Cache-Control": "public, max-age=31536000, immutable", // Immutable RDF
        },
      });
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/ontologies/:ontologyId/links/:linkId/content",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const { linkId, ontologyId } = params;

      if (P.isUndefined(ontologyId) || P.isUndefined(linkId)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "ontologyId and linkId are required",
          },
          { status: 400 }
        );
      }

      const linkService = yield* LinkIngestionService;
      const storage = yield* StorageService;

      // Get the link to find the storage URI
      const link = yield* linkService.getById(linkId);

      if (O.isNone(link)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Link ${linkId} not found`,
          },
          { status: 404 }
        );
      }

      // Verify ontology matches
      if (link.value.ontologyId !== ontologyId) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Link ${linkId} not found in ontology ${ontologyId}`,
          },
          { status: 404 }
        );
      }

      // Get the content from storage
      const content = yield* storage.getOption(link.value.storageUri).pipe(
        Effect.tapError((error) =>
          Effect.logWarning("Storage error fetching link content", {
            storageUri: link.value.storageUri,
            linkId,
            error: Inspectable.toStringUnknown(error),
          })
        )
      );

      if (O.isNone(content)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Link ${linkId} content not found in storage`,
          },
          { status: 404 }
        );
      }

      return HttpServerResponse.text(content.value, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=31536000, immutable", // Content-addressed
          ETag: `"${link.value.contentHash}"`,
        },
      });
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/batches/:batchId/validation/report",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const { batchId: rawBatchId } = params;

      if (P.isUndefined(rawBatchId)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "batchId is required",
          },
          { status: 400 }
        );
      }

      const decodedBatchId = BatchId.decodeOption(rawBatchId);
      if (O.isNone(decodedBatchId)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: `Invalid batch ID format: ${rawBatchId}`,
          },
          { status: 400 }
        );
      }
      const validatedBatchId = decodedBatchId.value;

      const storage = yield* StorageService;
      const path = PathLayout.batch.validationReport(validatedBatchId);

      const content = yield* storage.getOption(path).pipe(
        Effect.tapError((error) =>
          Effect.logWarning("Storage error fetching validation report", {
            path,
            batchId: rawBatchId,
            error: Inspectable.toStringUnknown(error),
          })
        )
      );

      if (O.isNone(content)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Validation report for batch ${rawBatchId} not found`,
          },
          { status: 404 }
        );
      }

      // Parse and return as JSON using Effect
      const report = yield* UnknownFromJsonString.decodeEffect(content.value).pipe(Effect.option);

      if (O.isNone(report)) {
        return yield* HttpServerResponse.json(
          {
            error: "PARSE_ERROR",
            message: `Failed to parse validation report for batch ${rawBatchId}`,
          },
          { status: 500 }
        );
      }

      return yield* HttpServerResponse.json(report.value, {
        headers: {
          "Cache-Control": "public, max-age=86400", // 24 hours
        },
      });
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/batches/:batchId/graph.ttl",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const { batchId: rawBatchId } = params;

      if (P.isUndefined(rawBatchId)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "batchId is required",
          },
          { status: 400 }
        );
      }

      const decodedBatchId = BatchId.decodeOption(rawBatchId);
      if (O.isNone(decodedBatchId)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: `Invalid batch ID format: ${rawBatchId}`,
          },
          { status: 400 }
        );
      }
      const validatedBatchId = decodedBatchId.value;

      const storage = yield* StorageService;
      const path = PathLayout.batch.canonical(validatedBatchId);

      const content = yield* storage.getOption(path).pipe(
        Effect.tapError((error) =>
          Effect.logWarning("Storage error fetching canonical graph", {
            path,
            batchId: rawBatchId,
            error: Inspectable.toStringUnknown(error),
          })
        )
      );

      if (O.isNone(content)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Canonical graph for batch ${rawBatchId} not found`,
          },
          { status: 404 }
        );
      }

      return HttpServerResponse.text(content.value, {
        headers: {
          "Content-Type": "text/turtle; charset=utf-8",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    })
  ),
]);
