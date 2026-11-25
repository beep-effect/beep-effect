import { make } from "@beep/identity";
import { RegistryVocab, view } from "@beep/identity/Registry";
import { RegistryShard, RegistryTable } from "@beep/identity/Term";
import { foldWith, toDataset, toMarkdown } from "@beep/ontology";
import { AssembledOntology } from "@beep/ontology/Fold.models";
import * as Rdf from "@beep/rdf/Rdf";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertSome, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";
import type { AssembledClass, AssembledPredicate, OntologyFoldInput, Triple, TupleObject } from "@beep/ontology";

const decodeShard = flow(S.decodeResult(RegistryShard), Result.getOrThrow);
const ascending = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(A.dedupe(values), Order.String);

const externalShards = A.map(R.toEntries(RegistryVocab), ([prefix, entry]) =>
  decodeShard({ namespace: { prefix, iri: entry.iri }, terms: entry.terms, bindings: [], deprecations: [] })
);

const objectFields = (ast: SchemaAST.AST): ReadonlyArray<string> =>
  SchemaAST.isObjects(ast)
    ? A.filterMap(ast.propertySignatures, (property) =>
        P.isString(property.name) ? Result.succeed(property.name) : Result.failVoid
      )
    : SchemaAST.isDeclaration(ast)
      ? A.flatMap(ast.typeParameters, objectFields)
      : [];

type Owned = {
  readonly identifier: string;
  readonly local: string;
};

const ownedClass = (schema: S.Top): Owned => {
  const annotations = S.resolveAnnotations(schema);
  const identifier = P.isString(annotations?.identifier) ? annotations.identifier : "";
  return { identifier, local: P.isString(annotations?.title) ? annotations.title : identifier };
};

const registryFor = (
  prefix: string,
  iri: string,
  schemas: ReadonlyArray<S.Top>,
  extra: ReadonlyArray<RegistryShard> = []
) => {
  const owned = A.map(schemas, ownedClass);
  const shard = decodeShard({
    namespace: { prefix, iri },
    terms: ascending([
      ...A.map(owned, (row) => row.local),
      ...A.flatMap(schemas, (schema) => objectFields(schema.ast)),
    ]),
    bindings: A.sort(
      A.map(owned, (row) => ({ code: row.identifier, local: row.local, since: "1.0.0" })),
      Order.mapInput(Order.String, (row: { readonly code: string }) => row.code)
    ),
    deprecations: [],
  });
  return RegistryTable.fromShards([...externalShards, shard, ...extra]).pipe(Result.getOrThrow, view);
};

const foldUnder = (prefix: string, iri: string) => (input: OntologyFoldInput) =>
  foldWith(registryFor(prefix, iri, input.schemas))(prefix, input);

const $I = make("beep").$BeepId.create("patent");
const foldPatent = foldUnder("beep", "https://beep-effect.com/ns/patent/");

class Claim extends S.Opaque<Claim, { readonly brand: unique symbol }>()(
  S.Struct({
    prefLabel: S.String.pipe($I.key("skos:prefLabel")),
    children: S.Array(S.String).pipe($I.key("^rdfs:subClassOf")),
    text: S.String.pipe($I.key({ description: "Claim text." })),
  })
    .pipe($I.annoteSchema("Claim"))
    .annotate($I.class("Claim", { description: "Patent claim\nwith escaped text." }))
) {}

class Spec extends S.Opaque<Spec, { readonly brand: unique symbol }>()(
  S.Struct({
    claim: Claim,
  })
    .pipe($I.annoteSchema("Spec"))
    .annotate($I.class("Spec", { description: "Patent specification." }))
) {}

class UnsafeLocal extends S.Opaque<UnsafeLocal, { readonly brand: unique symbol }>()(
  S.Struct({
    label: S.String,
  }).pipe($I.annoteSchema("Classification.models/ClassificationPin", { description: "Unsafe local." }))
) {}

const triples = [
  [Claim, "rdfs:subClassOf", "owl:Thing"],
  [Claim, "owl:sameAs", "https://schema.org/CreativeWork"],
  [Spec, "skos:related", Claim],
  [Claim, "^rdfs:subClassOf", Spec],
] satisfies ReadonlyArray<Triple>;

const assemble = foldPatent({
  label: "Patent Core",
  schemas: [Claim, Spec, UnsafeLocal],
  triples,
});

const findClass = (classes: ReadonlyArray<AssembledClass>, name: string) =>
  pipe(
    classes,
    A.findFirst((item) => item.name === name)
  );

const findPredicate = (assembled: AssembledClass, keyName: string): O.Option<AssembledPredicate> =>
  pipe(
    assembled.predicates,
    A.findFirst((item) => item.key === keyName)
  );

const XSD = "http://www.w3.org/2001/XMLSchema#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const OWL = "http://www.w3.org/2002/07/owl#";
const PATENT = "https://beep-effect.com/ns/patent/";

