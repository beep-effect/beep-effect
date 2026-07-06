/**
 * Service implementation for research knowledge-vault commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { Firecrawl, FirecrawlScrapePayload } from "@beep/firecrawl";
import { $RepoCliId } from "@beep/identity/packages";
import {
  Config,
  Console,
  Context,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  MutableHashMap,
  MutableHashSet,
  Order,
  Path,
  Result,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";
import { printLines } from "../../internal/cli/Printer.js";
import {
  canonicalizeForSift,
  chromeMicrosToIso,
  discoverProfiles,
  isInterestingUrl,
  readProfileHistory,
  unixSecondsToChromeMicros,
} from "./internal/BrowserHistory.js";
import {
  CATALOG_DB_NAME,
  INSERT_CAPTURE_LOG,
  INSERT_SEEN_URL,
  runWithResearchDb,
  SELECT_SEEN_URL,
  singleCount,
  UPSERT_CARD,
} from "./internal/Catalog.js";
import { cogneeAdd, cogneeCognify, cogneeLogin, datasetForSourceType } from "./internal/CogneeClient.js";
import { postResearchEpisode } from "./internal/GraphitiEpisodes.js";
import { findDatabaseId, queryPageLinks, querySavedLinks, readLinksFile } from "./internal/NotionPull.js";
import { discoverClones, inspectClone, listStarredRepos, slugPartsOf } from "./internal/RepoCards.js";
import { asRecord } from "./internal/UnknownRecord.js";
import {
  normalizeUrl,
  renderCard,
  resolveVaultRoot,
  sha256HexOf,
  slugFor,
  VAULT_DIRS,
  writeCard,
} from "./internal/Vault.js";
import { ResearchCommandError } from "./Research.errors.js";
import {
  KnowledgeCardFrontmatter,
  ResearchCaptureSummary,
  ResearchCognifyOptions,
  ResearchCognifySummary,
  ResearchDailySummary,
  ResearchDigestOptions,
  ResearchDigestSummary,
  ResearchHistorySiftOptions,
  ResearchHistorySiftSummary,
  ResearchNotionPullOptions,
  ResearchNotionPullSummary,
  ResearchRepoCardSummary,
  ResearchStatusSummary,
} from "./Research.schemas.js";
import type { FirecrawlScrapeSuccess } from "@beep/firecrawl";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type {
  ResearchCaptureOptions,
  ResearchDailyOptions,
  ResearchRepoCardOptions,
  ResearchStatusOptions,
} from "./Research.schemas.js";

const $I = $RepoCliId.create("commands/Research/Research.service");

type ResearchCommandServiceRequirements =
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | HttpClient.HttpClient
  | Path.Path;

/**
 * Service contract for research knowledge-vault operations.
 *
 * @category services
 * @since 0.0.0
 */
export interface ResearchCommandServiceShape {
  /**
   * Scrape a URL to markdown and file it as a knowledge card.
   *
   * @since 0.0.0
   */
  readonly captureUrl: (options: ResearchCaptureOptions) => Effect.Effect<ResearchCaptureSummary, ResearchCommandError>;

  /**
   * Push pending cards into Cognee datasets and start cognify.
   *
   * @since 0.0.0
   */
  readonly cognify: (options: ResearchCognifyOptions) => Effect.Effect<ResearchCognifySummary, ResearchCommandError>;

  /**
   * Run the daily pipeline: sift, notion-pull, cognify, digest, commit.
   *
   * @since 0.0.0
   */
  readonly daily: (options: ResearchDailyOptions) => Effect.Effect<ResearchDailySummary, ResearchCommandError>;

  /**
   * Write the daily digest note from catalog data.
   *
   * @since 0.0.0
   */
  readonly digest: (options: ResearchDigestOptions) => Effect.Effect<ResearchDigestSummary, ResearchCommandError>;

  /**
   * Sift browser history into inbox link stubs.
   *
   * @since 0.0.0
   */
  readonly historySift: (
    options: ResearchHistorySiftOptions
  ) => Effect.Effect<ResearchHistorySiftSummary, ResearchCommandError>;

  /**
   * Pull saved links from the Notion database into x-post cards.
   *
   * @since 0.0.0
   */
  readonly notionPull: (
    options: ResearchNotionPullOptions
  ) => Effect.Effect<ResearchNotionPullSummary, ResearchCommandError>;

  /**
   * Write one knowledge card per cloned or starred repository.
   *
   * @since 0.0.0
   */
  readonly repoCard: (options: ResearchRepoCardOptions) => Effect.Effect<ResearchRepoCardSummary, ResearchCommandError>;

  /**
   * Report vault catalog counts and pipeline state.
   *
   * @since 0.0.0
   */
  readonly status: (options: ResearchStatusOptions) => Effect.Effect<ResearchStatusSummary, ResearchCommandError>;
}

/**
 * Service tag for research knowledge-vault operations.
 *
 * @example
 * ```ts
 * import { ResearchCommandService, ResearchStatusOptions } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(ResearchCommandService, (service) =>
 *   service.status(ResearchStatusOptions.make({ vaultRoot: "/home/user/knowledge" }))
 * )
 * console.log(program.pipe !== undefined) // true
 * ```
 * @category services
 * @since 0.0.0
 */
export class ResearchCommandService extends Context.Service<ResearchCommandService, ResearchCommandServiceShape>()(
  $I`ResearchCommandService`
) {}

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

