/**
 * RankByRelevance tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt, PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiRankedText, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/RankByRelevance");
const CandidateText = S.String.pipe(
  $I.annoteSchema("CandidateText", {
    description: "Candidate text to rank against a query.",
  })
);

class RankByRelevanceParameters extends S.Class<RankByRelevanceParameters>($I`RankByRelevanceParameters`)(
  {
    query: S.String.annotateKey({
      description: "Query to rank texts against",
      examples: ["cats and kittens"],
    }),
    texts: S.Array(CandidateText).annotateKey({
      description: "Candidate texts",
      examples: [["Cats are playful", "Quantum computing advances"]],
    }),
    topN: S.optionalKey(PosInt).annotateKey({
      description: "Maximum number of ranked results to return (default: all texts)",
      examples: [PosInt.make(3), PosInt.make(5), PosInt.make(10)],
    }),
  },
  $I.annote("RankByRelevanceParameters", {
    description: "Inputs required to rank multiple candidate texts against a query.",
  })
) {}

class RankByRelevanceSuccess extends S.Class<RankByRelevanceSuccess>($I`RankByRelevanceSuccess`)(
  {
    ranked: S.Array(AiRankedText),
    returned: NonNegativeInt,
    totalTexts: NonNegativeInt,
  },
  $I.annote("RankByRelevanceSuccess", {
    description: "Ranked relevance results and source-text count metadata.",
  })
) {}

/**
 * Defines the agent-facing tool contract for ranking candidate texts by
 * relevance to a query.
 *
 * Use this tool for one-shot retrieval over an in-memory candidate list when a
 * persistent corpus is unnecessary.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RankByRelevance } from "@beep/nlp-processing/Tools/RankByRelevance"
 *
 * const parameters = S.decodeUnknownSync(RankByRelevance.parametersSchema)({
 *   query: "refund policy",
 *   texts: ["Shipping rules", "Refund policy details"],
 *   topN: 1
 * })
 *
 * parameters.query
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RankByRelevance = Tool.make("RankByRelevance", {
  description: "Rank an array of texts by relevance to a query using vectorized similarity.",
  failure: AiToolError,
  failureMode: "return",
  parameters: RankByRelevanceParameters,
  success: S.toEncoded(RankByRelevanceSuccess),
});
