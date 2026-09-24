import { AbsoluteIRI, canonicalizeSchemaOrgIri, IRI, IRIReference, RelativeIRIReference } from "@beep/rdf/Iri";
import { makeNamedNode } from "@beep/rdf/Rdf";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeAbsoluteIRI = S.decodeUnknownEffect(AbsoluteIRI);
const decodeIRI = S.decodeUnknownEffect(IRI);
const decodeIRIReference = S.decodeUnknownEffect(IRIReference);
const decodeRelativeIRIReference = S.decodeUnknownEffect(RelativeIRIReference);

describe("IRI", () => {
  it.effect("accepts representative internationalized and relative forms through the facade", () =>
    Effect.gen(function* () {
      expect(yield* decodeIRI("https://例え.テスト/δοκιμή?q=値#片段")).toBe("https://例え.テスト/δοκιμή?q=値#片段");
      expect(yield* decodeAbsoluteIRI("mailto:用户@example.org")).toBe("mailto:用户@example.org");
      expect(yield* decodeIRIReference("../résumé/δοκιμή?x=値#片段")).toBe("../résumé/δοκιμή?x=値#片段");
      expect(yield* decodeRelativeIRIReference("folder/child:leaf")).toBe("folder/child:leaf");
    })
  );

  it.effect("rejects invalid facade inputs with the RDF schema diagnostics", () =>
    Effect.gen(function* () {
      const invalidIri = yield* Effect.exit(decodeIRI("https://example.com/%ZZ"));
      expect(Exit.isFailure(invalidIri)).toBe(true);
      if (Exit.isFailure(invalidIri)) {
        expect(Cause.pretty(invalidIri.cause)).toContain("Expected a valid RFC 3987 IRI");
      }

      const invalidAbsolute = yield* Effect.exit(decodeAbsoluteIRI("https://example.com/path#frag"));
      expect(Exit.isFailure(invalidAbsolute)).toBe(true);
      if (Exit.isFailure(invalidAbsolute)) {
        expect(Cause.pretty(invalidAbsolute.cause)).toContain("Expected a valid RFC 3987 absolute IRI");
      }

      const invalidRelative = yield* Effect.exit(decodeRelativeIRIReference("folder:child/leaf"));
      expect(Exit.isFailure(invalidRelative)).toBe(true);
      if (Exit.isFailure(invalidRelative)) {
        expect(Cause.pretty(invalidRelative.cause)).toContain("Expected a valid RFC 3987 relative IRI reference");
      }
    })
  );

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

  it("preserves RDF-distinct schema.org IRIs across the generic IRI facade", () => {
    expect(IRI.decodeUnknownSync("http://schema.org/name")).toBe("http://schema.org/name");
    expect(AbsoluteIRI.decodeUnknownSync("http://schema.org/Person")).toBe("http://schema.org/Person");
    expect(IRIReference.decodeUnknownSync("http://www.schema.org/Thing")).toBe("http://www.schema.org/Thing");
    expect(makeNamedNode("http://schema.org/name").value).toBe("http://schema.org/name");
  });

  it("keeps canonical schema.org and unrelated legacy-http IRIs unchanged on decode", () => {
    expect(IRI.decodeUnknownSync("https://schema.org/name")).toBe("https://schema.org/name");
    expect(IRI.decodeUnknownSync("http://purl.org/dc/terms/creator")).toBe("http://purl.org/dc/terms/creator");
  });

  it("accepts valid legacy schema.org forms on the type side", () => {
    expect(IRI.is("http://schema.org/name")).toBe(true);
    expect(IRI.is("https://schema.org/name")).toBe(true);
    expect(O.isNone(IRI.decodeUnknownOption("https://example.com/%ZZ"))).toBe(true);
    expect(O.isSome(IRI.makeOption("http://schema.org/name"))).toBe(true);
    expect(() => IRI.make("http://schema.org/name")).not.toThrow();
  });
});
