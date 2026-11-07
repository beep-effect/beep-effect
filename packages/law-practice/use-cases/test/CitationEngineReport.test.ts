import * as Root from "@beep/law-practice-use-cases";
import * as Public from "@beep/law-practice-use-cases/public";
import { CitationEngineReport, CitationExtractionMeasurements } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Json = CitationEngineReport.pipe(S.toCodecJson, S.fromJsonString);
const Type = S.toType(CitationEngineReport);
const empty = CitationExtractionMeasurements.make({
  tokenizer: null,
  semanticCitations: 1,
  verifiedMentions: 0,
  unverifiedCitations: 1,
  unverifiedComponents: 0,
  unboundWarnings: 0,
});
it.effect("round-trips source-free reports without conflating a skipped tokenizer with zero results", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const report = CitationEngineReport.make({
      operation: "extract",
      engineArtifact: Sha256Hex.make(Str.repeat(64)("a")),
      limits,
      workDuration: Duration.millis(2.5),
      producedTextUtf16: 0,
      extraction: empty,
    });
    const encoded = yield* S.encodeEffect(Json)(report);
    const decoded = yield* S.decodeEffect(Json)(encoded);
    expect(decoded).toEqual(report);
    expect(Duration.toMillis(decoded.workDuration)).toBe(2.5);
    expect(decoded.extraction?.tokenizer).toBe(null);
    const executed = CitationExtractionMeasurements.make({ ...empty, tokenizer: { patternsChecked: 0, tokens: 0 } });
    expect(executed.tokenizer).toEqual({ patternsChecked: 0, tokens: 0 });
    expect(encoded).not.toContain("sourceText");
    expect(encoded).not.toContain("quote");
    expect(encoded).not.toContain("sourceRef");
  })
);
it.effect("rejects impossible operation, policy usage and timing combinations", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const valid = CitationEngineReport.make({
      operation: "extract",
      engineArtifact: Sha256Hex.make(Str.repeat(64)("a")),
      limits,
      workDuration: Duration.zero,
      producedTextUtf16: 0,
      extraction: empty,
    });
    for (const invalid of [
      { ...valid, operation: "clean" },
      { ...valid, extraction: null },
      { ...valid, extraction: { ...empty, semanticCitations: 2 } },
      { ...valid, producedTextUtf16: limits.producedTextUtf16 + 1 },
      { ...valid, workDuration: Duration.infinity },
      { ...valid, extraction: { ...empty, tokenizer: { patternsChecked: limits.patternEvaluations + 1, tokens: 0 } } },
    ]) {
      const refused = yield* S.decodeUnknownEffect(Type)(invalid).pipe(Effect.flip);
      expect(refused._tag).toBe("SchemaError");
    }
    expect("CitationEngineReport" in Root).toBe(false);
    expect("CitationEngineReport" in Public).toBe(false);
    expect("CitationExtractionMeasurements" in Root).toBe(false);
    expect("CitationExtractionMeasurements" in Public).toBe(false);
  })
);

const PropertyType = S.toType(CitationExtractionMeasurements);
const PropertyJson = CitationExtractionMeasurements.pipe(S.toCodecJson, S.fromJsonString);
const propertyEquivalent = S.toEquivalence(PropertyType);
it.effect.prop(
  "preserves extraction measurements including skipped versus executed tokenizers through JSON",
  { value: Arbitrary.schema(PropertyType) },
  ({ value }) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(PropertyJson)(value);
      const decoded = yield* S.decodeEffect(PropertyJson)(encoded);
      expect(propertyEquivalent(value, decoded)).toBe(true);
    }),
  { arbitrary: fcRuns(100) }
);
