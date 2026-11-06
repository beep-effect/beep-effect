import { CitationCanonicalSourceFailure } from "@beep/law-practice-server/internal/Citation/CanonicalSource";
import { failCitationExtractionBoundary } from "@beep/law-practice-server/internal/Citation/EngineFailure";
import { CitationExtractionEntryFailure } from "@beep/law-practice-server/internal/Citation/ExtractionEntry";
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
      const failed = failCitationExtractionBoundary("extract", row.error);
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
