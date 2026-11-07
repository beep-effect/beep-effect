/**
 * Firecrawl scrape request and response models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FirecrawlError } from "./Firecrawl.errors.ts";

const $I = $FirecrawlId.create("Firecrawl.models");

/**
 * One scrape request: the target URL and whether Firecrawl may strip page chrome.
 *
 * **Example** (Request the full page)
 *
 * ```ts
 * import { FirecrawlScrapeRequest } from "@beep/firecrawl"
 *
 * const request = FirecrawlScrapeRequest.make({ url: "https://example.org/report" })
 * console.log(request.onlyMainContent) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlScrapeRequest extends S.Opaque<FirecrawlScrapeRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    url: S.String.check(S.isMinLength(1)).annotateKey({ description: "Absolute target URL." }),
    onlyMainContent: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ).annotateKey({ description: "Whether Firecrawl may drop navigation, headers and footers." }),
  }).pipe($I.annoteSchema("FirecrawlScrapeRequest", { description: "Target of one Firecrawl scrape." }))
) {}

/**
 * Target HTTP metadata Firecrawl reports for a scraped page.
 *
 * **Example** (Inspect metadata fields)
 *
 * ```ts
 * import { FirecrawlScrapeMetadata } from "@beep/firecrawl"
 *
 * console.log(Object.keys(FirecrawlScrapeMetadata.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlScrapeMetadata extends S.Opaque<FirecrawlScrapeMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceURL: S.String.annotateKey({ description: "URL Firecrawl was asked to scrape." }),
    statusCode: S.Finite.annotateKey({ description: "HTTP status of the target page." }),
    url: S.optionalKey(S.String).annotateKey({ description: "Final URL after redirects, when reported." }),
    contentType: S.optionalKey(S.String).annotateKey({ description: "Target content type, when reported." }),
  }).pipe($I.annoteSchema("FirecrawlScrapeMetadata", { description: "Target identity and HTTP status of a scrape." }))
) {}

/**
 * Full page content returned by one scrape.
 *
 * **Example** (Inspect document fields)
 *
 * ```ts
 * import { FirecrawlScrapedDocument } from "@beep/firecrawl"
 *
 * console.log(Object.keys(FirecrawlScrapedDocument.fields)) // ["markdown", "rawHtml", "metadata"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlScrapedDocument extends S.Opaque<FirecrawlScrapedDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    markdown: S.String,
    rawHtml: S.String,
    metadata: FirecrawlScrapeMetadata,
  }).pipe($I.annoteSchema("FirecrawlScrapedDocument", { description: "Markdown, raw HTML and target metadata." }))
) {}

const ScrapeEnvelope = S.Struct({
  success: S.optionalKey(S.Boolean),
  error: S.optionalKey(S.String),
  data: S.optionalKey(S.Unknown),
}).pipe($I.annoteSchema("FirecrawlScrapeEnvelope", { description: "Top-level Firecrawl scrape response body." }));
const ScrapeEnvelopeJson = S.fromJsonString(ScrapeEnvelope);

/**
 * A decoded scrape together with the exact response bytes it was decoded from.
 *
 * **Details**
 *
 * `body` is the byte-identical HTTP response, so a consumer can retain it as raw evidence and
 * re-validate `document` against it later.
 *
 * **Example** (Inspect result fields)
 *
 * ```ts
 * import { FirecrawlScrapeResult } from "@beep/firecrawl"
 *
 * console.log(Object.keys(FirecrawlScrapeResult.fields)) // ["requestedUrl", "body", "document"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FirecrawlScrapeResult extends S.Opaque<FirecrawlScrapeResult, { readonly brand: unique symbol }>()(
  S.Struct({
    requestedUrl: S.String,
    body: S.Uint8Array,
    document: FirecrawlScrapedDocument,
  }).pipe(
    $I.annoteSchema("FirecrawlScrapeResult", {
      description: "Byte-bound Firecrawl response body and the full document decoded from it.",
    })
  )
) {}

const isPdfText = Str.startsWith("%PDF-");
const pdfLabelled = (metadata: FirecrawlScrapeMetadata) =>
  O.match(O.fromUndefinedOr(metadata.contentType), {
    onNone: () => false,
    onSome: (contentType) => Str.includes("pdf")(Str.toLowerCase(contentType)),
  });

/**
 * Decode a bounded Firecrawl scrape response body.
 *
 * **Details**
 *
 * Fails with `scrape-failed` when Firecrawl reports `success: false`, `response-decoding` when the
 * body lacks markdown, raw HTML or target metadata, and `unsupported-content` when the target is a
 * PDF whatever its declared length or labelled type.
 *
 * **Example** (Decode a captured body)
 *
 * ```ts
 * import { decodeFirecrawlScrapeBody } from "@beep/firecrawl"
 * import * as Effect from "effect/Effect";
 *
 * const body = new TextEncoder().encode(JSON.stringify({
 *   success: true,
 *   data: { markdown: "# Report", rawHtml: "<h1>Report</h1>", metadata: { sourceURL: "https://example.org", statusCode: 200 } }
 * }))
 * console.log(Effect.isEffect(decodeFirecrawlScrapeBody("https://example.org", body)))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const decodeFirecrawlScrapeBody = Effect.fn("Firecrawl.decodeScrapeBody")(function* (
  requestedUrl: string,
  body: Uint8Array
) {
  const text = yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(body),
    catch: () => FirecrawlError.fromReason("response-decoding", "Firecrawl response body is not UTF-8."),
  });
  const envelope = yield* S.decodeEffect(ScrapeEnvelopeJson)(text).pipe(
    Effect.mapError(() => FirecrawlError.fromReason("response-decoding", "Firecrawl response body is not JSON."))
  );
  if (envelope.success === false)
    return yield* FirecrawlError.fromReason(
      "scrape-failed",
      `Firecrawl reported an unsuccessful scrape: ${Str.slice(0, 500)(envelope.error ?? "no error detail")}`
    );
  const document = yield* S.decodeUnknownEffect(FirecrawlScrapedDocument)(envelope.data).pipe(
    Effect.mapError(() =>
      FirecrawlError.fromReason("response-decoding", "Firecrawl omitted markdown, raw HTML or target metadata.")
    )
  );
  if (pdfLabelled(document.metadata) || isPdfText(document.rawHtml) || isPdfText(document.markdown))
    return yield* FirecrawlError.fromReason(
      "unsupported-content",
      "Firecrawl target is a PDF; scrape it through a full-text PDF route instead."
    );
  return FirecrawlScrapeResult.make({ requestedUrl, body, document });
});
