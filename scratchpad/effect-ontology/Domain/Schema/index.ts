/**
 * Public extraction, ontology, batch, search, and timeline schemas.
 *
 * @remarks
 * This barrel preserves the upstream public surface. Specialized event-log,
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
 * @example
 * ```ts
 * import { SubmitJobRequest } from "@effect-ontology/Schema/index.ts"
 * console.log(SubmitJobRequest)
 * ```
 *
 * @category api
 * @since 0.0.0
 */
export * from "./Api.ts";
/**
 * Ticket request, response, and persisted authentication records.
 *
 * @example
 * ```ts
 * import { TicketRequest } from "@effect-ontology/Schema/index.ts"
 * console.log(TicketRequest)
 * ```
 *
 * @category authentication
 * @since 0.0.0
 */
export * from "./Auth.ts";
/**
 * Batch manifests and workflow activity input/output contracts.
 *
 * @example
 * ```ts
 * import { BatchManifest } from "@effect-ontology/Schema/index.ts"
 * console.log(BatchManifest)
 * ```
 *
 * @category batches
 * @since 0.0.0
 */
export * from "./Batch.ts";
/**
 * Batch submission documents and defaulted preprocessing requests.
 *
 * @example
 * ```ts
 * import { BatchRequest } from "@effect-ontology/Schema/index.ts"
 * console.log(BatchRequest)
 * ```
 *
 * @category batches
 * @since 0.0.0
 */
export * from "./BatchRequest.ts";
/**
 * Active, suspended, and not-found batch status responses.
 *
 * @example
 * ```ts
 * import { BatchStatusResponse } from "@effect-ontology/Schema/index.ts"
 * console.log(BatchStatusResponse)
 * ```
 *
 * @category batches
 * @since 0.0.0
 */
export * from "./BatchStatusResponse.ts";
/**
 * Document classification, chunking, preprocessing, and priority metadata.
 *
 * @example
 * ```ts
 * import { DocumentType } from "@effect-ontology/Schema/index.ts"
 * console.log(DocumentType.is.contract("contract")) // true
 * ```
 *
 * @category documents
 * @since 0.0.0
 */
export * from "./DocumentMetadata.ts";
/**
 * Provenance-aware claims, assertions, derivations, evidence, and events.
 *
 * @example
 * ```ts
 * import { ClaimId } from "@effect-ontology/Schema/index.ts"
 * console.log(ClaimId.is("claim-abc123def456")) // true
 * ```
 *
 * @category knowledge
 * @since 0.0.0
 */
export * from "./KnowledgeModel.ts";
/**
 * Link-ingestion requests, tagged results, summaries, and detail responses.
 *
 * @example
 * ```ts
 * import { IngestLinkRequest } from "@effect-ontology/Schema/index.ts"
 * console.log(IngestLinkRequest)
 * ```
 *
 * @category ingestion
 * @since 0.0.0
 */
export * from "./LinkIngestion.ts";
/**
 * Read models for browsing ontology classes, properties, and metadata.
 *
 * @example
 * ```ts
 * import { OntologySummary } from "@effect-ontology/Schema/index.ts"
 * console.log(OntologySummary)
 * ```
 *
 * @category ontologies
 * @since 0.0.0
 */
export * from "./OntologyBrowser.ts";
/**
 * Persisted ontology registry entries, resources, lookup, and JSON codecs.
 *
 * @example
 * ```ts
 * import { OntologyRegistry } from "@effect-ontology/Schema/index.ts"
 * console.log(OntologyRegistry)
 * ```
 *
 * @category ontologies
 * @since 0.0.0
 */
export * from "./OntologyRegistry.ts";
/**
 * Claim, entity, article, and suggestion search contracts.
 *
 * @example
 * ```ts
 * import { ClaimSearchRequest } from "@effect-ontology/Schema/index.ts"
 * console.log(ClaimSearchRequest)
 * ```
 *
 * @category search
 * @since 0.0.0
 */
