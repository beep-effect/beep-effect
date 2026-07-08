/**
 * Research internal RepoCardRun.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, DateTime, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ResearchCommandError } from "../Research.errors.js";
import { KnowledgeCardFrontmatter, ResearchRepoCardSummary } from "../Research.schemas.js";
import { catalogDbPath, persistCards } from "./CatalogOps.js";
import { discoverClones, inspectClone, listStarredRepos, slugPartsOf } from "./RepoCards.js";
import { VAULT_DIRS } from "./Vault.js";
import type { ResearchRepoCardOptions } from "../Research.schemas.js";
import type { ResearchCommandServiceRequirements } from "../Research.service.js";
import type { CardPersistRow } from "./CatalogOps.js";

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

/**
 * Create research cards for cloned and starred repositories.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { repoCardImpl } from "@beep/repo-cli/commands/Research/internal/RepoCardRun"
 * import { ResearchRepoCardOptions } from "@beep/repo-cli/commands/Research"
 *
 * const program = repoCardImpl(
 *   ResearchRepoCardOptions.make({
 *     force: false,
 *     includeStars: true,
 *     researchRoot: "/repo/research",
 *     vaultRoot: "/repo/.research"
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const repoCardImpl = Effect.fn("Research.repoCardImpl")(function* (
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
