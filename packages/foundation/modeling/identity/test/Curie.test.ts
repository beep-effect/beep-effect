import { CoreVocab, CurieFromIri, contractOption, expand, expandOption, expandPredicate } from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
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
      const iri = expandOption(current.curie, CoreVocab);

      expect(O.getOrUndefined(iri), current.curie).toBe(current.iri);
      if (O.isSome(iri)) {
        expect(O.getOrUndefined(contractOption(iri.value, CoreVocab)), current.iri).toBe(current.curie);
      }
    }
  });

  it("property-checks round-trips over the entire registry", () => {
    fc.assert(
      fc.property(fc.constant(coreCurieCases), (cases) => {
        for (const current of cases) {
          const iri = expandOption(current.curie, CoreVocab);

          expect(O.getOrUndefined(iri), current.curie).toBe(current.iri);
          if (O.isSome(iri)) {
            expect(O.getOrUndefined(contractOption(iri.value, CoreVocab)), current.iri).toBe(current.curie);
          }
        }
      })
    );
  });

  it.effect(
    "decodes and encodes known CURIEs",
    Effect.fnUntraced(function* () {
      expect(yield* decodeCurie("skos:prefLabel")).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
      expect(yield* encodeIri("http://www.w3.org/2004/02/skos/core#prefLabel")).toBe("skos:prefLabel");
    })
  );

  it("round-trips generated CoreVocab IRIs through the schema codec", () => {
    fc.assert(
      fc.property(S.toArbitrary(CurieFromIri)(fc), (iri) => {
        const decoded = O.flatMap(S.encodeOption(CurieFromIri)(iri), S.decodeUnknownOption(CurieFromIri));

        expect(O.exists(decoded, (value) => Equal.equals(value, iri))).toBe(true);
      })
    );
  });

  it.effect(
    "fails schema decoding for unknown prefixes and known-prefix unknown terms",
    Effect.fnUntraced(function* () {
      expect((yield* Effect.flip(decodeCurie("nope:term")))._tag).toBe("SchemaError");
      expect((yield* Effect.flip(decodeCurie("skos:nope")))._tag).toBe("SchemaError");
    })
  );

  it.effect(
    "fails schema encoding for unregistered IRIs",
    Effect.fnUntraced(function* () {
      expect((yield* Effect.flip(encodeIri("http://www.w3.org/2004/02/skos/core#nope")))._tag).toBe("SchemaError");
    })
  );

  it("expands inverse predicates", () => {
    expect(expandPredicate("^rdfs:subClassOf")).toEqual({
      iri: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
      inverse: true,
    });
  });
});
