/**
 * Documents server layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { DocumentsServerLayer } from "./aggregates/Document/index.js";

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
