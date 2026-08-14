import { CoreVocab } from "@beep/identity";
import { OWL_OBJECT_PROPERTY, OWL_TERMS } from "@beep/rdf/Vocab/Owl";
import { RDF_TERMS, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { SKOS_PREF_LABEL, SKOS_TERMS } from "@beep/rdf/Vocab/Skos";
import { describe, expect, it } from "@effect/vitest";
import { CLAIMS, CORE, CORRECTIONS, EXTR } from "../../../Domain/Rdf/Constants.ts";
import { IRI } from "../../../Domain/Rdf/Types.ts";

describe("effect-ontology RDF vocabulary constants", () => {
  it("uses canonical package constants for standards vocabularies", () => {
    expect(RDF_TYPE.value).toBe("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
    expect(OWL_OBJECT_PROPERTY.value).toBe("http://www.w3.org/2002/07/owl#ObjectProperty");
    expect(SKOS_PREF_LABEL.value).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
  });

  it("retains only experiment-owned vocabularies locally", () => {
    expect(CLAIMS.Claim.value).toBe("http://effect-ontology.dev/claims#Claim");
    expect(CORRECTIONS.Retraction.value).toBe("http://effect-ontology.dev/corrections#Retraction");
    expect(EXTR.confidence.value).toBe("http://example.org/kg/confidence");
    expect(IRI.is(CORE.Mention.value)).toBe(true);
  });

  it("uses generated term inventories backed by identity CoreVocab", () => {
    expect(RDF_TERMS).toEqual(CoreVocab.rdf.terms);
    expect(OWL_TERMS).toEqual(CoreVocab.owl.terms);
    expect(SKOS_TERMS).toEqual(CoreVocab.skos.terms);
  });
});
