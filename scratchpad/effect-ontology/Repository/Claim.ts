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
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { Context, Equal, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Repository/Claim");

import { PostgresDrizzle } from "@beep/postgres";
import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { DateTime, Effect } from "effect";
import { dual } from "effect/Function";
import { normalizeDrizzleError } from "../Utils/Sql.ts";
import { canonicalConflictPair, detectConflictKind } from "./Conflict.ts";
import type { ClaimInsertRow, ClaimRow, CorrectionInsertRow, CorrectionRow } from "./schema.ts";
import { Claims, Corrections, claims, conflicts, correctionClaims, corrections } from "./schema.ts";

const ClaimCountDatabaseRow = S.Struct({ count: NonNegativeInt }).pipe(
  $I.annoteSchema("ClaimCountDatabaseRow", {
    description: "Claim count projection decoded at the Drizzle database boundary.",
  })
);

const normalizeDecodedRows = normalizeDrizzleError("decodeRows");

const decodeClaimRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(Claims.select.pipe(S.Array, S.mutable))(rows));

const decodeCorrectionRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(Corrections.select.pipe(S.Array, S.mutable))(rows));

const ClaimCountRows = S.Tuple([ClaimCountDatabaseRow]).pipe(SchemaUtils.withEffectCodecStatics);

const decodeClaimCountRows = (rows: unknown) =>
  normalizeDecodedRows(ClaimCountRows.decodeUnknownEffect(rows));

// =============================================================================
// Types
// =============================================================================

