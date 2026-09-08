/**
 * Schema-first bundle, replay, citation, and projection records for the fixed demo.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit, NonNegativeInt, PosInt, PosixPath, SchemaUtils, Sha256Hex } from "@beep/schema";
import { HttpsUrl } from "@beep/schema/URL";
import { Effect, identity, Number as N, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  Component,
  EntityId,
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

/** Fixed disposition date for the separately mounted mutable review corpus. @category models @since 0.0.0 */
export const MUTABLE_CORPUS_DISPOSITION_DATE = "2026-09-30";

const RFQ_A_OUTLOOK_SOURCE_TEXT =
  "SYNTHETIC RFQ A | Project North Loop Canopy | Delivery 2026-09-12 | Domestic required | Finish MG B695 Class 55";
const RFQ_A_XLSX_SOURCE_TEXT = "A-1 | TC assembly | F1852 Type 1 | 7/8 in | 3-1/4 in | 180 | F959 Type 325";
const RFQ_B_EMAIL_SOURCE_TEXT =
  "SYNTHETIC RFQ B for County Shops Expansion. Delivery is 2026-09-20 and certification is required. Do not infer coating approval.";
const RFQ_B_PDF_SOURCE_TEXT =
  "Line B-1 | Product heavy hex bolt only | Grade A490 Type 1 | Diameter 3/4 in | Length 2-1/2 in | Quantity 860 | Finish HDG | DTI F959 Type 325";

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

const canonicalSourceDocument = (input: {
  readonly format: typeof SourceFormat.Type;
  readonly id: EntityId;
  readonly layoutId: typeof RfqLayoutId.Type;
  readonly mediaType: string;
  readonly sha256: Sha256Hex;
  readonly text: string;
}): SourceDocument => SourceDocument.make(input);

const canonicalExtractedField = (
  sourceDocumentId: EntityId,
  name: string,
  startChar: number,
  endChar: number,
  quote: string
): ExtractedField =>
  ExtractedField.make({
    anchor: TextAnchor.make({
      endChar: NonNegativeInt.make(endChar),
      quote,
      startChar: NonNegativeInt.make(startChar),
    }),
    name,
    sourceDocumentId,
    value: quote,
  });

const CanonicalRfqAOutlookSource = canonicalSourceDocument({
  format: "outlook-body-table",
  id: EntityId.make("rfq-a-outlook-body"),
  layoutId: "rfq-a",
  mediaType: "text/plain",
  sha256: Sha256Hex.make("ee38c21a1635fa152f1e48914ae2c2ce3761d5ada7f96b8c7c3d5a50e808f3b5"),
  text: RFQ_A_OUTLOOK_SOURCE_TEXT,
});

const CanonicalRfqAXlsxSource = canonicalSourceDocument({
  format: "xlsx-takeoff",
  id: EntityId.make("rfq-a-xlsx-takeoff"),
  layoutId: "rfq-a",
  mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  sha256: Sha256Hex.make("09c038e5118283ff15382a632ca6c6e9c811ef4e7235128623956f6043b1d4c5"),
  text: RFQ_A_XLSX_SOURCE_TEXT,
});

const CanonicalRfqBEmailSource = canonicalSourceDocument({
  format: "prose-email",
  id: EntityId.make("rfq-b-prose-email"),
  layoutId: "rfq-b",
  mediaType: "text/plain",
  sha256: Sha256Hex.make("bc1144a4fdde67229b9e2178c09c133cdd48a0b8881e5f9b9f0316f4ba91806e"),
  text: RFQ_B_EMAIL_SOURCE_TEXT,
});

const CanonicalRfqBPdfSource = canonicalSourceDocument({
  format: "pdf-text-layer",
  id: EntityId.make("rfq-b-pdf-schedule"),
  layoutId: "rfq-b",
  mediaType: "application/pdf",
  sha256: Sha256Hex.make("bbaa1ae10d94a0680966ed5d1eef8c020b172131d760eb7bc9bc61e8f4831360"),
  text: RFQ_B_PDF_SOURCE_TEXT,
});

