/**
 * Web and scholarly evidence adapters.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { Firecrawl, FirecrawlScrapePayload } from "@beep/firecrawl";
import { $RepoCliId } from "@beep/identity/packages";
import { Effect, Layer, Path, Stream } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { encodeLibraryJson, LibraryAdapterResult, runLibraryCommand, saveLibraryText } from "./Library.adapter.ts";
import { LibraryError } from "./Library.errors.ts";
import { LibraryArtifact } from "./Library.schemas.ts";
import { hashBytes, saveImmutable } from "./Library.store.ts";
import type { LibrarySource } from "./Library.schemas.ts";

const publisherAttributes = (tag: string) => {
  const attributes: Record<string, string> = {};
  for (const attribute of tag.matchAll(/(?:^|\s)(name|content|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi))
    attributes[Str.toLowerCase(attribute[1] ?? "")] = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
  return attributes;
};
const publisherTagPdf = (tag: string) => {
  const attributes = publisherAttributes(tag);
  const explicit = Str.toLowerCase(attributes.name ?? "") === "citation_pdf_url";
  const content = attributes.content ?? "";
  const href = attributes.href ?? "";
  return { explicit, content, href: /\.pdf(?:\?[^\s]*)?$/i.test(href) ? href : "" };
};
const publisherPdfLocator = (html: string) => {
  let locator = "";
  for (const tag of html.matchAll(/<(?:meta|a)\b[^>]*>/gi)) {
    const candidate = publisherTagPdf(tag[0]);
    if (candidate.explicit) {
      // An empty explicit meta resets the earlier anchor exactly as the original parser did.
      locator = candidate.content;
      if (Str.isNonEmpty(locator)) break;
    }
    if (Str.isEmpty(locator)) locator = candidate.href;
  }
  return locator;
};
const isPdf = (value: Uint8Array) => new TextDecoder().decode(value.subarray(0, 5)) === "%PDF-";
const successfulPdf = (status: number, bytes: Uint8Array) =>
  status >= 200 && status < 300 && bytes.byteLength <= 50_000_000 && isPdf(bytes);
const observedPaperMatches = (arxiv: O.Option<RegExpMatchArray>, actual: O.Option<RegExpMatchArray>) =>
  O.isNone(arxiv) || (O.isSome(actual) && Str.startsWith(actual.value[1] ?? "")(arxiv.value[1] ?? ""));

const publisherCandidateAllowed = (candidate: URL | undefined, fetchedUrl: string) =>
  candidate !== undefined &&
  ["https:", "http:"].includes(candidate.protocol) &&
  Str.isEmpty(candidate.username) &&
  Str.isEmpty(candidate.password) &&
  candidate.href !== fetchedUrl;
const paperHeaderObservation = (text: string) => {
  const actual = Str.match(/arXiv:\s*(\d{4}\.\d{4,5})(v\d+)/i)(text);
  return {
    actual,
    capturedRevision: O.isSome(actual) ? (actual.value[2] ?? "") : "",
    observedPaperId: O.isSome(actual) ? (actual.value[1] ?? "") : "",
  };
};

const $I = $RepoCliId.create("commands/Research/Library/Library.web");

// Reject declared oversize before pulling, then enforce observed bytes independent of headers.
// Stream finalization cancels/releases the response reader on failure, including early rejection.
const readBoundedPaperBody = Effect.fn("Library.paper.readBoundedBody")(function* (
  response: HttpClientResponse.HttpClientResponse,
  pdfAllowed: boolean
) {
  const declaredLimit = pdfAllowed ? 50_000_000 : 5_000_000;
  const declared = S.decodeUnknownOption(S.FiniteFromString)(response.headers["content-length"]);
  if (O.isSome(declared) && declared.value > declaredLimit) {
    yield* Effect.scoped(Stream.toPull(response.stream).pipe(Effect.asVoid));
    return yield* LibraryError.make({
      cause: "body-bound",
      message: `Paper HTTP body declared ${declared.value} bytes above the ${declaredLimit}-byte limit.`,
    });
  }
  let bytes = new Uint8Array(0);
  const signature = new Uint8Array(5);
  let signatureBytes = 0;
  let total = 0;
  yield* response.stream.pipe(
    Stream.runForEach(
      Effect.fnUntraced(function* (chunk: Uint8Array) {
        const prefix = chunk.subarray(0, 5 - signatureBytes);
        signature.set(prefix, signatureBytes);
        signatureBytes += prefix.byteLength;
        const limit = pdfAllowed && isPdf(signature) ? 50_000_000 : 5_000_000;
        if (chunk.byteLength > limit - total)
          return yield* LibraryError.make({
            cause: "body-bound",
            message: `Paper HTTP body exceeded the ${limit}-byte observed stream limit.`,
          });
        const required = total + chunk.byteLength;
        if (required > bytes.byteLength) {
          const grown = new Uint8Array(Num.min(limit, Num.max(required, Num.max(1024, bytes.byteLength * 2))));
          grown.set(bytes);
          bytes = grown;
        }
        bytes.set(chunk, total);
        total = required;
      })
    )
  );
  return bytes.slice(0, total);
});

const ScrapedDocument = S.Struct({
  markdown: S.String,
  rawHtml: S.String,
  metadata: S.Struct({ sourceURL: S.String, statusCode: S.Finite }),
}).annotate(
  $I.annote("ScrapedDocument", { description: "Full web content with target HTTP metadata required before admission." })
);

/**
 * Validate the scraped target and HTTP status before admitting extracted text.
 * **Example** (Require a successful matching scrape)
 * ```ts
 * import { validateLibraryScrape } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 * console.log(Effect.isEffect(validateLibraryScrape("https://example.org/report", {markdown: "Source text", metadata: {statusCode: 200, sourceURL: "https://example.org/report"}})))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const validateLibraryScrape = Effect.fn("Library.validateScrape")(function* (requested: string, input: unknown) {
  const doc = yield* S.decodeUnknownEffect(ScrapedDocument)(input).pipe(
    Effect.mapError(() =>
      LibraryError.make({
        cause: "library-boundary",
        message: "Firecrawl omitted raw HTML, markdown, or target status metadata.",
      })
    )
  );
  if (
    doc.metadata.statusCode < 200 ||
    doc.metadata.statusCode >= 300 ||
    Str.replace(/\/$/, "")(doc.metadata.sourceURL) !== Str.replace(/\/$/, "")(requested) ||
    Str.isEmpty(Str.trim(doc.markdown)) ||
    Str.isEmpty(Str.trim(doc.rawHtml))
  ) {
    return yield* LibraryError.make({
      cause: "library-boundary",
      message: `Firecrawl target identity, status, or full-content validation failed (target status ${doc.metadata.statusCode}; target matches ${Str.replace(/\/$/, "")(doc.metadata.sourceURL) === Str.replace(/\/$/, "")(requested)}).`,
    });
  }
  return doc;
});

/**
 * Capture web text and preserved raw response.
 * **Example** (Prepare a source-bound acquisition)
 * ```ts
 * import { acquireLibraryWeb } from "@beep/repo-cli/test/ResearchLibrary"
 * import { classifyLibraryReference } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 * const acquisition = classifyLibraryReference("https://example.org/report", "report").pipe(Effect.flatMap((source) => acquireLibraryWeb("/library", source, "captures/example")))
 * console.log(Effect.isEffect(acquisition))
 * ```
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const acquireLibraryWeb = Effect.fn("Library.acquireWeb")(function* (
  root: string,
  source: LibrarySource,
  prefix: string
) {
  const request = Effect.gen(function* () {
    const driver = yield* Firecrawl;
    return yield* driver.scrape(
      FirecrawlScrapePayload.make({
        url: source.canonicalUrl,
        options: O.some({ formats: ["markdown", "rawHtml"], onlyMainContent: false, timeout: 60_000 }),
      })
    );
  });
  const provided = yield* Effect.serviceOption(Firecrawl);
  const success = yield* O.isSome(provided)
    ? request
    : Effect.scoped(
        Layer.build(Firecrawl.layer).pipe(Effect.flatMap((context) => request.pipe(Effect.provide(context))))
      );
  const response = yield* encodeLibraryJson(success);
  const raw = yield* saveLibraryText(root, `${prefix}/response.json`, response, "application/json", "raw-response");
  const retained: Array<LibraryArtifact> = [raw];
  return yield* Effect.gen(function* () {
    let validated = yield* validateLibraryScrape(source.canonicalUrl, success.data).pipe(Effect.result);
    const extra: Array<LibraryArtifact> = [];
    const confirmScrapeRedirect = Effect.fn("Library.web.confirmRedirect")(function* () {
      const candidate = yield* S.decodeUnknownEffect(ScrapedDocument)(success.data).pipe(Effect.option);
      if (O.isSome(candidate) && candidate.value.metadata.sourceURL !== source.canonicalUrl) {
        const client = yield* HttpClient.HttpClient;
        const redirect = yield* client
          .get(source.canonicalUrl)
          .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk), Effect.timeout("30 seconds"), Effect.option);
        if (O.isSome(redirect) && redirect.value.url === candidate.value.metadata.sourceURL) {
          validated = yield* validateLibraryScrape(redirect.value.url, success.data).pipe(Effect.result);
          extra.push(
            yield* saveLibraryText(
              root,
              `${prefix}/redirect.json`,
              yield* encodeLibraryJson({
                requestedUrl: source.canonicalUrl,
                resolvedUrl: redirect.value.url,
                status: redirect.value.status,
                providerSourceUrl: candidate.value.metadata.sourceURL,
                identityMerged: false,
              }),
              "application/json",
              "target-metadata"
            )
          );
        }
      }
    });
    if (Result.isFailure(validated)) yield* confirmScrapeRedirect();
    if (Result.isFailure(validated))
      return LibraryAdapterResult.make({
        artifacts: [raw, ...extra],
        revision: source.revision,
        status: "blocked",
        complete: false,
        reason: validated.failure.message,
      });
    const document = validated.success;
    const html = yield* saveLibraryText(root, `${prefix}/source.html`, document.rawHtml, "text/html", "raw-full-text");
    retained.push(html);
    const markdown = yield* saveLibraryText(
      root,
      `${prefix}/source.md`,
      document.markdown,
      "text/markdown",
      "extracted-full-text"
    );
    retained.push(markdown, ...extra);
    return LibraryAdapterResult.make({
      artifacts: retained,
      revision: source.revision,
      status: "readable",
      complete: true,
      reason: "Target metadata validated; raw HTML and extracted full text preserved.",
    });
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed(
        LibraryAdapterResult.make({
          artifacts: retained,
          revision: source.revision,
          status: "blocked",
          complete: false,
          reason: `Web acquisition incomplete: ${Str.slice(0, 2000)(error.message)}. Raw provider response retained.`,
        })
      )
    )
  );
});

/**
 * Capture a scholarly PDF and retain publisher landing pages as partial evidence.
 * **Example** (Prepare a source-bound acquisition)
 * ```ts
 * import { acquireLibraryPaper } from "@beep/repo-cli/test/ResearchLibrary"
 * import { classifyLibraryReference } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 * const acquisition = classifyLibraryReference("https://arxiv.org/abs/2610.00609", "report").pipe(Effect.flatMap((source) => acquireLibraryPaper("/library", source, "captures/example")))
 * console.log(Effect.isEffect(acquisition))
 * ```
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const acquireLibraryPaper = Effect.fn("Library.acquirePaper")(function* (
  root: string,
  source: LibrarySource,
  prefix: string
) {
  const arxiv = Str.match(/(?:arxiv\.org|alphaxiv\.org)\/(?:abs|pdf|overview)\/(\d{4}\.\d{4,5}(?:v\d+)?)/)(
    source.canonicalUrl
  );
  const pdfUrl = O.isSome(arxiv) ? `https://arxiv.org/pdf/${arxiv.value[1]}` : source.canonicalUrl;
  const artifacts: Array<LibraryArtifact> = [];
  return yield* Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    let fetchedUrl = pdfUrl;
    let response = yield* client.get(fetchedUrl).pipe(Effect.timeout("90 seconds"));
    let bytes = yield* readBoundedPaperBody(response, true).pipe(Effect.timeout("90 seconds"));
    const resolvePublisherPdf = Effect.fn("Library.paper.resolvePublisherPdf")(function* () {
      const landing = yield* saveImmutable(root, `${prefix}/landing.html`, bytes);
      artifacts.push(LibraryArtifact.make({ ...landing, mediaType: "text/html", role: "publisher-landing-page" }));
      artifacts.push(
        yield* saveLibraryText(
          root,
          `${prefix}/landing-target.json`,
          yield* encodeLibraryJson({
            requestedUrl: source.canonicalUrl,
            resolvedUrl: response.url,
            status: response.status,
            contentType: response.headers["content-type"] ?? "",
            fullText: false,
          }),
          "application/json",
          "publisher-target-metadata"
        )
      );
      if (response.status < 200 || response.status >= 300 || bytes.byteLength > 5_000_000) {
        return O.some(
          LibraryAdapterResult.make({
            artifacts,
            revision: source.revision,
            status: "blocked",
            complete: false,
            reason: `Publisher target returned HTTP ${response.status} without a supported PDF; original response retained.`,
          })
        );
      }
      const locator = publisherPdfLocator(new TextDecoder().decode(bytes));
      const candidate = yield* Effect.try({
        try: () => {
          const page = new URL(response.url);
          return Str.isNonEmpty(locator)
            ? new URL(Str.replace(/&amp;/g, "&")(locator), page)
            : page.hostname === "openreview.net" && page.pathname === "/forum" && page.searchParams.has("id")
              ? new URL(`/pdf?id=${encodeURIComponent(page.searchParams.get("id") ?? "")}`, page)
              : undefined;
        },
        catch: (cause) => LibraryError.make({ cause, message: "Publisher PDF locator was not a valid URL." }),
      });
      if (!publisherCandidateAllowed(candidate, fetchedUrl)) {
        return O.some(
          LibraryAdapterResult.make({
            artifacts,
            revision: source.revision,
            status: "blocked",
            complete: false,
            reason:
              "Publisher landing page retained; no explicit downloadable full-paper PDF located. Abstract or portal text is incomplete evidence.",
          })
        );
      }
      if (candidate === undefined)
        return yield* LibraryError.make({
          cause: "identity",
          message: "Publisher PDF locator missing after validation.",
        });
      fetchedUrl = candidate.href;
      response = yield* client.get(fetchedUrl).pipe(Effect.timeout("90 seconds"));
      bytes = yield* readBoundedPaperBody(response, true).pipe(Effect.timeout("90 seconds"));
      return O.none();
    });
    if (!isPdf(bytes)) {
      const partial = yield* resolvePublisherPdf();
      if (O.isSome(partial)) return partial.value;
    }
    const retainFailedPdf = Effect.fn("Library.paper.retainFailedPdf")(function* () {
      const failed = yield* saveImmutable(root, `${prefix}/pdf-response.bin`, bytes);
      artifacts.push(
        LibraryArtifact.make({
          ...failed,
          mediaType: response.headers["content-type"] ?? "application/octet-stream",
          role: "raw-response",
        })
      );
      artifacts.push(
        yield* saveLibraryText(
          root,
          `${prefix}/pdf-response-target.json`,
          yield* encodeLibraryJson({
            requestedUrl: source.canonicalUrl,
            pdfUrl: fetchedUrl,
            resolvedUrl: response.url,
            status: response.status,
          }),
          "application/json",
          "target-metadata"
        )
      );
      return LibraryAdapterResult.make({
        artifacts,
        revision: source.revision,
        status: "blocked",
        complete: false,
        reason: `Full-paper target returned HTTP ${response.status} without a supported-size PDF signature; response retained.`,
      });
    });
    if (!successfulPdf(response.status, bytes)) return yield* retainFailedPdf();
    const saved = yield* saveImmutable(root, `${prefix}/source.pdf`, bytes);
    const pdf = LibraryArtifact.make({ ...saved, mediaType: "application/pdf", role: "raw-full-text" });
    artifacts.push(pdf);
    const path = yield* Path.Path;
    const text = yield* runLibraryCommand(root, "pdftotext", ["-enc", "UTF-8", path.join(root, pdf.path), "-"]);
    if (Str.isEmpty(Str.trim(text)))
      return LibraryAdapterResult.make({
        artifacts,
        revision: source.revision,
        status: "blocked",
        complete: false,
        reason: "PDF acquired but contains no extracted text; OCR evidence required.",
      });
    const extracted = yield* saveLibraryText(root, `${prefix}/source.txt`, text, "text/plain", "extracted-full-text");
    artifacts.push(extracted);
    const observation = paperHeaderObservation(text);
    const actual = observation.actual;
    let capturedRevision = observation.capturedRevision;
    let observedPaperId = observation.observedPaperId;
    let paperIdentityMatches = observedPaperMatches(arxiv, actual);
    const bindVersionedPdf = Effect.fn("Library.paper.bindVersionedPdf")(function* (
      paperId: string,
      observedRevision: string,
      metadataUrl: string,
      metadataStatus: number,
      metadataSha256: string
    ) {
      const explicitUrl = `https://arxiv.org/pdf/${paperId}${observedRevision}`;
      const explicitResponse = yield* client.get(explicitUrl).pipe(Effect.timeout("90 seconds"));
      const explicitBytes = yield* readBoundedPaperBody(explicitResponse, true).pipe(Effect.timeout("90 seconds"));
      const explicitHash = yield* hashBytes(explicitBytes);
      const versionedSaved = yield* saveImmutable(root, `${prefix}/versioned-source.pdf`, explicitBytes);
      artifacts.push(
        LibraryArtifact.make({ ...versionedSaved, mediaType: "application/pdf", role: "versioned-pdf-response" })
      );
      const bound = successfulPdf(explicitResponse.status, explicitBytes) && explicitHash === pdf.sha256;
      artifacts.push(
        yield* saveLibraryText(
          root,
          `${prefix}/arxiv-version-proof.json`,
          yield* encodeLibraryJson({
            metadataUrl,
            metadataStatus: metadataStatus,
            metadataSha256: metadataSha256,
            paperId: paperId,
            observedRevision: observedRevision,
            explicitUrl,
            resolvedUrl: explicitResponse.url,
            status: explicitResponse.status,
            originalPdfSha256: pdf.sha256,
            versionedPdfSha256: explicitHash,
            identicalPdf: bound,
          }),
          "application/json",
          "arxiv-version-proof"
        )
      );
      if (bound) {
        capturedRevision = observedRevision ?? "";
        observedPaperId = paperId ?? "";
        paperIdentityMatches = true;
      }
    });
    const observeHeaderlessVersion = Effect.fn("Library.paper.observeHeaderlessVersion")(function* (citedId: string) {
      const metadataUrl = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(citedId)}`;
      const metadataResponse = yield* client.get(metadataUrl).pipe(Effect.timeout("60 seconds"));
      const atom = new TextDecoder().decode(
        yield* readBoundedPaperBody(metadataResponse, false).pipe(Effect.timeout("90 seconds"))
      );
      const originalMetadata = yield* saveLibraryText(
        root,
        `${prefix}/arxiv-metadata.xml`,
        atom,
        "application/atom+xml",
        "arxiv-version-metadata"
      );
      artifacts.push(originalMetadata);
      const observed = Str.match(/<id>\s*https?:\/\/arxiv\.org\/abs\/(\d{4}\.\d{4,5})(v\d+)\s*<\/id>/i)(atom);
      if (
        metadataResponse.status >= 200 &&
        metadataResponse.status < 300 &&
        O.isSome(observed) &&
        observed.value[1] === Str.replace(/v\d+$/, "")(citedId) &&
        (Str.isEmpty(source.revision) || observed.value[2] === source.revision)
      ) {
        yield* bindVersionedPdf(
          observed.value[1] ?? "",
          observed.value[2] ?? "",
          metadataUrl,
          metadataResponse.status,
          originalMetadata.sha256
        );
      }
    });
    if (O.isSome(arxiv) && O.isNone(actual)) yield* observeHeaderlessVersion(arxiv.value[1] ?? "");
    const finishPaperReceipt = Effect.fn("Library.paper.finishReceipt")(function* () {
      const versionMatches = Str.isEmpty(source.revision) || source.revision === capturedRevision;
      const metadata = yield* saveLibraryText(
        root,
        `${prefix}/target.json`,
        yield* encodeLibraryJson({
          requestedUrl: source.canonicalUrl,
          pdfUrl: fetchedUrl,
          resolvedUrl: response.url,
          status: response.status,
          requestedRevision: source.revision,
          capturedRevision,
          paperId: observedPaperId,
          paperIdentityMatches,
          versionMatches,
        }),
        "application/json",
        "target-metadata"
      );
      return LibraryAdapterResult.make({
        artifacts: [...artifacts, metadata],
        revision: O.isSome(arxiv) ? capturedRevision : source.revision,
        status: paperIdentityMatches && versionMatches ? "readable" : "blocked",
        complete: paperIdentityMatches && versionMatches,
        reason:
          paperIdentityMatches && versionMatches
            ? "PDF signature, identity, retrieved version, and HTTP status validated; full text extracted with pdftotext."
            : "PDF preserved but extracted identity or retrieved version did not match the cited paper; evidence incomplete.",
      });
    });
    return yield* finishPaperReceipt();
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed(
        LibraryAdapterResult.make({
          artifacts,
          revision: source.revision,
          status: "blocked",
          complete: false,
          reason: `Paper acquisition incomplete: ${Str.slice(0, 2000)(error.message)}. Retained artifacts remain available.`,
        })
      )
    )
  );
});
