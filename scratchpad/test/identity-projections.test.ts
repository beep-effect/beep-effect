import { Effect } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { make } from "../identity/Composer.ts";
import { key, ontology, type Triple } from "../identity/Ontology.ts";
import { toContext, toJsonLd, toTurtle } from "../identity/Projections.ts";

const $I = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).create("patent");

class Claim extends S.Class<Claim>($I.make("Claim"))(
  {
    prefLabel: S.String.annotateKey(key("skos:prefLabel")),
    children: S.Array(S.String).annotateKey(key("^rdfs:subClassOf")),
    text: S.String,
  },
  $I.annote("Claim", { description: "Patent claim\nwith escaped text." })
) {}

class Spec extends S.Class<Spec>($I.make("Spec"))(
  {
    claim: Claim,
  },
  $I.annote("Spec", { description: "Patent specification." })
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
    ontology($I, {
      label: "Patent Core",
      schemas: [Claim, Spec, UnsafeLocal],
      triples,
    })
  );

describe("identity projection prototype", () => {
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
});
