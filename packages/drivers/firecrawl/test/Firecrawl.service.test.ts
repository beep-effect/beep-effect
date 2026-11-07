import {
  decodeFirecrawlScrapeBody,
  FIRECRAWL_API_KEY_REFERENCE,
  Firecrawl,
  FirecrawlConfigInput,
  FirecrawlError,
  FirecrawlScrapeRequest,
} from "@beep/firecrawl";
import { describe, expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const encodeJson = (value: unknown) => Result.getOrThrow(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(value));
const target = (name: string) => `https://example.org/${name}`;
const page = (name: string, overrides: Record<string, unknown> = {}) =>
  encodeJson({
    success: true,
    data: {
      markdown: "# Report\n\nFull text.",
      rawHtml: "<html><body><h1>Report</h1><p>Full text.</p></body></html>",
      metadata: { sourceURL: target(name), statusCode: 200, contentType: "text/html" },
      ...overrides,
    },
  });

interface Seen {
  readonly authorization: string | undefined;
  readonly body: string;
  readonly url: string;
}

const respondTo = (url: string): Response =>
  Str.endsWith("/declared")(url)
    ? new Response(page("declared"), { status: 200, headers: { "content-length": "999999" } })
    : Str.endsWith("/pdf-body")(url)
      ? new Response(page("pdf-body", { rawHtml: "%PDF-1.7 binary" }), { status: 200 })
      : Str.endsWith("/pdf-label")(url)
        ? new Response(
            page("pdf-label", {
              metadata: { sourceURL: target("pdf-label"), statusCode: 200, contentType: "application/pdf" },
            }),
            { status: 200 }
          )
        : Str.endsWith("/unauthorized")(url)
          ? new Response("{}", { status: 401 })
          : Str.endsWith("/limited")(url)
            ? new Response("{}", { status: 429 })
            : Str.endsWith("/failed")(url)
              ? new Response(encodeJson({ success: false, error: "blocked" }), { status: 200 })
              : Str.endsWith("/malformed")(url)
                ? new Response(encodeJson({ success: true, data: { markdown: "x" } }), { status: 200 })
                : new Response(page("report"), { status: 200 });

const httpLayer = (seen: Array<Seen> = []) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        const body = request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : "";
        seen.push({ url: request.url, authorization: request.headers.authorization, body });
        const requested = O.getOrElse(
          O.map(Str.match(/"url":"([^"]+)"/)(body), (match) => match[1] ?? ""),
          () => ""
        );
        return HttpClientResponse.fromWeb(request, respondTo(requested));
      })
    )
  );

const liveSeen: Array<Seen> = [];
const liveLayer = (maxResponseBytes?: number, seen: Array<Seen> = []) =>
  Firecrawl.makeLayer(
    FirecrawlConfigInput.make({
      apiKey: Redacted.make("fc-test-key"),
      ...(maxResponseBytes === undefined ? {} : { maxResponseBytes }),
    })
  ).pipe(Layer.provide(httpLayer(seen)));

const scrape = Effect.fn("test.scrape")(function* (name: string) {
  const firecrawl = yield* Firecrawl;
  return yield* firecrawl.scrape(FirecrawlScrapeRequest.make({ url: target(name) }));
});
const failureReason = (name: string) =>
  scrape(name).pipe(
    Effect.flip,
    Effect.map((error) => error.reason)
  );

describe("Firecrawl", () => {
  layer(liveLayer(undefined, liveSeen))((it) => {
    it.effect("scrapes markdown and raw HTML with a bearer key and retains the exact body", () =>
      Effect.gen(function* () {
        const result = yield* scrape("report");
        const request = liveSeen.at(-1);
        expect(result.document.markdown).toContain("Full text.");
        expect(new TextDecoder().decode(result.body)).toBe(page("report"));
        expect(request?.url).toBe("https://api.firecrawl.dev/v2/scrape");
        expect(request?.authorization).toBe("Bearer fc-test-key");
        expect(request?.body).toContain('"formats":["markdown","rawHtml"]');
      })
    );

    it.effect("rejects a PDF target even when it is labelled as HTML", () =>
      Effect.gen(function* () {
        expect([yield* failureReason("pdf-body"), yield* failureReason("pdf-label")]).toEqual([
          "unsupported-content",
          "unsupported-content",
        ]);
      })
    );

    it.effect("maps provider statuses and unsuccessful scrapes to typed reasons", () =>
      Effect.gen(function* () {
        const reasons = yield* Effect.forEach(["unauthorized", "limited", "failed", "malformed"], failureReason);
        expect(reasons).toEqual(["unauthorized", "rate-limited", "scrape-failed", "response-decoding"]);
      })
    );
  });

  layer(liveLayer(64))((it) => {
    it.effect("rejects a body above the bound whether or not Content-Length declares it", () =>
      Effect.gen(function* () {
        expect([yield* failureReason("declared"), yield* failureReason("report")]).toEqual([
          "response-bound",
          "response-bound",
        ]);
      })
    );
  });

  let keyReads = 0;
  const lazyLayer = Firecrawl.makeLayerWithKey(
    Effect.sync(() => {
      keyReads++;
      return Redacted.make("fc-lazy");
    })
  ).pipe(Layer.provide(httpLayer()));
  layer(lazyLayer)((it) => {
    it.effect("resolves a lazy key once and never before the first scrape", () =>
      Effect.gen(function* () {
        expect(keyReads).toBe(0);
        yield* scrape("report");
        yield* scrape("report");
        expect(keyReads).toBe(1);
      })
    );
  });

  layer(
    Firecrawl.makeTestLayer((request) =>
      decodeFirecrawlScrapeBody(request.url, new TextEncoder().encode(page("report")))
    )
  )((it) => {
    it.effect("answers through the test layer and keeps the key a reference", () =>
      Effect.gen(function* () {
        const result = yield* scrape("report");
        expect(result.document.metadata.statusCode).toBe(200);
        expect(FIRECRAWL_API_KEY_REFERENCE).toBe("op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY");
        expect(O.isNone(FirecrawlError.fromReason("transport", "x").status)).toBe(true);
      })
    );
  });
});
