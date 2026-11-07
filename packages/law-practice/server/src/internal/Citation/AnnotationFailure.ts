/** Closed annotation boundary over the existing typed native/source failures.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAnnotationError,
  CitationEngineFailure,
  CitationInputError,
  CitationOperationUnsupported,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { CitationAdmissionFailure } from "./Admission.ts";
import { failCitationAnnotationUnicode } from "./AnnotationBudget.ts";
import { CitationAnnotationCallbackFailure } from "./AnnotationCallback.ts";
import { CitationAnnotationEntryFailure } from "./AnnotationEntry.ts";
import { CitationAnnotationMatchFailure } from "./AnnotationSpan.ts";
import { CitationAnnotationTemplateFailure } from "./AnnotationTemplate.ts";
import { CitationDiffKernelFailure } from "./DiffKernel.ts";
import { CitationDiffWorkerFailure } from "./DiffWorkerProtocol.ts";
import { CitationHtmlDiscoveryFailure } from "./HtmlDiscovery.ts";
import { CitationPythonUnicodeFailure } from "./PythonUnicode.ts";
import { CitationRegexDescriptorFailure } from "./RegexDescriptors.ts";
import { CitationRegexInputFailure } from "./RegexInput.ts";
import { CitationRegexTranslationFailure } from "./RegexTranslator.ts";
import { CitationRegexWorkerFailure } from "./RegexWorkerProtocol.ts";
import { CitationRegexEvaluationFailure } from "./RegexWorkerRpc.ts";
import { CitationSpanOffsetsFailure } from "./SpanOffsets.ts";
import { CitationXmlKernelFailure } from "./XmlBalanceKernel.ts";
import { CitationXmlWorkerFailure } from "./XmlWorkerProtocol.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/AnnotationFailure");
const Failure = S.Union([
  CitationEngineFailure,
  CitationAdmissionFailure,
  CitationAnnotationCallbackFailure,
  CitationAnnotationEntryFailure,
  CitationAnnotationMatchFailure,
  CitationAnnotationTemplateFailure,
  CitationDiffKernelFailure,
  CitationDiffWorkerFailure,
  CitationHtmlDiscoveryFailure,
  CitationPythonUnicodeFailure,
  CitationRegexDescriptorFailure,
  CitationRegexInputFailure,
  CitationRegexTranslationFailure,
  CitationRegexWorkerFailure,
  CitationRegexEvaluationFailure,
  CitationSpanOffsetsFailure,
  CitationXmlKernelFailure,
  CitationXmlWorkerFailure,
]).pipe(
  $I.annoteSchema("Failure", {
    description:
      "Exhaustive typed source annotation failures; no unknown-error fallback or request-controlled dispatch.",
  })
);
const annotation = () => Effect.fail(CitationAnnotationError.make({}));
const input = () => Effect.fail(CitationInputError.make({ operation: "annotate" }));
/** Reconstruct only declared fields. Native/port refusal is annotation failure,
 * never a missing-capability unsupported mode. Unicode limits retain the actual
 * resource/deadline category. Logs contain only fixed operation/class labels.
 * @internal @category operations @since 0.0.0
 */
export const failCitationAnnotationBoundary = Effect.fn("Citation.failAnnotationBoundary")(function* (
  limits: CitationEngineLimits,
  error: typeof Failure.Type
): Effect.fn.Return<never, CitationEngineFailure> {
  yield* Effect.logDebug("Citation annotation boundary refused").pipe(
    Effect.annotateLogs({ operation: "annotate", failureClass: error._tag })
  );
  return yield* Match.value(error).pipe(
    Match.tagsExhaustive({
      CitationAdmissionFailure: annotation,
      CitationAnnotationCallbackFailure: annotation,
      CitationAnnotationEntryFailure: (failure) => (failure.reason === "invalid-input" ? input() : annotation()),
      CitationAnnotationMatchFailure: annotation,
      CitationAnnotationTemplateFailure: annotation,
      CitationDiffKernelFailure: annotation,
      CitationDiffWorkerFailure: annotation,
      CitationHtmlDiscoveryFailure: annotation,
      CitationPythonUnicodeFailure: (failure) =>
        failCitationAnnotationUnicode(limits, () => CitationAnnotationError.make({}), failure),
      CitationRegexDescriptorFailure: annotation,
      CitationRegexInputFailure: annotation,
      CitationRegexTranslationFailure: annotation,
      CitationRegexWorkerFailure: annotation,
      CitationRegexEvaluationFailure: annotation,
      CitationSpanOffsetsFailure: annotation,
      CitationXmlKernelFailure: annotation,
      CitationXmlWorkerFailure: annotation,
      CitationInputError: input,
      CitationAnnotationError: annotation,
      CitationPrerequisiteError: (failure) =>
        Effect.fail(CitationPrerequisiteError.make({ operation: "annotate", dependency: failure.dependency })),
      CitationSafetyLimitExceeded: (failure) =>
        Effect.fail(CitationSafetyLimitExceeded.make({ operation: "annotate", limit: failure.limit })),
      CitationOperationUnsupported: () => Effect.fail(CitationOperationUnsupported.make({ operation: "annotate" })),
    })
  );
});
