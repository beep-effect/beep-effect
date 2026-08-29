/**
 * QueryCorpus tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit";
import { PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiCorpusRankedDocument, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/QueryCorpus");

class QueryCorpusParameters extends S.Class<QueryCorpusParameters>($I`QueryCorpusParameters`)(
  {
    corpusId: S.String.check(S.isMinLength(1)).annotateKey({
      description: "Corpus identifier returned by CreateCorpus",
    }),
    includeText: S.optionalKey(S.Boolean).annotateKey({
      description: "Include source document text for each ranked result",
    }),
    query: S.String.annotateKey({
      description: "Query text to rank corpus documents against",
    }),
    topN: S.optionalKey(PosInt).annotateKey({
      description: "Maximum ranked results to return (default: all documents)",
    }),
  },
  $I.annote("QueryCorpusParameters", {
    description: "Inputs required to query a previously learned corpus session.",
  })
) {}

class QueryCorpusSuccess extends S.Class<QueryCorpusSuccess>($I`QueryCorpusSuccess`)(
  {
    corpusId: S.String.annotateKey({
      description: "Corpus identifier used for the query.",
    }),
    method: S.Literal("vector.cosine").annotateKey({
      description: "Similarity method used to rank corpus documents.",
    }),
    query: S.String.annotateKey({
      description: "Original query text used for ranking.",
    }),
    ranked: S.Array(AiCorpusRankedDocument).annotateKey({
      description: "Ranked documents returned from the corpus query.",
    }),
    returned: S.Finite.annotateKey({
      description: "Number of ranked documents returned in this response.",
    }),
    totalDocuments: S.Finite.annotateKey({
      description: "Total number of learned documents available in the corpus.",
    }),
  },
  $I.annote("QueryCorpusSuccess", {
    description: "Ranked corpus query results and result-count metadata.",
  })
) {}

/**
 * Defines the agent-facing tool contract for querying a learned corpus session
 * without relearning its documents.
 *
 * Use this tool after `LearnCorpus` when the caller needs vector-ranked corpus
 * results, optionally including each matched document's source text.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { QueryCorpus } from "@beep/nlp-processing/Tools/QueryCorpus"
 *
 * const parameters = S.decodeUnknownSync(QueryCorpus.parametersSchema)({
 *   corpusId: "support-docs",
 *   includeText: true,
 *   query: "refund policy",
 *   topN: 5
 * })
 *
 * parameters.query
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const QueryCorpus = annotateFourHints(
  Tool.make("QueryCorpus", {
  description: "Query a learned corpus session and return vector-ranked results without relearning.",
  failure: AiToolError,
  failureMode: "return",
  parameters: QueryCorpusParameters,
  success: S.toEncoded(QueryCorpusSuccess),
  }),
  readOnlyToolHints
);
