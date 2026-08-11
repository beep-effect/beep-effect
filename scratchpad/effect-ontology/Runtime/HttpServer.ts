import { Sse } from "effect/unstable/encoding"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { Cause, DateTime, Deferred, Duration, Effect, Layer, Option, Schedule, Schema, Stream } from "effect"
import * as Crypto from "node:crypto"
import { WorkflowNotFoundError, WorkflowSuspendedError } from "../Domain/Error/Workflow.ts"
import type { ContentHash, Namespace, OntologyName } from "../Domain/Identity.ts"
import { BatchId, DocumentId, GcsUri } from "../Domain/Identity.ts"
import { BatchState } from "../Domain/Model/BatchWorkflow.ts"
import { ChunkingConfig, LlmConfig, RunConfig } from "../Domain/Model/ExtractionRun.ts"
import { OntologyRef } from "../Domain/Model/Ontology.ts"
import { OntologyEmbeddings } from "../Domain/Model/OntologyEmbeddings.ts"
import { PathLayout } from "../Domain/PathLayout.ts"
import { KNOWN_VOCABULARIES } from "../Domain/Rdf/Constants.ts"
import type { BatchWorkflowPayload } from "../Domain/Schema/Batch.ts"
import { BatchManifest } from "../Domain/Schema/Batch.ts"
import { BatchRequest, type PreprocessingOptions } from "../Domain/Schema/BatchRequest.ts"
import { BatchStatusResponse } from "../Domain/Schema/BatchStatusResponse.ts"
import type { OntologySummary } from "../Domain/Schema/OntologyBrowser.ts"
import {
  OntologyClassesResponse,
  OntologyDetailResponse,
  OntologyListResponse,
  OntologyPropertiesResponse
} from "../Domain/Schema/OntologyBrowser.ts"
import type { ArticleSearchResult } from "../Domain/Schema/Search.ts"
import {
  ArticleSearchRequest,
  ArticleSearchResponse,
  ClaimSearchRequest,
  ClaimSearchResponse,
  EntitySearchRequest,
  EntitySearchResponse,
  SuggestionQuery,
  SuggestionsResponse
} from "../Domain/Schema/Search.ts"
import type { ClaimWithRank, CorrectionSummary } from "../Domain/Schema/Timeline.ts"
import {
  ArticleDetailResponse,
  ConflictsQuery,
  ConflictsResponse,
  TimelineClaimsQuery,
  TimelineClaimsResponse,
  TimelineEntityQuery,
  TimelineEntityResponse
} from "../Domain/Schema/Timeline.ts"
import { ArticleRepository } from "../Repository/Article.ts"
import { ClaimRepository } from "../Repository/Claim.ts"
import { getBatchStateFromStore } from "../Service/BatchState.ts"
import { type ArticleMetadata, ClaimPersistenceService } from "../Service/ClaimPersistence.ts"
import { ConfigService } from "../Service/Config.ts"
import { ExtractionWorkflow } from "../Service/ExtractionWorkflow.ts"
import { OntologyService } from "../Service/Ontology.ts"
import { OntologyRegistryService } from "../Service/OntologyRegistry.ts"
import { RdfBuilder } from "../Service/Rdf.ts"
import { StorageService } from "../Service/Storage.ts"
import { pollToBatchState, WorkflowOrchestrator } from "../Service/WorkflowOrchestrator.ts"
import { knowledgeGraphToClaims } from "../Utils/ClaimFactory.ts"
import { extractLocalNameFromIri } from "../Utils/Iri.ts"
import { AssetRouter } from "./AssetRouter.ts"
import { AuthRouter } from "./AuthRouter.ts"
import { EventBroadcastRouter } from "./EventBroadcastRouter.ts"
import { HealthCheckService } from "./HealthCheck.ts"
import { makeAuthMiddleware, makeLoggingMiddleware, makeShutdownMiddleware } from "./HttpMiddleware.ts"
import { ImageRouter } from "./ImageRouter.ts"
import { InferenceRouter } from "./InferenceRouter.ts"
import { JobPushRouter } from "./JobPushHandler.ts"
import { LinkIngestionRouter } from "./LinkIngestionRouter.ts"
import * as O from "effect/Option";
import { NonNegativeInt } from "@beep/schema/Int";

type BatchWorkflowPayloadType = BatchWorkflowPayload

const batchStateEquals = (a: BatchState, b: BatchState): boolean =>
  a._tag === b._tag && a.updatedAt.epochMilliseconds === b.updatedAt.epochMilliseconds

const isTerminalState = (state: BatchState) => state._tag === "Complete" || state._tag === "Failed"

const stripGsPrefix = (uri: string): string => uri.startsWith("gs://") ? uri.replace(/^gs:\/\/[^/]+\//, "") : uri

const resolveBucket = (config: { storage: { bucket: Option.Option<string> } }) =>
  Option.getOrElse(config.storage.bucket, () => "local-bucket")

const generateBatchId = (): BatchId => `batch-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}` as BatchId

const generateDocumentId = (): DocumentId => DocumentId.make(`doc-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`)

const encodeState = Schema.encodeEffect(BatchState)
const encodeManifest = Schema.encodeEffect(BatchManifest)

const batchStateToSseEvent = (state: BatchState) =>
  encodeState(state).pipe(
    Effect.map((encoded) => ({
      _tag: "Event" as const,
      event: "state",
      id: `${state.batchId}-${state._tag}-${state.updatedAt.epochMilliseconds}`,
      data: JSON.stringify(encoded)
    }))
  )

const keepAliveEvent = new Sse.Retry({
  duration: Duration.seconds(15),
  lastEventId: undefined
})

const keepAliveStream = (abort: Deferred.Deferred<void>) =>
  Stream.fromEffect(Effect.succeed(keepAliveEvent)).pipe(
    Stream.repeat(Schedule.spaced("15 seconds")),
    Stream.interruptWhen(Deferred.await(abort))
  )

const streamBatchState = (executionId: string, abort: Deferred.Deferred<void>) =>
  Stream.fromEffect(
    pollToBatchState(executionId).pipe(
      Effect.map(Option.some),
      Effect.catch(() => Effect.succeed(Option.none()))
    )
  ).pipe(
    Stream.repeat(Schedule.spaced("500 millis")),
    Stream.filter(Option.isSome),
    Stream.map((opt) => opt.value),
    Stream.tap((state) =>
      isTerminalState(state)
        ? Deferred.succeed(abort, void 0)
        : Effect.succeed<void>(void 0)
    ),
    Stream.changesWith(batchStateEquals),
    Stream.takeUntil(isTerminalState)
  )

const streamBatchExtraction =
  Effect.fn(function*(executionId: string)  {
    const abortSignal = yield* Deferred.make<void>()

    yield* Effect.addFinalizer(() => Deferred.succeed(abortSignal, void 0))

    const stateStream = streamBatchState(executionId, abortSignal)

    const sseStream = Stream.merge(
      stateStream.pipe(
        Stream.mapEffect(batchStateToSseEvent),
        Stream.catchAll(() => Stream.empty)
      ),
      keepAliveStream(abortSignal)
    ).pipe(
      Stream.map((event) => Sse.encoder.write(event)),
      Stream.encodeText
    ) as Stream.Stream<Uint8Array, never, never>

    return HttpServerResponse.stream(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    })
  })

