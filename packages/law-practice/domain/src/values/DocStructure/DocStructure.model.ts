/**
 * Exact-source office-action pair models and rule metadata.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { VerifiedTextAnchor } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/DocStructure/DocStructure.model");

/**
 * Names the explicit operative FINAL or NON-FINAL declaration.
 *
 * **Example** (Inspect OfficeActionFinality)
 *
 * ```ts
 * import { OfficeActionFinality } from "@beep/law-practice-domain"
 * console.log(OfficeActionFinality.is.FINAL("FINAL")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OfficeActionFinality = LiteralKit(["FINAL", "NON-FINAL"]).pipe(
  $I.annoteSchema("OfficeActionFinality", {
    description: "Explicit operative action finality, never inferred from a lost checkbox.",
  })
);
/**
 * Names the explicit operative FINAL or NON-FINAL declaration.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeActionFinality = typeof OfficeActionFinality.Type;
/**
 * Names the five closed outcomes that produce zero candidates.
 *
 * **Example** (Inspect DocStructureAbstentionCode)
 *
 * ```ts
 * import { DocStructureAbstentionCode } from "@beep/law-practice-domain"
 * console.log(DocStructureAbstentionCode.is.absent("absent")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocStructureAbstentionCode = LiteralKit([
  "absent",
  "ambiguous",
  "unsupported",
  "low-quality-source",
  "rule-not-covered",
]).pipe(
  $I.annoteSchema("DocStructureAbstentionCode", {
    description: "Successful closed outcomes that carry no candidate authority.",
  })
);
/**
 * Names the five closed outcomes that produce zero candidates.
 * @category type-level
 * @since 0.0.0
 */
export type DocStructureAbstentionCode = typeof DocStructureAbstentionCode.Type;
/**
 * Separates direct text and public form language from unqualified derived text.
 *
 * **Example** (Inspect DocStructureSourceModality)
 *
 * ```ts
 * import { DocStructureSourceModality } from "@beep/law-practice-domain"
 * console.log(DocStructureSourceModality.is["ocr-derived"]("ocr-derived")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocStructureSourceModality = LiteralKit([
  "direct-text",
  "embedded-pdf-text",
  "public-form-language",
  "ocr-derived",
  "layout-derived",
]).pipe(
  $I.annoteSchema("DocStructureSourceModality", {
    description: "Declared source production modality; derived modalities cannot authorize v1 evidence.",
  })
);
/**
 * Separates direct text and public form language from unqualified derived text.
 * @category type-level
 * @since 0.0.0
 */
