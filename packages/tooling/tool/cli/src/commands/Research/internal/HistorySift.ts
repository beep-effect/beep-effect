/**
 * Research internal HistorySift.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, DateTime, Effect, FileSystem, MutableHashMap, MutableHashSet, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ResearchCommandError } from "../Research.errors.ts";
import { KnowledgeCardFrontmatter, ResearchHistorySiftSummary } from "../Research.schemas.ts";
import {
  canonicalizeForSift,
  chromeMicrosToIso,
  discoverProfiles,
  isInterestingUrl,
  readProfileHistory,
  unixSecondsToChromeMicros,
} from "./BrowserHistory.ts";
import { catalogDbPath, loadSeenUrls, persistCards } from "./CatalogOps.ts";
import { normalizeUrl, sha256HexOf, slugFor, VAULT_DIRS } from "./Vault.ts";
import type { ResearchHistorySiftOptions } from "../Research.schemas.ts";
import type { ResearchCommandServiceRequirements } from "../Research.service.ts";
import type { CardPersistRow } from "./CatalogOps.ts";

const decodeHistorySiftSummary = S.decodeUnknownEffect(ResearchHistorySiftSummary);

interface SiftCandidate {
  readonly lastVisitChrome: number;
  readonly title: string;
  readonly url: string;
  readonly visitCount: number;
}

interface SiftCollection {
  readonly byUrlNorm: MutableHashMap.MutableHashMap<string, SiftCandidate>;
  skippedFiltered: number;
  skippedSeen: number;
  urlsScanned: number;
}

const collectSiftRow = Effect.fnUntraced(function* (
  collection: SiftCollection,
  seen: MutableHashSet.MutableHashSet<string>,
  row: { readonly lastVisitChrome: number; readonly title: string; readonly url: string; readonly visitCount: number }
) {
  collection.urlsScanned += 1;
  if (!isInterestingUrl(row.url)) {
    collection.skippedFiltered += 1;
    return;
  }
  const urlNorm = yield* normalizeUrl(canonicalizeForSift(row.url)).pipe(Effect.option);
  if (O.isNone(urlNorm)) {
    collection.skippedFiltered += 1;
    return;
  }
  if (MutableHashSet.has(seen, urlNorm.value)) {
    collection.skippedSeen += 1;
    return;
  }
  const existing = MutableHashMap.get(collection.byUrlNorm, urlNorm.value);
  if (O.isNone(existing) || row.lastVisitChrome > existing.value.lastVisitChrome) {
    MutableHashMap.set(collection.byUrlNorm, urlNorm.value, {
      lastVisitChrome: row.lastVisitChrome,
      title: Str.isEmpty(Str.trim(row.title)) ? urlNorm.value : Str.trim(row.title),
      url: urlNorm.value,
      visitCount: row.visitCount,
    });
  }
});

const historyStubCard = (candidate: SiftCandidate, capturedAt: string, relativePath: string): CardPersistRow => {
  const frontmatter = KnowledgeCardFrontmatter.make({
    capturedAt,
    id: `kb-link-${sha256HexOf(candidate.url).slice(0, 16)}`,
    related: [],
    sourceType: "link",
    status: "inbox",
    tags: [],
    title: candidate.title,
    url: candidate.url,
    via: "history-sift",
  });
  const body = [
    `# ${candidate.title}`,
    "",
    `> Sifted from browser history: ${candidate.visitCount} visits, last on ${chromeMicrosToIso(candidate.lastVisitChrome)}.`,
    "",
    `Open: <${candidate.url}>`,
    "",
    "Triage: keep (capture it), file it under a topic, or delete this stub.",
  ].join("\n");
  return { body, frontmatter, relativePath };
};

/**
 * Sift browser history into inbox link cards.
 *
 * **Example** (Sift history into cards)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { historySiftImpl } from "@beep/repo-cli/commands/Research/internal/HistorySift"
 * import { ResearchHistorySiftOptions } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const program = historySiftImpl(
 *   ResearchHistorySiftOptions.make({
 *     browser: "all",
 *     sinceDays: NonNegativeInt.make(7),
 *     vaultRoot: "/repo/.research"
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const historySiftImpl = Effect.fn("Research.historySiftImpl")(function* (
  options: ResearchHistorySiftOptions
): Effect.fn.Return<ResearchHistorySiftSummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const databasePath = yield* catalogDbPath(options.vaultRoot);
  const seen = yield* loadSeenUrls(databasePath);
  const profiles = yield* discoverProfiles(options.browser);
  const nowMillis = DateTime.toEpochMillis(yield* DateTime.now);
  const cutoff = unixSecondsToChromeMicros(nowMillis / 1000 - options.sinceDays * 86_400);

  const collection: SiftCollection = {
    byUrlNorm: MutableHashMap.empty<string, SiftCandidate>(),
    skippedFiltered: 0,
    skippedSeen: 0,
    urlsScanned: 0,
  };
  yield* Effect.scoped(
    Effect.gen(function* () {
      const scratchDir = yield* fs
        .makeTempDirectoryScoped({ prefix: "beep-research-history-" })
        .pipe(ResearchCommandError.mapError("Failed creating browser history scratch directory."));
      for (const profile of profiles) {
        const rows = yield* readProfileHistory(profile, scratchDir, cutoff);
        yield* Effect.forEach(rows, (row) => collectSiftRow(collection, seen, row), { discard: true });
      }
    })
  );

  const capturedAt = DateTime.formatIso(yield* DateTime.now);
  const cards: Array<CardPersistRow> = A.map(A.fromIterable(MutableHashMap.values(collection.byUrlNorm)), (candidate) =>
    historyStubCard(candidate, capturedAt, path.join(VAULT_DIRS.inbox, `${slugFor(candidate.title, candidate.url)}.md`))
  );

  yield* persistCards(options.vaultRoot, databasePath, "history-sift", cards);
  const summary = yield* decodeHistorySiftSummary({
    profilesScanned: A.length(profiles),
    skippedFiltered: collection.skippedFiltered,
    skippedSeen: collection.skippedSeen,
    stubsWritten: A.length(cards),
    urlsScanned: collection.urlsScanned,
  }).pipe(ResearchCommandError.mapError("History-sift summary failed schema validation."));
  yield* Console.log(
    `research history-sift: profiles=${summary.profilesScanned} scanned=${summary.urlsScanned} stubs=${summary.stubsWritten} seen=${summary.skippedSeen} filtered=${summary.skippedFiltered}`
  );
  return summary;
});
