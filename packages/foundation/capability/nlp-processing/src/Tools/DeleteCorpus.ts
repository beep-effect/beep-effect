/**
 * DeleteCorpus tool definition.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { annotateFourHints, FourHintAnnotations } from "@beep/mcp-kit";
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
 * Use this tool when a temporary corpus is no longer needed or a caller must
 * discard learned documents before recreating the corpus id.
 *
 * @example
 * ```ts
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
// Destructive: irreversibly discards the corpus session's learned state
// (packages/drivers/wink/src/WinkCorpus.service.ts:558-561,319-325). Idempotent:
// deleting an already-deleted or nonexistent corpus id is a no-op that
// converges to the same end state (`deleted: false`), never an error.
export const DeleteCorpus = annotateFourHints(
  Tool.make("DeleteCorpus", {
    description: "Delete a corpus session and release its in-memory index state.",
    failure: AiToolError,
    failureMode: "return",
    parameters: DeleteCorpusParameters,
    success: S.toEncoded(DeleteCorpusSuccess),
  }),
  FourHintAnnotations.make({ destructive: true, idempotent: true, openWorld: false, readOnly: false })
);
