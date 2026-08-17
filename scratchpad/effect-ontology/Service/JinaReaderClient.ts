/**
 * Service: Jina Reader Client
 *
 * Effect-native HTTP client for Jina Reader API. Converts any URL to
 * clean LLM-friendly markdown. Handles rate limiting, timeouts, and retries.
 *
 * @see https://jina.ai/reader/
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Context, Duration, Effect, Layer, Option, Redacted, Schema } from "effect";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { JinaApiError, JinaParseError, JinaRateLimitError, JinaTimeoutError } from "../Domain/Error/Jina.ts";
import { JinaContent } from "../Domain/Model/EnrichedContent.ts";
import { ConfigService } from "./Config.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/JinaReaderClient");

// =============================================================================
// Types
// =============================================================================

/**
 * Options for fetching URL content
 */
export interface FetchOptions {
  /** Include images in markdown output (default: false) */
  readonly includeImages?: boolean;
  /** Include links in markdown output (default: true) */
  readonly includeLinks?: boolean;
  /** Return forward links found in the page */
  readonly returnLinks?: boolean;
  /** Target selector for extraction (CSS selector) */
  readonly targetSelector?: string;
  /** Wait for specific selector before extraction */
  readonly waitForSelector?: string;
  /** Custom timeout in ms (overrides config) */
  readonly timeoutMs?: number;
}

/**
 * Response from Jina Reader API with parsed content
 */
export interface JinaResponse {
  readonly content: JinaContent;
  /** Forward links found in the page (if returnLinks=true) */
  readonly links?: ReadonlyArray<string>;
}

// =============================================================================
// Internal Response Schema
// =============================================================================

const JinaApiResponse = Schema.Struct({
  code: Schema.Finite,
  status: Schema.Finite,
  data: Schema.Struct({
    title: Schema.String,
    url: Schema.String,
    content: Schema.String,
    description: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    publishedTime: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    siteName: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    image: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    links: Schema.Record(Schema.String, Schema.String).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  }),
});

const decodeJinaRateLimitError = Schema.decodeUnknownSync(JinaRateLimitError);
const decodeJinaContent = Schema.decodeUnknownSync(JinaContent);

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Simple sliding window rate limiter
 */
const makeRateLimiter = (maxRequests: number, windowMs: number = 60_000) => {
  let timestamps: Array<number> = [];

  const acquire = Effect.gen(function* () {
    while (true) {
      const now = yield* Clock.currentTimeMillis;
      timestamps = A.filter(timestamps, (timestamp) => now - timestamp < windowMs);

      const oldestTimestamp = timestamps[0];
      if (timestamps.length < maxRequests || P.isUndefined(oldestTimestamp)) {
        timestamps = A.append(timestamps, now);
        return;
      }

      yield* Effect.sleep(Duration.millis(windowMs - (now - oldestTimestamp) + 10));
    }
  });

  return { acquire };
};

// =============================================================================
// Service
// =============================================================================

