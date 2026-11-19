import { AbsoluteIRI, IRI, IRIReference } from "@beep/identity/Iri";
import { makeNamedNode } from "@beep/rdf/Rdf";
import { canonicalizeSchemaOrgIri } from "@beep/rdf/Vocab/SchemaOrg";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const IRIIs = S.is(IRI);

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

  it("preserves RDF-distinct schema.org IRIs across the generic IRI facade", () => {
    expect(Result.getOrThrow(S.decodeResult(IRI)("http://schema.org/name"))).toBe("http://schema.org/name");
    expect(Result.getOrThrow(S.decodeResult(AbsoluteIRI)("http://schema.org/Person"))).toBe("http://schema.org/Person");
    expect(Result.getOrThrow(S.decodeResult(IRIReference)("http://www.schema.org/Thing"))).toBe(
      "http://www.schema.org/Thing"
    );
    expect(makeNamedNode("http://schema.org/name").value).toBe("http://schema.org/name");
  });

  it.effect.prop(
    "canonicalization is idempotent, keeps IRIs valid, and named nodes never canonicalize",
    [Arbitrary.schema(IRI)],
    ([value]) =>
      Effect.sync(() => {
        const canonical = canonicalizeSchemaOrgIri(value);
        return (
          canonicalizeSchemaOrgIri(canonical) === canonical && IRIIs(canonical) && makeNamedNode(value).value === value
        );
      }),
    { arbitrary: fcRuns(50) }
  );
});
