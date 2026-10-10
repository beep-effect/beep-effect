import {
  DocketingVocabulary,
  LegalRoleVocabulary,
  PartyKindVocabulary,
  VocabularyConcept,
  VocabularyError,
  VocabularyFailureReason,
  VocabularyPin,
  VocabularyRegistry,
  VocabularySchemeKind,
  VocabularySeed,
} from "@beep/ontology";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const seeds = [DocketingVocabulary, PartyKindVocabulary, LegalRoleVocabulary];
const context = {
  skos: "http://www.w3.org/2004/02/skos/core#",
  dct: "http://purl.org/dc/terms/",
  owl: "http://www.w3.org/2002/07/owl#",
};
const quote = S.encodeEffect(S.fromJsonString(S.String));
const read = (path: string) => Effect.tryPromise(() => Bun.file(path).text()).pipe(Effect.orDie);
const graph = (seed: VocabularySeed) => [
  { "@id": seed.schemeIri, "@type": "skos:ConceptScheme", "dct:title": seed.title, "owl:versionInfo": seed.version },
  ...A.map(seed.concepts, (c) => ({
    "@id": c.iri,
    "@type": "skos:Concept",
    "skos:inScheme": { "@id": seed.schemeIri },
    "skos:notation": c.notation,
    "skos:prefLabel": c.prefLabel,
    "skos:definition": c.definition,
    "skos:broader": A.map(c.broader, (iri) => ({ "@id": iri })),
    "dct:source": { "@id": c.sourceIri },
    "skos:scopeNote": c.sourceNote,
  })),
];
const ttl = Effect.fnUntraced(function* (schemes: ReadonlyArray<VocabularySeed>) {
  let text =
    "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .\n@prefix dct: <http://purl.org/dc/terms/> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n\n";
  for (const seed of schemes) {
    text += `<${seed.schemeIri}> a skos:ConceptScheme ;\n  dct:title ${yield* quote(seed.title)} ;\n  owl:versionInfo ${yield* quote(seed.version)} .\n\n`;
    for (const c of seed.concepts) {
      text += `<${c.iri}> a skos:Concept ;\n  skos:inScheme <${seed.schemeIri}> ;\n  skos:notation ${yield* quote(c.notation)} ;\n  skos:prefLabel ${yield* quote(c.prefLabel)} ;\n  skos:definition ${yield* quote(c.definition)} ;\n  ${A.join(
        A.map(c.broader, (iri) => `skos:broader <${iri}> ;\n  `),
        ""
      )}dct:source <${c.sourceIri}> ;\n  skos:scopeNote ${yield* quote(c.sourceNote)} .\n\n`;
    }
  }
  return text;
});
const CompetencyFixture = S.Struct({
  cq: S.Finite,
  kind: VocabularySchemeKind,
  version: S.String,
  notation: S.String,
  expectedIri: S.String,
});
const isVocabularyError = S.is(VocabularyError);

