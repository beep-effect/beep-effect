/** Complete typed extraction/document method failure boundary.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationCleanerFailure,
  CitationEngineFailure,
  CitationInputError,
  CitationOperationUnsupported,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
  CitationTokenizerFailure,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { CitationAdmissionFailure } from "./Admission.ts";
import { CitationCallbackFailure } from "./CallbackResource.ts";
import { CitationCanonicalSourceFailure } from "./CanonicalSource.ts";
import { CitationCaseMetadataFailure } from "./CaseMetadata.ts";
import { CitationCaseNameProcessFailure } from "./CaseNameProcess.ts";
import { CitationCaseNameScanFailure } from "./CaseNameScan.ts";
import { CitationContextMatcherFailure } from "./ContextMatcher.ts";
import { CitationCourtLookupFailure } from "./CourtLookup.ts";
import { CitationDiffKernelFailure } from "./DiffKernel.ts";
import { CitationDiffWorkerFailure } from "./DiffWorkerProtocol.ts";
import { CitationDocumentExtractionFailure } from "./DocumentExtraction.ts";
import { CitationEditionInferenceFailure } from "./EditionInference.ts";
import { CitationExtractionEntryFailure } from "./ExtractionEntry.ts";
import { CitationExtractionLoopFailure } from "./ExtractionLoop.ts";
import { CitationExtractionSelectionFailure } from "./ExtractionSelection.ts";
import { CitationFrozenEditionFailure } from "./FrozenEditions.ts";
import { CitationFullExtractionFailure } from "./FullExtraction.ts";
import { CitationGeneratedReferenceFailure } from "./GeneratedReferences.ts";
import { CitationHtmlCaseNameFailure } from "./HtmlCaseName.ts";
import { CitationHtmlDiscoveryFailure } from "./HtmlDiscovery.ts";
import { CitationHtmlTagGeometryFailure } from "./HtmlTagGeometry.ts";
import { CitationDocumentInputFailure } from "./InputDocument.ts";
import { CitationJournalMetadataFailure } from "./JournalMetadata.ts";
import { CitationLawMetadataFailure } from "./LawMetadata.ts";
import { CitationMentionFailure } from "./Mention.ts";
import { CitationMetadataStringsFailure } from "./MetadataStrings.ts";
import { CitationMetadataYearFailure } from "./MetadataYear.ts";
import { CitationOccurrenceProjectionFailure } from "./OccurrenceProjection.ts";
import { CitationPinExtractionFailure } from "./PinExtraction.ts";
import { CitationPostCaseMetadataFailure } from "./PostCaseMetadata.ts";
import { CitationPreCaseMetadataFailure } from "./PreCaseMetadata.ts";
import { CitationPythonCharacterFailure } from "./PythonCharacters.ts";
import { CitationPythonUnicodeFailure } from "./PythonUnicode.ts";
import { CitationReferenceNamesFailure } from "./ReferenceNames.ts";
import { CitationReferencePatternFailure } from "./ReferencePatterns.ts";
import { CitationReferenceTokenFailure } from "./ReferenceTokenExtraction.ts";
import { CitationRegexDescriptorFailure } from "./RegexDescriptors.ts";
import { CitationRegexInputFailure } from "./RegexInput.ts";
import { CitationRegexTranslationFailure } from "./RegexTranslator.ts";
import { CitationRegexWorkerFailure } from "./RegexWorkerProtocol.ts";
import { CitationRegexEvaluationFailure } from "./RegexWorkerRpc.ts";
import { CitationSemanticExtractionFailure } from "./SemanticExtraction.ts";
import { CitationSemanticProjectionFailure } from "./SemanticProjection.ts";
import { CitationSemanticVocabularyFailure } from "./SemanticVocabulary.ts";
import { CitationSpanOffsetsFailure } from "./SpanOffsets.ts";
import { CitationStopWordsFailure } from "./StopWords.ts";
import { CitationTokenContextFailure } from "./TokenContext.ts";
import { CitationTokenDispatchFailure } from "./TokenDispatch.ts";
import { CitationTokenizedExtractionFailure } from "./TokenizedExtraction.ts";
import { CitationVerifiedExtractionFailure } from "./VerifiedExtraction.ts";

const $I = $LawPracticeServerId.create("internal/Citation/EngineFailure");
const Failure = S.Union([
  CitationEngineFailure,
  CitationCleanerFailure,
  CitationTokenizerFailure,
  CitationAdmissionFailure,
  CitationCallbackFailure,
  CitationCanonicalSourceFailure,
  CitationCaseMetadataFailure,
  CitationCaseNameProcessFailure,
  CitationCaseNameScanFailure,
  CitationContextMatcherFailure,
  CitationCourtLookupFailure,
  CitationDiffKernelFailure,
  CitationDiffWorkerFailure,
  CitationDocumentExtractionFailure,
  CitationEditionInferenceFailure,
  CitationExtractionEntryFailure,
  CitationExtractionLoopFailure,
  CitationExtractionSelectionFailure,
  CitationFrozenEditionFailure,
  CitationFullExtractionFailure,
  CitationGeneratedReferenceFailure,
  CitationHtmlCaseNameFailure,
  CitationHtmlDiscoveryFailure,
  CitationHtmlTagGeometryFailure,
  CitationDocumentInputFailure,
  CitationJournalMetadataFailure,
  CitationLawMetadataFailure,
  CitationMentionFailure,
  CitationMetadataStringsFailure,
  CitationMetadataYearFailure,
  CitationOccurrenceProjectionFailure,
  CitationPinExtractionFailure,
  CitationPostCaseMetadataFailure,
  CitationPreCaseMetadataFailure,
  CitationPythonCharacterFailure,
  CitationPythonUnicodeFailure,
  CitationReferenceNamesFailure,
  CitationReferencePatternFailure,
  CitationReferenceTokenFailure,
  CitationRegexDescriptorFailure,
  CitationRegexInputFailure,
  CitationRegexTranslationFailure,
  CitationRegexWorkerFailure,
  CitationRegexEvaluationFailure,
  CitationSemanticExtractionFailure,
  CitationSemanticProjectionFailure,
  CitationSemanticVocabularyFailure,
  CitationSpanOffsetsFailure,
  CitationStopWordsFailure,
  CitationTokenContextFailure,
  CitationTokenDispatchFailure,
  CitationTokenizedExtractionFailure,
  CitationVerifiedExtractionFailure,
]).pipe(
  $I.annoteSchema("Failure", {
    description:
      "Complete typed connected extraction failure set; no unknown-error fallback or unsupported capability substitution.",
  })
);
const input = () => Effect.fail(CitationInputError.make({ operation: "extract" }));
const source = () =>
  Effect.fail(CitationPrerequisiteError.make({ operation: "extract", dependency: "source-evidence" }));
const vocabulary = () =>
  Effect.fail(CitationPrerequisiteError.make({ operation: "extract", dependency: "court-reporter-vocabulary" }));
/** Reconstruct only declared public fields. Preserve actual native deadline and
 * resource metadata and canonical prerequisite failures. Other typed adapter
 * refusals are input failures; missing canonical capabilities never become an
 * unsupported requested mode. Interruption and defects bypass typed catch.
 * @internal @category operations @since 0.0.0
 */
