/**
 * Input model for the NLP handoff adapter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { GroundedExtraction } from "@beep/langextract/Extraction";
import { DocumentId } from "@beep/nlp/Core";
import * as S from "effect/Schema";

const $I = $LangExtractId.create("Handoff");

const GroundedExtractions: S.Codec<
  ReadonlyArray<GroundedExtraction>,
  ReadonlyArray<GroundedExtraction.Encoded>
> = S.Array(GroundedExtraction);

/**
 * **Example** (Build handoff document input)
 *
 * ```ts
 * import { AnnotatedDocumentInput } from "@beep/langextract/Handoff"
 * import { DocumentId } from "@beep/nlp/Core"
 *
 * const input = AnnotatedDocumentInput.make({
 *   documentId: DocumentId.make("doc-1"),
 *   extractions: [],
 *   generatedBy: "@beep/langextract",
 *   text: "Ada Lovelace wrote notes.",
 *   timestamp: 0
 * })
 * console.log(input.documentId)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export class AnnotatedDocumentInput extends S.Opaque<AnnotatedDocumentInput, { readonly brand: unique symbol }>()(
  S.Struct({
    documentId: DocumentId,
    extractions: GroundedExtractions,
    generatedBy: S.String,
    text: S.String,
    timestamp: S.Finite,
  }).pipe(
    $I.annoteSchema("AnnotatedDocumentInput", {
      description: "Input required to convert LangExtract extractions into the NLP handoff envelope.",
    })
  )
) {}