const holds = (dataset: Rdf.Dataset, subject: string, predicate: string, object: Rdf.ObjectTerm): boolean =>
  HashSet.has(dataset.quads, Rdf.makeQuad(Rdf.makeNamedNode(subject), Rdf.makeNamedNode(predicate), object));

const subjectsTyped = (dataset: Rdf.Dataset, type: string): ReadonlyArray<string> =>
  A.sort(
    A.filterMap(A.fromIterable(dataset.quads), (quad) =>
      quad.predicate.value === RDF_TYPE && quad.object.value === type
        ? Result.succeed(quad.subject.value)
        : Result.failVoid
    ),
    Order.String
  );

const literalFact = (object: TupleObject) =>
  Effect.map(
    foldPatent({ label: "Literal", schemas: [Claim], triples: [[Claim, "rdfs:comment", object]] }),
    (assembled) => O.getOrThrow(A.head(assembled.facts)).object
  );

describe("Ontology.fold", () => {
  it.effect("resolves an explicit literal datatype without losing its value", () =>
    Effect.gen(function* () {
      const assembled = yield* foldPatent({
        label: "Typed literal",
        schemas: [Claim],
        triples: [[Claim, "rdfs:label", { value: 42, datatype: `${XSD}integer` }]],
      });
      const fact = O.getOrThrow(A.head(assembled.facts));
      assertTrue(Rdf.Literal.is(fact.object));
      expect(fact.object).toStrictEqual(Rdf.Literal.typed("42", `${XSD}integer`));
    })
  );

  it.effect("maps authoring literals to the simple, typed and language-tagged cases", () =>
    Effect.gen(function* () {
      const authored: ReadonlyArray<TupleObject> = [
        { value: "plain" },
        { value: "plain", datatype: "xsd:string" },
        { value: "Tagged", language: "EN-gb" },
        { value: "Tagged", datatype: "rdf:langString", language: "en" },
        { value: 42 },
        { value: 2 ** 53 },
        { value: -0.5 },
        { value: 1e21 },
        { value: 1e-7 },
        { value: false },
        { value: "2026-11-23T00:00:00Z", datatype: "xsd:dateTime" },
      ];
      const objects = yield* Effect.forEach(authored, literalFact, { concurrency: 1 });

      expect(objects).toStrictEqual([
        Rdf.makeLiteral("plain"),
        Rdf.makeLiteral("plain"),
        Rdf.Literal.langTagged("Tagged", "en-gb"),
        Rdf.Literal.langTagged("Tagged", "en"),
        Rdf.Literal.typed("42", `${XSD}integer`),
        Rdf.Literal.typed("9007199254740992", `${XSD}integer`),
        Rdf.Literal.typed("-0.5", `${XSD}decimal`),
        Rdf.Literal.typed("1e+21", `${XSD}double`),
        Rdf.Literal.typed("1e-7", `${XSD}double`),
        Rdf.Literal.typed("false", `${XSD}boolean`),
        Rdf.Literal.typed("2026-11-23T00:00:00Z", `${XSD}dateTime`),
      ]);
    })
  );

  it.effect("refuses an ill-formed literal with invalidLiteral", () =>
    Effect.gen(function* () {
      const refusals = yield* Effect.forEach(
        [
          { value: "x", datatype: "xsd:integer", language: "en" },
          { value: "x", language: "not a tag" },
          { value: "x", language: "" },
          { value: "x", datatype: "rdf:langString" },
          { value: Number.NaN },
          { value: Number.POSITIVE_INFINITY },
        ] as unknown as ReadonlyArray<TupleObject>,
        (object) => Effect.map(Effect.flip(literalFact(object)), (error) => error.reason),
        { concurrency: 1 }
      );

      expect(refusals).toStrictEqual(A.replicate("invalidLiteral" as const, 6));
    })
  );

  it.effect("resolves class IRIs and tuple facts through schema identity annotations", () =>
    Effect.gen(function* () {
      const assembled = yield* assemble;
      const claim = pipe(findClass(assembled.classes, "Claim"), O.getOrThrow);
      const spec = pipe(findClass(assembled.classes, "Spec"), O.getOrThrow);

      expect(claim.iri).toBe("https://beep-effect.com/ns/patent/Claim");
      expect(spec.iri).toBe("https://beep-effect.com/ns/patent/Spec");
      expect(A.map(assembled.facts, (fact) => [fact.subjectIri, fact.predicateIri, fact.object, fact.reverse])).toEqual(
        [
          [
            "https://beep-effect.com/ns/patent/Claim",
            "http://www.w3.org/2000/01/rdf-schema#subClassOf",
            "http://www.w3.org/2002/07/owl#Thing",
            false,
          ],
          [
            "https://beep-effect.com/ns/patent/Claim",
            "http://www.w3.org/2002/07/owl#sameAs",
            "https://schema.org/CreativeWork",
            false,
          ],
          [
            "https://beep-effect.com/ns/patent/Spec",
            "http://www.w3.org/2004/02/skos/core#related",
            "https://beep-effect.com/ns/patent/Claim",
            false,
          ],
          [
            "https://beep-effect.com/ns/patent/Claim",
            "http://www.w3.org/2000/01/rdf-schema#subClassOf",
            "https://beep-effect.com/ns/patent/Spec",
            true,
          ],
        ]
      );
    })
  );

  it.effect("defaults field predicate names to struct keys and infers datatype/object kinds", () =>
    Effect.gen(function* () {
      const assembled = yield* assemble;
      const claim = pipe(findClass(assembled.classes, "Claim"), O.getOrThrow);
      const spec = pipe(findClass(assembled.classes, "Spec"), O.getOrThrow);
      const prefLabel = pipe(findPredicate(claim, "prefLabel"), O.getOrThrow);
      const text = pipe(findPredicate(claim, "text"), O.getOrThrow);
      const children = pipe(findPredicate(claim, "children"), O.getOrThrow);
      const claimRef = pipe(findPredicate(spec, "claim"), O.getOrThrow);

      expect(prefLabel.kind).toBe("datatype");
      expect(prefLabel.term).toBe("skos:prefLabel");
      expect(prefLabel.termIri).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
      expect(text.kind).toBe("datatype");
      expect(text.term).toBe("text");
      expect(text.termIri).toBe("https://beep-effect.com/ns/patent/text");
      expect(O.getOrThrow(text.description)).toBe("Claim text.");
      expect(children.kind).toBe("datatype");
      pipe(children.reverse, assertTrue);
      expect(children.termIri).toBe("http://www.w3.org/2000/01/rdf-schema#subClassOf");
      expect(claimRef.kind).toBe("object");
      expect(O.getOrThrow(claimRef.rangeIri)).toBe("https://beep-effect.com/ns/patent/Claim");
    })
  );

  it.effect("fails with a typed unresolvedHandle when a field references a schema outside the fold", () =>
    Effect.gen(function* () {
      class External extends S.Opaque<External, { readonly brand: unique symbol }>()(
        S.Struct({
          name: S.String,
        }).pipe($I.annoteSchema("External"))
      ) {}

      class WithExternal extends S.Opaque<WithExternal, { readonly brand: unique symbol }>()(
        S.Struct({
          external: External,
        }).pipe($I.annoteSchema("WithExternal"))
      ) {}

      const error = yield* Effect.flip(
        foldPatent({
          label: "Broken",
          schemas: [WithExternal],
          triples: [],
        })
      );

      expect(error.reason).toBe("unresolvedHandle");
    })
  );

  it.effect("fails with a typed unknownTerm for unknown CURIE prefixes", () =>
    Effect.gen(function* () {
      const badTriple = ["https://beep-effect.com/ns/patent/Claim", "nope:term", "owl:Thing"] as unknown as Triple;
      const error = yield* Effect.flip(
        foldPatent({
          label: "Broken",
          schemas: [Claim],
          triples: [badTriple],
        })
      );

      expect(error.reason).toBe("unknownTerm");
    })
  );
});

