/**
 * Repository Domain Types
 *
 * TypeScript types matching the PostgreSQL schema for claims, articles, and corrections.
 * These types are used by repository services for typed database access.
 *
 * @since 2.0.0
 * @module Repository/types
 */

import { SchemaUtils } from "@beep/schema";
import { Schema } from "effect";

// =============================================================================
// Branded IDs
// =============================================================================

export const ArticleId = Schema.String.pipe(
  Schema.brand("ArticleId"),
  Schema.annotate({ title: "ArticleId", description: "UUID for article" })
);
export type ArticleId = typeof ArticleId.Type;

export const ClaimId = Schema.String.pipe(
  Schema.brand("ClaimId"),
  Schema.annotate({ title: "ClaimId", description: "UUID for claim" })
);
export type ClaimId = typeof ClaimId.Type;

export const CorrectionId = Schema.String.pipe(
  Schema.brand("CorrectionId"),
  Schema.annotate({ title: "CorrectionId", description: "UUID for correction" })
);
export type CorrectionId = typeof CorrectionId.Type;

export const ConflictId = Schema.String.pipe(
  Schema.brand("ConflictId"),
  Schema.annotate({ title: "ConflictId", description: "UUID for conflict" })
);
export type ConflictId = typeof ConflictId.Type;

export const BatchRunId = Schema.String.pipe(
  Schema.brand("BatchRunId"),
  Schema.annotate({ title: "BatchRunId", description: "UUID for batch run" })
);
export type BatchRunId = typeof BatchRunId.Type;

// =============================================================================
// Enums
// =============================================================================

export const ClaimRank = Schema.Literals(["preferred", "normal", "deprecated"]);
export type ClaimRank = typeof ClaimRank.Type;

export const ObjectType = Schema.Literals(["iri", "literal", "typed_literal"]);
export type ObjectType = typeof ObjectType.Type;

export const CorrectionType = Schema.Literals(["retraction", "clarification", "update", "amendment"]);
export type CorrectionType = typeof CorrectionType.Type;

export const ConflictType = Schema.Literals(["position", "temporal", "contradictory", "duplicate"]);
export type ConflictType = typeof ConflictType.Type;

export const ConflictStatus = Schema.Literals(["pending", "resolved", "ignored"]);
export type ConflictStatus = typeof ConflictStatus.Type;

export const ResolutionStrategy = Schema.Literals(["temporal_precedence", "source_authority", "manual"]);
export type ResolutionStrategy = typeof ResolutionStrategy.Type;

export const BatchRunStatus = Schema.Literals(["pending", "running", "completed", "failed"]);
export type BatchRunStatus = typeof BatchRunStatus.Type;

// =============================================================================
// Article
// =============================================================================

export const Article = Schema.Struct({
  id: ArticleId,
  uri: Schema.String,
  sourceName: Schema.NullOr(Schema.String),
  headline: Schema.NullOr(Schema.String),
  publishedAt: Schema.DateTimeUtc,
  ingestedAt: Schema.DateTimeUtc,
  graphUri: Schema.NullOr(Schema.String),
  contentHash: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
});
export type Article = typeof Article.Type;

export const ArticleInsert = Schema.Struct({
  id: ArticleId.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  uri: Schema.String,
  sourceName: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  headline: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  publishedAt: Schema.DateTimeUtc,
  graphUri: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  contentHash: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});
export type ArticleInsert = typeof ArticleInsert.Type;

// =============================================================================
// Claim
// =============================================================================

export const Claim = Schema.Struct({
  id: ClaimId,
  articleId: ArticleId,
  subjectIri: Schema.String,
  predicateIri: Schema.String,
  objectValue: Schema.String,
  objectType: ObjectType,
  objectDatatype: Schema.NullOr(Schema.String),
  objectLanguage: Schema.NullOr(Schema.String),
  rank: ClaimRank,
  validFrom: Schema.NullOr(Schema.DateTimeUtc),
  validTo: Schema.NullOr(Schema.DateTimeUtc),
  assertedAt: Schema.DateTimeUtc,
  deprecatedAt: Schema.NullOr(Schema.DateTimeUtc),
  deprecatedBy: Schema.NullOr(CorrectionId),
  confidenceScore: Schema.NullOr(Schema.Finite),
  evidenceText: Schema.NullOr(Schema.String),
  evidenceStartOffset: Schema.NullOr(Schema.Finite),
  evidenceEndOffset: Schema.NullOr(Schema.Finite),
});
export type Claim = typeof Claim.Type;