const catalogDbPath = Effect.fn("Research.catalogDbPath")(function* (
  vaultRoot: string
): Effect.fn.Return<string, ResearchCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stateDir = path.join(vaultRoot, VAULT_DIRS.state);
  yield* fs
    .makeDirectory(stateDir, { recursive: true })
    .pipe(ResearchCommandError.mapError(`Failed creating vault state directory "${stateDir}".`));
  return path.join(stateDir, CATALOG_DB_NAME);
});

const captureUrlImpl = Effect.fn("Research.captureUrlImpl")(function* (
  options: ResearchCaptureOptions
): Effect.fn.Return<ResearchCaptureSummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const path = yield* Path.Path;
  const urlNorm = yield* normalizeUrl(options.url);
  const databasePath = yield* catalogDbPath(options.vaultRoot);

  const alreadySeen = yield* runWithResearchDb(
    databasePath,
    `Failed checking seen URLs in "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      const rows = yield* db.query(SELECT_SEEN_URL, [urlNorm]);
      return yield* singleCount(rows, "seen URLs");
    })
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
    databasePath,
    `Failed recording capture in "${databasePath}".`,
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
    })
  );

  yield* Console.log(`research capture: wrote "${cardRelativePath}" (${id}).`);
  return ResearchCaptureSummary.make({ cardPath: cardRelativePath, id, skipped: false, title });
});

interface CardPersistRow {
  readonly body: string;
  readonly frontmatter: KnowledgeCardFrontmatter;
  readonly relativePath: string;
}

const persistCards = Effect.fn("Research.persistCards")(function* (
  vaultRoot: string,
  databasePath: string,
  subcommand: string,
  cards: ReadonlyArray<CardPersistRow>
): Effect.fn.Return<void, ResearchCommandError, FileSystem.FileSystem | Path.Path> {
  if (A.length(cards) === 0) {
    return;
  }
  const now = DateTime.formatIso(yield* DateTime.now);
  for (const card of cards) {
    yield* writeCard(vaultRoot, card.relativePath, renderCard(card.frontmatter, card.body));
  }
  yield* runWithResearchDb(
    databasePath,
    `Failed recording ${subcommand} cards in "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      for (const card of cards) {
        const front = card.frontmatter;
        if (front.url !== undefined) {
          yield* db.run(INSERT_SEEN_URL, [front.url, now, front.via]);
        }
        yield* db.run(UPSERT_CARD, [
          front.id,
          card.relativePath,
          front.url ?? null,
          front.sourceType,
          front.status,
          sha256HexOf(card.body),
          front.capturedAt,
          null,
          front.title,
        ]);
      }
      yield* db.run(INSERT_CAPTURE_LOG, [now, subcommand, `${A.length(cards)} cards`, "written"]);
    })
  );
});

class SeenUrlRow extends S.Class<SeenUrlRow>($I`SeenUrlRow`)(
  { urlNorm: S.String },
  $I.annote("SeenUrlRow", {
    title: "Seen URL Row",
    description: "Research catalog row carrying one normalized seen URL.",
  })
) {}
const decodeSeenUrlRows = S.decodeUnknownEffect(S.Array(SeenUrlRow));

const loadSeenUrls = Effect.fn("Research.loadSeenUrls")(function* (
  databasePath: string
): Effect.fn.Return<MutableHashSet.MutableHashSet<string>, ResearchCommandError> {
  const rows = yield* runWithResearchDb(
    databasePath,
    `Failed loading seen URLs from "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      return yield* db.query('SELECT url_norm AS "urlNorm" FROM research_seen_urls');
    })
  );
  const decoded = yield* decodeSeenUrlRows(rows).pipe(
    ResearchCommandError.mapError("Seen-URL rows failed schema validation.")
  );
  const seen = MutableHashSet.empty<string>();
  A.forEach(decoded, (row) => {
    MutableHashSet.add(seen, row.urlNorm);
  });
  return seen;
});

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

const historySiftImpl = Effect.fn("Research.historySiftImpl")(function* (
  options: ResearchHistorySiftOptions
): Effect.fn.Return<ResearchHistorySiftSummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const path = yield* Path.Path;
  const databasePath = yield* catalogDbPath(options.vaultRoot);
  const seen = yield* loadSeenUrls(databasePath);
  const profiles = yield* discoverProfiles(options.browser);
  const nowMillis = DateTime.toEpochMillis(yield* DateTime.now);
  const cutoff = unixSecondsToChromeMicros(nowMillis / 1000 - options.sinceDays * 86_400);
  const scratchDir = path.join(options.vaultRoot, VAULT_DIRS.state, "tmp");

  const collection: SiftCollection = {
    byUrlNorm: MutableHashMap.empty<string, SiftCandidate>(),
    skippedFiltered: 0,
    skippedSeen: 0,
    urlsScanned: 0,
  };
  for (const profile of profiles) {
    const rows = yield* readProfileHistory(profile, scratchDir, cutoff);
    yield* Effect.forEach(rows, (row) => collectSiftRow(collection, seen, row), { discard: true });
  }

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

const decodeRepoCardSummary = S.decodeUnknownEffect(ResearchRepoCardSummary);

interface RepoCardCollection {
  readonly cards: Array<CardPersistRow>;
  cardsSkipped: number;
  reposScanned: number;
  starsScanned: number;
}

const collectCloneCards = Effect.fnUntraced(function* (
  options: ResearchRepoCardOptions,
  capturedAt: string,
  collection: RepoCardCollection,
  cardExists: (relativePath: string) => Effect.Effect<boolean>
) {
  const path = yield* Path.Path;
  const clones = yield* discoverClones(options.researchRoot);
  const selected =
    options.only === undefined
      ? clones
      : A.filter(clones, (dir) => Str.includes(options.only ?? "")(path.basename(dir).toLowerCase()));

  for (const repoDir of selected) {
    collection.reposScanned += 1;
    const info = yield* inspectClone(repoDir);
    const relativePath = path.join(VAULT_DIRS.repos, `${info.slugOwner}--${info.slugRepo}.md`);
    if (!options.force && (yield* cardExists(relativePath))) {
      collection.cardsSkipped += 1;
      continue;
    }
    const title = `${info.slugOwner}/${info.slugRepo}`;
    const frontmatter = KnowledgeCardFrontmatter.make({
      capturedAt,
      id: `kb-repo-${info.slugOwner}--${info.slugRepo}`,
      related: [],
      sourceType: "repo",
      status: "triaged",
      tags: ["cloned"],
      title,
      via: "repo-card",
      ...(O.isNone(info.remoteUrl) ? {} : { url: info.remoteUrl.value }),
    });
    const body = [
      `# ${title}`,
      "",
      `- Local clone: \`${info.localPath}\``,
      `- Remote: ${O.getOrElse(info.remoteUrl, () => "(none)")}`,
      `- License file: ${info.hasLicense ? "yes" : "no"}`,
      `- Last commit: ${O.getOrElse(info.lastCommitIso, () => "(unknown)")}`,
      "",
      "## README excerpt",
      "",
      O.getOrElse(info.readmeExcerpt, () => "_No README found._"),
    ].join("\n");
    collection.cards.push({ body, frontmatter, relativePath });
  }
});