const CanonicalRfqAComponents = [
  Component.make({
    id: EntityId.make("rfq-a-bolt"),
    kind: "bolt",
    label: "F1852 Type 1 tension-control bolt",
    standardId: EntityId.make("astm-f1852-type-1"),
    strengthClass: "325",
  }),
  Component.make({
    id: EntityId.make("rfq-a-nut"),
    kind: "nut",
    label: "A563 DH nut",
    standardId: EntityId.make("astm-a563-dh"),
    strengthClass: "325-compatible",
  }),
  Component.make({
    id: EntityId.make("rfq-a-washer"),
    kind: "washer",
    label: "F436 Type 1 washer",
    standardId: EntityId.make("astm-f436-type-1"),
    strengthClass: "325-compatible",
  }),
  Component.make({
    id: EntityId.make("rfq-a-dti"),
    kind: "dti",
    label: "F959 Type 325 DTI",
    standardId: EntityId.make("astm-f959-type-325"),
    strengthClass: "325",
  }),
] as const;

const CanonicalRfqBComponents = [
  Component.make({
    finishId: O.some(EntityId.make("hot-dip-galvanized")),
    id: EntityId.make("rfq-b-bolt"),
    kind: "bolt",
    label: "A490 Type 1 heavy hex bolt",
    standardId: EntityId.make("astm-a490-type-1"),
    strengthClass: "490",
  }),
  Component.make({
    finishId: O.some(EntityId.make("hot-dip-galvanized")),
    id: EntityId.make("rfq-b-dti"),
    kind: "dti",
    label: "F959 Type 325 DTI",
    standardId: EntityId.make("astm-f959-type-325"),
    strengthClass: "325",
  }),
] as const;

const CanonicalRfqAProductVariant = ProductVariant.make({
  componentIds: A.map(CanonicalRfqAComponents, (component) => component.id),
  finishId: EntityId.make("mechanical-galvanized-b695-class-55"),
  id: EntityId.make("rfq-a-tc-assembly"),
  label: "F1852 Type 1 TC assembly, 7/8 in x 3-1/4 in",
  standardId: EntityId.make("astm-f1852-type-1"),
});

const CanonicalRfqBProductVariant = ProductVariant.make({
  componentIds: A.map(CanonicalRfqBComponents, (component) => component.id),
  finishId: EntityId.make("hot-dip-galvanized"),
  id: EntityId.make("rfq-b-a490-heavy-hex"),
  label: "A490 Type 1 heavy hex bolt, 3/4 in x 2-1/2 in",
  standardId: EntityId.make("astm-a490-type-1"),
});

const CanonicalRfqAProject = Project.make({
  deliveryDate: IsoDate.make("2026-09-12"),
  id: EntityId.make("north-loop-canopy"),
  name: "North Loop Canopy",
});

const CanonicalRfqBProject = Project.make({
  deliveryDate: IsoDate.make("2026-09-20"),
  id: EntityId.make("county-shops-expansion"),
  name: "County Shops Expansion",
});

const CanonicalRfqAQuoteLine = QuoteLine.make({
  id: EntityId.make("rfq-a-line-a-1"),
  productVariantId: CanonicalRfqAProductVariant.id,
  quantity: PosInt.make(180),
  rfqId: EntityId.make("rfq-a"),
});

const CanonicalRfqBQuoteLine = QuoteLine.make({
  id: EntityId.make("rfq-b-line-b-1"),
  productVariantId: CanonicalRfqBProductVariant.id,
  quantity: PosInt.make(860),
  rfqId: EntityId.make("rfq-b"),
});

const CanonicalRfqA = RFQ.make({
  id: EntityId.make("rfq-a"),
  missingFields: ["certificationRequirement"],
  projectId: CanonicalRfqAProject.id,
  quoteLineIds: [CanonicalRfqAQuoteLine.id],
  sourceDocumentIds: [CanonicalRfqAOutlookSource.id, CanonicalRfqAXlsxSource.id],
});

const CanonicalRfqB = RFQ.make({
  id: EntityId.make("rfq-b"),
  missingFields: ["domesticOrigin"],
  projectId: CanonicalRfqBProject.id,
  quoteLineIds: [CanonicalRfqBQuoteLine.id],
  sourceDocumentIds: [CanonicalRfqBEmailSource.id, CanonicalRfqBPdfSource.id],
});

