/**
 * Stores encrypted event-log server state in SQL.
 *
 * This module provides the durable `Storage` implementation used by
 * `EventLogServerEncrypted` when entries should be stored without exposing
 * plaintext event data to the database. It persists the server remote id,
 * session authentication bindings, and encrypted batch tables, assigns stable
 * sequence numbers, and streams changes. Clients remain responsible for
 * encrypting writes and decrypting reads.
 *
 * Adapted from effect 4.0.6 SqlEventLogServerEncrypted (MIT, Effectful Technologies Inc.).
 * @packageDocumentation
 * @since 0.0.0
 */
// beep: public leaf imports and Effect.fn wrappers follow repo laws; server-only dialect branches are omitted.
import { $DuckdbId } from "@beep/identity/packages";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as EventJournal from "effect/eventlog/EventJournal";
import { makeRemoteIdUnsafe } from "effect/eventlog/EventJournal";
import * as EventLogEncryption from "effect/eventlog/EventLogEncryption";
import * as EventLogServerEncrypted from "effect/eventlog/EventLogServerEncrypted";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as RcMap from "effect/RcMap";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import type { EntryId } from "effect/eventlog/EventJournal";
import type { WriteAck } from "effect/eventlog/EventLogMessage";
import type * as Scope from "effect/Scope";
import type * as SqlError from "effect/sql/SqlError";
import type * as Statement from "effect/sql/Statement";

