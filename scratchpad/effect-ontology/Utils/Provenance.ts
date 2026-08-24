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

import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { BatchId, DocumentId } from "../Domain/Identity.ts";
import { dual3 } from "./Dual.ts";

// =============================================================================
// Provenance URI Schema
// =============================================================================

/**
 * Provenance URI pattern for named graphs
 *
 * **Details**
 *
 * Format: `urn:provenance:batch/{batchId}/doc/{documentId}[/chunk/{chunkIndex}]`
 *
 * **Example** (Validate provenance uri)
 *
 * ```ts
 * import { ProvenanceUri } from "@effect-ontology/Utils/Provenance"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProvenanceUri)({}))
 * ```
 *
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
  S.annotate({
    title: "Provenance URI",
    description: "URN identifying the provenance of RDF triples",
  })
);
/**
 * Describes the provenance uri data exposed by this module.
 *
 * **Example** (Decode ProvenanceUri)
 *
 * ```ts
 * import { ProvenanceUri } from "@effect-ontology/Utils/Provenance"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeProvenanceUri = (_value: ProvenanceUri): string => "valid provenance uri"
 *
 * console.log(O.map(S.decodeUnknownOption(ProvenanceUri)({}), summarizeProvenanceUri))
 * ```
 *
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
 * @param batchId - The batch identifier
 * @param documentId - The document identifier
 * @param chunkIndex - Optional chunk index for chunk-level provenance
 * @returns Provenance URI string
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
 * Parse a provenance URI to extract its components
 *
 * **Example** (Use parseProvenanceUri)
 *
 * ```ts
 * import { parseProvenanceUri } from "@effect-ontology/Utils/Provenance"
 *
 * parseProvenanceUri("urn:provenance:batch/batch-123/doc/doc-456/chunk/0")
 * // => { batchId: "batch-123", documentId: "doc-456", chunkIndex: 0 }
 * ```
 *
 * @param uri - The provenance URI to parse
 * @returns Object containing batchId, documentId, and optional chunkIndex
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
 * Check if a string is a valid provenance URI
 *
 * **Example** (Inspect is provenance uri)
 *
 * ```ts
 * import { isProvenanceUri } from "@effect-ontology/Utils/Provenance"
 *
 * console.log(isProvenanceUri)
 * ```
 *
 * @param uri - The string to check
 * @returns true if the string is a valid provenance URI
 * @category predicates
 * @since 0.0.0
 */
export const isProvenanceUri = (uri: string): uri is ProvenanceUri =>
  /^urn:provenance:batch\/batch-[a-f0-9]{12}\/doc\/doc-[a-f0-9]{12}(\/chunk\/\d+)?$/.test(uri);
