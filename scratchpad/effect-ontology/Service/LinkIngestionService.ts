/**
 * Service: Link Ingestion Service
 *
 * **Details**
 *
 * Orchestrates URL → Storage → Metadata pipeline for link ingestion.
 * Handles fetching via Jina, content-addressed storage, and optional
 * AI enrichment for metadata extraction.
 *
 * **Example** (Inspect the ingestion layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { LinkIngestionService } from "@effect-ontology/Service/LinkIngestionService"
 *
 * console.log(Layer.isLayer(LinkIngestionService.Default)) // true
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $ScratchpadId } from "@beep/identity";
import { PostgresDrizzle } from "@beep/postgres";
import { and, eq, inArray, lt } from "drizzle-orm";
import { Cache, Clock, Context, DateTime, Duration, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { EnrichedContent } from "../Domain/Model/EnrichedContent.ts";
import type { IngestedLinkInsertRow, IngestedLinkRow } from "../Repository/schema.ts";
import { ingestedLinks } from "../Repository/schema.ts";
import { ContentEnrichmentAgent } from "./ContentEnrichmentAgent.ts";
import { ImageExtractor } from "./ImageExtractor.ts";
import { ImageFetcher } from "./ImageFetcher.ts";
import { ImageStore } from "./ImageStore.ts";
import { JinaReaderClient } from "./JinaReaderClient.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/LinkIngestionService");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Failed to ingest URL
 *
 * **Example** (Inspect link ingestion error)
 *
 * ```ts
 * import { LinkIngestionError } from "@effect-ontology/Service/LinkIngestionService"
 *
 * console.log(LinkIngestionError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LinkIngestionError extends S.TaggedError<LinkIngestionError>($I`LinkIngestionError`)(
  "LinkIngestionError",
  {
    message: S.String,
    url: S.optionalKey(S.String),
    phase: S.Literals(["fetch", "store", "enrich", "persist"]),
    cause: S.optionalKey(S.Defect()),
  }
) {
  static readonly is = S.is(LinkIngestionError);
}

// =============================================================================
// Types
// =============================================================================

/**
 * Options for ingesting a URL
 *
 *
 * **Example** (Use the IngestOptions contract)
 *
 * ```ts
 * import type { IngestOptions } from "@effect-ontology/Service/LinkIngestionService"
 *
 * const acceptsIngestOptions = (_value: IngestOptions): void => undefined
 *
 * console.log(acceptsIngestOptions)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface IngestOptions {
  /** Ontology ID for namespace scoping (required) */
  readonly ontologyId: string;
  /** Whether to run AI enrichment (default: true) */
  readonly enrich?: boolean;
  /** Whether to extract and store images (default: true) */
  readonly extractImages?: boolean;
  /** Source type override (auto-detected if not provided) */
  readonly sourceType?: string;
  /** Additional metadata to store */
  readonly metadata?: Record<string, unknown>;
  /** Skip if content hash already exists */
  readonly skipDuplicates?: boolean;
}

/**
 * Result of ingesting a URL
 *
 *
 * **Example** (Use the IngestResult contract)
 *
 * ```ts
 * import type { IngestResult } from "@effect-ontology/Service/LinkIngestionService"
 *
 * const acceptsIngestResult = (_value: IngestResult): void => undefined
 *
 * console.log(acceptsIngestResult)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface IngestResult {
  /** Database ID of ingested link */
  readonly id: string;
  /** SHA-256 hash of content */
  readonly contentHash: string;
  /** Storage URI for content */
  readonly storageUri: string;
  /** Enriched headline (if enrichment ran) */
  readonly headline?: string;
  /** Whether this was a duplicate (skipped) */
  readonly duplicate: boolean;
  /** Word count */
  readonly wordCount?: number;
  /** Number of images extracted and stored */
  readonly imageCount?: number;
}

/**
 * Options for bulk ingestion
 *
 *
 * **Example** (Use the BulkIngestOptions contract)
 *
 * ```ts
 * import type { BulkIngestOptions } from "@effect-ontology/Service/LinkIngestionService"
 *
 * const acceptsBulkIngestOptions = (_value: BulkIngestOptions): void => undefined
 *
 * console.log(acceptsBulkIngestOptions)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface BulkIngestOptions extends IngestOptions {
  /** Concurrency limit (default: 5) */
  readonly concurrency?: number;
  /** Continue on individual failures */
  readonly continueOnError?: boolean;
}

