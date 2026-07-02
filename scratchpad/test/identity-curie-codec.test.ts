import { Effect } from "effect";
import { FastCheck as fc } from "effect/testing";
import * as S from "effect/Schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import { contract, CurieFromIri, expand, expandPredicate } from "../identity/Curie.ts";
import { CoreVocab } from "../identity/Vocab.ts";

const decodeCurie = S.decodeUnknownEffect(CurieFromIri);
const encodeIri = S.encodeUnknownEffect(CurieFromIri);

describe("CURIE codec", () => {
  it("preserves literal expansion types", () => {
    expectTypeOf(expand("skos:prefLabel")).toEqualTypeOf<"http://www.w3.org/2004/02/skos/core#prefLabel">();
    expect(expand("skos:prefLabel")).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
  });

  it("round-trips every CoreVocab term", () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        for (const [prefix, vocab] of Object.entries(CoreVocab)) {
          for (const term of vocab.terms) {
            const curie = `${prefix}:${term}`;
            const iri = expand(curie);

            expect(iri).toBe(`${vocab.iri}${term}`);
            if (iri !== undefined) {
              expect(contract(iri)).toBe(curie);
            }
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
