import { make } from "@beep/identity";
import { fold, toContext, toJsonLd, toMarkdown, toTurtle } from "@beep/ontology";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import type { AssembledClass, AssembledPredicate, Triple } from "@beep/ontology";

const $I = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.create("patent");

class Claim extends S.Class<Claim>($I`Claim`)(
  {
    prefLabel: S.String.pipe($I.key("skos:prefLabel")),
    children: S.Array(S.String).pipe($I.key("^rdfs:subClassOf")),
    text: S.String.pipe($I.key({ description: "Claim text." })),
  },
  $I.class("Claim", { description: "Patent claim\nwith escaped text." })
) {}

class Spec extends S.Class<Spec>($I`Spec`)(
  {
    claim: Claim,
  },
  $I.class("Spec", { description: "Patent specification." })
) {}

class UnsafeLocal extends S.Class<UnsafeLocal>($I.make("Ontology.models/HttpUrl"))(
  {
    label: S.String,
  },
  $I.annote("Ontology.models/HttpUrl", { description: "Unsafe local." })
) {}

const triples = [
  [Claim, "rdfs:subClassOf", "owl:Thing"],
  [Claim, "owl:sameAs", "https://schema.org/CreativeWork"],
  [Spec, "skos:related", Claim],
  [Claim, "^rdfs:subClassOf", Spec],
] satisfies ReadonlyArray<Triple>;

const assemble = () =>
  Effect.runPromise(
    fold($I, {
      label: "Patent Core",
      schemas: [Claim, Spec, UnsafeLocal],
      triples,
    })
  );

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
  it("resolves class IRIs and tuple facts through schema identity annotations", async () => {
    const assembled = await assemble();
    const claim = pipe(findClass(assembled.classes, "Claim"), O.getOrThrow);
    const spec = pipe(findClass(assembled.classes, "Spec"), O.getOrThrow);

    expect(claim.iri).toBe("https://ns.beep.sh/patent/Claim");
    expect(spec.iri).toBe("https://ns.beep.sh/patent/Spec");
    expect(assembled.facts.map((fact) => [fact.subjectIri, fact.predicateIri, fact.object, fact.reverse])).toEqual([
      [
        "https://ns.beep.sh/patent/Claim",
        "http://www.w3.org/2000/01/rdf-schema#subClassOf",
        "http://www.w3.org/2002/07/owl#Thing",
        false,
      ],
      [
        "https://ns.beep.sh/patent/Claim",
        "http://www.w3.org/2002/07/owl#sameAs",
        "https://schema.org/CreativeWork",
        false,
      ],
      [
        "https://ns.beep.sh/patent/Spec",
        "http://www.w3.org/2004/02/skos/core#related",
        "https://ns.beep.sh/patent/Claim",
        false,
      ],
      [
        "https://ns.beep.sh/patent/Claim",
        "http://www.w3.org/2000/01/rdf-schema#subClassOf",
        "https://ns.beep.sh/patent/Spec",
        true,
      ],
    ]);
  });

  it("defaults field predicate names to struct keys and infers datatype/object kinds", async () => {
    const assembled = await assemble();
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
    expect(text.termIri).toBe("https://ns.beep.sh/patent/text");
    expect(O.getOrThrow(text.description)).toBe("Claim text.");
    expect(children.kind).toBe("datatype");
    expect(children.reverse).toBe(true);
    expect(children.termIri).toBe("http://www.w3.org/2000/01/rdf-schema#subClassOf");
    expect(claimRef.kind).toBe("object");
    expect(O.getOrThrow(claimRef.rangeIri)).toBe("https://ns.beep.sh/patent/Claim");
  });

  it("fails with a typed unresolvedHandle when a field references a schema outside the fold", async () => {
    class External extends S.Class<External>($I`External`)(
      {
        name: S.String,
      },
      $I.annote("External")
    ) {}

    class WithExternal extends S.Class<WithExternal>($I`WithExternal`)(
      {
        external: External,
      },
      $I.annote("WithExternal")
    ) {}

    await expect(
      Effect.runPromise(
        fold($I, {
          label: "Broken",
          schemas: [WithExternal],
          triples: [],
        })
      )
    ).rejects.toMatchObject({ reason: "unresolvedHandle" });
  });

  it("fails with a typed unknownTerm for unknown CURIE prefixes", async () => {
    const badTriple = [Claim, "nope:term", "owl:Thing"] as unknown as Triple;

    await expect(
      Effect.runPromise(
        fold($I, {
          label: "Broken",
          schemas: [Claim],
          triples: [badTriple],
        })
      )
    ).rejects.toMatchObject({ reason: "unknownTerm" });
  });
});

