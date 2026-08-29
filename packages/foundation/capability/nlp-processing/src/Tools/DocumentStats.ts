/**
 * DocumentStats tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiDocumentStats, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/DocumentStats");

class DocumentStatsParameters extends S.Class<DocumentStatsParameters>($I`DocumentStatsParameters`)(
  {
    text: S.String.annotateKey({
      description: "The text to analyze",
      examples: ["Hello world. This is a short example document."],
    }),
  },
  $I.annote("DocumentStatsParameters", {
    description: "Text input used to compute high-level document statistics.",
  })
) {}

/**
 * Defines the agent-facing tool contract for computing document-level text
 * statistics.
 *
 * Use this tool when a caller needs quick counts for characters, words,
 * sentences, or average sentence length before deciding how to chunk or route
 * a document.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DocumentStats } from "@beep/nlp-processing/Tools/DocumentStats"
 *
 * const parameters = S.decodeUnknownSync(DocumentStats.parametersSchema)({
 *   text: "One short sentence. Another follows."
 * })
 *
 * parameters.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const DocumentStats = annotateFourHints(
  Tool.make("DocumentStats", {
  description:
    "Compute fast document statistics including word count, sentence count, average sentence length, and character count.",
  failure: AiToolError,
  failureMode: "return",
  parameters: DocumentStatsParameters,
  success: S.toEncoded(AiDocumentStats),
  }),
  readOnlyToolHints
);
