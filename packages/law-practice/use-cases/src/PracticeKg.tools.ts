/**
 * Read-only MCP declarations for the portable practice knowledge-graph bundle.
 *
 * This module owns protocol schemas only. Runtime queries and layers live in
 * `@beep/law-practice-server`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  annotateFourHints,
  ColumnarEnvelope,
  defineFieldTiers,
  FieldTierName,
  FourHintAnnotations,
} from "@beep/mcp-kit";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";

const $I = $LawPracticeUseCasesId.create("PracticeKg.tools");
const defaultBudgetBytes = PosInt.make(8000);

const BudgetBytes = PosInt.pipe(SchemaUtils.withKeyDefaults(defaultBudgetBytes)).annotateKey({
  description: "Maximum serialized response size in bytes. Defaults to 8000.",
});

class BudgetParams extends S.Class<BudgetParams>($I`BudgetParams`)(
  { budgetBytes: BudgetBytes },
  $I.annote("BudgetParams", { description: "Shared byte budget accepted by practice KG read tools." })
) {}

class DocketFamilyParams extends S.Class<DocketFamilyParams>($I`DocketFamilyParams`)(
  {
    budgetBytes: BudgetBytes,
    family: S.NonEmptyString.annotateKey({ description: "Docket-family natural key, for example 10008." }),
  },
  $I.annote("DocketFamilyParams", { description: "Parameters for resolving one docket family." })
) {}

class ApplicationLookupParams extends S.Class<ApplicationLookupParams>($I`ApplicationLookupParams`)(
  {
    application_number: S.optionalKey(S.NonEmptyString),
    budgetBytes: BudgetBytes,
    docket: S.optionalKey(S.NonEmptyString),
    patent_number: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("ApplicationLookupParams", {
    description: "Application lookup by application number, patent number, or docket.",
  })
) {}

class FindParams extends S.Class<FindParams>($I`FindParams`)(
  {
    budgetBytes: BudgetBytes,
    query: S.NonEmptyString.annotateKey({ description: "Case-insensitive node label or natural-key fragment." }),
  },
  $I.annote("FindParams", { description: "Parameters for finding graph spine nodes." })
) {}

class SearchTextParams extends S.Class<SearchTextParams>($I`SearchTextParams`)(
  {
    budgetBytes: BudgetBytes,
    family: S.optionalKey(S.NonEmptyString),
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    query: S.NonEmptyString,
  },
  $I.annote("SearchTextParams", { description: "Parameters for BM25 corpus full-text search." })
) {}

class DocumentRange extends S.Class<DocumentRange>($I`DocumentRange`)(
  {
    length: PosInt,
    start: PosInt,
  },
  $I.annote("DocumentRange", { description: "One-based text start and positive character length." })
) {}

class GetDocumentParams extends S.Class<GetDocumentParams>($I`GetDocumentParams`)(
  {
    budgetBytes: BudgetBytes,
    digest: S.optionalKey(S.NonEmptyString),
    organized_path: S.optionalKey(S.NonEmptyString),
    range: S.optionalKey(DocumentRange),
  },
  $I.annote("GetDocumentParams", { description: "Document lookup by digest or organized corpus path." })
) {}

class EmailSearchParams extends S.Class<EmailSearchParams>($I`EmailSearchParams`)(
  {
    after: S.optionalKey(S.NonEmptyString),
    before: S.optionalKey(S.NonEmptyString),
    budgetBytes: BudgetBytes,
    family: S.optionalKey(S.NonEmptyString),
    query: S.optionalKey(S.NonEmptyString),
    sender: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("EmailSearchParams", { description: "Header-only email search filters." })
) {}

class CandidateClaimsParams extends S.Class<CandidateClaimsParams>($I`CandidateClaimsParams`)(
  {
    budgetBytes: BudgetBytes,
    digest: S.optionalKey(S.NonEmptyString),
    docket: S.optionalKey(S.NonEmptyString),
    family: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("CandidateClaimsParams", {
    description: "Candidate-claim lookup key accepted before the claims batch is loaded.",
  })
) {}

class ProvenanceParams extends S.Class<ProvenanceParams>($I`ProvenanceParams`)(
  {
    budgetBytes: BudgetBytes,
    digest: S.optionalKey(S.NonEmptyString),
    iri: S.optionalKey(S.NonEmptyString),
    natural_key: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("ProvenanceParams", { description: "Optional graph or document identity for provenance lookup." })
) {}

/**
 * Safe structured failure returned by a practice KG tool.
 *
 * @example
 * ```ts
 * import { PracticeKgToolError } from "@beep/law-practice-use-cases/server"
 *
 * const error = PracticeKgToolError.make({ message: "Bundle query failed.", tool: "kg_find" })
 * console.log(error.tool) // "kg_find"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgToolError extends S.Class<PracticeKgToolError>($I`PracticeKgToolError`)(
  {
    message: S.NonEmptyString,
    tool: S.NonEmptyString,
  },
  $I.annote("PracticeKgToolError", {
    description: "Sanitized failure returned by a read-only practice knowledge-graph tool.",
  })
) {}

/**
 * Budgeted columnar response shared by the eight live practice KG tools.
 *
 * @example
 * ```ts
 * import { PracticeKgToolResult } from "@beep/law-practice-use-cases/server"
 * import { ColumnarEnvelope } from "@beep/mcp-kit"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const result = PracticeKgToolResult.make({
 *   bundle_version: "2026-07-27-01",
 *   data: ColumnarEnvelope.make({ columns: ["family"], rows: [["10008"]] }),
 *   epistemic_status: "derived-from-official-records",
 *   tier: "minimal",
 *   total: NonNegativeInt.make(1),
 *   truncated: false
 * })
 * console.log(result.bundle_version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgToolResult extends S.Class<PracticeKgToolResult>($I`PracticeKgToolResult`)(
  {
    bundle_version: S.NonEmptyString,
    data: ColumnarEnvelope,
    epistemic_status: S.NonEmptyString,
    note: S.optionalKey(S.String),
    tier: FieldTierName,
    total: NonNegativeInt,
    truncated: S.Boolean,
  },
  $I.annote("PracticeKgToolResult", {
    description: "Budgeted columnar practice KG response with authority and bundle labels.",
  })
) {}

/**
 * Typed empty response returned until the PR-4 candidate-claims batch exists.
 *
 * @example
 * ```ts
 * import { PracticeKgCandidateClaimsResult } from "@beep/law-practice-use-cases/server"
 *
 * const result = PracticeKgCandidateClaimsResult.make({
 *   available: false,
 *   bundle_version: "2026-07-27-01",
 *   epistemic_status: "candidate-unreviewed",
 *   reason: "claims batch not yet loaded"
 * })
 * console.log(result.available) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgCandidateClaimsResult extends S.Class<PracticeKgCandidateClaimsResult>(
  $I`PracticeKgCandidateClaimsResult`
)(
  {
    available: S.Literal(false),
    bundle_version: S.NonEmptyString,
    epistemic_status: S.Literal("candidate-unreviewed"),
    reason: S.Literal("claims batch not yet loaded"),
  },
  $I.annote("PracticeKgCandidateClaimsResult", {
    description: "Manifest-labelled empty result used before candidate claims are loaded.",
  })
) {}

/**
 * Progressive fields for PGlite graph-node and relationship query rows.
 *
 * @example
 * ```ts
 * import { practiceKgGraphFieldTiers } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(practiceKgGraphFieldTiers.minimal.fields))
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const practiceKgGraphFieldTiers = defineFieldTiers({
  minimal: S.Struct({
    count: S.NullOr(S.Finite),
    kind: S.String,
    label: S.String,
    naturalKey: S.String,
  }),
  balanced: S.Struct({
    client: S.NullOr(S.String),
    count: S.NullOr(S.Finite),
    docketFamily: S.NullOr(S.String),
    iri: S.String,
    kind: S.String,
    label: S.String,
    naturalKey: S.String,
  }),
  complete: S.Struct({
    client: S.NullOr(S.String),
    count: S.NullOr(S.Finite),
    docketFamily: S.NullOr(S.String),
    epistemicStatus: S.String,
    iri: S.String,
    kind: S.String,
    label: S.String,
    naturalKey: S.String,
    provenanceKind: S.String,
    provenanceRef: S.String,
  }),
});

/**
 * Progressive fields for docket-family aggregate rows.
 *
 * @example
 * ```ts
 * import { practiceKgFamilyFieldTiers } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(practiceKgFamilyFieldTiers.complete.fields).includes("documentDigest"))
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const practiceKgFamilyFieldTiers = defineFieldTiers({
  minimal: S.Struct({
    applicationCount: S.Finite,
    docketCount: S.Finite,
    documentCount: S.Finite,
    family: S.String,
  }),
  balanced: S.Struct({
    applicationCount: S.Finite,
    docket: S.NullOr(S.String),
    docketCount: S.Finite,
    documentCount: S.Finite,
    family: S.String,
    patent: S.NullOr(S.String),
  }),
  complete: S.Struct({
    application: S.NullOr(S.String),
    applicationCount: S.Finite,
    docket: S.NullOr(S.String),
    docketCount: S.Finite,
    documentDigest: S.NullOr(S.String),
    documentLabel: S.NullOr(S.String),
    documentCount: S.Finite,
    family: S.String,
    patent: S.NullOr(S.String),
  }),
});

/**
 * Progressive fields for DuckDB corpus document rows.
 *
 * @example
 * ```ts
 * import { practiceKgDocumentFieldTiers } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(practiceKgDocumentFieldTiers.minimal.fields))
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const practiceKgDocumentFieldTiers = defineFieldTiers({
  minimal: S.Struct({
    digest: S.String,
    organizedPath: S.NullOr(S.String),
    pointer: S.NullOr(S.String),
  }),
  balanced: S.Struct({
    digest: S.String,
    docket: S.NullOr(S.String),
    family: S.NullOr(S.String),
    organizedPath: S.NullOr(S.String),
    pointer: S.NullOr(S.String),
    score: S.NullOr(S.Finite),
    snippet: S.NullOr(S.String),
  }),
  complete: S.Struct({
    digest: S.String,
    docket: S.NullOr(S.String),
    family: S.NullOr(S.String),
    organizedPath: S.NullOr(S.String),
    pointer: S.NullOr(S.String),
    score: S.NullOr(S.Finite),
    snippet: S.NullOr(S.String),
    sourceRelativePath: S.NullOr(S.String),
    text: S.NullOr(S.String),
    truncated: S.NullOr(S.Boolean),
  }),
});

/**
 * Progressive fields for DuckDB email-header rows.
 *
 * @example
 * ```ts
 * import { practiceKgEmailFieldTiers } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(practiceKgEmailFieldTiers.minimal.fields))
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const practiceKgEmailFieldTiers = defineFieldTiers({
  minimal: S.Struct({
    archiveDigest: S.String,
    messageRelPath: S.String,
    subject: S.String,
  }),
  balanced: S.Struct({
    archiveDigest: S.String,
    messageRelPath: S.String,
    recipients: S.String,
    senderEmail: S.NullOr(S.String),
    subject: S.String,
    submitIso: S.NullOr(S.String),
  }),
  complete: S.Struct({
    archiveDigest: S.String,
    conversationTopic: S.NullOr(S.String),
    deliveryIso: S.NullOr(S.String),
    folderPath: S.String,
    messageRelPath: S.String,
    recipients: S.String,
    senderEmail: S.NullOr(S.String),
    senderName: S.NullOr(S.String),
    subject: S.String,
    submitIso: S.NullOr(S.String),
  }),
});

/*
 * D-4/AC-5: the practice KG host is a strictly offline bundle reader, so the
 * MCP openWorldHint must be false — the mcp-kit readOnly preset advertises an
 * open world, which is wrong here.
 */
