/**
 * Footnote value-object exports.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

/**
 * Footnote model exports.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { Footnote } from "@beep/law-practice-domain";
 *
 * const footnoteMap: Footnote.FootnoteMap =
 *   Footnote.detectTextFootnotes("Body\n----------\n1. See Smith v. Jones.");
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as Footnote from "./Footnote.model.ts";
