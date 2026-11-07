/**
 * Native web, docs and registry acquisition through the Firecrawl driver.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { FIRECRAWL_API_KEY_REFERENCE, Firecrawl, FirecrawlError, FirecrawlScrapeRequest } from "@beep/firecrawl";
import { OnePasswordCli } from "@beep/onepassword-cli";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LibraryAdapterResult, saveLibraryText } from "./Library.adapter.ts";
import { LibraryArtifact } from "./Library.schemas.ts";
import { saveImmutable } from "./Library.store.ts";
import { validateLibraryScrape } from "./Library.web.ts";
import type { LibrarySource } from "./Library.schemas.ts";

/**
 * Acquisition route identifier for native web, docs and registry captures.
 *
 * **Details**
 *
 * Captures imported from session scrapes in October carry the same method, so native and imported
 * captures verify under one `Library.web.ts` contract.
 *
 * **Example** (Recognize the web route)
 *
 * ```ts
 * import { libraryWebAdapter } from "@beep/repo-cli/commands/Research"
 *
 * console.log(libraryWebAdapter) // "firecrawl"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const libraryWebAdapter = "firecrawl";

const resolveFirecrawlKey = (op: OnePasswordCli["Service"], configured: O.Option<Redacted.Redacted<string>>) => {
  const read = (reference: string) =>
    op
      .read(reference)
      .pipe(
        Effect.mapError(() =>
          FirecrawlError.fromReason("config", "The Firecrawl key reference could not be resolved through op.")
        )
      );
  return O.match(configured, {
    onNone: () => read(FIRECRAWL_API_KEY_REFERENCE),
    onSome: (value) =>
      O.match(O.filter(O.some(value.pipe(Redacted.value)), Str.startsWith("op://")), {
        onNone: () => Effect.succeed(value),
        onSome: read,
      }),
  });
};

/**
 * Live Firecrawl layer whose key is resolved through the PATH `op` shim on the first scrape.
 *
 * **Details**
 *
 * `FIRECRAWL_API_KEY` may hold a resolved key (for example under `op run`) or an `op://` reference;
 * without it the canonical reference is read. Commands that never scrape never invoke `op`.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { LibraryFirecrawlLive } from "@beep/repo-cli/test/ResearchLibrary"
 *
 * console.log(LibraryFirecrawlLive !== undefined)
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const LibraryFirecrawlLive = Layer.unwrap(
  Effect.gen(function* () {
    const op = yield* OnePasswordCli;
    const configured = yield* Config.Redacted("FIRECRAWL_API_KEY").pipe(Config.option, Effect.orElseSucceed(O.none));
    return Firecrawl.makeLayerWithKey(resolveFirecrawlKey(op, configured));
  })
).pipe(Layer.provide(OnePasswordCli.makeLayer()));

/**
 * Capture a web, docs or registry source as a byte-bound Firecrawl response with its HTML and Markdown.
 *
 * **Details**
 *
 * The retained `raw-response` is the exact bounded response body, `raw-full-text` its `rawHtml`
 * and `extracted-full-text` its `markdown`. The capture is readable only when the unchanged
 * `validateLibraryScrape` contract accepts the target identity, status and content. Driver
 * failures stay typed at the driver boundary and become a blocked receipt here.
 *
 * **Example** (Prepare a native web acquisition)
 *
 * ```ts
 * import { acquireLibraryWeb } from "@beep/repo-cli/test/ResearchLibrary"
 * import { classifyLibraryReference } from "@beep/repo-cli/commands/Research"
 * import * as Effect from "effect/Effect";
 * const acquisition = classifyLibraryReference("https://example.org/report", "report").pipe(
 *   Effect.flatMap((source) => acquireLibraryWeb("/library", source, "captures/example"))
 * )
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
  const firecrawl = yield* Firecrawl;
  const scraped = yield* firecrawl
    .scrape(FirecrawlScrapeRequest.make({ url: source.canonicalUrl }))
    .pipe(Effect.timeout("150 seconds"), Effect.result);
  if (Result.isFailure(scraped)) {
    const failure = scraped.failure;
    const message = S.is(FirecrawlError)(failure) ? failure.message : "Firecrawl scrape timed out.";
    const reason = S.is(FirecrawlError)(failure) ? failure.reason : "timeout";
    return LibraryAdapterResult.make({
      artifacts: [],
      revision: source.revision,
      status: reason === "unsupported-content" ? "unsupported" : "blocked",
      complete: false,
      reason: `Firecrawl ${reason}: ${message}`,
    });
  }
  const result = scraped.success;
  const response = yield* saveImmutable(root, `${prefix}/firecrawl-response.json`, result.body);
  const html = yield* saveLibraryText(
    root,
    `${prefix}/page.html`,
    result.document.rawHtml,
    "text/html",
    "raw-full-text"
  );
  const markdown = yield* saveLibraryText(
    root,
    `${prefix}/page.md`,
    result.document.markdown,
    "text/markdown",
    "extracted-full-text"
  );
  const artifacts = [
    LibraryArtifact.make({ ...response, mediaType: "application/json", role: "raw-response" }),
    html,
    markdown,
  ];
  const validated = yield* validateLibraryScrape(source.canonicalUrl, result.document).pipe(Effect.result);
  return Result.isSuccess(validated)
    ? LibraryAdapterResult.make({
        artifacts,
        revision: source.revision,
        status: "readable",
        complete: true,
        reason: "Firecrawl target identity, 2xx status, raw HTML and Markdown validated; response bytes retained.",
      })
    : LibraryAdapterResult.make({
        artifacts,
        revision: source.revision,
        status: "blocked",
        complete: false,
        reason: `${validated.failure.message} Response retained.`,
      });
});
