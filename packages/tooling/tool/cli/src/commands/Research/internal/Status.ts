/**
 * Research internal Status.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { Console, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { ResearchCommandError } from "../Research.errors.js";
import { ResearchStatusSummary } from "../Research.schemas.js";
import { CATALOG_DB_NAME, runWithResearchDb, singleCount } from "./Catalog.js";
import { VAULT_DIRS } from "./Vault.js";
import type { ResearchStatusOptions } from "../Research.schemas.js";
import type { ResearchCommandServiceRequirements } from "../Research.service.js";

const decodeStatusSummary = S.decodeUnknownEffect(ResearchStatusSummary);

/**
 * Report research catalog status counts.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { statusImpl } from "@beep/repo-cli/commands/Research/internal/Status"
 * import { ResearchStatusOptions } from "@beep/repo-cli/commands/Research"
 *
 * // Build the status effect; provide the research services to run it.
 * const program = statusImpl(ResearchStatusOptions.make({ vaultRoot: "/repo/.research" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category queries
 * @since 0.0.0
 */
export const statusImpl = Effect.fn("Research.statusImpl")(function* (
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