describe("Ontology.fold projections", () => {
  it.effect("projects classes, owned predicates and facts, swapping a reverse fact's endpoints", () =>
    Effect.gen(function* () {
      const assembled = yield* assemble;
      const dataset = toDataset(assembled);
      const claim = `${PATENT}Claim`;
      const spec = `${PATENT}Spec`;

      assertTrue(holds(dataset, claim, RDF_TYPE, Rdf.makeNamedNode(`${RDFS}Class`)));
      assertTrue(holds(dataset, claim, `${RDFS}label`, Rdf.makeLiteral("Claim")));
      assertTrue(holds(dataset, claim, `${RDFS}comment`, Rdf.makeLiteral("Patent claim\nwith escaped text.")));
      assertTrue(holds(dataset, claim, `${OWL}sameAs`, Rdf.makeNamedNode("https://schema.org/CreativeWork")));
      assertTrue(holds(dataset, spec, `${RDFS}subClassOf`, Rdf.makeNamedNode(claim)));
      assertFalse(holds(dataset, claim, `${RDFS}subClassOf`, Rdf.makeNamedNode(spec)));
      assertTrue(holds(dataset, `${PATENT}text`, `${RDFS}domain`, Rdf.makeNamedNode(claim)));
      assertTrue(holds(dataset, `${PATENT}text`, `${RDFS}range`, Rdf.makeNamedNode(`${RDFS}Literal`)));
      assertTrue(holds(dataset, `${PATENT}text`, `${RDFS}comment`, Rdf.makeLiteral("Claim text.")));
      assertTrue(holds(dataset, `${PATENT}claim`, `${RDFS}range`, Rdf.makeNamedNode(claim)));
      expect(subjectsTyped(dataset, `${OWL}ObjectProperty`)).toStrictEqual([`${PATENT}claim`]);
      expect(subjectsTyped(dataset, `${OWL}DatatypeProperty`)).toStrictEqual([`${PATENT}label`, `${PATENT}text`]);
      expect(subjectsTyped(dataset, `${RDFS}Class`)).toStrictEqual([
        claim,
        `${PATENT}Classification.models/ClassificationPin`,
        spec,
      ]);
    })
  );

  it.effect("keeps fact subjects that are not assembled classes", () =>
    Effect.gen(function* () {
      const externalSubject = "https://example.test/resources/external";
      const assembled = yield* foldPatent({
        label: "External Subject",
        schemas: [Claim],
        triples: [[externalSubject, "rdfs:seeAlso", Claim]],
      });

      assertTrue(holds(toDataset(assembled), externalSubject, `${RDFS}seeAlso`, Rdf.makeNamedNode(`${PATENT}Claim`)));
    })
  );

  it.effect("merges explicit label and comment facts with class metadata", () =>
    Effect.gen(function* () {
      const assembled = yield* foldPatent({
        label: "Metadata Merge",
        schemas: [Claim],
        triples: [
          [Claim, "rdfs:label", { value: "Authored claim", language: "en" }],
          [Claim, "rdfs:comment", { value: "Authored comment" }],
        ],
      });
      const dataset = toDataset(assembled);
      const claim = `${PATENT}Claim`;

      assertTrue(holds(dataset, claim, `${RDFS}label`, Rdf.makeLiteral("Claim")));
      assertTrue(holds(dataset, claim, `${RDFS}label`, Rdf.Literal.langTagged("Authored claim", "en")));
      assertTrue(holds(dataset, claim, `${RDFS}comment`, Rdf.makeLiteral("Patent claim\nwith escaped text.")));
      assertTrue(holds(dataset, claim, `${RDFS}comment`, Rdf.makeLiteral("Authored comment")));
    })
  );

  it.effect("projects Markdown with anchors, predicate lines, and fact lines", () =>
    Effect.gen(function* () {
      const assembled = yield* assemble;
      const markdown = toMarkdown(assembled);

      pipe(Str.startsWith("# Patent Core")(markdown), assertTrue);
      expect(markdown).toContain("{#beep-effect-com-ns-patent-claim}");
      expect(markdown).toContain("`prefLabel`");
      expect(markdown).toContain("`rdfs:subClassOf`");
      expect(toMarkdown(assembled)).toBe(markdown);
    })
  );
});

