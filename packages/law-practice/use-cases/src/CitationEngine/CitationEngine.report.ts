/** Source-free successful-operation reports, separate from citation meaning.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as Duration from "effect/Duration";
import * as S from "effect/Schema";
import { CitationEngineAbsoluteMaxima, CitationEngineLimits } from "./CitationEngine.limits.ts";
import { CitationEngineOperation } from "./CitationEngine.operations.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.report");
const max = CitationEngineAbsoluteMaxima;
const count = (maximum: number) => S.Natural.check(S.isLessThanOrEqualTo(maximum));
const Tokenizer = S.Struct({ patternsChecked: count(max.patternEvaluations), tokens: count(max.tokens) }).pipe(
  $I.annoteSchema("Tokenizer", {
    description:
      "Actual executed builtin tokenizer patterns and emitted citation tokens; null means the tokenizer did not run.",
  })
);
/** Measured extraction counts. Tokenizer counts are absent on the original
 * shortcut; this is distinct from an executed tokenizer returning zero tokens.
 * **Example** (Inspect the tokenizer measurement boundary)
 * ```ts
 * import { CitationExtractionMeasurements } from "@beep/law-practice-use-cases/server"
 * console.log(CitationExtractionMeasurements.fields.tokenizer !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationExtractionMeasurements extends S.Opaque<
  CitationExtractionMeasurements,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    tokenizer: S.NullOr(Tokenizer),
    semanticCitations: count(max.candidates),
    verifiedMentions: count(max.mentions),
    unverifiedCitations: count(max.candidates),
    unverifiedComponents: count(max.candidates),
    unboundWarnings: count(max.candidates),
  }).pipe(
    $I.annoteSchema("CitationExtractionMeasurements", {
      description: "Counts from completed extraction/verification results, without source text or citation payloads.",
    })
  )
) {}
const WorkDuration = S.DurationFromMillis.check(
  S.makeFilter(
    (duration) => Duration.isFinite(duration) && Duration.isGreaterThanOrEqualTo(duration, Duration.zero),
    $I.annote("WorkDuration", { description: "Finite nonnegative work duration measured with Effect Clock." })
  )
).pipe(
  $I.annoteSchema("WorkDuration", { description: "Measured work duration; excluded from deterministic comparisons." })
);
/** Completed-operation diagnostics. Work duration covers source preparation and
 * extraction work; it excludes queue admission and outer-owner teardown. Limits
 * are the captured policy committed by engineArtifact. Counts/versions/policy are
 * deterministic; workDuration is not semantic citation data or parity input.
 * Refusal/interruption reporting remains a separate engine integration duty.
 * **Example** (Inspect report version ownership)
 * ```ts
 * import { CitationEngineReport } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineReport.fields.engineArtifact !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineReport extends S.Opaque<CitationEngineReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("citation-engine-report/v1"),
    operation: CitationEngineOperation,
    outcome: S.tag("completed"),
    oracle: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    engineArtifact: Sha256Hex,
    limits: CitationEngineLimits,
    producedTextUtf16: count(max.producedTextUtf16),
    workDuration: WorkDuration,
    extraction: S.NullOr(CitationExtractionMeasurements),
  })
    .check(
      S.makeFilter(
        (report) => (report.operation === "extract") === (report.extraction !== null),
        $I.annote("ReportOperation", { description: "Extraction measurements belong only to extract operations." })
      ),
      S.makeFilter(
        (report) => report.producedTextUtf16 <= report.limits.producedTextUtf16,
        $I.annote("ReportTextUsage", { description: "Measured text usage cannot exceed the captured policy." })
      ),
      S.makeFilter(
        ({ extraction, limits }) =>
          extraction === null ||
          (extraction.verifiedMentions <= limits.mentions &&
            extraction.semanticCitations <= limits.candidates &&
            extraction.unverifiedCitations <= limits.candidates &&
            extraction.unverifiedComponents <= limits.candidates &&
            extraction.unboundWarnings <= limits.candidates),
        $I.annote("ReportExtractionUsage", { description: "Measured extraction counts respect captured ceilings." })
      ),
      S.makeFilter(
        ({ extraction, limits }) =>
          extraction === null ||
          extraction.tokenizer === null ||
          (extraction.tokenizer.patternsChecked <= limits.patternEvaluations &&
            extraction.tokenizer.tokens <= limits.tokens),
        $I.annote("ReportTokenizerUsage", { description: "Executed tokenizer counts respect captured ceilings." })
      ),
      S.makeFilter(
        ({ extraction }) =>
          extraction === null ||
          extraction.verifiedMentions + extraction.unverifiedCitations === extraction.semanticCitations,
        $I.annote("ReportOccurrenceAccounting", {
          description: "Every returned semantic citation is verified or explicitly unverified.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationEngineReport", {
        description: "Source-free completed operation, measured work, engine/oracle versions and captured policy.",
      })
    )
) {}
