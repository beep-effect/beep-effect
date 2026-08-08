/**
 * NGrams tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiNGram, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/NGrams");
const NGramModeKit = LiteralKit(["bag", "edge", "set"]).annotate(
  $I.annote("NGramModeKit", {
    description: "LiteralKit backing schema for character n-gram generation modes.",
  })
);
const NGramMode = NGramModeKit.pipe(
  $I.annoteSchema("NGramMode", {
    description: "Character n-gram generation mode.",
  }),
  SchemaUtils.withLiteralKitStatics(NGramModeKit)
);

class NGramsParameters extends S.Class<NGramsParameters>($I`NGramsParameters`)(
  {
    mode: S.optionalKey(NGramMode).annotateKey({
      description: "Generation mode: bag counts all n-grams, edge uses edge n-grams, set keeps unique n-grams.",
    }),
    size: PosInt.annotateKey({
      description: "N-gram size such as 2 for bigrams or 3 for trigrams",
      examples: [PosInt.make(3)],
    }),
    text: S.String.annotateKey({
      description: "Input text used to generate n-grams",
      examples: ["internationalization"],
    }),
    topN: S.optionalKey(PosInt).annotateKey({
      description: "Maximum n-gram entries to return after sorting by count descending then value ascending.",
    }),
  },
  $I.annote("NGramsParameters", {
    description: "Inputs required to extract deterministic character n-grams from text.",
  })
) {}

class NGramsSuccess extends S.Class<NGramsSuccess>($I`NGramsSuccess`)(
  {
    mode: NGramMode,
    ngrams: S.Array(AiNGram),
    size: PosInt,
    totalNGrams: NonNegativeInt,
    uniqueNGrams: NonNegativeInt,
  },
  $I.annote("NGramsSuccess", {
    description: "Extracted n-gram entries and summary counts for the selected mode.",
  })
) {}

/**
 * Defines the agent-facing tool contract for extracting fixed-size character
 * n-grams from text.
 *
 * **Details**
 *
 * Use this tool when a workflow needs repeatable shingles, top-frequency
 * n-grams, or bag-style n-gram features for downstream matching.
 *
 * **Example** (Decode bag n-gram parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NGrams } from "@beep/nlp-processing/Tools/NGrams"
 *
 * const parameters = S.decodeUnknownSync(NGrams.parametersSchema)({
 *   mode: "bag",
 *   size: 3,
 *   text: "natural language processing",
 *   topN: 5
 * })
 *
 * parameters.size
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const NGrams = Tool.make("NGrams", {
  description: "Extract character n-grams from text using bag, edge, or set mode with deterministic ranking.",
  failure: AiToolError,
  failureMode: "return",
  parameters: NGramsParameters,
  success: S.toEncoded(NGramsSuccess),
});
