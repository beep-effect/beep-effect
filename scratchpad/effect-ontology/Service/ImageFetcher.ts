/**
 * ImageFetcher Service
 *
 * Downloads images from URLs with timeout/retry handling,
 * computes content hashes, and validates content types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
import { Context, Duration, Effect, Layer, Schedule, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import type { ImageError } from "../Domain/Error/Image.ts";
import {
  ImageFetchError,
  ImageInvalidTypeError,
  ImageTimeoutError,
  ImageTooLargeError,
} from "../Domain/Error/Image.ts";
import type { ImageCandidate } from "../Domain/Model/Image.ts";
import { ImageFetchResult } from "../Domain/Model/Image.ts";
import { sha256Bytes } from "../Utils/Hash.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ImageFetcher");

// =============================================================================
// Constants
// =============================================================================

/**
 * Default fetch timeout in milliseconds
 */
const DEFAULT_TIMEOUT_MS = 30_000;

const isBlockedImageHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) {
    return true;
  }
  if (
    /^(10\.|127\.|192\.168\.|169\.254\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  ) {
    return true;
  }
  return false;
};

/**
 * Default maximum image size in bytes (10 MB)
 */
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Allowed image content types
 */
const ALLOWED_CONTENT_TYPES: A.NonEmptyReadonlyArray<string> = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/ico",
  "image/x-icon",
];

/**
 * Retry schedule for transient failures
 */
const RETRY_SCHEDULE = Schedule.max([Schedule.exponential(Duration.millis(500)), Schedule.recurs(3)]);

const isRetryableImageError = (error: ImageError): boolean =>
  error._tag === "ImageFetchError" || error._tag === "ImageTimeoutError";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for image fetching
 */
export interface ImageFetchOptions {
  /** Timeout in milliseconds (default: 30000) */
  readonly timeoutMs?: number;
  /** Maximum image size in bytes (default: 10MB) */
  readonly maxSizeBytes?: number;
  /** Custom allowed content types (default: common image types) */
  readonly allowedTypes?: ReadonlyArray<string>;
  /** Enable retries for transient failures (default: true) */
  readonly retry?: boolean;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ImageFetcher service interface
 *
 * Downloads images from URLs and prepares them for storage.
 *
 * @since 0.0.0
 * @category services
 */
export interface ImageFetcherService {
  /**
   * Fetch a single image candidate
   *
   * Downloads the image, validates content type and size,
   * and computes the content hash.
   *
   * @param candidate - Image candidate to fetch
   * @param options - Fetch options
   * @returns Fetch result with bytes and hash
   */
  readonly fetch: (
    candidate: ImageCandidate,
    options?: ImageFetchOptions
  ) => Effect.Effect<ImageFetchResult, ImageError>;

  /**
   * Fetch multiple image candidates in parallel
   *
   * Fetches all candidates concurrently with bounded parallelism.
   * Failed fetches are logged but don't fail the entire batch.
   *
   * @param candidates - Image candidates to fetch
   * @param options - Fetch options
   * @returns Array of successful fetch results
   */
  readonly fetchAll: (
    candidates: ReadonlyArray<ImageCandidate>,
    options?: ImageFetchOptions
  ) => Effect.Effect<ReadonlyArray<ImageFetchResult>>;

