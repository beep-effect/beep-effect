/**
 * Effect service for bounded Firecrawl scrapes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { FIRECRAWL_API_URL, FirecrawlConfigInput, FirecrawlOptions } from "./Firecrawl.config.ts";
import { FirecrawlError } from "./Firecrawl.errors.ts";
import { decodeFirecrawlScrapeBody } from "./Firecrawl.models.ts";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import type * as Redacted from "effect/Redacted";
import type { FirecrawlScrapeRequest, FirecrawlScrapeResult } from "./Firecrawl.models.ts";

const $I = $FirecrawlId.create("Firecrawl.service");

/**
 * Runtime shape exposed by the {@link Firecrawl} service.
 *
 * **Example** (Stub the service shape)
 *
 * ```ts
 * import type { FirecrawlShape } from "@beep/firecrawl"
 * import * as Effect from "effect/Effect";
 *
 * const service: FirecrawlShape = { scrape: () => Effect.die("not implemented") }
 * console.log(typeof service.scrape)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface FirecrawlShape {
  /**
   * Scrape one URL as markdown and raw HTML, retaining the bounded response bytes.
   *
   * @since 0.0.0
   */
  readonly scrape: (request: FirecrawlScrapeRequest) => Effect.Effect<FirecrawlScrapeResult, FirecrawlError>;
}

const ScrapeRequestBody = S.Struct({
  url: S.String,
  formats: S.Array(S.Literals(["markdown", "rawHtml"])),
  onlyMainContent: S.Boolean,
}).pipe($I.annoteSchema("FirecrawlScrapeRequestBody", { description: "Firecrawl v2 scrape request body." }));
const encodeScrapeRequestBody = S.encodeEffect(S.fromJsonString(ScrapeRequestBody));

const statusError = (status: number): FirecrawlError =>
  Match.value(status).pipe(
    Match.whenOr(401, 402, 403, () =>
      FirecrawlError.fromReason("unauthorized", `Firecrawl refused the request with HTTP ${status}.`, status)
    ),
    Match.when(429, () => FirecrawlError.fromReason("rate-limited", "Firecrawl rate limit reached.", status)),
    Match.orElse(() => FirecrawlError.fromReason("response-status", `Firecrawl returned HTTP ${status}.`, status))
  );

// Reject a declared oversize body before pulling, then enforce the observed byte count;
// stream finalization cancels the reader on early rejection.
const readBoundedBody = Effect.fn("Firecrawl.readBoundedBody")(function* (
  response: HttpClientResponse.HttpClientResponse,
  limit: number
) {
  const declared = S.decodeUnknownOption(S.FiniteFromString)(response.headers["content-length"]);
  if (O.isSome(declared) && declared.value > limit)
    return yield* FirecrawlError.fromReason(
      "response-bound",
      `Firecrawl response declared ${declared.value} bytes above the ${limit}-byte bound.`
    );
  const tooLarge = FirecrawlError.fromReason(
    "response-bound",
    `Firecrawl response exceeded the ${limit}-byte observed stream bound.`
  );
  const collected = yield* response.stream.pipe(
    Stream.mapError(() => FirecrawlError.fromReason("transport", "Firecrawl response stream failed.")),
    Stream.runFoldEffect(
      () => ({ chunks: A.empty<Uint8Array>(), total: 0 }),
      (acc, chunk) =>
        acc.total + chunk.byteLength > limit
          ? Effect.fail(tooLarge)
          : Effect.succeed({ chunks: A.append(acc.chunks, chunk), total: acc.total + chunk.byteLength })
    )
  );
  const bytes = new Uint8Array(collected.total);
  A.reduce(collected.chunks, 0, (offset, chunk) => {
    bytes.set(chunk, offset);
    return offset + chunk.byteLength;
  });
  return bytes;
});

