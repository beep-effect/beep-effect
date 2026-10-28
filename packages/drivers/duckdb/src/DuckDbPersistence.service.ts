/**
 * DuckDB persistence backing stores adapted from Effect 4.0.6 Persistence (MIT).
 * @packageDocumentation
 * @since 0.0.0
 */
// beep: port only the SQLite branch; Effect.fn helpers, schema codecs and typed errors enforce repo laws.
// The single-table set delegates to setMany and SQL errors share contextual messages; store behavior is unchanged.
import { $DuckdbId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Persistence from "effect/persistence/Persistence";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const $I = $DuckdbId.create("DuckDbPersistence.service");
// beep: schema codecs and HashMap replace upstream JSON.parse/stringify and Map under repo laws.
const JsonObject = S.fromJsonString(S.ObjectKeyword);
const encode = S.encodeEffect(JsonObject);
const decode = S.decodeUnknownEffect(JsonObject);
const ValueRow = S.Struct({ id: S.String, value: S.String }).pipe(
  $I.annoteSchema("ValueRow", { description: "JSON value associated with a persistence key." })
);
const decodeRows = S.decodeUnknownEffect(S.Array(ValueRow));
const persistenceError = (message: string) => (cause: unknown) => Persistence.PersistenceError.make({ message, cause });

/**
 * Provides one DuckDB table per store, delegating all operations to upstream.
 * Store ids follow upstream's identifier restrictions (no dots or case-only distinctions).
 *
 * **Example** (Use separate tables)
 * ```ts
 * import * as DuckDbPersistence from "@beep/duckdb/DuckDbPersistence"
 * const backing = DuckDbPersistence.layerBackingSqlMultiTable
 * ```
 * @category layers
 * @since 0.0.0
 */
export const layerBackingSqlMultiTable: Layer.Layer<Persistence.BackingPersistence, never, SqlClient.SqlClient> =
  Layer.effect(Persistence.BackingPersistence)(
    Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();
      const upstream = yield* Persistence.BackingPersistence;
      return Persistence.BackingPersistence.of({
        make: Effect.fnUntraced(function* (storeId) {
          // beep: only expires differs from upstream SQLite; pre-create BIGINT then delegate unchanged.
          yield* sql`CREATE TABLE IF NOT EXISTS ${sql(`effect_persistence_${storeId}`)} (
          id TEXT PRIMARY KEY, value TEXT NOT NULL, expires BIGINT
        )`.pipe(Effect.orDie);
          return yield* upstream.make(storeId);
        }),
      });
    })
  ).pipe(Layer.provide(Persistence.layerBackingSqlMultiTable));

/**
 * Provides a shared DuckDB table with store isolation, TTL filtering and bounded cleanup.
 *
 * **Example** (Use a shared table)
 * ```ts
 * import * as DuckDbPersistence from "@beep/duckdb/DuckDbPersistence"
 * const backing = DuckDbPersistence.layerBackingSql
 * ```
 * @category layers
 * @since 0.0.0
 */
