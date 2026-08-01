import { make } from "@beep/identity";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

const { $MyPkgId } = make("my-pkg", { authority: "https://ns.beep.sh/", prefix: "beep" });
const $I = $MyPkgId.create("patent");

describe("composer ontology entrypoints", () => {
  describe("key", () => {
    it("writes a borrowed CURIE to the ontologyTerm key channel", () => {
      const field = S.String.pipe($I.key("skos:prefLabel"));

      expect(S.resolveAnnotationsKey(field)?.ontologyTerm).toBe("skos:prefLabel");
    });

    it("preserves reverse-marked predicates verbatim", () => {
      const field = S.Array(S.String).pipe($I.key("^rdfs:subClassOf"));

      expect(S.resolveAnnotationsKey(field)?.ontologyTerm).toBe("^rdfs:subClassOf");
    });

    it("accepts an options bag and forwards extras without minting a term", () => {
      const field = S.NonEmptyString.pipe($I.key({ description: "Claim text." }));
      const annotations = S.resolveAnnotationsKey(field);

      expect(annotations?.ontologyTerm).toBeUndefined();
      expect(annotations?.description).toBe("Claim text.");
    });

    it("accepts term and extras together in the options bag", () => {
      const field = S.String.pipe($I.key({ term: "skos:altLabel", title: "Alternative Labels" }));
      const annotations = S.resolveAnnotationsKey(field);

      expect(annotations?.ontologyTerm).toBe("skos:altLabel");
      expect(annotations?.title).toBe("Alternative Labels");
    });

    it("never writes the owned identifier channel", () => {
      const field = S.String.pipe($I.key("skos:prefLabel"));

      expect(S.resolveAnnotationsKey(field)?.identifier).toBeUndefined();
    });

    it("strips reserved identity channels from runtime options", () => {
      const unsafeOptions = {
        term: "skos:prefLabel",
        title: "Preferred label",
        identifier: "forged",
        schemaId: Symbol.for("forged"),
        iri: "https://example.test/forged",
        curie: "forged:value",
      } as unknown as Parameters<typeof $I.key>[0];
      const field = S.String.pipe($I.key(unsafeOptions));
      const annotations = S.resolveAnnotationsKey(field);

      expect(annotations?.ontologyTerm).toBe("skos:prefLabel");
      expect(annotations?.title).toBe("Preferred label");
      expect(annotations?.identifier).toBeUndefined();
      expect(annotations?.schemaId).toBeUndefined();
      expect(annotations?.iri).toBeUndefined();
      expect(annotations?.curie).toBeUndefined();
    });
  });

  describe("class", () => {
    it("produces the same owned identity metadata as annote", () => {
      const ann = $I.class("Claim", { description: "A patent claim." });

      expect(ann.identifier).toBe("@beep/my-pkg/patent/Claim");
      expect(ann.schemaId).toBe(Symbol.for("@beep/my-pkg/patent/Claim"));
      expect(ann.title).toBe("Claim");
      expect(ann.iri).toBe("https://ns.beep.sh/my-pkg/patent/Claim");
      expect(ann.curie).toBe("beep:my-pkg/patent/Claim");
      expect(ann.description).toBe("A patent claim.");
    });

    it("translates the skos option into the skosClassification channel", () => {
      const ann = $I.class("Claim", { description: "A patent claim.", skos: "concept" });

      expect(ann.skosClassification).toBe("concept");
      expect("skos" in ann).toBe(false);
    });

    it("omits skosClassification when no marker is supplied", () => {
      const ann = $I.class("Claim");

      expect(ann.skosClassification).toBeUndefined();
    });

    it("resolves through schema annotations on an S.Class", () => {
      class Claim extends S.Class<Claim>($I`Claim`)(
        {
          text: S.String,
        },
        $I.class("Claim", { description: "A patent claim.", skos: "concept" })
      ) {}

      const annotations = S.resolveAnnotations(Claim);

      expect(annotations?.identifier).toBe("@beep/my-pkg/patent/Claim");
      expect(annotations?.skosClassification).toBe("concept");
    });
  });
});
