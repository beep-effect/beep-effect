import {
  GraphInfo,
  HealthResponse,
  HTTPValidationError,
  HttpUrl,
  OWLClass,
  OWLClassList,
  OWLObjectProperty,
  OWLObjectPropertyList,
  OWLSearchResults,
  OWLSearchScore,
} from "@beep/ontology/Ontology.models";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeHttpUrlResult = S.decodeResult(HttpUrl);
const decodeOWLClassResult = S.decodeResult(OWLClass);
const decodeOWLObjectPropertyResult = S.decodeResult(OWLObjectProperty);
const decodeOWLSearchScoreResult = S.decodeResult(OWLSearchScore);
const isHttpUrl = S.is(HttpUrl);

const HttpUrlArbitrary = Arbitrary.schema(HttpUrl);
const GraphInfoArbitrary = Arbitrary.schema(GraphInfo);
const HealthResponseArbitrary = Arbitrary.schema(HealthResponse);
const OWLClassArbitrary = Arbitrary.schema(OWLClass);
const OWLObjectPropertyArbitrary = Arbitrary.schema(OWLObjectProperty);
const OWLClassListArbitrary = Arbitrary.schema(OWLClassList);
const OWLObjectPropertyListArbitrary = Arbitrary.schema(OWLObjectPropertyList);
const OWLSearchScoreArbitrary = Arbitrary.schema(OWLSearchScore);
const OWLSearchResultsArbitrary = Arbitrary.schema(OWLSearchResults);
const HTTPValidationErrorArbitrary = Arbitrary.schema(HTTPValidationError);

const encode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): C["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Encoded"]): C["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): void => {
  const decoded = decode(schema, encode(schema, value));

  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const expectWireRoundTrip = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Encoded"]): void => {
  expect(encode(schema, decode(schema, value))).toEqual(value);
};

const graphInfoGithubWire: S.Codec.Encoded<typeof GraphInfo> = {
  num_classes: 1025,
  num_properties: 175,
  title: "FOLIO Ontology",
  description: "Federated Open Legal Information Ontology",
  source_type: "github",
  github_repo_owner: "alea-institute",
  github_repo_name: "folio",
  github_repo_branch: "2.0.0",
};

const graphInfoHttpWire: S.Codec.Encoded<typeof GraphInfo> = {
  num_classes: 1025,
  num_properties: 175,
  title: "FOLIO Ontology",
  description: "Federated Open Legal Information Ontology",
  source_type: "http",
  http_url: "https://example.com/ontology.owl",
};

const owlClassWire: S.Codec.Encoded<typeof OWLClass> = {
  iri: "R8pNPutX0TN6DlEqkyZuxSw",
  label: "Lessor",
  sub_class_of: ["oS5FqyVBbOYQbhqb0G28oZR"],
  parent_class_of: ["Rparent"],
  see_also: ["RseeAlso"],
  deprecated: false,
  definition: "A party that grants a right to use something in return for payment.",
};

const owlObjectPropertyWire: S.Codec.Encoded<typeof OWLObjectProperty> = {
  iri: "R6qohvM786wjw0MNQJg9Dq",
  label: "drafted",
  sub_property_of: ["RparentProperty"],
  domain: ["Rdomain"],
  range: ["Rrange"],
  definition: "A relationship indicating that something was drafted.",
};

const owlSearchResultsWire: S.Codec.Encoded<typeof OWLSearchResults> = {
  results: [[owlClassWire, 0.95]],
};

const httpValidationErrorWire: S.Codec.Encoded<typeof HTTPValidationError> = {
  detail: [
    {
      loc: ["body", 0, "iri"],
      msg: "Field required",
      type: "missing",
      input: { iri: "" },
      ctx: { reason: "empty" },
    },
  ],
};

describe("@beep/ontology models", () => {
  it("owns constructive HTTP URL metadata and codec statics", () => {
    expect(
      Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(HttpUrl), { count: 20, seed: 0x5eed })).every(isHttpUrl)
    ).toBe(true);
    expect(HttpUrl.decodeUnknownSync("https://example.com/ontology.owl")).toBe("https://example.com/ontology.owl");
  });

  it("accepts only HTTP and HTTPS URL schemes", () => {
    expect(isHttpUrl("http://example.com/ontology.owl")).toBe(true);
    expect(isHttpUrl("https://example.com/ontology.owl")).toBe(true);
    expect(isHttpUrl("ftp://example.com/ontology.owl")).toBe(false);
  });

  it("preserves representative OpenAPI encoded wire shapes", () => {
    expectWireRoundTrip(GraphInfo, graphInfoGithubWire);
    expectWireRoundTrip(GraphInfo, graphInfoHttpWire);
    expectWireRoundTrip(OWLClass, owlClassWire);
    expectWireRoundTrip(OWLObjectProperty, owlObjectPropertyWire);
    expectWireRoundTrip(OWLSearchResults, owlSearchResultsWire);
    expectWireRoundTrip(HTTPValidationError, httpValidationErrorWire);
  });

  it("round-trips schema-derived ontology payloads", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([
            GraphInfoArbitrary,
            HealthResponseArbitrary,
            OWLClassArbitrary,
            OWLObjectPropertyArbitrary,
            OWLClassListArbitrary,
            OWLObjectPropertyListArbitrary,
            OWLSearchResultsArbitrary,
            HTTPValidationErrorArbitrary,
          ]),
          ([
            graphInfo,
            healthResponse,
            owlClass,
            owlObjectProperty,
            owlClassList,
            owlObjectPropertyList,
            searchResults,
            error,
          ]) => {
            expectRoundTrip(GraphInfo, graphInfo);
            expectRoundTrip(HealthResponse, healthResponse);
            expectRoundTrip(OWLClass, owlClass);
            expectRoundTrip(OWLObjectProperty, owlObjectProperty);
            expectRoundTrip(OWLClassList, owlClassList);
            expectRoundTrip(OWLObjectPropertyList, owlObjectPropertyList);
            expectRoundTrip(OWLSearchResults, searchResults);
            expectRoundTrip(HTTPValidationError, error);

            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed"));

  it("round-trips schema-derived URL and search-score primitives", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([HttpUrlArbitrary, OWLSearchScoreArbitrary]),
          ([url, score]) => {
            expectRoundTrip(HttpUrl, url);
            expectRoundTrip(OWLSearchScore, score);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));

  it("rejects malformed values for the absorbed precision invariants", () => {
    expect(Result.isFailure(decodeHttpUrlResult("not a url"))).toBe(true);
    expect(Result.isFailure(decodeOWLSearchScoreResult(Number.POSITIVE_INFINITY))).toBe(true);
    expect(Result.isFailure(decodeOWLClassResult({ iri: "" }))).toBe(true);
    expect(Result.isFailure(decodeOWLClassResult({ iri: "Rclass", sub_class_of: [""] }))).toBe(true);
    expect(Result.isFailure(decodeOWLObjectPropertyResult({ iri: "", domain: ["Rdomain"] }))).toBe(true);
    expect(Result.isFailure(decodeOWLObjectPropertyResult({ iri: "Rproperty", range: [""] }))).toBe(true);
  });
});
