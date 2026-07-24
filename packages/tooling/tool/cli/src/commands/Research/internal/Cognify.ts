/**
 * Research internal Cognify.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $RepoCliId } from "@beep/identity/packages";
import { Console, DateTime, Effect, FileSystem, MutableHashMap, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ResearchCommandError } from "../Research.errors.ts";
import { ResearchCognifySummary } from "../Research.schemas.ts";
import { INSERT_CAPTURE_LOG, runWithResearchDb } from "./Catalog.ts";
import { catalogDbPath } from "./CatalogOps.ts";
import { cogneeAdd, cogneeCognify, cogneeLogin, datasetForSourceType } from "./CogneeClient.ts";
import { postResearchEpisode } from "./GraphitiEpisodes.ts";
import type { ResearchCognifyOptions } from "../Research.schemas.ts";
import type { ResearchCommandServiceRequirements } from "../Research.service.ts";

const $I = $RepoCliId.create("commands/Research/internal/Cognify");

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

/**
 * Push pending research cards into Cognee datasets.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { cognifyImpl } from "@beep/repo-cli/commands/Research/internal/Cognify"
 * import { ResearchCognifyOptions } from "@beep/repo-cli/commands/Research"
 *
 * const program = cognifyImpl(ResearchCognifyOptions.make({ dryRun: true, vaultRoot: "/repo/.research" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const cognifyImpl = Effect.fn("Research.cognifyImpl")(function* (
  options: ResearchCognifyOptions
): Effect.fn.Return<ResearchCognifySummary, ResearchCommandError, ResearchCommandServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const databasePath = yield* catalogDbPath(options.vaultRoot);

  const pendingRows = yield* runWithResearchDb(
    Effect.gen(function* () {
      const db = yield* DuckDb;
      return yield* db.query(
        `SELECT id AS "id", path AS "path", source_type AS "sourceType"
         FROM research_cards WHERE cognified_at IS NULL ORDER BY source_type, path`
      );
    }),
    {
      databasePath,
      message: `Failed loading pending cards from "${databasePath}".`,
    }
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
    }),
    {
      databasePath,
      message: `Failed stamping cognified cards in "${databasePath}".`,
    }
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
