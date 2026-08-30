/**
 * Provenance URI generation utilities
 *
 * **Details**
 *
 * Generates deterministic URIs for RDF named graphs to track
 * the provenance of extracted triples back to their source documents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { BatchId, DocumentId } from "../Domain/Identity.ts";
import { dual3 } from "./Dual.ts";

const $I = $ScratchpadId.create("effect-ontology/Utils/Provenance");

// =============================================================================
// Provenance URI Schema
// =============================================================================

/**
 * Named-graph URN that locates extracted triples back to a batch document,
 * optionally a chunk.
 *
 * **Details**
 *
 * Format: `urn:provenance:batch/{batchId}/doc/{documentId}[/chunk/{chunkIndex}]`
 * with canonical `batch-[a-f0-9]{12}` and `doc-[a-f0-9]{12}` identifiers.
 *
 * **Example** (Accept a canonical provenance URN)
 *
 * ```ts
 * import { ProvenanceUri } from "@effect-ontology/Utils/Provenance"
 * import * as S from "effect/Schema"
 *
 * const uri = "urn:provenance:batch/batch-1234567890ab/doc/doc-abcdef123456"
 * console.log(S.is(ProvenanceUri)(uri)) // true
 * console.log(S.is(ProvenanceUri)("urn:provenance:batch/batch-123/doc/doc-456")) // false
 * ```
 *
 * @see {@link makeProvenanceUri} for constructing a URI from branded identifiers.
 * @category schemas
 * @since 0.0.0
 */
export const ProvenanceUri = S.String.pipe(
  S.check(
    S.isPattern(/^urn:provenance:batch\/batch-[a-f0-9]{12}\/doc\/doc-[a-f0-9]{12}(\/chunk\/\d+)?$/, {
      message: "Expected a provenance URI containing canonical batch and document identifiers",
    })
  ),
  S.brand("ProvenanceUri"),
  $I.annoteSchema("ProvenanceUri", {
    description: "URN identifying the provenance of RDF triples from a batch document or chunk.",
  })
);

/**
 * Decoded provenance URN produced by {@link ProvenanceUri}.
 *
 * @see {@link ProvenanceUri} for the runtime schema and canonical identifier pattern.
 * @category type-level
 * @since 0.0.0
 */
export type ProvenanceUri = typeof ProvenanceUri.Type;

// =============================================================================
// URI Generation
// =============================================================================

/**
 * Generate a provenance URI for a document within a batch
 *
 * **Details**
 *
 * Creates a deterministic URI that can be used as a named graph
 * to track which document produced which triples.
 *
 * **Example** (Use makeProvenanceUri)
 *
 * ```ts
 * import { BatchId, DocumentId } from "@effect-ontology/Identity"
 * import { makeProvenanceUri } from "@effect-ontology/Utils/Provenance"
 *
 * // Document-level provenance
 * const batchId = BatchId.make("batch-1234567890ab")
 * const documentId = DocumentId.make("doc-abcdef123456")
 * console.log(makeProvenanceUri(batchId, documentId, undefined))
 * // "urn:provenance:batch/batch-1234567890ab/doc/doc-abcdef123456"
 *
 * // Chunk-level provenance
 * console.log(makeProvenanceUri(batchId, documentId, 0))
 * // "urn:provenance:batch/batch-1234567890ab/doc/doc-abcdef123456/chunk/0"
 * ```
 *
 * @see {@link parseProvenanceUri} for splitting a URI back into its components.
 * @category constructors
 * @since 0.0.0
 */
export const makeProvenanceUri = dual3(
  (batchId: BatchId, documentId: DocumentId, chunkIndex: number | undefined): ProvenanceUri => {
    const base = `urn:provenance:batch/${batchId}/doc/${documentId}`;
    const uri = chunkIndex !== undefined ? `${base}/chunk/${chunkIndex}` : base;
    return ProvenanceUri.make(uri);
  }
);

/**
 * Splits a provenance URI into canonical batch, document, and optional chunk
 * components.
 *
 * **Example** (Parse a canonical URI and reject a short id)
 *
 * ```ts
 * import { parseProvenanceUri } from "@effect-ontology/Utils/Provenance"
 *
 * console.log(
 *   parseProvenanceUri("urn:provenance:batch/batch-1234567890ab/doc/doc-abcdef123456/chunk/0")
 * )
 * // { batchId: "batch-1234567890ab", documentId: "doc-abcdef123456", chunkIndex: 0 }
 * console.log(parseProvenanceUri("urn:provenance:batch/batch-123/doc/doc-456/chunk/0")) // null
 * ```
 *
 * @returns Component object, or `null` when the URI is not a canonical provenance URN.
 * @see {@link makeProvenanceUri} for constructing the URI this parser accepts.
 * @see {@link isProvenanceUri} for the boolean guard over the same pattern.
 * @category parsing
 * @since 0.0.0
 */
export const parseProvenanceUri = (
  uri: string
): {
  batchId: string;
  documentId: string;
  chunkIndex?: number;
} | null => {
  const match = uri.match(/^urn:provenance:batch\/(batch-[a-f0-9]{12})\/doc\/(doc-[a-f0-9]{12})(?:\/chunk\/(\d+))?$/);
  if (P.isNull(match)) return null;

  return {
    batchId: match[1],
    documentId: match[2],
    ...(P.isUndefined(match[3]) ? {} : { chunkIndex: Number.parseInt(match[3], 10) }),
  };
};

/**
 * Returns whether a string matches the canonical provenance URN pattern.
 *
 * **Example** (Guard a provenance URI)
 *
 * ```ts
 * import { isProvenanceUri } from "@effect-ontology/Utils/Provenance"
 *
 * console.log(isProvenanceUri("urn:provenance:batch/batch-1234567890ab/doc/doc-abcdef123456")) // true
 * console.log(isProvenanceUri("urn:provenance:batch/batch-123/doc/doc-456")) // false
 * ```
 *
 * @see {@link ProvenanceUri} for the schema that encodes the same pattern.
 * @category predicates
 * @since 0.0.0
 */
export const isProvenanceUri = (uri: string): uri is ProvenanceUri =>
  /^urn:provenance:batch\/batch-[a-f0-9]{12}\/doc\/doc-[a-f0-9]{12}(\/chunk\/\d+)?$/.test(uri);
