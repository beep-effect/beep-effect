/**
 * Service implementation for research knowledge-vault commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Context, Effect, Layer } from "effect";
import { captureUrlImpl } from "./internal/Capture.ts";
import { cognifyImpl } from "./internal/Cognify.ts";
import { dailyImpl } from "./internal/Daily.ts";
import { digestImpl } from "./internal/Digest.ts";
import { historySiftImpl } from "./internal/HistorySift.ts";
import { notionPullImpl } from "./internal/NotionPullRun.ts";
import { repoCardImpl } from "./internal/RepoCardRun.ts";
import { statusImpl } from "./internal/Status.ts";
import { resolveVaultRoot } from "./internal/Vault.ts";
import type { FileSystem, Path } from "effect";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ResearchCommandError } from "./Research.errors.ts";
import type {
  ResearchCaptureOptions,
  ResearchCaptureSummary,
  ResearchCognifyOptions,
  ResearchCognifySummary,
  ResearchDailyOptions,
  ResearchDailySummary,
  ResearchDigestOptions,
  ResearchDigestSummary,
  ResearchHistorySiftOptions,
  ResearchHistorySiftSummary,
  ResearchNotionPullOptions,
  ResearchNotionPullSummary,
  ResearchRepoCardOptions,
  ResearchRepoCardSummary,
  ResearchStatusOptions,
  ResearchStatusSummary,
} from "./Research.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Research.service");

/**
 * Runtime services captured by the live Research command service layer.
 *
 * @example
 * ```ts
 * import type { ResearchCommandServiceRequirements } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 *
 * const program: Effect.Effect<void, never, ResearchCommandServiceRequirements> = Effect.void
 * console.log(program.pipe !== undefined)
 * ```
 * @category services
 * @since 0.0.0
 */
export type ResearchCommandServiceRequirements =
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | HttpClient.HttpClient
  | Path.Path;

/**
 * Service contract for research knowledge-vault operations.
 *
 * @example
 * ```ts
 * import type { ResearchCommandServiceShape } from "@beep/repo-cli/commands/Research/Research.service"
 *
 * const example: ResearchCommandServiceShape | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