describe("Ontology.fold SKOS gate", () => {
  const $Skos = make("beep").$BeepId.create("vocab");
  const foldVocab = foldUnder("beep", "https://beep-effect.com/ns/vocab/");

  class Concept extends S.Opaque<Concept, { readonly brand: unique symbol }>()(
    S.Struct({
      label: S.String,
    })
      .pipe($Skos.annoteSchema("Concept"))
      .annotate($Skos.class("Concept", { description: "A concept.", skos: "concept" }))
  ) {}

  class Scheme extends S.Opaque<Scheme, { readonly brand: unique symbol }>()(
    S.Struct({
      label: S.String,
    })
      .pipe($Skos.annoteSchema("Scheme"))
      .annotate($Skos.class("Scheme", { description: "A scheme.", skos: "conceptScheme" }))
  ) {}

  it.effect("prints literal facts and SKOS warnings in every projection that carries them", () =>
    Effect.gen(function* () {
      const concept = "https://beep-effect.com/ns/vocab/Concept";
      const assembled = yield* foldVocab({
        label: "Literals",
        schemas: [Concept],
        triples: [
          [Concept, "rdfs:comment", { value: "Idea", language: "en" }],
          [Concept, "rdfs:comment", { value: 42, datatype: `${XSD}integer` }],
          [Concept, "rdfs:comment", { value: "loose" }],
        ],
      });
      const markdown = toMarkdown(assembled);
      const dataset = toDataset(assembled);

      expect(markdown).toContain("`Idea`@en");
      expect(markdown).toContain("`42` (`xsd:integer`)");
      expect(markdown).toContain("`loose`");
      expect(markdown).toContain("SKOS: `skos:Concept`");
      expect(markdown).toContain(
        "SKOS concept has no concept\\-scheme membership\\. (<https://beep-effect.com/ns/vocab/Concept>)"
      );
      assertTrue(holds(dataset, concept, `${RDFS}comment`, Rdf.makeLiteral("A concept.")));
      assertTrue(holds(dataset, concept, `${RDFS}comment`, Rdf.Literal.langTagged("Idea", "en")));
      assertTrue(holds(dataset, concept, `${RDFS}comment`, Rdf.Literal.typed("42", `${XSD}integer`)));
      assertTrue(holds(dataset, concept, `${RDFS}comment`, Rdf.makeLiteral("loose")));
    })
  );

  it.effect("types SKOS-marked classes beside rdfs:Class", () =>
    Effect.gen(function* () {
      const assembled = yield* foldVocab({
        label: "Vocab",
        schemas: [Concept, Scheme],
        triples: [
          [Concept, "skos:inScheme", Scheme],
          [Concept, "skos:prefLabel", { value: "Concept", language: "en" }],
        ],
      });
      const dataset = toDataset(assembled);
      const vocab = "https://beep-effect.com/ns/vocab/";

      expect(subjectsTyped(dataset, `${RDFS}Class`)).toStrictEqual([`${vocab}Concept`, `${vocab}Scheme`]);
      expect(subjectsTyped(dataset, `${SKOS}Concept`)).toStrictEqual([`${vocab}Concept`]);
      expect(subjectsTyped(dataset, `${SKOS}ConceptScheme`)).toStrictEqual([`${vocab}Scheme`]);
      expect(assembled.warnings).toEqual([]);
    })
  );

  it.effect("fails on duplicate preferred labels for one language", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        foldVocab({
          label: "Broken",
          schemas: [Concept],
          triples: [
            [Concept, "skos:prefLabel", { value: "Concept", language: "en" }],
            [Concept, "skos:prefLabel", { value: "Idea", language: "en" }],
          ],
        })
      );

      expect(error.reason).toBe("skosIntegrity");
    })
  );

  it.effect("rejects a broader/narrower cycle with a typed failure naming both IRIs", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        foldVocab({
          label: "Broken",
          schemas: [Concept, Scheme],
          triples: [
            [Concept, "skos:broader", Scheme],
            [Scheme, "skos:broader", Concept],
          ],
        })
      );

      expect(error.reason).toBe("skosIntegrity");
      expect(pipe([O.getOrThrow(error.subjectIri), O.getOrThrow(error.objectIri)], A.sort(Order.String))).toEqual([
        "https://beep-effect.com/ns/vocab/Concept",
        "https://beep-effect.com/ns/vocab/Scheme",
      ]);
    })
  );

  it.effect("rejects a transitive broader cycle spanning three concepts", () =>
    Effect.gen(function* () {
      class Third extends S.Opaque<Third, { readonly brand: unique symbol }>()(
        S.Struct({
          label: S.String,
        })
          .pipe($Skos.annoteSchema("Third"))
          .annotate($Skos.class("Third", { description: "A third concept.", skos: "concept" }))
      ) {}

      const error = yield* Effect.flip(
        foldVocab({
          label: "Broken",
          schemas: [Concept, Scheme, Third],
          triples: [
            [Concept, "skos:broader", Scheme],
            [Scheme, "skos:broader", Third],
            [Third, "skos:broader", Concept],
          ],
        })
      );

      expect(error.reason).toBe("skosIntegrity");
      pipe(error.subjectIri, O.isSome, assertTrue);
      pipe(error.objectIri, O.isSome, assertTrue);
    })
  );

  it.effect("normalizes narrower edges into the broader digraph for cycle detection", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        foldVocab({
          label: "Broken",
          schemas: [Concept, Scheme],
          triples: [
            [Concept, "skos:broader", Scheme],
            [Concept, "skos:narrower", Scheme],
          ],
        })
      );

      expect(error.reason).toBe("skosIntegrity");
    })
  );

  it.effect("rejects reverse predicates with literal objects at the gate", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        foldVocab({
          label: "Broken",
          schemas: [Concept],
          triples: [[Concept, "^rdfs:subClassOf", { value: "not a subject" }]],
        })
      );

      expect(error.reason).toBe("invalidTriple");
      expect(O.getOrThrow(error.term)).toBe("^rdfs:subClassOf");
    })
  );

  it.effect("keeps scheme-membership gaps observable as warnings without failing", () =>
    Effect.gen(function* () {
      const assembled = yield* foldVocab({
        label: "Vocab",
        schemas: [Concept],
        triples: [[Concept, "skos:prefLabel", { value: "Concept", language: "en" }]],
      });

      expect(A.map(assembled.warnings, (warning) => warning.code)).toEqual(["missingConceptScheme"]);
    })
  );

  it.effect("applies SKOS gates to the semantic direction of reverse facts", () =>
    Effect.gen(function* () {
      const assembled = yield* foldVocab({
        label: "Vocab",
        schemas: [Concept, Scheme],
        triples: [
          [Scheme, "^skos:inScheme", Concept],
          [Concept, "skos:prefLabel", { value: "Concept", language: "en" }],
        ],
      });

      expect(assembled.warnings).toEqual([]);
    })
  );
});

