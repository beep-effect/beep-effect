/**
 * Schema-backed file signature detection and validation.
 *
 * **Details**
 *
 * The module models supported extensions, binary input, signatures, catalog
 * metadata, and options as Effect schemas. Detection returns an `Option` so an
 * unknown or inconclusive header remains explicit at the call site.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * @category validation
 * @since 0.0.0
 */
export * from "./FileTypeChecker.behavior.ts";
/**
 * @category constants
 * @since 0.0.0
 */
export * from "./FileTypeChecker.catalog.ts";
/**
 * @category schemas
 * @since 0.0.0
 */
export * from "./FileTypeChecker.schema.ts";
