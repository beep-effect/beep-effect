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
import { KgNodeKind, PracticeKgEpistemicStatus, PracticeKgProvenanceKind } from "@beep/law-practice-domain/values";
import {
  annotateFourHints,
  ColumnarEnvelope,
  defineFieldTiers,
  FieldTierName,
  FourHintAnnotations,
} from "@beep/mcp-kit";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool } from "effect/unstable/ai";

const $I = $LawPracticeUseCasesId.create("PracticeKg.tools");
const defaultBudgetBytes = PosInt.make(8000);

/*
 * Tool rows admit the persisted domain literals plus the synthetic members the
 * bundle-status row uses when kg_provenance is called without an identity —
 * "bundle" is not a kg_node kind and "bundle-manifest" is not a stored
 * provenance kind, so the domain kits stay closed.
 */
const PracticeKgToolNodeKind = S.Union([KgNodeKind, S.Literal("bundle")]);
const PracticeKgToolProvenanceKind = S.Union([PracticeKgProvenanceKind, S.Literal("bundle-manifest")]);

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

/* Whole-document read: start at 1 with a 2 MiB character budget. */
const defaultDocumentRange = DocumentRange.make({ length: PosInt.make(2_097_152), start: PosInt.make(1) });

class GetDocumentParams extends S.Class<GetDocumentParams>($I`GetDocumentParams`)(
  {
    budgetBytes: BudgetBytes,
    digest: S.optionalKey(S.NonEmptyString),
    organized_path: S.optionalKey(S.NonEmptyString),
    range: DocumentRange.pipe(SchemaUtils.withKeyDefaults(defaultDocumentRange)),
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
 * **Example** (Make tool error instance)
 *
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
 * **Example** (Make budgeted tool result)
 *
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
    epistemic_status: PracticeKgEpistemicStatus,
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
 * Typed empty response returned when a bundle has no claims batch.
 *
 * **Example** (Make not-loaded claims result)
 *
 * ```ts
 * import { PracticeKgCandidateClaimsNotLoadedResult } from "@beep/law-practice-use-cases/server"
 *
 * const result = PracticeKgCandidateClaimsNotLoadedResult.make({
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
export class PracticeKgCandidateClaimsNotLoadedResult extends S.Class<PracticeKgCandidateClaimsNotLoadedResult>(
  $I`PracticeKgCandidateClaimsNotLoadedResult`
)(
  {
    available: S.Literal(false),
    bundle_version: S.NonEmptyString,
    epistemic_status: S.Literal("candidate-unreviewed"),
    reason: S.Literal("claims batch not yet loaded"),
  },
  $I.annote("PracticeKgCandidateClaimsNotLoadedResult", {
    description: "Manifest-labelled empty result used before candidate claims are loaded.",
  })
) {}

/**
 * Candidate-claims response: either a budgeted loaded result or the typed
 * not-loaded state used by bundles built before the claims batch.
 *
 * **Example** (Check not-loaded claims union)
 *
 * ```ts
 * import { PracticeKgCandidateClaimsNotLoadedResult, PracticeKgCandidateClaimsResult } from "@beep/law-practice-use-cases/server"
 *
 * const result = PracticeKgCandidateClaimsNotLoadedResult.make({
 *   available: false,
 *   bundle_version: "2026-07-27-01",
 *   epistemic_status: "candidate-unreviewed",
 *   reason: "claims batch not yet loaded"
 * })
 * console.log(PracticeKgCandidateClaimsResult.is(result)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PracticeKgCandidateClaimsResult = S.Union([
  PracticeKgCandidateClaimsNotLoadedResult,
  PracticeKgToolResult,
]).pipe(
  $I.annoteSchema("PracticeKgCandidateClaimsResult", {
    description: "Loaded candidate-claim rows or a typed not-loaded bundle state.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PracticeKgCandidateClaimsResult}.
 *
 * **Example** (Type claims result parameter)
 *
 * ```ts
 * import type { PracticeKgCandidateClaimsResult } from "@beep/law-practice-use-cases/server"
 *
 * const read = (result: PracticeKgCandidateClaimsResult) => result.bundle_version
 * console.log(typeof read) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgCandidateClaimsResult = typeof PracticeKgCandidateClaimsResult.Type;

/**
 * PGlite graph row shared by decoding and field-tier projection.
 *
 * **Example** (Inspect graph row fields)
 *
 * ```ts
 * import { PracticeKgGraphToolRow } from "@beep/law-practice-use-cases/server"
 *
 * console.log(PracticeKgGraphToolRow.fields.naturalKey)
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class PracticeKgGraphToolRow extends S.Class<PracticeKgGraphToolRow>($I`PracticeKgGraphToolRow`)(
  {
    client: S.NullOr(S.String),
    count: S.NullOr(S.Finite),
    docketFamily: S.NullOr(S.String),
    epistemicStatus: PracticeKgEpistemicStatus,
    iri: S.String,
    kind: PracticeKgToolNodeKind,
    label: S.String,
    naturalKey: S.String,
    provenanceKind: PracticeKgToolProvenanceKind,
    provenanceRef: S.String,
  },
  $I.annote("PracticeKgGraphToolRow", { description: "Decoded graph row exposed through practice KG tools." })
) {}

/**
 * Docket-family aggregate row shared by decoding and field-tier projection.
 *
 * **Example** (Inspect family row fields)
 *
 * ```ts
 * import { PracticeKgFamilyToolRow } from "@beep/law-practice-use-cases/server"
 *
 * console.log(PracticeKgFamilyToolRow.fields.family)
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class PracticeKgFamilyToolRow extends S.Class<PracticeKgFamilyToolRow>($I`PracticeKgFamilyToolRow`)(
  {
    application: S.NullOr(S.String),
    applicationCount: S.Finite,
    docket: S.NullOr(S.String),
    docketCount: S.Finite,
    documentCount: S.Finite,
    documentDigest: S.NullOr(S.String),
    documentLabel: S.NullOr(S.String),
    family: S.String,
    patent: S.NullOr(S.String),
  },
  $I.annote("PracticeKgFamilyToolRow", { description: "Decoded docket-family aggregate tool row." })
) {}

/**
 * Corpus document row shared by decoding and field-tier projection.
 *
 * **Example** (Inspect document row fields)
 *
 * ```ts
 * import { PracticeKgDocumentToolRow } from "@beep/law-practice-use-cases/server"
 *
 * console.log(PracticeKgDocumentToolRow.fields.digest)
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class PracticeKgDocumentToolRow extends S.Class<PracticeKgDocumentToolRow>($I`PracticeKgDocumentToolRow`)(
  {
    digest: S.String,
    docket: S.NullOr(S.String),
    family: S.NullOr(S.String),
    organizedPath: S.NullOr(S.String),
    pointer: S.NullOr(S.String),
    score: S.NullOr(S.Finite),
    snippet: S.NullOr(S.String),
    sourceOriginChain: S.NullOr(S.String),
    sourceRelativePath: S.NullOr(S.String),
    text: S.NullOr(S.String),
    truncated: S.NullOr(S.Boolean),
  },
  $I.annote("PracticeKgDocumentToolRow", { description: "Decoded corpus document tool row." })
) {}

/**
 * Email header row shared by decoding and field-tier projection.
 *
 * **Example** (Inspect email row fields)
 *
 * ```ts
 * import { PracticeKgEmailToolRow } from "@beep/law-practice-use-cases/server"
 *
 * console.log(PracticeKgEmailToolRow.fields.subject)
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class PracticeKgEmailToolRow extends S.Class<PracticeKgEmailToolRow>($I`PracticeKgEmailToolRow`)(
  {
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
  },
  $I.annote("PracticeKgEmailToolRow", { description: "Decoded header-only email tool row." })
) {}

/**
 * Candidate claim with one resolvable evidence span.
 *
 * **Example** (Inspect claim row fields)
 *
 * ```ts
 * import { PracticeKgCandidateClaimToolRow } from "@beep/law-practice-use-cases/server"
 *
 * console.log(PracticeKgCandidateClaimToolRow.fields.label)
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export class PracticeKgCandidateClaimToolRow extends S.Class<PracticeKgCandidateClaimToolRow>(
  $I`PracticeKgCandidateClaimToolRow`
)(
  {
    activityOperation: S.String,
    claimText: S.String,
    digest: S.String,
    docket: S.String,
    endChar: NonNegativeInt,
    evidenceQuote: S.String,
    family: S.String,
    label: S.Literal("candidate — unreviewed"),
    sourceFile: S.String,
    startChar: NonNegativeInt,
  },
  $I.annote("PracticeKgCandidateClaimToolRow", {
    description: "Candidate claim row carrying its docket join, extraction activity, and evidence span.",
  })
) {}

/**
 * Progressive fields for PGlite graph-node and relationship query rows.
 *
 * **Example** (List minimal graph fields)
 *
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
    count: PracticeKgGraphToolRow.fields.count,
    kind: PracticeKgGraphToolRow.fields.kind,
    label: PracticeKgGraphToolRow.fields.label,
    naturalKey: PracticeKgGraphToolRow.fields.naturalKey,
  }),
  balanced: S.Struct({
    client: PracticeKgGraphToolRow.fields.client,
    count: PracticeKgGraphToolRow.fields.count,
    docketFamily: PracticeKgGraphToolRow.fields.docketFamily,
    iri: PracticeKgGraphToolRow.fields.iri,
    kind: PracticeKgGraphToolRow.fields.kind,
    label: PracticeKgGraphToolRow.fields.label,
    naturalKey: PracticeKgGraphToolRow.fields.naturalKey,
  }),
  complete: S.Struct({
    ...PracticeKgGraphToolRow.fields,
  }),
});

/**
 * Progressive fields for docket-family aggregate rows.
 *
 * **Example** (Check complete family fields)
 *
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
    applicationCount: PracticeKgFamilyToolRow.fields.applicationCount,
    docketCount: PracticeKgFamilyToolRow.fields.docketCount,
    documentCount: PracticeKgFamilyToolRow.fields.documentCount,
    family: PracticeKgFamilyToolRow.fields.family,
  }),
  balanced: S.Struct({
    applicationCount: PracticeKgFamilyToolRow.fields.applicationCount,
    docket: PracticeKgFamilyToolRow.fields.docket,
    docketCount: PracticeKgFamilyToolRow.fields.docketCount,
    documentCount: PracticeKgFamilyToolRow.fields.documentCount,
    family: PracticeKgFamilyToolRow.fields.family,
    patent: PracticeKgFamilyToolRow.fields.patent,
  }),
  complete: S.Struct({
    ...PracticeKgFamilyToolRow.fields,
  }),
});

/**
 * Progressive fields for DuckDB corpus document rows.
 *
 * **Example** (List minimal document fields)
 *
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
    digest: PracticeKgDocumentToolRow.fields.digest,
    organizedPath: PracticeKgDocumentToolRow.fields.organizedPath,
    pointer: PracticeKgDocumentToolRow.fields.pointer,
  }),
  balanced: S.Struct({
    digest: PracticeKgDocumentToolRow.fields.digest,
    docket: PracticeKgDocumentToolRow.fields.docket,
    family: PracticeKgDocumentToolRow.fields.family,
    organizedPath: PracticeKgDocumentToolRow.fields.organizedPath,
    pointer: PracticeKgDocumentToolRow.fields.pointer,
    score: PracticeKgDocumentToolRow.fields.score,
    snippet: PracticeKgDocumentToolRow.fields.snippet,
  }),
  complete: S.Struct({
    ...PracticeKgDocumentToolRow.fields,
  }),
});

/**
 * Progressive fields for DuckDB email-header rows.
 *
 * **Example** (List minimal email fields)
 *
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
    archiveDigest: PracticeKgEmailToolRow.fields.archiveDigest,
    messageRelPath: PracticeKgEmailToolRow.fields.messageRelPath,
    subject: PracticeKgEmailToolRow.fields.subject,
  }),
  balanced: S.Struct({
    archiveDigest: PracticeKgEmailToolRow.fields.archiveDigest,
    messageRelPath: PracticeKgEmailToolRow.fields.messageRelPath,
    recipients: PracticeKgEmailToolRow.fields.recipients,
    senderEmail: PracticeKgEmailToolRow.fields.senderEmail,
    subject: PracticeKgEmailToolRow.fields.subject,
    submitIso: PracticeKgEmailToolRow.fields.submitIso,
  }),
  complete: S.Struct({
    ...PracticeKgEmailToolRow.fields,
  }),
});

class PracticeKgCandidateClaimMinimalRow extends S.Class<PracticeKgCandidateClaimMinimalRow>(
  $I`PracticeKgCandidateClaimMinimalRow`
)(
  {
    claimText: PracticeKgCandidateClaimToolRow.fields.claimText,
    docket: PracticeKgCandidateClaimToolRow.fields.docket,
    label: PracticeKgCandidateClaimToolRow.fields.label,
    sourceFile: PracticeKgCandidateClaimToolRow.fields.sourceFile,
  },
  $I.annote("PracticeKgCandidateClaimMinimalRow", {
    description: "Minimal grounded candidate-claim projection.",
  })
) {}

class PracticeKgCandidateClaimBalancedRow extends S.Class<PracticeKgCandidateClaimBalancedRow>(
  $I`PracticeKgCandidateClaimBalancedRow`
)(
  {
    claimText: PracticeKgCandidateClaimToolRow.fields.claimText,
    digest: PracticeKgCandidateClaimToolRow.fields.digest,
    docket: PracticeKgCandidateClaimToolRow.fields.docket,
    evidenceQuote: PracticeKgCandidateClaimToolRow.fields.evidenceQuote,
    family: PracticeKgCandidateClaimToolRow.fields.family,
    label: PracticeKgCandidateClaimToolRow.fields.label,
  },
  $I.annote("PracticeKgCandidateClaimBalancedRow", {
    description: "Balanced grounded candidate-claim projection.",
  })
) {}

/**
 * Progressive fields for grounded candidate claim rows.
 *
 * **Example** (Check complete claim fields)
 *
 * ```ts
 * import { practiceKgCandidateClaimFieldTiers } from "@beep/law-practice-use-cases/server"
 *
 * console.log(Object.keys(practiceKgCandidateClaimFieldTiers.complete.fields).includes("evidenceQuote"))
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const practiceKgCandidateClaimFieldTiers = defineFieldTiers({
  minimal: S.Struct(PracticeKgCandidateClaimMinimalRow.fields),
  balanced: S.Struct(PracticeKgCandidateClaimBalancedRow.fields),
  complete: S.Struct(PracticeKgCandidateClaimToolRow.fields),
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
 * **Example** (Log clients tool name)
 *
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
 * **Example** (Log docket family tool name)
 *
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
 * **Example** (Log application lookup name)
 *
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
 * **Example** (Log find tool name)
 *
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
 * **Example** (Log corpus search tool name)
 *
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
 * **Example** (Log get document tool name)
 *
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
 * **Example** (Log email search tool name)
 *
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
 * Declares candidate-claims lookup with a typed fallback for older bundles.
 *
 * **Example** (Log candidate claims tool name)
 *
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
  "Return candidate — unreviewed claims with resolvable evidence spans, or a typed not-loaded result for older bundles.",
  CandidateClaimsParams,
  PracticeKgCandidateClaimsResult
);

/**
 * Resolves graph or document provenance, or bundle status when called without a key.
 *
 * **Example** (Log provenance tool name)
 *
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