describe("Ontology.fold negative fixtures", () => {
  const $Neg = make("beep").$BeepId.create("negative");
  const foldNegative = foldUnder("beep", "https://beep-effect.com/ns/negative/");

  class LeftDocument extends S.Opaque<LeftDocument, { readonly brand: unique symbol }>()(
    S.Struct({
      label: S.String,
    })
      .pipe($Neg.annoteSchema("LeftDocument"))
      .annotate($Neg.class("LeftDocument", { description: "Document" }))
  ) {}

  class RightDocument extends S.Opaque<RightDocument, { readonly brand: unique symbol }>()(
    S.Struct({
      label: S.String,
    })
      .pipe($Neg.annoteSchema("RightDocument"))
      .annotate($Neg.class("RightDocument", { description: "Document" }))
  ) {}

  it.effect("keeps equal-label distinct resources unfolded: no identity edge is synthesized", () =>
    Effect.gen(function* () {
      const assembled = yield* foldNegative({
        label: "Equal Labels",
        schemas: [LeftDocument, RightDocument],
        triples: [],
      });

      expect(assembled.classes).toHaveLength(2);
      expect(assembled.facts).toHaveLength(0);
      expect(pipe(findClass(assembled.classes, "LeftDocument"), O.getOrThrow).iri).not.toBe(
        pipe(findClass(assembled.classes, "RightDocument"), O.getOrThrow).iri
      );
    })
  );

  it.effect("refuses to resolve an ambiguous bare mention by resemblance", () =>
    Effect.gen(function* () {
      const mention = ["LeftDocument", "rdfs:seeAlso", "owl:Thing"] as unknown as Triple;
      const error = yield* Effect.flip(
        foldNegative({
          label: "Ambiguous",
          schemas: [LeftDocument, RightDocument],
          triples: [mention],
        })
      );

      expect(error.reason).toBe("unknownTerm");
      expect(O.getOrThrow(error.term)).toBe("LeftDocument");
    })
  );

  it.effect("accepts non-HTTP absolute IRI schemes at tuple endpoints", () =>
    Effect.gen(function* () {
      const assembled = yield* foldNegative({
        label: "URN Endpoint",
        schemas: [LeftDocument],
        triples: [[LeftDocument, "rdfs:seeAlso", "urn:isbn:9780140328721"]],
      });

      expect(assembled.facts[0]?.object).toBe("urn:isbn:9780140328721");
    })
  );

  it.effect("rejects a field union with multiple class ranges", () =>
    Effect.gen(function* () {
      class AmbiguousRange extends S.Opaque<AmbiguousRange, { readonly brand: unique symbol }>()(
        S.Struct({
          document: S.Union([LeftDocument, RightDocument]),
        })
          .pipe($Neg.annoteSchema("AmbiguousRange"))
          .annotate($Neg.class("AmbiguousRange"))
      ) {}

      const error = yield* Effect.flip(
        foldNegative({
          label: "Ambiguous Range",
          schemas: [LeftDocument, RightDocument, AmbiguousRange],
          triples: [],
        })
      );

      expect(error.reason).toBe("unsupportedFieldAst");
      expect(O.getOrThrow(error.field)).toBe("document");
    })
  );

  it.effect("refuses a language tag on a datatype other than rdf:langString", () =>
    Effect.gen(function* () {
      const invalid = [
        LeftDocument,
        "rdfs:label",
        { value: "Document", datatype: "xsd:string", language: "en" },
      ] as unknown as Triple;
      const error = yield* Effect.flip(
        foldNegative({
          label: "Invalid Literal",
          schemas: [LeftDocument],
          triples: [invalid],
        })
      );

      expect(error.reason).toBe("invalidLiteral");
    })
  );

  it.effect("rejects language tags containing Turtle syntax", () =>
    Effect.gen(function* () {
      const injected = [
        LeftDocument,
        "rdfs:label",
        { value: "Document", language: 'en" . <https://attacker.example/s> <https://attacker.example/p> "x' },
      ] as unknown as Triple;
      const error = yield* Effect.flip(
        foldNegative({
          label: "Invalid Language Tag",
          schemas: [LeftDocument],
          triples: [injected],
        })
      );

      expect(error.reason).toBe("invalidLiteral");
    })
  );

  it.effect("rejects empty ontology labels with a typed error", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        foldNegative({
          label: "",
          schemas: [LeftDocument],
          triples: [],
        })
      );

      expect(error.reason).toBe("invalidLabel");
    })
  );

  it.effect("refuses a namespace the registry does not declare", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        foldWith(registryFor("beep", "https://beep-effect.com/ns/negative/", []))("missing", {
          label: "Missing",
          schemas: [],
          triples: [],
        })
      );

      expect(error.reason).toBe("unknownTerm");
      expect(O.getOrThrow(error.term)).toBe("missing");
    })
  );

  it.effect("refuses a schema whose code identity has no registry binding", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        foldWith(registryFor("beep", "https://beep-effect.com/ns/negative/", [LeftDocument]))("beep", {
          label: "Unbound",
          schemas: [LeftDocument, RightDocument],
          triples: [],
        })
      );

      expect(error.reason).toBe("unboundClass");
      expect(O.getOrThrow(error.identifier)).toBe("@beep/negative/RightDocument");
    })
  );

  it.effect("refuses an owned field that is not a declared term of the namespace", () =>
    Effect.gen(function* () {
      const bindsOnly = decodeShard({
        namespace: { prefix: "beep", iri: "https://beep-effect.com/ns/negative/" },
        terms: ["LeftDocument"],
        bindings: [{ code: "@beep/negative/LeftDocument", local: "LeftDocument", since: "1.0.0" }],
        deprecations: [],
      });
      const registry = RegistryTable.fromShards([...externalShards, bindsOnly]).pipe(Result.getOrThrow, view);
      const error = yield* Effect.flip(
        foldWith(registry)("beep", { label: "Undeclared", schemas: [LeftDocument], triples: [] })
      );

      expect(error.reason).toBe("undeclaredProperty");
      expect(O.getOrThrow(error.field)).toBe("label");
    })
  );

  it.effect("refuses a registry that binds a core prefix to another namespace", () =>
    Effect.gen(function* () {
      const custom = "https://example.test/custom/";
      const rebound = (prefix: string, owned: string) =>
        foldWith(
          view(
            Result.getOrThrow(
              RegistryTable.fromShards([
                decodeShard({ namespace: { prefix, iri: custom }, terms: [], bindings: [], deprecations: [] }),
                decodeShard({
                  namespace: { prefix: "patent", iri: "https://example.test/patent/" },
                  terms: [],
                  bindings: [],
                  deprecations: [],
                }),
              ])
            )
          )
        )(owned, { label: "Rebound", schemas: [], triples: [] });

      for (const owned of ["skos", "patent"]) {
        const error = yield* Effect.flip(rebound("skos", owned));
        expect(error.reason, "The rebound prefix is refused whether it owns the fold or only lends terms to it.").toBe(
          "reservedPrefix"
        );
        assertSome(error.term, "skos");
        expect(error.message).toContain(custom);
      }
      for (const prefix of ["dcterms", "owl", "rdf", "rdfs"]) {
        expect((yield* Effect.flip(rebound(prefix, "patent"))).reason).toBe("reservedPrefix");
      }
      expect(
        (yield* rebound("ex", "patent")).prefix,
        "A registry may leave the core prefixes out, or bind them to the core namespaces."
      ).toBe("patent");
      expect((yield* assemble).prefix).toBe("beep");
    })
  );

  it.effect("folds an ontology owned by a core namespace under that namespace", () =>
    Effect.gen(function* () {
      const assembled = yield* foldWith(registryFor("ex", "https://example.test/ns#", []))("skos", {
        label: "SKOS",
        schemas: [],
        triples: [["skos:Concept", "rdfs:seeAlso", "skos:ConceptScheme"]],
      });

      expect(assembled.baseIri).toBe(SKOS);
      assertTrue(
        holds(toDataset(assembled), `${SKOS}Concept`, `${RDFS}seeAlso`, Rdf.makeNamedNode(`${SKOS}ConceptScheme`))
      );
    })
  );

  it("refuses an assembled ontology whose core prefix or base IRI its projections could not print", () => {
    const decode = S.decodeUnknownResult(AssembledOntology);
    const assembled = (prefix: string, baseIri: string) =>
      Result.isSuccess(decode({ label: "Decoded", baseIri, prefix, classes: [], facts: [], warnings: [] }));

    assertTrue(assembled("patent", "https://example.test/patent/"));
    assertTrue(assembled("skos", "http://www.w3.org/2004/02/skos/core#"));
    assertFalse(assembled("skos", "https://example.test/custom/"));
    assertFalse(assembled("patent", "https://example.test/patent"));
  });

  it.effect("labels Markdown IRIs with the owned prefix only under the owned namespace", () =>
    Effect.gen(function* () {
      const provShard = decodeShard({
        namespace: { prefix: "prov", iri: "https://example.test/prov/" },
        terms: ["Entry"],
        bindings: [],
        deprecations: [],
      });
      const registry = RegistryTable.fromShards([
        provShard,
        ...A.filter(externalShards, (row) => row.namespace.prefix === "rdfs"),
      ]).pipe(Result.getOrThrow, view);
      const assembled = yield* foldWith(registry)("prov", {
        label: "Rebound",
        schemas: [],
        triples: [["https://example.test/prov/Entry", "rdfs:seeAlso", "http://www.w3.org/ns/prov#Activity"]],
      });
      const markdown = toMarkdown(assembled);

      expect(markdown).toContain("[prov:Entry](");
      expect(markdown).not.toContain("prov:Activity");
      expect(markdown).toContain("`rdfs:seeAlso`");
    })
  );

  it.effect("projects an equal dataset and identical Markdown across repeated assembly", () =>
    Effect.gen(function* () {
      const first = yield* assemble;
      const second = yield* assemble;

      assertTrue(Equal.equals(toDataset(first), toDataset(second)));
      expect(toMarkdown(first)).toBe(toMarkdown(second));
    })
  );
});

