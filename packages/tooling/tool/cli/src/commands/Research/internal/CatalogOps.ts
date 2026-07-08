/**
 * Research internal CatalogOps.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $RepoCliId } from "@beep/identity/packages";
import { DateTime, Effect, FileSystem, MutableHashSet, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { ResearchCommandError } from "../Research.errors.js";
import { KnowledgeCardFrontmatter } from "../Research.schemas.js";
import { CATALOG_DB_NAME, INSERT_CAPTURE_LOG, INSERT_SEEN_URL, runWithResearchDb, UPSERT_CARD } from "./Catalog.js";
import { renderCard, sha256HexOf, VAULT_DIRS, writeCard } from "./Vault.js";

const $I = $RepoCliId.create("commands/Research/internal/CatalogOps");

/**
 * Resolve and create the DuckDB catalog path for a vault.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { catalogDbPath } from "@beep/repo-cli/commands/Research/internal/CatalogOps"
 *
 * // Resolve the catalog DuckDB path under a vault; provide FileSystem + Path to run it.
 * const program = catalogDbPath("/repo/.research")
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const catalogDbPath = Effect.fn("Research.catalogDbPath")(function* (
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

/**
 * Card content staged for filesystem and catalog persistence.
 *
 * @example
 * ```ts
 * import { CardPersistRow } from "@beep/repo-cli/commands/Research/internal/CatalogOps"
 *
 * const row = CardPersistRow.make({
 *   body: "# Example\n\nCaptured note body.",
 *   frontmatter: {
 *     capturedAt: "2026-07-08T12:00:00.000Z",
 *     contentHash: "abc123",
 *     id: "kb-link-abc123",
 *     related: [],
 *     sourceType: "link",
 *     status: "inbox",
 *     tags: ["research"],
 *     title: "Example",
 *     url: "https://example.com",
 *     via: "history",
 *   },
 *   relativePath: "sources/links/example.md",
 * })
 * console.log(row.relativePath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CardPersistRow extends S.Class<CardPersistRow>($I`CardPersistRow`)(
  {
    body: S.String,
    frontmatter: KnowledgeCardFrontmatter,
    relativePath: S.String,
  },
  $I.annote("CardPersistRow", {
    description: "Research card payload staged for vault file writing and DuckDB catalog persistence.",
  })
) {}

/**
 * Write knowledge cards and record their catalog rows.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { persistCards } from "@beep/repo-cli/commands/Research/internal/CatalogOps"
 *
 * // Persist a (here empty) batch of capture cards into the catalog database.
 * const program = persistCards("/repo/.research", "/repo/.research/.state/catalog.duckdb", "capture", [])
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category repositories
 * @since 0.0.0
 */
export const persistCards = Effect.fn("Research.persistCards")(function* (
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

/**
 * Load normalized URLs that the research catalog has already seen.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { loadSeenUrls } from "@beep/repo-cli/commands/Research/internal/CatalogOps"
 *
 * const program = loadSeenUrls("/repo/.research/.state/catalog.duckdb")
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category queries
 * @since 0.0.0
 */
export const loadSeenUrls = Effect.fn("Research.loadSeenUrls")(function* (
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
