import * as Effect from "effect/Effect";
import { SafePnLocal } from "@beep/identity";
import * as CanonicalRdf from "@beep/rdf";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { Triple } from "../../../Domain/Rdf/Types.ts";
const isSafePnLocal = S.is(SafePnLocal);

const { BlankNode, Literal, makeBlankNode, makeLiteral, makeNamedNode, NamedNode, Quad } = CanonicalRdf;
const isBlankNode = S.is(BlankNode);
const isLiteral = S.is(Literal);
const isNamedNode = S.is(NamedNode);
const isQuad = S.is(Quad);

describe("effect-ontology RDF types", () => {
  it("derives arbitraries whose values satisfy local adapter schemas", () => {
    for (const schema of [SafePnLocal, Triple]) {
      const arbitrary = Arbitrary.schema(schema);

      expect(
        Effect.runSync(
          Arbitrary.checkEffect(
            Arbitrary.all([arbitrary]),
            ([value]) => {
          expect(S.is(schema)(value)).toBe(true);

              return true;
            },
            { runs: 32 }
          )
        )._tag
      ).toBe("Passed");
    }
  });

  it("uses canonical RDF/JS term discrimination", () => {
    const namedNode = makeNamedNode("https://example.org/alice");
    const blankNode = makeBlankNode("alice");
    const literal = makeLiteral("Alice", "https://www.w3.org/2001/XMLSchema#string");

    expect(isNamedNode(namedNode)).toBe(true);
    expect(isBlankNode(blankNode)).toBe(true);
    expect(blankNode).toEqual({ termType: "BlankNode", value: "alice" });
    expect(isLiteral(literal)).toBe(true);
  });

  it("round-trips graph-free triples through canonical default-graph quads", () => {
    const triple = Triple.make({
      subject: makeNamedNode("https://example.org/alice"),
      predicate: makeNamedNode("https://schema.org/name"),
      object: makeLiteral("Alice", "https://www.w3.org/2001/XMLSchema#string"),
    });
    const quad = triple.toQuad();
    const recovered = Triple.fromQuad(quad);

    expect(isQuad(quad)).toBe(true);
    expect(quad.graph.termType).toBe("DefaultGraph");
    expect(recovered.subject).toEqual(triple.subject);
    expect(recovered.predicate).toEqual(triple.predicate);
    expect(recovered.object).toEqual(triple.object);
  });

  it("uses canonical safe Turtle local names without a competing brand", () => {
    expect(isSafePnLocal("prefLabel")).toBe(true);
    expect(isSafePnLocal("contains/slash")).toBe(false);
    expect(isSafePnLocal("contains space")).toBe(false);
  });
});