const createManifest =
  Effect.fn(function*(request: BatchRequest)  {
    const storage = yield* StorageService
    const now = yield* DateTime.now
    const batchId = request.batchId ?? generateBatchId()

    const documents = yield* Effect.forEach(
      request.documents,
      (doc) =>
        Effect.gen(function*() {
          const documentId = doc.documentId ?? generateDocumentId()

          const sizeBytes = doc.sizeBytes ?? (yield* storage.get(stripGsPrefix(doc.sourceUri)).pipe(
            Effect.map((opt) =>
              Option.match(O.fromNullishOr(opt), {
                onNone: () => 0,
                onSome: (content) => new TextEncoder().encode(content).length
              })
            )
          ))

          return {
            documentId,
            sourceUri: doc.sourceUri,
            contentType: doc.contentType,
            sizeBytes
          }
        })
    )

    return {
      batchId,
      ontologyId: request.ontologyId,
      ontologyUri: request.ontologyUri,
      ontologyVersion: request.ontologyVersion,
      shaclUri: request.shaclUri,
      targetNamespace: request.targetNamespace,
      documents,
      createdAt: now
    } satisfies BatchManifest
  })

const stageManifest =
  Effect.fn(function* (manifest: BatchManifest)  {
    const storage = yield* StorageService
    const config = yield* ConfigService

    const encoded = yield* encodeManifest(manifest)
    const manifestJson = JSON.stringify(encoded)
    const manifestPath = PathLayout.batch.manifest(manifest.batchId)

    yield* storage.set(manifestPath, manifestJson)

    const bucket = resolveBucket(config)
    return GcsUri.fromUnknown(`gs://${bucket}/${manifestPath}`)
  })

const toPayload = (
  manifest: BatchManifest,
  manifestUri: GcsUri,
  preprocessing?: PreprocessingOptions,
  ontologyEmbeddingsUri?: GcsUri
): BatchWorkflowPayloadType => {
  // Derive embeddings URI from ontology if not explicitly provided
  const embeddingsUri = ontologyEmbeddingsUri ?? OntologyEmbeddings.storagePathFor(manifest.ontologyUri)

  return {
    batchId: manifest.batchId,
    ontologyId: manifest.ontologyId,
    manifestUri,
    ontologyVersion: manifest.ontologyVersion,
    ontologyUri: manifest.ontologyUri,
    targetNamespace: manifest.targetNamespace,
    shaclUri: manifest.shaclUri,
    documentIds: manifest.documents.map((doc) => doc.documentId),
    ontologyEmbeddingsUri: O.some(embeddingsUri),
    preprocessing
  }
}

// =============================================================================
// Timeline API Helpers
// =============================================================================

const claimRowToClaimWithRank = (
  claim: {
    id: string
    subjectIri: string
    predicateIri: string
    objectValue: string
    objectType: string | null
    rank: string
    validFrom: Date | null
    validTo: Date | null
    confidenceScore: string | null
    evidenceText: string | null
    evidenceStartOffset: number | null
    evidenceEndOffset: number | null
    // Transaction time (bitemporal)
    assertedAt: Date | null
    deprecatedAt: Date | null
  },
  article: {
    id: string
    uri: string
    headline: string | null
    sourceName: string | null
    publishedAt: Date
    // Transaction time (bitemporal)
    ingestedAt: Date | null
  }
): ClaimWithRank => ({
  id: claim.id,
  subjectIri: claim.subjectIri,
  predicateIri: claim.predicateIri,
  objectValue: claim.objectValue,
  objectType: claim.objectType as "iri" | "literal" | "typed_literal" | undefined,
  rank: claim.rank as "preferred" | "normal" | "deprecated",
  source: {
    id: article.id,
    uri: article.uri,
    headline: article.headline,
    sourceName: article.sourceName,
    publishedAt: DateTime.fromDateUnsafe(article.publishedAt),
    ingestedAt: DateTime.fromDateUnsafe(article.ingestedAt ?? new Date())
  },
  // Valid time
  validFrom: claim.validFrom ? DateTime.fromDateUnsafe(claim.validFrom) : null,
  validTo: claim.validTo ? DateTime.fromDateUnsafe(claim.validTo) : null,
  // Transaction time
  assertedAt: DateTime.fromDateUnsafe(claim.assertedAt ?? new Date()),
  derivedAt: null, // TODO: populate from derived_at column when available
  deprecatedAt: claim.deprecatedAt ? DateTime.fromDateUnsafe(claim.deprecatedAt) : null,
  confidence: claim.confidenceScore ? parseFloat(claim.confidenceScore) : null,
  evidenceText: claim.evidenceText,
  evidenceStartOffset: claim.evidenceStartOffset,
  evidenceEndOffset: claim.evidenceEndOffset
})

// =============================================================================
// Timeline Router
// =============================================================================

export const TimelineRouter = HttpRouter.addAll([
HttpRouter.route("GET", 
    "/v1/timeline/entities/:iri",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const iri = params.iri
      if (!iri) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "IRI parameter is required"
        }, { status: 400 })
      }
      const decodedIri = decodeURIComponent(iri)
      const queryParams = yield* HttpServerRequest.schemaSearchParams(TimelineEntityQuery).pipe(
        Effect.catch(() => Effect.succeed(TimelineEntityQuery.make({})))
      )

      const claimRepo = yield* ClaimRepository
      const articleRepo = yield* ArticleRepository

      // Get claims for this entity
      const claims = yield* claimRepo.getClaims({
        subjectIri: decodedIri,
        includeDeprecated: queryParams.includeDeprecated ?? false,
        limit: 100
      })

      // Get articles for each claim
      const claimsWithArticles = yield* Effect.forEach(claims,
        Effect.fn(function*(claim) {
          const articleOpt = yield* articleRepo.getArticle(claim.articleId)
          if (Option.isNone(articleOpt)) {
            return Option.none<ClaimWithRank>()
          }
          return Option.some(claimRowToClaimWithRank(claim, articleOpt.value))
        }))

      const validClaims = claimsWithArticles
        .filter(Option.isSome)
        .map((opt) => opt.value)

      // Get corrections (simplified - would need correction repository)
      const correctionsList: Array<CorrectionSummary> = []

      return yield* HttpServerResponse.schemaJson(TimelineEntityResponse)({
        iri: decodedIri,
        asOf: queryParams.asOf ?? null,
        claims: validClaims,
        corrections: correctionsList
      })
    })
  ),
