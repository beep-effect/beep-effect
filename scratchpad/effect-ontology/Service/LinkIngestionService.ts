/**
 * Service: Link Ingestion Service
 *
 * Orchestrates URL → Storage → Metadata pipeline for link ingestion.
 * Handles fetching via Jina, content-addressed storage, and optional
 * AI enrichment for metadata extraction.
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const ingestion = yield* LinkIngestionService
 *
 *   // Ingest single URL with enrichment
 *   const result = yield* ingestion.ingestUrl("https://example.com/article", {
 *     enrich: true
 *   })
 *   console.log(result.contentHash, result.headline)
 *
 *   // Bulk ingest with parallelism
 *   const results = yield* ingestion.ingestUrls(urls, { concurrency: 5 })
 * })
 * ```
 *
 * @since 2.0.0
 * @module Service/LinkIngestionService
 */

import type { PlatformError } from "effect/PlatformError"
import { PostgresDrizzle } from "@beep/postgres"
import { createHash } from "crypto"
import { and, eq, inArray, sql } from "drizzle-orm"
import { Cache, Data, Duration, Effect, Layer, Option, Context } from "effect"
import type { EnrichedContent } from "../Domain/Model/EnrichedContent.ts"
import { type IngestedLinkInsertRow, type IngestedLinkRow, ingestedLinks } from "../Repository/schema.ts"
import { ContentEnrichmentAgent } from "./ContentEnrichmentAgent.ts"
import { ImageExtractor } from "./ImageExtractor.ts"
import { ImageFetcher } from "./ImageFetcher.ts"
import { ImageStore } from "./ImageStore.ts"
import { JinaReaderClient } from "./JinaReaderClient.ts"
import { StorageService } from "./Storage.ts"
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
const $I = $ScratchpadId.create("effect-ontology/Service/LinkIngestionService");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Failed to ingest URL
 */
export class LinkIngestionError extends Data.TaggedError("LinkIngestionError")<{
  readonly message: string
  readonly url?: string
  readonly phase: "fetch" | "store" | "enrich" | "persist"
  readonly cause?: unknown
}> {}

// =============================================================================
// Types
// =============================================================================

/**
 * Options for ingesting a URL
 */
export interface IngestOptions {
  /** Ontology ID for namespace scoping (required) */
  readonly ontologyId: string
  /** Whether to run AI enrichment (default: true) */
  readonly enrich?: boolean
  /** Whether to extract and store images (default: true) */
  readonly extractImages?: boolean
  /** Source type override (auto-detected if not provided) */
  readonly sourceType?: string
  /** Additional metadata to store */
  readonly metadata?: Record<string, unknown>
  /** Skip if content hash already exists */
  readonly skipDuplicates?: boolean
}

/**
 * Result of ingesting a URL
 */
export interface IngestResult {
  /** Database ID of ingested link */
  readonly id: string
  /** SHA-256 hash of content */
  readonly contentHash: string
  /** Storage URI for content */
  readonly storageUri: string
  /** Enriched headline (if enrichment ran) */
  readonly headline?: string
  /** Whether this was a duplicate (skipped) */
  readonly duplicate: boolean
  /** Word count */
  readonly wordCount?: number
  /** Number of images extracted and stored */
  readonly imageCount?: number
}

/**
 * Options for bulk ingestion
 */
export interface BulkIngestOptions extends IngestOptions {
  /** Concurrency limit (default: 5) */
  readonly concurrency?: number
  /** Continue on individual failures */
  readonly continueOnError?: boolean
}

/**
 * Filter for listing ingested links
 */