const closedWorldReadOnlyHints = FourHintAnnotations.make({
  destructive: false,
  idempotent: true,
  openWorld: false,
  readOnly: true,
});

const readTool = <Name extends string, Parameters extends S.Top, Success extends S.Top>(
  name: Name,
  description: string,
  parameters: Parameters,
  success: Success
) =>
  annotateFourHints(
    Tool.make(name, {
      description,
      failure: PracticeKgToolError,
      failureMode: "return",
      parameters,
      success,
    }),
    closedWorldReadOnlyHints
  );

/**
 * Lists sparse client attribution and unattributed docket-family counts.
 *
 * @example
 * ```ts
 * import { KgClientsTool } from "@beep/law-practice-use-cases/server"
 * console.log(KgClientsTool.name) // "kg_clients"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const KgClientsTool = readTool(
  "kg_clients",
  "List client attribution. Attribution is sparse; docket families are the primary practice spine.",
  BudgetParams,
  PracticeKgToolResult
);

/**
 * Resolves one docket family and its dockets, applications, patents, and documents.
 *
 * @example
 * ```ts
 * import { KgDocketFamilyTool } from "@beep/law-practice-use-cases/server"
 * console.log(KgDocketFamilyTool.name)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const KgDocketFamilyTool = readTool(
  "kg_docket_family",
  "Resolve a docket family and progressively disclose its dockets, application chain, and documents.",
  DocketFamilyParams,
  PracticeKgToolResult
);

/**
 * Looks up an application chain by application number, patent number, or docket.
 *
 * @example
 * ```ts
 * import { KgApplicationLookupTool } from "@beep/law-practice-use-cases/server"
 * console.log(KgApplicationLookupTool.name)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const KgApplicationLookupTool = readTool(
  "kg_application_lookup",
  "Resolve an application and walk docket, grant, continuation, and enriched-family relationships.",
  ApplicationLookupParams,
  PracticeKgToolResult
);

/**
 * Finds graph nodes by label or natural-key fragment.
 *
 * @example
 * ```ts
 * import { KgFindTool } from "@beep/law-practice-use-cases/server"
 * console.log(KgFindTool.name)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const KgFindTool = readTool(
  "kg_find",
  "Find graph spine nodes by name or number fragment. Unsorted documents require corpus_search_text.",
  FindParams,
  PracticeKgToolResult
);

/**
 * Searches extracted corpus text using the bundle's deterministic BM25 index.
 *
 * @example
 * ```ts
 * import { CorpusSearchTextTool } from "@beep/law-practice-use-cases/server"
 * console.log(CorpusSearchTextTool.name)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const CorpusSearchTextTool = readTool(
  "corpus_search_text",
  "Search extracted corpus text with BM25 and digest-cited snippets.",
  SearchTextParams,
  PracticeKgToolResult
);

/**
 * Gets document text or a corpus pointer by digest or organized path.
 *
 * @example
 * ```ts
 * import { CorpusGetDocumentTool } from "@beep/law-practice-use-cases/server"
 * console.log(CorpusGetDocumentTool.name)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const CorpusGetDocumentTool = readTool(
  "corpus_get_document",
  "Get a bounded document-text range, degrading to a corpus pointer when text is absent or oversized.",
  GetDocumentParams,
  PracticeKgToolResult
);

/**
 * Searches header-only email metadata with archive-level family confidence.
 *
 * @example
 * ```ts
 * import { EmailSearchTool } from "@beep/law-practice-use-cases/server"
 * console.log(EmailSearchTool.name)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const EmailSearchTool = readTool(
  "email_search",
  "Search email headers. Matter linkage is an archive-level heuristic, not message-level proof.",
  EmailSearchParams,
  PracticeKgToolResult
);

/**
 * Declares the future candidate-claims lookup with a typed not-loaded result.
 *
 * @example
 * ```ts
 * import { KgCandidateClaimsTool } from "@beep/law-practice-use-cases/server"
 * console.log(KgCandidateClaimsTool.name)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const KgCandidateClaimsTool = readTool(
  "kg_candidate_claims",
  "Return candidate claims when the claims batch is loaded; this bundle currently reports a typed empty result.",
  CandidateClaimsParams,
  PracticeKgCandidateClaimsResult
);

/**
 * Resolves graph or document provenance, or bundle status when called without a key.
 *
 * @example
 * ```ts
 * import { KgProvenanceTool } from "@beep/law-practice-use-cases/server"
 * console.log(KgProvenanceTool.name)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const KgProvenanceTool = readTool(
  "kg_provenance",
  "Resolve node or document provenance; with no identity, return bundle build status.",
  ProvenanceParams,
  PracticeKgToolResult
);

/**
 * Complete nine-tool read-only practice KG toolkit declaration.
 *
 * @example
 * ```ts
 * import { PracticeKgToolkit } from "@beep/law-practice-use-cases/server"
 * console.log(Object.keys(PracticeKgToolkit.tools).length) // 9
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const PracticeKgToolkit = Toolkit.make(
  KgClientsTool,
  KgDocketFamilyTool,
  KgApplicationLookupTool,
  KgFindTool,
  CorpusSearchTextTool,
  CorpusGetDocumentTool,
  EmailSearchTool,
  KgCandidateClaimsTool,
  KgProvenanceTool
);

/**
 * Type of {@link PracticeKgToolkit}.
 *
 * @example
 * ```ts
 * import { PracticeKgToolkit } from "@beep/law-practice-use-cases/server"
 * import type { PracticeKgToolkit as PracticeKgToolkitType } from "@beep/law-practice-use-cases/server"
 *
 * const toolkit: PracticeKgToolkitType = PracticeKgToolkit
 * console.log(Object.keys(toolkit.tools).length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PracticeKgToolkit = typeof PracticeKgToolkit;
