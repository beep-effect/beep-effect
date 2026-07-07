import { alignCandidate, alignCandidates } from "@beep/langextract/Alignment";
import { ExtractionCandidate, LangExtractOptions } from "@beep/langextract/Extraction";
import { UnitInterval } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ExtractionCandidateArbitrary = S.toArbitrary(ExtractionCandidate);

describe("alignCandidate", () => {
  it("finds exact source matches", () => {
    const extraction = alignCandidate(
      "Alice founded Acme.",
      ExtractionCandidate.make({ label: "person", text: "Alice" })
    );

    expect(extraction.alignmentStatus).toBe("match_exact");
    expect(extraction.span?.start).toBe(0);
    expect(extraction.span?.end).toBe(5);
  });

  it("falls back to case-insensitive lesser matches", () => {
    const extraction = alignCandidate(
      "Alice founded Acme.",
      ExtractionCandidate.make({ label: "organization", text: "acme" })
    );

    expect(extraction.alignmentStatus).toBe("match_lesser");
    expect(extraction.matchedText).toBe("Acme");
  });

  it("keeps lesser match spans anchored to source offsets after Unicode lowercase expansion", () => {
    const extraction = alignCandidate(
      "A\u0130 Alice founded Acme.",
      ExtractionCandidate.make({ label: "person", text: "alice" })
    );

    expect(extraction.alignmentStatus).toBe("match_lesser");
    expect(extraction.matchedText).toBe("Alice");
    expect(extraction.span?.start).toBe(3);
    expect(extraction.span?.end).toBe(8);
  });

  it("matches decomposed source text when the query lowercases to more code units", () => {
    const extraction = alignCandidate(
      "i\u0307 founded Acme.",
      ExtractionCandidate.make({ label: "person", text: "\u0130" })
    );

    expect(extraction.alignmentStatus).toBe("match_lesser");
    expect(extraction.matchedText).toBe("i\u0307");
    expect(extraction.span?.start).toBe(0);
    expect(extraction.span?.end).toBe(2);
  });

  it("uses bounded fuzzy matching", () => {
    const extraction = alignCandidate(
      "Alice founded Acme.",
      ExtractionCandidate.make({ label: "organization", text: "Acmee" }),
      LangExtractOptions.make({ fuzzyThreshold: UnitInterval.make(0.75) })
    );

    expect(extraction.alignmentStatus).toBe("match_fuzzy");
    expect(extraction.matchedText).toBe("Acme.");
  });

  it("scores fuzzy matching by Unicode code points", () => {
    const extraction = alignCandidate(
      "\u{1F389}",
      ExtractionCandidate.make({ label: "event", text: "\u{1F38A}" }),
      LangExtractOptions.make({ fuzzyThreshold: UnitInterval.make(0.25) })
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
  });

  it("marks candidates unaligned when no match passes", () => {
    const extraction = alignCandidate(
      "Alice founded Acme.",
      ExtractionCandidate.make({ label: "place", text: "Paris" })
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
    expect(extraction.span).toBeUndefined();
  });

  it("keeps schema-derived aligned spans inside the source text", () =>
    fc.assert(
      fc.property(ExtractionCandidateArbitrary, fc.string(), fc.string(), (candidate, prefix, suffix) => {
        const sourceText = `${prefix}${candidate.text}${suffix}`;
        const extraction = alignCandidate(sourceText, candidate);

        if (extraction.span !== undefined) {
          expect(extraction.span.start).toBeGreaterThanOrEqual(0);
          expect(extraction.span.end).toBeLessThanOrEqual(sourceText.length);
          expect(extraction.matchedText).toBe(sourceText.slice(extraction.span.start, extraction.span.end));
        }
      }),
      { numRuns: 50 }
    ));

  it("honors maxExtractions for schema-derived candidates", () =>
    fc.assert(
      fc.property(
        fc.array(ExtractionCandidateArbitrary, { maxLength: 32 }),
        fc.integer({ min: 0, max: 32 }),
        (candidates, maxExtractions) => {
          const aligned = alignCandidates(
            "",
            candidates,
            LangExtractOptions.make({ maxExtractions: NonNegativeInt.make(maxExtractions) })
          );

          expect(aligned.length).toBeLessThanOrEqual(maxExtractions);
          expect(aligned.length).toBeLessThanOrEqual(candidates.length);
        }
      ),
      { numRuns: 50 }
    ));
});
