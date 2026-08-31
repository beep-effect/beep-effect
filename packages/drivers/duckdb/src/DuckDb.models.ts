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
import { JsonObject, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $DuckdbId.create("DuckDb.models");

/**
 * Connection options for opening a DuckDB database instance.
 *
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
export class DuckDbConnectionOptions extends S.Class<DuckDbConnectionOptions>($I`DuckDbConnectionOptions`)(
  {
    databaseOptions: S.optionalKey(S.Record(S.String, S.String)).annotateKey({
      description: "Native DuckDB database option map passed through when present.",
    }),
    databasePath: S.String.annotateKey({
      description: "DuckDB database path, including ':memory:' for an in-memory database.",
    }),
  },
  $I.annote("DuckDbConnectionOptions", {
    description: "Connection options for a DuckDB database.",
  })
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
export class DuckDbParquetExport extends S.Class<DuckDbParquetExport>($I`DuckDbParquetExport`)(
  {
    filePath: S.String.annotateKey({
      description: "Filesystem path where DuckDB writes the Parquet file.",
    }),
    tableName: S.NonEmptyString.annotateKey({
      description: "DuckDB table identifier to export.",
    }),
  },
  $I.annote("DuckDbParquetExport", {
    description: "Parquet export request for a DuckDB table.",
  })
) {}

/**
 * Schema for a JSON-compatible row returned from a DuckDB query.
 *
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
 *
 * const row = DuckDbRow.decodeUnknownSync({ count: 1, id: "run-1" })
 * console.log(row.id) // "run-1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DuckDbRow = JsonObject.pipe(
  $I.annoteSchema("DuckDbRow", {
    description: "JSON-compatible row returned from DuckDB queries.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"])
);

/**
 * Runtime TypeScript type represented by {@link DuckDbRow}.
 *
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
 * Schema for the row set returned from a DuckDB query.
 *
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
 *
 * const rows = DuckDbRows.decodeUnknownSync([{ id: "run-1" }])
 * console.log(rows.length) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DuckDbRows = S.Array(DuckDbRow).pipe(
  $I.annoteSchema("DuckDbRows", {
    description: "JSON-compatible rows returned from DuckDB queries.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"]),
  SchemaUtils.withStatics((schema) => ({
    decodeEffect: S.decodeUnknownEffect(schema),
  }))
);

/**
 * Runtime TypeScript type represented by {@link DuckDbRows}.
 *
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
