/**
 * Safe HTML projection for schema-first Markdown documents.
 *
 * Markdown schemas map themselves directly into `@beep/html` nodes. This
 * module applies conformance, policy, and serialization without parsing or
 * sanitizing an intermediate HTML string; opaque `SafeHtml` provenance remains
 * owned by `@beep/html`.
 *
 * @packageDocumentation \@beep/md/Md.html
 * @since 0.0.0
 */

import { conform, enforceSafeHtml, serializeSafe } from "@beep/html";
import { Effect } from "effect";
import { Document } from "./Md.model.ts";
import type { SafeHtml } from "@beep/html";
import type { SafeDocument } from "./Md.safe.ts";

/**
 * Renders a user-boundary Markdown document as opaque, policy-proven HTML.
 *
 * **Details**
 *
 * {@link Document.toHtml} performs the direct AST projection before this
 * renderer executes the canonical `conform -> enforceSafeHtml -> serializeSafe`
 * pipeline. Raw nodes cannot enter through {@link SafeDocument}; the defensive
 * raw-node branches render their source as text if a structurally forged value
 * reaches this module.
 *
 * **Example** (Render simple paragraph document)
 *
 * ```ts
 * import { Md, safeHtmlValue } from "@beep/md"
 * import { Result } from "effect"
 *
 * const document = Result.getOrThrow(Md.refineSafeDocument(Md.make([Md.p("Hello")])))
 * console.log(safeHtmlValue(Md.renderSafeHtml(document))) // "<p>Hello</p>"
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderSafeHtml = (document: SafeDocument): SafeHtml =>
  Effect.runSync(
    conform(Document.toHtml(document)).pipe(Effect.flatMap(enforceSafeHtml), Effect.flatMap(serializeSafe))
  );

/**
 * Unwraps opaque safe HTML at a final browser or framework sink.
 *
 * Re-exporting the HTML-owned getter keeps trust provenance explicit for
 * Markdown consumers without creating a second marker or issuer.
 *
 * @category getters
 * @since 0.0.0
 */
export { safeHtmlValue } from "@beep/html";
