/**
 * Provenance URI generation utilities
 *
 * Generates deterministic URIs for RDF named graphs to track
 * the provenance of extracted triples back to their source documents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Schema } from "effect";
import * as P from "effect/Predicate";
import type { BatchId, DocumentId } from "../Domain/Identity.ts";
import { dual3 } from "./Dual.ts";

// =============================================================================
// Provenance URI Schema
// =============================================================================

/**
 * Provenance URI pattern for named graphs
 *
 * Format: `urn:provenance:batch/{batchId}/doc/{documentId}[/chunk/{chunkIndex}]`
 *
 * @since 0.0.0
 */
export const ProvenanceUri = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^urn:provenance:batch\/batch-[a-f0-9]{12}\/doc\/doc-[a-f0-9]{12}(\/chunk\/\d+)?$/)),
  Schema.brand("ProvenanceUri"),
  Schema.annotate({
    title: "Provenance URI",
    description: "URN identifying the provenance of RDF triples",
  })
);
export type ProvenanceUri = typeof ProvenanceUri.Type;

// =============================================================================
// URI Generation
// =============================================================================

/**
 * Generate a provenance URI for a document within a batch
 *
 * Creates a deterministic URI that can be used as a named graph
 * to track which document produced which triples.
 *
 * @param batchId - The batch identifier
 * @param documentId - The document identifier
 * @param chunkIndex - Optional chunk index for chunk-level provenance
 * @returns Provenance URI string
 *
 * **Example** (Use makeProvenanceUri)
 * ```ts
 * // Document-level provenance
 * makeProvenanceUri("batch-1234567890ab", "doc-abcdef123456", undefined)
 * // => "urn:provenance:batch/batch-1234567890ab/doc/doc-abcdef123456"
 *
 * // Chunk-level provenance
 * makeProvenanceUri("batch-1234567890ab", "doc-abcdef123456", 0)
 * // => "urn:provenance:batch/batch-1234567890ab/doc/doc-abcdef123456/chunk/0"
 * ```
 *
 * @since 0.0.0
 */
export const makeProvenanceUri = dual3(
  (batchId: BatchId, documentId: DocumentId, chunkIndex: number | undefined): ProvenanceUri => {
    const base = `urn:provenance:batch/${batchId}/doc/${documentId}`;
    const uri = chunkIndex !== undefined ? `${base}/chunk/${chunkIndex}` : base;
    return uri as ProvenanceUri;
  }
);

/**
 * Parse a provenance URI to extract its components
 *
 * @param uri - The provenance URI to parse
 * @returns Object containing batchId, documentId, and optional chunkIndex
 *
 * **Example** (Use parseProvenanceUri)
 * ```ts
 * parseProvenanceUri("urn:provenance:batch/batch-123/doc/doc-456/chunk/0")
 * // => { batchId: "batch-123", documentId: "doc-456", chunkIndex: 0 }
 * ```
 *
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
 * @param uri - The string to check
 * @returns true if the string is a valid provenance URI
 *
 * @since 0.0.0
 */
export const isProvenanceUri = (uri: string): uri is ProvenanceUri =>
  /^urn:provenance:batch\/batch-[a-f0-9]{12}\/doc\/doc-[a-f0-9]{12}(\/chunk\/\d+)?$/.test(uri);
