/**
 * Research internal Digest.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $RepoCliId } from "@beep/identity/packages";
import { Console, DateTime, Effect, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ResearchCommandError } from "../Research.errors.ts";
import { ResearchDigestSummary } from "../Research.schemas.ts";
import { runWithResearchDb, singleCount } from "./Catalog.ts";
import { catalogDbPath } from "./CatalogOps.ts";
import { VAULT_DIRS, writeCard } from "./Vault.ts";
import type { ResearchDigestOptions } from "../Research.schemas.ts";
import type { ResearchCommandServiceRequirements } from "../Research.service.ts";

const $I = $RepoCliId.create("commands/Research/internal/Digest");

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

/**
 * Write the daily research digest note from catalog rows.
 *
 * **Example** (Write vault digest note)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { digestImpl } from "@beep/repo-cli/commands/Research/internal/Digest"
 * import { ResearchDigestOptions } from "@beep/repo-cli/commands/Research"
 *
 * const program = digestImpl(ResearchDigestOptions.make({ vaultRoot: "/repo/.research" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const digestImpl = Effect.fn("Research.digestImpl")(function* (
  options: ResearchDigestOptions
): Effect.fn.Return<ResearchDigestSummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const path = yield* Path.Path;
  const databasePath = yield* catalogDbPath(options.vaultRoot);
  const now = yield* DateTime.now;
  const date = options.date ?? Str.slice(0, 10)(DateTime.formatIso(now));
  const cutoffIso = DateTime.formatIso(DateTime.subtract(now, { hours: 24 }));

  const { backlogRows, inboxBacklog, newRows, pendingCognify } = yield* runWithResearchDb(
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
    }),
    {
      databasePath,
      message: `Failed querying digest data from "${databasePath}".`,
    }
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