const collectStarCards = Effect.fnUntraced(function* (
  options: ResearchRepoCardOptions,
  capturedAt: string,
  collection: RepoCardCollection,
  cardExists: (relativePath: string) => Effect.Effect<boolean>
) {
  const path = yield* Path.Path;
  const stars = yield* listStarredRepos(options.vaultRoot);
  for (const star of stars) {
    collection.starsScanned += 1;
    const [owner, repo] = slugPartsOf(O.some(star.html_url), star.full_name.replaceAll("/", "--"));
    const relativePath = path.join(VAULT_DIRS.repos, `${owner}--${repo}.md`);
    if (!options.force && (yield* cardExists(relativePath))) {
      collection.cardsSkipped += 1;
      continue;
    }
    const topics = star.topics ?? [];
    const frontmatter = KnowledgeCardFrontmatter.make({
      capturedAt,
      id: `kb-repo-${owner}--${repo}`,
      related: [],
      sourceType: "repo",
      status: "inbox",
      tags: ["starred"],
      title: star.full_name,
      url: star.html_url,
      via: "repo-card",
    });
    const body = [
      `# ${star.full_name}`,
      "",
      `- Remote: ${star.html_url}`,
      `- Language: ${star.language ?? "(unknown)"}`,
      A.length(topics) > 0 ? `- Topics: ${A.join(topics, ", ")}` : "- Topics: (none)",
      "",
      star.description ?? "_No description._",
    ].join("\n");
    collection.cards.push({ body, frontmatter, relativePath });
  }
});

const repoCardImpl = Effect.fn("Research.repoCardImpl")(function* (
  options: ResearchRepoCardOptions
): Effect.fn.Return<ResearchRepoCardSummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const databasePath = yield* catalogDbPath(options.vaultRoot);
  const capturedAt = DateTime.formatIso(yield* DateTime.now);
  const collection: RepoCardCollection = { cards: [], cardsSkipped: 0, reposScanned: 0, starsScanned: 0 };

  const cardExists = (relativePath: string) =>
    fs.exists(path.join(options.vaultRoot, relativePath)).pipe(Effect.orElseSucceed(() => false));

  yield* collectCloneCards(options, capturedAt, collection, cardExists);
  if (options.includeStars) {
    yield* collectStarCards(options, capturedAt, collection, cardExists);
  }

  yield* persistCards(options.vaultRoot, databasePath, "repo-card", collection.cards);
  const summary = yield* decodeRepoCardSummary({
    cardsSkipped: collection.cardsSkipped,
    cardsWritten: A.length(collection.cards),
    reposScanned: collection.reposScanned,
    starsScanned: collection.starsScanned,
  }).pipe(ResearchCommandError.mapError("Repo-card summary failed schema validation."));
  yield* Console.log(
    `research repo-card: repos=${summary.reposScanned} stars=${summary.starsScanned} written=${summary.cardsWritten} skipped=${summary.cardsSkipped}`
  );
  return summary;
});

const decodeNotionPullSummary = S.decodeUnknownEffect(ResearchNotionPullSummary);

