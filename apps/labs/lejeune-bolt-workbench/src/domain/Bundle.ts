/**
 * Schema-first bundle, replay, citation, and projection records for the fixed demo.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit, PosixPath, SchemaUtils, Sha256Hex } from "@beep/schema";
import { HttpsUrl } from "@beep/schema/URL";
import { Effect, identity, Number as N, Order } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  Approval,
  Component,
  EntityId,
  ExpertClaim,
  Finish,
  IsoDate,
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
import { buildReferenceData } from "./ReferenceData";

const $I = $LejeuneBoltWorkbenchId.create("domain/Bundle");

/** Stable immutable bundle contract revision. @category versions @since 0.0.0 */
export const BUNDLE_VERSION = "lejeune-demo-bundle/v1";

/** Fixed disposition date for the separately mounted mutable review corpus. @category retention @since 0.0.0 */
export const MUTABLE_CORPUS_DISPOSITION_DATE = "2026-09-30";

const RfqLayoutId = LiteralKit(["rfq-a", "rfq-b"]).pipe(
  $I.annoteSchema("RfqLayoutId", {
    description: "The exact two authorized source layouts in the fixed demo corpus.",
  })
);

/**
 * Closed source-format vocabulary for the two fixture pairs.
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
    id: EntityId,
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
    sourceDocumentId: EntityId,
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
    rfqId: EntityId,
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
const NormalizedFixtureFields = S.Struct({
  components: S.Union([S.Tuple([Component, Component]), S.Tuple([Component, Component, Component, Component])]),
  extractedFields: S.Tuple([
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
  ]),
  missingFields: S.Tuple([MissingField]),
  productVariant: ProductVariant,
  project: Project,
  quoteLine: QuoteLine,
  rfq: RFQ,
  sources: S.Tuple([SourceDocument, SourceDocument]),
});

type NormalizedFixtureFields = typeof NormalizedFixtureFields.Type;

const fixtureAnchorsAreGrounded = (fixture: NormalizedFixtureFields): boolean =>
  A.every(fixture.extractedFields, (field) =>
    A.findFirst(fixture.sources, (source) => Str.Equivalence(source.id, field.sourceDocumentId)).pipe(
      O.exists(
        (source) =>
          Str.Equivalence(Str.slice(field.anchor.startChar, field.anchor.endChar)(source.text), field.anchor.quote) &&
          Str.Equivalence(field.anchor.quote, field.value)
      )
    )
  );

const fixtureHasExpectedComponentCardinality = (fixture: NormalizedFixtureFields): boolean => {
  const [firstSource, secondSource] = fixture.sources;
  const layoutId = firstSource.layoutId;
  const isRfqA = RfqLayoutId.is["rfq-a"](layoutId);
  const expectedComponentCount = isRfqA ? 4 : 2;
  const sourceFormats = A.map(fixture.sources, (source) => source.format);
  const hasExpectedSourceFormats = isRfqA
    ? A.contains(sourceFormats, "outlook-body-table") && A.contains(sourceFormats, "xlsx-takeoff")
    : A.contains(sourceFormats, "prose-email") && A.contains(sourceFormats, "pdf-text-layer");
  return A.every(
    [
      A.length(fixture.components) === expectedComponentCount,
      Str.Equivalence(secondSource.layoutId, layoutId),
      hasExpectedSourceFormats,
    ],
    identity
  );
};

const fixtureCoreReferencesAreClosed = (fixture: NormalizedFixtureFields): boolean => {
  const [missing] = fixture.missingFields;
  const [firstSource] = fixture.sources;
  return A.every(
    [
      Str.Equivalence(fixture.rfq.id, firstSource.layoutId),
      Str.Equivalence(fixture.project.id, fixture.rfq.projectId),
      Str.Equivalence(fixture.quoteLine.rfqId, fixture.rfq.id),
      Str.Equivalence(fixture.quoteLine.productVariantId, fixture.productVariant.id),
      Str.Equivalence(fixture.rfq.quoteLineIds[0], fixture.quoteLine.id),
      Str.Equivalence(missing.rfqId, fixture.rfq.id),
      Str.Equivalence(missing.field, fixture.rfq.missingFields[0]),
    ],
    identity
  );
};

const fixtureSourceReferencesAreClosed = (fixture: NormalizedFixtureFields): boolean => {
  const sourceIds = A.map(fixture.sources, (source) => source.id);
  const identitiesAreUnique = A.length(A.dedupe(sourceIds)) === A.length(sourceIds);
  const rfqReferencesSources = A.every(fixture.rfq.sourceDocumentIds, (id) => A.contains(sourceIds, id));
  const sourcesAreReferenced = A.every(sourceIds, (id) => A.contains(fixture.rfq.sourceDocumentIds, id));
  return A.every([identitiesAreUnique, rfqReferencesSources, sourcesAreReferenced], identity);
};

const fixtureComponentReferencesAreClosed = (fixture: NormalizedFixtureFields): boolean => {
  const componentIds = A.map(fixture.components, (component) => component.id);
  return A.every(
    [
      A.length(fixture.productVariant.componentIds) === A.length(componentIds),
      A.length(A.dedupe(componentIds)) === A.length(componentIds),
      A.length(A.dedupe(fixture.productVariant.componentIds)) === A.length(fixture.productVariant.componentIds),
      A.every(componentIds, (id) => A.contains(fixture.productVariant.componentIds, id)),
    ],
    identity
  );
};

const fixtureReferencesAreClosed = (fixture: NormalizedFixtureFields): boolean =>
  A.every(
    [
      fixtureHasExpectedComponentCardinality(fixture),
      fixtureCoreReferencesAreClosed(fixture),
      fixtureSourceReferencesAreClosed(fixture),
      fixtureComponentReferencesAreClosed(fixture),
    ],
    identity
  );

const NormalizedFixtureChecks = S.makeFilterGroup(
  [
    S.makeFilter(fixtureAnchorsAreGrounded, {
      identifier: $I`NormalizedFixtureGroundingCheck`,
      title: "Normalized Fixture Exact Grounding",
      description: "Requires every extracted value to re-slice its referenced source exactly.",
      message: "Every extracted value must equal the exact anchored slice of its referenced source.",
    }),
    S.makeFilter(fixtureReferencesAreClosed, {
      identifier: $I`NormalizedFixtureReferenceCheck`,
      title: "Normalized Fixture Closed References",
      description: "Requires all fixed fixture identities and cardinalities to agree across the normalized graph.",
      message: "Normalized fixture references, layout cardinality, and missing-field identities must agree.",
    }),
  ],
  {
    identifier: $I`NormalizedFixtureChecks`,
    title: "Normalized Fixture",
    description: "Checks exact grounding and closed referential integrity for a persisted fixture.",
  }
);

const NormalizedFixtureSchema = NormalizedFixtureFields.mapFields(identity).check(NormalizedFixtureChecks);

export class NormalizedFixture extends S.Class<NormalizedFixture>($I`NormalizedFixture`)(
  NormalizedFixtureSchema,
  $I.annote("NormalizedFixture", {
    description: "One complete deterministic RFQ normalization with split sources and retained missing values.",
  })
) {}

/** Validate already-decoded nested values and construct one normalized fixture. @category constructors @since 0.0.0 */
export const makeNormalizedFixture = (input: unknown) =>
  S.decodeUnknownEffect(S.toType(NormalizedFixtureSchema))(input).pipe(
    Effect.map((fields) => NormalizedFixture.make(fields))
  );

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
const RuleSourceFields = S.Struct({
  accessedOn: S.Literal("2026-08-25"),
  evidence: S.NonEmptyString,
  evidenceAnchor: TextAnchor,
  id: EntityId,
  researchPath: PosixPath,
  revision: S.NonEmptyString,
  title: S.NonEmptyString,
  url: HttpsUrl,
});

