import { CitationAdmissionFailure } from "@beep/law-practice-server/internal/Citation/Admission";
import { CitationAnnotationCallbackFailure } from "@beep/law-practice-server/internal/Citation/AnnotationCallback";
import { CitationAnnotationEntryFailure } from "@beep/law-practice-server/internal/Citation/AnnotationEntry";
import { failCitationAnnotationBoundary } from "@beep/law-practice-server/internal/Citation/AnnotationFailure";
import { CitationAnnotationMatchFailure } from "@beep/law-practice-server/internal/Citation/AnnotationSpan";
import { CitationAnnotationTemplateFailure } from "@beep/law-practice-server/internal/Citation/AnnotationTemplate";
import { CitationDiffKernelFailure } from "@beep/law-practice-server/internal/Citation/DiffKernel";
import { CitationDiffWorkerFailure } from "@beep/law-practice-server/internal/Citation/DiffWorkerProtocol";
import { CitationHtmlDiscoveryFailure } from "@beep/law-practice-server/internal/Citation/HtmlDiscovery";
import { CitationPythonUnicodeFailure } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationRegexDescriptorFailure } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { CitationRegexInputFailure } from "@beep/law-practice-server/internal/Citation/RegexInput";
import { CitationRegexTranslationFailure } from "@beep/law-practice-server/internal/Citation/RegexTranslator";
import { CitationRegexWorkerFailure } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { CitationRegexEvaluationFailure } from "@beep/law-practice-server/internal/Citation/RegexWorkerRpc";
import { CitationSpanOffsetsFailure } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import { CitationXmlKernelFailure } from "@beep/law-practice-server/internal/Citation/XmlBalanceKernel";
import { CitationXmlWorkerFailure } from "@beep/law-practice-server/internal/Citation/XmlWorkerProtocol";
import {
  CitationEngineFailure,
  CitationInputError,
  CitationOperationUnsupported,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Json = S.fromJsonString(CitationEngineFailure);
it.effect("redacts every typed annotation adapter failure without inventing unsupported modes", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const errors = [
      CitationAdmissionFailure.make({ reason: "closed" }),
      CitationAnnotationCallbackFailure.make({ reason: "callback-failed" }),
      CitationAnnotationEntryFailure.make({ reason: "invalid-configuration" }),
      CitationAnnotationMatchFailure.make({ reason: "invalid-capture" }),
      CitationAnnotationTemplateFailure.make({}),
      CitationDiffKernelFailure.make({ reason: "kernel-failed" }),
      CitationDiffWorkerFailure.make({ reason: "channel-failed" }),
      CitationHtmlDiscoveryFailure.make({ reason: "invalid-match" }),
      CitationPythonUnicodeFailure.make({ reason: "invalid-input" }),
      CitationRegexDescriptorFailure.make({ reason: "profile-mismatch" }),
      CitationRegexInputFailure.make({ reason: "invalid-range" }),
      CitationRegexTranslationFailure.make({ reason: "unsupported-syntax" }),
      CitationRegexWorkerFailure.make({ reason: "invalid-frame" }),
      CitationRegexEvaluationFailure.make({ reason: "unsupported-profile" }),
      CitationSpanOffsetsFailure.make({ reason: "invalid-offset" }),
      CitationXmlKernelFailure.make({ reason: "native-failed" }),
      CitationXmlWorkerFailure.make({ reason: "channel-failed" }),
    ];
    for (const error of errors) {
      Reflect.set(error, "rawText", "private source text");
      Reflect.set(error, "cause", { frame: "private native frame" });
      const failed: Effect.Effect<never, CitationEngineFailure> = failCitationAnnotationBoundary(limits, error);
      const result = yield* failed.pipe(Effect.flip);
      expect(result._tag).toBe("CitationAnnotationError");
      expect(result.operation).toBe("annotate");
      const json = yield* S.encodeEffect(Json)(result);
      expect(json).not.toContain("private");
      expect("cause" in result).toBe(false);
      expect("reason" in result).toBe(false);
    }
  })
);
it.effect("retains input/prerequisite/explicit-mode categories and exact resource deadlines", () =>
  Effect.gen(function* () {
    const defaults = (yield* defaultCitationEnginePolicy).limits;
    const limits = { ...defaults, operationDeadline: Duration.millis(20), annotateDeadline: Duration.millis(50) };
    const cases = [
      { error: CitationAnnotationEntryFailure.make({ reason: "invalid-input" }), tag: "CitationInputError" },
      { error: CitationInputError.make({ operation: "extract" }), tag: "CitationInputError" },
      {
        error: CitationPrerequisiteError.make({ operation: "extract", dependency: "source-evidence" }),
        tag: "CitationPrerequisiteError",
      },
      { error: CitationOperationUnsupported.make({ operation: "extract" }), tag: "CitationOperationUnsupported" },
      {
        error: CitationSafetyLimitExceeded.make({ operation: "clean", limit: "diffSteps" }),
        tag: "CitationSafetyLimitExceeded",
      },
    ];
    for (const row of cases) {
      const result = yield* failCitationAnnotationBoundary(limits, row.error).pipe(Effect.flip);
      expect(result).toMatchObject({ _tag: row.tag, operation: "annotate" });
    }
    const exhausted = yield* failCitationAnnotationBoundary(
      limits,
      CitationPythonUnicodeFailure.make({ reason: "limit-exceeded" })
    ).pipe(Effect.flip);
    expect(exhausted).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation: "annotate",
      limit: "producedTextUtf16",
    });
    const total = yield* failCitationAnnotationBoundary(
      limits,
      CitationPythonUnicodeFailure.make({ reason: "deadline-exceeded" })
    ).pipe(Effect.flip);
    expect(total).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "operationDeadline" });
    const stage = yield* failCitationAnnotationBoundary(
      { ...limits, operationDeadline: Duration.millis(100) },
      CitationPythonUnicodeFailure.make({ reason: "deadline-exceeded" })
    ).pipe(Effect.flip);
    expect(stage).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "annotateDeadline" });
  })
);
