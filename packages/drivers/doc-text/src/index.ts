/**
 * JS-native PDF and DOCX text extraction driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Typed document text driver errors.
 *
 * **Example** (Make extraction error)
 *
 * ```ts
 * import { makeDocTextError } from "@beep/doc-text"
 *
 * console.log(makeDocTextError("extraction").reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./DocText.errors.ts";
/**
 * JS-native document text file-processing engine.
 *
 * **Example** (Log engine descriptor name)
 *
 * ```ts
 * import { DocTextFileProcessingEngine } from "@beep/doc-text"
 *
 * console.log(DocTextFileProcessingEngine.descriptor.name)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./DocText.service.ts";

/**
 * Package version.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { VERSION } from "@beep/doc-text"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