HttpRouter.route("GET", 
    "/v1/timeline/claims",
    Effect.gen(function*() {
      const queryParams = yield* HttpServerRequest.schemaSearchParams(TimelineClaimsQuery).pipe(
        Effect.catch(() => Effect.succeed(TimelineClaimsQuery.make({})))
      )

      const claimRepo = yield* ClaimRepository
      const articleRepo = yield* ArticleRepository

      const limit = queryParams.limit ?? 20
      const offset = queryParams.offset ?? 0

      // Get claims with filters
      const claims = yield* claimRepo.getClaims({
        subjectIri: queryParams.subject,
        predicateIri: queryParams.predicate,
        rank: queryParams.rank,
        limit: limit + 1, // Fetch one extra to check hasMore
        offset
      })

      const hasMore = claims.length > limit
      const claimResults = hasMore ? claims.slice(0, limit) : claims

      // Get articles for each claim
      const claimsWithArticles = yield* Effect.forEach(claimResults,
        Effect.fn(function*(claim) {
          const articleOpt = yield* articleRepo.getArticle(claim.articleId)
          if (Option.isNone(articleOpt)) {
            return Option.none<ClaimWithRank>()
          }
          // Filter by source if specified
          if (queryParams.source && articleOpt.value.sourceName !== queryParams.source) {
            return Option.none<ClaimWithRank>()
          }
          return Option.some(claimRowToClaimWithRank(claim, articleOpt.value))
        }))

      const validClaims = claimsWithArticles
        .filter(Option.isSome)
        .map((opt) => opt.value)

      // Get total count
      const total = yield* claimRepo.countClaims({
        subjectIri: queryParams.subject,
        predicateIri: queryParams.predicate,
        rank: queryParams.rank
      })

      return yield* HttpServerResponse.schemaJson(TimelineClaimsResponse)({
        claims: validClaims,
        total: NonNegativeInt.make(total),
        limit: NonNegativeInt.make(limit),
        offset: NonNegativeInt.make(offset),
        hasMore
      })
    })
  ),