const RuleSourceEvidenceCheck = S.makeFilter(
  (source: typeof RuleSourceFields.Type) =>
    Str.Equivalence(
      Str.slice(source.evidenceAnchor.startChar, source.evidenceAnchor.endChar)(source.evidence),
      source.evidenceAnchor.quote
    ) && Str.Equivalence(source.evidenceAnchor.quote, source.evidence),
  {
    identifier: $I`RuleSourceEvidenceCheck`,
    title: "Rule Source Exact Evidence",
    description: "Requires the persisted evidence anchor to reproduce the complete bounded rule evidence.",
    message: "Rule source evidence must exactly match its persisted evidence anchor.",
  }
);

export class RuleSource extends S.Class<RuleSource>($I`RuleSource`)(
  RuleSourceFields.mapFields(identity).check(RuleSourceEvidenceCheck),
  $I.annote("RuleSource", {
    description: "A rule authority that opens to a governing public source and pins a minimal exact evidence span.",
  })
) {}

/**
 * Exact three-rule identifier set frozen by the goal packet.
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
const RuleResultFields = S.Struct({
  caseId: EntityId,
  disposition: RuleDisposition,
  matchedFacts: S.NonEmptyArray(S.NonEmptyString),
  requiresHuman: S.Boolean,
  ruleId: RuleId,
  source: RuleSource,
  stopReason: S.NonEmptyString,
});

const RuleResultHumanStopCheck = S.makeFilter(
  (result: typeof RuleResultFields.Type) => result.requiresHuman === !RuleDisposition.is.pass(result.disposition),
  {
    identifier: $I`RuleResultHumanStopCheck`,
    title: "Rule Result Human Stop",
    description: "Requires every non-pass disposition, and only a non-pass disposition, to stop for a human.",
    message: "RuleResult requiresHuman must be false for pass and true for every non-pass disposition.",
  }
);

export class RuleResult extends S.Class<RuleResult>($I`RuleResult`)(
  RuleResultFields.mapFields(identity).check(RuleResultHumanStopCheck),
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
const ProviderCandidateLabel = LiteralKit(["project", "delivery_date", "finish"]).pipe(
  $I.annoteSchema("ProviderCandidateLabel", {
    description: "The exact three extraction labels authorized by the frozen RFQ A provider contract.",
  })
);

export class ProviderCandidate extends S.Class<ProviderCandidate>($I`ProviderCandidate`)(
  {
    label: ProviderCandidateLabel,
    text: S.NonEmptyString,
  },
  $I.annote("ProviderCandidate", {
    description: "A provider candidate stripped of request ids, usage, authorization data, and transport metadata.",
  })
) {}

/** Exact sanitized source text authorized for provider-recording verification. @category fixtures @since 0.0.0 */
export const PROVIDER_RECORDING_SOURCE_TEXT =
  "SYNTHETIC RFQ A | Project North Loop Canopy | Delivery 2026-09-12 | Domestic required | Finish MG B695 Class 55";