/**
 * Filter for listing ingested links
 *
 *
 * **Example** (Use the IngestedLinkFilter contract)
 *
 * ```ts
 * import type { IngestedLinkFilter } from "@effect-ontology/Service/LinkIngestionService"
 *
 * const acceptsIngestedLinkFilter = (_value: IngestedLinkFilter): void => undefined
 *
 * console.log(acceptsIngestedLinkFilter)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface IngestedLinkFilter {
  readonly ontologyId?: string;
  readonly status?: string;
  readonly sourceType?: string;
  readonly organization?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Compute SHA-256 hash of content
 */
const computeContentHash = (content: string): string => createHash("sha256").update(content).digest("hex");

/**
 * Build storage path for document
 */
const buildStoragePath = (contentHash: string): string => `documents/${contentHash}/content.md`;

// =============================================================================
// Service
// =============================================================================

// =============================================================================
// Cache Configuration
// =============================================================================

const CONTENT_HASH_CACHE_CAPACITY = 50_000;
const CONTENT_HASH_CACHE_TTL = Duration.days(7); // Content hashes are immutable

/**
 * Provides the link ingestion service service capability.
 *
 * **Example** (Inspect link ingestion service)
 *
 * ```ts
 * import { LinkIngestionService } from "@effect-ontology/Service/LinkIngestionService"
 *
 * console.log(LinkIngestionService)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class LinkIngestionService extends Context.Service<LinkIngestionService>()($I`LinkIngestionService`, {
  make: Effect.gen(function* () {
    const jina = yield* JinaReaderClient;
    const storage = yield* StorageService;
    const enricher = yield* ContentEnrichmentAgent;
    const drizzle = yield* PostgresDrizzle;
    const imageExtractor = yield* ImageExtractor;
    const imageFetcher = yield* ImageFetcher;
    const imageStore = yield* ImageStore;

    // Raw DB lookup for content hash within an ontology (used by cache)
    // Uses composite key: "ontologyId:hash" for cache lookup
    const lookupByContentHash = Effect.fn("lookupByContentHash")(function* (compositeKey: string) {
      const [ontologyId, hash] = A.take(Str.split(":")(compositeKey), 2);
      if (P.not(P.isTruthy)(ontologyId) || P.not(P.isTruthy)(hash)) {
        return O.none();
      }
      const [result] = yield* drizzle
        .select()
        .from(ingestedLinks)
        .where(and(eq(ingestedLinks.ontologyId, ontologyId), eq(ingestedLinks.contentHash, hash)))
        .limit(1);
      return O.fromNullishOr(result);
    });

    // Content hash cache with long TTL (immutable content)
    // Cache key format: "ontologyId:contentHash"
    const contentHashCache = yield* Cache.make({
      capacity: CONTENT_HASH_CACHE_CAPACITY,
      timeToLive: CONTENT_HASH_CACHE_TTL,
      lookup: lookupByContentHash,
    });

    // -----------------------------------------------------------------------
    // Core Ingestion
    // -----------------------------------------------------------------------

    /**
     * Ingest a single URL
     */
    const ingestUrl = Effect.fn(function* (
      url: string,
      options: IngestOptions
    ): Effect.fn.Return<IngestResult, LinkIngestionError> {
      const {
        enrich = true,
        extractImages = true,
        metadata = {},
        ontologyId,
        skipDuplicates = true,
        sourceType,
      } = options;

      // 1. Fetch content via Jina
      const jinaResponse = yield* jina.fetchUrl(url).pipe(
        Effect.mapError((error) =>
          LinkIngestionError.make({
            message: `Failed to fetch URL: ${error.message}`,
            url,
            phase: "fetch",
            cause: error,
          })
        )
      );

      const { content } = jinaResponse;

      // 2. Compute content hash
      const contentHash = computeContentHash(content.content);

      // 3. Check for duplicate (scoped by ontology)
      if (skipDuplicates) {
        const existing = yield* getByContentHash(ontologyId, contentHash);
        if (O.isSome(existing)) {
          return {
            id: existing.value.id,
            contentHash,
            storageUri: existing.value.storageUri,
            duplicate: true,
            ...(P.isNotNull(existing.value.headline) ? { headline: existing.value.headline } : {}),
            ...(P.isNotNull(existing.value.wordCount) ? { wordCount: existing.value.wordCount } : {}),
          };
        }
      }

      // 4. Store content
      const storagePath = buildStoragePath(contentHash);
      yield* storage.set(storagePath, content.content).pipe(
        Effect.mapError((error) =>
          LinkIngestionError.make({
            message: `Failed to store content: ${error}`,
            url,
            phase: "store",
            cause: error,
          })
        )
      );

      // 4.1. Extract and store images (if enabled)
      let imageCount = 0;
      if (extractImages) {
        // Extract image candidates from Jina response
        const imageCandidates = imageExtractor.extractFromJina(content);

        if (imageCandidates.length > 0) {
          yield* Effect.logDebug(`Found ${imageCandidates.length} image candidates`, { url });

          // Fetch images in parallel (failures logged, don't fail ingestion)
          const fetchedImages = yield* imageFetcher.fetchAll(imageCandidates);

          // Store images and create references
          imageCount = fetchedImages.length;

          // Store images and add references in parallel (failures logged, don't fail ingestion)
          yield* Effect.forEach(
            fetchedImages,
            (fetchResult) =>
              Effect.gen(function* () {
                // Store the image asset
                yield* imageStore.storeImage(
                  fetchResult.hash,
                  fetchResult.bytes,
                  fetchResult.contentType,
                  fetchResult.candidate.sourceUrl
                );

                // Add reference to link's image manifest
                yield* imageStore.addImageRef({
                  ownerType: "link",
                  ownerId: contentHash, // Using contentHash as stable ID
                  assetHash: fetchResult.hash,
                  alt: fetchResult.candidate.alt,
                  caption: fetchResult.candidate.caption,
                  position: fetchResult.candidate.order,
                  context: O.none(),
                  role: O.some(fetchResult.candidate.role),
                });
              }).pipe(
                Effect.catch((error) =>
                  Effect.logWarning("Failed to store image, continuing", {
                    url: fetchResult.candidate.sourceUrl,
                    error: String(error),
                  })
                )
              ),
            { concurrency: 5, discard: true }
          );

          yield* Effect.logInfo(`Stored ${imageCount} images for link`, { url, imageCount });
        }
      }

      // 5. Optionally enrich metadata
      let enrichedContent: EnrichedContent | undefined;
      if (enrich) {
        const enrichResult = yield* enricher.enrichFromJina(content).pipe(
          Effect.catch((error) =>
            Effect.gen(function* () {
              yield* Effect.logWarning("Enrichment failed, continuing without metadata", {
                url,
                error: error.message,
              });
              return undefined;
            })
          )
        );
        enrichedContent = enrichResult;
      }

      // 6. Persist to database
      const wordCount = content.wordCount;
      const insertRow: IngestedLinkInsertRow = {
        contentHash,
        ontologyId,
        sourceUri: url,
        sourceType: sourceType ?? enrichedContent?.sourceType ?? "unknown",
        headline: enrichedContent?.headline ?? content.title,
        description: enrichedContent?.description ?? O.getOrNull(content.description),
        publishedAt: P.isUndefined(enrichedContent)
          ? null
          : O.match(enrichedContent.publishedAt, { onNone: () => null, onSome: DateTime.toDateUtc }),
        author: P.isUndefined(enrichedContent) ? null : O.getOrNull(enrichedContent.author),
        organization: P.isUndefined(enrichedContent)
          ? O.getOrNull(content.siteName)
          : O.getOrNull(enrichedContent.organization),
        language: enrichedContent?.language ?? "en",
        topics: [...(enrichedContent?.topics ?? [])],
        keyEntities: [...(enrichedContent?.keyEntities ?? [])],
        storageUri: storagePath,
        status: enrich && P.isNotUndefined(enrichedContent) ? "enriched" : "pending",
        enrichedAt: P.isNotUndefined(enrichedContent) ? DateTime.toDateUtc(yield* DateTime.now) : null,
        wordCount,
        metadata,
      };

      const [inserted] = yield* drizzle
        .insert(ingestedLinks)
        .values(insertRow)
        .returning()
        .pipe(
          Effect.mapError((error) =>
            LinkIngestionError.make({
              message: `Failed to persist link: ${error}`,
              url,
              phase: "persist",
              cause: error,
            })
          )
        );

      return {
        id: inserted.id,
        contentHash,
        storageUri: storagePath,
        duplicate: false,
        ...(P.isNotUndefined(enrichedContent?.headline) ? { headline: enrichedContent.headline } : {}),
        ...(P.isNotNullish(wordCount) ? { wordCount } : {}),
        ...(imageCount > 0 ? { imageCount } : {}),
      };
    });

    /**
     * Ingest multiple URLs with concurrency control
     */
    const ingestUrls = (
      urls: ReadonlyArray<string>,
      options: BulkIngestOptions
    ): Effect.Effect<ReadonlyArray<IngestResult | LinkIngestionError>, LinkIngestionError> =>
      Effect.gen(function* () {
        const { concurrency = 5, continueOnError = true, ...ingestOptions } = options;

        const results = yield* Effect.forEach(
          urls,
          (url) =>
            ingestUrl(url, ingestOptions).pipe(
              Effect.map((result): IngestResult | LinkIngestionError => result),
              Effect.catch(
                (error): Effect.Effect<IngestResult | LinkIngestionError, LinkIngestionError> =>
                  continueOnError ? Effect.succeed(error) : Effect.fail(error)
              )
            ),
          { concurrency }
        );

        return results;
      });

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    /**
     * Get ingested link by content hash within an ontology (cached)
     */
    const getByContentHash = (ontologyId: string, hash: string) =>
      Cache.get(contentHashCache, `${ontologyId}:${hash}`).pipe(
        Effect.mapError((cause) =>
          LinkIngestionError.make({
            message: "Failed to query the content hash cache",
            phase: "persist",
            cause,
          })
        )
      );

    /**
     * Get ingested link by ID
     */
    const getById = Effect.fn("getById")(function* (id: string) {
      const [result] = yield* drizzle.select().from(ingestedLinks).where(eq(ingestedLinks.id, id)).limit(1);
      return O.fromNullishOr(result);
    });

    /**
     * List ingested links with filters
     */
    const list = Effect.fn("list")(function* (filter: IngestedLinkFilter = {}) {
      let query = drizzle.select().from(ingestedLinks).$dynamic();
      const conditions = [
        ...(P.isNotUndefined(filter.ontologyId) ? [eq(ingestedLinks.ontologyId, filter.ontologyId)] : []),
        ...(P.isNotUndefined(filter.status) ? [eq(ingestedLinks.status, filter.status)] : []),
        ...(P.isNotUndefined(filter.sourceType) ? [eq(ingestedLinks.sourceType, filter.sourceType)] : []),
        ...(P.isNotUndefined(filter.organization) ? [eq(ingestedLinks.organization, filter.organization)] : []),
      ];
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

    /**
     * Get pending links ready for extraction
     */
    const getPending = (limit: number = 100) => list({ status: "pending", limit });

    /**
     * Get enriched links ready for extraction
     */
    const getEnriched = (limit: number = 100) => list({ status: "enriched", limit });

    // -----------------------------------------------------------------------
    // Status Updates
    // -----------------------------------------------------------------------

    /**
     * Mark link as processed
     */
    const markProcessed = Effect.fn("markProcessed")(function* (id: string) {
      const now = DateTime.toDateUtc(yield* DateTime.now);
      const [result] = yield* drizzle
        .update(ingestedLinks)
        .set({ status: "processed", processedAt: now, updatedAt: now })
        .where(eq(ingestedLinks.id, id))
        .returning();
      return O.fromNullishOr(result);
    });

    /**
     * Mark link as failed
     */
    const markFailed = Effect.fn("markFailed")(function* (id: string, errorMessage: string) {
      const now = DateTime.toDateUtc(yield* DateTime.now);
      const [result] = yield* drizzle
        .update(ingestedLinks)
        .set({ status: "failed", errorMessage, updatedAt: now })
        .where(eq(ingestedLinks.id, id))
        .returning();
      return O.fromNullishOr(result);
    });

    /**
     * Mark a link as being processed by a batch
     *
     * Updates the link status to "processing".
     * The link-to-batch association is tracked in the link_batch_items table.
     */
    const markProcessing = Effect.fn("markProcessing")(function* (id: string) {
      const now = DateTime.toDateUtc(yield* DateTime.now);
      const [result] = yield* drizzle
        .update(ingestedLinks)
        .set({
          status: "processing",
          updatedAt: now,
        })
        .where(eq(ingestedLinks.id, id))
        .returning();
      return O.fromNullishOr(result);
    });

    /**
     * Get multiple links by their IDs
     */
    const getByIds = Effect.fn("getByIds")(function* (ids: ReadonlyArray<string>) {
      if (ids.length === 0) return [];
      const results = yield* drizzle.select().from(ingestedLinks).where(inArray(ingestedLinks.id, ids));
      return results;
    });

    /**
     * Get content from storage for a link
     */
    const getContent = (link: IngestedLinkRow) => storage.get(link.storageUri).pipe(Effect.map(O.fromNullishOr));

    /**
     * Re-enrich a pending/failed link
     *
     * Retrieves content from storage and runs enrichment again,
     * updating the database with new metadata.
     */
    const reEnrich = (id: string): Effect.Effect<O.Option<IngestedLinkRow>, LinkIngestionError> =>
      Effect.gen(function* () {
        // 1. Get link by ID
        const linkOpt = yield* getById(id).pipe(
          Effect.mapError((cause) =>
            LinkIngestionError.make({
              message: `Failed to query link ${id}`,
              phase: "persist",
              cause,
            })
          )
        );
        if (O.isNone(linkOpt)) {
          return O.none();
        }
        const link = linkOpt.value;

        // 2. Get content from storage
        const sourceUrl = link.sourceUri ?? undefined;
        const contentOpt = yield* getContent(link).pipe(
          Effect.mapError((error) =>
            LinkIngestionError.make({
              message: `Failed to retrieve content: ${error}`,
              ...(P.isNotUndefined(sourceUrl) ? { url: sourceUrl } : {}),
              phase: "fetch",
              cause: error,
            })
          )
        );

        if (O.isNone(contentOpt)) {
          return yield* LinkIngestionError.make({
            message: `Content not found in storage at ${link.storageUri}`,
            ...(P.isNotUndefined(sourceUrl) ? { url: sourceUrl } : {}),
            phase: "fetch",
          });
        }

        const content = contentOpt.value;

        // 3. Run enrichment
        const enrichment = P.isUndefined(sourceUrl) ? enricher.enrich(content) : enricher.enrich(content, sourceUrl);
        const enrichedContent = yield* enrichment.pipe(
          Effect.mapError((error) =>
            LinkIngestionError.make({
              message: `Enrichment failed: ${error.message}`,
              ...(P.isNotUndefined(sourceUrl) ? { url: sourceUrl } : {}),
              phase: "enrich",
              cause: error,
            })
          )
        );

        // 4. Update database
        const now = DateTime.toDateUtc(yield* DateTime.now);
        const [updated] = yield* drizzle
          .update(ingestedLinks)
          .set({
            headline: enrichedContent.headline ?? link.headline,
            description: enrichedContent.description ?? link.description,
            publishedAt: O.match(enrichedContent.publishedAt, {
              onNone: () => link.publishedAt,
              onSome: DateTime.toDateUtc,
            }),
            author: O.getOrElse(enrichedContent.author, () => link.author),
            organization: O.getOrElse(enrichedContent.organization, () => link.organization),
            language: enrichedContent.language,
            topics: enrichedContent.topics.length > 0 ? [...enrichedContent.topics] : link.topics,
            keyEntities: enrichedContent.keyEntities.length > 0 ? [...enrichedContent.keyEntities] : link.keyEntities,
            sourceType: enrichedContent.sourceType ?? link.sourceType,
            status: "enriched",
            enrichedAt: now,
            errorMessage: null,
            updatedAt: now,
          })
          .where(eq(ingestedLinks.id, id))
          .returning()
          .pipe(
            Effect.mapError((error) =>
              LinkIngestionError.make({
                message: `Failed to update link: ${error}`,
                ...(P.isNotUndefined(sourceUrl) ? { url: sourceUrl } : {}),
                phase: "persist",
                cause: error,
              })
            )
          );

        return O.fromNullishOr(updated);
      });

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
      Effect.gen(function* () {
        const cutoffDate = DateTime.toDateUtc(
          DateTime.makeUnsafe((yield* Clock.currentTimeMillis) - olderThanMinutes * 60 * 1000)
        );

        // Build condition: status in (pending, processing) AND updatedAt < cutoff
        const baseCondition = and(
          inArray(ingestedLinks.status, ["pending", "processing"]),
          lt(ingestedLinks.updatedAt, cutoffDate)
        );

        // Add ontology filter if provided
        const condition = P.isNotUndefined(ontologyId)
          ? and(baseCondition, eq(ingestedLinks.ontologyId, ontologyId))
          : baseCondition;

        const now = DateTime.toDateUtc(yield* DateTime.now);
        const results = yield* drizzle
          .update(ingestedLinks)
          .set({
            status: "failed",
            errorMessage: `Stale: not processed within ${olderThanMinutes} minutes`,
            updatedAt: now,
          })
          .where(condition)
          .returning({ id: ingestedLinks.id })
          .pipe(
            Effect.mapError((error) =>
              LinkIngestionError.make({
                message: `Failed to cleanup stale links: ${error}`,
                phase: "persist",
                cause: error,
              })
            )
          );

        if (results.length > 0) {
          yield* Effect.logInfo("Cleaned up stale links", {
            count: results.length,
            olderThanMinutes,
            ontologyId,
          });
        }

        return { cleaned: results.length };
      });

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
      cleanupStaleLinks,
    };
  }),
}) {
  /**
   * Disabled layer for when PostgreSQL is not configured.
   * All methods fail with a descriptive error indicating Postgres is required.
   */
  static readonly Disabled: Layer.Layer<LinkIngestionService> = Layer.succeed(LinkIngestionService, {
    ingestUrl: Effect.fn("LinkIngestionService.ingestUrl")(() =>
      Effect.fail(
        LinkIngestionError.make({
          message: "LinkIngestionService requires PostgreSQL. Configure POSTGRES_HOST.",
          phase: "fetch",
        })
      )
    ),
    ingestUrls: Effect.fn("LinkIngestionService.ingestUrls")(() =>
      Effect.fail(
        LinkIngestionError.make({
          message: "LinkIngestionService requires PostgreSQL. Configure POSTGRES_HOST.",
          phase: "fetch",
        })
      )
    ),
    getByContentHash: Effect.fn("LinkIngestionService.getByContentHash")(() => Effect.succeed(O.none())),
    getById: Effect.fn("LinkIngestionService.getById")(() => Effect.succeed(O.none())),
    getByIds: Effect.fn("LinkIngestionService.getByIds")(() => Effect.succeed([])),
    list: Effect.fn("LinkIngestionService.list")(() => Effect.succeed([])),
    getPending: Effect.fn("LinkIngestionService.getPending")(() => Effect.succeed([])),
    getEnriched: Effect.fn("LinkIngestionService.getEnriched")(() => Effect.succeed([])),
    markProcessed: Effect.fn("LinkIngestionService.markProcessed")(() => Effect.succeed(O.none())),
    markProcessing: Effect.fn("LinkIngestionService.markProcessing")(() => Effect.succeed(O.none())),
    markFailed: Effect.fn("LinkIngestionService.markFailed")(() => Effect.succeed(O.none())),
    getContent: Effect.fn("LinkIngestionService.getContent")(() => Effect.succeed(O.none())),
    reEnrich: Effect.fn("LinkIngestionService.reEnrich")(() =>
      Effect.fail(
        LinkIngestionError.make({
          message: "LinkIngestionService requires PostgreSQL. Configure POSTGRES_HOST.",
          phase: "enrich",
        })
      )
    ),
    cleanupStaleLinks: Effect.fn("LinkIngestionService.cleanupStaleLinks")(() =>
      Effect.fail(
        LinkIngestionError.make({
          message: "LinkIngestionService requires PostgreSQL. Configure POSTGRES_HOST.",
          phase: "persist",
        })
      )
    ),
  });
  static readonly Default = Layer.effect(this, this.make);
}
