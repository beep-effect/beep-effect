/**
 * LearnCorpus tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/LearnCorpus");

class LearnCorpusDocument extends S.Class<LearnCorpusDocument>($I`LearnCorpusDocument`)(
  {
    id: S.optionalKey(S.String.check(S.isMinLength(1))),
    text: S.String,
  },
  $I.annote("LearnCorpusDocument", {
    description: "One document to learn into a corpus session.",
  })
) {}

class LearnCorpusParameters extends S.Class<LearnCorpusParameters>($I`LearnCorpusParameters`)(
  {
    corpusId: S.String.check(S.isMinLength(1)).annotateKey({
      description: "Corpus identifier returned by CreateCorpus",
    }),
    dedupeById: S.optionalKey(S.Boolean).annotateKey({
      description: "If true, skip incoming documents whose ids already exist in the corpus.",
    }),
    documents: S.NonEmptyArray(LearnCorpusDocument).annotateKey({
      description: "Documents to learn into the corpus",
    }),
  },
  $I.annote("LearnCorpusParameters", {
    description: "Inputs required to incrementally learn documents into an existing corpus session.",
  })
) {}

class LearnCorpusSuccess extends S.Class<LearnCorpusSuccess>($I`LearnCorpusSuccess`)(
  {
    corpusId: S.String,
    learnedCount: NonNegativeInt,
    reindexRequired: S.Boolean,
    skippedCount: NonNegativeInt,
    totalDocuments: NonNegativeInt,
    vocabularySize: NonNegativeInt,
  },
  $I.annote("LearnCorpusSuccess", {
    description: "Learning result summary for an incremental corpus update.",
  })
) {}

/**
 * Defines the agent-facing tool contract for incrementally learning documents
 * into an existing corpus session.
 *
 * **Details**
 *
 * Use this tool after `CreateCorpus` to add searchable documents, optionally
 * skipping duplicate document ids during repeated ingestion.
 *
 * **Example** (Decode LearnCorpus parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LearnCorpus } from "@beep/nlp-processing/Tools/LearnCorpus"
 *
 * const parameters = S.decodeUnknownSync(LearnCorpus.parametersSchema)({
 *   corpusId: "support-docs",
 *   dedupeById: true,
 *   documents: [{ id: "refunds", text: "Refund policy details." }]
 * })
 *
 * parameters.documents[0]?.text
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const LearnCorpus = Tool.make("LearnCorpus", {
  description: "Learn one or more documents into an existing corpus session for incremental indexing.",
  failure: AiToolError,
  failureMode: "return",
  parameters: LearnCorpusParameters,
  success: S.toEncoded(LearnCorpusSuccess),
});
