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

import { Cache, Data, Duration, Effect } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import type { PersistedClaimId, PersistedCorrectionId } from "./Claim.ts";
import { ClaimRepository } from "./Claim.ts";
import type { ClaimInsertRow } from "./schema.ts";

// =============================================================================
// Cache Configuration
// =============================================================================

const CLAIM_CACHE_CAPACITY = 10_000;
const CLAIM_CACHE_TTL = Duration.minutes(30);

const SUBJECT_CACHE_CAPACITY = 5_000;
const SUBJECT_CACHE_TTL = Duration.hours(1);

class ScopedCacheKey extends Data.Class<{
  readonly ontologyId: string;
  readonly value: string;
}> {}

// =============================================================================
// Service
// =============================================================================

interface CachedClaimRepositoryShape extends Context.Service.Shape<typeof ClaimRepository> {
  readonly invalidateAll: Effect.Effect<void>;
  readonly cacheStats: Effect.Effect<{ claimCacheSize: number; subjectCacheSize: number }>;
}

/**
 * Claim repository wrapper that caches claim-id and subject lookups with
 * Effect.Cache.
 *
 * **Details**
 *
 * Same query surface as {@link ClaimRepository}, plus `cacheStats` and
 * `invalidateAll`.
 *
 * **Example** (Inspect claim cache stats and invalidate)
 *
 * ```ts
 * import { CachedClaimRepository } from "@effect-ontology/Repository/CachedClaim"
 * import { Effect } from "effect"
 *
 * const inspectCache = Effect.gen(function* () {
 *   const claims = yield* CachedClaimRepository
 *   const before = yield* claims.cacheStats
 *   yield* claims.invalidateAll
 *   const after = yield* claims.cacheStats
 *   return { before, after }
 * })
 * console.log(typeof inspectCache) // "object"
 * ```
 *
 * @see {@link ClaimRepository} for the uncached persistence service this wraps.
 * @see {@link CachedClaimRepositoryLayer} for the Default layer export.
 * @category repositories
 * @since 0.0.0
 */
