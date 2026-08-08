/**
 * `@beep/postgres` driver-level Postgres runtime and diagnostics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public Postgres error exports.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./Postgres.errors.ts";
/**
 * Public Postgres client service exports.
 *
 * @since 0.0.0
 * @category clients
 */
export * from "./PostgresClient.service.ts";
/**
 * Public Postgres formatting exports.
 *
 * @since 0.0.0
 * @category formatting
 */
export * from "./PostgresDiagnostics.service.ts";
/**
 * Public Postgres Drizzle composition exports.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./PostgresDrizzle.service.ts";
/**
 * Public native Postgres/Drizzle interop type exports.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./PostgresInterop.models.ts";
/**
 * Public PostgreSQL SQLSTATE exports.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./PostgresSqlState.models.ts";

/**
 * Package version.
 *
 * **Example** (Build package version label)
 *
 * ```ts
 * import { VERSION } from "@beep/postgres"
 *
 * const packageLabel = `@beep/postgres@${VERSION}`
 * console.log(packageLabel) // "@beep/postgres@0.0.0"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
