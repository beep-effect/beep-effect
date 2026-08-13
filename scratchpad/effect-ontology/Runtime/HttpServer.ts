import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Cause, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { BatchId, DocumentId, GcsUri } from "../Domain/Identity.ts";
import { OntologyEmbeddings } from "../Domain/Model/OntologyEmbeddings.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import { IRI, Literal } from "../Domain/Rdf/Types.ts";
import type { BatchWorkflowPayload } from "../Domain/Schema/Batch.ts";
import { BatchManifest } from "../Domain/Schema/Batch.ts";
import type { PreprocessingOptions } from "../Domain/Schema/BatchRequest.ts";
import { BatchRequest } from "../Domain/Schema/BatchRequest.ts";
import { ClaimId, ClaimRank, TextSpan } from "../Domain/Schema/KnowledgeModel.ts";
import {
  ArticleSearchRequest,
  ArticleSearchResponse,
  ArticleSearchResult,
  ClaimSearchRequest,
  ClaimSearchResponse,
  EntitySearchRequest,
  EntitySearchResponse,
  EntitySearchResult,
  Suggestion,
  SuggestionQuery,
  SuggestionsResponse,
} from "../Domain/Schema/Search.ts";
import type { CorrectionSummary } from "../Domain/Schema/Timeline.ts";
import {
  ArticleDetailResponse,
  ArticleSummary,
  ClaimWithRank,
  ConflictsQuery,
  ConflictsResponse,
  TimelineClaimsQuery,
  TimelineClaimsResponse,
  TimelineEntityQuery,
  TimelineEntityResponse,
} from "../Domain/Schema/Timeline.ts";
import { ArticleRepository } from "../Repository/Article.ts";
import { ClaimRepository } from "../Repository/Claim.ts";
import type { ArticleRow, ClaimRow } from "../Repository/schema.ts";
import { ConfigService } from "../Service/Config.ts";
import { OntologyService } from "../Service/Ontology.ts";
import { StorageService } from "../Service/Storage.ts";
import { pollToBatchState, WorkflowOrchestrator } from "../Service/WorkflowOrchestrator.ts";
import { AssetRouter } from "./AssetRouter.ts";
import { AuthRouter } from "./AuthRouter.ts";
import { EventBroadcastRouter } from "./EventBroadcastRouter.ts";
import { HealthCheckService } from "./HealthCheck.ts";
import { makeAuthMiddleware, makeLoggingMiddleware, makeShutdownMiddleware } from "./HttpMiddleware.ts";
import { ImageRouter } from "./ImageRouter.ts";
import { InferenceRouter } from "./InferenceRouter.ts";
import { JobPushRouter } from "./JobPushHandler.ts";
import { LinkIngestionRouter } from "./LinkIngestionRouter.ts";

type BatchWorkflowPayloadType = BatchWorkflowPayload;

