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
import { Context, Equal, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Repository/Claim");

import { PostgresDrizzle } from "@beep/postgres";
import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { DateTime, Effect } from "effect";
import type { ConflictKind } from "../Domain/Schema/Timeline.ts";
import { canonicalConflictPair, detectConflictKind } from "./Conflict.ts";
import type { ClaimInsertRow, ClaimRow, CorrectionInsertRow } from "./schema.ts";
import { Claims, Corrections, claims, conflicts, correctionClaims, corrections } from "./schema.ts";

const ClaimCountDatabaseRow = S.Struct({ count: S.Int }).pipe(
  $I.annoteSchema("ClaimCountDatabaseRow", {
    description: "Claim count projection decoded at the Drizzle database boundary.",
  })
);

const decodeClaimRows = (rows: unknown) =>
  S.decodeUnknownEffect(Claims.select.pipe(S.Array, S.mutable))(rows).pipe(
    Effect.mapError((cause) => DrizzleError.fromUnknown("decodeRows", cause))
  );

const decodeCorrectionRows = (rows: unknown) =>
  S.decodeUnknownEffect(Corrections.select.pipe(S.Array, S.mutable))(rows).pipe(
    Effect.mapError((cause) => DrizzleError.fromUnknown("decodeRows", cause))
  );

const decodeClaimCountRows = (rows: unknown) =>
  S.decodeUnknownEffect(S.Tuple([ClaimCountDatabaseRow]))(rows).pipe(
    Effect.mapError((cause) => DrizzleError.fromUnknown("decodeRows", cause))
  );

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
  readonly ontologyId: string;
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
  readonly conflictType: ConflictKind;
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

    const persistClaimsWithConflicts = Effect.fn("ClaimRepository.persistClaimsWithConflicts")(function* (
      claimList: Array<ClaimInsertRow>,
      idempotent: boolean
    ): Effect.fn.Return<Array<ClaimRow>, DrizzleError> {
      if (A.isReadonlyArrayEmpty(claimList)) return [];

      return yield* normalizeQueryError(
        drizzle.transaction(
          Effect.fnUntraced(function* (tx) {
            const insertedRows = idempotent
              ? yield* tx
                  .insert(claims)
                  .values(claimList)
                  .onConflictDoNothing({
                    target: [claims.articleId, claims.subjectIri, claims.predicateIri, claims.objectValue],
                  })
                  .returning()
              : yield* tx.insert(claims).values(claimList).returning();
            const inserted = yield* decodeClaimRows(insertedRows);

            yield* Effect.forEach(
              inserted,
              Effect.fnUntraced(function* (claim) {
                const candidateRows = yield* tx
                  .select()
                  .from(claims)
                  .where(
                    and(
                      eq(claims.ontologyId, claim.ontologyId),
                      eq(claims.subjectIri, claim.subjectIri),
                      eq(claims.predicateIri, claim.predicateIri),
                      isNull(claims.deprecatedAt)
                    )
                  );
                const candidates = yield* decodeClaimRows(candidateRows);

                yield* Effect.forEach(
                  candidates,
                  Effect.fnUntraced(function* (candidate) {
                    if (Equal.equals(candidate.id, claim.id)) return;
                    const kind = detectConflictKind(claim, candidate);
                    if (O.isNone(kind)) return;
                    const [claimAId, claimBId] = canonicalConflictPair(claim.id, candidate.id);
                    yield* tx
                      .insert(conflicts)
                      .values({
                        ontologyId: claim.ontologyId,
                        conflictType: kind.value,
                        claimAId,
                        claimBId,
                      })
                      .onConflictDoNothing({
                        target: [conflicts.ontologyId, conflicts.claimAId, conflicts.claimBId],
                      });
                  }),
                  { concurrency: 1, discard: true }
                );
              }),
              { concurrency: 1, discard: true }
            );

            return inserted;
          })
        )
      );
    });

    // -------------------------------------------------------------------------
    // CRUD Operations
    // -------------------------------------------------------------------------

    /**
     * Insert a new claim
     */
    const insertClaim = Effect.fn("insertClaim")(
      function* (claim: ClaimInsertRow) {
        const rows = yield* persistClaimsWithConflicts([claim], false);
        return yield* Effect.fromOption(A.head(rows), () =>
          DrizzleError.fromUnknown("decodeRows", { operation: "insertClaim", reason: "missing returning row" })
        );
      },
      Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause))
    );

    /**
     * Get claim by ID
     */
    const getClaim = Effect.fn("getClaim")(function* (id: ClaimId, ontologyId: string) {
      const [result] = yield* decodeClaimRows(
        yield* drizzle
          .select()
          .from(claims)
          .where(and(eq(claims.id, id), eq(claims.ontologyId, ontologyId)))
          .limit(1)
      );
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
      if (A.isReadonlyArrayNonEmpty(conditions)) {
        query = query.where(and(...conditions));
      }
      if (P.isNotUndefined(filter.limit)) {
        query = query.limit(filter.limit);
      }
      if (P.isNotUndefined(filter.offset)) {
        query = query.offset(filter.offset);
      }
      return yield* decodeClaimRows(yield* query);
    });

    // -------------------------------------------------------------------------
    // Query Operations
    // -------------------------------------------------------------------------

    /**
     * Get claims by article
     */
    const getClaimsByArticle = (articleId: ArticleId, ontologyId: string) =>
      getClaims({ articleId, ontologyId, includeDeprecated: false });

    /**
     * Get claims by subject IRI
     */
    const getClaimsBySubject = (subjectIri: string, ontologyId: string) =>
      getClaims({ subjectIri, ontologyId, includeDeprecated: false });

    /**
     * Get preferred claims for a subject + predicate
     */
    const getPreferredClaims = (subjectIri: string, predicateIri: string, ontologyId: string) =>
      getClaims({ subjectIri, predicateIri, ontologyId, rank: "preferred" });

    /**
     * Get all claims for a subject + predicate (including deprecated)
     */
    const getClaimHistory = (subjectIri: string, predicateIri: string, ontologyId: string) =>
      getClaims({ subjectIri, predicateIri, ontologyId, includeDeprecated: true });

    // -------------------------------------------------------------------------
    // Deprecation & Corrections
    // -------------------------------------------------------------------------

    /**
     * Deprecate a claim due to a correction
     */
    const deprecateClaim = Effect.fn("deprecateClaim")(function* (
      claimId: ClaimId,
      correctionId: CorrectionId,
      ontologyId: string
    ) {
      const now = yield* DateTime.now;
      yield* drizzle
        .update(claims)
        .set({
          deprecatedAt: DateTime.toDate(now),
          deprecatedBy: correctionId,
          rank: "deprecated",
        })
        .where(and(eq(claims.id, claimId), eq(claims.ontologyId, ontologyId)));
    });

    /**
     * Promote a claim to preferred rank
     */
    const promoteToPreferred = (claimId: ClaimId, ontologyId: string) =>
      drizzle
        .update(claims)
        .set({ rank: "preferred" })
        .where(and(eq(claims.id, claimId), eq(claims.ontologyId, ontologyId)));

    /**
     * Insert a correction
     */
    const insertCorrection = Effect.fn("insertCorrection")(function* (correction: CorrectionInsertRow) {
      const [result] = yield* decodeCorrectionRows(yield* drizzle.insert(corrections).values(correction).returning());
      return result;
    });

    /**
     * Get correction by ID
     */
    const getCorrection = Effect.fn("getCorrection")(function* (id: CorrectionId) {
      const [result] = yield* decodeCorrectionRows(
        yield* drizzle.select().from(corrections).where(eq(corrections.id, id)).limit(1)
      );
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
      return yield* decodeCorrectionRows(A.map(result, (row) => row.correction));
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
              eq(claims.ontologyId, claim.ontologyId),
              isNull(claims.deprecatedAt) // Only active claims
            )
          );

        const detected: Array<ConflictCandidate> = [];

        for (const existing of yield* decodeClaimRows(candidates)) {
          // Skip if same claim or same value
          if ("id" in claim && Equal.equals(existing.id, claim.id)) continue;
          const kind = detectConflictKind(claim, existing);
          if (O.isSome(kind)) detected.push({ existingClaim: existing, conflictType: kind.value });
        }

        return detected;
      }).pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)));

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    /**
     * Insert multiple claims in a batch
     */
    const insertClaimsBatch = Effect.fn("insertClaimsBatch")(function* (claimList: Array<ClaimInsertRow>) {
      return yield* persistClaimsWithConflicts(claimList, false);
    });

    /**
     * Upsert multiple claims in a batch (idempotent)
     *
     * Uses ON CONFLICT DO NOTHING on the natural key
     * (article_id, subject_iri, predicate_iri, object_value).
     * Returns only the newly inserted claims.
     */
    const upsertClaimsBatch = Effect.fn("upsertClaimsBatch")(function* (claimList: Array<ClaimInsertRow>) {
      return yield* persistClaimsWithConflicts(claimList, true);
    });

    /**
     * Count claims with filters using SQL COUNT
     */
    const countClaims = Effect.fn("countClaims")(function* (filter: ClaimFilter) {
      const conditions = buildWhereConditions(filter);
      let query = drizzle.select({ count: count() }).from(claims).$dynamic();
      if (A.isReadonlyArrayNonEmpty(conditions)) {
        query = query.where(and(...conditions));
      }
      const [result] = yield* decodeClaimCountRows(yield* query);
      return result.count;
    });

    return {
      // CRUD
      insertClaim: Effect.fn("ClaimRepository.insertClaim")((claim: ClaimInsertRow) =>
        normalizeQueryError(insertClaim(claim))
      ),
      getClaim: Effect.fn("ClaimRepository.getClaim")((id: ClaimId, ontologyId: string) =>
        normalizeQueryError(getClaim(id, ontologyId))
      ),
      getClaims: Effect.fn("ClaimRepository.getClaims")((filter: ClaimFilter) =>
        normalizeQueryError(getClaims(filter))
      ),

      // Queries
      getClaimsByArticle: Effect.fn("ClaimRepository.getClaimsByArticle")((articleId: ArticleId, ontologyId: string) =>
        normalizeQueryError(getClaimsByArticle(articleId, ontologyId))
      ),
      getClaimsBySubject: Effect.fn("ClaimRepository.getClaimsBySubject")((subjectIri: string, ontologyId: string) =>
        normalizeQueryError(getClaimsBySubject(subjectIri, ontologyId))
      ),
      getPreferredClaims: Effect.fn("ClaimRepository.getPreferredClaims")(
        (subjectIri: string, predicateIri: string, ontologyId: string) =>
          normalizeQueryError(getPreferredClaims(subjectIri, predicateIri, ontologyId))
      ),
      getClaimHistory: Effect.fn("ClaimRepository.getClaimHistory")(
        (subjectIri: string, predicateIri: string, ontologyId: string) =>
          normalizeQueryError(getClaimHistory(subjectIri, predicateIri, ontologyId))
      ),

      // Deprecation & Corrections
      deprecateClaim: Effect.fn("ClaimRepository.deprecateClaim")(
        (claimId: ClaimId, correctionId: CorrectionId, ontologyId: string) =>
          normalizeQueryError(deprecateClaim(claimId, correctionId, ontologyId))
      ),
      promoteToPreferred: Effect.fn("ClaimRepository.promoteToPreferred")((claimId: ClaimId, ontologyId: string) =>
        normalizeQueryError(promoteToPreferred(claimId, ontologyId))
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
