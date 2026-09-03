/**
 * Schema-first Pandoc JSON AST mirror and compatibility adapters.
 *
 * @packageDocumentation \@beep/pandoc-ast
 * @since 0.0.0
 */

/**
 * Pandoc JSON wire codecs.
 *
 * **Example** (Import decodePandocJsonString codec)
 *
 * ```ts
 * import { decodePandocJsonString } from "@beep/pandoc-ast"
 *
 * console.log(decodePandocJsonString)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export * from "./Pandoc.codec.ts";
/**
 * Exhaustive compatible, unsupported, or invalid Pandoc JSON classification.
 *
 * **Example** (Inspect an empty Pandoc document)
 *
 * ```ts import.meta.vitest name="Inspect an empty Pandoc document"
 * import { Effect } from "effect"
 * import { inspectPandocConformance } from "@beep/pandoc-ast"
 *
 * const result = Effect.runSync(inspectPandocConformance({
 *   "pandoc-api-version": [1, 23, 1],
 *   blocks: [],
 *   meta: {},
 * }))
 * result._tag // => "compatible"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export * from "./Pandoc.conformance.ts";
/**
 * Pandoc and Md compatibility mapping.
 *
 * **Example** (Import pandocToDocument mapper)
 *
 * ```ts
 * import { pandocToDocument } from "@beep/pandoc-ast"
 *
 * console.log(pandocToDocument)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export * from "./Pandoc.mapping.ts";
/**
 * Schema-first Pandoc AST models.
 *
 * **Example** (Make empty PandocDocument)
 *
 * ```ts
 * import { PandocDocument } from "@beep/pandoc-ast"
 *
 * console.log(PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} })._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Pandoc.model.ts";
/**
 * Pandoc compatibility report models.
 *
 * **Example** (Create empty compatibility report)
 *
 * ```ts
 * import { PandocCompatibilityReport } from "@beep/pandoc-ast"
 *
 * console.log(PandocCompatibilityReport.fromIssues([]).profile)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Pandoc.report.ts";
export { VERSION } from "./Version.ts";
