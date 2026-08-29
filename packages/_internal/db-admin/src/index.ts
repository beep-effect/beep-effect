/**
 * Internal db-admin migration aggregation for repo-owned database proof
 * targets.
 *
 * **Details**
 *
 * This package is the migration tooling boundary for generated Drizzle SQL and
 * proof targets. Production application packages should depend on their slice
 * table packages instead of importing `_internal/db-admin`.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

/**
 * Migration application exports (folder, schema, boot effect).
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./migrate.ts";
/**
 * Migration target exports.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./targets.ts";
