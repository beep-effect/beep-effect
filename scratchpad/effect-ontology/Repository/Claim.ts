/**
 * Claim Repository
 *
 * **Details**
 *
 * Effect-native repository for claims metadata using Drizzle ORM.
 * Provides typed access to the claims table with support for
 * querying, deprecation, and conflict detection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import { Context, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effect-ontology/Repository/Claim");

import { PostgresDrizzle } from "@beep/postgres";
import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { DateTime, Effect } from "effect";
import type { ClaimInsertRow, ClaimRow, CorrectionInsertRow } from "./schema.ts";
import { claims, correctionClaims, corrections } from "./schema.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Describes the claim id data exposed by this module.
 *
 * **Example** (Create ClaimId)
 *
 * ```ts
 * import type { ClaimId } from "@effect-ontology/Repository/Claim"
 *
 * const claimId: ClaimId = "claim-id-1"
 *
 * console.log(claimId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimId = string;
/**
 * Describes the article id data exposed by this module.
 *
 * **Example** (Create ArticleId)
 *
 * ```ts
 * import type { ArticleId } from "@effect-ontology/Repository/Claim"
 *
 * const articleId: ArticleId = "article-id-1"
 *
 * console.log(articleId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArticleId = string;
/**
 * Describes the correction id data exposed by this module.
 *
 * **Example** (Create CorrectionId)
 *
 * ```ts
 * import type { CorrectionId } from "@effect-ontology/Repository/Claim"
 *
 * const correctionId: CorrectionId = "correction-id-1"
 *
 * console.log(correctionId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionId = string;

/**
 * Describes the claim filter data exposed by this module.
 *
 * **Example** (Reference ClaimFilter fields)
 *
 * ```ts
 * import type { ClaimFilter } from "@effect-ontology/Repository/Claim"
 *
 * const claimFilterFields: ReadonlyArray<keyof ClaimFilter> = ["ontologyId", "articleId", "subjectIri"]
 *
 * console.log(claimFilterFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ClaimFilter {
  readonly ontologyId?: string;
  readonly articleId?: ArticleId;
  readonly subjectIri?: string;
  readonly predicateIri?: string;
  readonly rank?: "preferred" | "normal" | "deprecated";
  readonly includeDeprecated?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Describes the conflict candidate data exposed by this module.
 *
 * **Example** (Reference ConflictCandidate fields)
 *
 * ```ts
 * import type { ConflictCandidate } from "@effect-ontology/Repository/Claim"
 *
 * const conflictCandidateFields: ReadonlyArray<keyof ConflictCandidate> = ["existingClaim", "conflictType"]
 *
 * console.log(conflictCandidateFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ConflictCandidate {
  readonly existingClaim: ClaimRow;
  readonly conflictType: "position" | "temporal" | "contradictory";
}

// =============================================================================
// Service
// =============================================================================

/**
 * Provides repository access for claim repository.
 *
 * **Example** (Inspect claim repository)
 *
 * ```ts
 * import { ClaimRepository } from "@effect-ontology/Repository/Claim"
 *
 * console.log(ClaimRepository)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class ClaimRepository extends Context.Service<ClaimRepository>()($I`ClaimRepository`, {
  make: Effect.gen(function* () {
    const drizzle = yield* PostgresDrizzle;
    const normalizeQueryError = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, DrizzleError, R> =>
      effect.pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)));

    // -------------------------------------------------------------------------
    // CRUD Operations
    // -------------------------------------------------------------------------

    /**
     * Insert a new claim
     */
    const insertClaim = Effect.fn("insertClaim")(
      function* (claim: ClaimInsertRow) {
        const [result] = yield* drizzle.insert(claims).values(claim).returning();
        return result;
      },
      Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause))
    );

    /**
     * Get claim by ID
     */
    const getClaim = Effect.fn("getClaim")(function* (id: ClaimId) {
      const [result] = yield* drizzle.select().from(claims).where(eq(claims.id, id)).limit(1);
      return O.fromNullishOr(result);
    });

    /**
     * Build WHERE conditions from a filter
     */
    const buildWhereConditions = (filter: ClaimFilter) => {
      const conditions = [];

      if (P.isNotUndefined(filter.ontologyId)) {
        conditions.push(eq(claims.ontologyId, filter.ontologyId));
      }
      if (P.isNotUndefined(filter.articleId)) {
        conditions.push(eq(claims.articleId, filter.articleId));
      }
      if (P.isNotUndefined(filter.subjectIri)) {
        conditions.push(eq(claims.subjectIri, filter.subjectIri));
      }
      if (P.isNotUndefined(filter.predicateIri)) {
        conditions.push(eq(claims.predicateIri, filter.predicateIri));
      }
      if (P.isNotUndefined(filter.rank)) {
        conditions.push(eq(claims.rank, filter.rank));
      }
      if (filter.includeDeprecated !== true) {
        conditions.push(isNull(claims.deprecatedAt));
      }

      return conditions;
    };

    /**
     * Get claims with filters
     */
    const getClaims = Effect.fn("getClaims")(function* (filter: ClaimFilter) {
      const conditions = buildWhereConditions(filter);
      let query = drizzle.select().from(claims).orderBy(desc(claims.assertedAt)).$dynamic();
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      if (P.isNotUndefined(filter.limit)) {
        query = query.limit(filter.limit);
      }
      if (P.isNotUndefined(filter.offset)) {
        query = query.offset(filter.offset);
      }
      return yield* query;
    });

    // -------------------------------------------------------------------------
    // Query Operations
    // -------------------------------------------------------------------------

    /**
     * Get claims by article
     */
    const getClaimsByArticle = (articleId: ArticleId) => getClaims({ articleId, includeDeprecated: false });

    /**
     * Get claims by subject IRI
     */
    const getClaimsBySubject = (subjectIri: string) => getClaims({ subjectIri, includeDeprecated: false });

    /**
     * Get preferred claims for a subject + predicate
     */
    const getPreferredClaims = (subjectIri: string, predicateIri: string) =>
      getClaims({ subjectIri, predicateIri, rank: "preferred" });

    /**
     * Get all claims for a subject + predicate (including deprecated)
     */
    const getClaimHistory = (subjectIri: string, predicateIri: string) =>
      getClaims({ subjectIri, predicateIri, includeDeprecated: true });

    // -------------------------------------------------------------------------
    // Deprecation & Corrections
    // -------------------------------------------------------------------------

    /**
     * Deprecate a claim due to a correction
     */
    const deprecateClaim = Effect.fn("deprecateClaim")(function* (claimId: ClaimId, correctionId: CorrectionId) {
      const now = yield* DateTime.now;
      yield* drizzle
        .update(claims)
        .set({
          deprecatedAt: DateTime.toDate(now),
          deprecatedBy: correctionId,
          rank: "deprecated",
        })
        .where(eq(claims.id, claimId));
    });

    /**
     * Promote a claim to preferred rank
     */
    const promoteToPreferred = (claimId: ClaimId) =>
      drizzle.update(claims).set({ rank: "preferred" }).where(eq(claims.id, claimId));

    /**
     * Insert a correction
     */
    const insertCorrection = Effect.fn("insertCorrection")(function* (correction: CorrectionInsertRow) {
      const [result] = yield* drizzle.insert(corrections).values(correction).returning();
      return result;
    });

    /**
     * Get correction by ID
     */
    const getCorrection = Effect.fn("getCorrection")(function* (id: CorrectionId) {
      const [result] = yield* drizzle.select().from(corrections).where(eq(corrections.id, id)).limit(1);
      return O.fromNullishOr(result);
    });

    /**
     * Link claims to a correction
     */
    const linkClaimsToCorrection = (correctionId: CorrectionId, originalClaimId: ClaimId, newClaimId?: ClaimId) =>
      drizzle.insert(correctionClaims).values({
        correctionId,
        originalClaimId,
        newClaimId: newClaimId ?? null,
      });

    /**
     * Get correction chain for a claim (all corrections that affected it)
     */
    const getCorrectionChain = Effect.fn("getCorrectionChain")(function* (claimId: ClaimId) {
      const result = yield* drizzle
        .select({
          correction: corrections,
        })
        .from(correctionClaims)
        .innerJoin(corrections, eq(correctionClaims.correctionId, corrections.id))
        .where(or(eq(correctionClaims.originalClaimId, claimId), eq(correctionClaims.newClaimId, claimId)))
        .orderBy(desc(corrections.correctionDate));
      return result.map((r) => r.correction);
    });

    // -------------------------------------------------------------------------
    // Conflict Detection
    // -------------------------------------------------------------------------

    /**
     * Find potentially conflicting claims
     *
     * Checks for:
     * 1. Same subject + predicate with different object (position conflict)
     * 2. Overlapping temporal validity (temporal conflict)
     */
    const findConflictingClaims = (
      claim: ClaimInsertRow | ClaimRow
    ): Effect.Effect<Array<ConflictCandidate>, DrizzleError> =>
      Effect.gen(function* () {
        // Find claims with same subject + predicate but different value
        const candidates = yield* drizzle
          .select()
          .from(claims)
          .where(
            and(
              eq(claims.subjectIri, claim.subjectIri),
              eq(claims.predicateIri, claim.predicateIri),
              isNull(claims.deprecatedAt) // Only active claims
            )
          );

        const conflicts: Array<ConflictCandidate> = [];

        for (const existing of candidates) {
          // Skip if same claim or same value
          if ("id" in claim && existing.id === claim.id) continue;
          if (existing.objectValue === claim.objectValue) continue;

          // Check for temporal overlap if both have validity periods
          if (
            P.isNotNullish(claim.validFrom) &&
            P.isNotNullish(claim.validTo) &&
            P.isNotNull(existing.validFrom) &&
            P.isNotNull(existing.validTo)
          ) {
            const claimStart =
              claim.validFrom instanceof Date
                ? claim.validFrom
                : DateTime.toDateUtc(DateTime.makeUnsafe(claim.validFrom));
            const claimEnd =
              claim.validTo instanceof Date ? claim.validTo : DateTime.toDateUtc(DateTime.makeUnsafe(claim.validTo));
            const existingStart = existing.validFrom;
            const existingEnd = existing.validTo;

            // Check overlap: (StartA <= EndB) and (EndA >= StartB)
            if (claimStart <= existingEnd && claimEnd >= existingStart) {
              conflicts.push({ existingClaim: existing, conflictType: "temporal" });
              continue;
            }
          }

          // Position conflict: same subject+predicate, different value, no temporal qualifier
          // This indicates potentially contradictory information
          conflicts.push({ existingClaim: existing, conflictType: "position" });
        }

        return conflicts;
      }).pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)));

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    /**
     * Insert multiple claims in a batch
     */
    const insertClaimsBatch = Effect.fn("insertClaimsBatch")(function* (claimList: Array<ClaimInsertRow>) {
      if (claimList.length === 0) return [];
      return yield* drizzle.insert(claims).values(claimList).returning();
    });

    /**
     * Upsert multiple claims in a batch (idempotent)
     *
     * Uses ON CONFLICT DO NOTHING on the natural key
     * (article_id, subject_iri, predicate_iri, object_value).
     * Returns only the newly inserted claims.
     */
    const upsertClaimsBatch = Effect.fn("upsertClaimsBatch")(function* (claimList: Array<ClaimInsertRow>) {
      if (claimList.length === 0) return [];
      return yield* drizzle
        .insert(claims)
        .values(claimList)
        .onConflictDoNothing({
          target: [claims.articleId, claims.subjectIri, claims.predicateIri, claims.objectValue],
        })
        .returning();
    });

    /**
     * Count claims with filters using SQL COUNT
     */
    const countClaims = Effect.fn("countClaims")(function* (filter: ClaimFilter) {
      const conditions = buildWhereConditions(filter);
      let query = drizzle.select({ count: count() }).from(claims).$dynamic();
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      const result = yield* query;
      return result[0]?.count ?? 0;
    });

    return {
      // CRUD
      insertClaim: Effect.fn("ClaimRepository.insertClaim")((claim: ClaimInsertRow) =>
        normalizeQueryError(insertClaim(claim))
      ),
      getClaim: Effect.fn("ClaimRepository.getClaim")((id: ClaimId) => normalizeQueryError(getClaim(id))),
      getClaims: Effect.fn("ClaimRepository.getClaims")((filter: ClaimFilter) =>
        normalizeQueryError(getClaims(filter))
      ),

      // Queries
      getClaimsByArticle: Effect.fn("ClaimRepository.getClaimsByArticle")((articleId: ArticleId) =>
        normalizeQueryError(getClaimsByArticle(articleId))
      ),
      getClaimsBySubject: Effect.fn("ClaimRepository.getClaimsBySubject")((subjectIri: string) =>
        normalizeQueryError(getClaimsBySubject(subjectIri))
      ),
      getPreferredClaims: Effect.fn("ClaimRepository.getPreferredClaims")((subjectIri: string, predicateIri: string) =>
        normalizeQueryError(getPreferredClaims(subjectIri, predicateIri))
      ),
      getClaimHistory: Effect.fn("ClaimRepository.getClaimHistory")((subjectIri: string, predicateIri: string) =>
        normalizeQueryError(getClaimHistory(subjectIri, predicateIri))
      ),

      // Deprecation & Corrections
      deprecateClaim: Effect.fn("ClaimRepository.deprecateClaim")((claimId: ClaimId, correctionId: CorrectionId) =>
        normalizeQueryError(deprecateClaim(claimId, correctionId))
      ),
      promoteToPreferred: Effect.fn("ClaimRepository.promoteToPreferred")((claimId: ClaimId) =>
        normalizeQueryError(promoteToPreferred(claimId))
      ),
      insertCorrection: Effect.fn("ClaimRepository.insertCorrection")((correction: CorrectionInsertRow) =>
        normalizeQueryError(insertCorrection(correction))
      ),
      getCorrection: Effect.fn("ClaimRepository.getCorrection")((id: CorrectionId) =>
        normalizeQueryError(getCorrection(id))
      ),
      linkClaimsToCorrection: Effect.fn("ClaimRepository.linkClaimsToCorrection")(
        (correctionId: CorrectionId, originalClaimId: ClaimId, newClaimId?: ClaimId) =>
          normalizeQueryError(linkClaimsToCorrection(correctionId, originalClaimId, newClaimId))
      ),
      getCorrectionChain: Effect.fn("ClaimRepository.getCorrectionChain")((claimId: ClaimId) =>
        normalizeQueryError(getCorrectionChain(claimId))
      ),

      // Conflict Detection
      findConflictingClaims: Effect.fn("ClaimRepository.findConflictingClaims")((claim: ClaimInsertRow | ClaimRow) =>
        normalizeQueryError(findConflictingClaims(claim))
      ),

      // Bulk
      insertClaimsBatch: Effect.fn("ClaimRepository.insertClaimsBatch")((claimList: Array<ClaimInsertRow>) =>
        normalizeQueryError(insertClaimsBatch(claimList))
      ),
      upsertClaimsBatch: Effect.fn("ClaimRepository.upsertClaimsBatch")((claimList: Array<ClaimInsertRow>) =>
        normalizeQueryError(upsertClaimsBatch(claimList))
      ),
      countClaims: Effect.fn("ClaimRepository.countClaims")((filter: ClaimFilter) =>
        normalizeQueryError(countClaims(filter))
      ),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