/** Exact request identity authorized by provider-recording contract v1. @category fixtures @since 0.0.0 */
export const PROVIDER_RECORDING_DOCUMENT_ID = EntityId.make("lejeune-provider-smoke-rfq-a");

/** Canonical compact codec used when hashing a sanitized candidate list. @category codecs @since 0.0.0 */
export const ProviderCandidateListFromJsonString = S.fromJsonString(
  S.Tuple([ProviderCandidate, ProviderCandidate, ProviderCandidate])
);

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
    candidates: S.Tuple([ProviderCandidate, ProviderCandidate, ProviderCandidate]),
    documentId: S.Literal(PROVIDER_RECORDING_DOCUMENT_ID),
    extractionContractRevision: S.tag("lejeune-rfq-a-extraction/v1"),
    model: S.NonEmptyString,
    provider: LiteralKit(["anthropic", "openai-compat", "venice-ai", "xai"]),
    recordedAt: IsoTimestamp,
    responseSha256: Sha256Hex,
    schemaVersion: S.tag("lejeune-provider-recording/v1"),
    sourceRevision: S.tag("rfq-a-outlook-body/v1"),
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
    citations: S.Tuple([
      S.Literal("full-text:rfq-b-pdf-schedule"),
      S.Literal("source:https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/"),
      S.Literal("source:https://blueprint.fastenal.com/structural-bolts.html"),
      S.Literal("source:https://www.portlandbolt.com/technical/specifications/astm-f959/"),
    ]),
    documentCount: S.Literal(4),
    ontologyClasses: S.Tuple([
      S.Literal("Approval"),
      S.Literal("Component"),
      S.Literal("ExpertClaim"),
      S.Literal("Finish"),
      S.Literal("LotCertificate"),
      S.Literal("ProductVariant"),
      S.Literal("Project"),
      S.Literal("QuoteLine"),
      S.Literal("RFQ"),
      S.Literal("Standard"),
      S.Literal("SupplierOffer"),
      S.Literal("Tool"),
    ]),
    quoteLines: S.Tuple([S.Literal("rfq-a-line-a-1|180"), S.Literal("rfq-b-line-b-1|860")]),
    ruleDispositions: S.Tuple([
      S.Literal("a490-hdg-refusal|rfq-a-a490-hdg-positive|pass"),
      S.Literal("a490-hdg-refusal|rfq-b-a490-hdg-refusal|refuse"),
      S.Literal("dti-strength-match|rfq-a-dti-strength-positive|pass"),
      S.Literal("dti-strength-match|rfq-b-dti-strength-mismatch|mismatch"),
      S.Literal("matched-assembly|rfq-a-matched-assembly-positive|pass"),
      S.Literal("matched-assembly|rfq-b-matched-assembly-mismatch|mismatch"),
    ]),
    syntheticRecords: S.Tuple([
      S.Literal("synthetic-cert-rfq-a|LotCertificate|SYNTHETIC|2026-08-27T12:00:00.000Z"),
      S.Literal("synthetic-cert-rfq-b|LotCertificate|SYNTHETIC|2026-08-27T12:05:00.000Z"),
      S.Literal("synthetic-offer-rfq-a|SupplierOffer|SYNTHETIC|2026-08-27T11:30:00.000Z"),
      S.Literal("synthetic-offer-rfq-b|SupplierOffer|SYNTHETIC|2026-08-27T11:35:00.000Z"),
    ]),
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
const ImmutableDemoBundleFields = S.Struct({
  bundleVersion: S.Literal(BUNDLE_VERSION),
  certificates: S.Tuple([LotCertificate, LotCertificate]),
  finishes: S.Tuple([Finish, Finish]),
  fixtures: S.Tuple([NormalizedFixture, NormalizedFixture]),
  mutableCorpusDisposition: S.Literal("delete-or-promote"),
  mutableCorpusDispositionDate: S.Literal(MUTABLE_CORPUS_DISPOSITION_DATE),
  offers: S.Tuple([SupplierOffer, SupplierOffer]),
  projection: ProjectionSnapshot,
  providerRecording: ProviderRecording,
  rules: S.Tuple([RuleResult, RuleResult, RuleResult, RuleResult, RuleResult, RuleResult]),
  standards: S.Tuple([Standard, Standard, Standard, Standard, Standard]),
  tools: S.Tuple([Tool, Tool]),
});