const CanonicalRfqAExtractedFields = [
  canonicalExtractedField(CanonicalRfqAOutlookSource.id, "projectName", 26, 43, "North Loop Canopy"),
  canonicalExtractedField(CanonicalRfqAOutlookSource.id, "deliveryDate", 55, 65, "2026-09-12"),
  canonicalExtractedField(CanonicalRfqAOutlookSource.id, "domesticOrigin", 68, 85, "Domestic required"),
  canonicalExtractedField(CanonicalRfqAOutlookSource.id, "finish", 95, 111, "MG B695 Class 55"),
  canonicalExtractedField(CanonicalRfqAXlsxSource.id, "product", 6, 17, "TC assembly"),
  canonicalExtractedField(CanonicalRfqAXlsxSource.id, "grade", 20, 32, "F1852 Type 1"),
  canonicalExtractedField(CanonicalRfqAXlsxSource.id, "diameter", 35, 41, "7/8 in"),
  canonicalExtractedField(CanonicalRfqAXlsxSource.id, "length", 44, 52, "3-1/4 in"),
  canonicalExtractedField(CanonicalRfqAXlsxSource.id, "quantity", 55, 58, "180"),
  canonicalExtractedField(CanonicalRfqAXlsxSource.id, "dti", 61, 74, "F959 Type 325"),
] as const;

const CanonicalRfqBExtractedFields = [
  canonicalExtractedField(CanonicalRfqBEmailSource.id, "projectName", 20, 42, "County Shops Expansion"),
  canonicalExtractedField(CanonicalRfqBEmailSource.id, "deliveryDate", 56, 66, "2026-09-20"),
  canonicalExtractedField(CanonicalRfqBEmailSource.id, "certificationRequirement", 71, 96, "certification is required"),
  canonicalExtractedField(CanonicalRfqBPdfSource.id, "product", 19, 38, "heavy hex bolt only"),
  canonicalExtractedField(CanonicalRfqBPdfSource.id, "grade", 47, 58, "A490 Type 1"),
  canonicalExtractedField(CanonicalRfqBPdfSource.id, "diameter", 70, 76, "3/4 in"),
  canonicalExtractedField(CanonicalRfqBPdfSource.id, "length", 86, 94, "2-1/2 in"),
  canonicalExtractedField(CanonicalRfqBPdfSource.id, "quantity", 106, 109, "860"),
  canonicalExtractedField(CanonicalRfqBPdfSource.id, "finish", 119, 122, "HDG"),
  canonicalExtractedField(CanonicalRfqBPdfSource.id, "dti", 129, 142, "F959 Type 325"),
] as const;

/**
 * Exact ordered normalized fixture graph authorized by immutable bundle contract v1.
 *
 * **Example** (Inspect the fixture order)
 *
 * ```ts
 * import { CanonicalNormalizedFixtures } from "@/domain/Bundle"
 *
 * console.log(CanonicalNormalizedFixtures.map((fixture) => fixture.rfq.id)) // ["rfq-a", "rfq-b"]
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const CanonicalNormalizedFixtures: readonly [NormalizedFixture, NormalizedFixture] = [
  NormalizedFixture.make({
    components: CanonicalRfqAComponents,
    extractedFields: CanonicalRfqAExtractedFields,
    missingFields: [
      MissingField.make({
        field: "certificationRequirement",
        question: "RFI: Is a lot certificate required for RFQ A?",
        rfqId: CanonicalRfqA.id,
      }),
    ],
    productVariant: CanonicalRfqAProductVariant,
    project: CanonicalRfqAProject,
    quoteLine: CanonicalRfqAQuoteLine,
    rfq: CanonicalRfqA,
    sources: [CanonicalRfqAOutlookSource, CanonicalRfqAXlsxSource],
  }),
  NormalizedFixture.make({
    components: CanonicalRfqBComponents,
    extractedFields: CanonicalRfqBExtractedFields,
    missingFields: [
      MissingField.make({
        field: "domesticOrigin",
        question: "RFI: Is domestic origin required for RFQ B?",
        rfqId: CanonicalRfqB.id,
      }),
    ],
    productVariant: CanonicalRfqBProductVariant,
    project: CanonicalRfqBProject,
    quoteLine: CanonicalRfqBQuoteLine,
    rfq: CanonicalRfqB,
    sources: [CanonicalRfqBEmailSource, CanonicalRfqBPdfSource],
  }),
];

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
export const PROVIDER_RECORDING_SOURCE_TEXT = RFQ_A_OUTLOOK_SOURCE_TEXT;

/** Exact request identity authorized by provider-recording contract v1. @category fixtures @since 0.0.0 */
export const PROVIDER_RECORDING_DOCUMENT_ID = EntityId.make("lejeune-provider-smoke-rfq-a");

