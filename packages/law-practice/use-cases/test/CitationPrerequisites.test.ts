/** Public-import-only prerequisite compatibility probe; no raw artifacts. */
import {
  convertTextOffsetRange,
  MAX_SOURCE_TEXT_LENGTH,
  TextOffsetRange,
  VERIFIED_SPAN_NORMALIZATION_VERSION,
} from "@beep/langextract/VerifiedSpan";
import {
  CourtId,
  CourtReporterArtifact,
  findCourtById,
  findReportersByAlias,
  isCurrentCourtReporterArtifactVersion,
} from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

describe("citation engine prerequisite compatibility", () => {
  it.effect("converts Python code points through the canonical public adapter", () =>
    convertTextOffsetRange(
      TextOffsetRange.make({
        start: S.Natural.make(1),
        end: S.Natural.make(2),
        unit: "unicode-code-point",
      }),
      "A😀B"
    ).pipe(
      Effect.tap((range) => {
        expect(range.startChar).toBe(1);
        expect(range.endChar).toBe(3);
        expect(Str.slice(range.startChar, range.endChar)("A😀B")).toBe("😀");
        return Effect.void;
      })
    )
  );

  it("pins the public vocabulary and preserves reporter ambiguity", () => {
    expect(Result.isSuccess(CourtReporterArtifact)).toBe(true);
    if (Result.isFailure(CourtReporterArtifact)) {
      throw new Error("Public court/reporter artifact failed schema decoding");
    }
    const artifact = CourtReporterArtifact.success;
    expect(artifact.artifactVersion).toBe("crv1:f353e51400a5:fad63b383b92");
    expect(artifact.schemaVersion).toBe("court-reporter-vocabulary/v1");
    expect(artifact.projectionVersion).toBe(1);
    expect(artifact.courts.stableIdCount).toBe(2809);
    expect(artifact.reporters.stableIdCount).toBe(1262);
    expect(isCurrentCourtReporterArtifactVersion(artifact.artifactVersion)).toBe(true);
    expect(isCurrentCourtReporterArtifactVersion("stale")).toBe(false);
    expect(O.isSome(findCourtById(CourtId.make("cafc")))).toBe(true);
    expect(findReportersByAlias("Woolw.")).toHaveLength(2);
    expect(VERIFIED_SPAN_NORMALIZATION_VERSION).toBe("1");
    expect(MAX_SOURCE_TEXT_LENGTH).toBe(1_000_000);
  });
});
