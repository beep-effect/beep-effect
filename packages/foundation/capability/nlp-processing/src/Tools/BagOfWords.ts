/**
 * BagOfWords tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiNGram, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/BagOfWords");

class BagOfWordsParameters extends S.Class<BagOfWordsParameters>($I`BagOfWordsParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text to compute a bag-of-words term-frequency table from",
      examples: ["the cat sat on the mat"],
    }),
  },
  $I.annote("BagOfWordsParameters", {
    description: "Text input used to compute a bag-of-words term-frequency table.",
  })
) {}

class BagOfWordsSuccess extends S.Class<BagOfWordsSuccess>($I`BagOfWordsSuccess`)(
  {
    terms: S.Array(AiNGram),
    totalTerms: S.Finite,
    uniqueTerms: S.Finite,
  },
  $I.annote("BagOfWordsSuccess", {
    description: "Bag-of-words term-frequency table with total and unique term counts.",
  })
) {}

/**
 * Defines the agent-facing tool contract for computing a bag-of-words
 * term-frequency table from text.
 *
 * Use this tool when a caller needs normalized term counts for matching,
 * feature generation, or lightweight relevance scoring.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BagOfWords } from "@beep/nlp-processing/Tools/BagOfWords"
 *
 * const parameters = S.decodeUnknownSync(BagOfWords.parametersSchema)({
 *   text: "the cat sat on the mat"
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const BagOfWords = annotateFourHints(
  Tool.make("BagOfWords", {
  description: "Compute a bag-of-words term-frequency table from text.",
  failure: AiToolError,
  failureMode: "return",
  parameters: BagOfWordsParameters,
  success: S.toEncoded(BagOfWordsSuccess),
  }),
  readOnlyToolHints
);