/** Canonical compact codec used when hashing a sanitized candidate list. @category codecs @since 0.0.0 */
export const ProviderCandidateListFromJsonString = S.fromJsonString(
  S.Tuple([ProviderCandidate, ProviderCandidate, ProviderCandidate])
).pipe(SchemaUtils.withCodecStatics(["encodeEffect"]));

const ProviderRecordingFields = S.Struct({
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
});

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
  ProviderRecordingFields,
  $I.annote("ProviderRecording", {
    description: "A sanitized successful live extraction recording that makes the golden run provider-independent.",
  })
) {}

const CanonicalProviderRecording = ProviderRecording.make({
  candidates: [
    ProviderCandidate.make({ label: "project", text: "North Loop Canopy" }),
    ProviderCandidate.make({ label: "delivery_date", text: "2026-09-12" }),
    ProviderCandidate.make({ label: "finish", text: "MG B695 Class 55" }),
  ],
  documentId: PROVIDER_RECORDING_DOCUMENT_ID,
  model: "claude-opus-4-6",
  provider: "anthropic",
  recordedAt: IsoTimestamp.make("2026-08-27T12:25:18.044Z"),
  responseSha256: Sha256Hex.make("e298888dc39b2f3b267fd206e1efe53f707cc3c0811d2746e53f1a7ca3227642"),
});

const FrozenProviderRecordingCheck = S.makeFilter(
  (recording: typeof ProviderRecordingFields.Type) =>
    S.toEquivalence(ProviderRecordingFields)(recording, CanonicalProviderRecording),
  {
    identifier: $I`FrozenProviderRecordingCheck`,
    title: "Frozen Provider Recording",
    description: "Requires provider metadata, candidate order and values, and digest to match the committed artifact.",
    message: "Provider recording must match the exact committed offline replay artifact v1.",
  }
);