export type DocStructureSourceModality = typeof DocStructureSourceModality.Type;
/**
 * Pins an explicit rule family and version for reproducible extraction and replay.
 *
 * **Example** (Inspect DocStructureRuleFamily)
 *
 * ```ts
 * import { DocStructureRuleFamily } from "@beep/law-practice-domain"
 * const rule = DocStructureRuleFamily.make({ id: "uspto-oa-finality-ssp", version: 1 })
 * console.log(rule.version) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocStructureRuleFamily extends S.Class<DocStructureRuleFamily>($I`DocStructureRuleFamily`)(
  {
    id: S.Literal("uspto-oa-finality-ssp"),
    version: S.Int.check(
      S.isGreaterThan(0, {
        identifier: $I`RuleVersionCheck`,
        title: "Positive rule version",
        description: "Rules use explicit positive integer versions.",
      })
    ),
  },
  $I.annote("DocStructureRuleFamily", {
    description:
      "Explicit family and version for replay; unknown versions abstain and never reinterpret stored output.",
  })
) {}
/**
 * Identifies the clean-room v1 paired finality and three-month period rule.
 *
 * **Example** (Inspect officeActionRuleV1)
 *
 * ```ts
 * import { officeActionRuleV1 } from "@beep/law-practice-domain"
 * console.log(officeActionRuleV1.version) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const officeActionRuleV1 = DocStructureRuleFamily.make({ id: "uspto-oa-finality-ssp", version: 1 });
/**
 * Carries law-practice document identity and source version alongside substrate identity.
 *
 * **Example** (Inspect DocStructureDocument)
 *
 * ```ts
 * import { DocStructureDocument } from "@beep/law-practice-domain"
 * const document = DocStructureDocument.make({ documentId: "example", sourceVersion: "1", modality: "public-form-language" })
 * console.log(document.modality) // "public-form-language"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocStructureDocument extends S.Class<DocStructureDocument>($I`DocStructureDocument`)(
  { documentId: S.NonEmptyString, sourceVersion: S.NonEmptyString, modality: DocStructureSourceModality },
  $I.annote("DocStructureDocument", {
    description: "Law-practice document and explicit source version absent from the generic substrate identity.",
  })
) {}
/**
 * Carries exactly one typed abstention with the rule that declined recognition.
 *
 * **Example** (Inspect DocStructureAbstention)
 *
 * ```ts
 * import { DocStructureAbstention, officeActionRuleV1 } from "@beep/law-practice-domain"
 * const closed = DocStructureAbstention.make({ code: "absent", rule: officeActionRuleV1 })
 * console.log(closed.code) // "absent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocStructureAbstention extends S.Class<DocStructureAbstention>($I`DocStructureAbstention`)(
  { status: S.tag("abstained"), code: DocStructureAbstentionCode, rule: DocStructureRuleFamily },
  $I.annote("DocStructureAbstention", { description: "Exactly one typed closed outcome with no candidate payload." })
) {}
/**
 * Retains the two raw regex spans awaiting verified-source authorization.
 *
 * **Example** (Inspect OfficeActionRawPair)
 *
 * ```ts
 * import { OfficeActionRawPair } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 * console.log(S.is(OfficeActionRawPair)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OfficeActionRawPair extends S.Class<OfficeActionRawPair>($I`OfficeActionRawPair`)(
  {
    status: S.tag("recognized"),
    finality: OfficeActionFinality,
    finalityAnchor: TextAnchor,
    periodAnchor: TextAnchor,
    rule: DocStructureRuleFamily,
  },
  $I.annote("OfficeActionRawPair", {
    description: "Pure raw recognition awaiting exact-anchor verification; never a candidate.",
  })
) {}
/**
 * Represents an atomic raw pair or one closed abstention without candidate authority.
 *
 * **Example** (Inspect OfficeActionRawOutcome)
 *
 * ```ts
 * import { OfficeActionRawOutcome } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 * console.log(S.is(OfficeActionRawOutcome)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OfficeActionRawOutcome = S.Union([OfficeActionRawPair, DocStructureAbstention]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("OfficeActionRawOutcome", {
    description: "Atomic raw pair or one abstention before authority construction.",
  })
);
/**
 * Represents an atomic raw pair or one closed abstention without candidate authority.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeActionRawOutcome = typeof OfficeActionRawOutcome.Type;
const sourceEquivalent = S.toEquivalence(SourceTextIdentity);
const VerifiedAnchorSchema: S.Codec<VerifiedTextAnchor> = VerifiedTextAnchor;
type CandidateFields = {
  readonly schemaVersion: S.Literal<"1">;
  readonly document: typeof DocStructureDocument;
  readonly source: typeof SourceTextIdentity;
  readonly rule: typeof DocStructureRuleFamily;
  readonly anchor: S.Codec<VerifiedTextAnchor>;
  readonly confidence: typeof UnitInterval;
};
const CandidateFields: CandidateFields = {
  schemaVersion: S.Literal("1"),
  document: DocStructureDocument,
  source: SourceTextIdentity,
  rule: DocStructureRuleFamily,
  anchor: VerifiedAnchorSchema,
  confidence: UnitInterval,
};
const CandidateSourceCheck = S.makeFilter(
  (candidate: { readonly source: SourceTextIdentity; readonly anchor: VerifiedTextAnchor }) =>
    sourceEquivalent(candidate.source, candidate.anchor.source),
  {
    identifier: $I`CandidateSourceCheck`,
    title: "Candidate source coherence",
    description: "The candidate metadata and opaque anchor must identify the same exact source.",
    message: "Candidate source differs from its verified anchor source.",
  }
);
type OfficeActionFinalityCandidateFields = CandidateFields & {
  readonly _tag: S.tag<"OfficeActionFinalityCandidate">;
  readonly finality: typeof OfficeActionFinality;
};
const OfficeActionFinalityCandidateStruct: S.Struct<OfficeActionFinalityCandidateFields> =
  S.Struct<OfficeActionFinalityCandidateFields>({
    ...CandidateFields,
    _tag: S.tag("OfficeActionFinalityCandidate"),
    finality: OfficeActionFinality,
  }).check(CandidateSourceCheck);
const OfficeActionFinalityCandidateBase: S.Class<
  OfficeActionFinalityCandidate,
  typeof OfficeActionFinalityCandidateStruct,
  {}
> = S.Class<OfficeActionFinalityCandidate>($I`OfficeActionFinalityCandidate`)(
  OfficeActionFinalityCandidateStruct,
  $I.annote("OfficeActionFinalityCandidate", {
    description: "Verified explicit finality evidence with non-calibrated prior; conveys no admission or approval.",
  })
);
/**
 * Carries verified finality evidence as a candidate with a non-calibrated confidence prior.
 *
 * **Details**
 *
 * Confidence is the documented 0.95 non-calibrated prior, never an admission probability.
 * Persist a verification receipt and reverify it before restoring runtime evidence.
 *
 * **Example** (Inspect OfficeActionFinalityCandidate)
 *
 * ```ts
 * import { OfficeActionFinalityCandidate } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 * console.log(S.is(OfficeActionFinalityCandidate)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OfficeActionFinalityCandidate extends OfficeActionFinalityCandidateBase {}
type ShortenedStatutoryPeriodCandidateFields = CandidateFields & {
  readonly _tag: S.tag<"ShortenedStatutoryPeriodCandidate">;
  readonly months: S.Literal<3>;
};
const ShortenedStatutoryPeriodCandidateStruct: S.Struct<ShortenedStatutoryPeriodCandidateFields> =
  S.Struct<ShortenedStatutoryPeriodCandidateFields>({
    ...CandidateFields,
    _tag: S.tag("ShortenedStatutoryPeriodCandidate"),
    months: S.Literal(3),
  }).check(CandidateSourceCheck);
const ShortenedStatutoryPeriodCandidateBase: S.Class<
  ShortenedStatutoryPeriodCandidate,
  typeof ShortenedStatutoryPeriodCandidateStruct,
  {}
> = S.Class<ShortenedStatutoryPeriodCandidate>($I`ShortenedStatutoryPeriodCandidate`)(
  ShortenedStatutoryPeriodCandidateStruct,
  $I.annote("ShortenedStatutoryPeriodCandidate", {
    description: "Verified three-month period declaration; not a computed deadline or admitted truth.",
  })
);
/**
 * Carries a verified three-month period declaration without computing or approving a deadline.
 *
 * **Details**
 *
 * Confidence is the documented 0.95 non-calibrated prior, never an admission probability.
 * Persist a verification receipt and reverify it before restoring runtime evidence.
 *
 * **Example** (Inspect ShortenedStatutoryPeriodCandidate)
 *
 * ```ts
 * import { ShortenedStatutoryPeriodCandidate } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 * console.log(S.is(ShortenedStatutoryPeriodCandidate)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShortenedStatutoryPeriodCandidate extends ShortenedStatutoryPeriodCandidateBase {}
/**
 * Defines the two verified evidence variants accepted by the docketing seam.
 *
 * **Example** (Inspect DocStructureCandidate)
 *
 * ```ts
 * import { DocStructureCandidate } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 * console.log(S.is(DocStructureCandidate)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocStructureCandidate: S.toTaggedUnion<
  "_tag",
  readonly [typeof OfficeActionFinalityCandidate, typeof ShortenedStatutoryPeriodCandidate]
> = S.Union([OfficeActionFinalityCandidate, ShortenedStatutoryPeriodCandidate]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DocStructureCandidate", {
    description: "The two schema-backed verified office-action evidence variants.",
  })
);
/**
 * Defines the two verified evidence variants accepted by the docketing seam.
 * @category type-level
 * @since 0.0.0
 */
