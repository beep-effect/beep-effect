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
      expect(citation.components.volume).toEqual(O.some("410"));
      expect(citation.metadata.plaintiff).toEqual(O.some("Smith"));
      expect(yield* S.encodeEffect(FullCaseCitation)(citation)).toEqual(fullWire);
      const transformInput: FullCitation.Type = citation;
      expect(yield* S.encodeEffect(FullCitation)(transformInput)).toEqual(fullWire);
      const wire = {
        ...fullWire,
        components: { ...fullWire.components, volume: "0410", page: null },
        metadata: { ...fullMetadata, year: "0999", additionalText: ", 20 F.2d 1" },
      };
      const decoded = yield* S.decodeEffect(FullCaseCitation)(wire);
      expect(decoded.components.page).toEqual(O.none());
      expect(decoded.metadata.year).toEqual(O.some("0999"));
      expect(yield* S.encodeEffect(FullCaseCitation)(decoded)).toEqual(wire);
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
      expect(yield* S.encodeEffect(FullCaseCitation)(value)).toEqual(wire);
      expect(Result.isFailure(S.decodeResult(CitationKnownCourt)({ status: "known", id: "", vocabularyVersion }))).toBe(
        true
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
      expect(yield* S.encodeEffect(CitationCasePublication)(value)).toEqual(candidates);
      const retained = yield* S.decodeEffect(CitationCasePublication)({ ...candidates, editions: [] });
      expect(yield* S.encodeEffect(CitationCasePublication)(retained)).toEqual({ ...candidates, editions: [] });
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
      expect(
        yield* S.encodeEffect(ShortFormCaseCitation)(yield* S.decodeEffect(ShortFormCaseCitation)(shortWire))
      ).toEqual(shortWire);
      expect(yield* S.encodeEffect(IdCitation)(yield* S.decodeEffect(IdCitation)(idWire))).toEqual(idWire);
      expect(yield* S.encodeEffect(SupraCitation)(yield* S.decodeEffect(SupraCitation)(supraWire))).toEqual(supraWire);
      expect(yield* S.encodeEffect(ReferenceCitation)(yield* S.decodeEffect(ReferenceCitation)(referenceWire))).toEqual(
        referenceWire
      );
      expect(yield* S.encodeEffect(UnknownCitation)(yield* S.decodeEffect(UnknownCitation)(unknownWire))).toEqual(
        unknownWire
      );
      for (const wire of [shortWire, idWire, supraWire, referenceWire, unknownWire]) {
        expect(yield* S.encodeEffect(Citation)(yield* S.decodeEffect(Citation)(wire))).toEqual(wire);
      }
      expect(S.is(FullCitation)(yield* S.decodeEffect(UnknownCitation)(unknownWire))).toBe(false);
      expect(S.is(ShortFormCitation)(yield* S.decodeEffect(UnknownCitation)(unknownWire))).toBe(false);
      expect(S.is(ShortFormCitation)(yield* S.decodeEffect(ReferenceCitation)(referenceWire))).toBe(true);
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
      expect(yield* S.encodeEffect(FullJournalCitation)(journal)).toEqual(wire);
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
      expect(yield* S.encodeEffect(FullCaseCitation)(value)).toEqual(fullWire);
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
