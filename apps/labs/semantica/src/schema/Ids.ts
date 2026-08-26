import { $SemanticaId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SemanticaId.create("schema/Ids");

/**
 * Full SHA-256 identity of one source document's exact bytes.
 *
 * **Example** (Recognize a document id)
 *
 * ```ts
 * import { isDocumentId } from "@/schema/Ids"
 *
 * console.log(isDocumentId("0".repeat(64))) // true
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const DocumentId = Sha256Hex.pipe(
  S.brand("DocumentId"),
  $I.annoteSchema("DocumentId", {
    description: "Full SHA-256 identity of one source document's exact bytes.",
  })
);

/**
 * Decoded value accepted by {@link DocumentId}.
 *
 * **Example** (Annotate a document id)
 *
 * ```ts
 * import { DocumentId } from "@/schema/Ids"
 * import type { DocumentId as DocumentIdValue } from "@/schema/Ids"
 *
 * const id: DocumentIdValue = DocumentId.make("0".repeat(64))
 * console.log(id.length) // 64
 * ```
 *
 * @see {@link DocumentId} for validation and branding.
 * @category type-level
 * @since 0.0.0
 */
export type DocumentId = typeof DocumentId.Type;

/**
 * Schema-derived guard for full document ids.
 *
 * **Example** (Reject a truncated id)
 *
 * ```ts
 * import { isDocumentId } from "@/schema/Ids"
 *
 * console.log(isDocumentId("0".repeat(12))) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isDocumentId = S.is(DocumentId);

/**
 * Full SHA-256 identity of one document-scoped canonical-text chunk.
 *
 * **Example** (Construct a chunk id)
 *
 * ```ts
 * import { ChunkId } from "@/schema/Ids"
 *
 * console.log(ChunkId.make("1".repeat(64)).length) // 64
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ChunkId = Sha256Hex.pipe(
  S.brand("ChunkId"),
  $I.annoteSchema("ChunkId", {
    description: "Full SHA-256 identity of one document-scoped canonical-text chunk.",
  })
);

/**
 * Decoded value accepted by {@link ChunkId}.
 *
 * **Example** (Annotate a chunk id)
 *
 * ```ts
 * import { ChunkId } from "@/schema/Ids"
 * import type { ChunkId as ChunkIdValue } from "@/schema/Ids"
 *
 * const id: ChunkIdValue = ChunkId.make("1".repeat(64))
 * console.log(id.length) // 64
 * ```
 *
 * @see {@link ChunkId} for validation and branding.
 * @category type-level
 * @since 0.0.0
 */
export type ChunkId = typeof ChunkId.Type;

/**
 * Schema-derived guard for full chunk ids.
 *
 * **Example** (Recognize a chunk id)
 *
 * ```ts
 * import { isChunkId } from "@/schema/Ids"
 *
 * console.log(isChunkId("1".repeat(64))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isChunkId = S.is(ChunkId);

/**
 * Full SHA-256 identity of one grounded evidence claim.
 *
 * **Example** (Construct a claim id)
 *
 * ```ts
 * import { ClaimId } from "@/schema/Ids"
 *
 * console.log(ClaimId.make("2".repeat(64)).length) // 64
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ClaimId = Sha256Hex.pipe(
  S.brand("ClaimId"),
  $I.annoteSchema("ClaimId", {
    description: "Full SHA-256 identity of one grounded evidence claim.",
  })
);

/**
 * Decoded value accepted by {@link ClaimId}.
 *
 * **Example** (Annotate a claim id)
 *
 * ```ts
 * import { ClaimId } from "@/schema/Ids"
 * import type { ClaimId as ClaimIdValue } from "@/schema/Ids"
 *
 * const id: ClaimIdValue = ClaimId.make("2".repeat(64))
 * console.log(id.length) // 64
 * ```
 *
 * @see {@link ClaimId} for validation and branding.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimId = typeof ClaimId.Type;

/**
 * Schema-derived guard for full claim ids.
 *
 * **Example** (Recognize a claim id)
 *
 * ```ts
 * import { isClaimId } from "@/schema/Ids"
 *
 * console.log(isClaimId("2".repeat(64))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isClaimId = S.is(ClaimId);

/**
 * Full SHA-256 identity of one extraction batch.
 *
 * **Example** (Construct a batch id)
 *
 * ```ts
 * import { BatchId } from "@/schema/Ids"
 *
 * console.log(BatchId.make("3".repeat(64)).length) // 64
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const BatchId = Sha256Hex.pipe(
  S.brand("BatchId"),
  $I.annoteSchema("BatchId", {
    description: "Full SHA-256 identity of one extraction batch.",
  })
);

/**
 * Decoded value accepted by {@link BatchId}.
 *
 * **Example** (Annotate a batch id)
 *
 * ```ts
 * import { BatchId } from "@/schema/Ids"
 * import type { BatchId as BatchIdValue } from "@/schema/Ids"
 *
 * const id: BatchIdValue = BatchId.make("3".repeat(64))
 * console.log(id.length) // 64
 * ```
 *
 * @see {@link BatchId} for validation and branding.
 * @category type-level
 * @since 0.0.0
 */
export type BatchId = typeof BatchId.Type;

/**
 * Schema-derived guard for full batch ids.
 *
 * **Example** (Recognize a batch id)
 *
 * ```ts
 * import { isBatchId } from "@/schema/Ids"
 *
 * console.log(isBatchId("3".repeat(64))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isBatchId = S.is(BatchId);

/**
 * Full SHA-256 identity of one append-only provenance event.
 *
 * **Example** (Construct a provenance event id)
 *
 * ```ts
 * import { ProvenanceEventId } from "@/schema/Ids"
 *
 * console.log(ProvenanceEventId.make("4".repeat(64)).length) // 64
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ProvenanceEventId = Sha256Hex.pipe(
  S.brand("ProvenanceEventId"),
  $I.annoteSchema("ProvenanceEventId", {
    description: "Full SHA-256 identity of one append-only provenance event.",
  })
);

/**
 * Decoded value accepted by {@link ProvenanceEventId}.
 *
 * **Example** (Annotate an event id)
 *
 * ```ts
 * import { ProvenanceEventId } from "@/schema/Ids"
 * import type { ProvenanceEventId as EventId } from "@/schema/Ids"
 *
 * const id: EventId = ProvenanceEventId.make("4".repeat(64))
 * console.log(id.length) // 64
 * ```
 *
 * @see {@link ProvenanceEventId} for validation and branding.
 * @category type-level
 * @since 0.0.0
 */
export type ProvenanceEventId = typeof ProvenanceEventId.Type;

/**
 * Schema-derived guard for full provenance event ids.
 *
 * **Example** (Recognize a provenance event id)
 *
 * ```ts
 * import { isProvenanceEventId } from "@/schema/Ids"
 *
 * console.log(isProvenanceEventId("4".repeat(64))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isProvenanceEventId = S.is(ProvenanceEventId);

/**
 * Full SHA-256 identity of one replay-stable evaluation run.
 *
 * **Example** (Construct a run id)
 *
 * ```ts
 * import { RunId } from "@/schema/Ids"
 *
 * console.log(RunId.make("5".repeat(64)).length) // 64
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const RunId = Sha256Hex.pipe(
  S.brand("RunId"),
  $I.annoteSchema("RunId", {
    description: "Full SHA-256 identity of one replay-stable evaluation run.",
  })
);

/**
 * Decoded value accepted by {@link RunId}.
 *
 * **Example** (Annotate a run id)
 *
 * ```ts
 * import { RunId } from "@/schema/Ids"
 * import type { RunId as RunIdValue } from "@/schema/Ids"
 *
 * const id: RunIdValue = RunId.make("5".repeat(64))
 * console.log(id.length) // 64
 * ```
 *
 * @see {@link RunId} for validation and branding.
 * @category type-level
 * @since 0.0.0
 */
export type RunId = typeof RunId.Type;

/**
 * Schema-derived guard for full run ids.
 *
 * **Example** (Recognize a run id)
 *
 * ```ts
 * import { isRunId } from "@/schema/Ids"
 *
 * console.log(isRunId("5".repeat(64))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isRunId = S.is(RunId);
