/**
 * Schema-first Pandoc JSON AST mirror and compatibility adapters.
 *
 * @packageDocumentation \@beep/pandoc-ast
 * @since 0.0.0
 */

/**
 * Package version.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/pandoc-ast"
 *
 * const packageVersion: "0.0.0" = VERSION
 * console.log(packageVersion) // "0.0.0"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0";

/**
 * Pandoc JSON wire codecs.
 *
 * @example
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
 * Pandoc and Md compatibility mapping.
 *
 * @example
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
 * @example
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
 * @example
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
