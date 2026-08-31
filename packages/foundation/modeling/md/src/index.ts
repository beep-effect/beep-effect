/**
 * Effect Schema driven Markdown AST builder.
 *
 * @packageDocumentation \@beep/md
 * @since 0.0.0
 */

/**
 * Package version.
 *
 * **Example** (Import and type VERSION)
 *
 * ```ts
 * import { VERSION } from "@beep/md"
 *
 * const version: "0.0.2" = VERSION
 * console.log(version)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.2" as const;

/**
 * Shared list-item run segmentation and compatibility aliases for schema-owned plain-text projections.
 *
 * **Example** (Render plain-text heading)
 *
 * ```ts import.meta.vitest name="Render plain-text heading"
 * import { Md } from "@beep/md"
 * import { renderPlainTextBlocks } from "@beep/md"
 *
 * renderPlainTextBlocks([Md.h1("Hello")]) // => "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Md.behavior.ts";
/**
 * Markdown and HTML escaping and URL-sanitization helpers.
 *
 * **Example** (Escape markdown hash)
 *
 * ```ts import.meta.vitest name="Escape markdown hash"
 * import { escapeMarkdownText } from "@beep/md"
 *
 * escapeMarkdownText("#") // => "\\#"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Md.escape.ts";
/**
 * Opaque safe-output rendering over the schema-owned HTML AST projection.
 *
 * **Example** (Render safe HTML paragraph)
 *
 * ```ts
 * import { Md, renderSafeHtml, safeHtmlValue } from "@beep/md"
 * import { Result } from "effect"
 *
 * const document = Result.getOrThrow(Md.refineSafeDocument(Md.make([Md.p("Hello")])))
 * console.log(safeHtmlValue(renderSafeHtml(document))) // "<p>Hello</p>"
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export * from "./Md.html.ts";
/**
 * Schema-first Markdown AST models.
 *
 * **Example** (Create empty Document)
 *
 * ```ts import.meta.vitest name="Create empty Document"
 * import { Document } from "@beep/md"
 *
 * Document.make({ children: [] })._tag // => "document"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Md.model.ts";
/**
 * Render adapters and schema transformations.
 *
 * **Example** (Render via MarkdownAdapter)
 *
 * ```ts import.meta.vitest name="Render via MarkdownAdapter"
 * import { Md, MarkdownAdapter } from "@beep/md"
 *
 * MarkdownAdapter.render(Md.make([Md.p`Hello`])) // => "Hello"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export * from "./Md.render.ts";
/**
 * Branded user-content trust-boundary refinements and structured safety issues.
 *
 * **Example** (Refine safe document success)
 *
 * ```ts import.meta.vitest name="Refine safe document success"
 * import { Md, refineSafeDocument } from "@beep/md"
 * import { Result } from "effect"
 *
 * Result.isSuccess(refineSafeDocument(Md.make([Md.p("Hello")]))) // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./Md.safe.ts";
/**
 * Public Markdown builder namespace and constructor helpers.
 *
 * **Example** (Build and render heading)
 *
 * ```ts import.meta.vitest name="Build and render heading"
 * import { Md } from "@beep/md"
 * import { Result } from "effect"
 *
 * const markdown = Md.render(Md.make([Md.h1`Hello`]))
 * Result.getOrThrow(markdown) // => "# Hello"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./Md.ts";