type ImmutableDemoBundleFields = typeof ImmutableDemoBundleFields.Type;

class RuleCaseContract extends S.Class<RuleCaseContract>($I`RuleCaseContract`)(
  {
    caseId: EntityId,
    disposition: RuleDisposition,
    requiresHuman: S.Boolean,
    ruleId: RuleId,
    sourceId: EntityId,
  },
  $I.annote("RuleCaseContract", {
    description: "One canonical rule, case, citation, disposition, and human-stop row in the frozen replay matrix.",
  })
) {}

class CanonicalRuleSourceContract extends S.Class<CanonicalRuleSourceContract>($I`CanonicalRuleSourceContract`)(
  {
    accessedOn: S.Literal("2026-08-25"),
    evidence: S.NonEmptyString,
    id: EntityId,
    researchPath: PosixPath,
    revision: S.NonEmptyString,
    ruleId: RuleId,
    title: S.NonEmptyString,
    url: HttpsUrl,
  },
  $I.annote("CanonicalRuleSourceContract", {
    description: "The complete governing-source semantics for one rule in the frozen replay matrix.",
  })
) {}

/** Complete canonical source records for the three fixed cited rules. @category fixtures @since 0.0.0 */
export const CanonicalRuleSourceContracts: readonly [
  CanonicalRuleSourceContract,
  CanonicalRuleSourceContract,
  CanonicalRuleSourceContract,
] = [
  CanonicalRuleSourceContract.make({
    accessedOn: "2026-08-25",
    evidence: "Galvanized bolts and tension-control bolts are manufactured matched bolt-and-nut assembly cases.",
    id: EntityId.make("aisc-matched-assembly"),
    researchPath: PosixPath.make("explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md"),
    revision: "AISC Engineering FAQ 6.2; RCSC Specification 2020",
    ruleId: "matched-assembly",
    title: "AISC Engineering FAQs: 6. Bolting",
    url: HttpsUrl.make("https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/"),
  }),
  CanonicalRuleSourceContract.make({
    accessedOn: "2026-08-25",
    evidence: "ASTM F959 DTIs are designated Type 325 or Type 490 to match bolt strength.",
    id: EntityId.make("portland-bolt-astm-f959"),
    researchPath: PosixPath.make("explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md"),
    revision: "ASTM F959 technical summary accessed 2026-08-25",
    ruleId: "dti-strength-match",
    title: "Portland Bolt ASTM F959",
    url: HttpsUrl.make("https://www.portlandbolt.com/technical/specifications/astm-f959/"),
  }),
  CanonicalRuleSourceContract.make({
    accessedOn: "2026-08-25",
    evidence: "A490 bolts must not be hot-dip galvanized or electroplated.",
    id: EntityId.make("fastenal-a490-coating"),
    researchPath: PosixPath.make("explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md"),
    revision: "Fastenal Structural Bolts blueprint accessed 2026-08-25",
    ruleId: "a490-hdg-refusal",
    title: "Fastenal Blueprint: Structural Bolts",
    url: HttpsUrl.make("https://blueprint.fastenal.com/structural-bolts.html"),
  }),
];

const CanonicalRuleCases: ReadonlyArray<RuleCaseContract> = [
  RuleCaseContract.make({
    caseId: EntityId.make("rfq-a-matched-assembly-positive"),
    disposition: "pass",
    requiresHuman: false,
    ruleId: "matched-assembly",
    sourceId: EntityId.make("aisc-matched-assembly"),
  }),
  RuleCaseContract.make({
    caseId: EntityId.make("rfq-b-matched-assembly-mismatch"),
    disposition: "mismatch",
    requiresHuman: true,
    ruleId: "matched-assembly",
    sourceId: EntityId.make("aisc-matched-assembly"),
  }),
  RuleCaseContract.make({
    caseId: EntityId.make("rfq-a-dti-strength-positive"),
    disposition: "pass",
    requiresHuman: false,
    ruleId: "dti-strength-match",
    sourceId: EntityId.make("portland-bolt-astm-f959"),
  }),
  RuleCaseContract.make({
    caseId: EntityId.make("rfq-b-dti-strength-mismatch"),
    disposition: "mismatch",
    requiresHuman: true,
    ruleId: "dti-strength-match",
    sourceId: EntityId.make("portland-bolt-astm-f959"),
  }),
  RuleCaseContract.make({
    caseId: EntityId.make("rfq-a-a490-hdg-positive"),
    disposition: "pass",
    requiresHuman: false,
    ruleId: "a490-hdg-refusal",
    sourceId: EntityId.make("fastenal-a490-coating"),
  }),
  RuleCaseContract.make({
    caseId: EntityId.make("rfq-b-a490-hdg-refusal"),
    disposition: "refuse",
    requiresHuman: true,
    ruleId: "a490-hdg-refusal",
    sourceId: EntityId.make("fastenal-a490-coating"),
  }),
];