export const failCitationExtractionBoundary = Effect.fn("Citation.failExtractionBoundary")(function* (
  error: typeof Failure.Type
): Effect.fn.Return<never, CitationEngineFailure> {
  yield* Effect.logDebug("Citation extraction boundary refused").pipe(
    Effect.annotateLogs({ operation: "extract", failureClass: error._tag })
  );
  const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
    Effect.fail(CitationSafetyLimitExceeded.make({ operation: "extract", limit }));
  return yield* Match.value(error).pipe(
    Match.tagsExhaustive({
      CitationInputError: input,
      CitationAnnotationError: input,
      CitationCleanerFailure: input,
      CitationTokenizerFailure: input,
      CitationPrerequisiteError: (failure) =>
        Effect.fail(CitationPrerequisiteError.make({ operation: "extract", dependency: failure.dependency })),
      CitationSafetyLimitExceeded: (failure) => safety(failure.limit),
      CitationOperationUnsupported: () => Effect.fail(CitationOperationUnsupported.make({ operation: "extract" })),
      CitationAdmissionFailure: input,
      CitationCallbackFailure: (failure) =>
        failure.reason === "evidence-failed"
          ? source()
          : failure.reason === "limit-exceeded" && failure.limit !== undefined
            ? safety(failure.limit)
            : input(),
      CitationCanonicalSourceFailure: source,
      CitationCaseMetadataFailure: input,
      CitationCaseNameProcessFailure: input,
      CitationCaseNameScanFailure: input,
      CitationContextMatcherFailure: input,
      CitationCourtLookupFailure: input,
      CitationDiffKernelFailure: input,
      CitationDiffWorkerFailure: input,
      CitationDocumentExtractionFailure: input,
      CitationEditionInferenceFailure: input,
      CitationExtractionEntryFailure: input,
      CitationExtractionLoopFailure: input,
      CitationExtractionSelectionFailure: input,
      CitationFrozenEditionFailure: vocabulary,
      CitationFullExtractionFailure: input,
      CitationGeneratedReferenceFailure: input,
      CitationHtmlCaseNameFailure: input,
      CitationHtmlDiscoveryFailure: input,
      CitationHtmlTagGeometryFailure: input,
      CitationDocumentInputFailure: input,
      CitationJournalMetadataFailure: input,
      CitationLawMetadataFailure: input,
      CitationMentionFailure: source,
      CitationMetadataStringsFailure: input,
      CitationMetadataYearFailure: input,
      CitationOccurrenceProjectionFailure: (failure) =>
        failure.reason === "source-mismatch" || failure.reason === "unverifiable-source" ? source() : input(),
      CitationPinExtractionFailure: input,
      CitationPostCaseMetadataFailure: input,
      CitationPreCaseMetadataFailure: input,
      CitationPythonCharacterFailure: input,
      CitationPythonUnicodeFailure: (failure) =>
        failure.reason === "invalid-input"
          ? input()
          : failure.reason === "limit-exceeded"
            ? safety("producedTextUtf16")
            : failure.limit === undefined
              ? input()
              : safety(failure.limit),
      CitationReferenceNamesFailure: input,
      CitationReferencePatternFailure: input,
      CitationReferenceTokenFailure: input,
      CitationRegexDescriptorFailure: input,
      CitationRegexInputFailure: input,
      CitationRegexTranslationFailure: input,
      CitationRegexWorkerFailure: input,
      CitationRegexEvaluationFailure: input,
      CitationSemanticExtractionFailure: input,
      CitationSemanticProjectionFailure: input,
      CitationSemanticVocabularyFailure: vocabulary,
      CitationSpanOffsetsFailure: input,
      CitationStopWordsFailure: input,
      CitationTokenContextFailure: input,
      CitationTokenDispatchFailure: input,
      CitationTokenizedExtractionFailure: input,
      CitationVerifiedExtractionFailure: input,
    })
  );
});
