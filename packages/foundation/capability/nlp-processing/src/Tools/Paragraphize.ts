/**
 * Paragraphize tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/Paragraphize");

class ParagraphizeParameters extends S.Class<ParagraphizeParameters>($I`ParagraphizeParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text to split into paragraphs",
      examples: ["First paragraph.\n\nSecond paragraph."],
    }),
  },
  $I.annote("ParagraphizeParameters", {
    description: "Text input used to split content into paragraph segments.",
  })
) {}

class ParagraphizeSuccess extends S.Class<ParagraphizeSuccess>($I`ParagraphizeSuccess`)(
  {
    count: NonNegativeInt,
    paragraphs: S.Array(S.String),
  },
  $I.annote("ParagraphizeSuccess", {
    description: "Split text into paragraphs on blank-line boundaries.",
  })
) {}

/**
 * Defines the agent-facing tool contract for splitting text into paragraphs on
 * blank-line boundaries.
 *
 * Use this tool before chunking or summarization workflows that need
 * paragraph-level segments rather than raw sentences or tokens.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Paragraphize } from "@beep/nlp-processing/Tools/Paragraphize"
 *
 * const parameters = S.decodeUnknownSync(Paragraphize.parametersSchema)({
 *   text: "First paragraph.\n\nSecond paragraph."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Paragraphize = Tool.make("Paragraphize", {
  description: "Split text into paragraphs on blank-line boundaries.",
  failure: AiToolError,
  failureMode: "return",
  parameters: ParagraphizeParameters,
  success: S.toEncoded(ParagraphizeSuccess),
});
