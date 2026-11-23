/** Public-import-only prerequisite compatibility probe; no raw artifacts. */
import {
  locateRawText,
  MAX_SOURCE_TEXT_LENGTH,
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
import { convertPosition, Position } from "@beep/text/OffsetUnit";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

describe("citation engine prerequisite compatibility", () => {
  it.effect("converts Python code points through the canonical public adapter", () =>
    Effect.fromResult(
      convertPosition(Position.make({ start: 1, end: 2, unit: "unicode-code-point" }), "utf16-code-unit", "A😀B")
    ).pipe(
      Effect.tap((range) => {
        expect(range.start).toBe(1);
        expect(range.end).toBe(3);
        expect(Str.slice(range.start, range.end)("A😀B")).toBe("😀");
        return Effect.void;
      })
    )
  );

  it.effect("rejects a repeated citation locator instead of adopting the oracle diff's first occurrence", () =>
    locateRawText("1 U.S. 1. 1 U.S. 1.", "1 U.S. 1").pipe(
      Effect.flip,
      Effect.tap((failure) => {
        expect(failure.reason).toBe("ambiguous");
        expect(failure.message).not.toContain("1 U.S.");
        return Effect.void;
      })
    )
  );

  it("keeps a collapsed annotation point outside the verified nonempty range contract", () => {
    S.decodeResult(Position)({ _tag: "Position", start: 9, end: 9, unit: "unicode-code-point" }).pipe(
      Result.isFailure,
      assertTrue
    );
  });

  it("pins the public vocabulary and preserves reporter ambiguity", () => {
    CourtReporterArtifact.pipe(Result.isSuccess, assertTrue);
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
    findCourtById(CourtId.make("cafc")).pipe(O.isSome, assertTrue);
    expect(findReportersByAlias("Woolw.")).toHaveLength(2);
    expect(VERIFIED_SPAN_NORMALIZATION_VERSION).toBe("1");
    expect(MAX_SOURCE_TEXT_LENGTH).toBe(1_000_000);
  });
});
