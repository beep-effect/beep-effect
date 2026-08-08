/**
 * ExtractKeywords tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiKeyword, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/ExtractKeywords");

class ExtractKeywordsParameters extends S.Class<ExtractKeywordsParameters>($I`ExtractKeywordsParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text to extract keywords from",
      examples: ["Machine learning algorithms process data efficiently."],
    }),
    topN: S.optionalKey(PosInt).annotateKey({
      default: PosInt.make(10),
      description: "Maximum number of keywords to return (default: 10)",
      examples: [PosInt.make(5), PosInt.make(10), PosInt.make(20)],
    }),
  },
  $I.annote("ExtractKeywordsParameters", {
    description: "Inputs required to extract ranked keywords from a text document.",
  })
) {}

class ExtractKeywordsSuccess extends S.Class<ExtractKeywordsSuccess>($I`ExtractKeywordsSuccess`)(
  {
    keywords: S.Array(AiKeyword),
  },
  $I.annote("ExtractKeywordsSuccess", {
    description: "Ranked keyword entries extracted from the input text.",
  })
) {}

/**
 * Defines the agent-facing tool contract for extracting ranked keyword terms
 * from a text.
 *
 * **Details**
 *
 * Use this tool when a caller needs compact topical terms for tagging,
 * routing, search facets, or retrieval hints.
 *
 * **Example** (Decode parameters schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExtractKeywords } from "@beep/nlp-processing/Tools/ExtractKeywords"
 *
 * const parameters = S.decodeUnknownSync(ExtractKeywords.parametersSchema)({
 *   text: "Effect provides typed errors and structured concurrency.",
 *   topN: 3
 * })
 *
 * parameters.topN
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ExtractKeywords = Tool.make("ExtractKeywords", {
  description: "Extract keywords from text ranked by TF-IDF-style importance.",
  failure: AiToolError,
  failureMode: "return",
  parameters: ExtractKeywordsParameters,
  success: S.toEncoded(ExtractKeywordsSuccess),
});
