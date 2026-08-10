/**
 * `@beep/pglite` driver-level in-process PGlite (embedded PostgreSQL) runtime.
 *
 * Wraps `@effect/sql-pglite` and aliases its client under the `@effect/sql-pg`
 * PgClient tag so Drizzle-backed repositories run unchanged against an
 * in-process database.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { VERSION } from "@beep/pglite"
 *
 * console.log(VERSION)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Public PGlite driver error exports.
 *
 * **Example** (Create error from unknown)
 *
 * ```ts
 * import { PgliteError } from "@beep/pglite"
 *
 * const error = PgliteError.fromUnknown("connect", new Error("boom"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Pglite.errors.ts";
/**
 * Public PGlite in-memory test layer exports.
 *
 * **Example** (Import test layer)
 *
 * ```ts
 * import { PgliteTestLayer } from "@beep/pglite"
 *
 * console.log(PgliteTestLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Pglite.test-layer.ts";
/**
 * Public PGlite client service and layer exports.
 *
 * **Example** (Create layer with dataDir)
 *
 * ```ts
 * import { makeLayer } from "@beep/pglite"
 *
 * const layer = makeLayer({ dataDir: "./.beep/chat-db" })
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./PgliteClient.service.ts";