/**
 * Exact successful provider artifact authorized for immutable replay contract v1.
 *
 * **Example** (Inspect the pinned provider)
 *
 * ```ts
 * import { FrozenProviderRecording } from "@/domain/Bundle"
 *
 * console.log(FrozenProviderRecording.fields.provider !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrozenProviderRecording extends S.Class<FrozenProviderRecording>($I`FrozenProviderRecording`)(
  ProviderRecordingFields.mapFields(identity).check(FrozenProviderRecordingCheck),
  $I.annote("FrozenProviderRecording", {
    description: "The exact ordered, sanitized live-provider result committed for deterministic offline replay v1.",
  })
) {
  static readonly decodeEffect = S.decodeEffect(FrozenProviderRecording);
}

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
      S.Literal("source:aisc-matched-assembly|https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/"),
      S.Literal("source:fastenal-a490-coating|https://blueprint.fastenal.com/structural-bolts.html"),
      S.Literal("source:portland-bolt-astm-f959|https://www.portlandbolt.com/technical/specifications/astm-f959/"),
    ]),
    documentCount: S.Literal(4),
    documentDigests: S.Tuple([
      S.Literal("rfq-a-outlook-body|ee38c21a1635fa152f1e48914ae2c2ce3761d5ada7f96b8c7c3d5a50e808f3b5"),
      S.Literal("rfq-a-xlsx-takeoff|2ef7617efaf7b70880d8cce16744fa85f5e5c9c6bc558b1f09f1685036a5adda"),
      S.Literal("rfq-b-pdf-schedule|03e1f8df73defb01810998c6916e20534e7f1d4cb2adf0207533904959d2d46b"),
      S.Literal("rfq-b-prose-email|bc1144a4fdde67229b9e2178c09c133cdd48a0b8881e5f9b9f0316f4ba91806e"),
    ]),
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
    quoteLines: S.Tuple([
      S.Literal("rfq-a-line-a-1|rfq-a-tc-assembly|180"),
      S.Literal("rfq-b-line-b-1|rfq-b-a490-heavy-hex|860"),
    ]),
    ruleDispositions: S.Tuple([
      S.Literal("a490-hdg-refusal|rfq-a-a490-hdg-positive|pass|false"),
      S.Literal("a490-hdg-refusal|rfq-b-a490-hdg-refusal|refuse|true"),
      S.Literal("dti-strength-match|rfq-a-dti-strength-positive|pass|false"),
      S.Literal("dti-strength-match|rfq-b-dti-strength-mismatch|mismatch|true"),
      S.Literal("matched-assembly|rfq-a-matched-assembly-positive|pass|false"),
      S.Literal("matched-assembly|rfq-b-matched-assembly-mismatch|mismatch|true"),
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
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(ProjectionSnapshot);
}

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
  providerRecording: FrozenProviderRecording,
  rules: S.Tuple([RuleResult, RuleResult, RuleResult, RuleResult, RuleResult, RuleResult]),
  standards: S.Tuple([Standard, Standard, Standard, Standard, Standard]),
  tools: S.Tuple([Tool, Tool]),
});

type ImmutableDemoBundleFields = typeof ImmutableDemoBundleFields.Type;

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

const canonicalRuleSource = (contract: CanonicalRuleSourceContract): RuleSource =>
  RuleSource.make({
    accessedOn: contract.accessedOn,
    evidence: contract.evidence,
    evidenceAnchor: TextAnchor.make({
      endChar: NonNegativeInt.make(Str.length(contract.evidence)),
      quote: contract.evidence,
      startChar: NonNegativeInt.make(0),
    }),
    id: contract.id,
    researchPath: contract.researchPath,
    revision: contract.revision,
    title: contract.title,
    url: contract.url,
  });

const CanonicalRuleSources = A.map(CanonicalRuleSourceContracts, canonicalRuleSource);

const CanonicalRuleResults: readonly [RuleResult, RuleResult, RuleResult, RuleResult, RuleResult, RuleResult] = [
  RuleResult.make({
    caseId: EntityId.make("rfq-a-matched-assembly-positive"),
    disposition: "pass",
    matchedFacts: [
      CanonicalRfqAProductVariant.label,
      "Exact TC-assembly provenance and the canonical 325-compatible bolt, nut, and washer are present.",
    ],
    requiresHuman: false,
    ruleId: "matched-assembly",
    source: CanonicalRuleSources[0],
    stopReason: "No stop: the fixed matched-assembly fact pattern is complete.",
  }),
  RuleResult.make({
    caseId: EntityId.make("rfq-b-matched-assembly-mismatch"),
    disposition: "mismatch",
    matchedFacts: [
      CanonicalRfqBProductVariant.label,
      "Exact TC-assembly provenance or the compatible bolt, nut, and washer contract is incomplete.",
    ],
    requiresHuman: true,
    ruleId: "matched-assembly",
    source: CanonicalRuleSources[0],
    stopReason: "Stop for an RFI; do not complete a matched assembly from inferred components.",
  }),
  RuleResult.make({
    caseId: EntityId.make("rfq-a-dti-strength-positive"),
    disposition: "pass",
    matchedFacts: ["Bolt standard/strength: astm-f1852-type-1/325", "DTI standard/strength: astm-f959-type-325/325"],
    requiresHuman: false,
    ruleId: "dti-strength-match",
    source: CanonicalRuleSources[1],
    stopReason: "No stop: bolt and DTI strength families match in the fixed fixture.",
  }),
  RuleResult.make({
    caseId: EntityId.make("rfq-b-dti-strength-mismatch"),
    disposition: "mismatch",
    matchedFacts: ["Bolt standard/strength: astm-a490-type-1/490", "DTI standard/strength: astm-f959-type-325/325"],
    requiresHuman: true,
    ruleId: "dti-strength-match",
    source: CanonicalRuleSources[1],
    stopReason: "Stop for correction or RFI; do not quote a DTI from the wrong strength family.",
  }),
  RuleResult.make({
    caseId: EntityId.make("rfq-a-a490-hdg-positive"),
    disposition: "pass",
    matchedFacts: [
      `Product: ${CanonicalRfqAProductVariant.label}`,
      `Finish id: ${CanonicalRfqAProductVariant.finishId}`,
    ],
    requiresHuman: false,
    ruleId: "a490-hdg-refusal",
    source: CanonicalRuleSources[2],
    stopReason: "No stop: the forbidden A490 plus HDG combination is absent.",
  }),
  RuleResult.make({
    caseId: EntityId.make("rfq-b-a490-hdg-refusal"),
    disposition: "refuse",
    matchedFacts: [
      `Product: ${CanonicalRfqBProductVariant.label}`,
      `Finish id: ${CanonicalRfqBProductVariant.finishId}`,
    ],
    requiresHuman: true,
    ruleId: "a490-hdg-refusal",
    source: CanonicalRuleSources[2],
    stopReason: "Refuse the silent substitution and stop for a qualified coating/specification decision.",
  }),
];

const ruleProjectionRow = (rule: RuleResult): string =>
  `${rule.ruleId}|${rule.caseId}|${rule.disposition}|${rule.requiresHuman}`;

const CanonicalRuleProjectionRows = A.sort(A.map(CanonicalRuleResults, ruleProjectionRow), Str.Order);

const quoteLineProjectionRow = (fixture: NormalizedFixture): string =>
  `${fixture.quoteLine.id}|${fixture.quoteLine.productVariantId}|${fixture.quoteLine.quantity}`;

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

const bundleFixturesMatchCanonical = (bundle: ImmutableDemoBundleFields): boolean =>
  valuesMatch(S.toEquivalence(NormalizedFixture), bundle.fixtures, CanonicalNormalizedFixtures);

const bundleRuleContractIsClosed = (bundle: ImmutableDemoBundleFields): boolean => {
  const rulesMatch = valuesMatch(S.toEquivalence(RuleResult), bundle.rules, CanonicalRuleResults);
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
      bundleFixturesMatchCanonical(bundle),
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
    approvals: S.Tuple([]),
    claims: S.Tuple([]),
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
 * @category models
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
 * @category models
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

const PublishedReplayAggregateFields = S.Struct({
  bundle: ImmutableDemoBundle,
  bundleIdentity: Sha256Hex,
  mutableLedger: MutableReviewLedger,
  projectionMetadata: ProjectionStoreMetadata,
  receipt: GoldenReplayReceipt,
  retentionMetadata: MutableRetentionMetadata,
});

type PublishedReplayAggregateFields = typeof PublishedReplayAggregateFields.Type;

const publishedReplayAggregateIsClosed = (aggregate: PublishedReplayAggregateFields): boolean =>
  A.every(
    [
      Str.Equivalence(aggregate.bundleIdentity, aggregate.receipt.bundleIdentity),
      Str.Equivalence(aggregate.bundleIdentity, aggregate.projectionMetadata.bundleIdentity),
      S.toEquivalence(ProjectionSnapshot)(aggregate.bundle.projection, aggregate.receipt.projection),
      Str.Equivalence(aggregate.bundle.mutableCorpusDisposition, aggregate.mutableLedger.disposition),
      Str.Equivalence(aggregate.bundle.mutableCorpusDisposition, aggregate.retentionMetadata.disposition),
      Str.Equivalence(aggregate.bundle.mutableCorpusDispositionDate, aggregate.mutableLedger.dispositionDate),
    ],
    identity
  );

const PublishedReplayAggregateCheck = S.makeFilter(publishedReplayAggregateIsClosed, {
  identifier: $I`PublishedReplayAggregateCheck`,
  title: "Published Replay Aggregate",
  description:
    "Requires the exact persisted bundle identity, replay receipt, projection sidecar, empty ledger, and retention policy to describe one publication.",
  message: "Persisted bundle, receipt, projection, review, and retention records must form one closed publication.",
});

const PublishedReplayAggregateModel =
  PublishedReplayAggregateFields.mapFields(identity).check(PublishedReplayAggregateCheck);

/** Decoded readback proof for every persisted publication document promoted by the builder. */
class PublishedReplayAggregate extends S.Class<PublishedReplayAggregate>($I`PublishedReplayAggregate`)(
  PublishedReplayAggregateModel,
  $I.annote("PublishedReplayAggregate", {
    description: "A fully decoded and cross-checked durable bundle publication before its atomic promotion.",
  })
) {}

/**
 * Validate already-decoded publication values and construct their aggregate proof.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { makePublishedReplayAggregate } from "@/domain/Bundle"
 *
 * console.log(typeof makePublishedReplayAggregate === "function") // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makePublishedReplayAggregate = (input: unknown) =>
  S.decodeUnknownEffect(S.toType(PublishedReplayAggregateModel))(input).pipe(
    Effect.map((fields) => PublishedReplayAggregate.make(fields))
  );

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
export const ImmutableDemoBundleFromJsonString = S.fromJsonString(ImmutableDemoBundle, { space: 2 }).pipe(
  SchemaUtils.withCodecStatics(["encodeEffect"])
);

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

/**
 * JSON codec for the exact committed provider artifact consumed by offline replay v1.
 *
 * **Example** (Inspect the codec)
 *
 * ```ts
 * import { FrozenProviderRecordingFromJsonString } from "@/domain/Bundle"
 *
 * console.log(FrozenProviderRecordingFromJsonString.ast !== undefined) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const FrozenProviderRecordingFromJsonString = S.fromJsonString(FrozenProviderRecording, { space: 2 });