/**
 * Describes the database UUID used to identify a persisted claim row.
 *
 * **Example** (Reference a persisted claim identifier)
 *
 * ```ts
 * import type { PersistedClaimId } from "@effect-ontology/Repository/Claim"
 *
 * const printClaimId = (claimId: PersistedClaimId) => console.log(claimId)
 *
 * console.log(printClaimId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersistedClaimId = ClaimRow["id"];
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
export type ArticleId = ClaimRow["articleId"];
/**
 * Describes the database UUID used to identify a persisted correction row.
 *
 * **Example** (Reference a persisted correction identifier)
 *
 * ```ts
 * import type { PersistedCorrectionId } from "@effect-ontology/Repository/Claim"
 *
 * const printCorrectionId = (correctionId: PersistedCorrectionId) => console.log(correctionId)
 *
 * console.log(printCorrectionId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PersistedCorrectionId = CorrectionRow["id"];

/**
 * Describes the claim filter data exposed by this module.
 *
 * **Example** (Create an ontology-scoped filter)
 *
 * ```ts
 * import { ClaimFilter } from "@effect-ontology/Repository/Claim"
 *
 * const filter = ClaimFilter.make({ ontologyId: "claims" })
 * console.log(filter.ontologyId) // "claims"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimFilter extends S.Class<ClaimFilter>($I`ClaimFilter`)(
  {
    ontologyId: S.NonEmptyString,
    articleId: S.optionalKey(S.NonEmptyString),
    subjectIri: S.optionalKey(S.NonEmptyString),
    predicateIri: S.optionalKey(S.NonEmptyString),
    rank: S.optionalKey(S.Literals(["preferred", "normal", "deprecated"])),
    includeDeprecated: S.optionalKey(S.Boolean),
    limit: S.optionalKey(PosInt),
    offset: S.optionalKey(NonNegativeInt),
  },
  $I.annote("ClaimFilter", {
    description: "Ontology-scoped persisted-claim filters with bounded pagination fields.",
  })
) {}

/**
 * Describes the conflict candidate data exposed by this module.
 *
 * **Example** (Reject an incomplete conflict candidate)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ConflictCandidate } from "@effect-ontology/Repository/Claim"
 *
 * console.log(S.is(ConflictCandidate)({ conflictType: "position" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConflictCandidate extends S.Class<ConflictCandidate>($I`ConflictCandidate`)(
  {
    existingClaim: Claims.select,
    conflictType: S.Literals(["position", "temporal"]),
  },
  $I.annote("ConflictCandidate", {
    description: "Persisted claim paired with the authoritative detected conflict kind.",
  })
) {}

/**
 * Joined correction record and the persisted claim identifiers it links.
 *
 * **Example** (Reject an incomplete correction-chain entry)
 *
 * ```ts
 * import { CorrectionChainEntry } from "@effect-ontology/Repository/Claim"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorrectionChainEntry)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorrectionChainEntry extends S.Class<CorrectionChainEntry>($I`CorrectionChainEntry`)(
  {
    correction: Corrections.select,
    originalClaimId: UUID,
    newClaimId: S.OptionFromNullishOr(UUID).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CorrectionChainEntry", {
    description: "Correction metadata joined to its original and optional replacement persisted claim identifiers.",
  })
) {}

const decodeCorrectionChainEntries = (rows: unknown) =>
  S.decodeUnknownEffect(CorrectionChainEntry.pipe(S.Array, S.mutable))(rows).pipe(
    Effect.mapError((cause) => DrizzleError.fromUnknown("decodeRows", cause))
  );

// =============================================================================
// Service
// =============================================================================

type ClaimRepositoryError = DrizzleError;

interface ClaimRepositoryShape {
  readonly insertClaim: (claim: ClaimInsertRow) => Effect.Effect<ClaimRow, ClaimRepositoryError>;
  readonly getClaim: {
    (ontologyId: string): (id: PersistedClaimId) => Effect.Effect<O.Option<ClaimRow>, ClaimRepositoryError>;
    (id: PersistedClaimId, ontologyId: string): Effect.Effect<O.Option<ClaimRow>, ClaimRepositoryError>;
  };
  readonly getClaims: (filter: ClaimFilter) => Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
  readonly getClaimsByArticle: {
    (ontologyId: string): (articleId: ArticleId) => Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
    (articleId: ArticleId, ontologyId: string): Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
  };
  readonly getClaimsBySubject: {
    (ontologyId: string): (subjectIri: string) => Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
    (subjectIri: string, ontologyId: string): Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
  };
  readonly getPreferredClaims: {
    (
      predicateIri: string,
      ontologyId: string
    ): (subjectIri: string) => Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
    (
      subjectIri: string,
      predicateIri: string,
      ontologyId: string
    ): Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
  };
  readonly getClaimHistory: {
    (
      predicateIri: string,
      ontologyId: string
    ): (subjectIri: string) => Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
    (
      subjectIri: string,
      predicateIri: string,
      ontologyId: string
    ): Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
  };
  readonly deprecateClaim: {
    (
      correctionId: PersistedCorrectionId,
      ontologyId: string
    ): (claimId: PersistedClaimId) => Effect.Effect<void, ClaimRepositoryError>;
    (
      claimId: PersistedClaimId,
      correctionId: PersistedCorrectionId,
      ontologyId: string
    ): Effect.Effect<void, ClaimRepositoryError>;
  };
  readonly promoteToPreferred: {
    (ontologyId: string): (claimId: PersistedClaimId) => Effect.Effect<void, ClaimRepositoryError>;
    (claimId: PersistedClaimId, ontologyId: string): Effect.Effect<void, ClaimRepositoryError>;
  };
  readonly insertCorrection: (correction: CorrectionInsertRow) => Effect.Effect<CorrectionRow, ClaimRepositoryError>;
  readonly getCorrection: (id: PersistedCorrectionId) => Effect.Effect<O.Option<CorrectionRow>, ClaimRepositoryError>;
  readonly linkClaimsToCorrection: {
    (
      originalClaimId: PersistedClaimId
    ): (correctionId: PersistedCorrectionId) => Effect.Effect<void, ClaimRepositoryError>;
    (
      correctionId: PersistedCorrectionId,
      originalClaimId: PersistedClaimId,
      newClaimId?: PersistedClaimId
    ): Effect.Effect<void, ClaimRepositoryError>;
  };
  readonly getCorrectionChain: (
    claimId: PersistedClaimId
  ) => Effect.Effect<ReadonlyArray<CorrectionChainEntry>, ClaimRepositoryError>;
  readonly findConflictingClaims: (
    claim: ClaimInsertRow | ClaimRow
  ) => Effect.Effect<ReadonlyArray<ConflictCandidate>, ClaimRepositoryError>;
  readonly insertClaimsBatch: (
    claimList: Array<ClaimInsertRow>
  ) => Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
  readonly upsertClaimsBatch: (
    claimList: Array<ClaimInsertRow>
  ) => Effect.Effect<ReadonlyArray<ClaimRow>, ClaimRepositoryError>;
  readonly countClaims: (filter: ClaimFilter) => Effect.Effect<number, ClaimRepositoryError>;
}

/**
 * Provides repository access for claim repository.
 *
 * **Example** (Inspect the default claim repository layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { ClaimRepository } from "@effect-ontology/Repository/Claim"
 *
 * console.log(Layer.isLayer(ClaimRepository.Default)) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ClaimRepository extends Context.Service<ClaimRepository, ClaimRepositoryShape>()($I`ClaimRepository`, {
  make: Effect.gen(function* () {
    const drizzle = yield* PostgresDrizzle;
    const normalizeQueryError = normalizeDrizzleError("execute");

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
                    const [claimAId, claimBId] = yield* canonicalConflictPair(claim.id, candidate.id);
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
    const insertClaim: ClaimRepositoryShape["insertClaim"] = Effect.fn("insertClaim")(
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
    const getClaim: ClaimRepositoryShape["getClaim"] = dual(
      2,
      Effect.fn("getClaim")(function* (id: PersistedClaimId, ontologyId: string) {
        const [result] = yield* decodeClaimRows(
          yield* normalizeQueryError(
            drizzle
              .select()
              .from(claims)
              .where(and(eq(claims.id, id), eq(claims.ontologyId, ontologyId)))
              .limit(1)
          )
        );
        return O.fromNullishOr(result);
      })
    );

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
    const getClaims: ClaimRepositoryShape["getClaims"] = Effect.fn("getClaims")(function* (filter: ClaimFilter) {
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
      return yield* decodeClaimRows(yield* normalizeQueryError(query));
    });

    // -------------------------------------------------------------------------
    // Query Operations
    // -------------------------------------------------------------------------

    /**
     * Get claims by article
     */
    const getClaimsByArticle: ClaimRepositoryShape["getClaimsByArticle"] = dual(
      2,
      (articleId: ArticleId, ontologyId: string) => getClaims({ articleId, ontologyId, includeDeprecated: false })
    );

    /**
     * Get claims by subject IRI
     */
    const getClaimsBySubject: ClaimRepositoryShape["getClaimsBySubject"] = dual(
      2,
      (subjectIri: string, ontologyId: string) => getClaims({ subjectIri, ontologyId, includeDeprecated: false })
    );

    /**
     * Get preferred claims for a subject + predicate
     */
    const getPreferredClaims: ClaimRepositoryShape["getPreferredClaims"] = dual(
      (args) => args.length >= 2,
      (subjectIri: string, predicateIri: string, ontologyId: string) =>
        getClaims({ subjectIri, predicateIri, ontologyId, rank: "preferred" })
    );

    /**
     * Get all claims for a subject + predicate (including deprecated)
     */
    const getClaimHistory: ClaimRepositoryShape["getClaimHistory"] = dual(
      3,
      (subjectIri: string, predicateIri: string, ontologyId: string) =>
        getClaims({ subjectIri, predicateIri, ontologyId, includeDeprecated: true })
    );

    // -------------------------------------------------------------------------
    // Deprecation & Corrections
    // -------------------------------------------------------------------------

    /**
     * Deprecate a claim due to a correction
     */
    const deprecateClaim: ClaimRepositoryShape["deprecateClaim"] = dual(
      3,
      Effect.fn("deprecateClaim")(function* (
        claimId: PersistedClaimId,
        correctionId: PersistedCorrectionId,
        ontologyId: string
      ) {
        const now = yield* DateTime.now;
        yield* normalizeQueryError(
          drizzle
            .update(claims)
            .set({
              deprecatedAt: DateTime.toDate(now),
              deprecatedBy: correctionId,
              rank: "deprecated",
            })
            .where(and(eq(claims.id, claimId), eq(claims.ontologyId, ontologyId)))
        );
      })
    );

    /**
     * Promote a claim to preferred rank
     */
    const promoteToPreferred: ClaimRepositoryShape["promoteToPreferred"] = dual(
      2,
      (claimId: PersistedClaimId, ontologyId: string) =>
        drizzle
          .update(claims)
          .set({ rank: "preferred" })
          .where(and(eq(claims.id, claimId), eq(claims.ontologyId, ontologyId)))
          .pipe(Effect.asVoid)
    );

    /**
     * Insert a correction
     */
    const insertCorrection: ClaimRepositoryShape["insertCorrection"] = Effect.fn("insertCorrection")(function* (
      correction: CorrectionInsertRow
    ) {
      const [result] = yield* decodeCorrectionRows(
        yield* normalizeQueryError(drizzle.insert(corrections).values(correction).returning())
      );
      return result;
    });

    /**
     * Get correction by ID
     */
    const getCorrection: ClaimRepositoryShape["getCorrection"] = Effect.fn("getCorrection")(function* (
      id: PersistedCorrectionId
    ) {
      const [result] = yield* decodeCorrectionRows(
        yield* normalizeQueryError(drizzle.select().from(corrections).where(eq(corrections.id, id)).limit(1))
      );
      return O.fromNullishOr(result);
    });

    /**
     * Link claims to a correction
     */
    const linkClaimsToCorrection: ClaimRepositoryShape["linkClaimsToCorrection"] = dual(
      3,
      (correctionId: PersistedCorrectionId, originalClaimId: PersistedClaimId, newClaimId?: PersistedClaimId) =>
        drizzle
          .insert(correctionClaims)
          .values({
            correctionId,
            originalClaimId,
            newClaimId: newClaimId ?? null,
          })
          .pipe(Effect.asVoid)
    );

    /**
     * Get correction chain for a claim (all corrections that affected it)
     */
    const getCorrectionChain: ClaimRepositoryShape["getCorrectionChain"] = Effect.fn("getCorrectionChain")(function* (
      claimId: PersistedClaimId
    ) {
      const result = yield* normalizeQueryError(
        drizzle
          .select({
            correction: corrections,
            originalClaimId: correctionClaims.originalClaimId,
            newClaimId: correctionClaims.newClaimId,
          })
          .from(correctionClaims)
          .innerJoin(corrections, eq(correctionClaims.correctionId, corrections.id))
          .where(or(eq(correctionClaims.originalClaimId, claimId), eq(correctionClaims.newClaimId, claimId)))
          .orderBy(desc(corrections.correctionDate))
      );
      return yield* decodeCorrectionChainEntries(result);
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
    const findConflictingClaims: ClaimRepositoryShape["findConflictingClaims"] = (
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
          if (O.isSome(kind)) {
            detected.push(ConflictCandidate.make({ existingClaim: existing, conflictType: kind.value }));
          }
        }

        return detected;
      }).pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)));

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    /**
     * Insert multiple claims in a batch
     */
    const insertClaimsBatch: ClaimRepositoryShape["insertClaimsBatch"] = Effect.fn("insertClaimsBatch")(function* (
      claimList: Array<ClaimInsertRow>
    ) {
      return yield* persistClaimsWithConflicts(claimList, false);
    });

    /**
     * Upsert multiple claims in a batch (idempotent)
     *
     * Uses ON CONFLICT DO NOTHING on the natural key
     * (article_id, subject_iri, predicate_iri, object_value).
     * Returns only the newly inserted claims.
     */
    const upsertClaimsBatch: ClaimRepositoryShape["upsertClaimsBatch"] = Effect.fn("upsertClaimsBatch")(function* (
      claimList: Array<ClaimInsertRow>
    ) {
      return yield* persistClaimsWithConflicts(claimList, true);
    });

    /**
     * Count claims with filters using SQL COUNT
     */
    const countClaims: ClaimRepositoryShape["countClaims"] = Effect.fn("countClaims")(function* (filter: ClaimFilter) {
      const conditions = buildWhereConditions(filter);
      let query = drizzle.select({ count: count() }).from(claims).$dynamic();
      if (A.isReadonlyArrayNonEmpty(conditions)) {
        query = query.where(and(...conditions));
      }
      const [result] = yield* decodeClaimCountRows(yield* normalizeQueryError(query));
      return result.count;
    });

    return {
      // CRUD
      insertClaim: Effect.fn("ClaimRepository.insertClaim")((claim: ClaimInsertRow) =>
        normalizeQueryError(insertClaim(claim))
      ),
      getClaim: dual(
        2,
        Effect.fn("ClaimRepository.getClaim")((id: PersistedClaimId, ontologyId: string) =>
          normalizeQueryError(getClaim(id, ontologyId))
        )
      ),
      getClaims: Effect.fn("ClaimRepository.getClaims")((filter: ClaimFilter) =>
        normalizeQueryError(getClaims(filter))
      ),

      // Queries
      getClaimsByArticle: dual(
        2,
        Effect.fn("ClaimRepository.getClaimsByArticle")((articleId: ArticleId, ontologyId: string) =>
          normalizeQueryError(getClaimsByArticle(articleId, ontologyId))
        )
      ),
      getClaimsBySubject: dual(
        2,
        Effect.fn("ClaimRepository.getClaimsBySubject")((subjectIri: string, ontologyId: string) =>
          normalizeQueryError(getClaimsBySubject(subjectIri, ontologyId))
        )
      ),
      getPreferredClaims: dual(
        3,
        Effect.fn("ClaimRepository.getPreferredClaims")(
          (subjectIri: string, predicateIri: string, ontologyId: string) =>
            normalizeQueryError(getPreferredClaims(subjectIri, predicateIri, ontologyId))
        )
      ),
      getClaimHistory: dual(
        3,
        Effect.fn("ClaimRepository.getClaimHistory")((subjectIri: string, predicateIri: string, ontologyId: string) =>
          normalizeQueryError(getClaimHistory(subjectIri, predicateIri, ontologyId))
        )
      ),

      // Deprecation & Corrections
      deprecateClaim: dual(
        3,
        Effect.fn("ClaimRepository.deprecateClaim")(
          (claimId: PersistedClaimId, correctionId: PersistedCorrectionId, ontologyId: string) =>
            normalizeQueryError(deprecateClaim(claimId, correctionId, ontologyId))
        )
      ),
      promoteToPreferred: dual(
        2,
        Effect.fn("ClaimRepository.promoteToPreferred")((claimId: PersistedClaimId, ontologyId: string) =>
          normalizeQueryError(promoteToPreferred(claimId, ontologyId))
        )
      ),
      insertCorrection: Effect.fn("ClaimRepository.insertCorrection")((correction: CorrectionInsertRow) =>
        normalizeQueryError(insertCorrection(correction))
      ),
      getCorrection: Effect.fn("ClaimRepository.getCorrection")((id: PersistedCorrectionId) =>
        normalizeQueryError(getCorrection(id))
      ),
      linkClaimsToCorrection: dual(
        (args) => args.length >= 2,
        Effect.fn("ClaimRepository.linkClaimsToCorrection")(
          (correctionId: PersistedCorrectionId, originalClaimId: PersistedClaimId, newClaimId?: PersistedClaimId) =>
            normalizeQueryError(linkClaimsToCorrection(correctionId, originalClaimId, newClaimId))
        )
      ),
      getCorrectionChain: Effect.fn("ClaimRepository.getCorrectionChain")((claimId: PersistedClaimId) =>
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