const notionPullImpl = Effect.fn("Research.notionPullImpl")(function* (
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

class PendingCardRow extends S.Class<PendingCardRow>($I`PendingCardRow`)(
  {
    id: S.String,
    path: S.String,
    sourceType: S.String,
  },
  $I.annote("PendingCardRow", {
    title: "Pending Card Row",
    description: "Research catalog row for a card pending Cognee upload.",
  })
) {}
const decodePendingCardRows = S.decodeUnknownEffect(S.Array(PendingCardRow));
const decodeCognifySummary = S.decodeUnknownEffect(ResearchCognifySummary);

const COGNEE_ADD_BATCH_SIZE = 50;

interface CognifyUpload {
  readonly content: string;
  readonly fileName: string;
  readonly id: string;
}

const cognifyImpl = Effect.fn("Research.cognifyImpl")(function* (
  options: ResearchCognifyOptions
): Effect.fn.Return<ResearchCognifySummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const databasePath = yield* catalogDbPath(options.vaultRoot);

  const pendingRows = yield* runWithResearchDb(
    databasePath,
    `Failed loading pending cards from "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      return yield* db.query(
        `SELECT id AS "id", path AS "path", source_type AS "sourceType"
         FROM research_cards WHERE cognified_at IS NULL ORDER BY source_type, path`
      );
    })
  );
  const pending = yield* decodePendingCardRows(pendingRows).pipe(
    ResearchCommandError.mapError("Pending-card rows failed schema validation.")
  );

  const byDataset = MutableHashMap.empty<string, Array<CognifyUpload>>();
  for (const row of pending) {
    const absolutePath = path.join(options.vaultRoot, row.path);
    const content = yield* fs.readFileString(absolutePath).pipe(Effect.option);
    if (O.isNone(content)) {
      yield* Console.log(`research cognify: skipping missing card file "${row.path}".`);
      continue;
    }
    const dataset = datasetForSourceType(row.sourceType);
    const uploads = MutableHashMap.get(byDataset, dataset).pipe(O.getOrElse((): Array<CognifyUpload> => []));
    uploads.push({ content: content.value, fileName: `${row.id}.md`, id: row.id });
    MutableHashMap.set(byDataset, dataset, uploads);
  }

  const datasets = A.sort(A.fromIterable(MutableHashMap.keys(byDataset)), Order.String);
  const cardsPushed = A.reduce(MutableHashMap.values(byDataset), 0, (total, uploads) => total + A.length(uploads));

  if (options.dryRun || cardsPushed === 0) {
    for (const dataset of datasets) {
      const uploadCount = MutableHashMap.get(byDataset, dataset).pipe(
        O.map(A.length),
        O.getOrElse(() => 0)
      );
      yield* Console.log(`research cognify (dry-run): ${uploadCount} cards -> ${dataset}`);
    }
    if (cardsPushed === 0) {
      yield* Console.log("research cognify: nothing pending.");
    }
    return yield* decodeCognifySummary({ cardsPushed, datasets, dryRun: options.dryRun }).pipe(
      ResearchCommandError.mapError("Cognify summary failed schema validation.")
    );
  }

  const connection = yield* cogneeLogin();
  for (const dataset of datasets) {
    const uploads = MutableHashMap.get(byDataset, dataset).pipe(O.getOrElse((): Array<CognifyUpload> => []));
    for (let index = 0; index < A.length(uploads); index += COGNEE_ADD_BATCH_SIZE) {
      yield* cogneeAdd(connection, dataset, uploads.slice(index, index + COGNEE_ADD_BATCH_SIZE));
    }
    yield* Console.log(`research cognify: added ${A.length(uploads)} cards to ${dataset}.`);
  }
  yield* cogneeCognify(connection, datasets, true);

  const now = DateTime.formatIso(yield* DateTime.now);
  yield* runWithResearchDb(
    databasePath,
    `Failed stamping cognified cards in "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      for (const uploads of MutableHashMap.values(byDataset)) {
        for (const upload of uploads) {
          yield* db.run("UPDATE research_cards SET cognified_at = ? WHERE id = ?", [now, upload.id]);
        }
      }
      yield* db.run(INSERT_CAPTURE_LOG, [
        now,
        "cognify",
        `${cardsPushed} cards -> ${A.join(datasets, ", ")}`,
        "pushed",
      ]);
    })
  );

  yield* postResearchEpisode(
    "research cognify",
    `Pushed ${cardsPushed} knowledge cards into Cognee datasets ${A.join(datasets, ", ")} at ${now}.`
  );
  yield* Console.log(
    `research cognify: pushed=${cardsPushed} datasets=${A.join(datasets, ", ")} (cognify running in background).`
  );
  return yield* decodeCognifySummary({ cardsPushed, datasets, dryRun: false }).pipe(
    ResearchCommandError.mapError("Cognify summary failed schema validation.")
  );
});

class DigestCardRow extends S.Class<DigestCardRow>($I`DigestCardRow`)(
  {
    capturedAt: S.String,
    path: S.String,
    sourceType: S.String,
    title: S.NullOr(S.String),
  },
  $I.annote("DigestCardRow", {
    title: "Digest Card Row",
    description: "Research catalog card row used to render the daily digest.",
  })
) {}
const decodeDigestCardRows = S.decodeUnknownEffect(S.Array(DigestCardRow));
const decodeDigestSummary = S.decodeUnknownEffect(ResearchDigestSummary);

const wikilinkFor = (cardPath: string, title: string | null): string => {
  const target = cardPath.replace(/\.md$/, "");
  const label = title ?? target.split("/").pop() ?? target;
  return `[[${target}|${label}]]`;
};