describe("Ontology.fold hash namespace", () => {
  it.effect("folds a hash-namespace vocabulary and labels it with its prefix in Markdown", () =>
    Effect.gen(function* () {
      const $Patent = make("beep").$BeepId.create("ontology").create("patent");

      class PublishedClaim extends S.Opaque<PublishedClaim, { readonly brand: unique symbol }>()(
        S.Struct({
          text: S.String,
        })
          .pipe($Patent.annoteSchema("PublishedClaim"))
          .annotate($Patent.class("PublishedClaim", { description: "A published claim." }))
      ) {}

      const assembled = yield* foldUnder(
        "patent",
        "https://opip.law/ns/patent#"
      )({
        label: "Published Patent Vocabulary",
        schemas: [PublishedClaim],
        triples: [[PublishedClaim, "rdfs:subClassOf", "owl:Thing"]],
      });

      expect(assembled.baseIri).toBe("https://opip.law/ns/patent#");
      expect(assembled.prefix).toBe("patent");
      assertTrue(
        holds(
          toDataset(assembled),
          "https://opip.law/ns/patent#PublishedClaim",
          `${RDFS}subClassOf`,
          Rdf.makeNamedNode(`${OWL}Thing`)
        )
      );
      expect(toMarkdown(assembled)).toContain("[patent:PublishedClaim](");
    })
  );
});

