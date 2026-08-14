import { describe, expect, expectTypeOf, it } from "vitest";
import { make } from "@beep/identity";

describe("IdentityComposer prototype", () => {
  it("derives exact IRI and CURIE literals from composed identity paths", () => {
    const { $BeepId: $I } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" });
    const patent = $I.create("ontology").create("patent");

    expectTypeOf(patent.iri).toEqualTypeOf<"https://ns.beep.sh/ontology/patent">();
    expectTypeOf(patent.curie).toEqualTypeOf<"beep:ontology/patent">();
    expect(patent.identifier).toBe("@beep/ontology/patent");
    expect(patent.iri).toBe("https://ns.beep.sh/ontology/patent");
    expect(patent.curie).toBe("beep:ontology/patent");
  });

  it("rebases projections without changing identity or symbol interning", () => {
    const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" });
    const patent = $BeepId
      .create("ontology")
      .create("patent");
    const rebased = patent.rebase({ iri: "https://opip.law/ns/patent#", prefix: "patent" });

    expectTypeOf(rebased.iri).toEqualTypeOf<"https://opip.law/ns/patent#ontology/patent">();
    expectTypeOf(rebased.curie).toEqualTypeOf<"patent:ontology/patent">();
    expect(rebased.iri).toBe("https://opip.law/ns/patent#ontology/patent");
    expect(rebased.curie).toBe("patent:ontology/patent");
    expect(rebased.identifier).toBe(patent.identifier);
    expect(rebased.symbol()).toBe(patent.symbol());
    expect(rebased.symbol()).toBe(Symbol.for("@beep/ontology/patent"));
  });

  it("annotates child identities with literal identifier and IRI projections", () => {
    const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" });
    const patent = $BeepId
      .create("ontology")
      .create("patent");
    const annotation = patent.annote("Claim", { description: "Patent claim." });

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
    const { $BeepId: leftRoot } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" });
    const { $BeepId: rightRoot } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" });
    const left = leftRoot.create("ontology").create("patent");
    const right = rightRoot.create("ontology").create("patent");

    expect(left.identifier).toBe(right.identifier);
    expect(left.symbol()).toBe(right.symbol());
  });
});
