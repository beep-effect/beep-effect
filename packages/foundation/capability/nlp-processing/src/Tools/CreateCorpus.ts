/**
 * CreateCorpus tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { BM25Norm, PositiveNumber } from "@beep/nlp/Core/Vectorization";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiCorpusSummary, AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/CreateCorpus");

class CreateCorpusBM25Config extends S.Class<CreateCorpusBM25Config>($I`CreateCorpusBM25Config`)(
  {
    b: S.optionalKey(UnitInterval).annotateKey({
      description: "Document length normalization parameter in the inclusive range [0, 1].",
    }),
    k: S.optionalKey(PositiveNumber).annotateKey({
      description: "Inverse-document-frequency saturation parameter. Must be greater than 0.",
    }),
    k1: S.optionalKey(PositiveNumber).annotateKey({
      description: "Term-frequency saturation parameter. Must be greater than 0.",
    }),
    norm: S.optionalKey(BM25Norm).annotateKey({
      description: "Optional vector normalization mode override.",
    }),
  },
  $I.annote("CreateCorpusBM25Config", {
    description: "Optional BM25 overrides for a new corpus session.",
  })
) {}

class CreateCorpusParameters extends S.Class<CreateCorpusParameters>($I`CreateCorpusParameters`)(
  {
    bm25Config: S.optionalKey(CreateCorpusBM25Config).annotateKey({
      description: "Optional BM25 overrides. Omitted fields use defaults.",
    }),
    corpusId: S.optionalKey(S.String.check(S.isMinLength(1))).annotateKey({
      description: "Optional stable corpus identifier. If omitted, a generated id is returned.",
    }),
  },
  $I.annote("CreateCorpusParameters", {
    description: "Inputs required to create a new stateful BM25-style corpus session.",
  })
) {}

/**
 * Defines the agent-facing tool contract for creating a stateful BM25-style
 * corpus session.
 *
 * **Details**
 *
 * Use this tool before `LearnCorpus`, `QueryCorpus`, or `CorpusStats` when the
 * caller needs a reusable in-memory corpus with optional BM25 parameter
 * overrides.
 *
 * **Example** (Decode CreateCorpus parameters)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CreateCorpus } from "@beep/nlp-processing/Tools/CreateCorpus"
 *
 * const parameters = S.decodeUnknownSync(CreateCorpus.parametersSchema)({
 *   bm25Config: { b: 0.75, k: 1, k1: 1.2 },
 *   corpusId: "support-docs"
 * })
 *
 * parameters.corpusId
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const CreateCorpus = Tool.make("CreateCorpus", {
  description: "Create a stateful BM25-style corpus session that can be learned incrementally across tool calls.",
  failure: AiToolError,
  failureMode: "return",
  parameters: CreateCorpusParameters,
  success: S.toEncoded(AiCorpusSummary),
});
