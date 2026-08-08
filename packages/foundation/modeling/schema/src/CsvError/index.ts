/**
 * Namespace-first public module for CSV errors.
 *
 * **Example** (Import CsvError namespace)
 *
 * ```ts
 * import * as CsvError from "@beep/schema/CsvError"
 *
 * const error = CsvError.make("Failed to parse CSV")
 * console.log(error.message)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Public schema module export.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./CsvError.errors.ts";
