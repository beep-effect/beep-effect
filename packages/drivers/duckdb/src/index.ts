/**
 * DuckDB driver package for local analytical storage and Parquet exports.
 *
 * **Details**
 *
 * The public surface combines schema-first request/error models with an Effect
 * service boundary. Domain packages own SQL shape, retention policy, and
 * projection semantics; this package owns native DuckDB connection management,
 * typed error normalization, transaction mechanics, and Parquet export wiring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public DuckDB driver error models and normalization helpers.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./DuckDb.errors.ts";
/**
 * Public DuckDB driver request and row schemas.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./DuckDb.models.ts";
/**
 * Public DuckDB service, adapter, and layer exports.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./DuckDb.service.ts";
/**
 * Public DuckDB-backed Effect SQL client exports.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./DuckDbSqlClient.service.ts";
