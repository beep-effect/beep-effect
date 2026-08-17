/**
 * Extraction Entity Definition
 *
 * Defines the Cluster Entity for knowledge graph extraction with:
 * - Streaming progress events
 * - Idempotency key routing
 * - Cached result retrieval
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { NonNegNum } from "@beep/schema/Number";
import { Percentage } from "@beep/schema/Percentage";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { Entity } from "effect/unstable/cluster";
import * as Rpc from "effect/unstable/rpc/Rpc";
import { ProgressEventSchema } from "../Contract/ProgressStreaming.ts";

// IdempotencyKey utilities used by entity handlers
export { computeIdempotencyKey, type ExtractionParams } from "../Utils/IdempotencyKey.ts";

// =============================================================================
// RPC Schemas
// =============================================================================

/**
 * Extraction request payload
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
});

export type ExtractFromTextPayload = typeof ExtractFromTextPayload.Type;

/**
 * Extraction summary returned on completion
 */
export const ExtractionSummary = S.Struct({
  entityCount: NonNegativeInt,
  relationCount: NonNegativeInt,
  durationMs: NonNegNum,
  idempotencyKey: S.String,
});

export type ExtractionSummary = typeof ExtractionSummary.Type;

/**
 * Cached result lookup payload
 */
export const GetCachedResultPayload = S.Struct({
  idempotencyKey: S.String,
});

export type GetCachedResultPayload = typeof GetCachedResultPayload.Type;

/**
 * Knowledge graph result
 */
export const KnowledgeGraphResult = S.Struct({
  entities: S.Array(S.Any),
  relations: S.Array(S.Any),
  metadata: S.Struct({
    idempotencyKey: S.String,
    ontologyId: S.String,
    ontologyVersion: S.String,
    extractedAt: S.String,
    durationMs: NonNegNum,
  }),
});

export type KnowledgeGraphResult = typeof KnowledgeGraphResult.Type;

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Extract knowledge graph from text (streaming)
 *
 * Returns a stream of progress events, culminating in extraction_complete.
 * Uses idempotency key for deduplication and caching.
 *
 * Note: Entity routing by idempotency key is handled in the entity handler
 * by computing the key from the payload.
 */
export const ExtractFromTextRpc = Rpc.make("ExtractFromText", {
  payload: ExtractFromTextPayload,
  success: ProgressEventSchema,
  error: S.String,
  stream: true,
});

/**
 * Get cached extraction result by idempotency key
 *
 * Returns None if no cached result exists or extraction incomplete.
 */
export const GetCachedResultRpc = Rpc.make("GetCachedResult", {
  payload: GetCachedResultPayload,
  success: S.Option(KnowledgeGraphResult),
  error: S.String,
});

/**
 * Cancel an in-progress extraction
 */
export const CancelExtractionRpc = Rpc.make("CancelExtraction", {
  payload: S.Struct({
    idempotencyKey: S.String,
    reason: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  }),
  success: S.Boolean,
  error: S.String,
});

/**
 * Get extraction status
 */
export const GetExtractionStatusRpc = Rpc.make("GetExtractionStatus", {
  payload: S.Struct({
    idempotencyKey: S.String,
  }),
  success: S.Struct({
    status: S.Literals(["pending", "running", "complete", "failed"]),
    progress: Percentage.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    startedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    completedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    error: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  }),
  error: S.String,
});

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Knowledge Graph Extractor Entity
 *
 * Cluster entity that handles extraction requests with:
 * - Automatic sharding by idempotency key
 * - Streaming progress events
 * - Result caching
 * - Cancellation support
 */
export const KnowledgeGraphExtractor = Entity.make("KGExtractor", [
  ExtractFromTextRpc,
  GetCachedResultRpc,
  CancelExtractionRpc,
  GetExtractionStatusRpc,
]);

export type KnowledgeGraphExtractor = typeof KnowledgeGraphExtractor;
