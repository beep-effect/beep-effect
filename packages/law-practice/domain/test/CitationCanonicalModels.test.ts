import {
  Citation,
  CitationCasePublication,
  CitationCourt,
  CitationKnownCourt,
  CitationUnmappedCourt,
  FullCaseCitation,
  FullCitation,
  FullJournalCitation,
  IdCitation,
  ReferenceCitation,
  ShortFormCaseCitation,
  ShortFormCitation,
  SupraCitation,
  UnknownCitation,
} from "@beep/law-practice-domain/values";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const vocabularyVersion = "crv1:f353e51400a5:fad63b383b92";
const publication = { vocabularyVersion, editions: [], selectedEdition: null };
const locator = { pinCite: null, parenthetical: null };
const dated = { ...locator, year: null, month: null, day: null };
const caseMetadata = { ...dated, court: null };
const fullMetadata = {
  ...caseMetadata,
  plaintiff: "Smith",
  defendant: "Jones",
  additionalText: null,
  antecedentGuess: null,
  shortCaseName: null,
  caseName: null,
};
const fullWire = {
  type: "case",
  components: { volume: "410", reporter: "U.S.", page: "113" },
  publication,
  metadata: fullMetadata,
} as const;

describe("canonical semantic citation models", () => {
  it.effect("round-trips case legal components and metadata without numeric coercion or occurrence state", () =>
    Effect.gen(function* () {
      const citation = yield* S.decodeEffect(FullCaseCitation)(fullWire);
      assertSome(O.fromUndefinedOr(citation.components.volume).pipe(O.getOrThrow), "410");
      assertSome(citation.metadata.plaintiff, "Smith");
      const citationResult8 = yield* S.encodeEffect(FullCaseCitation)(citation);
      expect(citationResult8).toEqual(fullWire);
      const transformInput: FullCitation.Type = citation;
      const citationResult10 = yield* S.encodeEffect(FullCitation)(transformInput);
      expect(citationResult10).toEqual(fullWire);
      const wire = {
        ...fullWire,
        components: { ...fullWire.components, volume: "0410", page: null },
        metadata: { ...fullMetadata, year: "0999", additionalText: ", 20 F.2d 1" },
      };
      const decoded = yield* S.decodeEffect(FullCaseCitation)(wire);
      O.fromUndefinedOr(decoded.components.page).pipe(O.getOrThrow, assertNone);
      assertSome(decoded.metadata.year, "0999");
      const citationResult6 = yield* S.encodeEffect(FullCaseCitation)(decoded);
      expect(citationResult6).toEqual(wire);
    })
  );

  it.effect("keeps known court identity/version and unmapped court metadata distinct", () =>
    Effect.gen(function* () {
      const known = yield* S.decodeEffect(CitationKnownCourt)({ status: "known", id: "scotus", vocabularyVersion });
      const unmapped = CitationUnmappedCourt.make({ value: "" });
      expect(CitationCourt.guards.known(known)).toBe(true);
      expect(CitationCourt.guards.unmapped(unmapped)).toBe(true);
      const wire = { ...fullWire, metadata: { ...fullMetadata, court: { status: "unmapped", value: "" } } } as const;
      const value = yield* S.decodeEffect(FullCaseCitation)(wire);
      const citationResult3 = yield* S.encodeEffect(FullCaseCitation)(value);
      expect(citationResult3).toEqual(wire);
      S.decodeResult(CitationKnownCourt)({ status: "known", id: "", vocabularyVersion }).pipe(
        Result.isFailure,
        assertTrue
      );
    })
  );

  it.effect("retains historical edition distinctions when public reporter identities coincide", () =>
    Effect.gen(function* () {
      // Format-only identities exercise independent candidate/selection state.
      // Engine artifact resolution and the exact CIT mapping remain separate.
      const first = "0000000000000000000000000000000000000000000000000000000000000000";
      const second = "1111111111111111111111111111111111111111111111111111111111111111";
      const candidates = {
        vocabularyVersion,
        editions: [
          { edition: first, reporterId: "reporter:same" },
          { edition: second, reporterId: "reporter:same" },
        ],
        selectedEdition: second,
      };
      const value = yield* S.decodeEffect(CitationCasePublication)(candidates);
      expect(value.editions).toHaveLength(2);
      const citationResult15 = yield* S.encodeEffect(CitationCasePublication)(value);
      expect(citationResult15).toEqual(candidates);
      const retained = yield* S.decodeEffect(CitationCasePublication)({ ...candidates, editions: [] });
      const citationResult20 = yield* S.encodeEffect(CitationCasePublication)(retained);
      expect(citationResult20).toEqual({ ...candidates, editions: [] });
    })
  );

  it.effect("represents short case, Id, supra, named reference and unknown as nonrecursive semantic values", () =>
    Effect.gen(function* () {
      const shortWire = {
        type: "shortFormCase",
        components: { volume: "515", reporter: "U.S.", page: "241" },
        publication,
        metadata: { ...caseMetadata, antecedentGuess: "Adarand", pinCite: "241" },
      } as const;
      const idWire = { type: "id", components: {}, metadata: { ...locator, pinCite: "at 240" } } as const;
      const supraWire = {
        type: "supra",
        components: {},
        metadata: { ...locator, volume: "515", antecedentGuess: "Adarand", pinCite: "240" },
      } as const;
      const referenceWire = {
        type: "reference",
        components: {},
        metadata: {
          ...locator,
          plaintiff: "Roe",
          defendant: null,
          shortCaseName: null,
          caseName: null,
        },
      } as const;
      const unknownWire = { type: "unknown", components: {}, metadata: locator } as const;
      const citationResult17 = yield* S.decodeEffect(ShortFormCaseCitation)(shortWire);
      const citationResult23 = yield* S.encodeEffect(ShortFormCaseCitation)(citationResult17);
      expect(citationResult23).toEqual(shortWire);
      const citationResult2 = yield* S.decodeEffect(IdCitation)(idWire);
      const citationResult9 = yield* S.encodeEffect(IdCitation)(citationResult2);
      expect(citationResult9).toEqual(idWire);
      const citationResult5 = yield* S.decodeEffect(SupraCitation)(supraWire);
      const citationResult16 = yield* S.encodeEffect(SupraCitation)(citationResult5);
      expect(citationResult16).toEqual(supraWire);
      const citationResult18 = yield* S.decodeEffect(ReferenceCitation)(referenceWire);
      const citationResult22 = yield* S.encodeEffect(ReferenceCitation)(citationResult18);
      expect(citationResult22).toEqual(referenceWire);
      const citationResult11 = yield* S.decodeEffect(UnknownCitation)(unknownWire);
      const citationResult21 = yield* S.encodeEffect(UnknownCitation)(citationResult11);
      expect(citationResult21).toEqual(unknownWire);
      for (const wire of [shortWire, idWire, supraWire, referenceWire, unknownWire]) {
        const citationResult1 = yield* S.decodeEffect(Citation)(wire);
        const citationResult7 = yield* S.encodeEffect(Citation)(citationResult1);
        expect(citationResult7).toEqual(wire);
      }
      const citationResult12 = yield* S.decodeEffect(UnknownCitation)(unknownWire);
      expect(S.is(FullCitation)(citationResult12)).toBe(false);
      const citationResult13 = yield* S.decodeEffect(UnknownCitation)(unknownWire);
      expect(S.is(ShortFormCitation)(citationResult13)).toBe(false);
      const citationResult19 = yield* S.decodeEffect(ReferenceCitation)(referenceWire);
      expect(S.is(ShortFormCitation)(citationResult19)).toBe(true);
    })
  );

  it.effect("retains journal locator/date semantics without donor author/title promises", () =>
    Effect.gen(function* () {
      const wire = {
        type: "journal",
        components: { volume: "93", reporter: "Harv. L. Rev.", page: "518" },
        publication: { editions: [], selectedEdition: null },
        metadata: { ...dated, year: "1980", pinCite: "520" },
      } as const;
      const journal = yield* S.decodeEffect(FullJournalCitation)(wire);
      const citationResult14 = yield* S.encodeEffect(FullJournalCitation)(journal);
      expect(citationResult14).toEqual(wire);
      expect(S.is(FullCitation)(journal)).toBe(true);
    })
  );

  it.effect("does not encode inherited telemetry, recursive citations or the retired formatter", () =>
    Effect.gen(function* () {
      const value = yield* S.decodeUnknownEffect(FullCaseCitation)({
        ...fullWire,
        text: "410 U.S. 113",
        span: { start: 0, end: 12 },
        confidence: 1,
        parentheticals: [{ text: "quoting other case", citations: [fullWire] }],
      });
      const citationResult4 = yield* S.encodeEffect(FullCaseCitation)(value);
      expect(citationResult4).toEqual(fullWire);
      const formatterIsRemoved: "toBlueBook" extends keyof typeof FullCaseCitation ? false : true = true;
      expect(formatterIsRemoved).toBe(true);
    })
  );

  // Generate each family independently so codec failures identify the family.
  // Candidate/selection independence is also covered by the focused test above.
  for (const [name, schema] of [
    ["full case", FullCaseCitation],
    ["short case", ShortFormCaseCitation],
    ["Id", IdCitation],
    ["supra", SupraCitation],
    ["named reference", ReferenceCitation],
    ["unknown", UnknownCitation],
    ["journal", FullJournalCitation],
  ] as const) {
    it.effect.prop(
      `round-trips schema-generated ${name} semantics`,
      { citation: Arbitrary.schema(schema) },
      ({ citation }) =>
        Effect.gen(function* () {
          const wire = yield* S.encodeEffect(Citation)(citation);
          const decoded = yield* S.decodeEffect(Citation)(wire);
          expect(S.is(schema)(decoded)).toBe(true);
          expect(S.toEquivalence(Citation)(citation, decoded)).toBe(true);
        }),
      { arbitrary: fcRuns(10) }
    );
  }
});
