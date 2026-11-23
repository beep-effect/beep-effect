import { IdentityAuthority, make } from "@beep/identity";
import { $EpistemicId, $I, $OntologyId, $QaId, $SemanticFoundationId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import * as S from "effect/Schema";
import type { CurieFromIdentity, IriFromIdentity, SlugFromIdentifier } from "@beep/identity";

const getProperty = (value: unknown, key: PropertyKey): unknown =>
  value !== null && typeof value === "object" ? Reflect.get(value, key) : undefined;

describe("@beep/identity IRI binding", () => {
  it("binds the semantic foundation to the repository authority", () => {
    expect($SemanticFoundationId.iri).toBe("https://beep-effect.com/ns/ontology/semantic-foundation");
  });

  it("roots the exported $I composer at the beep-effect.com identity authority", () => {
    const x = $I.create("x");

    expectTypeOf(IdentityAuthority).toEqualTypeOf<"https://beep-effect.com/ns/">();
    expectTypeOf($I.iri).toEqualTypeOf<"https://beep-effect.com/ns/">();
    expectTypeOf($I.curie).toEqualTypeOf<"beep:">();
    expectTypeOf(x.iri).toEqualTypeOf<"https://beep-effect.com/ns/x">();
    expectTypeOf(x.curie).toEqualTypeOf<"beep:x">();

    expect(IdentityAuthority).toBe("https://beep-effect.com/ns/");
    expect($I.iri).toBe("https://beep-effect.com/ns/");
    expect($I.iri).toBe(IdentityAuthority);
    expect($I.curie).toBe("beep:");
    expect(x.iri).toBe("https://beep-effect.com/ns/x");
    expect(x.curie).toBe("beep:x");
  });

  it("roots the shared epistemic and QA vocabularies under the identity authority", () => {
    const claim = $EpistemicId.create("Claim");
    const qaVersion = $QaId.create("1.0");

    expectTypeOf($EpistemicId.iri).toEqualTypeOf<"https://beep-effect.com/ns/epistemic">();
    expectTypeOf(claim.iri).toEqualTypeOf<"https://beep-effect.com/ns/epistemic/Claim">();
    expectTypeOf($QaId.iri).toEqualTypeOf<"https://beep-effect.com/ns/qa">();
    expectTypeOf(qaVersion.iri).toEqualTypeOf<"https://beep-effect.com/ns/qa/1.0">();

    expect($EpistemicId.iri).toBe("https://beep-effect.com/ns/epistemic");
    expect(claim.iri).toBe("https://beep-effect.com/ns/epistemic/Claim");
    expect(claim.curie).toBe("beep:epistemic/Claim");
    expect($QaId.iri).toBe("https://beep-effect.com/ns/qa");
    expect(qaVersion.iri).toBe("https://beep-effect.com/ns/qa/1.0");
    expect(`${qaVersion.iri}/`).toBe("https://beep-effect.com/ns/qa/1.0/");
  });

  it("derives exact IRI and CURIE literals through create and compose chains", () => {
    const { $BeepId } = make({ authority: "https://beep-effect.com/ns/", prefix: "beep" })("beep");
    const modules = $BeepId.compose("ontology", "schema");
    const model = modules.$OntologyId.create("Classification.models").create("ClassificationPin");

    expectTypeOf<
      IriFromIdentity<"https://beep-effect.com/ns/", "@beep/ontology/Classification.models/ClassificationPin">
    >().toEqualTypeOf<"https://beep-effect.com/ns/ontology/Classification.models/ClassificationPin">();
    expectTypeOf<
      CurieFromIdentity<"beep", "@beep/ontology/Classification.models/ClassificationPin">
    >().toEqualTypeOf<"beep:ontology/Classification.models/ClassificationPin">();
    expectTypeOf<
      SlugFromIdentifier<"@beep/ontology/Classification.models/ClassificationPin">
    >().toEqualTypeOf<"beep-ontology-classification-models-classification-pin">();
    expectTypeOf(modules.$OntologyId.iri).toEqualTypeOf<"https://beep-effect.com/ns/ontology">();
    expectTypeOf(
      model.iri
    ).toEqualTypeOf<"https://beep-effect.com/ns/ontology/Classification.models/ClassificationPin">();
    expectTypeOf(model.curie).toEqualTypeOf<"beep:ontology/Classification.models/ClassificationPin">();
    expectTypeOf(model.slug).toEqualTypeOf<"beep-ontology-classification-models-classification-pin">();

    expect(model.string()).toBe("@beep/ontology/Classification.models/ClassificationPin");
    expect(model.iri).toBe("https://beep-effect.com/ns/ontology/Classification.models/ClassificationPin");
    expect(model.curie).toBe("beep:ontology/Classification.models/ClassificationPin");
    expect(model.slug).toBe("beep-ontology-classification-models-classification-pin");
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
    const $Model = $OntologyId.create("Classification.models");
    const annotation = $Model.annote("ClassificationPin", {
      description: "Classification pin metadata.",
    });
    const schema = S.String.pipe(
      $Model.annoteSchema("ClassificationPinLabel", {
        description: "Classification pin label.",
      })
    );
    const schemaAnnotations = S.resolveAnnotations(schema);

    expectTypeOf(
      annotation.iri
    ).toEqualTypeOf<"https://beep-effect.com/ns/ontology/Classification.models/ClassificationPin">();
    expectTypeOf(annotation.curie).toEqualTypeOf<"beep:ontology/Classification.models/ClassificationPin">();
    expect(annotation).toMatchObject({
      identifier: "@beep/ontology/Classification.models/ClassificationPin",
      iri: "https://beep-effect.com/ns/ontology/Classification.models/ClassificationPin",
      curie: "beep:ontology/Classification.models/ClassificationPin",
      title: "ClassificationPin",
      description: "Classification pin metadata.",
    });
    expect(getProperty(schemaAnnotations, "iri")).toBe(
      "https://beep-effect.com/ns/ontology/Classification.models/ClassificationPinLabel"
    );
    expect(getProperty(schemaAnnotations, "curie")).toBe("beep:ontology/Classification.models/ClassificationPinLabel");
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
