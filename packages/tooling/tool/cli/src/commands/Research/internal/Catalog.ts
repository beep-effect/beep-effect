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
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ResearchCommandError } from "../Research.errors.js";

/** Catalog database file name beneath `<vault>/.beep/`. @internal */
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
 * Run catalog work against the research DuckDB database, creating tables on
 * first use.
 *
 * @internal
 */
export const runWithResearchDb = <A, E>(
  databasePath: string,
  message: string,
  work: Effect.Effect<A, E, DuckDb>
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
  ).pipe(ResearchCommandError.mapError(message));

const CountRow = S.Struct({ total: S.Finite });
const decodeCountRows = S.decodeUnknownEffect(S.Array(CountRow));

/** Decode a single-count query result. @internal */
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

/** Statement recording a first-seen URL, ignoring duplicates. @internal */
export const INSERT_SEEN_URL = `INSERT INTO research_seen_urls (url_norm, first_seen, via)
  VALUES (?, ?, ?) ON CONFLICT (url_norm) DO NOTHING`;

/** Statement checking whether a normalized URL is already known. @internal */
export const SELECT_SEEN_URL = "SELECT COUNT(*)::DOUBLE AS total FROM research_seen_urls WHERE url_norm = ?";

/** Statement upserting one card row by stable card id. @internal */
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

/** Statement appending one capture-log row. @internal */
export const INSERT_CAPTURE_LOG =
  "INSERT INTO research_capture_log (ts, subcommand, subject, outcome) VALUES (?, ?, ?, ?)";