const ruleProjectionRow = (ruleCase: RuleCaseContract): string =>
  `${ruleCase.ruleId}|${ruleCase.caseId}|${ruleCase.disposition}`;

const CanonicalRuleProjectionRows = A.sort(A.map(CanonicalRuleCases, ruleProjectionRow), Str.Order);

const quoteLineProjectionRow = (fixture: NormalizedFixture): string =>
  `${fixture.quoteLine.id}|${fixture.quoteLine.quantity}`;

const supplierOfferProjectionRow = (offer: SupplierOffer): string =>
  `${offer.id}|SupplierOffer|${offer.recordLabel}|${offer.observedAt}`;

const lotCertificateProjectionRow = (certificate: LotCertificate): string =>
  `${certificate.id}|LotCertificate|${certificate.recordLabel}|${certificate.issuedAt}`;

const hasEntityId = (values: ReadonlyArray<{ readonly id: string }>, id: string): boolean =>
  A.some(values, (value) => Str.Equivalence(value.id, id));

const hasUniqueEntityIds = (values: ReadonlyArray<{ readonly id: string }>): boolean =>
  A.length(A.dedupe(A.map(values, (value) => value.id))) === A.length(values);

const productVariantReferencesExist = (bundle: ImmutableDemoBundleFields, variant: ProductVariant): boolean =>
  A.every(
    [hasEntityId(bundle.finishes, variant.finishId), hasEntityId(bundle.standards, variant.standardId)],
    identity
  );

const componentReferencesExist = (bundle: ImmutableDemoBundleFields, component: Component): boolean =>
  A.every(
    [
      hasEntityId(bundle.standards, component.standardId),
      O.match(component.finishId, {
        onNone: () => true,
        onSome: (finishId) => hasEntityId(bundle.finishes, finishId),
      }),
    ],
    identity
  );

const bundleProductVariants = (bundle: ImmutableDemoBundleFields): ReadonlyArray<ProductVariant> =>
  A.map(bundle.fixtures, (fixture) => fixture.productVariant);

const bundleComponents = (bundle: ImmutableDemoBundleFields): ReadonlyArray<Component> =>
  A.flatMap(bundle.fixtures, (fixture) => fixture.components);

const bundleOntologyReferencesExist = (bundle: ImmutableDemoBundleFields): boolean => {
  const variants = bundleProductVariants(bundle);
  const components = bundleComponents(bundle);
  return A.every(
    [
      A.every(variants, (variant) => productVariantReferencesExist(bundle, variant)),
      A.every(components, (component) => componentReferencesExist(bundle, component)),
      A.every(bundle.offers, (offer) => hasEntityId(variants, offer.productVariantId)),
      A.every(bundle.certificates, (certificate) => hasEntityId(bundle.standards, certificate.standardId)),
    ],
    identity
  );
};

const bundleEntityIdentitiesAreUnique = (bundle: ImmutableDemoBundleFields): boolean => {
  const variants = bundleProductVariants(bundle);
  const components = bundleComponents(bundle);
  return A.every(
    [bundle.certificates, bundle.finishes, variants, components, bundle.offers, bundle.standards, bundle.tools],
    hasUniqueEntityIds
  );
};

const valuesMatch = <A2>(
  equivalence: (self: A2, that: A2) => boolean,
  actual: ReadonlyArray<A2>,
  expected: ReadonlyArray<A2>
): boolean =>
  N.Equivalence(A.length(actual), A.length(expected)) &&
  A.every(A.zip(actual, expected), ([actualValue, expectedValue]) => equivalence(actualValue, expectedValue));

const bundleReferenceDataMatches = (bundle: ImmutableDemoBundleFields): boolean => {
  const expected = buildReferenceData(bundle.fixtures);
  return A.every(
    [
      valuesMatch(S.toEquivalence(LotCertificate), bundle.certificates, expected.certificates),
      valuesMatch(S.toEquivalence(Finish), bundle.finishes, expected.finishes),
      valuesMatch(S.toEquivalence(SupplierOffer), bundle.offers, expected.offers),
      valuesMatch(S.toEquivalence(Standard), bundle.standards, expected.standards),
      valuesMatch(S.toEquivalence(Tool), bundle.tools, expected.tools),
    ],
    identity
  );
};

