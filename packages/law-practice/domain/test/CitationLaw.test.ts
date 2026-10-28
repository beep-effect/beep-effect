import {
  Citation,
  CitationEditionRef,
  CitationLawComponents,
  CitationLawPublication,
  FullCitation,
  FullLawCitation,
} from "@beep/law-practice-domain/values";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

// Edition identities are the frozen public vocabulary mapping's immutable
// law-publication artifacts, not case ReporterIds. Source/field audit is in
// goals/citation-extraction-engine/history/evidence/2026-10-28-law-schema.md.
const cfr = CitationEditionRef.make("b6293de3e161f1a649d897f5d5a099841074c14ebeee8e2996e7d2c172eefe4c");
const usc = CitationEditionRef.make("e6528d7da54cc9b358e645efb285f19fe9da550ed25322acf0312fafd9c7860f");
const cfrWire = {
  type: "law",
  components: { chapter: "37", reporter: "C.F.R.", section: "1.56" },
  publication: { editions: [cfr], selectedEdition: cfr },
  metadata: { pinCite: "(a)", publisher: "West", year: "2020", month: "Jan.", day: "2", parenthetical: "disclosure" },
} as const;
const uscWire = {
  type: "law",
  components: { title: "35", reporter: "U.S.C.", section: "101" },
  publication: { editions: [usc], selectedEdition: usc },
  metadata: { pinCite: null, publisher: null, year: "2018", month: null, day: null, parenthetical: null },
} as const;

describe("canonical full law semantic schema", () => {
  it.effect("preserves canonical CFR chapter, USC title and textual metadata in the existing unions", () =>
    Effect.gen(function* () {
      const regulation = yield* S.decodeEffect(FullLawCitation)(cfrWire);
      const statute = yield* S.decodeEffect(FullLawCitation)(uscWire);
      expect(regulation.components.chapter).toEqual(O.some("37"));
      expect(R.has(regulation.components, "title")).toBe(false);
      expect(statute.components.title).toEqual(O.some("35"));
      expect(R.has(statute.components, "chapter")).toBe(false);
      expect(regulation.metadata.day).toEqual(O.some("2"));
      expect(regulation.metadata.year).toEqual(O.some("2020"));
      for (const [wire, value] of [
        [cfrWire, regulation],
        [uscWire, statute],
      ] as const) {
        expect(yield* S.encodeEffect(FullLawCitation)(value)).toEqual(wire);
        expect(yield* S.encodeEffect(Citation)(yield* S.decodeEffect(Citation)(wire))).toEqual(wire);
        expect(yield* S.encodeEffect(FullCitation)(yield* S.decodeEffect(FullCitation)(wire))).toEqual(wire);
      }
    })
  );

  it.effect("retains arbitrary legal group names and explicit null versus absent components", () =>
    Effect.gen(function* () {
      const components = yield* S.decodeEffect(CitationLawComponents)({
        page: null,
        custom_section: "§ 2-A",
        title: "0035",
      });
      expect(components.page).toEqual(O.none());
      expect(R.has(components, "chapter")).toBe(false);
      expect(components.title).toEqual(O.some("0035"));
      expect(yield* S.encodeEffect(CitationLawComponents)(components)).toEqual({
        page: null,
        custom_section: "§ 2-A",
        title: "0035",
      });
      expect(Result.isFailure(S.decodeUnknownResult(CitationLawComponents)({ title: 35 }))).toBe(true);
    })
  );

  it.effect("keeps unknown and ambiguous publication identities as data and checks selected membership", () =>
    Effect.gen(function* () {
      const unknown = yield* S.decodeEffect(CitationLawPublication)({ editions: [], selectedEdition: null });
      const ambiguous = yield* S.decodeEffect(CitationLawPublication)({
        editions: [cfr, usc, cfr],
        selectedEdition: null,
      });
      expect(unknown.selectedEdition).toEqual(O.none());
      expect(ambiguous.editions).toEqual([cfr, usc, cfr]);
      expect(Result.isFailure(S.decodeResult(CitationLawPublication)({ editions: [cfr], selectedEdition: usc }))).toBe(
        true
      );
      expect(Result.isFailure(S.decodeResult(CitationLawPublication)({ editions: [], selectedEdition: cfr }))).toBe(
        true
      );
    })
  );

  it.effect("rejects retired donor shapes and keeps occurrence or telemetry fields out of the encoded model", () =>
    Effect.gen(function* () {
      for (const type of ["statute", "regulation"]) {
        expect(Result.isFailure(S.decodeUnknownResult(Citation)({ ...cfrWire, type }))).toBe(true);
      }
      const semantic = yield* S.decodeUnknownEffect(FullLawCitation)({
        ...cfrWire,
        span: { start: 0, end: 8 },
        confidence: 0.5,
        processTimeMs: 10,
      });
      const encoded = yield* S.encodeEffect(FullLawCitation)(semantic);
      expect(encoded).toEqual(cfrWire);
    })
  );

  it.effect.prop(
    "round-trips schema-generated semantic law values with schema-derived equivalence",
    { law: Arbitrary.schema(FullLawCitation) },
    ({ law }) =>
      Effect.gen(function* () {
        const wire = yield* S.encodeEffect(FullLawCitation)(law);
        const restored = yield* S.decodeEffect(FullLawCitation)(wire);
        expect(S.toEquivalence(FullLawCitation)(law, restored)).toBe(true);
      }),
    { arbitrary: fcRuns(20) }
  );
});