const stripGsPrefix = (uri: string): string =>
  Str.startsWith("gs://")(uri) ? Str.replace(/^gs:\/\/[^/]+\//, "")(uri) : uri;

const resolveBucket = (config: { storage: { bucket: O.Option<string> } }) =>
  O.getOrElse(config.storage.bucket, () => "local-bucket");

const randomIdFragment = Effect.all([
  Random.nextIntBetween(0, 0x1_0000_0000, { halfOpen: true }),
  Random.nextIntBetween(0, 0x1_0000_0000, { halfOpen: true }),
]).pipe(
  Effect.map(A.map((part) => part.toString(16).padStart(8, "0"))),
  Effect.map(A.join("")),
  Effect.map(Str.takeLeft(12))
);

const generateBatchId = randomIdFragment.pipe(Effect.map((fragment) => BatchId.make(`batch-${fragment}`)));

const generateDocumentId = randomIdFragment.pipe(Effect.map((fragment) => DocumentId.make(`doc-${fragment}`)));

const createManifest = Effect.fn(function* (request: BatchRequest) {
  const storage = yield* StorageService;
  const now = yield* DateTime.now;
  const batchId = yield* O.match(request.batchId, {
    onNone: () => generateBatchId,
    onSome: Effect.succeed,
  });

  const documents = yield* Effect.forEach(request.documents, (doc) =>
    Effect.gen(function* () {
      const documentId = yield* O.match(doc.documentId, {
        onNone: () => generateDocumentId,
        onSome: Effect.succeed,
      });

      const sizeBytes = yield* O.match(doc.sizeBytes, {
        onSome: Effect.succeed,
        onNone: () =>
          storage.get(stripGsPrefix(doc.sourceUri)).pipe(
            Effect.map((content) =>
              O.match(O.fromNullishOr(content), {
                onNone: () => NonNegativeInt.make(0),
                onSome: (content) => NonNegativeInt.make(new TextEncoder().encode(content).length),
              })
            )
          ),
      });

      return {
        documentId,
        sourceUri: doc.sourceUri,
        contentType: doc.contentType,
        sizeBytes,
      };
    })
  );

  return BatchManifest.make({
    batchId,
    ontologyId: request.ontologyId,
    ontologyUri: request.ontologyUri,
    ontologyVersion: request.ontologyVersion,
    shaclUri: request.shaclUri,
    targetNamespace: request.targetNamespace,
    documents,
    createdAt: now,
  });
});

const stageManifest = Effect.fn(function* (manifest: BatchManifest) {
  const storage = yield* StorageService;
  const config = yield* ConfigService;

  const manifestJson = yield* S.encodeEffect(S.fromJsonString(BatchManifest))(manifest);
  const manifestPath = PathLayout.batch.manifest(manifest.batchId);

  yield* storage.set(manifestPath, manifestJson);

  const bucket = resolveBucket(config);
  return GcsUri.fromUnknown(`gs://${bucket}/${manifestPath}`);
});

const toPayload = (
  manifest: BatchManifest,
  manifestUri: GcsUri,
  preprocessing: PreprocessingOptions,
  ontologyEmbeddingsUri: O.Option<GcsUri>
): BatchWorkflowPayloadType => {
  // Derive embeddings URI from ontology if not explicitly provided
  const embeddingsUri = O.getOrElse(ontologyEmbeddingsUri, () =>
    OntologyEmbeddings.storagePathFor(manifest.ontologyUri)
  );

  return {
    batchId: manifest.batchId,
    ontologyId: manifest.ontologyId,
    manifestUri,
    ontologyVersion: manifest.ontologyVersion,
    ontologyUri: manifest.ontologyUri,
    targetNamespace: manifest.targetNamespace,
    shaclUri: manifest.shaclUri,
    documentIds: A.map(manifest.documents, (doc) => doc.documentId),
    ontologyEmbeddingsUri: O.some(embeddingsUri),
    preprocessing,
  };
};

// =============================================================================
// Timeline API Helpers
// =============================================================================

const articleRowToArticleSummary = Effect.fn(function* (article: ArticleRow) {
  const now = yield* DateTime.now;
  const uri = yield* S.decodeEffect(IRI)(article.uri);
  return ArticleSummary.make({
    id: article.id,
    uri,
    headline: O.fromNullishOr(article.headline),
    sourceName: O.fromNullishOr(article.sourceName),
    publishedAt: DateTime.fromDateUnsafe(article.publishedAt),
    ingestedAt: DateTime.fromDateUnsafe(article.ingestedAt ?? article.createdAt ?? DateTime.toDateUtc(now)),
  });
});

const claimRowToClaimWithRank = Effect.fn(function* (claim: ClaimRow, article: ArticleRow) {
  const now = yield* DateTime.now;
  const subject = yield* S.decodeEffect(IRI)(claim.subjectIri);
  const predicate = yield* S.decodeEffect(IRI)(claim.predicateIri);
  const rank = yield* S.decodeUnknownEffect(ClaimRank)(claim.rank);
  const source = yield* articleRowToArticleSummary(article);
  const object =
    claim.objectType === "iri"
      ? yield* S.decodeEffect(IRI)(claim.objectValue)
      : Literal.make({
          value: claim.objectValue,
          language: O.fromNullishOr(claim.objectLanguage),
          datatype: yield* O.match(O.fromNullishOr(claim.objectDatatype), {
            onNone: () => Effect.succeed(O.none()),
            onSome: (datatype) => S.decodeEffect(IRI)(datatype).pipe(Effect.map(O.some)),
          }),
        });
  const validTime =
    P.isNotNull(claim.validFrom) && P.isNotNull(claim.validTo)
      ? O.some({
          from: DateTime.fromDateUnsafe(claim.validFrom),
          to: DateTime.fromDateUnsafe(claim.validTo),
        })
      : O.none();
  const confidence = yield* O.match(O.fromNullishOr(claim.confidenceScore), {
    onNone: () => Effect.succeed(O.none()),
    onSome: (value) => S.decodeEffect(UnitInterval)(Number(value)).pipe(Effect.map(O.some)),
  });
  const evidence = yield* O.match(
    O.all({
      text: O.fromNullishOr(claim.evidenceText),
      start: O.fromNullishOr(claim.evidenceStartOffset),
      end: O.fromNullishOr(claim.evidenceEndOffset),
    }),
    {
      onNone: () => Effect.succeed(O.none()),
      onSome: (span) => S.decodeEffect(TextSpan)(span).pipe(Effect.map(O.some)),
    }
  );

  return ClaimWithRank.make({
    id: ClaimId.make(`claim-${Str.takeLeft(12)(Str.replace(/-/g, "")(claim.id))}`),
    subject,
    predicate,
    object,
    rank,
    source,
    validTime,
    transactionTime: {
      assertedAt: DateTime.fromDateUnsafe(claim.assertedAt ?? DateTime.toDateUtc(now)),
      derivedAt: O.none(),
      deprecatedAt: O.map(O.fromNullishOr(claim.deprecatedAt), DateTime.fromDateUnsafe),
    },
    confidence,
    evidence,
  });
});

// =============================================================================
// Timeline Router
// =============================================================================

export const TimelineRouter = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    "/v1/timeline/entities/:iri",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const iri = params.iri;
      if (P.isUndefined(iri)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "IRI parameter is required",
          },
          { status: 400 }
        );
      }
      const decodedIri = yield* S.decodeEffect(IRI)(decodeURIComponent(iri));
      const queryParams = yield* HttpServerRequest.schemaSearchParams(TimelineEntityQuery).pipe(
        Effect.orElseSucceed(() => TimelineEntityQuery.make({}))
      );

      const claimRepo = yield* ClaimRepository;
      const articleRepo = yield* ArticleRepository;

      // Get claims for this entity
      const claims = yield* claimRepo.getClaims({
        subjectIri: decodedIri,
        includeDeprecated: queryParams.includeDeprecated,
        limit: 100,
      });

      // Get articles for each claim
      const claimsWithArticles = yield* Effect.forEach(
        claims,
        Effect.fn(function* (claim) {
          const articleOpt = yield* articleRepo.getArticle(claim.articleId);
          if (O.isNone(articleOpt)) {
            return O.none<ClaimWithRank>();
          }
          return O.some(yield* claimRowToClaimWithRank(claim, articleOpt.value));
        })
      );

      const validClaims = A.getSomes(claimsWithArticles);

      // Get corrections (simplified - would need correction repository)
      const correctionsList: Array<CorrectionSummary> = [];

      return yield* HttpServerResponse.schemaJson(TimelineEntityResponse)({
        iri: decodedIri,
        asOf: queryParams.asOf,
        claims: validClaims,
        corrections: correctionsList,
      });
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/timeline/claims",
    Effect.gen(function* () {
      const queryParams = yield* HttpServerRequest.schemaSearchParams(TimelineClaimsQuery).pipe(
        Effect.orElseSucceed(() => TimelineClaimsQuery.make({}))
      );

      const claimRepo = yield* ClaimRepository;
      const articleRepo = yield* ArticleRepository;

      const limit = queryParams.limit;
      const offset = queryParams.offset;

      // Get claims with filters
      const claims = yield* claimRepo.getClaims({
        ...(O.isSome(queryParams.subject) ? { subjectIri: queryParams.subject.value } : {}),
        ...(O.isSome(queryParams.predicate) ? { predicateIri: queryParams.predicate.value } : {}),
        ...(O.isSome(queryParams.rank) ? { rank: queryParams.rank.value } : {}),
        limit: limit + 1, // Fetch one extra to check hasMore
        offset,
      });

      const hasMore = claims.length > limit;
      const claimResults = hasMore ? A.take(claims, limit) : claims;

      // Get articles for each claim
      const claimsWithArticles = yield* Effect.forEach(
        claimResults,
        Effect.fn(function* (claim) {
          const articleOpt = yield* articleRepo.getArticle(claim.articleId);
          if (O.isNone(articleOpt)) {
            return O.none<ClaimWithRank>();
          }
          // Filter by source if specified
          if (O.isSome(queryParams.source) && articleOpt.value.sourceName !== queryParams.source.value) {
            return O.none<ClaimWithRank>();
          }
          return O.some(yield* claimRowToClaimWithRank(claim, articleOpt.value));
        })
      );

      const validClaims = A.getSomes(claimsWithArticles);

      // Get total count
      const total = yield* claimRepo.countClaims({
        ...(O.isSome(queryParams.subject) ? { subjectIri: queryParams.subject.value } : {}),
        ...(O.isSome(queryParams.predicate) ? { predicateIri: queryParams.predicate.value } : {}),
        ...(O.isSome(queryParams.rank) ? { rank: queryParams.rank.value } : {}),
      });

      return yield* HttpServerResponse.schemaJson(TimelineClaimsResponse)({
        claims: validClaims,
        total: NonNegativeInt.make(total),
        limit: PosInt.make(limit),
        offset: NonNegativeInt.make(offset),
        hasMore,
      });
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/articles/:id",
    Effect.gen(function* () {
      const params = yield* HttpRouter.params;
      const articleId = params.id;
      if (P.isUndefined(articleId)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "Article ID is required",
          },
          { status: 400 }
        );
      }

      const articleRepo = yield* ArticleRepository;
      const claimRepo = yield* ClaimRepository;

      // Get article
      const articleOpt = yield* articleRepo.getArticle(articleId);
      if (O.isNone(articleOpt)) {
        return yield* HttpServerResponse.json(
          {
            error: "NOT_FOUND",
            message: `Article "${articleId}" not found`,
          },
          { status: 404 }
        );
      }
      const article = articleOpt.value;

      // Get all claims for this article
      const claims = yield* claimRepo.getClaimsByArticle(articleId);

      // Transform claims
      const claimsWithRank = yield* Effect.forEach(claims, (claim) => claimRowToClaimWithRank(claim, article));

      // Count unique entities (subjects)
      const uniqueSubjects = HashSet.fromIterable(A.map(claims, (claim) => claim.subjectIri));

      // TODO: Count conflicts when ConflictRepository is implemented
      const conflictCount = 0;

      return yield* HttpServerResponse.schemaJson(ArticleDetailResponse)({
        article: yield* articleRowToArticleSummary(article),
        claims: claimsWithRank,
        entityCount: NonNegativeInt.make(HashSet.size(uniqueSubjects)),
        conflictCount: NonNegativeInt.make(conflictCount),
      });
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/timeline/conflicts",
    Effect.gen(function* () {
      yield* HttpServerRequest.schemaSearchParams(ConflictsQuery).pipe(
        Effect.orElseSucceed(() => ConflictsQuery.make({}))
      );

      // For now, return empty conflicts (would need ConflictRepository)
      // TODO: Use query parameters for filtering when ConflictRepository is implemented
      return yield* HttpServerResponse.schemaJson(ConflictsResponse)({
        conflicts: [],
        total: NonNegativeInt.make(0),
        pendingCount: NonNegativeInt.make(0),
      });
    })
  ),
]);

