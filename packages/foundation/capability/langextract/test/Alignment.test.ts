import {
  AlignedMatchFromMatchedText,
  AlignmentSource,
  alignCandidate,
  alignCandidates,
  CurrentAlignmentSource,
  GroundedExtractionFromCandidate,
  GroundedExtractionsFromCandidates,
  MatchedTextFromScored,
  SpanFromMatch,
  spanFromMatch,
} from "@beep/langextract/Alignment";
import { ExtractionCandidate } from "@beep/langextract/Extraction";
import { Contract, UnitInterval } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ExtractionCandidateArbitrary = S.toArbitrary(ExtractionCandidate)(fc);

const sourceOf = (sourceText: string) => AlignmentSource.make({ sourceText });

describe("alignCandidate", () => {
  it("finds exact source matches", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "person", text: "Alice" }),
      sourceOf("Alice founded Acme.")
    );

    expect(extraction.alignmentStatus).toBe("match_exact");
    expect(extraction.span?.start).toBe(0);
    expect(extraction.span?.end).toBe(5);
  });

  it("aligns through the data-last pipeable form", () => {
    const extraction = alignCandidate(sourceOf("Alice founded Acme."))(
      ExtractionCandidate.make({ label: "person", text: "Alice" })
    );

    expect(extraction.alignmentStatus).toBe("match_exact");
  });

  it("falls back to case-insensitive lesser matches", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "organization", text: "acme" }),
      sourceOf("Alice founded Acme.")
    );

    expect(extraction.alignmentStatus).toBe("match_lesser");
    expect(extraction.matchedText).toBe("Acme");
  });

  it("keeps lesser match spans anchored to source offsets after Unicode lowercase expansion", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "person", text: "alice" }),
      sourceOf("Aİ Alice founded Acme.")
    );

    expect(extraction.alignmentStatus).toBe("match_lesser");
    expect(extraction.matchedText).toBe("Alice");
    expect(extraction.span?.start).toBe(3);
    expect(extraction.span?.end).toBe(8);
  });

  it("matches decomposed source text when the query lowercases to more code units", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "person", text: "İ" }),
      sourceOf("i̇ founded Acme.")
    );

    expect(extraction.alignmentStatus).toBe("match_lesser");
    expect(extraction.matchedText).toBe("i̇");
    expect(extraction.span?.start).toBe(0);
    expect(extraction.span?.end).toBe(2);
  });

  it("uses bounded fuzzy matching", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "organization", text: "Acmee" }),
      AlignmentSource.make({ fuzzyThreshold: UnitInterval.make(0.75), sourceText: "Alice founded Acme." })
    );

    expect(extraction.alignmentStatus).toBe("match_fuzzy");
    expect(extraction.matchedText).toBe("Acme.");
  });

  it("scores fuzzy matching by Unicode code points", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "event", text: "\u{1F38A}" }),
      AlignmentSource.make({ fuzzyThreshold: UnitInterval.make(0.25), sourceText: "\u{1F389}" })
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
  });

  it("marks candidates unaligned when no match passes", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "place", text: "Paris" }),
      sourceOf("Alice founded Acme.")
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
    expect(extraction.span).toBeUndefined();
  });

  it("keeps schema-derived aligned spans inside the source text", () =>
    fc.assert(
      fc.property(ExtractionCandidateArbitrary, fc.string(), fc.string(), (candidate, prefix, suffix) => {
        const sourceText = `${prefix}${candidate.text}${suffix}`;
        const extraction = alignCandidate(candidate, sourceOf(sourceText));

        if (extraction.span !== undefined) {
          expect(extraction.span.start).toBeGreaterThanOrEqual(0);
          expect(extraction.span.end).toBeLessThanOrEqual(sourceText.length);
          expect(extraction.matchedText).toBe(sourceText.slice(extraction.span.start, extraction.span.end));
        }
      }),
      fcRuns(50)
    ));

  it("honors maxExtractions for schema-derived candidates", () =>
    fc.assert(
      fc.property(
        fc.array(ExtractionCandidateArbitrary, { maxLength: 32 }),
        fc.integer({ min: 0, max: 32 }),
        (candidates, maxExtractions) => {
          const aligned = alignCandidates(
            candidates,
            AlignmentSource.make({
              maxExtractions: O.some(NonNegativeInt.make(maxExtractions)),
              sourceText: "",
            })
          );

          expect(aligned.length).toBeLessThanOrEqual(maxExtractions);
          expect(aligned.length).toBeLessThanOrEqual(candidates.length);
        }
      ),
      fcRuns(50)
    ));
});