it.layer(VocabularyRegistry.layer, { timeout: "30 seconds" })("pinned M3 vocabularies", (it) => {
  for (const [file, selected] of [
    ["docketing", [DocketingVocabulary]],
    ["party-roles", [PartyKindVocabulary, LegalRoleVocabulary]],
  ] as const) {
    it.effect(
      `keeps ${file} TTL, JSON-LD and TS seeds identical`,
      Effect.fnUntraced(function* () {
        const json = yield* read(`src/seed/${file}.jsonld`).pipe(
          Effect.flatMap(S.decodeEffect(S.fromJsonString(S.Unknown)))
        );
        expect(json).toEqual({ "@context": context, "@graph": A.flatMap(selected, graph) });
        expect(yield* read(`src/seed/${file}.ttl`)).toBe(yield* ttl(selected));
      })
    );
  }
  it.effect(
    "loads every explicit scheme version and resolves every notation",
    Effect.fnUntraced(function* () {
      const registry = yield* VocabularyRegistry;
      for (const seed of seeds) {
        expect(yield* registry.load({ kind: seed.kind, version: seed.version })).toEqual(seed);
        expect(seed.version).toBe("1.0.0");
        const own = HashSet.fromIterable(A.map(seed.concepts, (c) => c.iri));
        for (const concept of seed.concepts) {
          expect(yield* registry.resolve({ kind: seed.kind, version: seed.version }, concept.notation)).toEqual(
            concept
          );
          expect(Str.startsWith("https://ns.beep.sh/")(concept.iri)).toBe(true);
          expect(Str.startsWith("https://ns.beep.sh/")(seed.schemeIri)).toBe(true);
          expect(A.every(concept.broader, (iri) => HashSet.has(own, iri))).toBe(true);
          expect(concept.alignments).toEqual([]);
          expect(S.is(VocabularyConcept)(concept)).toBe(true);
        }
        expect(S.is(VocabularySeed)(seed)).toBe(true);
      }
      expect(VocabularySchemeKind.literals).toEqual(["docketing", "party-kinds", "legal-roles"]);
      expect(VocabularyFailureReason.literals).toEqual(["invalid-pin", "version-unpinned", "concept-not-found"]);
    })
  );
  it.effect(
    "keeps party kinds and role concepts separate without identity folding",
    Effect.fnUntraced(function* () {
      const party = HashSet.fromIterable(A.map(PartyKindVocabulary.concepts, (c) => c.iri));
      expect(
        A.every(LegalRoleVocabulary.concepts, (c) => !HashSet.has(party, c.iri) && A.isReadonlyArrayEmpty(c.broader))
      ).toBe(true);
      expect(LegalRoleVocabulary.concepts).toHaveLength(11);
      expect(PartyKindVocabulary.concepts).toHaveLength(6);
      expect(DocketingVocabulary.concepts).toHaveLength(25);
      const section15 = yield* VocabularyRegistry.use((r) =>
        r.resolve({ kind: "docketing", version: "1.0.0" }, "Section15DeclarationDeadline")
      );
      expect(section15.definition).toContain("elective");
      const open = yield* VocabularyRegistry.use((r) =>
        r.resolve({ kind: "docketing", version: "1.0.0" }, "OpenDeadlineState")
      );
      expect(open.definition).toContain("elective");
    })
  );
  it.effect(
    "fails closed for unavailable versions, absent concepts and missing pins",
    Effect.fnUntraced(function* () {
      const r = yield* VocabularyRegistry;
      const version = yield* r.load({ kind: "docketing", version: "latest" }).pipe(Effect.flip);
      expect(isVocabularyError(version)).toBe(true);
      expect(version.reason).toBe("version-unpinned");
      const missing = yield* r.resolve({ kind: "party-kinds", version: "1.0.0" }, "OwnerRole").pipe(Effect.flip);
      expect(missing.reason).toBe("concept-not-found");
      const invalid = yield* r.load({ kind: "docketing", version: "" }).pipe(Effect.flip);
      expect(invalid.reason).toBe("invalid-pin");
    })
  );
  it.effect(
    "replays CQ 1, 5, 7, 8 and 18 fixtures to stable concept IRIs",
    Effect.fnUntraced(function* () {
      const fixtures = yield* read("test/fixtures/vocabulary-competency.json").pipe(
        Effect.flatMap(S.decodeEffect(S.fromJsonString(S.Array(CompetencyFixture))))
      );
      const r = yield* VocabularyRegistry;
      expect(A.dedupe(A.map(fixtures, (f) => f.cq))).toEqual([1, 5, 7, 8, 18]);
      for (const fixture of fixtures)
        expect((yield* r.resolve(fixture, fixture.notation)).iri).toBe(fixture.expectedIri);
    })
  );
  it.effect.prop(
    "round-trips schema-derived vocabulary pins",
    [Arbitrary.schema(VocabularyPin)],
    ([pin]) =>
      S.encodeEffect(VocabularyPin)(pin).pipe(
        Effect.flatMap(S.decodeEffect(VocabularyPin)),
        Effect.orDie,
        Effect.map((decoded) => {
          expect(decoded).toEqual(pin);
        })
      ),
    { arbitrary: fcRuns() }
  );
});
