import { CoreVocab, mergeVocab, SemanticFoundationVocab, VocabRegistry } from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { expectTypeOf } from "vitest";
import type { Curie, Expand, Predicate } from "@beep/identity";

type CoreCurie = Curie<typeof CoreVocab>;
type CorePredicate = Predicate<typeof CoreVocab>;

describe("Vocab literal types", () => {
  it("derives CURIE literals from CoreVocab data", () => {
    expectTypeOf<"skos:prefLabel" extends CoreCurie ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"skos:prefLabl" extends CoreCurie ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<"dcterms:creator" extends CoreCurie ? true : false>().toEqualTypeOf<true>();
  });

  it("expands CURIE literals to exact namespace IRIs", () => {
    expectTypeOf<
      Expand<"skos:prefLabel", typeof CoreVocab>
    >().toEqualTypeOf<"http://www.w3.org/2004/02/skos/core#prefLabel">();
    expectTypeOf<Expand<"dcterms:creator", typeof CoreVocab>>().toEqualTypeOf<"http://purl.org/dc/terms/creator">();
  });

  it("accepts inverse predicates only for known CURIEs", () => {
    expectTypeOf<"^rdfs:subClassOf" extends CorePredicate ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"^rdfs:subClasOf" extends CorePredicate ? true : false>().toEqualTypeOf<false>();
  });

  it("preserves extension literals when vocabularies are merged", () => {
    const extended = mergeVocab(CoreVocab, {
      ex: {
        iri: "https://example.test/ns#",
        terms: ["Thing"],
      },
    } as const);

    expectTypeOf<Curie<typeof extended>>().toEqualTypeOf<CoreCurie | "ex:Thing">();
    expect(extended.ex.terms).toEqual(["Thing"]);
  });

  it("extends the core registry with the repository semantic authority", () => {
    expect(SemanticFoundationVocab.beep).toEqual({
      iri: "https://ns.beep.sh/",
      terms: [
        "ontology/semantic-foundation",
        "ontology/semantic-foundation/taxonomy/legal-intake",
        "ontology/semantic-foundation/filing-root/local-vault",
        "ontology/semantic-foundation/filing-root/box-mirror",
      ],
    });
  });
});

describe("CoreVocab runtime invariants", () => {
  it("uses namespace IRIs ending in # or /", () => {
    for (const [prefix, vocab] of Object.entries(CoreVocab)) {
      expect(vocab.iri.endsWith("#") || vocab.iri.endsWith("/"), prefix).toBe(true);
    }
  });

  it("has non-empty term lists", () => {
    for (const [prefix, vocab] of Object.entries(CoreVocab)) {
      expect(vocab.terms.length, prefix).toBeGreaterThan(0);
    }
  });

  it("has no duplicate terms", () => {
    for (const [prefix, vocab] of Object.entries(CoreVocab)) {
      const terms: ReadonlyArray<string> = vocab.terms;
      const duplicates = terms.filter((term, index) => terms.indexOf(term) !== index);

      expect(duplicates, prefix).toEqual([]);
    }
  });

  it("round-trips generated vocabulary registries through their encoded shape", () => {
    fc.assert(
      fc.property(S.toArbitrary(VocabRegistry)(fc), (registry) => {
        const decoded = O.flatMap(S.encodeOption(VocabRegistry)(registry), S.decodeUnknownOption(VocabRegistry));

        expect(O.exists(decoded, (value) => Equal.equals(value, registry))).toBe(true);
      })
    );
  });

  it("accepts CoreVocab through the runtime registry schema", () => {
    expect(O.isSome(S.decodeOption(VocabRegistry)(CoreVocab))).toBe(true);
  });
});