HttpRouter.route("GET", 
    "/v1/articles/:id",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const articleId = params.id
      if (!articleId) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "Article ID is required"
        }, { status: 400 })
      }

      const articleRepo = yield* ArticleRepository
      const claimRepo = yield* ClaimRepository

      // Get article
      const articleOpt = yield* articleRepo.getArticle(articleId)
      if (Option.isNone(articleOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Article "${articleId}" not found`
        }, { status: 404 })
      }
      const article = articleOpt.value

      // Get all claims for this article
      const claims = yield* claimRepo.getClaimsByArticle(articleId)

      // Transform claims
      const claimsWithRank = claims.map((claim) => claimRowToClaimWithRank(claim, article))

      // Count unique entities (subjects)
      const uniqueSubjects = new Set(claims.map((c) => c.subjectIri))

      // TODO: Count conflicts when ConflictRepository is implemented
      const conflictCount = 0

      return yield* HttpServerResponse.schemaJson(ArticleDetailResponse)({
        article: {
          id: article.id,
          uri: article.uri,
          headline: article.headline,
          sourceName: article.sourceName,
          publishedAt: DateTime.fromDateUnsafe(article.publishedAt),
          ingestedAt: DateTime.fromDateUnsafe(article.ingestedAt ?? article.createdAt ?? new Date())
        },
        claims: claimsWithRank,
        entityCount: NonNegativeInt.make(uniqueSubjects.size),
        conflictCount: NonNegativeInt.make(conflictCount)
      })
    })
  ),
HttpRouter.route("GET", 
    "/v1/timeline/conflicts",
    Effect.gen(function*() {
      const _queryParams = yield* HttpServerRequest.schemaSearchParams(ConflictsQuery).pipe(
        Effect.catch(() => Effect.succeed(ConflictsQuery.make({})))
      )

      // For now, return empty conflicts (would need ConflictRepository)
      // TODO: Use _queryParams for filtering when ConflictRepository is implemented
      return yield* HttpServerResponse.schemaJson(ConflictsResponse)({
        conflicts: [],
        total: NonNegativeInt.make(0),
        pendingCount: NonNegativeInt.make(0)
      })
    })
  )
])

// =============================================================================
// Search Router
// =============================================================================

export const SearchRouter = HttpRouter.addAll([
HttpRouter.route("POST", 
    "/v1/search/claims",
    Effect.gen(function*() {
      return yield* HttpServerRequest.schemaBodyJson(ClaimSearchRequest).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, { status: 400 }),
          onSuccess:
            Effect.fn(function*(request) {
              const claimRepo = yield* ClaimRepository
              const articleRepo = yield* ArticleRepository

              const limit = request.limit ?? 20
              const offset = request.offset ?? 0

              // Get claims with filters
              // Note: Full-text search would require pg_trgm or ts_vector
              // For now, we do a simple query and filter in memory
              const claims = yield* claimRepo.getClaims({
                rank: request.rank,
                includeDeprecated: false,
                limit: 1000 // Get more for filtering
              })

              // Filter by query text (case-insensitive match)
              const queryLower = request.query.toLowerCase()
              const filteredClaims = claims.filter((c) => c.objectValue.toLowerCase().includes(queryLower))

              // Apply pagination
              const paginatedClaims = filteredClaims.slice(offset, offset + limit)
              const hasMore = filteredClaims.length > offset + limit

              // Get articles
              const claimsWithArticles = yield* Effect.forEach(paginatedClaims, (claim) =>
                Effect.gen(function*() {
                  const articleOpt = yield* articleRepo.getArticle(claim.articleId)
                  if (Option.isNone(articleOpt)) {
                    return Option.none<ClaimWithRank>()
                  }
                  return Option.some(claimRowToClaimWithRank(claim, articleOpt.value))
                }))

              const validClaims = claimsWithArticles
                .filter(Option.isSome)
                .map((opt) => opt.value)

              return yield* HttpServerResponse.schemaJson(ClaimSearchResponse)({
                query: request.query,
                claims: validClaims,
                total: NonNegativeInt.make(filteredClaims.length),
                limit,
                offset,
                hasMore
              })
            })
        })
      )
    })
  ),
HttpRouter.route("POST", 
    "/v1/search/entities",
    Effect.gen(function*() {
      return yield* HttpServerRequest.schemaBodyJson(EntitySearchRequest).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, { status: 400 }),
          onSuccess:
            Effect.fn(function*(request)  {
                                          const claimRepo = yield* ClaimRepository

                                          const limit = request.limit ?? 20

                                          // Get all claims to find unique subjects
                                          const claims = yield* claimRepo.getClaims({
                                            includeDeprecated: false,
                                            limit: 1000
                                          })

                                          // Group by subject and filter by query
                                          const queryLower = request.query.toLowerCase()
                                          const subjectMap = new Map<string, { iri: string; claimCount: number; types: Set<string> }>()

                                          for (const claim of claims) {
                                            if (!subjectMap.has(claim.subjectIri)) {
                                              subjectMap.set(claim.subjectIri, {
                                                iri: claim.subjectIri,
                                                claimCount: 0,
                                                types: new Set()
                                              })
                                            }
                                            const entry = subjectMap.get(claim.subjectIri)!
                                            entry.claimCount++
                                            // Check for rdf:type predicate to collect types
                                            if (claim.predicateIri.endsWith("#type") || claim.predicateIri.endsWith("/type")) {
                                              entry.types.add(claim.objectValue)
                                            }
                                          }

                                          // Filter by query (match on IRI or label would be better with a label index)
                                          const entities = Array.from(subjectMap.values())
                                            .filter((e) => e.iri.toLowerCase().includes(queryLower))
                                            .slice(0, limit)
                                            .map((e) => ({
                                              iri: e.iri,
                                              label: e.iri.split(/[#/]/).pop() ?? null, // Extract local name as label
                                              types: Array.from(e.types),
                                              claimCount: e.claimCount
                                            }))

                                          return yield* HttpServerResponse.schemaJson(EntitySearchResponse)({
                                            query: request.query,
                                            entities,
                                            total: NonNegativeInt.make(entities.length)
                                          })
                                        })
        })
      )
    })
  ),
HttpRouter.route("GET", 
    "/v1/search/suggestions",
    Effect.gen(function*() {
      const queryParams = yield* HttpServerRequest.schemaSearchParams(SuggestionQuery).pipe(
        Effect.matchEffect({
          onFailure: () => Effect.succeed(null),
          onSuccess: Effect.succeed
        })
      )

      if (!queryParams) {
        return yield* HttpServerResponse.json({
          error: "VALIDATION_ERROR",
          message: "prefix query parameter is required"
        }, { status: 400 })
      }

      const claimRepo = yield* ClaimRepository
      const limit = queryParams.limit ?? 10

      // Get claims and extract unique subjects
      const claims = yield* claimRepo.getClaims({
        includeDeprecated: false,
        limit: 500
      })

      const prefixLower = queryParams.prefix.toLowerCase()
      const seen = new Set<string>()
      const suggestionList: Array<{ label: string; iri: string; type: string | null; description: string | null }> = []

      for (const claim of claims) {
        if (suggestionList.length >= limit) break

        const localName = claim.subjectIri.split(/[#/]/).pop() ?? ""
        if (localName.toLowerCase().startsWith(prefixLower) && !seen.has(claim.subjectIri)) {
          seen.add(claim.subjectIri)
          suggestionList.push({
            label: localName,
            iri: claim.subjectIri,
            type: null,
            description: null
          })
        }
      }

      return yield* HttpServerResponse.schemaJson(SuggestionsResponse)({
        prefix: queryParams.prefix,
        suggestions: suggestionList
      })
    })
  ),
HttpRouter.route("POST", 
    "/v1/search/articles",
    Effect.gen(function*() {
      return yield* HttpServerRequest.schemaBodyJson(ArticleSearchRequest).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, { status: 400 }),
          onSuccess:
            Effect.fn(function*(request)  {
              const articleRepo = yield* ArticleRepository
              const claimRepo = yield* ClaimRepository

              const limit = request.limit ?? 20
              const offset = request.offset ?? 0

              // Get articles with filters
              const articles = yield* articleRepo.getArticles({
                sourceName: request.sources?.[0], // Simplified: only first source
                publishedAfter: request.dateRange?.from
                  ? new Date(DateTime.toEpochMillis(request.dateRange.from))
                  : undefined,
                publishedBefore: request.dateRange?.to
                  ? new Date(DateTime.toEpochMillis(request.dateRange.to))
                  : undefined,
                limit: limit + 1,
                offset
              })

              const hasMore = articles.length > limit
              const articleResults = hasMore ? articles.slice(0, limit) : articles

              // Filter by query in headline if provided
              const queryLower = request.query?.toLowerCase()
              const filtered = queryLower
                ? articleResults.filter((a) => a.headline?.toLowerCase().includes(queryLower))
                : articleResults

              // Get claim counts
              const results = yield* Effect.forEach(filtered,
                Effect.fn(function* (article)  {
                  const claims = yield* claimRepo.getClaims({
                    articleId: article.id,
                    includeDeprecated: true
                  })

                  return {
                    article: {
                      id: article.id,
                      uri: article.uri,
                      headline: article.headline,
                      sourceName: article.sourceName,
                      publishedAt: DateTime.fromDateUnsafe(article.publishedAt),
                      ingestedAt: DateTime.fromDateUnsafe(article.ingestedAt ?? article.createdAt ?? new Date())
                    },
                    claimCount: claims.length,
                    conflictCount: 0 // Would need ConflictRepository
                  }
                }))

              const total = yield* articleRepo.countArticles({
                sourceName: request.sources?.[0]
              })

              return yield* HttpServerResponse.schemaJson(ArticleSearchResponse)({
                articles: results,
                total: NonNegativeInt.make(total),
                limit: NonNegativeInt.make(limit),
                offset: NonNegativeInt.make(offset),
                hasMore
              })
            })
        })
      )
    })
  )
])

// =============================================================================
// Extraction Router
// =============================================================================

export const ExtractionRouter = HttpRouter.addAll([
HttpRouter.route("POST", 
    "/v1/extract/batch",
    Effect.gen(function*() {
      return yield* HttpServerRequest.schemaBodyJson(BatchRequest).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, { status: 400 }),
          onSuccess: (request) =>
            Effect.gen(function*() {
              const manifest = yield* createManifest(request)
              const manifestUri = yield* stageManifest(manifest)

              const orchestrator = yield* WorkflowOrchestrator
              yield* orchestrator.start(
                toPayload(manifest, manifestUri, request.preprocessing, request.ontologyEmbeddingsUri)
              )

              // Return 202 Accepted with batchId
              // Client should subscribe to WebSocket for real-time updates
              return yield* HttpServerResponse.json({
                batchId: manifest.batchId,
                ontologyId: manifest.ontologyId,
                documentCount: manifest.documents.length,
                wsEndpoint: `/v1/ontologies/${manifest.ontologyId}/events/stream`,
                statusEndpoint: `/v1/extract/batch/${manifest.batchId}/status`
              }, { status: 202 })
            })
        })
      )
    })
  ),
HttpRouter.route("POST", 
    "/v1/extract",
    Effect.gen(function*() {
      return yield* HttpServerRequest.schemaBodyJson(BatchRequest).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, { status: 400 }),
          onSuccess: (request) =>
            Effect.gen(function*() {
              const manifest = yield* createManifest(request)
              const manifestUri = yield* stageManifest(manifest)
              const orchestrator = yield* WorkflowOrchestrator
              yield* orchestrator.start(
                toPayload(manifest, manifestUri, request.preprocessing, request.ontologyEmbeddingsUri)
              )

              return yield* HttpServerResponse.json({
                batchId: manifest.batchId,
                ontologyId: manifest.ontologyId,
                documentCount: manifest.documents.length,
                wsEndpoint: `/v1/ontologies/${manifest.ontologyId}/events/stream`,
                statusEndpoint: `/v1/extract/batch/${manifest.batchId}/status`
              }, { status: 202 })
            })
        })
      )
    })
  ),
HttpRouter.route("GET", 
    "/v1/extract/batch/:batchId/stream",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const batchId = params.batchId
      if (!batchId) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Batch ID is required"
        }, { status: 400 })
      }
      return yield* streamBatchExtraction(batchId)
    })
  ),
HttpRouter.route("POST", 
    "/v1/extract/inline",
    Effect.gen(function*() {
      return yield* HttpServerRequest.schemaBodyJson(Schema.Struct({
        text: Schema.String
      })).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, { status: 400 }),
          onSuccess: (request) =>
            Effect.gen(function*() {
              const config = yield* ConfigService
              const extractionWorkflow = yield* ExtractionWorkflow
              const rdfBuilder = yield* RdfBuilder

              // Build RunConfig from ConfigService
              const runConfig = RunConfig.make({
                ontology: OntologyRef.make({
                  namespace: "default" as Namespace,
                  name: "ontology" as OntologyName,
                  contentHash: "0000000000000000" as ContentHash
                }),
                chunking: ChunkingConfig.make({
                  maxChunkSize: 2000,
                  preserveSentences: true,
                  overlapTokens: 50
                }),
                llm: LlmConfig.make({
                  model: config.llm.model,
                  temperature: config.llm.temperature,
                  maxTokens: config.llm.maxTokens,
                  timeoutMs: config.llm.timeoutMs
                }),
                concurrency: 4,
                enableGrounding: true
              })

              // Execute extraction
              const graph = yield* extractionWorkflow.extract(request.text, runConfig)

              // Build RDF store and serialize to Turtle
              const store = yield* rdfBuilder.createStore
              yield* rdfBuilder.addEntities(store, graph.entities)
              yield* rdfBuilder.addRelations(store, graph.relations)
              const turtle = yield* rdfBuilder.toTurtle(store)

              // Persist claims to PostgreSQL (if configured)
              let claimsPersisted = 0
              const claimPersistenceOpt = yield* Effect.serviceOption(ClaimPersistenceService)

              if (Option.isSome(claimPersistenceOpt) && graph.entities.length > 0) {
                const claimPersistence = claimPersistenceOpt.value

                // Create claims from extracted graph
                // Use "inline" as default ontologyId for ad-hoc extractions
                const claims = knowledgeGraphToClaims(
                  graph.entities,
                  graph.relations,
                  {
                    baseNamespace: `${config.rdf.baseNamespace}inline/`,
                    documentId: `inline-${Date.now()}`,
                    ontologyId: "inline",
                    defaultConfidence: 0.85
                  }
                )

                // Generate synthetic article metadata for inline extraction
                const contentHash = Crypto.createHash("sha256").update(request.text).digest("hex").slice(0, 16)
                const articleMeta: ArticleMetadata = {
                  uri: `inline:${contentHash}`,
                  ontologyId: "inline",
                  headline: request.text.slice(0, 100),
                  publishedAt: new Date(),
                  contentHash
                }

                const result = yield* claimPersistence.persistClaims(claims, articleMeta).pipe(
                  Effect.tap((r) =>
                    Effect.logInfo("Inline extraction: claims persisted to PostgreSQL", {
                      articleId: r.articleId,
                      claimsInserted: r.claimsInserted,
                      claimsTotal: r.claimsTotal
                    })
                  ),
                  Effect.catch((error) =>
                    Effect.logWarning("Failed to persist claims to PostgreSQL", {
                      error: String(error)
                    }).pipe(Effect.as({ articleId: "", claimsInserted: 0, claimsTotal: claims.length }))
                  )
                )

                claimsPersisted = result.claimsInserted
              }

              return yield* HttpServerResponse.json({
                entities: graph.entities.map((e) => ({
                  id: e.id,
                  mention: e.mention,
                  types: e.types,
                  attributes: e.attributes
                })),
                relations: graph.relations.map((r) => ({
                  subjectId: r.subjectId,
                  predicate: r.predicate,
                  object: r.object,
                  evidence: r.evidence
                })),
                turtle,
                stats: {
                  entityCount: graph.entities.length,
                  relationCount: graph.relations.length,
                  tripleCount: store._store.size,
                  claimsPersisted
                }
              })
            })
        })
      )
    })
  ),
HttpRouter.route("GET", 
    "/v1/batch/:id",
    Effect.gen(function*() {
      const { id } = yield* HttpRouter.params

      return yield* Schema.decodeUnknownEffect(BatchId)(id).pipe(
        Effect.matchEffect({
          onFailure: () =>
            HttpServerResponse.json({
              error: "INVALID_BATCH_ID",
              message: `Invalid batch ID format: ${id}`
            }, { status: 400 }),
          onSuccess: (decodedId) =>
            pollToBatchState(decodedId).pipe(
              Effect.matchEffect({
                onFailure: (error) => {
                  if (error instanceof WorkflowSuspendedError) {
                    return Effect.gen(function*() {
                      const stored = yield* getBatchStateFromStore(decodedId).pipe(
                        Effect.catch(() => Effect.succeed(Option.none<BatchState>()))
                      )

                      return yield* HttpServerResponse.schemaJson(BatchStatusResponse)({
                        _tag: "Suspended",
                        batchId: decodedId,
                        cause: typeof error.cause === "string" ? error.cause : undefined,
                        lastKnownState: Option.getOrUndefined(stored),
                        canResume: true
                      })
                    })
                  }

                  if (error instanceof WorkflowNotFoundError) {
                    return HttpServerResponse.schemaJson(BatchStatusResponse)({
                      _tag: "NotFound",
                      batchId: decodedId
                    }, { status: 404 })
                  }

                  return HttpServerResponse.json({
                    error: "WORKFLOW_ERROR",
                    message: error instanceof Error ? error.message : String(error)
                  }, { status: 500 })
                },
                onSuccess: (state) =>
                  HttpServerResponse.schemaJson(BatchStatusResponse)({
                    _tag: "Active",
                    state
                  })
              })
            )
        })
      )
    })
  ),
HttpRouter.route("POST", 
    "/v1/batch/:id/resume",
    Effect.gen(function*() {
      const { id } = yield* HttpRouter.params
      return yield* Schema.decodeUnknownEffect(BatchId)(id).pipe(
        Effect.matchEffect({
          onFailure: () =>
            HttpServerResponse.json({
              error: "INVALID_BATCH_ID",
              message: `Invalid batch ID format: ${id}`
            }, { status: 400 }),
          onSuccess: (decodedId) =>
            Effect.gen(function*() {
              const orchestrator = yield* WorkflowOrchestrator
              yield* orchestrator.resume(decodedId)

              return yield* HttpServerResponse.json({ resumed: true, batchId: decodedId })
            })
        })
      )
    })
  ),
HttpRouter.route("GET", 
    "/",
    HttpServerResponse.json({
      name: "@effect-ontology/core-v2",
      version: "2.0.0",
      description: "Unified batch extraction API"
    })
  ),
HttpRouter.route("GET", 
    "/health/live",
    Effect.gen(function*() {
      const health = yield* HealthCheckService
      const result = yield* health.liveness()
      return yield* HttpServerResponse.json(result)
    })
  ),
HttpRouter.route("GET", 
    "/health/ready",
    Effect.gen(function*() {
      const health = yield* HealthCheckService
      const result = yield* health.readiness()
      const status = result.status === "ok" ? 200 : 503
      return yield* HttpServerResponse.json(result, { status })
    })
  ),
HttpRouter.route("GET", 
    "/health/deep",
    Effect.gen(function*() {
      const health = yield* HealthCheckService
      const result = yield* health.deepCheck()
      const status = result.status === "ok" ? 200 : result.status === "degraded" ? 200 : 503
      return yield* HttpServerResponse.json(result, { status })
    })
  )
])

// =============================================================================
// Ontology Router
// =============================================================================

/**
 * Enrich import IRIs with vocabulary metadata
 */
const enrichImports = (importIris: ReadonlyArray<string>) =>
  importIris.map((iri) => {
    const known = KNOWN_VOCABULARIES[iri]
    if (known) {
      return { iri, ...known }
    }
    // For unknown vocabularies, derive prefix from IRI
    const localName = iri.split(/[#/]/).pop() || iri
    return {
      iri,
      prefix: localName.toLowerCase().slice(0, 6),
      name: localName,
      publisher: "Unknown",
      specUrl: iri
    }
  })

export const OntologyRouter = HttpRouter.addAll([
HttpRouter.route("GET", 
    "/v1/ontologies",
    Effect.gen(function*() {
      const registry = yield* OntologyRegistryService

      const entries = yield* registry.list.pipe(
        Effect.catchTag("RegistryNotFoundError", () =>
          Effect.gen(function*() {
            yield* Effect.logWarning("Ontology registry not found, returning empty list")
            return [] as const
          })),
        Effect.catchTag("RegistryParseError", (error) =>
          Effect.gen(function*() {
            yield* Effect.logError("Failed to parse ontology registry", { error })
            return [] as const
          }))
      )

      // For summary counts, we need to load each ontology (can be optimized later)
      const summaries: Array<OntologySummary> = entries.map((entry) => ({
        id: entry.id,
        iri: entry.iri,
        title: entry.title,
        description: entry.description,
        version: entry.version,
        classCount: 0, // Not loading full ontology for list view
        propertyCount: 0,
        importCount: entry.imports.length
      }))

      return yield* HttpServerResponse.schemaJson(OntologyListResponse)({
        ontologies: summaries
      })
    })
  ),
HttpRouter.route("GET", 
    "/v1/ontologies/:id",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const id = params.id

      if (!id) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Ontology ID is required"
        }, { status: 400 })
      }

      // Get registry entry for metadata
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(id)
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${id}" not found in registry`
        }, { status: 404 })
      }
      const entry = entryOpt.value

      // Load full ontology for class/property info
      const ontologyContext = yield* (yield* OntologyService).resolveAndLoad(id)

      // Build detail response from registry entry + parsed ontology
      const detailResponse: OntologyDetailResponse = {
        id: entry.id,
        iri: entry.iri,
        title: entry.title,
        description: entry.description,
        version: entry.version,
        creator: O.some("Effect Ontology Project"),
        created: O.some(new Date().toISOString().split("T")[0]),
        targetNamespace: entry.targetNamespace,
        imports: enrichImports(entry.imports),
        classes: O.some(ontologyContext.classes.map((cls) => ({
          iri: cls.id,
          localName: extractLocalNameFromIri(cls.id),
          label: cls.label || undefined,
          comment: cls.comment || undefined,
          superClass: ontologyContext.hierarchy[cls.id]?.[0]
        }))),
        properties: O.some(ontologyContext.properties.map((prop) => ({
          iri: prop.id,
          localName: extractLocalNameFromIri(prop.id),
          label: prop.label || undefined,
          comment: prop.comment || undefined,
          domain: prop.domain[0],
          range: prop.range[0],
          isObjectProperty: prop.rangeType === "object"
        }))),
        seeAlso: []
      }

      return yield* HttpServerResponse.schemaJson(OntologyDetailResponse)(detailResponse)
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          yield* Effect.logError("Error loading ontology details", { error })
          return yield* HttpServerResponse.json({
            error: "INTERNAL_ERROR",
            message: "Failed to load ontology details"
          }, { status: 500 })
        })
      )
    )
  ),