describe("Ontology.fold extended vocabulary", () => {
  it.effect("resolves borrowed field terms from the fold's registry", () =>
    Effect.gen(function* () {
      const ex = decodeShard({
        namespace: { prefix: "ex", iri: "https://example.test/ns#" },
        terms: ["relation"],
        bindings: [],
        deprecations: [],
      });
      const $Custom = make("beep").$BeepId.create("custom");

      class CustomClass extends S.Opaque<CustomClass, { readonly brand: unique symbol }>()(
        S.Struct({
          relation: S.String.pipe(S.annotateKey({ ontologyTerm: "ex:relation" })),
        })
          .pipe($Custom.annoteSchema("CustomClass"))
          .annotate($Custom.class("CustomClass"))
      ) {}

      const registry = registryFor("custom", "https://example.test/ontology/", [CustomClass], [ex]);
      const assembled = yield* foldWith(registry)("custom", {
        label: "Custom Vocabulary",
        schemas: [CustomClass],
        triples: [],
      });
      const assembledClass = pipe(findClass(assembled.classes, "CustomClass"), O.getOrThrow);

      expect(pipe(findPredicate(assembledClass, "relation"), O.getOrThrow).termIri).toBe(
        "https://example.test/ns#relation"
      );
    })
  );
});

class FoldedConcept extends S.Opaque<FoldedConcept, { readonly brand: unique symbol }>()(
  S.Struct({
    iri: S.NonEmptyString,
    label: S.String.pipe(
      S.OptionFromOptionalNullOr,
      S.withConstructorDefault(Effect.succeedNone),
      $I.key({ term: "rdfs:label", title: "Label" })
    ),
    sub_class_of: S.NonEmptyString.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      $I.key({ term: "rdfs:subClassOf", title: "Sub Class Of" })
    ),
    parent_class_of: S.NonEmptyString.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      $I.key({ term: "^rdfs:subClassOf", title: "Parent Class Of" })
    ),
  }).pipe($I.annoteSchema("FoldedConcept", { description: "Test-declared class with forward and reverse keys." }))
) {}