const digestImpl = Effect.fn("Research.digestImpl")(function* (
  options: ResearchDigestOptions
): Effect.fn.Return<ResearchDigestSummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const path = yield* Path.Path;
  const databasePath = yield* catalogDbPath(options.vaultRoot);
  const now = yield* DateTime.now;
  const date = options.date ?? Str.slice(0, 10)(DateTime.formatIso(now));
  const cutoffIso = DateTime.formatIso(DateTime.subtract(now, { hours: 24 }));

  const { backlogRows, inboxBacklog, newRows, pendingCognify } = yield* runWithResearchDb(
    databasePath,
    `Failed querying digest data from "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      const newRows = yield* db.query(
        `SELECT title AS "title", path AS "path", source_type AS "sourceType", captured_at AS "capturedAt"
         FROM research_cards WHERE captured_at >= ? ORDER BY source_type, captured_at`,
        [cutoffIso]
      );
      const backlogRows = yield* db.query(
        `SELECT title AS "title", path AS "path", source_type AS "sourceType", captured_at AS "capturedAt"
         FROM research_cards WHERE status = 'inbox' ORDER BY captured_at ASC LIMIT 5`
      );
      const inboxBacklog = yield* db
        .query("SELECT COUNT(*)::DOUBLE AS total FROM research_cards WHERE status = 'inbox'")
        .pipe(Effect.flatMap((rows) => singleCount(rows, "inbox backlog")));
      const pendingCognify = yield* db
        .query("SELECT COUNT(*)::DOUBLE AS total FROM research_cards WHERE cognified_at IS NULL")
        .pipe(Effect.flatMap((rows) => singleCount(rows, "pending cognify")));
      return { backlogRows, inboxBacklog, newRows, pendingCognify };
    })
  );
  const newCards = yield* decodeDigestCardRows(newRows).pipe(
    ResearchCommandError.mapError("Digest new-card rows failed schema validation.")
  );
  const backlog = yield* decodeDigestCardRows(backlogRows).pipe(
    ResearchCommandError.mapError("Digest backlog rows failed schema validation.")
  );

  const lines: Array<string> = [`# Research digest — ${date}`, ""];
  if (A.length(newCards) === 0) {
    lines.push("_No new captures in the last 24 hours._", "");
  } else {
    lines.push(`## New captures (${A.length(newCards)})`, "");
    let currentType = "";
    for (const card of newCards) {
      if (card.sourceType !== currentType) {
        currentType = card.sourceType;
        lines.push(`### ${currentType}`, "");
      }
      lines.push(`- ${wikilinkFor(card.path, card.title)}`);
    }
    lines.push("");
  }
  lines.push(`## Inbox backlog: ${inboxBacklog}`, "");
  if (A.length(backlog) > 0) {
    lines.push("Oldest untriaged:", "");
    for (const card of backlog) {
      lines.push(`- ${wikilinkFor(card.path, card.title)} (since ${Str.slice(0, 10)(card.capturedAt)})`);
    }
    lines.push("");
  }
  lines.push(`Pending cognify: ${pendingCognify}`, "");

  const digestRelativePath = path.join(VAULT_DIRS.digest, `${date}.md`);
  yield* writeCard(options.vaultRoot, digestRelativePath, `${A.join(lines, "\n").trimEnd()}\n`);
  yield* Console.log(
    `research digest: wrote "${digestRelativePath}" (new=${A.length(newCards)} backlog=${inboxBacklog}).`
  );
  return yield* decodeDigestSummary({
    digestPath: digestRelativePath,
    inboxBacklog,
    newCards: A.length(newCards),
  }).pipe(ResearchCommandError.mapError("Digest summary failed schema validation."));
});

const decodeDailySummary = S.decodeUnknownEffect(ResearchDailySummary);

const commitVault = Effect.fn("Research.commitVault")(function* (
  vaultRoot: string
): Effect.fn.Return<void, ResearchCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const run = (args: ReadonlyArray<string>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.make("git", [...args], { cwd: vaultRoot, stderr: "pipe", stdout: "pipe" });
        return yield* handle.exitCode;
      })
    ).pipe(ResearchCommandError.mapError(`Failed running git ${A.join(args, " ")} in the vault.`));
  yield* run(["add", "-A"]);
  const status = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("git", ["diff", "--cached", "--quiet"], {
        cwd: vaultRoot,
        stderr: "pipe",
        stdout: "pipe",
      });
      return yield* handle.exitCode;
    })
  ).pipe(ResearchCommandError.mapError("Failed checking vault staging state."));
  if (status === 0) {
    yield* Console.log("research daily: vault clean, nothing to commit.");
    return;
  }
  const date = Str.slice(0, 10)(DateTime.formatIso(yield* DateTime.now));
  yield* run(["commit", "-q", "-m", `capture ${date}`]);
  yield* Console.log(`research daily: committed vault as "capture ${date}".`);
});