describe("Ontology.fold projections", () => {
  it("projects JSON-LD context terms from class and predicate annotations", async () => {
    const context = toContext(await assemble());

    expect(context.prefLabel).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
    expect(context.children).toEqual({ "@reverse": "http://www.w3.org/2000/01/rdf-schema#subClassOf" });
    expect(context.claim).toMatchObject({ "@type": "@id" });
  });

  it("projects bounded JSON-LD graph nodes and reverse facts", async () => {
    const jsonLd = toJsonLd(await assemble());
    const claimNode = jsonLd["@graph"].find((node) => node["@id"] === "https://ns.beep.sh/patent/Claim");

    expect(claimNode).toMatchObject({
      "@id": "https://ns.beep.sh/patent/Claim",
      "owl:sameAs": [{ "@id": "https://schema.org/CreativeWork" }],
      "@reverse": {
        "rdfs:subClassOf": [{ "@id": "https://ns.beep.sh/patent/Spec" }],
      },
    });
  });

  it("projects deterministic Turtle with safe prefix fallback and escaped literals", async () => {
    const first = await assemble();
    const second = await assemble();
    const turtle = toTurtle(first);

    expect(turtle).toContain("@prefix beep: <https://ns.beep.sh/patent/> .");
    expect(turtle).toContain("a rdfs:Class");
    expect(turtle).toContain("beep:Claim owl:sameAs <https://schema.org/CreativeWork> .");
    expect(turtle).toContain("<https://ns.beep.sh/patent/Ontology.models/HttpUrl> a rdfs:Class");
    expect(turtle).toContain('rdfs:comment "Patent claim\\nwith escaped text."');
    expect(toTurtle(first)).toBe(toTurtle(first));
    expect(toTurtle(first)).toBe(toTurtle(second));
  });

  it("projects Markdown with anchors, predicate lines, and fact lines", async () => {
    const markdown = toMarkdown(await assemble());

    expect(markdown.startsWith("# Patent Core")).toBe(true);
    expect(markdown).toContain("{#ns-beep-sh-patent-claim}");
    expect(markdown).toContain("`prefLabel`");
    expect(markdown).toContain("`rdfs:subClassOf`");
    expect(toMarkdown(await assemble())).toBe(markdown);
  });
});

describe("Ontology.fold SKOS gate", () => {
  const $Skos = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.create("vocab");

  class Concept extends S.Class<Concept>($Skos`Concept`)(
    {
      label: S.String,
    },
    $Skos.class("Concept", { description: "A concept.", skos: "concept" })
  ) {}

  class Scheme extends S.Class<Scheme>($Skos`Scheme`)(
    {
      label: S.String,
    },
    $Skos.class("Scheme", { description: "A scheme.", skos: "conceptScheme" })
  ) {}

  it("emits SKOS classification beside rdfs:Class in JSON-LD and Turtle", async () => {
    const assembled = await Effect.runPromise(
      fold($Skos, {
        label: "Vocab",
        schemas: [Concept, Scheme],
        triples: [
          [Concept, "skos:inScheme", Scheme],
          [Concept, "skos:prefLabel", { value: "Concept", language: "en" }],
        ],
      })
    );
    const jsonLd = toJsonLd(assembled);
    const conceptNode = jsonLd["@graph"].find((node) => node["@id"] === "https://ns.beep.sh/vocab/Concept");
    const turtle = toTurtle(assembled);

    expect(conceptNode?.["@type"]).toEqual(["rdfs:Class", "skos:Concept"]);
    expect(turtle).toContain("a rdfs:Class, skos:Concept");
    expect(turtle).toContain("a rdfs:Class, skos:ConceptScheme");
    expect(assembled.warnings).toEqual([]);
  });

  it("fails on duplicate preferred labels for one language", async () => {
    await expect(
      Effect.runPromise(
        fold($Skos, {
          label: "Broken",
          schemas: [Concept],
          triples: [
            [Concept, "skos:prefLabel", { value: "Concept", language: "en" }],
            [Concept, "skos:prefLabel", { value: "Idea", language: "en" }],
          ],
        })
      )
    ).rejects.toMatchObject({ reason: "skosIntegrity" });
  });

  it("rejects a reversed hierarchy direction with a typed failure naming both IRIs", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        fold($Skos, {
          label: "Broken",
          schemas: [Concept, Scheme],
          triples: [
            [Concept, "skos:broader", Scheme],
            [Scheme, "skos:broader", Concept],
          ],
        })
      )
    );

    expect(error.reason).toBe("skosIntegrity");
    expect(O.getOrThrow(error.subjectIri)).toBe("https://ns.beep.sh/vocab/Concept");
    expect(O.getOrThrow(error.objectIri)).toBe("https://ns.beep.sh/vocab/Scheme");
  });

  it("keeps scheme-membership gaps observable as warnings without failing", async () => {
    const assembled = await Effect.runPromise(
      fold($Skos, {
        label: "Vocab",
        schemas: [Concept],
        triples: [[Concept, "skos:prefLabel", { value: "Concept", language: "en" }]],
      })
    );

    expect(assembled.warnings.map((warning) => warning.code)).toEqual(["missingConceptScheme"]);
  });
});

