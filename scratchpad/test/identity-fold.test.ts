import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { make } from "../identity/Composer.ts";
import { key, ontology, type AssembledClass, type AssembledPredicate, type Triple } from "../identity/Ontology.ts";

const $I = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).create("patent");

class Claim extends S.Class<Claim>($I`Claim`)(
  {
    prefLabel: S.String.annotateKey(key("skos:prefLabel")),
    children: S.Array(S.String).annotateKey(key("^rdfs:subClassOf")),
    text: S.String,
  },
  $I.annote("Claim", { description: "Patent claim." })
) {}

class Spec extends S.Class<Spec>($I`Spec`)(
  {
    claim: Claim,
  },
  $I.annote("Spec", { description: "Patent specification." })
) {}

const triples = [
  [Claim, "rdfs:subClassOf", "owl:Thing"],
  [Claim, "owl:sameAs", "https://schema.org/CreativeWork"],
  [Spec, "skos:related", Claim],
] satisfies ReadonlyArray<Triple>;

const runFold = () =>
  Effect.runPromise(
    ontology($I, {
      label: "Patent Core",
      schemas: [Claim, Spec],
      triples,
    })
  );

const findClass = (classes: ReadonlyArray<AssembledClass>, name: string) =>
  pipe(classes, A.findFirst((item) => item.name === name));

const findPredicate = (klass: AssembledClass, keyName: string): O.Option<AssembledPredicate> =>
  pipe(klass.predicates, A.findFirst((item) => item.key === keyName));

describe("identity ontology fold prototype", () => {
  it("resolves class IRIs and tuple facts through schema identity annotations", async () => {
    const assembled = await runFold();
    const claim = pipe(findClass(assembled.classes, "Claim"), O.getOrThrow);
    const spec = pipe(findClass(assembled.classes, "Spec"), O.getOrThrow);

    expect(claim.iri).toBe("https://ns.beep.sh/patent/Claim");
    expect(spec.iri).toBe("https://ns.beep.sh/patent/Spec");
    expect(assembled.facts).toEqual([
      {
        subjectIri: "https://ns.beep.sh/patent/Claim",
        predicateIri: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
        object: "http://www.w3.org/2002/07/owl#Thing",
      },
      {
        subjectIri: "https://ns.beep.sh/patent/Claim",
        predicateIri: "http://www.w3.org/2002/07/owl#sameAs",
        object: "https://schema.org/CreativeWork",
      },
      {
        subjectIri: "https://ns.beep.sh/patent/Spec",
        predicateIri: "http://www.w3.org/2004/02/skos/core#related",
        object: "https://ns.beep.sh/patent/Claim",
      },
    ]);
  });

  it("defaults field predicate names to struct keys and infers datatype/object kinds", async () => {
    const assembled = await runFold();
    const claim = pipe(findClass(assembled.classes, "Claim"), O.getOrThrow);
    const spec = pipe(findClass(assembled.classes, "Spec"), O.getOrThrow);
    const prefLabel = pipe(findPredicate(claim, "prefLabel"), O.getOrThrow);
    const text = pipe(findPredicate(claim, "text"), O.getOrThrow);
    const children = pipe(findPredicate(claim, "children"), O.getOrThrow);
    const claimRef = pipe(findPredicate(spec, "claim"), O.getOrThrow);

    expect(prefLabel).toMatchObject({
      kind: "datatype",
      term: "skos:prefLabel",
      termIri: "http://www.w3.org/2004/02/skos/core#prefLabel",
    });
    expect(text).toMatchObject({
      kind: "datatype",
      term: "text",
      termIri: "https://ns.beep.sh/patent/text",
    });
    expect(children).toMatchObject({
      kind: "datatype",
      reverse: true,
      termIri: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
    });
    expect(claimRef).toMatchObject({
      kind: "object",
      rangeIri: "https://ns.beep.sh/patent/Claim",
    });
  });

  it("fails with a typed error when a field references a schema outside the fold", async () => {
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
        ontology($I, {
          label: "Broken",
          schemas: [WithExternal],
          triples: [],
        })
      )
    ).rejects.toMatchObject({ _tag: "UnresolvedHandle" });
  });

  it("fails with a typed error for unknown CURIE prefixes", async () => {
    const badTriple = [Claim, "nope:term", "owl:Thing"] as unknown as Triple;

    await expect(
      Effect.runPromise(
        ontology($I, {
          label: "Broken",
          schemas: [Claim],
          triples: [badTriple],
        })
      )
    ).rejects.toMatchObject({ _tag: "UnknownTerm" });
  });
});
