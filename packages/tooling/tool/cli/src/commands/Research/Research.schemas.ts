/**
 * Schema models for research knowledge-vault commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SystemdUnitPath } from "@beep/repo-cli-kit/systemd/index";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Research/Research.schemas");

/**
 * Source kind recorded on a knowledge card.
 *
 * **Example** (Validate article and link)
 *
 * ```ts
 * import { CardSourceType } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CardSourceType)("article")) // true
 * console.log(S.is(CardSourceType)("link")) // true
 * ```
 *
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
 * **Example** (Assign article source type)
 *
 * ```ts
 * import type { CardSourceType } from "@beep/repo-cli/commands/Research"
 *
 * const sourceType: CardSourceType = "article"
 * console.log(sourceType) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CardSourceType = typeof CardSourceType.Type;

/**
 * Triage status recorded on a knowledge card.
 *
 * **Example** (Validate inbox status)
 *
 * ```ts
 * import { CardStatus } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CardStatus)("inbox")) // true
 * ```
 *
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
 * **Example** (Assign inbox status)
 *
 * ```ts
 * import type { CardStatus } from "@beep/repo-cli/commands/Research"
 *
 * const status: CardStatus = "inbox"
 * console.log(status) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CardStatus = typeof CardStatus.Type;

/**
 * Pipeline entry point that produced a knowledge card.
 *
 * **Example** (Validate capture via)
 *
 * ```ts
 * import { CardVia } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CardVia)("capture")) // true
 * ```
 *
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
 * **Example** (Assign capture via)
 *
 * ```ts
 * import type { CardVia } from "@beep/repo-cli/commands/Research"
 *
 * const via: CardVia = "capture"
 * console.log(via) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CardVia = typeof CardVia.Type;

/**
 * YAML frontmatter carried by every knowledge card in the vault.
 *
 * **Details**
 *
 * The `id` is stable for the card's lifetime and doubles as the Cognee
 * document id.
 *
 * **Example** (Make knowledge card frontmatter)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeCardFrontmatter extends S.Opaque<KnowledgeCardFrontmatter, { readonly brand: unique symbol }>()(
  S.Struct({
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
  }).pipe(
    $I.annoteSchema("KnowledgeCardFrontmatter", {
      title: "Knowledge Card Frontmatter",
      description: "Structured YAML frontmatter carried by every markdown knowledge card in the research vault.",
    })
  )
) {}

/**
 * Browser family targeted by `research history-sift`.
 *
 * **Example** (Validate brave and all)
 *
 * ```ts
 * import { BrowserKind } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BrowserKind)("brave")) // true
 * console.log(S.is(BrowserKind)("all")) // true
 * ```
 *
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
 * **Example** (Assign brave browser kind)
 *
 * ```ts
 * import type { BrowserKind } from "@beep/repo-cli/commands/Research"
 *
 * const browser: BrowserKind = "brave"
 * console.log(browser) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BrowserKind = typeof BrowserKind.Type;

/**
 * Validated options used by `research history-sift`.
 *
 * **Example** (Make history-sift options)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResearchHistorySiftOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchHistorySiftOptions.make({
 *   browser: "all",
 *   sinceDays: S.Natural.make(7),
 *   vaultRoot: "/home/user/knowledge"
 * })
 * console.log(options.sinceDays)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchHistorySiftOptions extends S.Opaque<
  ResearchHistorySiftOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    browser: BrowserKind,
    sinceDays: S.Natural,
    vaultRoot: S.String,
  }).pipe(
    $I.annoteSchema("ResearchHistorySiftOptions", {
      description: "Validated options used by research history-sift.",
    })
  )
) {}

/**
 * Summary returned by `research history-sift`.
 *
 * **Example** (Make history-sift summary)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResearchHistorySiftSummary } from "@beep/repo-cli/commands/Research"
 *
 * const summary = ResearchHistorySiftSummary.make({
 *   profilesScanned: S.Natural.make(2),
 *   skippedFiltered: S.Natural.make(40),
 *   skippedSeen: S.Natural.make(3),
 *   stubsWritten: S.Natural.make(5),
 *   urlsScanned: S.Natural.make(48)
 * })
 * console.log(summary.stubsWritten)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchHistorySiftSummary extends S.Opaque<
  ResearchHistorySiftSummary,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    profilesScanned: S.Natural,
    skippedFiltered: S.Natural,
    skippedSeen: S.Natural,
    stubsWritten: S.Natural,
    urlsScanned: S.Natural,
  }).pipe(
    $I.annoteSchema("ResearchHistorySiftSummary", {
      description: "Counts describing one research history-sift run across browser profiles.",
    })
  )
) {}

/**
 * Validated options used by `research repo-card`.
 *
 * **Example** (Make repo-card options)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchRepoCardOptions extends S.Opaque<ResearchRepoCardOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    force: S.Boolean,
    includeStars: S.Boolean,
    only: S.optionalKey(S.String),
    researchRoot: S.String,
    vaultRoot: S.String,
  }).pipe(
    $I.annoteSchema("ResearchRepoCardOptions", {
      description: "Validated options used by research repo-card.",
    })
  )
) {}

/**
 * Summary returned by `research repo-card`.
 *
 * **Example** (Make repo-card summary)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResearchRepoCardSummary } from "@beep/repo-cli/commands/Research"
 *
 * const summary = ResearchRepoCardSummary.make({
 *   cardsSkipped: S.Natural.make(1),
 *   cardsWritten: S.Natural.make(3),
 *   reposScanned: S.Natural.make(4),
 *   starsScanned: S.Natural.make(0)
 * })
 * console.log(summary.cardsWritten)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchRepoCardSummary extends S.Opaque<ResearchRepoCardSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    cardsSkipped: S.Natural,
    cardsWritten: S.Natural,
    reposScanned: S.Natural,
    starsScanned: S.Natural,
  }).pipe(
    $I.annoteSchema("ResearchRepoCardSummary", {
      description: "Counts describing one research repo-card run over cloned and starred repositories.",
    })
  )
) {}

/**
 * Validated options used by `research notion-pull`.
 *
 * **Example** (Make notion-pull options)
 *
 * ```ts
 * import { ResearchNotionPullOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchNotionPullOptions.make({
 *   database: "Awesome X Posts",
 *   vaultRoot: "/home/user/knowledge"
 * })
 * console.log(options.database)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchNotionPullOptions extends S.Opaque<ResearchNotionPullOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    database: S.NonEmptyString,
    linksFile: S.String.pipe(S.optionalKey),
    pageId: S.String.pipe(S.optionalKey),
    vaultRoot: S.String,
  }).pipe(
    $I.annoteSchema("ResearchNotionPullOptions", {
      description:
        "Validated options used by research notion-pull; pageId reads a plain page's bulleted links, linksFile reads a local JSON backfill, and database falls back to a database query.",
    })
  )
) {}

/**
 * Summary returned by `research notion-pull`.
 *
 * **Example** (Make notion-pull summary)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResearchNotionPullSummary } from "@beep/repo-cli/commands/Research"
 *
 * const summary = ResearchNotionPullSummary.make({
 *   cardsWritten: S.Natural.make(4),
 *   pagesSeen: S.Natural.make(6),
 *   skippedSeen: S.Natural.make(2)
 * })
 * console.log(summary.cardsWritten)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchNotionPullSummary extends S.Opaque<ResearchNotionPullSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    cardsWritten: S.Natural,
    pagesSeen: S.Natural,
    skippedSeen: S.Natural,
  }).pipe(
    $I.annoteSchema("ResearchNotionPullSummary", {
      description: "Counts describing one research notion-pull run over the saved-links database.",
    })
  )
) {}

/**
 * Validated options used by `research daily`.
 *
 * **Example** (Make daily options)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResearchDailyOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchDailyOptions.make({
 *   browser: "all",
 *   commit: true,
 *   sinceDays: S.Natural.make(2),
 *   vaultRoot: "/home/user/knowledge"
 * })
 * console.log(options.commit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchDailyOptions extends S.Opaque<ResearchDailyOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    browser: BrowserKind,
    commit: S.Boolean,
    notionPage: S.String.pipe(S.optionalKey),
    sinceDays: S.Natural,
    vaultRoot: S.String,
  }).pipe(
    $I.annoteSchema("ResearchDailyOptions", {
      description: "Validated options used by research daily (sift, notion-pull, cognify, digest, optional commit).",
    })
  )
) {}

/**
 * Summary returned by `research daily`.
 *
 * **Example** (Make daily summary)
 *
 * ```ts
 * import { ResearchDailySummary } from "@beep/repo-cli/commands/Research"
 *
 * const summary = ResearchDailySummary.make({ failed: [], ran: ["history-sift"], skipped: ["notion-pull"] })
 * console.log(summary.ran)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchDailySummary extends S.Opaque<ResearchDailySummary, { readonly brand: unique symbol }>()(
  S.Struct({
    failed: S.Array(S.String),
    ran: S.Array(S.String),
    skipped: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ResearchDailySummary", {
      description: "Step outcomes for one research daily pipeline run.",
    })
  )
) {}

/**
 * Validated options used by `research cognify`.
 *
 * **Example** (Make cognify options)
 *
 * ```ts
 * import { ResearchCognifyOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchCognifyOptions.make({ dryRun: true, vaultRoot: "/home/user/knowledge" })
 * console.log(options.dryRun)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchCognifyOptions extends S.Opaque<ResearchCognifyOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    dryRun: S.Boolean,
    vaultRoot: S.String,
  }).pipe(
    $I.annoteSchema("ResearchCognifyOptions", {
      description: "Validated options used by research cognify.",
    })
  )
) {}

/**
 * Summary returned by `research cognify`.
 *
 * **Example** (Make cognify summary)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResearchCognifySummary } from "@beep/repo-cli/commands/Research"
 *
 * const summary = ResearchCognifySummary.make({
 *   cardsPushed: S.Natural.make(5),
 *   datasets: ["kb_repos"],
 *   dryRun: false
 * })
 * console.log(summary.cardsPushed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchCognifySummary extends S.Opaque<ResearchCognifySummary, { readonly brand: unique symbol }>()(
  S.Struct({
    cardsPushed: S.Natural,
    datasets: S.Array(S.String),
    dryRun: S.Boolean,
  }).pipe(
    $I.annoteSchema("ResearchCognifySummary", {
      description: "Counts describing one research cognify push into Cognee datasets.",
    })
  )
) {}

/**
 * Validated options used by `research digest`.
 *
 * **Example** (Make digest options)
 *
 * ```ts
 * import { ResearchDigestOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchDigestOptions.make({ vaultRoot: "/home/user/knowledge" })
 * console.log(options.vaultRoot)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchDigestOptions extends S.Opaque<ResearchDigestOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    date: S.String.pipe(S.optionalKey),
    vaultRoot: S.String,
  }).pipe(
    $I.annoteSchema("ResearchDigestOptions", {
      description: "Validated options used by research digest; date defaults to today (YYYY-MM-DD).",
    })
  )
) {}

/**
 * Summary returned by `research digest`.
 *
 * **Example** (Make digest summary)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResearchDigestSummary } from "@beep/repo-cli/commands/Research"
 *
 * const summary = ResearchDigestSummary.make({
 *   digestPath: "digest/2026-07-05.md",
 *   inboxBacklog: S.Natural.make(3),
 *   newCards: S.Natural.make(7)
 * })
 * console.log(summary.digestPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchDigestSummary extends S.Opaque<ResearchDigestSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    digestPath: S.String,
    inboxBacklog: S.Natural,
    newCards: S.Natural,
  }).pipe(
    $I.annoteSchema("ResearchDigestSummary", {
      description: "Counts describing one research digest note.",
    })
  )
) {}

/**
 * Validated options used by `research status`.
 *
 * **Example** (Make status options)
 *
 * ```ts
 * import { ResearchStatusOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchStatusOptions.make({ vaultRoot: "/home/user/knowledge" })
 * console.log(options.vaultRoot)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchStatusOptions extends S.Opaque<ResearchStatusOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    vaultRoot: S.String,
  }).pipe(
    $I.annoteSchema("ResearchStatusOptions", {
      description: "Validated options used by research status.",
    })
  )
) {}

/**
 * Per-source-type card count reported by `research status`.
 *
 * **Example** (Make source-type count)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResearchSourceTypeCount } from "@beep/repo-cli/commands/Research"
 *
 * const row = ResearchSourceTypeCount.make({ cards: S.Natural.make(3), sourceType: "article" })
 * console.log(row.cards)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchSourceTypeCount extends S.Opaque<ResearchSourceTypeCount, { readonly brand: unique symbol }>()(
  S.Struct({
    cards: S.Natural,
    sourceType: CardSourceType,
  }).pipe(
    $I.annoteSchema("ResearchSourceTypeCount", {
      description: "Card count for one source type queried from the research catalog.",
    })
  )
) {}

/**
 * Summary returned by `research status`.
 *
 * **Example** (Make status summary)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ResearchStatusSummary } from "@beep/repo-cli/commands/Research"
 *
 * const summary = ResearchStatusSummary.make({
 *   bySourceType: [],
 *   inboxCards: S.Natural.make(0),
 *   pendingCognify: S.Natural.make(0),
 *   seenUrls: S.Natural.make(0),
 *   totalCards: S.Natural.make(0)
 * })
 * console.log(summary.totalCards)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchStatusSummary extends S.Opaque<ResearchStatusSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    bySourceType: S.Array(ResearchSourceTypeCount),
    inboxCards: S.Natural,
    pendingCognify: S.Natural,
    seenUrls: S.Natural,
    totalCards: S.Natural,
  }).pipe(
    $I.annoteSchema("ResearchStatusSummary", {
      description: "Aggregate vault and catalog counts reported by research status.",
    })
  )
) {}

/**
 * A bare Notion page id as the research timer units embed it.
 *
 * **Details**
 *
 * systemd splits `ExecStart` on whitespace with no shell involved, so the page
 * id the daily unit passes to `research daily --page` must be one token of
 * letters, digits, and dashes; anything else is refused before a unit is
 * written.
 *
 * **Example** (Accept a page id and refuse a URL)
 *
 * ```ts
 * import { ResearchNotionPageId } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ResearchNotionPageId)("36869573788d8043907eddb021d99410")) // true
 * console.log(S.is(ResearchNotionPageId)("https://notion.so/page")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResearchNotionPageId = S.String.check(S.isPattern(/^[A-Za-z0-9-]+$/)).pipe(
  $I.annoteSchema("ResearchNotionPageId", {
    title: "Research Notion Page Id",
    description:
      "A bare Notion page id of letters, digits, and dashes: the one token the daily timer unit passes to research daily --page.",
  })
);

/**
 * Bare Notion page id type as the research timer units embed it.
 *
 * **Example** (Assign a page id)
 *
 * ```ts
 * import type { ResearchNotionPageId } from "@beep/repo-cli/commands/Research"
 *
 * const page: ResearchNotionPageId = "36869573788d8043907eddb021d99410"
 * console.log(page) // 36869573788d8043907eddb021d99410
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ResearchNotionPageId = typeof ResearchNotionPageId.Type;

/**
 * Validated options used by `research install-timers` to write the units.
 *
 * **Details**
 *
 * Removing the timers takes none of these: an uninstall reads only `HOME`.
 * `bunPath` is the operator's `--bun-path` made absolute or, when none is
 * given, the first Bun this user can execute under the home directory (the
 * mise shim, then `~/.bun/bin/bun`), falling back to the installer's own
 * executable. Every path is a systemd unit path, so the renderer's quoting
 * is enough.
 *
 * **Example** (Make timer options)
 *
 * ```ts
 * import { ResearchTimerOptions } from "@beep/repo-cli/commands/Research"
 *
 * const options = ResearchTimerOptions.make({
 *   bunPath: "/home/user/.local/share/mise/shims/bun",
 *   notionPage: "36869573788d8043907eddb021d99410",
 *   repoRoot: "/home/user/beep-effect"
 * })
 * console.log(options.bunPath) // /home/user/.local/share/mise/shims/bun
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchTimerOptions extends S.Opaque<ResearchTimerOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    bunPath: SystemdUnitPath,
    notionPage: ResearchNotionPageId.pipe(S.optionalKey),
    repoRoot: SystemdUnitPath,
  }).pipe(
    $I.annoteSchema("ResearchTimerOptions", {
      description:
        "Validated options used by research install-timers: the repo root the units run in, the Bun executable they invoke, and the optional Notion page the daily run pulls.",
    })
  )
) {}

/**
 * What the installed daily unit recorded that `research install-timers --refresh` reuses.
 *
 * **Details**
 *
 * The repo root is the unit's `WorkingDirectory`; the page is the `--page`
 * argument of its `ExecStart`, absent when the unit was installed without one.
 *
 * **Example** (Make a recorded timer)
 *
 * ```ts
 * import { ResearchRecordedTimer } from "@beep/repo-cli/commands/Research"
 * import * as O from "effect/Option"
 *
 * const recorded = ResearchRecordedTimer.make({ repoRoot: O.some("/clones/beep-effect7"), notionPage: O.none() })
 * console.log(O.isNone(recorded.notionPage)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchRecordedTimer extends S.Opaque<ResearchRecordedTimer, { readonly brand: unique symbol }>()(
  S.Struct({
    notionPage: S.Option(S.String),
    repoRoot: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("ResearchRecordedTimer", {
      description: "The repo root and Notion page an installed research daily unit runs with, read back for a refresh.",
    })
  )
) {}
