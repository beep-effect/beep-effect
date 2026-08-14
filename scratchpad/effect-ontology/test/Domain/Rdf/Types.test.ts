import { SafePnLocal as CanonicalSafePnLocal } from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import {
  BlankNode,
  Literal,
  makeBlankNode,
  makeLiteral,
  makeNamedNode,
  NamedNode,
  Quad,
  SafePnLocal,
  Triple,
} from "../../../Domain/Rdf/Types.ts";

describe("effect-ontology RDF types", () => {
  it("derives arbitraries whose values satisfy local adapter schemas", () => {
    for (const schema of [SafePnLocal, Triple]) {
      const arbitrary = S.toArbitrary(schema)(fc);

      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 32 }
      );
    }
  });

  it("re-exports canonical RDF/JS term discrimination", () => {
    const namedNode = makeNamedNode("https://example.org/alice");
    const blankNode = makeBlankNode("alice");
    const literal = makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string");

    expect(S.is(NamedNode)(namedNode)).toBe(true);
    expect(S.is(BlankNode)(blankNode)).toBe(true);
    expect(blankNode).toEqual({ termType: "BlankNode", value: "alice" });
    expect(S.is(Literal)(literal)).toBe(true);
  });

  it("round-trips graph-free triples through canonical default-graph quads", () => {
    const triple = Triple.make({
      subject: makeNamedNode("https://example.org/alice"),
      predicate: makeNamedNode("https://schema.org/name"),
      object: makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string"),
    });
    const quad = triple.toQuad();
    const recovered = Triple.fromQuad(quad);

    expect(S.is(Quad)(quad)).toBe(true);
    expect(quad.graph.termType).toBe("DefaultGraph");
    expect(recovered.subject).toEqual(triple.subject);
    expect(recovered.predicate).toEqual(triple.predicate);
    expect(recovered.object).toEqual(triple.object);
  });

  it("re-exports canonical safe Turtle local names without a competing brand", () => {
    expect(SafePnLocal).toBe(CanonicalSafePnLocal);
    expect(S.is(SafePnLocal)("prefLabel")).toBe(true);
    expect(S.is(SafePnLocal)("contains/slash")).toBe(false);
    expect(S.is(SafePnLocal)("contains space")).toBe(false);
  });
});
