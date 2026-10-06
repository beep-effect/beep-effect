/**
 * Tesseract OCR driver: page recognition with word confidence, installed language models and script detection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Configuration, script and language models, and output parsers.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Tesseract.schema.ts";
/**
 * Page OCR engine constructor.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Tesseract.service.ts";

/**
 * Package version.
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