const dailyImpl = Effect.fn("Research.dailyImpl")(function* (
  options: ResearchDailyOptions
): Effect.fn.Return<ResearchDailySummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const ran: Array<string> = [];
  const skipped: Array<string> = [];
  const failed: Array<string> = [];

  const step: (
    name: string,
    work: Effect.Effect<unknown, ResearchCommandError, ResearchCommandServiceRequirements>
  ) => Effect.Effect<void, never, ResearchCommandServiceRequirements> = Effect.fnUntraced(function* (name, work) {
    const result = yield* Effect.result(work);
    if (Result.isFailure(result)) {
      failed.push(name);
      yield* Console.log(`research daily: step "${name}" failed: ${result.failure.message}`);
    } else {
      ran.push(name);
    }
  });

  yield* step(
    "history-sift",
    historySiftImpl(
      yield* S.decodeUnknownEffect(ResearchHistorySiftOptions)({
        browser: options.browser,
        sinceDays: options.sinceDays,
        vaultRoot: options.vaultRoot,
      }).pipe(ResearchCommandError.mapError("Invalid daily history-sift options."))
    )
  );

  if (options.notionPage === undefined) {
    skipped.push("notion-pull (no --page)");
  } else {
    yield* step(
      "notion-pull",
      notionPullImpl(
        ResearchNotionPullOptions.make({
          database: "Awesome X Posts",
          pageId: options.notionPage,
          vaultRoot: options.vaultRoot,
        })
      )
    );
  }

  const cogneeUrl = yield* Effect.orDie(Config.string("COGNEE_API_URL").pipe(Config.option));
  if (O.isNone(cogneeUrl)) {
    skipped.push("cognify (COGNEE_API_URL unset)");
  } else {
    yield* step("cognify", cognifyImpl(ResearchCognifyOptions.make({ dryRun: false, vaultRoot: options.vaultRoot })));
  }

  yield* step("digest", digestImpl(ResearchDigestOptions.make({ vaultRoot: options.vaultRoot })));

  if (options.commit) {
    yield* step("commit", commitVault(options.vaultRoot));
  }

  yield* Console.log(
    `research daily: ran=[${A.join(ran, ", ")}] skipped=[${A.join(skipped, ", ")}] failed=[${A.join(failed, ", ")}]`
  );
  return yield* decodeDailySummary({ failed, ran, skipped }).pipe(
    ResearchCommandError.mapError("Daily summary failed schema validation.")
  );
});

const decodeStatusSummary = S.decodeUnknownEffect(ResearchStatusSummary);

const statusImpl = Effect.fn("Research.statusImpl")(function* (
  options: ResearchStatusOptions
): Effect.fn.Return<ResearchStatusSummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const databasePath = path.join(options.vaultRoot, VAULT_DIRS.state, CATALOG_DB_NAME);
  const hasCatalog = yield* fs
    .exists(databasePath)
    .pipe(ResearchCommandError.mapError(`Failed checking catalog at "${databasePath}".`));

  if (!hasCatalog) {
    yield* Console.log(`research status: vault "${options.vaultRoot}" has no catalog yet; run a capture first.`);
    return yield* decodeStatusSummary({
      bySourceType: [],
      inboxCards: 0,
      pendingCognify: 0,
      seenUrls: 0,
      totalCards: 0,
    }).pipe(ResearchCommandError.mapError("Empty status summary failed schema validation."));
  }

  const summary = yield* runWithResearchDb(
    databasePath,
    `Failed querying catalog status at "${databasePath}".`,
    Effect.gen(function* () {
      const db = yield* DuckDb;
      const totalCards = yield* db
        .query("SELECT COUNT(*)::DOUBLE AS total FROM research_cards")
        .pipe(Effect.flatMap((rows) => singleCount(rows, "total cards")));
      const inboxCards = yield* db
        .query("SELECT COUNT(*)::DOUBLE AS total FROM research_cards WHERE status = 'inbox'")
        .pipe(Effect.flatMap((rows) => singleCount(rows, "inbox cards")));
      const pendingCognify = yield* db
        .query("SELECT COUNT(*)::DOUBLE AS total FROM research_cards WHERE cognified_at IS NULL")
        .pipe(Effect.flatMap((rows) => singleCount(rows, "pending cognify")));
      const seenUrls = yield* db
        .query("SELECT COUNT(*)::DOUBLE AS total FROM research_seen_urls")
        .pipe(Effect.flatMap((rows) => singleCount(rows, "seen URLs")));
      const sourceTypeRows = yield* db.query(
        `SELECT source_type AS "sourceType", COUNT(*)::DOUBLE AS "cards"
         FROM research_cards GROUP BY source_type ORDER BY source_type`
      );
      return yield* decodeStatusSummary({
        bySourceType: sourceTypeRows,
        inboxCards,
        pendingCognify,
        seenUrls,
        totalCards,
      }).pipe(ResearchCommandError.mapError("Catalog status summary failed schema validation."));
    })
  );

  const perType = A.map(summary.bySourceType, (row) => `${row.sourceType}=${row.cards}`);
  yield* Console.log(
    `research status: cards=${summary.totalCards} (${A.join(perType, ", ")}) inbox=${summary.inboxCards} pendingCognify=${summary.pendingCognify} seenUrls=${summary.seenUrls}`
  );
  return summary;
});