export const layerBackingSql: Layer.Layer<Persistence.BackingPersistence, never, SqlClient.SqlClient> = Layer.effect(
  Persistence.BackingPersistence
)(
  Effect.gen(function* () {
    const sql = (yield* SqlClient.SqlClient).withoutTransforms();
    const table = sql("effect_persistence");
    // beep: BIGINT preserves current epoch milliseconds; DuckDB does not support partial indexes.
    // A plain expires index preserves cleanup's range lookup without changing expiration semantics.
    yield* sql`CREATE TABLE IF NOT EXISTS ${table} (
      store_id TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, expires BIGINT,
      PRIMARY KEY (store_id, id)
    )`.pipe(Effect.orDie);
    yield* sql`CREATE INDEX IF NOT EXISTS effect_persistence_expires_idx ON ${table} (expires)`.pipe(Effect.orDie);
    // beep: retain upstream's bounded rowid deletion, 1000-row batch and scoped five-minute schedule.
    const cleanupBatchSize = 1000;
    const deleteExpired = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      return yield* sql`DELETE FROM ${table} WHERE rowid IN (
        SELECT rowid FROM ${table} WHERE expires IS NOT NULL AND expires <= ${now} LIMIT 1000
      ) RETURNING 1 AS deleted`.pipe(
        Effect.map(A.length),
        Effect.repeat({ while: (count) => count === cleanupBatchSize, schedule: Schedule.spaced(Duration.millis(10)) })
      );
    });
    yield* deleteExpired.pipe(
      Effect.catch((cause) => Effect.logWarning("Failed to clean up expired persistence entries", cause)),
      Effect.repeat(Schedule.spaced(Duration.minutes(5))),
      Effect.forkScoped
    );
    return Persistence.BackingPersistence.of({
      make: Effect.fnUntraced(function* (storeId) {
        const clock = yield* Clock.Clock;
        const read = Effect.fnUntraced(function* (keys: A.NonEmptyArray<string>) {
          return yield* sql`SELECT id, value FROM ${table} WHERE store_id = ${storeId}
            AND ${sql.in("id", keys)} AND (expires IS NULL OR expires > ${clock.currentTimeMillisUnsafe()})`.unprepared.pipe(
            Effect.flatMap(decodeRows),
            Effect.mapError(persistenceError("Failed to read backing store"))
          );
        });
        const setMany: Persistence.BackingPersistenceStore["setMany"] = Effect.fnUntraced(function* (entries) {
          const rows = yield* Effect.forEach(entries, ([id, value, ttl]) =>
            encode(value).pipe(
              Effect.map((value) => ({
                store_id: storeId,
                id,
                value,
                expires: Persistence.unsafeTtlToExpires(clock, ttl),
              })),
              Effect.mapError(persistenceError("Failed to serialize values into backing store"))
            )
          );
          yield* sql`INSERT INTO ${table} ${sql.insert(rows)} ON CONFLICT (store_id, id)
            DO UPDATE SET value = excluded.value, expires = excluded.expires`.unprepared.pipe(
            Effect.mapError(persistenceError("Failed to setMany in backing store"))
          );
        });
        return {
          get: Effect.fnUntraced(function* (key) {
            const rows = yield* read([key]);
            return yield* A.match(rows, {
              onEmpty: () => Effect.undefined,
              onNonEmpty: ([row]) =>
                decode(row.value).pipe(Effect.mapError(persistenceError(`Failed to parse value for key ${key}`))),
            });
          }),
          getMany: Effect.fnUntraced(function* (keys) {
            const rows = yield* read(keys);
            let values = HashMap.empty<string, object>();
            for (const row of rows) {
              // beep: malformed rows remain absent in getMany, matching upstream's per-row parse recovery.
              const value = yield* decode(row.value).pipe(Effect.option);
              if (Option.isSome(value)) values = HashMap.set(values, row.id, value.value);
            }
            return A.map(keys, (key) => Option.getOrUndefined(HashMap.get(values, key)));
          }),
          set: (key, value, ttl) => setMany([[key, value, ttl]]),
          setMany,
          remove: (key) =>
            sql`DELETE FROM ${table} WHERE store_id = ${storeId} AND id = ${key}`.pipe(
              Effect.asVoid,
              Effect.mapError(persistenceError(`Failed to remove key ${key} from backing store`))
            ),
          clear: sql`DELETE FROM ${table} WHERE store_id = ${storeId}`.pipe(
            Effect.asVoid,
            Effect.mapError(persistenceError("Failed to clear backing store"))
          ),
        } satisfies Persistence.BackingPersistenceStore;
      }),
    });
  })
);

/**
 * Provides schema-aware Persistence using the shared DuckDB backing table.
 *
 * **Example** (Provide persistence)
 * ```ts
 * import * as DuckDbPersistence from "@beep/duckdb/DuckDbPersistence"
 * const live = DuckDbPersistence.layerSql
 * ```
 * @category layers
 * @since 0.0.0
 */
export const layerSql = Persistence.layer.pipe(Layer.provide(layerBackingSql));

/**
 * Provides schema-aware Persistence using one DuckDB table per store id.
 *
 * **Example** (Provide table-per-store persistence)
 * ```ts
 * import * as DuckDbPersistence from "@beep/duckdb/DuckDbPersistence"
 * const live = DuckDbPersistence.layerSqlMultiTable
 * ```
 * @category layers
 * @since 0.0.0
 */
export const layerSqlMultiTable = Persistence.layer.pipe(Layer.provide(layerBackingSqlMultiTable));