describe("SpanFromMatch", () => {
  it("decodes a matched slice into a half-open span", () => {
    const span = S.decodeSync(SpanFromMatch)([4, "Lovelace"]);

    expect(span.start).toBe(4);
    expect(span.end).toBe(12);
    expect(span).toStrictEqual(spanFromMatch([NonNegativeInt.make(4), "Lovelace"]));
  });

  it.effect(
    "encodes a span back to its matched slice through the current alignment source",
    Effect.fnUntraced(function* () {
      const span = Contract.Span.make({ end: NonNegativeInt.make(12), start: NonNegativeInt.make(4) });
      const match = yield* S.encodeEffect(SpanFromMatch)(span).pipe(
        Effect.provideService(CurrentAlignmentSource, sourceOf("Ada Lovelace wrote notes."))
      );

      expect(match).toStrictEqual([4, "Lovelace"]);
    })
  );

  it.effect(
    "fails closed when a span exceeds the current alignment source",
    Effect.fnUntraced(function* () {
      const span = Contract.Span.make({ end: NonNegativeInt.make(99), start: NonNegativeInt.make(4) });
      const error = yield* S.encodeEffect(SpanFromMatch)(span).pipe(
        Effect.provideService(CurrentAlignmentSource, sourceOf("Ada")),
        Effect.flip
      );

      expect(error._tag).toBe("SchemaError");
    })
  );
});

describe("MatchedTextFromScored", () => {
  it("drops the similarity score on decode", () => {
    expect(S.decodeSync(MatchedTextFromScored)([0, "Acme.", 0.8])).toStrictEqual([0, "Acme."]);
  });

  it.effect(
    "forbids encoding because scores are not recoverable",
    Effect.fnUntraced(function* () {
      const match = yield* S.decodeEffect(MatchedTextFromScored)([0, "Acme.", 0.8]);
      const error = yield* S.encodeEffect(MatchedTextFromScored)(match).pipe(Effect.flip);

      expect(error._tag).toBe("SchemaError");
    })
  );
});

describe("AlignedMatchFromMatchedText", () => {
  it("tags and untags a matched slice", () => {
    const ExactMatch = AlignedMatchFromMatchedText("match_exact");
    const aligned = S.decodeSync(ExactMatch)([0, "Ada"]);

    expect(aligned).toStrictEqual(["match_exact", 0, "Ada"]);
    expect(S.encodeSync(ExactMatch)(aligned)).toStrictEqual([0, "Ada"]);
  });
});

describe("GroundedExtractionFromCandidate", () => {
  it.effect(
    "grounds a candidate against the current alignment source",
    Effect.fnUntraced(function* () {
      const grounded = yield* S.decodeEffect(GroundedExtractionFromCandidate)({
        label: "person",
        text: "Ada Lovelace",
      }).pipe(Effect.provideService(CurrentAlignmentSource, sourceOf("Ada Lovelace wrote notes.")));

      expect(grounded.alignmentStatus).toBe("match_exact");
      expect(grounded.span?.start).toBe(0);
      expect(grounded.span?.end).toBe(12);
      expect(grounded.matchedText).toBe("Ada Lovelace");
    })
  );

  it.effect(
    "grounds unmatched candidates as unaligned instead of failing",
    Effect.fnUntraced(function* () {
      const grounded = yield* S.decodeEffect(GroundedExtractionFromCandidate)({
        label: "place",
        text: "Paris",
      }).pipe(Effect.provideService(CurrentAlignmentSource, sourceOf("Ada Lovelace wrote notes.")));

      expect(grounded.alignmentStatus).toBe("unaligned");
      expect(grounded.span).toBeUndefined();
    })
  );

  it.effect(
    "encodes a grounded extraction back to its validated candidate",
    Effect.fnUntraced(function* () {
      const grounded = yield* S.decodeEffect(GroundedExtractionFromCandidate)({
        label: "person",
        text: "Ada Lovelace",
      }).pipe(Effect.provideService(CurrentAlignmentSource, sourceOf("Ada Lovelace wrote notes.")));
      const candidate = yield* S.encodeEffect(GroundedExtractionFromCandidate)(grounded);

      expect(candidate.label).toBe("person");
      expect(candidate.text).toBe("Ada Lovelace");
    })
  );
});

describe("GroundedExtractionsFromCandidates", () => {
  it.effect(
    "grounds a batch and honors the resolved extraction cap",
    Effect.fnUntraced(function* () {
      const grounded = yield* S.decodeEffect(GroundedExtractionsFromCandidates)([
        { label: "person", text: "Ada Lovelace" },
        { label: "topic", text: "notes" },
      ]).pipe(
        Effect.provideService(
          CurrentAlignmentSource,
          AlignmentSource.make({
            maxExtractions: O.some(NonNegativeInt.make(1)),
            sourceText: "Ada Lovelace wrote notes.",
          })
        )
      );

      expect(grounded.length).toBe(1);
      expect(grounded[0]?.alignmentStatus).toBe("match_exact");
    })
  );
});
