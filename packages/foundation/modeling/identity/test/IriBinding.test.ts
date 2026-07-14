import { make } from "@beep/identity";
import { $I, $OntologyId, $SemanticFoundationId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { CurieFromIdentity, IriFromIdentity, SlugFromIdentifier } from "@beep/identity";

const getProperty = (value: unknown, key: PropertyKey): unknown =>
  value !== null && typeof value === "object" ? Reflect.get(value, key) : undefined;

describe("@beep/identity IRI binding", () => {
  it("binds the semantic foundation to the repository authority", () => {
    expect($SemanticFoundationId.iri).toBe("https://ns.beep.sh/ontology/semantic-foundation");
  });

  it("derives exact IRI and CURIE literals through create and compose chains", () => {
    const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" });
    const modules = $BeepId.compose("ontology", "schema");
    const model = modules.$OntologyId.create("Ontology.models").create("HttpUrl");

    expectTypeOf<
      IriFromIdentity<"https://ns.beep.sh/", "@beep/ontology/Ontology.models/HttpUrl">
    >().toEqualTypeOf<"https://ns.beep.sh/ontology/Ontology.models/HttpUrl">();
    expectTypeOf<
      CurieFromIdentity<"beep", "@beep/ontology/Ontology.models/HttpUrl">
    >().toEqualTypeOf<"beep:ontology/Ontology.models/HttpUrl">();
    expectTypeOf<
      SlugFromIdentifier<"@beep/ontology/Ontology.models/HttpUrl">
    >().toEqualTypeOf<"beep-ontology-ontology-models-http-url">();
    expectTypeOf(modules.$OntologyId.iri).toEqualTypeOf<"https://ns.beep.sh/ontology">();
    expectTypeOf(model.iri).toEqualTypeOf<"https://ns.beep.sh/ontology/Ontology.models/HttpUrl">();
    expectTypeOf(model.curie).toEqualTypeOf<"beep:ontology/Ontology.models/HttpUrl">();
    expectTypeOf(model.slug).toEqualTypeOf<"beep-ontology-ontology-models-http-url">();

    expect(model.string()).toBe("@beep/ontology/Ontology.models/HttpUrl");
    expect(model.iri).toBe("https://ns.beep.sh/ontology/Ontology.models/HttpUrl");
    expect(model.curie).toBe("beep:ontology/Ontology.models/HttpUrl");
    expect(model.slug).toBe("beep-ontology-ontology-models-http-url");
  });

  it("rebases projections while preserving identity and symbol interning", () => {
    const patent = $I.create("ontology").create("patent");
    const originalSymbol = patent.symbol();
    const rebased = patent.rebase({ iri: "https://opip.law/ns/patent#", prefix: "patent" });
    const annotation = rebased.annote("Claim");

    expectTypeOf(rebased.iri).toEqualTypeOf<"https://opip.law/ns/patent#ontology/patent">();
    expectTypeOf(rebased.curie).toEqualTypeOf<"patent:ontology/patent">();
    expectTypeOf(annotation.iri).toEqualTypeOf<"https://opip.law/ns/patent#ontology/patent/Claim">();
    expectTypeOf(annotation.curie).toEqualTypeOf<"patent:ontology/patent/Claim">();

    expect(rebased.string()).toBe(patent.string());
    expect(rebased.identifier).toBe(patent.identifier);
    expect(rebased.symbol()).toBe(originalSymbol);
    expect(rebased.symbol()).toBe(Symbol.for("@beep/ontology/patent"));
    expect(rebased.iri).toBe("https://opip.law/ns/patent#ontology/patent");
    expect(rebased.curie).toBe("patent:ontology/patent");
    expect(annotation.identifier).toBe("@beep/ontology/patent/Claim");
    expect(annotation.schemaId).toBe(Symbol.for("@beep/ontology/patent/Claim"));
  });

  it("adds owned iri and curie fields to bound annotation records", () => {
    const $Model = $OntologyId.create("Ontology.models");
    const annotation = $Model.annote("OWLClass", {
      description: "Ontology class metadata.",
    });
    const schema = S.String.pipe(
      $Model.annoteSchema("OWLClassLabel", {
        description: "Ontology class label.",
      })
    );
    const schemaAnnotations = S.resolveAnnotations(schema);

    expectTypeOf(annotation.iri).toEqualTypeOf<"https://ns.beep.sh/ontology/Ontology.models/OWLClass">();
    expectTypeOf(annotation.curie).toEqualTypeOf<"beep:ontology/Ontology.models/OWLClass">();
    expect(annotation).toMatchObject({
      identifier: "@beep/ontology/Ontology.models/OWLClass",
      iri: "https://ns.beep.sh/ontology/Ontology.models/OWLClass",
      curie: "beep:ontology/Ontology.models/OWLClass",
      title: "OWLClass",
      description: "Ontology class metadata.",
    });
    expect(getProperty(schemaAnnotations, "iri")).toBe("https://ns.beep.sh/ontology/Ontology.models/OWLClassLabel");
    expect(getProperty(schemaAnnotations, "curie")).toBe("beep:ontology/Ontology.models/OWLClassLabel");
  });

  it("keeps one-argument make composers unbound and type-safe", () => {
    const unbound = make("beep").$BeepId.create("scratch");
    const annotation = unbound.annote("Unpublished");

    expectTypeOf(unbound.iri).toEqualTypeOf<undefined>();
    expectTypeOf(unbound.curie).toEqualTypeOf<undefined>();
    expect(unbound.iri).toBeUndefined();
    expect(unbound.curie).toBeUndefined();
    expect(Reflect.has(annotation, "iri")).toBe(false);
    expect(Reflect.has(annotation, "curie")).toBe(false);
    expect(annotation.identifier).toBe("@beep/scratch/Unpublished");
  });
});
