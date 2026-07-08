/**
 * Schema models for research knowledge-vault commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Research/Research.schemas");

/**
 * Source kind recorded on a knowledge card.
 *
 * @example
 * ```ts
 * import { CardSourceType } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CardSourceType)("article")) // true
 * console.log(S.is(CardSourceType)("link")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CardSourceType = LiteralKit(["repo", "article", "x-post", "link"]).pipe(
  $I.annoteSchema("CardSourceType", {
    title: "Card Source Type",
    description: "Which kind of research source a knowledge card captures: repo, article, x-post, or untriaged link.",
  })
);

/**
 * Source kind type recorded on a knowledge card.
 *
 * @example
 * ```ts
 * import type { CardSourceType } from "@beep/repo-cli/commands/Research"
 *
 * const sourceType: CardSourceType = "article"
 * console.log(sourceType) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type CardSourceType = typeof CardSourceType.Type;

/**
 * Triage status recorded on a knowledge card.
 *
 * @example
 * ```ts
 * import { CardStatus } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CardStatus)("inbox")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CardStatus = LiteralKit(["inbox", "triaged", "integrated"]).pipe(
  $I.annoteSchema("CardStatus", {
    title: "Card Status",
    description: "Triage state of a knowledge card: inbox, triaged, or integrated into topics.",
  })
);

/**
 * Triage status type recorded on a knowledge card.
 *
 * @example
 * ```ts
 * import type { CardStatus } from "@beep/repo-cli/commands/Research"
 *
 * const status: CardStatus = "inbox"
 * console.log(status) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type CardStatus = typeof CardStatus.Type;

/**
 * Pipeline entry point that produced a knowledge card.
 *
 * @example
 * ```ts
 * import { CardVia } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CardVia)("capture")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CardVia = LiteralKit(["history-sift", "capture", "repo-card", "notion-pull", "manual"]).pipe(
  $I.annoteSchema("CardVia", {
    title: "Card Via",
    description: "Which research subcommand or manual action created the knowledge card.",
  })
);

/**
 * Pipeline entry point type that produced a knowledge card.
 *
 * @example
 * ```ts
 * import type { CardVia } from "@beep/repo-cli/commands/Research"
 *
 * const via: CardVia = "capture"
 * console.log(via) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type CardVia = typeof CardVia.Type;

/**
 * YAML frontmatter carried by every knowledge card in the vault.
 *
 * The `id` is stable for the card's lifetime and doubles as the Cognee
 * document id and Graphiti episode reference.
 *
 * @example
 * ```ts
 * import { KnowledgeCardFrontmatter } from "@beep/repo-cli/commands/Research"
 *
 * const frontmatter = KnowledgeCardFrontmatter.make({
 *   capturedAt: "2026-07-05T00:00:00.000Z",
 *   id: "kb-0f7c3a52-8e6f-4f1b-9f57-0a4be6cd2b11",
 *   related: [],
 *   sourceType: "article",
 *   status: "inbox",
 *   tags: ["effect"],
 *   title: "Span-grounded extraction",
 *   url: "https://example.com/post",
 *   via: "capture"
 * })
 * console.log(frontmatter.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class KnowledgeCardFrontmatter extends S.Class<KnowledgeCardFrontmatter>($I`KnowledgeCardFrontmatter`)(
  {
    capturedAt: S.String,
    cognifiedAt: S.optionalKey(S.String),
    contentHash: S.optionalKey(S.String),
    id: S.NonEmptyString,
    related: S.Array(S.String),
    sourceType: CardSourceType,
    status: CardStatus,
    tags: S.Array(S.String),
    title: S.NonEmptyString,
    url: S.optionalKey(S.String),
    via: CardVia,
  },
  $I.annote("KnowledgeCardFrontmatter", {
    title: "Knowledge Card Frontmatter",
    description: "Structured YAML frontmatter carried by every markdown knowledge card in the research vault.",
  })
) {}

/**
 * Browser family targeted by `research history-sift`.
 *
 * @example
 * ```ts
 * import { BrowserKind } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BrowserKind)("brave")) // true
 * console.log(S.is(BrowserKind)("all")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const BrowserKind = LiteralKit(["brave", "chrome", "all"]).pipe(
  $I.annoteSchema("BrowserKind", {
    title: "Browser Kind",
    description: "Which Chromium-family browser history files history-sift scans.",
  })
);

/**
 * Browser family type targeted by `research history-sift`.
 *
 * @example
 * ```ts
 * import type { BrowserKind } from "@beep/repo-cli/commands/Research"
 *
 * const browser: BrowserKind = "brave"
 * console.log(browser) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type BrowserKind = typeof BrowserKind.Type;

/**
 * Validated options used by `research history-sift`.
 *
 * @example
 * ```ts
 * import { ResearchHistorySiftOptions } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = ResearchHistorySiftOptions.make({
 *   browser: "all",
 *   sinceDays: NonNegativeInt.make(7),
 *   vaultRoot: "/home/user/knowledge"
 * })
 * console.log(options.sinceDays)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchHistorySiftOptions extends S.Class<ResearchHistorySiftOptions>($I`ResearchHistorySiftOptions`)(
  {
    browser: BrowserKind,
    sinceDays: NonNegativeInt,
    vaultRoot: S.String,
  },
  $I.annote("ResearchHistorySiftOptions", {
    description: "Validated options used by research history-sift.",
  })
) {}

/**
 * Summary returned by `research history-sift`.
 *
 * @example
 * ```ts
 * import { ResearchHistorySiftSummary } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = ResearchHistorySiftSummary.make({
 *   profilesScanned: NonNegativeInt.make(2),
 *   skippedFiltered: NonNegativeInt.make(40),
 *   skippedSeen: NonNegativeInt.make(3),
 *   stubsWritten: NonNegativeInt.make(5),
 *   urlsScanned: NonNegativeInt.make(48)
 * })
 * console.log(summary.stubsWritten)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchHistorySiftSummary extends S.Class<ResearchHistorySiftSummary>($I`ResearchHistorySiftSummary`)(
  {
    profilesScanned: NonNegativeInt,
    skippedFiltered: NonNegativeInt,
    skippedSeen: NonNegativeInt,
    stubsWritten: NonNegativeInt,
    urlsScanned: NonNegativeInt,
  },
  $I.annote("ResearchHistorySiftSummary", {
    description: "Counts describing one research history-sift run across browser profiles.",
  })
) {}

/**
 * Validated options used by `research repo-card`.
 *
 * @example
 * ```ts
 * import { ResearchRepoCardOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchRepoCardOptions.make({
 *   force: false,
 *   includeStars: false,
 *   researchRoot: "/home/user/research",
 *   vaultRoot: "/home/user/knowledge"
 * })
 * console.log(options.researchRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchRepoCardOptions extends S.Class<ResearchRepoCardOptions>($I`ResearchRepoCardOptions`)(
  {
    force: S.Boolean,
    includeStars: S.Boolean,
    only: S.optionalKey(S.String),
    researchRoot: S.String,
    vaultRoot: S.String,
  },
  $I.annote("ResearchRepoCardOptions", {
    description: "Validated options used by research repo-card.",
  })
) {}

/**
 * Summary returned by `research repo-card`.
 *
 * @example
 * ```ts
 * import { ResearchRepoCardSummary } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = ResearchRepoCardSummary.make({
 *   cardsSkipped: NonNegativeInt.make(1),
 *   cardsWritten: NonNegativeInt.make(3),
 *   reposScanned: NonNegativeInt.make(4),
 *   starsScanned: NonNegativeInt.make(0)
 * })
 * console.log(summary.cardsWritten)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchRepoCardSummary extends S.Class<ResearchRepoCardSummary>($I`ResearchRepoCardSummary`)(
  {
    cardsSkipped: NonNegativeInt,
    cardsWritten: NonNegativeInt,
    reposScanned: NonNegativeInt,
    starsScanned: NonNegativeInt,
  },
  $I.annote("ResearchRepoCardSummary", {
    description: "Counts describing one research repo-card run over cloned and starred repositories.",
  })
) {}

/**
 * Validated options used by `research notion-pull`.
 *
 * @example
 * ```ts
 * import { ResearchNotionPullOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchNotionPullOptions.make({
 *   database: "Awesome X Posts",
 *   vaultRoot: "/home/user/knowledge"
 * })
 * console.log(options.database)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchNotionPullOptions extends S.Class<ResearchNotionPullOptions>($I`ResearchNotionPullOptions`)(
  {
    database: S.NonEmptyString,
    linksFile: S.String.pipe(S.optionalKey),
    pageId: S.String.pipe(S.optionalKey),
    vaultRoot: S.String,
  },
  $I.annote("ResearchNotionPullOptions", {
    description:
      "Validated options used by research notion-pull; pageId reads a plain page's bulleted links, linksFile reads a local JSON backfill, and database falls back to a database query.",
  })
) {}

/**
 * Summary returned by `research notion-pull`.
 *
 * @example
 * ```ts
 * import { ResearchNotionPullSummary } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = ResearchNotionPullSummary.make({
 *   cardsWritten: NonNegativeInt.make(4),
 *   pagesSeen: NonNegativeInt.make(6),
 *   skippedSeen: NonNegativeInt.make(2)
 * })
 * console.log(summary.cardsWritten)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchNotionPullSummary extends S.Class<ResearchNotionPullSummary>($I`ResearchNotionPullSummary`)(
  {
    cardsWritten: NonNegativeInt,
    pagesSeen: NonNegativeInt,
    skippedSeen: NonNegativeInt,
  },
  $I.annote("ResearchNotionPullSummary", {
    description: "Counts describing one research notion-pull run over the saved-links database.",
  })
) {}

/**
 * Validated options used by `research daily`.
 *
 * @example
 * ```ts
 * import { ResearchDailyOptions } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const options = ResearchDailyOptions.make({
 *   browser: "all",
 *   commit: true,
 *   sinceDays: NonNegativeInt.make(2),
 *   vaultRoot: "/home/user/knowledge"
 * })
 * console.log(options.commit)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchDailyOptions extends S.Class<ResearchDailyOptions>($I`ResearchDailyOptions`)(
  {
    browser: BrowserKind,
    commit: S.Boolean,
    notionPage: S.String.pipe(S.optionalKey),
    sinceDays: NonNegativeInt,
    vaultRoot: S.String,
  },
  $I.annote("ResearchDailyOptions", {
    description: "Validated options used by research daily (sift, notion-pull, cognify, digest, optional commit).",
  })
) {}

/**
 * Summary returned by `research daily`.
 *
 * @example
 * ```ts
 * import { ResearchDailySummary } from "@beep/repo-cli/commands/Research"
 *
 * const summary = ResearchDailySummary.make({ failed: [], ran: ["history-sift"], skipped: ["notion-pull"] })
 * console.log(summary.ran)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchDailySummary extends S.Class<ResearchDailySummary>($I`ResearchDailySummary`)(
  {
    failed: S.Array(S.String),
    ran: S.Array(S.String),
    skipped: S.Array(S.String),
  },
  $I.annote("ResearchDailySummary", {
    description: "Step outcomes for one research daily pipeline run.",
  })
) {}

/**
 * Validated options used by `research cognify`.
 *
 * @example
 * ```ts
 * import { ResearchCognifyOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchCognifyOptions.make({ dryRun: true, vaultRoot: "/home/user/knowledge" })
 * console.log(options.dryRun)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchCognifyOptions extends S.Class<ResearchCognifyOptions>($I`ResearchCognifyOptions`)(
  {
    dryRun: S.Boolean,
    vaultRoot: S.String,
  },
  $I.annote("ResearchCognifyOptions", {
    description: "Validated options used by research cognify.",
  })
) {}

/**
 * Summary returned by `research cognify`.
 *
 * @example
 * ```ts
 * import { ResearchCognifySummary } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = ResearchCognifySummary.make({
 *   cardsPushed: NonNegativeInt.make(5),
 *   datasets: ["kb_repos"],
 *   dryRun: false
 * })
 * console.log(summary.cardsPushed)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchCognifySummary extends S.Class<ResearchCognifySummary>($I`ResearchCognifySummary`)(
  {
    cardsPushed: NonNegativeInt,
    datasets: S.Array(S.String),
    dryRun: S.Boolean,
  },
  $I.annote("ResearchCognifySummary", {
    description: "Counts describing one research cognify push into Cognee datasets.",
  })
) {}

/**
 * Validated options used by `research digest`.
 *
 * @example
 * ```ts
 * import { ResearchDigestOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchDigestOptions.make({ vaultRoot: "/home/user/knowledge" })
 * console.log(options.vaultRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchDigestOptions extends S.Class<ResearchDigestOptions>($I`ResearchDigestOptions`)(
  {
    date: S.String.pipe(S.optionalKey),
    vaultRoot: S.String,
  },
  $I.annote("ResearchDigestOptions", {
    description: "Validated options used by research digest; date defaults to today (YYYY-MM-DD).",
  })
) {}

/**
 * Summary returned by `research digest`.
 *
 * @example
 * ```ts
 * import { ResearchDigestSummary } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = ResearchDigestSummary.make({
 *   digestPath: "digest/2026-07-05.md",
 *   inboxBacklog: NonNegativeInt.make(3),
 *   newCards: NonNegativeInt.make(7)
 * })
 * console.log(summary.digestPath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchDigestSummary extends S.Class<ResearchDigestSummary>($I`ResearchDigestSummary`)(
  {
    digestPath: S.String,
    inboxBacklog: NonNegativeInt,
    newCards: NonNegativeInt,
  },
  $I.annote("ResearchDigestSummary", {
    description: "Counts describing one research digest note.",
  })
) {}

/**
 * Validated options used by `research capture`.
 *
 * @example
 * ```ts
 * import { ResearchCaptureOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchCaptureOptions.make({
 *   tags: ["effect"],
 *   url: "https://example.com/post",
 *   vaultRoot: "/home/user/knowledge"
 * })
 * console.log(options.url)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchCaptureOptions extends S.Class<ResearchCaptureOptions>($I`ResearchCaptureOptions`)(
  {
    tags: S.Array(S.String),
    url: S.NonEmptyString,
    vaultRoot: S.String,
  },
  $I.annote("ResearchCaptureOptions", {
    description: "Validated options used by research capture.",
  })
) {}

/**
 * Summary returned by `research capture`.
 *
 * @example
 * ```ts
 * import { ResearchCaptureSummary } from "@beep/repo-cli/commands/Research"
 *
 * const summary = ResearchCaptureSummary.make({
 *   cardPath: "sources/articles/span-grounded-extraction--0f7c3a52.md",
 *   id: "kb-0f7c3a52-8e6f-4f1b-9f57-0a4be6cd2b11",
 *   skipped: false,
 *   title: "Span-grounded extraction"
 * })
 * console.log(summary.skipped) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchCaptureSummary extends S.Class<ResearchCaptureSummary>($I`ResearchCaptureSummary`)(
  {
    cardPath: S.String,
    id: S.String,
    skipped: S.Boolean,
    title: S.String,
  },
  $I.annote("ResearchCaptureSummary", {
    description: "Summary describing where research capture wrote (or skipped) a knowledge card.",
  })
) {}

/**
 * Validated options used by `research status`.
 *
 * @example
 * ```ts
 * import { ResearchStatusOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchStatusOptions.make({ vaultRoot: "/home/user/knowledge" })
 * console.log(options.vaultRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchStatusOptions extends S.Class<ResearchStatusOptions>($I`ResearchStatusOptions`)(
  {
    vaultRoot: S.String,
  },
  $I.annote("ResearchStatusOptions", {
    description: "Validated options used by research status.",
  })
) {}

/**
 * Per-source-type card count reported by `research status`.
 *
 * @example
 * ```ts
 * import { ResearchSourceTypeCount } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const row = ResearchSourceTypeCount.make({ cards: NonNegativeInt.make(3), sourceType: "article" })
 * console.log(row.cards)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchSourceTypeCount extends S.Class<ResearchSourceTypeCount>($I`ResearchSourceTypeCount`)(
  {
    cards: NonNegativeInt,
    sourceType: CardSourceType,
  },
  $I.annote("ResearchSourceTypeCount", {
    description: "Card count for one source type queried from the research catalog.",
  })
) {}

/**
 * Summary returned by `research status`.
 *
 * @example
 * ```ts
 * import { ResearchStatusSummary } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = ResearchStatusSummary.make({
 *   bySourceType: [],
 *   inboxCards: NonNegativeInt.make(0),
 *   pendingCognify: NonNegativeInt.make(0),
 *   seenUrls: NonNegativeInt.make(0),
 *   totalCards: NonNegativeInt.make(0)
 * })
 * console.log(summary.totalCards)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResearchStatusSummary extends S.Class<ResearchStatusSummary>($I`ResearchStatusSummary`)(
  {
    bySourceType: S.Array(ResearchSourceTypeCount),
    inboxCards: NonNegativeInt,
    pendingCognify: NonNegativeInt,
    seenUrls: NonNegativeInt,
    totalCards: NonNegativeInt,
  },
  $I.annote("ResearchStatusSummary", {
    description: "Aggregate vault and catalog counts reported by research status.",
  })
) {}
