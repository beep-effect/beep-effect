import { describe, expect, expectTypeOf, it } from "vitest";
import { CoreVocab, type Curie, type Expand, type Predicate } from "../identity/Vocab.ts";

type CoreCurie = Curie<typeof CoreVocab>;
type CorePredicate = Predicate<typeof CoreVocab>;

describe("Vocab literal types", () => {
  it("derives CURIE literals from CoreVocab data", () => {
    expectTypeOf<"skos:prefLabel" extends CoreCurie ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"skos:prefLabl" extends CoreCurie ? true : false>().toEqualTypeOf<false>();
  });

  it("expands CURIE literals to exact namespace IRIs", () => {
    expectTypeOf<Expand<"skos:prefLabel", typeof CoreVocab>>().toEqualTypeOf<"http://www.w3.org/2004/02/skos/core#prefLabel">();
  });

  it("accepts inverse predicates only for known CURIEs", () => {
    expectTypeOf<"^rdfs:subClassOf" extends CorePredicate ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"^rdfs:subClasOf" extends CorePredicate ? true : false>().toEqualTypeOf<false>();
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
      const duplicates = vocab.terms.filter((term, index) => vocab.terms.indexOf(term) !== index);

      expect(duplicates, prefix).toEqual([]);
    }
  });
});
