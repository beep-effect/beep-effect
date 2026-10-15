/**
 * LearnCorpus tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import * as Tool from "effect/ai/Tool";
import * as S from "effect/Schema";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/LearnCorpus");

class LearnCorpusDocument extends S.Opaque<LearnCorpusDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.optionalKey(S.String.check(S.isMinLength(1))),
    text: S.String,
  }).pipe(
    $I.annoteSchema("LearnCorpusDocument", {
      description: "One document to learn into a corpus session.",
    })
  )
) {}

class LearnCorpusParameters extends S.Opaque<LearnCorpusParameters, { readonly brand: unique symbol }>()(
  S.Struct({
    corpusId: S.String.check(S.isMinLength(1)).annotateKey({
      description: "Corpus identifier returned by CreateCorpus",
    }),
    dedupeById: S.optionalKey(S.Boolean).annotateKey({
      description: "If true, skip incoming documents whose ids already exist in the corpus.",
    }),
    documents: S.NonEmptyArray(LearnCorpusDocument).annotateKey({
      description: "Documents to learn into the corpus",
    }),
  }).pipe(
    $I.annoteSchema("LearnCorpusParameters", {
      description: "Inputs required to incrementally learn documents into an existing corpus session.",
    })
  )
) {}

class LearnCorpusSuccess extends S.Opaque<LearnCorpusSuccess, { readonly brand: unique symbol }>()(
  S.Struct({
    corpusId: S.String,
    learnedCount: S.Natural,
    reindexRequired: S.Boolean,
    skippedCount: S.Natural,
    totalDocuments: S.Natural,
    vocabularySize: S.Natural,
  }).pipe(
    $I.annoteSchema("LearnCorpusSuccess", {
      description: "Learning result summary for an incremental corpus update.",
    })
  )
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
 * ```ts import.meta.vitest name="Decode LearnCorpus parameters"
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
