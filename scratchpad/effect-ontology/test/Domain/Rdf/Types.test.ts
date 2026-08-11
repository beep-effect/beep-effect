import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { BlankNode, IRI, Literal, LocalName, Quad, Triple } from "../../../Domain/Rdf/Types.ts";

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
    const namedNode = IRI.make("https://example.org/alice");
    const blankNode = BlankNode.make("_:alice");
    const literal = Literal.make({
      value: "Alice",
      datatype: O.some(IRI.make("http://www.w3.org/2001/XMLSchema#string")),
    });

    expect(IRI.is(namedNode)).toBe(true);
    expect(BlankNode.is(blankNode)).toBe(true);
    expect(blankNode).toBe("_:alice");
    expect(Literal.is(literal)).toBe(true);
  });

  it("round-trips graph-free triples through canonical default-graph quads", () => {
    const triple = Triple.make({
      subject: IRI.make("https://example.org/alice"),
      predicate: IRI.make("https://schema.org/name"),
      object: Literal.make({
        value: "Alice",
        datatype: O.some(IRI.make("http://www.w3.org/2001/XMLSchema#string")),
      }),
    });
    const quad = Quad.make({ ...triple, graph: O.none() });
    const recovered = quad.toTriple();

    expect(O.isNone(quad.graph)).toBe(true);
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
