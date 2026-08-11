/**
 * Claim Persistence Service
 *
 * Encapsulates the persistence logic for claims extracted from documents.
 * Handles article creation, claim-to-row mapping, and idempotent upserts.
 *
 * @since 2.0.0
 * @module Service/ClaimPersistence
 */

import { Effect, Context, Layer } from "effect"
import { ArticleRepository } from "../Repository/Article.ts"
import { ClaimRepository } from "../Repository/Claim.ts"
import type { ClaimInsertRow } from "../Repository/schema.ts"
import type { ClaimData } from "../Utils/ClaimFactory.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/ClaimPersistence");

// =============================================================================
// Types
// =============================================================================

/**
 * Metadata for the source article
 *
 * @since 2.0.0
 * @category Types
 */
export interface ArticleMetadata {
  /** Article URI (unique identifier) */
  readonly uri: string
  /** Ontology ID for namespace scoping */
  readonly ontologyId: string
  /** Article headline */
  readonly headline?: string
  /** When the article was published */
  readonly publishedAt: Date
  /** Source/publisher name */
  readonly sourceName?: string
  /** Content hash for deduplication */
  readonly contentHash?: string
}

/**
 * Result of claim persistence operation
 *
 * @since 2.0.0
 * @category Types
 */
export interface PersistenceResult {
  /** Database ID of the article */
  readonly articleId: string
  /** Number of claims actually inserted (excludes duplicates) */
  readonly claimsInserted: number
  /** Total claims processed */
  readonly claimsTotal: number
}

// =============================================================================
// Service
// =============================================================================

/**
 * Claim Persistence Service
 *
 * Persists extracted claims to PostgreSQL with proper article linking
 * and idempotent upsert handling.
 *
 * @since 2.0.0
 * @category Services
 */
export class ClaimPersistenceService extends Context.Service<ClaimPersistenceService>()(
  $I`ClaimPersistenceService`,
  {
    make: Effect.gen(function*() {
      const claimRepo = yield* ClaimRepository
      const articleRepo = yield* ArticleRepository

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
      const persistClaims =
        Effect.fn(function*(
        claims: ReadonlyArray<ClaimData>,
        articleMeta: ArticleMetadata,
        graphUri?: string
      ): Effect.fn.Return<PersistenceResult> {
          // 1. Get or create article
          const article = yield* articleRepo.getOrCreateArticle({
            uri: articleMeta.uri,
            ontologyId: articleMeta.ontologyId,
            headline: articleMeta.headline,
            publishedAt: articleMeta.publishedAt,
            sourceName: articleMeta.sourceName,
            contentHash: articleMeta.contentHash
          })

          yield* Effect.logDebug("Article resolved for claim persistence", {
            articleId: article.id,
            articleUri: article.uri,
            isNew: !article.graphUri
          })

          // 2. Map ClaimData to ClaimInsertRow
          const claimRows: Array<ClaimInsertRow> = claims.map((claim) => ({
            articleId: article.id,
            ontologyId: articleMeta.ontologyId,
            subjectIri: claim.subjectIri,
            predicateIri: claim.predicateIri,
            objectValue: claim.objectValue,
            objectType: claim.objectType,
            rank: "normal" as const,
            confidenceScore: claim.confidence?.toString(),
            evidenceText: claim.evidence?.text,
            evidenceStartOffset: claim.evidence?.startOffset,
            evidenceEndOffset: claim.evidence?.endOffset,
            validFrom: claim.validFrom,
            validTo: claim.validTo
          }))

          // 3. Upsert claims (idempotent)
          const inserted = yield* claimRepo.upsertClaimsBatch(claimRows)

          yield* Effect.logDebug("Claims upserted", {
            articleId: article.id,
            total: claims.length,
            inserted: inserted.length,
            duplicatesSkipped: claims.length - inserted.length
          })

          // 4. Update article with graph URI if provided
          if (graphUri && !article.graphUri) {
            yield* articleRepo.setGraphUri(article.id, graphUri)
            yield* Effect.logDebug("Article graph URI updated", {
              articleId: article.id,
              graphUri
            })
          }

          return {
            articleId: article.id,
            claimsInserted: inserted.length,
            claimsTotal: claims.length
          }
        })

      return {
        persistClaims
      }
    }),
  }
) {
    static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([ClaimRepository.Default, ArticleRepository.Default]));
}
