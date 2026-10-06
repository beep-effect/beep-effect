/**
 * Poppler driver: PDF page counting and page rasterization for OCR.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Configuration and error models.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Poppler.schema.ts";
/**
 * Rasterizer contract and constructor.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Poppler.service.ts";

/**
 * Package version.
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
