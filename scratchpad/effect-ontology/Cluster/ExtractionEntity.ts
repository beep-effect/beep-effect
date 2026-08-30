/**
 * Extraction Entity Definition
 *
 * **Details**
 *
 * Defines the Cluster Entity for knowledge graph extraction with:
 * - Streaming progress events
 * - Idempotency key routing
 * - Cached result retrieval
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { NonNegNum } from "@beep/schema/Number";
import { Percentage } from "@beep/schema/Percentage";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { Entity } from "effect/unstable/cluster";
import * as Rpc from "effect/unstable/rpc/Rpc";
import { ProgressEvent } from "../Contract/ProgressStreaming.ts";
import { ExtractionError } from "../Domain/Error/Extraction.ts";
import { Entity as DomainEntity, Relation } from "../Domain/Model/Entity.ts";

const $I = $ScratchpadId.create("effect-ontology/Cluster/ExtractionEntity");

// IdempotencyKey utilities used by entity handlers
export { computeIdempotencyKey, type ExtractionParams } from "../Utils/IdempotencyKey.ts";

// =============================================================================
// RPC Schemas
// =============================================================================

/**
 * Payload accepted by {@link ExtractFromTextRpc} for a streaming extraction run.
 *
 * **Example** (Decode a text extraction payload)
 *
 * ```ts
 * import { ExtractFromTextPayload } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ExtractFromTextPayload)({
 *   text: "Ada Lovelace wrote the first computer program.",
 *   ontologyId: "foaf",
 *   ontologyVersion: "e3b0c44298fc"
 * })
 * console.log(O.map(decoded, (payload) => payload.ontologyId))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractFromTextPayload = S.Struct({
  /** Source text to extract from */
  text: S.String,
  /** Ontology identifier (e.g., "foaf", "schema.org") */
  ontologyId: S.String,
  /** Ontology content hash for versioning */
  ontologyVersion: S.String,
  /** Optional extraction parameters */
  params: S.Struct({
    maxTokens: PosInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    temperature: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    includeConfidence: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    groundingThreshold: UnitInterval.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  }).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}).pipe(
  $I.annoteSchema("ExtractFromTextPayload", {
    description: "Source text, ontology identity, and optional LLM parameters for a streaming extraction RPC.",
  })
);

/**
 * Decoded extraction request accepted by {@link ExtractFromTextPayload}.
 *
 * @see {@link ExtractFromTextPayload} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractFromTextPayload = typeof ExtractFromTextPayload.Type;

/**
 * Counts and duration recorded when a streaming extraction run completes.
 *
 * **Example** (Decode a completed extraction summary)
 *
 * ```ts
 * import { ExtractionSummary } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ExtractionSummary)({
 *   entityCount: 2,
 *   relationCount: 1,
 *   durationMs: 150,
 *   idempotencyKey: "extract-ada"
 * })
 * console.log(O.map(decoded, (summary) => summary.entityCount))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionSummary = S.Struct({
  entityCount: NonNegativeInt,
  relationCount: NonNegativeInt,
  durationMs: NonNegNum,
  idempotencyKey: S.String,
}).pipe(
  $I.annoteSchema("ExtractionSummary", {
    description: "Entity and relation counts, elapsed milliseconds, and idempotency key for a finished extraction.",
  })
);

/**
 * Decoded completion summary produced by {@link ExtractionSummary}.
 *
 * @see {@link ExtractionSummary} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionSummary = typeof ExtractionSummary.Type;

/**
 * Lookup key accepted by {@link GetCachedResultRpc}.
 *
 * **Example** (Decode a cache lookup payload)
 *
 * ```ts
 * import { GetCachedResultPayload } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(GetCachedResultPayload)({
 *   idempotencyKey: "extract-ada"
 * })
 * console.log(O.map(decoded, (payload) => payload.idempotencyKey))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GetCachedResultPayload = S.Struct({
  idempotencyKey: S.String,
}).pipe(
  $I.annoteSchema("GetCachedResultPayload", {
    description: "Idempotency key used to look up a previously completed extraction result.",
  })
);

/**
 * Decoded cache lookup payload produced by {@link GetCachedResultPayload}.
 *
 * @see {@link GetCachedResultPayload} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type GetCachedResultPayload = typeof GetCachedResultPayload.Type;

/**
 * Cached knowledge-graph payload returned by {@link GetCachedResultRpc} on a hit.
 *
 * **Example** (Decode an empty cached graph)
 *
 * ```ts
 * import { KnowledgeGraphResult } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(KnowledgeGraphResult)({
 *   entities: [],
 *   relations: [],
 *   metadata: {
 *     idempotencyKey: "extract-ada",
 *     ontologyId: "foaf",
 *     ontologyVersion: "e3b0c44298fc",
 *     extractedAt: "2026-08-26T00:00:00.000Z",
 *     durationMs: 150
 *   }
 * })
 * console.log(O.map(decoded, (result) => result.metadata.ontologyId))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KnowledgeGraphResult = S.Struct({
  entities: S.Array(DomainEntity),
  relations: S.Array(Relation),
  metadata: S.Struct({
    idempotencyKey: S.String,
    ontologyId: S.String,
    ontologyVersion: S.String,
    extractedAt: S.String,
    durationMs: NonNegNum,
  }),
}).pipe(
  $I.annoteSchema("KnowledgeGraphResult", {
    description: "Cached entities, relations, and extraction metadata keyed by an idempotency key.",
  })
);

/**
 * Decoded cached graph produced by {@link KnowledgeGraphResult}.
 *
 * @see {@link KnowledgeGraphResult} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeGraphResult = typeof KnowledgeGraphResult.Type;

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Extract knowledge graph from text (streaming)
 *
 * **Details**
 *
 * Returns a stream of progress events, culminating in extraction_complete.
 * Uses idempotency key for deduplication and caching.
 *
 * Note: Entity routing by idempotency key is handled in the entity handler
 * by computing the key from the payload.
 *
 * **Example** (Identify the streaming extract RPC)
 *
 * ```ts
 * import { ExtractFromTextRpc } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(ExtractFromTextRpc._tag) // "ExtractFromText"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ExtractFromTextRpc = Rpc.make("ExtractFromText", {
  payload: ExtractFromTextPayload,
  success: ProgressEvent,
  error: ExtractionError,
  stream: true,
});

/**
 * Get cached extraction result by idempotency key
 *
 * **Details**
 *
 * Returns None if no cached result exists or extraction incomplete.
 *
 * **Example** (Identify the unary cache-lookup RPC)
 *
 * ```ts
 * import { GetCachedResultRpc } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(GetCachedResultRpc._tag) // "GetCachedResult"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GetCachedResultRpc = Rpc.make("GetCachedResult", {
  payload: GetCachedResultPayload,
  success: S.Option(KnowledgeGraphResult),
  error: ExtractionError,
});

/**
 * Cancel an in-progress extraction
 *
 * **Example** (Identify the cancel RPC)
 *
 * ```ts
 * import { CancelExtractionRpc } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(CancelExtractionRpc._tag) // "CancelExtraction"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const CancelExtractionRpc = Rpc.make("CancelExtraction", {
  payload: S.Struct({
    idempotencyKey: S.String,
    reason: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  }),
  success: S.Boolean,
  error: ExtractionError,
});

/** Current state of an extraction run. */
const ExtractionStatusFields = {
  progress: Percentage.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  startedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  completedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  error: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
};

