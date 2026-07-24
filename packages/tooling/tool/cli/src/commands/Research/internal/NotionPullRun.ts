/**
 * Research internal NotionPullRun.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, DateTime, Effect, MutableHashSet, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ResearchCommandError } from "../Research.errors.ts";
import { KnowledgeCardFrontmatter, ResearchNotionPullSummary } from "../Research.schemas.ts";
import { catalogDbPath, loadSeenUrls, persistCards } from "./CatalogOps.ts";
import { findDatabaseId, queryPageLinks, querySavedLinks, readLinksFile } from "./NotionPull.ts";
import { normalizeUrl, slugFor, VAULT_DIRS } from "./Vault.ts";
import type { ResearchNotionPullOptions } from "../Research.schemas.ts";
import type { ResearchCommandServiceRequirements } from "../Research.service.ts";
import type { CardPersistRow } from "./CatalogOps.ts";

const decodeNotionPullSummary = S.decodeUnknownEffect(ResearchNotionPullSummary);

/**
 * Pull saved Notion links into research x-post cards.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { notionPullImpl } from "@beep/repo-cli/commands/Research/internal/NotionPullRun"
 * import { ResearchNotionPullOptions } from "@beep/repo-cli/commands/Research"
 *
 * const program = notionPullImpl(
 *   ResearchNotionPullOptions.make({ database: "Reading List", vaultRoot: "/repo/.research" })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const notionPullImpl = Effect.fn("Research.notionPullImpl")(function* (
  options: ResearchNotionPullOptions
): Effect.fn.Return<ResearchNotionPullSummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const path = yield* Path.Path;
  const databasePath = yield* catalogDbPath(options.vaultRoot);
  const seen = yield* loadSeenUrls(databasePath);
  const links =
    options.linksFile !== undefined
      ? yield* readLinksFile(options.linksFile)
      : options.pageId !== undefined
        ? yield* queryPageLinks(options.pageId)
        : yield* querySavedLinks(yield* findDatabaseId(options.database));
  const capturedAt = DateTime.formatIso(yield* DateTime.now);

  const cards: Array<CardPersistRow> = [];
  let skippedSeen = 0;
  for (const link of links) {
    const urlNorm = yield* O.match(link.url, {
      onNone: () => Effect.succeedNone,
      onSome: (url) => normalizeUrl(url).pipe(Effect.option),
    });
    if (O.isNone(urlNorm) || MutableHashSet.has(seen, urlNorm.value)) {
      skippedSeen += 1;
      continue;
    }
    MutableHashSet.add(seen, urlNorm.value);
    const frontmatter = KnowledgeCardFrontmatter.make({
      capturedAt,
      id: `kb-xpost-${link.pageId.replaceAll("-", "").slice(0, 16)}`,
      related: [],
      sourceType: "x-post",
      status: "inbox",
      tags: link.tags,
      title: link.title,
      url: urlNorm.value,
      via: "notion-pull",
    });
    const body = [
      `# ${link.title}`,
      "",
      `> Saved to Notion ("${options.database}") on ${Str.isEmpty(link.createdIso) ? "(unknown)" : link.createdIso}.`,
      "",
      `Open: <${urlNorm.value}>`,
    ].join("\n");
    cards.push({
      body,
      frontmatter,
      relativePath: path.join(VAULT_DIRS.xPosts, `${slugFor(link.title, urlNorm.value)}.md`),
    });
  }

  yield* persistCards(options.vaultRoot, databasePath, "notion-pull", cards);
  const summary = yield* decodeNotionPullSummary({
    cardsWritten: A.length(cards),
    pagesSeen: A.length(links),
    skippedSeen,
  }).pipe(ResearchCommandError.mapError("Notion-pull summary failed schema validation."));
  yield* Console.log(
    `research notion-pull: pages=${summary.pagesSeen} written=${summary.cardsWritten} skipped=${summary.skippedSeen}`
  );
  return summary;
});