// =============================================================================
// Search Router
// =============================================================================

export const SearchRouter = HttpRouter.addAll([
  HttpRouter.route(
    "POST",
    "/v1/search/claims",
    HttpServerRequest.schemaBodyJson(ClaimSearchRequest).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          HttpServerResponse.json(
            {
              error: "VALIDATION_ERROR",
              message: error.toString(),
            },
            { status: 400 }
          ),
        onSuccess: Effect.fn(function* (request) {
          const claimRepo = yield* ClaimRepository;
          const articleRepo = yield* ArticleRepository;

          const limit = request.limit;
          const offset = request.offset;

          // Get claims with filters
          // Note: Full-text search would require pg_trgm or ts_vector
          // For now, we do a simple query and filter in memory
          const claims = yield* claimRepo.getClaims({
            ...(O.isSome(request.rank) ? { rank: request.rank.value } : {}),
            includeDeprecated: false,
            limit: 1000,
          });

          const queryLower = Str.toLowerCase(request.query);
          const predicateSet = O.map(request.predicates, HashSet.fromIterable);
          const sourceSet = O.map(request.sources, HashSet.fromIterable);
          const textMatched = A.filter(claims, (claim) => Str.includes(queryLower)(Str.toLowerCase(claim.objectValue)));
          const predicateMatched = O.match(predicateSet, {
            onNone: () => textMatched,
            onSome: (predicates) => A.filter(textMatched, (claim) => HashSet.has(predicates, claim.predicateIri)),
          });

          const claimsWithArticles = yield* Effect.forEach(predicateMatched, (claim) =>
            Effect.gen(function* () {
              const articleOpt = yield* articleRepo.getArticle(claim.articleId);
              if (O.isNone(articleOpt)) {
                return O.none<ClaimWithRank>();
              }
              const article = articleOpt.value;
              if (
                O.isSome(sourceSet) &&
                !HashSet.has(sourceSet.value, P.isNotNull(article.sourceName) ? article.sourceName : "")
              ) {
                return O.none<ClaimWithRank>();
              }
              if (O.isSome(request.dateRange)) {
                const published = article.publishedAt?.getTime();
                if (P.isUndefined(published)) {
                  return O.none<ClaimWithRank>();
                }
                const from = DateTime.toEpochMillis(request.dateRange.value.from);
                const to = DateTime.toEpochMillis(request.dateRange.value.to);
                if (published < from || published > to) {
                  return O.none<ClaimWithRank>();
                }
              }
              return O.some(yield* claimRowToClaimWithRank(claim, article));
            })
          );

          const filteredClaims = A.getSomes(claimsWithArticles);
          const validClaims = A.take(A.drop(filteredClaims, offset), limit);
          const hasMore = filteredClaims.length > offset + limit;

          return yield* HttpServerResponse.schemaJson(ClaimSearchResponse)({
            query: request.query,
            claims: validClaims,
            total: NonNegativeInt.make(filteredClaims.length),
            limit,
            offset,
            hasMore,
            facets: O.none(),
          });
        }),
      })
    )
  ),
  HttpRouter.route(
    "POST",
    "/v1/search/entities",
    HttpServerRequest.schemaBodyJson(EntitySearchRequest).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          HttpServerResponse.json(
            {
              error: "VALIDATION_ERROR",
              message: error.toString(),
            },
            { status: 400 }
          ),
        onSuccess: Effect.fn(function* (request) {
          const claimRepo = yield* ClaimRepository;

          const limit = request.limit;

          // Get all claims to find unique subjects
          const claims = yield* claimRepo.getClaims({
            includeDeprecated: false,
            limit: 1000,
          });

          // Group by subject and filter by query
          const queryLower = Str.toLowerCase(request.query);
          const subjectMap = MutableHashMap.empty<
            string,
            { iri: string; claimCount: number; types: MutableHashSet.MutableHashSet<string> }
          >();

          for (const claim of claims) {
            const entry = O.getOrElse(MutableHashMap.get(subjectMap, claim.subjectIri), () => {
              const created = {
                iri: claim.subjectIri,
                claimCount: 0,
                types: MutableHashSet.empty<string>(),
              };
              MutableHashMap.set(subjectMap, claim.subjectIri, created);
              return created;
            });
            entry.claimCount++;
            // Check for rdf:type predicate to collect types
            if (Str.endsWith("#type")(claim.predicateIri) || Str.endsWith("/type")(claim.predicateIri)) {
              MutableHashSet.add(entry.types, claim.objectValue);
            }
          }

          // Filter by query (match on IRI or label would be better with a label index)
          const requestedTypes = O.map(request.types, HashSet.fromIterable);
          const entityCandidates = A.take(
            subjectMap.pipe(
              MutableHashMap.values,
              A.fromIterable,
              A.filter((entity) => Str.includes(queryLower)(Str.toLowerCase(entity.iri))),
              A.filter((entity) =>
                O.match(requestedTypes, {
                  onNone: () => true,
                  onSome: (types) => A.some(A.fromIterable(entity.types), (type) => HashSet.has(types, type)),
                })
              )
            ),
            limit
          );
          const entities = yield* Effect.forEach(entityCandidates, (entity) =>
            Effect.gen(function* () {
              const iri = yield* S.decodeEffect(IRI)(entity.iri);
              const types = yield* Effect.forEach(A.fromIterable(entity.types), (type) => S.decodeEffect(IRI)(type));
              const label = O.filter(A.last(Str.split(/[#/]/)(entity.iri)), Str.isNonEmpty);
              return EntitySearchResult.make({
                iri,
                label,
                types,
                claimCount: NonNegativeInt.make(entity.claimCount),
                topClaims: [],
              });
            })
          );

          return yield* HttpServerResponse.schemaJson(EntitySearchResponse)({
            query: request.query,
            entities,
            total: NonNegativeInt.make(entities.length),
          });
        }),
      })
    )
  ),
  HttpRouter.route(
    "GET",
    "/v1/search/suggestions",
    Effect.gen(function* () {
      const queryParams = yield* HttpServerRequest.schemaSearchParams(SuggestionQuery).pipe(
        Effect.matchEffect({
          onFailure: () => Effect.succeed(null),
          onSuccess: Effect.succeed,
        })
      );

      if (P.isNull(queryParams)) {
        return yield* HttpServerResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "prefix query parameter is required",
          },
          { status: 400 }
        );
      }

      const claimRepo = yield* ClaimRepository;
      const limit = queryParams.limit;

      // Get claims and extract unique subjects
      const claims = yield* claimRepo.getClaims({
        includeDeprecated: false,
        limit: 500,
      });

      const prefixLower = Str.toLowerCase(queryParams.prefix);
      const seen = MutableHashSet.empty<string>();
      const suggestionIris: Array<{ label: string; iri: string }> = [];

      for (const claim of claims) {
        if (suggestionIris.length >= limit) break;

        const localName = O.getOrElse(A.last(Str.split(/[#/]/)(claim.subjectIri)), () => "");
        if (Str.startsWith(prefixLower)(Str.toLowerCase(localName)) && !MutableHashSet.has(seen, claim.subjectIri)) {
          MutableHashSet.add(seen, claim.subjectIri);
          suggestionIris.push({
            label: localName,
            iri: claim.subjectIri,
          });
        }
      }
      const suggestionList = yield* Effect.forEach(suggestionIris, (suggestion) =>
        S.decodeEffect(IRI)(suggestion.iri).pipe(
          Effect.map((iri) =>
            Suggestion.make({
              label: suggestion.label,
              iri,
              type: O.none(),
              description: O.none(),
            })
          )
        )
      );

      return yield* HttpServerResponse.schemaJson(SuggestionsResponse)({
        prefix: queryParams.prefix,
        suggestions: suggestionList,
      });
    })
  ),
  HttpRouter.route(
    "POST",
    "/v1/search/articles",
    HttpServerRequest.schemaBodyJson(ArticleSearchRequest).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          HttpServerResponse.json(
            {
              error: "VALIDATION_ERROR",
              message: error.toString(),
            },
            { status: 400 }
          ),
        onSuccess: Effect.fn(function* (request) {
          const articleRepo = yield* ArticleRepository;
          const claimRepo = yield* ClaimRepository;

          const limit = request.limit;
          const offset = request.offset;

          const sourceName = O.flatMap(request.sources, A.head);

          // Get articles with filters
          const articles = yield* articleRepo.getArticles({
            ...(O.isSome(sourceName) ? { sourceName: sourceName.value } : {}),
            ...(O.isSome(request.dateRange)
              ? {
                  publishedAfter: DateTime.toDateUtc(request.dateRange.value.from),
                  publishedBefore: DateTime.toDateUtc(request.dateRange.value.to),
                }
              : {}),
          });

          const queryLower = O.map(request.query, Str.toLowerCase);
          const filtered = O.match(queryLower, {
            onNone: () => articles,
            onSome: (query) =>
              A.filter(articles, (article) =>
                O.exists(O.fromNullishOr(article.headline), (headline) =>
                  Str.includes(query)(Str.toLowerCase(headline))
                )
              ),
          });
          const hasMore = filtered.length > offset + limit;
          const page = A.take(A.drop(filtered, offset), limit);

          // Get claim counts
          const results = yield* Effect.forEach(
            page,
            Effect.fn(function* (article) {
              const claims = yield* claimRepo.getClaims({
                articleId: article.id,
                includeDeprecated: true,
              });

              return ArticleSearchResult.make({
                article: yield* articleRowToArticleSummary(article),
                claimCount: NonNegativeInt.make(claims.length),
                conflictCount: NonNegativeInt.make(0), // Would need ConflictRepository
              });
            })
          );

          const total = yield* articleRepo.countArticles({
            ...(O.isSome(sourceName) ? { sourceName: sourceName.value } : {}),
          });

          return yield* HttpServerResponse.schemaJson(ArticleSearchResponse)({
            articles: results,
            total: NonNegativeInt.make(total),
            limit,
            offset,
            hasMore,
          });
        }),
      })
    )
  ),
]);

