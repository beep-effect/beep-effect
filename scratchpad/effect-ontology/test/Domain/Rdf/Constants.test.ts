import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import {
  CLAIMS,
  CORE,
  KNOWN_VOCABULARIES,
  KnownVocabulary,
  KnownVocabularyRegistry,
  OWL,
  RDF,
  RDF_TYPE,
  SCHEMA,
  SKOS,
} from "../../../Domain/Rdf/Constants.ts";
import { IRI } from "../../../Domain/Rdf/Types.ts";

describe("effect-ontology RDF vocabulary constants", () => {
  it("derives arbitraries whose values satisfy vocabulary metadata schemas", () => {
    for (const schema of [KnownVocabulary, KnownVocabularyRegistry]) {
      const arbitrary = S.toArbitrary(schema)(fc);

      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 32 }
      );
    }
  });

  it("exposes branded IRI values for standards vocabularies", () => {
    expect(RDF.type).toBe("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
    expect(OWL.ObjectProperty).toBe("http://www.w3.org/2002/07/owl#ObjectProperty");
    expect(SKOS.prefLabel).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
    expect(RDF_TYPE).toBe(RDF.type);
  });

  it("retains explicit experimental namespaces as branded IRIs", () => {
    expect(CLAIMS.Claim).toBe("http://effect-ontology.dev/claims#Claim");
    expect(IRI.is(CORE.Mention)).toBe(true);
    expect(SCHEMA.Person).toBe("http://schema.org/Person");
  });

  it("validates the complete known-vocabulary registry", () => {
    expect(KnownVocabularyRegistry.is(KNOWN_VOCABULARIES)).toBe(true);
    expect(KNOWN_VOCABULARIES[IRI.fromUnknown("http://www.w3.org/ns/prov#")]?.prefix).toBe("prov");
  });
});
