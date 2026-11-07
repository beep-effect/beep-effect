/** Server-only completed extraction results; no private parser graph export.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Citation, CitationDocument } from "@beep/law-practice-domain/values";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import * as S from "effect/Schema";
import { CitationLiveCleanerObject } from "./CitationEngine.cleaner.ts";
import { CitationEngineSourceEvidence, CitationExtractionDiagnostics } from "./CitationEngine.evidence.ts";
import { CitationEngineAbsoluteMaxima } from "./CitationEngine.limits.ts";
import { CitationEngineReport } from "./CitationEngine.report.ts";
import { CitationPythonUnicodeStorage } from "./CitationEngine.runtime.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.result");
const Inputs = S.Struct({ plain: S.NullOr(SourceTextIdentity), markup: S.NullOr(SourceTextIdentity) }).pipe(
  $I.annoteSchema("Inputs", { description: "Original independently verified source slots; absent slots remain null." })
);
const sameSource = S.toEquivalence(SourceTextIdentity);
/** Completed extraction preserves every semantic citation, the resolved verified
 * document, genuine source lineage and explicit unverified outcomes. Work/count
 * diagnostics remain separate from legal meaning. The server retains private
 * parser state and restoration adapter evidence separately.
 * **Example** (Inspect result ownership)
 * ```ts
 * import { CitationEngineExtractionResult } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineExtractionResult.fields.document !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineExtractionResult extends S.Opaque<
  CitationEngineExtractionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    source: CitationEngineSourceEvidence,
    inputs: Inputs,
    citations: S.Array(Citation).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
    document: CitationDocument,
    diagnostics: CitationExtractionDiagnostics,
    report: CitationEngineReport,
  })
    .check(
      S.makeFilter(
        ({ source, document, report }) =>
          sameSource(source.source.source, document.source) && document.engineArtifact === report.engineArtifact,
        $I.annote("ResultIdentity", {
          description: "Verified source, resolved document and operation report retain one source and engine identity.",
        })
      ),
      S.makeFilter(
        ({ citations, document, diagnostics, report }) => {
          const counts = report.extraction;
          return (
            report.operation === "extract" &&
            counts !== null &&
            counts.semanticCitations === citations.length &&
            counts.verifiedMentions === document.mentions.length &&
            counts.unverifiedCitations === diagnostics.unverified.length &&
            counts.unverifiedComponents === diagnostics.unverifiedComponents.length &&
            counts.unboundWarnings === diagnostics.unboundWarnings.length
          );
        },
        $I.annote("ResultAccounting", {
          description:
            "Completed extraction report counts agree with the returned semantic, document and diagnostic values.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationEngineExtractionResult", {
        description:
          "Atomic semantic, verified document/evidence and separate extraction diagnostics from one operation.",
      })
    )
) {}

const AnnotationEvidence: {
  readonly source: S.Codec<VerifiedSourceText>;
  readonly companion: S.Codec<VerifiedSourceText | null>;
} = { source: VerifiedSourceText, companion: S.NullOr(VerifiedSourceText) };
/** Completed annotation retains the selected and companion source capabilities,
 * exact native output and separate captured-policy/work report. Output text is
 * rendered content; it does not assert a new verified source manifestation.
 * **Example** (Inspect lossless annotation output)
 * ```ts
 * import { CitationEngineAnnotationResult } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineAnnotationResult.fields.text !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineAnnotationResult extends S.Opaque<
  CitationEngineAnnotationResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...AnnotationEvidence,
    text: CitationPythonUnicodeStorage,
    report: CitationEngineReport,
  })
    .check(
      S.makeFilter(
        ({ report }) => report.operation === "annotate",
        $I.annote("AnnotationReport", { description: "Annotation results retain only their own operation report." })
      )
    )
    .pipe(
      $I.annoteSchema("CitationEngineAnnotationResult", {
        description:
          "Genuine annotation input evidence, exact native rendered output and separate successful-operation report.",
      })
    )
) {}

const ResolutionEvidence: { readonly source: S.Codec<VerifiedSourceText> } = { source: VerifiedSourceText };
/** Resolved document and genuine raw-source capability with a separate measured
 * operation report. Unresolved and ambiguous meanings remain document data.
 * **Example** (Inspect resolution output)
 * ```ts
 * import { CitationEngineResolutionResult } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineResolutionResult.fields.document !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineResolutionResult extends S.Opaque<
  CitationEngineResolutionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...ResolutionEvidence, document: CitationDocument, report: CitationEngineReport })
    .check(
      S.makeFilter(
        ({ source, document, report }) =>
          report.operation === "resolve" &&
          sameSource(source.source, document.source) &&
          document.engineArtifact === report.engineArtifact,
        $I.annote("ResolutionIdentity", {
          description: "Resolution output retains its verified source, captured engine and resolve operation report.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationEngineResolutionResult", {
        description: "Reverified source, completed resolution document and separate captured-policy/work report.",
      })
    )
) {}

/** Completed cleaning preserves the original owned value, an independently
 * copied native text view when text-valued, and genuine input source evidence.
 * Non-text host values remain opaque capabilities and are never coerced. The
 * cleaned value does not assert a newly verified source manifestation.
 * **Example** (Inspect the owned-value result)
 * ```ts
 * import { CitationEngineCleanResult } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineCleanResult.fields.value !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineCleanResult extends S.Opaque<CitationEngineCleanResult, { readonly brand: unique symbol }>()(
  S.Struct({
    ...ResolutionEvidence,
    value: CitationLiveCleanerObject,
    text: S.OptionFromNullOr(CitationPythonUnicodeStorage),
    report: CitationEngineReport,
  })
    .check(
      S.makeFilter(
        ({ report }) => report.operation === "clean",
        $I.annote("CleanReport", { description: "Cleaning results retain their own captured operation report." })
      )
    )
    .pipe(
      $I.annoteSchema("CitationEngineCleanResult", {
        description:
          "Genuine input source, exact owned cleaner result, optional detached native text and measured operation report.",
      })
    )
) {}
