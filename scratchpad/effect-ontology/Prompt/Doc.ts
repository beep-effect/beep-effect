/**
 * Internal plain-text document helpers shared by prompt renderers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";

/**
 * Plain-text document representation used while assembling prompts.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type PromptDoc = string;

/**
 * Minimal document combinators for joining and rendering prompt text.
 *
 * **Example** (Render two prompt lines)
 *
 * ```ts
 * import { Doc } from "@effect-ontology/Prompt/Doc"
 *
 * const prompt = Doc.vsep([Doc.text("Name: Ada"), Doc.text("Role: Mathematician")])
 * console.log(Doc.render(prompt))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const Doc = {
  empty: "",
  text: (value: string): PromptDoc => value,
  vsep: (documents: ReadonlyArray<PromptDoc>): PromptDoc => A.join(documents, "\n"),
  render: (document: PromptDoc, _options?: unknown): string => document,
};
