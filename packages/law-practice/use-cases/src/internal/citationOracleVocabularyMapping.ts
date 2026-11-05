/**
 * Frozen-oracle publication identities mapped to the public vocabulary boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  CourtId,
  CourtReporterArtifactVersion,
  ReporterId,
} from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("internal/citationOracleVocabularyMapping");
const Difference = S.Struct({ field: S.NonEmptyString, legacy: S.Json, current: S.Json });
const ReporterFields = {
  artifactSha256: Sha256Hex,
  legacyAbbreviation: S.NonEmptyString,
  legacyName: S.String,
  legacyCiteType: S.NonEmptyString,
};
const Reporter = S.Union([
  S.Struct({
    ...ReporterFields,
    kind: S.tag("case-reporter"),
    legacySource: S.tag("reporters"),
    reporterId: ReporterId,
    method: LiteralKit(["exact-source-identity", "alias-merger", "cite-type-update", "name-correction"]),
    rationale: S.NonEmptyString,
    legacyMetadata: S.Struct({
      jurisdictions: S.Array(S.String),
      editions: S.Array(
        S.Struct({ abbreviation: S.NonEmptyString, start: S.NullOr(S.String), end: S.NullOr(S.String) })
      ),
    }),
    differences: S.Array(Difference),
  }),
  S.Struct({
    ...ReporterFields,
    kind: S.tag("law-publication"),
    legacySource: S.tag("laws"),
    citationFamily: S.tag("FullLawCitation"),
  }),
  S.Struct({
    ...ReporterFields,
    kind: S.tag("journal-publication"),
    legacySource: S.tag("journals"),
    citationFamily: S.tag("FullJournalCitation"),
  }),
]);
const EditionFields = {
  artifactSha256: Sha256Hex,
  reporterArtifactSha256: Sha256Hex,
  legacyAbbreviation: S.NonEmptyString,
};
const Edition = S.Union([
  S.Struct({
    ...EditionFields,
    kind: S.tag("case-reporter"),
    reporterId: ReporterId,
    currentAbbreviation: S.NonEmptyString,
    method: LiteralKit(["exact-edition-abbreviation", "historical-edition-alias"]),
    differences: S.Array(Difference),
  }),
  S.Struct({ ...EditionFields, kind: LiteralKit(["law-publication", "journal-publication"]) }),
]);
const Court = S.Struct({
  id: CourtId,
  ordinal: S.Natural,
  citationString: S.String,
  legacyMetadata: S.JsonObject,
  differences: S.Array(Difference),
});

/**
 * Exact legacy-to-public identity evidence with explicit source-version drift.
 *
 * **Details**
 *
 * Public case-reporter IDs do not cover law/journal publications. Those rows
 * retain canonical citation families and their frozen artifact references.
 * Current vocabulary identity does not replace legacy parsing/date behavior.
 *
 * **Example** (Reject unversioned identity mappings)
 *
 * ```ts
 * import { CitationOracleVocabularyMapping } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationOracleVocabularyMapping)({})) // false
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationOracleVocabularyMapping extends S.Opaque<
  CitationOracleVocabularyMapping,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("citation-vocabulary-mapping/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    oracleReportersVersion: S.tag("3.2.53"),
    oracleCourtsVersion: S.tag("0.10.22"),
    publicArtifactVersion: CourtReporterArtifactVersion,
    publicReportersVersion: S.tag("3.2.66"),
    publicCourtsVersion: S.tag("0.10.27"),
    exporterSha256: Sha256Hex,
    publicExporterSha256: Sha256Hex,
    operationCorpusSha256: Sha256Hex,
    legacyReporterDataSha256: Sha256Hex,
    legacyCourtSelectionSha256: Sha256Hex,
    reporters: S.Array(Reporter),
    editions: S.Array(Edition),
    courts: S.Array(Court),
    publicOnlyReporterIds: S.Array(ReporterId),
    publicOnlyCourtIds: S.Array(CourtId),
  }).pipe(
    $I.annoteSchema("CitationOracleVocabularyMapping", {
      description:
        "Every frozen Reporter/Edition artifact and ordered court selection row has an explicit public-identity or noncase-publication treatment.",
    })
  )
) {}