export * from "./Search.ts";
export {
  /**
   * Experiment execution report wrapping the canonical SHACL validation result.
   *
   * @example
   * ```ts
   * import { ShaclValidationReport } from "@effect-ontology/Schema/index.ts"
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
   * @example
   * ```ts
   * import { ArticleDetailResponse } from "@effect-ontology/Schema/index.ts"
   * console.log(ArticleDetailResponse)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  ArticleDetailResponse,
  /**
   * Compact article metadata used by timeline responses.
   *
   * @example
   * ```ts
   * import { ArticleSummary } from "@effect-ontology/Schema/index.ts"
   * console.log(ArticleSummary)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  ArticleSummary,
  /**
   * Discriminated conflict between competing claims.
   *
   * @example
   * ```ts
   * import { ClaimConflict } from "@effect-ontology/Schema/index.ts"
   * console.log(ClaimConflict)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  ClaimConflict,
  /**
   * Claim paired with its curation rank.
   *
   * @example
   * ```ts
   * import { ClaimWithRank } from "@effect-ontology/Schema/index.ts"
   * console.log(ClaimWithRank)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  ClaimWithRank,
  /**
   * Bounded query for claim-conflict discovery.
   *
   * @example
   * ```ts
   * import { ConflictsQuery } from "@effect-ontology/Schema/index.ts"
   * console.log(ConflictsQuery)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  ConflictsQuery,
  /**
   * Paginated response of claim conflicts.
   *
   * @example
   * ```ts
   * import { ConflictsResponse } from "@effect-ontology/Schema/index.ts"
   * console.log(ConflictsResponse)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  ConflictsResponse,
  /**
   * Query parameters for article correction history.
   *
   * @example
   * ```ts
   * import { CorrectionHistoryQuery } from "@effect-ontology/Schema/index.ts"
   * console.log(CorrectionHistoryQuery)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  CorrectionHistoryQuery,
  /**
   * Paginated article correction-history response.
   *
   * @example
   * ```ts
   * import { CorrectionHistoryResponse } from "@effect-ontology/Schema/index.ts"
   * console.log(CorrectionHistoryResponse)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  CorrectionHistoryResponse,
  /**
   * Compact correction metadata for history listings.
   *
   * @example
   * ```ts
   * import { CorrectionSummary } from "@effect-ontology/Schema/index.ts"
   * console.log(CorrectionSummary)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  CorrectionSummary,
  /**
   * Correction metadata enriched with affected claims.
   *
   * @example
   * ```ts
   * import { CorrectionWithClaims } from "@effect-ontology/Schema/index.ts"
   * console.log(CorrectionWithClaims)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  CorrectionWithClaims,
  /**
   * Bitemporal query for claims in a validity interval.
   *
   * @example
   * ```ts
   * import { TimelineClaimsQuery } from "@effect-ontology/Schema/index.ts"
   * console.log(TimelineClaimsQuery)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  TimelineClaimsQuery,
  /**
   * Paginated claim timeline response.
   *
   * @example
   * ```ts
   * import { TimelineClaimsResponse } from "@effect-ontology/Schema/index.ts"
   * console.log(TimelineClaimsResponse)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  TimelineClaimsResponse,
  /**
   * Bitemporal query for one entity's history.
   *
   * @example
   * ```ts
   * import { TimelineEntityQuery } from "@effect-ontology/Schema/index.ts"
   * console.log(TimelineEntityQuery)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  TimelineEntityQuery,
  /**
   * Entity history with claims and article context.
   *
   * @example
   * ```ts
   * import { TimelineEntityResponse } from "@effect-ontology/Schema/index.ts"
   * console.log(TimelineEntityResponse)
   * ```
   *
   * @category timeline
   * @since 0.0.0
   */
  TimelineEntityResponse,
} from "./Timeline.ts";