const bundleProjectionRowsMatch = (bundle: ImmutableDemoBundleFields): boolean => {
  const quoteLines = A.sort(A.map(bundle.fixtures, quoteLineProjectionRow), Str.Order);
  const syntheticRecords = A.sort(
    [...A.map(bundle.certificates, lotCertificateProjectionRow), ...A.map(bundle.offers, supplierOfferProjectionRow)],
    Str.Order
  );
  return A.every(
    [
      valuesMatch(Str.Equivalence, bundle.projection.quoteLines, quoteLines),
      valuesMatch(Str.Equivalence, bundle.projection.syntheticRecords, syntheticRecords),
    ],
    identity
  );
};

const bundleFixtureIdentitiesAreClosed = (bundle: ImmutableDemoBundleFields): boolean => {
  const fixtureIds = A.map(bundle.fixtures, (fixture) => fixture.rfq.id);
  return A.every(
    [
      A.length(A.dedupe(fixtureIds)) === RfqLayoutId.Options.length,
      A.every(RfqLayoutId.Options, (id) => A.some(fixtureIds, (candidate) => Str.Equivalence(candidate, id))),
    ],
    identity
  );
};

const ruleSourceMatchesContract = (
  rule: RuleResult,
  sourceContract: CanonicalRuleSourceContract,
  projection: ProjectionSnapshot
): boolean =>
  A.every(
    [
      Str.Equivalence(rule.source.accessedOn, sourceContract.accessedOn),
      Str.Equivalence(rule.source.evidence, sourceContract.evidence),
      N.Equivalence(rule.source.evidenceAnchor.startChar, 0),
      N.Equivalence(rule.source.evidenceAnchor.endChar, Str.length(sourceContract.evidence)),
      Str.Equivalence(rule.source.evidenceAnchor.quote, sourceContract.evidence),
      Str.Equivalence(rule.source.id, sourceContract.id),
      Str.Equivalence(rule.source.researchPath, sourceContract.researchPath),
      Str.Equivalence(rule.source.revision, sourceContract.revision),
      Str.Equivalence(rule.source.title, sourceContract.title),
      Str.Equivalence(rule.source.url, sourceContract.url),
      A.contains(projection.citations, `source:${rule.source.url}`),
    ],
    identity
  );

const ruleMatchesContract = (
  rule: RuleResult,
  ruleCase: RuleCaseContract,
  sourceContract: CanonicalRuleSourceContract,
  projection: ProjectionSnapshot
): boolean =>
  A.every(
    [
      Str.Equivalence(rule.caseId, ruleCase.caseId),
      Str.Equivalence(rule.ruleId, ruleCase.ruleId),
      Str.Equivalence(rule.source.id, ruleCase.sourceId),
      Str.Equivalence(rule.disposition, ruleCase.disposition),
      Bool.Equivalence(rule.requiresHuman, ruleCase.requiresHuman),
      Str.Equivalence(rule.ruleId, sourceContract.ruleId),
      ruleSourceMatchesContract(rule, sourceContract, projection),
    ],
    identity
  );

const bundleRuleContractIsClosed = (bundle: ImmutableDemoBundleFields): boolean => {
  const ruleContracts = A.zip(CanonicalRuleCases, [
    CanonicalRuleSourceContracts[0],
    CanonicalRuleSourceContracts[0],
    CanonicalRuleSourceContracts[1],
    CanonicalRuleSourceContracts[1],
    CanonicalRuleSourceContracts[2],
    CanonicalRuleSourceContracts[2],
  ]);
  const rulesMatch = A.every(A.zip(bundle.rules, ruleContracts), ([rule, [ruleCase, sourceContract]]) =>
    ruleMatchesContract(rule, ruleCase, sourceContract, bundle.projection)
  );
  const projectionRowsMatch = A.every(
    A.zip(bundle.projection.ruleDispositions, CanonicalRuleProjectionRows),
    ([actual, expected]) => Str.Equivalence(actual, expected)
  );
  return A.every([rulesMatch, projectionRowsMatch], identity);
};

const bundleReferencesAreClosed = (bundle: ImmutableDemoBundleFields): boolean =>
  A.every(
    [
      bundleOntologyReferencesExist(bundle),
      bundleEntityIdentitiesAreUnique(bundle),
      bundleReferenceDataMatches(bundle),
      bundleFixtureIdentitiesAreClosed(bundle),
      bundleProjectionRowsMatch(bundle),
      bundleRuleContractIsClosed(bundle),
    ],
    identity
  );

const ImmutableDemoBundleCheck = S.makeFilter(bundleReferencesAreClosed, {
  identifier: $I`ImmutableDemoBundleReferenceCheck`,
  title: "Immutable Demo Bundle Closed References",
  description: "Requires every fixed bundle identity, citation, and ontology reference to resolve exactly once.",
  message: "Immutable bundle references and fixed identity sets must be complete, unique, and closed.",
});

