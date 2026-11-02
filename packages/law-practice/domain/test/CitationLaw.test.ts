import {
  Citation,
  CitationComponents,
  CitationEditionRef,
  CitationPublication,
  FullCitation,
  FullLawCitation,
} from "@beep/law-practice-domain/values";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
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
      assertSome(O.fromUndefinedOr(regulation.components.chapter).pipe(O.getOrThrow), "37");
      expect(R.has(regulation.components, "title")).toBe(false);
      assertSome(O.fromUndefinedOr(statute.components.title).pipe(O.getOrThrow), "35");
      expect(R.has(statute.components, "chapter")).toBe(false);
      assertSome(regulation.metadata.day, "2");
      assertSome(regulation.metadata.year, "2020");
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
      const components = yield* S.decodeEffect(CitationComponents)({
        page: null,
        custom_section: "§ 2-A",
        title: "0035",
      });
      O.fromUndefinedOr(components.page).pipe(O.getOrThrow, assertNone);
      expect(R.has(components, "chapter")).toBe(false);
      assertSome(O.fromUndefinedOr(components.title).pipe(O.getOrThrow), "0035");
      expect(yield* S.encodeEffect(CitationComponents)(components)).toEqual({
        page: null,
        custom_section: "§ 2-A",
        title: "0035",
      });
      S.decodeUnknownResult(CitationComponents)({ title: 35 }).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("preserves unknown, ambiguous and independently retained selected publication identities", () =>
    Effect.gen(function* () {
      const unknown = yield* S.decodeEffect(CitationPublication)({ editions: [], selectedEdition: null });
      const ambiguous = yield* S.decodeEffect(CitationPublication)({
        editions: [cfr, usc, cfr],
        selectedEdition: null,
      });
      assertNone(unknown.selectedEdition);
      expect(ambiguous.editions).toEqual([cfr, usc, cfr]);
      const retained = yield* S.decodeEffect(CitationPublication)({ editions: [cfr], selectedEdition: usc });
      expect(yield* S.encodeEffect(CitationPublication)(retained)).toEqual({ editions: [cfr], selectedEdition: usc });
      const cleared = yield* S.decodeEffect(CitationPublication)({ editions: [], selectedEdition: cfr });
      expect(yield* S.encodeEffect(CitationPublication)(cleared)).toEqual({ editions: [], selectedEdition: cfr });
    })
  );

  it.effect("rejects retired donor shapes and keeps occurrence or telemetry fields out of the encoded model", () =>
    Effect.gen(function* () {
      for (const type of ["statute", "regulation"]) {
        S.decodeUnknownResult(Citation)({ ...cfrWire, type }).pipe(Result.isFailure, assertTrue);
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
