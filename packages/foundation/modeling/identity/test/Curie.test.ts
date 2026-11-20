import {
  contract,
  curieNamespace,
  ExpandedPredicate,
  expand,
  expandPredicate,
  fromVocab,
  iri,
  RegistryVocab,
} from "@beep/identity/Registry";
import { it } from "@beep/test-runner";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const widen = (value: O.Option<string>): O.Option<string> => value;
const directionAndIri = (predicate: ExpandedPredicate): readonly [boolean, string] => [
  predicate.inverse,
  predicate.iri,
];
const prefixOf = (value: string): O.Option<string> => O.map(curieNamespace(value), (namespace) => namespace.prefix);

const registryCuries = A.flatMap(R.toEntries(RegistryVocab), ([prefix, entry]) =>
  A.map(entry.terms, (term): string => `${prefix}:${term}`)
);

const fixture = fromVocab({
  ex: { iri: "https://example.test/ns#", terms: ["Thing", "knows"] },
  "ex-deep": { iri: "https://example.test/ns#deep/", terms: ["Leaf"] },
});

describe("the registry CURIE codec", () => {
  it("keeps the literal IRI type of a registered CURIE", () => {
    expectTypeOf(iri("skos:prefLabel")).toEqualTypeOf<"http://www.w3.org/2004/02/skos/core#prefLabel">();
    expect(iri("skos:prefLabel")).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
  });

  it("expands forward and inverse predicates with their direction", () => {
    assertSome(O.map(expandPredicate("^rdfs:subClassOf"), directionAndIri), [true, iri("rdfs:subClassOf")]);
    assertSome(O.map(expandPredicate("rdfs:subClassOf"), directionAndIri), [false, iri("rdfs:subClassOf")]);
    assertNone(expandPredicate("^rdfs:subClasOf"));
    assertNone(expandPredicate("^^rdfs:subClassOf"));
  });

  it("expands every registry CURIE as a forward and as an inverse predicate to the same term", () => {
    for (const curie of registryCuries) {
      for (const inverse of [false, true]) {
        const expanded = expandPredicate(inverse ? `^${curie}` : curie);
        assertSome(O.map(expanded, directionAndIri), [inverse, O.getOrThrow(expand(curie))]);
        assertTrue(O.exists(expanded, S.is(ExpandedPredicate)));
      }
    }
  });

  it("names the namespace of a CURIE under a registered prefix, whatever its local", () => {
    assertSome(prefixOf("rdfs:label"), "rdfs");
    assertSome(prefixOf("rdfs:notATerm"), "rdfs");
    assertNone(prefixOf("urn:example:x"));
    assertNone(prefixOf("https://example.test/x"));
    assertNone(prefixOf("no-separator"));
  });
});

describe("a registry view over a bare vocabulary", () => {
  it("expands and contracts exactly, with no fallback to the generated registry", () => {
    assertSome(widen(fixture.expand("ex:Thing")), "https://example.test/ns#Thing");
    assertSome(fixture.contract("https://example.test/ns#Thing"), "ex:Thing");
    assertSome(fixture.contract("https://example.test/ns#deep/Leaf"), "ex-deep:Leaf");
    assertNone(fixture.contract("https://example.test/ns#deep/"));
    assertNone(fixture.expand("skos:prefLabel"));
    assertNone(contract("https://example.test/ns#Thing"));
  });

  it("expands predicates and looks up prefixes over the vocabulary", () => {
    assertSome(O.map(fixture.expandPredicate("^ex:knows"), directionAndIri), [true, "https://example.test/ns#knows"]);
    assertSome(
      O.map(fixture.curieNamespace("ex:Unknown"), (namespace): string => namespace.iri),
      "https://example.test/ns#"
    );
    assertNone(fixture.curieNamespace("skos:prefLabel"));
  });

  it("holds no bindings and no deprecations", () => {
    assertNone(fixture.bindingOf("@beep/identity/Anything"));
    assertNone(fixture.replacementOf("https://example.test/ns#Thing"));
  });
});