// =============================================================================
// Extraction Router
// =============================================================================

const startExtraction = Effect.fn("startExtraction")(function* (request: BatchRequest) {
  const manifest = yield* createManifest(request);
  const manifestUri = yield* stageManifest(manifest);
  const orchestrator = yield* WorkflowOrchestrator;
  yield* orchestrator.start(toPayload(manifest, manifestUri, request.preprocessing, request.ontologyEmbeddingsUri));
  return yield* HttpServerResponse.json(
    {
      batchId: manifest.batchId,
      ontologyId: manifest.ontologyId,
      documentCount: manifest.documents.length,
      wsEndpoint: `/v1/ontologies/${manifest.ontologyId}/events/stream`,
      statusEndpoint: `/v1/extract/batch/${manifest.batchId}/status`,
    },
    { status: 202 }
  );
});

const extractionRouteHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const decoded = BatchRequest.decodeUnknownOption(yield* request.json);
  if (O.isNone(decoded)) {
    return yield* HttpServerResponse.json(
      { error: "VALIDATION_ERROR", message: "Invalid batch extraction request" },
      { status: 400 }
    );
  }
  return yield* startExtraction(decoded.value);
});

export const ExtractionRouter = HttpRouter.addAll([
  HttpRouter.route("POST", "/v1/extract/batch", extractionRouteHandler),
  HttpRouter.route("POST", "/v1/extract", extractionRouteHandler),
  HttpRouter.route(
    "GET",
    "/v1/extract/batch/:id/status",
    Effect.gen(function* () {
      const { id } = yield* HttpRouter.params;
      if (P.isUndefined(id)) {
        return yield* HttpServerResponse.json(
          { error: "INVALID_REQUEST", message: "Batch ID is required" },
          { status: 400 }
        );
      }
      return yield* pollToBatchState(id).pipe(
        Effect.flatMap((state) => HttpServerResponse.json(state)),
        Effect.catch((error) =>
          HttpServerResponse.json({ error: "NOT_FOUND", message: String(error) }, { status: 404 })
        )
      );
    })
  ),
]);

