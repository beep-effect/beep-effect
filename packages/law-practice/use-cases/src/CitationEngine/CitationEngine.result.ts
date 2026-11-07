/** Server-only completed extraction results; no private parser graph export.
 * @packageDocumentation @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Citation, CitationDocument } from "@beep/law-practice-domain/values";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import * as S from "effect/Schema";
import { CitationEngineSourceEvidence, CitationExtractionDiagnostics } from "./CitationEngine.evidence.ts";
import { CitationEngineAbsoluteMaxima } from "./CitationEngine.limits.ts";
import { CitationEngineReport } from "./CitationEngine.report.ts";

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
 * @category models @since 0.0.0
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
