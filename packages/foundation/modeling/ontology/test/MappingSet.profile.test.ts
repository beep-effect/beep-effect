import { nifClassOf } from "@beep/annotation/rdf/OaCodec";
import { expand, iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { GufoTyping, TypedHierarchy } from "@beep/ontology/Gufo";
import {
  ConflictingPredicates,
  checkMappingCoherence,
  DisjointUpperTypes,
  MappingIncoherence,
  MappingJustification,
  MappingPredicate,
  MappingSet,
} from "@beep/ontology/Mapping";
import { annotationMappingSet } from "@beep/ontology/Mapping.annotation";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { RegistryCurie } from "@beep/identity/Registry";
import type { GufoClassType, GufoInstanceCategory } from "@beep/ontology/Gufo";

type Row = readonly [RegistryCurie, MappingPredicate, RegistryCurie];

const term = (curie: RegistryCurie) => TermIri.make(iri(curie));

const encodedRow = (
  [subject, predicate, object]: Row,
  justification: MappingJustification = "semapv:LexicalMatching"
) => ({
  subject: iri(subject),
  predicate,
  object: iri(object),
  justification,
  confidence: { _tag: "Absent", reason: "not-assessed" },
});

const decodeSet = S.decodeUnknownEffect(MappingSet);

const mappingSet = (rows: ReadonlyArray<Row>) =>
  decodeSet({
    id: "https://example.test/mapping-set",
    version: "1",
    license: "Apache-2.0",
    mappings: A.map(rows, (row) => encodedRow(row)),
  });

const typing = (classType: GufoClassType, instanceCategory: GufoInstanceCategory) =>
  GufoTyping.make({
    classType,
    instanceCategory,
    mediates: instanceCategory === "Relator" ? HashMap.make([term("doco:List"), 2]) : HashMap.empty(),
  });

const hierarchy = (
  typed: ReadonlyArray<readonly [RegistryCurie, GufoTyping]>,
  edges: ReadonlyArray<readonly [RegistryCurie, RegistryCurie]> = []
) =>
  TypedHierarchy.make({
    typing: HashMap.fromIterable(A.map(typed, ([curie, value]) => [term(curie), value])),
    specializes: HashMap.fromIterable(A.map(edges, ([sub, sup]) => [term(sub), HashSet.make(term(sup))])),
  });

const empty = hierarchy([]);

const conflict = (subject: RegistryCurie, object: RegistryCurie, predicates: ReadonlyArray<MappingPredicate>) =>
  ConflictingPredicates.make({
    subject: term(subject),
    object: term(object),
    predicates: HashSet.fromIterable(predicates),
  });

const disjoint = (subject: RegistryCurie, left: RegistryCurie, right: RegistryCurie) =>
  DisjointUpperTypes.make({ subject: term(subject), left: term(left), right: term(right) });

const encodeFindings = S.encodeEffect(S.Array(MappingIncoherence));

const check = (typed: TypedHierarchy, rows: ReadonlyArray<Row>) =>
  mappingSet(rows).pipe(Effect.map(checkMappingCoherence(typed)), Effect.flatMap(encodeFindings));

const expectFindings = (typed: TypedHierarchy, rows: ReadonlyArray<Row>, expected: ReadonlyArray<MappingIncoherence>) =>
  Effect.all([check(typed, rows), encodeFindings(expected)], { concurrency: 1 }).pipe(
    Effect.map(([actual, wanted]) => {
      expect(actual).toEqual(wanted);
    })
  );

describe("mapping sets", () => {
  it.effect(
    "L3-2 a mapping set is coherent and consistent",
    Effect.fnUntraced(function* () {
      const repo = yield* Result.match(annotationMappingSet(), { onFailure: Effect.die, onSuccess: Effect.succeed });
      expect(checkMappingCoherence(empty)(repo)).toEqual([]);
      expect(HashSet.size(repo.mappings)).toBe(6);

      yield* expectFindings(
        empty,
        [
          ["doco:Section", "skos:exactMatch", "doco:Title"],
          ["doco:Section", "skos:broadMatch", "doco:Title"],
        ],
        [conflict("doco:Section", "doco:Section", ["skos:exactMatch", "skos:broadMatch"])]
      );
      yield* expectFindings(
        empty,
        [
          ["doco:Section", "skos:broadMatch", "doco:Title"],
          ["doco:Section", "skos:narrowMatch", "doco:Title"],
        ],
        [conflict("doco:Section", "doco:Title", ["skos:broadMatch", "skos:narrowMatch"])]
      );
      yield* expectFindings(
        empty,
        [
          ["doco:Section", "skos:broadMatch", "doco:Title"],
          ["doco:Title", "skos:narrowMatch", "doco:Section"],
          ["doco:Figure", "skos:relatedMatch", "doco:List"],
        ],
        []
      );
      yield* expectFindings(
        empty,
        [
          ["doco:Figure", "skos:exactMatch", "doco:List"],
          ["doco:List", "skos:exactMatch", "doco:Paragraph"],
          ["doco:Figure", "skos:broadMatch", "doco:Paragraph"],
          ["doco:Section", "skos:relatedMatch", "doco:Section"],
        ],
        [
          conflict("doco:Figure", "doco:Figure", ["skos:exactMatch", "skos:broadMatch"]),
          conflict("doco:Section", "doco:Section", ["skos:exactMatch", "skos:relatedMatch"]),
        ]
      );
      yield* expectFindings(
        empty,
        [
          ["doco:Figure", "skos:broadMatch", "doco:List"],
          ["doco:List", "skos:broadMatch", "doco:Paragraph"],
          ["doco:Figure", "skos:relatedMatch", "doco:Paragraph"],
        ],
        [conflict("doco:Figure", "doco:Paragraph", ["skos:relatedMatch", "skos:broadMatch"])]
      );

      const chain: ReadonlyArray<Row> = [
        ["doco:Figure", "skos:exactMatch", "doco:List"],
        ["doco:List", "skos:exactMatch", "doco:Paragraph"],
        ["doco:Paragraph", "skos:exactMatch", "doco:Section"],
      ];
      const ends = hierarchy([
        ["doco:Figure", typing("Kind", "Object")],
        ["doco:Section", typing("Kind", "Relator")],
      ]);
      yield* expectFindings(ends, chain, [disjoint("doco:Figure", "doco:Figure", "doco:Section")]);
      yield* expectFindings(
        ends,
        [["doco:Figure", "skos:exactMatch", "doco:Section"]],
        [disjoint("doco:Figure", "doco:Figure", "doco:Section")]
      );

      const kinds = hierarchy(
        [
          ["doco:Figure", typing("Role", "Object")],
          ["doco:List", typing("Role", "Object")],
          ["doco:Title", typing("Kind", "Object")],
          ["doco:SectionTitle", typing("Kind", "Object")],
          ["doco:Paragraph", typing("Category", "Object")],
        ],
        [
          ["doco:Figure", "doco:Title"],
          ["doco:List", "doco:SectionTitle"],
        ]
      );
      yield* expectFindings(
        kinds,
        [
          ["doco:Figure", "skos:closeMatch", "doco:List"],
          ["doco:Paragraph", "skos:closeMatch", "doco:Figure"],
        ],
        [disjoint("doco:Figure", "doco:Figure", "doco:List")]
      );
      yield* expectFindings(ends, [["doco:Figure", "skos:closeMatch", "doco:Title"]], []);
    })
  );

  it("expands every mapping predicate and justification to a declared term", () => {
    const literals = [...MappingPredicate.literals, ...MappingJustification.literals];
    expect(A.filter(literals, (literal) => O.isNone(expand(literal)))).toEqual([]);
  });

  it("matches the Sentence and Word rows to the NIF classes the OA codec writes", () => {
    const repo = Result.getOrThrow(annotationMappingSet());
    const objectOf = (kind: string) =>
      A.findFirst(A.fromIterable(repo.mappings), (row) => row.subject === term(`annotation:${kind}` as RegistryCurie));
    expect(A.map(["Sentence", "Word"], (kind) => O.map(objectOf(kind), (row) => row.object))).toEqual(
      A.map(["Sentence", "Word"], (kind) => O.map(R.get(nifClassOf, kind), (node) => node.value))
    );
  });

  it.effect(
    "refuses unregistered terms and repeated triples and encodes rows sorted by triple",
    Effect.fnUntraced(function* () {
      const row = encodedRow(["doco:Figure", "skos:exactMatch", "doco:List"]);
      const set = (mappings: ReadonlyArray<unknown>) =>
        decodeSet({ id: "https://example.test/mapping-set", version: "1", license: "Apache-2.0", mappings }).pipe(
          Effect.flip,
          Effect.map((error) => error._tag)
        );
      const refusals = yield* Effect.all(
        [
          set([{ ...row, subject: "https://example.test/unregistered" }]),
          set([{ ...row, object: "https://example.test/unregistered" }]),
          set([row, { ...row, justification: "semapv:ManualMappingCuration" }]),
        ],
        { concurrency: 1 }
      );
      expect(refusals).toEqual(["SchemaError", "SchemaError", "SchemaError"]);
      const decoded = yield* mappingSet([
        ["doco:List", "skos:exactMatch", "doco:Title"],
        ["doco:Figure", "skos:exactMatch", "doco:Title"],
        ["doco:Figure", "skos:exactMatch", "doco:List"],
        ["doco:Figure", "skos:closeMatch", "doco:Section"],
      ]);
      const encoded = yield* S.encodeEffect(MappingSet)(decoded);
      expect(A.map(encoded.mappings, (mapping) => [mapping.subject, mapping.predicate, mapping.object])).toEqual([
        [iri("doco:Figure"), "skos:closeMatch", iri("doco:Section")],
        [iri("doco:Figure"), "skos:exactMatch", iri("doco:List")],
        [iri("doco:Figure"), "skos:exactMatch", iri("doco:Title")],
        [iri("doco:List"), "skos:exactMatch", iri("doco:Title")],
      ]);
      expect(encoded.license).toBe("Apache-2.0");
    })
  );

  it.effect.prop(
    "a one-row set of any predicate and justification is coherent and survives its codec",
    [Arbitrary.schema(MappingPredicate), Arbitrary.schema(MappingJustification)],
    ([predicate, justification]) =>
      Effect.gen(function* () {
        const set = yield* decodeSet({
          id: "https://example.test/mapping-set",
          version: "1",
          license: "Apache-2.0",
          mappings: [encodedRow(["doco:Figure", predicate, "doco:List"], justification)],
        });
        deepStrictEqual(checkMappingCoherence(empty)(set), []);
        const encoded = yield* S.encodeEffect(MappingSet)(set);
        const decoded = yield* decodeSet(encoded);
        assertTrue(S.toEquivalence(MappingSet)(decoded, set));
      }),
    { arbitrary: fcRuns(50) }
  );
});
