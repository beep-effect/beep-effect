import { AbsoluteIRI, canonicalizeSchemaOrgIri, IRI, IRIReference, RelativeIRIReference } from "@beep/rdf/Iri";
import { makeNamedNode } from "@beep/rdf/Rdf";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

describe("IRI", () => {
  it("accepts representative internationalized and relative forms through the facade", () => {
    expect(S.decodeSync(IRI)("https://例え.テスト/δοκιμή?q=値#片段")).toBe("https://例え.テスト/δοκιμή?q=値#片段");
    expect(S.decodeSync(AbsoluteIRI)("mailto:用户@example.org")).toBe("mailto:用户@example.org");
    expect(S.decodeSync(IRIReference)("../résumé/δοκιμή?x=値#片段")).toBe("../résumé/δοκιμή?x=値#片段");
    expect(S.decodeSync(RelativeIRIReference)("folder/child:leaf")).toBe("folder/child:leaf");
  });

  it("rejects invalid facade inputs with the RDF schema diagnostics", () => {
    expect(() => S.decodeSync(IRI)("https://example.com/%ZZ")).toThrow("Expected a valid RFC 3987 IRI");
    expect(() => S.decodeSync(AbsoluteIRI)("https://example.com/path#frag")).toThrow(
      "Expected a valid RFC 3987 absolute IRI"
    );
    expect(() => S.decodeSync(RelativeIRIReference)("folder:child/leaf")).toThrow(
      "Expected a valid RFC 3987 relative IRI reference"
    );
  });

  it("only generates RFC 3987 IRI values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(IRI);
  });

  it("only generates RFC 3987 AbsoluteIRI values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(AbsoluteIRI);
  });

  it("only generates RFC 3987 IRIReference values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(IRIReference);
  });

  it("only generates RFC 3987 RelativeIRIReference values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(RelativeIRIReference);
  });
});

describe("schema.org namespace canonicalization", () => {
  it("canonicalizes legacy schema.org spellings and leaves other IRIs untouched", () => {
    expect(canonicalizeSchemaOrgIri("http://schema.org/name")).toBe("https://schema.org/name");
    expect(canonicalizeSchemaOrgIri("http://www.schema.org/Person")).toBe("https://schema.org/Person");
    expect(canonicalizeSchemaOrgIri("https://www.schema.org/SiteNavigationElement")).toBe(
      "https://schema.org/SiteNavigationElement"
    );
    expect(canonicalizeSchemaOrgIri("http://schema.org")).toBe("https://schema.org");
    expect(canonicalizeSchemaOrgIri("http://purl.org/dc/terms/creator")).toBe("http://purl.org/dc/terms/creator");
    expect(canonicalizeSchemaOrgIri("http://www.w3.org/2000/01/rdf-schema#label")).toBe(
      "http://www.w3.org/2000/01/rdf-schema#label"
    );
    expect(canonicalizeSchemaOrgIri("http://schema.organizer.example/x")).toBe("http://schema.organizer.example/x");
  });

  it("decodes legacy schema.org IRIs to the canonical https form across the IRI facade", () => {
    expect(IRI.fromUnknown("http://schema.org/name")).toBe("https://schema.org/name");
    expect(AbsoluteIRI.fromUnknown("http://schema.org/Person")).toBe("https://schema.org/Person");
    expect(IRIReference.fromUnknown("http://www.schema.org/Thing")).toBe("https://schema.org/Thing");
    expect(makeNamedNode("http://schema.org/name").value).toBe("https://schema.org/name");
  });

  it("keeps canonical schema.org and unrelated legacy-http IRIs unchanged on decode", () => {
    expect(IRI.fromUnknown("https://schema.org/name")).toBe("https://schema.org/name");
    expect(IRI.fromUnknown("http://purl.org/dc/terms/creator")).toBe("http://purl.org/dc/terms/creator");
  });

  it("rejects non-canonical schema.org forms on the type side", () => {
    expect(IRI.is("http://schema.org/name")).toBe(false);
    expect(IRI.is("https://schema.org/name")).toBe(true);
    expect(O.isNone(IRI.decodeOption("https://example.com/%ZZ"))).toBe(true);
    expect(O.isNone(IRI.makeOption("http://schema.org/name"))).toBe(true);
    expect(() => IRI.make("http://schema.org/name")).toThrow();
  });
});
