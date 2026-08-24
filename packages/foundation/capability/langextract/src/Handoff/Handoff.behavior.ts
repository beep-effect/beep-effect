/**
 * Adapter behavior from grounded extractions to `@beep/nlp/Handoff`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GroundedExtraction } from "@beep/langextract/Extraction";
import { Contract } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Str from "effect/String";
import type { DocumentId } from "@beep/nlp/Core";
import type { AnnotatedDocumentInput } from "./Handoff.model.ts";

type AlignedGroundedExtraction =
  | typeof GroundedExtraction.cases.match_exact.Type
  | typeof GroundedExtraction.cases.match_lesser.Type
  | typeof GroundedExtraction.cases.match_fuzzy.Type;

const alignedExtraction = GroundedExtraction.isAnyOf(["match_exact", "match_lesser", "match_fuzzy"]);

const makeAnnotation =
  (documentId: DocumentId, chunkId: Contract.ChunkId, provenance: Contract.Provenance) =>
  (extraction: AlignedGroundedExtraction, index: number): readonly [Contract.Mention, Contract.Entity] => {
    const mentionId = Contract.MentionId.make(`${documentId}:mention:${index}`);
    return [
      Contract.Mention.make({
        chunkId,
        id: mentionId,
        provenance,
        span: extraction.span,
        text: extraction.matchedText,
      }),
      Contract.Entity.make({
        canonicalName: extraction.text,
        id: Contract.EntityId.make(`${documentId}:entity:${index}`),
        mentions: A.of(mentionId),
        provenance,
        type: extraction.label,
        ...O.getSomesStruct({ confidence: extraction.confidence }),
      }),
    ];
  };

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
  const aligned = A.filter(input.extractions, alignedExtraction);
  const [mentions, entities] = A.unzip(A.map(aligned, makeAnnotation(input.documentId, chunkId, provenance)));

  const chunks = A.of(
    Contract.TextChunk.make({
      id: chunkId,
      kind: "document",
      provenance,
      span: Contract.Span.make({ end: NonNegativeInt.make(Str.length(input.text)), start: NonNegativeInt.make(0) }),
      text: input.text,
    })
  );

  return Contract.AnnotatedDocument.make({
    chunks,
    entities,
    mentions,
    provenance,
    relations: A.empty(),
    version: "nlp-ir/1.1",
  });
};
