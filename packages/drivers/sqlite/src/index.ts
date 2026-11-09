/**
 * `@beep/sqlite` driver-level Bun SQLite runtime.
 *
 * **Details**
 *
 * Wraps `@effect/sql-sqlite-bun` as a driver layer with typed
 * {@link SqliteError} failures, native extension loading for sqlite-vec, and an
 * FTS5 capability probe.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public SQLite driver error exports.
 *
 * **Example** (Create error from unknown)
 *
 * ```ts
 * import { SqliteError } from "@beep/sqlite"
 *
 * const error = SqliteError.fromUnknown("connect", new Error("boom"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Sqlite.errors.ts";
/**
 * Public SQLite in-memory test layer exports.
 *
 * **Example** (Import test layer)
 *
 * ```ts
 * import { SqliteTestLayer } from "@beep/sqlite"
 *
 * console.log(SqliteTestLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Sqlite.test-layer.ts";
/**
 * Public SQLite client service and layer exports.
 *
 * **Example** (Create layer with filename)
 *
 * ```ts
 * import { makeLayer } from "@beep/sqlite"
 *
 * const layer = makeLayer({ filename: "./.beep/memory.db" })
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./SqliteClient.service.ts";
