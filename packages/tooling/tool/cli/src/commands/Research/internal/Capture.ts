/**
 * Research internal Capture.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { Firecrawl, FirecrawlScrapePayload } from "@beep/firecrawl";
import { Console, DateTime, Effect, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { ResearchCommandError } from "../Research.errors.ts";
import { KnowledgeCardFrontmatter, ResearchCaptureSummary } from "../Research.schemas.ts";
import {
  INSERT_CAPTURE_LOG,
  INSERT_SEEN_URL,
  runWithResearchDb,
  SELECT_SEEN_URL,
  singleCount,
  UPSERT_CARD,
} from "./Catalog.ts";
import { catalogDbPath } from "./CatalogOps.ts";
import { asRecord } from "./UnknownRecord.ts";
import { normalizeUrl, renderCard, sha256HexOf, slugFor, VAULT_DIRS, writeCard } from "./Vault.ts";
import type { FirecrawlScrapeSuccess } from "@beep/firecrawl";
import type { ResearchCaptureOptions } from "../Research.schemas.ts";
import type { ResearchCommandServiceRequirements } from "../Research.service.ts";

const scrapeMarkdown = Effect.fn("Research.scrapeMarkdown")(function* (
  url: string
): Effect.fn.Return<FirecrawlScrapeSuccess, ResearchCommandError> {
  const payload = FirecrawlScrapePayload.make({ url });
  const scrapeWithService = Effect.gen(function* () {
    const firecrawl = yield* Firecrawl;
    return yield* firecrawl.scrape(payload);
  });
  const provided = yield* Effect.serviceOption(Firecrawl);
  return yield* O.match(provided, {
    onNone: () =>
      Effect.scoped(
        Layer.build(Firecrawl.layer).pipe(Effect.flatMap((context) => scrapeWithService.pipe(Effect.provide(context))))
      ),
    onSome: (firecrawl) => firecrawl.scrape(payload),
  }).pipe(ResearchCommandError.mapError(`Firecrawl scrape failed for "${url}".`));
});

const documentMarkdown = (success: FirecrawlScrapeSuccess): O.Option<string> =>
  asRecord(success.data).pipe(
    O.flatMap((document) => O.fromNullishOr(document.markdown)),
    O.filter(P.isString),
    O.filter(Str.isNonEmpty)
  );

const documentTitle = (success: FirecrawlScrapeSuccess): O.Option<string> =>
  asRecord(success.data).pipe(
    O.flatMap((document) => O.fromNullishOr(document.metadata)),
    O.flatMap(asRecord),
    O.flatMap((metadata) => O.fromNullishOr(metadata.title)),
    O.filter(P.isString),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty)
  );

/**
 * Capture a URL as a knowledge card through Firecrawl.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { captureUrlImpl } from "@beep/repo-cli/commands/Research/internal/Capture"
 * import { ResearchCaptureOptions } from "@beep/repo-cli/commands/Research"
 *
 * const program = captureUrlImpl(
 *   ResearchCaptureOptions.make({ tags: ["ml"], url: "https://example.com/post", vaultRoot: "/repo/.research" })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const captureUrlImpl = Effect.fn("Research.captureUrlImpl")(function* (
  options: ResearchCaptureOptions
): Effect.fn.Return<ResearchCaptureSummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const path = yield* Path.Path;
  const urlNorm = yield* normalizeUrl(options.url);
  const databasePath = yield* catalogDbPath(options.vaultRoot);

  const alreadySeen = yield* runWithResearchDb(
    Effect.gen(function* () {
      const db = yield* DuckDb;
      const rows = yield* db.query(SELECT_SEEN_URL, [urlNorm]);
      return yield* singleCount(rows, "seen URLs");
    }),
    {
      databasePath,
      message: `Failed checking seen URLs in "${databasePath}".`,
    }
  );
  if (alreadySeen > 0) {
    yield* Console.log(`research capture: already captured "${urlNorm}" (use the vault card; no re-scrape).`);
    return ResearchCaptureSummary.make({ cardPath: "", id: "", skipped: true, title: "" });
  }

  const success = yield* scrapeMarkdown(options.url);
  const markdown = documentMarkdown(success);
  if (O.isNone(markdown)) {
    return yield* ResearchCommandError.make({
      message: `Firecrawl returned no markdown for "${options.url}".`,
    });
  }
  const title = documentTitle(success).pipe(O.getOrElse(() => urlNorm));

  const now = DateTime.formatIso(yield* DateTime.now);
  const id = `kb-article-${sha256HexOf(urlNorm).slice(0, 16)}`;
  const body = `# ${title}\n\n${markdown.value}`;
  const frontmatter = KnowledgeCardFrontmatter.make({
    capturedAt: now,
    contentHash: sha256HexOf(body),
    id,
    related: [],
    sourceType: "article",
    status: "inbox",
    tags: options.tags,
    title,
    url: urlNorm,
    via: "capture",
  });
  const cardRelativePath = path.join(VAULT_DIRS.articles, `${slugFor(title, urlNorm)}.md`);
  yield* writeCard(options.vaultRoot, cardRelativePath, renderCard(frontmatter, body));

  yield* runWithResearchDb(
    Effect.gen(function* () {
      const db = yield* DuckDb;
      yield* db.run(INSERT_SEEN_URL, [urlNorm, now, "capture"]);
      yield* db.run(UPSERT_CARD, [
        id,
        cardRelativePath,
        urlNorm,
        "article",
        "inbox",
        sha256HexOf(body),
        now,
        null,
        title,
      ]);
      yield* db.run(INSERT_CAPTURE_LOG, [now, "capture", urlNorm, "captured"]);
    }),
    {
      databasePath,
      message: `Failed recording capture in "${databasePath}".`,
    }
  );

  yield* Console.log(`research capture: wrote "${cardRelativePath}" (${id}).`);
  return ResearchCaptureSummary.make({ cardPath: cardRelativePath, id, skipped: false, title });
});
