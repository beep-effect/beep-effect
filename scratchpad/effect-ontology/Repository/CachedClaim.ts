/**
 * Cached Claim Repository
 *
 * **Details**
 *
 * Effect.Cache wrapper around ClaimRepository for frequently accessed queries.
 * Caches single claim lookups and subject-based queries with TTL.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, HashSet, Layer, pipe } from "effect";

const $I = $ScratchpadId.create("effect-ontology/Repository/CachedClaim");

import { Cache, Duration, Effect } from "effect";
import * as A from "effect/Array";
import type { ClaimId, CorrectionId } from "./Claim.ts";
import { ClaimRepository } from "./Claim.ts";
import type { ClaimInsertRow } from "./schema.ts";

// =============================================================================
// Cache Configuration
// =============================================================================

const CLAIM_CACHE_CAPACITY = 10_000;
const CLAIM_CACHE_TTL = Duration.minutes(30);

const SUBJECT_CACHE_CAPACITY = 5_000;
const SUBJECT_CACHE_TTL = Duration.hours(1);

// =============================================================================
// Service
// =============================================================================

/**
 * CachedClaimRepository service
 *
 * **Details**
 *
 * Wraps ClaimRepository with Effect.Cache for hot-path queries.
 * Maintains same interface as ClaimRepository.
 *
 * **Example** (Inspect cached claim repository)
 *
 * ```ts
 * import { CachedClaimRepository } from "@effect-ontology/Repository/CachedClaim"
 *
 * console.log(CachedClaimRepository)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class CachedClaimRepository extends Context.Service<CachedClaimRepository>()($I`CachedClaimRepository`, {
  make: Effect.gen(function* () {
    const repo = yield* ClaimRepository;

    // Single claim lookup cache
    const claimCache = yield* Cache.make({
      capacity: CLAIM_CACHE_CAPACITY,
      timeToLive: CLAIM_CACHE_TTL,
      lookup: (id: ClaimId) => repo.getClaim(id),
    });

    // Subject-based query cache
    const subjectCache = yield* Cache.make({
      capacity: SUBJECT_CACHE_CAPACITY,
      timeToLive: SUBJECT_CACHE_TTL,
      lookup: (subjectIri: string) => repo.getClaimsBySubject(subjectIri),
    });

    // Cached single claim lookup
    const getClaim = (id: ClaimId) => Cache.get(claimCache, id);

    // Cached subject query
    const getClaimsBySubject = (subjectIri: string) => Cache.get(subjectCache, subjectIri);

    // Invalidate subject cache on insert
    const insertClaim = (claim: ClaimInsertRow) =>
      repo.insertClaim(claim).pipe(
        Effect.tap((result) =>
          Cache.invalidate(subjectCache, claim.subjectIri).pipe(
            Effect.tap(() =>
              // Also invalidate single claim cache for the new claim
              Cache.invalidate(claimCache, result.id)
            )
          )
        )
      );

    // Invalidate caches on deprecation
    const deprecateClaim = (claimId: ClaimId, correctionId: CorrectionId) =>
      repo.deprecateClaim(claimId, correctionId).pipe(
        Effect.tap(() =>
          // Invalidate the claim's cache entry
          Cache.invalidate(claimCache, claimId).pipe(
            Effect.tap(
              () =>
                // We'd need to know the subjectIri to invalidate subject cache
                // For now, skip subject cache invalidation on deprecation
                Effect.void
            )
          )
        )
      );

    // Invalidate caches on batch insert
    const insertClaimsBatch = (claimList: Array<ClaimInsertRow>) =>
      repo.insertClaimsBatch(claimList).pipe(
        Effect.tap((_results) =>
          Effect.all(
            // Invalidate subject caches for all affected subjects
            pipe(
              claimList,
              A.map((claim) => claim.subjectIri),
              HashSet.fromIterable,
              HashSet.map((iri) => Cache.invalidate(subjectCache, iri))
            ),
            { concurrency: "unbounded", discard: true }
          )
        )
      );

    // Invalidate caches on upsert batch
    const upsertClaimsBatch = (claimList: Array<ClaimInsertRow>) =>
      repo.upsertClaimsBatch(claimList).pipe(
        Effect.tap((_results) =>
          Effect.all(
            pipe(
              claimList,
              A.map((claim) => claim.subjectIri),
              HashSet.fromIterable,
              HashSet.map((iri) => Cache.invalidate(subjectCache, iri))
            ),
            { concurrency: "unbounded", discard: true }
          )
        )
      );

    return {
      getClaim,
      getClaimsBySubject,
      insertClaim,
      deprecateClaim,
      insertClaimsBatch,
      upsertClaimsBatch,
      getClaims: repo.getClaims,
      countClaims: repo.countClaims,
      getClaimsByArticle: repo.getClaimsByArticle,
      getPreferredClaims: repo.getPreferredClaims,
      getClaimHistory: repo.getClaimHistory,
      promoteToPreferred: repo.promoteToPreferred,
      insertCorrection: repo.insertCorrection,
      getCorrection: repo.getCorrection,
      linkClaimsToCorrection: repo.linkClaimsToCorrection,
      getCorrectionChain: repo.getCorrectionChain,
      findConflictingClaims: repo.findConflictingClaims,
      invalidateAll: Effect.fn("CachedClaimRepository.invalidateAll")(() =>
        Cache.invalidateAll(claimCache).pipe(Effect.tap(() => Cache.invalidateAll(subjectCache)))
      ),
      cacheStats: Effect.fn("CachedClaimRepository.cacheStats")(() =>
        Effect.all({
          claimCacheSize: Cache.size(claimCache),
          subjectCacheSize: Cache.size(subjectCache),
        })
      ),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide(ClaimRepository.Default));
}

/**
 * Layer that provides CachedClaimRepository
 *
 * **Example** (Inspect cached claim repository layer)
 *
 * ```ts
 * import { CachedClaimRepositoryLayer } from "@effect-ontology/Repository/CachedClaim"
 *
 * console.log(CachedClaimRepositoryLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CachedClaimRepositoryLayer = CachedClaimRepository.Default;
