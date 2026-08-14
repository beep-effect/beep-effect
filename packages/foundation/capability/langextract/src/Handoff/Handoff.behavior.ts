/**
 * Adapter behavior from grounded extractions to `@beep/nlp/Handoff`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Contract } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import type { GroundedExtraction } from "@beep/langextract/Extraction";
import type { DocumentId } from "@beep/nlp/Core";
import type { AnnotatedDocumentInput } from "./Handoff.model.ts";

const definedExtractions = (
  extractions: ReadonlyArray<GroundedExtraction>
): ReadonlyArray<GroundedExtraction & { readonly span: Contract.Span }> =>
  A.filter(
    extractions,
    (extraction): extraction is GroundedExtraction & { readonly span: Contract.Span } => extraction.span !== undefined
  );

const makeEntity = (
  extraction: GroundedExtraction & { readonly span: Contract.Span },
  provenance: Contract.Provenance,
  mentionId: Contract.MentionId,
  index: number,
  documentId: DocumentId
): Contract.Entity =>
  Contract.Entity.make({
    canonicalName: extraction.text,
    id: Contract.EntityId.make(`${documentId}:entity:${index}`),
    mentions: [mentionId],
    provenance,
    type: extraction.label,
    ...O.getSomesStruct({ confidence: O.fromUndefinedOr(extraction.confidence) }),
  });

/**
 * Convert grounded extractions into the generic NLP handoff envelope.
 *
 * **Example** (Convert to annotated document)
 *
 * ```ts
 * import { toAnnotatedDocument } from "@beep/langextract/Handoff"
 * import { DocumentId } from "@beep/nlp/Core"
 *
 * const annotated = toAnnotatedDocument({
 *   documentId: DocumentId.make("doc-1"),
 *   extractions: [],
 *   generatedBy: "@beep/langextract",
 *   text: "Ada Lovelace wrote notes.",
 *   timestamp: 0
 * })
 * console.log(annotated.version)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export const toAnnotatedDocument = (input: AnnotatedDocumentInput): Contract.AnnotatedDocument => {
  const provenance = Contract.Provenance.make({
    generatedBy: input.generatedBy,
    source: input.documentId,
    timestamp: input.timestamp,
  });
  const chunkId = Contract.ChunkId.make(`${input.documentId}:chunk:0`);
  const aligned = definedExtractions(input.extractions);

  const chunks = [
    Contract.TextChunk.make({
      id: chunkId,
      kind: "document",
      provenance,
      span: Contract.Span.make({ end: NonNegativeInt.make(input.text.length), start: NonNegativeInt.make(0) }),
      text: input.text,
    }),
  ];

  const entities = A.map(aligned, (extraction, index) => {
    const mentionId = Contract.MentionId.make(`${input.documentId}:mention:${index}`);
    return makeEntity(extraction, provenance, mentionId, index, input.documentId);
  });

  return Contract.AnnotatedDocument.make({
    chunks,
    entities,
    provenance,
    relations: [],
    version: "nlp-ir/1.0",
  });
};
