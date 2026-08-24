/**
 * Claim Persistence Service
 *
 * **Details**
 *
 * Encapsulates the persistence logic for claims extracted from documents.
 * Handles article creation, claim-to-row mapping, and idempotent upserts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { Context, Effect, Layer } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ArticleRepository } from "../Repository/Article.ts";
import { ClaimRepository } from "../Repository/Claim.ts";
import type { ClaimInsertRow } from "../Repository/schema.ts";
import type { ClaimData } from "../Utils/ClaimFactory.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ClaimPersistence");

// =============================================================================
// Types
// =============================================================================

/**
 * Metadata for the source article
 *
 *
 * **Example** (Use the ArticleMetadata contract)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArticleMetadata } from "@effect-ontology/Service/ClaimPersistence"
 *
 * console.log(S.is(ArticleMetadata)({})) // false
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class ArticleMetadata extends S.Class<ArticleMetadata>($I`ArticleMetadata`)(
  {
    uri: S.NonEmptyString,
    ontologyId: S.NonEmptyString,
    headline: S.optionalKey(S.String),
    publishedAt: S.Date,
    sourceName: S.optionalKey(S.NonEmptyString),
    contentHash: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("ArticleMetadata", {
    description: "Validated article identity, publication time, and optional source metadata.",
  })
) {}

/**
 * Result of claim persistence operation
 *
 *
 * **Example** (Use the PersistenceResult contract)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PersistenceResult } from "@effect-ontology/Service/ClaimPersistence"
 *
 * console.log(S.is(PersistenceResult)({})) // false
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class PersistenceResult extends S.Class<PersistenceResult>($I`PersistenceResult`)(
  {
    articleId: S.NonEmptyString,
    claimsInserted: NonNegativeInt,
    claimsTotal: NonNegativeInt,
  },
  $I.annote("PersistenceResult", {
    description: "Article identifier and non-negative claim persistence counts.",
  })
) {}

// =============================================================================
// Service
// =============================================================================

/**
 * Claim Persistence Service
 *
 * **Details**
 *
 * Persists extracted claims to PostgreSQL with proper article linking
 * and idempotent upsert handling.
 *
 * **Example** (Inspect claim persistence service)
 *
 * ```ts
 * import { ClaimPersistenceService } from "@effect-ontology/Service/ClaimPersistence"
 *
 * console.log(ClaimPersistenceService)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class ClaimPersistenceService extends Context.Service<ClaimPersistenceService>()($I`ClaimPersistenceService`, {
  make: Effect.gen(function* () {
    const claimRepo = yield* ClaimRepository;
    const articleRepo = yield* ArticleRepository;

    /**
     * Persist claims to the database
     *
     * 1. Creates or retrieves the article record
     * 2. Maps ClaimData to ClaimInsertRow format
     * 3. Upserts claims (idempotent - skips duplicates)
     * 4. Updates article with graph URI
     *
     * @param claims - Claims to persist
     * @param articleMeta - Source article metadata
     * @param graphUri - URI of the RDF graph file (optional)
     * @returns Persistence result with article ID and insert count
     */
    const persistClaims = Effect.fn("ClaimPersistence.persistClaims")(function* (
      claims: ReadonlyArray<ClaimData>,
      articleMeta: ArticleMetadata,
      graphUri?: string
    ) {
      // 1. Get or create article
      const article = yield* articleRepo.getOrCreateArticle({
        uri: articleMeta.uri,
        ontologyId: articleMeta.ontologyId,
        headline: articleMeta.headline,
        publishedAt: articleMeta.publishedAt,
        sourceName: articleMeta.sourceName,
        contentHash: articleMeta.contentHash,
      });

      yield* Effect.logDebug("Article resolved for claim persistence", {
        articleId: article.id,
        articleUri: article.uri,
        isNew: P.isNull(article.graphUri),
      });

      // 2. Map ClaimData to ClaimInsertRow
      const claimRows: Array<ClaimInsertRow> = claims.map((claim) => ({
        articleId: article.id,
        ontologyId: articleMeta.ontologyId,
        subjectIri: claim.subjectIri,
        predicateIri: claim.predicateIri,
        objectValue: claim.objectValue,
        objectType: claim.objectType,
        rank: "normal",
        confidenceScore: claim.confidence?.toString(),
        evidenceText: claim.evidence?.text,
        evidenceStartOffset: claim.evidence?.startOffset,
        evidenceEndOffset: claim.evidence?.endOffset,
        validFrom: claim.validFrom,
        validTo: claim.validTo,
      }));

      // 3. Upsert claims (idempotent)
      const inserted = yield* claimRepo.upsertClaimsBatch(claimRows);

      yield* Effect.logDebug("Claims upserted", {
        articleId: article.id,
        total: claims.length,
        inserted: inserted.length,
        duplicatesSkipped: claims.length - inserted.length,
      });

      // 4. Update article with graph URI if provided
      if (P.isNotUndefined(graphUri) && P.isNull(article.graphUri)) {
        yield* articleRepo.setGraphUri(article.id, articleMeta.ontologyId, graphUri);
        yield* Effect.logDebug("Article graph URI updated", {
          articleId: article.id,
          graphUri,
        });
      }

      return {
        articleId: article.id,
        claimsInserted: inserted.length,
        claimsTotal: claims.length,
      };
    });

    return {
      persistClaims,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([ClaimRepository.Default, ArticleRepository.Default])
  );
}