/**
 * Lifecycle state of one extraction run keyed by idempotency key.
 *
 * **Example** (Decode pending and complete statuses)
 *
 * ```ts
 * import { ExtractionStatus } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const pending = S.decodeUnknownOption(ExtractionStatus)({ status: "pending" })
 * const complete = S.decodeUnknownOption(ExtractionStatus)({ status: "complete" })
 * console.log(O.map(pending, (value) => value.status))
 * console.log(O.map(complete, (value) => value.status))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionStatus = S.Union([
  S.Struct({ status: S.tag("pending"), ...ExtractionStatusFields }),
  S.Struct({ status: S.tag("running"), ...ExtractionStatusFields }),
  S.Struct({ status: S.tag("complete"), ...ExtractionStatusFields }),
  S.Struct({ status: S.tag("failed"), ...ExtractionStatusFields }),
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("ExtractionStatus", {
    description: "Pending, running, complete, or failed extraction lifecycle tagged by `status`.",
  })
);

/**
 * Decoded extraction lifecycle produced by {@link ExtractionStatus}.
 *
 * @see {@link ExtractionStatus} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionStatus = typeof ExtractionStatus.Type;

/**
 * Get extraction status
 *
 * **Example** (Identify the status RPC)
 *
 * ```ts
 * import { GetExtractionStatusRpc } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(GetExtractionStatusRpc._tag) // "GetExtractionStatus"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GetExtractionStatusRpc = Rpc.make("GetExtractionStatus", {
  payload: S.Struct({
    idempotencyKey: S.String,
  }),
  success: ExtractionStatus,
  error: ExtractionError,
});

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Knowledge Graph Extractor Entity
 *
 * **Details**
 *
 * Cluster entity that handles extraction requests with:
 * - Automatic sharding by idempotency key
 * - Streaming progress events
 * - Result caching
 * - Cancellation support
 *
 * **Example** (Name the cluster entity type)
 *
 * ```ts
 * import { KnowledgeGraphExtractor } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(KnowledgeGraphExtractor.type)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const KnowledgeGraphExtractor = Entity.make("KGExtractor", [
  ExtractFromTextRpc,
  GetCachedResultRpc,
  CancelExtractionRpc,
  GetExtractionStatusRpc,
]);

/**
 * Cluster entity constructor produced by {@link KnowledgeGraphExtractor}.
 *
 * @see {@link KnowledgeGraphExtractor} for the RPC protocol and sharding type.
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeGraphExtractor = typeof KnowledgeGraphExtractor;
