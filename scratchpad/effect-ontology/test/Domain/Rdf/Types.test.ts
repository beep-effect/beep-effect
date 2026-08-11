import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { LocalName, makeBlankNode, makeLiteral, makeNamedNode, Triple } from "../../../Domain/Rdf/Types.ts";

describe("effect-ontology RDF types", () => {
  it("derives arbitraries whose values satisfy local schemas", () => {
    for (const schema of [LocalName, Triple]) {
      const arbitrary = S.toArbitrary(schema)(fc);

      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 32 }
      );
    }
  });

  it("uses canonical RDF/JS term discrimination", () => {
    const namedNode = makeNamedNode("https://example.org/alice");
    const blankNode = makeBlankNode("alice");
    const literal = makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string");

    expect(namedNode.termType).toBe("NamedNode");
    expect(blankNode.termType).toBe("BlankNode");
    expect(blankNode.value).toBe("alice");
    expect(literal.termType).toBe("Literal");
  });

  it("round-trips graph-free triples through canonical default-graph quads", () => {
    const triple = Triple.make({
      subject: makeNamedNode("https://example.org/alice"),
      predicate: makeNamedNode("https://schema.org/name"),
      object: makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string"),
    });
    const quad = Triple.toQuad(triple);
    const recovered = Triple.fromQuad(quad);

    expect(quad.graph.termType).toBe("DefaultGraph");
    expect(quad.graph.value).toBe("");
    expect(recovered.subject).toEqual(triple.subject);
    expect(recovered.predicate).toEqual(triple.predicate);
    expect(recovered.object).toEqual(triple.object);
  });

  it("strengthens local names with the canonical Turtle grammar", () => {
    expect(LocalName.is("prefLabel")).toBe(true);
    expect(LocalName.is("contains/slash")).toBe(false);
    expect(LocalName.is("contains space")).toBe(false);
  });
});
