/**
 * DeleteCorpus tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";
import { AiToolError } from "./_schemas.ts";

const $I = $NlpProcessingId.create("Tools/DeleteCorpus");

class DeleteCorpusParameters extends S.Class<DeleteCorpusParameters>($I`DeleteCorpusParameters`)(
  {
    corpusId: S.String.check(S.isMinLength(1)).annotateKey({
      description: "Corpus identifier returned by CreateCorpus",
    }),
  },
  $I.annote("DeleteCorpusParameters", {
    description: "Inputs required to delete a previously created corpus session.",
  })
) {}

class DeleteCorpusSuccess extends S.Class<DeleteCorpusSuccess>($I`DeleteCorpusSuccess`)(
  {
    corpusId: S.String,
    deleted: S.Boolean,
  },
  $I.annote("DeleteCorpusSuccess", {
    description: "Deletion outcome for a corpus session.",
  })
) {}

/**
 * Defines the agent-facing tool contract for deleting a managed corpus session
 * and releasing its in-memory index state.
 *
 * **Details**
 *
 * Use this tool when a temporary corpus is no longer needed or a caller must
 * discard learned documents before recreating the corpus id.
 *
 * **Example** (Decode DeleteCorpus parameters)
 *
 * ```ts import.meta.vitest name="Decode DeleteCorpus parameters"
 * import * as S from "effect/Schema"
 * import { DeleteCorpus } from "@beep/nlp-processing/Tools/DeleteCorpus"
 *
 * const parameters = S.decodeUnknownSync(DeleteCorpus.parametersSchema)({
 *   corpusId: "support-docs"
 * })
 *
 * parameters.corpusId
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const DeleteCorpus = Tool.make("DeleteCorpus", {
  description: "Delete a corpus session and release its in-memory index state.",
  failure: AiToolError,
  failureMode: "return",
  parameters: DeleteCorpusParameters,
  success: S.toEncoded(DeleteCorpusSuccess),
});