export type DocStructureCandidate = typeof DocStructureCandidate.Type;
/**
 * Carries exactly two ordered verified evidence inputs as one atomic outcome.
 *
 * **Example** (Inspect OfficeActionRecognizedPair)
 *
 * ```ts
 * import { OfficeActionRecognizedPair } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 * console.log(S.is(OfficeActionRecognizedPair)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OfficeActionRecognizedPair extends S.Class<OfficeActionRecognizedPair>($I`OfficeActionRecognizedPair`)(
  S.Struct({
    status: S.tag("recognized"),
    candidates: S.Tuple([OfficeActionFinalityCandidate, ShortenedStatutoryPeriodCandidate]),
  }).check(
    S.makeFilter(
      ({ candidates }) =>
        sourceEquivalent(candidates[0].source, candidates[1].source) &&
        S.toEquivalence(DocStructureDocument)(candidates[0].document, candidates[1].document) &&
        S.toEquivalence(DocStructureRuleFamily)(candidates[0].rule, candidates[1].rule),
      {
        identifier: $I`PairMetadataCheck`,
        title: "Atomic pair metadata",
        description: "Both members retain identical source, document and explicit rule metadata.",
        message: "Pair members disagree on source, document or rule.",
      }
    )
  ),
  $I.annote("OfficeActionRecognizedPair", {
    description: "Atomic ordered finality and period pair, verified together by the use-case workflow.",
  })
) {}
/**
 * Exposes the atomic verified pair or one typed abstention.
 *
 * **Example** (Inspect DocStructureOutcome)
 *
 * ```ts
 * import { DocStructureOutcome } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 * console.log(S.is(DocStructureOutcome)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocStructureOutcome: S.toTaggedUnion<
  "status",
  readonly [typeof OfficeActionRecognizedPair, typeof DocStructureAbstention]
> = S.Union([OfficeActionRecognizedPair, DocStructureAbstention]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("DocStructureOutcome", {
    description: "Exactly two verified candidates or one typed abstention, without partial authority.",
  })
);
/**
 * Exposes the atomic verified pair or one typed abstention.
 * @category type-level
 * @since 0.0.0
 */
export type DocStructureOutcome = typeof DocStructureOutcome.Type;