export const HealthRouter = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    "/health/live",
    Effect.gen(function* () {
      const health = yield* HealthCheckService;
      return yield* HttpServerResponse.json(yield* health.liveness());
    })
  ),
  HttpRouter.route(
    "GET",
    "/health/ready",
    Effect.gen(function* () {
      const health = yield* HealthCheckService;
      const result = yield* health.readiness();
      return yield* HttpServerResponse.json(result, { status: result.status === "ok" ? 200 : 503 });
    })
  ),
  HttpRouter.route(
    "GET",
    "/health/deep",
    Effect.gen(function* () {
      const health = yield* HealthCheckService;
      const result = yield* health.deepCheck;
      return yield* HttpServerResponse.json(result, { status: result.status === "error" ? 503 : 200 });
    })
  ),
]);

// =============================================================================
// Ontology Router
// =============================================================================

export const OntologyRouter = HttpRouter.addAll([
  HttpRouter.route(
    "GET",
    "/v1/ontologies/:id",
    Effect.gen(function* () {
      const { id } = yield* HttpRouter.params;
      if (P.isUndefined(id)) {
        return yield* HttpServerResponse.json(
          { error: "INVALID_REQUEST", message: "Ontology ID is required" },
          { status: 400 }
        );
      }
      const ontology = yield* OntologyService;
      const entry = yield* ontology.getRegistryEntry(id);
      return yield* O.match(entry, {
        onNone: () =>
          HttpServerResponse.json(
            { error: "NOT_FOUND", message: `Ontology "${id}" not found in registry` },
            { status: 404 }
          ),
        onSome: (value) => HttpServerResponse.json(value),
      });
    })
  ),
]);