export interface IngestedLinkFilter {
  readonly ontologyId?: string
  readonly status?: string
  readonly sourceType?: string
  readonly organization?: string
  readonly limit?: number
  readonly offset?: number
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Compute SHA-256 hash of content
 */
const computeContentHash = (content: string): string => createHash("sha256").update(content).digest("hex")

/**
 * Build storage path for document
 */
const buildStoragePath = (contentHash: string): string => `documents/${contentHash}/content.md`

// =============================================================================
// Service
// =============================================================================

// =============================================================================
// Cache Configuration
// =============================================================================

const CONTENT_HASH_CACHE_CAPACITY = 50_000
const CONTENT_HASH_CACHE_TTL = Duration.days(7) // Content hashes are immutable

export class LinkIngestionService extends Context.Service<LinkIngestionService>()(
  $I`LinkIngestionService`,
  {
    make: Effect.gen(function*() {
      const jina = yield* JinaReaderClient
      const storage = yield* StorageService
      const enricher = yield* ContentEnrichmentAgent
      const drizzle = yield* PostgresDrizzle
      const imageExtractor = yield* ImageExtractor
      const imageFetcher = yield* ImageFetcher
      const imageStore = yield* ImageStore

      // Raw DB lookup for content hash within an ontology (used by cache)
      // Uses composite key: "ontologyId:hash" for cache lookup
      const lookupByContentHash = (compositeKey: string): Effect.Effect<Option.Option<IngestedLinkRow>> =>
        Effect.gen(function*() {
          const [ontologyId, hash] = compositeKey.split(":", 2)
          if (!ontologyId || !hash) {
            return Option.none()
          }
          const [result] = yield* Effect.promise(() =>
            drizzle.select().from(ingestedLinks)
              .where(and(
                eq(ingestedLinks.ontologyId, ontologyId),
                eq(ingestedLinks.contentHash, hash)
              ))
              .limit(1)
          )
          return Option.fromNullishOr(result)
        })

      // Content hash cache with long TTL (immutable content)
      // Cache key format: "ontologyId:contentHash"
      const contentHashCache = yield* Cache.make({
        capacity: CONTENT_HASH_CACHE_CAPACITY,
        timeToLive: CONTENT_HASH_CACHE_TTL,
        lookup: lookupByContentHash
      })

      // -----------------------------------------------------------------------
      // Core Ingestion
      // -----------------------------------------------------------------------

      /**
       * Ingest a single URL
       */
      const ingestUrl = (
        url: string,
        options: IngestOptions
      ): Effect.Effect<IngestResult, LinkIngestionError> =>
        Effect.gen(function*() {
          const {
            enrich = true,
            extractImages = true,
            metadata = {},
            ontologyId,
            skipDuplicates = true,
            sourceType
          } = options

          // 1. Fetch content via Jina
          const jinaResponse = yield* jina.fetchUrl(url).pipe(
            Effect.mapError((error) =>
              new LinkIngestionError({
                message: `Failed to fetch URL: ${error.message}`,
                url,
                phase: "fetch",
                cause: error
              })
            )
          )

          const { content } = jinaResponse

          // 2. Compute content hash
          const contentHash = computeContentHash(content.content)

          // 3. Check for duplicate (scoped by ontology)
          if (skipDuplicates) {
            const existing = yield* getByContentHash(ontologyId, contentHash)
            if (Option.isSome(existing)) {
              return {
                id: existing.value.id,
                contentHash,
                storageUri: existing.value.storageUri,
                headline: existing.value.headline ?? undefined,
                duplicate: true,
                wordCount: existing.value.wordCount ?? undefined
              }
            }
          }

          // 4. Store content
          const storagePath = buildStoragePath(contentHash)
          yield* storage.set(storagePath, content.content).pipe(
            Effect.mapError((error) =>
              new LinkIngestionError({
                message: `Failed to store content: ${error}`,
                url,
                phase: "store",
                cause: error
              })
            )
          )

          // 4.1. Extract and store images (if enabled)
          let imageCount = 0
          if (extractImages) {
            // Extract image candidates from Jina response
            const imageCandidates = imageExtractor.extractFromJina(content)

            if (imageCandidates.length > 0) {
              yield* Effect.logDebug(`Found ${imageCandidates.length} image candidates`, { url })

              // Fetch images in parallel (failures logged, don't fail ingestion)
              const fetchedImages = yield* imageFetcher.fetchAll(imageCandidates)

              // Store images and create references
              imageCount = fetchedImages.length

              // Store images and add references in parallel (failures logged, don't fail ingestion)
              yield* Effect.forEach(
                fetchedImages,
                (fetchResult) =>
                  Effect.gen(function*() {
                    // Store the image asset
                    yield* imageStore.storeImage(
                      fetchResult.hash,
                      fetchResult.bytes,
                      fetchResult.contentType,
                      fetchResult.candidate.sourceUrl
                    )

                    // Add reference to link's image manifest
                    yield* imageStore.addImageRef({
                      ownerType: "link",
                      ownerId: contentHash, // Using contentHash as stable ID
                      assetHash: fetchResult.hash,
                      alt: fetchResult.candidate.alt,
                      caption: fetchResult.candidate.caption,
                      position: fetchResult.candidate.order,
                      role: O.some(fetchResult.candidate.role)
                    })
                  }).pipe(
                    Effect.catch((error) =>
                      Effect.logWarning("Failed to store image, continuing", {
                        url: fetchResult.candidate.sourceUrl,
                        error: String(error)
                      })
                    )
                  ),
                { concurrency: 5, discard: true }
              )

              yield* Effect.logInfo(`Stored ${imageCount} images for link`, { url, imageCount })
            }
          }

          // 5. Optionally enrich metadata
          let enrichedContent: EnrichedContent | undefined
          if (enrich) {
            const enrichResult = yield* enricher.enrichFromJina(content).pipe(
              Effect.catch((error) =>
                Effect.gen(function*() {
                  yield* Effect.logWarning("Enrichment failed, continuing without metadata", {
                    url,
                    error: error.message
                  })
                  return undefined
                })
              )
            )
            enrichedContent = enrichResult
          }

          // 6. Persist to database
          const wordCount = content.wordCount
          const insertRow: IngestedLinkInsertRow = {
            contentHash,
            ontologyId,
            sourceUri: url,
            sourceType: sourceType ?? enrichedContent?.sourceType ?? "unknown",
            headline: enrichedContent?.headline ?? content.title,
            description: enrichedContent?.description ?? content.description ?? null,
            publishedAt: enrichedContent?.publishedAt ?? null,
            author: enrichedContent?.author ?? null,
            organization: enrichedContent?.organization ?? content.siteName ?? null,
            language: enrichedContent?.language ?? "en",
            topics: [...(enrichedContent?.topics ?? [])],
            keyEntities: [...(enrichedContent?.keyEntities ?? [])],
            storageUri: storagePath,
            status: enrich && enrichedContent ? "enriched" : "pending",
            enrichedAt: enrichedContent ? new Date() : null,
            wordCount,
            metadata
          }

          const [inserted] = yield* Effect.promise(() => drizzle.insert(ingestedLinks).values(insertRow).returning())
            .pipe(
              Effect.mapError((error) =>
                new LinkIngestionError({
                  message: `Failed to persist link: ${error}`,
                  url,
                  phase: "persist",
                  cause: error
                })
              )
            )

          return {
            id: inserted.id,
            contentHash,
            storageUri: storagePath,
            headline: enrichedContent?.headline,
            duplicate: false,
            wordCount,
            imageCount: imageCount > 0 ? imageCount : undefined
          }
        })

      /**
       * Ingest multiple URLs with concurrency control
       */
      const ingestUrls = (
        urls: ReadonlyArray<string>,
        options: BulkIngestOptions
      ): Effect.Effect<ReadonlyArray<IngestResult | LinkIngestionError>, LinkIngestionError> =>
        Effect.gen(function*() {
          const {
            concurrency = 5,
            continueOnError = true,
            ...ingestOptions
          } = options

          const results = yield* Effect.forEach(
            urls,
            (url) =>
              ingestUrl(url, ingestOptions).pipe(
                Effect.map((result): IngestResult | LinkIngestionError => result),
                Effect.catch((error): Effect.Effect<IngestResult | LinkIngestionError, LinkIngestionError> =>
                  continueOnError
                    ? Effect.succeed(error)
                    : Effect.fail(error)
                )
              ),
            { concurrency }
          )

          return results
        })

      // -----------------------------------------------------------------------
      // Queries
      // -----------------------------------------------------------------------

      /**
       * Get ingested link by content hash within an ontology (cached)
       */
      const getByContentHash = (ontologyId: string, hash: string): Effect.Effect<Option.Option<IngestedLinkRow>> =>
        contentHashCache.get(`${ontologyId}:${hash}`)

      /**
       * Get ingested link by ID
       */
      const getById = (id: string): Effect.Effect<Option.Option<IngestedLinkRow>> =>
        Effect.gen(function*() {
          const [result] = yield* Effect.promise(() =>
            drizzle.select().from(ingestedLinks).where(eq(ingestedLinks.id, id)).limit(1)
          )
          return Option.fromNullishOr(result)
        })

      /**
       * List ingested links with filters
       */
      const list = (filter: IngestedLinkFilter = {}): Effect.Effect<ReadonlyArray<IngestedLinkRow>> =>
        Effect.gen(function*() {
          let query = drizzle.select().from(ingestedLinks)

          // Apply filters
          if (filter.ontologyId) {
            query = query.where(eq(ingestedLinks.ontologyId, filter.ontologyId)) as typeof query
          }
          if (filter.status) {
            query = query.where(eq(ingestedLinks.status, filter.status)) as typeof query
          }
          if (filter.sourceType) {
            query = query.where(eq(ingestedLinks.sourceType, filter.sourceType)) as typeof query
          }
          if (filter.organization) {
            query = query.where(eq(ingestedLinks.organization, filter.organization)) as typeof query
          }

          // Apply pagination
          if (filter.limit) {
            query = query.limit(filter.limit) as typeof query
          }
          if (filter.offset) {
            query = query.offset(filter.offset) as typeof query
          }

          return yield* Effect.promise(() => query)
        })

      /**
       * Get pending links ready for extraction
       */
      const getPending = (limit: number = 100): Effect.Effect<ReadonlyArray<IngestedLinkRow>> =>
        list({ status: "pending", limit })

      /**
       * Get enriched links ready for extraction
       */
      const getEnriched = (limit: number = 100): Effect.Effect<ReadonlyArray<IngestedLinkRow>> =>
        list({ status: "enriched", limit })

      // -----------------------------------------------------------------------
      // Status Updates
      // -----------------------------------------------------------------------

      /**
       * Mark link as processed
       */
      const markProcessed = (id: string): Effect.Effect<Option.Option<IngestedLinkRow>> =>
        Effect.gen(function*() {
          const [result] = yield* Effect.promise(() =>
            drizzle
              .update(ingestedLinks)
              .set({ status: "processed", processedAt: new Date(), updatedAt: new Date() })
              .where(eq(ingestedLinks.id, id))
              .returning()
          )
          return Option.fromNullishOr(result)
        })

      /**
       * Mark link as failed
       */
      const markFailed = (id: string, errorMessage: string): Effect.Effect<Option.Option<IngestedLinkRow>> =>
        Effect.gen(function*() {
          const [result] = yield* Effect.promise(() =>
            drizzle
              .update(ingestedLinks)
              .set({ status: "failed", errorMessage, updatedAt: new Date() })
              .where(eq(ingestedLinks.id, id))
              .returning()
          )
          return Option.fromNullishOr(result)
        })

      /**
       * Mark a link as being processed by a batch
       *
       * Updates the link status to "processing".
       * The link-to-batch association is tracked in the link_batch_items table.
       */
      const markProcessing = (id: string): Effect.Effect<Option.Option<IngestedLinkRow>> =>
        Effect.gen(function*() {
          const [result] = yield* Effect.promise(() =>
            drizzle
              .update(ingestedLinks)
              .set({
                status: "processing",
                updatedAt: new Date()
              })
              .where(eq(ingestedLinks.id, id))
              .returning()
          )
          return Option.fromNullishOr(result)
        })

      /**
       * Get multiple links by their IDs
       */
      const getByIds = (ids: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<IngestedLinkRow>> =>
        Effect.gen(function*() {
          if (ids.length === 0) return []
          const results = yield* Effect.promise(() =>
            drizzle.select().from(ingestedLinks).where(
              inArray(ingestedLinks.id, ids as string[])
            )
          )
          return results
        })

      /**
       * Get content from storage for a link
       */
      const getContent = (link: IngestedLinkRow): Effect.Effect<Option.Option<string>, PlatformError> =>
        // StorageService.get returns Option<string> (already decoded)
        storage.get(link.storageUri)

      /**
       * Re-enrich a pending/failed link
       *
       * Retrieves content from storage and runs enrichment again,
       * updating the database with new metadata.
       */
      const reEnrich = (id: string): Effect.Effect<Option.Option<IngestedLinkRow>, LinkIngestionError> =>
        Effect.gen(function*() {
          // 1. Get link by ID
          const linkOpt = yield* getById(id)
          if (Option.isNone(linkOpt)) {
            return Option.none()
          }
          const link = linkOpt.value

          // 2. Get content from storage
          const sourceUrl = link.sourceUri ?? undefined
          const contentOpt = yield* getContent(link).pipe(
            Effect.mapError((error) =>
              new LinkIngestionError({
                message: `Failed to retrieve content: ${error}`,
                url: sourceUrl,
                phase: "fetch",
                cause: error
              })
            )
          )

          if (Option.isNone(contentOpt)) {
            return yield* Effect.fail(
              new LinkIngestionError({
                message: `Content not found in storage at ${link.storageUri}`,
                url: sourceUrl,
                phase: "fetch"
              })
            )
          }

          const content = contentOpt.value

          // 3. Run enrichment
          const enrichedContent = yield* enricher.enrich(content, sourceUrl).pipe(
            Effect.mapError((error) =>
              new LinkIngestionError({
                message: `Enrichment failed: ${error.message}`,
                url: sourceUrl,
                phase: "enrich",
                cause: error
              })
            )
          )

          // 4. Update database
          const [updated] = yield* Effect.promise(() =>
            drizzle
              .update(ingestedLinks)
              .set({
                headline: enrichedContent.headline ?? link.headline,
                description: enrichedContent.description ?? link.description,
                publishedAt: enrichedContent.publishedAt ?? link.publishedAt,
                author: enrichedContent.author ?? link.author,
                organization: enrichedContent.organization ?? link.organization,
                language: enrichedContent.language ?? link.language,
                topics: enrichedContent.topics.length > 0 ? [...enrichedContent.topics] : link.topics,
                keyEntities: enrichedContent.keyEntities.length > 0
                  ? [...enrichedContent.keyEntities]
                  : link.keyEntities,
                sourceType: enrichedContent.sourceType ?? link.sourceType,
                status: "enriched",
                enrichedAt: new Date(),
                errorMessage: null,
                updatedAt: new Date()
              })
              .where(eq(ingestedLinks.id, id))
              .returning()
          ).pipe(
            Effect.mapError((error) =>
              new LinkIngestionError({
                message: `Failed to update link: ${error}`,
                url: sourceUrl,
                phase: "persist",
                cause: error
              })
            )
          )

          return Option.fromNullishOr(updated)
        })

      /**
       * Clean up stale links that have been pending/processing for too long
       *
       * Marks them as "failed" so they can be retried via re-enrich.
       *
       * @param olderThanMinutes - Links pending/processing longer than this will be marked failed
       * @param ontologyId - Optional ontology scope
       * @returns Count of cleaned up links
       */
      const cleanupStaleLinks = (
        olderThanMinutes: number,
        ontologyId?: string
      ): Effect.Effect<{ cleaned: number }, LinkIngestionError> =>
        Effect.gen(function*() {
          const cutoffDate = new Date(Date.now() - olderThanMinutes * 60 * 1000)

          // Build condition: status in (pending, processing) AND updatedAt < cutoff
          const baseCondition = and(
            sql`${ingestedLinks.status} IN ('pending', 'processing')`,
            sql`${ingestedLinks.updatedAt} < ${cutoffDate}`
          )

          // Add ontology filter if provided
          const condition = ontologyId
            ? and(baseCondition, eq(ingestedLinks.ontologyId, ontologyId))
            : baseCondition

          const results = yield* Effect.promise(() =>
            drizzle
              .update(ingestedLinks)
              .set({
                status: "failed",
                errorMessage: `Stale: not processed within ${olderThanMinutes} minutes`,
                updatedAt: new Date()
              })
              .where(condition!)
              .returning({ id: ingestedLinks.id })
          ).pipe(
            Effect.mapError((error) =>
              new LinkIngestionError({
                message: `Failed to cleanup stale links: ${error}`,
                phase: "persist",
                cause: error
              })
            )
          )

          if (results.length > 0) {
            yield* Effect.logInfo("Cleaned up stale links", {
              count: results.length,
              olderThanMinutes,
              ontologyId
            })
          }

          return { cleaned: results.length }
        })

      return {
        ingestUrl,
        ingestUrls,
        getByContentHash,
        getById,
        getByIds,
        list,
        getPending,
        getEnriched,
        markProcessed,
        markProcessing,
        markFailed,
        getContent,
        reEnrich,
        cleanupStaleLinks
      }
    }),
  }
) {
  /**
   * Disabled layer for when PostgreSQL is not configured.
   * All methods fail with a descriptive error indicating Postgres is required.
   */
  static readonly Disabled: Layer.Layer<LinkIngestionService> = Layer.succeed(
    LinkIngestionService,
    {
      ingestUrl: () =>
        Effect.fail(
          new LinkIngestionError({
            message: "LinkIngestionService requires PostgreSQL. Configure POSTGRES_HOST.",
            phase: "fetch"
          })
        ),
      ingestUrls: () =>
        Effect.fail(
          new LinkIngestionError({
            message: "LinkIngestionService requires PostgreSQL. Configure POSTGRES_HOST.",
            phase: "fetch"
          })
        ),
      getByContentHash: () => Effect.succeed(Option.none()),
      getById: () => Effect.succeed(Option.none()),
      getByIds: () => Effect.succeed([]),
      list: () => Effect.succeed([]),
      getPending: () => Effect.succeed([]),
      getEnriched: () => Effect.succeed([]),
      markProcessed: () => Effect.succeed(Option.none()),
      markProcessing: () => Effect.succeed(Option.none()),
      markFailed: () => Effect.succeed(Option.none()),
      getContent: () => Effect.succeed(Option.none()),
      reEnrich: () =>
        Effect.fail(
          new LinkIngestionError({
            message: "LinkIngestionService requires PostgreSQL. Configure POSTGRES_HOST.",
            phase: "enrich"
          })
        ),
      cleanupStaleLinks: () =>
        Effect.fail(
          new LinkIngestionError({
            message: "LinkIngestionService requires PostgreSQL. Configure POSTGRES_HOST.",
            phase: "persist"
          })
        )
    } as unknown as LinkIngestionService
  )
    static readonly Default = Layer.effect(this, this.make);
}