describe("Ontology.fold negative fixtures", () => {
  const $Neg = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.create("negative");

  class LeftDocument extends S.Class<LeftDocument>($Neg`LeftDocument`)(
    {
      label: S.String,
    },
    $Neg.class("LeftDocument", { description: "Document" })
  ) {}

  class RightDocument extends S.Class<RightDocument>($Neg`RightDocument`)(
    {
      label: S.String,
    },
    $Neg.class("RightDocument", { description: "Document" })
  ) {}

  it("keeps equal-label distinct resources unfolded: no identity edge is synthesized", async () => {
    const assembled = await Effect.runPromise(
      fold($Neg, {
        label: "Equal Labels",
        schemas: [LeftDocument, RightDocument],
        triples: [],
      })
    );

    expect(assembled.classes).toHaveLength(2);
    expect(assembled.facts).toHaveLength(0);
    expect(pipe(findClass(assembled.classes, "LeftDocument"), O.getOrThrow).iri).not.toBe(
      pipe(findClass(assembled.classes, "RightDocument"), O.getOrThrow).iri
    );
  });

  it("refuses to resolve an ambiguous bare mention by resemblance", async () => {
    const mention = ["LeftDocument", "rdfs:seeAlso", "owl:Thing"] as unknown as Triple;

    await expect(
      Effect.runPromise(
        fold($Neg, {
          label: "Ambiguous",
          schemas: [LeftDocument, RightDocument],
          triples: [mention],
        })
      )
    ).rejects.toMatchObject({ reason: "unknownTerm", term: O.some("LeftDocument") });
  });

  it("is byte-identical across repeated assembly and every projection", async () => {
    const first = await assemble();
    const second = await assemble();

    expect(JSON.stringify(toJsonLd(first))).toBe(JSON.stringify(toJsonLd(second)));
    expect(JSON.stringify(toContext(first))).toBe(JSON.stringify(toContext(second)));
    expect(toTurtle(first)).toBe(toTurtle(second));
    expect(toMarkdown(first)).toBe(toMarkdown(second));
  });
});

describe("Ontology.fold rebase", () => {
  it("renders a rebased hash-namespace vocabulary with prefixed names in every projection", async () => {
    const $Patent = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })
      .$BeepId.create("ontology")
      .create("patent")
      .rebase({ iri: "https://opip.law/ns/patent#", prefix: "patent" });

    class PublishedClaim extends S.Class<PublishedClaim>($Patent`PublishedClaim`)(
      {
        text: S.String,
      },
      $Patent.class("PublishedClaim", { description: "A published claim." })
    ) {}

    const assembled = await Effect.runPromise(
      fold($Patent, {
        label: "Published Patent Vocabulary",
        schemas: [PublishedClaim],
        triples: [[PublishedClaim, "rdfs:subClassOf", "owl:Thing"]],
      })
    );
    const turtle = toTurtle(assembled);
    const context = toContext(assembled);

    expect(assembled.baseIri.startsWith("https://opip.law/ns/patent#")).toBe(true);
    expect(assembled.prefix).toBe("patent");
    expect(turtle).toContain("@prefix patent: <https://opip.law/ns/patent#");
    expect(turtle).toContain("patent:");
    expect(context.patent).toMatchObject({ "@prefix": true });
    expect(toTurtle(assembled)).toBe(toTurtle(assembled));
  });
});

describe("Ontology.fold FOLIO-derived module", () => {
  it("renders the migrated OWLClass module through all four projections byte-identically", async () => {
    const { OWLClass } = await import("@beep/ontology/Ontology.models");
    const { $OntologyId } = await import("@beep/identity/packages");
    const $Folio = $OntologyId.create("Ontology.models");

    const assembled = await Effect.runPromise(
      fold($Folio, {
        label: "FOLIO Class Vocabulary",
        schemas: [OWLClass],
        triples: [[OWLClass, "rdfs:seeAlso", "https://folio.openlegalstandard.org/"]],
      })
    );
    const second = await Effect.runPromise(
      fold($Folio, {
        label: "FOLIO Class Vocabulary",
        schemas: [OWLClass],
        triples: [[OWLClass, "rdfs:seeAlso", "https://folio.openlegalstandard.org/"]],
      })
    );

    expect(JSON.stringify(toJsonLd(assembled))).toBe(JSON.stringify(toJsonLd(second)));
    expect(toTurtle(assembled)).toBe(toTurtle(second));
    expect(toMarkdown(assembled)).toBe(toMarkdown(second));
    expect(JSON.stringify(toContext(assembled))).toBe(JSON.stringify(toContext(second)));

    const claimClass = assembled.classes[0];
    expect(claimClass?.iri).toBe("https://ns.beep.sh/ontology/Ontology.models/OWLClass");
    const subClassOf = pipe(claimClass ?? { predicates: [] }, (c) =>
      c.predicates.find((p) => p.key === "sub_class_of")
    );
    const parentClassOf = pipe(claimClass ?? { predicates: [] }, (c) =>
      c.predicates.find((p) => p.key === "parent_class_of")
    );
    expect(subClassOf?.termIri).toBe("http://www.w3.org/2000/01/rdf-schema#subClassOf");
    expect(subClassOf?.reverse).toBe(false);
    expect(parentClassOf?.termIri).toBe("http://www.w3.org/2000/01/rdf-schema#subClassOf");
    expect(parentClassOf?.reverse).toBe(true);
  });
});