export class JinaReaderClient extends Context.Service<JinaReaderClient>()($I`JinaReaderClient`, {
  make: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const config = yield* ConfigService;

    const { apiKey, baseUrl, rateLimitRpm, timeoutMs: configTimeout } = config.jina;

    // Create rate limiter based on config
    const rateLimiter = makeRateLimiter(rateLimitRpm);

    // Build headers with optional API key
    const buildHeaders = (): Record<string, string> => {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (Option.isSome(apiKey)) {
        headers.Authorization = `Bearer ${Redacted.value(apiKey.value)}`;
      }

      return headers;
    };

    /**
     * Fetch URL content as clean markdown
     */
    const fetchUrl = Effect.fn("JinaReaderClient.fetchUrl")(function* (
      url: string,
      options: FetchOptions = {}
    ): Effect.fn.Return<JinaResponse, JinaApiError | JinaRateLimitError | JinaParseError | JinaTimeoutError> {
      // Wait for rate limit
      yield* rateLimiter.acquire;

      const timeout = options.timeoutMs ?? configTimeout;

      // Build request URL
      const requestUrl = `${baseUrl}/${encodeURIComponent(url)}`;

      // Build headers
      const headers = buildHeaders();

      // Add optional headers based on options
      if (options.includeImages === false) {
        headers["X-No-Image"] = "true";
      }
      if (options.includeLinks === false) {
        headers["X-No-Links"] = "true";
      }
      if (P.isNotUndefined(options.returnLinks)) {
        headers["X-Return-Links"] = "true";
      }
      if (P.isNotUndefined(options.targetSelector)) {
        headers["X-Target-Selector"] = options.targetSelector;
      }
      if (P.isNotUndefined(options.waitForSelector)) {
        headers["X-Wait-For-Selector"] = options.waitForSelector;
      }

      const request = HttpClientRequest.get(requestUrl).pipe(HttpClientRequest.setHeaders(headers));

      // Execute with timeout
      const response = yield* httpClient.execute(request).pipe(
        Effect.timeout(Duration.millis(timeout)),
        Effect.catchTag("TimeoutError", () => Effect.fail(JinaTimeoutError.fromUnknown({ url, timeoutMs: timeout }))),
        Effect.mapError((error) => {
          if (Schema.is(JinaTimeoutError)(error)) return error;
          return JinaApiError.fromUnknown({
            message: `Failed to fetch URL: ${error}`,
            url,
            cause: error,
          });
        })
      );

      // Check for rate limiting response
      if (response.status === 429) {
        const retryAfter = response.headers["retry-after"];
        const seconds = P.isTruthy(retryAfter) ? parseInt(retryAfter, 10) : 60;
        return yield* decodeJinaRateLimitError({
          retryAfterMs: seconds * 1000,
        });
      }

      // Check for server errors
      if (response.status >= 500) {
        return yield* JinaApiError.fromUnknown({
          message: `Jina server error: ${response.status}`,
          statusCode: response.status,
          url,
        });
      }

      // Check for client errors
      if (response.status >= 400) {
        const body = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
        return yield* JinaApiError.fromUnknown({
          message: `Jina API error: ${response.status} - ${Str.takeLeft(200)(body)}`,
          statusCode: response.status,
          url,
        });
      }

      // Parse JSON response
      const json = yield* response.json.pipe(
        Effect.mapError((error) =>
          JinaParseError.fromUnknown({
            message: `Failed to parse Jina response: ${error}`,
            url,
            cause: error,
          })
        )
      );

      // Decode response
      const parsed = yield* Schema.decodeUnknownEffect(JinaApiResponse)(json).pipe(
        Effect.mapError((error) =>
          JinaParseError.fromUnknown({
            message: `Invalid Jina response format: ${error}`,
            url,
            cause: error,
          })
        )
      );

      // Build JinaContent
      const content = decodeJinaContent({
        url: parsed.data.url,
        title: parsed.data.title,
        content: parsed.data.content,
        length: Str.length(parsed.data.content),
        ...(O.isSome(parsed.data.description) ? { description: parsed.data.description.value } : {}),
        ...(O.isSome(parsed.data.publishedTime) ? { publishedDate: parsed.data.publishedTime.value } : {}),
        ...(O.isSome(parsed.data.siteName) ? { siteName: parsed.data.siteName.value } : {}),
        ...(O.isSome(parsed.data.image) ? { image: parsed.data.image.value } : {}),
      });

      // Extract links if present
      const links = O.map(parsed.data.links, R.keys);

      return O.isSome(links) ? { content, links: links.value } : { content };
    });

    /**
     * Fetch URL and return just the markdown content string
     */
    const fetchMarkdown = (
      url: string,
      options: FetchOptions = {}
    ): Effect.Effect<string, JinaApiError | JinaRateLimitError | JinaParseError | JinaTimeoutError> =>
      fetchUrl(url, options).pipe(Effect.map((response) => response.content.content));

    /**
     * Check if the service is configured with an API key
     */
    const hasApiKey = (): boolean => Option.isSome(apiKey);

    /**
     * Get current rate limit setting (RPM)
     */
    const getRateLimit = (): number => rateLimitRpm;

    return {
      fetchUrl,
      fetchMarkdown,
      hasApiKey,
      getRateLimit,
    };
  }).pipe(Effect.withSpan("JinaReaderClient.make")),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([FetchHttpClient.layer]));
}
