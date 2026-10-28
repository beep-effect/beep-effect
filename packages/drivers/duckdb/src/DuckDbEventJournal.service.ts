/**
 * DuckDB BIGINT schema for the upstream Effect event journal.
 * @packageDocumentation
 * @since 0.0.0
 */
import { quotedString } from "@duckdb/node-api";
import * as Effect from "effect/Effect";
import * as EventJournal from "effect/eventlog/EventJournal";
import * as SqlEventJournal from "effect/eventlog/SqlEventJournal";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

/**
 * Creates a journal with DuckDB sequences and millisecond-safe columns.
 *
 * **Example** (Create a journal)
 * ```ts
 * import * as DuckDbEventJournal from "@beep/duckdb/DuckDbEventJournal"
 * const journal = DuckDbEventJournal.make({ entryTable: "events" })
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const make = Effect.fn("DuckDbEventJournal.make")(function* (
  options?: Parameters<typeof SqlEventJournal.make>[0]
) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const entries = options?.entryTable ?? "effect_event_journal";
  const remotes = options?.remotesTable ?? "effect_event_remotes";
  // beep: skip DDL for a completed upstream schema so a migrated journal can reopen read-only.
  const complete = yield* sql`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ${`${entries}_sources`}`;
  if (complete.length > 0) return yield* SqlEventJournal.make(options);
  return yield* sql.withTransaction(
    Effect.gen(function* () {
      // beep: pre-create only the incompatible tables; upstream still owns sources, indexes and migration.
      // BIGINT avoids INT32 epoch/sequence overflow; nextval replaces SQLite's implicit rowid sequence.
      yield* sql`CREATE TABLE IF NOT EXISTS ${sql(entries)} (
    id BLOB PRIMARY KEY, event TEXT NOT NULL, primary_key TEXT NOT NULL,
    payload BLOB NOT NULL, timestamp BIGINT NOT NULL
  )`;
      const sequenceName = `${entries}_sequence_counter`;
      yield* sql`CREATE SEQUENCE IF NOT EXISTS ${sql(sequenceName)}`;
      yield* sql`CREATE TABLE IF NOT EXISTS ${sql(`${entries}_sequence`)} (
    sequence BIGINT PRIMARY KEY DEFAULT nextval(${sql.literal(quotedString(sequenceName))}), entry_id BLOB NOT NULL UNIQUE
  )`;
      yield* sql`CREATE TABLE IF NOT EXISTS ${sql(`${remotes}_checkpoints`)} (
    remote_id BLOB PRIMARY KEY, sequence BIGINT NOT NULL
  )`;
      yield* sql`CREATE TABLE IF NOT EXISTS ${sql(options?.remoteCursorsTable ?? `${remotes}_cursors`)} (
    remote_id BLOB PRIMARY KEY, next_sequence BIGINT NOT NULL
  )`;
      return yield* SqlEventJournal.make(options);
    })
  );
});

/**
 * Provides the upstream EventJournal with DuckDB-native schema initialization.
 *
 * **Example** (Provide a journal)
 * ```ts
 * import * as DuckDbEventJournal from "@beep/duckdb/DuckDbEventJournal"
 * const live = DuckDbEventJournal.layer()
 * ```
 * @category layers
 * @since 0.0.0
 */
export const layer = (options?: Parameters<typeof SqlEventJournal.make>[0]) =>
  Layer.effect(EventJournal.EventJournal)(make(options));