export class ImmutableDemoBundle extends S.Class<ImmutableDemoBundle>($I`ImmutableDemoBundle`)(
  ImmutableDemoBundleFields.mapFields(identity).check(ImmutableDemoBundleCheck),
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
    dispositionDate: S.Literal(MUTABLE_CORPUS_DISPOSITION_DATE),
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
    bundleVersion: S.Literal(BUNDLE_VERSION),
    bundleIdentity: Sha256Hex,
    networkAvailable: S.Literal(false),
    projection: ProjectionSnapshot,
    providerAvailable: S.Literal(false),
    replayMode: S.Literal("recorded-offline"),
    schemaVersion: S.tag("lejeune-golden-replay/v1"),
  },
  $I.annote("GoldenReplayReceipt", {
    description:
      "Proof that normalized data, rules, citations, projections, and identity replay without network or provider.",
  })
) {}

/**
 * Explicit reviewed authority to retain the mutable corpus beyond its fixed disposition date.
 *
 * **Example** (Inspect the new disposition field)
 *
 * ```ts
 * import { RetentionAuthorization } from "@/domain/Bundle"
 *
 * console.log(RetentionAuthorization.fields.newDispositionDate !== undefined) // true
 * ```
 *
 * @category retention
 * @since 0.0.0
 */
const RetentionAuthorizationFields = S.Struct({
  authorization: LiteralKit(["consented-pilot", "promoted"]),
  authorizedAt: IsoTimestamp,
  decisionReference: S.NonEmptyString,
  newDispositionDate: IsoDate,
  owner: S.NonEmptyString,
  schemaVersion: S.tag("lejeune-retention-authorization/v1"),
});

const RetentionAuthorizationExtensionCheck = S.makeFilter(
  (authorization: typeof RetentionAuthorizationFields.Type) => {
    const authorizedOn = Str.slice(0, 10)(authorization.authorizedAt);
    return A.every(
      [
        Order.isGreaterThan(Str.Order)(authorization.newDispositionDate, MUTABLE_CORPUS_DISPOSITION_DATE),
        Order.isGreaterThan(Str.Order)(authorization.newDispositionDate, authorizedOn),
      ],
      identity
    );
  },
  {
    identifier: $I`RetentionAuthorizationExtensionCheck`,
    title: "Retention Authorization Extension",
    description: "Requires a reviewed retention term to extend both the fixed cutoff and its authorization date.",
    message: "New disposition date must be later than 2026-09-30 and the authorization date.",
  }
);

export class RetentionAuthorization extends S.Class<RetentionAuthorization>($I`RetentionAuthorization`)(
  RetentionAuthorizationFields.mapFields(identity).check(RetentionAuthorizationExtensionCheck),
  $I.annote("RetentionAuthorization", {
    description: "A reviewed consent or promotion record that grants a later mutable-corpus disposition date.",
  })
) {}

const MutableRetentionMetadataFields = S.Struct({
  disposition: S.Literal("delete-or-promote"),
  dispositionDate: IsoDate,
  retentionAuthorization: S.OptionFromOptionalKey(RetentionAuthorization).pipe(SchemaUtils.withNoneDefault),
  schemaVersion: S.tag("lejeune-retention-metadata/v1"),
});

const MutableRetentionMetadataAuthorityCheck = S.makeFilter(
  (metadata: typeof MutableRetentionMetadataFields.Type) =>
    O.match(metadata.retentionAuthorization, {
      onNone: () => Str.Equivalence(metadata.dispositionDate, MUTABLE_CORPUS_DISPOSITION_DATE),
      onSome: (authorization) => Str.Equivalence(metadata.dispositionDate, authorization.newDispositionDate),
    }),
  {
    identifier: $I`MutableRetentionMetadataAuthorityCheck`,
    title: "Mutable Retention Metadata Authority",
    description: "Requires the effective disposition date to match the decoded retention authority when present.",
    message: "Disposition date must be the fixed cutoff or the date granted by the persisted retention authority.",
  }
);

const mutableRetentionWithoutAuthorization = (): typeof MutableRetentionMetadataFields.Type => ({
  disposition: "delete-or-promote",
  dispositionDate: IsoDate.make(MUTABLE_CORPUS_DISPOSITION_DATE),
  retentionAuthorization: O.none(),
  schemaVersion: "lejeune-retention-metadata/v1",
});

const mutableRetentionWithAuthorization = (
  authorization: RetentionAuthorization
): typeof MutableRetentionMetadataFields.Type => ({
  disposition: "delete-or-promote",
  dispositionDate: authorization.newDispositionDate,
  retentionAuthorization: O.some(authorization),
  schemaVersion: "lejeune-retention-metadata/v1",
});