// =============================================================================
// Combined Router
// =============================================================================

export const ApiRouter = Layer.mergeAll(
  HealthRouter,
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
);

export const ApiRouterWithoutRepositories = Layer.mergeAll(
  HealthRouter,
  ExtractionRouter,
  OntologyRouter,
  InferenceRouter,
  LinkIngestionRouter,
  JobPushRouter,
  EventBroadcastRouter,
  AssetRouter,
  ImageRouter,
  AuthRouter
);

const makeHttpServerLive = <A, E, R>(apiRouter: Layer.Layer<A, E, R>) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const authMiddleware = yield* makeAuthMiddleware;
      const shutdownMiddleware = yield* makeShutdownMiddleware;
      const loggingMiddleware = yield* makeLoggingMiddleware;

      return HttpRouter.serve(apiRouter, {
        middleware: (app) =>
          app.pipe(
            Effect.catchCause(
              Effect.fn(function* (cause) {
                const requestId = Math.abs(yield* Random.nextInt).toString(16);

                yield* Effect.logError("Unhandled error in HTTP handler", {
                  requestId,
                  cause: Cause.pretty(cause),
                });

                if (Cause.hasDies(cause)) {
                  return yield* HttpServerResponse.json(
                    {
                      error: "Internal server error",
                      requestId,
                      type: "defect",
                    },
                    { status: 500 }
                  );
                }

                if (Cause.hasInterrupts(cause)) {
                  return yield* HttpServerResponse.json(
                    {
                      error: "Request was cancelled",
                      requestId,
                      type: "interrupted",
                    },
                    { status: 503 }
                  );
                }

                return yield* HttpServerResponse.json(
                  {
                    error: "Request failed",
                    requestId,
                    type: "error",
                  },
                  { status: 500 }
                );
              })
            ),
            // Middleware order: logging → auth → shutdown → serve
            // Logging wraps auth so we see both auth failures and successes
            loggingMiddleware,
            authMiddleware,
            shutdownMiddleware
          ),
      });
    })
  );

export const HttpServerLive = makeHttpServerLive(ApiRouter);

export const HttpServerWithoutRepositoriesLive = makeHttpServerLive(ApiRouterWithoutRepositories);