describe("Ontology.fold of a class with forward and reverse keys", () => {
  it.effect("projects a test-declared class to an equal dataset and identical Markdown", () =>
    Effect.gen(function* () {
      const input = {
        label: "Folded Concept Vocabulary",
        schemas: [FoldedConcept],
        triples: [[FoldedConcept, "rdfs:seeAlso", "https://example.test/concepts"]],
      } satisfies OntologyFoldInput;

      const assembled = yield* foldPatent(input);
      const second = yield* foldPatent(input);

      assertTrue(Equal.equals(toDataset(assembled), toDataset(second)));
      expect(toMarkdown(assembled)).toBe(toMarkdown(second));

      const conceptClass = O.getOrThrow(A.head(assembled.classes));
      expect(conceptClass.iri).toBe("https://beep-effect.com/ns/patent/FoldedConcept");
      const predicate = (key: string) =>
        O.getOrThrow(A.findFirst(conceptClass.predicates, (candidate) => candidate.key === key));
      const subClassOf = predicate("sub_class_of");
      const parentClassOf = predicate("parent_class_of");
      strictEqual(subClassOf.termIri, "http://www.w3.org/2000/01/rdf-schema#subClassOf");
      strictEqual(subClassOf.reverse, false);
      strictEqual(parentClassOf.termIri, "http://www.w3.org/2000/01/rdf-schema#subClassOf");
      strictEqual(parentClassOf.reverse, true);
    })
  );
});
