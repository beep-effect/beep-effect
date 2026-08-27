/**
 * Schema-first bundle, replay, citation, and projection records for the fixed demo.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit, PosInt, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import {
  Approval,
  Component,
  ExpertClaim,
  Finish,
  IsoTimestamp,
  LotCertificate,
  ProductVariant,
  Project,
  QuoteLine,
  RFQ,
  Standard,
  SupplierOffer,
  Tool,
} from "./Ontology";

const $I = $LejeuneBoltWorkbenchId.create("domain/Bundle");

const RfqLayoutId = LiteralKit(["rfq-a", "rfq-b"]);

/**
 * Closed source-format vocabulary for the two fixture pairs.
 *
 * **Example** (Check the PDF format)
 *
 * ```ts
 * import { SourceFormat } from "@/domain/Bundle"
 *
 * console.log(SourceFormat.is["pdf-text-layer"]("pdf-text-layer")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
const SourceFormat = LiteralKit(["outlook-body-table", "xlsx-takeoff", "prose-email", "pdf-text-layer"]).pipe(
  $I.annoteSchema("SourceFormat", {
    description: "The four source formats in the two frozen RFQ fixture pairs.",
  })
);

/**
 * One deterministic parsed source document and its content hash.
 *
 * **Example** (Inspect the exact source text field)
 *
 * ```ts
 * import { SourceDocument } from "@/domain/Bundle"
 *
 * console.log(SourceDocument.fields.text !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceDocument extends S.Class<SourceDocument>($I`SourceDocument`)(
  {
    format: SourceFormat,
    id: S.NonEmptyString,
    layoutId: RfqLayoutId,
    mediaType: S.NonEmptyString,
    sha256: Sha256Hex,
    syntheticLabel: S.tag("SYNTHETIC"),
    text: S.NonEmptyString,
  },
  $I.annote("SourceDocument", {
    description: "A parsed synthetic source whose exact text and SHA-256 digest are stable across rebuilds.",
  })
) {}

/**
 * One source-backed normalized value with a strict re-sliceable anchor.
 *
 * **Example** (Inspect the anchor field)
 *
 * ```ts
 * import { ExtractedField } from "@/domain/Bundle"
 *
 * console.log(ExtractedField.fields.anchor !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractedField extends S.Class<ExtractedField>($I`ExtractedField`)(
  {
    anchor: TextAnchor,
    name: S.NonEmptyString,
    sourceDocumentId: S.NonEmptyString,
    value: S.NonEmptyString,
  },
  $I.annote("ExtractedField", {
    description: "A normalized field value grounded by @beep/langextract to an exact source-text slice.",
  })
) {}

/**
 * A required field deliberately absent from both documents in one fixture pair.
 *
 * **Example** (Inspect the question field)
 *
 * ```ts
 * import { MissingField } from "@/domain/Bundle"
 *
 * console.log(MissingField.fields.question !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MissingField extends S.Class<MissingField>($I`MissingField`)(
  {
    field: S.NonEmptyString,
    question: S.NonEmptyString,
    rfqId: S.NonEmptyString,
  },
  $I.annote("MissingField", {
    description: "An explicit missing value retained as a review question instead of inferred.",
  })
) {}

/**
 * Deterministic normalized output for one RFQ source pair.
 *
 * **Example** (Inspect the source collection)
 *
 * ```ts
 * import { NormalizedFixture } from "@/domain/Bundle"
 *
 * console.log(NormalizedFixture.fields.sources !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NormalizedFixture extends S.Class<NormalizedFixture>($I`NormalizedFixture`)(
  {
    components: S.NonEmptyArray(Component),
    extractedFields: S.NonEmptyArray(ExtractedField),
    missingFields: S.NonEmptyArray(MissingField),
    productVariant: ProductVariant,
    project: Project,
    quoteLine: QuoteLine,
    rfq: RFQ,
    sources: S.NonEmptyArray(SourceDocument),
  },
  $I.annote("NormalizedFixture", {
    description: "One complete deterministic RFQ normalization with split sources and retained missing values.",
  })
) {}

/**
 * Governing public source metadata and the bounded evidence used by a rule.
 *
 * **Example** (Inspect the opening URL field)
 *
 * ```ts
 * import { RuleSource } from "@/domain/Bundle"
 *
 * console.log(RuleSource.fields.url !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuleSource extends S.Class<RuleSource>($I`RuleSource`)(
  {
    accessedOn: S.Literal("2026-08-25"),
    evidence: S.NonEmptyString,
    evidenceAnchor: TextAnchor,
    id: S.NonEmptyString,
    researchPath: S.NonEmptyString,
    revision: S.NonEmptyString,
    title: S.NonEmptyString,
    url: S.NonEmptyString,
  },
  $I.annote("RuleSource", {
    description: "A rule authority that opens to a governing public source and pins a minimal exact evidence span.",
  })
) {}

/**
 * Exact three-rule identifier set frozen by the goal packet.
 *
 * **Example** (Inspect the rule count)
 *
 * ```ts
 * import { RuleId } from "@/domain/Bundle"
 *
 * console.log(RuleId.Options.length) // 3
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
const RuleId = LiteralKit(["matched-assembly", "dti-strength-match", "a490-hdg-refusal"]).pipe(
  $I.annoteSchema("RuleId", {
    description: "The complete three-rule advisory slice authorized for the lunch demo.",
  })
);

/**
 * Advisory outcome vocabulary with explicit human-stop states.
 *
 * **Example** (Check refusal membership)
 *
 * ```ts
 * import { RuleDisposition } from "@/domain/Bundle"
 *
 * console.log(RuleDisposition.is.refuse("refuse")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
const RuleDisposition = LiteralKit(["pass", "mismatch", "refuse", "human-review"]).pipe(
  $I.annoteSchema("RuleDisposition", {
    description: "Advisory rule outcomes; every non-pass result stops for an RFI or qualified human decision.",
  })
);

/**
 * One deterministic cited rule-check result.
 *
 * **Example** (Inspect the matched-facts field)
 *
 * ```ts
 * import { RuleResult } from "@/domain/Bundle"
 *
 * console.log(RuleResult.fields.matchedFacts !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuleResult extends S.Class<RuleResult>($I`RuleResult`)(
  {
    caseId: S.NonEmptyString,
    disposition: RuleDisposition,
    matchedFacts: S.NonEmptyArray(S.NonEmptyString),
    requiresHuman: S.Boolean,
    ruleId: RuleId,
    source: RuleSource,
    stopReason: S.NonEmptyString,
  },
  $I.annote("RuleResult", {
    description:
      "An advisory rule result carrying source, revision, exact evidence, facts, disposition, and stop point.",
  })
) {}

/**
 * Minimal sanitized candidate retained from the successful hosted extraction.
 *
 * **Example** (Inspect the candidate text field)
 *
 * ```ts
 * import { ProviderCandidate } from "@/domain/Bundle"
 *
 * console.log(ProviderCandidate.fields.text !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProviderCandidate extends S.Class<ProviderCandidate>($I`ProviderCandidate`)(
  {
    label: S.NonEmptyString,
    text: S.NonEmptyString,
  },
  $I.annote("ProviderCandidate", {
    description: "A provider candidate stripped of request ids, usage, authorization data, and transport metadata.",
  })
) {}

/**
 * Sanitized successful provider output embedded for deterministic replay.
 *
 * **Example** (Inspect the provider field)
 *
 * ```ts
 * import { ProviderRecording } from "@/domain/Bundle"
 *
 * console.log(ProviderRecording.fields.provider !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProviderRecording extends S.Class<ProviderRecording>($I`ProviderRecording`)(
  {
    candidates: S.NonEmptyArray(ProviderCandidate),
    documentId: S.NonEmptyString,
    model: S.NonEmptyString,
    provider: LiteralKit(["anthropic", "openai-compat", "venice-ai", "xai"]),
    recordedAt: IsoTimestamp,
    responseSha256: Sha256Hex,
    status: S.tag("recorded-success"),
  },
  $I.annote("ProviderRecording", {
    description: "A sanitized successful live extraction recording that makes the golden run provider-independent.",
  })
) {}

/**
 * Stable committed query results from all three local projection engines.
 *
 * **Example** (Inspect the ontology class collection)
 *
 * ```ts
 * import { ProjectionSnapshot } from "@/domain/Bundle"
 *
 * console.log(ProjectionSnapshot.fields.ontologyClasses !== undefined) // true
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ProjectionSnapshot extends S.Class<ProjectionSnapshot>($I`ProjectionSnapshot`)(
  {
    citations: S.NonEmptyArray(S.NonEmptyString),
    documentCount: PosInt,
    ontologyClasses: S.NonEmptyArray(S.NonEmptyString),
    quoteLines: S.NonEmptyArray(S.NonEmptyString),
    ruleDispositions: S.NonEmptyArray(S.NonEmptyString),
    syntheticRecords: S.NonEmptyArray(S.NonEmptyString),
  },
  $I.annote("ProjectionSnapshot", {
    description: "Stable PGlite, DuckDB, and bounded Oxigraph query outputs for the committed golden run.",
  })
) {}

/**
 * Immutable replay bundle assembled from normalized fixtures and cited results.
 *
 * **Example** (Inspect the retention field)
 *
 * ```ts
 * import { ImmutableDemoBundle } from "@/domain/Bundle"
 *
 * console.log(ImmutableDemoBundle.fields.mutableCorpusDispositionDate !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImmutableDemoBundle extends S.Class<ImmutableDemoBundle>($I`ImmutableDemoBundle`)(
  {
    bundleVersion: S.Literal("lejeune-demo-bundle/v1"),
    certificates: S.NonEmptyArray(LotCertificate),
    finishes: S.NonEmptyArray(Finish),
    fixtures: S.NonEmptyArray(NormalizedFixture),
    mutableCorpusDisposition: S.Literal("delete-or-promote"),
    mutableCorpusDispositionDate: S.Literal("2026-09-30"),
    offers: S.NonEmptyArray(SupplierOffer),
    projection: ProjectionSnapshot,
    providerRecording: ProviderRecording,
    rules: S.NonEmptyArray(RuleResult),
    standards: S.NonEmptyArray(Standard),
    tools: S.NonEmptyArray(Tool),
  },
  $I.annote("ImmutableDemoBundle", {
    description: "The complete immutable replay payload; mutable approvals and reviewed claims are stored separately.",
  })
) {}

/**
 * Separately mounted mutable review ledger excluded from bundle identity.
 *
 * **Example** (Inspect the disposition date)
 *
 * ```ts
 * import { MutableReviewLedger } from "@/domain/Bundle"
 *
 * console.log(MutableReviewLedger.fields.dispositionDate !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MutableReviewLedger extends S.Class<MutableReviewLedger>($I`MutableReviewLedger`)(
  {
    approvals: S.Array(Approval),
    claims: S.Array(ExpertClaim),
    disposition: S.Literal("delete-or-promote"),
    dispositionDate: S.Literal("2026-09-30"),
    schemaVersion: S.Literal("lejeune-review-ledger/v1"),
  },
  $I.annote("MutableReviewLedger", {
    description: "Mutable approvals and reviewed claims governed by the explicit 2026-09-30 disposition.",
  })
) {}

/**
 * Golden replay receipt with a stable bundle identity and explicit offline posture.
 *
 * **Example** (Inspect the network field)
 *
 * ```ts
 * import { GoldenReplayReceipt } from "@/domain/Bundle"
 *
 * console.log(GoldenReplayReceipt.fields.networkAvailable !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoldenReplayReceipt extends S.Class<GoldenReplayReceipt>($I`GoldenReplayReceipt`)(
  {
    bundleIdentity: Sha256Hex,
    networkAvailable: S.Literal(false),
    projection: ProjectionSnapshot,
    providerAvailable: S.Literal(false),
    replayMode: S.Literal("recorded-offline"),
  },
  $I.annote("GoldenReplayReceipt", {
    description:
      "Proof that normalized data, rules, citations, projections, and identity replay without network or provider.",
  })
) {}

/** JSON codec used to persist the immutable bundle without native JSON helpers. @category codecs @since 0.0.0 */
export const ImmutableDemoBundleFromJsonString = S.fromJsonString(ImmutableDemoBundle, { space: 2 });

/** JSON codec used to persist the mutable ledger without native JSON helpers. @category codecs @since 0.0.0 */
export const MutableReviewLedgerFromJsonString = S.fromJsonString(MutableReviewLedger, { space: 2 });

/** JSON codec used to persist the golden replay receipt without native JSON helpers. @category codecs @since 0.0.0 */
export const GoldenReplayReceiptFromJsonString = S.fromJsonString(GoldenReplayReceipt, { space: 2 });

/** JSON codec for the sanitized successful provider recording. @category codecs @since 0.0.0 */
export const ProviderRecordingFromJsonString = S.fromJsonString(ProviderRecording, { space: 2 });
