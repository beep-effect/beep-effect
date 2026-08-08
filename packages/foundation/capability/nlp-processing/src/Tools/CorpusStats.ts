/**
 * CorpusStats tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiCorpusStats, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/CorpusStats");

class CorpusStatsParameters extends S.Class<CorpusStatsParameters>($I`CorpusStatsParameters`)(
  {
    corpusId: S.String.check(S.isMinLength(1)).annotateKey({
      description: "Corpus identifier returned by CreateCorpus",
    }),
    includeIdf: S.optionalKey(S.Boolean).annotateKey({
      description: "Include sorted IDF values in the output",
    }),
    includeMatrix: S.optionalKey(S.Boolean).annotateKey({
      description: "Include the document-term matrix in the output",
    }),
    topIdfTerms: S.optionalKey(PosInt).annotateKey({
      description: "When includeIdf=true, maximum number of top-IDF terms to return",
    }),
  },
  $I.annote("CorpusStatsParameters", {
    description: "Inputs used to inspect corpus internals and optional matrix details.",
  })
) {}

/**
 * Defines the agent-facing tool contract for inspecting a learned corpus'
 * vocabulary and vector statistics.
 *
 * **Details**
 *
 * Use this tool for diagnostics, explainability, or retrieval tuning when a
 * caller needs IDF values, vocabulary size, and optional matrix details.
 *
 * **Example** (Decode parameters schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CorpusStats } from "@beep/nlp-processing/Tools/CorpusStats"
 *
 * const parameters = S.decodeUnknownSync(CorpusStats.parametersSchema)({
 *   corpusId: "support-docs",
 *   includeIdf: true,
 *   includeMatrix: false,
 *   topIdfTerms: 20
 * })
 *
 * parameters.includeIdf
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const CorpusStats = Tool.make("CorpusStats", {
  description: "Inspect corpus internals such as vocabulary, IDF values, and optional document-term matrix.",
  failure: AiToolError,
  failureMode: "return",
  parameters: CorpusStatsParameters,
  success: S.toEncoded(AiCorpusStats),
});
