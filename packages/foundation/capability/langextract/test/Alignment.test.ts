import {
  AlignedMatchFromMatchedText,
  AlignmentSource,
  alignCandidate,
  alignCandidates,
  CurrentAlignmentSource,
  DEFAULT_MAX_EXTRACTIONS,
  GroundedExtractionFromCandidate,
  GroundedExtractionsFromCandidates,
  MAX_MINIMAL_FOLD_TRANSITIONS,
  MatchedTextFromScored,
  SpanFromMatch,
  spanFromMatch,
} from "@beep/langextract/Alignment";
import { ExtractionCandidate, GroundedExtraction, LangExtractOptions } from "@beep/langextract/Extraction";
import { Contract, UnitInterval } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const ExtractionCandidateArbitrary = S.toArbitrary(ExtractionCandidate)(fc);

const sourceOf = (sourceText: string) => AlignmentSource.make({ sourceText });

describe("alignCandidate", () => {
  it("constructs alignment sources through the data-last options form", () => {
    const source = AlignmentSource.fromOptions(
      LangExtractOptions.make({ maxExtractions: O.some(NonNegativeInt.make(3)) })
    )("Ada Lovelace");

    expect(source.maxExtractions).toBe(3);
  });

  it("finds exact source matches", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "person", text: "Alice" }),
      sourceOf("Alice founded Acme.")
    );

    expect(extraction).toMatchObject({
      alignmentStatus: "match_exact",
      span: { end: 5, start: 0 },
    });
  });

  it("leaves repeated exact candidate text unaligned", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "person", text: "Ada" }),
      sourceOf("Ada wrote notes. Ada praised Engine.")
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
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

    expect(extraction).toMatchObject({ alignmentStatus: "match_lesser", matchedText: "Acme" });
  });

  it("leaves repeated case-insensitive candidate text unaligned", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "person", text: "ada" }),
      sourceOf("Ada wrote notes. ADA praised Engine.")
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
  });

  it("keeps lesser match spans anchored to source offsets after Unicode lowercase expansion", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "person", text: "alice" }),
      sourceOf("Aİ Alice founded Acme.")
    );

    expect(extraction).toMatchObject({
      alignmentStatus: "match_lesser",
      matchedText: "Alice",
      span: { end: 8, start: 3 },
    });
  });

  it("matches decomposed source text when the query lowercases to more code units", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "person", text: "İ" }),
      sourceOf("i̇ founded Acme.")
    );

    expect(extraction).toMatchObject({
      alignmentStatus: "match_lesser",
      matchedText: "i̇",
      span: { end: 2, start: 0 },
    });
  });

  it("collapses whitespace while retaining the raw canonical source slice", () => {
    const sourceText = "Alpha \r\n\t beta supports Gamma.";
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "alpha beta supports gamma." }),
      sourceOf(sourceText)
    );

    expect(extraction).toMatchObject({
      alignmentStatus: "match_minimal_fold",
      matchedText: sourceText,
      span: { end: Str.length(sourceText), start: 0 },
    });
  });

  it("drops an end-of-line hyphen for a split word", () => {
    const sourceText = "probabil-\n  istic predictions";
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "probabilistic predictions" }),
      sourceOf(sourceText)
    );

    expect(extraction).toMatchObject({
      alignmentStatus: "match_minimal_fold",
      matchedText: sourceText,
      span: { end: Str.length(sourceText), start: 0 },
    });
  });

  it("keeps an end-of-line hyphen for a compound", () => {
    const sourceText = "evidence-\r\nquote contract";
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "evidence-quote contract" }),
      sourceOf(sourceText)
    );

    expect(extraction).toMatchObject({
      alignmentStatus: "match_minimal_fold",
      matchedText: sourceText,
      span: { end: Str.length(sourceText), start: 0 },
    });
  });

  it("interprets each end-of-line hyphen independently", () => {
    const sourceText = "probabil-\nistic evidence-\nbased";
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "probabilistic evidence-based" }),
      sourceOf(sourceText)
    );

    expect(extraction).toMatchObject({
      alignmentStatus: "match_minimal_fold",
      matchedText: sourceText,
      span: { end: Str.length(sourceText), start: 0 },
    });
  });

  it("interprets each candidate end-of-line hyphen independently", () => {
    const sourceText = "probabilistic evidence-based";
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "probabil-\nistic evidence-\nbased" }),
      sourceOf(sourceText)
    );

    expect(extraction).toMatchObject({
      alignmentStatus: "match_minimal_fold",
      matchedText: sourceText,
      span: { end: Str.length(sourceText), start: 0 },
    });
  });

  it("retains a hyphen when dropping every candidate segment would be empty", () => {
    const extraction = alignCandidate(ExtractionCandidate.make({ label: "relation", text: "-\n" }), sourceOf("-"));

    expect(extraction).toMatchObject({
      alignmentStatus: "match_minimal_fold",
      matchedText: "-",
      span: { end: 1, start: 0 },
    });
  });

  it("fails closed when a trailing optional candidate segment yields two source spans", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "alpha-\n" }),
      sourceOf("alpha-\n")
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
  });

  it("fails closed when the two end-of-line-hyphen variants locate different source slices", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "well-\nbeing" }),
      sourceOf("wellbeing differs from well-being")
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
  });

  it("fails closed when a folded query occurs more than once", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "probabilistic" }),
      sourceOf("probabil-\nistic differs from probabil-\r\nistic")
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
  });

  it("fails closed when an exact occurrence has a second fold-equivalent occurrence", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "Alpha beta" }),
      sourceOf("Alpha beta differs from Alpha\n beta")
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
  });

  it("fails closed when a lesser occurrence has a second fold-equivalent occurrence", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "alpha beta" }),
      sourceOf("Alpha beta differs from Alpha\n beta")
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
  });

  it("rejects the former repeated-hyphen backtracking case deterministically", () => {
    const repeatedHyphens = Str.repeat(12)("-\n");
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: `a${repeatedHyphens}b` }),
      AlignmentSource.make({ fuzzyThreshold: UnitInterval.make(1), sourceText: `a${repeatedHyphens}c` })
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
  });

  it("shares the minimal-fold transition ceiling across a batch and suppresses fuzzy fallback", () => {
    expect(MAX_MINIMAL_FOLD_TRANSITIONS).toBe(1_000_000);
    const repeatedHyphens = Str.repeat(1_050)("-\n");
    const aligned = alignCandidates(
      [
        ExtractionCandidate.make({ label: "relation", text: `a${repeatedHyphens}b` }),
        ExtractionCandidate.make({ label: "relation", text: "target" }),
      ],
      AlignmentSource.make({
        fuzzyThreshold: UnitInterval.make(0),
        sourceText: `a${repeatedHyphens}c target`,
      })
    );

    expect(A.map(aligned, ({ alignmentStatus }) => alignmentStatus)).toStrictEqual(["unaligned", "unaligned"]);
  });

  it("uses bounded fuzzy matching", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "organization", text: "Acmee" }),
      AlignmentSource.make({ fuzzyThreshold: UnitInterval.make(0.75), sourceText: "Alice founded Acme." })
    );

    expect(extraction).toMatchObject({ alignmentStatus: "match_fuzzy", matchedText: "Acme." });
  });

  it("retains the earlier fuzzy window when a later candidate does not score higher", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "relation", text: "Alpha beta" }),
      AlignmentSource.make({
        fuzzyThreshold: UnitInterval.make(0.7),
        sourceText: "Alpha betta. Alpha betu.",
      })
    );

    expect(extraction).toMatchObject({ alignmentStatus: "match_fuzzy", matchedText: "Alpha betta." });
  });

  it("skips fuzzy work when the caller requests exact similarity", () => {
    const extraction = alignCandidate(
      ExtractionCandidate.make({ label: "organization", text: "Acmee" }),
      AlignmentSource.make({ fuzzyThreshold: UnitInterval.make(1), sourceText: "Alice founded Acme." })
    );

    expect(extraction.alignmentStatus).toBe("unaligned");
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
    expect(GroundedExtraction.guards.unaligned(extraction)).toBe(true);
  });

  it("keeps schema-derived aligned spans inside the source text", () =>
    fc.assert(
      fc.property(ExtractionCandidateArbitrary, fc.string(), fc.string(), (candidate, prefix, suffix) => {
        const sourceText = `${prefix}${candidate.text}${suffix}`;
        const extraction = alignCandidate(candidate, sourceOf(sourceText));

        if (
          GroundedExtraction.isAnyOf(["match_exact", "match_lesser", "match_minimal_fold", "match_fuzzy"])(extraction)
        ) {
          expect(extraction.span.start).toBeGreaterThanOrEqual(0);
          expect(extraction.span.end).toBeLessThanOrEqual(Str.length(sourceText));
          expect(extraction.matchedText).toBe(Str.slice(extraction.span.start, extraction.span.end)(sourceText));
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
              maxExtractions: NonNegativeInt.make(maxExtractions),
              sourceText: "",
            })
          );

          expect(A.length(aligned)).toBeLessThanOrEqual(maxExtractions);
          expect(A.length(aligned)).toBeLessThanOrEqual(A.length(candidates));
        }
      ),
      fcRuns(50)
    ));

  it("returns an empty batch when the resolved extraction cap is zero", () => {
    const aligned = alignCandidates(
      [ExtractionCandidate.make({ label: "person", text: "Ada" })],
      AlignmentSource.make({ maxExtractions: NonNegativeInt.make(0), sourceText: "Ada" })
    );

    expect(aligned).toEqual([]);
  });

  it("resolves the default extraction cap and supports data-last batch alignment", () => {
    const candidates = A.makeBy(Num.increment(DEFAULT_MAX_EXTRACTIONS), () =>
      ExtractionCandidate.make({ label: "place", text: "Paris" })
    );
    const aligned = alignCandidates(sourceOf(""))(candidates);

    expect(A.length(aligned)).toBe(DEFAULT_MAX_EXTRACTIONS);
  });
});

