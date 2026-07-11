/**
 * Documents server layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { DocumentsServerLayer, DocumentsServerLlmLayer } from "./aggregates/Document/index.js";

/**
 * Live documents server layer.
 *
 * @example
 * ```ts
 * import { DocumentsServerLive } from "@beep/documents-server/layer"
 *
 * console.log(DocumentsServerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsServerLive = DocumentsServerLayer;

/**
 * Live documents server layer using an app-provided LanguageModel and file-processing service.
 *
 * @example
 * ```ts
 * import { DocumentsServerLlmLive } from "@beep/documents-server/layer"
 *
 * console.log(DocumentsServerLlmLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsServerLlmLive = DocumentsServerLlmLayer;