const makeService = (
  client: HttpClient.HttpClient,
  apiKey: Effect.Effect<Redacted.Redacted<string>, FirecrawlError>,
  options: FirecrawlOptions
): FirecrawlShape => ({
  scrape: Effect.fn("Firecrawl.scrape")(function* (request: FirecrawlScrapeRequest) {
    const key = yield* apiKey;
    const body = yield* encodeScrapeRequestBody({
      url: request.url,
      formats: ["markdown", "rawHtml"],
      onlyMainContent: request.onlyMainContent,
    }).pipe(Effect.mapError(() => FirecrawlError.fromReason("config", "Cannot encode the Firecrawl scrape request.")));
    const response = yield* client
      .execute(
        HttpClientRequest.post(`${options.apiUrl}/v2/scrape`).pipe(
          HttpClientRequest.bearerToken(key),
          HttpClientRequest.acceptJson,
          HttpClientRequest.bodyText(body, "application/json")
        )
      )
      .pipe(
        Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
        Effect.mapError(() => FirecrawlError.fromReason("transport", "Firecrawl request failed in transport."))
      );
    if (response.status < 200 || response.status >= 300) return yield* statusError(response.status);
    const bytes = yield* readBoundedBody(response, options.maxResponseBytes);
    return yield* decodeFirecrawlScrapeBody(request.url, bytes);
  }),
});

/**
 * Firecrawl scrape service.
 *
 * **Example** (Provide a test scrape)
 *
 * ```ts
 * import { Firecrawl, FirecrawlScrapeRequest, decodeFirecrawlScrapeBody } from "@beep/firecrawl"
 * import * as Effect from "effect/Effect";
 *
 * const body = new TextEncoder().encode(JSON.stringify({
 *   data: { markdown: "# A", rawHtml: "<h1>A</h1>", metadata: { sourceURL: "https://example.org", statusCode: 200 } }
 * }))
 * const program = Effect.gen(function* () {
 *   const firecrawl = yield* Firecrawl
 *   return yield* firecrawl.scrape(FirecrawlScrapeRequest.make({ url: "https://example.org" }))
 * }).pipe(Effect.provide(Firecrawl.makeTestLayer((request) => decodeFirecrawlScrapeBody(request.url, body))))
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Firecrawl extends Context.Service<Firecrawl, FirecrawlShape>()($I`Firecrawl`) {
  /**
   * Build the live service from an already resolved key.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (config: FirecrawlConfigInput): Layer.Layer<Firecrawl, never, HttpClient.HttpClient> =>
    Firecrawl.makeLayerWithKey(
      Effect.succeed(config.apiKey),
      FirecrawlOptions.make({ apiUrl: config.apiUrl, maxResponseBytes: config.maxResponseBytes })
    );

  /**
   * Build the live service with a key resolved on the first scrape and cached afterwards.
   *
   * **Details**
   *
   * Use this when key resolution has a cost, such as a 1Password read, that commands which never
   * scrape should not pay.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerWithKey = (
    apiKey: Effect.Effect<Redacted.Redacted<string>, FirecrawlError>,
    options: FirecrawlOptions = FirecrawlOptions.make({})
  ): Layer.Layer<Firecrawl, never, HttpClient.HttpClient> =>
    Layer.effect(
      Firecrawl,
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        const cachedKey = yield* Effect.cached(apiKey);
        return Firecrawl.of(makeService(client, cachedKey, options));
      })
    );

  /**
   * Live service reading `FIRECRAWL_API_KEY` and optional `FIRECRAWL_API_URL`.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Firecrawl, FirecrawlError> = Layer.unwrap(
    Effect.gen(function* () {
      const apiKey = yield* Config.Redacted("FIRECRAWL_API_KEY");
      const apiUrl = yield* Config.String("FIRECRAWL_API_URL").pipe(Config.withDefault(FIRECRAWL_API_URL));
      return Firecrawl.makeLayer(FirecrawlConfigInput.make({ apiKey, apiUrl }));
    }).pipe(Effect.mapError(() => FirecrawlError.fromReason("config", "FIRECRAWL_API_KEY is not configured.")))
  ).pipe(Layer.provide(FetchHttpClient.layer));

  /**
   * Deterministic test service answering every scrape through `handler`.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeTestLayer = (
    handler: (request: FirecrawlScrapeRequest) => Effect.Effect<FirecrawlScrapeResult, FirecrawlError>
  ): Layer.Layer<Firecrawl> => Layer.succeed(Firecrawl, Firecrawl.of({ scrape: handler }));
}
