import { BroaderCycle, ConceptScheme, checkBroader } from "@beep/ontology/ConceptScheme";
import { MappingPredicate, mappingPredicateIri } from "@beep/ontology/Mapping";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

const scheme = "https://example.test/scheme";
const concept = (local: string, broader: ReadonlyArray<string>, alignments: ReadonlyArray<unknown> = []) => ({
  iri: `${scheme}/${local}`,
  prefLabel: local,
  broader,
  alignments,
});

const decode = S.decodeUnknownEffect(ConceptScheme);
const encode = S.encodeEffect(ConceptScheme);

it.effect(
  "encodes concepts by IRI and alignments by predicate and target, whatever the input order",
  Effect.fnUntraced(function* () {
    const decoded = yield* decode({
      iri: scheme,
      version: "1",
      prefLabel: "Example",
      concepts: [
        concept("b", [`${scheme}/a`]),
        concept(
          "a",
          [],
          [
            { predicate: "skos:relatedMatch", target: "https://vendor.example.test/z" },
            { predicate: "skos:closeMatch", target: "https://vendor.example.test/y" },
            { predicate: "skos:closeMatch", target: "https://vendor.example.test/x" },
          ]
        ),
      ],
    });
    const encoded = yield* encode(decoded);
    expect(A.map(encoded.concepts, (entry) => entry.iri)).toEqual([`${scheme}/a`, `${scheme}/b`]);
    expect(A.map(encoded.concepts[0]?.alignments ?? [], (entry) => [entry.predicate, entry.target])).toEqual([
      ["skos:closeMatch", "https://vendor.example.test/x"],
      ["skos:closeMatch", "https://vendor.example.test/y"],
      ["skos:relatedMatch", "https://vendor.example.test/z"],
    ]);
    expect(encoded.concepts[1]?.broader).toEqual([`${scheme}/a`]);
  })
);

it.effect(
  "refuses two concepts with one IRI",
  Effect.fnUntraced(function* () {
    const error = yield* decode({
      iri: scheme,
      version: "1",
      prefLabel: "Example",
      concepts: [concept("a", []), { ...concept("a", []), prefLabel: "Other" }],
    }).pipe(Effect.flip);
    expect(error._tag).toBe("SchemaError");
  })
);

it.effect(
  "orders disjoint cycles by their least member",
  Effect.fnUntraced(function* () {
    const decoded = yield* decode({
      iri: scheme,
      version: "1",
      prefLabel: "Example",
      concepts: [
        concept("c", [`${scheme}/d`]),
        concept("d", [`${scheme}/c`]),
        concept("a", [`${scheme}/b`]),
        concept("b", [`${scheme}/a`]),
      ],
    });
    const cycles = A.filter(checkBroader(decoded), S.is(BroaderCycle));
    expect(A.map(cycles, (cycle) => A.sort(A.fromIterable(cycle.members), Order.String))).toEqual([
      [`${scheme}/a`, `${scheme}/b`],
      [`${scheme}/c`, `${scheme}/d`],
    ]);
  })
);

it("expands every mapping predicate to its SKOS IRI", () => {
  expect(A.map(MappingPredicate.literals, mappingPredicateIri)).toEqual([
    "http://www.w3.org/2004/02/skos/core#exactMatch",
    "http://www.w3.org/2004/02/skos/core#closeMatch",
    "http://www.w3.org/2004/02/skos/core#broadMatch",
    "http://www.w3.org/2004/02/skos/core#narrowMatch",
    "http://www.w3.org/2004/02/skos/core#relatedMatch",
  ]);
});