const makeResearchCommandService = Effect.fn("ResearchCommandService.make")(function* () {
  const runtimeContext = yield* Effect.context<ResearchCommandServiceRequirements>();

  return ResearchCommandService.of({
    captureUrl: Effect.fn("ResearchCommandService.captureUrl")((options) =>
      captureUrlImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    cognify: Effect.fn("ResearchCommandService.cognify")((options) =>
      cognifyImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    daily: Effect.fn("ResearchCommandService.daily")((options) =>
      dailyImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    digest: Effect.fn("ResearchCommandService.digest")((options) =>
      digestImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    historySift: Effect.fn("ResearchCommandService.historySift")((options) =>
      historySiftImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    notionPull: Effect.fn("ResearchCommandService.notionPull")((options) =>
      notionPullImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    repoCard: Effect.fn("ResearchCommandService.repoCard")((options) =>
      repoCardImpl(options).pipe(Effect.provide(runtimeContext))
    ),
    status: Effect.fn("ResearchCommandService.status")((options) =>
      statusImpl(options).pipe(Effect.provide(runtimeContext))
    ),
  });
});

/**
 * Live service layer for research knowledge-vault operations.
 *
 * @example
 * ```ts
 * import { ResearchCommandServiceLive } from "@beep/repo-cli/commands/Research"
 *
 * const layers = { research: ResearchCommandServiceLive }
 * console.log(Object.keys(layers)) // ["research"]
 * ```
 * @category layers
 * @since 0.0.0
 */
export const ResearchCommandServiceLive: Layer.Layer<
  ResearchCommandService,
  never,
  ResearchCommandServiceRequirements
> = Layer.effect(ResearchCommandService, makeResearchCommandService());

/**
 * Resolve the vault root from an optional flag value, the environment, or the
 * default location.
 *
 * @param vaultFlag - Optional `--vault` flag value.
 * @returns The absolute vault root path.
 * @effects Reads the environment and checks vault existence on the filesystem.
 * @example
 * ```ts
 * import { resolveResearchVaultRoot } from "@beep/repo-cli/commands/Research"
 * import * as O from "effect/Option"
 *
 * const resolved = resolveResearchVaultRoot(O.some("/home/user/knowledge"))
 * console.log(resolved.pipe !== undefined) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const resolveResearchVaultRoot = resolveVaultRoot;

/**
 * Scrape a URL to markdown and file it as a knowledge card in the vault.
 *
 * @param options - Capture options naming the vault root, URL, and tags.
 * @returns Summary describing the written (or skipped) card.
 * @effects Delegates to `ResearchCommandService`; the live service scrapes via Firecrawl, writes the markdown card, and records catalog rows.
 * @example
 * ```ts
 * import { captureResearchUrl, ResearchCaptureOptions } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 *
 * const options = ResearchCaptureOptions.make({
 *   tags: [],
 *   url: "https://example.com/post",
 *   vaultRoot: "/home/user/knowledge"
 * })
 * const cardPath = captureResearchUrl(options).pipe(Effect.map((summary) => summary.cardPath))
 * console.log(cardPath.pipe !== undefined) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const captureResearchUrl = Effect.fn("Research.captureResearchUrl")(function* (
  options: ResearchCaptureOptions
): Effect.fn.Return<ResearchCaptureSummary, ResearchCommandError, ResearchCommandService> {
  const research = yield* ResearchCommandService;
  return yield* research.captureUrl(options);
});

/**
 * Report vault catalog counts and pipeline state.
 *
 * @param options - Status options naming the vault root.
 * @returns Aggregate catalog counts.
 * @effects Delegates to `ResearchCommandService`; the live service reads the DuckDB catalog and logs a summary line.
 * @example
 * ```ts
 * import { researchStatus, ResearchStatusOptions } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 *
 * const options = ResearchStatusOptions.make({ vaultRoot: "/home/user/knowledge" })
 * const total = researchStatus(options).pipe(Effect.map((summary) => summary.totalCards))
 * console.log(total.pipe !== undefined) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const researchStatus = Effect.fn("Research.researchStatus")(function* (
  options: ResearchStatusOptions
): Effect.fn.Return<ResearchStatusSummary, ResearchCommandError, ResearchCommandService> {
  const research = yield* ResearchCommandService;
  return yield* research.status(options);
});

/**
 * Push pending knowledge cards into Cognee datasets and start cognify.
 *
 * @param options - Cognify options naming the vault root and dry-run mode.
 * @returns Counts for the push.
 * @effects Delegates to `ResearchCommandService`; the live service logs into the Cognee API, uploads card markdown per dataset, starts background cognify, and stamps the catalog.
 * @example
 * ```ts
 * import { cognifyResearchCards, ResearchCognifyOptions } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 *
 * const options = ResearchCognifyOptions.make({ dryRun: true, vaultRoot: "/home/user/knowledge" })
 * const pushed = cognifyResearchCards(options).pipe(Effect.map((summary) => summary.cardsPushed))
 * console.log(pushed.pipe !== undefined) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const cognifyResearchCards = Effect.fn("Research.cognifyResearchCards")(function* (
  options: ResearchCognifyOptions
): Effect.fn.Return<ResearchCognifySummary, ResearchCommandError, ResearchCommandService> {
  const research = yield* ResearchCommandService;
  return yield* research.cognify(options);
});

/**
 * Run the daily research pipeline: history-sift, notion-pull, cognify,
 * digest, and an optional vault commit.
 *
 * @param options - Daily options naming the vault root, lookback, and optional Notion page.
 * @returns Step outcomes for the run.
 * @effects Delegates to `ResearchCommandService`; steps that fail are logged and reported without aborting later steps.
 * @example
 * ```ts
 * import { runResearchDaily, ResearchDailyOptions } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const options = ResearchDailyOptions.make({
 *   browser: "all",
 *   commit: false,
 *   sinceDays: NonNegativeInt.make(2),
 *   vaultRoot: "/home/user/knowledge"
 * })
 * const ran = runResearchDaily(options).pipe(Effect.map((summary) => summary.ran))
 * console.log(ran.pipe !== undefined) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runResearchDaily = Effect.fn("Research.runResearchDaily")(function* (
  options: ResearchDailyOptions
): Effect.fn.Return<ResearchDailySummary, ResearchCommandError, ResearchCommandService> {
  const research = yield* ResearchCommandService;
  return yield* research.daily(options);
});

/**
 * Write the daily digest note from catalog data.
 *
 * @param options - Digest options naming the vault root and optional date.
 * @returns Counts for the digest note.
 * @effects Delegates to `ResearchCommandService`; the live service queries the catalog and writes `digest/<date>.md` in the vault.
 * @example
 * ```ts
 * import { writeResearchDigest, ResearchDigestOptions } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 *
 * const options = ResearchDigestOptions.make({ vaultRoot: "/home/user/knowledge" })
 * const digestPath = writeResearchDigest(options).pipe(Effect.map((summary) => summary.digestPath))
 * console.log(digestPath.pipe !== undefined) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const writeResearchDigest = Effect.fn("Research.writeResearchDigest")(function* (
  options: ResearchDigestOptions
): Effect.fn.Return<ResearchDigestSummary, ResearchCommandError, ResearchCommandService> {
  const research = yield* ResearchCommandService;
  return yield* research.digest(options);
});

/**
 * Sift browser history into inbox link stubs.
 *
 * @param options - History-sift options naming the vault root, browser family, and lookback window.
 * @returns Counts for the sift run.
 * @effects Delegates to `ResearchCommandService`; the live service copies locked history databases, scans them via DuckDB, and writes inbox stubs plus catalog rows.
 * @example
 * ```ts
 * import { siftResearchHistory, ResearchHistorySiftOptions } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const options = ResearchHistorySiftOptions.make({
 *   browser: "all",
 *   sinceDays: NonNegativeInt.make(7),
 *   vaultRoot: "/home/user/knowledge"
 * })
 * const stubs = siftResearchHistory(options).pipe(Effect.map((summary) => summary.stubsWritten))
 * console.log(stubs.pipe !== undefined) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const siftResearchHistory = Effect.fn("Research.siftResearchHistory")(function* (
  options: ResearchHistorySiftOptions
): Effect.fn.Return<ResearchHistorySiftSummary, ResearchCommandError, ResearchCommandService> {
  const research = yield* ResearchCommandService;
  return yield* research.historySift(options);
});

/**
 * Write one knowledge card per cloned or starred repository.
 *
 * @param options - Repo-card options naming the vault root and research clone library.
 * @returns Counts for the repo-card run.
 * @effects Delegates to `ResearchCommandService`; the live service inspects git clones (and optionally GitHub stars via `gh`) and writes repo cards plus catalog rows.
 * @example
 * ```ts
 * import { writeResearchRepoCards, ResearchRepoCardOptions } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 *
 * const options = ResearchRepoCardOptions.make({
 *   force: false,
 *   includeStars: false,
 *   researchRoot: "/home/user/research",
 *   vaultRoot: "/home/user/knowledge"
 * })
 * const written = writeResearchRepoCards(options).pipe(Effect.map((summary) => summary.cardsWritten))
 * console.log(written.pipe !== undefined) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const writeResearchRepoCards = Effect.fn("Research.writeResearchRepoCards")(function* (
  options: ResearchRepoCardOptions
): Effect.fn.Return<ResearchRepoCardSummary, ResearchCommandError, ResearchCommandService> {
  const research = yield* ResearchCommandService;
  return yield* research.repoCard(options);
});

/**
 * Pull saved links from the Notion database into x-post cards.
 *
 * @param options - Notion-pull options naming the vault root and database title.
 * @returns Counts for the pull run.
 * @effects Delegates to `ResearchCommandService`; the live service queries the Notion REST API with `NOTION_API_KEY` and writes x-post cards plus catalog rows.
 * @example
 * ```ts
 * import { pullResearchNotionLinks, ResearchNotionPullOptions } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 *
 * const options = ResearchNotionPullOptions.make({ database: "Awesome X Posts", vaultRoot: "/home/user/knowledge" })
 * const written = pullResearchNotionLinks(options).pipe(Effect.map((summary) => summary.cardsWritten))
 * console.log(written.pipe !== undefined) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const pullResearchNotionLinks = Effect.fn("Research.pullResearchNotionLinks")(function* (
  options: ResearchNotionPullOptions
): Effect.fn.Return<ResearchNotionPullSummary, ResearchCommandError, ResearchCommandService> {
  const research = yield* ResearchCommandService;
  return yield* research.notionPull(options);
});

/**
 * Print the research command index.
 *
 * @effects Writes the research command index to the configured console when the returned Effect is executed.
 * @example
 * ```ts
 * import { printResearchIndex } from "@beep/repo-cli/commands/Research"
 *
 * console.log(printResearchIndex.pipe !== undefined) // true
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const printResearchIndex = printLines([
  "Research commands:",
  "- bun run beep research capture <url> --tags effect,schema",
  "- bun run beep research history-sift --since-days 7 --browser all",
  "- bun run beep research repo-card --research-root ~/YeeBois/research --stars",
  '- bun run beep research notion-pull --page <page-id> (or --database "Awesome X Posts" / --links-file file.json)',
  "- bun run beep research cognify [--dry-run] (needs COGNEE_API_URL)",
  "- bun run beep research digest [--date YYYY-MM-DD]",
  "- bun run beep research daily --commit [--page <notion-page-id>]",
  "- bun run beep research install-timers [--uninstall] [--page <notion-page-id>]",
  "- bun run beep research status",
  "Vault resolution: --vault flag, BEEP_KNOWLEDGE_VAULT env, or ~/YeeBois/knowledge.",
]);