HttpRouter.route("GET", 
    "/v1/ontologies/:id/classes",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const id = params.id

      if (!id) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Ontology ID is required"
        }, { status: 400 })
      }

      // Validate ontology exists in registry
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(id)
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${id}" not found in registry`
        }, { status: 404 })
      }

      // Use (yield* OntologyService).resolveAndLoad which handles:
      // - Registry lookup by ID if ONTOLOGY_REGISTRY_PATH is configured
      // - Direct path loading as fallback
      const ontologyContext = yield* (yield* OntologyService).resolveAndLoad(id)

      // Transform ClassDefinition to ClassSummary for API response
      const classSummaries = ontologyContext.classes.map((cls) => ({
        iri: cls.id,
        localName: extractLocalNameFromIri(cls.id),
        label: cls.label || undefined,
        comment: cls.comment || undefined,
        superClass: ontologyContext.hierarchy[cls.id]?.[0]
      }))

      return yield* HttpServerResponse.schemaJson(OntologyClassesResponse)({
        ontologyId: id,
        total: NonNegativeInt.make(classSummaries.length),
        classes: O.some(classSummaries)
      })
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          yield* Effect.logError("Error loading ontology classes", { error })
          return yield* HttpServerResponse.json({
            error: "INTERNAL_ERROR",
            message: "Failed to load ontology classes"
          }, { status: 500 })
        })
      )
    )
  ),
