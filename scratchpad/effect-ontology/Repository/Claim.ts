/**
 * Claim Repository
 *
 * Effect-native repository for claims metadata using Drizzle ORM.
 * Provides typed access to the claims table with support for
 * querying, deprecation, and conflict detection.
 *
 * @since 2.0.0
 * @module Repository/Claim
 */

import { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import { Context, Layer } from "effect";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effect-ontology/Repository/Claim");

import { PostgresDrizzle } from "@beep/postgres";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { DateTime, Effect, Option } from "effect";
import type { ClaimInsertRow, ClaimRow, CorrectionInsertRow } from "./schema.ts";
import { claims, correctionClaims, corrections } from "./schema.ts";

// =============================================================================
// Types
// =============================================================================

export type ClaimId = string;
export type ArticleId = string;
export type CorrectionId = string;

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

export interface ConflictCandidate {
  readonly existingClaim: ClaimRow;
  readonly conflictType: "position" | "temporal" | "contradictory";
}

// =============================================================================
// Service
// =============================================================================

export class ClaimRepository extends Context.Service<ClaimRepository>()($I`ClaimRepository`, {
  make: Effect.gen(function* () {
    const drizzle = yield* PostgresDrizzle;

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
      return Option.fromNullishOr(result);
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
      if (P.isUndefined(filter.includeDeprecated)) {
        conditions.push(isNull(claims.deprecatedAt));
      }

      return conditions;
    };

    /**
     * Get claims with filters
     */
    const getClaims = Effect.fn("getClaims")(function* (filter: ClaimFilter) {
      const conditions = buildWhereConditions(filter);
      let query = drizzle.select().from(claims).orderBy(desc(claims.assertedAt));
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
      if (P.isNotUndefined(filter.limit)) {
        query = query.limit(filter.limit) as typeof query;
      }
      if (P.isNotUndefined(filter.offset)) {
        query = query.offset(filter.offset) as typeof query;
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
      return Option.fromNullishOr(result);
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
                : DateTime.toDateUtc(DateTime.makeUnsafe(claim.validFrom as string));
            const claimEnd =
              claim.validTo instanceof Date
                ? claim.validTo
                : DateTime.toDateUtc(DateTime.makeUnsafe(claim.validTo as string));
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
      let query = drizzle.select({ count: sql<number>`count(*)::int` }).from(claims);
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
      const result = yield* query;
      return result[0]?.count ?? 0;
    });

    return {
      // CRUD
      insertClaim,
      getClaim,
      getClaims,

      // Queries
      getClaimsByArticle,
      getClaimsBySubject,
      getPreferredClaims,
      getClaimHistory,

      // Deprecation & Corrections
      deprecateClaim,
      promoteToPreferred,
      insertCorrection,
      getCorrection,
      linkClaimsToCorrection,
      getCorrectionChain,

      // Conflict Detection
      findConflictingClaims,

      // Bulk
      insertClaimsBatch,
      upsertClaimsBatch,
      countClaims,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