export class CachedClaimRepository extends Context.Service<CachedClaimRepository, CachedClaimRepositoryShape>()(
  $I`CachedClaimRepository`,
  {
    make: Effect.gen(function* () {
      const repo = yield* ClaimRepository;

      // Single claim lookup cache
      const claimCache = yield* Cache.make({
        capacity: CLAIM_CACHE_CAPACITY,
        timeToLive: CLAIM_CACHE_TTL,
        lookup: (key: ScopedCacheKey) => repo.getClaim(key.value, key.ontologyId),
      });

      const scopedCacheKey = (value: string, ontologyId: string): ScopedCacheKey =>
        new ScopedCacheKey({ ontologyId, value });

      // Subject-based query cache
      const subjectCache = yield* Cache.make({
        capacity: SUBJECT_CACHE_CAPACITY,
        timeToLive: SUBJECT_CACHE_TTL,
        lookup: (key: ScopedCacheKey) => repo.getClaimsBySubject(key.value, key.ontologyId),
      });

      // Cached single claim lookup
      const getClaim: CachedClaimRepositoryShape["getClaim"] = dual(2, (id: PersistedClaimId, ontologyId: string) =>
        Cache.get(claimCache, scopedCacheKey(id, ontologyId))
      );

      // Cached subject query
      const getClaimsBySubject: CachedClaimRepositoryShape["getClaimsBySubject"] = dual(
        2,
        (subjectIri: string, ontologyId: string) => Cache.get(subjectCache, scopedCacheKey(subjectIri, ontologyId))
      );

      // Invalidate subject cache on insert
      const insertClaim: CachedClaimRepositoryShape["insertClaim"] = (claim: ClaimInsertRow) =>
        repo.insertClaim(claim).pipe(
          Effect.tap((result) =>
            Cache.invalidate(subjectCache, scopedCacheKey(claim.subjectIri, claim.ontologyId)).pipe(
              Effect.tap(() =>
                // Also invalidate single claim cache for the new claim
                Cache.invalidate(claimCache, scopedCacheKey(result.id, result.ontologyId))
              )
            )
          )
        );

      // Invalidate caches on deprecation
      const deprecateClaim: CachedClaimRepositoryShape["deprecateClaim"] = dual(
        3,
        Effect.fn("CachedClaimRepository.deprecateClaim")(function* (
          claimId: PersistedClaimId,
          correctionId: PersistedCorrectionId,
          ontologyId: string
        ) {
          const existing = yield* repo.getClaim(claimId, ontologyId);
          yield* repo.deprecateClaim(claimId, correctionId, ontologyId);
          yield* Cache.invalidate(claimCache, scopedCacheKey(claimId, ontologyId));
          yield* O.match(existing, {
            onNone: () => Effect.void,
            onSome: (claim) => Cache.invalidate(subjectCache, scopedCacheKey(claim.subjectIri, ontologyId)),
          });
        })
      );

      // Invalidate caches on batch insert
      const insertClaimsBatch: CachedClaimRepositoryShape["insertClaimsBatch"] = (claimList: Array<ClaimInsertRow>) =>
        repo.insertClaimsBatch(claimList).pipe(
          Effect.tap((results) =>
            Effect.all(
              [
                ...pipe(
                  claimList,
                  A.map((claim) => scopedCacheKey(claim.subjectIri, claim.ontologyId)),
                  HashSet.fromIterable,
                  A.fromIterable,
                  A.map((key) => Cache.invalidate(subjectCache, key))
                ),
                ...A.map(results, (claim) => Cache.invalidate(claimCache, scopedCacheKey(claim.id, claim.ontologyId))),
              ],
              { concurrency: "unbounded", discard: true }
            )
          )
        );

      // Invalidate caches on upsert batch
      const upsertClaimsBatch: CachedClaimRepositoryShape["upsertClaimsBatch"] = (claimList: Array<ClaimInsertRow>) =>
        repo.upsertClaimsBatch(claimList).pipe(
          Effect.tap((results) =>
            Effect.all(
              [
                ...pipe(
                  claimList,
                  A.map((claim) => scopedCacheKey(claim.subjectIri, claim.ontologyId)),
                  HashSet.fromIterable,
                  A.fromIterable,
                  A.map((key) => Cache.invalidate(subjectCache, key))
                ),
                ...A.map(results, (claim) => Cache.invalidate(claimCache, scopedCacheKey(claim.id, claim.ontologyId))),
              ],
              { concurrency: "unbounded", discard: true }
            )
          )
        );

      const promoteToPreferred: CachedClaimRepositoryShape["promoteToPreferred"] = dual(
        2,
        Effect.fn("CachedClaimRepository.promoteToPreferred")(function* (
          claimId: PersistedClaimId,
          ontologyId: string
        ) {
          const existing = yield* repo.getClaim(claimId, ontologyId);
          yield* repo.promoteToPreferred(claimId, ontologyId);
          yield* Cache.invalidate(claimCache, scopedCacheKey(claimId, ontologyId));
          yield* O.match(existing, {
            onNone: () => Effect.void,
            onSome: (claim) => Cache.invalidate(subjectCache, scopedCacheKey(claim.subjectIri, ontologyId)),
          });
        })
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
        promoteToPreferred,
        insertCorrection: repo.insertCorrection,
        getCorrection: repo.getCorrection,
        linkClaimsToCorrection: repo.linkClaimsToCorrection,
        getCorrectionChain: repo.getCorrectionChain,
        findConflictingClaims: repo.findConflictingClaims,
        invalidateAll: Cache.invalidateAll(claimCache).pipe(
          Effect.tap(() => Cache.invalidateAll(subjectCache)),
          Effect.withSpan("CachedClaimRepository.invalidateAll")
        ),
        cacheStats: Effect.all({
          claimCacheSize: Cache.size(claimCache),
          subjectCacheSize: Cache.size(subjectCache),
        }).pipe(Effect.withSpan("CachedClaimRepository.cacheStats")),
      };
    }),
  }
) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide(ClaimRepository.Default));
}

/**
 * Layer providing {@link CachedClaimRepository} over {@link ClaimRepository}.
 *
 * **Example** (Reuse the default claim-cache layer)
 *
 * ```ts
 * import { CachedClaimRepository, CachedClaimRepositoryLayer } from "@effect-ontology/Repository/CachedClaim"
 *
 * console.log(CachedClaimRepositoryLayer === CachedClaimRepository.Default) // true
 * ```
 *
 * @see {@link CachedClaimRepository} for `cacheStats` and `invalidateAll`.
 * @category layers
 * @since 0.0.0
 */
export const CachedClaimRepositoryLayer = CachedClaimRepository.Default;