HttpRouter.route("GET", 
    "/v1/ontologies/:id/properties",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const id = params.id

      if (!id) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Ontology ID is required"
        }, { status: 400 })
      }

      // Validate ontology exists in registry
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(id)
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${id}" not found in registry`
        }, { status: 404 })
      }

      // Use (yield* OntologyService).resolveAndLoad which handles registry lookup
      const ontologyContext = yield* (yield* OntologyService).resolveAndLoad(id)

      // Transform PropertyDefinition to PropertySummary for API response
      const propertySummaries = ontologyContext.properties.map((prop) => ({
        iri: prop.id,
        localName: extractLocalNameFromIri(prop.id),
        label: prop.label || undefined,
        comment: prop.comment || undefined,
        domain: prop.domain[0],
        range: prop.range[0],
        isObjectProperty: prop.rangeType === "object"
      }))

      return yield* HttpServerResponse.schemaJson(OntologyPropertiesResponse)({
        ontologyId: id,
        total: NonNegativeInt.make(propertySummaries.length),
        properties: O.some(propertySummaries)
      })
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          yield* Effect.logError("Error loading ontology properties", { error })
          return yield* HttpServerResponse.json({
            error: "INTERNAL_ERROR",
            message: "Failed to load ontology properties"
          }, { status: 500 })
        })
      )
    )
  ),
