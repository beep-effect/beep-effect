/**
 * DuckDB catalog helpers for the research knowledge vault.
 *
 * The catalog is a rebuildable index beneath `<vault>/.beep/`; the markdown
 * cards remain the source of truth.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $RepoCliId } from "@beep/identity/packages";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ResearchCommandError } from "../Research.errors.ts";

const $I = $RepoCliId.create("commands/Research/internal/Catalog");

/**
 * Catalog database file name beneath `<vault>/.beep/`.
 *
 * @internal
 * @category utilities
 */
export const CATALOG_DB_NAME = "research.duckdb";

const CREATE_TABLES: ReadonlyArray<string> = [
  `CREATE TABLE IF NOT EXISTS research_seen_urls (
    url_norm VARCHAR PRIMARY KEY,
    first_seen VARCHAR NOT NULL,
    via VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS research_cards (
    id VARCHAR PRIMARY KEY,
    path VARCHAR NOT NULL,
    url VARCHAR,
    source_type VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    content_hash VARCHAR NOT NULL,
    captured_at VARCHAR NOT NULL,
    cognified_at VARCHAR
  )`,
  "ALTER TABLE research_cards ADD COLUMN IF NOT EXISTS title VARCHAR",
  `CREATE TABLE IF NOT EXISTS research_capture_log (
    ts VARCHAR NOT NULL,
    subcommand VARCHAR NOT NULL,
    subject VARCHAR NOT NULL,
    outcome VARCHAR NOT NULL
  )`,
];

/**
 * Location/context options for {@link runWithResearchDb}: the catalog
 * database file path and the error message used when catalog work fails.
 *
 * @internal
 * @category models
 */
type RunWithResearchDbOptions = {
  readonly databasePath: string;
  readonly message: string;
};

/**
 * Run catalog work against the research DuckDB database, creating tables on
 * first use. Pipeable: `work.pipe(runWithResearchDb({ databasePath, message }))`.
 *
 * @internal
 * @param work - Effect to run after catalog tables are initialized.
 * @param options - `databasePath` (DuckDB database file path) and `message` (error context used when catalog work fails).
 * @returns The result of the supplied catalog effect.
 * @category utilities
 */
export const runWithResearchDb: {
  (
    options: RunWithResearchDbOptions
  ): <A, E>(work: Effect.Effect<A, E, DuckDb>) => Effect.Effect<A, ResearchCommandError>;
  <A, E>(work: Effect.Effect<A, E, DuckDb>, options: RunWithResearchDbOptions): Effect.Effect<A, ResearchCommandError>;
} = dual(
  2,
  <A, E>(
    work: Effect.Effect<A, E, DuckDb>,
    { databasePath, message }: RunWithResearchDbOptions
  ): Effect.Effect<A, ResearchCommandError> =>
    Effect.scoped(
      Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))).pipe(
        Effect.flatMap((context) =>
          Effect.gen(function* () {
            const db = yield* DuckDb;
            yield* db.runMany(CREATE_TABLES);
            return yield* work;
          }).pipe(Effect.provide(context))
        )
      )
    ).pipe(ResearchCommandError.mapError(message))
);

class CountRow extends S.Class<CountRow>($I`CountRow`)(
  { total: S.Finite },
  $I.annote("CountRow", {
    title: "Count Row",
    description: "Single numeric count row returned by research catalog aggregate queries.",
  })
) {}
const decodeCountRows = S.decodeUnknownEffect(S.Array(CountRow));

/**
 * Decode a single-count query result.
 *
 * @internal
 * @category utilities
 */
export const singleCount = Effect.fn("ResearchCatalog.singleCount")(function* (
  rows: unknown,
  label: string
): Effect.fn.Return<number, ResearchCommandError> {
  const decoded = yield* decodeCountRows(rows).pipe(
    ResearchCommandError.mapError(`Catalog count query for ${label} returned an unexpected shape.`)
  );
  return A.head(decoded).pipe(
    O.map((row) => row.total),
    O.getOrElse(() => 0)
  );
});

/**
 * Statement recording a first-seen URL, ignoring duplicates.
 *
 * @internal
 * @category utilities
 */
export const INSERT_SEEN_URL = `INSERT INTO research_seen_urls (url_norm, first_seen, via)
  VALUES (?, ?, ?) ON CONFLICT (url_norm) DO NOTHING`;

/**
 * Statement checking whether a normalized URL is already known.
 *
 * @internal
 * @category utilities
 */
export const SELECT_SEEN_URL = "SELECT COUNT(*)::DOUBLE AS total FROM research_seen_urls WHERE url_norm = ?";

/**
 * Statement upserting one card row by stable card id.
 *
 * @internal
 * @category utilities
 */
export const UPSERT_CARD = `INSERT INTO research_cards (id, path, url, source_type, status, content_hash, captured_at, cognified_at, title)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    path = excluded.path,
    url = excluded.url,
    source_type = excluded.source_type,
    status = excluded.status,
    content_hash = excluded.content_hash,
    captured_at = excluded.captured_at,
    cognified_at = excluded.cognified_at,
    title = excluded.title`;

/**
 * Statement appending one capture-log row.
 *
 * @internal
 * @category utilities
 */
export const INSERT_CAPTURE_LOG =
  "INSERT INTO research_capture_log (ts, subcommand, subject, outcome) VALUES (?, ?, ?, ?)";
