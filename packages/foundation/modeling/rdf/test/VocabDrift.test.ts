import { SparVocab } from "@beep/identity";
import { CITO_NAMESPACE, CITO_TERMS } from "@beep/rdf/Vocab/Cito";
import { DCTERMS_NAMESPACE, DCTERMS_TERMS } from "@beep/rdf/Vocab/Dcterms";
import { DEO_NAMESPACE, DEO_TERMS } from "@beep/rdf/Vocab/Deo";
import { DOCO_NAMESPACE, DOCO_TERMS } from "@beep/rdf/Vocab/Doco";
import { FABIO_NAMESPACE, FABIO_TERMS } from "@beep/rdf/Vocab/Fabio";
import { OWL_NAMESPACE, OWL_TERMS } from "@beep/rdf/Vocab/Owl";
import { RDF_NAMESPACE, RDF_TERMS } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE, RDFS_TERMS } from "@beep/rdf/Vocab/Rdfs";
import { SCHEMA_ORG_NAMESPACE, SCHEMA_ORG_TERMS } from "@beep/rdf/Vocab/SchemaOrg";
import { SKOS_NAMESPACE, SKOS_TERMS } from "@beep/rdf/Vocab/Skos";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Str from "effect/String";

const vocabCases = [
  { moduleName: "Doco", namespace: DOCO_NAMESPACE, prefix: "doco", terms: DOCO_TERMS },
  { moduleName: "Deo", namespace: DEO_NAMESPACE, prefix: "deo", terms: DEO_TERMS },
  { moduleName: "Fabio", namespace: FABIO_NAMESPACE, prefix: "fabio", terms: FABIO_TERMS },
  { moduleName: "Cito", namespace: CITO_NAMESPACE, prefix: "cito", terms: CITO_TERMS },

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
  {
    moduleName: "SchemaOrg",
    namespace: SCHEMA_ORG_NAMESPACE,
    prefix: "schema",
    terms: SCHEMA_ORG_TERMS,
  },
] as const;

const difference = (left: readonly string[], right: readonly string[]) =>
  A.sort(
    A.filter(left, (value) => !A.contains(right, value)),
    Str.Order
  );

describe("@beep/rdf vocabulary drift", () => {
  it("keeps RDF vocabulary namespace and term constants aligned with identity SparVocab", () => {
    for (const current of vocabCases) {
      const registry = SparVocab[current.prefix];
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