HttpRouter.route("GET", 
    "/v1/ontologies/:id/entities",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const ontologyId = params.id

      if (!ontologyId) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Ontology ID is required"
        }, { status: 400 })
      }

      // Validate ontology exists in registry
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(ontologyId)
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${ontologyId}" not found in registry`
        }, { status: 404 })
      }

      const request = yield* HttpServerRequest.HttpServerRequest
      const url = new URL(request.url, "http://localhost")
      const limit = parseInt(url.searchParams.get("limit") || "20")
      const offset = parseInt(url.searchParams.get("offset") || "0")

      const claimRepo = yield* ClaimRepository

      // Get claims scoped to this ontology
      const claims = yield* claimRepo.getClaims({
        ontologyId,
        limit: 1000 // Get more to dedupe subjects
      })

      // Extract unique subjects
      const subjectsMap = new Map<string, { iri: string; claimCount: number; types: Set<string> }>()
      for (const claim of claims) {
        const existing = subjectsMap.get(claim.subjectIri)
        if (existing) {
          existing.claimCount++
          // Add type from predicate if it's rdf:type
          if (claim.predicateIri === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type") {
            existing.types.add(claim.objectValue)
          }
        } else {
          const types = new Set<string>()
          if (claim.predicateIri === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type") {
            types.add(claim.objectValue)
          }
          subjectsMap.set(claim.subjectIri, { iri: claim.subjectIri, claimCount: 1, types })
        }
      }

      const entities = Array.from(subjectsMap.values())
        .slice(offset, offset + limit)
        .map((e) => ({
          iri: e.iri,
          label: extractLocalNameFromIri(e.iri),
          types: Array.from(e.types),
          claimCount: e.claimCount
        }))

      return yield* HttpServerResponse.json({
        entities,
        total: subjectsMap.size,
        limit,
        offset
      })
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          yield* Effect.logError("Error loading ontology entities", { error })
          return yield* HttpServerResponse.json({
            error: "INTERNAL_ERROR",
            message: "Failed to load ontology entities"
          }, { status: 500 })
        })
      )
    )
  ),
HttpRouter.route("GET", 
    "/v1/ontologies/:id/claims",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const ontologyId = params.id

      if (!ontologyId) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Ontology ID is required"
        }, { status: 400 })
      }

      // Validate ontology exists in registry
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(ontologyId)
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${ontologyId}" not found in registry`
        }, { status: 404 })
      }

      const queryParams = yield* HttpServerRequest.schemaSearchParams(TimelineClaimsQuery).pipe(
        Effect.catch(() => Effect.succeed(TimelineClaimsQuery.make({})))
      )

      const claimRepo = yield* ClaimRepository
      const articleRepo = yield* ArticleRepository
      const limit = queryParams.limit ?? 20
      const offset = queryParams.offset ?? 0

      // Get claims scoped to this ontology
      const claims = yield* claimRepo.getClaims({
        ontologyId,
        subjectIri: queryParams.subject,
        predicateIri: queryParams.predicate,
        rank: queryParams.rank,
        limit: limit + 1,
        offset
      })

      const hasMore = claims.length > limit
      const claimResults = hasMore ? claims.slice(0, limit) : claims

      // Get articles for each claim
      const claimsWithArticles = yield* Effect.forEach(claimResults, (claim) =>
        Effect.gen(function*() {
          const articleOpt = yield* articleRepo.getArticle(claim.articleId)
          if (Option.isNone(articleOpt)) {
            return Option.none<ClaimWithRank>()
          }
          return Option.some(claimRowToClaimWithRank(claim, articleOpt.value))
        }))

      const validClaims = claimsWithArticles
        .filter(Option.isSome)
        .map((opt) => opt.value)

      // Get total count
      const total = yield* claimRepo.countClaims({
        ontologyId,
        subjectIri: queryParams.subject,
        predicateIri: queryParams.predicate
      })

      return yield* HttpServerResponse.schemaJson(TimelineClaimsResponse)({
        claims: validClaims,
        total: NonNegativeInt.make(total),
        limit: NonNegativeInt.make(limit),
        offset: NonNegativeInt.make(offset),
        hasMore
      })
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          yield* Effect.logError("Error searching ontology claims", { error })
          return yield* HttpServerResponse.json({
            error: "INTERNAL_ERROR",
            message: "Failed to search ontology claims"
          }, { status: 500 })
        })
      )
    )
  ),
HttpRouter.route("GET", 
    "/v1/ontologies/:id/timeline/entities/:iri",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const ontologyId = params.id
      const iri = params.iri

      if (!ontologyId || !iri) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Ontology ID and entity IRI are required"
        }, { status: 400 })
      }

      // Validate ontology exists in registry
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(ontologyId)
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${ontologyId}" not found in registry`
        }, { status: 404 })
      }

      const decodedIri = decodeURIComponent(iri)
      const queryParams = yield* HttpServerRequest.schemaSearchParams(TimelineEntityQuery).pipe(
        Effect.catch(() => Effect.succeed(TimelineEntityQuery.make({})))
      )

      const claimRepo = yield* ClaimRepository
      const articleRepo = yield* ArticleRepository

      // Get claims for this entity, scoped to ontology
      const claims = yield* claimRepo.getClaims({
        ontologyId,
        subjectIri: decodedIri,
        includeDeprecated: queryParams.includeDeprecated ?? false,
        limit: 100
      })

      // Get articles for each claim
      const claimsWithArticles = yield* Effect.forEach(claims, (claim) =>
        Effect.gen(function*() {
          const articleOpt = yield* articleRepo.getArticle(claim.articleId)
          if (Option.isNone(articleOpt)) {
            return Option.none<ClaimWithRank>()
          }
          return Option.some(claimRowToClaimWithRank(claim, articleOpt.value))
        }))

      const validClaims = claimsWithArticles
        .filter(Option.isSome)
        .map((opt) => opt.value)

      const correctionsList: Array<CorrectionSummary> = []

      return yield* HttpServerResponse.schemaJson(TimelineEntityResponse)({
        iri: decodedIri,
        asOf: queryParams.asOf ?? null,
        claims: validClaims,
        corrections: correctionsList
      })
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          yield* Effect.logError("Error loading entity timeline", { error })
          return yield* HttpServerResponse.json({
            error: "INTERNAL_ERROR",
            message: "Failed to load entity timeline"
          }, { status: 500 })
        })
      )
    )
  ),