  /**
   * Check if a URL is likely an image based on content-type probe
   *
   * @param url - URL to check
   * @returns true if the URL returns an image content type
   */
  readonly isImage: (url: string) => Effect.Effect<boolean>;
}

// =============================================================================
// Implementation Helpers
// =============================================================================

/**
 * Normalize content type (handle variations like image/jpg vs image/jpeg)
 */
const normalizeContentType = (contentType: string | null | undefined): string => {
  if (P.isNullish(contentType)) return "application/octet-stream";

  // Extract the base mime type (ignore charset etc.)
  const base = contentType.split(";")[0].trim().toLowerCase();

  // Normalize common variations
  if (base === "image/jpg") return "image/jpeg";

  return base;
};

/**
 * Infer content type from URL if headers don't provide it
 */
const inferContentTypeFromUrl = (url: string): string | undefined => {
  const lowercaseUrl = url.toLowerCase();

  if (lowercaseUrl.includes(".jpg") || lowercaseUrl.includes(".jpeg")) {
    return "image/jpeg";
  }
  if (lowercaseUrl.includes(".png")) {
    return "image/png";
  }
  if (lowercaseUrl.includes(".gif")) {
    return "image/gif";
  }
  if (lowercaseUrl.includes(".webp")) {
    return "image/webp";
  }
  if (lowercaseUrl.includes(".svg")) {
    return "image/svg+xml";
  }
  if (lowercaseUrl.includes(".bmp")) {
    return "image/bmp";
  }
  if (lowercaseUrl.includes(".ico")) {
    return "image/x-icon";
  }

  return undefined;
};

// =============================================================================
// Service Tag
// =============================================================================

/**
 * ImageFetcher service tag
 *
 * @since 0.0.0
 * @category services
 */
export class ImageFetcher extends Context.Service<ImageFetcher, ImageFetcherService>()($I`ImageFetcher`) {
  /**
   * Live implementation
   *
   * @since 0.0.0
   * @category layers
   */
  static readonly Live = Layer.effect(
    ImageFetcher,
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;

      const fetchAttempt = Effect.fn("ImageFetcher.fetchAttempt")(function* (
        candidate: ImageCandidate,
        options: ImageFetchOptions = {}
      ) {
        const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
        const allowedTypes = options.allowedTypes ?? ALLOWED_CONTENT_TYPES;

        const parsedUrl = yield* Effect.try({
          try: () => new URL(candidate.sourceUrl),
          catch: (cause) =>
            ImageFetchError.fromUnknown({
              message: "Invalid image URL",
              url: candidate.sourceUrl,
              cause: O.some(cause),
            }),
        });
        if (isBlockedImageHost(parsedUrl.hostname)) {
          return yield* ImageFetchError.fromUnknown({
            message: "Refusing to fetch image from a private or link-local network address",
            url: candidate.sourceUrl,
          });
        }

        const request = HttpClientRequest.get(candidate.sourceUrl).pipe(
          HttpClientRequest.setHeaders({
            Accept: "image/*",
            "User-Agent": "EffectOntology/2.0 ImageFetcher",
          })
        );

        // Add referrer if available
        const requestWithReferrer = HttpClientRequest.setHeaders({
          Referer: candidate.referrerUrl,
          Accept: "image/*",
          "User-Agent": "EffectOntology/2.0 ImageFetcher",
        })(request);

        // Execute with timeout
        const response = yield* httpClient.execute(requestWithReferrer).pipe(
          Effect.timeout(Duration.millis(timeoutMs)),
          Effect.catchTag("TimeoutError", () =>
            Effect.fail(
              S.decodeUnknownSync(ImageTimeoutError)({
                url: candidate.sourceUrl,
                timeoutMs,
              })
            )
          ),
          Effect.mapError((error) => {
            if (ImageTimeoutError.is(error)) return error;
            return ImageFetchError.fromUnknown({
              message: `Failed to fetch image: ${error}`,
              url: candidate.sourceUrl,
              cause: O.some(error),
            });
          })
        );

        // Check HTTP status
        if (response.status >= 400) {
          return yield* ImageFetchError.fromUnknown({
            message: `HTTP ${response.status} error`,
            url: candidate.sourceUrl,
            statusCode: O.some(response.status),
          });
        }

        // Get and validate content type
        const rawContentType = response.headers["content-type"];
        let contentType = normalizeContentType(rawContentType);

        // If content type is generic, try to infer from URL
        if (contentType === "application/octet-stream") {
          const inferred = inferContentTypeFromUrl(candidate.sourceUrl);
          if (P.isNotUndefined(inferred)) {
            contentType = inferred;
          }
        }

        if (!A.contains(allowedTypes, contentType)) {
          return yield* ImageInvalidTypeError.fromUnknown({
            url: candidate.sourceUrl,
            contentType,
            allowedTypes: O.match(A.head(allowedTypes), {
              onNone: () => ALLOWED_CONTENT_TYPES,
              onSome: (head) => [head, ...A.drop(allowedTypes, 1)],
            }),
          });
        }

        // Check content-length if available
        const contentLength = response.headers["content-length"];
        if (P.isTruthy(contentLength)) {
          const size = parseInt(contentLength, 10);
          if (!Number.isNaN(size) && size > maxSizeBytes) {
            return yield* ImageTooLargeError.fromUnknown({
              url: candidate.sourceUrl,
              sizeBytes: NonNegativeInt.make(size),
              maxBytes: NonNegativeInt.make(maxSizeBytes),
            });
          }
        }

        const chunks = yield* Stream.runFoldEffect(
          response.stream,
          (): Array<Uint8Array> => [],
          (acc, chunk) => {
            const nextSize = acc.reduce((size, part) => size + part.length, 0) + chunk.length;
            if (nextSize > maxSizeBytes) {
              return Effect.fail(
                ImageTooLargeError.fromUnknown({
                  url: candidate.sourceUrl,
                  sizeBytes: NonNegativeInt.make(nextSize),
                  maxBytes: NonNegativeInt.make(maxSizeBytes),
                })
              );
            }
            return Effect.succeed(A.append(acc, chunk));
          }
        ).pipe(
          Effect.mapError((error) =>
            ImageTooLargeError.is(error)
              ? error
              : ImageFetchError.fromUnknown({
                  message: `Failed to read image body: ${error}`,
                  url: candidate.sourceUrl,
                  cause: O.some(error),
                })
          )
        );
        const bytes = new Uint8Array(chunks.reduce((size, part) => size + part.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }

        // Validate actual size
        if (bytes.length > maxSizeBytes) {
          return yield* ImageTooLargeError.fromUnknown({
            url: candidate.sourceUrl,
            sizeBytes: NonNegativeInt.make(bytes.length),
            maxBytes: NonNegativeInt.make(maxSizeBytes),
          });
        }

        // Compute hash
        const hash = yield* sha256Bytes(bytes);

        return yield* S.decodeUnknownEffect(ImageFetchResult)({ bytes, hash, contentType, candidate }).pipe(
          Effect.mapError((cause) =>
            ImageFetchError.fromUnknown({
              message: "Fetched image metadata failed validation",
              url: candidate.sourceUrl,
              cause: O.some(cause),
            })
          )
        );
      });

      const fetch: ImageFetcherService["fetch"] = Effect.fn("ImageFetcher.fetch")((candidate, options = {}) => {
        const attempt = fetchAttempt(candidate, options);
        return options.retry === false
          ? attempt
          : attempt.pipe(Effect.retry({ schedule: RETRY_SCHEDULE, while: isRetryableImageError }));
      });

      const fetchAll: ImageFetcherService["fetchAll"] = Effect.fn("fetchAll")(function* (candidates, options = {}) {
        const results: Array<ImageFetchResult> = [];
        yield* Effect.forEach(
          candidates,
          (candidate) =>
            fetch(candidate, options).pipe(
              Effect.tap((result) => Effect.sync(() => results.push(result))),
              Effect.catch((error) =>
                Effect.logWarning(`Failed to fetch image: ${error.message}`).pipe(Effect.as(undefined))
              )
            ),
          { concurrency: 5 }
        );
        return results;
      });

      const isImage: ImageFetcherService["isImage"] = Effect.fn("isImage")(
        function* (url) {
          const request = HttpClientRequest.head(url).pipe(
            HttpClientRequest.setHeaders({
              Accept: "image/*",
              "User-Agent": "EffectOntology/2.0 ImageFetcher",
            })
          );
          const response = yield* httpClient
            .execute(request)
            .pipe(Effect.timeout(Duration.millis(5000)), Effect.option);
          if (response._tag === "None") return false;
          const contentType = normalizeContentType(response.value.headers["content-type"]);
          return ALLOWED_CONTENT_TYPES.includes(contentType);
        },
        Effect.orElseSucceed(() => false)
      );

      return {
        fetch,
        fetchAll,
        isImage,
      };
    })
  );

  /**
   * Default layer with HttpClient
   *
   * @since 0.0.0
   * @category layers
   */
  static readonly Default = ImageFetcher.Live.pipe(Layer.provide(FetchHttpClient.layer));
}