const MutableRetentionMetadataModel = MutableRetentionMetadataFields.mapFields(identity)
  .check(MutableRetentionMetadataAuthorityCheck)
  .annotate({
    toArbitrary: () => (fc) =>
      fc.oneof(
        fc.constant(mutableRetentionWithoutAuthorization()),
        S.toArbitrary(RetentionAuthorization)(fc).map(mutableRetentionWithAuthorization)
      ),
  });

/**
 * Effective retention decision persisted beside the mutable review ledger.
 *
 * **Details**
 *
 * The optional authority and its effective disposition date stay outside immutable bundle identity.
 *
 * **Example** (Inspect the effective date field)
 *
 * ```ts
 * import { MutableRetentionMetadata } from "@/domain/Bundle"
 *
 * console.log(MutableRetentionMetadata.fields.dispositionDate !== undefined) // true
 * ```
 *
 * @category retention
 * @since 0.0.0
 */
export class MutableRetentionMetadata extends S.Class<MutableRetentionMetadata>($I`MutableRetentionMetadata`)(
  MutableRetentionMetadataModel,
  $I.annote("MutableRetentionMetadata", {
    description: "The schema-validated mutable retention authority and its effective disposition date.",
  })
) {}

/**
 * Identity and contract revisions stored beside both durable projection engines.
 *
 * **Example** (Inspect the bundle identity field)
 *
 * ```ts
 * import { ProjectionStoreMetadata } from "@/domain/Bundle"
 *
 * console.log(ProjectionStoreMetadata.fields.bundleIdentity !== undefined) // true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class ProjectionStoreMetadata extends S.Class<ProjectionStoreMetadata>($I`ProjectionStoreMetadata`)(
  {
    bundleIdentity: Sha256Hex,
    bundleVersion: S.Literal(BUNDLE_VERSION),
    projectionSchemaVersion: S.Literal("lejeune-projection-stores/v1"),
    schemaVersion: S.tag("lejeune-projection-metadata/v1"),
    stores: S.Tuple([S.Literal("pglite"), S.Literal("duckdb")]),
  },
  $I.annote("ProjectionStoreMetadata", {
    description: "Version and bundle identity metadata persisted alongside the PGlite and DuckDB stores.",
  })
) {}

/**
 * JSON codec used to persist the immutable bundle without native JSON helpers.
 *
 * **Example** (Inspect the codec schema)
 *
 * ```ts
 * import { ImmutableDemoBundleFromJsonString } from "@/domain/Bundle"
 *
 * console.log(ImmutableDemoBundleFromJsonString.ast !== undefined)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ImmutableDemoBundleFromJsonString = S.fromJsonString(ImmutableDemoBundle, { space: 2 });

/**
 * JSON codec used to persist the mutable ledger without native JSON helpers.
 *
 * **Example** (Inspect the codec schema)
 *
 * ```ts
 * import { MutableReviewLedgerFromJsonString } from "@/domain/Bundle"
 *
 * console.log(MutableReviewLedgerFromJsonString.ast !== undefined)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MutableReviewLedgerFromJsonString = S.fromJsonString(MutableReviewLedger, { space: 2 });

/**
 * JSON codec for mutable retention metadata stored outside bundle identity.
 *
 * **Example** (Inspect the codec schema)
 *
 * ```ts
 * import { MutableRetentionMetadataFromJsonString } from "@/domain/Bundle"
 *
 * console.log(MutableRetentionMetadataFromJsonString.ast !== undefined) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MutableRetentionMetadataFromJsonString = S.fromJsonString(MutableRetentionMetadata, { space: 2 });

/**
 * JSON codec used to persist the golden replay receipt without native JSON helpers.
 *
 * **Example** (Inspect the codec schema)
 *
 * ```ts
 * import { GoldenReplayReceiptFromJsonString } from "@/domain/Bundle"
 *
 * console.log(GoldenReplayReceiptFromJsonString.ast !== undefined)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GoldenReplayReceiptFromJsonString = S.fromJsonString(GoldenReplayReceipt, { space: 2 });

/** JSON codec for reviewed mutable-corpus retention authority. @category codecs @since 0.0.0 */
export const RetentionAuthorizationFromJsonString = S.fromJsonString(RetentionAuthorization, { space: 2 });

/** JSON codec for durable projection-store identity metadata. @category codecs @since 0.0.0 */
export const ProjectionStoreMetadataFromJsonString = S.fromJsonString(ProjectionStoreMetadata, { space: 2 });

/**
 * JSON codec for the sanitized successful provider recording.
 *
 * **Example** (Inspect the codec schema)
 *
 * ```ts
 * import { ProviderRecordingFromJsonString } from "@/domain/Bundle"
 *
 * console.log(ProviderRecordingFromJsonString.ast !== undefined)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ProviderRecordingFromJsonString = S.fromJsonString(ProviderRecording, { space: 2 });
