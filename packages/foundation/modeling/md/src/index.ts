/**
 * Effect Schema driven Markdown AST builder.
 *
 * @packageDocumentation \@beep/md
 * @since 0.0.0
 */

/**
 * Package version.
 *
 * @example
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
 * Pure, escaping-free node behavior (plain-text projection and run segmentation).
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { renderPlainTextBlocks } from "@beep/md"
 *
 * console.log(renderPlainTextBlocks([Md.h1("Hello")])) // "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Md.behavior.ts";
/**
 * Markdown and HTML escaping and URL-sanitization helpers.
 *
 * @example
 * ```ts
 * import { escapeMarkdownText } from "@beep/md"
 *
 * console.log(escapeMarkdownText("#")) // "\\#"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Md.escape.ts";
/**
 * Direct safe-HTML AST projection and opaque safe-output rendering.
 *
 * @example
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
 * @example
 * ```ts
 * import { Document } from "@beep/md"
 *
 * console.log(Document.make({ children: [] })._tag) // "document"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Md.model.ts";
/**
 * Render adapters and schema transformations.
 *
 * @example
 * ```ts
 * import { Md, MarkdownAdapter } from "@beep/md"
 *
 * console.log(MarkdownAdapter.render(Md.make([Md.p`Hello`]))) // "Hello"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export * from "./Md.render.ts";
/**
 * Branded user-content trust-boundary refinements and structured safety issues.
 *
 * @example
 * ```ts
 * import { Md, refineSafeDocument } from "@beep/md"
 * import { Result } from "effect"
 *
 * console.log(Result.isSuccess(refineSafeDocument(Md.make([Md.p("Hello")])))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./Md.safe.ts";
/**
 * Public Markdown builder namespace and constructor helpers.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { Result } from "effect"
 *
 * const markdown = Md.render(Md.make([Md.h1`Hello`]))
 * console.log(Result.getOrThrow(markdown)) // "# Hello"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./Md.ts";