/**
 * Creates encrypted event-log server `Storage` backed by SQL.
 *
 * **Details**
 *
 * It persists the server remote id, session authentication bindings, and encrypted
 * batches in dialect-specific tables, creating per-identity/store batch and entry
 * id tables as needed.
 *
 * **Gotchas**
 *
 * Storage does not retry sequence conflicts between competing instances.
 * `EventLog.runRemote` retries failed writes; direct `EventLogRemote.write`
 * callers must retry failures other than Forbidden themselves. Live notifications
 * are local to each storage instance; clients on other instances must reconnect
 * to read those writes.
 *
 * **Example** (Create DuckDB storage)
 * ```ts
 * import * as DuckDbEventLogServerEncrypted from "@beep/duckdb/DuckDbEventLogServerEncrypted"
 * const storage = DuckDbEventLogServerEncrypted.makeStorage()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeStorage = Effect.fn("DuckDbEventLogServerEncrypted.makeStorage")(
  (options?: {
    readonly entryTablePrefix?: string;
    readonly remoteIdTable?: string;
  }): Effect.Effect<
    EventLogServerEncrypted.Storage["Service"],
    SqlError.SqlError,
    SqlClient.SqlClient | EventLogEncryption.EventLogEncryption | Scope.Scope
  > =>
    Effect.gen(function* () {
      const encryptions = yield* EventLogEncryption.EventLogEncryption;
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();

      const tablePrefix = options?.entryTablePrefix ?? "effect_events";
      const remoteIdTable = options?.remoteIdTable ?? "effect_remote_id";
      const sessionAuthBindingsTable = `${tablePrefix}_session_auth_bindings`;

      const remoteIdTableSql = sql(remoteIdTable);
      const sessionAuthBindingsTableSql = sql(sessionAuthBindingsTable);

      // beep: DuckDB uses the upstream SQLite BLOB schema for identity and authentication.
      yield* sql`CREATE TABLE IF NOT EXISTS ${remoteIdTableSql} (remote_id BLOB PRIMARY KEY)`;
      yield* sql`CREATE TABLE IF NOT EXISTS ${sessionAuthBindingsTableSql} (
      public_key TEXT PRIMARY KEY, signing_public_key BLOB NOT NULL
    )`;

      const remoteId = yield* sql<{ remote_id: Uint8Array }>`SELECT remote_id FROM ${remoteIdTableSql}`.pipe(
        Effect.flatMap((results) => {
          const first = Arr.head(results);
          if (Option.isSome(first)) {
            return Schema.decodeEffect(EventJournal.RemoteId)(first.value.remote_id).pipe(Effect.orDie);
          }
          const created = makeRemoteIdUnsafe();
          return Effect.as(sql`INSERT INTO ${remoteIdTableSql} (remote_id) VALUES (${created})`, created);
        })
      );

      const resources = yield* RcMap.make({
        lookup: Effect.fnUntraced(function* (scopeKey: string) {
          const scopeHash = Str.slice(0, 16)(yield* encryptions.sha256String(new TextEncoder().encode(scopeKey)));
          const table = `${tablePrefix}_${scopeHash}`;
          const tableSql = sql(table);
          const idsTableSql = sql(`${table}_ids`);
          const indexSql = sql(`${table}_last_sequence`);

          // beep: BIGINT replaces SQLite INTEGER for sequences beyond INT32; explicit sequences remain upstream-owned.
          yield* sql`CREATE TABLE IF NOT EXISTS ${tableSql} (
          sequence BIGINT PRIMARY KEY, last_sequence BIGINT NOT NULL,
          iv BLOB NOT NULL, entry_ids BLOB NOT NULL, encrypted_batch BLOB NOT NULL
        )`;
          yield* sql`CREATE INDEX IF NOT EXISTS ${indexSql} ON ${tableSql} (last_sequence)`;
          yield* sql`CREATE TABLE IF NOT EXISTS ${idsTableSql} (entry_id BLOB PRIMARY KEY, sequence BIGINT NOT NULL)`;

          const pubsub = yield* Effect.acquireRelease(
            PubSub.unbounded<EventLogEncryption.EncryptedRemoteBatch>(),
            PubSub.shutdown
          );
          // Serializes writes within this storage instance.
          const semaphore = yield* Semaphore.make(1);
          return { pubsub, semaphore, tableSql, idsTableSql };
        }, withTracerDisabled),
        idleTimeToLive: "5 minutes",
      });

      // Returns how many of the ids were not stored yet. Stored ids keep their
      // first sequence.
      // beep: DuckDB supports the SQLite ON CONFLICT / RETURNING branch directly.
      const insertNewIds = Effect.fnUntraced(function* (idsTableSql: Statement.Identifier, rows: ReadonlyArray<IdRow>) {
        return yield* sql`INSERT INTO ${idsTableSql} ${sql.insert(rows)} ON CONFLICT DO NOTHING RETURNING entry_id`.pipe(
          Effect.map(Arr.length)
        );
      });

      // beep: Chunked id inserts and the per-batch write are named steps of upstream writeBatches (fallow health).
      const insertIdRows = Effect.fnUntraced(function* (idsTableSql: Statement.Identifier, rows: Iterable<IdRow>) {
        let inserted = 0;
        for (const chunk of Arr.chunksOf(rows, 200)) {
          inserted += yield* insertNewIds(idsTableSql, chunk);
        }
        return inserted;
      });

      const writeBatch = Effect.fnUntraced(function* (
        tableSql: Statement.Identifier,
        idsTableSql: Statement.Identifier,
        batch: EventLogEncryption.EncryptedBatch,
        sequence: number
      ) {
        // Inserting the ids decides whether the batch is new. SQL Server's
        // MERGE also requires unique source ids.
        const inserted = yield* insertIdRows(idsTableSql, uniqueIdRows(batch.entryIds, sequence));
        if (inserted === 0) return Option.none<EventLogEncryption.EncryptedRemoteBatch>();
        const row: BatchRow = {
          sequence,
          last_sequence: sequence + batch.entryIds.length - 1,
          iv: batch.iv,
          entry_ids: concatEntryIds(batch.entryIds),
          encrypted_batch: batch.encryptedBatch,
        };
        yield* sql`INSERT INTO ${tableSql} ${sql.insert(row)}`;
        return Option.some<EventLogEncryption.EncryptedRemoteBatch>({ sequence, ...batch });
      });

      const getSessionAuthBinding = Effect.fnUntraced(function* (publicKey: string) {
        return yield* sql`
          SELECT public_key, signing_public_key
          FROM ${sessionAuthBindingsTableSql}
          WHERE public_key = ${publicKey}
        `.pipe(
          Effect.flatMap(decodeSessionAuthBindings),
          Effect.map((rows) => {
            const row = rows[0];
            return row === undefined ? undefined : new Uint8Array(row.signing_public_key);
          }),
          Effect.orDie
        );
      });

      return EventLogServerEncrypted.Storage.of({
        getId: Effect.succeed(remoteId),
        // Auto-increment sequences start at 1.
        firstSequence: 1,
        getOrCreateSessionAuthBinding: Effect.fnUntraced(
          function* (publicKey, signingPublicKey) {
            const existing = yield* getSessionAuthBinding(publicKey);
            if (existing !== undefined) {
              return existing;
            }
            return yield* sql`
            INSERT INTO ${sessionAuthBindingsTableSql} (public_key, signing_public_key)
            VALUES (${publicKey}, ${signingPublicKey})
          `.pipe(Effect.as(signingPublicKey));
          },
          sql.withTransaction,
          withTracerDisabled,
          Effect.orDie
        ),
        write: Effect.fnUntraced(
          function* (publicKey, storeId, batches) {
            if (batches.length === 0) return [];
            const scopeKey = makeEncryptedScopeKey(publicKey, storeId);
            const { idsTableSql, pubsub, semaphore, tableSql } = yield* RcMap.get(resources, scopeKey);

            const writeBatches = Effect.gen(function* () {
              const stored: Array<EventLogEncryption.EncryptedRemoteBatch> = [];
              // Read before inserting ids, which record the sequence they are stored at.
              const [last] = yield* sql<{ last_sequence: number | string | null }>`
              SELECT MAX(last_sequence) AS last_sequence FROM ${tableSql}
            `;
              let nextSequence = Number(last?.last_sequence ?? 0) + 1;
              for (const batch of batches) {
                const written = yield* writeBatch(tableSql, idsTableSql, batch, nextSequence);
                if (Option.isNone(written)) continue;
                stored.push(written.value);
                nextSequence += batch.entryIds.length;
              }
              return stored;
            });

            return yield* semaphore.withPermits(1)(
              Effect.gen(function* () {
                const stored = yield* sql.withTransaction(writeBatches);
                yield* PubSub.publishAll(pubsub, stored);
                return stored;
              })
            );
          },
          Effect.orDie,
          Effect.scoped,
          withTracerDisabled
        ),
        entrySequences: Effect.fnUntraced(
          function* (publicKey, storeId, entryIds) {
            const { idsTableSql } = yield* RcMap.get(resources, makeEncryptedScopeKey(publicKey, storeId));
            const acks: Array<WriteAck> = [];
            for (const chunk of Arr.chunksOf(entryIds, 200)) {
              const rows = yield* sql`
              SELECT entry_id, sequence FROM ${idsTableSql} WHERE ${sql.in("entry_id", chunk)}
            `.pipe(Effect.flatMap(decodeIdRows));
              for (const row of rows) acks.push({ entryId: row.entry_id, sequence: row.sequence });
            }
            return acks;
          },
          Effect.orDie,
          Effect.scoped,
          withTracerDisabled
        ),
        changes: Effect.fnUntraced(
          function* (publicKey, storeId, startSequence) {
            const scopeKey = makeEncryptedScopeKey(publicKey, storeId);
            const { pubsub, tableSql } = yield* RcMap.get(resources, scopeKey);
            const subscription = yield* PubSub.subscribe(pubsub);
            const initial = yield* sql`
            SELECT sequence, iv, entry_ids, encrypted_batch FROM ${tableSql}
            WHERE last_sequence >= ${startSequence}
            ORDER BY sequence ASC
          `.pipe(Effect.flatMap(decodeBatches));
            return Stream.fromArray(initial).pipe(Stream.concat(Stream.fromSubscription(subscription)));
          },
          Effect.orDie,
          withTracerDisabled,
          Stream.unwrap
        ),
      });
    }).pipe(withTracerDisabled)
);

// beep: schema-derived row types and annotations replace upstream structural aliases.
const $I = $DuckdbId.create("DuckDbEventLogServerEncrypted.service");
const IdRow = Schema.Struct({ entry_id: EventJournal.EntryId, sequence: Schema.Finite }).pipe(
  $I.annoteSchema("IdRow", { description: "Encrypted entry id and its first sequence." })
);
type IdRow = typeof IdRow.Type;

const decodeIdRows = Schema.decodeUnknownEffect(Schema.Array(IdRow));

// beep: HashMap and Effect Array helpers satisfy repo collection laws.
const entryIdKey = (entryId: EntryId): string =>
  Arr.join(
    Arr.map(Arr.fromIterable(entryId), (n) => `${n}`),
    ","
  );

// Unique ids of a batch, each at the sequence of its first occurrence.
const uniqueIdRows = (entryIds: ReadonlyArray<EntryId>, firstSequence: number): Iterable<IdRow> =>
  HashMap.values(
    Arr.reduce(entryIds, HashMap.empty<string, IdRow>(), (ids, entry_id, i) => {
      const key = entryIdKey(entry_id);
      return HashMap.has(ids, key) ? ids : HashMap.set(ids, key, { entry_id, sequence: firstSequence + i });
    })
  );
const BatchRow = Schema.Struct({
  sequence: Schema.Finite,
  last_sequence: Schema.Finite,
  iv: Schema.Uint8Array,
  entry_ids: Schema.Uint8Array,
  encrypted_batch: Schema.Uint8Array,
}).pipe($I.annoteSchema("BatchRow", { description: "Persisted encrypted batch and its sequence range." }));
type BatchRow = typeof BatchRow.Type;

const concatEntryIds = (entryIds: ReadonlyArray<Uint8Array>): Uint8Array => {
  const data = new Uint8Array(entryIds.length * 16);
  for (let i = 0; i < entryIds.length; i++) data.set(Arr.getUnsafe(entryIds, i), i * 16);
  return data;
};

const EncryptedRemoteBatchSql = Schema.Struct({
  sequence: Schema.Natural,
  iv: Schema.Uint8Array,
  entry_ids: Schema.Uint8Array,
  encrypted_batch: Schema.Uint8Array,
}).pipe($I.annoteSchema("EncryptedRemoteBatchSql", { description: "Encrypted batch read from DuckDB." }));

type EncryptedRemoteBatchSql = typeof EncryptedRemoteBatchSql.Type;

const SessionAuthBindingSql = Schema.Struct({
  public_key: Schema.String,
  signing_public_key: Schema.Uint8Array,
}).pipe($I.annoteSchema("SessionAuthBindingSql", { description: "Public signing key pinned to a session identity." }));

type SessionAuthBindingSql = typeof SessionAuthBindingSql.Type;

const decodeBatchRows = Schema.decodeUnknownEffect(Schema.Array(EncryptedRemoteBatchSql));
const decodeSessionAuthBindingRows = Schema.decodeUnknownEffect(Schema.Array(SessionAuthBindingSql));

// beep: validate reconstructed batches instead of upstream branded buffer/non-empty assertions.
const toEncryptedRemoteBatch = Effect.fnUntraced(function* (row: EncryptedRemoteBatchSql) {
  const entryIds: Array<EntryId> = [];
  for (let offset = 0; offset < row.entry_ids.byteLength; offset += 16) {
    entryIds.push(EventJournal.EntryId.make(new Uint8Array(row.entry_ids.subarray(offset, offset + 16))));
  }
  return yield* Schema.decodeUnknownEffect(EventLogEncryption.EncryptedRemoteBatch)({
    sequence: row.sequence,
    entryIds,
    iv: new Uint8Array(row.iv),
    encryptedBatch: new Uint8Array(row.encrypted_batch),
  });
});

const decodeBatches = Effect.fnUntraced(function* (rows: unknown) {
  return yield* decodeBatchRows(rows).pipe(Effect.flatMap(Effect.forEach(toEncryptedRemoteBatch)));
});
const decodeSessionAuthBindings = decodeSessionAuthBindingRows;

/**
 * Provides encrypted server `Storage` using the SQL-backed implementation.
 *
 * **Example** (Create DuckDB storage)
 * ```ts
 * import * as DuckDbEventLogServerEncrypted from "@beep/duckdb/DuckDbEventLogServerEncrypted"
 * const storage = DuckDbEventLogServerEncrypted.layerStorage()
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStorage = (options?: {
  readonly entryTablePrefix?: string;
  readonly remoteIdTable?: string;
}): Layer.Layer<
  EventLogServerEncrypted.Storage,
  SqlError.SqlError,
  SqlClient.SqlClient | EventLogEncryption.EventLogEncryption
> => Layer.effect(EventLogServerEncrypted.Storage)(makeStorage(options));

/**
 * Provides SQL-backed encrypted server `Storage` and supplies the default Web
 * Crypto `EventLogEncryption` layer.
 *
 * **Example** (Create DuckDB storage)
 * ```ts
 * import * as DuckDbEventLogServerEncrypted from "@beep/duckdb/DuckDbEventLogServerEncrypted"
 * const storage = DuckDbEventLogServerEncrypted.layerStorageSubtle()
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStorageSubtle = (options?: {
  readonly entryTablePrefix?: string;
  readonly remoteIdTable?: string;
}): Layer.Layer<EventLogServerEncrypted.Storage, SqlError.SqlError, SqlClient.SqlClient> =>
  layerStorage(options).pipe(Layer.provide(EventLogEncryption.layerSubtle));

const makeEncryptedScopeKey = (publicKey: string, storeId: string): string => `${publicKey}/${storeId}`;

const withTracerDisabled = Effect.withTracerEnabled(false);
