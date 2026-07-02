import { CoreVocab } from "@beep/identity";
import { DCTERMS_NAMESPACE, DCTERMS_TERMS } from "@beep/rdf/Vocab/Dcterms";
import { OWL_NAMESPACE, OWL_TERMS } from "@beep/rdf/Vocab/Owl";
import { RDF_NAMESPACE, RDF_TERMS } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE, RDFS_TERMS } from "@beep/rdf/Vocab/Rdfs";
import { SKOS_NAMESPACE, SKOS_TERMS } from "@beep/rdf/Vocab/Skos";
import { describe, expect, it } from "vitest";

const vocabCases = [
  {
    moduleName: "Rdf",
    namespace: RDF_NAMESPACE,
    prefix: "rdf",
    terms: RDF_TERMS,
  },
  {
    moduleName: "Rdfs",
    namespace: RDFS_NAMESPACE,
    prefix: "rdfs",
    terms: RDFS_TERMS,
  },
  {
    moduleName: "Skos",
    namespace: SKOS_NAMESPACE,
    prefix: "skos",
    terms: SKOS_TERMS,
  },
  {
    moduleName: "Owl",
    namespace: OWL_NAMESPACE,
    prefix: "owl",
    terms: OWL_TERMS,
  },
  {
    moduleName: "Dcterms",
    namespace: DCTERMS_NAMESPACE,
    prefix: "dcterms",
    terms: DCTERMS_TERMS,
  },
] as const;

const difference = (left: readonly string[], right: readonly string[]) =>
  left.filter((value) => !right.includes(value)).sort();

describe("@beep/rdf vocabulary drift", () => {
  it("keeps RDF vocabulary namespace and term constants aligned with identity CoreVocab", () => {
    for (const current of vocabCases) {
      const registry = CoreVocab[current.prefix];
      const missingInRegistry = difference(current.terms, registry.terms);
      const missingInConstants = difference(registry.terms, current.terms);
      const driftMessage = `${current.prefix} drift against @beep/rdf/Vocab/${current.moduleName}`;

      expect(registry.iri, `${driftMessage}: namespace IRI`).toBe(current.namespace);
      expect({ missingInConstants, missingInRegistry }, `${driftMessage}: term-list divergence`).toEqual({
        missingInConstants: [],
        missingInRegistry: [],
      });
    }
  });
});
