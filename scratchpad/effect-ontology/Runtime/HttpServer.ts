/**
 * Public HTTP surface for timeline, search, extraction, health, ontology, and the merged API routers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DrizzleError } from "@beep/drizzle";
import { IRI, makeLiteral, makeNamedNode } from "@beep/rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { UUID } from "@beep/schema/String";
import { UnitInterval } from "@beep/schema/UnitInterval";
import {
  Cause,
  DateTime,
  Effect,
  Equal,
  HashSet,
  Inspectable,
  Layer,
  MutableHashMap,
  MutableHashSet,
  Random,
} from "effect";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { BatchId, DocumentId, GcsUri } from "../Domain/Identity.ts";
import { OntologyEmbeddings } from "../Domain/Model/OntologyEmbeddings.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import type { BatchWorkflowPayload } from "../Domain/Schema/Batch.ts";
import { BatchManifest } from "../Domain/Schema/Batch.ts";
import type { PreprocessingOptions } from "../Domain/Schema/BatchRequest.ts";
import { BatchRequest } from "../Domain/Schema/BatchRequest.ts";
import { ClaimRank, TextSpan } from "../Domain/Schema/KnowledgeModel.ts";
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
import {
  ArticleDetailResponse,
  ArticleSummary,
  ClaimConflict,
  ClaimWithRank,
  ConflictsQuery,
  ConflictsResponse,
  ConflictTransition,
  CorrectionSummary,
  PersistedClaimId,
  PersistedCorrectionId,
  TimelineClaimsQuery,
  TimelineClaimsResponse,
  TimelineEntityQuery,
  TimelineEntityResponse,
} from "../Domain/Schema/Timeline.ts";
import { ArticleRepository } from "../Repository/Article.ts";
import { ClaimRepository } from "../Repository/Claim.ts";
import type { ConflictRecord } from "../Repository/Conflict.ts";
import { ConflictRepository } from "../Repository/Conflict.ts";
import type { ArticleRow, ClaimRow } from "../Repository/schema.ts";
import { ConfigService } from "../Service/Config.ts";
import { OntologyService } from "../Service/Ontology.ts";
import { StorageService } from "../Service/Storage.ts";
import { pollToBatchState, WorkflowOrchestrator } from "../Service/WorkflowOrchestrator.ts";
import { AssetRouter } from "./AssetRouter.ts";
import { AuthRouter } from "./AuthRouter.ts";
import { EventBroadcastRouter } from "./EventBroadcastRouter.ts";
import { HealthCheckService } from "./HealthCheck.ts";
import {
  CurrentConflictActor,
  makeAuthMiddleware,
  makeLoggingMiddleware,
  makeShutdownMiddleware,
} from "./HttpMiddleware.ts";
import { ImageRouter } from "./ImageRouter.ts";
import { InferenceRouter } from "./InferenceRouter.ts";
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

const OntologyScopeQuery = S.Struct({ ontologyId: S.NonEmptyString }).annotate({
  identifier: "OntologyScopeQuery",
  title: "Ontology Scope Query",
  description: "Required ontology scope for repository-backed HTTP lookups.",
});

const unauthenticatedConflictResponse = HttpServerResponse.json(
  {
    error: "UNAUTHORIZED",
    message: "Conflict endpoints require an authenticated API key.",
  },
  { status: 401 }
);

const createManifest = Effect.fn("HttpServer.createManifest")(function* (request: BatchRequest) {
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
          storage.getOption(stripGsPrefix(doc.sourceUri)).pipe(
            Effect.map((content) =>
              O.getOrElse(
                O.map(content, (value) => NonNegativeInt.make(new TextEncoder().encode(value).length)),
                () => NonNegativeInt.make(0)
              )
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

const stageManifest = Effect.fn("HttpServer.stageManifest")(function* (manifest: BatchManifest) {
  const storage = yield* StorageService;
  const config = yield* ConfigService;

  const manifestJson = yield* BatchManifest.encodeEffectFromJsonString(manifest);
  const manifestPath = PathLayout.batch.manifest(manifest.batchId);

  yield* storage.set(manifestPath, manifestJson);

  const bucket = resolveBucket(config);
  return GcsUri.decodeUnknownSync(`gs://${bucket}/${manifestPath}`);
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

const articleRowToArticleSummary = Effect.fn("HttpServer.articleRowToArticleSummary")(function* (article: ArticleRow) {
  const now = yield* DateTime.now;
  const uri = yield* IRI.decodeEffect(article.uri);
  return ArticleSummary.make({
    id: article.id,
    uri,
    headline: O.fromNullishOr(article.headline),
    sourceName: O.fromNullishOr(article.sourceName),
    publishedAt: DateTime.fromDateUnsafe(article.publishedAt),
    ingestedAt: DateTime.fromDateUnsafe(article.ingestedAt ?? article.createdAt ?? DateTime.toDateUtc(now)),
  });
});

const claimRowToClaimWithRank = Effect.fn("HttpServer.claimRowToClaimWithRank")(function* (
  claim: ClaimRow,
  article: ArticleRow
) {
  const now = yield* DateTime.now;
  const subject = yield* IRI.decodeEffect(claim.subjectIri);
  const predicate = yield* IRI.decodeEffect(claim.predicateIri);
  const rank = yield* ClaimRank.decodeEffect(claim.rank);
  const source = yield* articleRowToArticleSummary(article);
  const object =
    claim.objectType === "iri"
      ? makeNamedNode(yield* IRI.decodeEffect(claim.objectValue))
      : makeLiteral(
          claim.objectValue,
          claim.objectDatatype ?? XSD_STRING.value,
          P.isNull(claim.objectLanguage) ? {} : { language: claim.objectLanguage }
        );
  const validTime =
    P.isNotNull(claim.validFrom) && P.isNotNull(claim.validTo)
      ? O.some({
          from: DateTime.fromDateUnsafe(claim.validFrom),
          to: DateTime.fromDateUnsafe(claim.validTo),
        })
      : O.none();
  const confidence = yield* O.match(O.fromNullishOr(claim.confidenceScore), {
    onNone: () => Effect.succeedNone,
    onSome: (value) => UnitInterval.decodeEffect(Number(value)).pipe(Effect.asSome),
  });
  const evidence = yield* O.match(
    O.all({
      text: O.fromNullishOr(claim.evidenceText),
      start: O.fromNullishOr(claim.evidenceStartOffset),
      end: O.fromNullishOr(claim.evidenceEndOffset),
    }),
    {
      onNone: () => Effect.succeedNone,
      onSome: flow(TextSpan.decodeEffect, Effect.map(O.some)),
    }
  );

  return ClaimWithRank.make({
    id: PersistedClaimId.make(claim.id),
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

const conflictRecordToClaimConflict = Effect.fn("HttpServer.conflictRecordToClaimConflict")(function* (
  record: ConflictRecord
) {
  const articleRepo = yield* ArticleRepository;
  const articleA = yield* articleRepo.getArticle(record.claimA.articleId, record.conflict.ontologyId);
  const articleB = yield* articleRepo.getArticle(record.claimB.articleId, record.conflict.ontologyId);
  const requireArticle = (article: O.Option<ArticleRow>, claimId: string) =>
    Effect.fromOption(article, () =>
      DrizzleError.fromUnknown("decodeRows", {
        claimId,
        reason: "Conflict references a claim whose article is unavailable in the ontology scope.",
      })
    );
  const claimA = yield* claimRowToClaimWithRank(record.claimA, yield* requireArticle(articleA, record.claimA.id));
  const claimB = yield* claimRowToClaimWithRank(record.claimB, yield* requireArticle(articleB, record.claimB.id));
  const base = {
    id: record.conflict.id,
    ontologyId: record.conflict.ontologyId,
    conflictType: record.conflict.conflictType,
    claimA,
    claimB,
  };

  if (Equal.equals(record.conflict.status, "pending")) {
    return ClaimConflict.cases.pending.make(base);
  }

  const resolvedBy = yield* Effect.fromOption(O.fromNullishOr(record.conflict.resolvedBy), () =>
    DrizzleError.fromUnknown("decodeRows", { conflictId: record.conflict.id, missing: "resolvedBy" })
  );
  const resolvedAt = yield* Effect.fromOption(O.fromNullishOr(record.conflict.resolvedAt), () =>
    DrizzleError.fromUnknown("decodeRows", { conflictId: record.conflict.id, missing: "resolvedAt" })
  );
  if (Equal.equals(record.conflict.status, "ignored")) {
    return ClaimConflict.cases.ignored.make({
      ...base,
      resolution: {
        resolvedBy,
        resolvedAt: DateTime.fromDateUnsafe(resolvedAt),
        notes: O.fromNullishOr(record.conflict.resolutionNotes),
      },
    });
  }

  const strategy = yield* Effect.fromOption(O.fromNullishOr(record.conflict.resolutionStrategy), () =>
    DrizzleError.fromUnknown("decodeRows", { conflictId: record.conflict.id, missing: "resolutionStrategy" })
  );
  const acceptedClaimId = yield* Effect.fromOption(O.fromNullishOr(record.conflict.acceptedClaimId), () =>
    DrizzleError.fromUnknown("decodeRows", { conflictId: record.conflict.id, missing: "acceptedClaimId" })
  );
  return ClaimConflict.cases.resolved.make({
    ...base,
    resolution: {
      strategy,
      acceptedClaimId: Equal.equals(acceptedClaimId, record.claimA.id) ? claimA.id : claimB.id,
      resolvedBy,
      resolvedAt: DateTime.fromDateUnsafe(resolvedAt),
      notes: O.fromNullishOr(record.conflict.resolutionNotes),
    },
  });
});

// =============================================================================
// Timeline Router
// =============================================================================

/**
 * HTTP surface for entity timelines and conflict transitions.
 *
 * **Details**
 *
 * Entity timelines are served at `GET /v1/timeline/entities/:iri`.
 *
 * **Example** (Register the timeline routes on an HTTP router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter } from "effect/unstable/http"
 * import { TimelineRouter } from "@effect-ontology/Runtime/HttpServer"
 *
 * const served = Layer.provide(TimelineRouter, HttpRouter.layer)
 * console.log(served !== TimelineRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
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
      const decodedIri = yield* IRI.decodeEffect(decodeURIComponent(iri));
      const queryParams = yield* HttpServerRequest.schemaSearchParams(TimelineEntityQuery);

      const claimRepo = yield* ClaimRepository;
      const articleRepo = yield* ArticleRepository;

      // Get claims for this entity
      const claims = yield* claimRepo.getClaims({
        ontologyId: queryParams.ontologyId,
        subjectIri: decodedIri,
        includeDeprecated: queryParams.includeDeprecated,
        limit: PosInt.make(100),
      });

      // Get articles for each claim
      const claimsWithArticles = yield* Effect.forEach(
        claims,
        Effect.fnUntraced(function* (claim) {
          const articleOpt = yield* articleRepo.getArticle(claim.articleId, claim.ontologyId);
          if (O.isNone(articleOpt)) {
            return O.none<ClaimWithRank>();
          }
          return O.some(yield* claimRowToClaimWithRank(claim, articleOpt.value));
        })
      );

      const validClaims = A.filter(A.getSomes(claimsWithArticles), (claim) => {
        const claimedAt = DateTime.toEpochMillis(claim.transactionTime.assertedAt);
        if (O.isSome(queryParams.asOf) && claimedAt > DateTime.toEpochMillis(queryParams.asOf.value)) {
          return false;
        }
        if (O.isSome(queryParams.range)) {
          const from = DateTime.toEpochMillis(queryParams.range.value.from);
          const to = DateTime.toEpochMillis(queryParams.range.value.to);
          if (claimedAt < from || claimedAt > to) {
            return false;
          }
        }
        return true;
      });

      const correctionSourceClaims = queryParams.includeDeprecated
        ? claims
        : yield* claimRepo.getClaims({
            ontologyId: queryParams.ontologyId,
            subjectIri: decodedIri,
            includeDeprecated: true,
          });
      const correctionEntries = yield* Effect.forEach(
        correctionSourceClaims,
        (claim) => claimRepo.getCorrectionChain(claim.id),
        { concurrency: "unbounded" }
      );
      const correctionsList = A.map(
        A.dedupeWith(A.flatten(correctionEntries), (left, right) =>
          Equal.equals(left.correction.id, right.correction.id)
        ),
        (entry) =>
          CorrectionSummary.make({
            id: PersistedCorrectionId.make(entry.correction.id),
            correctionType: entry.correction.correctionType,
            reason: O.fromNullishOr(entry.correction.reason),
            correctionDate: DateTime.fromDateUnsafe(entry.correction.correctionDate),
            originalClaimId: PersistedClaimId.make(entry.originalClaimId),
            newClaimId: O.map(entry.newClaimId, PersistedClaimId.make),
          })
      );

      return yield* HttpServerResponse.schemaJson(TimelineEntityResponse)(
        TimelineEntityResponse.make({
          iri: decodedIri,
          asOf: queryParams.asOf,
          claims: validClaims,
          corrections: correctionsList,
        })
      );
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/timeline/claims",
    Effect.gen(function* () {
      const queryParams = yield* HttpServerRequest.schemaSearchParams(TimelineClaimsQuery);

      const claimRepo = yield* ClaimRepository;
      const articleRepo = yield* ArticleRepository;

      const limit = queryParams.limit;
      const offset = queryParams.offset;

      // Get claims with filters
      const claims = yield* claimRepo.getClaims({
        ontologyId: queryParams.ontologyId,
        ...(O.isSome(queryParams.subject) ? { subjectIri: queryParams.subject.value } : {}),
        ...(O.isSome(queryParams.predicate) ? { predicateIri: queryParams.predicate.value } : {}),
        ...(O.isSome(queryParams.rank) ? { rank: queryParams.rank.value } : {}),
        limit: PosInt.make(limit + 1), // Fetch one extra to check hasMore
        offset,
      });

      const hasMore = claims.length > limit;
      const claimResults = hasMore ? A.take(claims, limit) : claims;

      // Get articles for each claim
      const claimsWithArticles = yield* Effect.forEach(
        claimResults,
        Effect.fnUntraced(function* (claim) {
          const articleOpt = yield* articleRepo.getArticle(claim.articleId, claim.ontologyId);
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
        ontologyId: queryParams.ontologyId,
        ...(O.isSome(queryParams.subject) ? { subjectIri: queryParams.subject.value } : {}),
        ...(O.isSome(queryParams.predicate) ? { predicateIri: queryParams.predicate.value } : {}),
        ...(O.isSome(queryParams.rank) ? { rank: queryParams.rank.value } : {}),
      });

      return yield* HttpServerResponse.schemaJson(TimelineClaimsResponse)(
        TimelineClaimsResponse.make({
          claims: validClaims,
          total: NonNegativeInt.make(total),
          limit: PosInt.make(limit),
          offset: NonNegativeInt.make(offset),
          hasMore,
        })
      );
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
      const conflictRepo = yield* ConflictRepository;
      const queryParams = yield* HttpServerRequest.schemaSearchParams(OntologyScopeQuery);

      // Get article
      const articleOpt = yield* articleRepo.getArticle(articleId, queryParams.ontologyId);
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
      const claims = yield* claimRepo.getClaimsByArticle(articleId, queryParams.ontologyId);

      // Transform claims
      const claimsWithRank = yield* Effect.forEach(claims, (claim) => claimRowToClaimWithRank(claim, article));

      // Count unique entities (subjects)
      const uniqueSubjects = HashSet.fromIterable(A.map(claims, (claim) => claim.subjectIri));

      const conflictCounts = yield* conflictRepo.counts(
        ConflictsQuery.make({ ontologyId: queryParams.ontologyId, articleId: O.some(UUID.make(articleId)) })
      );

      return yield* HttpServerResponse.schemaJson(ArticleDetailResponse)(
        ArticleDetailResponse.make({
          article: yield* articleRowToArticleSummary(article),
          claims: claimsWithRank,
          entityCount: NonNegativeInt.make(HashSet.size(uniqueSubjects)),
          conflictCount: NonNegativeInt.make(conflictCounts.total),
        })
      );
    })
  ),
  HttpRouter.route(
    "GET",
    "/v1/timeline/conflicts",
    Effect.gen(function* () {
      const actor = yield* CurrentConflictActor;
      if (O.isNone(actor.credentialFingerprint)) {
        return yield* unauthenticatedConflictResponse;
      }

      const query = yield* HttpServerRequest.schemaSearchParams(ConflictsQuery);
      const conflictRepo = yield* ConflictRepository;
      const records = yield* conflictRepo.list(query);
      const counts = yield* conflictRepo.counts(query);
      return yield* HttpServerResponse.schemaJson(ConflictsResponse)(
        ConflictsResponse.make({
          conflicts: yield* Effect.forEach(records, conflictRecordToClaimConflict),
          total: NonNegativeInt.make(counts.total),
          pendingCount: NonNegativeInt.make(counts.pending),
        })
      );
    })
  ),
  HttpRouter.route(
    "PATCH",
    "/v1/timeline/conflicts/:id",
    Effect.gen(function* () {
      const actor = yield* CurrentConflictActor;
      if (O.isNone(actor.credentialFingerprint)) {
        return yield* unauthenticatedConflictResponse;
      }

      const params = yield* HttpRouter.params;
      const id = yield* UUID.decodeUnknownEffect(params.id);
      const query = yield* HttpServerRequest.schemaSearchParams(OntologyScopeQuery);
      const action = yield* HttpServerRequest.schemaBodyJson(ConflictTransition);
      const conflictRepo = yield* ConflictRepository;
      const transitioned = yield* conflictRepo.transition(query.ontologyId, id, action, actor);

      if (O.isSome(transitioned)) {
        return yield* HttpServerResponse.schemaJson(ClaimConflict)(
          yield* conflictRecordToClaimConflict(transitioned.value)
        );
      }

      const existing = yield* conflictRepo.get(query.ontologyId, id);
      return yield* O.match(existing, {
        onNone: () =>
          HttpServerResponse.json(
            { error: "NOT_FOUND", message: `Conflict "${id}" was not found in the requested ontology.` },
            { status: 404 }
          ),
        onSome: () =>
          HttpServerResponse.json(
            { error: "CONFLICT_ALREADY_TERMINAL", message: `Conflict "${id}" is already resolved or ignored.` },
            { status: 409 }
          ),
      });
    })
  ),
]);

// =============================================================================
// Search Router
// =============================================================================

/**
 * HTTP surface for claim, article, and entity search.
 *
 * **Details**
 *
 * Claim search is served at `POST /v1/search/claims`.
 *
 * **Example** (Register the search routes on an HTTP router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter } from "effect/unstable/http"
 * import { SearchRouter } from "@effect-ontology/Runtime/HttpServer"
 *
 * const served = Layer.provide(SearchRouter, HttpRouter.layer)
 * console.log(served !== SearchRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
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
              message: Inspectable.toStringUnknown(error, 0),
            },
            { status: 400 }
          ),
        onSuccess: Effect.fnUntraced(function* (request) {
          const claimRepo = yield* ClaimRepository;
          const articleRepo = yield* ArticleRepository;

          const limit = request.limit;
          const offset = request.offset;

          // Get claims with filters
          // Note: Full-text search would require pg_trgm or ts_vector
          // For now, we do a simple query and filter in memory
          const claims = yield* claimRepo.getClaims({
            ontologyId: request.ontologyId,
            ...(O.isSome(request.rank) ? { rank: request.rank.value } : {}),
            includeDeprecated: false,
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
              const articleOpt = yield* articleRepo.getArticle(claim.articleId, claim.ontologyId);
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

          return yield* HttpServerResponse.schemaJson(ClaimSearchResponse)(
            ClaimSearchResponse.make({
              query: request.query,
              claims: validClaims,
              total: NonNegativeInt.make(filteredClaims.length),
              limit,
              offset,
              hasMore,
              facets: O.none(),
            })
          );
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
              message: Inspectable.toStringUnknown(error, 0),
            },
            { status: 400 }
          ),
        onSuccess: Effect.fnUntraced(function* (request) {
          const claimRepo = yield* ClaimRepository;

          const limit = request.limit;

          // Get all claims to find unique subjects
          const claims = yield* claimRepo.getClaims({
            ontologyId: request.ontologyId,
            includeDeprecated: false,
            limit: PosInt.make(1000),
          });

          // Group by subject and filter by query
          const queryLower = Str.toLowerCase(request.query);
          const subjectMap = MutableHashMap.empty<
            string,
            {
              iri: string;
              claimCount: number;
              types: MutableHashSet.MutableHashSet<string>;
            }
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
              const iri = yield* IRI.decodeEffect(entity.iri);
              const types = yield* Effect.forEach(A.fromIterable(entity.types), (type) => IRI.decodeEffect(type));
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

          return yield* HttpServerResponse.schemaJson(EntitySearchResponse)(
            EntitySearchResponse.make({
              query: request.query,
              entities,
              total: NonNegativeInt.make(entities.length),
            })
          );
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
        ontologyId: queryParams.ontologyId,
        includeDeprecated: false,
        limit: PosInt.make(500),
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
        IRI.decodeEffect(suggestion.iri).pipe(
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

      return yield* HttpServerResponse.schemaJson(SuggestionsResponse)(
        SuggestionsResponse.make({
          prefix: queryParams.prefix,
          suggestions: suggestionList,
        })
      );
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
              message: Inspectable.toStringUnknown(error, 0),
            },
            { status: 400 }
          ),
        onSuccess: Effect.fnUntraced(function* (request) {
          const articleRepo = yield* ArticleRepository;
          const claimRepo = yield* ClaimRepository;
          const conflictRepo = yield* ConflictRepository;

          const limit = request.limit;
          const offset = request.offset;

          const sourceSet = O.map(request.sources, HashSet.fromIterable);

          // Get articles with filters
          const articles = yield* articleRepo.getArticles({
            ontologyId: request.ontologyId,
            ...(O.isSome(request.dateRange)
              ? {
                  publishedAfter: DateTime.toDateUtc(request.dateRange.value.from),
                  publishedBefore: DateTime.toDateUtc(request.dateRange.value.to),
                }
              : {}),
          });

          const queryLower = O.map(request.query, Str.toLowerCase);
          const textFiltered = O.match(queryLower, {
            onNone: () => articles,
            onSome: (query) =>
              A.filter(articles, (article) =>
                O.exists(O.fromNullishOr(article.headline), (headline) =>
                  Str.includes(query)(Str.toLowerCase(headline))
                )
              ),
          });
          const filtered = O.match(sourceSet, {
            onNone: () => textFiltered,
            onSome: (sources) =>
              A.filter(textFiltered, (article) =>
                HashSet.has(sources, P.isNotNull(article.sourceName) ? article.sourceName : "")
              ),
          });
          const hasMore = filtered.length > offset + limit;
          const page = A.take(A.drop(filtered, offset), limit);

          // Get claim counts
          const results = yield* Effect.forEach(
            page,
            Effect.fnUntraced(function* (article) {
              const claims = yield* claimRepo.getClaims({
                ontologyId: request.ontologyId,
                articleId: article.id,
                includeDeprecated: true,
              });
              const conflictCounts = yield* conflictRepo.counts(
                ConflictsQuery.make({
                  ontologyId: request.ontologyId,
                  articleId: O.some(UUID.make(article.id)),
                })
              );

              return ArticleSearchResult.make({
                article: yield* articleRowToArticleSummary(article),
                claimCount: NonNegativeInt.make(claims.length),
                conflictCount: NonNegativeInt.make(conflictCounts.total),
              });
            })
          );

          const total = NonNegativeInt.make(filtered.length);

          return yield* HttpServerResponse.schemaJson(ArticleSearchResponse)(
            ArticleSearchResponse.make({
              articles: results,
              total: NonNegativeInt.make(total),
              limit,
              offset,
              hasMore,
            })
          );
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

/**
 * HTTP surface for starting batch extraction and polling batch status.
 *
 * **Details**
 *
 * Batch extraction is accepted at `POST /v1/extract/batch`.
 *
 * **Example** (Register the extraction routes on an HTTP router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter } from "effect/unstable/http"
 * import { ExtractionRouter } from "@effect-ontology/Runtime/HttpServer"
 *
 * const served = Layer.provide(ExtractionRouter, HttpRouter.layer)
 * console.log(served !== ExtractionRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
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
          HttpServerResponse.json(
            {
              error: "NOT_FOUND",
              message: Inspectable.toStringUnknown(error),
            },
            { status: 404 }
          )
        )
      );
    })
  ),
]);

/**
 * HTTP surface for liveness, readiness, and deep health probes.
 *
 * **Details**
 *
 * Liveness is served at `GET /health/live`.
 *
 * **Example** (Register the health probes on an HTTP router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter } from "effect/unstable/http"
 * import { HealthRouter } from "@effect-ontology/Runtime/HttpServer"
 *
 * const served = Layer.provide(HealthRouter, HttpRouter.layer)
 * console.log(served !== HealthRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
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

/**
 * HTTP surface for looking up a registered ontology by id.
 *
 * **Details**
 *
 * Registry entries are served at `GET /v1/ontologies/:id`.
 *
 * **Example** (Register the ontology routes on an HTTP router)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { HttpRouter } from "effect/unstable/http"
 * import { OntologyRouter } from "@effect-ontology/Runtime/HttpServer"
 *
 * const served = Layer.provide(OntologyRouter, HttpRouter.layer)
 * console.log(served !== OntologyRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
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
            {
              error: "NOT_FOUND",
              message: `Ontology "${id}" not found in registry`,
            },
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

/**
 * Merged HTTP surface including timeline and search routers that need repositories.
 *
 * **Example** (Merge health into the public API)
 *
 * ```ts
 * import { ApiRouter, HealthRouter } from "@effect-ontology/Runtime/HttpServer"
 *
 * console.log(ApiRouter !== HealthRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
export const ApiRouter = Layer.mergeAll(
  HealthRouter,
  ExtractionRouter,
  TimelineRouter,
  SearchRouter,
  OntologyRouter,
  InferenceRouter,
  LinkIngestionRouter,
  EventBroadcastRouter,
  AssetRouter,
  ImageRouter,
  AuthRouter
);

/**
 * Merged HTTP surface that omits timeline and search routes requiring repositories.
 *
 * **Example** (Serve the repository-free API)
 *
 * ```ts
 * import { ApiRouter, ApiRouterWithoutRepositories } from "@effect-ontology/Runtime/HttpServer"
 *
 * console.log(ApiRouterWithoutRepositories !== ApiRouter) // true
 * ```
 *
 * @category endpoints
 * @since 0.0.0
 */
export const ApiRouterWithoutRepositories = Layer.mergeAll(
  HealthRouter,
  ExtractionRouter,
  OntologyRouter,
  InferenceRouter,
  LinkIngestionRouter,
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
              Effect.fnUntraced(function* (cause) {
                if (Cause.hasInterrupts(cause)) {
                  return yield* Effect.failCause(cause);
                }
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

/**
 * HTTP server layer serving {@link ApiRouter} with auth, shutdown, and logging middleware.
 *
 * **Example** (Launch the full HTTP server layer)
 *
 * ```ts
 * import { ApiRouter, HttpServerLive } from "@effect-ontology/Runtime/HttpServer"
 *
 * console.log(HttpServerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HttpServerLive = makeHttpServerLive(ApiRouter);

/**
 * HTTP server layer serving {@link ApiRouterWithoutRepositories}.
 *
 * **Example** (Launch the repository-free HTTP server)
 *
 * ```ts
 * import { HttpServerLive, HttpServerWithoutRepositoriesLive } from "@effect-ontology/Runtime/HttpServer"
 *
 * console.log(HttpServerWithoutRepositoriesLive !== HttpServerLive) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HttpServerWithoutRepositoriesLive = makeHttpServerLive(ApiRouterWithoutRepositories);
