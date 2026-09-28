import { AbsoluteIRI, canonicalizeSchemaOrgIri, IRI, IRIReference, RelativeIRIReference } from "@beep/rdf/Iri";
import { makeNamedNode } from "@beep/rdf/Rdf";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const IRIDecodeEffect = S.decodeEffect(IRI);
const IRIIs = S.is(IRI);
const IRIToEquivalence = S.toEquivalence(IRI);
const AbsoluteIRIDecodeEffect = S.decodeEffect(AbsoluteIRI);
const AbsoluteIRIIs = S.is(AbsoluteIRI);
const AbsoluteIRIToEquivalence = S.toEquivalence(AbsoluteIRI);
const IRIReferenceDecodeEffect = S.decodeEffect(IRIReference);
const IRIReferenceIs = S.is(IRIReference);
const IRIReferenceToEquivalence = S.toEquivalence(IRIReference);
const RelativeIRIReferenceDecodeEffect = S.decodeEffect(RelativeIRIReference);
const RelativeIRIReferenceIs = S.is(RelativeIRIReference);
const RelativeIRIReferenceToEquivalence = S.toEquivalence(RelativeIRIReference);
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
      pipe(invalidIri, Exit.isFailure, assertTrue);
      if (Exit.isFailure(invalidIri)) {
        expect(Cause.pretty(invalidIri.cause)).toContain("Expected a valid RFC 3987 IRI");
      }

      const invalidAbsolute = yield* Effect.exit(decodeAbsoluteIRI("https://example.com/path#frag"));
      pipe(invalidAbsolute, Exit.isFailure, assertTrue);
      if (Exit.isFailure(invalidAbsolute)) {
        expect(Cause.pretty(invalidAbsolute.cause)).toContain("Expected a valid RFC 3987 absolute IRI");
      }

      const invalidRelative = yield* Effect.exit(decodeRelativeIRIReference("folder:child/leaf"));
      pipe(invalidRelative, Exit.isFailure, assertTrue);
      if (Exit.isFailure(invalidRelative)) {
        expect(Cause.pretty(invalidRelative.cause)).toContain("Expected a valid RFC 3987 relative IRI reference");
      }
    })
  );

  it.effect.prop(
    "only generates RFC 3987 IRI values that decode to themselves",
    [Arbitrary.schema(IRI)],
    ([value]) => Effect.map(IRIDecodeEffect(value), (decoded) => IRIIs(value) && IRIToEquivalence(decoded, value)),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "only generates RFC 3987 AbsoluteIRI values that decode to themselves",
    [Arbitrary.schema(AbsoluteIRI)],
    ([value]) =>
      Effect.map(
        AbsoluteIRIDecodeEffect(value),
        (decoded) => AbsoluteIRIIs(value) && AbsoluteIRIToEquivalence(decoded, value)
      ),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "only generates RFC 3987 IRIReference values that decode to themselves",
    [Arbitrary.schema(IRIReference)],
    ([value]) =>
      Effect.map(
        IRIReferenceDecodeEffect(value),
        (decoded) => IRIReferenceIs(value) && IRIReferenceToEquivalence(decoded, value)
      ),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "only generates RFC 3987 RelativeIRIReference values that decode to themselves",
    [Arbitrary.schema(RelativeIRIReference)],
    ([value]) =>
      Effect.map(
        RelativeIRIReferenceDecodeEffect(value),
        (decoded) => RelativeIRIReferenceIs(value) && RelativeIRIReferenceToEquivalence(decoded, value)
      ),
    { arbitrary: fcRuns(50) }
  );
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
    pipe(IRI.is("http://schema.org/name"), assertTrue);
    pipe(IRI.is("https://schema.org/name"), assertTrue);
    assertNone(IRI.decodeUnknownOption("https://example.com/%ZZ"));
    pipe(IRI.makeOption("http://schema.org/name"), O.isSome, assertTrue);
    expect(() => IRI.make("http://schema.org/name")).not.toThrow();
  });
});
