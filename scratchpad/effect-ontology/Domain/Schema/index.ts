/**
 * Public extraction, ontology, batch, search, and timeline schemas.
 *
 * **Details**
 *
 * * This barrel preserves the upstream public surface. Specialized event-log,
 * curation-job, inference, and persisted-job schemas remain available from
 * their explicit module paths, avoiding collisions between intentionally
 * distinct job and event vocabularies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Discriminated job-submission sources, progress, and lifecycle responses.
 *
 * **Example** (Use index)
 * ```ts
 * import { SubmitJobRequest } from "@effect-ontology/Schema/index"
 * console.log(SubmitJobRequest)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export * from "./Api.ts";
/**
 * Ticket request, response, and persisted authentication records.
 *
 * **Example** (Use index)
 * ```ts
 * import { TicketRequest } from "@effect-ontology/Schema/index"
 * console.log(TicketRequest)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export * from "./Auth.ts";
/**
 * Batch manifests and workflow activity input/output contracts.
 *
 * **Example** (Use index)
 * ```ts
 * import { BatchManifest } from "@effect-ontology/Schema/index"
 * console.log(BatchManifest)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export * from "./Batch.ts";
/**
 * Batch submission documents and defaulted preprocessing requests.
 *
 * **Example** (Use index)
 * ```ts
 * import { BatchRequest } from "@effect-ontology/Schema/index"
 * console.log(BatchRequest)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export * from "./BatchRequest.ts";
/**
 * Active, suspended, and not-found batch status responses.
 *
 * **Example** (Use index)
 * ```ts
 * import { BatchStatusResponse } from "@effect-ontology/Schema/index"
 * console.log(BatchStatusResponse)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export * from "./BatchStatusResponse.ts";
/**
 * Document classification, chunking, preprocessing, and priority metadata.
 *
 * **Example** (Use index)
 * ```ts
 * import { DocumentType } from "@effect-ontology/Schema/index"
 * console.log(DocumentType.is.contract("contract")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./DocumentMetadata.ts";
/**
 * Provenance-aware claims, assertions, derivations, evidence, and events.
 *
 * **Example** (Use index)
 * ```ts
 * import { ClaimId } from "@effect-ontology/Schema/index"
 * console.log(ClaimId.is("claim-abc123def456")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./KnowledgeModel.ts";
/**
 * Link-ingestion requests, tagged results, summaries, and detail responses.
 *
 * **Example** (Use index)
 * ```ts
 * import { IngestLinkRequest } from "@effect-ontology/Schema/index"
 * console.log(IngestLinkRequest)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export * from "./LinkIngestion.ts";
/**
 * Read models for browsing ontology classes, properties, and metadata.
 *
 * **Example** (Use index)
 * ```ts
 * import { OntologySummary } from "@effect-ontology/Schema/index"
 * console.log(OntologySummary)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./OntologyBrowser.ts";
/**
 * Persisted ontology registry entries, resources, lookup, and JSON codecs.
 *
 * **Example** (Use index)
 * ```ts
 * import { OntologyRegistry } from "@effect-ontology/Schema/index"
 * console.log(OntologyRegistry)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./OntologyRegistry.ts";
/**
 * Claim, entity, article, and suggestion search contracts.
 *
 * **Example** (Use index)
 * ```ts
 * import { ClaimSearchRequest } from "@effect-ontology/Schema/index"
 * console.log(ClaimSearchRequest)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export * from "./Search.ts";
export {
  /**
   * Experiment execution report wrapping the canonical SHACL validation result.
   *
   * **Example** (Use index)
   * ```ts
   * import { ShaclValidationReport } from "@effect-ontology/Schema/index"
   * console.log(ShaclValidationReport)
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  ShaclValidationReport,
} from "./Shacl.ts";
export {
  /**
   * Article detail together with timeline-aware claim context.
   *
   * **Example** (Use index)
   * ```ts
   * import { ArticleDetailResponse } from "@effect-ontology/Schema/index"
   * console.log(ArticleDetailResponse)
   * ```
   *
   * @category dtos
   * @since 0.0.0
   */
  ArticleDetailResponse,
  /**
   * Compact article metadata used by timeline responses.
   *
   * **Example** (Use index)
   * ```ts
   * import { ArticleSummary } from "@effect-ontology/Schema/index"
   * console.log(ArticleSummary)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  ArticleSummary,
  /**
   * Discriminated conflict between competing claims.
   *
   * **Example** (Use index)
   * ```ts
   * import { ClaimConflict } from "@effect-ontology/Schema/index"
   * console.log(ClaimConflict)
   * ```
   *
   * @category schemas
   * @since 0.0.0
   */
  ClaimConflict,
  /**
   * Claim paired with its curation rank.
   *
   * **Example** (Use index)
   * ```ts
   * import { ClaimWithRank } from "@effect-ontology/Schema/index"
   * console.log(ClaimWithRank)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  ClaimWithRank,
  /**
   * Request-local identity recorded for conflict transitions.
   *
   * @category models
   * @since 0.0.0
   */
  ConflictActor,
  /**
   * Authoritative persisted conflict kinds.
   *
   * @category schemas
   * @since 0.0.0
   */
  ConflictKind,
  /**
   * Conflict lifecycle statuses.
   *
   * @category schemas
   * @since 0.0.0
   */
  ConflictStatus,
  /**
   * Bounded query for claim-conflict discovery.
   *
   * **Example** (Use index)
   * ```ts
   * import { ConflictsQuery } from "@effect-ontology/Schema/index"
   * console.log(ConflictsQuery)
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  ConflictsQuery,
  /**
   * Paginated response of claim conflicts.
   *
   * **Example** (Use index)
   * ```ts
   * import { ConflictsResponse } from "@effect-ontology/Schema/index"
   * console.log(ConflictsResponse)
   * ```
   *
   * @category dtos
   * @since 0.0.0
   */
  ConflictsResponse,
  /**
   * Tagged pending-to-terminal conflict command.
   *
   * @category dtos
   * @since 0.0.0
   */
  ConflictTransition,
  /**
   * Query parameters for article correction history.
   *
   * **Example** (Use index)
   * ```ts
   * import { CorrectionHistoryQuery } from "@effect-ontology/Schema/index"
   * console.log(CorrectionHistoryQuery)
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  CorrectionHistoryQuery,
  /**
   * Paginated article correction-history response.
   *
   * **Example** (Use index)
   * ```ts
   * import { CorrectionHistoryResponse } from "@effect-ontology/Schema/index"
   * console.log(CorrectionHistoryResponse)
   * ```
   *
   * @category dtos
   * @since 0.0.0
   */
  CorrectionHistoryResponse,
  /**
   * Compact correction metadata for history listings.
   *
   * **Example** (Use index)
   * ```ts
   * import { CorrectionSummary } from "@effect-ontology/Schema/index"
   * console.log(CorrectionSummary)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  CorrectionSummary,
  /**
   * Correction metadata enriched with affected claims.
   *
   * **Example** (Use index)
   * ```ts
   * import { CorrectionWithClaims } from "@effect-ontology/Schema/index"
   * console.log(CorrectionWithClaims)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  CorrectionWithClaims,
  /**
   * Bitemporal query for claims in a validity interval.
   *
   * **Example** (Use index)
   * ```ts
   * import { TimelineClaimsQuery } from "@effect-ontology/Schema/index"
   * console.log(TimelineClaimsQuery)
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  TimelineClaimsQuery,
  /**
   * Paginated claim timeline response.
   *
   * **Example** (Use index)
   * ```ts
   * import { TimelineClaimsResponse } from "@effect-ontology/Schema/index"
   * console.log(TimelineClaimsResponse)
   * ```
   *
   * @category dtos
   * @since 0.0.0
   */
  TimelineClaimsResponse,
  /**
   * Bitemporal query for one entity's history.
   *
   * **Example** (Use index)
   * ```ts
   * import { TimelineEntityQuery } from "@effect-ontology/Schema/index"
   * console.log(TimelineEntityQuery)
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  TimelineEntityQuery,
  /**
   * Entity history with claims and article context.
   *
   * **Example** (Use index)
   * ```ts
   * import { TimelineEntityResponse } from "@effect-ontology/Schema/index"
   * console.log(TimelineEntityResponse)
   * ```
   *
   * @category dtos
   * @since 0.0.0
   */
  TimelineEntityResponse,
} from "./Timeline.ts";
