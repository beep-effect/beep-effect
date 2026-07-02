import { describe, expect, expectTypeOf, it } from "vitest";
import { make } from "../identity/Composer.ts";

describe("IdentityComposer prototype", () => {
  it("derives exact IRI and CURIE literals from composed identity paths", () => {
    const $I = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" });
    const patent = $I.create("ontology").create("patent");

    expectTypeOf(patent.iri).toEqualTypeOf<"https://ns.beep.sh/ontology/patent">();
    expectTypeOf(patent.curie).toEqualTypeOf<"beep:ontology/patent">();
    expect(patent.identity).toBe("@beep/ontology/patent");
    expect(patent.iri).toBe("https://ns.beep.sh/ontology/patent");
    expect(patent.curie).toBe("beep:ontology/patent");
  });

  it("rebases projections without changing identity or symbol interning", () => {
    const patent = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })
      .create("ontology")
      .create("patent");
    const rebased = patent.rebase({ iri: "https://opip.law/ns/patent#", prefix: "patent" });

    expectTypeOf(rebased.iri).toEqualTypeOf<"https://opip.law/ns/patent#ontology/patent">();
    expectTypeOf(rebased.curie).toEqualTypeOf<"patent:ontology/patent">();
    expect(rebased.iri).toBe("https://opip.law/ns/patent#ontology/patent");
    expect(rebased.curie).toBe("patent:ontology/patent");
    expect(rebased.identity).toBe(patent.identity);
    expect(rebased.symbol).toBe(patent.symbol);
    expect(rebased.symbol).toBe(Symbol.for("@beep/ontology/patent"));
  });

  it("annotates child identities with literal identifier and IRI projections", () => {
    const patent = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })
      .create("ontology")
      .create("patent");
    const annotation = patent.annote("Claim", { description: "Patent claim." });

    expectTypeOf(annotation.identifier).toEqualTypeOf<"@beep/ontology/patent/Claim">();
    expectTypeOf(annotation.iri).toEqualTypeOf<"https://ns.beep.sh/ontology/patent/Claim">();
    expect(annotation).toMatchObject({
      identifier: "@beep/ontology/patent/Claim",
      iri: "https://ns.beep.sh/ontology/patent/Claim",
      curie: "beep:ontology/patent/Claim",
      title: "Claim",
      description: "Patent claim.",
    });
  });

  it("interns independently composed equal paths to the same symbol", () => {
    const left = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).create("ontology").create("patent");
    const right = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).create("ontology").create("patent");

    expect(left.identity).toBe(right.identity);
    expect(left.symbol).toBe(right.symbol);
  });
});
