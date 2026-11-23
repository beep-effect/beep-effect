/**
 * Schema-first request and row models for the DuckDB driver boundary.
 *
 * **Details**
 *
 * These models describe the technical DuckDB boundary only. Domain packages
 * define their own row projections and decode those projections after this
 * driver has returned JSON-compatible row objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DuckdbId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $DuckdbId.create("DuckDb.models");

/**
 * **Details**
 *
 * Use `":memory:"` for an in-memory database. File paths are passed to the
 * native DuckDB Node API as-is; this package does not create parent
 * directories or encode domain-specific storage policy.
 *
 * **Example** (In-memory connection options)
 *
 * ```ts
 * import { DuckDbConnectionOptions } from "@beep/duckdb"
 *
 * const options = DuckDbConnectionOptions.make({
 *   databasePath: ":memory:"
 * })
 *
 * console.log(options.databasePath) // ":memory:"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DuckDbConnectionOptions extends S.Opaque<DuckDbConnectionOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    databaseOptions: S.optionalKey(S.Record(S.String, S.String)).annotateKey({
      description: "Native DuckDB database option map passed through when present.",
    }),
    databasePath: S.String.annotateKey({
      description: "DuckDB database path, including ':memory:' for an in-memory database.",
    }),
  }).pipe(
    $I.annoteSchema("DuckDbConnectionOptions", {
      description: "Connection options for a DuckDB database.",
    })
  )
) {}

/**
 * Request to export one DuckDB table to a Parquet file.
 *
 * **Details**
 *
 * The service quotes `tableName` and `filePath` before constructing DuckDB's
 * `COPY ... TO ... (FORMAT parquet)` statement. The request does not describe
 * filtering or projection; callers create the table shape they want before
 * exporting it.
 *
 * **Example** (Parquet export request)
 *
 * ```ts
 * import { DuckDbParquetExport } from "@beep/duckdb"
 *
 * const request = DuckDbParquetExport.make({
 *   filePath: "exports/table.parquet",
 *   tableName: "ai_metrics_ingest_runs"
 * })
 *
 * console.log(`${request.tableName} -> ${request.filePath}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DuckDbParquetExport extends S.Opaque<DuckDbParquetExport, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String.annotateKey({
      description: "Filesystem path where DuckDB writes the Parquet file.",
    }),
    tableName: S.NonEmptyString.annotateKey({
      description: "DuckDB table identifier to export.",
    }),
  }).pipe(
    $I.annoteSchema("DuckDbParquetExport", {
      description: "Parquet export request for a DuckDB table.",
    })
  )
) {}

/**
 * **Details**
 *
 * The native row reader can produce arbitrary JavaScript values. The service
 * decodes those values through this schema before returning rows, so invalid
 * row shapes fail as {@link DuckDbError} instead of leaking unchecked data.
 *
 * **Example** (Decode unknown row object)
 *
 * ```ts
 * import { DuckDbRow } from "@beep/duckdb"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(DuckDbRow)({ count: 1, id: "run-1" })
 * console.log(row.id) // "run-1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DuckDbRow = S.JsonObject.pipe(
  $I.annoteSchema("DuckDbRow", {
    description: "JSON-compatible row returned from DuckDB queries.",
  })
);

/**
 * **Example** (Satisfy DuckDbRow type)
 *
 * ```ts
 * import type { DuckDbRow } from "@beep/duckdb"
 *
 * const row = { count: 1, id: "run-1" } satisfies DuckDbRow
 * console.log(Object.keys(row)) // ["count", "id"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DuckDbRow = typeof DuckDbRow.Type;

/**
 * **Details**
 *
 * `DuckDb.query` decodes the complete array through this schema after the
 * native reader returns row objects. The schema intentionally stays
 * product-neutral; callers decode domain-specific row shapes in their own
 * package.
 *
 * **Example** (Decode unknown rows array)
 *
 * ```ts
 * import { DuckDbRows } from "@beep/duckdb"
 * import * as S from "effect/Schema"
 *
 * const rows = S.decodeUnknownSync(DuckDbRows)([{ id: "run-1" }])
 * console.log(rows.length) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DuckDbRows = S.Array(DuckDbRow).pipe(
  $I.annoteSchema("DuckDbRows", {
    description: "JSON-compatible rows returned from DuckDB queries.",
  })
);

/**
 * **Example** (Satisfy DuckDbRows type)
 *
 * ```ts
 * import type { DuckDbRows } from "@beep/duckdb"
 *
 * const rows = [{ id: "run-1" }] satisfies DuckDbRows
 * console.log(rows[0]?.id) // "run-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DuckDbRows = typeof DuckDbRows.Type;

/**
 * **Details**
 *
 * The data half of `DuckDbClient.DuckDbClientConfig`. Function and
 * runtime-only fields (`transformQueryNames`, `transformResultNames`,
 * `spanAttributes`, `prepareCacheTTL`) live on the config type alias, because
 * a schema cannot carry them. `Config.schema(DuckDbClientConfigData)` is an
 * accepted `layerConfig` input.
 *
 * **Example** (Decode client configuration)
 *
 * ```ts
 * import { DuckDbClientConfigData } from "@beep/duckdb"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(DuckDbClientConfigData)({ databasePath: ":memory:", readOnly: false })
 * console.log(config.databasePath) // ":memory:"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DuckDbClientConfigData extends S.Opaque<DuckDbClientConfigData, { readonly brand: unique symbol }>()(
  S.Struct({
    databaseOptions: S.optionalKey(S.Record(S.String, S.String)).annotateKey({
      description:
        "Native DuckDB instance options passed through unchanged (threads, memory_limit, temp_directory, ...).",
    }),
    databasePath: S.String.annotateKey({
      description: "Database file path, or ':memory:' for a private in-memory database.",
    }),
    prepareCacheSize: S.optionalKey(S.Int).annotateKey({
      description: "Prepared statements cached per connection. Defaults to 200; 0 or less disables the cache.",
    }),
    readerConnections: S.optionalKey(S.Natural).annotateKey({
      description: "Read-only connections for streams outside transactions. Defaults to 0 (one writer only).",
    }),
    readOnly: S.optionalKey(S.Boolean).annotateKey({
      description:
        "When true, open with access_mode=READ_ONLY through the shared instance cache; refused while this process holds the same file read-write.",
    }),
    timeZone: S.optionalKey(S.String).annotateKey({
      description: "Session TimeZone set on the client's connection. Defaults to 'UTC'.",
    }),
  }).pipe(
    $I.annoteSchema("DuckDbClientConfigData", {
      description: "Serializable configuration of a DuckDB effect/sql client.",
    })
  )
) {}

/**
 * Rows for a native Appender, in complete table column order.
 *
 * **Example** (Load two rows)
 *
 * ```ts
 * import { DuckDbAppendRows } from "@beep/duckdb"
 * const request = DuckDbAppendRows.make({ table: "people", rows: [[1, "Ada"], [2, "Bob"]] })
 * console.log(request.rows.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DuckDbAppendRows extends S.Opaque<DuckDbAppendRows, { readonly brand: unique symbol }>()(
  S.Struct({
    table: S.NonEmptyString,
    schema: S.optionalKey(S.NonEmptyString),
    rows: S.Unknown.pipe(S.Array, S.Array),
  }).pipe($I.annoteSchema("DuckDbAppendRows", { description: "Complete rows to append to a DuckDB table." }))
) {}

/**
 * **Example** (Choose an artifact directory)
 *
 * ```ts
 * import { DuckDbDatabaseExport } from "@beep/duckdb"
 * const request = DuckDbDatabaseExport.make({ directory: "exports/database", format: "parquet" })
 * console.log(request.directory) // "exports/database"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DuckDbDatabaseExport extends S.Opaque<DuckDbDatabaseExport, { readonly brand: unique symbol }>()(
  S.Struct({ directory: S.NonEmptyString, format: S.optionalKey(S.Literals(["csv", "parquet"])) }).pipe(
    $I.annoteSchema("DuckDbDatabaseExport", { description: "Directory artifact for EXPORT DATABASE." })
  )
) {}

/**
 * **Example** (Choose an artifact directory)
 *
 * ```ts
 * import { DuckDbDatabaseImport } from "@beep/duckdb"
 * const request = DuckDbDatabaseImport.make({ directory: "exports/database" })
 * console.log(request.directory) // "exports/database"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DuckDbDatabaseImport extends S.Opaque<DuckDbDatabaseImport, { readonly brand: unique symbol }>()(
  S.Struct({ directory: S.NonEmptyString }).pipe(
    $I.annoteSchema("DuckDbDatabaseImport", { description: "Directory artifact to restore into an empty database." })
  )
) {}
