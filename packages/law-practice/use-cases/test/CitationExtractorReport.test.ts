import { CourtReporterArtifact } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import * as Root from "@beep/law-practice-use-cases";
import * as Public from "@beep/law-practice-use-cases/public";
import {
  CitationEngineFailure,
  CitationExtractorFailure,
  CitationExtractorReport,
  CitationRecognitionError,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Type = S.toType(CitationExtractorReport);
const Json = CitationExtractorReport.pipe(S.toCodecJson, S.fromJsonString);

it.effect("retains outside-profile recognition without claiming supported occurrences or legacy parity", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    const report = CitationExtractorReport.make({
      engineArtifact: Sha256Hex.make(Str.repeat(64)("a")),
      vocabularyVersion: Result.getOrThrow(CourtReporterArtifact).artifactVersion,
      limits,
      recognizedMentions: 0,
      outsideProfile: 1,
    });
    const encoded = yield* S.encodeEffect(Json)(report);
    const decoded = yield* S.decodeEffect(Json)(encoded);
    expect(decoded).toEqual(report);
    expect(decoded.recognizerVersion).toBe("0.34.2");
    expect(decoded.outsideProfile).toBe(1);
    expect(encoded).not.toContain("oracle");
    expect(encoded).not.toContain("cpython");
    expect(encoded).not.toContain("tokenizer");
    expect(encoded).not.toContain("sourceText");
  })
);

it.effect("rejects counts exceeding effective policy and alternate profile or recognizer claims", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    const valid = CitationExtractorReport.make({
      engineArtifact: Sha256Hex.make(Str.repeat(64)("a")),
      vocabularyVersion: Result.getOrThrow(CourtReporterArtifact).artifactVersion,
      limits: { ...limits, candidates: 2, mentions: 1 },
      recognizedMentions: 1,
      outsideProfile: 1,
    });
    for (const invalid of [
      { ...valid, recognizedMentions: 2, outsideProfile: 0 },
      { ...valid, outsideProfile: 2 },
      { ...valid, profile: "all-citations" },
      { ...valid, recognizerVersion: "0.34.3" },
    ]) {
      const refused = yield* S.decodeUnknownEffect(Type)(invalid).pipe(Effect.flip);
      expect(refused._tag).toBe("SchemaError");
    }
  })
);

it.effect("keeps the extractor capability off client and package-root exports", () =>
  Effect.sync(() => {
    expect(Root).not.toHaveProperty("CitationExtractor");
    expect(Public).not.toHaveProperty("CitationExtractor");
    expect(Root).not.toHaveProperty("CitationExtractorReport");
    expect(Public).not.toHaveProperty("CitationExtractorReport");
  })
);

it.effect("serializes only finite recognition reasons and leaves legacy failures unchanged", () =>
  Effect.gen(function* () {
    const privateObservation = {
      _tag: "CitationRecognitionError",
      reason: "parser-failed",
      sourceText: "PRIVATE-RECOGNIZER-SOURCE",
      cause: "PRIVATE-RUNTIME-PATH",
    };
    const decoded = yield* S.decodeUnknownEffect(CitationRecognitionError)(privateObservation);
    const encoded = yield* S.encodeEffect(S.fromJsonString(CitationRecognitionError))(decoded);
    expect(encoded).not.toContain("PRIVATE-");
    expect(encoded).not.toContain("cause");
    expect(S.is(CitationExtractorFailure)(decoded)).toBe(true);
    expect(S.is(CitationEngineFailure)(decoded)).toBe(false);
    const refused = yield* S.decodeUnknownEffect(CitationRecognitionError)({
      _tag: "CitationRecognitionError",
      reason: "PRIVATE-RECOGNIZER-SOURCE",
    }).pipe(Effect.flip);
    expect(refused._tag).toBe("SchemaError");
  })
);
