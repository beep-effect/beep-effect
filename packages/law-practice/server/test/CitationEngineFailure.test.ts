import { CitationCallbackFailure } from "@beep/law-practice-server/internal/Citation/CallbackResource";
import { CitationCanonicalSourceFailure } from "@beep/law-practice-server/internal/Citation/CanonicalSource";
import { failCitationExtractionBoundary } from "@beep/law-practice-server/internal/Citation/EngineFailure";
import { CitationExtractionEntryFailure } from "@beep/law-practice-server/internal/Citation/ExtractionEntry";
import { CitationPythonUnicodeFailure } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationRegexTranslationFailure } from "@beep/law-practice-server/internal/Citation/RegexTranslator";
import { CitationSemanticVocabularyFailure } from "@beep/law-practice-server/internal/Citation/SemanticVocabulary";
import { CitationVerifiedExtractionFailure } from "@beep/law-practice-server/internal/Citation/VerifiedExtraction";
import { CitationEngineFailure, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";

const encode = S.encodeEffect(CitationEngineFailure);
it.effect("translates only established typed extraction boundaries and drops incidental private payloads", () =>
  Effect.gen(function* () {
    const rows = [
      { error: CitationRegexTranslationFailure.make({ reason: "unsupported-syntax" }), tag: "CitationInputError" },
      { error: CitationExtractionEntryFailure.make({ reason: "invalid-input" }), tag: "CitationInputError" },
      { error: CitationVerifiedExtractionFailure.make({ reason: "invalid-configuration" }), tag: "CitationInputError" },
      { error: CitationCanonicalSourceFailure.make({ reason: "unverifiable-text" }), tag: "CitationPrerequisiteError" },
      {
        error: CitationSemanticVocabularyFailure.make({ reason: "artifact-mismatch" }),
        tag: "CitationPrerequisiteError",
      },
      {
        error: CitationSafetyLimitExceeded.make({ operation: "clean", limit: "producedTextUtf16" }),
        tag: "CitationSafetyLimitExceeded",
      },
    ];
    for (const row of rows) {
      Reflect.set(row.error, "rawText", "private source must not escape");
      Reflect.set(row.error, "cause", { frame: "private native frame" });
      const failed = failCitationExtractionBoundary(row.error);
      const closed: Effect.Effect<never, CitationEngineFailure> = failed;
      const result = yield* closed.pipe(Effect.flip);
      expect(result._tag).toBe(row.tag);
      expect("rawText" in result).toBe(false);
      expect("cause" in result).toBe(false);
      expect("reason" in result).toBe(false);
      const encoded = yield* encode(result);
      expect(Struct.keys(encoded)).toEqual(
        row.tag === "CitationPrerequisiteError"
          ? ["_tag", "operation", "dependency"]
          : row.tag === "CitationSafetyLimitExceeded"
            ? ["_tag", "operation", "limit"]
            : ["_tag", "operation"]
      );
    }
  })
);

it.effect("retains producer deadlines and resource categories without guessing missing metadata", () =>
  Effect.gen(function* () {
    for (const limit of ["operationDeadline", "cleanDeadline", "extractDeadline", "annotateDeadline"] as const) {
      const result = yield* failCitationExtractionBoundary(
        CitationPythonUnicodeFailure.make({ reason: "deadline-exceeded", limit })
      ).pipe(Effect.flip);
      expect(result).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "extract", limit });
    }
    for (const limit of ["authorities", "resolutionIterations", "mentions", "resolutionEdges"] as const) {
      const result = yield* failCitationExtractionBoundary(
        CitationCallbackFailure.make({ reason: "limit-exceeded", limit })
      ).pipe(Effect.flip);
      expect(result).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "extract", limit });
    }
    for (const error of [
      CitationPythonUnicodeFailure.make({ reason: "deadline-exceeded" }),
      CitationCallbackFailure.make({ reason: "limit-exceeded" }),
    ]) {
      const result = yield* failCitationExtractionBoundary(error).pipe(Effect.flip);
      expect(result).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
      expect("limit" in result).toBe(false);
    }
    const evidence = yield* failCitationExtractionBoundary(
      CitationCallbackFailure.make({ reason: "evidence-failed" })
    ).pipe(Effect.flip);
    expect(evidence).toMatchObject({
      _tag: "CitationPrerequisiteError",
      operation: "extract",
      dependency: "source-evidence",
    });
  })
);