describe("SpanFromMatch", () => {
  it.effect("decodes a matched slice into a half-open span", () =>
    Effect.gen(function* () {
      const span = yield* S.decodeEffect(SpanFromMatch)([4, "Lovelace"]);

      expect(span.start).toBe(4);
      expect(span.end).toBe(12);
      expect(span).toStrictEqual(spanFromMatch([NonNegativeInt.make(4), "Lovelace"]));
    })
  );

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
  it.effect("drops the similarity score on decode", () =>
    Effect.gen(function* () {
      expect(yield* S.decodeEffect(MatchedTextFromScored)([0, "Acme.", 0.8])).toStrictEqual([0, "Acme."]);
    })
  );

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
  it.effect("tags and untags a matched slice", () =>
    Effect.gen(function* () {
      const ExactMatch = AlignedMatchFromMatchedText("match_exact");
      const aligned = yield* S.decodeEffect(ExactMatch)([0, "Ada"]);

      expect(aligned).toStrictEqual(["match_exact", 0, "Ada"]);
      expect(yield* S.encodeEffect(ExactMatch)(aligned)).toStrictEqual([0, "Ada"]);
    })
  );
});

describe("GroundedExtractionFromCandidate", () => {
  it.effect(
    "grounds a candidate against the current alignment source",
    Effect.fnUntraced(function* () {
      const grounded = yield* S.decodeEffect(GroundedExtractionFromCandidate)({
        label: "person",
        text: "Ada Lovelace",
      }).pipe(Effect.provideService(CurrentAlignmentSource, sourceOf("Ada Lovelace wrote notes.")));

      expect(grounded).toMatchObject({
        alignmentStatus: "match_exact",
        matchedText: "Ada Lovelace",
        span: { end: 12, start: 0 },
      });
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
      expect(GroundedExtraction.guards.unaligned(grounded)).toBe(true);
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
            maxExtractions: NonNegativeInt.make(1),
            sourceText: "Ada Lovelace wrote notes.",
          })
        )
      );

      expect(A.length(grounded)).toBe(1);
      expect(O.map(A.head(grounded), (extraction) => extraction.alignmentStatus)).toEqual(O.some("match_exact"));
    })
  );
});