export const ClaimInsert = Schema.Struct({
  id: ClaimId.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  articleId: ArticleId,
  subjectIri: Schema.String,
  predicateIri: Schema.String,
  objectValue: Schema.String,
  objectType: ObjectType.pipe(SchemaUtils.withKeyDefaults("iri" as const)),
  objectDatatype: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  objectLanguage: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  rank: ClaimRank.pipe(SchemaUtils.withKeyDefaults("normal" as const)),
  validFrom: Schema.DateTimeUtc.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  validTo: Schema.DateTimeUtc.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  confidenceScore: Schema.Finite.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  evidenceText: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  evidenceStartOffset: Schema.Finite.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  evidenceEndOffset: Schema.Finite.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});
export type ClaimInsert = typeof ClaimInsert.Type;

// =============================================================================
// Correction
// =============================================================================

export const Correction = Schema.Struct({
  id: CorrectionId,
  correctionType: CorrectionType,
  sourceArticleId: Schema.NullOr(ArticleId),
  reason: Schema.NullOr(Schema.String),
  correctionDate: Schema.DateTimeUtc,
  createdAt: Schema.DateTimeUtc,
  processedAt: Schema.NullOr(Schema.DateTimeUtc),
});
export type Correction = typeof Correction.Type;

export const CorrectionInsert = Schema.Struct({
  id: CorrectionId.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  correctionType: CorrectionType,
  sourceArticleId: ArticleId.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  reason: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  correctionDate: Schema.DateTimeUtc,
});
export type CorrectionInsert = typeof CorrectionInsert.Type;

// =============================================================================
// Correction Claims (Junction)
// =============================================================================

export const CorrectionClaim = Schema.Struct({
  correctionId: CorrectionId,
  originalClaimId: ClaimId,
  newClaimId: Schema.NullOr(ClaimId),
});
export type CorrectionClaim = typeof CorrectionClaim.Type;

// =============================================================================
// Conflict
// =============================================================================

export const Conflict = Schema.Struct({
  id: ConflictId,
  conflictType: ConflictType,
  claimAId: ClaimId,
  claimBId: ClaimId,
  status: ConflictStatus,
  resolutionStrategy: Schema.NullOr(ResolutionStrategy),
  acceptedClaimId: Schema.NullOr(ClaimId),
  resolvedBy: Schema.NullOr(Schema.String),
  resolvedAt: Schema.NullOr(Schema.DateTimeUtc),
  resolutionNotes: Schema.NullOr(Schema.String),
  detectedAt: Schema.DateTimeUtc,
});
export type Conflict = typeof Conflict.Type;

export const ConflictInsert = Schema.Struct({
  id: ConflictId.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  conflictType: ConflictType,
  claimAId: ClaimId,
  claimBId: ClaimId,
});
export type ConflictInsert = typeof ConflictInsert.Type;

// =============================================================================
// Batch Run
// =============================================================================

export const BatchRun = Schema.Struct({
  id: BatchRunId,
  batchId: Schema.String,
  status: BatchRunStatus,
  documentsTotal: Schema.Finite,
  documentsProcessed: Schema.Finite,
  claimsExtracted: Schema.Finite,
  conflictsDetected: Schema.Finite,
  startedAt: Schema.NullOr(Schema.DateTimeUtc),
  completedAt: Schema.NullOr(Schema.DateTimeUtc),
  errorMessage: Schema.NullOr(Schema.String),
  errorDetails: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.DateTimeUtc,
});
export type BatchRun = typeof BatchRun.Type;

export const BatchRunInsert = Schema.Struct({
  id: BatchRunId.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  batchId: Schema.String,
  documentsTotal: Schema.Finite.pipe(SchemaUtils.withKeyDefaults(0)),
  documentsProcessed: Schema.Finite.pipe(SchemaUtils.withKeyDefaults(0)),
  claimsExtracted: Schema.Finite.pipe(SchemaUtils.withKeyDefaults(0)),
  conflictsDetected: Schema.Finite.pipe(SchemaUtils.withKeyDefaults(0)),
});
export type BatchRunInsert = typeof BatchRunInsert.Type;
