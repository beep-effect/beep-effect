/**
 * Command definitions for research knowledge-vault curation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { installResearchTimers } from "./internal/Timers.ts";
import { resolveVaultRoot } from "./internal/Vault.ts";
import { ResearchCommandError } from "./Research.errors.ts";
import { printResearchIndex } from "./Research.render.ts";
import {
  ResearchCaptureOptions,
  ResearchCognifyOptions,
  ResearchDailyOptions,
  ResearchDigestOptions,
  ResearchHistorySiftOptions,
  ResearchNotionPullOptions,
  ResearchRepoCardOptions,
  ResearchStatusOptions,
} from "./Research.schemas.ts";
import {
  captureResearchUrl,
  cognifyResearchCards,
  pullResearchNotionLinks,
  ResearchCommandServiceLive,
  researchStatus,
  runResearchDaily,
  siftResearchHistory,
  writeResearchDigest,
  writeResearchRepoCards,
} from "./Research.service.ts";

/** @since 0.0.0 */
const vaultFlag = Flag.directory("vault", { mustExist: true }).pipe(
  Flag.withDescription("Knowledge vault root; defaults to BEEP_KNOWLEDGE_VAULT or ~/YeeBois/knowledge"),
  Flag.optional
);
/** @since 0.0.0 */
const tagsFlag = Flag.string("tags").pipe(
  Flag.withDescription("Comma-separated tags recorded on the captured card"),
  Flag.optional
);
/** @since 0.0.0 */
const captureUrlArgument = Argument.string("url").pipe(
  Argument.withDescription("URL to scrape into a markdown knowledge card")
);

const splitTags = (tags: O.Option<string>): ReadonlyArray<string> =>
  tags.pipe(
    O.map((value) => A.filter(A.map(Str.split(value, ","), Str.trim), Str.isNonEmpty)),
    O.getOrElse(A.empty<string>)
  );

