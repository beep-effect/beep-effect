/**
 * Router: Image API
 *
 * **Details**
 *
 * HTTP endpoints for serving images with caching, streaming,
 * and listing images for links/documents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Duration, Effect } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { ImageBlobStore } from "../Service/ImageBlobStore.ts";
import { ImageStore } from "../Service/ImageStore.ts";
import { LinkIngestionService } from "../Service/LinkIngestionService.ts";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get content type header value for an image
 */
const getContentTypeHeader = (contentType: string): string => contentType;

/**
 * Build cache control header for immutable content-addressed assets
 */
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Build ETag from hash
 */
const buildETag = (hash: string): string => `"${hash}"`;

// =============================================================================
// Image Router
// =============================================================================

/**
 * Exposes image router for composition by callers of this module.
 *
 * **Example** (Inspect image router)
 *
 * ```ts
 * import { ImageRouter } from "@effect-ontology/Runtime/ImageRouter"
 *
 * console.log(ImageRouter)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const ImageRouter = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    "/v1/images/:hash",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const { hash } = params;

      if (P.isUndefined(hash)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "Image hash is required",
          },
          { status: 400 }
        );
      }

      const blobStore = yield* ImageBlobStore;

      // Check If-None-Match for conditional request
      const ifNoneMatch = request.headers["if-none-match"];
      const expectedETag = buildETag(hash);

      if (ifNoneMatch === expectedETag) {
        return HttpServerResponse.empty({ status: 304 });
      }

      // Get metadata for content type (also validates existence)
      const metadataOpt = yield* blobStore.getMetadata(hash);
      if (O.isNone(metadataOpt)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Image ${hash} not found`,
          },
          { status: 404 }
        );
      }

      const metadata = metadataOpt.value;

      // Try to get signed URL for direct GCS access (1 hour expiry)
      if (blobStore.supportsSignedUrls) {
        const signedUrlOpt = yield* blobStore.getSignedUrl(hash, Duration.hours(1));
        if (O.isSome(signedUrlOpt)) {
          // Redirect to signed URL - client downloads directly from GCS
          return HttpServerResponse.empty({
            status: 302,
            headers: {
              Location: signedUrlOpt.value,
              "Cache-Control": "private, max-age=3500", // Slightly less than signed URL expiry
            },
          });
        }
      }

      // Fallback: proxy bytes through server (for local/memory storage)
      const bytesOpt = yield* blobStore.getBytes(hash);
      if (O.isNone(bytesOpt)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Image ${hash} bytes not found`,
          },
          { status: 404 }
        );
      }

      // Return binary response with caching headers
      return HttpServerResponse.uint8Array(bytesOpt.value, {
        status: 200,
        headers: {
          "Content-Type": getContentTypeHeader(metadata.contentType),
          "Content-Length": String(metadata.sizeBytes),
          "Cache-Control": IMMUTABLE_CACHE_CONTROL,
          ETag: expectedETag,
        },
      });
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/images/:hash/metadata",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const { hash } = params;

      if (P.isUndefined(hash)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "Image hash is required",
          },
          { status: 400 }
        );
      }

      const blobStore = yield* ImageBlobStore;

      const metadataOpt = yield* blobStore.getMetadata(hash);
      if (O.isNone(metadataOpt)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Image ${hash} not found`,
          },
          { status: 404 }
        );
      }

      return yield* HttpServerResponse.json(metadataOpt.value, {
        headers: {
          "Cache-Control": IMMUTABLE_CACHE_CONTROL,
          ETag: buildETag(hash),
        },
      });
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/ontologies/:ontologyId/links/:linkId/images",
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

      const imageStore = yield* ImageStore;
      const linkService = yield* LinkIngestionService;

      // Look up link by ID to get contentHash (images are stored by contentHash)
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

      const images = yield* imageStore.listByOwner("link", link.value.contentHash);

      return yield* HttpServerResponse.json(
        {
          images,
          total: images.length,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=60", // Short cache for list
          },
        }
      );
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/links/by-hash/:contentHash/images",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const { contentHash } = params;

      if (P.isUndefined(contentHash)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "contentHash is required",
          },
          { status: 400 }
        );
      }

      const imageStore = yield* ImageStore;

      const images = yield* imageStore.listByOwner("link", contentHash);

      return yield* HttpServerResponse.json(
        {
          images,
          total: images.length,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=300", // 5 min cache
          },
        }
      );
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/ontologies/:ontologyId/documents/:docId/images",
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

      const imageStore = yield* ImageStore;

      const images = yield* imageStore.listByOwner("document", docId);

      return yield* HttpServerResponse.json(
        {
          images,
          total: images.length,
        },
        {
          headers: {
            "Cache-Control": "public, max-age=60", // Short cache for list
          },
        }
      );
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/images/manifests/:ownerType/:ownerId",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const { ownerId, ownerType } = params;

      if (P.isUndefined(ownerType) || P.isUndefined(ownerId)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "ownerType and ownerId are required",
          },
          { status: 400 }
        );
      }

      if (ownerType !== "link" && ownerType !== "document") {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "ownerType must be 'link' or 'document'",
          },
          { status: 400 }
        );
      }

      const imageStore = yield* ImageStore;

      const manifestOpt = yield* imageStore.getManifest(ownerType, ownerId);

      if (O.isNone(manifestOpt)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `No images found for ${ownerType} ${ownerId}`,
          },
          { status: 404 }
        );
      }

      return yield* HttpServerResponse.json(manifestOpt.value, {
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      });
    })
  ),
]);
