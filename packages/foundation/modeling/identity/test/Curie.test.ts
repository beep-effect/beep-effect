import { CoreVocab, CurieFromIri, contract, expand, expandPredicate } from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { expectTypeOf } from "vitest";

const decodeCurie = S.decodeUnknownEffect(CurieFromIri);
const encodeIri = S.encodeUnknownEffect(CurieFromIri);

const coreCurieCases = Object.entries(CoreVocab).flatMap(([prefix, vocab]) =>
  vocab.terms.map((term) => ({
    curie: `${prefix}:${term}`,
    iri: `${vocab.iri}${term}`,
    prefix,
    term,
  }))
);

describe("CURIE codec", () => {
  it("preserves literal expansion types", () => {
    expectTypeOf(expand("skos:prefLabel")).toEqualTypeOf<"http://www.w3.org/2004/02/skos/core#prefLabel">();
    expect(expand("skos:prefLabel")).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
  });

  it("round-trips every CoreVocab term", () => {
    for (const current of coreCurieCases) {
      const iri = expand(current.curie);

      expect(iri, current.curie).toBe(current.iri);
      if (iri !== undefined) {
        expect(contract(iri), current.iri).toBe(current.curie);
      }
    }
  });

  it("property-checks round-trips over the entire registry", () => {
    fc.assert(
      fc.property(fc.constant(coreCurieCases), (cases) => {
        for (const current of cases) {
          const iri = expand(current.curie);

          expect(iri, current.curie).toBe(current.iri);
          if (iri !== undefined) {
            expect(contract(iri), current.iri).toBe(current.curie);
          }
        }
      })
    );
  });

  it("decodes and encodes known CURIEs", async () => {
    await expect(Effect.runPromise(decodeCurie("skos:prefLabel"))).resolves.toBe(
      "http://www.w3.org/2004/02/skos/core#prefLabel"
    );
    await expect(Effect.runPromise(encodeIri("http://www.w3.org/2004/02/skos/core#prefLabel"))).resolves.toBe(
      "skos:prefLabel"
    );
  });

  it("fails schema decoding for unknown prefixes and known-prefix unknown terms", async () => {
    await expect(Effect.runPromise(decodeCurie("nope:term"))).rejects.toMatchObject({ _tag: "SchemaError" });
    await expect(Effect.runPromise(decodeCurie("skos:nope"))).rejects.toMatchObject({ _tag: "SchemaError" });
  });

  it("fails schema encoding for unregistered IRIs", async () => {
    await expect(Effect.runPromise(encodeIri("http://www.w3.org/2004/02/skos/core#nope"))).rejects.toMatchObject({
      _tag: "SchemaError",
    });
  });

  it("expands inverse predicates", () => {
    expect(expandPredicate("^rdfs:subClassOf")).toEqual({
      iri: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
      inverse: true,
    });
  });
});
