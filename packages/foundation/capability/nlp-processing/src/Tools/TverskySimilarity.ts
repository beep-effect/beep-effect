/**
 * TverskySimilarity tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { SimilarityMethod } from "@beep/nlp/Core/Similarity";
import { SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/TverskySimilarity");

class TverskySimilarityParameters extends S.Class<TverskySimilarityParameters>($I`TverskySimilarityParameters`)(
  {
    alpha: SchemaUtils.withKeyDefaults(UnitInterval, UnitInterval.make(0.5)).annotateKey({
      description: "Weight for terms present in text1 but absent in text2 (default: 0.5)",
    }),
    beta: SchemaUtils.withKeyDefaults(UnitInterval, UnitInterval.make(0.5)).annotateKey({
      description: "Weight for terms present in text2 but absent in text1 (default: 0.5)",
    }),
    text1: S.String.annotateKey({
      description: "First text to compare",
      examples: ["alpha beta gamma"],
    }),
    text2: S.String.annotateKey({
      description: "Second text to compare",
      examples: ["alpha beta"],
    }),
  },
  $I.annote("TverskySimilarityParameters", {
    description: "Inputs required to compute asymmetric set similarity between two texts.",
  })
) {}

class TverskySimilaritySuccess extends S.Class<TverskySimilaritySuccess>($I`TverskySimilaritySuccess`)(
  {
    alpha: UnitInterval.annotateKey({
      description: "Applied alpha parameter",
    }),
    beta: UnitInterval.annotateKey({
      description: "Applied beta parameter",
    }),
    method: S.Literal(SimilarityMethod.Enum["set.tversky"]).annotateKey({
      description: "The similarity method used",
    }),
    score: UnitInterval.annotateKey({
      description: "Similarity score from 0 (no overlap) to 1 (identical sets)",
    }),
  },
  $I.annote("TverskySimilaritySuccess", {
    description: "Asymmetric Tversky similarity score and applied parameter values.",
  })
) {}

/**
 * Defines the agent-facing tool contract for asymmetric Tversky similarity
 * over token sets.
 *
 * **Details**
 *
 * Use this tool when one text should be treated as the reference and omission
 * versus extra-token penalties need separate `alpha` and `beta` weights.
 *
 * **Example** (Decode Tversky parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TverskySimilarity } from "@beep/nlp-processing/Tools/TverskySimilarity"
 *
 * const parameters = S.decodeUnknownSync(TverskySimilarity.parametersSchema)({
 *   alpha: 0.7,
 *   beta: 0.3,
 *   text1: "refund policy shipping",
 *   text2: "refund policy"
 * })
 *
 * parameters.alpha
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const TverskySimilarity = Tool.make("TverskySimilarity", {
  description:
    "Compute asymmetric set similarity between two texts using the Tversky index. Useful for containment-style comparisons.",
  failure: AiToolError,
  failureMode: "return",
  parameters: TverskySimilarityParameters,
  success: S.toEncoded(TverskySimilaritySuccess),
});
