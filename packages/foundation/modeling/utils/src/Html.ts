/**
 * A module containing utilities for escaping HTML text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { flow } from "effect";
import * as Str from "effect/String";

/**
 * Escapes the HTML-sensitive characters in `text`.
 *
 * **Details**
 *
 * Replaces `&`, `<`, `>`, `"`, and `'` with their corresponding HTML
 * entities.
 *
 * **Example** (Escape HTML-sensitive characters)
 *
 * ```typescript
 * import { escapeHtml } from "@beep/utils/Html"
 *
 * const value = escapeHtml(`<div class="note">it's fine</div>`)
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeHtml = flow(
  Str.replaceAll("&", "&amp;"),
  Str.replaceAll("<", "&lt;"),
  Str.replaceAll(">", "&gt;"),
  Str.replaceAll('"', "&quot;"),
  Str.replaceAll("'", "&#39;")
);

/**
 * Escapes HTML-sensitive characters and converts newlines to `<br />`.
 *
 * **Details**
 *
 * Useful when rendering plain multi-line text into HTML while preserving line
 * breaks.
 *
 * **Example** (Escape text with line breaks)
 *
 * ```typescript
 * import { escapeHtmlMultiline } from "@beep/utils/Html"
 *
 * const value = escapeHtmlMultiline("hello\n<script>alert('x')</script>")
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeHtmlMultiline = flow(escapeHtml, Str.replaceAll("\n", "<br />"));
