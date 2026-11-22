import { make } from "@beep/identity";
import { IdentityAuthority } from "@beep/identity/Authority";
import { IRI } from "@beep/identity/Iri";
import { RegistryVocab, view } from "@beep/identity/Registry";
import { RegistryShard, RegistryTable } from "@beep/identity/Term";
import { foldWith, toContext, toJsonLd, toMarkdown, toTurtle } from "@beep/ontology";
import { AssembledOntology, FactLiteral } from "@beep/ontology/Fold.models";
import { OWLClass } from "@beep/ontology/Ontology.models";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertSome, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";
import type { AssembledClass, AssembledPredicate, OntologyFoldInput, Triple } from "@beep/ontology";

const decodeShard = flow(S.decodeResult(RegistryShard), Result.getOrThrow);
const ascending = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(A.dedupe(values), Order.String);

// Every generated namespace with its terms and no bindings, so borrowed CURIEs resolve as in production.
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

// A fixture registry: the generated namespaces, plus an owned namespace that binds every given
// schema to its title and declares every field key, plus any extra shards.
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
  }).pipe($I.annoteSchema("Ontology.models/HttpUrl", { description: "Unsafe local." }))
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

describe("Ontology.fold", () => {
  it.effect("resolves an explicit literal datatype without losing its value", () =>
    Effect.gen(function* () {
      const assembled = yield* foldPatent({
        label: "Typed literal",
        schemas: [Claim],
        triples: [[Claim, "rdfs:label", { value: 42, datatype: "http://www.w3.org/2001/XMLSchema#integer" }]],
      });
      const fact = O.getOrThrow(A.head(assembled.facts));
      assertTrue(S.is(FactLiteral)(fact.object));
      expect(fact.object).toMatchObject({ value: 42 });
      assertSome(fact.object.datatypeIri, IRI.make("http://www.w3.org/2001/XMLSchema#integer"));
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
  it.effect("projects JSON-LD context terms from class and predicate annotations", () =>
    Effect.gen(function* () {
      const assemble1 = yield* assemble;
      const context = toContext(assemble1);

      expect(context.prefLabel).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
      expect(context.children).toEqual({ "@reverse": "http://www.w3.org/2000/01/rdf-schema#subClassOf" });
      expect(context.claim).toMatchObject({ "@type": "@id" });
    })
  );

  it.effect("projects bounded JSON-LD graph nodes and reverse facts", () =>
    Effect.gen(function* () {
      const assemble2 = yield* assemble;
      const jsonLd = toJsonLd(assemble2);
      const claimNode = pipe(
        jsonLd["@graph"],
        A.findFirst((node) => node["@id"] === "https://beep-effect.com/ns/patent/Claim"),
        O.getOrUndefined
      );

      expect(claimNode).toMatchObject({
        "@id": "https://beep-effect.com/ns/patent/Claim",
        "owl:sameAs": [{ "@id": "https://schema.org/CreativeWork" }],
        "@reverse": {
          "rdfs:subClassOf": [{ "@id": "https://beep-effect.com/ns/patent/Spec" }],
        },
      });
    })
  );

  it.effect("preserves fact subjects that are not assembled classes in JSON-LD", () =>
    Effect.gen(function* () {
      const externalSubject = "https://example.test/resources/external";
      const assembled = yield* foldPatent({
        label: "External Subject",
        schemas: [Claim],
        triples: [[externalSubject, "rdfs:seeAlso", Claim]],
      });
      const externalNode = pipe(
        toJsonLd(assembled)["@graph"],
        A.findFirst((node) => node["@id"] === externalSubject),
        O.getOrUndefined
      );

      expect(externalNode).toMatchObject({
        "@id": externalSubject,
        "rdfs:seeAlso": [{ "@id": "https://beep-effect.com/ns/patent/Claim" }],
      });
    })
  );

  it.effect("does not redefine borrowed predicates as owned properties", () =>
    Effect.gen(function* () {
      const assembled = yield* assemble;
      const jsonLd = toJsonLd(assembled);
      const turtle = toTurtle(assembled);

      pipe(
        A.some(
          jsonLd["@graph"],
          (node) => node["@id"] === "http://www.w3.org/2004/02/skos/core#prefLabel" && node["@type"] !== undefined
        ),
        assertFalse
      );
      expect(turtle).not.toContain("skos:prefLabel a owl:DatatypeProperty");
      expect(turtle).not.toContain("rdfs:subClassOf a owl:DatatypeProperty");
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
      const claimNode = pipe(
        toJsonLd(assembled)["@graph"],
        A.findFirst((node) => node["@id"] === "https://beep-effect.com/ns/patent/Claim"),
        O.getOrUndefined
      );

      expect(claimNode?.["rdfs:label"]).toEqual(["Claim", { "@value": "Authored claim", "@language": "en" }]);
      expect(claimNode?.["rdfs:comment"]).toEqual([
        "Patent claim\nwith escaped text.",
        { "@value": "Authored comment" },
      ]);
    })
  );

  it.effect("projects deterministic Turtle with safe prefix fallback and escaped literals", () =>
    Effect.gen(function* () {
      const first = yield* assemble;
      const second = yield* assemble;
      const turtle = toTurtle(first);

      expect(turtle).toContain("@prefix beep: <https://beep-effect.com/ns/patent/> .");
      expect(turtle).toContain("a rdfs:Class");
      expect(turtle).toContain("beep:Claim owl:sameAs <https://schema.org/CreativeWork> .");
      expect(turtle).toContain("<https://beep-effect.com/ns/patent/Ontology.models/HttpUrl> a rdfs:Class");
      expect(turtle).toContain('rdfs:comment "Patent claim\\nwith escaped text."');
      expect(toTurtle(first)).toBe(toTurtle(first));
      expect(toTurtle(first)).toBe(toTurtle(second));
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
      const integer = "http://www.w3.org/2001/XMLSchema#integer";
      const assembled = yield* foldVocab({
        label: "Literals",
        schemas: [Concept],
        triples: [
          [Concept, "rdfs:comment", { value: "Idea", language: "en" }],
          [Concept, "rdfs:comment", { value: 42, datatype: integer }],
          [Concept, "rdfs:comment", { value: true }],
        ],
      });
      const markdown = toMarkdown(assembled);
      const turtle = toTurtle(assembled);
      const concept = pipe(
        toJsonLd(assembled)["@graph"],
        A.findFirst((node) => node["@id"] === "https://beep-effect.com/ns/vocab/Concept"),
        O.getOrThrow
      );

      expect(markdown).toContain("`Idea`@en");
      expect(markdown).toContain("`42` (`xsd:integer`)");
      expect(markdown).toContain("`true`");
      expect(markdown).toContain("SKOS: `skos:Concept`");
      expect(markdown).toContain(
        "SKOS concept has no concept\\-scheme membership\\. (<https://beep-effect.com/ns/vocab/Concept>)"
      );
      expect(turtle).toContain('rdfs:comment "Idea"@en');
      expect(turtle).toContain(`rdfs:comment "42"^^<${integer}>`);
      expect(turtle).toContain("rdfs:comment true");
      expect(concept["rdfs:comment"]).toStrictEqual([
        "A concept.",
        { "@value": "Idea", "@language": "en" },
        { "@value": 42, "@type": integer },
        { "@value": true },
      ]);
    })
  );

  it.effect("emits SKOS classification beside rdfs:Class in JSON-LD and Turtle", () =>
    Effect.gen(function* () {
      const assembled = yield* foldVocab({
        label: "Vocab",
        schemas: [Concept, Scheme],
        triples: [
          [Concept, "skos:inScheme", Scheme],
          [Concept, "skos:prefLabel", { value: "Concept", language: "en" }],
        ],
      });
      const jsonLd = toJsonLd(assembled);
      const conceptNode = pipe(
        jsonLd["@graph"],
        A.findFirst((node) => node["@id"] === "https://beep-effect.com/ns/vocab/Concept"),
        O.getOrUndefined
      );
      const turtle = toTurtle(assembled);

      expect(conceptNode?.["@type"]).toEqual(["rdfs:Class", "skos:Concept"]);
      expect(turtle).toContain("a rdfs:Class, skos:Concept");
      expect(turtle).toContain("a rdfs:Class, skos:ConceptScheme");
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

  it.effect("rejects typed literals carrying both a datatype and a language", () =>
    Effect.gen(function* () {
      const invalid = [
        LeftDocument,
        "rdfs:label",
        { value: "Document", datatype: "rdf:langString", language: "en" },
      ] as unknown as Triple;
      const error = yield* Effect.flip(
        foldNegative({
          label: "Invalid Literal",
          schemas: [LeftDocument],
          triples: [invalid],
        })
      );

      expect(error.reason).toBe("invalidTriple");
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

      expect(error.reason).toBe("invalidTriple");
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

      // The rebound prefix is refused whether it owns the fold or only lends terms to it.
      for (const owned of ["skos", "patent"]) {
        const error = yield* Effect.flip(rebound("skos", owned));
        expect(error.reason).toBe("reservedPrefix");
        assertSome(error.term, "skos");
        expect(error.message).toContain(custom);
      }
      for (const prefix of ["dcterms", "owl", "rdf", "rdfs"]) {
        expect((yield* Effect.flip(rebound(prefix, "patent"))).reason).toBe("reservedPrefix");
      }
      // A registry may leave the core prefixes out, or bind them to the core namespaces.
      expect((yield* rebound("ex", "patent")).prefix).toBe("patent");
      expect((yield* assemble).prefix).toBe("beep");
    })
  );

  it.effect("folds an ontology owned by a core namespace, declaring its prefix once", () =>
    Effect.gen(function* () {
      const assembled = yield* foldWith(registryFor("ex", "https://example.test/ns#", []))("skos", {
        label: "SKOS",
        schemas: [],
        triples: [["skos:Concept", "rdfs:seeAlso", "skos:ConceptScheme"]],
      });

      expect(toContext(assembled).skos).toStrictEqual({
        "@id": "http://www.w3.org/2004/02/skos/core#",
        "@prefix": true,
      });
      expect(A.filter(Str.split("\n")(toTurtle(assembled)), Str.startsWith("@prefix skos:"))).toStrictEqual([
        "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
      ]);
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

  it.effect("is byte-identical across repeated assembly and every projection", () =>
    Effect.gen(function* () {
      const first = yield* assemble;
      const second = yield* assemble;

      expect(toJsonLd(first)).toEqual(toJsonLd(second));
      expect(toContext(first)).toEqual(toContext(second));
      expect(toTurtle(first)).toBe(toTurtle(second));
      expect(toMarkdown(first)).toBe(toMarkdown(second));
    })
  );
});

describe("Ontology.fold hash namespace", () => {
  it.effect("renders a hash-namespace vocabulary with prefixed names in every projection", () =>
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
      const turtle = toTurtle(assembled);
      const context = toContext(assembled);

      expect(assembled.baseIri).toBe("https://opip.law/ns/patent#");
      expect(assembled.prefix).toBe("patent");
      expect(turtle).toContain("@prefix patent: <https://opip.law/ns/patent#");
      expect(turtle).toContain("patent:");
      expect(context.patent).toMatchObject({ "@prefix": true });
      expect(toMarkdown(assembled)).toContain("[patent:PublishedClaim](");
      expect(toTurtle(assembled)).toBe(toTurtle(assembled));
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

describe("Ontology.fold FOLIO-derived module", () => {
  it.effect("renders the migrated OWLClass module through all four projections byte-identically", () =>
    Effect.gen(function* () {
      const foldFolio = foldUnder("folio", `${IdentityAuthority}ontology/Ontology.models/`);
      const input = {
        label: "FOLIO Class Vocabulary",
        schemas: [OWLClass],
        triples: [[OWLClass, "rdfs:seeAlso", "https://folio.openlegalstandard.org/"]],
      } satisfies OntologyFoldInput;

      const assembled = yield* foldFolio(input);
      const second = yield* foldFolio(input);

      expect(toJsonLd(assembled)).toEqual(toJsonLd(second));
      expect(toTurtle(assembled)).toBe(toTurtle(second));
      expect(toMarkdown(assembled)).toBe(toMarkdown(second));
      expect(toContext(assembled)).toEqual(toContext(second));

      const claimClass = O.getOrThrow(A.head(assembled.classes));
      expect(claimClass.iri).toBe("https://beep-effect.com/ns/ontology/Ontology.models/OWLClass");
      const predicate = (key: string) =>
        O.getOrThrow(A.findFirst(claimClass.predicates, (candidate) => candidate.key === key));
      const subClassOf = predicate("sub_class_of");
      const parentClassOf = predicate("parent_class_of");
      strictEqual(subClassOf.termIri, "http://www.w3.org/2000/01/rdf-schema#subClassOf");
      strictEqual(subClassOf.reverse, false);
      strictEqual(parentClassOf.termIri, "http://www.w3.org/2000/01/rdf-schema#subClassOf");
      strictEqual(parentClassOf.reverse, true);
    })
  );
});