HttpRouter.route("POST", 
    "/v1/ontologies/:id/documents",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const ontologyId = params.id

      if (!ontologyId) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Ontology ID is required"
        }, { status: 400 })
      }

      // Validate ontology exists in registry
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(ontologyId)
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${ontologyId}" not found in registry`
        }, { status: 404 })
      }

      return yield* HttpServerRequest.schemaBodyJson(ArticleSearchRequest).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            HttpServerResponse.json({
              error: "VALIDATION_ERROR",
              message: (error as Schema.SchemaError).toString()
            }, { status: 400 }),
          onSuccess: (request) =>
                                Effect.gen(function*() {
                                  const articleRepo = yield* ArticleRepository
                                  const claimRepo = yield* ClaimRepository

                                  const limit = request.limit ?? 20
                                  const offset = request.offset ?? 0

                                  // Get articles scoped to this ontology
                                  const articles = yield* articleRepo.getArticles({
                                    ontologyId,
                                    sourceName: request.sources?.[0],
                                    publishedAfter: request.dateRange?.from
                                      ? new Date(DateTime.toEpochMillis(request.dateRange.from))
                                      : undefined,
                                    publishedBefore: request.dateRange?.to
                                      ? new Date(DateTime.toEpochMillis(request.dateRange.to))
                                      : undefined,
                                    limit: limit + 1,
                                    offset
                                  })

                                  const hasMore = articles.length > limit
                                  const articleResults = hasMore ? articles.slice(0, limit) : articles

                                  // Filter by query in headline if provided
                                  const queryLower = request.query?.toLowerCase()
                                  const filtered = queryLower
                                    ? articleResults.filter((a) => a.headline?.toLowerCase().includes(queryLower))
                                    : articleResults

                                  // Get claim counts
                                  const results = yield* Effect.forEach(filtered, (article) =>
                                    Effect.gen(function*() {
                                      const claims = yield* claimRepo.getClaims({
                                        articleId: article.id,
                                        ontologyId,
                                        includeDeprecated: true
                                      })

                                      return {
                                        article: {
                                          id: article.id,
                                          uri: article.uri,
                                          headline: article.headline,
                                          sourceName: article.sourceName,
                                          publishedAt: DateTime.fromDateUnsafe(article.publishedAt),
                                          ingestedAt: DateTime.fromDateUnsafe(article.ingestedAt ?? article.createdAt ?? new Date())
                                        },
                                        claimCount: NonNegativeInt.make(claims.length),
                                        conflictCount: NonNegativeInt.make(0)
                                      } satisfies ArticleSearchResult
                                    }))

                                  const total = yield* articleRepo.countArticles({
                                    ontologyId,
                                    sourceName: request.sources?.[0]
                                  })

                                  return yield* HttpServerResponse.schemaJson(ArticleSearchResponse)({
                                    articles: results,
                                    total: NonNegativeInt.make(total),
                                    limit: NonNegativeInt.make(limit),
                                    offset: NonNegativeInt.make(offset),
                                    hasMore
                                  })
                                })
        })
      )
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          yield* Effect.logError("Error searching ontology documents", { error })
          return yield* HttpServerResponse.json({
            error: "INTERNAL_ERROR",
            message: "Failed to search ontology documents"
          }, { status: 500 })
        })
      )
    )
  ),
HttpRouter.route("GET", 
    "/v1/ontologies/:id/documents/:docId",
    Effect.gen(function*() {
      const params = yield* HttpRouter.params
      const ontologyId = params.id
      const docId = params.docId

      if (!ontologyId || !docId) {
        return yield* HttpServerResponse.json({
          error: "INVALID_REQUEST",
          message: "Ontology ID and document ID are required"
        }, { status: 400 })
      }

      // Validate ontology exists in registry
      const entryOpt = yield* (yield* OntologyService).getRegistryEntry(ontologyId)
      if (Option.isNone(entryOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: `Ontology "${ontologyId}" not found in registry`
        }, { status: 404 })
      }

      const articleRepo = yield* ArticleRepository
      const claimRepo = yield* ClaimRepository

      const articleOpt = yield* articleRepo.getArticle(docId)
      if (Option.isNone(articleOpt)) {
        return yield* HttpServerResponse.json({
          error: "NOT_FOUND",
          message: "Document not found"
        }, { status: 404 })
      }

      const article = articleOpt.value

      // Get claims for this article scoped to ontology
      const claims = yield* claimRepo.getClaims({
        articleId: docId,
        ontologyId,
        includeDeprecated: true
      })

      // Unique entities
      const uniqueSubjects = new Set(claims.map((c) => c.subjectIri))

      return yield* HttpServerResponse.json({
        article: {
          id: article.id,
          uri: article.uri,
          headline: article.headline,
          sourceName: article.sourceName,
          publishedAt: article.publishedAt.toISOString(),
          ingestedAt: (article.ingestedAt ?? article.createdAt ?? new Date()).toISOString()
        },
        claims: claims.map((claim) => ({
          id: claim.id,
          subjectIri: claim.subjectIri,
          predicateIri: claim.predicateIri,
          objectValue: claim.objectValue,
          objectType: claim.objectType,
          rank: claim.rank,
          confidence: claim.confidenceScore ? Number(claim.confidenceScore) : null,
          evidenceText: claim.evidenceText,
          evidenceStartOffset: claim.evidenceStartOffset,
          evidenceEndOffset: claim.evidenceEndOffset,
          assertedAt: (claim.assertedAt ?? new Date()).toISOString()
        })),
        entityCount: uniqueSubjects.size,
        conflictCount: 0
      })
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function*() {
          yield* Effect.logError("Error loading document detail", { error })
          return yield* HttpServerResponse.json({
            error: "INTERNAL_ERROR",
            message: "Failed to load document detail"
          }, { status: 500 })
        })
      )
    )
  )
])

// =============================================================================
// Combined Router
// =============================================================================

export const ApiRouter = Layer.mergeAll(
  ExtractionRouter,
  TimelineRouter,
  SearchRouter,
  OntologyRouter,
  InferenceRouter,
  LinkIngestionRouter,
  JobPushRouter,
  EventBroadcastRouter,
  AssetRouter,
  ImageRouter,
  AuthRouter
)

export const HttpServerLive = Layer.unwrap(
  Effect.gen(function*() {
    const authMiddleware = yield* makeAuthMiddleware
    const shutdownMiddleware = yield* makeShutdownMiddleware
    const loggingMiddleware = yield* makeLoggingMiddleware

    return HttpRouter.serve(ApiRouter, {
      middleware: (app) => app.pipe(
        Effect.catchCause((cause) =>
          Effect.gen(function*() {
          const requestId = yield* Effect.sync(() => crypto.randomUUID())

          yield* Effect.logError("Unhandled error in HTTP handler", {
            requestId,
            cause: Cause.pretty(cause)
          })

          if (Cause.hasDies(cause)) {
            return yield* HttpServerResponse.json({
              error: "Internal server error",
              requestId,
              type: "defect"
            }, { status: 500 })
          }

          if (Cause.hasInterrupts(cause)) {
            return yield* HttpServerResponse.json({
              error: "Request was cancelled",
              requestId,
              type: "interrupted"
            }, { status: 503 })
          }

          return yield* HttpServerResponse.json({
            error: "Request failed",
            requestId,
            type: "error"
          }, { status: 500 })
          })
        ),
        // Middleware order: logging → auth → shutdown → serve
        // Logging wraps auth so we see both auth failures and successes
        loggingMiddleware,
        authMiddleware,
        shutdownMiddleware
      )
    })
  })
)
