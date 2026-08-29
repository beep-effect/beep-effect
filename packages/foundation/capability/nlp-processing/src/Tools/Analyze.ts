/**
 * Analyze tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiAnalysis, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/Analyze");

class AnalyzeParameters extends S.Class<AnalyzeParameters>($I`AnalyzeParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text to analyze",
      examples: ["The quick brown fox jumps over the lazy dog. It was fast."],
    }),
  },
  $I.annote("AnalyzeParameters", {
    description: "Text input used to run a composite linguistic analysis.",
  })
) {}

/**
 * Defines the agent-facing tool contract for running a composite linguistic
 * analysis over text.
 *
 * **Details**
 *
 * Use this tool when a caller needs counts, sentence texts, and annotated
 * tokens from a single pass instead of invoking tokenization, sentence, and
 * statistics tools separately.
 *
 * **Example** (Decode parameters schema)
 *
 * ```ts import.meta.vitest name="Decode parameters schema"
 * import * as S from "effect/Schema"
 * import { Analyze } from "@beep/nlp-processing/Tools/Analyze"
 *
 * const parameters = S.decodeUnknownSync(Analyze.parametersSchema)({
 *   text: "The quick brown fox. It was fast."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Analyze = Tool.make("Analyze", {
  description: "Run a composite linguistic analysis (counts, sentences, annotated tokens) over text.",
  failure: AiToolError,
  failureMode: "return",
  parameters: AnalyzeParameters,
  success: S.toEncoded(AiAnalysis),
});
