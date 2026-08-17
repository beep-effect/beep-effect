/**
 * Repository Domain Types
 *
 * **Details**
 *
 * TypeScript types matching the PostgreSQL schema for claims, articles, and corrections.
 * These types are used by repository services for typed database access.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

// =============================================================================
// Branded IDs
// =============================================================================

/**
 * Validates and represents article id values at runtime.
 *
 * **Example** (Validate article id)
 *
 * ```ts
 * import { ArticleId } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArticleId)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArticleId = S.String.pipe(
  S.brand("ArticleId"),
  S.annotate({ title: "ArticleId", description: "UUID for article" })
);
/**
 * Describes the article id data exposed by this module.
 *
 * **Example** (Decode ArticleId)
 *
 * ```ts
 * import { ArticleId } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeArticleId = (_value: ArticleId): string => "valid article id"
 *
 * console.log(O.map(S.decodeUnknownOption(ArticleId)({}), summarizeArticleId))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArticleId = typeof ArticleId.Type;

/**
 * Validates and represents claim id values at runtime.
 *
 * **Example** (Validate claim id)
 *
 * ```ts
 * import { ClaimId } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimId)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimId = S.String.pipe(
  S.brand("ClaimId"),
  S.annotate({ title: "ClaimId", description: "UUID for claim" })
);
/**
 * Describes the claim id data exposed by this module.
 *
 * **Example** (Decode ClaimId)
 *
 * ```ts
 * import { ClaimId } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeClaimId = (_value: ClaimId): string => "valid claim id"
 *
 * console.log(O.map(S.decodeUnknownOption(ClaimId)({}), summarizeClaimId))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimId = typeof ClaimId.Type;

/**
 * Validates and represents correction id values at runtime.
 *
 * **Example** (Validate correction id)
 *
 * ```ts
 * import { CorrectionId } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorrectionId)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorrectionId = S.String.pipe(
  S.brand("CorrectionId"),
  S.annotate({ title: "CorrectionId", description: "UUID for correction" })
);
/**
 * Describes the correction id data exposed by this module.
 *
 * **Example** (Decode CorrectionId)
 *
 * ```ts
 * import { CorrectionId } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeCorrectionId = (_value: CorrectionId): string => "valid correction id"
 *
 * console.log(O.map(S.decodeUnknownOption(CorrectionId)({}), summarizeCorrectionId))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionId = typeof CorrectionId.Type;

/**
 * Validates and represents conflict id values at runtime.
 *
 * **Example** (Validate conflict id)
 *
 * ```ts
 * import { ConflictId } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ConflictId)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictId = S.String.pipe(
  S.brand("ConflictId"),
  S.annotate({ title: "ConflictId", description: "UUID for conflict" })
);
/**
 * Describes the conflict id data exposed by this module.
 *
 * **Example** (Decode ConflictId)
 *
 * ```ts
 * import { ConflictId } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeConflictId = (_value: ConflictId): string => "valid conflict id"
 *
 * console.log(O.map(S.decodeUnknownOption(ConflictId)({}), summarizeConflictId))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictId = typeof ConflictId.Type;

/**
 * Validates and represents batch run id values at runtime.
 *
 * **Example** (Validate batch run id)
 *
 * ```ts
 * import { BatchRunId } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BatchRunId)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BatchRunId = S.String.pipe(
  S.brand("BatchRunId"),
  S.annotate({ title: "BatchRunId", description: "UUID for batch run" })
);
/**
 * Describes the batch run id data exposed by this module.
 *
 * **Example** (Decode BatchRunId)
 *
 * ```ts
 * import { BatchRunId } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeBatchRunId = (_value: BatchRunId): string => "valid batch run id"
 *
 * console.log(O.map(S.decodeUnknownOption(BatchRunId)({}), summarizeBatchRunId))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchRunId = typeof BatchRunId.Type;

// =============================================================================
// Enums
// =============================================================================

/**
 * Validates and represents claim rank values at runtime.
 *
 * **Example** (Validate claim rank)
 *
 * ```ts
 * import { ClaimRank } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimRank)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimRank = S.Literals(["preferred", "normal", "deprecated"]);
/**
 * Describes the claim rank data exposed by this module.
 *
 * **Example** (Decode ClaimRank)
 *
 * ```ts
 * import { ClaimRank } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeClaimRank = (_value: ClaimRank): string => "valid claim rank"
 *
 * console.log(O.map(S.decodeUnknownOption(ClaimRank)({}), summarizeClaimRank))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimRank = typeof ClaimRank.Type;

/**
 * Validates and represents object type values at runtime.
 *
 * **Example** (Validate object type)
 *
 * ```ts
 * import { ObjectType } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ObjectType)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObjectType = S.Literals(["iri", "literal", "typed_literal"]);
/**
 * Describes the object type data exposed by this module.
 *
 * **Example** (Decode ObjectType)
 *
 * ```ts
 * import { ObjectType } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeObjectType = (_value: ObjectType): string => "valid object type"
 *
 * console.log(O.map(S.decodeUnknownOption(ObjectType)({}), summarizeObjectType))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ObjectType = typeof ObjectType.Type;

/**
 * Validates and represents correction type values at runtime.
 *
 * **Example** (Validate correction type)
 *
 * ```ts
 * import { CorrectionType } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorrectionType)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorrectionType = S.Literals(["retraction", "clarification", "update", "amendment"]);
/**
 * Describes the correction type data exposed by this module.
 *
 * **Example** (Decode CorrectionType)
 *
 * ```ts
 * import { CorrectionType } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeCorrectionType = (_value: CorrectionType): string => "valid correction type"
 *
 * console.log(O.map(S.decodeUnknownOption(CorrectionType)({}), summarizeCorrectionType))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionType = typeof CorrectionType.Type;

/**
 * Validates and represents conflict type values at runtime.
 *
 * **Example** (Validate conflict type)
 *
 * ```ts
 * import { ConflictType } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ConflictType)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictType = S.Literals(["position", "temporal", "contradictory", "duplicate"]);
/**
 * Describes the conflict type data exposed by this module.
 *
 * **Example** (Decode ConflictType)
 *
 * ```ts
 * import { ConflictType } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeConflictType = (_value: ConflictType): string => "valid conflict type"
 *
 * console.log(O.map(S.decodeUnknownOption(ConflictType)({}), summarizeConflictType))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictType = typeof ConflictType.Type;

/**
 * Validates and represents conflict status values at runtime.
 *
 * **Example** (Validate conflict status)
 *
 * ```ts
 * import { ConflictStatus } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ConflictStatus)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictStatus = S.Literals(["pending", "resolved", "ignored"]);
/**
 * Describes the conflict status data exposed by this module.
 *
 * **Example** (Decode ConflictStatus)
 *
 * ```ts
 * import { ConflictStatus } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeConflictStatus = (_value: ConflictStatus): string => "valid conflict status"
 *
 * console.log(O.map(S.decodeUnknownOption(ConflictStatus)({}), summarizeConflictStatus))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictStatus = typeof ConflictStatus.Type;

/**
 * Validates and represents resolution strategy values at runtime.
 *
 * **Example** (Validate resolution strategy)
 *
 * ```ts
 * import { ResolutionStrategy } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ResolutionStrategy)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResolutionStrategy = S.Literals(["temporal_precedence", "source_authority", "manual"]);
/**
 * Describes the resolution strategy data exposed by this module.
 *
 * **Example** (Decode ResolutionStrategy)
 *
 * ```ts
 * import { ResolutionStrategy } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeResolutionStrategy = (_value: ResolutionStrategy): string => "valid resolution strategy"
 *
 * console.log(O.map(S.decodeUnknownOption(ResolutionStrategy)({}), summarizeResolutionStrategy))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResolutionStrategy = typeof ResolutionStrategy.Type;

/**
 * Validates and represents batch run status values at runtime.
 *
 * **Example** (Validate batch run status)
 *
 * ```ts
 * import { BatchRunStatus } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BatchRunStatus)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BatchRunStatus = S.Literals(["pending", "running", "completed", "failed"]);
/**
 * Describes the batch run status data exposed by this module.
 *
 * **Example** (Decode BatchRunStatus)
 *
 * ```ts
 * import { BatchRunStatus } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeBatchRunStatus = (_value: BatchRunStatus): string => "valid batch run status"
 *
 * console.log(O.map(S.decodeUnknownOption(BatchRunStatus)({}), summarizeBatchRunStatus))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchRunStatus = typeof BatchRunStatus.Type;

// =============================================================================
// Article
// =============================================================================

/**
 * Validates and represents article values at runtime.
 *
 * **Example** (Validate article)
 *
 * ```ts
 * import { Article } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Article)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Article = S.Struct({
  id: ArticleId,
  uri: S.String,
  sourceName: S.NullOr(S.String),
  headline: S.NullOr(S.String),
  publishedAt: S.DateTimeUtc,
  ingestedAt: S.DateTimeUtc,
  graphUri: S.NullOr(S.String),
  contentHash: S.NullOr(S.String),
  createdAt: S.DateTimeUtc,
  updatedAt: S.DateTimeUtc,
});
/**
 * Describes the article data exposed by this module.
 *
 * **Example** (Decode Article)
 *
 * ```ts
 * import { Article } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeArticle = (_value: Article): string => "valid article"
 *
 * console.log(O.map(S.decodeUnknownOption(Article)({}), summarizeArticle))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Article = typeof Article.Type;

/**
 * Validates and represents article insert values at runtime.
 *
 * **Example** (Validate article insert)
 *
 * ```ts
 * import { ArticleInsert } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArticleInsert)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArticleInsert = S.Struct({
  id: ArticleId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  uri: S.String,
  sourceName: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  headline: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  publishedAt: S.DateTimeUtc,
  graphUri: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  contentHash: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});
/**
 * Describes the article insert data exposed by this module.
 *
 * **Example** (Decode ArticleInsert)
 *
 * ```ts
 * import { ArticleInsert } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeArticleInsert = (_value: ArticleInsert): string => "valid article insert"
 *
 * console.log(O.map(S.decodeUnknownOption(ArticleInsert)({}), summarizeArticleInsert))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArticleInsert = typeof ArticleInsert.Type;

// =============================================================================
// Claim
// =============================================================================

/**
 * Validates and represents claim values at runtime.
 *
 * **Example** (Validate claim)
 *
 * ```ts
 * import { Claim } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Claim)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Claim = S.Struct({
  id: ClaimId,
  articleId: ArticleId,
  subjectIri: S.String,
  predicateIri: S.String,
  objectValue: S.String,
  objectType: ObjectType,
  objectDatatype: S.NullOr(S.String),
  objectLanguage: S.NullOr(S.String),
  rank: ClaimRank,
  validFrom: S.NullOr(S.DateTimeUtc),
  validTo: S.NullOr(S.DateTimeUtc),
  assertedAt: S.DateTimeUtc,
  derivedAt: S.NullOr(S.DateTimeUtc),
  deprecatedAt: S.NullOr(S.DateTimeUtc),
  deprecatedBy: S.NullOr(CorrectionId),
  confidenceScore: S.NullOr(Confidence),
  evidenceText: S.NullOr(S.String),
  evidenceStartOffset: S.NullOr(NonNegativeInt),
  evidenceEndOffset: S.NullOr(NonNegativeInt),
});
/**
 * Describes the claim data exposed by this module.
 *
 * **Example** (Decode Claim)
 *
 * ```ts
 * import { Claim } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeClaim = (_value: Claim): string => "valid claim"
 *
 * console.log(O.map(S.decodeUnknownOption(Claim)({}), summarizeClaim))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Claim = typeof Claim.Type;

/**
 * Validates and represents claim insert values at runtime.
 *
 * **Example** (Validate claim insert)
 *
 * ```ts
 * import { ClaimInsert } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimInsert)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimInsert = S.Struct({
  id: ClaimId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  articleId: ArticleId,
  subjectIri: S.String,
  predicateIri: S.String,
  objectValue: S.String,
  objectType: ObjectType.pipe(SchemaUtils.withKeyDefaults("iri")),
  objectDatatype: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  objectLanguage: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  rank: ClaimRank.pipe(SchemaUtils.withKeyDefaults("normal")),
  validFrom: S.DateTimeUtc.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  validTo: S.DateTimeUtc.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  confidenceScore: Confidence.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  evidenceText: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  evidenceStartOffset: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  evidenceEndOffset: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});
/**
 * Describes the claim insert data exposed by this module.
 *
 * **Example** (Decode ClaimInsert)
 *
 * ```ts
 * import { ClaimInsert } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeClaimInsert = (_value: ClaimInsert): string => "valid claim insert"
 *
 * console.log(O.map(S.decodeUnknownOption(ClaimInsert)({}), summarizeClaimInsert))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInsert = typeof ClaimInsert.Type;

// =============================================================================
// Correction
// =============================================================================

/**
 * Validates and represents correction values at runtime.
 *
 * **Example** (Validate correction)
 *
 * ```ts
 * import { Correction } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Correction)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Correction = S.Struct({
  id: CorrectionId,
  correctionType: CorrectionType,
  sourceArticleId: S.NullOr(ArticleId),
  reason: S.NullOr(S.String),
  correctionDate: S.DateTimeUtc,
  createdAt: S.DateTimeUtc,
  processedAt: S.NullOr(S.DateTimeUtc),
});
/**
 * Describes the correction data exposed by this module.
 *
 * **Example** (Decode Correction)
 *
 * ```ts
 * import { Correction } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeCorrection = (_value: Correction): string => "valid correction"
 *
 * console.log(O.map(S.decodeUnknownOption(Correction)({}), summarizeCorrection))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Correction = typeof Correction.Type;

/**
 * Validates and represents correction insert values at runtime.
 *
 * **Example** (Validate correction insert)
 *
 * ```ts
 * import { CorrectionInsert } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorrectionInsert)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorrectionInsert = S.Struct({
  id: CorrectionId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  correctionType: CorrectionType,
  sourceArticleId: ArticleId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  reason: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  correctionDate: S.DateTimeUtc,
});
/**
 * Describes the correction insert data exposed by this module.
 *
 * **Example** (Decode CorrectionInsert)
 *
 * ```ts
 * import { CorrectionInsert } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeCorrectionInsert = (_value: CorrectionInsert): string => "valid correction insert"
 *
 * console.log(O.map(S.decodeUnknownOption(CorrectionInsert)({}), summarizeCorrectionInsert))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionInsert = typeof CorrectionInsert.Type;

// =============================================================================
// Correction Claims (Junction)
// =============================================================================

/**
 * Validates and represents correction claim values at runtime.
 *
 * **Example** (Validate correction claim)
 *
 * ```ts
 * import { CorrectionClaim } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorrectionClaim)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorrectionClaim = S.Struct({
  correctionId: CorrectionId,
  originalClaimId: ClaimId,
  newClaimId: S.NullOr(ClaimId),
});
/**
 * Describes the correction claim data exposed by this module.
 *
 * **Example** (Decode CorrectionClaim)
 *
 * ```ts
 * import { CorrectionClaim } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeCorrectionClaim = (_value: CorrectionClaim): string => "valid correction claim"
 *
 * console.log(O.map(S.decodeUnknownOption(CorrectionClaim)({}), summarizeCorrectionClaim))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionClaim = typeof CorrectionClaim.Type;

// =============================================================================
// Conflict
// =============================================================================

/**
 * Validates and represents conflict values at runtime.
 *
 * **Example** (Validate conflict)
 *
 * ```ts
 * import { Conflict } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Conflict)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Conflict = S.Struct({
  id: ConflictId,
  conflictType: ConflictType,
  claimAId: ClaimId,
  claimBId: ClaimId,
  status: ConflictStatus,
  resolutionStrategy: S.NullOr(ResolutionStrategy),
  acceptedClaimId: S.NullOr(ClaimId),
  resolvedBy: S.NullOr(S.String),
  resolvedAt: S.NullOr(S.DateTimeUtc),
  resolutionNotes: S.NullOr(S.String),
  detectedAt: S.DateTimeUtc,
});
/**
 * Describes the conflict data exposed by this module.
 *
 * **Example** (Decode Conflict)
 *
 * ```ts
 * import { Conflict } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeConflict = (_value: Conflict): string => "valid conflict"
 *
 * console.log(O.map(S.decodeUnknownOption(Conflict)({}), summarizeConflict))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Conflict = typeof Conflict.Type;

/**
 * Validates and represents conflict insert values at runtime.
 *
 * **Example** (Validate conflict insert)
 *
 * ```ts
 * import { ConflictInsert } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ConflictInsert)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictInsert = S.Struct({
  id: ConflictId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  conflictType: ConflictType,
  claimAId: ClaimId,
  claimBId: ClaimId,
});
/**
 * Describes the conflict insert data exposed by this module.
 *
 * **Example** (Decode ConflictInsert)
 *
 * ```ts
 * import { ConflictInsert } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeConflictInsert = (_value: ConflictInsert): string => "valid conflict insert"
 *
 * console.log(O.map(S.decodeUnknownOption(ConflictInsert)({}), summarizeConflictInsert))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictInsert = typeof ConflictInsert.Type;

// =============================================================================
// Batch Run
// =============================================================================

/**
 * Validates and represents batch run values at runtime.
 *
 * **Example** (Validate batch run)
 *
 * ```ts
 * import { BatchRun } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BatchRun)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BatchRun = S.Struct({
  id: BatchRunId,
  batchId: S.String,
  status: BatchRunStatus,
  documentsTotal: NonNegativeInt,
  documentsProcessed: NonNegativeInt,
  claimsExtracted: NonNegativeInt,
  conflictsDetected: NonNegativeInt,
  startedAt: S.NullOr(S.DateTimeUtc),
  completedAt: S.NullOr(S.DateTimeUtc),
  errorMessage: S.NullOr(S.String),
  errorDetails: S.NullOr(S.Unknown),
  createdAt: S.DateTimeUtc,
});
/**
 * Describes the batch run data exposed by this module.
 *
 * **Example** (Decode BatchRun)
 *
 * ```ts
 * import { BatchRun } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeBatchRun = (_value: BatchRun): string => "valid batch run"
 *
 * console.log(O.map(S.decodeUnknownOption(BatchRun)({}), summarizeBatchRun))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchRun = typeof BatchRun.Type;

/**
 * Validates and represents batch run insert values at runtime.
 *
 * **Example** (Validate batch run insert)
 *
 * ```ts
 * import { BatchRunInsert } from "@effect-ontology/Repository/types"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BatchRunInsert)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BatchRunInsert = S.Struct({
  id: BatchRunId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  batchId: S.String,
  documentsTotal: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  documentsProcessed: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  claimsExtracted: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  conflictsDetected: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
});
/**
 * Describes the batch run insert data exposed by this module.
 *
 * **Example** (Decode BatchRunInsert)
 *
 * ```ts
 * import { BatchRunInsert } from "@effect-ontology/Repository/types"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeBatchRunInsert = (_value: BatchRunInsert): string => "valid batch run insert"
 *
 * console.log(O.map(S.decodeUnknownOption(BatchRunInsert)({}), summarizeBatchRunInsert))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchRunInsert = typeof BatchRunInsert.Type;