const researchCaptureCommand = Command.make(
  "capture",
  {
    tags: tagsFlag,
    url: captureUrlArgument,
    vault: vaultFlag,
  },
  Effect.fn(function* ({ tags, url, vault }) {
    const vaultRoot = yield* resolveVaultRoot(vault);
    yield* captureResearchUrl(
      ResearchCaptureOptions.make({
        tags: splitTags(tags),
        url,
        vaultRoot,
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Scrape a URL to markdown via Firecrawl and file it as a knowledge card"),
  Command.provide(ResearchCommandServiceLive)
);

/** @since 0.0.0 */
const browserFlag = Flag.string("browser").pipe(
  Flag.withDefault("all"),
  Flag.withDescription("Browser history to scan: brave, chrome, or all")
);
/** @since 0.0.0 */
const sinceDaysFlag = Flag.integer("since-days").pipe(
  Flag.withDefault(7),
  Flag.withDescription("Only consider history visits within this many days")
);

const researchHistorySiftCommand = Command.make(
  "history-sift",
  {
    browser: browserFlag,
    sinceDays: sinceDaysFlag,
    vault: vaultFlag,
  },
  Effect.fn(function* ({ browser, sinceDays, vault }) {
    const vaultRoot = yield* resolveVaultRoot(vault);
    const options = yield* S.decodeUnknownEffect(ResearchHistorySiftOptions)({ browser, sinceDays, vaultRoot }).pipe(
      ResearchCommandError.mapError(`Invalid history-sift options (browser "${browser}", since-days ${sinceDays}).`)
    );
    yield* siftResearchHistory(options).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Sift Brave/Chrome history into high-signal inbox link stubs"),
  Command.provide(ResearchCommandServiceLive)
);

/** @since 0.0.0 */
const researchRootFlag = Flag.directory("research-root", { mustExist: true }).pipe(
  Flag.withDescription("Research clone library root; defaults to ~/YeeBois/research"),
  Flag.optional
);
/** @since 0.0.0 */
const starsFlag = Flag.boolean("stars").pipe(
  Flag.withDescription("Also card GitHub starred repositories via the gh CLI")
);
/** @since 0.0.0 */
const forceFlag = Flag.boolean("force").pipe(Flag.withDescription("Rewrite cards that already exist"));
/** @since 0.0.0 */
const onlyFlag = Flag.string("only").pipe(
  Flag.withDescription("Only card clones whose directory name contains this substring"),
  Flag.optional
);

const researchRepoCardCommand = Command.make(
  "repo-card",
  {
    force: forceFlag,
    only: onlyFlag,
    researchRoot: researchRootFlag,
    stars: starsFlag,
    vault: vaultFlag,
  },
  Effect.fn(function* ({ force, only, researchRoot, stars, vault }) {
    const vaultRoot = yield* resolveVaultRoot(vault);
    const home = yield* Effect.orDie(Config.string("HOME"));
    yield* writeResearchRepoCards(
      ResearchRepoCardOptions.make({
        force,
        includeStars: stars,
        researchRoot: O.getOrElse(researchRoot, () => `${home}/YeeBois/research`),
        vaultRoot,
        ...(O.isNone(only) ? {} : { only: only.value.toLowerCase() }),
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Write one knowledge card per cloned (and optionally starred) repository"),
  Command.provide(ResearchCommandServiceLive)
);

/** @since 0.0.0 */
const databaseFlag = Flag.string("database").pipe(
  Flag.withDefault("Awesome X Posts"),
  Flag.withDescription("Notion database title holding saved links (fallback when --page is not given)")
);
/** @since 0.0.0 */
const pageFlag = Flag.string("page").pipe(
  Flag.withDescription("Notion page id whose bulleted links hold saved posts (e.g. the Awesome X Posts page)"),
  Flag.optional
);
/** @since 0.0.0 */
const linksFileFlag = Flag.file("links-file", { mustExist: true }).pipe(
  Flag.withDescription("Local JSON backfill of { title, url, tags?, createdIso? } saved links"),
  Flag.optional
);

const researchNotionPullCommand = Command.make(
  "notion-pull",
  {
    database: databaseFlag,
    linksFile: linksFileFlag,
    page: pageFlag,
    vault: vaultFlag,
  },
  Effect.fn(function* ({ database, linksFile, page, vault }) {
    const vaultRoot = yield* resolveVaultRoot(vault);
    yield* pullResearchNotionLinks(
      ResearchNotionPullOptions.make({
        database,
        vaultRoot,
        ...(O.isNone(linksFile) ? {} : { linksFile: linksFile.value }),
        ...(O.isNone(page) ? {} : { pageId: page.value }),
      })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Pull saved links from Notion (page bullets or database) into x-post cards"),
  Command.provide(ResearchCommandServiceLive)
);

/** @since 0.0.0 */
const dryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDescription("Report what would be pushed to Cognee without pushing")
);

const researchCognifyCommand = Command.make(
  "cognify",
  {
    dryRun: dryRunFlag,
    vault: vaultFlag,
  },
  Effect.fn(function* ({ dryRun, vault }) {
    const vaultRoot = yield* resolveVaultRoot(vault);
    yield* cognifyResearchCards(ResearchCognifyOptions.make({ dryRun, vaultRoot })).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Push pending knowledge cards into Cognee datasets and start cognify"),
  Command.provide(ResearchCommandServiceLive)
);

/** @since 0.0.0 */
const dateFlag = Flag.string("date").pipe(
  Flag.withDescription("Digest date (YYYY-MM-DD); defaults to today"),
  Flag.optional
);

const researchDigestCommand = Command.make(
  "digest",
  {
    date: dateFlag,
    vault: vaultFlag,
  },
  Effect.fn(function* ({ date, vault }) {
    const vaultRoot = yield* resolveVaultRoot(vault);
    yield* writeResearchDigest(
      ResearchDigestOptions.make({ vaultRoot, ...(O.isNone(date) ? {} : { date: date.value }) })
    ).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Write the daily digest note from catalog data"),
  Command.provide(ResearchCommandServiceLive)
);

/** @since 0.0.0 */
const commitFlag = Flag.boolean("commit").pipe(
  Flag.withDescription("Commit the vault after the daily run when it changed")
);

const researchDailyCommand = Command.make(
  "daily",
  {
    browser: browserFlag,
    commit: commitFlag,
    page: pageFlag,
    sinceDays: sinceDaysFlag,
    vault: vaultFlag,
  },
  Effect.fn(function* ({ browser, commit, page, sinceDays, vault }) {
    const vaultRoot = yield* resolveVaultRoot(vault);
    const options = yield* S.decodeUnknownEffect(ResearchDailyOptions)({
      browser,
      commit,
      sinceDays,
      vaultRoot,
      ...(O.isNone(page) ? {} : { notionPage: page.value }),
    }).pipe(ResearchCommandError.mapError(`Invalid daily options (browser "${browser}", since-days ${sinceDays}).`));
    yield* runResearchDaily(options).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Run the daily pipeline: history-sift, notion-pull, cognify, digest, optional commit"),
  Command.provide(ResearchCommandServiceLive)
);

/** @since 0.0.0 */
const uninstallFlag = Flag.boolean("uninstall").pipe(
  Flag.withDescription("Disable and remove the research systemd user timers")
);

const researchInstallTimersCommand = Command.make(
  "install-timers",
  {
    page: pageFlag,
    uninstall: uninstallFlag,
  },
  Effect.fn(function* ({ page, uninstall }) {
    yield* installResearchTimers(process.cwd(), process.execPath, uninstall, page);
  })
).pipe(
  Command.withDescription("Install systemd user timers for the daily pipeline and weekly repo-card refresh"),
  Command.provide(ResearchCommandServiceLive)
);

const researchStatusCommand = Command.make(
  "status",
  {
    vault: vaultFlag,
  },
  Effect.fn(function* ({ vault }) {
    const vaultRoot = yield* resolveVaultRoot(vault);
    yield* researchStatus(ResearchStatusOptions.make({ vaultRoot })).pipe(Effect.asVoid);
  })
).pipe(
  Command.withDescription("Report vault card counts, inbox backlog, and pending cognify state"),
  Command.provide(ResearchCommandServiceLive)
);

/**
 * Research knowledge-vault command group.
 *
 * @example
 * ```ts
 * import { researchCommand } from "@beep/repo-cli/commands/Research"
 *
 * const commandGroups = { research: researchCommand }
 * console.log(Object.keys(commandGroups)) // ["research"]
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const researchCommand = Command.make("research", {}, () => printResearchIndex).pipe(
  Command.withDescription("Research capture and knowledge-vault curation commands"),
  Command.withSubcommands([
    researchCaptureCommand,
    researchCognifyCommand,
    researchDailyCommand,
    researchDigestCommand,
    researchHistorySiftCommand,
    researchInstallTimersCommand,
    researchNotionPullCommand,
    researchRepoCardCommand,
    researchStatusCommand,
  ])
) as Command.Command<"research", {}, {}, never, never>;
