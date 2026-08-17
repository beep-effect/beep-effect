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

import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { NonNegNum } from "@beep/schema/Number";
import { Percentage } from "@beep/schema/Percentage";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { Entity } from "effect/unstable/cluster";
import * as Rpc from "effect/unstable/rpc/Rpc";
import { ProgressEventSchema } from "../Contract/ProgressStreaming.ts";
import { Entity as DomainEntity, Relation } from "../Domain/Model/Entity.ts";

// IdempotencyKey utilities used by entity handlers
export { computeIdempotencyKey, type ExtractionParams } from "../Utils/IdempotencyKey.ts";

// =============================================================================
// RPC Schemas
// =============================================================================

/**
 * Extraction request payload
 *
 * **Example** (Validate extract from text payload)
 *
 * ```ts
 * import { ExtractFromTextPayload } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ExtractFromTextPayload)({}))
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
});

/**
 * Describes the extract from text payload data exposed by this module.
 *
 * **Example** (Decode ExtractFromTextPayload)
 *
 * ```ts
 * import { ExtractFromTextPayload } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeExtractFromTextPayload = (_value: ExtractFromTextPayload): string => "valid extract from text payload"
 *
 * console.log(O.map(S.decodeUnknownOption(ExtractFromTextPayload)({}), summarizeExtractFromTextPayload))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractFromTextPayload = typeof ExtractFromTextPayload.Type;

/**
 * Extraction summary returned on completion
 *
 * **Example** (Validate extraction summary)
 *
 * ```ts
 * import { ExtractionSummary } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ExtractionSummary)({}))
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
});

/**
 * Describes the extraction summary data exposed by this module.
 *
 * **Example** (Decode ExtractionSummary)
 *
 * ```ts
 * import { ExtractionSummary } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeExtractionSummary = (_value: ExtractionSummary): string => "valid extraction summary"
 *
 * console.log(O.map(S.decodeUnknownOption(ExtractionSummary)({}), summarizeExtractionSummary))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionSummary = typeof ExtractionSummary.Type;

/**
 * Cached result lookup payload
 *
 * **Example** (Validate get cached result payload)
 *
 * ```ts
 * import { GetCachedResultPayload } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GetCachedResultPayload)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GetCachedResultPayload = S.Struct({
  idempotencyKey: S.String,
});

/**
 * Describes the get cached result payload data exposed by this module.
 *
 * **Example** (Decode GetCachedResultPayload)
 *
 * ```ts
 * import { GetCachedResultPayload } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeGetCachedResultPayload = (_value: GetCachedResultPayload): string => "valid get cached result payload"
 *
 * console.log(O.map(S.decodeUnknownOption(GetCachedResultPayload)({}), summarizeGetCachedResultPayload))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GetCachedResultPayload = typeof GetCachedResultPayload.Type;

/**
 * Knowledge graph result
 *
 * **Example** (Validate knowledge graph result)
 *
 * ```ts
 * import { KnowledgeGraphResult } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KnowledgeGraphResult)({}))
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
});

/**
 * Describes the knowledge graph result data exposed by this module.
 *
 * **Example** (Decode KnowledgeGraphResult)
 *
 * ```ts
 * import { KnowledgeGraphResult } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeKnowledgeGraphResult = (_value: KnowledgeGraphResult): string => "valid knowledge graph result"
 *
 * console.log(O.map(S.decodeUnknownOption(KnowledgeGraphResult)({}), summarizeKnowledgeGraphResult))
 * ```
 *
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
 * **Example** (Inspect extract from text rpc)
 *
 * ```ts
 * import { ExtractFromTextRpc } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(ExtractFromTextRpc)
 * ```
 *
 * @category schemas
 * @since 0.0.0
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
 * **Details**
 *
 * Returns None if no cached result exists or extraction incomplete.
 *
 * **Example** (Inspect get cached result rpc)
 *
 * ```ts
 * import { GetCachedResultRpc } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(GetCachedResultRpc)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GetCachedResultRpc = Rpc.make("GetCachedResult", {
  payload: GetCachedResultPayload,
  success: S.Option(KnowledgeGraphResult),
  error: S.String,
});

/**
 * Cancel an in-progress extraction
 *
 * **Example** (Inspect cancel extraction rpc)
 *
 * ```ts
 * import { CancelExtractionRpc } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(CancelExtractionRpc)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CancelExtractionRpc = Rpc.make("CancelExtraction", {
  payload: S.Struct({
    idempotencyKey: S.String,
    reason: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  }),
  success: S.Boolean,
  error: S.String,
});

/** Current state of an extraction run. */
const ExtractionStatusFields = {
  progress: Percentage.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  startedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  completedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  error: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
};

/**
 * Validates and represents extraction status values at runtime.
 *
 * **Example** (Validate extraction status)
 *
 * ```ts
 * import { ExtractionStatus } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ExtractionStatus)({}))
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
]).pipe(S.toTaggedUnion("status"));

/**
 * Describes the extraction status data exposed by this module.
 *
 * **Example** (Decode ExtractionStatus)
 *
 * ```ts
 * import { ExtractionStatus } from "@effect-ontology/Cluster/ExtractionEntity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeExtractionStatus = (_value: ExtractionStatus): string => "valid extraction status"
 *
 * console.log(O.map(S.decodeUnknownOption(ExtractionStatus)({}), summarizeExtractionStatus))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionStatus = typeof ExtractionStatus.Type;

/**
 * Get extraction status
 *
 * **Example** (Inspect get extraction status rpc)
 *
 * ```ts
 * import { GetExtractionStatusRpc } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(GetExtractionStatusRpc)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GetExtractionStatusRpc = Rpc.make("GetExtractionStatus", {
  payload: S.Struct({
    idempotencyKey: S.String,
  }),
  success: ExtractionStatus,
  error: S.String,
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
 * **Example** (Inspect knowledge graph extractor)
 *
 * ```ts
 * import { KnowledgeGraphExtractor } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * console.log(KnowledgeGraphExtractor)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const KnowledgeGraphExtractor = Entity.make("KGExtractor", [
  ExtractFromTextRpc,
  GetCachedResultRpc,
  CancelExtractionRpc,
  GetExtractionStatusRpc,
]);

/**
 * Describes the knowledge graph extractor data exposed by this module.
 *
 * **Example** (Reference the knowledge graph extractor value)
 *
 * ```ts
 * import { KnowledgeGraphExtractor } from "@effect-ontology/Cluster/ExtractionEntity"
 *
 * const knowledgeGraphExtractor: KnowledgeGraphExtractor = KnowledgeGraphExtractor
 *
 * console.log(knowledgeGraphExtractor)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type KnowledgeGraphExtractor = typeof KnowledgeGraphExtractor;
